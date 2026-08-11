import { describe, it, expect } from 'vitest';
import { CPU } from '../cpu';
import { InstructionMemory } from '../instruction-memory';
import { Memory, RegisterFile } from '../state';
import { mipsProfile } from '../profiles/mips';
import { mipsHandlers } from '../profiles/mips-handlers';
import { encodeInstruction } from '../decoder';
import { Signal } from '../gates';

function numberToBitsLsb(value: number, width: number): Signal[] {
  const bits: Signal[] = [];
  for (let i = 0; i < width; i += 1) {
    bits.push(((value >> i) & 1) as Signal);
  }
  return bits;
}

function bitsToNumberLsb(bits: Signal[]): number {
  return bits.reduce((value, bit, index) => value + (bit << index), 0);
}

describe('MIPS CPU', () => {
  it('runs a simple loop and stores the sum 1..5 in memory[0]', () => {
    const instrMem = new InstructionMemory(16, 32);
    const dataMem = new Memory(256, 32);
    const regFile = new RegisterFile(32, 32);
    const cpu = new CPU(mipsProfile, instrMem, dataMem, regFile, mipsHandlers);

    const program = [
      encodeInstruction({ mnemonic: 'ADDI', fields: { rs: 0, rt: 1, immediate: 5 } }, mipsProfile),
      encodeInstruction({ mnemonic: 'ADDI', fields: { rs: 0, rt: 2, immediate: 0 } }, mipsProfile),
      encodeInstruction({ mnemonic: 'BEQ', fields: { rs: 1, rt: 0, immediate: 3 } }, mipsProfile),
      encodeInstruction({ mnemonic: 'ADD', fields: { rs: 2, rt: 1, rd: 2, shamt: 0, funct: 0x20 } }, mipsProfile),
      encodeInstruction({ mnemonic: 'ADDI', fields: { rs: 1, rt: 1, immediate: 0xffff } }, mipsProfile),
      encodeInstruction({ mnemonic: 'J', fields: { address: 2 } }, mipsProfile),
      encodeInstruction({ mnemonic: 'SW', fields: { rs: 0, rt: 2, immediate: 0 } }, mipsProfile),
      encodeInstruction({ mnemonic: 'HALT', fields: {} }, mipsProfile),
    ];

    instrMem.load(program);
    cpu.run(1000);

    const loaded = dataMem.read(0);
    expect(bitsToNumberLsb(loaded)).toBe(15);
  });
});
