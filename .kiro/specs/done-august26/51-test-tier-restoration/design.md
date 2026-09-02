# Spec 51 — Test Tier Restoration: Design

## Overview

Four independent problems, deliberately sequenced so that each one makes the next measurable:

1. **Gate restoration** (R1, R2) — pure workflow edits. Cheap, and until it lands, nothing new that
   goes red is attributable.
2. **Tier_Partition restructure** (R3) — changes which tests each tier collects, so it must precede
   triage or the triage target moves underneath us.
3. **Sequence_Allocator** (R4) — a production defect, independent of the test work, and the cause of
   3,142 collisions per integration run that pollute every other suite's output.
4. **Failure triage** (R5, R6, R7) — the long tail, once the target is stable.

Doing 4 before 2 and 3 would mean triaging suites whose tier membership is about to change against
log output buried under thousands of collision errors.

## Architecture

### Measured baseline

Recorded at spec start, 28 August 2026, working tree at Spec #49 HEAD. This is the working
Tier_Baseline for R5.1 — not a durable fact, and deliberately not copied into any steering file.

| Tier | Suites collected | Result |
|---|---|---|
| Unit_Tier | 231 | green |
| Integration_Tier | 143 | **69 failed / 74 passed suites; 274 failed / 1,517 passed tests; exit 1** |
| Heavy_Tier | 23 | not yet measured in full |
| Orphaned_Tests | 4 | run nowhere |
| Duplicated_Tests | 10 | run in Unit_Tier and Integration_Tier both |

Total distinct `*.test.ts` files: 391. Tier sum: 231 + 143 + 23 = 397 = 391 − 4 orphans + 10
duplicates + 4 (the duplicates counted twice net of orphans), which is the arithmetic signature of a
broken Tier_Partition.

Collision volume in one Integration_Tier run: 3,202 `Unique constraint failed` occurrences, of which
3,142 are on `(cycle_number, sequence_number)`. `analysis.md` measured 635; the figure is
run-dependent because it scales with how many suites reach the racy path before failing, so treat
3,142 as the current order of magnitude rather than a fixed number.

## Components and Interfaces

### Component 1 — Gate restoration

_Requirements: 1.1–1.4, 2.1–2.7, 8.1–8.3_

#### Changes to `.github/workflows/ci.yml`

- Remove `continue-on-error: true` and its stale comment from the "Run integration tests" step of
  `backend-integration-tests`.
- Add a `backend-heavy-tests` job: PostgreSQL 17 service, migrate, `pnpm run test:heavy`,
  `timeout-minutes: 30` (R7.6).
- Add a `test:tiers:verify` step to `backend-unit-tests` (no database needed — it only reads Jest
  config output), so the Tier_Partition gate runs in the cheapest job.
- Add `backend-heavy-tests` to `notify-failure`'s `needs:`.

#### Changes to `.github/workflows/deploy.yml`

- Remove `continue-on-error: true` from the integration step.
- Add the same `backend-heavy-tests` job.
- Add a `frontend-unit-tests` step to `frontend-build` — `analysis.md` does not flag this, but the
  steering file records "Frontend unit tests missing from `deploy.yml` entirely" as removed in July
  2026, and the job as it stands runs only lint and build. Verified during this design pass.
- Extend `deploy-acc.needs` and `deploy-prd.needs` to
  `[backend-unit-tests, backend-integration-tests, backend-heavy-tests, frontend-build, e2e-tests]`.

#### Why `needs:` alone was not enough before

`continue-on-error: true` on a *step* lets the *job* conclude successfully, so `needs:` was satisfied
by a job that ran 274 failing tests. Removing the flag is what makes the existing `needs:` entries
meaningful; adding `e2e-tests` and `backend-heavy-tests` to `needs:` is what makes the two unwired
tiers count. Both halves are required — either alone leaves a hole. This is recorded in the
Gate_Manifest per R1.3 because it is the non-obvious part.

### Component 2 — Tier_Partition restructure

_Requirements: 3.1–3.8, 8.4_

#### The defect being removed

`jest.config.integration.js` computes its exclusions three ways, two of which drift:

```js
const unitPatternsWithoutSrc = unitRegex.filter((r) => !r.includes('__tests__') || r.startsWith('tests/'));
```

This keeps `tests/(unit|arena|config|errors|middleware|routes|utils|factories|guide|services)/.+\.test\.ts$`
as an Integration_Tier exclusion. Any file in those directories that the Unit_Tier drops for needing
a database is therefore dropped by both tiers. That is the mechanism behind all four
Orphaned_Tests — and the config's comment shows the author solved exactly this problem for
`src/__tests__/` via `pureSrcTestPatterns` and never applied the same reasoning to `tests/*/`.

Meanwhile `pureSrcTestPatterns` is ~50 hand-written literal paths that must be edited whenever a
`src/**/__tests__/` test is added. Ten newer files were never added, so they run twice.

#### The replacement: classification, not exclusion

A new `app/backend/jest.tiers.js` becomes the single source of truth. It enumerates every
`*.test.ts` under `tests/` and `src/`, then classifies each file into exactly one tier by an ordered
rule set:

```js
// Ordered — first match wins, so the tiers are mutually exclusive by construction.
// 1. HEAVY_TESTS   — explicit list: full-cycle and bulk-DB suites
// 2. DB_DEPENDENT  — explicit list: needs a real database or supertest
// 3. otherwise     — Unit_Tier
```

Each config then sets `testMatch` to the explicit file list for its tier. Consequences:

- **Exhaustive and disjoint by construction.** Every file lands in exactly one bucket, so
  Orphaned_Tests and Duplicated_Tests become structurally impossible rather than merely checked
  for. This is what satisfies R3.7 and R3.8 rather than patching the two current lists.
- **A new test defaults to the Unit_Tier.** If it needs a database it fails immediately and loudly,
  prompting the author to add it to `DB_DEPENDENT`. That is the right failure direction: the current
  design's failure modes are silent in both directions.
- **One list to maintain instead of three**, and the list states a property of the test (needs a DB)
  rather than a property of another config file's regex.

`jest.config.unit.js` keeps its `setupFilesAfterEnv`, `maxWorkers: '75%'` and coverage thresholds;
only test selection moves to `jest.tiers.js`.

#### Tier assignment for the four Orphaned_Tests

| File | Tier | Reason |
|---|---|---|
| `tests/middleware/errorHandler.test.ts` | Integration_Tier | imports the app, which opens a DB connection |
| `tests/routes/admin.test.ts` | Integration_Tier | supertest against the full app |
| `tests/unit/practiceArena.property.test.ts` | Integration_Tier | imports `prisma` directly |
| `tests/unit/practiceArenaService.test.ts` | Integration_Tier | imports `prisma` directly |

All ten Duplicated_Tests are `src/**/__tests__/` files that use mocked Prisma; they go to the
Unit_Tier, which is where they already pass.

#### The verification script

`app/backend/scripts/verifyTiers.ts`, exposed as `pnpm run test:tiers:verify`. It shells
`jest --listTests` for each of the three configs, plus globs the filesystem, then asserts:

- no file appears in more than one tier list (Duplicated_Test)
- every discovered file appears in some tier list (Orphaned_Test)

On failure it prints each offending path with its classification and exits 1 (R3.5). Because
`jest.tiers.js` makes violations structurally impossible, this script is a guard against someone
reintroducing bespoke `testPathIgnorePatterns`, not a routine cleanup tool.

### Component 3 — Sequence_Allocator

_Requirements: 4.1–4.9, 8.5, 8.6_

#### Why the obvious fix is wrong

`analysis.md` lists a PostgreSQL sequence or `ON CONFLICT` retry as the cheapest option. Measured
during this design pass: `checkSequenceNumbers` in `src/services/common/dataIntegrityService.ts`
walks each cycle's sequence numbers and reports **every gap** as a
`sequence_number_continuity` integrity issue. A sequence allocates on request and does not return
values on rollback, so it produces gaps by design and would make that check fire permanently. The
Gapless_Invariant is load-bearing. R4.4 records this so the option is not revisited.

#### Three call sites, not one

`analysis.md` identifies `getNextSequenceNumber` in `eventLogger.ts`. Two more carry the same
check-then-act pattern and race both with it and with each other:

| Site | Shape |
|---|---|
| `src/services/common/eventLogger.ts:114-133` | `findFirst` desc → `+1`, cached in a module-level `Map` |
| `src/services/subscription/subscriptionService.ts:283-299` | `findFirst` desc → `sequenceNumber++` in a loop |
| `src/services/auth/passwordResetService.ts:115-119` | `findFirst` desc → `+1` |

Fixing only `eventLogger` leaves the collision reachable, so R4.1 requires all three to move to the
shared allocator.

#### Design

New module `app/backend/src/services/common/auditSequence.ts`:

```ts
const AUDIT_SEQUENCE_LOCK_NAMESPACE = 3;

export async function withAuditSequence<T>(
  cycleNumber: number,
  count: number,
  fn: (startSequence: number) => Promise<T>,
  tx?: Prisma.TransactionClient,
): Promise<T>
```

Behaviour:

1. Acquire `pg_advisory_xact_lock(3, cycleNumber)` on the transaction client.
2. Read the current maximum `sequenceNumber` for the cycle.
3. Hand the caller the first free number; the caller writes `count` rows numbered contiguously.
4. The lock releases at commit, so allocation and insertion are atomic together.

Namespace `3` is chosen because `2` is already taken by robot locks
(`pg_advisory_xact_lock(2, robotId)` in `teamBattleService.ts`) and `leagueInstanceService.ts` uses
the single-argument form with a hashed tier name. Using a distinct namespace keeps audit allocation
from serialising against team operations.

Why `pg_advisory_xact_lock` and not an in-process mutex: the mutex is a smaller diff and adequate
while `instances: 1`, but it silently becomes wrong the moment PM2 scales. R4.5 requires
cross-process correctness, and this is the pattern the codebase already uses for multi-row
serialisation.

#### Call-site consequences

- `logEvent` and `logEventBatch` become transactional. The module-level `sequenceNumberCache` and
  both five-attempt retry loops are deleted (R4.8) — they exist solely to paper over the race.
- `clearSequenceCache` is exported and called by `logCycleComplete`. With the cache gone the function
  has no purpose; it is removed and its call site dropped. Any external caller found during
  implementation is updated in the same change.
- `subscriptionService` and `passwordResetService` already run inside `prisma.$transaction`, so they
  pass their existing `tx` through and need no structural change.

#### Docstring correction

The current comment on `sequenceNumberCache` attributes collisions to "rare race with parallel test
runners or multi-process deployments". Both are ruled out by measurement:
`jest.config.integration.js` sets `maxWorkers: 1` and `app/ecosystem.config.js` sets `instances: 1`.
The replacement docstring states the collision is intra-process on the async gap between the read and
the insert, and names both settings as the evidence (R4.7). This matters because the existing wording
sends an investigator looking for a second process that does not exist.

#### Why this is a production bug, not a test bug

`logEvent` catches and logs its own failures, so a collision drops an `audit_logs` row rather than
failing a request. Under Spec #48, `audit_logs` rows with `eventType: 'robot_repair'` are the sole
Repair_Spend_Source. A racy allocator therefore puts silent holes in the repair-spend and
battle-income series that the Dashboard and several admin analytics surfaces read. Two ordinary
concurrent request handlers logging in the same cycle are enough to trigger it.

### Component 4 — Failure triage

_Requirements: 5.1–5.7, 6.1–6.5, 7.1–7.6_

#### Sequencing

Re-measure after Components 2 and 3 land, because both change the result: Component 2 adds four
previously-unrun suites to the Integration_Tier and removes ten, and Component 3 removes 3,142
collision errors that currently contaminate other suites' failures. The re-measured list, not the
69 above, is the triage target (R5.1).

#### Category A is not a single cause

`analysis.md` hypothesised that 18 suites failing on auth and response shape share one cause, and
flagged the excluded `errorHandler.test.ts` as the lead. Component 2 restores that file to a tier,
which tests the hypothesis directly (R5.3).

But a sample taken during this design pass shows at least some of Category A is test-side and
unrelated to the error handler. `tests/validRegistration.property.test.ts` expects 201 and receives
400. The cause is in the test's own uniquifying logic:

```ts
const uniqueEmail = `${email.split('@')[0]}${suffix}@t.co`.slice(0, 20);
```

`suffix` is `Date.now()` concatenated with a run counter, so it grows as fast-check shrinks. Once
the local part plus suffix plus `@t.co` exceeds 20 characters, `.slice(0, 20)` truncates the domain
— producing `a175640000000017@t.c` or worse — and the `z.string().email()` check on
`registerBodySchema` correctly rejects it with 400. The guard immediately above only re-checks the
*minimum* length after truncation, never the maximum-driven corruption:

```ts
if (uniqueUsername.length < 3 || uniqueEmail.length < 3) return;
```

So this is a test-wrong case, and the counterexample shrinking to a 3-character username is
misleading — the username is not the problem. Expect Category A to split into several causes; do
not assume one fix clears 18 suites.

#### Triage protocol

For each failing suite, record in the tasks file one of:

- **code fix** — the assertion is right and the implementation is wrong. Highest priority; these are
  regressions that have been invisible.
- **test fix** — the implementation is right and the test drifted. State what drifted.
- **delete** — the covered behaviour is genuinely gone. Requires an explicit statement per R5.5.
- **Exclusion_Register** — cannot be resolved in this spec. Requires a written reason and an
  Exclusion_Expiry per R5.6.

Category order: A (largest, partly shared cause), then E and F (fixture and seed drift against the
current schema — likely mechanical), then D and G one at a time.

#### Repeatability

The SIGSEGV and the two Ordering_Coupled_Tests are addressed after the tier is otherwise green,
because a segfault mid-tier makes any earlier measurement unreliable. Approach:

1. Run with `--detectOpenHandles` to find unclosed Prisma clients and other leaked resources.
2. Fix the leaks rather than masking them; assess whether `--forceExit` — currently on all three
   tier scripts — is still needed, and remove it where it is not (R6.5).
3. For `facilityRecommendationService` and `leagueRebalancingService`, find the shared state that
   couples them to tier order. Reordering or retrying is explicitly not an acceptable fix (R6.3).

#### Heavy_Tier

Measured in full before wiring (R7.1), then triaged on the same protocol. `test:heavy` is added to
both workflows as part of Component 1 so the job exists; if the tier cannot be made green within the
spec it becomes an Advisory_Step with a reason and an Exclusion_Expiry (R7.4) rather than being left
unwired, since being unwired is the condition that created this problem.

`tests/integration/tagTeamByeHandling.test.ts` gets specific confirmation (R7.5): `analysis.md`
reports it contained an assertion that could never pass — querying `battle_participants` for
`robotId: -1`, which carries a foreign key to `robots` — and that Spec #49 corrected it. Because the
suite is collected only by `jest.config.heavy.js`, no pipeline has ever run it.

## Data Models

No Prisma schema change and no migration. The spec touches how one existing column is *allocated*,
never its shape.

| Model / column | Current definition | Change |
|---|---|---|
| `audit_logs.sequence_number` | `Int`, part of `@@unique([cycleNumber, sequenceNumber])` | none — allocation moves behind the Sequence_Allocator, the column and constraint stay as they are |
| `audit_logs.cycle_number` | `Int`, indexed | none — becomes the advisory lock key |

Two non-database data structures change:

- **`sequenceNumberCache`** (`Map<number, number>`, module-level in `eventLogger.ts`) is **deleted**.
  It is the in-process half of the race: it caches a value derived across an `await`, so two callers
  that both miss it compute the same next number.
- **`jest.tiers.js` tier lists** are new: `HEAVY_TESTS` and `DB_DEPENDENT`, each an array of
  repo-relative path patterns, plus a derived Unit_Tier list. These replace `unitPatternsWithoutSrc`,
  `pureSrcTestPatterns`, and `heavyTestPatterns`.

## Correctness Properties

Stated as invariants so the regression tests have something precise to assert.

### Property 1: Tier_Partition is a partition

**Validates: Requirements 3.1, 3.4, 3.6**

For every `*.test.ts` file under `app/backend/tests/` or `app/backend/src/`, the number of tiers
collecting it is exactly 1. Enforced structurally by `jest.tiers.js` and checked by
`test:tiers:verify`.

### Property 2: Sequence uniqueness

**Validates: Requirements 4.2, 4.6**

For any cycle, no two `audit_logs` rows share a `sequenceNumber`. Already a database constraint; the
point of this spec is that it stops being *violated*.

### Property 3: Gapless_Invariant

**Validates: Requirements 4.3, 4.4**

For any cycle with n audit rows, the set of sequence numbers is exactly `{1..n}`. This is what
`checkSequenceNumbers` asserts, and it is why a PostgreSQL sequence is ruled out.

### Property 4: No dropped audit row

**Validates: Requirements 4.6, 4.9**

For k successful `logEvent` calls in a cycle, k rows exist. Currently violated silently, because
`logEvent` swallows its own failures.

### Property 5: Allocation is serialised per cycle, not globally

**Validates: Requirements 4.2, 4.5**

Two concurrent `logEvent` calls for *different* cycles must not block each other — hence the lock
key is the cycle number rather than a single global key.

### Property 6: Gate integrity

**Validates: Requirements 2.1, 2.2, 2.4, 2.6**

No lint, build, typecheck, or test step in either workflow can fail without failing its job, and no
deploy job can run unless every test job succeeded.

## Error Handling

- **The swallowed-failure pattern is the bug, in both halves of this spec.** `logEvent` catches its
  own insert failure and logs it, so a collision drops an audit row instead of surfacing; the
  integration step carries `continue-on-error`, so a red tier drops a signal instead of surfacing.
  Same shape at two scales, and the fix in both cases is to stop swallowing.
- **After the allocator lands, a genuine allocation failure should propagate.** The five-attempt
  retry loops go away with the race; a unique-constraint violation on
  `(cycle_number, sequence_number)` afterwards means the invariant is broken and must be visible, not
  retried.
- **Advisory lock behaviour.** `pg_advisory_xact_lock` blocks rather than failing, and releases at
  commit or rollback, so no explicit unlock path and no leak on error. The lock is taken inside the
  transaction that performs the insert, so allocation and insertion cannot be separated by a crash.
- **`AppError` hierarchy is unchanged.** The Sequence_Allocator is infrastructure below the domain
  error layer and throws no domain error of its own.
- **Triage must not convert an error into a pass.** Per R5.4, every failing suite resolves as a code
  fix, a test fix, an explicit deletion, or an Exclusion_Register entry — never by loosening an
  assertion to accept whatever the code currently returns.

## Testing Strategy

| Target | Tier | Test |
|---|---|---|
| Sequence_Allocator under concurrency | Integration_Tier | Drive N concurrent `logEvent` calls for one cycle; assert zero unique-constraint errors and sequence set `{1..N}` (R4.9) |
| Sequence_Allocator across cycles | Integration_Tier | Concurrent calls for two different cycles both complete, confirming the lock is per-cycle (property 5) |
| Gapless_Invariant | Integration_Tier | `checkSequenceNumbers` reports no `sequence_number_continuity` issue after a concurrent write burst (R4.3, R3.10) |
| Batch allocation | Integration_Tier | `logEventBatch` of n events yields n contiguous numbers |
| Tier_Partition | script gate | `test:tiers:verify` exits 0; deliberately duplicating a file in both lists makes it exit 1 with the path named |
| Restored Orphaned_Tests | Integration_Tier | All four now execute; `errorHandler.test.ts` specifically informs Category A triage (R5.3) |
| Repeatability | all tiers | Three consecutive full runs, identical counts and exit codes (R6.1) |

The concurrency tests belong in the Integration_Tier because the advisory lock is a real PostgreSQL
behaviour that a mocked Prisma client cannot exercise — a mocked version of this test would pass
against the broken code, which is why the defect survived this long.

Existing coverage thresholds in `jest.config.unit.js` are preserved by task 2.5 and must not regress.

## Documentation impact

_Requirements: 8.1–8.8_

| File | Change |
|---|---|
| `.kiro/steering/coding-standards.md` | Correct the gate table so it states measured rather than intended gating (8.1). Add the three bypasses found here to the removed-bypasses list (8.2). Correct the false "removed in July 2026" claim about `test:heavy` (8.3). Add the Sequence_Allocation rule to the database section (8.5). |
| `.kiro/steering/testing-strategy.md` | Document the Tier_Partition, how to choose a tier for a new test, the `DB_DEPENDENT` list, and that `test:tiers:verify` enforces it (8.4). |
| `app/backend/src/services/common/eventLogger.ts` | Correct the docstring misdiagnosis (8.6, 4.7). |
| `.kiro/specs/to-do/51-test-tier-restoration/analysis.md` | Record that Decision 1 is answered and which branch it landed on (8.7). |
| `docs/guides/operations/LOCAL_SETUP.md` | Add `test:tiers:verify` and explain that every backend test belongs to exactly one configured tier. |
| `docs/guides/operations/DEPLOYMENT.md` | Describe the Heavy_Tier and tier-partition verification as blocking pipeline checks alongside the existing backend, frontend, and E2E gates. |
| `.kiro/steering/project-overview.md` | Reviewed; no update is required because this spec changes test and CI wiring, not the project structure or technology stack. |

No pass/fail or count snapshot goes into any steering file (8.8). The Tier_Baseline lives in this
design document, which is a dated spec artefact rather than an authoritative rule.

`docs/architecture/PRD_SECURITY.md` is checked but not expected to change: the audit-gate envelope
defect noted in `ci.yml`'s own comments is a separate, already-tracked issue and is out of scope here.

## Out of scope

- The Unit_Tier's green state and the frontend unit tier, except for the `deploy.yml` wiring gap
  noted in Component 1.
- The `pnpm audit` envelope-parsing defect documented in `ci.yml` comments and
  `docs/architecture/PRD_SECURITY.md`. It is a real dead gate, but it is dependency-security scope,
  already recorded, and bundling it here would blur this spec's verification.
- Playwright suite *content*. Its `needs:` wiring is in scope; whether its assertions are correct is
  not measured by this spec.

## Requirements traceability

| Requirement | Covered by |
|---|---|
| 1.1–1.4 | Component 1 § Gate_Manifest; Documentation impact |
| 2.1–2.7 | Component 1 |
| 3.1–3.8 | Component 2 |
| 4.1–4.9 | Component 3 |
| 5.1–5.7 | Component 4 § Sequencing, Category A, Triage protocol |
| 6.1–6.5 | Component 4 § Repeatability |
| 7.1–7.6 | Component 1 (job definition), Component 4 § Heavy_Tier |
| 8.1–8.8 | Documentation impact |
| 9.1–9.4 | Final verification task in `tasks.md` |

No requirement is documentation-only-and-unaddressed; R8 is documentation by nature and is covered
above.
