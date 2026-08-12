import { describe, expect, it } from 'vitest';
import { Cache } from '../cache';
import { Signal } from '../gates';

function numberToBitsLsb(value: number, width = 8): Signal[] {
  const bits: Signal[] = [];
  for (let i = 0; i < width; i += 1) {
    bits.push(((value >> i) & 1) as Signal);
  }
  return bits;
}

describe('Cache', () => {
  it('misses on a fresh cache', () => {
    const cache = new Cache(4, 8);
    expect(cache.lookup(0)).toEqual({ hit: false });
    expect(cache.size).toBe(0);
    expect(cache.capacity).toBe(4);
  });

  it('inserts and then hits on lookup', () => {
    const cache = new Cache(4, 8);
    const value = numberToBitsLsb(42);

    cache.insert(1, value);

    expect(cache.size).toBe(1);
    expect(cache.lookup(1)).toEqual({ hit: true, value });
  });

  it('writes and then hits on lookup', () => {
    const cache = new Cache(4, 8);
    const value = numberToBitsLsb(99);

    cache.write(2, value);

    expect(cache.size).toBe(1);
    expect(cache.lookup(2)).toEqual({ hit: true, value });
  });

  it('evicts the least recently used entry when full', () => {
    const cache = new Cache(3, 8);
    const valueA = numberToBitsLsb(1);
    const valueB = numberToBitsLsb(2);
    const valueC = numberToBitsLsb(3);
    const valueD = numberToBitsLsb(4);

    cache.insert(0, valueA);
    cache.insert(1, valueB);
    cache.insert(2, valueC);

    expect(cache.size).toBe(3);
    expect(cache.lookup(0)).toEqual({ hit: true, value: valueA });
    cache.lookup(0);

    cache.insert(3, valueD);

    expect(cache.size).toBe(3);
    expect(cache.lookup(0)).toEqual({ hit: true, value: valueA });
    expect(cache.lookup(2)).toEqual({ hit: true, value: valueC });
    expect(cache.lookup(3)).toEqual({ hit: true, value: valueD });
    expect(cache.lookup(1)).toEqual({ hit: false });
  });

  it('updates an existing entry in place without changing size', () => {
    const cache = new Cache(3, 8);
    const original = numberToBitsLsb(7);
    const updated = numberToBitsLsb(8);

    cache.insert(1, original);
    expect(cache.size).toBe(1);

    cache.write(1, updated);
    expect(cache.size).toBe(1);
    expect(cache.lookup(1)).toEqual({ hit: true, value: updated });
  });
});
