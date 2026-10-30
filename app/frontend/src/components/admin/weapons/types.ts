/**
 * Types of the admin Weapons page. Mirror of the backend response
 * (`app/backend/src/services/admin/analysis/weaponAnalysisTypes.ts`). Effects
 * are in percentage points of win chance at even odds, against an equally
 * strong opponent (same points invested, same stance).
 */
import type {
  AnalysisColumn,
  AnalysisRange,
  AnalysisSkipCounts,
  AnalysisWindow,
  AttributeAnalysisCollecting,
  EffectEstimate,
} from '../attributes/types';

export type { AnalysisColumn, AnalysisRange, EffectEstimate };

export const ANALYSIS_STRENGTHS = ['all', 'top10'] as const;
export type AnalysisStrength = (typeof ANALYSIS_STRENGTHS)[number];

export const RANGE_BANDS = ['melee', 'short', 'mid', 'long'] as const;
export type RangeBand = (typeof RANGE_BANDS)[number];

export const LOADOUTS = ['single', 'weapon_shield', 'two_handed', 'dual_wield'] as const;
export type Loadout = (typeof LOADOUTS)[number];

export type ArchetypeKey = `${RangeBand}+${Loadout}`;

export const MATCHUP_VIEWS = ['bands', 'loadouts', 'archetypes'] as const;
export type MatchupView = (typeof MATCHUP_VIEWS)[number];

export type UsageTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'champion' | 'tournament';
export type RefinementTier = 'hone' | 'augment' | 'sharpen' | 'forge';

export interface WeaponFilters {
  range: AnalysisRange;
  column: AnalysisColumn;
  strength: AnalysisStrength;
  matchups: MatchupView;
}

export interface ChoiceResult {
  robots: number;
  share: number;
  playersShare: number | null;
  comparisons: number;
  rawWinRate: number | null;
  effect: EffectEstimate;
}

export interface WeaponRow {
  weaponId: number;
  name: string;
  weaponType: string;
  handsRequired: string;
  rangeBand: string;
  cost: number;
  results: Record<AnalysisColumn, ChoiceResult>;
}

export interface ArchetypeRow {
  key: ArchetypeKey;
  rangeBand: RangeBand;
  loadout: Loadout;
  results: Record<AnalysisColumn, ChoiceResult>;
}

export interface MatchupCell {
  winRate: number | null;
  se: number | null;
  significant: boolean;
  comparisons: number;
}

export interface MatchupGrid {
  labels: string[];
  cells: MatchupCell[][];
}

export interface ColumnMatchups {
  comparisons: number;
  views: Record<MatchupView, MatchupGrid>;
}

export interface TierUsageRow {
  tier: UsageTier;
  robots: number;
  playersShare: number | null;
  shares: number[];
}

export interface TierUsage {
  segments: ArchetypeKey[];
  rows: TierUsageRow[];
}

export interface RefinementSummary {
  robots: number;
  refinedShare: number;
  tierShares: Record<RefinementTier, number>;
  comparisons: number;
  effect: EffectEstimate;
}

export interface CoverageSummary {
  catalogue: number;
  fought: number;
  foughtByPlayers: number;
}

export interface WeaponColumnSummary {
  column: AnalysisColumn;
  battles: number;
  comparisons: number;
  enough: boolean;
  robots: number;
  humanRobots: number;
  strengthCut: number | null;
  investmentEffect: EffectEstimate;
}

export interface WeaponAnalysisReady {
  status: 'ready';
  recordingSince: string;
  window: AnalysisWindow;
  strength: AnalysisStrength;
  columns: WeaponColumnSummary[];
  weapons: WeaponRow[];
  archetypes: ArchetypeRow[];
  matchups: Record<AnalysisColumn, ColumnMatchups | null>;
  tiers: Record<AnalysisColumn, TierUsage>;
  refinements: Record<AnalysisColumn, RefinementSummary>;
  coverage: Record<AnalysisColumn, CoverageSummary>;
  notOwnedByPlayers: Array<{ weaponId: number; name: string }>;
  skipped: AnalysisSkipCounts;
  generatedAt: string;
  computeMs: number;
}

export type WeaponAnalysisCollecting = AttributeAnalysisCollecting;
export type WeaponAnalysisResponse = WeaponAnalysisCollecting | WeaponAnalysisReady;
