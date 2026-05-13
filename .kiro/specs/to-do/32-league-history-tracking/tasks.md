# Implementation Plan: League History Tracking

## Overview

This plan implements persistent tracking of all league tier changes (promotions and demotions) for robots and tag teams. It covers the database model, backend service, API endpoints, integration into rebalancing services, admin dashboard, player-facing visualizations, yo-yo detection, Ctrl+Z achievement support, and property-based tests.

## Tasks

- [x] 1. Database schema and migration
  - [x] 1.1 Add LeagueHistory model to Prisma schema
    - Add the `LeagueHistory` model to `app/backend/prisma/schema.prisma` after the `AdminAuditLog` model
    - Include all fields: id, entityType, entityId, userId, changeType, sourceTier, destinationTier, sourceLeagueId, destinationLeagueId, leaguePoints, cycleNumber, createdAt
    - Add `@@index([entityType, entityId])` for per-entity queries
    - Add `@@index([cycleNumber])` for cycle-range queries
    - Add `@@index([userId])` for user history queries
    - Add `@@map("league_history")` for table naming
    - Add `leagueHistory LeagueHistory[]` relation to the User model
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - [x] 1.2 Generate and run Prisma migration
    - Run `npx prisma migrate dev --name add_league_history` to create the migration
    - Run `npx prisma generate` to regenerate the Prisma client
    - Verify the migration creates the `league_history` table with all three indexes
    - _Requirements: 1.1, 1.4, 1.5_

- [x] 2. League history service implementation
  - [x] 2.1 Create leagueHistoryService.ts with types and recordTierChange
    - Create `app/backend/src/services/league/leagueHistoryService.ts`
    - Define types: `EntityType`, `ChangeType`, `RecordTierChangeParams`, `LeagueHistoryRecord`, `LeagueHistoryQueryParams`, `AggregateResult`, `YoYoCandidate`, `CtrlZResult`
    - Implement `recordTierChange` — wraps Prisma create in try/catch, logs errors via logger, never re-throws
    - Implement `getCurrentCycleNumber` helper that reads from `CycleMetadata`
    - _Requirements: 1.1, 1.2, 1.3, 2.4, 3.4_
  - [x] 2.2 Implement query functions
    - Implement `getHistoryByCycleRange` with pagination (page, perPage, total, totalPages)
    - Implement `getEntityHistory` returning records ordered by cycleNumber ascending
    - Implement `getAggregates` returning promotion/demotion counts grouped by tier
    - Validate startCycle ≤ endCycle, return 400 error with descriptive message if invalid
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  - [x] 2.3 Implement yo-yo detection
    - Implement `detectYoYoCandidates` — identifies entities with 3+ tier changes within a configurable cycle window
    - Accept `cycleWindow` (default 20) and `minChanges` (default 3) parameters
    - Return entity name, type, change count, and tiers involved
    - _Requirements: 10.1_
  - [x] 2.4 Implement Ctrl+Z achievement query
    - Implement `checkCtrlZ` — accepts robotId, tierName, maxCycleWindow
    - Returns `{ found: true, demotionCycle, promotionCycle }` if a demotion from the tier followed by re-promotion to the same tier exists within the window
    - Returns `{ found: false }` otherwise
    - _Requirements: 11.1, 11.2, 11.3_
  - [x] 2.5 Write property-based tests for leagueHistoryService
    - Create `app/backend/src/services/league/__tests__/leagueHistoryService.property.test.ts`
    - **Property 1: Robot promotion recording completeness** — generate random robots in non-champion tiers, verify record fields match expectations
    - **Property 2: Robot demotion recording completeness** — generate random robots in non-bronze tiers, verify record fields match expectations
    - **Property 3: Tag team tier change recording completeness** — generate random tag teams, verify entityType, changeType, userId fields
    - **Property 4: Non-blocking recording on failure** — mock Prisma create to throw, verify tier change still completes
    - **Property 5: Cycle range query filtering** — generate random records and ranges, verify all returned records fall within range
    - **Property 6: Query result ordering** — generate random records for an entity, verify ascending cycleNumber order
    - **Property 7: Cycle range validation** — generate random integer pairs, verify rejection iff start > end
    - **Property 8: Aggregate count correctness** — generate records, compute expected aggregates manually, compare with service output
    - **Property 9: Yo-yo detection correctness** — generate sequences with known yo-yo patterns, verify detection accuracy
    - **Property 10: Ctrl+Z detection correctness** — generate sequences with/without Ctrl+Z patterns, verify detection
    - Use fast-check with minimum 100 iterations per property
    - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 10.1, 11.1, 11.2, 11.3_

- [x] 3. Integrate recording into rebalancing services
  - [x] 3.1 Integrate into promoteRobot and demoteRobot
    - In `app/backend/src/services/league/leagueRebalancingService.ts`, import `recordTierChange` from `leagueHistoryService`
    - In `promoteRobot`: after `prisma.robot.update`, call `recordTierChange` with entityType "robot", changeType "promotion", sourceTier = robot.currentLeague, destinationTier = nextTier, sourceLeagueId = robot.leagueId, destinationLeagueId = newLeagueId, leaguePoints = robot.leaguePoints, cycleNumber from getCurrentCycleNumber
    - In `demoteRobot`: same pattern with changeType "demotion", destinationTier = previousTier
    - Wrap each call in try/catch that logs errors but does not re-throw
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4_
  - [x] 3.2 Integrate into promoteTeam and demoteTeam
    - In `app/backend/src/services/tag-team/tagTeamLeagueRebalancingService.ts`, import `recordTierChange`
    - In `promoteTeam`: after the team update, call `recordTierChange` with entityType "tag_team", userId = team.stableId
    - In `demoteTeam`: same pattern with changeType "demotion"
    - Wrap each call in try/catch that logs errors but does not re-throw
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 4. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Admin API endpoints
  - [x] 5.1 Add admin league history routes
    - In `app/backend/src/routes/admin.ts`, add four new endpoints:
    - `GET /api/admin/league-history` — paginated tier changes by cycle range (query params: startCycle, endCycle, entityType, page, perPage)
    - `GET /api/admin/league-history/aggregates` — promotion/demotion counts by tier (query params: startCycle, endCycle, entityType)
    - `GET /api/admin/league-history/entity/:entityType/:entityId` — full history for one entity
    - `GET /api/admin/league-history/yo-yo` — yo-yo detection candidates (query params: cycleWindow, minChanges)
    - Add Zod schemas for all query/param validation using `positiveIntParam` and `validateRequest`
    - Return 400 with descriptive message for invalid cycle ranges
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 10.1_
  - [x] 5.2 Write unit tests for admin league history endpoints
    - Create `app/backend/src/routes/__tests__/adminLeagueHistory.test.ts`
    - Test Zod schema validation (invalid cycle range, missing params, non-integer values)
    - Test pagination boundary conditions
    - Test entity type filtering
    - Test 403 for non-admin users
    - _Requirements: 5.1, 5.5, 5.6_

- [x] 6. Public API endpoints
  - [x] 6.1 Add robot league history endpoint
    - In `app/backend/src/routes/robots.ts`, add `GET /api/robots/:id/league-history`
    - Requires authentication (any authenticated user can query any robot)
    - Validate robot exists (return 404 if not found)
    - Return `{ data: LeagueHistoryRecord[] }` ordered by cycleNumber ascending
    - Add Zod schema for the `:id` param
    - _Requirements: 8.4, 8.5_
  - [x] 6.2 Add tag team league history endpoint
    - In `app/backend/src/routes/tagTeams.ts` (or equivalent), add `GET /api/tag-teams/:id/league-history`
    - Requires authentication (any authenticated user can query any tag team)
    - Validate tag team exists (return 404 if not found)
    - Return `{ data: LeagueHistoryRecord[] }` ordered by cycleNumber ascending
    - Add Zod schema for the `:id` param
    - _Requirements: 9.4, 9.5_
  - [x] 6.3 Write unit tests for public endpoints
    - Create `app/backend/src/routes/__tests__/leagueHistoryPublic.test.ts`
    - Test robot endpoint returns ordered history
    - Test tag team endpoint returns ordered history
    - Test 404 for non-existent entities
    - Test authentication requirement (401 for unauthenticated)
    - _Requirements: 8.4, 8.5, 9.4, 9.5_

- [x] 7. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Shared LeagueTimeline component
  - [x] 8.1 Create LeagueTimeline React component
    - Create `app/frontend/src/components/LeagueTimeline.tsx`
    - Accept props: `history: LeagueHistoryEntry[]`, `currentTier: string`, `emptyMessage?: string`
    - Use Recharts `LineChart` with `type="stepAfter"` for discrete tier transitions
    - Y-axis: fixed domain of 6 tiers (bronze=1 to champion=6) with custom tick formatter
    - X-axis: cycle numbers from history data
    - Custom dot renderer: green for promotions, red for demotions
    - Tooltip: shows tier name, LP, cycle number, and change type
    - Empty state: centered message when history array is empty
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6, 8.2, 8.3, 8.6, 9.2, 9.3, 9.6_
  - [x] 8.2 Write Vitest tests for LeagueTimeline
    - Create `app/frontend/src/components/__tests__/LeagueTimeline.test.tsx`
    - Test renders correctly with mock history data
    - Test shows empty state message when history is empty
    - Test tier ordering (bronze at bottom, champion at top)
    - Test promotion/demotion visual indicators
    - _Requirements: 7.2, 7.4, 7.6, 8.2, 8.3, 8.6_

- [x] 9. Admin League History page
  - [x] 9.1 Create AdminLeagueHistoryPage component
    - Create `app/frontend/src/pages/admin/LeagueHistoryPage.tsx`
    - Include summary cards showing total promotions/demotions for most recent cycle
    - Include filter bar with cycle range inputs and entity type dropdown
    - Include per-tier breakdown grid showing promotion/demotion counts per tier
    - Include paginated events table with columns: Entity Name, Type, Change, From → To, LP, Cycle
    - Include timeline slide-over panel that opens when a row is clicked, showing LeagueTimeline for that entity
    - Include yo-yo candidates section at bottom
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.1, 7.5, 10.2, 10.3_
  - [x] 9.2 Register admin route and navigation
    - In `app/frontend/src/App.tsx`: add lazy import for `AdminLeagueHistoryPage` and add route `<Route path="league-history" element={<AdminLeagueHistoryPage />} />`
    - In `app/frontend/src/components/admin/AdminLayout.tsx`: add nav entry under "Battle Data" group: `{ label: 'League History', path: '/admin/league-history', icon: '📈' }`
    - Add PAGE_TITLES entry: `'/admin/league-history': 'League History'`
    - _Requirements: 6.7_
  - [x] 9.3 Write Vitest tests for AdminLeagueHistoryPage
    - Create `app/frontend/src/pages/admin/__tests__/LeagueHistoryPage.test.tsx`
    - Test renders all sections with mock API responses
    - Test filter interactions trigger correct API calls
    - Test pagination controls work correctly
    - Test yo-yo candidates section renders
    - Test timeline panel opens on row click
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 10.2, 10.3_

- [x] 10. Robot detail page League History tab
  - [x] 10.1 Add League History tab to RobotDetailPage
    - In `app/frontend/src/pages/RobotDetailPage.tsx`, add a "League History" tab to the existing tab navigation
    - Tab content fetches from `GET /api/robots/:id/league-history`
    - Renders the `LeagueTimeline` component with the robot's history
    - Shows empty state message if no history exists
    - Viewable by any authenticated player for any robot
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_
  - [x] 10.2 Write Vitest tests for robot League History tab
    - Create or extend tests in `app/frontend/src/pages/__tests__/RobotDetailPage.test.tsx`
    - Test tab renders and fetches data
    - Test empty state when no history
    - Test timeline renders with mock data
    - _Requirements: 8.1, 8.2, 8.6_

- [x] 11. Tag team page League History section
  - [x] 11.1 Add League History expandable section to tag team page
    - In `app/frontend/src/pages/TagTeamManagementPage.tsx`, add a "League History" expandable section
    - When expanded, fetches from `GET /api/tag-teams/:id/league-history`
    - Renders the `LeagueTimeline` component with the tag team's history
    - Shows empty state message if no history exists
    - Viewable by any authenticated player for any tag team
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_
  - [x] 11.2 Write Vitest tests for tag team League History section
    - Create or extend tests in `app/frontend/src/pages/__tests__/TagTeamManagementPage.test.tsx`
    - Test expandable section renders
    - Test fetches data on expand
    - Test empty state when no history
    - _Requirements: 9.1, 9.2, 9.6_

- [x] 12. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Documentation updates
  - [x] 13.1 Update project-overview.md steering file
    - In `.kiro/steering/project-overview.md`, add "League History Tracking" to the Key Systems list under League System (or as item 12)
    - Mention: persistent tier change tracking, admin analytics dashboard, player-facing timeline visualizations, yo-yo detection, achievement data support
    - _Requirements: 6.7, 8.1, 9.1_
  - [x] 13.2 Update BACKLOG.md
    - In `docs/BACKLOG.md`, mark item #22 (Promotion/Demotion History Tracking) as "specced" with reference to spec #32
    - _Requirements: 6.7_
  - [x] 13.3 Update audit-logging-schema.md
    - In `app/backend/docs/audit-logging-schema.md`, add the `league_history` table schema documentation
    - Document all columns, indexes, and the entityType discriminator pattern
    - _Requirements: 1.1, 1.4, 1.5_

- [x] 14. Final verification
  - [x] 14.1 Run verification criteria from requirements
    - Run `npx prisma db pull --print | grep -c "league_history"` — verify returns ≥1
    - Run `grep -r "LeagueHistory" app/backend/src/services/league/ app/backend/src/services/tag-team/` — verify matches in both services
    - Run `grep -r "league-history" app/frontend/src/pages/admin/` — verify matches
    - Run `grep -r "league-history\|LeagueHistory" app/frontend/src/pages/` — verify matches in admin and robot detail locations
    - Verify admin endpoint responds: `GET /api/admin/league-history?startCycle=1&endCycle=100`
    - Verify public robot endpoint responds: `GET /api/robots/1/league-history`
    - Verify public tag team endpoint responds: `GET /api/tag-teams/1/league-history`
    - Run `npm test -- --testPathPattern="leagueHistory"` — verify all league history tests pass
    - _Requirements: 1.1, 1.4, 1.5, 2.1, 3.1, 4.1, 5.1, 6.7, 8.1, 8.5, 9.1, 9.5_

## Notes

- All tasks are mandatory — no optional tasks
- Each task references specific requirement acceptance criteria for traceability
- Property-based tests use fast-check with 100+ iterations per property
- The LeagueTimeline component is shared across admin, robot detail, and tag team pages
- Recording is non-blocking: failures are logged but never prevent promotions/demotions
- Checkpoints ensure incremental validation throughout implementation
