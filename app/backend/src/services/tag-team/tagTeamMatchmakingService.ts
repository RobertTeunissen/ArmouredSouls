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

import { Robot, Prisma, TeamBattle, TeamBattleMember } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import { checkSchedulingReadiness } from '../analytics/matchmakingService';
import { TEAM_BATTLE_LEAGUE_TIERS as TAG_TEAM_LEAGUE_TIERS } from '../team-battle/teamBattleAdapter';
import {
  calculateMatchScore as sharedCalculateMatchScore,
  createByeTeam as sharedCreateByeTeam,
  getRecentOpponentsBatch as sharedGetRecentOpponentsBatch,
  MatchScoreInput,
  RECENT_OPPONENT_LIMIT,
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
  // Get all teams in this tag team league instance with members and robots
  const teams = await prisma.teamBattle.findMany({
    where: {
      teamSize: 2,
      tagTeamLeague,
      tagTeamLeagueId,
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

  // Requirement 3.4: Check already-scheduled teams via ScheduledTeamBattleMatch where matchMode = 'tag_team'
  const readyTeamIds = readyTeams.map(t => t.id);
  const scheduledMatches = await prisma.scheduledTeamBattleMatch.findMany({
    where: {
      status: 'scheduled',
      matchMode: 'tag_team',
      OR: [
        { team1Id: { in: readyTeamIds } },
        { team2Id: { in: readyTeamIds } },
      ],
    },
    select: {
      team1Id: true,
      team2Id: true,
    },
  });

  const alreadyScheduledIds = new Set<number>();
  scheduledMatches.forEach(match => {
    alreadyScheduledIds.add(match.team1Id);
    if (match.team2Id !== null) {
      alreadyScheduledIds.add(match.team2Id);
    }
  });

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
 * Batch-fetch recent opponents for all teams using the shared utility.
 * Queries ScheduledTeamBattleMatch where matchMode = 'tag_team' for tag team opponents.
 */
async function getRecentOpponentsBatch(
  teamIds: number[],
  limit: number = RECENT_OPPONENT_LIMIT
): Promise<Map<number, number[]>> {
  return sharedGetRecentOpponentsBatch(
    teamIds,
    async (ids: number[], queryLimit: number): Promise<Map<number, number[]>> => {
      if (ids.length === 0) return new Map();

      // Single query to get recent completed tag_team matches for all teams
      const recentMatches = await prisma.scheduledTeamBattleMatch.findMany({
        where: {
          status: 'completed',
          matchMode: 'tag_team',
          OR: [
            { team1Id: { in: ids } },
            { team2Id: { in: ids } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        // Fetch enough matches to cover all teams (worst case: each team has `limit` unique matches)
        take: ids.length * queryLimit,
        select: {
          team1Id: true,
          team2Id: true,
        },
      });

      // Build per-team opponent lists from the batch result
      const map = new Map<number, number[]>();
      for (const teamId of ids) {
        const opponents: number[] = [];
        for (const match of recentMatches) {
          if (opponents.length >= queryLimit) break;
          if (match.team1Id === teamId && match.team2Id !== null) {
            opponents.push(match.team2Id);
          } else if (match.team2Id === teamId) {
            opponents.push(match.team1Id);
          }
        }
        map.set(teamId, opponents);
      }

      return map;
    },
    limit
  );
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
 *   - LP = tagTeamLp (tag team league points)
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
  recentOpponents2: number[]
): number {
  const input: MatchScoreInput = {
    entity1LP: team1.tagTeamLp,
    entity2LP: team2.tagTeamLp,
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
  recentOpponentsMap: Map<number, number[]>
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
      opponentRecentOpponents
    );
    return { opponent, score };
  });

  // Sort by score (lower is better) and return best match
  scoredOpponents.sort((a, b) => a.score - b.score);
  return scoredOpponents[0].opponent;
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
        // League & Fame
        currentLeague: 'bronze',
        leagueId: 'bronze_1',
        leaguePoints: 0,
        cyclesInCurrentLeague: 0,
        fame: 0,
        titles: null,
        // Tag Team Statistics
        totalTagTeamBattles: 0,
        totalTagTeamWins: 0,
        totalTagTeamLosses: 0,
        totalTagTeamDraws: 0,
        timesTaggedIn: 0,
        timesTaggedOut: 0,
        // Team Battle Statistics
        totalLeague1v1Wins: 0,
        totalLeague1v1Losses: 0,
        totalLeague1v1Draws: 0,
        totalLeague2v2Wins: 0,
        totalLeague3v3Wins: 0,
        // Economic
        repairCost: 0,
        battleReadiness: 100,
        totalRepairsPaid: 0,
        // Configuration
        yieldThreshold: 10,
        loadoutType: 'single',
        stance: 'balanced',
        // KotH Statistics
        kothWins: 0,
        kothMatches: 0,
        kothTotalZoneScore: 0,
        kothTotalZoneTime: 0,
        kothKills: 0,
        kothBestPlacement: null,
        kothCurrentWinStreak: 0,
        kothBestWinStreak: 0,
        // League Win/Lose Streak
        currentWinStreak: 0,
        bestWinStreak: 0,
        currentLoseStreak: 0,
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
        teamLp: 0,
        teamLeague: byeLeague,
        teamLeagueId: byeLeagueId,
        cyclesInLeague: 0,
        totalLeagueWins: 0,
        totalLeagueLosses: 0,
        totalLeagueDraws: 0,
        tagTeamLp: 0,
        tagTeamLeague: byeLeague,
        tagTeamLeagueId: byeLeagueId,
        cyclesInTagTeamLeague: 0,
        totalTagTeamWins: 0,
        totalTagTeamLosses: 0,
        totalTagTeamDraws: 0,
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
export async function pairTeams(teams: TeamBattleWithMembers[]): Promise<TagTeamMatchPair[]> {
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

  // Pair teams using greedy algorithm
  while (availableTeams.length > 1) {
    const team1 = availableTeams.shift()!;
    const opponent = await findBestOpponent(team1, availableTeams, combinedELOMap, recentOpponentsMap);

    if (opponent) {
      // Remove opponent from available pool
      const opponentIndex = availableTeams.indexOf(opponent);
      availableTeams.splice(opponentIndex, 1);

      // Create match pair
      matches.push({
        team1,
        team2: opponent,
        isByeMatch: false,
        tagTeamLeague: team1.tagTeamLeague,
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
    const byeTeam = createByeTeam(lastTeam.tagTeamLeague, lastTeam.tagTeamLeagueId);

    matches.push({
      team1: lastTeam,
      team2: byeTeam,
      isByeMatch: true,
      tagTeamLeague: lastTeam.tagTeamLeague,
    });

    logger.info(`[TagTeamMatchmaking] Bye-match created for team ${lastTeam.id}`);
  }

  return matches;
}

// ─── Match Scheduling ────────────────────────────────────────────────────────

/**
 * Schedule matches in the database.
 * Requirement 7.3: Create ScheduledTeamBattleMatch records with matchMode = 'tag_team', teamSize = 2
 */
export async function scheduleMatches(matches: TagTeamMatchPair[], scheduledFor: Date): Promise<void> {
  // Separate bye-matches from regular matches
  const regularMatches = matches.filter(m => !m.isByeMatch);
  const byeMatches = matches.filter(m => m.isByeMatch);

  // Create regular matches using createMany
  if (regularMatches.length > 0) {
    const regularMatchData = regularMatches.map(match => ({
      team1Id: match.team1.id,
      team2Id: match.team2.id,
      teamSize: 2,
      matchMode: 'tag_team',
      teamBattleLeague: match.tagTeamLeague,
      teamBattleLeagueId: match.team1.tagTeamLeagueId,
      scheduledFor,
      status: 'scheduled' as const,
    }));

    await prisma.scheduledTeamBattleMatch.createMany({
      data: regularMatchData,
    });
  }

  // Create bye-matches individually (team2Id = null for bye-team)
  for (const match of byeMatches) {
    await prisma.scheduledTeamBattleMatch.create({
      data: {
        team1Id: match.team1.id,
        team2Id: null, // Bye-team (no actual team2)
        teamSize: 2,
        matchMode: 'tag_team',
        teamBattleLeague: match.tagTeamLeague,
        teamBattleLeagueId: match.team1.tagTeamLeagueId,
        scheduledFor,
        status: 'scheduled',
      },
    });
  }

  logger.info(`[TagTeamMatchmaking] Scheduled ${matches.length} tag team matches`);
}

// ─── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Run tag team matchmaking for all league tiers.
 *
 * Iterates tiers → instances (by distinct tagTeamLeagueId on TeamBattle where teamSize=2)
 * → eligible teams, pairs using calculateMatchScore, and persists
 * ScheduledTeamBattleMatch records with matchMode = 'tag_team'.
 *
 * Requirement 3.5: Advisory lock namespace 1 for tag team matchmaking operations.
 *
 * @param scheduledFor - When the matches should be executed
 * @returns Total number of matches created
 */
export async function runTagTeamMatchmaking(scheduledFor?: Date): Promise<number> {
  const matchTime = scheduledFor || new Date(Date.now() + 24 * 60 * 60 * 1000); // Default: 24 hours from now

  let totalMatches = 0;

  logger.info('[TagTeamMatchmaking] Starting tag team matchmaking for all tiers...');

  for (const tier of TAG_TEAM_LEAGUE_TIERS) {
    try {
      // Get all tag team league instances for this tier from TeamBattle (teamSize=2)
      const instances = await prisma.teamBattle.findMany({
        where: { teamSize: 2, tagTeamLeague: tier },
        select: { tagTeamLeagueId: true },
        distinct: ['tagTeamLeagueId'],
      });

      const instanceIds = instances.map(i => i.tagTeamLeagueId);

      for (const instanceId of instanceIds) {
        // Get eligible teams for this instance
        const eligibleTeams = await getEligibleTeams(tier, instanceId);

        if (eligibleTeams.length < 1) {
          logger.info(`[TagTeamMatchmaking] ${instanceId}: No eligible teams, skipping`);
          continue;
        }

        // Pair teams
        const matches = await pairTeams(eligibleTeams);

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
