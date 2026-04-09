# Requirements Document

## Introduction

Replace `any` type annotations across the backend service layer with proper Prisma-generated types, explicit interfaces, and typed JSON payloads. Spec 17 eliminated all `any` from route handlers (robots.ts, admin.ts, user.ts), but the service layer still has 140 `eslint-disable @typescript-eslint/no-explicit-any` suppressions across 23 files. These bypass TypeScript's type checking in the most critical code — combat simulation, cycle snapshots, economy calculations, and battle orchestration.

## Glossary

- **JSON Payload**: Data stored in Prisma `Json` fields (e.g., `CycleSnapshot.stableMetrics`, `AuditLog.payload`, `Battle.battleLog`). These are typed as `Prisma.JsonValue` at the ORM level and need explicit interfaces for safe access.
- **Prisma Payload Type**: `Prisma.{Model}GetPayload<{include}>` — a utility type that produces the exact shape of a query result including relations.
- **eslint-disable suppression**: An inline comment that silences the `no-explicit-any` rule. Each one represents a known type safety gap.

## Expected Contribution

This spec targets the "service-layer `any` debt" identified in the post-spec-19 audit.

1. **Total suppression reduction**: From 140 `eslint-disable no-explicit-any` comments across 23 service files to 0. Before: TypeScript cannot catch type mismatches in services. After: full type coverage.
2. **Cycle snapshot type safety**: From 33 suppressions in `cycleSnapshotService.ts` to 0. Before: snapshot metrics (`stableMetrics`, `robotMetrics`, `stepDurations`) are cast to `any`. After: typed with explicit interfaces.
3. **Battle system type safety**: From 27 suppressions across `combatMessageGenerator.ts`, `tagTeamBattleOrchestrator.ts`, `battleStrategy.ts`, `battlePostCombat.ts` to 0.
4. **Common services type safety**: From 21 suppressions across `queryService.ts`, `eventLogger.ts`, `dataIntegrityService.ts` to 0.
5. **Economy type safety**: From 14 suppressions across `roiCalculatorService.ts`, `facilityRecommendationService.ts`, `economyCalculations.ts` to 0.

### Verification Criteria

1. `find app/backend/src -name "*.ts" -not -path "*/node_modules/*" -not -path "*/generated/*" -not -path "*/dist/*" -not -path "*/routes/*" -exec grep -c "eslint-disable.*no-explicit-any" {} \; -print | paste - - | awk '$1 > 0'` returns zero matches
2. `npx tsc --noEmit` from `app/backend` succeeds with zero errors
3. All backend tests pass: `cd app/backend && npm test`
4. `grep -rn ": any" app/backend/src/services/ app/backend/src/utils/ --include="*.ts" | grep -v "node_modules" | grep -v "generated"` returns zero matches

## Requirements

### Requirement 1: Cycle Domain Type Safety

**User Story:** As a backend developer, I want cycle services to use typed interfaces for snapshot data, so that TypeScript catches field name typos and missing properties in the most data-intensive service.

#### Acceptance Criteria

1. WHEN `cycleSnapshotService.ts` is typed (33 suppressions), ALL JSON payload accesses (`stableMetrics`, `robotMetrics`, `stepDurations`, event payloads) SHALL use explicit interfaces instead of `any` casts.
2. WHEN `cyclePerformanceMonitoringService.ts` is typed (6 suppressions), ALL metric accesses SHALL use typed interfaces.
3. WHEN `cycleCsvExportService.ts` is typed (1 suppression), THE remaining `any` SHALL be replaced with a typed parameter.
4. WHEN `cycleLogger.ts` utility is typed (2 suppressions), THE remaining `any` types SHALL be replaced.
5. WHEN all cycle domain files are typed, THERE SHALL be zero `eslint-disable no-explicit-any` comments in `services/cycle/` and `utils/cycleLogger.ts`.

### Requirement 2: Battle Domain Type Safety

**User Story:** As a backend developer, I want battle services to use typed combat events and battle records, so that the combat simulation pipeline is fully type-checked.

#### Acceptance Criteria

1. WHEN `combatMessageGenerator.ts` is typed (13 suppressions), ALL combat event processing SHALL use typed event interfaces instead of `any`.
2. WHEN `tagTeamBattleOrchestrator.ts` is typed (10 suppressions), ALL battle record and participant accesses SHALL use Prisma payload types.
3. WHEN `battleStrategy.ts` is typed (2 suppressions), THE remaining `any` types SHALL be replaced.
4. WHEN `battlePostCombat.ts` is typed (1 suppression), THE remaining `any` SHALL be replaced.
5. WHEN `tournamentBattleOrchestrator.ts` is typed (1 suppression), THE remaining `any` SHALL be replaced.
6. WHEN all battle domain files are typed, THERE SHALL be zero `eslint-disable no-explicit-any` comments in `services/battle/`, `services/tag-team/`, and `services/tournament/`.

### Requirement 3: Common Services Type Safety

**User Story:** As a backend developer, I want common services to use typed payloads and query parameters, so that cross-cutting utilities are type-safe.

#### Acceptance Criteria

1. WHEN `queryService.ts` is typed (11 suppressions), ALL dynamic query construction SHALL use typed parameters and `Record<string, unknown>` instead of `Record<string, any>`.
2. WHEN `eventLogger.ts` is typed (6 suppressions), ALL event payload types SHALL use explicit interfaces instead of `any`.
3. WHEN `dataIntegrityService.ts` is typed (4 suppressions), ALL integrity check results SHALL use typed interfaces.
4. WHEN all common service files are typed, THERE SHALL be zero `eslint-disable no-explicit-any` comments in `services/common/`.

### Requirement 4: Economy and Analytics Type Safety

**User Story:** As a backend developer, I want economy and analytics services to use typed financial data and performance metrics.

#### Acceptance Criteria

1. WHEN `roiCalculatorService.ts` is typed (8 suppressions), ALL ROI calculation inputs and outputs SHALL use typed interfaces.
2. WHEN `facilityRecommendationService.ts` is typed (5 suppressions), ALL recommendation data SHALL use typed interfaces.
3. WHEN `robotPerformanceService.ts` is typed (7 suppressions), ALL performance metric accesses SHALL use typed interfaces.
4. WHEN `economyCalculations.ts` is typed (1 suppression), THE remaining `any` SHALL be replaced.
5. WHEN all economy and analytics files are typed, THERE SHALL be zero `eslint-disable no-explicit-any` comments in `services/economy/`, `services/analytics/`, and `utils/economyCalculations.ts`.

### Requirement 5: Remaining Services Type Safety

**User Story:** As a backend developer, I want all remaining service files to be free of `any` types.

#### Acceptance Criteria

1. WHEN `matchHistoryService.ts` is typed (13 suppressions), ALL battle record formatting SHALL use Prisma payload types and typed battle log interfaces.
2. WHEN `leagueBattleOrchestrator.ts` is typed (2 suppressions), THE remaining `any` types SHALL be replaced.
3. WHEN `leagueInstanceService.ts` is typed (2 suppressions), THE remaining `any` types SHALL be replaced.
4. WHEN `tagTeamLeagueInstanceService.ts` is typed (5 suppressions), THE remaining `any` types SHALL be replaced.
5. WHEN `practiceArenaService.ts` is typed (4 suppressions) and `practiceArenaMetrics.ts` is typed (2 suppressions), THE remaining `any` types SHALL be replaced.
6. WHEN `jwtService.ts` is typed (1 suppression), THE remaining `any` SHALL be replaced.
7. WHEN all service files are typed, THERE SHALL be zero `eslint-disable no-explicit-any` comments in any file under `app/backend/src/services/` or `app/backend/src/utils/`.

### Requirement 6: No Behavioral Changes

**User Story:** As a user of the API, I want the type safety improvements to produce zero changes to API behavior.

#### Acceptance Criteria

1. WHEN types are added or changed, THE runtime behavior and API responses SHALL remain identical.
2. WHEN all type changes are complete, ALL existing backend tests SHALL pass without modification.
