/**
 * Tag Team Matchmaking Service
 *
 * Handles matchmaking for Tag Team mode (2v2 sequential combat).
 * Queries TeamBattle (teamSize=2) with tag team league fields,
 * pairs using the shared LP-primary scoring formula, and persists
 * ScheduledTeamBattleMatch records with matchMode = 'tag_team'.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 6.2, 6.4, 7.3, 7.4, 15.6
 *
 * @module services/tag-team/tagTeamMatchmakingService
 */

import { Robot, Prisma, TeamBattle, TeamBattleMember, MatchType } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import schedulingService from '../scheduling/schedulingService';
import { checkSchedulingReadiness } from '../analytics/matchmakingService';
import { TEAM_BATTLE_LEAGUE_TIERS as TAG_TEAM_LEAGUE_TIERS } from '../team-battle/teamBattleAdapter';
import {
  calculateMatchScore as sharedCalculateMatchScore,
  createByeTeam as sharedCreateByeTeam,
  getRecentOpponentsBatch as sharedGetRecentOpponentsBatch,
  MatchScoreInput,
  RECENT_OPPONENT_LIMIT,
  defaultScheduledFor,
} from '../matchmaking/teamMatchmakingUtils';

// ─── Types ───────────────────────────────────────────────────────────────────

/** TeamBattle with members and their robots loaded (reused from teamBattleMatchmakingService pattern). */
export interface TeamBattleWithMembers extends TeamBattle {
  members: (TeamBattleMember & { robot: Robot })[];
}

export interface TagTeamMatchPair {
  team1: TeamBattleWithMembers;
  team2: TeamBattleWithMembers;
  isByeMatch: boolean;
  tagTeamLeague: string;
  tagTeamLeagueId: string;
}

// ─── Eligibility ─────────────────────────────────────────────────────────────

/**
 * Get eligible teams for tag team matchmaking within a specific league instance.
 *
 * Eligibility criteria:
 * - Team has teamSize = 2 and matches the target tagTeamLeague + tagTeamLeagueId
 * - Team has exactly 2 members (slot 0 = Active, slot 1 = Reserve)
 * - All members pass scheduling readiness (weapon check)
 * - Both members have active `tag_team` subscriptions
 * - Team not already scheduled for a pending tag_team match
 *
 * Requirements: 3.1, 3.2, 3.6, 6.2
 */
export async function getEligibleTeams(
  tagTeamLeague: string,
  tagTeamLeagueId: string
): Promise<TeamBattleWithMembers[]> {
  // Get team IDs in this instance from standings (source of truth for league placement)
  const standingsInInstance = await prisma.standing.findMany({
    where: { mode: 'tag_team' as any, leagueInstanceId: tagTeamLeagueId },
    select: { entityId: true },
  });
  const teamIdsInInstance = standingsInInstance.map(s => s.entityId);

  if (teamIdsInInstance.length === 0) {
    return [];
  }

  // Get all teams by standings-derived IDs with members and robots
  const teams = await prisma.teamBattle.findMany({
    where: {
      id: { in: teamIdsInInstance },
      teamSize: 2,
    },
    include: {
      members: {
        include: {
          robot: true,
        },
      },
    },
  });

  // Requirement 3.6: Exclude teams with fewer than 2 members
  const fullTeams = teams.filter(team => team.members.length === 2);

  // Filter for scheduling-ready teams (all members have weapons equipped)
  const readyTeams: TeamBattleWithMembers[] = [];
  for (const team of fullTeams) {
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

  // Requirement 3.4: Check already-scheduled teams via unified schedulingService
  const alreadyScheduledIds = await schedulingService.getAlreadyScheduledIds(
    'team',
    readyTeams.map(t => t.id),
    [MatchType.tag_team],
  );

  // Filter out already scheduled teams
  const availableTeams = readyTeams.filter(team => !alreadyScheduledIds.has(team.id));

  // Requirement 3.2 / 6.2: Filter by tag_team subscription — BOTH members must be subscribed
  const allRobotIds = availableTeams.flatMap(t => t.members.map(m => m.robotId));

  // Activate pending subscriptions for robots that have room under cap
  const { batchActivatePendingSubscriptions } = await import('../subscription/subscriptionService');
  await batchActivatePendingSubscriptions(allRobotIds, 'tag_team');

  // Check active subscriptions for all robots
  const subscribedRobotIds = await prisma.subscription.findMany({
    where: { eventType: 'tag_team', robotId: { in: allRobotIds }, status: 'active' },
    select: { robotId: true },
  });
  const subscribedSet = new Set(subscribedRobotIds.map(s => s.robotId));

  const eligibleTeams = availableTeams.filter(team =>
    team.members.every(m => subscribedSet.has(m.robotId))
  );

  const excludedBySubscription = availableTeams.length - eligibleTeams.length;
  if (excludedBySubscription > 0) {
    logger.info(`[TagTeamMatchmaking] Excluded ${excludedBySubscription} teams without tag_team subscription`);
  }

  logger.info(
    `[TagTeamMatchmaking] ${tagTeamLeagueId}: ${eligibleTeams.length} eligible teams ` +
    `(${teams.length} total, ${readyTeams.length} ready, ${alreadyScheduledIds.size} already scheduled)`
  );

  return eligibleTeams;
}

// ─── Recent Opponents ────────────────────────────────────────────────────────

/**
 * Batch-fetch recent opponents for all teams using unified scheduled_matches_v2.
 * Queries completed tag_team matches only (mode-specific).
 */
async function getRecentOpponentsBatch(
  teamIds: number[],
  limit: number = RECENT_OPPONENT_LIMIT
): Promise<Map<number, number[]>> {
  const { createRecentOpponentQueryFn } = await import('../matchmaking/teamMatchmakingUtils');
  const queryFn = createRecentOpponentQueryFn(MatchType.tag_team, 'team');
  return queryFn(teamIds, limit);
}

// ─── ELO Computation ─────────────────────────────────────────────────────────

/**
 * Calculate combined ELO from in-memory team data (no DB query needed).
 * Sum of member robot ELOs (slot 0 + slot 1).
 */
function calculateCombinedELOFromTeam(team: TeamBattleWithMembers): number {
  return team.members.reduce((sum, m) => sum + m.robot.elo, 0);
}

// ─── Match Scoring ───────────────────────────────────────────────────────────

/**
 * Calculate match quality score using the shared LP-primary formula.
 * Maps tag team fields to the MatchScoreInput interface:
 *   - LP = from standings map (source of truth)
 *   - ELO = combined robot ELO (sum of member ELOs)
 *
 * Requirements 3.3, 15.6: LP matching (primary), ELO (secondary), recent opponent deprioritization, same-stable exclusion
 */
function calculateMatchScoreForTagTeam(
  team1: TeamBattleWithMembers,
  team2: TeamBattleWithMembers,
  team1CombinedELO: number,
  team2CombinedELO: number,
  recentOpponents1: number[],
  recentOpponents2: number[],
  standingsLPMap: Map<number, number>
): number {
  const input: MatchScoreInput = {
    entity1LP: standingsLPMap.get(team1.id) ?? 0,
    entity2LP: standingsLPMap.get(team2.id) ?? 0,
    entity1ELO: team1CombinedELO,
    entity2ELO: team2CombinedELO,
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
 * Find best opponent for a team from available pool
 */
async function findBestOpponent(
  team: TeamBattleWithMembers,
  availableTeams: TeamBattleWithMembers[],
  combinedELOMap: Map<number, number>,
  recentOpponentsMap: Map<number, number[]>,
  standingsLPMap: Map<number, number>
): Promise<TeamBattleWithMembers | null> {
  if (availableTeams.length === 0) {
    return null;
  }

  const teamCombinedELO = combinedELOMap.get(team.id)!;
  const teamRecentOpponents = recentOpponentsMap.get(team.id) || [];

  // Score all potential opponents
  const scoredOpponents = availableTeams.map(opponent => {
    const opponentCombinedELO = combinedELOMap.get(opponent.id)!;
    const opponentRecentOpponents = recentOpponentsMap.get(opponent.id) || [];
    const score = calculateMatchScoreForTagTeam(
      team,
      opponent,
      teamCombinedELO,
      opponentCombinedELO,
      teamRecentOpponents,
      opponentRecentOpponents,
      standingsLPMap
    );
    return { opponent, score };
  });

  // Sort by score (lower is better), tie-break by createdAt (deterministic)
  scoredOpponents.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.opponent.createdAt.getTime() - b.opponent.createdAt.getTime();
  });

  // R4.7: If the best match is a recent opponent, check if ANY non-recent exists
  const bestMatch = scoredOpponents[0];
  const bestIsRecentOpponent =
    teamRecentOpponents.includes(bestMatch.opponent.id) ||
    (recentOpponentsMap.get(bestMatch.opponent.id) || []).includes(team.id);

  if (bestIsRecentOpponent) {
    const nonRecentOpponent = scoredOpponents.find(so => {
      const oppRecent = recentOpponentsMap.get(so.opponent.id) || [];
      return !teamRecentOpponents.includes(so.opponent.id) && !oppRecent.includes(team.id);
    });

    if (nonRecentOpponent) {
      return bestMatch.opponent;
    }

    // R4.7 fallback: ALL opponents are recent — select closest-ELO
    const closestELO = [...scoredOpponents].sort((a, b) => {
      const eloDiffA = Math.abs(combinedELOMap.get(a.opponent.id)! - teamCombinedELO);
      const eloDiffB = Math.abs(combinedELOMap.get(b.opponent.id)! - teamCombinedELO);
      if (eloDiffA !== eloDiffB) return eloDiffA - eloDiffB;
      return a.opponent.createdAt.getTime() - b.opponent.createdAt.getTime();
    });
    return closestELO[0].opponent;
  }

  return bestMatch.opponent;
}

/**
 * Create a bye-team for odd number of teams using the shared factory.
 * Bye robots have ELO 1000 each (combined 2000).
 */
function createByeTeam(league: string, leagueId: string): TeamBattleWithMembers {
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
        // Grand Melee
        grandMeleeWins: 0,
        grandMeleeTop3: 0,
        // Equipment
        mainWeaponId: null,
        offhandWeaponId: null,
        // Timestamps
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Create 2 bye robots for tag team (slot 0 = active, slot 1 = reserve)
      const members: (TeamBattleMember & { robot: Robot })[] = [
        {
          id: -1,
          teamId: -1,
          robotId: -1,
          slotIndex: 0,
          robot: { ...byeRobotBase, id: -1, name: 'Bye Robot 1' },
        },
        {
          id: -2,
          teamId: -1,
          robotId: -2,
          slotIndex: 1,
          robot: { ...byeRobotBase, id: -2, name: 'Bye Robot 2' },
        },
      ];

      return {
        id: -1,
        stableId: -1,
        teamSize: 2,
        teamName: 'Bye Team',
        eligibility: 'ELIGIBLE',
        createdAt: new Date(),
        updatedAt: new Date(),
        members,
      };
    },
    league,
    leagueId
  );
}

/**
 * Pair teams for matches within a league instance
 * Requirements 3.3, 15.6: LP matching, ELO matching, recent opponents, bye-team, same-stable exclusion
 */
export async function pairTeams(teams: TeamBattleWithMembers[], tagTeamLeague: string, tagTeamLeagueId: string): Promise<TagTeamMatchPair[]> {
  if (teams.length === 0) {
    return [];
  }

  const matches: TagTeamMatchPair[] = [];
  const availableTeams = [...teams]; // Copy array

  // Pre-calculate combined ELO for all teams from in-memory data (no DB queries)
  const combinedELOMap = new Map<number, number>();
  for (const team of teams) {
    combinedELOMap.set(team.id, calculateCombinedELOFromTeam(team));
  }

  // Batch-fetch recent opponents for all teams in a single query
  const recentOpponentsMap = await getRecentOpponentsBatch(teams.map(t => t.id));

  // Build LP lookup map from standings (source of truth)
  const standingsLPMap = new Map(
    (await prisma.standing.findMany({
      where: { mode: 'tag_team' as any, entityId: { in: teams.map(t => t.id) } },
      select: { entityId: true, leaguePoints: true },
    })).map(s => [s.entityId, s.leaguePoints])
  );

  // Pair teams using greedy algorithm
  while (availableTeams.length > 1) {
    const team1 = availableTeams.shift()!;
    const opponent = await findBestOpponent(team1, availableTeams, combinedELOMap, recentOpponentsMap, standingsLPMap);

    if (opponent) {
      // Remove opponent from available pool
      const opponentIndex = availableTeams.indexOf(opponent);
      availableTeams.splice(opponentIndex, 1);

      // Create match pair — use league from context (standings-derived)
      matches.push({
        team1,
        team2: opponent,
        isByeMatch: false,
        tagTeamLeague,
        tagTeamLeagueId,
      });
    } else {
      // No suitable opponent found, put team back for bye-match
      availableTeams.push(team1);
      break;
    }
  }

  // Handle odd team with bye-match
  if (availableTeams.length === 1) {
    const lastTeam = availableTeams[0];
    const byeTeam = createByeTeam(tagTeamLeague, tagTeamLeagueId);

    matches.push({
      team1: lastTeam,
      team2: byeTeam,
      isByeMatch: true,
      tagTeamLeague,
      tagTeamLeagueId,
    });

    logger.info(`[TagTeamMatchmaking] Bye-match created for team ${lastTeam.id}`);
  }

  return matches;
}

// ─── Match Scheduling ────────────────────────────────────────────────────────

/**
 * Schedule matches using the unified SchedulingService.
 * Requirement 7.3: Create scheduled matches with matchType = 'tag_team'
 */
export async function scheduleMatches(matches: TagTeamMatchPair[], scheduledFor: Date): Promise<void> {
  for (const match of matches) {
    const participants = [
      { participantType: 'team' as const, participantId: match.team1.id, slot: 1 },
    ];
    if (!match.isByeMatch && match.team2) {
      participants.push({ participantType: 'team' as const, participantId: match.team2.id, slot: 2 });
    }

    await schedulingService.createMatch({
      matchType: MatchType.tag_team,
      scheduledFor,
      leagueType: match.tagTeamLeague,
      leagueInstanceId: match.tagTeamLeagueId,
      isByeMatch: match.isByeMatch,
      participants,
    });
  }

  logger.info(`[TagTeamMatchmaking] Scheduled ${matches.length} tag team matches via SchedulingService`);
}

// ─── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Run tag team matchmaking for all league tiers.
 *
 * Iterates tiers → instances (from standings where mode='tag_team')
 * → eligible teams, pairs using calculateMatchScore, and persists
 * ScheduledTeamBattleMatch records with matchMode = 'tag_team'.
 *
 * Requirement 3.5: Advisory lock namespace 1 for tag team matchmaking operations.
 *
 * @param scheduledFor - When the matches should be executed
 * @returns Total number of matches created
 */
export async function runTagTeamMatchmaking(scheduledFor?: Date): Promise<number> {
  const matchTime = scheduledFor ?? defaultScheduledFor();

  let totalMatches = 0;

  logger.info('[TagTeamMatchmaking] Starting tag team matchmaking for all tiers...');

  for (const tier of TAG_TEAM_LEAGUE_TIERS) {
    try {
      // Get all tag team league instances for this tier from standings (source of truth)
      const instances = await prisma.standing.findMany({
        where: { mode: 'tag_team' as any, tier },
        select: { leagueInstanceId: true },
        distinct: ['leagueInstanceId'],
      });

      const instanceIds = instances.map(i => i.leagueInstanceId);

      for (const instanceId of instanceIds) {
        // Get eligible teams for this instance
        const eligibleTeams = await getEligibleTeams(tier, instanceId);

        if (eligibleTeams.length < 1) {
          logger.info(`[TagTeamMatchmaking] ${instanceId}: No eligible teams, skipping`);
          continue;
        }

        // Pair teams — pass tier and instanceId from context
        const matches = await pairTeams(eligibleTeams, tier, instanceId);

        if (matches.length > 0) {
          // Schedule matches
          await scheduleMatches(matches, matchTime);
          totalMatches += matches.length;

          logger.info(`[TagTeamMatchmaking] ${instanceId}: Created ${matches.length} matches`);
        }
      }
    } catch (error) {
      logger.error(`[TagTeamMatchmaking] Error in ${tier} tier:`, error);
    }
  }

  logger.info(`[TagTeamMatchmaking] Complete: ${totalMatches} total matches created`);
  return totalMatches;
}
