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

/** Starting credits granted at the beginning of a Competitive_Phase. */
export const STARTING_CREDITS = 3_000_000;

/** Users deleted per transaction. Keeps each under about a second. */
const GENERATED_DELETE_BATCH = 200;

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
export async function deleteGeneratedStables(): Promise<number> {
  const generated = await prisma.user.findMany({
    where: { isGenerated: true },
    select: { id: true },
    orderBy: { id: 'asc' },
  });

  let deleted = 0;
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

      // battle_participants and team_battle_members reference robots through a
      // RESTRICT foreign key (no cascade), so the robot deletions that cascade
      // from `users` below would be blocked while these rows still point at a
      // generated robot. A generated robot can appear in a shared battle
      // alongside a human robot, so we clear the participant rows by robotId
      // rather than by battle. Their permanent record already lives in
      // battle_summaries and the season snapshot/accolade tables; the battles
      // themselves are purged wholesale in a later stage.
      if (robotIds.length > 0) {
        await tx.battleParticipant.deleteMany({ where: { robotId: { in: robotIds } } });
        await tx.teamBattleMember.deleteMany({ where: { robotId: { in: robotIds } } });
      }

      // The rest cascades from `users` via onDelete: Cascade.
      const result = await tx.user.deleteMany({ where: { id: { in: batch } } });
      deleted += result.count;
    },
    // On a 2 vCPU VPS with thousands of participant rows per batch, the default
    // 5s interactive-transaction timeout is too tight. 30s gives ample headroom.
    { timeout: 30_000 },
    );
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

  const del = async (table: string, fn: () => Promise<{ count: number }>): Promise<void> => {
    const result = await fn();
    rowsDeleted[table] = result.count;
  };

  await del('battle_summaries', () => prisma.battleSummary.deleteMany({}));
  await del('battles', () => prisma.battle.deleteMany({}));
  await del('audit_logs', () => prisma.auditLog.deleteMany({}));
  await del('cycle_snapshots', () => prisma.cycleSnapshot.deleteMany({}));
  await del('financial_ledger', () => prisma.financialLedger.deleteMany({}));
  await del('league_history', () => prisma.leagueHistory.deleteMany({}));
  await del('leaderboard_cache', () => prisma.leaderboardCache.deleteMany({}));
  await del('practice_arena_daily_stats', () => prisma.practiceArenaDailyStats.deleteMany({}));

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

export interface RolloverPreview {
  humanStables: number;
  humanRobots: number;
  generatedStables: number;
  generatedRobots: number;
  rowsToPurge: Record<string, number>;
  imagesRetained: number;
  imagesDeleted: number;
}

/** Read-only report of what a rollover would do. Modifies nothing. */
export async function previewRollover(): Promise<RolloverPreview> {
  const [
    humanStables, humanRobots, generatedStables, generatedRobots,
    battles, battleSummaries, auditLogs, cycleSnapshots,
    financialLedger, leagueHistory, leaderboardCache, practiceStats,
    standings, weaponInventory, facilities, teamBattles, tournaments,
    robotsWithImages,
  ] = await Promise.all([
    prisma.user.count({ where: { isGenerated: false } }),
    prisma.robot.count({ where: { user: { isGenerated: false } } }),
    prisma.user.count({ where: { isGenerated: true } }),
    prisma.robot.count({ where: { user: { isGenerated: true } } }),
    prisma.battle.count(),
    prisma.battleSummary.count(),
    prisma.auditLog.count(),
    prisma.cycleSnapshot.count(),
    prisma.financialLedger.count(),
    prisma.leagueHistory.count(),
    prisma.leaderboardCache.count(),
    prisma.practiceArenaDailyStats.count(),
    prisma.standing.count(),
    prisma.weaponInventory.count(),
    prisma.facility.count(),
    prisma.teamBattle.count(),
    prisma.tournament.count(),
    prisma.robot.count({ where: { imageUrl: { startsWith: '/uploads/' } } }),
  ]);

  return {
    humanStables,
    humanRobots,
    generatedStables,
    generatedRobots,
    rowsToPurge: {
      battles, battle_summaries: battleSummaries, audit_logs: auditLogs,
      cycle_snapshots: cycleSnapshots, financial_ledger: financialLedger,
      league_history: leagueHistory, leaderboard_cache: leaderboardCache,
      practice_arena_daily_stats: practiceStats, standings,
      weapon_inventory: weaponInventory, facilities, team_battles: teamBattles, tournaments,
    },
    // Uploaded images are retained, never deleted, by a rollover.
    imagesRetained: robotsWithImages,
    imagesDeleted: 0,
  };
}
