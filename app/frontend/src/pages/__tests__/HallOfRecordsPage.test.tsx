import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import HallOfRecordsPage from '../HallOfRecordsPage';
import { useSeasonStore } from '../../stores/seasonStore';
import { emptyRecords, fullRecords } from '../../components/hall-of-records/__tests__/fixtures';

const mockGet = vi.fn();

vi.mock('../../utils/api', () => ({
  api: { get: (...args: unknown[]) => mockGet(...args) },
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'smashhit', stableName: 'ApenRots', role: 'user', currency: 0, prestige: 0 },
  }),
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderPage(path = '/hall-of-records') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/hall-of-records" element={<><HallOfRecordsPage /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockGet.mockReset();
  useSeasonStore.setState(useSeasonStore.getInitialState());
});

describe('HallOfRecordsPage — board', () => {
  it('shows every group with its records, and the season line', async () => {
    mockGet.mockResolvedValue(fullRecords());
    useSeasonStore.setState({
      season: {
        seasonNumber: 1, phase: 'competitive', seasonCycle: 97, seasonLengthCycles: 100, remainingCompetitiveCycles: 3,
        preparationDay: 0, remainingPreparationCycles: 0, isLegacy: false,
      },
    });
    renderPage();

    expect(await screen.findByTestId('record-group-robots')).toBeInTheDocument();
    for (const group of ['battles', 'streaks', 'koth-melee', 'stables']) {
      expect(screen.getByTestId(`record-group-${group}`)).toBeInTheDocument();
    }
    expect(screen.getByText(/Season 1 records · cycle 97 of 100/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Past seasons: Season Archive/ })).toHaveAttribute('href', '/seasons');
    expect(mockGet).toHaveBeenCalledWith('/api/records');
  });

  it('summarises the viewer\'s places', async () => {
    mockGet.mockResolvedValue(fullRecords());
    renderPage();

    const strip = await screen.findByTestId('your-places');
    expect(within(strip).getByText('ApenRots')).toBeInTheDocument();
    expect(within(strip).getByText(/0 records held · \d+ top-10 places/)).toBeInTheDocument();
    expect(within(strip).getByText('Your best place')).toBeInTheDocument();
  });

  it('filters the board to one group through the URL', async () => {
    mockGet.mockResolvedValue(fullRecords());
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Streaks' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/hall-of-records?group=streaks');
    expect(screen.getByTestId('record-group-streaks')).toBeInTheDocument();
    expect(screen.queryByTestId('record-group-robots')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Streaks' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows only the records the viewer appears in', async () => {
    mockGet.mockResolvedValue(fullRecords());
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Show only my places' }));

    expect(screen.getByTestId('location')).toHaveTextContent('mine=1');
    expect(screen.getByTestId('record-tile-mostBattles')).toBeInTheDocument();
    expect(screen.queryByTestId('record-tile-mostTitles')).not.toBeInTheDocument();
  });

  it('keeps the filter toggle on a mine=1 link when the viewer has no places, so it can be cleared', async () => {
    const data = emptyRecords();
    data.prestige.mostTitles = fullRecords().prestige.mostTitles; // someone else's record only
    mockGet.mockResolvedValue(data);
    const user = userEvent.setup();
    renderPage('/hall-of-records?mine=1');

    expect(await screen.findByTestId('records-none-mine')).toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Show only my places' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');

    await user.click(toggle);

    expect(screen.getByTestId('location')).not.toHaveTextContent('mine=1');
    expect(screen.getByTestId('record-tile-mostTitles')).toBeInTheDocument();
    // Off and without places, the toggle has nothing to offer.
    expect(screen.queryByRole('button', { name: 'Show only my places' })).not.toBeInTheDocument();
  });

  it('counts a record once when two of the viewer\'s robots tie for it', async () => {
    const data = fullRecords();
    const mine = data.grandMelee.mostWins[2];
    data.grandMelee.mostWins = [
      { ...mine, grandMeleeWins: 50 },
      { ...mine, robotId: 104, robotName: 'TweedeAap', grandMeleeWins: 50 },
    ];
    mockGet.mockResolvedValue(data);
    renderPage();

    const strip = await screen.findByTestId('your-places');
    expect(within(strip).getByText(/^1 record held · \d+ top-10 places$/)).toBeInTheDocument();
    expect(within(strip).getAllByRole('listitem')).toHaveLength(1);
  });

  it('links leaderboard-backed records to their leaderboard page', async () => {
    mockGet.mockResolvedValue(fullRecords());
    renderPage();

    const tile = await screen.findByTestId('record-tile-mostKills');
    expect(within(tile).getByRole('link', { name: /Full leaderboard/ })).toHaveAttribute('href', '/leaderboards/losses');
  });

  it('shows an empty state for a fresh season', async () => {
    mockGet.mockResolvedValue(emptyRecords());
    renderPage();

    expect(await screen.findByTestId('records-empty')).toHaveTextContent('No records yet this season.');
    expect(screen.queryByTestId('your-places')).not.toBeInTheDocument();
  });

  it('offers a retry when loading fails', async () => {
    mockGet.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(fullRecords());
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load the Hall of Records.');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('record-group-robots')).toBeInTheDocument();
  });
});

describe('HallOfRecordsPage — full list', () => {
  it('opens a record\'s top 10 from its tile', async () => {
    mockGet.mockResolvedValue(fullRecords());
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('link', { name: /Most battles: Top 10/ }));

    const detail = screen.getByTestId('record-detail');
    expect(within(detail).getByRole('heading', { name: 'Most battles' })).toBeInTheDocument();
    const rows = within(detail).getAllByTestId('record-detail-row');
    expect(rows).toHaveLength(3);
    expect(rows[2]).toHaveAttribute('data-mine', 'true');
    expect(within(rows[2]).getByText('You')).toBeInTheDocument();
  });

  it('switches mode for per-mode records and keeps the choice in the URL', async () => {
    mockGet.mockResolvedValue(fullRecords());
    const user = userEvent.setup();
    renderPage('/hall-of-records?record=mostDamageInBattle');

    const detail = await screen.findByTestId('record-detail');
    expect(within(detail).getByText('2,736')).toBeInTheDocument();

    await user.click(within(detail).getByRole('link', { name: 'Grand Melee' }));

    expect(screen.getByTestId('location')).toHaveTextContent('mode=grand_melee');
    expect(within(screen.getByTestId('record-detail')).getByText('4,102')).toBeInTheDocument();
  });

  it('names the mode of a per-mode record that has only one populated mode', async () => {
    mockGet.mockResolvedValue(fullRecords());
    renderPage('/hall-of-records?record=mostDecisiveVictory');

    const detail = await screen.findByTestId('record-detail');
    expect(within(detail).getByTestId('record-detail-mode')).toHaveTextContent('Mode: 3v3 League');
    // Nothing to switch to: no mode links.
    expect(within(detail).queryByRole('link', { name: '3v3 League' })).not.toBeInTheDocument();
  });

  it('shows no mode line for a record that is not split by mode', async () => {
    mockGet.mockResolvedValue(fullRecords());
    renderPage('/hall-of-records?record=highestElo');

    const detail = await screen.findByTestId('record-detail');
    expect(within(detail).queryByTestId('record-detail-mode')).not.toBeInTheDocument();
  });

  it('goes back to the board', async () => {
    mockGet.mockResolvedValue(fullRecords());
    const user = userEvent.setup();
    renderPage('/hall-of-records?group=robots&record=highestElo');

    await user.click(await screen.findByRole('link', { name: '← All records' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/hall-of-records?group=robots');
    expect(screen.getByTestId('record-group-robots')).toBeInTheDocument();
  });

  it('falls back to the board for an unknown record key', async () => {
    mockGet.mockResolvedValue(fullRecords());
    renderPage('/hall-of-records?record=narrowestVictory');

    expect(await screen.findByTestId('record-group-robots')).toBeInTheDocument();
    expect(screen.queryByTestId('record-detail')).not.toBeInTheDocument();
  });
});
