/**
 * Spec #55 task 9.6 — Need_Attention on the list endpoint, the `attention`
 * filter and the Status_Bar (`GET /status`) against the real database
 * (R11.11, R11.12, design §17.1, §17.1a).
 *
 * Turn_Records are inserted directly, dated in the future so this suite's
 * Turn_Step is the most recent one on the shared dev database.
 */
import prisma from '../../src/lib/prisma';
import { createAutomatonStable, deleteAutomatonStables, type AutomatonStableFixture } from '../helpers/automatonStable';
import { runTag, startAdminApi, type AdminApiHarness } from '../helpers/automatonAdminApi';

const tag = runTag();
const SEASON = 9_100 + Math.floor(Math.random() * 800);
const LAST_SLOT = 17;
const BASE_TIME = Date.now() + 2 * 24 * 60 * 60 * 1000;

interface TurnSpec {
  slot: number;
  status: 'completed' | 'failed' | 'skipped';
  creditsSpent?: number;
  reason?: string;
}

/** Slots 1…17 completed with nothing spent, then overrides. */
function turns(overrides: Record<number, Partial<TurnSpec>> = {}): TurnSpec[] {
  return Array.from({ length: LAST_SLOT }, (_, i) => ({ slot: i + 1, status: 'completed' as const, creditsSpent: 0, ...overrides[i + 1] }));
}

describe('Need_Attention and the Status_Bar (Spec #55 task 9.6)', () => {
  let harness: AdminApiHarness;
  const stables: Record<string, AutomatonStableFixture> = {};
  let baseline: { failedCount: number; needAttentionCount: number };

  const plans: Record<string, { balance: number; turns: TurnSpec[] }> = {
    // Failed last cycle, negative balance and 16 zero-spend completed cycles before it.
    a: { balance: -500, turns: turns({ [LAST_SLOT]: { status: 'failed', reason: 'AUTOMATON_WEAPON_UNKNOWN' } }) },
    // 13 zero-spend completed cycles after a purchase: inside the window, no reason.
    b: { balance: 1_000, turns: turns({ 4: { creditsSpent: 1_000 } }) },
    // A purchase at cycle 10 resets the run (7 since).
    c: { balance: 1_000, turns: turns({ 10: { creditsSpent: 500 } }) },
    // 15 zero-spend completed cycles; skipped cycles are passed over.
    d: { balance: 1_000, turns: turns({ 3: { status: 'skipped', reason: 'program_off' }, 9: { status: 'skipped', reason: 'program_off' } }) },
    // Exactly 14 zero-spend completed cycles.
    e: { balance: 1_000, turns: turns({ 1: { creditsSpent: 10 }, 2: { creditsSpent: 10 }, 3: { creditsSpent: 10 } }) },
  };
  const order = Object.keys(plans);

  beforeAll(async () => {
    harness = await startAdminApi(`na${tag}`);
    const status = await harness.api('get', '/status');
    baseline = { failedCount: status.body.failedCount, needAttentionCount: status.body.needAttentionCount };
    for (const name of order) {
      stables[name] = await createAutomatonStable({ tag: `na${name}${tag}`, balance: plans[name].balance, blueprints: [] });
    }
    for (const [index, name] of order.entries()) {
      await prisma.automatonTurn.createMany({
        data: plans[name].turns.map((t) => {
          const startedAt = new Date(BASE_TIME + t.slot * 60_000 + index * 1_000);
          return {
            profileId: stables[name].profileId,
            seasonNumber: SEASON,
            trigger: 'settlement' as const,
            slot: t.slot,
            status: t.status,
            reason: t.reason ?? null,
            strategyKey: 'swarm',
            strategyVersion: 1,
            startBalance: plans[name].balance,
            endBalance: plans[name].balance,
            creditsSpent: t.creditsSpent ?? 0,
            startedAt,
            finishedAt: new Date(startedAt.getTime() + 500),
          };
        }),
      });
    }
  });

  afterAll(async () => {
    await deleteAutomatonStables(Object.values(stables).map((s) => s.userId));
    await harness.close();
    await prisma.$disconnect();
  });

  type ListedItem = { catalogueKey: string; needAttention: { code: string; label: string }[] };

  /**
   * Every page of the list for `query`, keyed by catalogue key. The shared
   * database can hold the full catalogue (205+ active profiles) sorting before
   * this suite's keys, so one page is not enough to find them, and the
   * negative `attention` checks need the whole filtered list.
   */
  async function listed(query: string): Promise<Map<string, ListedItem>> {
    const items = new Map<string, ListedItem>();
    for (let page = 1; ; page++) {
      const res = await harness.api('get', `/?limit=100&page=${page}${query}`);
      expect(res.status).toBe(200);
      const pageItems = res.body.items as ListedItem[];
      for (const item of pageItems) items.set(item.catalogueKey, item);
      if (pageItems.length === 0 || page * 100 >= (res.body.total as number)) return items;
    }
  }

  it('returns every reason in the approved order with the approved labels (R11.12)', async () => {
    const items = await listed('&status=active');
    expect(items.get(stables.a.catalogueKey)?.needAttention).toEqual([
      { code: 'last_cycle_failed', errorCode: 'AUTOMATON_WEAPON_UNKNOWN', label: 'Last cycle failed: AUTOMATON_WEAPON_UNKNOWN' },
      { code: 'balance_negative', label: 'Balance negative' },
      { code: 'nothing_bought', cycles: 16, label: 'Nothing bought for 16 cycles' },
    ]);
  });

  it('applies the 14-cycle zero-spend window over completed Turn_Records only', async () => {
    const items = await listed('&status=active');
    expect(items.get(stables.b.catalogueKey)?.needAttention).toEqual([]);
    expect(items.get(stables.c.catalogueKey)?.needAttention).toEqual([]);
    expect(items.get(stables.d.catalogueKey)?.needAttention).toEqual([{ code: 'nothing_bought', cycles: 15, label: 'Nothing bought for 15 cycles' }]);
    expect(items.get(stables.e.catalogueKey)?.needAttention).toEqual([{ code: 'nothing_bought', cycles: 14, label: 'Nothing bought for 14 cycles' }]);
  });

  it('filters the list on Need_Attention (R11.11)', async () => {
    const flagged = await listed('&attention=true');
    const healthy = await listed('&attention=false');
    for (const name of ['a', 'd', 'e']) {
      expect(flagged.has(stables[name].catalogueKey)).toBe(true);
      expect(healthy.has(stables[name].catalogueKey)).toBe(false);
    }
    for (const name of ['b', 'c']) {
      expect(flagged.has(stables[name].catalogueKey)).toBe(false);
      expect(healthy.has(stables[name].catalogueKey)).toBe(true);
    }
    expect([...flagged.values()].every((item) => item.needAttention.length > 0)).toBe(true);
    const bad = await harness.api('get', '/?attention=maybe');
    expect(bad.status).toBe(400);
  });

  it('serves the Status_Bar: most recent Turn_Step, failed and Need_Attention counts (R11.11)', async () => {
    const res = await harness.api('get', '/status');
    expect(res.status).toBe(200);
    const groupStart = BASE_TIME + LAST_SLOT * 60_000;
    const groupEnd = groupStart + (order.length - 1) * 1_000 + 500;
    expect(res.body).toMatchObject({
      program: { turnsEnabled: expect.any(Boolean), updatedAt: expect.any(String) },
      lastStep: {
        seasonNumber: SEASON,
        trigger: 'settlement',
        slot: LAST_SLOT,
        label: `Cycle ${LAST_SLOT}`,
        processed: order.length,
        durationMs: groupEnd - groupStart,
        finishedAt: new Date(groupEnd).toISOString(),
      },
      failedCount: baseline.failedCount + 1,
      needAttentionCount: baseline.needAttentionCount + 3,
    });
  });

  it('answers 401 and 403 for the status endpoint', async () => {
    expect((await harness.api('get', '/status', null)).status).toBe(401);
    expect((await harness.api('get', '/status', harness.playerToken)).status).toBe(403);
  });
});
