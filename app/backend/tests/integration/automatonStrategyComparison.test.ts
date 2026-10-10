/**
 * Spec #55 task 9.7 — Strategy_Comparison against the real database
 * (R11.13, R11.14, design §17.3).
 *
 * Seeded battles cover win, loss and draw in 1v1 and team modes, byes,
 * King of the Hill and Grand Melee (excluded), Automaton-vs-Automaton and
 * mixed sides (excluded), the human reference row with its best tier from
 * `standings`, a strategy without head-to-head battles (null percentage) and
 * the reference row disappearing when no Human_Stable owns a robot.
 *
 * The dev database is shared, so the exact assertions run inside a
 * transaction that is rolled back: it parks every other Active_Automaton as
 * a draft and every other Human_Stable as generated, so only this suite's
 * stables count. Nothing outside the transaction is changed.
 */
import prisma, { observePrismaStatements } from '../../src/lib/prisma';
import { Prisma } from '../../generated/prisma';
import {
  clearStrategyComparisonCache,
  getStrategyComparison,
  type StrategyComparison,
} from '../../src/services/automaton/strategyComparisonService';
import { getStrategyRegistry } from '../../src/services/automaton/strategies/defaultRegistry';
import { defaultParameters, highestRobotsTarget } from '../../src/services/automaton/strategies/strategyParameters';
import { createAutomatonStable, deleteAutomatonStables } from '../helpers/automatonStable';
import { runTag, startAdminApi, type AdminApiHarness } from '../helpers/automatonAdminApi';

const tag = runTag();

class Rollback extends Error {}

describe('Strategy_Comparison (Spec #55 task 9.7)', () => {
  let harness: AdminApiHarness;
  const humanIds: number[] = [];
  const automatonUserIds: number[] = [];
  const profileIds: number[] = [];
  const robotIds: number[] = [];
  const battleIds: number[] = [];
  const r: Record<string, number> = {};

  async function robot(userId: number, name: string): Promise<number> {
    const created = await prisma.robot.create({
      data: { userId, name: `Cmp ${name} ${tag}`.slice(0, 50), currentHP: 50, maxHP: 50, currentShield: 5, maxShield: 5 },
    });
    robotIds.push(created.id);
    r[name] = created.id;
    return created.id;
  }

  async function standing(entityType: 'robot' | 'team', entityId: number, mode: Prisma.StandingCreateInput['mode'], tier: string): Promise<void> {
    await prisma.standing.create({ data: { entityType, entityId, mode, tier, leagueInstanceId: `${tier}_1` } });
  }

  async function battle(battleType: string, sides: number[][], winnerId: number | null, winningSide: number | null = null): Promise<void> {
    const created = await prisma.battle.create({ data: { battleType, leagueType: 'bronze', durationSeconds: 30, winnerId, winningSide } });
    battleIds.push(created.id);
    await prisma.battleParticipant.createMany({
      data: sides.flatMap((robots, index) => robots.map((robotId) => ({
        battleId: created.id, robotId, team: index + 1, credits: 0, eloBefore: 1200, eloAfter: 1200, finalHP: 10,
      }))),
    });
  }

  /** Run the comparison with only this suite's stables counting, then roll everything back. */
  async function isolatedComparison(options: { withoutOwnHumans?: boolean } = {}): Promise<{ comparison: StrategyComparison; statements: string[] }> {
    let captured: { comparison: StrategyComparison; statements: string[] } | null = null;
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`UPDATE "automaton_profiles" SET "status" = 'draft' WHERE "status" = 'active' AND "id" NOT IN (${Prisma.join(profileIds)})`;
      const keepHumans = options.withoutOwnHumans ? [-1] : humanIds;
      await tx.$executeRaw`UPDATE "users" SET "stable_type" = 'generated' WHERE "stable_type" = 'human' AND "id" NOT IN (${Prisma.join(keepHumans)})`;
      clearStrategyComparisonCache();
      const statements: string[] = [];
      const stop = observePrismaStatements((sql) => statements.push(sql));
      try {
        captured = { comparison: await getStrategyComparison({ db: tx }), statements };
      } finally {
        stop();
        clearStrategyComparisonCache();
      }
      throw new Rollback();
    }, { timeout: 30_000 }).catch((error: unknown) => {
      if (!(error instanceof Rollback)) throw error;
    });
    if (!captured) throw new Error('comparison did not run');
    return captured;
  }

  beforeAll(async () => {
    harness = await startAdminApi(`cmp${tag}`);
    for (const [name, prestige, currency] of [['h1', 100, 1_000], ['h2', 300, 3_000], ['h3', 999, 9_999]] as const) {
      const user = await prisma.user.create({ data: { username: `t55cmp_${name}_${tag}`, passwordHash: 'unused', prestige, currency } });
      humanIds.push(user.id);
      r[name] = user.id;
    }
    const s1 = await createAutomatonStable({ tag: `cmps1${tag}`, balance: 50_000, prestige: 10, blueprints: [], strategyKey: 'swarm' });
    const s2 = await createAutomatonStable({ tag: `cmps2${tag}`, balance: 150_000, prestige: 30, blueprints: [], strategyKey: 'swarm' });
    const p1 = await createAutomatonStable({ tag: `cmpp1${tag}`, balance: 70_000, prestige: 5, blueprints: [], strategyKey: 'paragon' });
    for (const s of [s1, s2, p1]) {
      automatonUserIds.push(s.userId);
      profileIds.push(s.profileId);
    }
    await robot(r.h1, 'h1a');
    await robot(r.h1, 'h1b');
    await robot(r.h2, 'h2a');
    await robot(r.h2, 'h2b');
    await robot(s1.userId, 's1a');
    await robot(s2.userId, 's2a');
    await robot(s2.userId, 's2b');
    await robot(p1.userId, 'p1a');

    // Best tiers: S1 silver robot + gold team, S2 gold robot, P1 bronze; humans platinum and diamond ×2.
    const s1Team = await prisma.teamBattle.create({ data: { stableId: s1.userId, teamSize: 2, teamName: `Cmp Team ${tag}` } });
    await standing('robot', r.s1a, 'league_1v1', 'silver');
    await standing('team', s1Team.id, 'league_2v2', 'gold');
    await standing('robot', r.s2a, 'league_1v1', 'gold');
    await standing('robot', r.p1a, 'league_1v1', 'bronze');
    await standing('robot', r.h1a, 'league_1v1', 'platinum');
    await standing('robot', r.h2a, 'league_1v1', 'diamond');
    await standing('robot', r.h2b, 'tag_team', 'diamond');

    // Head-to-head, counted for Swarm: 2 wins, 2 losses, 2 draws.
    await battle('league_1v1', [[r.s1a], [r.h1a]], r.s1a); // win
    await battle('tournament_1v1', [[r.s2a], [r.h2a]], r.h2a); // loss
    await battle('league_1v1', [[r.s1a], [r.h1a]], null); // draw
    await battle('league_2v2', [[r.s2a, r.s2b], [r.h1a, r.h1b]], s1Team.id, 1); // win (team mode: winning_side)
    await battle('tag_team', [[r.h2a, r.h2b], [r.s2a, r.s2b]], null, 1); // loss (Automaton side is team 2)
    await battle('tournament_3v3', [[r.s2a, r.s2b, r.s1a], [r.h1a, r.h1b, r.h2a]], null, null); // draw, two Swarm stables on one side
    // Not counted.
    await battle('league_1v1', [[r.s1a]], r.s1a); // bye: one side only
    await battle('koth', [[r.s1a], [r.h1a]], r.s1a);
    await battle('grand_melee', [[r.s1a], [r.h1a]], r.s1a);
    await battle('league_1v1', [[r.s1a], [r.p1a]], r.s1a); // Automaton vs Automaton
    await battle('league_2v2', [[r.s1a, r.h1a], [r.h2a, r.h2b]], null, 1); // mixed side
  });

  afterAll(async () => {
    await prisma.battle.deleteMany({ where: { id: { in: battleIds } } });
    const teams = await prisma.teamBattle.findMany({ where: { stableId: { in: automatonUserIds } }, select: { id: true } });
    await prisma.standing.deleteMany({ where: { entityType: 'robot', entityId: { in: robotIds } } });
    await prisma.standing.deleteMany({ where: { entityType: 'team', entityId: { in: teams.map((t) => t.id) } } });
    await prisma.robot.deleteMany({ where: { id: { in: robotIds } } });
    await deleteAutomatonStables(automatonUserIds);
    await prisma.user.deleteMany({ where: { id: { in: humanIds } } });
    clearStrategyComparisonCache();
    await harness.close();
    await prisma.$disconnect();
  });

  it('returns one row per strategy with Active_Automatons plus the human reference row (R11.13)', async () => {
    const { comparison } = await isolatedComparison();
    const registry = getStrategyRegistry();
    const swarm = registry.getStrategy('swarm', 1)!;
    const paragon = registry.getStrategy('paragon', 1)!;
    expect(comparison.rows).toEqual([
      {
        strategyKey: 'paragon',
        displayName: paragon.displayName,
        reference: false,
        stables: 1,
        robots: { average: 1, targetAverage: highestRobotsTarget(paragon.buildOrder, defaultParameters(paragon.buildOrder)) },
        prestigeAverage: 5,
        bestTier: { tier: 'bronze', stables: 1 },
        creditsAverage: 70_000,
        winRate: { wins: 0, losses: 0, draws: 0, total: 0, percentage: null },
      },
      {
        strategyKey: 'swarm',
        displayName: swarm.displayName,
        reference: false,
        stables: 2,
        robots: { average: 1.5, targetAverage: highestRobotsTarget(swarm.buildOrder, defaultParameters(swarm.buildOrder)) },
        prestigeAverage: 20,
        bestTier: { tier: 'gold', stables: 2 },
        creditsAverage: 100_000,
        winRate: { wins: 2, losses: 2, draws: 2, total: 6, percentage: 33.3 },
      },
      {
        strategyKey: null,
        displayName: 'Human stables (reference)',
        reference: true,
        stables: 2, // the human without a robot is not counted
        robots: { average: 2, targetAverage: null },
        prestigeAverage: 200,
        bestTier: { tier: 'diamond', stables: 1 },
        creditsAverage: 2_000,
        winRate: null,
      },
    ]);
    expect(comparison.season).toEqual(expect.objectContaining({ seasonNumber: expect.any(Number), cycle: expect.any(Number), lengthCycles: expect.any(Number) }));
  });

  it('reads battle results from battles and battle_participants, never battle_log (R11.14)', async () => {
    const { statements } = await isolatedComparison();
    expect(statements.some((sql) => sql.includes('battle_participants'))).toBe(true);
    expect(statements.filter((sql) => sql.includes('battle_log'))).toEqual([]);
  });

  it('has no reference row when no Human_Stable owns a robot', async () => {
    const { comparison } = await isolatedComparison({ withoutOwnHumans: true });
    expect(comparison.rows.map((row) => row.strategyKey)).toEqual(['paragon', 'swarm']);
    expect(comparison.rows.find((row) => row.strategyKey === 'swarm')?.winRate).toEqual({ wins: 0, losses: 0, draws: 0, total: 0, percentage: null });
  });

  it('caches the result for 60 seconds', async () => {
    clearStrategyComparisonCache();
    const first = await getStrategyComparison({}, () => 1_000_000);
    expect(await getStrategyComparison({}, () => 1_059_000)).toBe(first);
    const refreshed = await getStrategyComparison({}, () => 1_061_000);
    expect(refreshed).not.toBe(first);
    expect(refreshed.generatedAt).toBe(new Date(1_061_000).toISOString());
    clearStrategyComparisonCache();
  });

  it('serves GET /strategies/comparison to admins only (R11.1)', async () => {
    clearStrategyComparisonCache();
    const res = await harness.api('get', '/strategies/comparison');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.rows)).toBe(true);
    expect(res.body.rows.some((row: { strategyKey: string | null }) => row.strategyKey === 'swarm')).toBe(true);
    expect((await harness.api('get', '/strategies/comparison', null)).status).toBe(401);
    expect((await harness.api('get', '/strategies/comparison', harness.playerToken)).status).toBe(403);
    clearStrategyComparisonCache();
  });
});
