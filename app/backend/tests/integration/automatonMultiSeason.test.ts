/**
 * Spec #55 task 12.2 — heavy multi-season
 * simulation of the Automaton rules (R11.14, R14.4, design §21 Heavy row). Spec 55 R7.10 (300 s Turn_Step budget, design §19)
 * is superseded by the Turn_Step deadline rule
 * (`docs/implementation_notes/AUTOMATON_TURN_STEP_DEADLINE.md`).
 *
 * HEAVY tier: it runs a Season_Rollover, which archives, deletes generated
 * stables, resets every stable and truncates the history tables of the whole
 * database. Run it only on a dedicated database (CI's heavy job or a local
 * `armouredsouls_heavy`), never on a shared dev database.
 *
 * Population (`loadHeavyPopulation`, header of `tests/helpers/automatonHeavyFixture.ts`):
 * Catalogue_Sync adds every repository Catalogue_Entry as a draft (each one
 * must sync against the database), and only the heavy population is
 * activated and takes turns: the Starter_Stables, which alone cover the
 * Coverage_Matrix, so the run tests every rule without growing with the
 * catalogue. `AUTOMATON_HEAVY_POPULATION=catalogue` activates every entry
 * for a scale measurement (manual `Automaton scale run` workflow).
 *
 * Timeline, every step through the real `executeSettlement` (scheduler path)
 * with `SEASON_LENGTH_CYCLES = 6` and `PREPARATION_LENGTH_CYCLES = 2`:
 *   season 1: 2 preparation settlements, 5 competitive settlements, one full
 *             season of bulk battles + Strategy_Comparison timing, then the
 *             6th (boundary) settlement → Season_Rollover → Stage 5
 *             `season_open` turns in season 2;
 *   season 2: 2 preparation settlements (every stable must have rebuilt),
 *             5 competitive settlements, bulk battles + comparison timing.
 * Season 2's boundary is not run: the spec asks for one rollover.
 *
 * After every settlement: exactly one Turn_Step with one Turn_Record per
 * Automaton (attempt 1, none failed or skipped: every stable must take its
 * turn), the step within its deadline (SCHEDULER_ENABLED is off in tests, so
 * the deadline is the AUTOMATON_TURN_STEP_MAX_MS cap), no Turn_Record key
 * twice, no Automaton purchase ledger row below zero, every Automaton robot
 * armed. Battle events are not run (no battle job is part of settlement); the
 * bulk battles stand in for a season of results at ACC volume.
 *
 * Measured step durations, the Automatons processed, their quotient, the
 * effective concurrency (AUTOMATON_TURN_CONCURRENCY clamped by DB_POOL_MAX),
 * turns stopped by their own Turn_Budget (`turn_budget_exhausted`) and the
 * peak database connections are logged per Turn_Step and per Turn_Trigger
 * with the `[automaton-heavy]` prefix for the implementation record
 * (`docs/implementation_notes/AUTOMATON_TURN_STEP_DEADLINE.md`); any
 * `step_budget_exhausted` Turn_Record fails the test.
 */
import { performance } from 'node:perf_hooks';
import prisma from '../../src/lib/prisma';
import logger from '../../src/config/logger';
import { executeSettlement } from '../../src/services/cycle/cycleScheduler';
import { invalidateSeasonCache } from '../../src/services/season/seasonService';
import { setAlertSender } from '../../src/services/automaton/automatonObservability';
import { syncCatalogue } from '../../src/services/automaton/catalogueSync';
import { activateProfile } from '../../src/services/automaton/automatonProfileService';
import { CATALOGUE_DIRECTORY, validateCatalogueEntry, BUILD_FOCUS_KEYS } from '../../src/services/automaton/automatonCatalogueService';
import { getStrategyRegistry } from '../../src/services/automaton/strategies/defaultRegistry';
import { loadWeaponCatalogue } from '../../src/services/automaton/stableFacts';
import { clearStrategyComparisonCache, type StrategyComparison } from '../../src/services/automaton/strategyComparisonService';
import {
  TURN_ACTION_LIMIT,
  STEP_BUDGET_EXHAUSTED,
  TURN_BUDGET_EXHAUSTED,
  effectiveTurnConcurrency,
} from '../../src/services/automaton/turnBudget';
import { resolveDbPoolMax } from '../../src/lib/dbPoolConfig';
import { getConfig } from '../../src/config/env';
import { SUBSCRIBABLE_EVENT_TYPES, isRegisteredEvent, registerSubscribableEvent } from '../../src/services/subscription/eventRegistry';
import type { TurnActionRecord } from '../../src/types/automaton';
import {
  ACC_DAILY_BATTLES,
  FULL_SEASON_CYCLES,
  HEAVY_STRATEGY_KEYS,
  STARTER_CATALOGUE_KEYS,
  deletePopulation,
  deleteStables,
  heavyPopulationMode,
  insertSeasonOfBattles,
  loadHeavyPopulation,
  loadRepositoryEntries,
  type BulkBattleResult,
} from '../helpers/automatonHeavyFixture';
import { runTag, startAdminApi, type AdminApiHarness } from '../helpers/automatonAdminApi';

/** Every repository Catalogue_Entry: all are synced as drafts. */
const REPOSITORY = loadRepositoryEntries();
/** The stables that are activated and take turns (starters, or every entry for a scale run). */
const POPULATION_MODE = heavyPopulationMode();
const POPULATION = loadHeavyPopulation(POPULATION_MODE);

/**
 * Per phase (`beforeAll`, each `it`, `afterAll`). Spec 55 measured ~14 min in
 * all for 100 Automatons, dominated by the two opening-build Turn_Steps
 * (~250 s each), with a 15-minute phase timeout. 9 s per Automaton reproduces
 * that timeout at 100 and grows with the population (a scale run). The
 * Turn_Step itself is no longer bounded at 300 s (spec 55 R7.10 superseded):
 * it runs until its deadline, so this phase timeout, not the step, is what
 * fails a pathologically slow run. CI's heavy job has 30 minutes for the
 * whole tier.
 */
const PHASE_TIMEOUT_MS = Math.max(15 * 60_000, POPULATION.length * 9_000);
const COMPARISON_BUDGET_MS = 2_000;
/** pg_stat_activity sampling interval while a settlement runs. */
const CONNECTION_SAMPLE_MS = 500;
const SEASON_LENGTH = 6;
const PREPARATION_LENGTH = 2;
const HUMAN_STABLES = 12;
const HUMAN_ROBOTS_EACH = 3;
const PURCHASE_TYPES = ['robot_creation', 'attribute_upgrade', 'facility_upgrade', 'weapon_purchase', 'weapon_refinement'];

const tag = runTag();

interface StepRecord {
  label: string;
  seasonNumber: number;
  trigger: string;
  slot: number;
  turns: number;
  profiles: number;
  /** Turn_Records whose status is not `skipped`. */
  processed: number;
  /** Turn_Records skipped with `step_budget_exhausted`. */
  budgetSkipped: number;
  stepMs: number;
  msPerAutomaton: number;
  settlementMs: number;
  chargedActions: number;
  robotsBought: number;
  maxTurnMs: number;
  /** Effective Turn_Step concurrency (configured value clamped by the pool). */
  concurrency: number;
  /** Turns that stopped on their own 60-action / 10 s Turn_Budget. */
  turnBudgetStops: number;
  /** Highest connection count to this database sampled during the settlement. */
  peakConnections: number;
}

/** The concurrency the Turn_Step uses with the current environment. */
function currentConcurrency(): number {
  return effectiveTurnConcurrency(getConfig().automatonTurnConcurrency, resolveDbPoolMax());
}

/** Sample connections to the current database every CONNECTION_SAMPLE_MS until stopped. */
function startConnectionSampler(): { stop: () => Promise<number> } {
  let peak = 0;
  let inFlight: Promise<void> | null = null;
  const sample = async (): Promise<void> => {
    try {
      const rows = await prisma.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database()`;
      peak = Math.max(peak, Number(rows[0]?.n ?? 0));
    } catch {
      // Sampling is evidence only; a failed sample never fails the step.
    }
  };
  const timer = setInterval(() => {
    if (inFlight === null) inFlight = sample().finally(() => { inFlight = null; });
  }, CONNECTION_SAMPLE_MS);
  return {
    stop: async (): Promise<number> => {
      clearInterval(timer);
      if (inFlight !== null) await inFlight;
      return peak;
    },
  };
}

async function resetSeasonTables(): Promise<void> {
  await prisma.seasonAccolade.deleteMany({});
  await prisma.seasonStandingSnapshot.deleteMany({});
  await prisma.robotSeasonArchive.deleteMany({});
  await prisma.stableSeasonArchive.deleteMany({});
  await prisma.season.deleteMany({});
  invalidateSeasonCache();
}

describe('Automaton multi-season simulation (Spec #55 task 12.2)', () => {
  /** Catalogue_Keys of the active population. */
  const catalogueKeys: string[] = [];
  /** Catalogue_Keys of every synced entry (drafts included), for cleanup. */
  const repositoryKeys: string[] = [];
  const automatonUserIds: number[] = [];
  const profileIds: number[] = [];
  const humanUserIds: number[] = [];
  const steps: StepRecord[] = [];
  const comparisons: { label: string; ms: number; bulk: BulkBattleResult }[] = [];
  const alerts: string[] = [];
  let harness: AdminApiHarness;
  let previousSender: ReturnType<typeof setAlertSender>;
  let previousEnv: { season?: string; preparation?: string };
  let firstUserId = 0;
  let rolloverAt: Date;
  let lastBulk: BulkBattleResult | null = null;

  async function seedHumanRobots(round: string): Promise<number[]> {
    const robotIds: number[] = [];
    const tiers = ['bronze', 'silver', 'gold', 'platinum'];
    for (const [index, userId] of humanUserIds.entries()) {
      for (let r = 0; r < HUMAN_ROBOTS_EACH; r += 1) {
        const robot = await prisma.robot.create({
          data: { userId, name: `Hv Human ${tag} ${round} ${index}-${r}`, currentHP: 100, maxHP: 100, currentShield: 10, maxShield: 10 },
        });
        robotIds.push(robot.id);
        const tier = tiers[(index + r) % tiers.length];
        await prisma.standing.create({ data: { entityType: 'robot', entityId: robot.id, mode: 'league_1v1', tier, leagueInstanceId: `${tier}_1` } });
      }
    }
    return robotIds;
  }

  async function automatonRobotIds(): Promise<number[]> {
    return (await prisma.robot.findMany({ where: { userId: { in: automatonUserIds } }, select: { id: true }, orderBy: { id: 'asc' } })).map((r) => r.id);
  }

  /** Invariants that hold at the end of every settlement (R14.4). */
  async function assertEndOfSettlement(label: string): Promise<void> {
    const unarmed = await prisma.robot.findMany({ where: { userId: { in: automatonUserIds }, mainWeaponId: null }, select: { name: true } });
    expect({ label, unarmed: unarmed.map((r) => r.name) }).toEqual({ label, unarmed: [] });
    const belowZero = await prisma.financialLedger.count({
      where: { userId: { in: automatonUserIds }, transactionType: { in: PURCHASE_TYPES }, amount: { lt: 0 }, balanceAfter: { lt: 0 } },
    });
    expect({ label, belowZero }).toEqual({ label, belowZero: 0 });
    const duplicated = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*)::bigint AS count FROM (
        SELECT 1 FROM "automaton_turns" GROUP BY "profile_id", "season_number", "trigger", "slot" HAVING count(*) > 1
      ) d`;
    expect({ label, duplicated: Number(duplicated[0]?.count ?? 0) }).toEqual({ label, duplicated: 0 });
  }

  /** Run one real settlement and check the single Turn_Step it ran. */
  async function settle(label: string): Promise<StepRecord> {
    const since = new Date();
    const concurrency = currentConcurrency();
    const sampler = startConnectionSampler();
    const started = performance.now();
    let peakConnections: number;
    try {
      await executeSettlement();
    } finally {
      peakConnections = await sampler.stop();
    }
    const settlementMs = Math.round(performance.now() - started);
    const turns = await prisma.automatonTurn.findMany({
      where: { profileId: { in: profileIds }, startedAt: { gte: since } },
      select: {
        profileId: true, seasonNumber: true, trigger: true, slot: true, attempt: true, status: true, reason: true,
        actions: true, upkeepIssues: true, startedAt: true, finishedAt: true, durationMs: true,
      },
    });
    // The record is built and logged before the assertions, so a failing step still reports its timing.
    const actions = turns.map((t) => (t.actions as unknown as TurnActionRecord[]).filter((a) => !a.replayed));
    const first = turns.length > 0 ? Math.min(...turns.map((t) => t.startedAt.getTime())) : 0;
    const last = turns.length > 0 ? Math.max(...turns.map((t) => (t.finishedAt ?? t.startedAt).getTime())) : 0;
    const processed = turns.filter((t) => t.status !== 'skipped').length;
    const record: StepRecord = {
      label,
      seasonNumber: turns[0]?.seasonNumber ?? 0,
      trigger: turns[0]?.trigger ?? 'none',
      slot: turns[0]?.slot ?? -1,
      turns: turns.length,
      profiles: new Set(turns.map((t) => t.profileId)).size,
      processed,
      budgetSkipped: turns.filter((t) => t.reason === STEP_BUDGET_EXHAUSTED).length,
      stepMs: last - first,
      msPerAutomaton: Math.round((last - first) / Math.max(processed, 1)),
      settlementMs,
      chargedActions: actions.reduce((sum, list) => sum + list.length, 0),
      robotsBought: actions.reduce((sum, list) => sum + list.filter((a) => a.kind === 'robot_creation').length, 0),
      maxTurnMs: Math.max(0, ...turns.map((t) => t.durationMs ?? 0)),
      concurrency,
      turnBudgetStops: turns.filter((t) => t.reason === TURN_BUDGET_EXHAUSTED).length,
      peakConnections,
    };
    steps.push(record);
    logger.info(
      `[automaton-heavy] ${label}: season=${record.seasonNumber} trigger=${record.trigger} slot=${record.slot} `
      + `turns=${record.turns} stepMs=${record.stepMs} processed=${record.processed} budgetSkipped=${record.budgetSkipped} `
      + `msPerAutomaton=${record.msPerAutomaton} maxTurnMs=${record.maxTurnMs} settlementMs=${settlementMs} `
      + `chargedActions=${record.chargedActions} robotsBought=${record.robotsBought} `
      + `concurrency=${record.concurrency} turnBudgetStops=${record.turnBudgetStops} peakConnections=${record.peakConnections}`,
    );

    const groups = new Set(turns.map((t) => `${t.seasonNumber}/${t.trigger}/${t.slot}`));
    expect({ label, steps: groups.size }).toEqual({ label, steps: 1 });
    const failures = turns
      .filter((t) => t.status === 'failed' || t.status === 'skipped' || t.attempt !== 1 || t.reason === STEP_BUDGET_EXHAUSTED)
      .map((t) => `${t.profileId}:${t.status}:${t.reason ?? ''}:a${t.attempt}`);
    expect({ label, failures }).toEqual({ label, failures: [] });
    const upkeepIssues = turns.filter((t) => Array.isArray(t.upkeepIssues) && t.upkeepIssues.length > 0).map((t) => t.profileId);
    expect({ label, upkeepIssues }).toEqual({ label, upkeepIssues: [] });
    expect({ label, turns: record.turns, profiles: record.profiles })
      .toEqual({ label, turns: POPULATION.length, profiles: POPULATION.length });
    for (const list of actions) expect(list.length).toBeLessThanOrEqual(TURN_ACTION_LIMIT);
    // Deadline rule (supersedes R7.10): the scheduler is off in tests, so the cap is the deadline.
    expect(record.stepMs).toBeLessThanOrEqual(getConfig().automatonTurnStepMaxMs);
    await assertEndOfSettlement(label);
    return record;
  }

  /** Bulk-insert a full season of battles, then time `GET /strategies/comparison` (R11.14). */
  async function measureComparison(label: string, seed: number): Promise<void> {
    const humanRobotIds = (await prisma.robot.findMany({ where: { userId: { in: humanUserIds } }, select: { id: true } })).map((r) => r.id);
    const bulk = await insertSeasonOfBattles(await automatonRobotIds(), humanRobotIds, seed);
    lastBulk = bulk;
    await prisma.$executeRawUnsafe('ANALYZE "battles"');
    await prisma.$executeRawUnsafe('ANALYZE "battle_participants"');
    clearStrategyComparisonCache();
    const started = performance.now();
    const response = await harness.api('get', '/strategies/comparison');
    const ms = Math.round(performance.now() - started);
    expect(response.status).toBe(200);
    const body = response.body as StrategyComparison;
    const strategyRows = body.rows.filter((row) => !row.reference);
    expect(strategyRows.map((row) => row.strategyKey).sort()).toEqual([...HEAVY_STRATEGY_KEYS].sort());
    // At least this run's stables (another heavy suite may have left its own on the shared heavy database).
    expect(strategyRows.reduce((sum, row) => sum + row.stables, 0)).toBeGreaterThanOrEqual(POPULATION.length);
    expect(body.rows.some((row) => row.reference && row.stables >= HUMAN_STABLES)).toBe(true);
    // Every strategy row carries its per-mode block (the comparison no longer reads battles).
    for (const row of strategyRows) expect(row.modes).toHaveLength(6);
    comparisons.push({ label, ms, bulk });
    logger.info(
      `[automaton-heavy] ${label}: comparison ${ms} ms over ${bulk.battles} battles / ${bulk.participants} participants `
      + `(bulk insert ${bulk.durationMs} ms; ${ACC_DAILY_BATTLES}/day × ${FULL_SEASON_CYCLES} cycles)`,
    );
    expect(ms).toBeLessThanOrEqual(COMPARISON_BUDGET_MS);
  }

  beforeAll(async () => {
    previousSender = setAlertSender(async (message) => { alerts.push(message); });
    // The server registers the subscribable events at boot (src/index.ts); this process does not boot it.
    for (const type of SUBSCRIBABLE_EVENT_TYPES) if (!isRegisteredEvent(type)) registerSubscribableEvent({ type, label: type });
    previousEnv = { season: process.env.SEASON_LENGTH_CYCLES, preparation: process.env.PREPARATION_LENGTH_CYCLES };
    process.env.SEASON_LENGTH_CYCLES = String(SEASON_LENGTH);
    process.env.PREPARATION_LENGTH_CYCLES = String(PREPARATION_LENGTH);

    // Every repository Catalogue_Entry is validated and synced; the population covers every strategy and Build_Focus.
    const strategies = getStrategyRegistry();
    const entries = POPULATION;
    catalogueKeys.push(...entries.map((e) => e.catalogueKey));
    repositoryKeys.push(...REPOSITORY.map((e) => e.catalogueKey));
    expect(STARTER_CATALOGUE_KEYS.filter((key) => !catalogueKeys.includes(key))).toEqual([]);
    expect(new Set(entries.map((e) => e.strategy.key))).toEqual(new Set(HEAVY_STRATEGY_KEYS));
    expect(new Set(entries.flatMap((e) => e.blueprints.map((b) => b.buildFocus)))).toEqual(new Set(BUILD_FOCUS_KEYS));
    const context = { weapons: await loadWeaponCatalogue(), strategies };
    const invalid = REPOSITORY
      .map((entry) => ({ key: entry.catalogueKey, result: validateCatalogueEntry(entry, context) }))
      .filter((v) => !v.result.ok)
      .map((v) => v.key);
    expect(invalid).toEqual([]);

    // A dedicated database; clear leftovers of an aborted run, then start season 1 in preparation.
    await deletePopulation(repositoryKeys);
    const leftoverHumans = await prisma.user.findMany({ where: { username: { startsWith: 't55hv_' } }, select: { id: true } });
    await deleteStables(leftoverHumans.map((u) => u.id));
    await resetSeasonTables();
    await prisma.season.create({ data: { seasonNumber: 1, phase: 'preparation', startedAt: new Date() } });
    invalidateSeasonCache();
    await prisma.automatonProgramSetting.upsert({
      where: { id: 1 }, update: { turnsEnabled: true, turnStepLeaseUntil: null }, create: { id: 1 },
    });
    firstUserId = ((await prisma.user.findFirst({ orderBy: { id: 'desc' }, select: { id: true } }))?.id ?? 0) + 1;
    harness = await startAdminApi(`hv${tag}`);

    const sync = await syncCatalogue({ catalogueDirectory: CATALOGUE_DIRECTORY, alertConflicts: async () => undefined });
    if (!sync.ok) throw new Error(`Catalogue_Sync failed: ${sync.problems.join('; ')}`);
    expect(sync.summary.conflicts).toEqual([]);
    expect(sync.summary.added).toHaveLength(REPOSITORY.length);
    for (const key of catalogueKeys) automatonUserIds.push((await activateProfile(key)).result.userId);
    profileIds.push(...(await prisma.automatonProfile.findMany({ where: { catalogueKey: { in: catalogueKeys } }, select: { id: true } })).map((p) => p.id));
    expect(profileIds).toHaveLength(POPULATION.length);
    // Every population entry active; the rest of the catalogue stays draft.
    expect(await prisma.automatonProfile.count({ where: { catalogueKey: { in: catalogueKeys }, status: 'active' } })).toBe(POPULATION.length);

    for (let i = 0; i < HUMAN_STABLES; i += 1) {
      const user = await prisma.user.create({ data: { username: `t55hv_h${i}_${tag}`, passwordHash: 'unused', stableName: `Hv Human ${i} ${tag}`.slice(0, 30) } });
      humanUserIds.push(user.id);
    }
    await seedHumanRobots('s1');
  }, PHASE_TIMEOUT_MS);

  afterAll(async () => {
    setAlertSender(previousSender);
    if (previousEnv.season === undefined) delete process.env.SEASON_LENGTH_CYCLES;
    else process.env.SEASON_LENGTH_CYCLES = previousEnv.season;
    if (previousEnv.preparation === undefined) delete process.env.PREPARATION_LENGTH_CYCLES;
    else process.env.PREPARATION_LENGTH_CYCLES = previousEnv.preparation;
    // Durations for the implementation record.
    logger.info(`[automaton-heavy] population: ${POPULATION.length} active (${POPULATION_MODE}) of ${REPOSITORY.length} synced Catalogue_Entries`);
    logger.info(
      `[automaton-heavy] concurrency: effective=${currentConcurrency()} configured=${getConfig().automatonTurnConcurrency} `
      + `dbPoolMax=${resolveDbPoolMax()} stepMaxMs=${getConfig().automatonTurnStepMaxMs}`,
    );
    logger.info(`[automaton-heavy] steps: ${JSON.stringify(steps)}`);
    interface TriggerRow {
      steps: number; stepMs: number; processed: number; budgetSkipped: number; secondsPerAutomaton: number;
      concurrency: number; turnBudgetStops: number; peakConnections: number;
    }
    const perTrigger: Record<string, TriggerRow> = {};
    for (const step of steps) {
      const row = perTrigger[step.trigger] ?? {
        steps: 0, stepMs: 0, processed: 0, budgetSkipped: 0, secondsPerAutomaton: 0, concurrency: step.concurrency, turnBudgetStops: 0, peakConnections: 0,
      };
      row.steps += 1;
      row.stepMs += step.stepMs;
      row.processed += step.processed;
      row.budgetSkipped += step.budgetSkipped;
      row.turnBudgetStops += step.turnBudgetStops;
      row.peakConnections = Math.max(row.peakConnections, step.peakConnections);
      row.secondsPerAutomaton = Math.round((row.stepMs / Math.max(row.processed, 1)) * 1000) / 1_000_000;
      perTrigger[step.trigger] = row;
    }
    logger.info(`[automaton-heavy] per-trigger: ${JSON.stringify(perTrigger)}`);
    logger.info(`[automaton-heavy] comparisons: ${JSON.stringify(comparisons.map((c) => ({ label: c.label, ms: c.ms, battles: c.bulk.battles, participants: c.bulk.participants })))}`);
    logger.info(`[automaton-heavy] alerts raised: ${alerts.length}`);

    const bulk = lastBulk;
    if (bulk) await prisma.battle.deleteMany({ where: { id: { gte: bulk.firstBattleId, lte: bulk.lastBattleId } } });
    await deletePopulation(repositoryKeys);
    // Generated stables created by the settlements of this run (Step 7 user generation).
    const generatedUsers = await prisma.user.findMany({ where: { id: { gte: firstUserId }, isGenerated: true }, select: { id: true } });
    await deleteStables([...humanUserIds, ...generatedUsers.map((u) => u.id)]);
    if (harness) await harness.close();
    await resetSeasonTables();
    await prisma.$disconnect();
  }, PHASE_TIMEOUT_MS);

  it('season 1: preparation opening builds, competitive settlements and the comparison at ACC volume', async () => {
    const prep1 = await settle('s1 prep 1');
    expect(prep1).toMatchObject({ seasonNumber: 1, trigger: 'preparation', slot: 1 });
    // The first preparation turn builds every stable's opening roster from ₡3,000,000.
    expect(prep1.robotsBought).toBeGreaterThanOrEqual(POPULATION.length);
    for (const userId of automatonUserIds) expect(await prisma.robot.count({ where: { userId } })).toBeGreaterThan(0);
    expect(await settle('s1 prep 2')).toMatchObject({ seasonNumber: 1, trigger: 'preparation', slot: 2 });
    expect((await prisma.season.findUniqueOrThrow({ where: { seasonNumber: 1 } })).phase).toBe('competitive');
    for (let cycle = 1; cycle < SEASON_LENGTH; cycle += 1) {
      expect(await settle(`s1 cycle ${cycle}`)).toMatchObject({ seasonNumber: 1, trigger: 'settlement' });
    }
    await measureComparison('s1 end', 551);
  }, PHASE_TIMEOUT_MS);

  it('rollover: the boundary settlement rolls over and Stage 5 rebuilds every Automaton in season 2', async () => {
    rolloverAt = new Date();
    const opening = await settle('s1 boundary → s2 season_open');
    expect(opening).toMatchObject({ seasonNumber: 2, trigger: 'season_open', slot: 0 });
    expect((await prisma.season.findUniqueOrThrow({ where: { seasonNumber: 2 } })).phase).toBe('preparation');
    expect((await prisma.season.findUniqueOrThrow({ where: { seasonNumber: 1 } })).phase).toBe('completed');
    // The rollover truncated the bulk battles of season 1.
    lastBulk = null;
    expect(await prisma.battle.count()).toBe(0);
    // R14.4: Automaton users survive the rollover.
    expect(await prisma.user.count({ where: { id: { in: automatonUserIds }, stableType: 'automaton' } })).toBe(POPULATION.length);
  }, PHASE_TIMEOUT_MS);

  it('season 2: every stable rebuilt in the Preparation_Phase, competitive settlements and the comparison at ACC volume', async () => {
    // Humans were reset by the rollover; they rebuild too, so the reference row exists.
    await seedHumanRobots('s2');
    expect(await settle('s2 prep 1')).toMatchObject({ seasonNumber: 2, trigger: 'preparation', slot: 1 });
    expect(await settle('s2 prep 2')).toMatchObject({ seasonNumber: 2, trigger: 'preparation', slot: 2 });

    // R14.4: every Automaton_Stable rebuilt at least one robot in season 2's Preparation_Phase.
    const preparationTurns = await prisma.automatonTurn.findMany({
      where: { profileId: { in: profileIds }, seasonNumber: 2, trigger: { in: ['season_open', 'preparation'] } },
      select: { profileId: true, actions: true },
    });
    const rebuilt = new Set(
      preparationTurns
        .filter((t) => (t.actions as unknown as TurnActionRecord[]).some((a) => a.kind === 'robot_creation' && !a.replayed))
        .map((t) => t.profileId),
    );
    expect(rebuilt.size).toBe(POPULATION.length);
    for (const userId of automatonUserIds) {
      expect(await prisma.robot.count({ where: { userId, createdAt: { gte: rolloverAt } } })).toBeGreaterThan(0);
    }

    for (let cycle = 1; cycle < SEASON_LENGTH; cycle += 1) {
      expect(await settle(`s2 cycle ${cycle}`)).toMatchObject({ seasonNumber: 2, trigger: 'settlement' });
    }
    await measureComparison('s2 end', 552);
    expect(steps.every((s) => s.stepMs <= getConfig().automatonTurnStepMaxMs)).toBe(true);
  }, PHASE_TIMEOUT_MS);
});
