import { Robot } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { simulateBattle, type CombatEvent } from '../battle/combatSimulator';
import { evaluateMatchEntry } from '../battle/combatReadiness';
import {
  awardStreamingRevenueForParticipant,
  logBattleAuditEvent,
  checkAndAwardAchievements,
  didRobotLosePreviousBattle,
  type UnlockedAchievement,
} from '../battle/battlePostCombat';
import { hasAllocatedTuning, hpPercentOf, lowestHpPercent } from '../battle/battleAchievementContext';
import { BattleError, BattleErrorCode } from '../../errors/battleErrors';
import { handleMatchFailure } from '../battle/matchFailurePolicy';
import { applyAndLogLoadoutFallbacks, loadCombatRobot, prepareRobotsWithTuning } from '../battle/battlePreparation';
import { createBattleRecord, updateRobotStats } from './leagueBattleRecord';
import { processByeBattle, resolveLeagueForfeit } from './leagueByeAndForfeit';

// ─── Scheduled Match Shape (mapped from unified table) ───────────────────────

/** Shape of a scheduled 1v1 league match as mapped from the unified scheduling table. */
export interface ScheduledLeagueMatchData {
  id: number;
  robot1Id: number;
  robot2Id: number;
  leagueType: string;
  leagueInstanceId?: string;
  scheduledFor: Date;
  status: string;
  battleId: number | null;
  createdAt: Date;
  _unifiedMatchId?: number;
}


export interface BattleResult {
  battleId: number;
  winnerId: number | null;
  robot1FinalHP: number;
  robot2FinalHP: number;
  robot1Damage: number;
  robot2Damage: number;
  durationSeconds: number;
  isDraw: boolean;
  isByeMatch: boolean;
  /** True when one or both robots forfeited at battle time (no main weapon); nothing was simulated. */
  isForfeit: boolean;
  combatEvents?: CombatEvent[]; // Detailed combat events for admin debugging
  // 2D arena spatial metadata
  arenaRadius?: number;
  startingPositions?: Record<string, { x: number; y: number }>;
  endingPositions?: Record<string, { x: number; y: number }>;
}

export interface BattleExecutionSummary {
  totalBattles: number;
  successfulBattles: number;
  failedBattles: number;
  byeBattles: number;
  /** Matches resolved as a battle-time forfeit (single or double), counted apart from fought battles. */
  forfeitBattles: number;
  errors: string[];
  totalStreamingRevenue?: number;
  reputationSummary?: {
    totalPrestigeAwarded: number;
    totalFameAwarded: number;
    prestigeByLeague: Record<string, number>;
    fameByLeague: Record<string, number>;
  };
}

/**
 * Simulate a battle using the comprehensive combat simulator
 * Uses ALL 23 robot attributes - ELO is NOT used in combat calculations
 */
function simulateBattleWrapper(robot1: Robot, robot2: Robot): BattleResult {
  const combatResult = simulateBattle(robot1, robot2);
  
  return {
    battleId: 0, // Will be set after creating battle record
    winnerId: combatResult.winnerId,
    robot1FinalHP: combatResult.robot1FinalHP,
    robot2FinalHP: combatResult.robot2FinalHP,
    robot1Damage: combatResult.robot1Damage,
    robot2Damage: combatResult.robot2Damage,
    durationSeconds: combatResult.durationSeconds,
    isDraw: combatResult.isDraw,
    isByeMatch: false,
    isForfeit: false,
    combatEvents: combatResult.events, // Store detailed combat events for debugging
    arenaRadius: combatResult.arenaRadius,
    startingPositions: combatResult.startingPositions,
    endingPositions: combatResult.endingPositions,
  };
}

/**
 * Process a single scheduled battle
 */
export async function processBattle(scheduledMatch: ScheduledLeagueMatchData): Promise<BattleResult & { prestigeAwarded: number; fameAwarded: number; achievementUnlocks: UnlockedAchievement[] }> {
  // Detect bye match BEFORE DB lookup — bye robots are in-memory fabrications (id < 0)
  // and don't exist in the database (Spec #41).
  const isByeMatch = scheduledMatch.robot1Id < 0 || scheduledMatch.robot2Id < 0;
  if (isByeMatch) {
    return processByeBattle(scheduledMatch);
  }

  // Load both robots with their weapons
  const robot1 = await loadCombatRobot(scheduledMatch.robot1Id);
  const robot2 = await loadCombatRobot(scheduledMatch.robot2Id);
  
  if (!robot1 || !robot2) {
    throw new BattleError(
      BattleErrorCode.ROBOT_NOT_ELIGIBLE,
      `Robots not found for match ${scheduledMatch.id}`,
      404,
      { matchId: scheduledMatch.id, robot1Id: scheduledMatch.robot1Id, robot2Id: scheduledMatch.robot2Id }
    );
  }
  
  // Battle-time readiness (rule 1): checked on the loaded weapon relations.
  // No main weapon forfeits; an incomplete loadout fights as single (rule 6).
  const entry = evaluateMatchEntry([robot1], [robot2]);
  if (entry.kind !== 'fight') {
    return resolveLeagueForfeit(scheduledMatch, robot1, robot2, entry);
  }
  // In memory only, and before prepareRobotForCombat reads loadoutType.
  applyAndLogLoadoutFallbacks([robot1, robot2], entry.decisions, scheduledMatch.id);

  // Robots enter battles fully repaired (battle-ready state)
  // This is the intended game mechanic - players should repair before battles
  // Fetch tuning bonuses in a single batch query and prepare robots for combat
  const tuningMap = await prepareRobotsWithTuning([robot1, robot2]);
  
  // Normal (non-bye) battle — simulate combat
  const result = simulateBattleWrapper(robot1, robot2);
  
  // Create battle record
  const battle = await createBattleRecord(scheduledMatch, robot1, robot2, result);
  result.battleId = battle.id;
  
  // Fetch both participants once (created by createBattleRecord) — reused throughout
  const participants = await prisma.battleParticipant.findMany({
    where: { battleId: battle.id },
  });
  const robot1Participant = participants.find(p => p.robotId === robot1.id)!;
  const robot2Participant = participants.find(p => p.robotId === robot2.id)!;
  
  if (!robot1Participant || !robot2Participant) {
    throw new BattleError(
      BattleErrorCode.INVALID_BATTLE_STATE,
      `BattleParticipant records not found for battle ${battle.id}`,
      500,
      { battleId: battle.id, robot1Id: robot1.id, robot2Id: robot2.id }
    );
  }
  
  // Update robot stats and award prestige/fame (pass pre-fetched participants)
  const stats1 = await updateRobotStats(robot1, battle, robot1Participant, robot2Participant, false);
  const stats2 = await updateRobotStats(robot2, battle, robot2Participant, robot1Participant, false);
  
  const totalPrestige = stats1.prestigeAwarded + stats2.prestigeAwarded;
  const totalFame = stats1.fameAwarded + stats2.fameAwarded;
  
  // Calculate and award streaming revenue (parallel — independent per robot)
  const [streamingRevenue1, streamingRevenue2] = await Promise.all([
    awardStreamingRevenueForParticipant(robot1.id, robot1.userId, battle.id, false, 1, 'league_1v1'),
    awardStreamingRevenueForParticipant(robot2.id, robot2.userId, battle.id, false, 1, 'league_1v1'),
  ]);
  
  if (streamingRevenue1) {
    logger.info(`[Streaming] ${robot1.name} earned ₡${streamingRevenue1.totalRevenue.toLocaleString()} from Battle #${battle.id}`);
  }
  if (streamingRevenue2) {
    logger.info(`[Streaming] ${robot2.name} earned ₡${streamingRevenue2.totalRevenue.toLocaleString()} from Battle #${battle.id}`);
  }
  
  // Determine results for each robot (participants already fetched above)
  const robot1IsWinner = result.winnerId === robot1.id;
  const robot2IsWinner = result.winnerId === robot2.id;
  
  // Log battle_complete events to audit log - ONE EVENT PER ROBOT (parallel — independent writes)
  // Non-blocking: audit failures must never crash a battle
  try {
    await Promise.all([
      logBattleAuditEvent(
        {
          robotId: robot1.id,
          userId: robot1.userId,
          isWinner: robot1IsWinner,
          isDraw: result.isDraw,
          damageDealt: robot1Participant.damageDealt,
          finalHP: robot1Participant.finalHP,
          yielded: robot1Participant.yielded,
          destroyed: robot1Participant.destroyed,
          credits: robot1IsWinner ? (battle.winnerReward ?? 0) : (battle.loserReward ?? 0),
          prestige: stats1.prestigeAwarded,
          fame: stats1.fameAwarded,
          eloBefore: robot1Participant.eloBefore,
          eloAfter: robot1Participant.eloAfter,
        },
        { id: battle.id, battleType: battle.battleType, leagueType: battle.leagueType, durationSeconds: battle.durationSeconds, eloChange: Math.abs(robot1Participant.eloAfter - robot1Participant.eloBefore) },
        robot2.id,
        streamingRevenue1?.totalRevenue || 0,
        false,
      ),
      logBattleAuditEvent(
        {
          robotId: robot2.id,
          userId: robot2.userId,
          isWinner: robot2IsWinner,
          isDraw: result.isDraw,
          damageDealt: robot2Participant.damageDealt,
          finalHP: robot2Participant.finalHP,
          yielded: robot2Participant.yielded,
          destroyed: robot2Participant.destroyed,
          credits: robot2IsWinner ? (battle.winnerReward ?? 0) : (battle.loserReward ?? 0),
          prestige: stats2.prestigeAwarded,
          fame: stats2.fameAwarded,
          eloBefore: robot2Participant.eloBefore,
          eloAfter: robot2Participant.eloAfter,
        },
        { id: battle.id, battleType: battle.battleType, leagueType: battle.leagueType, durationSeconds: battle.durationSeconds, eloChange: Math.abs(robot2Participant.eloAfter - robot2Participant.eloBefore) },
        robot1.id,
        streamingRevenue2?.totalRevenue || 0,
        false,
      ),
    ]);
  } catch (auditError) {
    logger.error(`[BattleOrchestrator] Audit log failed for battle #${battle.id}: ${auditError instanceof Error ? auditError.message : String(auditError)}`);
  }
  
  // Prestige/fame awards are already stored in BattleParticipant records
  // No need to update Battle table
  
  // Check and award achievements for both robots
  // Look up whether each robot lost their previous battle (for C15 "I Didn't Hear No Bell")
  const [robot1PrevLost, robot2PrevLost] = await Promise.all([
    didRobotLosePreviousBattle(robot1.id, battle.id),
    didRobotLosePreviousBattle(robot2.id, battle.id),
  ]);

    const [unlocks1, unlocks2] = await Promise.all([
      checkAndAwardAchievements(robot1.userId, robot1.id, {
        won: robot1IsWinner,
        destroyed: robot2Participant.destroyed,
        finalHpPercent: robot1.maxHP > 0 ? (robot1Participant.finalHP / robot1.maxHP) * 100 : 0,
        eloChange: robot1Participant.eloAfter - robot1Participant.eloBefore,
        // Spec #46 R8 Cause B: the upset trigger needs both pre-battle ratings,
        // not the subject's ELO change, which ELO_K_FACTOR bounds at 32.
        subjectEloBefore: robot1Participant.eloBefore,
        opponentEloBefore: robot2Participant.eloBefore,
        opponentElo: robot2.elo,
        yielded: robot1Participant.yielded,
        opponentYielded: robot2Participant.yielded,
        previousBattleLost: robot1PrevLost,
        damageDealt: robot1Participant.damageDealt,
        opponentDamageDealt: robot2Participant.damageDealt,
        loadoutType: robot1.loadoutType || 'single',
        stance: robot1.stance || 'balanced',
        yieldThreshold: robot1.yieldThreshold,
        hasTuning: hasAllocatedTuning(tuningMap.get(robot1.id)),
        hasMainWeapon: robot1.mainWeaponId !== null,
        battleType: 'league_1v1',
        battleDurationSeconds: result.durationSeconds,
        battleId: battle.id,
        isDraw: result.isDraw,
        opponentRobotId: robot2.id,
        opponentFinalHpPercent: hpPercentOf(robot2Participant.finalHP, robot2.maxHP),
        minHpPercent: lowestHpPercent(result.combatEvents, robot1.name, robot1.maxHP, robot1Participant.finalHP),
      }),
      checkAndAwardAchievements(robot2.userId, robot2.id, {
        won: robot2IsWinner,
        destroyed: robot1Participant.destroyed,
        finalHpPercent: robot2.maxHP > 0 ? (robot2Participant.finalHP / robot2.maxHP) * 100 : 0,
        eloChange: robot2Participant.eloAfter - robot2Participant.eloBefore,
        subjectEloBefore: robot2Participant.eloBefore,
        opponentEloBefore: robot1Participant.eloBefore,
        opponentElo: robot1.elo,
        yielded: robot2Participant.yielded,
        opponentYielded: robot1Participant.yielded,
        previousBattleLost: robot2PrevLost,
        damageDealt: robot2Participant.damageDealt,
        opponentDamageDealt: robot1Participant.damageDealt,
        loadoutType: robot2.loadoutType || 'single',
        stance: robot2.stance || 'balanced',
        yieldThreshold: robot2.yieldThreshold,
        hasTuning: hasAllocatedTuning(tuningMap.get(robot2.id)),
        hasMainWeapon: robot2.mainWeaponId !== null,
        battleType: 'league_1v1',
        battleDurationSeconds: result.durationSeconds,
        battleId: battle.id,
        isDraw: result.isDraw,
        opponentRobotId: robot1.id,
        opponentFinalHpPercent: hpPercentOf(robot1Participant.finalHP, robot1.maxHP),
        minHpPercent: lowestHpPercent(result.combatEvents, robot2.name, robot2.maxHP, robot2Participant.finalHP),
      }),
    ]);
    const achievementUnlocks = [...unlocks1, ...unlocks2];

  // Update scheduled match status in unified table
  await prisma.scheduledMatch.update({
    where: { id: scheduledMatch.id },
    data: {
      status: 'completed',
      battleId: battle.id,
    },
  });
  
  // Consolidated battle completion log
  const winnerName = result.winnerId ? (result.winnerId === robot1.id ? robot1.name : robot2.name) : 'Draw';
  
  // Check for kills from BattleParticipant data (reuse variables from earlier)
  const robot1Killed = robot2Participant?.destroyed || false;
  const robot2Killed = robot1Participant?.destroyed || false;
  const killInfo = robot1Killed ? ` | Kill: ${robot1.name}` : (robot2Killed ? ` | Kill: ${robot2.name}` : '');
  
  logger.info(`[Battle] League: ${battle.leagueType} | ${robot1.name} (User ${robot1.userId}) vs ${robot2.name} (User ${robot2.userId}) | Winner: ${winnerName} | Rewards: ₡${battle.winnerReward?.toLocaleString() || 0} / ₡${battle.loserReward?.toLocaleString() || 0} | Prestige: +${totalPrestige} | Fame: +${totalFame}${killInfo}`);
  
  return {
    ...result,
    prestigeAwarded: totalPrestige,
    fameAwarded: totalFame,
    achievementUnlocks,
  };
}

/**
 * Execute scheduled battles
 * @param _scheduledFor - Optional date filter. If provided, only executes matches scheduled for this time or earlier.
 *                       If not provided (undefined), executes ALL scheduled matches regardless of their scheduled time.
 */
export async function executeScheduledBattles(_scheduledFor?: Date): Promise<BattleExecutionSummary> {
  logger.info('[BattleOrchestrator] Executing all scheduled league battles');
  
  // Read from unified scheduled_matches_v2 table (Spec #40)
  const unifiedMatches = await prisma.scheduledMatch.findMany({
    where: {
      matchType: 'league_1v1',
      status: 'scheduled',
    },
    include: { participants: true },
    orderBy: { createdAt: 'asc' },
  });
  
  // Map unified matches to the shape processBattle expects
  const scheduledMatches = unifiedMatches.map(m => {
    const p1 = m.participants.find(p => p.slot === 1);
    const p2 = m.participants.find(p => p.slot === 2);
    return {
      id: m.id,
      robot1Id: p1?.participantId ?? 0,
      robot2Id: p2?.participantId ?? 0,
      leagueType: m.leagueType ?? 'bronze',
      leagueInstanceId: m.leagueInstanceId ?? 'bronze_1',
      scheduledFor: m.scheduledFor,
      status: m.status,
      battleId: m.battleId,
      createdAt: m.createdAt,
      // Keep reference to unified match for status update
      _unifiedMatchId: m.id,
    };
  });
  
  logger.info(`[BattleOrchestrator] Found ${scheduledMatches.length} matches to execute`);
  
  const summary: BattleExecutionSummary = {
    totalBattles: scheduledMatches.length,
    successfulBattles: 0,
    failedBattles: 0,
    byeBattles: 0,
    forfeitBattles: 0,
    errors: [],
    totalStreamingRevenue: 0,
    reputationSummary: {
      totalPrestigeAwarded: 0,
      totalFameAwarded: 0,
      prestigeByLeague: {},
      fameByLeague: {},
    },
  };
  
  // Process each battle
  for (const match of scheduledMatches) {
    try {
      const result = await processBattle(match);
      if (result.isByeMatch) {
        // A bye resolves successfully but simulates no combat, so it belongs
        // exclusively in the bye counter rather than successful fought battles.
        summary.byeBattles++;
      } else if (result.isForfeit) {
        // A forfeit is a walkover, not a fought battle.
        summary.forfeitBattles++;
      } else {
        summary.successfulBattles++;
      }
      
      // Track reputation awards (league type already known from the scheduled match)
      if (summary.reputationSummary) {
        summary.reputationSummary.totalPrestigeAwarded += result.prestigeAwarded;
        summary.reputationSummary.totalFameAwarded += result.fameAwarded;
        
        if (result.prestigeAwarded > 0 || result.fameAwarded > 0) {
          const league = match.leagueType;
          summary.reputationSummary.prestigeByLeague[league] = 
            (summary.reputationSummary.prestigeByLeague[league] || 0) + result.prestigeAwarded;
          summary.reputationSummary.fameByLeague[league] = 
            (summary.reputationSummary.fameByLeague[league] || 0) + result.fameAwarded;
        }
      }
    } catch (error) {
      // Rule 7: cancel the match (no retry, no reward), log, carry on.
      summary.failedBattles++;
      const { errorSummary } = await handleMatchFailure({
        mode: 'league_1v1',
        ref: { source: 'scheduled_match', id: match.id },
        error,
        participants: [match.robot1Id, match.robot2Id],
      });
      summary.errors.push(`Match ${match.id}: ${errorSummary}`);
    }
  }
  
  logger.info(`[BattleOrchestrator] Execution complete: ${summary.successfulBattles} successful, ${summary.failedBattles} failed, ${summary.byeBattles} bye-matches, ${summary.forfeitBattles} forfeits`);
  logger.info(`[BattleOrchestrator] Reputation: ${summary.reputationSummary?.totalPrestigeAwarded} prestige, ${summary.reputationSummary?.totalFameAwarded} fame awarded`);
  if (summary.totalStreamingRevenue && summary.totalStreamingRevenue > 0) {
    logger.info(`[BattleOrchestrator] Streaming Revenue: ₡${summary.totalStreamingRevenue.toLocaleString()} total earned`);
  }
  
  return summary;
}








