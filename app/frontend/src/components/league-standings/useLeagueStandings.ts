import { useCallback, useEffect, useRef, useState } from 'react';
import { createLogger } from '../../utils/logger';
import {
  fetchInstances,
  fetchMyStandings,
  fetchStandingsPage,
  type LeagueInstanceSummary,
  type StandingsPage,
  type StandingsPageRequest,
} from '../../utils/leagueStandingsApi';
import type { MyStandingEntry } from '../../utils/leagueStandings';

const log = createLogger('useLeagueStandings');

export interface MyStandingsState {
  entries: MyStandingEntry[];
  /** True once the request settled (loaded or failed). */
  settled: boolean;
  failed: boolean;
}

/** The viewer's entries in every league (`GET /api/leagues/my-standings`). */
export function useMyStandings(): MyStandingsState {
  const [state, setState] = useState<MyStandingsState>({ entries: [], settled: false, failed: false });
  useEffect(() => {
    let active = true;
    fetchMyStandings()
      .then((entries) => { if (active) setState({ entries, settled: true, failed: false }); })
      .catch((err: unknown) => {
        log.error('My standings fetch error', { err });
        if (active) setState({ entries: [], settled: true, failed: true });
      });
    return () => { active = false; };
  }, []);
  return state;
}

export interface StandingsPageState {
  /**
   * The rows of the current view (mode, tier and instance). Another page of the
   * same view keeps the old rows on screen while it loads; a different view
   * shows nothing until its own rows arrive, so old rows are never labelled
   * with the new tier or league.
   */
  data: StandingsPage | null;
  /** The current mode and tier's instances; empty while another tier's are cached. */
  instances: LeagueInstanceSummary[];
  /** The request `data` answers. */
  shown: StandingsPageRequest | null;
  /** `data` is another page of the current view than the one requested. */
  stale: boolean;
  loading: boolean;
  failed: boolean;
  reload: () => void;
}

const sameView = (a: StandingsPageRequest | null, b: StandingsPageRequest | null): boolean =>
  a !== null && b !== null && a.mode === b.mode && a.tier === b.tier && a.instance === b.instance && a.stables === b.stables;

const sameRequest = (a: StandingsPageRequest | null, b: StandingsPageRequest | null): boolean =>
  sameView(a, b) && a!.page === b!.page && a!.perPage === b!.perPage;

/**
 * One page of standings plus the tier's instances. Every new request (or no
 * request, while the page waits for its opening view) supersedes the previous
 * one, whose late response is dropped.
 */
export function useStandingsPage(request: StandingsPageRequest | null): StandingsPageState {
  const [data, setData] = useState<StandingsPage | null>(null);
  const [instances, setInstances] = useState<LeagueInstanceSummary[]>([]);
  const [shown, setShown] = useState<StandingsPageRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const current = useRef(0);

  const { mode, tier, instance, page, perPage, stables } = request ?? {};
  useEffect(() => {
    // Advance first: with no request, a response still in flight is stale too.
    const id = ++current.current;
    if (!mode || !tier || !page || !perPage) {
      setLoading(false);
      return;
    }
    const req: StandingsPageRequest = { mode, tier, instance: instance ?? null, page, perPage, stables: stables ?? 'all' };
    setLoading(true);
    setFailed(false);
    Promise.all([fetchStandingsPage(req), fetchInstances(mode, tier)])
      .then(([pageData, instanceList]) => {
        if (id !== current.current) return;
        setData(pageData);
        setInstances(instanceList);
        setShown(req);
      })
      .catch((err: unknown) => {
        log.error('Standings fetch error', { err });
        if (id === current.current) setFailed(true);
      })
      .finally(() => {
        if (id === current.current) setLoading(false);
      });
  }, [mode, tier, instance, page, perPage, stables, attempt]);

  useEffect(() => () => { current.current += 1; }, []);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const currentView = sameView(shown, request);
  const currentTier = shown !== null && request !== null && shown.mode === request.mode && shown.tier === request.tier;
  return {
    data: currentView ? data : null,
    instances: currentTier ? instances : [],
    shown,
    stale: currentView && !sameRequest(shown, request),
    loading,
    failed,
    reload,
  };
}
