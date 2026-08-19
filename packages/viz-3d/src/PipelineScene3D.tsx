import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls, Grid, Environment } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useRef as useRef3 } from 'react';
import * as THREE from 'three';
import { PipelineCPU } from '@chip-journey/core/src/pipeline-cpu';
import { customProfile } from '@chip-journey/core/src/profiles/custom';
import { InstructionMemory } from '@chip-journey/core/src/instruction-memory';
import { Memory, RegisterFile } from '@chip-journey/core/src/state';
import { encodeInstruction, DecodedInstruction } from '@chip-journey/core/src/decoder';

const stationPositions = [
  [-4, 0.5, 0],
  [-2, 0.5, 0],
  [0, 0.5, 0],
  [2, 0.5, 0],
  [4, 0.5, 0],
] as const;

const stageColors: Record<string, string> = {
  IF: '#0ea5e9',
  ID: '#7c3aed',
  EX: '#f59e0b',
  MEM: '#10b981',
  WB: '#ec4899',
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

function StageBox({ position, label, isBubble }: { position: [number, number, number]; label: string; isBubble: boolean }) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0f172a';
  ctx.font = '28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, canvas.width / 2, canvas.height / 2);

  const tex = new THREE.CanvasTexture(canvas);

  const baseColor = stageColors[label] ?? '#06b6d4';
  const color = isBubble ? '#9ca3af' : baseColor;
  const emissive = isBubble ? '#000000' : baseColor;

  return (
    <group position={position as any}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.6, 1, 1]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={isBubble ? 0.05 : 0.8} metalness={0.2} roughness={0.4} />
      </mesh>
      <Html position={[0, 0.9, 0]} center>
        <div style={{ color: 'white', fontSize: 14, fontWeight: 'bold', pointerEvents: 'none' }}>{label}</div>
      </Html>
    </group>
  );
}

function Tracker({ target }: { target: [number, number, number] }) {
  const ref = useRef<any>();
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.lerp(new THREE.Vector3(target[0], target[1] + 0.6, target[2]), 0.15);
  });
  return (
    <mesh ref={ref} position={[target[0], target[1] + 0.6, target[2]]}>
      <sphereGeometry args={[0.18, 16, 16]} />
      <meshStandardMaterial emissive={new THREE.Color('#fde047')} color={new THREE.Color('#facc15')} />
    </mesh>
  );
}

function SimpleOrbitControls() {
  const { camera, gl } = useThree();
  const ref = useRef3<any>();
  useEffect(() => {
    const controls = new (require('three/examples/jsm/controls/OrbitControls').OrbitControls)(camera, gl.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    ref.current = controls;
    const loop = () => {
      controls.update();
      requestAnimationFrame(loop);
    };
    loop();
    return () => controls.dispose();
  }, [camera, gl]);
  return null;
}

export default function PipelineScene3D() {
  const cpuRef = useRef<PipelineCPU | null>(null);
  const [snapshot, setSnapshot] = useState<any | null>(null);
  const [cycle, setCycle] = useState(0);

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
  }, []);

  function readSnapshot(cpu: PipelineCPU, cycleNum: number) {
    const ifId = cpu.ifIdLatch;
    const idEx = cpu.idExLatch;
    const exMem = cpu.exMemLatch;
    const memWb = cpu.memWbLatch;

    return {
      cycle: cycleNum,
      stages: [
        { label: 'IF', isBubble: false },
        { label: 'ID', isBubble: ifId.isBubble },
        { label: 'EX', isBubble: idEx.isBubble },
        { label: 'MEM', isBubble: exMem.isBubble },
        { label: 'WB', isBubble: memWb.isBubble },
      ],
      finished: cpu.finished,
    };
  }

  const handleStep = () => {
    const cpu = cpuRef.current;
    if (!cpu || cpu.finished) return;
    cpu.step();
    const c = cycle + 1;
    setCycle(c);
    setSnapshot(readSnapshot(cpu, c));
  };

  const handleRun = async () => {
    const cpu = cpuRef.current;
    if (!cpu || cpu.finished) return;
    cpu.run(1000);
    const c = cycle + 1;
    setCycle(c);
    setSnapshot(readSnapshot(cpu, c));
  };

  // determine tracker target: furthest-along non-bubble stage
  const trackerTarget = useMemo(() => {
    if (!snapshot) return stationPositions[0];
    for (let i = stationPositions.length - 1; i >= 0; i--) {
      const s = snapshot.stages[i];
      if (!s.isBubble) return stationPositions[i];
    }
    return stationPositions[0];
  }, [snapshot]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 4, 10], fov: 50 }} style={{ background: '#0b1020' }}>
        <ambientLight intensity={0.25} />
        <directionalLight castShadow intensity={0.9} position={[5, 10, 5]} shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
        <directionalLight intensity={0.25} position={[-6, 5, -4]} />
        <spotLight intensity={0.12} position={[0, 6, -8]} penumbra={1} />

        <Environment preset="city" />

        <EffectComposer>
          <Bloom luminanceThreshold={0.5} intensity={0.9} />
        </EffectComposer>

        <Grid position={[0, 0, 0]} args={[20, 20]} cellSize={1} cellThickness={0.6} fadeDistance={10} />

        <OrbitControls autoRotate autoRotateSpeed={0.6} />

        {stationPositions.map((pos, i) => (
          <StageBox key={i} position={pos as any} label={['IF', 'ID', 'EX', 'MEM', 'WB'][i]} isBubble={!!snapshot ? snapshot.stages[i].isBubble : true} />
        ))}

        <Tracker target={trackerTarget as any} />
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
