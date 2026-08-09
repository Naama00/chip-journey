import { describe, it, expect } from 'vitest';
import { Signal, evaluateAnd, evaluateOr, evaluateNot, evaluateXor } from '../gates';

describe('evaluateAnd', () => {
  it('returns 0 when both inputs are 0', () => {
    const a: Signal = 0;
    const b: Signal = 0;

    const result = evaluateAnd(a, b);

    expect(result).toBe(0);
  });

  it('returns 0 when the first input is 0 and the second input is 1', () => {
    const a: Signal = 0;
    const b: Signal = 1;

    const result = evaluateAnd(a, b);

    expect(result).toBe(0);
  });

  it('returns 0 when the first input is 1 and the second input is 0', () => {
    const a: Signal = 1;
    const b: Signal = 0;

    const result = evaluateAnd(a, b);

    expect(result).toBe(0);
  });

  it('returns 1 when both inputs are 1', () => {
    const a: Signal = 1;
    const b: Signal = 1;

    const result = evaluateAnd(a, b);

    expect(result).toBe(1);
  });
});

describe('evaluateOr', () => {
  it('returns 0 when both inputs are 0', () => {
    const a: Signal = 0;
    const b: Signal = 0;

    const result = evaluateOr(a, b);

    expect(result).toBe(0);
  });

  it('returns 1 when the first input is 0 and the second input is 1', () => {
    const a: Signal = 0;
    const b: Signal = 1;

    const result = evaluateOr(a, b);

    expect(result).toBe(1);
  });

  it('returns 1 when the first input is 1 and the second input is 0', () => {
    const a: Signal = 1;
    const b: Signal = 0;

    const result = evaluateOr(a, b);

    expect(result).toBe(1);
  });

  it('returns 1 when both inputs are 1', () => {
    const a: Signal = 1;
    const b: Signal = 1;

    const result = evaluateOr(a, b);

    expect(result).toBe(1);
  });
});

describe('evaluateNot', () => {
  it('returns 1 when input is 0', () => {
    const a: Signal = 0;

    const result = evaluateNot(a);

    expect(result).toBe(1);
  });

  it('returns 0 when input is 1', () => {
    const a: Signal = 1;

    const result = evaluateNot(a);

    expect(result).toBe(0);
  });
});

describe('evaluateXor', () => {
  it('returns 0 when both inputs are 0', () => {
    const a: Signal = 0;
    const b: Signal = 0;

    const result = evaluateXor(a, b);

    expect(result).toBe(0);
  });

  it('returns 1 when the first input is 0 and the second input is 1', () => {
    const a: Signal = 0;
    const b: Signal = 1;

    const result = evaluateXor(a, b);

    expect(result).toBe(1);
  });

  it('returns 1 when the first input is 1 and the second input is 0', () => {
    const a: Signal = 1;
    const b: Signal = 0;

    const result = evaluateXor(a, b);

    expect(result).toBe(1);
  });

  it('returns 0 when both inputs are 1', () => {
    const a: Signal = 1;
    const b: Signal = 1;

    const result = evaluateXor(a, b);

    expect(result).toBe(0);
  });
});
