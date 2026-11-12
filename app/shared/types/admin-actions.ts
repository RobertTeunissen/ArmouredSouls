/**
 * Wire contract for the admin Actions page: `GET /api/admin/actions`
 * (backend `services/admin/admin-actions`).
 */

/** JSON as stored in an action record's summary. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type AdminActionArea = 'cycles' | 'season' | 'automatons' | 'moderation' | 'players' | 'changelog' | 'other';

export type AdminActionResultFilter = 'all' | 'failure';

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
  /** The stored summary, for the expanded row. */
  summary: JsonValue;
}

export interface AdminActionsPage {
  entries: AdminActionEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  /** Counts over every recorded action, whatever the filters. */
  counts: { all: number; failures: number; byArea: Record<AdminActionArea, number> };
  /** When the first recorded action happened, or null. */
  since: string | null;
}
