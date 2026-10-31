/**
 * Players and Economy admin services against a real database: segments,
 * the detail panel's ledger cashflow and per-mode tiers, the stable search,
 * the password-reset guard, and the ledger flows per stable type.
 *
 * Economy totals are database-wide, so the economy tests compare the result
 * before and after this suite's own ledger rows.
 */

import prisma from '../../src/lib/prisma';
import { assertHumanStable, getPlayerDetail, getPlayersOverview, searchStables } from '../../src/services/admin/adminPlayersService';
import { getEconomyOverview, invalidateEconomyCache } from '../../src/services/admin/adminEconomyService';
import { getCurrentSeason, invalidateSeasonCache } from '../../src/services/season/seasonService';

const TAG = `apeit${Date.now() % 1_000_000}`;
const createdUsers: number[] = [];
let originalCycles: number | null = null;
let season: { seasonNumber: number; startedAt: Date } | null = null;
const CYCLE = 40;

async function user(name: string, data: Partial<{ stableType: 'human' | 'automaton' | 'generated'; isGenerated: boolean; currency: number; lastLoginAt: Date | null; createdAt: Date }> = {}): Promise<number> {
  const row = await prisma.user.create({
    data: {
      username: `${TAG}_${name}`,
      passwordHash: 'test-hash',
      stableName: `${TAG} ${name}`.slice(0, 30),
      email: `${TAG}_${name}@example.test`,
      currency: data.currency ?? 500_000,
      stableType: data.stableType ?? 'human',
      isGenerated: data.isGenerated ?? false,
      lastLoginAt: data.lastLoginAt === undefined ? new Date() : data.lastLoginAt,
      ...(data.createdAt ? { createdAt: data.createdAt } : {}),
      hasCompletedOnboarding: true,
    },
  });
  createdUsers.push(row.id);
  return row.id;
}

async function ledger(userId: number, cycleNumber: number, transactionType: string, amount: number, balanceAfter: number): Promise<void> {
  await prisma.financialLedger.create({ data: { userId, cycleNumber, transactionType, amount, balanceAfter, description: `${TAG} test row` } });
}

let player: number;
let lowPlayer: number;
let automaton: number;
let robotId: number;

beforeAll(async () => {
  const meta = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
  originalCycles = meta?.totalCycles ?? null;
  await prisma.cycleMetadata.upsert({ where: { id: 1 }, update: { totalCycles: CYCLE }, create: { id: 1, totalCycles: CYCLE } });
  invalidateSeasonCache();
  // The current season started 30 days ago, so a login 5 days ago is this season.
  const { seasonNumber } = await getCurrentSeason();
  const row = await prisma.season.findUniqueOrThrow({ where: { seasonNumber } });
  season = { seasonNumber, startedAt: row.startedAt };
  await prisma.season.update({ where: { seasonNumber }, data: { startedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } });

  player = await user('player');
  lowPlayer = await user('low', { currency: 4_000, lastLoginAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) });
  automaton = await user('auto', { stableType: 'automaton' });

  const robot = await prisma.robot.create({ data: { userId: player, name: `${TAG}_robot`, currentHP: 80, maxHP: 100, currentShield: 0, maxShield: 0, battleReadiness: 80 } });
  robotId = robot.id;
  await prisma.standing.create({ data: { entityType: 'robot', entityId: robotId, mode: 'league_1v1', tier: 'silver', leagueInstanceId: 'silver_1', leaguePoints: 10 } });
  await prisma.standing.create({ data: { entityType: 'robot', entityId: robotId, mode: 'koth', tier: 'bronze', leagueInstanceId: 'bronze_1', leaguePoints: 0 } });
  await prisma.subscription.create({ data: { robotId, eventType: 'league_1v1' } });
  await prisma.facility.create({ data: { userId: player, facilityType: 'repair_bay', level: 2 } });
});

afterAll(async () => {
  await prisma.financialLedger.deleteMany({ where: { description: `${TAG} test row` } });
  await prisma.subscription.deleteMany({ where: { robotId } });
  await prisma.standing.deleteMany({ where: { entityType: 'robot', entityId: robotId } });
  await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
  if (originalCycles === null) await prisma.cycleMetadata.deleteMany({ where: { id: 1 } });
  else await prisma.cycleMetadata.update({ where: { id: 1 }, data: { totalCycles: originalCycles } });
  if (season) await prisma.season.update({ where: { seasonNumber: season.seasonNumber }, data: { startedAt: season.startedAt } });
  invalidateSeasonCache();
  invalidateEconomyCache();
});

describe('Players overview', () => {
  it('lists human stables only, with segment and issues', async () => {
    const overview = await getPlayersOverview();
    const ids = overview.players.map((p) => p.userId);
    expect(ids).toEqual(expect.arrayContaining([player, lowPlayer]));
    expect(ids).not.toContain(automaton);

    const low = overview.players.find((p) => p.userId === lowPlayer);
    expect(low).toMatchObject({ segment: 'inactive', currency: 4_000 });
    expect(low?.issues.map((i) => i.code)).toEqual(['no_robots', 'low_balance']);
    expect(overview.players.find((p) => p.userId === player)?.segment).toBe('active');
    expect(overview.counts.all).toBe(overview.players.length);
    expect(overview.counts.active + overview.counts.inactive + overview.counts.dormant).toBe(overview.counts.all);
  });
});

describe('Stable detail', () => {
  it('reads tiers per mode, subscriptions, facilities and the ledger cashflow', async () => {
    await ledger(player, CYCLE - 1, 'battle_income', 9_000, 509_000);
    await ledger(player, CYCLE - 1, 'repair_cost', -2_000, 507_000);
    await ledger(player, CYCLE, 'attribute_upgrade', -5_000, 502_000);

    const detail = await getPlayerDetail(player);

    expect(detail).toMatchObject({ stableKind: 'human', automatonKey: null, segment: 'active' });
    expect(detail.robots[0]).toMatchObject({ id: robotId, hpPercent: 80, battleReady: false, tiers: { league_1v1: 'silver', koth: 'bronze' }, subscriptions: ['league_1v1'] });
    expect(detail.facilities).toEqual([{ type: 'repair_bay', level: 2 }]);
    expect(detail.cashflow.points).toEqual([
      { cycle: CYCLE - 1, balance: 507_000, earned: 9_000, runningCosts: 2_000, bought: 0 },
      { cycle: CYCLE, balance: 502_000, earned: 0, runningCosts: 0, bought: 5_000 },
    ]);
    expect(detail.cashflow).toMatchObject({ earned: 9_000, runningCosts: 2_000, bought: 5_000, lowBalanceCycles: 0 });
  });

  it('marks an Automaton and leaves out the player-only parts', async () => {
    const detail = await getPlayerDetail(automaton);
    expect(detail).toMatchObject({ stableKind: 'automaton', segment: null, issues: [] });
  });

  it('404s an unknown stable', async () => {
    await expect(getPlayerDetail(2_000_000_000)).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
  });
});

describe('Stable search', () => {
  it('finds by robot name, by #id and every stable type', async () => {
    expect((await searchStables(`${TAG}_robot`)).map((r) => r.id)).toEqual([player]);
    expect((await searchStables(`#${automaton}`)).find((r) => r.id === automaton)?.stableKind).toBe('automaton');
    const all = await searchStables(TAG);
    expect(all.map((r) => r.id)).toEqual(expect.arrayContaining([player, lowPlayer, automaton]));
    expect(all[0].stableKind).toBe('human');
  });
});

describe('Password reset guard', () => {
  it('allows a player and refuses an Automaton', async () => {
    await expect(assertHumanStable(player)).resolves.toBeUndefined();
    await expect(assertHumanStable(automaton)).rejects.toMatchObject({ code: 'PASSWORD_RESET_NOT_ALLOWED', statusCode: 400 });
  });
});

describe('Economy overview', () => {
  it('adds the suite\'s ledger rows to the right scope, window and flow', async () => {
    const before = await getEconomyOverview('players', '7', { fresh: true });
    const beforeAutomatons = await getEconomyOverview('automatons', '7', { fresh: true });

    await ledger(lowPlayer, CYCLE, 'battle_income', 1_000, 5_000);
    await ledger(lowPlayer, CYCLE, 'repair_cost', -250, 4_750);
    await ledger(lowPlayer, CYCLE, 'robot_creation', -100, 4_650);
    await ledger(lowPlayer, CYCLE - 10, 'battle_income', 7_777, 0); // outside the 7-cycle window
    await ledger(automaton, CYCLE, 'passive_income', 300, 500_300);

    const after = await getEconomyOverview('players', '7', { fresh: true });
    const afterAutomatons = await getEconomyOverview('automatons', '7', { fresh: true });

    expect(after.scope).toMatchObject({ fromCycle: CYCLE - 6, toCycle: CYCLE, cycles: 7 });
    expect(after.kpis.earned - before.kpis.earned).toBe(1_000);
    expect(after.kpis.spent - before.kpis.spent).toBe(350);
    const flow = (o: typeof after, list: 'sources' | 'sinks', key: string): number => o[list].find((f) => f.key === key)?.amount ?? 0;
    expect(flow(after, 'sources', 'battle_income') - flow(before, 'sources', 'battle_income')).toBe(1_000);
    expect(flow(after, 'sinks', 'repair_cost') - flow(before, 'sinks', 'repair_cost')).toBe(250);
    expect(flow(after, 'sinks', 'weapons_and_robots') - flow(before, 'sinks', 'weapons_and_robots')).toBe(100);
    expect(afterAutomatons.kpis.earned - beforeAutomatons.kpis.earned).toBe(300);
    expect(flow(afterAutomatons, 'sources', 'passive_income') - flow(beforeAutomatons, 'sources', 'passive_income')).toBe(300);

    const lastCycle = (o: typeof after): { earned: number; spent: number } => o.perCycle.find((c) => c.cycle === CYCLE) ?? { earned: 0, spent: 0 };
    expect(lastCycle(after).earned - lastCycle(before).earned).toBe(1_000);
    expect(after.perCycle.length).toBeGreaterThanOrEqual(15);

    const season = await getEconomyOverview('players', 'season', { fresh: true });
    expect(season.scope.fromCycle).toBe(1);
    expect(season.kpis.earned - after.kpis.earned).toBeGreaterThanOrEqual(7_777);
  });

  it('counts balances per stable type', async () => {
    const overview = await getEconomyOverview('players', '7', { fresh: true });
    const players = overview.byStableType.find((r) => r.stables === 'players');
    expect(players?.count).toBe(overview.kpis.stables);
    expect(players?.heldNow).toBe(overview.kpis.heldNow);
    expect(overview.balanceBands.reduce((sum, b) => sum + b.count, 0)).toBe(overview.kpis.stables);
  });
});
