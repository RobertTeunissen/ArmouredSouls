/**
 * Practice Arena usage: request classification, the fire-and-forget recorder,
 * and the pure aggregation behind the admin page (UTC days, unrecorded days,
 * unavailable time, usage split). The DB-backed overview is covered by
 * `tests/integration/practiceArenaUsage.test.ts`.
 */
jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: { practiceArenaEvent: { create: jest.fn() } },
}));
jest.mock('../../../config/logger', () => ({ __esModule: true, default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() } }));

import prisma from '../../../lib/prisma';
import logger from '../../../config/logger';
import {
  aggregateDays,
  aggregateUsage,
  battlePlayersByDay,
  classifyRequest,
  lastUtcDays,
  mergeIntervals,
  recordPracticeRequest,
  unavailableByDay,
  type UsageEvent,
} from '../practiceArenaUsageService';
import type { BattleSlot } from '../practiceArenaService';

const create = prisma.practiceArenaEvent.create as jest.Mock;
const sparring = (botTier: 'WimpBot' | 'ExpertBot'): BattleSlot => ({
  type: 'sparring',
  config: { botTier, loadoutType: 'single', rangeBand: 'melee', stance: 'balanced', yieldThreshold: 10 },
});
const owned = (overrides?: object): BattleSlot => ({ type: 'owned', robotId: 3, ...(overrides ? { overrides } : {}) });
const at = (iso: string): Date => new Date(iso);
const event = (partial: Partial<UsageEvent>): UsageEvent => ({
  userId: 1, occurredAt: at('2026-10-23T10:00:00Z'), outcome: 'battle', requested: 1, battles: 1, matchup: 'owned_vs_sparring', botTier: 'WimpBot', overrides: false, ...partial,
});

beforeEach(() => jest.clearAllMocks());

describe('classifyRequest', () => {
  it('names the matchup, the opponent tier and real what-if overrides', () => {
    expect(classifyRequest({ robot1: owned(), robot2: sparring('ExpertBot') })).toEqual({ matchup: 'owned_vs_sparring', botTier: 'ExpertBot', overrides: false });
    expect(classifyRequest({ robot1: owned({ stance: 'offensive' }), robot2: owned() })).toEqual({ matchup: 'owned_vs_owned', botTier: null, overrides: true });
    expect(classifyRequest({ robot1: sparring('WimpBot'), robot2: sparring('ExpertBot') })).toEqual({ matchup: 'sparring_vs_sparring', botTier: 'ExpertBot', overrides: false });
    // An empty overrides object, or one with only empty maps, is not a what-if.
    expect(classifyRequest({ robot1: owned({ attributes: {}, tuningBonuses: {} }), robot2: sparring('WimpBot') }).overrides).toBe(false);
    expect(classifyRequest(null)).toEqual({ matchup: null, botTier: null, overrides: false });
  });
});

describe('recordPracticeRequest', () => {
  it('writes one row: battles run for a battle, none for a refusal, count clamped to 1–10', async () => {
    create.mockResolvedValue({});
    await recordPracticeRequest({ userId: 4, outcome: 'battle', requested: 6, request: { robot1: owned(), robot2: sparring('WimpBot') } });
    expect(create).toHaveBeenLastCalledWith({ data: { userId: 4, outcome: 'battle', requested: 6, battles: 6, matchup: 'owned_vs_sparring', botTier: 'WimpBot', overrides: false } });

    await recordPracticeRequest({ userId: 4, outcome: 'cycle_busy', requested: 99 });
    expect(create).toHaveBeenLastCalledWith({ data: { userId: 4, outcome: 'cycle_busy', requested: 10, battles: 0, matchup: null, botTier: null, overrides: false } });

    await recordPracticeRequest({ userId: 4, outcome: 'rate_limited', requested: 2.5 });
    expect(create.mock.calls.at(-1)?.[0].data).toMatchObject({ requested: 1, battles: 0 });
  });

  it('never rejects: a failed write is logged and dropped', async () => {
    create.mockRejectedValue(new Error('connection lost'));
    await expect(recordPracticeRequest({ userId: 4, outcome: 'battle', requested: 1 })).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('connection lost'));
  });
});

describe('aggregateDays', () => {
  const now = at('2026-10-23T14:00:00Z');

  it('buckets by UTC day, newest first, and keeps days before recording apart from zero days', () => {
    const days = aggregateDays({
      events: [
        event({ occurredAt: at('2026-10-23T00:00:00Z'), battles: 10, requested: 10 }),
        event({ occurredAt: at('2026-10-23T13:59:00Z'), userId: 2, battles: 3, requested: 3 }),
        event({ occurredAt: at('2026-10-23T09:00:00Z'), userId: 2, outcome: 'rate_limited', battles: 0 }),
        event({ occurredAt: at('2026-10-23T09:30:00Z'), outcome: 'cycle_busy', battles: 0 }),
        event({ occurredAt: at('2026-10-22T23:59:59Z'), battles: 2, requested: 2 }),
      ],
      intervals: [],
      now,
      days: 3,
      recordingSince: at('2026-10-22T08:40:00Z'),
      lockTrackingSince: null,
    });
    expect(days.map((day) => day.date)).toEqual(['2026-10-23', '2026-10-22', '2026-10-21']);
    expect(days[0]).toMatchObject({ battles: 13, requests: 2, players: 2, rateLimited: 1, cycleBusy: 1, recorded: true, unavailableMs: null });
    expect(days[1]).toMatchObject({ battles: 2, requests: 1, players: 1, recorded: true });
    expect(days[2]).toMatchObject({ battles: 0, recorded: false });
  });

  it('reports unavailable time from the day run history started, clipped to now', () => {
    const days = aggregateDays({
      events: [],
      intervals: [
        { start: at('2026-10-22T23:50:00Z'), end: at('2026-10-23T00:10:00Z') },
        { start: at('2026-10-23T13:30:00Z'), end: now },
      ],
      now,
      days: 3,
      recordingSince: null,
      lockTrackingSince: at('2026-10-22T08:40:00Z'),
    });
    expect(days.map((day) => day.unavailableMs)).toEqual([40 * 60_000, 10 * 60_000, null]);
    expect(days.every((day) => !day.recorded)).toBe(true);
  });
});

describe('mergeIntervals and unavailableByDay', () => {
  it('counts a rollover inside settlement once', () => {
    const merged = mergeIntervals([
      { start: at('2026-10-23T00:00:00Z'), end: at('2026-10-23T00:20:00Z') },
      { start: at('2026-10-23T00:05:00Z'), end: at('2026-10-23T00:15:00Z') },
      { start: at('2026-10-23T08:00:00Z'), end: at('2026-10-23T08:00:00Z') },
    ]);
    expect(merged).toEqual([{ start: at('2026-10-23T00:00:00Z'), end: at('2026-10-23T00:20:00Z') }]);
    expect(unavailableByDay(merged, ['2026-10-23'], at('2026-10-23T12:00:00Z')).get('2026-10-23')).toBe(20 * 60_000);
  });

  it('lists the window newest first across a month boundary', () => {
    expect(lastUtcDays(at('2026-11-01T05:00:00Z'), 3)).toEqual(['2026-11-01', '2026-10-31', '2026-10-30']);
  });
});

describe('aggregateUsage', () => {
  it('splits battles by matchup and tier, requests by batch size, and counts what-ifs; refusals are ignored', () => {
    const usage = aggregateUsage([
      event({ battles: 1, requested: 1 }),
      event({ battles: 4, requested: 4, botTier: 'ExpertBot' }),
      event({ battles: 10, requested: 10, matchup: 'owned_vs_owned', botTier: null, overrides: true }),
      event({ outcome: 'rate_limited', battles: 0 }),
    ]);
    expect(usage).toEqual({
      battles: 15,
      requests: 3,
      matchups: { owned_vs_sparring: 5, owned_vs_owned: 10, sparring_vs_sparring: 0 },
      botTiers: { WimpBot: 1, AverageBot: 0, ExpertBot: 4, UltimateBot: 0 },
      batchSizes: { single: 1, small: 1, large: 1 },
      overridesRequests: 1,
    });
  });
});

describe('battlePlayersByDay', () => {
  it('lists distinct battle players per UTC day, ascending, ignoring refusals', () => {
    const players = battlePlayersByDay([
      event({ userId: 9 }),
      event({ userId: 2 }),
      event({ userId: 9 }),
      event({ userId: 5, outcome: 'cycle_busy', battles: 0 }),
      event({ userId: 4, occurredAt: at('2026-10-22T23:59:00Z') }),
    ]);
    expect(players.get('2026-10-23')).toEqual([2, 9]);
    expect(players.get('2026-10-22')).toEqual([4]);
  });
});
