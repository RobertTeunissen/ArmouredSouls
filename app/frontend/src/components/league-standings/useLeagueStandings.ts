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
  data: StandingsPage | null;
  instances: LeagueInstanceSummary[];
  /** The request `data` answers; while a newer one loads, the old rows stay. */
  shown: StandingsPageRequest | null;
  /** `data` answers an older request than the current one. */
  stale: boolean;
  loading: boolean;
  failed: boolean;
  reload: () => void;
}

const sameRequest = (a: StandingsPageRequest | null, b: StandingsPageRequest | null): boolean =>
  a !== null && b !== null && a.mode === b.mode && a.tier === b.tier && a.instance === b.instance
  && a.page === b.page && a.perPage === b.perPage;

/**
 * One page of standings plus the tier's instances. A response for a request
 * that is no longer current is dropped, so fast clicking never shows another
 * tier's rows; the previous rows stay on screen while the next page loads.
 */
export function useStandingsPage(request: StandingsPageRequest | null): StandingsPageState {
  const [data, setData] = useState<StandingsPage | null>(null);
  const [instances, setInstances] = useState<LeagueInstanceSummary[]>([]);
  const [shown, setShown] = useState<StandingsPageRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const current = useRef(0);

  const { mode, tier, instance, page, perPage } = request ?? {};
  useEffect(() => {
    if (!mode || !tier || !page || !perPage) return;
    const id = ++current.current;
    const req: StandingsPageRequest = { mode, tier, instance: instance ?? null, page, perPage };
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
  }, [mode, tier, instance, page, perPage, attempt]);

  useEffect(() => () => { current.current += 1; }, []);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { data, instances, shown, stale: !sameRequest(shown, request), loading, failed, reload };
}
