/**
 * Admin Weapons page: the collecting and error states, the ready analysis
 * (archetype grid, matchups, tier bars, weapons table, scatter, refinements and
 * coverage), and every control (range, mode, strength, matchup view, Reset,
 * Refresh, Show all weapons, the not-owned list) written to the URL and the request.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import WeaponsPage from '../WeaponsPage';
import { ApiError } from '../../../utils/ApiError';
import { collectingWeapons, readyWeapons } from '../../../components/admin/weapons/__tests__/weaponsFixture';
import type { AnalysisRange, AnalysisStrength } from '../../../components/admin/weapons';

const mockGet = vi.fn();

vi.mock('../../../utils/adminWeaponsApi', () => ({
  getWeaponAnalysis: (range: AnalysisRange, strength: AnalysisStrength) => mockGet(range, strength),
}));

let currentSearch = '';
function LocationSpy(): null {
  currentSearch = useLocation().search;
  return null;
}

function renderPage(url = '/admin/weapons'): void {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/admin/weapons" element={<><WeaponsPage /><LocationSpy /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

const region = (name: string | RegExp): HTMLElement => screen.getByRole('region', { name });

beforeEach(() => {
  vi.clearAllMocks();
  currentSearch = '';
  mockGet.mockResolvedValue(readyWeapons());
});

describe('WeaponsPage states', () => {
  it('shows when the analysis appears while builds are being collected', async () => {
    mockGet.mockResolvedValue(collectingWeapons());
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Collecting battle-time builds' })).toBeInTheDocument();
    expect(screen.getByText(/Recording started on 27 Oct 2026; 16,000 battles recorded so far/)).toBeInTheDocument();
    expect(screen.getByText(/appears on 3 Nov 2026/)).toBeInTheDocument();
  });

  it('explains when recording has not started', async () => {
    mockGet.mockResolvedValue(collectingWeapons({ recordingSince: null, availableFrom: null, battlesRecorded: 0 }));
    renderPage();
    expect(await screen.findByText(/No battle-time builds are recorded yet/)).toBeInTheDocument();
  });

  it('shows an error with Retry', async () => {
    mockGet.mockRejectedValueOnce(new ApiError('Boom', 500, 'INTERNAL'));
    renderPage();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Boom');
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('region', { name: /Archetypes/ })).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('warns when a mode has too few comparisons', async () => {
    const data = readyWeapons();
    data.columns = data.columns.map((c) => ({ ...c, enough: c.column !== 'all', comparisons: c.column === 'all' ? 120 : c.comparisons }));
    mockGet.mockResolvedValue(data);
    renderPage();
    expect(await screen.findByText(/Too few comparisons in All modes for effects \(120 of 300\)/)).toBeInTheDocument();
  });
});

describe('WeaponsPage analysis', () => {
  it('loads the last 7 days for all robots and states the window', async () => {
    renderPage();
    expect(await screen.findByText('21,480 battles')).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith('7d', 'all');
    expect(screen.getByText(/All modes: 9,000 battles, 30,000 robots fought \(1,600 players'\)/)).toBeInTheDocument();
    expect(screen.getByText(/10% more points: \+4\.2 pp/)).toBeInTheDocument();
  });

  it('shows the archetype grid with effects and usage', async () => {
    renderPage();
    const grid = await screen.findByRole('region', { name: 'Archetypes: range × loadout · All modes' });
    const meleeShield = within(grid).getByTestId('archetype-melee+weapon_shield');
    expect(meleeShield).toHaveTextContent('+3.4');
    expect(meleeShield).toHaveTextContent('54.4%');
    expect(within(grid).getByTestId('archetype-long+single')).toHaveTextContent('−21.9');
    expect(within(grid).getByTestId('archetype-long+dual_wield')).toHaveTextContent('too few');
    // Within noise: grey and announced as not significant.
    expect(within(grid).getByTestId('archetype-mid+two_handed')).toHaveTextContent('(not significant)');
  });

  it('shows range matchups and switches the matchup view (URL)', async () => {
    renderPage();
    const panel = await screen.findByRole('region', { name: 'Matchups · All modes' });
    expect(within(panel).getByRole('rowheader', { name: 'Mid' })).toBeInTheDocument();
    expect(within(panel).getByText('76%')).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole('button', { name: 'Loadouts' }));
    expect(currentSearch).toContain('matchups=loadouts');
    expect(within(panel).getByRole('rowheader', { name: 'Weapon + shield' })).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole('button', { name: 'Top archetypes' }));
    expect(currentSearch).toContain('matchups=archetypes');
    expect(within(panel).getByRole('rowheader', { name: 'Melee + shield' })).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole('button', { name: 'Range bands' }));
    expect(currentSearch).not.toContain('matchups=');
  });

  it('shows usage per league tier with the convergence note', async () => {
    renderPage();
    const tiers = await screen.findByRole('region', { name: 'Usage by league tier · All modes' });
    expect(within(tiers).getByText(/Most concentrated:/)).toHaveTextContent('53.6% of Champion robots fight melee + shield');
    expect(within(tiers).getByText(/mirror matches/)).toBeInTheDocument();
    const table = within(tiers).getByRole('table', { name: 'Share of robots per archetype and league tier' });
    expect(within(table).getByRole('rowheader', { name: 'Tournaments' })).toBeInTheDocument();
  });

  it('lists weapons by effect, dims those with too few fights, and shows all on request', async () => {
    renderPage();
    const panel = await screen.findByRole('region', { name: 'Weapons · All modes' });
    const table = within(panel).getByRole('table');
    // Collapsed: the strongest six, a gap row, the weakest six.
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(13);
    expect(rows[0]).toHaveTextContent('Plasma Rifle');
    expect(rows[0]).toHaveTextContent('₡286k');
    expect(rows[0]).toHaveTextContent('76%');
    expect(rows[6]).toHaveTextContent('… 2 more weapons in between and below');
    expect(rows[12]).toHaveTextContent('Beam Pistol');
    expect(within(table).queryByText('Ion Beam')).not.toBeInTheDocument();
    await userEvent.click(within(panel).getByRole('button', { name: 'Show all 14 weapons' }));
    const all = within(table).getAllByRole('row').slice(1);
    expect(all).toHaveLength(14);
    expect(all[13]).toHaveTextContent('Ion Beam');
    expect(all[13]).toHaveTextContent('too few fights');
    await userEvent.click(within(panel).getByRole('button', { name: 'Show fewer weapons' }));
    expect(within(table).getAllByRole('row').slice(1)).toHaveLength(13);
  });

  it('plots price against effect', async () => {
    renderPage();
    const scatter = await screen.findByRole('region', { name: 'Price vs effect · All modes' });
    expect(within(scatter).getByRole('img', { name: 'Price against effect for 13 weapons' })).toBeInTheDocument();
    const points = within(scatter).getAllByRole('listitem');
    expect(points).toHaveLength(13);
    expect(points[0]).toHaveTextContent('Plasma Rifle: ₡286k, +6.1 pp');
    expect(points[12]).toHaveTextContent('Beam Pistol: ₡96k, −5.2 pp');
    // The strongest and weakest are labelled in the plot.
    expect(within(scatter).getByRole('img')).toHaveTextContent('Beam Pistol');
  });

  it('shows refinements, coverage and the weapons no player owns', async () => {
    renderPage();
    const panel = await screen.findByRole('region', { name: 'Refinements and coverage · All modes' });
    expect(within(panel).getByText(/1\.2% of 30,000 robots that fought/)).toBeInTheDocument();
    expect(within(panel).getByText(/now 40/)).toBeInTheDocument();
    expect(within(panel).getByText(/47 of 47 weapons fought with/)).toHaveTextContent("by players' robots: 30");
    const toggle = within(panel).getByRole('button', { name: 'Show the 2 weapons no player owns' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(within(panel).getByText('Railgun')).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole('button', { name: 'Hide the 2 weapons no player owns' }));
    expect(within(panel).queryByText('Railgun')).not.toBeInTheDocument();
  });
});

describe('WeaponsPage controls', () => {
  it('requests another range (URL)', async () => {
    renderPage();
    await screen.findByText('21,480 battles');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Battles from' }), 'season');
    expect(mockGet).toHaveBeenLastCalledWith('season', 'all');
    expect(currentSearch).toContain('range=season');
  });

  it('requests the top 10% (URL) and states the cut', async () => {
    const top = readyWeapons({ strength: 'top10' });
    top.columns = top.columns.map((c) => ({ ...c, strengthCut: c.column === 'duel' ? 1_250 : null }));
    renderPage();
    await screen.findByText('21,480 battles');
    mockGet.mockResolvedValue(top);
    await userEvent.click(screen.getByRole('button', { name: 'Top 10%' }));
    expect(mockGet).toHaveBeenLastCalledWith('7d', 'top10');
    expect(currentSearch).toContain('strength=top10');
    expect(await screen.findByText(/every robot invested at least 1,250 points \(1v1\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Top 10%' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('switches the mode column without a new request (URL), and explains matchups for team modes', async () => {
    renderPage();
    await screen.findByText('21,480 battles');
    await userEvent.click(screen.getByRole('button', { name: 'Team' }));
    expect(currentSearch).toContain('column=team');
    expect(mockGet).toHaveBeenCalledTimes(1);
    const matchups = region('Matchups · Team');
    expect(within(matchups).getByText(/Matchups compare single robots/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Free-for-all' }));
    expect(currentSearch).toContain('column=multi');
    expect(region('Archetypes: range × loadout · Free-for-all')).toBeInTheDocument();
  });

  it('reads the view from the URL and Reset clears it', async () => {
    renderPage('/admin/weapons?range=30d&column=duel&strength=top10&matchups=loadouts');
    await screen.findByText('21,480 battles');
    expect(mockGet).toHaveBeenCalledWith('30d', 'top10');
    expect(region('Matchups · 1v1')).toBeInTheDocument();
    expect(within(region('Matchups · 1v1')).getByRole('button', { name: 'Loadouts' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(currentSearch).toBe('');
    expect(mockGet).toHaveBeenLastCalledWith('7d', 'all');
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
  });

  it('Refresh requests the analysis again', async () => {
    renderPage();
    await screen.findByText('21,480 battles');
    await userEvent.click(screen.getByRole('button', { name: /Refresh/ }));
    expect(mockGet).toHaveBeenCalledTimes(2);
  });
});
