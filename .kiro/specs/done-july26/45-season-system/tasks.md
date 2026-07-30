# Implementation Plan

## Overview

31 requirements, 272 acceptance criteria, all traced below. The work splits into a backend spine (schema → Season_Service → scheduler → archive → purge → rollover), three cross-cutting concerns (Image_Library, Account_Reset, APIs), the frontend surfaces, and documentation.

Two ordering constraints matter more than the rest:

- **Nothing destructive is built before the archive is provable.** Task group 5 (purge) is deliberately sequenced after group 4 (archive), and group 6 wires the verification gate between them. Building the purge first would leave a period where a rollover could run without a working archive.
- **`cleanupOrphans` must become archive-aware in the same change that stops deleting images.** Task 7.3 covers both halves. Doing only the retention half leaves the nightly sweep deleting archive-referenced files, which would look like working retention that silently fails days later.

## Task Dependency Graph

```
1 Schema, migration, types
├── 1.1 models ──┬── 1.3 migration ── 1.5 CI drift check
├── 1.2 columns ─┘
└── 1.4 types
        │
        ▼
2 Season_Service ── 2.1 config ── 2.2 service ── 2.3 errors ── 2.4 property tests
        │
        ├──────────────► 3 Scheduler (3.1 gate, 3.2 settlement, 3.3 tests)
        │
        ├──────────────► 4 Archive (4.1 rank → 4.2 stable → 4.3 robot → 4.4 snapshot → 4.5 accolades → 4.6 properties)
        │                        │
        │                        ▼
        │               5 Purge (5.1 bots → 5.2 reset → 5.3 history → 5.4 post → 5.5/5.6 tests)
        │                        │
        │                        ▼
        │               6 Rollover (6.1 staging+gate → 6.2 observability → 6.3 changelog → 6.4 property)
        │                        │
        ├── 7 Image_Library (7.1 service → 7.2 impact → 7.3 cleanupOrphans → 7.4 routes → 7.5 assets → 7.6 properties)
        │        └── 7.3 depends on 4.3 (archive image paths exist)
        │
        ├── 8 Account_Reset (8.1 scope → 8.2 verify) — depends on 7.1
        │
        ├── 9 Season_API (9.1 routes, 9.2 records scoping) — depends on 4.x for archive reads
        │
        └── 10 Admin (10.1 routes, 10.2 changelog surface) — depends on 6.x

11 Frontend — depends on 9 and 10
   11.1 store → 11.2 indicator, 11.3 banner, 11.4 modal, 11.5 dashboard,
                11.6 history block, 11.7 archive page, 11.8 image library
                                    └── 11.9 mobile tests, 11.10/11.11 E2E (after 11.2–11.8)

12 Seed and local dev — depends on 1, 2, 6
13 Guide content — depends on nothing; content only
14 Documentation — depends on all implementation groups
15 Final verification — depends on everything
```

Wave definitions for parallel dispatch:

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": ["1.1", "1.2", "1.4"],
      "rationale": "Schema models, columns, and shared types have no dependencies."
    },
    {
      "wave": 2,
      "tasks": ["1.3", "1.5", "2.1", "2.3", "13.1", "13.2"],
      "rationale": "Migration and CI check follow the models. Config and errors are standalone. Guide content depends on nothing."
    },
    {
      "wave": 3,
      "tasks": ["2.2", "12.1"],
      "rationale": "Season_Service needs config and errors. The isGenerated writers need the column."
    },
    {
      "wave": 4,
      "tasks": ["2.4", "3.1", "3.2", "4.1", "7.1"],
      "rationale": "Scheduler gates, Instance_Rank, and the Image_Library service all depend only on the Season_Service."
    },
    {
      "wave": 5,
      "tasks": ["3.3", "4.2", "4.3", "7.2", "7.5"],
      "rationale": "Archive writers follow Instance_Rank; image impact follows the library service."
    },
    {
      "wave": 6,
      "tasks": ["4.4", "4.5", "7.3", "7.4", "8.1"],
      "rationale": "Snapshot and accolades follow the robot archive. cleanupOrphans needs archive image paths to exist. Account_Reset needs the library."
    },
    {
      "wave": 7,
      "tasks": ["4.6", "5.1", "5.2", "5.3", "7.6", "8.2"],
      "rationale": "Purge is built only after the archive is complete and provable."
    },
    {
      "wave": 8,
      "tasks": ["5.4", "5.5", "5.6", "6.1"],
      "rationale": "Rollover staging wires the verification gate between the completed archive and purge."
    },
    {
      "wave": 9,
      "tasks": ["6.2", "6.3", "6.4", "9.1", "9.2"],
      "rationale": "Observability, changelog, and the player API follow the rollover and archive."
    },
    {
      "wave": 10,
      "tasks": ["10.1", "10.2", "11.1", "12.2", "12.3"],
      "rationale": "Admin routes follow the rollover. The frontend store follows the API. Seed work follows the rollover."
    },
    {
      "wave": 11,
      "tasks": ["11.2", "11.3", "11.4", "11.5", "11.6"],
      "rationale": "Season surfaces follow the store and API and are mutually independent."
    },
    {
      "wave": 12,
      "tasks": ["11.7", "11.8", "12.4"],
      "rationale": "Archive page and image UI follow the earlier surfaces; end-to-end tests follow the seed."
    },
    {
      "wave": 13,
      "tasks": ["11.9", "11.10", "11.11", "14.1", "14.2", "14.3", "14.4", "14.5"],
      "rationale": "Mobile tests and E2E suites follow every surface. Documentation follows all implementation."
    },
    {
      "wave": 14,
      "tasks": ["15.1"],
      "rationale": "Final verification runs last."
    }
  ]
}
```

## Tasks

- [x] 1. Schema, migration, and shared types
- [x] 1.1 Add the five season models to `app/backend/prisma/schema.prisma`
  - Add `Season`, `StableSeasonArchive`, `RobotSeasonArchive`, `SeasonAccolade`, `SeasonStandingSnapshot` exactly as specified in the design Data Models section
  - `Season` carries `seasonNumber` (unique), `phase`, `competitiveCyclesCompleted`, `preparationCyclesCompleted`, `generatedStableCount`, `startedAt`, `endedAt` — no legacy flag column, no `scheduledEndCycles`
  - `StableSeasonArchive.userId` is a plain `Int`, deliberately not a Prisma relation to `User`
  - `RobotSeasonArchive.imageUrl` is nullable
  - `SeasonAccolade.userId` is nullable; both accolade and snapshot carry `isGeneratedSubject`
  - Run `pnpm exec prisma generate`
  - _Requirements: 1.1, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 7.1, 7.2, 7.3, 7.7, 8.2, 8.4, 8.11, 8.13_

- [x] 1.2 Add the two `users` columns
  - Add `isGenerated Boolean @default(false) @map("is_generated")` and `lastSeenSeasonNumber Int @default(0) @map("last_seen_season_number")` to the `User` model
  - _Requirements: 15.1, 29.1_

- [x] 1.3 Write the single additive migration
  - Create one migration containing only `CREATE TABLE` for the five tables, `ADD COLUMN` for the two `users` columns with their defaults, and one backfill `UPDATE users SET is_generated = true WHERE username LIKE 'auto\_%' OR username LIKE 'test\_user\_%'`
  - The migration SHALL create no `Season` row — Season_Zero is created by the Season_Service
  - Verify no `DROP` or `ALTER ... TYPE` statement is present
  - _Requirements: 24.10, 29.2_

- [x] 1.4 Add archive payload interfaces to `app/backend/src/types/`
  - Create `seasonArchive.ts` exporting `ArchivedStanding`, `ArchivedTeamMembership`, `ArchivedFacility`, and the achievement id list type used by the `Json` columns
  - Export from the `src/types/` barrel; no local copies anywhere else
  - _Requirements: 7.4, 7.5, 6.6, 6.7_

- [x] 1.5 Add the schema drift check to CI
  - Add a `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url ... --exit-code` step to the backend integration job in `.github/workflows/ci.yml`
  - The step must fail the build when the migration history and `schema.prisma` disagree
  - _Requirements: 31.4_

- [x] 2. Season_Service and configuration
- [x] 2.1 Add season configuration to `app/backend/src/config/env.ts`
  - Add Zod-validated `SEASON_LENGTH_CYCLES` (default 100, int ≥ 1), `PREPARATION_LENGTH_CYCLES` (default 2, int ≥ 0), `COUNTDOWN_CYCLES` (default 7, int ≥ 0), `ACCOLADE_DEPTH` (default 10, int ≥ 1), `RETAINED_IMAGES_PER_STABLE` (default 20, int ≥ 1)
  - Startup fails naming the invalid key
  - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 30.18_

- [x] 2.2 Implement `app/backend/src/services/season/seasonService.ts`
  - `getCurrentSeason(): Promise<SeasonState>` returning `seasonNumber`, `phase`, `seasonCycle`, `seasonLengthCycles`, `remainingCompetitiveCycles`, `preparationDay`, `remainingPreparationCycles`
  - Season_Cycle is `competitiveCyclesCompleted + 1` while competitive and 0 while preparing; preparation day is `preparationCyclesCompleted + 1`
  - Lazily create Season_Zero when no Season row exists: `seasonNumber` 0, `phase` `competitive`, `competitiveCyclesCompleted` from `cycle_metadata.totalCycles`, idempotent
  - `isBattleAllowed()`, `advanceCompetitiveCycle()`, `advancePreparationCycle()`
  - Enforce `phase` to the three permitted values; keep `seasonNumber` unique and incrementing by exactly 1 per rollover; retain completed seasons with `endedAt` set and `phase` `completed`
  - 60-second in-process memoisation with explicit invalidation on any write
  - `Season_Number` 0 is the legacy marker — store no legacy flag
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 21.7, 24.1, 24.2, 24.3, 24.4, 24.7, 24.11_

- [x] 2.3 Add `SeasonError` to `app/backend/src/errors/`
  - `seasonErrors.ts` with `SeasonError extends AppError` and `SeasonErrorCode`: `ROLLOVER_IN_PROGRESS`, `ARCHIVE_VERIFICATION_FAILED`, `CONFIRMATION_REQUIRED`, `PREPARATION_PHASE_ACTIVE`, `SEASON_NOT_FOUND`, `IMAGE_LIMIT_REACHED`, `IMAGE_NOT_OWNED`
  - Export from the `src/errors/` barrel
  - _Requirements: 18.4, 19.4, 30.6, 30.11_

- [x] 2.4 Write Season_Service unit and property tests
  - Property: exactly one non-completed Season row across lazy creation, transitions, and rollover (design Property 1)
  - Property: Season_Cycle is a total function of the counters for arbitrary non-negative values, never negative, never timestamp-derived (design Property 2)
  - Property: `seasonNumber` unique and each rollover yields exactly `previous + 1`, with 0 reserved for Season_Zero (design Property 3)
  - _Requirements: 1.4, 1.5, 1.7, 1.8, 24.11_

- [x] 3. Scheduler integration
- [x] 3.1 Add the Battle_Event_Job phase gate to `cycleScheduler.ts`
  - Define `BATTLE_EVENT_JOBS` covering `league`, `tournament`, `tagTeam`, `koth`, `team2v2League`, `team3v3League`, `team2v2Tournament`, `team3v3Tournament`, `grandMelee`
  - In `runJob`, before `acquireLock`, return early when the job is a Battle_Event_Job and `isBattleAllowed()` is false; record the run as successful with reason `season_preparation` and log the job name and preparation day
  - Because `triggerJob` routes through `runJob`, admin manual triggers are declined during preparation with a message naming the preparation window
  - Infrastructure_Jobs (health report, retention, backup) are not in the set and continue to run
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3.2 Add the phase gate and rollover hook to `executeSettlement`
  - Read the Season_Phase at the very top, before `logCycleStart`
  - While `preparation`: call `advancePreparationCycle()`, log the preparation day and remaining count, and return before step 1 — skipping passive income, operating costs, end-of-cycle balances, the Global_Cycle_Counter increment, `cyclesInTier`, the analytics snapshot, practice arena flush, user generation, achievement rarity refresh, and leaderboard refresh
  - While `competitive`: run steps 1–8 unchanged, then `advanceCompetitiveCycle()`
  - When the boundary is reached and `seasonNumber >= 1`, invoke Season_Rollover after all settlement steps have completed
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 24.2, 24.3_

- [x] 3.3 Write scheduler integration and property tests
  - Assert no `scheduled_matches_v2`, `battles`, or `tournaments` rows are created across a preparation cycle, and that `cycle_metadata.totalCycles` is unchanged (design Property 9)
  - Assert every Battle_Event_Job runs normally on the cycle the phase becomes `competitive`
  - Assert competitive cycle 1 executes zero battles and schedules matches for cycle 2
  - _Requirements: 2.4, 2.6, 3.3, 3.5, 3.7_

- [x] 4. Season_Archive_Service
- [x] 4.1 Implement Instance_Rank computation
  - In `app/backend/src/services/season/seasonArchiveService.ts`, compute ranks per (mode, tier, `leagueInstanceId`) group by ordering `standings` on `leaguePoints DESC, wins DESC, entityId ASC`
  - Include Generated_Stable entities in the ordering so an archived rank is the robot's true league position
  - One query per group, results held in a Map keyed by `entityType:entityId` — no N+1
  - _Requirements: 7.6_

- [x] 4.2 Write Stable_Season_Archive rows
  - One row per Human_Stable per completed season, keyed by `seasonNumber` + `userId`
  - Store final credits, prestige earned, stable name, aggregate battles/wins/losses/draws/win rate, highest ELO across the stable's robots, total fame, all four championship counters, achievements unlocked and available plus the unlocked id list, every owned facility type and level, robot and team counts, and the competitive cycle count of the season
  - Write nothing for a Generated_Stable
  - Every value denormalized, `userId` the only foreign key
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 29.4_

- [x] 4.3 Write Robot_Season_Archive rows
  - One row per robot of a Human_Stable, linked to the owning Stable_Season_Archive
  - Store name, image path, frame id, paint job, final ELO, fame, W/L/D, total battles, lifetime damage dealt and taken, kills, and equipped main and offhand weapon names
  - Store per-mode standings as `ArchivedStanding[]` including Instance_Rank, omitting modes with no Standing
  - Store team memberships as `ArchivedTeamMembership[]` with team name, size, and per-mode tier/instance/LP/rank
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.7, 7.8_

- [x] 4.4 Write Season_Standing_Snapshot rows
  - For every (mode, tier, `leagueInstanceId`) present in `standings`, capture the top Accolade_Depth entities by Instance_Rank
  - Store mode, tier, instance, rank, entity type, entity name, owning stable name, LP, W/L/D, and `isGeneratedSubject`
  - Include Generated_Stable entities so each tier's champion stays identifiable after those stables are deleted
  - All values denormalized text or numbers
  - _Requirements: 8.10, 8.11, 8.12, 8.13, 8.14, 29.6, 29.7_

- [x] 4.5 Write Season_Accolade rows
  - Read the Hall_of_Records via `recordsQueryService` and capture the top Accolade_Depth placements of every category the service actually returns after spec 46: combat (per-mode most damage, narrowest victory), upset (tournament modes only), career, economic, prestige, KotH, team battle per size, Grand Melee, tournament champions per participant type, and league win streaks
  - Do not capture Longest Battle or Fastest Victory — spec 46 removed them because the duration cap made every entry identical
  - Store category, rank, subject type, subject name, owning stable name, value, value label, mode where mode-specific, and `isGeneratedSubject`
  - Attach to the season with a nullable `userId` set only for Human_Stable-owned subjects
  - Capture bot-held placements so a Human_Stable's recorded rank is its true rank within the season
  - An empty category records nothing; a failing category is logged and skipped without affecting archive verification
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.7, 8.8, 8.9, 13.5, 29.6_

- [x] 4.6 Write archive property tests
  - Property: Instance_Rank is exactly 1..N within every group for arbitrary LP/wins/id combinations including full ties (design Property 4)
  - Property: no archive row holds a foreign key to a purged row beyond `userId` and the internal archive link (design Property 6)
  - Property: every accolade with `isGeneratedSubject` true has a null `userId`, and every non-null `userId` refers to a Human_Stable with an archive for that season (design Property 12)
  - Property: snapshot row count per season is bounded by Accolade_Depth × modes × tiers × instances, independent of the bot population (design Property 13)
  - _Requirements: 6.9, 7.6, 8.4, 8.14, 29.6_

- [x] 5. Season_Purge_Service
- [x] 5.1 Delete Generated_Stables
  - In `app/backend/src/services/season/seasonPurgeService.ts`, delete every `users` row with `isGenerated` true along with all owned rows, in transactions of 200 users
  - Stamp `generatedStableCount` on the Season row before deletion so the count can still be reported afterwards
  - Report the number deleted alongside the archived and purged counts
  - Never delete a file under the static asset directory
  - _Requirements: 29.3, 29.8, 29.9, 29.15, 30.24_

- [x] 5.2 Reset competitive and economic state
  - Delete every row of `robots`, `battle_participants`, `tuning_allocations`, `subscriptions`, `weapon_inventory`, `weapon_refinement`, `facilities`, `team_battles`, `team_battle_members`, `standings`, `scheduled_matches_v2`, `scheduled_match_participants`, `tournaments`, `tournament_matches`, and `user_achievements`
  - Respect foreign key order: participants and standings before robots, members before team battles, match participants before matches, tournament matches before tournaments
  - Set every Human_Stable's `currency` to ₡3,000,000 regardless of prior balance, and zero `prestige`, all four championship counters, `pinnedAchievements`, and `totalPracticeBattles`
  - Retain uploaded image files; delete no `robots` image from disk
  - Release archived robot names for reuse
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

- [x] 5.3 Purge history and reset the cycle counter
  - Delete every row of `battles`, `battle_summaries`, `audit_logs`, `cycle_snapshots`, `financial_ledger`, `league_history`, `leaderboard_cache`, `practice_arena_daily_stats`
  - Reset `cycle_metadata.totalCycles` to 0 and set `lastCycleAt` to the rollover time
  - Run only after archive verification has succeeded
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 5.4 Add the non-transactional post stage
  - Run space reclamation on the purged tables outside any transaction, logging the outcome; a failure is logged and the rollover still reports success
  - Run `cleanupOrphans` with the archive-aware referenced set from task 7.3
  - _Requirements: 10.5, 10.6_

- [x] 5.5 Assert preserved data and new-season initialisation
  - Integration test that every Human_Stable row survives with `id`, `username`, `email`, `passwordHash`, `role`, `stableName`, `profileVisibility`, notification flags, `themePreference`, `tokenVersion`, `lastSeenChangelog`, `lastLoginAt`, `createdAt` unchanged, and all seven onboarding fields unchanged
  - Assert `weapons`, `changelog_entries`, `admin_audit_logs`, `reset_logs`, `seasons`, and the archive tables are untouched, including archives of earlier seasons
  - Assert every user starts the new season with Starting_Credits, zero robots, weapons, facilities, teams, subscriptions, and standings, and zero active subscriptions
  - Assert a user registering during either phase receives the unchanged starting package with no season-elapsed compensation
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 12.1, 12.2, 12.3, 12.4, 12.5_

- [x] 5.6 Write purge property tests
  - Property: applying the purge and reset stage twice yields the same end state as applying it once (design Property 7)
  - Property: after any interruption, every Human_Stable is either fully reset or fully untouched — never partially (design Property 8)
  - _Requirements: 5.5, 5.6_

- [x] 6. Season_Rollover_Service orchestration
- [x] 6.1 Implement the three-stage rollover with the verification gate
  - In `app/backend/src/services/season/seasonRolloverService.ts`, run Stage 1 archive (tasks 4.2–4.5) writing nothing destructive, then Stage 2 verification, then Stage 3 purge and reset (tasks 5.1–5.3), then create the next Season with `phase` `preparation` and `preparationCyclesCompleted` 0
  - Verification asserts one Stable_Season_Archive per Human_Stable and a Robot_Season_Archive count equal to the pre-rollover count of robots owned by Human_Stables, counting Human_Stables only
  - On verification failure: abort, leave all operational data unchanged, leave the phase `competitive`, report failure
  - Idempotent per season: a season that already has a complete archive skips Stage 1 and proceeds to Stage 3
  - Batch archive writes 50 Human_Stables per transaction and process users in batches so no user is left partially reset
  - Record the completed Season_Number, archived stable and robot counts, and purged row counts per table
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 29.5_

- [x] 6.2 Add rollover observability and the concurrency guard
  - Dispatch a Discord notification at start naming the completing Season_Number and start time; on completion naming archived stable and robot counts, total purged rows, and duration; on failure naming the failing stage and error
  - Log the elapsed duration of the archive, purge, and reset stages separately
  - Route the admin manual trigger through the scheduler's existing `acquireLock` so a second concurrent rollover cannot start; return `409 Conflict` naming the running job when the lock is held — no new locking primitive
  - On purge or reset failure, leave the phase `competitive` and report the rollover incomplete so a retry resumes at the idempotent Stage 3
  - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6_

- [x] 6.3 Create the season changelog draft
  - On rollover completion, insert a `changelog_entries` row with status `draft` and category `balance` naming the new Season_Number
  - Wrap in try/catch: a failure is logged and the rollover still reports success
  - _Requirements: 22.1, 22.2_

- [x] 6.4 Write the verification gate property test
  - Property: the purge executes if and only if archive counts match, for arbitrary populations of Human_Stables and Generated_Stables; a mismatch aborts with all operational data intact (design Property 5)
  - _Requirements: 5.2, 5.3_

- [x] 7. Image_Library
- [x] 7.1 Implement `app/backend/src/services/moderation/imageLibraryService.ts`
  - `listImages(userId)` returns only images under the caller's own `uploads/user-robots/{userId}/` directory, never another user's, each with `uploadedAt`, current robot use count, and archived season reference count
  - `selectImage(userId, path)` and `deleteImage(userId, path)` resolve the path through the existing `getAbsolutePath` traversal guard and then assert it sits under the caller's own directory, rejecting otherwise with a generic `403 Access denied` that reveals nothing about existence
  - Enforce the Retained_Images_Per_Stable cap: an upload at the limit is rejected naming the limit and that an existing image must be deleted first — no automatic eviction
  - Operate exclusively within `uploads/user-robots/`; never traverse or delete the static asset directory
  - _Requirements: 30.4, 30.5, 30.6, 30.7, 30.10, 30.11, 30.26_

- [x] 7.2 Implement image deletion impact and cascade
  - `getImpact(userId, path)` reports affected current robots and archived seasons so the confirmation prompt can name them
  - Deleting an image used by a current robot sets that robot's `imageUrl` to null so it falls back to the default icon
  - Deleting an image referenced by a Robot_Season_Archive sets the archived image path to null, leaving every other archived value unchanged
  - Require an explicit confirmation flag before deleting
  - _Requirements: 30.12, 30.13, 30.14, 30.15, 30.16_

- [x] 7.3 Make `cleanupOrphans` archive-aware
  - Build the `referencedUrls` set in `fileStorageService.cleanupOrphans` from both live `robots.imageUrl` and every non-null `RobotSeasonArchive.imageUrl`
  - Verify the rollover retains image files: Stage 3 deletes `robots` rows and calls no `deleteImage`
  - Confirm the archived image path resolves to a file on disk so the expanded season row renders the image
  - _Requirements: 30.1, 30.2, 30.3_

- [x] 7.4 Add the image routes
  - `GET /api/images` and `DELETE /api/images/:filename` in `app/backend/src/routes/images.ts`, both with Zod schemas via `validateRequest`
  - Uploads keep the existing per-user upload rate limiter and content moderation unchanged
  - Selecting a retained image runs no content moderation, because the image passed moderation at upload
  - Deleting a user account deletes that user's entire image directory
  - _Requirements: 30.9, 30.20, 30.21_

- [x] 7.5 Confirm static asset handling for Generated_Stable robots
  - Assert `generateBattleReadyUsers` continues to reference `/assets/robots/{tier}_512x512.webp` for newly generated robots in a new season, with no per-season asset provisioning
  - Assert no rollover path deletes anything under the static asset directory
  - _Requirements: 30.24, 30.25_

- [x] 7.6 Write Image_Library property tests
  - Property: the `cleanupOrphans` referenced set is a superset of every path referenced by live robots or archive rows, so no archive-reachable image is ever swept (design Property 10)
  - Property: `selectImage` and `deleteImage` succeed only when the resolved path is under the caller's own directory; traversal sequences and other users' ids always reject (design Property 11)
  - _Requirements: 30.3, 30.5, 30.6, 30.7_

- [x] 8. Account_Reset scope changes
- [x] 8.1 Widen and re-scope `performAccountReset` in `resetService.ts`
  - Additionally clear `user_achievements`, `prestige`, all four championship counters, `pinnedAchievements`, `totalPracticeBattles`, tuning allocations, subscriptions, and team memberships, matching what Season_Rollover sets
  - Remove the eager `fileStorageService.deleteImage` loop so the Image_Library is retained
  - Leave `lastSeenSeasonNumber` unchanged
  - Continue to record a `reset_logs` row
  - _Requirements: 4.7, 4.10, 4.11, 4.14, 30.19_

- [x] 8.2 Verify reset behaviour against seasons and archives
  - Integration test that a reset during the Preparation_Phase is permitted and reports no scheduled-match, tournament, or pending-battle blocker
  - Assert every Stable_Season_Archive, Robot_Season_Archive, and Season_Accolade row of every completed season is unchanged, and the Stable_Page still lists every completed season for that stable
  - Assert a reset is declined with the existing scheduled-match blocker when a robot holds a `scheduled_matches_v2` row created on competitive cycle 1 or later
  - _Requirements: 4.6, 4.8, 4.9, 4.12, 4.13_

- [x] 9. Season_API
- [x] 9.1 Add player season routes in `app/backend/src/routes/seasons.ts`
  - `GET /api/seasons/current` returning the full SeasonState
  - `GET /api/seasons` returning completed seasons ordered by Season_Number descending
  - `GET /api/seasons/:seasonNumber` returning that season's standings snapshot, accolades, and participation counts
  - `GET /api/seasons/stables/:userId` returning collapsed archive rows ordered by Season_Number descending
  - `GET /api/seasons/stables/:userId/:seasonNumber` returning robots, archived team standings, and accolades
  - `POST /api/seasons/summary-seen` recording `lastSeenSeasonNumber`
  - Return 404 when a user has no archive for the requested Season_Number
  - Apply the same `profileVisibility` rules the existing stable endpoint applies
  - Validate every param, query, and body field with Zod via `validateRequest`, using the primitives from `securityValidation.ts`
  - Register the router in `src/index.ts`
  - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 15.5_

- [x] 9.2 Scope Hall_of_Records to the current season
  - Include the current Season_Number in every records response, and the Season_Cycle at which the data was read
  - Return every category empty while the phase is `preparation`
  - Confirm the Leaderboard_Cache contains only current-season entries after the first competitive settlement
  - Confirm no query changes are needed because the purge empties the operational tables
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 17.9, 10.3_

- [x] 10. Admin season management
- [x] 10.1 Add admin season routes in `app/backend/src/routes/admin/seasons.ts`
  - `GET /api/admin/seasons/state` returning Season_Number, phase, cycles completed and remaining, and the last rollover timestamp
  - `GET /api/admin/seasons/rollover-preview` returning stables and robots that would be archived, rows that would be purged per table, Generated_Stables that would be deleted reported separately from Human_Stables archived, and image files that would be retained versus deleted — modifying no data
  - `POST /api/admin/seasons/rollover` requiring an explicit confirmation value, declining without it and reporting that confirmation is required; permitted for Season_Zero and executing immediately without waiting for a settlement boundary
  - `POST /api/admin/seasons/extend` increasing the effective length of the current season only, leaving Season_Length_Cycles unchanged for later seasons
  - `POST /api/admin/seasons/preparation-cycles` accepting 0–7 for the current Preparation_Phase
  - Every action writes an `admin_audit_logs` row with the administrator identifier, action, and resulting season state; every route sits behind `requireAdmin`
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8, 18.9, 24.5, 29.12, 30.23_

- [x] 10.2 Surface the season changelog draft in the admin portal
  - Display the draft `changelog_entries` row created by the rollover so an administrator can find and publish it without searching the changelog list
  - _Requirements: 22.5_

- [x] 11. Frontend season surfaces
- [x] 11.1 Add the season store and hook
  - `app/frontend/src/stores/useSeasonStore.ts` fetching `/api/seasons/current`, consumed via selectors only — never whole-store subscriptions
  - Every displayed cycle value comes from the endpoint; no client-side computation from timestamps or the Global_Cycle_Counter
  - _Requirements: 17.5_

- [x] 11.2 Build `SeasonProgressIndicator`
  - `app/frontend/src/components/season/SeasonProgressIndicator.tsx`, rendered on every authenticated page via the navigation
  - Competitive: `Season {n} · Cycle {c} / {length}`; preparation: `Season {n} · Preparation {day} / {length}`; Season_Zero: `Season 0 · Cycle {c}` with no length and no remaining count
  - Below 1024px render the condensed form retaining the season number and the N / M progression
  - Omit the indicator entirely when the season endpoint fails rather than showing placeholder or stale values
  - The Stable page season history block shows the number of competitive cycles each completed season ran
  - _Requirements: 17.1, 17.2, 17.3, 17.6, 17.7, 17.8, 24.4_

- [x] 11.3 Build `SeasonCountdownBanner`
  - Display during the final Countdown_Cycles competitive cycles, stating the season number, remaining cycles, and that all stable contents will be archived and reset
  - Link to the Stable page season history block
  - Dismissal suppresses it for the remainder of the cycle and it reappears on the next cycle
  - Below 640px the text wraps rather than truncating the remaining cycle count, and the dismiss control stays clear of the link target
  - _Requirements: 16.1, 16.2, 16.3, 28.9_

- [x] 11.4 Build `SeasonSummaryModal`
  - Shown once per season per user when a completed archive exists with a Season_Number greater than `lastSeenSeasonNumber`; never shown when the user has no completed archive
  - Display the completed season number, final credits, prestige earned, W/L/D, best tier with its mode, achievement count, up to three accolades, and the remaining preparation cycles
  - Link to the changelog
  - Dismissal records the completed Season_Number as last seen
  - Fit within 320×568, scrolling its own content, dismiss control reachable without scrolling
  - _Requirements: 15.2, 15.3, 15.4, 15.5, 15.6, 22.3, 28.8_

- [x] 11.5 Add Dashboard preparation and cycle-1 states
  - Display the current Season_Number, Season_Cycle, Season_Length_Cycles, and remaining competitive cycles
  - During preparation display the preparation day, remaining cycles, a statement that no competitive battles are scheduled, and a changelog link; omit upcoming battle listings rather than showing an empty error state
  - On competitive cycle 1 state that matches have been scheduled and the first battles run on the next cycle
  - Confirm every building action remains permitted during preparation: robot creation, weapon purchase, refinement, resale, facility purchase and upgrade, attribute upgrades, tuning allocation, loadout and stance changes, team creation and membership changes, event subscription changes, and Practice Arena battles
  - Confirm a subscription set during preparation persists so the robot is eligible for matchmaking on the first competitive cycle
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 17.4, 3.8, 22.4_

- [x] 11.6 Build the Stable page season history block
  - `app/frontend/src/components/stable/SeasonHistoryBlock.tsx` in `StableViewPage.tsx`: one row per completed season ordered by Season_Number descending
  - Collapsed row shows season number, competitive cycles run, final credits, prestige earned, W/L/D, win rate, best tier with mode, championship titles, achievement count
  - Expanding shows every Robot_Season_Archive with name, image, final ELO, fame, W/L/D, and per-mode tier, instance, LP, and Instance_Rank; plus archived team names, sizes, and standings; plus that season's accolades filtered to this stable as a labelled rank/category/subject list
  - A stable with no completed seasons shows a message that its first season is in progress
  - Where the Season_Number is 0, label the row as career totals accumulated before the Season System, since its prestige, battle record, highest ELO, achievement counts, and championship titles are career-to-date values with no season baseline
  - Collapsed rows load with the initial stable request; expanded detail loads on demand
  - Below 1024px each collapsed season is a full-width card with wrapping figures, and expanded detail stacks one card per robot with standings listed vertically
  - Archived figures are presented as stored, never restated in terms of current balance values
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 24.8, 24.9, 23.3, 28.3, 28.4_

- [x] 11.7 Build the Season_Archive_Page
  - `app/frontend/src/pages/SeasonArchivePage.tsx` at route `/seasons` in `App.tsx`, lazy-loaded, listing every completed season ordered by Season_Number descending
  - Each season shows Season_Number, competitive cycles run, start and end dates, participating stable counts reported separately for Human_Stables and Generated_Stables, and the legacy label where the Season_Number is 0
  - Selecting a season shows final standings per mode from the Season_Standing_Snapshot, champion stables, and accolades, labelling Generated_Stable entries as system-generated competitors
  - Cover every mode present in the season's archive: 1v1, 2v2, 3v3 League, Tag Team, KotH, Grand Melee, and each tournament type
  - Stable names link to that stable's history block; apply the same visibility rules the Season_API applies
  - No completed season shows a message that the first season is in progress
  - Paginate or lazily load detail so the initial request returns only the season list
  - Add the navigation entry grouped with the Hall of Records link in `Navigation.tsx`
  - Render at 320px and above without horizontal scrolling, collapsing per-season detail into stacked sections below 1024px
  - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5, 25.6, 25.7, 25.8, 25.9, 25.10, 8.6, 8.15, 29.13_

- [x] 11.8 Build the Image_Library UI
  - Present the player's own retained images with, per image, how many current robots use it and how many archived seasons reference it, plus the retained count against the cap
  - Allow selecting a retained image when creating a robot or changing a robot's image, and deleting an image behind an explicit confirmation that names affected robots
  - Where another stable's robots or archived seasons are viewed, render images for display only with no action that copies or selects them
  - _Requirements: 30.8, 30.17, 30.22_

- [x] 11.9 Write mobile responsiveness tests for every season surface
  - Assert each of the Season_Archive_Page, Stable history block, Season_Summary_Modal, Season_Countdown_Banner, Season_Progress_Indicator, Dashboard preparation state, Admin_Season_Portal, and Image_Library renders at 320, 375, and 1024px with no element exceeding the viewport width
  - Assert every interactive control presents a touch target of at least 44×44px
  - Assert wide tables reduce visible columns to identifier plus primary figure rather than overflowing
  - Assert the admin portal stacks to one column below 1024px with destructive actions visually separated, and the Rollover_Preview counts render as a label/value list
  - Use the documented `useMediaQuery('(min-width: 1024px)')` pattern with `TabLayout.tsx` as the reference
  - _Requirements: 28.1, 28.2, 28.5, 28.6, 28.7, 28.10, 28.11, 28.12_

- [x] 11.10 Update the existing Playwright E2E suites that this spec breaks
  - `app/frontend/tests/e2e/protected-pages.spec.ts` enumerates 9 protected routes and asserts each primary heading; add `/seasons` with the Season_Archive_Page heading so the new route is smoke-covered
  - `app/frontend/tests/e2e/guide.spec.ts` filters section links on a fixed name list (`Getting Started|Combat|Economy|Robots|Weapons|Leagues|Facilities|Prestige|Tournaments|Strategy`); extend it to include the new `Seasons` section so the assertion reflects the registered sections
  - `app/frontend/tests/e2e/dashboard.spec.ts` asserts the Command Center heading and cards; confirm the added season progress and preparation messaging do not break existing selectors
  - _Requirements: 25.7, 26.1, 17.4_

- [x] 11.11 Add Playwright E2E coverage for the season surfaces
  - New `app/frontend/tests/e2e/seasons.spec.ts`: the Season_Archive_Page loads at `/seasons`, shows the empty-state message when no season has completed, and is reachable from the navigation entry
  - Assert the Season_Progress_Indicator is visible on an authenticated page and states a season number and cycle
  - Assert the Stable page renders the season history block, showing the first-season-in-progress message for a stable with no completed seasons
  - Assert the Image_Library lists only the signed-in player's own images and offers a delete control behind a confirmation
  - Keep the suite resilient to a database with no completed seasons, since that is the state on a fresh e2e database
  - _Requirements: 14.6, 17.1, 25.1, 25.6, 25.7, 30.4, 30.13_

- [x] 12. Seed and local development support
- [x] 12.1 Set `isGenerated` in the seed and generator
  - `generateBattleReadyUsers` sets `isGenerated` true on every stable it creates
  - `seed.ts` sets `isGenerated` true for `test_user_NNN` stables and false for the `admin` account
  - The Onboarding_Service leaves it false for registered players
  - _Requirements: 29.1, 29.10, 29.11_

- [x] 12.2 Make the seed produce rollover-testable data
  - The seed creates a Season record when none exists, matching the Season_Service behaviour
  - The seed produces enough stables, robots, teams, standings, and completed battles for a local rollover to write a non-empty archive containing Robot_Season_Archive rows, archived team standings, and Season_Accolade rows
  - _Requirements: 27.3, 27.4_

- [x] 12.3 Verify the manual settlement trigger drives seasons
  - Confirm the admin manual settlement trigger advances the season phase counters exactly as a scheduled settlement does, so a rollover can be reached without waiting for cron
  - Confirm Season_Length_Cycles 1 and Preparation_Length_Cycles 0 are accepted so a full season runs in a handful of cycles locally
  - _Requirements: 27.1, 27.2_

- [x] 12.4 Write the end-to-end rollover integration tests
  - Full rollover against a seeded database asserting the archive counts of the verification gate and zero rows in every table the reset and purge cover
  - Season_Zero closure asserting no rollover occurs while no manual trigger is issued, and that a manual trigger closes it and opens Season 1 in preparation
  - _Requirements: 27.6, 27.7, 24.6_

- [x] 13. In-game guide content
- [x] 13.1 Author the `seasons` guide section
  - Create `app/backend/src/content/guide/seasons/` with articles covering the season structure, what resets, what survives, the Preparation_Phase, and how to read the Season_Archive; register the section in `sections.json`
  - State explicitly that robots, weapons, facilities, attributes, tuning, credits, teams, subscriptions, standings, fame, prestige, achievements, and championship titles are deleted at a rollover, and that accounts, profile settings, and the archive survive
  - State that no battle events are scheduled during preparation and that subscriptions set during preparation take effect on the first competitive cycle
  - State that the first battles of a season run on competitive cycle 2 because each job executes previously scheduled matches before scheduling new ones
  - State that custom uploaded robot images survive the reset and can be re-applied to a new season's robots
  - _Requirements: 26.1, 26.2, 26.3, 3.9, 31.18_

- [x] 13.2 Correct guide sections that describe progression as permanent
  - `prestige-fame`: prestige resets at each rollover and is not a lifetime total
  - `achievements`: achievements reset at each rollover and are recorded per season in the archive
  - Review and correct `leagues`, `economy`, `grand-melee`, `king-of-the-hill`, `team-battles`, `tournaments` wherever they describe progression as permanent or open-ended
  - `getting-started`: state the current season length and that a mid-season joiner receives the same starting package
  - _Requirements: 26.4, 26.5, 26.6, 26.7_

- [x] 14. Documentation and steering updates
- [x] 14.1 Create `docs/game-systems/PRD_SEASON_SYSTEM.md`
  - Authoritative description of the season structure, reset and preservation scope, Preparation_Phase, Season_Archive model, Season_Zero and the Season_Number 0 convention, and the early-season bot population property
  - State that the Preparation_Phase is the window in which balance changes are applied, and that this spec resets prestige and achievements, superseding backlog item #41
  - Add it to `docs/game-systems/README.md`
  - _Requirements: 31.9, 31.14, 31.15, 31.16, 23.4_

- [x] 14.2 Correct the affected game-system PRDs
  - `PRD_CYCLE_SYSTEM.md`: settlement reads the phase first, skips every economic step during preparation, leaves the Global_Cycle_Counter unchanged, and invokes the rollover at the boundary
  - `PRD_PRESTIGE_AND_FAME.md`: prestige and fame reset at each rollover
  - `PRD_ACHIEVEMENT_SYSTEM.md`: achievements reset at each rollover and are recorded per season
  - `PRD_LEAGUE_SYSTEM.md`: standings, tiers, LP, and ELO reset; league history is purged once archived
  - `PRD_AUTO_USER_GENERATION.md`: Generated_Stables are deleted at each rollover, generation restarts from the reset counter, and seeded test stables are Generated_Stables
  - _Requirements: 31.10, 31.11, 31.12, 31.13, 29.14_

- [x] 14.3 Update architecture and page documentation
  - `docs/architecture/PRD_SERVICE_DIRECTORY.md`: the Cron Schedule section states that all Battle_Event_Jobs and the economic steps of the Settlement_Job are suspended during preparation
  - `docs/architecture/DATABASE_SCHEMA.md`: document the five new tables, Season_Zero and the Season_Number 0 legacy convention, `isGenerated`, and the Season_Standing_Snapshot
  - `docs/prd_pages/`: describe the Stable page season history block and add a page document for the Season_Archive_Page
  - _Requirements: 31.1, 31.4, 31.6, 31.8, 31.17, 31.19_

- [x] 14.4 Update steering files
  - `.kiro/steering/project-overview.md`: add the Season System to Key Systems with its reset scope and preparation window
  - `.kiro/steering/coding-standards.md`: state that season-scoped queries must not assume data older than the current season exists, and that cross-season history must be read from the Season_Archive tables
  - _Requirements: 31.2, 31.3_

- [x] 14.5 Update guides and the backlog
  - `docs/guides/ADMIN_PANEL_GUIDE.md`: document the Admin_Season_Portal, the Rollover_Preview, the manual rollover, the phase length controls, and Season_Zero closure
  - `docs/guides/operations/LOCAL_SETUP.md`: document the season environment variables, the values for a fast local season, and the admin action sequence that drives a rollover end to end
  - `docs/guides/ERROR_CODES.md`: add the `SeasonErrorCode` values
  - `docs/balance_changes/README.md`: state that balance changes are applied during a Preparation_Phase and that each document names the Season_Number it took effect in
  - `docs/BACKLOG.md`: replace item #41 with a reference to this spec
  - _Requirements: 31.5, 31.7, 27.5, 23.5_

- [x] 15. Final verification
- [x] 15.1 Run the Verification Criteria from the requirements document
  - Confirm the season and archive models are present in `schema.prisma`, the scheduler consults the Season_Service, and preparation logic exists under `src/services/season/`
  - Run the backend season, scheduler, and resetService test suites, and the frontend build and season surface tests including the 320/375/1024px and touch target assertions
  - Run the Playwright suite and confirm `protected-pages`, `guide`, `dashboard`, and the new `seasons` spec all pass
  - Confirm the Stable page renders season history, the season API and admin endpoints are registered, and the progress indicator is present in navigation and on the Dashboard
  - Confirm the guide `seasons` section exists and is registered, the prestige and achievement articles state they reset, `PRD_SEASON_SYSTEM.md` exists, and the Season_Archive_Page is routed and linked
  - Confirm `LOCAL_SETUP.md` documents the fast-season variables
  - Confirm `users` holds zero `is_generated` rows immediately after a rollover and that `season_standing_snapshots` retains bot entries
  - Run the `prisma migrate diff --exit-code` drift check and confirm it exits 0 and is present in `ci.yml`
  - Confirm the tournament timing defect and balance changes were not implemented here — they belong to spec 46
  - _Requirements: 23.1, 23.2_

## Notes

**Requirements coverage.** All 272 acceptance criteria across the 31 requirements appear in at least one `_Requirements:` trace above, verified mechanically.

**Deliberately not built here.** Three things were considered and rejected during the requirements and design phases; do not add them back while implementing:

- No balance-freeze deploy guard, environment flag, or phase-aware seed gating. Acceptance is the only deployed environment and must stay deployable at any point in a season.
- No `scheduledEndCycles` column or countdown mechanism for Season_Zero. It closes by one admin action.
- No legacy boolean on the Season row or archive rows. `Season_Number === 0` is the marker.

**Out of scope, already shipped as spec 46.** The tournament auto-creation timing defect and eleven balance and bugfix items shipped in `.kiro/specs/done-july26/46-bugfixes-and-balance/` (shipped).

**Accepted behaviours, not bugs.** Competitive cycle 1 executes no battles and only schedules for cycle 2, because every Battle_Event_Job executes previously scheduled matches before scheduling new ones. With `PREPARATION_LENGTH_CYCLES = 2` that means three consecutive non-combat days; set it to 1 for two. The bot population also restarts at one stable on cycle 1 because the Global_Cycle_Counter resets, so early-season matchmaking pools are thin and rely on the existing in-memory bye robot.

**The riskiest single change** is task 5.2 combined with 7.3: the reset deletes `robots` rows while retaining their image files, and the orphan sweep must already know about archive references before that lands. Verify 7.3 before running any rollover against real data.
