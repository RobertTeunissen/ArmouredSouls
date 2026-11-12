/**
 * URL state and display helpers of the admin Actions page (`/admin/actions`).
 */
import { ADMIN_ACTION_AREAS, type AdminActionsFilters } from './adminActionsApi';
import type { AdminActionArea, AdminActionResultFilter, JsonValue } from '@shared/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Read the page state from the URL (`area`, `result=failure`, `page`). */
export function readActionsView(params: URLSearchParams): AdminActionsFilters {
  const rawArea = params.get('area');
  const area = ADMIN_ACTION_AREAS.find((value) => value === rawArea) ?? null;
  const result: AdminActionResultFilter = params.get('result') === 'failure' ? 'failure' : 'all';
  const page = Number(params.get('page'));
  return { area, result, page: Number.isSafeInteger(page) && page > 1 ? page : 1 };
}

/** Write a patch of the page state into the URL; defaults are left out. */
export function writeActionsView(params: URLSearchParams, patch: Partial<AdminActionsFilters>): URLSearchParams {
  const next = new URLSearchParams(params);
  const set = (name: string, value: string | null): void => {
    if (value === null) next.delete(name);
    else next.set(name, value);
  };
  if (patch.area !== undefined) set('area', patch.area);
  if (patch.result !== undefined) set('result', patch.result === 'failure' ? 'failure' : null);
  if (patch.page !== undefined) set('page', patch.page > 1 ? String(patch.page) : null);
  return next;
}

/** "27 Oct 21:16" in UTC; the year is added when it is not the current one. */
export function formatActionTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const year = date.getUTCFullYear() === now.getUTCFullYear() ? '' : ` ${date.getUTCFullYear()}`;
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}${year} ${hh}:${mm}`;
}

/** "16 May 2026" in UTC. */
export function formatActionDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function valueText(value: JsonValue): string {
  if (value === null) return '—';
  if (typeof value === 'number') return value.toLocaleString('en-US');
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.length === 0 ? 'none' : value.map(valueText).join(', ');
  const entries = Object.entries(value);
  return entries.length === 0 ? '—' : entries.map(([key, inner]) => `${key} ${valueText(inner)}`).join(' · ');
}

/** The stored summary as label/value lines for the expanded row; nested values are flattened to one line. */
export function summaryRows(summary: JsonValue): { label: string; value: string }[] {
  if (summary === null || typeof summary !== 'object' || Array.isArray(summary)) {
    return summary === null ? [] : [{ label: 'summary', value: valueText(summary) }];
  }
  return Object.entries(summary).map(([label, value]) => ({ label, value: valueText(value) }));
}

/** Theme tone of an area tag. */
export const AREA_TONE: Readonly<Record<AdminActionArea, string>> = {
  cycles: 'bg-primary/15 text-primary',
  season: 'bg-warning/15 text-warning',
  automatons: 'bg-info/15 text-info',
  moderation: 'bg-error/15 text-error',
  players: 'bg-success/15 text-success',
  changelog: 'bg-white/10 text-white',
  other: 'bg-white/5 text-secondary',
};
