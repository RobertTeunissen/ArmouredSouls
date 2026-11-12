/**
 * Typed API of the admin Actions page (`/admin/actions`).
 * The response shapes are wire contracts in `@shared/types` (admin-actions.ts).
 */
import { api } from './api';
import type { AdminActionArea, AdminActionResultFilter, AdminActionsPage } from '@shared/types';

export const ADMIN_ACTION_AREAS = ['cycles', 'season', 'automatons', 'moderation', 'players', 'changelog', 'other'] as const;
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

export interface AdminActionsFilters {
  area: AdminActionArea | null;
  result: AdminActionResultFilter;
  page: number;
}

export const ADMIN_ACTIONS_PAGE_SIZE = 50;

export const getAdminActions = (query: AdminActionsFilters, options: { signal?: AbortSignal } = {}): Promise<AdminActionsPage> =>
  api.get<AdminActionsPage>('/api/admin/actions', {
    params: {
      ...(query.area ? { area: query.area } : {}),
      ...(query.result === 'failure' ? { result: 'failure' } : {}),
      page: query.page,
      pageSize: ADMIN_ACTIONS_PAGE_SIZE,
    },
    signal: options.signal,
  });
