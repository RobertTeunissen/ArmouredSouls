/**
 * Cycle CSV Export Service
 * 
 * Exports cycle battle data to CSV format with streaming revenue column.
 * Requirements: 10.1-10.7
 */

import prisma from '../lib/prisma';

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
  repair_cost: number;
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
  const battleEvents = await prisma.auditLog.findMany({
    where: {
      cycleNumber,
      eventType: 'battle_complete',
    },
    orderBy: { id: 'asc' },
  });

  const rows: BattleCSVRow[] = [];

  for (const event of battleEvents) {
    const payload = event.payload as any;
    
    // Get robot details
    const robot1 = await prisma.robot.findUnique({
      where: { id: payload.robot1Id },
      select: { id: true, name: true },
    });
    
    const robot2 = await prisma.robot.findUnique({
      where: { id: payload.robot2Id },
      select: { id: true, name: true },
    });

    if (!robot1 || !robot2) continue;

    const isByeMatch = payload.isByeMatch || false;
    const isDraw = payload.isDraw || false;
    const winnerId = payload.winnerId;

    // Determine results for each robot
    let robot1Result = 'loss';
    let robot2Result = 'loss';
    
    if (isDraw) {
      robot1Result = 'draw';
      robot2Result = 'draw';
    } else if (winnerId === robot1.id) {
      robot1Result = 'win';
      robot2Result = 'loss';
    } else if (winnerId === robot2.id) {
      robot1Result = 'loss';
      robot2Result = 'win';
    }

    // Add row for robot1
    rows.push({
      cycle: cycleNumber,
      battle_id: payload.battleId,
      robot_id: robot1.id,
      robot_name: robot1.name,
      opponent_id: robot2.id,
      opponent_name: robot2.name,
      result: robot1Result,
      winnings: robot1Result === 'win' ? (payload.winnerReward || 0) : (payload.loserReward || 0),
      streaming_revenue: isByeMatch ? 0 : (payload.streamingRevenue1 || 0),
      repair_cost: payload.robot1RepairCost || 0,
      prestige_awarded: payload.robot1PrestigeAwarded || 0,
      fame_awarded: payload.robot1FameAwarded || 0,
    });

    // Add row for robot2
    rows.push({
      cycle: cycleNumber,
      battle_id: payload.battleId,
      robot_id: robot2.id,
      robot_name: robot2.name,
      opponent_id: robot1.id,
      opponent_name: robot1.name,
      result: robot2Result,
      winnings: robot2Result === 'win' ? (payload.winnerReward || 0) : (payload.loserReward || 0),
      streaming_revenue: isByeMatch ? 0 : (payload.streamingRevenue2 || 0),
      repair_cost: payload.robot2RepairCost || 0,
      prestige_awarded: payload.robot2PrestigeAwarded || 0,
      fame_awarded: payload.robot2FameAwarded || 0,
    });
  }

  // Get tag team battle events for this cycle
  const tagTeamEvents = await prisma.auditLog.findMany({
    where: {
      cycleNumber,
      eventType: 'tag_team_battle',
    },
    orderBy: { id: 'asc' },
  });

  for (const event of tagTeamEvents) {
    const payload = event.payload as any;
    
    // Get team details
    const team1 = await prisma.tagTeam.findUnique({
      where: { id: payload.team1Id },
      include: {
        activeRobot: true,
        reserveRobot: true,
      },
    });
    
    const team2 = payload.team2Id ? await prisma.tagTeam.findUnique({
      where: { id: payload.team2Id },
      include: {
        activeRobot: true,
        reserveRobot: true,
      },
    }) : null;

    if (!team1) continue;

    const isByeMatch = !team2;
    const isDraw = payload.isDraw || false;
    const winnerId = payload.winnerId;

    // Determine results
    let team1Result = 'loss';
    let team2Result = 'loss';
    
    if (isDraw) {
      team1Result = 'draw';
      team2Result = 'draw';
    } else if (winnerId === team1.id) {
      team1Result = 'win';
      team2Result = 'loss';
    } else if (team2 && winnerId === team2.id) {
      team1Result = 'loss';
      team2Result = 'win';
    }

    // Add row for team1 (using active robot as representative)
    rows.push({
      cycle: cycleNumber,
      battle_id: payload.battleId,
      robot_id: team1.activeRobot.id,
      robot_name: `${team1.activeRobot.name} (Team)`,
      opponent_id: team2?.activeRobot.id || 0,
      opponent_name: team2 ? `${team2.activeRobot.name} (Team)` : 'Bye',
      result: team1Result,
      winnings: team1Result === 'win' ? (payload.winnerReward || 0) : (payload.loserReward || 0),
      streaming_revenue: isByeMatch ? 0 : (payload.streamingRevenue1 || 0),
      repair_cost: (payload.team1Robot1RepairCost || 0) + (payload.team1Robot2RepairCost || 0),
      prestige_awarded: payload.team1PrestigeAwarded || 0,
      fame_awarded: payload.team1FameAwarded || 0,
    });

    // Add row for team2 if not bye match
    if (team2) {
      rows.push({
        cycle: cycleNumber,
        battle_id: payload.battleId,
        robot_id: team2.activeRobot.id,
        robot_name: `${team2.activeRobot.name} (Team)`,
        opponent_id: team1.activeRobot.id,
        opponent_name: `${team1.activeRobot.name} (Team)`,
        result: team2Result,
        winnings: team2Result === 'win' ? (payload.winnerReward || 0) : (payload.loserReward || 0),
        streaming_revenue: payload.streamingRevenue2 || 0,
        repair_cost: (payload.team2Robot1RepairCost || 0) + (payload.team2Robot2RepairCost || 0),
        prestige_awarded: payload.team2PrestigeAwarded || 0,
        fame_awarded: payload.team2FameAwarded || 0,
      });
    }
  }

  // Generate CSV
  const header = 'cycle,battle_id,robot_id,robot_name,opponent_id,opponent_name,result,winnings,streaming_revenue,repair_cost,prestige_awarded,fame_awarded\n';
  
  const csvRows = rows.map(row => {
    return `${row.cycle},${row.battle_id},${row.robot_id},"${row.robot_name}",${row.opponent_id},"${row.opponent_name}",${row.result},${row.winnings},${row.streaming_revenue},${row.repair_cost},${row.prestige_awarded},${row.fame_awarded}`;
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
