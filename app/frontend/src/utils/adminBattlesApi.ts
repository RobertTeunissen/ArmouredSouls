/**
 * Admin Battles API (`/admin/battles`): find any battle, check it, export it.
 */
import { api } from './api';
import type {
  BattleDetail,
  BattleFilters,
  BattleListResponse,
  BattleLogResponse,
} from '../components/admin/battles/types';

export const BATTLES_PAGE_SIZE = 25;

export function getBattleList(filters: BattleFilters, signal?: AbortSignal): Promise<BattleListResponse> {
  const params: Record<string, unknown> = {
    page: filters.page,
    limit: BATTLES_PAGE_SIZE,
    mode: filters.mode,
    stable: filters.stable,
    outcome: filters.outcome,
    range: filters.range,
  };
  if (filters.q.trim()) params.q = filters.q.trim();
  return api.get<BattleListResponse>('/api/admin/battles', { params, signal });
}

export function getBattleDetail(battleId: number, signal?: AbortSignal): Promise<BattleDetail> {
  return api.get<BattleDetail>(`/api/admin/battles/${battleId}`, { signal });
}

export function getBattleLog(battleId: number, signal?: AbortSignal): Promise<BattleLogResponse> {
  return api.get<BattleLogResponse>(`/api/admin/battles/${battleId}/log`, { signal });
}

export function getBattleExportText(battleId: number): Promise<string> {
  return api.get<string>(`/api/admin/battles/${battleId}/export`, { params: { format: 'text' }, responseType: 'text' });
}

export function getBattleExportJson(battleId: number): Promise<unknown> {
  return api.get<unknown>(`/api/admin/battles/${battleId}/export`, { params: { format: 'json' } });
}

/**
 * Copy the battle's text export to the clipboard and return its size in bytes.
 * The clipboard write starts inside the click (Safari drops the permission
 * once a request has been awaited), with the text arriving as a promise.
 */
export async function copyBattleExport(battleId: number): Promise<number> {
  const text = getBattleExportText(battleId);
  const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
  if (!clipboard) throw new Error('Clipboard is not available in this browser.');
  if (typeof ClipboardItem !== 'undefined' && typeof clipboard.write === 'function') {
    try {
      await clipboard.write([
        new ClipboardItem({ 'text/plain': text.then((value) => new Blob([value], { type: 'text/plain' })) }),
      ]);
      return new Blob([await text]).size;
    } catch (error) {
      // A failed export is the real error; otherwise fall back to writeText below.
      await text;
      if (typeof clipboard.writeText !== 'function') throw error;
    }
  }
  const value = await text;
  await clipboard.writeText(value);
  return new Blob([value]).size;
}
