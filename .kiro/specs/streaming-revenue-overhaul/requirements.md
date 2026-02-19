# Requirements Document: Streaming Revenue Overhaul

## Introduction

This feature overhauls the streaming revenue system in Armoured Souls to award streaming income per battle rather than as a daily passive income. The new system rewards active participation by awarding streaming credits after every battle (1v1, Tag Team, or Tournament) based on robot fame and battle count, scaled by a new Streaming Studio facility.

The current system awards streaming income only to players with an Income Generator Level 3+ facility as a daily passive income. The new system democratizes streaming revenue by awarding it to all robots after every battle, making it a direct reward for participation rather than a facility-gated passive income stream.

This change addresses the economic imbalance where multi-robot strategies play more battles but win less frequently, ensuring that active participation is rewarded regardless of win rate.

## Glossary

- **Streaming_Revenue**: Credits earned per battle based on robot fame and battle count
- **Streaming_Studio**: New facility (Levels 1-10) that increases streaming revenue per battle
- **Base_Streaming_Rate**: Fixed 1,000 credits per battle before multipliers
- **Battle_Multiplier**: Scaling factor based on robot's total battle count (1 + battles/1000)
- **Fame_Multiplier**: Scaling factor based on robot's fame (1 + fame/5000)
- **Studio_Multiplier**: Scaling factor based on Streaming Studio facility level
- **Per_Battle_Streaming**: Streaming revenue awarded after each individual battle
- **Team_Streaming_Calculation**: Method for calculating streaming revenue in Tag Team matches using highest fame and highest battles from each team

## Requirements

### Requirement 1: Per-Battle Streaming Revenue Award

**User Story:** As a player, I want to earn streaming revenue after every battle my robots participate in, so that active participation is directly rewarded regardless of my facility investments.

#### Acceptance Criteria

1. WHEN any robot completes a battle (1v1, Tag Team, or Tournament), THE System SHALL calculate and award streaming revenue to the robot's stable
2. WHEN calculating streaming revenue, THE System SHALL use the formula: `streaming_revenue = 1000 × battle_multiplier × fame_multiplier × studio_multiplier`
3. WHEN a robot has never battled before (battles = 0), THE System SHALL use battle_multiplier = 1.0
4. WHEN a robot has no fame (fame = 0), THE System SHALL use fame_multiplier = 1.0
5. WHEN the stable has no Streaming Studio (level = 0), THE System SHALL use studio_multiplier = 1.0
6. THE System SHALL award streaming revenue to both winner and loser in every battle
7. THE System SHALL award streaming revenue for draws
8. THE System SHALL NOT award streaming revenue for bye matches (matches against bye-robots)

### Requirement 2: Battle Multiplier Calculation

**User Story:** As a player, I want my robots to earn more streaming revenue as they participate in more battles, so that veteran robots are more valuable for streaming income.

#### Acceptance Criteria

1. WHEN calculating battle_multiplier, THE System SHALL use the formula: `battle_multiplier = 1 + (robot_total_battles / 1000)`
2. WHEN a robot has 0 battles, THE System SHALL calculate battle_multiplier as 1.0
3. WHEN a robot has 100 battles, THE System SHALL calculate battle_multiplier as 1.1
4. WHEN a robot has 500 battles, THE System SHALL calculate battle_multiplier as 1.5
5. WHEN a robot has 1000 battles, THE System SHALL calculate battle_multiplier as 2.0
6. WHEN a robot has 5000 battles, THE System SHALL calculate battle_multiplier as 6.0
7. THE System SHALL use the robot's total battle count (1v1 + Tag Team + Tournament) for the calculation
8. THE System SHALL update the robot's battle count BEFORE calculating streaming revenue for that battle

### Requirement 3: Fame Multiplier Calculation

**User Story:** As a player, I want my famous robots to earn more streaming revenue, so that building robot reputation has economic benefits beyond just prestige.

#### Acceptance Criteria

1. WHEN calculating fame_multiplier, THE System SHALL use the formula: `fame_multiplier = 1 + (robot_fame / 5000)`
2. WHEN a robot has 0 fame, THE System SHALL calculate fame_multiplier as 1.0
3. WHEN a robot has 500 fame, THE System SHALL calculate fame_multiplier as 1.1
4. WHEN a robot has 2500 fame, THE System SHALL calculate fame_multiplier as 1.5
5. WHEN a robot has 5000 fame, THE System SHALL calculate fame_multiplier as 2.0
6. WHEN a robot has 25000 fame, THE System SHALL calculate fame_multiplier as 6.0
7. THE System SHALL use the robot's current fame value at the time of battle completion
8. THE System SHALL calculate fame_multiplier AFTER awarding fame for the battle (if applicable)

### Requirement 4: Streaming Studio Facility

**User Story:** As a player, I want to invest in a Streaming Studio facility to increase my streaming revenue per battle, so that I can optimize my stable's income generation.

#### Acceptance Criteria

1. THE System SHALL provide a new facility type called "Streaming Studio" with 10 levels (0-10)
2. WHEN the Streaming Studio is at level 0 (not purchased), THE System SHALL use studio_multiplier = 1.0
3. WHEN the Streaming Studio is at level 1, THE System SHALL use studio_multiplier = 1.1 (10% increase)
4. WHEN the Streaming Studio is at level 2, THE System SHALL use studio_multiplier = 1.2 (20% increase)
5. WHEN the Streaming Studio is at level 5, THE System SHALL use studio_multiplier = 1.5 (50% increase)
6. WHEN the Streaming Studio is at level 10, THE System SHALL use studio_multiplier = 2.0 (100% increase)
7. THE System SHALL calculate studio_multiplier as: `studio_multiplier = 1 + (streaming_studio_level × 0.1)`
8. THE System SHALL apply the studio_multiplier to all robots in the stable regardless of which robot battles

### Requirement 5: Streaming Studio Facility Costs

**User Story:** As a player, I want to understand the costs and benefits of the Streaming Studio facility, so that I can make informed investment decisions.

#### Acceptance Criteria

1. WHEN purchasing Streaming Studio Level 1, THE System SHALL charge ₡100,000
2. WHEN upgrading Streaming Studio from level N to N+1, THE System SHALL charge: `upgrade_cost = (N + 1) × 100,000`
3. WHEN upgrading from Level 3 to Level 4, THE System SHALL charge ₡400,000
4. WHEN upgrading from Level 9 to Level 10, THE System SHALL charge ₡1,000,000
5. THE Streaming Studio Level 1 SHALL have a daily operating cost of ₡100
6. THE Streaming Studio operating cost SHALL increase by ₡100 per level: `operating_cost = level × 100`
7. THE Streaming Studio Level 10 SHALL have a daily operating cost of ₡1,000
8. THE System SHALL display Streaming Studio costs in the facilities page alongside other facilities
9. THE System SHALL include Streaming Studio operating costs in the daily financial report

### Requirement 6: Streaming Studio Prestige Requirements

**User Story:** As a player, I want higher levels of the Streaming Studio to require prestige thresholds, so that facility progression is gated by stable reputation.

#### Acceptance Criteria

1. WHEN purchasing Streaming Studio Levels 1-3, THE System SHALL NOT require any prestige
2. WHEN purchasing Streaming Studio Level 4, THE System SHALL require 1,000 prestige
3. WHEN purchasing Streaming Studio Level 5, THE System SHALL require 2,500 prestige
4. WHEN purchasing Streaming Studio Level 6, THE System SHALL require 5,000 prestige
5. WHEN purchasing Streaming Studio Level 7, THE System SHALL require 10,000 prestige
6. WHEN purchasing Streaming Studio Level 8, THE System SHALL require 15,000 prestige
7. WHEN purchasing Streaming Studio Level 9, THE System SHALL require 25,000 prestige
8. WHEN purchasing Streaming Studio Level 10, THE System SHALL require 50,000 prestige
9. WHEN a player attempts to upgrade without sufficient prestige, THE System SHALL display an error message with the required prestige amount

### Requirement 7: Tag Team Streaming Revenue Calculation

**User Story:** As a player, I want streaming revenue for Tag Team matches to be calculated fairly based on team composition, so that I'm rewarded for fielding experienced and famous robots.

#### Acceptance Criteria

1. WHEN calculating streaming revenue for a Tag Team match, THE System SHALL identify the robot with the highest fame on each team
2. WHEN calculating streaming revenue for a Tag Team match, THE System SHALL identify the robot with the highest battle count on each team
3. WHEN calculating battle_multiplier for Tag Team, THE System SHALL use: `battle_multiplier = 1 + (max_battles_on_team / 1000)`
4. WHEN calculating fame_multiplier for Tag Team, THE System SHALL use: `fame_multiplier = 1 + (max_fame_on_team / 5000)`
5. THE System SHALL calculate streaming revenue separately for each team using their respective max values
6. THE System SHALL award the calculated streaming revenue to each stable (one payment per team, not per robot)
7. WHEN both robots on a team have equal fame, THE System SHALL use either robot's fame (they are equal)
8. WHEN both robots on a team have equal battles, THE System SHALL use either robot's battle count (they are equal)

### Requirement 8: Battle Log Display of Streaming Revenue

**User Story:** As a player, I want to see streaming revenue clearly displayed in battle logs, so that I understand exactly how much I earned from each battle.

#### Acceptance Criteria

1. WHEN viewing a battle log, THE System SHALL display a "Streaming Revenue" section after the battle outcome
2. THE streaming revenue section SHALL show the base amount (₡1,000)
3. THE streaming revenue section SHALL show the battle multiplier with the robot's battle count
4. THE streaming revenue section SHALL show the fame multiplier with the robot's fame
5. THE streaming revenue section SHALL show the studio multiplier with the facility level
6. THE streaming revenue section SHALL show the final calculated streaming revenue amount
7. FOR Tag Team matches, THE System SHALL show which robot's stats were used for the calculation
8. THE streaming revenue display SHALL use the format: "📺 Streaming Revenue: ₡X,XXX (Base: ₡1,000 × Battles: X.XX × Fame: X.XX × Studio: X.XX)"

### Requirement 9: Terminal Log Display of Streaming Revenue

**User Story:** As an admin, I want to see streaming revenue in the terminal logs during cycle execution, so that I can monitor income generation in real-time.

#### Acceptance Criteria

1. WHEN a battle completes during a cycle, THE System SHALL log streaming revenue to the terminal
2. THE terminal log SHALL include the robot name, battle ID, and streaming revenue amount
3. THE terminal log SHALL use the format: "[Streaming] RobotName earned ₡X,XXX from Battle #123"
4. FOR Tag Team matches, THE terminal log SHALL show both team members and the team's streaming revenue
5. THE terminal log SHALL display streaming revenue immediately after battle completion logs
6. THE System SHALL include streaming revenue in the cycle summary statistics

### Requirement 10: Cycle CSV Export of Streaming Revenue

**User Story:** As an admin, I want streaming revenue data exported to cycle CSV files, so that I can analyze income patterns over time.

#### Acceptance Criteria

1. WHEN exporting cycle data to CSV, THE System SHALL include a "streaming_revenue" column
2. THE streaming_revenue column SHALL contain the amount earned by each robot in that battle
3. FOR Tag Team matches, THE System SHALL record streaming revenue for the team (not individual robots)
4. THE CSV SHALL include streaming revenue for both winners and losers
5. THE CSV SHALL show ₡0 for bye matches (no streaming revenue awarded)
6. THE System SHALL include streaming revenue in the per-battle row data
7. THE System SHALL calculate total streaming revenue per cycle in the summary row

### Requirement 11: Cycle Summary Display of Streaming Revenue

**User Story:** As a player, I want to see total streaming revenue in the cycle summary, so that I understand the economic impact of the cycle.

#### Acceptance Criteria

1. WHEN displaying the cycle summary, THE System SHALL show total streaming revenue earned across all battles
2. THE cycle summary SHALL display streaming revenue as a separate line item in the table format
3. THE cycle summary SHALL show only the total amount: "₡XX,XXX" in the streaming revenue row
4. THE System SHALL store streaming revenue data in the database for each cycle
5. THE System SHALL store streaming revenue per robot per cycle for analytics tracking
6. THE System SHALL add streaming revenue to the total cycle income
7. THE System SHALL update the user's balance with streaming revenue earnings
8. THE cycle summary SHALL display streaming revenue before showing the final balance
9. WHEN no battles occurred in the cycle, THE System SHALL show "₡0" in the streaming revenue row

### Requirement 12: Financial Report Integration

**User Story:** As a player, I want streaming revenue to appear in my daily financial reports, so that I can track this income stream alongside other revenue sources.

#### Acceptance Criteria

1. WHEN generating a daily financial report, THE System SHALL include streaming revenue as a separate line item
2. THE financial report SHALL show streaming revenue under "Revenue Streams" section
3. THE financial report SHALL display: "Streaming (per battle): ₡XX,XXX (from YY battles)"
4. THE System SHALL calculate daily streaming revenue by summing all per-battle streaming awards
5. THE System SHALL include streaming revenue in the total daily revenue calculation
6. THE financial report SHALL show streaming revenue separately from other income sources (battle winnings, merchandising)
7. WHEN no battles occurred that day, THE System SHALL show "Streaming (per battle): ₡0 (from 0 battles)"

### Requirement 13: Income Generator Facility Changes

**User Story:** As a player, I want to understand how the Income Generator facility changes with the new streaming system, so that I can adjust my facility strategy.

#### Acceptance Criteria

1. THE System SHALL remove streaming revenue generation from the Income Generator facility
2. THE Income Generator facility SHALL continue to provide merchandising income (unchanged)
3. THE Income Generator facility SHALL NOT affect streaming revenue calculations in any way
4. WHEN displaying Income Generator benefits, THE System SHALL NOT mention streaming revenue
5. THE System SHALL update facility descriptions to reflect that streaming is now per-battle via Streaming Studio
6. THE System SHALL maintain Income Generator operating costs (unchanged)
7. THE System SHALL maintain Income Generator upgrade costs (unchanged)
8. WHEN a player views the Income Generator facility, THE System SHALL show a note: "Streaming revenue is now awarded per battle. See Streaming Studio facility."

### Requirement 14: Economic Balance Considerations

**User Story:** As a player, I want the new streaming system to be economically balanced, so that multi-robot strategies are viable without being overpowered.

#### Acceptance Criteria

1. THE System SHALL ensure that a robot with 0 battles and 0 fame earns exactly ₡1,000 per battle (base rate)
2. THE System SHALL ensure that a veteran robot (1000 battles, 5000 fame) earns ₡4,000 per battle without Streaming Studio
3. THE System SHALL ensure that a veteran robot with Streaming Studio Level 10 earns ₡8,000 per battle
4. THE System SHALL ensure that streaming revenue scales linearly with battle participation (more battles = more total income)
5. THE System SHALL ensure that streaming revenue does not exceed battle winnings for typical matches
6. THE System SHALL ensure that losing robots still earn streaming revenue to offset repair costs
7. THE System SHALL monitor streaming revenue impact on stable economics and adjust multipliers if needed

### Requirement 15: Robot Analytics Tracking

**User Story:** As a player, I want to track streaming revenue per robot over time, so that I can analyze which robots are most profitable for streaming income.

#### Acceptance Criteria

1. THE System SHALL track streaming revenue earned per robot per cycle
2. WHEN viewing a robot's analytics page (e.g., /robots/117?tab=analytics), THE System SHALL display streaming revenue data
3. THE analytics page SHALL show streaming revenue earned per cycle in a chart
4. THE analytics page SHALL show total streaming revenue earned by the robot since creation
5. THE analytics page SHALL show average streaming revenue per battle for the robot
6. THE analytics page SHALL show the breakdown of streaming revenue factors (battles, fame, studio level)
7. THE System SHALL store streaming revenue data in the database linked to the robot and cycle

### Requirement 16: Streaming Revenue for Tournament Matches

**User Story:** As a player, I want to earn streaming revenue from tournament matches, so that tournament participation is economically rewarding beyond just prize money.

#### Acceptance Criteria

1. WHEN a robot completes a tournament match, THE System SHALL calculate and award streaming revenue using the same formula as regular battles
2. THE System SHALL award streaming revenue for all tournament rounds (Round 1, Quarterfinals, Semifinals, Finals)
3. THE System SHALL award streaming revenue to both winner and loser in tournament matches
4. THE System SHALL display streaming revenue in tournament battle logs
5. THE System SHALL include tournament streaming revenue in the cycle summary
6. THE System SHALL include tournament streaming revenue in the financial report
7. THE System SHALL NOT award streaming revenue for tournament byes (when a robot advances without fighting)

### Requirement 17: Facility Advisor Integration

**User Story:** As a player, I want to see Streaming Studio investment analysis in the Facility Advisor, so that I can make informed decisions about upgrading.

#### Acceptance Criteria

1. WHEN viewing /facility-advisor, THE System SHALL include Streaming Studio in the facility analysis
2. THE Facility Advisor SHALL show current Streaming Studio level and multiplier
3. THE Facility Advisor SHALL show upgrade cost for the next level
4. THE Facility Advisor SHALL calculate projected streaming revenue increase per battle at next level
5. THE Facility Advisor SHALL estimate battles needed to break even on upgrade cost
6. THE Facility Advisor SHALL show estimated payback period in days based on average battles per day
7. THE Facility Advisor SHALL compare current vs next level streaming revenue over 30 days
8. THE Facility Advisor SHALL include operating cost increases in the ROI calculation
9. THE Facility Advisor SHALL show total investment vs projected returns for Streaming Studio

### Requirement 18: Streaming Revenue Analytics

**User Story:** As a player, I want to view analytics on my streaming revenue over time, so that I can optimize my strategy and understand income trends.

#### Acceptance Criteria

1. THE System SHALL track total streaming revenue earned per day
2. THE System SHALL track streaming revenue per robot
3. THE System SHALL display a streaming revenue chart showing daily earnings over the last 30 days
4. THE System SHALL display top earning robots by streaming revenue
5. THE System SHALL show average streaming revenue per battle for each robot
6. THE System SHALL show total streaming revenue earned since account creation
7. THE System SHALL include streaming revenue in the financial projections page

### Requirement 19: Documentation Updates

**User Story:** As a player, I want all game documentation to reflect the new streaming revenue system, so that I can understand how to optimize my streaming income.

#### Acceptance Criteria

1. THE System SHALL update PRD_ECONOMY_SYSTEM.md to reflect the new per-battle streaming revenue system
2. THE System SHALL update PRD_ECONOMY_SYSTEM.md to document the Streaming Studio facility with costs, benefits, and formulas
3. THE System SHALL update PRD_ECONOMY_SYSTEM.md to remove streaming revenue from Income Generator facility description
4. THE System SHALL update PRD_ECONOMY_SYSTEM.md to update the "Revenue Streams" section with the new streaming formula
5. THE System SHALL update STABLE_SYSTEM.md to include Streaming Studio facility specifications (costs, operating costs, prestige requirements)
6. THE System SHALL update any in-game help text that references streaming revenue
7. THE System SHALL update facility tooltips to reflect the new streaming system
8. THE System SHALL update the financial report documentation to show streaming revenue as per-battle income
9. THE System SHALL update API documentation if any endpoints change due to streaming revenue modifications
10. THE System SHALL create or update any user-facing guides that explain streaming revenue mechanics
11. THE System SHALL update the facility comparison tables to include Streaming Studio
12. THE System SHALL update economic balance examples to reflect per-battle streaming income

