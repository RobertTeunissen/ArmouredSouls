/**
 * Spec #55 task 6.7 — the scheduled settlement's Turn_Step call sites against
 * the real Turn_Records (R7.1–R7.3): a preparation day writes a `preparation`
 * record, a competitive cycle that closes without a boundary writes a
 * `settlement` record for the closed cycle, and the boundary cycle writes
 * none (the rollover's Stage 5 gives the `season_open` turn instead).
 *
 * The season counters, the financial close, battles and the rollover are
 * mocked (they are covered by their own suites and the heavy tier); the
 * Automaton turn runs for real against the database, scoped to this file's
 * stable. The tier-residency increment is stubbed so the shared dev
 * database's standings are not touched.
 */
import prisma from '../../src/lib/prisma';
import { executeSettlement } from '../../src/services/cycle/cycleScheduler';
import * as turnService from '../../src/services/automaton/automatonTurnService';
import { activateProfile, addBlueprint, createDraft } from '../../src/services/automaton/automatonProfileService';
import { setAlertSender } from '../../src/services/automaton/automatonObservability';
import { deleteAutomatonStables } from '../helpers/automatonStable';

const mockGetCurrentSeason = jest.fn();
const mockAdvancePreparation = jest.fn();
const mockAdvanceCompetitive = jest.fn();
const mockRollover = jest.fn(async () => ({}));

jest.mock('../../src/services/season/seasonService', () => ({
  ...jest.requireActual('../../src/services/season/seasonService'),
  getCurrentSeason: () => mockGetCurrentSeason(),
  advancePreparationCycle: () => mockAdvancePreparation(),
  advanceCompetitiveCycle: () => mockAdvanceCompetitive(),
}));
jest.mock('../../src/services/season/seasonRolloverService', () => ({ executeSeasonRollover: () => mockRollover() }));
jest.mock('../../src/services/cycle/canonicalCycleIdentity', () => ({
  ...jest.requireActual('../../src/services/cycle/canonicalCycleIdentity'),
  beginSerializedCycleCutover: jest.fn(async () => 42),
  getSerializedCycleCutoverUserIdWatermark: jest.fn(async () => 100),
  completeSerializedCycleCutover: jest.fn(async () => undefined),
  abortSerializedCycleCutover: jest.fn(async () => undefined),
}));
jest.mock('../../src/services/cycle/cycle-closing-evidence', () => ({ logCycleEndBalances: jest.fn(async () => 5) }));
jest.mock('../../src/services/cycle/cycleSnapshotService', () => ({ cycleSnapshotService: { createSnapshot: jest.fn(async () => undefined) } }));
jest.mock('../../src/services/financial/settlementService', () => ({
  settlementService: { settleCycle: jest.fn(async () => ({ totalPassiveIncome: 0, totalOperatingCosts: 0, usersProcessed: 5 })) },
}));
jest.mock('../../src/services/practice-arena/practiceArenaMetrics', () => ({ practiceArenaMetrics: { flushAndReset: jest.fn(async () => undefined) } }));
jest.mock('../../src/utils/userGeneration', () => ({ generateBattleReadyUsers: jest.fn(async () => ({ usersCreated: 0, robotsCreated: 0 })) }));
jest.mock('../../src/services/leaderboard/leaderboardService', () => ({ leaderboardService: { refreshAll: jest.fn(async () => undefined) } }));
jest.mock('../../src/services/common/eventLogger', () => ({
  ...jest.requireActual('../../src/services/common/eventLogger'),
  EventLogger: jest.fn().mockImplementation(() => ({
    logCycleStart: jest.fn(async () => undefined),
    logCycleComplete: jest.fn(async () => undefined),
  })),
}));
jest.mock('../../src/services/achievement', () => ({
  achievementService: { checkAndAward: jest.fn(async () => []), refreshRarityCache: jest.fn(async () => undefined) },
}));

const run = `${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 900 + 100)}`;
const catalogueKey = `t55s-${run}`;
const SEASON = 6_000 + Math.floor(Math.random() * 900);

describe('Scheduled settlement Turn_Step call sites (Spec #55 task 6.7)', () => {
  let userId: number;
  let profileId: number;
  let previousSender: ReturnType<typeof setAlertSender>;

  beforeAll(async () => {
    previousSender = setAlertSender(async () => undefined);
    await createDraft({ catalogueKey, stableName: `Sz ${run}`, franchise: 'Test', backstory: 'Settlement wiring test stable.', strategyKey: 'paragon' });
    await addBlueprint(catalogueKey, {
      robotName: 'Sz Hammer', loadoutType: 'two_handed', stance: 'balanced', yieldThreshold: 10, buildFocus: 'bruiser',
      weaponPath: [{ main: 'Shock Maul' }], refinementPlan: [{ tier: 'sharpen', hand: 'main', magnitude: 1 }],
    });
    const { result } = await activateProfile(catalogueKey);
    userId = result.userId;
    profileId = (await prisma.automatonProfile.findUniqueOrThrow({ where: { catalogueKey } })).id;
    // Buys nothing: the turns stay fast and only their records matter here.
    await prisma.user.update({ where: { id: userId }, data: { currency: 100 } });
  });

  beforeEach(() => {
    jest.spyOn(prisma.standing, 'updateMany').mockResolvedValue({ count: 0 });
    // Scope the real Turn_Step to this file's stable (a shared dev DB has other Automatons).
    const real = turnService.runTurnStepNonFatal;
    jest.spyOn(turnService, 'runTurnStepNonFatal').mockImplementation((input) =>
      real(input, { cohortFilter: (p) => p.profileId === profileId, leasePollMs: 50 }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    setAlertSender(previousSender);
    await deleteAutomatonStables([userId]);
    await prisma.automatonProfile.deleteMany({ where: { catalogueKey } });
    await prisma.$disconnect();
  });

  const turns = () => prisma.automatonTurn.findMany({ where: { profileId }, orderBy: { id: 'asc' } });

  it('runs a preparation turn for the preparation day just completed (R7.3)', async () => {
    mockGetCurrentSeason.mockResolvedValue({ seasonNumber: SEASON, phase: 'preparation' });
    mockAdvancePreparation.mockResolvedValue({ seasonNumber: SEASON, preparationCyclesCompleted: 3, remainingPreparationCycles: 4, transitionedToCompetitive: false });
    await executeSettlement();
    expect((await turns()).map((t) => [t.trigger, t.seasonNumber, t.slot, t.status])).toEqual([['preparation', SEASON, 3, 'completed']]);
  });

  it('runs a settlement turn for the closed cycle when no boundary is reached (R7.1)', async () => {
    mockGetCurrentSeason.mockResolvedValue({ seasonNumber: SEASON, phase: 'competitive' });
    mockAdvanceCompetitive.mockResolvedValue({ seasonNumber: SEASON, competitiveCyclesCompleted: 12, boundaryReached: false });
    await executeSettlement();
    const rows = await turns();
    expect(rows.map((t) => [t.trigger, t.seasonNumber, t.slot])).toEqual([['preparation', SEASON, 3], ['settlement', SEASON, 42]]);
    expect(mockRollover).not.toHaveBeenCalled();
  });

  it('runs no settlement turn on the boundary cycle (R7.2)', async () => {
    mockGetCurrentSeason.mockResolvedValue({ seasonNumber: SEASON + 1, phase: 'competitive' });
    mockAdvanceCompetitive.mockResolvedValue({ seasonNumber: SEASON + 1, competitiveCyclesCompleted: 30, boundaryReached: true });
    await executeSettlement();
    expect(mockRollover).toHaveBeenCalledTimes(1);
    const rows = await turns();
    expect(rows.filter((t) => t.seasonNumber === SEASON + 1)).toEqual([]);
    expect(rows).toHaveLength(2);
  });
});
