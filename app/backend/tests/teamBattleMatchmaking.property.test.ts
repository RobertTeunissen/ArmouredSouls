/**
 * Property-Based Tests for Team Battle Matchmaking
 *
 * Tests the matchmaking guarantee (Property 10): for K ≥ 2 eligible teams,
 * produce ⌊K/2⌋ real matches and at most 1 bye (only when K is odd).
 *
 * This is a unit-level property test that mocks the database layer to test
 * the `pairTeams` function directly with generated team data.
 *
 * @module tests/teamBattleMatchmaking.property.test
 */

import * as fc from 'fast-check';
import { Prisma } from '../generated/prisma';

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock prisma before importing the service
const mockPrisma = {
  scheduledTeamBattleMatch: {
    findMany: jest.fn().mockResolvedValue([]),
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
    create: jest.fn().mockResolvedValue({}),
  },
  scheduledMatch: {
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 1 }),
    findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 1, participants: [] }),
  },
  scheduledMatchParticipant: {
    findMany: jest.fn().mockResolvedValue([]),
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  standing: {
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
  },
  teamBattle: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  subscription: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  $transaction: jest.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma)),
};

jest.mock('../src/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('../src/config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../src/services/analytics/matchmakingService', () => ({
  __esModule: true,
  checkSchedulingReadiness: jest.fn().mockReturnValue({ isReady: true, reasons: [], hpCheck: true, weaponCheck: true }),
}));

jest.mock('../src/services/subscription/subscriptionService', () => ({
  __esModule: true,
  batchActivatePendingSubscriptions: jest.fn().mockResolvedValue(undefined),
}));

// ── Import after mocks ───────────────────────────────────────────────────────

import { pairTeams, TeamBattleWithMembers } from '../src/services/team-battle/teamBattleMatchmakingService';
import { Robot, TeamBattle, TeamBattleMember } from '../generated/prisma';

// ── Generators ───────────────────────────────────────────────────────────────

/**
 * Create a mock Robot with the given ID and ELO.
 */
function createMockRobot(id: number, elo: number = 1000): Robot {
  return {
    id,
    userId: Math.ceil(id / 3), // Group robots by stable
    name: `Robot-${id}`,
    frameId: 1,
    paintJob: null,
    imageUrl: null,
    combatPower: new Prisma.Decimal(20),
    targetingSystems: new Prisma.Decimal(20),
    criticalSystems: new Prisma.Decimal(10),
    penetration: new Prisma.Decimal(10),
    weaponControl: new Prisma.Decimal(15),
    attackSpeed: new Prisma.Decimal(15),
    armorPlating: new Prisma.Decimal(15),
    shieldCapacity: new Prisma.Decimal(10),
    evasionThrusters: new Prisma.Decimal(8),
    damageDampeners: new Prisma.Decimal(8),
    counterProtocols: new Prisma.Decimal(8),
    hullIntegrity: new Prisma.Decimal(20),
    servoMotors: new Prisma.Decimal(15),
    gyroStabilizers: new Prisma.Decimal(10),
    hydraulicSystems: new Prisma.Decimal(10),
    powerCore: new Prisma.Decimal(10),
    combatAlgorithms: new Prisma.Decimal(15),
    threatAnalysis: new Prisma.Decimal(10),
    adaptiveAI: new Prisma.Decimal(8),
    logicCores: new Prisma.Decimal(10),
    syncProtocols: new Prisma.Decimal(5),
    supportSystems: new Prisma.Decimal(5),
    formationTactics: new Prisma.Decimal(5),
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
    repairCost: 0,
    battleReadiness: 100,
    totalRepairsPaid: 0,
    yieldThreshold: 10,
    loadoutType: 'single',
    stance: 'balanced',
    offensiveWins: 0,
    defensiveWins: 0,
    balancedWins: 0,
    dualWieldWins: 0,
    grandMeleeWins: 0,
    grandMeleeTop3: 0,
    mainWeaponId: 1,
    offhandWeaponId: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };
}

/**
 * Create a mock TeamBattleWithMembers object.
 */
function createMockTeam(
  teamId: number,
  stableId: number,
  teamSize: 2 | 3,
  lp: number,
  memberElos: number[],
): TeamBattleWithMembers {
  const members: (TeamBattleMember & { robot: Robot })[] = memberElos.map((elo, idx) => ({
    id: teamId * 100 + idx,
    teamId,
    robotId: teamId * 100 + idx,
    slotIndex: idx,
    robot: createMockRobot(teamId * 100 + idx, elo),
  }));

  return {
    id: teamId,
    stableId,
    teamSize,
    teamName: `Team-${teamId}`,
    eligibility: 'ELIGIBLE',
    createdAt: new Date(Date.now() - teamId * 1000), // Unique creation timestamps for tie-breaking
    updatedAt: new Date(),
    members,
  };
}

/**
 * fast-check arbitrary for generating an array of TeamBattleWithMembers.
 * Generates between 2 and 20 teams with varying LP and ELO values.
 */
function teamArrayArbitrary(teamSize: 2 | 3): fc.Arbitrary<TeamBattleWithMembers[]> {
  return fc.integer({ min: 2, max: 20 }).chain((teamCount) =>
    fc.tuple(
      fc.array(fc.integer({ min: 0, max: 100 }), { minLength: teamCount, maxLength: teamCount }),
      fc.array(
        fc.array(fc.integer({ min: 800, max: 1500 }), { minLength: teamSize, maxLength: teamSize }),
        { minLength: teamCount, maxLength: teamCount },
      ),
    ).map(([lps, eloArrays]) =>
      lps.map((lp, idx) =>
        createMockTeam(idx + 1, idx + 1, teamSize, lp, eloArrays[idx]),
      ),
    ),
  );
}

// ── Property Tests ───────────────────────────────────────────────────────────

describe('Team Battle Matchmaking Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock returns empty recent opponents (no DB data)
    mockPrisma.scheduledTeamBattleMatch.findMany.mockResolvedValue([]);
  });

  /**
   * Property 10: Matchmaking Guarantee (No Unnecessary Byes)
   *
   * **Validates: Requirements R4.1, R4.3**
   *
   * For K ≥ 2 eligible teams:
   * 1. Number of real matches (non-bye) = ⌊K/2⌋
   * 2. Number of bye matches ≤ 1
   * 3. Bye match only when K is odd
   */
  describe('Property 10: Matchmaking Guarantee (No Unnecessary Byes)', () => {
    /**
     * **Validates: Requirements R4.1, R4.3**
     *
     * For K ≥ 2 eligible teams in 2v2 mode, the matchmaker produces exactly
     * ⌊K/2⌋ real matches and at most 1 bye (only when K is odd).
     */
    it('should produce ⌊K/2⌋ real matches and at most 1 bye for 2v2 teams', async () => {
      await fc.assert(
        fc.asyncProperty(
          teamArrayArbitrary(2),
          async (teams) => {
            const K = teams.length;

            const matches = await pairTeams(teams, 2, 'bronze', 'bronze_1');

            // Count real matches vs bye matches
            const realMatches = matches.filter(m => !m.isByeMatch);
            const byeMatches = matches.filter(m => m.isByeMatch);

            // Property 1: Number of real matches = ⌊K/2⌋
            expect(realMatches.length).toBe(Math.floor(K / 2));

            // Property 2: Number of bye matches ≤ 1
            expect(byeMatches.length).toBeLessThanOrEqual(1);

            // Property 3: Bye match only when K is odd
            if (K % 2 === 0) {
              expect(byeMatches.length).toBe(0);
            } else {
              expect(byeMatches.length).toBe(1);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    /**
     * **Validates: Requirements R4.1, R4.3**
     *
     * For K ≥ 2 eligible teams in 3v3 mode, the matchmaker produces exactly
     * ⌊K/2⌋ real matches and at most 1 bye (only when K is odd).
     */
    it('should produce ⌊K/2⌋ real matches and at most 1 bye for 3v3 teams', async () => {
      await fc.assert(
        fc.asyncProperty(
          teamArrayArbitrary(3),
          async (teams) => {
            const K = teams.length;

            const matches = await pairTeams(teams, 3, 'bronze', 'bronze_1');

            // Count real matches vs bye matches
            const realMatches = matches.filter(m => !m.isByeMatch);
            const byeMatches = matches.filter(m => m.isByeMatch);

            // Property 1: Number of real matches = ⌊K/2⌋
            expect(realMatches.length).toBe(Math.floor(K / 2));

            // Property 2: Number of bye matches ≤ 1
            expect(byeMatches.length).toBeLessThanOrEqual(1);

            // Property 3: Bye match only when K is odd
            if (K % 2 === 0) {
              expect(byeMatches.length).toBe(0);
            } else {
              expect(byeMatches.length).toBe(1);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    /**
     * **Validates: Requirements R4.1, R4.3**
     *
     * Every team appears in exactly one match (either real or bye).
     * No team is left unmatched and no team appears in multiple matches.
     */
    it('should assign every team to exactly one match', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(2 as const, 3 as const),
          fc.oneof(teamArrayArbitrary(2), teamArrayArbitrary(3)),
          async (teamSize, teams) => {
            // Regenerate teams with correct teamSize to match the parameter
            const correctTeams = teams.map((t, idx) =>
              createMockTeam(idx + 1, idx + 1, teamSize, 0, t.members.map(m => m.robot.elo)),
            );

            const matches = await pairTeams(correctTeams, teamSize, 'bronze', 'bronze_1');

            // Collect all team IDs that appear in matches
            const matchedTeamIds = new Set<number>();
            for (const match of matches) {
              matchedTeamIds.add(match.team1.id);
              if (!match.isByeMatch) {
                matchedTeamIds.add(match.team2.id);
              }
            }

            // Every input team should appear exactly once
            const inputTeamIds = new Set(correctTeams.map(t => t.id));
            expect(matchedTeamIds).toEqual(inputTeamIds);
          },
        ),
        { numRuns: 100 },
      );
    });

    /**
     * **Validates: Requirements R4.1, R4.3**
     *
     * Total matches (real + bye) = ⌈K/2⌉ — every team gets exactly one match slot.
     */
    it('should produce ⌈K/2⌉ total matches', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(2 as const, 3 as const),
          fc.oneof(teamArrayArbitrary(2), teamArrayArbitrary(3)),
          async (teamSize, teams) => {
            const correctTeams = teams.map((t, idx) =>
              createMockTeam(idx + 1, idx + 1, teamSize, 0, t.members.map(m => m.robot.elo)),
            );
            const K = correctTeams.length;

            const matches = await pairTeams(correctTeams, teamSize, 'bronze', 'bronze_1');

            // Total matches = ⌈K/2⌉
            expect(matches.length).toBe(Math.ceil(K / 2));
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
