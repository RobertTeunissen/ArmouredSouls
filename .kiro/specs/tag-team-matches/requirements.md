# Requirements Document: Tag Team Matches

## Introduction

Tag Team Matches introduce a new battle format to Armoured Souls where two robots from the same stable compete as a team against two robots from another stable. This feature extends the existing 1v1 league system with cooperative gameplay while maintaining the game's core philosophy of scheduled batch processing and strategic depth.

The feature integrates with the existing battle system: when the first robot reaches their yield threshold or is destroyed, they "tag out" and the second robot "activates" to continue the fight. This creates opportunities for strategic team composition, resource management across multiple robots, and new tactical considerations around tagging timing.

## Glossary

- **Tag_Team_Match**: A battle format where two robots from one stable face two robots from another stable
- **Active_Robot**: The robot currently fighting in a tag team match
- **Reserve_Robot**: The robot waiting to tag in after the active robot yields or is destroyed
- **Tag_Out**: The event when an active robot yields or is destroyed and is replaced by the reserve robot
- **Tag_In**: The event when a reserve robot becomes the active robot
- **Team**: A pair of robots from the same stable participating in a tag team match
- **Combined_ELO**: The sum of both robots' ELO ratings used for matchmaking
- **Tag_Team_League**: A separate league system specifically for tag team matches
- **Tag_Team_Readiness**: Battle readiness requirements that must be met by both robots on a team

## Requirements

### Requirement 1: Team Formation and Selection

**User Story:** As a player, I want to select two robots from my stable to form a tag team, so that I can compete in tag team matches with complementary robot builds.

#### Acceptance Criteria

1. WHEN a player accesses the tag team interface, THE System SHALL display all robots in their stable that meet battle readiness requirements
2. WHEN a player selects two robots for a team, THE System SHALL validate that both robots are from the same stable
3. WHEN a player selects two robots for a team, THE System SHALL validate that both robots meet battle readiness requirements (HP ≥75%, HP > yield threshold, all weapons equipped)
4. WHEN a player confirms team selection, THE System SHALL save the team configuration with designated active and reserve positions
5. WHEN a player has multiple robots available, THE System SHALL allow them to create multiple tag teams (up to roster size / 2)

### Requirement 2: Tag Team Matchmaking

**User Story:** As a player, I want my tag team to be matched against opponents of similar skill level, so that matches are competitive and fair.

#### Acceptance Criteria

1. WHEN matchmaking runs for tag teams, THE System SHALL calculate combined ELO (robot1 ELO + robot2 ELO) for each team
2. WHEN pairing tag teams, THE System SHALL match teams within ±300 combined ELO when possible
3. IF no match exists within ±300 combined ELO, THEN THE System SHALL expand to ±600 combined ELO
4. WHEN multiple suitable opponents exist, THE System SHALL deprioritize recent opponents (last 5 matches)
5. WHEN no suitable opponent exists, THE System SHALL match the team with a bye-team (two bye-robots with combined ELO 2000)
6. THE System SHALL NOT match teams from the same stable against each other
7. THE System SHALL run tag team matchmaking every other cycle (odd cycles: 1, 3, 5, etc.)
8. THE System SHALL skip tag team matchmaking on even cycles (2, 4, 6, etc.)

### Requirement 3: Tag Team Battle Execution

**User Story:** As a player, I want tag team battles to execute automatically based on my pre-configured strategy, so that I can see how my team composition performs.

#### Acceptance Criteria

1. WHEN a tag team battle begins, THE System SHALL start with both teams' active robots fighting
2. WHILE the active robot's HP is above their yield threshold AND above 0, THE System SHALL continue normal combat
3. WHEN an active robot's HP reaches their yield threshold OR drops to 0, THEN THE System SHALL trigger a tag-out event
4. WHEN a tag-out occurs, THE System SHALL remove the yielding/destroyed robot from combat
5. WHEN a tag-out occurs, THE System SHALL activate the reserve robot at full HP with fresh weapon cooldowns
6. WHEN both robots on a team have yielded or been destroyed, THEN THE System SHALL declare the opposing team as winners
7. IF both teams have both robots destroyed simultaneously, THEN THE System SHALL declare a draw
8. WHEN the battle time limit is reached, THE System SHALL declare a draw regardless of robot states

### Requirement 4: Tag Team Battle Rewards and Costs

**User Story:** As a player, I want to understand the economic implications of tag team matches, so that I can make informed decisions about participation.

#### Acceptance Criteria

1. WHEN a tag team wins a match, THE System SHALL award credits to the stable (2x standard league match rewards for the tier)
2. WHEN a tag team loses a match, THE System SHALL award reduced credits to the stable (2x standard loss rewards for the tier)
3. WHEN a tag team match ends in a draw, THE System SHALL award draw credits to the stable (2x standard draw rewards for the tier)
4. WHEN a tag team match ends, THE System SHALL calculate repair costs for both robots based on damage taken
5. WHEN calculating repair costs, THE System SHALL apply the stable's Repair Bay discount to both robots
6. WHEN a robot is destroyed in a tag team match, THE System SHALL apply the 2x destruction multiplier to that robot's repair cost
7. WHEN a robot yields in a tag team match, THE System SHALL calculate repair costs based on actual damage taken
8. THE System SHALL display tag team match credits earned in the daily income/expense report alongside 1v1 match earnings

### Requirement 5: Tag Team ELO and League Points

**User Story:** As a player, I want my robots to gain ELO and league points from tag team matches, so that they can progress through the tag team league system.

#### Acceptance Criteria

1. WHEN a tag team match completes, THE System SHALL calculate ELO changes for all four robots using the K=32 formula
2. WHEN calculating ELO changes, THE System SHALL use combined team ELO as the basis for expected outcome
3. WHEN a team wins, THE System SHALL award +3 tag team league points to both robots on the winning team
4. WHEN a team loses, THE System SHALL deduct -1 tag team league points from both robots on the losing team (minimum 0)
5. WHEN a match ends in a draw, THE System SHALL award +1 tag team league points to all four robots
6. THE System SHALL maintain separate league points for tag team matches and regular 1v1 matches
7. THE System SHALL maintain a single ELO rating that applies to both match types

### Requirement 6: Tag Team League System

**User Story:** As a player, I want tag teams to compete in a separate league structure, so that team performance is tracked independently from individual robot performance.

#### Acceptance Criteria

1. THE System SHALL maintain six tag team league tiers (Bronze, Silver, Gold, Platinum, Diamond, Champion)
2. WHEN a new tag team is formed, THE System SHALL place it in the Bronze tag team league
3. WHEN tag team league rebalancing occurs, THE System SHALL promote teams in the top 10% with ≥25 tag team league points (minimum 5 cycles in current tier)
4. WHEN tag team league rebalancing occurs, THE System SHALL demote the bottom 10% of teams (minimum 5 cycles in current tier)
5. WHEN a team is promoted or demoted, THE System SHALL reset their tag team league points to 0
6. WHEN a team is promoted or demoted, THE System SHALL reset their cycles counter to 0
7. THE System SHALL maintain tag team league instances with maximum 50 teams per instance
8. WHEN a tag team league instance exceeds 50 teams, THE System SHALL create a new instance and balance teams across instances

### Requirement 7: Tag Team Battle Logs and History

**User Story:** As a player, I want to view detailed logs of tag team battles, so that I can understand what happened and improve my strategy.

#### Acceptance Criteria

1. WHEN a tag team battle completes, THE System SHALL generate a battle log with all combat events
2. WHEN a tag-out occurs, THE System SHALL record the event in the battle log with timestamp and reason (yield or destruction)
3. WHEN a reserve robot tags in, THE System SHALL record the tag-in event with the robot's starting state
4. WHEN displaying battle history, THE System SHALL show tag team matches with both team members listed
5. WHEN a player views a tag team battle log, THE System SHALL display which robot was active at each point in the battle
6. THE System SHALL include tag-out and tag-in events in the combat message generation system

### Requirement 8: Tag Team Battle Readiness

**User Story:** As a player, I want to know if my tag team is ready for battle, so that I can prepare both robots appropriately.

#### Acceptance Criteria

1. WHEN checking tag team readiness, THE System SHALL validate that both robots have HP ≥75%
2. WHEN checking tag team readiness, THE System SHALL validate that both robots have HP > their yield threshold
3. WHEN checking tag team readiness, THE System SHALL validate that both robots have all required weapons equipped
4. WHEN a tag team fails readiness checks, THE System SHALL exclude the team from matchmaking
5. WHEN displaying tag team status, THE System SHALL show readiness warnings for each robot that fails checks
6. THE System SHALL display tag team readiness status on the dashboard, tag team management page, and robot detail pages

### Requirement 9: Tag Team UI and Display

**User Story:** As a player, I want to easily manage my tag teams and view their performance, so that I can track progress and make strategic decisions.

#### Acceptance Criteria

1. WHEN a player accesses the tag team page, THE System SHALL display all configured tag teams with their current status
2. WHEN displaying a tag team, THE System SHALL show both robots' names, portraits, ELO, HP, and readiness status
3. WHEN displaying tag team standings, THE System SHALL show team rank, combined ELO, tag team league points, and win/loss record
4. WHEN a player views upcoming matches, THE System SHALL include scheduled tag team matches in the same list as 1v1 matches with a clear "Tag Team" indicator
5. WHEN a player views battle history, THE System SHALL include completed tag team matches in the same list as 1v1 matches with a clear "Tag Team" indicator
6. THE System SHALL provide a tag team creation interface accessible from the stable management page
7. THE System SHALL allow players to disband tag teams and reform them with different robot combinations
8. WHEN displaying the dashboard, THE System SHALL show upcoming tag team matches alongside upcoming 1v1 matches
9. WHEN displaying the dashboard, THE System SHALL show recent tag team battle results alongside recent 1v1 battle results

### Requirement 10: Tag Team Prestige and Fame

**User Story:** As a player, I want tag team victories to contribute to my stable's prestige and my robots' fame, so that team play is rewarded appropriately.

#### Acceptance Criteria

1. WHEN a tag team wins a match in Bronze tier, THE System SHALL award +8 prestige to the stable (1.6x individual match)
2. WHEN a tag team wins a match in Silver tier, THE System SHALL award +16 prestige to the stable (1.6x individual match)
3. WHEN a tag team wins a match in Gold tier, THE System SHALL award +32 prestige to the stable (1.6x individual match)
4. WHEN a tag team wins a match in Platinum tier, THE System SHALL award +48 prestige to the stable (1.6x individual match)
5. WHEN a tag team wins a match in Diamond tier, THE System SHALL award +80 prestige to the stable (1.6x individual match)
6. WHEN a tag team wins a match in Champion tier, THE System SHALL award +120 prestige to the stable (1.6x individual match)
7. WHEN a robot participates in a tag team match, THE System SHALL award fame based on their individual contribution (damage dealt, survival time)
8. THE System SHALL track tag team-specific statistics (tag team wins, tag team losses, times tagged in, times tagged out)

### Requirement 11: Tag Team and Individual Match Coexistence

**User Story:** As a player, I want my robots to participate in both individual and tag team matches, so that I can maximize engagement and strategic options.

#### Acceptance Criteria

1. THE System SHALL allow a robot to be scheduled for both a 1v1 match and a tag team match in the same cycle
2. WHEN a robot is scheduled for multiple matches, THE System SHALL execute all matches and apply cumulative damage
3. WHEN a robot's HP drops below battle readiness due to earlier matches, THE System SHALL exclude them from subsequent matches in that cycle
4. THE System SHALL process 1v1 matches before tag team matches in each cycle
5. WHEN displaying upcoming matches, THE System SHALL show both match types with clear indicators
6. THE System SHALL maintain separate league standings for 1v1 and tag team competitions

### Requirement 12: Tag Team Bye-Team Handling

**User Story:** As a player, I want my tag team to receive a match even when there's an odd number of teams, so that I don't miss out on progression opportunities.

#### Acceptance Criteria

1. WHEN an odd number of tag teams are eligible for matchmaking, THE System SHALL create a bye-team with two bye-robots
2. THE bye-team SHALL have a combined ELO of 2000 (1000 per robot)
3. WHEN a tag team faces the bye-team, THE System SHALL execute a normal battle with predictable difficulty
4. WHEN a tag team defeats the bye-team, THE System SHALL award full rewards (credits, ELO, league points)
5. WHEN a tag team loses to the bye-team, THE System SHALL apply normal loss penalties
6. THE System SHALL distribute bye-team matches evenly across eligible teams over multiple cycles
