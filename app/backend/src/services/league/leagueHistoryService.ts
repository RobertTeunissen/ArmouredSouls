/**
 * League History Service
 *
 * Provides persistent tracking of all league tier changes (promotions and demotions)
 * for robots, tag teams, and simultaneous team-battle teams. Recording is
 * non-blocking — failures are logged but never prevent the promotion/demotion
 * from completing.
 *
 * @module services/league/leagueHistoryService
 */

import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { AppError } from '../../errors';

// --- Types ---

export const LEAGUE_HISTORY_MODES = [
  'league_1v1',
  'league_2v2',
  'league_3v3',
  'tag_team',
  'koth',
  'grand_melee',
] as const;

export type LeagueHistoryMode = typeof LEAGUE_HISTORY_MODES[number];
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
  mode?: string;
}

export interface LeagueHistoryRecord {
  id: number;
  entityType: EntityType;
  entityId: number;
  userId: number;
  changeType: ChangeType;
  mode?: string | null;
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
  mode?: LeagueHistoryMode;
  page?: number;
  perPage?: number;
}

export interface AggregateResult {
  mode: string | null;
  tier: string;
  promotions: number;
  demotions: number;
}

export interface YoYoCandidate {
  entityType: EntityType;
  entityId: number;
  entityName: string;
  mode: string | null;
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
 * Batch-enrich raw league history records with entity names and the owner's
 * stable name. Team-battle and tag-team records both reference TeamBattle IDs.
 * Avoids N+1 queries by collecting all IDs first and issuing one findMany per
 * entity model.
 */
async function enrichWithNames(
  records: LeagueHistoryRecord[],
): Promise<LeagueHistoryRecord[]> {
  if (records.length === 0) return records;

  const robotIds = new Set<number>();
  const teamIds = new Set<number>();
  const userIds = new Set<number>();

  for (const record of records) {
    userIds.add(record.userId);
    if (record.entityType === 'robot') robotIds.add(record.entityId);
    else teamIds.add(record.entityId);
  }

  const [robots, teams, users] = await Promise.all([
    robotIds.size > 0
      ? prisma.robot.findMany({
          where: { id: { in: Array.from(robotIds) } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    teamIds.size > 0
      ? prisma.teamBattle.findMany({
          where: { id: { in: Array.from(teamIds) } },
          select: { id: true, teamName: true },
        })
      : Promise.resolve([]),
    userIds.size > 0
      ? prisma.user.findMany({
          where: { id: { in: Array.from(userIds) } },
          select: { id: true, username: true, stableName: true },
        })
      : Promise.resolve([]),
  ]);

  const robotNameMap = new Map(robots.map(robot => [robot.id, robot.name]));
  const teamNameMap = new Map(teams.map(team => [team.id, team.teamName]));
  const stableNameMap = new Map(
    users.map(user => [user.id, user.stableName || user.username]),
  );

  return records.map(record => ({
    ...record,
    entityName: record.entityType === 'robot'
      ? robotNameMap.get(record.entityId)
      : teamNameMap.get(record.entityId),
    stableName: stableNameMap.get(record.userId),
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
        mode: params.mode ?? null,
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
  const { startCycle, endCycle, entityType, mode, page = 1, perPage = 50 } = params;

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
  if (mode) {
    where.mode = mode;
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
export async function getEntityHistory(
  entityType: EntityType,
  entityId: number,
  mode?: LeagueHistoryMode,
): Promise<LeagueHistoryRecord[]> {
  const records = await prisma.leagueHistory.findMany({
    where: { entityType, entityId, ...(mode ? { mode } : {}) },
    orderBy: { cycleNumber: 'asc' },
  });

  return enrichWithNames(records as LeagueHistoryRecord[]);
}

/**
 * Get aggregate promotion/demotion counts grouped by tier for a cycle range.
 * Validates that startCycle <= endCycle.
 * Uses Prisma groupBy to push aggregation to the database.
 */
export async function getAggregates(
  startCycle: number,
  endCycle: number,
  entityType?: EntityType,
  mode?: LeagueHistoryMode,
): Promise<AggregateResult[]> {
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
  if (entityType) where.entityType = entityType;
  if (mode) where.mode = mode;

  const grouped = await prisma.leagueHistory.groupBy({
    by: ['mode', 'destinationTier', 'changeType'],
    where,
    _count: { id: true },
  });

  const resultMap = new Map<string, AggregateResult>();
  for (const row of grouped) {
    const key = `${row.mode ?? 'legacy'}:${row.destinationTier}`;
    const result = resultMap.get(key) ?? {
      mode: row.mode,
      tier: row.destinationTier,
      promotions: 0,
      demotions: 0,
    };
    if (row.changeType === 'promotion') result.promotions = row._count.id;
    else result.demotions = row._count.id;
    resultMap.set(key, result);
  }

  return Array.from(resultMap.values());
}

/**
 * Identify yo-yo candidates: entities with minChanges or more tier changes
 * within the last cycleWindow cycles from the current cycle.
 */
export async function detectYoYoCandidates(
  cycleWindow = 20,
  minChanges = 3,
  mode?: LeagueHistoryMode,
): Promise<YoYoCandidate[]> {
  const currentCycle = await getCurrentCycleNumber();
  const startCycle = Math.max(0, currentCycle - cycleWindow);

  const records = await prisma.leagueHistory.findMany({
    where: {
      cycleNumber: { gte: startCycle, lte: currentCycle },
      ...(mode ? { mode } : {}),
    },
    select: {
      entityType: true,
      entityId: true,
      mode: true,
      destinationTier: true,
      sourceTier: true,
    },
  });

  interface EntityModeGroup {
    entityType: EntityType;
    entityId: number;
    mode: string | null;
    tiers: Set<string>;
    count: number;
  }

  const entityGroups = new Map<string, EntityModeGroup>();
  for (const record of records) {
    const key = `${record.entityType}:${record.entityId}:${record.mode ?? 'legacy'}`;
    const group = entityGroups.get(key) ?? {
      entityType: record.entityType as EntityType,
      entityId: record.entityId,
      mode: record.mode,
      tiers: new Set<string>(),
      count: 0,
    };
    group.count++;
    group.tiers.add(record.sourceTier);
    group.tiers.add(record.destinationTier);
    entityGroups.set(key, group);
  }

  const candidates = Array.from(entityGroups.values()).filter(
    group => group.count >= minChanges,
  );
  const robotIds = candidates
    .filter(candidate => candidate.entityType === 'robot')
    .map(candidate => candidate.entityId);
  const teamIds = candidates
    .filter(candidate => candidate.entityType !== 'robot')
    .map(candidate => candidate.entityId);

  const [robots, teams] = await Promise.all([
    robotIds.length > 0
      ? prisma.robot.findMany({
          where: { id: { in: robotIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    teamIds.length > 0
      ? prisma.teamBattle.findMany({
          where: { id: { in: teamIds } },
          select: { id: true, teamName: true },
        })
      : Promise.resolve([]),
  ]);

  const robotNameMap = new Map(robots.map(robot => [robot.id, robot.name]));
  const teamNameMap = new Map(teams.map(team => [team.id, team.teamName]));

  return candidates.map(candidate => ({
    entityType: candidate.entityType,
    entityId: candidate.entityId,
    entityName: candidate.entityType === 'robot'
      ? robotNameMap.get(candidate.entityId) || `Unknown robot #${candidate.entityId}`
      : teamNameMap.get(candidate.entityId)
        || `${candidate.entityType === 'tag_team' ? 'Unknown tag team' : 'Unknown team'} #${candidate.entityId}`,
    mode: candidate.mode,
    changeCount: candidate.count,
    tiersInvolved: Array.from(candidate.tiers),
  }));
}

/**
 * Check if a robot experienced a Ctrl+Z pattern: demoted from a tier
 * then re-promoted to the same tier within maxCycleWindow cycles.
 */
export async function checkCtrlZ(
  robotId: number,
  tierName: string,
  maxCycleWindow: number,
  mode: LeagueHistoryMode = 'league_1v1',
): Promise<CtrlZResult> {
  // Find the most recent demotion FROM the specified tier for this robot
  const demotion = await prisma.leagueHistory.findFirst({
    where: {
      entityType: 'robot',
      entityId: robotId,
      mode,
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
      mode,
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
