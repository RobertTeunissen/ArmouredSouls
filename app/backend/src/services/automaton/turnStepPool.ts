/**
 * Bounded-concurrency runner for the Turn_Step (turn-budget plan
 * "DESIGN (Part B)" D3).
 *
 * `runWithConcurrency` runs `worker` over `items` with at most `concurrency`
 * in flight. Each lane takes the next index when it is free, so items START
 * in index order (the Turn_Step's ascending `User.id` order, R7.9). After the
 * first rejection no new item starts; in-flight items settle and the first
 * error is rethrown.
 */
export async function runWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  const lanes = Math.min(Math.max(1, Math.floor(concurrency) || 1), items.length);
  const state: { nextIndex: number; failed: boolean; error: unknown } = { nextIndex: 0, failed: false, error: undefined };

  const lane = async (): Promise<void> => {
    while (!state.failed && state.nextIndex < items.length) {
      const index = state.nextIndex++;
      try {
        await worker(items[index], index);
      } catch (error) {
        if (!state.failed) {
          state.failed = true;
          state.error = error;
        }
      }
    }
  };

  await Promise.all(Array.from({ length: lanes }, lane));
  if (state.failed) throw state.error;
}
