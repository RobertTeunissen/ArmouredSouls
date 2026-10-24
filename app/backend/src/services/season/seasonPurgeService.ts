/**
 * Season_Purge_Service (Spec #45).
 *
 * The destructive half of a Season_Rollover. Runs only after the archive has
 * been written and verified.
 *
 * Transaction boundaries are per stage and batched by user, not one giant
 * transaction: on a 2 vCPU / 2GB VPS with thousands of Generated_Stables a
 * single transaction would hold locks for minutes and balloon WAL. Batching by
 * user means an interruption leaves whole users done and whole users untouched,
 * never a half-reset stable.
 *
 * @module services/season/seasonPurgeService
 */

import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { deleteRobotBattleReferences } from '../robot/robotReferenceCleanup';
import type { Prisma } from '../../../generated/prisma';

/** Starting credits granted at the beginning of a Competitive_Phase. */
export const STARTING_CREDITS = 3_000_000;

/** Users deleted per transaction. Each batch clears participant/member/standing
 *  rows then cascades from users. On a 2 vCPU VPS with thousands of battle
 *  participant rows per batch, smaller batches keep transactions well within the
 *  30s timeout. */
const GENERATED_DELETE_BATCH = 50;

export interface PurgeCounts {
  generatedStablesDeleted: number;
  rowsDeleted: Record<string, number>;
  humanStablesReset: number;
}

// ─── Stage 3.1: Generated_Stables ────────────────────────────────────

/**
 * Delete every Generated_Stable and all of its owned rows.
 *
 * Bots are deleted rather than reset: an emptied bot stable would never rebuild,
 * leaving the matchmaking pool populated by dead accounts. Their competitive
 * results survive in the Season_Standing_Snapshot and Season_Accolade rows,
 * which hold denormalized text.
 *
 * Only rows under `uploads/user-robots/` are ever considered for file deletion;
 * Generated_Stable robots reference shared build assets under `/assets/robots/`,
 * which this never touches.
 */
export async function deleteGeneratedStables(
  /** Called before the first batch and after every batch (Season Control progress). */
  onProgress?: (deleted: number, total: number) => void | Promise<void>,
): Promise<number> {
  // Spec #55 (task 1.2): only Generated_Stables are deleted. The explicit
  // Stable_Type guard makes the skip of Automaton_Stables independent of
  // invariant I1 (Automatons are always isGenerated = false).
  const generated = await prisma.user.findMany({
    where: { isGenerated: true, stableType: { not: 'automaton' } },
    select: { id: true },
    orderBy: { id: 'asc' },
  });

  let deleted = 0;
  await onProgress?.(0, generated.length);
  for (let i = 0; i < generated.length; i += GENERATED_DELETE_BATCH) {
    const batch = generated.slice(i, i + GENERATED_DELETE_BATCH).map((u) => u.id);

    await prisma.$transaction(
      async (tx) => {
      const robotIds = (
        await tx.robot.findMany({ where: { userId: { in: batch } }, select: { id: true } })
      ).map((r) => r.id);

      const teamIds = (
        await tx.teamBattle.findMany({ where: { stableId: { in: batch } }, select: { id: true } })
      ).map((t) => t.id);

      // Standings carry no FK to robots/teams, so they must go explicitly.
      if (robotIds.length > 0) {
        await tx.standing.deleteMany({
          where: { entityType: 'robot', entityId: { in: robotIds } },
        });
      }
      if (teamIds.length > 0) {
        await tx.standing.deleteMany({
          where: { entityType: 'team', entityId: { in: teamIds } },
        });
      }

      // battle_participants references robots through a RESTRICT foreign key
      // (team_battle_members cascades since 20260829120000), so the robot
      // deletions that cascade from `users` below would be blocked while these
      // rows still point at a generated robot. A generated robot can appear in a
      // shared battle alongside a human robot, so the participant rows are
      // cleared by robotId rather than by battle. Their permanent record already
      // lives in battle_summaries and the season snapshot/accolade tables; the
      // battles themselves are purged wholesale in a later stage.
      await deleteRobotBattleReferences(tx, robotIds);

      // The rest cascades from `users` via onDelete: Cascade.
      const result = await tx.user.deleteMany({ where: { id: { in: batch } } });
      deleted += result.count;
    },
    // On a 2 vCPU VPS with thousands of participant rows per batch, the default
    // 5s interactive-transaction timeout is too tight. 30s gives ample headroom.
    { timeout: 30_000 },
    );
    await onProgress?.(deleted, generated.length);
  }

  logger.info(`[season-purge] Deleted ${deleted} generated stables`);
  return deleted;
}

// ─── Stage 3.2: competitive and economic reset ───────────────────────

/**
 * Delete all competitive and economic rows, then restore every Human_Stable to
 * its starting position.
 *
 * Deletion order respects foreign keys explicitly rather than relying on
 * cascade timing: participants and standings before robots, members before
 * team battles, match participants before matches, tournament matches before
 * tournaments.
 *
 * Robot rows are deleted but their uploaded image files are deliberately
 * retained — see the Image_Library (Spec #45 R30).
 */
export async function resetCompetitiveAndEconomicState(): Promise<{
  rowsDeleted: Record<string, number>;
  humanStablesReset: number;
}> {
  const rowsDeleted: Record<string, number> = {};

  const del = async (table: string, fn: () => Promise<{ count: number }>): Promise<void> => {
    const result = await fn();
    rowsDeleted[table] = result.count;
  };

  // Children before parents.
  await del('battle_participants', () => prisma.battleParticipant.deleteMany({}));
  await del('tuning_allocations', () => prisma.tuningAllocation.deleteMany({}));
  await del('subscriptions', () => prisma.subscription.deleteMany({}));
  await del('team_battle_members', () => prisma.teamBattleMember.deleteMany({}));
  await del('scheduled_match_participants', () => prisma.scheduledMatchParticipant.deleteMany({}));
  await del('tournament_matches', () => prisma.scheduledTournamentMatch.deleteMany({}));
  await del('weapon_refinement', () => prisma.weaponRefinement.deleteMany({}));
  await del('standings', () => prisma.standing.deleteMany({}));
  await del('robot_mode_kills', () => prisma.robotModeKills.deleteMany({}));
  await del('user_achievements', () => prisma.userAchievement.deleteMany({}));

  // Robots reference weapon inventory rows, so clear the links first.
  await prisma.robot.updateMany({ data: { mainWeaponId: null, offhandWeaponId: null } });

  await del('robots', () => prisma.robot.deleteMany({}));
  await del('weapon_inventory', () => prisma.weaponInventory.deleteMany({}));
  await del('facilities', () => prisma.facility.deleteMany({}));
  await del('team_battles', () => prisma.teamBattle.deleteMany({}));
  await del('scheduled_matches_v2', () => prisma.scheduledMatch.deleteMany({}));
  await del('tournaments', () => prisma.tournament.deleteMany({}));

  // Restore Human_Stables. Starting credits apply regardless of whether the
  // prior balance was positive, zero, or negative.
  const reset = await prisma.user.updateMany({
    where: { isGenerated: false },
    data: {
      currency: STARTING_CREDITS,
      prestige: 0,
      championshipTitles: 0,
      championshipTitles1v1: 0,
      championshipTitles2v2: 0,
      championshipTitles3v3: 0,
      pinnedAchievements: [],
      totalPracticeBattles: 0,
    },
  });

  logger.info(
    `[season-purge] Competitive and economic state reset — ${reset.count} human stables restored`,
  );
  return { rowsDeleted, humanStablesReset: reset.count };
}

// ─── Stage 3.3: history purge ────────────────────────────────────────

/**
 * Delete per-cycle history once the archive is safe, and reset the
 * Global_Cycle_Counter so the new season starts at cycle 0.
 */
export async function purgeHistory(): Promise<Record<string, number>> {
  const rowsDeleted: Record<string, number> = {};

  // Every table here is emptied unconditionally, so TRUNCATE is semantically
  // identical to `deleteMany({})` but runs in milliseconds instead of scanning
  // and WAL-logging every row.
  //
  // This is not an optimisation, it is a correctness fix: on ACC `audit_logs`
  // held 1.76M rows and `battles` 363K, and the row-by-row DELETE exceeded the
  // PostgreSQL `statement_timeout`, aborting the rollover after the earlier
  // purge stages had already committed. TRUNCATE also reclaims the pages
  // immediately, so the disk space comes back without waiting for VACUUM.
  //
  // Order does not matter under a single multi-table TRUNCATE, and CASCADE
  // covers the child tables that reference `battles` (battle_participants,
  // battle_summaries, scheduled_tournament_matches). It cannot reach the
  // season archive tables — those key off `seasons`, not off any table here.
  const TRUNCATE_TABLES = [
    'battle_summaries',
    'battles',
    'audit_logs',
    'cycle_snapshots',
    'financial_ledger',
    'league_history',
    'leaderboard_cache',
    'practice_arena_daily_stats',
    // Practice Arena usage (admin Practice Arena page) is per-season history.
    'practice_arena_events',
    'search_analytics_events',
    'search_analytics_failures',
    // Spec #55 R9.5: Turn_Records are per-season history.
    'automaton_turns',
  ] as const;

  // Capture the counts first so the rollover report stays truthful; TRUNCATE
  // itself reports nothing.
  for (const table of TRUNCATE_TABLES) {
    // Table names come from this fixed literal list, never from user input.
    const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*)::bigint AS count FROM "${table}"`,
    );
    rowsDeleted[table] = Number(rows[0]?.count ?? 0);
  }

  const quoted = TRUNCATE_TABLES.map((t) => `"${t}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} CASCADE`);

  await prisma.cycleMetadata.update({
    where: { id: 1 },
    data: { totalCycles: 0, lastCycleAt: new Date() },
  });

  logger.info('[season-purge] History purged and global cycle counter reset to 0');
  return rowsDeleted;
}

// ─── Stage 4.2: space reclamation ────────────────────────────────────

/**
 * Reclaim disk space on the purged tables.
 *
 * VACUUM cannot run inside a transaction block, which is why this is a separate
 * non-transactional step. A failure here is logged and the rollover still
 * reports success — space reclamation is housekeeping, not correctness.
 */
export async function reclaimSpace(): Promise<boolean> {
  const tables = [
    'battles',
    'battle_summaries',
    'battle_participants',
    'audit_logs',
    'cycle_snapshots',
    'financial_ledger',
    'league_history',
    'leaderboard_cache',
    'robots',
    'standings',
    'weapon_inventory',
    'facilities',
    'users',
  ];

  try {
    for (const table of tables) {
      // Table names come from this fixed literal list, never from user input.
      await prisma.$executeRawUnsafe(`VACUUM (ANALYZE) "${table}"`);
    }
    logger.info(`[season-purge] Space reclaimed on ${tables.length} tables`);
    return true;
  } catch (error) {
    logger.error(
      `[season-purge] Space reclamation failed (non-fatal) — ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  }
}

// ─── Preview ─────────────────────────────────────────────────────────

const STABLE_TYPES = ['human', 'automaton', 'generated'] as const;
type StableType = (typeof STABLE_TYPES)[number];

/**
 * The preview's split uses the rollover's own criteria, so its numbers are
 * what Stage 3 does: `deleteGeneratedStables` deletes `isGenerated` stables
 * that are not Automatons; every other stable is archived and reset.
 */
const STABLE_TYPE_WHERE: Readonly<Record<StableType, Prisma.UserWhereInput>> = {
  human: { isGenerated: false, stableType: { not: 'automaton' } },
  automaton: { stableType: 'automaton' },
  generated: { isGenerated: true, stableType: { not: 'automaton' } },
};

/** Stables and robots of one Stable_Type. */
export interface StableTypeCounts {
  stables: number;
  robots: number;
}

export interface RolloverPreview {
  /** Every non-generated stable: human players and Automatons (archived and reset). */
  humanStables: number;
  humanRobots: number;
  generatedStables: number;
  generatedRobots: number;
  /**
   * The same population split by Stable_Type (Season Control): human and
   * automaton stables are archived and reset, generated stables are deleted.
   */
  breakdown: { human: StableTypeCounts; automaton: StableTypeCounts; generated: StableTypeCounts };
  /** Rows every table the rollover empties holds now, by table name. */
  rowsToPurge: Record<string, number>;
  imagesRetained: number;
  imagesDeleted: number;
}

/** Read-only report of what a rollover would do. Modifies nothing. */
export async function previewRollover(): Promise<RolloverPreview> {
  const [
    humanStables, humanRobots, generatedStables, generatedRobots,
    typeStables, typeRobots,
    battles, battleSummaries, auditLogs, cycleSnapshots,
    financialLedger, leagueHistory, leaderboardCache, practiceStats,
    standings, robotModeKills, weaponInventory, facilities, teamBattles, tournaments,
    robotsWithImages,
    battleParticipants, tuningAllocations, subscriptions, teamBattleMembers,
    scheduledMatchParticipants, tournamentMatches, weaponRefinements, userAchievements,
    robots, scheduledMatches, searchEvents, searchFailures, automatonTurns, practiceEvents,
  ] = await Promise.all([
    prisma.user.count({ where: { isGenerated: false } }),
    prisma.robot.count({ where: { user: { isGenerated: false } } }),
    prisma.user.count({ where: { isGenerated: true } }),
    prisma.robot.count({ where: { user: { isGenerated: true } } }),
    Promise.all(STABLE_TYPES.map((type) => prisma.user.count({ where: STABLE_TYPE_WHERE[type] }))),
    Promise.all(STABLE_TYPES.map((type) => prisma.robot.count({ where: { user: STABLE_TYPE_WHERE[type] } }))),
    prisma.battle.count(),
    prisma.battleSummary.count(),
    prisma.auditLog.count(),
    prisma.cycleSnapshot.count(),
    prisma.financialLedger.count(),
    prisma.leagueHistory.count(),
    prisma.leaderboardCache.count(),
    prisma.practiceArenaDailyStats.count(),
    prisma.standing.count(),
    prisma.robotModeKills.count(),
    prisma.weaponInventory.count(),
    prisma.facility.count(),
    prisma.teamBattle.count(),
    prisma.tournament.count(),
    prisma.robot.count({ where: { imageUrl: { startsWith: '/uploads/' } } }),
    prisma.battleParticipant.count(),
    prisma.tuningAllocation.count(),
    prisma.subscription.count(),
    prisma.teamBattleMember.count(),
    prisma.scheduledMatchParticipant.count(),
    prisma.scheduledTournamentMatch.count(),
    prisma.weaponRefinement.count(),
    prisma.userAchievement.count(),
    prisma.robot.count(),
    prisma.scheduledMatch.count(),
    prisma.searchAnalyticsEvent.count(),
    prisma.searchAnalyticsFailure.count(),
    prisma.automatonTurn.count(),
    prisma.practiceArenaEvent.count(),
  ]);

  const stablesOf = (type: StableType): number => typeStables[STABLE_TYPES.indexOf(type)] ?? 0;
  const robotsOf = (type: StableType): number => typeRobots[STABLE_TYPES.indexOf(type)] ?? 0;

  return {
    humanStables,
    humanRobots,
    generatedStables,
    generatedRobots,
    breakdown: {
      human: { stables: stablesOf('human'), robots: robotsOf('human') },
      automaton: { stables: stablesOf('automaton'), robots: robotsOf('automaton') },
      generated: { stables: stablesOf('generated'), robots: robotsOf('generated') },
    },
    rowsToPurge: {
      battles, battle_summaries: battleSummaries, audit_logs: auditLogs,
      cycle_snapshots: cycleSnapshots, financial_ledger: financialLedger,
      league_history: leagueHistory, leaderboard_cache: leaderboardCache,
      practice_arena_daily_stats: practiceStats, standings,
      robot_mode_kills: robotModeKills,
      weapon_inventory: weaponInventory, facilities, team_battles: teamBattles, tournaments,
      battle_participants: battleParticipants,
      tuning_allocations: tuningAllocations,
      subscriptions,
      team_battle_members: teamBattleMembers,
      scheduled_match_participants: scheduledMatchParticipants,
      tournament_matches: tournamentMatches,
      weapon_refinement: weaponRefinements,
      user_achievements: userAchievements,
      robots,
      scheduled_matches_v2: scheduledMatches,
      search_analytics_events: searchEvents,
      search_analytics_failures: searchFailures,
      automaton_turns: automatonTurns,
      practice_arena_events: practiceEvents,
    },
    // Uploaded images are retained, never deleted, by a rollover.
    imagesRetained: robotsWithImages,
    imagesDeleted: 0,
  };
}
