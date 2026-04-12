/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Property-based tests for PendingUploadCache.
 * Uses fast-check to verify universal properties across generated inputs.
 *
 * Property 12: Pending upload cache TTL eviction
 * For any entry, if confirmation arrives after 5-minute TTL, cache SHALL return null.
 * Within TTL, cache SHALL return the stored buffer.
 *
 * **Validates: Requirements 1.6, 1.7**
 */

import * as fc from 'fast-check';
import type { PendingUploadEntry } from '../pendingUploadCache';

const TTL_MS = 300_000; // 5 minutes — matches the source constant

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

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../pendingUploadCache');
    cache = mod.pendingUploadCache;
  });
});

afterEach(() => {
  cache.stopCleanup();
  jest.useRealTimers();
});

describe('PendingUploadCache Property Tests', () => {
  /**
   * Property 12: Pending upload cache TTL eviction
   * **Validates: Requirements 1.6, 1.7**
   */
  describe('Property 12: Pending upload cache TTL eviction', () => {
    it('should return the entry for any retrieval within the TTL window', () => {
      fc.assert(
        fc.property(
          // Generate offsets within the TTL window: 0 to 299,999 ms
          fc.integer({ min: 0, max: TTL_MS - 1 }),
          fc.integer({ min: 1, max: 10000 }),
          (offsetMs: number, userId: number) => {
            // Reset timers for each run
            jest.setSystemTime(new Date(1_000_000_000_000));

            const entry = makeEntry({ userId, createdAt: Date.now() });
            const token = `token-within-${offsetMs}-${userId}`;
            cache.store(token, entry);

            // Advance time within TTL
            jest.advanceTimersByTime(offsetMs);

            const retrieved = cache.retrieve(token);
            expect(retrieved).not.toBeNull();
            expect(retrieved!.userId).toBe(userId);
            expect(retrieved!.processedBuffer).toEqual(entry.processedBuffer);

            // Cleanup for next iteration
            cache.delete(token);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should return null for any retrieval after the TTL has elapsed', () => {
      fc.assert(
        fc.property(
          // Generate offsets past the TTL: 300,001 to 600,000 ms
          fc.integer({ min: TTL_MS + 1, max: TTL_MS * 2 }),
          fc.integer({ min: 1, max: 10000 }),
          (offsetMs: number, userId: number) => {
            // Reset timers for each run
            jest.setSystemTime(new Date(1_000_000_000_000));

            const entry = makeEntry({ userId, createdAt: Date.now() });
            const token = `token-expired-${offsetMs}-${userId}`;
            cache.store(token, entry);

            // Advance time past TTL
            jest.advanceTimersByTime(offsetMs);

            const retrieved = cache.retrieve(token);
            expect(retrieved).toBeNull();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should return null at exactly TTL+1ms and non-null at exactly TTL-1ms', () => {
      // Boundary test: exactly at TTL boundary
      jest.setSystemTime(new Date(1_000_000_000_000));

      const entryBefore = makeEntry({ createdAt: Date.now() });
      cache.store('boundary-before', entryBefore);

      const entryAfter = makeEntry({ createdAt: Date.now() });
      cache.store('boundary-after', entryAfter);

      // At TTL - 1ms: should still be retrievable
      jest.advanceTimersByTime(TTL_MS - 1);
      expect(cache.retrieve('boundary-before')).not.toBeNull();

      // Advance 2 more ms (total TTL + 1ms): should be expired
      jest.advanceTimersByTime(2);
      expect(cache.retrieve('boundary-after')).toBeNull();
    });
  });
});
