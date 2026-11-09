import { describe, it, expect, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useApiQuery } from '../useApiQuery';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useApiQuery', () => {
  it('loads on mount and exposes the result', async () => {
    const load = vi.fn(async () => ['a', 'b']);
    const { result } = renderHook(() => useApiQuery(load, []));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(['a', 'b']);
    expect(result.current.error).toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('never lets an older response overwrite a newer one', async () => {
    const pending = new Map<string, Deferred<string>>();
    const signals = new Map<string, AbortSignal>();
    const { result, rerender } = renderHook(
      ({ filter }: { filter: string }) =>
        useApiQuery((signal) => {
          const d = deferred<string>();
          pending.set(filter, d);
          signals.set(filter, signal);
          return d.promise;
        }, [filter]),
      { initialProps: { filter: 'all' } },
    );

    rerender({ filter: 'active' });
    expect(signals.get('all')?.aborted).toBe(true);

    await act(async () => {
      pending.get('active')?.resolve('active result');
      pending.get('all')?.resolve('stale result');
    });

    expect(result.current.data).toBe('active result');
    expect(result.current.loading).toBe(false);
  });

  it('reports failures but not cancellations', async () => {
    const failure = new Error('boom');
    const { result } = renderHook(() => useApiQuery(async () => { throw failure; }, []));
    await waitFor(() => expect(result.current.error).toBe(failure));
    expect(result.current.loading).toBe(false);

    const cancelled = renderHook(() =>
      useApiQuery(async () => { throw Object.assign(new Error('canceled'), { name: 'CanceledError' }); }, []),
    );
    await act(async () => {});
    expect(cancelled.result.current.error).toBeNull();
  });

  it('keeps the previous data during a refetch and replaces it after', async () => {
    let call = 0;
    const gates: Array<Deferred<number>> = [];
    const { result } = renderHook(() =>
      useApiQuery(() => {
        call += 1;
        const d = deferred<number>();
        gates.push(d);
        return d.promise;
      }, []),
    );
    await act(async () => gates[0].resolve(1));
    expect(result.current.data).toBe(1);

    act(() => result.current.refetch());
    expect(call).toBe(2);
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe(1);

    await act(async () => gates[1].resolve(2));
    expect(result.current.data).toBe(2);
    expect(result.current.loading).toBe(false);
  });

  it('does not send the request while disabled', async () => {
    const load = vi.fn(async () => 'x');
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useApiQuery(load, [], { enabled }),
      { initialProps: { enabled: false } },
    );
    expect(result.current.loading).toBe(false);
    expect(load).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await waitFor(() => expect(result.current.data).toBe('x'));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('lets the caller replace the cached data', async () => {
    const { result } = renderHook(() => useApiQuery(async () => [1, 2], []));
    await waitFor(() => expect(result.current.data).toEqual([1, 2]));
    act(() => result.current.setData((previous) => [...(previous ?? []), 3]));
    expect(result.current.data).toEqual([1, 2, 3]);
  });

  it('aborts the pending request on unmount', async () => {
    let seen: AbortSignal | undefined;
    const { unmount } = renderHook(() =>
      useApiQuery((signal) => {
        seen = signal;
        return new Promise<never>(() => {});
      }, []),
    );
    unmount();
    expect(seen?.aborted).toBe(true);
  });
});
