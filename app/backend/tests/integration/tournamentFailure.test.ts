/**
 * T15 — knockout tournaments under the failure policy (rule 5, rule 7, R1).
 *
 * Real database, solo (`executeSoloTournamentRound`) and team 2v2
 * (`executeTeamTournamentRound`):
 * - R1: a match that throws before any battle is linked becomes `cancelled`
 *   with the higher seed as `winnerId`. No battle, ledger/audit pair, ELO or
 *   stat change; the higher seed plays on, and an errored final crowns it.
 * - Byes: a bye whose resolution throws (or, solo, returns false) still
 *   advances its sole participant; the row never stays `pending`.
 * - Linked fought battle: (i) the first income award throws once → the in-run
 *   resume pays every component exactly once and completes the row; (ii) it
 *   throws on both attempts → the row is finalised with the battle's winner,
 *   the bracket advances that winner, and the §11 fought-battle signature
 *   finds the unpaid battle.
 */
import prisma from '../../src/lib/prisma';
import logger from '../../src/config/logger';
import * as simulationLoop from '../../src/services/battle/combat-simulator/simulationLoop';
import * as teamBattleEngine from '../../src/services/team-battle/teamBattleEngine';
import * as battlePostCombat from '../../src/services/battle/battlePostCombat';
import * as tournamentService from '../../src/services/tournament/tournamentService';
import { advanceWinnersToNextRound } from '../../src/services/tournament/tournamentService';
import { executeSoloTournamentRound } from '../../src/services/tournament/tournamentBattleOrchestrator';
import { executeTeamTournamentRound } from '../../src/services/tournament/teamTournamentBattleOrchestrator';
import { buildBattleIncomeEventId } from '../../src/services/financial/financialEventIdentity';
import { battlesForRobots } from '../cleanupHelper';
import { useFinancialCaptureTestEnvironment } from '../financialCaptureTestHelper';
import { subscribeTeamMembers } from '../helpers/subscriptions';
import { findFoughtBattlesMissingIncome } from '../helpers/foughtBattleSignature';

useFinancialCaptureTestEnvironment();

const RUN = `tfl${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const INJECTED = 'injected engine failure';
const PAYMENT = 'injected payment failure';

const userIds: number[] = [];
const robotIds: number[] = [];
const teamIds: number[] = [];
const tournamentIds: number[] = [];
let weaponId: number;
let counter = 0;
const next = (): number => ++counter;

type Kind = 'solo' | 'team';

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

async function armedRobot(userId: number, elo: number): Promise<number> {
  const inv = await prisma.weaponInventory.create({ data: { userId, weaponId, pricePaid: 0 } });
  const robot = await prisma.robot.create({
    data: {
      userId, name: `${RUN}_r${next()}`, elo, currentHP: 100, maxHP: 100, currentShield: 20, maxShield: 20,
      yieldThreshold: 20, loadoutType: 'single', mainWeaponId: inv.id,
    },
  });
  robotIds.push(robot.id);
  return robot.id;
}

async function createEntrant(kind: Kind, elo: number): Promise<Entrant> {
  const stableId = await createStable();
  if (kind === 'solo') {
    const id = await armedRobot(stableId, elo);
    return { id, robots: [id], stableId };
  }
  const robots = [await armedRobot(stableId, elo), await armedRobot(stableId, elo)];
  const team = await prisma.teamBattle.create({
    data: {
      stableId, teamSize: 2, teamName: `${RUN}_t${next()}`.slice(0, 32),
      members: { create: robots.map((robotId, slotIndex) => ({ robotId, slotIndex })) },
    },
  });
  teamIds.push(team.id);
  await subscribeTeamMembers([team.id], 'tournament_2v2');
  return { id: team.id, robots, stableId };
}

/**
 * A bracket. `pairs` lists round-1 matches by seed (1-based), `null` for a bye
 * slot. Later rounds get empty placeholder rows.
 */
async function createBracket(
  kind: Kind,
  entrants: Entrant[],
  pairs: Array<[number, number | null]>,
  maxRounds: number,
): Promise<{ tournamentId: number; round1: number[] }> {
  const participantType = kind === 'solo' ? 'robot' : 'team_2v2';
  const tournament = await prisma.tournament.create({
    data: {
      name: `${RUN} ${kind} ${next()}`, tournamentType: 'single_elimination', participantType, status: 'active',
      currentRound: 1, maxRounds, totalParticipants: entrants.length,
    },
  });
  tournamentIds.push(tournament.id);
  const round1: number[] = [];
  for (let i = 0; i < pairs.length; i++) {
    const [a, b] = pairs[i];
    const row = await prisma.scheduledTournamentMatch.create({
      data: {
        tournamentId: tournament.id, round: 1, matchNumber: i + 1, participantType,
        participant1Id: entrants[a - 1].id, participant2Id: b === null ? null : entrants[b - 1].id,
        isByeMatch: b === null,
      },
    });
    round1.push(row.id);
  }
  for (let round = 2; round <= maxRounds; round++) {
    for (let m = 1; m <= 2 ** (maxRounds - round); m++) {
      await prisma.scheduledTournamentMatch.create({ data: { tournamentId: tournament.id, round, matchNumber: m, participantType } });
    }
  }
  return { tournamentId: tournament.id, round1 };
}

async function entrantsFor(kind: Kind, count: number): Promise<Entrant[]> {
  const list: Entrant[] = [];
  for (let i = 0; i < count; i++) list.push(await createEntrant(kind, 1600 - i * 25));
  return list;
}

function runRound(kind: Kind, tournamentId: number) {
  return kind === 'solo' ? executeSoloTournamentRound(tournamentId) : executeTeamTournamentRound(tournamentId, 2);
}

/** Make the engine throw for any fight involving one of `failing`'s robots. */
function failFightsOf(kind: Kind, failing: Set<number>): jest.SpyInstance {
  if (kind === 'solo') {
    const original = simulationLoop.simulateBattle;
    return jest.spyOn(simulationLoop, 'simulateBattle').mockImplementation((r1, r2, t) => {
      if (failing.has(r1.id) || failing.has(r2.id)) throw new Error(INJECTED);
      return original(r1, r2, t);
    });
  }
  const original = teamBattleEngine.simulateTeamBattle;
  return jest.spyOn(teamBattleEngine, 'simulateTeamBattle').mockImplementation((t1, t2, size) => {
    if ([...t1, ...t2].some((r) => failing.has(r.id))) throw new Error(INJECTED);
    return original(t1, t2, size);
  });
}

const modeOf = (kind: Kind): string => (kind === 'solo' ? 'tournament_1v1' : 'tournament_2v2');

async function robotSnapshot(ids: number[]) {
  return prisma.robot.findMany({
    where: { id: { in: ids } },
    orderBy: { id: 'asc' },
    select: { id: true, elo: true, totalBattles: true, wins: true, losses: true, currentHP: true },
  });
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

// ── Cases ────────────────────────────────────────────────────────────

describe.each<Kind>(['solo', 'team'])('T15 %s tournament', (kind) => {
  it('R1: an errored semifinal advances the higher seed with nothing written, and the final is fought', async () => {
    const e = await entrantsFor(kind, 4);
    // 4-slot standard order: match 1 = seed 1 v seed 4, match 2 = seed 3 v seed 2.
    const { tournamentId, round1 } = await createBracket(kind, e, [[1, 4], [3, 2]], 2);
    const semifinalRobots = [...e[0].robots, ...e[3].robots];
    const before = await robotSnapshot(semifinalRobots);
    failFightsOf(kind, new Set(e[0].robots));

    const result = await runRound(kind, tournamentId);
    jest.restoreAllMocks();

    expect(result.matchesCancelled).toBe(1);
    const failed = await prisma.scheduledTournamentMatch.findUniqueOrThrow({ where: { id: round1[0] } });
    expect(failed).toMatchObject({ status: 'cancelled', winnerId: e[0].id, battleId: null });
    expect(await prisma.battle.count({ where: battlesForRobots(semifinalRobots) })).toBe(0);
    expect(await prisma.financialLedger.count({ where: { userId: { in: [e[0].stableId, e[3].stableId] } } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { eventType: 'financial_transaction', userId: { in: [e[0].stableId, e[3].stableId] } } })).toBe(0);
    expect(await robotSnapshot(semifinalRobots)).toEqual(before);

    await expect(advanceWinnersToNextRound(tournamentId)).resolves.toBeUndefined();
    const final = await prisma.scheduledTournamentMatch.findFirstOrThrow({ where: { tournamentId, round: 2 } });
    expect(final.participant1Id).toBe(e[0].id);
    const semi2 = await prisma.scheduledTournamentMatch.findUniqueOrThrow({ where: { id: round1[1] } });
    expect(final.participant2Id).toBe(semi2.winnerId);

    const finalRun = await runRound(kind, tournamentId);
    expect(finalRun.matchesExecuted).toBe(1);
    const finalAfter = await prisma.scheduledTournamentMatch.findUniqueOrThrow({ where: { id: final.id } });
    expect(finalAfter.status).toBe('completed');
    expect(finalAfter.battleId).not.toBeNull();
  });

  it('R1: an errored final crowns the higher seed with no credits', async () => {
    const e = await entrantsFor(kind, 2);
    const { tournamentId, round1 } = await createBracket(kind, e, [[1, 2]], 1);
    const titlesBefore = (await prisma.user.findUniqueOrThrow({ where: { id: e[0].stableId } })).championshipTitles;
    failFightsOf(kind, new Set(e[0].robots));

    await runRound(kind, tournamentId);
    await expect(advanceWinnersToNextRound(tournamentId)).resolves.toBeUndefined();

    expect(await prisma.scheduledTournamentMatch.findUniqueOrThrow({ where: { id: round1[0] } }))
      .toMatchObject({ status: 'cancelled', winnerId: e[0].id });
    const tournament = await prisma.tournament.findUniqueOrThrow({ where: { id: tournamentId } });
    expect(tournament).toMatchObject({ status: 'completed', winnerId: e[0].id });
    const champion = await prisma.user.findUniqueOrThrow({ where: { id: e[0].stableId } });
    expect(champion.championshipTitles).toBe(titlesBefore + 1);
    // No battle income for the match (the title's achievement rewards are separate).
    expect(await prisma.financialLedger.count({
      where: { transactionType: 'battle_income', userId: { in: [e[0].stableId, e[1].stableId] } },
    })).toBe(0);
    expect(await prisma.battle.count({ where: battlesForRobots([...e[0].robots, ...e[1].robots]) })).toBe(0);
  });

  it('a bye whose resolution throws still advances its sole participant', async () => {
    const e = await entrantsFor(kind, 3);
    const { tournamentId, round1 } = await createBracket(kind, e, [[1, null], [3, 2]], 2);
    jest.spyOn(tournamentService, 'completeByeMatch').mockRejectedValueOnce(new Error('bye writer exploded'));

    await runRound(kind, tournamentId);

    const bye = await prisma.scheduledTournamentMatch.findUniqueOrThrow({ where: { id: round1[0] } });
    expect(bye).toMatchObject({ status: 'completed', winnerId: e[0].id });
  });

  it('a linked battle whose income throws once is resumed in-run and paid exactly once', async () => {
    const e = await entrantsFor(kind, 2);
    const { tournamentId, round1 } = await createBracket(kind, e, [[1, 2]], 1);
    jest.spyOn(battlePostCombat, 'awardCreditsWithLedger').mockRejectedValueOnce(new Error(PAYMENT));
    const errorLog = jest.spyOn(logger, 'error');

    const result = await runRound(kind, tournamentId);

    expect(result.matchesResumed).toBe(1);
    expect(result.matchesCancelled).toBe(0);
    const row = await prisma.scheduledTournamentMatch.findUniqueOrThrow({ where: { id: round1[0] } });
    expect(row.status).toBe('completed');
    expect(row.battleId).not.toBeNull();
    const events = errorLog.mock.calls.map((c) => ((c as unknown[])[1] as { event?: string } | undefined)?.event);
    expect(events).not.toContain('battle_match_cancelled');

    const participants = await prisma.battleParticipant.findMany({
      where: { battleId: row.battleId! },
      include: { robot: { select: { userId: true } } },
    });
    expect(participants.length).toBe(e.flatMap((x) => x.robots).length);
    for (const p of participants.filter((x) => x.credits > 0)) {
      const eventId = buildBattleIncomeEventId(row.battleId!, p.robot.userId, modeOf(kind), p.robotId);
      expect(await prisma.financialLedger.count({ where: { financialEventId: eventId } })).toBe(1);
      expect(await prisma.auditLog.count({ where: { eventType: 'financial_transaction', financialEventId: eventId } })).toBe(1);
    }
    expect(await findFoughtBattlesMissingIncome([row.battleId!])).toEqual([]);
  });

  it('a linked battle whose income throws twice is finalised with the battle winner and leaves the signature', async () => {
    const e = await entrantsFor(kind, 2);
    const { tournamentId, round1 } = await createBracket(kind, e, [[1, 2]], 1);
    jest
      .spyOn(battlePostCombat, 'awardCreditsWithLedger')
      .mockRejectedValueOnce(new Error(PAYMENT))
      .mockRejectedValueOnce(new Error(PAYMENT));

    const result = await runRound(kind, tournamentId);
    jest.restoreAllMocks();

    expect(result.matchesCancelled).toBe(1);
    const row = await prisma.scheduledTournamentMatch.findUniqueOrThrow({ where: { id: round1[0] } });
    expect(row.status).toBe('completed');
    expect(row.battleId).not.toBeNull();
    expect([e[0].id, e[1].id]).toContain(row.winnerId);
    if (kind === 'solo') {
      const battle = await prisma.battle.findUniqueOrThrow({ where: { id: row.battleId! } });
      expect(row.winnerId).toBe(battle.winnerId);
    }

    await advanceWinnersToNextRound(tournamentId);
    const tournament = await prisma.tournament.findUniqueOrThrow({ where: { id: tournamentId } });
    expect(tournament).toMatchObject({ status: 'completed', winnerId: row.winnerId });

    expect(await prisma.financialLedger.count({
      where: { transactionType: 'battle_income', financialEventId: { startsWith: `battle:${row.battleId}:` } },
    })).toBe(0);
    if (kind === 'solo') {
      const missing = await findFoughtBattlesMissingIncome([row.battleId!]);
      expect(missing.length).toBeGreaterThanOrEqual(1);
      expect(missing.every((m) => m.battleId === row.battleId)).toBe(true);
    } else {
      // Known gap (recorded for the §11 guide text): team tournament battles
      // write participant credits only after payment, so an unpaid team
      // tournament battle carries 0-credit participants and the fought-battle
      // signature cannot see it. The linked, ledger-less battle is the evidence.
      const participants = await prisma.battleParticipant.findMany({ where: { battleId: row.battleId! } });
      expect(participants.every((p) => p.credits === 0)).toBe(true);
      expect(await findFoughtBattlesMissingIncome([row.battleId!])).toEqual([]);
    }
  });
});

describe('T15 solo tournament resume after the single-weapon fallback', () => {
  it('passes the battle loadout (single), not the stored one, to achievements', async () => {
    const e = await entrantsFor('solo', 2);
    // Stored dual_wield with no offhand: the robot fights as single (rule 6).
    await prisma.robot.update({ where: { id: e[0].id }, data: { loadoutType: 'dual_wield' } });
    const { tournamentId } = await createBracket('solo', e, [[1, 2]], 1);
    jest.spyOn(battlePostCombat, 'awardCreditsWithLedger').mockRejectedValueOnce(new Error(PAYMENT));
    const achievements = jest.spyOn(battlePostCombat, 'checkAndAwardAchievements');

    const result = await executeSoloTournamentRound(tournamentId);

    expect(result.matchesResumed).toBe(1);
    const call = achievements.mock.calls.find(([, robotId]) => robotId === e[0].id);
    expect(call?.[2].loadoutType).toBe('single');
    const stored = await prisma.robot.findUniqueOrThrow({ where: { id: e[0].id } });
    expect(stored.loadoutType).toBe('dual_wield');
  });
});

describe('T15 solo tournament bye returning false', () => {
  it('turns a false bye result into the policy and advances the sole participant', async () => {
    const e = await entrantsFor('solo', 3);
    const { tournamentId, round1 } = await createBracket('solo', e, [[1, null], [3, 2]], 2);
    jest.spyOn(tournamentService, 'completeByeMatch').mockResolvedValueOnce(false);

    const result = await executeSoloTournamentRound(tournamentId);

    expect(result.errors.join(' ')).toContain('INVALID_MATCH_STATE');
    const bye = await prisma.scheduledTournamentMatch.findUniqueOrThrow({ where: { id: round1[0] } });
    expect(bye).toMatchObject({ status: 'completed', winnerId: e[0].id });
  });
});
