# Product Requirements Document: Backend Service Directory

**Project**: Armoured Souls  
**Document Type**: Product Requirements Document (PRD)  
**Version**: v1.0  
**Last Updated**: April 9, 2026  
**Status**: ✅ Implemented  
**Owner**: Robert Teunissen

**Revision History**:

v1.0 (Apr 9, 2026): Initial version — extracted from MODULE_STRUCTURE.md, verified against current codebase (18 domains, 80+ service files)

---

**Related Documents**:
- [ARCHITECTURE.md](ARCHITECTURE.md) — System architecture overview
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) — Database schema reference

---

## Overview

The backend is organized into 18 domain directories under `app/backend/src/services/`. Each domain has a barrel `index.ts` that defines its public API. This structure was established in Spec 3 (Backend Service Consolidation, April 2026), replacing the original flat directory of 41 service files.

---

## Service Domains

### admin/
Admin panel operations — stats dashboards, cycle execution, battle viewer, HP recalculation.

| Service | Purpose |
|---------|---------|
| `adminStatsService` | Dashboard statistics (robot stats, facility stats, economy stats, at-risk users) |
| `adminCycleService` | Bulk cycle execution (`POST /api/admin/cycles/bulk`), snapshot backfill |
| `adminBattleService` | Battle list queries, battle detail for admin viewer |
| `adminMaintenanceService` | HP recalculation, robot repair (admin-triggered) |

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

### battle/
Core combat engine — the simulator and shared orchestration helpers.

| Service | Purpose |
|---------|---------|
| `combatSimulator` | Tick-based 1v1 and N-robot combat simulation (`simulateBattle`, `simulateBattleMulti`) |
| `baseOrchestrator` | Shared battle orchestration pipeline (validate → simulate → record) |
| `battlePostCombat` | Shared post-combat helpers (streaming revenue, audit logging, stat updates, credit/prestige/fame awards) |
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
| `resetService` | Account reset logic (delete robots/weapons/facilities, restore credits) |

### cycle/
Automated game loop — the scheduler and analytics snapshot system.

| Service | Purpose |
|---------|---------|
| `cycleScheduler` | 5 independent cron jobs (league, tournament, tagTeam, koth, settlement) |
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
| `facilityRecommendationService` | AI-driven facility upgrade recommendations based on spending patterns |
| `spendingTracker` | Tracks spending by category for onboarding budget display |

### koth/
King of the Hill mode — orchestration and matchmaking.

| Service | Purpose |
|---------|---------|
| `kothBattleOrchestrator` | KotH match execution (placement rewards, zone scoring, no ELO changes) |
| `kothMatchmakingService` | KotH group formation (5-6 robots, ELO snake-draft, one per stable) |

### league/
1v1 league system — battles, instances, and promotions.

| Service | Purpose |
|---------|---------|
| `leagueBattleOrchestrator` | League match execution (LP, prestige, fame, streaming, ELO, bye matches) |
| `leagueInstanceService` | League instance management (max 100 robots per instance, assignment, rebalancing) |
| `leagueRebalancingService` | Instance-based promotions/demotions (top/bottom 10%, LP retention) |

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
| `practiceArenaService` | Synthetic opponent generation, practice battle execution (no DB writes) |
| `practiceArenaMetrics` | Daily practice battle stats (in-memory, flushed during settlement) |

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
| `robotSanitizer` | Strips sensitive data for public robot viewing |

### security/
Security monitoring and logging.

| Service | Purpose |
|---------|---------|
| `securityMonitor` | Singleton — tracks rate limit violations, auth failures, spending anomalies |
| `securityLogger` | Dedicated security log file writer |

### tag-team/
2v2 tag team mode — battles, matchmaking, and league management.

| Service | Purpose |
|---------|---------|
| `tagTeamBattleOrchestrator` | Tag team match execution (multi-phase combat, tag-out mechanics, 4-robot rewards) |
| `tagTeamMatchmakingService` | Tag team pairing (snake-draft, ELO-balanced, bye-team handling) |
| `tagTeamService` | Tag team CRUD, readiness checks, combined ELO calculation |
| `tagTeamLeagueInstanceService` | Tag team league instance management (max 50 teams per instance) |
| `tagTeamLeagueRebalancingService` | Tag team promotions/demotions (mirrors 1v1 logic) |

### tournament/
Tournament system — bracket management and battle execution.

| Service | Purpose |
|---------|---------|
| `tournamentBattleOrchestrator` | Tournament match execution (HP tiebreaker, round-based rewards, championship titles) |
| `tournamentService` | Tournament CRUD, bracket generation (ELO seeding), round advancement, auto-creation |

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
| `src/lib/` | Singleton instances (Prisma client, credit guard) |
| `app/shared/utils/` | Game formulas shared between frontend and backend (upgrade costs, discounts, academy caps) |
