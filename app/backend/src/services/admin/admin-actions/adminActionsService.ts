/**
 * The admin Actions page (`GET /api/admin/actions`): every recorded admin
 * action, newest first, filterable by area and result, with plain
 * descriptions and the admin's name. Reads `admin_audit_logs` (never trimmed;
 * not to be confused with `audit_logs`, the player event log). Read-only.
 */
import prisma from '../../../lib/prisma';
import type { Prisma } from '../../../../generated/prisma';
import { ADMIN_ACTION_AREAS, areaOf, describeAdminAction, type AdminActionArea } from './adminActionCatalogue';

export const ADMIN_ACTION_RESULTS = ['all', 'failure'] as const;
export type AdminActionResultFilter = (typeof ADMIN_ACTION_RESULTS)[number];

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
  summary: Prisma.JsonValue;
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

export interface AdminActionsQuery {
  area?: AdminActionArea;
  result?: AdminActionResultFilter;
  page?: number;
  pageSize?: number;
}

export async function getAdminActions(query: AdminActionsQuery = {}): Promise<AdminActionsPage> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 50;

  // Operation names are few (dozens), so the area filter is resolved against them in memory.
  const [byOperation, first] = await Promise.all([
    prisma.adminAuditLog.groupBy({ by: ['operationType', 'operationResult'], _count: { _all: true } }),
    prisma.adminAuditLog.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
  ]);
  const byArea = Object.fromEntries(ADMIN_ACTION_AREAS.map((area) => [area, 0])) as Record<AdminActionArea, number>;
  let all = 0;
  let failures = 0;
  for (const row of byOperation) {
    const n = row._count._all;
    byArea[areaOf(row.operationType)] += n;
    all += n;
    if (row.operationResult === 'failure') failures += n;
  }

  const where: Prisma.AdminAuditLogWhereInput = {};
  if (query.area) {
    const operations = [...new Set(byOperation.map((row) => row.operationType))].filter((op) => areaOf(op) === query.area);
    where.operationType = { in: operations };
  }
  if (query.result === 'failure') where.operationResult = 'failure';

  const [rows, total] = await Promise.all([
    prisma.adminAuditLog.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.adminAuditLog.count({ where }),
  ]);
  const adminIds = [...new Set(rows.map((row) => row.adminUserId))];
  const admins = adminIds.length
    ? await prisma.user.findMany({ where: { id: { in: adminIds } }, select: { id: true, username: true, stableName: true } })
    : [];
  const nameOf = new Map(admins.map((admin) => [admin.id, admin.stableName?.trim() || admin.username]));

  return {
    entries: rows.map((row) => {
      const described = describeAdminAction(row.operationType, row.operationResult, row.resultSummary);
      return {
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        operationType: row.operationType,
        result: row.operationResult === 'failure' ? 'failure' : 'success',
        ...described,
        admin: { userId: row.adminUserId, name: nameOf.get(row.adminUserId) ?? `Deleted user #${row.adminUserId}` },
        summary: row.resultSummary,
      };
    }),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    counts: { all, failures, byArea },
    since: first?.createdAt.toISOString() ?? null,
  };
}
