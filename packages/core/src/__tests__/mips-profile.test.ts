import { describe, it, expect } from 'vitest';
import { mipsProfile } from '../profiles/mips';
import { encodeInstruction, decodeInstruction } from '../decoder';
import { ProcessorProfile, InstructionFormat } from '../profile';

function validateInstructionWidth(format: InstructionFormat, instructionWidth: number) {
  const fieldWidths = format.fields.reduce((sum, field) => sum + field.width, 0);
  expect(format.opcodeWidth + fieldWidths).toBeLessThanOrEqual(instructionWidth);
}

describe('mipsProfile', () => {
  it('has exactly 11 instruction formats', () => {
    expect(mipsProfile.instructionSet).toHaveLength(11);
  });

  it('validates opcode and field widths against instruction width for all formats', () => {
    for (const format of mipsProfile.instructionSet) {
      validateInstructionWidth(format, mipsProfile.instructionWidth);
    }
  });

  it('has no duplicate opcode/dispatchValue combinations', () => {
    const opcodeDispatchSet = new Set<string>();

    for (const format of mipsProfile.instructionSet) {
      const dispatchKey = `${format.opcode}:${format.dispatchValue ?? null}`;
      expect(opcodeDispatchSet.has(dispatchKey)).toBe(false);
      opcodeDispatchSet.add(dispatchKey);
    }
  });

  it('round-trips an R-type ADD instruction through encode and decode', () => {
    const decoded = {
      mnemonic: 'ADD' as const,
      fields: { rs: 1, rt: 2, rd: 3, shamt: 0, funct: 0x20 },
    };

    const encoded = encodeInstruction(decoded, mipsProfile);
    const roundTripped = decodeInstruction(encoded, mipsProfile);

    expect(roundTripped.mnemonic).toBe('ADD');
    expect(roundTripped.fields).toEqual(decoded.fields);
  });

  it('round-trips an I-type ADDI instruction through encode and decode', () => {
    const decoded = {
      mnemonic: 'ADDI' as const,
      fields: { rs: 1, rt: 2, immediate: 0x1234 },
    };

    const encoded = encodeInstruction(decoded, mipsProfile);
    const roundTripped = decodeInstruction(encoded, mipsProfile);

    expect(roundTripped.mnemonic).toBe('ADDI');
    expect(roundTripped.fields).toEqual(decoded.fields);
  });
});
