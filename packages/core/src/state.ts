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

export class RegisterFile {
  private readonly _registerCount: number;
  private readonly _wordWidth: number;
  private readonly registers: Record<string, Register[]>;

  constructor(registerCount: number, wordWidth: number) {
    if (!Number.isInteger(registerCount) || registerCount < 1) {
      throw new Error('registerCount must be a positive integer');
    }

    if (!Number.isInteger(wordWidth) || wordWidth < 1) {
      throw new Error('wordWidth must be a positive integer');
    }

    this._registerCount = registerCount;
    this._wordWidth = wordWidth;
    this.registers = {};

    for (let i = 1; i < registerCount; i += 1) {
      this.registers[`R${i}`] = Array.from({ length: wordWidth }, () => new Register());
    }
  }

  public get registerCount(): number {
    return this._registerCount;
  }

  public get wordWidth(): number {
    return this._wordWidth;
  }

  read(name: string): Signal[] {
    if (!this.isValidRegisterName(name)) {
      throw new Error(`Invalid register name: ${name}`);
    }

    if (name === 'R0') {
      return Array.from({ length: this._wordWidth }, () => 0 as Signal);
    }

    return this.registers[name].map((bitRegister) => bitRegister.read());
  }

  clockTick(name: string, nextValue: Signal[]): void {
    if (!this.isValidRegisterName(name)) {
      throw new Error(`Invalid register name: ${name}`);
    }

    if (nextValue.length !== this._wordWidth) {
      throw new Error(`RegisterFile clockTick requires exactly ${this._wordWidth} bits`);
    }

    if (name === 'R0') {
      return;
    }

    const targetRegisters = this.registers[name];
    for (let i = 0; i < this._wordWidth; i += 1) {
      targetRegisters[i].clockTick(nextValue[i]);
    }
  }

  private isValidRegisterName(name: string): boolean {
    if (!/^R\d+$/.test(name)) {
      return false;
    }

    const index = Number(name.slice(1));
    return Number.isInteger(index) && index >= 0 && index < this._registerCount;
  }
}

export class Memory {
  private storage: Signal[][] = [];
  private readonly _size: number;
  private readonly _wordWidth: number;

  constructor(size: number, wordWidth: number) {
    if (!Number.isInteger(size) || size < 1) {
      throw new Error('Memory size must be a positive integer');
    }

    if (!Number.isInteger(wordWidth) || wordWidth < 1) {
      throw new Error('Memory wordWidth must be a positive integer');
    }

    this._size = size;
    this._wordWidth = wordWidth;

    for (let i = 0; i < size; i += 1) {
      this.storage.push(Array.from({ length: wordWidth }, () => 0 as Signal));
    }
  }

  public get size(): number {
    return this._size;
  }

  public get wordWidth(): number {
    return this._wordWidth;
  }

  read(address: number): Signal[] {
    this.assertValidAddress(address);
    return [...this.storage[address]];
  }

  write(address: number, value: Signal[]): void {
    this.assertValidAddress(address);

    if (value.length !== this._wordWidth) {
      throw new Error(`Memory write requires exactly ${this._wordWidth} bits`);
    }

    // Memory writes take effect immediately in this simplified model.
    this.storage[address] = [...value];
  }

  private assertValidAddress(address: number): void {
    if (!Number.isInteger(address) || address < 0 || address >= this._size) {
      throw new Error(`Invalid memory address: ${address}`);
    }
  }
}
