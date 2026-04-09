# Implementation Plan: Frontend State Management

## Overview

Install Zustand, create robot and stable stores, migrate the highest-traffic pages to use them, and integrate store cleanup with the auth logout flow. Existing Auth and Onboarding contexts remain untouched.

## Tasks

- [x] 1. Install Zustand and create store infrastructure
  - [x] 1.1 Install `zustand` as a production dependency in `app/frontend/`
  - [x] 1.2 Create `src/stores/` directory with `index.ts` barrel file
  - [x] 1.3 Verify Zustand is compatible with React 19 (run build)
  - [x] 1.4 Verify existing Auth and Onboarding contexts are untouched (no changes to `src/contexts/`)
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Create Robot Store
  - [x] 2.1 Create `src/stores/robotStore.ts` with state (robots, loading, error) and actions (fetchRobots, clear)
  - [x] 2.2 Write unit tests for robotStore: initial state, fetchRobots success, fetchRobots error, clear
  - [x] 2.3 Integrate store clear with AuthContext logout — call `useRobotStore.getState().clear()` on logout
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 3. Migrate pages to Robot Store
  - [x] 3.1 Migrate the robot list page to read from `useRobotStore` instead of calling `fetchMyRobots()` directly
  - [x] 3.2 Migrate the dashboard page's robot section to read from `useRobotStore`
  - [x] 3.3 Migrate any other pages that call `fetchMyRobots()` to use the store
  - [x] 3.4 Run frontend test suite to verify no regressions
  - _Requirements: 2.5_

- [x] 4. Create Stable Store
  - [x] 4.1 Create `src/stores/stableStore.ts` with state (currency, prestige, stats, financialSummary, loading, error) and actions (fetchStableData, refreshCurrency, clear)
  - [x] 4.2 Write unit tests for stableStore: initial state, fetchStableData success/error, refreshCurrency, clear
  - [x] 4.3 Integrate store clear with AuthContext logout
  - _Requirements: 3.1, 3.2, 3.4_

- [x] 5. Migrate pages to Stable Store
  - [x] 5.1 Migrate the dashboard page's financial section to read from `useStableStore`
  - [x] 5.2 Migrate the income/finances page to read from `useStableStore`
  - [x] 5.3 Migrate the facilities page to read currency from `useStableStore` and call `refreshCurrency()` after purchases
  - [x] 5.4 Run frontend test suite to verify no regressions
  - _Requirements: 3.3_

- [x] 6. Documentation and final verification
  - [x] 6.1 Create state management guidelines in `.kiro/steering/frontend-state-management.md` specifying when to use Zustand stores vs. local state vs. Context, with the 3-criteria rule (3+ pages, cross-page mutations, expensive fetches)
  - [x] 6.2 Update `.kiro/steering/frontend-standards.md` State Management section to reference Zustand stores alongside the existing Context pattern, and add the store selector pattern as a best practice
  - [x] 6.3 Update `.kiro/steering/project-overview.md` Frontend section to change "State Management: React Context + hooks" to "State Management: Zustand + React Context + hooks"
  - [x] 6.4 Run full frontend test suite
  - [x] 6.5 Verify no visual regressions on affected pages
  - [x] 6.6 Run verification criteria checks: confirm zero direct `fetchMyRobots()` calls in pages/components, both stores exist with required actions, logout clears stores, guideline document exists, zustand in package.json
  - _Requirements: 4.1, 4.2, 4.3_

## Notes

- Auth and Onboarding contexts are NOT migrated — they stay as React Context
- The robot store is the pilot — if the pattern works well, additional stores can be added incrementally
- Zustand's `getState()` allows calling store actions outside of React components (e.g., in the logout function), which is cleaner than Context for this use case
- Store selectors (`useStore(s => s.robots)`) are critical for avoiding unnecessary re-renders — always use selectors, never subscribe to the entire store
