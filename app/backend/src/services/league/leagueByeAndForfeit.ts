/**
 * League 1v1 Byes and Battle-Time Forfeits
 *
 * Neither path simulates a battle: a bye goes through the shared
 * Bye_Record writer, a forfeit (one or both robots without a main weapon)
 * through the shared Forfeit_Resolution_Writer.
 *
 * @module services/league/leagueByeAndForfeit
 */

import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { resolveByeEvent } from '../battle/byeResolutionService';
import { resolveForfeitEvent } from '../battle/forfeitResolutionService';
import type { MatchEntryOutcome } from '../battle/combatReadiness';
import { BYE_MODE_SPECS } from '../../utils/byeRewards';
import {
  calculateELOChange,
} from '../../utils/battleMath';
import {
  type UnlockedAchievement,
} from '../battle/battlePostCombat';
import { BattleError, BattleErrorCode } from '../../errors/battleErrors';
import { getCurrentCycleNumber } from '../battle/baseOrchestrator';
import type { CombatRobot } from '../battle/battlePreparation';
import { LEAGUE_POINTS_DRAW, LEAGUE_POINTS_LOSS, LEAGUE_POINTS_WIN } from './leagueBattleRecord';
import type { ScheduledLeagueMatchData, BattleResult } from './leagueBattleOrchestrator';

const BYE_BATTLE_DURATION = 15; // Fixed duration for bye battles

/**
 * Process a bye-match using the same pattern as team battles:
 * - Real robot's ID fills both FK slots on the Battle record
 * - Only one BattleParticipant is created (for the real robot)
 * - Stats, LP, credits, and ELO are awarded normally for the winner
 * - No prestige/fame/streaming/achievements for bye matches
 */
export async function processByeBattle(scheduledMatch: ScheduledLeagueMatchData): Promise<BattleResult & { prestigeAwarded: number; fameAwarded: number; achievementUnlocks: UnlockedAchievement[] }> {
  const realRobotId = scheduledMatch.robot1Id < 0 ? scheduledMatch.robot2Id : scheduledMatch.robot1Id;

  const robot = await prisma.robot.findUnique({
    where: { id: realRobotId },
  });

  if (!robot) {
    throw new BattleError(
      BattleErrorCode.ROBOT_NOT_ELIGIBLE,
      `Real robot not found for bye match ${scheduledMatch.id}`,
      404,
      { matchId: scheduledMatch.id, robotId: realRobotId }
    );
  }

  // ELO change: player always wins vs bye robot (ELO 1000). Retained — a
  // league_1v1 bye has always moved ELO and continues to (Spec #49 R12.10).
  const byeElo = 1000;
  const eloChanges = calculateELOChange(robot.elo, byeElo, false);
  const newElo = robot.elo + eloChanges.winnerChange;

  // Everything below — the reward, the battles row, the participant row, the
  // Standing write, the credit award, the summary, the audit rows and the
  // scheduled-match transition — is the Bye_Reward_Module's job (Spec #49).
  // This is the shape all nine modes now share; the summary and audit rows that
  // this path used to skip come for free because the writer produces them.
  const resolution = await resolveByeEvent({
    mode: 'league_1v1',
    context: { mode: 'league_1v1', tier: scheduledMatch.leagueType },
    claim: { source: 'scheduled_match', scheduledMatchId: scheduledMatch.id },
    participants: [
      {
        id: robot.id,
        name: robot.name,
        userId: robot.userId,
        currentHP: robot.currentHP,
        maxHP: robot.maxHP,
        elo: robot.elo,
      },
    ],
    stableUserId: robot.userId,
    battle: {
      battleType: 'league_1v1',
      leagueType: scheduledMatch.leagueType,
      leagueInstanceId: scheduledMatch.leagueInstanceId,
      winnerId: robot.id,
      byeMessage: `${robot.name} wins by walkover (bye)`,
    },
    standingEntity: { entityType: 'robot', entityId: robot.id },
    newEloByRobotId: { [robot.id]: newElo },
    eloChange: eloChanges.winnerChange,
    cycleNumber: await getCurrentCycleNumber(),
  });

  logger.info(
    `[Battle] Bye-match: ${robot.name} (User ${robot.userId}) auto-win | LP +${LEAGUE_POINTS_WIN} | ELO ${robot.elo} → ${newElo} | ₡${resolution.creditsPaid}`,
  );

  // The writer returns the winning battle id even when the claim was already
  // taken, so a null here means nothing resolved at all. Surfacing 0 would hand
  // callers an id that links nowhere; fail loudly instead.
  if (resolution.battleId === null) {
    throw new Error(
      `Bye resolution produced no battle for scheduled match ${scheduledMatch.id} (robot ${robot.id})`,
    );
  }

  return {
    battleId: resolution.battleId,
    winnerId: robot.id,
    robot1FinalHP: robot.currentHP,
    robot2FinalHP: 0,
    robot1Damage: 0,
    robot2Damage: 0,
    durationSeconds: BYE_BATTLE_DURATION,
    isDraw: false,
    isByeMatch: true,
    isForfeit: false,
    prestigeAwarded: 0,
    fameAwarded: 0,
    achievementUnlocks: [],
  };
}

/**
 * Resolve a league 1v1 battle-time forfeit through the Forfeit_Resolution_Writer.
 *
 * Nothing is simulated. The ready robot wins with the bye-level reward and the
 * bye LP; the forfeiter takes a normal loss (LP, standings, ELO) with 0 credits.
 * Both unready is a draw with no credits.
 */
export async function resolveLeagueForfeit(
  scheduledMatch: ScheduledLeagueMatchData,
  robot1: CombatRobot,
  robot2: CombatRobot,
  outcome: Exclude<MatchEntryOutcome, { kind: 'fight' }>,
): Promise<BattleResult & { prestigeAwarded: number; fameAwarded: number; achievementUnlocks: UnlockedAchievement[] }> {
  const isDraw = outcome.kind === 'double_forfeit';
  const side1Forfeits = isDraw || outcome.forfeitingSides[0] === 1;
  const side2Forfeits = isDraw || outcome.forfeitingSides[0] === 2;

  // ELO: the mode's normal formula against the real opponent (A2/A3).
  let robot1Change: number;
  let robot2Change: number;
  if (isDraw) {
    const changes = calculateELOChange(robot1.elo, robot2.elo, true);
    robot1Change = changes.winnerChange;
    robot2Change = changes.loserChange;
  } else {
    const [ready, forfeiter] = side2Forfeits ? [robot1, robot2] : [robot2, robot1];
    const changes = calculateELOChange(ready.elo, forfeiter.elo, false);
    robot1Change = ready.id === robot1.id ? changes.winnerChange : changes.loserChange;
    robot2Change = ready.id === robot2.id ? changes.winnerChange : changes.loserChange;
  }
  const winner = isDraw ? null : side2Forfeits ? robot1 : robot2;
  const forfeiterNames = [side1Forfeits ? robot1.name : null, side2Forfeits ? robot2.name : null]
    .filter((n): n is string => n !== null)
    .join(' and ');

  const toParticipant = (robot: CombatRobot) => ({
    id: robot.id,
    name: robot.name,
    userId: robot.userId,
    currentHP: robot.currentHP,
    maxHP: robot.maxHP,
    elo: robot.elo,
  });

  const resolution = await resolveForfeitEvent({
    mode: 'league_1v1',
    context: { mode: 'league_1v1', tier: scheduledMatch.leagueType },
    claim: { source: 'scheduled_match', scheduledMatchId: scheduledMatch.id },
    sides: [
      {
        side: 1,
        forfeited: side1Forfeits,
        stableUserId: robot1.userId,
        standingEntity: { entityType: 'robot', entityId: robot1.id },
        robots: [toParticipant(robot1)],
      },
      {
        side: 2,
        forfeited: side2Forfeits,
        stableUserId: robot2.userId,
        standingEntity: { entityType: 'robot', entityId: robot2.id },
        robots: [toParticipant(robot2)],
      },
    ],
    newEloByRobotId: { [robot1.id]: robot1.elo + robot1Change, [robot2.id]: robot2.elo + robot2Change },
    eloChangeBySide: { 1: robot1Change, 2: robot2Change },
    lp: { win: BYE_MODE_SPECS.league_1v1.lpDelta, loss: LEAGUE_POINTS_LOSS, draw: LEAGUE_POINTS_DRAW },
    standingMode: 'league_1v1',
    battle: {
      battleType: 'league_1v1',
      leagueType: scheduledMatch.leagueType,
      leagueInstanceId: scheduledMatch.leagueInstanceId,
      winnerId: winner?.id ?? null,
      winningSide: null,
      message: `${forfeiterNames} forfeited: no main weapon equipped`,
    },
    cycleNumber: await getCurrentCycleNumber(),
  });

  logger.info(
    `[Battle] League forfeit: match ${scheduledMatch.id} | ${robot1.name} vs ${robot2.name} | ` +
    `${isDraw ? 'double forfeit (draw)' : `${winner?.name} wins by forfeit`} | ₡${resolution.creditsPaid}` +
    `${resolution.alreadyResolved ? ' | already resolved' : ''}`,
  );

  if (resolution.battleId === null) {
    throw new BattleError(
      BattleErrorCode.INVALID_BATTLE_STATE,
      `Forfeit resolution produced no battle for scheduled match ${scheduledMatch.id}`,
      500,
      { matchId: scheduledMatch.id },
    );
  }

  return {
    battleId: resolution.battleId,
    winnerId: winner?.id ?? null,
    robot1FinalHP: robot1.currentHP,
    robot2FinalHP: robot2.currentHP,
    robot1Damage: 0,
    robot2Damage: 0,
    durationSeconds: BYE_BATTLE_DURATION,
    isDraw,
    isByeMatch: false,
    isForfeit: true,
    prestigeAwarded: 0,
    fameAwarded: 0,
    achievementUnlocks: [],
  };
}

