import { CacheService, CACHE_TTL } from './cache.service';

describe('CacheService', () => {
  let cache: CacheService;

  beforeEach(() => {
    cache = new CacheService();
  });

  it('returns stored value within TTL', () => {
    cache.set('k1', { ok: true }, 1_000);
    expect(cache.get<{ ok: boolean }>('k1')).toEqual({ ok: true });
  });

  it('returns undefined for missing key', () => {
    expect(cache.get('missing')).toBeUndefined();
  });

  it('returns undefined for expired entries', async () => {
    cache.set('k2', 'value', 1);
    await new Promise((r) => setTimeout(r, 10));
    expect(cache.get<string>('k2')).toBeUndefined();
  });

  it('size reflects live entries', () => {
    cache.set('a', 1, 1_000);
    cache.set('b', 2, 1_000);
    expect(cache.size).toBe(2);
    cache.delete('a');
    expect(cache.size).toBe(1);
  });

  it('clear removes all entries', () => {
    cache.set('x', 1, 1_000);
    cache.set('y', 2, 1_000);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('CACHE_TTL constants are positive integers', () => {
    expect(CACHE_TTL.SEARCH).toBeGreaterThan(0);
    expect(CACHE_TTL.CATEGORY).toBeGreaterThan(CACHE_TTL.SEARCH);
    expect(CACHE_TTL.PRODUCT).toBeGreaterThan(CACHE_TTL.CATEGORY);
  });
});
