/**
 * Standings Service
 *
 * Manages competitive standings across all modes with a single unified algorithm.
 * Uses a mode-agnostic LP update approach — no mode-specific branching for LP math.
 * Handles win/loss/draw recording, streak tracking, and LP floor enforcement.
 *
 * @module services/standings/standingsService
 */

import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { StandingsMode, Standing } from '../../../generated/prisma';

// --- Types ---

export interface RecordBattleResultParams {
  entityType: 'robot' | 'team';
  entityId: number;
  mode: StandingsMode;
  outcome: 'win' | 'loss' | 'draw';
  lpDelta: number; // Signed delta to apply to leaguePoints
}

// --- Helper Functions ---

/**
 * Returns the existing standing for the given entity/mode combination,
 * or creates a default one if none exists yet.
 *
 * @param entityType - 'robot' or 'team'
 * @param entityId - The ID of the robot or team
 * @param mode - The standings mode (e.g., league_1v1, koth, tournament_2v2)
 * @returns The existing or newly created Standing record
 */
export async function getOrCreateStanding(
  entityType: 'robot' | 'team',
  entityId: number,
  mode: StandingsMode,
): Promise<Standing> {
  const existing = await prisma.standing.findUnique({
    where: {
      entityType_entityId_mode: { entityType, entityId, mode },
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.standing.create({
    data: {
      entityType,
      entityId,
      mode,
      tier: 'bronze',
      leagueInstanceId: 'bronze_1',
      leaguePoints: 0,
      cyclesInTier: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      currentWinStreak: 0,
      bestWinStreak: 0,
      currentLoseStreak: 0,
    },
  });
}

/**
 * Builds the Prisma upsert data for a win outcome.
 */
function buildWinUpdate(current: Standing, lpDelta: number) {
  const newWinStreak = current.currentWinStreak + 1;
  const newBestWinStreak = Math.max(current.bestWinStreak, newWinStreak);
  const newLP = Math.max(0, current.leaguePoints + lpDelta);

  return {
    wins: current.wins + 1,
    currentWinStreak: newWinStreak,
    bestWinStreak: newBestWinStreak,
    currentLoseStreak: 0,
    leaguePoints: newLP,
  };
}

/**
 * Builds the Prisma upsert data for a loss outcome.
 */
function buildLossUpdate(current: Standing, lpDelta: number) {
  const newLP = Math.max(0, current.leaguePoints + lpDelta);

  return {
    losses: current.losses + 1,
    currentLoseStreak: current.currentLoseStreak + 1,
    currentWinStreak: 0,
    leaguePoints: newLP,
  };
}

/**
 * Builds the Prisma upsert data for a draw outcome.
 */
function buildDrawUpdate(current: Standing, lpDelta: number) {
  const newLP = Math.max(0, current.leaguePoints + lpDelta);

  return {
    draws: current.draws + 1,
    currentWinStreak: 0,
    currentLoseStreak: 0,
    leaguePoints: newLP,
  };
}

// --- Service Functions ---

/**
 * Records a battle result by updating the standing for the given entity and mode.
 *
 * Uses a single unified algorithm for all modes:
 * - Win: increment wins + currentWinStreak, reset currentLoseStreak, update bestWinStreak if exceeded, LP = max(0, LP + lpDelta)
 * - Loss: increment losses + currentLoseStreak, reset currentWinStreak, LP = max(0, LP + lpDelta)
 * - Draw: increment draws, reset both streaks, LP = max(0, LP + lpDelta)
 *
 * @param params - The battle result parameters
 * @returns The updated Standing record
 */
async function recordBattleResult(params: RecordBattleResultParams): Promise<Standing> {
  const { entityType, entityId, mode, outcome, lpDelta } = params;

  // Get or create the current standing to compute new values
  const current = await getOrCreateStanding(entityType, entityId, mode);

  let updateData: Record<string, number>;

  switch (outcome) {
    case 'win':
      updateData = buildWinUpdate(current, lpDelta);
      break;
    case 'loss':
      updateData = buildLossUpdate(current, lpDelta);
      break;
    case 'draw':
      updateData = buildDrawUpdate(current, lpDelta);
      break;
  }

  const updated = await prisma.standing.upsert({
    where: {
      entityType_entityId_mode: { entityType, entityId, mode },
    },
    update: updateData,
    create: {
      entityType,
      entityId,
      mode,
      tier: 'bronze',
      leagueInstanceId: 'bronze_1',
      leaguePoints: Math.max(0, lpDelta),
      cyclesInTier: 0,
      wins: outcome === 'win' ? 1 : 0,
      losses: outcome === 'loss' ? 1 : 0,
      draws: outcome === 'draw' ? 1 : 0,
      currentWinStreak: outcome === 'win' ? 1 : 0,
      bestWinStreak: outcome === 'win' ? 1 : 0,
      currentLoseStreak: outcome === 'loss' ? 1 : 0,
    },
  });

  logger.debug(
    `[Standings] Recorded ${outcome} for ${entityType} ${entityId} in ${mode}: LP ${current.leaguePoints} → ${updated.leaguePoints} (delta: ${lpDelta})`,
  );

  return updated;
}

// --- KotH Point Award ---

export interface AwardKothPointsParams {
  robotId: number;
  placement: number; // 1-6 (1st place = best)
  totalParticipants: number; // 5 or 6 typically
  kills: number;
  zoneScore: number;
  zoneTime: number;
}

/** Point scale for KotH placements (1st through 6th). */
export const KOTH_POINT_SCALE = [10, 6, 4, 2, 1, 0];

/**
 * Awards KotH points to a robot based on their placement using an F1-style point scale.
 * Updates cumulative stats (kills, zone score, zone time, best placement) and streak tracking.
 *
 * @param params - KotH result parameters
 * @returns The updated Standing record
 */
async function awardKothPoints(params: AwardKothPointsParams): Promise<Standing> {
  const { robotId, placement, kills, zoneScore, zoneTime } = params;

  // Determine points from F1-style scale (0 if placement exceeds scale length)
  const points = placement <= KOTH_POINT_SCALE.length ? KOTH_POINT_SCALE[placement - 1] : 0;

  // Get or create the KotH standing for this robot
  const current = await getOrCreateStanding('robot', robotId, 'koth');

  // Compute new cumulative values
  const newLeaguePoints = current.leaguePoints + points;
  const newTotalMatches = (current.totalMatches ?? 0) + 1;
  const newTotalKills = (current.totalKills ?? 0) + kills;
  const newTotalZoneScore = (current.totalZoneScore ?? 0) + zoneScore;
  const newTotalZoneTime = (current.totalZoneTime ?? 0) + zoneTime;
  const newBestPlacement =
    current.bestPlacement === null ? placement : Math.min(current.bestPlacement, placement);

  // Build update data
  const updateData: Record<string, number> = {
    leaguePoints: newLeaguePoints,
    totalMatches: newTotalMatches,
    totalKills: newTotalKills,
    totalZoneScore: newTotalZoneScore,
    totalZoneTime: newTotalZoneTime,
    bestPlacement: newBestPlacement,
  };

  // 1st place counts as a "win" — update wins and streak
  if (placement === 1) {
    const newWinStreak = current.currentWinStreak + 1;
    updateData.wins = current.wins + 1;
    updateData.currentWinStreak = newWinStreak;
    updateData.bestWinStreak = Math.max(current.bestWinStreak, newWinStreak);
    updateData.currentLoseStreak = 0;
  }
  // Non-1st placements don't affect streaks

  const updated = await prisma.standing.update({
    where: {
      entityType_entityId_mode: { entityType: 'robot', entityId: robotId, mode: 'koth' },
    },
    data: updateData,
  });

  logger.debug(
    `[Standings] KotH award for robot ${robotId}: placement ${placement}, +${points} LP (${current.leaguePoints} → ${updated.leaguePoints})`,
  );

  return updated;
}

// --- Query Functions ---

export interface GetStandingsOptions {
  leagueInstanceId?: string;
  tier?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedStandings {
  standings: Standing[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Returns standings for a given mode, sorted by leaguePoints descending.
 * Supports optional filtering by leagueInstanceId and tier, plus pagination.
 *
 * @param mode - The standings mode to query
 * @param options - Optional filters and pagination settings
 * @returns Paginated standings with metadata
 */
async function getStandings(
  mode: StandingsMode,
  options?: GetStandingsOptions,
): Promise<PaginatedStandings> {
  const page = options?.page ?? 1;
  const limit = options?.limit ?? 50;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { mode };
  if (options?.leagueInstanceId) {
    where.leagueInstanceId = options.leagueInstanceId;
  }
  if (options?.tier) {
    where.tier = options.tier;
  }

  const [standings, total] = await Promise.all([
    prisma.standing.findMany({
      where,
      orderBy: { leaguePoints: 'desc' },
      skip,
      take: limit,
    }),
    prisma.standing.count({ where }),
  ]);

  return {
    standings,
    pagination: {
      page,
      pageSize: limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Returns all standings for a single entity (robot or team) across all modes.
 * Useful for detail pages showing league + KotH + tag team standings in one call.
 *
 * @param entityType - 'robot' or 'team'
 * @param entityId - The ID of the robot or team
 * @returns Array of all Standing records for this entity
 */
async function getEntityStandings(
  entityType: 'robot' | 'team',
  entityId: number,
): Promise<Standing[]> {
  return prisma.standing.findMany({
    where: { entityType, entityId },
    orderBy: { mode: 'asc' },
  });
}

// --- Exported Singleton ---

const standingsService = {
  recordBattleResult,
  getOrCreateStanding,
  awardKothPoints,
  getStandings,
  getEntityStandings,
};

export default standingsService;
