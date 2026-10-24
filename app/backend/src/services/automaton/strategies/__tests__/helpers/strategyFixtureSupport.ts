/**
 * Support for the six `{key}.v1.fixture.test.ts` suites (Spec #55, tasks
 * 4.3 and 4.5). Not a test file.
 *
 * - `parseBuildOrderTable` reads the first four columns (#, Goal, Default
 *   target, Allowed) of a Build_Order table copied from
 *   `review/STRATEGIES.md` §5–§10; `renderBuildOrder` writes a loaded
 *   strategy in the same notation, so a fixture test compares the file with
 *   the approved text and not with a second transcription.
 * - `catalogueBlueprint` builds the BlueprintFacts of a starter robot from
 *   the values in `review/CATALOGUE.md`, for the opening-build projection.
 * - `projectApprovedOpening` projects the opening from ₡3,000,000 and
 *   summarises what the approved opening tables state: robots bought,
 *   facility levels reached, credits spent and the Goal it ends Saving on.
 */
import { BUILD_FOCUS_WEIGHTS } from '../../../buildFocus';
import type { BuildFocusKey, RefinementStep } from '../../../../../types/automaton';
import type { RobotAttribute } from '../../../../../shared/utils/robotAttributes';
import { AUTOMATON_FACILITY_TYPES, type BlueprintFacts, type FacilityType, type LoadoutType, type Stance } from '../../../stableFacts';
import { planNextStep } from '../../../turnPlanner';
import { loadStrategyRegistry, STRATEGY_DIRECTORY } from '../../registry';
import { SCENARIO_STARTING_BALANCE, projectOpeningBuild, type ScenarioResult } from '../../scenarioProjector';
import { goalLabel } from '../../strategyDefinitionSchema';
import { defaultParameters } from '../../strategyParameters';
import type { UpgradeStrategy } from '../../strategyTypes';
import { SEED_WEAPON_MAP } from './strategyTestSupport';

// ── Build_Order notation of the review document ──────────────────────

export interface BuildOrderRow {
  position: number;
  goal: string;
  defaultTarget: string;
  allowed: string;
}

/** Parse `| # | Goal | Default target | Allowed |` rows (extra columns are ignored). */
export function parseBuildOrderTable(table: string): BuildOrderRow[] {
  return table
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|'))
    .map((line) => {
      const [position, goal, defaultTarget, allowed] = line.split('|').slice(1).map((cell) => cell.trim());
      return { position: Number(position), goal, defaultTarget, allowed };
    });
}

const range = (min: number, max: number, format: (n: number) => string): string =>
  (min === max ? format(min) : `${format(min)}–${format(max)}`);

/** A loaded strategy's Build_Order in the review document's notation. */
export function renderBuildOrder(strategy: UpgradeStrategy): BuildOrderRow[] {
  return strategy.definition.buildOrder.map((entry, index) => {
    const spec = strategy.buildOrder[index];
    const row = { position: entry.position, goal: goalLabel(entry.goal) };
    switch (spec.type) {
      case 'facility':
        return { ...row, defaultTarget: `L${spec.defaultTarget}`, allowed: `L${spec.bounds.min}–L${spec.bounds.max}` };
      case 'weapons':
        return {
          ...row,
          defaultTarget: spec.defaultTarget === 3 ? 'final stage' : `stage ${spec.defaultTarget}`,
          allowed: `stage ${range(spec.bounds.min, spec.bounds.max, String)}`,
        };
      case 'refine':
        return { ...row, defaultTarget: `${spec.defaultTarget} steps`, allowed: `${range(spec.bounds.min, spec.bounds.max, String)} steps` };
      case 'economy':
        return { ...row, defaultTarget: `${spec.defaultTarget} cycles`, allowed: `${range(spec.bounds.min, spec.bounds.max, String)} cycles` };
      case 'attributes':
        if (spec.isMax) return { ...row, defaultTarget: 'Max', allowed: 'Max' };
        return { ...row, defaultTarget: String(spec.defaultTarget), allowed: range(spec.bounds.min, spec.bounds.max, String) };
      case 'robots':
        return { ...row, defaultTarget: String(spec.defaultTarget), allowed: range(spec.bounds.min, spec.bounds.max, String) };
    }
  });
}

/** Version 1 of `key` from the repository strategy directory, with the approved Build_Focus weights. */
export function loadApprovedStrategy(key: string): UpgradeStrategy {
  const registry = loadStrategyRegistry({ directory: STRATEGY_DIRECTORY, weightTable: BUILD_FOCUS_WEIGHTS });
  const strategy = registry.getStrategy(key, 1);
  if (!strategy) throw new Error(`Strategy ${key}.v1 is missing from ${STRATEGY_DIRECTORY}`);
  return strategy;
}

// ── Starter blueprints (review/CATALOGUE.md) ─────────────────────────

/** Sharpen, Sharpen, Forge, Forge on one hand (decision 35). */
export function dpsSteps(hand: 'main' | 'offhand'): RefinementStep[] {
  return [
    { tier: 'sharpen', hand, magnitude: 1 },
    { tier: 'sharpen', hand, magnitude: 1 },
    { tier: 'forge', hand, magnitude: 1 },
    { tier: 'forge', hand, magnitude: 1 },
  ];
}

/** Two weapons interleaved tier by tier: main S, off S, main S, off S, main F, off F, … */
export function interleavedDpsSteps(): RefinementStep[] {
  const main = dpsSteps('main');
  const offhand = dpsSteps('offhand');
  return main.flatMap((step, i) => [step, offhand[i]]);
}

export function hone(hand: 'main' | 'offhand', targetAttribute: RobotAttribute, magnitude: number): RefinementStep {
  return { tier: 'hone', hand, targetAttribute, magnitude };
}

export function augment(hand: 'main' | 'offhand', targetAttribute: RobotAttribute, magnitude: number): RefinementStep {
  return { tier: 'augment', hand, targetAttribute, magnitude };
}

export interface CatalogueRobot {
  slot: number;
  name: string;
  loadout: LoadoutType;
  stance: Stance;
  yieldThreshold: number;
  buildFocus: BuildFocusKey;
  /** Stage 0 then stage 1, `[main, offhand?]` per stage. */
  path: [string, string?][];
  plan: RefinementStep[];
}

export function catalogueBlueprint(robot: CatalogueRobot): BlueprintFacts {
  return {
    blueprintId: 900 + robot.slot,
    slotIndex: robot.slot,
    robotName: robot.name,
    imageUrl: null,
    loadoutType: robot.loadout,
    stance: robot.stance,
    yieldThreshold: robot.yieldThreshold,
    buildFocus: robot.buildFocus,
    weaponPath: robot.path.map(([main, offhand]) => (offhand === undefined ? { main } : { main, offhand })),
    refinementPlan: robot.plan,
  };
}

// ── Opening projection ───────────────────────────────────────────────

export interface OpeningSummary {
  projection: ScenarioResult;
  /** Robot names in the order they were bought. */
  robotsBought: string[];
  /** Facilities above L0 after the opening. */
  facilityLevels: Partial<Record<FacilityType, number>>;
  creditsSpent: number;
  /** Position of the Goal the stable is Saving on after the opening, or null. */
  savingOnGoal: number | null;
}

/**
 * Documented tolerance of the opening-build assertion (task 4.5): robots
 * bought (names and order), facility levels reached and the Goal the opening
 * ends Saving on must match the approved table exactly; credits spent per Goal
 * and in total may differ from the table's figures by at most ₡15,000 (0.5% of
 * the ₡3,000,000 start), because the table's attribute figures are estimates
 * ("~") while the projection prices every attribute level exactly.
 */
export const OPENING_SPEND_TOLERANCE = 15_000;

/** Credits the projection spent per Goal position (a sale counts negative). */
export function spendPerGoal(summary: OpeningSummary, strategy: UpgradeStrategy): Record<number, number> {
  const positions = new Map(strategy.buildOrder.map((d) => [d.id, d.position]));
  const spend: Record<number, number> = {};
  for (const purchase of summary.projection.purchases) {
    const position = positions.get(purchase.goalId) as number;
    spend[position] = (spend[position] ?? 0) + purchase.cost;
  }
  return spend;
}

/** Project the opening from ₡3,000,000 with the default targets and the given blueprints. */
export function projectApprovedOpening(strategy: UpgradeStrategy, blueprints: BlueprintFacts[]): OpeningSummary {
  const params = defaultParameters(strategy.buildOrder);
  const projection = projectOpeningBuild({ strategy, params, blueprints, weapons: SEED_WEAPON_MAP, teamNames: null });
  const facilityLevels: Partial<Record<FacilityType, number>> = {};
  for (const type of AUTOMATON_FACILITY_TYPES) {
    if (projection.facts.facilities[type] > 0) facilityLevels[type] = projection.facts.facilities[type];
  }
  const plan = planNextStep(projection.facts, strategy, { params, blueprints, weapons: SEED_WEAPON_MAP });
  const saving = plan.next?.kind === 'saving' ? strategy.buildOrder.find((d) => d.id === plan.next?.goalId) : undefined;
  return {
    projection,
    robotsBought: projection.purchases.filter((p) => p.kind === 'robot_creation').map((p) => p.label.replace(/^Robot /, '')),
    facilityLevels,
    creditsSpent: SCENARIO_STARTING_BALANCE - projection.facts.balance,
    savingOnGoal: saving?.position ?? null,
  };
}

// ── Shared fixture suite ─────────────────────────────────────────────

/** What one approved strategy section states, copied from `review/STRATEGIES.md`. */
export interface ApprovedStrategyFixture {
  key: string;
  displayName: string;
  description: string;
  /** The Build_Order table rows (#, Goal, Default target, Allowed). */
  buildOrderTable: string;
  opening: {
    /** The catalogue robots the table was computed with. */
    blueprints: BlueprintFacts[];
    robotsBought: string[];
    facilityLevels: Partial<Record<FacilityType, number>>;
    /** Approved cost per Goal position (sum of the table's steps for that Goal). */
    spendPerGoal: Record<number, number>;
    /** Approved running total at the end of the opening. */
    totalSpent: number;
    /** The Goal the table ends Saving on. */
    savingOnGoal: number;
  };
}

/** The fixture suite of one `{key}.v1.json` (tasks 4.3 and 4.5). */
export function describeApprovedStrategy(fixture: ApprovedStrategyFixture): void {
  describe(`${fixture.key}.v1.json matches review/STRATEGIES.md (R13.4)`, () => {
    const strategy = loadApprovedStrategy(fixture.key);

    it('has the approved key, version, display name and description', () => {
      expect(strategy.key).toBe(fixture.key);
      expect(strategy.version).toBe(1);
      expect(strategy.displayName).toBe(fixture.displayName);
      expect(strategy.description).toBe(fixture.description);
    });

    it('has the approved Build_Order: Goal list, default targets and allowed ranges', () => {
      expect(renderBuildOrder(strategy)).toEqual(parseBuildOrderTable(fixture.buildOrderTable));
    });

    it('ends with "Attributes → Max"', () => {
      const last = strategy.buildOrder[strategy.buildOrder.length - 1];
      expect(last).toMatchObject({ type: 'attributes', isMax: true });
    });
  });

  describe(`${fixture.key}.v1 opening build from ₡3,000,000 (R6.1, R6.7, R14.1)`, () => {
    const strategy = loadApprovedStrategy(fixture.key);
    const summary = projectApprovedOpening(strategy, fixture.opening.blueprints);

    it('buys the approved robots in the approved order', () => {
      expect(summary.robotsBought).toEqual(fixture.opening.robotsBought);
      expect(summary.projection.facts.robots).toHaveLength(fixture.opening.robotsBought.length);
    });

    it('reaches the approved facility levels', () => {
      expect(summary.facilityLevels).toEqual(fixture.opening.facilityLevels);
    });

    it('ends the opening Saving on the approved Goal', () => {
      expect(summary.savingOnGoal).toBe(fixture.opening.savingOnGoal);
    });

    it(`spends what the approved table states, per Goal and in total, within ₡${OPENING_SPEND_TOLERANCE.toLocaleString('en-US')}`, () => {
      const spend = spendPerGoal(summary, strategy);
      expect(Object.keys(spend).map(Number).sort((a, b) => a - b))
        .toEqual(Object.keys(fixture.opening.spendPerGoal).map(Number).sort((a, b) => a - b));
      for (const [position, approved] of Object.entries(fixture.opening.spendPerGoal)) {
        expect(Math.abs(spend[Number(position)] - approved)).toBeLessThanOrEqual(OPENING_SPEND_TOLERANCE);
      }
      expect(Math.abs(summary.creditsSpent - fixture.opening.totalSpent)).toBeLessThanOrEqual(OPENING_SPEND_TOLERANCE);
      expect(summary.projection.facts.balance).toBeGreaterThanOrEqual(0);
    });
  });
}
