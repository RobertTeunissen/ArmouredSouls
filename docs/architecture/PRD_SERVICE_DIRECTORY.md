# Product Requirements Document: Backend Service Directory

**Project**: Armoured Souls
**Document Type**: Product Requirements Document (PRD)
**Version**: v1.12
**Last Updated**: October 29, 2026
**Status**: ✅ Implemented
**Owner**: Robert Teunissen

**Revision History**:
- v1.12 (Oct 29, 2026): `admin/league-health/` replaces `admin/adminLeagueHealthService` (League Health redesign).
- v1.11 (Oct 23, 2026): `practice-arena/practiceArenaUsageService` replaces the in-memory `practiceArenaMetrics` (admin Practice Arena redesign).
- v1.10 (Oct 23, 2026): Season Control redesign: `season/adminSeasonRolloverRunService`, `season/adminSeasonStateService`, `season/seasonRolloverHistoryService`, `season/rolloverProgress` (stage progress of `seasonRolloverService`).
- v1.9 (Oct 23, 2026): Persistent scheduler run history (`cycle/schedulerRunStore`, `schedulerMissedRuns`, `schedulerHistoryService`), background manual runs and `admin/adminBulkCycleRunService` (Cycle Controls redesign).
- v1.8 (Oct 19, 2026): Added `robot/robotReferenceCleanup`; `resetService` now works for stables with battle history (#294).
- v1.7 (Oct 19, 2026): Listed `unifiedFacilityROIService` and the recorded facility returns modules in `economy/` (#542).
- v1.6 (Oct 15, 2026): Added `battle/combatReadiness`, `battle/walkoverClaim`, `battle/forfeitResolutionService` and `battle/matchFailurePolicy`; `executeSoloTournamentRound` and `resolveBelowMinimumField` (#536).
- v1.5 (Oct 14, 2026): Added `league/leagueInstancePlacement` and `standings/standingPlacement` (unified standings creation rule); updated `teamBattleService` and `subscriptionService` rows.

- v1.4 (Oct 10, 2026): Added the `automaton` domain, the Domain_Service_Extraction services in `economy/` and `robot/`, the admin Automatons router and the catalogue scripts (Spec #55). Inventory now lists 38 directories (also `search`).
- v1.3 (Sep 21, 2026): Reconciled the service inventory with the current 36 directories and documented newer financial, season, standings, monitoring, retention, and progression domains.
- v1.2 (Jun 2026): Team tournament slots (15:00, 18:00) went live with real handlers (Spec 38 — Team Battle Tournaments). Added team-tournament orchestration and participant resolution.
- v1.1 (Jun 2026): Added `matchmaking/` and `team-battle/` domains (Spec 37 — Team Battles 2v2 and 3v3). Updated the cron schedule.
- v1.0 (Apr 9, 2026): Initial version — extracted from the service structure and verified against the then-current codebase.

---

**Related Documents**:
- [ARCHITECTURE.md](ARCHITECTURE.md) — System architecture overview
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) — Database schema reference

---

## Overview

The backend currently contains **38 domain directories** under `app/backend/src/services/`. Each domain may expose a barrel `index.ts` where appropriate. This document gives detailed descriptions for the established game domains and a complete current inventory below. The inventory is authoritative for directory presence; individual service descriptions should be updated when a domain changes materially.

### Current domain inventory

| Domain | Primary responsibility |
|---|---|
| `achievement` | Achievement progression and rewards |
| `admin` | Administrative operations and dashboards |
| `analytics` | Cross-domain analytics and reporting |
| `arena` | Spatial combat subsystems |
| `auth` | Authentication and user management |
| `automaton` | Automaton stables: turn engine, strategies, catalogue, admin control (Spec #55) |
| `battle` | Combat orchestration, rewards, and byes |
| `changelog` | In-game changelog management |
| `common` | Shared infrastructure and guide content |
| `cycle` | Scheduler, settlement, and snapshots |
| `dashboard` | Player dashboard data |
| `economy` | Repairs, streaming revenue, and ROI |
| `financial` | Financial reporting and reconciliation |
| `grand-melee` | Grand Melee orchestration |
| `koth` | King of the Hill orchestration |
| `leaderboard` | Leaderboard cache and reads |
| `league` | League battles, instances, and rebalancing |
| `match` | Battle and scheduled-match history |
| `matchmaking` | Shared matchmaking utilities |
| `migration` | Data migration and compatibility operations |
| `moderation` | Image moderation and storage |
| `monitoring` | Health reporting and operations |
| `notifications` | Operational notification dispatch |
| `onboarding` | New-player onboarding |
| `practice-arena` | Offline practice battles |
| `records` | Hall of Records data |
| `retention` | Battle-log retention and cleanup |
| `robot` | Robot lifecycle and upgrades |
| `scheduling` | Event scopes, timing, and placement byes |
| `search` | Universal search and search analytics |
| `season` | Season lifecycle and archives |
| `security` | Security monitoring and audit support |
| `standings` | Authoritative competitive standings |
| `subscription` | Booking Office subscriptions |
| `tag-team` | Tag Team mode on unified team data |
| `team-battle` | 2v2/3v3 team battles and tournaments |
| `tournament` | Tournament brackets and execution |
| `tuning-pool` | Robot tactical tuning |

---

## Service Domains

### admin/
Admin panel operations — stats dashboards, cycle execution, battle viewer, HP recalculation.

| Service | Purpose |
|---------|---------|
| `adminStatsService` | Dashboard statistics (robot stats, facility stats, economy stats, at-risk users) |
| `adminDashboardService` | Dashboard KPIs (`GET /api/admin/dashboard/kpis`): human-player activity with trends, battle-ready robots; engagement and economy overview |
| `adminDashboardStatusService` | Dashboard status strip and "Needs attention" facts (`GET /api/admin/dashboard/status`); pure `computeCycleHealth` / `summarizeScheduler`. Read-only, sends no alerts |
| `adminBattleActivityService` | Battles per mode: last cycle, season, walkovers, queued, draw/kill/duration rates (`GET /api/admin/dashboard/battle-activity`, 60 s cache per filter) |
| `adminQueuedMatches` | Queued matches per mode, system-wide (scheduled matches + outstanding bracket rows) |
| `adminPlayerActivityService`, `adminKpiSnapshotService` | Login-based human-player counts; one `admin_kpi_snapshots` row per competitive settlement (non-fatal) for 7-day trends |
| `adminThresholds` | Shared thresholds: bankruptcy risk, inactivity, settlement overdue, stuck-match grace, League Health history window and low-movement / unsubscribed shares |
| `league-health/` (`leagueHealthService`, `leagueHealthData`, `leagueHealthPlan`, `leagueHealthStatus`) | Admin League Health (`GET /api/admin/league-health`): every tiered mode's tiers and instances from the rebalance planner on current standings, promotion and demotion flow from the last 5 rebalances in `league_history`, tier status and the grouped Needs attention list. Read-only |
| `adminCycleService` | Bulk cycle execution (`executeBulkCycles`), snapshot backfill |
| `season/adminSeasonRolloverRunService` | `POST /api/admin/seasons/rollover`: the admin rollover under the scheduler lock (`seasonRollover`), recorded as a run; `startAdminRollover` runs in the background (202), `runAdminRollover` waits. 409 while a rollover of either trigger is queued or running |
| `season/adminSeasonStateService` | `GET /api/admin/seasons/state`: season state, configuration, `startedAt`, `nextSettlementAt`, the active rollover with stage progress |
| `season/seasonRolloverHistoryService` | `GET /api/admin/seasons/history`: completed seasons with their rollover and failed attempts, from `seasonRollover` runs and older `season_rollover` audit rows |
| `adminBulkCycleRunService` | `POST /api/admin/cycles/bulk`: runs bulk cycles under the scheduler lock and records them in the run history (`bulkCycles`); `startBulkCycles` runs in the background (202), `runBulkCycles` waits. 409 while one is active |
| `battles/` (`battleListService`, `battleDetailService`, `battleOutcome`, `battlePayoutCheck`, `battleLogAccess`, `battleExportText`) | Admin Battles page: list query (never reads `battle_log`), outcome and "ended by" per mode, payout check against the ledger, combat log access, text / JSON export |
| `analysis/` (`attributeAnalysisService`, `analysisData`, `comparisons`, `attributeLayers`, `analysisFeatures`, `logisticFit`) | Admin "what wins" analyses (`GET /api/admin/analysis/attributes`, Attributes page): reads `battle_participant_builds` into paired comparisons, rebuilds attribute layers, fits the cluster-robust logistic models; cached per window and layer set. Weapons and Meta will reuse it |
| `adminMaintenanceService` | HP recalculation, robot repair (admin-triggered) |

### automaton/ (Spec #55)
Automaton_Stables: computer-run stables that play by human rules. Public API in `index.ts`; product rules in `docs/game-systems/PRD_AUTOMATON_STABLES.md`. The module never writes `User.currency` and never references Manual_Repair; every charge goes through the domain services below and `Credit_Mutation_Service`.

| Service | Purpose |
|---------|---------|
| `automatonTurnService` | `runTurnStep` / `runTurnStepNonFatal` / `runAutomatonTurn`: cohort, Turn_Records, retries, heartbeat Turn_Step lease, deadline, bounded concurrency, mid-step cutover guard |
| `turnStepPool` | `runWithConcurrency`: bounded worker pool; items start in index order, the first error stops new starts |
| `turnPlanner` | Pure planner: walks the Build_Order and returns the next Goal_Outcome |
| `goals/` | Goal_Library: `robotCountGoal`, `facilityGoal`, `attributeGoal`, `weaponStageGoal`, `refinementGoal`, `economyGoal` (+ `goalTypes`, `goalSupport`) |
| `actionExecutor`, `executionSteps`, `robotFitout` | Execute planned actions through the domain services; Robot_Chain and Robot_Fitout |
| `fitoutRecovery` | Turn start: resume the fit-out of robots that fail the loadout readiness rule (reuse storage first, buy only what is missing) |
| `upkeep/` | Free_Upkeep: `teamUpkeep`, `subscriptionUpkeep` (Event_Allocation ranked by expected value), `blueprintSync`, `tuningUpkeep`, `freeUpkeep` |
| `stableFacts`, `factProjector`, `pricing`, `buildFocus`, `teamRule`, `standingsTier` | Fact loading, pure projection, shared-formula pricing, Build_Focus maths, Team_Rule, played-only highest tier with mode (rules in `app/shared/utils/automatonStandingsTier.ts`) |
| `catalogueUpgrade` | Catalogue_Upgrade: move Catalogue_Entries to the latest strategy version, overrides carried by Goal type and occurrence (`pnpm run automaton:catalogue-upgrade`) |
| `stableHistory`, `economyEstimate` | History facts read once per turn (economy window from `financial_ledger`, each robot's recent battles per event) and the pure recurring-economy estimate the Economy Goal uses |
| `robotNaming`, `requestKeys`, `turnBudget` | Blueprint names with "Mk II" suffixing, deterministic request keys, per-turn `TURN_*` budget constants, Turn_Step deadline (`resolveTurnStepDeadline`) and concurrency clamp (`effectiveTurnConcurrency`) |
| `strategies/` | `registry` (loads Strategy_Definition_Files, startup check), `strategyDefinitionSchema`, `strategyParameters`, `migrateTargets`, `strategyLibrary`, `strategyDraftService`, `strategyUpgradeService`, `autoUpgrade` (every profile to the latest version; `pnpm run automaton:upgrade`, run by the deploy), `scenarioProjector`, `defaultRegistry` |
| `automatonProfileService`, `automatonProfileRules` | Profile and blueprint CRUD, validation, Activation |
| `turnPreview`, `attributePlanView` | Read-only Turn_Preview and per-robot attribute plan |
| `needAttention`, `automatonStatus`, `turnRecords`, `strategyComparisonService`, `strategyModePerformance` | Admin read models: Need_Attention, Status_Bar, Turn_Records, Strategy_Comparison (60 s cache) and its per-mode performance from played `standings` |
| `programSwitch` | Program_Switch in `automaton_program_settings` |
| `automatonCatalogueService`, `catalogueSync`, `catalogueExport`, `catalogueUnpack` | Catalogue_Entry schema, insert-only Catalogue_Sync with image fill, export and unpack |
| `automatonImageService` | Admin blueprint image uploads in `uploads/automatons/{catalogueKey}/` |
| `automatonObservability` | `[automaton-turns]` summary line and `[automaton-alert]` alerts |

Strategy_Definition_Files live in `src/config/automaton-strategies/{key}.v{n}.json` (copied into `dist/` by `pnpm run build`). Router: `src/routes/adminAutomatons.ts` at `/api/admin/automatons` (`authenticateToken` + `requireAdmin`). Scripts: `scripts/automatonCatalogueSync.ts` (`pnpm run automaton:sync`) and `scripts/automatonCatalogueUnpack.ts` (`pnpm run automaton:unpack`). Call sites: `cycleScheduler.ts`, `adminCycleService.ts`, `seasonRolloverService.ts` Stage 5 (see `PRD_CYCLE_SYSTEM.md`).

### analytics/
Data aggregation, leaderboards, and reporting. Read-only services that query across domains.

| Service | Purpose |
|---------|---------|
| `matchmakingService` | Matchmaking algorithm — LP-primary pairing, ELO fallback, bye-robot handling |
| `leaderboardService` | Global leaderboards (ELO, fame, prestige, losses) |
| `leaderboardAnalyticsService` | Leaderboard trend analysis |
| `robotPerformanceService` | Per-robot performance metrics across cycles |
| `robotStatsViewService` | Robot stats aggregation for display |
| `cycleAnalyticsService` | Cycle comparison and trend analysis |
| `facilityAnalyticsService` | Facility usage and ROI analytics |
| `stableAnalyticsService` | Per-stable financial analytics |
| `kothAnalyticsService` | KotH-specific analytics (placements, zone scores) |
| `onboardingAnalyticsService` | Onboarding funnel metrics and event tracking |
| `trendHelpers` | Shared trend calculation utilities |

### arena/
2D spatial combat subsystems — the physics layer under the combat simulator.

| Service | Purpose |
|---------|---------|
| `movementAI` | Movement decision framework (preferred range, patience, pursuit) |
| `threatScoring` | Threat evaluation and target selection |
| `kothEngine` | KotH zone mechanics, scoring, match config, strategy objects |
| `positionTracker` | Facing direction, backstab/flanking detection |
| `rangeBands` | Range band classification (melee/short/mid/long) and weapon mapping |
| `pressureSystem` | Logic Cores pressure accumulation system |
| `adaptationTracker` | Adaptive AI bonus tracking (damage-taken scaling) |
| `servoStrain` | Servo strain and movement speed degradation |
| `hydraulicBonus` | Proximity-scaled melee damage bonus |
| `counterAttack` | Counter-attack range checking |
| `arenaLayout` | Arena dimensions and starting position calculation |
| `teamCoordination` | Solo combat bonuses from team coordination attributes |
| `vector2d` | 2D math utilities (distance, angle, normalize) |
| `types` | Spatial type definitions (RobotCombatState, CombatEvent, etc.) |

### auth/
Authentication and user management.

| Service | Purpose |
|---------|---------|
| `jwtService` | JWT token generation and verification |
| `passwordService` | Bcrypt password hashing and comparison |
| `userService` | User CRUD, profile updates, email management |
| `userProfileService` | Profile retrieval and `GET /api/user/stats` stable totals (`getStableStats`) |
| `stable-battle-overlap` | Shared-side surplus subtracted from summed robot counters so each battle counts once per stable: `getStableBattleOverlap` (one stable, `getStableStats`) and `getStableBattleOverlapsByUser` (batch, one query: admin player lists, season archive) |

### battle/
Core combat engine — the simulator and shared orchestration helpers.

| Service | Purpose |
|---------|---------|
| `combatSimulator` | Tick-based 1v1 and N-robot combat simulation (`simulateBattle`, `simulateBattleMulti`) |
| `baseOrchestrator` | Shared battle orchestration pipeline (validate → simulate → record) |
| `battlePostCombat` | Shared post-combat helpers (streaming revenue, audit logging, stat updates, credit/prestige/fame awards) |
| `combatBuildRecorder` | `recordCombatBuilds`: writes `battle_participant_builds` (base and effective attributes, tuning, weapons with refinements, loadout, stance, yield) for every robot that fought, from the build `prepareRobotForCombat` captured. Called by all seven fought-battle writers; never fails a battle |
| `byeResolutionService` | The single writer for a Bye_Event in all nine modes — entity resolution, the Bye_Award_Claim, the whole Bye_Record and the credit award. Simulates nothing (Spec #49) |
| `combatReadiness` | Pure battle-time readiness (#536), run by every orchestrator on the robots loaded for the battle: `evaluateCombatEntry` (no main weapon → forfeit; incomplete loadout → single), `evaluateMatchEntry` (fight / forfeit / double forfeit for two sides), `partitionPlacementField` (KotH/GM ready vs forfeited), `applyLoadoutFallbacks` (in-memory single fallback) and `assertAllRobotsArmed` (the simulator's `ROBOT_NOT_BATTLE_READY` backstop). The scheduling-time rule is `analytics/matchmakingService.checkSchedulingReadiness` |
| `walkoverClaim` | The queued-match claim shared by byes and forfeits (`claimQueuedMatch`, `readClaimedBattleId`): a conditional update on `scheduled_matches_v2` or `tournament_matches` taken before any payment, so a rerun or a concurrent run pays nothing |
| `forfeitResolutionService` | `resolveForfeitEvent`, the single writer for a two-sided forfeit (league 1v1, 2v2/3v3, tag team, solo and team tournaments): battle row, claim, bye-level `battle_income` for the ready side with the `forfeit:` identity, participants with `forfeited`, zero-event summary, standings, stats and audit. Double forfeit = draw, no credits |
| `matchFailurePolicy` | `handleMatchFailure`: one per-match failure handler for every orchestrator — makes the queued match terminal with no rewards (unified rows `cancelled`; tournaments: linked fought battle → its winner, nothing fought → higher seed advances, bye → sole participant), logs a structured `error` event and never throws. `recoverTournamentMatch` first gives a linked fought tournament battle one idempotent resume |
| `battleStrategy` | Strategy pattern interface + `BattleProcessor` for new match types |
| `combatMessageGenerator` | Converts raw combat events into narrative battle log messages |

### common/
Shared infrastructure services used across domains.

| Service | Purpose |
|---------|---------|
| `eventLogger` | AuditLog event creation (battle_complete, passive_income, operating_costs, etc.) |
| `queryService` | Reusable Prisma query helpers |
| `dataIntegrityService` | Data consistency checks (balance verification, event count validation) |
| `eventCompression` | Combat event deduplication and size estimation |
| `guide-service` | In-game guide content loading and caching (Markdown + YAML frontmatter) |
| `markdown-parser` | Markdown parsing with heading extraction |
| `resetService` | Account reset logic (delete robots/weapons/facilities, restore credits). Deletes the stable's own battle participant rows via `robotReferenceCleanup`; battles, summaries and opponents' records stay (#294) |

### cycle/
Automated game loop — the scheduler and analytics snapshot system.

| Service | Purpose |
|---------|---------|
| `cycleScheduler` | 10 independent cron jobs (league, team2v2League, tournament, tagTeam, koth, team3v3League, team2v2Tournament, grandMelee, team3v3Tournament, settlement) — all league modes use unified matchmaking pipeline. Handlers are registered even with `SCHEDULER_ENABLED=false` (only cron is gated), so jobs can always be run by hand: `startManualRun` (background, 409 when already active), `triggerJob` (waits), `runExclusive` (the bulk runner under the same lock). Every run is recorded through `schedulerRunStore` |
| `schedulerRunStore` | Persistent run history: one `scheduler_processes` row per backend start with a 60 s heartbeat; `scheduler_job_runs` queued → running → success / failed / skipped; marks an earlier process's unfinished runs `interrupted`. All writes non-fatal |
| `schedulerMissedRuns` | Pure: daily slots with no covering cron/resume run (15 min grace), with the downtime window when the backend was down |
| `schedulerHistoryService` | Cycle Controls reads: `GET /api/admin/scheduler/overview` (status strip, slots with last run, missed runs), `GET /api/admin/scheduler/runs` (runs + restart markers + missed, paginated), `GET /api/admin/scheduler/runs/:id` |
| `schedulerWindow` | Leaf module: `nextScheduledJobRunAt` from the configured cron schedules (null when the scheduler is off); feeds the Automaton Turn_Step deadline without importing `cycleScheduler` |
| `cycleSnapshotService` | Aggregates AuditLog events into CycleSnapshot for fast analytics |
| `cycleCsvExportService` | Exports cycle data to CSV files |
| `cyclePerformanceMonitoringService` | Detects step duration degradation across cycles |

### economy/
Financial systems — repair costs, streaming revenue, facility ROI.

| Service | Purpose |
|---------|---------|
| `repairService` | Robot repair logic (cost calculation, facility discounts, manual repair discount) |
| `streamingRevenueService` | Per-battle streaming revenue calculation (Streaming Studio multiplier) |
| `roiCalculatorService` | Facility ROI projections (break-even cycles, net daily benefit) |
| `unifiedFacilityROIService` | Owned economic facility ROI (investment, returns, operating costs, payoff) from snapshots and recorded facts |
| `recorded-facility-returns` / `recorded-facility-returns-queries` | Recorded Streaming Studio and Repair Bay returns: pure per-key formulas and the DB aggregates (SUM per stored `studioMultiplier` / `discountPercent`, #542) that feed them |
| `facilityRecommendationService` | AI-driven facility upgrade recommendations based on spending patterns |
| `spendingTracker` | Tracks spending by category for onboarding budget display |
| `facilityUpgradeService` | `upgradeFacility`, `getFacilityUpgradeRequirement` (extracted from `routes/facility.ts`, Spec #55) |
| `weaponPurchaseService` | `purchaseWeapon` (extracted from `routes/weaponInventory.ts`, Spec #55) |
| `weaponSaleService` | `sellWeapon` (extracted from `routes/weaponInventory.ts`, Spec #55) |
| `weaponRefinementService` | `refineWeapon` (extracted from `routes/weaponInventory.ts` `/:id/refine`, Spec #55) |
| `purchaseOptions` | Shared `options` type (`auditContext`) for the extracted services |

The extracted services carry the route bodies verbatim (validation order, errors, locks, Financial_Pairs, replay); routes keep Zod validation, rate limits and achievement checks. Player routes and Automatons call the same functions.

### koth/
King of the Hill mode — orchestration and matchmaking.

| Service | Purpose |
|---------|---------|
| `kothBattleOrchestrator` | KotH match execution (placement rewards, zone scoring, no ELO changes) |
| `kothMatchmakingService` | KotH group formation (5-6 robots, LP-banding within tier/instance, same-stable swaps, recent-opponent swaps — unified pipeline per Spec #41). A tier instance below `MIN_GROUP_SIZE` now creates one Bye_Event per eligible robot via `scheduling/thinInstanceByes` rather than being skipped (Spec #49) |

### league/
1v1 league system — battles, instances, and promotions.

| Service | Purpose |
|---------|---------|
| `leagueBattleOrchestrator` | League match execution (LP, prestige, fame, streaming, ELO, bye matches) |
| `leagueInstanceService` | League instance management (max 100 robots per instance, assignment, rebalancing); `assignLeagueInstanceWithLock` delegates to `leagueInstancePlacement` |
| `leagueInstancePlacement` | Prisma-free, transaction-scoped instance picker: `MAX_ENTITIES_PER_INSTANCE` (100), `leagueInstanceLockKey`, `pickLeagueInstanceInTransaction` (mode/tier advisory lock, least-full instance, lowest number on ties, opens a new instance when all are full) |
| `leagueRebalancingService` | Instance-based promotions/demotions (top/bottom 10%, LP retention) |

### standings/
Authoritative competitive standings (`standings` table, polymorphic robot/team rows).

| Service | Purpose |
|---------|---------|
| `standingPlacement` | The single standings creation rule: `ensureStanding`, `ensureTeamStandings`, `ensureStandingsForSubscriptionGain`, `isTeamMatchable`, lock helpers (namespaces 2 and 5). Rows are created on the first matchable subscription, never at robot/team creation. Prisma-free so `prisma/seed.ts` can use it |
| `standingsService` | Battle result recording (update by id), KotH/Grand Melee points; `getOrCreateStanding` is a logged safety net that places through `ensureStanding` |

### match/
Match history queries.

| Service | Purpose |
|---------|---------|
| `matchHistoryService` | Battle history queries with pagination, filtering, and next-cycle scheduling info |

### notifications/
External notification dispatch.

| Service | Purpose |
|---------|---------|
| `notification-service` | Notification dispatch orchestrator |
| `discord-integration` | Discord webhook formatting and delivery |
| `integration` | Notification channel abstraction |

### onboarding/
New player tutorial system.

| Service | Purpose |
|---------|---------|
| `onboardingService` | Onboarding state management, step progression, completion, skip, recommendations |

### practice-arena/
Offline practice battles against synthetic opponents.

| Service | Purpose |
|---------|---------|
| `practiceArenaService` | Synthetic opponent generation, practice battle execution (no battle records; stable practice counter and achievements only) |
| `practiceArenaUsageService` | One `practice_arena_events` row per request (battle, rate_limited, cycle_busy; never fails the request) and the admin overview (`GET /api/admin/practice-arena/overview`, `/stats`): UTC days, season totals, top practitioners, usage, unavailable time from scheduler runs |

### robot/
Robot management — the full lifecycle from creation to combat.

| Service | Purpose |
|---------|---------|
| `robotCreationService` | Robot creation with attribute initialization |
| `robotQueryService` | Robot queries (by user, by league, with stats, with weapons) |
| `robotRankingService` | Robot ranking calculations (ELO percentile, league position) |
| `robotRepairService` | Repair cost calculation with facility discounts |
| `robotUpgradeService` | Attribute upgrade validation, cost calculation, academy cap enforcement |
| `robotWeaponService` | Weapon equip/unequip transactions (main, offhand, loadout type) |
| `robotSettingsService` | `updateStance`, `updateYieldThreshold` (extracted from `routes/robots.ts`, Spec #55) |
| `robotSanitizer` | Strips sensitive data for public robot viewing |
| `robotReferenceCleanup` | `deleteRobotBattleReferences(tx, robotIds)`: deletes deleted robots' `battle_participants`, `battle_participant_builds` and `team_battle_members` rows by robot id, keeping battles and other participants. Shared by account reset and the Generated_Stable purge (#294) |
| `all-modes-battle-count` | All-modes battle count (`totalBattles` + KotH + Grand Melee `standings.total_matches`), single and batch, plus `getTopRobotsByAllModesBattleCount` (SQL ranking on the combined value, bigint sum, returns each robot's count from the same row). Used by streaming revenue, the financial report, facility recommendations, the robot detail/stable view payloads (#530, #532) and the Hall of Records "Most Battles" list and its season accolade |

### security/
Security monitoring and logging.

| Service | Purpose |
|---------|---------|
| `securityMonitor` | Singleton — tracks rate limit violations, auth failures, spending anomalies |
| `securityLogger` | Dedicated security log file writer |

### matchmaking/
Shared matchmaking utilities consumed by all league matchmakers and tag team.

| Service | Purpose |
|---------|---------|
| `teamMatchmakingUtils` | Shared LP-primary scoring formula (`calculateMatchScore`), bye-team factory (`createByeTeam`), recent-opponent batch query (`getRecentOpponentsBatch`) — imported by 1v1, 2v2, 3v3, and tag team matchmakers |

### tag-team/
2v2 tag team mode — sequential 1v1 combat with tag-out mechanics. All services operate on `TeamBattle` (teamSize=2) + `TeamBattleMember` as the data source. The legacy `TagTeam` model has been removed (Spec: Tag Team System Unification). Scheduled matches use `ScheduledTeamBattleMatch` with `matchMode = 'tag_team'` to discriminate tag team matches from 2v2 League matches on the same table.

| Service | Purpose |
|---------|---------|
| `tagTeamBattleOrchestrator` | Tag team match execution — loads teams from `TeamBattle` + `TeamBattleMember` (slot 0 = Active, slot 1 = Reserve), picks up matches from `ScheduledTeamBattleMatch` where `matchMode = 'tag_team'`, multi-phase sequential combat with tag-out mechanics, updates `totalTagTeamWins`/`Losses`/`Draws` and `tagTeamLp` on `TeamBattle` |
| `tagTeamMatchmakingService` | Tag team pairing — queries `TeamBattle` where `teamSize = 2` filtered by `tagTeamLeague`/`tagTeamLeagueId`, verifies both members have `tag_team` subscriptions, checks `ScheduledTeamBattleMatch` (matchMode = 'tag_team') for already-scheduled teams, creates new `ScheduledTeamBattleMatch` rows with `matchMode = 'tag_team'`; imports shared utilities from `matchmaking/teamMatchmakingUtils` |
| `tagTeamService` | Tag team readiness checks, combined ELO calculation (operates on `TeamBattle` members) |
| `tagTeamLeagueInstanceService` | Tag team league instance management (max 50 teams per instance), queries `TeamBattle` by `tagTeamLeagueId` |
| `tagTeamLeagueRebalancingService` | Tag team promotions/demotions via `tagTeamLeagueAdapter` — updates `tagTeamLeague`/`tagTeamLeagueId`/`cyclesInTagTeamLeague` on `TeamBattle`, records history with `entityType = 'tag_team'` |

### team-battle/
2v2 and 3v3 simultaneous team battle mode — all robots active in the arena at the same time. Distinct from Tag Team (phased combat). Added by Spec 37.

| Service | Purpose |
|---------|---------|
| `teamBattleService` | Team CRUD — register, swap member, rename, disband. Registration and swaps need no subscription; both call `ensureTeamStandings` so a team enters each mode once every member holds it. Swaps keep the team's standings; disband deletes them. LP/tier live in `standings`. |
| `teamBattleMatchmakingService` | 2v2/3v3 matchmaking orchestration per league instance. Subscription-gated eligibility. Creates `ScheduledTeamBattleMatch` rows with `matchMode` discriminator (`'league_2v2'`, `'league_3v3'`, `'tag_team'`, `'tournament_2v2'`, `'tournament_3v3'`). |
| `teamBattleOrchestrator` | Battle execution — fetch scheduled matches, invoke engine, persist results, distribute rewards. |
| `teamBattleEngine` | N-vs-N simulation wrapper around `combatSimulator`. All 2N robots active simultaneously. |
| `teamBattleRewardService` | Reward calculation and distribution: one team credit pool per side (N × 1v1 reward × 0.75 Team_Credit_Pool_Factor, #527), split with `distributeTeamCredits`. |
| `teamBattleAdapter` | `LeagueAdapter<TeamBattle>` for `leagueEngine.ts` — exports `teamBattle2v2Adapter`, `teamBattle3v3Adapter`, and `tagTeamLeagueAdapter`. The tag team adapter remaps LP/league fields to `tagTeamLp`/`tagTeamLeague`/`tagTeamLeagueId` with `entityType = 'tag_team'`. Promotion/demotion with same config as 1v1. |
| `teamCoordinationEffects` | Ally-targeted formulas for `syncProtocols` (focus fire bonus), `supportSystems` (ally shield regen), `formationTactics` (formation damage reduction). |

### tournament/
Tournament system — bracket management and battle execution.

| Service | Purpose |
|---------|---------|
| `tournamentBattleOrchestrator` | 1v1 tournament match execution (HP tiebreaker, round-based rewards, championship titles). `executeSoloTournamentRound(tournamentId)` runs one round for the cycle, admin and route callers: byes, resumes of linked battles, battle-time forfeits (`resolveSoloTournamentForfeit`) and fought matches, with every failure sent to `recoverTournamentMatch`; it never throws for one match |
| `tournamentService` | Tournament CRUD, entity-agnostic bracket generation (ELO seeding), round advancement, auto-creation |
| `teamTournamentBattleOrchestrator` | Team tournament match execution — dispatches to Team Battle Engine, draw tiebreaking, N× rewards |
| `teamTournamentService` | Team eligibility checks, tournament creation, combined-ELO seeding |
| `tournamentParticipantResolver` | Resolves participant details by type (robot name for 1v1, team name + members for 2v2/3v3) |

### subscription/
Event Subscription System — per-robot subscription model gating participation in all battle events through a single, extensible Event Registry.

| Service | Purpose |
|---------|---------|
| `eventRegistry` | `SUBSCRIBABLE_EVENT_TYPES` tuple (source of truth the `SubscribableEventType` union and every Zod schema derive from), plus the runtime singleton registry: `registerSubscribableEvent`, `isRegisteredEvent`, `getRegisteredEvents`. A registration is an identifier and a label — no per-event behaviour hooks |
| `subscriptionService` | One write path (`applySubscriptionChange`) behind `setSubscriptionsForRobot` (bulk), `subscribeRobot` and `unsubscribeRobot`, so a single toggle and a roster-wide save behave identically. A subscription gain calls `ensureStandingsForSubscriptionGain`, which creates the robot's or team's standings row for that mode; removal keeps rows. Reads: `getSubscriptionsForRobot`, `getStableOverview`, and `isRobotSubscribedTo` — the single eligibility helper called by every matchmaker |
| `rosterEligibilityFilter` | Filters the Event Registry by Stable robot count to determine which events a robot can subscribe to (e.g. Tag Team requires ≥ 2 robots) |

**Removed:** `lockingPredicates`. Nine per-event predicates decided whether an
unsubscribe was permitted and contradicted each other, so players could not predict
what a click would do. Unsubscribing is now always allowed; a booked match keeps its
slot until fought. See `scheduling/eventScheduleScope` below and
`docs/prd_pages/PRD_FACILITIES_PAGE.md` § Switching Behaviour.

### scheduling/ (subscription-related)

| Service | Purpose |
|---------|---------|
| `eventScheduleScope` | The single answer to "is there a queued match?", asked from both directions over one `Record<SubscribableEventType, …>` scope map: `resolveRobotIdsForEvent` (who fights event X next — used by pre-battle repair, issue #411; carries no `isByeMatch` filter on either arm since Spec #49, so a byed robot is repaired like any other booked match) and `resolveOutstandingEventsForRobots` (which events a robot still owes a match to — used by subscription slot accounting). Adding a tenth mode fails to compile until its schedule source is declared |
| `eventCronSchedule` | `getNextSchedulingMoment(s)` — when each event next books matches, derived from the configured cron slot. Surfaced to players so they know the deadline to be subscribed by |
| `thinInstanceByes` | Bye creation and resolution for the two Placement_Modes (Spec #49). `planThinInstanceByes` is pure — one entry per eligible robot when a `koth`/`grand_melee` tier instance falls below `MIN_GROUP_SIZE`; `createThinInstanceByes` persists it; `resolvePlacementBye` resolves the resulting rows. Both matchmakers call it, so the two cannot drift apart. Before this, a thin instance was skipped in silence and nothing was written to any table. `resolveBelowMinimumField` (#536) handles a scheduled KotH/GM match whose ready field fell below `MIN_GROUP_SIZE` at battle time: a forfeit-only battle for the unarmed robots (last places, no rewards) and one tier-scaled bye per ready robot, under the same claim |

---

## Cron Schedule

The production scheduler (`cycleScheduler.ts`) fires 10 independent cron jobs daily. Each job acquires an in-memory mutex lock before executing, preventing overlap; manual runs and the admin bulk runner take the same lock. Every run (cron, manual, resumed settlement, bulk) is recorded in `scheduler_job_runs`. Settlement at 00:00 UTC closes the cycle.

### Season phase gating (Spec #45)

Every battle event job is gated on the current Season_Phase. The check sits in `runJob` rather than in the nine handlers, so a tenth battle event cannot be added without inheriting it.

**During a Preparation_Phase:**

- All nine battle event jobs (`league`, `tournament`, `tagTeam`, `koth`, `grandMelee`, `team2v2League`, `team3v3League`, `team2v2Tournament`, `team3v3Tournament`) return immediately, recording a successful run with reason `season_preparation`. No matches are scheduled, no battles execute, no tournament brackets are created.
- The Settlement_Job reads the phase first and returns before step 1, skipping passive income, operating costs, end-of-cycle balances, the `cycle_metadata.total_cycles` increment, `cyclesInTier`, the analytics snapshot, practice arena flush, user generation, achievement rarity refresh, and the leaderboard refresh. Only the preparation counter advances.
- The global cycle counter is therefore unchanged across a preparation window — preparation cycles are not game cycles.
- Infrastructure jobs continue normally: daily health report (00:30 UTC), battle log retention (01:30 UTC), database backup (02:00 UTC).
- Admin manual triggers of a battle event are declined, because `triggerJob` routes through the same gate.

**At the season boundary:** the Settlement_Job runs all its normal steps, then advances the season counter, then invokes the Season_Rollover — so the final cycle of a season settles completely before anything is archived or purged. Season 0 is exempt and never rolls over automatically.

**Automaton Turn_Step (Spec #55):** the Settlement_Job ends with an Automaton Turn_Step (`preparation` in a Preparation_Phase, `settlement` otherwise, none on the boundary settlement, where rollover Stage 5 runs `season_open`). It is non-fatal and keeps starting turns until its deadline: the next scheduled job minus a margin (`services/cycle/schedulerWindow.ts`), capped by `AUTOMATON_TURN_STEP_MAX_MS` and never under 300 s (spec 55's former fixed 300 s bound is superseded).

**On competitive cycle 1:** battle jobs find nothing due to execute, because each executes previously scheduled matches before scheduling new ones and preparation created none. Cycle 1 schedules; cycle 2 is the first battle day.

| UTC | Event | Env Var | Handler Status |
|------|-------|---------|----------------|
| 08:00 | 1v1 League | `LEAGUE_SCHEDULE` | Live |
| 09:00 | Team Battle 2v2 League | `TEAM_2V2_LEAGUE_SCHEDULE` | Live |
| 10:00 | 1v1 Tournament | `TOURNAMENT_SCHEDULE` | Live |
| 11:00 | Tag Team | `TAGTEAM_SCHEDULE` | Live — internally queries `TeamBattle` (teamSize=2) and `ScheduledTeamBattleMatch` (matchMode='tag_team') |
| 13:00 | KotH | `KOTH_SCHEDULE` | Live |
| 14:00 | Team Battle 3v3 League | `TEAM_3V3_LEAGUE_SCHEDULE` | Live |
| 15:00 | Team Battle 2v2 Tournament | `TEAM_2V2_TOURNAMENT_SCHEDULE` | Live |
| 17:00 | Grand Melee | `GRAND_MELEE_SCHEDULE` | Live |
| 18:00 | Team Battle 3v3 Tournament | `TEAM_3V3_TOURNAMENT_SCHEDULE` | Live |
| 00:00 | Settlement | `SETTLEMENT_SCHEDULE` | Live |
| 00:30 | Daily Health Report | `DAILY_REPORT_SCHEDULE` | Live |
| 01:30 | Battle Log Retention | hardcoded | Live |
| 02:00 | Database Backup | crontab (system) | Live |

**Spacing rationale**: Heavy modes (1v1 League at 08:00, KotH at 13:00) are 5 hours apart. Light/reserved modes interleave. Gaps at 12:00, 16:00, 19:00–23:00 provide ops intervention windows. Infrastructure jobs (retention, backup) run between 01:00–03:00 after settlement completes.

**Team tournament handlers** (15:00 and 18:00): Execute team tournament rounds, advance brackets, and auto-create new tournaments when the previous one completes and ≥ 4 eligible teams exist. Each handler runs one round per cycle.

**All slots are live.** No reserved/stub slots remain as of June 2026.

All schedule env vars are overridable via `.env` for rollback or per-environment tuning.

---

## Supporting Directories

| Directory | Purpose |
|-----------|---------|
| `src/routes/` | Express route handlers (thin wrappers calling services) |
| `src/middleware/` | Auth, validation, rate limiting, ownership, error handling |
| `src/utils/` | Pure utility functions (battle math, economy calculations, robot calculations) |
| `src/errors/` | Domain-specific error classes (AppError hierarchy, 10 domain error classes) |
| `src/types/` | Shared TypeScript interfaces for JSON payloads (snapshot types, battle log types) |
| `src/config/` | Configuration (logger, environment, facilities) |
| `src/lib/` | Singleton instances (Prisma client, credit guard); `dbPoolConfig` (`resolveDbPoolMax`, the `DB_POOL_MAX` parse shared by the pool and the Turn_Step concurrency clamp) |
| `app/shared/utils/` | Game formulas shared between frontend and backend (upgrade costs, discounts, academy caps, loadout battle readiness, weapon catalogue pricing in `weaponPricing.ts`) |
