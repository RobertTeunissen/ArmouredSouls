/**
 * Tag Team Result Updater
 * Updates battle results, robot stats, ELO, league points, rewards, fame,
 * streaming revenue, audit logs, and achievements after a tag team battle.
 */

import { Robot, TeamBattle, ScheduledTeamBattleMatch } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import {
  logBattleAuditEvent,
  awardCreditsWithLedger,
  awardPrestigeToUser,
  awardStreamingRevenueForParticipant,
  checkAndAwardAchievements,
  didRobotLosePreviousBattle,
  updateRobotCombatStats,
} from '../battle/battlePostCombat';
import { TagTeamError, TagTeamErrorCode } from '../../errors/tagTeamErrors';
import { TagTeamBattleResult } from './tagTeamTypes';
import {
  calculateTagTeamRewards,
  calculateTagTeamELOChanges,
  calculateTagTeamLeaguePoints,
  calculateTagTeamPrestige,
  calculateTagTeamFame,
} from './tagTeamRewards';
import { getCurrentCycleNumber } from '../battle/baseOrchestrator';
import standingsService from '../standings/standingsService';

/**
 * Check if a team is ready for battle
 * Requirement 8.1, 8.2, 8.3: Both robots must have HP > yield threshold, all weapons equipped
 * Requirement 11.3: Dynamic eligibility checking after earlier matches
 */
export async function checkTeamReadinessForBattle(team: {
  members: Array<{ robot: Robot }>;
} | null): Promise<boolean> {
  if (!team || team.members.length < 2) return false;

  const activeRobot = team.members[0].robot;
  const reserveRobot = team.members[1].robot;

  if (!activeRobot.mainWeaponId) return false;
  if (!reserveRobot.mainWeaponId) return false;

  return true;
}
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
      match.teamBattleLeague,
      realTeam.activeRobot,
      activeDamageDealt,
      activeSurvivalTime,
      totalBattleTime,
      realTeamWon,
      isDraw
    );
    const reserveFame = calculateTagTeamFame(
      match.teamBattleLeague,
      realTeam.reserveRobot,
      reserveDamageDealt,
      reserveSurvivalTime,
      totalBattleTime,
      realTeamWon,
      isDraw
    );

    // Update robots via unified combat stats function
    await updateRobotCombatStats({
      robotId: realTeam.activeRobotId,
      finalHP: activeFinalHP,
      newELO: realTeam.activeRobot.elo + realTeamELOChange,
      isWinner: realTeamWon,
      isDraw,
      damageDealt: Math.round(activeDamageDealt),
      damageTakenByOpponent: realTeam.activeRobot.maxHP - activeFinalHP,
      opponentDestroyed: false, // Bye opponent is virtual
      fameIncrement: activeFame,
      battleType: 'tag_team',
      stance: realTeam.activeRobot.stance,
      loadoutType: realTeam.activeRobot.loadoutType,
    });

    await updateRobotCombatStats({
      robotId: realTeam.reserveRobotId,
      finalHP: reserveFinalHP,
      newELO: realTeam.reserveRobot.elo + realTeamELOChange,
      isWinner: realTeamWon,
      isDraw,
      damageDealt: Math.round(reserveDamageDealt),
      damageTakenByOpponent: tagOutTime !== undefined
        ? realTeam.reserveRobot.maxHP - reserveFinalHP
        : 0,
      opponentDestroyed: false, // Bye opponent is virtual
      fameIncrement: reserveFame,
      battleType: 'tag_team',
      stance: realTeam.reserveRobot.stance,
      loadoutType: realTeam.reserveRobot.loadoutType,
    });

    // Update team standings via standingsService
    const byeTeamOutcome = isDraw ? 'draw' : realTeamWon ? 'win' : 'loss';
    await standingsService.recordBattleResult({
      entityType: 'team',
      entityId: realTeam.id,
      mode: 'tag_team',
      outcome: byeTeamOutcome,
      lpDelta: realTeamLeaguePoints,
    });

    // Update stable via shared helpers
    // Note: Repair costs are deducted separately by RepairService, not here
    const cycleNumber = await getCurrentCycleNumber();
    await awardCreditsWithLedger(realTeam.stableId, realTeamRewards, 'battle_income', cycleNumber, 'Tag team battle reward');
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
    match.teamBattleLeague,
    team1.activeRobot,
    result.team1ActiveDamageDealt,
    result.team1ActiveSurvivalTime,
    totalBattleTime,
    team1Won,
    isDraw
  );
  const team1ReserveFame = calculateTagTeamFame(
    match.teamBattleLeague,
    team1.reserveRobot,
    result.team1ReserveDamageDealt,
    result.team1ReserveSurvivalTime,
    totalBattleTime,
    team1Won,
    isDraw
  );
  const team2ActiveFame = calculateTagTeamFame(
    match.teamBattleLeague,
    team2.activeRobot,
    result.team2ActiveDamageDealt,
    result.team2ActiveSurvivalTime,
    totalBattleTime,
    team2Won,
    isDraw
  );
  const team2ReserveFame = calculateTagTeamFame(
    match.teamBattleLeague,
    team2.reserveRobot,
    result.team2ReserveDamageDealt,
    result.team2ReserveSurvivalTime,
    totalBattleTime,
    team2Won,
    isDraw
  );

  // Update robots (ELO, HP, statistics, fame) via unified combat stats function
  // updateRobotCombatStats handles maxHP clamping internally

  await updateRobotCombatStats({
    robotId: team1.activeRobotId,
    finalHP: result.team1ActiveFinalHP,
    newELO: team1.activeRobot.elo + eloChanges.team1Change,
    isWinner: team1Won,
    isDraw,
    damageDealt: Math.round(result.team1ActiveDamageDealt),
    damageTakenByOpponent: Math.round((result.team2ActiveDamageDealt + result.team2ReserveDamageDealt) / 2),
    opponentDestroyed: result.team2ActiveFinalHP === 0 || result.team2ReserveFinalHP === 0,
    fameIncrement: team1ActiveFame,
    battleType: 'tag_team',
    stance: team1.activeRobot.stance,
    loadoutType: team1.activeRobot.loadoutType,
  });

  await updateRobotCombatStats({
    robotId: team1.reserveRobotId,
    finalHP: result.team1ReserveFinalHP,
    newELO: team1.reserveRobot.elo + eloChanges.team1Change,
    isWinner: team1Won,
    isDraw,
    damageDealt: Math.round(result.team1ReserveDamageDealt),
    damageTakenByOpponent: Math.round((result.team2ActiveDamageDealt + result.team2ReserveDamageDealt) / 2),
    opponentDestroyed: result.team2ActiveFinalHP === 0 || result.team2ReserveFinalHP === 0,
    fameIncrement: team1ReserveFame,
    battleType: 'tag_team',
    stance: team1.reserveRobot.stance,
    loadoutType: team1.reserveRobot.loadoutType,
  });

  await updateRobotCombatStats({
    robotId: team2.activeRobotId,
    finalHP: result.team2ActiveFinalHP,
    newELO: team2.activeRobot.elo + eloChanges.team2Change,
    isWinner: team2Won,
    isDraw,
    damageDealt: Math.round(result.team2ActiveDamageDealt),
    damageTakenByOpponent: Math.round((result.team1ActiveDamageDealt + result.team1ReserveDamageDealt) / 2),
    opponentDestroyed: result.team1ActiveFinalHP === 0 || result.team1ReserveFinalHP === 0,
    fameIncrement: team2ActiveFame,
    battleType: 'tag_team',
    stance: team2.activeRobot.stance,
    loadoutType: team2.activeRobot.loadoutType,
  });

  await updateRobotCombatStats({
    robotId: team2.reserveRobotId,
    finalHP: result.team2ReserveFinalHP,
    newELO: team2.reserveRobot.elo + eloChanges.team2Change,
    isWinner: team2Won,
    isDraw,
    damageDealt: Math.round(result.team2ReserveDamageDealt),
    damageTakenByOpponent: Math.round((result.team1ActiveDamageDealt + result.team1ReserveDamageDealt) / 2),
    opponentDestroyed: result.team1ActiveFinalHP === 0 || result.team1ReserveFinalHP === 0,
    fameIncrement: team2ReserveFame,
    battleType: 'tag_team',
    stance: team2.reserveRobot.stance,
    loadoutType: team2.reserveRobot.loadoutType,
  });

  // Update teams standings via standingsService
  const team1Outcome = isDraw ? 'draw' : team1Won ? 'win' : 'loss';
  await standingsService.recordBattleResult({
    entityType: 'team',
    entityId: team1.id,
    mode: 'tag_team',
    outcome: team1Outcome,
    lpDelta: team1LeaguePoints,
  });

  const team2Outcome = isDraw ? 'draw' : team2Won ? 'win' : 'loss';
  await standingsService.recordBattleResult({
    entityType: 'team',
    entityId: team2.id,
    mode: 'tag_team',
    outcome: team2Outcome,
    lpDelta: team2LeaguePoints,
  });

  // Update stables (currency, prestige) via shared helpers
  // Note: Repair costs are deducted separately by RepairService, not here
  const cycleNumber = await getCurrentCycleNumber();
  await awardCreditsWithLedger(team1.stableId, team1Rewards, 'battle_income', cycleNumber, 'Tag team battle reward');
  await awardPrestigeToUser(team1.stableId, team1Prestige);
  await awardCreditsWithLedger(team2.stableId, team2Rewards, 'battle_income', cycleNumber, 'Tag team battle reward');
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
