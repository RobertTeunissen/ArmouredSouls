/**
 * Admin Tournaments overview against the database: champions resolved through
 * robots (1v1) and team_battles (2v2), the running tournament's match groups
 * (current round, first-round byes, matches left behind) and last progress.
 * Fixture rows are found by id, so tournaments from other suites don't matter;
 * the running fixture is created "tomorrow" so it is the newest of its type.
 */
import prisma from '../../src/lib/prisma';
import { getTournamentOverview } from '../../src/services/admin/tournaments';
import { createTestRobot, deleteTestUser } from '../testHelpers';

const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const DAY = 24 * 60 * 60 * 1000;

describe('Admin Tournaments overview (database)', () => {
  const userIds: number[] = [];
  const tournamentIds: number[] = [];
  let robotId = 0;
  let teamId = 0;
  let completed1v1 = 0;
  let completed2v2 = 0;
  let running2v2 = 0;

  beforeAll(async () => {
    const human = await prisma.user.create({ data: { username: `atourn_h_${suffix}`, passwordHash: 'x', stableType: 'human', stableName: `Champs ${suffix}`.slice(0, 30) } });
    userIds.push(human.id);
    const robot = await createTestRobot(human.id, `AT_Champ_${suffix}`);
    const mate = await createTestRobot(human.id, `AT_Mate_${suffix}`);
    robotId = robot.id;
    const team = await prisma.teamBattle.create({
      data: {
        stableId: human.id, teamSize: 2, teamName: `AT Team ${suffix}`.slice(0, 32),
        members: { create: [{ robotId: robot.id, slotIndex: 0 }, { robotId: mate.id, slotIndex: 1 }] },
      },
    });
    teamId = team.id;

    const now = Date.now();
    const done = await prisma.tournament.create({
      data: {
        name: `AT 1v1 ${suffix}`, tournamentType: 'single_elimination', participantType: 'robot', status: 'completed',
        currentRound: 3, maxRounds: 3, totalParticipants: 8, winnerId: robotId,
        createdAt: new Date(now - 10 * DAY), startedAt: new Date(now - 10 * DAY), completedAt: new Date(now - 7 * DAY),
      },
    });
    const done2 = await prisma.tournament.create({
      data: {
        name: `AT 2v2 ${suffix}`, tournamentType: 'single_elimination', participantType: 'team_2v2', status: 'completed',
        currentRound: 2, maxRounds: 2, totalParticipants: 4, winnerId: teamId,
        createdAt: new Date(now - 6 * DAY), startedAt: new Date(now - 6 * DAY), completedAt: new Date(now - 4 * DAY),
      },
    });
    const running = await prisma.tournament.create({
      data: {
        name: `AT 2v2 live ${suffix}`, tournamentType: 'single_elimination', participantType: 'team_2v2', status: 'active',
        currentRound: 2, maxRounds: 3, totalParticipants: 6,
        createdAt: new Date(now + DAY), startedAt: new Date(now - 2 * DAY),
      },
    });
    completed1v1 = done.id;
    completed2v2 = done2.id;
    running2v2 = running.id;
    tournamentIds.push(done.id, done2.id, running.id);
    const match = (round: number, matchNumber: number, status: string, isByeMatch = false, completedAt: Date | null = null) => ({
      tournamentId: running.id, round, matchNumber, participantType: 'team_2v2', status, isByeMatch, completedAt,
    });
    await prisma.scheduledTournamentMatch.createMany({
      data: [
        match(1, 1, 'completed', false, new Date(now - 5 * 60 * 60 * 1000)),
        match(1, 2, 'completed', true, new Date(now - 6 * 60 * 60 * 1000)),
        match(1, 3, 'completed', true),
        match(1, 4, 'scheduled'), // left behind in round 1
        match(2, 1, 'pending'),
        match(2, 2, 'completed', false, new Date(now - 4 * 60 * 60 * 1000)),
      ],
    });
  });

  afterAll(async () => {
    await prisma.scheduledTournamentMatch.deleteMany({ where: { tournamentId: { in: tournamentIds } } });
    await prisma.tournament.deleteMany({ where: { id: { in: tournamentIds } } });
    await prisma.teamBattle.deleteMany({ where: { id: teamId } });
    for (const userId of userIds) await deleteTestUser(userId);
  });

  it('resolves champions and stables through robots and teams', async () => {
    const overview = await getTournamentOverview();
    const robotType = overview.types.find((t) => t.type === 'robot')!;
    const teamType = overview.types.find((t) => t.type === 'team_2v2')!;
    expect(robotType.season.recentChampions.find((c) => c.tournamentId === completed1v1)).toMatchObject({
      champion: `AT_Champ_${suffix}`, stableId: userIds[0], stableType: 'human',
    });
    expect(teamType.season.recentChampions.find((c) => c.tournamentId === completed2v2)).toMatchObject({
      champion: `AT Team ${suffix}`.slice(0, 32), stableId: userIds[0], stableType: 'human',
    });
    expect(teamType.season.sizes.find((s) => s.tournamentId === running2v2)).toEqual({ tournamentId: running2v2, participants: 6, current: true });
  });

  it('reads the running tournament from its match groups', async () => {
    const overview = await getTournamentOverview();
    const current = overview.types.find((t) => t.type === 'team_2v2')!.current!;
    expect(current).toMatchObject({
      id: running2v2,
      round: 2,
      maxRounds: 3,
      stage: 'Semi-finals',
      currentRound: { matches: 2, done: 1 },
      firstRound: { matches: 4, byes: 2 },
      leftBehind: 1,
    });
    expect(current.status).toEqual({ level: 'warning', reasons: ['left_behind'] });
    expect(new Date(current.lastProgressAt!).getTime()).toBeGreaterThan(Date.now() - 5 * 60 * 60 * 1000);
  });
});
