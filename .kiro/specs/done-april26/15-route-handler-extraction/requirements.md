# Requirements Document

## Introduction

Extract inline business logic from oversized route handler files into dedicated service modules, and consolidate duplicated game formulas into the `prototype/shared/` directory. The backend route files `admin.ts` (2,952 lines), `robots.ts` (2,346 lines), `analytics.ts` (1,312 lines), and `matches.ts` (1,093 lines) contain data transformation, aggregation, and business logic that belongs in the service layer. Additionally, functions like `getCapForLevel` and `calculateBaseCost` are copy-pasted across 3+ files in both frontend and backend — these must land in `shared/` as the single source of truth.

## Glossary

- **Route Handler**: An Express route callback that receives a request and sends a response. Should contain no business logic beyond input extraction and response formatting.
- **Service Module**: A file in `src/services/` that encapsulates domain-specific business logic, data transformation, and database queries.
- **Thin Route**: A route handler that delegates all logic to services, containing only input parsing, service invocation, and response serialization.
- **Shared Module**: A TypeScript file in `prototype/shared/` that is importable by both the frontend and backend codebases.
- **Game Formula**: A pure function that computes a game mechanic value (e.g., upgrade cost, attribute cap, discount percentage).

## Expected Contribution

This spec targets two related debts: "god files" where route handlers contain hundreds of lines of inline business logic, and "duplicated game logic" where identical formulas exist in multiple files across frontend and backend.

1. **admin.ts line reduction**: From 2,952 lines to under 800 lines. Helper functions like `mapBattleRecord`, `fetchTagTeamBattles`, `getWeaponStats`, `getStanceStats`, `getLoadoutStats`, `getYieldThresholdStats`, `buildTagTeamWhere`, `mapTagTeamRecord`, `mapRobotAttributes`, and `calculateStats` move to services.
2. **robots.ts line reduction**: From 2,346 lines to under 600 lines. Functions like `sanitizeRobotForPublic`, `calculateCategorySum`, `calculateRanking`, `getBattleResult`, `getBattleStats`, and inline upgrade/ranking logic move to services. `getCapForLevel` moves to `shared/`.
3. **analytics.ts line reduction**: From 1,312 lines to under 400 lines. Inline data aggregation and transformation logic moves to analytics services.
4. **matches.ts line reduction**: From 1,093 lines to under 300 lines. Battle log formatting and history filtering logic moves to a match service.
5. **getCapForLevel deduplication**: From 3 production implementations (in `robots.ts`, `UpgradePlanner.tsx`, `PracticeArenaPage.tsx`) to 1 shared implementation in `prototype/shared/utils/`.
6. **calculateBaseCost deduplication**: From 5 separate implementations (in `UpgradePlanner.tsx`, `PracticeArenaPage.tsx`, `CompactUpgradeSection.tsx`, `Step4_Upgrades.tsx`, and `robots.ts`) to 1 shared implementation.
7. **Training discount formula deduplication**: From 6 inline `Math.min(level * 10, 90)` usages (in `UpgradePlanner.tsx`, `PracticeArenaPage.tsx`, `CompactUpgradeSection.tsx`, `Step4_Upgrades.tsx`, `robots.ts` ×2) to imports of the existing `calculateTrainingFacilityDiscount` from `shared/utils/discounts.ts`.
8. **calculateBattleWinningsBonus deduplication**: The local function in `leaderboards.ts` duplicating prestige tier thresholds from `getPrestigeMultiplier` in `economyCalculations.ts` is replaced with a derived call.
9. **Shared module growth**: From 1 file (32 lines, `discounts.ts`) to 3+ files covering all cross-boundary game formulas.
10. **Testability improvement**: Extracted service functions and shared formulas become independently unit-testable.

### Verification Criteria

1. `wc -l prototype/backend/src/routes/admin.ts` returns under 800
2. `wc -l prototype/backend/src/routes/robots.ts` returns under 600
3. `wc -l prototype/backend/src/routes/analytics.ts` returns under 400
4. `wc -l prototype/backend/src/routes/matches.ts` returns under 300
5. `grep -c "function " prototype/backend/src/routes/admin.ts` returns 0 (no standalone function definitions in route files)
6. `grep -c "function " prototype/backend/src/routes/robots.ts` returns 0
7. `grep -rn "getCapForLevel" prototype/backend/src/ prototype/frontend/src/ --include="*.ts" --include="*.tsx" | grep -v "from.*shared" | grep -v "import" | grep -c "const\|function"` returns 0 (no local definitions, only imports from shared)
8. `grep -rn "calculateBaseCost" prototype/frontend/src/ prototype/backend/src/routes/ --include="*.ts" --include="*.tsx" | grep -v "from.*shared" | grep -v "import" | grep -c "const\|function\|=>"` returns 0 (no local definitions)
9. `grep -rn "upgCost" prototype/frontend/src/ --include="*.tsx" | grep -c "function"` returns 0 (Step4_Upgrades.tsx local function removed)
10. `grep -rn "(currentLevel + 1) \* 1500\|(level + 1) \* 1500" prototype/frontend/src/ prototype/backend/src/routes/ --include="*.ts" --include="*.tsx" | wc -l` returns 0 (no inline base cost formulas)
11. `grep -rn "calculateBattleWinningsBonus" prototype/backend/src/ --include="*.ts" | wc -l` returns 0 (replaced with getPrestigeMultiplier import)
12. `ls prototype/shared/utils/` shows at least 3 files (discounts.ts + new files)
13. All backend tests pass: `cd prototype/backend && npm test`
14. Frontend builds successfully: `cd prototype/frontend && npm run build`

## Requirements

### Requirement 1: Admin Route Extraction

**User Story:** As a backend developer, I want admin route handlers to delegate all business logic to service modules, so that the admin route file is focused on request handling and the extracted logic is independently testable.

#### Acceptance Criteria

1. WHEN the admin route file is refactored, ALL standalone helper functions (`mapBattleRecord`, `fetchTagTeamBattles`, `getWeaponStats`, `getStanceStats`, `getLoadoutStats`, `getYieldThresholdStats`, `buildTagTeamWhere`, `mapTagTeamRecord`, `mapRobotAttributes`, `calculateStats`) SHALL be moved to appropriate service files under `src/services/`.
2. WHEN admin route handlers contain inline database queries with complex joins or aggregations, THOSE queries SHALL be extracted into service methods.
3. WHEN the extraction is complete, EACH admin route handler SHALL contain at most: input extraction from `req`, a single service call, and `res.json()` with the result.
4. WHEN extracted services are created, THEY SHALL maintain the exact same behavior and return types as the original inline code.

### Requirement 2: Robot Route Extraction

**User Story:** As a backend developer, I want robot route handlers to delegate business logic to services, so that robot-related calculations and data transformations are reusable and testable.

#### Acceptance Criteria

1. WHEN the robot route file is refactored, THE functions `sanitizeRobotForPublic`, `calculateCategorySum`, `calculateRanking`, `getBattleResult`, and `getBattleStats` SHALL be moved to service files under `src/services/robot/`.
2. WHEN inline upgrade validation and cost calculation logic is extracted, IT SHALL be placed in a robot upgrade service that can be unit-tested independently.
3. WHEN `sanitizeRobotForPublic` is extracted, IT SHALL be typed with proper Prisma model types instead of `any`.
4. WHEN the extraction is complete, EACH robot route handler SHALL contain at most: input extraction, ownership verification, a service call, and response formatting.
5. WHEN `getCapForLevel` is extracted from `robots.ts`, IT SHALL be placed in `prototype/shared/utils/` (not in a backend-only service) since it is also needed by the frontend.

### Requirement 3: Analytics Route Extraction

**User Story:** As a backend developer, I want analytics route handlers to delegate data aggregation to services, so that analytics computations are testable and the route file is focused on HTTP concerns.

#### Acceptance Criteria

1. WHEN the analytics route file is refactored, ALL inline data aggregation, transformation, and calculation logic SHALL be moved to analytics service files.
2. WHEN extracted analytics services are created, THEY SHALL accept typed parameters and return typed results (no `any`).
3. WHEN the extraction is complete, EACH analytics route handler SHALL be under 20 lines.

### Requirement 4: Matches Route Extraction

**User Story:** As a backend developer, I want match route handlers to delegate battle log formatting and history queries to a match service.

#### Acceptance Criteria

1. WHEN the matches route file is refactored, ALL battle log formatting, history filtering, and pagination logic SHALL be moved to a match service.
2. WHEN the extraction is complete, THE matches route file SHALL contain only thin route handlers.
3. WHEN the match service is created, IT SHALL handle all Prisma query construction for match history, upcoming matches, and battle log retrieval.

### Requirement 5: Shared Game Formula Consolidation

**User Story:** As a developer, I want duplicated game formulas consolidated into `prototype/shared/utils/`, so that both frontend and backend use a single source of truth and formula drift is impossible.

#### Acceptance Criteria

1. WHEN `getCapForLevel` is moved to `prototype/shared/utils/academyCaps.ts`, IT SHALL be exported as a named function with the signature `(level: number) => number`, including the complete cap map matching `docs/prd_core/STABLE_SYSTEM.md`, returning default 10 for unknown levels.
2. WHEN the shared `getCapForLevel` is created, ALL existing implementations in `robots.ts`, `UpgradePlanner.tsx`, and `PracticeArenaPage.tsx` SHALL be replaced with imports from the shared module.
3. WHEN `calculateBaseCost` is moved to `prototype/shared/utils/upgradeCosts.ts`, IT SHALL be exported with the signature `(currentLevel: number) => number`, preserving the formula `(Math.floor(currentLevel) + 1) * 1500` exactly.
4. WHEN the shared `calculateBaseCost` is created, ALL existing implementations in `UpgradePlanner.tsx`, `PracticeArenaPage.tsx`, `CompactUpgradeSection.tsx`, `Step4_Upgrades.tsx`, and inline usages in `robots.ts` SHALL be replaced with imports from the shared module.
5. WHEN new shared files are created, THEY SHALL follow the existing pattern in `discounts.ts` with JSDoc comments referencing the authoritative PRD document.
6. WHEN the shared module is expanded, A barrel export file (`prototype/shared/utils/index.ts`) SHALL exist to simplify imports.
7. WHEN the consolidation is complete, THE shared module SHALL contain at minimum: `discounts.ts` (existing), `academyCaps.ts` (new), and `upgradeCosts.ts` (new).
8. WHEN inline training discount formulas (`Math.min(level * 10, 90)`) exist in frontend or backend route files, THEY SHALL be replaced with imports of `calculateTrainingFacilityDiscount` from `shared/utils/discounts.ts`.
9. WHEN `calculateBattleWinningsBonus` in `leaderboards.ts` duplicates the prestige tier thresholds, IT SHALL be replaced with a call to `getPrestigeMultiplier` from `economyCalculations.ts`, deriving the bonus percentage as `(getPrestigeMultiplier(prestige) - 1) * 100`.

### Requirement 6: No Behavioral Changes

**User Story:** As a user of the API and a player of the game, I want the refactoring to produce zero changes to API responses and game mechanics.

#### Acceptance Criteria

1. WHEN any route handler is refactored, THE HTTP response status codes, response body shapes, and error responses SHALL remain identical.
2. WHEN any formula is moved to the shared module, THE output for all inputs SHALL be identical to the original implementation.
3. WHEN all extractions are complete, ALL existing backend tests SHALL pass without modification (test changes only permitted for import path updates).
4. WHEN all consolidations are complete, THE frontend SHALL build without errors.

### Requirement 7: Documentation and Steering Updates

**User Story:** As a developer onboarding to the project, I want documentation and steering files to accurately reflect the new service structure and shared module conventions, so that I follow the correct patterns when writing new code.

#### Acceptance Criteria

1. WHEN the refactoring is complete, `.kiro/steering/coding-standards.md` SHALL contain a "Route Handler Guidelines" section specifying the thin-route pattern, and a rule that game formulas shared between frontend and backend must live in `prototype/shared/utils/` (never inlined or locally redefined).
2. WHEN the refactoring is complete, `.kiro/steering/project-overview.md` SHALL list `/prototype/shared` in the Project Structure section.
3. WHEN the refactoring is complete, `docs/guides/MODULE_STRUCTURE.md` SHALL include `prototype/shared/` in the project tree, document the new service directories (`robot/`, `match/`), and update the `stables.ts` entry to reference `sanitizeRobotForPublic` from its new location in `src/services/robot/robotSanitizer.ts`.
4. WHEN the `baseCost` formula moves out of `robots.ts`, `docs/balance_changes/OPTION_C_IMPLEMENTATION.md` SHALL be updated to reference the new file location.
