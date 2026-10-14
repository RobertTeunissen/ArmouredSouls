/**
 * Highest current tier of an Automaton stable, from its `standings` rows
 * (admin Automatons page: Stables list "Highest tier (any mode)" and the
 * Strategy_Comparison "Highest current tier").
 *
 * Only played rows count: every robot gets a default Bronze `league_1v1` and
 * `koth` row at creation (and placement subscriptions create Bronze `koth` /
 * `grand_melee` rows), so an unplayed row says nothing about the stable.
 * A bye is a recorded league result and counts as played. Tournament modes
 * have no tier and are ignored.
 *
 * Shared by the backend (selection, SQL mirror in `standingsTier.ts`) and the
 * admin frontend (sorting), so both order tiers the same way.
 */

/** Tier order, lowest first. */
export const LEAGUE_TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'] as const;
export type StandingsTier = (typeof LEAGUE_TIER_ORDER)[number];

/** Modes that carry a tier, in display order (also `highestTierOf`'s last tie-break between modes). */
export const TIERED_STANDINGS_MODES = ['league_1v1', 'league_2v2', 'league_3v3', 'tag_team', 'koth', 'grand_melee'] as const;
export type TieredStandingsMode = (typeof TIERED_STANDINGS_MODES)[number];

/** Placement modes: every match increments `totalMatches`, 1st place increments `wins`; losses/draws are never written. */
export const PLACEMENT_STANDINGS_MODES: readonly TieredStandingsMode[] = ['koth', 'grand_melee'];

/** Modes whose standings rows belong to teams (`entityType = team`). */
export const TEAM_STANDINGS_MODES: readonly TieredStandingsMode[] = ['league_2v2', 'league_3v3', 'tag_team'];

/** A per-mode figure is a low sample below this many stables… */
export const LOW_SAMPLE_MIN_STABLES = 5;
/** …or below this many matches. */
export const LOW_SAMPLE_MIN_MATCHES = 20;

/** The standings columns the played rule and tier selection read. */
export interface StandingPlayInput {
  mode: string;
  tier: string;
  wins: number;
  losses: number;
  draws: number;
  totalMatches: number | null;
}

export interface HighestTier {
  tier: StandingsTier;
  mode: TieredStandingsMode;
}

/** Index in `LEAGUE_TIER_ORDER`; -1 for an unknown tier string. */
export function tierRank(tier: string): number {
  return (LEAGUE_TIER_ORDER as readonly string[]).indexOf(tier);
}

export function isTieredMode(mode: string): mode is TieredStandingsMode {
  return (TIERED_STANDINGS_MODES as readonly string[]).includes(mode);
}

export function isPlacementMode(mode: string): boolean {
  return (PLACEMENT_STANDINGS_MODES as readonly string[]).includes(mode);
}

/** Matches played: `totalMatches` for placement modes, W + L + D otherwise. */
export function matchesPlayed(row: StandingPlayInput): number {
  return isPlacementMode(row.mode) ? row.totalMatches ?? 0 : row.wins + row.losses + row.draws;
}

/** A row is played when it records any result (W + L + D > 0) or any placement match. */
export function isPlayedStanding(row: StandingPlayInput): boolean {
  return row.wins + row.losses + row.draws > 0 || (row.totalMatches ?? 0) > 0;
}

/**
 * The highest tier over played, tiered rows, with its mode. When several modes
 * hold that tier, the mode with the most matches at that tier wins; then the
 * `TIERED_STANDINGS_MODES` order. Null when no row qualifies.
 */
export function highestTierOf(rows: readonly StandingPlayInput[]): HighestTier | null {
  const eligible = rows.filter((row) => isTieredMode(row.mode) && tierRank(row.tier) >= 0 && isPlayedStanding(row));
  if (eligible.length === 0) return null;
  const topRank = Math.max(...eligible.map((row) => tierRank(row.tier)));
  const matchesByMode = new Map<TieredStandingsMode, number>();
  for (const row of eligible) {
    if (tierRank(row.tier) !== topRank || !isTieredMode(row.mode)) continue;
    matchesByMode.set(row.mode, (matchesByMode.get(row.mode) ?? 0) + matchesPlayed(row));
  }
  let best: TieredStandingsMode | null = null;
  let bestMatches = -1;
  for (const mode of TIERED_STANDINGS_MODES) {
    const matches = matchesByMode.get(mode);
    if (matches !== undefined && matches > bestMatches) {
      best = mode;
      bestMatches = matches;
    }
  }
  return best === null ? null : { tier: LEAGUE_TIER_ORDER[topRank], mode: best };
}

/**
 * Ascending order by tier rank only. Equal tiers compare 0 whatever their
 * mode, so callers break ties themselves: the admin Stables sort falls back
 * to the catalogue key, ascending in both directions (PRD_ADMIN_PAGE "ties by
 * catalogue key"). The mode only decides which tier `highestTierOf` reports.
 */
export function compareHighestTier(a: HighestTier, b: HighestTier): number {
  return tierRank(a.tier) - tierRank(b.tier);
}

/** Low sample: fewer than 5 stables or fewer than 20 matches. */
export function isLowSample(stablesPlayed: number, matches: number): boolean {
  return stablesPlayed < LOW_SAMPLE_MIN_STABLES || matches < LOW_SAMPLE_MIN_MATCHES;
}
