/**
 * Types of the admin Attributes page. The response types are wire contracts in
 * `@shared/types` (admin-analysis.ts); these are the page's filters. Effects are in
 * percentage points of win chance at even odds.
 */
import type { AnalysisColumn, AnalysisRange, AttributeGroup, LayerKey, LayerToggles } from '@shared/types';


export const ANALYSIS_RANGES = ['7d', '14d', '30d', 'season'] as const satisfies readonly AnalysisRange[];
export const ANALYSIS_COLUMNS = ['all', 'duel', 'team', 'multi'] as const satisfies readonly AnalysisColumn[];
export const LAYER_KEYS = ['tuning', 'weapons', 'refinements', 'loadout', 'stance'] as const satisfies readonly LayerKey[];
export const ATTRIBUTE_GROUPS = ['combat', 'defence', 'chassis', 'ai', 'team'] as const satisfies readonly AttributeGroup[];
export interface AttributeFilters {
  range: AnalysisRange;
  toggles: LayerToggles;
  /** Column used for sorting and the biggest-effects list. */
  column: AnalysisColumn;
}

