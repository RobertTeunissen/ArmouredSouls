/**
 * usePracticeHistory hook tests
 *
 * Requirements: 8.1, 8.2, 8.3, 8.7, 8.8
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePracticeHistory, type PracticeHistoryEntry } from '../usePracticeHistory';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<PracticeHistoryEntry> = {}): PracticeHistoryEntry {
  return {
    timestamp: new Date().toISOString(),
    combatResult: {
      winnerId: 1,
      robot1FinalHP: 60,
      robot2FinalHP: 0,
      robot1FinalShield: 10,
      robot2FinalShield: 0,
      robot1Damage: 40,
      robot2Damage: 100,
      robot1DamageDealt: 100,
      robot2DamageDealt: 40,
      durationSeconds: 45,
      isDraw: false,
    },
    robot1: { name: 'Iron Fist', maxHP: 100, maxShield: 50 },
    robot2: { name: 'AverageBot', maxHP: 300, maxShield: 200 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('usePracticeHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
  });

  it('stores and retrieves results from localStorage', () => {
    const { result } = renderHook(() => usePracticeHistory(1));

    const entry = makeEntry();
    act(() => {
      result.current.addResult(entry);
    });

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'practice-arena-history-1',
      expect.any(String),
    );

    // Verify the stored data contains the entry
    const storedCall = (localStorage.setItem as ReturnType<typeof vi.fn>).mock.calls.find(
      (call: string[]) => call[0] === 'practice-arena-history-1',
    );
    expect(storedCall).toBeTruthy();
    const stored = JSON.parse(storedCall![1]);
    expect(stored).toHaveLength(1);
    expect(stored[0].robot1.name).toBe('Iron Fist');
  });

  it('caps at 10 results (oldest removed)', () => {
    const { result } = renderHook(() => usePracticeHistory(1));

    // Add 12 entries
    for (let i = 0; i < 12; i++) {
      act(() => {
        result.current.addResult(
          makeEntry({ timestamp: `2026-01-01T00:00:${String(i).padStart(2, '0')}.000Z` }),
        );
      });
    }

    // Should have exactly 10 results
    expect(result.current.results).toHaveLength(10);

    // The oldest two should have been evicted — first entry should be index 2
    expect(result.current.results[0].timestamp).toBe('2026-01-01T00:00:02.000Z');
    expect(result.current.results[9].timestamp).toBe('2026-01-01T00:00:11.000Z');
  });

  it('clears history', () => {
    // Pre-populate with data
    const entries = [makeEntry()];
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'practice-arena-history-1') return JSON.stringify(entries);
      return null;
    });

    const { result } = renderHook(() => usePracticeHistory(1));

    act(() => {
      result.current.clearHistory();
    });

    expect(localStorage.removeItem).toHaveBeenCalledWith('practice-arena-history-1');
    expect(result.current.results).toHaveLength(0);
  });

  it('keys by player ID (different players do not see each other\'s results)', () => {
    // Player 1 has results
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'practice-arena-history-1') {
        return JSON.stringify([makeEntry({ robot1: { name: 'Player1Bot', maxHP: 100, maxShield: 50 } })]);
      }
      if (key === 'practice-arena-history-2') {
        return JSON.stringify([makeEntry({ robot1: { name: 'Player2Bot', maxHP: 100, maxShield: 50 } })]);
      }
      return null;
    });

    const { result: result1 } = renderHook(() => usePracticeHistory(1));
    const { result: result2 } = renderHook(() => usePracticeHistory(2));

    expect(result1.current.results[0].robot1.name).toBe('Player1Bot');
    expect(result2.current.results[0].robot1.name).toBe('Player2Bot');
  });

  it('restores history on mount', () => {
    const entries = [
      makeEntry({ timestamp: '2026-01-01T00:00:00.000Z' }),
      makeEntry({ timestamp: '2026-01-01T00:01:00.000Z' }),
    ];

    (localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'practice-arena-history-42') return JSON.stringify(entries);
      return null;
    });

    const { result } = renderHook(() => usePracticeHistory(42));

    expect(result.current.results).toHaveLength(2);
    expect(result.current.results[0].timestamp).toBe('2026-01-01T00:00:00.000Z');
    expect(result.current.results[1].timestamp).toBe('2026-01-01T00:01:00.000Z');
  });
});
