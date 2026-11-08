import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../utils/api';
import { createLogger } from '../../utils/logger';
import type { RecordsData } from './types';

const log = createLogger('useHallOfRecords');

export interface HallOfRecordsState {
  records: RecordsData | null;
  loading: boolean;
  failed: boolean;
  reload: () => void;
}

/** Loads `GET /api/records`; a stale response after unmount or reload is ignored. */
export function useHallOfRecords(): HallOfRecordsState {
  const [records, setRecords] = useState<RecordsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const request = useRef(0);

  const load = useCallback(async (): Promise<void> => {
    const id = ++request.current;
    setLoading(true);
    setFailed(false);
    try {
      const data = await api.get<RecordsData>('/api/records');
      if (id === request.current) setRecords(data);
    } catch (err) {
      log.error('Records fetch error', { err });
      if (id === request.current) setFailed(true);
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      request.current += 1;
    };
  }, [load]);

  const reload = useCallback(() => {
    void load();
  }, [load]);

  return { records, loading, failed, reload };
}
