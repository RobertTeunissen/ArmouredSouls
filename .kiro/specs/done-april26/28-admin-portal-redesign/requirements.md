# Requirements Document

## Introduction

Redesign the admin portal from a single-page 12-tab horizontal layout into a dedicated admin experience with sidebar navigation, proper nested routes, role-based route guarding, shared Zustand state, and per-page UI overhauls. The current admin portal lives as routes within the player-facing app (`AdminPage.tsx` with hash-fragment tabs). This redesign restructures navigation, improves each existing page, and adds new analytics pages for player engagement, economy, league health, weapon economy, achievements, and tuning adoption. An admin action audit trail replaces the current localStorage-only session log.

## Glossary

- **Admin_Portal**: The dedicated admin section of the application, accessible at `/admin/*` routes, providing system management and analytics tools for the game administrator.
- **Admin_Layout**: A shared layout component wrapping all admin pages, providing a persistent sidebar, header, and content area.
- **Sidebar**: A persistent vertical navigation panel on the left side of the Admin_Layout, grouping admin pages into logical sections.
- **Admin_Route_Guard**: A route wrapper component (`AdminRoute`) that verifies the authenticated user has the `admin` role before rendering admin pages.
- **Admin_Store**: A Zustand store (`useAdminStore`) that caches system stats, session log entries, scheduler status, and last-fetched timestamps with TTL-based invalidation.
- **Session_Log**: A chronological record of admin-triggered operations and their outcomes, stored in the Admin_Store and optionally persisted to the server via the Audit_Trail.
- **Audit_Trail**: A server-side record of admin actions stored in the database, recording which admin triggered which operation and when.
- **KPI_Card**: A summary statistic card displayed on the dashboard showing a metric value, label, and optional trend indicator.
- **Cycle**: A single iteration of the automated game loop (matchmaking, battles, rebalancing, finances).
- **Scheduler**: The backend service (`cycleScheduler`) that automates cycle execution on a configurable interval.
- **At_Risk_User**: A player whose credit balance falls below the bankruptcy risk threshold (₡10,000).
- **Auto_Generated_User**: A user created by the bulk cycle runner's user generation feature, distinguishable from real players.
- **Churn_Risk**: A classification for players showing declining activity or extended login absence.
- **Deep_Link**: A URL that navigates directly to a specific admin page or sub-view, supporting browser history and bookmarking.

## Expected Contribution

This spec addresses backlog item #13 (Admin Portal Redesign) and absorbs #38 (Admin Tuning Adoption Dashboard). The current admin portal is a single page with 12 horizontal tabs, no dedicated layout, no role-based route guard, no shared state, and no analytics beyond raw stat dumps. It was the first admin UI built and has accumulated features without structural redesign.

### Measurable Outcomes

1. **Navigation scalability**: Replace 1 monolithic `AdminPage.tsx` (12 tabs, ~200 lines of tab switching logic) with ~18 lazy-loaded route-based pages under a shared layout. Before: 12 tabs in a wrapping horizontal bar. After: sidebar with grouped sections, each page independently routable.
2. **Route guard gap closed**: Before: `ProtectedRoute` only checks authentication, not admin role — non-admin users see the admin shell before API calls fail. After: `AdminRoute` wrapper rejects non-admins at the route level with immediate redirect.
3. **Redundant API calls eliminated**: Before: every tab switch re-fetches data (no caching). After: Zustand store with TTL-based caching shares stats across pages — navigating between dashboard and cycle controls doesn't re-fetch system stats within the TTL window.
4. **Player visibility gap closed**: Before: no way to see when existing players last logged in, no churn detection, no engagement indicators. After: Player Engagement page with login recency, activity indicators, and churn risk classification. Requires new `lastLoginAt` column on User model.
5. **Missing analytics pages added**: Before: 0 dedicated analytics pages for economy, league health, weapons, achievements, or tuning adoption. After: 6 new analytics pages surfacing data that already exists in the database but has no admin UI.
6. **Admin action accountability**: Before: session log is localStorage-only, per-browser, lost on clear. After: server-side audit trail in database with paginated admin UI, persisting which admin triggered which operation and when.

### Verification Criteria

1. `grep -r "AdminPage" app/frontend/src/App.tsx` returns zero matches (monolithic AdminPage replaced by admin layout with nested routes).
2. `find app/frontend/src/pages/admin -name "*.tsx" | wc -l` returns at least 15 (individual admin page components exist).
3. `grep -r "AdminRoute\|AdminGuard\|requireAdminRole" app/frontend/src/` returns matches confirming the admin route guard component exists.
4. `grep -r "useAdminStore" app/frontend/src/ | wc -l` returns at least 5 (Zustand store used across multiple admin pages).
5. `grep -r "lastLoginAt" app/backend/prisma/schema.prisma` returns a match (User model has login tracking column).
6. `grep -r "AdminAuditLog\|admin_audit_log\|adminAuditLog" app/backend/prisma/schema.prisma` returns a match (audit trail table exists in schema).
7. Navigate to `/admin/engagement` — page loads with player list showing login recency and churn risk indicators.
8. Navigate to `/admin/economy` — page loads with credit circulation totals and trend data.
9. Navigate to `/admin/league-health` — page loads with robots-per-tier and ELO distribution.
10. Navigate to `/admin/weapons` — page loads with weapon purchase counts and outlier flags.
11. Navigate to `/admin/achievements` — page loads with unlock rates and difficulty flags.
12. Navigate to `/admin/tuning` — page loads with adoption stats and per-player summary.
13. Navigate to `/admin/audit-log` — page loads with paginated admin action entries from the database.
14. As a non-admin user, navigate to `/admin/dashboard` — user is redirected to `/dashboard` without seeing admin content.
15. `find app/frontend/src/pages -name "AdminPage.tsx" | wc -l` returns 0 (old monolithic AdminPage removed).
16. `grep -rn "TabType\|VALID_TABS\|TAB_LABELS" app/frontend/src/pages/` returns zero matches (old tab infrastructure removed).
17. `find app/frontend/src/pages/admin/__tests__ -name "*.test.tsx" | wc -l` returns at least 10 (new page-level tests exist).
18. Running `npm test` in `app/frontend` produces zero failures for files matching `admin`.
19. `find app/frontend/src/components/admin/shared -name "*.tsx" | wc -l` returns at least 6 (shared admin UI components exist: AdminStatCard, AdminDataTable, AdminFilterBar, AdminPageHeader, AdminSlideOver, AdminEmptyState).
20. `grep -r "AdminStatCard\|AdminDataTable\|AdminFilterBar" app/frontend/src/pages/admin/ | wc -l` returns at least 10 (shared components are actually used across admin pages, not just defined).
21. `grep -r "select.*role" app/backend/src/middleware/auth.ts` returns a match (role is read from database, not just JWT).
22. `grep -r "adminRateLimiter\|admin_rate_limit" app/backend/src/middleware/` returns a match (dedicated admin rate limiter exists).
23. `grep -r "React.lazy\|lazy(" app/frontend/src/pages/admin/ app/frontend/src/App.tsx | grep -i admin` returns matches (admin pages are lazy-loaded).
24. `grep -r "sidebar\|Sidebar\|AdminLayout" docs/prd_pages/PRD_ADMIN_PAGE.md` returns matches (PRD rewritten to document new architecture).
25. `grep -r "useAdminStore" .kiro/steering/frontend-state-management.md` returns a match (steering file updated with admin store).
26. `grep -r "#13.*Admin Portal\|#38.*Tuning Adoption" docs/BACKLOG.md | grep -i "completed\|Recently Completed"` confirms both items moved to completed.

## Requirements

### Requirement 1: Dedicated Admin Layout with Sidebar Navigation

**User Story:** As an admin, I want a dedicated layout with sidebar navigation, so that I can efficiently navigate between admin sections without a crowded horizontal tab bar.

#### Acceptance Criteria

1. THE Admin_Layout SHALL render a persistent Sidebar on the left side and a content area on the right side for all routes under `/admin/*`.
2. THE Sidebar SHALL group navigation links into the following sections: Overview, Game Operations, Battle Data, Player Management, Security & Moderation, Content, and Maintenance.
3. WHEN the viewport width is below 768px, THE Sidebar SHALL collapse to display only icons without text labels.
4. WHEN a Sidebar navigation link is clicked, THE Admin_Portal SHALL navigate to the corresponding nested route without a full page reload.
5. THE Sidebar SHALL visually highlight the navigation link corresponding to the currently active route.
6. THE Admin_Layout SHALL not render the player-facing `Navigation` component.
7. THE Admin_Layout SHALL render a header bar displaying the page title and a link to return to the player-facing dashboard.

### Requirement 2: Route-Based Navigation with Lazy Loading

**User Story:** As an admin, I want proper URL-based navigation with browser history support, so that I can bookmark, share, and navigate between admin pages using the browser's back/forward buttons.

#### Acceptance Criteria

1. THE Admin_Portal SHALL replace hash-fragment navigation (`/admin#tab-name`) with nested routes (`/admin/dashboard`, `/admin/battles`, `/admin/security`, etc.).
2. WHEN a user navigates to an admin route, THE Admin_Portal SHALL load the corresponding page component using React lazy loading (`React.lazy`).
3. THE Admin_Portal SHALL support browser history navigation (back/forward buttons) for all admin routes.
4. WHEN a user navigates directly to a Deep_Link (e.g., `/admin/players`), THE Admin_Portal SHALL render the correct page without requiring navigation from the dashboard first.
5. WHEN a user navigates to `/admin` without a sub-path, THE Admin_Portal SHALL redirect to `/admin/dashboard`.
6. WHEN a user navigates to an invalid admin sub-route, THE Admin_Portal SHALL redirect to `/admin/dashboard`.
7. THE Admin_Portal SHALL display a loading indicator while a lazy-loaded page component is being fetched.

### Requirement 3: Frontend Admin Route Guard

**User Story:** As a system owner, I want admin routes protected by a role check, so that non-admin users cannot access admin pages even if they know the URL.

#### Acceptance Criteria

1. THE Admin_Route_Guard SHALL verify that the authenticated user's role equals `admin` before rendering any admin page.
2. WHEN a non-admin authenticated user navigates to any `/admin/*` route, THE Admin_Route_Guard SHALL redirect the user to the player dashboard (`/dashboard`).
3. WHEN an unauthenticated user navigates to any `/admin/*` route, THE Admin_Route_Guard SHALL redirect the user to the login page (`/login`).
4. WHILE the authentication state is loading, THE Admin_Route_Guard SHALL display a loading indicator instead of redirecting.

### Requirement 4: Shared Admin State with Zustand Store

**User Story:** As an admin, I want system stats and session log data cached and shared across admin pages, so that navigating between pages does not trigger redundant API calls.

#### Acceptance Criteria

1. THE Admin_Store SHALL cache system stats returned by `GET /api/admin/stats` with a configurable TTL (default: 60 seconds).
2. WHEN an admin page requests system stats and the cached data is within the TTL, THE Admin_Store SHALL return the cached data without making an API call.
3. WHEN an admin page requests system stats and the cached data has expired, THE Admin_Store SHALL fetch fresh data from the API and update the cache.
4. THE Admin_Store SHALL store Session_Log entries in memory and persist them to localStorage as a fallback.
5. THE Admin_Store SHALL track a `lastFetched` timestamp for each cached data category (stats, scheduler status, security summary).
6. THE Admin_Store SHALL provide a `clearCache` action that resets all cached data and timestamps.
7. THE Admin_Store SHALL share Session_Log entries across all admin pages without prop drilling.

### Requirement 5: Dashboard Overhaul — Operational Overview with Drill-Down Analytics

**User Story:** As an admin, I want a dashboard that highlights player churn risk, battle mode breakdowns, investment patterns, and roster strategies with the ability to drill down into each metric, so that I can understand not just what is happening but why.

#### Acceptance Criteria

1. THE Dashboard page SHALL display a top row of KPI_Cards showing: Inactive Real Players (not logged in for 3+ days), Battles Today, Scheduled Matches, Current Cycle number, and Cycle Status (running/stopped).
2. WHEN a KPI_Card value has changed compared to the previous cycle, THE Dashboard page SHALL display a trend indicator (up arrow, down arrow, or neutral) next to the value.
3. THE Dashboard page SHALL provide a global filter toggle to switch between "Real Players Only" (excluding usernames starting with `auto_`, `test_user_`, `archetype_`, `attr_`, and the `bye_robot_user` account), "Auto-Generated Only", and "All". This filter SHALL apply to all player-derived metrics on the dashboard.
4. THE Dashboard page SHALL display battle statistics broken down by battle type (League, Tournament, Tag Team, KotH) in separate cards, each showing: total battles, draws, kills, kill percentage, average duration, and victory margin breakdown (clear victories where loser HP reached 0 vs near victories where loser yielded with HP remaining). Tournament and KotH cards SHALL not display draw counts (draws are impossible in those modes).
5. THE Dashboard page SHALL display a facility investment breakdown showing ALL facility types (not just top 3), with purchase count AND level distribution (how many at level 1, 2, 3, etc.) for each facility type. THE breakdown SHALL include average passive income generated per facility type.
6. THE Dashboard page SHALL display weapon economy metrics showing: total weapons purchased, weapons equipped, equip rate, and a breakdown by weapon tier showing purchase count and average base damage per tier.
7. THE Dashboard page SHALL display a roster strategy breakdown showing: how many real players have 1 robot, 2 robots, or 3 robots, and how many players created additional robots after their initial onboarding robot(s). This SHALL include a timeline showing when additional robots were created relative to account age.
8. THE Dashboard page SHALL display stance distribution, loadout distribution, and yield threshold distribution as collapsible detail sections.
9. THE Dashboard page SHALL not include the System Health or Practice Arena sections (those are promoted to their own pages). Users at Risk SHALL not be displayed on the dashboard (they have their own dedicated page via the Players page At-Risk sub-view per Requirement 9).
10. WHEN the dashboard loads, THE Dashboard page SHALL use cached stats from the Admin_Store if available and within TTL.

### Requirement 6: Cycle Explorer — Per-Cycle Drill-Down

**User Story:** As an admin, I want to explore what happened in each cycle — battles fought, credits earned, purchases made, performance timing — so that I can understand the game's progression cycle by cycle instead of only seeing aggregate stats.

#### Acceptance Criteria

1. THE Cycle_Explorer page SHALL be accessible at `/admin/cycles/history` via the Sidebar under the Game Operations section.
2. THE Cycle_Explorer page SHALL display a cycle selector (dropdown or number input) that loads the snapshot data for any completed cycle.
3. FOR the selected cycle, THE Cycle_Explorer page SHALL display a summary banner showing: cycle number, trigger type (manual/scheduled), start time, end time, total duration, total battles, total credits transacted, and total prestige awarded.
4. FOR the selected cycle, THE Cycle_Explorer page SHALL display step duration breakdowns showing how long each cycle phase took (matchmaking, battles, rebalancing, finances, repairs, snapshots), with visual bars indicating relative duration and color-coded warnings for steps that took significantly longer than average.
5. FOR the selected cycle, THE Cycle_Explorer page SHALL display per-user stable metrics in a sortable table showing: username, battles participated, credits earned, streaming income, merchandising income, operating costs, repair costs, weapon/facility/robot/attribute purchases, net profit, and end-of-cycle balance. THE table SHALL support the same real/auto-generated user filter as the Dashboard (Requirement 5 AC 3).
6. FOR the selected cycle, THE Cycle_Explorer page SHALL display per-robot metrics in a sortable table showing: robot name, owner, battles participated, wins, losses, ELO change, damage dealt, damage received, and kills.
7. THE Cycle_Explorer page SHALL display a cycle comparison view that shows key metrics (total battles, total credits, average duration, total prestige) across the last 14 cycles as a trend, allowing the admin to spot anomalies or regressions.
8. THE Cycle_Explorer page SHALL absorb the data integrity checks currently in the System Health section (valid/invalid cycles, integrity issues list) as a collapsible "Data Integrity" panel within the cycle detail view.
9. THE Cycle_Explorer page SHALL absorb the performance degradation detection currently in the System Health section (degradation warnings per step) as visual indicators on the step duration bars.

### Requirement 7: Practice Arena as Standalone Page

**User Story:** As an admin, I want Practice Arena metrics on their own page, so that I can monitor practice arena usage independently.

#### Acceptance Criteria

1. THE Practice_Arena page SHALL be accessible at `/admin/practice-arena` via the Sidebar under the Game Operations section.
2. THE Practice_Arena page SHALL display current stats cards (battles today, unique players today, rate limit hits, total since start) and the daily usage trend table.
3. THE Practice_Arena page SHALL retain all functionality currently in the DashboardTab's collapsible Practice Arena section.

### Requirement 8: Cycle Controls Redesign — Production-Aligned Operations

**User Story:** As an admin, I want cycle controls that clearly show how the production scheduler works, distinguish between the 5 independent cron jobs and the bulk test runner, and provide confirmation before destructive actions, so that I understand what I'm triggering and how it maps to what ACC does automatically.

#### Acceptance Criteria

1. THE Cycle_Controls page SHALL display a scheduler status panel at the top showing: whether the scheduler is active, the current cycle number, and for each of the 5 cron jobs (League, Tournament, Tag Team, Settlement, KotH) its cron schedule, last run time, last run status (success/failed), last run duration, and next scheduled run time. This data SHALL be fetched from `GET /api/admin/scheduler/status`.
2. THE Cycle_Controls page SHALL organize operations into two clearly separated sections: "Production Jobs (Manual Trigger)" and "Bulk Cycle Testing". The production jobs section SHALL mirror the 5 independent cron jobs exactly as they run on ACC, each with a description of what it does (e.g., "League: Repair → Execute Battles → Rebalance → Schedule Matchmaking").
3. THE Production Jobs section SHALL provide a manual trigger button for each of the 5 jobs: League Cycle, Tournament Cycle, Tag Team Cycle, Settlement (daily finances + snapshot), and KotH Cycle. Each button SHALL execute the same sequence of steps as the corresponding cron job handler.
4. THE Cycle_Controls page SHALL include a Tournament Management section below the production jobs, providing tournament creation, bracket viewing, active tournament status, and manual round execution. This replaces the separate Tournaments page.
5. WHEN an admin clicks any manual trigger button, THE Cycle_Controls page SHALL display a confirmation dialog showing the job name and the steps that will be executed, using the existing `ConfirmationModal` component with `isDestructive` styling.
6. THE Bulk Cycle Testing section SHALL retain the current bulk runner functionality (cycle count, checkboxes for tournaments/KotH/finances/user generation) but SHALL display a note clarifying that bulk cycles run a different step sequence than the production scheduler.
7. THE Cycle_Controls page SHALL display the Session_Log in a collapsible side panel that can be toggled open and closed, rather than as a full-width section at the bottom.
8. THE Cycle_Controls page SHALL read and write Session_Log entries via the Admin_Store instead of receiving them as props from a parent component.

### Requirement 9: Player Management — Unified Players Page

**User Story:** As an admin, I want a single Players page that merges Recent Users, Bankruptcy Monitor, and Password Reset, so that I can manage all player-related tasks from one location with the ability to search by user, stable, or robot name and filter by player type.

#### Acceptance Criteria

1. THE Players page SHALL be accessible at `/admin/players` and SHALL replace the separate Recent Users, Bankruptcy Monitor, and Password Reset tabs.
2. THE Players page SHALL display a global search bar that searches across username, stable name, and robot name, returning matching players. THE backend search endpoint SHALL be extended to support robot name search in addition to the existing username, email, and user ID search.
3. THE Players page SHALL provide tabbed sub-views: All Players (search results), At-Risk (bankruptcy monitor data), and New Players (recent user activity).
4. THE Players page SHALL provide a global filter toggle (consistent with the Dashboard per Requirement 5 AC 3) to switch between "Real Players Only", "Auto-Generated Only", and "All". This filter SHALL apply across all sub-views.
5. WHEN an admin selects a player from any sub-view, THE Players page SHALL display a detail panel showing: account info, balance history, robots (with their ELO, league, battle record, and equipped weapons), facilities with type AND level for each facility purchased, onboarding status, and a password reset action.
6. THE player detail panel SHALL show the full facility breakdown: each facility type the player owns, its current level, and the passive income it generates — not just a count of "N facilities purchased".
7. THE Players page SHALL absorb the Onboarding Analytics functionality currently at `/admin/onboarding-analytics` into the New Players sub-view.
8. WHEN an admin triggers a password reset from the player detail panel, THE Players page SHALL call `POST /api/admin/users/:id/reset-password` with the same validation and rate limiting as the current PasswordResetTab.

### Requirement 10: Battle Logs Overhaul — Parity with Player Battle Report Plus Admin Debug Data

**User Story:** As an admin, I want battle logs that match the quality of the player-facing battle report (spec #26 overhaul) while also exposing full formula breakdowns and dice rolls, so that I can debug combat outcomes and understand why battles ended the way they did across all battle modes.

#### Acceptance Criteria

1. THE Battle_Logs page SHALL display filter chips for battle type (League, Tournament, Tag Team, KotH) that filter the battle list.
2. THE Battle_Logs page SHALL display a mini-stats summary bar above the battle list showing: total battles, average duration, draw percentage, kill percentage, and a victory margin breakdown (clear victories where loser HP reached 0 vs near victories where loser yielded with HP remaining) for the current filter.
3. WHEN an admin clicks a battle row, THE Battle_Logs page SHALL display a battle detail view that matches the player-facing battle report layout from spec #26: result banner, statistics summary with per-robot columns, damage flow diagram (for 3+ robots), and combat log.
4. THE admin battle detail view SHALL additionally display full formula breakdowns for every combat event: hit chance formula (base hit chance + targeting bonus − evasion penalty − gyro penalty + random variance with the actual rolled value), damage calculation (weapon base × combat power multiplier × loadout multiplier × weapon control multiplier × stance multiplier with each factor shown), and critical hit / malfunction rolls with thresholds and actual values.
5. THE admin battle detail view SHALL support all battle formats: 1v1 league battles, 2v2 tag team battles (showing tag-out timing, active/reserve robot phases, and per-phase statistics), KotH multi-robot battles (showing zone scoring, target switching, and per-target focus duration), and tournament battles.
6. THE admin battle detail view SHALL display the battle playback viewer (arena visualization) when spatial data is available, consistent with the player-facing battle report.
7. THE Battle_Logs page mini-stats summary SHALL show per-battle-type breakdowns when no filter is active: separate kill rates, draw rates, and average durations for League, Tournament, Tag Team, and KotH.

### Requirement 11: Robot Stats Improvements

**User Story:** As an admin, I want robot stats presented with summary cards and an attribute explorer, so that I can quickly identify outliers and understand attribute distributions.

#### Acceptance Criteria

1. THE Robot_Stats page SHALL display summary cards showing total robots, robots with battles, overall win rate, and average ELO.
2. THE Robot_Stats page SHALL provide an attribute explorer that allows selecting one attribute at a time to view its distribution statistics (mean, median, std dev, quartiles) and outlier list.
3. THE Robot_Stats page SHALL display outlier alerts as a notification-style list, showing robot name, attribute, value, and league for each outlier.

### Requirement 12: Security Page Improvements

**User Story:** As an admin, I want prominent security summary cards and clickable flagged user links, so that I can quickly assess security status and investigate flagged users.

#### Acceptance Criteria

1. THE Security page SHALL display prominent summary cards for total events, events by severity, active alerts, and flagged user count.
2. WHEN an admin clicks a flagged user in the Security page, THE Admin_Portal SHALL navigate to the Players page detail panel for that user.
3. THE Security page SHALL include a rate limit violations sub-section that displays recent rate limit events grouped by endpoint.

### Requirement 13: Player Engagement Monitoring

**User Story:** As an admin, I want to monitor existing player activity and detect churn risk, so that I can identify disengaged players before they leave.

#### Acceptance Criteria

1. THE Player_Engagement page SHALL be accessible at `/admin/engagement` via the Sidebar under the Player Management section.
2. THE Player_Engagement page SHALL display login recency for each player, showing when each player last logged in.
3. THE Player_Engagement page SHALL display activity indicators showing whether players are checking match outcomes, investing in facilities, buying weapons, or upgrading attributes.
4. THE Player_Engagement page SHALL classify players into Churn_Risk categories based on login absence duration and declining activity patterns.
5. THE Player_Engagement page SHALL provide a sortable and filterable list of players ordered by churn risk severity.
6. WHEN the backend does not yet track login timestamps, THE Player_Engagement page SHALL require a new `lastLoginAt` column on the User model and a corresponding API endpoint.

### Requirement 14: Economy Overview Page

**User Story:** As an admin, I want a macro economy overview, so that I can monitor credit circulation, inflation trends, and economic health.

#### Acceptance Criteria

1. THE Economy_Overview page SHALL be accessible at `/admin/economy` via the Sidebar under the Overview section.
2. THE Economy_Overview page SHALL display total credits in circulation, credit inflation/deflation rate (change between cycles), average player income vs average costs, and weapon purchase trends.
3. THE Economy_Overview page SHALL derive data from existing CycleSnapshot records and the current system stats endpoint.
4. WHEN cycle snapshot data is available for multiple cycles, THE Economy_Overview page SHALL display trend charts showing economic metrics over time.

### Requirement 15: League Health Dashboard

**User Story:** As an admin, I want a league health dashboard, so that I can monitor league balance, predict upcoming promotions/demotions, and identify overcrowded or empty leagues across both 1v1 and tag team leagues.

#### Acceptance Criteria

1. THE League_Health page SHALL be accessible at `/admin/league-health` via the Sidebar under the Battle Data section.
2. THE League_Health page SHALL display robots per tier, ELO distribution within each tier, promotion/demotion rates per cycle, and identification of empty or overcrowded league instances for BOTH the 1v1 league system and the tag team league system.
3. THE League_Health page SHALL display the number of robots (1v1) and teams (tag team) currently eligible for promotion and demotion in each tier, so the admin can predict what the next rebalancing will do.
4. THE League_Health page SHALL derive robot-per-tier data from the existing system stats and supplement with direct database queries for ELO distribution and league point standings.

### Requirement 16: Weapon Economy Analytics

**User Story:** As an admin, I want weapon economy analytics, so that I can identify which weapons are popular, which are ignored, and which are price-to-performance outliers, with the ability to filter by real vs auto-generated players.

#### Acceptance Criteria

1. THE Weapon_Analytics page SHALL be accessible at `/admin/weapons` via the Sidebar under the Battle Data section.
2. THE Weapon_Analytics page SHALL display a list of all weapons with purchase count, equip count, and equip rate.
3. THE Weapon_Analytics page SHALL highlight weapons that have never been purchased and weapons with a high purchase count but low equip rate.
4. THE Weapon_Analytics page SHALL identify price-to-performance outliers by comparing weapon cost to base damage and usage statistics.
5. THE Weapon_Analytics page SHALL provide the same real/auto-generated user filter as the Dashboard (Requirement 5 AC 3), so the admin can see weapon adoption patterns for real players separately from auto-generated users.

### Requirement 17: Achievement Analytics

**User Story:** As an admin, I want achievement analytics, so that I can verify achievement difficulty is calibrated correctly and identify achievements that are too easy or too hard, with the ability to filter by real vs auto-generated players.

#### Acceptance Criteria

1. THE Achievement_Analytics page SHALL be accessible at `/admin/achievements` via the Sidebar under the Content section.
2. THE Achievement_Analytics page SHALL display unlock rates for each achievement (percentage of eligible players who have unlocked it).
3. THE Achievement_Analytics page SHALL flag achievements with a 0% unlock rate as potentially too hard and achievements with a greater than 90% unlock rate as potentially too easy.
4. THE Achievement_Analytics page SHALL display rarity distribution accuracy by comparing actual unlock rates to the configured rarity tiers.
5. THE Achievement_Analytics page SHALL provide the same real/auto-generated user filter as the Dashboard (Requirement 5 AC 3), so the admin can see achievement unlock rates for real players separately from auto-generated users.

### Requirement 18: Tuning Adoption Dashboard

**User Story:** As an admin, I want a tuning adoption dashboard, so that I can see which players and robots have configured tuning allocations.

#### Acceptance Criteria

1. THE Tuning_Adoption page SHALL be accessible at `/admin/tuning` via the Sidebar under the Content section.
2. THE Tuning_Adoption page SHALL display aggregate adoption stats: total robots with tuning configured, percentage of eligible robots with tuning, and average pool utilization.
3. THE Tuning_Adoption page SHALL provide a per-player summary showing how many of each player's robots have tuning configured.
4. THE Tuning_Adoption page SHALL provide filters to show only players with zero tuning adoption or only players with full adoption.

### Requirement 19: Admin Action Audit Trail

**User Story:** As an admin, I want a server-side audit trail of admin actions, so that I have a persistent record of which operations were triggered and when, independent of browser localStorage.

#### Acceptance Criteria

1. WHEN an admin triggers any cycle operation (matchmaking, battles, rebalancing, repair, finances, bulk cycles, KotH, tournament execution), THE backend SHALL record an audit trail entry containing: admin user ID, operation type, timestamp, and operation result summary.
2. THE Audit_Trail entries SHALL be stored in the database, not in localStorage or in-memory only.
3. THE Admin_Portal SHALL provide an Audit Log page at `/admin/audit-log` accessible via the Sidebar under the Maintenance section.
4. THE Audit_Log page SHALL display a paginated, filterable list of audit trail entries sorted by timestamp descending.
5. THE Audit_Log page SHALL support filtering by operation type and date range.
6. THE Session_Log in the Admin_Store SHALL continue to function as a real-time in-browser log, supplementing but not replacing the server-side Audit_Trail.

### Requirement 20: Image Uploads and Changelog Management

**User Story:** As an admin, I want Image Uploads and Changelog management accessible from the redesigned admin portal, so that no existing functionality is lost during the redesign, and I can see why rejected images were rejected.

#### Acceptance Criteria

1. THE Admin_Portal SHALL include an Image Uploads page at `/admin/image-uploads` accessible via the Sidebar under the Content section, retaining all current ImageUploadsTab functionality.
2. THE Image Uploads page SHALL display the rejection reason for images that failed content moderation, including the moderation classification result (e.g., which NSFW category triggered the rejection and the confidence score). This data SHALL be sourced from the existing AuditLog `image_upload_rejected` events.
3. THE Admin_Portal SHALL include a Changelog page at `/admin/changelog` accessible via the Sidebar under the Content section, retaining all current AdminChangelogTab functionality.

### Requirement 22: Repair Log Preservation

**User Story:** As an admin, I want the Repair Log accessible from the redesigned admin portal, so that repair audit data remains available.

#### Acceptance Criteria

1. THE Admin_Portal SHALL include a Repair Log page at `/admin/repair-log` accessible via the Sidebar under the Maintenance section, retaining all current RepairLogTab functionality.

### Requirement 23: Legacy Cleanup — Remove Old Admin Shell and Tab Components

**User Story:** As a developer, I want the old monolithic AdminPage and its tab-switching infrastructure removed after migration, so that the codebase has no dead code or conflicting patterns.

#### Acceptance Criteria

1. AFTER all admin pages are migrated to the new route-based layout, THE codebase SHALL no longer contain `app/frontend/src/pages/AdminPage.tsx`.
2. THE barrel export file `app/frontend/src/components/admin/index.ts` SHALL be removed or replaced with exports for the new page components.
3. THE old tab type definitions (`TabType`, `VALID_TABS`, `TAB_LABELS`) SHALL not exist in the codebase.
4. THE `app/frontend/src/App.tsx` route configuration SHALL not contain a single `/admin` route pointing to the monolithic `AdminPage` component.
5. THE separate `/admin/onboarding-analytics` route in `App.tsx` SHALL be removed (absorbed into the Players page per Requirement 9).

### Requirement 24: Test Migration — Update Tests to Match New Architecture

**User Story:** As a developer, I want all admin-related tests updated to test the new route-based pages instead of the old tab components, so that the test suite remains valid and provides coverage for the redesigned architecture.

#### Acceptance Criteria

1. THE following test files SHALL be removed or rewritten to test the new page components instead of the old tab components: `AdminPage.test.tsx`, `AdminPage.bugfix-exploration.test.tsx`, `AdminPage.preservation.test.tsx`, `admin-preservation.property.test.tsx`.
2. EACH new admin page component SHALL have a corresponding test file under `app/frontend/src/pages/admin/__tests__/`.
3. THE test for the Admin_Route_Guard SHALL verify that non-admin users are redirected to `/dashboard` and unauthenticated users are redirected to `/login`.
4. THE test for the Admin_Layout SHALL verify that the Sidebar renders all navigation sections and highlights the active route.
5. EXISTING tab component tests (`DashboardTab.test.tsx`, `CycleControlsTab.test.tsx`, `BattleLogsTab.test.tsx`, `RobotStatsTab.test.tsx`, `BankruptcyMonitorTab.test.tsx`, `RecentUsersTab.test.tsx`, `SecurityTab.test.tsx`, `PasswordResetTab.test.tsx`, `AdminChangelogTab.test.tsx`, `AdminKoth.test.tsx`, `BattleDetailsModal.test.tsx`) SHALL be migrated to test the new page components, preserving the same behavioral coverage.
6. ALL admin-related tests SHALL pass after migration (`npm test` in the frontend directory returns zero failures for admin test files).

### Requirement 25: Tab-to-Page Migration Strategy

**User Story:** As a developer, I want a clear migration path from tab components to standalone pages, so that existing functionality is preserved during the transition without a broken intermediate state.

#### Acceptance Criteria

1. EACH existing tab component (`DashboardTab`, `CycleControlsTab`, `BattleLogsTab`, `RobotStatsTab`, `BankruptcyMonitorTab`, `RecentUsersTab`, `RepairLogTab`, `SecurityTab`, `PasswordResetTab`, `ImageUploadsTab`, `AdminChangelogTab`) SHALL be migrated to a standalone page component under `app/frontend/src/pages/admin/`.
2. THE migration SHALL preserve all existing functionality of each tab component — no features, filters, or interactions SHALL be removed during the migration.
3. EACH migrated page component SHALL use the Admin_Layout wrapper instead of the player-facing `Navigation` component.
4. EACH migrated page component SHALL read shared data (system stats, session log) from the Admin_Store instead of receiving it via props from the old AdminPage shell.
5. THE `TournamentManagement` component (currently imported directly into AdminPage) SHALL be integrated into the Cycle Controls page as a section, per Requirement 8 AC 4.
6. THE `OnboardingAnalyticsPage` (currently at a separate route) SHALL be absorbed into the Players page as a sub-view.

### Requirement 26: Shared Admin UI Component Library

**User Story:** As a developer, I want a shared set of admin UI primitives, so that all admin pages have a consistent look and feel without each page reinventing card layouts, tables, and filter patterns.

#### Acceptance Criteria

1. THE Admin_Portal SHALL provide a shared `AdminStatCard` component that renders a metric value, label, optional trend indicator (up/down/neutral), and optional color accent. All KPI cards, summary cards, and stat displays across admin pages SHALL use this component.
2. THE Admin_Portal SHALL provide a shared `AdminDataTable` component that renders a sortable, paginated table with consistent header styling (`bg-surface-elevated`), row hover states (`hover:bg-white/5`), and optional row click handler. All tabular data across admin pages SHALL use this component.
3. THE Admin_Portal SHALL provide a shared `AdminFilterBar` component that renders horizontal filter chips with active/inactive states, consistent with the design system's `bg-primary` for active and `bg-surface-elevated` for inactive. Battle Logs, Security, Repair Log, and other filterable pages SHALL use this component.
4. THE Admin_Portal SHALL provide a shared `AdminPageHeader` component that renders the page title, optional subtitle, and optional action buttons (e.g., Refresh) in a consistent layout. All admin pages SHALL use this component for their header.
5. THE Admin_Portal SHALL provide a shared `AdminSlideOver` component that renders a right-side slide-over panel for detail views (battle detail, player detail). The panel SHALL overlay the content area without replacing the list view.
6. THE Admin_Portal SHALL provide a shared `AdminEmptyState` component that renders a centered message with an icon for pages or sections with no data (e.g., "No users at risk", "No security events").
7. ALL shared admin UI components SHALL follow the existing design system color palette (`--background`, `--surface`, `--surface-elevated`, `--primary`, `--success`, `--warning`, `--error`), typography scale, and motion guidelines from `docs/design_ux/DESIGN_SYSTEM_QUICK_REFERENCE.md`.
8. ALL shared admin UI components SHALL be located in `app/frontend/src/components/admin/shared/` and exported via a barrel file.

### Requirement 27: Admin Security Hardening

**User Story:** As a system owner, I want additional security layers protecting admin endpoints, so that the admin portal is resilient against unauthorized access even if a JWT is compromised or a role change is delayed.

#### Acceptance Criteria

1. THE `authenticateToken` middleware SHALL read the user's `role` from the database (alongside the existing `tokenVersion` check) instead of trusting the role encoded in the JWT payload. This ensures that a role change (e.g., admin demoted to player) takes effect immediately, not after the 24-hour JWT expiration.
2. THE `requireAdmin` middleware SHALL apply a dedicated admin rate limiter (separate from the general API rate limiter) that limits admin API requests to 120 requests per minute per admin user, preventing abuse of admin endpoints even with a valid token.
3. THE `requireAdmin` middleware SHALL log all successful admin endpoint accesses (not just failures) to the security monitor with severity `info`, recording the admin user ID, endpoint, and timestamp. This creates a complete access audit trail.
4. THE Admin_Portal frontend SHALL not include admin page components in the main application bundle. Admin page components SHALL be loaded only via lazy imports triggered by admin route navigation, so that non-admin users never download admin code.
5. THE Admin_Portal frontend SHALL not expose admin route paths in the client-side router configuration to non-admin users. Admin routes SHALL be conditionally registered only when the authenticated user has the `admin` role.

### Requirement 28: Documentation and Steering File Updates

**User Story:** As a developer, I want all project documentation updated to reflect the redesigned admin portal, so that docs remain accurate and useful for future development.

#### Acceptance Criteria

1. THE `docs/prd_pages/PRD_ADMIN_PAGE.md` SHALL be rewritten to document the new admin portal architecture: sidebar layout, route-based navigation, admin route guard, shared Zustand store, all page descriptions, and the shared UI component library. The current v3.x content describing the monolithic tab-based AdminPage SHALL be replaced.
2. THE `docs/prd_pages/PRD_PRACTICE_ARENA.md` SHALL be updated to reference the Practice Arena's new standalone admin page at `/admin/practice-arena` instead of "Dashboard tab collapsible section".
3. THE `.kiro/steering/project-overview.md` SHALL be updated to list the Admin Portal as a key system with its new architecture (sidebar layout, route-based pages, Zustand store, admin route guard).
4. THE `.kiro/steering/frontend-state-management.md` SHALL be updated to include the Admin Store (`useAdminStore`) in the "Existing Stores" table with its key data fields and actions.
5. THE `.kiro/steering/coding-standards.md` SHALL be updated to document the admin rate limiter pattern, the DB-verified role check in `authenticateToken`, and the admin access logging in `requireAdmin`.
6. THE `.kiro/steering/error-handling-logging.md` SHALL be updated to document new security event types for admin access logging and the admin audit trail.
7. THE `docs/BACKLOG.md` SHALL be updated to move #13 (Admin Portal Redesign) and #38 (Admin Tuning Adoption Dashboard) to the "Recently Completed" table with a reference to this spec (#28).
8. THE `README.md` admin portal description SHALL be updated to reflect the redesigned architecture.
