# Tasks: Battle Log Retention — Phase 2

## Task Group 1: Shared Statistics Module

- [ ] 1.1 Extract `computeBattleStatistics` to `app/shared/utils/battleStatistics.ts`
  - Copy from `app/frontend/src/utils/battleStatistics.ts`
  - Remove React/frontend-specific imports (there should be none — it's pure computation)
  - Export all interfaces (`BattleStatistics`, `RobotCombatStats`, `DamageFlow`, etc.)
  - Add to `app/shared/utils/index.ts` barrel export
  - _Requirements: 1.2_

- [ ] 1.2 Update frontend to import from shared
  - Change `app/frontend/src/utils/battleStatistics.ts` to re-export from `../../shared/utils/battleStatistics`
  - Or update all import paths directly (grep for `from '../utils/battleStatistics'` and `from '../../utils/battleStatistics'`)
  - Verify all existing frontend tests pass (`pnpm test --run` in `app/frontend`)
  - _Requirements: 1.2_

- [ ] 1.3 Create backend summary computer service
  - Create `app/backend/src/services/battle/battleSummaryComputer.ts`
  - Import `computeBattleStatistics` from shared
  - Add wrapper that resolves robot IDs, positions, KotH data, and returns the full summary shape matching the `BattleSummary` Prisma model
  - _Requirements: 1.1, 1.2_

## Task Group 2: Orchestrator Integration (Write Path)

- [ ] 2.1 League 1v1 orchestrator writes summary
  - In `leagueBattleOrchestrator.ts`: after battle creation, call `battleSummaryComputer` and insert `BattleSummary` row
  - Set `battles.winning_side = NULL` (1v1 doesn't use it — winner is in `winner_id`)
  - Wrap in try/catch: if summary fails, log error but don't fail the battle
  - _Requirements: 1.1_

- [ ] 2.2 Tournament 1v1 orchestrator writes summary
  - In `tournamentBattleOrchestrator.ts`: same pattern as 2.1
  - _Requirements: 1.1_

- [ ] 2.3 Tag team orchestrator writes summary
  - In `tagTeamBattleRecord.ts`: write summary + set `winning_side`
  - _Requirements: 1.1_

- [ ] 2.4 Team battle orchestrator writes summary (2v2/3v3 league)
  - In `teamBattleOrchestrator.ts`: write summary + set `winning_side`
  - _Requirements: 1.1_

- [ ] 2.5 Team tournament orchestrator writes summary (2v2/3v3 tournament)
  - In `teamTournamentBattleOrchestrator.ts`: write summary + set `winning_side`
  - _Requirements: 1.1_

- [ ] 2.6 KotH orchestrator writes summary
  - In `kothBattleOrchestrator.ts`: write summary with `koth_placements` and `koth_data`
  - `winning_side` = NULL for KotH (no "sides" — it's FFA)
  - _Requirements: 1.1_

## Task Group 3: Backend Reader Refactors

- [ ] 3.1 Refactor `getBattleLog()` — team battle winner from column
  - In `matchHistoryService.ts`: replace `battleLog.winningSide` read with `battle.winningSide` column
  - Add `playbackAvailable: boolean` to response (true if `battle_log IS NOT NULL`)
  - Include `summary` in response (JOIN `battle_summaries` by `battle_id`)
  - Handle NULL `battle_log` gracefully (don't crash, return summary-only response)
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 3.2 Refactor `getPerformanceContext()` — winning_side from column
  - In `robotQueryService.ts`: replace all `battleLog.winningSide` reads with `battle.winningSide`
  - Remove `battleLog: true` from the select (no longer needed for this query)
  - _Requirements: 2.3_

- [ ] 3.3 Refactor `formatKothHistoryEntry()` — zone scores from summary
  - In `matchHistoryService.ts`: JOIN `battle_summaries` and read `koth_placements` for zone score
  - Remove `battleLog` access from this function
  - _Requirements: 3.1_

- [ ] 3.4 Refactor `getKothStandingsLast10()` — placements from summary
  - In `kothStandingsService.ts`: instead of loading `battle.battleLog`, JOIN `battle_summaries` and read `koth_placements`
  - Remove all `battleLog` access from this service
  - _Requirements: 3.2_

- [ ] 3.5 Refactor Hall of Records survival query
  - In `records-queries.ts`: replace `jsonb_array_elements(b.battle_log->'participants')` with `jsonb_array_elements(bs.participants)` joining `battle_summaries bs`
  - _Requirements: 3.3_

- [ ] 3.6 Refactor admin battle detail
  - In `adminBattleService.ts`: return `battle_log` if present, otherwise `{ pruned: true, prunedAt: battle.createdAt + 7 days }`
  - _Requirements: 3.4_


## Task Group 4: Frontend Changes

- [ ] 4.1 Battle detail page reads from summary
  - In `BattleDetailPage.tsx`: read `response.summary.perRobot` and `response.summary.damageFlows` instead of calling `computeBattleStatistics()`
  - Remove the `useMemo` block that computes statistics from events
  - Pass pre-computed stats directly to `BattleStatisticsSummary` and `DamageFlowDiagram`
  - `ArenaSummary` reads `summary.startingPositions/endingPositions` from the summary
  - _Requirements: 2.1_

- [ ] 4.2 Playback unavailability notice
  - Create `app/frontend/src/components/battle-detail/PlaybackUnavailableNotice.tsx`
  - Renders when `playbackAvailable === false`
  - Message: "Battle replay is available for 7 days after the battle. The overview and statistics above are preserved permanently."
  - Styled: `bg-surface rounded-lg p-4`, `text-secondary`, informational icon
  - _Requirements: 2.2_

- [ ] 4.3 Integrate playback notice into battle detail page
  - In `BattleDetailPage.tsx`: check `response.playbackAvailable`
  - Desktop: Playback tab shows `PlaybackUnavailableNotice` instead of viewer
  - Mobile: where CombatMessages would render, show notice if events unavailable
  - Hide the Playback tab label entirely? Or keep it visible but show notice inside? (keep visible — player knows it exists but is time-limited)
  - _Requirements: 2.2_

- [ ] 4.4 Lazy-load playback data
  - The full `battle_log` (events + detailedCombatEvents) should only be fetched when the Playback tab is opened, not on initial page load
  - Create a separate API call (`GET /api/matches/battles/:id/replay`) that returns the raw events
  - `useBattlePlaybackData` hook fetches this lazily when tab is activated
  - If API returns 410 Gone → set `playbackAvailable = false`
  - _Requirements: 2.1, 2.2_

- [ ] 4.5 Admin battle detail handles pruned state
  - In `BattleLogsPage.tsx`: when `battle.battleLog` is `{ pruned: true }`, show "Combat log pruned (retained for 7 days)" instead of the event viewer
  - _Requirements: 3.4_

## Task Group 5: Retention Cron Job

- [ ] 5.1 Create retention service
  - Create `app/backend/src/services/retention/battleLogRetentionService.ts`
  - Function `runBattleLogRetention()`: batched UPDATE setting `battle_log = NULL` where `created_at < cutoff AND battle_log IS NOT NULL`
  - Batch size 1000, sleep 100ms between batches
  - Returns `{ battlesProcessed, durationMs }`
  - Reads `BATTLE_LOG_RETENTION_DAYS` from env config (default: 7)
  - _Requirements: 4.1_

- [ ] 5.2 Register retention cron in cycle scheduler
  - In `cycleScheduler.ts` or a new init function: schedule retention at `30 1 * * *` (01:30 UTC daily)
  - Log start/completion
  - On error: log and send Discord monitoring alert
  - _Requirements: 4.1, 4.2_

- [ ] 5.3 Add `BATTLE_LOG_RETENTION_DAYS` to env config
  - Add to `src/config/env.ts` Zod schema with default 7
  - Add to `.env.example`, `.env.acc.example`, `.env.production.example`
  - _Requirements: 4.1_

## Task Group 6: Backfill Completion

- [ ] 6.1 Rewrite backfill script for memory safety
  - Rewrite `scripts/backfill-battle-summaries.ts` to process ONE battle at a time (cursor-based, no batch loading of battle_log)
  - Use `prisma.$queryRaw` to fetch a single battle's `battle_log` and immediately compute + write + release
  - Or: use a PostgreSQL PL/pgSQL function that does the computation server-side (avoiding Node memory entirely)
  - Target: runs at ~50 battles/second without exceeding 256MB Node heap
  - _Requirements: 5.1_

- [ ] 6.2 Run backfill for remaining battles
  - Execute the rewritten script on ACC to fill the ~25K missing summaries
  - Verify: `SELECT count(*) FROM battles WHERE battle_log IS NOT NULL AND NOT EXISTS (SELECT 1 FROM battle_summaries WHERE battle_id = battles.id)` = 0
  - _Requirements: 5.1_

## Task Group 7: Documentation Updates

- [ ] 7.1 Update `.kiro/steering/project-overview.md`
  - Add "Battle Summary & Retention" to Key Systems section
  - Mention 7-day retention window, `battle_summaries` table, nightly cron
  - _Requirements: 6.1_

- [ ] 7.2 Update `.kiro/steering/coding-standards.md`
  - Add section: "Battle Data Architecture" — write summaries at battle creation, never read `battle_log` for permanent data, `winning_side` column for team battles
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
