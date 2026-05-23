import { Injectable } from '@nestjs/common';

type CacheEntry<T> = {
  value: T;
  expiresAtMs: number;
};

/** TTL constants (milliseconds) */
export const CACHE_TTL = {
  SEARCH: 15 * 60 * 1_000, // 15 minutes
  CATEGORY: 30 * 60 * 1_000, // 30 minutes
  PRODUCT: 60 * 60 * 1_000, // 60 minutes
} as const;

@Injectable()
export class CacheService {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAtMs) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAtMs: Date.now() + ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}
