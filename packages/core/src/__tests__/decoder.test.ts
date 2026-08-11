import { describe, it, expect } from 'vitest';
import { customProfile } from '../profiles/custom';
import { ProcessorProfile } from '../profile';
import { decodeInstruction, DecodedInstruction, bitsToNumber, numberToBits, encodeInstruction } from '../decoder';
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

  it('round-trips ADD through encodeInstruction and decodeInstruction', () => {
    const decoded: DecodedInstruction = {
      mnemonic: 'ADD',
      fields: { rd: 2, rs1: 1, rs2: 3 },
    };

    const encoded = encodeInstruction(decoded, customProfile);
    const roundTripped = decodeInstruction(encoded, customProfile);

    expect(roundTripped).toEqual(decoded);
  });

  it('round-trips LOAD through encodeInstruction and decodeInstruction', () => {
    const decoded: DecodedInstruction = {
      mnemonic: 'LOAD',
      fields: { rd: 1, addr: 0xA5 },
    };

    const encoded = encodeInstruction(decoded, customProfile);
    const roundTripped = decodeInstruction(encoded, customProfile);

    expect(roundTripped).toEqual(decoded);
  });

  it('round-trips HALT through encodeInstruction and decodeInstruction', () => {
    const decoded: DecodedInstruction = {
      mnemonic: 'HALT',
      fields: {},
    };

    const encoded = encodeInstruction(decoded, customProfile);
    const roundTripped = decodeInstruction(encoded, customProfile);

    expect(roundTripped).toEqual(decoded);
  });

  it('throws for an unknown mnemonic during encoding', () => {
    const decoded: DecodedInstruction = {
      mnemonic: 'JUMP',
      fields: { addr: 1 },
    };

    const fakeDecoded = {
      mnemonic: 'INVALID' as Mnemonic,
      fields: {},
    };

    expect(() => encodeInstruction(fakeDecoded, customProfile)).toThrow(/Unknown mnemonic/);
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

  it('round-trips instruction formats sharing an opcode with a dispatch field', () => {
    const dispatchProfile: ProcessorProfile = {
      name: 'dispatch-test',
      dataWidth: 8,
      instructionWidth: 9,
      registerCount: 4,
      harvard: false,
      instructionSet: [
        {
          mnemonic: 'ADD',
          opcode: 0,
          opcodeWidth: 3,
          fields: [
            { name: 'rd', width: 2 },
            { name: 'rs1', width: 2 },
            { name: 'funct', width: 2 },
          ],
          dispatchField: 'funct',
          dispatchValue: 0,
        },
        {
          mnemonic: 'SUB',
          opcode: 0,
          opcodeWidth: 3,
          fields: [
            { name: 'rd', width: 2 },
            { name: 'rs1', width: 2 },
            { name: 'funct', width: 2 },
          ],
          dispatchField: 'funct',
          dispatchValue: 1,
        },
      ],
    };

    const addDecoded: DecodedInstruction = {
      mnemonic: 'ADD',
      fields: { rd: 1, rs1: 2 },
    };

    const subDecoded: DecodedInstruction = {
      mnemonic: 'SUB',
      fields: { rd: 0, rs1: 3 },
    };

    const addEncoded = encodeInstruction(addDecoded, dispatchProfile);
    const subEncoded = encodeInstruction(subDecoded, dispatchProfile);

    expect(decodeInstruction(addEncoded, dispatchProfile)).toEqual({
      mnemonic: 'ADD',
      fields: { rd: 1, rs1: 2, funct: 0 },
    });

    expect(decodeInstruction(subEncoded, dispatchProfile)).toEqual({
      mnemonic: 'SUB',
      fields: { rd: 0, rs1: 3, funct: 1 },
    });
  });

  it('throws when opcode matches but dispatch field value does not match any format', () => {
    const dispatchProfile: ProcessorProfile = {
      name: 'dispatch-test',
      dataWidth: 8,
      instructionWidth: 9,
      registerCount: 4,
      harvard: false,
      instructionSet: [
        {
          mnemonic: 'ADD',
          opcode: 0,
          opcodeWidth: 3,
          fields: [
            { name: 'rd', width: 2 },
            { name: 'rs1', width: 2 },
            { name: 'funct', width: 2 },
          ],
          dispatchField: 'funct',
          dispatchValue: 0,
        },
        {
          mnemonic: 'SUB',
          opcode: 0,
          opcodeWidth: 3,
          fields: [
            { name: 'rd', width: 2 },
            { name: 'rs1', width: 2 },
            { name: 'funct', width: 2 },
          ],
          dispatchField: 'funct',
          dispatchValue: 1,
        },
      ],
    };

    const invalidBits: Signal[] = [
      ...toBits(0, 3), // opcode
      ...toBits(1, 2), // rd
      ...toBits(2, 2), // rs1
      ...toBits(2, 2), // funct = 2 invalid
    ];

    expect(() => decodeInstruction(invalidBits, dispatchProfile)).toThrow(/No instruction format matches opcode 0 and funct=2/);
  });
});
