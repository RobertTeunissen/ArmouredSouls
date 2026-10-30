/**
 * Unit tests for the admin LeagueHealthPage (`/admin/league-health`): one
 * request, Needs attention with links, the mode × tier grid, mode tabs and
 * expanded tiers in the URL, the standings and League History links, Refresh,
 * and errors with Retry.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import LeagueHealthPage from '../LeagueHealthPage';
import { overview, season } from './leagueHealthFixture';

type Config = { params?: Record<string, unknown>; signal?: AbortSignal };
const mockGet = vi.fn<(url: string, config?: Config) => Promise<{ data: unknown }>>();
vi.mock('../../../utils/apiClient', () => ({
  default: { get: (url: string, config?: Config) => mockGet(url, config) },
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderPage(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/admin/league-health${search}`]}>
      <Routes>
        <Route path="/admin/league-health" element={<><LeagueHealthPage /><LocationProbe /></>} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

const location = (): string => screen.getByTestId('location').textContent ?? '';
const overviewCalls = (): number => mockGet.mock.calls.filter(([url]) => url === '/api/admin/league-health').length;
const seasonCalls = (): unknown[] => mockGet.mock.calls
  .filter(([url]) => url === '/api/admin/league-health/season')
  .map(([, config]) => config?.params);
const tierTable = (): HTMLElement => screen.getByTestId('league-health-tier-table');

describe('LeagueHealthPage', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockGet.mockImplementation((url: string, config?: Config) => {
      if (url === '/api/admin/league-health/season') {
        const params = (config?.params ?? {}) as { mode: string; stable: string };
        return Promise.resolve({ data: season({ mode: params.mode as never, stable: params.stable as never }) });
      }
      return Promise.resolve({ data: overview() });
    });
  });

  it('loads the overview once from the league health endpoint', async () => {
    renderPage();
    await screen.findByTestId('league-health-attention');
    await screen.findByTestId('season-totals');
    expect(overviewCalls()).toBe(1);
    expect(seasonCalls()).toEqual([{ mode: 'league_1v1', stable: 'all' }]);
    expect(screen.getByText(/Season 1 · cycle 88 of 100/)).toBeInTheDocument();
    expect(screen.getByText('Last updated 17:30:00 UTC')).toBeInTheDocument();
  });

  it('lists attention items with their sentence and destination', async () => {
    renderPage();
    const list = await screen.findByTestId('league-health-attention');
    const links = within(list).getAllByRole('link');
    expect(links).toHaveLength(4);
    expect(links[0]).toHaveTextContent("Champion can't open in 2v2, 3v3 and Tag Team");
    expect(links[0]).toHaveTextContent('Diamond has 18, 17 and 16 teams: 1 promotion place each.');
    expect(links[0]).toHaveAttribute('href', '/admin/league-health?mode=league_2v2&tier=diamond');
    expect(links[1]).toHaveTextContent('Few promotions out of 1v1 Platinum');
    expect(links[2]).toHaveTextContent('Demotion rarely moves');
    expect(links[3]).toHaveTextContent('Unsubscribed standings rows');
    expect(screen.getByText('2 open')).toBeInTheDocument(); // notices are not counted
  });

  it('opens the tier of an attention item', async () => {
    const user = userEvent.setup();
    renderPage();
    const list = await screen.findByTestId('league-health-attention');
    await user.click(within(list).getAllByRole('link')[0]);
    expect(location()).toBe('/admin/league-health?mode=league_2v2&tier=diamond');
    expect(within(tierTable()).getByTestId('league-health-instances-diamond')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2v2 League' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows every mode and tier in the grid, and a cell opens that tier', async () => {
    const user = userEvent.setup();
    renderPage();
    const cell = await screen.findByRole('button', { name: /^2v2 League Diamond: 18 active\. Promotion blocked$/ });
    expect(screen.getByRole('button', { name: /^1v1 League Bronze: 2,666 \/ 2,900 active\. OK · 8% unsubscribed$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^King of the Hill Gold: 90 active\. OK · few demotions$/ })).toBeInTheDocument();
    await user.click(cell);
    expect(location()).toBe('/admin/league-health?mode=league_2v2&tier=diamond');
  });

  it('selects a mode from a mobile strip without expanding a tier', async () => {
    const user = userEvent.setup();
    renderPage('?tier=gold');
    const strip = await screen.findByRole('button', { name: /^Tag Team\. Bronze/ });
    await user.click(strip);
    expect(location()).toBe('/admin/league-health?mode=tag_team');
    expect(strip).toHaveAttribute('aria-pressed', 'true');
  });

  it('switches modes with the tabs and collapses the expanded tier', async () => {
    const user = userEvent.setup();
    renderPage('?tier=platinum');
    await screen.findByTestId('league-health-tier-table');
    await user.click(screen.getByRole('button', { name: 'King of the Hill' }));
    expect(location()).toBe('/admin/league-health?mode=koth');
    expect(within(tierTable()).getByRole('columnheader', { name: 'Avg ELO' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '1v1 League' }));
    expect(location()).toBe('/admin/league-health');
  });

  it('labels team ELO as combined in team modes', async () => {
    renderPage('?mode=league_3v3');
    await screen.findByTestId('league-health-tier-table');
    expect(within(tierTable()).getByRole('columnheader', { name: 'Avg team ELO' })).toBeInTheDocument();
    expect(screen.getByText(/Team ELO is the members' combined ELO/)).toBeInTheDocument();
  });

  it('shows movement from history and status per tier', async () => {
    renderPage();
    const platinum = await screen.findByTestId('league-health-tier-platinum');
    expect(platinum).toHaveTextContent('7 of 27');
    expect(platinum).toHaveTextContent('avg 6.4 · needs 100 LP');
    expect(platinum).toHaveTextContent('Low promotion');
    expect(platinum).toHaveTextContent('avg 6.4 of 27 places');
    const bronze = screen.getByTestId('league-health-tier-bronze');
    expect(bronze).toHaveTextContent('2,666 / 2,900');
    expect(bronze).toHaveTextContent('lowest tier');
    expect(bronze).toHaveTextContent('234 unsubscribed');
  });

  it('expands and collapses a tier through its toggle and the URL', async () => {
    const user = userEvent.setup();
    renderPage();
    const toggle = await within(await screen.findByTestId('league-health-tier-platinum')).findByRole('button', { name: /Platinum/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(location()).toBe('/admin/league-health?tier=platinum');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const instances = within(tierTable()).getByTestId('league-health-instances-platinum');
    expect(within(instances).getByText('96 LP · rank 9')).toBeInTheDocument();
    expect(within(instances).getByText('94 / 95')).toBeInTheDocument();
    await user.click(toggle);
    expect(location()).toBe('/admin/league-health');
    expect(within(tierTable()).queryByTestId('league-health-instances-platinum')).not.toBeInTheDocument();
  });

  it('links each instance to its player standings', async () => {
    const user = userEvent.setup();
    renderPage('?mode=tag_team&tier=diamond');
    const instances = within(await screen.findByTestId('league-health-tier-table')).getByTestId('league-health-instances-diamond');
    // The instance block renders a table (md and up) and a list (below md).
    const [link] = within(instances).getAllByRole('link', { name: /Standings of diamond_1/ });
    expect(link).toHaveAttribute('href', '/league-standings?mode=tag_team&tier=diamond&instance=diamond_1');
    await user.click(link);
    expect(location()).toBe('/league-standings?mode=tag_team&tier=diamond&instance=diamond_1');
  });

  it('links to the player standings of the mode', async () => {
    renderPage('?mode=grand_melee');
    await screen.findByTestId('league-health-tier-table');
    expect(screen.getByRole('link', { name: /Player standings/ })).toHaveAttribute('href', '/league-standings?mode=grand_melee&tier=bronze');
    expect(screen.queryByRole('link', { name: /League History/ })).not.toBeInTheDocument();
  });

  it('refreshes the overview and this season on Refresh, keeping the data on screen meanwhile', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId('season-totals');
    let resolve: (value: { data: unknown }) => void = () => {};
    const base = mockGet.getMockImplementation()!;
    mockGet.mockImplementation((url: string, config?: Config) => (url === '/api/admin/league-health'
      ? new Promise((r) => { resolve = r; })
      : base(url, config)));
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(overviewCalls()).toBe(2);
    expect(seasonCalls()).toHaveLength(2);
    expect(screen.getByText('Refreshing…')).toBeInTheDocument();
    expect(screen.getByTestId('league-health-attention')).toBeInTheDocument();
    resolve({ data: overview({ generatedAt: '2026-10-29T18:00:00.000Z' }) });
    expect(await screen.findByText('Last updated 18:00:00 UTC')).toBeInTheDocument();
  });

  it('shows an error with Retry when the first load fails', async () => {
    const user = userEvent.setup();
    const base = mockGet.getMockImplementation()!;
    let failed = false;
    mockGet.mockImplementation((url: string, config?: Config) => {
      if (url === '/api/admin/league-health' && !failed) { failed = true; return Promise.reject(new Error('boom')); }
      return base(url, config);
    });
    renderPage();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not load league health.');
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(overviewCalls()).toBe(2));
    expect(await screen.findByTestId('league-health-attention')).toBeInTheDocument();
  });

  it('shows this season: totals, a quiet-cycle marker linking to Cycle Controls, and the boundaries', async () => {
    const user = userEvent.setup();
    renderPage();
    const block = await screen.findByTestId('league-season');
    expect(within(block).getByRole('heading', { name: 'This season · 1v1 League' })).toBeInTheDocument();
    expect(await within(block).findByTestId('season-totals')).toHaveTextContent('4,449 promotions, 906 demotions (5 : 1) · last cycle (84): 173 up, 30 down');
    const quiet = within(block).getByTestId('season-quiet-cycles');
    expect(quiet).toHaveTextContent('No moves recorded in cycle 82');
    expect(within(block).getAllByTestId('season-trend-bars')[0].querySelectorAll('[data-quiet]')).toHaveLength(1);
    const bronze = within(block).getByTestId('season-boundary-bronze');
    expect(bronze).toHaveTextContent('Bronze ↔ Silver');
    expect(bronze).toHaveTextContent('2,754');
    expect(bronze).toHaveTextContent('26%');
    expect(bronze).toHaveTextContent('530 of 2,057');
    expect(bronze).toHaveTextContent('About 1 in 4 promoted robots is back within 10 cycles');
    expect(within(block).getByTestId('season-boundary-platinum')).toHaveTextContent('Only 12 promotions to judge');
    expect(within(block).getByTestId('season-boundary-diamond')).toHaveTextContent('Promotions too recent to judge (all after cycle 74)');
    expect(within(block).getByRole('table', { name: /promotions and demotions per cycle/ })).toBeInTheDocument();
    await user.click(within(quiet).getByRole('link', { name: /Run history in Cycle Controls/ }));
    expect(location()).toBe('/admin/cycles');
  });

  it('filters this season by stable type through the URL', async () => {
    const user = userEvent.setup();
    renderPage('?mode=league_2v2');
    const block = await screen.findByTestId('league-season');
    await within(block).findByTestId('season-totals');
    const group = within(block).getByRole('group', { name: 'Stable type' });
    await user.click(within(group).getByRole('button', { name: 'Players' }));
    expect(location()).toBe('/admin/league-health?mode=league_2v2&stable=human');
    await waitFor(() => expect(seasonCalls()).toContainEqual({ mode: 'league_2v2', stable: 'human' }));
    expect(within(group).getByRole('button', { name: 'Players' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(group).getByRole('button', { name: 'Generated' }));
    expect(location()).toBe('/admin/league-health?mode=league_2v2&stable=generated');
    await user.click(within(group).getByRole('button', { name: 'All' }));
    expect(location()).toBe('/admin/league-health?mode=league_2v2');
    expect(within(block).getByTestId('season-boundary-bronze')).toHaveTextContent('About 1 in 4 promoted teams is back within 10 cycles');
  });

  it('loads this season for the mode of the selected tab', async () => {
    const user = userEvent.setup();
    renderPage('?stable=automaton');
    await screen.findByTestId('season-totals');
    await user.click(screen.getByRole('button', { name: 'Grand Melee' }));
    await waitFor(() => expect(seasonCalls()).toContainEqual({ mode: 'grand_melee', stable: 'automaton' }));
    expect(await screen.findByRole('heading', { name: 'This season · Grand Melee' })).toBeInTheDocument();
    expect(screen.getByText(/KotH and Grand Melee hardly demote at all/)).toBeInTheDocument();
  });

  it('shows a message when the mode has no moves yet this season', async () => {
    mockGet.mockImplementation((url: string) => Promise.resolve({
      data: url === '/api/admin/league-health/season'
        ? season({ firstCycle: null, lastCycle: null, judgedThroughCycle: null, cycles: [], quietCycles: [], totals: { promoted: 0, demoted: 0 } })
        : overview(),
    }));
    renderPage();
    expect(await screen.findByText('No promotions or demotions recorded in this league this season yet.')).toBeInTheDocument();
  });

  it('falls back to the default mode for an unknown ?mode=', async () => {
    renderPage('?mode=nonsense&tier=bogus');
    await screen.findByTestId('league-health-tier-table');
    expect(screen.getByRole('button', { name: '1v1 League' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(tierTable()).queryByTestId(/league-health-instances-/)).not.toBeInTheDocument();
  });
});
