/**
 * AdminActionsPage: area and Failures chips with counts (in the URL), plain
 * rows with the admin's name, the expanded row (stored details and a link to
 * the page the action was taken on), pagination, empty and error states.
 * Rows are ACC's admin actions (1 Nov 2026).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import AdminActionsPage from '../AdminActionsPage';
import type { AdminActionEntry, AdminActionsPage as ActionsPage } from '../../../utils/adminActionsApi';

const mockGet = vi.fn();
vi.mock('../../../utils/apiClient', () => ({
  default: { get: (...args: unknown[]) => mockGet(...args) },
}));

const admin = { userId: 2, name: 'Administrator' };

const ROLLOVER: AdminActionEntry = {
  id: 21,
  createdAt: '2026-07-29T14:33:00.000Z',
  operationType: 'season_rollover',
  result: 'success',
  area: 'season',
  title: 'Rolled over season 0 → 1',
  details: '2.3 s · 3,650 snapshot rows · 304 accolades',
  link: '/admin/seasons',
  admin,
  summary: { seasonNumber: 0, durations: { archiveMs: 68, purgeMs: 1303, totalMs: 2289 }, snapshotRows: 3650, accoladeRows: 304 },
};

const FAILED: AdminActionEntry = {
  id: 20,
  createdAt: '2026-07-29T14:15:00.000Z',
  operationType: 'season_rollover',
  result: 'failure',
  area: 'season',
  title: 'Rollover of season 0 failed',
  details: 'canceling statement due to statement timeout',
  link: '/admin/seasons',
  admin,
  summary: { seasonNumber: 0, error: 'canceling statement due to statement timeout' },
};

const ACTIVATED: AdminActionEntry = {
  id: 30,
  createdAt: '2026-10-27T21:16:00.000Z',
  operationType: 'automaton.activate_all',
  result: 'success',
  area: 'automatons',
  title: 'Activated all Automaton drafts',
  details: 'nothing left to activate',
  link: '/admin/automatons',
  admin,
  summary: { activated: [] },
};

function page(entries: AdminActionEntry[], overrides: Partial<ActionsPage> = {}): ActionsPage {
  return {
    entries,
    total: entries.length,
    page: 1,
    pageSize: 50,
    totalPages: 1,
    counts: { all: 30, failures: 9, byArea: { cycles: 13, season: 13, automatons: 4, moderation: 0, players: 0, changelog: 0, other: 0 } },
    since: '2026-05-16T09:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  mockGet.mockReset();
  mockGet.mockImplementation(async (_url: string, config: { params: Record<string, string | number> }) => {
    if (config.params.result === 'failure') return { data: page([FAILED]) };
    if (config.params.area === 'season') return { data: page([ROLLOVER, FAILED]) };
    return { data: page([ACTIVATED, ROLLOVER, FAILED]) };
  });
});

function LocationProbe(): React.ReactElement {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}
const search = (): URLSearchParams => new URLSearchParams(screen.getByTestId('location').textContent ?? '');

function renderPage(path = '/admin/actions') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/actions" element={<><AdminActionsPage /><LocationProbe /></>} />
        <Route path="/admin/seasons" element={<p>Season Control page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminActionsPage', () => {
  it('lists actions newest first with plain titles, the admin name and the result', async () => {
    renderPage();
    const list = await screen.findByRole('list', { name: 'Admin actions, newest first' });
    expect(mockGet).toHaveBeenCalledWith('/api/admin/actions', expect.objectContaining({ params: { page: 1, pageSize: 50 } }));
    const rows = within(list).getAllByRole('button');
    expect(rows).toHaveLength(3);
    // The year shows only when it is not the current one.
    expect(rows[0]).toHaveTextContent(/27 Oct( 2026)? 21:16/);
    expect(rows[0]).toHaveTextContent('Activated all Automaton drafts');
    expect(rows[0]).toHaveTextContent('nothing left to activate');
    expect(within(rows[0]).getAllByText('Administrator').length).toBeGreaterThan(0);
    expect(within(rows[2]).getAllByText('Failed').length).toBeGreaterThan(0);
    expect(within(rows[2]).getByText('Rollover of season 0 failed')).toHaveClass('text-error');
    expect(screen.queryByText(/User 2/)).toBeNull();
    expect(screen.queryByText(/"seasonNumber"/)).toBeNull();
    expect(screen.getByText('30 actions since 16 May 2026 · kept forever')).toBeInTheDocument();
  });

  it('shows the chip counts and keeps area and result in the URL', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('list', { name: 'Admin actions, newest first' });
    const areas = screen.getByRole('group', { name: 'Area' });
    expect(within(areas).getByRole('button', { name: 'All · 30' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(areas).getByRole('button', { name: 'Changelog · 0' })).toBeInTheDocument();
    expect(within(areas).queryByRole('button', { name: /^Other/ })).toBeNull();

    await user.click(within(areas).getByRole('button', { name: 'Season · 13' }));
    expect(search().get('area')).toBe('season');
    await waitFor(() => expect(mockGet).toHaveBeenLastCalledWith('/api/admin/actions', expect.objectContaining({ params: { area: 'season', page: 1, pageSize: 50 } })));

    await user.click(screen.getByRole('button', { name: 'Failures · 9' }));
    expect(search().get('result')).toBe('failure');
    await waitFor(() => expect(mockGet).toHaveBeenLastCalledWith('/api/admin/actions', expect.objectContaining({ params: { area: 'season', result: 'failure', page: 1, pageSize: 50 } })));

    await user.click(within(areas).getByRole('button', { name: 'All · 30' }));
    await user.click(screen.getByRole('button', { name: 'All results' }));
    expect(search().has('area')).toBe(false);
    expect(search().has('result')).toBe(false);
  });

  it('opens a row with its stored details and a link to the page it was taken on', async () => {
    const user = userEvent.setup();
    renderPage();
    const list = await screen.findByRole('list', { name: 'Admin actions, newest first' });
    const row = within(list).getByRole('button', { name: /Rolled over season 0 → 1/ });
    expect(row).toHaveAttribute('aria-expanded', 'false');
    await user.click(row);
    expect(row).toHaveAttribute('aria-expanded', 'true');
    const details = document.getElementById(row.getAttribute('aria-controls') ?? '');
    expect(details).not.toBeNull();
    const panel = within(details as HTMLElement);
    expect(panel.getByText('snapshotRows')).toBeInTheDocument();
    expect(panel.getByText('3,650')).toBeInTheDocument();
    expect(panel.getByText('archiveMs 68 · purgeMs 1,303 · totalMs 2,289')).toBeInTheDocument();
    await user.click(panel.getByRole('link', { name: 'Open Season Control' }));
    expect(await screen.findByText('Season Control page')).toBeInTheDocument();
  });

  it('pages through long lists', async () => {
    const user = userEvent.setup();
    mockGet.mockImplementation(async (_url: string, config: { params: Record<string, string | number> }) => ({
      data: page([ACTIVATED], { total: 120, totalPages: 3, page: Number(config.params.page) }),
    }));
    renderPage('/admin/actions?page=2');
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/admin/actions', expect.objectContaining({ params: { page: 2, pageSize: 50 } })));
    const nav = await screen.findByRole('navigation', { name: 'Actions pages' });
    expect(nav).toHaveTextContent('Showing 51–100 of 120 actions');
    await user.click(within(nav).getByRole('button', { name: 'Next' }));
    expect(search().get('page')).toBe('3');
  });

  it('says when nothing matches the filters', async () => {
    mockGet.mockResolvedValue({ data: page([], { total: 0 }) });
    renderPage('/admin/actions?area=players');
    expect(await screen.findByText('No admin actions match these filters.')).toBeInTheDocument();
  });

  it('shows an error with Retry', async () => {
    const user = userEvent.setup();
    mockGet.mockRejectedValueOnce(new Error('boom'));
    renderPage();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not load the admin actions.');
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('list', { name: 'Admin actions, newest first' })).toBeInTheDocument();
  });
});
