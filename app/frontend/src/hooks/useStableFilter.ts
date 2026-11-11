/**
 * The overview "Stables" filter (#595): read from `?stables=`, falling back to
 * the choice remembered on this device. A remembered "Players" is written into
 * the URL, so what you share is what you see. Changing it updates both and
 * goes back to the first page of the list.
 */
import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  parseStableFilter,
  readStoredStableFilter,
  storeStableFilter,
  STABLE_FILTER_PARAM,
  type StableFilter,
} from '../utils/stableFilter';

export function useStableFilter(): [StableFilter, (next: StableFilter) => void] {
  const [params, setParams] = useSearchParams();
  const fromUrl = parseStableFilter(params.get(STABLE_FILTER_PARAM));
  const filter = fromUrl ?? readStoredStableFilter();

  useEffect(() => {
    if (fromUrl !== null || filter !== 'players') return;
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set(STABLE_FILTER_PARAM, 'players');
      return next;
    }, { replace: true });
  }, [fromUrl, filter, setParams]);

  const setFilter = useCallback((next: StableFilter) => {
    storeStableFilter(next);
    setParams((current) => {
      const updated = new URLSearchParams(current);
      if (next === 'players') updated.set(STABLE_FILTER_PARAM, 'players');
      else updated.delete(STABLE_FILTER_PARAM);
      updated.delete('page');
      return updated;
    }, { replace: true });
  }, [setParams]);

  return [filter, setFilter];
}
