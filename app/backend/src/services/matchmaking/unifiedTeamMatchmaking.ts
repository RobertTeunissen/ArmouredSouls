/**
 * Unified Team Matchmaking
 *
 * Single parameterized entry point for all team-based matchmaking modes
 * (2v2 League, 3v3 League, Tag Team). Handles the shared pipeline:
 * tier iteration → eligibility → pairing → scheduling.
 *
 * Consumed by:
 *   - teamBattleMatchmakingService.ts (thin wrapper for 2v2/3v3 League)
 *   - tagTeamMatchmakingService.ts (thin wrapper for Tag Team)
 *
 * Spec #41: Unified Match Scheduling — Requirement 24
 */

import { Robot, TeamBattle, TeamBattleMember, MatchType, Prisma } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import schedulingService from '../scheduling/schedulingService';
import { checkSchedulingReadiness } from '../analytics/matchmakingService';
import { TEAM_BATTLE_LEAGUE_TIERS } from '../team-battle/teamBattleAdapter';
import {
  calculateMatchScore as sharedCalculateMatchScore,
  createByeTeam as sharedCreateByeTeam,
  MatchScoreInput,
  RECENT_OPPONENT_LIMIT,
  createRecentOpponentQueryFn,
  defaultScheduledFor,
} from './teamMatchmakingUtils';

// ─── Types ───────────────────────────────────────────────────────────────────

/** TeamBattle with members and their robots loaded. */
export interface TeamBattleWithMembers extends TeamBattle {
  members: (TeamBattleMember & { robot: Robot })[];
}

export interface TeamMatchPair {
  team1: TeamBattleWithMembers;
  team2: TeamBattleWithMembers;
  isByeMatch: boolean;
  league: string;
  leagueInstanceId: string;
}

/** Configuration for a specific team matchmaking mode. */
export interface TeamMatchmakingConfig {
  teamSize: 2 | 3;
  matchType: MatchType;
  standingsMode: string;
  subscriptionEvent: string;
  /** Optional eligibility filter beyond the standard checks (e.g., team.eligibility === 'ELIGIBLE') */
  eligibilityFilter?: (team: TeamBattleWithMembers) => boolean;
  logPrefix: string;
}

// ─── Eligibility ─────────────────────────────────────────────────────────────

/**
 * Get eligible teams for matchmaking within a specific tier instance.
 * Shared across all team-based modes.
 */
async function getEligibleTeams(
  config: TeamMatchmakingConfig,
  tier: string,
  leagueInstanceId: string,
): Promise<TeamBattleWithMembers[]> {
  // Get team IDs from standings (source of truth)
  const standingsInInstance = await prisma.standing.findMany({
    where: { mode: config.standingsMode as any, leagueInstanceId },
    select: { entityId: true },
  });
  const teamIdsInInstance = standingsInInstance.map(s => s.entityId);

  if (teamIdsInInstance.length === 0) return [];

  // Load teams with members and robots
  const teams = await prisma.teamBattle.findMany({
    where: {
      id: { in: teamIdsInInstance },
      teamSize: config.teamSize,
    },
    include: {
      members: { include: { robot: true } },
    },
  });

  // Apply custom eligibility filter if provided
  let filteredTeams = config.eligibilityFilter
    ? (teams as TeamBattleWithMembers[]).filter(config.eligibilityFilter)
    : (teams as TeamBattleWithMembers[]);

  // Filter for scheduling-ready teams (all members have weapons equipped)
  const readyTeams: TeamBattleWithMembers[] = [];
  for (const team of filteredTeams) {
    if (team.members.length !== config.teamSize) continue;

    let allReady = true;
    for (const member of team.members) {
      if (!checkSchedulingReadiness(member.robot).isReady) {
        allReady = false;
        break;
      }
    }
    if (allReady) readyTeams.push(team);
  }

  // Check already-scheduled via unified schedulingService
  const alreadyScheduledIds = new Set<number>();
  for (const team of readyTeams) {
    const upcoming = await schedulingService.getUpcomingForTeam(team.id, [config.matchType]);
    if (upcoming.length > 0) alreadyScheduledIds.add(team.id);
  }
  const availableTeams = readyTeams.filter(t => !alreadyScheduledIds.has(t.id));

  // Subscription check — ALL members must have active subscription
  const allRobotIds = availableTeams.flatMap(t => t.members.map(m => m.robotId));
  const { batchActivatePendingSubscriptions } = await import('../subscription/subscriptionService');
  await batchActivatePendingSubscriptions(allRobotIds, config.subscriptionEvent);

  const subscribedRobotIds = await prisma.subscription.findMany({
    where: { eventType: config.subscriptionEvent, robotId: { in: allRobotIds }, status: 'active' },
    select: { robotId: true },
  });
  const subscribedSet = new Set(subscribedRobotIds.map(s => s.robotId));
  const eligibleTeams = availableTeams.filter(t => t.members.every(m => subscribedSet.has(m.robotId)));

  const excluded = availableTeams.length - eligibleTeams.length;
  if (excluded > 0) {
    logger.info(`${config.logPrefix} Excluded ${excluded} teams without ${config.subscriptionEvent} subscription`);
  }

  logger.info(
    `${config.logPrefix} ${leagueInstanceId}: ${eligibleTeams.length} eligible teams ` +
    `(${teams.length} total, ${readyTeams.length} ready, ${alreadyScheduledIds.size} already scheduled)`
  );

  return eligibleTeams;
}

// ─── Pairing ─────────────────────────────────────────────────────────────────

function computeTeamELO(team: TeamBattleWithMembers): number {
  return team.members.reduce((sum, m) => sum + m.robot.elo, 0);
}

function findBestOpponent(
  team: TeamBattleWithMembers,
  availableTeams: TeamBattleWithMembers[],
  combinedELOMap: Map<number, number>,
  recentOpponentsMap: Map<number, number[]>,
  standingsLPMap: Map<number, number>,
): TeamBattleWithMembers | null {
  if (availableTeams.length === 0) return null;

  const teamELO = combinedELOMap.get(team.id)!;
  const teamRecentOpponents = recentOpponentsMap.get(team.id) || [];

  const scoredOpponents = availableTeams.map(opponent => {
    const opponentELO = combinedELOMap.get(opponent.id)!;
    const opponentRecentOpponents = recentOpponentsMap.get(opponent.id) || [];
    const input: MatchScoreInput = {
      entity1LP: standingsLPMap.get(team.id) ?? 0,
      entity2LP: standingsLPMap.get(opponent.id) ?? 0,
      entity1ELO: teamELO,
      entity2ELO: opponentELO,
      recentOpponents1: teamRecentOpponents,
      recentOpponents2: opponentRecentOpponents,
      entity1Id: team.id,
      entity2Id: opponent.id,
      entity1StableId: team.stableId,
      entity2StableId: opponent.stableId,
    };
    return { opponent, score: sharedCalculateMatchScore(input) };
  });

  // Sort by score, tie-break by createdAt (deterministic)
  scoredOpponents.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.opponent.createdAt.getTime() - b.opponent.createdAt.getTime();
  });

  // R4.7: If best match is recent and ALL are recent, fall back to closest-ELO
  const bestMatch = scoredOpponents[0];
  const bestIsRecent =
    teamRecentOpponents.includes(bestMatch.opponent.id) ||
    (recentOpponentsMap.get(bestMatch.opponent.id) || []).includes(team.id);

  if (bestIsRecent) {
    const nonRecent = scoredOpponents.find(so => {
      const oppRecent = recentOpponentsMap.get(so.opponent.id) || [];
      return !teamRecentOpponents.includes(so.opponent.id) && !oppRecent.includes(team.id);
    });
    if (!nonRecent) {
      // R4.7 fallback: closest-ELO
      const closestELO = [...scoredOpponents].sort((a, b) => {
        const diffA = Math.abs(combinedELOMap.get(a.opponent.id)! - teamELO);
        const diffB = Math.abs(combinedELOMap.get(b.opponent.id)! - teamELO);
        if (diffA !== diffB) return diffA - diffB;
        return a.opponent.createdAt.getTime() - b.opponent.createdAt.getTime();
      });
      return closestELO[0].opponent;
    }
  }

  return bestMatch.opponent;
}

// ─── Bye Team Factory ────────────────────────────────────────────────────────

function createByeTeam(league: string, leagueId: string, teamSize: 2 | 3): TeamBattleWithMembers {
  return sharedCreateByeTeam(
    (_league: string, _leagueId: string): TeamBattleWithMembers => {
      const members: (TeamBattleMember & { robot: Robot })[] = [];
      for (let i = 0; i < teamSize; i++) {
        members.push({
          id: -(i + 1),
          teamId: -1,
          robotId: -(i + 1),
          slotIndex: i,
          robot: {
            id: -(i + 1),
            userId: -1,
            name: `Bye Robot ${i + 1}`,
            frameId: 1,
            paintJob: null,
            imageUrl: null,
            elo: 1000,
            totalBattles: 0,
            wins: 0, draws: 0, losses: 0,
            currentHP: 100, maxHP: 100, currentShield: 20, maxShield: 20,
            loadoutType: 'single',
            mainWeaponId: null, offhandWeaponId: null,
            createdAt: new Date(), updatedAt: new Date(),
          } as unknown as Robot,
        });
      }
      return {
        id: -1,
        stableId: -1,
        teamSize,
        teamName: 'Bye Team',
        teamLp: 0,
        teamLeague: _league,
        teamLeagueId: _leagueId,
        cyclesInLeague: 0,
        totalLeagueWins: 0, totalLeagueLosses: 0, totalLeagueDraws: 0,
        tagTeamLp: 0,
        tagTeamLeague: _league,
        tagTeamLeagueId: _leagueId,
        cyclesInTagTeamLeague: 0,
        totalTagTeamWins: 0, totalTagTeamLosses: 0, totalTagTeamDraws: 0,
        eligibility: 'ELIGIBLE',
        createdAt: new Date(), updatedAt: new Date(),
        members,
      } as TeamBattleWithMembers;
    },
    league,
    leagueId,
  );
}

// ─── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Run team matchmaking for all tiers/instances with the given configuration.
 *
 * Shared pipeline used by all team-based modes (2v2 League, 3v3 League, Tag Team).
 *
 * @param config - Mode-specific configuration
 * @param scheduledFor - When matches should execute (default: 24h+rounded)
 * @returns Total matches created
 */
export async function runTeamMatchmaking(config: TeamMatchmakingConfig, scheduledFor?: Date): Promise<number> {
  const matchTime = scheduledFor ?? defaultScheduledFor();
  let totalMatches = 0;

  logger.info(`${config.logPrefix} Starting matchmaking for all tiers...`);

  for (const tier of TEAM_BATTLE_LEAGUE_TIERS) {
    try {
      const instances = await prisma.standing.findMany({
        where: { mode: config.standingsMode as any, tier },
        select: { leagueInstanceId: true },
        distinct: ['leagueInstanceId'],
      });

      for (const { leagueInstanceId } of instances) {
        try {
          const eligible = await getEligibleTeams(config, tier, leagueInstanceId);
          if (eligible.length < 1) continue;

          // Pair teams
          const matches = await pairTeams(config, eligible, tier, leagueInstanceId);

          // Schedule matches
          for (const match of matches) {
            const participants = [
              { participantType: 'team' as const, participantId: match.team1.id, slot: 1 },
            ];
            if (!match.isByeMatch && match.team2) {
              participants.push({ participantType: 'team' as const, participantId: match.team2.id, slot: 2 });
            }
            await schedulingService.createMatch({
              matchType: config.matchType,
              scheduledFor: matchTime,
              leagueType: match.league,
              leagueInstanceId: match.leagueInstanceId,
              isByeMatch: match.isByeMatch,
              participants,
            });
            totalMatches++;
          }

          if (matches.length > 0) {
            logger.info(`${config.logPrefix} ${leagueInstanceId}: Created ${matches.length} matches`);
          }
        } catch (instanceError) {
          logger.error(`${config.logPrefix} Error in instance ${leagueInstanceId}:`, instanceError);
        }
      }
    } catch (tierError) {
      logger.error(`${config.logPrefix} Error in ${tier} tier:`, tierError);
    }
  }

  logger.info(`${config.logPrefix} Complete: ${totalMatches} total matches created`);
  return totalMatches;
}

// ─── Pairing (Internal) ──────────────────────────────────────────────────────

async function pairTeams(
  config: TeamMatchmakingConfig,
  teams: TeamBattleWithMembers[],
  league: string,
  leagueInstanceId: string,
): Promise<TeamMatchPair[]> {
  if (teams.length === 0) return [];

  const matches: TeamMatchPair[] = [];
  const availableTeams = [...teams];

  // Pre-calculate combined ELO
  const combinedELOMap = new Map<number, number>();
  for (const team of teams) {
    combinedELOMap.set(team.id, computeTeamELO(team));
  }

  // Batch-fetch recent opponents using unified query
  const recentOpponentQueryFn = createRecentOpponentQueryFn(config.matchType, 'team');
  const recentOpponentsMap = await recentOpponentQueryFn(teams.map(t => t.id), RECENT_OPPONENT_LIMIT);

  // Build LP lookup from standings
  const standingsLPMap = new Map(
    (await prisma.standing.findMany({
      where: { mode: config.standingsMode as any, entityId: { in: teams.map(t => t.id) } },
      select: { entityId: true, leaguePoints: true },
    })).map(s => [s.entityId, s.leaguePoints])
  );

  // Greedy pairing
  while (availableTeams.length > 1) {
    const team1 = availableTeams.shift()!;
    const opponent = findBestOpponent(team1, availableTeams, combinedELOMap, recentOpponentsMap, standingsLPMap);

    if (opponent) {
      const opponentIndex = availableTeams.indexOf(opponent);
      availableTeams.splice(opponentIndex, 1);
      matches.push({ team1, team2: opponent, isByeMatch: false, league, leagueInstanceId });
    } else {
      availableTeams.push(team1);
      break;
    }
  }

  // Handle odd team with bye
  if (availableTeams.length === 1) {
    const lastTeam = availableTeams[0];
    const byeTeam = createByeTeam(league, leagueInstanceId, config.teamSize);
    matches.push({ team1: lastTeam, team2: byeTeam, isByeMatch: true, league, leagueInstanceId });
    logger.info(`${config.logPrefix} Bye-match created for team ${lastTeam.id}`);
  }

  return matches;
}
