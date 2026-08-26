/**
 * Cycle CSV Export Service
 * 
 * Exports cycle battle data to CSV format with streaming revenue column.
 * Requirements: 10.1-10.7
 */

import prisma from '../../lib/prisma';
import type { CycleEventPayload } from '../../types/snapshotTypes';

interface BattleCSVRow {
  cycle: number;
  battle_id: number;
  robot_id: number;
  robot_name: string;
  opponent_id: number;
  opponent_name: string;
  result: string;
  winnings: number;
  streaming_revenue: number;
  prestige_awarded: number;
  fame_awarded: number;
}

/**
 * Export cycle battle data to CSV format
 * @param cycleNumber - Cycle number to export
 * @returns CSV string with battle data
 */
export async function exportCycleBattlesToCSV(cycleNumber: number): Promise<string> {
  // Get all battle_complete events for this cycle
  // NEW: Each event is for ONE robot (not both)
  const battleEvents = await prisma.auditLog.findMany({
    where: {
      cycleNumber,
      eventType: 'battle_complete',
    },
    orderBy: { id: 'asc' },
  });

  const rows: BattleCSVRow[] = [];

  for (const event of battleEvents) {
    const payload = event.payload as unknown as CycleEventPayload;
    
    // Get robot details (this robot)
    const robot = await prisma.robot.findUnique({
      where: { id: event.robotId || 0 },
      select: { id: true, name: true },
    });
    
    // Get opponent details
    const opponent = await prisma.robot.findUnique({
      where: { id: payload.opponentId || 0 },
      select: { id: true, name: true },
    });

    if (!robot || !opponent) continue;

    // Add row for this robot (event already has all data for this robot)
    rows.push({
      cycle: cycleNumber,
      battle_id: event.battleId || 0,
      robot_id: robot.id,
      robot_name: robot.name,
      opponent_id: opponent.id,
      opponent_name: opponent.name,
      result: payload.result || 'unknown',
      winnings: payload.credits || 0,
      streaming_revenue: payload.isByeMatch ? 0 : (payload.streamingRevenue || 0),
      prestige_awarded: payload.prestige || 0,
      fame_awarded: payload.fame || 0,
    });
  }

  // NOTE: Tag team battles now emit per-robot 'battle_complete' events (via
  // logBattleAuditEvent in battlePostCombat.ts), so they are already captured
  // by the query above. The old 'tag_team_battle' event type is deprecated and
  // no longer emitted by new code.

  // Generate CSV
  // Eleven columns. A twelfth, `repair_cost`, was removed by Spec #48 Requirement 9
  // criteria 13-14: it was populated from `payload.repairCost`, which no orchestrator
  // has ever written, so it exported `0` on every row of every export since it was
  // added — a wrong number an admin could download.
  //
  // It was removed rather than repointed at Repair_Spend_Source, because a row here
  // is one battle participant and a `robot_repair` audit row carries no battle
  // reference: no repair figure can be attributed to an identified battle. If a
  // repair column is ever added back, source it from Repair_Spend_Source and state
  // the period it covers in the column name — and do not repeat a stable-level or
  // cycle-level total across that stable's rows, because anyone summing the column
  // would get a multiple of the true figure.
  const header = 'cycle,battle_id,robot_id,robot_name,opponent_id,opponent_name,result,winnings,streaming_revenue,prestige_awarded,fame_awarded\n';
  
  const csvRows = rows.map(row => {
    return `${row.cycle},${row.battle_id},${row.robot_id},"${row.robot_name}",${row.opponent_id},"${row.opponent_name}",${row.result},${row.winnings},${row.streaming_revenue},${row.prestige_awarded},${row.fame_awarded}`;
  }).join('\n');

  return header + csvRows;
}

/**
 * Export cycle battle data to CSV file
 * @param cycleNumber - Cycle number to export
 * @param filePath - Path to save CSV file
 */
export async function exportCycleBattlesToFile(cycleNumber: number, filePath: string): Promise<void> {
  const csv = await exportCycleBattlesToCSV(cycleNumber);
  const fs = await import('fs');
  fs.writeFileSync(filePath, csv, 'utf-8');
}
