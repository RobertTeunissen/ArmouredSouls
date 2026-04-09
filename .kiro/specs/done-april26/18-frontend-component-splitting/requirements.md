# Requirements Document

## Introduction

Split oversized frontend page components into smaller, focused sub-components. Several page files contain multiple component definitions inline, making them hard to navigate, test, and reuse. The worst offender, `PracticeArenaPage.tsx` (1,413 lines), defines 9 components in a single file.

## Glossary

- **Page Component**: A top-level React component that represents a full page/route in the application (e.g., `PracticeArenaPage`).
- **Sub-Component**: A React component defined inside a page file that handles a specific section of the page UI.
- **Component File**: A single `.tsx` file containing one component and its directly related types/helpers.

## Expected Contribution

This spec targets the "oversized frontend components" debt where page files contain hundreds of lines of inline sub-components.

1. **PracticeArenaPage.tsx reduction**: From 1,413 lines with 9 inline components to under 300 lines. Sub-components (`SlotToggle`, `BotTierSelector`, `ConfigSelect`, `SparringConfigPanel`, `WhatIfPanel`, `BattleSlotPanel`, `SimulationResultBanner`, `BatchSummary`, `HistoryPanel`) extracted to separate files.
2. **FacilitiesPage.tsx reduction**: From 960 lines to under 300 lines.
3. **WeaponShopPage.tsx reduction**: From 926 lines to under 300 lines.
4. **HallOfRecordsPage.tsx reduction**: From 940 lines to under 300 lines.
5. **BattleDetailPage.tsx reduction**: From 985 lines to under 300 lines.
6. **Navigation.tsx reduction**: From 756 lines to under 200 lines.

### Verification Criteria

1. `wc -l prototype/frontend/src/pages/PracticeArenaPage.tsx` returns under 300
2. `wc -l prototype/frontend/src/pages/FacilitiesPage.tsx` returns under 300
3. `wc -l prototype/frontend/src/pages/WeaponShopPage.tsx` returns under 300
4. `wc -l prototype/frontend/src/pages/HallOfRecordsPage.tsx` returns under 300
5. `wc -l prototype/frontend/src/pages/BattleDetailPage.tsx` returns under 300
6. `wc -l prototype/frontend/src/components/Navigation.tsx` returns under 200
7. Frontend builds successfully: `cd prototype/frontend && npm run build`
8. No inline component definitions remain in page files: `grep -c "^function [A-Z]" prototype/frontend/src/pages/PracticeArenaPage.tsx` returns 1 (only the page component itself)

## Requirements

### Requirement 1: PracticeArenaPage Splitting

**User Story:** As a frontend developer, I want the Practice Arena page to be composed of small, focused sub-components in separate files, so that each piece is independently understandable and testable.

#### Acceptance Criteria

1. WHEN `PracticeArenaPage.tsx` is split, EACH of the 9 inline sub-components (`SlotToggle`, `BotTierSelector`, `ConfigSelect`, `SparringConfigPanel`, `WhatIfPanel`, `BattleSlotPanel`, `SimulationResultBanner`, `BatchSummary`, `HistoryPanel`) SHALL be moved to its own file under `src/components/practice-arena/`.
2. WHEN sub-components are extracted, THEIR props SHALL be defined as explicit interfaces in the component file.
3. WHEN the extraction is complete, `PracticeArenaPage.tsx` SHALL contain only the page-level component with state management and sub-component composition.

### Requirement 2: Other Page Splitting

**User Story:** As a frontend developer, I want all oversized page components to be split into focused sub-components.

#### Acceptance Criteria

1. WHEN `FacilitiesPage.tsx` is split, INLINE sub-components SHALL be extracted to `src/components/facilities/`.
2. WHEN `WeaponShopPage.tsx` is split, INLINE sub-components SHALL be extracted to `src/components/weapon-shop/`.
3. WHEN `HallOfRecordsPage.tsx` is split, INLINE sub-components SHALL be extracted to `src/components/hall-of-records/`.
4. WHEN `BattleDetailPage.tsx` is split, INLINE sub-components SHALL be extracted to `src/components/battle-detail/`.
5. WHEN `Navigation.tsx` is split, INLINE sub-components SHALL be extracted to `src/components/navigation/`.

### Requirement 3: Component Organization

**User Story:** As a frontend developer, I want extracted components to follow a consistent organization pattern.

#### Acceptance Criteria

1. WHEN sub-components are extracted, THEY SHALL be placed in a directory named after the parent page (kebab-case, e.g., `practice-arena/`).
2. WHEN a sub-component directory is created, IT SHALL contain an `index.ts` barrel export for clean imports.
3. WHEN sub-components share types, THE shared types SHALL be defined in a `types.ts` file within the sub-component directory.

### Requirement 4: No Visual or Behavioral Changes

**User Story:** As a player, I want the UI to look and behave identically after the component splitting.

#### Acceptance Criteria

1. WHEN any component is extracted, THE rendered output SHALL be pixel-identical to the original.
2. WHEN all extractions are complete, THE frontend SHALL build without errors or warnings.
