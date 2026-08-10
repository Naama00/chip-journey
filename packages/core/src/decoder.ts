import { FieldSpec, Mnemonic, ProcessorProfile } from './profile';
import { Signal } from './gates';

// Instruction words are represented MSB-first in the decoder.
// That means bits[0] is the opcode's most significant bit, matching
// the left-to-right layout used by instruction formats, e.g.
// opcode(4) rd(2) rs1(2) rs2(2).
//
// This is intentionally different from data words elsewhere in the
// codebase, where bits[0] is LSB-first for arithmetic and register values.

export function bitsToNumber(bits: Signal[]): number {
  return bits.reduce((value, bit) => (value << 1) | bit, 0);
}

export interface DecodedInstruction {
  mnemonic: Mnemonic;
  fields: Record<string, number>;
}

export function decodeInstruction(bits: Signal[], profile: ProcessorProfile): DecodedInstruction {
  if (bits.length !== profile.instructionWidth) {
    throw new Error(`Instruction length must be ${profile.instructionWidth} bits`);
  }

  if (profile.instructionSet.length === 0) {
    throw new Error('Processor profile has no instruction set');
  }

  const opcodeWidth = profile.instructionSet[0].opcodeWidth;
  const opcodeBits = bits.slice(0, opcodeWidth);
  const opcodeValue = bitsToNumber(opcodeBits);

  const format = profile.instructionSet.find((entry) => entry.opcode === opcodeValue);

  if (!format) {
    throw new Error(`Unknown opcode: ${opcodeValue}`);
  }

  const fields: Record<string, number> = {};
  let currentIndex = opcodeWidth;

  for (const field of format.fields) {
    const fieldBits = bits.slice(currentIndex, currentIndex + field.width);
    fields[field.name] = bitsToNumber(fieldBits);
    currentIndex += field.width;
  }

  return {
    mnemonic: format.mnemonic,
    fields,
  };
}
