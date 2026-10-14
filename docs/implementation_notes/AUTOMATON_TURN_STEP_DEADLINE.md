# Automaton Turn_Step deadline and bounded concurrency

**Status:** implemented on `fix/issue-174-favicon-acc-title` · **Date:** 14 October 2026 · **Supersedes:** spec 55 R7.10 and the 300 s hard limit in spec 55 design §8.8 and §19 (the done spec files are not edited).

Every Active_Automaton now takes its turn the same night, also when the population grows. The fixed 300 s Turn_Step budget is replaced by a deadline taken from the cycle schedule, and turns run with bounded concurrency. Product rules: `docs/game-systems/PRD_AUTOMATON_STABLES.md` "Turn timing and budgets".

## Incident

ACC, season 1 cycle 72 (the second settlement with the 205-entry catalogue):

```
🚨 Automaton Turn_Step budget exhausted — Turn_Step season 1 cycle 72: 16 stable(s) skipped with step_budget_exhausted after 302 s
```

About 189 opening builds fit into 300 s, roughly 1.6 s per stable on the 2 vCPU VPS. The old runner was one sequential loop that checked the 300 s budget before each stable and then recorded every remaining stable `skipped`. A skipped Turn_Record is final for its key, so those stables waited a full cycle. They were always the highest `User.id`s, i.e. the newest activations.

## Why the 300 s limit existed

Spec 55 sized it for 11 starter stables and a 100-stable test. It protected:

1. **Scheduler blocking.** The Turn_Step runs inside the settlement job, inside the scheduler's in-memory FIFO mutex; every other job queues behind it. The next job after the 00:00 settlement is the 08:00 league job, so the real window was about 8 h, not 300 s.
2. **Lease length.** The lease was sized as budget + 60 s. A step outliving its lease would let an admin bulk cycle start a second Turn_Step.
3. **Admin bulk requests.** `POST /api/admin/cycles/bulk` is synchronous; the bound kept it bounded.
4. **Cutover overlap.** Admin bulk cycles do not take the scheduler mutex and could start a cutover while a scheduler step ran; a short step kept that window small.
5. **Player contention.** Each charged action takes the finance-writer lock, its own `users` row and finally the global per-cycle audit-sequence lock that player purchases also take.
6. **Memory.** Not a factor.

Each of (1)–(5) is now bounded differently, as below.

## Design

- **Deadline (guarantee).** The step keeps starting turns until min(step start + `AUTOMATON_TURN_STEP_MAX_MS`, next scheduled job − `AUTOMATON_TURN_STEP_SCHEDULE_MARGIN_MS`), but never less than 300 s (`TURN_STEP_MIN_BUDGET_MS`, the old limit as a floor for a late settlement). The next job comes from the configured cron schedules (`services/cycle/schedulerWindow.ts`), so the automaton module never imports the scheduler; with the scheduler off, the cap applies. Day-of-week restrictions are ignored, which can only make the deadline earlier. Schedules whose minute or hour is not a plain integer (intervals such as `*/30 * * * *`) are left out with a warning, which makes the deadline later: a job on such a schedule would queue behind the Turn_Step until the cap. The ACC and PRD defaults are all fixed daily times. On the default schedule the 6 h cap binds: after the 00:00 settlement the deadline is about 06:00 UTC (`deadline=cap`, `budgetMs=21600000`), earlier than the 08:00 league job − 15 min (07:45). The schedule term binds only when a step starts less than 6 h 15 min before the next job, for example after a late, admin-triggered settlement. In-flight turns finish within their own 60-action / 10 s Turn_Budget. Stables not started are `skipped` / `step_budget_exhausted` with one "Turn_Step deadline reached" alert.
- **Bounded concurrency (throughput).** `AUTOMATON_TURN_CONCURRENCY` turns run in parallel, clamped to ⌊(`DB_POOL_MAX` − 5) / 2⌋ (two connections per turn, five always free for players). Turns start in ascending `User.id` order. Each Automaton is its own user and the shared locks are taken in one consistent order, so parallel turns cannot deadlock each other. The first infrastructure error stops new starts and is rethrown, which the non-fatal wrapper alerts as before.
- **Lock order with standings placement.** The unified standings creation rule (`STANDINGS_CREATION_RULE.md`) ships on the same branch: robot creation writes no standings, and every placement runs inside the subscription or team-registration transaction under the per-mode Bronze lock. The former unlocked bronze pick in robot creation, which could skew the distribution under parallel opening builds, is gone. The combined order is `(4, 1)` shared → own `users` row → own rows and `(2, robotId)` → `(3, cycle)` → `(5, teamId)` ascending → mode/tier lock in canonical mode order (`standingPlacement.ts` header). Only `(3, cycle)` and the mode/tier locks are shared between stables. A subscription that waits for a mode lock while holding `(3, cycle)` waits on a holder that never waits for `(3, cycle)` (team registration takes no audit lock, purchases take no mode lock), and mode locks are always taken in canonical order, so no wait cycle exists. Placement also stays within the two connections per turn: the subscription path reads the audit cycle before it opens its transaction, and nothing in placement uses the global client. `tests/integration/automatonTurnStandingsConcurrency.test.ts` runs six Duo and Trio stables that register teams and subscribe in one step at concurrency 3 while another connection holds every Bronze lock most of the time.
- **Heartbeat lease.** 120 s TTL, renewed every 30 s with a conditional update; a lost lease stops new starts and alerts `TURN_STEP_LEASE_LOST`. A crashed holder now blocks others for at most 2 min.
- **Mid-step cutover guard.** Before each stable the step re-reads the cutover state; once a cutover is seen, the rest are `skipped` / `cutover_in_progress` with one alert, and settlement continues. The cutover alert is raised even when the lease is lost later in the same step (then both alerts fire). Turns already in flight keep running: their financial writes either commit before the cutover takes the exclusive finance lock or fail closed, so up to `concurrency` turns (instead of one) can end `failed` with an alert in that case.

Unchanged: the per-turn budget, Turn_Record idempotency and request keys (a retry charges nothing), the call sites and their non-fatal behaviour, and the `automaton_turns` columns (no migration).

Rejected: a continuation pass after the deadline (it would overlap battle jobs and needs new re-open semantics for final Turn_Records); a larger fixed constant (still fails silently at a larger population and ignores the schedule); hot-path throughput fixes (finance-critical shared purchase path, needs its own spec); running the step outside the settlement job (purchases would overlap battle jobs); fair rotation and bulk skip marking (skips are now exceptional; both stay open follow-ups).

## Configuration

| Variable | Default | Bounds | Meaning |
|---|---|---|---|
| `AUTOMATON_TURN_CONCURRENCY` | 3 | 1–8 | Turns in parallel; effective = clamp(⌊value⌋, 1, max(1, ⌊(`DB_POOL_MAX` − 5) / 2⌋)). `1` = sequential (kill switch) |
| `AUTOMATON_TURN_STEP_MAX_MS` | 21 600 000 (6 h) | 300 000–82 800 000 | Cap from step start; the only bound when the scheduler is off |
| `AUTOMATON_TURN_STEP_SCHEDULE_MARGIN_MS` | 900 000 (15 min) | 0–7 200 000 | Stop starting turns this long before the next scheduled job |

Out-of-range or non-numeric values fall back to the default (`config/env.ts`). With the default `DB_POOL_MAX=15` the concurrency limit is 5.

## Local heavy measurements

> **These are local Apple Silicon numbers (Apple M5 Max, 18 cores) with PostgreSQL 17 in Docker on the same machine. They are NOT ACC timings.** ACC runs on a 2 vCPU VPS with PostgreSQL on the same host; there, parallel turns compete for two cores and the gain will be smaller. ACC must be checked after deploy (below).

Heavy suite `tests/integration/automatonMultiSeason.test.ts` (205 repository Catalogue_Entries, two seasons, one rollover), commit `4284e969`, 14 October 2026, on the dedicated database `armouredsouls_heavy_turnbudget`, one run at a time, from `app/backend`:

```
DATABASE_URL=postgresql://armouredsouls:password@localhost:5432/armouredsouls_heavy_turnbudget AUTOMATON_TURN_CONCURRENCY=1 pnpm exec jest --config jest.config.heavy.js --forceExit tests/integration/automatonMultiSeason.test.ts
DATABASE_URL=postgresql://armouredsouls:password@localhost:5432/armouredsouls_heavy_turnbudget AUTOMATON_TURN_CONCURRENCY=3 pnpm exec jest --config jest.config.heavy.js --forceExit tests/integration/automatonMultiSeason.test.ts
```

Both runs: 3 tests passed, exit 0; every step 205 processed, 0 failed, 0 skipped (no `step_budget_exhausted`), 0 upkeep issues, deadline source `cap` (scheduler off in tests). Wall time 461 s at c=1 and 237 s at c=3. Alerts: 101 `automaton_negative_balance` in each run (no battle income in the simulation), no deadline alert, no deadlock or transaction errors.

"Peak connections" is the highest `pg_stat_activity` count for the database, sampled every 500 ms during each settlement. It includes idle pool connections, the admin API harness and the sampler itself, so it is an upper bound, not the number of busy turns.

Per step:

| Step | Trigger | c=1 step | c=3 step | c=1 s/Automaton | c=3 s/Automaton | Charged actions | Robots bought | `turn_budget_exhausted` (c=1 / c=3) | Peak connections (c=1 / c=3) | Max turn ms (c=1 / c=3) |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| s1 prep 1 (opening build) | preparation | 144.5 s | 65.8 s | 0.705 | 0.321 | 2534 | 403 | 0 / 0 | 7 / 11 | 3803 / 1394 |
| s1 prep 2 | preparation | 2.2 s | 0.9 s | 0.011 | 0.005 | 0 | 0 | 0 / 0 | 5 / 11 | 14 / 14 |
| s1 cycles 1–5 | settlement | 3.0–3.4 s | 1.4–1.5 s | 0.014–0.017 | 0.007 | 20–31 | 0 | 0 / 0 | 5 / 10–11 | 65–138 / 102–180 |
| s1 boundary → s2 (opening build) | season_open | 138.7 s | 62.0 s | 0.676 | 0.303 | 2544 | 403 | 0 / 0 | 9 / 13 | 963 / 1301 |
| s2 prep 1–2 | preparation | 2.7 s | 0.9 s | 0.013 | 0.004 | 0 | 0 | 0 / 0 | 5 / 12 | 17 / 14–21 |
| s2 cycles 1–5 | settlement | 3.4–4.6 s | 1.1–1.7 s | 0.017–0.022 | 0.005–0.008 | 10–41 | 0 | 0 / 0 | 5–6 / 10–12 | 68–151 / 69–170 |

Per Turn_Trigger (the suite's summary line):

| Trigger | Steps | c=1 total | c=3 total | c=1 s/Automaton | c=3 s/Automaton | Peak connections (c=1 / c=3) |
|---|---:|---:|---:|---:|---:|---:|
| preparation | 4 | 152.2 s | 68.5 s | 0.186 | 0.084 | 7 / 12 |
| settlement | 10 | 35.8 s | 13.9 s | 0.017 | 0.007 | 6 / 12 |
| season_open | 1 | 138.7 s | 62.0 s | 0.676 | 0.303 | 9 / 13 |

Locally, c=3 made the opening builds about 2.2× faster. Logs: `.agents/tasks/turn-budget/logs/heavy-c1.log` and `heavy-c3.log` (local, not committed).

**Default concurrency decision.** Rule: keep 3 when the c=3 run has 0 failed turns and 0 upkeep issues, its opening-build steps are not slower than c=1, and its opening-build `turn_budget_exhausted` stops are no more than c=1's + 5 % of the population (10). Result: 0 failed, 0 upkeep issues, 65.8 s vs 144.5 s and 62.0 s vs 138.7 s, 0 vs 0 stops. **The default stays 3.**

## ACC capacity (estimate)

This is an estimate from the incident rate, not a measurement. At the observed ~1.6 s per opening build, sequentially:

| Opening builds in one step | Sequential time |
|---:|---:|
| 205 | ~5.5 min |
| 1 000 | ~27 min |
| 10 000 | ~4.4 h |

All fit inside the 6 h window after the 00:00 settlement (on the default schedule the 6 h cap binds, deadline about 06:00 UTC; the 08:00 league job − 15 min would be 07:45). Concurrency 3 on 2 vCPU is expected to help by about 1.5–2.5× at best and is not needed for the guarantee; the deadline alone serves the night. Steady-state settlement turns are about 40× cheaper than opening builds.

## Post-deploy ACC check

On the first night after deploy, read `pm2 logs armouredsouls-backend` for the `[automaton-turns]` line of the settlement Turn_Step:

- `completed` equals `processed` (205 or the current Active_Automaton count) and `skipped=none`;
- `concurrency=3`, `deadline=cap`, and `budgetMs=21600000` (6 h from step start, about 00:00 → 06:00); `deadline=schedule` is expected only when the step starts less than 6 h 15 min before the next job, such as after a late settlement;
- `durationMs`: add it to this note as the first ACC measurement;
- no "Turn_Step deadline reached", `AUTOMATON_CUTOVER_IN_PROGRESS` or `TURN_STEP_LEASE_LOST` alert in the monitoring channel.

If parallel turns misbehave, set `AUTOMATON_TURN_CONCURRENCY=1` and restart the backend; the deadline still serves the whole night.

## Follow-ups

- Done on the combined branch (both changes together): `automatonTurnConcurrency.test.ts`, the new `automatonTurnStandingsConcurrency.test.ts` (no Bronze instance above `maxPerInstance`) and the heavy tier pass. The heavy `automatonSeasonRollover.test.ts` fixture gave two stables the same blueprint robot name; their parallel opening builds then raced on `robots.name` and one turn failed with P2002, so the fixture now uses distinct names, as catalogue entries must. Two admin-created stables that share a blueprint robot name hit the same race in production: one turn is recorded `failed` with an alert and the next turn picks "Mk II" (the accepted residual risk of parallel turns).
- Still open from spec 57 `review/SCALING.md` §6: fair rotation, fewer statements per charged action, bulk skip marking, batched admin operations.
- The 00:30 daily report may show settlement's previous duration while a long step is still running (cosmetic).
