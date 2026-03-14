# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Mobile Responsiveness Defects
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bugs exist
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bugs exist across breakpoint alignment, layout overflow, touch targets, and design tokens
  - **Scoped PBT Approach**: Use fast-check to generate viewport widths in the bug condition range (320–1023px) and verify expected mobile behavior
  - Test file: `prototype/frontend/src/__tests__/mobile-responsiveness-bug-condition.test.ts`
  - Test 1 - Breakpoint Mismatch: Import `useIsMobile` from both `useIsMobile.ts` and `useMediaQuery.ts`. For any viewport width in [768, 1023], assert hook returns `true`. Use fast-check `fc.integer({min: 768, max: 1023})` to generate widths in the dead zone. On unfixed code, hooks return `false` in this range — test will FAIL confirming the breakpoint mismatch (Bug Condition: `isBugCondition(input) where viewportWidth < 1024 AND hookBreakpoint != navigationBreakpoint`)
  - Test 2 - Design Token Violations: Use fast-check with `fc.constantFrom(...)` over the list of affected page component file paths (`LeagueStandingsPage.tsx`, `AdminPage.tsx`, `FinancialReportPage.tsx`, `HallOfRecordsPage.tsx`, `DashboardPage.tsx`, `TournamentDetailPage.tsx`, `CreateRobotPage.tsx`). For each file, read source and assert no matches for hardcoded gray patterns (`bg-gray-900`, `bg-gray-800`, `bg-gray-700`, `text-gray-400`, `text-gray-500`, `border-gray-700`). On unfixed code, test will FAIL confirming design token inconsistency
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct - it proves the bugs exist)
  - Document counterexamples found (e.g., "`useIsMobile()` returns `false` at 900px", "FinancialReportPage.tsx contains `bg-gray-900`")
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.11, 1.12_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Desktop Layout and Functionality Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Test file: `prototype/frontend/src/__tests__/mobile-responsiveness-preservation.test.ts`
  - Observe: `useIsMobile` from `useIsMobile.ts` returns `false` at viewport widths ≥1024 on unfixed code
  - Observe: `useIsMobile` from `useMediaQuery.ts` returns `false` at viewport widths ≥1024 on unfixed code
  - Observe: Navigation component renders desktop nav (`hidden lg:block`) at ≥1024px on unfixed code
  - Write property-based test with fast-check: for all viewport widths ≥1024 (`fc.integer({min: 1024, max: 1920})`), both `useIsMobile` hooks return `false` (Preservation: desktop behavior unchanged per design section "Preservation Requirements")
  - Write property-based test: for all viewport widths ≥1024, Navigation renders the desktop `nav` element with class `lg:block`
  - Write property-based test: for all viewport widths ≥1024, page layout containers do not have mobile-specific stacking classes applied (e.g., `flex-col` without `lg:flex-row` qualifier is not the active layout)
  - Verify all tests PASS on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline desktop behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 3. Fix for mobile responsiveness defects across all affected pages

  - [x] 3.1 Align breakpoint in useIsMobile hooks to 1024px
    - In `prototype/frontend/src/hooks/useIsMobile.ts`: change `MOBILE_BREAKPOINT` from `768` to `1024`
    - In `prototype/frontend/src/hooks/useMediaQuery.ts`: change convenience `useIsMobile()` from `max-width: 768px` to `max-width: 1023px`
    - This eliminates the 768–1024px dead zone where hooks and Navigation disagree
    - _Bug_Condition: isBugCondition(input) where viewportWidth < 1024 AND hookBreakpoint != navigationBreakpoint_
    - _Expected_Behavior: useIsMobile returns true for all viewports < 1024px, false for ≥1024px_
    - _Preservation: Desktop behavior (≥1024px) unchanged — hooks still return false_
    - _Requirements: 2.1, 2.12_

  - [x] 3.2 Fix LeagueStandingsPage mobile layout
    - In `prototype/frontend/src/pages/LeagueStandingsPage.tsx`:
    - Ensure table is wrapped in `overflow-x-auto` container with scroll affordance
    - Add mobile-friendly column hiding or card layout below `lg:` breakpoint
    - Replace hardcoded gray colors with design tokens (`bg-gray-900` → `bg-background`, `bg-gray-800` → `bg-surface`, `text-gray-400` → `text-secondary`)
    - _Bug_Condition: viewportWidth < 768 AND table overflows viewport_
    - _Expected_Behavior: table fits viewport or scrolls horizontally with affordance_
    - _Preservation: Desktop table layout unchanged at ≥1024px_
    - _Requirements: 2.2, 2.11_

  - [x] 3.3 Fix AdminPage tab navigation and stats grid
    - In `prototype/frontend/src/pages/AdminPage.tsx`:
    - Make tab navigation horizontally scrollable with `overflow-x-auto` and `flex-nowrap`
    - Adjust stats grid to `grid-cols-2` on small screens
    - Replace hardcoded gray colors with design tokens
    - _Bug_Condition: viewportWidth < 768 AND tabs overflow OR stats grid is cramped_
    - _Expected_Behavior: tabs scroll horizontally, stats grid uses 2-col layout on mobile_
    - _Preservation: Desktop admin layout unchanged at ≥1024px_
    - _Requirements: 2.3, 2.11_

  - [x] 3.4 Fix AdminPage battle logs table and filters
    - In `prototype/frontend/src/pages/AdminPage.tsx`:
    - Wrap battle table in `overflow-x-auto` container
    - Stack search/filter controls vertically on mobile with `flex-col lg:flex-row`
    - Make filter inputs full-width on mobile
    - Add `min-h-[44px]` to action buttons for touch targets
    - _Bug_Condition: viewportWidth < 768 AND battle table overflows AND filter controls overflow_
    - _Expected_Behavior: table scrolls horizontally, filters stack vertically, touch targets ≥44px_
    - _Preservation: Desktop battle logs layout unchanged at ≥1024px_
    - _Requirements: 2.4, 2.10, 2.11_

  - [x] 3.5 Fix BattleHistoryPage filter controls
    - In `prototype/frontend/src/pages/BattleHistoryPage.tsx`:
    - Change filter bar to `flex flex-col lg:flex-row` for mobile stacking
    - Make each control full-width on mobile
    - Add `min-h-[44px]` to all interactive filter controls
    - _Bug_Condition: viewportWidth < 768 AND filter controls wrap awkwardly with small touch targets_
    - _Expected_Behavior: filters stack vertically, each full-width, touch targets ≥44px_
    - _Preservation: Desktop filter layout unchanged at ≥1024px_
    - _Requirements: 2.5, 2.10_

  - [x] 3.6 Fix FinancialReportPage header and layout
    - In `prototype/frontend/src/pages/FinancialReportPage.tsx`:
    - Change header from `flex justify-between` to `flex flex-col lg:flex-row lg:justify-between`
    - Stack Financial Health section vertically on mobile with `flex flex-col lg:flex-row`
    - Replace all hardcoded gray/blue colors with design tokens (`bg-gray-900` → `bg-background`, `bg-gray-800` → `bg-surface`, `text-gray-400` → `text-secondary`, `bg-blue-600` → `bg-primary`, `text-blue-500` → `text-primary`, `text-green-400` → `text-success`, `text-red-400` → `text-error`)
    - _Bug_Condition: viewportWidth < 768 AND header elements collide AND hardcoded colors used_
    - _Expected_Behavior: header stacks vertically, Financial Health stacks, design tokens used_
    - _Preservation: Desktop layout unchanged at ≥1024px, visual appearance matches dark theme_
    - _Requirements: 2.6, 2.11_

  - [x] 3.7 Fix HallOfRecordsPage grid
    - In `prototype/frontend/src/pages/HallOfRecordsPage.tsx`:
    - Ensure record sections use single-column layout on mobile
    - Replace hardcoded gray colors with design tokens
    - _Bug_Condition: viewportWidth < 768 AND grid overflows OR hardcoded colors used_
    - _Expected_Behavior: single-column layout on mobile, design tokens used_
    - _Preservation: Desktop grid layout unchanged at ≥1024px_
    - _Requirements: 2.7, 2.11_

  - [x] 3.8 Fix DashboardPage header
    - In `prototype/frontend/src/pages/DashboardPage.tsx`:
    - Change header from `flex items-center justify-between` to `flex flex-col lg:flex-row lg:items-center lg:justify-between`
    - Replace `border-gray-700` → `border-white/10` and `text-gray-400` → `text-secondary`
    - _Bug_Condition: viewportWidth < 768 AND header title and stable name collide_
    - _Expected_Behavior: header stacks vertically on mobile, design tokens used_
    - _Preservation: Desktop header layout unchanged at ≥1024px_
    - _Requirements: 2.8, 2.11_

  - [x] 3.9 Fix TournamentDetailPage bracket
    - In `prototype/frontend/src/pages/TournamentDetailPage.tsx`:
    - BracketView already uses `useIsMobile` from `useMediaQuery.ts` — breakpoint fix in 3.1 resolves the dead zone
    - Wrap bracket visualization in `overflow-x-auto` container with scroll affordance if not already
    - Replace hardcoded gray colors with design tokens throughout the page
    - _Bug_Condition: viewportWidth < 768 AND bracket overflows without scroll OR hardcoded colors used_
    - _Expected_Behavior: bracket scrolls horizontally or adapts to mobile, design tokens used_
    - _Preservation: Desktop bracket layout unchanged at ≥1024px_
    - _Requirements: 2.9, 2.11_

  - [x] 3.10 Fix touch target sizing across pages with tables and forms
    - Add `min-h-[44px]` to table action buttons, links, and select dropdowns on mobile across AdminPage, LeagueStandingsPage
    - Add `min-h-[44px]` to form inputs and buttons on ProfilePage (`prototype/frontend/src/pages/ProfilePage.tsx`), CreateRobotPage (`prototype/frontend/src/pages/CreateRobotPage.tsx`), OnboardingPage (`prototype/frontend/src/pages/OnboardingPage.tsx`)
    - Use responsive padding for table cells: `p-2 lg:p-3` or `p-2 lg:p-4`
    - _Bug_Condition: viewportWidth < 768 AND interactive elements have touch target < 44px_
    - _Expected_Behavior: all interactive elements ≥44x44px on mobile_
    - _Preservation: Desktop padding and sizing unchanged at ≥1024px_
    - _Requirements: 2.10, 2.14_

  - [x] 3.11 Replace design tokens across all remaining pages
    - Scan and replace across all page files not yet covered:
    - `bg-gray-900` → `bg-background`
    - `bg-gray-800` → `bg-surface`
    - `bg-gray-700` → `bg-surface-elevated`
    - `text-gray-400` → `text-secondary`
    - `text-gray-500` → `text-tertiary`
    - `text-gray-300` → `text-secondary`
    - `border-gray-700` → `border-white/10`
    - `bg-blue-600`/`bg-blue-500` → `bg-primary`/`bg-primary-dark`
    - `text-blue-500`/`text-blue-400` → `text-primary`
    - `text-green-400` → `text-success`
    - `text-red-400` → `text-error`
    - `text-yellow-400` → `text-warning`
    - _Bug_Condition: hardcoded gray/color values used instead of design tokens at any viewport_
    - _Expected_Behavior: all pages use Tailwind design tokens consistently_
    - _Preservation: Visual appearance matches dark theme — token values are close equivalents to hardcoded grays_
    - _Requirements: 2.11_

  - [x] 3.12 Fix WeaponShopPage cards
    - In `prototype/frontend/src/pages/WeaponShopPage.tsx`:
    - Ensure weapon card grid uses `grid-cols-1 lg:grid-cols-2 xl:grid-cols-3` for mobile single-column
    - Add adequate spacing and touch-friendly interaction areas
    - _Bug_Condition: viewportWidth < 768 AND weapon cards don't reflow to single column_
    - _Expected_Behavior: single-column card layout on mobile with touch-friendly spacing_
    - _Preservation: Desktop card grid unchanged at ≥1024px_
    - _Requirements: 2.13_

  - [x] 3.13 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Mobile Responsiveness Defects
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior for breakpoint alignment and design token usage
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1: `prototype/frontend/src/__tests__/mobile-responsiveness-bug-condition.test.ts`
    - **EXPECTED OUTCOME**: Test PASSES (confirms bugs are fixed)
    - _Requirements: 2.1, 2.11, 2.12_

  - [x] 3.14 Verify preservation tests still pass
    - **Property 2: Preservation** - Desktop Layout and Functionality Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2: `prototype/frontend/src/__tests__/mobile-responsiveness-preservation.test.ts`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all desktop behavior preserved after fix (no regressions at ≥1024px)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite: `cd prototype/frontend && npx vitest --run`
  - Ensure all property-based tests pass (bug condition + preservation)
  - Ensure no existing tests are broken by the responsive changes
  - Ask the user if questions arise
