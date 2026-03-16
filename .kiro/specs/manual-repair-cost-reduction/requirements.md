# Requirements Document

## Introduction

This feature reduces the cost of all manual robot repairs by 50%. When a player clicks "Repair All" on the robots page, the final cost (after all existing discounts) is halved. Automatic repairs triggered during cycle processing (before league, tag team, and tournament battles) remain at full price. This change encourages players to actively manage their roster between cycles rather than relying solely on automatic pre-battle repairs.

## Glossary

- **Manual_Repair**: A repair initiated by the player via the "Repair All" button on the robots page, calling the `POST /api/robots/repair-all` endpoint.
- **Automatic_Repair**: A repair triggered by the cycle scheduler before league, tag team, or tournament battles via `repairAllRobots(true)` in `cycleScheduler.ts`.
- **Repair_Cost_System**: The backend system that calculates repair costs using base attribute sums, damage percentages, HP-based multipliers, and Repair Bay discounts.
- **Manual_Repair_Discount**: A fixed 50% reduction applied to the final cost of manual repairs, applied after all other discounts (Repair Bay, Medical Bay).
- **Repair_Bay**: A player facility that provides a percentage discount on repair costs. Discount formula: `Level × (5 + activeRobotCount)`, capped at 90%.
- **Frontend_Cost_Display**: The cost shown to the player on the "Repair All" button and in the repair confirmation modal on the robots page.
- **Test_Suite**: The Jest test suite with fast-check property-based testing library used to verify backend repair cost calculations and discount logic.
- **Audit_Log**: The `auditLog` database table that records game events including repair actions, with `eventType`, `userId`, `payload`, and `eventTimestamp` fields.
- **Admin_Panel**: The admin interface accessible via `/api/admin` routes that allows administrators to query and inspect game events and player activity.

## Requirements

### Requirement 1: Apply 50% Discount to Manual Repair Backend Cost

**User Story:** As a player, I want manual repairs to cost 50% less, so that I can save credits by actively repairing my robots between cycles.

#### Acceptance Criteria

1. WHEN a player triggers a manual repair via the `POST /api/robots/repair-all` endpoint, THE Repair_Cost_System SHALL multiply the final cost (after Repair Bay discount) by 0.5 and round down to the nearest integer.
2. WHEN a player triggers a manual repair, THE Repair_Cost_System SHALL apply the Manual_Repair_Discount after all existing discounts (Repair Bay discount, Medical Bay multiplier reduction).
3. WHEN a player triggers a manual repair with a Repair Bay discount of 0%, THE Repair_Cost_System SHALL still apply the 50% Manual_Repair_Discount to the base cost.
4. THE `POST /api/robots/repair-all` endpoint SHALL return the Manual_Repair_Discount percentage in its response payload alongside the existing `discount` and `finalCost` fields.

### Requirement 2: Preserve Automatic Repair Costs

**User Story:** As a game designer, I want automatic pre-battle repairs to remain at full price, so that the economy balance for cycle processing is not affected.

#### Acceptance Criteria

1. WHILE the cycle scheduler is executing league, tag team, or tournament battle processing, THE Repair_Cost_System SHALL calculate repair costs without applying the Manual_Repair_Discount.
2. THE `repairAllRobots()` function in `repairService.ts` SHALL continue to use the existing cost formula without any manual repair discount.
3. WHEN the cycle scheduler calls `repairAllRobots(true)`, THE Repair_Cost_System SHALL produce identical costs to the current implementation.

### Requirement 3: Update Frontend Cost Display

**User Story:** As a player, I want to see the correct discounted repair cost on the robots page, so that I know exactly how much I will pay before confirming.

#### Acceptance Criteria

1. THE Frontend_Cost_Display SHALL show the repair cost with the 50% Manual_Repair_Discount already applied on the "Repair All" button label.
2. THE Frontend_Cost_Display SHALL show the 50% Manual_Repair_Discount in the repair confirmation modal so the player understands the discount breakdown.
3. WHEN the player has a Repair Bay discount active, THE Frontend_Cost_Display SHALL show both the Repair Bay discount percentage and the 50% manual repair discount as separate line items in the confirmation modal.
4. WHEN no robots need repair, THE Frontend_Cost_Display SHALL continue to disable the "Repair All" button regardless of the Manual_Repair_Discount.

### Requirement 4: No Currency Gate on Manual Repairs

**User Story:** As a player with negative credits, I want to still be able to manually repair my robots at the discounted price, so that I can stay competitive and recover from financial hardship through active play.

#### Acceptance Criteria

1. WHEN a player triggers a manual repair, THE Repair_Cost_System SHALL allow the repair regardless of the player's current credit balance, including negative balances.
2. THE Repair_Cost_System SHALL deduct the discounted final cost from the player's balance, which may result in a negative balance.
3. Manual repairs SHALL be the ONLY transaction in the game permitted when a player has negative credits. All other purchases (weapons, facilities, upgrades) remain blocked.

### Requirement 5: Audit Logging for Manual Repair Discount

**User Story:** As a game designer, I want manual repair discounts to be tracked in logs, so that I can monitor the economic impact of the discount.

#### Acceptance Criteria

1. WHEN a manual repair is completed, THE Repair_Cost_System SHALL log the Manual_Repair_Discount percentage alongside the existing repair event data.
2. THE `POST /api/robots/repair-all` endpoint SHALL include the pre-discount cost and post-discount cost in its response so the savings are transparent.

### Requirement 6: Test Coverage for Manual Repair Discount

**User Story:** As a developer, I want comprehensive test coverage for the manual repair discount, so that I can verify the discount is applied correctly and automatic repairs remain unaffected.

#### Acceptance Criteria

1. THE Test_Suite SHALL include unit tests that verify the 50% Manual_Repair_Discount is applied to the final cost after all existing discounts (Repair Bay, Medical Bay).
2. THE Test_Suite SHALL include unit tests that verify `Math.floor` rounding is applied to the discounted cost for odd-valued inputs.
3. THE Test_Suite SHALL include regression tests that verify Automatic_Repair costs produced by `repairAllRobots(true)` remain identical to the current implementation without any Manual_Repair_Discount applied.
4. THE Test_Suite SHALL include property-based tests using fast-check that verify FOR ALL valid attribute sums, damage percentages, and Repair Bay levels, the manual repair cost equals `Math.floor(automaticRepairCost * 0.5)`.
5. THE Test_Suite SHALL include a property-based test using fast-check that verifies FOR ALL valid inputs, the manual repair cost is less than or equal to the automatic repair cost.
6. THE Test_Suite SHALL include a property-based test using fast-check that verifies FOR ALL valid inputs, the manual repair cost is non-negative.
7. WHEN a Repair Bay discount of 90% is active, THE Test_Suite SHALL verify the Manual_Repair_Discount is still applied on top of the maximum facility discount.

### Requirement 7: Admin Visibility for Manual vs Automatic Repairs

**User Story:** As an admin, I want to distinguish manual repairs from automatic repairs in the audit log, so that I can verify the manual repair discount is working correctly and monitor player repair behavior.

#### Acceptance Criteria

1. WHEN a manual repair is completed, THE Audit_Log SHALL record the `robot_repair` event with a `repairType` field set to `"manual"` in the event payload.
2. WHEN an automatic repair is completed during cycle processing, THE Audit_Log SHALL record the `robot_repair` event with a `repairType` field set to `"automatic"` in the event payload.
3. WHEN a manual repair is completed, THE Audit_Log SHALL include the `manualRepairDiscount` percentage and the `preDiscountCost` in the event payload alongside the existing `cost`, `damageTaken`, and `repairBayDiscount` fields.
4. THE Admin_Panel SHALL provide an API endpoint or query parameter that allows filtering `robot_repair` audit log events by `repairType` (`"manual"` or `"automatic"`).
5. WHEN an admin queries manual repair events, THE Admin_Panel SHALL return the player's userId, stableName, robotId, robotName, repairType, cost, preDiscountCost, manualRepairDiscount, and eventTimestamp for each event.
6. THE Admin_Panel SHALL support filtering manual repair events by date range so admins can analyze discount usage over specific time periods.
