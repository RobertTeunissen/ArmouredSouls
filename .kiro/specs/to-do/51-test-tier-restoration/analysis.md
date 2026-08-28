# Spec 51 — Test Tier Restoration: Investigation Notes

> **Status: investigation complete, requirements not started.**
> This is a measured survey of the integration tier's failures plus two CI gaps, and it ends with
> four decisions that must be made before `requirements.md` can be written. It is deliberately not a
> requirements document: the biggest question — whether a failing test means the code is wrong or the
> test is wrong — has 67 different answers, and guessing them in bulk would be worse than useless.
>
> Measured 27 August 2026 against a pristine `git worktree` at HEAD `e4da0182`, so every count below
> is the state of `main` and **not** a consequence of Spec #49. Confirmed by running the same tier on
> the working tree and diffing the failure lists.

## How this was found

Spec #49 (Bye System Unification) added integration tests and ran `pnpm run test:integration` to
verify them. The tier came back with 69 failing suites. To establish whether that was Spec #49's
fault, a `git worktree` was checked out at pristine HEAD and the same tier run there: **67 failing
suites, 272 failing tests**. The two-suite difference was traced to order-dependent flakes that pass
in isolation on both trees (see § Flakes).

So the tier has been substantially red for some time, and nobody noticed — because it does not gate
anything. That is the actual finding; the 67 suites are the symptom.

## Measured state

| Metric | Value |
|---|---|
| Integration suites, total | 143 |
| Integration suites, failing | **67 (47%)** |
| Integration tests, total | 1,791 |
| Integration tests, failing | **272 (15%)** |
| Exit code | 1 on the first run, **139 (SIGSEGV)** on a re-run that crashed mid-tier |

The segfault matters on its own: the tier is not merely failing, it is unstable enough that two
consecutive runs do not produce comparable results. Any requirements written for this spec need a
green *and repeatable* target, not just a green one.

## Why nobody noticed: two CI gaps

### Gap 1 — `test:heavy` runs in no pipeline

```
$ grep -n "test:heavy" .github/workflows/*.yml
(no output)
```

`.kiro/steering/coding-standards.md` lists `pnpm run test:heavy` in its table of gates that "run on
every push and pull request, in both `ci.yml` and `deploy.yml`, and every one of them gates a
deploy". It also records, under bypasses "found and removed in July 2026", the entry
"`test:heavy` running in no pipeline at all".

That removal either regressed or was never completed. The steering file is currently asserting a
gate that does not exist, which is exactly the rotting-fact problem the same file warns about two
paragraphs later.

**This has already cost something concrete.** `tests/integration/tagTeamByeHandling.test.ts`
contains an assertion that can never pass: it queries for a `battle_participants` row with
`robotId: -1`, and that column carries a `robot Robot @relation` foreign key. The suite is collected
only by `jest.config.heavy.js`. It has therefore been dead for as long as the gap has existed.
Spec #49 corrected the assertion but could not have found it from CI.

### Gap 2 — is `test:integration` actually gating?

`test:integration` *is* referenced in the workflows, and the steering file records removing a
`|| true` and a bare pipe from it in July 2026. But a tier cannot be both gating and 47% red on
`main`. One of three things is true and the first task of this spec is to determine which:

- the gate runs against a different database state than a local run (a fresh migrated+seeded DB
  where these fixtures do work), or
- the gate is still being swallowed somewhere, or
- `main` is genuinely red and deploys are proceeding anyway.

**Do not write requirements before answering this.** If it is the first, most of the 67 are
environment-shaped and the spec is small. If it is the third, the spec is large and urgent.

## The 67 failures, categorised

Grouped by dominant symptom from the pristine-HEAD run. Counts are unique suites; several suites
show more than one symptom and are filed under the loudest.

| # | Category | Suites | What it looks like |
|---|---|---|---|
| A | Auth / response shape | 18 | Endpoint returns `{}` with 401 or 403 where the test expects 400/200 and `body.error` |
| E | Prisma validation / missing required field | 9 | `PrismaClientValidationError`, `Invalid prisma.X.create() invocation` — fixture missing a column the schema now requires |
| F | Undefined result | 8 | `Received: undefined`, `Cannot read properties of undefined (reading 'count')` — seed data absent |
| D | Domain error not thrown | 1 | `Expected constructor: TeamBattleError, Received constructor: Error` |
| B | `audit_logs` sequence collision | 1 directly | Unique constraint on `(cycle_number, sequence_number)` — see § The one real production-adjacent bug |
| G | Uncategorised / mixed | 26 | Assorted; two sampled below |

Two sampled from G, to show they are not all one thing:

- `tests/combatSimulator.spatial.test.ts` — expects a `robot1HP` property on a combat event. The
  event shape changed; the test did not. One assertion of fourteen.
- `tests/cycleSnapshotService.test.ts` — expects a rejection matching `/incomplete/`, receives a
  Prisma validation error instead. The service now fails earlier and for a different reason, so the
  test is asserting an error path that no longer exists.

**Category A is the one to investigate first**, both because it is the largest and because 18 suites
failing the same way suggests one cause rather than eighteen. A lead worth checking before anything
else: `tests/middleware/errorHandler.test.ts` sits in `testPathIgnorePatterns` in
`jest.config.unit.js`, and the error handler is precisely the middleware that shapes
`{ error, code, details }`. An excluded test for the component whose output 18 suites assert is not
a coincidence worth dismissing.

## The one real production-adjacent bug

Everything above is test-shaped. This is not.

`getNextSequenceNumber` in `app/backend/src/services/common/eventLogger.ts:114-133` generates the
`audit_logs` sequence number with a **check-then-act across an `await`**:

```ts
if (sequenceNumberCache.has(cycleNumber)) { /* fast path */ }

const lastEvent = await prisma.auditLog.findFirst({   // ← two callers can both reach here
  where: { cycleNumber },
  orderBy: { sequenceNumber: 'desc' },
});
const nextSequence = lastEvent ? lastEvent.sequenceNumber + 1 : 1;
sequenceNumberCache.set(cycleNumber, nextSequence);
return nextSequence;
```

Two concurrent callers that both miss the cache both await the same query, both compute the same
`nextSequence`, and the second insert violates `@@unique([cycleNumber, sequenceNumber])`. It appears
**635 times** in one integration run.

**Correcting a misdiagnosis in the code's own comment.** The docstring on `sequenceNumberCache`
(`eventLogger.ts:102-107`) calls the collision a "rare race with parallel test runners or
multi-process deployments". It is neither, and it is not rare:

- `jest.config.integration.js` sets `maxWorkers: 1`.
- `app/ecosystem.config.js` sets `instances: 1`.

So the collision is *intra-process*, on the async gap, and the existing explanation would send an
investigator looking for a second process that does not exist. It follows that the bug is reachable
in production the moment two request handlers log an event for the same cycle concurrently — which
is ordinary behaviour, not an edge case. The reason it is not a visible production incident is that
`logEvent` catches and logs its own failures, so a collision silently drops an audit row rather than
failing a request.

That last part is the part to weigh: **a dropped audit row is a silent gap in the Repair_Spend_Source
and battle-income series that several analytics surfaces read from.** Spec #48 established
`audit_logs` as the single source of truth for repair spend. A racy sequence generator means that
source has holes.

## Flakes

Two suites failed on the working tree but not on pristine HEAD, and both pass in isolation on
**both** trees:

- `tests/facilityRecommendationService.test.ts`
- `tests/leagueRebalancingService.test.ts`

Neither file, nor anything either imports beyond `src/lib/prisma`, was touched by Spec #49. They are
order- or contention-dependent within the tier. They are listed here so a future run that sees them
red does not mistake them for a new regression — but they are also evidence that the tier has
ordering coupling that a restoration spec should address, not just paper over.

## Four decisions required before requirements

### Decision 1 — establish the CI ground truth first

Before any test is touched: determine whether `test:integration` currently gates a deploy, and what
database state it runs against. Everything about this spec's size depends on the answer. This is a
task, not a decision, but it must come first and its result should be written into the requirements
as a stated fact.

### Decision 2 — code wrong, or test wrong?

For each of the 67, one of these is true, and the coding-standards rule is explicit: "If a suite is
red, either the code is wrong or the test is wrong. Fix one of them. Do not make the check advisory,
and do not delete a test to make a build pass unless the behaviour it covers is genuinely gone (say
so explicitly if you do)."

That rule forbids a bulk resolution. The realistic shape is per-category triage:

- **A (18 suites)** — most likely one shared cause. Fix once, expect most of the 18 to fall.
- **E (9), F (8)** — most likely fixtures and seeds that drifted behind the schema. Test-side fixes.
- **D (1), G (26)** — genuinely need reading one at a time. Some will be behaviour that legitimately
  changed and tests nobody updated; some may be real regressions that have been invisible for months.

**The decision is whether this spec commits to all 67 or to a subset.** A defensible smaller scope:
fix the `eventLogger` race, fix category A, wire the CI gates, and put the remainder behind a
documented, dated exclusion list — which the steering file permits only with "a comment saying *why*
and what would allow it back". That is a real option, but it must be chosen deliberately.

### Decision 3 — the `eventLogger` fix

Three shapes, in ascending order of cost:

- **A database sequence or `ON CONFLICT` retry.** Let Postgres allocate. Removes the race entirely and
  removes the cache. Changes the meaning of `sequenceNumber` from gapless to monotonic — worth
  checking whether anything depends on it being gapless.
- **A per-cycle async mutex around the cache miss.** Smallest diff, keeps gapless numbering, and
  keeps the flaw that it only holds within one process. Acceptable while `instances: 1`, and a
  landmine if PM2 is ever scaled.
- **A `pg_advisory_xact_lock` keyed on the cycle.** Correct across processes, heavier, and the
  pattern the codebase already uses for multi-row serialisation in team creation.

Whichever is chosen, the docstring's "parallel test runners or multi-process deployments" claim must
be corrected, because it currently misdirects.

### Decision 4 — what the heavy tier gate does to the pipeline

Wiring `test:heavy` into CI is a one-line change and almost certainly the wrong thing to do first:
its suites have never gated anything, so the failure count there is unknown and probably non-zero.
Measure the heavy tier before wiring it, then decide whether it goes in as a blocking gate
immediately or as a reported-but-non-blocking job with a dated deadline to become blocking.

**Do not wire it as non-blocking without a deadline.** That is how the current situation happened.

## Scope boundary

In scope: the 143-suite integration tier, the heavy tier's CI wiring, the `eventLogger` sequence race,
and the two ordering-coupled flakes.

Out of scope: the unit tier (231 suites, 3,428 tests, green), the frontend tier (1,904 tests, green),
and Playwright (not measured by this investigation — worth a separate look, since the steering file
records `continue-on-error: true` plus `always()` having been removed from it in July 2026 and the
same regression pattern may apply).

## Verified-green baseline for comparison

Recorded so a future run can tell restoration from regression. Measured 27 August 2026 on the
working tree with Spec #49 applied:

| Tier | Result |
|---|---|
| Backend lint | pass |
| Backend build | pass |
| `typecheck:tests` | pass |
| Backend unit | 231 suites, 3,428 tests, all pass |
| Frontend lint / build / `test:ci` | pass, 1,904 tests |
| Backend integration | 67 suites / 272 tests failing (unchanged from pristine HEAD) |
| Backend heavy | not measured in full; the two Spec #49 bye suites pass (31 tests) |
| E2E Playwright | not measured |
