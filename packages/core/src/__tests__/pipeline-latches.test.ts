import { describe, it, expect } from 'vitest';
import { DecodedInstruction } from '../decoder';
import { Signal } from '../gates';
import {
  ExMemLatch,
  IdExLatch,
  IfIdLatch,
  MemWbLatch,
  makeExMemBubble,
  makeIdExBubble,
  makeIfIdBubble,
  makeMemWbBubble,
} from '../pipeline-latches';

describe('pipeline latch shapes', () => {
  it('creates an IF/ID bubble and recognizes valid IF/ID fields', () => {
    const bubble = makeIfIdBubble();
    expect(bubble.isBubble).toBe(true);

    const valid: IfIdLatch = {
      isBubble: false,
      instructionBits: [0, 1, 0, 1] as Signal[],
      pc: 12,
    };

    if (!valid.isBubble) {
      expect(valid.instructionBits).toEqual([0, 1, 0, 1]);
      expect(valid.pc).toBe(12);
    }
  });

  it('creates an ID/EX bubble and recognizes valid ID/EX fields', () => {
    const bubble = makeIdExBubble();
    expect(bubble.isBubble).toBe(true);

    const decoded: DecodedInstruction = {
      mnemonic: 'ADD',
      fields: { rd: 1, rs1: 2, rs2: 3 },
    };

    const valid: IdExLatch = {
      isBubble: false,
      decoded,
      pc: 8,
      regValues: {
        rs1: [1, 0] as Signal[],
        rs2: [0, 1] as Signal[],
      },
      destReg: 1,
    };

    if (!valid.isBubble) {
      expect(valid.decoded).toBe(decoded);
      expect(valid.regValues.rs1).toEqual([1, 0]);
      expect(valid.destReg).toBe(1);
    }
  });

  it('creates an EX/MEM bubble and recognizes valid EX/MEM fields', () => {
    const bubble = makeExMemBubble();
    expect(bubble.isBubble).toBe(true);

    const valid: ExMemLatch = {
      isBubble: false,
      aluResult: [1, 1, 0] as Signal[],
      destReg: null,
      memoryOp: 'write',
      memoryAddress: 7,
      storeValue: [0, 1, 0] as Signal[],
      branchTaken: false,
      branchTarget: null,
      isHalt: false,
    };

    if (!valid.isBubble) {
      expect(valid.aluResult).toEqual([1, 1, 0]);
      expect(valid.memoryOp).toBe('write');
      expect(valid.storeValue).toEqual([0, 1, 0]);
    }
  });

  it('creates a MEM/WB bubble and recognizes valid MEM/WB fields', () => {
    const bubble = makeMemWbBubble();
    expect(bubble.isBubble).toBe(true);

    const valid: MemWbLatch = {
      isBubble: false,
      writeValue: [1, 0, 1] as Signal[],
      destReg: 5,
    };

    if (!valid.isBubble) {
      expect(valid.writeValue).toEqual([1, 0, 1]);
      expect(valid.destReg).toBe(5);
    }
  });
});
