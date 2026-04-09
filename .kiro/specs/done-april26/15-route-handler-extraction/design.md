# Design Document: Route Handler Extraction & Shared Game Logic Consolidation

## Overview

Move all inline business logic from the four largest route files (`admin.ts`, `robots.ts`, `analytics.ts`, `matches.ts`) into dedicated service modules, and consolidate duplicated game formulas (`getCapForLevel`, `calculateBaseCost`) into `prototype/shared/utils/`. Route handlers become thin wrappers: parse input, call service, return response. Cross-boundary formulas land in `shared/` so both frontend and backend import from one place.

### Key Research Findings

- `admin.ts` has 10 standalone helper functions and 23 route handlers with inline Prisma queries containing complex joins and aggregations.
- `robots.ts` has 6 standalone helper functions and 17 route handlers with inline upgrade calculations, ranking logic, and battle stats aggregation.
- `analytics.ts` has 14 route handlers with inline data transformation and aggregation.
- `matches.ts` has 3 route handlers with inline battle log formatting and history filtering spanning 1,093 lines.
- The project already has a well-organized `src/services/` directory with 15 domain subdirectories — extracted logic fits naturally into existing structure.
- `sanitizeRobotForPublic` is exported from `robots.ts` and imported by `stables.ts` — the extraction must preserve this export path or update the import.
- `getCapForLevel` exists in 3 production places with identical logic: `robots.ts`, `UpgradePlanner.tsx`, `PracticeArenaPage.tsx`. Also duplicated in 2 test files (`upgrade-planner-pbt/helpers.tsx`, `UpgradePlannerControls.pbt.test.tsx`).
- `calculateBaseCost` / `(level + 1) * 1500` exists in **5 places** (not 2): `UpgradePlanner.tsx`, `PracticeArenaPage.tsx`, `CompactUpgradeSection.tsx` (inline), `Step4_Upgrades.tsx` (`upgCost()` function), and `robots.ts` (inline in upgrade handler, appears twice).
- The training facility discount formula `Math.min(level * 10, 90)` is inlined in **6 places** despite `calculateTrainingFacilityDiscount` already existing in `shared/utils/discounts.ts`: `UpgradePlanner.tsx`, `PracticeArenaPage.tsx`, `CompactUpgradeSection.tsx`, `Step4_Upgrades.tsx`, and `robots.ts` (twice in upgrade handler). None of these import the shared version.
- `calculateBattleWinningsBonus` in `leaderboards.ts` duplicates the prestige tier thresholds from `getPrestigeMultiplier` in `economyCalculations.ts` — same breakpoints (1K/5K/10K/25K/50K), returns percentage instead of multiplier. Should use `(getPrestigeMultiplier(prestige) - 1) * 100`.
- Both frontend and backend already import from `prototype/shared/utils/discounts.ts`, so the shared import path pattern is established.
- The `RobotDetailPage.tsx` has a commented-out `getCapForLevel` with a note saying "CompactUpgradeSection has its own copy" — confirming the duplication is known.

## Architecture

### Backend Extraction Targets

```
src/services/admin/
├── adminBattleService.ts      ← mapBattleRecord, fetchTagTeamBattles, buildTagTeamWhere, mapTagTeamRecord
├── adminStatsService.ts       ← getWeaponStats, getStanceStats, getLoadoutStats, getYieldThresholdStats, calculateStats, mapRobotAttributes

src/services/robot/ (new directory)
├── robotSanitizer.ts          ← sanitizeRobotForPublic (typed with Prisma models)
├── robotUpgradeService.ts     ← upgrade validation logic (imports getCapForLevel from shared/)
├── robotRankingService.ts     ← calculateCategorySum, calculateRanking, getBattleResult, getBattleStats

src/services/analytics/
├── (existing files)           ← inline aggregation logic from analytics routes moves here

src/services/match/ (new directory)
├── matchHistoryService.ts     ← battle log formatting, history filtering, pagination
```

### Shared Formula Targets

```
prototype/shared/utils/
├── discounts.ts          # Existing: calculateWeaponWorkshopDiscount, calculateTrainingFacilityDiscount, applyDiscount
├── academyCaps.ts        # New: getCapForLevel, ACADEMY_CAP_MAP
├── upgradeCosts.ts       # New: calculateBaseCost, calculateDiscountedUpgradeCost, calculateUpgradeCostRange (imports calculateTrainingFacilityDiscount from discounts.ts)
└── index.ts              # New: barrel export
```

Key distinction: `getCapForLevel` and `calculateBaseCost` go to `shared/` (used by both frontend and backend). Backend-only logic (`sanitizeRobotForPublic`, `mapBattleRecord`, etc.) goes to `src/services/`.

Note: `upgradeCosts.ts` depends on `discounts.ts` — this is intentional to avoid duplicating the training discount formula. The `calculateDiscountedUpgradeCost` function composes `calculateBaseCost` with `calculateTrainingFacilityDiscount`, eliminating the 6 inline copies of the combined formula.

### Route Handler Pattern (After)

Every route handler follows this pattern:

```typescript
router.get('/some-endpoint', authenticateToken, validateRequest({ params: schema }), async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const result = await someService.doSomething(userId, req.params.id);
  res.json(result);
});
```

No try-catch (Express 5 handles async errors), no inline queries, no data transformation.

## Components and Interfaces

### adminBattleService.ts

```typescript
export interface MappedBattleRecord { /* existing return shape from mapBattleRecord */ }
export interface BattleQueryParams { page: number; limit: number; skip: number; search?: string; leagueType?: string; }

export function mapBattleRecord(battle: BattleWithParticipants, battleFormat: '1v1' | '2v2'): MappedBattleRecord;
export function mapTagTeamRecord(match: TagTeamMatchWithBattle): MappedBattleRecord;
export function buildTagTeamWhere(search?: string, leagueType?: string): Prisma.TagTeamMatchWhereInput;
export async function fetchTagTeamBattles(params: BattleQueryParams): Promise<{ battles: MappedBattleRecord[]; total: number }>;
```

### robotSanitizer.ts

```typescript
import { Robot } from '../../generated/prisma';

const SENSITIVE_ROBOT_FIELDS = ['internalField1', ...] as const;

export function sanitizeRobotForPublic(robot: Robot): Omit<Robot, typeof SENSITIVE_ROBOT_FIELDS[number]>;
```

### robotUpgradeService.ts

```typescript
import { getCapForLevel } from '../../../shared/utils/academyCaps';
import { calculateBaseCost } from '../../../shared/utils/upgradeCosts';

export function validateUpgrade(robot: Robot, attribute: string, plannedLevel: number, academyLevels: AcademyLevels): void;
export function calculateUpgradeCost(currentLevel: number, plannedLevel: number, trainingLevel: number): { cost: number; baseCost: number };
```

### academyCaps.ts (shared)

```typescript
/**
 * Academy level → attribute cap mapping
 * See docs/prd_core/STABLE_SYSTEM.md for authoritative specification
 */
export const ACADEMY_CAP_MAP: Readonly<Record<number, number>> = {
  0: 10, 1: 15, 2: 20, 3: 25, 4: 30,
  5: 35, 6: 40, 7: 42, 8: 45, 9: 48, 10: 50,
};

/** Get the attribute cap for a given academy level. Returns 10 for unknown levels. */
export function getCapForLevel(level: number): number {
  return ACADEMY_CAP_MAP[level] ?? 10;
}
```

### upgradeCosts.ts (shared)

```typescript
/**
 * Attribute upgrade cost calculations
 * See docs/prd_core/STABLE_SYSTEM.md for authoritative specification
 */

import { calculateTrainingFacilityDiscount } from './discounts';

/** Base cost for upgrading from currentLevel to currentLevel+1 (before discounts) */
export function calculateBaseCost(currentLevel: number): number {
  return (Math.floor(currentLevel) + 1) * 1500;
}

/** Discounted cost for a single level upgrade, applying training facility discount */
export function calculateDiscountedUpgradeCost(currentLevel: number, trainingLevel: number): number {
  const baseCost = calculateBaseCost(currentLevel);
  const discountPercent = calculateTrainingFacilityDiscount(trainingLevel);
  return Math.floor(baseCost * (1 - discountPercent / 100));
}

/** Total base cost for upgrading from fromLevel to toLevel */
export function calculateUpgradeCostRange(fromLevel: number, toLevel: number): number {
  let total = 0;
  for (let level = fromLevel; level < toLevel; level++) {
    total += calculateBaseCost(level);
  }
  return total;
}
```

### shared/utils/index.ts (barrel)

```typescript
export { calculateWeaponWorkshopDiscount, calculateTrainingFacilityDiscount, applyDiscount } from './discounts';
export { getCapForLevel, ACADEMY_CAP_MAP } from './academyCaps';
export { calculateBaseCost, calculateDiscountedUpgradeCost, calculateUpgradeCostRange } from './upgradeCosts';
```

### Import Updates for Shared Formulas

| File | Old | New |
|------|-----|-----|
| `prototype/backend/src/routes/robots.ts` | Local `getCapForLevel` definition + inline `(level + 1) * 1500` + inline `Math.min(trainingLevel * 10, 90)` | `import { getCapForLevel } from '../../../shared/utils/academyCaps'`, `import { calculateBaseCost } from '../../../shared/utils/upgradeCosts'`, `import { calculateTrainingFacilityDiscount } from '../../../shared/utils/discounts'` |
| `prototype/frontend/src/components/UpgradePlanner.tsx` | Local `getCapForLevel` + `calculateBaseCost` + inline training discount | Imports from `shared/utils/` |
| `prototype/frontend/src/pages/PracticeArenaPage.tsx` | Local `getCapForLevel` + `calculateBaseCost` + inline training discount | Imports from `shared/utils/` |
| `prototype/frontend/src/components/CompactUpgradeSection.tsx` | Inline `(currentLevel + 1) * 1500` + inline `Math.min(trainingLevel * 10, 90)` | Imports `calculateBaseCost` from `shared/utils/upgradeCosts` and `calculateTrainingFacilityDiscount` from `shared/utils/discounts` |
| `prototype/frontend/src/components/onboarding/steps/Step4_Upgrades.tsx` | Local `upgCost()` with inline base cost + training discount | Imports `calculateBaseCost` from `shared/utils/upgradeCosts` and `calculateTrainingFacilityDiscount` from `shared/utils/discounts` |
| `prototype/backend/src/routes/leaderboards.ts` | Local `calculateBattleWinningsBonus` duplicating prestige tiers | Import `getPrestigeMultiplier` from `economyCalculations.ts`, derive bonus as `(getPrestigeMultiplier(prestige) - 1) * 100` |

## Data Models

No data model changes. This is a pure code organization refactoring.

## Documentation Impact

- `.kiro/steering/coding-standards.md` — Add a "Route Handler Guidelines" section specifying the thin-route pattern and maximum handler size. Add a note in Code Organization that game formulas shared between frontend and backend must live in `prototype/shared/utils/`. Add a rule that inline formulas must not duplicate functions already exported from `shared/utils/` (specifically: never inline `(level + 1) * 1500` or `Math.min(level * 10, 90)` when `calculateBaseCost` and `calculateTrainingFacilityDiscount` exist).
- `.kiro/steering/project-overview.md` — Add `/prototype/shared` to the Project Structure section, describing it as shared TypeScript modules imported by both frontend and backend (game formulas, discount calculations).
- `docs/guides/MODULE_STRUCTURE.md` — Update to reflect new service directories (`robot/`, `match/`, `admin/`) and document the `shared/` directory purpose and contents. Update the `stables.ts` standalone route entry to reference `sanitizeRobotForPublic` from `src/services/robot/robotSanitizer.ts` instead of `robots.ts`. Add `prototype/shared/` to the project tree diagram.
- `docs/balance_changes/OPTION_C_IMPLEMENTATION.md` — Update the file reference on line 255 that points to `robots.ts` line 321 for the `baseCost = (Math.floor(currentLevel) + 1) * 1500` formula — this will move to `shared/utils/upgradeCosts.ts`.

## Testing Strategy

### Unit Tests
- New unit tests for extracted backend service functions (adminBattleService, adminStatsService, robotSanitizer, robotRankingService, matchHistoryService).
- Tests for shared formulas: `getCapForLevel` for all levels 0–10 and out-of-range values, `calculateBaseCost` for levels 0, 1, 10, 49, `calculateUpgradeCostRange` for multi-level ranges.

### Regression
- Existing backend tests serve as the regression safety net — they must all pass without behavioral changes.
- Frontend build must succeed after shared import updates.
- No new integration tests needed since the API contract is unchanged.

### Verification
- Run full backend test suite after each route file extraction.
- Run frontend build after shared formula consolidation.
- Compare API response shapes before and after using existing test assertions.

## Ordering Notes

- This spec should run AFTER spec 18 (type safety) since typed route files are easier to extract from.
- This spec should run BEFORE spec 5 (modular architecture) since it creates new service files that spec 5's mapping needs to account for.
- This spec should run BEFORE spec 10 (prototype → app rename) since it uses `prototype/` paths throughout.
