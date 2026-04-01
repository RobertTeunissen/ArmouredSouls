# Requirements Document

## Introduction

The Repair Bay facility currently provides a flat discount based solely on facility level (5% per level, max 50%). This update introduces a multi-robot bonus to incentivize players to build larger rosters and make multi-robot strategies more economically viable. The new formula adds a 1% discount per active robot owned by the stable, with a maximum cap of 90% to prevent exploits while providing significant value for large rosters.

## Glossary

- **Repair_Bay**: A stable facility that reduces repair costs for damaged robots
- **Active_Robot**: A robot owned by the stable, regardless of battle-ready status or current HP
- **Repair_Cost**: The amount of Credits (₡) required to restore a damaged robot to full health
- **Discount_Percentage**: The total percentage reduction applied to repair costs, calculated as repairBayLevel × (5 + activeRobotCount), capped at 90%
- **Base_Discount**: The base multiplier of 5% per Repair Bay level
- **Multi_Robot_Bonus**: Additional percentage per robot (1% per robot) that multiplies with the Repair Bay level
- **Stable**: The player's collection and management system for their robots
- **Roster_Expansion**: A facility that determines how many robot slots the stable has (1-10 robots)

## Requirements

### Requirement 1: Multi-Robot Discount Calculation

**User Story:** As a stable owner, I want repair costs to decrease based on both my Repair Bay level and the number of robots I own, so that managing multiple robots becomes more economically viable.

#### Acceptance Criteria

1. THE Repair_Cost_Calculator SHALL calculate discount using the formula: repairBayLevel × (5 + activeRobotCount)
2. THE Repair_Cost_Calculator SHALL apply a maximum cap of 90% to the total discount
3. WHEN the calculated discount exceeds 90%, THE Repair_Cost_Calculator SHALL use 90% as the discount value

### Requirement 2: Active Robot Count Retrieval

**User Story:** As a stable owner, I want the system to accurately count my active robots, so that I receive the correct multi-robot discount.

#### Acceptance Criteria

1. WHEN calculating repair costs, THE Repair_Cost_Calculator SHALL retrieve the count of active robots from the stable
2. THE Repair_Cost_Calculator SHALL count all robots owned by the stable regardless of their current HP status
3. THE Repair_Cost_Calculator SHALL count all robots occupying roster slots from the Roster_Expansion facility

### Requirement 3: Backward Compatibility

**User Story:** As a developer, I want the new discount formula to maintain the existing function signature, so that existing code continues to work without breaking changes.

#### Acceptance Criteria

1. THE Repair_Cost_Calculator SHALL accept activeRobotCount as a new parameter
2. WHEN activeRobotCount is not provided, THE Repair_Cost_Calculator SHALL default to 0 for backward compatibility
3. THE Repair_Cost_Calculator SHALL maintain all existing parameters (sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel, medicalBayLevel)
4. THE Repair_Cost_Calculator SHALL continue to apply Medical Bay reductions to the critical damage multiplier

### Requirement 4: Discount Formula Examples

**User Story:** As a stable owner, I want to understand how the discount scales with my investments, so that I can make informed decisions about facility upgrades and roster expansion.

#### Acceptance Criteria

1. WHEN Repair_Bay is Level 1 and stable has 4 robots, THE Repair_Cost_Calculator SHALL calculate 9% discount (1 × (5 + 4) = 9%)
2. WHEN Repair_Bay is Level 3 and stable has 2 robots, THE Repair_Cost_Calculator SHALL calculate 21% discount (3 × (5 + 2) = 21%)
3. WHEN Repair_Bay is Level 5 and stable has 7 robots, THE Repair_Cost_Calculator SHALL calculate 60% discount (5 × (5 + 7) = 60%)
4. WHEN Repair_Bay is Level 10 and stable has 10 robots, THE Repair_Cost_Calculator SHALL calculate 90% discount (10 × (5 + 10) = 150%, capped at 90%)
5. WHEN Repair_Bay is Level 6 and stable has 10 robots, THE Repair_Cost_Calculator SHALL calculate 90% discount (6 × (5 + 10) = 90%)
6. WHEN the calculated discount would exceed 90%, THE Repair_Cost_Calculator SHALL cap it at 90%

### Requirement 5: Documentation Updates

**User Story:** As a player, I want accurate documentation about the Repair Bay facility, so that I understand how the discount system works.

#### Acceptance Criteria

1. THE Documentation SHALL describe the new multi-robot discount formula in STABLE_SYSTEM.md
2. THE Documentation SHALL include examples showing discount calculations for various scenarios
3. THE Documentation SHALL update the Repair Bay facility description with the new formula
4. THE Documentation SHALL update PRD_FACILITIES_PAGE.md with the new benefits display
5. THE Documentation SHALL update PRD_ECONOMY_SYSTEM.md with the new discount formula
6. THE Documentation SHALL update PRD_BATTLE_STANCES_AND_YIELD.md with the new discount formula
7. THE Documentation SHALL clarify that facility upgrade costs remain unchanged
8. THE Documentation SHALL warn users when further Repair Bay or Roster Expansion investment provides no additional discount benefit (at 90% cap)
9. THE Documentation SHALL update all repair cost calculation examples to use the new formula
10. THE Documentation SHALL update ROI analysis sections to reflect the new multi-robot discount benefits

### Requirement 6: UI Consistency Across Pages

**User Story:** As a player, I want repair costs to be calculated consistently across all pages, so that I see accurate and synchronized information throughout the application.

#### Acceptance Criteria

1. THE Robots_Page SHALL use the updated repair cost formula for the "Repair All" feature
2. THE Robot_Detail_Page SHALL use the updated repair cost formula for individual robot repairs
3. THE Robot_Detail_Page SHALL use the updated repair cost formula when displaying Yield Threshold calculations
4. THE Income_Dashboard SHALL display actual incurred repair costs from completed repairs
5. THE Income_Pages SHALL reflect the discounted repair costs in financial summaries
6. WHEN displaying repair costs, ALL pages SHALL query the stable's current Repair Bay level and robot count

### Requirement 7: API Integration

**User Story:** As a developer, I want the repair cost calculation to integrate with the existing stable and robot data models, so that the discount is automatically applied when repairs are requested.

#### Acceptance Criteria

1. WHEN a repair cost is calculated, THE System SHALL query the stable's active robot count from the database
2. WHEN a repair cost is calculated, THE System SHALL query the stable's Repair Bay level from the database
3. THE System SHALL pass the active robot count to the calculateRepairCost function
4. THE System SHALL return the discounted repair cost to the caller

### Requirement 8: Repair Cost Calculation Consolidation

**User Story:** As a developer, I want a single canonical repair cost calculation function, so that repair costs are consistent across all battle types and system components.

#### Acceptance Criteria

1. THE System SHALL use a single canonical repair cost calculation function for all repair cost calculations
2. THE Canonical_Function SHALL be located in robotCalculations.ts
3. THE Canonical_Function SHALL use the attribute-sum formula: baseRepairCost × (damagePercent / 100) × multiplier × (1 - repairBayDiscount)
4. THE Canonical_Function SHALL support Medical Bay reduction for critical damage multiplier
5. THE Canonical_Function SHALL accept activeRobotCount parameter for multi-robot discount
6. WHEN calculating repair costs in tag team battles, THE System SHALL use the canonical function from robotCalculations.ts
7. WHEN calculating repair costs in league battles, THE System SHALL use the canonical function from robotCalculations.ts
8. WHEN calculating repair costs in tournament battles, THE System SHALL use the canonical function from robotCalculations.ts
9. WHEN calculating repair costs during cycle auto-repair (3 triggers per cycle), THE System SHALL use the canonical function from robotCalculations.ts
10. THE System SHALL remove the duplicate calculateRepairCostWithDiscounts function from economyCalculations.ts
11. THE System SHALL remove the calculateRepairCost function from tagTeamBattleOrchestrator.ts
12. THE System SHALL update all call sites to use the canonical function with consistent parameters

### Requirement 9: Testing Coverage

**User Story:** As a developer, I want comprehensive test coverage for the new discount formula and consolidated repair cost calculations, so that I can be confident the system works correctly across all scenarios.

#### Acceptance Criteria

1. THE Test_Suite SHALL include unit tests for the discount calculation formula
2. THE Test_Suite SHALL include property-based tests to verify the 90% cap is enforced
3. THE Test_Suite SHALL include tests for edge cases (0 robots, 1 robot, 10 robots, maximum discount)
4. THE Test_Suite SHALL include tests for backward compatibility (missing activeRobotCount parameter)
5. THE Test_Suite SHALL include integration tests verifying active robot count retrieval from the database
6. THE Test_Suite SHALL include tests verifying repair costs are consistent across league battles and tag team battles
7. THE Test_Suite SHALL include tests verifying the canonical function produces correct results for all damage scenarios
