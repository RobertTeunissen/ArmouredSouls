# Requirements Document: Cycle-Based Audit Logging and Analytics System

## Introduction

The Cycle-Based Audit Logging and Analytics System provides comprehensive tracking and analysis of all economic, performance, and strategic activities that occur during game cycles. This system captures stable-level and robot-level events to enable historical comparisons, trend analysis, investment ROI calculations, and debugging of game economy calculations. The system supports both the current prototype phase (manual cycle triggering) and future production phase (one cycle = one day).

## Glossary

- **Cycle**: A complete execution of the 8-step game loop that processes repairs, battles, tournaments, matchmaking, and league rebalancing
- **Stable**: A player's collection of robots and facilities, identified by User ID
- **Audit_Log_System**: The event capture and storage system that records all cycle activities
- **Analytics_Engine**: The analysis and reporting system that processes audit logs to generate insights
- **Event**: A discrete action or state change that occurs during a cycle (e.g., credit change, ELO update, facility purchase)
- **Cycle_Snapshot**: A complete record of all events and metrics for a single cycle
- **Time_Series_Data**: Historical event data organized chronologically for trend analysis
- **ROI_Calculator**: Component that analyzes facility investment returns over time
- **Comparison_Window**: A time period used for historical comparisons (e.g., day-over-day, week-over-week)

## Requirements

### Requirement 1: Capture Stable-Level Economic Events

**User Story:** As a stable owner, I want all economic transactions tracked at the stable level, so that I can understand my daily income, expenses, and net profit.

#### Acceptance Criteria

1. WHEN a cycle completes, THE Audit_Log_System SHALL record all prestige gains for each stable
2. WHEN a battle awards credits, THE Audit_Log_System SHALL record the credit change with battle reference
3. WHEN merchandising income is calculated, THE Audit_Log_System SHALL record the income amount and source facility level
4. WHEN streaming income is calculated, THE Audit_Log_System SHALL record the income amount and source facility level
5. WHEN facility operating costs are deducted, THE Audit_Log_System SHALL record each facility's cost by type and level
6. WHEN a facility is purchased or upgraded, THE Audit_Log_System SHALL record the transaction cost, facility type, old level, and new level
7. WHEN a weapon is purchased THE Audit_Log_System SHALL record the transaction
8. WHEN a robot frame is purchased, THE Audit_Log_System SHALL record the transaction cost and frame details
9. WHEN repair costs are deducted, THE Audit_Log_System SHALL record the total repair cost per robot with damage breakdown

### Requirement 2: Capture Robot-Level Performance Events

**User Story:** As a stable owner, I want all robot performance metrics tracked, so that I can analyze individual robot effectiveness and progression.

#### Acceptance Criteria

1. WHEN a robot participates in a battle, THE Audit_Log_System SHALL record credit income earned
2. WHEN a robot's fame changes, THE Audit_Log_System SHALL record the fame delta, new total, and triggering event
3. WHEN a robot's ELO changes, THE Audit_Log_System SHALL record the ELO before, ELO after, and ELO delta
4. WHEN a robot deals damage in battle, THE Audit_Log_System SHALL record total damage dealt per battle
5. WHEN a robot receives damage in battle, THE Audit_Log_System SHALL record total damage received per battle
6. WHEN a robot loses a battle, THE Audit_Log_System SHALL record the loss with battle outcome details
7. WHEN a robot is promoted or demoted, THE Audit_Log_System SHALL record the league change with old and new league
8. WHEN a robot attribute is upgraded, THE Audit_Log_System SHALL record the attribute name, old value, new value, and cost
9. WHEN a robot is repaired, THE Audit_Log_System SHALL record the repair cost, HP restored, and damage percentage
10. WHEN a robot purchases a weapon, THE Audit_Log_System SHALL record the weapon details and transaction cost

### Requirement 3: Capture Tournament and League Events

**User Story:** As a stable owner, I want tournament participation and league standings tracked, so that I can measure competitive progress.

#### Acceptance Criteria

1. WHEN a robot enters a tournament, THE Audit_Log_System SHALL record the tournament ID, entry time, and robot state
2. WHEN a tournament match completes, THE Audit_Log_System SHALL record the match outcome, round number, and rewards
3. WHEN a tournament concludes, THE Audit_Log_System SHALL record the final placement and total rewards earned
4. WHEN league standings change, THE Audit_Log_System SHALL record the new league points and ranking position
5. WHEN a robot's win/loss streak changes, THE Audit_Log_System SHALL record the streak type, length, and triggering battle. Streaks can be overall, but also broken down in League, Tag or Tournament matches.

### Requirement 4: Capture Tag Team Battle Events

**User Story:** As a stable owner with tag teams, I want tag team battle statistics tracked separately, so that I can analyze team performance.

#### Acceptance Criteria

1. WHEN a tag team battle occurs, THE Audit_Log_System SHALL record both active and reserve robot participation
2. WHEN a robot tags in during battle, THE Audit_Log_System SHALL record the tag-in timestamp and HP state
3. WHEN a robot tags out during battle, THE Audit_Log_System SHALL record the tag-out timestamp, reason, and HP state
4. WHEN a tag team battle completes, THE Audit_Log_System SHALL record individual damage contributions per robot
5. WHEN tag team fame is awarded, THE Audit_Log_System SHALL record fame distribution between active and reserve robots
5. WHEN tag team credits are awarded, THE Audit_Log_System SHALL record credit distribution between participating robots

### Requirement 5: Capture Facility Investment Events

**User Story:** As a stable owner, I want facility purchases and their economic impact tracked, so that I can calculate ROI and make informed investment decisions.

#### Acceptance Criteria

1. WHEN a facility is purchased, THE Audit_Log_System SHALL record the purchase cost, facility type, and cycle number
2. WHEN a facility generates income, THE Audit_Log_System SHALL record the income amount and attribute it to the facility
3. WHEN a facility provides a discount, THE Audit_Log_System SHALL record the discount amount and affected transaction
4. WHEN a facility incurs operating costs, THE Audit_Log_System SHALL record the cost amount per cycle
5. WHEN calculating facility ROI, THE Analytics_Engine SHALL aggregate all income, discounts, and costs since purchase

### Requirement 6: Support Historical Comparisons

**User Story:** As a stable owner, I want to compare current performance against previous cycles, so that I can identify trends and improvements.

#### Acceptance Criteria

1. WHEN requesting daily income comparison, THE Analytics_Engine SHALL calculate total income for the current cycle and the comparison cycle
2. WHEN comparing two days, THE Analytics_Engine SHALL retrieve cycle data from the requested days.
3. IT should be possible to go through the various daily cycles and see the requested data.
3. WHEN displaying comparison results, THE Analytics_Engine SHALL show absolute values, deltas, and percentage changes
4. WHEN insufficient historical data exists, THE Analytics_Engine SHALL indicate which comparisons are unavailable
5. WHEN comparing multiple metrics, THE Analytics_Engine SHALL support batch comparison requests

### Requirement 7: Graph ELO Progression Over Cycles

**User Story:** As a stable owner, I want to visualize ELO, fame and other changes over time, so that I can track robot skill progression per individual robot.

#### Acceptance Criteria

Where ELO is mentioned below, fame, total losses or other statistics might also apply.

1. WHEN requesting progression data, THE Analytics_Engine SHALL return time-series data for each robot
2. WHEN a robot's ELO changes during a cycle, THE Audit_Log_System SHALL record the cycle number and new ELO value
3. WHEN generating ELO graphs, THE Analytics_Engine SHALL provide data points for each cycle where ELO changed
4. WHEN multiple robots exist, THE Analytics_Engine SHALL support filtering by robot ID or aggregating stable-wide ELO
5. WHEN displaying ELO trends, THE Analytics_Engine SHALL calculate moving averages and trend lines

### Requirement 8: Analyze Last N Cycles for Investment Insights

**User Story:** As a stable owner, I want to analyze recent cycle data, so that I can receive actionable insights on facility purchases and strategy.

#### Acceptance Criteria

1. WHEN analyzing the last N cycles, THE Analytics_Engine SHALL retrieve all audit logs for the specified cycle range
2. WHEN calculating facility payoff, THE Analytics_Engine SHALL compare income generated against purchase cost and operating costs
3. WHEN providing investment insights, THE Analytics_Engine SHALL identify facilities with positive ROI and time-to-payoff
4. WHEN analyzing robot performance, THE Analytics_Engine SHALL identify top earners, highest ELO gainers, and loss leaders
5. WHEN generating recommendations, THE Analytics_Engine SHALL suggest next facility purchases based on current stable state and ROI data

### Requirement 9: Ensure Data Integrity and Audit Trail

**User Story:** As a developer, I want a complete audit trail of all calculations, so that I can debug economic calculation errors.

#### Acceptance Criteria

1. WHEN any economic calculation occurs, THE Audit_Log_System SHALL record the formula used, inputs, and output
2. WHEN a calculation error is suspected, THE Audit_Log_System SHALL provide queryable logs with full context
3. WHEN events are logged, THE Audit_Log_System SHALL include timestamps, cycle number, and event sequence number
4. WHEN data integrity is validated, THE Audit_Log_System SHALL verify that all credit changes sum to expected totals
5. WHEN querying audit logs, THE Audit_Log_System SHALL support filtering by cycle, stable, robot, event type, and date range

### Requirement 10: Store Cycle Snapshots Efficiently

**User Story:** As a system administrator, I want cycle data stored efficiently, so that historical analysis remains performant as data grows.

#### Acceptance Criteria

1. WHEN a cycle completes, THE Audit_Log_System SHALL create a cycle snapshot with aggregated metrics
2. WHEN storing individual events, THE Audit_Log_System SHALL use efficient data structures to minimize storage overhead
3. WHEN querying historical data, THE Audit_Log_System SHALL use indexed queries to maintain sub-second response times
4. WHEN archiving old data, THE Audit_Log_System SHALL support data retention policies without losing audit trail integrity
5. WHEN calculating aggregates, THE Analytics_Engine SHALL use pre-computed cycle snapshots rather than raw events

### Requirement 11: Support Prototype and Production Cycle Modes

**User Story:** As a developer, I want the system to work in both prototype mode (manual cycles) and production mode (daily cycles), so that testing and live operation use the same logging infrastructure.

#### Acceptance Criteria

1. WHEN cycles are triggered manually, THE Audit_Log_System SHALL record cycle metadata indicating manual trigger
2. WHEN cycles run on a daily schedule, THE Audit_Log_System SHALL record cycle metadata indicating scheduled trigger
3. WHEN analyzing cycle data, THE Analytics_Engine SHALL support both rapid cycle sequences (testing) and daily intervals (production)
4. WHEN displaying time-based comparisons, THE Analytics_Engine SHALL use cycle numbers rather than absolute dates for flexibility
5. WHEN transitioning from prototype to production, THE Audit_Log_System SHALL maintain backward compatibility with existing logs

### Requirement 12: Provide Analytics API Endpoints

**User Story:** As a frontend developer, I want REST API endpoints for analytics queries, so that I can display insights in the user interface.

#### Acceptance Criteria

1. WHEN requesting stable income summary, THE Analytics_Engine SHALL return total income, expenses, and net profit for specified cycles
2. WHEN requesting robot performance summary, THE Analytics_Engine SHALL return ELO progression, win rate, and earnings per robot
3. WHEN requesting facility ROI data, THE Analytics_Engine SHALL return investment cost, total returns, and payoff status per facility
4. WHEN requesting comparison data, THE Analytics_Engine SHALL return current vs. historical metrics with deltas and percentages
5. WHEN requesting trend data, THE Analytics_Engine SHALL return time-series data formatted for graphing libraries

### Requirement 13: Track Battle Stance and Yield Decisions

**User Story:** As a stable owner, I want battle stance selections and yield decisions tracked, so that I can analyze strategic choices.

#### Acceptance Criteria

1. WHEN a robot enters battle with a stance, THE Audit_Log_System SHALL record the stance selection (offensive, defensive, balanced)
2. WHEN a robot yields during battle, THE Audit_Log_System SHALL record the yield decision, HP at yield, and yield threshold
3. WHEN analyzing battle outcomes, THE Analytics_Engine SHALL correlate stance choices with win rates
4. WHEN analyzing yield decisions, THE Analytics_Engine SHALL calculate average HP saved by yielding vs. fighting to destruction
5. WHEN providing strategic insights, THE Analytics_Engine SHALL recommend optimal yield thresholds based on historical data

### Requirement 14: Calculate and Track Weapon Efficiency

**User Story:** As a stable owner, I want weapon performance tracked, so that I can identify which weapons are most effective.

#### Acceptance Criteria

1. WHEN a robot uses a weapon in battle, THE Audit_Log_System SHALL record damage dealt per weapon
2. WHEN a weapon is purchased, THE Audit_Log_System SHALL record the purchase cost and weapon specifications
3. WHEN a weapon is sold, THE Audit_Log_System SHALL record the sale price and total damage dealt during ownership
4. WHEN calculating weapon efficiency, THE Analytics_Engine SHALL compute damage per credit spent
5. WHEN comparing weapons, THE Analytics_Engine SHALL provide win rate statistics per weapon type

### Requirement 15: Support Real-Time Cycle Progress Monitoring

**User Story:** As a system administrator, I want to monitor cycle execution in real-time, so that I can identify performance bottlenecks.

#### Acceptance Criteria

1. WHEN a cycle starts, THE Audit_Log_System SHALL record the cycle start timestamp
2. WHEN each cycle step completes, THE Audit_Log_System SHALL record the step completion time and duration
3. WHEN a cycle completes, THE Audit_Log_System SHALL record total cycle duration and step-by-step breakdown
4. WHEN monitoring cycle performance, THE Analytics_Engine SHALL identify slow steps and performance degradation trends
5. WHEN cycles are running in bulk, THE Audit_Log_System SHALL provide progress indicators and estimated completion time
