/**
 * Data hook of the admin Tournaments page. One request per load or Refresh;
 * a new request aborts the previous one and the last good data stays on screen.
 */
import { apiErrorMessage } from '../utils/ApiError';
import { getTournamentOverview } from '../utils/adminTournamentsApi';
import { useApiQuery } from './useApiQuery';
import type { TournamentOverview } from '@shared/types';

export interface TournamentOverviewState {
  data: TournamentOverview | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useTournamentOverview(): TournamentOverviewState {
  const query = useApiQuery((signal) => getTournamentOverview(signal), []);
  return {
    data: query.data,
    loading: query.loading,
    error: apiErrorMessage(query.error, 'Could not load tournaments.'),
    reload: query.refetch,
  };
}
