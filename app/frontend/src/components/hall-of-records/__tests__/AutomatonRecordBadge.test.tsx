/**
 * Hall of Records — Automaton_Badge on every record (Spec #55 decision 42).
 *
 * Every record that names a stable shows the badge directly after an Automaton
 * stable's name, including the robot records ("Robot by Stable"), battle details,
 * team line-ups and tournament champions. Human and generated stables get none.
 */
import { describe, it, expect, vi } from 'vitest';
import type { ReactElement } from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RecordStableName } from '../RecordStableName';
import {
  CareerRecords,
  CombatRecords,
  EconomicRecords,
  GrandMeleeRecords,
  KothRecords,
  TeamBattleRecords,
  TournamentChampionsRecords,
  UpsetRecords,
  WinStreakRecords,
} from '..';
import type { RecordsData } from '../types';

const AUTO = { username: 'Kamino Clone Legion', stableType: 'automaton' as const };
const HUMAN = { username: 'Iron Warriors', stableType: 'human' as const };
const DATE = '2026-03-15T00:00:00Z';
const formatDuration = (s: number) => `${s}s`;
const formatDate = () => '15 Mar 2026';

/** One Automaton-held and one human-held entry per list. */
function robotRows<T extends object>(extra: T) {
  return [
    { robotId: 1, robotName: 'CT-7567 Rex', ...AUTO, ...extra },
    { robotId: 2, robotName: 'Ironclad', ...HUMAN, ...extra },
  ];
}

const autoRobot = { id: 1, name: 'CT-7567 Rex', ...AUTO };
const humanRobot = { id: 2, name: 'Ironclad', ...HUMAN };
const teamRow = { battleId: 300, durationSeconds: 40, team1: [autoRobot], team2: [humanRobot], date: DATE };
const teamSize = {
  fastestVictory: [teamRow],
  longestSurvival: [{ battleId: 301, survivalSeconds: 90, robot: autoRobot, date: DATE }],
  mostDamageDealt: [{ battleId: 302, damageDealt: 900, robot: autoRobot, durationSeconds: 60, date: DATE }],
  mostDecisiveVictory: [{ ...teamRow, battleId: 303, hpDifference: 120 }],
  longestNonDrawBattle: [{ ...teamRow, battleId: 304 }],
};
const emptyTeamSize = {
  fastestVictory: [], longestSurvival: [], mostDamageDealt: [], mostDecisiveVictory: [], longestNonDrawBattle: [],
};

const records = {
  combat: {
    mostDamageInBattle: {
      league_1v1: [{ battleId: 101, damageDealt: 1500, robot: autoRobot, opponent: humanRobot, durationSeconds: 90, date: DATE }],
    },
    narrowestVictory: [{ battleId: 102, remainingHP: 3, winner: autoRobot, loser: humanRobot, date: DATE }],
  },
  upsets: {
    biggestUpset: [{
      battleId: 201, eloDifference: 300, date: DATE,
      underdog: { ...autoRobot, eloBefore: 1000 }, favorite: { ...humanRobot, eloBefore: 1300 },
    }],
    biggestTeamUpset: [{
      battleId: 202, battleType: 'tournament_2v2', eloDifference: 500, date: DATE,
      underdog: { robots: [autoRobot], teamEloBefore: 2000 }, favorite: { robots: [humanRobot], teamEloBefore: 2500 },
    }],
  },
  career: {
    mostBattles: robotRows({ totalBattles: 10, wins: 5, losses: 4, draws: 1, winRate: 50, elo: 1200 }),
    highestWinRate: robotRows({ totalBattles: 60, wins: 50, winRate: 83.3, elo: 1300, league: 'gold' }),
    mostLifetimeDamage: robotRows({ damageDealt: 9000, totalBattles: 10, avgDamagePerBattle: 900 }),
    highestElo: robotRows({ elo: 1500, league: 'gold', wins: 9, losses: 1, draws: 0 }),
    mostKills: robotRows({ kills: 7, totalBattles: 10, killRate: 70 }),
  },
  economic: {
    mostExpensiveBattle: [],
    highestFame: robotRows({ fame: 4000, league: 'gold', elo: 1400 }),
    richestStables: [
      { userId: 11, ...AUTO, currency: 5_000_000, totalBattles: 0, prestige: 100, robotCount: 3 },
      { userId: 12, ...HUMAN, currency: 4_000_000, totalBattles: 0, prestige: 90, robotCount: 2 },
    ],
  },
  prestige: { highestPrestige: [], mostTitles: [] },
  koth: {
    mostWins: robotRows({ kothWins: 5, kothMatches: 9, winRate: 55.6 }),
    highestAvgZoneScore: robotRows({ avgZoneScore: 12.5, kothMatches: 9 }),
    mostKillsCareer: robotRows({ kothKills: 8, kothMatches: 9 }),
    longestWinStreak: robotRows({ bestWinStreak: 4, kothWins: 5 }),
    mostZoneTime: robotRows({ totalZoneTime: 300, kothMatches: 9 }),
    zoneDominator: robotRows({ avgZoneScore: 12.5, kothMatches: 9, totalZoneScore: 112.5 }),
  },
  teamBattle: { '2v2': teamSize, '3v3': emptyTeamSize },
  grandMelee: {
    mostWins: robotRows({ grandMeleeWins: 3 }),
    highestLp: robotRows({ leaguePoints: 40, tier: 'gold' }),
    mostKillsCareer: robotRows({ totalKills: 12, grandMeleeMatches: 6, killsPerMatch: 2 }),
  },
  winStreaks: {
    league_1v1: [
      { entityId: 1, entityName: 'CT-7567 Rex', ...AUTO, bestWinStreak: 9, currentWinStreak: 9, isActive: true, wins: 20 },
      { entityId: 2, entityName: 'Ironclad', ...HUMAN, bestWinStreak: 5, currentWinStreak: 0, isActive: false, wins: 12 },
    ],
  },
  tournamentChampions1v1: [{
    tournamentId: 1, tournamentName: 'Cup #1', championName: 'CT-7567 Rex', ownerStableName: AUTO.username,
    ownerStableType: 'automaton', completedAt: DATE, participantType: 'robot',
  }],
  tournamentChampions2v2: [{
    tournamentId: 2, tournamentName: 'Cup #2', championName: 'Iron Pair', memberRobots: ['Ironclad'],
    ownerStableName: HUMAN.username, ownerStableType: 'human', completedAt: DATE, participantType: 'team_2v2',
  }],
  timestamp: DATE,
} as unknown as RecordsData;

function badgeCount(ui: ReactElement): number {
  render(<MemoryRouter>{ui}</MemoryRouter>);
  return screen.queryAllByTestId('automaton-badge').length;
}

describe('RecordStableName', () => {
  it('adds the badge after an Automaton stable name on the same line', () => {
    render(<p><RecordStableName name={AUTO.username} stableType="automaton" /></p>);
    const wrapper = screen.getByTestId('record-stable-name');
    expect(wrapper).toHaveClass('flex-nowrap');
    expect(wrapper.firstElementChild).toHaveTextContent(AUTO.username);
    expect(wrapper.lastElementChild).toHaveAttribute('data-testid', 'automaton-badge');
  });

  it.each(['human', 'generated', null, undefined] as const)('renders plain text for %s stables', (stableType) => {
    const { container } = render(<p><RecordStableName name={HUMAN.username} stableType={stableType} /></p>);
    expect(container.textContent).toBe(HUMAN.username);
    expect(screen.queryByTestId('automaton-badge')).not.toBeInTheDocument();
  });
});

describe('Hall of Records — badge on every record (decision 42)', () => {
  it('career: all five robot lists', () => {
    expect(badgeCount(<CareerRecords records={records} />)).toBe(5);
  });

  it('economic: highest fame robot record and richest stable', () => {
    expect(badgeCount(<EconomicRecords records={records} />)).toBe(2);
  });

  it('KotH: all six robot lists', () => {
    expect(badgeCount(<KothRecords records={records} formatDuration={formatDuration} />)).toBe(6);
  });

  it('Grand Melee: all three robot lists', () => {
    expect(badgeCount(<GrandMeleeRecords records={records} />)).toBe(3);
  });

  it('win streaks', () => {
    expect(badgeCount(<WinStreakRecords records={records} />)).toBe(1);
  });

  it('combat: most damage and narrowest victory details', () => {
    expect(badgeCount(
      <CombatRecords records={records} formatDuration={formatDuration} formatDate={formatDate} onBattleClick={vi.fn()} />,
    )).toBe(2);
    const robotLine = screen.getByText(/^Robot:/);
    expect(within(robotLine).getByTestId('automaton-badge')).toBeInTheDocument();
  });

  it('upsets: 1v1 underdog and team underdog stable', () => {
    expect(badgeCount(<UpsetRecords records={records} formatDate={formatDate} onBattleClick={vi.fn()} />)).toBe(2);
  });

  it('team battles: every line-up and robot record, only for the Automaton robot', () => {
    expect(badgeCount(
      <TeamBattleRecords records={records} formatDuration={formatDuration} formatDate={formatDate} onBattleClick={vi.fn()} />,
    )).toBe(5);
    for (const line of screen.getAllByText(/^vs Team 2:/)) {
      expect(within(line).queryByTestId('automaton-badge')).not.toBeInTheDocument();
    }
  });

  it('tournament champions: the Automaton owner only', () => {
    expect(badgeCount(<TournamentChampionsRecords records={records} formatDate={formatDate} />)).toBe(1);
  });
});
