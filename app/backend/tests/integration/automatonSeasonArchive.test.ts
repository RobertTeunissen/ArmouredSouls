/**
 * Spec #55 task 7.1 (R9.4) — the season archive records the subject's
 * Stable_Type: `StableSeasonArchive.stableType` and `subjectStableType` on
 * `SeasonStandingSnapshot` and `SeasonAccolade`, next to the existing
 * `isGeneratedSubject` flag.
 *
 * Writes into a throwaway `completed` season (a completed season is never the
 * active one) that cascades its archive rows away in `afterAll`.
 */
import prisma from '../../src/lib/prisma';
import {
  writeAccolades,
  writeStableAndRobotArchives,
  writeStandingSnapshot,
} from '../../src/services/season/seasonArchiveService';
import type { RankableStanding } from '../../src/services/season/instanceRank';
import { createAutomatonStable, deleteAutomatonStables } from '../helpers/automatonStable';

const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const SEASON = 90_000 + Math.floor(Math.random() * 9_000);
const userIds: number[] = [];
const robotIds: number[] = [];

/** Top of every prestige ranking, so both fixtures land in the accolades. */
const AUTOMATON_PRESTIGE = 2_100_000_000;
const HUMAN_PRESTIGE = 2_099_999_999;

function standing(entityId: number, leaguePoints: number): RankableStanding {
  return {
    entityType: 'robot', entityId, mode: 'league_1v1', tier: 'bronze', leagueInstanceId: `t55arc_${suffix}`,
    leaguePoints, wins: 1, losses: 0, draws: 0, bestWinStreak: 1,
  };
}

describe('Season archive Stable_Type (Spec #55 task 7.1)', () => {
  let automatonUserId: number;
  let humanUserId: number;
  let generatedUserId: number;
  let automatonRobotId: number;
  let humanRobotId: number;
  let generatedRobotId: number;

  beforeAll(async () => {
    await prisma.season.create({ data: { seasonNumber: SEASON, phase: 'completed', startedAt: new Date(), endedAt: new Date() } });

    const automaton = await createAutomatonStable({ tag: `arc_${suffix}`, balance: 3_000_000, prestige: AUTOMATON_PRESTIGE, blueprints: [] });
    automatonUserId = automaton.userId;
    const human = await prisma.user.create({
      data: { username: `t55arc_h_${suffix}`, passwordHash: 'x', stableName: `Arc Human ${suffix}`.slice(0, 30), prestige: HUMAN_PRESTIGE },
    });
    humanUserId = human.id;
    const generated = await prisma.user.create({
      data: { username: `t55arc_g_${suffix}`, passwordHash: 'x', isGenerated: true, stableType: 'generated' },
    });
    generatedUserId = generated.id;
    userIds.push(automatonUserId, humanUserId, generatedUserId);

    const robot = (userId: number, name: string) => prisma.robot.create({
      data: { userId, name: `${name}_${suffix}`.slice(0, 50), currentHP: 55, maxHP: 55, currentShield: 4, maxShield: 4 },
    });
    automatonRobotId = (await robot(automatonUserId, 't55arc_a')).id;
    humanRobotId = (await robot(humanUserId, 't55arc_h')).id;
    generatedRobotId = (await robot(generatedUserId, 't55arc_g')).id;
    robotIds.push(automatonRobotId, humanRobotId, generatedRobotId);
  });

  afterAll(async () => {
    await prisma.season.deleteMany({ where: { seasonNumber: SEASON } });
    await prisma.robot.deleteMany({ where: { id: { in: robotIds } } });
    await deleteAutomatonStables([automatonUserId]);
    await prisma.user.deleteMany({ where: { id: { in: [humanUserId, generatedUserId] } } });
    await prisma.$disconnect();
  });

  it('writes the Stable_Type on every StableSeasonArchive row (Active_Automatons are archived like humans)', async () => {
    await writeStableAndRobotArchives(SEASON, 10, new Map(), new Map());

    const rows = await prisma.stableSeasonArchive.findMany({
      where: { seasonNumber: SEASON, userId: { in: userIds } },
      select: { userId: true, stableType: true, robotCount: true },
    });
    const byUser = new Map(rows.map((r) => [r.userId, r]));
    expect(byUser.get(automatonUserId)).toEqual({ userId: automatonUserId, stableType: 'automaton', robotCount: 1 });
    expect(byUser.get(humanUserId)).toEqual({ userId: humanUserId, stableType: 'human', robotCount: 1 });
    // Generated_Stables are not archived (unchanged).
    expect(byUser.has(generatedUserId)).toBe(false);
  });

  it('writes subjectStableType on SeasonStandingSnapshot rows', async () => {
    await writeStandingSnapshot(SEASON, [standing(automatonRobotId, 30), standing(humanRobotId, 20), standing(generatedRobotId, 10)]);

    const rows = await prisma.seasonStandingSnapshot.findMany({
      where: { seasonNumber: SEASON, leagueInstanceId: `t55arc_${suffix}` },
      select: { instanceRank: true, subjectStableType: true, isGeneratedSubject: true },
      orderBy: { instanceRank: 'asc' },
    });
    expect(rows).toEqual([
      { instanceRank: 1, subjectStableType: 'automaton', isGeneratedSubject: false },
      { instanceRank: 2, subjectStableType: 'human', isGeneratedSubject: false },
      { instanceRank: 3, subjectStableType: 'generated', isGeneratedSubject: true },
    ]);
  });

  it('writes subjectStableType on SeasonAccolade rows', async () => {
    await writeAccolades(SEASON);

    const rows = await prisma.seasonAccolade.findMany({
      where: { seasonNumber: SEASON, category: 'highestPrestige', userId: { in: [automatonUserId, humanUserId] } },
      select: { userId: true, rank: true, subjectStableType: true, isGeneratedSubject: true },
      orderBy: { rank: 'asc' },
    });
    expect(rows).toEqual([
      { userId: automatonUserId, rank: 1, subjectStableType: 'automaton', isGeneratedSubject: false },
      { userId: humanUserId, rank: 2, subjectStableType: 'human', isGeneratedSubject: false },
    ]);
  });
});
