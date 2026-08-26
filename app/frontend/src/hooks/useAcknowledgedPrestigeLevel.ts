/**
 * Tracks the highest facility level a player has acknowledged unlocking.
 *
 * Extracted from DashboardPage.tsx, where the same value was read from
 * `localStorage` inline during render on every pass and written by a one-off
 * stateful wrapper component. Owning both sides here means the notification
 * builder can stay pure and dismissal is an ordinary state update.
 *
 * Defaults to 3: facility levels 1–3 carry no prestige gate, so there is never
 * anything to announce below L4.
 */
import { useCallback, useEffect, useState } from 'react';

const DEFAULT_LEVEL = 3;

function storageKeyFor(userId: number | undefined): string | null {
  return userId === undefined ? null : `prestige_gate_seen_${userId}`;
}

function read(userId: number | undefined): number {
  const key = storageKeyFor(userId);
  if (!key) return DEFAULT_LEVEL;
  // Number('') is 0, so fall back before converting rather than after.
  return Number(localStorage.getItem(key) || String(DEFAULT_LEVEL));
}

export interface AcknowledgedPrestigeLevel {
  acknowledgedLevel: number;
  /** Persist `level` as seen and hide the notification. */
  acknowledge: (level: number) => void;
}

export function useAcknowledgedPrestigeLevel(userId: number | undefined): AcknowledgedPrestigeLevel {
  const [acknowledgedLevel, setAcknowledgedLevel] = useState(() => read(userId));

  // Re-read when the account changes, so a second login in the same tab does not
  // inherit the previous player's acknowledgement.
  useEffect(() => {
    setAcknowledgedLevel(read(userId));
  }, [userId]);

  const acknowledge = useCallback(
    (level: number) => {
      const key = storageKeyFor(userId);
      if (key) localStorage.setItem(key, String(level));
      setAcknowledgedLevel(level);
    },
    [userId],
  );

  return { acknowledgedLevel, acknowledge };
}
