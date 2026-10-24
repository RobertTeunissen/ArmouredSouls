/**
 * Stage progress of one Season_Rollover (Season Control).
 *
 * Kept in memory for `GET /api/admin/seasons/state` and persisted, best-effort,
 * to the run's `scheduler_job_runs.summary` so the outcome (and the stage a
 * failure stopped at) survives in the rollover history. Writing progress can
 * never fail a rollover: `persist` swallows its own errors.
 *
 * @module services/season/rolloverProgress
 */

import {
  ROLLOVER_STAGES,
  type RolloverRunSummary,
  type RolloverStageName,
  type RolloverStageProgress,
} from '../../types/schedulerTypes';

/** Generated-stable progress is written at most this often (the last batch is always written). */
export const PROGRESS_WRITE_INTERVAL_MS = 3_000;

export type PersistSummary = (summary: RolloverRunSummary) => Promise<void>;

/**
 * The summary of a rollover of `seasonNumber` that has not started a stage:
 * stored on a queued run, and on a run refused before its first stage, so the
 * history attributes it to the season it targeted.
 */
export function pendingRolloverSummary(seasonNumber: number): RolloverRunSummary {
  return {
    seasonNumber,
    newSeasonNumber: null,
    stages: ROLLOVER_STAGES.map((stage): RolloverStageProgress => ({ stage, status: 'pending', startedAt: null, finishedAt: null, detail: null })),
    generatedStables: null,
    result: null,
  };
}

export class RolloverTracker {
  private readonly state: RolloverRunSummary;
  private lastGeneratedWrite = 0;

  constructor(
    seasonNumber: number,
    private readonly persist: PersistSummary,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.state = pendingRolloverSummary(seasonNumber);
  }

  /** A deep copy, safe to hand out or serialise. */
  snapshot(): RolloverRunSummary {
    return structuredClone(this.state);
  }

  private stage(name: RolloverStageName): RolloverStageProgress {
    // Every name in ROLLOVER_STAGES has a row, created in the constructor.
    return this.state.stages.find((row) => row.stage === name) as RolloverStageProgress;
  }

  private write(): Promise<void> {
    return this.persist(this.snapshot());
  }

  async start(name: RolloverStageName, detail: string | null = null): Promise<void> {
    const row = this.stage(name);
    row.status = 'running';
    row.startedAt = this.now().toISOString();
    row.detail = detail;
    await this.write();
  }

  async finish(name: RolloverStageName, detail: string | null = null): Promise<void> {
    const row = this.stage(name);
    row.status = 'done';
    row.startedAt ??= this.now().toISOString();
    row.finishedAt = this.now().toISOString();
    row.detail = detail;
    await this.write();
  }

  async skip(name: RolloverStageName, detail: string): Promise<void> {
    const row = this.stage(name);
    row.status = 'skipped';
    row.finishedAt = this.now().toISOString();
    row.detail = detail;
    await this.write();
  }

  /** Update the running stage's line without a write (the next write carries it). */
  setDetail(name: RolloverStageName, detail: string): void {
    this.stage(name).detail = detail;
  }

  /** Generated stables deleted so far; written at most every few seconds. */
  async generatedProgress(deleted: number, total: number): Promise<void> {
    this.state.generatedStables = { deleted, total };
    this.stage('purge').detail = `Generated stables ${deleted.toLocaleString('en-US')} of ${total.toLocaleString('en-US')}`;
    const at = this.now().getTime();
    if (deleted === total || at - this.lastGeneratedWrite >= PROGRESS_WRITE_INTERVAL_MS) {
      this.lastGeneratedWrite = at;
      await this.write();
    }
  }

  setNewSeason(seasonNumber: number): void {
    this.state.newSeasonNumber = seasonNumber;
  }

  setResult(result: NonNullable<RolloverRunSummary['result']>): void {
    this.state.result = result;
  }

  /** Mark the running stage (or the first pending one) failed. No write: the caller records the end of the run. */
  fail(message: string): void {
    const row = this.state.stages.find((stage) => stage.status === 'running')
      ?? this.state.stages.find((stage) => stage.status === 'pending');
    if (!row) return;
    row.status = 'failed';
    row.startedAt ??= this.now().toISOString();
    row.finishedAt = this.now().toISOString();
    row.detail = message.slice(0, 200);
  }
}
