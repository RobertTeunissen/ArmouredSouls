# Requirements Document

## Introduction

This feature allows players to view other users' stables, providing competitive intelligence and community engagement. A stable view shows the target user's robots (public performance data), facilities (levels and types), and stable-level statistics (prestige, championship titles). Sensitive data such as exact attribute levels, battle configuration (stance, yield threshold, loadout), equipped weapons, and current combat state remain hidden to preserve competitive strategy. All stables are publicly viewable.

## Glossary

- **Stable**: A player's account and collection of robots, facilities, and resources
- **Stable_View_Page**: The frontend page that displays another user's stable information at `/stables/:userId`
- **Stable_API**: The backend API endpoint that returns public stable data for a given user
- **Viewer**: The authenticated user requesting to see another user's stable
- **Target_User**: The user whose stable is being viewed
- **Public_Robot_Data**: Robot information visible to non-owners (name, ELO, league, win/loss record, fame, image, total battles, kills, damage lifetime stats)
- **Sensitive_Robot_Data**: Robot information hidden from non-owners (23 core attributes, stance, yield threshold, loadout type, equipped weapons, current HP/shield)
- **Facility_Summary**: The list of a user's facilities with their current levels

## Expected Contribution

This spec delivers the first social/scouting feature in Armoured Souls, enabling players to view other users' stables. Currently there is no way to inspect another player's stable, facilities, or robot roster outside of the limited data shown on leaderboard tables.

1. **New social feature**: Before — no way to view another player's stable, robots, or facilities. After — dedicated `/stables/:userId` page showing public stable data, robots, and facility levels.
2. **New backend endpoint**: Before — 0 stable-viewing API endpoints. After — 1 new `GET /api/stables/:userId` endpoint returning aggregated public stable data in a single request.
3. **Cross-page navigation**: Before — owner names on League Standings, Leaderboards, Hall of Records, and Tag Team Standings are plain text. After — owner names are clickable links to the stable view page (4+ pages updated).
4. **Sensitive data protection**: Before — the `SENSITIVE_ROBOT_FIELDS` array in `robots.ts` already strips attributes/config from non-owner robot views. After — the new stable endpoint reuses this sanitization, ensuring 23 core attributes, battle config, and combat state are never exposed.
5. **Frontend component**: Before — 0 stable view components. After — 1 new `StableViewPage` component with robot cards, facility summary, and aggregate statistics sections.

### Verification Criteria

1. `curl -H "Authorization: Bearer <token>" http://localhost:3001/api/stables/<userId>` returns 200 with `robots`, `facilities`, and `stats` fields
2. `curl -H "Authorization: Bearer <token>" http://localhost:3001/api/stables/999999` returns 404 with `"User not found"` message
3. `grep -r "SENSITIVE_ROBOT_FIELDS" prototype/backend/src/routes/stables.ts` confirms the new route uses the existing sanitization
4. `grep -rn "/stables/" prototype/frontend/src/pages/LeagueStandingsPage.tsx` confirms owner names link to stable view
5. `grep -rn "StableViewPage" prototype/frontend/src/App.tsx` confirms the route is registered
6. Response from `GET /api/stables/:userId` does not contain any of: `combatPower`, `targetingSystems`, `stance`, `yieldThreshold`, `loadoutType`, `mainWeaponId`, `currentHP`, `currentShield`

## Requirements

### Requirement 1: View Another User's Stable

**User Story:** As a player, I want to view another user's stable page, so that I can scout opponents and learn about other players in the game.

#### Acceptance Criteria

1. WHEN the Viewer navigates to `/stables/:userId`, THE Stable_View_Page SHALL display the Target_User's public stable information
2. THE Stable_API SHALL return the stable data to any authenticated Viewer
3. THE Stable_View_Page SHALL display the Target_User's stable name (or username as fallback), prestige, prestige rank title, and championship titles
4. WHEN the Viewer views their own stable via `/stables/:userId`, THE Stable_View_Page SHALL display the same public view (no special owner treatment on this page)

### Requirement 2: Display Target User's Robots

**User Story:** As a player, I want to see the robots belonging to another user's stable, so that I can assess their competitive strength.

#### Acceptance Criteria

1. THE Stable_API SHALL return a list of the Target_User's robots with Public_Robot_Data only
2. THE Stable_View_Page SHALL display each robot using a variant of the existing `RobotDashboardCard` component (`prototype/frontend/src/components/RobotDashboardCard.tsx`) that shows the robot's image, name, ELO rating, current league, league points, and win/draw/loss record with win rate percentage
3. THE robot card variant SHALL additionally display fame, fame tier, total battles, kills, lifetime damage dealt, and lifetime damage taken
4. THE robot card variant SHALL omit owner-only information: HP bar, shield bar, battle readiness badge, and weapon details
5. THE Stable_API SHALL exclude all Sensitive_Robot_Data (23 core attributes, stance, yield threshold, loadout type, equipped weapon IDs, current HP, current shield, damage taken) from the response
6. THE Stable_View_Page SHALL sort robots by ELO rating in descending order
7. WHEN a robot card is clicked, THE Stable_View_Page SHALL navigate to the robot detail page at `/robots/:robotId`

### Requirement 3: Display Target User's Facilities

**User Story:** As a player, I want to see another user's facility levels, so that I can understand their stable's infrastructure investment.

#### Acceptance Criteria

1. THE Stable_API SHALL return the Target_User's facility list with facility type, name, and current level for each facility
2. THE Stable_View_Page SHALL display all facilities grouped by category (Economy and Discounts, Capacity and Storage, Training Academies, Advanced Features)
3. THE Stable_View_Page SHALL show each facility's name, current level, and max level
4. THE Stable_View_Page SHALL display a progress indicator (e.g., "Level 5/10") for each facility
5. THE Stable_View_Page SHALL NOT display upgrade costs, operating costs, or upgrade buttons (read-only view)

### Requirement 4: Display Stable-Level Statistics

**User Story:** As a player, I want to see aggregate statistics for another user's stable, so that I can evaluate their overall performance.

#### Acceptance Criteria

1. THE Stable_API SHALL return aggregated stable statistics computed from the Target_User's robots
2. THE Stable_View_Page SHALL display total battles (sum across all robots), total wins, total losses, total draws, and overall win rate
3. THE Stable_View_Page SHALL display the Target_User's highest ELO across all robots
4. THE Stable_View_Page SHALL display the total number of active robots in the stable
5. THE Stable_View_Page SHALL display the Target_User's prestige value and corresponding prestige rank title (Novice, Established, Veteran, Elite, Champion, Legendary)

### Requirement 5: Stable API Endpoint

**User Story:** As a developer, I want a dedicated API endpoint for fetching another user's public stable data, so that the frontend can render the stable view page.

#### Acceptance Criteria

1. THE Stable_API SHALL expose a `GET /api/stables/:userId` endpoint that requires authentication
2. WHEN the Target_User does not exist, THE Stable_API SHALL return a 404 response with the message "User not found"
3. THE Stable_API SHALL return the response within 500ms for a stable with 10 robots and 15 facilities
4. THE Stable_API SHALL validate the `userId` parameter as a positive integer using Zod schema validation

### Requirement 6: Navigation to Stable View

**User Story:** As a player, I want to navigate to another user's stable from existing pages, so that I can easily discover and view other stables.

#### Acceptance Criteria

1. WHEN a robot owner name is displayed on the League Standings page, THE League_Standings_Page SHALL render the owner name as a clickable link to `/stables/:userId`
2. WHEN a robot owner name is displayed on the Leaderboards pages (prestige, fame), THE Leaderboard_Pages SHALL render the owner name as a clickable link to `/stables/:userId`
3. WHEN a robot owner name is displayed on the Hall of Records page, THE Hall_of_Records_Page SHALL render the owner name as a clickable link to `/stables/:userId`
4. WHEN a team owner name is displayed on the Tag Team Standings page, THE Tag_Team_Standings_Page SHALL render the owner name as a clickable link to `/stables/:userId`
5. THE Stable_View_Page SHALL include a "Back" navigation button to return to the previous page

### Requirement 7: Mobile Responsiveness

**User Story:** As a player on a mobile device, I want the stable view page to be fully usable on smaller screens, so that I can scout opponents from any device.

#### Acceptance Criteria

1. THE Stable_View_Page SHALL use a responsive layout that adapts to mobile viewports (320px and above)
2. THE Stable_View_Page SHALL stack robot cards in a single column on mobile and use a grid layout on wider screens
3. THE robot cards SHALL remain readable and tappable on mobile, with touch-friendly tap targets (minimum 44px)
4. THE facility summary section SHALL stack vertically on mobile instead of using a multi-column layout
5. THE stable statistics section SHALL reflow into a compact layout on mobile without horizontal scrolling

### Requirement 8: Empty and Error States

**User Story:** As a player, I want clear feedback when a stable cannot be loaded, so that I understand what happened.

#### Acceptance Criteria

1. WHEN the Stable_API returns a 404 (user not found), THE Stable_View_Page SHALL display "Stable not found" with a link back to the previous page
2. WHEN the Stable_API returns a network error, THE Stable_View_Page SHALL display "Failed to load stable. Please try again." with a retry button
3. WHILE the Stable_API request is in progress, THE Stable_View_Page SHALL display a loading indicator
4. WHEN the Target_User has zero robots, THE Stable_View_Page SHALL display "This stable has no robots yet" in the robots section
