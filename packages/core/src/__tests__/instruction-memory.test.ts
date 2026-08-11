import { describe, it, expect } from 'vitest';
import { InstructionMemory } from '../instruction-memory';
import { Signal } from '../gates';

describe('InstructionMemory', () => {
  function zeroBits(width: number): Signal[] {
    return Array.from({ length: width }, () => 0 as Signal);
  }

  it('loads a program and reads instructions back correctly', () => {
    const memory = new InstructionMemory(4, 16);
    const program: Signal[][] = [
      [...zeroBits(16)],
      [1, 1, 1, 1, ...zeroBits(12)],
    ];

    memory.load(program);

    expect(memory.read(0)).toEqual(program[0]);
    expect(memory.read(1)).toEqual(program[1]);
    expect(memory.read(2)).toEqual(zeroBits(16));
  });

  it('throws for out-of-range read', () => {
    const memory = new InstructionMemory(2, 16);

    expect(() => memory.read(-1)).toThrow();
    expect(() => memory.read(2)).toThrow();
  });

  it('throws when loading a program that is too long', () => {
    const memory = new InstructionMemory(2, 16);
    const program: Signal[][] = [zeroBits(16), zeroBits(16), zeroBits(16)];

    expect(() => memory.load(program)).toThrow(/Program length exceeds instruction memory size/);
  });

  it('throws when loading an instruction with wrong width', () => {
    const memory = new InstructionMemory(2, 16);
    const program: Signal[][] = [zeroBits(16), zeroBits(8) as Signal[]];

    expect(() => memory.load(program)).toThrow(/does not match width 16/);
  });
});
