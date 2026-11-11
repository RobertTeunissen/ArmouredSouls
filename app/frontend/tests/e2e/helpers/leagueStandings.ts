import type { Page } from '@playwright/test';

/**
 * An ACC-like League Standings fixture (Nov 2026, 1v1 Diamond 1): 67 robots,
 * the whole top six held below the 125 LP minimum, the viewer's robot third,
 * two of theirs new in the tier, the bottom six still short of five cycles.
 * Long names, a generated (bot) stable and an Automaton are included.
 * With `stables=players` (#595) only the viewer's three robots remain, at
 * their places among all 67.
 */

export interface Viewer {
  userId: number;
  username: string;
}

const AUTOMATON = { userId: 9001, name: 'Ruin-Era Synthetic Unit', stableType: 'automaton' };
const BOTS = { userId: 9002, name: 'Zenith Engineering Consolidated', stableType: 'generated' };

type Status = { kind: string; zone: string; minLP?: number; cyclesToGo?: number } | null;

function robot(rank: number, viewer: Viewer, total: number, instance: string) {
  const owner = rank === 3 || rank === 52 || rank === 59
    ? { userId: viewer.userId, name: viewer.username, stableType: 'human' }
    : rank % 7 === 0 ? AUTOMATON : BOTS;
  const name = rank === 3 ? 'StommeAap' : rank === 52 ? 'GoreAap' : rank === 59 ? 'GemeneAap'
    : rank === 1 ? 'AverageBot Guardian Glimmer Overclocked 1' : `AverageBot Lone Pulse ${rank}`;
  const cycles = rank === 52 || rank === 59 ? 0 : rank > 61 ? 2 : 12;
  let status: Status = null;
  if (rank <= 6) status = { kind: 'held_lp', zone: 'promotion', minLP: 125 };
  if (rank > total - 6) status = { kind: 'held_cycles', zone: 'demotion', cyclesToGo: 5 - cycles };
  return {
    rank, id: 5000 + rank, name, leagueInstanceId: instance, elo: 1200 + rank, leaguePoints: 124 - Math.floor(rank / 3), wins: 45, draws: 3, losses: 30,
    totalBattles: 78, userId: owner.userId, cyclesInCurrentLeague: cycles, isSubscribed: rank !== 40,
    user: { username: owner.name, stableName: owner.name, stableType: owner.stableType }, status,
  };
}

const zoneMeta = (tier: string, total: number, instances: number) => ({
  tier, minLP: tier === 'champion' ? null : 125, minCycles: 5, minRobotsRequired: 10, hasEnoughRobots: true,
  promotionSlots: tier === 'champion' ? 0 : Math.floor(total / 10), demotionSlots: Math.floor(total / 10),
  promotionCandidates: 0, effectivePromotionCandidates: 0, promotionBlockReason: null, totalEntities: total,
  totalInstances: instances, activeInstances: instances, instancesBelowMinimum: 0, smallestInstancePopulation: total,
  isChampion: tier === 'champion', isBronze: tier === 'bronze',
});

/** Answer the League Standings endpoints from the fixture (other `/api` calls go through). */
export async function mockLeagueStandings(page: Page, viewer: Viewer): Promise<void> {
  const entries = [
    { mode: 'league_1v1', entityType: 'robot', entityId: 5003, name: 'StommeAap', tier: 'diamond', leagueInstanceId: 'diamond_1', place: 3, instanceSize: 67, leaguePoints: 123, cyclesInTier: 12, minCycles: 5, status: { kind: 'held_lp', zone: 'promotion', minLP: 125 } },
    { mode: 'league_1v1', entityType: 'robot', entityId: 5052, name: 'GoreAap', tier: 'diamond', leagueInstanceId: 'diamond_1', place: 52, instanceSize: 67, leaguePoints: 107, cyclesInTier: 0, minCycles: 5, status: null },
    { mode: 'league_1v1', entityType: 'robot', entityId: 5059, name: 'GemeneAap', tier: 'diamond', leagueInstanceId: 'diamond_1', place: 59, instanceSize: 67, leaguePoints: 105, cyclesInTier: 0, minCycles: 5, status: null },
    { mode: 'koth', entityType: 'robot', entityId: 5003, name: 'StommeAap', tier: 'platinum', leagueInstanceId: 'platinum_4', place: 2, instanceSize: 86, leaguePoints: 260, cyclesInTier: 9, minCycles: 10, status: { kind: 'held_cycles', zone: 'promotion', cyclesToGo: 1 } },
  ];

  await page.route('**/api/leagues/my-standings', (route) => route.fulfill({ json: { entries } }));
  await page.route(/\/api\/leagues\/[a-z]+\/instances/, (route) => {
    const tier = new URL(route.request().url()).pathname.split('/')[3];
    return route.fulfill({ json: [{ leagueId: `${tier}_1`, currentRobots: 67, players: 3 }, { leagueId: `${tier}_2`, currentRobots: 66, players: 0 }] });
  });
  await page.route(/\/api\/leagues\/[a-z]+\/standings/, (route) => {
    const url = new URL(route.request().url());
    const tier = url.pathname.split('/')[3];
    const instance = url.searchParams.get('instance');
    const total = instance ? 67 : 133;
    const page = Number(url.searchParams.get('page') ?? '1');
    const perPage = Number(url.searchParams.get('perPage') ?? '50');
    const all = Array.from({ length: total }, (_, i) => robot(i + 1, viewer, total, instance ?? `${tier}_${i < 67 ? 1 : 2}`));
    const listed = url.searchParams.get('stables') === 'players' ? all.filter((r) => r.user.stableType === 'human') : all;
    const rows = listed.slice((page - 1) * perPage, page * perPage);
    return route.fulfill({
      json: {
        data: rows,
        pagination: { page, pageSize: perPage, total: listed.length, totalPages: Math.max(1, Math.ceil(listed.length / perPage)) },
        zoneMeta: zoneMeta(tier, total, instance ? 1 : 2),
      },
    });
  });
}
