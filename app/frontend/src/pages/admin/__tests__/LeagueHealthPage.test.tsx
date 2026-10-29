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
import { overview } from './leagueHealthFixture';

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
const tierTable = (): HTMLElement => screen.getByTestId('league-health-tier-table');

describe('LeagueHealthPage', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockGet.mockResolvedValue({ data: overview() });
  });

  it('loads the overview once from the league health endpoint', async () => {
    renderPage();
    await screen.findByTestId('league-health-attention');
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0][0]).toBe('/api/admin/league-health');
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

  it('links to the player standings of the mode and to League History', async () => {
    renderPage('?mode=grand_melee');
    await screen.findByTestId('league-health-tier-table');
    expect(screen.getByRole('link', { name: /Player standings/ })).toHaveAttribute('href', '/league-standings?mode=grand_melee&tier=bronze');
    expect(screen.getByRole('link', { name: /League History/ })).toHaveAttribute('href', '/admin/league-history');
  });

  it('refreshes on Refresh and keeps the data on screen meanwhile', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId('league-health-attention');
    let resolve: (value: { data: unknown }) => void = () => {};
    mockGet.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Refreshing…')).toBeInTheDocument();
    expect(screen.getByTestId('league-health-attention')).toBeInTheDocument();
    resolve({ data: overview({ generatedAt: '2026-10-29T18:00:00.000Z' }) });
    expect(await screen.findByText('Last updated 18:00:00 UTC')).toBeInTheDocument();
  });

  it('shows an error with Retry when the first load fails', async () => {
    const user = userEvent.setup();
    mockGet.mockRejectedValueOnce(new Error('boom'));
    renderPage();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not load league health.');
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId('league-health-attention')).toBeInTheDocument();
  });

  it('falls back to the default mode for an unknown ?mode=', async () => {
    renderPage('?mode=nonsense&tier=bogus');
    await screen.findByTestId('league-health-tier-table');
    expect(screen.getByRole('button', { name: '1v1 League' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(tierTable()).queryByTestId(/league-health-instances-/)).not.toBeInTheDocument();
  });
});
