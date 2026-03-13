/**
 * In-Memory Cache with TTL
 * Used to cache Figma API responses and parsed data
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class Cache {
  private store: Map<string, CacheEntry<unknown>> = new Map();
  private defaultTTL: number;

  constructor(defaultTTLMs: number = 5 * 60 * 1000) {
    this.defaultTTL = defaultTTLMs;
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs?: number): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTTL),
    });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  /** Remove all expired entries */
  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  get size(): number {
    this.prune();
    return this.store.size;
  }
}
