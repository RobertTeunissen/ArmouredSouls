/**
 * Accepted values and fixed definitions of the admin "what wins" analyses
 * (Attributes page; Weapons later). Dependency-free so route schemas and route
 * tests that mock the services can import them.
 */

export const ANALYSIS_RANGES = ['7d', '14d', '30d', 'season'] as const;
export type AnalysisRange = (typeof ANALYSIS_RANGES)[number];

export const ANALYSIS_RANGE_DAYS: Readonly<Record<Exclude<AnalysisRange, 'season'>, number>> = {
  '7d': 7,
  '14d': 14,
  '30d': 30,
};

/** Mode columns: every comparison, 1v1, team modes, multi-robot modes. */
export const ANALYSIS_COLUMNS = ['all', 'duel', 'team', 'multi'] as const;
export type AnalysisColumn = (typeof ANALYSIS_COLUMNS)[number];

/** `battles.battle_type` → mode column (besides `all`). */
export const MODE_COLUMN: Readonly<Record<string, Exclude<AnalysisColumn, 'all'>>> = {
  league_1v1: 'duel',
  tournament_1v1: 'duel',
  league_2v2: 'team',
  league_3v3: 'team',
  tournament_2v2: 'team',
  tournament_3v3: 'team',
  tag_team: 'team',
  koth: 'multi',
  grand_melee: 'multi',
};

/**
 * Layers on top of the base attributes, in the order combat applies them.
 * All on = the values the simulator fought with (stance included).
 */
export const LAYER_KEYS = ['tuning', 'weapons', 'refinements', 'loadout', 'stance'] as const;
export type LayerKey = (typeof LAYER_KEYS)[number];
export type LayerToggles = Record<LayerKey, boolean>;

export const ALL_LAYERS_ON: Readonly<LayerToggles> = {
  tuning: true,
  weapons: true,
  refinements: true,
  loadout: true,
  stance: true,
};

/** The five attribute groups of the robot detail page (AI Processing and Team Coordination apart). */
export const ATTRIBUTE_GROUPS = ['combat', 'defence', 'chassis', 'ai', 'team'] as const;
export type AttributeGroup = (typeof ATTRIBUTE_GROUPS)[number];

export const ATTRIBUTE_GROUP_OF: Readonly<Record<string, AttributeGroup>> = {
  combatPower: 'combat',
  targetingSystems: 'combat',
  criticalSystems: 'combat',
  penetration: 'combat',
  weaponControl: 'combat',
  attackSpeed: 'combat',
  armorPlating: 'defence',
  shieldCapacity: 'defence',
  evasionThrusters: 'defence',
  damageDampeners: 'defence',
  counterProtocols: 'defence',
  hullIntegrity: 'chassis',
  servoMotors: 'chassis',
  gyroStabilizers: 'chassis',
  hydraulicSystems: 'chassis',
  powerCore: 'chassis',
  combatAlgorithms: 'ai',
  threatAnalysis: 'ai',
  adaptiveAI: 'ai',
  logicCores: 'ai',
  syncProtocols: 'team',
  supportSystems: 'team',
  formationTactics: 'team',
};

/** Days of recording before the analysis is shown. */
export const MIN_RECORDING_DAYS = 7;

/** A column or cell needs at least this many comparisons to be read. */
export const MIN_COMPARISONS = 300;
