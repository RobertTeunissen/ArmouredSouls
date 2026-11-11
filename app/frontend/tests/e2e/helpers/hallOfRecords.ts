import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { API_URL } from './automaton';

/**
 * A full Hall of Records payload with ACC-like names and values (Nov 2026), so
 * the layout specs see every record, long names, an Automaton and a generated
 * stable, and places for the signed-in player, regardless of the seed data.
 * The viewer's stable holds the 1v1 league streak and a few top-10 places.
 */
export function recordsFixture(viewer: { userId: number; username: string }) {
  const S = (userId: number, username: string, stableType = 'human') => ({ userId, username, stableType });
  const HM = S(900001, 'Hit Machine');
  const FR = S(900002, 'Fractals');
  const LG = S(900003, 'LortGob Industries');
  const ME = S(viewer.userId, viewer.username);
  const AUTO = S(900004, 'Moshimo Robotics', 'automaton');
  const BOT = S(900005, 'Argent Armaments', 'generated');
  const robot = (id: number, name: string, owner: ReturnType<typeof S>) => ({ id, name, ...owner });
  const row = (id: number, name: string, owner: ReturnType<typeof S>, extra: object) => ({ robotId: id, robotName: name, ...owner, ...extra });
  const D = '2026-11-07T13:00:00Z';

  return {
    combat: {
      mostDamageInBattle: {
        league_1v1: [{ battleId: 1, damageDealt: 2736, robot: robot(1, 'Bolt', LG), opponent: robot(2, 'Gobbo', LG), durationSeconds: 80, date: D }],
        tournament_1v1: [{ battleId: 2, damageDealt: 2015, robot: robot(3, 'HitFast', HM), opponent: robot(2, 'Gobbo', LG), durationSeconds: 70, date: D }],
        league_2v2: [{ battleId: 3, damageDealt: 2029, robot: robot(4, 'Evening Ride', FR), durationSeconds: 100, date: D }],
        league_3v3: [{ battleId: 4, damageDealt: 4477, robot: robot(5, 'Smith Volterra Cantor', FR), durationSeconds: 110, date: D }],
        koth: [{ battleId: 5, damageDealt: 3441, robot: robot(5, 'Smith Volterra Cantor', FR), durationSeconds: 120, date: D }],
        grand_melee: [{ battleId: 6, damageDealt: 4102, robot: robot(6, 'Feigenbaum', FR), durationSeconds: 120, date: D }],
      },
    },
    upsets: {
      biggestUpset: [{ battleId: 7, eloDifference: 446, date: D, underdog: { ...robot(3, 'HitFast', HM), eloBefore: 1491 }, favorite: { ...robot(2, 'Gobbo', LG), eloBefore: 1937 } }],
      biggestTeamUpset: [{ battleId: 8, battleType: 'tournament_3v3', eloDifference: 732, date: D,
        underdog: { robots: [robot(7, 'Tahu', AUTO), robot(8, 'Kopaka', AUTO)], teamEloBefore: 3000 },
        favorite: { robots: [robot(9, 'WimpBot Lone Glint 1', BOT)], teamEloBefore: 3732 } }],
    },
    career: {
      mostBattles: [
        row(10, 'Gobster', LG, { allModesBattleCount: 739, totalBattles: 553, wins: 300, losses: 240, draws: 13, winRate: 54.2, elo: 1990 }),
        row(11, 'GekkeAap', ME, { allModesBattleCount: 734, totalBattles: 559, wins: 280, losses: 270, draws: 9, winRate: 50.1, elo: 1700 }),
      ],
      highestWinRate: [row(3, 'HitFast', HM, { totalBattles: 71, wins: 69, winRate: 97.2, elo: 1800 })],
      mostLifetimeDamage: [row(12, 'HitHard', HM, { damageDealt: 373601, totalBattles: 495, allModesBattleCount: 675, avgDamagePerBattle: 553 })],
      highestElo: [row(12, 'HitHard', HM, { elo: 2393, wins: 470, losses: 20, draws: 5 })],
      mostKills: [
        row(12, 'HitHard', HM, { kills: 756, totalBattles: 495, allModesBattleCount: 675, killsPerBattle: 1.12 }),
        row(13, 'StommeAap', ME, { kills: 536, totalBattles: 336, allModesBattleCount: 449, killsPerBattle: 1.19 }),
      ],
    },
    economic: {
      highestFame: [row(12, 'HitHard', HM, { fame: 31116, elo: 2393 })],
      richestStables: [{ ...S(900006, 'Sexy Stables'), currency: 103999060, prestige: 33668, robotCount: 6 }],
    },
    prestige: {
      highestPrestige: [{ ...FR, prestige: 94515, championshipTitles: 1, robotCount: 9 }, { ...ME, prestige: 90803, championshipTitles: 5, robotCount: 11 }],
      mostTitles: [{ ...HM, championshipTitles: 20, prestige: 58748, robotCount: 4 }],
    },
    koth: {
      mostWins: [row(14, 'Linda Keen', FR, { kothWins: 41, kothMatches: 60, winRate: 68.3 })],
      highestAvgZoneScore: [row(3, 'HitFast', HM, { avgZoneScore: 25.3, kothMatches: 19 })],
      mostKillsCareer: [row(15, 'HitFar', HM, { kothKills: 89, kothMatches: 94 })],
      longestWinStreak: [row(16, 'Nuria Fagella', FR, { bestWinStreak: 26, kothWins: 30, currentWinStreak: 0, isActive: false })],
      mostZoneTime: [row(17, 'ExpertBot Guardian Nova 1', BOT, { totalZoneTime: 3631.6, kothMatches: 82 })],
      zoneDominator: [row(14, 'Linda Keen', FR, { totalZoneScore: 1163.1, kothMatches: 60 })],
    },
    teamBattle: {
      '2v2': { mostDecisiveVictory: [{ battleId: 9, hpDifference: 750, winners: [robot(18, 'TopHit A', HM), robot(19, 'TopHit B', HM)], losers: [robot(1, 'Bolt', LG)], date: D }] },
      '3v3': { mostDecisiveVictory: [{ battleId: 10, hpDifference: 975, winners: [robot(12, 'HitHard', HM), robot(15, 'HitFar', HM), robot(3, 'HitFast', HM)], losers: [robot(7, 'Tahu', AUTO)], date: D }] },
    },
    grandMelee: {
      mostWins: [row(15, 'HitFar', HM, { grandMeleeWins: 44 }), row(12, 'HitHard', HM, { grandMeleeWins: 44 })],
      mostKillsCareer: [row(20, 'Pierre Fatou', FR, { totalKills: 396, grandMeleeMatches: 37, killsPerMatch: 10.7 })],
    },
    winStreaks: {
      league_1v1: [{ entityId: 21, entityName: 'GoreAap', ...ME, bestWinStreak: 33, currentWinStreak: 33, isActive: true, wins: 124 }],
      league_2v2: [{ entityId: 22, entityName: 'TopHit', ...HM, bestWinStreak: 72, currentWinStreak: 2, isActive: false, wins: 90 }],
      league_3v3: [{ entityId: 23, entityName: 'LortGob Industries 3v3', ...LG, bestWinStreak: 45, currentWinStreak: 1, isActive: false, wins: 80 }],
      tag_team: [{ entityId: 22, entityName: 'TopHit', ...HM, bestWinStreak: 46, currentWinStreak: 5, isActive: false, wins: 70 }],
    },
    tournamentChampions1v1: [{ tournamentId: 9, tournamentName: '1v1 Tournament #9', championName: 'Feigenbaum', championRobotId: 6, ownerStableName: 'Fractals', ownerUserId: 900002, ownerStableType: 'human', completedAt: D, participantType: 'robot' }],
    tournamentChampions3v3: [{ tournamentId: 16, tournamentName: '3v3 Tournament #16', championName: 'De Toppers', memberRobots: ['HitHard', 'HitFar', 'HitFast'], ownerStableName: 'Hit Machine', ownerUserId: 900001, ownerStableType: 'human', completedAt: D, participantType: 'team_3v3' }],
    timestamp: D,
  };
}

/** The signed-in player's id and stable name, read with the session's token. */
export async function signedInStable(page: Page, request: APIRequestContext): Promise<{ userId: number; username: string }> {
  const token = await page.evaluate(() => localStorage.getItem('token'));
  expect(token, 'no session token in localStorage').toBeTruthy();
  const response = await request.get(`${API_URL}/api/user/profile`, { headers: { Authorization: `Bearer ${token}` } });
  expect(response.ok()).toBeTruthy();
  const profile = (await response.json()) as { id: number; username: string; stableName?: string | null };
  return { userId: profile.id, username: profile.stableName || profile.username };
}

/**
 * The players' payload (`?stables=players`, #595): only human stables'
 * entries, each with its place among every stable. The viewer's GekkeAap is
 * #14 on ELO; the Automaton and bot entries are gone.
 */
export function playersRecordsFixture(viewer: { userId: number; username: string }) {
  const all = recordsFixture(viewer);
  const ME = { userId: viewer.userId, username: viewer.username, stableType: 'human' };
  const HM = { userId: 900001, username: 'Hit Machine', stableType: 'human' };
  return {
    ...all,
    stables: 'players',
    upsets: { biggestUpset: all.upsets.biggestUpset.map((e) => ({ ...e, place: 1 })), biggestTeamUpset: [] },
    career: {
      ...all.career,
      highestElo: [
        { robotId: 12, robotName: 'HitHard', ...HM, elo: 2393, wins: 470, losses: 20, draws: 5, place: 1 },
        { robotId: 11, robotName: 'GekkeAap', ...ME, elo: 1980, wins: 280, losses: 270, draws: 9, place: 14 },
      ],
    },
    koth: { ...all.koth, mostZoneTime: [] },
    timestamp: all.timestamp,
  };
}

/** Answer `/api/records` (both Stables filters) with the fixtures for this page. */
export async function mockRecords(page: Page, viewer: { userId: number; username: string }): Promise<void> {
  await page.route(/\/api\/records(\?.*)?$/, (route) => {
    const players = new URL(route.request().url()).searchParams.get('stables') === 'players';
    return route.fulfill({ json: players ? playersRecordsFixture(viewer) : recordsFixture(viewer) });
  });
}
