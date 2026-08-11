import { describe, it, expect } from 'vitest';
import { CPU } from '../cpu';
import { ProcessorProfile } from '../profile';
import { InstructionMemory } from '../instruction-memory';
import { Memory, RegisterFile } from '../state';
import { customProfile } from '../profiles/custom';
import { encodeInstruction } from '../decoder';
import { Signal } from '../gates';
import { customHandlers } from '../execution';

function numberToBitsLsb(value: number): Signal[] {
  const bits: Signal[] = [];
  for (let i = 0; i < 8; i += 1) {
    bits.push(((value >> i) & 1) as Signal);
  }
  return bits;
}

function bitsToNumberLsb(bits: Signal[]): number {
  return bits.reduce((value, bit, index) => value + (bit << index), 0);
}

describe('CPU', () => {
  it('executes ADD and writes the result to the destination register', () => {
    const instrMem = new InstructionMemory(4, 16);
    const dataMem = new Memory(256, 8);
    const regFile = new RegisterFile(4, 8);
    const cpu = new CPU(customProfile, instrMem, dataMem, regFile, customHandlers);

    const instruction = encodeInstruction({ mnemonic: 'ADD', fields: { rd: 1, rs1: 2, rs2: 3 } }, customProfile);
    instrMem.load([instruction]);

    regFile.clockTick('R2', numberToBitsLsb(3));
    regFile.clockTick('R3', numberToBitsLsb(4));

    cpu.step();

    expect(bitsToNumberLsb(regFile.read('R1'))).toBe(7);
    expect(cpu.pc).toBe(1);
  });

  it('executes JUMP and updates the PC directly', () => {
    const instrMem = new InstructionMemory(4, 16);
    const dataMem = new Memory(256, 8);
    const regFile = new RegisterFile(4, 8);
    const cpu = new CPU(customProfile, instrMem, dataMem, regFile, customHandlers);

    const instruction = encodeInstruction({ mnemonic: 'JUMP', fields: { addr: 3 } }, customProfile);
    instrMem.load([instruction]);

    cpu.step();

    expect(cpu.pc).toBe(3);
  });

  it('halts and throws on stepping after HALT', () => {
    const instrMem = new InstructionMemory(4, 16);
    const dataMem = new Memory(256, 8);
    const regFile = new RegisterFile(4, 8);
    const cpu = new CPU(customProfile, instrMem, dataMem, regFile, customHandlers);

    const instruction = encodeInstruction({ mnemonic: 'HALT', fields: {} }, customProfile);
    instrMem.load([instruction]);

    cpu.step();

    expect(cpu.halted).toBe(true);
    expect(() => cpu.step()).toThrow(/Cannot step a halted CPU/);
  });

  it('runs the sum 1 to N program and stores 15 at data address 3', () => {
    const instrMem = new InstructionMemory(16, 16);
    const dataMem = new Memory(256, 8);
    const regFile = new RegisterFile(4, 8);
    const cpu = new CPU(customProfile, instrMem, dataMem, regFile, customHandlers);

    dataMem.write(0, numberToBitsLsb(5));
    dataMem.write(1, numberToBitsLsb(0));
    dataMem.write(2, numberToBitsLsb(1));

    const program = [
      encodeInstruction({ mnemonic: 'LOAD', fields: { rd: 1, addr: 0 } }, customProfile),
      encodeInstruction({ mnemonic: 'LOAD', fields: { rd: 2, addr: 1 } }, customProfile),
      encodeInstruction({ mnemonic: 'LOAD', fields: { rd: 3, addr: 2 } }, customProfile),
      encodeInstruction({ mnemonic: 'JZ', fields: { rs: 1, addr: 7 } }, customProfile),
      encodeInstruction({ mnemonic: 'ADD', fields: { rd: 2, rs1: 2, rs2: 1 } }, customProfile),
      encodeInstruction({ mnemonic: 'SUB', fields: { rd: 1, rs1: 1, rs2: 3 } }, customProfile),
      encodeInstruction({ mnemonic: 'JUMP', fields: { addr: 3 } }, customProfile),
      encodeInstruction({ mnemonic: 'STORE', fields: { rs: 2, addr: 3 } }, customProfile),
      encodeInstruction({ mnemonic: 'HALT', fields: {} }, customProfile),
    ];

    instrMem.load(program);
    cpu.run(1000);

    expect(bitsToNumberLsb(dataMem.read(3))).toBe(15);
  });
});
