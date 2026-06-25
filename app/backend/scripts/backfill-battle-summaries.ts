/**
 * Backfill Battle Summaries — Memory-Safe Version (Spec #39)
 *
 * Processes ONE battle at a time via raw SQL cursor to avoid loading
 * 900KB battle_log blobs into Node memory in batches.
 *
 * Run: npx dotenv-cli -e .env -- npx tsx scripts/backfill-battle-summaries.ts
 *
 * Safe to re-run: skips battles that already have a summary row.
 * Env vars:
 *   BACKFILL_BATCH_SIZE=50 (how many to process before sleeping)
 *   BACKFILL_SLEEP_MS=200 (sleep between batches)
 *   BACKFILL_START_ID=0 (resume from a specific battle ID)
 */

import { PrismaClient } from '../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { computeBattleStatistics } from '../src/shared/utils/battleStatistics';
import type { BattleLogEvent } from '../src/shared/utils/battleStatistics';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter, log: ['error'] });

const BATCH_SIZE = parseInt(process.env.BACKFILL_BATCH_SIZE || '50', 10);
const SLEEP_MS = parseInt(process.env.BACKFILL_SLEEP_MS || '200', 10);
const START_ID = parseInt(process.env.BACKFILL_START_ID || '0', 10);

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface BattleRow {
  id: number;
  battle_type: string;
  duration_seconds: number;
  winning_side: number | null;
}

async function main(): Promise<void> {
  console.log(`[backfill] Starting (batch=${BATCH_SIZE}, sleep=${SLEEP_MS}ms, startId=${START_ID})`);
  const startTime = Date.now();
  let cursor = START_ID;
  let totalWritten = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  while (true) {
    // Find next batch of battle IDs that need summaries
    const battles = await prisma.$queryRaw<BattleRow[]>`
      SELECT b.id, b.battle_type, b.duration_seconds, b.winning_side
      FROM battles b
      WHERE b.id > ${cursor}
        AND b.battle_log IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM battle_summaries bs WHERE bs.battle_id = b.id)
      ORDER BY b.id ASC
      LIMIT ${BATCH_SIZE}
    `;

    if (battles.length === 0) break;

    for (const battle of battles) {
      cursor = battle.id;

      try {
        // Load battle_log for this single battle only
        const logRow = await prisma.$queryRaw<[{ battle_log: unknown }]>`
          SELECT battle_log FROM battles WHERE id = ${battle.id}
        `;
        const battleLog = logRow[0]?.battle_log as Record<string, unknown> | null;
        if (!battleLog) { totalSkipped++; continue; }

        // Extract events
        const events = (battleLog.detailedCombatEvents ?? battleLog.events ?? []) as BattleLogEvent[];
        if (!Array.isArray(events) || events.length === 0) { totalSkipped++; continue; }

        // Load participants for this battle
        const participants = await prisma.$queryRaw<{ robot_id: number; team: number; final_hp: number; destroyed: boolean; yielded: boolean }[]>`
          SELECT robot_id, team, final_hp, destroyed, yielded FROM battle_participants WHERE battle_id = ${battle.id}
        `;

        // Load robot names + maxHP for the participants
        const robotIds = participants.map(p => p.robot_id);
        const robots = await prisma.$queryRaw<{ id: number; name: string; max_hp: number }[]>`
          SELECT id, name, max_hp FROM robots WHERE id = ANY(${robotIds}::int[])
        `;
        const robotMap = new Map(robots.map(r => [r.id, r]));

        // Build inputs for computation
        const robotMaxHP: Record<string, number> = {};
        const robotNameToId: Record<string, number> = {};
        const robotNameToTeam: Record<string, number> = {};
        for (const p of participants) {
          const robot = robotMap.get(p.robot_id);
          if (robot) {
            robotMaxHP[robot.name] = robot.max_hp;
            robotNameToId[robot.name] = robot.id;
            robotNameToTeam[robot.name] = p.team;
          }
        }

        // Build tagTeamInfo for team battles
        let tagTeamInfo: { team1Robots: string[]; team2Robots: string[] } | undefined;
        if (['tag_team', 'league_2v2', 'league_3v3', 'tournament_2v2', 'tournament_3v3'].includes(battle.battle_type)) {
          const team1Robots = participants.filter(p => p.team === 1).map(p => robotMap.get(p.robot_id)?.name).filter(Boolean) as string[];
          const team2Robots = participants.filter(p => p.team === 2).map(p => robotMap.get(p.robot_id)?.name).filter(Boolean) as string[];
          if (team1Robots.length > 0) tagTeamInfo = { team1Robots, team2Robots };
        }

        // Compute statistics
        const stats = computeBattleStatistics(events, battle.duration_seconds, battle.battle_type, tagTeamInfo, robotMaxHP);

        // Build participant survival summary
        const participantsSummary = participants.map(p => {
          const robot = robotMap.get(p.robot_id);
          const robotStats = robot ? stats.perRobot.find(r => r.robotName === robot.name) : null;
          return {
            robotId: p.robot_id,
            team: p.team,
            survivalSeconds: (p.destroyed || p.yielded)
              ? (robotStats?.exitTime ?? battle.duration_seconds)
              : battle.duration_seconds,
          };
        });

        // Extract metadata
        const kothPlacements = battleLog.placements ?? null;
        const kothData = battleLog.kothData ?? null;
        const startingPositions = battleLog.startingPositions ?? null;
        const endingPositions = battleLog.endingPositions ?? null;
        const arenaRadius = typeof battleLog.arenaRadius === 'number' ? battleLog.arenaRadius : null;

        // Write summary
        await prisma.$executeRaw`
          INSERT INTO battle_summaries (battle_id, per_robot, per_team, damage_flows, participants, koth_placements, koth_data, starting_positions, ending_positions, arena_radius, battle_duration, total_events, has_data, created_at)
          VALUES (
            ${battle.id},
            ${JSON.stringify(stats.perRobot)}::jsonb,
            ${stats.perTeam ? JSON.stringify(stats.perTeam.map(t => ({ teamName: t.teamName, robots: t.robots.map(r => r.robotName), totalDamageDealt: t.totalDamageDealt, totalDamageReceived: t.totalDamageReceived, totalHits: t.totalHits, totalMisses: t.totalMisses, totalCriticals: t.totalCriticals }))) : null}::jsonb,
            ${JSON.stringify(stats.damageFlows)}::jsonb,
            ${JSON.stringify(participantsSummary)}::jsonb,
            ${kothPlacements ? JSON.stringify(kothPlacements) : null}::jsonb,
            ${kothData ? JSON.stringify(kothData) : null}::jsonb,
            ${startingPositions ? JSON.stringify(startingPositions) : null}::jsonb,
            ${endingPositions ? JSON.stringify(endingPositions) : null}::jsonb,
            ${arenaRadius},
            ${battle.duration_seconds},
            ${stats.totalEvents},
            ${stats.hasData},
            NOW()
          )
          ON CONFLICT (battle_id) DO NOTHING
        `;

        // Also populate winning_side if missing
        if (battle.winning_side === null && battleLog.winningSide) {
          const ws = battleLog.winningSide as number;
          if (ws === 1 || ws === 2) {
            await prisma.$executeRaw`UPDATE battles SET winning_side = ${ws} WHERE id = ${battle.id}`;
          }
        }

        totalWritten++;

        // Explicitly null out the large objects to help GC
        (logRow as unknown) = null;
      } catch (err) {
        totalErrors++;
        if (totalErrors <= 10) {
          console.error(`[backfill] Error on battle ${battle.id}:`, err instanceof Error ? err.message : String(err));
        }
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[backfill] Progress: ${totalWritten} written, ${totalSkipped} skipped, ${totalErrors} errors, cursor=${cursor}, ${elapsed}s`);
    await sleep(SLEEP_MS);
  }

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[backfill] Complete! ${totalWritten} summaries written, ${totalSkipped} skipped, ${totalErrors} errors in ${totalElapsed}s`);
}

main()
  .catch(err => { console.error('[backfill] Fatal error:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
