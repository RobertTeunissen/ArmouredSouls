# Implementation Plan: Admin Portal Redesign

## Overview

Transform the admin portal from a monolithic single-page component (`AdminPage.tsx` with 12 horizontal tabs) into a dedicated admin experience with sidebar navigation, route-based lazy-loaded pages, a Zustand-based shared state layer, comprehensive security hardening, 6 new analytics pages, and a server-side admin audit trail. Implementation proceeds bottom-up: backend hardening and data layer first, then shared frontend foundation (layout, store, UI components), then page migrations, then new pages, then legacy cleanup, and finally documentation updates.

## Tasks

- [x] 1. Backend security hardening and data layer
  - [x] 1.1 Add `AdminAuditLog` model and `lastLoginAt` column to Prisma schema
    - Add the `AdminAuditLog` model to `app/backend/prisma/schema.prisma` with fields: `id`, `adminUserId`, `operationType`, `operationResult`, `resultSummary` (Json), `createdAt`, and indexes on `adminUserId`, `operationType`, `createdAt`
    - Add `lastLoginAt DateTime? @map("last_login_at")` to the `User` model
    - Generate and run the Prisma migration
    - Run `npx prisma generate` to regenerate the client
    - _Requirements: 13.6, 19.2_

  - [x] 1.2 Enhance `authenticateToken` middleware with DB-verified role
    - In `app/backend/src/middleware/auth.ts`, add `role` to the `select` clause of the existing user query (alongside `tokenVersion` and `stableName`)
    - Change `req.user.role` assignment from `decoded.role` (JWT) to `user.role` (DB)
    - _Requirements: 27.1_

  - [x] 1.3 Write property test for DB role precedence (Property 9)
    - Create `app/backend/src/middleware/__tests__/authenticateToken.property.test.ts`
    - **Property 9: DB role takes precedence over JWT role**
    - Generate random JWT role + different DB role combinations; verify `req.user.role === DB role`
    - **Validates: Requirements 27.1**

  - [x] 1.4 Add dedicated admin rate limiter to `requireAdmin` middleware
    - Create an `express-rate-limit` instance with `windowMs: 60_000`, `max: 120`, `keyGenerator` using `admin:${userId}`, and a handler that calls `securityMonitor.trackRateLimitViolation()` and returns 429 with `ADMIN_RATE_LIMIT_EXCEEDED`
    - Apply the rate limiter inside `requireAdmin` after the role check passes
    - _Requirements: 27.2_

  - [x] 1.5 Add admin access logging to `requireAdmin` middleware
    - After the role check passes (before `next()`), call `securityMonitor.recordEvent()` with severity `INFO`, eventType `admin_access`, userId, endpoint, sourceIp, and method
    - _Requirements: 27.3_

  - [x] 1.6 Write unit tests for enhanced auth middleware
    - In `app/backend/src/middleware/__tests__/auth.test.ts`, add tests for: DB role used instead of JWT role, role change takes effect immediately, admin rate limiter applied, access logged on success, violations tracked on rate limit exceed
    - _Requirements: 27.1, 27.2, 27.3_

  - [x] 1.7 Implement `AdminAuditLogService`
    - Create `app/backend/src/services/admin/adminAuditLogService.ts` with `recordAction()` and `getEntries()` methods
    - `recordAction` writes to the `AdminAuditLog` table with fire-and-forget error handling (log error, don't fail the operation)
    - `getEntries` supports pagination, filtering by `operationType` and date range
    - _Requirements: 19.1, 19.2_

  - [x] 1.8 Implement `buildUserFilter` utility
    - Create `app/backend/src/utils/buildUserFilter.ts` with the `buildUserFilter(filter: 'all' | 'real' | 'auto')` function returning `Prisma.UserWhereInput`
    - Handle all prefix patterns: `auto_wimpbot_`, `auto_averagebot_`, `auto_expertbot_` for auto; additionally `test_user_`, `archetype_`, `attr_`, `bye_robot_user` excluded from real
    - _Requirements: 5.3_

  - [x] 1.9 Write property test for user filter classification (Property 6)
    - Create `app/backend/src/utils/__tests__/buildUserFilter.property.test.ts`
    - **Property 6: User filter classification correctness**
    - Generate random usernames (including auto_*, test_user_*, archetype_*, normal names); verify correct inclusion/exclusion per filter type
    - **Validates: Requirements 5.3**

  - [x] 1.10 Write unit tests for `buildUserFilter` and `AdminAuditLogService`
    - Create `app/backend/src/utils/__tests__/buildUserFilter.test.ts` — test all prefix patterns, edge cases (empty string, partial matches)
    - Create `app/backend/src/services/admin/__tests__/adminAuditLogService.test.ts` — test record action, query with filters, pagination
    - _Requirements: 5.3, 19.1, 19.2_

  - [x] 1.11 Update login route to set `lastLoginAt`
    - In the login route handler, after successful authentication, add `await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })` with error handling that logs but doesn't fail the login
    - _Requirements: 13.6_

- [x] 2. New backend API endpoints
  - [x] 2.1 Implement `GET /api/admin/dashboard/kpis` endpoint
    - Return KPI data: inactive real players (3+ days), battles today, scheduled matches, current cycle, cycle status, with trend indicators comparing to previous cycle
    - Use `buildUserFilter` for the real/auto/all filter query parameter
    - Add Zod schema validation with `validateRequest` middleware
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 2.2 Implement `GET /api/admin/engagement/players` endpoint
    - Return player list with `lastLoginAt`, `daysSinceLogin`, `churnRisk` classification, and activity indicators (checked matches, invested facilities, bought weapons, upgraded attributes)
    - Support pagination, sorting, and the real/auto/all user filter
    - Add Zod schema validation
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [x] 2.3 Implement `GET /api/admin/economy/overview` endpoint
    - Return total credits in circulation, inflation rate (change between cycles), average player income vs costs, weapon purchase trends
    - Derive data from `CycleSnapshot` records and current system stats
    - Add Zod schema validation
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

  - [x] 2.4 Implement `GET /api/admin/league-health` endpoint
    - Return robots per tier, ELO distribution within each tier, promotion/demotion rates, empty/overcrowded league identification for both 1v1 and tag team leagues
    - Include count of robots/teams currently eligible for promotion and demotion
    - Add Zod schema validation
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [x] 2.5 Implement `GET /api/admin/weapons/analytics` endpoint
    - Return all weapons with purchase count, equip count, equip rate, never-purchased flags, high-purchase-low-equip flags, price-to-performance outliers
    - Support the real/auto/all user filter
    - Add Zod schema validation
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

  - [x] 2.6 Implement `GET /api/admin/achievements/analytics` endpoint
    - Return unlock rates per achievement, difficulty flags (0% = too hard, >90% = too easy), rarity distribution accuracy
    - Support the real/auto/all user filter
    - Add Zod schema validation
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

  - [x] 2.7 Implement `GET /api/admin/tuning/adoption` endpoint
    - Return aggregate adoption stats (total robots with tuning, percentage eligible, average pool utilization), per-player summary, filters for zero/full adoption
    - Add Zod schema validation
    - _Requirements: 18.1, 18.2, 18.3, 18.4_

  - [x] 2.8 Implement `GET /api/admin/audit-log` and `POST /api/admin/audit-log` endpoints
    - GET: paginated, filterable list of audit entries sorted by timestamp descending, with operation type and date range filters
    - POST: record an admin action (called internally by route handlers)
    - Add Zod schema validation for both
    - _Requirements: 19.3, 19.4, 19.5_

  - [x] 2.9 Extend `GET /api/admin/users/search` to support robot name search
    - Add robot name search capability to the existing user search endpoint
    - Add Zod schema validation if not already present
    - _Requirements: 9.2_

  - [x] 2.10 Integrate audit trail recording into existing admin cycle operation routes
    - Add `AdminAuditLogService.recordAction()` calls to matchmaking, battles, rebalancing, repair, finances, bulk cycles, KotH, and tournament execution route handlers
    - Use fire-and-forget pattern (don't fail the operation if audit write fails)
    - _Requirements: 19.1, 19.6_

  - [x] 2.11 Write integration tests for new API endpoints
    - Create `app/backend/src/routes/__tests__/admin.integration.test.ts`
    - Test all 10 new endpoints: dashboard KPIs, engagement, economy, league health, weapons, achievements, tuning, audit-log GET/POST, users/search with robot name
    - Verify Zod validation rejects invalid inputs, verify correct response shapes
    - _Requirements: 5.1, 9.2, 13.1, 14.1, 15.1, 16.1, 17.1, 18.1, 19.3_

- [x] 3. Checkpoint — Backend complete
  - Ensure all backend tests pass (`npm test` in `app/backend`), ask the user if questions arise.

- [x] 4. Frontend foundation — AdminRoute guard, AdminLayout, and useAdminStore
  - [x] 4.1 Create the `AdminRoute` guard component
    - Create `app/frontend/src/components/admin/AdminRoute.tsx`
    - Check `useAuth()`: loading → spinner, `!user` → redirect `/login`, `user.role !== 'admin'` → redirect `/dashboard`, otherwise render children
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 4.2 Write property tests for AdminRoute guard (Properties 1, 2, 7, 8)
    - Create `app/frontend/src/components/admin/__tests__/AdminRoute.property.test.tsx`
    - **Property 1: Admin guard rejects non-admin users** — generate random non-admin roles, verify redirect to `/dashboard`
    - **Property 2: Admin guard rejects unauthenticated users** — generate random admin route paths, verify redirect to `/login` when user is null
    - **Property 7: Invalid admin route fallback** — generate random strings not in valid route set, verify redirect to `/admin/dashboard`
    - **Property 8: Deep link routing correctness** — generate valid route paths from defined set, verify correct page component renders
    - **Validates: Requirements 3.1, 3.2, 3.3, 2.6, 2.4**

  - [x] 4.3 Write unit tests for AdminRoute guard
    - Create `app/frontend/src/components/admin/__tests__/AdminRoute.test.tsx`
    - Test loading state shows spinner, admin user renders children, non-admin redirects to `/dashboard`, unauthenticated redirects to `/login`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 4.4 Create the `AdminLayout` component with sidebar navigation
    - Create `app/frontend/src/components/admin/AdminLayout.tsx`
    - Render persistent sidebar (left) with grouped navigation links: Overview, Game Operations, Battle Data, Player Management, Security & Moderation, Content, Maintenance
    - Render header bar (top of content area) with page title and "← Back to Game" link to `/dashboard`
    - Render content area (right) with `<Suspense>` boundary and loading fallback
    - Wrap content area in a React error boundary with "Something went wrong" fallback and "Go to Dashboard" button
    - Sidebar collapses to icon-only below 768px viewport width
    - Highlight active route using `useLocation()`
    - Do NOT render the player-facing `Navigation` component
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.7_

  - [x] 4.5 Write unit tests for AdminLayout
    - Create `app/frontend/src/components/admin/__tests__/AdminLayout.test.tsx`
    - Test sidebar renders all 7 navigation sections, header renders page title and back link, active route is highlighted, responsive collapse at 768px
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 1.7_

  - [x] 4.6 Create the `useAdminStore` Zustand store
    - Create `app/frontend/src/stores/adminStore.ts`
    - Implement state: `systemStats`, `statsLastFetched`, `statsLoading`, `schedulerStatus`, `schedulerLastFetched`, `securitySummary`, `securityLastFetched`, `sessionLog`, `ttlMs` (default 60000)
    - Implement actions: `fetchStats(force?)`, `fetchSchedulerStatus(force?)`, `fetchSecuritySummary(force?)`, `addSessionLog()`, `clearSessionLog()`, `exportSessionLog()`, `clearCache()`, `clear()`
    - TTL logic: check `Date.now() - lastFetched < ttlMs`, return cached if within TTL unless `force` is true
    - Persist session log to localStorage as fallback
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x] 4.7 Write property tests for useAdminStore (Properties 3, 4)
    - Create `app/frontend/src/stores/__tests__/adminStore.property.test.ts`
    - **Property 3: TTL cache correctness** — generate random TTL values and elapsed times, verify cached data returned iff elapsed < TTL
    - **Property 4: Session log round-trip persistence** — generate random log entries, verify entry in both store state and localStorage
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

  - [x] 4.8 Write unit tests for useAdminStore
    - Create `app/frontend/src/stores/__tests__/adminStore.test.ts`
    - Test fetchStats, clearCache, clear, sessionLog CRUD, TTL expiry, force refresh
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x] 4.9 Create the trend indicator utility function
    - Create `app/frontend/src/utils/trendIndicator.ts` with a function that returns `'up'`, `'down'`, or `'neutral'` given current and previous values
    - _Requirements: 5.2_

  - [x] 4.10 Write property test for trend indicator (Property 5)
    - Create `app/frontend/src/utils/__tests__/trendIndicator.property.test.ts`
    - **Property 5: Trend indicator correctness** — generate random pairs of numbers, verify correct `'up'`/`'down'`/`'neutral'`
    - **Validates: Requirements 5.2**

  - [x] 4.11 Configure admin route registration in `App.tsx`
    - Add nested routes under `/admin/*` wrapped in `AdminRoute` and `AdminLayout`
    - Use `React.lazy()` for all admin page imports
    - Redirect `/admin` to `/admin/dashboard`
    - Redirect invalid admin sub-routes to `/admin/dashboard`
    - Conditionally register admin routes only when authenticated user has `admin` role
    - Remove the old single `/admin` route pointing to monolithic `AdminPage`
    - Remove the separate `/admin/onboarding-analytics` route
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 23.4, 23.5, 27.4, 27.5_

  - [x] 4.12 Write property test for non-admin route exclusion (Property 10)
    - Create `app/frontend/src/components/admin/__tests__/AdminRoutes.property.test.tsx`
    - **Property 10: Non-admin users have no admin routes registered** — generate random non-admin user objects, verify no `/admin/*` routes in router config
    - **Validates: Requirements 27.5**

- [x] 5. Shared admin UI component library
  - [x] 5.1 Create `AdminStatCard` component
    - Create `app/frontend/src/components/admin/shared/AdminStatCard.tsx`
    - Render metric value, label, optional trend indicator (up/down/neutral), optional color accent, optional icon
    - Follow design system color palette
    - _Requirements: 26.1, 26.7_

  - [x] 5.2 Create `AdminDataTable` component
    - Create `app/frontend/src/components/admin/shared/AdminDataTable.tsx`
    - Render sortable, paginated table with `bg-surface-elevated` headers, `hover:bg-white/5` row hover, optional row click handler, loading state, empty message
    - _Requirements: 26.2, 26.7_

  - [x] 5.3 Create `AdminFilterBar` component
    - Create `app/frontend/src/components/admin/shared/AdminFilterBar.tsx`
    - Render horizontal filter chips with `bg-primary` active / `bg-surface-elevated` inactive states, clear all button, children slot for additional controls
    - _Requirements: 26.3, 26.7_

  - [x] 5.4 Create `AdminPageHeader` component
    - Create `app/frontend/src/components/admin/shared/AdminPageHeader.tsx`
    - Render page title, optional subtitle, optional action buttons
    - _Requirements: 26.4, 26.7_

  - [x] 5.5 Create `AdminSlideOver` component
    - Create `app/frontend/src/components/admin/shared/AdminSlideOver.tsx`
    - Render right-side slide-over panel with open/close, width variants (md/lg/xl), overlay click to close
    - _Requirements: 26.5, 26.7_

  - [x] 5.6 Create `AdminEmptyState` component
    - Create `app/frontend/src/components/admin/shared/AdminEmptyState.tsx`
    - Render centered message with icon, title, optional description, optional action button
    - _Requirements: 26.6, 26.7_

  - [x] 5.7 Create barrel export file for shared admin UI components
    - Create `app/frontend/src/components/admin/shared/index.ts` exporting all 6 components
    - _Requirements: 26.8_

  - [x] 5.8 Write unit tests for all shared admin UI components
    - Create test files in `app/frontend/src/components/admin/shared/__tests__/`:
      - `AdminStatCard.test.tsx` — all prop combinations, trend indicators, color accents
      - `AdminDataTable.test.tsx` — sorting, pagination, empty state, row click, column rendering
      - `AdminFilterBar.test.tsx` — filter toggle, clear all, active/inactive states
      - `AdminSlideOver.test.tsx` — open/close, width variants, overlay click
      - `AdminEmptyState.test.tsx` — icon, title, description, action button
    - _Requirements: 26.1, 26.2, 26.3, 26.5, 26.6_

- [x] 6. Checkpoint — Frontend foundation complete
  - Ensure all frontend tests pass (`npm test` in `app/frontend`), ask the user if questions arise.

- [x] 7. Page migrations — Existing tab components to standalone pages
  - [x] 7.1 Migrate `DashboardTab` → `DashboardPage` with overhaul
    - Create `app/frontend/src/pages/admin/DashboardPage.tsx`
    - Implement top row of KPI cards (Inactive Real Players 3+ days, Battles Today, Scheduled Matches, Current Cycle, Cycle Status) using `AdminStatCard` with trend indicators
    - Implement global real/auto/all filter toggle using `AdminFilterBar`
    - Implement battle statistics broken down by type (League, Tournament, Tag Team, KotH) with totals, draws, kills, kill %, avg duration, victory margin breakdown; omit draw counts for Tournament and KotH
    - Implement facility investment breakdown showing ALL facility types with purchase count, level distribution, and average passive income
    - Implement weapon economy metrics: total purchased, equipped, equip rate, breakdown by tier
    - Implement roster strategy breakdown: players with 1/2/3 robots, additional robot creation timeline
    - Implement stance, loadout, and yield threshold distributions as collapsible sections
    - Remove System Health and Practice Arena sections (promoted to own pages); remove Users at Risk (moved to Players page)
    - Use cached stats from `useAdminStore` with TTL
    - Use `AdminPageHeader` for page header
    - Fetch KPI data from `GET /api/admin/dashboard/kpis`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 25.1, 25.2, 25.3, 25.4_

  - [x] 7.2 Write unit tests for DashboardPage
    - Create `app/frontend/src/pages/admin/__tests__/DashboardPage.test.tsx`
    - Test KPI cards render with correct values, trend indicators display, battle type breakdowns render, facility breakdown shows all types, global filter toggles work
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 7.3 Migrate `CycleControlsTab` → `CycleControlsPage` with redesign
    - Create `app/frontend/src/pages/admin/CycleControlsPage.tsx`
    - Implement scheduler status panel showing: active state, current cycle, and for each of 5 cron jobs (League, Tournament, Tag Team, Settlement, KotH) their schedule, last run time/status/duration, next run
    - Implement "Production Jobs (Manual Trigger)" section with 5 manual trigger buttons matching cron job handlers
    - Implement confirmation dialogs using `ConfirmationModal` with `isDestructive` styling for each trigger
    - Implement Tournament Management section (creation, bracket viewing, active status, manual round execution) — absorbs separate Tournaments page
    - Implement "Bulk Cycle Testing" section with existing bulk runner functionality and clarification note
    - Implement Session Log as collapsible side panel, reading/writing via `useAdminStore`
    - Use `AdminPageHeader`, `AdminStatCard` for scheduler status cards
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 25.1, 25.2, 25.3, 25.4, 25.5_

  - [x] 7.4 Write unit tests for CycleControlsPage
    - Create `app/frontend/src/pages/admin/__tests__/CycleControlsPage.test.tsx`
    - Test scheduler status panel renders, production job buttons trigger confirmation, bulk runner section renders, session log panel toggles
    - _Requirements: 8.1, 8.2, 8.3, 8.5, 8.6, 8.7, 8.8_

  - [x] 7.5 Migrate to `CycleExplorerPage`
    - Create `app/frontend/src/pages/admin/CycleExplorerPage.tsx`
    - Implement cycle selector (dropdown/number input) loading snapshot data for any completed cycle
    - Implement summary banner: cycle number, trigger type, start/end time, duration, total battles, credits transacted, prestige awarded
    - Implement step duration breakdowns with visual bars, color-coded warnings for slow steps
    - Implement per-user stable metrics sortable table with real/auto filter
    - Implement per-robot metrics sortable table (name, owner, battles, wins, losses, ELO change, damage dealt/received, kills)
    - Implement cycle comparison view (last 14 cycles trend)
    - Absorb data integrity checks as collapsible "Data Integrity" panel
    - Absorb performance degradation detection as visual indicators on step duration bars
    - Use `AdminDataTable`, `AdminFilterBar`, `AdminPageHeader`, `AdminStatCard`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 25.1, 25.3, 25.4_

  - [x] 7.6 Write unit tests for CycleExplorerPage
    - Create `app/frontend/src/pages/admin/__tests__/CycleExplorerPage.test.tsx`
    - Test cycle selector loads data, summary banner renders, step durations display, stable/robot metrics tables render and sort
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 7.7 Migrate `PracticeArenaTab` → `PracticeArenaPage`
    - Create `app/frontend/src/pages/admin/PracticeArenaPage.tsx`
    - Display stats cards (battles today, unique players today, rate limit hits, total since start) using `AdminStatCard`
    - Display daily usage trend table using `AdminDataTable`
    - Retain all functionality from DashboardTab's collapsible Practice Arena section
    - Use `AdminPageHeader`
    - _Requirements: 7.1, 7.2, 7.3, 25.1, 25.2, 25.3, 25.4_

  - [x] 7.8 Migrate `BattleLogsTab` → `BattleLogsPage` with overhaul
    - Create `app/frontend/src/pages/admin/BattleLogsPage.tsx`
    - Implement filter chips for battle type (League, Tournament, Tag Team, KotH) using `AdminFilterBar`
    - Implement mini-stats summary bar: total battles, avg duration, draw %, kill %, victory margin breakdown
    - Implement per-battle-type breakdowns when no filter active
    - Implement battle detail view in `AdminSlideOver` matching player-facing battle report layout (result banner, statistics summary, damage flow diagram, combat log)
    - Add admin-only formula breakdowns: hit chance formula, damage calculation, critical hit/malfunction rolls with thresholds and actual values
    - Support all battle formats: 1v1, 2v2 tag team, KotH multi-robot, tournament
    - Include battle playback viewer when spatial data available
    - Use `AdminDataTable`, `AdminPageHeader`, `AdminStatCard`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 25.1, 25.2, 25.3, 25.4_

  - [x] 7.9 Write unit tests for BattleLogsPage
    - Create `app/frontend/src/pages/admin/__tests__/BattleLogsPage.test.tsx`
    - Test filter chips toggle, mini-stats render, battle detail view opens in slide-over, formula breakdowns display
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 7.10 Migrate `RobotStatsTab` → `RobotStatsPage` with improvements
    - Create `app/frontend/src/pages/admin/RobotStatsPage.tsx`
    - Display summary cards (total robots, robots with battles, overall win rate, average ELO) using `AdminStatCard`
    - Implement attribute explorer: select one attribute to view distribution stats (mean, median, std dev, quartiles) and outlier list
    - Display outlier alerts as notification-style list (robot name, attribute, value, league)
    - Use `AdminPageHeader`, `AdminDataTable`
    - _Requirements: 11.1, 11.2, 11.3, 25.1, 25.2, 25.3, 25.4_

  - [x] 7.11 Migrate to unified `PlayersPage` (merge RecentUsersTab + BankruptcyMonitorTab + PasswordResetTab)
    - Create `app/frontend/src/pages/admin/PlayersPage.tsx`
    - Implement global search bar searching across username, stable name, and robot name
    - Implement tabbed sub-views: All Players, At-Risk (bankruptcy monitor), New Players (recent users + absorbed onboarding analytics)
    - Implement global real/auto/all filter toggle using `AdminFilterBar`
    - Implement player detail panel in `AdminSlideOver`: account info, balance history, robots (ELO, league, battle record, equipped weapons), facilities with type AND level and passive income, onboarding status, password reset action
    - Password reset calls `POST /api/admin/users/:id/reset-password` with existing validation and rate limiting
    - Use `AdminDataTable`, `AdminPageHeader`, `AdminStatCard`, `AdminEmptyState`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 25.1, 25.2, 25.3, 25.4, 25.5, 25.6_

  - [x] 7.12 Write unit tests for PlayersPage
    - Create `app/frontend/src/pages/admin/__tests__/PlayersPage.test.tsx`
    - Test search across username/stable/robot, sub-view tabs switch, detail panel opens in slide-over, password reset triggers API call, filter toggle works
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.8_

  - [x] 7.13 Migrate `SecurityTab` → `SecurityPage` with improvements
    - Create `app/frontend/src/pages/admin/SecurityPage.tsx`
    - Display prominent summary cards (total events, events by severity, active alerts, flagged user count) using `AdminStatCard`
    - Implement clickable flagged user links that navigate to Players page detail panel
    - Implement rate limit violations sub-section showing recent events grouped by endpoint
    - Use `AdminPageHeader`, `AdminDataTable`, `AdminFilterBar`
    - _Requirements: 12.1, 12.2, 12.3, 25.1, 25.2, 25.3, 25.4_

  - [x] 7.14 Write unit tests for SecurityPage
    - Create `app/frontend/src/pages/admin/__tests__/SecurityPage.test.tsx`
    - Test summary cards render, flagged user click navigates to players page, rate limit section displays
    - _Requirements: 12.1, 12.2, 12.3_

  - [x] 7.15 Migrate `ImageUploadsTab` → `ImageUploadsPage` with rejection reasons
    - Create `app/frontend/src/pages/admin/ImageUploadsPage.tsx`
    - Retain all current ImageUploadsTab functionality
    - Add display of rejection reasons for moderation-failed images: NSFW category and confidence score from AuditLog `image_upload_rejected` events
    - Use `AdminPageHeader`, `AdminDataTable`
    - _Requirements: 20.1, 20.2, 25.1, 25.2, 25.3, 25.4_

  - [x] 7.16 Migrate `AdminChangelogTab` → `ChangelogPage`
    - Create `app/frontend/src/pages/admin/ChangelogPage.tsx`
    - Retain all current AdminChangelogTab functionality
    - Use `AdminPageHeader`
    - _Requirements: 20.3, 25.1, 25.2, 25.3, 25.4_

  - [x] 7.17 Migrate `RepairLogTab` → `RepairLogPage`
    - Create `app/frontend/src/pages/admin/RepairLogPage.tsx`
    - Retain all current RepairLogTab functionality
    - Use `AdminPageHeader`, `AdminDataTable`, `AdminFilterBar`
    - _Requirements: 22.1, 25.1, 25.2, 25.3, 25.4_

- [x] 8. Checkpoint — Page migrations complete
  - Ensure all frontend tests pass (`npm test` in `app/frontend`), ask the user if questions arise.

- [x] 9. New analytics pages
  - [x] 9.1 Create `PlayerEngagementPage`
    - Create `app/frontend/src/pages/admin/PlayerEngagementPage.tsx`
    - Display login recency for each player (when they last logged in)
    - Display activity indicators: checking match outcomes, investing in facilities, buying weapons, upgrading attributes
    - Classify players into churn risk categories (low/medium/high/critical) based on login absence and declining activity
    - Provide sortable, filterable list ordered by churn risk severity
    - Use `AdminPageHeader`, `AdminDataTable`, `AdminFilterBar`, `AdminStatCard`
    - Fetch from `GET /api/admin/engagement/players`
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [x] 9.2 Write unit tests for PlayerEngagementPage
    - Create `app/frontend/src/pages/admin/__tests__/PlayerEngagementPage.test.tsx`
    - Test login recency displays, activity indicators render, churn risk classification shows, sorting and filtering work
    - _Requirements: 13.2, 13.3, 13.4, 13.5_

  - [x] 9.3 Create `EconomyOverviewPage`
    - Create `app/frontend/src/pages/admin/EconomyOverviewPage.tsx`
    - Display total credits in circulation, inflation/deflation rate, average player income vs costs, weapon purchase trends
    - Display trend charts when multi-cycle snapshot data available
    - Use `AdminPageHeader`, `AdminStatCard`, `AdminDataTable`
    - Fetch from `GET /api/admin/economy/overview`
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

  - [x] 9.4 Write unit tests for EconomyOverviewPage
    - Create `app/frontend/src/pages/admin/__tests__/EconomyOverviewPage.test.tsx`
    - Test credit circulation displays, inflation rate renders, trend data shows
    - _Requirements: 14.2, 14.3, 14.4_

  - [x] 9.5 Create `LeagueHealthPage`
    - Create `app/frontend/src/pages/admin/LeagueHealthPage.tsx`
    - Display robots per tier, ELO distribution, promotion/demotion rates, empty/overcrowded leagues for both 1v1 and tag team
    - Display count of robots/teams eligible for promotion and demotion per tier
    - Use `AdminPageHeader`, `AdminStatCard`, `AdminDataTable`
    - Fetch from `GET /api/admin/league-health`
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [x] 9.6 Write unit tests for LeagueHealthPage
    - Create `app/frontend/src/pages/admin/__tests__/LeagueHealthPage.test.tsx`
    - Test tier counts render, ELO distribution displays, promo/demo eligibility shows
    - _Requirements: 15.2, 15.3, 15.4_

  - [x] 9.7 Create `WeaponAnalyticsPage`
    - Create `app/frontend/src/pages/admin/WeaponAnalyticsPage.tsx`
    - Display all weapons with purchase count, equip count, equip rate
    - Highlight never-purchased weapons and high-purchase-low-equip weapons
    - Identify price-to-performance outliers
    - Provide real/auto/all user filter using `AdminFilterBar`
    - Use `AdminPageHeader`, `AdminDataTable`, `AdminStatCard`
    - Fetch from `GET /api/admin/weapons/analytics`
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

  - [x] 9.8 Write unit tests for WeaponAnalyticsPage
    - Create `app/frontend/src/pages/admin/__tests__/WeaponAnalyticsPage.test.tsx`
    - Test weapon list renders, outlier highlighting works, user filter toggles
    - _Requirements: 16.2, 16.3, 16.4, 16.5_

  - [x] 9.9 Create `AchievementAnalyticsPage`
    - Create `app/frontend/src/pages/admin/AchievementAnalyticsPage.tsx`
    - Display unlock rates per achievement
    - Flag 0% unlock rate as too hard, >90% as too easy
    - Display rarity distribution accuracy
    - Provide real/auto/all user filter using `AdminFilterBar`
    - Use `AdminPageHeader`, `AdminDataTable`, `AdminStatCard`
    - Fetch from `GET /api/admin/achievements/analytics`
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

  - [x] 9.10 Write unit tests for AchievementAnalyticsPage
    - Create `app/frontend/src/pages/admin/__tests__/AchievementAnalyticsPage.test.tsx`
    - Test unlock rates display, difficulty flags render, rarity accuracy shows, user filter works
    - _Requirements: 17.2, 17.3, 17.4, 17.5_

  - [x] 9.11 Create `TuningAdoptionPage`
    - Create `app/frontend/src/pages/admin/TuningAdoptionPage.tsx`
    - Display aggregate adoption stats: total robots with tuning, percentage eligible, average pool utilization
    - Display per-player summary showing tuning configuration per robot
    - Provide filters for zero adoption / full adoption
    - Use `AdminPageHeader`, `AdminDataTable`, `AdminStatCard`, `AdminFilterBar`
    - Fetch from `GET /api/admin/tuning/adoption`
    - _Requirements: 18.1, 18.2, 18.3, 18.4_

  - [x] 9.12 Write unit tests for TuningAdoptionPage
    - Create `app/frontend/src/pages/admin/__tests__/TuningAdoptionPage.test.tsx`
    - Test adoption stats render, per-player summary displays, filters toggle
    - _Requirements: 18.2, 18.3, 18.4_

  - [x] 9.13 Create `AuditLogPage`
    - Create `app/frontend/src/pages/admin/AuditLogPage.tsx`
    - Display paginated list of audit trail entries sorted by timestamp descending
    - Support filtering by operation type and date range
    - Use `AdminPageHeader`, `AdminDataTable`, `AdminFilterBar`
    - Fetch from `GET /api/admin/audit-log`
    - _Requirements: 19.3, 19.4, 19.5_

  - [x] 9.14 Write unit tests for AuditLogPage
    - Create `app/frontend/src/pages/admin/__tests__/AuditLogPage.test.tsx`
    - Test pagination works, filtering by type and date range works, entries display in descending order
    - _Requirements: 19.4, 19.5_

- [x] 10. Checkpoint — All pages implemented
  - Ensure all frontend tests pass (`npm test` in `app/frontend`), ask the user if questions arise.

- [x] 11. Legacy cleanup — Remove old admin shell and tab components
  - [x] 11.1 Delete `AdminPage.tsx` and old tab infrastructure
    - Delete `app/frontend/src/pages/AdminPage.tsx`
    - Remove or replace the barrel export file `app/frontend/src/components/admin/index.ts` with exports for new components
    - Remove old tab type definitions (`TabType`, `VALID_TABS`, `TAB_LABELS`) from the codebase
    - Verify `App.tsx` no longer has a single `/admin` route pointing to monolithic `AdminPage`
    - Verify the separate `/admin/onboarding-analytics` route is removed from `App.tsx`
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5_

  - [x] 11.2 Delete old tab component test files
    - Remove `AdminPage.test.tsx`, `AdminPage.bugfix-exploration.test.tsx`, `AdminPage.preservation.test.tsx`, `admin-preservation.property.test.tsx`
    - Remove old tab component tests: `DashboardTab.test.tsx`, `CycleControlsTab.test.tsx`, `BattleLogsTab.test.tsx`, `RobotStatsTab.test.tsx`, `BankruptcyMonitorTab.test.tsx`, `RecentUsersTab.test.tsx`, `SecurityTab.test.tsx`, `PasswordResetTab.test.tsx`, `AdminChangelogTab.test.tsx`, `AdminKoth.test.tsx`, `BattleDetailsModal.test.tsx`
    - _Requirements: 24.1, 24.5_

  - [x] 11.3 Delete old tab component source files
    - Remove the old tab component files from `app/frontend/src/components/admin/` (DashboardTab, CycleControlsTab, BattleLogsTab, RobotStatsTab, BankruptcyMonitorTab, RecentUsersTab, RepairLogTab, SecurityTab, PasswordResetTab, ImageUploadsTab, AdminChangelogTab)
    - Remove the separate `TournamentManagement` component import (now integrated into CycleControlsPage)
    - Remove the separate `OnboardingAnalyticsPage` (now absorbed into PlayersPage)
    - _Requirements: 23.1, 23.2, 23.3, 25.1, 25.5, 25.6_

  - [x] 11.4 Verify all admin tests pass after cleanup
    - Run `npm test` in `app/frontend` and verify zero failures for admin test files
    - Verify each new admin page component has a corresponding test file under `app/frontend/src/pages/admin/__tests__/`
    - Verify AdminRoute guard test exists and covers non-admin redirect and unauthenticated redirect
    - Verify AdminLayout test exists and covers sidebar sections and active route highlighting
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5, 24.6_

- [x] 12. Documentation and steering file updates
  - [x] 12.1 Rewrite `docs/prd_pages/PRD_ADMIN_PAGE.md`
    - Replace the current v3.x content describing the monolithic tab-based AdminPage
    - Document the new architecture: sidebar layout, route-based navigation, admin route guard, shared Zustand store, all page descriptions, shared UI component library
    - _Requirements: 28.1_

  - [x] 12.2 Update `docs/prd_pages/PRD_PRACTICE_ARENA.md`
    - Update admin reference from "Dashboard tab collapsible section" to standalone page at `/admin/practice-arena`
    - _Requirements: 28.2_

  - [x] 12.3 Update `.kiro/steering/project-overview.md`
    - Add Admin Portal as a key system with new architecture description (sidebar layout, route-based pages, Zustand store, admin route guard)
    - _Requirements: 28.3_

  - [x] 12.4 Update `.kiro/steering/frontend-state-management.md`
    - Add `useAdminStore` to the "Existing Stores" table with key data fields (systemStats, schedulerStatus, securitySummary, sessionLog) and actions (fetchStats, fetchSchedulerStatus, clearCache, clear)
    - _Requirements: 28.4_

  - [x] 12.5 Update `.kiro/steering/coding-standards.md`
    - Document the admin rate limiter pattern (120 req/min per admin user)
    - Document the DB-verified role check in `authenticateToken` (role read from DB, not JWT)
    - Document the admin access logging in `requireAdmin` (all successful accesses logged)
    - _Requirements: 28.5_

  - [x] 12.6 Update `.kiro/steering/error-handling-logging.md`
    - Document new security event types: `admin_access` (INFO severity), `admin_rate_limit_exceeded`
    - Document the admin audit trail: `AdminAuditLog` table, fire-and-forget write pattern, `AdminAuditLogService`
    - _Requirements: 28.6_

  - [x] 12.7 Update `docs/BACKLOG.md`
    - Move #13 (Admin Portal Redesign) and #38 (Admin Tuning Adoption Dashboard) to the "Recently Completed" table with a reference to spec #28
    - _Requirements: 28.7_

  - [x] 12.8 Update `README.md`
    - Update the admin portal description to reflect the redesigned architecture (sidebar layout, route-based pages, analytics dashboards)
    - _Requirements: 28.8_

- [x] 13. Final verification — Run all verification criteria
  - Run the following checks from the requirements document to confirm the spec delivered what it promised:
  - `grep -r "AdminPage" app/frontend/src/App.tsx` returns zero matches (VC 1)
  - `find app/frontend/src/pages/admin -name "*.tsx" | wc -l` returns at least 15 (VC 2)
  - `grep -r "AdminRoute\|AdminGuard\|requireAdminRole" app/frontend/src/` returns matches (VC 3)
  - `grep -r "useAdminStore" app/frontend/src/ | wc -l` returns at least 5 (VC 4)
  - `grep -r "lastLoginAt" app/backend/prisma/schema.prisma` returns a match (VC 5)
  - `grep -r "AdminAuditLog\|admin_audit_log\|adminAuditLog" app/backend/prisma/schema.prisma` returns a match (VC 6)
  - `find app/frontend/src/pages -name "AdminPage.tsx" | wc -l` returns 0 (VC 15)
  - `grep -rn "TabType\|VALID_TABS\|TAB_LABELS" app/frontend/src/pages/` returns zero matches (VC 16)
  - `find app/frontend/src/pages/admin/__tests__ -name "*.test.tsx" | wc -l` returns at least 10 (VC 17)
  - Run `npm test` in `app/frontend` — zero failures for admin files (VC 18)
  - `find app/frontend/src/components/admin/shared -name "*.tsx" | wc -l` returns at least 6 (VC 19)
  - `grep -r "AdminStatCard\|AdminDataTable\|AdminFilterBar" app/frontend/src/pages/admin/ | wc -l` returns at least 10 (VC 20)
  - `grep -r "select.*role" app/backend/src/middleware/auth.ts` returns a match (VC 21)
  - `grep -r "adminRateLimiter\|admin_rate_limit" app/backend/src/middleware/` returns a match (VC 22)
  - `grep -r "React.lazy\|lazy(" app/frontend/src/pages/admin/ app/frontend/src/App.tsx | grep -i admin` returns matches (VC 23)
  - `grep -r "sidebar\|Sidebar\|AdminLayout" docs/prd_pages/PRD_ADMIN_PAGE.md` returns matches (VC 24)
  - `grep -r "useAdminStore" .kiro/steering/frontend-state-management.md` returns a match (VC 25)
  - `grep -r "#13.*Admin Portal\|#38.*Tuning Adoption" docs/BACKLOG.md | grep -i "completed\|Recently Completed"` confirms both items moved (VC 26)
  - Run `npm test` in `app/backend` — zero failures for admin files
  - _Requirements: All (verification criteria from Expected Contribution)_

## Notes

- All tasks are mandatory — no optional tasks per spec quality standards
- Each task references specific requirement acceptance criteria for traceability
- Checkpoints at tasks 3, 6, 8, and 10 ensure incremental validation
- Property tests validate 10 correctness properties from the design document
- Unit tests validate specific UI rendering, component interactions, and edge cases
- Task 13 runs all 26 verification criteria from the requirements document as the final gate
