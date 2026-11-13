/**
 * Admin "what wins" analyses on the battle-time build records
 * (`battle_participant_builds`): the Attributes and Weapons pages share the
 * comparisons, the loaded window and the logistic engine. Meta (stance and
 * yield) will reuse them.
 */
export * from './analysisOptions';
export { getAttributeAnalysis, type AttributeAnalysisParams } from './attributeAnalysisService';
export { getWeaponAnalysis, type WeaponAnalysisParams } from './weaponAnalysisService';
