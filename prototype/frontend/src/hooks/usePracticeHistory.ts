/**
 * usePracticeHistory hook
 * Manages practice battle result history in localStorage.
 * Results are keyed per player and capped at 10 most recent entries.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.7, 8.8
 */

import { useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Summary of a combat result — excludes the full events array */
export interface CombatResultSummary {
  winnerId: number | null;
  robot1FinalHP: number;
  robot2FinalHP: number;
  robot1FinalShield: number;
  robot2FinalShield: number;
  robot1Damage: number;
  robot2Damage: number;
  robot1DamageDealt: number;
  robot2DamageDealt: number;
  durationSeconds: number;
  isDraw: boolean;
}

export interface PracticeHistoryEntry {
  /** ISO-8601 timestamp of when the result was recorded */
  timestamp: string;
  /** Combat result summary (no events array) */
  combatResult: CombatResultSummary;
  /** Robot 1 info */
  robot1: { name: string; maxHP: number; maxShield: number };
  /** Robot 2 info */
  robot2: { name: string; maxHP: number; maxShield: number };
}

export interface UsePracticeHistoryReturn {
  results: PracticeHistoryEntry[];
  addResult: (entry: PracticeHistoryEntry) => void;
  clearHistory: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = (userId: number): string => `practice-arena-history-${userId}`;
const MAX_RESULTS = 10;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePracticeHistory(userId: number): UsePracticeHistoryReturn {
  const [results, setResults] = useState<PracticeHistoryEntry[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY(userId));
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed as PracticeHistoryEntry[];
        }
      }
    } catch {
      // Corrupted data — start fresh
    }
    return [];
  });

  // Re-read from localStorage when userId changes
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY(userId));
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setResults(parsed as PracticeHistoryEntry[]);
          return;
        }
      }
    } catch {
      // Corrupted data — start fresh
    }
    setResults([]);
  }, [userId]);

  const addResult = useCallback(
    (entry: PracticeHistoryEntry): void => {
      setResults((prev) => {
        const updated = [...prev, entry].slice(-MAX_RESULTS);
        localStorage.setItem(STORAGE_KEY(userId), JSON.stringify(updated));
        return updated;
      });
    },
    [userId],
  );

  const clearHistory = useCallback((): void => {
    localStorage.removeItem(STORAGE_KEY(userId));
    setResults([]);
  }, [userId]);

  return { results, addResult, clearHistory };
}
