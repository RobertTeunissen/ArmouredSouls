# Requirements Document

Spec 51 — Test Tier Restoration

## Glossary

| Term | Definition |
|---|---|
| Test_Tier | One of the four backend test groupings, each defined by a Jest configuration: Unit_Tier (`jest.config.unit.js`), Integration_Tier (`jest.config.integration.js`), Heavy_Tier (`jest.config.heavy.js`), and the frontend/E2E tiers which are out of scope except where noted. |
| Tier_Partition | The invariant that every backend test file is collected by exactly one Test_Tier — no Orphaned_Test and no Duplicated_Test. |
| Orphaned_Test | A `*.test.ts` file under `app/backend/tests/` or `app/backend/src/` that no Test_Tier collects, and which therefore never runs anywhere. |
| Duplicated_Test | A test file that more than one Test_Tier collects, and which therefore runs more than once per pipeline. |
| Blocking_Gate | A CI step or job whose failure fails the workflow and prevents a deploy. A step carrying `continue-on-error: true`, a bare pipe under GitHub's default shell, or `\|\| true` is not a Blocking_Gate. |
| Advisory_Step | A CI step that reports a result but cannot fail the workflow. Permitted only with a recorded reason and an Exclusion_Expiry. |
| Gate_Manifest | The single documented list of which commands are Blocking_Gates, held in `.kiro/steering/coding-standards.md`, which must agree with the workflow files. |
| Sequence_Allocation | The act of choosing the next `sequenceNumber` for an `audit_logs` row within a given cycle. |
| Sequence_Allocator | The single shared function that performs Sequence_Allocation under a lock, replacing the three independent check-then-act implementations. |
| Gapless_Invariant | The property that `audit_logs` sequence numbers within one cycle form a contiguous run starting at 1, with no gaps. Asserted by `checkSequenceNumbers` in `dataIntegrityService.ts`. |
| Failure_Category | One of the symptom groups (A through G) used to triage Integration_Tier failures, as measured in `analysis.md`. |
| Exclusion_Register | The set of test exclusions that remain after this spec, each carrying a written reason and an Exclusion_Expiry. |
| Exclusion_Expiry | The stated condition or date at which an exclusion must be removed or re-justified. |
| Tier_Baseline | The recorded suite and test counts per Test_Tier, used to distinguish restoration from regression. |
| Ordering_Coupled_Test | A test file that passes in isolation but fails when run in tier order, indicating shared-state or contention dependence. |

## Introduction

The backend Integration_Tier has been substantially red on `main` for months without anyone
noticing, because it does not gate anything. Spec #49 surfaced this while verifying its own tests;
`analysis.md` measured 67 of 143 suites and 272 of 1,791 tests failing at pristine HEAD `e4da0182`,
confirming the failures predate that spec.

`analysis.md` deliberately stopped short of requirements because its central question — is
`test:integration` actually gating? — was unanswered, and the size of this spec depended on the
answer. **That question is now answered, and this document records the answer as a stated fact.**

### Ground truth, measured 28 August 2026

The Integration_Tier does not gate. `continue-on-error: true` sits on the "Run integration tests"
step in both `.github/workflows/ci.yml` and `.github/workflows/deploy.yml`. In `ci.yml` it carries a
comment naming the exact failures and deferring them to "Backlog #64 second wave"; in `deploy.yml`
it carries no comment at all.

Of the three possibilities `analysis.md` set out, this is the second: the gate is still being
swallowed. Not by a pipe and not by `|| true`, which is why the July 2026 cleanup — which searched
for those two patterns — walked past it.

The consequence is the exact anti-pattern `.kiro/steering/coding-standards.md` records as already
removed. Both `deploy-acc` and `deploy-prd` list `backend-integration-tests` in `needs:`, and
because `continue-on-error` keeps the *job* green, both gates are satisfied by a job that ran 272
failing tests. Verbatim from the steering file: "`deploy-acc` listed the job in `needs:` so the gate
looked real."

Three further gaps were measured that `analysis.md` does not record:

1. **`test:heavy` is wired into no workflow.** It exists in `package.json` and
   `jest.config.heavy.js` and appears in neither `ci.yml` nor `deploy.yml`. Gap 1 in `analysis.md`
   asked whether the July 2026 removal regressed or was never completed; it was never completed.
2. **E2E does not gate deploys.** `deploy-acc` and `deploy-prd` need
   `backend-unit-tests, backend-integration-tests, frontend-build`. The `e2e-tests` job is absent
   from both `needs:` lists, so it runs but nothing waits for it. `analysis.md` scoped Playwright
   out as "not measured"; this finding brings it in.
3. **Four test files are Orphaned_Tests and run in no tier at all.** Measured with
   `jest --listTests` across all three configs:
   - `tests/middleware/errorHandler.test.ts`
   - `tests/routes/admin.test.ts`
   - `tests/unit/practiceArena.property.test.ts`
   - `tests/unit/practiceArenaService.test.ts`

   The first of these is the lead `analysis.md` flagged as "not a coincidence worth dismissing" —
   and it is worse than that file assumed. It is not merely excluded from the Unit_Tier; it runs
   nowhere. The error handler is the middleware that shapes `{ error, code, details }`, which is
   precisely what the 18 Failure_Category A suites assert on.

So `main` currently deploys to acceptance behind exactly two real Blocking_Gates: backend unit and
frontend build+lint.

### Root cause of the tier-assignment defects

`jest.config.integration.js` derives its exclusions from the Unit_Tier's `testRegex` by string
filtering, plus two hand-maintained lists. Both drift, in opposite directions:

- `unitPatternsWithoutSrc` keeps the whole
  `tests/(unit|arena|config|errors|middleware|routes|utils|factories|guide|services)/` directory
  pattern as an Integration_Tier exclusion. So any file in those directories that the Unit_Tier
  deliberately drops — because it needs a database — is dropped by the Integration_Tier too, and
  becomes an Orphaned_Test. All four Orphaned_Tests arise this way.

  The config's own comment shows the author knew about this class of problem and solved it for the
  other half only: "The unit config excludes certain `src/__tests__/` files via
  `testPathIgnorePatterns`. Those files match the broad `src/__tests__` regex but are NOT run by the
  unit runner — they belong here in integration." That reasoning is implemented as
  `pureSrcTestPatterns` for `src/__tests__/`, and was never applied to `tests/*/`.

- `pureSrcTestPatterns` is a hand-maintained list of 50-odd literal paths that has fallen behind the
  codebase. Ten newer `src/**/__tests__/` files are absent from it and are therefore Duplicated_Tests,
  collected by both the Unit_Tier and the Integration_Tier:

  ```
  src/services/achievement/__tests__/teamModeWins.test.ts
  src/services/cycle/__tests__/seasonPhaseGate.test.ts
  src/services/moderation/__tests__/imageLibraryOwnership.property.test.ts
  src/services/moderation/__tests__/imageRetention.test.ts
  src/services/retention/__tests__/auditLogRetentionService.test.ts
  src/services/robot/__tests__/robotSchedulingEligibilityService.pbt.test.ts
  src/services/robot/__tests__/robotSchedulingEligibilityService.test.ts
  src/services/season/__tests__/instanceRank.property.test.ts
  src/services/season/__tests__/seasonService.property.test.ts
  src/services/season/__tests__/snapshotBoundedness.property.test.ts
  ```

Both failure modes are silent. Nothing checks the Tier_Partition, so adding a new test to
`src/**/__tests__/` runs it twice, and moving a database-dependent test into `tests/middleware/`
stops running it altogether — with no signal either way.

### The Sequence_Allocation race is wider than measured

`analysis.md` identifies the check-then-act race in `getNextSequenceNumber`
(`eventLogger.ts:114-133`) and appears 635 times in one integration run. Two additional call sites
carry the same defect independently and are not mentioned there:

- `subscriptionService.ts:283-299` — `findFirst` on `sequenceNumber: 'desc'`, then `sequenceNumber++`
- `passwordResetService.ts:115-119` — `findFirst` on `sequenceNumber: 'desc'`, then `+ 1`

All three race with each other as well as with themselves, so fixing only `eventLogger` leaves the
collision reachable.

A second measured fact constrains the fix. `checkSequenceNumbers` in
`src/services/common/dataIntegrityService.ts:129-164` walks a cycle's sequence numbers and reports
every gap as an integrity issue under the check name `sequence_number_continuity`. The
Gapless_Invariant is therefore load-bearing, which **eliminates the Postgres-sequence option**
`analysis.md` listed first: a sequence allocates on request and does not roll back, so it produces
gaps by design and would make that integrity check report issues permanently.

## Expected Contribution

1. **Blocking_Gates go from 2 to 5 of the backend/frontend set.** Before: only backend unit and
   frontend build+lint can fail a deploy; integration is `continue-on-error`, E2E is not in any
   `needs:`, heavy is in no workflow. After: integration, E2E, and heavy all gate, and the
   Gate_Manifest in steering matches the workflow files rather than contradicting them.

2. **Tier_Partition is restored and enforced.** Before: 4 Orphaned_Tests running nowhere and 10
   Duplicated_Tests running twice, detectable only by hand-diffing `--listTests` output. After: 0
   and 0, with an automated check that fails CI when either reappears — so the drift that produced
   both cannot silently recur.

3. **`sequence_number_continuity` integrity issues and dropped audit rows go to zero.** Before: 635
   unique-constraint collisions in a single integration run, each silently dropping an `audit_logs`
   row because `logEvent` catches its own failures; three independent check-then-act call sites.
   After: one Sequence_Allocator under a lock, 0 collisions, and the Gapless_Invariant preserved so
   `dataIntegrityService` stays meaningful.

4. **Integration_Tier failures go from 67 suites / 272 tests to 0, or to a documented
   Exclusion_Register.** Before: 47% of suites red, with no record of why. After: green, and every
   remaining exclusion carries a written reason and an Exclusion_Expiry as
   `.kiro/steering/coding-standards.md` requires.

5. **The tier becomes repeatable, not merely green.** Before: two consecutive runs are not
   comparable — one exited 1, a re-run exited 139 (SIGSEGV) — and two Ordering_Coupled_Tests pass in
   isolation but fail in tier order. After: three consecutive full runs produce identical results
   and a stable exit code.

6. **Two rotting facts in steering are corrected.** Before: `coding-standards.md` asserts all nine
   gates "run on every push and pull request, in both `ci.yml` and `deploy.yml`, and every one of
   them gates a deploy" while three of the nine do not; and `eventLogger.ts` blames its collisions on
   "parallel test runners or multi-process deployments" when `maxWorkers: 1` and `instances: 1` rule
   both out. After: both corrected, with the misdiagnosis explicitly called out so it does not
   misdirect a future investigator.

### Verification Criteria

Each is runnable after the final task and verifies the aggregate outcome.

1. **No swallowed gates in either workflow.**
   ```bash
   grep -nE 'continue-on-error|\|\| true' .github/workflows/ci.yml .github/workflows/deploy.yml
   ```
   Every hit must be on a non-test step (deploy tagging, Caddy reload, Discord notify) — no hit on
   any step whose `run:` invokes `pnpm run test:*`, `pnpm run lint`, `pnpm run build`, or
   `playwright test`.

2. **All test jobs are in every deploy job's `needs:`.** `deploy-acc` and `deploy-prd` must each
   list `backend-unit-tests`, `backend-integration-tests`, `backend-heavy-tests`, `frontend-build`,
   and `e2e-tests`.

3. **`test:heavy` is wired.**
   ```bash
   grep -c 'test:heavy' .github/workflows/ci.yml .github/workflows/deploy.yml
   ```
   must report a non-zero count for both files.

4. **Tier_Partition holds — 0 Orphaned_Tests and 0 Duplicated_Tests.** The check added by this spec
   must exit 0:
   ```bash
   cd app/backend && pnpm run test:tiers:verify
   ```
   Its failure output must name the offending files.

5. **Every tier is green and repeatable.** Three consecutive runs of
   `pnpm run test:unit && pnpm run test:integration && pnpm run test:heavy` must each exit 0 and
   report identical suite and test counts.

6. **No Sequence_Allocation collision under concurrency.** A new test must drive concurrent
   `logEvent` calls for one cycle and assert zero unique-constraint errors and a contiguous
   sequence run. Additionally, across a full integration run:
   ```bash
   grep -c 'Unique constraint failed' /tmp/as_integration.log
   ```
   must report 0, down from 635.

7. **One Sequence_Allocation implementation.** No `findFirst` ordered by `sequenceNumber: 'desc'`
   followed by an increment outside the Sequence_Allocator:
   ```bash
   grep -rn "sequenceNumber: 'desc'" app/backend/src --exclude-dir=shared
   ```
   must return hits only in the Sequence_Allocator module and in read-only query/report paths
   (`queryService.ts`, `adminSystemStatsService.ts`), never in a write path.

8. **The Gate_Manifest agrees with reality.** The gate table in
   `.kiro/steering/coding-standards.md` must list exactly the commands that appear as
   non-`continue-on-error` steps in both workflows. Verified by reading both files side by side; a
   mismatch is a failure.

## Requirements

### Requirement 1: Establish and record CI ground truth

**User Story:** As a maintainer, I want the true gating state of every test tier written down, so
that no future investigation has to rediscover it by hand.

#### Acceptance Criteria

1. THE Gate_Manifest SHALL state, for each of the nine gates, whether it is currently a
   Blocking_Gate in `ci.yml` and in `deploy.yml`, as measured rather than as intended.
2. THE Gate_Manifest SHALL record that `continue-on-error: true` on the integration step, not a pipe
   and not `|| true`, was the mechanism that swallowed the Integration_Tier gate, so that a future
   audit greps for all three patterns.
3. THE Gate_Manifest SHALL record that a job carrying a `continue-on-error` step still reports
   success to `needs:`, and that this makes a `needs:` entry an unreliable indicator of a real gate.
4. THE Gate_Manifest SHALL NOT contain a pass/fail or count snapshot of any tier, per the existing
   prohibition on recording rotting facts.

### Requirement 2: Restore every test tier to a Blocking_Gate

**User Story:** As a maintainer, I want every test tier to be able to fail the build, so that a red
suite blocks a deploy instead of being invisible.

#### Acceptance Criteria

1. THE `backend-integration-tests` job in `ci.yml` SHALL NOT carry `continue-on-error` on its test
   step.
2. THE `backend-integration-tests` job in `deploy.yml` SHALL NOT carry `continue-on-error` on its
   test step.
3. THE workflows SHALL each define a `backend-heavy-tests` job that runs `pnpm run test:heavy`
   against a migrated PostgreSQL 17 service as a Blocking_Gate.
4. THE `deploy-acc` and `deploy-prd` jobs SHALL each list `e2e-tests` and `backend-heavy-tests` in
   `needs:` in addition to their existing entries.
5. WHERE a step pipes command output, THE step SHALL declare `shell: bash` so that `pipefail`
   applies, per the existing shell rule.
6. THE workflows SHALL NOT reintroduce `continue-on-error`, `|| true`, or an unguarded pipe on any
   lint, build, typecheck, or test step.
7. IF a tier genuinely cannot be made green within this spec, THEN it SHALL be represented as an
   Advisory_Step carrying both a written reason and an Exclusion_Expiry, and never as a silent
   `continue-on-error`.

### Requirement 3: Restore and enforce the Tier_Partition

**User Story:** As a maintainer, I want every test file to run in exactly one tier, enforced
automatically, so that tests cannot silently stop running or start running twice.

#### Acceptance Criteria

1. THE Test_Tier configurations SHALL collectively collect every `*.test.ts` file under
   `app/backend/tests/` and `app/backend/src/` exactly once.
2. THE four Orphaned_Tests SHALL each be assigned to the tier appropriate to their dependencies:
   `tests/middleware/errorHandler.test.ts`, `tests/routes/admin.test.ts`,
   `tests/unit/practiceArena.property.test.ts`, and `tests/unit/practiceArenaService.test.ts`.
3. THE ten Duplicated_Tests SHALL each be collected by exactly one tier.
4. THE repository SHALL provide a `test:tiers:verify` script that computes the Tier_Partition from
   `jest --listTests` across all three configs and exits non-zero if any Orphaned_Test or
   Duplicated_Test exists.
5. WHEN `test:tiers:verify` fails, THEN it SHALL name every offending file and state whether it is
   orphaned or duplicated.
6. THE `test:tiers:verify` script SHALL run as a Blocking_Gate in both workflows.
7. THE Integration_Tier configuration SHALL derive its exclusions such that a file the Unit_Tier
   excludes from a `tests/*/` directory is collected by the Integration_Tier, closing the mechanism
   that produced all four Orphaned_Tests.
8. THE Integration_Tier configuration SHALL NOT depend on a hand-maintained literal path list that
   must be edited whenever a test is added, since that is the mechanism that produced all ten
   Duplicated_Tests.

### Requirement 4: Eliminate the Sequence_Allocation race

**User Story:** As an operator reading repair and income analytics, I want every audit event to be
persisted, so that the series I read has no silent holes.

#### Acceptance Criteria

1. THE codebase SHALL contain exactly one Sequence_Allocator, and all three current call sites
   (`eventLogger.ts`, `subscriptionService.ts`, `passwordResetService.ts`) SHALL use it.
2. THE Sequence_Allocator SHALL serialise allocation per cycle such that two concurrent callers
   cannot receive the same `sequenceNumber`.
3. THE Sequence_Allocator SHALL preserve the Gapless_Invariant, so that `checkSequenceNumbers` in
   `dataIntegrityService.ts` continues to report no `sequence_number_continuity` issues.
4. THE Sequence_Allocator SHALL NOT be implemented as a PostgreSQL sequence or as an
   `ON CONFLICT`-with-gaps scheme, because both violate criterion 3.
5. THE Sequence_Allocator SHALL be correct across processes, not only within one, so that the fix
   does not become a latent defect if PM2 `instances` is raised above 1.
6. WHEN concurrent `logEvent` calls target the same cycle, THEN no `audit_logs` row SHALL be
   dropped, and no unique-constraint violation on `(cycle_number, sequence_number)` SHALL occur.
7. THE docstring on the Sequence_Allocator SHALL state that the collision is intra-process on the
   async gap, and SHALL explicitly correct the previous "parallel test runners or multi-process
   deployments" claim, naming `maxWorkers: 1` and `instances: 1` as the evidence that ruled both out.
8. THE retry-on-unique-violation loops in `logEvent` and `logEventBatch` SHALL be removed or reduced
   to a genuine last-resort path, since they exist to paper over the race being fixed.
9. THE spec SHALL add a regression test that drives concurrent allocation for one cycle and asserts
   both no collision and a contiguous sequence run.

### Requirement 5: Triage and clear the Integration_Tier failures

**User Story:** As a maintainer, I want each of the 67 failing suites resolved on its merits, so
that the tier can gate without hiding either a real regression or a stale assertion.

#### Acceptance Criteria

1. THE spec SHALL re-measure the Integration_Tier at its own HEAD before triage, and SHALL record
   the measured counts as the working Tier_Baseline.
2. THE triage SHALL proceed by Failure_Category, beginning with Failure_Category A (18 suites, auth
   and response shape), on the measured hypothesis that a single cause underlies most of them.
3. THE triage SHALL test the Failure_Category A hypothesis that the shape asserted by those suites
   is produced by the error handler whose only test is an Orphaned_Test, by first restoring
   `tests/middleware/errorHandler.test.ts` to a tier and observing what it reports.
4. FOR EACH failing suite, THE resolution SHALL be recorded as either a code fix or a test fix, and
   never as making the check advisory.
5. WHERE a test is deleted rather than fixed, THE spec SHALL state explicitly that the behaviour it
   covered is genuinely gone, per the existing prohibition.
6. WHERE a suite cannot be resolved within this spec, THE suite SHALL be entered in the
   Exclusion_Register with a written reason and an Exclusion_Expiry, and the count of such entries
   SHALL be reported in the final verification.
7. THE Integration_Tier SHALL exit 0 on completion.

### Requirement 6: Make the tiers repeatable

**User Story:** As a maintainer, I want two consecutive runs of a tier to produce the same result,
so that a red run is information rather than noise.

#### Acceptance Criteria

1. THE Integration_Tier SHALL complete without a SIGSEGV, and SHALL produce the same exit code on
   three consecutive runs.
2. THE two known Ordering_Coupled_Tests, `tests/facilityRecommendationService.test.ts` and
   `tests/leagueRebalancingService.test.ts`, SHALL pass both in isolation and in tier order.
3. THE resolution for each Ordering_Coupled_Test SHALL address the shared state or contention that
   couples it, and SHALL NOT consist only of reordering or of a retry.
4. WHERE the segfault is traced to a resource leak (unclosed Prisma clients, undisposed
   TensorFlow tensors, open handles), THE leak SHALL be fixed rather than suppressed with
   `--forceExit`.
5. THE spec SHALL report whether `--forceExit`, currently set on all three tier scripts, is still
   required, and SHALL remove it where it is not.

### Requirement 7: Measure and wire the Heavy_Tier

**User Story:** As a maintainer, I want to know what the Heavy_Tier reports before it gates, so that
wiring it does not block every deploy on unknown failures.

#### Acceptance Criteria

1. THE Heavy_Tier SHALL be measured in full before it is wired, and its measured counts recorded as
   part of the Tier_Baseline.
2. THE Heavy_Tier failures SHALL be resolved on the same code-wrong-or-test-wrong basis as
   Requirement 5.
3. THE Heavy_Tier SHALL be wired as a Blocking_Gate in both workflows once green.
4. IF the Heavy_Tier cannot be made green within this spec, THEN it SHALL be wired as an
   Advisory_Step with a written reason and an Exclusion_Expiry, and SHALL NOT be left unwired.
5. THE spec SHALL confirm that `tests/integration/tagTeamByeHandling.test.ts` — the suite
   `analysis.md` identifies as having been dead for as long as the Heavy_Tier gap existed — now runs
   and passes.
6. THE Heavy_Tier job SHALL declare a timeout appropriate to full-cycle execution, so that a hang
   fails rather than consuming the runner budget.

### Requirement 8: Correct the documentation the gaps invalidated

**User Story:** As a developer reading steering, I want its claims about CI to be true, so that I do
not trust a rotting fact over a test run.

#### Acceptance Criteria

1. THE gate table in `.kiro/steering/coding-standards.md` SHALL be corrected so that it no longer
   asserts that all nine gates gate a deploy.
2. THE list of removed bypasses in `.kiro/steering/coding-standards.md` SHALL be extended with the
   three found by this spec: `continue-on-error` on the integration step in both workflows,
   `test:heavy` never having been wired, and `e2e-tests` being absent from both deploy jobs'
   `needs:`.
3. THE steering entry recording "`test:heavy` running in no pipeline at all" as removed in July 2026
   SHALL be corrected to state that the removal was never completed, since the claim as written is
   false.
4. THE Tier_Partition rule SHALL be documented in `.kiro/steering/testing-strategy.md`, including
   how to choose a tier for a new test and the fact that `test:tiers:verify` enforces the choice.
5. THE Sequence_Allocation rule SHALL be documented in `.kiro/steering/coding-standards.md` under
   the existing database section, stating that audit sequence numbers are allocated only through the
   Sequence_Allocator and never by reading the maximum and incrementing.
6. THE docstring misdiagnosis in `eventLogger.ts` SHALL be corrected per Requirement 4 criterion 7.
7. THE `.kiro/specs/to-do/51-test-tier-restoration/analysis.md` file SHALL be updated to record that
   Decision 1 is answered, so that the next reader does not repeat the investigation.
8. THE documentation changes SHALL NOT record tier pass/fail counts, per the existing prohibition on
   snapshots.

### Requirement 9: Verify the aggregate outcome

**User Story:** As a maintainer, I want a single verification pass proving the tiers gate and stay
green, so that this spec's claim is checkable rather than asserted.

#### Acceptance Criteria

1. THE spec SHALL run every check in the Verification Criteria section and record the result of each.
2. THE spec SHALL report the final Tier_Baseline for all tiers.
3. THE spec SHALL report the size of the Exclusion_Register, and SHALL list every entry with its
   reason and Exclusion_Expiry.
4. WHERE any Verification Criterion cannot be satisfied, THE spec SHALL state which, and why, rather
   than reporting overall success.
