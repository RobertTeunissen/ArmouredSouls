/**
 * Season_Archive_Service (Spec #45).
 *
 * Writes the permanent record of a completed season before anything is
 * deleted. Four outputs:
 *
 *  - Stable_Season_Archive: one row per Human_Stable
 *  - Robot_Season_Archive:  one row per robot of a Human_Stable
 *  - Season_Standing_Snapshot: bounded final standings, bots included
 *  - Season_Accolade:       captured Hall of Records placements, bots included
 *
 * Generated_Stables get no per-stable or per-robot archive — they are competitive
 * filler with no player behind them — but they DO appear in the snapshot and
 * accolades, so a season's leagues and records stay truthful after those
 * stables are deleted.
 *
 * Every stored value is denormalized text or numbers. The only foreign keys are
 * `StableSeasonArchive.userId` and the internal archive link.
 *
 * @module services/season/seasonArchiveService
 */

import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { loadEnvConfig } from '../../config/env';
import type {
  ArchivedStanding,
  ArchivedTeamMembership,
  ArchivedTeamStanding,
  ArchivedFacility,
} from '../../types';
import {
  loadStandingsWithRanks,
  rankKey,
  entityKey,
  groupKey,
  orderStandings,
  type RankableStanding,
  type RankKey,
} from './instanceRank';

/** Batch size for archive writes — small enough that a crash loses little. */
const ARCHIVE_BATCH_SIZE = 50;

export interface ArchiveResult {
  stablesArchived: number;
  robotsArchived: number;
  snapshotRows: number;
  accoladeRows: number;
  generatedStableCount: number;
}

export interface ArchiveVerification {
  ok: boolean;
  expectedStables: number;
  actualStables: number;
  expectedRobots: number;
  actualRobots: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────

/** Stable display name, falling back to the username when unset. */
function stableDisplayName(user: { username: string; stableName: string | null }): string {
  return user.stableName ?? user.username;
}

// ─── Stage 1a: stable and robot archives ─────────────────────────────

/**
 * Write Stable_Season_Archive and Robot_Season_Archive rows for every
 * Human_Stable, in transactions of ARCHIVE_BATCH_SIZE users.
 */
export async function writeStableAndRobotArchives(
  seasonNumber: number,
  competitiveCycles: number,
  ranks: Map<RankKey, number>,
  standingsByEntity: Map<string, RankableStanding[]>,
): Promise<{ stablesArchived: number; robotsArchived: number }> {
  const achievementsAvailable = (await import('../../config/achievements')).ACHIEVEMENTS.length;

  const humanStables = await prisma.user.findMany({
    where: { isGenerated: false },
    select: { id: true, username: true, stableName: true, currency: true, prestige: true,
      championshipTitles: true, championshipTitles1v1: true,
      championshipTitles2v2: true, championshipTitles3v3: true },
    orderBy: { id: 'asc' },
  });

  let stablesArchived = 0;
  let robotsArchived = 0;

  for (let i = 0; i < humanStables.length; i += ARCHIVE_BATCH_SIZE) {
    const batch = humanStables.slice(i, i + ARCHIVE_BATCH_SIZE);
    const userIds = batch.map((u) => u.id);

    const [robots, facilities, achievements, teams] = await Promise.all([
      prisma.robot.findMany({
        where: { userId: { in: userIds } },
        include: {
          mainWeapon: { include: { weapon: { select: { name: true } } } },
          offhandWeapon: { include: { weapon: { select: { name: true } } } },
        },
      }),
      prisma.facility.findMany({ where: { userId: { in: userIds } } }),
      prisma.userAchievement.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, achievementId: true },
      }),
      prisma.teamBattle.findMany({
        where: { stableId: { in: userIds } },
        include: { members: { select: { robotId: true } } },
      }),
    ]);

    await prisma.$transaction(async (tx) => {
      for (const user of batch) {
        const userRobots = robots.filter((r) => r.userId === user.id);
        const userFacilities = facilities.filter((f) => f.userId === user.id);
        const userAchievements = achievements.filter((a) => a.userId === user.id);
        const userTeams = teams.filter((t) => t.stableId === user.id);

        const totals = userRobots.reduce(
          (acc, r) => ({
            battles: acc.battles + r.totalBattles,
            wins: acc.wins + r.wins,
            losses: acc.losses + r.losses,
            draws: acc.draws + r.draws,
            fame: acc.fame + r.fame,
            highestElo: Math.max(acc.highestElo, r.elo),
          }),
          { battles: 0, wins: 0, losses: 0, draws: 0, fame: 0, highestElo: 0 },
        );

        const archivedFacilities: ArchivedFacility[] = userFacilities.map((f) => ({
          facilityType: f.facilityType,
          level: f.level,
        }));

        const stableArchive = await tx.stableSeasonArchive.upsert({
          where: {
            // The unique constraint is (season_number, user_id).
            seasonNumber_userId: { seasonNumber, userId: user.id },
          },
          update: {}, // Already archived — keep the existing data.
          create: {
            seasonNumber,
            userId: user.id,
            stableName: stableDisplayName(user),
            finalCredits: user.currency,
            prestigeEarned: user.prestige,
            totalBattles: totals.battles,
            wins: totals.wins,
            losses: totals.losses,
            draws: totals.draws,
            winRate: totals.battles > 0 ? totals.wins / totals.battles : 0,
            highestElo: totals.highestElo,
            totalFame: totals.fame,
            championshipTitles: user.championshipTitles,
            championshipTitles1v1: user.championshipTitles1v1,
            championshipTitles2v2: user.championshipTitles2v2,
            championshipTitles3v3: user.championshipTitles3v3,
            achievementsUnlocked: userAchievements.length,
            achievementsAvailable,
            achievementIds: userAchievements.map((a) => a.achievementId),
            facilities: archivedFacilities as unknown as object,
            robotCount: userRobots.length,
            teamCount: userTeams.length,
            competitiveCycles,
          },
        });
        stablesArchived++;

        for (const robot of userRobots) {
          const robotStandings: ArchivedStanding[] = (
            standingsByEntity.get(entityKey('robot', robot.id)) ?? []
          ).map((s) => ({
            mode: s.mode,
            tier: s.tier,
            leagueInstanceId: s.leagueInstanceId,
            leaguePoints: s.leaguePoints,
            wins: s.wins,
            losses: s.losses,
            draws: s.draws,
            bestWinStreak: s.bestWinStreak,
            instanceRank: ranks.get(rankKey('robot', robot.id, s.mode)) ?? 0,
          }));

          const robotTeams: ArchivedTeamMembership[] = userTeams
            .filter((t) => t.members.some((m) => m.robotId === robot.id))
            .map((t) => {
              const teamStandings = standingsByEntity.get(entityKey('team', t.id)) ?? [];
              const modes: ArchivedTeamStanding[] = teamStandings.map((s) => ({
                mode: s.mode,
                tier: s.tier,
                leagueInstanceId: s.leagueInstanceId,
                leaguePoints: s.leaguePoints,
                instanceRank: ranks.get(rankKey('team', t.id, s.mode)) ?? 0,
              }));
              return { teamName: t.teamName, teamSize: t.teamSize, modes };
            });

          await tx.robotSeasonArchive.create({
            data: {
              stableArchiveId: stableArchive.id,
              robotName: robot.name,
              imageUrl: robot.imageUrl,
              frameId: robot.frameId,
              paintJob: robot.paintJob,
              finalElo: robot.elo,
              fame: robot.fame,
              wins: robot.wins,
              losses: robot.losses,
              draws: robot.draws,
              totalBattles: robot.totalBattles,
              damageDealtLifetime: robot.damageDealtLifetime,
              damageTakenLifetime: robot.damageTakenLifetime,
              kills: robot.kills,
              mainWeaponName: robot.mainWeapon?.weapon.name ?? null,
              offhandWeaponName: robot.offhandWeapon?.weapon.name ?? null,
              standings: robotStandings as unknown as object,
              teams: robotTeams as unknown as object,
            },
          });
          robotsArchived++;
        }
      }
    });
  }

  return { stablesArchived, robotsArchived };
}

// ─── Stage 1b: standings snapshot ────────────────────────────────────

/**
 * Write the bounded Season_Standing_Snapshot.
 *
 * Capped at Accolade_Depth entries per (mode, tier, instance), so the row count
 * does not scale with the Generated_Stable population.
 */
export async function writeStandingSnapshot(
  seasonNumber: number,
  standings: RankableStanding[],
): Promise<number> {
  const depth = loadEnvConfig().accoladeDepth;

  // Resolve entity names and owning stables once.
  const robotIds = standings.filter((s) => s.entityType === 'robot').map((s) => s.entityId);
  const teamIds = standings.filter((s) => s.entityType === 'team').map((s) => s.entityId);

  const [robots, teams] = await Promise.all([
    prisma.robot.findMany({
      where: { id: { in: robotIds } },
      select: {
        id: true, name: true,
        user: { select: { username: true, stableName: true, isGenerated: true } },
      },
    }),
    prisma.teamBattle.findMany({
      where: { id: { in: teamIds } },
      select: {
        id: true, teamName: true,
        stable: { select: { username: true, stableName: true, isGenerated: true } },
      },
    }),
  ]);

  const robotById = new Map(robots.map((r) => [r.id, r]));
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const groups = new Map<string, RankableStanding[]>();
  for (const s of standings) {
    const key = groupKey(s.mode, s.tier, s.leagueInstanceId);
    const bucket = groups.get(key);
    if (bucket) bucket.push(s);
    else groups.set(key, [s]);
  }

  const rows: Array<{
    seasonNumber: number; mode: string; tier: string; leagueInstanceId: string;
    instanceRank: number; entityType: string; entityName: string; stableName: string;
    leaguePoints: number; wins: number; losses: number; draws: number;
    isGeneratedSubject: boolean;
  }> = [];

  for (const group of groups.values()) {
    const ordered = orderStandings(group).slice(0, depth);
    ordered.forEach((s, index) => {
      let entityName = `${s.entityType} ${s.entityId}`;
      let stableName = 'Unknown';
      let isGenerated = false;

      if (s.entityType === 'robot') {
        const robot = robotById.get(s.entityId);
        if (!robot) return; // entity already gone — skip rather than store a placeholder
        entityName = robot.name;
        stableName = robot.user.stableName ?? robot.user.username;
        isGenerated = robot.user.isGenerated;
      } else if (s.entityType === 'team') {
        const team = teamById.get(s.entityId);
        if (!team) return;
        entityName = team.teamName;
        stableName = team.stable.stableName ?? team.stable.username;
        isGenerated = team.stable.isGenerated;
      }

      rows.push({
        seasonNumber,
        mode: s.mode,
        tier: s.tier,
        leagueInstanceId: s.leagueInstanceId,
        instanceRank: index + 1,
        entityType: s.entityType,
        entityName,
        stableName,
        leaguePoints: s.leaguePoints,
        wins: s.wins,
        losses: s.losses,
        draws: s.draws,
        isGeneratedSubject: isGenerated,
      });
    });
  }

  if (rows.length > 0) {
    // Idempotency: a prior attempt may have written partial snapshot rows.
    await prisma.seasonStandingSnapshot.deleteMany({ where: { seasonNumber } });
    await prisma.seasonStandingSnapshot.createMany({ data: rows });
  }
  return rows.length;
}

// ─── Stage 1c: accolades ─────────────────────────────────────────────

/** Resolved owning-stable attribution for an accolade subject. */
interface Owner {
  userId: number | null;
  stableName: string;
  isGeneratedSubject: boolean;
}

interface AccoladeRow {
  seasonNumber: number;
  userId: number | null;
  category: string;
  rank: number;
  subjectType: string;
  subjectName: string;
  stableName: string;
  value: number;
  valueLabel: string;
  mode: string | null;
  isGeneratedSubject: boolean;
}

/**
 * Capture Hall of Records and leaderboard placements into Season_Accolade rows.
 *
 * Mirrors what a player can brag about while the season is live, read from the
 * same `recordsQueryService` the Hall of Records uses so the two never diverge:
 *
 *   - Combat: most damage per mode, narrowest 1v1 victory, biggest 1v1 upset
 *   - Career (robot, all modes): most battles, highest win rate, most lifetime
 *     damage, highest ELO, most kills
 *   - Economic: richest stables, highest-fame robot
 *   - Prestige (stable): highest prestige, most championship titles
 *   - KotH: most wins, avg zone score, most kills, longest win streak, most
 *     zone time, zone dominator
 *   - Grand Melee: most wins, highest LP, most kills
 *   - Tournament champions per type, ranked by titles won that season
 *   - League win streaks per mode (1v1 robot; 2v2 / 3v3 / tag team by team)
 *
 * Kills are captured per game type wherever the game tracks them per mode
 * (KotH and Grand Melee via `standings.total_kills`) plus the all-mode career
 * total (`robots.kills`). League and tournament modes keep no per-mode kill
 * counter, so they carry no kill accolade.
 *
 * Ownership is resolved by id, so names are never guessed. Bot-held placements
 * ARE captured, with `userId` null and the generated flag set, so a player's
 * recorded rank is its true rank within the season.
 *
 * A failure in one category is logged and skipped — accolades are decoration,
 * and the archive verification gate must not depend on them.
 */
export async function writeAccolades(seasonNumber: number): Promise<number> {
  const depth = loadEnvConfig().accoladeDepth;
  const rows: AccoladeRow[] = [];

  // Ownership is resolved by id, never by name: robot and team names are not
  // unique, and the records service already hands back the ids we need. Load
  // robots, teams, and stables once into id-maps so every category can attach a
  // subject to its owning stable (or null it out for a Generated_Stable).
  const [robots, teams, users] = await Promise.all([
    prisma.robot.findMany({
      select: {
        id: true,
        name: true,
        userId: true,
        user: { select: { username: true, stableName: true, isGenerated: true } },
      },
    }),
    prisma.teamBattle.findMany({
      select: {
        id: true,
        teamName: true,
        stable: { select: { id: true, username: true, stableName: true, isGenerated: true } },
      },
    }),
    prisma.user.findMany({
      select: { id: true, username: true, stableName: true, isGenerated: true },
    }),
  ]);
  const robotById = new Map(robots.map((r) => [r.id, r]));
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const userById = new Map(users.map((u) => [u.id, u]));

  const UNKNOWN_OWNER: Owner = { userId: null, stableName: 'Unknown', isGeneratedSubject: false };

  const robotOwner = (robotId: number): Owner => {
    const r = robotById.get(robotId);
    if (!r) return UNKNOWN_OWNER;
    return {
      userId: r.user.isGenerated ? null : r.userId,
      stableName: r.user.stableName ?? r.user.username,
      isGeneratedSubject: r.user.isGenerated,
    };
  };
  const teamOwner = (teamId: number): Owner => {
    const t = teamById.get(teamId);
    if (!t) return UNKNOWN_OWNER;
    return {
      userId: t.stable.isGenerated ? null : t.stable.id,
      stableName: t.stable.stableName ?? t.stable.username,
      isGeneratedSubject: t.stable.isGenerated,
    };
  };
  const stableOwner = (userId: number): Owner => {
    const u = userById.get(userId);
    if (!u) return UNKNOWN_OWNER;
    return {
      userId: u.isGenerated ? null : u.id,
      stableName: u.stableName ?? u.username,
      isGeneratedSubject: u.isGenerated,
    };
  };

  // Column caps from the schema — truncate defensively so an over-long team or
  // stable name can never abort the whole accolade insert.
  const trunc = (value: string, max: number): string =>
    value.length > max ? value.slice(0, max) : value;

  const pushRanked = (
    category: string,
    mode: string | null,
    valueLabel: string,
    subjectType: 'robot' | 'team' | 'stable',
    entries: Array<{ subjectName: string; value: number; owner: Owner }>,
  ): void => {
    entries.slice(0, depth).forEach((entry, index) => {
      rows.push({
        seasonNumber,
        category,
        rank: index + 1,
        subjectType,
        subjectName: trunc(entry.subjectName || 'Unknown', 100),
        value: Number.isFinite(entry.value) ? entry.value : 0,
        valueLabel: trunc(valueLabel, 40),
        mode,
        userId: entry.owner.userId,
        stableName: trunc(entry.owner.stableName || 'Unknown', 30),
        isGeneratedSubject: entry.owner.isGeneratedSubject,
      });
    });
  };

  const capture = async (label: string, fn: () => Promise<void>): Promise<void> => {
    try {
      await fn();
    } catch (error) {
      logger.error(
        `[season-archive] Accolade category "${label}" failed — ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const records = await import('../records/recordsQueryService');

  // ── Combat: most damage per mode, narrowest 1v1 victory, biggest 1v1 upset ──
  await capture('combat', async () => {
    const combat = await records.fetchCombatRecords();
    for (const [mode, entries] of Object.entries(combat.mostDamageInBattle ?? {})) {
      const list = (entries as Array<{ robot: { id: number; name: string }; damageDealt: number }>) ?? [];
      pushRanked(
        'mostDamageInBattle',
        mode,
        'damage dealt',
        'robot',
        list.map((e) => ({ subjectName: e.robot.name, value: e.damageDealt, owner: robotOwner(e.robot.id) })),
      );
    }
    // Narrowest victory pools both 1v1 modes, so it carries no single mode tag.
    pushRanked(
      'narrowestVictory',
      null,
      'HP remaining',
      'robot',
      (combat.narrowestVictory ?? []).map((e) => ({
        subjectName: e.winner.name,
        value: e.remainingHP,
        owner: robotOwner(e.winner.id),
      })),
    );
  });

  await capture('upsets', async () => {
    const upsets = await records.fetchUpsetRecords();
    pushRanked(
      'biggestUpset',
      'tournament_1v1',
      'ELO overcome',
      'robot',
      (upsets.biggestUpset ?? []).map((e) => ({
        subjectName: e.underdog.name,
        value: e.eloDifference,
        owner: robotOwner(e.underdog.id),
      })),
    );
  });

  // ── Career leaderboards (robot-level, all modes combined) ──
  await capture('career', async () => {
    const career = await records.fetchCareerRecords();
    pushRanked('mostBattles', null, 'battles', 'robot',
      career.mostBattles.map((e) => ({ subjectName: e.robotName, value: e.totalBattles, owner: robotOwner(e.robotId) })));
    pushRanked('highestWinRate', null, 'win %', 'robot',
      career.highestWinRate.map((e) => ({ subjectName: e.robotName, value: e.winRate, owner: robotOwner(e.robotId) })));
    pushRanked('mostLifetimeDamage', null, 'lifetime damage', 'robot',
      career.mostLifetimeDamage.map((e) => ({ subjectName: e.robotName, value: e.damageDealt, owner: robotOwner(e.robotId) })));
    pushRanked('highestElo', null, 'ELO', 'robot',
      career.highestElo.map((e) => ({ subjectName: e.robotName, value: e.elo, owner: robotOwner(e.robotId) })));
    // Career kills — the all-mode total from robots.kills.
    pushRanked('mostKills', null, 'kills', 'robot',
      career.mostKills.map((e) => ({ subjectName: e.robotName, value: e.kills, owner: robotOwner(e.robotId) })));
  });

  // ── Economic: richest stables and the highest-fame robot ──
  await capture('economic', async () => {
    const economic = await records.fetchEconomicRecords();
    pushRanked('highestFame', null, 'fame', 'robot',
      economic.highestFame.map((e) => ({ subjectName: e.robotName, value: e.fame, owner: robotOwner(e.robotId) })));
    pushRanked('richestStable', null, 'credits', 'stable',
      economic.richestStables.map((e) => ({ subjectName: e.username, value: e.currency, owner: stableOwner(e.userId) })));
  });

  // ── Prestige: final prestige and championship-title standings (stable-level) ──
  await capture('prestige', async () => {
    const prestige = await records.fetchPrestigeRecords();
    pushRanked('highestPrestige', null, 'prestige', 'stable',
      prestige.highestPrestige.map((e) => ({ subjectName: e.username, value: e.prestige, owner: stableOwner(e.userId) })));
    pushRanked('mostTitles', null, 'titles', 'stable',
      prestige.mostTitles.map((e) => ({ subjectName: e.username, value: e.championshipTitles, owner: stableOwner(e.userId) })));
  });

  // ── King of the Hill ──
  await capture('koth', async () => {
    const koth = await records.fetchKothRecords();
    if (!koth) return;
    const list = <T>(key: string): T[] => (koth[key] as T[] | undefined) ?? [];
    type KRow = { robotId: number; robotName: string };
    pushRanked('kothMostWins', 'koth', 'wins', 'robot',
      list<KRow & { kothWins: number }>('mostWins').map((e) => ({ subjectName: e.robotName, value: e.kothWins, owner: robotOwner(e.robotId) })));
    pushRanked('kothAvgZoneScore', 'koth', 'avg zone score', 'robot',
      list<KRow & { avgZoneScore: number }>('highestAvgZoneScore').map((e) => ({ subjectName: e.robotName, value: e.avgZoneScore, owner: robotOwner(e.robotId) })));
    // KotH kills — per-mode kills from standings.total_kills.
    pushRanked('kothMostKills', 'koth', 'kills', 'robot',
      list<KRow & { kothKills: number }>('mostKillsCareer').map((e) => ({ subjectName: e.robotName, value: e.kothKills, owner: robotOwner(e.robotId) })));
    pushRanked('kothLongestWinStreak', 'koth', 'consecutive wins', 'robot',
      list<KRow & { bestWinStreak: number }>('longestWinStreak').map((e) => ({ subjectName: e.robotName, value: e.bestWinStreak, owner: robotOwner(e.robotId) })));
    pushRanked('kothMostZoneTime', 'koth', 'zone seconds', 'robot',
      list<KRow & { totalZoneTime: number }>('mostZoneTime').map((e) => ({ subjectName: e.robotName, value: e.totalZoneTime, owner: robotOwner(e.robotId) })));
    pushRanked('kothZoneDominator', 'koth', 'zone score', 'robot',
      list<KRow & { totalZoneScore: number }>('zoneDominator').map((e) => ({ subjectName: e.robotName, value: e.totalZoneScore, owner: robotOwner(e.robotId) })));
  });

  // ── Grand Melee ──
  await capture('grandMelee', async () => {
    const gm = await records.fetchGrandMeleeRecords();
    if (!gm) return;
    const list = <T>(key: string): T[] => (gm[key] as T[] | undefined) ?? [];
    type GRow = { robotId: number; robotName: string };
    pushRanked('grandMeleeMostWins', 'grand_melee', 'wins', 'robot',
      list<GRow & { grandMeleeWins: number }>('mostWins').map((e) => ({ subjectName: e.robotName, value: e.grandMeleeWins, owner: robotOwner(e.robotId) })));
    pushRanked('grandMeleeHighestLp', 'grand_melee', 'LP', 'robot',
      list<GRow & { leaguePoints: number }>('highestLp').map((e) => ({ subjectName: e.robotName, value: e.leaguePoints, owner: robotOwner(e.robotId) })));
    // Grand Melee kills — per-mode kills from standings.total_kills.
    pushRanked('grandMeleeMostKills', 'grand_melee', 'kills', 'robot',
      list<GRow & { totalKills: number }>('mostKillsCareer').map((e) => ({ subjectName: e.robotName, value: e.totalKills, owner: robotOwner(e.robotId) })));
  });

  // ── Tournament champions: the winner of each completed tournament, most
  //    recent first, capped per type to mirror the live Hall of Records.
  //
  // This is a champion log rather than a ranked-by-metric leaderboard, so it
  // does not use `pushRanked`/`accoladeDepth`: it carries the tournament name in
  // the value label and no numeric value (rendered as name only). The winner id
  // references a Robot for 1v1 and a TeamBattle for 2v2/3v3, resolved from the
  // matching id-map.
  await capture('tournamentChampions', async () => {
    const TYPE_CAP = 10;
    const modeByType: Record<string, string> = {
      robot: 'tournament_1v1',
      team_2v2: 'tournament_2v2',
      team_3v3: 'tournament_3v3',
    };

    const tournaments = await prisma.tournament.findMany({
      where: { status: 'completed', winnerId: { not: null } },
      select: { name: true, participantType: true, winnerId: true },
      orderBy: { completedAt: 'desc' },
    });

    const takenPerType = new Map<string, number>();
    for (const t of tournaments) {
      const mode = modeByType[t.participantType];
      if (!mode || t.winnerId === null) continue;
      const taken = takenPerType.get(t.participantType) ?? 0;
      if (taken >= TYPE_CAP) continue;
      takenPerType.set(t.participantType, taken + 1);

      const isTeam = t.participantType !== 'robot';
      const subjectName = isTeam
        ? teamById.get(t.winnerId)?.teamName ?? 'Unknown'
        : robotById.get(t.winnerId)?.name ?? 'Unknown';
      const owner = isTeam ? teamOwner(t.winnerId) : robotOwner(t.winnerId);

      rows.push({
        seasonNumber,
        category: 'tournamentChampion',
        rank: taken + 1,
        subjectType: isTeam ? 'team' : 'robot',
        subjectName: trunc(subjectName || 'Unknown', 100),
        // No metric — the value label carries the tournament name and the UI
        // omits a zero value.
        value: 0,
        valueLabel: trunc(t.name, 40),
        mode,
        userId: owner.userId,
        stableName: trunc(owner.stableName || 'Unknown', 30),
        isGeneratedSubject: owner.isGeneratedSubject,
      });
    }
  });

  // ── League win streaks, per mode. Team modes attribute to the team. ──
  await capture('winStreaks', async () => {
    const streaks = await records.fetchWinStreakRecords();
    const teamModes = new Set<string>(['league_2v2', 'league_3v3', 'tag_team']);
    for (const [mode, entries] of Object.entries(streaks ?? {})) {
      const isTeam = teamModes.has(mode);
      const list = (entries as Array<{ entityId: number; entityName: string; bestWinStreak: number }>) ?? [];
      pushRanked(
        'longestWinStreak',
        mode,
        'consecutive wins',
        isTeam ? 'team' : 'robot',
        list.map((e) => ({
          subjectName: e.entityName,
          value: e.bestWinStreak,
          owner: isTeam ? teamOwner(e.entityId) : robotOwner(e.entityId),
        })),
      );
    }
  });

  if (rows.length > 0) {
    // Idempotency: a prior attempt may have written partial accolade rows.
    await prisma.seasonAccolade.deleteMany({ where: { seasonNumber } });
    await prisma.seasonAccolade.createMany({ data: rows });
  }
  logger.info(`[season-archive] Captured ${rows.length} accolades for season ${seasonNumber}`);
  return rows.length;
}

// ─── Stage 1 orchestration and Stage 2 verification ──────────────────

/** Write the complete Season_Archive. Performs no destructive writes. */
export async function writeSeasonArchive(
  seasonNumber: number,
  competitiveCycles: number,
): Promise<ArchiveResult> {
  const { standings, ranks } = await loadStandingsWithRanks();

  const standingsByEntity = new Map<string, RankableStanding[]>();
  for (const s of standings) {
    const key = entityKey(s.entityType, s.entityId);
    const bucket = standingsByEntity.get(key);
    if (bucket) bucket.push(s);
    else standingsByEntity.set(key, [s]);
  }

  const generatedStableCount = await prisma.user.count({ where: { isGenerated: true } });

  const { stablesArchived, robotsArchived } = await writeStableAndRobotArchives(
    seasonNumber,
    competitiveCycles,
    ranks,
    standingsByEntity,
  );
  const snapshotRows = await writeStandingSnapshot(seasonNumber, standings);
  const accoladeRows = await writeAccolades(seasonNumber);

  return { stablesArchived, robotsArchived, snapshotRows, accoladeRows, generatedStableCount };
}

/**
 * Stage 2 gate: the archive must be complete before anything is deleted.
 * Counts Human_Stables only, so deleting Generated_Stables cannot fail it.
 */
export async function verifyArchive(seasonNumber: number): Promise<ArchiveVerification> {
  const [expectedStables, expectedRobots, actualStables, actualRobots] = await Promise.all([
    prisma.user.count({ where: { isGenerated: false } }),
    prisma.robot.count({ where: { user: { isGenerated: false } } }),
    prisma.stableSeasonArchive.count({ where: { seasonNumber } }),
    prisma.robotSeasonArchive.count({ where: { stableArchive: { seasonNumber } } }),
  ]);

  return {
    ok: expectedStables === actualStables && expectedRobots === actualRobots,
    expectedStables,
    actualStables,
    expectedRobots,
    actualRobots,
  };
}

/** Whether a complete archive already exists — drives rollover idempotence. */
export async function hasCompleteArchive(seasonNumber: number): Promise<boolean> {
  const verification = await verifyArchive(seasonNumber);
  return verification.ok && verification.actualStables > 0;
}
