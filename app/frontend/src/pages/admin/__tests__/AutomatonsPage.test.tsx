import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import AutomatonsPage from '../AutomatonsPage';
import { COMPARISON, LIBRARY, PROFILES, statusBar } from '../../../components/admin/automatons/__tests__/fixtures';

const api = vi.hoisted(() => ({
  getStatus: vi.fn(),
  setProgramSwitch: vi.fn(),
  listAllProfiles: vi.fn(),
  getStrategyLibrary: vi.fn(),
  activateAllDrafts: vi.fn(),
  getStrategyComparison: vi.fn(),
  listStrategyDrafts: vi.fn(),
  createStrategyDraft: vi.fn(),
  getSyncStatus: vi.fn(),
  exportCatalogue: vi.fn(),
  downloadJson: vi.fn(),
  listWeapons: vi.fn(),
  getProfile: vi.fn(),
  listTurns: vi.fn(),
}));
vi.mock('../../../utils/automatonAdminApi', () => api);

let desktop = false;
const originalMatchMedia = window.matchMedia;

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

/** The decoded query of the current location. */
function search(): URLSearchParams {
  return new URLSearchParams(screen.getByTestId('location').textContent ?? '');
}

function renderPage(path = '/admin/automatons') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/automatons" element={<><AutomatonsPage /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AutomatonsPage (task 10.2)', () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: desktop && query === '(min-width: 1024px)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    api.getStatus.mockResolvedValue(statusBar());
    api.listAllProfiles.mockResolvedValue(PROFILES);
    api.getStrategyLibrary.mockResolvedValue({ strategies: LIBRARY });
    api.getStrategyComparison.mockResolvedValue(COMPARISON);
    api.listStrategyDrafts.mockResolvedValue({ drafts: [] });
    api.getSyncStatus.mockResolvedValue({ summary: { ranAt: '2026-10-08T14:02:00.000Z', added: [], present: ['a'], filled: [], conflicts: [{ catalogueKey: 'minion-horde', stableName: 'Minion Mayhem', reason: 'stable_name_taken' }] } });
    api.listWeapons.mockResolvedValue([]);
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    desktop = false;
  });

  it('shows tabs at ≥ 1024 px and keeps the active tab in ?tab=', async () => {
    desktop = true;
    renderPage('/admin/automatons?tab=catalogue');
    const tablist = screen.getByRole('tablist', { name: 'Automaton sections' });
    expect(within(tablist).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Stables', 'Strategies', 'Editor', 'Catalogue']);
    expect(within(tablist).getByRole('tab', { name: 'Catalogue' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText(/minion-horde/)).toBeInTheDocument();
    fireEvent.click(within(tablist).getByRole('tab', { name: 'Strategies' }));
    expect(screen.getByTestId('location')).toHaveTextContent('tab=strategies');
    expect(await screen.findByText('Season 3 · cycle 42 of 100 · averages over active stables')).toBeInTheDocument();
  });

  it('moves between tabs with the arrow keys', () => {
    desktop = true;
    renderPage();
    const stables = screen.getByRole('tab', { name: 'Stables' });
    fireEvent.keyDown(stables, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Strategies' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Strategies' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Strategies' }), { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Catalogue' })).toHaveAttribute('aria-selected', 'true');
  });

  it('stacks the four sections below 1024 px, below the status bar', async () => {
    renderPage();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(expect.arrayContaining(['Stables', 'Strategies', 'Editor', 'Catalogue']));
    const statusBarEl = await screen.findByTestId('automaton-status-bar');
    const stables = screen.getByRole('heading', { level: 2, name: 'Stables' });
    expect(statusBarEl.compareDocumentPosition(stables) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('automatons-page')).toHaveClass('min-w-0', 'max-w-full', 'overflow-x-hidden');
    expect(await screen.findAllByText('Kamino Clone Legion')).not.toHaveLength(0);
  });

  it('renders the status bar and opens Stables filtered on Needs attention', async () => {
    desktop = true;
    renderPage('/admin/automatons?tab=catalogue');
    expect(await screen.findByText(/^Cycle 42 · \d+ Oct, \d\d:\d\d$/)).toBeInTheDocument();
    expect(screen.getByText('11 stables · 38 s')).toBeInTheDocument();
    expect(screen.getByText('None')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '2 stables →' }));
    expect(screen.getByTestId('location')).toHaveTextContent('tab=stables');
    expect(screen.getByTestId('location')).toHaveTextContent('filter=attention');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Needs attention · 1' })).toHaveAttribute('aria-pressed', 'true'));
    expect(screen.getAllByText('Decepticon Armada').length).toBeGreaterThan(0);
    expect(screen.queryByText('Grim Reaper Works')).not.toBeInTheDocument();
  });

  it('asks before turning the Program_Switch off', async () => {
    desktop = true;
    api.setProgramSwitch.mockResolvedValue({ previous: true, current: false, updatedAt: '' });
    renderPage();
    const toggle = await screen.findByRole('switch', { name: 'Automatons act each cycle' });
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));
    fireEvent.click(toggle);
    const dialog = screen.getByRole('dialog', { name: 'Stop all Automatons?' });
    expect(dialog).toHaveTextContent('Their robots keep fighting, but no Automaton will buy, upgrade or re-subscribe anything until you turn this back on.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(api.setProgramSwitch).not.toHaveBeenCalled();
    fireEvent.click(toggle);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Stop Automatons' }));
    await waitFor(() => expect(api.setProgramSwitch).toHaveBeenCalledWith(false));
  });

  it('confirms Activate all drafts with the draft count', async () => {
    desktop = true;
    api.activateAllDrafts.mockResolvedValue({ outcomes: [{ catalogueKey: 'grim-reaper', outcome: 'activated', stableName: 'Grim Reaper Works', userId: 9 }] });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Activate all drafts' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Activate 1 draft stables? Each one joins the game with ₡3,000,000 and starts building after the next settlement. Activation cannot be undone.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Activate all drafts' }));
    expect(await screen.findByText('Activated 1 stables.')).toBeInTheDocument();
  });

  it('opens the Stables tab filtered on a strategy from the comparison', async () => {
    desktop = true;
    renderPage('/admin/automatons?tab=strategies&q=decep');
    fireEvent.click((await screen.findAllByRole('button', { name: 'Swarm' }))[0]);
    expect(screen.getByTestId('location')).toHaveTextContent('strategy=swarm');
    expect(search().has('q')).toBe(false);
    expect(await screen.findByRole('button', { name: 'All · 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Strategy: Swarm/ })).toBeInTheDocument();
  });

  it('writes the strategy, search and sort of the Stables toolbar to the URL', async () => {
    desktop = true;
    renderPage();
    await screen.findByText('3 of 3 stables');
    fireEvent.change(screen.getByRole('combobox', { name: 'Strategy' }), { target: { value: 'trio' } });
    expect(search().get('strategy')).toBe('trio');
    expect(await screen.findByText('1 of 3 stables')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Strategy' }), { target: { value: '' } });
    expect(search().has('strategy')).toBe(false);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search stables' }), { target: { value: 'Grim' } });
    expect(search().get('q')).toBe('Grim');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search stables' }), { target: { value: '' } });
    expect(search().has('q')).toBe(false);

    fireEvent.click(within(screen.getByRole('table')).getByRole('button', { name: /^Credits/ }));
    expect(search().get('sort')).toBe('credits:desc');
    expect(within(screen.getByRole('table')).getByRole('columnheader', { name: /^Credits/ })).toHaveAttribute('aria-sort', 'descending');
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort by' }), { target: { value: '' } });
    expect(search().has('sort')).toBe(false);
  });

  it('applies ?q= and ?sort= from a deep link and clears the filters', async () => {
    desktop = true;
    renderPage('/admin/automatons?q=decep&sort=name:desc');
    expect(await screen.findByText('1 of 3 stables')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search stables' })).toHaveValue('decep');
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveValue('name');
    expect(screen.getAllByText('Decepticon Armada').length).toBeGreaterThan(0);
    expect(screen.queryByText('Kamino Clone Legion')).not.toBeInTheDocument();
    expect(screen.queryByText('Grim Reaper Works')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Draft · 0' }));
    expect(await screen.findByText('No stables match these filters.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(search().has('q')).toBe(false);
    expect(search().has('filter')).toBe(false);
    expect(search().get('sort')).toBe('name:desc');
    expect(await screen.findByText('3 of 3 stables')).toBeInTheDocument();
  });

  it('clears the search when the status bar opens Needs attention', async () => {
    desktop = true;
    renderPage('/admin/automatons?q=kamino');
    fireEvent.click(await screen.findByRole('button', { name: '2 stables →' }));
    expect(search().get('filter')).toBe('attention');
    expect(search().has('q')).toBe(false);
  });
});
