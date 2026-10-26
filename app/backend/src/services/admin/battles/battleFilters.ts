/**
 * Accepted values for the admin Battles list filters. Dependency-free so route
 * schemas (and route tests that mock the services) can import them.
 */

/** The nine `battles.battle_type` values. */
export const BATTLE_MODES = [
  'league_1v1',
  'league_2v2',
  'league_3v3',
  'tag_team',
  'tournament_1v1',
  'tournament_2v2',
  'tournament_3v3',
  'koth',
  'grand_melee',
] as const;

export type BattleMode = (typeof BATTLE_MODES)[number];

/** Battles with at least one robot from a stable of this `users.stable_type`. */
export const BATTLE_STABLE_FILTERS = ['all', 'human', 'generated', 'automaton'] as const;
export type BattleStableFilter = (typeof BATTLE_STABLE_FILTERS)[number];

export const BATTLE_OUTCOME_FILTERS = ['all', 'draw', 'bye', 'forfeit', 'time_limit'] as const;
export type BattleOutcomeFilter = (typeof BATTLE_OUTCOME_FILTERS)[number];

export const BATTLE_RANGE_FILTERS = ['24h', '7d', '30d', 'season'] as const;
export type BattleRangeFilter = (typeof BATTLE_RANGE_FILTERS)[number];
