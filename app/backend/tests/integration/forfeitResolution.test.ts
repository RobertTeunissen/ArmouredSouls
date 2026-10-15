/**
 * T8 / T9 / T10 / T8-R6 — battle-time forfeits in the two-sided league modes
 * (design §4, §5.1-5.3; rules 1-3 and 6). Real database.
 *
 * Per mode: schedule a match with armed robots, then take a weapon away the way
 * a player would (`unequipMainWeapon` / `unequipOffhandWeapon`), then run the
 * mode's executor.
 *
 * - T8: one side has a robot without a main weapon → that side forfeits. One
 *   forfeit battle row with `forfeited` participants; the ready stable is paid
 *   the bye-level reward exactly once (ledger + financial_transaction pair with
 *   the `forfeit:` identity); per-robot credits equal the ledger amount; the
 *   forfeiter earns 0; standings/LP/ELO move as a normal win/loss; HP unchanged;
 *   no streaming/prestige/fame; the queued match is `completed`.
 * - T9: both sides unready → draw, no ledger rows.
 * - T10: rerun / concurrent resolution → one battle, one ledger row.
 * - T8-R6: an incomplete loadout (dual_wield without offhand) fights as single,
 *   the stored loadout is unchanged, one `[Battle] Loadout fallback` warn.
 *
 * Each case cancels other suites' queued rows of its mode first (isolation).
 */
import prisma from '../../src/lib/prisma';
import logger from '../../src/config/logger';
import type { MatchType, StandingsMode } from '../../generated/prisma';
import { executeScheduledBattles, processBattle } from '../../src/services/league/leagueBattleOrchestrator';
import { executeScheduledTeamBattles } from '../../src/services/team-battle/teamBattleOrchestrator';
import { calculateTeamBattleELOChanges } from '../../src/services/team-battle/teamBattleRewardService';
import { executeScheduledTagTeamBattles } from '../../src/services/tag-team/tagTeamScheduler';
import { calculateTagTeamELOChanges } from '../../src/services/tag-team/tagTeamRewards';
import { unequipMainWeapon, unequipOffhandWeapon } from '../../src/services/robot/robotWeaponService';
import { buildForfeitBattleIncomeEventId } from '../../src/services/financial/financialEventIdentity';
import { resolveByeReward, type TierScaledByeMode } from '../../src/utils/byeRewards';
import { calculateELOChange } from '../../src/utils/battleMath';
import { battlesForRobots } from '../cleanupHelper';
import { useFinancialCaptureTestEnvironment } from '../financialCaptureTestHelper';
import { enterRobotStanding, enterTeamStanding } from '../helpers/standings';
import { createTagTeamFixture } from '../helpers/tagTeam';

useFinancialCaptureTestEnvironment();

const RUN = `ffr${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const START_LP = 10;

const userIds: number[] = [];
const robotIds: number[] = [];
const teamIds: number[] = [];
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

type Loadout = 'single' | 'dual_wield';

async function armedRobot(userId: number, loadout: Loadout = 'single', elo = 1200): Promise<number> {
  const main = await prisma.weaponInventory.create({ data: { userId, weaponId, pricePaid: 0 } });
  const offhand = loadout === 'dual_wield'
    ? await prisma.weaponInventory.create({ data: { userId, weaponId, pricePaid: 0 } })
    : null;
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
      loadoutType: loadout,
      mainWeaponId: main.id,
      offhandWeaponId: offhand?.id ?? null,
    },
  });
  robotIds.push(robot.id);
  return robot.id;
}

/** One side of a match: the participant id (robot or team), its stable and its robots in slot order. */
interface SideFixture {
  participantId: number;
  stableId: number;
  robots: number[];
}

async function scheduleUnified(
  matchType: MatchType,
  participantType: 'robot' | 'team',
  participantIds: number[],
): Promise<number> {
  const at = new Date(Date.now() - 60_000);
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
    data: { status: 'cancelled', cancelReason: 'forfeitResolution.test isolation' },
  });
}

// ── Mode table (3.3 / 3.4 extend it) ─────────────────────────────────

interface ModeCase {
  mode: TierScaledByeMode;
  matchType: MatchType;
  participantType: 'robot' | 'team';
  standingMode: StandingsMode;
  standingEntityType: 'robot' | 'team';
  /** Builds one side; `loadouts[i]` is robot i's loadout. */
  createSide(loadouts?: Loadout[]): Promise<SideFixture>;
  /** The mode's executor (one full run). */
  run(): Promise<unknown>;
  /** The number of forfeits the executor reports. */
  forfeitsReported(result: unknown): number;
  /** Resolve one queued match directly (for the concurrency case). */
  resolveOnce(matchId: number, side1: SideFixture, side2: SideFixture): Promise<unknown>;
  /** Expected new ELO per robot for a forfeit (`forfeitingSides`) given pre-battle ELOs. */
  expectedElo(side1: Array<{ id: number; elo: number }>, side2: Array<{ id: number; elo: number }>, forfeitingSides: Array<1 | 2>): Record<number, number>;
  /** Winner column on the battle row for a ready side. */
  battleWinnerId(ready: SideFixture): number;
  /** Whether the battle row carries `winningSide` for a single forfeit. */
  usesWinningSide: boolean;
  /** Robot index on a side to make unready in T8 (tag team: the reserve). */
  unreadyIndex: number;
  /** Participant roles by slot, for modes that record them (tag team). */
  roles?: string[];
}

const leagueCase: ModeCase = {
  mode: 'league_1v1',
  matchType: 'league_1v1',
  participantType: 'robot',
  standingMode: 'league_1v1',
  standingEntityType: 'robot',
  async createSide(loadouts = ['single']) {
    const stableId = await createStable();
    const robotId = await armedRobot(stableId, loadouts[0]);
    await enterRobotStanding(robotId, 'league_1v1', { leaguePoints: START_LP });
    return { participantId: robotId, stableId, robots: [robotId] };
  },
  run: () => executeScheduledBattles(),
  forfeitsReported: (result) => (result as { forfeitBattles: number }).forfeitBattles,
  resolveOnce: (matchId, side1, side2) =>
    processBattle({
      id: matchId,
      robot1Id: side1.participantId,
      robot2Id: side2.participantId,
      leagueType: 'bronze',
      leagueInstanceId: 'bronze_1',
      scheduledFor: new Date(),
      status: 'scheduled',
      battleId: null,
      createdAt: new Date(),
    }),
  expectedElo([r1], [r2], forfeitingSides) {
    if (forfeitingSides.length === 2) {
      const c = calculateELOChange(r1.elo, r2.elo, true);
      return { [r1.id]: r1.elo + c.winnerChange, [r2.id]: r2.elo + c.loserChange };
    }
    const [ready, forfeiter] = forfeitingSides[0] === 2 ? [r1, r2] : [r2, r1];
    const c = calculateELOChange(ready.elo, forfeiter.elo, false);
    return { [ready.id]: ready.elo + c.winnerChange, [forfeiter.id]: forfeiter.elo + c.loserChange };
  },
  battleWinnerId: (ready) => ready.participantId,
  usesWinningSide: false,
  unreadyIndex: 0,
};

/** Every member moves by its team's change (the fought convention). */
function teamElo(
  side1: Array<{ id: number; elo: number }>,
  side2: Array<{ id: number; elo: number }>,
  forfeitingSides: Array<1 | 2>,
  formula: (sum1: number, sum2: number, team1Won: boolean, isDraw: boolean) => { team1Change: number; team2Change: number },
): Record<number, number> {
  const sum = (rs: Array<{ elo: number }>) => rs.reduce((acc, r) => acc + r.elo, 0);
  const isDraw = forfeitingSides.length === 2;
  const changes = formula(sum(side1), sum(side2), !isDraw && forfeitingSides[0] === 2, isDraw);
  return Object.fromEntries([
    ...side1.map((r) => [r.id, r.elo + changes.team1Change]),
    ...side2.map((r) => [r.id, r.elo + changes.team2Change]),
  ]);
}

function teamLeagueCase(teamSize: 2 | 3): ModeCase {
  const mode = teamSize === 2 ? 'league_2v2' : 'league_3v3';
  return {
    mode,
    matchType: mode,
    participantType: 'team',
    standingMode: mode,
    standingEntityType: 'team',
    async createSide(loadouts = []) {
      const stableId = await createStable();
      const robots: number[] = [];
      for (let i = 0; i < teamSize; i++) robots.push(await armedRobot(stableId, loadouts[i] ?? 'single'));
      const team = await prisma.teamBattle.create({
        data: {
          stableId,
          teamSize,
          teamName: `${RUN}_t${next()}`.slice(0, 32),
          members: { create: robots.map((robotId, slotIndex) => ({ robotId, slotIndex })) },
        },
      });
      teamIds.push(team.id);
      await enterTeamStanding(team.id, mode, { leaguePoints: START_LP });
      return { participantId: team.id, stableId, robots };
    },
    run: () => executeScheduledTeamBattles(teamSize),
    forfeitsReported: (result) => (result as { matchesForfeited: number }).matchesForfeited,
    resolveOnce: () => executeScheduledTeamBattles(teamSize),
    expectedElo: (side1, side2, forfeitingSides) => teamElo(side1, side2, forfeitingSides, calculateTeamBattleELOChanges),
    battleWinnerId: (ready) => ready.participantId,
    usesWinningSide: true,
    // Any member: the second one, so the rule is not "slot 0 only".
    unreadyIndex: 1,
  };
}

/** T11: a tag team's RESERVE without a main weapon forfeits its team (it used to cancel the match). */
const tagTeamCase: ModeCase = {
  mode: 'tag_team',
  matchType: 'tag_team',
  participantType: 'team',
  standingMode: 'tag_team',
  standingEntityType: 'team',
  async createSide(loadouts = []) {
    const stableId = await createStable();
    const active = await armedRobot(stableId, loadouts[0] ?? 'single');
    const reserve = await armedRobot(stableId, loadouts[1] ?? 'single');
    const team = await createTagTeamFixture(stableId, active, reserve, { leaguePoints: START_LP });
    teamIds.push(team.id);
    return { participantId: team.id, stableId, robots: [active, reserve] };
  },
  run: () => executeScheduledTagTeamBattles(),
  forfeitsReported: (result) => (result as { forfeits: number }).forfeits,
  resolveOnce: () => executeScheduledTagTeamBattles(),
  expectedElo: (side1, side2, forfeitingSides) => teamElo(side1, side2, forfeitingSides, calculateTagTeamELOChanges),
  battleWinnerId: (ready) => ready.participantId,
  usesWinningSide: true,
  unreadyIndex: 1,
  roles: ['active', 'reserve'],
};

const MODE_CASES: ModeCase[] = [leagueCase, teamLeagueCase(2), teamLeagueCase(3), tagTeamCase];

// ── Assertion helpers ────────────────────────────────────────────────

async function robotSnapshot(ids: number[]) {
  return prisma.robot.findMany({
    where: { id: { in: ids } },
    select: { id: true, elo: true, currentHP: true, fame: true, loadoutType: true, dualWieldWins: true, wins: true, losses: true, draws: true, totalBattles: true },
    orderBy: { id: 'asc' },
  });
}

async function standingOf(c: ModeCase, side: SideFixture) {
  return prisma.standing.findUniqueOrThrow({
    where: {
      entityType_entityId_mode: {
        entityType: c.standingEntityType,
        entityId: c.participantType === 'robot' ? side.robots[0] : side.participantId,
        mode: c.standingMode,
      },
    },
  });
}

async function prestigeOf(userIdList: number[]): Promise<number[]> {
  const users = await prisma.user.findMany({ where: { id: { in: userIdList } }, orderBy: { id: 'asc' }, select: { prestige: true } });
  return users.map((u) => u.prestige);
}

async function forfeitBattlesFor(robots: number[]) {
  return prisma.battle.findMany({ where: battlesForRobots(robots), include: { participants: true } });
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
  await prisma.scheduledMatch.deleteMany({ where: { id: { in: scheduledIds } } });
  await prisma.battle.deleteMany({ where: battlesForRobots(robotIds) });
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

// ── The cases ────────────────────────────────────────────────────────

describe.each(MODE_CASES.map((c) => [c.mode, c] as const))('%s battle-time forfeits', (_mode, c) => {
  it('T8: an unarmed robot forfeits its side; the winner is paid the bye-level reward once', async () => {
    await isolate(c.matchType);
    const side1 = await c.createSide();
    const side2 = await c.createSide();
    const matchId = await scheduleUnified(c.matchType, c.participantType, [side1.participantId, side2.participantId]);

    // Taken away after scheduling, as a player would.
    const unarmed = side1.robots[c.unreadyIndex];
    await unequipMainWeapon(side1.stableId, unarmed);

    const allRobots = [...side1.robots, ...side2.robots];
    const before = await robotSnapshot(allRobots);
    const prestigeBefore = await prestigeOf([side1.stableId, side2.stableId]);
    const s1Before = await standingOf(c, side1);
    const s2Before = await standingOf(c, side2);

    const result = await c.run();

    const battles = await forfeitBattlesFor(allRobots);
    expect(battles).toHaveLength(1);
    const battle = battles[0];
    // Proof the robot never entered the simulator (which would throw
    // ROBOT_NOT_BATTLE_READY for it): no combat at all.
    expect(battle.participants.every((p) => p.damageDealt === 0)).toBe(true);
    expect(battle.winnerId).toBe(c.battleWinnerId(side2));
    expect(battle.winningSide).toBe(c.usesWinningSide ? 2 : null);
    expect(battle.durationSeconds).toBe(15);
    expect(c.forfeitsReported(result)).toBe(1);

    // Every robot of both sides has a row; the whole forfeiting side is flagged.
    expect(battle.participants.map((p) => p.robotId).sort()).toEqual([...allRobots].sort());
    for (const p of battle.participants) {
      expect(p.forfeited).toBe(side1.robots.includes(p.robotId));
      expect(p.team).toBe(side1.robots.includes(p.robotId) ? 1 : 2);
      expect(p.streamingRevenue).toBe(0);
      expect(p.prestigeAwarded).toBe(0);
      expect(p.fameAwarded).toBe(0);
      if (c.roles) {
        const side = side1.robots.includes(p.robotId) ? side1 : side2;
        expect(p.role).toBe(c.roles[side.robots.indexOf(p.robotId)]);
      }
    }

    // Exactly one ledger + audit pair, for the ready stable, with the forfeit identity.
    const reward = resolveByeReward({ mode: c.mode, tier: 'bronze' });
    const eventId = buildForfeitBattleIncomeEventId(matchId, side2.stableId, c.mode);
    const ledger = await prisma.financialLedger.findMany({ where: { userId: { in: [side1.stableId, side2.stableId] } } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ userId: side2.stableId, transactionType: 'battle_income', amount: reward.credits, financialEventId: eventId });
    expect(ledger[0].metadata).toMatchObject({ outcome: 'forfeit_win', isBye: true, mode: c.mode, tier: 'bronze', battleId: battle.id });
    const auditPair = await prisma.auditLog.count({ where: { eventType: 'financial_transaction', financialEventId: eventId } });
    expect(auditPair).toBe(1);

    // Owner allocation equals the ledger amount; the forfeiter earns nothing.
    const readyCredits = battle.participants.filter((p) => side2.robots.includes(p.robotId)).reduce((s, p) => s + p.credits, 0);
    expect(readyCredits).toBe(reward.credits);
    expect(battle.participants.filter((p) => side1.robots.includes(p.robotId)).every((p) => p.credits === 0)).toBe(true);

    // Standings: a normal win and a normal loss.
    const s1After = await standingOf(c, side1);
    const s2After = await standingOf(c, side2);
    expect(s1After.losses).toBe(s1Before.losses + 1);
    expect(s1After.leaguePoints).toBe(START_LP - 1);
    expect(s2After.wins).toBe(s2Before.wins + 1);
    expect(s2After.leaguePoints).toBe(START_LP + 3);

    // ELO mirrored with the mode's formula; HP, fame and prestige untouched.
    const after = await robotSnapshot(allRobots);
    const byId = (rows: typeof before) => new Map(rows.map((r) => [r.id, r]));
    const b = byId(before);
    const expectedElo = c.expectedElo(
      side1.robots.map((id) => ({ id, elo: b.get(id)!.elo })),
      side2.robots.map((id) => ({ id, elo: b.get(id)!.elo })),
      [1],
    );
    for (const row of after) {
      expect(row.elo).toBe(expectedElo[row.id]);
      expect(row.currentHP).toBe(b.get(row.id)!.currentHP);
      expect(row.fame).toBe(b.get(row.id)!.fame);
      expect(row.totalBattles).toBe(b.get(row.id)!.totalBattles + 1);
    }
    expect(await prestigeOf([side1.stableId, side2.stableId])).toEqual(prestigeBefore);

    // The queued match is terminal and linked.
    const match = await prisma.scheduledMatch.findUniqueOrThrow({ where: { id: matchId } });
    expect(match).toMatchObject({ status: 'completed', battleId: battle.id });
  });

  it('T9: both sides unready is a draw with no ledger rows', async () => {
    await isolate(c.matchType);
    const side1 = await c.createSide();
    const side2 = await c.createSide();
    const matchId = await scheduleUnified(c.matchType, c.participantType, [side1.participantId, side2.participantId]);
    await unequipMainWeapon(side1.stableId, side1.robots[c.unreadyIndex]);
    await unequipMainWeapon(side2.stableId, side2.robots[c.unreadyIndex]);

    const allRobots = [...side1.robots, ...side2.robots];
    const before = await robotSnapshot(allRobots);
    await c.run();

    const battles = await forfeitBattlesFor(allRobots);
    expect(battles).toHaveLength(1);
    expect(battles[0]).toMatchObject({ winnerId: null, winningSide: null, winnerReward: 0, loserReward: 0 });
    expect(battles[0].participants.every((p) => p.forfeited && p.credits === 0)).toBe(true);
    expect(await prisma.financialLedger.count({ where: { userId: { in: [side1.stableId, side2.stableId] } } })).toBe(0);

    for (const side of [side1, side2]) {
      const s = await standingOf(c, side);
      expect(s.draws).toBe(1);
      expect(s.leaguePoints).toBe(START_LP + 1);
    }
    const b = new Map(before.map((r) => [r.id, r]));
    const expectedElo = c.expectedElo(
      side1.robots.map((id) => ({ id, elo: b.get(id)!.elo })),
      side2.robots.map((id) => ({ id, elo: b.get(id)!.elo })),
      [1, 2],
    );
    for (const row of await robotSnapshot(allRobots)) {
      expect(row.elo).toBe(expectedElo[row.id]);
      expect(row.draws).toBe(b.get(row.id)!.draws + 1);
      expect(row.currentHP).toBe(b.get(row.id)!.currentHP);
    }
    expect((await prisma.scheduledMatch.findUniqueOrThrow({ where: { id: matchId } })).status).toBe('completed');
  });

  it('T10: reruns and concurrent resolution write one battle and one ledger row', async () => {
    await isolate(c.matchType);
    // Sequential: resolve twice, then rerun the executor.
    const a1 = await c.createSide();
    const a2 = await c.createSide();
    const seqId = await scheduleUnified(c.matchType, c.participantType, [a1.participantId, a2.participantId]);
    await unequipMainWeapon(a1.stableId, a1.robots[c.unreadyIndex]);
    await c.resolveOnce(seqId, a1, a2);
    await c.resolveOnce(seqId, a1, a2);
    await c.run();
    expect(await forfeitBattlesFor([...a1.robots, ...a2.robots])).toHaveLength(1);
    expect(await prisma.financialLedger.count({ where: { userId: a2.stableId } })).toBe(1);

    // Concurrent: two resolutions race for the same claim.
    const b1 = await c.createSide();
    const b2 = await c.createSide();
    const raceId = await scheduleUnified(c.matchType, c.participantType, [b1.participantId, b2.participantId]);
    await unequipMainWeapon(b1.stableId, b1.robots[c.unreadyIndex]);
    await Promise.all([c.resolveOnce(raceId, b1, b2), c.resolveOnce(raceId, b1, b2)]);
    expect(await forfeitBattlesFor([...b1.robots, ...b2.robots])).toHaveLength(1);
    expect(await prisma.financialLedger.count({ where: { userId: b2.stableId } })).toBe(1);
    expect(await prisma.financialLedger.count({ where: { userId: b1.stableId } })).toBe(0);
  });

  it('T8-R6: an incomplete loadout fights as single; the stored loadout is unchanged', async () => {
    await isolate(c.matchType);
    const side1 = await c.createSide(['dual_wield', 'single', 'single']);
    const side2 = await c.createSide();
    const matchId = await scheduleUnified(c.matchType, c.participantType, [side1.participantId, side2.participantId]);
    const incomplete = side1.robots[0];
    await unequipOffhandWeapon(side1.stableId, incomplete);
    const [before] = await robotSnapshot([incomplete]);
    const warn = jest.spyOn(logger, 'warn');

    await c.run();

    const battles = await forfeitBattlesFor([...side1.robots, ...side2.robots]);
    expect(battles).toHaveLength(1);
    expect(battles[0].participants.every((p) => !p.forfeited)).toBe(true);
    expect(battles[0].durationSeconds).toBeGreaterThan(0);
    const fallbackLogs = (warn.mock.calls as unknown as unknown[][]).filter((call) => call[0] === '[Battle] Loadout fallback');
    expect(fallbackLogs).toHaveLength(1);
    expect(fallbackLogs[0][1]).toMatchObject({ matchId, robotId: incomplete, storedLoadout: 'dual_wield', battleLoadout: 'single' });

    const [after] = await robotSnapshot([incomplete]);
    expect(after.loadoutType).toBe('dual_wield');
    expect(after.dualWieldWins).toBe(before.dualWieldWins);
    expect(after.totalBattles).toBe(before.totalBattles + 1);
  });
});
