# Requirements: Battle Log Retention — Phase 2

## Expected Contribution

This spec completes the migration from `battle_log` JSON to the pre-computed `battle_summaries` table, making the retention system fully operational. After completion, the game server runs sustainably on a 45GB disk with 13GB database that no longer grows unbounded.

1. **Disk growth halted**: Battle TOAST stays within a 7-day rolling window (~2.5GB max) instead of growing indefinitely (~96MB/day). Before: 13GB and climbing. After: ~4GB steady-state.
2. **Page load time reduced**: Battle report overview loads ~3KB from `battle_summaries` instead of pulling ~900KB from TOAST and computing stats client-side. Expected: 200-500ms faster.
3. **All battle_log readers migrated**: 9 code paths currently read from `battle_log`. After: 0 code paths depend on `battle_log` for permanent data. The column becomes purely ephemeral.
4. **Retention runs automatically**: Nightly cron NULLs old battle_logs without manual intervention.
5. **Graceful degradation**: Players see a clear message on old battle playback tabs instead of broken/empty state.
6. **New battles self-sustaining**: Every new battle writes its summary at creation time — no backfill needed going forward.

### Verification Criteria

1. `grep -r "battleLog\|battle_log" app/backend/src/services/match/matchHistoryService.ts app/backend/src/services/robot/robotQueryService.ts app/backend/src/services/koth/kothStandingsService.ts app/backend/src/routes/records-queries.ts` — returns zero matches for reads from `battle_log` (writes in orchestrators are excluded)
2. `SELECT count(*) FROM battles WHERE battle_log IS NOT NULL AND created_at < NOW() - INTERVAL '7 days'` — returns 0 after retention cron runs
3. Frontend test: navigate to `/battle/1000` (old battle) → Overview tab renders stats from summary, Playback tab shows unavailability notice
4. Frontend test: navigate to a battle from today → both Overview and Playback work
5. `SELECT count(*) FROM battle_summaries WHERE battle_id IN (SELECT id FROM battles WHERE created_at > NOW() - INTERVAL '1 day')` — equals the number of battles created today (summaries written at creation)


## Requirements

### Requirement 1: Battle Orchestrators Write Summary at Creation

#### 1.1 Summary Written for Every New Battle

All battle orchestrators (league 1v1, tournament 1v1, tag team, KotH, team battle 2v2/3v3, team tournament 2v2/3v3) write a `BattleSummary` row in the same transaction as the `Battle` and `BattleParticipant` inserts.

**Acceptance Criteria:**
1. Every new battle created after deploy has a corresponding `battle_summaries` row.
2. The summary contains: `per_robot` (all combat stats), `damage_flows`, `participants` (with survivalSeconds), `starting_positions`, `ending_positions`, `arena_radius`, `battle_duration`, `total_events`.
3. For KotH battles: `koth_placements` and `koth_data` are populated.
4. The `battles.winning_side` column is populated for all team battles (2v2, 3v3, tag team, team tournaments).
5. Summary computation does not increase battle creation time by more than 10ms.
6. If summary computation fails, the battle is still created (summary = NULL) and an error is logged.

#### 1.2 Shared Statistics Computation

The statistics computation logic (currently in `app/frontend/src/utils/battleStatistics.ts`) is extracted to `app/shared/utils/battleStatistics.ts` so both frontend and backend use identical logic.

**Acceptance Criteria:**
1. `computeBattleStatistics` exists in `app/shared/utils/battleStatistics.ts`.
2. The frontend imports from `app/shared/` instead of its local copy.
3. The backend summary computer imports from `app/shared/`.
4. Existing frontend unit tests and property-based tests pass against the shared version.
5. No duplicate implementation of statistics computation exists in the codebase.

### Requirement 2: Battle Report Page Reads from Summary

#### 2.1 Overview Tab Uses Pre-Computed Summary

The battle report overview tab renders from the `BattleSummary` data instead of computing statistics client-side from raw events.

**Acceptance Criteria:**
1. The API response for `/api/matches/battles/:id/log` includes a `summary` object from `battle_summaries`.
2. The frontend `BattleDetailPage` reads `summary.perRobot`, `summary.damageFlows`, `summary.startingPositions`, `summary.endingPositions` directly — no call to `computeBattleStatistics()`.
3. Overview tab renders correctly for battles where `battle_log` is NULL (old battles).
4. Overview tab renders correctly for battles where `battle_log` is present (recent battles).
5. The `BattleStatisticsSummary`, `DamageFlowDiagram`, and `ArenaSummary` components accept pre-computed data.

#### 2.2 Playback Tab Graceful Degradation

When `battle_log` is NULL (pruned), the Playback tab shows a clear message instead of a broken/empty state.

**Acceptance Criteria:**
1. The API response includes `playbackAvailable: boolean` (true if `battle_log IS NOT NULL`).
2. When `playbackAvailable` is false, the Playback tab renders a `PlaybackUnavailableNotice` component.
3. The notice message reads: "Battle replay is available for 7 days after the battle. The overview and statistics above are preserved permanently."
4. The notice is styled consistently with the existing UI (surface background, secondary text, informational tone).
5. When `playbackAvailable` is true, the Playback tab works exactly as before (no behavior change).
6. On mobile (< 1024px), where Overview and Playback are stacked, the CombatMessages section shows a similar notice if events are unavailable.

#### 2.3 Team Battle Winner Detection Uses `winning_side` Column

The `getBattleLog()` endpoint and `getPerformanceContext()` service read team battle winner from `battles.winning_side` column instead of `battleLog.winningSide`.

**Acceptance Criteria:**
1. `matchHistoryService.ts` → `getBattleLog()` reads `battle.winningSide` (column) for team battle winner detection.
2. `robotQueryService.ts` → `getPerformanceContext()` reads `battle.winningSide` (column) for 2v2/3v3 win/loss counting.
3. Both functions produce correct results when `battle_log` is NULL.
4. Both functions produce correct results when `battle_log` is present (backward compatible).

### Requirement 3: Metadata Readers Migrated to Summary Table

#### 3.1 KotH Zone Scores in Match History

The match history endpoint reads KotH zone scores from `battle_summaries.koth_placements` instead of `battleLog.placements`.

**Acceptance Criteria:**
1. `formatKothHistoryEntry()` reads from `battle_summaries.koth_placements` (joined via battle_id).
2. KotH battle cards on Dashboard, Battle History, and Robot Detail show `kothZoneScore` for all battles (regardless of `battle_log` presence).
3. Battles without a summary row (edge case) gracefully show null zone score.

#### 3.2 KotH Standings "Last 10" View

The KotH standings "Last 10" view reads placement data from `battle_summaries.koth_placements` instead of loading full `battle_log`.

**Acceptance Criteria:**
1. `kothStandingsService.ts` → `getKothStandingsLast10()` reads from `battle_summaries`.
2. The view works correctly even when all 10 recent KotH battles have `battle_log = NULL`.
3. Performance improves (no TOAST access for this query).

#### 3.3 Hall of Records Survival Query

The "Longest Survival" team battle record reads from `battle_summaries.participants` instead of `battle_log->'participants'`.

**Acceptance Criteria:**
1. `records-queries.ts` → `fetchTeamBattleRecordsForSize()` uses `battle_summaries.participants` JSONB for survival data.
2. The query returns correct results regardless of `battle_log` presence.
3. Records do not disappear as battles are pruned.

#### 3.4 Admin Battle Detail

The admin battle detail endpoint returns `battle_log` when available and indicates when it has been pruned.

**Acceptance Criteria:**
1. `getAdminBattleDetail()` returns `battle_log` if present, or `{ pruned: true }` if NULL.
2. Admin BattleLogsPage shows the combat log viewer for recent battles (< 7 days).
3. Admin BattleLogsPage shows "Combat log pruned (retained for 7 days)" for old battles.

### Requirement 4: Automated Retention Cron

#### 4.1 Nightly Battle Log Retention Job

A nightly cron job NULLs `battle_log` for battles older than 7 days.

**Acceptance Criteria:**
1. A cron job runs daily at 01:30 UTC (between settlement at 00:00 and backup at 02:00).
2. It processes in batches of 1000 with 100ms sleep between batches.
3. After completion, no battle older than 7 days has a non-NULL `battle_log`.
4. The job logs: start time, battles processed, duration, estimated space reclaimed.
5. On error, the job logs the error and continues (does not crash the application).
6. The job is idempotent — running it multiple times has no adverse effect.
7. The retention window (7 days) is configurable via `BATTLE_LOG_RETENTION_DAYS` env var.

#### 4.2 Retention Monitoring

The retention job sends a monitoring alert on completion.

**Acceptance Criteria:**
1. On success: logs the result (battles processed, duration).
2. On failure: sends a Discord monitoring alert with the error details.
3. The daily health report includes the retention status (last run time, battles pruned).

### Requirement 5: Backfill Completion

#### 5.1 Remaining Battles Backfilled

The ~25K battles that weren't covered by the phase 1 backfill (due to OOM) get their summaries computed.

**Acceptance Criteria:**
1. A memory-safe backfill approach is used (one battle at a time, or PL/pgSQL, or streaming cursor).
2. After backfill: `SELECT count(*) FROM battles WHERE battle_log IS NOT NULL AND NOT EXISTS (SELECT 1 FROM battle_summaries WHERE battle_id = battles.id)` returns 0.
3. The backfill can run during normal operation without affecting game performance.


### Requirement 6: Documentation Updates

#### 6.1 Updated Documentation

All affected documentation reflects the new architecture.

**Acceptance Criteria:**
1. `.kiro/steering/project-overview.md` — mentions `BattleSummary` table and retention system in Key Systems.
2. `.kiro/steering/coding-standards.md` — includes guidance on writing summaries at battle creation and not reading from `battle_log` for permanent data.
3. `docs/architecture/PRD_SERVICE_DIRECTORY.md` — lists retention cron at 01:30 UTC slot.
4. `docs/guides/operations/MONITORING.md` — documents retention job monitoring.
5. `docs/guides/operations/MAINTENANCE.md` — documents manual retention and VACUUM procedures.
6. `BACKLOG.md` — item #53 moved to "Recently Completed".
