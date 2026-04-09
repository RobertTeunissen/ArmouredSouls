# Implementation Plan: Frontend Component Splitting

## Overview

Extract inline sub-components from the 6 largest frontend files into dedicated component files. Each task group handles one file.

## Tasks

- [x] 1. Split PracticeArenaPage
  - [x] 1.1 Create `src/components/practice-arena/types.ts` with all shared interfaces (`OwnedRobot`, `SparringPartnerDef`, `SparringConfig`, `WhatIfOverrides`, `SlotState`, `PracticeBattleResult`, `PracticeBatchResult`)
  - [x] 1.2 Extract `SlotToggle`, `BotTierSelector`, `ConfigSelect`, `SparringConfigPanel` to individual files in `src/components/practice-arena/`
  - [x] 1.3 Extract `WhatIfPanel`, `BattleSlotPanel`, `SimulationResultBanner`, `BatchSummary`, `HistoryPanel` to individual files
  - [x] 1.4 Create `src/components/practice-arena/index.ts` barrel export
  - [x] 1.5 Refactor `PracticeArenaPage.tsx` to import from the new directory, keeping only page-level state and composition
  - [x] 1.6 Run `npm run build` to verify no errors
  - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.2, 3.3, 4.1, 4.2_

- [x] 2. Split FacilitiesPage and WeaponShopPage
  - [x] 2.1 Identify inline sub-components in `FacilitiesPage.tsx`, extract to `src/components/facilities/` with types and barrel export
  - [x] 2.2 Identify inline sub-components in `WeaponShopPage.tsx`, extract to `src/components/weapon-shop/` with types and barrel export
  - [x] 2.3 Refactor both page files to import from new directories
  - [x] 2.4 Run `npm run build` to verify no errors
  - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 4.1, 4.2_

- [x] 3. Split HallOfRecordsPage and BattleDetailPage
  - [x] 3.1 Identify inline sub-components in `HallOfRecordsPage.tsx`, extract to `src/components/hall-of-records/` with types and barrel export
  - [x] 3.2 Identify inline sub-components in `BattleDetailPage.tsx`, extract to `src/components/battle-detail/` with types and barrel export
  - [x] 3.3 Refactor both page files to import from new directories
  - [x] 3.4 Run `npm run build` to verify no errors
  - _Requirements: 2.3, 2.4, 3.1, 3.2, 3.3, 4.1, 4.2_

- [x] 4. Split Navigation
  - [x] 4.1 Identify inline sub-components in `Navigation.tsx`, extract to `src/components/navigation/` with types and barrel export
  - [x] 4.2 Refactor `Navigation.tsx` to import from the new directory
  - [x] 4.3 Run `npm run build` to verify no errors
  - _Requirements: 2.5, 3.1, 3.2, 4.1, 4.2_

- [x] 5. Documentation and verification
  - [x] 5.1 Update `.kiro/steering/frontend-standards.md` to add a "Component Size Guidelines" section specifying maximum page component size (300 lines) and the extraction pattern
  - [x] 5.2 Run verification criteria: confirm `wc -l` targets met for all 6 files, confirm no inline component definitions remain in page files, confirm frontend builds successfully
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 4.1, 4.2_
