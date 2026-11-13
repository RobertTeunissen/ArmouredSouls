/**
 * Stored JSON shape of `scheduler_job_runs.summary` and the run vocabulary.
 *
 * Kept small on purpose: one line of result for the Cycle Controls schedule
 * and history ("669 battles", "Round 3/12 · 512 matches", "Cycle 81 closed").
 */
import type { RolloverStageName } from '../shared/types';

/** Job name of an admin bulk-cycle run in `scheduler_job_runs`. */
export const BULK_CYCLES_JOB_NAME = 'bulkCycles';

/** Job name of a season rollover in `scheduler_job_runs` (admin or settlement-triggered). */
export const SEASON_ROLLOVER_JOB_NAME = 'seasonRollover';

/** The five stages of a rollover, in order (Spec #45). */
export const ROLLOVER_STAGES = ['archive', 'verify', 'purge', 'post', 'automaton'] as const satisfies readonly RolloverStageName[];
