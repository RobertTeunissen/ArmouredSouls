/**
 * Team Tournament Battle-Time Entry and Forfeits
 *
 * One per-side entry decision for both sides of a team tournament match
 * (design §5.5): a side forfeits if its roster/subscriptions are ineligible or
 * any member has no main weapon. Every forfeit (roster or weapon, single or
 * double) goes through the shared Forfeit_Resolution_Writer, exactly like the
 * other two-sided modes.
 *
 * @module services/tournament/teamTournamentEntry
 */

import { Tournament, ScheduledTournamentMatch } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { RobotWithWeapons } from '../battle/combatSimulator';
import { calculateTeamBattleELOChanges } from '../team-battle/teamBattleRewardService';
import { TournamentError, TournamentErrorCode } from '../../errors/tournamentErrors';
import { getCurrentCycleNumber } from '../battle/baseOrchestrator';
import { resolveHigherSeed } from './tournamentService';
import { evaluateCombatEntry } from '../battle/combatReadiness';
import { loadCombatRobots } from '../battle/battlePreparation';
import { resolveForfeitEvent, type ForfeitSide } from '../battle/forfeitResolutionService';
import { BYE_BATTLE_DURATION_SECONDS } from '../battle/byeResolutionService';
import type { TeamTournamentBattleResult } from './teamTournamentBattleOrchestrator';

/** One side of a team tournament match as loaded for the entry decision. */
export interface TeamTournamentEntrySide {
  /** Bracket participant id (team id), or null for an empty slot. */
  participantId: number | null;
  /** Null when the slot is empty or the team row no longer exists. */
  team: { id: number; stableId: number; teamName: string } | null;
  /** Loaded members; may be short (or empty) only for a forfeiting side. */
  robots: RobotWithWeapons[];
  forfeited: boolean;
}

/** Outcome of `decideTeamTournamentEntry`. */
export type TeamTournamentEntryResult =
  | { kind: 'fight' }
  | { kind: 'forfeit'; result: TeamTournamentBattleResult }
  | { kind: 'housekeeping' };

/**
 * Check if a team is eligible for tournament participation at execution time.
 * A team is eligible if it has a full roster and all members have active
 * subscriptions to the relevant tournament event.
 *
 * @param teamId - The team's ID to check
 * @returns true if the team is eligible, false otherwise
 */
async function isTeamEligibleForTournament(teamId: number): Promise<boolean> {
  const team = await prisma.teamBattle.findUnique({
    where: { id: teamId },
    include: { members: true },
  });
  if (!team || team.members.length !== team.teamSize) return false;

  const eventType = team.teamSize === 2 ? 'tournament_2v2' : 'tournament_3v3';
  const robotIds = team.members.map(m => m.robotId);
  const subscribed = await prisma.subscription.count({
    where: { eventType, robotId: { in: robotIds }, status: 'active' },
  });
  return subscribed === team.members.length;
}

async function loadEntrySide(participantId: number | null): Promise<TeamTournamentEntrySide> {
  const team = participantId === null
    ? null
    : await prisma.teamBattle.findUnique({ where: { id: participantId }, include: { members: true } });
  const rosterEligible = team !== null && (await isTeamEligibleForTournament(team.id));
  const robots: RobotWithWeapons[] = team ? await loadCombatRobots(team.members.map(m => m.robotId)) : [];
  const weaponReady = robots.length > 0 && robots.every(r => evaluateCombatEntry(r).canFight);
  return {
    participantId,
    team: team ? { id: team.id, stableId: team.stableId, teamName: team.teamName } : null,
    robots,
    forfeited: !rosterEligible || !weaponReady,
  };
}

/** Empty placeholder (or both teams gone): close the row with no battle. */
async function completeEmptyMatch(match: ScheduledTournamentMatch): Promise<void> {
  await prisma.scheduledTournamentMatch.update({
    where: { id: match.id },
    data: { status: 'completed', winnerId: null, completedAt: new Date() },
  });
  logger.info(`[TeamTournament] Match ${match.id} closed with no battle | no loadable team on either side`);
}

/**
 * One per-side battle-time entry decision for both sides (design §5.5, rule 2).
 *
 * A side forfeits if its team is roster/subscription-ineligible OR any loaded
 * member has no main weapon. Neither → fight. One → that side forfeits through
 * the shared writer and the other advances with the bye-level reward. Both →
 * a double forfeit (a draw battle, no credits) where the higher seed among the
 * sides whose team still exists advances. No loadable team at all (or an empty
 * placeholder) → housekeeping with no battle.
 */
export async function decideTeamTournamentEntry(
  match: ScheduledTournamentMatch,
  tournament: Tournament,
): Promise<TeamTournamentEntryResult> {
  if (match.participant1Id === null && match.participant2Id === null) {
    await completeEmptyMatch(match);
    return { kind: 'housekeeping' };
  }

  const side1 = await loadEntrySide(match.participant1Id);
  const side2 = await loadEntrySide(match.participant2Id);
  if (!side1.forfeited && !side2.forfeited) return { kind: 'fight' };
  if (side1.team === null && side2.team === null) {
    await completeEmptyMatch(match);
    return { kind: 'housekeeping' };
  }

  return { kind: 'forfeit', result: await resolveTeamTournamentForfeit(match, tournament, [side1, side2]) };
}

/**
 * Resolve a team tournament forfeit through the Forfeit_Resolution_Writer.
 *
 * Nothing is simulated and no standings are written. ELO follows design §4:
 * a short or missing forfeiter roster counts as equal strength; a double
 * forfeit uses the draw formula (an incomplete side takes the full side's sum;
 * neither full → unchanged). Each loaded robot moves by its team's change.
 */
export async function resolveTeamTournamentForfeit(
  match: ScheduledTournamentMatch,
  tournament: Tournament,
  sides: [TeamTournamentEntrySide, TeamTournamentEntrySide],
): Promise<TeamTournamentBattleResult> {
  const teamSize: 2 | 3 = tournament.participantType === 'team_2v2' ? 2 : 3;
  const mode = teamSize === 2 ? 'tournament_2v2' as const : 'tournament_3v3' as const;
  const readyIndex = sides.findIndex(s => !s.forfeited);
  const ready = readyIndex === -1 ? null : sides[readyIndex];
  const isDraw = ready === null;

  const sum = (s: TeamTournamentEntrySide): number => s.robots.reduce((acc, r) => acc + r.elo, 0);
  const full = (s: TeamTournamentEntrySide): boolean => s.robots.length === teamSize;
  let changes = { team1Change: 0, team2Change: 0 };
  if (ready) {
    const forfeiter = sides[1 - readyIndex];
    const forfeiterSum = full(forfeiter) ? sum(forfeiter) : sum(ready);
    const [sum1, sum2] = readyIndex === 0 ? [sum(ready), forfeiterSum] : [forfeiterSum, sum(ready)];
    changes = calculateTeamBattleELOChanges(sum1, sum2, readyIndex === 0, false);
  } else if (full(sides[0]) || full(sides[1])) {
    const sum1 = full(sides[0]) ? sum(sides[0]) : sum(sides[1]);
    const sum2 = full(sides[1]) ? sum(sides[1]) : sum(sides[0]);
    changes = calculateTeamBattleELOChanges(sum1, sum2, false, true);
  }
  const teamChange = (side: 0 | 1): number => (side === 0 ? changes.team1Change : changes.team2Change);

  // The team advancing in the bracket: the ready team, or on a double forfeit
  // the higher seed among the sides whose team row still exists.
  let tournamentWinnerId: number;
  if (ready) {
    tournamentWinnerId = ready.team!.id;
  } else if (sides[0].team && sides[1].team) {
    tournamentWinnerId = await resolveHigherSeed(tournament.id, sides[0].team.id, sides[1].team.id);
  } else {
    const existing = sides[0].team ?? sides[1].team;
    if (!existing) {
      throw new TournamentError(
        TournamentErrorCode.INVALID_MATCH_STATE,
        `Team tournament match ${match.id} has no team to advance`,
        400,
        { matchId: match.id },
      );
    }
    tournamentWinnerId = existing.id;
  }

  const newEloByRobotId: Record<number, number> = {};
  sides.forEach((s, i) => {
    for (const r of s.robots) newEloByRobotId[r.id] = r.elo + teamChange(i as 0 | 1);
  });
  const toParticipant = (r: RobotWithWeapons) => ({
    id: r.id,
    name: r.name,
    userId: r.userId,
    currentHP: r.currentHP,
    maxHP: r.maxHP,
    elo: r.elo,
  });
  // Tolerant sides (§4): a deleted team has no stable and no robots.
  const toForfeitSide = (i: 0 | 1): ForfeitSide => ({
    side: (i + 1) as 1 | 2,
    forfeited: sides[i].forfeited,
    stableUserId: sides[i].team?.stableId ?? null,
    standingEntity: null,
    robots: sides[i].robots.map(toParticipant),
  });
  const forfeiterNames = sides
    .filter(s => s.forfeited)
    .map(s => s.team?.teamName ?? `Team #${s.participantId ?? '?'}`)
    .join(' and ');

  const resolution = await resolveForfeitEvent({
    mode,
    context: {
      mode,
      totalParticipants: tournament.totalParticipants,
      currentRound: tournament.currentRound,
      maxRounds: tournament.maxRounds,
    },
    claim: { source: 'tournament_match', tournamentMatchId: match.id },
    sides: [toForfeitSide(0), toForfeitSide(1)],
    newEloByRobotId,
    eloChangeBySide: { 1: changes.team1Change, 2: changes.team2Change },
    lp: { win: 0, loss: 0, draw: 0 },
    standingMode: null,
    battle: {
      battleType: mode,
      leagueType: 'tournament',
      tournamentId: tournament.id,
      tournamentRound: tournament.currentRound,
      winnerId: ready ? ready.team!.id : null,
      winningSide: ready ? ((readyIndex + 1) as 1 | 2) : null,
      message: `${forfeiterNames} forfeited: the team was not battle-ready (roster, subscriptions or a missing main weapon)`,
    },
    tournamentWinnerId,
    cycleNumber: await getCurrentCycleNumber(),
  });

  logger.info(
    `[TeamTournament] Match ${match.id} forfeit | tournament=${tournament.name} round=${tournament.currentRound} ` +
    `team1=${match.participant1Id} team2=${match.participant2Id} ` +
    `outcome=${isDraw ? 'double_forfeit' : readyIndex === 0 ? 'team2_forfeit' : 'team1_forfeit'} ` +
    `advancing=${tournamentWinnerId} credits=${resolution.creditsPaid}${resolution.alreadyResolved ? ' already_resolved' : ''}`,
  );

  if (resolution.battleId === null) {
    throw new TournamentError(
      TournamentErrorCode.BATTLE_RECORD_FAILED,
      `Forfeit resolution produced no battle for team tournament match ${match.id}`,
      500,
      { matchId: match.id },
    );
  }

  return {
    battleId: resolution.battleId,
    winnerId: tournamentWinnerId,
    participants: sides.flatMap((s, i) => s.robots.map((r) => ({
      robotId: r.id,
      team: (i + 1) as 1 | 2,
      damageDealt: 0,
      finalHP: r.currentHP,
      eloBefore: r.elo,
      eloAfter: newEloByRobotId[r.id],
    }))),
    durationSeconds: BYE_BATTLE_DURATION_SECONDS,
    isByeMatch: false,
    isForfeit: true,
  };
}

