/**
 * Types of the admin Attributes page. Mirror of the backend response
 * (`app/backend/src/services/admin/analysis/analysisTypes.ts`). Effects are in
 * percentage points of win chance at even odds.
 */

export const ANALYSIS_RANGES = ['7d', '14d', '30d', 'season'] as const;
export type AnalysisRange = (typeof ANALYSIS_RANGES)[number];

export const ANALYSIS_COLUMNS = ['all', 'duel', 'team', 'multi'] as const;
export type AnalysisColumn = (typeof ANALYSIS_COLUMNS)[number];

export const LAYER_KEYS = ['tuning', 'weapons', 'refinements', 'loadout', 'stance'] as const;
export type LayerKey = (typeof LAYER_KEYS)[number];
export type LayerToggles = Record<LayerKey, boolean>;

export const ATTRIBUTE_GROUPS = ['combat', 'defence', 'chassis', 'ai', 'team'] as const;
export type AttributeGroup = (typeof ATTRIBUTE_GROUPS)[number];

export interface AttributeFilters {
  range: AnalysisRange;
  toggles: LayerToggles;
  /** Column used for sorting and the biggest-effects list. */
  column: AnalysisColumn;
}

export interface EffectEstimate {
  effect: number | null;
  se: number | null;
  significant: boolean;
}

export type EffectsByColumn = Record<AnalysisColumn, EffectEstimate>;

export interface AnalysisColumnSummary {
  column: AnalysisColumn;
  battles: number;
  comparisons: number;
  enough: boolean;
  investmentEffect: EffectEstimate;
}

export interface AttributeEffectRow {
  attribute: string;
  group: AttributeGroup;
  effects: EffectsByColumn;
  avgShare: number;
  playersAvgShare: number | null;
}

export interface GroupEffectRow {
  group: AttributeGroup;
  effects: EffectsByColumn;
}

export interface GroupPairRow {
  groups: [AttributeGroup, AttributeGroup];
  effects: EffectsByColumn;
}

export interface ProfileResult {
  winRate: number | null;
  comparisons: number;
}

export interface BuildProfileRow {
  profile: string;
  groups: AttributeGroup[];
  results: Record<AnalysisColumn, ProfileResult>;
  shareAll: number;
  sharePlayers: number | null;
}

export type LayerStep = 'base' | LayerKey;

export interface LayerFitRow {
  layer: LayerStep;
  logLoss: number;
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
  from: string | null;
  to: string;
  battlesInRange: number;
  battlesUsed: number;
  sampled: boolean;
}

export interface AttributeAnalysisCollecting {
  status: 'collecting';
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
