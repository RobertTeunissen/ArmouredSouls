# Requirements Document: Robot Detail Page Visual Enhancement

## Introduction

This document specifies the requirements for enhancing the Robot Detail Page (`/robots/:id`) with comprehensive information architecture improvements and visual polish based on the Armoured Souls Design System. The page currently has functional implementations (v1.1) but requires restructuring to provide meaningful statistical insights, better upgrade planning tools, and clearer information presentation through a tabbed interface.

The enhancements focus on transforming the page into a comprehensive robot management hub with: detailed performance analytics across leagues and tournaments, recent and upcoming match tracking, statistical rankings, an interactive upgrade planning system with cost preview, and a separate battle configuration tab. All improvements align with the Direction B (Precision/Engineering) logo state and the game's managerial aesthetic.

## Glossary

- **Robot_Detail_Page**: The individual robot view page at `/robots/:id` with tabbed interface for different management functions
- **Direction_B_Logo**: The precision/engineering variant of the Armoured Souls logo used for management screens
- **Overview_Tab**: Primary tab showing statistics, rankings, performance metrics, and upcoming/recent matches
- **Battle_Config_Tab**: Separate tab for loadout, stance, and yield configuration (owner-only)
- **Upgrade_Tab**: Interactive tab for planning and committing attribute upgrades (owner-only)
- **Stats_Tab**: Tab showing effective attribute calculations with clear modifier impact visualization
- **HP_Bar**: Visual health indicator component with color-coded states
- **Performance_Metrics**: Battle statistics including wins, losses, damage dealt/taken, organized by league and tournament
- **Statistical_Rankings**: Robot's rank position in various attribute and performance categories
- **Match_History**: Recent battles display with results and key statistics
- **Upcoming_Matches**: Scheduled battles display for leagues and tournaments
- **Upgrade_Planner**: Interactive interface allowing +/- adjustments before committing changes
- **Loadout_Type**: One of four weapon configurations (Single, Weapon+Shield, Two-Handed, Dual-Wield)
- **Battle_Stance**: One of three combat postures (Offensive, Defensive, Balanced)
- **Attribute_Category**: One of five groupings (Combat, Defense, Chassis, AI, Team)
- **Weapon_Thumbnail**: 128×128px visual representation of equipped weapon
- **Robot_Portrait**: Visual representation of robot (256×256px card, 512×512px hero)
- **Micro_Animation**: Subtle motion responding to user interaction (150-300ms duration)
- **Color_Coding**: Systematic use of colors to convey status or category information

## Requirements

### Requirement 1: Tabbed Interface Architecture

**User Story:** As a player managing my robot, I want different aspects organized in tabs, so that I can focus on specific management tasks without information overload.

#### Acceptance Criteria

1. THE Robot_Detail_Page SHALL implement a tabbed interface with four primary tabs
2. THE System SHALL provide an Overview tab as the default view showing statistics and performance
3. THE System SHALL provide a Battle Config tab for loadout, stance, and yield settings (owner-only)
4. THE System SHALL provide an Upgrades tab for attribute improvement planning (owner-only)
5. THE System SHALL provide a Stats tab for detailed effective attribute calculations
6. WHEN a non-owner views the page, THE System SHALL hide owner-only tabs (Battle Config, Upgrades)
7. THE System SHALL maintain tab state when navigating within the page
8. THE System SHALL use visual indicators to show the active tab

### Requirement 2: Overview Tab - Statistical Rankings

**User Story:** As a player viewing my robot's performance, I want to see how my robot ranks in various categories, so that I can identify strengths and weaknesses compared to other robots.

#### Acceptance Criteria

1. THE Overview_Tab SHALL display the robot's rank in each of the five attribute categories (Combat, Defense, Chassis, AI, Team)
2. THE System SHALL display the robot's rank in performance metrics (Total Damage Dealt, Win Rate, ELO, K/D Ratio)
3. THE System SHALL show rank as position out of total (e.g., "#15 of 247 robots")
4. THE System SHALL use visual indicators for top rankings (top 10%, top 25%, etc.)
5. THE System SHALL update rankings based on current robot statistics
6. THE System SHALL display category icons alongside ranking information

### Requirement 3: Overview Tab - Performance by League and Tournament

**User Story:** As a player analyzing my robot's performance, I want to see statistics broken down by league, tournament, and tag team battles, so that I can understand performance in different competitive contexts.

#### Acceptance Criteria

1. THE Overview_Tab SHALL display performance statistics for each league the robot has participated in
2. THE System SHALL show wins, losses, draws, and win rate percentage per league
3. THE System SHALL display total damage dealt and taken per league
4. THE System SHALL show performance statistics for each tournament the robot has entered
5. THE System SHALL display performance statistics for tag team battles
6. THE System SHALL display ELO changes associated with each competitive context
7. THE System SHALL use visual cards or tables to organize league/tournament/tag team statistics
8. WHEN the robot has not participated in a league, tournament, or tag team battle, THE System SHALL indicate "No battles yet"

### Requirement 4: Overview Tab - Recent Battles Display

**User Story:** As a player reviewing recent performance, I want to see my robot's last battles with key details, so that I can quickly assess recent form and identify patterns.

#### Acceptance Criteria

1. THE Overview_Tab SHALL display the 10 most recent battles
2. THE System SHALL show for each battle: opponent name, result (Win/Loss/Draw), date, battle type (League/Tournament/Tag Team)
3. THE System SHALL display damage dealt and taken for each battle
4. THE System SHALL show ELO change for each battle
5. THE System SHALL use color coding for results (green for wins, red for losses, amber for draws)
6. THE System SHALL provide a "View Full Battle Log" link for each battle
7. THE System SHALL display a "View All Battles" link to the complete battle history page
8. FOR tag team battles, THE System SHALL display teammate and opponent team information

### Requirement 5: Overview Tab - Upcoming Matches

**User Story:** As a player planning my robot's schedule, I want to see upcoming matches, so that I can prepare my robot and ensure battle readiness.

#### Acceptance Criteria

1. THE Overview_Tab SHALL display all scheduled upcoming matches including league matches, tournament matches, and tag team matches
2. THE System SHALL show for each upcoming match: opponent name (if known), scheduled time, battle type (League/Tournament/Tag Team)
3. THE System SHALL display league or tournament context for each match
4. THE System SHALL show battle readiness status for upcoming matches
5. THE System SHALL provide visual warnings if the robot is not battle-ready (low HP, no weapons equipped)
6. WHEN no matches are scheduled, THE System SHALL display "No upcoming matches"
7. THE System SHALL sort upcoming matches chronologically
8. FOR tag team matches, THE System SHALL display teammate robot names and opponent team composition

### Requirement 6: Battle Config Tab - Separated Configuration

**User Story:** As a robot owner configuring for battle, I want battle configuration in a dedicated tab, so that I can focus on tactical setup without distraction from other information.

#### Acceptance Criteria

1. THE Battle_Config_Tab SHALL be accessible only to the robot owner
2. THE System SHALL display weapon loadout selection with visual weapon thumbnails (128×128px)
3. THE System SHALL display loadout type selector with 64×64px icons (Single, Weapon+Shield, Two-Handed, Dual-Wield)
4. THE System SHALL display battle stance selector with 64×64px posture icons (Offensive, Defensive, Balanced)
5. THE System SHALL display yield threshold slider with repair cost preview
6. THE System SHALL show current HP and shield status with color-coded bars
7. THE System SHALL display battle readiness indicator
8. THE System SHALL provide immediate visual feedback when configuration changes affect effective stats

### Requirement 7: Stats Tab - Concise Effective Stats Display

**User Story:** As a player analyzing attribute modifiers, I want a clear, concise view of how modifiers impact my attributes, so that I can understand the effective values without excessive detail.

#### Acceptance Criteria

1. THE Stats_Tab SHALL display all 23 attributes organized by the five categories
2. THE System SHALL show for each attribute: base value, total modifier percentage, and effective value
3. THE System SHALL use visual indicators (icons, color coding) to show modifier impact
4. THE System SHALL display positive modifiers in green and negative modifiers in red
5. THE System SHALL provide expandable details showing breakdown of modifiers (weapons, loadout, stance) on demand
6. THE System SHALL use compact formatting to display all attributes without excessive scrolling
7. THE System SHALL highlight attributes with significant modifiers (>20% change)

### Requirement 8: Upgrades Tab - Interactive Upgrade Planner

**User Story:** As a player planning robot upgrades, I want to experiment with different upgrade combinations before committing, so that I can optimize my credit spending and strategic development.

#### Acceptance Criteria

1. THE Upgrades_Tab SHALL display all 23 attributes with current values and upgrade costs
2. THE System SHALL provide +/- buttons for each attribute to plan upgrades
3. WHEN the + button is clicked, THE System SHALL increment the planned upgrade level and update the total cost preview
4. WHEN the - button is clicked, THE System SHALL decrement the planned upgrade level and update the total cost preview
5. THE System SHALL display the actual upgrade cost including all applicable discounts (workshop, bulk, etc.)
6. THE System SHALL show a running total of all planned upgrade costs
7. THE System SHALL display current credit balance and remaining credits after planned upgrades
8. THE System SHALL provide a "Commit Upgrades" button to execute all planned changes
9. THE System SHALL provide a "Reset Plan" button to clear all planned upgrades
10. THE System SHALL disable + buttons when the attribute reaches its academy cap
11. THE System SHALL disable the "Commit Upgrades" button when insufficient credits are available
12. THE System SHALL show all attributes in a single, scannable view without category folding

### Requirement 9: Upgrades Tab - Cost Transparency

**User Story:** As a player planning upgrades, I want to see actual costs with all discounts applied, so that I can make informed economic decisions.

#### Acceptance Criteria

1. THE System SHALL display the base upgrade cost for each attribute level
2. THE System SHALL show discount percentages when applicable (e.g., "20% workshop discount")
3. THE System SHALL display the final cost after all discounts
4. THE System SHALL show the total cost for all planned upgrades
5. THE System SHALL update costs in real-time as upgrades are planned
6. THE System SHALL display academy cap information and upgrade requirements
7. THE System SHALL show cost per attribute point for comparison

### Requirement 10: Visual Design System Implementation

**User Story:** As a player using the interface, I want consistent visual design matching the engineering aesthetic, so that the page feels cohesive and professional.

#### Acceptance Criteria

1. THE System SHALL use the Direction_B_Logo aesthetic throughout the page
2. THE System SHALL implement proper typography hierarchy (H1: 30px, H2: 24px, H3: 20px, Body: 16px)
3. THE System SHALL use DIN Next or Inter Tight for headers and Inter for body text
4. THE System SHALL apply the established color palette (Combat: #f85149, Defense: #58a6ff, Chassis: #3fb950, AI: #d29922, Team: #a371f7)
5. THE System SHALL use 32×32px category icons and 24×24px attribute icons
6. THE System SHALL implement micro-animations (hover lifts: 2px/150ms, transitions: 300ms, modals: 250ms scale-in)
7. THE System SHALL respect prefers-reduced-motion settings
8. THE System SHALL maintain 4.5:1 minimum contrast ratio for accessibility
9. THE System SHALL provide hover states and focus indicators for all interactive elements
10. THE System SHALL use icons plus text labels for critical information
