/**
 * Scheduler run history against the real database (Cycle Controls):
 * - the store records runs and closes out an earlier process's unfinished runs
 *   as interrupted at that process's last heartbeat;
 * - the history merges runs, "backend restarted" markers and missed runs;
 * - the overview orders the daily slots and shows each slot's last run, the
 *   running and queued runs, and the missed runs of the last 7 days.
 *
 * Owns `scheduler_processes` / `scheduler_job_runs` (nothing else writes them in
 * tests) and clears both before and after.
 */
import prisma from '../../src/lib/prisma';
import { initScheduler, resetScheduler } from '../../src/services/cycle/cycleScheduler';
import {
  markFinished,
  markRunning,
  recordQueued,
  resetRunStore,
  startProcess,
} from '../../src/services/cycle/schedulerRunStore';
import { getSchedulerOverview, getSchedulerRun, listSchedulerRuns } from '../../src/services/cycle/schedulerHistoryService';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const SCHEDULES = {
  leagueSchedule: '0 8 * * *',
  tournamentSchedule: '0 10 * * *',
  tagTeamSchedule: '0 11 * * *',
  settlementSchedule: '0 0 * * *',
  kothSchedule: '0 13 * * *',
  team2v2LeagueSchedule: '0 9 * * *',
  team3v3LeagueSchedule: '0 14 * * *',
  team2v2TournamentSchedule: '0 15 * * *',
  team3v3TournamentSchedule: '0 18 * * *',
  grandMeleeSchedule: '0 17 * * *',
};

async function clearSchedulerTables(): Promise<void> {
  await prisma.schedulerJobRun.deleteMany({});
  await prisma.schedulerProcess.deleteMany({});
}

/** Today at HH:MM UTC, shifted by whole days. */
function utc(daysAgo: number, hour: number, minute = 0): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo, hour, minute));
}

let adminId: number;

beforeAll(async () => {
  await clearSchedulerTables();
  const admin = await prisma.user.create({
    data: { username: `sched_hist_admin_${Date.now()}`, passwordHash: 'x', role: 'admin', currency: 0 },
  });
  adminId = admin.id;
});

afterEach(async () => {
  resetRunStore();
  resetScheduler();
  await clearSchedulerTables();
});

afterAll(async () => {
  await prisma.user.delete({ where: { id: adminId } });
  await prisma.$disconnect();
});

describe('schedulerRunStore', () => {
  it('records a run from queued to finished, with summary and trimmed error', async () => {
    await startProcess({ schedulerEnabled: true, deployTag: 'deploy-acc-test' });

    const runId = await recordQueued({ jobName: 'league', trigger: 'manual', triggeredByUserId: adminId });
    expect(runId).not.toBeNull();
    const startedAt = new Date();
    await markRunning(runId, startedAt);
    expect((await prisma.schedulerJobRun.findUnique({ where: { id: runId! } }))?.status).toBe('running');

    await markFinished(runId, { status: 'failed', startedAt, finishedAt: new Date(startedAt.getTime() + 4 * MIN + 12_000), error: 'x'.repeat(900) });

    const row = await prisma.schedulerJobRun.findUnique({ where: { id: runId! } });
    expect(row).toMatchObject({ status: 'failed', durationMs: 252_000, trigger: 'manual', triggeredByUserId: adminId });
    expect(row?.error).toHaveLength(500);

    const process = await prisma.schedulerProcess.findUnique({ where: { id: row!.processId } });
    expect(process).toMatchObject({ schedulerEnabled: true, deployTag: 'deploy-acc-test' });
  });

  it('records nothing before the process is registered (unit tests, failed registration)', async () => {
    expect(await recordQueued({ jobName: 'league', trigger: 'cron' })).toBeNull();
    expect(await prisma.schedulerJobRun.count()).toBe(0);
  });

  it('marks an earlier process’s unfinished runs interrupted at its last heartbeat', async () => {
    const previous = await prisma.schedulerProcess.create({
      data: { startedAt: utc(1, 6), lastHeartbeatAt: utc(1, 17, 58), schedulerEnabled: true },
    });
    const running = await prisma.schedulerJobRun.create({
      data: { jobName: 'grandMelee', trigger: 'cron', processId: previous.id, status: 'running', queuedAt: utc(1, 17), startedAt: utc(1, 17) },
    });
    const queued = await prisma.schedulerJobRun.create({
      data: { jobName: 'team3v3Tournament', trigger: 'manual', processId: previous.id, status: 'queued', queuedAt: utc(1, 17, 30) },
    });
    const done = await prisma.schedulerJobRun.create({
      data: { jobName: 'koth', trigger: 'cron', processId: previous.id, status: 'success', queuedAt: utc(1, 13), startedAt: utc(1, 13), finishedAt: utc(1, 13, 9), durationMs: 9 * MIN },
    });

    await startProcess({ schedulerEnabled: true });

    const rows = await prisma.schedulerJobRun.findMany({ where: { id: { in: [running.id, queued.id, done.id] } }, orderBy: { id: 'asc' } });
    expect(rows[0]).toMatchObject({ status: 'interrupted', finishedAt: utc(1, 17, 58), durationMs: 58 * MIN });
    expect(rows[0].error).toMatch(/stopped before the run finished/);
    expect(rows[1]).toMatchObject({ status: 'interrupted', durationMs: null });
    expect(rows[2]).toMatchObject({ status: 'success', durationMs: 9 * MIN });
  });
});

describe('listSchedulerRuns', () => {
  it('merges runs, restart markers and missed runs newest first, with filters and paging', async () => {
    const first = await prisma.schedulerProcess.create({ data: { startedAt: utc(3, 6), lastHeartbeatAt: utc(2, 17, 58), schedulerEnabled: true } });
    const second = await prisma.schedulerProcess.create({ data: { startedAt: utc(2, 18, 3), lastHeartbeatAt: new Date(), schedulerEnabled: true, deployTag: 'deploy-acc-2' } });
    // Every slot ran on the days the backend was up, except 3v3 Tournament two days ago (deploy gap).
    const rows: Array<{ jobName: string; daysAgo: number; hour: number; processId: number; status?: string; trigger?: string }> = [];
    for (const [jobName, hour] of [['settlement', 0], ['league', 8], ['team2v2League', 9], ['tournament', 10], ['tagTeam', 11], ['koth', 13], ['team3v3League', 14], ['team2v2Tournament', 15], ['grandMelee', 17], ['team3v3Tournament', 18]] as const) {
      for (const daysAgo of [3, 2, 1, 0]) {
        const at = utc(daysAgo, hour);
        // Every slot already due has a run, so only the deploy gap can be missed at any time of day.
        if (at.getTime() < first.startedAt.getTime() || at.getTime() > Date.now()) continue;
        if (jobName === 'team3v3Tournament' && daysAgo === 2) continue;
        rows.push({ jobName, daysAgo, hour, processId: at.getTime() < second.startedAt.getTime() ? first.id : second.id });
      }
    }
    await prisma.schedulerJobRun.createMany({
      data: rows.map((row) => ({
        jobName: row.jobName, trigger: 'cron', processId: row.processId, status: 'success',
        queuedAt: utc(row.daysAgo, row.hour), startedAt: utc(row.daysAgo, row.hour), finishedAt: utc(row.daysAgo, row.hour, 5), durationMs: 5 * MIN,
      })),
    });
    // The manual recovery run after the deploy, and one failure.
    await prisma.schedulerJobRun.create({ data: { jobName: 'team3v3Tournament', trigger: 'manual', triggeredByUserId: adminId, processId: second.id, status: 'success', queuedAt: utc(2, 18, 6), startedAt: utc(2, 18, 6), finishedAt: utc(2, 18, 10), durationMs: 4 * MIN } });
    await prisma.schedulerJobRun.updateMany({ where: { jobName: 'koth', queuedAt: utc(1, 13) }, data: { status: 'failed', error: 'arena collapsed' } });
    initScheduler({ enabled: false, ...SCHEDULES });

    const all = await listSchedulerRuns({ days: 7, limit: 100 });
    const missed = all.entries.filter((entry) => entry.kind === 'missed');
    expect(missed).toEqual([{
      kind: 'missed',
      at: utc(2, 18).toISOString(),
      missed: { jobName: 'team3v3Tournament', expectedAt: utc(2, 18).toISOString(), downtime: { from: utc(2, 17, 58).toISOString(), to: utc(2, 18, 3).toISOString() } },
    }]);
    const restarts = all.entries.filter((entry) => entry.kind === 'restart');
    expect(restarts).toEqual([
      { kind: 'restart', at: second.startedAt.toISOString(), restart: { processId: second.id, deployTag: 'deploy-acc-2', schedulerEnabled: true, downSince: utc(2, 17, 58).toISOString() } },
      { kind: 'restart', at: first.startedAt.toISOString(), restart: { processId: first.id, deployTag: null, schedulerEnabled: true, downSince: null } },
    ]);
    const times = all.entries.map((entry) => new Date(entry.at).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
    const manual = all.entries.find((entry) => entry.kind === 'run' && entry.run.trigger === 'manual');
    expect(manual).toMatchObject({ run: { jobName: 'team3v3Tournament', triggeredBy: { userId: adminId } } });

    const problems = await listSchedulerRuns({ problemsOnly: true, days: 7, limit: 100 });
    const problemRuns = problems.entries.filter((entry) => entry.kind === 'run');
    expect(problemRuns).toHaveLength(1);
    expect(problemRuns[0]).toMatchObject({ run: { jobName: 'koth', status: 'failed', error: 'arena collapsed' } });
    expect(problems.entries.some((entry) => entry.kind === 'missed')).toBe(true);

    const onlyGm = await listSchedulerRuns({ jobName: 'grandMelee', days: 7, limit: 100 });
    expect(onlyGm.entries.filter((entry) => entry.kind === 'run').every((entry) => entry.kind === 'run' && entry.run.jobName === 'grandMelee')).toBe(true);
    expect(onlyGm.entries.some((entry) => entry.kind === 'missed')).toBe(false);

    const page2 = await listSchedulerRuns({ days: 7, page: 2, limit: 5 });
    expect(page2.entries).toHaveLength(5);
    expect(page2.total).toBe(all.total);
    expect(page2.entries[0]).toEqual(all.entries[5]);
  });
});

describe('getSchedulerOverview', () => {
  it('shows slots in time order with their last run, the running and queued runs, and recent misses', async () => {
    const processId = (await startProcess({ schedulerEnabled: true }))!;
    initScheduler({ enabled: false, ...SCHEDULES });
    // A run of settlement and GM earlier, GM running now, KotH queued behind it.
    await prisma.schedulerJobRun.create({ data: { jobName: 'settlement', trigger: 'cron', processId, status: 'success', queuedAt: new Date(Date.now() - 2 * HOUR), startedAt: new Date(Date.now() - 2 * HOUR), finishedAt: new Date(Date.now() - 2 * HOUR + 16 * MIN), durationMs: 16 * MIN, summary: { cycleNumber: 81 } } });
    const gmDone = await prisma.schedulerJobRun.create({ data: { jobName: 'grandMelee', trigger: 'cron', processId, status: 'success', queuedAt: new Date(Date.now() - DAY), startedAt: new Date(Date.now() - DAY), finishedAt: new Date(Date.now() - DAY + 12 * MIN), durationMs: 12 * MIN, summary: { matchesCompleted: 187 } } });
    await prisma.schedulerJobRun.create({ data: { jobName: 'grandMelee', trigger: 'manual', triggeredByUserId: adminId, processId, status: 'running', queuedAt: new Date(Date.now() - 4 * MIN), startedAt: new Date(Date.now() - 4 * MIN) } });
    await prisma.schedulerJobRun.create({ data: { jobName: 'koth', trigger: 'manual', triggeredByUserId: adminId, processId, status: 'queued', queuedAt: new Date(Date.now() - MIN) } });

    const overview = await getSchedulerOverview();

    expect(overview.scheduler.process).toMatchObject({ id: processId, deployTag: null });
    expect(overview.slots.map((slot) => slot.time)).toEqual(['00:00', '08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '17:00', '18:00']);
    const gm = overview.slots.find((slot) => slot.jobName === 'grandMelee')!;
    expect(gm.lastRun).toMatchObject({ id: gmDone.id, status: 'success', durationMs: 12 * MIN, summary: { matchesCompleted: 187 } });
    expect(gm.activeRun).toMatchObject({ status: 'running', triggeredBy: { userId: adminId } });
    expect(overview.slots.find((slot) => slot.jobName === 'settlement')?.lastRun?.summary).toEqual({ cycleNumber: 81 });
    expect(overview.running).toMatchObject({ jobName: 'grandMelee', status: 'running' });
    expect(overview.queue.map((run) => run.jobName)).toEqual(['koth']);
    // The scheduler is disabled in tests, so there is no next run.
    expect(overview.next).toBeNull();
    // Tracking started just now: nothing can be missed yet.
    expect(overview.missed).toEqual({ windowDays: 7, runs: [] });

    await expect(getSchedulerRun(gmDone.id)).resolves.toMatchObject({ id: gmDone.id, jobName: 'grandMelee' });
    await expect(getSchedulerRun(999_999_999)).rejects.toMatchObject({ statusCode: 404 });
  });
});
