# Mobile Responsiveness Audit Bugfix Design

## Overview

Multiple pages across the Armoured Souls frontend have mobile responsiveness defects spanning 14 identified issues. The root cause is a combination of: (1) a breakpoint mismatch between the `useIsMobile` hooks (768px) and the Navigation component (Tailwind `lg:1024px`), (2) missing responsive layout adaptations on page components (tables, grids, headers, forms), (3) hardcoded gray color values instead of Tailwind design tokens, and (4) touch targets below the 44x44px WCAG minimum. The fix strategy is to align the breakpoint to `lg:1024px`, add responsive Tailwind classes to affected components, replace hardcoded colors with design tokens, and ensure all interactive elements meet WCAG touch target minimums.

## Glossary

- **Bug_Condition (C)**: The viewport width is below 1024px and the page renders layout elements that overflow, collide, or are unusable on narrow screens; OR hardcoded gray colors are used instead of design tokens at any viewport width
- **Property (P)**: All pages render correctly at all viewport widths — mobile layouts stack/scroll appropriately, touch targets meet 44x44px minimum, and design tokens are used consistently
- **Preservation**: All desktop layouts (≥1024px) and existing functionality (data fetching, filtering, sorting, pagination, navigation, form submission) remain unchanged
- **useIsMobile (useIsMobile.ts)**: Hook in `prototype/frontend/src/hooks/useIsMobile.ts` that returns `true` when `window.innerWidth < 768`
- **useIsMobile (useMediaQuery.ts)**: Convenience hook in `prototype/frontend/src/hooks/useMediaQuery.ts` that returns `true` when `max-width: 768px`
- **Navigation**: Component in `prototype/frontend/src/components/Navigation.tsx` that switches between desktop top-nav and mobile bottom-tab at Tailwind `lg:1024px`
- **Design Tokens**: Custom colors defined in `tailwind.config.js` — `background (#0a0e14)`, `surface (#1a1f29)`, `surface-elevated (#252b38)`, `primary`, `secondary`, `tertiary`, `success`, `warning`, `error`, `info`

## Bug Details

### Bug Condition

The bugs manifest across two dimensions: (1) viewport-dependent layout failures when width is below 1024px, and (2) design token inconsistency at all viewport widths. The breakpoint mismatch between hooks and Navigation creates a 768–1024px dead zone. Below 768px, tables overflow, headers collide, grids don't collapse, touch targets are too small, and forms are not mobile-optimized.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { viewportWidth: number, pageName: string, elementType: string }
  OUTPUT: boolean

  // Breakpoint mismatch bug (defects 1.1, 1.12)
  IF input.viewportWidth < 1024
     AND componentUsesIsMobileHook(input.pageName)
     AND hookBreakpoint != navigationBreakpoint
  THEN RETURN true

  // Layout overflow bugs (defects 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.13)
  IF input.viewportWidth < 768
     AND input.pageName IN ['LeagueStandingsPage', 'AdminPage', 'BattleHistoryPage',
                            'FinancialReportPage', 'HallOfRecordsPage', 'DashboardPage',
                            'TournamentDetailPage', 'WeaponShopPage']
     AND elementOverflowsOrCollides(input.elementType)
  THEN RETURN true

  // Touch target bugs (defects 1.10, 1.14)
  IF input.viewportWidth < 768
     AND input.elementType IN ['table-button', 'table-link', 'select', 'form-input', 'form-button']
     AND touchTargetSize(input.elementType) < 44
  THEN RETURN true

  // Design token bug (defect 1.11)
  IF usesHardcodedGrayColor(input.pageName, input.elementType)
  THEN RETURN true

  RETURN false
END FUNCTION
```

### Examples

- **Breakpoint dead zone**: At 900px viewport, `useIsMobile()` returns `false` (desktop mode) but Navigation renders mobile bottom tab bar — page content assumes full width while nav is in mobile form
- **Table overflow**: LeagueStandingsPage at 375px renders 8-column table at full width, causing horizontal page scroll with no scroll affordance on the table container
- **Header collision**: DashboardPage at 375px renders "Command Center" title and stable name in `flex justify-between` on one line, text overlaps
- **Admin tabs overflow**: AdminPage at 375px renders 7 tabs in a single horizontal row that extends beyond viewport with no scroll indicator
- **Touch targets**: AdminPage battle log action buttons render at ~32px height, below 44px WCAG minimum
- **Hardcoded colors**: FinancialReportPage uses `bg-gray-900`, `bg-gray-800`, `text-gray-400` instead of `bg-background`, `bg-surface`, `text-secondary`
- **Form inputs**: CreateRobotPage input field has `py-3` (~40px height) which is below the 44px touch target minimum on mobile

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Desktop navigation (≥1024px) continues to display top nav bar with dropdowns, logo, currency, logout
- All page layouts at ≥1024px render with current desktop grid layouts, table formats, and spacing
- Mobile bottom tab bar (Dashboard, Robots, Battles, Shop, More) and hamburger drawer continue to work below 1024px
- All data fetching, filtering, sorting, pagination, navigation, and form submission work identically at all viewport widths
- Table sorting, row highlighting, pagination controls, and action buttons function as today on desktop
- AdminPage controls (cycle controls, bulk operations, battle logs, robot stats) function and display identically on desktop

**Scope:**
All inputs at viewport widths ≥1024px should be completely unaffected by this fix. The visual appearance after design token replacement should match the intended dark theme aesthetic since token values are close equivalents to the hardcoded grays.

## Hypothesized Root Cause

Based on the bug analysis and code review, the root causes are:

1. **Breakpoint Mismatch**: Two separate `useIsMobile` hooks exist — one in `useIsMobile.ts` (breakpoint at 768px using `window.innerWidth`) and one in `useMediaQuery.ts` (breakpoint at `max-width: 768px`). Navigation uses Tailwind's `lg:` prefix (1024px). Components using either hook get `isMobile=false` between 768–1024px while Navigation renders mobile layout, creating a dead zone.

2. **Missing Responsive Tailwind Classes**: Pages were built desktop-first without mobile breakpoint classes. Tables lack `overflow-x-auto` wrappers, headers use `flex justify-between` without `flex-col` stacking at small widths, grids don't collapse to fewer columns, and filter bars don't stack vertically.

3. **Hardcoded Color Values**: Older pages (FinancialReportPage, TournamentDetailPage, CreateRobotPage, LeagueStandingsPage, HallOfRecordsPage, AdminPage) were written before or without awareness of the design token system, using raw Tailwind gray classes (`bg-gray-900`, `bg-gray-800`, `text-gray-400`, `bg-gray-700`) instead of semantic tokens (`bg-background`, `bg-surface`, `text-secondary`, `bg-surface-elevated`).

4. **Insufficient Touch Target Sizing**: Table cells use desktop-oriented padding (`p-3`, `p-4`) and text sizing (`text-sm`) without mobile density adjustments. Form inputs and buttons lack explicit minimum height constraints for touch interaction.

## Correctness Properties

Property 1: Bug Condition - Breakpoint Alignment

_For any_ viewport width below 1024px, the `useIsMobile` hook(s) SHALL return `true`, aligning with the Navigation component's `lg:` breakpoint so that all components agree on whether to render mobile or desktop layout.

**Validates: Requirements 2.1, 2.12**

Property 2: Bug Condition - Mobile Layout Adaptation

_For any_ page rendered at a viewport width below 768px, all layout elements (tables, grids, headers, filter bars, forms, cards) SHALL either fit within the viewport width without horizontal page overflow, or be contained within a scrollable container with visual scroll affordance.

**Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.13**

Property 3: Bug Condition - Touch Target Compliance

_For any_ interactive element (button, link, select, input) rendered at a viewport width below 768px, the element SHALL have a minimum touch target size of 44x44px.

**Validates: Requirements 2.10, 2.14**

Property 4: Bug Condition - Design Token Consistency

_For any_ page at any viewport width, the page SHALL use Tailwind design tokens (`bg-background`, `bg-surface`, `bg-surface-elevated`, `text-secondary`, `text-tertiary`) instead of hardcoded gray color values (`bg-gray-900`, `bg-gray-800`, `bg-gray-700`, `text-gray-400`, `text-gray-500`).

**Validates: Requirements 2.11**

Property 5: Preservation - Desktop Layout Unchanged

_For any_ viewport width ≥1024px, all page layouts, navigation, tables, grids, and interactive elements SHALL render identically to the original (unfixed) code, preserving all existing desktop behavior and visual appearance.

**Validates: Requirements 3.1, 3.2, 3.3, 3.5, 3.6**

Property 6: Preservation - Functionality Unchanged

_For any_ user interaction (data fetching, filtering, sorting, pagination, navigation, form submission) at any viewport width, the behavior SHALL be identical to the original code.

**Validates: Requirements 3.4, 3.7**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**1. Breakpoint Alignment**

**File**: `prototype/frontend/src/hooks/useIsMobile.ts`
- Change `MOBILE_BREAKPOINT` from `768` to `1024` so the hook aligns with Navigation's `lg:` breakpoint

**File**: `prototype/frontend/src/hooks/useMediaQuery.ts`
- Change the convenience `useIsMobile()` function from `max-width: 768px` to `max-width: 1023px` to align with Tailwind's `lg:` breakpoint (1024px and above is desktop)

**2. LeagueStandingsPage Mobile Layout (Defect 1.2)**

**File**: `prototype/frontend/src/pages/LeagueStandingsPage.tsx`
- Wrap table in `overflow-x-auto` container (already has one — verify scroll affordance)
- Add mobile-friendly column hiding or card layout for key stats below `lg:`
- Replace hardcoded gray colors with design tokens

**3. AdminPage Tab Navigation & Stats Grid (Defect 1.3)**

**File**: `prototype/frontend/src/pages/AdminPage.tsx`
- Make tab navigation horizontally scrollable with `overflow-x-auto` and `flex-nowrap`
- Adjust stats grid to use `grid-cols-2` on small screens
- Replace hardcoded gray colors with design tokens

**4. AdminPage Battle Logs (Defect 1.4)**

**File**: `prototype/frontend/src/pages/AdminPage.tsx`
- Wrap battle table in `overflow-x-auto` container
- Stack search/filter controls vertically on mobile with `flex-col lg:flex-row`
- Ensure filter inputs are full-width on mobile

**5. BattleHistoryPage Filter Controls (Defect 1.5)**

**File**: `prototype/frontend/src/pages/BattleHistoryPage.tsx`
- Change filter bar to `flex flex-col lg:flex-row` for mobile stacking
- Make each control full-width on mobile
- Add `min-h-[44px]` to all interactive controls

**6. FinancialReportPage Header & Layout (Defect 1.6)**

**File**: `prototype/frontend/src/pages/FinancialReportPage.tsx`
- Change header from `flex justify-between` to `flex flex-col lg:flex-row lg:justify-between`
- Change Financial Health section from side-by-side to `flex flex-col lg:flex-row`
- Replace all hardcoded gray/blue colors with design tokens

**7. HallOfRecordsPage Grid (Defect 1.7)**

**File**: `prototype/frontend/src/pages/HallOfRecordsPage.tsx`
- Ensure record sections use single-column layout on mobile
- Replace hardcoded gray colors with design tokens

**8. DashboardPage Header (Defect 1.8)**

**File**: `prototype/frontend/src/pages/DashboardPage.tsx`
- Change header from `flex items-center justify-between` to `flex flex-col lg:flex-row lg:items-center lg:justify-between`
- Replace `border-gray-700` and `text-gray-400` with design tokens

**9. TournamentDetailPage Bracket (Defect 1.9)**

**File**: `prototype/frontend/src/pages/TournamentDetailPage.tsx`
- BracketView already has mobile/desktop split via `useIsMobile` from `useMediaQuery.ts` — fixing the breakpoint in step 1 will resolve the dead zone
- Replace hardcoded gray colors with design tokens throughout the page

**10. Touch Target Sizing (Defects 1.10, 1.14)**

**Files**: Multiple pages with tables and forms
- Add `min-h-[44px]` to all table action buttons, links, and select dropdowns on mobile
- Add `min-h-[44px]` to form inputs and buttons on ProfilePage, CreateRobotPage, OnboardingPage
- Use responsive padding: `p-2 lg:p-3` or `p-2 lg:p-4` for table cells on mobile

**11. Design Token Replacement (Defect 1.11)**

**Files**: All pages using hardcoded grays
- `bg-gray-900` → `bg-background`
- `bg-gray-800` → `bg-surface`
- `bg-gray-700` → `bg-surface-elevated`
- `text-gray-400` → `text-secondary`
- `text-gray-500` → `text-tertiary`
- `text-gray-300` → `text-secondary` or `text-primary-light` (context-dependent)
- `border-gray-700` → `border-white/10` (matching Navigation pattern)
- `bg-blue-600`/`bg-blue-500` → `bg-primary`/`bg-primary-dark`
- `text-blue-500`/`text-blue-400` → `text-primary`
- `text-green-400` → `text-success`
- `text-red-400` → `text-error`
- `text-yellow-400` → `text-warning`

**12. WeaponShopPage Cards (Defect 1.13)**

**File**: `prototype/frontend/src/pages/WeaponShopPage.tsx`
- Ensure weapon card grid uses `grid-cols-1 lg:grid-cols-2 xl:grid-cols-3` for mobile single-column
- Add adequate spacing and touch-friendly interaction areas

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bugs on unfixed code, then verify the fixes work correctly and preserve existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write unit tests that render components at various viewport widths and assert layout properties. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **Breakpoint Mismatch Test**: Render a component using `useIsMobile` at 900px viewport — assert hook returns `true` (will fail on unfixed code, returns `false`)
2. **Table Overflow Test**: Render LeagueStandingsPage at 375px — assert table container has `overflow-x: auto` (will fail on unfixed code)
3. **Header Collision Test**: Render DashboardPage at 375px — assert header elements stack vertically (will fail on unfixed code)
4. **Touch Target Test**: Render AdminPage battle logs at 375px — assert action buttons have min-height ≥ 44px (will fail on unfixed code)
5. **Design Token Test**: Scan page component source for hardcoded gray class names (will fail on unfixed code)

**Expected Counterexamples**:
- `useIsMobile()` returns `false` at 900px while Navigation renders mobile layout
- Table containers lack `overflow-x-auto`, causing page-level horizontal scroll
- Headers render in single-row flex layout causing text overlap at narrow widths

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed components produce the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := renderComponent_fixed(input.pageName, input.viewportWidth)
  ASSERT expectedBehavior(result)
    // breakpoint: useIsMobile returns true below 1024px
    // layout: no horizontal overflow, elements stack appropriately
    // touch: all interactive elements >= 44x44px
    // tokens: no hardcoded gray classes in rendered output
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed components produce the same result as the original components.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT renderComponent_original(input) = renderComponent_fixed(input)
    // Desktop layouts (>=1024px) render identically
    // All functionality works the same at all viewport widths
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many viewport widths and page combinations automatically
- It catches edge cases at breakpoint boundaries that manual tests might miss
- It provides strong guarantees that desktop behavior is unchanged

**Test Plan**: Observe behavior on UNFIXED code first for desktop viewports and all interactions, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Desktop Layout Preservation**: Render each page at 1024px, 1280px, 1440px — verify layout matches original
2. **Navigation Preservation**: Verify desktop nav renders identically at ≥1024px after hook changes
3. **Functionality Preservation**: Verify filtering, sorting, pagination work identically after responsive class changes
4. **Visual Token Preservation**: Verify design token replacements produce visually equivalent colors (token values are near-equivalents to hardcoded grays)

### Unit Tests

- Test `useIsMobile` hook returns correct values at boundary widths (767, 768, 1023, 1024, 1025)
- Test responsive class application on key components at mobile and desktop widths
- Test that table containers have overflow-x-auto at mobile widths
- Test that headers stack vertically at mobile widths
- Test touch target minimum heights on interactive elements

### Property-Based Tests

- Generate random viewport widths (320–1920) and verify `useIsMobile` returns `true` iff width < 1024
- Generate random viewport widths ≥1024 and verify desktop layouts render without changes from original
- Scan component source files for hardcoded gray class patterns and assert none remain

### Integration Tests

- Test full page render at 375px (iPhone SE), 768px (iPad), 1024px (breakpoint boundary), 1440px (desktop) using Playwright
- Test navigation between pages at mobile viewport — verify no layout shifts or overflow
- Test form submission flows on mobile viewport — verify touch targets and input sizing
- Test table interactions (sort, paginate, filter) at mobile viewport — verify functionality preserved
