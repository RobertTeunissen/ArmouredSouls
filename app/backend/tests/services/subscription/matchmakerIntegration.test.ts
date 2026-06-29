/**
 * Matchmaker Integration Tests — Subscription Filtering
 *
 * Verifies that all four matchmakers (League, Tournament, Tag Team, KotH)
 * use the batch subscription query pattern to filter out robots/teams
 * that are not subscribed to the relevant event type.
 *
 * Each matchmaker uses:
 *   prisma.subscription.findMany({ where: { eventType, robotId: { in: [...] } } })
 *
 * _Requirements: R7.1, R7.2, R7.3, R7.4, R7.5_
 */

// ── Mocks ────────────────────────────────────────────────────────────

const mockPrisma = {
  robot: { findMany: jest.fn() },
  subscription: { findMany: jest.fn() },
  scheduledMatch: { findMany: jest.fn(), create: jest.fn().mockResolvedValue({ id: 1 }), createMany: jest.fn(), findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 1, participants: [] }) },
  scheduledTournamentMatch: { findMany: jest.fn() },
  scheduledTagTeamMatch: { findMany: jest.fn(), create: jest.fn() },
  scheduledKothMatchParticipant: { findMany: jest.fn() },
  tagTeam: { findMany: jest.fn() },
  teamBattle: { findMany: jest.fn() },
  league: { findMany: jest.fn() },
  leagueInstance: { findMany: jest.fn() },
  battle: { findMany: jest.fn() },
  scheduledMatchParticipant: { findMany: jest.fn().mockResolvedValue([]), createMany: jest.fn().mockResolvedValue({ count: 0 }) },
  standing: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
  $transaction: jest.fn(),
};
// By default, $transaction executes the callback with mockPrisma as tx
mockPrisma.$transaction.mockImplementation((fn: (tx: any) => Promise<unknown>) => fn(mockPrisma));

jest.mock('../../../src/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Mock league instance service for league matchmaker
jest.mock('../../../src/services/league/leagueInstanceService', () => ({
  __esModule: true,
  getInstancesForTier: jest.fn(),
  LEAGUE_TIERS: ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'],
}));

// Mock batchActivatePendingSubscriptions — these tests focus on subscription filtering,
// not the activation logic (which is tested separately in subscriptionService.test.ts)
jest.mock('../../../src/services/subscription/subscriptionService', () => ({
  __esModule: true,
  batchActivatePendingSubscriptions: jest.fn().mockResolvedValue(undefined),
}));

import logger from '../../../src/config/logger';
import { getInstancesForTier } from '../../../src/services/league/leagueInstanceService';

const mockLogger = logger as jest.Mocked<typeof logger>;
const mockGetInstancesForTier = getInstancesForTier as jest.MockedFunction<typeof getInstancesForTier>;
const mockCheckTeamSchedulingReadiness = jest.fn();

// ── Imports (after mocks) ────────────────────────────────────────────

import { getEligibleRobots } from '../../../src/services/koth/kothMatchmakingService';
import { getEligibleRobotsForTournament } from '../../../src/services/tournament/tournamentService';
import { runMatchmakingForTier } from '../../../src/services/analytics/matchmakingService';
import { getEligibleTeams } from '../../../src/services/tag-team/tagTeamMatchmakingService';

// ── Tests ────────────────────────────────────────────────────────────

describe('Matchmaker Subscription Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('League Matchmaker', () => {
    it('should call subscription.findMany with eventType league and robot IDs', async () => {
      // Mock standing.findMany for instance discovery and robot ID lookup
      mockPrisma.standing.findMany.mockImplementation((args: any) => {
        // Distinct instances query
        if (args?.distinct) {
          return Promise.resolve([{ leagueInstanceId: 'bronze-1' }]);
        }
        // Robot IDs in instance query
        if (args?.where?.leagueInstanceId === 'bronze-1') {
          return Promise.resolve([{ entityId: 1 }, { entityId: 2 }, { entityId: 3 }]);
        }
        return Promise.resolve([]);
      });

      // Mock robots in the league (need loadoutType for checkSchedulingReadiness)
      const robots = [
        { id: 1, name: 'Robot1', leagueId: 'bronze-1', elo: 1200, leaguePoints: 100, mainWeaponId: 1, offhandWeaponId: null, loadoutType: 'single' },
        { id: 2, name: 'Robot2', leagueId: 'bronze-1', elo: 1100, leaguePoints: 90, mainWeaponId: 2, offhandWeaponId: null, loadoutType: 'single' },
        { id: 3, name: 'Robot3', leagueId: 'bronze-1', elo: 1000, leaguePoints: 80, mainWeaponId: 3, offhandWeaponId: null, loadoutType: 'single' },
      ];
      mockPrisma.robot.findMany.mockResolvedValue(robots);

      // Only robots 1 and 3 are subscribed to league
      mockPrisma.subscription.findMany.mockResolvedValue([
        { robotId: 1 },
        { robotId: 3 },
      ]);

      // No already-scheduled matches
      mockPrisma.scheduledMatch.findMany.mockResolvedValue([]);
      mockPrisma.scheduledMatch.create.mockResolvedValue({});

      // No recent battles (for pairing algorithm)
      mockPrisma.battle.findMany.mockResolvedValue([]);

      // No already scheduled participants
      mockPrisma.scheduledMatchParticipant.findMany.mockResolvedValue([]);

      await runMatchmakingForTier('bronze' as any, new Date());

      // Verify subscription batch query was called with correct event type
      expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            eventType: 'league_1v1',
            robotId: { in: expect.arrayContaining([1, 2, 3]) },
          }),
          select: { robotId: true },
        })
      );
    });

    it('should exclude robots without league subscription and log exclusion', async () => {
      // Mock standing.findMany for instance discovery and robot ID lookup
      mockPrisma.standing.findMany.mockImplementation((args: any) => {
        if (args?.distinct) {
          return Promise.resolve([{ leagueInstanceId: 'bronze-1' }]);
        }
        if (args?.where?.leagueInstanceId === 'bronze-1') {
          return Promise.resolve([{ entityId: 10 }, { entityId: 11 }]);
        }
        return Promise.resolve([]);
      });

      const robots = [
        { id: 10, name: 'Sub', leagueId: 'bronze-1', elo: 1200, leaguePoints: 100, mainWeaponId: 1, offhandWeaponId: null, loadoutType: 'single' },
        { id: 11, name: 'Unsub', leagueId: 'bronze-1', elo: 1100, leaguePoints: 90, mainWeaponId: 2, offhandWeaponId: null, loadoutType: 'single' },
      ];
      mockPrisma.robot.findMany.mockResolvedValue(robots);

      // Only robot 10 is subscribed
      mockPrisma.subscription.findMany.mockResolvedValue([{ robotId: 10 }]);
      mockPrisma.scheduledMatch.findMany.mockResolvedValue([]);
      mockPrisma.scheduledMatchParticipant.findMany.mockResolvedValue([]);

      await runMatchmakingForTier('bronze' as any, new Date());

      // Verify exclusion log was emitted
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Excluded 1 robots without league subscription'),
        expect.anything()
      );
    });
  });

  describe('Tournament Matchmaker', () => {
    it('should call subscription.findMany with eventType tournament and robot IDs', async () => {
      // Robots need loadoutType for checkSchedulingReadiness
      const robots = [
        { id: 1, name: 'R1', mainWeaponId: 1, offhandWeaponId: null, loadoutType: 'single', mainWeapon: { weapon: { type: 'sword' } }, offhandWeapon: null },
        { id: 2, name: 'R2', mainWeaponId: 2, offhandWeaponId: null, loadoutType: 'single', mainWeapon: { weapon: { type: 'axe' } }, offhandWeapon: null },
        { id: 3, name: 'R3', mainWeaponId: 3, offhandWeaponId: null, loadoutType: 'single', mainWeapon: { weapon: { type: 'mace' } }, offhandWeapon: null },
      ];
      mockPrisma.robot.findMany.mockResolvedValue(robots);

      // Only robots 1 and 2 are subscribed to tournament
      mockPrisma.subscription.findMany.mockResolvedValue([
        { robotId: 1 },
        { robotId: 2 },
      ]);

      const result = await getEligibleRobotsForTournament();

      // Verify subscription batch query was called with correct event type
      expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            eventType: 'tournament_1v1',
            robotId: { in: expect.arrayContaining([1, 2, 3]) },
          }),
          select: { robotId: true },
        })
      );

      // Only subscribed robots should be returned
      expect(result).toHaveLength(2);
      expect(result.map(r => r.id)).toEqual(expect.arrayContaining([1, 2]));
      expect(result.map(r => r.id)).not.toContain(3);
    });

    it('should exclude robots without tournament subscription and log exclusion', async () => {
      const robots = [
        { id: 20, name: 'Sub1', mainWeaponId: 1, offhandWeaponId: null, loadoutType: 'single', mainWeapon: { weapon: { type: 'sword' } }, offhandWeapon: null },
        { id: 21, name: 'Unsub1', mainWeaponId: 2, offhandWeaponId: null, loadoutType: 'single', mainWeapon: { weapon: { type: 'axe' } }, offhandWeapon: null },
        { id: 22, name: 'Unsub2', mainWeaponId: 3, offhandWeaponId: null, loadoutType: 'single', mainWeapon: { weapon: { type: 'mace' } }, offhandWeapon: null },
      ];
      mockPrisma.robot.findMany.mockResolvedValue(robots);

      // Only robot 20 is subscribed
      mockPrisma.subscription.findMany.mockResolvedValue([{ robotId: 20 }]);

      const result = await getEligibleRobotsForTournament();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(20);

      // Verify exclusion log
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Excluded 2 robots without tournament subscription')
      );
    });

    it('should return all robots when all are subscribed', async () => {
      const robots = [
        { id: 30, name: 'R1', mainWeaponId: 1, offhandWeaponId: null, loadoutType: 'single', mainWeapon: { weapon: { type: 'sword' } }, offhandWeapon: null },
        { id: 31, name: 'R2', mainWeaponId: 2, offhandWeaponId: null, loadoutType: 'single', mainWeapon: { weapon: { type: 'axe' } }, offhandWeapon: null },
      ];
      mockPrisma.robot.findMany.mockResolvedValue(robots);

      // All robots subscribed
      mockPrisma.subscription.findMany.mockResolvedValue([
        { robotId: 30 },
        { robotId: 31 },
      ]);

      const result = await getEligibleRobotsForTournament();

      expect(result).toHaveLength(2);
      // No exclusion log should be emitted when count is 0
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Excluded'),
      );
    });
  });

  describe('Tag Team Matchmaker', () => {
    it('should call subscription.findMany with eventType tag_team and all robot IDs from teams', async () => {
      // Mock standing.findMany to return team IDs in the instance
      mockPrisma.standing.findMany.mockResolvedValue([
        { entityId: 100 }, { entityId: 101 },
      ]);

      // Mock teams via teamBattle.findMany (new unified pattern uses members, not activeRobot/reserveRobot)
      const teams = [
        {
          id: 100, teamSize: 2, teamName: 'Team 100', eligibility: 'ELIGIBLE',
          members: [
            { id: 1, robotId: 1, teamId: 100, slotIndex: 0, robot: { id: 1, mainWeaponId: 1, offhandWeaponId: null, loadoutType: 'single' } },
            { id: 2, robotId: 2, teamId: 100, slotIndex: 1, robot: { id: 2, mainWeaponId: 2, offhandWeaponId: null, loadoutType: 'single' } },
          ],
        },
        {
          id: 101, teamSize: 2, teamName: 'Team 101', eligibility: 'ELIGIBLE',
          members: [
            { id: 3, robotId: 3, teamId: 101, slotIndex: 0, robot: { id: 3, mainWeaponId: 3, offhandWeaponId: null, loadoutType: 'single' } },
            { id: 4, robotId: 4, teamId: 101, slotIndex: 1, robot: { id: 4, mainWeaponId: 4, offhandWeaponId: null, loadoutType: 'single' } },
          ],
        },
      ];
      mockPrisma.teamBattle.findMany.mockResolvedValue(teams);

      // No already-scheduled matches
      mockPrisma.scheduledMatchParticipant.findMany.mockResolvedValue([]);

      // Only team 100's robots (1, 2) are subscribed; team 101's robot 4 is not
      mockPrisma.subscription.findMany.mockResolvedValue([
        { robotId: 1 },
        { robotId: 2 },
        { robotId: 3 },
        // robot 4 is NOT subscribed
      ]);

      await getEligibleTeams('bronze', 'bronze-1');

      // Verify subscription batch query was called with tag_team event type
      expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            eventType: 'tag_team',
            robotId: { in: expect.arrayContaining([1, 2, 3, 4]) },
          }),
          select: { robotId: true },
        })
      );
    });

    it('should exclude teams where not BOTH robots are subscribed to tag_team', async () => {
      // Mock standing.findMany to return team IDs in the instance
      mockPrisma.standing.findMany.mockResolvedValue([
        { entityId: 200 }, { entityId: 201 },
      ]);

      const teams = [
        {
          id: 200, teamSize: 2, teamName: 'Team 200', eligibility: 'ELIGIBLE',
          members: [
            { id: 10, robotId: 10, teamId: 200, slotIndex: 0, robot: { id: 10, mainWeaponId: 1, offhandWeaponId: null, loadoutType: 'single' } },
            { id: 11, robotId: 11, teamId: 200, slotIndex: 1, robot: { id: 11, mainWeaponId: 2, offhandWeaponId: null, loadoutType: 'single' } },
          ],
        },
        {
          id: 201, teamSize: 2, teamName: 'Team 201', eligibility: 'ELIGIBLE',
          members: [
            { id: 12, robotId: 12, teamId: 201, slotIndex: 0, robot: { id: 12, mainWeaponId: 3, offhandWeaponId: null, loadoutType: 'single' } },
            { id: 13, robotId: 13, teamId: 201, slotIndex: 1, robot: { id: 13, mainWeaponId: 4, offhandWeaponId: null, loadoutType: 'single' } },
          ],
        },
      ];
      mockPrisma.teamBattle.findMany.mockResolvedValue(teams);
      mockPrisma.scheduledMatchParticipant.findMany.mockResolvedValue([]);

      // Team 200: both subscribed. Team 201: only robot 12 subscribed (13 missing)
      mockPrisma.subscription.findMany.mockResolvedValue([
        { robotId: 10 },
        { robotId: 11 },
        { robotId: 12 },
        // robot 13 NOT subscribed
      ]);

      const result = await getEligibleTeams('bronze', 'bronze-1');

      // Only team 200 should be eligible (both robots subscribed)
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(200);

      // Verify exclusion log was emitted (1 team excluded)
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Excluded 1 teams without tag_team subscription')
      );
    });

    it('should include teams where both active and reserve robots are subscribed', async () => {
      // Mock standing.findMany to return team IDs in the instance
      mockPrisma.standing.findMany.mockResolvedValue([
        { entityId: 300 }, { entityId: 301 },
      ]);

      const teams = [
        {
          id: 300, teamSize: 2, teamName: 'Team 300', eligibility: 'ELIGIBLE',
          members: [
            { id: 20, robotId: 20, teamId: 300, slotIndex: 0, robot: { id: 20, mainWeaponId: 1, offhandWeaponId: null, loadoutType: 'single' } },
            { id: 21, robotId: 21, teamId: 300, slotIndex: 1, robot: { id: 21, mainWeaponId: 2, offhandWeaponId: null, loadoutType: 'single' } },
          ],
        },
        {
          id: 301, teamSize: 2, teamName: 'Team 301', eligibility: 'ELIGIBLE',
          members: [
            { id: 22, robotId: 22, teamId: 301, slotIndex: 0, robot: { id: 22, mainWeaponId: 3, offhandWeaponId: null, loadoutType: 'single' } },
            { id: 23, robotId: 23, teamId: 301, slotIndex: 1, robot: { id: 23, mainWeaponId: 4, offhandWeaponId: null, loadoutType: 'single' } },
          ],
        },
      ];
      mockPrisma.teamBattle.findMany.mockResolvedValue(teams);
      mockPrisma.scheduledMatchParticipant.findMany.mockResolvedValue([]);

      // All robots subscribed
      mockPrisma.subscription.findMany.mockResolvedValue([
        { robotId: 20 },
        { robotId: 21 },
        { robotId: 22 },
        { robotId: 23 },
      ]);

      const result = await getEligibleTeams('bronze', 'bronze-1');

      // Both teams should be eligible
      expect(result).toHaveLength(2);
    });
  });

  describe('KotH Matchmaker', () => {
    it('should call subscription.findMany with eventType koth and eligible robot IDs', async () => {
      // Mock standing.findMany to return robot IDs in the instance
      mockPrisma.standing.findMany.mockResolvedValue([
        { entityId: 1 }, { entityId: 2 }, { entityId: 3 },
      ]);

      const robots = [
        { id: 1, userId: 1, elo: 1500, name: 'R1', mainWeaponId: 1, loadoutType: 'single' },
        { id: 2, userId: 2, elo: 1400, name: 'R2', mainWeaponId: 2, loadoutType: 'single' },
        { id: 3, userId: 3, elo: 1300, name: 'R3', mainWeaponId: 3, loadoutType: 'single' },
      ];
      mockPrisma.robot.findMany.mockResolvedValue(robots);

      // No already-scheduled participants
      mockPrisma.scheduledKothMatchParticipant.findMany.mockResolvedValue([]);
      mockPrisma.scheduledMatchParticipant.findMany.mockResolvedValue([]);

      // Only robots 1 and 2 are subscribed to koth
      mockPrisma.subscription.findMany.mockResolvedValue([
        { robotId: 1 },
        { robotId: 2 },
      ]);

      const result = await getEligibleRobots('bronze', 'bronze_1');

      // Verify subscription batch query was called with correct event type
      expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            eventType: 'koth',
            robotId: { in: expect.arrayContaining([1, 2, 3]) },
          }),
          select: { robotId: true },
        })
      );

      // Only subscribed robots should be returned
      expect(result).toHaveLength(2);
      expect(result.map(r => r.id)).toEqual(expect.arrayContaining([1, 2]));
      expect(result.map(r => r.id)).not.toContain(3);
    });

    it('should exclude robots without koth subscription and log exclusion', async () => {
      // Mock standing.findMany to return robot IDs in the instance
      mockPrisma.standing.findMany.mockResolvedValue([
        { entityId: 40 }, { entityId: 41 }, { entityId: 42 }, { entityId: 43 },
      ]);

      const robots = [
        { id: 40, userId: 1, elo: 1500, name: 'Sub1', mainWeaponId: 1, loadoutType: 'single' },
        { id: 41, userId: 2, elo: 1400, name: 'Unsub1', mainWeaponId: 2, loadoutType: 'single' },
        { id: 42, userId: 3, elo: 1300, name: 'Unsub2', mainWeaponId: 3, loadoutType: 'single' },
        { id: 43, userId: 4, elo: 1200, name: 'Unsub3', mainWeaponId: 4, loadoutType: 'single' },
      ];
      mockPrisma.robot.findMany.mockResolvedValue(robots);
      mockPrisma.scheduledKothMatchParticipant.findMany.mockResolvedValue([]);
      mockPrisma.scheduledMatchParticipant.findMany.mockResolvedValue([]);

      // Only robot 40 is subscribed
      mockPrisma.subscription.findMany.mockResolvedValue([{ robotId: 40 }]);

      const result = await getEligibleRobots('bronze', 'bronze_1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(40);

      // Verify exclusion log
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Excluded 3 robots without koth subscription'),
        expect.anything()
      );
    });

    it('should return empty array when no robots are subscribed', async () => {
      // Mock standing.findMany to return robot IDs in the instance
      mockPrisma.standing.findMany.mockResolvedValue([
        { entityId: 50 }, { entityId: 51 },
      ]);

      const robots = [
        { id: 50, userId: 1, elo: 1500, name: 'R1', mainWeaponId: 1, loadoutType: 'single' },
        { id: 51, userId: 2, elo: 1400, name: 'R2', mainWeaponId: 2, loadoutType: 'single' },
      ];
      mockPrisma.robot.findMany.mockResolvedValue(robots);
      mockPrisma.scheduledKothMatchParticipant.findMany.mockResolvedValue([]);
      mockPrisma.scheduledMatchParticipant.findMany.mockResolvedValue([]);

      // No robots subscribed
      mockPrisma.subscription.findMany.mockResolvedValue([]);

      const result = await getEligibleRobots('bronze', 'bronze_1');

      expect(result).toHaveLength(0);

      // Verify exclusion log
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Excluded 2 robots without koth subscription'),
        expect.anything()
      );
    });
  });
});
