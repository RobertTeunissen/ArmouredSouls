/**
 * Spec 57 — check the Staged_Entries against the built spec-55 code (R2.5,
 * decision 6). Nothing is re-implemented: every rule below is the built
 * function itself, loaded from APP_ROOT (and the whole-word profanity filter
 * from PROFANITY_ROOT). Both are optional env overrides and default to the
 * repository root, derived from this script's location.
 *
 * (a) `validateCatalogueEntry` (catalogueEntrySchema with the seed weapon
 *     catalogue and the repository strategies — the exact context of the built
 *     catalogue tests, `seedCatalogueContext`) on every catalogue/*.json and on
 *     every starter file. An issue counts as pendingWholeWord only when it is
 *     the stable-name profanity issue, the branch's (substring)
 *     `containsProfanity` rejects the name and the whole-word filter accepts
 *     it; every other issue is a failure (a starter issue is a control failure).
 * (b) `loadCatalogueDirectory` on catalogue/ and on the starter directory:
 *     the problem lines must be exactly the pendingWholeWord lines (0 for the
 *     starters).
 * (c) Uniqueness over every staged and starter entry: Catalogue_Key, stable name (exact and
 *     case-insensitive), robot name (exact), team name (exact).
 * (d) Whole-word verdict for every stable, team and robot name (a stable-name
 *     hit is a failure; robot and team hits are reported only).
 * (e) Two-season strategy-runner projection per entry (`projectScenario` +
 *     `planNextStep`) with the entry's own blueprints, parameters and team
 *     names, the income model of strategies/__tests__/strategyScenario.test.ts
 *     and its four assertions. Starters are the control group.
 *
 * Run from app/backend of the repository (so its node_modules resolve):
 *   pnpm exec tsx "$S57/tools/check-built.ts" [--only <catalogueKey>]
 * Writes only tools/facts/built-check.json (not with --only). Exit 2 on a
 * control (starter) failure or a root mismatch, 1 on any other failure, else 0.
 */
import { createHash } from 'crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import path from 'path';

// ── Roots (as in export-facts.ts) ────────────────────────────────────

const S57_DIR = path.resolve(__dirname, '..');
const TOOLS_DIR = path.join(S57_DIR, 'tools');
const FACTS_DIR = path.join(TOOLS_DIR, 'facts');
const STAGED_DIR = path.join(S57_DIR, 'catalogue');
const REPO_ROOT = path.resolve(S57_DIR, '..', '..', '..', '..');

function resolveRoot(value: string | undefined, fallback: string): string {
  if (value === undefined || value === '') return fallback;
  return path.isAbsolute(value) ? path.resolve(value) : path.resolve(REPO_ROOT, value);
}

const APP_ROOT = resolveRoot(process.env.APP_ROOT, REPO_ROOT);
const PROFANITY_ROOT = resolveRoot(process.env.PROFANITY_ROOT, APP_ROOT);

function repoRelative(target: string): string {
  const rel = path.relative(REPO_ROOT, target);
  return rel === '' ? '.' : rel.split(path.sep).join('/');
}

function fatal(message: string): never {
  console.error(`check-built: ${message}`);
  process.exit(2);
}

function load<T>(root: string, relative: string): T {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(path.join(root, relative)) as T;
}

// ── Typed views of the built modules ─────────────────────────────────

interface CatalogueIssue { rule: string; message: string; path: (string | number)[] }
interface GoalView { id: string; position: number; type: string; defaultTarget: number }
interface StrategyView { key: string; version: number; buildOrder: readonly GoalView[] }
interface StrategyParameters { targets: Record<string, number> }
interface CatalogueContext {
  weapons: ReadonlyMap<string, unknown>;
  strategies: { getStrategy(key: string, version: number): StrategyView | undefined };
}
interface RefinementStepView { tier: string; hand: string; magnitude: number; targetAttribute?: string }
interface BlueprintView {
  slot: number;
  robotName: string;
  loadoutType: string;
  stance: string;
  yieldThreshold: number;
  buildFocus: string;
  weaponPath: { main: string; offhand?: string }[];
  refinementPlan: RefinementStepView[];
}
interface EntryView {
  catalogueKey: string;
  stableName: string;
  strategy: { key: string; version: number; targetOverrides: Record<string, number> };
  teamNames: { twoVsTwo: string[]; threeVsThree: string[] };
  blueprints: BlueprintView[];
}
type ValidationResult =
  | { ok: true; entry: EntryView; parameters: StrategyParameters }
  | { ok: false; issues: CatalogueIssue[] };
interface CatalogueServiceModule {
  CATALOGUE_DIRECTORY: string;
  validateCatalogueEntry(raw: unknown, context: CatalogueContext): ValidationResult;
  catalogueEntryIssues(entry: EntryView, context: CatalogueContext): { issues: CatalogueIssue[]; parameters?: StrategyParameters };
  loadCatalogueDirectory(context: CatalogueContext, directory?: string): { entries: unknown[]; problems: string[] };
  formatCatalogueIssues(source: string, issues: readonly CatalogueIssue[]): string[];
}
interface CatalogueTestSupportModule {
  seedCatalogueContext(): CatalogueContext;
  STARTER_CATALOGUE_KEYS: readonly string[];
}
interface StrategyTestSupportModule { SEED_WEAPON_MAP: ReadonlyMap<string, unknown> }
interface BlueprintFacts {
  blueprintId: number;
  slotIndex: number;
  robotName: string;
  imageUrl: string | null;
  loadoutType: string;
  stance: string;
  yieldThreshold: number;
  buildFocus: string;
  weaponPath: { main: string; offhand?: string }[];
  refinementPlan: RefinementStepView[];
}
interface RobotFactsView {
  slotIndex: number;
  mainInventoryId: number | null;
  offhandInventoryId: number | null;
  stageIndex: number;
}
interface StableFactsView {
  balance: number;
  prestige: number;
  robots: RobotFactsView[];
  inventory: { inventoryId: number; refinements: unknown[] }[];
}
interface SimulatedStepView { goalId: string; action: { kind: string }; cost: number; balanceBefore: number }
interface ScenarioResultView {
  facts: StableFactsView;
  turns: { turnIndex: number; phase: string; turn: { facts: StableFactsView; steps: SimulatedStepView[] } }[];
}
interface PlannerContext { params: StrategyParameters; blueprints: readonly BlueprintFacts[]; weapons: ReadonlyMap<string, unknown> }
interface ScenarioProjectorModule {
  projectScenario(options: PlannerContext & {
    strategy: StrategyView;
    teamNames: { twoVsTwo: string[]; threeVsThree: string[] } | null;
    phases: readonly string[];
    betweenTurns?: (facts: StableFactsView, turnIndex: number) => StableFactsView;
  }): ScenarioResultView;
}
interface TurnPlannerModule {
  planNextStep(facts: StableFactsView, strategy: StrategyView, ctx: PlannerContext): { next: { goalId: string } | null };
}
interface ProfanityModule { containsProfanity(text: string): boolean }

// ── Income model (copied from strategies/__tests__/strategyScenario.test.ts) ──

const CREDITS_PER_STABLE_PER_TURN = 1_000_000;
const CREDITS_PER_ROBOT_PER_TURN = 250_000;
const PRESTIGE_PER_ROBOT_PER_TURN = 60;
const PREPARATION_TURNS_PER_SEASON = 2;
const COMPETITIVE_TURNS_PER_SEASON = 60;
const SEASONS = 2;
const PHASES: string[] = Array.from({ length: SEASONS }, () => [
  ...Array<string>(PREPARATION_TURNS_PER_SEASON).fill('preparation'),
  ...Array<string>(COMPETITIVE_TURNS_PER_SEASON).fill('competitive'),
]).flat();

const PENDING_MESSAGE = 'Stable name contains inappropriate content';

// ── Report shapes ────────────────────────────────────────────────────

interface Failure { key: string; check: string; message: string }
interface NameVerdict { kind: 'stable' | 'team' | 'robot'; key: string; slot?: number; name: string; wholeWordHit: boolean }
interface ProjectionMetrics {
  robotsBuilt: number;
  robotsTarget: number;
  robotsOnFinalStage: number;
  refinementRows: { slot: number; rows: number; withinTarget: number }[];
  actionKinds: string[];
  finalNextGoal: string | null;
}
interface Checked { key: string; file: string; starter: boolean; raw: unknown; entry: EntryView | null; parameters: StrategyParameters | null }

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) out[k] = sortKeys((value as Record<string, unknown>)[k]);
    return out;
  }
  return value;
}

function main(): number {
  const argv = process.argv.slice(2);
  const onlyIndex = argv.indexOf('--only');
  const only = onlyIndex >= 0 ? argv[onlyIndex + 1] : undefined;
  if (onlyIndex >= 0 && !only) fatal('--only needs a Catalogue_Key');

  if (!existsSync(path.join(APP_ROOT, 'app/backend/src/services/automaton/automatonCatalogueService.ts'))) {
    fatal(`APP_ROOT=${APP_ROOT} has no built spec-55 code (src/services/automaton/automatonCatalogueService.ts)`);
  }
  if (!existsSync(path.join(PROFANITY_ROOT, 'app/backend/src/utils/profanityFilter.ts'))) {
    fatal(`PROFANITY_ROOT=${PROFANITY_ROOT} has no app/backend/src/utils/profanityFilter.ts`);
  }
  const factsPath = path.join(FACTS_DIR, 'facts.json');
  if (!existsSync(factsPath)) fatal('tools/facts/facts.json is missing: run export-facts.ts first');
  const facts = JSON.parse(readFileSync(factsPath, 'utf8')) as { appRoot?: string; profanityRoot?: string };
  const appRel = repoRelative(APP_ROOT);
  const profRel = repoRelative(PROFANITY_ROOT);
  if (facts.appRoot !== appRel || facts.profanityRoot !== profRel) {
    fatal(`facts.json was exported for appRoot=${facts.appRoot}, profanityRoot=${facts.profanityRoot}; resolved roots are `
      + `appRoot=${appRel}, profanityRoot=${profRel}. Re-run export-facts.ts with the same roots.`);
  }

  const service = load<CatalogueServiceModule>(APP_ROOT, 'app/backend/src/services/automaton/automatonCatalogueService');
  const support = load<CatalogueTestSupportModule>(APP_ROOT, 'app/backend/src/services/automaton/__tests__/helpers/catalogueTestSupport');
  const strategySupport = load<StrategyTestSupportModule>(APP_ROOT, 'app/backend/src/services/automaton/strategies/__tests__/helpers/strategyTestSupport');
  const projector = load<ScenarioProjectorModule>(APP_ROOT, 'app/backend/src/services/automaton/strategies/scenarioProjector');
  const planner = load<TurnPlannerModule>(APP_ROOT, 'app/backend/src/services/automaton/turnPlanner');
  const builtProfanity = load<ProfanityModule>(APP_ROOT, 'app/backend/src/utils/validation');
  const wholeWord = load<ProfanityModule>(PROFANITY_ROOT, 'app/backend/src/utils/profanityFilter');

  const ctx = support.seedCatalogueContext();
  const weapons = strategySupport.SEED_WEAPON_MAP;
  const starterKeys = new Set(support.STARTER_CATALOGUE_KEYS);

  const failures: Failure[] = [];
  const controlFailures: Failure[] = [];
  const fail = (starter: boolean, f: Failure): void => { (starter ? controlFailures : failures).push(f); };

  // (a) validateCatalogueEntry on every staged and starter file.
  const stagedFiles = readdirSync(STAGED_DIR).filter((f) => f.endsWith('.json')).sort();
  // After Task Group 2 the repository folder also holds the delivered Expansion_Stables: a file
  // with a Staged_Entry of the same name is one of them (checked above as staged), not a starter.
  const stagedSet = new Set(stagedFiles);
  const starterFiles = readdirSync(service.CATALOGUE_DIRECTORY).filter((f) => f.endsWith('.json') && !stagedSet.has(f)).sort();
  const fileHashes: Record<string, string> = {};
  const checked: Checked[] = [];
  const pending: string[] = [];
  const pendingLines: string[] = [];
  let stagedValid = 0;
  let starterValid = 0;
  const inputs: { dir: string; file: string; starter: boolean }[] = [
    ...stagedFiles.map((file) => ({ dir: STAGED_DIR, file, starter: false })),
    ...starterFiles.map((file) => ({ dir: service.CATALOGUE_DIRECTORY, file, starter: true })),
  ];
  for (const { dir, file, starter } of inputs) {
    const key = file.replace(/\.json$/, '');
    if (only !== undefined && key !== only) continue;
    const bytes = readFileSync(path.join(dir, file));
    if (!starter) fileHashes[key] = createHash('sha256').update(bytes).digest('hex');
    let raw: unknown;
    try {
      raw = JSON.parse(bytes.toString('utf8'));
    } catch (error) {
      fail(starter, { key, check: 'schema', message: `not valid JSON: ${error instanceof Error ? error.message : String(error)}` });
      continue;
    }
    if (starter && !starterKeys.has(key)) fail(true, { key, check: 'schema', message: 'starter file not in STARTER_CATALOGUE_KEYS' });
    const result = service.validateCatalogueEntry(raw, ctx);
    if (result.ok) {
      if (starter) starterValid++; else stagedValid++;
      checked.push({ key, file, starter, raw, entry: result.entry, parameters: result.parameters });
      continue;
    }
    const name = (raw as { stableName?: unknown }).stableName;
    const isPending = (issue: CatalogueIssue): boolean => issue.rule === 'stable_name'
      && issue.message === PENDING_MESSAGE
      && typeof name === 'string'
      && builtProfanity.containsProfanity(name)
      && !wholeWord.containsProfanity(name);
    const pendingIssues = result.issues.filter(isPending);
    const others = result.issues.filter((issue) => !isPending(issue));
    for (const issue of others) {
      fail(starter, { key, check: `schema:${issue.rule}`, message: `[${issue.path.join('.')}] ${issue.message}` });
    }
    if (pendingIssues.length > 0) {
      if (starter) {
        fail(true, { key, check: 'schema:stable_name', message: 'starter stable name pending the whole-word rule' });
      } else {
        pending.push(key);
        pendingLines.push(...service.formatCatalogueIssues(file, pendingIssues));
      }
    }
    // Parameters for the projection: the context rules still resolve the strategy (structure is valid).
    const entry = raw as EntryView;
    const resolved = others.length === 0 ? service.catalogueEntryIssues(entry, ctx) : { issues: [], parameters: undefined };
    checked.push({ key, file, starter, raw, entry: others.length === 0 ? entry : null, parameters: resolved.parameters ?? null });
  }

  // (b) loadCatalogueDirectory reproduces exactly the pending lines (0 for the starters).
  if (only === undefined) {
    const staged = service.loadCatalogueDirectory(ctx, STAGED_DIR);
    const got = [...staged.problems].sort();
    const want = [...pendingLines].sort();
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      const extra = got.filter((l) => !want.includes(l));
      const missing = want.filter((l) => !got.includes(l));
      failures.push({ key: '(catalogue/)', check: 'directory', message: `loadCatalogueDirectory problems differ: extra ${JSON.stringify(extra)}, missing ${JSON.stringify(missing)}` });
    }
    const starters = service.loadCatalogueDirectory(ctx);
    for (const line of starters.problems) controlFailures.push({ key: '(starter directory)', check: 'directory', message: line });
  }

  // (c) uniqueness and (d) whole-word verdicts over the entries.
  const entries = checked.filter((c) => c.entry !== null) as (Checked & { entry: EntryView })[];
  entries.sort((a, b) => a.key.localeCompare(b.key));
  const uniqueness: Record<string, { name: string; keys: string[] }[]> = {
    catalogueKey: [], stableNameExact: [], stableNameCaseInsensitive: [], robotNameExact: [], teamNameExact: [],
  };
  const seen: Record<string, Map<string, string[]>> = {
    catalogueKey: new Map(), stableNameExact: new Map(), stableNameCaseInsensitive: new Map(), robotNameExact: new Map(), teamNameExact: new Map(),
  };
  const note = (kind: string, name: string, key: string): void => {
    const list = seen[kind].get(name) ?? [];
    list.push(key);
    seen[kind].set(name, list);
  };
  const names: NameVerdict[] = [];
  for (const { key, entry } of entries) {
    note('catalogueKey', entry.catalogueKey, key);
    note('stableNameExact', entry.stableName, key);
    note('stableNameCaseInsensitive', entry.stableName.toLowerCase(), key);
    names.push({ kind: 'stable', key, name: entry.stableName, wholeWordHit: wholeWord.containsProfanity(entry.stableName) });
    for (const team of [...entry.teamNames.twoVsTwo, ...entry.teamNames.threeVsThree]) {
      note('teamNameExact', team, key);
      names.push({ kind: 'team', key, name: team, wholeWordHit: wholeWord.containsProfanity(team) });
    }
    for (const b of entry.blueprints) {
      note('robotNameExact', b.robotName, key);
      names.push({ kind: 'robot', key, slot: b.slot, name: b.robotName, wholeWordHit: wholeWord.containsProfanity(b.robotName) });
    }
  }
  for (const [kind, map] of Object.entries(seen)) {
    for (const [name, keys] of [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      if (keys.length < 2) continue;
      uniqueness[kind].push({ name, keys });
      const control = keys.every((k) => starterKeys.has(k));
      fail(control, { key: keys.filter((k) => !starterKeys.has(k))[0] ?? keys[0], check: `unique:${kind}`, message: `${JSON.stringify(name)} is used by ${keys.join(', ')}` });
    }
  }
  for (const n of names) {
    if (n.kind === 'stable' && n.wholeWordHit) fail(starterKeys.has(n.key), { key: n.key, check: 'profanity:stable', message: `stable name ${JSON.stringify(n.name)} fails the whole-word filter` });
  }

  // (e) two-season projection per entry.
  const projections: Record<string, { passed: boolean; metrics: ProjectionMetrics | null }> = {};
  for (const c of checked) {
    const { key, starter } = c;
    const entry = c.entry;
    const reportFail = (message: string): void => fail(starter, { key, check: 'projection', message });
    if (entry === null || c.parameters === null) {
      projections[key] = { passed: false, metrics: null };
      reportFail('not projected: the entry fails the built schema');
      continue;
    }
    const strategy = ctx.strategies.getStrategy(entry.strategy.key, entry.strategy.version);
    if (!strategy) {
      projections[key] = { passed: false, metrics: null };
      reportFail(`strategy ${entry.strategy.key} v${entry.strategy.version} not in the registry`);
      continue;
    }
    const params = c.parameters;
    const blueprints: BlueprintFacts[] = [...entry.blueprints].sort((a, b) => a.slot - b.slot).map((b) => ({
      blueprintId: 1000 + b.slot,
      slotIndex: b.slot,
      robotName: b.robotName,
      imageUrl: null,
      loadoutType: b.loadoutType,
      stance: b.stance,
      yieldThreshold: b.yieldThreshold,
      buildFocus: b.buildFocus,
      weaponPath: b.weaponPath,
      refinementPlan: b.refinementPlan,
    }));
    const before = failures.length + controlFailures.length;
    let result: ScenarioResultView;
    try {
      result = projector.projectScenario({
        strategy,
        params,
        blueprints,
        weapons,
        teamNames: entry.teamNames,
        phases: PHASES,
        betweenTurns: (f, turnIndex) => (PHASES[turnIndex] === 'competitive'
          ? {
            ...f,
            balance: f.balance + CREDITS_PER_STABLE_PER_TURN + f.robots.length * CREDITS_PER_ROBOT_PER_TURN,
            prestige: f.prestige + f.robots.length * PRESTIGE_PER_ROBOT_PER_TURN,
          }
          : f),
      });
    } catch (error) {
      projections[key] = { passed: false, metrics: null };
      reportFail(`projectScenario threw: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    const first = result.turns[0];
    if (!first || first.phase !== 'preparation' || !first.turn.steps.some((s) => s.action.kind === 'robot_chain')
      || first.turn.facts.robots.length < 1) {
      reportFail('turn 0 is not a preparation turn that buys a robot (robot_chain)');
    }
    for (const { turnIndex, turn } of result.turns) {
      if (turn.facts.balance < 0) reportFail(`turn ${turnIndex} ends at ₡${turn.facts.balance}`);
      for (const step of turn.steps) {
        if (step.cost > step.balanceBefore) reportFail(`turn ${turnIndex} ${step.goalId}: cost ₡${step.cost} > balance ₡${step.balanceBefore}`);
      }
      for (const robot of turn.facts.robots) {
        if (robot.mainInventoryId === null || robot.stageIndex < 0) reportFail(`turn ${turnIndex}: robot slot ${robot.slotIndex} is not armed`);
      }
    }
    const last = strategy.buildOrder[strategy.buildOrder.length - 1];
    const plan = planner.planNextStep(result.facts, strategy, { params, blueprints, weapons });
    if (plan.next !== null && plan.next.goalId !== last.id) {
      reportFail(`season two ends with ${plan.next.goalId} next, not Done/Blocked or ${last.id}`);
    }

    const target = (g: GoalView): number => params.targets[g.id] ?? g.defaultTarget;
    const robotsTarget = Math.max(0, ...strategy.buildOrder.filter((g) => g.type === 'robots').map(target));
    const refineGoal = strategy.buildOrder.find((g) => g.type === 'refine');
    const refineTarget = refineGoal ? target(refineGoal) : 0;
    const bySlot = new Map(blueprints.map((b) => [b.slotIndex, b]));
    const rowsOf = (id: number | null): number => (id === null ? 0 : result.facts.inventory.find((i) => i.inventoryId === id)?.refinements.length ?? 0);
    const metrics: ProjectionMetrics = {
      robotsBuilt: result.facts.robots.length,
      robotsTarget,
      robotsOnFinalStage: result.facts.robots.filter((r) => r.stageIndex === (bySlot.get(r.slotIndex)?.weaponPath.length ?? 0) - 1).length,
      refinementRows: result.facts.robots.map((r) => ({
        slot: r.slotIndex,
        rows: rowsOf(r.mainInventoryId) + (r.offhandInventoryId !== r.mainInventoryId ? rowsOf(r.offhandInventoryId) : 0),
        withinTarget: Math.min(refineTarget, bySlot.get(r.slotIndex)?.refinementPlan.length ?? 0),
      })),
      actionKinds: [...new Set(result.turns.flatMap(({ turn }) => turn.steps.map((s) => s.action.kind)))].sort(),
      finalNextGoal: plan.next === null ? null : plan.next.goalId,
    };
    projections[key] = { passed: failures.length + controlFailures.length === before, metrics };
  }

  const stagedChecked = checked.filter((c) => !c.starter).length;
  const startersChecked = checked.filter((c) => c.starter).length;
  const passed = Object.values(projections).filter((p) => p.passed).length;
  console.log(`check-built: staged ${stagedValid}/${stagedChecked} valid, starters ${starterValid}/${startersChecked} valid; `
    + `pendingWholeWord ${pending.length} [${pending.join(', ')}]; failures ${failures.length}; `
    + `control failures ${controlFailures.length}; projections passed ${passed}/${Object.keys(projections).length}`);
  for (const f of [...controlFailures.map((x) => ({ ...x, control: true })), ...failures.map((x) => ({ ...x, control: false }))]) {
    console.log(`  ${f.control ? 'CONTROL ' : ''}${f.key} ${f.check}: ${f.message}`);
  }

  if (only === undefined) {
    const report = {
      generatedBy: 'tools/check-built.ts',
      appRoot: appRel,
      profanityRoot: profRel,
      files: fileHashes,
      staged: { checked: stagedChecked, valid: stagedValid },
      starters: { checked: startersChecked, valid: starterValid },
      pendingWholeWord: [...pending].sort(),
      failures,
      controlFailures,
      uniqueness,
      names,
      projections,
    };
    writeFileSync(path.join(FACTS_DIR, 'built-check.json'), `${JSON.stringify(sortKeys(report), null, 2)}\n`);
  }
  if (controlFailures.length > 0) return 2;
  return failures.length > 0 ? 1 : 0;
}

process.exitCode = main();
