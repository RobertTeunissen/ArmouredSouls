/**
 * Types of the admin Weapons page. The response types are wire contracts in
 * `@shared/types` (admin-analysis.ts); these are the page's filters. Effects
 * are in percentage points of win chance at even odds, against an equally
 * strong opponent (same points invested, same stance).
 */
import type { AnalysisColumn, AnalysisRange, AnalysisStrength, Loadout, MatchupView, RangeBand } from '@shared/types';

export const ANALYSIS_STRENGTHS = ['all', 'top10'] as const satisfies readonly AnalysisStrength[];
export const RANGE_BANDS = ['melee', 'short', 'mid', 'long'] as const satisfies readonly RangeBand[];
export const LOADOUTS = ['single', 'weapon_shield', 'two_handed', 'dual_wield'] as const satisfies readonly Loadout[];
export const MATCHUP_VIEWS = ['bands', 'loadouts', 'archetypes'] as const satisfies readonly MatchupView[];
export interface WeaponFilters {
  range: AnalysisRange;
  column: AnalysisColumn;
  strength: AnalysisStrength;
  matchups: MatchupView;
}

