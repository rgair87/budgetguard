import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getCached, setCache, invalidateCache } from './cache';

describe('cache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Clear any leftover entries
    invalidateCache('');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('setCache + getCached', () => {
    it('stores and retrieves data', () => {
      setCache('user:1:profile', { name: 'Alice' }, 60);
      const result = getCached<{ name: string }>('user:1:profile');
      expect(result).toEqual({ name: 'Alice' });
    });
  });

  describe('getCached', () => {
    it('returns null for expired entries', () => {
      setCache('temp-key', 'hello', 10);
      expect(getCached('temp-key')).toBe('hello');

      // Advance time past the 10-second TTL
      vi.advanceTimersByTime(11_000);

      expect(getCached('temp-key')).toBeNull();
    });

    it('returns null for non-existent keys', () => {
      expect(getCached('does-not-exist')).toBeNull();
    });
  });

  describe('invalidateCache', () => {
    it('removes entries matching prefix', () => {
      setCache('user:1:profile', 'p1', 60);
      setCache('user:1:accounts', 'a1', 60);
      setCache('user:2:profile', 'p2', 60);

      invalidateCache('user:1');

      expect(getCached('user:1:profile')).toBeNull();
      expect(getCached('user:1:accounts')).toBeNull();
      // user:2 should still exist
      expect(getCached('user:2:profile')).toBe('p2');
    });

    it('does not affect entries with different prefix', () => {
      setCache('accounts:1', 'acc1', 60);
      setCache('budgets:1', 'bud1', 60);

      invalidateCache('accounts');

      expect(getCached('accounts:1')).toBeNull();
      expect(getCached('budgets:1')).toBe('bud1');
    });
  });
});
