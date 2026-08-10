import { describe, it, expect } from 'vitest';
import { Memory, Register, RegisterFile } from '../state';
import { Signal } from '../gates';

describe('Register', () => {
  it('starts at 0 and updates value on clockTick', () => {
    const register = new Register();

    expect(register.read()).toBe(0);

    register.clockTick(1);
    expect(register.read()).toBe(1);

    register.clockTick(0);
    expect(register.read()).toBe(0);
  });
});

describe('RegisterFile', () => {
  it('reads and writes register values for R1, R2, and R3', () => {
    const file = new RegisterFile();
    const r1Value: Signal[] = [1, 0, 1, 0, 1, 0, 1, 0];
    const r2Value: Signal[] = [0, 1, 0, 1, 0, 1, 0, 1];
    const r3Value: Signal[] = [1, 1, 1, 1, 0, 0, 0, 0];

    file.clockTick('R1', r1Value);
    file.clockTick('R2', r2Value);
    file.clockTick('R3', r3Value);

    expect(file.read('R1')).toEqual(r1Value);
    expect(file.read('R2')).toEqual(r2Value);
    expect(file.read('R3')).toEqual(r3Value);
  });

  it('keeps R0 hardwired to zero even after clockTick', () => {
    const file = new RegisterFile();

    file.clockTick('R0', [1, 1, 1, 1, 1, 1, 1, 1]);

    expect(file.read('R0')).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('throws on invalid register names', () => {
    const file = new RegisterFile();

    expect(() => file.read('R4')).toThrow();
    expect(() => file.clockTick('R4', [0, 0, 0, 0, 0, 0, 0, 0])).toThrow();
  });

  it('throws when writing an invalid bit array', () => {
    const file = new RegisterFile();

    expect(() => file.clockTick('R1', [0, 1, 0] as Signal[])).toThrow();
  });
});

describe('Memory', () => {
  it('initializes all bytes to zero', () => {
    const memory = new Memory();

    expect(memory.read(0)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(memory.read(255)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('writes and reads back a value at a valid address', () => {
    const memory = new Memory();
    const value: Signal[] = [1, 0, 1, 0, 1, 0, 1, 0];

    memory.write(42, value);
    expect(memory.read(42)).toEqual(value);
  });

  it('throws on out-of-range read or write addresses', () => {
    const memory = new Memory();

    expect(() => memory.read(-1)).toThrow();
    expect(() => memory.read(256)).toThrow();
    expect(() => memory.write(-1, [0, 0, 0, 0, 0, 0, 0, 0])).toThrow();
    expect(() => memory.write(256, [0, 0, 0, 0, 0, 0, 0, 0])).toThrow();
  });

  it('throws when writing a value that is not 8 bits', () => {
    const memory = new Memory();

    expect(() => memory.write(0, [1, 0, 1] as Signal[])).toThrow();
  });
});
