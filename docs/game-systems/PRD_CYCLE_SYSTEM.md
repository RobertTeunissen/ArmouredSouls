# Product Requirements Document: Cycle System

**Project**: Armoured Souls  
**Document Type**: Product Requirements Document (PRD)  
**Version**: v2.0  
**Last Updated**: April 9, 2026  
**Status**: ✅ Implemented  
**Owner**: Robert Teunissen  
**Epic**: Game Systems — Time Management

**Revision History**:

v1.0 (Feb 2026): Initial PRD — monolithic 15-step cycle design  
v1.1 (Mar 2026): Added KotH cycle, tag team odd-cycle logic  
v2.0 (Apr 2026): Major rewrite — documented production scheduler (5 independent cron jobs), admin bulk cycle, corrected schema to match implementation, removed references to non-existent docs, and consolidated legacy cycle-process documentation into this PRD

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
- Tag team battles (odd cycles only)
- KotH battles (Mon/Wed/Fri only)
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
08:00 Tournament Cycle
12:00 Tag Team Cycle (battles on odd cycles only)
16:00 KotH Cycle (Mon/Wed/Fri only)
20:00 League Cycle
23:00 Settlement (passive income, operating costs, counters, snapshot)
```

4-hour gaps between jobs provide ample separation.

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
| 2 | Execute tag team battles (odd cycles only; skipped on even) |
| 3 | Rebalance tag team leagues |
| 4 | Schedule tag team matchmaking (48h lead time) |

### KotH Cycle (`executeKothCycle`)

| Step | Action |
|------|--------|
| 1 | Repair all robots |
| 2 | Execute scheduled KotH battles |
| 3 | Schedule KotH matchmaking for next Mon/Wed/Fri at 16:00 UTC |

### Settlement (`executeSettlement`)

| Step | Action |
|------|--------|
| 1 | Calculate and credit passive income (merchandising, streaming) |
| 2 | Calculate and debit operating costs (facilities, roster) |
| 3 | Log end-of-cycle balances for all users |
| 4 | Increment cycle counters (`cyclesInCurrentLeague`, `cyclesInTagTeamLeague`, `totalCycles`) |
| 5 | Create analytics snapshot (CycleSnapshot) |
| 6 | Flush practice arena daily stats |
| 7 | Auto-generate users (if configured) |

---

## 5. Admin Bulk Cycle

The admin bulk endpoint (`POST /api/admin/cycles/bulk`) runs all game phases in a single sequential pass. Step ordering differs from the scheduler — notably, repairs happen *after* battles rather than before.

### Step Sequence

| Step | Action | Condition |
|------|--------|-----------|
| 1 | Execute league battles (1v1) | Always |
| 2 | Repair all robots (post-league) | Always |
| 3 | Execute tag team battles | Odd cycles only |
| 4 | Repair all robots (post-tag-team) | Always |
| 4.5 | Execute KotH battles | KotH days + `includeKoth=true` |
| 4.6 | Repair all robots (post-KotH) | If KotH battles ran |
| 4.7 | KotH matchmaking | KotH days |
| 5 | Tournament execution/scheduling | `includeTournaments=true` |
| 6 | Repair all robots (post-tournament) | Always |
| 7 | Rebalance leagues | Always |
| 7.5 | Rebalance tag team leagues | Odd cycles only |
| 8 | Auto-generate users | `generateUsersPerCycle=true` |
| 9 | League matchmaking (1v1) | Always |
| 9.5 | Tag team matchmaking | Odd cycles only |
| 10 | Finalize cycle counters | Always |
| 11 | Calculate passive income & operating costs | Always |

KotH day-of-week is simulated during bulk execution:  
`simulatedDayOfWeek = ((cycleNumber - 1) % 7) + 1` (1=Mon … 7=Sun)

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

| Event Type | Data Extracted |
|------------|---------------|
| `battle_complete` | Credits, streaming, prestige, fame, damage, wins/losses |
| `passive_income` | Merchandising income |
| `operating_costs` | Facility costs, roster costs |
| `robot_repair` | Repair costs |
| `weapon_purchase` | Weapon spending |
| `facility_upgrade` | Facility spending |
| `attribute_upgrade` | Attribute spending |
| `robot_purchase` | Robot spending |
| `cycle_end_balance` | End-of-cycle balance per user |

### Backfill Capability

Snapshots can be reconstructed from AuditLog at any time:

```
POST /api/admin/snapshots/backfill
```

Deletes existing snapshots and recreates them from AuditLog events. Use cases: fix corrupted snapshots, update aggregation logic, regenerate historical data.

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

1. **AuditLog is source of truth** — all events written during execution, immutable once written
2. **CycleSnapshot is derived** — 100% computed from AuditLog, can be regenerated at any time
3. **Backfill ensures consistency** — detects and fixes corrupted snapshots

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

Repair Bay discount: 5% per level, max 50%. Medical Bay reduces the 2.0× critical multiplier.
