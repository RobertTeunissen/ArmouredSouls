/**
 * Team Battle Matchmaking Service
 *
 * Handles matchmaking for 2v2 and 3v3 Team Battle leagues.
 * Iterates tiers → instances → eligible teams, pairs using the shared
 * LP-primary scoring formula, and persists ScheduledTeamBattleMatch records.
 *
 * Follows the same pattern as tagTeamMatchmakingService.ts but adapted for
 * the TeamBattle model with N-member teams.
 *
 * Requirements: R3.3, R3.4, R4.1–R4.7
 *
 * @module services/team-battle/teamBattleMatchmakingService
 */

import { Robot, Prisma, TeamBattle, TeamBattleMember, MatchType } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import schedulingService from '../scheduling/schedulingService';
import { checkSchedulingReadiness } from '../analytics/matchmakingService';
import { TEAM_BATTLE_LEAGUE_TIERS } from './teamBattleAdapter';
import {
  calculateMatchScore as sharedCalculateMatchScore,
  createByeTeam as sharedCreateByeTeam,
  getRecentOpponentsBatch as sharedGetRecentOpponentsBatch,
  MatchScoreInput,
  RECENT_OPPONENT_LIMIT,
  defaultScheduledFor,
} from '../matchmaking/teamMatchmakingUtils';

// ─── Types ───────────────────────────────────────────────────────────────────

/** TeamBattle with members and their robots loaded. */
export interface TeamBattleWithMembers extends TeamBattle {
  members: (TeamBattleMember & { robot: Robot })[];
}

export interface TeamBattleMatchPair {
  team1: TeamBattleWithMembers;
  team2: TeamBattleWithMembers;
  isByeMatch: boolean;
  teamBattleLeague: string;
  teamBattleLeagueId: string;
}

// ─── Eligibility ─────────────────────────────────────────────────────────────

/**
 * Get eligible teams for matchmaking within a specific league instance.
 *
 * Eligibility criteria:
 * - Team eligibility = ELIGIBLE (full roster)
 * - All members subscribed to the corresponding event (league_2v2 or league_3v3)
 * - All members pass scheduling readiness (weapon check)
 * - Team not already scheduled for a pending match
 *
 * Requirements: R3.3, R3.4, R4.6
 */
export async function getEligibleTeams(
  teamBattleLeague: string,
  teamBattleLeagueId: string,
  teamSize: 2 | 3,
): Promise<TeamBattleWithMembers[]> {
  const eventType = teamSize === 2 ? 'league_2v2' : 'league_3v3';
  const mode = teamSize === 2 ? 'league_2v2' : 'league_3v3';

  // Get team IDs in this instance from standings (source of truth for league placement)
  const standingsInInstance = await prisma.standing.findMany({
    where: { mode: mode as any, leagueInstanceId: teamBattleLeagueId },
    select: { entityId: true },
  });
  const teamIdsInInstance = standingsInInstance.map(s => s.entityId);

  if (teamIdsInInstance.length === 0) {
    return [];
  }

  // Get all ELIGIBLE teams by standings-derived IDs with members and robots
  const teams = await prisma.teamBattle.findMany({
    where: {
      id: { in: teamIdsInInstance },
      teamSize,
      eligibility: 'ELIGIBLE',
    },
    include: {
      members: {
        include: {
          robot: true,
        },
      },
    },
  });

  // Filter for scheduling-ready teams (all members have weapons equipped)
  const readyTeams: TeamBattleWithMembers[] = [];
  for (const team of teams) {
    // Skip teams with incomplete rosters (shouldn't happen with ELIGIBLE filter, but defensive)
    if (team.members.length !== teamSize) {
      continue;
    }

    let allReady = true;
    for (const member of team.members) {
      const readiness = checkSchedulingReadiness(member.robot);
      if (!readiness.isReady) {
        allReady = false;
        break;
      }
    }

    if (allReady) {
      readyTeams.push(team);
    }
  }

  // Get already scheduled team IDs via unified schedulingService
  const matchType = teamSize === 2 ? MatchType.league_2v2 : MatchType.league_3v3;
  const alreadyScheduledIds = new Set<number>();
  for (const team of readyTeams) {
    const upcoming = await schedulingService.getUpcomingForTeam(team.id, [matchType]);
    if (upcoming.length > 0) {
      alreadyScheduledIds.add(team.id);
    }
  }

  // Filter out already scheduled teams
  const availableTeams = readyTeams.filter(team => !alreadyScheduledIds.has(team.id));

  // Filter by subscription — ALL members must have active subscription
  const allRobotIds = availableTeams.flatMap(t => t.members.map(m => m.robotId));

  // Activate pending subscriptions for robots that have room under cap
  const { batchActivatePendingSubscriptions } = await import('../subscription/subscriptionService');
  await batchActivatePendingSubscriptions(allRobotIds, eventType);

  // Check active subscriptions for all robots
  const subscribedRobotIds = await prisma.subscription.findMany({
    where: { eventType, robotId: { in: allRobotIds }, status: 'active' },
    select: { robotId: true },
  });
  const subscribedSet = new Set(subscribedRobotIds.map(s => s.robotId));

  const eligibleTeams = availableTeams.filter(team =>
    team.members.every(m => subscribedSet.has(m.robotId))
  );

  const excludedBySubscription = availableTeams.length - eligibleTeams.length;
  if (excludedBySubscription > 0) {
    logger.info(`[TeamBattleMatchmaking] Excluded ${excludedBySubscription} teams without ${eventType} subscription`);
  }

  logger.info(
    `[TeamBattleMatchmaking] ${teamBattleLeagueId}: ${eligibleTeams.length} eligible teams ` +
    `(${teams.length} total, ${readyTeams.length} ready, ${alreadyScheduledIds.size} already scheduled)`
  );

  return eligibleTeams;
}

// ─── Recent Opponents ────────────────────────────────────────────────────────

/**
 * Batch-fetch recent opponents for all teams using unified scheduled_matches_v2.
 * Queries completed league matches only (mode-specific: league_2v2 or league_3v3).
 */
async function getRecentOpponentsBatch(
  teamIds: number[],
  teamSize: 2 | 3,
  limit: number = RECENT_OPPONENT_LIMIT,
): Promise<Map<number, number[]>> {
  const { createRecentOpponentQueryFn } = await import('../matchmaking/teamMatchmakingUtils');
  const matchType = teamSize === 2 ? MatchType.league_2v2 : MatchType.league_3v3;
  const queryFn = createRecentOpponentQueryFn(matchType, 'team');
  return queryFn(teamIds, limit);
}

// ─── ELO Computation ─────────────────────────────────────────────────────────

/**
 * Compute team ELO as sum of member robot ELOs (no persisted field).
 * Requirement R4.2: Team ELO derived from members at matchmaking time.
 */
function computeTeamELO(team: TeamBattleWithMembers): number {
  return team.members.reduce((sum, m) => sum + m.robot.elo, 0);
}

// ─── Match Scoring ───────────────────────────────────────────────────────────

/**
 * Calculate match quality score using the shared LP-primary formula.
 * Maps team battle fields to the MatchScoreInput interface.
 * Uses LP from standings map (source of truth) instead of stale model fields.
 */
function calculateMatchScoreForTeamBattle(
  team1: TeamBattleWithMembers,
  team2: TeamBattleWithMembers,
  team1ELO: number,
  team2ELO: number,
  recentOpponents1: number[],
  recentOpponents2: number[],
  standingsLPMap: Map<number, number>,
): number {
  const input: MatchScoreInput = {
    entity1LP: standingsLPMap.get(team1.id) ?? 0,
    entity2LP: standingsLPMap.get(team2.id) ?? 0,
    entity1ELO: team1ELO,
    entity2ELO: team2ELO,
    recentOpponents1,
    recentOpponents2,
    entity1Id: team1.id,
    entity2Id: team2.id,
    entity1StableId: team1.stableId,
    entity2StableId: team2.stableId,
  };
  return sharedCalculateMatchScore(input);
}

// ─── Pairing ─────────────────────────────────────────────────────────────────

/**
 * Find best opponent for a team from available pool.
 *
 * Implements R4.7: if all opponents are excluded by recent-opponent rule
 * (score includes RECENT_OPPONENT_PENALTY from both directions), pair with
 * closest-ELO from the excluded set rather than leaving the team unmatched.
 *
 * Guarantee: never assign bye when real opponents exist (R4.3).
 */
function findBestOpponent(
  team: TeamBattleWithMembers,
  availableTeams: TeamBattleWithMembers[],
  combinedELOMap: Map<number, number>,
  recentOpponentsMap: Map<number, number[]>,
  standingsLPMap: Map<number, number>,
): TeamBattleWithMembers | null {
  if (availableTeams.length === 0) {
    return null;
  }

  const teamELO = combinedELOMap.get(team.id)!;
  const teamRecentOpponents = recentOpponentsMap.get(team.id) || [];

  // Score all potential opponents
  const scoredOpponents = availableTeams.map(opponent => {
    const opponentELO = combinedELOMap.get(opponent.id)!;
    const opponentRecentOpponents = recentOpponentsMap.get(opponent.id) || [];
    const score = calculateMatchScoreForTeamBattle(
      team,
      opponent,
      teamELO,
      opponentELO,
      teamRecentOpponents,
      opponentRecentOpponents,
      standingsLPMap,
    );
    return { opponent, score };
  });

  // Sort by score (lower is better), tie-break by earliest creation timestamp
  scoredOpponents.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.opponent.createdAt.getTime() - b.opponent.createdAt.getTime();
  });

  // R4.7: If the best match has a recent-opponent penalty from both directions,
  // check if ALL opponents have this penalty. If so, fall back to closest-ELO
  // from the excluded set to ensure the team still gets a match.
  const bestMatch = scoredOpponents[0];

  // Check if best match is a recent opponent (has penalty from at least one direction)
  const bestIsRecentOpponent =
    teamRecentOpponents.includes(bestMatch.opponent.id) ||
    (recentOpponentsMap.get(bestMatch.opponent.id) || []).includes(team.id);

  if (bestIsRecentOpponent) {
    // Check if there's any non-recent opponent available
    const nonRecentOpponent = scoredOpponents.find(so => {
      const oppRecentOpponents = recentOpponentsMap.get(so.opponent.id) || [];
      return !teamRecentOpponents.includes(so.opponent.id) && !oppRecentOpponents.includes(team.id);
    });

    if (nonRecentOpponent) {
      // There's a non-recent opponent — use the normal best score (which might still be the non-recent one)
      return bestMatch.opponent;
    }

    // R4.7: ALL opponents are recent — fall back to closest ELO from excluded set
    const closestELO = [...scoredOpponents].sort((a, b) => {
      const eloDiffA = Math.abs(combinedELOMap.get(a.opponent.id)! - teamELO);
      const eloDiffB = Math.abs(combinedELOMap.get(b.opponent.id)! - teamELO);
      if (eloDiffA !== eloDiffB) return eloDiffA - eloDiffB;
      return a.opponent.createdAt.getTime() - b.opponent.createdAt.getTime();
    });

    logger.info(
      `[TeamBattleMatchmaking] R4.7: All opponents for team ${team.id} are recent — ` +
      `pairing with closest-ELO opponent ${closestELO[0].opponent.id}`
    );
    return closestELO[0].opponent;
  }

  return bestMatch.opponent;
}

/**
 * Pair teams for matches within a league instance.
 *
 * Uses greedy algorithm: pick first team, find best opponent, remove both, repeat.
 * Guarantee: never assign bye when real opponents exist (R4.3).
 * Handle odd count: pair last team against bye team via createByeTeam.
 *
 * Requirements: R4.1–R4.7
 */
export async function pairTeams(
  teams: TeamBattleWithMembers[],
  teamSize: 2 | 3,
  teamBattleLeague: string,
  teamBattleLeagueId: string,
): Promise<TeamBattleMatchPair[]> {
  if (teams.length === 0) {
    return [];
  }

  const matches: TeamBattleMatchPair[] = [];
  const availableTeams = [...teams];

  // Pre-calculate combined ELO for all teams from in-memory data
  const combinedELOMap = new Map<number, number>();
  for (const team of teams) {
    combinedELOMap.set(team.id, computeTeamELO(team));
  }

  // Batch-fetch recent opponents for all teams in a single query
  const recentOpponentsMap = await getRecentOpponentsBatch(teams.map(t => t.id), teamSize);

  // Build LP lookup map from standings (source of truth)
  const mode = teamSize === 2 ? 'league_2v2' : 'league_3v3';
  const standingsLPMap = new Map(
    (await prisma.standing.findMany({
      where: { mode: mode as any, entityId: { in: teams.map(t => t.id) } },
      select: { entityId: true, leaguePoints: true },
    })).map(s => [s.entityId, s.leaguePoints])
  );

  // Pair teams using greedy algorithm
  while (availableTeams.length > 1) {
    const team1 = availableTeams.shift()!;
    const opponent = findBestOpponent(team1, availableTeams, combinedELOMap, recentOpponentsMap, standingsLPMap);

    if (opponent) {
      // Remove opponent from available pool
      const opponentIndex = availableTeams.indexOf(opponent);
      availableTeams.splice(opponentIndex, 1);

      // Create match pair — use league/instance from function context (standings-derived)
      matches.push({
        team1,
        team2: opponent,
        isByeMatch: false,
        teamBattleLeague,
        teamBattleLeagueId,
      });
    } else {
      // No suitable opponent found, put team back for bye-match
      availableTeams.push(team1);
      break;
    }
  }

  // Handle odd team with bye-match — only when no real opponents exist
  if (availableTeams.length === 1) {
    const lastTeam = availableTeams[0];
    const byeTeam = createByeTeam(teamBattleLeague, teamBattleLeagueId, teamSize);

    matches.push({
      team1: lastTeam,
      team2: byeTeam,
      isByeMatch: true,
      teamBattleLeague,
      teamBattleLeagueId,
    });

    logger.info(`[TeamBattleMatchmaking] Bye-match created for team ${lastTeam.id}`);
  }

  return matches;
}

// ─── Bye Team Factory ────────────────────────────────────────────────────────

/**
 * Create a bye-team for odd number of teams using the shared factory.
 * Bye robots have ELO 1000 each (combined = N × 1000).
 */
function createByeTeam(league: string, leagueId: string, teamSize: 2 | 3): TeamBattleWithMembers {
  return sharedCreateByeTeam(
    (byeLeague: string, byeLeagueId: string): TeamBattleWithMembers => {
      const byeRobotBase: Robot = {
        id: -1,
        userId: -1,
        name: 'Bye Robot 1',
        frameId: 1,
        paintJob: null,
        imageUrl: null,
        // Combat Systems
        combatPower: new Prisma.Decimal(10),
        targetingSystems: new Prisma.Decimal(10),
        criticalSystems: new Prisma.Decimal(10),
        penetration: new Prisma.Decimal(10),
        weaponControl: new Prisma.Decimal(10),
        attackSpeed: new Prisma.Decimal(10),
        // Defensive Systems
        armorPlating: new Prisma.Decimal(10),
        shieldCapacity: new Prisma.Decimal(10),
        evasionThrusters: new Prisma.Decimal(10),
        damageDampeners: new Prisma.Decimal(10),
        counterProtocols: new Prisma.Decimal(10),
        // Chassis & Mobility
        hullIntegrity: new Prisma.Decimal(10),
        servoMotors: new Prisma.Decimal(10),
        gyroStabilizers: new Prisma.Decimal(10),
        hydraulicSystems: new Prisma.Decimal(10),
        powerCore: new Prisma.Decimal(10),
        // AI Processing
        combatAlgorithms: new Prisma.Decimal(10),
        threatAnalysis: new Prisma.Decimal(10),
        adaptiveAI: new Prisma.Decimal(10),
        logicCores: new Prisma.Decimal(10),
        // Team Coordination
        syncProtocols: new Prisma.Decimal(10),
        supportSystems: new Prisma.Decimal(10),
        formationTactics: new Prisma.Decimal(10),
        // Combat State
        currentHP: 100,
        maxHP: 100,
        currentShield: 20,
        maxShield: 20,
        damageTaken: 0,
        // Performance
        elo: 1000,
        totalBattles: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        damageDealtLifetime: 0,
        damageTakenLifetime: 0,
        kills: 0,
        // Fame
        fame: 0,
        titles: null,
        // Economic
        repairCost: 0,
        battleReadiness: 100,
        totalRepairsPaid: 0,
        // Configuration
        yieldThreshold: 10,
        loadoutType: 'single',
        stance: 'balanced',
        // Stance/Loadout Win Counters
        offensiveWins: 0,
        defensiveWins: 0,
        balancedWins: 0,
        dualWieldWins: 0,
        // Equipment
        mainWeaponId: null,
        offhandWeaponId: null,
        // Timestamps
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Create N bye robots
      const members: (TeamBattleMember & { robot: Robot })[] = [];
      for (let i = 0; i < teamSize; i++) {
        members.push({
          id: -(i + 1),
          teamId: -1,
          robotId: -(i + 1),
          slotIndex: i,
          robot: { ...byeRobotBase, id: -(i + 1), name: `Bye Robot ${i + 1}` },
        });
      }

      return {
        id: -1,
        stableId: -1,
        teamSize,
        teamName: 'Bye Team',
        eligibility: 'ELIGIBLE',
        createdAt: new Date(),
        updatedAt: new Date(),
        members,
      };
    },
    league,
    leagueId,
  );
}

// ─── Match Scheduling ────────────────────────────────────────────────────────

/**
 * Schedule matches using the unified SchedulingService.
 * Creates ScheduledMatch records with team participants.
 */
export async function scheduleMatches(
  matches: TeamBattleMatchPair[],
  scheduledFor: Date,
  teamSize: 2 | 3,
): Promise<void> {
  const matchType = teamSize === 2 ? MatchType.league_2v2 : MatchType.league_3v3;

  for (const match of matches) {
    const participants = [
      { participantType: 'team' as const, participantId: match.team1.id, slot: 1 },
    ];
    if (!match.isByeMatch && match.team2) {
      participants.push({ participantType: 'team' as const, participantId: match.team2.id, slot: 2 });
    }

    await schedulingService.createMatch({
      matchType,
      scheduledFor,
      leagueType: match.teamBattleLeague,
      leagueInstanceId: match.teamBattleLeagueId,
      isByeMatch: match.isByeMatch,
      participants,
    });
  }

  logger.info(`[TeamBattleMatchmaking] Scheduled ${matches.length} ${teamSize}v${teamSize} matches`);
}

// ─── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Run team battle matchmaking for all league tiers.
 *
 * Iterates tiers → instances → eligible teams, pairs using calculateMatchScore,
 * and persists ScheduledTeamBattleMatch records.
 *
 * Error handling per-team: log and skip, continue with remaining teams (R4.6).
 *
 * @param teamSize - 2 for 2v2 League, 3 for 3v3 League
 * @param scheduledFor - When the matches should be executed (default: 24h from now)
 * @returns Total number of matches created
 *
 * Requirements: R3.3, R3.4, R4.1–R4.7
 */
export async function runTeamBattleMatchmaking(teamSize: 2 | 3, scheduledFor?: Date): Promise<number> {
  const matchTime = scheduledFor ?? defaultScheduledFor();
  const label = `${teamSize}v${teamSize}`;

  let totalMatches = 0;

  logger.info(`[TeamBattleMatchmaking] Starting ${label} matchmaking for all tiers...`);

  for (const tier of TEAM_BATTLE_LEAGUE_TIERS) {
    try {
      // Get all league instances for this tier from standings (source of truth)
      const mode = teamSize === 2 ? 'league_2v2' : 'league_3v3';
      const instances = await prisma.standing.findMany({
        where: { mode: mode as any, tier },
        select: { leagueInstanceId: true },
        distinct: ['leagueInstanceId'],
      });

      const instanceIds = instances.map(i => i.leagueInstanceId);

      for (const instanceId of instanceIds) {
        try {
          // Get eligible teams for this instance
          const eligibleTeams = await getEligibleTeams(tier, instanceId, teamSize);

          if (eligibleTeams.length < 1) {
            logger.info(`[TeamBattleMatchmaking] ${instanceId}: No eligible teams, skipping`);
            continue;
          }

          // Pair teams — pass tier and instanceId from context
          const matches = await pairTeams(eligibleTeams, teamSize, tier, instanceId);

          if (matches.length > 0) {
            // Schedule matches
            await scheduleMatches(matches, matchTime, teamSize);
            totalMatches += matches.length;

            logger.info(`[TeamBattleMatchmaking] ${instanceId}: Created ${matches.length} matches`);
          }
        } catch (instanceError) {
          // R4.6: Handle errors per-instance — log and skip, continue with remaining
          logger.error(`[TeamBattleMatchmaking] Error in instance ${instanceId}:`, instanceError);
        }
      }
    } catch (tierError) {
      // R4.6: Handle errors per-tier — log and skip, continue with remaining tiers
      logger.error(`[TeamBattleMatchmaking] Error in ${tier} tier:`, tierError);
    }
  }

  logger.info(`[TeamBattleMatchmaking] Complete: ${totalMatches} total ${label} matches created`);
  return totalMatches;
}
