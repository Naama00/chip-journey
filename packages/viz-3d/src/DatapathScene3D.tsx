import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, OrbitControls, Grid, Environment } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';

import { PipelineCPU } from '@chip-journey/core/src/pipeline-cpu';
import { customProfile } from '@chip-journey/core/src/profiles/custom';
import { InstructionMemory } from '@chip-journey/core/src/instruction-memory';
import { Memory, RegisterFile } from '@chip-journey/core/src/state';
import { encodeInstruction, DecodedInstruction } from '@chip-journey/core/src/decoder';

const compPositions: Record<string, [number, number, number]> = {
  PC: [-5, 1, 0],
  InstructionMemory: [-3, 1, 0],
  Decoder: [-1, 1, 0],
  RegisterFile: [-3, -1, 0],
  ALU: [-1, -1, 0],
  CachedMemory: [1, -1, 0],
};

const stageColors: Record<string, string> = {
  PC: '#0ea5e9',
  InstructionMemory: '#7c3aed',
  Decoder: '#f59e0b',
  RegisterFile: '#10b981',
  ALU: '#ec4899',
  CachedMemory: '#06b6d4',
};

function buildDemoProgram() {
  const program: DecodedInstruction[] = [
    { mnemonic: 'LOAD', fields: { rd: 0, addr: 0 } },
    { mnemonic: 'LOAD', fields: { rd: 1, addr: 1 } },
    { mnemonic: 'ADD', fields: { rd: 2, rs1: 0, rs2: 1 } },
    { mnemonic: 'STORE', fields: { rs: 2, addr: 2 } },
    { mnemonic: 'HALT', fields: {} },
  ];

  return program.map((instr) => encodeInstruction(instr, customProfile));
}

function ComponentBox({ name }: { name: string }) {
  const pos = compPositions[name];
  const color = stageColors[name] ?? '#9ca3af';
  return (
    <group position={pos as any}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.6, 1, 1]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} metalness={0.2} roughness={0.4} />
      </mesh>
      <Html position={[0, 0.9, 0]} center>
        <div style={{ color: 'white', fontSize: 14, fontWeight: 'bold', pointerEvents: 'none' }}>{name}</div>
      </Html>
    </group>
  );
}

function Edge({ from, to, activeSince }: { from: [number, number, number]; to: [number, number, number]; activeSince: number | null }) {
  const ref = useRef<THREE.Mesh>(null!);
  const curve = useMemo(() => {
    const p1 = new THREE.Vector3(...from);
    const p2 = new THREE.Vector3(...to);
    const mid = p1.clone().lerp(p2, 0.5).add(new THREE.Vector3(0, 0.6, 0));
    const curve = new THREE.CatmullRomCurve3([p1, mid, p2]);
    return curve;
  }, [from, to]);

  const tubeGeom = useMemo(() => new THREE.TubeGeometry(curve, 64, 0.06, 8, false), [curve]);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.02, metalness: 0.1, roughness: 0.6 }), []);

  useFrame((state) => {
    if (!ref.current) return;
    const now = performance.now();
    if (activeSince) {
      const elapsed = (now - activeSince) / 1000; // seconds
      // pulse over ~1.2s
      const t = Math.max(0, 1 - elapsed / 1.2);
      const inten = 0.02 + t * 1.6;
      (ref.current.material as any).emissiveIntensity = inten;
      (ref.current.material as any).color.set('#ffffff');
    } else {
      (ref.current.material as any).emissiveIntensity = 0.02;
    }
  });

  return <mesh ref={ref} geometry={tubeGeom} material={mat} />;
}

export default function DatapathScene3D() {
  const cpuRef = useRef<PipelineCPU | null>(null);
  const [snapshot, setSnapshot] = useState<any | null>(null);
  const [cycle, setCycle] = useState(0);

  // edges list of tuples with keys
  const edges = useMemo(() => [
    ['PC', 'InstructionMemory'],
    ['InstructionMemory', 'Decoder'],
    ['Decoder', 'RegisterFile'],
    ['RegisterFile', 'ALU'],
    ['ALU', 'CachedMemory'],
    ['Decoder', 'CachedMemory'],
    ['CachedMemory', 'RegisterFile'],
    ['Decoder', 'PC'],
  ] as const, []);

  // activeSince timestamps per edge key
  const activeSinceRef = useRef<Record<string, number | null>>({});

  useEffect(() => {
    const instrMem = new InstructionMemory(32, customProfile.instructionWidth);
    const dataMem = new Memory(256, customProfile.dataWidth);
    const regFile = new RegisterFile(customProfile.registerCount, customProfile.dataWidth);
    const cpu = new PipelineCPU(customProfile, instrMem, dataMem, regFile);
    const program = buildDemoProgram();
    while (program.length < 16) {
      program.push(encodeInstruction({ mnemonic: 'HALT', fields: {} }, customProfile));
    }
    instrMem.load(program);
    cpuRef.current = cpu;
    setSnapshot(readSnapshot(cpu, 0));

    // quick auto-verify pulses: run 2 steps on mount in dev
    if (process.env.NODE_ENV === 'development') {
      setTimeout(() => {
        cpu.step();
        setSnapshot(readSnapshot(cpu, 1));
      }, 200);
      setTimeout(() => {
        cpu.step();
        setSnapshot(readSnapshot(cpu, 2));
      }, 600);
    }
  }, []);

  function readSnapshot(cpu: PipelineCPU, cycleNum: number) {
    const ifId = cpu.ifIdLatch;
    const idEx = cpu.idExLatch;
    const exMem = cpu.exMemLatch;
    const memWb = cpu.memWbLatch;

    return {
      cycle: cycleNum,
      ifId,
      idEx,
      exMem,
      memWb,
      finished: cpu.finished,
    };
  }

  const computeActive = (snap: any) => {
    const activeSet = new Set<string>();
    if (!snap) return activeSet;
    // PC→InstrMem→Decoder always active if ifIdLatch is not a bubble
    if (!snap.ifId.isBubble) {
      activeSet.add('PC|InstructionMemory');
      activeSet.add('InstructionMemory|Decoder');
    }
    // Decoder→RegisterFile active if idExLatch is not a bubble
    if (!snap.idEx.isBubble) activeSet.add('Decoder|RegisterFile');
    // RegisterFile→ALU active if exMemLatch is not a bubble
    if (!snap.exMem.isBubble) activeSet.add('RegisterFile|ALU');
    // ALU/Decoder→CachedMemory active if exMemLatch is not a bubble AND memoryOp !== 'none'
    if (!snap.exMem.isBubble && snap.exMem.memoryOp !== 'none') {
      activeSet.add('ALU|CachedMemory');
      activeSet.add('Decoder|CachedMemory');
    }
    // CachedMemory/ALU→RegisterFile active if memWbLatch is not a bubble
    if (!snap.memWb.isBubble) activeSet.add('CachedMemory|RegisterFile');
    // Decoder→PC active if exMemLatch is not a bubble AND branchTaken is true
    if (!snap.exMem.isBubble && snap.exMem.branchTaken) activeSet.add('Decoder|PC');

    return activeSet;
  };

  // update activeSinceRef when snapshot changes
  useEffect(() => {
    const active = computeActive(snapshot);
    const now = performance.now();
    edges.forEach(([a, b]) => {
      const key = `${a}|${b}`;
      if (active.has(key)) {
        activeSinceRef.current[key] = now;
      } else {
        // leave previous timestamp so it can fade out
        if (!activeSinceRef.current[key]) activeSinceRef.current[key] = null;
      }
    });
  }, [snapshot, edges]);

  const handleStep = () => {
    const cpu = cpuRef.current;
    if (!cpu || cpu.finished) return;
    cpu.step();
    const c = cycle + 1;
    setCycle(c);
    setSnapshot(readSnapshot(cpu, c));
  };

  const handleRun = () => {
    const cpu = cpuRef.current;
    if (!cpu || cpu.finished) return;
    cpu.run(1000);
    const c = cycle + 1;
    setCycle(c);
    setSnapshot(readSnapshot(cpu, c));
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 4, 10], fov: 50 }} style={{ background: '#0b1020' }}>
        <ambientLight intensity={0.25} />
        <directionalLight castShadow intensity={0.9} position={[5, 10, 5]} />
        <directionalLight intensity={0.25} position={[-6, 5, -4]} />

        <Environment preset="city" />

        <EffectComposer>
          <Bloom luminanceThreshold={0.5} intensity={0.9} />
        </EffectComposer>

        <Grid position={[0, -1.1, 0]} args={[30, 30]} cellSize={1} cellThickness={0.6} fadeDistance={12} />

        <OrbitControls autoRotate autoRotateSpeed={0.4} />

        {/* components */}
        {Object.keys(compPositions).map((k) => (
          // @ts-ignore
          <ComponentBox key={k} name={k} />
        ))}

        {/* edges */}
        {edges.map(([a, b]) => {
          const key = `${a}|${b}`;
          const from = compPositions[a];
          const to = compPositions[b];
          const activeSince = activeSinceRef.current[key] ?? null;
          return <Edge key={key} from={from} to={to} activeSince={activeSince} />;
        })}

      </Canvas>

      <div style={{ position: 'absolute', left: 12, top: 12, background: 'rgba(255,255,255,0.92)', padding: 12, borderRadius: 8 }}>
        <div>
          <strong>Cycle:</strong> {snapshot ? snapshot.cycle : 0}
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <button type="button" onClick={handleStep} disabled={snapshot?.finished} style={{ padding: '6px 10px' }}>
            Step
          </button>
          <button type="button" onClick={handleRun} disabled={snapshot?.finished} style={{ padding: '6px 10px' }}>
            Run to completion
          </button>
        </div>
      </div>
    </div>
  );
}
