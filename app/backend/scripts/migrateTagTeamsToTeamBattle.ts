/**
 * Data Migration Script: TagTeam → TeamBattle
 *
 * Migrates all existing `TagTeam` rows into `TeamBattle` rows (teamSize=2) with
 * corresponding `TeamBattleMember` entries. Preserves all tag team league tracking
 * data (LP, league tier, instance, cycles, wins/losses/draws).
 *
 * Key behaviors:
 * - Generates teamName from "{ActiveRobotName} & {ReserveRobotName}" (truncated to 32 chars)
 * - Substitutes "Robot" for NULL/empty robot names
 * - Skips rows where a robot is already on a teamSize=2 TeamBattle (logs conflict)
 * - Idempotent: skips if TeamBattle with matching stableId + member robots exists
 * - Executes in a single transaction for atomicity
 * - Stores ID mapping (old TagTeam.id → new TeamBattle.id) in-memory for task 1.5 and 1.6
 * - Does NOT modify existing `tag_team` subscriptions (Req 6.6)
 *
 * Usage:
 *   npx tsx scripts/migrateTagTeamsToTeamBattle.ts
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 6.6
 */

import { PrismaClient } from '../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({
  adapter,
  log: ['error'],
});

// ─── ID Mapping ──────────────────────────────────────────────────────────────

/** Maps old TagTeam.id → new TeamBattle.id. Populated during migration. */
const idMapping = new Map<number, number>();

/**
 * Returns the ID mapping from old TagTeam IDs to new TeamBattle IDs.
 * Used by task 1.5 (scheduled match migration) and task 1.6 (league history migration).
 */
export function getTagTeamIdMapping(): Map<number, number> {
  return idMapping;
}

// ─── Name Generation ─────────────────────────────────────────────────────────

/**
 * Generate a team name from active and reserve robot names.
 * Substitutes "Robot" for NULL/empty names.
 * Truncates to 32 chars with "..." suffix if exceeded.
 */
export function generateTeamName(activeName: string | null | undefined, reserveName: string | null | undefined): string {
  const safeActiveName = activeName?.trim() || 'Robot';
  const safeReserveName = reserveName?.trim() || 'Robot';
  let teamName = `${safeActiveName} & ${safeReserveName}`;
  if (teamName.length > 32) {
    teamName = teamName.slice(0, 29) + '...';
  }
  return teamName;
}

// ─── League Instance Assignment ──────────────────────────────────────────────

/**
 * Assign a team to a bronze 2v2 league instance (for the teamLeagueId field).
 * Uses the same logic as assignTeamBattleLeagueInstance but within the
 * migration transaction context.
 */
async function assignBronzeLeagueInstance(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]): Promise<string> {
  const MAX_TEAMS_PER_INSTANCE = 50;

  const instances = await tx.teamBattle.groupBy({
    by: ['teamLeagueId'],
    where: {
      teamLeague: 'bronze',
      teamSize: 2,
    },
    _count: {
      id: true,
    },
  });

  if (instances.length === 0) {
    return 'bronze_1';
  }

  const leagueInstances = instances
    .map((instance) => {
      const instanceNumber = parseInt(instance.teamLeagueId.split('_')[1] || '1');
      return {
        leagueId: instance.teamLeagueId,
        instanceNumber,
        currentTeams: instance._count.id,
      };
    })
    .sort((a, b) => a.currentTeams - b.currentTeams);

  const leastFull = leagueInstances[0];

  if (leastFull.currentTeams >= MAX_TEAMS_PER_INSTANCE) {
    const nextInstanceNumber = Math.max(...leagueInstances.map((i) => i.instanceNumber)) + 1;
    return `bronze_${nextInstanceNumber}`;
  }

  return leastFull.leagueId;
}

// ─── Migration Logic ─────────────────────────────────────────────────────────

async function migrateTagTeamsToTeamBattle(): Promise<void> {
  console.log('Starting data migration: TagTeam → TeamBattle');
  console.log('='.repeat(70));

  let totalProcessed = 0;
  let totalMigrated = 0;
  let totalSkippedConflict = 0;
  let totalSkippedIdempotent = 0;

  try {
    // Fetch all TagTeam rows with robot details
    const tagTeams = await prisma.tagTeam.findMany({
      include: {
        activeRobot: { select: { id: true, name: true } },
        reserveRobot: { select: { id: true, name: true } },
      },
    });

    totalProcessed = tagTeams.length;
    console.log(`\nTotal TagTeam rows to process: ${totalProcessed}`);

    if (totalProcessed === 0) {
      console.log('\nNo TagTeam rows found. Migration not needed.');
      return;
    }

    // Execute entire migration in a single transaction
    await prisma.$transaction(async (tx) => {
      // Pre-fetch all existing TeamBattle members (teamSize=2) for conflict detection
      const existingMembers = await tx.teamBattleMember.findMany({
        where: { team: { teamSize: 2 } },
        select: { robotId: true, teamId: true },
      });
      const robotsOnTeams = new Set(existingMembers.map((m) => m.robotId));

      // Pre-fetch existing TeamBattle rows for idempotency check
      const existingTeamBattles = await tx.teamBattle.findMany({
        where: { teamSize: 2 },
        include: {
          members: { select: { robotId: true, slotIndex: true } },
        },
      });

      // Build a lookup: "stableId:activeRobotId:reserveRobotId" → existing TeamBattle
      const existingTeamLookup = new Map<string, number>();
      for (const team of existingTeamBattles) {
        const slot0 = team.members.find((m) => m.slotIndex === 0);
        const slot1 = team.members.find((m) => m.slotIndex === 1);
        if (slot0 && slot1) {
          const key = `${team.stableId}:${slot0.robotId}:${slot1.robotId}`;
          existingTeamLookup.set(key, team.id);
        }
      }

      for (const tagTeam of tagTeams) {
        const { id: oldId, stableId, activeRobotId, reserveRobotId } = tagTeam;

        // Idempotency check: skip if TeamBattle with matching stableId + member robots exists
        const idempotencyKey = `${stableId}:${activeRobotId}:${reserveRobotId}`;
        const existingTeamId = existingTeamLookup.get(idempotencyKey);
        if (existingTeamId) {
          console.log(`  [SKIP-IDEMPOTENT] TagTeam #${oldId} — TeamBattle #${existingTeamId} already exists`);
          idMapping.set(oldId, existingTeamId);
          totalSkippedIdempotent++;
          continue;
        }

        // Conflict check: skip if either robot is already on a teamSize=2 TeamBattle
        if (robotsOnTeams.has(activeRobotId)) {
          console.log(`  [SKIP-CONFLICT] TagTeam #${oldId} — activeRobot #${activeRobotId} already on a 2v2 TeamBattle`);
          totalSkippedConflict++;
          continue;
        }
        if (robotsOnTeams.has(reserveRobotId)) {
          console.log(`  [SKIP-CONFLICT] TagTeam #${oldId} — reserveRobot #${reserveRobotId} already on a 2v2 TeamBattle`);
          totalSkippedConflict++;
          continue;
        }

        // Generate team name
        const teamName = generateTeamName(
          tagTeam.activeRobot.name,
          tagTeam.reserveRobot.name,
        );

        // Assign 2v2 League instance (bronze default for new migrated teams)
        const teamLeagueId = await assignBronzeLeagueInstance(tx);

        // Create TeamBattle row
        const newTeam = await tx.teamBattle.create({
          data: {
            stableId,
            teamSize: 2,
            teamName,
            // 2v2 League fields (defaults — no league history)
            teamLp: 0,
            teamLeague: 'bronze',
            teamLeagueId,
            cyclesInLeague: 0,
            totalLeagueWins: 0,
            totalLeagueLosses: 0,
            totalLeagueDraws: 0,
            // Tag Team league fields (copied from TagTeam)
            tagTeamLp: tagTeam.tagTeamLeaguePoints,
            tagTeamLeague: tagTeam.tagTeamLeague,
            tagTeamLeagueId: tagTeam.tagTeamLeagueId,
            cyclesInTagTeamLeague: tagTeam.cyclesInTagTeamLeague,
            // Tag Team performance (copied from TagTeam)
            totalTagTeamWins: tagTeam.totalTagTeamWins,
            totalTagTeamLosses: tagTeam.totalTagTeamLosses,
            totalTagTeamDraws: tagTeam.totalTagTeamDraws,
            // Eligibility
            eligibility: 'ELIGIBLE',
            // Members
            members: {
              create: [
                { robotId: activeRobotId, slotIndex: 0 },
                { robotId: reserveRobotId, slotIndex: 1 },
              ],
            },
          },
        });

        // Track the mapping
        idMapping.set(oldId, newTeam.id);

        // Mark robots as now being on a team (for subsequent conflict checks within this loop)
        robotsOnTeams.add(activeRobotId);
        robotsOnTeams.add(reserveRobotId);

        // Update the idempotency lookup for subsequent iterations
        existingTeamLookup.set(idempotencyKey, newTeam.id);

        totalMigrated++;
        console.log(`  [MIGRATED] TagTeam #${oldId} → TeamBattle #${newTeam.id} "${teamName}"`);
      }
    });

    // Log summary
    console.log('\n' + '='.repeat(70));
    console.log('Migration Summary:');
    console.log(`  Total TagTeam rows processed:    ${totalProcessed}`);
    console.log(`  Successfully migrated:           ${totalMigrated}`);
    console.log(`  Skipped (robot conflict):        ${totalSkippedConflict}`);
    console.log(`  Skipped (idempotent):            ${totalSkippedIdempotent}`);
    console.log('='.repeat(70));

    if (totalMigrated + totalSkippedConflict + totalSkippedIdempotent !== totalProcessed) {
      console.warn('⚠ Warning: counts do not sum to total — some rows may have been handled unexpectedly');
    }

    console.log('\n✓ Migration completed successfully');
  } catch (error) {
    console.error('\n✗ Migration failed (transaction rolled back):', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// ─── Scheduled Match Migration (Task 1.5) ───────────────────────────────────

/**
 * Migrates existing ScheduledTagTeamMatch rows into ScheduledTeamBattleMatch rows.
 *
 * For each ScheduledTagTeamMatch:
 * - Maps team1Id and team2Id to the corresponding migrated TeamBattle.id using the ID mapping
 * - Sets matchMode = 'tag_team', teamSize = 2
 * - Preserves scheduledFor and status
 * - Sets teamBattleLeague from the original match's tagTeamLeague field
 * - Sets teamBattleLeagueId from the migrated team's tagTeamLeagueId (from the newly created TeamBattle row)
 * - Skips matches referencing teams that weren't migrated (conflict skip from task 1.4)
 *
 * Requirements: 7.2
 */
export async function migrateScheduledTagTeamMatches(
  idMapping: Map<number, number>
): Promise<{ totalMatches: number; migrated: number; skipped: number }> {
  console.log('\n--- Scheduled Match Migration (Task 1.5) ---');

  let totalMatches = 0;
  let migrated = 0;
  let skipped = 0;

  const scheduledMatches = await prisma.scheduledTagTeamMatch.findMany();
  totalMatches = scheduledMatches.length;

  console.log(`Total ScheduledTagTeamMatch rows to process: ${totalMatches}`);

  if (totalMatches === 0) {
    console.log('No scheduled tag team matches found. Migration not needed.');
    return { totalMatches, migrated, skipped };
  }

  await prisma.$transaction(async (tx) => {
    for (const match of scheduledMatches) {
      // Map team1Id to new TeamBattle.id
      const newTeam1Id = idMapping.get(match.team1Id);
      if (!newTeam1Id) {
        console.warn(
          `  [SKIP] ScheduledTagTeamMatch #${match.id} — team1Id=${match.team1Id} was not migrated (conflict skip). Skipping match.`
        );
        skipped++;
        continue;
      }

      // Map team2Id (nullable for bye-matches)
      let newTeam2Id: number | null = null;
      if (match.team2Id !== null) {
        const mappedTeam2 = idMapping.get(match.team2Id);
        if (!mappedTeam2) {
          console.warn(
            `  [SKIP] ScheduledTagTeamMatch #${match.id} — team2Id=${match.team2Id} was not migrated (conflict skip). Skipping match.`
          );
          skipped++;
          continue;
        }
        newTeam2Id = mappedTeam2;
      }

      // Retrieve the migrated team's tagTeamLeagueId for teamBattleLeagueId
      const migratedTeam = await tx.teamBattle.findUnique({
        where: { id: newTeam1Id },
        select: { tagTeamLeagueId: true },
      });
      const teamBattleLeagueId = migratedTeam?.tagTeamLeagueId ?? 'bronze_1';

      // Create ScheduledTeamBattleMatch row
      await tx.scheduledTeamBattleMatch.create({
        data: {
          team1Id: newTeam1Id,
          team2Id: newTeam2Id,
          teamSize: 2,
          matchMode: 'tag_team',
          teamBattleLeague: match.tagTeamLeague,
          teamBattleLeagueId,
          scheduledFor: match.scheduledFor,
          status: match.status,
        },
      });

      migrated++;
      console.log(
        `  [MIGRATED] ScheduledTagTeamMatch #${match.id} → ScheduledTeamBattleMatch (team1=${newTeam1Id}, team2=${newTeam2Id ?? 'bye'})`
      );
    }
  });

  console.log('\nScheduled Match Migration Summary:');
  console.log(`  Total matches processed:   ${totalMatches}`);
  console.log(`  Successfully migrated:     ${migrated}`);
  console.log(`  Skipped (missing team):    ${skipped}`);

  return { totalMatches, migrated, skipped };
}

// ─── League History Migration (Task 1.6) ─────────────────────────────────────

/**
 * Migrates existing LeagueHistory entries with `entityType = 'tag_team'` to reference
 * the new TeamBattle.id instead of the old TagTeam.id.
 *
 * For each LeagueHistory row where entityType = 'tag_team':
 * - Maps entityId (old TagTeam.id) to the new TeamBattle.id using the ID mapping
 * - If a LeagueHistory row references a TagTeam that was skipped (not in idMapping),
 *   logs a warning and leaves it unchanged
 * - Executes within a single transaction
 *
 * Requirements: 13.1
 */
export async function migrateLeagueHistory(
  idMapping: Map<number, number>
): Promise<{ totalEntries: number; migrated: number; skipped: number }> {
  console.log('\n--- League History Migration (Task 1.6) ---');

  let totalEntries = 0;
  let migrated = 0;
  let skipped = 0;

  const historyEntries = await prisma.leagueHistory.findMany({
    where: { entityType: 'tag_team' },
  });
  totalEntries = historyEntries.length;

  console.log(`Total LeagueHistory entries with entityType='tag_team': ${totalEntries}`);

  if (totalEntries === 0) {
    console.log('No tag team league history entries found. Migration not needed.');
    return { totalEntries, migrated, skipped };
  }

  await prisma.$transaction(async (tx) => {
    for (const entry of historyEntries) {
      const newEntityId = idMapping.get(entry.entityId);

      if (!newEntityId) {
        console.warn(
          `  [SKIP] LeagueHistory #${entry.id} — entityId=${entry.entityId} (old TagTeam.id) was not migrated. Leaving unchanged.`
        );
        skipped++;
        continue;
      }

      await tx.leagueHistory.update({
        where: { id: entry.id },
        data: { entityId: newEntityId },
      });

      migrated++;
      console.log(
        `  [MIGRATED] LeagueHistory #${entry.id} — entityId ${entry.entityId} → ${newEntityId}`
      );
    }
  });

  console.log('\nLeague History Migration Summary:');
  console.log(`  Total entries processed:   ${totalEntries}`);
  console.log(`  Successfully migrated:     ${migrated}`);
  console.log(`  Skipped (missing team):    ${skipped}`);

  return { totalEntries, migrated, skipped };
}

// ─── Main ────────────────────────────────────────────────────────────────────

// Only run when executed directly (not when imported by task 1.5 / 1.6)
if (require.main === module) {
  migrateTagTeamsToTeamBattle()
    .then(async () => {
      // After TagTeam migration, run scheduled match migration using the populated ID mapping
      await migrateScheduledTagTeamMatches(idMapping);
      // After scheduled match migration, run league history migration
      await migrateLeagueHistory(idMapping);
      console.log('\nExiting...');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nMigration failed with error:', error);
      process.exit(1);
    });
}

export { migrateTagTeamsToTeamBattle };
