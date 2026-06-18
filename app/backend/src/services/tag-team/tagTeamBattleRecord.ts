import { ScheduledTeamBattleMatch, Battle, Prisma } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import { CombatMessageGenerator } from '../battle/combatMessageGenerator';
import { TagTeamWithRobots, TagTeamBattleResult } from './tagTeamTypes';

/**
 * Create a battle record for a tag team match
 */
export async function createTagTeamBattleRecord(
  match: ScheduledTeamBattleMatch,
  team1: TagTeamWithRobots,
  team2: TagTeamWithRobots,
  result: TagTeamBattleResult
): Promise<Battle> {
  // Create battle record with tag team fields
  const battle = await prisma.battle.create({
    data: {
      robot1Id: team1.activeRobotId,
      robot2Id: team2.activeRobotId,
      winnerId: result.winnerId,
      battleType: 'tag_team',
      leagueType: match.teamBattleLeague,
      leagueInstanceId: team1.tagTeamLeagueId, // Snapshot instance at time of battle

      // Tag team specific fields
      team1ActiveRobotId: team1.activeRobotId,
      team1ReserveRobotId: team1.reserveRobotId,
      team2ActiveRobotId: team2.activeRobotId,
      team2ReserveRobotId: team2.reserveRobotId,
      team1TagOutTime: result.team1TagOutTime ? BigInt(Math.round(result.team1TagOutTime * 1000)) : null,
      team2TagOutTime: result.team2TagOutTime ? BigInt(Math.round(result.team2TagOutTime * 1000)) : null,

      // Battle log with all combat events, tag-out, and tag-in events (Requirement 7.1)
      // Convert raw simulator events + tag events into narrative messages
      battleLog: {
        events: CombatMessageGenerator.convertTagTeamEvents(result.battleLog, {
          team1Name: result.team1Name,
          team2Name: result.team2Name,
          battleType: 'tag_team',
          phases: result.phases,
          robot3Name: result.team1ReserveName,
          robot4Name: result.team2ReserveName,
        }),
        detailedCombatEvents: result.battleLog, // Keep raw events for admin debugging
        tagTeamBattle: true,
        team1TagOutTime: result.team1TagOutTime,
        team2TagOutTime: result.team2TagOutTime,
        // 2D arena spatial metadata
        arenaRadius: result.arenaRadius,
        startingPositions: result.startingPositions,
        endingPositions: result.endingPositions,
      } as unknown as Prisma.InputJsonValue,
      durationSeconds: result.durationSeconds,

      // Economic data (placeholder)
      winnerReward: 0,
      loserReward: 0,

      // ELO tracking (placeholder)
      robot1ELOBefore: team1.activeRobot.elo,
      robot2ELOBefore: team2.activeRobot.elo,
      robot1ELOAfter: team1.activeRobot.elo,
      robot2ELOAfter: team2.activeRobot.elo,
      eloChange: 0,
    },
  });

  // Create BattleParticipant records for all 4 robots
  // Note: Credits, prestige, and fame will be updated later in updateTagTeamStats
  await prisma.battleParticipant.createMany({
    data: [
      // Team 1 Active
      {
        battleId: battle.id,
        robotId: team1.activeRobotId,
        team: 1,
        role: 'active',
        credits: 0, // Will be updated later
        streamingRevenue: 0,
        eloBefore: team1.activeRobot.elo,
        eloAfter: team1.activeRobot.elo, // Will be updated later
        prestigeAwarded: 0, // Will be updated later
        fameAwarded: 0, // Will be updated later
        damageDealt: result.team1ActiveDamageDealt || 0,
        finalHP: result.team1ActiveFinalHP,
        yielded: false,
        destroyed: result.team1ActiveFinalHP === 0,
      },
      // Team 1 Reserve
      {
        battleId: battle.id,
        robotId: team1.reserveRobotId,
        team: 1,
        role: 'reserve',
        credits: 0, // Will be updated later
        streamingRevenue: 0,
        eloBefore: team1.reserveRobot.elo,
        eloAfter: team1.reserveRobot.elo, // Will be updated later
        prestigeAwarded: 0, // Will be updated later
        fameAwarded: 0, // Will be updated later
        damageDealt: result.team1ReserveDamageDealt || 0,
        finalHP: result.team1ReserveFinalHP,
        yielded: false,
        destroyed: result.team1ReserveFinalHP === 0,
      },
      // Team 2 Active
      {
        battleId: battle.id,
        robotId: team2.activeRobotId,
        team: 2,
        role: 'active',
        credits: 0, // Will be updated later
        streamingRevenue: 0,
        eloBefore: team2.activeRobot.elo,
        eloAfter: team2.activeRobot.elo, // Will be updated later
        prestigeAwarded: 0, // Will be updated later
        fameAwarded: 0, // Will be updated later
        damageDealt: result.team2ActiveDamageDealt || 0,
        finalHP: result.team2ActiveFinalHP,
        yielded: false,
        destroyed: result.team2ActiveFinalHP === 0,
      },
      // Team 2 Reserve
      {
        battleId: battle.id,
        robotId: team2.reserveRobotId,
        team: 2,
        role: 'reserve',
        credits: 0, // Will be updated later
        streamingRevenue: 0,
        eloBefore: team2.reserveRobot.elo,
        eloAfter: team2.reserveRobot.elo, // Will be updated later
        prestigeAwarded: 0, // Will be updated later
        fameAwarded: 0, // Will be updated later
        damageDealt: result.team2ReserveDamageDealt || 0,
        finalHP: result.team2ReserveFinalHP,
        yielded: false,
        destroyed: result.team2ReserveFinalHP === 0,
      },
    ],
  });

  return battle;
}
