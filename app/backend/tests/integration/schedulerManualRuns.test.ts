/**
 * Every Cycle Controls "Run" button, end to end against the real database:
 * `POST /api/admin/scheduler/runs` starts each of the ten scheduler jobs with
 * the scheduler disabled (as in local and CI), answers 202 at once, and the
 * job runs its real handler in the background until its history row reads
 * `success`. Also: the bulk runner in the background, under the scheduler lock,
 * and the 409 for a second active start.
 *
 * Heavy: settlement closes a real financial cycle and generates a stable. The
 * suite owns a clean schedule and cycle range, and restores the season row.
 */
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import dotenv from 'dotenv';
import prisma from '../../src/lib/prisma';
import adminRoutes from '../../src/routes/admin';
import { errorHandler } from '../../src/middleware/errorHandler';
import { getActiveJobNames, initScheduler, resetScheduler } from '../../src/services/cycle/cycleScheduler';
import { resetRunStore, startProcess } from '../../src/services/cycle/schedulerRunStore';
import { invalidateSeasonCache } from '../../src/services/season/seasonService';
import { SCHEDULER_JOB_NAMES } from '../../src/services/cycle/schedulerJobNames';

dotenv.config();

const app = express();
app.use(express.json());
app.use('/api/admin', adminRoutes);
app.use(errorHandler);

/** Highest cycle number this suite can reach (see adminCycleGeneration.test.ts). */
const MAX_CYCLE_TOUCHED = 50;
const RUN_TIMEOUT_MS = 90_000;

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

let server: http.Server;
let baseUrl: string;
let adminId: number;
let adminToken: string;
let seasonBefore: { id: number; phase: string; competitiveCyclesCompleted: number; lengthOverrideCycles: number | null; lastSettlementAt: Date | null } | null = null;

async function clearCycleRange(): Promise<void> {
  await prisma.cycleSnapshot.deleteMany({ where: { cycleNumber: { lte: MAX_CYCLE_TOUCHED } } });
  await prisma.financialLedger.deleteMany({ where: { cycleNumber: { lte: MAX_CYCLE_TOUCHED } } });
  await prisma.auditLog.deleteMany({ where: { cycleNumber: { lte: MAX_CYCLE_TOUCHED } } });
  await prisma.adminKpiSnapshot.deleteMany({ where: { cycleNumber: { lte: MAX_CYCLE_TOUCHED } } });
}

/** Wait for a run to leave queued/running; returns its final row. */
async function waitForRun(runId: number): Promise<{ status: string; error: string | null; durationMs: number | null; summary: unknown }> {
  const deadline = Date.now() + RUN_TIMEOUT_MS;
  for (;;) {
    const row = await prisma.schedulerJobRun.findUnique({ where: { id: runId }, select: { status: true, error: true, durationMs: true, summary: true } });
    if (row && row.status !== 'queued' && row.status !== 'running') return row;
    if (Date.now() > deadline) throw new Error(`run ${runId} still ${row?.status} after ${RUN_TIMEOUT_MS} ms`);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

async function waitUntilIdle(): Promise<void> {
  const deadline = Date.now() + RUN_TIMEOUT_MS;
  while (getActiveJobNames().length > 0) {
    if (Date.now() > deadline) throw new Error(`scheduler still busy: ${getActiveJobNames().join(', ')}`);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

beforeAll(async () => {
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  await prisma.schedulerJobRun.deleteMany({});
  await prisma.schedulerProcess.deleteMany({});
  // Battle jobs consume every queued match; this suite owns a clean schedule.
  await prisma.scheduledMatch.deleteMany({});
  await clearCycleRange();
  await prisma.cycleMetadata.upsert({ where: { id: 1 }, update: { totalCycles: 0, lastCycleAt: null }, create: { id: 1, totalCycles: 0 } });

  // Battle jobs only run their handlers in a competitive phase, and settlement
  // must not reach a season boundary. Restored in afterAll.
  const season = await prisma.season.findFirst({ where: { phase: { not: 'completed' } }, orderBy: { seasonNumber: 'desc' } });
  if (season) {
    seasonBefore = {
      id: season.id,
      phase: season.phase,
      competitiveCyclesCompleted: season.competitiveCyclesCompleted,
      lengthOverrideCycles: season.lengthOverrideCycles,
      lastSettlementAt: season.lastSettlementAt,
    };
    await prisma.season.update({
      where: { id: season.id },
      data: { phase: 'competitive', lengthOverrideCycles: season.competitiveCyclesCompleted + 50 },
    });
  }
  invalidateSeasonCache();

  const admin = await prisma.user.create({
    data: { username: `sched_runs_admin_${Date.now()}`, passwordHash: 'x', role: 'admin', currency: 1_000_000 },
  });
  adminId = admin.id;
  adminToken = jwt.sign({ userId: admin.id, username: admin.username, role: 'admin', tokenVersion: 0 }, process.env.JWT_SECRET || 'test-secret');

  await startProcess({ schedulerEnabled: false });
  initScheduler({ enabled: false, ...SCHEDULES });
}, 60_000);

afterAll(async () => {
  await waitUntilIdle().catch(() => undefined);
  resetScheduler();
  resetRunStore();
  await new Promise<void>((resolve) => server.close(() => resolve()));

  await prisma.schedulerJobRun.deleteMany({});
  await prisma.schedulerProcess.deleteMany({});
  await clearGeneratedFixtures();
  await prisma.scheduledMatch.deleteMany({});
  await clearCycleRange();
  await prisma.cycleMetadata.update({ where: { id: 1 }, data: { totalCycles: 0, lastCycleAt: null } });
  if (seasonBefore) {
    await prisma.season.update({
      where: { id: seasonBefore.id },
      data: {
        phase: seasonBefore.phase,
        competitiveCyclesCompleted: seasonBefore.competitiveCyclesCompleted,
        lengthOverrideCycles: seasonBefore.lengthOverrideCycles,
        lastSettlementAt: seasonBefore.lastSettlementAt,
      },
    });
  }
  invalidateSeasonCache();
  await prisma.financialLedger.deleteMany({ where: { userId: adminId } });
  await prisma.user.delete({ where: { id: adminId } });
  await prisma.$disconnect();
}, 120_000);

describe('Cycle Controls — every Run button, end to end', () => {
  for (const jobName of SCHEDULER_JOB_NAMES) {
    it(`runs ${jobName} in the background through POST /scheduler/runs and records success`, async () => {
      const started = Date.now();
      const res = await request(baseUrl)
        .post('/api/admin/scheduler/runs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ jobName });

      expect(res.status).toBe(202);
      expect(res.body.run).toMatchObject({ jobName, status: 'queued' });
      expect(typeof res.body.run.id).toBe('number');
      // The response does not wait for the job.
      expect(Date.now() - started).toBeLessThan(5_000);

      const run = await waitForRun(res.body.run.id);
      expect({ status: run.status, error: run.error }).toEqual({ status: 'success', error: null });
      expect(run.durationMs).not.toBeNull();

      const row = await prisma.schedulerJobRun.findUnique({ where: { id: res.body.run.id } });
      expect(row).toMatchObject({ trigger: 'manual', triggeredByUserId: adminId });
      if (jobName === 'settlement') expect(run.summary).toEqual({ cycleNumber: 1 });
    }, RUN_TIMEOUT_MS + 10_000);
  }

  it('shows the finished runs on the overview and in the history', async () => {
    const overview = await request(baseUrl).get('/api/admin/scheduler/overview').set('Authorization', `Bearer ${adminToken}`);
    expect(overview.status).toBe(200);
    expect(overview.body.slots).toHaveLength(10);
    for (const slot of overview.body.slots) {
      expect(slot.lastRun).toMatchObject({ status: 'success', trigger: 'manual' });
    }

    const history = await request(baseUrl).get('/api/admin/scheduler/runs?limit=100').set('Authorization', `Bearer ${adminToken}`);
    expect(history.status).toBe(200);
    expect(history.body.entries.filter((entry: { kind: string }) => entry.kind === 'run')).toHaveLength(10);
    expect(history.body.entries.filter((entry: { kind: string }) => entry.kind === 'restart')).toHaveLength(1);
  });

  it('runs bulk cycles in the background under the scheduler lock, and refuses a second start', async () => {
    const res = await request(baseUrl)
      .post('/api/admin/cycles/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ cycles: 1, includeTournaments: false, includeKoth: false, includeDailyFinances: false, background: true });

    expect(res.status).toBe(202);
    expect(res.body.run).toMatchObject({ jobName: 'bulkCycles', status: 'queued' });
    // The bulk run holds the scheduler lock.
    expect(getActiveJobNames()).toContain('bulkCycles');

    const second = await request(baseUrl)
      .post('/api/admin/cycles/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ cycles: 1, background: true });
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('SCHEDULER_JOB_ALREADY_ACTIVE');

    // A manual job started meanwhile waits behind it.
    const league = await request(baseUrl)
      .post('/api/admin/scheduler/runs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ jobName: 'league' });
    expect(league.status).toBe(202);
    expect(getActiveJobNames()).toEqual(['bulkCycles', 'league']);

    const bulk = await waitForRun(res.body.run.id);
    expect(bulk.status).toBe('success');
    expect(bulk.summary).toMatchObject({ bulk: { cyclesRequested: 1, cyclesCompleted: 1, generateUsersPerCycle: false } });
    expect((await waitForRun(league.body.run.id)).status).toBe('success');
  }, RUN_TIMEOUT_MS * 2);
});

/** Remove generated stables (settlement generates one per closed cycle). */
async function clearGeneratedFixtures(): Promise<void> {
  const autoUsers = await prisma.user.findMany({ where: { username: { startsWith: 'auto_' } }, select: { id: true } });
  const userIds = autoUsers.map((user) => user.id);
  if (userIds.length === 0) return;

  const [robots, teams] = await Promise.all([
    prisma.robot.findMany({ where: { userId: { in: userIds } }, select: { id: true } }),
    prisma.teamBattle.findMany({ where: { stableId: { in: userIds } }, select: { id: true } }),
  ]);
  const robotIds = robots.map((robot) => robot.id);
  const teamIds = teams.map((team) => team.id);

  if (robotIds.length > 0) {
    const battles = await prisma.battle.findMany({ where: { participants: { some: { robotId: { in: robotIds } } } }, select: { id: true } });
    if (battles.length > 0) await prisma.battle.deleteMany({ where: { id: { in: battles.map((battle) => battle.id) } } });
  }
  await prisma.financialLedger.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.auditLog.deleteMany({
    where: { OR: [{ userId: { in: userIds } }, ...(robotIds.length > 0 ? [{ robotId: { in: robotIds } }] : [])] },
  });
  await prisma.leagueHistory.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.standing.deleteMany({
    where: {
      OR: [
        ...(robotIds.length > 0 ? [{ entityType: 'robot', entityId: { in: robotIds } }] : []),
        ...(teamIds.length > 0 ? [{ entityType: 'team', entityId: { in: teamIds } }] : []),
      ],
    },
  });
  if (teamIds.length > 0) await prisma.teamBattle.deleteMany({ where: { id: { in: teamIds } } });
  if (robotIds.length > 0) await prisma.subscription.deleteMany({ where: { robotId: { in: robotIds } } });
  await prisma.weaponInventory.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.robot.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}
