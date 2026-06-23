import { executeBulkCycles, BulkCycleResult, CycleResult } from '../../../src/services/admin/adminCycleService';
import prisma from '../../../src/lib/prisma';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// Mock all external dependencies
jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../src/utils/cycleLogger', () => ({
  cycleLogger: {
    startCycle: jest.fn(),
    log: jest.fn(),
    endCycle: jest.fn(),
  },
}));

jest.mock('../../../src/services/economy/repairService', () => ({
  repairAllRobots: jest.fn().mockResolvedValue({ robotsRepaired: 0, totalFinalCost: 0 }),
}));

jest.mock('../../../src/services/league/leagueBattleOrchestrator', () => ({
  executeScheduledBattles: jest.fn().mockResolvedValue({ totalBattles: 0 }),
}));

jest.mock('../../../src/services/koth/kothBattleOrchestrator', () => ({
  executeScheduledKothBattles: jest.fn().mockResolvedValue({ totalMatches: 0, successfulMatches: 0, failedMatches: 0 }),
}));

jest.mock('../../../src/services/league/leagueRebalancingService', () => ({
  rebalanceLeagues: jest.fn().mockResolvedValue({ totalPromoted: 0, totalDemoted: 0 }),
  rebalanceKothLeagues: jest.fn().mockResolvedValue({ totalPromoted: 0, totalDemoted: 0 }),
  createStandingsAdapter: jest.fn().mockReturnValue({
    entityType: 'robot',
    getEntitiesWithMinPoints: jest.fn().mockResolvedValue([]),
    countEligibleInInstance: jest.fn().mockResolvedValue(0),
    getEntitiesForDemotion: jest.fn().mockResolvedValue([]),
    getInstancesForTier: jest.fn().mockResolvedValue([]),
    countEntitiesInTier: jest.fn().mockResolvedValue(0),
    countEntitiesInDestinationTier: jest.fn().mockResolvedValue(0),
    assignInstance: jest.fn().mockResolvedValue('bronze_1'),
    updateEntityLeague: jest.fn().mockResolvedValue(undefined),
    getEntityCurrentTier: jest.fn().mockReturnValue('bronze'),
    getEntityLeagueId: jest.fn().mockReturnValue('bronze_1'),
    getEntityLeaguePoints: jest.fn().mockReturnValue(0),
    getEntityOwnerId: jest.fn().mockReturnValue(1),
    getEntityDisplayName: jest.fn().mockReturnValue('entity#1'),
    onPromoted: jest.fn().mockResolvedValue(undefined),
    rebalanceInstances: jest.fn().mockResolvedValue(undefined),
    countAllEntities: jest.fn().mockResolvedValue(0),
  }),
}));

jest.mock('../../../src/services/analytics/matchmakingService', () => ({
  runMatchmaking: jest.fn().mockResolvedValue(0),
}));

jest.mock('../../../src/services/koth/kothMatchmakingService', () => ({
  runKothMatchmaking: jest.fn().mockResolvedValue(0),
}));

jest.mock('../../../src/services/tag-team/tagTeamLeagueRebalancingService', () => ({
  rebalanceTagTeamLeagues: jest.fn().mockResolvedValue({ totalPromoted: 0, totalDemoted: 0 }),
}));

jest.mock('../../../src/services/tag-team/tagTeamMatchmakingService', () => ({
  runTagTeamMatchmaking: jest.fn().mockResolvedValue(0),
}));

jest.mock('../../../src/services/tag-team/tagTeamBattleOrchestrator', () => ({
  executeScheduledTagTeamBattles: jest.fn().mockResolvedValue({ totalBattles: 0 }),
}));

jest.mock('../../../src/services/team-battle/teamBattleOrchestrator', () => ({
  executeScheduledTeamBattles: jest.fn().mockResolvedValue({ matchesCompleted: 0, matchesCancelled: 0, results: [] }),
}));

jest.mock('../../../src/services/team-battle/teamBattleAdapter', () => ({
  rebalanceTeamBattleLeagues: jest.fn().mockResolvedValue({ totalTeams: 0, totalPromoted: 0, totalDemoted: 0, tierSummaries: [], errors: [] }),
}));

jest.mock('../../../src/services/team-battle/teamBattleMatchmakingService', () => ({
  runTeamBattleMatchmaking: jest.fn().mockResolvedValue(0),
}));

jest.mock('../../../src/services/tournament/tournamentService', () => ({
  getActiveTournaments: jest.fn().mockResolvedValue([]),
  getCurrentRoundMatches: jest.fn().mockResolvedValue([]),
  advanceWinnersToNextRound: jest.fn().mockResolvedValue(undefined),
  autoCreateNextTournament: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../../src/services/tournament/tournamentBattleOrchestrator', () => ({
  processTournamentBattle: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../src/services/moderation/orphanCleanupJob', () => ({
  runOrphanCleanup: jest.fn().mockResolvedValue({ filesDeleted: 0, bytesReclaimed: 0 }),
}));

jest.mock('../../../src/utils/userGeneration', () => ({
  generateBattleReadyUsers: jest.fn().mockResolvedValue({ usersCreated: 0 }),
}));

jest.mock('../../../src/services/common/eventLogger', () => ({
  EventLogger: jest.fn().mockImplementation(() => ({
    logCycleStart: jest.fn().mockResolvedValue(undefined),
    logCycleStepComplete: jest.fn().mockResolvedValue(undefined),
    logCycleComplete: jest.fn().mockResolvedValue(undefined),
    logPassiveIncome: jest.fn().mockResolvedValue(undefined),
    logOperatingCosts: jest.fn().mockResolvedValue(undefined),
    logCycleEndBalance: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../../src/services/cycle/cycleSnapshotService', () => ({
  cycleSnapshotService: {
    createSnapshot: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../../src/utils/economyCalculations', () => ({
  calculateDailyPassiveIncome: jest.fn().mockResolvedValue({ total: 0, merchandising: 0 }),
  calculateFacilityOperatingCost: jest.fn().mockReturnValue(0),
}));

jest.mock('../../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    cycleMetadata: {
      findUnique: jest.fn().mockResolvedValue({ id: 1, totalCycles: 5 }),
      create: jest.fn().mockResolvedValue({ id: 1, totalCycles: 0 }),
      update: jest.fn().mockResolvedValue({ id: 1, totalCycles: 6 }),
    },
    user: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(undefined),
    },
    robot: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    tagTeam: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    teamBattle: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    standing: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    facility: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn().mockResolvedValue([]),
  },
}));

describe('Admin Cycle Service — executeBulkCycles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Slot map order and block-based structure', () => {
    it('should execute all 10 events in slot map order and return block-based results', async () => {
      const result: BulkCycleResult = await executeBulkCycles({ cycles: 1 });

      expect(result.success).toBe(true);
      expect(result.cyclesCompleted).toBe(1);
      expect(result.results).toHaveLength(1);

      const cycleResult: CycleResult = result.results[0];

      // Verify all blocks are present in the result
      expect(cycleResult.leagueBlock).toBeDefined();
      expect(cycleResult.team2v2LeagueBlock).toBeDefined();
      expect(cycleResult.tournamentBlock).toBeDefined();
      expect(cycleResult.tagTeamBlock).toBeDefined();
      expect(cycleResult.kothBlock).toBeDefined();
      expect(cycleResult.team3v3LeagueBlock).toBeDefined();
      expect(cycleResult.team2v2TournamentBlock).toBeDefined();
      expect(cycleResult.grandMeleeBlock).toBeDefined();
      expect(cycleResult.team3v3TournamentBlock).toBeDefined();
      expect(cycleResult.settlement).toBeDefined();
    });

    it('should mark reserved slots as skipped with correct message', async () => {
      const result = await executeBulkCycles({ cycles: 1 });
      const cycleResult = result.results[0];

      // Only remaining reserved slots should have skipped: true
      expect(cycleResult.team2v2TournamentBlock).toEqual({ skipped: true, message: 'reserved slot, no handler implemented' });
      expect(cycleResult.grandMeleeBlock).toEqual({ skipped: true, message: 'reserved slot, no handler implemented' });
      expect(cycleResult.team3v3TournamentBlock).toEqual({ skipped: true, message: 'reserved slot, no handler implemented' });
    });

    it('should fire only 3 reserved slots and record them (team 2v2/3v3 league are now active)', async () => {
      const result = await executeBulkCycles({ cycles: 1 });
      const cycleResult = result.results[0];

      expect(cycleResult.reservedSlotsFired).toBeDefined();
      expect(cycleResult.reservedSlotsFired).toContain('team_2v2_tournament');
      expect(cycleResult.reservedSlotsFired).toContain('grand_melee');
      expect(cycleResult.reservedSlotsFired).toContain('team_3v3_tournament');
      expect(cycleResult.reservedSlotsFired).toHaveLength(3);
      // team_2v2_league and team_3v3_league are no longer reserved
      expect(cycleResult.reservedSlotsFired).not.toContain('team_2v2_league');
      expect(cycleResult.reservedSlotsFired).not.toContain('team_3v3_league');
    });
  });

  describe('Tag Team runs every cycle (no parity check)', () => {
    it('should execute tag team on even cycle numbers', async () => {
      // Set to even cycle number
      (mockPrisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue({ id: 1, totalCycles: 4 });

      const result = await executeBulkCycles({ cycles: 1 });
      const cycleResult = result.results[0];

      // Tag team block should be present (not skipped) regardless of cycle parity
      expect(cycleResult.tagTeamBlock).toBeDefined();
      expect(cycleResult.tagTeamBlock!.battles).toBeDefined();
      expect(cycleResult.tagTeamBlock!.rebalancing).toBeDefined();
      expect(cycleResult.tagTeamBlock!.matchmaking).toBeDefined();
    });

    it('should execute tag team on odd cycle numbers', async () => {
      // Set to odd cycle number
      (mockPrisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue({ id: 1, totalCycles: 5 });

      const result = await executeBulkCycles({ cycles: 1 });
      const cycleResult = result.results[0];

      expect(cycleResult.tagTeamBlock).toBeDefined();
      expect(cycleResult.tagTeamBlock!.battles).toBeDefined();
      expect(cycleResult.tagTeamBlock!.rebalancing).toBeDefined();
      expect(cycleResult.tagTeamBlock!.matchmaking).toBeDefined();
    });
  });

  describe('KotH runs every cycle (no weekday check)', () => {
    it('should execute KotH when includeKoth is true regardless of simulated day', async () => {
      const result = await executeBulkCycles({ cycles: 1, includeKoth: true });
      const cycleResult = result.results[0];

      // KotH block should be present with battle and matchmaking results
      expect(cycleResult.kothBlock).toBeDefined();
      expect(cycleResult.kothBlock!.battles).toBeDefined();
      expect(cycleResult.kothBlock!.matchmaking).toBeDefined();
    });

    it('should skip KotH only when includeKoth option is false', async () => {
      const result = await executeBulkCycles({ cycles: 1, includeKoth: false });
      const cycleResult = result.results[0];

      // KotH block should be undefined when explicitly disabled
      expect(cycleResult.kothBlock).toBeUndefined();
    });
  });

  describe('Settlement block structure', () => {
    it('should include all settlement substeps', async () => {
      const result = await executeBulkCycles({ cycles: 1 });
      const cycleResult = result.results[0];

      expect(cycleResult.settlement).toBeDefined();
      expect(cycleResult.settlement!.userGeneration).toBeDefined();
      expect(cycleResult.settlement!.finances).toBeDefined();
      expect(cycleResult.settlement!.cycleCounters).toBeDefined();
      expect(cycleResult.settlement!.snapshot).toBeDefined();
      expect(cycleResult.settlement!.orphanCleanup).toBeDefined();
      expect(cycleResult.settlement!.endOfCycleBalances).toBeDefined();
    });
  });

  describe('Multiple cycles', () => {
    it('should execute multiple cycles and return results for each', async () => {
      (mockPrisma.cycleMetadata.findUnique as jest.Mock).mockResolvedValue({ id: 1, totalCycles: 10 });

      const result = await executeBulkCycles({ cycles: 3 });

      expect(result.success).toBe(true);
      expect(result.cyclesCompleted).toBe(3);
      expect(result.results).toHaveLength(3);

      // Each cycle result should have all blocks
      for (const cycleResult of result.results) {
        expect(cycleResult.leagueBlock).toBeDefined();
        expect(cycleResult.tagTeamBlock).toBeDefined();
        expect(cycleResult.settlement).toBeDefined();
        expect(cycleResult.reservedSlotsFired).toHaveLength(3);
      }
    });
  });
});
