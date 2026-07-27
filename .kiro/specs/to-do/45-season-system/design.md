# Design Document

## Spec: Season System — 100-Cycle Competitive Seasons with Full Reset

This design uses the glossary of `requirements.md` verbatim. Domain concepts appear in `Pascal_Snake` (Season_Rollover, Image_Library); backticked identifiers are literal code artefacts quoted exactly as the code spells them (`competitiveCyclesCompleted`, `standings`, `cycleScheduler.ts`).

## Overview

The Season System introduces one new authority — the Season_Service — that every scheduled job consults before doing work, and one new operation — Season_Rollover — that archives, purges, and resets the world at a season boundary.

The architecture follows three principles:

1. **The Season_Service is a read-mostly gate.** It owns the `seasons` table and answers one question cheaply: what phase are we in and how far along. The Cycle_Scheduler asks this once per job invocation. No existing service learns about seasons; only the scheduler and a small number of surfaces do.
2. **Archive before destroy, verify between.** Season_Rollover is three ordered stages with a hard gate in the middle. Nothing is deleted until the archive is written and counted.
3. **Denormalize everything historical.** Archive rows hold text and numbers, never foreign keys to rows that the purge deletes. This is what lets the purge be unconditional and the archive permanent.

### Why Season_Zero exists

The production database is at cycle 118 with no season concept. Requirement 24 makes the existing timeline `seasonNumber` 0 with no fixed length, closed only by an explicit admin action. This avoids two failure modes: an automatic rollover firing on the next settlement because 118 already exceeds 100, and an archive that claims 118+ cycles of career totals were a 100-cycle season.

## Architecture

```
                     ┌─────────────────────────────┐
                     │      Cycle_Scheduler        │
                     │   (11 node-cron jobs)       │
                     └──────────┬──────────────────┘
                                │ getCurrentSeason()
                                ▼
                     ┌─────────────────────────────┐
   ┌─────────────────│       Season_Service        │◄──── Season_API
   │                 │   owns `seasons` table      │
   │                 └──────────┬──────────────────┘
   │ phase gate                 │ boundary reached
   ▼                            ▼
┌──────────────────┐  ┌──────────────────────────────┐
│ Battle_Event_Job │  │  Season_Rollover_Service     │
│ (9 handlers)     │  │  1. archive  2. verify       │
│ return early     │  │  3. purge + reset            │
│ during prep      │  └────┬──────────────┬──────────┘
└──────────────────┘       │              │
                           ▼              ▼
              ┌──────────────────┐  ┌──────────────────┐
              │ Season_Archive_  │  │ Purge / Reset    │
              │ Service          │  │ (batched)        │
              └──────────────────┘  └──────────────────┘
```

### Component responsibilities

| Component | Location | Responsibility |
|---|---|---|
| Season_Service | `src/services/season/seasonService.ts` | Owns `seasons`. Exposes `getCurrentSeason()`, `advancePhase()`, `isBattleAllowed()`. Lazily creates Season_Zero. |
| Season_Rollover_Service | `src/services/season/seasonRolloverService.ts` | Orchestrates the three stages, owns ordering, verification gate, batching, notifications. |
| Season_Archive_Service | `src/services/season/seasonArchiveService.ts` | Writes Stable_Season_Archive, Robot_Season_Archive, Season_Accolade, Season_Standing_Snapshot. |
| Season_Purge_Service | `src/services/season/seasonPurgeService.ts` | Executes the delete and reset scope of Requirements 9, 10, 29. |
| Image_Library service | `src/services/moderation/imageLibraryService.ts` | Lists, selects, deletes retained images; enforces ownership and the cap. |
| Season_API | `src/routes/seasons.ts` | Player-facing season state and archive reads. |
| Admin season routes | `src/routes/admin/seasons.ts` | Preview, manual rollover, phase length controls. |

## Data Models

Five new models plus two column additions. All new tables use snake_case names; Prisma fields stay camelCase per the existing convention.

### `seasons`

```prisma
model Season {
  id                        Int       @id @default(autoincrement())
  seasonNumber              Int       @unique @map("season_number")
  phase                     String    @db.VarChar(20) // "preparation" | "competitive" | "completed"
  competitiveCyclesCompleted Int      @default(0) @map("competitive_cycles_completed")
  preparationCyclesCompleted Int      @default(0) @map("preparation_cycles_completed")
  isLegacy                  Boolean   @default(false) @map("is_legacy")
  generatedStableCount      Int       @default(0) @map("generated_stable_count")
  startedAt                 DateTime  @map("started_at")
  endedAt                   DateTime? @map("ended_at")
  createdAt                 DateTime  @default(now()) @map("created_at")
  updatedAt                 DateTime  @updatedAt @map("updated_at")

  stableArchives    StableSeasonArchive[]
  accolades         SeasonAccolade[]
  standingSnapshots SeasonStandingSnapshot[]

  @@index([phase])
  @@map("seasons")
}
```

`isLegacy` is true only for Season_Zero (R24.7). `generatedStableCount` is stamped before Generated_Stables are deleted so R29.13 can still report it (R29.15). `phase` is a `VarChar` rather than an enum so that adding a phase later does not require a migration on a 2GB VPS; the Zod schema and a check constraint enforce the three values (R1.2).

There is no `scheduledEndCycles` column — Season_Zero closes by manual action only (R24.5).

### `stable_season_archives`

```prisma
model StableSeasonArchive {
  id           Int    @id @default(autoincrement())
  seasonNumber Int    @map("season_number")
  userId       Int    @map("user_id")

  stableName        String  @map("stable_name") @db.VarChar(30)
  finalCredits      Int     @map("final_credits")
  prestigeEarned    Int     @map("prestige_earned")
  totalBattles      Int     @map("total_battles")
  wins              Int
  losses            Int
  draws             Int
  winRate           Float   @map("win_rate")
  highestElo        Int     @map("highest_elo")
  totalFame         Int     @map("total_fame")
  championshipTitles    Int @map("championship_titles")
  championshipTitles1v1 Int @map("championship_titles_1v1")
  championshipTitles2v2 Int @map("championship_titles_2v2")
  championshipTitles3v3 Int @map("championship_titles_3v3")
  achievementsUnlocked  Int @map("achievements_unlocked")
  achievementsAvailable Int @map("achievements_available")
  achievementIds    Json    @map("achievement_ids")   // string[]
  facilities        Json                              // { type, level }[]
  robotCount        Int     @map("robot_count")
  teamCount         Int     @map("team_count")
  competitiveCycles Int     @map("competitive_cycles")
  isLegacy          Boolean @default(false) @map("is_legacy")

  createdAt DateTime @default(now()) @map("created_at")

  season Season                @relation(fields: [seasonNumber], references: [seasonNumber], onDelete: Cascade)
  robots RobotSeasonArchive[]

  @@unique([seasonNumber, userId])
  @@index([userId])
  @@map("stable_season_archives")
}
```

`userId` is the single permitted foreign key (R6.9) and is intentionally **not** a Prisma relation to `User` — a relation would add an `onDelete` obligation, and the archive must survive independently. `facilities` and `achievementIds` are `Json` because they are display-only lists; per coding standards they get explicit interfaces in `src/types/`.

`competitiveCycles` satisfies R17.8 (history shows how long each season ran). `isLegacy` is denormalized from the season so the Stable_Page can label a row without a join (R24.9).

### `robot_season_archives`

```prisma
model RobotSeasonArchive {
  id              Int     @id @default(autoincrement())
  stableArchiveId Int     @map("stable_archive_id")

  robotName  String  @map("robot_name") @db.VarChar(50)
  imageUrl   String? @map("image_url") @db.VarChar(255)  // nullable: R30.15
  frameId    Int     @map("frame_id")
  paintJob   String? @map("paint_job") @db.VarChar(100)

  finalElo            Int @map("final_elo")
  fame                Int
  wins                Int
  losses              Int
  draws               Int
  totalBattles        Int @map("total_battles")
  damageDealtLifetime Int @map("damage_dealt_lifetime")
  damageTakenLifetime Int @map("damage_taken_lifetime")
  kills               Int

  mainWeaponName    String? @map("main_weapon_name") @db.VarChar(100)
  offhandWeaponName String? @map("offhand_weapon_name") @db.VarChar(100)

  standings Json   // ArchivedStanding[]
  teams     Json   // ArchivedTeamMembership[]

  createdAt DateTime @default(now()) @map("created_at")

  stableArchive StableSeasonArchive @relation(fields: [stableArchiveId], references: [id], onDelete: Cascade)

  @@index([stableArchiveId])
  @@map("robot_season_archives")
}
```

`standings` and `teams` are `Json` arrays rather than child tables. Rationale: they are read only as a block when a player expands one season row, they are never queried across rows, and a child table would triple the row count on a VPS where bounded growth is an explicit goal (Expected Contribution 4). Typed interfaces live in `src/types/seasonArchive.ts`:

```typescript
export interface ArchivedStanding {
  mode: string;              // StandingsMode value
  tier: string;
  leagueInstanceId: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  draws: number;
  bestWinStreak: number;
  instanceRank: number;      // Instance_Rank, computed at archive time
}

export interface ArchivedTeamMembership {
  teamName: string;
  teamSize: number;
  modes: Array<{
    mode: string;
    tier: string;
    leagueInstanceId: string;
    leaguePoints: number;
    instanceRank: number;
  }>;
}
```

Modes with no Standing are omitted rather than zero-filled (R7.8).

### `season_accolades`

```prisma
model SeasonAccolade {
  id           Int    @id @default(autoincrement())
  seasonNumber Int    @map("season_number")
  userId       Int?   @map("user_id")   // null for Generated_Stable subjects (R8.4)

  category    String  @db.VarChar(60)
  rank        Int
  subjectType String  @map("subject_type") @db.VarChar(20) // "robot" | "team" | "stable"
  subjectName String  @map("subject_name") @db.VarChar(100)
  stableName  String  @map("stable_name") @db.VarChar(30)
  value       Float
  valueLabel  String  @map("value_label") @db.VarChar(40)
  mode        String? @db.VarChar(20)
  isGeneratedSubject Boolean @default(false) @map("is_generated_subject")

  createdAt DateTime @default(now()) @map("created_at")

  season Season @relation(fields: [seasonNumber], references: [seasonNumber], onDelete: Cascade)

  @@index([seasonNumber, userId])
  @@index([seasonNumber, category])
  @@map("season_accolades")
}
```

Accolades attach to the **season**, not to a Stable_Season_Archive (R8.4). The Stable_Page filters on `userId`; the Season_Archive_Page reads all rows. This is what lets a bot's placement be recorded truthfully while still being excluded from any stable's history.

### `season_standing_snapshots`

```prisma
model SeasonStandingSnapshot {
  id           Int    @id @default(autoincrement())
  seasonNumber Int    @map("season_number")

  mode             String @db.VarChar(20)
  tier             String @db.VarChar(20)
  leagueInstanceId String @map("league_instance_id") @db.VarChar(30)
  instanceRank     Int    @map("instance_rank")

  entityType   String  @map("entity_type") @db.VarChar(10)
  entityName   String  @map("entity_name") @db.VarChar(100)
  stableName   String  @map("stable_name") @db.VarChar(30)
  leaguePoints Int     @map("league_points")
  wins         Int
  losses       Int
  draws        Int
  isGeneratedSubject Boolean @default(false) @map("is_generated_subject")

  createdAt DateTime @default(now()) @map("created_at")

  season Season @relation(fields: [seasonNumber], references: [seasonNumber], onDelete: Cascade)

  @@index([seasonNumber, mode, tier, leagueInstanceId])
  @@map("season_standing_snapshots")
}
```

Bounded to Accolade_Depth entries per (mode, tier, instance) triple (R8.14). With 9 modes, 6 tiers, and a handful of instances at depth 10, worst case is low hundreds of rows per season — independent of the Generated_Stable population.

### Column additions

```prisma
// User
isGenerated Boolean @default(false) @map("is_generated")   // R29.1
lastSeenSeasonNumber Int @default(0) @map("last_seen_season_number") // R15.1
```

`isGenerated` replaces username-prefix matching (R29.1). `lastSeenSeasonNumber` drives the Season_Summary_Modal once-per-season rule (R15.5) and survives Account_Reset (R4.11).

## Components and Interfaces

### Season_Service

```typescript
export interface SeasonState {
  seasonNumber: number;
  phase: 'preparation' | 'competitive' | 'completed';
  seasonCycle: number;              // 0 during preparation (R1.5)
  seasonLengthCycles: number;
  remainingCompetitiveCycles: number;
  preparationDay: number;           // 0 during competitive
  remainingPreparationCycles: number;
  isLegacy: boolean;
}

getCurrentSeason(): Promise<SeasonState>
isBattleAllowed(): Promise<boolean>          // false while phase === 'preparation'
advanceCompetitiveCycle(): Promise<{ boundaryReached: boolean }>
advancePreparationCycle(): Promise<{ transitionedToCompetitive: boolean }>
```

`getCurrentSeason()` is called on every job invocation and by every authenticated page load, so it is memoised in-process for 60 seconds with explicit invalidation on any write. The `seasons` table has exactly one non-completed row, so the read is a single indexed lookup — the cache is a courtesy, not a necessity.

Lazy creation (R1.6) delegates to the same code path as the migration (R24.1) to guarantee identical Season_Zero shape: `phase = 'competitive'`, `competitiveCyclesCompleted = cycle_metadata.total_cycles`, `isLegacy = true`.

#### Configuration

Extends the existing Zod-validated `src/config/env.ts` (R21):

| Variable | Default | Constraint |
|---|---|---|
| `SEASON_LENGTH_CYCLES` | 100 | int ≥ 1 |
| `PREPARATION_LENGTH_CYCLES` | 2 | int ≥ 0 |
| `COUNTDOWN_CYCLES` | 7 | int ≥ 0 |
| `ACCOLADE_DEPTH` | 10 | int ≥ 1 |
| `RETAINED_IMAGES_PER_STABLE` | 20 | int ≥ 1 |

Validation failure fails startup naming the key (R21.6), matching the existing env behaviour.

### Scheduler Integration

#### Phase gate on Battle_Event_Jobs

Each of the 9 battle handlers gains a single guard at the top. Rather than editing 9 functions, the gate goes in `initScheduler`'s job wrapper so it is impossible to add a tenth handler and forget:

```typescript
// cycleScheduler.ts — inside runJob(), before acquireLock
if (BATTLE_EVENT_JOBS.has(jobName) && !(await seasonService.isBattleAllowed())) {
  const state = await seasonService.getCurrentSeason();
  logger.info(`${jobName}: skipped — season_preparation (day ${state.preparationDay})`);
  recordJobRun(jobName, { success: true, reason: 'season_preparation' });
  return;
}
```

This satisfies R3.1–R3.3 in one place, keeps Infrastructure_Jobs running (R3.4) because they are not in `BATTLE_EVENT_JOBS`, and makes R3.6 fall out for free since `triggerJob` routes through `runJob`.

#### Settlement changes

`executeSettlement` currently runs 8 steps and increments `cycle_metadata.totalCycles` at step 4. The phase read goes at the very top (R2.1), before `logCycleStart`:

```
read Season_Phase
├── preparation → advancePreparationCycle(); log; return
│                 (skips steps 1–8 entirely — R2.4, R2.6)
└── competitive → steps 1–8 unchanged
                  → advanceCompetitiveCycle()
                  → if boundaryReached && seasonNumber >= 1 → Season_Rollover
```

Gating by early return rather than per-step conditionals is deliberate: R2.4 lists nine things to skip, which is every side-effecting step. An early return cannot drift out of sync with that list as steps are added.

The rollover runs **after** all settlement steps complete (R2.3), so the final cycle of a season settles normally before anything is archived. Season_Zero is exempted by the `seasonNumber >= 1` check (R24.2).

#### Cycle 1 is a scheduling cycle

Battle handlers execute matches due now, then schedule 24h out. Because preparation creates no matches, competitive cycle 1 executes nothing and schedules for cycle 2 (R3.7). This is accepted, not worked around. The Dashboard says so on cycle 1 (R3.8) and the guide explains it (R3.9).

Consequence to be aware of: with `PREPARATION_LENGTH_CYCLES = 2`, players get three consecutive non-combat days. Set it to 1 for a two-day gap.

### Season_Rollover

#### Staging and the verification gate

```
Stage 1 — ARCHIVE (no destructive writes)
  1.1  snapshot Human_Stable and robot counts
  1.2  write Stable_Season_Archive per Human_Stable
  1.3  write Robot_Season_Archive per robot
  1.4  write Season_Standing_Snapshot (all entities, bots included)
  1.5  write Season_Accolade (all subjects, bots included)
  1.6  stamp generatedStableCount on the Season row

Stage 2 — VERIFY  ◄── hard gate
  archive count == Human_Stable count  AND
  robot archive count == Human_Stable robot count
  ├── fail → abort, leave phase 'competitive', report failure (R5.3)
  └── pass → continue

Stage 3 — PURGE + RESET (destructive, batched)
  3.1  delete Generated_Stables (cascades)
  3.2  delete competitive/economic rows (R9.1, R9.2)
  3.3  reset Human_Stable user columns (R9.3)
  3.4  purge history tables (R10.1)
  3.5  reset Global_Cycle_Counter to 0 (R10.2)
  3.6  create next Season in 'preparation' (R5.4)

Stage 4 — POST (non-transactional, failures non-fatal)
  4.1  cleanupOrphans with archive-aware referenced set
  4.2  space reclamation (R10.5)
  4.3  changelog draft (R22.1)
  4.4  completion notification (R18.2)
```

Stage 1 writes nothing destructive, so an abort at Stage 2 leaves a partial archive that Stage 1 will overwrite on retry — which is exactly why R5.5 makes the rollover idempotent per season: a retry detects a complete archive and skips to Stage 3.

#### Open question 1 — concurrency guard (R19.5)

**Resolution: reuse the existing mutex, no new locking primitive.**

`cycleScheduler.ts` already serialises every job through `acquireLock`/`releaseLock`. The settlement-triggered rollover therefore cannot race another job. The only genuine exposure is the admin manual trigger, which does not pass through `runJob`.

The admin trigger will call `triggerJob`-equivalent plumbing so it acquires the same lock. Where the lock is already held, the endpoint returns `409 Conflict` naming the running job rather than queueing. This satisfies R19.5 with no new state.

A PostgreSQL advisory lock was considered and rejected: the app is a single PM2 process, so an in-process mutex is sufficient, and an advisory lock would add a failure mode (lock held by a dead session) for no gain.

#### Open question 2 — batching and transaction boundaries

**Resolution: per-stage transactions, batched by user, with the heavy filesystem and vacuum work outside any transaction.**

The constraint is 2GB RAM and thousands of Generated_Stables. A single transaction around Stage 3 would hold locks for minutes and balloon WAL.

| Step | Boundary | Batch |
|---|---|---|
| 1.2 / 1.3 archive writes | one transaction per batch of 50 Human_Stables | 50 |
| 1.4 / 1.5 snapshot + accolades | one transaction each | whole |
| 3.1 Generated_Stable deletion | one transaction per batch of 200 users | 200 |
| 3.2 bulk row deletion | one transaction per table | `deleteMany` |
| 3.3 Human_Stable reset | one transaction, all users | `updateMany` |
| 3.4 history purge | one transaction per table | `TRUNCATE` where safe |
| 4.1 `cleanupOrphans` | **no transaction** | filesystem walk |
| 4.2 reclamation | **no transaction** | `VACUUM` cannot run in one |

R5.6 requires that no user is left partially reset. Batching by user satisfies this: each batch transaction covers all of a user's rows, so a mid-rollover crash leaves whole users done and whole users untouched, never a half-reset stable.

Human_Stable counts are small (a handful today), so batch size 50 is about crash granularity, not throughput. Generated_Stable deletion is the volume operation; 200 per transaction keeps each under a second.

`VACUUM` cannot execute inside a transaction block, which is why Stage 4 is explicitly non-transactional. Failure there is logged and the rollover still reports success (R10.6).

Deletion order within Stage 3.2 respects foreign keys: `battle_participants` and `standings` before `robots`; `team_battle_members` before `team_battles`; `scheduled_match_participants` before `scheduled_matches_v2`; `tournament_matches` before `tournaments`. Existing `onDelete: Cascade` relations handle most of this, but the order is explicit rather than relying on cascade timing.

#### Open question 3 — early-season matchmaking thinness

**Resolution: accept it, and document it. No baseline seed.**

Because `cycle_metadata.totalCycles` resets to 0 (R10.2), `generateBattleReadyUsers(cycleNumber)` produces 1 stable on cycle 1, 2 on cycle 2, and so on. Combined with players owning few robots, the first several cycles have thin pools.

This is acceptable and arguably correct:

- The existing matchmaking pipeline already handles thin pools — it fabricates a bye robot in-memory (Spec #41) rather than failing.
- Subscription gating means a robot only enters a pool it opted into, so thin pools were always possible.
- A baseline seed would contradict the fresh-start intent and would be the third piece of speculative machinery in this spec.

The growth curve is steep enough to self-correct: by cycle 10 roughly 55 bot stables exist, by cycle 20 roughly 210. The design records this in `PRD_SEASON_SYSTEM.md` so it is a known property rather than a surprise.

If it proves painful in practice, the smallest fix is seeding the bot generator with a starting offset rather than resetting the counter — a one-line change, deferred until evidence justifies it.

#### Instance_Rank computation

Ranks are computed once per (mode, tier, instance) group by ordering `standings` on `leaguePoints DESC, wins DESC, entityId ASC` (R7.6), **including Generated_Stable entities** so an archived rank states a robot's true position (R7.6). One query per group, results held in a Map keyed by `entityType:entityId`, then read by both the robot archive writer and the snapshot writer. No N+1.

#### Accolade capture

Reads the existing `recordsQueryService` categories (R8.7). Each category failure is caught individually and does not affect the verification gate (R8.9) — accolades are decoration, not the record of what happened. Subjects owned by Generated_Stables are retained with `isGeneratedSubject = true` and `userId = null` (R8.3, R29.6).

### Image_Library

The one part of the reset that deliberately preserves user-generated content.

```typescript
listImages(userId): Promise<RetainedImage[]>   // own directory only (R30.5)
selectImage(userId, path): Promise<void>       // ownership-verified (R30.6)
deleteImage(userId, path): Promise<DeleteImpact>
getImpact(userId, path): Promise<DeleteImpact> // robots + archives affected (R30.16)
```

```typescript
export interface RetainedImage {
  path: string;
  uploadedAt: Date;
  currentRobotCount: number;
  archivedSeasonCount: number;
}
```

Ownership is enforced by resolving the submitted path through the existing `getAbsolutePath` traversal guard and then asserting the resolved path sits under `uploads/user-robots/{userId}/` (R30.6, R30.7). Failure returns a generic `403 Access denied` per the ownership convention in `coding-standards.md` — never revealing whether the file exists.

**Retention at rollover.** Stage 3 deletes `robots` rows but calls no `deleteImage` (R30.1). The critical companion change is `cleanupOrphans`: its `referencedUrls` set must be built from *both* live `robots.imageUrl` and every `RobotSeasonArchive.imageUrl` (R30.3). Without this, the nightly orphan sweep would delete exactly the files the archive depends on — the retention would appear to work at rollover and silently fail later.

**Cap behaviour.** At `RETAINED_IMAGES_PER_STABLE` the upload is refused with a message naming the limit (R30.11); no automatic eviction. Deletion is the player's decision.

**Deleting an archive-referenced image** nulls `RobotSeasonArchive.imageUrl` (R30.15) so history renders a default silhouette. This is the single deliberate mutation of an archive row, and it is confined to a cosmetic column — every competitive value stays immutable.

**Static assets.** Generated_Stable robots reference `/assets/robots/{tier}_512x512.webp`, build-managed and shared. Nothing in this design touches `/assets/` (R30.24–R30.26); `deleteImage`, `cleanupOrphans`, and the Image_Library are all scoped to `uploads/user-robots/`.

### Account_Reset changes

`performAccountReset` gains three changes (R4.6–R4.14):

1. **Widened deletion scope** — also clears `user_achievements`, `prestige`, championship counters, `pinnedAchievements`, `totalPracticeBattles`, tuning allocations, subscriptions, and team memberships, matching what Season_Rollover does (R4.10). Without this, a mid-season reset would preserve prestige and achievements while wiping assets, which is a competitive advantage.
2. **Stops deleting images** — the eager `fileStorageService.deleteImage` loop is removed (R4.7, R30.19).
3. **Preserves `lastSeenSeasonNumber`** (R4.11) so a reset does not re-show the Season_Summary_Modal.

Archives are untouched because they are separate tables with no cascade from `robots` (R4.8) — the denormalized design makes this automatic rather than something the reset has to remember.

### API Surface

All routes use `validateRequest` with Zod schemas and the reusable primitives from `securityValidation.ts` (R20.6). Route handlers stay thin wrappers per `coding-standards.md`.

#### Player routes — `src/routes/seasons.ts`

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/seasons/current` | SeasonState (R20.1) |
| GET | `/api/seasons` | completed season list for the Season_Archive_Page (R25.1) |
| GET | `/api/seasons/:seasonNumber` | per-season detail: snapshot, accolades, participation counts (R25.3) |
| GET | `/api/seasons/stables/:userId` | collapsed archive rows (R20.2) |
| GET | `/api/seasons/stables/:userId/:seasonNumber` | expanded robots, teams, accolades (R20.3) |
| POST | `/api/seasons/summary-seen` | records `lastSeenSeasonNumber` (R15.5) |

Archive endpoints apply the same `profileVisibility` rules the existing stable endpoint applies (R20.5), and return 404 for a missing stable/season pair (R20.4).

#### Image_Library routes — `src/routes/images.ts`

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/images` | own retained images with impact counts |
| DELETE | `/api/images/:filename` | delete with confirmation flag |

Uploads keep the existing per-user rate limiter and content moderation unchanged (R30.21).

#### Admin routes — `src/routes/admin/seasons.ts`

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/seasons/state` | season state + whether balance changes are appropriate (R18.1) |
| GET | `/api/admin/seasons/rollover-preview` | Rollover_Preview counts, read-only (R18.2) |
| POST | `/api/admin/seasons/rollover` | manual rollover, requires confirmation value (R18.3, R18.4) |
| POST | `/api/admin/seasons/extend` | extend current Competitive_Phase (R18.5) |
| POST | `/api/admin/seasons/preparation-cycles` | set remaining preparation cycles 0–7 (R18.6) |

Every action writes an `admin_audit_logs` row with actor, action, and resulting state (R18.8), and all routes sit behind `requireAdmin` (R18.9).

### Frontend Design

#### Components

| Component | Location | Requirement |
|---|---|---|
| `SeasonProgressIndicator` | `components/season/` | R17 |
| `SeasonCountdownBanner` | `components/season/` | R16 |
| `SeasonSummaryModal` | `components/season/` | R15 |
| `SeasonHistoryBlock` | `components/stable/` | R14 |
| `SeasonArchivePage` | `pages/SeasonArchivePage.tsx` | R25 |
| `ImageLibrary` | `components/robots/` | R30 |
| `AdminSeasonsPage` | `pages/admin/` | R18 |

A `useSeason()` hook wraps `/api/seasons/current`. Season state is read by the nav, Dashboard, banner, and modal — four consumers across the tree — so it goes in a Zustand store (`useSeasonStore`) per the 3+ pages rule in `frontend-state-management.md`, with selectors rather than whole-store subscriptions.

All displayed cycle values come from the endpoint; nothing is computed client-side from timestamps (R17.5). If the request fails, the indicator is omitted rather than showing stale values (R17.8).

#### Mobile layouts (R28)

Every surface follows the documented pattern: `useMediaQuery('(min-width: 1024px)')` with tabs above and stacked sections below, as in `battle-detail/TabLayout.tsx`.

| Surface | ≥1024px | <1024px |
|---|---|---|
| SeasonProgressIndicator | `Season 3 · Cycle 42 / 100` in nav | condensed `S3 · 42/100` |
| SeasonCountdownBanner | single line | text wraps, never truncates the cycle count (R28.9) |
| SeasonSummaryModal | centred dialog | fits 320×568, content scrolls, dismiss reachable without scrolling (R28.8) |
| SeasonHistoryBlock | table rows | full-width cards, figures wrap (R28.3) |
| Expanded season detail | side-by-side per-mode columns | one card per robot, standings listed vertically (R28.4) |
| SeasonArchivePage | table + per-mode columns | stacked cards, per-mode sections stacked (R28.2) |
| ImageLibrary | grid | 2-column grid at 320px, single column below |
| AdminSeasonsPage | two columns | single column, destructive actions visually separated (R28.10) |
| Rollover_Preview counts | table | label/value list (R28.11) |

No surface allows horizontal overflow between 320 and 1920px (R28.1). Where a table has more columns than fit, visible columns reduce to identifier plus primary figure rather than scrolling (R28.6). Every interactive control — row expanders, mode selectors, modal and banner dismiss, admin actions — is at least 44×44px (R28.7).

#### Season-scoped records (R13)

Hall_of_Records already aggregates from operational tables. Because the purge empties those tables at each rollover, every category becomes current-season scoped with no query changes — the scoping is a consequence of the purge, not new filtering logic. Responses gain the Season_Number label (R13.2), preparation returns empty categories with an explanatory message (R13.4), and completed-season placements are read from Season_Accolade instead (R13.5).

## Error Handling

New `SeasonError` class in `src/errors/seasonErrors.ts` extending `AppError`, with `SeasonErrorCode` values: `ROLLOVER_IN_PROGRESS`, `ARCHIVE_VERIFICATION_FAILED`, `CONFIRMATION_REQUIRED`, `PREPARATION_PHASE_ACTIVE`, `SEASON_NOT_FOUND`, `IMAGE_LIMIT_REACHED`, `IMAGE_NOT_OWNED`. Registered in `docs/guides/ERROR_CODES.md`.

Failure behaviour by stage:

| Failure | Behaviour |
|---|---|
| Archive write | abort, no destructive writes, phase stays `competitive` (R5.3) |
| Verification | abort with `ARCHIVE_VERIFICATION_FAILED` (R5.3) |
| Single accolade category | log, continue, gate unaffected (R8.9) |
| Purge / reset mid-way | phase stays `competitive`, report incomplete, retry resumes at Stage 3 (R19.4) |
| `cleanupOrphans` | log, rollover still succeeds |
| Reclamation | log, rollover still succeeds (R10.6) |
| Changelog draft | log, rollover still succeeds (R22.2) |

Discord notifications fire at start, completion, and failure with the failing stage named (R19.1–R19.3), reusing the existing monitoring webhook. Per-stage durations are logged separately (R19.6).

## Correctness Properties

Invariants that must hold regardless of input. Each is a property test target.

### Property 1: Exactly one active season

At any time the `seasons` table holds exactly one row whose `phase` is not `completed`. Holds across lazy creation, phase transitions, and rollover.

**Validates: Requirements 1.1, 1.7, 1.8**

### Property 2: Season_Cycle is a total function of the counters

While competitive, `seasonCycle === competitiveCyclesCompleted + 1`; while preparing, `seasonCycle === 0` and `preparationDay === preparationCyclesCompleted + 1`. For arbitrary non-negative counter values, never negative and never derived from wall-clock time.

**Validates: Requirements 1.4, 1.5, 17.2, 17.3**

### Property 3: Monotonic season numbering

`seasonNumber` is unique and each rollover produces exactly `previous + 1`. Season_Zero is the only 0.

**Validates: Requirements 1.7, 24.6**

### Property 4: Instance_Rank is a permutation

Within every (mode, tier, `leagueInstanceId`) group of size N, the assigned ranks are exactly 1..N with no gaps or duplicates, for arbitrary LP, win, and id combinations including full ties. The `entityId ASC` final key guarantees determinism.

**Validates: Requirements 7.6, 8.11**

### Property 5: Archive completeness gate

The purge executes if and only if one Stable_Season_Archive exists per Human_Stable and the Robot_Season_Archive count equals the Human_Stable robot count. For any population of humans and bots, a mismatch aborts with all operational data intact.

**Validates: Requirements 5.2, 5.3, 29.5**

### Property 6: No dangling archive references

Every value in every archive row is text or numeric except `StableSeasonArchive.userId` and the internal `stableArchiveId` link. After a purge, no archive row references a deleted row.

**Validates: Requirements 6.9, 7.4, 8.13**

### Property 7: Rollover idempotence

Invoking Stage 3 twice for the same `seasonNumber` yields the same end state as invoking it once. Combined with P5, a crashed rollover is safely retryable.

**Validates: Requirements 5.5, 19.4**

### Property 8: Batch atomicity per user

After any interruption during Stage 3, every Human_Stable is either fully reset or fully untouched. No stable holds robots with cleared credits, or facilities with deleted standings.

**Validates: Requirements 5.6**

### Property 9: Preparation is side-effect free for game state

Across a full Preparation_Phase, `cycle_metadata.totalCycles` is unchanged, and no rows are added to `battles`, `scheduled_matches_v2`, `tournaments`, `financial_ledger`, or `cycle_snapshots`.

**Validates: Requirements 2.4, 2.6, 3.3**

### Property 10: Image retention safety

For any set of live robots and archive rows, the `cleanupOrphans` referenced set is a superset of every path either references. No image reachable from an archive is ever deleted by the sweep.

**Validates: Requirements 30.1, 30.3**

### Property 11: Image ownership closure

For any submitted path, `selectImage` and `deleteImage` succeed only if the resolved absolute path is under `uploads/user-robots/{callerId}/`. Traversal sequences and other users' ids always reject.

**Validates: Requirements 30.5, 30.6, 30.7**

### Property 12: Accolade attribution

Every Season_Accolade with `isGeneratedSubject = true` has `userId = null`, and every row with a non-null `userId` refers to a Human_Stable that has a Stable_Season_Archive for the same season.

**Validates: Requirements 8.4, 29.6**

### Property 13: Snapshot boundedness

Season_Standing_Snapshot row count per season is at most `Accolade_Depth × |modes| × |tiers| × |instances|` and is independent of the Generated_Stable population.

**Validates: Requirements 8.14, 8.12**

## Testing Strategy

**Unit** — Season_Service phase transitions and boundary arithmetic; Instance_Rank ordering including ties; Image_Library ownership and traversal rejection; config validation.

**Property-based** (fast-check, per project convention):
- Instance_Rank is a permutation of 1..N within every group, for arbitrary LP/wins/id combinations.
- Season_Cycle is always `competitiveCyclesCompleted + 1` while competitive and 0 while preparing, for arbitrary counter values.
- Archive verification passes if and only if counts match, for arbitrary stable/robot populations.
- Rollover idempotence: applying Stage 3 twice yields the same end state.

**Integration** (seeded database) — full rollover asserting archive counts (R5.2) and zero-row assertions (R9.6, R10.1); Season_Zero closure asserting no rollover without a manual trigger and a correct one after (R27.7); Account_Reset preserving archives (R4.8); `cleanupOrphans` sparing archive-referenced images.

**Frontend** (Vitest + RTL) — each season surface at 320, 375, and 1024px with no element exceeding viewport width and all controls ≥44px (R28.12).

**Local fast season** (R27) — `SEASON_LENGTH_CYCLES=1`, `PREPARATION_LENGTH_CYCLES=0`, driving cycles via admin manual triggers. The seed must produce enough stables, robots, teams, standings, and battles for a rollover to write a non-empty archive (R27.4).

## Documentation Impact

Requirement 31's 18 criteria map to these files:

**Steering** (`.kiro/steering/`)
- `project-overview.md` — add the Season System to Key Systems with reset scope and preparation window (R31.2).
- `coding-standards.md` — season-scoped queries must not assume pre-season data exists; cross-season history reads from archive tables (R31.3).

**New**
- `docs/game-systems/PRD_SEASON_SYSTEM.md` — authoritative description: structure, reset and preservation scope, Preparation_Phase, archive model, Season_Zero, the preparation window as the balance-change window, the supersession of backlog #41, and the early-season bot thinness property (R31.9, R31.15, R31.16).
- `docs/prd_pages/` — a page document for the Season_Archive_Page (R31.15).
- `app/backend/src/content/guide/seasons/` — new guide section registered in `sections.json`, covering structure, what resets, what survives, the preparation window, reading the archive, cycle 1 being a scheduling cycle, and image retention (R26.1–R26.3, R3.9, R31.18).

**Corrections** — these documents currently state things this spec makes false:
- `docs/game-systems/PRD_PRESTIGE_AND_FAME.md` — prestige and fame reset (R31.11).
- `docs/game-systems/PRD_ACHIEVEMENT_SYSTEM.md` — achievements reset, recorded per season (R31.12).
- `docs/game-systems/PRD_LEAGUE_SYSTEM.md` — standings, tiers, LP, ELO reset; league history purged once archived (R31.13).
- `docs/game-systems/PRD_CYCLE_SYSTEM.md` — settlement reads phase first, skips economic steps during preparation, leaves the counter unchanged, invokes rollover at the boundary (R31.10).
- `docs/game-systems/PRD_AUTO_USER_GENERATION.md` — Generated_Stables deleted at rollover, generation restarts from the reset counter, seeded test stables are Generated_Stables (R29.14).
- Guide sections `prestige-fame`, `achievements`, `leagues`, `economy`, `grand-melee`, `king-of-the-hill`, `team-battles`, `tournaments`, `getting-started` — remove "permanent" and open-ended progression language (R26.4–R26.7).

**Updates**
- `docs/architecture/PRD_SERVICE_DIRECTORY.md` — cron schedule notes preparation suspension (R31.1).
- `docs/architecture/DATABASE_SCHEMA.md` — the five new tables, Season_Zero, the legacy flag, `isGenerated`, Season_Standing_Snapshot (R31.4, R31.8, R31.17).
- `docs/game-systems/README.md` — list the new PRD (R31.14).
- `docs/guides/ADMIN_PANEL_GUIDE.md` — Admin_Season_Portal, preview, manual rollover, phase controls, Season_Zero closure (R31.16).
- `docs/guides/operations/LOCAL_SETUP.md` — season env vars and the fast-season rollover sequence (R27.5).
- `docs/guides/ERROR_CODES.md` — `SeasonErrorCode` values.
- `docs/balance_changes/README.md` — balance changes are applied during a Preparation_Phase; each document names the Season_Number it took effect in (R23.5).
- `docs/BACKLOG.md` — replace item #41 with a reference to this spec (R31.5).

## Requirements Traceability

| Requirement | Design coverage |
|---|---|
| 1 Season state model | `seasons` model; Season_Service `SeasonState` |
| 2 Phase advancement | Settlement early-return gate; `advance*Cycle()` |
| 3 Battle suspension | `runJob` phase gate; cycle-1 scheduling note |
| 4 Preparation capabilities + Account_Reset | Account_Reset changes section |
| 5 Rollover ordering | Staging diagram; verification gate; batching table |
| 6 Stable archive | `stable_season_archives` model |
| 7 Robot archive | `robot_season_archives` model; `ArchivedStanding`; Instance_Rank |
| 8 Accolades + snapshot | `season_accolades`, `season_standing_snapshots`; accolade capture |
| 9 Reset scope | Stage 3.1–3.3; deletion order |
| 10 Purge scope | Stage 3.4–3.5; Stage 4.2 reclamation |
| 11 Preserved data | Stage 3.3 `updateMany`; archive independence |
| 12 New season init | Stage 3.6; onboarding unchanged |
| 13 Season-scoped records | Season-scoped records section |
| 14 Stable history block | `SeasonHistoryBlock`; mobile table |
| 15 Summary modal | `SeasonSummaryModal`; `lastSeenSeasonNumber` |
| 16 Countdown + indicators | `SeasonCountdownBanner` |
| 17 Progress display | `SeasonProgressIndicator`; `useSeasonStore` |
| 18 Admin management | Admin routes table |
| 19 Failure handling | Error handling table; open question 1 |
| 20 API surface | Player routes table |
| 21 Configuration | Configuration table |
| 22 Change communication | Stage 4.3; modal and Dashboard links |
| 23 Balance across boundary | Data model denormalization; no code path |
| 24 Season_Zero | `isLegacy`; `seasonNumber >= 1` exemption; manual close |
| 25 Archive browsing | `SeasonArchivePage`; `/api/seasons` routes |
| 26 Guide content | Documentation Impact — new and corrections |
| 27 Local dev + test | Testing Strategy — local fast season |
| 28 Mobile | Mobile layouts table |
| 29 Generated_Stable handling | `isGenerated`; Stage 3.1; `generatedStableCount` |
| 30 Image retention | Image_Library section |
| 31 Documentation | Documentation Impact |
