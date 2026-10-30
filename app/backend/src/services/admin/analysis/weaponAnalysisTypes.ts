/**
 * Response shape of `GET /api/admin/analysis/weapons` (admin Weapons page).
 * Effects are in percentage points of win chance at even odds, against an
 * equally strong opponent (same points invested, same stance).
 */
import type { AnalysisColumn, AnalysisStrength, ArchetypeKey, Loadout, MatchupView, RangeBand, UsageTier } from './analysisOptions';
import type { AnalysisSkipCounts, AnalysisWindow, AttributeAnalysisCollecting, EffectEstimate } from './analysisTypes';
import type { RefinementTier } from './attributeLayers';

/** One weapon or archetype in one mode column. */
export interface ChoiceResult {
  /** Robots that fought with it (once per robot and battle). */
  robots: number;
  /** Share of all robots that fought / of human players' robots (null without any). */
  share: number;
  playersShare: number | null;
  /** Comparisons where only one side had it, and how often that side won. */
  comparisons: number;
  rawWinRate: number | null;
  /** Against the average robot of the column (usage-weighted), equally strong. Null below the minimum. */
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
  /** Row's win chance against the column at equal strength (0–1); null on the diagonal or below the minimum. */
  winRate: number | null;
  /** Standard error in percentage points. */
  se: number | null;
  significant: boolean;
  comparisons: number;
}

export interface MatchupGrid {
  /** Range bands, loadouts or archetype keys, in row/column order. */
  labels: string[];
  /** cells[row][column]. */
  cells: MatchupCell[][];
}

/** Single-robot comparisons only (1v1 and Free-for-all placement pairs); null for team modes. */
export interface ColumnMatchups {
  comparisons: number;
  views: Record<MatchupView, MatchupGrid>;
}

export interface TierUsageRow {
  tier: UsageTier;
  robots: number;
  playersShare: number | null;
  /** One share per segment, then "Other" last. */
  shares: number[];
}

export interface TierUsage {
  /** Archetype keys shown as segments (most used in some tier first). */
  segments: ArchetypeKey[];
  rows: TierUsageRow[];
}

export interface RefinementSummary {
  robots: number;
  /** Share of robots that fought with at least one refinement on either weapon. */
  refinedShare: number;
  tierShares: Record<RefinementTier, number>;
  /** Comparisons where the sides differ in refined robots. */
  comparisons: number;
  /** Having refined weapons vs not, at equal strength; null below the minimum. */
  effect: EffectEstimate;
}

export interface CoverageSummary {
  catalogue: number;
  /** Catalogue weapons at least one robot / one human player's robot fought with. */
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
  /** Points invested from which a robot counts as top 10% (mode columns only, with strength top10). */
  strengthCut: number | null;
  /** Win-chance change for 10% more points invested than the opponent. */
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
  /** Catalogue weapons no human player owns right now. */
  notOwnedByPlayers: Array<{ weaponId: number; name: string }>;
  skipped: AnalysisSkipCounts;
  generatedAt: string;
  computeMs: number;
}

export type WeaponAnalysisResponse = AttributeAnalysisCollecting | WeaponAnalysisReady;
