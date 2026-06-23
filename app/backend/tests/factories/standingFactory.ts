/**
 * Factory for creating valid Standing objects for testing.
 *
 * Supports all 8 StandingsMode values and all 6 tiers.
 * KotH standings include populated KotH-specific fields.
 *
 * Types defined locally to match the Prisma schema from Spec #40.
 * Once `prisma generate` is run after Tasks 1.1–1.5, these can be
 * replaced with imports from '../../generated/prisma'.
 */

export type StandingsMode =
  | 'league_1v1'
  | 'league_2v2'
  | 'league_3v3'
  | 'tag_team'
  | 'koth'
  | 'tournament_1v1'
  | 'tournament_2v2'
  | 'tournament_3v3';

export interface Standing {
  id: number;
  entityType: string;
  entityId: number;
  mode: StandingsMode;
  tier: string;
  leagueInstanceId: string;
  leaguePoints: number;
  cyclesInTier: number;
  wins: number;
  losses: number;
  draws: number;
  currentWinStreak: number;
  bestWinStreak: number;
  currentLoseStreak: number;
  totalMatches: number | null;
  totalKills: number | null;
  totalZoneScore: number | null;
  totalZoneTime: number | null;
  bestPlacement: number | null;
  createdAt: Date;
  updatedAt: Date;
}

let standingIdCounter = 1000;

const STANDINGS_MODES: StandingsMode[] = [
  'league_1v1',
  'league_2v2',
  'league_3v3',
  'tag_team',
  'koth',
  'tournament_1v1',
  'tournament_2v2',
  'tournament_3v3',
];

const TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'] as const;

function getDefaultKothFields(mode: StandingsMode): Pick<
  Standing,
  'totalMatches' | 'totalKills' | 'totalZoneScore' | 'totalZoneTime' | 'bestPlacement'
> {
  if (mode === 'koth') {
    return {
      totalMatches: 0,
      totalKills: 0,
      totalZoneScore: 0,
      totalZoneTime: 0,
      bestPlacement: null,
    };
  }
  return {
    totalMatches: null,
    totalKills: null,
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
    ...getDefaultKothFields(mode),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return { ...base, ...overrides };
}

/**
 * Creates a Standing pre-configured for a specific mode.
 * KotH standings get their nullable fields populated with zeros.
 */
export function createStandingForMode(
  mode: StandingsMode,
  overrides?: Partial<Standing>
): Standing {
  return createStanding({ mode, ...overrides });
}

export { STANDINGS_MODES, TIERS };
