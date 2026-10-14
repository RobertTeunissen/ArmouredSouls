/**
 * Spec #55 task 9.7 — Strategy_Comparison against the real database
 * (R11.13, R11.14, design §17.3).
 *
 * Seeded battles cover win, loss and draw in 1v1 and team modes, byes,
 * King of the Hill and Grand Melee (excluded), Automaton-vs-Automaton and
 * mixed sides (excluded), the human reference row with its highest tier from
 * `standings` (played rows only), the per-mode block from `standings`, a
 * strategy without head-to-head battles (null percentage), the reference
 * row disappearing when no Human_Stable owns a robot, and the exclusion of
 * played standings rows that belong to a non-active (draft) Automaton whose
 * user still exists and to a generated stable (neither counts for a strategy
 * row nor for the human reference row).
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
import { bestTiersForUsers } from '../../src/services/automaton/standingsTier';
import type { ModePerformance } from '../../src/services/automaton/strategyModePerformance';
import { TIERED_STANDINGS_MODES } from '../../src/shared/utils/automatonStandingsTier';
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
  const generatedIds: number[] = [];
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

  /** A standings row; without `played` it is a default, unplayed row (W/L/D 0, no placement match). */
  async function standing(
    entityType: 'robot' | 'team',
    entityId: number,
    mode: Prisma.StandingCreateInput['mode'],
    tier: string,
    played: Partial<{ wins: number; losses: number; draws: number; totalMatches: number; bestPlacement: number }> = {},
  ): Promise<void> {
    await prisma.standing.create({ data: { entityType, entityId, mode, tier, leagueInstanceId: `${tier}_1`, ...played } });
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
    r.s1 = s1.userId;
    r.s2 = s2.userId;
    r.p1 = p1.userId;
    await robot(r.h1, 'h1a');
    await robot(r.h1, 'h1b');
    await robot(r.h2, 'h2a');
    await robot(r.h2, 'h2b');
    await robot(s1.userId, 's1a');
    await robot(s2.userId, 's2a');
    await robot(s2.userId, 's2b');
    await robot(p1.userId, 'p1a');

    // Highest tiers (played rows only): S1 silver robot + gold team (gold · 2v2), S2 gold robot + gold KotH
    // (gold · KotH: 5 matches beat 3), P1 none (unplayed bronze only); humans platinum and diamond ×2.
    // Unplayed rows (no `played` argument) must be ignored: S1's diamond KotH and H1's champion KotH.
    const s1Team = await prisma.teamBattle.create({ data: { stableId: s1.userId, teamSize: 2, teamName: `Cmp Team ${tag}` } });
    const h2Team = await prisma.teamBattle.create({ data: { stableId: r.h2, teamSize: 2, teamName: `Cmp Human Team ${tag}` } });
    await standing('robot', r.s1a, 'league_1v1', 'silver', { wins: 2, losses: 1 });
    await standing('team', s1Team.id, 'league_2v2', 'gold', { wins: 3, losses: 1, draws: 1 });
    await standing('robot', r.s1a, 'koth', 'diamond');
    await standing('robot', r.s2a, 'league_1v1', 'gold', { wins: 1, losses: 2 });
    await standing('robot', r.s2b, 'koth', 'gold', { totalMatches: 5, wins: 1, bestPlacement: 1 });
    await standing('robot', r.s2a, 'grand_melee', 'bronze', { totalMatches: 4, bestPlacement: 3 });
    await standing('robot', r.p1a, 'league_1v1', 'bronze');
    await standing('robot', r.h1a, 'league_1v1', 'platinum', { wins: 1 });
    await standing('robot', r.h1b, 'koth', 'champion');
    await standing('robot', r.h2a, 'league_1v1', 'diamond', { wins: 4, losses: 1 });
    await standing('team', h2Team.id, 'tag_team', 'diamond', { draws: 1 });

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

    // Excluded stables with played rows above every counted tier, so a leak would change counts and tiers.
    // A non-active (draft) Swarm Automaton whose user still exists (AutomatonStatus is draft | active only):
    // the same state isolatedComparison gives every other profile. Its profile is not in profileIds.
    const sd = await createAutomatonStable({ tag: `cmpsd${tag}`, balance: 90_000, prestige: 50, blueprints: [], strategyKey: 'swarm' });
    await prisma.automatonProfile.update({ where: { id: sd.profileId }, data: { status: 'draft' } });
    automatonUserIds.push(sd.userId);
    await robot(sd.userId, 'sda');
    await standing('robot', r.sda, 'league_1v1', 'champion', { wins: 9, losses: 1 });
    await standing('robot', r.sda, 'koth', 'champion', { totalMatches: 7, wins: 3, bestPlacement: 1 });
    // A generated stable (not a Human_Stable, not an Automaton).
    const generated = await prisma.user.create({
      data: { username: `t55cmp_gen_${tag}`, passwordHash: 'unused', stableType: 'generated', isGenerated: true, prestige: 5000, currency: 99_999 },
    });
    generatedIds.push(generated.id);
    await robot(generated.id, 'g1a');
    await standing('robot', r.g1a, 'league_1v1', 'champion', { wins: 6 });
    await standing('robot', r.g1a, 'koth', 'champion', { totalMatches: 4, wins: 2, bestPlacement: 1 });
  });

  afterAll(async () => {
    await prisma.battle.deleteMany({ where: { id: { in: battleIds } } });
    const teams = await prisma.teamBattle.findMany({ where: { stableId: { in: [...automatonUserIds, ...humanIds] } }, select: { id: true } });
    await prisma.standing.deleteMany({ where: { entityType: 'robot', entityId: { in: robotIds } } });
    await prisma.standing.deleteMany({ where: { entityType: 'team', entityId: { in: teams.map((t) => t.id) } } });
    await prisma.teamBattle.deleteMany({ where: { stableId: { in: humanIds } } });
    await prisma.robot.deleteMany({ where: { id: { in: robotIds } } });
    await deleteAutomatonStables(automatonUserIds);
    await prisma.user.deleteMany({ where: { id: { in: [...humanIds, ...generatedIds] } } });
    clearStrategyComparisonCache();
    await harness.close();
    await prisma.$disconnect();
  });

  it('returns one row per strategy with Active_Automatons plus the human reference row (R11.13)', async () => {
    const { comparison } = await isolatedComparison();
    const registry = getStrategyRegistry();
    const swarm = registry.getStrategy('swarm', 1)!;
    const paragon = registry.getStrategy('paragon', 1)!;
    expect(comparison.rows.map(({ modes: _modes, ...rest }) => rest)).toEqual([
      {
        strategyKey: 'paragon',
        displayName: paragon.displayName,
        reference: false,
        stables: 1,
        robots: { average: 1, targetAverage: highestRobotsTarget(paragon.buildOrder, defaultParameters(paragon.buildOrder)) },
        prestigeAverage: 5,
        bestTier: null, // its only standings row is an unplayed default
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

  it('bestTiersForUsers returns tier and mode, played rows only', async () => {
    const tiers = await bestTiersForUsers([r.s1, r.s2, r.p1]);
    expect(tiers.get(r.s1)).toEqual({ tier: 'gold', mode: 'league_2v2' });
    expect(tiers.get(r.s2)).toEqual({ tier: 'gold', mode: 'koth' }); // 5 KotH matches beat 3 league battles at gold
    expect(tiers.get(r.p1)).toBeNull();
  });

  it('reports per-mode performance from standings (played rows only)', async () => {
    const { comparison } = await isolatedComparison();
    const modesOf = (key: string | null): ModePerformance[] => {
      const row = comparison.rows.find((candidate) => candidate.strategyKey === key);
      if (!row) throw new Error(`no row for ${String(key)}`);
      return row.modes;
    };
    const byMode = (key: string | null, mode: string): ModePerformance | undefined => modesOf(key).find((m) => m.mode === mode);
    for (const row of comparison.rows) expect(row.modes.map((m) => m.mode)).toEqual([...TIERED_STANDINGS_MODES]);

    expect(byMode('swarm', 'league_1v1')).toEqual({
      mode: 'league_1v1', kind: 'head_to_head', entityType: 'robot', stablesPlayed: 2, entitiesPlayed: 2,
      wins: 3, losses: 3, draws: 0, matches: 6, winPercentage: 50, bestPlacement: null, lowSample: true,
    });
    expect(byMode('swarm', 'league_2v2')).toMatchObject({ entityType: 'team', stablesPlayed: 1, entitiesPlayed: 1, wins: 3, losses: 1, draws: 1, matches: 5, winPercentage: 60 });
    expect(byMode('swarm', 'koth')).toMatchObject({ kind: 'placement', stablesPlayed: 1, entitiesPlayed: 1, wins: 1, matches: 5, winPercentage: 20, bestPlacement: 1 });
    expect(byMode('swarm', 'grand_melee')).toMatchObject({ kind: 'placement', wins: 0, matches: 4, winPercentage: 0, bestPlacement: 3 });
    for (const mode of ['league_3v3', 'tag_team']) {
      expect(byMode('swarm', mode)).toMatchObject({ stablesPlayed: 0, entitiesPlayed: 0, matches: 0, winPercentage: null });
    }
    for (const entry of modesOf('paragon')) expect(entry).toMatchObject({ stablesPlayed: 0, entitiesPlayed: 0, wins: 0, matches: 0, winPercentage: null });

    expect(byMode(null, 'league_1v1')).toMatchObject({ stablesPlayed: 2, wins: 5, losses: 1, draws: 0, matches: 6, winPercentage: 83.3 });
    expect(byMode(null, 'tag_team')).toMatchObject({ entityType: 'team', entitiesPlayed: 1, draws: 1, matches: 1, winPercentage: 0 });
    expect(byMode(null, 'koth')).toMatchObject({ matches: 0, winPercentage: null }); // H1's champion KotH row is unplayed
  });

  it('excludes played rows of a non-active Automaton and of a generated stable from the strategy rows and the human reference row', async () => {
    const { comparison } = await isolatedComparison();
    expect(comparison.rows.map((row) => row.strategyKey)).toEqual(['paragon', 'swarm', null]);
    const rowOf = (key: string | null): StrategyComparison['rows'][number] => {
      const row = comparison.rows.find((candidate) => candidate.strategyKey === key);
      if (!row) throw new Error(`no row for ${String(key)}`);
      return row;
    };
    const modeOf = (key: string | null, mode: string): ModePerformance | undefined => rowOf(key).modes.find((m) => m.mode === mode);

    // The draft Swarm stable (champion 1v1 9–1, champion KotH 7 matches) is not counted.
    expect(rowOf('swarm')).toMatchObject({ stables: 2, bestTier: { tier: 'gold', stables: 2 } });
    expect(modeOf('swarm', 'league_1v1')).toMatchObject({ stablesPlayed: 2, entitiesPlayed: 2, wins: 3, losses: 3, matches: 6 });
    expect(modeOf('swarm', 'koth')).toMatchObject({ stablesPlayed: 1, matches: 5, wins: 1 });

    // The generated stable (champion 1v1 6–0, champion KotH 4 matches) is not a Human_Stable.
    expect(rowOf(null)).toMatchObject({ stables: 2, bestTier: { tier: 'diamond', stables: 1 } });
    expect(modeOf(null, 'league_1v1')).toMatchObject({ stablesPlayed: 2, wins: 5, losses: 1, matches: 6 });
    expect(modeOf(null, 'koth')).toMatchObject({ matches: 0 });
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
