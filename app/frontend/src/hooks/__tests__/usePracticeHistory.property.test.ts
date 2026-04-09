/**
 * Property-based tests for usePracticeHistory hook
 *
 * Feature: practice-arena
 * Property 10: localStorage round trip
 * Property 11: Max capacity invariant
 *
 * Uses fast-check with minimum 100 iterations per property.
 *
 * Requirements: 8.1, 8.2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import fc from 'fast-check';
import { usePracticeHistory, type PracticeHistoryEntry } from '../usePracticeHistory';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const combatResultArb = fc.record({
  winnerId: fc.oneof(fc.integer({ min: -2, max: 1000 }), fc.constant(null)),
  robot1FinalHP: fc.integer({ min: 0, max: 10000 }),
  robot2FinalHP: fc.integer({ min: 0, max: 10000 }),
  robot1FinalShield: fc.integer({ min: 0, max: 10000 }),
  robot2FinalShield: fc.integer({ min: 0, max: 10000 }),
  robot1Damage: fc.integer({ min: 0, max: 100000 }),
  robot2Damage: fc.integer({ min: 0, max: 100000 }),
  robot1DamageDealt: fc.integer({ min: 0, max: 100000 }),
  robot2DamageDealt: fc.integer({ min: 0, max: 100000 }),
  durationSeconds: fc.integer({ min: 1, max: 3600 }),
  isDraw: fc.boolean(),
});

const robotInfoArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  maxHP: fc.integer({ min: 1, max: 10000 }),
  maxShield: fc.integer({ min: 0, max: 10000 }),
});

const practiceHistoryEntryArb: fc.Arbitrary<PracticeHistoryEntry> = fc.record({
  timestamp: fc.integer({ min: 1577836800000, max: 1924905600000 }).map(ms => new Date(ms).toISOString()),
  combatResult: combatResultArb,
  robot1: robotInfoArb,
  robot2: robotInfoArb,
});

const userIdArb = fc.integer({ min: 1, max: 100000 });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('usePracticeHistory property tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Feature: practice-arena, Property 10: localStorage round trip
   *
   * For any random practice result, store then retrieve produces equivalent object.
   *
   * **Validates: Requirements 8.1**
   */
  it('Property 10: localStorage round trip — store then retrieve produces equivalent object', () => {
    fc.assert(
      fc.property(
        userIdArb,
        practiceHistoryEntryArb,
        (userId, entry) => {
          // Reset localStorage mock for each iteration
          const storage: Record<string, string> = {};
          (localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation(
            (key: string) => storage[key] ?? null,
          );
          (localStorage.setItem as ReturnType<typeof vi.fn>).mockImplementation(
            (key: string, value: string) => { storage[key] = value; },
          );
          (localStorage.removeItem as ReturnType<typeof vi.fn>).mockImplementation(
            (key: string) => { delete storage[key]; },
          );

          // Store the entry
          const { result, unmount } = renderHook(() => usePracticeHistory(userId));
          act(() => {
            result.current.addResult(entry);
          });
          unmount();

          // Retrieve the entry in a new hook instance
          const { result: result2, unmount: unmount2 } = renderHook(() => usePracticeHistory(userId));
          const retrieved = result2.current.results;

          expect(retrieved).toHaveLength(1);

          // JSON round-trip comparison (handles Date serialization)
          const stored = JSON.parse(JSON.stringify(entry));
          const actual = JSON.parse(JSON.stringify(retrieved[0]));
          expect(actual).toEqual(stored);

          unmount2();
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Feature: practice-arena, Property 11: Max capacity invariant
   *
   * For any sequence of N > 10 results, stored history contains exactly 10 most recent.
   *
   * **Validates: Requirements 8.2**
   */
  it('Property 11: Max capacity invariant — history never exceeds 10 entries', () => {
    fc.assert(
      fc.property(
        userIdArb,
        fc.array(practiceHistoryEntryArb, { minLength: 11, maxLength: 30 }),
        (userId, entries) => {
          // Reset localStorage mock for each iteration
          const storage: Record<string, string> = {};
          (localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation(
            (key: string) => storage[key] ?? null,
          );
          (localStorage.setItem as ReturnType<typeof vi.fn>).mockImplementation(
            (key: string, value: string) => { storage[key] = value; },
          );
          (localStorage.removeItem as ReturnType<typeof vi.fn>).mockImplementation(
            (key: string) => { delete storage[key]; },
          );

          const { result, unmount } = renderHook(() => usePracticeHistory(userId));

          // Add all entries
          for (const entry of entries) {
            act(() => {
              result.current.addResult(entry);
            });
          }

          // Should have exactly 10 results
          expect(result.current.results).toHaveLength(10);

          // Should be the 10 most recently added entries
          const expected = entries.slice(-10);
          const actual = result.current.results;

          for (let i = 0; i < 10; i++) {
            expect(JSON.parse(JSON.stringify(actual[i]))).toEqual(
              JSON.parse(JSON.stringify(expected[i])),
            );
          }

          unmount();
        },
      ),
      { numRuns: 100 },
    );
  });
});
