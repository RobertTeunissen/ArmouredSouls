/**
 * Unit tests for 1v1 league matchmaking LP-ordering behaviour.
 *
 * Verifies that the greedy pairing algorithm processes robots in
 * LP-descending order so the highest-LP robot picks its opponent first.
 * This prevents low-LP/high-ELO robots from consuming easy opponents
 * before high-LP robots get a chance to be matched fairly.
 */

import { Prisma, Robot } from '../../../generated/prisma';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma: any = {
  standing: {
    findMany: jest.fn(),
  },
  robot: {
    findMany: jest.fn(),
  },
  subscription: {
    findMany: jest.fn(),
  },
  scheduledMatch: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  scheduledMatchParticipant: {
    findMany: jest.fn().mockResolvedValue([]),
  },
};

jest.mock('../../../src/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../src/services/scheduling/schedulingService', () => ({
  __esModule: true,
  default: {
    getAlreadyScheduledIds: jest.fn().mockResolvedValue(new Set()),
    createMatch: jest.fn().mockResolvedValue({ id: 1 }),
  },
}));

// ── Import under test ────────────────────────────────────────────────────────

import { runMatchmakingForTier } from '../../../src/services/analytics/matchmakingService';
import schedulingService from '../../../src/services/scheduling/schedulingService';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRobot(id: number, elo: number, userId: number = 100): Robot {
  return {
    id,
    userId,
    name: `Robot ${id}`,
    frameId: 1,
    paintJob: null,
    imageUrl: null,
    combatPower: new Prisma.Decimal(10),
    targetingSystems: new Prisma.Decimal(10),
    criticalSystems: new Prisma.Decimal(10),
    penetration: new Prisma.Decimal(10),
    weaponControl: new Prisma.Decimal(10),
    attackSpeed: new Prisma.Decimal(10),
    armorPlating: new Prisma.Decimal(10),
    shieldCapacity: new Prisma.Decimal(10),
    evasionThrusters: new Prisma.Decimal(10),
    damageDampeners: new Prisma.Decimal(10),
    counterProtocols: new Prisma.Decimal(10),
    hullIntegrity: new Prisma.Decimal(10),
    servoMotors: new Prisma.Decimal(10),
    gyroStabilizers: new Prisma.Decimal(10),
    hydraulicSystems: new Prisma.Decimal(10),
    powerCore: new Prisma.Decimal(10),
    combatAlgorithms: new Prisma.Decimal(10),
    threatAnalysis: new Prisma.Decimal(10),
    adaptiveAI: new Prisma.Decimal(10),
    logicCores: new Prisma.Decimal(10),
    syncProtocols: new Prisma.Decimal(10),
    supportSystems: new Prisma.Decimal(10),
    formationTactics: new Prisma.Decimal(10),
    currentHP: 100,
    maxHP: 100,
    currentShield: 20,
    maxShield: 20,
    damageTaken: 0,
    elo,
    totalBattles: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    damageDealtLifetime: 0,
    damageTakenLifetime: 0,
    kills: 0,
    fame: 0,
    titles: null,
    repairQuoteCredits: 0,
    battleReadiness: 100,
    lifetimeRepairCreditsPaid: 0,
    yieldThreshold: 10,
    loadoutType: 'single',
    stance: 'balanced',
    offensiveWins: 0,
    defensiveWins: 0,
    balancedWins: 0,
    dualWieldWins: 0,
    mainWeaponId: 1, // weapon equipped → scheduling-ready
    offhandWeaponId: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    grandMeleeWins: 0,
    grandMeleeTop3: 0,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('1v1 League Matchmaking LP-Ordering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (schedulingService.getAlreadyScheduledIds as jest.Mock).mockResolvedValue(new Set());
    (schedulingService.createMatch as jest.Mock).mockResolvedValue({ id: 1 });
    mockPrisma.scheduledMatch.findMany.mockResolvedValue([]);
  });

  it('should process robots in LP-descending order so highest-LP robot picks first', async () => {
    // Setup: 3 robots in one instance
    // Robot A: high LP (50), low ELO (900) — the robot that was being exploited
    // Robot B: low LP (5), high ELO (1400) — the exploiter that was picking first
    // Robot C: mid LP (20), mid ELO (1100) — a normal robot
    //
    // With LP-ordering: Robot A picks first → pairs with Robot C (closest LP: |50-20|=30)
    // With ELO-ordering (bug): Robot B picks first → pairs with Robot C (closest LP: |5-20|=15)
    //   then Robot A is left alone → gets bye-match (free win, LP grows unchecked)

    const robotA = makeRobot(1, 900, 101); // high LP, low ELO
    const robotB = makeRobot(2, 1400, 102); // low LP, high ELO
    const robotC = makeRobot(3, 1100, 103); // mid LP, mid ELO

    // Standings with LP values and instance placement
    mockPrisma.standing.findMany.mockImplementation((args: any) => {
      // Discover instances (distinct query)
      if (args?.distinct) {
        return Promise.resolve([{ leagueInstanceId: 'bronze_1' }]);
      }
      // Instance membership query (leagueInstanceId filter)
      if (args?.where?.leagueInstanceId === 'bronze_1') {
        return Promise.resolve([
          { entityId: 1, leaguePoints: 50 },
          { entityId: 2, leaguePoints: 5 },
          { entityId: 3, leaguePoints: 20 },
        ]);
      }
      // LP lookup in pairRobots (entityId: { in: [...] })
      if (args?.where?.entityId) {
        return Promise.resolve([
          { entityId: 1, leaguePoints: 50 },
          { entityId: 2, leaguePoints: 5 },
          { entityId: 3, leaguePoints: 20 },
        ]);
      }
      return Promise.resolve([]);
    });

    mockPrisma.robot.findMany.mockResolvedValue([robotA, robotB, robotC]);

    // All robots subscribed
    mockPrisma.subscription.findMany.mockResolvedValue([
      { robotId: 1 },
      { robotId: 2 },
      { robotId: 3 },
    ]);

    const scheduledFor = new Date('2024-06-15T08:00:00Z');
    await runMatchmakingForTier('bronze', scheduledFor);

    // Verify the createMatch calls
    const createMatchCalls = (schedulingService.createMatch as jest.Mock).mock.calls;

    // Should have created matches (either 1 real + 1 bye, or 1 real depending on odd/even)
    expect(createMatchCalls.length).toBeGreaterThanOrEqual(1);

    // Find the non-bye match
    const realMatch = createMatchCalls.find(
      (call: any) => !call[0].isByeMatch
    );
    expect(realMatch).toBeDefined();

    const participants = realMatch![0].participants;
    const participantIds = participants.map((p: any) => p.participantId).sort();

    // Robot A (id=1, LP 50) should be paired with Robot C (id=3, LP 20)
    // because Robot A processes first (highest LP) and Robot C is closest in LP
    // LP diff A→C: |50-20| = 30 (score: 30×20 = 600)
    // LP diff A→B: |50-5| = 45 (score: 45×20 = 900)
    expect(participantIds).toEqual([1, 3]);
  });

  it('should not let high-ELO/low-LP robots steal opponents from high-LP robots', async () => {
    // 4 robots: the high-LP leader should get a fair match, not be left with scraps
    const leader = makeRobot(1, 850, 101); // LP 60, low ELO — the instance leader
    const challenger = makeRobot(2, 840, 102); // LP 55, low ELO — should be leader's match
    const highElo1 = makeRobot(3, 1500, 103); // LP 10, high ELO
    const highElo2 = makeRobot(4, 1450, 104); // LP 8, high ELO

    mockPrisma.standing.findMany.mockImplementation((args: any) => {
      if (args?.distinct) {
        return Promise.resolve([{ leagueInstanceId: 'bronze_1' }]);
      }
      if (args?.where?.leagueInstanceId === 'bronze_1') {
        return Promise.resolve([
          { entityId: 1, leaguePoints: 60 },
          { entityId: 2, leaguePoints: 55 },
          { entityId: 3, leaguePoints: 10 },
          { entityId: 4, leaguePoints: 8 },
        ]);
      }
      if (args?.where?.entityId) {
        return Promise.resolve([
          { entityId: 1, leaguePoints: 60 },
          { entityId: 2, leaguePoints: 55 },
          { entityId: 3, leaguePoints: 10 },
          { entityId: 4, leaguePoints: 8 },
        ]);
      }
      return Promise.resolve([]);
    });

    mockPrisma.robot.findMany.mockResolvedValue([leader, challenger, highElo1, highElo2]);
    mockPrisma.subscription.findMany.mockResolvedValue([
      { robotId: 1 }, { robotId: 2 }, { robotId: 3 }, { robotId: 4 },
    ]);

    const scheduledFor = new Date('2024-06-15T08:00:00Z');
    await runMatchmakingForTier('bronze', scheduledFor);

    const createMatchCalls = (schedulingService.createMatch as jest.Mock).mock.calls;
    expect(createMatchCalls).toHaveLength(2); // 4 robots = 2 matches, no bye

    // Find the match containing robot 1 (leader)
    const leaderMatch = createMatchCalls.find((call: any) =>
      call[0].participants.some((p: any) => p.participantId === 1)
    );
    expect(leaderMatch).toBeDefined();

    const leaderOpponent = leaderMatch![0].participants
      .map((p: any) => p.participantId)
      .find((id: number) => id !== 1);

    // Leader (LP 60) should be matched with challenger (LP 55) — closest LP
    expect(leaderOpponent).toBe(2);

    // The two high-ELO robots should be matched together
    const otherMatch = createMatchCalls.find((call: any) =>
      call[0].participants.some((p: any) => p.participantId === 3)
    );
    const otherParticipants = otherMatch![0].participants
      .map((p: any) => p.participantId)
      .sort();
    expect(otherParticipants).toEqual([3, 4]);
  });
});
