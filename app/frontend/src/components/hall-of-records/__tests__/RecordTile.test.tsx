import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RecordTile } from '../RecordTile';
import { buildRecordCatalogue, findMyPlaces, bestPlaceIn } from '../../../utils/hallOfRecords';
import { fullRecords, VIEWER } from './fixtures';
import type { RecordDefinition, RecordsData } from '../types';

function recordOf(key: string, data: RecordsData = fullRecords()): RecordDefinition {
  const record = buildRecordCatalogue(data).find((r) => r.key === key);
  if (!record) throw new Error(`no record ${key}`);
  return record;
}

function renderTile(record: RecordDefinition, viewerId: number | null = VIEWER.userId, href = '/hall-of-records?record=x') {
  const places = findMyPlaces([record], viewerId);
  return render(
    <MemoryRouter>
      <RecordTile record={record} detailHref={href} viewerId={viewerId} myBest={bestPlaceIn(record, places)} />
    </MemoryRouter>,
  );
}

describe('RecordTile — single record', () => {
  it('shows the value, the holder robot and stable as links, and the context line', () => {
    renderTile(recordOf('highestElo'));
    const tile = screen.getByTestId('record-tile-highestElo');
    expect(within(tile).getByText('Highest ELO')).toBeInTheDocument();
    expect(within(tile).getByText('2,393')).toBeInTheDocument();
    expect(within(tile).getByRole('link', { name: 'CT-7567 Rex' })).toHaveAttribute('href', '/robots/101');
    expect(within(tile).getByRole('link', { name: 'Kamino Clone Legion' })).toHaveAttribute('href', '/stables/11');
    expect(within(tile).getByText('470-20-5 record')).toBeInTheDocument();
  });

  it('links "Top 10" to the full list', () => {
    renderTile(recordOf('highestElo'), VIEWER.userId, '/hall-of-records?record=highestElo');
    expect(screen.getByRole('link', { name: /Highest ELO: Top 10/ })).toHaveAttribute('href', '/hall-of-records?record=highestElo');
  });

  it('says "Full leaderboard" for records that have a leaderboard page', () => {
    renderTile(recordOf('mostKills'), VIEWER.userId, '/leaderboards/losses');
    expect(screen.getByRole('link', { name: /Most destructions: Full leaderboard/ })).toHaveAttribute('href', '/leaderboards/losses');
  });

  it('shows the viewer\'s best place in the record', () => {
    renderTile(recordOf('mostBattles'));
    expect(screen.getByTestId('record-my-place')).toHaveTextContent('You: #3 · GekkeAap');
  });

  it('shows no place line when the viewer is not in the top 10', () => {
    renderTile(recordOf('mostTitles'));
    expect(screen.queryByTestId('record-my-place')).not.toBeInTheDocument();
  });

  it('sends the viewer\'s own robot to its Workshop', () => {
    const data = fullRecords();
    data.career.highestElo = [data.career.highestElo[2]];
    renderTile(recordOf('highestElo', data));
    expect(screen.getByRole('link', { name: 'GekkeAap' })).toHaveAttribute('href', '/robots/103/prepare');
  });

  it('notes a shared top spot', () => {
    const data = fullRecords();
    data.grandMelee.mostWins = data.grandMelee.mostWins.map((e) => ({ ...e, grandMeleeWins: 44 }));
    renderTile(recordOf('meleeWins', data));
    expect(screen.getByText('tied with 2 others')).toBeInTheDocument();
  });

  it('marks a streak that is still running and links a battle record to its report', () => {
    renderTile(recordOf('kothWinStreak'));
    expect(screen.getByText('● running')).toBeInTheDocument();
    const { unmount } = renderTile(recordOf('biggestUpset'));
    expect(screen.getByRole('link', { name: 'Battle report ›' })).toHaveAttribute('href', '/battle/203');
    unmount();
  });

  it('shows a stable record with the stable alone', () => {
    renderTile(recordOf('richestStable'));
    const tile = screen.getByTestId('record-tile-richestStable');
    expect(within(tile).getByRole('link', { name: 'Kamino Clone Legion' })).toHaveAttribute('href', '/stables/11');
    expect(within(tile).getByText('3 robots')).toBeInTheDocument();
  });
});

describe('RecordTile — per-mode record', () => {
  it('lists the top holder of every mode', () => {
    renderTile(recordOf('mostDamageInBattle'));
    const tile = screen.getByTestId('record-tile-mostDamageInBattle');
    const rows = within(tile).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('1v1 League');
    expect(rows[0]).toHaveTextContent('2,736');
    expect(rows[1]).toHaveTextContent('Grand Melee');
    expect(within(tile).getByRole('link', { name: /Top 10 per mode/ })).toBeInTheDocument();
  });

  it('keeps the mode label when only one mode has a holder', () => {
    // The fixture has a 3v3 decisive victory and no 2v2 one.
    renderTile(recordOf('mostDecisiveVictory'));
    const tile = screen.getByTestId('record-tile-mostDecisiveVictory');
    expect(within(tile).getByTestId('record-tile-mode')).toHaveTextContent('3v3 League');
    expect(within(tile).getByRole('link', { name: /Top 10$/ })).toBeInTheDocument();
  });

  it('shows no mode label for a record that is not split by mode', () => {
    renderTile(recordOf('highestElo'));
    expect(screen.queryByTestId('record-tile-mode')).not.toBeInTheDocument();
  });

  it('lists the latest champion per tournament type', () => {
    renderTile(recordOf('tournamentChampions'));
    const tile = screen.getByTestId('record-tile-tournamentChampions');
    expect(within(tile).getByText('1v1 Tournament #9')).toBeInTheDocument();
    expect(within(tile).getByText('De Toppers')).toBeInTheDocument();
    // The log holds the 10 most recent champions per type, not every one.
    expect(within(tile).getByRole('link', { name: /Last 10 per type/ })).toBeInTheDocument();
    // Stacked entries: the tile fits one grid column.
    expect(tile.className).not.toContain('md:col-span-2');
  });

  it('spans two columns for per-mode records, and two rows on wide screens from four modes', () => {
    const { unmount } = renderTile(recordOf('mostDamageInBattle'));
    expect(screen.getByTestId('record-tile-mostDamageInBattle').className).toContain('md:col-span-2');
    expect(screen.getByTestId('record-tile-mostDamageInBattle').className).not.toContain('xl:row-span-2');
    unmount();
    const data = fullRecords();
    data.winStreaks.league_3v3 = [{ ...data.winStreaks.league_2v2![0], entityId: 901 }];
    data.winStreaks.tag_team = [{ ...data.winStreaks.league_2v2![0], entityId: 902 }];
    renderTile(recordOf('leagueWinStreak', data));
    expect(screen.getByTestId('record-tile-leagueWinStreak').className).toContain('xl:row-span-2');
  });
});

describe('RecordTile — generated bot stables', () => {
  it('marks a generated stable with a "bot" chip and no Automaton badge', () => {
    const data = fullRecords();
    data.koth.mostZoneTime = [{
      robotId: 300, robotName: 'ExpertBot Guardian Nova 1', userId: 50, username: 'Argent Armaments',
      stableType: 'generated', totalZoneTime: 3631.6, kothMatches: 82,
    }];
    renderTile(recordOf('kothZoneTime', data));
    const tile = screen.getByTestId('record-tile-kothZoneTime');
    expect(within(tile).getByTestId('record-bot-stable')).toHaveTextContent('Argent Armamentsbot');
    expect(within(tile).queryByTestId('automaton-badge')).not.toBeInTheDocument();
  });

  it('adds no chip for human stables', () => {
    renderTile(recordOf('mostTitles'));
    expect(screen.queryByTestId('record-bot-stable')).not.toBeInTheDocument();
  });
});
