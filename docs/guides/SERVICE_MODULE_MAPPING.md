# Service-to-Module Mapping

This document maps every service file in `prototype/backend/src/services/` (and related directories) to its target module for the Phase 2 modular architecture migration.

See [MODULAR_MIGRATION_STRATEGY.md](./MODULAR_MIGRATION_STRATEGY.md) for the extraction plan.

## Mapping Table

### `services/admin/` → `modules/api`

Admin services are route-adjacent — they contain logic extracted from admin route handlers and are tightly coupled to the HTTP layer.

| File | Target Module | Notes |
|------|--------------|-------|
| `adminBattleService.ts` | `api` | Battle record mapping for admin views |
| `adminCycleService.ts` | `api` | Cycle execution orchestration for admin |
| `adminMaintenanceService.ts` | `api` | Repair-all, HP recalculation |
| `adminStatsService.ts` | `api` | Weapon/stance/loadout stats aggregation |

### `services/analytics/` → `modules/game-engine`

| File | Target Module | Notes |
|------|--------------|-------|
| `cycleAnalyticsService.ts` | `game-engine` | Current cycle analytics |
| `facilityAnalyticsService.ts` | `game-engine` | Facility ROI analytics |
| `kothAnalyticsService.ts` | `game-engine` | KotH performance analytics |
| `leaderboardAnalyticsService.ts` | `game-engine` | Leaderboard orchestration |
| `matchmakingService.ts` | `game-engine` | Matchmaking algorithm |
| `onboardingAnalyticsService.ts` | `game-engine` | Onboarding funnel analytics |
| `robotPerformanceService.ts` | `game-engine` | Robot performance metrics |
| `robotStatsViewService.ts` | `game-engine` | Robot stats materialized view |
| `stableAnalyticsService.ts` | `game-engine` | Stable financial summary |
| `trendHelpers.ts` | `game-engine` | Moving average, trend line calculations |

### `services/arena/` → `modules/game-engine`

The 2D combat arena subsystem — 13 service files plus types.

| File | Target Module | Notes |
|------|--------------|-------|
| `adaptationTracker.ts` | `game-engine` | Combat adaptation tracking |
| `arenaLayout.ts` | `game-engine` | Arena geometry and layout |
| `counterAttack.ts` | `game-engine` | Counter-attack mechanics |
| `hydraulicBonus.ts` | `game-engine` | Hydraulic system bonuses |
| `kothEngine.ts` | `game-engine` | KotH arena-specific logic |
| `movementAI.ts` | `game-engine` | Robot movement AI |
| `positionTracker.ts` | `game-engine` | Position tracking |
| `pressureSystem.ts` | `game-engine` | Combat pressure mechanics |
| `rangeBands.ts` | `game-engine` | Range band calculations |
| `servoStrain.ts` | `game-engine` | Servo strain mechanics |
| `teamCoordination.ts` | `game-engine` | Tag-team coordination |
| `threatScoring.ts` | `game-engine` | Target selection AI |
| `vector2d.ts` | `game-engine` | 2D vector math utilities |

### `services/auth/` → `modules/auth`

| File | Target Module | Notes |
|------|--------------|-------|
| `jwtService.ts` | `auth` | JWT token generation/validation |
| `passwordService.ts` | `auth` | Bcrypt hashing/comparison |
| `userService.ts` | `auth` | User CRUD operations |

### `services/battle/` → `modules/game-engine`

| File | Target Module | Notes |
|------|--------------|-------|
| `baseOrchestrator.ts` | `game-engine` | Shared battle orchestration patterns |
| `battlePostCombat.ts` | `game-engine` | Post-combat processing (rewards, stats) |
| `battleStrategy.ts` | `game-engine` | Battle strategy resolution |
| `combatMessageGenerator.ts` | `game-engine` | Combat log message generation |
| `combatSimulator.ts` | `game-engine` | Core combat simulation engine |

### `services/common/` → Split across modules

| File | Target Module | Notes |
|------|--------------|-------|
| `dataIntegrityService.ts` | `database` | DB maintenance and integrity checks |
| `eventCompression.ts` | `database` | Event storage optimization |
| `eventLogger.ts` | `database` | Cross-cutting audit event logging |
| `guide-service.ts` | `api` | Guide content serving |
| `markdown-parser.ts` | `api` | Markdown rendering for guide |
| `queryService.ts` | `database` | Generic paginated query builder |
| `resetService.ts` | `game-engine` | Game state reset logic |

### `services/cycle/` → `modules/game-engine`

| File | Target Module | Notes |
|------|--------------|-------|
| `cycleCsvExportService.ts` | `game-engine` | Cycle data CSV export |
| `cyclePerformanceMonitoringService.ts` | `game-engine` | Cycle performance metrics |
| `cycleScheduler.ts` | `game-engine` | Automated cycle scheduling |
| `cycleSnapshotService.ts` | `game-engine` | Cycle snapshot creation |

### `services/economy/` → `modules/game-engine`

| File | Target Module | Notes |
|------|--------------|-------|
| `facilityRecommendationService.ts` | `game-engine` | Facility upgrade recommendations |
| `repairService.ts` | `game-engine` | Robot repair cost calculations |
| `roiCalculatorService.ts` | `game-engine` | Facility ROI calculations |
| `spendingTracker.ts` | `game-engine` | Credit spending tracking |
| `streamingRevenueService.ts` | `game-engine` | Streaming studio revenue |

### `services/koth/` → `modules/game-engine`

| File | Target Module | Notes |
|------|--------------|-------|
| `kothBattleOrchestrator.ts` | `game-engine` | KotH battle execution |
| `kothMatchmakingService.ts` | `game-engine` | KotH matchmaking |

### `services/league/` → `modules/game-engine`

| File | Target Module | Notes |
|------|--------------|-------|
| `leagueBattleOrchestrator.ts` | `game-engine` | League battle execution + ELO |
| `leagueInstanceService.ts` | `game-engine` | League instance management |
| `leagueRebalancingService.ts` | `game-engine` | League promotion/relegation |

### `services/match/` → `modules/game-engine`

| File | Target Module | Notes |
|------|--------------|-------|
| `matchHistoryService.ts` | `game-engine` | Match history queries + formatting |

### `services/notifications/` → `modules/api`

| File | Target Module | Notes |
|------|--------------|-------|
| `discord-integration.ts` | `api` | Discord webhook integration |
| `integration.ts` | `api` | Notification integration base |
| `notification-service.ts` | `api` | Notification dispatch |

### `services/onboarding/` → `modules/game-engine`

| File | Target Module | Notes |
|------|--------------|-------|
| `onboardingService.ts` | `game-engine` | Onboarding flow logic |

### `services/practice-arena/` → `modules/game-engine`

| File | Target Module | Notes |
|------|--------------|-------|
| `practiceArenaMetrics.ts` | `game-engine` | Practice arena usage metrics |
| `practiceArenaService.ts` | `game-engine` | Practice battle execution |

### `services/robot/` → `modules/game-engine`

| File | Target Module | Notes |
|------|--------------|-------|
| `robotCreationService.ts` | `game-engine` | Robot creation + validation |
| `robotQueryService.ts` | `game-engine` | Robot data queries |
| `robotRankingService.ts` | `game-engine` | Robot ranking calculations |
| `robotRepairService.ts` | `game-engine` | Repair-all logic |
| `robotSanitizer.ts` | `game-engine` | Public view field stripping |
| `robotUpgradeService.ts` | `game-engine` | Attribute upgrade validation + cost |
| `robotWeaponService.ts` | `game-engine` | Weapon equip/unequip logic |

### `services/security/` → `modules/api`

| File | Target Module | Notes |
|------|--------------|-------|
| `securityLogger.ts` | `api` | Security event logging |
| `securityMonitor.ts` | `api` | Security monitoring + dashboard |

### `services/tag-team/` → `modules/game-engine`

| File | Target Module | Notes |
|------|--------------|-------|
| `tagTeamBattleOrchestrator.ts` | `game-engine` | Tag-team battle execution |
| `tagTeamLeagueInstanceService.ts` | `game-engine` | Tag-team league instances |
| `tagTeamLeagueRebalancingService.ts` | `game-engine` | Tag-team league rebalancing |
| `tagTeamMatchmakingService.ts` | `game-engine` | Tag-team matchmaking |
| `tagTeamService.ts` | `game-engine` | Tag-team CRUD |

### `services/tournament/` → `modules/game-engine`

| File | Target Module | Notes |
|------|--------------|-------|
| `tournamentBattleOrchestrator.ts` | `game-engine` | Tournament battle execution |
| `tournamentService.ts` | `game-engine` | Tournament CRUD + bracket |

## Non-Service Files

### `shared/utils/` → `modules/game-engine`

| File | Target Module | Notes |
|------|--------------|-------|
| `discounts.ts` | `game-engine` | Facility discount formulas |
| `academyCaps.ts` | `game-engine` | Academy level → attribute cap |
| `upgradeCosts.ts` | `game-engine` | Upgrade cost formulas |

### Other Backend Files

| File/Directory | Target Module | Notes |
|----------------|--------------|-------|
| `lib/prisma.ts` | `database` | Prisma client singleton |
| `lib/creditGuard.ts` | `api` | Transaction locking for spending |
| `middleware/auth.ts` | `auth` | JWT authentication middleware |
| `middleware/errorHandler.ts` | `api` | Express error middleware |
| `middleware/rateLimiter.ts` | `api` | Rate limiting |
| `middleware/userRateLimiter.ts` | `api` | Per-user rate limiting |
| `middleware/requestLogger.ts` | `api` | Request logging |
| `middleware/schemaValidator.ts` | `api` | Zod validation middleware |
| `middleware/ownership.ts` | `api` | Resource ownership verification |
| `utils/securityValidation.ts` | `api` | Zod schema primitives |
| `utils/robotCalculations.ts` | `game-engine` | HP/shield calculations |
| `utils/storageCalculations.ts` | `game-engine` | Storage capacity calculations |
| `utils/weaponValidation.ts` | `game-engine` | Weapon compatibility checks |
| `errors/*.ts` | `game-engine` + `auth` | Domain errors with their domains |
| `config/facilities.ts` | `api` | Facility configuration |
| `config/logger.ts` | `api` | Winston logger config |
| `routes/*.ts` | `api` | All route definitions |

## Summary by Module

| Module | Service Directories | File Count |
|--------|-------------------|------------|
| `database` | common (4 files), lib/prisma | 5 |
| `auth` | auth (3 files), middleware/auth | 4 |
| `game-engine` | analytics, arena, battle, cycle, economy, koth, league, match, onboarding, practice-arena, robot, tag-team, tournament, common/resetService, shared/utils, errors, utils | ~70 |
| `api` | admin, notifications, security, common (guide, markdown), routes, middleware (5), config, utils/securityValidation, lib/creditGuard | ~40 |
| `ui` | frontend/ (entire directory) | ~150 |

## Cross-Cutting Concerns

### `eventLogger` (database module)
Used by nearly every service for audit logging. During migration, the `database` module must export this first so other modules can import it.

### `queryService` (database module)
Used by analytics and admin services for paginated queries. Same migration order dependency.

### `AppError` hierarchy (split)
`AppError` base class goes to `database` (or a shared `errors` package). Domain errors (`BattleError`, `LeagueError`, etc.) go with their domain in `game-engine`. `AuthError` goes to `auth`.

**Resolution**: Extract `AppError` into `database` module (or a tiny `@armoured-souls/errors` package) so all modules can extend it.

## Circular Dependencies

No circular dependencies exist between the proposed modules. The dependency graph is strictly:

```
ui → (HTTP) → api → auth → database
                  → game-engine → database
```

Within `game-engine`, some services call each other (e.g., `leagueBattleOrchestrator` calls `combatSimulator`), but these are intra-module dependencies and don't affect the module extraction.
