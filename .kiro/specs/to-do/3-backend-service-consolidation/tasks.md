# Implementation Plan: Backend Service Consolidation

## Overview

Reorganize 41 backend services from a flat directory into domain-based subdirectories, then extract a shared base battle orchestrator. This is a pure refactoring — no behavior changes. Each task group moves one domain, updates imports, and verifies tests pass.

## Tasks

- [x] 1. Create directory structure and barrel files
  - [x] 1.1 Create subdirectories: `services/auth/`, `services/battle/`, `services/league/`, `services/tournament/`, `services/tag-team/`, `services/koth/`, `services/economy/`, `services/cycle/`, `services/common/`, `services/analytics/`, `services/onboarding/`
  - [x] 1.2 Create `index.ts` barrel files in each subdirectory (initially empty, populated as services are moved)
  - _Requirements: 1.1, 1.2_

- [x] 2. Move auth services
  - [x] 2.1 Move `jwtService.ts`, `passwordService.ts`, `userService.ts` to `services/auth/`
  - [x] 2.2 Update `auth/index.ts` to re-export public functions
  - [x] 2.3 Update all import paths in routes, other services, and tests
  - [x] 2.4 Run full backend test suite to verify no regressions
  - _Requirements: 1.2, 1.3, 4.1_

- [x] 3. Move common/utility services
  - [x] 3.1 Move `eventLogger.ts`, `eventCompression.ts`, `dataIntegrityService.ts`, `queryService.ts`, `resetService.ts`, `markdown-parser.ts`, `guide-service.ts` to `services/common/`
  - [x] 3.2 Update `common/index.ts` barrel file
  - [x] 3.3 Update all import paths
  - [x] 3.4 Run full backend test suite
  - _Requirements: 1.2, 1.3_

- [x] 4. Move battle core services
  - [x] 4.1 Move `combatSimulator.ts`, `battleStrategy.ts`, `battlePostCombat.ts`, `combatMessageGenerator.ts` to `services/battle/`
  - [x] 4.2 Update `battle/index.ts` barrel file
  - [x] 4.3 Update all import paths
  - [x] 4.4 Run full backend test suite
  - _Requirements: 1.2, 1.3_

- [x] 5. Create base battle orchestrator and move orchestrators
  - [x] 5.1 Create `services/battle/baseOrchestrator.ts` extracting shared battle execution pipeline (pre-battle validation, combat simulation, post-combat processing, result recording)
  - [x] 5.2 Move `leagueBattleOrchestrator.ts` to `services/league/` and refactor to use `baseOrchestrator` for shared logic
  - [x] 5.3 Move `tournamentBattleOrchestrator.ts` to `services/tournament/` and refactor to use `baseOrchestrator`
  - [x] 5.4 Move `tagTeamBattleOrchestrator.ts` to `services/tag-team/` and refactor to use `baseOrchestrator`
  - [x] 5.5 Move `kothBattleOrchestrator.ts` to `services/koth/` and refactor to use `baseOrchestrator`
  - [x] 5.6 Update all import paths and barrel files
  - [x] 5.7 Run full backend test suite
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 6. Move league services
  - [x] 6.1 Move `leagueInstanceService.ts` and `leagueRebalancingService.ts` to `services/league/` — evaluate merging into a single `leagueService.ts` if responsibilities overlap significantly
  - [x] 6.2 Update `league/index.ts` barrel file
  - [x] 6.3 Update all import paths
  - [x] 6.4 Run full backend test suite
  - _Requirements: 3.1, 3.2_

- [x] 7. Move remaining domain services
  - [x] 7.1 Move `tournamentService.ts` to `services/tournament/`
  - [x] 7.2 Move `tagTeamService.ts`, `tagTeamMatchmakingService.ts`, `tagTeamLeagueInstanceService.ts`, `tagTeamLeagueRebalancingService.ts` to `services/tag-team/` — evaluate merging tag-team league services into `tagTeamLeagueService.ts`
  - [x] 7.3 Move `kothMatchmakingService.ts` to `services/koth/`
  - [x] 7.4 Move `matchmakingService.ts`, `robotPerformanceService.ts`, `robotStatsViewService.ts`, `onboardingAnalyticsService.ts` to `services/analytics/`
  - [x] 7.5 Move `facilityRecommendationService.ts`, `roiCalculatorService.ts`, `spendingTracker.ts`, `streamingRevenueService.ts`, `repairService.ts` to `services/economy/`
  - [x] 7.6 Move `cycleScheduler.ts`, `cycleSnapshotService.ts`, `cyclePerformanceMonitoringService.ts`, `cycleCsvExportService.ts` to `services/cycle/`
  - [x] 7.7 Move `onboardingService.ts` to `services/onboarding/`
  - [x] 7.8 Update all barrel files and import paths
  - [x] 7.9 Run full backend test suite
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.3_

- [x] 8. Final verification and documentation
  - [x] 8.1 Verify no service files remain in the root of `services/` (only subdirectories)
  - [x] 8.2 Run full backend test suite (unit + integration)
  - [x] 8.3 Start the application and verify it serves requests without errors
  - [x] 8.4 Update `docs/guides/MODULE_STRUCTURE.md` to reflect the new domain-based service directory structure
  - [x] 8.5 Update `.kiro/steering/project-overview.md` Project Structure section to mention the domain-organized services
  - [x] 8.6 Run verification criteria checks: confirm zero root-level service files, all barrel files exist, all tests pass with zero assertion changes
  - _Requirements: 1.4, 4.1, 4.2, 4.3_

## Notes

- Use `smartRelocate` for file moves to automatically update import paths where possible
- Each task group is independently committable
- The base orchestrator extraction (task 5) is the highest-risk change — do it carefully and test thoroughly
- League service merging (task 6.1) is optional — co-location in the same directory may be sufficient if the services have distinct responsibilities
