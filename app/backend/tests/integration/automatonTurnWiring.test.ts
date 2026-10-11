/**
 * Spec #55 task 6.7 — Turn_Step wiring against the real database (R2.7,
 * R7.1–R7.10, R11.8, R14.3).
 *
 * Profiles are created and activated through the admin profile service
 * (task 9.1). Every Turn_Step is scoped to this file's stables
 * (`cohortFilter`), so the shared dev database's own Automatons never take a
 * turn here. Covered:
 * - each Turn_Trigger writes exactly one Turn_Record per Active_Automaton
 *   with its season and slot;
 * - a retried Turn_Step skips completed records (no second charge) and
 *   re-plans a failed one with attempt + 1; one throwing Automaton is
 *   recorded `failed` while the others complete and the step succeeds;
 * - Program_Switch off records `skipped`/`program_off` and changes nothing;
 * - a profile activated mid-step waits for the next step;
 * - no turn starts while a cutover is in progress;
 * - a scheduler step and an admin bulk step run one after the other; an
 *   expired lease is taken over, a live one is waited for;
 * - a negative start balance runs Free_Upkeep, buys nothing and alerts;
 * - a profile activated after the last non-boundary settlement first acts in
 *   the next `season_open` step;
 * - Free_Upkeep and Robot_Fitout paths deferred from task 5.5 (C06-3): a
 *   failing `registerTeam`, a missing Team_Names entry, stance/yield drift,
 *   dual-wield and two-handed fit-out, Weapon_Reuse.
 * The boundary-cycle rule at the scheduler call site is in
 * `automatonSettlementWiring.test.ts`.
 */
import prisma from '../../src/lib/prisma';
import * as canonical from '../../src/services/cycle/canonicalCycleIdentity';
import * as stableFactsModule from '../../src/services/automaton/stableFacts';
import * as teamBattleService from '../../src/services/team-battle/teamBattleService';
import {
  runTurnStep,
  runTurnStepNonFatal,
  type TurnStepDependencies,
  type TurnStepInput,
} from '../../src/services/automaton/automatonTurnService';
import { setAlertSender } from '../../src/services/automaton/automatonObservability';
import { getProgramSwitch, setProgramSwitch } from '../../src/services/automaton/programSwitch';
import { activateProfile, addBlueprint, createDraft } from '../../src/services/automaton/automatonProfileService';
import { deleteAutomatonStables } from '../helpers/automatonStable';
import type { TeamNames } from '../../src/types/automaton';

jest.setTimeout(240_000);

const run = `${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 900 + 100)}`;
const KEY_PREFIX = `t55w-${run}`;
const SEASON = 7_000 + Math.floor(Math.random() * 900);

const HAMMER = {
  robotName: 'Wz Hammer',
  loadoutType: 'two_handed' as const,
  stance: 'balanced' as const,
  yieldThreshold: 10,
  buildFocus: 'bruiser' as const,
  weaponPath: [{ main: 'Shock Maul' }, { main: 'Heavy Hammer' }],
  refinementPlan: [{ tier: 'sharpen' as const, hand: 'main' as const, magnitude: 1 }],
};
const TWINS = {
  robotName: 'Wz Twins',
  loadoutType: 'dual_wield' as const,
  stance: 'offensive' as const,
  yieldThreshold: 15,
  buildFocus: 'versatile' as const,
  weaponPath: [{ main: 'Laser Pistol', offhand: 'Laser Pistol' }, { main: 'Volt Sabre', offhand: 'Volt Sabre' }],
  refinementPlan: [{ tier: 'sharpen' as const, hand: 'main' as const, magnitude: 1 }, { tier: 'sharpen' as const, hand: 'offhand' as const, magnitude: 1 }],
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
let n = 0;

/** A Draft_Automaton (Paragon by default) with the given blueprints. */
async function draft(blueprints: (typeof HAMMER | typeof TWINS)[] = [HAMMER], strategyKey = 'paragon', teamNames?: TeamNames): Promise<string> {
  n += 1;
  const catalogueKey = `${KEY_PREFIX}-${n}`;
  await createDraft({ catalogueKey, stableName: `Wz ${run} ${n}`, franchise: 'Test', backstory: 'Turn wiring test stable.', strategyKey });
  for (const [index, blueprint] of blueprints.entries()) {
    await addBlueprint(catalogueKey, { ...blueprint, robotName: `${blueprint.robotName} ${index + 1}`, ...(index === blueprints.length - 1 && teamNames ? { teamNames } : {}) });
  }
  return catalogueKey;
}

async function activate(catalogueKey: string, balance?: number): Promise<Stable> {
  const { result } = await activateProfile(catalogueKey);
  if (balance !== undefined) await prisma.user.update({ where: { id: result.userId }, data: { currency: balance } });
  const profile = await prisma.automatonProfile.findUniqueOrThrow({ where: { catalogueKey }, select: { id: true } });
  const stable = { catalogueKey, profileId: profile.id, userId: result.userId };
  created.push(stable);
  return stable;
}

/** Turn_Step deps limited to the given stables (a shared dev DB has other Automatons). */
function only(...stables: Stable[]): TurnStepDependencies {
  const ids = new Set(stables.map((s) => s.profileId));
  return { cohortFilter: (profile) => ids.has(profile.profileId), leasePollMs: 50 };
}

let slotCounter = 0;
function step(trigger: TurnStepInput['trigger'] = 'settlement', overrides: Partial<TurnStepInput> = {}): TurnStepInput {
  slotCounter += 1;
  return { trigger, seasonNumber: SEASON, slot: slotCounter, source: 'scheduler', ...overrides };
}

async function records(stable: Stable) {
  return prisma.automatonTurn.findMany({ where: { profileId: stable.profileId }, orderBy: { id: 'asc' } });
}

beforeAll(async () => {
  previousSender = setAlertSender(async (message) => { alerts.push(message); });
  programBefore = (await getProgramSwitch()).turnsEnabled;
  const admin = await prisma.user.create({ data: { username: `t55w_admin_${run}`, passwordHash: 'unused', role: 'admin' } });
  adminId = admin.id;
  await setProgramSwitch(true, adminId);
  // A crashed earlier run may have left a live lease; this suite needs it free.
  await prisma.automatonProgramSetting.update({ where: { id: 1 }, data: { turnStepLeaseUntil: null } });
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  setAlertSender(previousSender);
  await setProgramSwitch(programBefore, adminId).catch(() => undefined);
  await deleteAutomatonStables(created.map((s) => s.userId));
  await prisma.automatonProfile.deleteMany({ where: { catalogueKey: { startsWith: KEY_PREFIX } } });
  await prisma.user.deleteMany({ where: { id: adminId } });
  await prisma.$disconnect();
});

describe('Turn_Records per trigger (R7.1–R7.4, R7.6)', () => {
  it('writes exactly one Turn_Record per Active_Automaton with the season and slot of each trigger', async () => {
    const a = await activate(await draft(), 100);
    const b = await activate(await draft(), 100);
    const settlement = step('settlement');
    const preparation = step('preparation');
    const seasonOpen = step('season_open', { seasonNumber: SEASON + 1, slot: 0, source: 'rollover' });
    for (const input of [settlement, preparation, seasonOpen]) {
      const summary = await runTurnStep(input, only(a, b));
      expect(summary).toMatchObject({ processed: 2, completed: 2, failed: 0 });
    }
    for (const stable of [a, b]) {
      const rows = await records(stable);
      expect(rows.map((r) => [r.trigger, r.seasonNumber, r.slot, r.status, r.attempt])).toEqual([
        ['settlement', SEASON, settlement.slot, 'completed', 1],
        ['preparation', SEASON, preparation.slot, 'completed', 1],
        ['season_open', SEASON + 1, 0, 'completed', 1],
      ]);
    }
  });
});

describe('retries and failure isolation (R7.6, R7.8)', () => {
  it('records a throwing Automaton as failed while the others complete, then re-plans it with attempt + 1 and charges nothing twice', async () => {
    const good = await activate(await draft());
    const bad = await activate(await draft());
    const input = step();
    const real = stableFactsModule.loadStableFacts;
    jest.spyOn(stableFactsModule, 'loadStableFacts').mockImplementation(async (db, profileId, options) => {
      if (profileId === bad.profileId) throw new Error('simulated facts failure');
      return real(db, profileId, options);
    });
    const first = await runTurnStepNonFatal(input, only(good, bad));
    expect(first.ok).toBe(true); // the step (and so settlement) succeeds
    if (first.ok) expect(first.summary).toMatchObject({ completed: 1, failed: 1 });
    expect((await records(good))[0]).toMatchObject({ status: 'completed', attempt: 1 });
    expect((await records(bad))[0]).toMatchObject({ status: 'failed', attempt: 1, reason: 'UNEXPECTED_ERROR' });
    expect(alerts.some((m) => m.includes(bad.catalogueKey))).toBe(true);
    const goodSpent = (await records(good))[0].creditsSpent;
    expect(goodSpent).toBeGreaterThan(0);

    jest.restoreAllMocks();
    const ledgerBefore = await prisma.financialLedger.count({ where: { userId: good.userId } });
    const balanceBefore = (await prisma.user.findUniqueOrThrow({ where: { id: good.userId } })).currency;
    const second = await runTurnStep(input, only(good, bad));
    expect(second).toMatchObject({ alreadyFinal: 1, completed: 1, failed: 0 });
    expect(await prisma.financialLedger.count({ where: { userId: good.userId } })).toBe(ledgerBefore);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: good.userId } })).currency).toBe(balanceBefore);
    const badRows = await records(bad);
    expect(badRows).toHaveLength(1);
    expect(badRows[0]).toMatchObject({ status: 'completed', attempt: 2 });
    expect(badRows[0].creditsSpent).toBeGreaterThan(0);
  });
});

describe('Program_Switch (R2.7)', () => {
  it('records skipped/program_off and changes nothing while the switch is off', async () => {
    const stable = await activate(await draft());
    await setProgramSwitch(false, adminId);
    try {
      const summary = await runTurnStep(step(), only(stable));
      expect(summary.skipped).toEqual({ program_off: 1 });
    } finally {
      await setProgramSwitch(true, adminId);
    }
    expect((await records(stable))[0]).toMatchObject({ status: 'skipped', reason: 'program_off', creditsSpent: 0 });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: stable.userId } })).currency).toBe(3_000_000);
    expect(await prisma.robot.count({ where: { userId: stable.userId } })).toBe(0);
    expect(await prisma.facility.count({ where: { userId: stable.userId, level: { gt: 0 } } })).toBe(0);
  });
});

describe('cohort, cutover and lease (R7.5, R7.9)', () => {
  it('lets a profile activated mid-step wait for the next Turn_Step', async () => {
    const early = await activate(await draft(), 100);
    const lateKey = await draft();
    let late: Stable | undefined;
    const real = stableFactsModule.loadStableFacts;
    jest.spyOn(stableFactsModule, 'loadStableFacts').mockImplementation(async (db, profileId, options) => {
      if (!late) late = await activate(lateKey, 100);
      return real(db, profileId, options);
    });
    const ids = (): Set<number> => new Set([early.profileId, ...(late ? [late.profileId] : [])]);
    const scope: TurnStepDependencies = { cohortFilter: (p) => ids().has(p.profileId) || p.catalogueKey === lateKey, leasePollMs: 50 };
    const first = step();
    const summary = await runTurnStep(first, scope);
    expect(summary.processed).toBe(1);
    expect(late).toBeDefined();
    expect(await records(late!)).toEqual([]);
    jest.restoreAllMocks();
    const next = step();
    expect((await runTurnStep(next, only(early, late!))).processed).toBe(2);
    expect((await records(late!)).map((r) => r.slot)).toEqual([next.slot]);
  });

  it('never starts a turn while a cutover is in progress', async () => {
    const stable = await activate(await draft(), 100);
    const real = canonical.resolveCanonicalCycleIdentity;
    jest.spyOn(canonical, 'resolveCanonicalCycleIdentity').mockImplementation(async (client) => ({
      ...(await real(client)), isClosing: true, closingCycle: 41,
    }));
    await expect(runTurnStep(step(), only(stable))).rejects.toMatchObject({ code: 'AUTOMATON_CUTOVER_IN_PROGRESS' });
    const outcome = await runTurnStepNonFatal(step(), only(stable));
    expect(outcome).toMatchObject({ ok: false, code: 'AUTOMATON_CUTOVER_IN_PROGRESS' });
    expect(await records(stable)).toEqual([]);
  });

  it('runs a scheduler Turn_Step and an admin bulk Turn_Step one after the other', async () => {
    const stable = await activate(await draft(), 100);
    const real = stableFactsModule.loadStableFacts;
    jest.spyOn(stableFactsModule, 'loadStableFacts').mockImplementation(async (db, profileId, options) => {
      await new Promise((resolve) => setTimeout(resolve, 300)); // widen each turn so an overlap would show
      return real(db, profileId, options);
    });
    const scheduler = step('settlement', { source: 'scheduler' });
    const bulk = step('settlement', { source: 'admin_bulk' });
    await Promise.all([runTurnStep(scheduler, only(stable)), runTurnStep(bulk, only(stable))]);
    const rows = await records(stable);
    expect(rows).toHaveLength(2);
    const [firstRow, secondRow] = [...rows].sort((x, y) => x.startedAt.getTime() - y.startedAt.getTime());
    expect(firstRow.finishedAt!.getTime()).toBeLessThanOrEqual(secondRow.startedAt.getTime());
  });

  it('takes over an expired lease and waits for a live one', async () => {
    const stable = await activate(await draft(), 100);
    await prisma.automatonProgramSetting.update({ where: { id: 1 }, data: { turnStepLeaseUntil: new Date(Date.now() - 60_000) } });
    const expired = await runTurnStep(step(), only(stable));
    expect(expired.completed).toBe(1);
    const liveUntil = new Date(Date.now() + 1_200);
    await prisma.automatonProgramSetting.update({ where: { id: 1 }, data: { turnStepLeaseUntil: liveUntil } });
    const started = Date.now();
    const waited = await runTurnStep(step(), only(stable));
    expect(waited.completed).toBe(1);
    expect(Date.now() - started).toBeGreaterThanOrEqual(1_000);
    expect((await prisma.automatonProgramSetting.findUniqueOrThrow({ where: { id: 1 } })).turnStepLeaseUntil).toBeNull();
  });
});

describe('negative balance and late activation (R7.2, R11.8)', () => {
  it('runs Free_Upkeep, buys nothing and alerts when a turn starts with a negative balance', async () => {
    const stable = await activate(await draft([TWINS]), -5_000);
    const blueprint = await prisma.automatonRobotBlueprint.findFirstOrThrow({ where: { profileId: stable.profileId, slotIndex: 1 } });
    // A live robot whose stance and yield drifted from its blueprint (offensive, 15).
    const robot = await prisma.robot.create({
      data: {
        userId: stable.userId, name: 'Wz Twins 1', currentHP: 100, maxHP: 100, currentShield: 0, maxShield: 0,
        stance: 'defensive', yieldThreshold: 40, automatonBlueprintId: blueprint.id, automatonSlotIndex: 1,
      },
    });
    alerts.length = 0;
    const ledgerBefore = (await prisma.financialLedger.findFirst({ orderBy: { id: 'desc' }, select: { id: true } }))?.id ?? 0;
    const summary = await runTurnStep(step(), only(stable));
    expect(summary.completed).toBe(1);
    const [row] = await records(stable);
    expect(row).toMatchObject({ status: 'completed', startBalance: -5_000, creditsSpent: 0, actions: [] });
    // Nothing bought: no debit. (A free stance change may earn the stance achievement's reward, as for a player.)
    expect(await prisma.financialLedger.count({ where: { userId: stable.userId, amount: { lt: 0 }, id: { gt: ledgerBefore } } })).toBe(0);
    expect(alerts.some((m) => m.includes(stable.catalogueKey) && /negative/i.test(m))).toBe(true);
    // Free_Upkeep's blueprint sync ran (free): stance and yield follow the blueprint.
    expect(await prisma.robot.findUniqueOrThrow({ where: { id: robot.id } })).toMatchObject({ stance: 'offensive', yieldThreshold: 15 });
  });

  it('gives a profile activated after the last non-boundary settlement its first turn in the next season_open step', async () => {
    const stable = await activate(await draft(), 100);
    const summary = await runTurnStep({ trigger: 'season_open', seasonNumber: SEASON + 2, slot: 0, source: 'rollover' }, only(stable));
    expect(summary.completed).toBe(1);
    expect((await records(stable)).map((r) => [r.trigger, r.seasonNumber, r.slot])).toEqual([['season_open', SEASON + 2, 0]]);
  });
});

describe('Robot_Fitout and Free_Upkeep paths (task 5.5 carry-over)', () => {
  it('fits out a dual-wield robot with both hands and a two-handed robot with the main hand only', async () => {
    const dual = await activate(await draft([TWINS]));
    const twoHanded = await activate(await draft([HAMMER]));
    await runTurnStep(step(), only(dual, twoHanded));
    const [twins] = await prisma.robot.findMany({ where: { userId: dual.userId }, include: { mainWeapon: { include: { weapon: true } }, offhandWeapon: { include: { weapon: true } } } });
    expect(twins).toMatchObject({ loadoutType: 'dual_wield', stance: 'offensive', yieldThreshold: 15, automatonSlotIndex: 1 });
    // Both hands hold the same Weapon_Stage (stage 0, or a later one if the turn moved on), two items.
    expect(['Laser Pistol', 'Volt Sabre']).toContain(twins.mainWeapon?.weapon.name);
    expect(twins.offhandWeapon?.weapon.name).toBe(twins.mainWeapon?.weapon.name);
    expect(twins.mainWeaponId).not.toBe(twins.offhandWeaponId);
    const [hammer] = await prisma.robot.findMany({ where: { userId: twoHanded.userId }, include: { mainWeapon: { include: { weapon: true } } } });
    expect(hammer).toMatchObject({ loadoutType: 'two_handed', offhandWeaponId: null });
    expect(['Shock Maul', 'Heavy Hammer']).toContain(hammer.mainWeapon?.weapon.name);
  });

  it('reuses an unequipped stored weapon in the fit-out instead of buying it (Weapon_Reuse)', async () => {
    const stable = await activate(await draft([TWINS]));
    const pistol = await prisma.weapon.findFirstOrThrow({ where: { name: 'Laser Pistol' } });
    const stored = await prisma.weaponInventory.create({ data: { userId: stable.userId, weaponId: pistol.id, pricePaid: pistol.cost } });
    await runTurnStep(step(), only(stable));
    const [row] = await records(stable);
    expect(await prisma.robot.count({ where: { userId: stable.userId } })).toBe(1);
    expect(stored.id).toBeGreaterThan(0);
    const purchases = (row.actions as { kind: string; detail: Record<string, string | number> }[]).filter((a) => a.kind === 'weapon_purchase' && a.detail.weaponName === 'Laser Pistol');
    expect(purchases).toHaveLength(1);
  });

  it('records a missing Team_Names entry as an upkeep issue, alerts, and completes the turn', async () => {
    const stable = await activate(await draft([HAMMER, TWINS], 'duo', { twoVsTwo: ['Wz Pair'], threeVsThree: [] }));
    // Test-only: the stored Team_Names lost their entry after Activation.
    await prisma.automatonProfile.update({ where: { id: stable.profileId }, data: { teamNames: { twoVsTwo: [], threeVsThree: [] } } });
    alerts.length = 0;
    await runTurnStep(step(), only(stable));
    const [row] = await records(stable);
    expect(row.status).toBe('completed');
    expect(row.upkeepIssues).toEqual(expect.arrayContaining([expect.objectContaining({ part: 'teams', code: 'AUTOMATON_TEAM_NAME_MISSING' })]));
    expect(await prisma.teamBattle.count({ where: { stableId: stable.userId } })).toBe(0);
    expect(alerts.some((m) => m.includes(stable.catalogueKey) && m.includes('AUTOMATON_TEAM_NAME_MISSING'))).toBe(true);
  });

  it('records a failing registerTeam as an upkeep issue and registers the team at the next turn', async () => {
    const stable = await activate(await draft([HAMMER, TWINS], 'duo', { twoVsTwo: ['Wz Duo'], threeVsThree: [] }));
    jest.spyOn(teamBattleService, 'registerTeam').mockRejectedValue(new Error('simulated registration failure'));
    await runTurnStep(step(), only(stable));
    const [row] = await records(stable);
    expect(row.status).toBe('completed');
    expect(row.upkeepIssues).toEqual(expect.arrayContaining([expect.objectContaining({ part: 'teams', teamSize: 2, teamIndex: 0 })]));
    expect(await prisma.teamBattle.count({ where: { stableId: stable.userId } })).toBe(0);
    jest.restoreAllMocks();
    await runTurnStep(step(), only(stable));
    const teams = await prisma.teamBattle.findMany({ where: { stableId: stable.userId } });
    expect(teams.map((t) => t.teamName)).toEqual(['Wz Duo']);
  });
});
