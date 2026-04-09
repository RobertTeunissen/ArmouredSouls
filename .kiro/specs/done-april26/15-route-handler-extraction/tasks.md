# Implementation Plan: Route Handler Extraction & Shared Game Logic Consolidation

## Overview

Extract inline business logic from the four largest route files into dedicated service modules, and consolidate duplicated game formulas into `app/shared/utils/`. Shared formulas are created first (since both backend extraction and frontend cleanup depend on them), then each route file is extracted, followed by frontend import updates and verification.

## Tasks

- [x] 1. Create shared game formula modules
  - [x] 1.1 Create `app/shared/utils/academyCaps.ts` with `ACADEMY_CAP_MAP` constant and `getCapForLevel` function, with JSDoc referencing `docs/prd_core/STABLE_SYSTEM.md`
  - [x] 1.2 Create `app/shared/utils/upgradeCosts.ts` with `calculateBaseCost`, `calculateDiscountedUpgradeCost`, and `calculateUpgradeCostRange` functions, with JSDoc referencing the PRD. `calculateDiscountedUpgradeCost` imports `calculateTrainingFacilityDiscount` from `discounts.ts` to avoid duplicating the training discount formula.
  - [x] 1.3 Create `app/shared/utils/index.ts` barrel export re-exporting all functions from `discounts.ts`, `academyCaps.ts`, and `upgradeCosts.ts`
  - [x] 1.4 Write unit tests for `getCapForLevel` (all levels 0–10, out-of-range, default return of 10), `calculateBaseCost` (levels 0, 1, 10, 49), `calculateDiscountedUpgradeCost` (with various training levels), and `calculateUpgradeCostRange` (multi-level ranges)
  - _Requirements: 5.1, 5.3, 5.5, 5.6, 5.7, 6.2_

- [x] 2. Extract admin route business logic
  - [x] 2.1 Create `src/services/admin/adminBattleService.ts` with `mapBattleRecord`, `fetchTagTeamBattles`, `buildTagTeamWhere`, `mapTagTeamRecord` extracted from `admin.ts`, typed with Prisma models instead of `any`
  - [x] 2.2 Create `src/services/admin/adminStatsService.ts` with `getWeaponStats`, `getStanceStats`, `getLoadoutStats`, `getYieldThresholdStats`, `calculateStats`, `mapRobotAttributes` extracted from `admin.ts`
  - [x] 2.3 Refactor all 23 admin route handlers to call the new service functions, removing inline Prisma queries and data transformation
  - [x] 2.4 Write unit tests for `adminBattleService.ts` and `adminStatsService.ts`
  - [x] 2.5 Run full backend test suite to verify no regressions
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 6.1, 6.3_

- [x] 3. Extract robot route business logic and consolidate shared formulas
  - [x] 3.1 Create `src/services/robot/robotSanitizer.ts` with `sanitizeRobotForPublic` typed with Prisma `Robot` model instead of `any`
  - [x] 3.2 Create `src/services/robot/robotUpgradeService.ts` with upgrade validation logic, importing `getCapForLevel` from `shared/utils/academyCaps`, `calculateBaseCost` from `shared/utils/upgradeCosts`, and `calculateTrainingFacilityDiscount` from `shared/utils/discounts` (NOT defining local copies or inlining formulas)
  - [x] 3.3 Create `src/services/robot/robotRankingService.ts` with `calculateCategorySum`, `calculateRanking`, `getBattleResult`, `getBattleStats` extracted from `robots.ts`
  - [x] 3.4 Remove the local `getCapForLevel` definition from `robots.ts`, remove inline `(level + 1) * 1500` and `Math.min(trainingLevel * 10, 90)` formulas, replace all with imports from `shared/utils/`
  - [x] 3.5 Update `src/routes/stables.ts` import of `sanitizeRobotForPublic` to point to the new service location
  - [x] 3.6 Refactor all 17 robot route handlers to call the new service functions
  - [x] 3.7 Write unit tests for `robotSanitizer.ts`, `robotUpgradeService.ts`, and `robotRankingService.ts`
  - [x] 3.8 Run full backend test suite to verify no regressions
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 5.1, 5.2, 5.4, 5.8, 6.1, 6.3_

- [x] 4. Extract analytics route business logic
  - [x] 4.1 Move inline data aggregation and transformation logic from `analytics.ts` route handlers into existing analytics service files (`robotPerformanceService.ts`, `robotStatsViewService.ts`) or new service files as needed
  - [x] 4.2 Refactor all 14 analytics route handlers to be thin wrappers (under 20 lines each)
  - [x] 4.3 Ensure all extracted functions use typed parameters and return types (no `any`)
  - [x] 4.4 Run full backend test suite to verify no regressions
  - _Requirements: 3.1, 3.2, 3.3, 6.1, 6.3_

- [x] 5. Extract matches route business logic
  - [x] 5.1 Create `src/services/match/matchHistoryService.ts` with battle log formatting, history filtering, and pagination logic extracted from `matches.ts`
  - [x] 5.2 Refactor all 3 match route handlers to be thin wrappers
  - [x] 5.3 Write unit tests for `matchHistoryService.ts`
  - [x] 5.4 Run full backend test suite to verify no regressions
  - _Requirements: 4.1, 4.2, 4.3, 6.1, 6.3_

- [x] 6. Replace frontend local formula implementations with shared imports
  - [x] 6.1 Replace `getCapForLevel` and `calculateBaseCost` in `app/frontend/src/components/UpgradePlanner.tsx` with imports from `shared/utils/`, remove local definitions, replace inline training discount with `calculateTrainingFacilityDiscount` import
  - [x] 6.2 Replace `getCapForLevel` and `calculateBaseCost` in `app/frontend/src/pages/PracticeArenaPage.tsx` with imports from `shared/utils/`, remove local definitions, replace inline training discount with `calculateTrainingFacilityDiscount` import
  - [x] 6.3 Remove the commented-out `getCapForLevel` reference in `app/frontend/src/pages/RobotDetailPage.tsx`
  - [x] 6.4 Replace inline `(currentLevel + 1) * 1500` and `Math.min(trainingLevel * 10, 90)` in `app/frontend/src/components/CompactUpgradeSection.tsx` with imports from `shared/utils/`
  - [x] 6.5 Replace the local `upgCost()` function in `app/frontend/src/components/onboarding/steps/Step4_Upgrades.tsx` with imports of `calculateBaseCost` and `calculateTrainingFacilityDiscount` from `shared/utils/`
  - [x] 6.6 Run frontend build (`npm run build`) to verify no import errors
  - _Requirements: 5.2, 5.4, 5.8, 6.2, 6.4_

- [x] 7. Replace leaderboards.ts duplicate prestige formula
  - [x] 7.1 Replace the local `calculateBattleWinningsBonus` function in `app/backend/src/routes/leaderboards.ts` with an import of `getPrestigeMultiplier` from `economyCalculations.ts`, deriving the bonus as `Math.round((getPrestigeMultiplier(prestige) - 1) * 100)`
  - [x] 7.2 Run full backend test suite to verify no regressions
  - _Requirements: 5.9, 6.1, 6.3_

- [x] 8. Documentation and verification
  - [x] 8.1 Update `.kiro/steering/coding-standards.md`: add a "Route Handler Guidelines" section specifying the thin-route pattern and maximum handler size, add a note in Code Organization that game formulas shared between frontend and backend must live in `app/shared/utils/`, and add a rule that inline formulas must not duplicate functions already exported from `shared/utils/`
  - [x] 8.2 Update `.kiro/steering/project-overview.md`: add `/app/shared` to the Project Structure section describing it as shared TypeScript modules imported by both frontend and backend
  - [x] 8.3 Update `docs/guides/MODULE_STRUCTURE.md`: add `app/shared/` to the project tree diagram, reflect new service directories (`robot/`, `match/`, `admin/`), document the `shared/` directory purpose and contents, and update the `stables.ts` standalone route entry to reference `sanitizeRobotForPublic` from `src/services/robot/robotSanitizer.ts` instead of `robots.ts`
  - [x] 8.4 Update `docs/balance_changes/OPTION_C_IMPLEMENTATION.md`: update the file reference that points to `robots.ts` for the `baseCost` formula to point to `shared/utils/upgradeCosts.ts`
  - [x] 8.5 Run verification criteria: confirm `wc -l` targets met for all four route files, confirm `grep -c "function "` returns 0 for `admin.ts` and `robots.ts`, confirm no local `getCapForLevel` or `calculateBaseCost` definitions remain outside `shared/`, confirm no inline `(level + 1) * 1500` or `Math.min(level * 10, 90)` remain in route/component files, confirm `calculateBattleWinningsBonus` is removed from `leaderboards.ts`, confirm `shared/utils/` has at least 3 files, confirm all backend tests pass and frontend builds
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.4_

## Notes

- Shared formulas (task 1) are created first because both backend extraction (task 3) and frontend cleanup (task 6) depend on them.
- This spec should run AFTER spec 18 (type safety) since typed route files are easier to extract from.
- This spec should run BEFORE spec 5 (modular architecture) since it creates new service files that spec 5's mapping needs to account for.
- This spec should run BEFORE spec 10 (prototype → app rename) since it uses `app/` paths throughout.
