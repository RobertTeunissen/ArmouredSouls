/**
 * Generic two-season scenario test (Spec #55, R6.7, R14.2, design §14.1).
 *
 * Runs for every Strategy_Definition_File in the strategy directories under
 * test: a fresh ₡3,000,000 stable is projected over two seasons with a simple
 * income model (credits and prestige per robot after every competitive turn)
 * and generated blueprints for every loadout. Asserts that the stable buys a
 * robot in its first preparation turn, never ends a turn below ₡0 through its
 * own purchases, has every robot armed after every turn, and at the end of
 * season two has its Build_Order Done or Blocked or is still spending into
 * "Attributes → Max".
 */
import { loadStrategyRegistry } from '../registry';
import { defaultParameters } from '../strategyParameters';
import {
  SCENARIO_STARTING_BALANCE,
  freshStableFacts,
  projectOpeningBuild,
  projectScenario,
  type ScenarioResult,
} from '../scenarioProjector';
import type { StableFacts } from '../../stableFacts';
import { planNextStep } from '../../turnPlanner';
import { TEST_WEIGHTS } from '../../__tests__/helpers/automatonFixtures';
import {
  FIXTURE_STRATEGY_DIRECTORY,
  SEED_WEAPON_MAP,
  STRATEGY_TEST_DIRECTORIES,
  generatedBlueprintSet,
} from './helpers/strategyTestSupport';

/**
 * Simple income model: per live robot after every competitive turn (several
 * battles a cycle across the subscribed events, streaming and merchandising).
 * It is a test model, not a balance claim; it is generous enough that a
 * strategy reaches its last Goal within two seasons, so a strategy that gets
 * stuck shows up as a failure.
 */
const CREDITS_PER_ROBOT_PER_TURN = 100_000;
const PRESTIGE_PER_ROBOT_PER_TURN = 60;
const PREPARATION_TURNS_PER_SEASON = 2;
const COMPETITIVE_TURNS_PER_SEASON = 60;
const SEASONS = 2;

const PHASES: StableFacts['phase'][] = Array.from({ length: SEASONS }, () => [
  ...Array<StableFacts['phase']>(PREPARATION_TURNS_PER_SEASON).fill('preparation'),
  ...Array<StableFacts['phase']>(COMPETITIVE_TURNS_PER_SEASON).fill('competitive'),
]).flat();

const STRATEGIES = STRATEGY_TEST_DIRECTORIES.flatMap((directory) =>
  loadStrategyRegistry({ directory, weightTable: TEST_WEIGHTS }).all());

describe.each(STRATEGIES.map((s) => [`${s.key}.v${s.version}`, s] as const))('generic scenario: %s (R6.7, R14.2)', (_name, strategy) => {
  const blueprints = generatedBlueprintSet(11);
  const params = defaultParameters(strategy.buildOrder);
  let result: ScenarioResult;

  beforeAll(() => {
    result = projectScenario({
      strategy,
      params,
      blueprints,
      weapons: SEED_WEAPON_MAP,
      teamNames: null,
      phases: PHASES,
      betweenTurns: (facts, turnIndex) => (PHASES[turnIndex] === 'competitive'
        ? {
          ...facts,
          balance: facts.balance + facts.robots.length * CREDITS_PER_ROBOT_PER_TURN,
          prestige: facts.prestige + facts.robots.length * PRESTIGE_PER_ROBOT_PER_TURN,
        }
        : facts),
    });
  });

  it('buys at least one robot in the first preparation turn', () => {
    const first = result.turns[0];
    expect(first.phase).toBe('preparation');
    expect(first.turn.steps.some((step) => step.action.kind === 'robot_chain')).toBe(true);
    expect(first.turn.facts.robots.length).toBeGreaterThanOrEqual(1);
  });

  it('never ends a turn below ₡0 through its own purchases', () => {
    for (const { turn } of result.turns) {
      expect(turn.facts.balance).toBeGreaterThanOrEqual(0);
      for (const step of turn.steps) expect(step.cost).toBeLessThanOrEqual(step.balanceBefore);
    }
  });

  it('has every robot armed after every turn', () => {
    for (const { turn } of result.turns) {
      for (const robot of turn.facts.robots) {
        expect(robot.mainInventoryId).not.toBeNull();
        expect(robot.stageIndex).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('ends season two Done or Blocked, or still spending into "Attributes → Max"', () => {
    const last = strategy.buildOrder[strategy.buildOrder.length - 1];
    const plan = planNextStep(result.facts, strategy, { params, blueprints, weapons: SEED_WEAPON_MAP });
    if (plan.next !== null) expect(plan.next.goalId).toBe(last.id);
  });

  it('exercises every Goal type of the strategy', () => {
    const kinds = new Set(result.turns.flatMap(({ turn }) => turn.steps.map((step) => step.action.kind)));
    expect(kinds).toEqual(new Set(['robot_chain', 'facility_upgrade', 'attribute_upgrade', 'weapon_stage', 'weapon_refinement']));
  });
});

describe('projectOpeningBuild (R6.12, design §14.0b)', () => {
  const [strategy] = loadStrategyRegistry({ directory: FIXTURE_STRATEGY_DIRECTORY, weightTable: TEST_WEIGHTS }).all();
  const blueprints = generatedBlueprintSet(11);
  const params = defaultParameters(strategy.buildOrder);
  const opening = projectOpeningBuild({ strategy, params, blueprints, weapons: SEED_WEAPON_MAP, teamNames: null });

  it('projects two preparation turns and the first competitive turn from ₡3,000,000', () => {
    expect(opening.turns.map((t) => t.phase)).toEqual(['preparation', 'preparation', 'competitive']);
    expect(opening.turns[0].turn.steps.length).toBeGreaterThan(0);
  });

  it('lists every charged step in order, and they account for the credits spent', () => {
    expect(opening.purchases[0]).toMatchObject({ turnIndex: 0, goalId: 'fixture.v1.01.robots', kind: 'robot_creation', label: 'Robot Scenario Unit 1' });
    const spent = opening.purchases.reduce((sum, p) => sum + p.cost, 0);
    expect(SCENARIO_STARTING_BALANCE - spent).toBe(opening.facts.balance);
    expect(opening.facts.robots.length).toBe(2);
    expect(opening.purchases.some((p) => p.kind === 'facility_upgrade' && p.label === 'Booking Office L1')).toBe(true);
  });

  it('is deterministic and leaves its inputs unchanged', () => {
    const fresh = freshStableFacts();
    const snapshot = JSON.stringify(fresh);
    const again = projectOpeningBuild({ strategy, params, blueprints, weapons: SEED_WEAPON_MAP, teamNames: null, initialFacts: fresh });
    expect(again.purchases).toEqual(opening.purchases);
    expect(JSON.stringify(fresh)).toBe(snapshot);
  });
});
