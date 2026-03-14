# Requirements Document

## Introduction

This feature adds tournament bracket visualization and seeding display to the Armoured Souls tournament system. The bracket data already exists in the database (all rounds are generated upfront with `TournamentMatch` records). The current UI only shows a flat list of current-round matches in a modal. This feature replaces that with a proper bracket view on a dedicated tournament detail page showing the full tournament tree, seed rankings, defeated opponents, and possible future opponents. The backend API needs minor adjustments to return all matches (not just current round) with robot details, and the frontend needs a bracket component that renders the single-elimination tree structure. Only the top 32 seeds are prominently displayed with seed numbers to make them stand out.

## Glossary

- **Bracket_View**: A visual tree representation of all matches in a single-elimination tournament, organized by rounds from left to right, showing match connections between rounds
- **Seed_Number**: A robot's ranking position in the tournament based on ELO at tournament creation time, where seed 1 is the highest-rated robot. Only the top 32 seeds have their seed number displayed in the UI
- **Bracket_Component**: The React component responsible for rendering the tournament bracket tree on the frontend
- **Tournament_API**: The backend endpoint `GET /api/tournaments/:id` that returns tournament data including matches and robot details
- **Match_Card**: A UI element within the Bracket_View that displays a single match with both robots, their seed numbers (for top 32 seeds only), and the match result
- **Seeding_List**: A ranked list of all tournament participants ordered by their seed number, displayed alongside or within the bracket
- **Round_Column**: A vertical column in the Bracket_View representing all matches in a single round (e.g., Round 1, Quarter-finals, Semi-finals, Finals)
- **Tournament_Detail_Page**: A dedicated full-page view at `/tournaments/:id` that displays the Bracket_View and all tournament information
- **Tournament_List_Page**: The existing `/tournaments` page that displays a list of tournaments with summary information

## Requirements

### Requirement 1: Return Full Bracket Data from API

**User Story:** As a player, I want the tournament details API to return all matches across all rounds with robot details, so that the frontend can render the complete bracket.

#### Acceptance Criteria

1. WHEN a client requests `GET /api/tournaments/:id`, THE Tournament_API SHALL return all TournamentMatch records for the tournament across all rounds, ordered by round ascending then matchNumber ascending
2. WHEN a client requests `GET /api/tournaments/:id`, THE Tournament_API SHALL include robot1, robot2, and winner relations with each match, including each robot's id, name, and elo fields
3. WHEN a TournamentMatch has null robot1Id or robot2Id (placeholder future-round match), THE Tournament_API SHALL return null for the corresponding robot relation
4. THE Tournament_API SHALL include the tournament's totalParticipants, maxRounds, currentRound, and status fields in the response

### Requirement 2: Compute and Return Seed Numbers

**User Story:** As a player, I want to see each robot's seed number in the tournament, so that I can understand the seeding and relative strength of competitors.

#### Acceptance Criteria

1. WHEN a client requests `GET /api/tournaments/:id`, THE Tournament_API SHALL return a seedings array containing each participating robot's id, name, elo, and seed number (1-based rank by descending ELO at tournament entry)
2. THE Tournament_API SHALL derive seed numbers from the round-1 matches and the bracket position algorithm, assigning seed 1 to the highest-ELO robot and incrementing sequentially
3. WHEN a robot received a bye in round 1, THE Tournament_API SHALL still include that robot in the seedings array with the correct seed number

### Requirement 3: Display Tournament Bracket Tree

**User Story:** As a player, I want to see a visual bracket tree of the entire tournament, so that I can follow the progression from round 1 through the finals.

#### Acceptance Criteria

1. THE Bracket_Component SHALL render one Round_Column per round, arranged horizontally from round 1 on the left to the finals on the right
2. THE Bracket_Component SHALL render one Match_Card per TournamentMatch within each Round_Column, vertically positioned so that each match in round N+1 aligns between its two feeder matches from round N
3. WHEN a match is completed, THE Match_Card SHALL highlight the winning robot's name with a distinct visual style (green text or bold) and dim the losing robot
4. WHEN a match has not yet been played and has two assigned robots, THE Match_Card SHALL display both robot names in a neutral style with a "Pending" indicator
5. WHEN a match is a placeholder (future round with null robots), THE Match_Card SHALL display "TBD" placeholders for both robot slots
6. WHEN a match is a bye match, THE Match_Card SHALL display the advancing robot's name and a "Bye" label instead of an opponent
7. THE Bracket_Component SHALL support horizontal scrolling when the bracket exceeds the viewport width

### Requirement 4: Display Seed Numbers on Match Cards for Top 32 Seeds

**User Story:** As a player, I want to see seed numbers next to the top-seeded robots in the bracket, so that I can quickly identify the strongest competitors without cluttering every match card.

#### Acceptance Criteria

1. WHEN a robot's Seed_Number is 32 or lower (seeds 1 through 32), THE Match_Card SHALL display the Seed_Number as a prefix label next to the robot's name (e.g., "#1 RobotName")
2. WHEN a robot's Seed_Number is greater than 32, THE Match_Card SHALL display only the robot's name without a seed number prefix
3. WHEN a robot's seed number is not available (future-round placeholder), THE Match_Card SHALL display only the "TBD" placeholder without a seed number

### Requirement 5: Display Seeding List with Top 32 Highlighted

**User Story:** As a player, I want to see a ranked list of all tournament participants by seed, so that I can understand the full seeding order at a glance.

#### Acceptance Criteria

1. THE Bracket_View SHALL include a Seeding_List panel that displays all tournament participants ranked by Seed_Number from 1 to totalParticipants
2. EACH entry in the Seeding_List SHALL display the robot name and ELO rating at tournament entry
3. WHEN a robot's Seed_Number is 32 or lower (seeds 1 through 32), THE Seeding_List SHALL display the seed number alongside the robot name and ELO
4. WHEN a robot's Seed_Number is greater than 32, THE Seeding_List SHALL display the robot name and ELO without a seed number prefix
5. WHEN a robot has been eliminated from the tournament, THE Seeding_List SHALL visually indicate elimination status (e.g., strikethrough or dimmed text)
6. WHEN a robot is the user's own robot, THE Seeding_List SHALL highlight that entry with a distinct visual style

### Requirement 6: Highlight User's Robot Path Through Bracket

**User Story:** As a player, I want my robot's matches highlighted in the bracket, so that I can easily track my progress, see defeated opponents, and identify possible future opponents.

#### Acceptance Criteria

1. WHEN the user has a robot participating in the tournament, THE Bracket_Component SHALL apply a distinct highlight style (e.g., colored border) to every Match_Card containing that robot
2. WHEN the user has a robot participating in the tournament, THE Bracket_Component SHALL visually trace the path of completed matches leading to the user's robot's current position
3. WHEN the user's robot is still active in the tournament, THE Bracket_Component SHALL apply a subtle indicator to the match slots the robot would play in future rounds if the robot continues to win
4. WHEN the user has multiple robots in the tournament, THE Bracket_Component SHALL highlight all of them with the same distinct style

### Requirement 7: Round Labels

**User Story:** As a player, I want each round column labeled with a meaningful name, so that I can understand the tournament stage.

#### Acceptance Criteria

1. THE Bracket_Component SHALL display a label above each Round_Column using contextual names: "Finals" for the last round (1 round remaining), "Semi-finals" when 2 rounds remain, "Quarter-finals" when 3 rounds remain, and "Round N" for all earlier rounds
2. WHEN the tournament is active, THE Bracket_Component SHALL visually distinguish the current round column from past and future rounds (e.g., brighter background or border accent)

### Requirement 8: Tournament Detail Page Navigation

**User Story:** As a player, I want to navigate to a dedicated tournament detail page when I click on a tournament, so that the bracket view has a full page to work with.

#### Acceptance Criteria

1. WHEN a user clicks on a tournament in the Tournament_List_Page, THE Tournament_List_Page SHALL navigate to the Tournament_Detail_Page at `/tournaments/:id` instead of opening a modal
2. THE Tournament_Detail_Page SHALL display the tournament name, status, current round, total rounds, total participants, and creation date
3. THE Tournament_Detail_Page SHALL render the Bracket_View as the primary content area, using the full page width
4. THE Tournament_Detail_Page SHALL include a navigation link back to the Tournament_List_Page
5. IF the tournament data fails to load, THEN THE Tournament_Detail_Page SHALL display an error message with a retry option
6. WHEN the tournament has a winner, THE Tournament_Detail_Page SHALL display the champion information prominently

### Requirement 9: Mobile Responsiveness for Large Brackets

**User Story:** As a player on a mobile device, I want to view large tournament brackets in a usable way, so that I can follow the tournament on any screen size.

#### Acceptance Criteria

1. WHEN the viewport width is below 768px, THE Bracket_Component SHALL display a simplified mobile-friendly layout instead of the full horizontal bracket tree
2. WHEN in mobile view, THE Bracket_Component SHALL provide a "My Path" focused view that shows only the matches involving the user's robot and the connected bracket path, reducing visual clutter
3. WHEN in mobile view and the user has no robot in the tournament, THE Bracket_Component SHALL default to a round-by-round list view that displays one round at a time with navigation controls to switch between rounds
4. WHEN in mobile view, THE Bracket_Component SHALL allow the user to switch between the focused path view and the round-by-round list view
5. WHEN in desktop view with a large bracket (more than 64 matches in round 1), THE Bracket_Component SHALL support pinch-to-zoom and pan gestures for navigating the bracket
6. WHEN in mobile view, THE Bracket_Component SHALL allow collapsing and expanding individual rounds in the list view to manage screen space
