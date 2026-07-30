/**
 * Factory for creating valid Standing objects for testing.
 *
 * Types come from the generated Prisma client rather than a local copy. The
 * local copy drifted: it was missing `grand_melee` (added by Spec #44), so any
 * test passing a real `StandingsMode` into this factory failed to compile, and
 * it still declared `totalKills`, which moved to `robot_mode_kills`.
 */

import type { Standing, StandingsMode } from '../../generated/prisma';
import { StandingsMode as StandingsModeEnum } from '../../generated/prisma';

export type { Standing, StandingsMode };

let standingIdCounter = 1000;

const STANDINGS_MODES: StandingsMode[] = Object.values(StandingsModeEnum);

const TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'] as const;

/**
 * Placement modes accumulate match, zone and placement stats; the league and
 * tournament modes leave those columns null.
 */
function getDefaultPlacementFields(mode: StandingsMode): Pick<
  Standing,
  'totalMatches' | 'totalZoneScore' | 'totalZoneTime' | 'bestPlacement'
> {
  if (mode === 'koth' || mode === 'grand_melee') {
    return {
      totalMatches: 0,
      totalZoneScore: 0,
      totalZoneTime: 0,
      bestPlacement: null,
    };
  }
  return {
    totalMatches: null,
    totalZoneScore: null,
    totalZoneTime: null,
    bestPlacement: null,
  };
}

/**
 * Creates a valid Standing object with sensible defaults.
 * All counters start at 0, tier defaults to bronze.
 */
export function createStanding(overrides?: Partial<Standing>): Standing {
  const id = overrides?.id ?? ++standingIdCounter;
  const mode = overrides?.mode ?? 'league_1v1';

  const base: Standing = {
    id,
    entityType: 'robot',
    entityId: id + 5000,
    mode,
    tier: 'bronze',
    leagueInstanceId: 'bronze_1',
    leaguePoints: 0,
    cyclesInTier: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    currentWinStreak: 0,
    bestWinStreak: 0,
    currentLoseStreak: 0,
    ...getDefaultPlacementFields(mode),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return { ...base, ...overrides };
}

/**
 * Creates a Standing pre-configured for a specific mode.
 * Placement modes get their nullable fields populated with zeros.
 */
export function createStandingForMode(
  mode: StandingsMode,
  overrides?: Partial<Standing>
): Standing {
  return createStanding({ mode, ...overrides });
}

export { STANDINGS_MODES, TIERS };
