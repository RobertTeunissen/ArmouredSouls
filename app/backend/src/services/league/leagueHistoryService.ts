/**
 * League History Service
 *
 * Provides persistent tracking of all league tier changes (promotions and demotions)
 * for both robots and tag teams. Recording is non-blocking — failures are logged
 * but never prevent the promotion/demotion from completing.
 *
 * @module services/league/leagueHistoryService
 */

import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { AppError } from '../../errors';

// --- Types ---

export type EntityType = 'robot' | 'tag_team' | 'team_battle';
export type ChangeType = 'promotion' | 'demotion';

export interface RecordTierChangeParams {
  entityType: EntityType;
  entityId: number;
  userId: number;
  changeType: ChangeType;
  sourceTier: string;
  destinationTier: string;
  sourceLeagueId: string;
  destinationLeagueId: string;
  leaguePoints: number;
  cycleNumber: number;
}

export interface LeagueHistoryRecord {
  id: number;
  entityType: EntityType;
  entityId: number;
  userId: number;
  changeType: ChangeType;
  sourceTier: string;
  destinationTier: string;
  sourceLeagueId: string;
  destinationLeagueId: string;
  leaguePoints: number;
  cycleNumber: number;
  createdAt: Date;
  /** Robot name, or "<active> & <reserve>" for tag teams. Populated by query helpers. */
  entityName?: string;
  /** Owner's stableName (falls back to username). Populated by query helpers. */
  stableName?: string;
}

export interface LeagueHistoryQueryParams {
  startCycle: number;
  endCycle: number;
  entityType?: EntityType;
  page?: number;
  perPage?: number;
}

export interface AggregateResult {
  tier: string;
  promotions: number;
  demotions: number;
}

export interface YoYoCandidate {
  entityType: EntityType;
  entityId: number;
  entityName: string;
  changeCount: number;
  tiersInvolved: string[];
}

export interface CtrlZResult {
  found: boolean;
  demotionCycle?: number;
  promotionCycle?: number;
}

// --- Helper Functions ---

/**
 * Reads the current cycle number from CycleMetadata.
 * Returns 0 if no metadata row exists.
 * Uses a short-lived cache to avoid repeated DB reads during a rebalance run.
 */
let cachedCycleNumber: number | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5000; // 5 seconds — covers a full rebalance run

export async function getCurrentCycleNumber(): Promise<number> {
  const now = Date.now();
  if (cachedCycleNumber !== null && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedCycleNumber;
  }
  const meta = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
  cachedCycleNumber = meta?.totalCycles ?? 0;
  cacheTimestamp = now;
  return cachedCycleNumber;
}

// --- Service Functions ---

/**
 * Batch-enrich raw league history records with entity names (robot name or
 * "<active> & <reserve>" for tag teams) and the owner's stable name.
 * Avoids N+1 queries by collecting all IDs first and issuing one findMany
 * per entity type.
 */
async function enrichWithNames(
  records: LeagueHistoryRecord[],
): Promise<LeagueHistoryRecord[]> {
  if (records.length === 0) return records;

  const robotIds = new Set<number>();
  const tagTeamIds = new Set<number>();
  const userIds = new Set<number>();

  for (const r of records) {
    userIds.add(r.userId);
    if (r.entityType === 'robot') robotIds.add(r.entityId);
    else if (r.entityType === 'tag_team') tagTeamIds.add(r.entityId);
  }

  const [robots, tagTeams, users] = await Promise.all([
    robotIds.size > 0
      ? prisma.robot.findMany({
          where: { id: { in: Array.from(robotIds) } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    tagTeamIds.size > 0
      ? prisma.teamBattle.findMany({
          where: { id: { in: Array.from(tagTeamIds) } },
          select: {
            id: true,
            teamName: true,
          },
        })
      : Promise.resolve([]),
    userIds.size > 0
      ? prisma.user.findMany({
          where: { id: { in: Array.from(userIds) } },
          select: { id: true, username: true, stableName: true },
        })
      : Promise.resolve([]),
  ]);

  const robotNameMap = new Map(robots.map(r => [r.id, r.name]));
  const tagTeamNameMap = new Map(
    tagTeams.map(t => [t.id, t.teamName]),
  );
  const stableNameMap = new Map(
    users.map(u => [u.id, u.stableName || u.username]),
  );

  return records.map(r => ({
    ...r,
    entityName:
      r.entityType === 'robot'
        ? robotNameMap.get(r.entityId)
        : tagTeamNameMap.get(r.entityId),
    stableName: stableNameMap.get(r.userId),
  }));
}

/**
 * Record a tier change event. Non-blocking — logs errors, never throws.
 */
export async function recordTierChange(params: RecordTierChangeParams): Promise<void> {
  try {
    await prisma.leagueHistory.create({
      data: {
        entityType: params.entityType,
        entityId: params.entityId,
        userId: params.userId,
        changeType: params.changeType,
        sourceTier: params.sourceTier,
        destinationTier: params.destinationTier,
        sourceLeagueId: params.sourceLeagueId,
        destinationLeagueId: params.destinationLeagueId,
        leaguePoints: params.leaguePoints,
        cycleNumber: params.cycleNumber,
      },
    });
  } catch (error) {
    logger.error(`[LeagueHistory] Failed to record tier change for ${params.entityType} ${params.entityId}: ${error}`);
  }
}

/**
 * Query tier changes within a cycle range, with pagination.
 * Validates that startCycle <= endCycle.
 */
export async function getHistoryByCycleRange(params: LeagueHistoryQueryParams): Promise<{
  data: LeagueHistoryRecord[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}> {
  const { startCycle, endCycle, entityType, page = 1, perPage = 50 } = params;

  if (startCycle > endCycle) {
    throw new AppError(
      'INVALID_CYCLE_RANGE',
      `Invalid cycle range: startCycle (${startCycle}) must be less than or equal to endCycle (${endCycle})`,
      400,
    );
  }

  const where: Record<string, unknown> = {
    cycleNumber: { gte: startCycle, lte: endCycle },
  };
  if (entityType) {
    where.entityType = entityType;
  }

  const [data, total] = await Promise.all([
    prisma.leagueHistory.findMany({
      where,
      orderBy: { cycleNumber: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.leagueHistory.count({ where }),
  ]);

  const enriched = await enrichWithNames(data as LeagueHistoryRecord[]);

  return {
    data: enriched,
    pagination: {
      page,
      pageSize: perPage,
      total,
      totalPages: Math.ceil(total / perPage),
    },
  };
}

/**
 * Get complete history for a specific entity, ordered by cycle ascending.
 */
export async function getEntityHistory(entityType: EntityType, entityId: number): Promise<LeagueHistoryRecord[]> {
  const records = await prisma.leagueHistory.findMany({
    where: { entityType, entityId },
    orderBy: { cycleNumber: 'asc' },
  });

  return enrichWithNames(records as LeagueHistoryRecord[]);
}

/**
 * Get aggregate promotion/demotion counts grouped by tier for a cycle range.
 * Validates that startCycle <= endCycle.
 * Uses Prisma groupBy to push aggregation to the database.
 */
export async function getAggregates(startCycle: number, endCycle: number, entityType?: EntityType): Promise<AggregateResult[]> {
  if (startCycle > endCycle) {
    throw new AppError(
      'INVALID_CYCLE_RANGE',
      `Invalid cycle range: startCycle (${startCycle}) must be less than or equal to endCycle (${endCycle})`,
      400,
    );
  }

  const where: Record<string, unknown> = {
    cycleNumber: { gte: startCycle, lte: endCycle },
  };
  if (entityType) {
    where.entityType = entityType;
  }

  // Use Prisma groupBy to push aggregation to the database
  const grouped = await prisma.leagueHistory.groupBy({
    by: ['destinationTier', 'changeType'],
    where,
    _count: { id: true },
  });

  // Merge into per-tier results
  const tierMap = new Map<string, { promotions: number; demotions: number }>();
  for (const row of grouped) {
    if (!tierMap.has(row.destinationTier)) {
      tierMap.set(row.destinationTier, { promotions: 0, demotions: 0 });
    }
    const entry = tierMap.get(row.destinationTier)!;
    if (row.changeType === 'promotion') {
      entry.promotions = row._count.id;
    } else {
      entry.demotions = row._count.id;
    }
  }

  const results: AggregateResult[] = [];
  for (const [tier, counts] of tierMap) {
    results.push({ tier, ...counts });
  }

  return results;
}

/**
 * Identify yo-yo candidates: entities with minChanges or more tier changes
 * within the last cycleWindow cycles from the current cycle.
 */
export async function detectYoYoCandidates(cycleWindow = 20, minChanges = 3): Promise<YoYoCandidate[]> {
  const currentCycle = await getCurrentCycleNumber();
  const startCycle = Math.max(0, currentCycle - cycleWindow);

  // Get all records within the window, grouped by entity
  const records = await prisma.leagueHistory.findMany({
    where: {
      cycleNumber: { gte: startCycle, lte: currentCycle },
    },
    select: {
      entityType: true,
      entityId: true,
      destinationTier: true,
      sourceTier: true,
    },
  });

  // Group by entityType + entityId
  const entityGroups = new Map<string, {
    entityType: EntityType;
    entityId: number;
    tiers: Set<string>;
    count: number;
  }>();

  for (const record of records) {
    const key = `${record.entityType}:${record.entityId}`;
    if (!entityGroups.has(key)) {
      entityGroups.set(key, {
        entityType: record.entityType as EntityType,
        entityId: record.entityId,
        tiers: new Set<string>(),
        count: 0,
      });
    }
    const group = entityGroups.get(key)!;
    group.count++;
    group.tiers.add(record.sourceTier);
    group.tiers.add(record.destinationTier);
  }

  // Filter groups with count >= minChanges
  const candidates: { entityType: EntityType; entityId: number; tiers: string[]; count: number }[] = [];
  for (const group of entityGroups.values()) {
    if (group.count >= minChanges) {
      candidates.push({
        entityType: group.entityType,
        entityId: group.entityId,
        tiers: Array.from(group.tiers),
        count: group.count,
      });
    }
  }

  // Batch-resolve entity names to avoid N+1 queries
  const robotIds = candidates.filter(c => c.entityType === 'robot').map(c => c.entityId);
  const tagTeamIds = candidates.filter(c => c.entityType === 'tag_team').map(c => c.entityId);

  const [robots, tagTeams] = await Promise.all([
    robotIds.length > 0
      ? prisma.robot.findMany({ where: { id: { in: robotIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
    tagTeamIds.length > 0
      ? prisma.teamBattle.findMany({
          where: { id: { in: tagTeamIds } },
          select: { id: true, teamName: true },
        })
      : Promise.resolve([]),
  ]);

  const robotNameMap = new Map(robots.map(r => [r.id, r.name]));
  const tagTeamNameMap = new Map(tagTeams.map(t => [t.id, t.teamName]));

  const results: YoYoCandidate[] = candidates.map(candidate => ({
    entityType: candidate.entityType,
    entityId: candidate.entityId,
    entityName: candidate.entityType === 'robot'
      ? robotNameMap.get(candidate.entityId) || `Unknown robot #${candidate.entityId}`
      : tagTeamNameMap.get(candidate.entityId) || `Unknown tag team #${candidate.entityId}`,
    changeCount: candidate.count,
    tiersInvolved: candidate.tiers,
  }));

  return results;
}

/**
 * Check if a robot experienced a Ctrl+Z pattern: demoted from a tier
 * then re-promoted to the same tier within maxCycleWindow cycles.
 */
export async function checkCtrlZ(robotId: number, tierName: string, maxCycleWindow: number): Promise<CtrlZResult> {
  // Find the most recent demotion FROM the specified tier for this robot
  const demotion = await prisma.leagueHistory.findFirst({
    where: {
      entityType: 'robot',
      entityId: robotId,
      changeType: 'demotion',
      sourceTier: tierName,
    },
    orderBy: { cycleNumber: 'desc' },
  });

  if (!demotion) {
    return { found: false };
  }

  // Find any promotion TO the same tier that occurred after the demotion
  // and within the maxCycleWindow
  const promotion = await prisma.leagueHistory.findFirst({
    where: {
      entityType: 'robot',
      entityId: robotId,
      changeType: 'promotion',
      destinationTier: tierName,
      cycleNumber: {
        gt: demotion.cycleNumber,
        lte: demotion.cycleNumber + maxCycleWindow,
      },
    },
    orderBy: { cycleNumber: 'asc' },
  });

  if (!promotion) {
    return { found: false };
  }

  return {
    found: true,
    demotionCycle: demotion.cycleNumber,
    promotionCycle: promotion.cycleNumber,
  };
}
