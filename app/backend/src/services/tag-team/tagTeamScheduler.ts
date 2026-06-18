import { Robot, TeamBattle, ScheduledTeamBattleMatch, Prisma } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { RobotWithWeapons } from '../battle/combatSimulator';
import {
  logBattleAuditEvent,
  awardCreditsToUser,
  awardPrestigeToUser,
  awardStreamingRevenueForParticipant,
  checkAndAwardAchievements,
  didRobotLosePreviousBattle,
} from '../battle/battlePostCombat';
import { TagTeamError, TagTeamErrorCode } from '../../errors/tagTeamErrors';
import { prepareRobotForCombat } from '../../utils/robotCalculations';
import { getTuningBonusesBatch } from '../tuning-pool';
import { TagTeamWithRobots, TagTeamBattleResult } from './tagTeamTypes';
import { createByeTeamForBattle } from './tagTeamByeTeam';
import { simulateTagTeamBattle } from './tagTeamSimulation';
import { createTagTeamBattleRecord } from './tagTeamBattleRecord';
import {
  calculateTagTeamRewards,
  calculateTagTeamELOChanges,
  calculateTagTeamLeaguePoints,
  calculateTagTeamPrestige,
  calculateTagTeamFame,
} from './tagTeamRewards';

/**
 * Execute a tag team battle
 * Requirement 3.1: Initialize battle with both teams' active robots
 * Requirement 12.3: Execute normal battle against bye-team
 */
export async function executeTagTeamBattle(match: ScheduledTeamBattleMatch): Promise<TagTeamBattleResult> {
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
    team1 = {
      id: team1Raw.id,
      stableId: team1Raw.stableId,
      teamName: team1Raw.teamName,
      teamSize: team1Raw.teamSize,
      activeRobotId: team1Raw.members[0].robotId,
      reserveRobotId: team1Raw.members[1].robotId,
      activeRobot: team1Raw.members[0].robot as RobotWithWeapons,
      reserveRobot: team1Raw.members[1].robot as RobotWithWeapons,
      tagTeamLp: team1Raw.tagTeamLp,
      tagTeamLeague: team1Raw.tagTeamLeague,
      tagTeamLeagueId: team1Raw.tagTeamLeagueId,
      cyclesInTagTeamLeague: team1Raw.cyclesInTagTeamLeague,
      totalTagTeamWins: team1Raw.totalTagTeamWins,
      totalTagTeamLosses: team1Raw.totalTagTeamLosses,
      totalTagTeamDraws: team1Raw.totalTagTeamDraws,
      createdAt: team1Raw.createdAt,
      updatedAt: team1Raw.updatedAt,
    };
  }

  // Load team2
  let team2: TagTeamWithRobots | null;
  if (match.team2Id === null) {
    team2 = createByeTeamForBattle(match.teamBattleLeague, match.teamBattleLeague + '_1');
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
      team2 = {
        id: team2Raw.id,
        stableId: team2Raw.stableId,
        teamName: team2Raw.teamName,
        teamSize: team2Raw.teamSize,
        activeRobotId: team2Raw.members[0].robotId,
        reserveRobotId: team2Raw.members[1].robotId,
        activeRobot: team2Raw.members[0].robot as RobotWithWeapons,
        reserveRobot: team2Raw.members[1].robot as RobotWithWeapons,
        tagTeamLp: team2Raw.tagTeamLp,
        tagTeamLeague: team2Raw.tagTeamLeague,
        tagTeamLeagueId: team2Raw.tagTeamLeagueId,
        cyclesInTagTeamLeague: team2Raw.cyclesInTagTeamLeague,
        totalTagTeamWins: team2Raw.totalTagTeamWins,
        totalTagTeamLosses: team2Raw.totalTagTeamLosses,
        totalTagTeamDraws: team2Raw.totalTagTeamDraws,
        createdAt: team2Raw.createdAt,
        updatedAt: team2Raw.updatedAt,
      };
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

  // Update match status
  await prisma.scheduledTeamBattleMatch.update({
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
  // Query scheduled tag team matches
  // Execute all matches with status 'scheduled' — the cron job controls timing,
  // scheduledFor is informational only (shown to players)
  const scheduledMatches = await prisma.scheduledTeamBattleMatch.findMany({
    where: {
      status: 'scheduled',
      matchMode: 'tag_team',
    },
    include: {
      team1: {
        include: {
          members: {
            include: {
              robot: true,
            },
            orderBy: { slotIndex: 'asc' as const },
          },
        },
      },
      team2: {
        include: {
          members: {
            include: {
              robot: true,
            },
            orderBy: { slotIndex: 'asc' as const },
          },
        },
      },
    },
    orderBy: {
      scheduledFor: 'asc',
    },
  });

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
          
          // Mark match as cancelled
          await prisma.scheduledTeamBattleMatch.update({
            where: { id: match.id },
            data: { status: 'cancelled' },
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
      
      // Mark match as cancelled on error
      await prisma.scheduledTeamBattleMatch.update({
        where: { id: match.id },
        data: { status: 'cancelled' },
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

/**
 * Check if a team is ready for battle
 * Requirement 8.1, 8.2, 8.3: Both robots must have HP > yield threshold, all weapons equipped
 * Requirement 11.3: Dynamic eligibility checking after earlier matches
 */
export async function checkTeamReadinessForBattle(team: {
  members: Array<{ robot: Robot }>;
} | null): Promise<boolean> {
  if (!team || team.members.length < 2) return false;

  // slot 0 = active, slot 1 = reserve (members ordered by slotIndex asc)
  const activeRobot = team.members[0].robot;
  const reserveRobot = team.members[1].robot;

  // Check active robot has weapons
  if (!activeRobot.mainWeaponId) {
    return false;
  }

  // Check reserve robot has weapons
  if (!reserveRobot.mainWeaponId) {
    return false;
  }

  return true;
}

/**
 * Update battle results, robot stats, and apply rewards
 * Requirements 5.1-5.7, 10.7, 10.8: ELO, league points, fame, statistics
 * Requirement 11.2: Apply cumulative damage to robots
 * Requirements 12.4, 12.5: Full rewards for bye-team wins, normal penalties for losses
 */
export async function updateTagTeamBattleResults(
  match: ScheduledTeamBattleMatch & {
    team1: (TeamBattle & { members: Array<{ robot: Robot; slotIndex: number; robotId: number }> }) | null;
    team2: (TeamBattle & { members: Array<{ robot: Robot; slotIndex: number; robotId: number }> }) | null;
  },
  result: TagTeamBattleResult
): Promise<void> {
  // Check if this is a bye-team match (bye matches have team2Id = null in the DB)
  const isByeMatch = match.team2Id === null;
  const team1IsBye = false; // Team 1 is never the bye team (matchmaking always puts real team as team1)
  const team2IsBye = match.team2Id === null;

  // Map teams to the expected shape (slot 0 = active, slot 1 = reserve)
  const mapTeam = (raw: (TeamBattle & { members: Array<{ robot: Robot; slotIndex: number; robotId: number }> }) | null) => {
    if (!raw || raw.members.length < 2) return null;
    const sorted = [...raw.members].sort((a, b) => a.slotIndex - b.slotIndex);
    return {
      id: raw.id,
      stableId: raw.stableId,
      teamName: raw.teamName,
      activeRobotId: sorted[0].robotId,
      reserveRobotId: sorted[1].robotId,
      activeRobot: sorted[0].robot,
      reserveRobot: sorted[1].robot,
    };
  };

  // Use pre-loaded teams from the scheduled match query (no re-fetch needed)
  const team1 = team1IsBye ? null : mapTeam(match.team1);
  const team2 = team2IsBye ? null : mapTeam(match.team2);

  // For bye-team matches, only update the real team
  if (isByeMatch) {
    const realTeam = team1 || team2;
    if (!realTeam || !realTeam.activeRobot || !realTeam.reserveRobot) {
      throw new TagTeamError(
        TagTeamErrorCode.INVALID_TEAM_COMPOSITION,
        `Real team or robots not found for bye-match ${match.id}`,
        400,
        { matchId: match.id }
      );
    }

    const realTeamWon = result.winnerId === realTeam.id;
    const isDraw = result.isDraw;

    // Calculate ELO changes against bye-team (combined ELO 2000)
    const realTeamCombinedELO = realTeam.activeRobot.elo + realTeam.reserveRobot.elo;
    const byeTeamCombinedELO = 2000;
    const eloChanges = team1IsBye 
      ? calculateTagTeamELOChanges(byeTeamCombinedELO, realTeamCombinedELO, false, isDraw)
      : calculateTagTeamELOChanges(realTeamCombinedELO, byeTeamCombinedELO, realTeamWon, isDraw);
    
    const realTeamELOChange = team1IsBye ? eloChanges.team2Change : eloChanges.team1Change;

    // Calculate league point changes (Requirements 12.4, 12.5: same as normal matches)
    const realTeamLeaguePoints = calculateTagTeamLeaguePoints(realTeamWon, isDraw);

    // Calculate rewards (Requirements 12.4, 12.5: full rewards for wins, normal penalties for losses)
    const realTeamRewards = calculateTagTeamRewards(match.teamBattleLeague, realTeamWon, isDraw);

    // Calculate repair costs
    // NOTE: Repair costs are NOT calculated here anymore
    // They are calculated by RepairService when repairs are actually triggered
    // This ensures accurate costs based on current damage and facility levels

    const activeFinalHP = team1IsBye ? result.team2ActiveFinalHP : result.team1ActiveFinalHP;
    const reserveFinalHP = team1IsBye ? result.team2ReserveFinalHP : result.team1ReserveFinalHP;
    const tagOutTime = team1IsBye ? result.team2TagOutTime : result.team1TagOutTime;

    // NOTE: Repair costs are NOT calculated here anymore
    // They are calculated by RepairService when repairs are actually triggered
    // This ensures accurate costs based on current damage and facility levels

    // Calculate prestige
    const prestige = calculateTagTeamPrestige(match.teamBattleLeague, realTeamWon, isDraw);

    // Calculate fame (Requirement 10.7) based on damage dealt and survival time
    const totalBattleTime = result.durationSeconds;
    const activeDamageDealt = team1IsBye ? result.team2ActiveDamageDealt : result.team1ActiveDamageDealt;
    const reserveDamageDealt = team1IsBye ? result.team2ReserveDamageDealt : result.team1ReserveDamageDealt;
    const activeSurvivalTime = team1IsBye ? result.team2ActiveSurvivalTime : result.team1ActiveSurvivalTime;
    const reserveSurvivalTime = team1IsBye ? result.team2ReserveSurvivalTime : result.team1ReserveSurvivalTime;

    const activeFame = calculateTagTeamFame(
      realTeam.activeRobot,
      activeDamageDealt,
      activeSurvivalTime,
      totalBattleTime,
      realTeamWon,
      isDraw
    );
    const reserveFame = calculateTagTeamFame(
      realTeam.reserveRobot,
      reserveDamageDealt,
      reserveSurvivalTime,
      totalBattleTime,
      realTeamWon,
      isDraw
    );

    // Update robots
    await prisma.robot.update({
      where: { id: realTeam.activeRobotId },
      data: {
        elo: { increment: realTeamELOChange },
        currentHP: activeFinalHP,
        repairCost: 0, // Deprecated: repair costs calculated by RepairService
        damageTaken: { increment: realTeam.activeRobot.maxHP - activeFinalHP },
        fame: { increment: activeFame },
        totalTagTeamBattles: { increment: 1 },
        totalTagTeamWins: realTeamWon ? { increment: 1 } : undefined,
        totalTagTeamLosses: !realTeamWon && !isDraw ? { increment: 1 } : undefined,
        totalTagTeamDraws: isDraw ? { increment: 1 } : undefined,
        timesTaggedOut: tagOutTime !== undefined ? { increment: 1 } : undefined,
      },
    });

    await prisma.robot.update({
      where: { id: realTeam.reserveRobotId },
      data: {
        elo: { increment: realTeamELOChange },
        currentHP: reserveFinalHP,
        repairCost: 0, // Deprecated: repair costs calculated by RepairService
        damageTaken: tagOutTime !== undefined 
          ? { increment: realTeam.reserveRobot.maxHP - reserveFinalHP }
          : undefined,
        fame: { increment: reserveFame },
        totalTagTeamBattles: { increment: 1 },
        totalTagTeamWins: realTeamWon ? { increment: 1 } : undefined,
        totalTagTeamLosses: !realTeamWon && !isDraw ? { increment: 1 } : undefined,
        totalTagTeamDraws: isDraw ? { increment: 1 } : undefined,
        timesTaggedIn: tagOutTime !== undefined ? { increment: 1 } : undefined,
      },
    });

    // Update team (ensure league points don't go below 0)
    const currentTeamData = await prisma.teamBattle.findUnique({
      where: { id: realTeam.id },
      select: { tagTeamLp: true },
    });
    const newLeaguePoints = Math.max(0, (currentTeamData?.tagTeamLp || 0) + realTeamLeaguePoints);
    
    await prisma.teamBattle.update({
      where: { id: realTeam.id },
      data: {
        tagTeamLp: newLeaguePoints,
        totalTagTeamWins: realTeamWon ? { increment: 1 } : undefined,
        totalTagTeamLosses: !realTeamWon && !isDraw ? { increment: 1 } : undefined,
        totalTagTeamDraws: isDraw ? { increment: 1 } : undefined,
      },
    });

    // Update stable via shared helpers
    // Note: Repair costs are deducted separately by RepairService, not here
    await awardCreditsToUser(realTeam.stableId, realTeamRewards);
    await awardPrestigeToUser(realTeam.stableId, prestige);

    // Update battle record with actual values
    const winnerReward = realTeamWon ? realTeamRewards : 0;
    const loserReward = !realTeamWon && !isDraw ? realTeamRewards : 0;
    
    await prisma.battle.update({
      where: { id: result.battleId },
      data: {
        winnerReward,
        loserReward,
        robot1ELOAfter: team1IsBye ? 1000 : realTeam.activeRobot.elo + realTeamELOChange,
        robot2ELOAfter: team2IsBye ? 1000 : realTeam.activeRobot.elo + realTeamELOChange,
        eloChange: Math.abs(realTeamELOChange),
      },
    });

    logger.info(
      `[TagTeamBattles] Updated bye-match results for match ${match.id}: ` +
      `Team ${realTeam.id} ELO ${realTeamELOChange > 0 ? '+' : ''}${realTeamELOChange}`
    );

    // Update BattleParticipant records for the real team with ELO, prestige, fame, and credits
    const byeCreditsPerRobot = Math.floor(realTeamRewards / 2);
    const byePrestigePerRobot = Math.floor(prestige / 2);

    await prisma.battleParticipant.updateMany({
      where: {
        battleId: result.battleId,
        robotId: realTeam.activeRobotId,
      },
      data: {
        credits: byeCreditsPerRobot,
        eloAfter: realTeam.activeRobot.elo + realTeamELOChange,
        prestigeAwarded: byePrestigePerRobot,
        fameAwarded: activeFame,
      },
    });

    await prisma.battleParticipant.updateMany({
      where: {
        battleId: result.battleId,
        robotId: realTeam.reserveRobotId,
      },
      data: {
        credits: byeCreditsPerRobot,
        eloAfter: realTeam.reserveRobot.elo + realTeamELOChange,
        prestigeAwarded: byePrestigePerRobot,
        fameAwarded: reserveFame,
      },
    });

    return;
  }

  // Normal match (both teams are real)
  if (!team1 || !team2) {
    throw new TagTeamError(
      TagTeamErrorCode.TAG_TEAM_NOT_FOUND,
      `Teams not found for match ${match.id}`,
      404,
      { matchId: match.id }
    );
  }

  const team1Won = result.winnerId === team1.id;
  const team2Won = result.winnerId === team2.id;
  const isDraw = result.isDraw;

  // Validate teams have robots loaded
  if (!team1.activeRobot || !team1.reserveRobot || !team2.activeRobot || !team2.reserveRobot) {
    throw new TagTeamError(
      TagTeamErrorCode.INVALID_TEAM_COMPOSITION,
      `Teams missing robot data for match ${match.id}`,
      400,
      { matchId: match.id, team1Id: team1.id, team2Id: team2.id }
    );
  }

  // Calculate ELO changes (Requirements 5.1, 5.2)
  const team1CombinedELO = team1.activeRobot.elo + team1.reserveRobot.elo;
  const team2CombinedELO = team2.activeRobot.elo + team2.reserveRobot.elo;
  const eloChanges = calculateTagTeamELOChanges(team1CombinedELO, team2CombinedELO, team1Won, isDraw);

  // Calculate league point changes (Requirements 5.3, 5.4, 5.5)
  const team1LeaguePoints = calculateTagTeamLeaguePoints(team1Won, isDraw);
  const team2LeaguePoints = calculateTagTeamLeaguePoints(team2Won, isDraw);

  // Calculate rewards (Requirements 4.1, 4.2, 4.3)
  const team1Rewards = calculateTagTeamRewards(match.teamBattleLeague, team1Won, isDraw);
  const team2Rewards = calculateTagTeamRewards(match.teamBattleLeague, team2Won, isDraw);

  // Calculate repair costs (Requirements 4.4, 4.5, 4.6, 4.7)
  // NOTE: Repair costs are NOT calculated here anymore
  // They are calculated by RepairService when repairs are actually triggered
  // This ensures accurate costs based on current damage and facility levels

  // Calculate prestige (Requirements 10.1-10.6)
  const team1Prestige = calculateTagTeamPrestige(match.teamBattleLeague, team1Won, isDraw);
  const team2Prestige = calculateTagTeamPrestige(match.teamBattleLeague, team2Won, isDraw);

  // Calculate fame (Requirement 10.7) based on damage dealt and survival time
  const totalBattleTime = result.durationSeconds;
  const team1ActiveFame = calculateTagTeamFame(
    team1.activeRobot,
    result.team1ActiveDamageDealt,
    result.team1ActiveSurvivalTime,
    totalBattleTime,
    team1Won,
    isDraw
  );
  const team1ReserveFame = calculateTagTeamFame(
    team1.reserveRobot,
    result.team1ReserveDamageDealt,
    result.team1ReserveSurvivalTime,
    totalBattleTime,
    team1Won,
    isDraw
  );
  const team2ActiveFame = calculateTagTeamFame(
    team2.activeRobot,
    result.team2ActiveDamageDealt,
    result.team2ActiveSurvivalTime,
    totalBattleTime,
    team2Won,
    isDraw
  );
  const team2ReserveFame = calculateTagTeamFame(
    team2.reserveRobot,
    result.team2ReserveDamageDealt,
    result.team2ReserveSurvivalTime,
    totalBattleTime,
    team2Won,
    isDraw
  );

  // Update robots (ELO, league points, HP, statistics, fame)
  // Requirement 11.2: Apply cumulative damage
  // Read stored maxHP values to clamp finalHP (combat uses tuning-inflated maxHP)
  const storedMaxHPs = await prisma.robot.findMany({
    where: { id: { in: [team1.activeRobotId, team1.reserveRobotId, team2.activeRobotId, team2.reserveRobotId] } },
    select: { id: true, maxHP: true },
  });
  const maxHPMap = new Map(storedMaxHPs.map(r => [r.id, r.maxHP]));

  await prisma.robot.update({
    where: { id: team1.activeRobotId },
    data: {
      elo: { increment: eloChanges.team1Change },
      currentHP: Math.min(result.team1ActiveFinalHP, maxHPMap.get(team1.activeRobotId) ?? result.team1ActiveFinalHP),
      repairCost: 0, // Deprecated: repair costs calculated by RepairService
      damageTaken: { increment: (maxHPMap.get(team1.activeRobotId) ?? team1.activeRobot.maxHP) - Math.min(result.team1ActiveFinalHP, maxHPMap.get(team1.activeRobotId) ?? result.team1ActiveFinalHP) },
      fame: { increment: team1ActiveFame },
      totalTagTeamBattles: { increment: 1 },
      totalTagTeamWins: team1Won ? { increment: 1 } : undefined,
      totalTagTeamLosses: team2Won ? { increment: 1 } : undefined,
      totalTagTeamDraws: isDraw ? { increment: 1 } : undefined,
      timesTaggedOut: result.team1TagOutTime !== undefined ? { increment: 1 } : undefined,
    },
  });

  await prisma.robot.update({
    where: { id: team1.reserveRobotId },
    data: {
      elo: { increment: eloChanges.team1Change },
      currentHP: Math.min(result.team1ReserveFinalHP, maxHPMap.get(team1.reserveRobotId) ?? result.team1ReserveFinalHP),
      repairCost: 0, // Deprecated: repair costs calculated by RepairService
      damageTaken: result.team1TagOutTime !== undefined 
        ? { increment: (maxHPMap.get(team1.reserveRobotId) ?? team1.reserveRobot.maxHP) - Math.min(result.team1ReserveFinalHP, maxHPMap.get(team1.reserveRobotId) ?? result.team1ReserveFinalHP) }
        : undefined,
      fame: { increment: team1ReserveFame },
      totalTagTeamBattles: { increment: 1 },
      totalTagTeamWins: team1Won ? { increment: 1 } : undefined,
      totalTagTeamLosses: team2Won ? { increment: 1 } : undefined,
      totalTagTeamDraws: isDraw ? { increment: 1 } : undefined,
      timesTaggedIn: result.team1TagOutTime !== undefined ? { increment: 1 } : undefined,
    },
  });

  await prisma.robot.update({
    where: { id: team2.activeRobotId },
    data: {
      elo: { increment: eloChanges.team2Change },
      currentHP: Math.min(result.team2ActiveFinalHP, maxHPMap.get(team2.activeRobotId) ?? result.team2ActiveFinalHP),
      repairCost: 0, // Deprecated: repair costs calculated by RepairService
      damageTaken: { increment: (maxHPMap.get(team2.activeRobotId) ?? team2.activeRobot.maxHP) - Math.min(result.team2ActiveFinalHP, maxHPMap.get(team2.activeRobotId) ?? result.team2ActiveFinalHP) },
      fame: { increment: team2ActiveFame },
      totalTagTeamBattles: { increment: 1 },
      totalTagTeamWins: team2Won ? { increment: 1 } : undefined,
      totalTagTeamLosses: team1Won ? { increment: 1 } : undefined,
      totalTagTeamDraws: isDraw ? { increment: 1 } : undefined,
      timesTaggedOut: result.team2TagOutTime !== undefined ? { increment: 1 } : undefined,
    },
  });

  await prisma.robot.update({
    where: { id: team2.reserveRobotId },
    data: {
      elo: { increment: eloChanges.team2Change },
      currentHP: Math.min(result.team2ReserveFinalHP, maxHPMap.get(team2.reserveRobotId) ?? result.team2ReserveFinalHP),
      repairCost: 0, // Deprecated: repair costs calculated by RepairService
      damageTaken: result.team2TagOutTime !== undefined 
        ? { increment: (maxHPMap.get(team2.reserveRobotId) ?? team2.reserveRobot.maxHP) - Math.min(result.team2ReserveFinalHP, maxHPMap.get(team2.reserveRobotId) ?? result.team2ReserveFinalHP) }
        : undefined,
      fame: { increment: team2ReserveFame },
      totalTagTeamBattles: { increment: 1 },
      totalTagTeamWins: team2Won ? { increment: 1 } : undefined,
      totalTagTeamLosses: team1Won ? { increment: 1 } : undefined,
      totalTagTeamDraws: isDraw ? { increment: 1 } : undefined,
      timesTaggedIn: result.team2TagOutTime !== undefined ? { increment: 1 } : undefined,
    },
  });

  // Update teams (league points, win/loss/draw counters)
  // Ensure league points don't go below 0
  const team1CurrentData = await prisma.teamBattle.findUnique({
    where: { id: team1.id },
    select: { tagTeamLp: true },
  });
  const team2CurrentData = await prisma.teamBattle.findUnique({
    where: { id: team2.id },
    select: { tagTeamLp: true },
  });
  
  const team1NewLeaguePoints = Math.max(0, (team1CurrentData?.tagTeamLp || 0) + team1LeaguePoints);
  const team2NewLeaguePoints = Math.max(0, (team2CurrentData?.tagTeamLp || 0) + team2LeaguePoints);
  
  await prisma.teamBattle.update({
    where: { id: team1.id },
    data: {
      tagTeamLp: team1NewLeaguePoints,
      totalTagTeamWins: team1Won ? { increment: 1 } : undefined,
      totalTagTeamLosses: team2Won ? { increment: 1 } : undefined,
      totalTagTeamDraws: isDraw ? { increment: 1 } : undefined,
    },
  });

  await prisma.teamBattle.update({
    where: { id: team2.id },
    data: {
      tagTeamLp: team2NewLeaguePoints,
      totalTagTeamWins: team2Won ? { increment: 1 } : undefined,
      totalTagTeamLosses: team1Won ? { increment: 1 } : undefined,
      totalTagTeamDraws: isDraw ? { increment: 1 } : undefined,
    },
  });

  // Update stables (currency, prestige) via shared helpers
  // Note: Repair costs are deducted separately by RepairService, not here
  await awardCreditsToUser(team1.stableId, team1Rewards);
  await awardPrestigeToUser(team1.stableId, team1Prestige);
  await awardCreditsToUser(team2.stableId, team2Rewards);
  await awardPrestigeToUser(team2.stableId, team2Prestige);

  // Update battle record with actual values
  await prisma.battle.update({
    where: { id: result.battleId },
    data: {
      winnerReward: team1Won ? team1Rewards : team2Won ? team2Rewards : 0,
      loserReward: team1Won ? team2Rewards : team2Won ? team1Rewards : (isDraw ? team1Rewards : 0),
      robot1ELOAfter: team1.activeRobot.elo + eloChanges.team1Change,
      robot2ELOAfter: team2.activeRobot.elo + eloChanges.team2Change,
      eloChange: Math.abs(eloChanges.team1Change),
      // Per-robot stats for tag team battles
      team1ActiveDamageDealt: result.team1ActiveDamageDealt,
      team1ReserveDamageDealt: result.team1ReserveDamageDealt,
      team2ActiveDamageDealt: result.team2ActiveDamageDealt,
      team2ReserveDamageDealt: result.team2ReserveDamageDealt,
      team1ActiveFameAwarded: team1ActiveFame,
      team1ReserveFameAwarded: team1ReserveFame,
      team2ActiveFameAwarded: team2ActiveFame,
      team2ReserveFameAwarded: team2ReserveFame,
    },
  });

  logger.info(
    `[TagTeamBattles] Updated results for match ${match.id}: ` +
    `${team1.teamName} ELO ${eloChanges.team1Change > 0 ? '+' : ''}${eloChanges.team1Change}, ` +
    `${team2.teamName} ELO ${eloChanges.team2Change > 0 ? '+' : ''}${eloChanges.team2Change}`
  );
  
  // Log fame awards
  if (team1ActiveFame > 0 || team1ReserveFame > 0) {
    logger.info(
      `[TagTeamBattles] Fame awarded - ${team1.teamName}: ` +
      `${team1.activeRobot.name} +${team1ActiveFame}, ${team1.reserveRobot.name} +${team1ReserveFame}`
    );
  }
  if (team2ActiveFame > 0 || team2ReserveFame > 0) {
    logger.info(
      `[TagTeamBattles] Fame awarded - ${team2.teamName}: ` +
      `${team2.activeRobot.name} +${team2ActiveFame}, ${team2.reserveRobot.name} +${team2ReserveFame}`
    );
  }

  // Calculate and award streaming revenue for all 4 robots individually
  // Each robot earns based on its own stats, divided by teamSize (2) to preserve economics
  const TAG_TEAM_SIZE = 2;
  const [team1ActiveStreaming, team1ReserveStreaming, team2ActiveStreaming, team2ReserveStreaming] = await Promise.all([
    awardStreamingRevenueForParticipant(team1.activeRobotId, team1.stableId, result.battleId, false, TAG_TEAM_SIZE),
    awardStreamingRevenueForParticipant(team1.reserveRobotId, team1.stableId, result.battleId, false, TAG_TEAM_SIZE),
    awardStreamingRevenueForParticipant(team2.activeRobotId, team2.stableId, result.battleId, false, TAG_TEAM_SIZE),
    awardStreamingRevenueForParticipant(team2.reserveRobotId, team2.stableId, result.battleId, false, TAG_TEAM_SIZE),
  ]);

  // Log streaming revenue
  logger.info(
    `[Streaming] ${team1.teamName}: ${team1.activeRobot.name} ₡${team1ActiveStreaming?.totalRevenue ?? 0}, ` +
    `${team1.reserveRobot.name} ₡${team1ReserveStreaming?.totalRevenue ?? 0}`
  );
  logger.info(
    `[Streaming] ${team2.teamName}: ${team2.activeRobot.name} ₡${team2ActiveStreaming?.totalRevenue ?? 0}, ` +
    `${team2.reserveRobot.name} ₡${team2ReserveStreaming?.totalRevenue ?? 0}`
  );

  // Update BattleParticipant records with credits, ELO, prestige, and fame
  // Note: streamingRevenue is already set by awardStreamingRevenueForParticipant() above
  const team1CreditsPerRobot = Math.floor(team1Rewards / 2);
  const team2CreditsPerRobot = Math.floor(team2Rewards / 2);
  const team1PrestigePerRobot = Math.floor(team1Prestige / 2);
  const team2PrestigePerRobot = Math.floor(team2Prestige / 2);
  
  // Update each robot individually since eloAfter and fameAwarded differ per robot
  await prisma.battleParticipant.updateMany({
    where: {
      battleId: result.battleId,
      robotId: team1.activeRobotId,
    },
    data: {
      credits: team1CreditsPerRobot,
      eloAfter: team1.activeRobot.elo + eloChanges.team1Change,
      prestigeAwarded: team1PrestigePerRobot,
      fameAwarded: team1ActiveFame,
    },
  });
  
  await prisma.battleParticipant.updateMany({
    where: {
      battleId: result.battleId,
      robotId: team1.reserveRobotId,
    },
    data: {
      credits: team1CreditsPerRobot,
      eloAfter: team1.reserveRobot.elo + eloChanges.team1Change,
      prestigeAwarded: team1PrestigePerRobot,
      fameAwarded: team1ReserveFame,
    },
  });
  
  await prisma.battleParticipant.updateMany({
    where: {
      battleId: result.battleId,
      robotId: team2.activeRobotId,
    },
    data: {
      credits: team2CreditsPerRobot,
      eloAfter: team2.activeRobot.elo + eloChanges.team2Change,
      prestigeAwarded: team2PrestigePerRobot,
      fameAwarded: team2ActiveFame,
    },
  });
  
  await prisma.battleParticipant.updateMany({
    where: {
      battleId: result.battleId,
      robotId: team2.reserveRobotId,
    },
    data: {
      credits: team2CreditsPerRobot,
      eloAfter: team2.reserveRobot.elo + eloChanges.team2Change,
      prestigeAwarded: team2PrestigePerRobot,
      fameAwarded: team2ReserveFame,
    },
  });

  // Log battle_complete events to audit log - ONE EVENT PER ROBOT (4 total)
  // Uses shared logBattleAuditEvent helper with tag-team-specific extras
  
  const battle = await prisma.battle.findUnique({
    where: { id: result.battleId },
  });

  if (battle) {
    // Reuse credits splits calculated above; streaming revenue comes from per-robot calcs
    const auditTeam1PrestigePerRobot = Math.floor(team1Prestige / 2);
    const auditTeam2PrestigePerRobot = Math.floor(team2Prestige / 2);
    
    const tagTeamAuditRobots = [
      // Team 1 Active
      {
        robotId: team1.activeRobotId, userId: team1.activeRobot.userId,
        isWinner: team1Won, isDraw,
        damageDealt: result.team1ActiveDamageDealt, finalHP: result.team1ActiveFinalHP,
        yielded: result.team1TagOutTime !== undefined, destroyed: result.team1ActiveFinalHP === 0,
        credits: team1CreditsPerRobot, prestige: auditTeam1PrestigePerRobot, fame: team1ActiveFame,
        eloBefore: battle.robot1ELOBefore, eloAfter: battle.robot1ELOAfter,
        streamingRevenue: team1ActiveStreaming?.totalRevenue ?? 0,
        extras: { isTagTeam: true, role: 'active', opponentTeam: team2.id, partnerRobotId: team1.reserveRobotId,
          survivalTime: result.team1ActiveSurvivalTime },
      },
      // Team 1 Reserve
      {
        robotId: team1.reserveRobotId, userId: team1.reserveRobot.userId,
        isWinner: team1Won, isDraw,
        damageDealt: result.team1ReserveDamageDealt, finalHP: result.team1ReserveFinalHP,
        yielded: false, destroyed: result.team1ReserveFinalHP === 0 && result.team1TagOutTime !== undefined,
        credits: team1CreditsPerRobot, prestige: auditTeam1PrestigePerRobot, fame: team1ReserveFame,
        eloBefore: team1.reserveRobot.elo, eloAfter: team1.reserveRobot.elo,
        streamingRevenue: team1ReserveStreaming?.totalRevenue ?? 0,
        extras: { isTagTeam: true, role: 'reserve', opponentTeam: team2.id, partnerRobotId: team1.activeRobotId,
          wasTaggedIn: result.team1TagOutTime !== undefined, survivalTime: result.team1ReserveSurvivalTime },
      },
      // Team 2 Active
      {
        robotId: team2.activeRobotId, userId: team2.activeRobot.userId,
        isWinner: team2Won, isDraw,
        damageDealt: result.team2ActiveDamageDealt, finalHP: result.team2ActiveFinalHP,
        yielded: result.team2TagOutTime !== undefined, destroyed: result.team2ActiveFinalHP === 0,
        credits: team2CreditsPerRobot, prestige: auditTeam2PrestigePerRobot, fame: team2ActiveFame,
        eloBefore: battle.robot2ELOBefore, eloAfter: battle.robot2ELOAfter,
        streamingRevenue: team2ActiveStreaming?.totalRevenue ?? 0,
        extras: { isTagTeam: true, role: 'active', opponentTeam: team1.id, partnerRobotId: team2.reserveRobotId,
          survivalTime: result.team2ActiveSurvivalTime },
      },
      // Team 2 Reserve
      {
        robotId: team2.reserveRobotId, userId: team2.reserveRobot.userId,
        isWinner: team2Won, isDraw,
        damageDealt: result.team2ReserveDamageDealt, finalHP: result.team2ReserveFinalHP,
        yielded: false, destroyed: result.team2ReserveFinalHP === 0 && result.team2TagOutTime !== undefined,
        credits: team2CreditsPerRobot, prestige: auditTeam2PrestigePerRobot, fame: team2ReserveFame,
        eloBefore: team2.reserveRobot.elo, eloAfter: team2.reserveRobot.elo,
        streamingRevenue: team2ReserveStreaming?.totalRevenue ?? 0,
        extras: { isTagTeam: true, role: 'reserve', opponentTeam: team1.id, partnerRobotId: team2.activeRobotId,
          wasTaggedIn: result.team2TagOutTime !== undefined, survivalTime: result.team2ReserveSurvivalTime },
      },
    ];

    // Non-blocking: audit failures must never crash a battle
    let auditSuccessCount = 0;
    for (const r of tagTeamAuditRobots) {
      try {
        await logBattleAuditEvent(
          {
            robotId: r.robotId, userId: r.userId,
            isWinner: r.isWinner, isDraw: r.isDraw,
            damageDealt: r.damageDealt, finalHP: r.finalHP,
            yielded: r.yielded, destroyed: r.destroyed,
            credits: r.credits, prestige: r.prestige, fame: r.fame,
            eloBefore: r.eloBefore, eloAfter: r.eloAfter,
          },
          { id: battle.id, battleType: 'tag_team', leagueType: battle.leagueType, durationSeconds: battle.durationSeconds, eloChange: battle.eloChange },
          null, // Tag team has no single opponent
          r.streamingRevenue,
          false,
          r.extras,
        );
        auditSuccessCount++;
      } catch (auditError) {
        logger.error(`[TagTeamBattles] Audit log failed for robot ${r.robotId} in battle #${battle.id}: ${auditError instanceof Error ? auditError.message : String(auditError)}`);
      }
    }
    
    logger.info(
      `[TagTeamBattles] Created ${auditSuccessCount}/4 audit log events for tag team battle ${battle.id} ` +
      `(one per robot, rewards split 50/50 per team)`
    );

    // Check and award achievements for all 4 robots
    for (const r of tagTeamAuditRobots) {
      const prevLost = await didRobotLosePreviousBattle(r.robotId, battle.id);

      // Solo carry: active robot won without tagging out (destroyed both opponents alone)
      const isSoloCarry = r.isWinner && r.extras.role === 'active' && (
        (r.robotId === team1.activeRobotId && result.team1TagOutTime === undefined) ||
        (r.robotId === team2.activeRobotId && result.team2TagOutTime === undefined)
      );

      await checkAndAwardAchievements(r.userId, r.robotId, {
        won: r.isWinner,
        destroyed: r.destroyed,
        finalHpPercent: 0,
        eloDiff: 0,
        opponentElo: 0,
        yielded: r.yielded,
        opponentYielded: false,
        previousBattleLost: prevLost,
        damageDealt: r.damageDealt,
        opponentDamageDealt: 0,
        loadoutType: 'single',
        stance: 'balanced',
        yieldThreshold: 0,
        hasTuning: false,
        hasMainWeapon: true,
        battleType: 'tag_team',
        battleDurationSeconds: battle.durationSeconds,
        taggedIn: r.extras.wasTaggedIn === true,
        soloCarry: isSoloCarry,
      });
    }
  }
}
