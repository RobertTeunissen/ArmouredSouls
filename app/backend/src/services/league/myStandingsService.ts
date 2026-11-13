/**
 * The viewer's own places in every tiered league (`GET /api/leagues/my-standings`):
 * each robot (1v1, KotH, Grand Melee) and team (2v2, 3v3, Tag Team) with a
 * standing, its place in its instance and its status at the next rebalance.
 *
 * Feeds the league cards on `/league-standings` and the page's opening view.
 * One query loads the viewer's standings, one loads every tier they occupy
 * (planner fields only), one counts the tiers above; the executor's planner
 * then runs in memory per tier, so the statuses match `getLeagueTierPreview`.
 */
import prisma from '../../lib/prisma';
import type { Prisma, StandingsMode } from '../../../generated/prisma';
import { buildLeagueTierPreview, nextTierOf, type PlannableStanding } from './league-rebalancing-preview';
import { getLeagueRulesForMode, TIERED_LEAGUE_MODES, type TieredLeagueMode } from './league-rules';
import { buildStandingStatuses } from './standing-status';
import type { MyStandingEntry, MyStandings, StandingStatus } from '../../shared/types';

const ROBOT_MODES: readonly TieredLeagueMode[] = ['league_1v1', 'koth', 'grand_melee'];
const TEAM_MODES: readonly TieredLeagueMode[] = ['league_2v2', 'league_3v3', 'tag_team'];

type TierRow = PlannableStanding & { mode: StandingsMode; tier: string };

const pairKey = (mode: string, tier: string): string => `${mode}|${tier}`;

export async function getMyStandings(userId: number): Promise<MyStandings> {
  const [robots, teams] = await Promise.all([
    prisma.robot.findMany({ where: { userId }, select: { id: true, name: true } }),
    prisma.teamBattle.findMany({ where: { stableId: userId }, select: { id: true, teamName: true } }),
  ]);
  if (robots.length === 0 && teams.length === 0) return { entries: [] };

  const robotNames = new Map(robots.map((r) => [r.id, r.name]));
  const teamNames = new Map(teams.map((t) => [t.id, t.teamName]));
  const ownFilters: Prisma.StandingWhereInput[] = [];
  if (robots.length > 0) {
    ownFilters.push({ entityType: 'robot', mode: { in: [...ROBOT_MODES] }, entityId: { in: robots.map((r) => r.id) } });
  }
  if (teams.length > 0) {
    ownFilters.push({ entityType: 'team', mode: { in: [...TEAM_MODES] }, entityId: { in: teams.map((t) => t.id) } });
  }

  const own = await prisma.standing.findMany({
    where: { OR: ownFilters },
    select: { entityType: true, entityId: true, mode: true, tier: true, leagueInstanceId: true, leaguePoints: true, cyclesInTier: true },
  });
  if (own.length === 0) return { entries: [] };

  const pairs = new Map<string, { mode: StandingsMode; tier: string }>();
  for (const s of own) pairs.set(pairKey(s.mode, s.tier), { mode: s.mode, tier: s.tier });

  const [tierRows, populations] = await Promise.all([
    prisma.standing.findMany({
      where: { OR: [...pairs.values()].map(({ mode, tier }) => ({ mode, tier })) },
      select: { mode: true, tier: true, entityId: true, leagueInstanceId: true, leaguePoints: true, cyclesInTier: true },
    }),
    prisma.standing.groupBy({
      by: ['mode', 'tier'],
      where: { mode: { in: [...new Set(own.map((s) => s.mode))] } },
      _count: { _all: true },
    }),
  ]);

  const populationOf = new Map(populations.map((p) => [pairKey(p.mode, p.tier), p._count._all]));
  const rowsByPair = new Map<string, TierRow[]>();
  for (const row of tierRows) {
    const key = pairKey(row.mode, row.tier);
    const list = rowsByPair.get(key) ?? [];
    list.push(row);
    rowsByPair.set(key, list);
  }

  // Per (mode, tier): statuses from the tier plan, and every entity's instance place.
  const statusByPair = new Map<string, Map<number, StandingStatus>>();
  const placeByPair = new Map<string, Map<number, { place: number; size: number }>>();
  for (const [key, { mode, tier }] of pairs) {
    const rules = getLeagueRulesForMode(mode);
    const rows = rowsByPair.get(key) ?? [];
    const nextTier = nextTierOf(tier, rules);
    const preview = buildLeagueTierPreview(tier, rows, rules, nextTier ? populationOf.get(pairKey(mode, nextTier)) ?? 0 : 0);
    statusByPair.set(key, buildStandingStatuses(preview, rules));

    const places = new Map<number, { place: number; size: number }>();
    const byInstance = new Map<string, TierRow[]>();
    for (const row of rows) {
      const list = byInstance.get(row.leagueInstanceId) ?? [];
      list.push(row);
      byInstance.set(row.leagueInstanceId, list);
    }
    for (const list of byInstance.values()) {
      list.sort((a, b) => b.leaguePoints - a.leaguePoints || a.entityId - b.entityId);
      list.forEach((row, index) => places.set(row.entityId, { place: index + 1, size: list.length }));
    }
    placeByPair.set(key, places);
  }

  const modeOrder = (mode: string): number => TIERED_LEAGUE_MODES.indexOf(mode as TieredLeagueMode);
  const entries = own.map((s): MyStandingEntry => {
    const key = pairKey(s.mode, s.tier);
    const place = placeByPair.get(key)?.get(s.entityId) ?? { place: 0, size: 0 };
    const isRobot = s.entityType === 'robot';
    return {
      mode: s.mode as TieredLeagueMode,
      entityType: isRobot ? 'robot' : 'team',
      entityId: s.entityId,
      name: (isRobot ? robotNames.get(s.entityId) : teamNames.get(s.entityId)) ?? `#${s.entityId}`,
      tier: s.tier,
      leagueInstanceId: s.leagueInstanceId,
      place: place.place,
      instanceSize: place.size,
      leaguePoints: s.leaguePoints,
      cyclesInTier: s.cyclesInTier,
      minCycles: getLeagueRulesForMode(s.mode).minCyclesForRebalancing,
      status: statusByPair.get(key)?.get(s.entityId) ?? null,
    };
  });

  const tierRank = (mode: string, tier: string): number => getLeagueRulesForMode(mode).tiers.indexOf(tier);
  entries.sort((a, b) =>
    modeOrder(a.mode) - modeOrder(b.mode)
    || tierRank(b.mode, b.tier) - tierRank(a.mode, a.tier)
    || a.place - b.place
    || a.entityId - b.entityId);

  return { entries };
}
