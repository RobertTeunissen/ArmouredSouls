# Product Requirements Document: Cycle System

**Project**: Armoured Souls  
**Document Type**: Product Requirements Document (PRD)  
**Version**: v2.1  
**Last Updated**: October 23, 2026 (scheduler run history, Cycle Controls)  
**Status**: ✅ Implemented  
**Owner**: Robert Teunissen  
**Epic**: Game Systems — Time Management

**Revision History**:

v1.0 (Feb 2026): Initial PRD — monolithic 15-step cycle design  
v1.1 (Mar 2026): Added KotH cycle, tag team odd-cycle logic  
v2.0 (Apr 2026): Major rewrite — documented production scheduler (5 independent cron jobs), admin bulk cycle, corrected schema to match implementation, removed references to non-existent docs, and consolidated legacy cycle-process documentation into this PRD  
v2.1 (Oct 23, 2026): §5.1 — manual runs in the background, handlers registered with the scheduler disabled, persistent run history (`scheduler_processes`, `scheduler_job_runs`), interrupted and missed runs; bulk runs under the scheduler lock

---

**Related Documents**:
- [PRD_AUDIT_SYSTEM.md](PRD_AUDIT_SYSTEM.md) — Audit log architecture
- [PRD_BATTLE_DATA_ARCHITECTURE.md](PRD_BATTLE_DATA_ARCHITECTURE.md) — Battle data structure
- [PRD_ECONOMY_SYSTEM.md](PRD_ECONOMY_SYSTEM.md) — Economic systems and repair cost formulas
- [PRD_MATCHMAKING.md](PRD_MATCHMAKING.md) — Matchmaking algorithm
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) — Complete database schema

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Background & Context](#2-background--context)
3. [Production Scheduler Architecture](#3-production-scheduler-architecture)
4. [Scheduler Job Details](#4-scheduler-job-details)
5. [Admin Bulk Cycle](#5-admin-bulk-cycle)
6. [Database Schema](#6-database-schema)
7. [Cycle Snapshot Architecture](#7-cycle-snapshot-architecture)
8. [AuditLog vs CycleSnapshot](#8-auditlog-vs-cyclesnapshot)
9. [API Endpoints](#9-api-endpoints)
10. [Performance](#10-performance)
11. [Data Consistency](#11-data-consistency)

---

## 1. Executive Summary

The Cycle System is the game's time progression mechanism. A "cycle" represents one complete round of game activities — battles, income, expenses, repairs, promotions — and provides the temporal structure for the economy and progression systems.

Data consistency is maintained through the **AuditLog → CycleSnapshot** architecture: all events are written to the immutable AuditLog during execution, then aggregated into a CycleSnapshot for fast analytics queries.

---

## 2. Background & Context

### What is a Cycle?

A **cycle** is the fundamental unit of time in Armoured Souls. Each cycle processes:
- League battles (1v1)
- Tag team battles (daily)
- KotH battles (daily)
- Tournament matches
- Passive income and operating costs
- Robot repairs
- League promotions/demotions
- Matchmaking for next cycle

### Two Execution Modes

| Mode | Source | Use Case |
|------|--------|----------|
| **Production Scheduler** | `cycleScheduler.ts` | 5 independent cron jobs running on UTC schedule |
| **Admin Bulk Cycle** | `adminCycleService.ts` | Single sequential pass via `POST /api/admin/cycles/bulk` for testing/simulation |

---

## 3. Production Scheduler Architecture

The scheduler registers 5 independent cron jobs, each with its own step sequence. All jobs share an in-memory mutex lock (`acquireLock()`) to prevent overlap.

### Daily Timeline

```
UTC   Job
08:00 1v1 League Cycle
09:00 Team Battle 2v2 League (reserved)
10:00 Tournament Cycle
11:00 Tag Team Cycle (daily)
13:00 KotH Cycle (daily)
14:00 Team Battle 3v3 League (reserved)
15:00 Team Battle 2v2 Tournament (reserved)
17:00 Grand Melee (reserved)
18:00 Team Battle 3v3 Tournament (reserved)
00:00 Settlement (passive income, operating costs, counters, snapshot)
```

Heavy modes (1v1 League, KotH) are spaced 5 hours apart. Reserved slots are no-op stubs until subsequent specs register real handlers.

### Key Source Files

- Scheduler: `app/backend/src/services/cycle/cycleScheduler.ts`
- Admin bulk: `app/backend/src/services/admin/adminCycleService.ts`
- Snapshot service: `app/backend/src/services/cycle/cycleSnapshotService.ts`
- Repair service: `app/backend/src/services/robot/robotRepairService.ts`

---

## 4. Scheduler Job Details

### League Cycle (`executeLeagueCycle`)

| Step | Action |
|------|--------|
| 1 | Repair all robots |
| 2 | Execute scheduled league battles |
| 3 | Rebalance leagues (promote/demote) |
| 4 | Schedule league matchmaking (24h lead time) |

### Tournament Cycle (`executeTournamentCycle`)

| Step | Action |
|------|--------|
| 1 | Repair all robots |
| 2 | Execute tournament matches for active tournaments |
| 3 | Advance winners to next round |
| 4 | Auto-create next tournament if none active |

### Tag Team Cycle (`executeTagTeamCycle`)

| Step | Action |
|------|--------|
| 1 | Repair all robots |
| 2 | Execute tag team battles |
| 3 | Rebalance tag team leagues |
| 4 | Schedule tag team matchmaking (24h lead time) |

### KotH Cycle (`executeKothCycle`)

| Step | Action |
|------|--------|
| 1 | Repair all robots |
| 2 | Execute scheduled KotH battles |
| 3 | Schedule KotH matchmaking for next day at 13:00 UTC |

### Settlement (`executeSettlement`)

| Step | Action |
|------|--------|
| 1 | Calculate and credit passive income (merchandising only; Streaming Studio remains per-battle `streaming_revenue`) |
| 2 | Calculate and debit operating costs (facilities, roster) |
| 3 | Log end-of-cycle balances for all users |
| 4 | Increment cycle counters (`cyclesInCurrentLeague`, `cyclesInTagTeamLeague`, `totalCycles`) |
| 5 | Create analytics snapshot (CycleSnapshot) |
| 6 | Flush practice arena daily stats |
| 7 | Top up generated stables to `GENERATED_STABLE_TARGET` (default 150; normally nothing to do — the first preparation day after a rollover builds them; see `PRD_AUTO_USER_GENERATION.md`) |
| 8 | Automaton Turn_Step after the season counter advances, skipped on the boundary settlement (Spec #55; see "Automaton Turn_Step" below) |

---

### Spec #53 settlement and financial evidence contract

`User.currency` is the balance field used by settlement. `Settlement_Service` is the only mutating implementation: `cycleScheduler.ts`, `adminCycleService.ts`, and the supported `/api/admin/daily-finances/process` path delegate to it rather than maintaining separate balance updates. For each applicable stable and `cycleNumber`, it creates exactly two financial components in a deterministic order:

1. one `passive_income` `FinancialLedger`/`AuditLog` `financial_transaction` pair; and
2. one `operating_costs` pair.

Both components are written even when their amount is zero. A zero-valued component records the completed formula calculation and unchanged `balanceAfter`; it is not an extra currency delta. Each component carries its stable/cycle/component identity and typed `Financial_Breakdown`, including Merchandising Hub, prestige/roster-capacity, facility/roster operating-cost, and rounding inputs. Per-battle Streaming Studio revenue remains `streaming_revenue`, not settlement income.

The paired `FinancialLedger` row is the accounting/reporting record and the paired `AuditLog` row with `eventType` `financial_transaction` is the operational/security record. They share `financialEventId`, are written atomically with the `User.currency` update, and are idempotent on a stable/cycle/component identity. Existing `passive_income`, `operating_costs`, cycle snapshots, and admin response fields remain compatible during this capture-only change. The generic `/api/admin/audit-log` endpoint can query `financial_transaction` rows; `/api/admin/audit-log/repairs` remains focused on subtype-bearing `robot_repair` rows.

Rerunning a settlement returns the existing component results and does not pay or charge twice. A failed paired write rolls back the component and its balance change. The existing snapshot backfill remains a derived snapshot operation; it is not permission to reconstruct, pair, or normalize legacy null-identity financial history.

## 5. Admin Bulk Cycle

The admin bulk endpoint (`POST /api/admin/cycles/bulk`) runs all game phases in a single sequential pass. Each event runs as a self-contained block (repair → execute → rebalance → matchmaking) in slot map order, mirroring the production cron handlers.

### Step Sequence

| Step | Action | Condition |
|------|--------|-----------|
| 1 | 1v1 League (repair → execute → rebalance → matchmaking 24h lead) | Always |
| 2 | Team 2v2 League (reserved stub) | Always (no-op log) |
| 3 | 1v1 Tournament (repair → execute/advance → auto-create) | Always |
| 4 | Tag Team (repair → execute → rebalance → matchmaking 24h lead) | Always |
| 5 | KotH (repair → execute → matchmaking 24h lead) | Always |
| 6 | Team 3v3 League (reserved stub) | Always (no-op log) |
| 7 | Team 2v2 Tournament (reserved stub) | Always (no-op log) |
| 8 | Grand Melee (reserved stub) | Always (no-op log) |
| 9 | Team 3v3 Tournament (reserved stub) | Always (no-op log) |
| 10 | Settlement (user gen → finances → cycle counters → snapshots → orphan cleanup) | Always |

The bulk run takes the scheduler's lock (`runExclusive('bulkCycles', …)` in `adminBulkCycleRunService.ts`), so it never overlaps a cron or manual job, and is recorded as a `bulkCycles` run. With `background: true` the endpoint answers 202 with the queued run at once; without it the call waits and returns the full result. A second bulk start while one is queued or running answers 409.

### 5.1 Manual runs and run history (Cycle Controls)

- **Handlers are always registered.** `initScheduler` registers the ten handlers and their state whether or not `SCHEDULER_ENABLED` is true; only cron registration depends on it. A job can therefore be run by hand locally and in CI.
- **Manual runs go through `runJob`**, the same path as cron: lock, preparation gate, state, notifications. `startManualRun(jobName, userId)` records the run, returns at once and runs the job in the background; it refuses with `SCHEDULER_JOB_ALREADY_ACTIVE` (409) when that job is already queued or running. `triggerJob` (waits) remains for `POST /api/admin/scheduler/trigger/:jobName`.
- **Persistent history.** `scheduler_processes` holds one row per backend start (with a 60 s heartbeat and an optional `DEPLOY_TAG`); `scheduler_job_runs` holds every run: trigger (`cron`, `manual`, `resume`, `bulk`), status `queued` → `running` → `success` / `failed` / `skipped` (preparation gate), duration, a small result summary (`JobContext`; settlement adds the closed `cycleNumber`) or the error. Writes are non-fatal and never fail or delay a job. At startup, runs an earlier process left `queued` or `running` become `interrupted`, ending at that process's last heartbeat.
- **Missed runs** are derived, not stored (`schedulerMissedRuns.ts`): a daily slot with no cron or resumed run queued from 1 min before to 15 min after it, while the scheduler was enabled and after tracking started. A miss in the gap between two processes carries that downtime window.

Definitions and the page: `docs/guides/ADMIN_PANEL_GUIDE.md` §Cycle Controls.

---

## 6. Database Schema

### CycleMetadata

```prisma
model CycleMetadata {
  id          Int       @id @default(1)
  totalCycles Int       @default(0) @map("total_cycles")
  lastCycleAt DateTime? @map("last_cycle_at")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  @@map("cycle_metadata")
}
```

Singleton row (id=1). Tracks total cycles executed and last execution time. Concurrent execution is prevented by the scheduler's in-memory mutex lock.

### CycleSnapshot

```prisma
model CycleSnapshot {
  id          Int    @id @default(autoincrement())
  cycleNumber Int    @unique @map("cycle_number")
  triggerType String @map("trigger_type") @db.VarChar(20)

  startTime  DateTime @map("start_time")
  endTime    DateTime @map("end_time")
  durationMs Int      @map("duration_ms")

  stableMetrics Json @map("stable_metrics")
  robotMetrics  Json @map("robot_metrics")
  stepDurations Json @map("step_durations")

  totalBattles           Int    @default(0) @map("total_battles")
  totalCreditsTransacted BigInt @default(0) @map("total_credits_transacted")
  totalPrestigeAwarded   Int    @default(0) @map("total_prestige_awarded")

  createdAt DateTime @default(now()) @map("created_at")

  @@index([cycleNumber])
  @@index([startTime])
  @@map("cycle_snapshots")
}
```

---

## 7. Cycle Snapshot Architecture

### Data Flow

```
During cycle execution:
  → Events written to AuditLog (battle_complete, passive_income, operating_costs, robot_repair, etc.)

Settlement Step 5 (or admin bulk post-cycle):
  → Aggregate AuditLog events for this cycle
  → Create CycleSnapshot with pre-computed metrics
```

### StableMetrics Structure

```typescript
interface StableMetric {
  userId: number;
  username: string;
  stableName: string;

  // Battle activity
  battlesParticipated: number;
  wins: number;
  losses: number;
  draws: number;

  // Income
  totalCreditsEarned: number;
  streamingIncome: number;
  merchandisingIncome: number;

  // Expenses
  totalRepairCosts: number;
  operatingCosts: number;

  // Purchases
  weaponPurchases: number;
  facilityPurchases: number;
  attributeUpgrades: number;
  robotPurchases: number;

  // Reputation
  totalPrestigeEarned: number;
  totalFameEarned: number;

  // Balance
  balance: number;
}
```

### RobotMetrics Structure

```typescript
interface RobotMetric {
  robotId: number;
  robotName: string;
  userId: number;

  battles: number;
  wins: number;
  losses: number;
  draws: number;

  damageDealt: number;
  damageTaken: number;
  kills: number;
  destructions: number;

  eloChange: number;
  creditsEarned: number;
  fameChange: number;
  repairCosts: number;
  streamingRevenue: number;
}
```

### Snapshot Aggregation

The snapshot service (`cycleSnapshotService.ts`) aggregates from these AuditLog event types:

| Event Type | Compatibility data extracted |
|------------|-------------------------------|
| `battle_complete` | Combat/display values: fame, damage, and wins/losses |
| `passive_income` | Merchandising income compatibility data |
| `operating_costs` | Facility and roster-cost compatibility data |
| `robot_repair` | Repair domain data, including subtype-bearing charges |
| `weapon_purchase` | Weapon-spending compatibility data |
| `facility_upgrade` | Facility-spending compatibility data |
| `attribute_upgrade` | Attribute-spending compatibility data |
| `robot_purchase` | Robot-spending compatibility data |
| `cycle_end_balance` | End-of-cycle balance compatibility data |

This table does not define identified paired-capture financial accounting sources. Credits amounts, balances, and taxonomy use reconciled `FinancialLedger`/`financial_transaction` pairs by `financialEventId`; Repair_Spend uses `robot_repair`; prestige uses `prestige_change`.

### Backfill Capability

Snapshot regeneration is a derived-projection repair only:

```
POST /api/admin/snapshots/backfill
```

It may replace a `CycleSnapshot` using retained domain events, but it must never create, pair, relabel, normalize, or infer `FinancialLedger`, `financial_transaction`, repair, or prestige history. In particular, legacy null-identity financial history is never reconstructed.

---

## 8. AuditLog vs CycleSnapshot

### Why Both Tables?

| | AuditLog | CycleSnapshot |
|---|----------|---------------|
| **Role** | Complete event history | Pre-aggregated summaries |
| **Granularity** | One row per event | One row per cycle |
| **Mutability** | Immutable | Derived (can be regenerated) |
| **Query speed** | Slower (many rows) | Fast (< 1ms) |
| **Use case** | Debugging, audit trail | Dashboards, charts, analytics |

### Only in CycleSnapshot

- Cycle timing data (`startTime`, `endTime`, `durationMs`)
- Step execution times (performance monitoring)
- Pre-aggregated per-user and per-robot totals
- Summary statistics (`totalBattles`, `totalCreditsTransacted`, `totalPrestigeAwarded`)

---

## 9. API Endpoints

### Admin: Bulk Cycle Execution

```
POST /api/admin/cycles/bulk
Authorization: Bearer <admin-token>
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `cycles` | int | 1 | Number of cycles to run (1–100) |
| `includeTournaments` | bool | true | Enable tournament processing |
| `includeKoth` | bool | true | Enable KotH processing |
| `generateUsersPerCycle` | bool | false | Enable AI user generation |

### Admin: KotH Manual Trigger

```
POST /api/admin/koth/trigger
Authorization: Bearer <admin-token>
```

Executes the full KotH cycle on demand (repair → battles → matchmaking).

### Admin: Backfill Snapshots

```
POST /api/admin/snapshots/backfill
Authorization: Bearer <admin-token>
```

Regenerates all CycleSnapshots from AuditLog.

### Analytics: Cycle Summary

```
GET /api/analytics/stable/:userId/summary?lastNCycles=10
```

Returns per-cycle breakdown (battle credits, streaming, merchandising, repairs, operating costs, balance) for the specified user.

---

## 10. Performance

### Cycle Execution Time

**Target**: < 3 minutes for 100 robots

Typical breakdown:
- League battles: 45–60s
- Tournament battles: 30–45s
- Tag team battles: 15–30s
- Settlement + snapshot: 10–20s

### Snapshot Query Performance

**Target**: < 1ms for single cycle query

Achieved through one row per cycle, pre-aggregated metrics, and indexed `cycle_number` column.

---

## 11. Data Consistency

### Guarantees

1. **Domain AuditLog events are immutable inputs** — they feed compatibility projections but are not a universal financial source
2. **CycleSnapshot is derived** — it may be regenerated without mutating source events or reconstructing historical financial pairs
3. **Identified paired accounting stays separate** — Credits use reconciled `FinancialLedger`/`financial_transaction` pairs, Repair_Spend uses `robot_repair`, and prestige uses `prestige_change`

### Battle Readiness Criteria

For a robot to be included in matchmaking:

1. `currentHP ≥ 80%` of maxHP
2. Has a main weapon equipped
3. Not the "Bye Robot"
4. Belongs to an active league instance

### Repair Cost Formula

Per [PRD_ECONOMY_SYSTEM.md](PRD_ECONOMY_SYSTEM.md):

```
base_repair = sum_of_all_23_attributes × 100
damage_pct  = damage_taken / max_hp
multiplier  = 2.0 (destroyed) | 1.5 (HP < 10%) | 1.0 (normal)
final_cost  = base_repair × damage_pct × multiplier × (1 - repair_bay_discount)
```

Repair Bay discount: 6 × min(Level, 10) percent, the same for every roster size (Season 2, #525; was Level × (5 + owned robots) up to 90%). The quote is rounded per robot; manual repairs charge floor(quote × 0.5).

## Spec #53 deployed capture and reconciliation boundary

The financial contract is forward-only and active with the deployed backend: every new current-economy mutation writes its required atomic pair immediately, with no ACC-specific activation, cycle gate, or operational command. Rows without `financialEventId` remain queryable `Legacy_Record` history where retained; they are not rewritten, paired, relabelled, or reconstructed. No service may substitute a `battle_complete` payload, cached repair quote, or current formula for a missing identified paired-capture event, and no one-off historical reconstruction script may be added.

Reconciliation checks identified paired `FinancialLedger`/`AuditLog` records by `financialEventId`, duplicate identities, amount and `balanceAfter` consistency, valid taxonomy and `Financial_Breakdown`, repair subtype/domain pairs, both settlement components including zero-valued rows, prestige `sourceEventId` records, and direct `User.currency` writers outside `Credit_Mutation_Service`. Legacy null-identity rows are excluded from the paired-evidence completeness claim rather than altered to fill gaps.

For financial questions, the paired records are the `Canonical_Source`; for repair spend, use `AuditLog` `robot_repair` rows with `creditsCharged` and `repairType`; for prestige, use `prestige_change` rows; for subscriptions and lifecycle, use their existing Booking Office and archive/lifecycle records. `Income_Dashboard`, `Cycle_Summary`, financial-page UI, and player-guide content are outside this capture change and remain consumers/regression surfaces for a later `Financial_Page_Follow_On`.

## Season Phase Gating (Spec #45)

The Settlement_Job reads the current Season_Phase before any other step.

**During a Preparation_Phase** it advances the preparation counter and returns before step 1, skipping passive income, operating costs, end-of-cycle balance logging, the `cycle_metadata.total_cycles` increment, the `cyclesInTier` increment, analytics snapshot creation, practice arena stat flushing, achievement rarity refresh, and the leaderboard refresh. The global cycle counter is therefore unchanged across a preparation window — preparation cycles are not game cycles and produce no financial ledger or snapshot rows.

It does run two steps before returning: the generated-stable top-up (the first preparation day after a rollover rebuilds the whole population, see `PRD_AUTO_USER_GENERATION.md`), then the Automaton `preparation` Turn_Step.

Gating is an early return rather than per-step conditionals, so the skip list cannot drift out of sync as settlement steps are added.

**At the season boundary** settlement runs all its normal steps, then advances the season cycle counter, then invokes the Season_Rollover. The final cycle of a season therefore settles completely — income paid, battles resolved, snapshot written — before anything is archived or purged. Season 0 is exempt and never triggers an automatic rollover regardless of its cycle count.

See `PRD_SEASON_SYSTEM.md` for the rollover stages and reset scope.

## Automaton Turn_Step (Spec #55)

Active_Automatons act once per cycle in a Turn_Step (`runTurnStep` in `services/automaton/automatonTurnService.ts`). It always runs **after** the Serialized_Cycle_Cutover has completed, so Automaton purchases use the normal current-cycle write path and book to the new cycle, exactly like a human buying after settlement. It is never part of the cutover, `logCycleEndBalances` or the settlement Financial_Pairs.

| Call site | Placement | Turn_Trigger / Turn_Slot |
|---|---|---|
| `cycleScheduler.ts` `executeSettlement`, Preparation_Phase | after `advancePreparationCycle()`, before the early return | `preparation` / `preparationCyclesCompleted` |
| `cycleScheduler.ts` `executeSettlement`, competitive | last step, after `advanceCompetitiveCycle()`, only when no season boundary was reached | `settlement` / the closed global cycle number |
| `seasonRolloverService.ts` Stage 5 | after `reclaimSpace()` in the new season | `season_open` / 0 |
| `adminCycleService.ts` bulk preparation loop | after each `advancePreparationCycle()` | `preparation` / `preparationCyclesCompleted` |
| `adminCycleService.ts` bulk competitive loop | after `completeSerializedCycleCutover` and the counters step | `settlement` / the closed cycle number; result in the bulk response's `automatonTurns` |

On the boundary settlement no `settlement` turn runs; the rollover's Stage 5 gives every Automaton its `season_open` turn instead. If the rollover fails, no Automaton turn runs for that settlement and the retried rollover runs Stage 5.

Every call is non-fatal: a failing Turn_Step is logged and alerted and never fails settlement, the bulk cycle or the rollover. A heartbeat lease in `automaton_program_settings.turn_step_lease_until` (120 s TTL, renewed every 30 s) serialises scheduler and admin bulk Turn_Steps across processes; `assertNoCutoverInProgress` guards the step start, and before each stable the step re-checks for a cutover and records the rest `skipped` / `cutover_in_progress` if one has started.

**Turn_Budget** (`services/automaton/turnBudget.ts`):

| Limit | Value | On reach |
|---|---|---|
| Charged actions per Automaton_Turn | 60 (`TURN_ACTION_LIMIT`) | turn ends `completed`, reason `turn_budget_exhausted` |
| Wall clock per Automaton_Turn | 10 s (`TURN_TIME_BUDGET_MS`) | same |
| Turn_Step deadline | min(step start + `AUTOMATON_TURN_STEP_MAX_MS` [6 h], next scheduled job − `AUTOMATON_TURN_STEP_SCHEDULE_MARGIN_MS` [15 min]), at least 300 s (`TURN_STEP_MIN_BUDGET_MS`) | no new turn starts; remaining stables `skipped` with `step_budget_exhausted`, "Turn_Step deadline reached" alert |
| Turns in parallel | `AUTOMATON_TURN_CONCURRENCY` (default 3), clamped to ⌊(`DB_POOL_MAX` − 5) / 2⌋ | — |

Free_Upkeep counts against the per-turn time budget but not the action limit. The deadline replaces the former fixed 300 s Turn_Step budget (spec 55 R7.10, superseded): after the 00:00 settlement the next scheduled job is the 08:00 league job (07:45 after the margin), which is later than the 6 h cap, so on the default schedule the cap binds and the step may start turns until about 06:00 UTC. The schedule term binds only when a step starts less than 6 h 15 min before the next job, such as after a late settlement. With the scheduler disabled (local runs, tests) the 6 h cap applies. The next job is computed from the configured cron schedules (`services/cycle/schedulerWindow.ts`), not from scheduler state; every cron form the scheduler accepts is honoured (including intervals such as `*/30 * * * *`); a day-of-week restriction is ignored, which can only make the deadline earlier. The Turn_Step still runs inside the settlement job, so other scheduler jobs queue behind it until it ends. Timings and the ACC capacity estimate: `docs/implementation_notes/AUTOMATON_TURN_STEP_DEADLINE.md`; product rules: `docs/game-systems/PRD_AUTOMATON_STABLES.md`.
