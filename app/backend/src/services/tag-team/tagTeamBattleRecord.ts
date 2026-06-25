import { Battle, Prisma } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { CombatMessageGenerator } from '../battle/combatMessageGenerator';
import { computeBattleSummary } from '../battle/battleSummaryComputer';
import { TagTeamWithRobots, TagTeamBattleResult } from './tagTeamTypes';

/** Minimal shape of a scheduled tag-team match as passed from the orchestrator. */
interface TagTeamMatchInput {
  id: number;
  team1Id: number;
  team2Id: number | null;
  teamBattleLeague: string;
  teamBattleLeagueId: string;
}

/**
 * Create a battle record for a tag team match
 */
export async function createTagTeamBattleRecord(
  match: TagTeamMatchInput,
  team1: TagTeamWithRobots,
  team2: TagTeamWithRobots,
  result: TagTeamBattleResult
): Promise<Battle> {
  // Create battle record with tag team fields
  // For bye matches, use team1's active robot for both FK slots (same pattern as team battles)
  const isByeMatch = team2.activeRobotId < 0;
  const battle = await prisma.battle.create({
    data: {
      robot1Id: team1.activeRobotId,
      robot2Id: isByeMatch ? team1.activeRobotId : team2.activeRobotId,
      winnerId: result.winnerId,
      battleType: 'tag_team',
      leagueType: match.teamBattleLeague,
      leagueInstanceId: match.teamBattleLeagueId, // Snapshot instance at time of battle

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

  // Create BattleParticipant records for real robots only
  // Note: Credits, prestige, and fame will be updated later in updateTagTeamStats
  // Skip bye robots (negative IDs) — they don't exist in the robots table (same pattern as teamBattleOrchestrator)
  const participantRows = [
    // Team 1 Active
    {
      battleId: battle.id,
      robotId: team1.activeRobotId,
      team: 1,
      role: 'active' as string | null,
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
      role: 'reserve' as string | null,
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
      role: 'active' as string | null,
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
      role: 'reserve' as string | null,
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
  ].filter(p => p.robotId > 0); // Skip bye robots (negative IDs)

  await prisma.battleParticipant.createMany({ data: participantRows });

  // Write pre-computed battle summary (Spec #39)
  // Determine winning side for tag team (team entity ID based)
  const winningSide = result.winnerId === team1.id ? 1 : result.winnerId === team2.id ? 2 : null;
  if (winningSide !== null) {
    await prisma.battle.update({ where: { id: battle.id }, data: { winningSide } }).catch(() => {});
  }

  const summaryData = computeBattleSummary({
    events: (result.battleLog || []) as unknown as import('../../shared/utils/battleStatistics').BattleLogEvent[],
    duration: result.durationSeconds,
    battleType: 'tag_team',
    robotMaxHP: {
      [team1.activeRobot.name]: team1.activeRobot.maxHP,
      [team1.reserveRobot.name]: team1.reserveRobot.maxHP,
      ...(team2.activeRobotId > 0 ? { [team2.activeRobot.name]: team2.activeRobot.maxHP } : {}),
      ...(team2.reserveRobotId > 0 ? { [team2.reserveRobot.name]: team2.reserveRobot.maxHP } : {}),
    },
    robotNameToId: {
      [team1.activeRobot.name]: team1.activeRobotId,
      [team1.reserveRobot.name]: team1.reserveRobotId,
      ...(team2.activeRobotId > 0 ? { [team2.activeRobot.name]: team2.activeRobotId } : {}),
      ...(team2.reserveRobotId > 0 ? { [team2.reserveRobot.name]: team2.reserveRobotId } : {}),
    },
    robotNameToTeam: {
      [team1.activeRobot.name]: 1,
      [team1.reserveRobot.name]: 1,
      ...(team2.activeRobotId > 0 ? { [team2.activeRobot.name]: 2 } : {}),
      ...(team2.reserveRobotId > 0 ? { [team2.reserveRobot.name]: 2 } : {}),
    },
    tagTeamInfo: {
      team1Robots: [team1.activeRobot.name, team1.reserveRobot.name],
      team2Robots: team2.activeRobotId > 0 ? [team2.activeRobot.name, team2.reserveRobot.name] : [],
    },
    startingPositions: result.startingPositions as Record<string, { x: number; y: number }> | undefined,
    endingPositions: result.endingPositions as Record<string, { x: number; y: number }> | undefined,
    arenaRadius: result.arenaRadius,
  });
  if (summaryData) {
    await prisma.battleSummary.create({
      data: { battleId: battle.id, ...summaryData },
    }).catch((err: unknown) => {
      logger.warn('[tag-team] Failed to write battle summary', { battleId: battle.id, error: err instanceof Error ? err.message : String(err) });
    });
  }

  return battle;
}
