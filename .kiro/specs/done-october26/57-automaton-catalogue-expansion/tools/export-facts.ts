/**
 * Spec 57 — export the rule facts the Python tools need, straight from the
 * built code, so nothing is re-implemented by hand (decision 6: the built
 * spec-55 code is the source of truth).
 *
 * Roots (both read-only):
 *  - APP_ROOT        the checkout with the built spec-55 code
 *                    (env APP_ROOT, optional; default: the repository root,
 *                    derived from this script's location)
 *  - PROFANITY_ROOT  the checkout with the whole-word profanity filter
 *                    (env PROFANITY_ROOT, optional; default APP_ROOT)
 *
 * Read from APP_ROOT:
 *  - app/backend/prisma/seed.ts                                   WEAPON_DEFINITIONS
 *  - app/backend/src/services/automaton/pricing.ts                refinementStepCost, attributeIncrementCost
 *  - app/backend/src/shared/utils/weaponRefinement.ts             getRefinementMagnitudeRange
 *  - app/backend/src/shared/utils/discounts.ts                    calculateTrainingFacilityDiscount
 *  - app/backend/src/shared/utils/robotAttributes.ts              ROBOT_ATTRIBUTES (order)
 *  - app/backend/src/shared/utils/automatonTeamRule.ts            TEAM_RULE_2V2/3V3, requiredTeamNameCounts
 *  - app/backend/src/shared/utils/weaponSlots.ts                  canEquipToSlot
 *  - app/backend/src/services/subscription/eventRegistry.ts       SUBSCRIBABLE_EVENT_TYPES
 *  - app/backend/src/services/automaton/strategies/registry.ts    loadStrategyRegistry (repository strategies)
 *  - app/backend/src/services/automaton/buildFocus.ts             BUILD_FOCUS_WEIGHTS, ATTRIBUTE_GROUPS, attributesOfGroup
 *  - app/backend/src/services/automaton/automatonCatalogueService.ts  catalogue limits and enums
 *  - app/backend/src/services/automaton/robotNaming.ts            ROBOT_NAME_MAX_LENGTH
 * Read from PROFANITY_ROOT:
 *  - app/backend/src/utils/profanityFilter.ts                     PROFANITY_LIST, COMPOUND_MATCH_ENTRIES
 *
 * Run from app/backend of the repository (so its node_modules resolve):
 *   pnpm exec tsx "$S57/tools/export-facts.ts"
 *
 * Writes only tools/facts/facts.json next to this file.
 */
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';

// ── Roots ────────────────────────────────────────────────────────────

const TOOLS_DIR = path.dirname(__filename);
const S57_DIR = path.resolve(TOOLS_DIR, '..');
const REPO_ROOT = path.resolve(S57_DIR, '..', '..', '..', '..');

function resolveRoot(value: string | undefined, fallback: string): string {
  if (value === undefined || value === '') return fallback;
  return path.isAbsolute(value) ? path.resolve(value) : path.resolve(REPO_ROOT, value);
}

const APP_ROOT = resolveRoot(process.env.APP_ROOT, REPO_ROOT);
const PROFANITY_ROOT = resolveRoot(process.env.PROFANITY_ROOT, APP_ROOT);

/** Repo-relative path with '/' separators; '.' for the repo root itself. */
function repoRelative(target: string): string {
  const rel = path.relative(REPO_ROOT, target);
  return rel === '' ? '.' : rel.split(path.sep).join('/');
}

function headCommit(root: string): string {
  return execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

const CATALOGUE_SERVICE = 'app/backend/src/services/automaton/automatonCatalogueService.ts';
const PROFANITY_FILTER = 'app/backend/src/utils/profanityFilter.ts';

function requireRootsOrExit(): void {
  if (!existsSync(path.join(APP_ROOT, CATALOGUE_SERVICE))) {
    console.error(`export-facts: APP_ROOT=${APP_ROOT} has no ${CATALOGUE_SERVICE} (no built spec-55 code). `
      + 'The default is the repository root; set APP_ROOT only to check another checkout.');
    process.exit(1);
  }
  if (!existsSync(path.join(PROFANITY_ROOT, PROFANITY_FILTER))) {
    console.error(`export-facts: PROFANITY_ROOT=${PROFANITY_ROOT} has no ${PROFANITY_FILTER} (no whole-word filter). `
      + 'The default is APP_ROOT (the repository root); set PROFANITY_ROOT only to check another checkout.');
    process.exit(1);
  }
}

function load<T>(root: string, relative: string): T {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(path.join(root, relative)) as T;
}

// ── Typed views of the modules ───────────────────────────────────────

type Tier = 'hone' | 'augment' | 'sharpen' | 'forge';
type Hand = 'main' | 'offhand';

interface SeedModule { WEAPON_DEFINITIONS: readonly Record<string, unknown>[] }
interface PricingModule {
  refinementStepCost(tier: Tier, magnitude: number, existingInstancesOfTier: number): number;
  attributeIncrementCost(fromLevel: number, toLevel: number, trainingLevel: number, rosterCapacity: number): number;
}
interface RefinementModule { getRefinementMagnitudeRange(tier: Tier): [number, number] }
interface DiscountsModule { calculateTrainingFacilityDiscount(level: number, rosterCapacity: number): number }
interface AttributesModule { ROBOT_ATTRIBUTES: readonly string[] }
interface EventRegistryModule { SUBSCRIBABLE_EVENT_TYPES: readonly string[] }
interface GoalSpecView {
  id: string;
  position: number;
  type: string;
  facilityType?: string;
  defaultTarget: number;
  bounds: { min: number; max: number };
  isMax: boolean;
}
interface StrategyView { key: string; version: number; displayName: string; buildOrder: readonly GoalSpecView[] }
interface RegistryModule {
  loadStrategyRegistry(options: { weightTable: unknown }): { all(): StrategyView[] };
}
interface BuildFocusModule {
  BUILD_FOCUS_WEIGHTS: Readonly<Record<string, Readonly<Record<string, number>>>>;
  ATTRIBUTE_GROUPS: readonly string[];
  attributesOfGroup(group: string): string[];
}
interface CatalogueServiceModule {
  CATALOGUE_SCHEMA_VERSION: number;
  CATALOGUE_KEY_PATTERN: RegExp;
  MAX_BLUEPRINTS: number;
  MAX_WEAPON_STAGES: number;
  MAX_REFINEMENT_STEPS_PER_WEAPON: number;
  MAX_YIELD_THRESHOLD: number;
  FRANCHISE_MAX_LENGTH: number;
  BACKSTORY_MAX_LENGTH: number;
  TEAM_NAME_MIN_LENGTH: number;
  TEAM_NAME_MAX_LENGTH: number;
  LOADOUT_TYPES: readonly string[];
  STANCES: readonly string[];
  BUILD_FOCUS_KEYS: readonly string[];
}
interface TeamRuleModule {
  TEAM_RULE_2V2: readonly (readonly number[])[];
  TEAM_RULE_3V3: readonly (readonly number[])[];
  requiredTeamNameCounts(maxRobots: number): { twoVsTwo: number; threeVsThree: number };
}
interface WeaponSlotsModule {
  canEquipToSlot(weapon: { handsRequired: string; weaponType: string }, slot: Hand, loadoutType: string): { canEquip: boolean; reason?: string };
}
interface RobotNamingModule { ROBOT_NAME_MAX_LENGTH: number }
interface ProfanityModule { PROFANITY_LIST: readonly string[]; COMPOUND_MATCH_ENTRIES: readonly string[] }

interface WeaponFact {
  name: string;
  cost: number;
  handsRequired: string;
  weaponType: string;
  loadoutType: string;
  rangeBand: string;
  baseDamage: number;
  cooldown: number;
  bonuses: Record<string, number>;
}

const TIERS: readonly Tier[] = ['hone', 'augment', 'sharpen', 'forge'];
const HANDS: readonly Hand[] = ['main', 'offhand'];

function main(): void {
  requireRootsOrExit();
  const seed = load<SeedModule>(APP_ROOT, 'app/backend/prisma/seed');
  const pricing = load<PricingModule>(APP_ROOT, 'app/backend/src/services/automaton/pricing');
  const refinement = load<RefinementModule>(APP_ROOT, 'app/backend/src/shared/utils/weaponRefinement');
  const discounts = load<DiscountsModule>(APP_ROOT, 'app/backend/src/shared/utils/discounts');
  const attributes = load<AttributesModule>(APP_ROOT, 'app/backend/src/shared/utils/robotAttributes');
  const events = load<EventRegistryModule>(APP_ROOT, 'app/backend/src/services/subscription/eventRegistry');
  const registry = load<RegistryModule>(APP_ROOT, 'app/backend/src/services/automaton/strategies/registry');
  const buildFocus = load<BuildFocusModule>(APP_ROOT, 'app/backend/src/services/automaton/buildFocus');
  const catalogue = load<CatalogueServiceModule>(APP_ROOT, 'app/backend/src/services/automaton/automatonCatalogueService');
  const teamRule = load<TeamRuleModule>(APP_ROOT, 'app/backend/src/shared/utils/automatonTeamRule');
  const slots = load<WeaponSlotsModule>(APP_ROOT, 'app/backend/src/shared/utils/weaponSlots');
  const naming = load<RobotNamingModule>(APP_ROOT, 'app/backend/src/services/automaton/robotNaming');
  const profanity = load<ProfanityModule>(PROFANITY_ROOT, 'app/backend/src/utils/profanityFilter');

  const weapons: WeaponFact[] = seed.WEAPON_DEFINITIONS.map((record) => {
    const bonuses: Record<string, number> = {};
    for (const attr of attributes.ROBOT_ATTRIBUTES) {
      const v = record[`${attr}Bonus`];
      if (typeof v === 'number' && v !== 0) bonuses[attr] = v;
    }
    return {
      name: String(record.name),
      cost: Number(record.cost),
      handsRequired: String(record.handsRequired),
      weaponType: String(record.weaponType),
      loadoutType: String(record.loadoutType),
      rangeBand: String(record.rangeBand),
      baseDamage: Number(record.baseDamage),
      cooldown: Number(record.cooldown),
      bonuses,
    };
  });

  // tier -> "existingInstances:magnitude" -> cost (pricing.refinementStepCost, what refineWeapon charges).
  const refinementCosts: Record<string, Record<string, number>> = {};
  const magnitudeRanges: Record<string, [number, number]> = {};
  for (const tier of TIERS) {
    const [lo, hi] = refinement.getRefinementMagnitudeRange(tier);
    magnitudeRanges[tier] = [lo, hi];
    const table: Record<string, number> = {};
    for (let existing = 0; existing <= 1; existing++) {
      for (let m = lo; m <= hi; m++) table[`${existing}:${m}`] = pricing.refinementStepCost(tier, m, existing);
    }
    refinementCosts[tier] = table;
  }

  // "trainingLevel:rosterCapacity" -> [cost of level L -> L+1 for L = 0..60] (pricing.attributeIncrementCost,
  // what executeUpgradeTransaction charges).
  const attributeIncrementCost: Record<string, number[]> = {};
  const trainingFacilityDiscount: Record<string, number> = {};
  for (let t = 0; t <= 10; t++) {
    for (let r = 1; r <= 11; r++) {
      trainingFacilityDiscount[`${t}:${r}`] = discounts.calculateTrainingFacilityDiscount(t, r);
      const row: number[] = [];
      for (let level = 0; level <= 60; level++) row.push(pricing.attributeIncrementCost(level, level + 1, t, r));
      attributeIncrementCost[`${t}:${r}`] = row;
    }
  }

  const strategies = registry.loadStrategyRegistry({ weightTable: buildFocus.BUILD_FOCUS_WEIGHTS }).all().map((s) => ({
    key: s.key,
    version: s.version,
    displayName: s.displayName,
    buildOrder: s.buildOrder.map((g) => ({
      position: g.position,
      id: g.id,
      type: g.type,
      ...(g.facilityType !== undefined ? { facilityType: g.facilityType } : {}),
      defaultTarget: g.defaultTarget,
      bounds: { min: g.bounds.min, max: g.bounds.max },
      isMax: g.isMax,
    })),
  }));

  const groups = [...buildFocus.ATTRIBUTE_GROUPS];
  const buildFocusFacts = {
    weights: buildFocus.BUILD_FOCUS_WEIGHTS,
    groups,
    attributesOfGroup: Object.fromEntries(groups.map((g) => [g, buildFocus.attributesOfGroup(g)])),
  };

  const catalogueLimits = {
    schemaVersion: catalogue.CATALOGUE_SCHEMA_VERSION,
    catalogueKeyPattern: catalogue.CATALOGUE_KEY_PATTERN.source,
    maxBlueprints: catalogue.MAX_BLUEPRINTS,
    maxWeaponStages: catalogue.MAX_WEAPON_STAGES,
    maxRefinementStepsPerWeapon: catalogue.MAX_REFINEMENT_STEPS_PER_WEAPON,
    maxYieldThreshold: catalogue.MAX_YIELD_THRESHOLD,
    franchiseMaxLength: catalogue.FRANCHISE_MAX_LENGTH,
    backstoryMaxLength: catalogue.BACKSTORY_MAX_LENGTH,
    teamNameMinLength: catalogue.TEAM_NAME_MIN_LENGTH,
    teamNameMaxLength: catalogue.TEAM_NAME_MAX_LENGTH,
    robotNameMaxLength: naming.ROBOT_NAME_MAX_LENGTH,
    loadoutTypes: [...catalogue.LOADOUT_TYPES],
    stances: [...catalogue.STANCES],
    buildFocusKeys: [...catalogue.BUILD_FOCUS_KEYS],
  };

  const requiredCounts: Record<string, { twoVsTwo: number; threeVsThree: number }> = {};
  for (let n = 0; n <= catalogue.MAX_BLUEPRINTS; n++) requiredCounts[String(n)] = teamRule.requiredTeamNameCounts(n);
  const teamRuleFacts = {
    twoVsTwo: teamRule.TEAM_RULE_2V2.map((t) => [...t]),
    threeVsThree: teamRule.TEAM_RULE_3V3.map((t) => [...t]),
    requiredTeamNameCounts: requiredCounts,
  };

  // weapon -> hand -> loadout -> {canEquip, reason} (shared canEquipToSlot).
  const canEquip: Record<string, Record<string, Record<string, { canEquip: boolean; reason: string }>>> = {};
  for (const w of weapons) {
    const perHand: Record<string, Record<string, { canEquip: boolean; reason: string }>> = {};
    for (const hand of HANDS) {
      const perLoadout: Record<string, { canEquip: boolean; reason: string }> = {};
      for (const loadout of catalogue.LOADOUT_TYPES) {
        const fit = slots.canEquipToSlot(w, hand, loadout);
        perLoadout[loadout] = { canEquip: fit.canEquip, reason: fit.reason ?? '' };
      }
      perHand[hand] = perLoadout;
    }
    canEquip[w.name] = perHand;
  }

  const appRel = repoRelative(APP_ROOT);
  const profRel = repoRelative(PROFANITY_ROOT);
  const src = (root: string, file: string, names: string): string => `${root === '.' ? '' : `${root}/`}${file}#${names}`;
  const facts = {
    generatedBy: 'tools/export-facts.ts',
    appRoot: appRel,
    profanityRoot: profRel,
    appCommit: headCommit(APP_ROOT),
    profanityCommit: headCommit(PROFANITY_ROOT),
    sources: [
      src(appRel, 'app/backend/prisma/seed.ts', 'WEAPON_DEFINITIONS'),
      src(appRel, 'app/backend/src/services/automaton/pricing.ts', 'refinementStepCost,attributeIncrementCost'),
      src(appRel, 'app/shared/utils/weaponRefinement.ts', 'getRefinementMagnitudeRange'),
      src(appRel, 'app/shared/utils/discounts.ts', 'calculateTrainingFacilityDiscount'),
      src(appRel, 'app/shared/utils/robotAttributes.ts', 'ROBOT_ATTRIBUTES'),
      src(appRel, 'app/backend/src/services/subscription/eventRegistry.ts', 'SUBSCRIBABLE_EVENT_TYPES'),
      src(appRel, 'app/backend/src/services/automaton/strategies/registry.ts', 'loadStrategyRegistry'),
      src(appRel, 'app/backend/src/services/automaton/buildFocus.ts', 'BUILD_FOCUS_WEIGHTS,ATTRIBUTE_GROUPS,attributesOfGroup'),
      src(appRel, CATALOGUE_SERVICE, 'catalogue limits,LOADOUT_TYPES,STANCES,BUILD_FOCUS_KEYS,CATALOGUE_KEY_PATTERN'),
      src(appRel, 'app/backend/src/services/automaton/robotNaming.ts', 'ROBOT_NAME_MAX_LENGTH'),
      src(appRel, 'app/shared/utils/automatonTeamRule.ts', 'TEAM_RULE_2V2,TEAM_RULE_3V3,requiredTeamNameCounts'),
      src(appRel, 'app/shared/utils/weaponSlots.ts', 'canEquipToSlot'),
      src(profRel, PROFANITY_FILTER, 'PROFANITY_LIST,COMPOUND_MATCH_ENTRIES'),
    ],
    robotAttributes: [...attributes.ROBOT_ATTRIBUTES],
    eventTypes: [...events.SUBSCRIBABLE_EVENT_TYPES],
    weapons,
    refinementCosts,
    magnitudeRanges,
    attributeIncrementCost,
    trainingFacilityDiscount,
    strategies,
    buildFocus: buildFocusFacts,
    catalogueLimits,
    teamRule: teamRuleFacts,
    canEquip,
    profanity: {
      rule: 'whole-word',
      list: [...profanity.PROFANITY_LIST],
      compoundEntries: [...profanity.COMPOUND_MATCH_ENTRIES],
    },
  };

  const outDir = path.join(TOOLS_DIR, 'facts');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'facts.json'), `${JSON.stringify(facts, null, 2)}\n`);
  console.log(`facts.json: ${weapons.length} weapons, ${facts.eventTypes.length} event types, `
    + `${strategies.length} strategies (appRoot ${appRel}, profanityRoot ${profRel})`);
}

main();
