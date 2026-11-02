/**
 * Typed API of the admin Actions page (`/admin/actions`).
 * Mirrors `app/backend/src/services/admin/admin-actions/adminActionsService.ts`.
 */
import { api } from './api';

export const ADMIN_ACTION_AREAS = ['cycles', 'season', 'automatons', 'moderation', 'players', 'changelog', 'other'] as const;
export type AdminActionArea = (typeof ADMIN_ACTION_AREAS)[number];
export type AdminActionResultFilter = 'all' | 'failure';

export const ADMIN_ACTION_AREA_LABELS: Readonly<Record<AdminActionArea, string>> = {
  cycles: 'Cycles',
  season: 'Season',
  automatons: 'Automatons',
  moderation: 'Moderation',
  players: 'Players',
  changelog: 'Changelog',
  other: 'Other',
};

/** Page names of the links an action carries, for the expanded row. */
export const ADMIN_ACTION_LINK_LABELS: Readonly<Record<AdminActionArea, string>> = {
  cycles: 'Cycle Controls',
  season: 'Season Control',
  automatons: 'Automatons',
  moderation: 'Image Uploads',
  players: 'Players',
  changelog: 'Changelog',
  other: '',
};

/** JSON as stored in the record summary. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface AdminActionEntry {
  id: number;
  createdAt: string;
  operationType: string;
  result: 'success' | 'failure';
  area: AdminActionArea;
  title: string;
  details: string;
  link: string | null;
  admin: { userId: number; name: string };
  summary: JsonValue;
}

export interface AdminActionsPage {
  entries: AdminActionEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  counts: { all: number; failures: number; byArea: Record<AdminActionArea, number> };
  since: string | null;
}

export interface AdminActionsQuery {
  area: AdminActionArea | null;
  result: AdminActionResultFilter;
  page: number;
}

export const ADMIN_ACTIONS_PAGE_SIZE = 50;

export const getAdminActions = (query: AdminActionsQuery, options: { signal?: AbortSignal } = {}): Promise<AdminActionsPage> =>
  api.get<AdminActionsPage>('/api/admin/actions', {
    params: {
      ...(query.area ? { area: query.area } : {}),
      ...(query.result === 'failure' ? { result: 'failure' } : {}),
      page: query.page,
      pageSize: ADMIN_ACTIONS_PAGE_SIZE,
    },
    signal: options.signal,
  });
