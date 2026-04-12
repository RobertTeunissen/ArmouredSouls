/**
 * Unit tests for PendingUploadCache
 * Validates: Requirements 1.6, 1.7
 *
 * Uses jest.useFakeTimers() to control Date.now() and setInterval for TTL testing.
 * Uses jest.isolateModules() to get fresh cache instances without the module-level
 * singleton calling startCleanup() on import.
 */

import type { PendingUploadEntry } from '../pendingUploadCache';

// Helper: create a PendingUploadEntry with sensible defaults
function makeEntry(overrides: Partial<PendingUploadEntry> = {}): PendingUploadEntry {
  return {
    processedBuffer: Buffer.from('test-image-data'),
    userId: 1,
    robotId: 100,
    originalFileSize: 1024,
    originalDimensions: { width: 800, height: 600 },
    acknowledgedRobotLikeness: false,
    createdAt: Date.now(),
    ...overrides,
  };
}

let cache: any;

beforeEach(() => {
  jest.useFakeTimers();

  jest.isolateModules(() => {
    jest.doMock('../../../config/logger', () => ({
      __esModule: true,
      default: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      },
    }));

    // Import the class fresh — the module-level singleton calls startCleanup(),
    // but with fake timers the interval won't fire until we advance time.
    const mod = require('../pendingUploadCache');
    cache = mod.pendingUploadCache;
  });
});

afterEach(() => {
  cache.stopCleanup();
  jest.useRealTimers();
});

describe('PendingUploadCache', () => {
  describe('store and retrieve', () => {
    it('should store and retrieve an entry within TTL', () => {
      const entry = makeEntry();
      cache.store('token-1', entry);

      const retrieved = cache.retrieve('token-1');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.userId).toBe(entry.userId);
      expect(retrieved!.robotId).toBe(entry.robotId);
      expect(retrieved!.processedBuffer).toEqual(entry.processedBuffer);
    });

    it('should return null for a non-existent token', () => {
      expect(cache.retrieve('nonexistent')).toBeNull();
    });
  });

  describe('TTL expiry', () => {
    it('should return null when retrieving after 5-minute TTL expiry', () => {
      const entry = makeEntry({ createdAt: Date.now() });
      cache.store('token-ttl', entry);

      // Advance time past the 5-minute TTL (300,001 ms)
      jest.advanceTimersByTime(300_001);

      const retrieved = cache.retrieve('token-ttl');
      expect(retrieved).toBeNull();
    });

    it('should return the entry when retrieving just before TTL expiry', () => {
      const entry = makeEntry({ createdAt: Date.now() });
      cache.store('token-before-ttl', entry);

      // Advance time to just under 5 minutes (299,999 ms)
      jest.advanceTimersByTime(299_999);

      const retrieved = cache.retrieve('token-before-ttl');
      expect(retrieved).not.toBeNull();
    });
  });

  describe('delete', () => {
    it('should remove an entry from the cache', () => {
      const entry = makeEntry();
      cache.store('token-del', entry);

      cache.delete('token-del');

      expect(cache.retrieve('token-del')).toBeNull();
      expect(cache.size).toBe(0);
    });

    it('should not throw when deleting a non-existent token', () => {
      expect(() => cache.delete('nonexistent')).not.toThrow();
    });
  });

  describe('per-user limit (max 3 pending)', () => {
    it('should evict the oldest entry when a 4th entry is stored for the same user', () => {
      const userId = 5;
      const now = Date.now();

      cache.store('oldest', makeEntry({ userId, createdAt: now }));
      jest.advanceTimersByTime(1);
      cache.store('middle', makeEntry({ userId, createdAt: Date.now() }));
      jest.advanceTimersByTime(1);
      cache.store('newest', makeEntry({ userId, createdAt: Date.now() }));

      expect(cache.size).toBe(3);

      // Store a 4th — should evict 'oldest'
      jest.advanceTimersByTime(1);
      cache.store('fourth', makeEntry({ userId, createdAt: Date.now() }));

      expect(cache.size).toBe(3);
      expect(cache.retrieve('oldest')).toBeNull();
      expect(cache.retrieve('middle')).not.toBeNull();
      expect(cache.retrieve('newest')).not.toBeNull();
      expect(cache.retrieve('fourth')).not.toBeNull();
    });

    it('should not evict entries from a different user', () => {
      const now = Date.now();

      // User 1 has 3 entries
      cache.store('u1-a', makeEntry({ userId: 1, createdAt: now }));
      jest.advanceTimersByTime(1);
      cache.store('u1-b', makeEntry({ userId: 1, createdAt: Date.now() }));
      jest.advanceTimersByTime(1);
      cache.store('u1-c', makeEntry({ userId: 1, createdAt: Date.now() }));

      // User 2 stores an entry — should not affect user 1
      jest.advanceTimersByTime(1);
      cache.store('u2-a', makeEntry({ userId: 2, createdAt: Date.now() }));

      expect(cache.size).toBe(4);
      expect(cache.retrieve('u1-a')).not.toBeNull();
      expect(cache.retrieve('u1-b')).not.toBeNull();
      expect(cache.retrieve('u1-c')).not.toBeNull();
      expect(cache.retrieve('u2-a')).not.toBeNull();
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries when cleanup runs', () => {
      const now = Date.now();

      // Store two entries: one that will expire, one that won't
      cache.store('will-expire', makeEntry({ userId: 1, createdAt: now }));
      jest.advanceTimersByTime(200_000); // 200s later
      cache.store('still-fresh', makeEntry({ userId: 2, createdAt: Date.now() }));

      // Advance past the first entry's TTL but not the second's
      jest.advanceTimersByTime(100_001); // total: 300,001ms from first entry

      cache.cleanup();

      expect(cache.retrieve('will-expire')).toBeNull();
      expect(cache.retrieve('still-fresh')).not.toBeNull();
      expect(cache.size).toBe(1);
    });

    it('should run automatically via the cleanup interval (every 60s)', () => {
      const now = Date.now();
      cache.store('auto-expire', makeEntry({ userId: 1, createdAt: now }));

      // Advance past TTL + one cleanup interval
      jest.advanceTimersByTime(360_001); // 6 minutes — well past TTL and multiple cleanup cycles

      // The interval-based cleanup should have removed the expired entry
      expect(cache.size).toBe(0);
    });
  });
});
