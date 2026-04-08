# Implementation Plan: View Other Stables

## Overview

Implement a public stable viewing system: a new backend endpoint (`GET /api/stables/:userId`), a new frontend page (`StableViewPage`), a public variant of `RobotDashboardCard`, an `OwnerNameLink` component, and navigation links from 4+ existing pages. The design uses a single API call returning robots, facilities, and stats, reuses `sanitizeRobotForPublic` for sensitive data stripping, and computes aggregate stats server-side.

## Tasks

- [x] 1. Extract shared prestige/fame utilities
  - [x] 1.1 Create `prototype/backend/src/utils/prestigeUtils.ts`
    - Extract `getPrestigeRank` and `getFameTier` functions from `prototype/backend/src/routes/leaderboards.ts` into a new shared utility file
    - Export both functions so they can be imported by `leaderboards.ts` and the new `stables.ts` route
    - _Requirements: 4.5, 1.3_
  - [x] 1.2 Update `prototype/backend/src/routes/leaderboards.ts` to import from `prestigeUtils.ts`
    - Remove the local `getPrestigeRank` and `getFameTier` function definitions
    - Replace with imports from `../utils/prestigeUtils`
    - Verify existing leaderboard endpoints still function correctly
    - _Requirements: 4.5_
  - [x] 1.3 Write property test for prestige rank mapping (Property 4)
    - Create or extend `prototype/backend/tests/prestigeUtils.property.test.ts`
    - **Property 4: Prestige rank mapping correctness**
    - For any non-negative integer prestige value, verify `getPrestigeRank` returns the correct rank per the threshold table (Novice < 1000, Established < 5000, Veteran < 10000, Elite < 25000, Champion < 50000, Legendary ≥ 50000)
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 4.5, 1.3**


- [x] 2. Implement the stable API endpoint
  - [x] 2.1 Create `prototype/backend/src/routes/stables.ts` with `GET /:userId`
    - Apply `authenticateToken` middleware for authentication
    - Validate `userId` param with Zod `positiveIntParam` via `validateRequest` middleware
    - Query User with robots (excluding Bye Robot, ordered by ELO desc) and facilities using Prisma `select`/`include`
    - Return 404 with `"User not found"` when user does not exist
    - Sanitize each robot via `sanitizeRobotForPublic` imported from `robots.ts`
    - Compute aggregate stats server-side: totalBattles, totalWins, totalLosses, totalDraws, winRate, highestElo, activeRobots
    - Compute `prestigeRank` via `getPrestigeRank` from `prestigeUtils.ts`
    - Return response shape: `{ user, robots, facilities, stats }` as defined in design
    - Ensure response does not contain any sensitive fields (combatPower, targetingSystems, stance, yieldThreshold, loadoutType, mainWeaponId, currentHP, currentShield, etc.)
    - Ensure the same response is returned regardless of whether the viewer is the target user or a different user
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.5, 2.6, 3.1, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4_
  - [x] 2.2 Register the stables route in `prototype/backend/src/index.ts`
    - Import the stables router and add `app.use('/api/stables', stablesRoutes)` alongside existing route registrations
    - _Requirements: 5.1_
  - [x] 2.3 Write unit tests for the stables endpoint in `prototype/backend/tests/stables.test.ts`
    - Test 404 for non-existent user
    - Test 401 for unauthenticated request
    - Test 400 for invalid userId (negative, zero, float, non-numeric)
    - Test correct response shape for a user with robots and facilities
    - Test empty robots array for user with no robots
    - Test Bye Robot is excluded from response
    - Test that no sensitive robot fields appear in the response
    - Test that owner viewing own stable gets identical response to another viewer
    - _Requirements: 1.1, 1.2, 1.4, 2.1, 2.5, 4.1, 5.1, 5.2, 5.4, 8.4_
  - [x] 2.4 Write property test for sensitive field stripping on stable endpoint (Property 1)
    - Create `prototype/backend/tests/stableSanitization.property.test.ts`
    - **Property 1: Sensitive field stripping on stable endpoint**
    - For any robot object with all fields populated, after `sanitizeRobotForPublic`, no key from `SENSITIVE_ROBOT_FIELDS` shall be present
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 2.1, 2.5**
  - [x] 2.5 Write property test for robot list sorted by ELO descending (Property 2)
    - Add to `prototype/backend/tests/stableSanitization.property.test.ts`
    - **Property 2: Robot list sorted by ELO descending**
    - For any array of robots with random ELO values, after sorting by ELO desc, each robot's ELO shall be ≥ the next robot's ELO
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 2.6**
  - [x] 2.6 Write property test for stable statistics aggregation (Property 3)
    - Add to `prototype/backend/tests/stableSanitization.property.test.ts`
    - **Property 3: Stable statistics aggregation correctness**
    - For any set of robot stat objects, verify totalBattles = sum of all robots' totalBattles, totalWins = sum of wins, totalLosses = sum of losses, totalDraws = sum of draws, highestElo = max elo (or 0 if empty), activeRobots = count
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
  - [x] 2.7 Write property test for userId parameter validation (Property 5)
    - Add to `prototype/backend/tests/stableSanitization.property.test.ts`
    - **Property 5: userId parameter validation rejects invalid inputs**
    - For any string that is not a positive integer representation, the Zod `positiveIntParam` schema shall reject it
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 5.4**
  - [x] 2.8 Write property test for owner vs non-owner consistency (Property 6)
    - Add to `prototype/backend/tests/stableSanitization.property.test.ts` or `stables.test.ts`
    - **Property 6: Owner and non-owner receive identical stable response**
    - Verify that the endpoint returns the same response shape and data regardless of whether the authenticated user matches the target userId
    - **Validates: Requirements 1.4**


- [x] 3. Checkpoint — Backend complete
  - Ensure all backend tests pass (`cd prototype/backend && npm test`), ask the user if questions arise.

- [x] 4. Implement the public robot card variant
  - [x] 4.1 Add `variant` prop to `RobotDashboardCard` in `prototype/frontend/src/components/RobotDashboardCard.tsx`
    - Add `variant?: 'owner' | 'public'` to `RobotDashboardCardProps` interface
    - Add optional public-only fields to the robot prop type: `fame`, `kills`, `damageDealtLifetime`, `damageTakenLifetime`
    - Default variant to `'owner'` to preserve existing behavior
    - When `variant === 'public'`: hide HP bar, shield bar, `BattleReadinessBadge`, weapon details
    - When `variant === 'public'`: show fame, fame tier badge, total battles, kills, lifetime damage dealt, lifetime damage taken
    - Ensure the card remains clickable and navigates to `/robots/:robotId`
    - Ensure touch-friendly tap targets (minimum 44px) for mobile
    - _Requirements: 2.2, 2.3, 2.4, 2.7, 7.3_
  - [x] 4.2 Write unit tests for `RobotDashboardCard` variants in `prototype/frontend/src/components/__tests__/RobotDashboardCard.test.tsx`
    - Test public variant renders fame, fame tier, kills, lifetime damage dealt, lifetime damage taken
    - Test public variant does NOT render HP bar, battle readiness badge, weapon info
    - Test owner variant (default) still renders HP bar, battle readiness badge
    - Test card click navigates to `/robots/:id`
    - _Requirements: 2.2, 2.3, 2.4, 2.7_

- [x] 5. Create the OwnerNameLink component and update navigation pages
  - [x] 5.1 Create `prototype/frontend/src/components/OwnerNameLink.tsx`
    - Accept props: `userId: number`, `displayName: string`, `className?: string`
    - Render a React Router `<Link>` to `/stables/:userId`
    - Style consistently with existing link patterns in the app
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [x] 5.2 Update `prototype/frontend/src/pages/LeagueStandingsPage.tsx`
    - Replace plain-text owner names with `<OwnerNameLink>` component linking to `/stables/:userId`
    - _Requirements: 6.1_
  - [x] 5.3 Update `prototype/frontend/src/pages/LeaderboardsPrestigePage.tsx`
    - Replace plain-text stable names with `<OwnerNameLink>` component linking to `/stables/:userId`
    - _Requirements: 6.2_
  - [x] 5.4 Update `prototype/frontend/src/pages/LeaderboardsFamePage.tsx`
    - Replace plain-text stable names with `<OwnerNameLink>` component linking to `/stables/:userId`
    - _Requirements: 6.2_
  - [x] 5.5 Update `prototype/frontend/src/pages/LeaderboardsLossesPage.tsx`
    - Replace plain-text stable names with `<OwnerNameLink>` component linking to `/stables/:userId`
    - _Requirements: 6.2_
  - [x] 5.6 Update `prototype/frontend/src/pages/HallOfRecordsPage.tsx`
    - Replace plain-text owner names with `<OwnerNameLink>` component linking to `/stables/:userId`
    - _Requirements: 6.3_
  - [x] 5.7 Update `prototype/frontend/src/pages/TagTeamStandingsPage.tsx`
    - Replace plain-text owner names with `<OwnerNameLink>` component linking to `/stables/:userId`
    - _Requirements: 6.4_


- [x] 6. Implement the StableViewPage
  - [x] 6.1 Create `prototype/frontend/src/pages/StableViewPage.tsx`
    - Fetch `GET /api/stables/:userId` with auth token on mount
    - Render stable header section: username/stable name, prestige value, prestige rank title, championship titles
    - Render stable statistics section: total battles, total wins, total losses, total draws, win rate, highest ELO, active robots count
    - Render robots section: grid of `RobotDashboardCard` components with `variant="public"`, sorted by ELO desc
    - Render facilities section: grouped by 4 categories (Economy & Discounts, Capacity & Storage, Training Academies, Advanced Features), each showing facility name, current level, and "Level X/Y" progress indicator
    - Facilities section must NOT display upgrade costs, operating costs, or upgrade buttons (read-only)
    - Include a "Back" navigation button to return to the previous page
    - Display loading indicator while API request is in progress
    - Display "Stable not found" with back link on 404 response
    - Display "Failed to load stable. Please try again." with retry button on network error
    - Display "This stable has no robots yet" when robots array is empty
    - _Requirements: 1.1, 1.3, 2.2, 2.6, 3.2, 3.3, 3.4, 3.5, 4.2, 4.3, 4.4, 4.5, 6.5, 8.1, 8.2, 8.3, 8.4_
  - [x] 6.2 Register the StableViewPage route in `prototype/frontend/src/App.tsx`
    - Import `StableViewPage` and add a `<Route path="/stables/:userId" ...>` wrapped in `<ProtectedRoute>`
    - _Requirements: 1.1_
  - [x] 6.3 Implement responsive layout for StableViewPage
    - Use responsive Tailwind classes: single-column robot cards on mobile (< 640px), grid on wider screens
    - Stack facility summary vertically on mobile, multi-column on wider screens
    - Reflow statistics section into compact layout on mobile without horizontal scrolling
    - Support viewports from 320px and above
    - _Requirements: 7.1, 7.2, 7.4, 7.5_
  - [x] 6.4 Write property test for facility category grouping (Property 7)
    - Create `prototype/frontend/src/pages/__tests__/StableViewPage.property.test.ts`
    - **Property 7: Facility category grouping completeness**
    - For any facility type from the known set of 15 types, the category mapping function shall assign it to exactly one of the four categories, and no type shall be left ungrouped
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 3.2**
  - [x] 6.5 Write unit tests for StableViewPage in `prototype/frontend/src/pages/__tests__/StableViewPage.test.tsx`
    - Test renders loading state while fetching
    - Test renders 404 error state with "Stable not found" and back link
    - Test renders network error state with "Failed to load stable. Please try again." and retry button
    - Test renders "This stable has no robots yet" when robots array is empty
    - Test renders stable header with username, prestige, prestige rank title, championship titles
    - Test renders stable statistics (total battles, wins, losses, draws, win rate, highest ELO, active robots)
    - Test renders facility groups with level progress indicators ("Level X/Y")
    - Test robot cards navigate to `/robots/:id` on click
    - Test back button navigates to previous page
    - _Requirements: 1.1, 1.3, 3.2, 3.3, 3.4, 4.2, 4.3, 4.4, 4.5, 6.5, 8.1, 8.2, 8.3, 8.4_

- [x] 7. Checkpoint — Frontend complete
  - Ensure all frontend tests pass (`cd prototype/frontend && npx vitest --run`), ask the user if questions arise.


- [x] 8. Documentation updates
  - [x] 8.1 Create `docs/prd_pages/PRD_STABLE_VIEW_PAGE.md`
    - Document the stable view page: purpose, route, sections (header, stats, robots, facilities), error states, responsive behavior
    - Follow the format of existing PRD page docs (e.g., `PRD_DASHBOARD_PAGE.md`)
    - _Requirements: 1.1, 2.2, 3.2, 4.2, 7.1, 8.1_
  - [x] 8.2 Update `docs/prd_core/ARCHITECTURE.md`
    - Add `/api/stables` to the API Routes table (21 → 22 route files)
    - Add `StableViewPage` to the Frontend Pages list (27 → 28 pages)
    - _Requirements: 5.1_
  - [x] 8.3 Update `docs/guides/MODULE_STRUCTURE.md`
    - Add the `stables.ts` route to the backend route listing
    - Add `StableViewPage` to the frontend pages listing if applicable
    - _Requirements: 5.1_

- [x] 9. Final verification
  - Run all verification criteria from the requirements document:
    - `curl -H "Authorization: Bearer <token>" http://localhost:3001/api/stables/<userId>` returns 200 with `robots`, `facilities`, and `stats` fields
    - `curl -H "Authorization: Bearer <token>" http://localhost:3001/api/stables/999999` returns 404 with `"User not found"` message
    - `grep -r "SENSITIVE_ROBOT_FIELDS" prototype/backend/src/routes/stables.ts` confirms the new route uses the existing sanitization (via `sanitizeRobotForPublic` import)
    - `grep -rn "/stables/" prototype/frontend/src/pages/LeagueStandingsPage.tsx` confirms owner names link to stable view
    - `grep -rn "StableViewPage" prototype/frontend/src/App.tsx` confirms the route is registered
    - Response from `GET /api/stables/:userId` does not contain any of: `combatPower`, `targetingSystems`, `stance`, `yieldThreshold`, `loadoutType`, `mainWeaponId`, `currentHP`, `currentShield`
  - Ensure all backend tests pass: `cd prototype/backend && npm test`
  - Ensure all frontend tests pass: `cd prototype/frontend && npx vitest --run`
  - Ask the user if questions arise.

## Requirements Traceability Matrix

| Requirement | Acceptance Criteria | Covered By Tasks |
|---|---|---|
| 1. View Another User's Stable | 1.1 Navigate to `/stables/:userId` displays stable | 2.1, 6.1, 6.2 |
| | 1.2 Any authenticated viewer can access | 2.1, 2.3 |
| | 1.3 Display stable name, prestige, rank title, titles | 1.1, 2.1, 6.1 |
| | 1.4 Own stable shows same public view | 2.1, 2.3, 2.8 |
| 2. Display Target User's Robots | 2.1 Return Public_Robot_Data only | 2.1, 2.3, 2.4 |
| | 2.2 Robot card shows image, name, ELO, league, LP, W/D/L, win rate | 4.1, 6.1 |
| | 2.3 Card shows fame, fame tier, total battles, kills, damage | 4.1, 4.2 |
| | 2.4 Card omits HP bar, shield bar, readiness, weapons | 4.1, 4.2 |
| | 2.5 Exclude all Sensitive_Robot_Data | 2.1, 2.3, 2.4 |
| | 2.6 Sort robots by ELO descending | 2.1, 2.5, 6.1 |
| | 2.7 Robot card click navigates to `/robots/:robotId` | 4.1, 4.2 |
| 3. Display Target User's Facilities | 3.1 Return facility type, name, level | 2.1 |
| | 3.2 Group by 4 categories | 6.1, 6.4 |
| | 3.3 Show name, current level, max level | 6.1, 6.5 |
| | 3.4 Show progress indicator "Level X/Y" | 6.1, 6.5 |
| | 3.5 No upgrade costs/buttons (read-only) | 6.1 |
| 4. Display Stable-Level Statistics | 4.1 Return aggregated stats | 2.1, 2.6 |
| | 4.2 Display total battles, wins, losses, draws, win rate | 2.1, 6.1, 6.5 |
| | 4.3 Display highest ELO | 2.1, 6.1, 6.5 |
| | 4.4 Display active robots count | 2.1, 6.1, 6.5 |
| | 4.5 Display prestige value and rank title | 1.1, 2.1, 6.1, 6.5 |
| 5. Stable API Endpoint | 5.1 GET /api/stables/:userId requires auth | 2.1, 2.2, 2.3 |
| | 5.2 404 for non-existent user | 2.1, 2.3 |
| | 5.3 Response within 500ms for 10 robots/15 facilities | 2.1 |
| | 5.4 Validate userId as positive integer via Zod | 2.1, 2.3, 2.7 |
| 6. Navigation to Stable View | 6.1 League Standings owner name links | 5.2 |
| | 6.2 Leaderboards owner name links | 5.3, 5.4, 5.5 |
| | 6.3 Hall of Records owner name links | 5.6 |
| | 6.4 Tag Team Standings owner name links | 5.7 |
| | 6.5 Back navigation button | 6.1, 6.5 |
| 7. Mobile Responsiveness | 7.1 Responsive layout 320px+ | 6.3 |
| | 7.2 Single column robots on mobile, grid on wider | 6.3 |
| | 7.3 Touch-friendly tap targets (44px min) | 4.1 |
| | 7.4 Facilities stack vertically on mobile | 6.3 |
| | 7.5 Stats reflow compact on mobile | 6.3 |
| 8. Empty and Error States | 8.1 404 shows "Stable not found" + back link | 6.1, 6.5 |
| | 8.2 Network error shows retry button | 6.1, 6.5 |
| | 8.3 Loading indicator during fetch | 6.1, 6.5 |
| | 8.4 Zero robots shows empty message | 2.3, 6.1, 6.5 |
