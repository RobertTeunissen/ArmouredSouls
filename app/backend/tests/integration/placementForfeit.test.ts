/**
 * T12 / T13 / all-unarmed / T8-R6 — battle-time forfeits in the placement modes
 * (design §5.6-5.8, rule 4, R6). Real database.
 *
 * - T12: one robot in the field has no main weapon. It takes last place with
 *   `forfeited`, earns nothing (no credits, LP, ledger, streaming, prestige or
 *   fame), its HP is untouched (`finalHP` = its stored `currentHP`, never the
 *   prepared full HP) and its `totalMatches` still moves; the rest fight.
 * - T13: the ready field is below the minimum. One forfeit-only battle holds
 *   the forfeiter, every ready robot gets a tier-scaled bye, the original match
 *   is `completed`. A crash in the bye step is recovered by the next run, which
 *   pays each bye exactly once at the match tier; a concurrent second resolution
 *   writes nothing. A plain KotH bye on a gold match pays the gold amount (R6).
 * - All unarmed: a forfeit-only battle, zero byes, the match is `completed`.
 * - T8-R6: dual_wield without an offhand fights as single; the stored loadout
 *   is unchanged.
 *
 * Each case cancels other suites' queued rows of its mode first (isolation).
 */
import prisma from '../../src/lib/prisma';
import logger from '../../src/config/logger';
import type { MatchType, StandingsMode } from '../../generated/prisma';
import * as kothGameMode from '../../src/services/arena/koth/kothGameMode';
import * as simulationLoop from '../../src/services/battle/combat-simulator/simulationLoop';
import * as byeResolutionService from '../../src/services/battle/byeResolutionService';
import { BYE_BATTLE_DURATION_SECONDS } from '../../src/services/battle/byeResolutionService';
import { executeScheduledKothBattles } from '../../src/services/koth/kothBattleOrchestrator';
import { executeScheduledGrandMeleeBattles } from '../../src/services/grand-melee/grandMeleeBattleOrchestrator';
import { resolveBelowMinimumField } from '../../src/services/scheduling/thinInstanceByes';
import { flushDeferredWork } from '../../src/services/common/deferredWork';
import { getParticipationReward } from '../../src/utils/economyFormulas';
import type { KothPlacement } from '../../src/types';
import { battlesForRobots, scheduledMatchesForRobots } from '../cleanupHelper';
import { useFinancialCaptureTestEnvironment } from '../financialCaptureTestHelper';
import { enterRobotStandings } from '../helpers/standings';

useFinancialCaptureTestEnvironment();

const RUN = `plf${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const FORFEITER_HP = 60;

const userIds: number[] = [];
const robotIds: number[] = [];
const scheduledIds: number[] = [];
let weaponId: number;
let counter = 0;
const next = (): number => ++counter;

// ── Fixtures ─────────────────────────────────────────────────────────

type Kind = 'ready' | 'unarmed' | 'dual_wield_no_offhand';

async function createRobot(kind: Kind): Promise<number> {
  const n = next();
  const user = await prisma.user.create({
    data: { username: `${RUN}_u${n}`, passwordHash: 'x', currency: 500_000, stableName: `${RUN}_s${n}` },
  });
  userIds.push(user.id);
  const main = kind === 'unarmed'
    ? null
    : await prisma.weaponInventory.create({ data: { userId: user.id, weaponId, pricePaid: 0 } });
  const robot = await prisma.robot.create({
    data: {
      userId: user.id,
      name: `${RUN}_r${n}`,
      elo: 1200,
      // The forfeiter starts damaged: a prepared robot would record full HP.
      currentHP: kind === 'unarmed' ? FORFEITER_HP : 100,
      maxHP: 100,
      currentShield: 20,
      maxShield: 20,
      yieldThreshold: 20,
      loadoutType: kind === 'dual_wield_no_offhand' ? 'dual_wield' : 'single',
      mainWeaponId: main?.id ?? null,
      offhandWeaponId: null,
    },
  });
  robotIds.push(robot.id);
  return robot.id;
}

interface Field {
  all: number[];
  ready: number[];
  unarmed: number[];
  other: number[];
}

/** A field in its own stables, entered in the mode's standings at `tier`. */
async function createField(
  c: PlacementCase,
  kinds: Kind[],
  tier: string,
): Promise<Field> {
  const field: Field = { all: [], ready: [], unarmed: [], other: [] };
  for (const kind of kinds) {
    const id = await createRobot(kind);
    field.all.push(id);
    if (kind === 'unarmed') field.unarmed.push(id);
    else field.ready.push(id);
    if (kind === 'dual_wield_no_offhand') field.other.push(id);
  }
  await enterRobotStandings(field.all, c.standingMode, { tier, leagueInstanceId: `${tier}_1` });
  return field;
}

function kinds(ready: number, unarmed: number): Kind[] {
  return [...Array<Kind>(ready).fill('ready'), ...Array<Kind>(unarmed).fill('unarmed')];
}

async function scheduleField(
  c: PlacementCase,
  robots: number[],
  tier: string,
  isByeMatch = false,
): Promise<number> {
  const at = new Date(Date.now() - 60_000);
  const row = await prisma.scheduledMatch.create({
    data: {
      matchType: c.matchType,
      status: 'scheduled',
      scheduledFor: at,
      createdAt: at,
      leagueType: tier,
      leagueInstanceId: `${tier}_1`,
      isByeMatch,
      // KotH matchmaking always writes the zone radius (#522).
      zoneRadius: c.matchType === 'koth' ? 7 : null,
      participants: {
        create: robots.map((participantId, i) => ({ participantType: 'robot', participantId, slot: i + 1 })),
      },
    },
  });
  scheduledIds.push(row.id);
  return row.id;
}

/** Cancel queued rows of a mode left by other suites so only this file's matches run. */
async function isolate(matchType: MatchType): Promise<void> {
  await prisma.scheduledMatch.updateMany({
    where: { matchType, status: { in: ['scheduled', 'error'] }, id: { notIn: scheduledIds } },
    data: { status: 'cancelled', cancelReason: 'placementForfeit.test isolation' },
  });
}

async function loadRobots(ids: number[]) {
  return prisma.robot.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } });
}

async function snapshot(c: PlacementCase, id: number) {
  const robot = await prisma.robot.findUniqueOrThrow({ where: { id } });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: robot.userId } });
  const standing = await prisma.standing.findUniqueOrThrow({
    where: { entityType_entityId_mode: { entityType: 'robot', entityId: id, mode: c.standingMode } },
  });
  return { robot, user, standing };
}

async function ledgerRows(robotId: number) {
  const robot = await prisma.robot.findUniqueOrThrow({ where: { id: robotId } });
  return prisma.financialLedger.findMany({ where: { userId: robot.userId } });
}

/** Battles a robot took part in, with participants, oldest first. */
async function battlesOf(robots: number[]) {
  return prisma.battle.findMany({
    where: battlesForRobots(robots),
    include: { participants: true },
    orderBy: { id: 'asc' },
  });
}

// ── Mode table ───────────────────────────────────────────────────────

interface PlacementSummary {
  successfulMatches: number;
  byeMatches: number;
  failedMatches: number;
  forfeitedRobots: number;
  belowMinimumMatches: number;
  errors: string[];
}

interface PlacementCase {
  mode: 'koth' | 'grand_melee';
  matchType: MatchType;
  standingMode: StandingsMode;
  minimum: number;
  run(): Promise<PlacementSummary>;
  /** `battles.leagueType` of the forfeit-only row for a match of `tier`. */
  forfeitLeagueType(tier: string): string;
}

const kothCase: PlacementCase = {
  mode: 'koth',
  matchType: 'koth',
  standingMode: 'koth',
  minimum: 5,
  run: () => executeScheduledKothBattles(),
  forfeitLeagueType: () => 'koth',
};

const grandMeleeCase: PlacementCase = {
  mode: 'grand_melee',
  matchType: 'grand_melee',
  standingMode: 'grand_melee',
  minimum: 8,
  run: () => executeScheduledGrandMeleeBattles(),
  // Grand Melee rows carry the tier (the fought-row convention).
  forfeitLeagueType: (tier) => tier,
};

// ── Lifecycle ────────────────────────────────────────────────────────

beforeAll(async () => {
  const weapon = await prisma.weapon.findFirst({ orderBy: { id: 'asc' } });
  if (!weapon) throw new Error('No weapons seeded');
  weaponId = weapon.id;
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  await flushDeferredWork();
  await prisma.scheduledMatch.deleteMany({ where: { OR: [{ id: { in: scheduledIds } }, scheduledMatchesForRobots(robotIds)] } });
  await prisma.battle.deleteMany({ where: battlesForRobots(robotIds) });
  await prisma.financialLedger.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.auditLog.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { robotId: { in: robotIds } }] } });
  await prisma.standing.deleteMany({ where: { entityType: 'robot', entityId: { in: robotIds } } });
  await prisma.robot.deleteMany({ where: { id: { in: robotIds } } });
  await prisma.weaponInventory.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
});

// ── Shared scenario bodies ───────────────────────────────────────────

/**
 * T12: run a full field with one unarmed, damaged robot and assert the
 * forfeiter rows. Returns the fought battle for mode-specific checks.
 */
async function expectT12(c: PlacementCase, size: number) {
  await isolate(c.matchType);
  const field = await createField(c, kinds(size - 1, 1), 'bronze');
  const forfeiter = field.unarmed[0];
  const matchId = await scheduleField(c, field.all, 'bronze');
  const before = await snapshot(c, forfeiter);

  const summary = await c.run();
  await flushDeferredWork();

  expect(summary.successfulMatches).toBe(1);
  expect(summary.forfeitedRobots).toBe(1);
  expect(summary.belowMinimumMatches).toBe(0);
  expect((await prisma.scheduledMatch.findUniqueOrThrow({ where: { id: matchId } })).status).toBe('completed');

  const battles = await battlesOf(field.all);
  expect(battles).toHaveLength(1);
  const battle = battles[0];
  expect(battle.participants).toHaveLength(size);
  const row = battle.participants.find((p) => p.robotId === forfeiter)!;
  expect(row).toMatchObject({
    placement: size,
    forfeited: true,
    credits: 0,
    streamingRevenue: 0,
    prestigeAwarded: 0,
    fameAwarded: 0,
    damageDealt: 0,
    // The stored pre-battle HP: the forfeiter was never prepared for combat.
    finalHP: FORFEITER_HP,
    destroyed: false,
  });
  const fought = battle.participants.filter((p) => p.robotId !== forfeiter);
  expect(fought.every((p) => !p.forfeited)).toBe(true);
  expect(fought.map((p) => p.placement).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual(
    Array.from({ length: size - 1 }, (_, i) => i + 1),
  );
  expect(battle.winnerId).not.toBe(forfeiter);

  const log = battle.battleLog as unknown as {
    participantCount: number;
    arenaRadius: number;
    kothData: { participantCount: number };
    placements: Array<{ robotId: number; placement: number }>;
  };
  expect(log.participantCount).toBe(size);
  expect(log.kothData.participantCount).toBe(size);
  expect(log.placements).toHaveLength(size);
  expect(log.placements[size - 1]).toMatchObject({ robotId: forfeiter, placement: size });

  const summaryRow = await prisma.battleSummary.findUnique({ where: { battleId: battle.id } });
  const placements = summaryRow?.kothPlacements as unknown as KothPlacement[];
  expect(placements.find((p) => p.robotId === forfeiter)).toMatchObject({ placement: size, forfeited: true, zoneScore: 0 });
  expect((summaryRow?.kothData as unknown as { participantCount: number }).participantCount).toBe(size);

  // Nothing paid, nothing healed or damaged; the loss is still recorded.
  const after = await snapshot(c, forfeiter);
  expect(after.robot.currentHP).toBe(FORFEITER_HP);
  expect(after.robot.fame).toBe(before.robot.fame);
  expect(after.user.currency).toBe(before.user.currency);
  expect(after.user.prestige).toBe(before.user.prestige);
  expect(await ledgerRows(forfeiter)).toHaveLength(0);
  expect(after.standing.leaguePoints).toBe(before.standing.leaguePoints);
  expect(after.standing.wins).toBe(before.standing.wins);
  expect(after.standing.totalMatches).toBe((before.standing.totalMatches ?? 0) + 1);

  const audits = await prisma.auditLog.findMany({ where: { eventType: 'battle_complete', battleId: battle.id, robotId: forfeiter } });
  expect(audits).toHaveLength(1);
  expect(audits[0].payload).toMatchObject({ result: 'loss', forfeit: true, kothPlacement: size, credits: 0 });

  return { battle, field };
}

/** T13: the ready field is below the minimum (bronze). */
async function expectT13(c: PlacementCase) {
  await isolate(c.matchType);
  const field = await createField(c, kinds(c.minimum - 1, 1), 'bronze');
  const forfeiter = field.unarmed[0];
  const matchId = await scheduleField(c, field.all, 'bronze');
  const readyBefore = await Promise.all(field.ready.map((id) => snapshot(c, id)));
  const forfeiterBefore = await snapshot(c, forfeiter);
  const simulate = jest.spyOn(simulationLoop, 'simulateBattleMulti');

  const summary = await c.run();
  await flushDeferredWork();

  expect(simulate).not.toHaveBeenCalled();
  expect(summary.belowMinimumMatches).toBe(1);
  expect(summary.forfeitedRobots).toBe(1);
  expect(summary.successfulMatches).toBe(0);
  expect(summary.failedMatches).toBe(0);

  // The forfeit-only battle: just the forfeiter, nothing paid.
  const forfeitBattles = await battlesOf([forfeiter]);
  expect(forfeitBattles).toHaveLength(1);
  const fb = forfeitBattles[0];
  expect(fb).toMatchObject({
    battleType: c.mode,
    leagueType: c.forfeitLeagueType('bronze'),
    winnerId: null,
    durationSeconds: BYE_BATTLE_DURATION_SECONDS,
    winnerReward: 0,
    loserReward: 0,
  });
  expect(fb.participants).toHaveLength(1);
  expect(fb.participants[0]).toMatchObject({
    robotId: forfeiter, forfeited: true, credits: 0, finalHP: FORFEITER_HP, damageDealt: 0, placement: c.minimum,
  });
  const audits = await prisma.auditLog.findMany({ where: { eventType: 'battle_complete', battleId: fb.id } });
  expect(audits).toHaveLength(1);
  expect(audits[0].payload).toMatchObject({ forfeit: true, kothPlacement: c.minimum });

  const original = await prisma.scheduledMatch.findUniqueOrThrow({ where: { id: matchId } });
  expect(original).toMatchObject({ status: 'completed', battleId: fb.id });

  // One resolved per-robot bye per ready robot, paid the bye credits, no LP.
  const byeRows = await prisma.scheduledMatch.findMany({
    where: { isByeMatch: true, ...scheduledMatchesForRobots(field.ready) },
    include: { participants: true },
  });
  expect(byeRows).toHaveLength(field.ready.length);
  expect(byeRows.every((r) => r.status === 'completed' && r.participants.length === 1)).toBe(true);
  expect(byeRows.every((r) => r.leagueType === 'bronze' && r.leagueInstanceId === 'bronze_1')).toBe(true);
  for (const [i, id] of field.ready.entries()) {
    const ledger = await ledgerRows(id);
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ transactionType: 'battle_income', amount: getParticipationReward('bronze') });
    const after = await snapshot(c, id);
    expect(after.standing.leaguePoints).toBe(readyBefore[i].standing.leaguePoints);
    expect(after.standing.totalMatches).toBe(readyBefore[i].standing.totalMatches);
  }

  const after = await snapshot(c, forfeiter);
  expect(after.standing.leaguePoints).toBe(forfeiterBefore.standing.leaguePoints);
  expect(after.standing.totalMatches).toBe((forfeiterBefore.standing.totalMatches ?? 0) + 1);
  expect(await ledgerRows(forfeiter)).toHaveLength(0);

  // A concurrent second resolution of the same match loses the claim: it
  // deletes its bare battle row and writes nothing else.
  const maxBattle = await prisma.battle.aggregate({ _max: { id: true } });
  const ready = await loadRobots(field.ready);
  const forfeited = await loadRobots([forfeiter]);
  await resolveBelowMinimumField(
    { id: matchId, leagueType: 'bronze', leagueInstanceId: 'bronze_1', scheduledFor: original.scheduledFor },
    c.mode,
    ready,
    forfeited,
  );
  expect(await prisma.battle.count({ where: { id: { gt: maxBattle._max.id ?? 0 } } })).toBe(0);
  expect(await prisma.battleParticipant.count({ where: { robotId: forfeiter } })).toBe(1);
  expect(await prisma.scheduledMatch.count({ where: { isByeMatch: true, ...scheduledMatchesForRobots(field.ready) } }))
    .toBe(field.ready.length);
  for (const id of field.ready) expect(await ledgerRows(id)).toHaveLength(1);
}

/** T13 crash: the bye step throws once on a GOLD match; the next run pays each bye once at gold. */
async function expectT13CrashRerun(c: PlacementCase) {
  await isolate(c.matchType);
  const field = await createField(c, kinds(c.minimum - 1, 1), 'gold');
  const forfeiter = field.unarmed[0];
  const matchId = await scheduleField(c, field.all, 'gold');
  jest.spyOn(byeResolutionService, 'resolveByeEvent').mockRejectedValueOnce(new Error('injected bye crash'));

  const first = await c.run();
  await flushDeferredWork();

  expect(first.failedMatches).toBe(1);
  expect(first.errors.join(' ')).toContain('injected bye crash');
  // The original was claimed before the crash, so the failure policy finds it terminal.
  expect((await prisma.scheduledMatch.findUniqueOrThrow({ where: { id: matchId } })).status).toBe('completed');
  const pending = await prisma.scheduledMatch.findMany({ where: { isByeMatch: true, ...scheduledMatchesForRobots(field.ready) } });
  expect(pending).toHaveLength(field.ready.length);
  expect(pending.every((r) => r.status === 'scheduled' && r.leagueType === 'gold')).toBe(true);
  for (const id of field.ready) expect(await ledgerRows(id)).toHaveLength(0);
  jest.restoreAllMocks();

  // The next run resolves the stranded bye rows through the normal bye branch.
  const second = await c.run();
  await flushDeferredWork();
  expect(second.byeMatches).toBe(field.ready.length);
  const third = await c.run();
  expect(third.byeMatches).toBe(0);

  for (const id of field.ready) {
    const ledger = await ledgerRows(id);
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ transactionType: 'battle_income', amount: getParticipationReward('gold') });
  }
  expect(await prisma.battleParticipant.count({ where: { robotId: forfeiter } })).toBe(1);
  const forfeitBattle = (await battlesOf([forfeiter]))[0];
  expect(forfeitBattle.leagueType).toBe(c.forfeitLeagueType('gold'));
}

/** Every robot in the field is unarmed. */
async function expectAllUnarmed(c: PlacementCase) {
  await isolate(c.matchType);
  const field = await createField(c, kinds(0, c.minimum), 'bronze');
  const matchId = await scheduleField(c, field.all, 'bronze');
  const before = await Promise.all(field.all.map((id) => snapshot(c, id)));

  const summary = await c.run();
  await flushDeferredWork();

  expect(summary.belowMinimumMatches).toBe(1);
  expect(summary.forfeitedRobots).toBe(c.minimum);
  const battles = await battlesOf(field.all);
  expect(battles).toHaveLength(1);
  expect(battles[0].winnerId).toBeNull();
  expect(battles[0].participants).toHaveLength(c.minimum);
  expect(battles[0].participants.every((p) => p.forfeited && p.credits === 0)).toBe(true);
  expect(battles[0].participants.map((p) => p.placement).sort((a, b) => (a ?? 0) - (b ?? 0)))
    .toEqual(Array.from({ length: c.minimum }, (_, i) => i + 1));
  expect(await prisma.scheduledMatch.count({ where: { isByeMatch: true, ...scheduledMatchesForRobots(field.all) } })).toBe(0);
  expect((await prisma.scheduledMatch.findUniqueOrThrow({ where: { id: matchId } }))).toMatchObject({
    status: 'completed', battleId: battles[0].id,
  });
  for (const [i, id] of field.all.entries()) {
    const after = await snapshot(c, id);
    // A forfeit is never a win, not even in placement 1 of an all-unarmed field.
    expect(after.standing.wins).toBe(before[i].standing.wins);
    expect(after.standing.leaguePoints).toBe(before[i].standing.leaguePoints);
    expect(after.standing.totalMatches).toBe((before[i].standing.totalMatches ?? 0) + 1);
    expect(await ledgerRows(id)).toHaveLength(0);
  }
}

/** T8-R6: dual_wield without an offhand fights single; the DB loadout is unchanged. */
async function expectT8R6(c: PlacementCase) {
  await isolate(c.matchType);
  const field = await createField(c, [...kinds(c.minimum - 1, 0), 'dual_wield_no_offhand'], 'bronze');
  const incomplete = field.other[0];
  const matchId = await scheduleField(c, field.all, 'bronze');
  const original = simulationLoop.simulateBattleMulti;
  let simulatedLoadout: string | undefined;
  jest.spyOn(simulationLoop, 'simulateBattleMulti').mockImplementation((robots, config) => {
    simulatedLoadout = robots.find((r) => r.id === incomplete)?.loadoutType;
    return original(robots, config);
  });
  const warn = jest.spyOn(logger, 'warn');

  const summary = await c.run();
  await flushDeferredWork();

  expect(summary.successfulMatches).toBe(1);
  expect(summary.forfeitedRobots).toBe(0);
  expect(simulatedLoadout).toBe('single');
  const fallbackLogs = (warn.mock.calls as unknown as unknown[][]).filter((call) => call[0] === '[Battle] Loadout fallback');
  expect(fallbackLogs).toHaveLength(1);
  expect(fallbackLogs[0][1]).toMatchObject({ matchId, robotId: incomplete, storedLoadout: 'dual_wield', battleLoadout: 'single' });
  const battles = await battlesOf(field.all);
  expect(battles).toHaveLength(1);
  expect(battles[0].participants.every((p) => !p.forfeited)).toBe(true);
  const robot = await prisma.robot.findUniqueOrThrow({ where: { id: incomplete } });
  expect(robot.loadoutType).toBe('dual_wield');
  expect(robot.dualWieldWins).toBe(0);
}

// ── King of the Hill ─────────────────────────────────────────────────

describe('King of the Hill', () => {
  it('T12: an unarmed robot is placed last with nothing paid; only the ready robots fight', async () => {
    const initialState = jest.spyOn(kothGameMode, 'buildKothInitialState');

    const { field } = await expectT12(kothCase, 6);

    expect(initialState).toHaveBeenCalledTimes(1);
    expect([...initialState.mock.calls[0][1]].sort((a, b) => a - b)).toEqual([...field.ready].sort((a, b) => a - b));
  });

  it('T13: below the minimum → a forfeit-only battle and tier-scaled byes', async () => {
    await expectT13(kothCase);
  });

  it('T13: a crash in the bye step is recovered once, at the gold tier', async () => {
    await expectT13CrashRerun(kothCase);
  });

  it('R6: a plain KotH bye on a gold match pays the gold amount', async () => {
    await isolate('koth');
    const field = await createField(kothCase, kinds(1, 0), 'gold');
    await scheduleField(kothCase, field.all, 'gold', true);

    const summary = await executeScheduledKothBattles();

    expect(summary.byeMatches).toBe(1);
    const ledger = await ledgerRows(field.all[0]);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].amount).toBe(getParticipationReward('gold'));
  });

  it('all unarmed: a forfeit-only battle, zero byes, the match is completed', async () => {
    await expectAllUnarmed(kothCase);
  });

  it('T8-R6: an incomplete loadout fights as single; the stored loadout is unchanged', async () => {
    await expectT8R6(kothCase);
  });
});

// ── Grand Melee ──────────────────────────────────────────────────────

describe('Grand Melee', () => {
  it('T12: an unarmed robot is placed last with nothing paid; the arena is sized for the ready robots', async () => {
    const simulate = jest.spyOn(simulationLoop, 'simulateBattleMulti');

    const { battle, field } = await expectT12(grandMeleeCase, 9);

    expect(simulate).toHaveBeenCalledTimes(1);
    expect(simulate.mock.calls[0][0].map((r) => r.id).sort((a, b) => a - b)).toEqual([...field.ready].sort((a, b) => a - b));
    // 16 + (ready.length - 2) * 3 with 8 ready robots, not 37 from 9.
    expect((battle.battleLog as unknown as { arenaRadius: number }).arenaRadius).toBe(34);
    expect(simulate.mock.calls[0][1]?.arenaRadius).toBe(34);
  });

  it('T13: below the minimum → a forfeit-only battle at the tier and tier-scaled byes', async () => {
    await expectT13(grandMeleeCase);
  });

  it('T13: a crash in the bye step is recovered once, at the gold tier', async () => {
    await expectT13CrashRerun(grandMeleeCase);
  });

  it('all unarmed: a forfeit-only battle, zero byes, the match is completed', async () => {
    await expectAllUnarmed(grandMeleeCase);
  });

  it('T8-R6: an incomplete loadout fights as single; the stored loadout is unchanged', async () => {
    await expectT8R6(grandMeleeCase);
  });
});
