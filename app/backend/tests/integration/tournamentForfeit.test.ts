/**
 * T8 / T9 / T10 / T8-R6 — battle-time forfeits in knockout tournaments
 * (design §5.4, §5.5; rules 1, 2, 3, 5 and 6; A3). Real database.
 *
 * Per mode: build a bracket with armed entrants, take a weapon away the way a
 * player would (`unequipMainWeapon` / `unequipOffhandWeapon`), then run the
 * mode's round executor.
 *
 * - T8: one side has a robot without a main weapon → that side forfeits and is
 *   eliminated. The bracket row is `forfeit` with the ready side as winner; the
 *   ready stable is paid the bye-level tournament reward exactly once (ledger +
 *   financial_transaction pair, `forfeit:` identity); the forfeiter earns 0; ELO
 *   moves as a normal win/loss; no standings; HP unchanged.
 * - T9: both sides unready → the battle row is a draw (no winner, no ledger),
 *   and only `tournament_matches.winnerId` names the higher seed, who advances.
 * - T10: rerun / concurrent resolution → one battle, one ledger row.
 * - T8-R6: an incomplete loadout (dual_wield without offhand) fights as single,
 *   the stored loadout is unchanged, one `[Battle] Loadout fallback` warn.
 * - T9b (team modes): roster/subscription forfeits use the same writer, decided
 *   per side together with weapon readiness (`decideTeamTournamentEntry`);
 *   linked fought battles resume before the entry gate; the
 *   `processTeamTournamentBattle` backstop forfeits instead of simulating.
 */
import prisma from '../../src/lib/prisma';
import logger from '../../src/config/logger';
import type { ScheduledTournamentMatch } from '../../generated/prisma';
import { advanceWinnersToNextRound, computeSeedings } from '../../src/services/tournament/tournamentService';
import {
  executeSoloTournamentRound,
  processTournamentBattle,
} from '../../src/services/tournament/tournamentBattleOrchestrator';
import {
  executeTeamTournamentRound,
  processTeamTournamentBattle,
} from '../../src/services/tournament/teamTournamentBattleOrchestrator';
import * as teamBattleEngine from '../../src/services/team-battle/teamBattleEngine';
import * as battlePostCombat from '../../src/services/battle/battlePostCombat';
import { calculateTeamBattleELOChanges } from '../../src/services/team-battle/teamBattleRewardService';
import { getMatchHistory } from '../../src/services/match/matchHistoryService';
import { unequipMainWeapon, unequipOffhandWeapon } from '../../src/services/robot/robotWeaponService';
import { buildForfeitBattleIncomeEventId } from '../../src/services/financial/financialEventIdentity';
import { resolveByeReward, type TournamentByeMode } from '../../src/utils/byeRewards';
import { calculateELOChange } from '../../src/utils/battleMath';
import { battlesForRobots } from '../cleanupHelper';
import { useFinancialCaptureTestEnvironment } from '../financialCaptureTestHelper';
import { subscribeTeamMembers } from '../helpers/subscriptions';

useFinancialCaptureTestEnvironment();

const RUN = `tff${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

const userIds: number[] = [];
const robotIds: number[] = [];
const teamIds: number[] = [];
const tournamentIds: number[] = [];
let weaponId: number;
let counter = 0;
const next = (): number => ++counter;

type Loadout = 'single' | 'dual_wield';

interface Entrant {
  /** Bracket participant id: a robot id (solo) or a team id (team). */
  id: number;
  robots: number[];
  stableId: number;
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

async function armedRobot(userId: number, elo: number, loadout: Loadout = 'single'): Promise<number> {
  const main = await prisma.weaponInventory.create({ data: { userId, weaponId, pricePaid: 0 } });
  const offhand = loadout === 'dual_wield'
    ? await prisma.weaponInventory.create({ data: { userId, weaponId, pricePaid: 0 } })
    : null;
  const robot = await prisma.robot.create({
    data: {
      userId, name: `${RUN}_r${next()}`, elo, currentHP: 100, maxHP: 100, currentShield: 20, maxShield: 20,
      yieldThreshold: 20, loadoutType: loadout, mainWeaponId: main.id, offhandWeaponId: offhand?.id ?? null,
    },
  });
  robotIds.push(robot.id);
  return robot.id;
}

// ── Mode table (4.2 extends it with the team modes) ──────────────────

interface ModeCase {
  mode: TournamentByeMode;
  /** Robot index on a side to make unready (team modes: not slot 0, so the rule is "any member"). */
  unreadyIndex: number;
  createEntrant(elo: number, loadouts?: Loadout[]): Promise<Entrant>;
  createTournament(totalParticipants: number, maxRounds: number): Promise<number>;
  participantType: string;
  run(tournamentId: number): Promise<unknown>;
  forfeitsReported(result: unknown): number;
  /** Resolve one match directly from a (possibly stale) row, as a second executor would. */
  resolveOnce(row: ScheduledTournamentMatch): Promise<unknown>;
  expectedElo(side1: Array<{ id: number; elo: number }>, side2: Array<{ id: number; elo: number }>, forfeitingSides: Array<1 | 2>): Record<number, number>;
  /** Whether the battle row carries `winningSide` for a single forfeit. */
  usesWinningSide: boolean;
}

async function createTournamentRow(participantType: string, totalParticipants: number, maxRounds: number): Promise<number> {
  const tournament = await prisma.tournament.create({
    data: {
      name: `${RUN} ${participantType} ${next()}`, tournamentType: 'single_elimination', participantType, status: 'active',
      currentRound: 1, maxRounds, totalParticipants,
    },
  });
  tournamentIds.push(tournament.id);
  return tournament.id;
}

const soloCase: ModeCase = {
  mode: 'tournament_1v1',
  unreadyIndex: 0,
  participantType: 'robot',
  async createEntrant(elo, loadouts = ['single']) {
    const stableId = await createStable();
    const id = await armedRobot(stableId, elo, loadouts[0]);
    return { id, robots: [id], stableId };
  },
  createTournament: (total, maxRounds) => createTournamentRow('robot', total, maxRounds),
  run: (tournamentId) => executeSoloTournamentRound(tournamentId),
  forfeitsReported: (result) => (result as { forfeits: number }).forfeits,
  resolveOnce: (row) => processTournamentBattle(row),
  expectedElo([r1], [r2], forfeitingSides) {
    if (forfeitingSides.length === 2) {
      const c = calculateELOChange(r1.elo, r2.elo, true);
      return { [r1.id]: r1.elo + c.winnerChange, [r2.id]: r2.elo + c.loserChange };
    }
    const [ready, forfeiter] = forfeitingSides[0] === 2 ? [r1, r2] : [r2, r1];
    const c = calculateELOChange(ready.elo, forfeiter.elo, false);
    return { [ready.id]: ready.elo + c.winnerChange, [forfeiter.id]: forfeiter.elo + c.loserChange };
  },
  usesWinningSide: false,
};

/** Every member moves by its team's change (the fought convention). */
function teamElo(
  side1: Array<{ id: number; elo: number }>,
  side2: Array<{ id: number; elo: number }>,
  forfeitingSides: Array<1 | 2>,
): Record<number, number> {
  const sum = (rs: Array<{ elo: number }>) => rs.reduce((acc, r) => acc + r.elo, 0);
  const isDraw = forfeitingSides.length === 2;
  const changes = calculateTeamBattleELOChanges(sum(side1), sum(side2), !isDraw && forfeitingSides[0] === 2, isDraw);
  return Object.fromEntries([
    ...side1.map((r) => [r.id, r.elo + changes.team1Change]),
    ...side2.map((r) => [r.id, r.elo + changes.team2Change]),
  ]);
}

interface TeamModeCase extends ModeCase {
  teamSize: 2 | 3;
}

function teamCase(teamSize: 2 | 3): TeamModeCase {
  const mode = teamSize === 2 ? 'tournament_2v2' : 'tournament_3v3';
  const participantType = teamSize === 2 ? 'team_2v2' : 'team_3v3';
  return {
    mode,
    teamSize,
    // Any member: the second one, so the rule is not "slot 0 only".
    unreadyIndex: 1,
    participantType,
    async createEntrant(elo, loadouts = []) {
      const stableId = await createStable();
      const robots: number[] = [];
      for (let i = 0; i < teamSize; i++) robots.push(await armedRobot(stableId, elo, loadouts[i] ?? 'single'));
      const team = await prisma.teamBattle.create({
        data: {
          stableId, teamSize, teamName: `${RUN}_t${next()}`.slice(0, 32),
          members: { create: robots.map((robotId, slotIndex) => ({ robotId, slotIndex })) },
        },
      });
      teamIds.push(team.id);
      await subscribeTeamMembers([team.id], mode);
      return { id: team.id, robots, stableId };
    },
    createTournament: (total, maxRounds) => createTournamentRow(participantType, total, maxRounds),
    run: (tournamentId) => executeTeamTournamentRound(tournamentId, teamSize),
    forfeitsReported: (result) => (result as { matchesForfeited: number }).matchesForfeited,
    // processTeamTournamentBattle directly: its own readiness backstop resolves the forfeit.
    resolveOnce: async (row) =>
      processTeamTournamentBattle(row, await prisma.tournament.findUniqueOrThrow({ where: { id: row.tournamentId } })),
    expectedElo: teamElo,
    usesWinningSide: true,
  };
}

const TEAM_CASES: TeamModeCase[] = [teamCase(2), teamCase(3)];
const MODE_CASES: ModeCase[] = [soloCase, ...TEAM_CASES];

/**
 * A bracket. `pairs` lists round-1 matches by seed (1-based); later rounds get
 * empty placeholder rows. In the 4-slot standard order match 1 is seed 1 v
 * seed 4 and match 2 is seed 3 v seed 2, so the higher seed of match 2 is
 * participant 2.
 */
async function createBracket(
  c: ModeCase,
  entrants: Entrant[],
  pairs: Array<[number, number]>,
  maxRounds: number,
): Promise<{ tournamentId: number; round1: number[] }> {
  const tournamentId = await c.createTournament(entrants.length, maxRounds);
  const round1: number[] = [];
  for (let i = 0; i < pairs.length; i++) {
    const [a, b] = pairs[i];
    const row = await prisma.scheduledTournamentMatch.create({
      data: {
        tournamentId, round: 1, matchNumber: i + 1, participantType: c.participantType,
        participant1Id: entrants[a - 1].id, participant2Id: entrants[b - 1].id, isByeMatch: false,
      },
    });
    round1.push(row.id);
  }
  for (let round = 2; round <= maxRounds; round++) {
    for (let m = 1; m <= 2 ** (maxRounds - round); m++) {
      await prisma.scheduledTournamentMatch.create({ data: { tournamentId, round, matchNumber: m, participantType: c.participantType } });
    }
  }
  return { tournamentId, round1 };
}

async function entrantsFor(c: ModeCase, count: number, loadouts?: Loadout[]): Promise<Entrant[]> {
  const list: Entrant[] = [];
  for (let i = 0; i < count; i++) list.push(await c.createEntrant(1600 - i * 25, i === 0 ? loadouts : undefined));
  return list;
}

/** Unequip the side's chosen robot, as a player would. */
async function disarm(c: ModeCase, entrant: Entrant): Promise<number> {
  const robotId = entrant.robots[c.unreadyIndex];
  await unequipMainWeapon(entrant.stableId, robotId);
  return robotId;
}

// ── Assertion helpers ────────────────────────────────────────────────

async function robotSnapshot(ids: number[]) {
  return prisma.robot.findMany({
    where: { id: { in: ids } },
    select: { id: true, elo: true, currentHP: true, fame: true, loadoutType: true, dualWieldWins: true, wins: true, losses: true, draws: true, totalBattles: true },
    orderBy: { id: 'asc' },
  });
}

async function prestigeOf(userIdList: number[]): Promise<number[]> {
  const users = await prisma.user.findMany({ where: { id: { in: userIdList } }, orderBy: { id: 'asc' }, select: { prestige: true } });
  return users.map((u) => u.prestige);
}

async function battlesFor(robots: number[]) {
  return prisma.battle.findMany({ where: battlesForRobots(robots), include: { participants: true } });
}

async function standingRowsFor(entrants: Entrant[]): Promise<number> {
  return prisma.standing.count({
    where: {
      OR: [
        { entityType: 'robot', entityId: { in: entrants.flatMap((e) => e.robots) } },
        { entityType: 'team', entityId: { in: entrants.map((e) => e.id) } },
      ],
    },
  });
}

/** Elimination per the bracket's terminal rows (computeSeedings owns the rule). */
async function eliminated(tournamentId: number): Promise<Map<number, boolean>> {
  const tournament = await prisma.tournament.findUniqueOrThrow({ where: { id: tournamentId }, include: { matches: true } });
  const round1 = tournament.matches
    .filter((m) => m.round === 1)
    .sort((a, b) => a.matchNumber - b.matchNumber)
    .map((m) => ({
      matchNumber: m.matchNumber,
      participant1Id: m.participant1Id,
      participant2Id: m.participant2Id,
      robot1: m.participant1Id === null ? null : { id: m.participant1Id, name: `p${m.participant1Id}`, elo: 0 },
      robot2: m.participant2Id === null ? null : { id: m.participant2Id, name: `p${m.participant2Id}`, elo: 0 },
    }));
  const seedings = computeSeedings(round1, 2 ** tournament.maxRounds, tournament.matches);
  return new Map(seedings.map((s) => [s.robotId, s.eliminated]));
}

// ── Lifecycle ────────────────────────────────────────────────────────

beforeAll(async () => {
  const weapon = await prisma.weapon.findFirst({ where: { handsRequired: 'one' }, orderBy: { id: 'asc' } });
  if (!weapon) throw new Error('No one-handed weapon seeded');
  weaponId = weapon.id;
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  await prisma.scheduledTournamentMatch.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
  await prisma.battle.deleteMany({ where: battlesForRobots(robotIds) });
  await prisma.battle.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
  await prisma.tournament.deleteMany({ where: { id: { in: tournamentIds } } });
  await prisma.financialLedger.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.auditLog.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { robotId: { in: robotIds } }] } });
  await prisma.subscription.deleteMany({ where: { robotId: { in: robotIds } } });
  await prisma.teamBattleMember.deleteMany({ where: { teamId: { in: teamIds } } });
  await prisma.teamBattle.deleteMany({ where: { id: { in: teamIds } } });
  await prisma.robot.deleteMany({ where: { id: { in: robotIds } } });
  await prisma.weaponInventory.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
});

// ── The cases ────────────────────────────────────────────────────────

describe.each(MODE_CASES.map((c) => [c.mode, c] as const))('%s battle-time forfeits', (_mode, c) => {
  it('T8: an unarmed robot forfeits and is eliminated; the winner is paid the bye-level reward once', async () => {
    const e = await entrantsFor(c, 4);
    const { tournamentId, round1 } = await createBracket(c, e, [[1, 4], [3, 2]], 2);
    // Match 1: seed 1 (ready, side 1) v seed 4 (unarmed, side 2).
    const [ready, forfeiter] = [e[0], e[3]];
    await disarm(c, forfeiter);

    const matchRobots = [...ready.robots, ...forfeiter.robots];
    const before = await robotSnapshot(matchRobots);
    const prestigeBefore = await prestigeOf([ready.stableId, forfeiter.stableId]);

    const result = await c.run(tournamentId);
    expect(c.forfeitsReported(result)).toBe(1);

    const row = await prisma.scheduledTournamentMatch.findUniqueOrThrow({ where: { id: round1[0] } });
    expect(row).toMatchObject({ status: 'forfeit', winnerId: ready.id });
    expect(row.battleId).not.toBeNull();
    expect(row.completedAt).not.toBeNull();

    const battles = await battlesFor(matchRobots);
    expect(battles).toHaveLength(1);
    const battle = battles[0];
    expect(battle.id).toBe(row.battleId);
    // Proof the robot never entered the simulator (which would throw
    // ROBOT_NOT_BATTLE_READY for it): no combat at all.
    expect(battle.participants.every((p) => p.damageDealt === 0)).toBe(true);
    expect(battle).toMatchObject({ battleType: c.mode, leagueType: 'tournament', tournamentId, tournamentRound: 1, durationSeconds: 15 });
    expect(battle.winnerId).toBe(ready.id);
    expect(battle.winningSide).toBe(c.usesWinningSide ? 1 : null);

    expect(battle.participants.map((p) => p.robotId).sort()).toEqual([...matchRobots].sort());
    for (const p of battle.participants) {
      expect(p.forfeited).toBe(forfeiter.robots.includes(p.robotId));
      expect(p.team).toBe(ready.robots.includes(p.robotId) ? 1 : 2);
      expect(p.streamingRevenue).toBe(0);
      expect(p.prestigeAwarded).toBe(0);
      expect(p.fameAwarded).toBe(0);
    }

    // Exactly one ledger + audit pair, for the ready stable, with the forfeit identity.
    const reward = resolveByeReward({ mode: c.mode, totalParticipants: 4, currentRound: 1, maxRounds: 2 });
    const eventId = buildForfeitBattleIncomeEventId(round1[0], ready.stableId, c.mode);
    const ledger = await prisma.financialLedger.findMany({ where: { userId: { in: [ready.stableId, forfeiter.stableId] } } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ userId: ready.stableId, transactionType: 'battle_income', amount: reward.credits, financialEventId: eventId });
    expect(ledger[0].metadata).toMatchObject({ outcome: 'forfeit_win', isBye: true, mode: c.mode, tier: 'tournament_round', battleId: battle.id });
    expect(await prisma.auditLog.count({ where: { eventType: 'financial_transaction', financialEventId: eventId } })).toBe(1);

    // Owner allocation equals the ledger amount; the forfeiter earns nothing.
    const readyCredits = battle.participants.filter((p) => ready.robots.includes(p.robotId)).reduce((s, p) => s + p.credits, 0);
    expect(readyCredits).toBe(reward.credits);
    expect(battle.participants.filter((p) => forfeiter.robots.includes(p.robotId)).every((p) => p.credits === 0)).toBe(true);

    // Tournaments write no standings, fought or forfeited.
    expect(await standingRowsFor([ready, forfeiter])).toBe(0);

    // ELO mirrored with the mode's formula; HP, fame and prestige untouched.
    const b = new Map(before.map((r) => [r.id, r]));
    const expectedElo = c.expectedElo(
      ready.robots.map((id) => ({ id, elo: b.get(id)!.elo })),
      forfeiter.robots.map((id) => ({ id, elo: b.get(id)!.elo })),
      [2],
    );
    for (const r of await robotSnapshot(matchRobots)) {
      expect(r.elo).toBe(expectedElo[r.id]);
      expect(r.currentHP).toBe(b.get(r.id)!.currentHP);
      expect(r.fame).toBe(b.get(r.id)!.fame);
      expect(r.totalBattles).toBe(b.get(r.id)!.totalBattles + 1);
      expect(r.wins).toBe(b.get(r.id)!.wins + (ready.robots.includes(r.id) ? 1 : 0));
      expect(r.losses).toBe(b.get(r.id)!.losses + (forfeiter.robots.includes(r.id) ? 1 : 0));
    }
    expect(await prestigeOf([ready.stableId, forfeiter.stableId])).toEqual(prestigeBefore);

    // The forfeiter is out; the ready side plays the final.
    await advanceWinnersToNextRound(tournamentId);
    const final = await prisma.scheduledTournamentMatch.findFirstOrThrow({ where: { tournamentId, round: 2 } });
    expect(final.participant1Id).toBe(ready.id);
    expect([final.participant1Id, final.participant2Id]).not.toContain(forfeiter.id);
    const out = await eliminated(tournamentId);
    expect(out.get(forfeiter.id)).toBe(true);
    expect(out.get(ready.id)).toBe(false);
  });

  it('T9: both sides unready is a draw battle; the higher seed advances with no credits', async () => {
    const e = await entrantsFor(c, 4);
    const { tournamentId, round1 } = await createBracket(c, e, [[1, 4], [3, 2]], 2);
    // Match 2: seed 3 (participant 1) v seed 2 (participant 2, the higher seed).
    const [lower, higher] = [e[2], e[1]];
    await disarm(c, lower);
    await disarm(c, higher);

    const matchRobots = [...lower.robots, ...higher.robots];
    const before = await robotSnapshot(matchRobots);
    await c.run(tournamentId);

    const row = await prisma.scheduledTournamentMatch.findUniqueOrThrow({ where: { id: round1[1] } });
    expect(row).toMatchObject({ status: 'forfeit', winnerId: higher.id });

    const battles = await battlesFor(matchRobots);
    expect(battles).toHaveLength(1);
    expect(battles[0]).toMatchObject({ id: row.battleId, winnerId: null, winningSide: null, winnerReward: 0, loserReward: 0 });
    expect(battles[0].participants.every((p) => p.forfeited && p.credits === 0)).toBe(true);
    expect(await prisma.financialLedger.count({ where: { userId: { in: [lower.stableId, higher.stableId] } } })).toBe(0);

    // A draw everywhere: robot counters, draw ELO and every audit row.
    const b = new Map(before.map((r) => [r.id, r]));
    const expectedElo = c.expectedElo(
      lower.robots.map((id) => ({ id, elo: b.get(id)!.elo })),
      higher.robots.map((id) => ({ id, elo: b.get(id)!.elo })),
      [1, 2],
    );
    for (const r of await robotSnapshot(matchRobots)) {
      expect(r.elo).toBe(expectedElo[r.id]);
      expect(r.draws).toBe(b.get(r.id)!.draws + 1);
      expect(r.wins).toBe(b.get(r.id)!.wins);
      expect(r.currentHP).toBe(b.get(r.id)!.currentHP);
    }
    const audits = await prisma.auditLog.findMany({ where: { eventType: 'battle_complete', battleId: battles[0].id } });
    expect(audits).toHaveLength(matchRobots.length);
    expect(audits.every((a) => (a.payload as { result?: string }).result === 'draw')).toBe(true);

    await advanceWinnersToNextRound(tournamentId);
    const final = await prisma.scheduledTournamentMatch.findFirstOrThrow({ where: { tournamentId, round: 2 } });
    expect(final.participant2Id).toBe(higher.id);
    const out = await eliminated(tournamentId);
    expect(out.get(lower.id)).toBe(true);
    expect(out.get(higher.id)).toBe(false);
  });

  it('T10: reruns and concurrent resolution write one battle and one ledger row', async () => {
    // Sequential: resolve twice from the same stale row, then rerun the round.
    const a = await entrantsFor(c, 2);
    const seq = await createBracket(c, a, [[1, 2]], 1);
    await disarm(c, a[1]);
    const staleSeq = await prisma.scheduledTournamentMatch.findUniqueOrThrow({ where: { id: seq.round1[0] } });
    await c.resolveOnce(staleSeq);
    await c.resolveOnce(staleSeq);
    await c.run(seq.tournamentId);
    expect(await battlesFor([...a[0].robots, ...a[1].robots])).toHaveLength(1);
    expect(await prisma.financialLedger.count({ where: { userId: a[0].stableId } })).toBe(1);

    // Concurrent: two resolutions race for the same claim.
    const b = await entrantsFor(c, 2);
    const race = await createBracket(c, b, [[1, 2]], 1);
    await disarm(c, b[1]);
    const staleRace = await prisma.scheduledTournamentMatch.findUniqueOrThrow({ where: { id: race.round1[0] } });
    await Promise.all([c.resolveOnce(staleRace), c.resolveOnce(staleRace)]);
    expect(await battlesFor([...b[0].robots, ...b[1].robots])).toHaveLength(1);
    expect(await prisma.financialLedger.count({ where: { userId: b[0].stableId } })).toBe(1);
    expect(await prisma.financialLedger.count({ where: { userId: b[1].stableId } })).toBe(0);
    expect(await prisma.scheduledTournamentMatch.findUniqueOrThrow({ where: { id: race.round1[0] } }))
      .toMatchObject({ status: 'forfeit', winnerId: b[0].id });
  });

  it('T8-R6: an incomplete loadout fights as single; the stored loadout is unchanged', async () => {
    const e = await entrantsFor(c, 2, ['dual_wield', 'single', 'single']);
    const { tournamentId, round1 } = await createBracket(c, e, [[1, 2]], 1);
    const incomplete = e[0].robots[0];
    await unequipOffhandWeapon(e[0].stableId, incomplete);
    const [before] = await robotSnapshot([incomplete]);
    const warn = jest.spyOn(logger, 'warn');

    const result = await c.run(tournamentId);

    expect(c.forfeitsReported(result)).toBe(0);
    const battles = await battlesFor([...e[0].robots, ...e[1].robots]);
    expect(battles).toHaveLength(1);
    expect(battles[0].participants.every((p) => !p.forfeited)).toBe(true);
    expect(battles[0].durationSeconds).toBeGreaterThan(0);
    const fallbackLogs = (warn.mock.calls as unknown as unknown[][]).filter((call) => call[0] === '[Battle] Loadout fallback');
    expect(fallbackLogs).toHaveLength(1);
    expect(fallbackLogs[0][1]).toMatchObject({ matchId: round1[0], robotId: incomplete, storedLoadout: 'dual_wield', battleLoadout: 'single' });

    const [after] = await robotSnapshot([incomplete]);
    expect(after.loadoutType).toBe('dual_wield');
    expect(after.dualWieldWins).toBe(before.dualWieldWins);
    expect(after.totalBattles).toBe(before.totalBattles + 1);
    expect((await prisma.scheduledTournamentMatch.findUniqueOrThrow({ where: { id: round1[0] } })).status).toBe('completed');
  });
});

// ── T9b: team tournament roster forfeits share the writer (A5, §5.5) ──

/** Fight a team match up to its battle link, then stop: the first income award throws. */
async function linkFoughtBattle(matchId: number): Promise<number> {
  const row = await prisma.scheduledTournamentMatch.findUniqueOrThrow({ where: { id: matchId } });
  const tournament = await prisma.tournament.findUniqueOrThrow({ where: { id: row.tournamentId } });
  jest.spyOn(battlePostCombat, 'awardCreditsWithLedger').mockRejectedValueOnce(new Error('injected crash after link'));
  await expect(processTeamTournamentBattle(row, tournament)).rejects.toThrow('injected crash after link');
  jest.restoreAllMocks();
  const linked = await prisma.scheduledTournamentMatch.findUniqueOrThrow({ where: { id: matchId } });
  expect(linked.status).toBe('scheduled');
  expect(linked.battleId).not.toBeNull();
  return linked.battleId!;
}

describe.each(TEAM_CASES.map((c) => [c.mode, c] as const))('%s roster forfeits (T9b)', (_mode, c) => {
  const sumElo = (rows: Array<{ elo: number }>) => rows.reduce((s, r) => s + r.elo, 0);

  it('(a) a deleted forfeiting team: only the ready side is written and paid; history shows a forfeit', async () => {
    const e = await entrantsFor(c, 4);
    const { tournamentId, round1 } = await createBracket(c, e, [[1, 4], [3, 2]], 2);
    const [ready, gone] = [e[0], e[3]];
    await prisma.teamBattle.delete({ where: { id: gone.id } });
    const before = await robotSnapshot([...ready.robots, ...gone.robots]);

    const result = await c.run(tournamentId);
    expect(c.forfeitsReported(result)).toBe(1);

    const row = await prisma.scheduledTournamentMatch.findUniqueOrThrow({ where: { id: round1[0] } });
    expect(row).toMatchObject({ status: 'forfeit', winnerId: ready.id });
    const battle = await prisma.battle.findUniqueOrThrow({ where: { id: row.battleId! }, include: { participants: true } });
    expect(battle).toMatchObject({ winnerId: ready.id, winningSide: 1 });
    expect(battle.participants.map((p) => p.robotId).sort()).toEqual([...ready.robots].sort());
    expect(battle.participants.every((p) => !p.forfeited)).toBe(true);

    const reward = resolveByeReward({ mode: c.mode, totalParticipants: 4, currentRound: 1, maxRounds: 2 });
    const ledger = await prisma.financialLedger.findMany({ where: { userId: { in: [ready.stableId, gone.stableId] } } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({
      userId: ready.stableId,
      amount: reward.credits,
      financialEventId: buildForfeitBattleIncomeEventId(round1[0], ready.stableId, c.mode),
    });

    // Equal strength: a missing forfeiter roster counts as the ready team's sum.
    const b = new Map(before.map((r) => [r.id, r]));
    const readySum = sumElo(ready.robots.map((id) => b.get(id)!));
    const change = calculateTeamBattleELOChanges(readySum, readySum, true, false).team1Change;
    for (const r of await robotSnapshot([...ready.robots, ...gone.robots])) {
      expect(r.elo).toBe(b.get(r.id)!.elo + (ready.robots.includes(r.id) ? change : 0));
      if (gone.robots.includes(r.id)) expect(r.totalBattles).toBe(b.get(r.id)!.totalBattles);
    }

    // No opponent row: the tournament_matches.status='forfeit' lookup classifies it.
    const history = await getMatchHistory({ page: 1, perPage: 50, userId: ready.stableId });
    const entry = history.data.find((h) => (h as { id: number }).id === battle.id) as unknown as { isForfeit: boolean } | undefined;
    expect(entry?.isForfeit).toBe(true);
  });

  it('(b) a short forfeiting team: its loaded members take the loss', async () => {
    const e = await entrantsFor(c, 4);
    const { tournamentId, round1 } = await createBracket(c, e, [[1, 4], [3, 2]], 2);
    const [ready, short] = [e[0], e[3]];
    const removed = short.robots[1];
    await prisma.teamBattleMember.deleteMany({ where: { teamId: short.id, robotId: removed } });
    const loaded = short.robots.filter((id) => id !== removed);
    const before = await robotSnapshot([...ready.robots, ...short.robots]);

    await c.run(tournamentId);

    const row = await prisma.scheduledTournamentMatch.findUniqueOrThrow({ where: { id: round1[0] } });
    expect(row).toMatchObject({ status: 'forfeit', winnerId: ready.id });
    const battle = await prisma.battle.findUniqueOrThrow({ where: { id: row.battleId! }, include: { participants: true } });
    expect(battle.participants.map((p) => p.robotId).sort()).toEqual([...ready.robots, ...loaded].sort());
    for (const p of battle.participants) expect(p.forfeited).toBe(loaded.includes(p.robotId));

    const b = new Map(before.map((r) => [r.id, r]));
    const readySum = sumElo(ready.robots.map((id) => b.get(id)!));
    const changes = calculateTeamBattleELOChanges(readySum, readySum, true, false);
    for (const r of await robotSnapshot([...ready.robots, ...short.robots])) {
      const prev = b.get(r.id)!;
      if (ready.robots.includes(r.id)) expect(r.elo).toBe(prev.elo + changes.team1Change);
      if (loaded.includes(r.id)) {
        expect(r.elo).toBe(prev.elo + changes.team2Change);
        expect(r.losses).toBe(prev.losses + 1);
      }
      if (r.id === removed) expect(r).toEqual(prev);
    }
  });

  it('(c) both teams deleted: housekeeping, no battle', async () => {
    const e = await entrantsFor(c, 4);
    const { tournamentId, round1 } = await createBracket(c, e, [[1, 4], [3, 2]], 2);
    await prisma.teamBattle.deleteMany({ where: { id: { in: [e[0].id, e[3].id] } } });

    await c.run(tournamentId);

    const row = await prisma.scheduledTournamentMatch.findUniqueOrThrow({ where: { id: round1[0] } });
    expect(row).toMatchObject({ status: 'completed', winnerId: null, battleId: null });
    expect(await battlesFor([...e[0].robots, ...e[3].robots])).toHaveLength(0);
    expect(await prisma.financialLedger.count({ where: { userId: { in: [e[0].stableId, e[3].stableId] } } })).toBe(0);
  });

  it('(d) a linked fought battle whose team then loses its subscription resumes, never forfeits', async () => {
    const e = await entrantsFor(c, 2);
    const { tournamentId, round1 } = await createBracket(c, e, [[1, 2]], 1);
    const battleId = await linkFoughtBattle(round1[0]);
    await prisma.subscription.deleteMany({ where: { robotId: { in: e[1].robots } } });

    const result = await c.run(tournamentId);

    expect(result).toMatchObject({ matchesResumed: 1, matchesForfeited: 0, matchesCancelled: 0 });
    const battle = await prisma.battle.findUniqueOrThrow({ where: { id: battleId } });
    const row = await prisma.scheduledTournamentMatch.findUniqueOrThrow({ where: { id: round1[0] } });
    expect(row).toMatchObject({ status: 'completed', battleId, winnerId: battle.winnerId });
    expect(await battlesFor([...e[0].robots, ...e[1].robots])).toHaveLength(1);
    expect(await prisma.financialLedger.count({ where: { transactionType: 'battle_income', financialEventId: { startsWith: `battle:${battleId}:` } } }))
      .toBe(c.teamSize * 2);

    await advanceWinnersToNextRound(tournamentId);
    expect(await prisma.tournament.findUniqueOrThrow({ where: { id: tournamentId } }))
      .toMatchObject({ status: 'completed', winnerId: battle.winnerId });
  });

  it('(d2) a linked fought battle whose team then loses a member is finalised with the linked winner', async () => {
    const e = await entrantsFor(c, 2);
    const { tournamentId, round1 } = await createBracket(c, e, [[1, 2]], 1);
    const battleId = await linkFoughtBattle(round1[0]);
    await prisma.teamBattleMember.deleteMany({ where: { teamId: e[1].id, robotId: e[1].robots[1] } });

    const result = await c.run(tournamentId);

    expect(result).toMatchObject({ matchesResumed: 0, matchesForfeited: 0, matchesCancelled: 1 });
    const battle = await prisma.battle.findUniqueOrThrow({ where: { id: battleId } });
    const row = await prisma.scheduledTournamentMatch.findUniqueOrThrow({ where: { id: round1[0] } });
    expect(row).toMatchObject({ status: 'completed', battleId, winnerId: battle.winnerId });
    expect(await battlesFor([...e[0].robots, ...e[1].robots])).toHaveLength(1);

    await advanceWinnersToNextRound(tournamentId);
    expect(await prisma.tournament.findUniqueOrThrow({ where: { id: tournamentId } }))
      .toMatchObject({ status: 'completed', winnerId: battle.winnerId });
  });

  it('(e) subscription-ineligible B and unarmed-member A: double forfeit, higher seed advances, no ledger', async () => {
    const e = await entrantsFor(c, 4);
    const { tournamentId, round1 } = await createBracket(c, e, [[1, 4], [3, 2]], 2);
    // Match 2: B = seed 3 (participant 1), A = seed 2 (participant 2, the higher seed).
    const [teamB, teamA] = [e[2], e[1]];
    await prisma.subscription.deleteMany({ where: { robotId: { in: teamB.robots } } });
    await disarm(c, teamA);

    const result = await c.run(tournamentId);
    expect(c.forfeitsReported(result)).toBe(1);

    const row = await prisma.scheduledTournamentMatch.findUniqueOrThrow({ where: { id: round1[1] } });
    expect(row).toMatchObject({ status: 'forfeit', winnerId: teamA.id });
    const battle = await prisma.battle.findUniqueOrThrow({ where: { id: row.battleId! }, include: { participants: true } });
    expect(battle).toMatchObject({ winnerId: null, winningSide: null });
    expect(battle.participants.map((p) => p.robotId).sort()).toEqual([...teamB.robots, ...teamA.robots].sort());
    expect(battle.participants.every((p) => p.forfeited && p.credits === 0)).toBe(true);
    expect(await prisma.financialLedger.count({ where: { userId: { in: [teamA.stableId, teamB.stableId] } } })).toBe(0);

    await advanceWinnersToNextRound(tournamentId);
    const final = await prisma.scheduledTournamentMatch.findFirstOrThrow({ where: { tournamentId, round: 2 } });
    expect(final.participant2Id).toBe(teamA.id);
  });

  it('backstop: unequipped after the entry decision, processTeamTournamentBattle forfeits without simulating', async () => {
    const e = await entrantsFor(c, 2);
    const { round1 } = await createBracket(c, e, [[1, 2]], 1);
    const row = await prisma.scheduledTournamentMatch.findUniqueOrThrow({ where: { id: round1[0] } });
    const tournament = await prisma.tournament.findUniqueOrThrow({ where: { id: row.tournamentId } });
    await disarm(c, e[1]);
    const simulate = jest.spyOn(teamBattleEngine, 'simulateTeamBattle');

    const result = await processTeamTournamentBattle(row, tournament);

    expect(simulate).not.toHaveBeenCalled();
    expect(result).toMatchObject({ isForfeit: true, winnerId: e[0].id, isByeMatch: false });
    const after = await prisma.scheduledTournamentMatch.findUniqueOrThrow({ where: { id: round1[0] } });
    expect(after).toMatchObject({ status: 'forfeit', winnerId: e[0].id, battleId: result.battleId });
    const battle = await prisma.battle.findUniqueOrThrow({ where: { id: result.battleId }, include: { participants: true } });
    for (const p of battle.participants) expect(p.forfeited).toBe(e[1].robots.includes(p.robotId));
    expect(await prisma.financialLedger.count({ where: { userId: e[0].stableId } })).toBe(1);
    expect(await prisma.financialLedger.count({ where: { userId: e[1].stableId } })).toBe(0);
  });
});
