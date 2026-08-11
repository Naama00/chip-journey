import { describe, it, expect } from 'vitest';
import { signExtendImmediate, numberToTwosComplementBits, twosComplementBitsToNumber } from '../signed';

describe('signed utilities', () => {
  it('keeps a positive immediate unchanged', () => {
    expect(signExtendImmediate(0x0005, 16)).toBe(5);
  });

  it('sign-extends a negative 16-bit immediate', () => {
    expect(signExtendImmediate(0xfffb, 16)).toBe(-5);
  });

  it('encodes a small positive value to two\'s complement bits', () => {
    expect(numberToTwosComplementBits(5, 8)).toEqual([1, 0, 1, 0, 0, 0, 0, 0]);
  });

  it('encodes a small negative value to two\'s complement bits', () => {
    expect(numberToTwosComplementBits(-5, 8)).toEqual([1, 1, 0, 1, 1, 1, 1, 1]);
  });

  it('round-trips a negative value through two\'s complement and sign extension', () => {
    const original = -5;
    const bits = numberToTwosComplementBits(original, 8);
    const raw = bits.reduce((value, bit, index) => value + (bit << index), 0);

    expect(signExtendImmediate(raw, 8)).toBe(original);
  });

  it('round-trips two\'s complement bits to number for a variety of 8-bit values', () => {
    const values = [0, 5, -5, 127, -128];

    values.forEach((value) => {
      const bits = numberToTwosComplementBits(value, 8);
      const roundTripped = twosComplementBitsToNumber(bits);

      expect(roundTripped).toBe(value);
    });
  });
});
