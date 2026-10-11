# Spec 57 — Scaling investigation: how many Automatons the built engine runs

**Status**: Investigation — read-only, built spec-55 code at `bc8c8682`; nothing changed
**Date**: 11 October 2026
**Decision**: README decision 19 ("No cap: investigate scaling and run the heavy test over every repository entry")

No activation cap (decision 19). This report proposes none. It describes what the built engine does with more Automatons, where it stops keeping up, and which engine changes would fix that. Those changes are open items for the product owner (§6). Spec 57 implements none of them.

Every `path:line` below is relative to the repository root. The references were resolved at the spec-55 head `bc8c8682`; `main` (`755ef1ef`, spec 55 merged in PR #529) holds every cited file unchanged except `app/backend/src/utils/securityValidation.ts`, where only a comment below the cited line 104 changed, so every line number still holds. Nothing was run for this investigation: no test, build, migration or database. Every number is marked **verified** (read in the code, or a measurement recorded in the spec-55 implementation record) or **estimated** (derived here from verified inputs).

---

## 1. Answer first: will 10,000 Automatons work as built?

No, not within the daily 300 s Turn_Step budget. Nothing crashes and no data is corrupted. But most stables would sit without robots for most of the season.

- The engine runs every Active_Automaton one after another, in one loop, inside one Turn_Step per day (verified, §2).
- A Turn_Step stops starting turns after 300 s. Every Automaton not reached yet is recorded as skipped (verified).
- The expensive turn is the opening build. Every Automaton has one at every season start, because the rollover resets every stable. The recorded cost is 0.64–0.98 s per Automaton (gate runs) to 2.44–2.60 s (an earlier implementation run) (verified inputs).
- At 10,000 that is 6,380–26,000 s of sequential work, 1.8–7.2 hours, against a 300 s budget (estimated). The season start offers 3 Turn_Steps for it (estimated, §3).
- Even the cheap steady-state daily turn costs 14–30 ms per Automaton. At 10,000 that alone fills 140–300 s of the 300 s (estimated).
- The skipped Automatons are always the same ones: the highest `User.id`, which are the last activated (verified, §4 B2).

At the current repository size (starters plus every Expansion_Stable, from the Totals block in `FINDINGS.md`) the opening build is borderline: it fits at the gate measurement and overruns at the implementation-run measurement (§3). At 1,000 the opening builds spill over 3 to 10 daily steps. The rest of the system (sync, admin listing, matchmaking) scales linearly and has no hard stop before 10,000; three admin paths get slow or heavy (§5).

## 2. How a cycle runs Automatons

All verified by reading the code.

- **Scheduler.** Ten `node-cron` jobs at fixed UTC hours: league 08:00, team 2v2 league 09:00, tournament 10:00, tag team 11:00, KotH 13:00, team 3v3 league 14:00, team 2v2 tournament 15:00, Grand Melee 17:00, team 3v3 tournament 18:00, settlement 00:00 (`app/backend/src/services/cycle/cycleScheduler.ts:53`–63, registration at `:886`–`:895`, `cron.schedule` at `app/backend/src/services/cycle/cycleScheduler.ts:914`). Every job goes through `runJob`, which first takes an in-memory FIFO mutex (`acquireLock`, `app/backend/src/services/cycle/cycleScheduler.ts:101`; taken at `app/backend/src/services/cycle/cycleScheduler.ts:741`). Jobs in one process therefore run one at a time; a job that overruns delays the next ones.
- **Where Automaton turns run.** Only at the end of settlement:
  - in a Preparation_Phase, after `advancePreparationCycle`, trigger `preparation` (`app/backend/src/services/cycle/cycleScheduler.ts:315`);
  - in a competitive cycle, after the cycle close, the leaderboard refresh and `advanceCompetitiveCycle`, trigger `settlement` (`app/backend/src/services/cycle/cycleScheduler.ts:461`), except on the boundary cycle;
  - on the boundary cycle the rollover runs (`app/backend/src/services/cycle/cycleScheduler.ts:450`), and its Stage 5 runs trigger `season_open` (`app/backend/src/services/season/seasonRolloverService.ts:221`);
  - admin bulk cycles call the same runner, outside the scheduler mutex (`app/backend/src/services/admin/adminCycleService.ts:44`, `:259`, `app/backend/src/services/admin/adminCycleService.ts:1031`). The admin request is synchronous (`app/backend/src/routes/adminMaintenance.ts:132`) and accepts up to 100 cycles (`app/backend/src/routes/adminMaintenance.ts:49`).
  - Every call is non-fatal: a failing Turn_Step is logged and alerted, settlement continues (`app/backend/src/services/cycle/cycleScheduler.ts:477`).
- **Lease.** `runTurnStep` (`app/backend/src/services/automaton/automatonTurnService.ts:477`) runs inside `withTurnStepLease` (`app/backend/src/services/automaton/automatonTurnService.ts:161`). The lease is one row in `automaton_program_settings`, claimed with a conditional update for 300 s + 60 s margin (`app/backend/src/services/automaton/automatonTurnService.ts:167`; margin at `app/backend/src/services/automaton/automatonTurnService.ts:89`). A second caller polls every second without a time limit (`app/backend/src/services/automaton/automatonTurnService.ts:183`). So Turn_Steps are serialized across processes too.
- **Cohort.** One `findMany` of every Active_Automaton, ordered by `userId` ascending (`app/backend/src/services/automaton/automatonTurnService.ts:204`, order at `:218`), read once at the start (`app/backend/src/services/automaton/automatonTurnService.ts:487`). The weapon catalogue is read once per step (`app/backend/src/services/automaton/automatonTurnService.ts:490`).
- **Loop.** One sequential `for` loop over the cohort (`app/backend/src/services/automaton/automatonTurnService.ts:493`). Per profile: a budget check, `claimTurnRecord` (insert-or-read of one `automaton_turns` row, `app/backend/src/services/automaton/turnRecords.ts:61`), then `runAutomatonTurn`. There is no parallelism.
- **Budgets** (`app/backend/src/services/automaton/turnBudget.ts`): 60 charged actions per turn (`:9`), 10 s per turn (`app/backend/src/services/automaton/turnBudget.ts:12`), 300 s per Turn_Step (`app/backend/src/services/automaton/turnBudget.ts:15`). The step budget is checked before each profile (`app/backend/src/services/automaton/automatonTurnService.ts:503`, rule at `app/backend/src/services/automaton/turnBudget.ts:53`). Once it is spent, each remaining profile is claimed and marked `skipped` / `step_budget_exhausted` (`app/backend/src/services/automaton/automatonTurnService.ts:510`), and one alert is raised (`app/backend/src/services/automaton/automatonTurnService.ts:543`).
- **One turn.** The planner loop (`app/backend/src/services/automaton/automatonTurnService.ts:360`) checks the turn budget before each action (`:365`) and executes it (`app/backend/src/services/automaton/automatonTurnService.ts:372`). `executeAction` runs every charged step through the domain service of the human route, each in its own transaction: attribute upgrades via `executeUpgradeTransaction` (`app/backend/src/services/automaton/actionExecutor.ts:81`), refinements via `refineWeapon` (`app/backend/src/services/automaton/actionExecutor.ts:155`), facilities, weapons and robots via `executionSteps.ts` and `robotFitout.ts`. After the purchase it writes the event log, spending tracker and achievement check, and then reloads all stable facts (`app/backend/src/services/automaton/actionExecutor.ts:206`). That reload alone is seven queries (`app/backend/src/services/automaton/stableFacts.ts:331`–`:358`).

## 3. Cost per Automaton and extrapolation

### 3.1 Recorded measurements (verified)

From `docs/implementation_notes/automaton-stables-verification.md:38`–`:49`: `automatonMultiSeason.test.ts` with 100 Active_Automatons (11 starters + 89 generated), local Apple Silicon, PostgreSQL 17 in Docker.

| Turn_Step | Charged actions (100 Automatons) | Duration (100 Automatons) |
|---|---:|---:|
| Opening build (Season 1 Preparation 1, Season 2 `season_open`), gate runs | 1,275–1,292 | 63.8–98.4 s |
| Opening build, earlier implementation run | not recorded | 244 s and 260 s |
| Other Preparation steps | 0 | 0.9–1.7 s |
| Settlement steps | 13–31 | 1.4–3.0 s |

Also recorded: about 130 SQL statements per charged action on the shared human purchase path (`docs/implementation_notes/automaton-stables-verification.md:66`). The spec-55 design target was ≤ 180 s for the opening step and ≤ 60 s for a steady-state settlement, for 100 Automatons on the 2 vCPU production VPS (`.kiro/specs/done-october26/55-automaton-stables/design.md:1186`). The test file itself notes ~250 s per opening step locally (`app/backend/tests/integration/automatonMultiSeason.test.ts:74`, comment above the constant). No measurement exists on the production VPS.

### 3.2 Per-Automaton cost (estimated from §3.1)

Formula: cost per Automaton = recorded step duration ÷ 100 Automatons. Capacity = 300 s ÷ cost per Automaton.

| Turn kind | Cost per Automaton | Charged actions per Automaton | SQL statements per Automaton (× 130) | Automatons per 300 s step |
|---|---:|---:|---:|---:|
| Opening build, gate rate | 0.64–0.98 s | 12.8–12.9 | ~1,660 | 305–470 |
| Opening build, implementation-run rate | 2.44–2.60 s | ~13 (assumed as gate) | ~1,660 | 115–123 |
| Steady-state settlement | 14–30 ms | 0.13–0.31 | ~17–40 plus turn bookkeeping | 10,000–21,400 |
| Idle Preparation step (nothing to buy) | 9–17 ms | 0 | turn bookkeeping only | 17,600–33,300 |

Caveat: the heavy test runs no battle events (its bulk-inserted battles pay no rewards), so its steady-state turns buy little. In production, battle income funds more purchases per settlement turn, so the steady-state cost is likely higher than 14–30 ms (estimated, not measured).

### 3.3 Extrapolation (estimated)

N_current is the "Repository total if delivered" stable count of the Totals block in `review/FINDINGS.md` (starters + every Expansion_Stable); it is 205 on the date of this report and is read from there, not fixed here. Duration = N × cost per Automaton; skipped = N − capacity when positive.

| Turn_Step | N_current (205 on 2026-10-11) | 1,000 | 10,000 |
|---|---:|---:|---:|
| Opening build, gate rate | 131–202 s, fits | 640–980 s; 530–695 skipped | 6,380–9,840 s (1.8–2.7 h); 9,530–9,695 skipped |
| Opening build, implementation-run rate | 500–533 s; 82–90 skipped | 2,440–2,600 s; 877–885 skipped | 24,400–26,000 s (6.8–7.2 h); 9,877–9,885 skipped |
| SQL statements of the opening build | ~0.34 million | ~1.7 million | ~17 million |
| Steady-state settlement | 3–6 s | 14–30 s | 140–300 s |
| Idle Preparation step | 2–3.5 s | 9–17 s | 90–170 s |

Catch-up across steps (estimated, a simple simulation of the loop: each step first runs the already-built Automatons at the steady-state cost, then spends what is left of 300 s on opening builds). A season start offers 3 Turn_Steps before the first competitive cycle: `season_open` plus the Preparation steps (`PREPARATION_LENGTH_CYCLES` defaults to 2, `app/backend/src/config/env.ts:138`; the first season has the 2 Preparation steps only).

| N | Steps until every Automaton has its opening build | Built after the 3 season-start steps |
|---:|---|---:|
| N_current (205) | 1 (gate) to 2 (implementation run) | all |
| 1,000 | 3–4 (gate) to 9–10 (implementation run) | 344–1,000 |
| 10,000 | 29 at best; at the slower rates never within a 100-cycle season (7,000–9,600 built by its end) | 344–1,381 |

The daily cron cadence leaves room in wall-clock time (settlement at 00:00, the next job at 08:00), so time of day is not the limit. The fixed 300 s Turn_Step budget and the single sequential loop are.

## 4. Bottlenecks

| # | What | Where | Bites from | Effect | Basis |
|---|---|---|---|---|---|
| B1 | One sequential loop over the whole cohort; no parallel turns | `app/backend/src/services/automaton/automatonTurnService.ts:493` | Opening build: ~115–470 Automatons. Steady state: ~10,000 | Everything after 300 s is skipped | Code verified; thresholds estimated |
| B2 | Fixed `userId` order, no rotation and no priority for skipped profiles. A skipped Turn_Record is final for its key (`app/backend/src/services/automaton/turnRecords.ts:81`), and each step has a new slot, so the next step starts from the lowest `userId` again | `app/backend/src/services/automaton/automatonTurnService.ts:218` | Whenever B1 bites | The same highest-`userId` (last-activated) stables are skipped every time. They catch up only when the earlier ones become cheap (after their opening build). When the steady state alone fills the budget (~10,000), they never catch up | Verified (code); catch-up estimated |
| B3 | Fixed 300 s Turn_Step budget, independent of population | `app/backend/src/services/automaton/turnBudget.ts:15` | As B1 | Caps the Automatons served per day | Verified |
| B4 | Every Automaton rebuilds at each season start; the rebuild is the expensive turn | rollover Stage 5, `app/backend/src/services/season/seasonRolloverService.ts:221`; Preparation steps, `app/backend/src/services/cycle/cycleScheduler.ts:315` | ~350–1,400 (3 steps × capacity) | Late stables start the competitive season without robots | Verified (code); thresholds estimated |
| B5 | ~130 SQL statements per charged action: own transaction per step, event log, spending tracker, achievement check, then a full facts reload | `app/backend/src/services/automaton/actionExecutor.ts:206`; reload queries `app/backend/src/services/automaton/stableFacts.ts:331`–`:358` | All N (sets the cost per Automaton) | 50–200 ms per charged action | Statement count verified (recorded); per-action time estimated |
| B6 | The skip tail costs 3 statements per skipped profile (insert, read, update) after the budget is spent, while the lease runs 60 s past the budget | `app/backend/src/services/automaton/automatonTurnService.ts:510`; lease length `app/backend/src/services/automaton/automatonTurnService.ts:167` | ~10,000 (~29,000 tail statements) | The step can outlive its lease; a waiting caller (for example an admin bulk cycle) could then start a second Turn_Step at the same time | Code verified; timing estimated |
| B7 | Measurements are local only; the production VPS has 2 vCPU | `.kiro/specs/done-october26/55-automaton-stables/design.md:1186` | All N | Production may be slower than every number in §3 | Estimated |

## 5. Sync, admin and matchmaking effects

**Catalogue_Sync** (`app/backend/src/services/automaton/catalogueSync.ts:143`). Verified: it validates the whole catalogue folder in memory, then loops over every entry (`app/backend/src/services/automaton/catalogueSync.ts:154`). Per existing entry: one `findUnique` with its blueprints, then a transaction per blueprint without an image whose file exists (`fillImages`, `app/backend/src/services/automaton/catalogueSync.ts:63`, transaction at `:75`). Per new entry: two lookups for the stable name (`app/backend/src/services/automaton/catalogueSync.ts:88`) and one nested insert of the profile with its blueprints (`app/backend/src/services/automaton/catalogueSync.ts:96`). Estimated: a steady-state deploy is about one query per entry (10,000 queries at 10,000), a first sync a few queries per entry. Linear, no hard stop; none found beyond that.

**Admin listing.** Verified: `listProfiles` (`app/backend/src/services/automaton/automatonProfileService.ts:370`) is paginated with `skip`/`take` (`:390`–`:391`) and the route caps `limit` at 100 (`paginationQuery`, `app/backend/src/utils/securityValidation.ts:104`, extended at `app/backend/src/routes/adminAutomatons.ts:190`). The latest Turn_Record per row is a bounded include (`take: 1`, `app/backend/src/services/automaton/automatonProfileService.ts:395`). Turn history per stable is paginated too (`app/backend/src/routes/adminAutomatons.ts:509`). Two paths are not bounded:

- The `attention` filter first classifies every matching Active_Automaton (`app/backend/src/services/automaton/automatonProfileService.ts:379`) and then filters by an `id IN` / `NOT IN` list of all flagged ids (`:381`–`:383`).
- The Status_Bar (`GET /status`, `app/backend/src/routes/adminAutomatons.ts:284`) calls `loadActiveNeedAttention` without a filter (`app/backend/src/services/automaton/automatonStatus.ts:84`): one `findMany` of every Active_Automaton (`app/backend/src/services/automaton/needAttention.ts:129`) and two aggregate queries over `automaton_turns` with every profile id in an `IN` list (`app/backend/src/services/automaton/needAttention.ts:91`).

Estimated: `automaton_turns` grows by about N × 103 rows per 100-cycle season (one per settlement, Preparation and `season_open` step) and is truncated at rollover (`app/backend/src/services/season/seasonPurgeService.ts:215`). At 10,000 that is up to ~1 million rows by season end, read on every Status_Bar load. Slow, not failing; a 10,000-id `IN` list stays under PostgreSQL's bind-parameter limit.

**Other unpaginated reads** (grep `automatonProfile.findMany` / `automatonTurn.findMany`, verified): `activateAllDrafts` activates every draft in one synchronous request, one after another (`app/backend/src/services/automaton/automatonProfileService.ts:1027`, loop at `:1035`; route `app/backend/src/routes/adminAutomatons.ts:395` takes no body, so no batch size). `exportCatalogue` without keys loads every profile with its blueprints into one response (`app/backend/src/services/automaton/catalogueExport.ts:73`; the route caps explicit keys at 500, `app/backend/src/routes/adminAutomatons.ts:232`, but no keys means all). The Strategy_Comparison reads every Active_Automaton (`app/backend/src/services/automaton/strategyComparisonService.ts:252`); its timing was proven at 100 Automatons only (265–286 ms, recorded). A Strategy_Version upgrade without keys loads every profile of the strategy (`app/backend/src/services/automaton/strategies/strategyUpgradeService.ts:226`). Estimated: each grows linearly; activate-all and export are the ones that turn into long single requests at thousands.

**Matchmaking and leagues.** Verified: Automaton robots are ordinary robots to matchmaking. No file under `services/matchmaking`, `league`, `tournament`, `koth` or `grand-melee` reads `stableType` (spec-55 decision 34; the only `automaton` mentions there are `null` fields on generated bye and team robots). A league instance holds at most 100 robots (`app/backend/src/services/league/leagueInstanceService.ts:10`), so more robots means more instances per tier, not a full league. Achievement rarity counts humans only (`app/backend/src/services/achievement/achievementQueries.ts:166`, decision 38).

Estimated: the Totals block gives about 3.4 blueprints per stable at the current size. At 10,000 Automatons that is up to ~34,000 robots. If each plays one 1v1 league match per day, that is ~17,000 battles a day from 1v1 alone. The heavy fixture derives ACC's current volume as ~760 battles a day, rounded to 1,000 (`app/backend/tests/helpers/automatonHeavyFixture.ts:65`). The battle jobs run one after another under the scheduler mutex, one hour apart, and their duration at that volume has never been measured. `battles` is truncated at rollover (`app/backend/src/services/season/seasonPurgeService.ts:205`). A human's share of Automaton opponents is roughly A ÷ (A + H) in a shared pool (A Automaton robots, H human robots). H was not read (no database was used).

## 6. Open items for the product owner (not implemented by spec 57)

Each item is an engine change spec 55's code would need for populations well above a few hundred. None is a cap.

- **Bounded parallel Turn_Steps** (B1, B3). Run K Automaton turns at a time instead of one. Each Automaton is its own user, so turns touch different balances; the shared writers (ledger, event log, achievements) need checking for contention. Scope: the turn runner loop, plus a concurrency test. It multiplies capacity by about K.
- **Fair rotation after budget skips** (B2). Start each Turn_Step where the previous one stopped, or serve profiles skipped last time first. Scope: the cohort order and a cursor in `automaton_program_settings`. It spreads delay evenly instead of always hitting the last-activated stables.
- **Budget scaled with population or chunked steps** (B3, B4). Either a step budget per Automaton (for example 300 s per few hundred), or follow-up chunks that run until the cohort is done. Scope: `turnBudget.ts`, the turn runner and the alert. It turns skips into a longer, bounded run; the in-process mutex then delays later jobs, so the 00:00–08:00 gap is the real limit.
- **Fewer statements per charged action** (B5). Update facts incrementally instead of the full reload after every action, and batch event-log and spending writes. Scope: the action executor and facts loader, with the projector parity tests. It lowers the cost per Automaton for every N.
- **Bulk skip marking and a lease heartbeat** (B6). Mark the skip tail in one statement, and extend the lease while a step is still running. Scope: the turn runner and lease. It prevents two Turn_Steps running at once at very large N.
- **Batched or background admin operations** (§5). A batch size or key list for activate-drafts, a paginated or streamed export, and a cached or incremental Need_Attention count for the Status_Bar. Scope: the admin routes and services.
- **Measure battle volume** (§5). Time the battle jobs at the target robot count before activating thousands of Automatons. Scope: a heavy-tier measurement, no engine change.

## 7. What spec 57's heavy test must measure

- Activate every repository Catalogue_Entry (starters + every Expansion_Stable); no fixed population and no generated entries.
- For each Turn_Step: duration, Automatons processed and duration ÷ processed (seconds per Automaton), recorded per trigger (`preparation`, `season_open`, `settlement`) in the implementation note.
- The number of budget-skipped profiles per step; the test fails on any skip.
- Charged actions per step, so the per-action cost of §3.2 can be re-derived.

Today's test proves 100 Active_Automatons only: the 11 starters by a fixed key list plus 89 generated entries (`app/backend/tests/helpers/automatonHeavyFixture.ts:37`, `:51`). It asserts one Turn_Record per Automaton with none failed or skipped (`app/backend/tests/integration/automatonMultiSeason.test.ts:173`) and each step within 300 s (`app/backend/tests/integration/automatonMultiSeason.test.ts:200`). At the current repository size the opening step is expected to take 131–533 s (§3.3), so the new test may fail on a budget skip. If it does, that result is recorded with the open items of §6; spec 57 does not raise the budget or add a cap to make it pass.

## 8. Verified vs estimated

Verified (code read at `bc8c8682`, or a recorded measurement):

- Jobs serialize behind one in-memory mutex; Automaton turns run only at the end of settlement, rollover Stage 5 and admin bulk cycles.
- One sequential loop per Turn_Step over every Active_Automaton in ascending `userId` order; budgets 60 actions, 10 s per turn, 300 s per step; profiles after the budget are marked skipped, and a skipped record is final for its key.
- The lease is 300 s + 60 s, polled every second.
- Every charged action goes through the human purchase path in its own transaction and ends with a full facts reload.
- Recorded: 1,275–1,292 charged actions and 63.8–98.4 s per opening step, 244 s and 260 s in an earlier run, 0.9–1.7 s per idle Preparation step, 1.4–3.0 s per settlement step, all at 100 Automatons; ~130 statements per charged action.
- Admin listing and turn history are paginated (limit ≤ 100); the Status_Bar, the `attention` filter, activate-all, export without keys, the Strategy_Comparison and a key-less strategy upgrade read every profile.
- Matchmaking does not distinguish Automatons; league instances hold at most 100 robots; rarity counts humans only.
- The heavy test proves 100 Active_Automatons with a fixed starter list plus generated entries.

Estimated (derived here, not measured):

- Every per-Automaton cost, capacity, duration, skip count and catch-up figure in §3.2 and §3.3.
- The steady-state cost in production (likely higher than measured, because the test pays no battle income).
- Production-VPS speed relative to the local measurements.
- The skip-tail time at 10,000 and the lease overrun.
- `automaton_turns` growth per season, Status_Bar cost, sync and export cost at N.
- Battle volume at N and the human share of Automaton opponents.
