/**
 * Dormant human stables at the season rollover: who is deleted, who is kept,
 * and what the preview reports. Real database (the delete cascades through
 * robots, standings and battle references).
 */

import prisma from '../../src/lib/prisma';
import { deleteDormantHumanStables, previewRollover } from '../../src/services/season/seasonPurgeService';
import { dormantHumanStableWhere, isDormant } from '../../src/services/season/dormantStables';
import { invalidateSeasonCache } from '../../src/services/season/seasonService';

const SEASON_START = new Date('2026-08-01T00:00:00Z');
const BEFORE = new Date('2026-07-15T00:00:00Z');
const DURING = new Date('2026-09-10T00:00:00Z');
const PREFIX = `dormant_it_${Date.now()}_`;

interface Seed {
  username: string;
  createdAt: Date;
  lastLoginAt: Date | null;
  role?: string;
  stableType?: 'human' | 'automaton' | 'generated';
  isGenerated?: boolean;
  withRobot?: boolean;
}

const createdIds: number[] = [];

async function seed(entry: Seed): Promise<number> {
  const user = await prisma.user.create({
    data: {
      username: `${PREFIX}${entry.username}`,
      passwordHash: 'test-hash',
      stableName: `${PREFIX}${entry.username}`.slice(0, 30),
      createdAt: entry.createdAt,
      lastLoginAt: entry.lastLoginAt,
      role: entry.role ?? 'user',
      stableType: entry.stableType ?? 'human',
      isGenerated: entry.isGenerated ?? false,
    },
  });
  createdIds.push(user.id);
  if (entry.withRobot) {
    const robot = await prisma.robot.create({ data: { userId: user.id, name: `${PREFIX}${entry.username}_r`.slice(0, 50), currentHP: 100, maxHP: 100, currentShield: 0, maxShield: 0 } });
    await prisma.standing.create({
      data: { entityType: 'robot', entityId: robot.id, mode: 'league_1v1', tier: 'bronze', leagueInstanceId: 'bronze_1', leaguePoints: 0 },
    });
  }
  return user.id;
}

async function existing(ids: number[]): Promise<number[]> {
  const rows = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true } });
  return rows.map((row) => row.id).sort((a, b) => a - b);
}

describe('dormant human stables', () => {
  let neverLoggedIn: number;
  let loggedInBefore: number;
  let dormantWithRobot: number;
  let active: number;
  let registeredDuring: number;
  let admin: number;
  let automaton: number;

  beforeAll(async () => {
    neverLoggedIn = await seed({ username: 'never', createdAt: BEFORE, lastLoginAt: null });
    loggedInBefore = await seed({ username: 'before', createdAt: BEFORE, lastLoginAt: BEFORE });
    dormantWithRobot = await seed({ username: 'robot', createdAt: BEFORE, lastLoginAt: BEFORE, withRobot: true });
    active = await seed({ username: 'active', createdAt: BEFORE, lastLoginAt: DURING, withRobot: true });
    registeredDuring = await seed({ username: 'newbie', createdAt: DURING, lastLoginAt: null });
    admin = await seed({ username: 'admin', createdAt: BEFORE, lastLoginAt: BEFORE, role: 'admin' });
    automaton = await seed({ username: 'auto', createdAt: BEFORE, lastLoginAt: null, stableType: 'automaton' });
  });

  afterAll(async () => {
    const robots = await prisma.robot.findMany({ where: { userId: { in: createdIds } }, select: { id: true } });
    await prisma.standing.deleteMany({ where: { entityType: 'robot', entityId: { in: robots.map((r) => r.id) } } });
    await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
  });

  it('isDormant compares the last login, or the registration without one, with the season start', () => {
    expect(isDormant({ lastLoginAt: null, createdAt: BEFORE }, SEASON_START)).toBe(true);
    expect(isDormant({ lastLoginAt: BEFORE, createdAt: BEFORE }, SEASON_START)).toBe(true);
    expect(isDormant({ lastLoginAt: DURING, createdAt: BEFORE }, SEASON_START)).toBe(false);
    expect(isDormant({ lastLoginAt: null, createdAt: DURING }, SEASON_START)).toBe(false);
  });

  it('selects only dormant human players, never admins, Automatons or this season\'s registrations', async () => {
    const rows = await prisma.user.findMany({
      where: { AND: [dormantHumanStableWhere(SEASON_START), { id: { in: createdIds } }] },
      select: { id: true },
    });
    expect(rows.map((row) => row.id).sort((a, b) => a - b)).toEqual([neverLoggedIn, loggedInBefore, dormantWithRobot].sort((a, b) => a - b));
  });

  it('the preview counts the dormant stables of the current season', async () => {
    invalidateSeasonCache();
    const preview = await previewRollover(); // creates the active season on a bare database
    const season = await prisma.season.findFirstOrThrow({ where: { phase: { not: 'completed' } }, orderBy: { seasonNumber: 'desc' } });
    const expected = await prisma.user.count({ where: dormantHumanStableWhere(season.startedAt) });
    expect(preview.dormantHumanStables.count).toBe(expected);
    expect(preview.dormantHumanStables.names.length).toBeLessThanOrEqual(50);
  });

  it('deletes the dormant stables with their robots and standings, and keeps the rest', async () => {
    const robotIds = (await prisma.robot.findMany({ where: { userId: dormantWithRobot }, select: { id: true } })).map((r) => r.id);
    const before = await prisma.user.count({ where: dormantHumanStableWhere(SEASON_START) });

    const deleted = await deleteDormantHumanStables(SEASON_START);

    expect(deleted).toBe(before);
    expect(await existing(createdIds)).toEqual([active, registeredDuring, admin, automaton].sort((a, b) => a - b));
    expect(await prisma.robot.count({ where: { id: { in: robotIds } } })).toBe(0);
    expect(await prisma.standing.count({ where: { entityType: 'robot', entityId: { in: robotIds } } })).toBe(0);
    expect(await prisma.robot.count({ where: { userId: active } })).toBe(1);
  });
});
