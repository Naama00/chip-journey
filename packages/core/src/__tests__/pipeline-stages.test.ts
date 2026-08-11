import { describe, expect, it, vi } from 'vitest';
import { CPU } from '../cpu';
import { customProfile } from '../profiles/custom';
import { InstructionMemory } from '../instruction-memory';
import { Memory, RegisterFile } from '../state';
import { encodeInstruction } from '../decoder';
import { stageDecode, stageExecute, stageFetch, stageMemory, stageWriteback } from '../pipeline-stages';
import { makeExMemBubble, makeIdExBubble, makeMemWbBubble, makeIfIdBubble } from '../pipeline-latches';
import { Signal } from '../gates';

function numberToBitsLsb(value: number): Signal[] {
  const bits: Signal[] = [];
  for (let i = 0; i < 8; i += 1) {
    bits.push(((value >> i) & 1) as Signal);
  }
  return bits;
}

describe('pipeline stages', () => {
  it('stageFetch returns instruction bits and pc', () => {
    const instrMem = new InstructionMemory(4, 16);
    const instruction = encodeInstruction({ mnemonic: 'ADD', fields: { rd: 1, rs1: 2, rs2: 3 } }, customProfile);
    instrMem.load([instruction]);

    const latch = stageFetch(0, instrMem);

    expect(latch.isBubble).toBe(false);
    if (!latch.isBubble) {
      expect(latch.instructionBits).toEqual(instruction);
      expect(latch.pc).toBe(0);
    }
  });

  it('stageDecode returns a bubble for bubble input', () => {
    const ctx = new CPU(customProfile, new InstructionMemory(1, 16), new Memory(1, 8), new RegisterFile(4, 8), {} as any);
    const latch = stageDecode(makeIfIdBubble(), customProfile, ctx);
    expect(latch.isBubble).toBe(true);
  });

  it('stageDecode reads register values and resolves destReg for ADD', () => {
    const instrMem = new InstructionMemory(1, 16);
    const instruction = encodeInstruction({ mnemonic: 'ADD', fields: { rd: 1, rs1: 2, rs2: 3 } }, customProfile);
    instrMem.load([instruction]);
    const ctx = new CPU(customProfile, instrMem, new Memory(1, 8), new RegisterFile(4, 8), {} as any);

    ctx.writeReg(2, numberToBitsLsb(5));
    ctx.writeReg(3, numberToBitsLsb(6));

    const ifIdLatch = { isBubble: false, instructionBits: instruction, pc: 0 } as const;
    const idExLatch = stageDecode(ifIdLatch, customProfile, ctx);

    expect(idExLatch.isBubble).toBe(false);
    if (!idExLatch.isBubble) {
      expect(idExLatch.regValues.rs1).toEqual(numberToBitsLsb(5));
      expect(idExLatch.regValues.rs2).toEqual(numberToBitsLsb(6));
      expect(idExLatch.destReg).toBe(1);
    }
  });

  it('stageExecute produces correct aluResult and branchTaken=false for ADD', () => {
    const ctx = new CPU(customProfile, new InstructionMemory(1, 16), new Memory(1, 8), new RegisterFile(4, 8), {} as any);
    ctx.writeReg(2, numberToBitsLsb(2));
    ctx.writeReg(3, numberToBitsLsb(3));

    const idExLatch = {
      isBubble: false,
      decoded: { mnemonic: 'ADD', fields: { rd: 1, rs1: 2, rs2: 3 } },
      pc: 0,
      regValues: {
        rs1: numberToBitsLsb(2),
        rs2: numberToBitsLsb(3),
      },
      destReg: 1,
    } as const;

    const exMemLatch = stageExecute(idExLatch, customProfile, ctx);

    expect(exMemLatch.isBubble).toBe(false);
    if (!exMemLatch.isBubble) {
      expect(exMemLatch.aluResult).toEqual(numberToBitsLsb(5));
      expect(exMemLatch.branchTaken).toBe(false);
      expect(exMemLatch.isHalt).toBe(false);
      expect(exMemLatch.destReg).toBe(1);
    }
  });

  it('stageExecute marks JZ taken when register is zero and computes branchTarget', () => {
    const ctx = new CPU(customProfile, new InstructionMemory(1, 16), new Memory(1, 8), new RegisterFile(4, 8), {} as any);
    ctx.writeReg(1, numberToBitsLsb(0));

    const idExLatch = {
      isBubble: false,
      decoded: { mnemonic: 'JZ', fields: { rs: 1, addr: 7 } },
      pc: 2,
      regValues: {
        rs: numberToBitsLsb(0),
      },
      destReg: null,
    } as const;

    const exMemLatch = stageExecute(idExLatch, customProfile, ctx);

    expect(exMemLatch.isBubble).toBe(false);
    if (!exMemLatch.isBubble) {
      expect(exMemLatch.branchTaken).toBe(true);
      expect(exMemLatch.branchTarget).toBe(7);
      expect(exMemLatch.isHalt).toBe(false);
    }
  });

  it('stageExecute marks JZ not taken when register is nonzero', () => {
    const ctx = new CPU(customProfile, new InstructionMemory(1, 16), new Memory(1, 8), new RegisterFile(4, 8), {} as any);
    ctx.writeReg(1, numberToBitsLsb(1));

    const idExLatch = {
      isBubble: false,
      decoded: { mnemonic: 'JZ', fields: { rs: 1, addr: 7 } },
      pc: 2,
      regValues: {
        rs: numberToBitsLsb(1),
      },
      destReg: null,
    } as const;

    const exMemLatch = stageExecute(idExLatch, customProfile, ctx);

    expect(exMemLatch.isBubble).toBe(false);
    if (!exMemLatch.isBubble) {
      expect(exMemLatch.branchTaken).toBe(false);
      expect(exMemLatch.branchTarget).toBe(7);
      expect(exMemLatch.isHalt).toBe(false);
    }
  });

  it('stageExecute sets isHalt=true for HALT instruction', () => {
    const ctx = new CPU(customProfile, new InstructionMemory(1, 16), new Memory(1, 8), new RegisterFile(4, 8), {} as any);

    const idExLatch = {
      isBubble: false,
      decoded: { mnemonic: 'HALT', fields: {} },
      pc: 0,
      regValues: {},
      destReg: null,
    } as const;

    const exMemLatch = stageExecute(idExLatch, customProfile, ctx);

    expect(exMemLatch.isBubble).toBe(false);
    if (!exMemLatch.isBubble) {
      expect(exMemLatch.isHalt).toBe(true);
      expect(exMemLatch.branchTaken).toBe(false);
      expect(exMemLatch.branchTarget).toBeNull();
    }
  });

  it('stageMemory writes memory for write operations and returns writeValue from aluResult for non-read', () => {
    const ctx = new CPU(customProfile, new InstructionMemory(1, 16), new Memory(4, 8), new RegisterFile(4, 8), {} as any);
    const storeValue = numberToBitsLsb(9);

    const exMemLatch = {
      isBubble: false,
      aluResult: numberToBitsLsb(0),
      destReg: null,
      memoryOp: 'write',
      memoryAddress: 2,
      storeValue,
      branchTaken: false,
      branchTarget: null,
      isHalt: false,
    } as const;

    const memWbLatch = stageMemory(exMemLatch, ctx);

    expect(ctx.readMem(2)).toEqual(storeValue);
    expect(memWbLatch.isBubble).toBe(false);
    if (!memWbLatch.isBubble) {
      expect(memWbLatch.writeValue).toEqual(exMemLatch.aluResult);
      expect(memWbLatch.destReg).toBeNull();
    }
  });

  it('stageMemory reads memory for read operations and returns memory value', () => {
    const ctx = new CPU(customProfile, new InstructionMemory(1, 16), new Memory(4, 8), new RegisterFile(4, 8), {} as any);
    const stored = numberToBitsLsb(13);
    ctx.writeMem(1, stored);

    const exMemLatch = {
      isBubble: false,
      aluResult: numberToBitsLsb(1),
      destReg: 2,
      memoryOp: 'read',
      memoryAddress: 1,
      storeValue: null,
      branchTaken: false,
      branchTarget: null,
      isHalt: false,
    } as const;

    const memWbLatch = stageMemory(exMemLatch, ctx);

    expect(memWbLatch.isBubble).toBe(false);
    if (!memWbLatch.isBubble) {
      expect(memWbLatch.writeValue).toEqual(stored);
      expect(memWbLatch.destReg).toBe(2);
    }
  });

  it('stageWriteback writes register for non-bubble latch with destReg', () => {
    const ctx = new CPU(customProfile, new InstructionMemory(1, 16), new Memory(1, 8), new RegisterFile(4, 8), {} as any);
    const value = numberToBitsLsb(11);

    const memWbLatch = {
      isBubble: false,
      writeValue: value,
      destReg: 1,
    } as const;

    stageWriteback(memWbLatch, ctx);
    expect(ctx.readReg(1)).toEqual(value);
  });

  it('stageWriteback does nothing for bubble or null destReg', () => {
    const ctx = new CPU(customProfile, new InstructionMemory(1, 16), new Memory(1, 8), new RegisterFile(4, 8), {} as any);
    const spyWriteReg = vi.spyOn(ctx, 'writeReg');

    stageWriteback(makeMemWbBubble(), ctx);
    stageWriteback({ isBubble: false, writeValue: numberToBitsLsb(1), destReg: null }, ctx);

    expect(spyWriteReg).not.toHaveBeenCalled();
  });
});
