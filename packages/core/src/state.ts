import { Signal } from './gates';

export class Register {
  private value: Signal = 0;

  read(): Signal {
    return this.value;
  }

  clockTick(nextValue: Signal): void {
    this.value = nextValue;
  }
}

type RegisterName = 'R0' | 'R1' | 'R2' | 'R3';
const registerNames: RegisterName[] = ['R0', 'R1', 'R2', 'R3'];

export class RegisterFile {
  private registers: Record<RegisterName, Register[]> = {
    R0: Array.from({ length: 8 }, () => new Register()),
    R1: Array.from({ length: 8 }, () => new Register()),
    R2: Array.from({ length: 8 }, () => new Register()),
    R3: Array.from({ length: 8 }, () => new Register()),
  };

  read(name: string): Signal[] {
    if (!this.isValidRegisterName(name)) {
      throw new Error(`Invalid register name: ${name}`);
    }

    if (name === 'R0') {
      return [0, 0, 0, 0, 0, 0, 0, 0];
    }

    return this.registers[name].map((bitRegister) => bitRegister.read());
  }

  clockTick(name: string, nextValue: Signal[]): void {
    if (!this.isValidRegisterName(name)) {
      throw new Error(`Invalid register name: ${name}`);
    }

    if (nextValue.length !== 8) {
      throw new Error('RegisterFile clockTick requires exactly 8 bits');
    }

    if (name === 'R0') {
      return;
    }

    const targetRegisters = this.registers[name];
    for (let i = 0; i < 8; i += 1) {
      targetRegisters[i].clockTick(nextValue[i]);
    }
  }

  private isValidRegisterName(name: string): name is RegisterName {
    return registerNames.includes(name as RegisterName);
  }
}

export class Memory {
  private storage: Signal[][] = [];

  constructor() {
    for (let i = 0; i < 256; i += 1) {
      this.storage.push([0, 0, 0, 0, 0, 0, 0, 0]);
    }
  }

  read(address: number): Signal[] {
    this.assertValidAddress(address);
    return [...this.storage[address]];
  }

  write(address: number, value: Signal[]): void {
    this.assertValidAddress(address);

    if (value.length !== 8) {
      throw new Error('Memory write requires exactly 8 bits');
    }

    // Memory writes take effect immediately in this simplified model.
    this.storage[address] = [...value];
  }

  private assertValidAddress(address: number): void {
    if (!Number.isInteger(address) || address < 0 || address > 255) {
      throw new Error(`Invalid memory address: ${address}`);
    }
  }
}
