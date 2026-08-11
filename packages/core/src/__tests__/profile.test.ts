import { describe, it, expect } from 'vitest';
import { customProfile } from '../profiles/custom';
import { InstructionFormat, Mnemonic } from '../profile';

describe('customProfile', () => {
  function validateInstructionWidth(format: InstructionFormat, instructionWidth: number) {
    const fieldWidths = format.fields.reduce((sum, field) => sum + field.width, 0);
    expect(format.opcodeWidth + fieldWidths).toBeLessThanOrEqual(instructionWidth);
  }

  it('has exactly 7 instruction formats with the expected mnemonics', () => {
    const expectedMnemonics: Mnemonic[] = ['ADD', 'SUB', 'LOAD', 'STORE', 'JUMP', 'JZ', 'HALT'];

    expect(customProfile.instructionSet).toHaveLength(7);
    expect(customProfile.instructionSet.map((format) => format.mnemonic)).toEqual(expectedMnemonics);
  });

  it('validates opcode and field widths against instruction width for all formats', () => {
    for (const format of customProfile.instructionSet) {
      validateInstructionWidth(format, customProfile.instructionWidth);
    }
  });

  it('has no duplicate opcode/dispatchValue combinations', () => {
    const opcodeDispatchSet = new Set<string>();

    for (const format of customProfile.instructionSet) {
      const dispatchKey = `${format.opcode}:${format.dispatchValue ?? null}`;
      expect(opcodeDispatchSet.has(dispatchKey)).toBe(false);
      opcodeDispatchSet.add(dispatchKey);
    }
  });
});
