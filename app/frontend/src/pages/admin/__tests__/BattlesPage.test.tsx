/**
 * Admin Battles page: list rendering (sides, stable tags, results), the scope
 * line, filters written to the URL, and one test per page button (Refresh,
 * Reset filters, Previous / Next, row open, player report link).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import AdminBattlesPage from '../BattlesPage';
import { ApiError } from '../../../utils/ApiError';
import { SEARCH_DEBOUNCE_MS } from '../../../components/admin/battles';
import { detail, listResponse, logResponse } from '../../../components/admin/battles/__tests__/battleFixtures';
import type { BattleFilters } from '../../../components/admin/battles';

const mockGetList = vi.fn();
const mockGetDetail = vi.fn();
const mockGetLog = vi.fn();

vi.mock('../../../utils/adminBattlesApi', () => ({
  BATTLES_PAGE_SIZE: 25,
  getBattleList: (filters: BattleFilters) => mockGetList(filters),
  getBattleDetail: (id: number) => mockGetDetail(id),
  getBattleLog: (id: number) => mockGetLog(id),
  getBattleExportJson: vi.fn(),
  copyBattleExport: vi.fn(),
}));

let currentSearch = '';
function LocationSpy(): null {
  currentSearch = useLocation().search;
  return null;
}

function renderPage(url = '/admin/battles'): void {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/admin/battles" element={<><AdminBattlesPage /><LocationSpy /></>} />
        <Route path="/battle/:id" element={<p>Player report page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  currentSearch = '';
  mockGetList.mockResolvedValue(listResponse());
  mockGetDetail.mockResolvedValue(detail());
  mockGetLog.mockResolvedValue(logResponse());
});

describe('BattlesPage list', () => {
  it('loads the last 7 days of all stables by default and states the scope', async () => {
    renderPage();
    expect(await screen.findByText('1,284 battles')).toBeInTheDocument();
    expect(mockGetList).toHaveBeenCalledWith(expect.objectContaining({ mode: 'all', stable: 'all', outcome: 'all', range: '7d', q: '', page: 1 }));
    expect(screen.getByText(/All stables · All modes · Last 7 days · Times in UTC/)).toBeInTheDocument();
  });

  it('renders sides with stable tags, the winner, and placement fields', async () => {
    renderPage();
    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(within(rows[1]).getByText('Hammerfall')).toBeInTheDocument();
    expect(within(rows[1]).getByText('(winner)')).toBeInTheDocument();
    expect(within(rows[1]).getAllByText('Player').length).toBeGreaterThan(0);
    expect(within(rows[1]).getByText('Generated')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Destroyed')).toBeInTheDocument();
    expect(within(rows[1]).getByText('±12')).toBeInTheDocument();
    expect(within(rows[2]).getByText('King of the Hill')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Automaton')).toBeInTheDocument();
    expect(within(rows[2]).getByText(/\+ 5 others · 3 Player, 2 Generated/)).toBeInTheDocument();
    expect(within(rows[3]).getByText('Bye')).toBeInTheDocument();
    expect(within(rows[3]).getByText('No opponent')).toBeInTheDocument();
  });

  it('reads filters from the URL', async () => {
    renderPage('/admin/battles?mode=koth&stable=automaton&outcome=draw&range=season&q=Iron&page=2');
    await screen.findByText('1,284 battles');
    expect(mockGetList).toHaveBeenCalledWith({ mode: 'koth', stable: 'automaton', outcome: 'draw', range: 'season', q: 'Iron', page: 2 });
    expect(screen.getByRole('button', { name: 'Automatons' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('writes filter changes to the URL and resets to page 1', async () => {
    const user = userEvent.setup();
    renderPage('/admin/battles?page=3');
    await screen.findByText('1,284 battles');
    await user.click(screen.getByRole('button', { name: 'Players' }));
    await waitFor(() => expect(currentSearch).toBe('?stable=human'));
    await user.selectOptions(screen.getByLabelText('Mode'), 'grand_melee');
    await waitFor(() => expect(currentSearch).toBe('?mode=grand_melee&stable=human'));
    await user.selectOptions(screen.getByLabelText('Date range'), 'season');
    await user.click(screen.getByRole('button', { name: 'Time limit' }));
    await waitFor(() => expect(currentSearch).toBe('?mode=grand_melee&stable=human&outcome=time_limit&range=season'));
    expect(mockGetList).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'grand_melee', stable: 'human', outcome: 'time_limit', range: 'season', page: 1 }));
  });

  it('searches after typing stops, or at once on Enter', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderPage();
      await screen.findByText('1,284 battles');
      await user.type(screen.getByLabelText(/Search by robot/), 'Iron');
      expect(currentSearch).toBe('');
      await act(async () => { vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS); });
      await waitFor(() => expect(currentSearch).toBe('?q=Iron'));
      await user.clear(screen.getByLabelText(/Search by robot/));
      await user.type(screen.getByLabelText(/Search by robot/), '#531203{Enter}');
      await waitFor(() => expect(currentSearch).toBe('?q=%23531203'));
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows an error state with Retry instead of an empty list', async () => {
    const user = userEvent.setup();
    mockGetList.mockRejectedValueOnce(new ApiError('Database unavailable', 'INTERNAL_ERROR', 500));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Database unavailable');
    expect(screen.queryByText('No battles match these filters.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('1,284 battles')).toBeInTheDocument();
  });

  it('shows the empty state when nothing matches', async () => {
    mockGetList.mockResolvedValue(listResponse([], 0));
    renderPage();
    expect(await screen.findByText('No battles match these filters.')).toBeInTheDocument();
  });
});

describe('BattlesPage buttons', () => {
  it('Refresh reloads the list with the same filters', async () => {
    const user = userEvent.setup();
    renderPage('/admin/battles?mode=koth');
    await screen.findByText('1,284 battles');
    await user.click(screen.getByRole('button', { name: /Refresh/ }));
    await waitFor(() => expect(mockGetList).toHaveBeenCalledTimes(2));
    expect(mockGetList.mock.calls[1][0]).toEqual(mockGetList.mock.calls[0][0]);
  });

  it('Reset filters returns to the defaults and is disabled at the defaults', async () => {
    const user = userEvent.setup();
    renderPage('/admin/battles?mode=koth&outcome=bye&q=Iron&page=2');
    await screen.findByText('1,284 battles');
    await user.click(screen.getByRole('button', { name: 'Reset filters' }));
    await waitFor(() => expect(currentSearch).toBe(''));
    expect(screen.getByRole('button', { name: 'Reset filters' })).toBeDisabled();
  });

  it('Reset filters cancels a pending search, so the typed query is not applied afterwards', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderPage('/admin/battles?outcome=bye');
      await screen.findByText('1,284 battles');
      await user.type(screen.getByRole('searchbox', { name: 'Search by robot, stable or battle id' }), 'Quasar');
      await user.click(screen.getByRole('button', { name: 'Reset filters' }));
      await waitFor(() => expect(currentSearch).toBe(''));
      act(() => { vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS * 2); });
      expect(currentSearch).toBe('');
      expect(screen.getByRole('searchbox', { name: 'Search by robot, stable or battle id' })).toHaveValue('');
    } finally {
      vi.useRealTimers();
    }
  });

  it('Next and Previous page through the list', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('1,284 battles');
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByText('Showing 1–25 of 1,284 battles')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(currentSearch).toBe('?page=2'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Previous' }));
    await waitFor(() => expect(currentSearch).toBe(''));
  });

  it('a row opens the admin check and puts the battle in the URL; closing removes it', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('1,284 battles');
    await user.click(within(screen.getByRole('table')).getByText('Hammerfall'));
    await waitFor(() => expect(currentSearch).toBe('?battle=531204'));
    expect(await screen.findByRole('dialog', { name: 'Battle #531204' })).toBeInTheDocument();
    expect(mockGetDetail).toHaveBeenCalledWith(531204);
    await user.click(screen.getByRole('button', { name: 'Close panel' }));
    await waitFor(() => expect(currentSearch).toBe(''));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the battle named in the URL', async () => {
    renderPage('/admin/battles?battle=531203');
    expect(await screen.findByRole('dialog', { name: 'Battle #531203' })).toBeInTheDocument();
  });

  it('the ↗ link opens the player report without opening the panel', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('1,284 battles');
    await user.click(within(screen.getByRole('table')).getByRole('link', { name: 'Open the player report of battle #531204' }));
    expect(await screen.findByText('Player report page')).toBeInTheDocument();
    expect(mockGetDetail).not.toHaveBeenCalled();
  });
});
