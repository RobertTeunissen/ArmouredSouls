# Spec #40 Legacy Column Audit

**Date:** 2026-06-24  
**Scope:** All `.ts` files in `app/backend/src/` (excluding `migration/`, `backfill/`)  
**Schema version:** Current `app/backend/prisma/schema.prisma`

---

## 1. Executive Summary

Approximately **60+ production-code references** to legacy columns/tables remain across 15+ service files. The unified replacements (standings, scheduled_matches_v2, battle_participants, financial_ledger, leaderboard_cache) are all **operational and serving as the primary write path** for matchmaking, scheduling, and league tracking. However, the **read path** for many API endpoints still pulls from legacy columns (robot.currentLeague, robot.kothWins, teamBattle.totalLeagueWins, etc.), and the Battle model's legacy columns (robot1Id, robot2Id, ELO columns, tag-team columns) are still actively **written** during every battle creation. The legacy scheduling tables (scheduled_matches, scheduled_team_battle_matches, scheduled_koth_matches) have zero direct Prisma writes — all scheduling now flows through the unified `scheduled_matches_v2`. The project is roughly **60% complete** on the migration: write paths are unified for scheduling and standings, but battle record creation and numerous read paths still depend on legacy columns.

---

## 2. Schema Status

### Tables planned to drop — Still in schema.prisma:

| Table | Status | Notes |
|-------|--------|-------|
| `scheduled_matches` (ScheduledLeagueMatch) | ✅ Still exists | Zero Prisma writes in production. Relations still on Robot model. |
| `scheduled_team_battle_matches` (ScheduledTeamBattleMatch) | ✅ Still exists | Zero Prisma writes in production. Still typed/imported in tag-team and match-history services. |
| `scheduled_koth_matches` + `scheduled_koth_match_participants` | ✅ Still exists | Zero Prisma writes. Type references remain in matchHistoryService. |
| `tournament_matches` (ScheduledTournamentMatch) | ✅ Still exists | **STILL ACTIVELY USED** — full read/write via `prisma.scheduledTournamentMatch.*` across tournament services. NOT migrated to unified scheduling. |

### Columns planned to drop — Still in schema.prisma:

All columns listed in Spec #40 still exist in the Prisma schema. None have been removed yet.

---

## 3. Legacy Battle Columns

### `robot1Id`, `robot2Id` — HEAVILY USED

| File | Line(s) | Operation | Context |
|------|---------|-----------|---------|
| `services/league/leagueBattleOrchestrator.ts` | 212, 213, 476, 477 | WRITE | Battle creation (league 1v1) |
| `services/league/leagueBattleOrchestrator.ts` | 649, 658, 665, 677, 889, 890 | READ | Match processing, robot lookup |
| `services/koth/kothBattleOrchestrator.ts` | 283-284 | WRITE | KotH battle creation |
| `services/tag-team/tagTeamBattleRecord.ts` | 18-19 | WRITE | Tag team battle creation |
| `services/team-battle/teamBattleOrchestrator.ts` | 263-264 | WRITE | Team battle creation |
| `services/tournament/tournamentBattleOrchestrator.ts` | 451-452, 564 | WRITE + READ | Tournament battle creation |
| `services/tournament/teamTournamentBattleOrchestrator.ts` | 223-224 | WRITE | Team tournament battle creation |
| `services/battle/battleStrategy.ts` | 284-285 | WRITE | Generic battle strategy |
| `services/robot/robotQueryService.ts` | 29-30, 175, 179, 191, 196, 382-383 | READ | Match history, robot detail |
| `services/admin/adminBattleService.ts` | 54, 57 | READ | Admin battle detail |
| `services/economy/financialReportService.ts` | 52-53, 62 | READ | Financial report (battle winnings) |
| `services/common/resetService.ts` | 121-122 | READ | Reset eligibility check |
| `services/match/matchHistoryService.ts` | 456-457, 524-525 | READ | Match history formatting |

**Dual-write status:** `battle_participants` rows are created alongside legacy columns in all battle paths. The unified data IS written.  
**Risk if dropped:** 🔴 CRITICAL — All battle creation would fail; all match history queries would break.

### `robot1ELOBefore`, `robot2ELOBefore`, `robot1ELOAfter`, `robot2ELOAfter`, `eloChange`

| File | Line(s) | Operation | Context |
|------|---------|-----------|---------|
| `services/tournament/tournamentBattleOrchestrator.ts` | 372-389, 409-412, 479-483 | WRITE + READ | Tournament ELO calc + battle creation |
| `services/koth/kothBattleOrchestrator.ts` | 309-313 | WRITE | KotH battle creation (ELO=0 change) |
| `services/team-battle/teamBattleOrchestrator.ts` | 272-276 | WRITE | Team battle creation (team sum ELO) |
| `services/tag-team/tagTeamResultUpdater.ts` | 556, 580 | READ | Audit log eloBefore/eloAfter from battle |
| `services/match/matchHistoryService.ts` (indirectly) | via battle record | READ | Battle log rendering |

**Dual-write status:** `battle_participants.eloBefore`/`eloAfter` already stores per-robot ELO. The Battle-level columns are redundant aggregates.  
**Risk if dropped:** 🟡 MEDIUM — Battle creation statements would need updating; some analytics may break.

### Tag-team columns on Battle (`team1ActiveRobotId`, `team1ReserveRobotId`, etc.)

| File | Line(s) | Operation | Context |
|------|---------|-----------|---------|
| `services/tag-team/tagTeamBattleRecord.ts` | 26-32 | WRITE | Tag team battle creation |
| `services/robot/robotQueryService.ts` | 32-35, 385-388 | READ | Robot detail/match history |
| `services/admin/adminBattleService.ts` | 313, 319, 328, 332, 437-442 | READ | Admin battle detail |
| `services/match/matchHistoryService.ts` | 1123, 1162-1172, 1179-1188 | READ | Tag team battle log rendering |

### `team1TagOutTime`, `team2TagOutTime`

| File | Line(s) | Operation | Context |
|------|---------|-----------|---------|
| `services/tag-team/tagTeamBattleRecord.ts` | 30-31 | WRITE | Battle creation |
| `services/tag-team/tagTeamResultUpdater.ts` | 116, 356, 380, 553-594 | READ | Result processing |
| `services/admin/adminBattleService.ts` | 441-442 | READ | Admin detail |
| `services/match/matchHistoryService.ts` | 90-92, 1046-1047, 1215, 1223 | READ | Battle log rendering |

### `team1ActiveDamageDealt`, etc. (8 per-robot stat columns)

| File | Line(s) | Operation | Context |
|------|---------|-----------|---------|
| `services/tag-team/tagTeamResultUpdater.ts` | 424-431 | WRITE | Battle record update |
| `services/match/matchHistoryService.ts` | 1213-1221 | READ | Tag team log rendering |

**Dual-write status:** `battle_participants.damageDealt` already holds per-robot damage. The Battle-level columns duplicate this for tag-team battles.  
**Risk if dropped:** 🟡 MEDIUM — tag-team battle creation + history rendering would need refactoring to use participants.

---

## 4. Legacy Robot Columns

### League columns: `currentLeague`, `leagueId`, `leaguePoints`, `cyclesInCurrentLeague`

| File | Operation | Context | Has unified equivalent? |
|------|-----------|---------|------------------------|
| `services/analytics/leaderboardService.ts` | READ | Leaderboard filtering by league | ❌ No — reads directly from robot model |
| `services/analytics/matchmakingService.ts` | READ (bye robot construction) | Bye robot object shape | ✅ Shape only |
| `services/team-battle/teamBattleMatchmakingService.ts` | READ (bye robot) | Bye robot object shape | ✅ Shape only |
| `services/team-battle/teamBattleOrchestrator.ts` | READ (bye robot) | Bye robot object shape | ✅ Shape only |
| `services/tag-team/tagTeamByeTeam.ts` | READ (bye robot) | Bye robot object shape | ✅ Shape only |
| `services/tag-team/tagTeamMatchmakingService.ts` | READ (bye robot) | Bye robot object shape | ✅ Shape only |
| `services/practice-arena/practiceArenaService.ts` | READ (mock robot) | Practice robot object shape | ✅ Shape only |
| `services/robot/robotQueryService.ts` | READ (maps from standings) | Robot detail endpoint | ✅ Yes — reads from standings, maps to legacy field names |
| `services/tournament/tournamentParticipantResolver.ts` | READ (fallback) | Tournament participant info | ⚠️ Fallback from standings |
| `services/match/matchHistoryService.ts` | READ | Match history display | ⚠️ Direct read |
| `services/achievement/triggerEvaluator.ts` | READ | Achievement trigger | ⚠️ Direct read from robot |
| `routes/finances.ts` | READ | Financial report league context | ❌ Direct read from robot |
| `routes/records-queries.ts` | READ | Hall of Records display | ❌ Direct read from robot |
| `utils/economyCalculations.ts` | READ | Economy calculations | ❌ Direct read from robot |

**Write status:** No production writes to these columns found (standings is the write target).  
**Risk if dropped:** 🔴 HIGH — Many read paths still rely on robot.currentLeague directly. Need facade/mapping layer.

### Streak columns: `currentWinStreak`, `bestWinStreak`, `currentLoseStreak`

| File | Operation | Context | Has unified equivalent? |
|------|-----------|---------|------------------------|
| `services/robot/robotQueryService.ts` | READ (maps from standings) | Robot detail | ✅ Mapped from standings |
| `services/robot/robotCreationService.ts` | WRITE (standings creation) | New robot | ✅ Written to standings |
| Bye robot constructors (5 files) | READ (object shape) | Bye robot | ✅ Shape only |

**Write status:** Only written to standings table. Robot columns are stale after Spec #40.  
**Risk if dropped:** 🟡 MEDIUM — Object shapes in bye-robot constructors reference these; robot detail reads from standings.

### KotH columns: `kothWins`, `kothMatches`, `kothTotalZoneScore`, `kothTotalZoneTime`, `kothKills`, `kothBestPlacement`, `kothCurrentWinStreak`, `kothBestWinStreak`

| File | Operation | Context | Has unified equivalent? |
|------|-----------|---------|------------------------|
| `services/analytics/kothAnalyticsService.ts` | READ | KotH performance endpoint | ❌ Reads directly from robot model |
| `routes/records-queries.ts` | READ | Hall of Records KotH section | ❌ Reads directly from robot model with orderBy |
| `services/koth/kothStandingsService.ts` | READ (from standings) | KotH standings | ✅ Reads from standings |
| Bye robot constructors (5 files) | READ (object shape) | Bye robot | ✅ Shape only |
| `services/achievement/achievementCatalog.ts` | READ | Achievement checks | ⚠️ Populated from standings now |

**Write status:** No production writes to robot KotH columns found. KotH orchestrator updates standings only.  
**Risk if dropped:** 🔴 HIGH — `kothAnalyticsService.ts` and `records-queries.ts` read directly from robot model.

### Per-mode counters: `totalLeague1v1Wins/Losses/Draws`, `totalLeague2v2Wins`, `totalLeague3v3Wins`, `totalTagTeamBattles/Wins/Losses/Draws`, `timesTaggedIn`, `timesTaggedOut`

| File | Operation | Context | Has unified equivalent? |
|------|-----------|---------|------------------------|
| `services/robot/robotQueryService.ts` | READ (mapped from standings) | Robot detail | ✅ Mapped |
| `services/auth/userProfileService.ts` | READ | User profile (totalTagTeamBattles, etc.) | ❌ Direct read from robot |
| `services/achievement/achievementService.ts` | READ (mapped from standings) | Achievement evaluation | ✅ Mapped |
| `services/achievement/triggerEvaluator.ts` | READ | Achievement trigger | ⚠️ May still read from robot |
| Bye robot constructors (5+ files) | Object shape | Bye robot | ✅ Shape only |
| `routes/records-queries.ts` (indirectly) | READ | KotH stats | ❌ Direct robot read |

**Write status:** No production writes to these counters found (standings service handles win/loss tracking).  
**Risk if dropped:** 🟡 MEDIUM — `userProfileService.ts` is the main blocker; achievement system already mapped.

---

## 5. Legacy Team Battle Columns

### `teamLp`, `teamLeague`, `teamLeagueId`, `cyclesInLeague`, `totalLeagueWins`, `totalLeagueLosses`, `totalLeagueDraws`

| File | Operation | Context | Has unified equivalent? |
|------|-----------|---------|------------------------|
| `services/team-battle/teamBattleService.ts` | WRITE (on team creation) | New team | ⚠️ Also creates standings row |
| `services/common/stableViewService.ts` | READ | Stable profile (team stats) | ❌ Direct read from teamBattle |
| `routes/teamBattles.ts` | READ (mapped from standings) | Team detail, standings endpoints | ✅ Mapped from standings |
| `services/match/matchHistoryService.ts` | READ (with standings fallback) | Match history | ⚠️ Falls back to teamBattle columns |
| `services/tournament/tournamentParticipantResolver.ts` | READ (fallback) | Tournament display | ⚠️ Falls back to teamBattle.teamLeague |
| Bye team constructors (3 files) | Object shape | Bye team | ✅ Shape only |

**Write status:** Only `teamBattleService.ts` writes on team creation (initial values). The team battle orchestrator writes LP/wins exclusively to standings. Legacy columns become stale after creation.  
**Risk if dropped:** 🟡 MEDIUM — `stableViewService.ts` is the main blocker; team routes already read from standings.

### `tagTeamLp`, `tagTeamLeague`, `tagTeamLeagueId`, `cyclesInTagTeamLeague`, `totalTagTeamWins`, `totalTagTeamLosses`, `totalTagTeamDraws`

| File | Operation | Context | Has unified equivalent? |
|------|-----------|---------|------------------------|
| `services/tag-team/tagTeamTypes.ts` | Type definition | Interface shape | N/A |
| `services/tag-team/tagTeamScheduler.ts` | READ (mapped from standings) | Tag team match setup | ✅ Mapped |
| `services/tag-team/tagTeamMatchmakingService.ts` | READ (bye/interface) | Matchmaking | ✅ Mapped |
| `services/tag-team/tagTeamBattleRecord.ts` | READ | leagueInstanceId from team | ⚠️ Direct read |
| `routes/teamBattles.ts` | READ (mapped from standings) | Team detail / standings | ✅ Mapped |
| `services/admin/adminBattleService.ts` | READ (fallback) | Admin battle detail | ⚠️ Fallback |
| `services/admin/adminStatsService.ts` | READ | Admin stats | ⚠️ References tag team league |

**Write status:** No production writes — standings is the write target.  
**Risk if dropped:** 🟡 MEDIUM — All major paths read from standings. Interface shape + fallbacks need updating.

---

## 6. Legacy Scheduling Tables

| Table | Prisma Writes | Prisma Reads | Status |
|-------|---------------|--------------|--------|
| `scheduled_matches` (ScheduledLeagueMatch) | **ZERO** | **ZERO** | ✅ Dead table — safe to drop |
| `scheduled_team_battle_matches` | **ZERO** | **ZERO** (types only) | ⚠️ Type imports remain but no queries |
| `scheduled_koth_matches` + `participants` | **ZERO** | **ZERO** (types only) | ⚠️ Type imports remain but no queries |
| `tournament_matches` (ScheduledTournamentMatch) | **ACTIVE** | **ACTIVE** | 🔴 NOT migrated — still primary |

All matchmaking (1v1 league, 2v2, 3v3, tag team, KotH) now writes to `scheduled_matches_v2` via `schedulingService.createMatch()`. The old scheduling tables receive zero writes.

However, **tournament scheduling** (`ScheduledTournamentMatch`) is still fully active and NOT migrated to the unified table. It has its own create/read/update flows across 6+ files.

---

## 7. Unified Replacement Status

### `standings` table
- **Status:** ✅ FULLY OPERATIONAL
- **Usage:** 40+ `prisma.standing.*` calls across 12+ services
- **Coverage:** All modes (league_1v1, league_2v2, league_3v3, tag_team, koth) use standings as write target
- **Gaps:** Some read paths still pull from legacy columns (robot.currentLeague, teamBattle.totalLeagueWins) instead of standings

### `scheduled_matches_v2` (ScheduledMatch + ScheduledMatchParticipant)
- **Status:** ✅ FULLY OPERATIONAL for non-tournament scheduling
- **Usage:** All matchmaking services create via `schedulingService.createMatch()`
- **Coverage:** league_1v1, league_2v2, league_3v3, tag_team, koth — all scheduled here
- **Gap:** 🔴 Tournament scheduling still uses legacy `tournament_matches` table exclusively

### `battle_participants`
- **Status:** ✅ FULLY OPERATIONAL
- **Usage:** Written alongside every battle creation (dual-write with legacy columns)
- **Coverage:** All battle types create participant rows with per-robot ELO, credits, damage, fame
- **Gap:** Battle creation still requires robot1Id/robot2Id (FK constraints). Read paths for match history still use legacy columns.

### `financial_ledger`
- **Status:** ✅ OPERATIONAL (feature-flagged)
- **Usage:** `financialService.recordTransaction()` writes ledger entries
- **Coverage:** Transaction recording active; summary/reporting via groupBy
- **Gap:** Feature flag (`leaderboard_cache_active`) gates writes — may not be enabled in all environments

### `leaderboard_cache`
- **Status:** ✅ OPERATIONAL (feature-flagged)
- **Usage:** `leaderboardService.refreshAll()` rebuilds cache; `getLeaderboard()` reads from it
- **Coverage:** 7 categories (fame, prestige, losses, koth_wins, koth_zone_score, career_wins, team_wins)
- **Gap:** Feature flag gates writes. Old leaderboard service (`leaderboardService.ts` in analytics/) still reads directly from robot model.

---

## 8. Drop Readiness Assessment

| Category | Verdict | Blocker(s) |
|----------|---------|------------|
| **`scheduled_matches` table** | ✅ Ready to drop | Remove Prisma model + Robot relations. Zero production usage. |
| **`scheduled_team_battle_matches` table** | ⚠️ Needs type cleanup | Zero writes/reads, but type imports remain in 5 files. Remove types first. |
| **`scheduled_koth_matches` + `participants` tables** | ⚠️ Needs type cleanup | Zero writes/reads, but type references remain. Remove types first. |
| **`tournament_matches` table** | 🔴 Still primary — cannot drop | Active read/write across tournament services. Need full migration to unified scheduling first. |
| **Battle: `robot1Id`, `robot2Id`** | 🔴 Still primary — cannot drop | Written in every battle creation. Required for FK constraints, match history queries, reset checks, admin detail. |
| **Battle: ELO columns** | 🟡 Needs dual-write removal | Written during battle creation. `battle_participants` already holds per-robot ELO. Migrate reads, then stop writing. |
| **Battle: tag-team columns** | 🟡 Needs dual-write removal | Written during tag-team battles. `battle_participants` already holds damage/placement. Migrate reads (matchHistory, admin), then stop writing. |
| **Robot: `currentLeague`, `leagueId`, `leaguePoints`** | 🟡 Needs read migration | Zero writes. But 6+ read consumers (leaderboardService, finances, records-queries, achievements, economy). Migrate reads to standings. |
| **Robot: KotH columns** | 🟡 Needs read migration | Zero writes. But `kothAnalyticsService` and `records-queries.ts` read directly. Migrate to standings. |
| **Robot: streak columns** | ✅ Ready to drop (after interface cleanup) | Reads already mapped from standings. Only bye-robot shapes reference them. |
| **Robot: per-mode counters** | 🟡 Needs read migration | `userProfileService.ts` reads `totalTagTeamBattles` directly. Achievement system already mapped. |
| **TeamBattle: league columns** | 🟡 Needs read migration | `stableViewService.ts` reads directly. Main routes already map from standings. |
| **TeamBattle: tag-team columns** | 🟡 Needs read migration + type refactor | Interface `TagTeamWithRobots` defines these. tagTeamBattleRecord reads `tagTeamLeagueId`. |

---

## 9. Recommended Action Plan

### Phase 1: Safe drops (no code changes needed beyond schema)

1. **Drop `scheduled_matches` (ScheduledLeagueMatch) table** — remove model from schema, remove Robot relations (`scheduledMatchesAsRobot1`, `scheduledMatchesAsRobot2`), run migration.
2. **Drop `scheduled_koth_matches` + `scheduled_koth_match_participants` tables** — remove models, remove Robot relation (`kothMatchParticipations`). Clean up type references in `matchHistoryService.ts`.
3. **Drop `scheduled_team_battle_matches` table** — remove model, remove TeamBattle relations (`matchesAsTeam1`, `matchesAsTeam2`). Clean up type imports in `tagTeamBattleRecord.ts`, `tagTeamResultUpdater.ts`, `matchHistoryService.ts`, `teamBattleOrchestrator.ts`.

### Phase 2: Read migration (medium effort)

4. **Migrate `kothAnalyticsService.ts`** — switch from `prisma.robot.findUnique` with KotH select to reading from `prisma.standing` where mode='koth'.
5. **Migrate `records-queries.ts` KotH section** — replace robot KotH column orderBy queries with standings-based queries.
6. **Migrate `leaderboardService.ts`** (analytics/) — replace `robot.currentLeague` filtering with a join or standings lookup.
7. **Migrate `routes/finances.ts`** — replace `robot.currentLeague` select with standings lookup.
8. **Migrate `userProfileService.ts`** — replace `totalTagTeamBattles`/`totalTagTeamWins` reads with standings aggregation.
9. **Migrate `stableViewService.ts`** — replace `teamBattle.totalLeagueWins/Losses/Draws` reads with standings sum.
10. **Update `economyCalculations.ts`** — replace `robot.currentLeague` with standings lookup or accept it as a parameter.

### Phase 3: Dual-write removal (high effort)

11. **Remove Battle ELO columns** — Stop writing `robot1ELOBefore`/`After`, `eloChange` during battle creation. Update any remaining reads to use `battle_participants.eloBefore`/`eloAfter`.
12. **Remove Battle tag-team columns** — Stop writing `team1ActiveRobotId`, `team1TagOutTime`, `team1ActiveDamageDealt`, etc. Migrate `matchHistoryService.ts` tag-team log builder + `adminBattleService.ts` to read from `battle_participants`.
13. **Remove Battle `robot1Id`/`robot2Id`** — This is the hardest migration. Replace with battle_participants lookups in all match-history, admin, reset, and financial services. Update FK constraints.
14. **Remove robot league/KotH/counter columns** — After Phase 2 reads are migrated, drop from schema.
15. **Remove TeamBattle league columns** — After stableViewService + fallback reads are migrated.

### Phase 4: Tournament migration

16. **Migrate tournament scheduling to unified `scheduled_matches_v2`** — Port `tournament_matches` CRUD to use `schedulingService.createMatch()` with `matchType: tournament_1v1/2v2/3v3`. This is a major refactor touching tournament creation, bracket management, round advancement, and battle orchestration.
17. **Drop `tournament_matches` table** — Only after Phase 4.16 is complete and tested.

### Phase 5: Interface cleanup

18. **Remove bye-robot type references** — The 5+ bye-robot/team constructors all define objects matching the full Robot/TeamBattle Prisma type including legacy fields set to 0/null. After columns are dropped, these shapes will simplify automatically.
19. **Update `TagTeamWithRobots` interface** — Remove `tagTeamLp`, `tagTeamLeague`, etc. from `tagTeamTypes.ts`.
20. **Remove frontend type references** — `robotApi.ts`, `teamBattleApi.ts`, `matchmakingApi.ts`, `kothApi.ts` all define interfaces with legacy field names.

---

## Appendix: Files with Legacy References (Production Code Only)

| File | Legacy columns referenced |
|------|--------------------------|
| `src/services/league/leagueBattleOrchestrator.ts` | robot1Id, robot2Id, robot1ELOBefore/After, eloChange |
| `src/services/koth/kothBattleOrchestrator.ts` | robot1Id, robot2Id, robot1ELOBefore/After, eloChange |
| `src/services/koth/kothAnalyticsService.ts` | All 8 robot KotH columns (direct prisma.robot read) |
| `src/services/tag-team/tagTeamBattleRecord.ts` | robot1Id, robot2Id, team1Active/ReserveRobotId, tagOutTime, tagTeamLeagueId |
| `src/services/tag-team/tagTeamResultUpdater.ts` | tagOutTime, ELO columns, damage columns |
| `src/services/tag-team/tagTeamSimulation.ts` | tagOutTime, damage (internal — not DB columns) |
| `src/services/team-battle/teamBattleOrchestrator.ts` | robot1Id, robot2Id, ELO columns (battle creation) |
| `src/services/team-battle/teamBattleService.ts` | teamLp, teamLeague, teamLeagueId, cyclesInLeague, totalLeagueWins/Losses/Draws |
| `src/services/tournament/tournamentBattleOrchestrator.ts` | robot1Id, robot2Id, ELO columns |
| `src/services/tournament/teamTournamentBattleOrchestrator.ts` | robot1Id, robot2Id |
| `src/services/battle/battleStrategy.ts` | robot1Id, robot2Id, tag-team robot IDs |
| `src/services/robot/robotQueryService.ts` | robot1Id, robot2Id, tag-team IDs, currentLeague, leagueId |
| `src/services/admin/adminBattleService.ts` | robot1Id, robot2Id, tag-team IDs, tagOutTime |
| `src/services/admin/adminStatsService.ts` | scheduledTournamentMatch references |
| `src/services/match/matchHistoryService.ts` | robot1Id, robot2Id, tag-team IDs, tagOutTime, damage columns, currentLeague |
| `src/services/economy/financialReportService.ts` | robot1Id, robot2Id |
| `src/services/common/resetService.ts` | robot1Id, robot2Id |
| `src/services/common/stableViewService.ts` | totalLeagueWins, totalLeagueLosses, totalLeagueDraws |
| `src/services/analytics/leaderboardService.ts` | currentLeague |
| `src/services/analytics/kothAnalyticsService.ts` | All 8 KotH robot columns |
| `src/services/analytics/matchmakingService.ts` | currentLeague, leagueId, leaguePoints (bye robot shape) |
| `src/services/auth/userProfileService.ts` | totalTagTeamBattles, totalTagTeamWins/Losses/Draws |
| `src/services/achievement/triggerEvaluator.ts` | currentLeague, totalLeague2v2Wins, totalLeague3v3Wins |
| `src/services/tournament/tournamentParticipantResolver.ts` | currentLeague, teamLeague (fallbacks) |
| `src/routes/finances.ts` | currentLeague |
| `src/routes/records-queries.ts` | currentLeague, all KotH robot columns |
| `src/routes/teamBattles.ts` | teamLp, teamLeague, teamLeagueId, tagTeamLp, tagTeamLeague |
| `src/utils/economyCalculations.ts` | currentLeague |
