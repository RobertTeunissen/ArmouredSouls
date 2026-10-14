/**
 * Turn-budget plan "DESIGN (Part B)" D3 — parallel Automaton_Turns against
 * the real database.
 *
 * Four freshly activated stables (Paragon and Duo, two blueprints each, 2v2
 * Team_Names when the strategy needs them; Swarm needs at least three
 * blueprints, Duo is the two-robot strategy) run their opening builds in
 * one Turn_Step at concurrency 3. Proves that turns of different stables
 * really overlap and that parallel opening builds keep:
 * - one Turn_Record per (profile, season, trigger, slot);
 * - every ledger row paired with exactly one `financial_transaction` audit
 *   row by `financialEventId`, no event id twice;
 * - one purchase-type ledger row per non-replayed charged action;
 * - balance = opening balance + Σ ledger = last `balanceAfter`;
 * - no Free_Upkeep issues;
 * and that a retried Turn_Step finds every record final and charges nothing.
 *
 * Every Turn_Step is scoped to this file's stables (`cohortFilter`), so the
 * shared database's own Automatons never take a turn here.
 */
import prisma from '../../src/lib/prisma';
import { runTurnStep, type TurnStepDependencies, type TurnStepInput } from '../../src/services/automaton/automatonTurnService';
import { setAlertSender } from '../../src/services/automaton/automatonObservability';
import { getProgramSwitch, setProgramSwitch } from '../../src/services/automaton/programSwitch';
import {
  activateProfile,
  addBlueprint,
  AUTOMATON_OPENING_BALANCE,
  createDraft,
} from '../../src/services/automaton/automatonProfileService';
import { requiredTeamNameCountsFor } from '../../src/services/automaton/automatonCatalogueService';
import { getStrategyRegistry } from '../../src/services/automaton/strategies/defaultRegistry';
import { SUBSCRIBABLE_EVENT_TYPES, isRegisteredEvent, registerSubscribableEvent } from '../../src/services/subscription/eventRegistry';
import { deleteAutomatonStables } from '../helpers/automatonStable';
import type { TeamNames, TurnActionRecord } from '../../src/types/automaton';

jest.setTimeout(240_000);

const run = `${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 900 + 100)}`;
const KEY_PREFIX = `tbc-${run}`;
const SEASON = 7_000 + Math.floor(Math.random() * 900);

/** The six charged operations, named as their ledger transaction types. */
const PURCHASE_TYPES = ['robot_creation', 'attribute_upgrade', 'facility_upgrade', 'weapon_purchase', 'weapon_sale', 'weapon_refinement'];

const BLADE = {
  robotName: 'Tc Blade',
  loadoutType: 'single' as const,
  stance: 'offensive' as const,
  yieldThreshold: 10,
  buildFocus: 'versatile' as const,
  weaponPath: [{ main: 'Laser Pistol' }, { main: 'Volt Sabre' }],
  refinementPlan: [{ tier: 'sharpen' as const, hand: 'main' as const, magnitude: 1 }],
};
const HAMMER = {
  robotName: 'Tc Hammer',
  loadoutType: 'two_handed' as const,
  stance: 'balanced' as const,
  yieldThreshold: 15,
  buildFocus: 'bruiser' as const,
  weaponPath: [{ main: 'Shock Maul' }, { main: 'Heavy Hammer' }],
  refinementPlan: [{ tier: 'sharpen' as const, hand: 'main' as const, magnitude: 1 }],
};

interface Stable {
  catalogueKey: string;
  profileId: number;
  userId: number;
}

const alerts: string[] = [];
let previousSender: ReturnType<typeof setAlertSender>;
let programBefore: boolean;
let adminId: number;
const created: Stable[] = [];

/** Team_Names the strategy needs for two blueprints (2v2 names when it fields a pair). */
function teamNamesFor(strategyKey: string, index: number): TeamNames {
  const strategy = getStrategyRegistry().getStrategy(strategyKey, 1);
  if (!strategy) throw new Error(`no ${strategyKey}.v1`);
  const required = requiredTeamNameCountsFor(strategy, 2);
  return {
    twoVsTwo: Array.from({ length: required.twoVsTwo }, (_, i) => `${KEY_PREFIX} Duo ${index}${i === 0 ? '' : ` ${i + 1}`}`),
    threeVsThree: Array.from({ length: required.threeVsThree }, (_, i) => `${KEY_PREFIX} Trio ${index} ${i + 1}`),
  };
}

/** Draft with BLADE in slot 1 and HAMMER in slot 2, then activate it. */
async function activeStable(index: number, strategyKey: string): Promise<Stable> {
  const catalogueKey = `${KEY_PREFIX}-${index}`;
  await createDraft({ catalogueKey, stableName: `Tc ${run} ${index}`, franchise: 'Test', backstory: 'Turn concurrency test stable.', strategyKey });
  await addBlueprint(catalogueKey, { ...BLADE, robotName: `${BLADE.robotName} ${run} ${index}` });
  await addBlueprint(catalogueKey, { ...HAMMER, robotName: `${HAMMER.robotName} ${run} ${index}`, teamNames: teamNamesFor(strategyKey, index) });
  const { result } = await activateProfile(catalogueKey);
  const profile = await prisma.automatonProfile.findUniqueOrThrow({ where: { catalogueKey }, select: { id: true } });
  const stable = { catalogueKey, profileId: profile.id, userId: result.userId };
  created.push(stable);
  return stable;
}

beforeAll(async () => {
  previousSender = setAlertSender(async (message) => { alerts.push(message); });
  // The server registers the subscribable events at boot (src/index.ts); this process does not boot it.
  for (const type of SUBSCRIBABLE_EVENT_TYPES) if (!isRegisteredEvent(type)) registerSubscribableEvent({ type, label: type });
  programBefore = (await getProgramSwitch()).turnsEnabled;
  const admin = await prisma.user.create({ data: { username: `tbc_admin_${run}`, passwordHash: 'unused', role: 'admin' } });
  adminId = admin.id;
  await setProgramSwitch(true, adminId);
  // A crashed earlier run may have left a live lease; this suite needs it free.
  await prisma.automatonProgramSetting.update({ where: { id: 1 }, data: { turnStepLeaseUntil: null } });
});

afterAll(async () => {
  setAlertSender(previousSender);
  await setProgramSwitch(programBefore, adminId).catch(() => undefined);
  await deleteAutomatonStables(created.map((s) => s.userId));
  await prisma.automatonProfile.deleteMany({ where: { catalogueKey: { startsWith: KEY_PREFIX } } });
  await prisma.user.deleteMany({ where: { id: adminId } });
  await prisma.$disconnect();
});

describe('parallel opening builds (plan D3)', () => {
  it('overlap in time and keep paired ledger/audit rows, balances and single Turn_Records; a retry charges nothing', async () => {
    const stables = [
      await activeStable(1, 'paragon'),
      await activeStable(2, 'duo'),
      await activeStable(3, 'paragon'),
      await activeStable(4, 'duo'),
    ];
    const userIds = stables.map((s) => s.userId);
    const ids = new Set(stables.map((s) => s.profileId));
    const deps: TurnStepDependencies = { cohortFilter: (profile) => ids.has(profile.profileId), concurrency: 3, leasePollMs: 50 };
    const input: TurnStepInput = { trigger: 'preparation', seasonNumber: SEASON, slot: 1, source: 'scheduler' };

    const summary = await runTurnStep(input, deps);

    expect(summary).toMatchObject({ processed: 4, completed: 4, failed: 0, skipped: {}, alreadyFinal: 0, concurrency: 3, leaseLost: false });

    // One Turn_Record per profile for the key.
    const turns = await prisma.automatonTurn.findMany({
      where: { profileId: { in: [...ids] }, seasonNumber: SEASON, trigger: 'preparation', slot: 1 },
      orderBy: { startedAt: 'asc' },
    });
    expect(turns).toHaveLength(4);
    expect(new Set(turns.map((t) => t.profileId)).size).toBe(4);
    for (const turn of turns) expect(turn).toMatchObject({ status: 'completed', attempt: 1 });

    // At least two turns ran at the same time.
    const intervals = turns.map((t) => [t.startedAt.getTime(), (t.finishedAt as Date).getTime()] as const);
    const overlapping = intervals.some(([startA, endA], a) =>
      intervals.some(([startB, endB], b) => a !== b && startA < endB && startB < endA));
    expect(overlapping).toBe(true);

    const ledger = await prisma.financialLedger.findMany({ where: { userId: { in: userIds } }, orderBy: { id: 'asc' } });
    const audits = await prisma.auditLog.findMany({
      where: { userId: { in: userIds }, eventType: 'financial_transaction' },
      select: { financialEventId: true },
    });
    const auditsByEvent = new Map<string, number>();
    for (const audit of audits) {
      if (audit.financialEventId !== null) auditsByEvent.set(audit.financialEventId, (auditsByEvent.get(audit.financialEventId) ?? 0) + 1);
    }
    const eventIds = ledger.map((row) => row.financialEventId);
    expect(eventIds.every((id) => id !== null)).toBe(true);
    expect(new Set(eventIds).size).toBe(eventIds.length);

    for (const stable of stables) {
      const label = stable.catalogueKey;
      const rows = ledger.filter((row) => row.userId === stable.userId);
      expect({ label, purchases: rows.filter((row) => PURCHASE_TYPES.includes(row.transactionType)).length > 0 }).toEqual({ label, purchases: true });
      for (const row of rows) {
        expect({ label, event: row.financialEventId, audits: auditsByEvent.get(row.financialEventId as string) ?? 0 })
          .toEqual({ label, event: row.financialEventId, audits: 1 });
      }
      const turn = turns.find((t) => t.profileId === stable.profileId);
      const actions = (turn?.actions ?? []) as unknown as TurnActionRecord[];
      const charged = actions.filter((action) => !action.replayed).length;
      const purchaseRows = rows.filter((row) => PURCHASE_TYPES.includes(row.transactionType)).length;
      expect({ label, purchaseRows }).toEqual({ label, purchaseRows: charged });
      expect({ label, upkeepIssues: turn?.upkeepIssues }).toEqual({ label, upkeepIssues: [] });

      const user = await prisma.user.findUniqueOrThrow({ where: { id: stable.userId }, select: { currency: true } });
      const sum = rows.reduce((total, row) => total + row.amount, 0);
      expect({ label, currency: user.currency }).toEqual({ label, currency: AUTOMATON_OPENING_BALANCE + sum });
      expect({ label, currency: user.currency }).toEqual({ label, currency: rows[rows.length - 1].balanceAfter });
    }

    // The Duo stables registered their 2v2 team in the same parallel step.
    expect(await prisma.teamBattle.count({ where: { stableId: { in: userIds } } })).toBeGreaterThan(0);

    // A retried Turn_Step: every record final, nothing charged or audited again.
    const auditCount = await prisma.auditLog.count({ where: { userId: { in: userIds } } });
    const retry = await runTurnStep(input, deps);
    expect(retry).toMatchObject({ processed: 4, alreadyFinal: 4, completed: 0, failed: 0, skipped: {} });
    expect(await prisma.financialLedger.count({ where: { userId: { in: userIds } } })).toBe(ledger.length);
    expect(await prisma.auditLog.count({ where: { userId: { in: userIds } } })).toBe(auditCount);
    expect(await prisma.automatonTurn.count({ where: { profileId: { in: [...ids] }, seasonNumber: SEASON } })).toBe(4);
    expect(alerts.filter((message) => created.some((s) => message.includes(s.catalogueKey)))).toEqual([]);
  });
});
