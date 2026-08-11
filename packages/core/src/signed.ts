import { Signal } from './gates';

export function signExtendImmediate(raw: number, fieldWidth: number): number {
  if (!Number.isInteger(raw) || raw < 0 || raw >= 2 ** fieldWidth) {
    throw new Error(`Raw value ${raw} does not fit in ${fieldWidth} bits`);
  }

  const signBit = 1 << (fieldWidth - 1);
  return (raw & signBit) !== 0 ? raw - 2 ** fieldWidth : raw;
}

export function numberToTwosComplementBits(value: number, width: number): Signal[] {
  const min = -(2 ** (width - 1));
  const max = 2 ** (width - 1) - 1;

  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Value ${value} is not representable in ${width} bits two's complement`);
  }

  const modulus = 2 ** width;
  const normalized = ((value % modulus) + modulus) % modulus;
  const bits: Signal[] = [];

  for (let i = 0; i < width; i += 1) {
    bits.push(((normalized >> i) & 1) as Signal);
  }

  return bits;
}

export function twosComplementBitsToNumber(bits: Signal[]): number {
  if (bits.length === 0) {
    throw new Error('Cannot convert empty bit array to number');
  }

  const width = bits.length;
  const raw = bits.reduce<number>((value, bit, index) => value + (bit << index), 0);
  const signBit = 1 << (width - 1);

  return (raw & signBit) !== 0 ? raw - 2 ** width : raw;
}
