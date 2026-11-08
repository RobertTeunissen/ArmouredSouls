import { RefreshingCache } from '../refreshingCache';

/** A controllable clock and loader. */
function setup(ttlMs = 1000) {
  let now = 0;
  let calls = 0;
  const pending: Array<{ resolve: (v: number) => void; reject: (e: unknown) => void }> = [];
  const load = jest.fn(() => {
    calls += 1;
    return new Promise<number>((resolve, reject) => pending.push({ resolve, reject }));
  });
  const onError = jest.fn();
  const cache = new RefreshingCache<number>(ttlMs, load, onError, () => now);
  return {
    cache, load, onError, pending,
    advance: (ms: number) => { now += ms; },
    calls: () => calls,
  };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('RefreshingCache', () => {
  it('makes the first callers wait for one shared load', async () => {
    const { cache, load, pending } = setup();
    const a = cache.get();
    const b = cache.get();
    expect(load).toHaveBeenCalledTimes(1);
    pending[0].resolve(1);
    await expect(a).resolves.toBe(1);
    await expect(b).resolves.toBe(1);
  });

  it('serves a fresh value without loading', async () => {
    const { cache, load, pending, advance } = setup();
    const first = cache.get();
    pending[0].resolve(1);
    await first;
    advance(999);
    await expect(cache.get()).resolves.toBe(1);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('serves a stale value at once and refreshes it once in the background', async () => {
    const { cache, load, pending, advance } = setup();
    const first = cache.get();
    pending[0].resolve(1);
    await first;
    advance(1000);

    await expect(cache.get()).resolves.toBe(1);
    await expect(cache.get()).resolves.toBe(1);
    expect(load).toHaveBeenCalledTimes(2);

    pending[1].resolve(2);
    await flush();
    await expect(cache.get()).resolves.toBe(2);
  });

  it('keeps the stale value when a background refresh fails, and reports it', async () => {
    const { cache, pending, advance, onError } = setup();
    const first = cache.get();
    pending[0].resolve(1);
    await first;
    advance(1000);

    await cache.get();
    pending[1].reject(new Error('db down'));
    await flush();

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    await expect(cache.get()).resolves.toBe(1);
  });

  it('rejects a failed first load and tries again on the next call', async () => {
    const { cache, pending, calls } = setup();
    const first = cache.get();
    pending[0].reject(new Error('db down'));
    await expect(first).rejects.toThrow('db down');

    const second = cache.get();
    expect(calls()).toBe(2);
    pending[1].resolve(5);
    await expect(second).resolves.toBe(5);
  });

  it('waits for a fresh load after invalidate', async () => {
    const { cache, pending } = setup();
    const first = cache.get();
    pending[0].resolve(1);
    await first;
    cache.invalidate();
    const next = cache.get();
    pending[1].resolve(3);
    await expect(next).resolves.toBe(3);
  });

  it('never stores a background refresh that started before invalidate', async () => {
    const { cache, load, pending, advance } = setup();
    const first = cache.get();
    pending[0].resolve(1);
    await first;
    advance(1000);
    await cache.get(); // stale: starts background refresh #2 (pre-rollover data)

    cache.invalidate();
    const next = cache.get(); // must not join refresh #2
    expect(load).toHaveBeenCalledTimes(3);

    pending[1].resolve(99); // the pre-invalidate refresh lands late
    await flush();
    pending[2].resolve(3);
    await expect(next).resolves.toBe(3);
    await expect(cache.get()).resolves.toBe(3);
  });

  it('does not let a discarded load clear the load that replaced it', async () => {
    const { cache, load, pending } = setup();
    const first = cache.get();
    cache.invalidate();
    const second = cache.get();
    expect(load).toHaveBeenCalledTimes(2);

    pending[0].resolve(1); // the discarded load settles first
    await first;
    const third = cache.get(); // still joins load #2, no third load
    expect(load).toHaveBeenCalledTimes(2);

    pending[1].resolve(2);
    await expect(second).resolves.toBe(2);
    await expect(third).resolves.toBe(2);
  });
});
