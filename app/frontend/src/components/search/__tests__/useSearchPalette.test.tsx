import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useSearchPalette from '../useSearchPalette';
import { search } from '../../../utils/searchApi';
import type { SearchResponse } from '../../../utils/searchTypes';

vi.mock('../../../utils/searchApi', () => ({
  search: vi.fn(),
}));

const mockedSearch = vi.mocked(search);

const SEARCH_RESPONSE: SearchResponse = {
  robots: [
    {
      category: 'robots',
      id: 7,
      label: 'Atlas',
    },
  ],
  stables: [],
  guide: [],
};

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolvePromise: (value: T) => void = () => undefined;
  let rejectPromise: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

describe('useSearchPalette', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockedSearch.mockReset();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not request normalized queries shorter than two characters', () => {
    const { result } = renderHook(() => useSearchPalette());

    act(() => {
      result.current.openSearch();
      result.current.onQueryChange(' a ');
      vi.advanceTimersByTime(500);
    });

    expect(result.current.normalizedQuery).toBe('a');
    expect(result.current.state).toBe('too-short');
    expect(mockedSearch).not.toHaveBeenCalled();
  });

  it('waits 200ms and presents only the latest request generation', async () => {
    const firstRequest = deferred<SearchResponse>();
    const secondRequest = deferred<SearchResponse>();
    mockedSearch
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);

    const { result } = renderHook(() => useSearchPalette());

    act(() => {
      result.current.openSearch();
      result.current.onQueryChange('atlas');
    });
    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(mockedSearch).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(mockedSearch).toHaveBeenCalledTimes(1);
    expect(mockedSearch).toHaveBeenLastCalledWith('atlas', expect.any(AbortSignal));

    act(() => {
      result.current.onQueryChange('behemoth');
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(mockedSearch).toHaveBeenCalledTimes(2);
    expect(mockedSearch).toHaveBeenLastCalledWith('behemoth', expect.any(AbortSignal));

    await act(async () => {
      firstRequest.resolve(SEARCH_RESPONSE);
      await Promise.resolve();
    });
    expect(result.current.state).toBe('loading');
    expect(result.current.response).toBeNull();

    await act(async () => {
      secondRequest.resolve(SEARCH_RESPONSE);
      await Promise.resolve();
    });
    expect(result.current.state).toBe('results');
    expect(result.current.response).toBe(SEARCH_RESPONSE);
    expect(result.current.normalizedQuery).toBe('behemoth');
  });
});
