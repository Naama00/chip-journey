import { describe, expect, it } from 'vitest';
import { PipelineCPU } from '../pipeline-cpu';
import { customProfile } from '../profiles/custom';
import { mipsProfile } from '../profiles/mips';
import { InstructionMemory } from '../instruction-memory';
import { Memory, RegisterFile } from '../state';
import { decodeInstruction, encodeInstruction } from '../decoder';
import { Signal } from '../gates';

function numberToBitsLsb(value: number, width = 8): Signal[] {
  const bits: Signal[] = [];
  for (let i = 0; i < width; i += 1) {
    bits.push(((value >> i) & 1) as Signal);
  }
  return bits;
}

function bitsToNumberLsb(bits: Signal[]): number {
  return bits.reduce((value, bit, index) => value + (bit << index), 0);
}

describe('PipelineCPU', () => {
  it('executes a simple no-hazard program through the pipeline', () => {
    const instrMem = new InstructionMemory(4, 16);
    const dataMem = new Memory(16, 8);
    const regFile = new RegisterFile(4, 8);

    const program = [
      encodeInstruction({ mnemonic: 'ADD', fields: { rd: 1, rs1: 2, rs2: 3 } }, customProfile),
      encodeInstruction({ mnemonic: 'ADD', fields: { rd: 2, rs1: 0, rs2: 0 } }, customProfile),
      encodeInstruction({ mnemonic: 'HALT', fields: {} }, customProfile),
      encodeInstruction({ mnemonic: 'HALT', fields: {} }, customProfile),
    ];

    instrMem.load(program);
    regFile.clockTick('R2', numberToBitsLsb(2));
    regFile.clockTick('R3', numberToBitsLsb(4));

    const cpu = new PipelineCPU(customProfile, instrMem, dataMem, regFile);
    cpu.run(100);

    expect(cpu.finished).toBe(true);
    expect(cpu.readReg(1)).toEqual(numberToBitsLsb(6));
    expect(cpu.readReg(2)).toEqual(numberToBitsLsb(0));
  });

  it('stalls correctly for a RAW hazard and still produces the right result', () => {
    const instrMem = new InstructionMemory(4, 16);
    const dataMem = new Memory(16, 8);
    const regFile = new RegisterFile(4, 8);

    const program = [
      encodeInstruction({ mnemonic: 'ADD', fields: { rd: 1, rs1: 2, rs2: 3 } }, customProfile),
      encodeInstruction({ mnemonic: 'SUB', fields: { rd: 2, rs1: 1, rs2: 0 } }, customProfile),
      encodeInstruction({ mnemonic: 'HALT', fields: {} }, customProfile),
      encodeInstruction({ mnemonic: 'HALT', fields: {} }, customProfile),
    ];

    instrMem.load(program);
    regFile.clockTick('R2', numberToBitsLsb(5));
    regFile.clockTick('R3', numberToBitsLsb(7));

    const cpu = new PipelineCPU(customProfile, instrMem, dataMem, regFile);
    cpu.run(200);

    expect(cpu.finished).toBe(true);
    expect(cpu.readReg(1)).toEqual(numberToBitsLsb(12));
    expect(cpu.readReg(2)).toEqual(numberToBitsLsb(12));
  });

  it('sets finished after HALT drains and throws if step is called again', () => {
    const instrMem = new InstructionMemory(4, 16);
    const dataMem = new Memory(16, 8);
    const regFile = new RegisterFile(4, 8);

    const program = [
      encodeInstruction({ mnemonic: 'HALT', fields: {} }, customProfile),
      encodeInstruction({ mnemonic: 'HALT', fields: {} }, customProfile),
    ];

    instrMem.load(program);
    const cpu = new PipelineCPU(customProfile, instrMem, dataMem, regFile);

    cpu.run(50);
    expect(cpu.finished).toBe(true);
    expect(() => cpu.step()).toThrow(/Cannot step a finished PipelineCPU/);
  });

  it('takes JZ when the register is zero and flushes the wrong-path instructions', () => {
    const instrMem = new InstructionMemory(8, 16);
    const dataMem = new Memory(16, 8);
    const regFile = new RegisterFile(4, 8);

    const program = [
      encodeInstruction({ mnemonic: 'JZ', fields: { rs: 1, addr: 3 } }, customProfile),
      encodeInstruction({ mnemonic: 'ADD', fields: { rd: 2, rs1: 0, rs2: 0 } }, customProfile),
      encodeInstruction({ mnemonic: 'ADD', fields: { rd: 3, rs1: 0, rs2: 0 } }, customProfile),
      encodeInstruction({ mnemonic: 'HALT', fields: {} }, customProfile),
      encodeInstruction({ mnemonic: 'HALT', fields: {} }, customProfile),
      encodeInstruction({ mnemonic: 'HALT', fields: {} }, customProfile),
    ];

    instrMem.load(program);
    regFile.clockTick('R1', numberToBitsLsb(0));
    regFile.clockTick('R2', numberToBitsLsb(1));
    regFile.clockTick('R3', numberToBitsLsb(2));

    const cpu = new PipelineCPU(customProfile, instrMem, dataMem, regFile);
    cpu.run(100);

    expect(cpu.finished).toBe(true);
    expect(cpu.readReg(2)).toEqual(numberToBitsLsb(1));
    expect(cpu.readReg(3)).toEqual(numberToBitsLsb(2));
  });

  it('does not take JZ when the register is nonzero and executes sequentially', () => {
    const instrMem = new InstructionMemory(8, 16);
    const dataMem = new Memory(16, 8);
    const regFile = new RegisterFile(4, 8);

    const program = [
      encodeInstruction({ mnemonic: 'JZ', fields: { rs: 1, addr: 4 } }, customProfile),
      encodeInstruction({ mnemonic: 'ADD', fields: { rd: 2, rs1: 0, rs2: 0 } }, customProfile),
      encodeInstruction({ mnemonic: 'ADD', fields: { rd: 3, rs1: 0, rs2: 0 } }, customProfile),
      encodeInstruction({ mnemonic: 'HALT', fields: {} }, customProfile),
      encodeInstruction({ mnemonic: 'HALT', fields: {} }, customProfile),
      encodeInstruction({ mnemonic: 'HALT', fields: {} }, customProfile),
    ];

    instrMem.load(program);
    regFile.clockTick('R1', numberToBitsLsb(1));
    regFile.clockTick('R2', numberToBitsLsb(5));
    regFile.clockTick('R3', numberToBitsLsb(7));

    const cpu = new PipelineCPU(customProfile, instrMem, dataMem, regFile);
    cpu.run(100);

    expect(cpu.finished).toBe(true);
    expect(cpu.readReg(2)).toEqual(numberToBitsLsb(0));
    expect(cpu.readReg(3)).toEqual(numberToBitsLsb(0));
  });

  it('handles a full sum-1-to-N loop with branch flush and stalls', () => {
    const instrMem = new InstructionMemory(16, 16);
    const dataMem = new Memory(256, 8);
    const regFile = new RegisterFile(4, 8);
    const program = [
      encodeInstruction({ mnemonic: 'LOAD', fields: { rd: 1, addr: 0 } }, customProfile),
      encodeInstruction({ mnemonic: 'LOAD', fields: { rd: 2, addr: 1 } }, customProfile),
      encodeInstruction({ mnemonic: 'LOAD', fields: { rd: 3, addr: 2 } }, customProfile),
      encodeInstruction({ mnemonic: 'JZ', fields: { rs: 1, addr: 7 } }, customProfile),
      encodeInstruction({ mnemonic: 'ADD', fields: { rd: 2, rs1: 2, rs2: 1 } }, customProfile),
      encodeInstruction({ mnemonic: 'SUB', fields: { rd: 1, rs1: 1, rs2: 3 } }, customProfile),
      encodeInstruction({ mnemonic: 'JUMP', fields: { addr: 3 } }, customProfile),
      encodeInstruction({ mnemonic: 'STORE', fields: { rs: 2, addr: 3 } }, customProfile),
      encodeInstruction({ mnemonic: 'HALT', fields: {} }, customProfile),
      encodeInstruction({ mnemonic: 'HALT', fields: {} }, customProfile),
      encodeInstruction({ mnemonic: 'HALT', fields: {} }, customProfile),
    ];

    instrMem.load(program);
    dataMem.write(0, numberToBitsLsb(5));
    dataMem.write(1, numberToBitsLsb(0));
    dataMem.write(2, numberToBitsLsb(1));

    const cpu = new PipelineCPU(customProfile, instrMem, dataMem, regFile);
    cpu.run(1000);

    expect(cpu.finished).toBe(true);
    expect(dataMem.read(3)).toEqual(numberToBitsLsb(15));
    expect(cpu.cacheStats.missCount).toBeGreaterThan(0);
    expect(cpu.cacheStats.hitCount).toBeGreaterThanOrEqual(0);
    expect(cpu.cacheStats.hitRate).toBeGreaterThanOrEqual(0);
  });

  it('takes an unconditional JUMP and flushes the wrong path correctly', () => {
    const instrMem = new InstructionMemory(8, 16);
    const dataMem = new Memory(16, 8);
    const regFile = new RegisterFile(4, 8);

    const program = [
      encodeInstruction({ mnemonic: 'JUMP', fields: { addr: 3 } }, customProfile),
      encodeInstruction({ mnemonic: 'ADD', fields: { rd: 1, rs1: 2, rs2: 3 } }, customProfile),
      encodeInstruction({ mnemonic: 'ADD', fields: { rd: 2, rs1: 2, rs2: 3 } }, customProfile),
      encodeInstruction({ mnemonic: 'HALT', fields: {} }, customProfile),
      encodeInstruction({ mnemonic: 'HALT', fields: {} }, customProfile),
      encodeInstruction({ mnemonic: 'HALT', fields: {} }, customProfile),
    ];

    instrMem.load(program);
    regFile.clockTick('R2', numberToBitsLsb(2));
    regFile.clockTick('R3', numberToBitsLsb(3));

    const cpu = new PipelineCPU(customProfile, instrMem, dataMem, regFile);
    cpu.run(100);

    expect(cpu.finished).toBe(true);
    expect(cpu.readReg(1)).toEqual(numberToBitsLsb(0));
    expect(cpu.readReg(2)).toEqual(numberToBitsLsb(2));
  });

  it('finishes the MIPS sum 1..N program through the pipeline', () => {
    const instrMem = new InstructionMemory(16, 32);
    const dataMem = new Memory(256, 32);
    const regFile = new RegisterFile(32, 32);
    const program = [
      encodeInstruction({ mnemonic: 'ADDI', fields: { rs: 0, rt: 1, immediate: 5 } }, mipsProfile),
      encodeInstruction({ mnemonic: 'ADDI', fields: { rs: 0, rt: 2, immediate: 0 } }, mipsProfile),
      encodeInstruction({ mnemonic: 'BEQ', fields: { rs: 1, rt: 0, immediate: 3 } }, mipsProfile),
      encodeInstruction({ mnemonic: 'ADD', fields: { rs: 2, rt: 1, rd: 2, shamt: 0, funct: 0x20 } }, mipsProfile),
      encodeInstruction({ mnemonic: 'ADDI', fields: { rs: 1, rt: 1, immediate: 0xffff } }, mipsProfile),
      encodeInstruction({ mnemonic: 'J', fields: { address: 2 } }, mipsProfile),
      encodeInstruction({ mnemonic: 'SW', fields: { rs: 0, rt: 2, immediate: 0 } }, mipsProfile),
      encodeInstruction({ mnemonic: 'HALT', fields: {} }, mipsProfile),
    ];
    while (program.length < 16) {
      program.push(encodeInstruction({ mnemonic: 'HALT', fields: {} }, mipsProfile));
    }

    instrMem.load(program);
    const cpu = new PipelineCPU(mipsProfile, instrMem, dataMem, regFile);

    cpu.run(1000);

    expect(cpu.finished).toBe(true);
  });
});
