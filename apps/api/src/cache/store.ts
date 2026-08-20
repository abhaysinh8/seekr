import type { Redis } from 'ioredis';

export interface CacheStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export class RedisCacheStore implements CacheStore {
  constructor(private readonly client: Redis) {}
  async get(key: string): Promise<string | undefined> {
    return (await this.client.get(key)) ?? undefined;
  }
  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, 'EX', ttlSeconds);
  }
  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }
}

interface MemoryEntry {
  readonly value: string;
  readonly expiresAt: number;
}
export class MemoryCacheStore implements CacheStore {
  readonly #entries = new Map<string, MemoryEntry>();
  constructor(private readonly now: () => number = Date.now) {}
  get(key: string): Promise<string | undefined> {
    const entry = this.#entries.get(key);
    if (entry === undefined) return Promise.resolve(undefined);
    if (entry.expiresAt <= this.now()) {
      this.#entries.delete(key);
      return Promise.resolve(undefined);
    }
    return Promise.resolve(entry.value);
  }
  set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.#entries.set(key, { value, expiresAt: this.now() + ttlSeconds * 1000 });
    return Promise.resolve();
  }
  delete(key: string): Promise<void> {
    this.#entries.delete(key);
    return Promise.resolve();
  }
}

export class ResilientCacheStore implements CacheStore {
  constructor(private readonly delegate: CacheStore) {}
  async get(key: string): Promise<string | undefined> {
    try {
      return await this.delegate.get(key);
    } catch {
      return undefined;
    }
  }
  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    try {
      await this.delegate.set(key, value, ttlSeconds);
    } catch {
      /* Cache failure cannot affect correctness. */
    }
  }
  async delete(key: string): Promise<void> {
    try {
      await this.delegate.delete(key);
    } catch {
      /* Cache failure cannot affect correctness. */
    }
  }
}
