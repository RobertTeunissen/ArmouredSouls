/**
 * Unit tests for the dashboard status helpers and their composition.
 */
const mockCycleMetadataFindUnique = jest.fn();
const mockUserCount = jest.fn();
const mockScheduledMatchCount = jest.fn();
const mockGetSchedulerState = jest.fn();
const mockGetCurrentSeason = jest.fn();
const mockGetSummary = jest.fn();
const mockGetAutomatonStatus = jest.fn();
const mockCountQueued = jest.fn();

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    cycleMetadata: { findUnique: (...args: unknown[]) => mockCycleMetadataFindUnique(...args) },
    user: { count: (...args: unknown[]) => mockUserCount(...args) },
    scheduledMatch: { count: (...args: unknown[]) => mockScheduledMatchCount(...args) },
  },
}));
jest.mock('../../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../cycle/cycleScheduler', () => ({
  getSchedulerState: () => mockGetSchedulerState(),
}));
jest.mock('../../season/seasonService', () => ({
  getCurrentSeason: () => mockGetCurrentSeason(),
}));
jest.mock('../../security/securityMonitor', () => ({
  securityMonitor: { getSummary: () => mockGetSummary() },
}));
jest.mock('../../automaton/automatonStatus', () => ({
  getAutomatonStatus: () => mockGetAutomatonStatus(),
}));
jest.mock('../adminQueuedMatches', () => ({
  countQueuedMatchesByMode: () => mockCountQueued(),
  totalQueued: (counts: Map<string, number>) => [...counts.values()].reduce((a, b) => a + b, 0),
}));

import type { JobState, SchedulerState } from '../../cycle/cycleScheduler';
import { computeCycleHealth, getDashboardStatus, summarizeScheduler } from '../adminDashboardStatusService';
import { SETTLEMENT_OVERDUE_AFTER_MS, STUCK_MATCH_GRACE_MS } from '../adminThresholds';

const NOW = new Date('2026-10-22T14:00:00.000Z');

function job(name: string, lastRunStatus: JobState['lastRunStatus'], nextRunAt: Date | null = null): JobState {
  return {
    name: name as JobState['name'],
    schedule: '0 0 * * *',
    lastRunAt: lastRunStatus ? NOW : null,
    lastRunDurationMs: lastRunStatus ? 1000 : null,
    lastRunStatus,
    lastError: lastRunStatus === 'failed' ? 'boom' : null,
    nextRunAt,
  };
}

function scheduler(jobs: JobState[], overrides: Partial<SchedulerState> = {}): SchedulerState {
  return { active: true, runningJob: null, queue: [], jobs, ...overrides };
}

describe('computeCycleHealth', () => {
  const base = { schedulerActive: true, failedJobs: [], stuckMatches: 0, now: NOW };

  it('is healthy right after a settlement', () => {
    expect(computeCycleHealth({ ...base, lastSettlementAt: new Date(NOW.getTime() - 60_000) })).toEqual({
      settlementOverdue: false, failedJobs: [], stuckMatches: 0,
    });
  });

  it('flags a settlement older than the threshold, and not one exactly at it', () => {
    const atThreshold = new Date(NOW.getTime() - SETTLEMENT_OVERDUE_AFTER_MS);
    const pastThreshold = new Date(atThreshold.getTime() - 1);

    expect(computeCycleHealth({ ...base, lastSettlementAt: atThreshold }).settlementOverdue).toBe(false);
    expect(computeCycleHealth({ ...base, lastSettlementAt: pastThreshold }).settlementOverdue).toBe(true);
  });

  it('flags a missing settlement while the scheduler is active', () => {
    expect(computeCycleHealth({ ...base, lastSettlementAt: null }).settlementOverdue).toBe(true);
  });

  it('never flags the settlement while the scheduler is disabled', () => {
    expect(computeCycleHealth({ ...base, schedulerActive: false, lastSettlementAt: null }).settlementOverdue).toBe(false);
  });

  it('passes failed jobs and stuck matches through', () => {
    const health = computeCycleHealth({ ...base, lastSettlementAt: NOW, failedJobs: ['koth'], stuckMatches: 3 });
    expect(health).toEqual({ settlementOverdue: false, failedJobs: ['koth'], stuckMatches: 3 });
  });
});

describe('summarizeScheduler', () => {
  it('counts succeeded, failed and not-yet-reported jobs', () => {
    const summary = summarizeScheduler(
      scheduler([job('league', 'success'), job('koth', 'failed'), job('settlement', null)], { runningJob: 'tagTeam', queue: ['grandMelee'] }),
      NOW,
    );

    expect(summary).toEqual({
      active: true,
      runningJob: 'tagTeam',
      queueLength: 1,
      jobsTotal: 3,
      jobsSucceeded: 1,
      jobsFailed: ['koth'],
      jobsNotYetReported: 1,
      processStartedAt: NOW.toISOString(),
    });
  });

  it('handles a scheduler that never initialised (no jobs)', () => {
    expect(summarizeScheduler(scheduler([], { active: false }), NOW)).toMatchObject({
      active: false, jobsTotal: 0, jobsSucceeded: 0, jobsFailed: [], jobsNotYetReported: 0,
    });
  });
});

describe('getDashboardStatus', () => {
  const nextSettlement = new Date('2026-10-23T00:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSchedulerState.mockReturnValue(scheduler([job('league', 'success'), job('settlement', 'success', nextSettlement)]));
    mockCycleMetadataFindUnique.mockResolvedValue({ totalCycles: 412, lastCycleAt: new Date('2026-10-22T00:01:00.000Z') });
    mockGetCurrentSeason.mockResolvedValue({ seasonNumber: 2, phase: 'competitive', seasonCycle: 38 });
    mockCountQueued.mockResolvedValue(new Map([['league_1v1', 96], ['koth', 6]]));
    mockUserCount.mockResolvedValue(3);
    mockGetAutomatonStatus.mockResolvedValue({ needAttentionCount: 5, failedCount: 1 });
    mockScheduledMatchCount.mockResolvedValue(0);
    mockGetSummary.mockReturnValue({ activeAlerts: 2, bySeverity: { info: 0, warning: 1, critical: 1 } });
  });

  it('composes cycle, season, scheduler, queue and attention facts', async () => {
    const status = await getDashboardStatus(NOW);

    expect(status.cycle).toEqual({
      number: 412,
      lastSettlementAt: '2026-10-22T00:01:00.000Z',
      nextSettlementAt: nextSettlement.toISOString(),
    });
    expect(status.season).toEqual({ number: 2, phase: 'competitive', seasonCycle: 38 });
    expect(status.queuedMatches).toBe(102);
    expect(status.attention).toEqual({
      bankruptcyRisk: { count: 3, threshold: 10_000 },
      security: { activeAlerts: 2, critical: 1 },
      automatons: { needAttention: 5, failed: 1 },
      cycleHealth: { settlementOverdue: false, failedJobs: [], stuckMatches: 0 },
    });
    expect(status.timestamp).toBe(NOW.toISOString());
  });

  it('counts stuck matches with the grace period', async () => {
    mockScheduledMatchCount.mockResolvedValue(4);

    const status = await getDashboardStatus(NOW);

    expect(mockScheduledMatchCount).toHaveBeenCalledWith({
      where: { status: 'scheduled', scheduledFor: { lt: new Date(NOW.getTime() - STUCK_MATCH_GRACE_MS) } },
    });
    expect(status.attention.cycleHealth.stuckMatches).toBe(4);
  });

  it('returns a failing section as null instead of failing the response', async () => {
    mockGetAutomatonStatus.mockRejectedValue(new Error('db down'));
    mockGetCurrentSeason.mockRejectedValue(new Error('db down'));
    mockGetSummary.mockImplementation(() => { throw new Error('monitor down'); });

    const status = await getDashboardStatus(NOW);

    expect(status.attention.automatons).toBeNull();
    expect(status.attention.security).toBeNull();
    expect(status.season).toBeNull();
    expect(status.attention.bankruptcyRisk).toEqual({ count: 3, threshold: 10_000 });
  });
});
