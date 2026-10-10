/**
 * Turn_Preview classification (Spec #55, R11.4, task 9.4): every Goal of the
 * Build_Order gets Done, Bought, Saving, Blocked or Waiting (gated when its
 * next step is prestige-gated), and the planned actions add up to the
 * projected spend. The database read path and the zero-write assertion are in
 * `tests/integration/automatonProfile.test.ts`.
 */
import { buildTurnPreview, type PreviewContext } from '../turnPreview';
import { simulateTurn } from '../turnPlanner';
import { freshStableFacts } from '../strategies/scenarioProjector';
import { defaultParameters } from '../strategies/strategyParameters';
import { SEED_WEAPON_MAP } from '../strategies/__tests__/helpers/strategyTestSupport';
import { CLONE_LEGION_OPENING } from '../strategies/__tests__/helpers/openingBlueprints';
import { repositoryStrategies } from './helpers/catalogueTestSupport';
import type { StableFacts } from '../stableFacts';

const swarm = repositoryStrategies().getStrategy('swarm', 1)!;
const ctx: PreviewContext = {
  params: defaultParameters(swarm.buildOrder),
  blueprints: CLONE_LEGION_OPENING,
  weapons: SEED_WEAPON_MAP,
  teamNames: { twoVsTwo: ['Domino Squad'], threeVsThree: ['Bad Batch'] },
};

function fresh(balance = 3_000_000): StableFacts {
  return { ...freshStableFacts(balance), phase: 'competitive' };
}

describe('buildTurnPreview', () => {
  it('returns one status per Goal in Build_Order order', () => {
    const preview = buildTurnPreview(fresh(), swarm, ctx);
    expect(preview.goals.map((g) => g.goalId)).toEqual(swarm.buildOrder.map((d) => d.id));
    expect(preview.goals.map((g) => g.position)).toEqual(swarm.buildOrder.map((d) => d.position));
  });

  it('marks bought Goals, one Saving Goal and Waiting below it, from ₡3,000,000', () => {
    const preview = buildTurnPreview(fresh(), swarm, ctx);
    expect(preview.stop).toBe('saving');
    expect(preview.goals[0]).toMatchObject({ status: 'bought', label: 'Robots', target: 3 });
    const savingIndex = preview.goals.findIndex((g) => g.status === 'saving');
    expect(savingIndex).toBeGreaterThan(0);
    const saving = preview.goals[savingIndex];
    expect(saving.needed).toBeGreaterThan(saving.available ?? Infinity);
    expect(saving.available).toBe(preview.projectedEndBalance);
    for (const goal of preview.goals.slice(savingIndex + 1)) expect(goal.status).toBe('waiting');
    for (const goal of preview.goals.slice(0, savingIndex)) expect(['done', 'bought', 'blocked']).toContain(goal.status);
  });

  it('marks Waiting Goals behind a prestige gate as gated', () => {
    const preview = buildTurnPreview(fresh(), swarm, ctx);
    const gated = preview.goals.filter((g) => g.status === 'waiting' && g.gated);
    expect(gated.length).toBeGreaterThan(0);
    for (const goal of gated) expect(goal.reason).toBe('prestige_gate');
  });

  it('lists the planned actions with costs that add up to the spend', () => {
    const preview = buildTurnPreview(fresh(), swarm, ctx);
    const spent = preview.actions.reduce((sum, a) => sum + a.cost, 0);
    expect(preview.startBalance - preview.projectedEndBalance).toBe(spent);
    expect(preview.actions[0]).toMatchObject({ kind: 'robot_chain', position: 1, detail: { slot: 1, robotName: 'CT-7567 Rex' } });
    expect(preview.chargedActions).toBe(preview.actions.reduce((sum, a) => sum + a.chargedSteps, 0));
    const boughtCost = preview.goals.reduce((sum, g) => sum + g.bought.cost, 0);
    expect(boughtCost).toBe(spent);
  });

  it('marks Goals satisfied before the turn as Done', () => {
    const after = simulateTurn(fresh(), swarm, ctx).facts;
    const preview = buildTurnPreview({ ...after, balance: 0 }, swarm, ctx);
    expect(preview.goals[0].status).toBe('done');
    expect(preview.actions).toEqual([]);
  });

  it('reports a reached prestige-gated Goal as Blocked with its reason', () => {
    const preview = buildTurnPreview(fresh(1_000_000_000), swarm, ctx);
    const blocked = preview.goals.filter((g) => g.status === 'blocked');
    expect(blocked.length).toBeGreaterThan(0);
    expect(blocked.some((g) => g.gated && g.reason === 'prestige_gate')).toBe(true);
  });

  it('is pure: the input facts are not changed', () => {
    const facts = fresh();
    const before = JSON.stringify(facts);
    buildTurnPreview(facts, swarm, ctx);
    expect(JSON.stringify(facts)).toBe(before);
  });
});
