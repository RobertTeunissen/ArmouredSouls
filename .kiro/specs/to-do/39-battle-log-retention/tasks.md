# Tasks: Battle Log Retention — Phase 2

## Task Group 1: Shared Statistics Module

- [x] 1.1 Extract `computeBattleStatistics` to `app/shared/utils/battleStatistics.ts`
  - Copy from `app/frontend/src/utils/battleStatistics.ts`
  - Remove React/frontend-specific imports (there should be none — it's pure computation)
  - Export all interfaces (`BattleStatistics`, `RobotCombatStats`, `DamageFlow`, etc.)
  - Add to `app/shared/utils/index.ts` barrel export
  - _Requirements: 1.2_

- [x] 1.2 Update frontend to import from shared
  - Change `app/frontend/src/utils/battleStatistics.ts` to re-export from `../../shared/utils/battleStatistics`
  - Or update all import paths directly (grep for `from '../utils/battleStatistics'` and `from '../../utils/battleStatistics'`)
  - Verify all existing frontend tests pass (`pnpm test --run` in `app/frontend`)
  - _Requirements: 1.2_

- [x] 1.3 Create backend summary computer service
  - Create `app/backend/src/services/battle/battleSummaryComputer.ts`
  - Import `computeBattleStatistics` from shared
  - Add wrapper that resolves robot IDs, positions, KotH data, and returns the full summary shape matching the `BattleSummary` Prisma model
  - _Requirements: 1.1, 1.2_

## Task Group 2: Orchestrator Integration (Write Path)

- [x] 2.1 League 1v1 orchestrator writes summary
  - In `leagueBattleOrchestrator.ts`: after battle creation, call `battleSummaryComputer` and insert `BattleSummary` row
  - Set `battles.winning_side = NULL` (1v1 doesn't use it — winner is in `winner_id`)
  - Wrap in try/catch: if summary fails, log error but don't fail the battle
  - _Requirements: 1.1_

- [x] 2.2 Tournament 1v1 orchestrator writes summary
  - In `tournamentBattleOrchestrator.ts`: same pattern as 2.1
  - _Requirements: 1.1_

- [x] 2.3 Tag team orchestrator writes summary
  - In `tagTeamBattleRecord.ts`: write summary + set `winning_side`
  - _Requirements: 1.1_

- [x] 2.4 Team battle orchestrator writes summary (2v2/3v3 league)
  - In `teamBattleOrchestrator.ts`: write summary + set `winning_side`
  - _Requirements: 1.1_

- [x] 2.5 Team tournament orchestrator writes summary (2v2/3v3 tournament)
  - In `teamTournamentBattleOrchestrator.ts`: write summary + set `winning_side`
  - _Requirements: 1.1_

- [x] 2.6 KotH orchestrator writes summary
  - In `kothBattleOrchestrator.ts`: write summary with `koth_placements` and `koth_data`
  - `winning_side` = NULL for KotH (no "sides" — it's FFA)
  - _Requirements: 1.1_

## Task Group 3: Backend Reader Refactors

- [x] 3.1 Refactor `getBattleLog()` — team battle winner from column
  - In `matchHistoryService.ts`: replace `battleLog.winningSide` read with `battle.winningSide` column (with JSON fallback for pre-migration battles)
  - Add `playbackAvailable: boolean` to response (true if `battle_log IS NOT NULL`)
  - Include `summary` in response (JOIN `battle_summaries` by `battle_id`)
  - Handle NULL `battle_log` gracefully (don't crash, return summary-only response)
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 3.2 Refactor `getPerformanceContext()` — winning_side from column
  - In `robotQueryService.ts`: replace all `battleLog.winningSide` reads with `battle.winningSide` (with JSON fallback)
  - _Requirements: 2.3_

- [x] 3.3 Refactor `formatKothHistoryEntry()` — zone scores from summary
  - In `matchHistoryService.ts`: read `koth_placements` from `battle_summaries`, fallback to battle_log for pre-migration battles
  - _Requirements: 3.1_

- [x] 3.4 Remove dead `getKothStandingsLast10()` function
  - In `kothStandingsService.ts`: removed entirely (no frontend consumer exists)
  - _Requirements: 3.2_

- [x] 3.5 Refactor Hall of Records survival query
  - In `records-queries.ts`: replaced `jsonb_array_elements(b.battle_log->'participants')` with `jsonb_array_elements(bs.participants)` joining `battle_summaries bs`
  - _Requirements: 3.3_

- [x] 3.6 Refactor admin battle detail
  - In `adminBattleService.ts`: returns `{ pruned: true }` when `battle_log` is NULL
  - _Requirements: 3.4_


## Task Group 4: Frontend Changes

- [x] 4.1 Battle detail page reads from summary
  - In `BattleDetailPage.tsx`: reads `response.summary.perRobot` and `response.summary.damageFlows` when available
  - Falls back to client-side `computeBattleStatistics()` for battles without summaries
  - `ArenaSummary` reads positions from summary when battleLog is null
  - _Requirements: 2.1_

- [x] 4.2 Playback unavailability notice
  - Created `PlaybackUnavailableNotice.tsx` component
  - Message: "Battle replay is available for 7 days after the battle. The overview and statistics above are preserved permanently."
  - _Requirements: 2.2_

- [x] 4.3 Integrate playback notice into battle detail page
  - Shows `PlaybackUnavailableNotice` when `playbackAvailable === false`
  - Playback tab still shows viewer when data is available
  - _Requirements: 2.2_

- [ ] 4.4 Lazy-load playback data
  - Deferred: current implementation works because playback hook naturally returns null when battleLog is null
  - The full lazy-load split (separate /replay endpoint) is a follow-up optimization
  - _Requirements: 2.1, 2.2_

- [ ] 4.5 Admin battle detail handles pruned state
  - Backend returns `{ pruned: true }` (done in task 3.6). Frontend handling deferred.
  - _Requirements: 3.4_

## Task Group 5: Retention Cron Job

- [x] 5.1 Create retention service
  - Created `app/backend/src/services/retention/battleLogRetentionService.ts`
  - Batched UPDATE (1000 per batch, 100ms sleep), idempotent, logged
  - Reads `BATTLE_LOG_RETENTION_DAYS` env (default: 7)
  - _Requirements: 4.1_

- [x] 5.2 Register retention cron in application bootstrap
  - Registered in `src/index.ts` alongside `initDailyHealthReport()`
  - Schedule: `30 1 * * *` (01:30 UTC daily)
  - Logs start/completion, catches errors
  - _Requirements: 4.1, 4.2_

- [ ] 5.3 Add `BATTLE_LOG_RETENTION_DAYS` to env config
  - Currently reads from `process.env` directly. Formal Zod schema integration deferred.
  - _Requirements: 4.1_

## Task Group 6: Backfill Completion

- [x] 6.1 Rewrite backfill script for memory safety
  - Rewritten to process one battle at a time via raw SQL (no batch loading of battle_log into Node)
  - Uses `ON CONFLICT DO NOTHING` for idempotency
  - Configurable via BACKFILL_BATCH_SIZE, BACKFILL_SLEEP_MS, BACKFILL_START_ID env vars
  - _Requirements: 5.1_

- [ ] 6.2 Run backfill for remaining battles
  - Execute on ACC to fill remaining ~25K missing summaries
  - Verify: `SELECT count(*) FROM battles WHERE battle_log IS NOT NULL AND NOT EXISTS (SELECT 1 FROM battle_summaries WHERE battle_id = battles.id)` = 0
  - _Requirements: 5.1_

## Task Group 7: Documentation Updates

- [x] 7.1 Update `.kiro/steering/project-overview.md`
  - Added "Battle Summary & Retention" as Key System #17
  - _Requirements: 6.1_

- [x] 7.2 Update `.kiro/steering/coding-standards.md`
  - Added "Battle Data Architecture (Spec #39)" section with rules for battle_log, winning_side, shared computation
  - _Requirements: 6.1_

- [ ] 7.3 Update `docs/architecture/PRD_SERVICE_DIRECTORY.md`
  - Add retention cron to the daily schedule at 01:30 UTC
  - _Requirements: 6.1_

- [ ] 7.4 Update `docs/guides/operations/MONITORING.md` and `MAINTENANCE.md`
  - Document retention job: schedule, behavior, monitoring alerts
  - Document manual VACUUM procedure after large retention runs
  - _Requirements: 6.1_

- [ ] 7.5 Update `docs/BACKLOG.md`
  - Move item #53 (Battle Log Retention / TOAST Trim) to "Recently Completed"
  - _Requirements: 6.1_

## Task Group 8: Verification

- [ ] 8.1 Run verification criteria
  - Run all 5 verification criteria from the requirements document
  - Confirm zero `battle_log` reads in migrated services
  - Confirm retention cron processes correctly
  - Confirm frontend renders overview for old battles and playback for recent ones
  - Confirm new battles get summaries at creation
  - _Requirements: all_
