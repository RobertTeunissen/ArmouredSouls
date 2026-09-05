/**
 * Tests for the deferred-work tracker (Spec #51).
 *
 * The contract has two halves that pull in opposite directions, so both are pinned here:
 * `defer` must NOT make its caller wait (that is the whole point of deferring), and
 * `flushDeferredWork` must be able to wait for everything (that is what makes it testable).
 */

import { defer, flushDeferredWork, pendingDeferredCount } from '../../src/services/common/deferredWork';

jest.mock('../../src/config/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

describe('deferredWork', () => {
  afterEach(async () => {
    // Never leak a pending task into the next test — the exact failure mode this module exists
    // to remove.
    await flushDeferredWork();
  });

  it('should not run the work synchronously', () => {
    let ran = false;
    defer('sync check', async () => {
      ran = true;
    });
    // Still queued: `setImmediate` has not fired yet.
    expect(ran).toBe(false);
    expect(pendingDeferredCount()).toBe(1);
  });

  it('should run the work once flushed', async () => {
    let ran = false;
    defer('runs', async () => {
      ran = true;
    });

    await flushDeferredWork();

    expect(ran).toBe(true);
    expect(pendingDeferredCount()).toBe(0);
  });

  it('should await every task when several are queued', async () => {
    const completed: number[] = [];
    for (let i = 0; i < 5; i++) {
      defer(`task ${i}`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        completed.push(i);
      });
    }
    expect(pendingDeferredCount()).toBe(5);

    await flushDeferredWork();

    expect(completed).toHaveLength(5);
    expect(pendingDeferredCount()).toBe(0);
  });

  it('should swallow a failure rather than rejecting the flush', async () => {
    let secondRan = false;
    defer('throws', async () => {
      throw new Error('deferred boom');
    });
    defer('still runs', async () => {
      secondRan = true;
    });

    // A failing task must not reject the flush, and must not stop its siblings. Deferred work
    // is by definition work whose failure must not affect anything else.
    await expect(flushDeferredWork()).resolves.toBeUndefined();
    expect(secondRan).toBe(true);
    expect(pendingDeferredCount()).toBe(0);
  });

  it('should also await work scheduled by deferred work', async () => {
    // `flushDeferredWork` loops rather than awaiting once, because a task may defer more.
    let inner = false;
    defer('outer', async () => {
      defer('inner', async () => {
        inner = true;
      });
    });

    await flushDeferredWork();

    expect(inner).toBe(true);
    expect(pendingDeferredCount()).toBe(0);
  });

  it('should return immediately when nothing is pending', async () => {
    expect(pendingDeferredCount()).toBe(0);
    await expect(flushDeferredWork()).resolves.toBeUndefined();
  });
});
