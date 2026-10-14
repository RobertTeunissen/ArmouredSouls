/**
 * `runWithConcurrency` (turnStepPool.ts): the Turn_Step's bounded pool
 * (AUTOMATON_TURN_STEP_DEADLINE.md, "Bounded concurrency").
 */
import { runWithConcurrency } from '../turnStepPool';

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
}

function deferred(): Deferred {
  let resolve: () => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

/** Let pending promise callbacks run. */
const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

/** A worker whose items finish only when the test resolves them. */
function controlledWorker(count: number): {
  gates: Deferred[];
  started: number[];
  finished: number[];
  inFlight: () => number;
  peak: () => number;
  worker: (item: number, index: number) => Promise<void>;
} {
  const gates = Array.from({ length: count }, deferred);
  const started: number[] = [];
  const finished: number[] = [];
  let running = 0;
  let peak = 0;
  return {
    gates,
    started,
    finished,
    inFlight: () => running,
    peak: () => peak,
    worker: async (item, index) => {
      expect(item).toBe(index * 10);
      started.push(index);
      running++;
      peak = Math.max(peak, running);
      try {
        await gates[index].promise;
        finished.push(index);
      } finally {
        running--;
      }
    },
  };
}

const items = (n: number): number[] => Array.from({ length: n }, (_, i) => i * 10);

describe('runWithConcurrency', () => {
  it('never runs more than N at once and starts items in index order', async () => {
    const w = controlledWorker(7);
    const run = runWithConcurrency(items(7), 3, w.worker);
    await flush();
    expect(w.started).toEqual([0, 1, 2]);

    // Finish out of order: a free lane takes the next index, not the finished one.
    w.gates[1].resolve();
    await flush();
    expect(w.started).toEqual([0, 1, 2, 3]);
    w.gates[0].resolve();
    w.gates[3].resolve();
    await flush();
    expect(w.started).toEqual([0, 1, 2, 3, 4, 5]);
    expect(w.inFlight()).toBe(3);
    for (const gate of w.gates) gate.resolve();
    await run;

    expect(w.started).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(w.finished.sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(w.peak()).toBe(3);
  });

  it('is strictly sequential at concurrency 1', async () => {
    const w = controlledWorker(3);
    const run = runWithConcurrency(items(3), 1, w.worker);
    for (let i = 0; i < 3; i++) {
      await flush();
      expect(w.started).toEqual(Array.from({ length: i + 1 }, (_, k) => k));
      expect(w.inFlight()).toBe(1);
      w.gates[i].resolve();
    }
    await run;
    expect(w.finished).toEqual([0, 1, 2]);
    expect(w.peak()).toBe(1);
  });

  it('runs every item when the concurrency exceeds the item count', async () => {
    const w = controlledWorker(2);
    const run = runWithConcurrency(items(2), 8, w.worker);
    await flush();
    expect(w.started).toEqual([0, 1]);
    for (const gate of w.gates) gate.resolve();
    await run;
    expect(w.peak()).toBe(2);
  });

  it('resolves at once for an empty list', async () => {
    const worker = jest.fn(async () => undefined);
    await expect(runWithConcurrency([], 3, worker)).resolves.toBeUndefined();
    expect(worker).not.toHaveBeenCalled();
  });

  it('treats a concurrency below 1 or NaN as 1', async () => {
    for (const concurrency of [0, Number.NaN]) {
      const w = controlledWorker(2);
      const run = runWithConcurrency(items(2), concurrency, w.worker);
      await flush();
      expect(w.started).toEqual([0]);
      for (const gate of w.gates) gate.resolve();
      await run;
    }
  });

  it('after the first error starts nothing new, waits for in-flight items, then rethrows it', async () => {
    const w = controlledWorker(6);
    const run = runWithConcurrency(items(6), 3, w.worker);
    let settled = false;
    const outcome = run.then(() => 'resolved', (error: unknown) => error).finally(() => { settled = true; });
    await flush();
    expect(w.started).toEqual([0, 1, 2]);

    const first = new Error('claim failed');
    w.gates[1].reject(first);
    await flush();
    // No new start after the failure; 0 and 2 are still in flight.
    expect(w.started).toEqual([0, 1, 2]);
    expect(settled).toBe(false);

    w.gates[0].reject(new Error('second failure'));
    await flush();
    expect(settled).toBe(false);
    w.gates[2].resolve();

    expect(await outcome).toBe(first);
    expect(w.started).toEqual([0, 1, 2]);
    expect(w.finished).toEqual([2]);
    expect(w.inFlight()).toBe(0);
  });
});
