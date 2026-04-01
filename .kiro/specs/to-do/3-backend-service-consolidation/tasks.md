# Implementation Plan: Backend Service Consolidation

## Overview

Reorganize 41 backend services from a flat directory into domain-based subdirectories, then extract a shared base battle orchestrator. This is a pure refactoring — no behavior changes. Each task group moves one domain, updates imports, and verifies tests pass.

## Tasks

- [ ] 1. Create directory structure and barrel files
  - [ ] 1.1 Create subdirectories: `services/auth/`, `services/battle/`, `services/league/`, `services/tournament/`, `services/tag-team/`, `services/koth/`, `services/economy/`, `services/cycle/`, `services/common/`, `services/analytics/`, `services/onboarding/`
  - [ ] 1.2 Create `index.ts` barrel files in each subdirectory (initially empty, populated as services are moved)
  - _Requirements: 1.1, 1.2_

- [ ] 2. Move auth services
  - [ ] 2.1 Move `jwtService.ts`, `passwordService.ts`, `userService.ts` to `services/auth/`
  - [ ] 2.2 Update `auth/index.ts` to re-export public functions
  - [ ] 2.3 Update all import paths in routes, other services, and tests
  - [ ] 2.4 Run full backend test suite to verify no regressions
  - _Requirements: 1.2, 1.3, 4.1_

- [ ] 3. Move common/utility services
  - [ ] 3.1 Move `eventLogger.ts`, `eventCompression.ts`, `dataIntegrityService.ts`, `queryService.ts`, `resetService.ts`, `markdown-parser.ts`, `guide-service.ts` to `services/common/`
  - [ ] 3.2 Update `common/index.ts` barrel file
  - [ ] 3.3 Update all import paths
  - [ ] 3.4 Run full backend test suite
  - _Requirements: 1.2, 1.3_

- [ ] 4. Move battle core services
  - [ ] 4.1 Move `combatSimulator.ts`, `battleStrategy.ts`, `battlePostCombat.ts`, `combatMessageGenerator.ts` to `services/battle/`
  - [ ] 4.2 Update `battle/index.ts` barrel file
  - [ ] 4.3 Update all import paths
  - [ ] 4.4 Run full backend test suite
  - _Requirements: 1.2, 1.3_

- [ ] 5. Create base battle orchestrator and move orchestrators
  - [ ] 5.1 Create `services/battle/baseOrchestrator.ts` extracting shared battle execution pipeline (pre-battle validation, combat simulation, post-combat processing, result recording)
  - [ ] 5.2 Move `leagueBattleOrchestrator.ts` to `services/league/` and refactor to use `baseOrchestrator` for shared logic
  - [ ] 5.3 Move `tournamentBattleOrchestrator.ts` to `services/tournament/` and refactor to use `baseOrchestrator`
  - [ ] 5.4 Move `tagTeamBattleOrchestrator.ts` to `services/tag-team/` and refactor to use `baseOrchestrator`
  - [ ] 5.5 Move `kothBattleOrchestrator.ts` to `services/koth/` and refactor to use `baseOrchestrator`
  - [ ] 5.6 Update all import paths and barrel files
  - [ ] 5.7 Run full backend test suite
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 6. Move league services
  - [ ] 6.1 Move `leagueInstanceService.ts` and `leagueRebalancingService.ts` to `services/league/` — evaluate merging into a single `leagueService.ts` if responsibilities overlap significantly
  - [ ] 6.2 Update `league/index.ts` barrel file
  - [ ] 6.3 Update all import paths
  - [ ] 6.4 Run full backend test suite
  - _Requirements: 3.1, 3.2_

- [ ] 7. Move remaining domain services
  - [ ] 7.1 Move `tournamentService.ts` to `services/tournament/`
  - [ ] 7.2 Move `tagTeamService.ts`, `tagTeamMatchmakingService.ts`, `tagTeamLeagueInstanceService.ts`, `tagTeamLeagueRebalancingService.ts` to `services/tag-team/` — evaluate merging tag-team league services into `tagTeamLeagueService.ts`
  - [ ] 7.3 Move `kothMatchmakingService.ts` to `services/koth/`
  - [ ] 7.4 Move `matchmakingService.ts`, `robotPerformanceService.ts`, `robotStatsViewService.ts`, `onboardingAnalyticsService.ts` to `services/analytics/`
  - [ ] 7.5 Move `facilityRecommendationService.ts`, `roiCalculatorService.ts`, `spendingTracker.ts`, `streamingRevenueService.ts`, `repairService.ts` to `services/economy/`
  - [ ] 7.6 Move `cycleScheduler.ts`, `cycleSnapshotService.ts`, `cyclePerformanceMonitoringService.ts`, `cycleCsvExportService.ts` to `services/cycle/`
  - [ ] 7.7 Move `onboardingService.ts` to `services/onboarding/`
  - [ ] 7.8 Update all barrel files and import paths
  - [ ] 7.9 Run full backend test suite
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.3_

- [ ] 8. Final verification and documentation
  - [ ] 8.1 Verify no service files remain in the root of `services/` (only subdirectories)
  - [ ] 8.2 Run full backend test suite (unit + integration)
  - [ ] 8.3 Start the application and verify it serves requests without errors
  - [ ] 8.4 Update `docs/guides/MODULE_STRUCTURE.md` to reflect the new domain-based service directory structure
  - [ ] 8.5 Update `.kiro/steering/project-overview.md` Project Structure section to mention the domain-organized services
  - [ ] 8.6 Run verification criteria checks: confirm zero root-level service files, all barrel files exist, all tests pass with zero assertion changes
  - _Requirements: 1.4, 4.1, 4.2, 4.3_

## Notes

- Use `smartRelocate` for file moves to automatically update import paths where possible
- Each task group is independently committable
- The base orchestrator extraction (task 5) is the highest-risk change — do it carefully and test thoroughly
- League service merging (task 6.1) is optional — co-location in the same directory may be sufficient if the services have distinct responsibilities
