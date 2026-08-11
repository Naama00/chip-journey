import { useEffect, useMemo, useRef, useState } from 'react';
import { PipelineCPU } from '@chip-journey/core/src/pipeline-cpu';
import { customProfile } from '@chip-journey/core/src/profiles/custom';
import { InstructionMemory } from '@chip-journey/core/src/instruction-memory';
import { Memory, RegisterFile } from '@chip-journey/core/src/state';
import { encodeInstruction, DecodedInstruction } from '@chip-journey/core/src/decoder';

const stageLabels = ['IF', 'ID', 'EX', 'MEM', 'WB'] as const;

type Snapshot = {
  cycle: number;
  pc: number;
  ifId: { isBubble: boolean; label: string };
  idEx: { isBubble: boolean; label: string };
  exMem: { isBubble: boolean; label: string };
  memWb: { isBubble: boolean; label: string };
  finished: boolean;
};

function makeStageLabel(stage: 'ifId' | 'idEx' | 'exMem' | 'memWb', latch: any) {
  if (latch.isBubble) {
    return 'bubble';
  }

  if (stage === 'ifId') {
    return `pc: ${latch.pc}`;
  }

  if (stage === 'idEx') {
    return latch.decoded?.mnemonic ?? 'decode';
  }

  if (stage === 'exMem') {
    if (latch.branchTaken) {
      return 'branch';
    }
    if (latch.memoryOp !== 'none') {
      return latch.memoryOp === 'read' ? 'load' : 'store';
    }
    return 'alu';
  }

  return latch.destReg === null ? 'writeback' : `R${latch.destReg}`;
}

function buildDemoProgram() {
  const program: DecodedInstruction[] = [
    { mnemonic: 'ADD', fields: { rd: 1, rs1: 0, rs2: 0 } },
    { mnemonic: 'ADD', fields: { rd: 1, rs1: 1, rs2: 0 } },
    { mnemonic: 'ADD', fields: { rd: 2, rs1: 1, rs2: 0 } },
    { mnemonic: 'JZ', fields: { rs: 1, addr: 5 } },
    { mnemonic: 'ADD', fields: { rd: 3, rs1: 2, rs2: 1 } },
    { mnemonic: 'JUMP', fields: { addr: 7 } },
    { mnemonic: 'ADD', fields: { rd: 3, rs1: 3, rs2: 0 } },
    { mnemonic: 'HALT', fields: {} },
    { mnemonic: 'HALT', fields: {} },
  ];

  return program.map((instr) => encodeInstruction(instr, customProfile));
}

function makeSnapshot(cpu: PipelineCPU, cycle: number): Snapshot {
  const ifId = cpu.ifIdLatch;
  const idEx = cpu.idExLatch;
  const exMem = cpu.exMemLatch;
  const memWb = cpu.memWbLatch;

  return {
    cycle,
    pc: cpu.pc,
    ifId: { isBubble: ifId.isBubble, label: makeStageLabel('ifId', ifId) },
    idEx: { isBubble: idEx.isBubble, label: makeStageLabel('idEx', idEx) },
    exMem: { isBubble: exMem.isBubble, label: makeStageLabel('exMem', exMem) },
    memWb: { isBubble: memWb.isBubble, label: makeStageLabel('memWb', memWb) },
    finished: cpu.finished,
  };
}

export default function PipelineView() {
  const cpuRef = useRef<PipelineCPU | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  const initialCpu = useMemo(() => {
    const instrMem = new InstructionMemory(16, customProfile.instructionWidth);
    const dataMem = new Memory(8, customProfile.dataWidth);
    const regFile = new RegisterFile(customProfile.registerCount, customProfile.dataWidth);

    const cpu = new PipelineCPU(customProfile, instrMem, dataMem, regFile);
    instrMem.load(buildDemoProgram());
    return cpu;
  }, []);

  useEffect(() => {
    if (!cpuRef.current) {
      cpuRef.current = initialCpu;
      setSnapshot(makeSnapshot(initialCpu, 0));
    }
  }, [initialCpu]);

  const refresh = (cycle: number) => {
    const cpu = cpuRef.current;
    if (!cpu) return;
    setSnapshot(makeSnapshot(cpu, cycle));
  };

  const handleStep = () => {
    const cpu = cpuRef.current;
    if (!cpu || cpu.finished) return;
    cpu.step();
    refresh((snapshot?.cycle ?? 0) + 1);
  };

  const handleRun = () => {
    const cpu = cpuRef.current;
    if (!cpu || cpu.finished) return;
    cpu.run(1000);
    refresh((snapshot?.cycle ?? 0) + 1);
  };

  if (!snapshot) {
    return <div>Loading pipeline demo...</div>;
  }

  const stageEntries = [
    { label: 'IF', isBubble: false, labelText: `pc: ${snapshot.pc}` },
    { label: 'ID', isBubble: snapshot.ifId.isBubble, labelText: snapshot.ifId.label },
    { label: 'EX', isBubble: snapshot.idEx.isBubble, labelText: snapshot.idEx.label },
    { label: 'MEM', isBubble: snapshot.exMem.isBubble, labelText: snapshot.exMem.label },
    { label: 'WB', isBubble: snapshot.memWb.isBubble, labelText: snapshot.memWb.label },
  ];

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', color: '#0f172a' }}>
      <h1>Pipeline View</h1>
      <div style={{ marginBottom: 16 }}>
        <strong>Cycle:</strong> {snapshot.cycle}
        <span style={{ marginLeft: 24 }}>
          {snapshot.finished ? <em>finished</em> : <em>running</em>}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        {stageEntries.map((entry) => {
          const isBubble = entry.isBubble;
          const bg = isBubble ? '#e2e8f0' : '#38bdf8';
          const color = isBubble ? '#64748b' : '#0f172a';

          return (
            <div
              key={entry.label}
              style={{
                flex: 1,
                padding: 16,
                borderRadius: 12,
                background: bg,
                color,
                minHeight: 110,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
                boxShadow: '0 2px 8px rgba(15, 23, 42, 0.08)',
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{entry.label}</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{entry.labelText}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          type="button"
          onClick={handleStep}
          disabled={snapshot.finished}
          style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#ffffff', cursor: snapshot.finished ? 'not-allowed' : 'pointer' }}
        >
          Step
        </button>
        <button
          type="button"
          onClick={handleRun}
          disabled={snapshot.finished}
          style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#ffffff', cursor: snapshot.finished ? 'not-allowed' : 'pointer' }}
        >
          Run to completion
        </button>
      </div>
    </div>
  );
}
