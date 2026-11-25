import { useApiQuery } from '../../hooks/useApiQuery';
import {
  fetchInstances,
  fetchMyStandings,
  fetchStandingsPage,
  type LeagueInstanceSummary,
  type StandingsPage,
  type StandingsPageRequest,
} from '../../utils/leagueStandingsApi';
import type { MyStandingEntry } from '@shared/types';


export interface MyStandingsState {
  entries: MyStandingEntry[];
  /** True once the request settled (loaded or failed). */
  settled: boolean;
  failed: boolean;
}

/** The viewer's entries in every league (`GET /api/leagues/my-standings`). */
export function useMyStandings(): MyStandingsState {
  const query = useApiQuery(() => fetchMyStandings(), []);
  return { entries: query.data ?? [], settled: !query.loading, failed: Boolean(query.error) };
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
  const { mode, tier, instance, page, perPage, stables } = request ?? {};
  const enabled = Boolean(mode && tier && page && perPage);
  const query = useApiQuery(
    async () => {
      const req: StandingsPageRequest = {
        mode: mode!, tier: tier!, instance: instance ?? null, page: page!, perPage: perPage!, stables: stables ?? 'all',
      };
      const [pageData, instanceList] = await Promise.all([fetchStandingsPage(req), fetchInstances(mode!, tier!)]);
      return { req, pageData, instanceList };
    },
    [mode, tier, instance, page, perPage, stables],
    { enabled },
  );

  const shown = query.data?.req ?? null;
  const currentView = sameView(shown, request);
  const currentTier = shown !== null && request !== null && shown.mode === request.mode && shown.tier === request.tier;
  return {
    data: currentView ? query.data!.pageData : null,
    instances: currentTier ? query.data!.instanceList : [],
    shown,
    stale: currentView && !sameRequest(shown, request),
    loading: enabled && query.loading,
    failed: Boolean(query.error),
    reload: query.refetch,
  };
}
