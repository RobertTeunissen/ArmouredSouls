# Implementation Plan: Test Tier Restoration

## Overview

Ten task groups in a deliberate order. Groups 1–3 are structural and independent of the failure
triage; groups 4–8 are the triage itself; groups 9–10 are documentation and verification.

The ordering is not cosmetic. Group 2 changes which tests each tier collects and group 3 removes
3,142 collision errors per run, so both must precede the triage in groups 4–6 or the target moves
underneath it and the logs stay unreadable.

> Mobile responsiveness requirement does not apply — this spec introduces and modifies no UI
> components.

## Task Dependency Graph

```
1 (gate wiring) ─────────────┐
                             ├──> 10 (verification)
2 (tier partition) ──┐       │
                     ├──> 4 ──> 5 ──> 6 ──> 7 ──┐
3 (sequence alloc) ──┘                          ├──> 9 (docs) ──> 10
                                    8 (heavy) ──┘
```

- **1** is independent of everything and lands first so later red is attributable.
- **2** and **3** are independent of each other; both must precede **4**.
- **4** → **5** → **6** is the triage sequence, ordered largest-category-first.
- **7** (repeatability) follows **6**, because a segfault mid-tier makes earlier measurements
  unreliable.
- **8** (Heavy_Tier) depends on **1** for its job definition but its triage is independent of **4–6**.
- **9** depends on the outcomes of **1–8** so it can record what was actually found.
- **10** verifies everything and must run last.

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": ["1", "2", "3"],
      "rationale": "Structural and mutually independent. Gate wiring, Tier_Partition restructure and the Sequence_Allocator can proceed in parallel; all three must land before any triage so the triage target is stable and the logs are readable."
    },
    {
      "wave": 2,
      "tasks": ["4", "8"],
      "rationale": "Re-measure the Integration_Tier and triage Failure_Category A, the largest group with a partly shared cause. Heavy_Tier measurement runs in parallel since its failures are independent of the integration triage."
    },
    {
      "wave": 3,
      "tasks": ["5", "6"],
      "rationale": "Fixture and seed drift, then the per-suite tail. Sequential because category E/F fixes are mechanical and often clear category G suites as a side effect."
    },
    {
      "wave": 4,
      "tasks": ["7"],
      "rationale": "Repeatability last among the test work: a segfault mid-tier makes any earlier measurement unreliable, so the tier must otherwise be green before ordering coupling can be isolated."
    },
    {
      "wave": 5,
      "tasks": ["9", "10"],
      "rationale": "Documentation records what was actually found across waves 1-4, then final verification runs every Verification Criterion."
    }
  ]
}
```

## Tasks

## 1. Restore every test tier to a Blocking_Gate

- [x] 1.1 Remove `continue-on-error: true` and its stale "Backlog #64 second wave" comment from the
      "Run integration tests" step in `.github/workflows/ci.yml`.
- [x] 1.2 Remove `continue-on-error: true` from the "Run integration tests" step in
      `.github/workflows/deploy.yml`.
- [x] 1.3 Add a `backend-heavy-tests` job to `ci.yml`: PostgreSQL 17 service, `prisma migrate deploy`,
      `pnpm run test:heavy`, `timeout-minutes: 30`, `shell: bash` on any piping step.
- [x] 1.4 Add the same `backend-heavy-tests` job to `deploy.yml`.
- [x] 1.5 Add a frontend unit test step (`pnpm run test:ci`) to the `frontend-build` job in
      `deploy.yml`, which currently runs only lint and build.
- [x] 1.6 Extend `deploy-acc.needs` and `deploy-prd.needs` in `deploy.yml` to
      `[backend-unit-tests, backend-integration-tests, backend-heavy-tests, frontend-build, e2e-tests]`.
- [x] 1.7 Add `backend-heavy-tests` to the `notify-failure.needs` list in `ci.yml`.
- [x] 1.8 Grep both workflows for `continue-on-error`, `|| true`, and unguarded pipes on any lint,
      build, typecheck, or test step; confirm none remain.

_Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 7.3, 7.6_

## 2. Restructure the Test_Tier configuration into a Tier_Partition

- [x] 2.1 Create `app/backend/jest.tiers.js` that enumerates every `*.test.ts` under `tests/` and
      `src/` and classifies each into exactly one tier by ordered rules: `HEAVY_TESTS` list, then
      `DB_DEPENDENT` list, then Unit_Tier as the default.
- [x] 2.2 Seed `HEAVY_TESTS` from the current `jest.config.heavy.js` `testRegex` so the Heavy_Tier
      collects the same 23 suites it does today.
- [x] 2.3 Seed `DB_DEPENDENT` from the current Integration_Tier membership, then add the four
      Orphaned_Tests: `tests/middleware/errorHandler.test.ts`, `tests/routes/admin.test.ts`,
      `tests/unit/practiceArena.property.test.ts`, `tests/unit/practiceArenaService.test.ts`.
- [x] 2.4 Confirm the ten Duplicated_Tests are absent from `DB_DEPENDENT` so they land in the
      Unit_Tier only: the `teamModeWins`, `seasonPhaseGate`, `imageLibraryOwnership`,
      `imageRetention`, `auditLogRetentionService`, two `robotSchedulingEligibilityService`,
      `instanceRank`, `seasonService`, and `snapshotBoundedness` suites.
- [x] 2.5 Rewrite `jest.config.unit.js`, `jest.config.integration.js`, and `jest.config.heavy.js` to
      take their test selection from `jest.tiers.js`, deleting `unitPatternsWithoutSrc`,
      `pureSrcTestPatterns`, and `heavyTestPatterns`. Preserve the Unit_Tier's
      `setupFilesAfterEnv`, `maxWorkers`, and `coverageThreshold` settings.
- [x] 2.6 Write `app/backend/scripts/verifyTiers.ts` that compares `jest --listTests` output across
      the three configs against a filesystem glob and exits non-zero on any Orphaned_Test or
      Duplicated_Test, naming each offending file and its classification.
- [x] 2.7 Add `"test:tiers:verify": "tsx scripts/verifyTiers.ts"` to `app/backend/package.json`.
- [x] 2.8 Add a `test:tiers:verify` step to the `backend-unit-tests` job in both `ci.yml` and
      `deploy.yml`.
- [x] 2.9 Run `pnpm run test:tiers:verify` and confirm 0 orphans and 0 duplicates.

_Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

## 3. Replace the three Sequence_Allocation call sites with one Sequence_Allocator

- [x] 3.1 Create `app/backend/src/services/common/auditSequence.ts` exporting `withAuditSequence`,
      which takes `pg_advisory_xact_lock(3, cycleNumber)`, reads the current maximum
      `sequenceNumber` for the cycle, and hands the caller the first free number. Namespace `3` is
      chosen because `2` is taken by robot locks in `teamBattleService.ts`.
- [x] 3.2 Document in the module docstring that the collision is intra-process on the async gap, and
      explicitly correct the previous "parallel test runners or multi-process deployments" claim,
      naming `maxWorkers: 1` in `jest.config.integration.js` and `instances: 1` in
      `app/ecosystem.config.js` as the evidence that ruled both out.
- [x] 3.3 Document that a PostgreSQL sequence is not an acceptable implementation because
      `checkSequenceNumbers` in `dataIntegrityService.ts` reports every gap as a
      `sequence_number_continuity` integrity issue.
- [x] 3.4 Convert `EventLogger.logEvent` to allocate through `withAuditSequence` inside a
      transaction, and delete its five-attempt unique-violation retry loop.
- [x] 3.5 Convert `EventLogger.logEventBatch` the same way, allocating a contiguous block for the
      whole batch in one call, and delete its retry loop.
- [x] 3.6 Delete the module-level `sequenceNumberCache` and the `clearSequenceCache` export, and
      remove its call from `logCycleComplete`. Update any other caller found.
- [x] 3.7 Convert `subscriptionService.ts:283-299` to allocate through `withAuditSequence`, passing
      its existing `tx`.
- [x] 3.8 Convert `passwordResetService.ts:115-119` to allocate through `withAuditSequence`, passing
      its existing `tx`.
- [x] 3.9 Add a regression test driving concurrent `logEvent` calls for one cycle, asserting zero
      unique-constraint errors and a contiguous sequence run with no gaps.
- [x] 3.10 Confirm `dataIntegrityService.checkSequenceNumbers` reports no
      `sequence_number_continuity` issues after the change.
- [x] 3.11 Grep for any remaining `sequenceNumber: 'desc'` followed by an increment in a write path;
      confirm hits remain only in the allocator and in read-only paths (`queryService.ts`,
      `adminSystemStatsService.ts`).

_Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 8.5, 8.6_

## 4. Re-measure the Integration_Tier and triage Failure_Category A

- [x] 4.1 Re-run the Integration_Tier after tasks 2 and 3 and record the new suite and test counts as
      the working Tier_Baseline. Confirm the collision count has dropped from 3,142 to 0.
- [x] 4.2 Run the newly un-orphaned `tests/middleware/errorHandler.test.ts` and record what it
      reports, testing the `analysis.md` hypothesis that the error handler underlies the
      response-shape failures.
- [x] 4.3 Fix `tests/validRegistration.property.test.ts`: the `.slice(0, 20)` on the constructed
      unique email truncates the domain once the suffix grows, producing an invalid address that
      `registerBodySchema`'s `.email()` check correctly rejects with 400. Recorded as a test fix.
- [x] 4.4 Audit the other registration and login property suites for the same truncation pattern
      (`duplicateEmail`, `duplicateUsername`, `dualLoginSupport`, `invalidLoginCredentials`,
      `loginResponseFormat`, `registrationResponseFormat`, `registrationEndpoint.integration`,
      `enhancedLogin.integration`, `authenticationEquivalence`, `validationErrorSpecificity`) and fix
      each on its own merits.
- [x] 4.5 Triage the remaining response-shape suites (`responseFormatConsistency`,
      `unexpectedErrorHandling`, `databaseErrorHandling`, `registrationErrorHandling`,
      `admin-password-reset`, `auth`, `authOnboarding`), recording each as code fix, test fix,
      delete, or Exclusion_Register entry.

_Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

## 5. Triage Failure_Category E and F — fixture and seed drift

- [x] 5.1 Triage the `PrismaClientValidationError` suites, where a fixture omits a column the schema
      now requires. Fix the fixtures to match the current schema.
- [x] 5.2 Triage the `Received: undefined` / `Cannot read properties of undefined` suites, where
      expected seed data is absent. Establish the data each needs and seed it in the suite rather
      than relying on ambient state.
- [x] 5.3 For every suite in this group, record the resolution as code fix or test fix with a stated
      reason.

_Requirements: 5.2, 5.4, 5.5, 5.6_

## 6. Triage Failure_Category D and G individually

- [x] 6.1 Fix `tests/combatSimulator.spatial.test.ts`, which asserts a `robot1HP` property on a
      combat event whose shape changed.
- [x] 6.2 Fix `tests/cycleSnapshotService.test.ts`, which expects a rejection matching `/incomplete/`
      but receives a Prisma validation error because the service now fails earlier for a different
      reason.
- [x] 6.3 Fix the `TeamBattleError`-not-thrown suite, where a domain error was replaced by a generic
      `Error`.
- [x] 6.4 Work through the remaining uncategorised suites one at a time, recording each resolution.
      Report any that turn out to be genuine regressions that have been invisible, since those are
      the findings that justify this spec.
- [x] 6.5 Confirm the Integration_Tier exits 0.

_Requirements: 5.4, 5.5, 5.6, 5.7_

## 7. Make the tiers repeatable

- [x] 7.1 Run the Integration_Tier with `--detectOpenHandles` and identify leaked resources
      (unclosed Prisma clients, undisposed TensorFlow tensors, open timers).
- [x] 7.2 Fix each leak at its source rather than suppressing it.
- [x] 7.3 Diagnose and fix the SIGSEGV so the tier completes with a stable exit code.
- [x] 7.4 Fix `tests/facilityRecommendationService.test.ts` and
      `tests/leagueRebalancingService.test.ts` by addressing the shared state or contention that
      couples them to tier order. Reordering or retrying is not an acceptable resolution.
- [x] 7.5 Assess whether `--forceExit` is still required on the three tier scripts in
      `package.json`; remove it where it is not.
- [x] 7.6 Run all three tiers three consecutive times and confirm identical counts and exit codes.
      All three tiers are green and repeatable. The Heavy_Tier was the last to get there; its
      Exclusion_Register entry is closed and it is now a Blocking_Gate.

_Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

## 8. Measure and clear the Heavy_Tier

- [x] 8.1 Run `pnpm run test:heavy` in full and record its suite and test counts.
- [x] 8.2 Triage every Heavy_Tier failure on the same code-wrong-or-test-wrong protocol. All cleared.
- [x] 8.3 Confirm `tests/integration/tagTeamByeHandling.test.ts` now runs and passes — the suite that
      has been dead for as long as the Heavy_Tier CI gap existed.
- [x] 8.4 If the Heavy_Tier cannot be made green within this spec, convert its job to an
      Advisory_Step carrying a written reason and an Exclusion_Expiry. It must not be left unwired.
      **Not needed in the end.** It was wired advisory while red, and the expiry has since been
      discharged: the tier is green, `continue-on-error` is removed, and it is listed in both
      deploy jobs' `needs:`.

_Requirements: 7.1, 7.2, 7.4, 7.5_

## 9. Correct the documentation the gaps invalidated

- [x] 9.1 Correct the gate table in `.kiro/steering/coding-standards.md` so it states measured rather
      than intended gating, and record that a job containing a `continue-on-error` step still reports
      success to `needs:`.
- [x] 9.2 Add the three bypasses found by this spec to the removed-bypasses list in
      `.kiro/steering/coding-standards.md`: `continue-on-error` on the integration step in both
      workflows, `test:heavy` never wired, and `e2e-tests` absent from both deploy jobs' `needs:`.
- [x] 9.3 Correct the false claim in `.kiro/steering/coding-standards.md` that "`test:heavy` running
      in no pipeline at all" was removed in July 2026 — the removal was never completed.
- [x] 9.4 Document the Tier_Partition in `.kiro/steering/testing-strategy.md`: how to choose a tier
      for a new test, the `DB_DEPENDENT` list in `jest.tiers.js`, that a new test defaults to the
      Unit_Tier, and that `test:tiers:verify` enforces the partition.
- [x] 9.5 Add the Sequence_Allocation rule to the database section of
      `.kiro/steering/coding-standards.md`: audit sequence numbers are allocated only through
      `withAuditSequence`, never by reading the maximum and incrementing.
- [x] 9.6 Update `analysis.md` to record that Decision 1 is answered, that the Integration_Tier gate
      was swallowed by `continue-on-error`, and that the spec landed on the large-and-urgent branch.
- [x] 9.7 Confirm no pass/fail or count snapshot was added to any steering file.

_Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.7, 8.8_

## 10. Verify the aggregate outcome

- [x] 10.1 Run Verification Criterion 1 — no `continue-on-error` or `|| true` on any lint, build,
      typecheck, or test step in either workflow.
- [x] 10.2 Run Verification Criterion 2 — all five test jobs present in both deploy jobs' `needs:`.
- [x] 10.3 Run Verification Criterion 3 — `test:heavy` present in both workflows.
- [x] 10.4 Run Verification Criterion 4 — `pnpm run test:tiers:verify` exits 0.
- [x] 10.5 Run Verification Criterion 5 — three consecutive full runs of all three tiers, identical
      counts, exit 0.
- [x] 10.6 Run Verification Criterion 6 — concurrency regression test passes and the collision count
      in a full integration run is 0.
- [x] 10.7 Run Verification Criterion 7 — no `sequenceNumber: 'desc'` plus increment in any write
      path.
- [x] 10.8 Run Verification Criterion 8 — the Gate_Manifest table matches the non-`continue-on-error`
      steps in both workflows.
- [x] 10.9 Report the final Tier_Baseline for all tiers, the size of the Exclusion_Register, and every
      entry with its reason and Exclusion_Expiry. Where a criterion could not be satisfied, state
      which and why rather than reporting overall success.

_Requirements: 9.1, 9.2, 9.3, 9.4, 2.7, 5.6, 5.7, 6.1, 7.4_

## Progress Log

Measured 29 August 2026. Dated snapshot for this spec only — never for steering.

| Metric | Baseline (28 Aug) | Now |
|---|---|---|
| Integration suites failing | 69 of 143 | **0 of 113** |
| Integration tests failing | 274 | **0 of 1,507** |
| Unit suites failing | 0 of 231 | **0 of 255** |
| Unit tests | 3,429 | **3,801** |
| Heavy suites failing | never measured, unwired | **0 of 23** |
| Heavy tests failing | never measured | **0 of 244** |
| Sequence_Allocation collisions per run | 3,142 | **0** |
| Orphaned_Tests | 4 | **0** |
| Duplicated_Tests | 10 | **0** |
| Blocking_Gates on a deploy | 2 | **5** |
| `--forceExit` on tier scripts | 3 of 3 | **1 of 4** (`test:heavy` only) |

Suite counts moved because the Tier_Partition reassigned files, not because tests were
deleted: 143 → 113 integration reflects 24 mocked-Prisma suites moving to the Unit_Tier
(231 → 255) plus the four Orphaned_Tests being placed. Total collected went 391 → 391.

All ten task groups complete. Group 10 verification is reported below: all eight Verification
Criteria pass, and the Exclusion_Register is empty.

### Live defects found, each invisible until its tier could fail

Eight, in the order they were found. Every one was shipped behaviour that no gate could
report, which is the argument for this spec.

1. **`DUPLICATE_*` registration codes never matched the client.** The route threw
   `USER_ALREADY_EXISTS` / `EMAIL_ALREADY_EXISTS`; `RegistrationForm.tsx` switches on
   `DUPLICATE_USERNAME` / `DUPLICATE_EMAIL` / `DUPLICATE_STABLE_NAME` to place the message
   under the offending field. Duplicate username and duplicate email therefore never
   produced an inline field error. The OpenAPI spec, the error reference, the feature doc
   and the route's own docblock all said `DUPLICATE_*` — only the throw disagreed.
2. **Server-side validation errors never reached their field.** `validateRequest` threw a
   fixed `'Invalid request body'`, and the form maps a `VALIDATION_ERROR` to an input by
   keyword-matching the message. Every server-side validation failure fell through to the
   generic banner. Fixed by `describeIssues`; the convention is now recorded in steering —
   a Zod message is user-facing and must name its own field.
3. **Achievement C18 "Autobots, Roll Out!" was unreachable for every player.**
   `checkAllModesWin` read tag team / 2v2 / 3v3 wins from robot-scoped standings, where
   they are never written. Same defect class as Spec #46 R8 Cause A. Now uses
   `resolveTeamModeWins`.
4. **Account reset failed for any player who had ever joined a team.**
   `TeamBattleMember.robot` was `onDelete: RESTRICT`, so `resetService` threw a foreign key
   violation mid-reset. Surfaced as 27 failing Heavy_Tier tests; the constraint was the
   bug. Fixed with a migration to `Cascade` plus corrected deletion ordering.
5. **A fourth inline copy of the Repair_Bay_Discount formula** in
   `unifiedFacilityROIService.ts`, three months after Spec #48 collapsed the other three.
   Now imports `calculateRepairBayDiscountPercent` from the shared module.
6. **`runJob`'s Spec #45 preparation gate sat outside the lock**, so the skip path wrote
   `jobStates` unlocked and the queue could lose FIFO order. Gate moved inside
   `acquireLock`.
7. **Three racy Sequence_Allocation sites, not one.** `analysis.md` found `eventLogger`;
   `subscriptionService` and `passwordResetService` carried the same check-then-act
   independently, so fixing only `eventLogger` would have left the collision reachable.
8. **`getRobotsInInstance` had silently dropped LP from its ranking.** Spec #43 computed an
   LP-sorted id list and then threw the order away by re-querying with `orderBy: elo desc`.
   The function is documented, and was previously implemented, as LP-first then ELO. A
   sort key that survives a query but not the *next* query is the shape to watch for.

### Root causes behind the bulk of the failures

1. **No `errorHandler` in inline test apps** (28 suites). A thrown `AppError` fell through
   to Express's default handler, which sends the right status with an **empty body** —
   the "returns `{}`" symptom across Failure_Category A. Test-side fix.
2. **Mocked-Prisma suites classified as DB_DEPENDENT** (24 suites). `tests/setup.ts` calls
   `prisma.weapon.count()` in a global `beforeAll`; under `jest.mock('../src/lib/prisma')`
   the singleton has no `.weapon`. The classification was the defect, not the setup file.
   `scripts/verifyTiers.ts` now fails on an integration-tier suite that mocks the Prisma
   singleton, so this cannot silently recur.
3. **`z.enum(SCHEDULER_JOB_NAMES)` evaluated at module load** (3 suites failed to load).
   Suites mocking `cycleScheduler` without that export gave `z.enum(undefined)`. Extracted
   to `src/services/cycle/schedulerJobNames.ts`.
4. **Removed Battle columns in fixtures** (`robot1Id`, `robot2Id`, `robot1ELOBefore`,
   `eloChange`) at nine inline `battle.create` sites across eight suites. The "new test
   code" example in `testing-strategy.md` had carried `robot1Id` for as long as the column
   had been gone; both the suites and the example are fixed.
5. **Fixtures that write no `standings` row** — the dominant Heavy_Tier cause. See below.
6. **Truncated email construction in 10 auth property suites.** `.slice(0, 20)` cut into
   `@t.co` as the fast-check suffix grew, so registration correctly returned 400. Replaced
   by `tests/helpers/uniqueRegistration.ts`.

### Repeatability: the hardest part of this spec

Requirement 6 asked for repeatability, and "green once" turned out not to be it. Seven
separate intermittent failures were found, every one of them only after the tier had already
gone green — which is the argument for running a tier repeatedly rather than once. Six were
fixed at the cause; the seventh was hardened for diagnosis without its cause being found,
and is stated as such:

- **`fc.float` generates `NaN`** from a bounded range unless `noNaN: true` is passed.
  `performanceDegradation.property` failed roughly one run in three on seed 1966233560
  with the counterexample `[100, NaN, "step_a"]`. Its sibling property — which asserts the
  detector returns `null` — **passed on the same input for the wrong reason**, which is how
  the generator survived. Fixed in three files; the rule is now in steering.
- **An under-powered statistical assertion.** `combatSimulator.refinement` ran 30 trials
  against a `>= 0.6` bound with a true win rate near 0.70 — about 1.2 standard errors of
  headroom, so roughly a one-in-nine failure. Observed 17/30. Fixed by raising the sample
  to 400, which leaves the bound over 4 standard errors out. **The threshold was not
  lowered**; the evidence behind it was increased.
- **A wall-clock window in a fixture.** `rateLimiter.property` built its limiter with
  `windowMs: 60 * 1000`, so `MemoryStore` rolled its counters mid-test if a run was slow
  enough to straddle the boundary — the over-limit request then correctly returned 200. It
  failed once in a ~300s full-tier run (seed -1377824546, limit 15) and never in isolation.
  The window length is fixture detail, not part of the property, so it is now 10 minutes:
  the identical assertion with the timing variable removed.
- **A generator that produced input the endpoint correctly rejects.**
  `profileUpdate.property` composed `${base}_${Date.now()}_${random}` for a unique stable
  name and never checked the composed result against the rules the endpoint enforces.
  `Math.random().toString(36)` yields arbitrary letters, so the suffix occasionally spells a
  banned substring — the counterexample was `wKR11LYI_1788014097350_zassa`, where "zassa"
  contains "ass". The 400 was correct and the property, which is about *successful* updates,
  reported it as a failure. Now filtered through `validateStableName` itself rather than a
  re-implementation of its rules, so the generator tracks the validator.
- **A setup whose result was never asserted.** `streamingStudioPrestigeRequirements`
  reached the level under test by driving `targetLevel - 1` upgrades over HTTP, and three of
  its four setup loops ignored every response. 10,000,000 credits does not buy six streaming
  studio levels, so the facility silently stopped short and the property read the prestige
  requirement of the **wrong level** — reporting "Expected 10000, Received 5000", which
  reads as a requirements-table defect. It looked intermittent only because
  `fc.constantFrom(4..10)` draws a different target level each run; it is deterministic for
  the higher levels. Fixed by funding the setup properly and asserting all four loops, so a
  failed setup can never again be reported as a failed property.
- **A second unasserted setup loop, cause not positively identified.**
  `onboardingApi`'s "resume after logout" test advanced steps 2→5 over HTTP and ignored every
  response, then asserted `currentStep` was 5 and read 4 — pointing at the resume behaviour
  rather than at the step that actually failed. It passes repeatedly in isolation and failed
  once in a full tier run, so the trigger is cross-suite. The setup now asserts each
  transition, so the next occurrence will name the failing step and its status instead of
  misattributing it. **It did not recur in six subsequent full runs, and I did not find the
  root cause** — recorded rather than claimed fixed.
- **Machine load, not code.** One `databaseErrorHandling.property` test hit the 60s timeout
  during a run executed alongside another jest process (263s wall clock versus 160s clean).
  It passes in 10ms in isolation, with its neighbours, and in every clean run.
  `performanceDegradation.property` was genuinely close to the ceiling at ~38s — it writes
  ~13,000 `audit_logs` rows, each now taking the Spec #51 advisory lock — so that file got
  an explicit 180s timeout. A timeout is not an assertion; `numRuns` was not reduced.

- **`request(app)` opens a server per call.** The dominant remaining mechanism. Supertest
  stands up and tears down an ephemeral server for every request, and in a suite that issues
  many — a property test multiplies its call sites by `numRuns` —
  `streamingStudioPrestigeRequirements` reaches ~800 per run. That churn returned **HTTP 426**,
  a status nothing in this codebase sends, and `socket hang up`, and once an indefinite hang in
  `changelog.property` that left a worker to be killed by hand. Five suites converted to one
  `app.listen(0)` each.

  **The obvious fix is the wrong one, and I made it before I measured it.** Node 19+ defaults
  `http.globalAgent.keepAlive` to `true`, so a pooled socket can outlive the server it was
  opened against — a tidy explanation for the 426. I turned pooling off globally in both setup
  files. With every request opening and closing its own connection the machine reached **1,536
  sockets in TIME_WAIT**, the intermittent 426 became ephemeral port exhaustion, and a tier run
  stalled at 91 of 113 suites. Reverted. The problem is the number of servers, not the pooling
  of sockets, and the steering file now says so.
- **My own measurement, twice.** A stretch of alarming results — 46 `robots_user_id_fkey`
  violations, 29 "No record was found for a delete", 21 `(cycle_number, sequence_number)`
  collisions, once all 113 suites failing at the same time — had nothing to do with the code. In
  the first case seven background chains were live and several overlapped on one database; in the
  second Docker Desktop had stopped. The tell for concurrency is breadth: a real flake hits one
  suite, an overlapping run hits a dozen unrelated ones with foreign-key and missing-row errors.
  Both are now written into `.kiro/steering/testing-strategy.md`, because I lost more time to
  them than to any genuine defect.

**`--forceExit` removed from `test`, `test:unit`, `test:unit:coverage` and
`test:integration`** (R6.5). It is kept only on `test:heavy`. Both blocking tiers exit 0 on
their own.

**The SIGSEGV did not reproduce and needed no workaround.** It was previously seen after
~120 of 138 suites in a single-worker run. Unsharded runs now complete cleanly and
repeatedly. The most likely explanation is that it was a symptom of the collision storm —
3,142 failed inserts with rejected promises per run — rather than an independent leak.
Sharding was not needed. `--detectOpenHandles` across all 113 suites reports **no open
handles** and exits 0.

One residual, benign: the integration tier prints "Jest did not exit one second after the
test run has completed" when it uses the worker pool, but not under `--detectOpenHandles`
(which implies `--runInBand`), and it exits 0 either way. That places the lingering handle
in jest's worker teardown, not in test code. Recorded rather than suppressed.

**Both named Ordering_Coupled_Tests now pass in isolation and in tier order** (R6.2):
`facilityRecommendationService` and `leagueRebalancingService`.

### The Heavy_Tier's single dominant cause — since cleared

**All 10 remaining failing suites write zero `standings` rows.** Verified by grep, not
assumed. The fixtures predate Spec #40, which moved tier, league instance, LP and
`cyclesInTier` off `Robot` and `TeamBattle`; Spec #43 then dropped the columns and migrated
the reads. A fixture that creates robots or teams and no standing row creates entities that
are in no competition, so the services scope their work from `standings`, find nothing, and
correctly do nothing. **"Expected 331, Received 0" is a fixture that predates Spec #40, not
a broken service.**

Four shared fixture helpers now hold the shape of a correct competitive fixture, replacing
per-suite copies that were each wrong in the same way:

| Helper | What it encodes |
|---|---|
| `tests/helpers/standings.ts` | Entering an entity into a mode's competition, including `cyclesInTier` and `totalMatches` |
| `tests/helpers/subscriptions.ts` | The Spec #35 Booking Office gate, per robot, all members or the team is ineligible |
| `tests/helpers/tagTeam.ts` | A 2v2 tag team that matchmaking will actually consider — team + standing + subscriptions |
| `tests/helpers/leagueCohort.ts` | A cohort of battle-ready 1v1 robots in distinct stables |

`tests/helpers/tagTeam.ts` alone replaced **four byte-identical private copies** of
`createTagTeamFixture`, all four of which created a `TeamBattle` and stopped there. That is the
duplication the coding standards warn about, reproduced four times in test code.

The tier went from 15 failing suites / 66 failing tests, to 10 / 24, to **0 / 0**.

Two engine rules have to be written into a fixture deliberately, and neither was:

- **`cyclesInTier`** — the engine counts only entities at or above
  `minCyclesForRebalancing` (5 for the LP leagues, 10 for the Placement_Modes) as eligible,
  and promotes 10% of the **eligible** count, not of the tier total.
- **The destination-cohort rule** — promotions are held entirely when the destination tier
  is empty and there are fewer than `minCohortForNewTier` (3) candidates. A 20-team fixture
  yields 2 candidates at 10%, below that floor, so it promotes nobody. The tag team
  promotion test had to grow to 30 teams for the percentage rule to be what it tests.

### Heavy_Tier root causes, beyond the missing fixtures

Six causes, none of which was the one I first guessed.

1. **`adminCycleGeneration` collided with itself.** All 44 `cycle_number` unique violations in a
   run came from this one file. Its `afterEach` reset `cycleMetadata.totalCycles` to 0 so the
   next test replayed cycles 1..N, while the `cycle_snapshots` rows owning those numbers were
   never deleted. `cycleSnapshotService` is right to `create` rather than `upsert` — a duplicate
   means a double settlement — so the test was wrong to replay cycle numbers.
   **My first fix was wrong and was reverted**: I added a tier-wide reset in a new
   `tests/setup.heavy.ts` on the theory that the collisions were cross-suite. They were not; it
   fixed zero collisions and turned two accidentally-passing suites red.
2. **Auto-repair is a cycle step, not part of the orchestrator.** `runTagTeamCycle` calls
   `repairRobotsForEvent('tag_team')` as step 1 and executes battles as step 2 — "always first
   per Requirement 24.24". `tagTeamAutoRepair` called only step 2 and then asserted step 1 had
   happened, so no repair ever ran and there were **zero `robot_repair` audit rows** in the
   whole database.
3. **Repair spend was measured as a currency delta.** The same call pays battle rewards, so the
   delta is `rewards - repairs` and the balance went *up*. Now read from the Repair_Spend_Source
   per the Spec #48 rule, which is what makes the discount assertion meaningful.
4. **A cycle snapshot is an audit-log rollup.** `aggregateRobotMetrics` and
   `aggregateStableMetrics` read `battle_complete` events and never touch `battles` or
   `battle_participants`. Three `cycleSnapshot.property` tests created battle rows and asserted
   the snapshot reflected them. They also mixed accounting bases: per-battle for
   `battlesParticipated`, per-robot for credits, which cannot both hold.
   **A second mistake of mine here**: I added a `damageReceived` pass believing the field was
   never populated, and it double-counted — an existing pass twenty lines further down already
   derived it by grouping on `audit_logs.battleId`. Reverted, with a comment so the next reader
   does not repeat it.
5. **`robots.totalBattles` already includes tag team.** Only KotH lives outside it, in
   `standings.totalMatches`. `streamingRevenueFormula.property` generated a separate tag team
   count and applied it with `prisma.robot.update({ data: {} })` — an **empty** update left
   behind when the column was dropped, so the number was never written while the expectation
   still added it.
6. **Ambient data, in three shapes.** `integration.test.ts` had no fixture at all: it queried
   whatever robots existed and asserted the result was non-empty, so it passed only when its
   neighbours had run first. Two of its checks asserted global invariants over the whole
   database, one of which ("every battle has ≥2 participants") is no longer true since a Spec
   #49 bye records only the real side. And `teamBattleCompleteCycle` hard-coded `bronze_1` while
   `assignLeagueInstance` places a new team in the least-full instance.

### 1,303 orphaned `standings` rows, and why they were not inert

`standings` is polymorphic, so it has no foreign key and is never cascaded. A suite that deletes
its robots and teams but not its standings leaves rows pointing at entities that no longer
exist. Across this spec's runs, **1,303** had accumulated — including 141 `league_2v2` rows
against **0** `team_battles`.

Those rows change behaviour. Matchmaking, `getEligibleTeams` and `assignLeagueInstance` all
scope from `standings`, so phantom entities inflate instance occupancy: `bronze_1` was reported
full and `teamBattleCompleteCycle`'s teams were placed in `bronze_2`, failing with "Expected
bronze_1, Received bronze_2" — a fact about accumulated garbage, not about matchmaking.

`tests/setup.ts` now purges **orphans only** once per test file: rows whose entity is already
gone, which nothing can legitimately read. A suite's own live rows are untouched, so this cannot
mask a teardown bug the way a blanket `deleteMany({})` would.

### Two suites whose assertions had become unfalsifiable

Worth separating from ordinary drift, because these did not fail loudly for a wrong reason
— they had stopped asking a question at all.

- **`tagTeamLeagueRebalancing`** asserted the same unfiltered 20-row query equalled both 2
  and 18 within one test, so it could not pass under any behaviour. When Spec #40 moved
  tier off `TeamBattle`, the verification queries kept their `id: { in: teamIds }` and lost
  only the tier predicate that no longer compiled. It reported "Received: 20", which reads
  like a rebalancing defect. **When a migration drops a column, a query that filtered on it
  becomes a different question, not a broader one.** Its "< 10 teams" test was also named
  for a threshold that does not exist — `MIN_TEAMS_FOR_REBALANCING` is 4 — when what
  actually holds the teams is `Math.floor(5 * 0.10) === 0`.
- **`leagueInstanceService`** computed an `instanceNum` in every fixture and then never used
  it, because the column it used to write was gone. Two of its assertions also encoded
  behaviour that had been deliberately changed and never re-tested: `assignLeagueInstance`
  expecting `gold_3` when commit 178f8fd2 is titled "assignLeagueInstance should never
  create new instances, only rebalancing does", and a "no rebalance when balanced" test
  left behind by commit bfdc627a, which updated its sibling in the same describe block and
  missed it.

### Deletions and retargets, with the behaviour stated

Per R5.5, every deletion names the behaviour that is genuinely gone.

- **`tests/robotStatsView.test.ts` deleted, with its service and routes.** The
  `robot_current_stats` materialized view is created by nothing — no migration, no SQL
  file, no seed — while `robotStatsViewService`, `leaderboardAnalyticsService` and three
  `/api/analytics/*` endpoints all queried it. Those three endpoints returned 500 on every
  call. `standings` is now the ranking source of truth and `/api/leaderboards/*` already
  serves the frontend, so the view should not exist. Removed:
  `GET /api/analytics/leaderboard`, `GET /api/analytics/robot/:robotId/stats`,
  `POST /api/analytics/stats/refresh`, `leaderboardQuerySchema`, and
  `RobotErrorCode.ROBOT_STATS_REFRESH_FAILED`. **This closes the register entry rather than
  carrying it forward.**
- **`POST /api/admin/grand-melee/trigger`** — a deprecated placeholder removed by Spec #44.
  Its test was retargeted onto the live `POST /api/admin/scheduler/trigger/:jobName`.
- **`getInstancesForTier` bye-robot exclusion** — Spec #41 made the bye robot an in-memory
  sentinel with a negative id, never persisted, so there is no row to exclude. The test was
  retargeted to the invariant that made the exclusion unnecessary: an instance counts
  entities that hold a standing, and a Bye_Placeholder holds none.
- **`teamBattle.property` Properties 7 and 8** — retargeted. `registerTeam` does not gate on
  subscription; per Spec #35 subscribing and unsubscribing are free and the gate is at
  matchmaking.

### Decisions taken

1. **Robot names are global.** This was listed as needing a decision; it did not need one.
   Migration `20260402101920_global_unique_robot_names` and `name String @unique` settle it,
   so `robotNameUniqueness` was asserting behaviour that a migration had already changed.
2. **Zod messages are authored per route where a suite asserts documented text.** Mechanical
   and it improves real user-facing strings, so it was done rather than deferred.
3. **`contentModerationService` now fails closed unconditionally.** The
   `CONTENT_MODERATION_STRICT` gate was set nowhere in the repository, so the fail-closed
   path was unreachable in every environment — uploads were unmoderated whenever the model
   failed to load.
4. **Heavy_Tier stays an Advisory_Step** per R7.4, with a register entry naming the cause.

### Regressions I introduced and fixed

Adding `pg_advisory_xact_lock` to the allocator broke four suites whose mocked transaction
clients had no `$executeRaw`: `tests/passwordResetService.test.ts`,
`tests/services/subscription/subscriptionService.test.ts`,
`tests/services/subscription/subscriptionProperties.test.ts`,
`tests/services/auth/authServices.test.ts`. All four mocks updated.

A sequencing mistake also belongs here: `design.md` said wiring the Heavy_Tier before
measuring it was "almost certainly the wrong thing to do first", and group 1 wired it as a
Blocking_Gate anyway, before task 8.1 measured it. Had that been pushed, every deploy would
have been blocked on 15 untriaged suites. The task ordering was right; the execution ignored
it.

### Known duplication, deliberately not collapsed here

`registerBodySchema` and `validateRegistrationRequest` declare the same bounds and the same
message strings, and the route runs both. That is the duplicate-declaration pattern
`coding-standards.md` warns about, and agreeing today is no guarantee of agreeing tomorrow.
Left alone to keep this spec's scope to restoration; worth its own spec.

### Documentation corrected

- **Steering.** The gate table now states intent rather than fact and carries the two-part
  "what makes a gate real" test; the never-completed July removals are recorded; and the
  Sequence_Allocation, validation-message, Tier_Partition, deletion-order/`onDelete`,
  `standings`-fixture and `noNaN` rules are all written down. A stale "~82% pass rate, Feb
  2026" snapshot was removed from `testing-strategy.md`, and two rotting code examples in
  it were fixed — a teardown using `robot1Id` and a "new test code" battle fixture still
  passing `robot1Id` / `robot2Id`.
- **Product docs.** Duplicate registration is a 409, not a 400. Corrected in
  `docs/api/authentication.yaml` (the `400` response block split into `400` and `409`),
  `docs/features/user-registration-error-reference.md` and
  `docs/features/user-registration.md`.
- **Workflows.** Two comments were themselves rotting facts and were corrected: the
  `deploy-acc` / `deploy-prd` `needs:` comment claimed `backend-heavy-tests` "now blocks"
  when it is advisory, and `notify-failure.needs` now records why an advisory job is
  deliberately absent — a `continue-on-error` job always reports success and so could never
  satisfy `failure()`.
- No pass/fail or count snapshot was added to any steering file (R8.8, task 9.7).

### Exclusion_Register

**Empty. Both entries are closed.**

| Suite / tier | How it was closed |
|---|---|
| `tests/robotStatsView.test.ts` | Resolved by deletion, not carried forward. The `robot_current_stats` materialized view is created by nothing — no migration, no SQL file, no seed — while `robotStatsViewService`, `leaderboardAnalyticsService` and three `/api/analytics/*` endpoints all queried it, so those endpoints returned 500 on every call. `standings` is the ranking source of truth and `/api/leaderboards/*` already serves the frontend, so the view should not exist. Removed: `GET /api/analytics/leaderboard`, `GET /api/analytics/robot/:robotId/stats`, `POST /api/analytics/stats/refresh`, `leaderboardQuerySchema`, `RobotErrorCode.ROBOT_STATS_REFRESH_FAILED`. |
| Heavy_Tier (whole tier, advisory) | Triaged to green. 10 suites and 24 tests were failing when the entry was written; all pass now. `continue-on-error` is removed from `backend-heavy-tests` in both workflows and the job is listed in `deploy-acc.needs`, `deploy-prd.needs` and `notify-failure.needs`. |

**The Heavy_Tier failures were fixture drift, not product defects.** The dominant cause was
fixtures written before Spec #40 that create robots and teams but no `standings` row, so every
service scoped its work from an empty competition and correctly did nothing. Two engine rules
had to be written into fixtures deliberately (`cyclesInTier`, and the destination-cohort rule
that holds promotions when the target tier is empty and there are fewer than 3 candidates), and
Spec #35's Booking Office subscription gate had to be satisfied for team modes.

**R7.5 answered.** `tests/integration/tagTeamByeHandling.test.ts` now runs — it never had
before — and it passes. Getting there needed more than a fixture: its header promised "Full
rewards awarded for bye-team wins" and "Normal penalties applied for bye-team losses", both of
which Spec #49 removed, and its bye query looked for a scheduled-match participant with id
`-1`, which is never written. A bye persists only slot 1 and is flagged by
`ScheduledMatch.isByeMatch`. The tests now assert the Spec #49 contract: credits only, zero
prestige, zero fame, zero streaming revenue, ELO moves but HP does not, and a bye cannot draw.

## Verification Report (task 10, Requirement 9)

Re-run 30 August 2026, after the Heavy_Tier was cleared. **All eight Verification Criteria
pass.**

| # | Criterion | Result |
|---|---|---|
| 1 | No swallowed gates in either workflow | Pass |
| 2 | All test jobs in every deploy job's `needs:` | Pass — all 5 |
| 3 | `test:heavy` wired in both workflows | Pass |
| 4 | Tier_Partition holds | Pass |
| 5 | Every tier green and repeatable | Pass |
| 6 | No Sequence_Allocation collision under concurrency | Pass |
| 7 | One Sequence_Allocation implementation | Pass |
| 8 | Gate_Manifest agrees with reality | Pass |

### 1. No swallowed gates — pass

Every `continue-on-error:` key that remains is on a non-test step in `deploy.yml`: Caddy
reload, logrotate, backup cron, deploy tag, Discord notify. **No lint, build, typecheck or test
step carries one**, and neither does any job. `backend-heavy-tests` lost its job-level flag
when its Exclusion_Register entry was closed.

### 2. All test jobs in every deploy job's `needs:` — pass

`deploy-acc.needs` and `deploy-prd.needs` are each
`[backend-unit-tests, backend-integration-tests, backend-heavy-tests, frontend-build, e2e-tests]`.
`notify-failure.needs` in `ci.yml` lists all five too — which is only meaningful now that no
job carries `continue-on-error`, since such a job always reports success and could never
satisfy `failure()`.

### 3. `test:heavy` wired — pass

Present in both workflows. Before this spec it was in neither: the tier ran in no pipeline at
all, and the steering file's claim that this had been fixed in July 2026 was false.

### 4. Tier_Partition holds — pass

`pnpm run test:tiers:verify` exits 0: 255 unit, 113 integration, 23 heavy, 391 discovered, 391
collected, 0 orphaned, 0 duplicated. The check also rejects an integration-tier suite that
mocks the Prisma singleton, which was the misclassification behind 24 of the original failures.

### 5. Every tier green and repeatable — pass

| Tier | Suites | Tests | Exit |
|---|---|---|---|
| Unit | 255 passed / 255 | 3,801 passed / 3,801 | 0 |
| Integration | 113 passed / 113 | 1,507 passed / 1,507 | 0 |
| Heavy | 23 passed / 23 | 244 passed / 244 | 0 |

The four static gates also exit 0: `build`, `lint`, `typecheck:tests`, `test:tiers:verify`.
`lint` reports two pre-existing warnings unrelated to this spec
(`BYE_BATTLE_DURATION_SECONDS`, `TeamBattleParticipantResult`) and zero errors.

**Measure this criterion with one runner at a time.** The single biggest waste of effort in
this spec was diagnosing "flakes" that were an artefact of overlapping background runs sharing
one database — see the repeatability section above. Run the tiers in the foreground,
sequentially, and check `pgrep -f jest` first.

### 6. No Sequence_Allocation collision — pass

`tests/auditSequenceConcurrency.test.ts` passes all 9 tests: distinct numbers under
concurrency, the Gapless_Invariant, no dropped rows, no `sequence_number_continuity` issue
after a burst, contiguous batch blocks, interleaved batches and singles, no cross-cycle
serialisation, resumption from existing rows, rejection of a non-positive count.

Sequence collisions in a full integration run: **0**, down from 3,142.

The criterion's literal command, `grep -c 'Unique constraint failed'`, reports 2 rather than 0.
Both are `users.username` and `users.email` from tests that deliberately register a duplicate
to assert the 409. The command is broader than its subject; scoped to sequence collisions it is
0. Recorded rather than quietly reinterpreted.

### 7. One Sequence_Allocation implementation — pass

`grep -rn "sequenceNumber: 'desc'" app/backend/src --exclude-dir=shared` returns four hits: two
in `auditSequence.ts` (the allocator itself, under `pg_advisory_xact_lock`, and a docstring
showing the anti-pattern it replaced) and two in the read-only report paths the criterion
permits, `adminSystemStatsService.ts` and `queryService.ts`. No write path outside the
allocator reads the maximum and increments it.

### 8. Gate_Manifest agrees with reality — pass

The gate table in `.kiro/steering/coding-standards.md` states intent explicitly rather than
asserting measured fact, tells the reader to check the workflows before relying on it, and
documents the two-part test for a real gate — the step must be able to fail *and* every deploy
job must list its job in `needs:` — together with the trap that a `continue-on-error` step
still reports job success. It records no pass/fail or count snapshot (R8.8).

### Final Tier_Baseline

| Tier | Suites | Tests | Exit |
|---|---|---|---|
| Unit | 255 | 3,801 | 0 |
| Integration | 113 | 1,507 | 0 |
| Heavy | 23 | 244 | 0 |
| Total collected | 391 files | — | — |

### Exclusion_Register size: 0

Down from two. Blocking_Gates on a deploy: **2 before this spec, 5 after** — backend unit,
backend integration, backend heavy, frontend build+lint+unit, and E2E.

### What is not done

- **`registerBodySchema` / `validateRegistrationRequest` duplication** is left standing and is
  flagged above as deserving its own spec.
- **`app/frontend/src/pages/admin/CycleControlsPage.tsx`** declares a stale top-level
  `userGeneration` on its `CycleResult` interface. It is declared but never read, so it is dead
  type rot rather than a live defect; the real payload is `settlement.userGeneration`.
- **`RobotMetric.damageReceived` and `kills` are not populated for 3v3 or the Placement_Modes.**
  The pairing pass in `aggregateRobotMetrics` guards on `events.length !== 2 && events.length !== 4`,
  so a 6-event 3v3 battle and a 20-event Grand Melee contribute nothing. Found while fixing
  `cycleSnapshot.property` and left alone as out of scope — it is a genuine gap, not drift.

## Notes

- **The Exclusion_Register is the escape hatch, and it has a price.** Any suite that cannot be
  resolved must carry a written reason and an Exclusion_Expiry. An exclusion with neither is the
  condition that created this spec.
- **Do not loosen an assertion to make a suite pass.** Per Requirement 5.4 every resolution is a code
  fix, a test fix, an explicit deletion with justification, or an Exclusion_Register entry.
- **Group 3 is a production fix, not test maintenance.** The dropped `audit_logs` rows are holes in
  the Repair_Spend_Source that Spec #48 established as authoritative. It is worth landing on its own
  even if the triage runs long.
- **Counts in this spec are dated measurements, not rules.** The 69 suites, 274 tests and 3,142
  collisions were measured on 28 August 2026 and will drift. They belong in the spec, never in a
  steering file.
- **Group 1 will turn `main` red.** That is the intended outcome: the tier is already failing, and
  removing `continue-on-error` makes it visible. Expect the first push after group 1 to fail CI until
  groups 4–6 complete, and do not resolve that by restoring the flag.
