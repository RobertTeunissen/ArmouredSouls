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
import { LeagueError, LeagueErrorCode } from '../../errors/leagueErrors';

// --- Types ---

export type EntityType = 'robot' | 'tag_team';
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
 */
export async function getCurrentCycleNumber(): Promise<number> {
  const meta = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
  return meta?.totalCycles ?? 0;
}

// --- Service Functions ---

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
  pagination: { page: number; perPage: number; total: number; totalPages: number };
}> {
  const { startCycle, endCycle, entityType, page = 1, perPage = 50 } = params;

  if (startCycle > endCycle) {
    throw new LeagueError(
      LeagueErrorCode.INVALID_LEAGUE_TIER,
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

  return {
    data: data as LeagueHistoryRecord[],
    pagination: {
      page,
      perPage,
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

  return records as LeagueHistoryRecord[];
}

/**
 * Get aggregate promotion/demotion counts grouped by tier for a cycle range.
 * Validates that startCycle <= endCycle.
 */
export async function getAggregates(startCycle: number, endCycle: number, entityType?: EntityType): Promise<AggregateResult[]> {
  if (startCycle > endCycle) {
    throw new LeagueError(
      LeagueErrorCode.INVALID_LEAGUE_TIER,
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

  // Get all records in the range and compute aggregates
  const records = await prisma.leagueHistory.findMany({
    where,
    select: {
      destinationTier: true,
      changeType: true,
    },
  });

  // Group by destination tier and count promotions/demotions
  const tierMap = new Map<string, { promotions: number; demotions: number }>();

  for (const record of records) {
    const tier = record.destinationTier;
    if (!tierMap.has(tier)) {
      tierMap.set(tier, { promotions: 0, demotions: 0 });
    }
    const entry = tierMap.get(tier)!;
    if (record.changeType === 'promotion') {
      entry.promotions++;
    } else {
      entry.demotions++;
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

  // Resolve entity names
  const results: YoYoCandidate[] = [];
  for (const candidate of candidates) {
    let entityName = `Unknown ${candidate.entityType} #${candidate.entityId}`;

    if (candidate.entityType === 'robot') {
      const robot = await prisma.robot.findUnique({
        where: { id: candidate.entityId },
        select: { name: true },
      });
      if (robot) {
        entityName = robot.name;
      }
    } else if (candidate.entityType === 'tag_team') {
      const tagTeam = await prisma.tagTeam.findUnique({
        where: { id: candidate.entityId },
        include: { activeRobot: { select: { name: true } }, reserveRobot: { select: { name: true } } },
      });
      if (tagTeam) {
        entityName = `${tagTeam.activeRobot.name} & ${tagTeam.reserveRobot.name}`;
      }
    }

    results.push({
      entityType: candidate.entityType,
      entityId: candidate.entityId,
      entityName,
      changeCount: candidate.count,
      tiersInvolved: candidate.tiers,
    });
  }

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
