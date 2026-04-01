# Bugfix Requirements Document

## Introduction

The Admin Page (`/admin`) in Armoured Souls has accumulated multiple issues that collectively degrade its usability and reliability. The page has grown to 2,249 lines with 7 tabs (Dashboard, Cycle Controls, Tournaments, Battle Logs, Robot Stats, System Health, Recent Users), exceeding the PRD-documented 5-tab design. Key functionality is broken or buried: the bankruptcy check requires navigating to the Dashboard tab and scrolling to find it, the Onboarding Analytics button navigates to a separate page that may not function correctly, the Refresh Stats button behavior is unclear in context, the frontend test suite is entirely skipped (all tests in a `describe.skip` block with a TODO comment), tournament management is likely broken due to recent tournament bracket seeding work that changed API contracts and data shapes, battle logs don't support tag team matches at all, the System Health tab largely duplicates Dashboard functionality, and the Recent Users and Onboarding Analytics features are scattered across separate locations instead of being combined.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN an admin loads the Admin Page THEN the system renders 7 tabs (Dashboard, Cycle Controls, Tournaments, Battle Logs, Robot Stats, System Health, Recent Users), exceeding the PRD-specified 5-tab design and creating unnecessary complexity for administrators

1.2 WHEN an admin needs to check which users are at risk of bankruptcy THEN the system requires navigating to the Dashboard tab and scrolling down to a conditionally-rendered "Users At Risk of Bankruptcy" section that only appears when `stats.finances.usersAtRisk > 0`, making this critical monitoring feature difficult to discover and access

1.3 WHEN an admin clicks the "🎓 Onboarding Analytics" button in the Admin Portal header THEN the system navigates to `/admin/onboarding-analytics` which is a separate page that may fail to load analytics data or display errors, disconnecting the admin from the main admin workflow

1.4 WHEN an admin clicks the "Refresh Stats" button in the Admin Portal header THEN the system calls `fetchStats()` which sets a global `loading` state that disables multiple unrelated buttons across the page, and the button is always visible regardless of which tab is active, creating confusion about what is being refreshed

1.5 WHEN the frontend test suite (`AdminPage.test.tsx`) is executed THEN the system skips all tests because the entire test suite is wrapped in `describe.skip()` with a TODO comment stating "This test file needs a complete rewrite to match the current AdminPage component", providing zero test coverage for the admin page

1.6 WHEN an admin attempts to use tournament management features (create tournament, execute round, view bracket) THEN the system may fail or display incorrect data because the `TournamentManagement.tsx` component uses API contracts (`tournamentApi.ts`) that may be out of sync with backend changes introduced by the tournament bracket seeding spec, which added new endpoints and modified data shapes for tournament details

1.7 WHEN an admin views Battle Logs and attempts to filter by battle type THEN the system only offers "All", "League", and "Tournament" options — there is no "Tag Team" filter option, despite the backend running tag team battles on odd cycles via `executeScheduledTagTeamBattles()`. Additionally, the battle list query (`GET /api/admin/battles`) only queries the `battle` table (1v1 battles) and does not include tag team battle results, so tag team battles are completely invisible in the admin battle logs

1.8 WHEN an admin views the Battle Details Modal for a tag team battle THEN the system cannot display it correctly because `BattleDetailsModal.tsx` is hardcoded for 1v1 battles (robot1/robot2 structure) and has no awareness of tag team battle data shapes (2v2 with team members)

1.9 WHEN an admin navigates to the System Health tab THEN the system renders a `SystemHealthPage` component that shows cycle performance metrics (average duration, step durations, degradations), data integrity status (valid/invalid cycles, issues), and event log statistics (total events, active users/robots, events by type) — fetched from `/api/analytics/performance`, `/api/analytics/integrity`, and `/api/analytics/logs/summary` endpoints. This overlaps significantly with the Dashboard tab's system statistics while adding cycle-specific performance data that could be integrated into the Dashboard. The System Health tab provides no unique admin-only value that justifies a separate tab

1.10 WHEN an admin wants to see recent real users AND their onboarding status THEN the system splits this information across two separate locations: the "Recent Users" tab (which shows user details including onboarding completion/skip/step status per user) and the "Onboarding Analytics" button (which navigates to a separate `/admin/onboarding-analytics` page showing aggregate funnel data). These features are complementary — per-user onboarding status and aggregate onboarding analytics — but are disconnected, requiring the admin to navigate between two different views to get the full picture

### Expected Behavior (Correct)

2.1 WHEN an admin loads the Admin Page THEN the system SHALL render a streamlined tab structure that consolidates related functionality, reducing cognitive load while maintaining access to all features (Dashboard with integrated monitoring, Cycle Controls, Tournaments, Battle Logs, Robot Stats)

2.2 WHEN an admin needs to check which users are at risk of bankruptcy THEN the system SHALL make the bankruptcy monitoring feature prominently accessible without requiring scrolling or conditional rendering — it should be a clearly visible section or dedicated area within the Dashboard that is always present (showing "No users at risk" when applicable)

2.3 WHEN an admin wants to view onboarding analytics and recent user activity THEN the system SHALL present both per-user onboarding status and aggregate onboarding funnel analytics in a single consolidated view (e.g., a "Users & Onboarding" tab or section within the Dashboard), eliminating the need for a separate `/admin/onboarding-analytics` page

2.4 WHEN an admin clicks the Refresh Stats button THEN the system SHALL refresh only the data relevant to the currently active tab without disabling unrelated controls, and the button's purpose SHALL be clear in context

2.5 WHEN the frontend test suite is executed THEN the system SHALL run a comprehensive set of tests covering all admin page tabs, key interactions (tab switching, button clicks, data loading), error states, and component rendering, with the `describe.skip` removed and tests updated to match the current component structure and data shapes

2.6 WHEN an admin uses tournament management features THEN the system SHALL correctly create tournaments, display tournament details with bracket data, execute rounds, and show results, with the frontend tournament API client aligned to the current backend API contracts including any changes from the tournament bracket seeding spec

2.7 WHEN an admin views Battle Logs THEN the system SHALL include tag team battles alongside 1v1 battles, with a battle type filter that offers "All", "League", "Tournament", and "Tag Team" options. Tag team battles SHALL be clearly distinguished in the battle list (e.g., showing team names or "2v2" indicator) and the backend `GET /api/admin/battles` endpoint SHALL be extended to query and return tag team battle data

2.8 WHEN an admin opens the Battle Details Modal for a tag team battle THEN the system SHALL display the tag team battle correctly, showing both team members per side, team-level and individual robot stats, and the combat log appropriate for 2v2 battles

2.9 WHEN an admin needs cycle performance metrics and data integrity information (currently in System Health tab) THEN the system SHALL integrate this data into the Dashboard tab as a collapsible "System Health" section, consolidating cycle performance, data integrity status, and event statistics alongside the existing system statistics. The standalone System Health tab SHALL be removed

2.10 WHEN an admin wants to see recent real users AND their onboarding status THEN the system SHALL present a consolidated "Users & Onboarding" tab that combines the Recent Users list (with per-user onboarding status, robot details, and issue detection) with aggregate onboarding analytics (completion rate, skip rate, step funnel) in a single view

### Unchanged Behavior (Regression Prevention)

3.1 WHEN an admin uses Cycle Controls (run matchmaking, execute battles, rebalance leagues, auto-repair, process daily finances, bulk cycle runner) THEN the system SHALL CONTINUE TO execute these operations correctly with proper session logging and status feedback

3.2 WHEN an admin views Battle Logs with search, filtering by league, filtering by battle type, and pagination THEN the system SHALL CONTINUE TO display 1v1 battle data correctly with clickable robot names, visual outcome indicators, and battle highlight borders

3.3 WHEN an admin opens the Battle Details Modal for a 1v1 battle THEN the system SHALL CONTINUE TO display the side-by-side robot comparison, attribute comparison grid, and combat log with expandable formula breakdowns

3.4 WHEN an admin views Robot Stats with attribute selection, statistical analysis, outlier detection, win rate correlation, league comparison, and top/bottom performers THEN the system SHALL CONTINUE TO display all analytics correctly with clickable robot name links

3.5 WHEN an admin's tab selection is persisted via localStorage and URL hash THEN the system SHALL CONTINUE TO restore the correct tab on page reload

3.6 WHEN the session log records operations with timestamps, color-coded types, localStorage persistence (max 100 entries FIFO), and export-to-JSON functionality THEN the system SHALL CONTINUE TO function correctly

3.7 WHEN the backend admin API endpoints (`/api/admin/stats`, `/api/admin/battles`, `/api/admin/battles/:id`, `/api/admin/stats/robots`, `/api/admin/matchmaking/run`, `/api/admin/battles/run`, `/api/admin/leagues/rebalance`, `/api/admin/repair/all`, `/api/admin/daily-finances/process`, `/api/admin/cycles/bulk`) are called THEN the system SHALL CONTINUE TO return correct data with proper authentication and authorization checks

3.8 WHEN the backend processes tag team battles during bulk cycles (odd cycles: execute tag team battles, repair, rebalance tag team leagues, tag team matchmaking) THEN the system SHALL CONTINUE TO execute these operations correctly — the admin page changes only affect how tag team battle data is displayed, not how it is generated
