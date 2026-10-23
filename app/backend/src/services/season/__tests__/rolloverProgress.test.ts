import { PROGRESS_WRITE_INTERVAL_MS, RolloverTracker } from '../rolloverProgress';
import type { RolloverRunSummary } from '../../../types/schedulerTypes';

describe('RolloverTracker', () => {
  let clock: number;
  let writes: RolloverRunSummary[];
  let tracker: RolloverTracker;

  beforeEach(() => {
    clock = Date.UTC(2026, 9, 22, 0, 0, 0);
    writes = [];
    tracker = new RolloverTracker(1, async (summary) => { writes.push(summary); }, () => new Date(clock));
  });

  it('starts with the five stages pending', () => {
    const snapshot = tracker.snapshot();
    expect(snapshot.seasonNumber).toBe(1);
    expect(snapshot.stages.map((stage) => [stage.stage, stage.status])).toEqual([
      ['archive', 'pending'], ['verify', 'pending'], ['purge', 'pending'], ['post', 'pending'], ['automaton', 'pending'],
    ]);
    expect(snapshot.result).toBeNull();
  });

  it('records start, finish and skip with times and writes each transition', async () => {
    await tracker.start('archive');
    clock += 68;
    await tracker.finish('archive', '81 stables, 809 robots archived');
    await tracker.skip('verify', 'Verified when the archive was written');

    const [archive, verify] = tracker.snapshot().stages;
    expect(archive).toEqual({
      stage: 'archive', status: 'done', detail: '81 stables, 809 robots archived',
      startedAt: new Date(clock - 68).toISOString(), finishedAt: new Date(clock).toISOString(),
    });
    expect(verify).toMatchObject({ status: 'skipped', detail: 'Verified when the archive was written', startedAt: null });
    expect(writes).toHaveLength(3);
  });

  it('throttles generated-stable progress writes but always writes the last batch', async () => {
    await tracker.start('purge');
    writes = [];
    await tracker.generatedProgress(0, 120);
    clock += 1_000;
    await tracker.generatedProgress(50, 120);
    expect(writes).toHaveLength(1);
    clock += PROGRESS_WRITE_INTERVAL_MS;
    await tracker.generatedProgress(100, 120);
    clock += 10;
    await tracker.generatedProgress(120, 120);
    expect(writes).toHaveLength(3);
    expect(tracker.snapshot().generatedStables).toEqual({ deleted: 120, total: 120 });
    expect(tracker.snapshot().stages[2].detail).toBe('Generated stables 120 of 120');
  });

  it('marks the running stage failed, or the first pending one before any stage started', async () => {
    await tracker.start('archive');
    await tracker.finish('archive');
    await tracker.start('verify');
    tracker.fail('Archive verification failed: expected 81 stables');
    expect(tracker.snapshot().stages[1]).toMatchObject({ status: 'failed', detail: 'Archive verification failed: expected 81 stables' });

    const fresh = new RolloverTracker(2, async () => undefined);
    fresh.fail('x'.repeat(400));
    expect(fresh.snapshot().stages[0]).toMatchObject({ stage: 'archive', status: 'failed' });
    expect(fresh.snapshot().stages[0].detail).toHaveLength(200);
  });

  it('hands out copies, so callers cannot change its state', () => {
    const snapshot = tracker.snapshot();
    snapshot.stages[0].status = 'done';
    expect(tracker.snapshot().stages[0].status).toBe('pending');
  });
});
