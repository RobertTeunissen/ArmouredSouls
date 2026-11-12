/**
 * Wire contracts for the admin analysis pages: Attributes
 * (`GET /api/admin/analysis/attributes`), Weapons (`/api/admin/analysis/weapons`)
 * and Meta (`/api/admin/meta/builds`, `/meta/choices`). Effects are in
 * percentage points of win chance at even odds.
 *
 * The option unions mirror runtime tuples in backend
 * `services/admin/analysis/analysisOptions.ts` and the frontend page filters,
 * which are declared `satisfies` these unions.
 */

export type AnalysisRange = '7d' | '14d' | '30d' | 'season';
export type AnalysisColumn = 'all' | 'duel' | 'team' | 'multi';
export type LayerKey = 'tuning' | 'weapons' | 'refinements' | 'loadout' | 'stance';
export type LayerToggles = Record<LayerKey, boolean>;
export type AttributeGroup = 'combat' | 'defence' | 'chassis' | 'ai' | 'team';
export type AnalysisStrength = 'all' | 'top10';
export type RangeBand = 'melee' | 'short' | 'mid' | 'long';
export type Loadout = 'single' | 'weapon_shield' | 'two_handed' | 'dual_wield';
export type ArchetypeKey = `${RangeBand}+${Loadout}`;
export type MatchupView = 'bands' | 'loadouts' | 'archetypes';
export type UsageTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'champion' | 'tournament';
export type RefinementTier = 'hone' | 'augment' | 'sharpen' | 'forge';

// ── Attributes ───────────────────────────────────────────────────────

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

// ── Weapons ──────────────────────────────────────────────────────────

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

/** Before enough battles are recorded the Weapons page gets the same shape as Attributes. */
export type WeaponAnalysisCollecting = AttributeAnalysisCollecting;
export type WeaponAnalysisResponse = WeaponAnalysisCollecting | WeaponAnalysisReady;

// ── Meta ─────────────────────────────────────────────────────────────

export interface MetaTuningAttribute {
  attribute: string;
  group: AttributeGroup;
  /** Tuning points on this attribute across all robots in scope. */
  points: number;
  /** Robots with more than zero points on it. */
  robots: number;
}

export interface MetaTuning {
  totalRobots: number;
  /** Robots with at least one tuning point. */
  robotsTuned: number;
  /** Points allocated, summed over every robot. */
  poolUsed: number;
  /** Each robot's pool ((Tuning Bay level + 1) × 10) summed over every robot. */
  poolTotal: number;
  byGroup: Array<{ group: AttributeGroup; points: number }>;
  /** All 23 attributes, most points first. */
  attributes: MetaTuningAttribute[];
}

export type RefinementKind = 'hone' | 'augment' | 'sharpen' | 'forge';

export interface MetaRefinements {
  /** Stables of this type with at least one robot. */
  stables: number;
  stablesRefining: number;
  refinements: number;
  weaponsRefined: number;
  /** Lifetime credits paid for refinements. */
  creditsSpent: number;
  perKind: Array<{ kind: RefinementKind; refinements: number; stables: number; credits: number }>;
  /** Attributes targeted by Hone and Augment, most refinements first. */
  targeted: Array<{ attribute: string; refinements: number; magnitude: number }>;
  /** Top 5 stables by credits spent. */
  topSpenders: Array<{ userId: number; stableName: string | null; username: string; credits: number; weapons: number }>;
}

export interface MetaEventEntry {
  totalRobots: number;
  /** Robots entered in at least one event. */
  robotsEntered: number;
  /** Entries per robot, over every robot in scope. */
  averageEvents: number;
  /** Every subscribable event in registry order, with the robots entered in it. */
  perEvent: Array<{ eventType: string; robots: number }>;
  /** Robots by number of events entered, from 0 to the number of events. */
  eventsPerRobot: Array<{ events: number; robots: number }>;
}

export interface MetaBuilds {
  tuning: MetaTuning;
  refinements: MetaRefinements;
  eventEntry: MetaEventEntry;
}

/** The choice sections of the Meta page (`GET /api/admin/meta/choices`). */
export interface MetaChoices {
  weapons: {
    totalBought: number;
    /** Robots with a main weapon (ignores offhands). */
    equipped: number;
    /** Owned weapons sitting in any robot's main or offhand slot. */
    equippedInventoryItems: number;
  };
  stances: Array<{ stance: string; count: number }>;
  loadouts: Array<{ type: string; count: number }>;
  yieldThresholds: {
    distribution: Array<{ threshold: number; count: number }>;
    mostCommon: number;
    mostCommonCount: number;
  };
  facilities: {
    /** `purchaseCount` = stables owning the facility at level 1 or higher. */
    summary: Array<{ type: string; purchaseCount: number; avgLevel: number }>;
    totalPurchases: number;
    mostPopular: string;
  };
  timestamp: string;
}
