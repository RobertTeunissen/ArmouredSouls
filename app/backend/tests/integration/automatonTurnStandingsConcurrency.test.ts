/**
 * Parallel Automaton_Turns × unified standings placement, against the real
 * database (docs/implementation_notes/AUTOMATON_TURN_STEP_DEADLINE.md
 * "Bounded concurrency"; docs/implementation_notes/STANDINGS_CREATION_RULE.md).
 *
 * Six freshly activated stables (three Duo with two blueprints, three Trio
 * with three) run their opening builds in one Turn_Step at concurrency 3.
 * Every stable registers its teams and subscribes its robots and teams in
 * that step, so the turns contend on the per-mode Bronze placement locks
 * while they hold the audit-sequence lock `(3, cycle)`, the team locks
 * `(5, teamId)` and the robot locks `(2, robotId)`. A separate connection
 * holds all six Bronze placement locks for most of the step (in canonical
 * mode order, like every other caller), so placements really queue.
 *
 * Asserts:
 * - no deadlock or timeout: every turn completes and no Free_Upkeep part
 *   failed (upkeep errors are recorded as issues, not as failed turns);
 * - placements really waited on the mode locks;
 * - exactly one standings row per (entity, mode) for every entity that is
 *   matchable now (robot subscribed; team complete, every member
 *   subscribed), and no row for an entity that never was (rows survive
 *   unsubscribe), all in Bronze with 0 LP;
 * - no orphan rows (a row whose robot or team does not exist) and no Bronze
 *   instance above its capacity;
 * - every stable is served, a retried step finds every Turn_Record final and
 *   writes nothing, and the next slot's step keeps the invariants.
 *
 * Every Turn_Step is scoped to this file's stables (`cohortFilter`).
 */
import { Client } from 'pg';
import prisma from '../../src/lib/prisma';
import { getConfig } from '../../src/config/env';
import { runTurnStep, type TurnStepDependencies, type TurnStepInput, type TurnStepSummary } from '../../src/services/automaton/automatonTurnService';
import { setAlertSender } from '../../src/services/automaton/automatonObservability';
import { getProgramSwitch, setProgramSwitch } from '../../src/services/automaton/programSwitch';
import { activateProfile, addBlueprint, createDraft } from '../../src/services/automaton/automatonProfileService';
import { requiredTeamNameCountsFor } from '../../src/services/automaton/automatonCatalogueService';
import { getStrategyRegistry } from '../../src/services/automaton/strategies/defaultRegistry';
import { SUBSCRIBABLE_EVENT_TYPES, isRegisteredEvent, registerSubscribableEvent } from '../../src/services/subscription/eventRegistry';
import { STANDING_BACKED_EVENTS, isTeamMatchable } from '../../src/services/standings/standingPlacement';
import { MAX_ENTITIES_PER_INSTANCE, leagueInstanceLockKey } from '../../src/services/league/leagueInstancePlacement';
import { deleteAutomatonStables } from '../helpers/automatonStable';
import type { TeamNames } from '../../src/types/automaton';

jest.setTimeout(240_000);

const run = `${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 900 + 100)}`;
const KEY_PREFIX = `tsc-${run}`;
const SEASON = 7_000 + Math.floor(Math.random() * 900);
const CONCURRENCY = 3;

/** How long the blocker holds the Bronze placement locks, and the gap between holds. */
const HOLD_MS = 250;
const GAP_MS = 25;
const SAMPLE_MS = 20;

/** Team events first, so whole teams take the Booking Office slots before solo events. */
const EVENT_ORDER = ['league_2v2', 'league_3v3', 'tag_team', 'league_1v1', 'koth', 'grand_melee', 'tournament_1v1', 'tournament_2v2', 'tournament_3v3'];

const ROBOT_MODES = STANDING_BACKED_EVENTS.filter((d) => d.entityType === 'robot').map((d) => d.event);
const TEAM_MODES = STANDING_BACKED_EVENTS.filter((d) => d.entityType === 'team');

const BLUEPRINTS = [
  { robotName: 'Sc Blade', loadoutType: 'single' as const, stance: 'offensive' as const, yieldThreshold: 10, buildFocus: 'versatile' as const, weaponPath: [{ main: 'Laser Pistol' }, { main: 'Volt Sabre' }] },
  { robotName: 'Sc Hammer', loadoutType: 'two_handed' as const, stance: 'balanced' as const, yieldThreshold: 15, buildFocus: 'bruiser' as const, weaponPath: [{ main: 'Shock Maul' }, { main: 'Heavy Hammer' }] },
  { robotName: 'Sc Lance', loadoutType: 'single' as const, stance: 'defensive' as const, yieldThreshold: 20, buildFocus: 'versatile' as const, weaponPath: [{ main: 'Laser Pistol' }, { main: 'Volt Sabre' }] },
].map((b) => ({ ...b, refinementPlan: [{ tier: 'sharpen' as const, hand: 'main' as const, magnitude: 1 }] }));

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

function teamNamesFor(strategyKey: string, index: number, blueprintCount: number): TeamNames {
  const strategy = getStrategyRegistry().getStrategy(strategyKey, 1);
  if (!strategy) throw new Error(`no ${strategyKey}.v1`);
  const required = requiredTeamNameCountsFor(strategy, blueprintCount);
  return {
    twoVsTwo: Array.from({ length: required.twoVsTwo }, (_, i) => `${KEY_PREFIX} Pair ${index} ${i + 1}`),
    threeVsThree: Array.from({ length: required.threeVsThree }, (_, i) => `${KEY_PREFIX} Trio ${index} ${i + 1}`),
  };
}

/** Draft with `blueprintCount` blueprints, then activate. */
async function activeStable(index: number, strategyKey: string, blueprintCount: number): Promise<Stable> {
  const catalogueKey = `${KEY_PREFIX}-${index}`;
  await createDraft({
    catalogueKey,
    stableName: `Sc ${run} ${index}`,
    franchise: 'Test',
    backstory: 'Turn and standings concurrency test stable.',
    strategyKey,
    eventOrder: EVENT_ORDER,
  });
  for (let slot = 0; slot < blueprintCount; slot++) {
    const blueprint = BLUEPRINTS[slot];
    // Each add validates the Team_Names count for the new blueprint count.
    await addBlueprint(catalogueKey, {
      ...blueprint,
      robotName: `${blueprint.robotName} ${run} ${index}`,
      teamNames: teamNamesFor(strategyKey, index, slot + 1),
    });
  }
  const { result } = await activateProfile(catalogueKey);
  const profile = await prisma.automatonProfile.findUniqueOrThrow({ where: { catalogueKey }, select: { id: true } });
  const stable = { catalogueKey, profileId: profile.id, userId: result.userId };
  created.push(stable);
  return stable;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Holds every Bronze placement lock (canonical mode order) for HOLD_MS, then
 * releases for GAP_MS, until stopped. Samples, on its own connection, the most
 * waiters seen at once on placement locks (one-key advisory locks) and on
 * two-key advisory locks such as `(3, cycle)`, and the most busy connections
 * of this database (both own connections excluded).
 */
interface ContentionMeasurement {
  maxPlacementWaiters: number;
  maxKeyedWaiters: number;
  maxBusyConnections: number;
}

async function startContention(): Promise<{ stop: () => Promise<ContentionMeasurement> }> {
  const { databaseUrl } = getConfig();
  const holder = new Client({ connectionString: databaseUrl });
  const sampler = new Client({ connectionString: databaseUrl });
  await holder.connect();
  await sampler.connect();
  const ownPids = [
    (await holder.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0].pid,
    (await sampler.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0].pid,
  ];
  const lockKeys = STANDING_BACKED_EVENTS.map((d) => leagueInstanceLockKey(d.event, 'bronze'));
  let stopped = false;
  let maxPlacementWaiters = 0;
  let maxKeyedWaiters = 0;
  let maxBusyConnections = 0;

  const holding = (async (): Promise<void> => {
    while (!stopped) {
      await holder.query('BEGIN');
      for (const key of lockKeys) await holder.query('SELECT pg_advisory_xact_lock($1::bigint)', [key]);
      await sleep(HOLD_MS);
      await holder.query('COMMIT');
      await sleep(GAP_MS);
    }
  })();

  const sampling = (async (): Promise<void> => {
    while (!stopped) {
      const { rows } = await sampler.query<{ waiters: number; keyed: number; busy: number }>(
        `SELECT
           (SELECT count(*)::int FROM pg_locks l
              WHERE l.locktype = 'advisory' AND NOT l.granted AND l.objsubid = 1
                AND l.database = (SELECT oid FROM pg_database WHERE datname = current_database())) AS waiters,
           (SELECT count(*)::int FROM pg_locks l
              WHERE l.locktype = 'advisory' AND NOT l.granted AND l.objsubid = 2
                AND l.database = (SELECT oid FROM pg_database WHERE datname = current_database())) AS keyed,
           (SELECT count(*)::int FROM pg_stat_activity
              WHERE datname = current_database() AND state IN ('active', 'idle in transaction')
                AND pid <> ALL($1::int[])) AS busy`,
        [ownPids],
      );
      maxPlacementWaiters = Math.max(maxPlacementWaiters, rows[0].waiters);
      maxKeyedWaiters = Math.max(maxKeyedWaiters, rows[0].keyed);
      maxBusyConnections = Math.max(maxBusyConnections, rows[0].busy);
      await sleep(SAMPLE_MS);
    }
  })();

  return {
    stop: async () => {
      stopped = true;
      await Promise.all([holding, sampling]);
      await holder.end();
      await sampler.end();
      return { maxPlacementWaiters, maxKeyedWaiters, maxBusyConnections };
    },
  };
}

/** Standings rows anywhere in the database whose robot or team no longer exists. */
async function orphanRowCount(): Promise<number> {
  const rows = await prisma.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n FROM standings s
    WHERE (s.entity_type = 'robot' AND NOT EXISTS (SELECT 1 FROM robots r WHERE r.id = s.entity_id))
       OR (s.entity_type = 'team' AND NOT EXISTS (SELECT 1 FROM team_battles t WHERE t.id = s.entity_id))`;
  return rows[0].n;
}

/** Row exists ⇔ entity matchable, one row per (entity, mode), Bronze/0 LP, instances within capacity. */
async function expectStandingsInvariants(userIds: number[], label: string): Promise<{ robotRows: number; teamRows: number }> {
  const robots = await prisma.robot.findMany({
    where: { userId: { in: userIds } },
    select: { id: true, subscriptions: { select: { eventType: true } } },
  });
  const teams = await prisma.teamBattle.findMany({
    where: { stableId: { in: userIds } },
    select: { id: true, teamSize: true, members: { select: { robotId: true } } },
  });
  const robotIds = robots.map((r) => r.id);
  const teamIds = teams.map((t) => t.id);
  const rows = await prisma.standing.findMany({
    where: {
      OR: [
        { entityType: 'robot', entityId: { in: robotIds } },
        { entityType: 'team', entityId: { in: teamIds } },
      ],
    },
  });

  // Exactly one row per (entity, mode).
  const keys = rows.map((r) => `${r.entityType}:${r.entityId}:${r.mode}`);
  expect({ label, duplicates: keys.length - new Set(keys).size }).toEqual({ label, duplicates: 0 });

  const has = new Set(keys);
  const subscribedTo = new Map(robots.map((r) => [r.id, new Set(r.subscriptions.map((s) => s.eventType))]));
  // Rows survive unsubscribe: Event_Allocation can drop a solo event once a
  // team forms in the same turn. "Ever subscribed" comes from the audit log.
  const everSubscribedTo = new Map<number, Set<string>>(robots.map((r) => [r.id, new Set<string>()]));
  const subscriptionAudits = await prisma.auditLog.findMany({
    where: { eventType: 'subscription_create', robotId: { in: robotIds } },
    select: { robotId: true, payload: true },
  });
  for (const audit of subscriptionAudits) {
    const event = (audit.payload as unknown as { eventType?: string }).eventType;
    if (audit.robotId !== null && event) everSubscribedTo.get(audit.robotId)?.add(event);
  }

  // Matchable now ⇒ row; row ⇒ matchable at some point (every member subscribed once).
  const required = new Set<string>();
  const allowed = new Set<string>();
  for (const robot of robots) {
    for (const mode of ROBOT_MODES) {
      if (subscribedTo.get(robot.id)?.has(mode)) required.add(`robot:${robot.id}:${mode}`);
      if (everSubscribedTo.get(robot.id)?.has(mode)) allowed.add(`robot:${robot.id}:${mode}`);
    }
  }
  for (const team of teams) {
    const memberIds = team.members.map((m) => m.robotId);
    for (const definition of TEAM_MODES) {
      if (definition.teamSize !== team.teamSize) continue;
      const key = `team:${team.id}:${definition.event}`;
      const subscribed = new Set(memberIds.filter((id) => subscribedTo.get(id)?.has(definition.event)));
      if (isTeamMatchable(team.teamSize, memberIds, subscribed)) required.add(key);
      const everSubscribed = new Set(memberIds.filter((id) => everSubscribedTo.get(id)?.has(definition.event)));
      if (isTeamMatchable(team.teamSize, memberIds, everSubscribed)) allowed.add(key);
    }
  }
  expect({ label, missing: [...required].filter((key) => !has.has(key)).sort() }).toEqual({ label, missing: [] });
  expect({ label, unexpected: [...has].filter((key) => !allowed.has(key)).sort() }).toEqual({ label, unexpected: [] });
  expect({ label, required: required.size }).not.toEqual({ label, required: 0 });

  for (const row of rows) {
    expect({ label, key: `${row.entityType}:${row.entityId}:${row.mode}`, tier: row.tier, lp: row.leaguePoints, bronze: /^bronze_\d+$/.test(row.leagueInstanceId) })
      .toEqual({ label, key: `${row.entityType}:${row.entityId}:${row.mode}`, tier: 'bronze', lp: 0, bronze: true });
  }

  // No Bronze instance above capacity in any standing-backed mode (whole database).
  const groups = await prisma.standing.groupBy({
    by: ['mode', 'leagueInstanceId'],
    where: { tier: 'bronze', mode: { in: STANDING_BACKED_EVENTS.map((d) => d.event) } },
    _count: { id: true },
  });
  const overfull = groups.filter((g) => g._count.id > MAX_ENTITIES_PER_INSTANCE);
  expect({ label, overfull }).toEqual({ label, overfull: [] });

  return {
    robotRows: rows.filter((r) => r.entityType === 'robot').length,
    teamRows: rows.filter((r) => r.entityType === 'team').length,
  };
}

async function expectAllServed(summary: TurnStepSummary, stables: Stable[], slot: number, label: string): Promise<void> {
  expect({ label, summary }).toMatchObject({
    label,
    summary: { processed: stables.length, completed: stables.length, failed: 0, skipped: {}, alreadyFinal: 0, concurrency: CONCURRENCY, leaseLost: false },
  });
  const turns = await prisma.automatonTurn.findMany({
    where: { profileId: { in: stables.map((s) => s.profileId) }, seasonNumber: SEASON, trigger: 'preparation', slot },
  });
  expect(turns).toHaveLength(stables.length);
  for (const turn of turns) {
    // Deadlocks and transaction timeouts in teams or subscriptions would surface here.
    expect({ label, profileId: turn.profileId, status: turn.status, upkeepIssues: turn.upkeepIssues })
      .toEqual({ label, profileId: turn.profileId, status: 'completed', upkeepIssues: [] });
  }
}

beforeAll(async () => {
  previousSender = setAlertSender(async (message) => { alerts.push(message); });
  for (const type of SUBSCRIBABLE_EVENT_TYPES) if (!isRegisteredEvent(type)) registerSubscribableEvent({ type, label: type });
  programBefore = (await getProgramSwitch()).turnsEnabled;
  const admin = await prisma.user.create({ data: { username: `tsc_admin_${run}`, passwordHash: 'unused', role: 'admin' } });
  adminId = admin.id;
  await setProgramSwitch(true, adminId);
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

describe('parallel turns that register teams and subscribe in the same step', () => {
  it('place exactly one standings row per matchable entity and mode, without deadlock, orphans or unserved stables', async () => {
    const stables = [
      await activeStable(1, 'duo', 2),
      await activeStable(2, 'trio', 3),
      await activeStable(3, 'duo', 2),
      await activeStable(4, 'trio', 3),
      await activeStable(5, 'duo', 2),
      await activeStable(6, 'trio', 3),
    ];
    const userIds = stables.map((s) => s.userId);
    const ids = new Set(stables.map((s) => s.profileId));
    const deps: TurnStepDependencies = { cohortFilter: (profile) => ids.has(profile.profileId), concurrency: CONCURRENCY, leasePollMs: 50 };
    const opening: TurnStepInput = { trigger: 'preparation', seasonNumber: SEASON, slot: 1, source: 'scheduler' };
    const orphansBefore = await orphanRowCount();

    // Opening builds under placement-lock contention.
    const contention = await startContention();
    let summary: TurnStepSummary;
    try {
      summary = await runTurnStep(opening, deps);
    } finally {
      const measured = await contention.stop();
      // Recorded for the verification report; asserted below.
      console.info(`[turn-standings-concurrency] opening: maxPlacementWaiters=${measured.maxPlacementWaiters} maxKeyedWaiters=${measured.maxKeyedWaiters} maxBusyConnections=${measured.maxBusyConnections}`);
      expect(measured.maxPlacementWaiters).toBeGreaterThan(0);
    }
    await expectAllServed(summary, stables, 1, 'opening');

    // Turns of different stables overlapped.
    const turns = await prisma.automatonTurn.findMany({ where: { profileId: { in: [...ids] }, seasonNumber: SEASON, slot: 1 } });
    const intervals = turns.map((t) => [t.startedAt.getTime(), (t.finishedAt as Date).getTime()] as const);
    expect(intervals.some(([a0, a1], a) => intervals.some(([b0, b1], b) => a !== b && a0 < b1 && b0 < a1))).toBe(true);
    console.info(`[turn-standings-concurrency] opening: durationMs=${summary.durationMs} maxTurnMs=${Math.max(...turns.map((t) => t.durationMs ?? 0))}`);

    // Every stable registered its teams: Duo one 2v2 team, Trio one 2v2 and one 3v3 team.
    for (const [index, stable] of stables.entries()) {
      const sizes = (await prisma.teamBattle.findMany({ where: { stableId: stable.userId }, select: { teamSize: true } }))
        .map((t) => t.teamSize).sort();
      expect({ stable: stable.catalogueKey, sizes }).toEqual({ stable: stable.catalogueKey, sizes: index % 2 === 0 ? [2] : [2, 3] });
    }

    const counts = await expectStandingsInvariants(userIds, 'opening');
    // Team-first Event_Order: every team got at least one team-mode row, and solo rows exist too.
    expect(counts.teamRows).toBeGreaterThanOrEqual(9);
    expect(counts.robotRows).toBeGreaterThan(0);
    expect(await orphanRowCount()).toBe(orphansBefore);

    // A retried step: every record final, nothing placed, charged or audited again.
    const standingsBefore = await prisma.standing.count();
    const auditBefore = await prisma.auditLog.count({ where: { userId: { in: userIds } } });
    const retry = await runTurnStep(opening, deps);
    expect(retry).toMatchObject({ processed: stables.length, alreadyFinal: stables.length, completed: 0, failed: 0, skipped: {} });
    expect(await prisma.standing.count()).toBe(standingsBefore);
    expect(await prisma.auditLog.count({ where: { userId: { in: userIds } } })).toBe(auditBefore);

    // The next slot: upgrades raise the Booking cap, so more placements under contention.
    const next: TurnStepInput = { ...opening, slot: 2 };
    const contention2 = await startContention();
    let summary2: TurnStepSummary;
    try {
      summary2 = await runTurnStep(next, deps);
    } finally {
      const measured = await contention2.stop();
      console.info(`[turn-standings-concurrency] next: maxPlacementWaiters=${measured.maxPlacementWaiters} maxKeyedWaiters=${measured.maxKeyedWaiters} maxBusyConnections=${measured.maxBusyConnections}`);
    }
    await expectAllServed(summary2, stables, 2, 'next');
    await expectStandingsInvariants(userIds, 'next');
    expect(await orphanRowCount()).toBe(orphansBefore);

    expect(alerts.filter((message) => created.some((s) => message.includes(s.catalogueKey)))).toEqual([]);
  });
});
