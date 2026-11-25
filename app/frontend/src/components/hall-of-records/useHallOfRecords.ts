import { api } from '../../utils/api';
import { useApiQuery } from '../../hooks/useApiQuery';
import type { StableFilter } from '../../utils/stableFilter';
import type { RecordsData } from './types';

export interface HallOfRecordsState {
  records: RecordsData | null;
  loading: boolean;
  failed: boolean;
  reload: () => void;
}

/**
 * Loads `GET /api/records` for one "Stables" filter (#595); a newer request
 * aborts the older one. The previous payload stays on screen while the other
 * filter loads.
 */
export function useHallOfRecords(stables: StableFilter = 'all'): HallOfRecordsState {
  const path = stables === 'players' ? '/api/records?stables=players' : '/api/records';
  const query = useApiQuery((signal) => api.get<RecordsData>(path, { signal }), [path]);
  return { records: query.data, loading: query.loading, failed: Boolean(query.error), reload: query.refetch };
}
