/**
 * Response shape of `GET /api/admin/analysis/attributes` (admin Attributes page).
 * Effects are in percentage points of win chance at even odds.
 */
import type { AnalysisColumn, AnalysisRange, AttributeGroup, LayerKey, LayerToggles } from './analysisOptions';

export interface EffectEstimate {
  /** Null when the column has too few comparisons or the model could not be fitted. */
  effect: number | null;
  se: number | null;
  /** |effect| ≥ 2 SE and the column has enough comparisons. */
  significant: boolean;
}

export type EffectsByColumn = Record<AnalysisColumn, EffectEstimate>;

export interface AnalysisColumnSummary {
  column: AnalysisColumn;
  battles: number;
  comparisons: number;
  /** At least `MIN_COMPARISONS`; cells of a column below it are not shown. */
  enough: boolean;
  /** Win-chance change for 10% more total points than the opponent. */
  investmentEffect: EffectEstimate;
  /**
   * Win-chance change for fighting offensive / defensive instead of balanced, at the
   * same attributes. Null when the stance toggle is off. Stance is its own effect:
   * combat applies it in its formulas, never to attribute values.
   */
  stanceEffects: { offensive: EffectEstimate; defensive: EffectEstimate } | null;
}

export interface AttributeEffectRow {
  attribute: string;
  group: AttributeGroup;
  /** Moving 5 share points into this attribute, taken evenly from the other 22. */
  effects: EffectsByColumn;
  /** Average share of this attribute over every robot that fought. */
  avgShare: number;
  /** The same over human players' robots; null without any. */
  playersAvgShare: number | null;
}

export interface GroupEffectRow {
  group: AttributeGroup;
  /** Moving 5 share points into this group, taken evenly from the other four. */
  effects: EffectsByColumn;
}

export interface GroupPairRow {
  groups: [AttributeGroup, AttributeGroup];
  /** Extra win chance when both groups are 10 share points above average, beyond their separate effects. */
  effects: EffectsByColumn;
}

export interface ProfileResult {
  winRate: number | null;
  comparisons: number;
}

export interface BuildProfileRow {
  /** 'balanced', a group ('combat') or a pair ('combat+defence'). */
  profile: string;
  groups: AttributeGroup[];
  /** Win rate against a different profile at comparable investment (totals within ~10%). */
  results: Record<AnalysisColumn, ProfileResult>;
  /** Share of all robots that fought / of human players' robots. */
  shareAll: number;
  sharePlayers: number | null;
}

export type LayerStep = 'base' | LayerKey;

export interface LayerFitRow {
  /** Cumulative: base, then + each layer in combat order. */
  layer: LayerStep;
  /** Weighted log-loss on held-out battles (coin flip = 0.693). */
  logLoss: number;
  /** Share of held-out comparisons whose winner the model picked. */
  accuracy: number;
}

export interface LayerFitSummary {
  trainComparisons: number;
  testComparisons: number;
  rows: LayerFitRow[];
}

export interface AnalysisSkipCounts {
  draws: number;
  tiedPlacements: number;
  forfeits: number;
  missingBuilds: number;
}

export interface AnalysisWindow {
  range: AnalysisRange;
  /** Start of the analysed window (never before recording started); null = whole season. */
  from: string | null;
  to: string;
  battlesInRange: number;
  battlesUsed: number;
  sampled: boolean;
}

export interface AttributeAnalysisCollecting {
  status: 'collecting';
  /** First battle-time build record; null when recording has not started. */
  recordingSince: string | null;
  availableFrom: string | null;
  battlesRecorded: number;
}

export interface AttributeAnalysisReady {
  status: 'ready';
  recordingSince: string;
  window: AnalysisWindow;
  toggles: LayerToggles;
  columns: AnalysisColumnSummary[];
  attributes: AttributeEffectRow[];
  groups: GroupEffectRow[];
  groupPairs: GroupPairRow[];
  profiles: BuildProfileRow[];
  layerFit: LayerFitSummary | null;
  skipped: AnalysisSkipCounts;
  robots: { all: number; human: number };
  generatedAt: string;
  computeMs: number;
}

export type AttributeAnalysisResponse = AttributeAnalysisCollecting | AttributeAnalysisReady;
