/**
 * Hall of Records "Most Battles" and its season accolade rank on the all-modes
 * battle count: `robots.total_battles` + KotH and Grand Melee
 * `standings.total_matches`. A battle is a battle, every mode counts.
 *
 * DB-backed (integration tier) because the ranking happens in SQL. Fixture
 * robots carry counts far above anything else in the test database, so they
 * occupy the top of the list. Accolades go into a throwaway `completed` season
 * that cascades its rows away in `afterAll`; no real season is touched.
 */
import prisma from '../../src/lib/prisma';
import { fetchCareerRecords } from '../../src/services/records/recordsQueryService';
import { getTopRobotsByAllModesBattleCount } from '../../src/services/robot/all-modes-battle-count';
import { writeAccolades } from '../../src/services/season/seasonArchiveService';

const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const SEASON = 80_000 + Math.floor(Math.random() * 9_000);
/** Far above any other robot in the test database; well inside int4 after the sum. */
const BASE = 1_000_000_000;

describe('Most Battles ranks on the all-modes battle count', () => {
  let userId: number;
  const ids: Record<'placement' | 'counter' | 'tieFewer' | 'idFirst' | 'idSecond', number> = {
    placement: 0, counter: 0, tieFewer: 0, idFirst: 0, idSecond: 0,
  };

  const robot = async (name: string, totalBattles: number): Promise<number> => {
    const created = await prisma.robot.create({
      data: {
        userId, name: `mb_${name}_${suffix}`.slice(0, 50), totalBattles,
        currentHP: 55, maxHP: 55, currentShield: 4, maxShield: 4,
      },
    });
    return created.id;
  };
  const standing = (entityId: number, mode: 'koth' | 'grand_melee' | 'league_1v1', totalMatches: number) =>
    prisma.standing.create({ data: { entityType: 'robot', entityId, mode, totalMatches } });

  beforeAll(async () => {
    await prisma.season.create({ data: { seasonNumber: SEASON, phase: 'completed', startedAt: new Date(), endedAt: new Date() } });
    const user = await prisma.user.create({
      data: { username: `mb_${suffix}`, passwordHash: 'x', stableName: `MB ${suffix}`.slice(0, 30) },
    });
    userId = user.id;

    // Fewer win/loss-mode battles, but 300 KotH + 200 Grand Melee matches: BASE + 500.
    ids.placement = await robot('placement', BASE);
    await standing(ids.placement, 'koth', 300);
    await standing(ids.placement, 'grand_melee', 200);
    // More win/loss-mode battles, no placement matches: BASE + 400.
    ids.counter = await robot('counter', BASE + 400);
    // Ties `counter` on the combined value (BASE + 100 + 300) with fewer win/loss-mode battles.
    ids.tieFewer = await robot('tiefewer', BASE + 100);
    await standing(ids.tieFewer, 'koth', 300);
    // Identical counts: the lower id ranks first. A win/loss-mode standing's
    // total_matches is already inside total_battles and must not be added.
    ids.idFirst = await robot('idfirst', BASE + 50);
    ids.idSecond = await robot('idsecond', BASE + 50);
    await standing(ids.idSecond, 'league_1v1', 999_999);
  });

  afterAll(async () => {
    const robotIds = Object.values(ids).filter((id) => id > 0);
    await prisma.season.deleteMany({ where: { seasonNumber: SEASON } });
    await prisma.standing.deleteMany({ where: { entityType: 'robot', entityId: { in: robotIds } } });
    await prisma.robot.deleteMany({ where: { id: { in: robotIds } } });
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
  });

  const expectedOrder = () => [ids.placement, ids.counter, ids.tieFewer, ids.idFirst, ids.idSecond];

  it('ranks on the combined value, so placement matches can lift a robot above one with more total_battles', async () => {
    const top = await getTopRobotsByAllModesBattleCount(5);
    expect(top.map((e) => e.robotId)).toEqual(expectedOrder());
    expect(top.map((e) => e.allModesBattleCount)).toEqual([BASE + 500, BASE + 400, BASE + 400, BASE + 50, BASE + 50]);
  });

  it('fetchCareerRecords().mostBattles carries the all-modes count and keeps W/L/D on total_battles', async () => {
    const { mostBattles } = await fetchCareerRecords();
    const top = mostBattles.slice(0, 5);

    expect(top.map((e) => e.robotId)).toEqual(expectedOrder());
    expect(top.map((e) => e.allModesBattleCount)).toEqual([BASE + 500, BASE + 400, BASE + 400, BASE + 50, BASE + 50]);
    expect(top.map((e) => e.totalBattles)).toEqual([BASE, BASE + 400, BASE + 100, BASE + 50, BASE + 50]);
  });

  it('the season accolade captures the combined value', async () => {
    await writeAccolades(SEASON);

    const rows = await prisma.seasonAccolade.findMany({
      where: { seasonNumber: SEASON, category: 'mostBattles', rank: { lte: 5 } },
      select: { rank: true, subjectName: true, value: true, valueLabel: true },
      orderBy: { rank: 'asc' },
    });
    expect(rows.map((r) => r.value)).toEqual([BASE + 500, BASE + 400, BASE + 400, BASE + 50, BASE + 50]);
    expect(rows[0].subjectName).toBe(`mb_placement_${suffix}`.slice(0, 50));
    expect(rows.every((r) => r.valueLabel === 'battles')).toBe(true);
  });
});

// Regression (PR #534, CI run 38268924418): the ranking added two int4 values
// and cast SUM() back to int, so counts whose parts together pass 2^31 failed
// the whole Hall of Records with PostgreSQL 22003 "integer out of range". Each
// stored column stays inside int4 here; only the sums exceed it.
describe('Most Battles survives all-modes counts above the int4 range', () => {
  const INT4_MAX = 2_147_483_647;
  const overflowSeason = 90_000 + Math.floor(Math.random() * 9_000);
  let overflowUserId = 0;
  const overflowIds: number[] = [];

  beforeAll(async () => {
    await prisma.season.create({
      data: { seasonNumber: overflowSeason, phase: 'completed', startedAt: new Date(), endedAt: new Date() },
    });
    const user = await prisma.user.create({
      data: { username: `mbo_${suffix}`, passwordHash: 'x', stableName: `MBO ${suffix}`.slice(0, 30) },
    });
    overflowUserId = user.id;
    const create = async (name: string, totalBattles: number) => {
      const created = await prisma.robot.create({
        data: {
          userId: overflowUserId, name: `mbo_${name}_${suffix}`.slice(0, 50), totalBattles,
          currentHP: 55, maxHP: 55, currentShield: 4, maxShield: 4,
        },
      });
      overflowIds.push(created.id);
      return created.id;
    };
    // total_battles + one KotH standing: int4 + int4 > INT4_MAX.
    const single = await create('single', 2_000_000_000);
    await prisma.standing.create({ data: { entityType: 'robot', entityId: single, mode: 'koth', totalMatches: 2_000_000_000 } });
    // Two placement standings whose SUM() alone passes INT4_MAX.
    const summed = await create('summed', INT4_MAX);
    await prisma.standing.create({ data: { entityType: 'robot', entityId: summed, mode: 'koth', totalMatches: 1_500_000_000 } });
    await prisma.standing.create({ data: { entityType: 'robot', entityId: summed, mode: 'grand_melee', totalMatches: 1_500_000_000 } });
  });

  afterAll(async () => {
    await prisma.season.deleteMany({ where: { seasonNumber: overflowSeason } });
    await prisma.standing.deleteMany({ where: { entityType: 'robot', entityId: { in: overflowIds } } });
    await prisma.robot.deleteMany({ where: { id: { in: overflowIds } } });
    if (overflowUserId) await prisma.user.deleteMany({ where: { id: overflowUserId } });
  });

  const expectedCounts = [INT4_MAX + 3_000_000_000, 4_000_000_000];

  it('ranks and returns counts past int4 without a 22003 error', async () => {
    const top = await getTopRobotsByAllModesBattleCount(2);
    expect(top).toEqual([
      { robotId: overflowIds[1], allModesBattleCount: expectedCounts[0] },
      { robotId: overflowIds[0], allModesBattleCount: expectedCounts[1] },
    ]);
  });

  it('fetchCareerRecords and the season accolade carry the full value', async () => {
    const { mostBattles } = await fetchCareerRecords();
    expect(mostBattles.slice(0, 2).map((e) => e.allModesBattleCount)).toEqual(expectedCounts);

    await writeAccolades(overflowSeason);
    const rows = await prisma.seasonAccolade.findMany({
      where: { seasonNumber: overflowSeason, category: 'mostBattles', rank: { lte: 2 } },
      select: { value: true },
      orderBy: { rank: 'asc' },
    });
    expect(rows.map((r) => r.value)).toEqual(expectedCounts);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
