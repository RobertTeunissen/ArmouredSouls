# Module Contract: @armoured-souls/game-engine

## Purpose

All game logic — battle simulation, matchmaking, leagues, tournaments, tag-teams, King of the Hill, economy, cycle management, robot management, analytics, onboarding, and the 2D combat arena subsystem.

## Dependencies

- `@armoured-souls/database` — Prisma client, model types, event logging

## Exported Public API

### Battle Domain

```typescript
export { simulateBattle } from './services/battle/combatSimulator';
export { generateCombatMessages } from './services/battle/combatMessageGenerator';
export { processBattlePostCombat } from './services/battle/battlePostCombat';
export { executeBattleStrategy } from './services/battle/battleStrategy';
export type { CombatResult, CombatEvent, RobotWithWeapons } from './services/battle/combatSimulator';
```

### Arena Domain (2D Combat Subsystem)

```typescript
export { movementAI } from './services/arena/movementAI';
export { threatScoring } from './services/arena/threatScoring';
export { kothEngine } from './services/arena/kothEngine';
export { pressureSystem } from './services/arena/pressureSystem';
export { counterAttack } from './services/arena/counterAttack';
export type { ArenaPosition, Vector2D } from './services/arena/types';
// Plus: adaptationTracker, arenaLayout, hydraulicBonus, positionTracker,
//       rangeBands, servoStrain, teamCoordination, vector2d
```

### League Domain

```typescript
export { executeScheduledBattles } from './services/league/leagueBattleOrchestrator';
export { leagueInstanceService } from './services/league/leagueInstanceService';
export { leagueRebalancingService } from './services/league/leagueRebalancingService';
export { LeagueError, LeagueErrorCode } from './errors/leagueErrors';
```

### Tournament Domain

```typescript
export { tournamentService } from './services/tournament/tournamentService';
export { processTournamentBattle } from './services/tournament/tournamentBattleOrchestrator';
export { TournamentError, TournamentErrorCode } from './errors/tournamentErrors';
```

### Tag-Team Domain

```typescript
export { tagTeamService } from './services/tag-team/tagTeamService';
export { tagTeamMatchmakingService } from './services/tag-team/tagTeamMatchmakingService';
export { tagTeamBattleOrchestrator } from './services/tag-team/tagTeamBattleOrchestrator';
export { tagTeamLeagueInstanceService } from './services/tag-team/tagTeamLeagueInstanceService';
export { tagTeamLeagueRebalancingService } from './services/tag-team/tagTeamLeagueRebalancingService';
export { TagTeamError, TagTeamErrorCode } from './errors/tagTeamErrors';
```

### KotH Domain

```typescript
export { kothBattleOrchestrator } from './services/koth/kothBattleOrchestrator';
export { kothMatchmakingService } from './services/koth/kothMatchmakingService';
export { KothError, KothErrorCode } from './errors/kothErrors';
```

### Economy Domain

```typescript
export { repairService } from './services/economy/repairService';
export { roiCalculatorService } from './services/economy/roiCalculatorService';
export { facilityRecommendationService } from './services/economy/facilityRecommendationService';
export { streamingRevenueService } from './services/economy/streamingRevenueService';
export { spendingTracker } from './services/economy/spendingTracker';
export { EconomyError, EconomyErrorCode } from './errors/economyErrors';
```

### Robot Domain

```typescript
export { robotCreationService } from './services/robot/robotCreationService';
export { robotQueryService } from './services/robot/robotQueryService';
export { robotRankingService } from './services/robot/robotRankingService';
export { robotRepairService } from './services/robot/robotRepairService';
export { robotUpgradeService } from './services/robot/robotUpgradeService';
export { robotWeaponService } from './services/robot/robotWeaponService';
export { sanitizeRobotForPublic } from './services/robot/robotSanitizer';
export { RobotError, RobotErrorCode } from './errors/robotErrors';
```

### Match Domain

```typescript
export { matchHistoryService } from './services/match/matchHistoryService';
export { BattleError, BattleErrorCode } from './errors/battleErrors';
```

### Cycle Domain

```typescript
export { cycleScheduler } from './services/cycle/cycleScheduler';
export { cycleSnapshotService } from './services/cycle/cycleSnapshotService';
export { cycleCsvExportService } from './services/cycle/cycleCsvExportService';
export { cyclePerformanceMonitoringService } from './services/cycle/cyclePerformanceMonitoringService';
```

### Analytics Domain

```typescript
export { robotPerformanceService } from './services/analytics/robotPerformanceService';
export { robotStatsViewService } from './services/analytics/robotStatsViewService';
export { matchmakingService } from './services/analytics/matchmakingService';
export { onboardingAnalyticsService } from './services/analytics/onboardingAnalyticsService';
export { stableAnalyticsService } from './services/analytics/stableAnalyticsService';
export { cycleAnalyticsService } from './services/analytics/cycleAnalyticsService';
export { facilityAnalyticsService } from './services/analytics/facilityAnalyticsService';
export { kothAnalyticsService } from './services/analytics/kothAnalyticsService';
export { leaderboardAnalyticsService } from './services/analytics/leaderboardAnalyticsService';
export { calculateMovingAverage, calculateTrendLine } from './services/analytics/trendHelpers';
```

### Onboarding Domain

```typescript
export { onboardingService } from './services/onboarding/onboardingService';
export { OnboardingError, OnboardingErrorCode } from './errors/onboardingErrors';
```

### Practice Arena Domain

```typescript
export { practiceArenaService } from './services/practice-arena/practiceArenaService';
export { practiceArenaMetrics } from './services/practice-arena/practiceArenaMetrics';
```

### Shared Game Formulas

```typescript
export { getCapForLevel, ACADEMY_CAP_MAP } from './shared/utils/academyCaps';
export { calculateBaseCost, calculateUpgradeCostRange } from './shared/utils/upgradeCosts';
export { calculateWeaponWorkshopDiscount, calculateTrainingFacilityDiscount, applyDiscount } from './shared/utils/discounts';
```

### Common Services (Game-Related)

```typescript
export { resetService } from './services/common/resetService';
```

## Internal Implementation (Not Exported)

- Base orchestrator patterns (`baseOrchestrator.ts`)
- Internal arena calculation helpers (vector math, range band internals)
- Trend calculation internals

## Current Source Location

| Domain | Current Location | File Count |
|--------|-----------------|------------|
| battle | `prototype/backend/src/services/battle/` | 5 |
| arena | `prototype/backend/src/services/arena/` | 13 + types |
| league | `prototype/backend/src/services/league/` | 3 |
| tournament | `prototype/backend/src/services/tournament/` | 2 |
| tag-team | `prototype/backend/src/services/tag-team/` | 5 |
| koth | `prototype/backend/src/services/koth/` | 2 |
| economy | `prototype/backend/src/services/economy/` | 5 |
| robot | `prototype/backend/src/services/robot/` | 7 |
| match | `prototype/backend/src/services/match/` | 1 |
| cycle | `prototype/backend/src/services/cycle/` | 4 |
| analytics | `prototype/backend/src/services/analytics/` | 10 + helpers |
| onboarding | `prototype/backend/src/services/onboarding/` | 1 |
| practice-arena | `prototype/backend/src/services/practice-arena/` | 2 |
| common (resetService) | `prototype/backend/src/services/common/resetService.ts` | 1 |
| shared formulas | `prototype/shared/utils/` | 3 |
| errors | `prototype/backend/src/errors/` | 9 |

## External Package Dependencies

- `fast-check` (property-based testing, dev only)
- No runtime external dependencies beyond what `@armoured-souls/database` provides
