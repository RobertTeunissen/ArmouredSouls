/**
 * Unit tests for the admin Achievements page (`/admin/achievements`): the
 * season scope and population line, the stable-type toggle in the URL, the
 * headline numbers, the tier strip table, the two balance notes, the sortable
 * and filterable table, refresh, and errors with retry.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import AchievementAnalyticsPage from '../AchievementAnalyticsPage';
import type { AchievementAnalytics, AchievementAnalyticsRow } from '@shared/types';

type Config = { params?: Record<string, unknown>; signal?: AbortSignal };
const mockGet = vi.fn<(url: string, config?: Config) => Promise<{ data: unknown }>>();

vi.mock('../../../utils/apiClient', () => ({
  default: { get: (url: string, config?: Config) => mockGet(url, config) },
}));

const row = (over: Partial<AchievementAnalyticsRow>): AchievementAnalyticsRow => ({
  achievementId: 'C1', name: 'First win', description: 'Win a battle', category: 'combat', tier: 'easy', hidden: false,
  unlocked: 0, rate: 0, medianDay: null, unlockedAll: 0, ...over,
});

const ROWS: AchievementAnalyticsRow[] = [
  row({ achievementId: 'E1', name: 'Welcome', category: 'economy', tier: 'easy', unlocked: 26, rate: 100, medianDay: 0, unlockedAll: 68 }),
  row({ achievementId: 'C6', name: 'Iron Man', category: 'combat', tier: 'hard', unlocked: 24, rate: 92.3, medianDay: 12, unlockedAll: 30 }),
  row({ achievementId: 'C1', name: 'First win', category: 'combat', tier: 'easy', unlocked: 20, rate: 76.9, medianDay: 2, unlockedAll: 25 }),
  row({ achievementId: 'L4', name: 'Diamond', category: 'league', tier: 'medium', unlocked: 3, rate: 11.5, medianDay: 40, unlockedAll: 3 }),
  row({ achievementId: 'S1', name: 'Hidden one', category: 'style', tier: 'secret', hidden: true, unlocked: 1, rate: 3.8, medianDay: 30, unlockedAll: 1 }),
  row({ achievementId: 'C8', name: 'Hundred wins', category: 'combat', tier: 'very_hard', unlocked: 0, rate: 0, medianDay: null, unlockedAll: 0 }),
];

const analytics = (over: Partial<AchievementAnalytics> = {}): AchievementAnalytics => ({
  stables: 'players',
  seasonNumber: 1,
  seasonStartedAt: '2026-08-01T00:00:00.000Z',
  population: 26,
  totalStables: 87,
  totalAchievements: 6,
  unlockedBySomeone: 5,
  unlocks: 74,
  achievements: ROWS,
  ...over,
});

function LocationProbe() {
  return <output data-testid="location">{useLocation().search}</output>;
}

function renderPage(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/admin/achievements${search}`]}>
      <Routes>
        <Route path="/admin/achievements" element={<><AchievementAnalyticsPage /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

const calls = () => mockGet.mock.calls.filter(([url]) => url === '/api/admin/achievements/analytics');

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockImplementation((_url, config) => Promise.resolve({
    data: analytics({ stables: (config?.params?.stables as AchievementAnalytics['stables']) ?? 'players' }),
  }));
});

describe('AchievementAnalyticsPage', () => {
  it('shows this season for active players by default, with the population behind the rates', async () => {
    renderPage();

    expect(await screen.findByTestId('achievement-scope')).toHaveTextContent(
      'This season · 26 active players (logged in since 1 Aug) of 87 accounts · rates are of active players',
    );
    expect(calls()[0]?.[1]?.params).toEqual({ stables: 'players' });
    expect(screen.getByRole('button', { name: 'Players' })).toHaveAttribute('aria-pressed', 'true');

    expect(screen.getByText('Achievements', { selector: 'dt' }).nextElementSibling).toHaveTextContent('6');
    expect(screen.getByText('in the catalogue (incl. 1 secret)')).toBeInTheDocument();
    expect(screen.getByText('Never unlocked').nextElementSibling).toHaveTextContent('1');
    expect(screen.getByText('Unlocks', { selector: 'dt' }).nextElementSibling).toHaveTextContent('74');
    expect(screen.getByText('3 per active player')).toBeInTheDocument();
  });

  it('switches the stable type through the URL and describes the population', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId('achievement-scope');

    await user.click(screen.getByRole('button', { name: 'Automatons' }));
    await waitFor(() => expect(calls().at(-1)?.[1]?.params).toEqual({ stables: 'automatons' }));
    expect(screen.getByTestId('location')).toHaveTextContent('?stables=automatons');
    expect(await screen.findByText(/rates are of all of them/)).toHaveTextContent('This season · 26 Automatons · rates are of all of them');
    // All accounts only differs from Unlocked for players.
    expect(screen.queryByRole('button', { name: /All accounts/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Players' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^$/));
  });

  it('opens Generated from a ?stables= link', async () => {
    renderPage('?stables=generated');
    expect(await screen.findByTestId('achievement-scope')).toHaveTextContent('This season · 26 generated stables · rates are of all of them');
    expect(calls()[0]?.[1]?.params).toEqual({ stables: 'generated' });
  });

  it('summarises each tier in an accessible table', async () => {
    renderPage();
    const table = await screen.findByRole('table', { name: 'Unlock rate per tier' });
    const easy = within(table).getByRole('rowheader', { name: 'Easy' }).parentElement!;
    expect(easy).toHaveTextContent('Easy277%77%100%');
    const veryHard = within(table).getByRole('rowheader', { name: 'Very hard' }).parentElement!;
    expect(veryHard).toHaveTextContent('Very hard10%0%0%');
  });

  it('notes achievements easier and harder than their tier', async () => {
    renderPage();
    const easier = await screen.findByRole('list', { name: 'Easier than its tier says' });
    expect(within(easier).getAllByRole('listitem')).toHaveLength(1);
    expect(within(easier).getByRole('listitem')).toHaveTextContent('HardIron Man C6 · Combat24 of 26 · day 12');

    const harder = screen.getByRole('list', { name: 'Harder than its tier says' });
    expect(within(harder).getByRole('listitem')).toHaveTextContent('MediumDiamond L4 · League3 of 26 · day 40');
    expect(screen.getAllByText("Notes, not alerts: input for next season's balance.")).toHaveLength(2);
  });

  it('sorts the table by any column and filters it by category', async () => {
    const user = userEvent.setup();
    renderPage();
    const panel = await screen.findByRole('region', { name: 'All achievements' });
    const table = within(panel).getByRole('table');
    const ids = () => within(table).getAllByRole('rowheader').map((cell) => cell.textContent?.match(/[A-Z]\d+/)?.[0]);

    expect(ids()).toEqual(['E1', 'C6', 'C1', 'L4', 'S1', 'C8']);
    expect(within(table).getByRole('columnheader', { name: /Unlocked/ })).toHaveAttribute('aria-sort', 'descending');
    expect(within(table).getByRole('rowheader', { name: /Welcome/ }).parentElement).toHaveTextContent('26 (100%)before start68');

    await user.click(within(table).getByRole('button', { name: /Median day/ }));
    expect(ids()).toEqual(['L4', 'S1', 'C6', 'C1', 'E1', 'C8']); // highest day first, nobody-unlocked last
    await user.click(within(table).getByRole('button', { name: /Median day/ }));
    expect(ids()).toEqual(['E1', 'C1', 'C6', 'S1', 'L4', 'C8']);
    expect(within(table).getByRole('columnheader', { name: /Median day/ })).toHaveAttribute('aria-sort', 'ascending');

    await user.click(within(table).getByRole('button', { name: /Achievement/ }));
    expect(ids()).toEqual(['L4', 'C1', 'S1', 'C8', 'C6', 'E1']); // Diamond, First win, Hidden one, Hundred wins, Iron Man, Welcome

    await user.click(within(panel).getByRole('button', { name: 'Combat' }));
    expect(ids()).toEqual(['C1', 'C8', 'C6']);
    expect(within(panel).getByText('3 of 3 shown')).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: /Show all/ })).not.toBeInTheDocument();
  });

  it('shows the first 15 rows of the current sort until Show all', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 20 }, (_, index) => row({ achievementId: `C${index + 1}`, name: `Achievement ${index + 1}`, unlocked: 20 - index, rate: 20 - index }));
    mockGet.mockImplementation(() => Promise.resolve({ data: analytics({ achievements: many, totalAchievements: 20 }) }));
    renderPage();

    const panel = await screen.findByRole('region', { name: 'All achievements' });
    const table = within(panel).getByRole('table');
    expect(within(table).getAllByRole('rowheader')).toHaveLength(15);
    expect(within(panel).getByText('15 of 20 shown')).toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: 'Show all 20 achievements' }));
    expect(within(table).getAllByRole('rowheader')).toHaveLength(20);
    expect(within(panel).getByRole('button', { name: 'Show the first 15' })).toHaveAttribute('aria-expanded', 'true');

    // Sorting re-orders the whole list; the collapsed view always shows its top 15.
    await user.click(within(panel).getByRole('button', { name: 'Show the first 15' }));
    await user.click(within(table).getByRole('button', { name: /^Unlocked/ }));
    expect(within(table).getAllByRole('rowheader')[0]).toHaveTextContent('Achievement 20');
  });

  it('shows an error with Retry, and Refresh refetches', async () => {
    const user = userEvent.setup();
    mockGet.mockImplementationOnce(() => Promise.reject({ response: { status: 500, data: { error: 'Analytics failed', code: 'INTERNAL' } } }));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Analytics failed');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('achievement-scope')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Refresh/ }));
    await waitFor(() => expect(calls()).toHaveLength(3));
  });
});
