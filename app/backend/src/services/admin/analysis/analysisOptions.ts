/**
 * Accepted values and fixed definitions of the admin "what wins" analyses
 * (Attributes and Weapons pages). Dependency-free so route schemas and route
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

// ── Weapons analysis ─────────────────────────────────────────────────

/** All robots, or only fights where every robot is in the top 10% of points invested in its mode. */
export const ANALYSIS_STRENGTHS = ['all', 'top10'] as const;
export type AnalysisStrength = (typeof ANALYSIS_STRENGTHS)[number];

/** Share of robots (by points invested, per mode column) that "Top 10%" keeps. */
export const TOP_STRENGTH_SHARE = 0.1;

/** `weapons.range_band`, closest first. */
export const RANGE_BANDS = ['melee', 'short', 'mid', 'long'] as const;
export type RangeBand = (typeof RANGE_BANDS)[number];

/** `battle_participant_builds.loadout_type`. */
export const LOADOUTS = ['single', 'weapon_shield', 'two_handed', 'dual_wield'] as const;
export type Loadout = (typeof LOADOUTS)[number];

/** Archetype key: main weapon range band × loadout, e.g. 'melee+weapon_shield'. */
export type ArchetypeKey = `${RangeBand}+${Loadout}`;

export const ARCHETYPES: readonly ArchetypeKey[] = RANGE_BANDS.flatMap((band) => LOADOUTS.map((loadout) => `${band}+${loadout}` as ArchetypeKey));

/** Matchup grids: by range band, by loadout, or between the most used archetypes. */
export const MATCHUP_VIEWS = ['bands', 'loadouts', 'archetypes'] as const;
export type MatchupView = (typeof MATCHUP_VIEWS)[number];
export const MATCHUP_TOP_ARCHETYPES = 6;

/** Tier rows of the usage bars, lowest first; tournaments have no tier and get their own row. */
export const USAGE_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion', 'tournament'] as const;
export type UsageTier = (typeof USAGE_TIERS)[number];
/** Archetypes shown as their own segment in the tier bars (the rest is "Other"). */
export const TIER_SEGMENTS = 5;
/** A tier needs this many robots before its shares pick the segments. */
export const TIER_MIN_ROBOTS = 20;

/** A weapon, archetype or matchup cell needs this many comparisons where it differs between the sides. */
export const MIN_CELL_COMPARISONS = 100;
