# Requirements Document

## Introduction

Close the remaining frontend test coverage gaps for shared utility functions and extracted sub-components. The frontend already has a mature test infrastructure (Vitest 4, RTL, fast-check, 118 test files, CI integration) established through prior specs and feature work. However, four key utility files (`robotStats.ts`, `battleHistoryStats.ts`, `formatters.ts`, `weaponRange.ts`) have zero test coverage, and the three component directories created in spec 18 (`practice-arena/`, `facilities/`, `weapon-shop/`) have no sub-component-level tests. The `testing-strategy.md` steering file also lacks any frontend testing documentation.

## Glossary

- **Vitest**: The frontend test runner (Vitest 4, already fully configured).
- **React Testing Library (RTL)**: Testing library for React components, already installed and configured in `setupTests.ts`.
- **fast-check**: Property-based testing library, already installed as a devDependency.
- **Sub-component tests**: Tests for individual extracted components (e.g., `WhatIfPanel`, `FacilityCard`) as opposed to page-level integration tests.

## Expected Contribution

This spec closes the remaining utility and sub-component test gaps in the frontend.

1. **Utility test coverage**: From 0% to 80%+ coverage on `robotStats.ts`, `battleHistoryStats.ts`, `formatters.ts`, and `weaponRange.ts` — the four untested utility files containing game calculations and display logic.
2. **Sub-component test baseline**: From 0 to at least 1 test file per extracted component directory (`practice-arena/`, `facilities/`, `weapon-shop/`), testing the sub-components created in spec 18.
3. **Documentation alignment**: The `testing-strategy.md` steering file currently documents only backend testing. This spec adds a "Frontend Testing" section covering the Vitest + RTL setup, file conventions, and coverage targets.

### Verification Criteria

1. `find app/frontend/src/utils/__tests__ -name "robotStats.test.ts" -o -name "battleHistoryStats.test.ts" -o -name "formatters.test.ts" -o -name "weaponRange.test.ts" | wc -l` returns 4
2. `find app/frontend/src/components/practice-arena app/frontend/src/components/facilities app/frontend/src/components/weapon-shop -name "*.test.tsx" | wc -l` returns at least 3
3. `cd app/frontend && npx vitest --run` exits with code 0
4. `cd app/frontend && npx vitest --run --coverage` shows `robotStats.ts`, `battleHistoryStats.ts`, `formatters.ts`, and `weaponRange.ts` each at 80%+ coverage
5. `grep -c "Frontend Testing" .kiro/steering/testing-strategy.md` returns at least 1

## Requirements

### Requirement 1: Utility Function Tests — robotStats

**User Story:** As a frontend developer, I want `robotStats.ts` to have comprehensive tests so that weapon bonus calculations, loadout modifiers, stance modifiers, and effective stat computations are verified.

#### Acceptance Criteria

1. WHEN tests are written for `robotStats.ts`, THEY SHALL cover `calculateAttributeBonus` with main weapon only, offhand only, both weapons, and null/undefined weapons.
2. WHEN tests are written for `robotStats.ts`, THEY SHALL cover `getLoadoutBonus` and `getStanceModifier` for all known loadout/stance types and unknown types.
3. WHEN tests are written for `robotStats.ts`, THEY SHALL cover `calculateEffectiveStat` including the floor behavior and loadout multiplier math.
4. WHEN tests are written for `robotStats.ts`, THEY SHALL cover `calculateEffectiveStats`, `calculateMaxHP`, and `calculateMaxShield` with a full robot object.
5. WHEN tests are written for `robotStats.ts`, THEY SHALL cover `getAttributeDisplay`, `getLoadoutModifiedAttributes`, `formatLoadoutName`, and `getLoadoutDescription`.
6. WHEN tests are written for `robotStats.ts`, COVERAGE SHALL be at least 80%.

### Requirement 2: Utility Function Tests — battleHistoryStats

**User Story:** As a frontend developer, I want `battleHistoryStats.ts` to have tests so that battle summary computation (win rates, streaks, per-type stats, KotH stats) is verified.

#### Acceptance Criteria

1. WHEN tests are written for `battleHistoryStats.ts`, THEY SHALL cover `computeBattleSummary` with an empty battle array returning `EMPTY_SUMMARY`.
2. WHEN tests are written for `battleHistoryStats.ts`, THEY SHALL cover league, tournament, tag-team, and KotH battle type categorization.
3. WHEN tests are written for `battleHistoryStats.ts`, THEY SHALL cover win/loss/draw counting, win rate calculation, and average ELO change.
4. WHEN tests are written for `battleHistoryStats.ts`, THEY SHALL cover streak detection (streak of 3+, no streak below 3, draw breaking streak).
5. WHEN tests are written for `battleHistoryStats.ts`, THEY SHALL cover KotH-specific stats (placements, zone score averaging, credits, kills).
6. WHEN tests are written for `battleHistoryStats.ts`, COVERAGE SHALL be at least 80%.

### Requirement 3: Utility Function Tests — formatters and weaponRange

**User Story:** As a frontend developer, I want `formatters.ts` and `weaponRange.ts` to have tests so that currency formatting, number formatting, league colors, range band classification, and range band display helpers are verified.

#### Acceptance Criteria

1. WHEN tests are written for `formatters.ts`, THEY SHALL cover `formatCurrency` (positive, zero, negative, NaN/undefined edge cases), `formatCost` (below 1K, K range, M range), `formatNumber`, and `getLeagueColor` for all league tiers plus unknown.
2. WHEN tests are written for `weaponRange.ts`, THEY SHALL cover `getWeaponOptimalRange`, `getRangeBandColor`, `getRangeBandBgColor`, and `getRangeBandLabel` for all four range bands.
3. WHEN tests are written, COVERAGE for each file SHALL be at least 80%.

### Requirement 4: Sub-Component Tests — practice-arena, facilities, weapon-shop

**User Story:** As a frontend developer, I want at least one sub-component test file per extracted component directory so that the components created in spec 18 have baseline test coverage.

#### Acceptance Criteria

1. WHEN a test is written for `practice-arena/`, IT SHALL test `WhatIfPanel` rendering (collapsed/expanded state, attribute display, reset button) with mocked props.
2. WHEN a test is written for `facilities/`, IT SHALL test `FacilityCard` rendering (level display, upgrade button states, prestige requirements, cost display) with mocked props.
3. WHEN a test is written for `weapon-shop/`, IT SHALL test `WeaponCard` rendering (weapon stats, purchase button states, comparison checkbox, discount display) with mocked props.
4. WHEN sub-component tests are written, THEY SHALL use RTL's `render`/`screen` and `userEvent` for interaction testing.
5. WHEN sub-component tests are written, THEY SHALL follow the project's `__tests__/` subdirectory convention.

### Requirement 5: Documentation — Frontend Testing Section

**User Story:** As a developer, I want the testing strategy steering file to document the frontend testing setup so that new contributors know how to write and run frontend tests.

#### Acceptance Criteria

1. WHEN documentation is updated, `.kiro/steering/testing-strategy.md` SHALL include a "Frontend Testing" section describing the Vitest + RTL setup, the `__tests__/` subdirectory convention, coverage targets (80% utilities, baseline for components), and how to run frontend tests (`cd app/frontend && npx vitest --run`).
2. WHEN documentation is updated, `.kiro/steering/frontend-standards.md` SHALL include a "Testing" section with the `__tests__/` co-location pattern and minimum coverage requirements.
