# Implementation Plan: Tournament Bracket Seeding

## Overview

Transform the tournament viewing experience from a flat modal-based view into a full bracket visualization on a dedicated detail page. Backend modifications return all matches with seedings data; frontend adds a new detail page with bracket tree, seeding list, user highlighting, and mobile-responsive views. No database schema changes required.

## Tasks

- [ ] 1. Backend: Modify tournament detail API and add seedings computation
  - [x] 1.1 Export `generateStandardSeedOrder` from `tournamentService.ts` and implement `computeSeedings()`
    - Export the existing `generateStandardSeedOrder()` function so it can be used by the API route and tests
    - Export the existing `seedRobotsByELO()` function for test usage
    - Create and export a `computeSeedings(round1Matches, bracketSize)` function that:
      - Takes round-1 matches ordered by matchNumber and the bracket size (2^maxRounds)
      - Uses the inverse of `generateStandardSeedOrder(bracketSize)` to map bracket slot → seed number
      - Collects `{ seed, robotId, robotName, elo, eliminated }` for every non-null robot
      - Marks `eliminated: true` for any robot that lost a completed match (passed as parameter)
      - Returns the array sorted by seed ascending
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 1.2 Modify `GET /api/tournaments/:id` to return all matches and seedings
    - Remove the `where: { round: { lte: currentRound } }` filter so all matches across all rounds are returned
    - Include `robot1`, `robot2`, and `winner` relations on each match with `id`, `name`, `elo` fields
    - Order matches by `round ASC, matchNumber ASC`
    - Include `totalParticipants`, `maxRounds`, `currentRound`, `status` in the tournament response
    - Call `computeSeedings()` with round-1 matches and bracket size, include `seedings` array in response
    - Wrap seedings computation in try/catch — on failure, log error and return response without seedings (graceful degradation)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3_

  - [x] 1.3 Write property test: Seedings round-trip (Property 3)
    - **Property 3: Seedings round-trip — ELO ordering is preserved through bracket placement**
    - Generate random arrays of 4–128 robots with distinct random ELO values using fast-check
    - Run `seedRobotsByELO()` → `generateStandardSeedOrder()` → simulate round-1 match placement → `computeSeedings()`
    - Assert seedings sorted by seed ascending have strictly descending ELO values
    - Place test in `app/backend/src/__tests__/tournament-bracket-seeding.property.test.ts`
    - Tag: `Feature: tournament-bracket-seeding, Property 3: Seedings round-trip`
    - **Validates: Requirements 2.1, 2.2, 2.3**

  - [x] 1.4 Write property test: API returns all matches in correct order (Property 1)
    - **Property 1: API returns all matches across all rounds in correct order**
    - Generate random tournament match arrays with varying rounds and match numbers
    - Pass through the ordering logic and assert output is sorted by `(round ASC, matchNumber ASC)`
    - Place test in `app/backend/src/__tests__/tournament-bracket-seeding.property.test.ts`
    - Tag: `Feature: tournament-bracket-seeding, Property 1: API returns all matches in correct order`
    - **Validates: Requirements 1.1, 1.4**

  - [x] 1.5 Write property test: Round labels follow naming convention (Property 10)
    - **Property 10: Round labels follow naming convention**
    - Generate random `(round, maxRounds)` pairs where `1 <= round <= maxRounds` and `maxRounds >= 1`
    - Assert `getRoundLabel()` returns "Finals" when `round === maxRounds`, "Semi-finals" when `round === maxRounds - 1`, "Quarter-finals" when `round === maxRounds - 2`, and `"Round N"` otherwise
    - Place test in `app/backend/src/__tests__/tournament-bracket-seeding.property.test.ts`
    - Tag: `Feature: tournament-bracket-seeding, Property 10: Round labels follow naming convention`
    - **Validates: Requirements 7.1**

  - [x] 1.6 Write property test: Seed display threshold (Property 6)
    - **Property 6: Seed display threshold — top 32 seeds show number, others don't**
    - Generate random seed numbers (1–500) and robot names
    - Assert the seed display utility shows prefix for seeds ≤ 32 and omits it for seeds > 32
    - Place test in `app/backend/src/__tests__/tournament-bracket-seeding.property.test.ts`
    - Tag: `Feature: tournament-bracket-seeding, Property 6: Seed display threshold`
    - **Validates: Requirements 4.1, 4.2, 5.3, 5.4**

- [x] 2. Checkpoint - Ensure backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Frontend: Shared utilities and API client updates
  - [x] 3.1 Extract `getRoundLabel()` utility and create shared bracket helpers
    - Create `app/frontend/src/utils/bracketUtils.ts`
    - Extract `getRoundName()` from `TournamentsPage.tsx` into `getRoundLabel(round, maxRounds)` following the design spec naming convention
    - Implement `buildBracketTree(matches, maxRounds)` that organizes flat match array into `Map<number, TournamentMatchWithRobots[]>` keyed by round
    - Implement `formatSeedDisplay(seed: number, robotName: string)` that returns `"#N RobotName"` for seeds ≤ 32 and just `robotName` for seeds > 32
    - Implement `getUserFuturePath(matches, userRobotIds, maxRounds)` that computes the set of future match IDs the user's robot would play if it keeps winning
    - _Requirements: 7.1, 4.1, 4.2, 6.3_

  - [x] 3.2 Update `tournamentApi.ts` types and `getTournamentDetails()`
    - Add `SeedEntry` interface: `{ seed, robotId, robotName, elo, eliminated }`
    - Update `TournamentDetails` interface to include `seedings: SeedEntry[]`
    - Update `TournamentMatchWithRobots` type to include robot `elo` field and `winner` relation
    - Update `getTournamentDetails()` to pass through the `seedings` field from the API response
    - _Requirements: 1.2, 2.1_

  - [x] 3.3 Create `useMediaQuery` hook
    - Create `app/frontend/src/hooks/useMediaQuery.ts`
    - Simple hook wrapping `window.matchMedia` for responsive breakpoint detection
    - Export a convenience `useIsMobile()` that checks `(max-width: 768px)`
    - _Requirements: 9.1_

- [ ] 4. Frontend: Tournament Detail Page and routing
  - [x] 4.1 Create `TournamentDetailPage` component
    - Create `app/frontend/src/pages/TournamentDetailPage.tsx`
    - Route: `/tournaments/:id` — extract ID from URL params
    - Fetch tournament data via `tournamentApi.getTournamentDetails()`
    - Render header: tournament name, status badge, current round, total rounds, total participants, creation date
    - Display champion info prominently when tournament has a winner
    - Include back link to `/tournaments`
    - Show loading skeleton while fetching
    - Show error message with retry button on API failure
    - Show "Tournament not found" with link back to list on 404
    - Render `BracketView` as primary content using full page width
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 4.2 Add route for `/tournaments/:id` in the app router
    - Add `<Route path="/tournaments/:id" element={<TournamentDetailPage />} />` to the app's router configuration
    - Import `TournamentDetailPage` component
    - _Requirements: 8.1_

  - [x] 4.3 Modify `TournamentsPage` to navigate instead of opening modal
    - Replace `fetchTournamentDetails()` + modal with `navigate(`/tournaments/${id}`)`
    - Remove the modal JSX block entirely
    - Remove `selectedTournament`, `detailsLoading`, `matchesPage`, `matchesPerPage`, `showOnlyUserRobots` state variables
    - Keep the tournament list rendering, filter tabs, and stats overview unchanged
    - Update `getRoundName` to use the shared `getRoundLabel` utility from `bracketUtils.ts`
    - _Requirements: 8.1_

- [ ] 5. Frontend: Bracket visualization components
  - [x] 5.1 Create `BracketView` container component
    - Create `app/frontend/src/components/tournament/BracketView.tsx`
    - Accept tournament data (matches, seedings, maxRounds, currentRound, status, userRobotIds) as props
    - Use `useIsMobile()` hook to switch between `DesktopBracket` and `MobileBracket`
    - Manage zoom/pan state for large brackets on desktop
    - _Requirements: 3.1, 3.7, 9.1_

  - [x] 5.2 Create `DesktopBracket` component
    - Create `app/frontend/src/components/tournament/DesktopBracket.tsx`
    - CSS Grid layout: one column per round
    - Use `buildBracketTree()` to organize matches by round
    - Render `RoundColumn` for each round
    - Draw connector lines between match pairs using CSS pseudo-elements
    - Enable horizontal scrolling via `overflow-x: auto`
    - Enable pinch-to-zoom/pan when round-1 matches > 64 using CSS `transform: scale()` with wheel and touch event handlers
    - _Requirements: 3.1, 3.2, 3.7, 9.5_

  - [x] 5.3 Create `RoundColumn` component
    - Create `app/frontend/src/components/tournament/RoundColumn.tsx`
    - Render round label using `getRoundLabel()` ("Round N", "Quarter-finals", "Semi-finals", "Finals")
    - Contain `MatchCard` components for that round, vertically spaced so round N+1 matches align between their feeder matches
    - Visually distinguish current round column with accent border/background when tournament is active
    - _Requirements: 7.1, 7.2, 3.2_

  - [x] 5.4 Create `MatchCard` component
    - Create `app/frontend/src/components/tournament/MatchCard.tsx`
    - Display two robot slots with the following states:
      - Completed: winner name in green/bold, loser dimmed
      - Pending (two robots assigned): both names neutral + "Pending" indicator
      - Placeholder (null robots): "TBD" for both slots
      - Bye: advancing robot name + "Bye" label
    - Show seed number prefix `#N` for seeds 1–32 using `formatSeedDisplay()`
    - Apply highlight border when match contains user's robot
    - Apply subtle future-path indicator for user's potential future matches
    - _Requirements: 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 6.1, 6.2, 6.3, 6.4_

  - [x] 5.5 Create `SeedingList` panel component
    - Create `app/frontend/src/components/tournament/SeedingList.tsx`
    - Collapsible side panel listing all participants by seed number ascending
    - Show seed number for top 32, robot name, and ELO for each entry
    - Omit seed number prefix for seeds > 32
    - Strikethrough/dimmed styling for eliminated robots
    - Highlight user's own robots with distinct visual style
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 6. Checkpoint - Ensure bracket renders correctly
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Frontend: Mobile bracket views
  - [x] 7.1 Create `MobileBracket` component
    - Create `app/frontend/src/components/tournament/MobileBracket.tsx`
    - Two view modes: "My Path" and "Round List" with toggle between them
    - Default to "My Path" if user has a robot in the tournament, otherwise default to "Round List"
    - _Requirements: 9.1, 9.4_

  - [x] 7.2 Implement "My Path" view within `MobileBracket`
    - Show only matches involving the user's robot(s) in a vertical timeline
    - Include connected future-path matches
    - _Requirements: 9.2_

  - [x] 7.3 Implement "Round List" view within `MobileBracket`
    - Display one round at a time with prev/next navigation controls
    - Allow collapsing and expanding individual rounds to manage screen space
    - Default view when user has no robot in the tournament
    - _Requirements: 9.3, 9.6_

- [ ] 8. Frontend: User robot highlighting and path tracing
  - [x] 8.1 Implement user robot path highlighting in `DesktopBracket`
    - Fetch user's robot IDs and pass to bracket components
    - Apply distinct highlight style (colored border) to every `MatchCard` containing user's robot
    - Visually trace the path of completed matches leading to user's current position
    - Apply subtle indicator to future match slots the robot would play if it keeps winning (using `getUserFuturePath()`)
    - Highlight all user robots if multiple participate
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 8.2 Write property test: User robot match highlighting (Property 8)
    - **Property 8: User robot matches are highlighted in bracket**
    - Generate random match data and random user robot ID sets using fast-check
    - Assert highlight class is applied if and only if the match contains a user robot
    - Place test in `app/frontend/src/__tests__/tournament-bracket-seeding.property.test.ts`
    - Tag: `Feature: tournament-bracket-seeding, Property 8: User robot match highlighting`
    - **Validates: Requirements 6.1, 6.2, 6.4**

  - [x] 8.3 Write property test: Bracket renders correct structure (Property 4)
    - **Property 4: Bracket renders correct structure per round**
    - Generate random tournament data with 1–7 rounds using fast-check
    - Render bracket utility and assert correct number of round columns and match cards per round
    - Place test in `app/frontend/src/__tests__/tournament-bracket-seeding.property.test.ts`
    - Tag: `Feature: tournament-bracket-seeding, Property 4: Bracket renders correct structure`
    - **Validates: Requirements 3.1, 3.2**

- [x] 9. Checkpoint - Ensure all frontend components work together
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Final integration and wiring
  - [x] 10.1 Wire `TournamentDetailPage` end-to-end
    - Ensure `TournamentDetailPage` fetches data, passes seedings and user robot IDs to `BracketView`
    - Ensure `BracketView` correctly delegates to `DesktopBracket` or `MobileBracket` based on viewport
    - Ensure `SeedingList` panel is rendered alongside the bracket
    - Verify navigation from `TournamentsPage` list → `TournamentDetailPage` → back to list works
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 10.2 Write unit tests for key components
    - Test `MatchCard` renders "TBD" for placeholder matches (Req 3.5)
    - Test `MatchCard` renders "Bye" label for bye matches (Req 3.6)
    - Test `MatchCard` renders "Pending" for pending matches with two robots (Req 3.4)
    - Test `MatchCard` seed display (yellow #N for ≤32, hidden for >32)
    - Test `MatchCard` user robot highlighting (blue border, ring, YOU badge)
    - Test `MatchCard` dimmed and highlighted states
    - Test `MatchCard` data-robot1-id / data-robot2-id attributes
    - Test `SeedingList` top 32 limit, user robots section, click-to-scroll, collapse/expand
    - Test `TournamentDetailPage` shows error + retry on API failure (Req 8.5)
    - Test `TournamentDetailPage` shows champion info when winner exists (Req 8.6)
    - Test `TournamentDetailPage` shows 404 state, loading skeleton, header info
    - Test `computeSeedings()` with a known 8-robot tournament for exact seed assignments
    - Test `computeSeedings()` with bye matches (5 robots in 8-slot bracket)
    - Backend tests in `app/backend/tests/compute-seedings.unit.test.ts`
    - Frontend tests in `app/frontend/src/__tests__/tournament-components.unit.test.tsx`
    - _Requirements: 3.4, 3.5, 3.6, 8.5, 8.6, 2.1, 2.3_

- [x] 11. Final checkpoint - Ensure all tests pass
  - All 54 frontend tests pass (19 bracketUtils + 3 property + 32 component unit)
  - All 15 backend tests pass (4 property + 11 computeSeedings unit)

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- No database schema changes are needed — all data already exists in Tournament and TournamentMatch tables
- The design uses TypeScript throughout (backend Express + Prisma, frontend React + Tailwind)
