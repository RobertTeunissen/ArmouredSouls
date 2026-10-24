/**
 * Practice Arena usage against the real database (admin Practice Arena page):
 * recorded events aggregate into UTC days, season totals come from the stables'
 * practice counters, top practitioners carry their last recorded battle, and the
 * unavailable time comes from the scheduler run history. Also the original
 * `/stats` shape computed from the same events.
 *
 * Owns `practice_arena_events`, `scheduler_processes` and `scheduler_job_runs`
 * for its duration (nothing else writes them in this tier at the same time:
 * the tier runs serially) and clears them before and after.
 */
import prisma from '../../src/lib/prisma';
import {
  getLegacyPracticeArenaStats,
  getPracticeArenaOverview,
  recordPracticeRequest,
} from '../../src/services/practice-arena/practiceArenaUsageService';

const MIN = 60_000;
const HOUR = 60 * MIN;

async function clearTables(): Promise<void> {
  await prisma.practiceArenaEvent.deleteMany({});
  await prisma.schedulerJobRun.deleteMany({});
  await prisma.schedulerProcess.deleteMany({});
}

const userIds: number[] = [];

beforeAll(async () => {
  await clearTables();
  const suffix = Date.now();
  for (const [index, battles] of [900_000, 800_000].entries()) {
    const user = await prisma.user.create({
      data: { username: `pa_usage_${suffix}_${index}`, passwordHash: 'x', currency: 0, totalPracticeBattles: battles, stableName: `PA Stable ${index}` },
    });
    userIds.push(user.id);
  }
});

afterAll(async () => {
  await clearTables();
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe('getPracticeArenaOverview', () => {
  it('aggregates recorded events by UTC day with season totals, top practitioners and unavailable time', async () => {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const yesterday = new Date(today.getTime() - HOUR);
    const [first, second] = userIds;
    const sparringRequest = {
      robot1: { type: 'owned' as const, robotId: 1, overrides: { stance: 'offensive' as const } },
      robot2: { type: 'sparring' as const, config: { botTier: 'ExpertBot' as const, loadoutType: 'single' as const, rangeBand: 'melee' as const, stance: 'balanced' as const, yieldThreshold: 10 } },
    };
    await recordPracticeRequest({ userId: first, outcome: 'battle', requested: 6, request: sparringRequest, at: today });
    await recordPracticeRequest({ userId: second, outcome: 'battle', requested: 1, request: sparringRequest, at: today });
    await recordPracticeRequest({ userId: second, outcome: 'rate_limited', requested: 3, request: sparringRequest, at: today });
    await recordPracticeRequest({ userId: first, outcome: 'cycle_busy', requested: 1, at: today });
    await recordPracticeRequest({ userId: first, outcome: 'battle', requested: 2, request: sparringRequest, at: yesterday });

    // Run history from yesterday on: a 20 min job yesterday evening, and a 10 min one today (or up to now).
    const process = await prisma.schedulerProcess.create({ data: { startedAt: new Date(today.getTime() - 6 * HOUR), lastHeartbeatAt: now, schedulerEnabled: true } });
    await prisma.schedulerJobRun.create({ data: { jobName: 'grandMelee', trigger: 'cron', processId: process.id, status: 'success', queuedAt: new Date(today.getTime() - 3 * HOUR), startedAt: new Date(today.getTime() - 3 * HOUR), finishedAt: new Date(today.getTime() - 3 * HOUR + 20 * MIN), durationMs: 20 * MIN } });
    const todayRunEnd = new Date(Math.min(today.getTime() + 10 * MIN, now.getTime()));
    await prisma.schedulerJobRun.create({ data: { jobName: 'settlement', trigger: 'cron', processId: process.id, status: 'success', queuedAt: today, startedAt: today, finishedAt: todayRunEnd, durationMs: todayRunEnd.getTime() - today.getTime() } });

    const overview = await getPracticeArenaOverview(now);

    expect(overview.windowDays).toBe(30);
    expect(overview.days).toHaveLength(30);
    expect(overview.recordingSince).not.toBeNull();
    const [todayRow, yesterdayRow] = overview.days;
    expect(todayRow).toMatchObject({ date: today.toISOString().slice(0, 10), battles: 7, requests: 2, players: 2, rateLimited: 1, cycleBusy: 1, unavailableMs: todayRunEnd.getTime() - today.getTime() });
    expect(yesterdayRow).toMatchObject({ battles: 2, requests: 1, players: 1, unavailableMs: 20 * MIN });
    // Before the first backend start there is no run history.
    expect(overview.days[2].unavailableMs).toBeNull();

    expect(overview.season.battles).toBeGreaterThanOrEqual(1_700_000);
    expect(overview.season.players).toBeGreaterThanOrEqual(2);
    expect(overview.topPractitioners.slice(0, 2)).toEqual([
      expect.objectContaining({ userId: first, battles: 900_000, stableName: 'PA Stable 0', lastPracticeAt: today.toISOString() }),
      expect.objectContaining({ userId: second, battles: 800_000, lastPracticeAt: today.toISOString() }),
    ]);

    expect(overview.usage).toMatchObject({
      battles: 9,
      requests: 3,
      matchups: { owned_vs_sparring: 9, owned_vs_owned: 0, sparring_vs_sparring: 0 },
      botTiers: { ExpertBot: 9 },
      batchSizes: { single: 1, small: 1, large: 1 },
      overridesRequests: 3,
    });

    const legacy = await getLegacyPracticeArenaStats(now);
    expect(legacy.current).toEqual({ totalBattlesSinceStart: overview.season.battles, battlesToday: 7, rateLimitHitsToday: 1, uniquePlayersToday: 2 });
    // The original contract: full ISO date and the day's distinct battle players.
    expect(legacy.history[0]).toEqual({
      date: `${todayRow.date}T00:00:00.000Z`,
      totalBattles: 7,
      uniquePlayers: 2,
      rateLimitHits: 1,
      playerIds: [first, second].sort((a, b) => a - b),
    });
  });
});
