/**
 * Admin Attributes page: the collecting state, the ready analysis (window line,
 * column summaries, heatmap order, biggest effects, group matrix, profiles,
 * layer fit), and every control (range, sort column, layer toggles, Reset,
 * Refresh, heatmap order) written to the URL and the request.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import AttributesPage from '../AttributesPage';
import { ApiError } from '../../../utils/ApiError';
import { collectingResponse, readyResponse } from '../../../components/admin/attributes/__tests__/attributeFixtures';
import type { AnalysisRange, LayerToggles } from '../../../components/admin/attributes';

const mockGet = vi.fn();

vi.mock('../../../utils/adminAttributesApi', () => ({
  getAttributeAnalysis: (range: AnalysisRange, toggles: LayerToggles) => mockGet(range, toggles),
}));

let currentSearch = '';
function LocationSpy(): null {
  currentSearch = useLocation().search;
  return null;
}

function renderPage(url = '/admin/attributes'): void {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/admin/attributes" element={<><AttributesPage /><LocationSpy /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

const ALL_ON: LayerToggles = { tuning: true, weapons: true, refinements: true, loadout: true, stance: true };

beforeEach(() => {
  vi.clearAllMocks();
  currentSearch = '';
  mockGet.mockResolvedValue(readyResponse());
});

describe('AttributesPage states', () => {
  it('shows when the analysis appears while builds are being collected', async () => {
    mockGet.mockResolvedValue(collectingResponse());
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Collecting battle-time builds' })).toBeInTheDocument();
    expect(screen.getByText(/Recording started on 27 Oct 2026; 6,412 battles recorded so far/)).toBeInTheDocument();
    expect(screen.getByText(/appears on 3 Nov 2026/)).toBeInTheDocument();
  });

  it('explains when recording has not started', async () => {
    mockGet.mockResolvedValue(collectingResponse({ recordingSince: null, availableFrom: null, battlesRecorded: 0 }));
    renderPage();
    expect(await screen.findByText(/No battle-time builds are recorded yet/)).toBeInTheDocument();
  });

  it('shows an error with Retry', async () => {
    mockGet.mockRejectedValueOnce(new ApiError('Boom', 500, 'INTERNAL'));
    renderPage();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Boom');
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { name: 'Attribute effects' })).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledTimes(2);
  });
});

describe('AttributesPage analysis', () => {
  it('loads the last 7 days with every layer on and states the window', async () => {
    renderPage();
    expect(await screen.findByText('21,480 battles')).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith('7d', ALL_ON);
    expect(screen.getByText(/Last 7 days from 3 Nov 2026/)).toBeInTheDocument();
    expect(screen.getByText(/61,200 robots fought \(1,840 players'\)/)).toBeInTheDocument();
    expect(screen.getByText(/left out: 812 draws, 95 forfeits/)).toBeInTheDocument();
    const summaries = screen.getByRole('list', { name: 'Battles per mode column' });
    expect(within(summaries).getByText(/240 comparisons · too few to analyse/)).toBeInTheDocument();
    expect(within(summaries).getAllByText('+4.1 pp').length).toBe(1);
    // Stance is reported as its own effect per column, not folded into the attributes.
    const all = within(summaries).getByText('All modes').closest('li') as HTMLElement;
    expect(all).toHaveTextContent('vs balanced: offensive +1.8 pp · defensive \u22120.4 pp');
  });

  it('orders the heatmap by effect, with a group order option', async () => {
    renderPage();
    const table = await screen.findByRole('table', { name: /Effect of each attribute/ });
    const firstRows = (): string[] => within(table).getAllByRole('rowheader').slice(0, 3).map((h) => h.textContent ?? '');
    expect(firstRows()).toEqual(['Combat Power', 'Attack Speed', 'Hull Integrity']);
    expect(within(table).getAllByRole('rowheader').at(-1)).toHaveTextContent('Armor Plating');
    await userEvent.click(screen.getByRole('button', { name: 'By group' }));
    expect(firstRows()).toEqual(['Combat Power', 'Targeting Systems', 'Critical Systems']);
    expect(within(table).getAllByText('too few battles')).toHaveLength(1);
    expect(within(table).getByText('Adaptive AI')).toBeInTheDocument();
  });

  it('marks non-significant cells for screen readers and never relies on colour alone', async () => {
    renderPage();
    const table = await screen.findByRole('table', { name: /Effect of each attribute/ });
    const row = within(table).getByRole('rowheader', { name: 'Armor Plating' }).closest('tr') as HTMLElement;
    expect(within(row).getAllByText('\u22122.2').length).toBeGreaterThan(0);
    expect(within(row).getAllByText('(not significant)').length).toBeGreaterThan(0);
    expect(within(row).getAllByText('not enough data').length).toBe(1);
  });

  it('lists the biggest effects of the selected column', async () => {
    renderPage();
    const panel = (await screen.findByRole('heading', { name: 'Biggest effects · All modes' })).closest('section') as HTMLElement;
    const helps = within(panel).getAllByRole('list')[0];
    expect(within(helps).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringContaining('Combat Power'),
      expect.stringContaining('Attack Speed'),
      expect.stringContaining('Hull Integrity'),
    ]);
    expect(within(panel).getByText(/Armor Plating/)).toBeInTheDocument();
  });

  it('shows group effects, pair synergies, profiles and the layer fit', async () => {
    renderPage();
    const matrix = await screen.findByRole('table', { name: /Group effects on the diagonal/ });
    expect(within(matrix).getByText('+2.5')).toBeInTheDocument();
    expect(within(matrix).getByText('+0.9')).toBeInTheDocument();
    const profiles = screen.getByRole('table', { name: /Build profiles/ });
    expect(within(profiles).getByText('Combat-heavy')).toBeInTheDocument();
    expect(within(profiles).getByText('Combat + Chassis')).toBeInTheDocument();
    expect(within(profiles).getByText('58.0%')).toBeInTheDocument();
    const fit = screen.getByRole('table', { name: /Prediction quality/ });
    expect(within(fit).getByText('+ Weapon bonuses')).toBeInTheDocument();
    expect(within(fit).getByText('+2.5')).toBeInTheDocument();
  });
});

describe('AttributesPage controls', () => {
  it('changes the range and requests it', async () => {
    renderPage();
    await screen.findByText('21,480 battles');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Battles from' }), 'season');
    await waitFor(() => expect(mockGet).toHaveBeenLastCalledWith('season', ALL_ON));
    expect(currentSearch).toBe('?range=season');
  });

  it('switches the sort column without a new request', async () => {
    renderPage();
    await screen.findByText('21,480 battles');
    await userEvent.click(screen.getByRole('button', { name: 'Team' }));
    expect(currentSearch).toBe('?column=team');
    expect(screen.getByRole('heading', { name: 'Biggest effects · Team' })).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('turns layers off and on, and Reset restores the defaults', async () => {
    renderPage();
    await screen.findByText('21,480 battles');
    await userEvent.click(screen.getByRole('checkbox', { name: '+ Stance' }));
    await waitFor(() => expect(mockGet).toHaveBeenLastCalledWith('7d', { ...ALL_ON, stance: false }));
    expect(currentSearch).toBe('?off=stance');
    expect(screen.getByText('Without stance')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: '+ Tuning' }));
    expect(currentSearch).toBe('?off=tuning%2Cstance');
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(currentSearch).toBe('');
    await waitFor(() => expect(mockGet).toHaveBeenLastCalledWith('7d', ALL_ON));
  });

  it('reads the view from the URL', async () => {
    renderPage('/admin/attributes?range=30d&column=duel&off=weapons,refinements');
    await screen.findByText('21,480 battles');
    expect(mockGet).toHaveBeenCalledWith('30d', { ...ALL_ON, weapons: false, refinements: false });
    expect(screen.getByRole('button', { name: '1v1' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('checkbox', { name: '+ Weapon bonuses' })).not.toBeChecked();
  });

  it('refreshes', async () => {
    renderPage();
    await screen.findByText('21,480 battles');
    await userEvent.click(screen.getByRole('button', { name: /Refresh/ }));
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
  });
});
