# Implementation Plan: Frontend Testing Foundation — Coverage Gaps

## Overview

Write tests for the four untested utility files and three extracted sub-component directories, then update steering documentation. No infrastructure setup needed — Vitest, RTL, CI, store tests, and `bracketUtils` tests already exist.

## Tasks

- [x] 1. Write utility tests — robotStats
  - [x] 1.1 Create `src/utils/__tests__/robotStats.test.ts` with tests for `calculateAttributeBonus` (main weapon only, offhand only, both weapons, null/undefined weapons, attribute not present on weapon), `getLoadoutBonus` (all four loadout types + unknown type), `getStanceModifier` (offensive, defensive, balanced, unknown), and `calculateEffectiveStat` (floor behavior, zero loadout bonus, positive/negative loadout multiplier)
  - [x] 1.2 Add tests for `calculateEffectiveStats` (full robot object, verify all 23 attributes present in result), `calculateMaxHP` (formula: 50 + hullIntegrity×5), and `calculateMaxShield` (formula: shieldCapacity×4)
  - [x] 1.3 Add tests for `getAttributeDisplay` (no bonus, weapon bonus only, loadout modifier only, both, display string format), `getLoadoutModifiedAttributes` (each loadout type returns correct attribute list, unknown returns empty), `formatLoadoutName` (all four types + unknown fallback), and `getLoadoutDescription` (all four types + unknown fallback)
  - [x] 1.4 Run `npx vitest --run src/utils/__tests__/robotStats.test.ts` and verify all tests pass
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 2. Write utility tests — battleHistoryStats
  - [x] 2.1 Create `src/utils/__tests__/battleHistoryStats.test.ts` with mocked `matchmakingApi` helpers (`getBattleOutcome`, `getELOChange`, `getBattleReward`), testing `computeBattleSummary` with empty array (returns `EMPTY_SUMMARY`), single league win, single league loss, single draw
  - [x] 2.2 Add tests for battle type categorization: league battles (default), tournament battles (`battleType: 'tournament'`), tag-team battles (`battleType: 'tag_team'`), KotH battles (`battleType: 'koth'`) — verify each increments the correct per-type counter
  - [x] 2.3 Add tests for aggregate stats: win rate calculation (wins/total), average ELO change, total credits earned, and streak detection (streak of 3+ wins, streak of 3+ losses, no streak when count < 3, draw at start breaks streak)
  - [x] 2.4 Add tests for KotH-specific stats: placement counting (1st/2nd/3rd/other), zone score averaging, total credits, total kills, KotH outcome derived from placement (1st = win, others = loss)
  - [x] 2.5 Run `npx vitest --run src/utils/__tests__/battleHistoryStats.test.ts` and verify all tests pass
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 3. Write utility tests — formatters and weaponRange
  - [x] 3.1 Create `src/utils/__tests__/formatters.test.ts` with tests for `formatCurrency` (positive number with locale separator, zero, negative, NaN returns `₡0`), `formatCost` (below 1K shows full, 1K-999K shows K suffix, 1M+ shows M suffix with one decimal), `formatNumber` (locale separator), and `getLeagueColor` (all six league tiers return correct Tailwind class, unknown returns `text-gray-400`)
  - [x] 3.2 Create `src/utils/__tests__/weaponRange.test.ts` with tests for `getWeaponOptimalRange` (returns stored rangeBand), `getRangeBandColor` (all four bands return correct Tailwind class), `getRangeBandBgColor` (all four bands), and `getRangeBandLabel` (melee→'Melee', short→'Short', mid→'Mid', long→'Long')
  - [x] 3.3 Run `npx vitest --run src/utils/__tests__/formatters.test.ts src/utils/__tests__/weaponRange.test.ts` and verify all tests pass
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 4. Write sub-component tests
  - [x] 4.1 Create `src/components/practice-arena/__tests__/WhatIfPanel.test.tsx` testing: renders collapsed by default (configuration content hidden), expands on button click (shows stance/yield controls and attribute categories), displays attribute values from robot prop, reset button clears overrides. Mock `shared/utils/` imports (`getCapForLevel`, `calculateBaseCost`, `calculateTrainingFacilityDiscount`).
  - [x] 4.2 Create `src/components/facilities/__tests__/FacilityCard.test.tsx` testing: displays facility name and level progress (e.g., "3/10"), shows "Coming Soon" badge when `implemented` is false, shows upgrade button enabled when credits sufficient and prestige met, disables upgrade button when credits insufficient, shows "Maximum Level Reached" when `canUpgrade` is false, shows prestige requirement warning when prestige insufficient.
  - [x] 4.3 Create `src/components/weapon-shop/__tests__/WeaponCard.test.tsx` testing: displays weapon name/type/stats/cost, shows discounted price when workshop level > 0, shows "Already Own" badge when `ownedCount > 0`, disables purchase button when credits insufficient, disables purchase button when storage full, comparison checkbox toggleable. Mock `shared/utils/discounts` and `../../utils/weaponImages`.
  - [x] 4.4 Run `npx vitest --run src/components/practice-arena/__tests__ src/components/facilities/__tests__ src/components/weapon-shop/__tests__` and verify all tests pass
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 5. Documentation and verification
  - [x] 5.1 Add a "Frontend Testing" section to `.kiro/steering/testing-strategy.md` documenting: framework (Vitest 4 + RTL + fast-check), setup file (`src/setupTests.ts`), file convention (`__tests__/` subdirectories, `*.test.ts`/`*.test.tsx` naming, `*.pbt.test.ts(x)` for property-based), coverage targets (80% utilities/stores, baseline for components), commands (`cd prototype/frontend && npx vitest --run`, `npx vitest --run --coverage`), CI integration (already in `frontend-tests` job in `ci.yml`)
  - [x] 5.2 Add a "Testing" section to `.kiro/steering/frontend-standards.md` documenting: test file location (`__tests__/` subdirectory next to source files), naming conventions, minimum coverage requirements (80% utilities/stores), component test approach (RTL render/screen, mock API calls, test user interactions via userEvent)
  - [x] 5.3 Run verification criteria: confirm 4 new utility test files exist in `src/utils/__tests__/`, confirm at least 3 component test files exist across the three component directories, confirm `npx vitest --run` passes, confirm coverage for `robotStats.ts`, `battleHistoryStats.ts`, `formatters.ts`, and `weaponRange.ts` is each at 80%+, confirm `testing-strategy.md` contains "Frontend Testing" section
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2_
