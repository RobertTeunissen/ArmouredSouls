/**
 * Season read queries backing the Season_API (Spec #45).
 *
 * Route handlers stay thin wrappers; every query with a join or an aggregate
 * lives here per the project coding standards.
 *
 * @module services/season/seasonQueryService
 */

import prisma from '../../lib/prisma';
import { SeasonError, SeasonErrorCode } from '../../errors';
import type {
  ArchivedStanding,
  ArchivedTeamMembership,
  ArchivedFacility,
} from '../../types';

/** One collapsed row of a stable's season history. */
export interface StableSeasonSummary {
  seasonNumber: number;
  isLegacy: boolean;
  competitiveCycles: number;
  finalCredits: number;
  prestigeEarned: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  championshipTitles: number;
  achievementsUnlocked: number;
  achievementsAvailable: number;
  robotCount: number;
  teamCount: number;
  bestTier: { tier: string; mode: string } | null;
}

/** Expanded detail for one archived season of one stable. */
export interface StableSeasonDetail extends StableSeasonSummary {
  stableName: string;
  highestElo: number;
  totalFame: number;
  facilities: ArchivedFacility[];
  achievementIds: string[];
  robots: Array<{
    robotName: string;
    imageUrl: string | null;
    frameId: number;
    paintJob: string | null;
    finalElo: number;
    fame: number;
    wins: number;
    losses: number;
    draws: number;
    totalBattles: number;
    damageDealtLifetime: number;
    damageTakenLifetime: number;
    kills: number;
    mainWeaponName: string | null;
    offhandWeaponName: string | null;
    standings: ArchivedStanding[];
    teams: ArchivedTeamMembership[];
  }>;
  accolades: Array<{
    category: string;
    rank: number;
    subjectName: string;
    value: number;
    valueLabel: string;
    mode: string | null;
  }>;
}

/** Tier ordering, weakest first, for "best tier reached". */
const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'];

/** Highest tier across a robot's archived standings. */
function bestTierOf(
  robots: Array<{ standings: unknown }>,
): { tier: string; mode: string } | null {
  let best: { tier: string; mode: string } | null = null;
  let bestIndex = -1;
  for (const robot of robots) {
    const standings = robot.standings as unknown as ArchivedStanding[];
    for (const standing of standings ?? []) {
      const index = TIER_ORDER.indexOf(standing.tier);
      if (index > bestIndex) {
        bestIndex = index;
        best = { tier: standing.tier, mode: standing.mode };
      }
    }
  }
  return best;
}

/** Collapsed season history for one stable, newest season first. */
export async function getStableSeasonHistory(userId: number): Promise<StableSeasonSummary[]> {
  const archives = await prisma.stableSeasonArchive.findMany({
    where: { userId },
    orderBy: { seasonNumber: 'desc' },
    include: { robots: { select: { standings: true } } },
  });

  return archives.map((a) => ({
    seasonNumber: a.seasonNumber,
    // Season_Number 0 is the legacy marker — no stored flag (R24.7).
    isLegacy: a.seasonNumber === 0,
    competitiveCycles: a.competitiveCycles,
    finalCredits: a.finalCredits,
    prestigeEarned: a.prestigeEarned,
    wins: a.wins,
    losses: a.losses,
    draws: a.draws,
    winRate: a.winRate,
    championshipTitles: a.championshipTitles,
    achievementsUnlocked: a.achievementsUnlocked,
    achievementsAvailable: a.achievementsAvailable,
    robotCount: a.robotCount,
    teamCount: a.teamCount,
    bestTier: bestTierOf(a.robots),
  }));
}

/** Expanded detail for one stable's archived season. */
export async function getStableSeasonDetail(
  userId: number,
  seasonNumber: number,
): Promise<StableSeasonDetail> {
  const archive = await prisma.stableSeasonArchive.findUnique({
    where: { seasonNumber_userId: { seasonNumber, userId } },
    include: { robots: true },
  });

  if (!archive) {
    throw new SeasonError(
      SeasonErrorCode.SEASON_NOT_FOUND,
      `No archived season ${seasonNumber} for this stable`,
      404,
    );
  }

  const accolades = await prisma.seasonAccolade.findMany({
    where: { seasonNumber, userId },
    orderBy: [{ category: 'asc' }, { rank: 'asc' }],
  });

  return {
    seasonNumber: archive.seasonNumber,
    isLegacy: archive.seasonNumber === 0,
    competitiveCycles: archive.competitiveCycles,
    stableName: archive.stableName,
    finalCredits: archive.finalCredits,
    prestigeEarned: archive.prestigeEarned,
    wins: archive.wins,
    losses: archive.losses,
    draws: archive.draws,
    winRate: archive.winRate,
    highestElo: archive.highestElo,
    totalFame: archive.totalFame,
    championshipTitles: archive.championshipTitles,
    achievementsUnlocked: archive.achievementsUnlocked,
    achievementsAvailable: archive.achievementsAvailable,
    achievementIds: archive.achievementIds as unknown as string[],
    facilities: archive.facilities as unknown as ArchivedFacility[],
    robotCount: archive.robotCount,
    teamCount: archive.teamCount,
    bestTier: bestTierOf(archive.robots),
    robots: archive.robots.map((r) => ({
      robotName: r.robotName,
      imageUrl: r.imageUrl,
      frameId: r.frameId,
      paintJob: r.paintJob,
      finalElo: r.finalElo,
      fame: r.fame,
      wins: r.wins,
      losses: r.losses,
      draws: r.draws,
      totalBattles: r.totalBattles,
      damageDealtLifetime: r.damageDealtLifetime,
      damageTakenLifetime: r.damageTakenLifetime,
      kills: r.kills,
      mainWeaponName: r.mainWeaponName,
      offhandWeaponName: r.offhandWeaponName,
      standings: r.standings as unknown as ArchivedStanding[],
      teams: r.teams as unknown as ArchivedTeamMembership[],
    })),
    accolades: accolades.map((a) => ({
      category: a.category,
      rank: a.rank,
      subjectName: a.subjectName,
      value: a.value,
      valueLabel: a.valueLabel,
      mode: a.mode,
    })),
  };
}

/** One entry in the global season list. */
export interface SeasonListEntry {
  seasonNumber: number;
  isLegacy: boolean;
  competitiveCycles: number;
  startedAt: Date;
  endedAt: Date | null;
  humanStableCount: number;
  generatedStableCount: number;
}

/** Every completed season, newest first. */
export async function listSeasonsForBrowsing(): Promise<SeasonListEntry[]> {
  const seasons = await prisma.season.findMany({
    where: { phase: 'completed' },
    orderBy: { seasonNumber: 'desc' },
    include: { _count: { select: { stableArchives: true } } },
  });

  return seasons.map((s) => ({
    seasonNumber: s.seasonNumber,
    isLegacy: s.seasonNumber === 0,
    competitiveCycles: s.competitiveCyclesCompleted,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    humanStableCount: s._count.stableArchives,
    generatedStableCount: s.generatedStableCount,
  }));
}

/** Final standings, champions, and accolades of one completed season. */
export async function getSeasonDetail(seasonNumber: number) {
  const season = await prisma.season.findUnique({ where: { seasonNumber } });
  if (!season || season.phase !== 'completed') {
    throw new SeasonError(
      SeasonErrorCode.SEASON_NOT_FOUND,
      `Season ${seasonNumber} has not completed`,
      404,
    );
  }

  const [snapshots, accolades, stableCount] = await Promise.all([
    prisma.seasonStandingSnapshot.findMany({
      where: { seasonNumber },
      orderBy: [{ mode: 'asc' }, { tier: 'asc' }, { leagueInstanceId: 'asc' }, { instanceRank: 'asc' }],
    }),
    prisma.seasonAccolade.findMany({
      where: { seasonNumber },
      orderBy: [{ category: 'asc' }, { rank: 'asc' }],
    }),
    prisma.stableSeasonArchive.count({ where: { seasonNumber } }),
  ]);

  // Group standings by mode so the page can render one section per mode.
  const byMode = new Map<string, typeof snapshots>();
  for (const row of snapshots) {
    const bucket = byMode.get(row.mode);
    if (bucket) bucket.push(row);
    else byMode.set(row.mode, [row]);
  }

  return {
    seasonNumber: season.seasonNumber,
    isLegacy: season.seasonNumber === 0,
    competitiveCycles: season.competitiveCyclesCompleted,
    startedAt: season.startedAt,
    endedAt: season.endedAt,
    humanStableCount: stableCount,
    generatedStableCount: season.generatedStableCount,
    standingsByMode: Object.fromEntries(
      [...byMode.entries()].map(([mode, rows]) => [
        mode,
        rows.map((r) => ({
          tier: r.tier,
          leagueInstanceId: r.leagueInstanceId,
          instanceRank: r.instanceRank,
          entityType: r.entityType,
          entityName: r.entityName,
          stableName: r.stableName,
          leaguePoints: r.leaguePoints,
          wins: r.wins,
          losses: r.losses,
          draws: r.draws,
          isGeneratedSubject: r.isGeneratedSubject,
        })),
      ]),
    ),
    accolades: accolades.map((a) => ({
      category: a.category,
      rank: a.rank,
      subjectName: a.subjectName,
      stableName: a.stableName,
      value: a.value,
      valueLabel: a.valueLabel,
      mode: a.mode,
      isGeneratedSubject: a.isGeneratedSubject,
    })),
  };
}

/**
 * Whether a completed archive exists for a user with a season number above
 * their last-seen marker — drives the Season_Summary_Modal.
 */
export async function getUnseenSeasonSummary(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastSeenSeasonNumber: true },
  });
  if (!user) return null;

  const archive = await prisma.stableSeasonArchive.findFirst({
    where: { userId, seasonNumber: { gt: user.lastSeenSeasonNumber } },
    orderBy: { seasonNumber: 'desc' },
    include: { robots: { select: { standings: true } } },
  });
  if (!archive) return null;

  const accolades = await prisma.seasonAccolade.findMany({
    where: { seasonNumber: archive.seasonNumber, userId },
    orderBy: [{ rank: 'asc' }],
    take: 3,
  });

  return {
    seasonNumber: archive.seasonNumber,
    isLegacy: archive.seasonNumber === 0,
    finalCredits: archive.finalCredits,
    prestigeEarned: archive.prestigeEarned,
    wins: archive.wins,
    losses: archive.losses,
    draws: archive.draws,
    achievementsUnlocked: archive.achievementsUnlocked,
    achievementsAvailable: archive.achievementsAvailable,
    bestTier: bestTierOf(archive.robots),
    accolades: accolades.map((a) => ({
      category: a.category,
      rank: a.rank,
      subjectName: a.subjectName,
      valueLabel: a.valueLabel,
      value: a.value,
    })),
  };
}

/** Record that the user has seen the summary for a season. */
export async function markSeasonSummarySeen(userId: number, seasonNumber: number): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { lastSeenSeasonNumber: seasonNumber },
  });
}
