/**
 * Wire contracts for the admin Automatons pages (`/api/admin/automatons/*`;
 * backend `services/automaton`). Request bodies (`*Input`, `UpgradeRequest`)
 * are included: the routes validate them with Zod and pass them on.
 */
import type { TieredStandingsMode } from '../utils/automatonStandingsTier';
import type { RobotAttribute } from '../utils/robotAttributes';

/** Facilities an Automaton can build (`AUTOMATON_FACILITY_TYPES` in backend `services/automaton/stableFacts.ts` satisfies it). */
export type AutomatonFacilityType =
  | 'repair_bay'
  | 'training_facility'
  | 'weapons_workshop'
  | 'refinement_lab'
  | 'roster_expansion'
  | 'storage_facility'
  | 'booking_office'
  | 'combat_training_academy'
  | 'defense_training_academy'
  | 'mobility_training_academy'
  | 'ai_training_academy'
  | 'merchandising_hub'
  | 'streaming_studio'
  | 'tuning_bay';

// ── Shared shapes ────────────────────────────────────────────────────

export type ProfileStatus = 'draft' | 'active';

export type LeagueTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'champion';

export type TurnTrigger = 'settlement' | 'preparation' | 'season_open';

export type TurnStatus = 'in_progress' | 'completed' | 'failed' | 'skipped';

export type GoalType = 'robots' | 'facility' | 'attributes' | 'weapons' | 'refine' | 'economy';

export type LoadoutType = 'single' | 'weapon_shield' | 'dual_wield' | 'two_handed';

export type Stance = 'offensive' | 'defensive' | 'balanced';

export type BuildFocusKey = 'bruiser' | 'deadeye' | 'warden' | 'sprinter' | 'tactician' | 'versatile';

export type AcademyGroup = 'combat' | 'defense' | 'mobility' | 'ai';

export type RefinementTierKey = 'hone' | 'augment' | 'sharpen' | 'forge';

export type Hand = 'main' | 'offhand';

export interface TeamNames {
  twoVsTwo: string[];
  threeVsThree: string[];
}

export interface WeaponStage {
  main: string;
  offhand?: string;
}

export interface RefinementStep {
  tier: RefinementTierKey;
  hand: Hand;
  /** Hone and augment only. */
  targetAttribute?: RobotAttribute;
  magnitude: number;
}

export interface BlueprintFields {
  robotName: string;
  loadoutType: LoadoutType;
  stance: Stance;
  yieldThreshold: number;
  buildFocus: BuildFocusKey;
  weaponPath: WeaponStage[];
  refinementPlan: RefinementStep[];
}

export interface BlueprintView extends BlueprintFields {
  slot: number;
  id: number;
  imageUrl: string | null;
  liveRobot: { id: number; name: string } | null;
}

export interface TargetBounds {
  min: number;
  max: number;
}

export interface BuildOrderDescriptor {
  position: number;
  goalId: string;
  type: GoalType;
  facilityType?: AutomatonFacilityType;
  label: string;
  defaultTarget: number;
  bounds: TargetBounds;
  isMax: boolean;
  buys: string;
}

export type NeedAttentionReason =
  | { code: 'last_cycle_failed'; errorCode: string; label: string }
  | { code: 'balance_negative'; label: string }
  | { code: 'nothing_bought'; cycles: number; label: string };

export interface TurnSummary {
  seasonNumber: number;
  trigger: TurnTrigger;
  slot: number;
  attempt: number;
  status: TurnStatus;
  reason: string | null;
  creditsSpent: number;
  creditsReceived: number;
  actionCount: number;
  savingGoal: { goalId: string; position: number | null; label: string | null; target: number | null } | null;
  startedAt: string;
  finishedAt: string | null;
}

// ── Status bar and program switch ────────────────────────────────────

export interface LastTurnStep {
  seasonNumber: number;
  trigger: TurnTrigger;
  slot: number;
  label: string;
  finishedAt: string | null;
  processed: number;
  durationMs: number | null;
}

export interface AutomatonStatusBar {
  program: { turnsEnabled: boolean; updatedAt: string };
  lastStep: LastTurnStep | null;
  failedCount: number;
  needAttentionCount: number;
  /** Active Automatons per Need_Attention reason (a stable can have several). */
  needAttentionByReason: Record<NeedAttentionReason['code'], number>;
}

export interface ProgramSwitchChange {
  previous: boolean;
  current: boolean;
  updatedAt: string;
}

// ── Stables list ─────────────────────────────────────────────────────

export interface ProfileListItem {
  catalogueKey: string;
  stableName: string;
  franchise: string;
  status: ProfileStatus;
  origin: string;
  strategyKey: string;
  strategyVersion: number;
  strategyDisplayName: string | null;
  blueprintCount: number;
  robots: { current: number; target: number | null };
  credits: number | null;
  prestige: number | null;
  /** Highest current tier over the modes the stable has played (unplayed default rows ignored). */
  bestTier: LeagueTier | null;
  /** The mode that holds `bestTier`; null when `bestTier` is null. */
  bestTierMode: TieredStandingsMode | null;
  lastTurn: TurnSummary | null;
  activatedAt: string | null;
  needAttention: NeedAttentionReason[];
}

export interface ProfileListPage {
  items: ProfileListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface ProfileListQuery {
  status?: ProfileStatus;
  strategy?: string;
  attention?: boolean;
  page?: number;
  limit?: number;
}

export type ActivateAllOutcome =
  | { catalogueKey: string; outcome: 'activated'; stableName: string; userId: number }
  | { catalogueKey: string; outcome: 'rejected'; code: string; message: string };

// ── One profile ──────────────────────────────────────────────────────

export interface TeamRowView {
  size: 2 | 3;
  index: number;
  slots: number[];
  name: string | null;
  members: (string | null)[];
  state: 'formed' | 'waiting';
  waitsForSlot: number | null;
}

export interface AttributePlanGroup {
  group: AcademyGroup;
  target: number;
  academyLevel: number;
  buysAcademy: boolean;
}

export interface AttributePlanView {
  goalId: string;
  robots: { slot: number; robotName: string; buildFocus: BuildFocusKey; groups: AttributePlanGroup[] }[];
  academies: { group: AcademyGroup; level: number }[];
}

export interface BuildFocusOption {
  key: BuildFocusKey;
  displayName: string;
  description: string;
}

export interface ProfileDetail {
  catalogueKey: string;
  stableName: string;
  franchise: string;
  backstory: string;
  status: ProfileStatus;
  origin: string;
  activatedAt: string | null;
  userId: number | null;
  credits: number | null;
  prestige: number | null;
  strategy: {
    key: string;
    version: number;
    displayName: string | null;
    latestVersion: number | null;
    buildOrder: (BuildOrderDescriptor & { target: number })[];
    parametersValid: boolean;
  };
  teamNames: TeamNames;
  requiredTeamNames: { twoVsTwo: number; threeVsThree: number } | null;
  teams: TeamRowView[];
  eventOrder: string[];
  blueprints: BlueprintView[];
  registeredTeams: { id: number; teamSize: number; teamName: string; robotIds: number[] }[];
  lastTurn: TurnSummary | null;
  attributePlans: AttributePlanView[];
  buildFocusOptions: BuildFocusOption[];
}

export interface CreateDraftInput {
  catalogueKey: string;
  stableName: string;
  franchise: string;
  backstory: string;
  strategyKey: string;
  eventOrder?: string[];
  teamNames?: TeamNames;
}

export interface UpdateProfileInput {
  stableName?: string;
  franchise?: string;
  backstory?: string;
  teamNames?: TeamNames;
  eventOrder?: string[];
}

export interface UpdateStrategyInput {
  strategyKey: string;
  targets?: Record<string, number>;
  teamNames?: TeamNames;
}

export interface StoredImage {
  imageUrl: string;
  robotsUpdated: number;
}

export interface ActivationResult {
  catalogueKey: string;
  userId: number;
  stableName: string;
  activatedAt: string;
}

// ── Turn_Preview and Turn_Records ────────────────────────────────────

export type PreviewGoalStatus = 'done' | 'bought' | 'saving' | 'blocked' | 'waiting';

export type BlockedReason =
  | 'prestige_gate'
  | 'max_level'
  | 'roster_limit'
  | 'no_blueprint'
  | 'awaiting_final_weapon'
  | 'storage_limit'
  | 'name_unavailable';

export type GoalDetail = Record<string, number | string>;

export interface PreviewGoal {
  goalId: string;
  position: number;
  type: GoalType;
  facilityType?: AutomatonFacilityType;
  label: string;
  target: number;
  isMax: boolean;
  status: PreviewGoalStatus;
  gated: boolean;
  reason?: BlockedReason;
  detail: GoalDetail;
  bought: { steps: number; cost: number };
  needed?: number;
  available?: number;
}

export type PlannedActionKind = 'robot_chain' | 'facility_upgrade' | 'attribute_upgrade' | 'weapon_stage' | 'weapon_refinement';

export interface PreviewAction {
  goalId: string;
  position: number;
  kind: PlannedActionKind;
  cost: number;
  chargedSteps: number;
  detail: Record<string, string | number>;
}

export interface TurnPreviewResult {
  startBalance: number;
  projectedEndBalance: number;
  chargedActions: number;
  stop: string;
  actions: PreviewAction[];
  goals: PreviewGoal[];
}

export interface ProfileTurnPreview extends TurnPreviewResult {
  catalogueKey: string;
  status: ProfileStatus;
  strategyKey: string;
  strategyVersion: number;
  seasonNumber: number;
  phase: 'preparation' | 'competitive';
}

export interface TurnRecord extends TurnSummary {
  startBalance: number;
  endBalance: number | null;
  durationMs: number | null;
  actions: unknown;
  goalOutcomes: unknown;
  upkeepIssues: unknown;
}

export interface TurnRecordPage {
  items: TurnRecord[];
  total: number;
  page: number;
  limit: number;
}

// ── Catalogue ────────────────────────────────────────────────────────

export interface CatalogueSyncSummary {
  ranAt: string;
  added: string[];
  present: string[];
  filled: { catalogueKey: string; slot: number; imageUrl: string }[];
  conflicts: { catalogueKey: string; stableName: string; reason: 'stable_name_taken' }[];
}

/** Catalogue_Export document (opaque here: it is saved as a file). */
export type CatalogueExportPayload = Record<string, unknown>;

// ── Strategies ───────────────────────────────────────────────────────

export interface ComparisonRow {
  strategyKey: string | null;
  displayName: string;
  reference: boolean;
  stables: number;
  robots: { average: number; targetAverage: number | null };
  prestigeAverage: number;
  bestTier: { tier: LeagueTier; stables: number } | null;
  creditsAverage: number;
  /** Six entries in `TIERED_STANDINGS_MODES` order, zero-filled. */
  modes: ModePerformance[];
}

/** One strategy's standings in one tiered mode, played rows only (backend `strategyModePerformance.ts`). */
export interface ModePerformance {
  mode: TieredStandingsMode;
  /** `placement` = King of the Hill and Grand Melee. */
  kind: 'head_to_head' | 'placement';
  /** `team` = 2v2, 3v3 and Tag Team. */
  entityType: 'robot' | 'team';
  stablesPlayed: number;
  entitiesPlayed: number;
  /** Placement modes: first places. */
  wins: number;
  /** Placement modes: always 0 (not recorded). */
  losses: number;
  /** Placement modes: always 0 (not recorded). */
  draws: number;
  /** Head-to-head: W + L + D; placement: matches played. */
  matches: number;
  winPercentage: number | null;
  /** Placement modes only. */
  bestPlacement: number | null;
  lowSample: boolean;
}

export interface StrategyComparison {
  season: { seasonNumber: number; phase: string; cycle: number; lengthCycles: number; preparationDay: number };
  rows: ComparisonRow[];
  generatedAt: string;
}

/** Strategies → Economy (backend `strategyEconomyService.ts`). */
export interface StrategyEconomyRow {
  strategyKey: string;
  displayName: string;
  stables: number;
  inDeficit: number;
  medianBalance: number;
  earnedPerCycle: number | null;
  runningCostsPerCycle: number | null;
  topSavingGoal: { label: string; target: number | null; stables: number } | null;
}

export interface StrategyEconomy {
  window: { fromCycle: number; toCycle: number };
  batches: { date: string; stables: number }[];
  activated: string | null;
  rows: StrategyEconomyRow[];
  totals: { stables: number; inDeficit: number };
  generatedAt: string;
}

/** The Editor's Cashflow card (backend `stableCashflow.ts`). */
export interface ProfileCashflowCycle {
  cycle: number;
  balance: number;
  earned: number;
  runningCosts: number;
  bought: number;
}

export interface ProfileCashflow {
  points: ProfileCashflowCycle[];
  earned: number;
  runningCosts: number;
  bought: number;
  lowBalanceCycles: number;
}

export interface LibraryVersion {
  version: number;
  displayName: string;
  description: string;
  latest: boolean;
  profileCount: number;
  buildOrder: BuildOrderDescriptor[];
}

export interface LibraryStrategy {
  key: string;
  displayName: string;
  description: string;
  latestVersion: number;
  profileCount: number;
  versions: LibraryVersion[];
}

// ── Strategy_Drafts ──────────────────────────────────────────────────

export type FileTargetValue = number | 'max';

export type FileGoalReference =
  | { type: 'robots' }
  | { type: 'facility'; facilityType: AutomatonFacilityType }
  | { type: 'attributes' }
  | { type: 'weapons' }
  | { type: 'refine' }
  | { type: 'economy' };

export interface FileBuildOrderEntry {
  position: number;
  goal: FileGoalReference;
  defaultTarget: FileTargetValue;
  bounds: { min: FileTargetValue; max: FileTargetValue };
}

export interface StrategyDefinitionFile {
  schemaVersion: 1;
  key: string;
  version: number;
  displayName: string;
  description: string;
  buildOrder: FileBuildOrderEntry[];
}

export interface StrategyRuleIssue {
  rule: StrategyRule;
  message: string;
  position?: number;
  path: (string | number)[];
}

export interface UpgradeWarningEntry {
  catalogueKey: string;
  stableName: string;
  fromVersion: number;
  code: string;
  reason: string;
}

export interface DraftValidation {
  issues: StrategyRuleIssue[];
  errorCount: number;
  ready: boolean;
  upgradeWarning: UpgradeWarningEntry[] | null;
}

export interface DraftView extends DraftValidation {
  id: number;
  basedOn: string | null;
  definition: StrategyDefinitionFile;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface DraftSummary {
  id: number;
  key: string;
  version: number;
  basedOn: string | null;
  displayName: string;
  goalCount: number;
  errorCount: number;
  ready: boolean;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface DraftExport {
  fileName: string;
  definition: StrategyDefinitionFile;
  upgradeWarning: UpgradeWarningEntry[] | null;
}

export interface ScenarioPurchase {
  turnIndex: number;
  goalId: string;
  kind: string;
  label: string;
  cost: number;
}

export interface DraftPreview {
  draftId: number;
  catalogueKey: string;
  profile: TurnPreviewResult;
  freshStable: { startBalance: number; endBalance: number; purchases: ScenarioPurchase[] };
}

export type CreateStrategyDraftInput = { basedOn: string } | { key: string; displayName?: string; description?: string };

export interface UpdateStrategyDraftInput {
  key?: string;
  displayName?: string;
  description?: string;
  buildOrder?: FileBuildOrderEntry[];
}

// ── Strategy_Version upgrade ─────────────────────────────────────────

export type TargetChangeStatus = 'kept' | 'clamped' | 'new' | 'removed';

export interface LabelledTargetChange {
  status: TargetChangeStatus;
  type: GoalType;
  facilityType?: AutomatonFacilityType;
  fromGoalId: string | null;
  toGoalId: string | null;
  position: number | null;
  oldTarget: number | null;
  newTarget: number | null;
  label: string;
}

export interface UpgradeEvaluation {
  catalogueKey: string;
  stableName: string;
  status: ProfileStatus;
  fromVersion: number;
  toVersion: number;
  changes: LabelledTargetChange[];
  params: { targets: Record<string, number> };
  requiredTeamNames: { twoVsTwo: number; threeVsThree: number };
  passes: boolean;
  rejection: { code: string; reason: string } | null;
}

export interface UpgradeDryRun {
  strategyKey: string;
  toVersion: number;
  confirm: false;
  profiles: UpgradeEvaluation[];
}

export interface UpgradeConfirmation {
  strategyKey: string;
  toVersion: number;
  confirm: true;
  upgraded: { catalogueKey: string; stableName: string; fromVersion: number; toVersion: number; changedFields: string[] }[];
  rejected: { catalogueKey: string; stableName: string; fromVersion: number; code: string; reason: string }[];
}

export interface UpgradeRequest {
  toVersion: number;
  /** The profiles to upgrade; absent = every profile of the strategy on an older version. */
  catalogueKeys?: string[];
  confirm?: boolean;
  /** New Team_Names; single-profile upgrades only. */
  teamNames?: TeamNames;
}

// ── Weapons (the player catalogue endpoint) ──────────────────────────

export interface CatalogueWeapon {
  id: number;
  name: string;
  weaponType: string;
  handsRequired: string;
  rangeBand: 'melee' | 'short' | 'mid' | 'long';
  baseDamage: number;
  cooldown: number;
  cost: number;
  [bonus: `${string}Bonus`]: number;
}

export type StrategyRule =
  | 'schema'
  | 'goal_count'
  | 'position_sequence'
  | 'bounds_limit'
  | 'bounds_order'
  | 'max_target_type'
  | 'default_out_of_bounds'
  | 'academy_facility_goal'
  | 'robots_goal_first'
  | 'required_goal_type'
  | 'last_goal_attributes_max'
  | 'key_exists'
  | 'version_not_next'
  | 'file_name'
  | 'duplicate_version';
