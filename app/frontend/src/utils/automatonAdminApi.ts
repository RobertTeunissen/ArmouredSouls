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
import type {
  ActivateAllOutcome,
  ActivationResult,
  AutomatonStatusBar,
  BlueprintFields,
  CatalogueExportPayload,
  CatalogueSyncSummary,
  CatalogueWeapon,
  CreateDraftInput,
  CreateStrategyDraftInput,
  DraftExport,
  DraftPreview,
  DraftSummary,
  DraftView,
  LibraryStrategy,
  ProfileCashflow,
  ProfileDetail,
  ProfileListItem,
  ProfileListPage,
  ProfileListQuery,
  ProfileTurnPreview,
  ProgramSwitchChange,
  StoredImage,
  StrategyComparison,
  StrategyEconomy,
  TeamNames,
  TurnRecordPage,
  UpdateProfileInput,
  UpdateStrategyDraftInput,
  UpdateStrategyInput,
  UpgradeConfirmation,
  UpgradeDryRun,
  UpgradeRequest,
} from '@shared/types';

export type { TieredStandingsMode } from '@shared/utils/automatonStandingsTier';

const BASE = '/api/admin/automatons';

export function getStatus(): Promise<AutomatonStatusBar> {
  return api.get<AutomatonStatusBar>(`${BASE}/status`);
}

export function setProgramSwitch(turnsEnabled: boolean): Promise<ProgramSwitchChange> {
  return api.put<ProgramSwitchChange>(`${BASE}/program`, { turnsEnabled });
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

/** Largest page the list endpoint serves (`PROFILE_LIST_MAX_LIMIT`): one request for 500 stables. */
export const PROFILE_PAGE_LIMIT = 1000;

/** Every profile; a second page only past the limit. */
export async function listAllProfiles(): Promise<ProfileListItem[]> {
  const items: ProfileListItem[] = [];
  for (let page = 1; ; page++) {
    const result = await listProfiles({ page, limit: PROFILE_PAGE_LIMIT });
    items.push(...result.items);
    if (result.items.length === 0 || items.length >= result.total) return items;
  }
}

export function activateAllDrafts(): Promise<{ outcomes: ActivateAllOutcome[] }> {
  return api.post<{ outcomes: ActivateAllOutcome[] }>(`${BASE}/activate-drafts`);
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

export function uploadBlueprintImage(key: string, slot: number, file: File): Promise<StoredImage> {
  const form = new FormData();
  form.append('image', file);
  return api.post<StoredImage>(`${blueprintUrl(key, slot)}/image`, form);
}

export function activateProfile(key: string): Promise<ActivationResult> {
  return api.post<ActivationResult>(`${profileUrl(key)}/activate`);
}

export function previewTurn(key: string): Promise<ProfileTurnPreview> {
  return api.get<ProfileTurnPreview>(`${profileUrl(key)}/preview`);
}

export function listTurns(key: string, page = 1, limit = 20): Promise<TurnRecordPage> {
  return api.get<TurnRecordPage>(`${profileUrl(key)}/turns`, { params: { page, limit } });
}

export function getSyncStatus(): Promise<{ summary: CatalogueSyncSummary | null }> {
  return api.get<{ summary: CatalogueSyncSummary | null }>(`${BASE}/catalogue/sync-status`);
}

export function exportCatalogue(keys: string[] = []): Promise<CatalogueExportPayload> {
  return api.get<CatalogueExportPayload>(`${BASE}/export`, keys.length > 0 ? { params: { keys: keys.join(',') } } : undefined);
}

export function getStrategyComparison(): Promise<StrategyComparison> {
  return api.get<StrategyComparison>(`${BASE}/strategies/comparison`);
}

export function getStrategyEconomy(activated: string | null): Promise<StrategyEconomy> {
  return api.get<StrategyEconomy>(`${BASE}/strategies/economy`, activated ? { params: { activated } } : undefined);
}

export function getProfileCashflow(catalogueKey: string): Promise<ProfileCashflow> {
  return api.get<ProfileCashflow>(`${BASE}/${encodeURIComponent(catalogueKey)}/cashflow`);
}

export function getStrategyLibrary(): Promise<{ strategies: LibraryStrategy[] }> {
  return api.get<{ strategies: LibraryStrategy[] }>(`${BASE}/strategies`);
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

export function dryRunUpgrade(strategyKey: string, request: UpgradeRequest): Promise<UpgradeDryRun> {
  return api.post<UpgradeDryRun>(`${BASE}/strategies/${encodeURIComponent(strategyKey)}/upgrade`, request);
}

export function confirmUpgrade(strategyKey: string, request: UpgradeRequest): Promise<UpgradeConfirmation> {
  return api.post<UpgradeConfirmation>(`${BASE}/strategies/${encodeURIComponent(strategyKey)}/upgrade`, { ...request, confirm: true });
}

export function listWeapons(): Promise<CatalogueWeapon[]> {
  return api.get<CatalogueWeapon[]>('/api/weapons');
}

// ── Downloads ────────────────────────────────────────────────────────

/** Save a JSON value as a file (Catalogue_Export, Strategy_Definition_File). */
export { downloadJson } from './download';
