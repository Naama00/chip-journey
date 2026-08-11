import { Signal } from './gates';

export class InstructionMemory {
  private storage: Signal[][];
  private readonly instructionWidth: number;

  constructor(size: number, instructionWidth: number) {
    if (!Number.isInteger(size) || size <= 0) {
      throw new Error('InstructionMemory size must be a positive integer');
    }

    if (!Number.isInteger(instructionWidth) || instructionWidth <= 0) {
      throw new Error('InstructionMemory instructionWidth must be a positive integer');
    }

    this.instructionWidth = instructionWidth;
    this.storage = Array.from({ length: size }, () => Array.from({ length: instructionWidth }, () => 0 as Signal));
  }

  read(pc: number): Signal[] {
    this.assertValidPc(pc);
    return [...this.storage[pc]];
  }

  load(program: Signal[][]): void {
    if (program.length > this.storage.length) {
      throw new Error('Program length exceeds instruction memory size');
    }

    for (let i = 0; i < program.length; i += 1) {
      const instruction = program[i];

      if (instruction.length !== this.instructionWidth) {
        throw new Error(`Instruction at index ${i} does not match width ${this.instructionWidth}`);
      }

      this.storage[i] = [...instruction];
    }
  }

  private assertValidPc(pc: number): void {
    if (!Number.isInteger(pc) || pc < 0 || pc >= this.storage.length) {
      throw new Error(`Program counter out of range: ${pc}`);
    }
  }
}
