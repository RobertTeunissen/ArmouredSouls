# Admin Page Overhaul Bugfix Design

## Overview

The Admin Page (`/admin`) has accumulated 10 distinct bugs spanning structural bloat (7 tabs vs PRD's 5), buried critical features (bankruptcy monitoring), broken integrations (tournament management post-bracket-seeding, missing tag team battle support), dead code (skipped test suite), and fragmented UX (onboarding analytics on a separate page, System Health duplicating Dashboard). The fix consolidates the tab structure to 7 tabs (Dashboard, Cycle Controls, Tournaments, Battle Logs, Robot Stats, Bankruptcy Monitor, Recent Users), where Bankruptcy Monitor is promoted to its own tab and System Health is folded into Dashboard. The monolithic 2,249-line `AdminPage.tsx` is decomposed into separate tab components (one per tab) so each can be developed, tested, and maintained independently. Tag team battle support is added across the stack (backend query, frontend filter, modal rendering), tournament management is aligned with the bracket seeding spec's API contracts, the broken onboarding analytics link is removed, and the test suite is rewritten with per-component test files.

## Glossary

- **Bug_Condition (C)**: The set of conditions that trigger any of the 10 identified bugs — tab overcount, buried bankruptcy check, broken onboarding navigation, confusing refresh behavior, skipped tests, broken tournament management, missing tag team support, hardcoded 1v1 modal, redundant System Health tab, fragmented user/onboarding views
- **Property (P)**: The desired behavior after fix — streamlined 7-tab layout with dedicated Bankruptcy Monitor tab, component decomposition for testability, tag team battle visibility, working tournament management, comprehensive per-component test coverage
- **Preservation**: Existing cycle controls, 1v1 battle log display, 1v1 battle details modal, robot stats analytics, tab persistence via localStorage/URL hash, session logging, and all backend admin API endpoints must continue working identically
- **AdminPage**: The main admin portal component at `prototype/frontend/src/pages/AdminPage.tsx` (2,249 lines) — to be decomposed into a thin shell + separate tab components
- **Tab Components**: New per-tab components extracted from AdminPage: `DashboardTab`, `CycleControlsTab`, `BattleLogsTab`, `RobotStatsTab`, `BankruptcyMonitorTab`, `RecentUsersTab` — each in `prototype/frontend/src/components/admin/`
- **BattleDetailsModal**: The battle analysis modal at `prototype/frontend/src/components/BattleDetailsModal.tsx` hardcoded for 1v1 robot1/robot2 structure
- **TournamentManagement**: The tournament admin component at `prototype/frontend/src/components/TournamentManagement.tsx` using `tournamentApi.ts` contracts
- **SystemHealthPage**: The standalone system health component at `prototype/frontend/src/pages/SystemHealthPage.tsx` fetching from `/api/analytics/*` endpoints
- **OnboardingAnalyticsPage**: The separate onboarding analytics page at `prototype/frontend/src/pages/OnboardingAnalyticsPage.tsx` fetching from `/api/onboarding/analytics/summary`
- **TagTeamMatch**: Prisma model for 2v2 scheduled battles linking two `TagTeam` records to a `Battle` via `battleId`
- **TagTeam**: Prisma model representing a 2v2 team with `activeRobotId` and `reserveRobotId`

## Bug Details

### Bug Condition

The bugs manifest across multiple dimensions of the Admin Page. The compound bug condition covers any admin interaction that touches the affected areas.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type AdminPageInteraction
  OUTPUT: boolean

  // Bug 1.1: Tab structure exceeds PRD design
  IF input.type == 'PAGE_LOAD' AND countTabs() == 7
    AND hasTab('system-health')
    RETURN true

  // Bug 1.2: Bankruptcy check buried behind conditional rendering
  IF input.type == 'CHECK_BANKRUPTCY' AND NOT hasTab('bankruptcy-monitor')
    RETURN true  // No dedicated tab for bankruptcy monitoring

  // Bug 1.3: Onboarding Analytics navigates to broken separate page
  IF input.type == 'CLICK_ONBOARDING_ANALYTICS'
    RETURN true  // Always navigates away from admin

  // Bug 1.4: Refresh Stats sets global loading state
  IF input.type == 'CLICK_REFRESH_STATS' AND activeTab != 'dashboard'
    RETURN true  // Confusing when not on dashboard

  // Bug 1.5: Test suite entirely skipped
  IF input.type == 'RUN_TESTS' AND testSuiteHasDescribeSkip()
    RETURN true

  // Bug 1.6: Tournament management broken from bracket seeding
  IF input.type == 'USE_TOURNAMENT_FEATURE'
     AND tournamentApiContractsOutOfSync()
    RETURN true

  // Bug 1.7: No tag team filter, backend only queries 1v1
  IF input.type == 'VIEW_BATTLE_LOGS'
     AND input.wantsTagTeamBattles == true
    RETURN true

  // Bug 1.8: Battle modal hardcoded for 1v1
  IF input.type == 'VIEW_BATTLE_DETAILS'
     AND battle.isTagTeam == true
    RETURN true

  // Bug 1.9: System Health tab overlaps Dashboard
  IF input.type == 'NAVIGATE_TAB' AND input.tab == 'system-health'
    RETURN true  // Tab should not exist, content folded into Dashboard

  // Bug 1.10: Onboarding Analytics on broken separate page
  IF input.type == 'CLICK_ONBOARDING_ANALYTICS'
     AND navigatesToSeparatePage()
    RETURN true  // Link should be removed, page is broken

  RETURN false
END FUNCTION
```

### Examples

- **Bug 1.1**: Admin loads `/admin` → sees 7 tabs including System Health (which duplicates Dashboard data). Expected: 7 tabs but with Bankruptcy Monitor replacing System Health.
- **Bug 1.2**: Admin wants to check bankruptcy risk → must navigate to Dashboard tab, scroll down, and the section only appears when `stats.finances.usersAtRisk > 0`. If no users are at risk, the section is completely hidden. Expected: dedicated Bankruptcy Monitor tab always accessible.
- **Bug 1.3**: Admin clicks "🎓 Onboarding Analytics" button → navigates to `/admin/onboarding-analytics`, leaving the admin workflow. The page uses in-memory analytics that are lost on server restart. Expected: remove the broken link.
- **Bug 1.7**: Admin opens Battle Logs → filter dropdown shows "All", "League", "Tournament" only. Tag team battles executed on odd cycles are invisible. Expected: "Tag Team" filter option, backend returns tag team battle data.
- **Bug 1.8**: Admin clicks a tag team battle in the list → modal tries to render `battle.robot1` / `battle.robot2` but tag team battles have team structures with 2 robots per side. Expected: modal detects tag team format and renders team-based layout.
- **Bug 1.5**: Running `vitest` → `AdminPage.test.tsx` has `describe.skip()` wrapping all tests, producing 0 test results. Expected: comprehensive test suite runs and passes.
- **Bug 1.6**: Admin clicks "Create Tournament" or views tournament details → component uses `tournamentApi.ts` which now expects `seedings` array and `TournamentMatchWithRobots` types from the bracket seeding spec, but `TournamentManagement.tsx` still references `currentRoundMatches` from the old response shape. Expected: tournament management works with current API contracts.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Cycle Controls (run matchmaking, execute battles, rebalance leagues, auto-repair, process daily finances, bulk cycle runner) must continue to execute correctly with session logging and status feedback
- 1v1 battle data in Battle Logs must continue to display correctly with search, league filtering, pagination, clickable robot names, visual outcome indicators, and battle highlight borders
- 1v1 Battle Details Modal must continue to show side-by-side robot comparison, attribute comparison grid, combat log with expandable formula breakdowns, and battle rewards
- Robot Stats tab with attribute selection, statistical analysis, outlier detection, win rate correlation, league comparison, and top/bottom performers must continue working
- Tab selection persistence via localStorage and URL hash must continue to restore the correct tab on reload (with updated tab IDs)
- Session log with timestamps, color-coded types, localStorage persistence (max 100 entries FIFO), and export-to-JSON must continue functioning
- All backend admin API endpoints (`/api/admin/stats`, `/api/admin/battles`, `/api/admin/battles/:id`, `/api/admin/stats/robots`, `/api/admin/matchmaking/run`, `/api/admin/battles/run`, `/api/admin/leagues/rebalance`, `/api/admin/repair/all`, `/api/admin/daily-finances/process`, `/api/admin/cycles/bulk`) must continue returning correct data
- Backend tag team battle processing during bulk cycles (odd cycles: execute tag team battles, repair, rebalance tag team leagues, tag team matchmaking) must continue executing correctly — admin page changes only affect display, not generation

**Scope:**
All inputs that do NOT involve the 10 bug conditions should be completely unaffected by this fix. This includes:
- All cycle control operations
- 1v1 battle viewing and analysis
- Robot statistics analysis
- Session log operations
- Backend API behavior for existing endpoints

## Hypothesized Root Cause

Based on the bug analysis, the root causes are:

1. **Organic Growth Without PRD Alignment (Bugs 1.1, 1.9, 1.10)**: The Admin Page grew from the PRD's 5-tab design to 7 tabs as features were added incrementally. System Health was added as a separate tab rather than integrated into Dashboard. The onboarding analytics page was built as a separate route that doesn't function reliably (in-memory data lost on restart).

2. **Monolithic Component Anti-Pattern (Bugs 1.1, 1.5)**: AdminPage.tsx grew to 2,249 lines as a single component with all tab logic, state, and rendering inline. This made the test suite impossible to maintain — the test file was abandoned with `describe.skip()` because testing a 2,249-line component with 7 tabs worth of state is impractical. Decomposing into per-tab components makes each testable in isolation.

3. **Conditional Rendering Hiding Critical Data (Bug 1.2)**: The bankruptcy monitoring section uses `{stats && stats.finances.usersAtRisk > 0 && (...)}` which completely hides the section when no users are at risk, and it's buried inside the Dashboard tab rather than being a first-class monitoring feature with its own tab.

4. **Global Loading State Anti-Pattern (Bug 1.4)**: The `fetchStats()` function sets a single `loading` state variable that disables buttons across multiple tabs, and the Refresh Stats button is always visible in the header regardless of active tab.

5. **Deferred Test Rewrite (Bug 1.5)**: The test file explicitly states "This test file needs a complete rewrite to match the current AdminPage component" with `describe.skip()`, meaning tests were never updated after major component refactoring.

6. **API Contract Drift from Bracket Seeding Spec (Bug 1.6)**: The tournament bracket seeding spec modified `GET /api/tournaments/:id` to return all matches across all rounds with a `seedings` array, and `tournamentApi.ts` was updated to match. However, `TournamentManagement.tsx` still accesses `activeTournament.currentRoundMatches` which is now derived client-side from the full matches array. The component may also reference properties that changed shape.

7. **1v1-Only Backend Query (Bug 1.7)**: The `GET /api/admin/battles` endpoint only queries `prisma.battle.findMany()` on the `battle` table. Tag team battles are tracked via `TagTeamMatch` → `Battle` relation, but the admin endpoint doesn't join or union these results. The frontend filter only offers "All", "League", "Tournament" — no "Tag Team" option.

8. **Hardcoded 1v1 Modal Structure (Bug 1.8)**: `BattleDetailsModal.tsx` renders `battle.robot1` and `battle.robot2` directly with no conditional logic for tag team battles. Tag team battles have a different data shape with teams containing `activeRobot` and `reserveRobot`.

## Correctness Properties

Property 1: Bug Condition - Tab Structure Consolidation

_For any_ admin page load, the rendered tab bar SHALL contain exactly 7 tabs: Dashboard, Cycle Controls, Tournaments, Battle Logs, Robot Stats, Bankruptcy Monitor, and Recent Users. The System Health tab SHALL NOT exist. The tab bar SHALL NOT contain an "Onboarding Analytics" link or button.

**Validates: Requirements 2.1, 2.9**

Property 2: Bug Condition - Bankruptcy Monitor as Dedicated Tab

_For any_ admin wanting to check bankruptcy risk, the system SHALL provide a dedicated "Bankruptcy Monitor" tab (`#bankruptcy-monitor`) that always renders the at-risk users list, showing either the detailed at-risk user data or a "No users at risk" confirmation when `usersAtRisk === 0`. This tab SHALL be accessible directly without scrolling within another tab.

**Validates: Requirements 2.2**

Property 3: Bug Condition - Tag Team Battle Visibility in Logs

_For any_ admin Battle Logs view with the "Tag Team" filter selected, the backend SHALL return tag team battle records from the `TagTeamMatch` table joined with `Battle` data, and the frontend SHALL render these battles with a "2v2" indicator distinguishing them from 1v1 battles.

**Validates: Requirements 2.7**

Property 4: Bug Condition - Tag Team Battle Details Modal

_For any_ battle details modal opened for a tag team battle, the modal SHALL detect the tag team format and render both team members per side (active robot and reserve robot), team-level stats, and the appropriate combat log for 2v2 battles, rather than the 1v1 robot1/robot2 layout.

**Validates: Requirements 2.8**

Property 5: Bug Condition - Broken Onboarding Analytics Link Removed

_For any_ admin page load, the header SHALL NOT contain a link or button navigating to `/admin/onboarding-analytics`. The broken onboarding analytics page SHALL no longer be reachable from the admin workflow.

**Validates: Requirements 2.3**

Property 6: Bug Condition - Tournament Management API Alignment

_For any_ tournament management operation (list tournaments, view details, create tournament, execute round), the `TournamentManagement.tsx` component SHALL correctly use the current `tournamentApi.ts` contracts including the `seedings` array and `TournamentMatchWithRobots` types from the bracket seeding spec, and SHALL render tournament data without errors.

**Validates: Requirements 2.6**

Property 7: Bug Condition - Component Decomposition and Test Suite Coverage

_For any_ execution of the frontend test suite, the monolithic `AdminPage.test.tsx` with `describe.skip()` SHALL be replaced by per-component test files (e.g., `DashboardTab.test.tsx`, `BattleLogsTab.test.tsx`, `BankruptcyMonitorTab.test.tsx`, etc.) that each test their respective tab component in isolation. The `AdminPage.test.tsx` SHALL test only the shell (tab rendering, tab switching, routing). All test files SHALL pass without `describe.skip()`.

**Validates: Requirements 2.5**

Property 8: Preservation - Existing 1v1 Battle Log Behavior

_For any_ Battle Logs view with non-tag-team filters (All, League, Tournament), the system SHALL continue to display 1v1 battle data correctly with search, league filtering, pagination, clickable robot names, visual outcome indicators, and battle highlight borders, producing the same results as the original code.

**Validates: Requirements 3.2, 3.7**

Property 9: Preservation - Existing 1v1 Battle Details Modal

_For any_ Battle Details Modal opened for a 1v1 battle, the modal SHALL continue to display the side-by-side robot comparison, attribute comparison grid, combat log with expandable formula breakdowns, and battle rewards identically to the original code.

**Validates: Requirements 3.3**

Property 10: Preservation - Cycle Controls and Session Log

_For any_ cycle control operation (matchmaking, battles, rebalance, repair, finances, bulk cycles), the system SHALL continue to execute correctly with proper session logging, status feedback, and localStorage persistence, producing the same behavior as the original code.

**Validates: Requirements 3.1, 3.5, 3.6**

Property 11: Preservation - Robot Stats Analytics

_For any_ Robot Stats tab interaction (attribute selection, viewing statistical analysis, outlier detection, win rate correlation, league comparison, top/bottom performers), the system SHALL continue to display all analytics correctly with clickable robot name links, producing the same results as the original code.

**Validates: Requirements 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

### Component Decomposition (Core Architecture Change)

The monolithic `AdminPage.tsx` (2,249 lines) is decomposed into a thin shell component + separate tab components. This is the foundational change that enables all other fixes and makes the codebase testable.

**New directory**: `prototype/frontend/src/components/admin/`

**New tab components** (extracted from AdminPage.tsx):
- `DashboardTab.tsx` — System statistics grid (cleaned up layout), System Health collapsible section (absorbed from SystemHealthPage)
- `CycleControlsTab.tsx` — Individual cycle controls, bulk cycle runner, session log
- `BattleLogsTab.tsx` — Battle table with search/filtering (including new tag team filter), pagination, visual indicators
- `RobotStatsTab.tsx` — Attribute selector, statistical analysis, outlier detection, win rate correlation, league comparison, top/bottom performers
- `BankruptcyMonitorTab.tsx` — Dedicated at-risk users view (extracted from Dashboard's conditional section), always shows status even when 0 users at risk
- `RecentUsersTab.tsx` — Recent real users list with per-user onboarding status, robot details, issue detection (kept as-is from current recent-users tab)

**Shared types file**: `prototype/frontend/src/components/admin/types.ts` — Shared interfaces (`SystemStats`, `Battle`, `SessionLogEntry`, `RobotStats`, `AtRiskUser`, etc.) extracted from AdminPage.tsx

**File**: `prototype/frontend/src/pages/AdminPage.tsx`

**Specific Changes**:
1. **Reduce to thin shell**: AdminPage becomes a ~100-200 line shell that handles tab navigation, URL hash/localStorage persistence, and renders the active tab component. All tab-specific state, data fetching, and rendering moves into the respective tab components.

2. **Tab Structure**: Update `TabType` to `'dashboard' | 'cycles' | 'tournaments' | 'battles' | 'stats' | 'bankruptcy-monitor' | 'recent-users'`. Remove `system-health` from the tab list. The tab count stays at 7 but System Health is replaced by Bankruptcy Monitor.

3. **Header Cleanup**: Remove the `<Link to="/admin/onboarding-analytics">` button. Remove the global Refresh Stats button (each tab component manages its own refresh). Keep only the "Admin Portal" heading.

4. **Session log as shared state**: Pass `addSessionLog` and `sessionLog` as props or via a lightweight context to tab components that need it (CycleControlsTab, BattleLogsTab, RobotStatsTab).

**File**: `prototype/frontend/src/components/admin/DashboardTab.tsx`

**Specific Changes**:
5. **Dashboard Layout Cleanup**: Reorganize the system statistics grid for better visual hierarchy. Group related stats into clear sections (Robots, Battles, Economy, Facilities, Combat). Use consistent card sizing and spacing.

6. **System Health Integration**: Absorb the `SystemHealthPage` content as a collapsible `<details>` section at the bottom of the Dashboard. Fetch from `/api/analytics/performance`, `/api/analytics/integrity`, and `/api/analytics/logs/summary`. Show cycle performance, data integrity status, and event statistics.

**File**: `prototype/frontend/src/components/admin/BankruptcyMonitorTab.tsx`

**Specific Changes**:
7. **Dedicated Bankruptcy Tab**: Extract the at-risk users functionality from Dashboard into its own tab component. Fetch from `GET /api/admin/users/at-risk`. Always render — when `totalAtRisk === 0`, show a green "✓ No users at risk of bankruptcy" confirmation with the threshold displayed. When users are at risk, show the full detailed list with balance history, runway days, and robot damage info.

**File**: `prototype/frontend/src/components/admin/BattleLogsTab.tsx`

**Specific Changes**:
8. **Tag Team Filter**: Add "Tag Team" option to the `battleTypeFilter` dropdown (`<option value="tagteam">Tag Team Battles</option>`). Pass `battleType=tagteam` query parameter to the backend.

**File**: `prototype/backend/src/routes/admin.ts`

**Function**: `GET /api/admin/battles`

**Specific Changes**:
9. **Tag Team Battle Query**: When `battleType === 'tagteam'`, query `TagTeamMatch` joined with `Battle` and `TagTeam` (with robot relations) instead of the `battle` table directly. When `battleType === 'all'`, union 1v1 battle results with tag team battle results. Return a `battleFormat` field (`'1v1'` or `'2v2'`) in each battle record to distinguish them.

10. **Tag Team Battle Details Endpoint**: Extend `GET /api/admin/battles/:id` to detect if a battle has an associated `TagTeamMatch` and return team data (team1 with activeRobot/reserveRobot, team2 with activeRobot/reserveRobot) alongside the standard battle data.

**File**: `prototype/frontend/src/components/BattleDetailsModal.tsx`

**Specific Changes**:
11. **Tag Team Detection and Rendering**: Add conditional rendering that checks for a `battleFormat` or `teams` field in the battle data. When tag team data is present, render a 2v2 layout showing Team 1 (active + reserve robots) vs Team 2 (active + reserve robots) with team-level stats. Preserve the existing 1v1 layout for standard battles.

**File**: `prototype/frontend/src/components/TournamentManagement.tsx`

**Specific Changes**:
12. **API Contract Alignment**: Verify and update the component to work with the current `tournamentApi.ts` contracts. The `getTournamentDetails()` now returns `{ tournament: TournamentDetails; seedings: SeedEntry[] }` where `TournamentDetails` includes `matches` (all rounds) and `currentRoundMatches` (derived client-side). Ensure the component accesses `currentRoundMatches` correctly from the response.

**File**: `prototype/frontend/src/pages/OnboardingAnalyticsPage.tsx`

**Specific Changes**:
13. **Remove link, keep route**: Remove the admin header link to this page. The route can remain for direct URL access but is no longer part of the admin workflow. The page's in-memory analytics are unreliable (lost on server restart) so it should not be prominently featured.

### Test Suite Architecture

**File**: `prototype/frontend/src/pages/__tests__/AdminPage.test.tsx`

**Specific Changes**:
14. **Shell-only tests**: Remove `describe.skip()`. Rewrite to test only the AdminPage shell: 7-tab rendering, tab switching, URL hash persistence, localStorage persistence. Mock all tab components.

**New test files** in `prototype/frontend/src/components/admin/__tests__/`:
- `DashboardTab.test.tsx` — Stats loading, grid rendering, System Health collapsible section
- `CycleControlsTab.test.tsx` — Button rendering, cycle execution, session log
- `BattleLogsTab.test.tsx` — Search, filtering (including tag team), pagination, battle selection
- `RobotStatsTab.test.tsx` — Attribute selection, stats display, outlier detection
- `BankruptcyMonitorTab.test.tsx` — At-risk users display, zero-state rendering
- `RecentUsersTab.test.tsx` — User list, onboarding status, issue detection
- `BattleDetailsModal.test.tsx` — 1v1 rendering, 2v2 tag team rendering, formula breakdowns

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bugs on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that render the current AdminPage and assert against the known bug conditions. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **Tab Count Test**: Render AdminPage, count tab buttons — expect 7 on unfixed code with `system-health` present (will confirm bug 1.1)
2. **Bankruptcy Tab Test**: Assert no `bankruptcy-monitor` tab exists (will confirm bug 1.2)
3. **Onboarding Link Test**: Assert the header contains a `<Link>` to `/admin/onboarding-analytics` (will confirm bug 1.3)
4. **Tag Team Filter Test**: Render Battle Logs tab, check filter options — expect no "Tag Team" option (will confirm bug 1.7)
5. **Test Suite Skip Test**: Read `AdminPage.test.tsx` and assert `describe.skip` is present (will confirm bug 1.5)
6. **Monolithic Component Test**: Assert AdminPage.tsx is a single component >2000 lines with no tab component imports (will confirm root cause for bug 1.5)

**Expected Counterexamples**:
- Tab bar has `system-health` instead of `bankruptcy-monitor`
- Bankruptcy section hidden when `usersAtRisk === 0`
- No "Tag Team" option in battle type filter
- `describe.skip` present in test file
- AdminPage.tsx contains all tab rendering inline

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := AdminPage_fixed(input)
  ASSERT expectedBehavior(result)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT AdminPage_original(input) = AdminPage_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for cycle controls, 1v1 battle viewing, robot stats, and session logging, then write property-based tests capturing that behavior.

**Test Cases**:
1. **1v1 Battle Display Preservation**: Verify that 1v1 battles continue to render identically with search, filtering, pagination, and visual indicators after the fix
2. **1v1 Modal Preservation**: Verify that opening a 1v1 battle details modal continues to show robot comparison, attributes, combat log, and formula breakdowns
3. **Cycle Controls Preservation**: Verify all cycle control buttons continue to call correct endpoints and update session log
4. **Robot Stats Preservation**: Verify attribute selection, statistical analysis, and all analytics sections continue working
5. **Tab Persistence Preservation**: Verify localStorage and URL hash tab persistence works with the new tab IDs

### Unit Tests

Per-component test files, each testing their tab component in isolation:

- `AdminPage.test.tsx` — 7-tab rendering, tab switching, URL hash persistence, localStorage persistence (shell only, tab components mocked)
- `DashboardTab.test.tsx` — Stats loading, grid rendering, System Health collapsible section expand/collapse, data fetch from `/api/analytics/*`
- `CycleControlsTab.test.tsx` — Button rendering, individual operations, bulk cycle runner, session log display
- `BattleLogsTab.test.tsx` — Search, league filtering, battle type filtering (including "Tag Team" option), pagination, battle row rendering with visual indicators, tag team battle "2v2" indicator
- `RobotStatsTab.test.tsx` — Attribute selection, stats display, outlier detection, win rate correlation, league comparison, top/bottom performers
- `BankruptcyMonitorTab.test.tsx` — At-risk users display with full detail, zero-state rendering ("No users at risk"), threshold display, loading state
- `RecentUsersTab.test.tsx` — User list rendering, onboarding status badges, robot table, issue detection, cycle range control
- `BattleDetailsModal.test.tsx` — 1v1 rendering unchanged, 2v2 tag team rendering with team layout, formula breakdowns, draw handling
- Backend: `GET /api/admin/battles` with `battleType=tagteam` returns tag team data with `battleFormat: '2v2'`
- Backend: `GET /api/admin/battles/:id` returns team data for tag team battles

### Property-Based Tests

- Generate random battle data (mix of 1v1 and 2v2) and verify the battle list correctly distinguishes and renders both formats
- Generate random `usersAtRisk` values (0 to N) and verify bankruptcy section is always rendered with correct content
- Generate random tab navigation sequences and verify tab persistence round-trips correctly through localStorage and URL hash
- Generate random tournament states and verify TournamentManagement renders without errors

### Integration Tests

- Test full admin workflow: load page → switch tabs → verify each tab component renders → switch back
- Test tag team battle flow: switch to Battle Logs → select "Tag Team" filter → verify tag team battles appear → open tag team battle details → verify 2v2 layout
- Test Recent Users flow: switch to Recent Users tab → verify user list loads → verify onboarding status badges → verify robot table
- Test Dashboard with System Health: load Dashboard → expand System Health section → verify performance/integrity data loads
- Test Bankruptcy Monitor flow: switch to Bankruptcy Monitor tab → verify at-risk data loads → verify zero-state when no users at risk
- Test tournament management: switch to Tournaments tab → list tournaments → view details → verify bracket rendering
