# Requirements Document

## Introduction

This feature adds persistent tracking of all league tier changes (promotions and demotions) for both robots and tag teams. Every time a robot or tag team moves between tiers during the rebalancing phase, an event record is stored with relevant metadata. This data powers an admin analytics dashboard showing system-wide promotion/demotion activity, an individual entity timeline visualization showing a robot's or tag team's journey through the tiers, and enables the future L15 "Ctrl+Z" achievement (get demoted and re-promoted in the same league within 10 cycles).

## Glossary

- **League_History_Service**: The backend service responsible for recording and querying promotion/demotion events
- **League_History_Record**: A single database row representing one tier change event (promotion or demotion) for a robot or tag team
- **Admin_League_History_Page**: The admin portal page displaying system-wide promotion/demotion analytics and individual entity timelines
- **Timeline_Visualization**: A visual component showing an entity's progression through league tiers over time
- **Rebalancing_Phase**: Step 7 of the game cycle where promotions and demotions are executed
- **League_Tier**: One of bronze, silver, gold, platinum, diamond, or champion
- **Entity**: A robot or tag team that participates in league competition
- **Cycle_Number**: The game cycle during which a tier change occurred

## Expected Contribution

This spec addresses backlog item #22 (Promotion/Demotion History Tracking) — currently no audit trail exists for league tier changes, making it impossible to analyze league health, detect yo-yo patterns, or implement progression-based achievements.

1. **Before**: 0 historical records of tier changes; promotions/demotions are fire-and-forget with only a log line. **After**: Every tier change persisted with full metadata (entity, tiers, LP, cycle, instance IDs) — queryable for analytics and achievements.
2. **Before**: No admin visibility into league movement patterns across cycles. **After**: Dedicated admin dashboard page with per-tier breakdowns, cycle-range filtering, and paginated event table.
3. **Before**: No way to visualize a robot's league journey over time. **After**: Step-chart timeline visualization showing tier progression with promotion/demotion indicators and LP tooltips.
4. **Before**: No detection of robots oscillating between tiers (yo-yo pattern). **After**: Automated yo-yo detection endpoint identifying entities with 3+ tier changes in a configurable cycle window.
5. **Before**: L15 "Ctrl+Z" achievement (demoted and re-promoted within 10 cycles) is unimplementable — no history data exists. **After**: Query method available for achievement evaluation.
6. **Before**: Tag team tier changes have no history tracking. **After**: Tag team promotions/demotions tracked with identical fidelity to robot tier changes.

### Verification Criteria

After all tasks are complete, run these checks to confirm the spec delivered:

1. `npx prisma db pull --print | grep -c "league_history"` — returns ≥1 (table exists in DB)
2. `grep -r "LeagueHistory" app/backend/src/services/league/ app/backend/src/services/tag-team/` — returns matches in both rebalancing services (recording is wired in)
3. `grep -r "league-history" app/frontend/src/pages/admin/` — returns matches (admin page exists)
4. `grep -r "league-history\|LeagueHistory" app/frontend/src/pages/` — returns matches in both admin and robot detail page locations
5. `curl -s localhost:3000/api/admin/league-history?startCycle=1&endCycle=100 -H "Authorization: Bearer $TOKEN" | jq '.data | length'` — returns 0 or more (admin endpoint responds)
6. `curl -s localhost:3000/api/robots/1/league-history -H "Authorization: Bearer $TOKEN" | jq '.data | length'` — returns 0 or more (public robot endpoint responds)
7. `curl -s localhost:3000/api/tag-teams/1/league-history -H "Authorization: Bearer $TOKEN" | jq '.data | length'` — returns 0 or more (public tag team endpoint responds)
8. `npm test -- --testPathPattern="leagueHistory" --passWithNoTests` — all league history tests pass
9. Run 1 bulk cycle with ≥10 robots in a league instance with ≥5 cycles tenure → verify `league_history` table has new rows

## Requirements

### Requirement 1: League History Data Model

**User Story:** As a system administrator, I want all promotion and demotion events persisted in the database, so that I can query historical tier changes for analytics and achievement evaluation.

#### Acceptance Criteria

1. THE League_History_Record SHALL store the entity type (robot or tag_team), entity ID, change type (promotion or demotion), source tier, destination tier, league points at time of change, cycle number, and timestamp
2. WHEN a League_History_Record is created, THE League_History_Service SHALL associate the record with the owning user via a foreign key relationship
3. THE League_History_Record SHALL store the league instance IDs for both the source and destination instances
4. THE Database SHALL index League_History_Records by entity type and entity ID for efficient per-entity queries
5. THE Database SHALL index League_History_Records by cycle number for efficient cycle-based queries

### Requirement 2: Recording Promotion Events

**User Story:** As a system administrator, I want every robot promotion automatically recorded, so that no tier change goes untracked.

#### Acceptance Criteria

1. WHEN the Rebalancing_Phase promotes a robot, THE League_History_Service SHALL create a League_History_Record with change type "promotion", the robot's current tier as source, and the next tier as destination
2. WHEN the Rebalancing_Phase promotes a robot, THE League_History_Service SHALL capture the robot's league points at the moment of promotion
3. WHEN the Rebalancing_Phase promotes a robot, THE League_History_Service SHALL capture the current cycle number from the game cycle context
4. IF the League_History_Service fails to record a promotion event, THEN THE League_History_Service SHALL log the error and allow the promotion to proceed without blocking

### Requirement 3: Recording Demotion Events

**User Story:** As a system administrator, I want every robot demotion automatically recorded, so that I can track downward tier movements.

#### Acceptance Criteria

1. WHEN the Rebalancing_Phase demotes a robot, THE League_History_Service SHALL create a League_History_Record with change type "demotion", the robot's current tier as source, and the previous tier as destination
2. WHEN the Rebalancing_Phase demotes a robot, THE League_History_Service SHALL capture the robot's league points at the moment of demotion
3. WHEN the Rebalancing_Phase demotes a robot, THE League_History_Service SHALL capture the current cycle number from the game cycle context
4. IF the League_History_Service fails to record a demotion event, THEN THE League_History_Service SHALL log the error and allow the demotion to proceed without blocking

### Requirement 4: Recording Tag Team Tier Changes

**User Story:** As a system administrator, I want tag team promotions and demotions tracked with the same fidelity as robot tier changes, so that tag team league analytics are equally complete.

#### Acceptance Criteria

1. WHEN the Rebalancing_Phase promotes a tag team, THE League_History_Service SHALL create a League_History_Record with entity type "tag_team" and change type "promotion"
2. WHEN the Rebalancing_Phase demotes a tag team, THE League_History_Service SHALL create a League_History_Record with entity type "tag_team" and change type "demotion"
3. WHEN recording a tag team tier change, THE League_History_Service SHALL store the tag team's league points at the moment of the change
4. WHEN recording a tag team tier change, THE League_History_Service SHALL store the stable (user) ID as the owner reference

### Requirement 5: League History Query API

**User Story:** As a frontend developer, I want API endpoints to query league history data, so that I can build admin dashboards and visualizations.

#### Acceptance Criteria

1. THE League_History_Service SHALL expose an admin-only endpoint to retrieve all tier changes within a specified cycle range, with pagination
2. THE League_History_Service SHALL expose an admin-only endpoint to retrieve the complete tier change history for a specific robot, ordered by cycle number ascending
3. THE League_History_Service SHALL expose an admin-only endpoint to retrieve the complete tier change history for a specific tag team, ordered by cycle number ascending
4. THE League_History_Service SHALL expose an admin-only endpoint to retrieve aggregate promotion/demotion counts grouped by tier and cycle range
5. WHEN a query specifies a cycle range, THE League_History_Service SHALL validate that the start cycle is less than or equal to the end cycle
6. IF an invalid cycle range is provided, THEN THE League_History_Service SHALL return a 400 error with a descriptive message

### Requirement 6: Admin League History Dashboard

**User Story:** As a system administrator, I want a dedicated admin page showing promotion/demotion activity across the system, so that I can monitor league health and detect anomalies.

#### Acceptance Criteria

1. THE Admin_League_History_Page SHALL display a summary panel showing total promotions and demotions for the most recent cycle
2. THE Admin_League_History_Page SHALL display a breakdown of promotions and demotions per tier for the selected cycle range
3. THE Admin_League_History_Page SHALL allow filtering by cycle range using start and end cycle inputs
4. THE Admin_League_History_Page SHALL allow filtering by entity type (robots only, tag teams only, or both)
5. THE Admin_League_History_Page SHALL display a table of recent tier change events with columns for entity name, entity type, change type, source tier, destination tier, league points, and cycle number
6. THE Admin_League_History_Page SHALL support pagination for the tier change events table
7. THE Admin_League_History_Page SHALL be accessible via the admin sidebar navigation as a lazy-loaded route

### Requirement 7: Individual Entity Timeline Visualization

**User Story:** As a system administrator, I want to see a visual timeline of a robot's journey through the league tiers, so that I can quickly understand its progression pattern.

#### Acceptance Criteria

1. WHEN an admin selects a robot from the tier change events table, THE Timeline_Visualization SHALL display a chronological chart showing the robot's tier over time (cycle number on x-axis, tier on y-axis)
2. THE Timeline_Visualization SHALL use distinct visual indicators for promotion events (upward movement) and demotion events (downward movement)
3. THE Timeline_Visualization SHALL display the league points at each tier change as a tooltip or label on the data point
4. THE Timeline_Visualization SHALL render the six league tiers on the y-axis in order from bronze (bottom) to champion (top)
5. WHEN an admin selects a tag team from the tier change events table, THE Timeline_Visualization SHALL display the same chronological chart for the tag team's tier history
6. IF an entity has no tier change history, THEN THE Timeline_Visualization SHALL display a message indicating the entity has remained in its current tier since creation

### Requirement 8: Player-Facing Robot League Progression

**User Story:** As a player, I want to see any robot's league progression history on its detail page, so that I can understand how it has moved through the tiers over time.

#### Acceptance Criteria

1. THE Robot Detail Page SHALL display a "League History" tab or section showing the robot's tier progression timeline
2. THE Player-Facing Timeline SHALL display a chronological step chart showing the robot's tier over time (cycle number on x-axis, tier on y-axis)
3. THE Player-Facing Timeline SHALL use distinct visual indicators for promotion events (upward movement) and demotion events (downward movement)
4. THE Player-Facing Timeline SHALL be viewable by any authenticated player for any robot (not restricted to own robots)
5. THE League_History_Service SHALL expose a public (authenticated) endpoint to retrieve the tier change history for a specific robot, ordered by cycle number ascending
6. IF a robot has no tier change history, THEN THE Player-Facing Timeline SHALL display a message indicating the robot has remained in its current tier since creation

### Requirement 9: Player-Facing Tag Team League Progression

**User Story:** As a player, I want to see any tag team's league progression history, so that I can understand how it has moved through the tag team league tiers over time.

#### Acceptance Criteria

1. THE Tag Team Detail view SHALL display a "League History" section showing the tag team's tier progression timeline
2. THE Player-Facing Tag Team Timeline SHALL display a chronological step chart showing the tag team's tier over time (cycle number on x-axis, tier on y-axis)
3. THE Player-Facing Tag Team Timeline SHALL use distinct visual indicators for promotion events (upward movement) and demotion events (downward movement)
4. THE Player-Facing Tag Team Timeline SHALL be viewable by any authenticated player for any tag team (not restricted to own tag teams)
5. THE League_History_Service SHALL expose a public (authenticated) endpoint to retrieve the tier change history for a specific tag team, ordered by cycle number ascending
6. IF a tag team has no tier change history, THEN THE Player-Facing Tag Team Timeline SHALL display a message indicating the tag team has remained in its current tier since creation

### Requirement 10: Yo-Yo Detection Support

**User Story:** As a system administrator, I want to identify robots that frequently bounce between tiers, so that I can assess whether the rebalancing thresholds are working correctly.

#### Acceptance Criteria

1. THE League_History_Service SHALL expose an admin-only endpoint to identify entities with repeated tier changes (3 or more changes within a configurable cycle window)
2. THE Admin_League_History_Page SHALL display a "yo-yo candidates" section highlighting entities with frequent tier oscillation
3. WHEN displaying yo-yo candidates, THE Admin_League_History_Page SHALL show the entity name, number of tier changes in the window, and the tiers involved

### Requirement 11: Achievement Data Support

**User Story:** As a developer, I want the league history data queryable for achievement evaluation, so that the L15 "Ctrl+Z" achievement can be implemented.

#### Acceptance Criteria

1. THE League_History_Service SHALL expose a method to query whether a specific robot was demoted from and re-promoted to the same tier within a given cycle window
2. THE League_History_Service SHALL accept a robot ID, a tier name, and a maximum cycle window as parameters for the Ctrl+Z query
3. WHEN the query finds a matching demotion followed by a re-promotion to the same tier within the cycle window, THE League_History_Service SHALL return true with the relevant cycle numbers
