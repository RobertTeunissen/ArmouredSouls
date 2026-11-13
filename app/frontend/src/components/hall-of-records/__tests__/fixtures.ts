/**
 * Shared Hall of Records payloads for the component and page tests.
 */
import type { RecordsData, RecordRobot, RobotRecordBase } from '../types';

export const AUTO = { userId: 11, username: 'Kamino Clone Legion', stableType: 'automaton' as const };
export const HUMAN = { userId: 12, username: 'Iron Warriors', stableType: 'human' as const };
export const VIEWER = { userId: 1, username: 'ApenRots', stableType: 'human' as const };
const DATE = '2026-03-15T00:00:00Z';

const autoRobot: RecordRobot = { id: 101, name: 'CT-7567 Rex', ...AUTO };
const humanRobot: RecordRobot = { id: 102, name: 'Ironclad', ...HUMAN };
const viewerRobot: RecordRobot = { id: 103, name: 'GekkeAap', ...VIEWER };

function robotRow<T extends object>(owner: RecordRobot, extra: T): RobotRecordBase & T {
  return { robotId: owner.id, robotName: owner.name, userId: owner.userId, username: owner.username, stableType: owner.stableType, ...extra };
}

/** Every numeric field scaled down, so a derived row ranks below the one it came from. */
function scaled<T extends object>(row: T, factor: number): T {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, typeof value === 'number' ? Math.round(value * factor) : value]),
  ) as T;
}

/**
 * The Automaton holds the top of every list; a human and then the viewer
 * follow. Omitted rows are the top row scaled to 90% and 80%.
 */
function robotRows<T extends object>(top: T, second: T = scaled(top, 0.9), third: T = scaled(top, 0.8)): Array<RobotRecordBase & T> {
  return [robotRow(autoRobot, top), robotRow(humanRobot, second), robotRow(viewerRobot, third)];
}

export function fullRecords(): RecordsData {
  return {
    combat: {
      mostDamageInBattle: {
        league_1v1: [{ battleId: 201, damageDealt: 2736, robot: autoRobot, opponent: humanRobot, durationSeconds: 90, date: DATE }],
        grand_melee: [{ battleId: 202, damageDealt: 4102, robot: humanRobot, durationSeconds: 120, date: DATE }],
      },
    },
    upsets: {
      biggestUpset: [{
        battleId: 203, eloDifference: 446, date: DATE,
        underdog: { ...autoRobot, eloBefore: 1491 }, favorite: { ...humanRobot, eloBefore: 1937 },
      }],
      biggestTeamUpset: [{
        battleId: 204, battleType: 'tournament_3v3', eloDifference: 732, date: DATE,
        underdog: { robots: [autoRobot], teamEloBefore: 3000 }, favorite: { robots: [humanRobot], teamEloBefore: 3732 },
      }],
    },
    career: {
      mostBattles: robotRows(
        { allModesBattleCount: 739, totalBattles: 600, wins: 300, losses: 280, draws: 20, winRate: 50, elo: 1500 },
        { allModesBattleCount: 737, totalBattles: 500, wins: 250, losses: 240, draws: 10, winRate: 50, elo: 1400 },
        { allModesBattleCount: 734, totalBattles: 559, wins: 200, losses: 350, draws: 9, winRate: 35.8, elo: 1300 },
      ),
      highestWinRate: robotRows({ totalBattles: 71, wins: 69, winRate: 97.2, elo: 1700 }),
      mostLifetimeDamage: robotRows({ damageDealt: 373601, totalBattles: 495, allModesBattleCount: 675, avgDamagePerBattle: 553 }),
      highestElo: robotRows({ elo: 2393, wins: 470, losses: 20, draws: 5 }),
      mostKills: robotRows({ kills: 756, totalBattles: 495, allModesBattleCount: 675, killsPerBattle: 1.12 }),
    },
    economic: {
      highestFame: robotRows({ fame: 31116, elo: 2393 }),
      richestStables: [
        { ...AUTO, userId: 11, currency: 5_000_000, prestige: 100, robotCount: 3 },
        { ...VIEWER, userId: 1, currency: 4_000_000, prestige: 90, robotCount: 2 },
      ],
    },
    prestige: {
      highestPrestige: [
        { ...AUTO, userId: 11, prestige: 94515, championshipTitles: 1, robotCount: 3 },
        { ...VIEWER, userId: 1, prestige: 90803, championshipTitles: 5, robotCount: 11 },
      ],
      mostTitles: [{ ...AUTO, userId: 11, championshipTitles: 20, prestige: 58748, robotCount: 4 }],
    },
    koth: {
      mostWins: robotRows({ kothWins: 41, kothMatches: 60, winRate: 68.3 }),
      highestAvgZoneScore: robotRows({ avgZoneScore: 25.3, kothMatches: 19 }),
      mostKillsCareer: robotRows({ kothKills: 89, kothMatches: 94 }),
      longestWinStreak: robotRows({ bestWinStreak: 26, kothWins: 41, currentWinStreak: 26, isActive: true }),
      mostZoneTime: robotRows({ totalZoneTime: 3631.6, kothMatches: 82 }),
      zoneDominator: robotRows({ totalZoneScore: 1163.1, kothMatches: 60 }),
    },
    teamBattle: {
      '2v2': { mostDecisiveVictory: [] },
      '3v3': { mostDecisiveVictory: [{ battleId: 205, hpDifference: 975, winners: [autoRobot], losers: [humanRobot], date: DATE }] },
    },
    grandMelee: {
      mostWins: robotRows({ grandMeleeWins: 44 }),
      mostKillsCareer: robotRows({ totalKills: 396, grandMeleeMatches: 37, killsPerMatch: 10.7 }),
    },
    winStreaks: {
      league_1v1: [
        { entityId: autoRobot.id, entityName: autoRobot.name, ...AUTO, bestWinStreak: 33, currentWinStreak: 33, isActive: true, wins: 69 },
        { entityId: viewerRobot.id, entityName: viewerRobot.name, ...VIEWER, bestWinStreak: 12, currentWinStreak: 0, isActive: false, wins: 40 },
      ],
      league_2v2: [
        { entityId: 900, entityName: 'TopHit', ...AUTO, bestWinStreak: 72, currentWinStreak: 2, isActive: false, wins: 90 },
      ],
    },
    tournamentChampions1v1: [{
      tournamentId: 9, tournamentName: '1v1 Tournament #9', championName: autoRobot.name, championRobotId: autoRobot.id,
      ownerStableName: AUTO.username, ownerUserId: AUTO.userId, ownerStableType: 'automaton', completedAt: DATE, participantType: 'robot',
    }],
    tournamentChampions3v3: [{
      tournamentId: 16, tournamentName: '3v3 Tournament #16', championName: 'De Toppers', memberRobots: ['A', 'B', 'C'],
      ownerStableName: AUTO.username, ownerUserId: AUTO.userId, ownerStableType: 'automaton', completedAt: DATE, participantType: 'team_3v3',
    }],
    timestamp: DATE,
  };
}

/** A payload with no record at all (a fresh season). */
export function emptyRecords(): RecordsData {
  return {
    combat: { mostDamageInBattle: {} },
    upsets: { biggestUpset: [], biggestTeamUpset: [] },
    career: { mostBattles: [], highestWinRate: [], mostLifetimeDamage: [], highestElo: [], mostKills: [] },
    economic: { highestFame: [], richestStables: [] },
    prestige: { highestPrestige: [], mostTitles: [] },
    koth: { mostWins: [], highestAvgZoneScore: [], mostKillsCareer: [], longestWinStreak: [], mostZoneTime: [], zoneDominator: [] },
    teamBattle: { '2v2': { mostDecisiveVictory: [] }, '3v3': { mostDecisiveVictory: [] } },
    grandMelee: { mostWins: [], mostKillsCareer: [] },
    winStreaks: {},
    timestamp: DATE,
  };
}
