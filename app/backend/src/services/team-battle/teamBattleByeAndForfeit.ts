/**
 * Team League Byes and Battle-Time Forfeits (2v2/3v3)
 *
 * Neither path simulates a battle: a bye goes through the shared
 * Bye_Record writer before the absent side is loaded or fabricated, a
 * forfeit (any member without a main weapon forfeits the whole team) through
 * the shared Forfeit_Resolution_Writer.
 *
 * @module services/team-battle/teamBattleByeAndForfeit
 */

import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { RobotWithWeapons } from '../battle/combatSimulator';
import { resolveByeEvent } from '../battle/byeResolutionService';
import { resolveForfeitEvent } from '../battle/forfeitResolutionService';
import type { MatchEntryOutcome } from '../battle/combatReadiness';
import { BYE_MODE_SPECS } from '../../utils/byeRewards';
import {
  calculateTeamBattleELOChanges,
  calculateTeamBattleLPDelta,
  getByeTeamELO,
} from './teamBattleRewardService';
import type { ScheduledMatchWithTeams, SingleMatchResult } from './teamBattleOrchestrator';

// ─── Bye Resolution ──────────────────────────────────────────────────────────

/**
 * Resolve a team league bye through the Bye_Reward_Module (Spec #49).
 *
 * Nothing is simulated, no opponent is fabricated, and no robot is prepared for
 * combat — weapons and tuning cannot affect an unsimulated outcome, so this does
 * not call `loadCombatRobots` or `prepareRobotForCombat` either. A
 * plain robot read supplies the names, HP and ELO the writer needs.
 *
 * The team still gains ELO against the bye team's notional rating and LP +3,
 * exactly as before: removing the simulation changes how the outcome is reached,
 * not what the outcome is worth.
 */
export async function resolveTeamLeagueBye(
  match: ScheduledMatchWithTeams,
  teamSize: 2 | 3,
  battleType: string,
  cycleNumber: number,
): Promise<SingleMatchResult> {
  const robotIds = match.team1.members.map(m => m.robotId);
  const robots = await prisma.robot.findMany({
    where: { id: { in: robotIds } },
    select: { id: true, name: true, userId: true, currentHP: true, maxHP: true, elo: true },
  });

  const team1SumELO = robots.reduce((sum, r) => sum + r.elo, 0);
  const eloChanges = calculateTeamBattleELOChanges(
    team1SumELO,
    getByeTeamELO(teamSize),
    true,
    false,
  );

  const newEloByRobotId: Record<number, number> = {};
  for (const r of robots) {
    newEloByRobotId[r.id] = r.elo + eloChanges.team1Change;
  }

  const mode = teamSize === 2 ? 'league_2v2' : 'league_3v3';

  const resolution = await resolveByeEvent({
    mode,
    context: { mode, tier: match.teamBattleLeague },
    claim: { source: 'scheduled_match', scheduledMatchId: match.id },
    participants: robots,
    stableUserId: match.team1.stableId,
    battle: {
      battleType,
      leagueType: match.teamBattleLeague,
      leagueInstanceId: match.teamBattleLeagueId,
      winnerId: robots[0]?.id ?? null,
      winningSide: 1,
      byeMessage: `${match.team1.teamName ?? 'Team'} wins by walkover (bye)`,
    },
    standingEntity: { entityType: 'team', entityId: match.team1Id },
    newEloByRobotId,
    eloChange: eloChanges.team1Change,
    cycleNumber,
  });

  logger.info(
    `[TeamBattle] Bye: team ${match.team1Id} (${mode}) auto-win | ₡${resolution.creditsPaid} | no damage, no prestige, no fame`,
  );

  return {
    matchId: match.id,
    status: 'completed',
    battleId: resolution.battleId ?? undefined,
  };
}

// ─── Forfeit Resolution ──────────────────────────────────────────────────────

/**
 * Resolve a team league battle-time forfeit through the Forfeit_Resolution_Writer.
 *
 * Nothing is simulated. The ready team wins with the bye-level reward and the
 * bye LP; the forfeiting team takes a normal loss (LP, standings, team ELO) with
 * 0 credits. Both teams unready is a draw with no credits.
 */
export async function resolveTeamLeagueForfeit(
  match: ScheduledMatchWithTeams,
  teamSize: 2 | 3,
  battleType: string,
  cycleNumber: number,
  team1Robots: RobotWithWeapons[],
  team2Robots: RobotWithWeapons[],
  outcome: Exclude<MatchEntryOutcome, { kind: 'fight' }>,
): Promise<SingleMatchResult> {
  const team2 = match.team2!;
  const mode = teamSize === 2 ? 'league_2v2' : 'league_3v3';
  const isDraw = outcome.kind === 'double_forfeit';
  const side1Forfeits = isDraw || outcome.forfeitingSides[0] === 1;
  const side2Forfeits = isDraw || outcome.forfeitingSides[0] === 2;

  const team1SumELO = team1Robots.reduce((sum, r) => sum + r.elo, 0);
  const team2SumELO = team2Robots.reduce((sum, r) => sum + r.elo, 0);
  const eloChanges = calculateTeamBattleELOChanges(team1SumELO, team2SumELO, !isDraw && side2Forfeits, isDraw);
  const newEloByRobotId: Record<number, number> = {};
  for (const r of team1Robots) newEloByRobotId[r.id] = r.elo + eloChanges.team1Change;
  for (const r of team2Robots) newEloByRobotId[r.id] = r.elo + eloChanges.team2Change;

  const readySide: 1 | 2 | null = isDraw ? null : side2Forfeits ? 1 : 2;
  const winnerTeamId = readySide === 1 ? match.team1Id : readySide === 2 ? match.team2Id : null;
  const toParticipant = (r: RobotWithWeapons) => ({
    id: r.id,
    name: r.name,
    userId: r.userId,
    currentHP: r.currentHP,
    maxHP: r.maxHP,
    elo: r.elo,
  });
  const forfeiterNames = [
    side1Forfeits ? match.team1.teamName : null,
    side2Forfeits ? team2.teamName : null,
  ].filter((n): n is string => n !== null).join(' and ');

  const resolution = await resolveForfeitEvent({
    mode,
    context: { mode, tier: match.teamBattleLeague },
    claim: { source: 'scheduled_match', scheduledMatchId: match.id },
    sides: [
      {
        side: 1,
        forfeited: side1Forfeits,
        stableUserId: match.team1.stableId,
        standingEntity: { entityType: 'team', entityId: match.team1Id },
        robots: team1Robots.map(toParticipant),
      },
      {
        side: 2,
        forfeited: side2Forfeits,
        stableUserId: team2.stableId,
        standingEntity: { entityType: 'team', entityId: team2.id },
        robots: team2Robots.map(toParticipant),
      },
    ],
    newEloByRobotId,
    eloChangeBySide: { 1: eloChanges.team1Change, 2: eloChanges.team2Change },
    lp: {
      win: BYE_MODE_SPECS[mode].lpDelta,
      loss: calculateTeamBattleLPDelta(false, false),
      draw: calculateTeamBattleLPDelta(false, true),
    },
    standingMode: mode,
    battle: {
      battleType,
      leagueType: match.teamBattleLeague,
      leagueInstanceId: match.teamBattleLeagueId,
      winnerId: winnerTeamId,
      winningSide: readySide,
      message: `${forfeiterNames || 'Team'} forfeited: a robot had no main weapon equipped`,
    },
    cycleNumber,
  });

  logger.info(
    `[TeamBattle] Match ${match.id} forfeit | cycle=${cycleNumber} team_size=${teamSize} ` +
    `team1=${match.team1Id} team2=${match.team2Id} ` +
    `outcome=${isDraw ? 'double_forfeit' : readySide === 1 ? 'team2_forfeit' : 'team1_forfeit'} ` +
    `credits=${resolution.creditsPaid}${resolution.alreadyResolved ? ' already_resolved' : ''}`,
  );

  return { matchId: match.id, status: 'forfeit', battleId: resolution.battleId ?? undefined };
}

