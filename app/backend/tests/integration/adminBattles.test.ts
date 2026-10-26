/**
 * Admin Battles page (`/api/admin/battles*`) against the real database:
 * paging, filters, outcome per mode (team-id winners, draws, byes, KotH),
 * team names, payout check against the ledger, the combat log, the exports,
 * route validation and admin-only access. Also checks that the player battle
 * report no longer sends formula breakdowns.
 */
import http from 'node:http';
import express from 'express';
import request from 'supertest';
import prisma from '../../src/lib/prisma';
import { Prisma } from '../../generated/prisma';
import adminBattlesRoutes from '../../src/routes/adminBattles';
import { errorHandler } from '../../src/middleware/errorHandler';
import { generateToken } from '../../src/services/auth/jwtService';
import { createTestRobot } from '../testHelpers';
import {
  exportBattleText,
  getAdminBattleDetail,
  getAdminBattleList,
  getAdminBattleLog,
  type BattleListParams,
} from '../../src/services/admin/battles';
import { estimateBattleCycle } from '../../src/services/admin/battles/battlePayoutCheck';
import { getBattleLog } from '../../src/services/match/matchHistoryService';

const TAG = `${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 900 + 100)}`;
const name = (n: string): string => `Bt${n}${TAG}`;

let server: http.Server;
let adminToken: string;
let playerToken: string;
const userIds: number[] = [];
const battleIds: Record<string, number> = {};
const robot: Record<string, number> = {};
let teamP = 0;
let teamA = 0;

const listParams = (overrides: Partial<BattleListParams> = {}): BattleListParams => ({
  page: 1, limit: 25, mode: 'all', stable: 'all', outcome: 'all', range: 'season', q: TAG, ...overrides,
});

async function makeUser(label: string, stableType: 'human' | 'generated' | 'automaton', role = 'user'): Promise<number> {
  const user = await prisma.user.create({
    data: { username: `bt_${label}_${TAG}`, passwordHash: 'unused', role, stableType, stableName: `${label} Stable ${TAG}`.slice(0, 30) },
  });
  userIds.push(user.id);
  return user.id;
}

interface P { robot: string; team: number; credits?: number; streaming?: number; destroyed?: boolean; yielded?: boolean; placement?: number; elo?: [number, number] }

async function makeBattle(key: string, data: {
  battleType: string; winnerId?: number | null; winningSide?: number | null; durationSeconds: number;
  participants: P[]; battleLog?: Prisma.InputJsonValue; createdAt?: Date; leagueType?: string;
}): Promise<number> {
  const battle = await prisma.battle.create({
    data: {
      battleType: data.battleType,
      leagueType: data.leagueType ?? 'gold',
      leagueInstanceId: 'gold_3',
      winnerId: data.winnerId ?? null,
      winningSide: data.winningSide ?? null,
      durationSeconds: data.durationSeconds,
      battleLog: data.battleLog ?? Prisma.DbNull,
      ...(data.createdAt ? { createdAt: data.createdAt } : {}),
      participants: {
        create: data.participants.map((p) => ({
          robotId: robot[p.robot],
          team: p.team,
          credits: p.credits ?? 0,
          streamingRevenue: p.streaming ?? 0,
          eloBefore: p.elo?.[0] ?? 1500,
          eloAfter: p.elo?.[1] ?? 1500,
          finalHP: p.destroyed ? 0 : 50,
          destroyed: p.destroyed ?? false,
          yielded: p.yielded ?? false,
          placement: p.placement ?? null,
        })),
      },
    },
  });
  battleIds[key] = battle.id;
  return battle.id;
}

async function ledger(userId: number, type: 'battle_income' | 'streaming_revenue', amount: number, battleId: number, robotId: number | null, cycle: number): Promise<void> {
  await prisma.financialLedger.create({
    data: {
      cycleNumber: cycle, userId, robotId, transactionType: type, amount, balanceAfter: 0,
      description: `test ${type}`,
      financialEventId: `bt-${TAG}-${battleId}-${type}-${robotId ?? userId}`,
      metadata: { battleId, ...(type === 'battle_income' ? { participationFloor: amount, winComponent: 0, teamSize: 2, modifiers: [], formula: 'battle_income', formulaVersion: '1' } : {}) },
    },
  });
}

const formulaLog = {
  events: [],
  detailedCombatEvents: [
    { timestamp: 0, type: 'attack', message: 'Battle commences!', formulaBreakdown: { calculation: `${name('P1')} (offensive): 100HP/100HP\nArena: radius 16`, components: { arenaRadius: 16, participantCount: 4 }, result: 0 } },
    { timestamp: 4.2, type: 'movement', attacker: name('A1'), message: `${name('A1')} moves to (1.0, 2.0)`, rangeBand: 'mid' },
    { timestamp: 5.5, type: 'attack', attacker: name('A1'), defender: name('P1'), message: 'hit for 12', robotHP: {}, formulaBreakdown: { calculation: 'Hit: 70 base = 80% (rolled 41.0, result: HIT)', components: { hitRoll: 41 }, result: 12 } },
  ],
};

beforeAll(async () => {
  const pId = await makeUser('Player', 'human');
  const aId = await makeUser('Ferrum', 'automaton');
  const gId = await makeUser('Gen', 'generated');
  const adminId = await makeUser('Admin', 'human', 'admin');
  adminToken = generateToken({ id: String(adminId), username: `bt_Admin_${TAG}`, role: 'admin', tokenVersion: 0 });
  playerToken = generateToken({ id: String(pId), username: `bt_Player_${TAG}`, role: 'user', tokenVersion: 0 });

  for (const [key, owner] of [['P1', pId], ['P2', pId], ['A1', aId], ['A2', aId], ['G1', gId], ['G2', gId], ['G3', gId], ['G4', gId]] as const) {
    robot[key] = (await createTestRobot(owner, name(key))).id;
  }
  teamP = (await prisma.teamBattle.create({ data: { stableId: pId, teamSize: 2, teamName: `Steel Pact ${TAG}`, members: { create: [{ robotId: robot.P1, slotIndex: 0 }, { robotId: robot.P2, slotIndex: 1 }] } } })).id;
  teamA = (await prisma.teamBattle.create({ data: { stableId: aId, teamSize: 2, teamName: `Night Shift ${TAG}`, members: { create: [{ robotId: robot.A1, slotIndex: 0 }, { robotId: robot.A2, slotIndex: 1 }] } } })).id;

  // Old duel, outside the default 7-day window.
  await makeBattle('old', { battleType: 'league_1v1', winnerId: robot.G3, durationSeconds: 40, createdAt: new Date(Date.now() - 10 * 86_400_000),
    participants: [{ robot: 'G3', team: 1 }, { robot: 'G4', team: 2, destroyed: true }] });
  // Duel: player beats a generated robot; the ledger is 1 credit short (mismatch).
  const duel = await makeBattle('duel', { battleType: 'league_1v1', winnerId: robot.P1, durationSeconds: 48,
    participants: [{ robot: 'P1', team: 1, credits: 5000, elo: [1500, 1512] }, { robot: 'G1', team: 2, credits: 1000, destroyed: true, elo: [1500, 1488] }] });
  // 2v2: the automaton team wins; winner_id is the TEAM id.
  const team = await makeBattle('team', { battleType: 'league_2v2', winnerId: teamA, winningSide: 2, durationSeconds: 112, battleLog: formulaLog,
    participants: [
      { robot: 'P1', team: 1, credits: 9000, streaming: 1240, destroyed: true },
      { robot: 'P2', team: 1, credits: 9000, streaming: 1105, destroyed: true },
      { robot: 'A1', team: 2, credits: 27000, streaming: 1380 },
      { robot: 'A2', team: 2, credits: 27000, streaming: 1310, destroyed: true },
    ] });
  await prisma.scheduledMatch.create({ data: {
    matchType: 'league_2v2', status: 'completed', scheduledFor: new Date(), battleId: team,
    participants: { create: [{ participantType: 'team', participantId: teamP, slot: 1 }, { participantType: 'team', participantId: teamA, slot: 2 }] },
  } });
  // Tag team draw at the time limit.
  await makeBattle('draw', { battleType: 'tag_team', durationSeconds: 300,
    participants: [{ robot: 'G1', team: 1 }, { robot: 'G2', team: 1 }, { robot: 'G3', team: 2 }, { robot: 'G4', team: 2 }] });
  // Bye.
  const bye = await makeBattle('bye', { battleType: 'league_1v1', winnerId: robot.G2, durationSeconds: 15, participants: [{ robot: 'G2', team: 1, credits: 2000 }] });
  await prisma.scheduledMatch.create({ data: { matchType: 'league_1v1', status: 'completed', scheduledFor: new Date(), battleId: bye, isByeMatch: true } });
  // KotH won on score by the automaton.
  const koth = await makeBattle('koth', { battleType: 'koth', winnerId: robot.A1, durationSeconds: 130, leagueType: 'koth',
    participants: [{ robot: 'A1', team: 1, placement: 1 }, { robot: 'P2', team: 1, placement: 2 }, { robot: 'G1', team: 1, placement: 3, destroyed: true }] });
  await prisma.battleSummary.create({ data: {
    battleId: koth, perRobot: [], damageFlows: [], participants: [], battleDuration: 130, totalEvents: 0,
    kothPlacements: [{ robotId: robot.A1, robotName: name('A1'), placement: 1, zoneScore: 30, zoneTime: 50, kills: 1, destroyed: false }],
    kothData: { participantCount: 3, scoreThreshold: 30 },
  } });

  // Ledger: duel short by one credit for the player; team battle exact.
  const duelBattle = await prisma.battle.findUniqueOrThrow({ where: { id: duel } });
  const cycle = await estimateBattleCycle(duelBattle.createdAt);
  await ledger(pId, 'battle_income', 4999, duel, null, cycle);
  await ledger(gId, 'battle_income', 1000, duel, null, cycle);
  await ledger(pId, 'battle_income', 18000, team, null, cycle);
  await ledger(aId, 'battle_income', 54000, team, null, cycle);
  await ledger(pId, 'streaming_revenue', 1240, team, robot.P1, cycle);
  await ledger(pId, 'streaming_revenue', 1105, team, robot.P2, cycle);
  await ledger(aId, 'streaming_revenue', 1380, team, robot.A1, cycle);
  await ledger(aId, 'streaming_revenue', 1310, team, robot.A2, cycle);

  const app = express();
  app.use(express.json());
  app.use('/api/admin/battles', adminBattlesRoutes);
  app.use(errorHandler);
  server = await new Promise<http.Server>((resolve) => { const s = app.listen(0, () => resolve(s)); });
});

afterAll(async () => {
  const ids = Object.values(battleIds);
  await prisma.financialLedger.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.scheduledMatch.deleteMany({ where: { battleId: { in: ids } } });
  await prisma.battle.deleteMany({ where: { id: { in: ids } } });
  await prisma.teamBattle.deleteMany({ where: { id: { in: [teamP, teamA] } } });
  await prisma.robot.deleteMany({ where: { id: { in: Object.values(robot) } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('battle list', () => {
  it('pages through every matching battle exactly once, newest first', async () => {
    const seen: number[] = [];
    for (let page = 1; page <= 3; page++) {
      const res = await getAdminBattleList(listParams({ page, limit: 2 }));
      expect(res.pagination).toMatchObject({ total: 6, totalPages: 3 });
      seen.push(...res.battles.map(b => b.id));
    }
    expect(seen).toEqual([...Object.values(battleIds)].sort((a, b) => b - a));
  });

  it('defaults to the last 7 days', async () => {
    const res = await getAdminBattleList(listParams({ range: '7d' }));
    expect(res.battles.map(b => b.id)).not.toContain(battleIds.old);
    expect(res.pagination.total).toBe(5);
  });

  it('resolves the team-mode winner from winning_side and shows team names', async () => {
    const res = await getAdminBattleList(listParams({ mode: 'league_2v2' }));
    expect(res.battles).toHaveLength(1);
    const row = res.battles[0];
    expect(row).toMatchObject({ result: 'win', endedBy: 'team_eliminated' });
    expect(row.sides.map(s => [s.label, s.stable?.stableType, s.isWinner])).toEqual([
      [`Steel Pact ${TAG}`, 'human', false],
      [`Night Shift ${TAG}`, 'automaton', true],
    ]);
  });

  it('classifies the duel, draw, bye and KotH rows', async () => {
    const rows = new Map((await getAdminBattleList(listParams())).battles.map(b => [b.id, b]));
    expect(rows.get(battleIds.duel)).toMatchObject({ result: 'win', endedBy: 'destroyed', eloSwing: 12 });
    expect(rows.get(battleIds.draw)).toMatchObject({ result: 'draw', endedBy: 'time_limit' });
    expect(rows.get(battleIds.bye)).toMatchObject({ result: 'bye', endedBy: null });
    expect(rows.get(battleIds.bye)?.sides).toHaveLength(1);
    const koth = rows.get(battleIds.koth)!;
    expect(koth).toMatchObject({ result: 'win', endedBy: 'score_reached', eloSwing: null });
    expect(koth.sides[0].label).toBe(name('A1'));
    expect(koth.field).toEqual({ others: 2, othersByStableType: { human: 1, generated: 1, automaton: 0 } });
  });

  it('filters by stable type, outcome and search', async () => {
    const automaton = await getAdminBattleList(listParams({ stable: 'automaton' }));
    expect(automaton.battles.map(b => b.id).sort()).toEqual([battleIds.team, battleIds.koth].sort());
    expect((await getAdminBattleList(listParams({ outcome: 'draw' }))).battles.map(b => b.id)).toEqual([battleIds.draw]);
    expect((await getAdminBattleList(listParams({ outcome: 'bye' }))).battles.map(b => b.id)).toEqual([battleIds.bye]);
    expect((await getAdminBattleList(listParams({ outcome: 'time_limit' }))).battles.map(b => b.id)).toEqual([battleIds.draw]);
    expect((await getAdminBattleList(listParams({ q: name('P2') }))).battles.map(b => b.id).sort()).toEqual([battleIds.team, battleIds.koth].sort());
    expect((await getAdminBattleList(listParams({ q: `Ferrum Stable ${TAG}` }))).pagination.total).toBe(2);
    expect((await getAdminBattleList(listParams({ q: `#${battleIds.old}`, range: '24h' }))).battles.map(b => b.id)).toEqual([battleIds.old]);
  });
});

describe('battle detail', () => {
  it('has context, all participants and a matching payout check for the 2v2', async () => {
    const d = await getAdminBattleDetail(battleIds.team);
    expect(d).toMatchObject({ result: 'win', winningSide: 2, winnerRobotId: null, timeLimitSeconds: 300 });
    expect(d.scheduledMatchId).not.toBeNull();
    expect(d.cycleNumber).not.toBeNull();
    expect(d.participants).toHaveLength(4);
    expect(d.payout.status).toBe('match');
    expect(d.payout.ledgerEntries).toBe(6);
    const ferrum = d.payout.stables.find(s => s.stable.stableType === 'automaton')!;
    expect(ferrum).toMatchObject({ battleIncome: { participants: 54000, ledger: 54000 }, streaming: { participants: 2690, ledger: 2690 } });
    expect(ferrum.inputs?.participationFloor).toBe(54000);
    expect(d.combatLog).toMatchObject({ available: true, hasFormulas: true, movementSampled: false });
  });

  it('flags the duel payout mismatch', async () => {
    const d = await getAdminBattleDetail(battleIds.duel);
    expect(d.payout.status).toBe('mismatch');
    expect(d.payout.stables.find(s => s.stable.stableType === 'human')).toMatchObject({
      battleIncome: { participants: 5000, ledger: 4999 }, status: 'mismatch',
    });
    expect(d.combatLog.available).toBe(false);
  });

  it('serves the stored log with formulas and the full text export', async () => {
    const log = await getAdminBattleLog(battleIds.team);
    expect(log.events).toHaveLength(3);
    expect(log.events[2].formulaBreakdown).toBeDefined();
    const text = await exportBattleText(battleIds.team);
    expect(text).toContain(`# Battle #${battleIds.team} · League 2v2`);
    expect(text).toContain(`- ${name('P1')} (offensive): 100HP/100HP`);
    expect(text).toContain('    Hit: 70 base = 80% (rolled 41.0, result: HIT)');
    expect(text).toContain(`[4.2s] movement · ${name('A1')} moves to (1.0, 2.0) · mid`);
    expect(text).toContain('(match, 6 ledger entries)');
  });

  it('the player battle report no longer sends formula breakdowns', async () => {
    const report = await getBattleLog(battleIds.team);
    const events = (report as unknown as { battleLog: { detailedCombatEvents: Array<Record<string, unknown>> } }).battleLog.detailedCombatEvents;
    expect(events).toHaveLength(3);
    expect(events.some(e => 'formulaBreakdown' in e)).toBe(false);
  });
});

describe('routes', () => {
  const api = (url: string, token: string | null = adminToken): request.Test => {
    const req = request(server).get(`/api/admin/battles${url}`);
    return token === null ? req : req.set('Authorization', `Bearer ${token}`);
  };

  it('lists with filters from the query string', async () => {
    const res = await api(`?q=${TAG}&range=season&mode=koth`).expect(200);
    expect(res.body.battles.map((b: { id: number }) => b.id)).toEqual([battleIds.koth]);
  });

  it('rejects unknown filter values', async () => {
    const res = await api('?mode=league').expect(400);
    expect(res.body.code).toBeDefined();
    await api('?stable=real').expect(400);
    await api('?limit=500').expect(400);
  });

  it('404s a missing battle and 400s a bad id', async () => {
    const res = await api('/999999999').expect(404);
    expect(res.body.code).toBe('BATTLE_NOT_FOUND');
    await api('/abc').expect(400);
  });

  it('exports text and a JSON download', async () => {
    const text = await api(`/${battleIds.team}/export`).expect(200);
    expect(text.headers['content-type']).toContain('text/plain');
    expect(text.text).toContain(`# Battle #${battleIds.team}`);
    const json = await api(`/${battleIds.team}/export?format=json`).expect(200);
    expect(json.headers['content-disposition']).toBe(`attachment; filename="battle-${battleIds.team}.json"`);
    expect(json.body.detail.id).toBe(battleIds.team);
    expect(json.body.ledgerEntries).toHaveLength(6);
    expect(json.body.battleLog.detailedCombatEvents).toHaveLength(3);
  });

  it('is admin-only', async () => {
    await api('', null).expect(401);
    await api('', playerToken).expect(403);
    await api(`/${battleIds.team}/log`, playerToken).expect(403);
  });
});
