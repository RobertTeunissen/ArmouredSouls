/**
 * Spec #55 task 5.5 (R5.4, R7.7, R8.1, R8.2, R8.7, R8.8, R14.3) — action
 * executor, Robot_Fitout and Free_Upkeep against the real database.
 *
 * One Active_Automaton is built up step by step with actions planned by the
 * real Goals on loaded facts: the first robot (Robot_Chain + fit-out), the
 * second robot (Roster Expansion level, 2v2 team, Event_Allocation), a
 * facility level, an attribute batch, a weapon stage with a
 * Storage_Overflow_Rule sale and a refinement with its Weapons Workshop
 * chain. For every action:
 * - each charged step produced exactly one Financial_Pair (ledger row +
 *   `financial_transaction` audit row) carrying the Automaton audit context;
 * - `factProjector` predicted the reloaded facts exactly (parity).
 * Then: replaying committed request keys is a no-op, and a forced planner
 * bypass (unaffordable, prestige-gated, over the roster) is rejected by the
 * domain service with no state change.
 */
import prisma from '../../src/lib/prisma';
import { registerSubscribableEvent, SUBSCRIBABLE_EVENT_TYPES } from '../../src/services/subscription/eventRegistry';
import {
  createExecutionCursor,
  executeAction,
  type ExecutedChargedStep,
  type ExecutionContext,
  type ExecutionCursor,
} from '../../src/services/automaton/actionExecutor';
import { chargedStepCount, projectAction } from '../../src/services/automaton/factProjector';
import { BUILD_FOCUS_WEIGHTS } from '../../src/services/automaton/buildFocus';
import { createRobotCountGoal } from '../../src/services/automaton/goals/robotCountGoal';
import { createFacilityGoal } from '../../src/services/automaton/goals/facilityGoal';
import { createAttributeGoal } from '../../src/services/automaton/goals/attributeGoal';
import { createWeaponStageGoal } from '../../src/services/automaton/goals/weaponStageGoal';
import { createRefinementGoal } from '../../src/services/automaton/goals/refinementGoal';
import type { Goal, PlannedAction } from '../../src/services/automaton/goals/goalTypes';
import { subscriptionChanges } from '../../src/services/automaton/upkeep/subscriptionUpkeep';
import {
  loadBlueprintFacts,
  loadStableFacts,
  loadWeaponCatalogue,
  type BlueprintFacts,
  type StableFacts,
  type WeaponFacts,
} from '../../src/services/automaton/stableFacts';
import type { EventOrder } from '../../src/types/automaton';
import { createAutomatonStable, deleteAutomatonStables, type AutomatonStableFixture } from '../helpers/automatonStable';

const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const userIds: number[] = [];
const SEASON = { seasonNumber: 3, phase: 'competitive' as const };
const CHARGED_KINDS = ['robot_creation', 'attribute_upgrade', 'facility_upgrade', 'weapon_purchase', 'weapon_sale', 'weapon_refinement'];
/** Team events first, so the 2v2 team takes them before the solo events fill the 3 slots. */
const EVENT_ORDER: EventOrder = ['league_2v2', 'tag_team', 'league_1v1', 'koth', 'grand_melee', 'tournament_1v1', 'tournament_2v2', 'league_3v3', 'tournament_3v3'];

interface StoredAuditMetadata {
  idempotency?: { requestKey?: string };
  automaton?: Record<string, unknown>;
}

/** The facts the projector predicts, without ids, subscriptions, tuning or prestige (achievements add prestige). */
function view(facts: StableFacts): Record<string, unknown> {
  const nameOf = (id: number | null): string | null => facts.inventory.find((i) => i.inventoryId === id)?.weaponName ?? null;
  const slotOf = (robotId: number): number => facts.robots.find((r) => r.robotId === robotId)?.slotIndex ?? -1;
  return {
    facilities: facts.facilities,
    robots: facts.robots.map((r) => ({
      slotIndex: r.slotIndex,
      blueprintId: r.blueprintId,
      attributes: Object.fromEntries(Object.entries(r.attributes).map(([a, v]) => [a, Math.floor(v)])),
      loadoutType: r.loadoutType,
      stance: r.stance,
      yieldThreshold: r.yieldThreshold,
      stageIndex: r.stageIndex,
      main: nameOf(r.mainInventoryId),
      offhand: nameOf(r.offhandInventoryId),
    })),
    inventory: facts.inventory
      .map((i) => `${i.weaponName}|${i.pricePaid}|${i.refinements.map((r) => r.tier).join('+')}`)
      .sort(),
    teams: facts.teams.map((t) => ({ size: t.size, name: t.name, slots: t.memberRobotIds.map(slotOf) })),
    takenRobotNames: [...facts.takenRobotNames].sort(),
  };
}

describe('Automaton action executor (Spec #55 task 5.5)', () => {
  let fixture: AutomatonStableFixture;
  let blueprints: BlueprintFacts[];
  let weapons: Map<string, WeaponFacts>;
  let ctx: ExecutionContext;
  const cursor: ExecutionCursor = createExecutionCursor();
  const executed: { goalId: string; facts: StableFacts; action: PlannedAction; steps: ExecutedChargedStep[] }[] = [];

  const load = (): Promise<StableFacts> => loadStableFacts(prisma, fixture.profileId, { season: SEASON, blueprints });

  async function planWith(goal: Goal, target: number): Promise<{ facts: StableFacts; action: PlannedAction }> {
    const facts = await load();
    const outcome = goal.evaluate(facts, { target, params: { targets: {} }, blueprints, weapons, balance: facts.balance });
    if (outcome.kind !== 'actionable') throw new Error(`${goal.id} is ${outcome.kind}: ${JSON.stringify(outcome)}`);
    return { facts, action: outcome.action };
  }

  async function ledgerIdMax(): Promise<number> {
    const last = await prisma.financialLedger.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
    return last?.id ?? 0;
  }

  async function expectFinancialPairs(steps: readonly ExecutedChargedStep[]): Promise<void> {
    const audits = await prisma.auditLog.findMany({
      where: { eventType: 'financial_transaction', userId: fixture.userId },
      select: { financialEventId: true, metadata: true },
    });
    for (const step of steps) {
      const matching = audits.filter((a) => (a.metadata as unknown as StoredAuditMetadata).idempotency?.requestKey === step.requestKey);
      expect(matching).toHaveLength(1);
      const metadata = matching[0].metadata as unknown as StoredAuditMetadata;
      expect(metadata.automaton).toEqual({
        catalogueKey: fixture.catalogueKey,
        strategyKey: 'swarm',
        strategyVersion: 1,
        trigger: 'settlement',
        slot: ctx.identity.slot,
        attempt: 1,
        goalId: step.goalId,
      });
      const ledger = await prisma.financialLedger.findMany({ where: { financialEventId: matching[0].financialEventId } });
      expect(ledger).toHaveLength(1);
      expect(ledger[0].transactionType).toBe(step.kind);
    }
  }

  /** Execute, then check Financial_Pairs and projector parity. */
  async function runAndCheck(goalId: string, facts: StableFacts, action: PlannedAction): Promise<StableFacts> {
    const projected = projectAction(facts, action, { blueprints, teamNames: fixture.teamNames });
    const firstStep = cursor.steps.length;
    const ledgerBefore = await ledgerIdMax();
    const result = await executeAction(action, goalId, facts, ctx, cursor);
    const steps = cursor.steps.slice(firstStep);
    executed.push({ goalId, facts, action, steps });

    expect(steps).toHaveLength(chargedStepCount(action));
    expect(steps.every((s) => !s.replayed && s.goalId === goalId)).toBe(true);
    await expectFinancialPairs(steps);
    expect(result.upkeepIssues).toEqual([]);

    // Parity: the projector predicts the reloaded facts; achievement rewards are the only other credits.
    const rewards = await prisma.financialLedger.aggregate({
      where: { userId: fixture.userId, id: { gt: ledgerBefore }, transactionType: 'achievement_reward' },
      _sum: { amount: true },
    });
    expect(result.facts.balance - (rewards._sum.amount ?? 0)).toBe(projected.balance);
    expect(view(result.facts)).toEqual(view(projected));
    return result.facts;
  }

  beforeAll(async () => {
    for (const type of SUBSCRIBABLE_EVENT_TYPES) registerSubscribableEvent({ type, label: type });
    fixture = await createAutomatonStable({
      tag: `exec${suffix}`,
      balance: 60_000_000,
      prestige: 1_000_000,
      blueprints: [
        {
          slotIndex: 1, robotName: `ExecOne${suffix}`, loadoutType: 'single', stance: 'offensive', yieldThreshold: 15,
          imageUrl: '/assets/automatons/t/1.webp', buildFocus: 'bruiser',
          weaponPath: [{ main: 'Practice Sword' }, { main: 'Laser Pistol' }],
          refinementPlan: [{ tier: 'sharpen', hand: 'main', magnitude: 1 }],
        },
        {
          slotIndex: 2, robotName: `ExecTwo${suffix}`, loadoutType: 'weapon_shield', stance: 'defensive', yieldThreshold: 20,
          buildFocus: 'warden', weaponPath: [{ main: 'Practice Blaster', offhand: 'Light Shield' }],
          refinementPlan: [{ tier: 'sharpen', hand: 'main', magnitude: 1 }],
        },
      ],
      teamNames: { twoVsTwo: ['Exec Pair'], threeVsThree: [] },
      eventOrder: EVENT_ORDER,
    });
    userIds.push(fixture.userId);
    blueprints = await loadBlueprintFacts(prisma, fixture.profileId);
    weapons = await loadWeaponCatalogue(prisma);
    ctx = {
      identity: {
        profileId: fixture.profileId,
        userId: fixture.userId,
        catalogueKey: fixture.catalogueKey,
        strategyKey: 'swarm',
        strategyVersion: 1,
        seasonNumber: SEASON.seasonNumber,
        trigger: 'settlement',
        slot: 4242,
        attempt: 1,
      },
      blueprints,
      weapons,
      teamNames: fixture.teamNames,
      eventOrder: fixture.eventOrder,
      weightTable: BUILD_FOCUS_WEIGHTS,
    };
  });

  afterAll(async () => {
    await deleteAutomatonStables(userIds);
    await prisma.$disconnect();
  });

  it('buys and fits out the first robot: armed, configured, linked and subscribed', async () => {
    const goal = createRobotCountGoal('swarm.v1.1.robots');
    const { facts, action } = await planWith(goal, 1);
    expect(action.kind).toBe('robot_chain');
    const after = await runAndCheck(goal.id, facts, action);

    const robot = await prisma.robot.findFirstOrThrow({
      where: { userId: fixture.userId },
      include: { mainWeapon: { include: { weapon: true } }, subscriptions: true },
    });
    expect(robot).toMatchObject({
      name: `ExecOne${suffix}`,
      automatonSlotIndex: 1,
      automatonBlueprintId: fixture.blueprintIds.get(1),
      imageUrl: '/assets/automatons/t/1.webp',
      loadoutType: 'single',
      stance: 'offensive',
      yieldThreshold: 15,
    });
    expect(robot.mainWeapon?.weapon.name).toBe('Practice Sword');
    // A lone robot is in no team: it skips the team events and fills its 3 slots with solo events.
    expect(robot.subscriptions.map((s) => s.eventType).sort()).toEqual(['grand_melee', 'koth', 'league_1v1']);
    expect(subscriptionChanges(after, EVENT_ORDER)).toEqual([]);
  });

  it('buys the second robot, registers the 2v2 team (lower slot first) and subscribes it together', async () => {
    const goal = createRobotCountGoal('swarm.v1.1.robots');
    const { facts, action } = await planWith(goal, 2);
    expect(action.kind === 'robot_chain' && action.steps.map((s) => s.kind)).toEqual(['facility_upgrade', 'robot_purchase', 'fitout']);
    const after = await runAndCheck(goal.id, facts, action);

    const [one, two] = after.robots;
    const robotTwo = await prisma.robot.findUniqueOrThrow({
      where: { id: two.robotId },
      include: { mainWeapon: { include: { weapon: true } }, offhandWeapon: { include: { weapon: true } } },
    });
    expect(robotTwo).toMatchObject({ loadoutType: 'weapon_shield', stance: 'defensive', yieldThreshold: 20, imageUrl: null, automatonSlotIndex: 2 });
    expect(robotTwo.mainWeapon?.weapon.name).toBe('Practice Blaster');
    expect(robotTwo.offhandWeapon?.weapon.name).toBe('Light Shield');

    const team = await prisma.teamBattle.findFirstOrThrow({
      where: { stableId: fixture.userId },
      include: { members: { orderBy: { slotIndex: 'asc' } } },
    });
    expect(team).toMatchObject({ teamSize: 2, teamName: 'Exec Pair' });
    expect(team.members.map((m) => [m.slotIndex, m.robotId])).toEqual([[0, one.robotId], [1, two.robotId]]);
    const standings = await prisma.standing.findMany({ where: { entityType: 'team', entityId: team.id }, select: { mode: true } });
    expect(standings.map((s) => s.mode).sort()).toEqual(['league_2v2', 'tag_team']);

    for (const robot of after.robots) {
      expect(robot.subscriptions).toEqual(['league_1v1', 'league_2v2', 'tag_team']);
    }
    expect(subscriptionChanges(after, EVENT_ORDER)).toEqual([]);
  });

  it('buys a facility level', async () => {
    const goal = createFacilityGoal('swarm.v1.3.facility', 'repair_bay');
    const { facts, action } = await planWith(goal, 1);
    expect(action).toMatchObject({ kind: 'facility_upgrade', facilityType: 'repair_bay', toLevel: 1 });
    const after = await runAndCheck(goal.id, facts, action);
    expect(after.facilities.repair_bay).toBe(1);
  });

  it('buys an attribute batch for one robot in one transaction', async () => {
    const goal = createAttributeGoal('swarm.v1.4.attributes', { isMax: false, weightTable: BUILD_FOCUS_WEIGHTS });
    const { facts, action } = await planWith(goal, 3);
    expect(action.kind).toBe('attribute_upgrade');
    await runAndCheck(goal.id, facts, action);
  });

  it('moves a robot to its next stage, selling a stored weapon first when storage is full', async () => {
    // Fill storage (capacity 5 at Storage Facility L0) with weapons no Weapon_Path uses.
    const club = await prisma.weapon.findFirstOrThrow({ where: { name: 'War Club' } });
    await prisma.weaponInventory.createMany({
      data: [
        { userId: fixture.userId, weaponId: club.id, pricePaid: club.cost },
        { userId: fixture.userId, weaponId: club.id, pricePaid: club.cost },
      ],
    });
    const goal = createWeaponStageGoal('swarm.v1.5.weapons');
    const { facts, action } = await planWith(goal, 1);
    expect(action.kind === 'weapon_stage' && action.steps.map((s) => s.kind)).toEqual(['weapon_sale', 'weapon_purchase', 'equip']);
    const after = await runAndCheck(goal.id, facts, action);
    expect(after.robots[0].stageIndex).toBe(1);
    // The replaced Practice Sword stays in storage; one War Club was sold.
    expect(after.inventory.map((i) => i.weaponName).sort()).toEqual(
      ['Laser Pistol', 'Light Shield', 'Practice Blaster', 'Practice Sword', 'War Club'].sort(),
    );
  });

  it('refines a final-stage weapon after buying the Weapons Workshop levels its tier needs', async () => {
    const goal = createRefinementGoal('swarm.v1.6.refine');
    const { facts, action } = await planWith(goal, 1);
    expect(action).toMatchObject({ kind: 'weapon_refinement', robotSlot: 1, step: { tier: 'sharpen', hand: 'main' } });
    expect(action.kind === 'weapon_refinement' && action.chain.map((c) => c.toLevel)).toEqual([1, 2, 3, 4, 5]);
    const after = await runAndCheck(goal.id, facts, action);
    const pistol = after.inventory.find((i) => i.inventoryId === after.robots[0].mainInventoryId);
    expect(pistol?.refinements.map((r) => r.tier)).toEqual(['sharpen']);
  });

  it('records exactly one Financial_Pair per charged step over the whole build-up', async () => {
    const ledger = await prisma.financialLedger.findMany({
      where: { userId: fixture.userId, transactionType: { in: CHARGED_KINDS } },
      select: { transactionType: true },
    });
    expect(ledger.map((l) => l.transactionType).sort()).toEqual(cursor.steps.map((s) => s.kind).sort());
    expect(cursor.steps.map((s) => s.ordinal)).toEqual(cursor.steps.map((_, i) => i + 1));
  });

  it('treats a replay of committed request keys as a no-op', async () => {
    const before = await load();
    const ledgerBefore = await ledgerIdMax();
    // The second robot's chain (roster level, robot, two weapons, fit-out), the
    // facility level and the refinement chain: nothing since has changed what
    // they touched, as in a retry of the same request key.
    for (const entry of [executed[1], executed[2], executed[5]]) {
      // Same identity and ordinals as the original attempt.
      const replayCursor = createExecutionCursor();
      replayCursor.chargedSteps = entry.steps[0].ordinal - 1;
      await executeAction(entry.action, entry.goalId, entry.facts, ctx, replayCursor);
      expect(replayCursor.steps.map((s) => s.requestKey)).toEqual(entry.steps.map((s) => s.requestKey));
      expect(replayCursor.steps.every((s) => s.replayed && s.spent === 0)).toBe(true);
      expect(replayCursor.creditsSpent).toBe(0);
    }
    const after = await load();
    expect(after.balance).toBe(before.balance);
    expect(view(after)).toEqual(view(before));
    const newRows = await prisma.financialLedger.count({ where: { userId: fixture.userId, id: { gt: ledgerBefore } } });
    expect(newRows).toBe(0);
  });

  describe('forced planner bypass is rejected by the domain service with no state change', () => {
    async function bypassStable(tag: string, balance: number, prestige: number): Promise<{ fixture: AutomatonStableFixture; ctx: ExecutionContext }> {
      const f = await createAutomatonStable({
        tag: `${tag}${suffix}`,
        balance,
        prestige,
        blueprints: [
          { slotIndex: 1, robotName: `${tag}One${suffix}`, loadoutType: 'single', weaponPath: [{ main: 'Practice Sword' }] },
          { slotIndex: 2, robotName: `${tag}Two${suffix}`, loadoutType: 'single', weaponPath: [{ main: 'Practice Sword' }] },
        ],
      });
      userIds.push(f.userId);
      const bps = await loadBlueprintFacts(prisma, f.profileId);
      return {
        fixture: f,
        ctx: { ...ctx, identity: { ...ctx.identity, profileId: f.profileId, userId: f.userId, catalogueKey: f.catalogueKey }, blueprints: bps },
      };
    }

    async function snapshot(userId: number): Promise<unknown> {
      const [user, facilities, robots, ledger] = await Promise.all([
        prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { currency: true } }),
        prisma.facility.findMany({ where: { userId }, select: { facilityType: true, level: true }, orderBy: { facilityType: 'asc' } }),
        prisma.robot.count({ where: { userId } }),
        prisma.financialLedger.count({ where: { userId } }),
      ]);
      return { balance: user.currency, facilities, robots, ledger };
    }

    it('rejects an unaffordable facility level', async () => {
      const { fixture: f, ctx: c } = await bypassStable('poor', 1_000, 0);
      const facts = await loadStableFacts(prisma, f.profileId, { season: SEASON });
      const before = await snapshot(f.userId);
      const bypass = createExecutionCursor();
      await expect(executeAction({ kind: 'facility_upgrade', facilityType: 'repair_bay', toLevel: 1, cost: 50_000 }, 'x.1.facility', facts, c, bypass))
        .rejects.toMatchObject({ code: 'INSUFFICIENT_CREDITS' });
      expect(await snapshot(f.userId)).toEqual(before);
      expect(bypass.steps).toEqual([]);
    });

    it('rejects a prestige-gated facility level', async () => {
      const { fixture: f, ctx: c } = await bypassStable('gated', 10_000_000, 0);
      await prisma.facility.create({ data: { userId: f.userId, facilityType: 'repair_bay', level: 3 } });
      const facts = await loadStableFacts(prisma, f.profileId, { season: SEASON });
      const before = await snapshot(f.userId);
      await expect(executeAction({ kind: 'facility_upgrade', facilityType: 'repair_bay', toLevel: 4, cost: 200_000 }, 'x.1.facility', facts, c, createExecutionCursor()))
        .rejects.toMatchObject({ statusCode: 403 });
      expect(await snapshot(f.userId)).toEqual(before);
    });

    it('rejects a robot beyond the Roster_Capacity', async () => {
      const { fixture: f, ctx: c } = await bypassStable('roster', 10_000_000, 0);
      await prisma.robot.create({
        data: {
          userId: f.userId, name: `rosterOne${suffix}`, currentHP: 10, maxHP: 10, currentShield: 2, maxShield: 2,
          automatonSlotIndex: 1, automatonBlueprintId: f.blueprintIds.get(1),
        },
      });
      const facts = await loadStableFacts(prisma, f.profileId, { season: SEASON });
      const before = await snapshot(f.userId);
      const action: PlannedAction = {
        kind: 'robot_chain',
        slotIndex: 2,
        steps: [
          { kind: 'robot_purchase', robotName: `rosterTwo${suffix}`, cost: 500_000 },
          { kind: 'fitout', stageIndex: 0, loadoutType: 'single', equip: [], purchases: [] },
        ],
      };
      await expect(executeAction(action, 'x.1.robots', facts, c, createExecutionCursor()))
        .rejects.toMatchObject({ code: 'MAX_ROBOTS_REACHED' });
      expect(await snapshot(f.userId)).toEqual(before);
    });
  });
});
