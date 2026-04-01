# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Admin Page Structural and Functional Defects
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bugs exist
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the 10 identified bugs exist
  - **Scoped PBT Approach**: Scope the property to concrete failing cases for each bug condition
  - Test 1: Render AdminPage, assert tab bar contains "Bankruptcy Monitor" tab (will FAIL — currently has "System Health" instead)
  - Test 2: Assert no `system-health` tab exists in the tab bar (will FAIL — it currently exists)
  - Test 3: Assert header does NOT contain a link to `/admin/onboarding-analytics` (will FAIL — link currently exists)
  - Test 4: Render Battle Logs filter dropdown, assert "Tag Team" option exists (will FAIL — only "All", "League", "Tournament" exist)
  - Test 5: Assert `AdminPage.test.tsx` does NOT contain `describe.skip` (will FAIL — entire suite is skipped)
  - Test 6: Assert separate tab component files exist in `components/admin/` directory (will FAIL — monolithic component)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct - it proves the bugs exist)
  - Document counterexamples found: system-health tab present, no bankruptcy-monitor tab, onboarding link in header, no tag team filter, describe.skip in test file, no component decomposition
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.7, 1.9_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Admin Functionality Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - **Observe on UNFIXED code**:
  - Observe: 1v1 battle list renders with search input, league filter dropdown, pagination controls, clickable robot names, and visual outcome indicators (winner highlighting, draw styling)
  - Observe: 1v1 BattleDetailsModal renders robot1 vs robot2 side-by-side comparison, attribute comparison grid, combat log with expandable formula breakdowns, and battle rewards section
  - Observe: Cycle Controls tab renders all operation buttons (Run Matchmaking, Execute Battles, Rebalance Leagues, Auto-Repair All, Process Daily Finances, bulk cycle runner) and session log with timestamps, color-coded types, clear/export functionality
  - Observe: Robot Stats tab renders attribute selector dropdown, statistical analysis cards, outlier detection, win rate correlation, league comparison, and top/bottom performers with clickable robot name links
  - Observe: Tab persistence works via localStorage (`adminActiveTab` key) and URL hash — switching tabs updates both, and page reload restores the last active tab
  - Observe: Session log maintains max 100 entries (FIFO), persists to localStorage (`adminSessionLog` key), and export-to-JSON creates a downloadable file
  - Write property-based tests using fast-check:
  - Property: For any 1v1 battle data shape, BattleDetailsModal renders robot1.name and robot2.name, attribute comparison for all attributes, and combat log events
  - Property: For any valid tab name in the current set, switching to that tab updates localStorage and URL hash, and reloading restores it
  - Property: For any session log entries (up to 100), the log persists to localStorage and can be exported as valid JSON
  - Verify all tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. Create shared types and admin component directory structure

  - [x] 3.1 Create `prototype/frontend/src/components/admin/types.ts` with shared interfaces
    - Extract `SystemStats`, `Battle`, `SessionLogEntry`, `RobotStats`, `AtRiskUser`, `AtRiskUsersResponse`, `RecentUser`, `RecentUsersResponse` interfaces from AdminPage.tsx
    - Add new `TagTeamBattle` interface with `battleFormat: '1v1' | '2v2'` field and team data shape
    - Export all types for use by tab components
    - _Requirements: 2.1_

  - [x] 3.2 Create `prototype/frontend/src/components/admin/index.ts` barrel export
    - Export all tab components from a single entry point
    - _Requirements: 2.1_

- [x] 4. Decompose AdminPage.tsx into tab components

  - [x] 4.1 Create `prototype/frontend/src/components/admin/DashboardTab.tsx`
    - Extract Dashboard tab rendering from AdminPage.tsx
    - Include system statistics grid with grouped sections (Robots, Battles, Economy, Facilities, Combat)
    - Absorb SystemHealthPage content as a collapsible `<details>` section at the bottom
    - Fetch from `/api/analytics/performance`, `/api/analytics/integrity`, `/api/analytics/logs/summary` for System Health data
    - Accept `stats: SystemStats | null` and `loading: boolean` as props
    - _Bug_Condition: isBugCondition(input) where input.type == 'PAGE_LOAD' AND hasTab('system-health')_
    - _Expected_Behavior: Dashboard integrates System Health as collapsible section, no standalone System Health tab_
    - _Preservation: Dashboard statistics grid continues to display all existing stats correctly_
    - _Requirements: 2.1, 2.9_

  - [x] 4.2 Create `prototype/frontend/src/components/admin/CycleControlsTab.tsx`
    - Extract Cycle Controls tab rendering from AdminPage.tsx
    - Include individual cycle control buttons (Run Matchmaking, Execute Battles, Rebalance Leagues, Auto-Repair All, Process Daily Finances)
    - Include bulk cycle runner with configuration options (autoRepair, includeTournaments, includeDailyFinances, generateUsersPerCycle)
    - Include session log display with clear/export functionality
    - Accept `addSessionLog`, `sessionLog`, `clearSessionLog`, `exportSessionLog` as props
    - _Preservation: All cycle control operations continue to execute correctly with session logging_
    - _Requirements: 3.1, 3.6_

  - [x] 4.3 Create `prototype/frontend/src/components/admin/BattleLogsTab.tsx`
    - Extract Battle Logs tab rendering from AdminPage.tsx
    - Include search input, league filter, battle type filter, pagination
    - Add "Tag Team" option to battle type filter dropdown: `<option value="tagteam">Tag Team Battles</option>`
    - Pass `battleType=tagteam` query parameter to backend when selected
    - Display `battleFormat` indicator ("1v1" or "2v2") on each battle row
    - Open BattleDetailsModal on battle row click
    - _Bug_Condition: isBugCondition(input) where input.type == 'VIEW_BATTLE_LOGS' AND input.wantsTagTeamBattles == true_
    - _Expected_Behavior: Tag Team filter option available, tag team battles visible with 2v2 indicator_
    - _Preservation: 1v1 battle display with search, filtering, pagination, clickable robot names, visual indicators unchanged_
    - _Requirements: 2.7, 3.2_

  - [x] 4.4 Create `prototype/frontend/src/components/admin/RobotStatsTab.tsx`
    - Extract Robot Stats tab rendering from AdminPage.tsx
    - Include attribute selector, statistical analysis, outlier detection, win rate correlation, league comparison, top/bottom performers
    - Maintain clickable robot name links
    - _Preservation: All robot stats analytics continue to display correctly_
    - _Requirements: 3.4_

  - [x] 4.5 Create `prototype/frontend/src/components/admin/BankruptcyMonitorTab.tsx`
    - Extract at-risk users functionality from Dashboard's conditional section into dedicated tab
    - Fetch from `GET /api/admin/users/at-risk` (or use existing stats endpoint)
    - Always render — when `totalAtRisk === 0`, show green "✓ No users at risk of bankruptcy" confirmation with threshold displayed
    - When users are at risk, show full detailed list with balance history, runway days, robot damage info
    - _Bug_Condition: isBugCondition(input) where input.type == 'CHECK_BANKRUPTCY' AND NOT hasTab('bankruptcy-monitor')_
    - _Expected_Behavior: Dedicated tab always accessible, always renders status even when 0 users at risk_
    - _Requirements: 2.2_

  - [x] 4.6 Create `prototype/frontend/src/components/admin/RecentUsersTab.tsx`
    - Extract Recent Users tab rendering from AdminPage.tsx
    - Include recent real users list with per-user onboarding status, robot details, issue detection
    - Include cycle range control for filtering
    - _Preservation: Recent users display continues to work correctly_
    - _Requirements: 2.10_

- [x] 5. Refactor AdminPage.tsx to thin shell

  - [x] 5.1 Reduce AdminPage.tsx to ~100-200 line shell
    - Update `TabType` to `'dashboard' | 'cycles' | 'tournaments' | 'battles' | 'stats' | 'bankruptcy-monitor' | 'recent-users'`
    - Remove `system-health` from tab list, add `bankruptcy-monitor`
    - Import and render tab components based on active tab
    - Keep tab navigation, URL hash persistence, localStorage persistence logic
    - Pass shared state (session log, addSessionLog, etc.) as props to tab components that need it
    - _Bug_Condition: Tab structure has system-health instead of bankruptcy-monitor_
    - _Expected_Behavior: 7 tabs — Dashboard, Cycle Controls, Tournaments, Battle Logs, Robot Stats, Bankruptcy Monitor, Recent Users_
    - _Requirements: 2.1, 3.5_

  - [x] 5.2 Remove onboarding analytics link from header
    - Remove `<Link to="/admin/onboarding-analytics">` button from the Admin Portal header
    - Remove the global Refresh Stats button (each tab manages its own refresh)
    - Keep only the "Admin Portal" heading
    - _Bug_Condition: isBugCondition(input) where input.type == 'CLICK_ONBOARDING_ANALYTICS'_
    - _Expected_Behavior: No link to /admin/onboarding-analytics in admin header_
    - _Requirements: 2.3_

- [x] 6. Backend: Extend battle endpoints for tag team support

  - [x] 6.1 Extend `GET /api/admin/battles` for tag team battles
    - In `prototype/backend/src/routes/admin.ts`, update the battles endpoint
    - When `battleType === 'tagteam'`, query `TagTeamMatch` joined with `Battle` and `TagTeam` (with robot relations)
    - When `battleType === 'all'`, union 1v1 battle results with tag team battle results
    - Return `battleFormat` field (`'1v1'` or `'2v2'`) in each battle record
    - Maintain existing 1v1 query behavior for `battleType === 'league'` and `battleType === 'tournament'`
    - _Bug_Condition: Backend only queries battle table, no tag team data returned_
    - _Expected_Behavior: Tag team battles returned with battleFormat: '2v2' when filtered_
    - _Preservation: Existing 1v1 battle queries unchanged for league/tournament filters_
    - _Requirements: 2.7, 3.7_

  - [x] 6.2 Extend `GET /api/admin/battles/:id` for tag team battle details
    - Detect if a battle has an associated `TagTeamMatch` record
    - When tag team data exists, return team data: team1 (activeRobot, reserveRobot), team2 (activeRobot, reserveRobot)
    - Return `battleFormat: '2v2'` field alongside standard battle data
    - Preserve existing 1v1 response shape when no tag team data exists
    - _Bug_Condition: Endpoint returns only 1v1 data shape, no team data for tag team battles_
    - _Expected_Behavior: Tag team battles include team member data in response_
    - _Preservation: 1v1 battle detail response unchanged_
    - _Requirements: 2.8, 3.3, 3.7_

- [x] 7. Frontend: Update BattleDetailsModal for tag team support

  - [x] 7.1 Add tag team detection and 2v2 rendering to BattleDetailsModal
    - In `prototype/frontend/src/components/BattleDetailsModal.tsx`
    - Add conditional check for `battleFormat === '2v2'` or presence of `teams` field
    - When tag team: render Team 1 (active + reserve robots) vs Team 2 (active + reserve robots) layout
    - Show team-level stats and individual robot stats per team member
    - Preserve existing 1v1 layout (robot1 vs robot2 side-by-side) for standard battles
    - _Bug_Condition: isBugCondition(input) where input.type == 'VIEW_BATTLE_DETAILS' AND battle.isTagTeam == true_
    - _Expected_Behavior: Modal detects tag team format, renders 2v2 team layout_
    - _Preservation: 1v1 modal rendering completely unchanged_
    - _Requirements: 2.8, 3.3_

- [x] 8. Frontend: Align TournamentManagement with current API contracts

  - [x] 8.1 Verify and update TournamentManagement.tsx
    - In `prototype/frontend/src/components/TournamentManagement.tsx`
    - Verify component works with current `tournamentApi.ts` contracts
    - `getTournamentDetails()` returns `{ tournament: TournamentDetails; seedings: SeedEntry[] }` where `TournamentDetails` includes `matches` (all rounds) and `currentRoundMatches` (derived client-side in tournamentApi.ts)
    - Ensure `activeTournament.currentRoundMatches` access works correctly (it's derived in `getTournamentDetails` from `tournament.matches.filter(m => m.round === tournament.currentRound)`)
    - Fix any property access mismatches between component and API response shapes
    - Test create tournament, view details, execute round flows
    - _Bug_Condition: tournamentApiContractsOutOfSync() — component may reference stale data shapes_
    - _Expected_Behavior: Tournament management works with current tournamentApi.ts contracts including seedings array_
    - _Requirements: 2.6_

- [x] 9. Write per-component test suite

  - [x] 9.1 Rewrite `prototype/frontend/src/pages/__tests__/AdminPage.test.tsx` as shell-only tests
    - Remove `describe.skip()` wrapper
    - Test only the AdminPage shell: 7 tabs rendered (Dashboard, Cycle Controls, Tournaments, Battle Logs, Robot Stats, Bankruptcy Monitor, Recent Users)
    - Test tab switching updates activeTab, localStorage, and URL hash
    - Test URL hash restoration on load
    - Test localStorage restoration on load
    - Mock all tab components
    - _Bug_Condition: describe.skip wraps entire test suite, 0 test coverage_
    - _Expected_Behavior: Tests run and pass, covering shell tab navigation and persistence_
    - _Requirements: 2.5_

  - [x] 9.2 Create `prototype/frontend/src/components/admin/__tests__/DashboardTab.test.tsx`
    - Test stats grid rendering with mock SystemStats data
    - Test System Health collapsible section expand/collapse
    - Test loading state
    - _Requirements: 2.5, 2.9_

  - [x] 9.3 Create `prototype/frontend/src/components/admin/__tests__/CycleControlsTab.test.tsx`
    - Test all cycle control buttons render
    - Test session log display with entries
    - Test clear and export session log functionality
    - _Requirements: 2.5, 3.1_

  - [x] 9.4 Create `prototype/frontend/src/components/admin/__tests__/BattleLogsTab.test.tsx`
    - Test search input, league filter, battle type filter (including "Tag Team" option)
    - Test pagination controls
    - Test battle row rendering with 1v1 and 2v2 indicators
    - _Requirements: 2.5, 2.7_

  - [x] 9.5 Create `prototype/frontend/src/components/admin/__tests__/RobotStatsTab.test.tsx`
    - Test attribute selector dropdown
    - Test stats display sections
    - _Requirements: 2.5, 3.4_

  - [x] 9.6 Create `prototype/frontend/src/components/admin/__tests__/BankruptcyMonitorTab.test.tsx`
    - Test at-risk users display with mock data
    - Test zero-state rendering ("✓ No users at risk of bankruptcy")
    - Test loading state
    - _Requirements: 2.5, 2.2_

  - [x] 9.7 Create `prototype/frontend/src/components/admin/__tests__/RecentUsersTab.test.tsx`
    - Test user list rendering with onboarding status badges
    - Test cycle range control
    - _Requirements: 2.5, 2.10_

  - [x] 9.8 Create `prototype/frontend/src/components/admin/__tests__/BattleDetailsModal.test.tsx`
    - Test 1v1 rendering: robot1 vs robot2 side-by-side, attribute comparison, combat log, formula breakdowns
    - Test 2v2 tag team rendering: team layout with active + reserve robots per side
    - Test draw handling
    - _Requirements: 2.5, 2.8, 3.3_

- [x] 10. Update documentation

  - [x] 10.1 Update `docs/prd_pages/PRD_ADMIN_PAGE.md`
    - Update tab structure to reflect 7 tabs (Dashboard, Cycle Controls, Tournaments, Battle Logs, Robot Stats, Bankruptcy Monitor, Recent Users)
    - Document System Health integration into Dashboard
    - Document Bankruptcy Monitor as dedicated tab
    - Document tag team battle support in Battle Logs
    - Remove references to standalone System Health tab
    - _Requirements: 2.1, 2.2, 2.7, 2.9_

  - [x] 10.2 Update `docs/guides/ADMIN_PANEL_GUIDE.md`
    - Update tab descriptions and navigation instructions
    - Add Bankruptcy Monitor tab usage guide
    - Add tag team battle filtering instructions
    - Document component architecture (thin shell + tab components)
    - Remove onboarding analytics link references
    - _Requirements: 2.1, 2.2, 2.3, 2.7_

- [x] 11. Fix implementation verification

  - [x] 11.1 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Admin Page Structural and Functional Defects Fixed
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.7, 2.9_

  - [x] 11.2 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing Admin Functionality Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 12. Checkpoint - Ensure all tests pass
  - Run full frontend test suite: `cd prototype/frontend && npx vitest --run`
  - Ensure all per-component tests pass
  - Ensure AdminPage shell tests pass
  - Ensure exploration tests (Property 1) pass
  - Ensure preservation tests (Property 2) pass
  - Ensure no `describe.skip` remains in any test file
  - Ask the user if questions arise
