/**
 * Strategies → Economy, the Editor's Cashflow card and the Status_Bar's
 * reasons against the real database. The suite's stables are activated on
 * dates no real stable has, so the activation-batch filter isolates them.
 */
import prisma from '../../src/lib/prisma';
import { clearStrategyEconomyCache, getStrategyEconomy } from '../../src/services/automaton/strategyEconomyService';
import { getAutomatonStatus } from '../../src/services/automaton/automatonStatus';
import { getStrategyRegistry } from '../../src/services/automaton/strategies/defaultRegistry';
import { describeBuildOrder, defaultParameters, resolveGoalTarget } from '../../src/services/automaton/strategies/strategyParameters';
import { createAutomatonStable, deleteAutomatonStables } from '../helpers/automatonStable';
import { runTag, startAdminApi, type AdminApiHarness } from '../helpers/automatonAdminApi';

const tag = runTag();
const BATCH = '2001-02-03';
const OTHER_BATCH = '2001-02-04';
const CYCLE = 30;

describe('Strategy economy (admin redesign part 5)', () => {
  let harness: AdminApiHarness;
  const userIds: number[] = [];
  let originalCycles: number | null = null;
  let rich: { userId: number; profileId: number; catalogueKey: string };
  let broke: { userId: number; profileId: number; catalogueKey: string };
  let later: { userId: number; profileId: number; catalogueKey: string };

  async function ledger(userId: number, cycleNumber: number, transactionType: string, amount: number, balanceAfter: number): Promise<void> {
    await prisma.financialLedger.create({ data: { userId, cycleNumber, transactionType, amount, balanceAfter, description: `t55eco ${tag}` } });
  }

  beforeAll(async () => {
    harness = await startAdminApi(`eco${tag}`);
    const meta = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
    originalCycles = meta?.totalCycles ?? null;
    await prisma.cycleMetadata.upsert({ where: { id: 1 }, update: { totalCycles: CYCLE }, create: { id: 1, totalCycles: CYCLE } });

    rich = await createAutomatonStable({ tag: `ecor${tag}`, balance: 400_000, blueprints: [], strategyKey: 'swarm' });
    broke = await createAutomatonStable({ tag: `ecob${tag}`, balance: -20_000, blueprints: [], strategyKey: 'swarm' });
    later = await createAutomatonStable({ tag: `ecol${tag}`, balance: 50_000, blueprints: [], strategyKey: 'swarm' });
    userIds.push(rich.userId, broke.userId, later.userId);
    await prisma.automatonProfile.update({ where: { id: rich.profileId }, data: { activatedAt: new Date(`${BATCH}T09:00:00Z`) } });
    await prisma.automatonProfile.update({ where: { id: broke.profileId }, data: { activatedAt: new Date(`${BATCH}T10:00:00Z`) } });
    await prisma.automatonProfile.update({ where: { id: later.profileId }, data: { activatedAt: new Date(`${OTHER_BATCH}T10:00:00Z`) } });

    // rich: 2 cycles in the window, earned 30k, running costs 10k (+ a purchase, not a running cost).
    await ledger(rich.userId, CYCLE - 1, 'battle_income', 20_000, 420_000);
    await ledger(rich.userId, CYCLE - 1, 'repair_cost', -6_000, 414_000);
    await ledger(rich.userId, CYCLE, 'streaming_revenue', 10_000, 424_000);
    await ledger(rich.userId, CYCLE, 'operating_costs', -4_000, 420_000);
    await ledger(rich.userId, CYCLE, 'facility_upgrade', -20_000, 400_000);
    // broke: 1 cycle in the window, earned 2k, running costs 8k; an old row outside the window.
    await ledger(broke.userId, CYCLE, 'battle_income', 2_000, -12_000);
    await ledger(broke.userId, CYCLE, 'repair_cost', -8_000, -20_000);
    await ledger(broke.userId, CYCLE - 20, 'battle_income', 99_999, 0);

    const swarm = getStrategyRegistry().getStrategy('swarm', 1);
    const goal = swarm?.buildOrder[0];
    if (!goal) throw new Error('swarm v1 has no build order');
    for (const stable of [rich, broke]) {
      await prisma.automatonTurn.create({
        data: {
          profileId: stable.profileId, seasonNumber: 1, trigger: 'settlement', slot: CYCLE, status: 'completed',
          strategyKey: 'swarm', strategyVersion: 1, startBalance: 0, endBalance: 0,
          goalOutcomes: [{ goalId: goal.id, kind: 'saving', cost: 500_000, detail: {} }],
        },
      });
    }
    clearStrategyEconomyCache();
  });

  afterAll(async () => {
    await prisma.financialLedger.deleteMany({ where: { description: `t55eco ${tag}` } });
    await deleteAutomatonStables(userIds);
    if (originalCycles === null) await prisma.cycleMetadata.deleteMany({ where: { id: 1 } });
    else await prisma.cycleMetadata.update({ where: { id: 1 }, data: { totalCycles: originalCycles } });
    clearStrategyEconomyCache();
    await harness.close();
  });

  it('reports deficit, median, per-cycle flows and the most common saving goal for one batch', async () => {
    const economy = await getStrategyEconomy(BATCH);
    const swarm = getStrategyRegistry().getStrategy('swarm', 1);
    const goal = swarm!.buildOrder[0];

    expect(economy.window).toEqual({ fromCycle: CYCLE - 6, toCycle: CYCLE });
    expect(economy.batches).toEqual(expect.arrayContaining([{ date: BATCH, stables: 2 }, { date: OTHER_BATCH, stables: 1 }]));
    expect(economy.activated).toBe(BATCH);
    expect(economy.rows).toHaveLength(1);
    expect(economy.rows[0]).toMatchObject({
      strategyKey: 'swarm',
      stables: 2,
      inDeficit: 1,
      medianBalance: -20_000,
      // (30k + 2k) earned and (10k + 8k) running costs over 2 + 1 stable-cycles.
      earnedPerCycle: Math.round(32_000 / 3),
      runningCostsPerCycle: 6_000,
      topSavingGoal: {
        label: describeBuildOrder([goal])[0].label,
        target: resolveGoalTarget(goal, defaultParameters(swarm!.buildOrder)),
        stables: 2,
      },
    });
    expect(economy.totals).toEqual({ stables: 2, inDeficit: 1 });
  });

  it('serves the view over HTTP, validates the batch date and returns a stable\'s cashflow', async () => {
    const view = await harness.api('get', `/strategies/economy?activated=${OTHER_BATCH}`);
    expect(view.status).toBe(200);
    expect(view.body.rows[0]).toMatchObject({ stables: 1, inDeficit: 0, earnedPerCycle: null });
    expect((await harness.api('get', '/strategies/economy?activated=yesterday')).status).toBe(400);
    expect((await harness.api('get', '/strategies/economy', harness.playerToken)).status).toBe(403);

    const cashflow = await harness.api('get', `/${rich.catalogueKey}/cashflow`);
    expect(cashflow.status).toBe(200);
    expect(cashflow.body.points).toEqual([
      { cycle: CYCLE - 1, balance: 414_000, earned: 20_000, runningCosts: 6_000, bought: 0 },
      { cycle: CYCLE, balance: 400_000, earned: 10_000, runningCosts: 4_000, bought: 20_000 },
    ]);
    expect((await harness.api('get', '/t-no-such-stable/cashflow')).status).toBe(404);
  });

  it('counts Need_Attention per reason on the Status_Bar', async () => {
    const status = await getAutomatonStatus();
    expect(status.needAttentionByReason.balance_negative).toBeGreaterThanOrEqual(1);
    const total = Object.values(status.needAttentionByReason).reduce((sum, n) => sum + n, 0);
    expect(total).toBeGreaterThanOrEqual(status.needAttentionCount);
  });

  it('lists every profile in one request', async () => {
    const res = await harness.api('get', '/?limit=1000');
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(1000);
    const listed = res.body.items.find((item: { catalogueKey: string }) => item.catalogueKey === rich.catalogueKey);
    expect(listed?.lastTurn).toMatchObject({ trigger: 'settlement', slot: CYCLE, status: 'completed' });
    expect((await harness.api('get', '/?limit=1001')).status).toBe(400);
  });
});
