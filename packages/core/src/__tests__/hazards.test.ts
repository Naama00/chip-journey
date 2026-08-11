import { describe, it, expect } from 'vitest';
import { getRegisterDependencies, hasRawHazard } from '../hazards';
import { InstructionFormat } from '../profile';
import { ExMemLatch, IdExLatch, MemWbLatch, makeExMemBubble, makeIdExBubble, makeMemWbBubble } from '../pipeline-latches';

describe('hazard metadata', () => {
  it('extracts dependencies for Custom ADD', () => {
    const format: InstructionFormat = {
      mnemonic: 'ADD',
      opcode: 0b0001,
      opcodeWidth: 4,
      fields: [
        { name: 'rd', width: 2 },
        { name: 'rs1', width: 2 },
        { name: 'rs2', width: 2 },
      ],
      srcRegFields: ['rs1', 'rs2'],
      destRegField: 'rd',
    };

    const decoded = { mnemonic: 'ADD' as const, fields: { rd: 1, rs1: 2, rs2: 3 } };
    const dependencies = getRegisterDependencies(decoded, format);

    expect(dependencies.reads).toEqual([2, 3]);
    expect(dependencies.writes).toEqual([1]);
  });

  it('extracts dependencies for Custom LOAD', () => {
    const format: InstructionFormat = {
      mnemonic: 'LOAD',
      opcode: 0b0011,
      opcodeWidth: 4,
      fields: [
        { name: 'rd', width: 2 },
        { name: 'addr', width: 8 },
      ],
      destRegField: 'rd',
    };

    const decoded = { mnemonic: 'LOAD' as const, fields: { rd: 1, addr: 42 } };
    const dependencies = getRegisterDependencies(decoded, format);

    expect(dependencies.reads).toEqual([]);
    expect(dependencies.writes).toEqual([1]);
  });

  it('extracts dependencies for Custom JUMP', () => {
    const format: InstructionFormat = {
      mnemonic: 'JUMP',
      opcode: 0b0101,
      opcodeWidth: 4,
      fields: [{ name: 'addr', width: 8 }],
    };

    const decoded = { mnemonic: 'JUMP' as const, fields: { addr: 7 } };
    const dependencies = getRegisterDependencies(decoded, format);

    expect(dependencies.reads).toEqual([]);
    expect(dependencies.writes).toEqual([]);
  });

  it('extracts dependencies for MIPS SW', () => {
    const format: InstructionFormat = {
      mnemonic: 'SW',
      opcode: 0x2B,
      opcodeWidth: 6,
      fields: [
        { name: 'rs', width: 5 },
        { name: 'rt', width: 5 },
        { name: 'immediate', width: 16 },
      ],
      srcRegFields: ['rs', 'rt'],
    };

    const decoded = { mnemonic: 'SW' as const, fields: { rs: 1, rt: 2, immediate: 0 } };
    const dependencies = getRegisterDependencies(decoded, format);

    expect(dependencies.reads).toEqual([1, 2]);
    expect(dependencies.writes).toEqual([]);
  });

  it('extracts dependencies for MIPS LW', () => {
    const format: InstructionFormat = {
      mnemonic: 'LW',
      opcode: 0x23,
      opcodeWidth: 6,
      fields: [
        { name: 'rs', width: 5 },
        { name: 'rt', width: 5 },
        { name: 'immediate', width: 16 },
      ],
      srcRegFields: ['rs'],
      destRegField: 'rt',
    };

    const decoded = { mnemonic: 'LW' as const, fields: { rs: 1, rt: 2, immediate: 0 } };
    const dependencies = getRegisterDependencies(decoded, format);

    expect(dependencies.reads).toEqual([1]);
    expect(dependencies.writes).toEqual([2]);
  });

  it('detects raw hazards in ID/EX, EX/MEM, and MEM/WB', () => {
    const idEx: IdExLatch = {
      isBubble: false,
      decoded: { mnemonic: 'ADD' as const, fields: { rd: 1, rs1: 2, rs2: 3 } },
      pc: 0,
      regValues: { rs1: [0, 0] as Signal[], rs2: [0, 0] as Signal[] },
      destReg: 5,
    };

    const exMem: ExMemLatch = {
      isBubble: false,
      aluResult: [0, 0] as Signal[],
      destReg: 6,
      memoryOp: 'none',
      memoryAddress: null,
      storeValue: null,
    };

    const memWb: MemWbLatch = {
      isBubble: false,
      writeValue: [0, 1] as Signal[],
      destReg: 7,
    };

    expect(hasRawHazard([5], idEx, exMem, memWb)).toBe(true);
    expect(hasRawHazard([6], idEx, exMem, memWb)).toBe(true);
    expect(hasRawHazard([7], idEx, exMem, memWb)).toBe(true);
    expect(hasRawHazard([8], idEx, exMem, memWb)).toBe(false);
  });

  it('returns false when all pipeline latches are bubbles', () => {
    expect(hasRawHazard([1], makeIdExBubble(), makeExMemBubble(), makeMemWbBubble())).toBe(false);
  });

  it('skips register 0 as a hazard source or destination', () => {
    const exMem: ExMemLatch = {
      isBubble: false,
      aluResult: [0, 0] as Signal[],
      destReg: 0,
      memoryOp: 'none',
      memoryAddress: null,
      storeValue: null,
    };

    expect(hasRawHazard([0], makeIdExBubble(), exMem, makeMemWbBubble())).toBe(false);
  });

  it('ignores latches with null destReg', () => {
    const idEx: IdExLatch = {
      isBubble: false,
      decoded: { mnemonic: 'STORE' as const, fields: { rs: 1, addr: 0 } },
      pc: 0,
      regValues: { rs: [0, 0] as Signal[] },
      destReg: null,
    };

    const exMem = makeExMemBubble();
    const memWb = makeMemWbBubble();

    expect(hasRawHazard([1], idEx, exMem, memWb)).toBe(false);
  });

  it('detects a hazard when at least one source register matches', () => {
    const idEx: IdExLatch = {
      isBubble: false,
      decoded: { mnemonic: 'ADD' as const, fields: { rd: 1, rs1: 2, rs2: 3 } },
      pc: 0,
      regValues: { rs1: [0, 0] as Signal[], rs2: [0, 0] as Signal[] },
      destReg: 9,
    };

    const exMem: ExMemLatch = {
      isBubble: false,
      aluResult: [0, 0] as Signal[],
      destReg: null,
      memoryOp: 'none',
      memoryAddress: null,
      storeValue: null,
    };

    const memWb: MemWbLatch = {
      isBubble: false,
      writeValue: [0, 1] as Signal[],
      destReg: 10,
    };

    expect(hasRawHazard([0, 10], idEx, exMem, memWb)).toBe(true);
  });
});
