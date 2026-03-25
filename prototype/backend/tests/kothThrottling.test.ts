/**
 * KotH Orchestrator Throttling Tests
 *
 * Verifies that:
 * 1. Throttle delays are applied between matches in executeScheduledKothBattles
 * 2. Throttle delays are applied between participants in processKothBattle
 * 3. The redundant auto-repair loop (step 1b) has been removed — no facility
 *    queries or repair cost calculations happen inside processKothBattle
 * 4. Matches are fetched one at a time (not all at once) to limit memory usage
 * 5. Failed matches are marked as 'failed' so they don't re-enter the loop
 */

// ─── Mocks (must be before imports) ──────────────────────────────────

const mockPrisma = {
  scheduledKothMatch: {
    count: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  robot: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
  },
  facility: {
    findMany: jest.fn(),
  },
  user: {
    update: jest.fn().mockResolvedValue({}),
  },
  battle: {
    create: jest.fn(),
  },
  battleParticipant: {
    create: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
  },
  cycleMetadata: {
    findUnique: jest.fn().mockResolvedValue({ id: 1, currentCycle: 1 }),
  },
};

jest.mock('../src/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('../src/services/combatSimulator', () => ({
  simulateBattleMulti: jest.fn().mockReturnValue({
    winnerId: 1,
    events: [],
    finalStates: [
      { robotId: 1, isAlive: true, currentHP: 100 },
      { robotId: 2, isAlive: true, currentHP: 80 },
      { robotId: 3, isAlive: true, currentHP: 60 },
      { robotId: 4, isAlive: false, currentHP: 0 },
      { robotId: 5, isAlive: false, currentHP: 0 },
    ],
    durationSeconds: 120,
    startingPositions: {},
    endingPositions: {},
    kothMetadata: { winReason: 'score_threshold' },
  }),
}));

jest.mock('../src/services/arena/kothEngine', () => ({
  buildKothGameModeConfig: jest.fn().mockReturnValue({}),
  buildKothInitialState: jest.fn().mockReturnValue({
    customData: {
      scoreState: {
        scores: { 1: 100, 2: 80, 3: 60, 4: 30, 5: 10 },
        zoneTimes: { 1: 60, 2: 40, 3: 30, 4: 10, 5: 5 },
        uncontestedScores: { 1: 50, 2: 30, 3: 20, 4: 5, 5: 0 },
        kills: { 1: 2, 2: 1, 3: 0, 4: 0, 5: 0 },
      },
      zoneState: {},
    },
  }),
  buildKothTickHook: jest.fn().mockReturnValue(() => {}),
  buildEnrichedPlacements: jest.fn().mockReturnValue([
    { robotId: 1, robotName: 'Bot1', placement: 1, zoneScore: 100, zoneTime: 60, uncontestedScore: 50, kills: 2, damageDealt: 500, finalHP: 100, destroyed: false },
    { robotId: 2, robotName: 'Bot2', placement: 2, zoneScore: 80, zoneTime: 40, uncontestedScore: 30, kills: 1, damageDealt: 300, finalHP: 80, destroyed: false },
    { robotId: 3, robotName: 'Bot3', placement: 3, zoneScore: 60, zoneTime: 30, uncontestedScore: 20, kills: 0, damageDealt: 200, finalHP: 60, destroyed: false },
    { robotId: 4, robotName: 'Bot4', placement: 4, zoneScore: 30, zoneTime: 10, uncontestedScore: 5, kills: 0, damageDealt: 100, finalHP: 0, destroyed: true },
    { robotId: 5, robotName: 'Bot5', placement: 5, zoneScore: 10, zoneTime: 5, uncontestedScore: 0, kills: 0, damageDealt: 50, finalHP: 0, destroyed: true },
  ]),
  KOTH_MATCH_DEFAULTS: {
    scoreThreshold: 200,
    rotatingZoneScoreThreshold: 300,
    timeLimit: 150,
    rotatingZoneTimeLimit: 210,
    zoneRadius: 50,
    arenaRadius: 200,
    zoneTransitionDuration: 5,
    rotatingZoneInterval: 30,
    zoneWarningTime: 5,
  },
}));

jest.mock('../src/services/combatMessageGenerator', () => ({
  CombatMessageGenerator: {
    buildKothBattleLog: jest.fn().mockReturnValue({ events: [] }),
  },
}));

jest.mock('../src/services/battlePostCombat', () => ({
  awardStreamingRevenueForParticipant: jest.fn().mockResolvedValue({ totalRevenue: 100 }),
  logBattleAuditEvent: jest.fn().mockResolvedValue(undefined),
  awardCreditsToUser: jest.fn().mockResolvedValue(undefined),
  awardPrestigeToUser: jest.fn().mockResolvedValue(undefined),
  awardFameToRobot: jest.fn().mockResolvedValue(undefined),
}));

// ─── Import after mocks ─────────────────────────────────────────────

import { executeScheduledKothBattles } from '../src/services/kothBattleOrchestrator';

// ─── Test helpers ────────────────────────────────────────────────────

function makeRobot(id: number, userId: number) {
  return {
    id,
    userId,
    name: `Bot${id}`,
    currentHP: 200,
    maxHP: 200,
    currentShield: 50,
    maxShield: 50,
    elo: 1000,
    mainWeapon: { weapon: { id: 1, name: 'Laser' } },
    offhandWeapon: null,
  };
}

function makeMatch(id: number, robotIds: number[]) {
  return {
    id,
    rotatingZone: false,
    scoreThreshold: null,
    timeLimit: null,
    zoneRadius: null,
    createdAt: new Date(),
    status: 'scheduled',
    participants: robotIds.map(robotId => ({ robotId })),
  };
}

/** Set up findFirst to return matches from a queue, then null when exhausted */
function setupMatchQueue(matches: ReturnType<typeof makeMatch>[]): void {
  const queue = [...matches];
  mockPrisma.scheduledKothMatch.count.mockResolvedValue(matches.length);
  mockPrisma.scheduledKothMatch.findFirst.mockImplementation(() => {
    return Promise.resolve(queue.shift() ?? null);
  });
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('KotH Orchestrator Throttling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ advanceTimers: true });

    const robots = [1, 2, 3, 4, 5].map(id => makeRobot(id, id));

    mockPrisma.robot.findMany.mockResolvedValue(robots);
    mockPrisma.robot.findUnique.mockImplementation(({ where }: { where: { id: number } }) => {
      const r = robots.find(r => r.id === where.id);
      return Promise.resolve(r ? { ...r, kothBestPlacement: null, kothCurrentWinStreak: 0, kothBestWinStreak: 0 } : null);
    });
    mockPrisma.battle.create.mockResolvedValue({ id: 100 });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should apply throttle delay between matches', async () => {
    setupMatchQueue([makeMatch(1, [1, 2, 3, 4, 5]), makeMatch(2, [1, 2, 3, 4, 5])]);

    const timestamps: number[] = [];
    mockPrisma.battle.create.mockImplementation(() => {
      timestamps.push(Date.now());
      return Promise.resolve({ id: 100 + timestamps.length });
    });

    const promise = executeScheduledKothBattles();
    await jest.runAllTimersAsync();
    const summary = await promise;

    expect(summary.successfulMatches).toBe(2);
    expect(summary.failedMatches).toBe(0);
    expect(timestamps).toHaveLength(2);
    expect(timestamps[1] - timestamps[0]).toBeGreaterThanOrEqual(2000);
  });

  it('should not throttle before the first match', async () => {
    setupMatchQueue([makeMatch(1, [1, 2, 3, 4, 5])]);

    const startTime = Date.now();
    let battleCreateTime = 0;
    mockPrisma.battle.create.mockImplementation(() => {
      battleCreateTime = Date.now();
      return Promise.resolve({ id: 100 });
    });

    const promise = executeScheduledKothBattles();
    await jest.runAllTimersAsync();
    await promise;

    expect(battleCreateTime - startTime).toBeLessThan(2000);
  });

  it('should apply throttle delay between participants within a match', async () => {
    setupMatchQueue([makeMatch(1, [1, 2, 3, 4, 5])]);

    const participantTimestamps: number[] = [];
    mockPrisma.battleParticipant.create.mockImplementation(() => {
      participantTimestamps.push(Date.now());
      return Promise.resolve({});
    });
    mockPrisma.battle.create.mockResolvedValue({ id: 100 });

    const promise = executeScheduledKothBattles();
    await jest.runAllTimersAsync();
    await promise;

    expect(participantTimestamps).toHaveLength(5);
    for (let i = 1; i < participantTimestamps.length; i++) {
      expect(participantTimestamps[i] - participantTimestamps[i - 1]).toBeGreaterThanOrEqual(200);
    }
  });

  it('should not query facilities or calculate repair costs (redundant repair removed)', async () => {
    setupMatchQueue([makeMatch(1, [1, 2, 3, 4, 5])]);
    mockPrisma.battle.create.mockResolvedValue({ id: 100 });

    const promise = executeScheduledKothBattles();
    await jest.runAllTimersAsync();
    await promise;

    expect(mockPrisma.facility.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it('should mark failed matches as error during run and reset to scheduled after', async () => {
    const matches = [makeMatch(1, [1, 2, 3, 4, 5]), makeMatch(2, [1, 2, 3, 4, 5])];
    const queue = [...matches];
    mockPrisma.scheduledKothMatch.count.mockResolvedValue(2);
    mockPrisma.scheduledKothMatch.findFirst.mockImplementation(() => {
      return Promise.resolve(queue.shift() ?? null);
    });

    // First match: robot query returns too few robots (triggers error)
    // Second match: normal
    let callCount = 0;
    mockPrisma.robot.findMany.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve([makeRobot(1, 1)]);
      return Promise.resolve([1, 2, 3, 4, 5].map(id => makeRobot(id, id)));
    });
    mockPrisma.battle.create.mockResolvedValue({ id: 100 });

    const promise = executeScheduledKothBattles();
    await jest.runAllTimersAsync();
    const summary = await promise;

    expect(summary.successfulMatches).toBe(1);
    expect(summary.failedMatches).toBe(1);
    expect(summary.errors[0]).toContain('expected at least 5 robots');
    // Failed match should be temporarily marked as 'error', then reset to 'scheduled'
    expect(mockPrisma.scheduledKothMatch.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 }, data: { status: 'error' } }),
    );
    expect(mockPrisma.scheduledKothMatch.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'error' }, data: { status: 'scheduled' } }),
    );
  });

  it('should fetch matches one at a time, not all at once', async () => {
    setupMatchQueue([makeMatch(1, [1, 2, 3, 4, 5]), makeMatch(2, [1, 2, 3, 4, 5])]);
    mockPrisma.battle.create.mockResolvedValue({ id: 100 });

    const promise = executeScheduledKothBattles();
    await jest.runAllTimersAsync();
    await promise;

    // Should use findFirst (one at a time), not findMany (all at once)
    expect(mockPrisma.scheduledKothMatch.findFirst).toHaveBeenCalled();
    expect(mockPrisma.scheduledKothMatch.count).toHaveBeenCalledTimes(1);
  });

  it('should apply longer batch cooldown after every 10 matches', async () => {
    const matches = Array.from({ length: 12 }, (_, i) => makeMatch(i + 1, [1, 2, 3, 4, 5]));
    setupMatchQueue(matches);

    const timestamps: number[] = [];
    mockPrisma.battle.create.mockImplementation(() => {
      timestamps.push(Date.now());
      return Promise.resolve({ id: 100 + timestamps.length });
    });

    const promise = executeScheduledKothBattles();
    await jest.runAllTimersAsync();
    const summary = await promise;

    expect(summary.successfulMatches).toBe(12);
    expect(timestamps).toHaveLength(12);

    // After 10th match (index 10, processed % 10 === 0): 10s batch cooldown
    expect(timestamps[10] - timestamps[9]).toBeGreaterThanOrEqual(10000);

    // Normal throttle between non-batch-boundary matches
    expect(timestamps[1] - timestamps[0]).toBeGreaterThanOrEqual(2000);
    expect(timestamps[1] - timestamps[0]).toBeLessThan(10000);
  });
});
