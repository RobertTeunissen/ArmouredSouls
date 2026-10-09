/**
 * Spec #55 task 1.7 — public exposure of Automaton_Stables (R1.7, R2.1).
 *
 * Real database. Every public payload that renders an owning stable on the
 * Automaton_Badge surfaces (leaderboards, league standings, Hall of Records,
 * stable profile, robot detail, battle report, season archive) carries the
 * owner's Stable_Type, and none of them carries Automaton_Profile internals
 * (franchise, Backstory, strategy, Team_Names, Event_Order, blueprint links)
 * or anything of a Draft_Automaton.
 */
import http from 'node:http';
import express from 'express';
import request from 'supertest';
import prisma from '../../src/lib/prisma';
import { errorHandler } from '../../src/middleware/errorHandler';
import { generateToken } from '../../src/services/auth/jwtService';
import stablesRoutes from '../../src/routes/stables';
import robotRoutes from '../../src/routes/robots';
import leaderboardsRoutes from '../../src/routes/leaderboards';
import recordsRoutes from '../../src/routes/records';
import leaguesRoutes from '../../src/routes/leagues';
import teamBattlesRoutes from '../../src/routes/teamBattles';
import matchesRoutes from '../../src/routes/matches';
import seasonsRoutes from '../../src/routes/seasons';
import { createTestBattle, createTestRobot, deleteTestBattle } from '../testHelpers';
import { enterRobotStanding, enterTeamStanding } from '../helpers/standings';

const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const MARKERS = {
  franchise: `SecretFranchise${suffix}`,
  backstory: `SecretBackstory${suffix}`,
  strategyKey: `secretstrat${suffix}`,
  teamName: `SecretTeam${suffix}`.slice(0, 32),
  draftName: `DraftOnly${suffix}`.slice(0, 30),
  draftFranchise: `DraftFranchise${suffix}`,
};
/** Field names of Automaton internals that no public payload may contain. */
const FORBIDDEN_KEYS = [
  'franchise', 'backstory', 'strategyKey', 'strategyVersion', 'strategyParameters',
  'teamNames', 'eventOrder', 'catalogueKey', 'plannedStableName', 'automatonProfile',
  'automatonBlueprintId', 'automatonSlotIndex', 'automatonBlueprint', 'blueprints',
];
const TOP = 2_000_000_000;

const app = express();
app.use(express.json());
app.use('/api/stables', stablesRoutes);
app.use('/api/robots', robotRoutes);
app.use('/api/leaderboards', leaderboardsRoutes);
app.use('/api/records', recordsRoutes);
app.use('/api/leagues', leaguesRoutes);
app.use('/api/team-battles', teamBattlesRoutes);
app.use('/api/matches', matchesRoutes);
app.use('/api/seasons', seasonsRoutes);
app.use(errorHandler);

/** Collect every object key in a JSON value, at any depth. */
function allKeys(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const v of value) allKeys(v, out);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      allKeys(v, out);
    }
  }
  return out;
}

function expectNoInternals(body: unknown): void {
  const keys = allKeys(body);
  for (const key of FORBIDDEN_KEYS) {
    expect(keys.has(key)).toBe(false);
  }
  const text = JSON.stringify(body);
  for (const marker of Object.values(MARKERS)) {
    // Team names are public through team standings; every other marker is admin-only.
    if (marker === MARKERS.teamName) continue;
    expect(text).not.toContain(marker);
  }
}

describe('Automaton public exposure (Spec #55 R1.7, R2.1)', () => {
  let server: http.Server;
  let token: string;
  let automatonId: number;
  let viewerId: number;
  let robotId: number;
  let robot2Id: number;
  let viewerRobotId: number;
  let teamId: number;
  let battleId: number;
  let seasonNumber: number;
  const profileIds: number[] = [];

  beforeAll(async () => {
    server = await new Promise<http.Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });

    const automaton = await prisma.user.create({
      data: {
        username: `automaton_exp${suffix}`,
        passwordHash: 'unusable',
        stableName: `ExpAuto${suffix}`.slice(0, 30),
        stableType: 'automaton',
        isGenerated: false,
        hasCompletedOnboarding: true,
        prestige: TOP,
        currency: TOP,
        championshipTitles: 1_000_000,
      },
    });
    automatonId = automaton.id;

    const profile = await prisma.automatonProfile.create({
      data: {
        catalogueKey: `exp${suffix}`,
        userId: automatonId,
        franchise: MARKERS.franchise,
        backstory: MARKERS.backstory,
        strategyKey: MARKERS.strategyKey,
        strategyVersion: 1,
        strategyParameters: { targets: {} },
        teamNames: { twoVsTwo: [MARKERS.teamName], threeVsThree: [] },
        eventOrder: [],
        status: 'active',
        origin: 'admin',
        activatedAt: new Date(),
        blueprints: {
          create: [
            { slotIndex: 1, robotName: 'Bp One', loadoutType: 'single', stance: 'balanced', yieldThreshold: 10, buildFocus: 'bruiser', weaponPath: [] },
            { slotIndex: 2, robotName: 'Bp Two', loadoutType: 'single', stance: 'balanced', yieldThreshold: 10, buildFocus: 'bruiser', weaponPath: [] },
          ],
        },
      },
      include: { blueprints: true },
    });
    profileIds.push(profile.id);

    // A Draft_Automaton owns no User row and must surface nowhere (R2.1).
    const draft = await prisma.automatonProfile.create({
      data: {
        catalogueKey: `expdraft${suffix}`,
        plannedStableName: MARKERS.draftName,
        franchise: MARKERS.draftFranchise,
        backstory: 'Draft backstory',
        strategyKey: 'trio',
        strategyVersion: 1,
        strategyParameters: { targets: {} },
        eventOrder: [],
        origin: 'admin',
      },
    });
    profileIds.push(draft.id);

    const [bp1, bp2] = profile.blueprints.sort((a, b) => a.slotIndex - b.slotIndex);
    const robot = await createTestRobot(automatonId, `ExpBot1${suffix}`);
    robotId = robot.id;
    await prisma.robot.update({
      where: { id: robotId },
      data: { fame: TOP, kills: TOP, automatonBlueprintId: bp1.id, automatonSlotIndex: 1 },
    });
    const robot2 = await createTestRobot(automatonId, `ExpBot2${suffix}`);
    robot2Id = robot2.id;
    await prisma.robot.update({ where: { id: robot2Id }, data: { automatonBlueprintId: bp2.id, automatonSlotIndex: 2 } });

    await enterRobotStanding(robotId, 'league_1v1', { tier: 'bronze', leaguePoints: TOP });

    const team = await prisma.teamBattle.create({
      data: {
        stableId: automatonId,
        teamSize: 2,
        teamName: MARKERS.teamName,
        members: { create: [{ robotId, slotIndex: 0 }, { robotId: robot2Id, slotIndex: 1 }] },
      },
    });
    teamId = team.id;
    await enterTeamStanding(teamId, 'league_2v2', { tier: 'bronze', leaguePoints: TOP });

    const viewer = await prisma.user.create({
      data: { username: `exp_viewer${suffix}`, passwordHash: 'x', stableType: 'human' },
    });
    viewerId = viewer.id;
    viewerRobotId = (await createTestRobot(viewerId, `ExpViewerBot${suffix}`)).id;
    token = generateToken({ id: String(viewerId), username: viewer.username, role: 'user', tokenVersion: 0 });

    battleId = (await createTestBattle({ robot1Id: robotId, robot2Id: viewerRobotId, winnerId: robotId, battleType: 'league_1v1' })).id;

    seasonNumber = 900_000 + Math.floor(Math.random() * 90_000);
    await prisma.season.create({
      data: {
        seasonNumber,
        phase: 'completed',
        startedAt: new Date(),
        endedAt: new Date(),
        standingSnapshots: {
          create: [{
            mode: 'league_1v1', tier: 'bronze', leagueInstanceId: 'bronze_1', instanceRank: 1,
            entityType: 'robot', entityName: robot.name, stableName: automaton.stableName ?? '',
            leaguePoints: 1, wins: 1, losses: 0, draws: 0, isGeneratedSubject: false,
            subjectStableType: 'automaton',
          }],
        },
        accolades: {
          create: [{
            userId: automatonId, category: 'most_wins', rank: 1, subjectType: 'robot',
            subjectName: robot.name, stableName: automaton.stableName ?? '', value: 1, valueLabel: '1',
            isGeneratedSubject: false, subjectStableType: 'automaton',
          }],
        },
      },
    });
  });

  afterAll(async () => {
    await deleteTestBattle(battleId);
    await prisma.season.deleteMany({ where: { seasonNumber } });
    await prisma.standing.deleteMany({ where: { entityType: 'robot', entityId: { in: [robotId, robot2Id, viewerRobotId] } } });
    await prisma.standing.deleteMany({ where: { entityType: 'team', entityId: teamId } });
    await prisma.automatonProfile.deleteMany({ where: { id: { in: profileIds } } });
    await prisma.user.deleteMany({ where: { id: { in: [automatonId, viewerId] } } });
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  });

  const auth = (): [string, string] => ['Authorization', `Bearer ${token}`];

  it('stable profile carries stableType and no profile internals', async () => {
    const res = await request(server).get(`/api/stables/${automatonId}`).set(...auth());
    expect(res.status).toBe(200);
    expect(res.body.user.stableType).toBe('automaton');
    expectNoInternals(res.body);
  });

  it('robot detail carries the owner stableType and no blueprint link', async () => {
    const res = await request(server).get(`/api/robots/${robotId}`).set(...auth());
    expect(res.status).toBe(200);
    expect(res.body.user.stableType).toBe('automaton');
    expectNoInternals(res.body);
  });

  it.each(['fame', 'losses'])('%s leaderboard carries stableType', async (board) => {
    const res = await request(server).get(`/api/leaderboards/${board}?limit=100`);
    expect(res.status).toBe(200);
    const entry = res.body.leaderboard.find((e: { robotId: number }) => e.robotId === robotId);
    expect(entry?.stableType).toBe('automaton');
    expectNoInternals(res.body);
  });

  it('prestige leaderboard carries stableType', async () => {
    const res = await request(server).get('/api/leaderboards/prestige?limit=100');
    expect(res.status).toBe(200);
    const entry = res.body.leaderboard.find((e: { userId: number }) => e.userId === automatonId);
    expect(entry?.stableType).toBe('automaton');
    expectNoInternals(res.body);
  });

  it('Hall of Records stable entries carry stableType', async () => {
    const res = await request(server).get('/api/records');
    expect(res.status).toBe(200);
    const find = (list: Array<{ userId: number; stableType?: string }>) => list.find((e) => e.userId === automatonId);
    expect(find(res.body.economic.richestStables)?.stableType).toBe('automaton');
    expect(find(res.body.prestige.highestPrestige)?.stableType).toBe('automaton');
    expect(find(res.body.prestige.mostTitles)?.stableType).toBe('automaton');
    expectNoInternals(res.body);
  });

  it('league standings carry the owner stableType', async () => {
    const res = await request(server).get('/api/leagues/bronze/standings?perPage=100');
    expect(res.status).toBe(200);
    const entry = res.body.data.find((e: { id: number }) => e.id === robotId);
    expect(entry?.user.stableType).toBe('automaton');
    expectNoInternals(res.body);
  });

  it('team league standings carry the owner stableType', async () => {
    const res = await request(server).get('/api/team-battles/leagues/2/bronze/standings?perPage=100').set(...auth());
    expect(res.status).toBe(200);
    const rows = (res.body.standings ?? res.body.data) as Array<{ teamId: number; stableType?: string }>;
    expect(rows.find((e) => e.teamId === teamId)?.stableType).toBe('automaton');
    expectNoInternals(res.body);
  });

  it('battle report carries the owner stableType for each participant', async () => {
    const res = await request(server).get(`/api/matches/battles/${battleId}/log`).set(...auth());
    expect(res.status).toBe(200);
    const byRobot = new Map(
      (res.body.participants as Array<{ robotId: number; ownerStableType: string }>).map((p) => [p.robotId, p.ownerStableType]),
    );
    expect(byRobot.get(robotId)).toBe('automaton');
    expect(byRobot.get(viewerRobotId)).toBe('human');
    expect(res.body.robot1.ownerStableType).toBe('automaton');
    expectNoInternals(res.body);
  });

  it('season archive carries subjectStableType', async () => {
    const res = await request(server).get(`/api/seasons/${seasonNumber}`).set(...auth());
    expect(res.status).toBe(200);
    expect(res.body.standingsByMode.league_1v1[0].subjectStableType).toBe('automaton');
    expect(res.body.accolades[0].subjectStableType).toBe('automaton');
    expectNoInternals(res.body);
  });

  it('a Draft_Automaton owns no User row', async () => {
    expect(await prisma.user.count({ where: { stableName: MARKERS.draftName } })).toBe(0);
  });
});
