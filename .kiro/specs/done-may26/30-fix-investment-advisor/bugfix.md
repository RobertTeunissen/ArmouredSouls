# Bugfix Requirements Document

## Introduction

The Investments & ROI tab and Investment Advisor tab on the Facilities page (`/facilities`) display empty lists or incorrect numbers. The root cause is that `roiCalculatorService.calculateFacilityROI()` returns `null` when it cannot find a `facility_purchase` audit log event for a facility, even though the facility exists in the database at a non-zero level. The analytics route converts this `null` into a 404 error, and the frontend silently filters out 404 responses, resulting in an empty `facilityROIs` array. Additionally, there are two separate ROI calculation approaches in the codebase (audit-log-based historical in `roiCalculatorService.ts` and formula-based projections in `economyCalculations.ts`) that should be consolidated into a single consistent methodology.

## Expected Contribution

This spec fixes a broken player-facing feature (backlog #1, WSJF rank 2) and eliminates a source of calculation inconsistency in the economy system.

1. **Investments tab shows data for all owned facilities**: Before — players with facilities see "No facility data available" empty state. After — all owned facilities (level > 0) display ROI metrics regardless of audit log completeness.
2. **Advisor tab produces recommendations**: Before — empty "No investment recommendations available" message. After — meaningful upgrade recommendations based on facility configuration and available history.
3. **Single ROI calculation path**: Before — two separate functions (`roiCalculatorService.calculateFacilityROI` and `economyCalculations.calculateFacilityROI`) that can produce conflicting numbers. After — one unified service that both tabs and the `/finances` route use.
4. **Graceful degradation with incomplete audit data**: Before — missing a single audit event causes the entire facility to disappear from the UI. After — partial data is displayed with formula-based estimates filling gaps.
5. **Consistent with other financial pages**: The `/income` and `/cycle-summary` pages also use historical credit data. This fix ensures the facility ROI calculations align with how those pages source and present financial data.
6. **Eliminate duplicate UI**: Before — two tabs ("Investments & ROI" and "Investment Advisor") show the same facility performance cards duplicated, and include non-economic facilities that have no ROI to track. After — one consolidated tab with an overhauled layout shows only the 5 economic facilities (Merchandising Hub, Streaming Studio, Repair Bay, Training Facility, Weapons Workshop) with their performance and recommendations combined.

### Verification Criteria

After all tasks are complete, run these checks:

1. `curl -H "Authorization: Bearer <token>" http://localhost:3001/api/analytics/facility/{userId}/roi?facilityType=merchandising_hub` returns 200 with ROI data (not 404) for any user who owns the facility
2. `curl -H "Authorization: Bearer <token>" http://localhost:3001/api/analytics/facility/{userId}/recommendations?lastNCycles=10` returns at least one recommendation for a user with facilities
3. `grep -r "calculateFacilityROI" app/backend/src/ --include="*.ts" | grep -v test | grep -v ".d.ts"` shows only one implementation (the unified service), not two separate functions
4. The Investments tab on `/facilities` displays ROI cards for all owned economy facilities when viewed in a browser
5. All existing economy tests pass: `cd app/backend && npx jest tests/economyCalculations.test.ts tests/prestigeFeatures.integration.test.ts --no-coverage`

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user owns a facility (level > 0) but no `facility_purchase` audit log event exists for that facility THEN the system returns `null` from `calculateFacilityROI()`, which the route converts to a 404 error, and the frontend filters it out — resulting in an empty Investments & ROI tab

1.2 WHEN a user owns a facility and the `facility_purchase` event exists but downstream audit log events (`passive_income`, `operating_costs`, `robot_repair`, `attribute_upgrade`, `weapon_purchase`, `battle_complete`) are missing or have mismatched payload structures THEN the system returns zero values for `totalReturns`, `totalOperatingCosts`, and `netROI`, displaying misleading "0%" ROI and "₡0" returns

1.3 WHEN the Investment Advisor tab calls `facilityRecommendationService.generateRecommendations()` and the underlying `roiCalculatorService.calculateAllFacilityROIs()` returns empty results due to missing audit events THEN the recommendations engine has no historical performance data to base its projections on, producing either no recommendations or recommendations with inaccurate projected payoff periods

1.4 WHEN the system calculates ROI for the same facility THEN there are two inconsistent calculation paths — `roiCalculatorService.calculateFacilityROI()` (audit-log-based historical) and `economyCalculations.calculateFacilityROI()` (formula-based projections) — that can produce conflicting numbers for the same facility

1.5 WHEN a user navigates between the "Investments & ROI" tab and the "Investment Advisor" tab THEN they see the same facility performance cards (facility name, level, net ROI, investment, returns, operating costs, breakeven, ownership duration) duplicated on both tabs, with a cluttered layout that includes non-economic facilities and outdated educational content — the two tabs are fundamentally broken in both data and presentation and need to be replaced entirely

### Expected Behavior (Correct)

2.1 WHEN a user owns a facility (level > 0) but no `facility_purchase` audit log event exists THEN the system SHALL still calculate and return ROI data by inferring the purchase cycle from available data (e.g., the earliest audit event referencing that facility, or falling back to cycle 1) rather than returning null/404

2.2 WHEN a user owns a facility and some downstream audit log events are missing or incomplete THEN the system SHALL return partial ROI data with the available information (showing actual zeros only when genuinely no returns have been earned) and SHALL NOT fail silently or return misleading calculations based on incomplete event payloads

2.3 WHEN the new tab generates upgrade recommendations THEN the system SHALL produce meaningful recommendations based on facility configuration and current game state (upgrade costs, operating costs, known income rates, user's prestige and robot count) without requiring the user to select an analysis period — no "last N cycles" selector

2.4 WHEN the system calculates ROI for a facility THEN there SHALL be a single unified approach that uses `CycleSnapshot.stableMetrics` as the data source (which already aggregates merchandisingIncome, streamingIncome, operatingCosts, totalRepairCosts, attributeUpgrades, weaponPurchases, and facilityPurchases per user per cycle), eliminating the need to query individual audit log events and eliminating duplicate calculation paths between `roiCalculatorService` and `economyCalculations`

2.5 WHEN the user views facility financial data THEN the existing "Investments & ROI" and "Investment Advisor" tabs SHALL be removed and replaced with a single new tab that has a clean, overhauled layout showing a lifetime overview per facility — total investment, total returns, whether it's paid off, and if not, projected payoff — with no cycle-range selectors or period filters

2.6 WHEN the new consolidated tab displays facility ROI data THEN it SHALL only show facilities that have economic components (Merchandising Hub, Streaming Studio, Repair Bay, Training Facility, Weapons Workshop) — facilities that provide capability unlocks without direct financial returns (academies, roster expansion, storage, booking office, tuning bay) SHALL NOT appear in the ROI/investment view

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user has complete audit log history for all their facilities (purchase events, income events, operating cost events) THEN the system SHALL CONTINUE TO calculate accurate historical ROI with correct investment totals, returns, operating costs, net ROI percentage, and breakeven cycle

3.2 WHEN the frontend receives valid ROI data from the API THEN the system SHALL CONTINUE TO display facility performance cards with investment, operating costs, returns, net profit, breakeven cycle, and ownership duration in the Investments tab

3.3 WHEN the frontend receives valid recommendation data from the API THEN the system SHALL CONTINUE TO display upgrade recommendations with facility name, current/recommended level, upgrade cost, projected payoff period, reason, and priority in the Advisor tab

3.4 WHEN the `POST /api/finances/roi-calculator` endpoint is called for prospective upgrade analysis THEN the system SHALL CONTINUE TO return projected ROI metrics (breakeven days, net 30/90/180 day projections) for facilities the user is considering upgrading

3.5 WHEN facility purchases and upgrades occur via `POST /api/facilities/upgrade` THEN the system SHALL CONTINUE TO log `facility_purchase` and `facility_upgrade` audit events with the existing payload structure (facilityType, oldLevel, newLevel, cost, action, balanceBefore, balanceAfter)

3.6 WHEN the cycle processor runs and calculates passive income and operating costs THEN the system SHALL CONTINUE TO log `passive_income` and `operating_costs` audit events with their existing payload structures

### Testing Requirements

4.1 WHEN the old `InvestmentsTab` and `AdvisorTab` components are removed THEN their existing test files SHALL be removed or replaced with tests for the new consolidated component

4.2 WHEN the new consolidated tab is built THEN it SHALL have frontend component tests covering: rendering with ROI data, rendering empty state, rendering recommendations, and only showing economic facilities

4.3 WHEN the unified ROI calculation service is built (using cycle snapshots) THEN it SHALL have backend unit tests covering: correct ROI calculation from snapshot data, graceful handling of missing snapshots, correct filtering to economic-only facilities, and consistency with the data shown on `/income` and `/cycle-summary`

4.4 WHEN the backend API endpoint is updated THEN it SHALL have integration tests verifying the endpoint returns correct data for users with facilities and handles edge cases (no facilities, facility with no snapshot history)

### Documentation Requirements

5.1 WHEN the fix is complete THEN the in-game guide content that explains prestige bonuses and facility ROI (visible on the Facilities page and Leaderboards page) SHALL be updated to reflect the new consolidated layout and correct formula descriptions

5.2 WHEN the fix is complete THEN `docs/game-systems/PRD_ECONOMY_SYSTEM.md` SHALL be updated to reflect the unified ROI calculation approach (cycle-snapshot-based) and removal of the dual-path calculation

5.3 WHEN the fix is complete THEN `docs/prd_pages/PRD_FACILITIES_PAGE.md` SHALL be updated to reflect the new tab structure (two tabs instead of three) and the consolidated investment/advisor view

5.4 WHEN the fix is complete THEN the backlog item #1 in `docs/BACKLOG.md` SHALL be marked as completed in the "Recently Completed" table
