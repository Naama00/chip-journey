import { Signal } from './gates';

interface CacheLine {
  address: number;
  value: Signal[];
  lastUsedAt: number;
}

export class Cache {
  private readonly lineCount: number;
  private readonly wordWidth: number;
  private readonly entries: CacheLine[] = [];
  private accessCounter = 0;

  constructor(lineCount: number, wordWidth: number) {
    if (!Number.isInteger(lineCount) || lineCount <= 0) {
      throw new Error('lineCount must be a positive integer');
    }

    if (!Number.isInteger(wordWidth) || wordWidth <= 0) {
      throw new Error('wordWidth must be a positive integer');
    }

    this.lineCount = lineCount;
    this.wordWidth = wordWidth;
  }

  public get size(): number {
    return this.entries.length;
  }

  public get capacity(): number {
    return this.lineCount;
  }

  public lookup(address: number): { value: Signal[]; hit: true } | { hit: false } {
    this.assertValidAddress(address);

    const line = this.entries.find((entry) => entry.address === address);
    if (!line) {
      return { hit: false };
    }

    line.lastUsedAt = this.bumpAccessCounter();
    return { value: [...line.value], hit: true };
  }

  public insert(address: number, value: Signal[]): void {
    this.assertValidAddress(address);
    this.assertValueWidth(value);

    const existing = this.entries.find((entry) => entry.address === address);
    const now = this.bumpAccessCounter();

    if (existing) {
      existing.value = [...value];
      existing.lastUsedAt = now;
      return;
    }

    if (this.entries.length < this.lineCount) {
      this.entries.push({ address, value: [...value], lastUsedAt: now });
      return;
    }

    let lruIndex = 0;
    let oldest = this.entries[0].lastUsedAt;
    for (let index = 1; index < this.entries.length; index += 1) {
      if (this.entries[index].lastUsedAt < oldest) {
        oldest = this.entries[index].lastUsedAt;
        lruIndex = index;
      }
    }

    this.entries[lruIndex] = { address, value: [...value], lastUsedAt: now };
  }

  public write(address: number, value: Signal[]): void {
    this.insert(address, value);
  }

  private bumpAccessCounter(): number {
    this.accessCounter += 1;
    return this.accessCounter;
  }

  private assertValidAddress(address: number): void {
    if (!Number.isInteger(address) || address < 0) {
      throw new Error('address must be a non-negative integer');
    }
  }

  private assertValueWidth(value: Signal[]): void {
    if (value.length !== this.wordWidth) {
      throw new Error(`value must be exactly ${this.wordWidth} bits`);
    }
  }
}
