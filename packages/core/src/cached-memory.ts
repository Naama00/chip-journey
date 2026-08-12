import { Cache } from './cache';
import { Memory } from './state';
import { Signal } from './gates';

export class CachedMemory {
  private hits = 0;
  private misses = 0;

  constructor(private readonly memory: Memory, private readonly cache: Cache) {}

  /**
   * This class implements a WRITE-THROUGH policy: every write updates both
   * the cache and the backing Memory immediately. That means evictions can
   * safely discard cache lines without losing data, because the authoritative
   * value is always persisted in the backing Memory.
   */
  public read(address: number): { value: Signal[]; hit: boolean } {
    const cached = this.cache.lookup(address);

    if (cached.hit) {
      this.hits += 1;
      return { value: cached.value, hit: true };
    }

    this.misses += 1;
    const value = this.memory.read(address);
    this.cache.insert(address, value);
    return { value, hit: false };
  }

  public write(address: number, value: Signal[]): void {
    this.cache.write(address, value);
    this.memory.write(address, value);
  }

  public get hitCount(): number {
    return this.hits;
  }

  public get missCount(): number {
    return this.misses;
  }

  public get hitRate(): number {
    const total = this.hits + this.misses;
    return total === 0 ? 0 : this.hits / total;
  }
}
