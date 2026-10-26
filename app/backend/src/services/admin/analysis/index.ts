/**
 * Admin "what wins" analyses on the battle-time build records
 * (`battle_participant_builds`). The Attributes page uses it today; Weapons
 * and Meta will reuse the comparisons and the logistic engine.
 */
export * from './analysisOptions';
export type * from './analysisTypes';
export { getAttributeAnalysis, clearAttributeAnalysisCache, type AttributeAnalysisParams } from './attributeAnalysisService';
