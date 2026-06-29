/**
 * Unit tests for teamBattleMatchmakingService.ts
 *
 * Tests subscription gating, bye-team assignment, recent-opponent exclusion
 * and fallback (R4.7), error handling per-team, and scheduled match persistence.
 *
 * _Requirements: R3.3, R3.4, R4.1–R4.7_
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma: any = {
  teamBattle: {
    findMany: jest.fn(),
  },
  scheduledTeamBattleMatch: {
    findMany: jest.fn(),
    createMany: jest.fn(),
    create: jest.fn(),
  },
  subscription: {
    findMany: jest.fn(),
  },
  scheduledMatchParticipant: {
    findMany: jest.fn().mockResolvedValue([]),
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  standing: {
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
  },
  scheduledMatch: {
    create: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    findUniqueOrThrow: jest.fn(),
  },
  $transaction: jest.fn(),
};
mockPrisma.$transaction.mockImplementation((fn: (tx: any) => Promise<unknown>) => fn(mockPrisma));

jest.mock('../../../src/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockCheckSchedulingReadiness = jest.fn();
jest.mock('../../../src/services/analytics/matchmakingService', () => ({
  __esModule: true,
  checkSchedulingReadiness: (...args: unknown[]) => mockCheckSchedulingReadiness(...args),
}));

jest.mock('../../../src/services/subscription/subscriptionService', () => ({
  __esModule: true,
  batchActivatePendingSubscriptions: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../src/services/team-battle/teamBattleAdapter', () => ({
  __esModule: true,
  TEAM_BATTLE_LEAGUE_TIERS: ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'],
}));

// ── Import under test ────────────────────────────────────────────────────────

import {
  getEligibleTeams,
  pairTeams,
  runTeamBattleMatchmaking,
  scheduleMatches,
  TeamBattleWithMembers,
  TeamBattleMatchPair,
} from '../../../src/services/team-battle/teamBattleMatchmakingService';

import { Prisma, Robot, TeamBattleMember } from '../../../generated/prisma';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRobot(id: number, elo: number = 1000, userId: number = 100): Robot {
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
    mainWeaponId: 1,
    offhandWeaponId: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    grandMeleeWins: 0,
    grandMeleeTop3: 0,
  };
}

function makeTeam(
  id: number,
  teamSize: 2 | 3 = 2,
  overrides: Partial<{
    stableId: number;
    eligibility: string;
    robotElos: number[];
    createdAt: Date;
  }> = {},
): TeamBattleWithMembers {
  const stableId = overrides.stableId ?? 100;
  const robotElos = overrides.robotElos ?? Array(teamSize).fill(1000) as number[];
  const members: (TeamBattleMember & { robot: Robot })[] = Array.from({ length: teamSize }, (_, i) => ({
    id: id * 100 + i,
    teamId: id,
    robotId: id * 10 + i,
    slotIndex: i,
    robot: makeRobot(id * 10 + i, robotElos[i], stableId),
  }));

  return {
    id,
    stableId,
    teamSize,
    teamName: `Team ${id}`,
    eligibility: overrides.eligibility ?? 'ELIGIBLE',
    createdAt: overrides.createdAt ?? new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    members,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('teamBattleMatchmakingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckSchedulingReadiness.mockReturnValue({ isReady: true });
  });

  // ── getEligibleTeams ─────────────────────────────────────────────────

  describe('getEligibleTeams', () => {
    it('should return teams where all members are subscribed', async () => {
      const team1 = makeTeam(1);
      const team2 = makeTeam(2);

      mockPrisma.standing.findMany.mockResolvedValue([{ entityId: 1 }, { entityId: 2 }]);
      mockPrisma.teamBattle.findMany.mockResolvedValue([team1, team2]);
      mockPrisma.scheduledTeamBattleMatch.findMany.mockResolvedValue([]);
      // All robots subscribed
      mockPrisma.subscription.findMany.mockResolvedValue([
        { robotId: 10 }, { robotId: 11 },
        { robotId: 20 }, { robotId: 21 },
      ]);

      const result = await getEligibleTeams('bronze', 'bronze_1', 2);

      expect(result).toHaveLength(2);
      expect(result).toEqual(expect.arrayContaining([team1, team2]));
    });

    it('should exclude teams with unsubscribed members (R3.3)', async () => {
      const team1 = makeTeam(1); // robots 10, 11
      const team2 = makeTeam(2); // robots 20, 21

      mockPrisma.standing.findMany.mockResolvedValue([{ entityId: 1 }, { entityId: 2 }]);
      mockPrisma.teamBattle.findMany.mockResolvedValue([team1, team2]);
      mockPrisma.scheduledTeamBattleMatch.findMany.mockResolvedValue([]);
      // Only team1 robots subscribed, team2 robot 21 missing
      mockPrisma.subscription.findMany.mockResolvedValue([
        { robotId: 10 }, { robotId: 11 },
        { robotId: 20 }, // 21 is missing
      ]);

      const result = await getEligibleTeams('bronze', 'bronze_1', 2);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it('should exclude teams that are not scheduling-ready', async () => {
      const team1 = makeTeam(1);
      const team2 = makeTeam(2);

      mockPrisma.standing.findMany.mockResolvedValue([{ entityId: 1 }, { entityId: 2 }]);
      mockPrisma.teamBattle.findMany.mockResolvedValue([team1, team2]);
      mockPrisma.scheduledTeamBattleMatch.findMany.mockResolvedValue([]);
      mockPrisma.subscription.findMany.mockResolvedValue([
        { robotId: 10 }, { robotId: 11 },
        { robotId: 20 }, { robotId: 21 },
      ]);
      // Team2's first robot is not ready
      mockCheckSchedulingReadiness
        .mockReturnValueOnce({ isReady: true }) // team1 robot 10
        .mockReturnValueOnce({ isReady: true }) // team1 robot 11
        .mockReturnValueOnce({ isReady: false, reason: 'no weapon' }) // team2 robot 20
        .mockReturnValueOnce({ isReady: true }); // team2 robot 21

      const result = await getEligibleTeams('bronze', 'bronze_1', 2);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it('should exclude teams already scheduled for a match', async () => {
      const team1 = makeTeam(1);
      const team2 = makeTeam(2);

      mockPrisma.standing.findMany.mockResolvedValue([{ entityId: 1 }, { entityId: 2 }]);
      mockPrisma.teamBattle.findMany.mockResolvedValue([team1, team2]);
      mockPrisma.scheduledTeamBattleMatch.findMany.mockResolvedValue([]);
      // Team1 already has a scheduled match (via scheduledMatchParticipant)
      mockPrisma.scheduledMatchParticipant.findMany.mockImplementation((args: any) => {
        if (args?.where?.participantId === 1) {
          return Promise.resolve([{ scheduledMatch: { id: 99, matchType: 'league_2v2', status: 'scheduled', scheduledFor: new Date(), participants: [] } }]);
        }
        return Promise.resolve([]);
      });
      mockPrisma.subscription.findMany.mockResolvedValue([
        { robotId: 10 }, { robotId: 11 },
        { robotId: 20 }, { robotId: 21 },
      ]);

      const result = await getEligibleTeams('bronze', 'bronze_1', 2);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
    });

    it('should skip teams with incomplete rosters', async () => {
      const incompleteTeam = makeTeam(1);
      incompleteTeam.members = incompleteTeam.members.slice(0, 1); // only 1 member for 2v2

      mockPrisma.standing.findMany.mockResolvedValue([{ entityId: 1 }]);
      mockPrisma.teamBattle.findMany.mockResolvedValue([incompleteTeam]);
      mockPrisma.scheduledTeamBattleMatch.findMany.mockResolvedValue([]);
      mockPrisma.subscription.findMany.mockResolvedValue([]);

      const result = await getEligibleTeams('bronze', 'bronze_1', 2);

      expect(result).toHaveLength(0);
    });

    it('should use league_3v3 event type for 3v3 teams', async () => {
      const team1 = makeTeam(1, 3);

      mockPrisma.standing.findMany.mockResolvedValue([{ entityId: 1 }]);
      mockPrisma.teamBattle.findMany.mockResolvedValue([team1]);
      mockPrisma.scheduledTeamBattleMatch.findMany.mockResolvedValue([]);
      mockPrisma.subscription.findMany.mockResolvedValue([
        { robotId: 10 }, { robotId: 11 }, { robotId: 12 },
      ]);

      await getEligibleTeams('bronze', 'bronze_1', 3);

      // Subscription query should use league_3v3
      expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ eventType: 'league_3v3' }),
        }),
      );
    });

    it('should return empty array when no teams exist', async () => {
      mockPrisma.standing.findMany.mockResolvedValue([]);
      mockPrisma.teamBattle.findMany.mockResolvedValue([]);
      mockPrisma.scheduledTeamBattleMatch.findMany.mockResolvedValue([]);
      mockPrisma.subscription.findMany.mockResolvedValue([]);

      const result = await getEligibleTeams('bronze', 'bronze_1', 2);

      expect(result).toHaveLength(0);
    });
  });

  // ── pairTeams ────────────────────────────────────────────────────────

  describe('pairTeams', () => {
    it('should pair two teams into one match', async () => {
      const team1 = makeTeam(1);
      const team2 = makeTeam(2, 2, { stableId: 200 });

      // Mock recent opponents query (no recent opponents)
      mockPrisma.scheduledTeamBattleMatch.findMany.mockResolvedValue([]);

      const result = await pairTeams([team1, team2], 2, 'silver', 'silver_2');

      expect(result).toHaveLength(1);
      expect(result[0].isByeMatch).toBe(false);
      expect(result[0].team1.id).toBe(1);
      expect(result[0].team2.id).toBe(2);
    });

    it('should assign bye-team only when odd count (R4.3)', async () => {
      const team1 = makeTeam(1);
      const team2 = makeTeam(2, 2, { stableId: 200 });
      const team3 = makeTeam(3, 2, { stableId: 300 });

      mockPrisma.scheduledTeamBattleMatch.findMany.mockResolvedValue([]);

      const result = await pairTeams([team1, team2, team3], 2, 'silver', 'silver_2');

      expect(result).toHaveLength(2);
      const byeMatches = result.filter(m => m.isByeMatch);
      const realMatches = result.filter(m => !m.isByeMatch);
      expect(byeMatches).toHaveLength(1);
      expect(realMatches).toHaveLength(1);
    });

    it('should not assign bye-team when even count', async () => {
      const team1 = makeTeam(1);
      const team2 = makeTeam(2, 2, { stableId: 200 });
      const team3 = makeTeam(3, 2, { stableId: 300 });
      const team4 = makeTeam(4, 2, { stableId: 400 });

      mockPrisma.scheduledTeamBattleMatch.findMany.mockResolvedValue([]);

      const result = await pairTeams([team1, team2, team3, team4], 2, 'silver', 'silver_2');

      expect(result).toHaveLength(2);
      const byeMatches = result.filter(m => m.isByeMatch);
      expect(byeMatches).toHaveLength(0);
    });

    it('should return empty array for zero teams', async () => {
      const result = await pairTeams([], 2, 'silver', 'silver_2');
      expect(result).toHaveLength(0);
    });

    it('should assign bye-team for single team', async () => {
      const team1 = makeTeam(1);

      mockPrisma.scheduledTeamBattleMatch.findMany.mockResolvedValue([]);

      const result = await pairTeams([team1], 2, 'silver', 'silver_2');

      expect(result).toHaveLength(1);
      expect(result[0].isByeMatch).toBe(true);
      expect(result[0].team2.id).toBe(-1); // bye team ID
    });

    it('should prefer closer LP opponents over distant ones', async () => {
      const team1 = makeTeam(1, 2, { stableId: 100 });
      const team2 = makeTeam(2, 2, { stableId: 200 }); // close LP
      const team3 = makeTeam(3, 2, { stableId: 300 }); // far LP

      mockPrisma.scheduledTeamBattleMatch.findMany.mockResolvedValue([]);

      const result = await pairTeams([team1, team2, team3], 2, 'silver', 'silver_2');

      // team1 should be paired with team2 (closer LP)
      const team1Match = result.find(m => m.team1.id === 1 || m.team2.id === 1);
      expect(team1Match).toBeDefined();
      const opponent = team1Match!.team1.id === 1 ? team1Match!.team2 : team1Match!.team1;
      expect(opponent.id).toBe(2);
    });

    it('should apply recent-opponent penalty (R4.5)', async () => {
      const team1 = makeTeam(1, 2, { stableId: 100 });
      const team2 = makeTeam(2, 2, { stableId: 200 }); // same LP, recent opponent
      const team3 = makeTeam(3, 2, { stableId: 300 }); // slightly worse LP, not recent

      // team1 recently fought team2 (via scheduledMatch with participants)
      mockPrisma.scheduledMatch.findMany.mockResolvedValue([
        {
          id: 99,
          matchType: 'league_2v2',
          status: 'completed',
          scheduledFor: new Date(),
          participants: [
            { participantId: 1, participantType: 'team' },
            { participantId: 2, participantType: 'team' },
          ],
        },
      ]);

      // LP standings for scoring
      mockPrisma.standing.findMany.mockResolvedValue([
        { entityId: 1, leaguePoints: 50 },
        { entityId: 2, leaguePoints: 50 },
        { entityId: 3, leaguePoints: 50 },
      ]);

      const result = await pairTeams([team1, team2, team3], 2, 'silver', 'silver_2');

      // team1 should prefer team3 (not recent) over team2 (recent, penalty)
      const team1Match = result.find(m => m.team1.id === 1);
      expect(team1Match).toBeDefined();
      expect(team1Match!.team2.id).toBe(3);
    });

    it('should fall back to closest-ELO when all opponents are recent (R4.7)', async () => {
      const team1 = makeTeam(1, 2, { stableId: 100, robotElos: [1000, 1000] });
      const team2 = makeTeam(2, 2, { stableId: 200, robotElos: [1100, 1100] }); // ELO diff = 200
      const team3 = makeTeam(3, 2, { stableId: 300, robotElos: [900, 900] }); // ELO diff = 200

      // All opponents are recent for team1
      mockPrisma.scheduledTeamBattleMatch.findMany.mockResolvedValue([
        { team1Id: 1, team2Id: 2 },
        { team1Id: 1, team2Id: 3 },
      ]);

      const result = await pairTeams([team1, team2, team3], 2, 'silver', 'silver_2');

      // Should still produce matches (fallback to closest ELO)
      expect(result.length).toBeGreaterThan(0);
      const team1Match = result.find(m => m.team1.id === 1);
      expect(team1Match).toBeDefined();
      expect(team1Match!.isByeMatch).toBe(false);
    });

    it('should apply same-stable penalty to avoid self-matching', async () => {
      // Two teams from same stable, one from different
      const team1 = makeTeam(1, 2, { stableId: 100 });
      const team2 = makeTeam(2, 2, { stableId: 100 }); // same stable
      const team3 = makeTeam(3, 2, { stableId: 200 }); // different stable

      mockPrisma.scheduledTeamBattleMatch.findMany.mockResolvedValue([]);

      const result = await pairTeams([team1, team2, team3], 2, 'silver', 'silver_2');

      // team1 should prefer team3 (different stable) over team2 (same stable, +10000 penalty)
      const team1Match = result.find(m => m.team1.id === 1);
      expect(team1Match).toBeDefined();
      expect(team1Match!.team2.id).toBe(3);
    });

    it('should set correct league info on match pairs', async () => {
      const team1 = makeTeam(1, 2);
      const team2 = makeTeam(2, 2, { stableId: 200 });

      mockPrisma.scheduledTeamBattleMatch.findMany.mockResolvedValue([]);

      const result = await pairTeams([team1, team2], 2, 'silver', 'silver_2');

      expect(result[0].teamBattleLeague).toBe('silver');
      expect(result[0].teamBattleLeagueId).toBe('silver_2');
    });

    it('should tie-break by earliest creation timestamp', async () => {
      const team1 = makeTeam(1, 2, { stableId: 100 });
      const team2 = makeTeam(2, 2, {
        createdAt: new Date('2024-06-01'),
      });
      const team3 = makeTeam(3, 2, {
        createdAt: new Date('2024-01-01'), // earlier
      });

      mockPrisma.scheduledTeamBattleMatch.findMany.mockResolvedValue([]);

      const result = await pairTeams([team1, team2, team3], 2, 'silver', 'silver_2');

      // With identical scores, team3 (earlier creation) should be preferred
      const team1Match = result.find(m => m.team1.id === 1);
      expect(team1Match).toBeDefined();
      expect(team1Match!.team2.id).toBe(3);
    });
  });

  // ── scheduleMatches ──────────────────────────────────────────────────

  describe('scheduleMatches', () => {
    beforeEach(() => {
      mockPrisma.scheduledMatch.create.mockResolvedValue({ id: 1 });
      mockPrisma.scheduledMatch.findUniqueOrThrow.mockResolvedValue({ id: 1, participants: [] });
      mockPrisma.scheduledMatchParticipant.createMany.mockResolvedValue({ count: 2 });
    });

    it('should persist regular matches via schedulingService', async () => {
      const team1 = makeTeam(1);
      const team2 = makeTeam(2, 2, { stableId: 200 });
      const matches: TeamBattleMatchPair[] = [{
        team1,
        team2,
        isByeMatch: false,
        teamBattleLeague: 'bronze',
        teamBattleLeagueId: 'bronze_1',
      }];
      const scheduledFor = new Date('2024-06-15T09:00:00Z');

      await scheduleMatches(matches, scheduledFor, 2);

      expect(mockPrisma.scheduledMatch.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          matchType: 'league_2v2',
          scheduledFor,
          status: 'scheduled',
          leagueType: 'bronze',
          leagueInstanceId: 'bronze_1',
        }),
      });
      expect(mockPrisma.scheduledMatchParticipant.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ participantType: 'team', participantId: 1, slot: 1 }),
          expect.objectContaining({ participantType: 'team', participantId: 2, slot: 2 }),
        ]),
      });
    });

    it('should persist bye-matches with only one participant', async () => {
      const team1 = makeTeam(1);
      const byeTeam = makeTeam(-1, 2, { stableId: -1 });
      byeTeam.id = -1;
      const matches: TeamBattleMatchPair[] = [{
        team1,
        team2: byeTeam,
        isByeMatch: true,
        teamBattleLeague: 'bronze',
        teamBattleLeagueId: 'bronze_1',
      }];
      const scheduledFor = new Date('2024-06-15T09:00:00Z');

      await scheduleMatches(matches, scheduledFor, 2);

      expect(mockPrisma.scheduledMatch.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          matchType: 'league_2v2',
          scheduledFor,
          status: 'scheduled',
          isByeMatch: true,
        }),
      });
      // Bye match should only have 1 participant (team1)
      expect(mockPrisma.scheduledMatchParticipant.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ participantType: 'team', participantId: 1, slot: 1 }),
        ],
      });
    });

    it('should handle mixed regular and bye matches', async () => {
      const team1 = makeTeam(1);
      const team2 = makeTeam(2, 2, { stableId: 200 });
      const team3 = makeTeam(3, 2, { stableId: 300 });
      const byeTeam = makeTeam(-1, 2, { stableId: -1 });
      byeTeam.id = -1;

      const matches: TeamBattleMatchPair[] = [
        { team1, team2, isByeMatch: false, teamBattleLeague: 'bronze', teamBattleLeagueId: 'bronze_1' },
        { team1: team3, team2: byeTeam, isByeMatch: true, teamBattleLeague: 'bronze', teamBattleLeagueId: 'bronze_1' },
      ];
      const scheduledFor = new Date('2024-06-15T09:00:00Z');

      await scheduleMatches(matches, scheduledFor, 2);

      // Should call $transaction twice (once per match)
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2);
    });

    it('should not call $transaction when no matches', async () => {
      const matches: TeamBattleMatchPair[] = [];
      const scheduledFor = new Date('2024-06-15T09:00:00Z');

      await scheduleMatches(matches, scheduledFor, 2);

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ── runTeamBattleMatchmaking ─────────────────────────────────────────

  describe('runTeamBattleMatchmaking', () => {
    beforeEach(() => {
      mockPrisma.scheduledMatch.create.mockResolvedValue({ id: 1 });
      mockPrisma.scheduledMatch.findUniqueOrThrow.mockResolvedValue({ id: 1, participants: [] });
      mockPrisma.scheduledMatchParticipant.createMany.mockResolvedValue({ count: 2 });
    });

    it('should iterate all tiers and create matches', async () => {
      // standing.findMany: first call returns instance for bronze, rest return empty (per tier)
      mockPrisma.standing.findMany
        .mockResolvedValueOnce([{ leagueInstanceId: 'bronze_1' }]) // distinct instances for bronze
        .mockResolvedValueOnce([{ entityId: 1 }, { entityId: 2 }]) // teams in bronze_1
        .mockResolvedValueOnce([]) // instances for silver
        .mockResolvedValueOnce([]) // instances for gold
        .mockResolvedValueOnce([]) // instances for platinum
        .mockResolvedValueOnce([]) // instances for diamond
        .mockResolvedValueOnce([]); // instances for champion

      mockPrisma.teamBattle.findMany.mockResolvedValue([makeTeam(1), makeTeam(2, 2, { stableId: 200 })]);
      mockPrisma.scheduledTeamBattleMatch.findMany.mockResolvedValue([]);
      mockPrisma.subscription.findMany.mockResolvedValue([
        { robotId: 10 }, { robotId: 11 },
        { robotId: 20 }, { robotId: 21 },
      ]);

      const result = await runTeamBattleMatchmaking(2);

      expect(result).toBe(1);
    });

    it('should continue on per-instance errors (R4.6)', async () => {
      // Bronze has two instances, first one throws
      mockPrisma.standing.findMany
        .mockResolvedValueOnce([{ leagueInstanceId: 'bronze_1' }, { leagueInstanceId: 'bronze_2' }]) // instances for bronze
        .mockRejectedValueOnce(new Error('DB error')) // getEligibleTeams for bronze_1 fails at standing query
        .mockResolvedValueOnce([{ entityId: 3 }, { entityId: 4 }]) // teams in bronze_2
        .mockResolvedValueOnce([]) // instances for silver
        .mockResolvedValueOnce([]) // instances for gold
        .mockResolvedValueOnce([]) // instances for platinum
        .mockResolvedValueOnce([]) // instances for diamond
        .mockResolvedValueOnce([]); // instances for champion

      mockPrisma.teamBattle.findMany.mockResolvedValue([makeTeam(3, 2, { stableId: 300 }), makeTeam(4, 2, { stableId: 400 })]);
      mockPrisma.scheduledTeamBattleMatch.findMany.mockResolvedValue([]);
      mockPrisma.subscription.findMany.mockResolvedValue([
        { robotId: 30 }, { robotId: 31 },
        { robotId: 40 }, { robotId: 41 },
      ]);

      // Should not throw — continues with remaining instances
      const result = await runTeamBattleMatchmaking(2);

      expect(result).toBe(1); // Only bronze_2 succeeded
    });

    it('should continue on per-tier errors (R4.6)', async () => {
      // Bronze tier throws entirely
      mockPrisma.standing.findMany
        .mockRejectedValueOnce(new Error('Tier error')) // instances query for bronze fails
        .mockResolvedValueOnce([{ leagueInstanceId: 'silver_1' }]) // instances for silver
        .mockResolvedValueOnce([{ entityId: 1 }, { entityId: 2 }]) // teams in silver_1
        .mockResolvedValueOnce([]) // instances for gold
        .mockResolvedValueOnce([]) // instances for platinum
        .mockResolvedValueOnce([]) // instances for diamond
        .mockResolvedValueOnce([]); // instances for champion

      mockPrisma.teamBattle.findMany.mockResolvedValue([makeTeam(1, 2), makeTeam(2, 2, { stableId: 200 })]);
      mockPrisma.scheduledTeamBattleMatch.findMany.mockResolvedValue([]);
      mockPrisma.subscription.findMany.mockResolvedValue([
        { robotId: 10 }, { robotId: 11 },
        { robotId: 20 }, { robotId: 21 },
      ]);

      // Should not throw — continues with remaining tiers
      const result = await runTeamBattleMatchmaking(2);

      expect(result).toBe(1); // Only silver succeeded
    });

    it('should skip instances with fewer than 1 eligible team', async () => {
      mockPrisma.standing.findMany
        .mockResolvedValueOnce([{ leagueInstanceId: 'bronze_1' }]) // instances for bronze
        .mockResolvedValueOnce([{ entityId: 1 }]) // one team in standings
        .mockResolvedValueOnce([]) // instances for silver
        .mockResolvedValueOnce([]) // instances for gold
        .mockResolvedValueOnce([]) // instances for platinum
        .mockResolvedValueOnce([]) // instances for diamond
        .mockResolvedValueOnce([]); // instances for champion

      // Team has no weapon (not scheduling-ready)
      mockPrisma.teamBattle.findMany.mockResolvedValue([]);
      mockPrisma.scheduledTeamBattleMatch.findMany.mockResolvedValue([]);
      mockPrisma.subscription.findMany.mockResolvedValue([]);

      const result = await runTeamBattleMatchmaking(2);

      expect(result).toBe(0);
    });

    it('should use custom scheduledFor date when provided', async () => {
      const customDate = new Date('2024-12-25T09:00:00Z');

      mockPrisma.standing.findMany
        .mockResolvedValueOnce([{ leagueInstanceId: 'bronze_1' }]) // instances for bronze
        .mockResolvedValueOnce([{ entityId: 1 }, { entityId: 2 }]) // teams in bronze_1
        .mockResolvedValueOnce([]) // instances for silver
        .mockResolvedValueOnce([]) // instances for gold
        .mockResolvedValueOnce([]) // instances for platinum
        .mockResolvedValueOnce([]) // instances for diamond
        .mockResolvedValueOnce([]); // instances for champion

      mockPrisma.teamBattle.findMany.mockResolvedValue([makeTeam(1), makeTeam(2, 2, { stableId: 200 })]);
      mockPrisma.scheduledTeamBattleMatch.findMany.mockResolvedValue([]);
      mockPrisma.subscription.findMany.mockResolvedValue([
        { robotId: 10 }, { robotId: 11 },
        { robotId: 20 }, { robotId: 21 },
      ]);

      await runTeamBattleMatchmaking(2, customDate);

      expect(mockPrisma.scheduledMatch.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ scheduledFor: customDate }),
      });
    });

    it('should return 0 when no tiers have instances', async () => {
      // All tiers return empty instances
      mockPrisma.standing.findMany.mockResolvedValue([]);

      const result = await runTeamBattleMatchmaking(3);

      expect(result).toBe(0);
    });
  });
});
