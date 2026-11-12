/**
 * The names of every scheduler job.
 *
 * Deliberately in its own module rather than in `cycleScheduler.ts`. Two things
 * need this tuple and they have very different weights: the scheduler itself,
 * which imports the whole orchestrator graph, and the admin manual-run endpoint
 * (`POST /api/admin/scheduler/runs`), which only wants to validate a job name
 * with `z.enum`.
 *
 * Because it lived in `cycleScheduler.ts`, any test that mocked the scheduler to
 * avoid loading that graph also erased the tuple — and `z.enum(undefined)` throws
 * at module load, so `adminMaintenance.ts` failed to import and three admin route
 * suites reported "Test suite failed to run" with a Zod stack trace that named
 * neither the mock nor the scheduler. Splitting the constant out means a mock of
 * the scheduler can no longer break route validation.
 *
 * A tuple rather than a bare union so `z.enum` can consume it.
 */
import type { SchedulerJobName } from '../../shared/types';
export const SCHEDULER_JOB_NAMES = [
  'league',
  'tournament',
  'tagTeam',
  'settlement',
  'koth',
  'team2v2League',
  'team3v3League',
  'team2v2Tournament',
  'team3v3Tournament',
  'grandMelee',
] as const satisfies readonly SchedulerJobName[];

