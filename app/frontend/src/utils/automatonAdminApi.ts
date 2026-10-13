/**
 * Admin_Automaton_Control API (Spec #55, design §17.1, task 10.1).
 *
 * Typed functions for every `/api/admin/automatons` endpoint. The shapes
 * mirror the backend services (`automatonProfileService`, `turnPreview`,
 * `automatonStatus`, `strategyComparisonService`, `strategyLibrary`,
 * `strategyDraftService`, `strategyUpgradeService`, `catalogueSync`). Every
 * rule is enforced by the backend; the admin page renders its answers.
 * Errors arrive as `ApiError` with `details.issues` for rule failures.
 */
import { api } from './api';
import type { TieredStandingsMode } from '@shared/utils/automatonStandingsTier';

export type { TieredStandingsMode } from '@shared/utils/automatonStandingsTier';

const BASE = '/api/admin/automatons';

// ── Shared shapes ────────────────────────────────────────────────────

export type ProfileStatus = 'draft' | 'active';
export type LeagueTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'champion';
export type TurnTrigger = 'settlement' | 'preparation' | 'season_open';
export type TurnStatus = 'in_progress' | 'completed' | 'failed' | 'skipped';
export type GoalType = 'robots' | 'facility' | 'attributes' | 'weapons' | 'refine';
export type LoadoutType = 'single' | 'weapon_shield' | 'dual_wield' | 'two_handed';
export type Stance = 'offensive' | 'defensive' | 'balanced';
export type BuildFocusKey = 'bruiser' | 'deadeye' | 'warden' | 'sprinter' | 'tactician' | 'versatile';
export type AttributeGroup = 'combat' | 'defense' | 'mobility' | 'ai';
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
  targetAttribute?: string;
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
  facilityType?: string;
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
}

export interface ProgramSwitchChange {
  previous: boolean;
  current: boolean;
  updatedAt: string;
}

export function getStatus(): Promise<AutomatonStatusBar> {
  return api.get<AutomatonStatusBar>(`${BASE}/status`);
}

export function setProgramSwitch(turnsEnabled: boolean): Promise<ProgramSwitchChange> {
  return api.put<ProgramSwitchChange>(`${BASE}/program`, { turnsEnabled });
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

export function listProfiles(query: ProfileListQuery = {}): Promise<ProfileListPage> {
  const params: Record<string, unknown> = {};
  if (query.status) params.status = query.status;
  if (query.strategy) params.strategy = query.strategy;
  if (query.attention !== undefined) params.attention = String(query.attention);
  if (query.page !== undefined) params.page = query.page;
  if (query.limit !== undefined) params.limit = query.limit;
  return api.get<ProfileListPage>(BASE, { params });
}

/** Largest page the list endpoint serves (`paginationQuery`). */
export const PROFILE_PAGE_LIMIT = 100;

/** Every profile, fetched page by page. */
export async function listAllProfiles(): Promise<ProfileListItem[]> {
  const items: ProfileListItem[] = [];
  for (let page = 1; ; page++) {
    const result = await listProfiles({ page, limit: PROFILE_PAGE_LIMIT });
    items.push(...result.items);
    if (result.items.length === 0 || items.length >= result.total) return items;
  }
}

export type ActivateAllOutcome =
  | { catalogueKey: string; outcome: 'activated'; stableName: string; userId: number }
  | { catalogueKey: string; outcome: 'rejected'; code: string; message: string };

export function activateAllDrafts(): Promise<{ outcomes: ActivateAllOutcome[] }> {
  return api.post<{ outcomes: ActivateAllOutcome[] }>(`${BASE}/activate-drafts`);
}

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
  group: AttributeGroup;
  target: number;
  academyLevel: number;
  buysAcademy: boolean;
}

export interface AttributePlanView {
  goalId: string;
  robots: { slot: number; robotName: string; buildFocus: BuildFocusKey; groups: AttributePlanGroup[] }[];
  academies: { group: AttributeGroup; level: number }[];
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

const profileUrl = (key: string): string => `${BASE}/${encodeURIComponent(key)}`;
const blueprintUrl = (key: string, slot: number): string => `${profileUrl(key)}/blueprints/${slot}`;

export function getProfile(key: string): Promise<ProfileDetail> {
  return api.get<ProfileDetail>(profileUrl(key));
}

export function createDraft(input: CreateDraftInput): Promise<ProfileDetail> {
  return api.post<ProfileDetail>(BASE, input);
}

export function updateProfile(key: string, input: UpdateProfileInput): Promise<ProfileDetail> {
  return api.patch<ProfileDetail>(profileUrl(key), input);
}

export function deleteDraft(key: string): Promise<void> {
  return api.delete<void>(profileUrl(key));
}

export function updateStrategy(key: string, input: UpdateStrategyInput): Promise<ProfileDetail> {
  return api.put<ProfileDetail>(`${profileUrl(key)}/strategy`, input);
}

export function addBlueprint(key: string, fields: BlueprintFields & { slot?: number; teamNames?: TeamNames }): Promise<ProfileDetail> {
  return api.post<ProfileDetail>(`${profileUrl(key)}/blueprints`, fields);
}

export function updateBlueprint(
  key: string,
  slot: number,
  fields: Partial<BlueprintFields> & { slot?: number; teamNames?: TeamNames },
): Promise<ProfileDetail> {
  return api.patch<ProfileDetail>(blueprintUrl(key, slot), fields);
}

export function deleteBlueprint(key: string, slot: number, teamNames?: TeamNames): Promise<ProfileDetail> {
  return api.delete<ProfileDetail>(blueprintUrl(key, slot), teamNames ? { data: { teamNames } } : undefined);
}

export interface StoredImage {
  imageUrl: string;
  robotsUpdated: number;
}

export function uploadBlueprintImage(key: string, slot: number, file: File): Promise<StoredImage> {
  const form = new FormData();
  form.append('image', file);
  return api.post<StoredImage>(`${blueprintUrl(key, slot)}/image`, form);
}

export interface ActivationResult {
  catalogueKey: string;
  userId: number;
  stableName: string;
  activatedAt: string;
}

export function activateProfile(key: string): Promise<ActivationResult> {
  return api.post<ActivationResult>(`${profileUrl(key)}/activate`);
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
  facilityType?: string;
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

export function previewTurn(key: string): Promise<ProfileTurnPreview> {
  return api.get<ProfileTurnPreview>(`${profileUrl(key)}/preview`);
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

export function listTurns(key: string, page = 1, limit = 20): Promise<TurnRecordPage> {
  return api.get<TurnRecordPage>(`${profileUrl(key)}/turns`, { params: { page, limit } });
}

// ── Catalogue ────────────────────────────────────────────────────────

export interface CatalogueSyncSummary {
  ranAt: string;
  added: string[];
  present: string[];
  filled: { catalogueKey: string; slot: number; imageUrl: string }[];
  conflicts: { catalogueKey: string; stableName: string; reason: 'stable_name_taken' }[];
}

export function getSyncStatus(): Promise<{ summary: CatalogueSyncSummary | null }> {
  return api.get<{ summary: CatalogueSyncSummary | null }>(`${BASE}/catalogue/sync-status`);
}

/** Catalogue_Export document (opaque here: it is saved as a file). */
export type CatalogueExportDocument = Record<string, unknown>;

export function exportCatalogue(keys: string[] = []): Promise<CatalogueExportDocument> {
  return api.get<CatalogueExportDocument>(`${BASE}/export`, keys.length > 0 ? { params: { keys: keys.join(',') } } : undefined);
}

// ── Strategies ───────────────────────────────────────────────────────

export interface WinRate {
  wins: number;
  losses: number;
  draws: number;
  total: number;
  percentage: number | null;
}

export interface ComparisonRow {
  strategyKey: string | null;
  displayName: string;
  reference: boolean;
  stables: number;
  robots: { average: number; targetAverage: number | null };
  prestigeAverage: number;
  bestTier: { tier: LeagueTier; stables: number } | null;
  creditsAverage: number;
  winRate: WinRate | null;
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

export function getStrategyComparison(): Promise<StrategyComparison> {
  return api.get<StrategyComparison>(`${BASE}/strategies/comparison`);
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

export function getStrategyLibrary(): Promise<{ strategies: LibraryStrategy[] }> {
  return api.get<{ strategies: LibraryStrategy[] }>(`${BASE}/strategies`);
}

// ── Strategy_Drafts ──────────────────────────────────────────────────

export type FileTargetValue = number | 'max';

export type FileGoalReference =
  | { type: 'robots' }
  | { type: 'facility'; facilityType: string }
  | { type: 'attributes' }
  | { type: 'weapons' }
  | { type: 'refine' };

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
  rule: string;
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

const draftUrl = (id: number): string => `${BASE}/strategy-drafts/${id}`;

export function listStrategyDrafts(): Promise<{ drafts: DraftSummary[] }> {
  return api.get<{ drafts: DraftSummary[] }>(`${BASE}/strategy-drafts`);
}

export function createStrategyDraft(input: CreateStrategyDraftInput): Promise<DraftView> {
  return api.post<DraftView>(`${BASE}/strategy-drafts`, input);
}

export function getStrategyDraft(id: number): Promise<DraftView> {
  return api.get<DraftView>(draftUrl(id));
}

export function updateStrategyDraft(id: number, input: UpdateStrategyDraftInput): Promise<DraftView> {
  return api.put<DraftView>(draftUrl(id), input);
}

export function deleteStrategyDraft(id: number): Promise<void> {
  return api.delete<void>(draftUrl(id));
}

export function previewStrategyDraft(id: number, catalogueKey: string): Promise<DraftPreview> {
  return api.post<DraftPreview>(`${draftUrl(id)}/preview`, { catalogueKey });
}

export function exportStrategyDraft(id: number): Promise<DraftExport> {
  return api.get<DraftExport>(`${draftUrl(id)}/export`);
}

// ── Strategy_Version upgrade ─────────────────────────────────────────

export type TargetChangeStatus = 'kept' | 'clamped' | 'new' | 'removed';

export interface LabelledTargetChange {
  status: TargetChangeStatus;
  type: GoalType;
  facilityType?: string;
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
  catalogueKeys?: string[];
}

export function dryRunUpgrade(strategyKey: string, request: UpgradeRequest): Promise<UpgradeDryRun> {
  return api.post<UpgradeDryRun>(`${BASE}/strategies/${encodeURIComponent(strategyKey)}/upgrade`, request);
}

export function confirmUpgrade(strategyKey: string, request: UpgradeRequest): Promise<UpgradeConfirmation> {
  return api.post<UpgradeConfirmation>(`${BASE}/strategies/${encodeURIComponent(strategyKey)}/upgrade`, { ...request, confirm: true });
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

export function listWeapons(): Promise<CatalogueWeapon[]> {
  return api.get<CatalogueWeapon[]>('/api/weapons');
}

// ── Downloads ────────────────────────────────────────────────────────

/** Save a JSON value as a file (Catalogue_Export, Strategy_Definition_File). */
export function downloadJson(fileName: string, value: unknown): void {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
