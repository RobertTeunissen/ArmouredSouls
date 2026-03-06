# Requirements Document

## Introduction

The New Player Onboarding feature provides an interactive tutorial system that guides new players through the strategic complexity of Armoured Souls. This feature addresses the critical problem of new players making poor resource allocation decisions without understanding the cascading implications of their choices.

The game presents players with a fundamental strategic choice: **How many robots should I build?** This decision affects facility priorities, weapon strategies, budget allocation, and long-term progression. The onboarding system must educate players about these strategic dimensions before they commit their starting budget of ₡3,000,000.

The onboarding system will use a step-by-step guided flow with strategic decision points, budget visualization, and concrete examples to ensure players understand the implications of their choices before making irreversible spending decisions.

## Glossary

- **Onboarding_System**: The tutorial flow that guides new players through strategic setup
- **Tutorial_Step**: An individual stage in the onboarding process
- **Roster_Strategy**: Player's choice of how many robots to build (1, 2, or 3)
- **Strategy_Path**: The recommended sequence of purchases and upgrades for a chosen roster strategy
- **Budget_Allocation**: Distribution of starting ₡3,000,000 across facilities, robots, weapons, and upgrades
- **Facility_Timing**: The strategic order in which facilities should be purchased relative to other investments
- **Weapon_Type**: Category of weapon (Energy, Ballistic, Melee, Shield) affecting loadout and battle stance
- **Loadout_Configuration**: How weapons are equipped (Single, Weapon+Shield, Two-Handed, Dual-Wield)
- **Resource_Validation**: System that checks if player has sufficient credits for required actions
- **Battle_Readiness_Check**: Validation that ensures robot has minimum requirements to enter battles
- **Guided_UI**: User interface elements that highlight and explain where to click
- **Tutorial_State**: Database tracking of player's progress through onboarding
- **Strategic_Implication**: The cascading effects of a decision on future options and gameplay
- **Reserve_Credits**: Recommended credit amount player should maintain for repairs and operations (₡50,000)
- **Reset_Functionality**: System capability to revert all purchases made since registration
- **Battle_Type**: Category of battle (League, Tag Team, Tournament) with different scheduling and rules
- **Loadout_Type**: Configuration determining how weapons are equipped (Single, Weapon+Shield, Two-Handed, Dual-Wield)
- **Attribute_Bonus**: Stat increases provided by weapons that can effectively increase attribute caps
- **Navigation_Flow**: The sequence and structure of pages/screens in the application

## Requirements

### Requirement 1: Onboarding Trigger and State Management

**User Story:** As a new player, I want the tutorial to start automatically after registration, so that I receive guidance before making any decisions.

#### Acceptance Criteria

1. WHEN a user completes registration, THE Onboarding_System SHALL initialize Tutorial_State for that user
2. THE Tutorial_State SHALL track current step, completion status, and skipped status
3. WHEN a user logs in with incomplete Tutorial_State, THE Onboarding_System SHALL resume from last completed step
4. THE Onboarding_System SHALL store Tutorial_State in the database for persistence
5. WHERE a user has completed onboarding, THE Onboarding_System SHALL not display tutorial prompts
6. THE Onboarding_System SHALL provide a "Skip Tutorial" option with confirmation warning

### Requirement 2: Strategic Tutorial Flow

**User Story:** As a new player, I want to understand the strategic implications of my choices, so that I can make informed decisions about my roster strategy and resource allocation.

#### Acceptance Criteria

1. THE Onboarding_System SHALL enforce sequential step completion (Step N+1 requires Step N completion)
2. THE Onboarding_System SHALL define the following step sequence:
   - Step 1: Welcome and strategic overview
   - Step 2: Roster strategy selection (1, 2, or 3 robots)
   - Step 3: Facility planning and timing education
   - Step 4: Budget allocation guidance for chosen strategy
   - Step 5: Create first robot
   - Step 6: Weapon type and loadout education
   - Step 7: Purchase and equip first weapon
   - Step 8: Understand repair costs and battle readiness
   - Step 9: Complete initial setup and review strategy
3. WHEN a step is completed, THE Onboarding_System SHALL unlock the next step
4. THE Onboarding_System SHALL display progress indicator showing current step and total steps
5. THE Onboarding_System SHALL allow returning to previous steps for review (read-only)
6. THE Onboarding_System SHALL persist player's chosen Roster_Strategy throughout the tutorial
7. THE Onboarding_System SHALL provide strategy-specific guidance based on player's Roster_Strategy choice

### Requirement 3: Resource Validation and Warnings

**User Story:** As a new player, I want warnings when I'm about to make poor spending decisions, so that I don't get stuck without resources.

#### Acceptance Criteria

1. WHEN a player attempts to spend credits, THE Resource_Validation SHALL check if sufficient credits exist for the purchase
2. THE Onboarding_System SHALL advise players to maintain Reserve_Credits of approximately ₡50,000 for repairs
3. WHEN spending would leave less than ₡50,000, THE Onboarding_System SHALL display advisory warning message
4. THE advisory warning SHALL explain repair cost risks but SHALL NOT block the transaction
5. THE Onboarding_System SHALL block facility purchases during onboarding until Strategy_Path is established
6. WHEN a player has less than ₡600,000 remaining, THE Onboarding_System SHALL warn against additional spending
7. THE Onboarding_System SHALL calculate and display projected repair costs before robot creation
8. THE Onboarding_System SHALL validate that player's spending aligns with their chosen Roster_Strategy
9. THE Onboarding_System SHALL explain that maintaining ₡50K reserve helps avoid bankruptcy from unexpected repair costs

### Requirement 4: Roster Strategy Selection

**User Story:** As a new player, I want to understand the three viable roster strategies, so that I can choose the approach that matches my playstyle.

#### Acceptance Criteria

1. WHEN Step 2 begins, THE Onboarding_System SHALL present three roster strategy options
2. THE Onboarding_System SHALL display each strategy with:
   - Strategy name (1 Mighty Robot, 2 Average Robots, 3 Flimsy Robots)
   - Visual representation showing robot count
   - Key characteristics and playstyle description
   - Facility priorities for this strategy
   - Approximate budget breakdown
   - Strategic implications and trade-offs
3. THE Onboarding_System SHALL explain that 1 Mighty Robot strategy focuses investment on single powerful robot
4. THE Onboarding_System SHALL explain that 2 Average Robots strategy balances power and diversification
5. THE Onboarding_System SHALL explain that 3 Flimsy Robots strategy maximizes diversification and battle participation
6. THE Onboarding_System SHALL explain facility requirements differ by strategy (Roster Expansion needed for 2-3 robots)
7. WHEN player selects a strategy, THE Onboarding_System SHALL store choice and provide strategy-specific guidance
8. THE Onboarding_System SHALL allow player to change strategy selection before confirming

### Requirement 5: Facility Timing and Priority Education

**User Story:** As a new player, I want to understand which facilities to purchase and in what order, so that I maximize the value of my investments and avoid wasting credits.

#### Acceptance Criteria

1. WHEN Step 3 begins, THE Onboarding_System SHALL explain that facility order matters and "you can spend your money only once"
2. THE Onboarding_System SHALL categorize facilities into priority tiers:
   - Mandatory First: Roster Expansion (for 2-3 robot strategies), Weapons Workshop (before weapon purchases)
   - Recommended Early: Training Facility (before attribute upgrades)
   - Strategy-Dependent: Training Academies (Defense, AI, etc.), Passive Income Facilities (Merchandising Hub, Streaming Studio)
   - Optional/Later: Other facilities
3. THE Onboarding_System SHALL explain Weapons Workshop should be purchased BEFORE buying weapons
4. THE Onboarding_System SHALL explain Weapons Workshop provides 5-50% discount on weapon purchases
5. THE Onboarding_System SHALL calculate savings example: "₡275K weapon costs ₡206K with Workshop Level 5"
6. THE Onboarding_System SHALL explain Training Facility should be purchased BEFORE upgrading attributes
7. THE Onboarding_System SHALL explain Training Facility provides 10-90% discount on attribute upgrades
8. THE Onboarding_System SHALL explain Roster Expansion is REQUIRED before creating 2nd or 3rd robot
9. THE Onboarding_System SHALL explain Training Academies provide specialized bonuses:
   - Defense Training Academy: Bonuses stack with shields (good for defensive strategies)
   - AI Training Academy: Improves combat decision-making
   - Other academies: Specialized benefits for specific playstyles
10. THE Onboarding_System SHALL explain single-robot strategies may want 1-2 Training Academies for specialization
11. THE Onboarding_System SHALL explain Passive Income Facilities (Merchandising Hub, Streaming Studio) make sense for certain strategies
12. THE Onboarding_System SHALL explain Storage Facility increases weapon storage capacity (5 base, +5 per level)
13. THE Onboarding_System SHALL display facility priority order for player's chosen Roster_Strategy
14. WHEN player acknowledges understanding, THE Onboarding_System SHALL advance to Step 4

### Requirement 6: Budget Allocation Guidance

**User Story:** As a new player, I want concrete budget breakdowns for my chosen strategy, so that I know how to allocate my ₡3,000,000 starting credits.

#### Acceptance Criteria

1. WHEN Step 4 begins, THE Onboarding_System SHALL display budget breakdown for player's Roster_Strategy
2. FOR 1 Mighty Robot strategy, THE Onboarding_System SHALL recommend:
   - Facilities: ₡400K-₡600K (Training Facility, Weapons Workshop)
   - Robot: ₡500K (1 robot frame)
   - Weapons: ₡300K-₡400K (1-2 quality weapons)
   - Attribute Upgrades: ₡1,000K-₡1,200K (focus on single robot)
   - Reserve: ₡500K-₡700K (repairs and operations)
3. FOR 2 Average Robots strategy, THE Onboarding_System SHALL recommend:
   - Facilities: ₡600K-₡800K (Roster Expansion, Training Facility, Weapons Workshop)
   - Robots: ₡1,000K (2 robot frames)
   - Weapons: ₡400K-₡600K (2-4 weapons, consider weapon types)
   - Attribute Upgrades: ₡600K-₡800K (split between robots)
   - Reserve: ₡400K-₡600K (repairs and operations)
4. FOR 3 Flimsy Robots strategy, THE Onboarding_System SHALL recommend:
   - Facilities: ₡700K-₡900K (Roster Expansion Level 2, Storage Facility, Weapons Workshop)
   - Robots: ₡1,500K (3 robot frames)
   - Weapons: ₡400K-₡600K (3-6 weapons, need storage capacity)
   - Attribute Upgrades: ₡300K-₡500K (minimal upgrades spread across robots)
   - Reserve: ₡400K-₡600K (repairs and operations)
5. THE Onboarding_System SHALL display budget breakdown as visual chart with percentages
6. THE Onboarding_System SHALL explain these are guidelines, not strict requirements
7. THE Onboarding_System SHALL highlight that facility discounts compound over time
8. THE Onboarding_System SHALL explain weapon storage limits and Storage Facility benefits
9. WHEN player acknowledges understanding, THE Onboarding_System SHALL advance to Step 5

### Requirement 7: Weapon Type and Loadout Education

**User Story:** As a new player, I want to understand weapon types and loadout configurations before purchasing weapons, so that I make informed weapon choices.

#### Acceptance Criteria

1. WHEN Step 6 begins, THE Onboarding_System SHALL explain four weapon types: Energy, Ballistic, Melee, Shield
2. THE Onboarding_System SHALL explain weapon type affects battle stance choices
3. THE Onboarding_System SHALL explain four loadout configurations:
   - Single: One weapon, balanced bonuses (+10% Gyro, +5% Servo)
   - Weapon+Shield: Defensive (+20% Shield, +15% Armor, -15% Attack Speed)
   - Two-Handed: High damage (+10% Power, +20% Crit, -10% Evasion, 1.10× damage)
   - Dual-Wield: Fast attacks (+30% Attack Speed, +15% Control, -20% Penetration, -10% Power)
4. THE Onboarding_System SHALL explain loadout choice affects which weapons can be equipped
5. THE Onboarding_System SHALL explain weapon slots: main weapon and offhand weapon
6. THE Onboarding_System SHALL explain shields can ONLY be equipped in offhand with Weapon+Shield loadout
7. THE Onboarding_System SHALL explain two-handed weapons occupy both slots
8. THE Onboarding_System SHALL explain dual-wield requires two one-handed weapons
9. THE Onboarding_System SHALL display weapon compatibility chart showing loadout restrictions
10. FOR 2-3 robot strategies, THE Onboarding_System SHALL explain weapon sharing requires multiple copies
11. FOR 2-3 robot strategies, THE Onboarding_System SHALL explain Storage Facility importance for weapon inventory
12. WHEN player acknowledges understanding, THE Onboarding_System SHALL advance to Step 7

### Requirement 8: Strategy Comparison and Trade-offs

**User Story:** As a new player, I want to understand the trade-offs between roster strategies, so that I can make an informed strategic choice.

#### Acceptance Criteria

1. THE Onboarding_System SHALL display side-by-side comparison of three roster strategies
2. FOR each strategy, THE Onboarding_System SHALL show:
   - Battle participation rate (1 robot: ~2.2 battles/day, 2 robots: ~3.6/day, 3 robots: ~5/day)
   - Power per robot (1 robot: highest, 2 robots: moderate, 3 robots: lowest)
   - Facility investment required (1 robot: lowest, 3 robots: highest)
   - Risk profile (1 robot: high risk if robot damaged, 3 robots: distributed risk)
   - Complexity level (1 robot: simplest, 3 robots: most complex)
3. THE Onboarding_System SHALL explain 1 Mighty Robot advantages:
   - Maximum power concentration
   - Simplest management
   - Lowest facility costs
   - Can reach highest attribute levels fastest
4. THE Onboarding_System SHALL explain 1 Mighty Robot disadvantages:
   - Single point of failure
   - Fewer battles per day
   - Limited strategic flexibility
   - High repair costs if you LOSE a battle (all damage concentrated on one robot)
5. THE Onboarding_System SHALL explain 2 Average Robots advantages:
   - Balanced power and participation
   - Risk distribution
   - Moderate complexity
   - Flexible strategies
   - Unlocks Tag Team battles (additional battle type)
6. THE Onboarding_System SHALL explain 2 Average Robots disadvantages:
   - Requires Roster Expansion facility
   - Split attribute upgrade budget
   - More weapon purchases needed
   - Moderate facility investment
   - Could mean MORE total repair costs if you lose more battles
7. THE Onboarding_System SHALL explain 3 Flimsy Robots advantages:
   - Maximum battle participation
   - Distributed risk
   - Highest passive income potential (streaming scales with battles)
   - Multiple strategic approaches
   - Unlocks Tag Team battles (additional battle type)
8. THE Onboarding_System SHALL explain 3 Flimsy Robots disadvantages:
   - Highest facility investment (Roster Expansion Level 2, Storage Facility)
   - Lowest power per robot
   - Most complex management
   - Requires more weapons and storage capacity
   - Could mean MORE total repair costs if you lose more battles
9. THE Onboarding_System SHALL provide recommendation based on player preferences:
   - "Prefer simplicity and power? → 1 Mighty Robot"
   - "Want balance and flexibility? → 2 Average Robots"
   - "Enjoy complexity and participation? → 3 Flimsy Robots"

### Requirement 9: Robot Creation Guidance

**User Story:** As a new player, I want guidance on creating my first robot with context from my chosen strategy, so that I understand what I'm purchasing and why.

#### Acceptance Criteria

1. WHEN Step 5 begins, THE Onboarding_System SHALL display explanation of robot purpose and cost
2. THE Onboarding_System SHALL explain that robots cost ₡500,000 and start with all attributes at level 1
3. THE Onboarding_System SHALL remind player of their chosen Roster_Strategy
4. THE Onboarding_System SHALL explain how many robots player plans to create total
5. THE Onboarding_System SHALL highlight the "Create New Robot" button with pulsing animation
6. THE Onboarding_System SHALL display tooltip explaining robot naming and frame selection
7. WHEN robot creation form opens, THE Onboarding_System SHALL overlay guidance on each field
8. THE Onboarding_System SHALL explain that attribute upgrades should be done AFTER purchasing Training Facility
9. THE Onboarding_System SHALL show remaining budget after robot creation
10. WHEN robot is created, THE Onboarding_System SHALL confirm success and advance to Step 6

### Requirement 10: Weapon Purchase Guidance with Loadout and Attribute Education

**User Story:** As a new player, I want guidance on purchasing my first weapon with understanding of loadout types and attribute bonuses, so that I choose an appropriate weapon for my strategy.

#### Acceptance Criteria

1. WHEN Step 7 begins, THE Onboarding_System SHALL explain that robots require weapons to battle
2. THE Onboarding_System SHALL remind player of loadout type education from Step 6
3. THE Onboarding_System SHALL explain that weapon TYPE (Energy, Ballistic, Melee, Shield) does not currently affect gameplay
4. THE Onboarding_System SHALL explain what DOES matter for weapons:
   - Loadout_Type (Single, Weapon+Shield, Two-Handed, Dual-Wield) determines bonuses
   - Attribute_Bonus provided by weapons (increases effective stats)
   - Weapons can effectively increase attribute caps beyond base limits
   - Complementary weapons increase total attribute scores
5. THE Onboarding_System SHALL explain loadout type bonuses:
   - Single: Balanced (+10% Gyro, +5% Servo)
   - Weapon+Shield: Defensive (+20% Shield, +15% Armor, -15% Attack Speed)
   - Two-Handed: High damage (+10% Power, +20% Crit, -10% Evasion, 1.10× damage multiplier)
   - Dual-Wield: Fast attacks (+30% Attack Speed, +15% Control, -20% Penetration, -10% Power)
6. THE Onboarding_System SHALL highlight recommended starter weapons with their attribute bonuses:
   - Laser Rifle (₡244K) - precise, consistent damage, +attribute bonuses
   - Machine Gun (₡150K) - affordable, reliable, +attribute bonuses
   - Combat Knife (₡100K) - budget option, high burst, +attribute bonuses
7. THE Onboarding_System SHALL explain how weapon attribute bonuses stack with robot base attributes
8. THE Onboarding_System SHALL recommend starting with Single or Weapon+Shield loadout
9. THE Onboarding_System SHALL warn against purchasing expensive weapons (>₡300K) during onboarding
10. THE Onboarding_System SHALL display remaining credits after weapon purchase
11. FOR 2-3 robot strategies, THE Onboarding_System SHALL remind player they need multiple weapons
12. FOR 2-3 robot strategies, THE Onboarding_System SHALL explain weapon storage capacity limits
13. WHEN weapon is purchased, THE Onboarding_System SHALL confirm success and advance to Step 8
14. THE Onboarding_System SHALL explain Weapons Workshop discount would have saved ₡X on this purchase

### Requirement 11: Weapon Equipping Guidance with Loadout Configuration

**User Story:** As a new player, I want guidance on equipping weapons and configuring loadouts, so that I understand how weapon slots and loadout types work together.

#### Acceptance Criteria

1. WHEN Step 8 begins, THE Onboarding_System SHALL navigate player to robot detail page
2. THE Onboarding_System SHALL highlight the loadout section with overlay
3. THE Onboarding_System SHALL explain loadout types and their bonuses/penalties
4. THE Onboarding_System SHALL recommend "Single" loadout for first robot
5. THE Onboarding_System SHALL explain main weapon slot vs offhand weapon slot
6. THE Onboarding_System SHALL guide player to select weapon from inventory dropdown
7. THE Onboarding_System SHALL explain weapon bonuses are added to robot attributes
8. WHEN weapon is equipped, THE Battle_Readiness_Check SHALL verify robot is battle-ready
9. THE Onboarding_System SHALL show updated robot stats with weapon bonuses
10. THE Onboarding_System SHALL explain loadout bonuses are percentage-based and scale with attributes
11. THE Onboarding_System SHALL confirm robot is ready to battle and advance to Step 9

### Requirement 12: Repair Cost and Battle Readiness Education

**User Story:** As a new player, I want to understand repair costs and battle readiness, so that I can manage my robot's condition and budget for ongoing operations.

#### Acceptance Criteria

1. WHEN Step 9 begins, THE Onboarding_System SHALL explain that robots take damage in battles
2. THE Onboarding_System SHALL explain repair cost formula: (sum_of_attributes × 100) × damage_percentage
3. THE Onboarding_System SHALL show example repair costs for player's robot at various damage levels
4. THE Onboarding_System SHALL explain that HP does NOT regenerate automatically
5. THE Onboarding_System SHALL explain that shields DO regenerate automatically (no cost)
6. THE Onboarding_System SHALL explain battle readiness requirements (HP >0, weapon equipped)
7. THE Onboarding_System SHALL explain Repair Bay facility reduces repair costs by 5-55%
8. THE Onboarding_System SHALL explain Medical Bay facility reduces critical damage repair costs
9. FOR multi-robot strategies, THE Onboarding_System SHALL explain repair costs multiply with more robots
10. THE Onboarding_System SHALL calculate projected weekly repair costs based on Roster_Strategy
11. WHEN player acknowledges understanding, THE Onboarding_System SHALL advance to completion

### Requirement 13: Personalized Strategy Recommendations

**User Story:** As a new player, I want personalized recommendations based on my strategic choices, so that I can make informed decisions that align with my chosen playstyle.

#### Acceptance Criteria

1. WHEN onboarding completion begins, THE Onboarding_System SHALL display summary of player's choices:
   - Chosen Roster_Strategy (1, 2, or 3 robots)
   - Robots created so far
   - Weapons purchased and loadout types chosen
   - Battle stance preferences (if selected)
   - Facilities purchased (if any)
   - Credits remaining
2. THE Onboarding_System SHALL provide contextual recommendations based on player's specific choices
3. WHEN player chose 1 mighty robot + weapon+shield loadout + defensive stance, THE Onboarding_System SHALL recommend:
   - Defense Training Academy (bonuses stack with shields)
   - NOT AI Training Academy (less synergy with defensive approach)
   - Focus on armor and shield attribute upgrades
4. WHEN player chose 1 mighty robot + two-handed loadout + aggressive stance, THE Onboarding_System SHALL recommend:
   - Power Training Academy (enhances damage output)
   - Focus on power and critical hit attribute upgrades
5. WHEN player chose 2-3 robots strategy, THE Onboarding_System SHALL recommend:
   - Roster Expansion facility (if not purchased)
   - Storage Facility for weapon management
   - Balanced attribute distribution across robots
6. THE Onboarding_System SHALL present recommendations as OPTIONS with explanations, not commands
7. THE Onboarding_System SHALL explain WHY each recommendation fits the player's choices
8. THE Onboarding_System SHALL provide alternative paths: "You could also consider..."
9. THE Onboarding_System SHALL emphasize player CONTROL: "These are suggestions based on your choices, but you decide your path"
10. THE Onboarding_System SHALL recommend facilities based on:
    - Roster strategy (1/2/3 robots)
    - Loadout choice (Single, Weapon+Shield, Two-Handed, Dual-Wield)
    - Battle stance preference (if indicated)
    - Weapon attribute bonuses selected
11. THE Onboarding_System SHALL explain daily cycle system and battle participation
12. THE Onboarding_System SHALL explain how to check battle results after cycle
13. THE Onboarding_System SHALL provide link to facilities page with contextual facility priorities highlighted
14. THE Onboarding_System SHALL provide link to weapon shop with weapons matching player's loadout highlighted
15. THE Onboarding_System SHALL mark Tutorial_State as completed
16. THE Onboarding_System SHALL provide option to replay tutorial from settings page

### Requirement 14: Reset and Restart Functionality

**User Story:** As a new player who made mistakes during onboarding, I want to reset my account and start over, so that I can apply what I learned without being stuck with poor initial decisions.

#### Acceptance Criteria

1. THE Onboarding_System SHALL provide "Reset Account" functionality accessible during and after onboarding
2. THE Reset_Functionality SHALL be available in player settings or profile page
3. THE Reset_Functionality SHALL display prominent button labeled "Start Over" or "Reset Account"
4. WHEN "Reset Account" is clicked, THE Onboarding_System SHALL check if reset is allowed
5. THE Onboarding_System SHALL allow reset IF no scheduled matches exist for player's robots
6. IF scheduled matches exist, THEN THE Onboarding_System SHALL display error: "Cannot reset - you have scheduled battles. Removing robots would create conflicts."
7. THE Onboarding_System SHALL check additional reset constraints:
   - No active tournament participation
   - No pending battle results
   - No active facility construction/upgrades
   - No pending transactions or trades
8. IF any constraint is violated, THEN THE Onboarding_System SHALL display specific reason why reset is blocked
9. WHEN reset is allowed, THE Onboarding_System SHALL display confirmation dialog with warnings:
   - "This will delete all your robots, weapons, and facilities"
   - "Your credits will be reset to ₡3,000,000"
   - "Your tutorial progress will be reset"
   - "This action cannot be undone"
   - "Are you sure you want to start over?"
10. THE confirmation dialog SHALL require typing "RESET" or "START OVER" to confirm (prevent accidental clicks)
11. WHEN reset is confirmed, THE Reset_Functionality SHALL:
    - Delete all player's robots
    - Delete all weapon inventory
    - Delete all facilities
    - Reset credits to ₡3,000,000
    - Reset Tutorial_State to initial state
    - Clear all battle history
    - Preserve username, password, and account creation date
12. AFTER reset completes, THE Onboarding_System SHALL redirect player to onboarding Step 1
13. THE Reset_Functionality SHALL log reset events for analytics
14. THE Reset_Functionality SHALL be clearly accessible during onboarding (visible button or menu option)
15. THE Onboarding_System SHALL mention reset option during onboarding: "Don't worry, you can reset and start over if needed"

### Requirement 15: Battle Types and Scheduling Education

**User Story:** As a new player, I want to understand how different battle types work and when battles are scheduled, so that I know what to expect from the game's cycle system.

#### Acceptance Criteria

1. THE Onboarding_System SHALL include education about battle types in the tutorial flow
2. THE Onboarding_System SHALL explain three main battle types:
   - League Battles: Standard competitive matches for ranking
   - Tag Team Battles: 2v2 battles (requires 2+ robots)
   - Tournament Battles: Special competitive events with brackets
3. FOR League Battles, THE Onboarding_System SHALL explain:
   - Scheduled during daily league cycles
   - Affect league standings and League Points (LP)
   - Earn credits and fame based on performance
   - Matchmaking based on ELO and league tier
4. FOR Tag Team Battles, THE Onboarding_System SHALL explain:
   - Require at least 2 robots to participate
   - Scheduled during tag team cycles
   - Different strategic considerations (team composition)
   - Additional battle participation opportunity
5. FOR Tournament Battles, THE Onboarding_System SHALL explain:
   - Special events with bracket-style competition
   - Higher rewards than regular battles
   - Elimination format
   - Scheduled at specific times
6. THE Onboarding_System SHALL explain daily cycle scheduling:
   - League cycles run at specific times (e.g., 8 PM UTC)
   - Tag team cycles run at different times (e.g., 12 PM UTC)
   - Tournament cycles scheduled separately
   - Settlement cycles process rewards (e.g., 11 PM UTC)
7. THE Onboarding_System SHALL explain battle participation:
   - Robots automatically matched during cycles
   - No manual battle initiation required
   - Check battle results after cycle completes
   - Repair robots between battles
8. THE Onboarding_System SHALL explain how 2-3 robot strategies unlock Tag Team battles
9. THE Onboarding_System SHALL display cycle schedule with times in player's timezone
10. THE Onboarding_System SHALL explain where to view upcoming battles and battle history
11. WHEN player acknowledges understanding, THE Onboarding_System SHALL advance to next step

### Requirement 16: Visual Design and Image Requirements

**User Story:** As a new player, I want visual representations of strategic choices, so that I can quickly understand options and make informed decisions across all devices.

#### Acceptance Criteria

1. THE Onboarding_System SHALL work smoothly on web browsers AND mobile devices
2. THE Onboarding_System SHALL work intuitively across desktop, tablet, and mobile platforms
3. THE Onboarding_System SHALL use images to accentuate strategic choices and options
4. THE Onboarding_System SHALL include the following images:
   - Roster strategy visualization: 1 robot (single powerful robot), 2 robots (balanced pair), 3 robots (diverse team)
   - Loadout type diagrams: Single weapon, Weapon+Shield, Two-Handed, Dual-Wield configurations
   - Facility icons: Visual representation of each facility type
   - Weapon type icons: Energy, Ballistic, Melee, Shield visual indicators
   - Battle type illustrations: League battle, Tag Team battle, Tournament battle scenes
   - Budget allocation charts: Pie charts or bar graphs showing credit distribution
   - Attribute bonus visualization: How weapon bonuses stack with robot attributes
   - Cycle schedule timeline: Visual representation of daily cycle timing
5. THE Onboarding_System SHALL ensure all images are:
   - Responsive and scale appropriately for mobile devices
   - Optimized for fast loading (< 100KB per image)
   - Accessible with alt text descriptions
   - Consistent with game's visual design system
6. THE Onboarding_System SHALL use images to highlight:
   - Strategic decision points (roster choice, loadout selection)
   - Facility priorities (visual hierarchy of importance)
   - Budget allocation recommendations (visual spending breakdown)
   - Battle readiness status (visual indicators)
7. WHERE images cannot be generated by AI, THE Onboarding_System SHALL document required images:
   - Image name and purpose
   - Recommended dimensions
   - Required visual elements
   - Context where image will be used
8. THE Onboarding_System SHALL provide image specifications for designers:
   - Roster strategy cards: 400×300px, showing robot count and key characteristics
   - Loadout diagrams: 300×200px, showing weapon configuration
   - Facility icons: 64×64px, consistent style across all facilities
   - Battle type illustrations: 600×400px, showing battle scenario
   - Budget charts: 400×400px, interactive or static visualization
9. THE Onboarding_System SHALL ensure touch targets on mobile are at least 44×44px
10. THE Onboarding_System SHALL test visual design on:
    - Desktop browsers (Chrome, Firefox, Safari, Edge)
    - Mobile browsers (iOS Safari, Android Chrome)
    - Tablet devices (iPad, Android tablets)

### Requirement 17: Navigation Flow Evaluation and Redesign

**User Story:** As a new player completing onboarding, I want intuitive navigation that makes sense with my new understanding, so that I can easily access the features I need.

#### Acceptance Criteria

1. THE Onboarding_System SHALL evaluate current navigation flow for new player experience
2. THE Onboarding_System SHALL identify navigation issues revealed by onboarding:
   - Are facility pages easy to find after learning their importance?
   - Is weapon shop accessible when players need to buy weapons?
   - Can players easily find robot management after creation?
   - Is battle history accessible after learning about cycles?
3. THE Onboarding_System SHALL recommend navigation improvements based on onboarding flow:
   - Primary navigation items should match onboarding priorities
   - Facility page should be prominent (critical early decision)
   - Weapon shop should be easily accessible
   - Robot management should be central
   - Battle results should be easy to find
4. THE Onboarding_System SHALL consider navigation patterns:
   - Dashboard as central hub with quick access to key features
   - Grouped navigation: "My Robots", "Facilities", "Shop", "Battles"
   - Contextual navigation based on player's current needs
5. THE Onboarding_System SHALL evaluate mobile navigation:
   - Hamburger menu vs bottom navigation bar
   - Touch-friendly navigation elements
   - Consistent navigation across screen sizes
6. THE Onboarding_System SHALL propose navigation structure that aligns with onboarding education:
   - If onboarding teaches "facilities first", facilities should be prominent
   - If onboarding emphasizes robot management, make it central
   - If battle participation is key, battle pages should be accessible
7. THE Onboarding_System SHALL test proposed navigation with new players
8. THE Onboarding_System SHALL document navigation changes required:
   - Current navigation structure
   - Identified issues
   - Proposed improvements
   - Rationale for changes
9. THE Onboarding_System SHALL ensure navigation changes don't confuse existing players
10. THE Onboarding_System SHALL provide migration path if navigation structure changes significantly

### Requirement 18: Facility Benefits Explanation

**User Story:** As a new player, I want to understand why facility order matters and what benefits each facility provides, so that I can make informed facility investment decisions.

#### Acceptance Criteria

1. THE Onboarding_System SHALL explain facility benefits with concrete examples
2. FOR Weapons Workshop, THE Onboarding_System SHALL explain:
   - Provides 5-50% discount on weapon purchases (5% per level)
   - Level 1 costs ₡100K, provides 5% discount
   - Example: ₡275K weapon costs ₡261K with Level 1 (saves ₡14K)
   - Example: ₡275K weapon costs ₡206K with Level 5 (saves ₡69K)
   - Pays for itself after 7-8 weapon purchases at Level 1
   - Essential for multi-robot strategies (need 2-6 weapons)
3. FOR Training Facility, THE Onboarding_System SHALL explain:
   - Provides 10-90% discount on attribute upgrades (10% per level)
   - Level 1 costs ₡150K, provides 10% discount
   - Example: Level 10→11 upgrade costs ₡16,500 normally, ₡14,850 with Level 1
   - Saves ₡186K when upgrading all 23 attributes from 1→10
   - Pays for itself quickly with regular upgrades
   - Essential for all strategies, especially 1 Mighty Robot
4. FOR Roster Expansion, THE Onboarding_System SHALL explain:
   - Required to create 2nd and 3rd robots
   - Level 1 (₡150K) unlocks 2nd robot slot
   - Level 2 (₡300K) unlocks 3rd robot slot
   - Cannot create additional robots without this facility
   - Hard requirement for 2-3 robot strategies
5. FOR Storage Facility, THE Onboarding_System SHALL explain:
   - Increases weapon storage capacity from 5 to 55 weapons
   - Level 1 (₡100K) provides 10 weapon slots
   - Each level adds +5 weapon slots
   - Important for 2-3 robot strategies (need 4-6 weapons minimum)
   - Prevents "storage full" errors when purchasing weapons
6. FOR Repair Bay, THE Onboarding_System SHALL explain:
   - Reduces repair costs by 5-55% (5% per level, plus multi-robot discount)
   - Level 1 (₡200K) provides 5% discount
   - Multi-robot discount: additional 5-45% based on active robots
   - Example: 2 robots with Level 1 = 15% total discount
   - Pays for itself over time with regular battle damage
7. THE Onboarding_System SHALL display facility ROI (return on investment) estimates
8. THE Onboarding_System SHALL explain facility operating costs are deducted daily
9. THE Onboarding_System SHALL explain higher facility levels require prestige thresholds

### Requirement 19: Budget Visualization

**User Story:** As a new player, I want to see visual representations of budget allocation, so that I can understand how to distribute my ₡3,000,000 starting credits.

#### Acceptance Criteria

1. THE Onboarding_System SHALL display budget allocation as pie chart or bar chart
2. THE chart SHALL show recommended spending by category:
   - Facilities (color: blue)
   - Robots (color: green)
   - Weapons (color: red)
   - Attribute Upgrades (color: yellow)
   - Reserve (color: gray)
3. THE chart SHALL update based on player's chosen Roster_Strategy
4. THE Onboarding_System SHALL display spending tracker showing:
   - Starting budget: ₡3,000,000
   - Spent so far: ₡X
   - Remaining: ₡Y
   - Recommended reserve: ₡100,000
5. THE spending tracker SHALL update in real-time as player makes purchases
6. THE Onboarding_System SHALL display warning when remaining credits < ₡600,000
7. THE Onboarding_System SHALL display critical warning when remaining credits < ₡200,000
8. THE Onboarding_System SHALL show comparison: "Your spending vs recommended for [Strategy]"
9. THE Onboarding_System SHALL highlight categories where player is over/under recommended budget

### Requirement 20: Onboarding Completion and Persistence

**User Story:** As a new player, I want my onboarding progress saved, so that I can resume if interrupted and review my strategic choices later.

#### Acceptance Criteria

1. THE Onboarding_System SHALL persist Tutorial_State to database after each step completion
2. THE Tutorial_State SHALL store:
   - Current step number
   - Completion status (in_progress, completed, skipped)
   - Chosen Roster_Strategy
   - Robots created during onboarding
   - Weapons purchased during onboarding
   - Facilities purchased during onboarding
   - Timestamp of last activity
3. WHEN player logs out and returns, THE Onboarding_System SHALL resume from last completed step
4. WHEN onboarding is completed, THE Onboarding_System SHALL mark Tutorial_State as completed
5. THE Onboarding_System SHALL not display tutorial prompts for users with completed Tutorial_State
6. THE Onboarding_System SHALL provide "Replay Tutorial" option in settings page
7. WHEN tutorial is replayed, THE Onboarding_System SHALL create new Tutorial_State without affecting player's actual robots/weapons

### Requirement 21: Guided UI Overlays and Highlights

**User Story:** As a new player, I want visual guidance showing me where to click, so that I don't get lost in the interface.

#### Acceptance Criteria

1. THE Guided_UI SHALL display semi-transparent overlay dimming non-relevant UI elements
2. THE Guided_UI SHALL highlight target elements with bright border and pulsing animation
3. THE Guided_UI SHALL display tooltip boxes with arrows pointing to target elements
4. THE Guided_UI SHALL position tooltips to avoid covering target elements
5. THE Guided_UI SHALL use consistent styling: dark background, primary border, readable text
6. THE Guided_UI SHALL include "Next" button in tooltips when no action is required
7. THE Guided_UI SHALL automatically advance when required action is completed

### Requirement 22: Skip and Resume Functionality

**User Story:** As a player, I want the option to skip the tutorial or resume later, so that I have flexibility in my learning experience.

#### Acceptance Criteria

1. THE Onboarding_System SHALL display "Skip Tutorial" button in top-right of overlay
2. WHEN "Skip Tutorial" is clicked, THE Onboarding_System SHALL display confirmation dialog
3. THE confirmation dialog SHALL warn that skipping may lead to poor decisions
4. IF skip is confirmed, THEN THE Onboarding_System SHALL mark Tutorial_State as skipped
5. THE Onboarding_System SHALL provide skip/resume functionality in player settings or profile page
6. THE Onboarding_System SHALL allow resuming tutorial from settings page if skipped
7. WHEN tutorial is resumed, THE Onboarding_System SHALL start from Step 1
8. THE Onboarding_System SHALL persist Tutorial_State across sessions
9. THE Onboarding_System SHALL evaluate optimal location for skip/resume controls (settings page, profile, or other)
10. THE Onboarding_System SHALL ensure skip/resume functionality is discoverable but not intrusive

### Requirement 23: Critical Mistake Prevention

**User Story:** As a new player, I want the system to prevent me from making game-breaking mistakes, so that I don't get stuck unable to play.

#### Acceptance Criteria

1. THE Onboarding_System SHALL block facility purchases until Strategy_Path is established (after Step 4)
2. THE Onboarding_System SHALL block attribute upgrades during onboarding until Training Facility education is complete
3. IF player attempts blocked action, THEN THE Onboarding_System SHALL display explanation message
4. THE Onboarding_System SHALL validate Battle_Readiness_Check before allowing onboarding completion
5. THE Battle_Readiness_Check SHALL verify: robot exists, weapon equipped, credits ≥ ₡100,000
6. IF Battle_Readiness_Check fails, THEN THE Onboarding_System SHALL display specific error and required actions
7. THE Onboarding_System SHALL prevent navigation away from onboarding flow until Step 8 is completed
8. THE Onboarding_System SHALL warn if player's spending deviates significantly from recommended Budget_Allocation
9. THE Onboarding_System SHALL prevent purchasing weapons that exceed storage capacity
10. THE Onboarding_System SHALL prevent creating robots beyond available roster slots

### Requirement 24: Mobile Responsiveness

**User Story:** As a mobile player, I want the tutorial to work on my device, so that I can complete onboarding on any screen size.

#### Acceptance Criteria

1. THE Guided_UI SHALL adapt tooltip positioning for mobile screens (<768px width)
2. THE Guided_UI SHALL use full-width tooltips on mobile devices
3. THE Guided_UI SHALL ensure touch targets are at least 44×44px
4. THE Onboarding_System SHALL disable horizontal scrolling during tutorial
5. THE Guided_UI SHALL position tooltips above or below target elements on mobile
6. THE Onboarding_System SHALL test on iOS Safari and Android Chrome
7. THE Guided_UI SHALL use readable font sizes (minimum 14px) on mobile

### Requirement 25: Accessibility Compliance

**User Story:** As a player using assistive technology, I want the tutorial to be accessible, so that I can complete onboarding regardless of my abilities.

#### Acceptance Criteria

1. THE Guided_UI SHALL support keyboard navigation (Tab, Enter, Escape keys)
2. THE Guided_UI SHALL provide ARIA labels for all interactive elements
3. THE Guided_UI SHALL announce step changes to screen readers
4. THE Guided_UI SHALL maintain focus management during step transitions
5. THE Onboarding_System SHALL provide text alternatives for all visual indicators
6. THE Guided_UI SHALL meet WCAG 2.1 AA contrast requirements (4.5:1 for text)
7. THE Onboarding_System SHALL allow dismissing overlays with Escape key

### Requirement 26: Analytics and Tracking

**User Story:** As a game developer, I want to track onboarding completion rates and strategic choices, so that I can identify where players struggle and which strategies are most popular.

#### Acceptance Criteria

1. THE Onboarding_System SHALL log step completion events to analytics system
2. THE Onboarding_System SHALL track time spent on each step
3. THE Onboarding_System SHALL track skip rate and skip reasons (if provided)
4. THE Onboarding_System SHALL track completion rate (completed vs skipped vs abandoned)
5. THE Onboarding_System SHALL track common mistakes (blocked actions attempted)
6. THE Onboarding_System SHALL track Roster_Strategy selection distribution (1 vs 2 vs 3 robots)
7. THE Onboarding_System SHALL track facility purchase patterns during onboarding
8. THE Onboarding_System SHALL track weapon type preferences by strategy
9. THE Onboarding_System SHALL track budget allocation patterns by strategy
10. THE Onboarding_System SHALL provide dashboard showing onboarding funnel metrics
11. THE Onboarding_System SHALL track correlation between strategy choice and player retention
12. THE Onboarding_System SHALL track correlation between onboarding completion and first battle success

### Requirement 27: Tutorial Content Localization

**User Story:** As a non-English player, I want the tutorial in my language, so that I can understand the guidance.

#### Acceptance Criteria

1. THE Onboarding_System SHALL support multiple languages (English, Spanish, French, German)
2. THE Onboarding_System SHALL detect browser language and use appropriate translation
3. THE Onboarding_System SHALL provide language selector in tutorial settings
4. THE Onboarding_System SHALL store all tutorial text in translation files (i18n)
5. THE Onboarding_System SHALL ensure translations fit within tooltip dimensions
6. THE Onboarding_System SHALL use culturally appropriate examples and terminology
7. THE Onboarding_System SHALL fallback to English if translation is unavailable

### Requirement 28: Performance and Loading

**User Story:** As a player, I want the tutorial to load quickly, so that I can start playing without delays.

#### Acceptance Criteria

1. THE Onboarding_System SHALL load tutorial assets asynchronously
2. THE Onboarding_System SHALL preload tutorial content during registration
3. THE Guided_UI SHALL render overlays within 100ms of step transition
4. THE Onboarding_System SHALL minimize API calls (batch data fetching)
5. THE Onboarding_System SHALL cache tutorial content in browser storage
6. THE Onboarding_System SHALL display loading indicator if step takes >500ms
7. THE Onboarding_System SHALL optimize images and animations for performance
