# Implementation Plan: Service-Layer Type Safety

## Overview

Replace all 140 `eslint-disable @typescript-eslint/no-explicit-any` suppressions across 23 backend service and utility files. Shared type definitions are created first, then files are typed in groups by domain, largest-first.

## Tasks

- [x] 1. Create shared type definitions
  - [x] 1.1 Create `app/backend/src/types/snapshotTypes.ts` with `StableMetric`, `RobotMetric`, `StepDuration`, and `CycleEventPayload` interfaces matching the JSON structures stored in `CycleSnapshot` records
  - [x] 1.2 Create `app/backend/src/types/battleLogTypes.ts` with `BattleLogData`, `CombatEventLog`, `TagTeamBattleLogData`, and related interfaces matching the JSON structures stored in `Battle.battleLog`
  - [x] 1.3 Create `app/backend/src/types/index.ts` barrel export
  - [x] 1.4 Consolidate the existing `StableMetric` and `RobotMetric` definitions from `app/backend/src/routes/user.ts` and `app/backend/src/services/analytics/stableAnalyticsService.ts` to import from the new shared types file instead of defining locally
  - [x] 1.5 Run `npx tsc --noEmit` to verify the shared types compile
  - _Requirements: 1.1, 2.1, 3.2, 5.1_

- [x] 2. Type cycle domain (42 suppressions)
  - [x] 2.1 Type `cycleSnapshotService.ts` (33 suppressions): replace all `as any` casts on `stableMetrics`, `robotMetrics`, `stepDurations` with imports from `snapshotTypes.ts`; type event payload accesses with `CycleEventPayload`; type all `forEach`/`map` callback parameters
  - [x] 2.2 Type `cyclePerformanceMonitoringService.ts` (6 suppressions): replace metric accesses with typed interfaces
  - [x] 2.3 Type `cycleCsvExportService.ts` (1 suppression): replace the remaining `any` parameter
  - [x] 2.4 Type `utils/cycleLogger.ts` (2 suppressions): replace the remaining `any` types
  - [x] 2.5 Remove all `eslint-disable no-explicit-any` comments from the 4 files
  - [x] 2.6 Run `npx tsc --noEmit` and full backend test suite to verify
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 6.1, 6.2_

- [x] 3. Type battle domain (27 suppressions)
  - [x] 3.1 Type `combatMessageGenerator.ts` (13 suppressions): replace combat event `any` casts with typed event interfaces from `battleLogTypes.ts`
  - [x] 3.2 Type `tagTeamBattleOrchestrator.ts` (10 suppressions): replace battle record and participant `any` casts with `Prisma.{Model}GetPayload` types
  - [x] 3.3 Type `battleStrategy.ts` (2 suppressions): replace the remaining `any` types
  - [x] 3.4 Type `battlePostCombat.ts` (1 suppression): replace the remaining `any`
  - [x] 3.5 Type `tournamentBattleOrchestrator.ts` (1 suppression): replace the remaining `any`
  - [x] 3.6 Remove all `eslint-disable no-explicit-any` comments from the 5 files
  - [x] 3.7 Run `npx tsc --noEmit` and full backend test suite to verify
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 6.1, 6.2_

- [x] 4. Type common services (21 suppressions)
  - [x] 4.1 Type `queryService.ts` (11 suppressions): replace `Record<string, any>` with `Record<string, unknown>` or specific Prisma `WhereInput` types; type callback parameters
  - [x] 4.2 Type `eventLogger.ts` (6 suppressions): replace event payload `any` types with explicit `EventPayload` interfaces
  - [x] 4.3 Type `dataIntegrityService.ts` (4 suppressions): replace integrity check result `any` types with explicit interfaces
  - [x] 4.4 Remove all `eslint-disable no-explicit-any` comments from the 3 files
  - [x] 4.5 Run `npx tsc --noEmit` and full backend test suite to verify
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 6.1, 6.2_

- [x] 5. Type economy and analytics (21 suppressions)
  - [x] 5.1 Type `roiCalculatorService.ts` (8 suppressions): replace ROI calculation `any` types with typed interfaces
  - [x] 5.2 Type `facilityRecommendationService.ts` (5 suppressions): replace recommendation data `any` types
  - [x] 5.3 Type `robotPerformanceService.ts` (7 suppressions): replace performance metric `any` types with Prisma payload types
  - [x] 5.4 Type `utils/economyCalculations.ts` (1 suppression): replace the remaining `any`
  - [x] 5.5 Remove all `eslint-disable no-explicit-any` comments from the 4 files
  - [x] 5.6 Run `npx tsc --noEmit` and full backend test suite to verify
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 6.1, 6.2_

- [x] 6. Type remaining services (29 suppressions)
  - [x] 6.1 Type `matchHistoryService.ts` (13 suppressions): replace battle record `any` types with Prisma payload types and `BattleLogData` from shared types
  - [x] 6.2 Type `leagueBattleOrchestrator.ts` (2 suppressions) and `leagueInstanceService.ts` (2 suppressions)
  - [x] 6.3 Type `tagTeamLeagueInstanceService.ts` (5 suppressions)
  - [x] 6.4 Type `practiceArenaService.ts` (4 suppressions) and `practiceArenaMetrics.ts` (2 suppressions)
  - [x] 6.5 Type `jwtService.ts` (1 suppression)
  - [x] 6.6 Remove all `eslint-disable no-explicit-any` comments from the 7 files
  - [x] 6.7 Run `npx tsc --noEmit` and full backend test suite to verify
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.1, 6.2_

- [x] 7. Documentation and verification
  - [x] 7.1 Update `.kiro/steering/coding-standards.md` to add guidance on typing Prisma `Json` fields: define explicit interfaces in `src/types/` for all JSON payload structures, never cast `Json` fields to `any`, use `as unknown as TypedInterface[]` pattern
  - [x] 7.2 Update `.kiro/steering/database-best-practices.md` to add a "JSON Field Typing" section explaining how to define interfaces for `Json` columns, the `as unknown as TypedInterface[]` cast pattern, and where to place shared type definitions (`src/types/`)
  - [x] 7.3 Update `docs/guides/MODULE_STRUCTURE.md` backend directory tree to include `src/types/` directory (snapshotTypes, battleLogTypes) alongside the existing `src/services/`, `src/routes/`, etc.
  - [x] 7.4 Verify `.kiro/steering/common-tasks.md` accurately references `app/backend/src/types/` after the new files are created
  - [x] 7.5 Run verification criteria: confirm zero `eslint-disable no-explicit-any` in all service and utility files, confirm `npx tsc --noEmit` succeeds, confirm zero `: any` in services and utils, confirm all backend tests pass
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.1, 6.2_
