/**
 * Team Tournament Service - Property-Based Tests
 * Feature: team-battle-tournaments
 *
 * Tests the correctness properties of team tournament eligibility, creation threshold,
 * and locking predicates using fast-check for property-based testing.
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockTeamBattleFindMany = jest.fn();
const mockSubscriptionFindMany = jest.fn();
const mockTournamentFindFirst = jest.fn();
const mockTournamentCount = jest.fn();
const mockTeamBattleMemberFindMany = jest.fn();
const mockScheduledTournamentMatchCount = jest.fn();

jest.mock('../../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    teamBattle: { findMany: (...args: unknown[]) => mockTeamBattleFindMany(...args) },
    subscription: { findMany: (...args: unknown[]) => mockSubscriptionFindMany(...args) },
    tournament: { findFirst: (...args: unknown[]) => mockTournamentFindFirst(...args), count: (...args: unknown[]) => mockTournamentCount(...args) },
    teamBattleMember: { findMany: (...args: unknown[]) => mockTeamBattleMemberFindMany(...args) },
    scheduledTournamentMatch: { count: (...args: unknown[]) => mockScheduledTournamentMatchCount(...args) },
  },
}));

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../src/services/analytics/matchmakingService', () => ({
  __esModule: true,
  checkSchedulingReadiness: jest.fn(),
}));

jest.mock('../../../src/services/subscription/subscriptionService', () => ({
  __esModule: true,
  batchActivatePendingSubscriptions: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../src/services/tournament/tournamentService', () => ({
  __esModule: true,
  createTournament: jest.fn().mockResolvedValue({
    tournament: { id: 1, name: '2v2 Tournament #1', status: 'active', participantType: 'team_2v2' },
    matches: [],
  }),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import * as fc from 'fast-check';
import { checkSchedulingReadiness } from '../../../src/services/analytics/matchmakingService';
import { createTeamTournament, getEligibleTeamsForTournament, autoCreateNextTeamTournament } from '../../../src/services/tournament/teamTournamentService';
import { tournament2v2LockingPredicate, tournament3v3LockingPredicate } from '../../../src/services/subscription/lockingPredicates';
import { TournamentError, TournamentErrorCode } from '../../../src/errors/tournamentErrors';

const mockCheckSchedulingReadiness = checkSchedulingReadiness as jest.MockedFunction<typeof checkSchedulingReadiness>;

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMockTeam(id: number, teamSize: number, robotIds: number[]) {
  return {
    id,
    teamName: `Team ${id}`,
    teamSize,
    eligibility: 'ELIGIBLE',
    createdAt: new Date(2024, 0, id),
    members: robotIds.map((robotId, idx) => ({
      robotId,
      slotIndex: idx,
      robot: {
        id: robotId,
        name: `Robot ${robotId}`,
        elo: 1200 + robotId,
        mainWeaponId: 1,
        offhandWeaponId: null,
        loadoutType: 'single',
        mainWeapon: { weapon: { type: 'sword' } },
        offhandWeapon: null,
      },
    })),
  };
}

// ─── Property 7: Tournament creation threshold ───────────────────────────────

describe('Feature: team-battle-tournaments, Property 7: Tournament created iff eligible count >= 4', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckSchedulingReadiness.mockReturnValue({ isReady: true, reasons: [], hpCheck: true, weaponCheck: true } as any);
  });

  /**
   * **Validates: Requirements 2.1, 2.8**
   *
   * For any team size (2 or 3) and set of eligible teams of that size, a tournament
   * SHALL be created if and only if the eligible count is ≥ 4. When the count is < 4,
   * no tournament is created and no error is raised (for auto-create; the direct
   * `createTeamTournament` throws INSUFFICIENT_PARTICIPANTS).
   */
  it('should create tournament when eligible count >= 4 (createTeamTournament)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 4, max: 100 }),
        fc.constantFrom(2, 3) as fc.Arbitrary<2 | 3>,
        async (eligibleCount, teamSize) => {
          // Create mock teams
          const teams = Array.from({ length: eligibleCount }, (_, i) =>
            createMockTeam(i + 1, teamSize, Array.from({ length: teamSize }, (_, j) => i * teamSize + j + 1))
          );

          // Setup mocks: all teams are eligible, subscribed, and ready
          mockTeamBattleFindMany.mockResolvedValue(teams);
          const allRobotIds = teams.flatMap(t => t.members.map(m => m.robotId));
          mockSubscriptionFindMany.mockResolvedValue(
            allRobotIds.map(robotId => ({ robotId }))
          );
          mockTournamentCount.mockResolvedValue(0);

          // createTeamTournament should succeed (not throw)
          const result = await createTeamTournament(teamSize);
          expect(result).toBeDefined();
          expect(result.tournament).toBeDefined();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should throw INSUFFICIENT_PARTICIPANTS when eligible count < 4 (createTeamTournament)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 3 }),
        fc.constantFrom(2, 3) as fc.Arbitrary<2 | 3>,
        async (eligibleCount, teamSize) => {
          // Create mock teams (fewer than 4)
          const teams = Array.from({ length: eligibleCount }, (_, i) =>
            createMockTeam(i + 1, teamSize, Array.from({ length: teamSize }, (_, j) => i * teamSize + j + 1))
          );

          // Setup mocks
          mockTeamBattleFindMany.mockResolvedValue(teams);
          const allRobotIds = teams.flatMap(t => t.members.map(m => m.robotId));
          mockSubscriptionFindMany.mockResolvedValue(
            allRobotIds.map(robotId => ({ robotId }))
          );

          // createTeamTournament should throw INSUFFICIENT_PARTICIPANTS
          await expect(createTeamTournament(teamSize)).rejects.toThrow(TournamentError);

          try {
            await createTeamTournament(teamSize);
          } catch (error) {
            expect(error).toBeInstanceOf(TournamentError);
            expect((error as TournamentError).code).toBe(TournamentErrorCode.INSUFFICIENT_PARTICIPANTS);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should return null without error when eligible count < 4 (autoCreateNextTeamTournament)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 3 }),
        fc.constantFrom(2, 3) as fc.Arbitrary<2 | 3>,
        async (eligibleCount, teamSize) => {
          // No active tournament exists
          mockTournamentFindFirst.mockResolvedValue(null);

          // Create mock teams (fewer than 4)
          const teams = Array.from({ length: eligibleCount }, (_, i) =>
            createMockTeam(i + 1, teamSize, Array.from({ length: teamSize }, (_, j) => i * teamSize + j + 1))
          );

          // Setup mocks
          mockTeamBattleFindMany.mockResolvedValue(teams);
          const allRobotIds = teams.flatMap(t => t.members.map(m => m.robotId));
          mockSubscriptionFindMany.mockResolvedValue(
            allRobotIds.map(robotId => ({ robotId }))
          );

          // autoCreateNextTeamTournament should return null (no error)
          const result = await autoCreateNextTeamTournament(teamSize);
          expect(result).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 9: Team eligibility requires full subscription and eligible status ─

describe('Feature: team-battle-tournaments, Property 9: Team eligible iff eligibility=ELIGIBLE AND all members subscribed AND all members ready', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * **Validates: Requirements 3.2, 3.3, 3.7**
   *
   * For any team, the team is eligible for tournament entry if and only if:
   * (a) the team's `eligibility` field equals `'ELIGIBLE'`, AND
   * (b) every member robot holds an active subscription to the corresponding event type, AND
   * (c) every member robot passes scheduling readiness checks.
   */
  it('should include team only when all three conditions are met', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          eligible: fc.boolean(),
          subscriptions: fc.array(fc.boolean(), { minLength: 2, maxLength: 3 }),
          readiness: fc.array(fc.boolean(), { minLength: 2, maxLength: 3 }),
        }),
        async ({ eligible, subscriptions, readiness }) => {
          // Normalize arrays to same length (team size)
          const teamSize = Math.min(subscriptions.length, readiness.length) as 2 | 3;
          const subs = subscriptions.slice(0, teamSize);
          const ready = readiness.slice(0, teamSize);

          // Create a single team with the given conditions
          const robotIds = Array.from({ length: teamSize }, (_, i) => i + 1);
          const team = {
            id: 1,
            teamName: 'Test Team',
            teamSize,
            eligibility: eligible ? 'ELIGIBLE' : 'INELIGIBLE',
            createdAt: new Date(2024, 0, 1),
            members: robotIds.map((robotId, idx) => ({
              robotId,
              slotIndex: idx,
              robot: {
                id: robotId,
                name: `Robot ${robotId}`,
                elo: 1200 + robotId,
                mainWeaponId: 1,
                offhandWeaponId: null,
                loadoutType: 'single',
                mainWeapon: { weapon: { type: 'sword' } },
                offhandWeapon: null,
              },
            })),
          };

          // Only teams with eligibility='ELIGIBLE' are returned by the Prisma query
          // (the WHERE clause filters by eligibility: 'ELIGIBLE')
          if (eligible) {
            mockTeamBattleFindMany.mockResolvedValue([team]);
          } else {
            // Prisma WHERE clause filters out non-eligible teams
            mockTeamBattleFindMany.mockResolvedValue([]);
          }

          // Setup subscription mock: only subscribed robots appear in the result
          const subscribedRobotIds = robotIds.filter((_, idx) => subs[idx]);
          mockSubscriptionFindMany.mockResolvedValue(
            subscribedRobotIds.map(robotId => ({ robotId }))
          );

          // Setup readiness mock: per-robot readiness
          mockCheckSchedulingReadiness.mockImplementation((robot: any) => {
            const idx = robotIds.indexOf(robot.id);
            return { isReady: ready[idx], reasons: [], hpCheck: true, weaponCheck: ready[idx] } as any;
          });

          // Call the eligibility function
          const result = await getEligibleTeamsForTournament(teamSize);

          // Expected: team is eligible iff ALL three conditions are true
          const allSubscribed = subs.every(s => s === true);
          const allReady = ready.every(r => r === true);
          const expectedEligible = eligible && allSubscribed && allReady;

          if (expectedEligible) {
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe(team.id);
          } else {
            expect(result).toHaveLength(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should exclude team when any single condition fails', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          eligible: fc.boolean(),
          subscriptions: fc.array(fc.boolean(), { minLength: 2, maxLength: 3 }),
          readiness: fc.array(fc.boolean(), { minLength: 2, maxLength: 3 }),
        }).filter(({ eligible, subscriptions, readiness }) => {
          // Only test cases where at least one condition fails
          const teamSize = Math.min(subscriptions.length, readiness.length);
          const subs = subscriptions.slice(0, teamSize);
          const ready = readiness.slice(0, teamSize);
          const allSubscribed = subs.every(s => s === true);
          const allReady = ready.every(r => r === true);
          return !(eligible && allSubscribed && allReady);
        }),
        async ({ eligible, subscriptions, readiness }) => {
          const teamSize = Math.min(subscriptions.length, readiness.length) as 2 | 3;
          const subs = subscriptions.slice(0, teamSize);
          const ready = readiness.slice(0, teamSize);

          const robotIds = Array.from({ length: teamSize }, (_, i) => i + 1);
          const team = {
            id: 1,
            teamName: 'Test Team',
            teamSize,
            eligibility: eligible ? 'ELIGIBLE' : 'INELIGIBLE',
            createdAt: new Date(2024, 0, 1),
            members: robotIds.map((robotId, idx) => ({
              robotId,
              slotIndex: idx,
              robot: {
                id: robotId,
                name: `Robot ${robotId}`,
                elo: 1200 + robotId,
                mainWeaponId: 1,
                offhandWeaponId: null,
                loadoutType: 'single',
                mainWeapon: { weapon: { type: 'sword' } },
                offhandWeapon: null,
              },
            })),
          };

          if (eligible) {
            mockTeamBattleFindMany.mockResolvedValue([team]);
          } else {
            mockTeamBattleFindMany.mockResolvedValue([]);
          }

          const subscribedRobotIds = robotIds.filter((_, idx) => subs[idx]);
          mockSubscriptionFindMany.mockResolvedValue(
            subscribedRobotIds.map(robotId => ({ robotId }))
          );

          mockCheckSchedulingReadiness.mockImplementation((robot: any) => {
            const idx = robotIds.indexOf(robot.id);
            return { isReady: ready[idx], reasons: [], hpCheck: true, weaponCheck: ready[idx] } as any;
          });

          const result = await getEligibleTeamsForTournament(teamSize);

          // When any condition fails, team should NOT be eligible
          expect(result).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 10: Tournament locking predicate ───────────────────────────────

describe('Feature: team-battle-tournaments, Property 10: Locking predicate returns true iff robot\'s team has pending tournament match', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * **Validates: Requirements 3.5**
   *
   * For any robot that is a member of a team with at least one pending or scheduled
   * match in an active tournament of the corresponding type, the locking predicate
   * SHALL return `true`. For any robot not in such a team, the predicate SHALL
   * return `false`.
   */
  it('should return true when robot has team with pending match in active tournament', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        fc.constantFrom('team_2v2', 'team_3v3') as fc.Arbitrary<'team_2v2' | 'team_3v3'>,
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1, max: 100 }),
        async (hasPendingMatch, tournamentType, robotId, teamId) => {
          // Setup: robot is a member of a team
          mockTeamBattleMemberFindMany.mockResolvedValue([{ teamId }]);

          // Setup: team has (or doesn't have) pending matches in active tournament
          mockScheduledTournamentMatchCount.mockResolvedValue(hasPendingMatch ? 1 : 0);

          // Call the appropriate locking predicate
          const predicate = tournamentType === 'team_2v2'
            ? tournament2v2LockingPredicate
            : tournament3v3LockingPredicate;

          const result = await predicate(robotId);

          // Locking predicate returns true iff there are pending matches
          expect(result).toBe(hasPendingMatch);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should return false when robot has no team memberships', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('team_2v2', 'team_3v3') as fc.Arbitrary<'team_2v2' | 'team_3v3'>,
        fc.integer({ min: 1, max: 1000 }),
        async (tournamentType, robotId) => {
          // Setup: robot has no team memberships
          mockTeamBattleMemberFindMany.mockResolvedValue([]);

          const predicate = tournamentType === 'team_2v2'
            ? tournament2v2LockingPredicate
            : tournament3v3LockingPredicate;

          const result = await predicate(robotId);

          // No team memberships → always false
          expect(result).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should return false when robot has team but no pending matches in active tournament', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('team_2v2', 'team_3v3') as fc.Arbitrary<'team_2v2' | 'team_3v3'>,
        fc.integer({ min: 1, max: 1000 }),
        fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 5 }),
        async (tournamentType, robotId, teamIds) => {
          // Setup: robot is a member of one or more teams
          mockTeamBattleMemberFindMany.mockResolvedValue(
            teamIds.map(teamId => ({ teamId }))
          );

          // Setup: no pending matches in active tournament
          mockScheduledTournamentMatchCount.mockResolvedValue(0);

          const predicate = tournamentType === 'team_2v2'
            ? tournament2v2LockingPredicate
            : tournament3v3LockingPredicate;

          const result = await predicate(robotId);

          // No pending matches → false
          expect(result).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should return true when robot has team with multiple pending matches', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('team_2v2', 'team_3v3') as fc.Arbitrary<'team_2v2' | 'team_3v3'>,
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 10 }),
        async (tournamentType, robotId, teamId, pendingMatchCount) => {
          // Setup: robot is a member of a team
          mockTeamBattleMemberFindMany.mockResolvedValue([{ teamId }]);

          // Setup: team has multiple pending matches
          mockScheduledTournamentMatchCount.mockResolvedValue(pendingMatchCount);

          const predicate = tournamentType === 'team_2v2'
            ? tournament2v2LockingPredicate
            : tournament3v3LockingPredicate;

          const result = await predicate(robotId);

          // Any pending matches → true
          expect(result).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
