# Implementation Plan: Admin Security Dashboard

## Overview

Add a Security tab to the admin portal that consumes the existing backend security monitoring APIs (`GET /api/admin/security/events` and `GET /api/admin/security/summary`). The implementation follows the established admin tab decomposition pattern. No backend changes required.

## Tasks

- [x] 1. Add shared types and register the Security tab in the admin shell
  - [x] 1.1 Add `SecurityEvent`, `SecuritySummary`, and `SecurityEventsResponse` interfaces to `app/frontend/src/components/admin/types.ts`
    - _Requirements: 2.1, 3.1_
  - [x] 1.2 Add `'security'` to the `TabType` union, `VALID_TABS` array, and `TAB_LABELS` record (with `'🛡️ Security'` label) in `app/frontend/src/pages/AdminPage.tsx`
    - _Requirements: 1.1, 1.3, 1.4_
  - [x] 1.3 Create `app/frontend/src/components/admin/SecurityTab.tsx` as a skeleton component that renders a `data-testid="security-tab"` wrapper div with the heading "Security" and a "Loading security data..." placeholder
    - _Requirements: 1.2, 6.1_
  - [x] 1.4 Export `SecurityTab` from the barrel file `app/frontend/src/components/admin/index.ts`
    - _Requirements: 1.2_
  - [x] 1.5 Import `SecurityTab` in `AdminPage.tsx` and render it in the tab panel when `activeTab === 'security'`
    - _Requirements: 1.2, 1.3_

- [x] 2. Implement the Security tab component with summary panel, events table, and filtering
  - [x] 2.1 Implement the summary panel section in `SecurityTab.tsx`: fetch from `GET /api/admin/security/summary` on mount, display severity count cards (info in blue, warning in amber, critical in red using design system colors), total events, active alerts count, and a refresh button
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [x] 2.2 Implement the flagged users display in the summary panel: render flagged user IDs as clickable badge buttons; on click, set the user ID filter and re-fetch events; show "No flagged users" in muted text when the array is empty
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 2.3 Implement the filter bar: severity dropdown (All/Info/Warning/Critical), event type dropdown (populated from distinct event types in current data), user ID text input (numeric only, applied on Enter/blur), and a "Clear Filters" button that resets all filters and re-fetches
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [x] 2.4 Implement the events table: fetch from `GET /api/admin/security/events` with filter query params, display columns (timestamp as relative time with absolute on hover, severity as color-coded badge, event type, user ID, source IP, endpoint), newest first
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 2.5 Implement event row expansion: clicking a row toggles an inline detail section showing the `details` object as formatted key-value pairs in a `bg-surface` panel
    - _Requirements: 3.4_
  - [x] 2.6 Implement zero states: "No security events recorded" with info icon when events array is empty; all summary counts as 0 when summary returns zero events
    - _Requirements: 3.5, 2.4_
  - [x] 2.7 Implement error handling: display error message with "Retry" button on API failure; wrap response parsing in try-catch to fall back to zero-state on unexpected shapes
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 3. Write component tests
  - [x] 3.1 Create `app/frontend/src/components/admin/__tests__/SecurityTab.test.tsx` following the existing admin tab test pattern (mock `apiClient`, render component, assert DOM)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  - [x] 3.2 Test cases to implement:
    - Loading state: mock pending promise, verify "Loading security data..." text renders
    - Summary panel: mock summary response, verify severity counts (info/warning/critical), total events, and active alerts display correctly
    - Events table: mock events response, verify rows render with correct severity badges, event types, and timestamps
    - Zero state: mock empty events and summary responses, verify "No security events recorded" message
    - Severity filter: simulate dropdown change, verify `apiClient.get` called with `?severity=warning` query param
    - Flagged user badge click: mock summary with flagged user IDs, simulate click on a badge, verify user ID filter is set and events re-fetched
    - Error state: mock rejected promise, verify error message and "Retry" button render
    - Event row expansion: simulate row click, verify details section appears
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [x] 4. Documentation updates
  - [x] 4.1 Update `docs/prd_pages/PRD_ADMIN_PAGE.md`: add a section for the Security tab as the 9th tab, documenting its features (summary panel with severity counts, events table with filtering, flagged users display), data sources (`GET /api/admin/security/events`, `GET /api/admin/security/summary`), and component location (`SecurityTab.tsx` in `components/admin/`)
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1_

- [x] 5. Verification
  - [x] 5.1 Run the frontend test suite (`npm test` in `app/frontend`) and confirm all tests pass including the new SecurityTab tests
  - [x] 5.2 Run verification checks from the requirements:
    - `grep -r "SecurityTab" app/frontend/src/components/admin/ | wc -l` — returns 14 (≥ 2 ✅)
    - `grep "'security'" app/frontend/src/pages/AdminPage.tsx | wc -l` — returns 4 (≥ 1 ✅)
    - `ls app/frontend/src/components/admin/__tests__/SecurityTab.test.tsx` — file exists ✅
    - `grep -r "security/events\|security/summary" app/frontend/src/components/admin/SecurityTab.tsx | wc -l` — returns 3 (≥ 2 ✅)
  - [x] 5.3 Run `npx tsc --noEmit` in `app/frontend` to confirm no TypeScript errors ✅
