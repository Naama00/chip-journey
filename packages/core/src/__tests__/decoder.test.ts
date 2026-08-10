import { describe, it, expect } from 'vitest';
import { customProfile } from '../profiles/custom';
import { decodeInstruction, DecodedInstruction, bitsToNumber } from '../decoder';
import { Signal } from '../gates';

describe('decoder', () => {
  function toBits(value: number, width: number): Signal[] {
    const bits: Signal[] = [];
    for (let i = width - 1; i >= 0; i -= 1) {
      bits.push(((value >> i) & 1) as Signal);
    }
    return bits;
  }

  it('decodes an ADD instruction with rd, rs1, and rs2', () => {
    const opcode = toBits(0b0001, 4);
    const rd = toBits(2, 2);
    const rs1 = toBits(1, 2);
    const rs2 = toBits(3, 2);
    const unused = toBits(0, 6);

    const instruction: Signal[] = [...opcode, ...rd, ...rs1, ...rs2, ...unused];
    const decoded = decodeInstruction(instruction, customProfile);

    expect(decoded.mnemonic).toBe('ADD');
    expect(decoded.fields).toEqual({ rd: 2, rs1: 1, rs2: 3 });
  });

  it('decodes a LOAD instruction with rd and addr', () => {
    const opcode = toBits(0b0011, 4);
    const rd = toBits(1, 2);
    const addr = toBits(0xA5, 8);
    const unused = toBits(0, 2);

    const instruction: Signal[] = [...opcode, ...rd, ...addr, ...unused];
    const decoded = decodeInstruction(instruction, customProfile);

    expect(decoded.mnemonic).toBe('LOAD');
    expect(decoded.fields).toEqual({ rd: 1, addr: 0xA5 });
  });

  it('decodes a HALT instruction with no fields', () => {
    const opcode = toBits(0b1111, 4);
    const unused = toBits(0, 12);

    const instruction: Signal[] = [...opcode, ...unused];
    const decoded = decodeInstruction(instruction, customProfile);

    expect(decoded.mnemonic).toBe('HALT');
    expect(decoded.fields).toEqual({});
  });

  it('throws for an unrecognized opcode', () => {
    const opcode = toBits(0b0000, 4);
    const unused = toBits(0, 12);
    const instruction: Signal[] = [...opcode, ...unused];

    expect(() => decodeInstruction(instruction, customProfile)).toThrow(/Unknown opcode/);
  });

  it('throws for wrong instruction width', () => {
    const opcode = toBits(0b0001, 4);
    const shortBits: Signal[] = [...opcode, ...toBits(0, 8)];

    expect(() => decodeInstruction(shortBits, customProfile)).toThrow(/Instruction length must be 16 bits/);
  });
});
