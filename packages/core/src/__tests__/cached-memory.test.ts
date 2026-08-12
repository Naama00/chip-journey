import { describe, expect, it } from 'vitest';
import { Cache } from '../cache';
import { CachedMemory } from '../cached-memory';
import { Memory } from '../state';
import { Signal } from '../gates';

function numberToBitsLsb(value: number, width = 8): Signal[] {
  const bits: Signal[] = [];
  for (let i = 0; i < width; i += 1) {
    bits.push(((value >> i) & 1) as Signal);
  }
  return bits;
}

function bitsToNumberLsb(bits: Signal[]): number {
  return bits.reduce((value, bit, index) => value + (bit << index), 0);
}

describe('CachedMemory', () => {
  it('misses on first read and then counts a hit on the next read', () => {
    const memory = new Memory(16, 8);
    const cache = new Cache(4, 8);
    const cachedMemory = new CachedMemory(memory, cache);

    memory.write(0, numberToBitsLsb(42));

    const first = cachedMemory.read(0);
    expect(first).toEqual({ hit: false, value: numberToBitsLsb(42) });
    expect(cachedMemory.missCount).toBe(1);
    expect(cachedMemory.hitCount).toBe(0);

    const second = cachedMemory.read(0);
    expect(second).toEqual({ hit: true, value: numberToBitsLsb(42) });
    expect(cachedMemory.missCount).toBe(1);
    expect(cachedMemory.hitCount).toBe(1);
  });

  it('write then read returns a hit with the written value', () => {
    const memory = new Memory(16, 8);
    const cache = new Cache(4, 8);
    const cachedMemory = new CachedMemory(memory, cache);

    cachedMemory.write(1, numberToBitsLsb(99));

    const result = cachedMemory.read(1);
    expect(result).toEqual({ hit: true, value: numberToBitsLsb(99) });
    expect(cachedMemory.hitCount).toBe(1);
    expect(cachedMemory.missCount).toBe(0);
  });

  it('write-through updates the underlying memory immediately', () => {
    const memory = new Memory(16, 8);
    const cache = new Cache(4, 8);
    const cachedMemory = new CachedMemory(memory, cache);
    const value = numberToBitsLsb(123);

    cachedMemory.write(2, value);
    expect(memory.read(2)).toEqual(value);
    expect(cachedMemory.read(2)).toEqual({ hit: true, value });
  });

  it('evicts a written address but still retrieves its value from backing memory on next read', () => {
    const memory = new Memory(16, 8);
    const cache = new Cache(3, 8);
    const cachedMemory = new CachedMemory(memory, cache);

    cachedMemory.write(0, numberToBitsLsb(10));
    cachedMemory.write(1, numberToBitsLsb(20));
    cachedMemory.write(2, numberToBitsLsb(30));

    // Refresh 0 so 1 becomes least recently used.
    expect(cachedMemory.read(0)).toEqual({ hit: true, value: numberToBitsLsb(10) });

    cachedMemory.write(3, numberToBitsLsb(40));

    const evicted = cachedMemory.read(1);
    expect(evicted.hit).toBe(false);
    expect(evicted.value).toEqual(numberToBitsLsb(20));
    expect(cachedMemory.missCount).toBe(1);
    expect(cachedMemory.hitCount).toBe(1);
  });

  it('reports the correct hit rate for a mix of reads', () => {
    const memory = new Memory(16, 8);
    const cache = new Cache(4, 8);
    const cachedMemory = new CachedMemory(memory, cache);

    memory.write(4, numberToBitsLsb(5));
    memory.write(5, numberToBitsLsb(6));

    cachedMemory.read(4);
    cachedMemory.read(4);
    cachedMemory.read(5);

    expect(cachedMemory.hitCount).toBe(1);
    expect(cachedMemory.missCount).toBe(2);
    expect(cachedMemory.hitRate).toBe(1 / 3);
  });
});
