/**
 * T17 — the uniform per-match failure policy across all seven modes (rule 7, R3).
 *
 * Real database. Per mode: schedule two matches with armed robots, make the
 * engine throw for the first, run the mode's executor. The failed match must be
 * terminal (`cancelled`, or the R1 higher-seed advance for knockouts), the other
 * match must complete, and the executor must resolve. A rerun (the "next day")
 * must not pick the failed match up again and must write no battle or ledger rows.
 *
 * Extra cases:
 * - tag team: a throw inside `updateTagTeamBattleResults` leaves the match
 *   `completed` with its battle linked, and a rerun neither re-simulates nor
 *   pays again; a lost completion claim deletes the duplicate battle;
 * - league 1v1 and KotH: a throw in the first credit award after the battle row
 *   exists leaves the match terminal, pays nothing on rerun, and the §11
 *   fought-battle signature finds the battle and stable (R3, at-most-once).
 *
 * T26 — the simulator backstop: with the battle-time readiness gate bypassed
 * (spied to let an unarmed robot through) in league 1v1, a solo tournament and
 * KotH, the simulator throws `ROBOT_NOT_BATTLE_READY`, the policy cancels the
 * match (R1 for the tournament) and the next match in the run completes.
 *
 * Each case cancels any queued rows of its mode left by other suites first, so
 * the executor processes only this file's matches.
 */
import prisma from '../../src/lib/prisma';
import type { MatchType } from '../../generated/prisma';
import * as simulationLoop from '../../src/services/battle/combat-simulator/simulationLoop';
import * as teamBattleEngine from '../../src/services/team-battle/teamBattleEngine';
import * as tagTeamSimulation from '../../src/services/tag-team/tagTeamSimulation';
import * as tagTeamResultUpdater from '../../src/services/tag-team/tagTeamResultUpdater';
import * as tagTeamBattleRecord from '../../src/services/tag-team/tagTeamBattleRecord';
import * as battlePostCombat from '../../src/services/battle/battlePostCombat';
import * as combatReadiness from '../../src/services/battle/combatReadiness';
import * as byeResolutionService from '../../src/services/battle/byeResolutionService';
import { executeScheduledBattles } from '../../src/services/league/leagueBattleOrchestrator';
import { executeScheduledTeamBattles } from '../../src/services/team-battle/teamBattleOrchestrator';
import { executeScheduledTagTeamBattles } from '../../src/services/tag-team/tagTeamScheduler';
import { executeScheduledKothBattles } from '../../src/services/koth/kothBattleOrchestrator';
import { executeScheduledGrandMeleeBattles } from '../../src/services/grand-melee/grandMeleeBattleOrchestrator';
import { executeSoloTournamentRound } from '../../src/services/tournament/tournamentBattleOrchestrator';
import { executeTeamTournamentRound } from '../../src/services/tournament/teamTournamentBattleOrchestrator';
import { battlesForRobots } from '../cleanupHelper';
import { useFinancialCaptureTestEnvironment } from '../financialCaptureTestHelper';
import { enterRobotStandings, enterTeamStanding } from '../helpers/standings';
import { subscribeTeamMembers } from '../helpers/subscriptions';
import { createTagTeamFixture } from '../helpers/tagTeam';
import { findFoughtBattlesMissingIncome } from '../helpers/foughtBattleSignature';

useFinancialCaptureTestEnvironment();

const RUN = `mfp${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const INJECTED = 'injected engine failure';
const PAYMENT = 'injected payment failure';

const userIds: number[] = [];
const robotIds: number[] = [];
const teamIds: number[] = [];
const tournamentIds: number[] = [];
const scheduledIds: number[] = [];
let weaponId: number;
let counter = 0;
const next = (): number => ++counter;

// ── Fixtures ─────────────────────────────────────────────────────────

async function createStable(): Promise<number> {
  const n = next();
  const user = await prisma.user.create({
    data: { username: `${RUN}_u${n}`, passwordHash: 'x', currency: 500_000, stableName: `${RUN}_s${n}` },
  });
  userIds.push(user.id);
  return user.id;
}

async function armedRobot(userId: number, elo = 1200): Promise<number> {
  const inv = await prisma.weaponInventory.create({ data: { userId, weaponId, pricePaid: 0 } });
  const robot = await prisma.robot.create({
    data: {
      userId,
      name: `${RUN}_r${next()}`,
      elo,
      currentHP: 100,
      maxHP: 100,
      currentShield: 20,
      maxShield: 20,
      yieldThreshold: 20,
      loadoutType: 'single',
      mainWeaponId: inv.id,
    },
  });
  robotIds.push(robot.id);
  return robot.id;
}

/** Remove a robot's main weapon (after scheduling: the robot is unarmed at battle time). */
async function disarm(robotId: number): Promise<void> {
  await prisma.robot.update({ where: { id: robotId }, data: { mainWeaponId: null } });
}
/** `count` robots, each in its own stable (so per-stable income is distinguishable). */
async function soloRobots(count: number, eloBase = 1500): Promise<number[]> {
  const ids: number[] = [];
  for (let i = 0; i < count; i++) ids.push(await armedRobot(await createStable(), eloBase - i * 10));
  return ids;
}

async function createTeam(size: 2 | 3): Promise<{ teamId: number; robots: number[]; stableId: number }> {
  const stableId = await createStable();
  const robots: number[] = [];
  for (let i = 0; i < size; i++) robots.push(await armedRobot(stableId));
  const team = await prisma.teamBattle.create({
    data: {
      stableId,
      teamSize: size,
      teamName: `${RUN}_t${next()}`.slice(0, 32),
      members: { create: robots.map((robotId, slotIndex) => ({ robotId, slotIndex })) },
    },
  });
  teamIds.push(team.id);
  return { teamId: team.id, robots, stableId };
}

/** One queued unified match; `order` keeps creation and schedule order deterministic. */
async function scheduleUnified(
  matchType: MatchType,
  participantType: 'robot' | 'team',
  participantIds: number[],
  order: number,
): Promise<number> {
  const at = new Date(Date.now() - 60_000 + order * 1_000);
  const row = await prisma.scheduledMatch.create({
    data: {
      matchType,
      status: 'scheduled',
      scheduledFor: at,
      createdAt: at,
      leagueType: 'bronze',
      leagueInstanceId: 'bronze_1',
      isByeMatch: false,
      participants: {
        create: participantIds.map((participantId, i) => ({ participantType, participantId, slot: i + 1 })),
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
    data: { status: 'cancelled', cancelReason: 'matchFailurePolicy.test isolation' },
  });
}

async function createSoloTournament(seedRobots: number[]): Promise<{ tournamentId: number; m1: number; m2: number }> {
  // 4-slot standard order: slots [s1, s4, s3, s2] → match 1 = s1 v s4, match 2 = s3 v s2.
  const [s1, s2, s3, s4] = seedRobots;
  const tournament = await prisma.tournament.create({
    data: { name: `${RUN} Solo ${next()}`, tournamentType: 'single_elimination', participantType: 'robot', status: 'active', currentRound: 1, maxRounds: 2, totalParticipants: 4 },
  });
  tournamentIds.push(tournament.id);
  const m1 = await prisma.scheduledTournamentMatch.create({ data: { tournamentId: tournament.id, round: 1, matchNumber: 1, participantType: 'robot', participant1Id: s1, participant2Id: s4 } });
  const m2 = await prisma.scheduledTournamentMatch.create({ data: { tournamentId: tournament.id, round: 1, matchNumber: 2, participantType: 'robot', participant1Id: s3, participant2Id: s2 } });
  await prisma.scheduledTournamentMatch.create({ data: { tournamentId: tournament.id, round: 2, matchNumber: 1, participantType: 'robot' } });
  return { tournamentId: tournament.id, m1: m1.id, m2: m2.id };
}

async function createTeamTournament(seedTeams: number[]): Promise<{ tournamentId: number; m1: number; m2: number }> {
  const [s1, s2, s3, s4] = seedTeams;
  const tournament = await prisma.tournament.create({
    data: { name: `${RUN} Team ${next()}`, tournamentType: 'single_elimination', participantType: 'team_2v2', status: 'active', currentRound: 1, maxRounds: 2, totalParticipants: 4 },
  });
  tournamentIds.push(tournament.id);
  const m1 = await prisma.scheduledTournamentMatch.create({ data: { tournamentId: tournament.id, round: 1, matchNumber: 1, participantType: 'team_2v2', participant1Id: s1, participant2Id: s4 } });
  const m2 = await prisma.scheduledTournamentMatch.create({ data: { tournamentId: tournament.id, round: 1, matchNumber: 2, participantType: 'team_2v2', participant1Id: s3, participant2Id: s2 } });
  await prisma.scheduledTournamentMatch.create({ data: { tournamentId: tournament.id, round: 2, matchNumber: 1, participantType: 'team_2v2' } });
  return { tournamentId: tournament.id, m1: m1.id, m2: m2.id };
}

// ── Engine fault injection (by participant, so call order never matters) ──

function failSimulateBattleFor(failing: Set<number>): jest.SpyInstance {
  const original = simulationLoop.simulateBattle;
  return jest.spyOn(simulationLoop, 'simulateBattle').mockImplementation((r1, r2, isTournament) => {
    if (failing.has(r1.id) || failing.has(r2.id)) throw new Error(INJECTED);
    return original(r1, r2, isTournament);
  });
}

function failSimulateBattleMultiFor(failing: Set<number>): jest.SpyInstance {
  const original = simulationLoop.simulateBattleMulti;
  return jest.spyOn(simulationLoop, 'simulateBattleMulti').mockImplementation((robots, config) => {
    if (robots.some((r) => failing.has(r.id))) throw new Error(INJECTED);
    return original(robots, config);
  });
}

function failSimulateTeamBattleFor(failing: Set<number>): jest.SpyInstance {
  const original = teamBattleEngine.simulateTeamBattle;
  return jest.spyOn(teamBattleEngine, 'simulateTeamBattle').mockImplementation((t1, t2, size) => {
    if ([...t1, ...t2].some((r) => failing.has(r.id))) throw new Error(INJECTED);
    return original(t1, t2, size);
  });
}

// ── Readiness gate bypass (T26): let unarmed robots reach the simulator ──
function bypassMatchEntryGateFor(bypassed: Set<number>): jest.SpyInstance {
  const original = combatReadiness.evaluateMatchEntry;
  return jest.spyOn(combatReadiness, 'evaluateMatchEntry').mockImplementation((side1, side2) => {
    if ([...side1, ...side2].some((r) => bypassed.has(r.id))) return { kind: 'fight', decisions: [] };
    return original(side1, side2);
  });
}
function bypassPlacementGateFor(bypassed: Set<number>): jest.SpyInstance {
  const original = combatReadiness.partitionPlacementField;
  return jest.spyOn(combatReadiness, 'partitionPlacementField').mockImplementation((robots) => {
    if (robots.some((r) => bypassed.has(r.id))) return { ready: robots, forfeited: [], decisions: [] };
    return original(robots);
  });
}
// ── Assertions ───────────────────────────────────────────────────────

async function battleCount(robots: number[]): Promise<number> {
  return prisma.battle.count({ where: battlesForRobots(robots) });
}

async function ledgerCount(users: number[]): Promise<number> {
  return prisma.financialLedger.count({ where: { userId: { in: users } } });
}

async function stablesOf(robots: number[]): Promise<number[]> {
  const rows = await prisma.robot.findMany({ where: { id: { in: robots } }, select: { userId: true } });
  return [...new Set(rows.map((r) => r.userId))];
}

async function expectUnifiedOutcome(
  failedId: number,
  okId: number,
  failedRobots: number[],
  reason: string = INJECTED,
): Promise<void> {
  const failed = await prisma.scheduledMatch.findUniqueOrThrow({ where: { id: failedId } });
  expect(failed.status).toBe('cancelled');
  expect(failed.cancelReason).toContain(reason);
  const ok = await prisma.scheduledMatch.findUniqueOrThrow({ where: { id: okId } });
  expect(ok.status).toBe('completed');
  expect(await battleCount(failedRobots)).toBe(0);
}

/** The "next day": rerunning writes no battle and no ledger row for the mode's robots. */
async function expectRerunIsInert(run: () => Promise<unknown>, robots: number[]): Promise<void> {
  const users = await stablesOf(robots);
  const battlesBefore = await battleCount(robots);
  const ledgerBefore = await ledgerCount(users);
  await expect(run()).resolves.toBeDefined();
  expect(await battleCount(robots)).toBe(battlesBefore);
  expect(await ledgerCount(users)).toBe(ledgerBefore);
}

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
  await prisma.scheduledMatch.deleteMany({ where: { id: { in: scheduledIds } } });
  await prisma.scheduledTournamentMatch.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
  await prisma.battle.deleteMany({ where: battlesForRobots(robotIds) });
  await prisma.battle.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
  await prisma.tournament.deleteMany({ where: { id: { in: tournamentIds } } });
  await prisma.financialLedger.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.auditLog.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { robotId: { in: robotIds } }] } });
  await prisma.standing.deleteMany({ where: { entityType: 'robot', entityId: { in: robotIds } } });
  await prisma.standing.deleteMany({ where: { entityType: 'team', entityId: { in: teamIds } } });
  await prisma.subscription.deleteMany({ where: { robotId: { in: robotIds } } });
  await prisma.teamBattleMember.deleteMany({ where: { teamId: { in: teamIds } } });
  await prisma.teamBattle.deleteMany({ where: { id: { in: teamIds } } });
  await prisma.robot.deleteMany({ where: { id: { in: robotIds } } });
  await prisma.weaponInventory.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
});

// ── T17 per mode ─────────────────────────────────────────────────────

describe('T17: a failing match is terminal, the run continues, the rerun does nothing', () => {
  it('league 1v1', async () => {
    await isolate('league_1v1');
    const [a, b, c, d] = await soloRobots(4);
    await enterRobotStandings([a, b, c, d], 'league_1v1');
    const m1 = await scheduleUnified('league_1v1', 'robot', [a, b], 1);
    const m2 = await scheduleUnified('league_1v1', 'robot', [c, d], 2);
    failSimulateBattleFor(new Set([a]));

    const summary = await executeScheduledBattles();

    expect(summary.failedBattles).toBe(1);
    expect(summary.errors.join(' ')).toContain(INJECTED);
    await expectUnifiedOutcome(m1, m2, [a, b]);
    await expectRerunIsInert(() => executeScheduledBattles(), [a, b, c, d]);
  });

  it('team league 2v2', async () => {
    await isolate('league_2v2');
    const teams = [await createTeam(2), await createTeam(2), await createTeam(2), await createTeam(2)];
    for (const t of teams) await enterTeamStanding(t.teamId, 'league_2v2');
    const m1 = await scheduleUnified('league_2v2', 'team', [teams[0].teamId, teams[1].teamId], 1);
    const m2 = await scheduleUnified('league_2v2', 'team', [teams[2].teamId, teams[3].teamId], 2);
    failSimulateTeamBattleFor(new Set(teams[0].robots));

    const result = await executeScheduledTeamBattles(2);

    expect(result.matchesCancelled).toBe(1);
    expect(result.matchesCompleted).toBe(1);
    await expectUnifiedOutcome(m1, m2, [...teams[0].robots, ...teams[1].robots]);
    await expectRerunIsInert(() => executeScheduledTeamBattles(2), teams.flatMap((t) => t.robots));
  });

  it('tag team', async () => {
    await isolate('tag_team');
    const teams: Array<{ teamId: number; robots: number[] }> = [];
    for (let i = 0; i < 4; i++) {
      const stableId = await createStable();
      const active = await armedRobot(stableId);
      const reserve = await armedRobot(stableId);
      const team = await createTagTeamFixture(stableId, active, reserve);
      teamIds.push(team.id);
      teams.push({ teamId: team.id, robots: [active, reserve] });
    }
    const m1 = await scheduleUnified('tag_team', 'team', [teams[0].teamId, teams[1].teamId], 1);
    const m2 = await scheduleUnified('tag_team', 'team', [teams[2].teamId, teams[3].teamId], 2);
    const original = tagTeamSimulation.simulateTagTeamBattle;
    jest.spyOn(tagTeamSimulation, 'simulateTagTeamBattle').mockImplementation((t1, t2) => {
      if (t1.id === teams[0].teamId) throw new Error(INJECTED);
      return original(t1, t2);
    });

    await expect(executeScheduledTagTeamBattles()).resolves.toBeDefined();

    await expectUnifiedOutcome(m1, m2, [...teams[0].robots, ...teams[1].robots]);
    await expectRerunIsInert(() => executeScheduledTagTeamBattles(), teams.flatMap((t) => t.robots));
  });

  it('tag team bye: a throw before the claim cancels the bye instead of leaving it scheduled', async () => {
    await isolate('tag_team');
    const teams: Array<{ teamId: number; robots: number[] }> = [];
    for (let i = 0; i < 3; i++) {
      const stableId = await createStable();
      const active = await armedRobot(stableId);
      const reserve = await armedRobot(stableId);
      const team = await createTagTeamFixture(stableId, active, reserve);
      teamIds.push(team.id);
      teams.push({ teamId: team.id, robots: [active, reserve] });
    }
    const bye = await scheduleUnified('tag_team', 'team', [teams[0].teamId], 1);
    const m2 = await scheduleUnified('tag_team', 'team', [teams[1].teamId, teams[2].teamId], 2);
    jest.spyOn(byeResolutionService, 'resolveByeEvent').mockRejectedValueOnce(new Error(INJECTED));

    await expect(executeScheduledTagTeamBattles()).resolves.toBeDefined();

    await expectUnifiedOutcome(bye, m2, teams[0].robots);
    await expectRerunIsInert(() => executeScheduledTagTeamBattles(), teams.flatMap((t) => t.robots));
  });

  it('King of the Hill', async () => {
    await isolate('koth');
    const field1 = await soloRobots(5);
    const field2 = await soloRobots(5);
    await enterRobotStandings([...field1, ...field2], 'koth');
    const m1 = await scheduleUnified('koth', 'robot', field1, 1);
    const m2 = await scheduleUnified('koth', 'robot', field2, 2);
    failSimulateBattleMultiFor(new Set(field1));

    const summary = await executeScheduledKothBattles();

    expect(summary.failedMatches).toBe(1);
    expect(summary.successfulMatches).toBe(1);
    await expectUnifiedOutcome(m1, m2, field1);
    expect((await prisma.scheduledMatch.findUniqueOrThrow({ where: { id: m1 } })).status).not.toBe('error');
    await expectRerunIsInert(() => executeScheduledKothBattles(), [...field1, ...field2]);
  });

  it('Grand Melee', async () => {
    await isolate('grand_melee');
    const field1 = await soloRobots(8);
    const field2 = await soloRobots(8);
    await enterRobotStandings([...field1, ...field2], 'grand_melee');
    const m1 = await scheduleUnified('grand_melee', 'robot', field1, 1);
    const m2 = await scheduleUnified('grand_melee', 'robot', field2, 2);
    failSimulateBattleMultiFor(new Set(field1));

    const summary = await executeScheduledGrandMeleeBattles();

    expect(summary.failedMatches).toBe(1);
    expect(summary.successfulMatches).toBe(1);
    await expectUnifiedOutcome(m1, m2, field1);
    await expectRerunIsInert(() => executeScheduledGrandMeleeBattles(), [...field1, ...field2]);
  });

  it('solo tournament (R1: the higher seed advances)', async () => {
    const seeds = await soloRobots(4);
    const { tournamentId, m1, m2 } = await createSoloTournament(seeds);
    failSimulateBattleFor(new Set([seeds[0]]));

    const result = await executeSoloTournamentRound(tournamentId);

    expect(result.matchesCancelled).toBe(1);
    expect(result.matchesExecuted).toBe(1);
    const failed = await prisma.scheduledTournamentMatch.findUniqueOrThrow({ where: { id: m1 } });
    expect(failed).toMatchObject({ status: 'cancelled', winnerId: seeds[0], battleId: null });
    expect((await prisma.scheduledTournamentMatch.findUniqueOrThrow({ where: { id: m2 } })).status).toBe('completed');
    expect(await battleCount([seeds[0], seeds[3]])).toBe(0);
    await expectRerunIsInert(() => executeSoloTournamentRound(tournamentId), seeds);
  });

  it('team tournament 2v2 (R1: the higher seed advances)', async () => {
    const teams = [await createTeam(2), await createTeam(2), await createTeam(2), await createTeam(2)];
    await subscribeTeamMembers(teams.map((t) => t.teamId), 'tournament_2v2');
    const seeds = teams.map((t) => t.teamId);
    const { tournamentId, m1, m2 } = await createTeamTournament(seeds);
    failSimulateTeamBattleFor(new Set(teams[0].robots));

    const result = await executeTeamTournamentRound(tournamentId, 2);

    expect(result.matchesCancelled).toBe(1);
    const failed = await prisma.scheduledTournamentMatch.findUniqueOrThrow({ where: { id: m1 } });
    expect(failed).toMatchObject({ status: 'cancelled', winnerId: seeds[0], battleId: null });
    expect((await prisma.scheduledTournamentMatch.findUniqueOrThrow({ where: { id: m2 } })).status).toBe('completed');
    expect(await battleCount([...teams[0].robots, ...teams[3].robots])).toBe(0);
    await expectRerunIsInert(() => executeTeamTournamentRound(tournamentId, 2), teams.flatMap((t) => t.robots));
  });
});

// ── T26: the simulator backstop when the readiness gate is bypassed ──
describe('T26: an unarmed robot that slips past the gate is a cancelled match, not a fought one', () => {
  const NOT_READY = 'ROBOT_NOT_BATTLE_READY';
  it('league 1v1', async () => {
    await isolate('league_1v1');
    const [a, b, c, d] = await soloRobots(4);
    await enterRobotStandings([a, b, c, d], 'league_1v1');
    const m1 = await scheduleUnified('league_1v1', 'robot', [a, b], 1);
    const m2 = await scheduleUnified('league_1v1', 'robot', [c, d], 2);
    await disarm(b);
    bypassMatchEntryGateFor(new Set([b]));
    const summary = await executeScheduledBattles();
    expect(summary.failedBattles).toBe(1);
    expect(summary.errors.join(' ')).toContain(NOT_READY);
    await expectUnifiedOutcome(m1, m2, [a, b], NOT_READY);
    await expectRerunIsInert(() => executeScheduledBattles(), [a, b, c, d]);
  });
  it('solo tournament (R1: the higher seed advances)', async () => {
    const seeds = await soloRobots(4);
    const { tournamentId, m1, m2 } = await createSoloTournament(seeds);
    await disarm(seeds[3]);
    bypassMatchEntryGateFor(new Set([seeds[3]]));
    const result = await executeSoloTournamentRound(tournamentId);
    expect(result.matchesCancelled).toBe(1);
    expect(result.matchesExecuted).toBe(1);
    const failed = await prisma.scheduledTournamentMatch.findUniqueOrThrow({ where: { id: m1 } });
    expect(failed).toMatchObject({ status: 'cancelled', winnerId: seeds[0], battleId: null });
    expect((await prisma.scheduledTournamentMatch.findUniqueOrThrow({ where: { id: m2 } })).status).toBe('completed');
    expect(await battleCount([seeds[0], seeds[3]])).toBe(0);
    await expectRerunIsInert(() => executeSoloTournamentRound(tournamentId), seeds);
  });
  it('King of the Hill', async () => {
    await isolate('koth');
    const field1 = await soloRobots(5);
    const field2 = await soloRobots(5);
    await enterRobotStandings([...field1, ...field2], 'koth');
    const m1 = await scheduleUnified('koth', 'robot', field1, 1);
    const m2 = await scheduleUnified('koth', 'robot', field2, 2);
    await disarm(field1[2]);
    bypassPlacementGateFor(new Set([field1[2]]));
    const summary = await executeScheduledKothBattles();
    expect(summary.failedMatches).toBe(1);
    expect(summary.successfulMatches).toBe(1);
    await expectUnifiedOutcome(m1, m2, field1, NOT_READY);
    await expectRerunIsInert(() => executeScheduledKothBattles(), [...field1, ...field2]);
  });
});
// ── Payment failures after the battle exists (R3) ───────────────────

describe('T17: failures after the battle row exists are at-most-once', () => {
  it('tag team: a payment throw leaves the match completed and is never re-simulated', async () => {
    await isolate('tag_team');
    const teams: Array<{ teamId: number; robots: number[] }> = [];
    for (let i = 0; i < 2; i++) {
      const stableId = await createStable();
      const active = await armedRobot(stableId);
      const reserve = await armedRobot(stableId);
      const team = await createTagTeamFixture(stableId, active, reserve);
      teamIds.push(team.id);
      teams.push({ teamId: team.id, robots: [active, reserve] });
    }
    const m1 = await scheduleUnified('tag_team', 'team', [teams[0].teamId, teams[1].teamId], 1);
    const allRobots = teams.flatMap((t) => t.robots);
    jest.spyOn(tagTeamResultUpdater, 'updateTagTeamBattleResults').mockRejectedValueOnce(new Error(PAYMENT));

    await executeScheduledTagTeamBattles();

    const row = await prisma.scheduledMatch.findUniqueOrThrow({ where: { id: m1 } });
    expect(row.status).toBe('completed');
    expect(row.battleId).not.toBeNull();
    expect(await battleCount(allRobots)).toBe(1);
    await expectRerunIsInert(() => executeScheduledTagTeamBattles(), allRobots);
    expect(await battleCount(allRobots)).toBe(1);
  });

  it('tag team: a lost completion claim deletes the duplicate battle before paying', async () => {
    await isolate('tag_team');
    const teams: Array<{ teamId: number; robots: number[] }> = [];
    for (let i = 0; i < 2; i++) {
      const stableId = await createStable();
      const active = await armedRobot(stableId);
      const reserve = await armedRobot(stableId);
      const team = await createTagTeamFixture(stableId, active, reserve);
      teamIds.push(team.id);
      teams.push({ teamId: team.id, robots: [active, reserve] });
    }
    const m1 = await scheduleUnified('tag_team', 'team', [teams[0].teamId, teams[1].teamId], 1);
    const allRobots = teams.flatMap((t) => t.robots);
    const original = tagTeamBattleRecord.createTagTeamBattleRecord;
    jest.spyOn(tagTeamBattleRecord, 'createTagTeamBattleRecord').mockImplementation(async (...args) => {
      const battle = await original(...args);
      // A concurrent run resolves the match between our battle write and our claim.
      await prisma.scheduledMatch.update({ where: { id: m1 }, data: { status: 'completed' } });
      return battle;
    });
    const updater = jest.spyOn(tagTeamResultUpdater, 'updateTagTeamBattleResults');
    const ledgerBefore = await ledgerCount(await stablesOf(allRobots));

    await expect(executeScheduledTagTeamBattles()).resolves.toBeDefined();

    expect(await battleCount(allRobots)).toBe(0);
    expect(updater).not.toHaveBeenCalled();
    expect(await ledgerCount(await stablesOf(allRobots))).toBe(ledgerBefore);
    expect((await prisma.scheduledMatch.findUniqueOrThrow({ where: { id: m1 } })).status).toBe('completed');
  });

  it('league 1v1: a credit-award throw leaves the match terminal and the fought-battle signature finds it', async () => {
    await isolate('league_1v1');
    const [a, b] = await soloRobots(2);
    await enterRobotStandings([a, b], 'league_1v1');
    const m1 = await scheduleUnified('league_1v1', 'robot', [a, b], 1);
    jest.spyOn(battlePostCombat, 'awardCreditsWithLedger').mockRejectedValueOnce(new Error(PAYMENT));

    await executeScheduledBattles();

    const row = await prisma.scheduledMatch.findUniqueOrThrow({ where: { id: m1 } });
    expect(['cancelled', 'completed']).toContain(row.status);
    const battles = await prisma.battle.findMany({ where: battlesForRobots([a, b]), select: { id: true } });
    expect(battles).toHaveLength(1);
    const missing = await findFoughtBattlesMissingIncome(battles.map((x) => x.id));
    expect(missing.length).toBeGreaterThanOrEqual(1);
    expect(missing[0].battleId).toBe(battles[0].id);
    expect(await stablesOf([a, b])).toContain(missing[0].stableId);
    await expectRerunIsInert(() => executeScheduledBattles(), [a, b]);
  });

  it('King of the Hill: a credit-award throw leaves the match terminal and the fought-battle signature finds it', async () => {
    await isolate('koth');
    const field = await soloRobots(5);
    await enterRobotStandings(field, 'koth');
    const m1 = await scheduleUnified('koth', 'robot', field, 1);
    jest.spyOn(battlePostCombat, 'awardCreditsWithLedger').mockRejectedValueOnce(new Error(PAYMENT));

    const summary = await executeScheduledKothBattles();

    expect(summary.failedMatches).toBe(1);
    const row = await prisma.scheduledMatch.findUniqueOrThrow({ where: { id: m1 } });
    expect(row.status).toBe('cancelled');
    const battles = await prisma.battle.findMany({ where: battlesForRobots(field), select: { id: true } });
    expect(battles).toHaveLength(1);
    const missing = await findFoughtBattlesMissingIncome(battles.map((x) => x.id));
    expect(missing.length).toBeGreaterThanOrEqual(1);
    expect(missing.every((m) => m.battleId === battles[0].id)).toBe(true);
    await expectRerunIsInert(() => executeScheduledKothBattles(), field);
  });
});

// ── §11 signature 2 must not flag paid walkovers ─────────────────────

describe('§11 fought-battle signature: paid byes and forfeit wins are not reported as unpaid', () => {
  it('a paid tag-team bye and a paid league 1v1 forfeit return no rows', async () => {
    await isolate('tag_team');
    await isolate('league_1v1');
    const stableId = await createStable();
    const active = await armedRobot(stableId);
    const reserve = await armedRobot(stableId);
    const team = await createTagTeamFixture(stableId, active, reserve);
    teamIds.push(team.id);
    const bye = await scheduleUnified('tag_team', 'team', [team.id], 1);
    const [a, b] = await soloRobots(2);
    await enterRobotStandings([a, b], 'league_1v1');
    const forfeit = await scheduleUnified('league_1v1', 'robot', [a, b], 1);
    await disarm(b);

    await executeScheduledTagTeamBattles();
    await executeScheduledBattles();

    const rows = await prisma.scheduledMatch.findMany({ where: { id: { in: [bye, forfeit] } } });
    expect(rows.map((r) => r.status)).toEqual(['completed', 'completed']);
    const battleIds = rows.map((r) => r.battleId!);
    // Both walkovers paid someone, so the query has something to (wrongly) match.
    const paid = await prisma.battleParticipant.findMany({ where: { battleId: { in: battleIds }, credits: { gt: 0 } } });
    expect(new Set(paid.map((p) => p.battleId))).toEqual(new Set(battleIds));
    expect(await findFoughtBattlesMissingIncome(battleIds)).toEqual([]);
  });
});
