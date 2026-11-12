/**
 * Filters of the admin Battles page. The response shapes of `/api/admin/battles*`
 * are wire contracts in `@shared/types` (admin-battles.ts).
 */
import type { StableType } from '@shared/types';

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

export type BattleModeFilter = BattleMode | 'all';
export type BattleStableFilter = 'all' | StableType;
export type BattleOutcomeFilter = 'all' | 'draw' | 'bye' | 'forfeit' | 'time_limit';
export type BattleRangeFilter = '24h' | '7d' | '30d' | 'season';

export interface BattleFilters {
  mode: BattleModeFilter;
  stable: BattleStableFilter;
  outcome: BattleOutcomeFilter;
  range: BattleRangeFilter;
  q: string;
  page: number;
}

