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
  return bits.reduce<number>((value, bit) => (value << 1) | bit, 0);
}

export function numberToBits(value: number, width: number): Signal[] {
  if (value < 0 || value >= 2 ** width) {
    throw new Error(`Value ${value} does not fit in ${width} bits`);
  }

  const bits: Signal[] = [];

  for (let i = width - 1; i >= 0; i -= 1) {
    bits.push(((value >> i) & 1) as Signal);
  }

  return bits;
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

  const opcodeMatches = profile.instructionSet.filter((entry) => entry.opcode === opcodeValue);

  if (opcodeMatches.length === 0) {
    throw new Error(`Unknown opcode: ${opcodeValue}`);
  }

  if (opcodeMatches.length === 1) {
    const format = opcodeMatches[0];
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

  const sharedFormat = opcodeMatches[0];
  if (!sharedFormat.dispatchField) {
    throw new Error(`Ambiguous opcode ${opcodeValue} has multiple matching formats but no dispatchField`);
  }

  const fields: Record<string, number> = {};
  let currentIndex = opcodeWidth;

  for (const field of sharedFormat.fields) {
    const fieldBits = bits.slice(currentIndex, currentIndex + field.width);
    fields[field.name] = bitsToNumber(fieldBits);
    currentIndex += field.width;
  }

  const dispatchValue = fields[sharedFormat.dispatchField];
  if (dispatchValue === undefined) {
    throw new Error(`Missing dispatch field ${sharedFormat.dispatchField} for opcode ${opcodeValue}`);
  }

  const selectedFormat = opcodeMatches.find((entry) => entry.dispatchValue === dispatchValue);
  if (!selectedFormat) {
    throw new Error(`No instruction format matches opcode ${opcodeValue} and ${sharedFormat.dispatchField}=${dispatchValue}`);
  }

  return {
    mnemonic: selectedFormat.mnemonic,
    fields,
  };
}

export function encodeInstruction(instr: DecodedInstruction, profile: ProcessorProfile): Signal[] {
  const format = profile.instructionSet.find((entry) => entry.mnemonic === instr.mnemonic);

  if (!format) {
    throw new Error(`Unknown mnemonic: ${instr.mnemonic}`);
  }

  const opcodeBits = numberToBits(format.opcode, format.opcodeWidth);
  const fieldBits: Signal[] = [];

  for (const field of format.fields) {
    let value: number;

    if (field.name === format.dispatchField) {
      if (format.dispatchValue === undefined) {
        throw new Error(`Instruction format for ${instr.mnemonic} declares dispatchField but no dispatchValue`);
      }
      value = format.dispatchValue;
      // Always encode the dispatch field from the format's defined dispatchValue,
      // ignoring any caller-supplied value for consistency.
    } else {
      if (!(field.name in instr.fields)) {
        throw new Error(`Missing field ${field.name} for mnemonic ${instr.mnemonic}`);
      }

      value = instr.fields[field.name];
    }

    fieldBits.push(...numberToBits(value, field.width));
  }

  const bits = [...opcodeBits, ...fieldBits];

  if (bits.length > profile.instructionWidth) {
    throw new Error(`Encoded instruction exceeds width ${profile.instructionWidth}`);
  }

  const paddedBits: Signal[] = [...bits];
  while (paddedBits.length < profile.instructionWidth) {
    paddedBits.push(0);
  }

  if (paddedBits.length !== profile.instructionWidth) {
    throw new Error('Encoded instruction length mismatch after padding');
  }

  return paddedBits;
}
