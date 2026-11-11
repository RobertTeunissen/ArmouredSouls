import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useStandingsPage } from '../useLeagueStandings';
import type { StandingsPage, StandingsPageRequest } from '../../../utils/leagueStandingsApi';

const fetchStandingsPage = vi.fn();
const fetchInstances = vi.fn();
vi.mock('../../../utils/leagueStandingsApi', () => ({
  fetchStandingsPage: (...args: unknown[]) => fetchStandingsPage(...args),
  fetchInstances: (...args: unknown[]) => fetchInstances(...args),
  fetchMyStandings: vi.fn(),
}));

const req = (over: Partial<StandingsPageRequest> = {}): StandingsPageRequest =>
  ({ mode: '1v1', tier: 'diamond', instance: 'diamond_1', page: 1, perPage: 100, stables: 'all', ...over });

const page = (label: string): StandingsPage => ({
  rows: [{ rank: 1, entityId: 1, name: label } as StandingsPage['rows'][number]],
  pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
  zoneMeta: {} as StandingsPage['zoneMeta'],
});

/** A response the test releases by hand. */
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

beforeEach(() => {
  fetchStandingsPage.mockReset();
  fetchInstances.mockReset();
  fetchInstances.mockResolvedValue([{ id: 'diamond_1', size: 67, players: 4 }]);
});

describe('useStandingsPage', () => {
  it('drops a response still in flight when the request goes away (Copilot #588)', async () => {
    // Deep link to a tier, then pick another league before my-standings
    // settles: the page passes no request while it waits for the opening view.
    const slow = deferred<StandingsPage>();
    fetchStandingsPage.mockReturnValueOnce(slow.promise);
    const { result, rerender } = renderHook(({ request }) => useStandingsPage(request), {
      initialProps: { request: req() as StandingsPageRequest | null },
    });
    expect(result.current.loading).toBe(true);

    rerender({ request: null });
    expect(result.current.loading).toBe(false);

    await act(async () => { slow.resolve(page('Diamond 1')); await slow.promise; });
    expect(result.current.data).toBeNull();
    expect(result.current.shown).toBeNull();
  });

  it('never labels another view\'s rows with the current selection (Copilot #588)', async () => {
    fetchStandingsPage.mockResolvedValueOnce(page('1v1 Diamond 1'));
    const { result, rerender } = renderHook(({ request }) => useStandingsPage(request), {
      initialProps: { request: req() },
    });
    await waitFor(() => expect(result.current.data?.rows[0].name).toBe('1v1 Diamond 1'));
    expect(result.current.instances).toHaveLength(1);

    // Another league, same tier: nothing until its own rows arrive.
    const koth = deferred<StandingsPage>();
    fetchStandingsPage.mockReturnValueOnce(koth.promise);
    rerender({ request: req({ mode: 'koth' }) });
    expect(result.current.data).toBeNull();
    expect(result.current.instances).toEqual([]);

    await act(async () => { koth.resolve(page('KotH Diamond 1')); await koth.promise; });
    await waitFor(() => expect(result.current.data?.rows[0].name).toBe('KotH Diamond 1'));
  });

  it('keeps the rows on screen while another page of the same view loads', async () => {
    fetchStandingsPage.mockResolvedValueOnce(page('page 1'));
    const { result, rerender } = renderHook(({ request }) => useStandingsPage(request), {
      initialProps: { request: req({ instance: null, perPage: 50 }) },
    });
    await waitFor(() => expect(result.current.data?.rows[0].name).toBe('page 1'));

    const next = deferred<StandingsPage>();
    fetchStandingsPage.mockReturnValueOnce(next.promise);
    rerender({ request: req({ instance: null, perPage: 50, page: 2 }) });
    expect(result.current.data?.rows[0].name).toBe('page 1');
    expect(result.current.stale).toBe(true);

    await act(async () => { next.resolve(page('page 2')); await next.promise; });
    await waitFor(() => expect(result.current.stale).toBe(false));
    expect(result.current.data?.rows[0].name).toBe('page 2');
  });

  it('treats the Players filter as another view and asks the API for it (#595)', async () => {
    fetchStandingsPage.mockResolvedValueOnce(page('all stables'));
    const { result, rerender } = renderHook(({ request }) => useStandingsPage(request), {
      initialProps: { request: req() },
    });
    await waitFor(() => expect(result.current.data?.rows[0].name).toBe('all stables'));

    const players = deferred<StandingsPage>();
    fetchStandingsPage.mockReturnValueOnce(players.promise);
    rerender({ request: req({ stables: 'players' }) });
    expect(result.current.data).toBeNull();
    expect(fetchStandingsPage).toHaveBeenLastCalledWith(expect.objectContaining({ stables: 'players' }));

    await act(async () => { players.resolve(page('players only')); await players.promise; });
    await waitFor(() => expect(result.current.data?.rows[0].name).toBe('players only'));
  });
});
