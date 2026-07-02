import { StandingsMode, Prisma } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { RobotWithWeapons } from '../battle/combatSimulator';
import { TagTeamError, TagTeamErrorCode } from '../../errors/tagTeamErrors';
import { prepareRobotForCombat } from '../../utils/robotCalculations';
import { getTuningBonusesBatch } from '../tuning-pool';
import { TagTeamWithRobots, TagTeamBattleResult } from './tagTeamTypes';
import { createByeTeamForBattle } from './tagTeamByeTeam';
import { simulateTagTeamBattle } from './tagTeamSimulation';
import { createTagTeamBattleRecord } from './tagTeamBattleRecord';
import { updateTagTeamBattleResults, checkTeamReadinessForBattle } from './tagTeamResultUpdater';

// ─── Scheduled Match Shape (mapped from unified table) ───────────────────────

/** Shape of a scheduled tag team match as mapped from the unified scheduling table. */
interface ScheduledTagTeamMatchData {
  id: number;
  team1Id: number;
  team2Id: number | null;
  teamSize: number;
  matchMode: string;
  teamBattleLeague: string;
  teamBattleLeagueId: string;
  scheduledFor: Date;
  status: string;
  cancelReason: string | null;
  createdAt: Date;
  team1: Prisma.TeamBattleGetPayload<{ include: { members: { include: { robot: true } } } }>;
  team2: Prisma.TeamBattleGetPayload<{ include: { members: { include: { robot: true } } } }> | null;
}

/**
 * Execute a tag team battle
 * Requirement 3.1: Initialize battle with both teams' active robots
 * Requirement 12.3: Execute normal battle against bye-team
 */
export async function executeTagTeamBattle(match: ScheduledTagTeamMatchData): Promise<TagTeamBattleResult> {
  // R1.8: Reject payloads with team battle league types
  if (match.matchMode !== 'tag_team') {
    throw new TagTeamError(
      TagTeamErrorCode.INVALID_TEAM_COMPOSITION,
      'Tag Team Orchestrator cannot process non-tag_team match modes',
      400,
    );
  }

  // Check if this is a bye-team match
  const _isByeMatch = match.team2Id === null;
  
  // Spec #34: include refinements so prepareRobotForCombat can fold them
  // into the weapon's effective stats before the simulator reads them.
  // Load from TeamBattle with members (slotIndex 0 = active, slotIndex 1 = reserve)
  const team1Raw = await prisma.teamBattle.findUnique({
    where: { id: match.team1Id },
    include: {
      members: {
        include: {
          robot: {
            include: {
              mainWeapon: { include: { weapon: true, refinements: { orderBy: { slotIndex: 'asc' } } } },
              offhandWeapon: { include: { weapon: true, refinements: { orderBy: { slotIndex: 'asc' } } } },
            },
          },
        },
        orderBy: { slotIndex: 'asc' },
      },
    },
  });

  // Map TeamBattle members to TagTeamWithRobots interface
  let team1: TagTeamWithRobots | null = null;
  if (team1Raw && team1Raw.members.length >= 2) {
    // Read league data from standings (source of truth)
    const team1Standing = await prisma.standing.findFirst({
      where: { entityType: 'team', entityId: team1Raw.id, mode: StandingsMode.tag_team },
    });

    if (!team1Standing) {
      logger.warn(`[TagTeamBattle] No standing found for team ${team1Raw.id} in tag_team mode — skipping match`);
      throw new TagTeamError(
        TagTeamErrorCode.TAG_TEAM_NOT_FOUND,
        `No tag_team standing for team ${team1Raw.id}`,
        404,
        { teamId: team1Raw.id }
      );
    }

    team1 = {
      id: team1Raw.id,
      stableId: team1Raw.stableId,
      teamName: team1Raw.teamName,
      teamSize: team1Raw.teamSize,
      activeRobotId: team1Raw.members[0].robotId,
      reserveRobotId: team1Raw.members[1].robotId,
      activeRobot: team1Raw.members[0].robot as RobotWithWeapons,
      reserveRobot: team1Raw.members[1].robot as RobotWithWeapons,
      createdAt: team1Raw.createdAt,
      updatedAt: team1Raw.updatedAt,
    };
  }

  // Load team2
  let team2: TagTeamWithRobots | null;
  if (match.team2Id === null) {
    team2 = createByeTeamForBattle();
  } else {
    const team2Raw = await prisma.teamBattle.findUnique({
      where: { id: match.team2Id },
      include: {
        members: {
          include: {
            robot: {
              include: {
                mainWeapon: { include: { weapon: true, refinements: { orderBy: { slotIndex: 'asc' } } } },
                offhandWeapon: { include: { weapon: true, refinements: { orderBy: { slotIndex: 'asc' } } } },
              },
            },
          },
          orderBy: { slotIndex: 'asc' },
        },
      },
    });

    if (team2Raw && team2Raw.members.length >= 2) {
      // Read league data from standings (source of truth)
      const team2Standing = await prisma.standing.findFirst({
        where: { entityType: 'team', entityId: team2Raw.id, mode: StandingsMode.tag_team },
      });

      if (!team2Standing) {
        logger.warn(`[TagTeamBattle] No standing found for team ${team2Raw.id} in tag_team mode — treating as null`);
        team2 = null;
      } else {
        team2 = {
          id: team2Raw.id,
          stableId: team2Raw.stableId,
          teamName: team2Raw.teamName,
          teamSize: team2Raw.teamSize,
          activeRobotId: team2Raw.members[0].robotId,
          reserveRobotId: team2Raw.members[1].robotId,
          activeRobot: team2Raw.members[0].robot as RobotWithWeapons,
          reserveRobot: team2Raw.members[1].robot as RobotWithWeapons,
          createdAt: team2Raw.createdAt,
          updatedAt: team2Raw.updatedAt,
        };
      }
    } else {
      team2 = null;
    }
  }

  if (!team1 || !team2) {
    throw new TagTeamError(
      TagTeamErrorCode.TAG_TEAM_NOT_FOUND,
      `Teams not found for match ${match.id}`,
      404,
      { matchId: match.id, team1Id: match.team1Id, team2Id: match.team2Id }
    );
  }

  // Start battle with active robots at full HP
  // Fetch tuning bonuses in a single batch query and prepare all robots for combat
  const allRobotIds = [team1.activeRobot.id, team1.reserveRobot.id, team2.activeRobot.id, team2.reserveRobot.id];
  const tuningMap = await getTuningBonusesBatch(allRobotIds);
  prepareRobotForCombat(team1.activeRobot, tuningMap.get(team1.activeRobot.id) ?? {});
  prepareRobotForCombat(team1.reserveRobot, tuningMap.get(team1.reserveRobot.id) ?? {});
  prepareRobotForCombat(team2.activeRobot, tuningMap.get(team2.activeRobot.id) ?? {});
  prepareRobotForCombat(team2.reserveRobot, tuningMap.get(team2.reserveRobot.id) ?? {});

  // Simulate the tag team battle
  const result = await simulateTagTeamBattle(team1 as TagTeamWithRobots, team2 as TagTeamWithRobots);
  
  // Bye matches can never be a draw — the real team always wins on timeout
  if (_isByeMatch && result.isDraw) {
    result.isDraw = false;
    result.winnerId = match.team1Id; // Real team is always team1 for bye matches
  }

  // Map robot winner ID to team winner ID if needed
  if (result.winnerId) {
    // Check which team the winning robot belongs to
    if (result.winnerId === team1.activeRobotId || result.winnerId === team1.reserveRobotId) {
      result.winnerId = team1.id;
    } else if (result.winnerId === team2.activeRobotId || result.winnerId === team2.reserveRobotId) {
      result.winnerId = team2.id;
    }
  }

  // Create battle record
  const battle = await createTagTeamBattleRecord(match, team1 as TagTeamWithRobots, team2 as TagTeamWithRobots, result);
  result.battleId = battle.id;

  // Update match status in unified table
  await prisma.scheduledMatch.update({
    where: { id: match.id },
    data: {
      status: 'completed',
    },
  });

  logger.info(
    `[TagTeamBattle] Completed: ${team1.teamName} vs ${team2.teamName} ` +
    `(Winner: ${result.winnerId ? `Team ${result.winnerId}` : 'Draw'})`
  );

  return result;
}

/**
 * Execute all scheduled tag team battles
 * Requirements 11.1, 11.2, 11.3, 11.4: Multi-match scheduling and execution
 * 
 * This function processes all scheduled tag team matches, checking robot readiness
 * before each match to handle cumulative damage from earlier matches (including 1v1).
 * 
 * @param _scheduledFor - Optional date filter for matches to execute
 * @returns Summary of executed battles
 */
export async function executeScheduledTagTeamBattles(_scheduledFor?: Date): Promise<{
  totalBattles: number;
  wins: number;
  draws: number;
  losses: number;
  skippedDueToUnreadyRobots: number;
}> {
  // Query scheduled tag team matches from unified table (Spec #40)
  const unifiedMatches = await prisma.scheduledMatch.findMany({
    where: {
      status: 'scheduled',
      matchType: 'tag_team',
    },
    include: { participants: true },
    orderBy: { scheduledFor: 'asc' },
  });

  // Load team data with members+robots for each match
  const scheduledMatches = [];
  for (const um of unifiedMatches) {
    const p1 = um.participants.find(p => p.slot === 1);
    const p2 = um.participants.find(p => p.slot === 2);
    if (!p1) continue;

    const team1 = await prisma.teamBattle.findUnique({
      where: { id: p1.participantId },
      include: { members: { include: { robot: true }, orderBy: { slotIndex: 'asc' } } },
    });
    const team2 = p2 ? await prisma.teamBattle.findUnique({
      where: { id: p2.participantId },
      include: { members: { include: { robot: true }, orderBy: { slotIndex: 'asc' } } },
    }) : null;

    if (!team1) continue;

    scheduledMatches.push({
      id: um.id,
      team1Id: p1.participantId,
      team2Id: p2?.participantId ?? null,
      teamSize: 2,
      matchMode: 'tag_team',
      teamBattleLeague: um.leagueType ?? 'bronze',
      teamBattleLeagueId: um.leagueInstanceId ?? 'bronze_1',
      scheduledFor: um.scheduledFor,
      status: um.status,
      cancelReason: um.cancelReason ?? null,
      createdAt: um.createdAt,
      team1,
      team2,
    });
  }

  logger.info(`[TagTeamBattles] Found ${scheduledMatches.length} scheduled tag team matches`);

  let totalBattles = 0;
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let skippedDueToUnreadyRobots = 0;

  for (const match of scheduledMatches) {
    try {
      // Skip readiness check for bye-team matches (bye-teams are always ready)
      const isByeMatch = match.team2Id === null;
      
      if (!isByeMatch) {
        // Requirement 11.3: Dynamic eligibility checking
        // Check if both teams are ready (may have taken damage in earlier matches)
        const team1Ready = await checkTeamReadinessForBattle(match.team1);
        const team2Ready = match.team2 ? await checkTeamReadinessForBattle(match.team2) : true; // Bye matches are always ready

        if (!team1Ready || !team2Ready) {
          logger.info(
            `[TagTeamBattles] Skipping match ${match.id}: ` +
            `Team ${match.team1Id} ready: ${team1Ready}, Team ${match.team2Id} ready: ${team2Ready}`
          );
          
          // Mark match as cancelled in unified scheduling table
          await prisma.scheduledMatch.update({
            where: { id: match.id },
            data: { status: 'cancelled', cancelReason: 'Team robots not battle-ready' },
          });
          
          skippedDueToUnreadyRobots++;
          continue;
        }
      }

      // Execute the battle
      const result = await executeTagTeamBattle(match);
      totalBattles++;

      if (result.isDraw) {
        draws++;
      } else if (result.winnerId === match.team1Id) {
        wins++;
      } else {
        losses++;
      }

      // Update robot stats and apply rewards (streaming revenue tracked inside)
      await updateTagTeamBattleResults(match, result);

    } catch (error) {
      logger.error(`[TagTeamBattles] Error executing match ${match.id}:`, error);
      
      // Mark match as cancelled on error (unified table)
      await prisma.scheduledMatch.update({
        where: { id: match.id },
        data: { status: 'cancelled', cancelReason: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  logger.info(
    `[TagTeamBattles] Execution complete: ${totalBattles} battles, ` +
    `${wins} wins, ${draws} draws, ${losses} losses, ` +
    `${skippedDueToUnreadyRobots} skipped due to unready robots`
  );

  return {
    totalBattles,
    wins,
    draws,
    losses,
    skippedDueToUnreadyRobots,
  };
}
