/**
 * Players and Economy admin services against a real database: segments,
 * the detail panel's ledger cashflow and per-mode tiers, the stable search,
 * the password-reset guard, and the ledger flows per stable type.
 *
 * Economy totals are database-wide, so the economy tests compare the result
 * before and after this suite's own ledger rows. Closed cycles are summed once
 * into `economy_cycle_rollups`; the newest closed cycle (`CYCLE`) is live.
 */

import prisma from '../../src/lib/prisma';
import { assertHumanStable, getPlayerDetail, getPlayersOverview, searchStables } from '../../src/services/admin/adminPlayersService';
import { getEconomyOverview, invalidateEconomyCache } from '../../src/services/admin/adminEconomyService';
import { clearEconomyRollups, loadCycleTotals, waitForEconomyRollups } from '../../src/services/admin/economyCycleRollups';
import { getCurrentSeason, invalidateSeasonCache } from '../../src/services/season/seasonService';
import type { EconomyOverview, EconomyStableScope, EconomyWindow } from '../../src/shared/types';

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

/** The Economy overview once every cycle it needs is summed. */
async function economy(stables: EconomyStableScope, window: EconomyWindow): Promise<EconomyOverview> {
  let result = await getEconomyOverview(stables, window, { fresh: true });
  if (result.status === 'preparing') {
    await waitForEconomyRollups();
    result = await getEconomyOverview(stables, window, { fresh: true });
  }
  if (result.status !== 'ready') throw new Error('economy still preparing');
  return result;
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
  await clearEconomyRollups();
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
    const before = await economy('players', '7');
    const beforeAutomatons = await economy('automatons', '7');

    await ledger(lowPlayer, CYCLE, 'battle_income', 1_000, 5_000);
    await ledger(lowPlayer, CYCLE, 'repair_cost', -250, 4_750);
    await ledger(lowPlayer, CYCLE, 'robot_creation', -100, 4_650);
    await ledger(lowPlayer, CYCLE - 10, 'battle_income', 7_777, 0); // outside the 7-cycle window
    await ledger(automaton, CYCLE, 'passive_income', 300, 500_300);

    const after = await economy('players', '7');
    const afterAutomatons = await economy('automatons', '7');

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

    // Cycle CYCLE − 10 was already summed and stored by the calls above; a closed cycle never changes in
    // production, so the hand-written row only shows once the stored totals are cleared.
    const stale = await economy('players', 'season');
    await clearEconomyRollups();
    const season = await economy('players', 'season');
    expect(season.kpis.earned - stale.kpis.earned).toBe(7_777);
    expect(season.scope.fromCycle).toBe(1);
    expect(season.kpis.earned - after.kpis.earned).toBeGreaterThanOrEqual(7_777);
  });

  it('reads the Repairs block from the repair_cost breakdowns', async () => {
    const before = await economy('players', '7');
    const repair = (userId: number, repairType: 'manual' | 'automatic', baseQuote: number, afterBay: number, paid: number) =>
      prisma.financialLedger.create({
        data: {
          userId, cycleNumber: CYCLE, transactionType: 'repair_cost', amount: -paid, balanceAfter: 0, description: `${TAG} test row`,
          metadata: { repairType, baseQuote, quoteBeforeManualDiscount: afterBay, finalAmount: -paid },
        },
      });
    await repair(lowPlayer, 'manual', 1_000, 800, 400);
    await repair(lowPlayer, 'automatic', 600, 500, 500);
    await repair(automaton, 'automatic', 300, 300, 300);
    // A row written before the breakdown existed: its full price is what was paid.
    await ledger(player, CYCLE, 'repair_cost', -70, 1);

    const after = await economy('players', '7');
    const delta = (key: 'automatic' | 'manual' | 'total', field: 'repairs' | 'fullPrice' | 'repairBayDiscount' | 'manualDiscount' | 'paid'): number =>
      after.repairs[key][field] - before.repairs[key][field];

    expect([delta('manual', 'repairs'), delta('manual', 'fullPrice'), delta('manual', 'repairBayDiscount'), delta('manual', 'manualDiscount'), delta('manual', 'paid')])
      .toEqual([1, 1_000, 200, 400, 400]);
    expect([delta('automatic', 'repairs'), delta('automatic', 'fullPrice'), delta('automatic', 'repairBayDiscount'), delta('automatic', 'paid')])
      .toEqual([2, 670, 100, 570]);
    expect(after.repairs.playerStables).not.toBeNull();
    expect(after.repairs.playerStables!.manual).toBeGreaterThanOrEqual(1);

    const automatons = after.repairs.byStableType.find((row) => row.stables === 'automatons');
    const automatonsBefore = before.repairs.byStableType.find((row) => row.stables === 'automatons');
    expect(automatons!.repairs - automatonsBefore!.repairs).toBe(1);
    expect(automatons!.paid - automatonsBefore!.paid).toBe(300);
  });

  it('stores closed cycles once, sums the newest live, and reports progress while summing', async () => {
    const { seasonNumber } = await getCurrentSeason();
    await clearEconomyRollups();
    await prisma.economyCycleRollup.create({ data: { seasonNumber: seasonNumber + 99, cycleNumber: 1, flows: [], repairs: [] } });

    const first = await loadCycleTotals(seasonNumber, CYCLE, [lowPlayer], 0);
    expect(first.completeFrom).toBeGreaterThan(1);
    expect(first.cycles.at(-1)?.cycle).toBe(CYCLE);
    await waitForEconomyRollups();

    const stored = await prisma.economyCycleRollup.findMany({ where: { seasonNumber }, select: { cycleNumber: true } });
    expect(stored.map((r) => r.cycleNumber).sort((a, b) => a - b)).toEqual(Array.from({ length: CYCLE - 1 }, (_, i) => i + 1));
    expect(await prisma.economyCycleRollup.count({ where: { seasonNumber: seasonNumber + 99 } })).toBe(0);

    const second = await loadCycleTotals(seasonNumber, CYCLE, [lowPlayer], 0);
    expect(second.completeFrom).toBe(1);
    const flowOf = (cycles: typeof second.cycles, cycle: number): number => cycles.find((c) => c.cycle === cycle)?.flows
      .filter((f) => f.kind === 'players' && f.transactionType === 'battle_income').reduce((sum, f) => sum + f.income, 0) ?? 0;
    const closedBefore = flowOf(second.cycles, CYCLE - 1);
    const liveBefore = flowOf(second.cycles, CYCLE);
    await ledger(lowPlayer, CYCLE - 1, 'battle_income', 50, 0);
    await ledger(lowPlayer, CYCLE, 'battle_income', 60, 0);
    const third = await loadCycleTotals(seasonNumber, CYCLE, [lowPlayer], 0);
    expect(flowOf(third.cycles, CYCLE - 1)).toBe(closedBefore); // stored, not rescanned
    expect(flowOf(third.cycles, CYCLE) - liveBefore).toBe(60); // live
    await clearEconomyRollups();
  });

  it('counts balances per stable type', async () => {
    const overview = await economy('players', '7');
    const players = overview.byStableType.find((r) => r.stables === 'players');
    expect(players?.count).toBe(overview.kpis.stables);
    expect(players?.heldNow).toBe(overview.kpis.heldNow);
    expect(overview.balanceBands.reduce((sum, b) => sum + b.count, 0)).toBe(overview.kpis.stables);
  });
});
