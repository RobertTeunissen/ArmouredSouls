/**
 * T24 — the forfeit invariant across every mode (rules 1-5, 7, 8), heavy tier.
 *
 * Pattern of `byeInvariant.test.ts`: one loop over the modes instead of nine
 * hand-written cases. One cycle is every mode's cycle executor run once, in the
 * cycle's slot order, with all fixtures queued up front (the same functions the
 * cron handlers and the admin bulk cycle call). Settlement and matchmaking are
 * left out on purpose: they would pick up other suites' rows and are covered by
 * `schedulingAfterForfeit.test.ts` (T25).
 *
 * In every mode one robot loses its main weapon after scheduling, as a player
 * would. The invariant that must hold everywhere:
 *
 *  1. the mode's run resolves and reports the forfeit (two-sided modes) or the
 *     last-place forfeiter (KotH/GM); tournaments run to a champion;
 *  2. no robot reaches the simulator without a weapon: `assertAllRobotsArmed`
 *     is called for the fought battles and never throws;
 *  3. every credit payment (fought, forfeit win) has its ledger row and exactly
 *     one `financial_transaction` audit row with the same identity;
 *  4. no processed queued row is left `scheduled` or `error`.
 */
import prisma from '../../src/lib/prisma';
import type { MatchType } from '../../generated/prisma';
import * as combatReadiness from '../../src/services/battle/combatReadiness';
import { executeScheduledBattles } from '../../src/services/league/leagueBattleOrchestrator';
import { executeScheduledTeamBattles } from '../../src/services/team-battle/teamBattleOrchestrator';
import { executeScheduledTagTeamBattles } from '../../src/services/tag-team/tagTeamScheduler';
import { executeScheduledKothBattles } from '../../src/services/koth/kothBattleOrchestrator';
import { executeScheduledGrandMeleeBattles } from '../../src/services/grand-melee/grandMeleeBattleOrchestrator';
import { executeSoloTournamentRound } from '../../src/services/tournament/tournamentBattleOrchestrator';
import { executeTeamTournamentRound } from '../../src/services/tournament/teamTournamentBattleOrchestrator';
import { advanceWinnersToNextRound } from '../../src/services/tournament/tournamentService';
import { unequipMainWeapon } from '../../src/services/robot/robotWeaponService';
import { battlesForRobots } from '../cleanupHelper';
import { useFinancialCaptureTestEnvironment } from '../financialCaptureTestHelper';
import { enterRobotStandings, enterTeamStanding } from '../helpers/standings';
import { subscribeTeamMembers } from '../helpers/subscriptions';
import { createTagTeamFixture } from '../helpers/tagTeam';
useFinancialCaptureTestEnvironment();
const RUN = `ffi${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const userIds: number[] = [];
const robotIds: number[] = [];
const teamIds: number[] = [];
const tournamentIds: number[] = [];
const scheduledIds: number[] = [];
let weaponId: number;
let counter = 0;
const next = (): number => ++counter;
type Mode =
  | 'league_1v1'
  | 'league_2v2'
  | 'league_3v3'
  | 'tag_team'
  | 'tournament_1v1'
  | 'tournament_2v2'
  | 'tournament_3v3'
  | 'koth'
  | 'grand_melee';
/** What one mode queued, and the robot that is unarmed when the battle starts. */
interface PreparedMode {
  mode: Mode;
  robots: number[];
  unarmed: { stableId: number; robotId: number };
  /** Run the mode once (tournaments: every round to a champion) and check its own report. */
  run: () => Promise<void>;
  /** Queued rows the run must have resolved. */
  queued: { scheduledMatchIds: number[]; tournamentId: number | null };
}
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
async function soloRobots(count: number): Promise<Array<{ robotId: number; stableId: number }>> {
  const list: Array<{ robotId: number; stableId: number }> = [];
  for (let i = 0; i < count; i++) {
    const stableId = await createStable();
    list.push({ robotId: await armedRobot(stableId, 1500 - i * 10), stableId });
  }
  return list;
}
async function createTeam(size: 2 | 3): Promise<{ teamId: number; robots: number[]; stableId: number }> {
  const stableId = await createStable();
  const robots: number[] = [];
  for (let i = 0; i < size; i++) robots.push(await armedRobot(stableId, 1500 - next()));
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
      // KotH matchmaking always writes the zone radius (#522).
      zoneRadius: matchType === 'koth' ? 7 : null,
      participants: {
        create: participantIds.map((participantId, i) => ({ participantType, participantId, slot: i + 1 })),
      },
    },
  });
  scheduledIds.push(row.id);
  return row.id;
}
/** Cancel queued rows of a mode left by other suites so the run processes only this file's matches. */
async function isolate(matchType: MatchType): Promise<void> {
  await prisma.scheduledMatch.updateMany({
    where: { matchType, status: { in: ['scheduled', 'error'] }, id: { notIn: scheduledIds } },
    data: { status: 'cancelled', cancelReason: 'forfeitInvariant.test isolation' },
  });
}
/**
 * A 4-entrant, 2-round bracket. Standard order: match 1 = seed 1 v seed 4,
 * match 2 = seed 3 v seed 2; the final is an empty placeholder.
 */
async function createBracket(
  participantType: 'robot' | 'team_2v2' | 'team_3v3',
  seeds: number[],
): Promise<number> {
  const [s1, s2, s3, s4] = seeds;
  const tournament = await prisma.tournament.create({
    data: {
      name: `${RUN} ${participantType} ${next()}`,
      tournamentType: 'single_elimination',
      participantType,
      status: 'active',
      currentRound: 1,
      maxRounds: 2,
      totalParticipants: 4,
    },
  });
  tournamentIds.push(tournament.id);
  await prisma.scheduledTournamentMatch.create({ data: { tournamentId: tournament.id, round: 1, matchNumber: 1, participantType, participant1Id: s1, participant2Id: s4 } });
  await prisma.scheduledTournamentMatch.create({ data: { tournamentId: tournament.id, round: 1, matchNumber: 2, participantType, participant1Id: s3, participant2Id: s2 } });
  await prisma.scheduledTournamentMatch.create({ data: { tournamentId: tournament.id, round: 2, matchNumber: 1, participantType } });
  return tournament.id;
}
// ── Mode preparation (one entry per mode, in cycle slot order) ─────────
async function prepareLeague1v1(): Promise<PreparedMode> {
  await isolate('league_1v1');
  const robots = await soloRobots(4);
  const ids = robots.map((r) => r.robotId);
  await enterRobotStandings(ids, 'league_1v1');
  const m1 = await scheduleUnified('league_1v1', 'robot', [ids[0], ids[1]], 1);
  const m2 = await scheduleUnified('league_1v1', 'robot', [ids[2], ids[3]], 2);
  return {
    mode: 'league_1v1',
    robots: ids,
    unarmed: robots[1],
    queued: { scheduledMatchIds: [m1, m2], tournamentId: null },
    run: async () => {
      const summary = await executeScheduledBattles();
      expect(summary.forfeitBattles).toBe(1);
      expect(summary.failedBattles).toBe(0);
    },
  };
}
async function prepareTeamLeague(size: 2 | 3): Promise<PreparedMode> {
  const mode = size === 2 ? 'league_2v2' : 'league_3v3';
  await isolate(mode);
  const teams = [await createTeam(size), await createTeam(size), await createTeam(size), await createTeam(size)];
  for (const t of teams) await enterTeamStanding(t.teamId, mode);
  const m1 = await scheduleUnified(mode, 'team', [teams[0].teamId, teams[1].teamId], 1);
  const m2 = await scheduleUnified(mode, 'team', [teams[2].teamId, teams[3].teamId], 2);
  return {
    mode,
    robots: teams.flatMap((t) => t.robots),
    // The last member, so the rule is "any member", not "slot 0".
    unarmed: { stableId: teams[1].stableId, robotId: teams[1].robots[size - 1] },
    queued: { scheduledMatchIds: [m1, m2], tournamentId: null },
    run: async () => {
      const result = await executeScheduledTeamBattles(size);
      expect(result.matchesForfeited).toBe(1);
      expect(result.matchesCompleted).toBe(1);
      expect(result.matchesCancelled).toBe(0);
    },
  };
}
async function prepareTagTeam(): Promise<PreparedMode> {
  await isolate('tag_team');
  const teams: Array<{ teamId: number; robots: number[]; stableId: number }> = [];
  for (let i = 0; i < 4; i++) {
    const stableId = await createStable();
    const active = await armedRobot(stableId);
    const reserve = await armedRobot(stableId);
    const team = await createTagTeamFixture(stableId, active, reserve);
    teamIds.push(team.id);
    teams.push({ teamId: team.id, robots: [active, reserve], stableId });
  }
  const m1 = await scheduleUnified('tag_team', 'team', [teams[0].teamId, teams[1].teamId], 1);
  const m2 = await scheduleUnified('tag_team', 'team', [teams[2].teamId, teams[3].teamId], 2);
  return {
    mode: 'tag_team',
    robots: teams.flatMap((t) => t.robots),
    // The reserve: tag team used to cancel here instead of forfeiting.
    unarmed: { stableId: teams[1].stableId, robotId: teams[1].robots[1] },
    queued: { scheduledMatchIds: [m1, m2], tournamentId: null },
    run: async () => {
      const result = await executeScheduledTagTeamBattles();
      expect(result.forfeits).toBe(1);
      expect(result.totalBattles).toBe(1);
    },
  };
}
async function prepareSoloTournament(): Promise<PreparedMode> {
  const robots = await soloRobots(4);
  const ids = robots.map((r) => r.robotId);
  const tournamentId = await createBracket('robot', ids);
  return {
    mode: 'tournament_1v1',
    robots: ids,
    // Seed 4: match 1 is a forfeit, match 2 is fought.
    unarmed: robots[3],
    queued: { scheduledMatchIds: [], tournamentId },
    run: async () => {
      const round1 = await executeSoloTournamentRound(tournamentId);
      expect(round1.forfeits).toBe(1);
      expect(round1.matchesExecuted).toBe(1);
      expect(round1.matchesCancelled).toBe(0);
      await advanceWinnersToNextRound(tournamentId);
      const final = await executeSoloTournamentRound(tournamentId);
      expect(final.matchesExecuted).toBe(1);
      await advanceWinnersToNextRound(tournamentId);
    },
  };
}
async function prepareTeamTournament(size: 2 | 3): Promise<PreparedMode> {
  const mode = size === 2 ? 'tournament_2v2' : 'tournament_3v3';
  const teams = [await createTeam(size), await createTeam(size), await createTeam(size), await createTeam(size)];
  await subscribeTeamMembers(teams.map((t) => t.teamId), mode);
  const tournamentId = await createBracket(size === 2 ? 'team_2v2' : 'team_3v3', teams.map((t) => t.teamId));
  return {
    mode,
    robots: teams.flatMap((t) => t.robots),
    unarmed: { stableId: teams[3].stableId, robotId: teams[3].robots[1] },
    queued: { scheduledMatchIds: [], tournamentId },
    run: async () => {
      const round1 = await executeTeamTournamentRound(tournamentId, size);
      expect(round1.matchesForfeited).toBe(1);
      expect(round1.matchesCancelled).toBe(0);
      await advanceWinnersToNextRound(tournamentId);
      const final = await executeTeamTournamentRound(tournamentId, size);
      expect(final.matchesForfeited).toBe(0);
      expect(final.matchesCancelled).toBe(0);
      await advanceWinnersToNextRound(tournamentId);
    },
  };
}
async function preparePlacement(mode: 'koth' | 'grand_melee', fieldSize: number): Promise<PreparedMode> {
  await isolate(mode);
  const robots = await soloRobots(fieldSize);
  const ids = robots.map((r) => r.robotId);
  await enterRobotStandings(ids, mode);
  const m1 = await scheduleUnified(mode, 'robot', ids, 1);
  return {
    mode,
    robots: ids,
    unarmed: robots[2],
    queued: { scheduledMatchIds: [m1], tournamentId: null },
    run: async () => {
      // One forfeiter still leaves the minimum field (5 KotH, 8 GM), so the rest fight.
      const summary = mode === 'koth' ? await executeScheduledKothBattles() : await executeScheduledGrandMeleeBattles();
      expect(summary.forfeitedRobots).toBe(1);
      expect(summary.successfulMatches).toBe(1);
      expect(summary.belowMinimumMatches).toBe(0);
      expect(summary.failedMatches).toBe(0);
    },
  };
}
// ── Invariant checks ─────────────────────────────────────────────────
/** Every ledger row of these stables has exactly one financial_transaction audit row with the same identity. */
async function expectCompleteFinancialPairs(stables: number[]): Promise<number> {
  const ledger = await prisma.financialLedger.findMany({
    where: { userId: { in: stables } },
    select: { financialEventId: true },
  });
  const ids = ledger.flatMap((row) => (row.financialEventId === null ? [] : [row.financialEventId]));
  // Every payment carries an identity, and no identity is paid twice.
  expect(ids).toHaveLength(ledger.length);
  expect(new Set(ids).size).toBe(ids.length);
  const audits = await prisma.auditLog.findMany({
    where: { eventType: 'financial_transaction', financialEventId: { in: ids } },
    select: { financialEventId: true },
  });
  expect(audits.map((a) => a.financialEventId).sort()).toEqual([...ids].sort());
  return ledger.length;
}
async function expectNothingLeftQueued(p: PreparedMode): Promise<void> {
  if (p.queued.scheduledMatchIds.length > 0) {
    const rows = await prisma.scheduledMatch.findMany({ where: { id: { in: p.queued.scheduledMatchIds } } });
    expect(rows).toHaveLength(p.queued.scheduledMatchIds.length);
    expect(rows.every((r) => r.status === 'completed')).toBe(true);
  }
  if (p.queued.tournamentId !== null) {
    const tournament = await prisma.tournament.findUniqueOrThrow({ where: { id: p.queued.tournamentId } });
    expect(tournament.status).toBe('completed');
    const rows = await prisma.scheduledTournamentMatch.findMany({ where: { tournamentId: p.queued.tournamentId } });
    expect(rows.filter((r) => r.round === 1).map((r) => r.status).sort()).toEqual(['completed', 'forfeit']);
    expect(rows.every((r) => r.status !== 'pending' && r.status !== 'scheduled')).toBe(true);
  }
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
// ── T24 ──────────────────────────────────────────────────────────────
describe('T24: one cycle with an unarmed robot in every mode', () => {
  it('resolves every mode, never simulates an unarmed robot and pairs every payment', async () => {
    // Queue every mode first (the cycle's slot order), then disarm, then run.
    const prepared: PreparedMode[] = [
      await prepareLeague1v1(),
      await prepareTeamLeague(2),
      await prepareSoloTournament(),
      await prepareTagTeam(),
      await preparePlacement('koth', 6),
      await prepareTeamLeague(3),
      await prepareTeamTournament(2),
      await preparePlacement('grand_melee', 9),
      await prepareTeamTournament(3),
    ];
    expect(prepared.map((p) => p.mode).sort()).toEqual([
      'grand_melee', 'koth', 'league_1v1', 'league_2v2', 'league_3v3',
      'tag_team', 'tournament_1v1', 'tournament_2v2', 'tournament_3v3',
    ]);
    for (const p of prepared) await unequipMainWeapon(p.unarmed.stableId, p.unarmed.robotId);
    const armedCheck = jest.spyOn(combatReadiness, 'assertAllRobotsArmed');
    for (const p of prepared) {
      const callsBefore = armedCheck.mock.calls.length;
      await p.run();
      // 2. Fought battles went through the simulator check, and none threw.
      expect(armedCheck.mock.calls.length).toBeGreaterThan(callsBefore);
      const simulated = armedCheck.mock.calls.slice(callsBefore).flatMap(([robots]) => robots.map((r) => r.id));
      expect(simulated).not.toContain(p.unarmed.robotId);
      // 4. Nothing the run processed stays queued.
      await expectNothingLeftQueued(p);
      // The unarmed robot has exactly one battle row, as a forfeiter with no credits.
      const rows = await prisma.battleParticipant.findMany({ where: { robotId: p.unarmed.robotId } });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ forfeited: true, credits: 0, damageDealt: 0 });
    }
    expect(armedCheck.mock.results.every((r) => r.type === 'return')).toBe(true);
    // 3. Every payment in the cycle (fought, forfeit win) is a complete ledger + audit pair.
    const paid = await expectCompleteFinancialPairs(userIds);
    expect(paid).toBeGreaterThan(0);
    const forfeitWins = await prisma.financialLedger.count({
      where: { userId: { in: userIds }, transactionType: 'battle_income', financialEventId: { startsWith: 'forfeit:' } },
    });
    // One forfeit win per two-sided mode; KotH/GM forfeiters give nobody a walkover.
    expect(forfeitWins).toBe(7);
  });
});
