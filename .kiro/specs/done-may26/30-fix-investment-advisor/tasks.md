# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Owned Economic Facilities Return Null/404 When Audit Events Missing
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists in `roiCalculatorService.calculateFacilityROI()`
  - **Scoped PBT Approach**: Use fast-check to generate random economic facility types from `['merchandising_hub', 'streaming_studio', 'repair_bay', 'training_facility', 'weapons_workshop']` with random levels 1-10
  - Test file: `app/backend/src/services/economy/__tests__/unifiedFacilityROI.bugcondition.property.test.ts`
  - Test setup: Create a user with a facility at level > 0 but NO `facility_purchase` audit log event
  - Property assertion: For all owned economic facilities, calling the ROI calculation returns non-null data with valid `totalInvestment`, `totalReturns >= 0`, and `netROI` fields (from Expected Behavior in design)
  - Bug condition from design: `facility.level > 0 AND facilityType IN economic_facilities AND (purchaseEvent IS NULL OR snapshotData.length === 0)`
  - Run test on UNFIXED code — expect FAILURE (roiCalculatorService returns null for missing purchase events)
  - Document counterexamples found (e.g., "calculateFacilityROI(userId, 'merchandising_hub') returns null when no facility_purchase audit event exists")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Investment Calculation and Non-ROI Operations Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Test file: `app/backend/src/services/economy/__tests__/unifiedFacilityROI.preservation.property.test.ts`
  - Observe on UNFIXED code: For any facility type and level, `totalInvestment` equals `sum(config.costs[0..level-1])` from `getFacilityConfig()`
  - Observe on UNFIXED code: The `/api/finances/roi-calculator` endpoint returns response with `breakevenDays`, `net30Days`, `net90Days`, `net180Days` fields
  - Observe on UNFIXED code: `facilityRecommendationService.generateRecommendations()` returns recommendations with `facilityName`, `priority`, `projectedPayoffCycles`, and `reason` fields
  - Write property-based test with fast-check: For all valid facility types and levels 1-10, `totalInvestment === sum(getFacilityConfig(type).costs.slice(0, level))` (from Preservation Requirements in design)
  - Write property-based test: For all non-economic facility types (roster_expansion, storage_facility, etc.), the unified service rejects them (does not return ROI data)
  - Write property-based test: ROI calculation is mathematically consistent — `netROI === (totalReturns - totalOperatingCosts - totalInvestment) / totalInvestment` for all generated inputs
  - Verify tests PASS on UNFIXED code (confirms baseline behavior to preserve)
  - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.6_

- [ ] 3. Create unified facility ROI service
  - [x] 3.1 Create `app/backend/src/services/economy/unifiedFacilityROIService.ts`
    - Implement `UnifiedFacilityROIService` class with `calculateFacilityROI(userId, facilityType)` method
    - Use `CycleSnapshot.stableMetrics` as primary data source (query snapshots, extract user's `StableMetric` per cycle)
    - Sum relevant fields per facility type: `merchandisingIncome` for Merchandising Hub, `streamingIncome` for Streaming Studio, estimate savings from `totalRepairCosts`/`attributeUpgrades`/`weaponPurchases` + facility discount formula for discount facilities
    - Calculate `totalInvestment` from `getFacilityConfig(type).costs.slice(0, level).reduce(sum)`
    - Determine purchase cycle: try `facility_purchase` audit event first, fallback to earliest snapshot with activity, final fallback to cycle 1
    - Implement formula-based fallback when no snapshots exist (merchandising: `baseIncome[level] × prestigeMultiplier × cyclesOwned`, streaming: `avgStreamingPerBattle × avgBattlesPerCycle × cyclesOwned`, discount: `avgSpendingPerCycle × discountPercent × cyclesOwned`)
    - Include `dataSource: 'snapshot' | 'estimate'` in response
    - Compute `paidOff = (totalReturns - totalOperatingCosts) >= totalInvestment` and `projectedPayoffCycles` when not paid off
    - Only accept the 5 economic facility types — reject non-economic types
    - _Bug_Condition: isBugCondition(input) where facility.level > 0 AND purchaseEvent IS NULL OR snapshotData incomplete_
    - _Expected_Behavior: Always return valid ROI data for owned economic facilities, never null/404_
    - _Preservation: totalInvestment calculation must match sum(config.costs[0..level-1])_
    - _Requirements: 2.1, 2.2, 2.4_

  - [x] 3.2 Implement `calculateAllEconomicROIs(userId)` method
    - Query all user facilities where level > 0 and type is one of the 5 economic types
    - Call `calculateFacilityROI` for each and return array
    - Include overall totals (totalInvestment, totalReturns, totalOperatingCosts, overallNetROI)
    - _Requirements: 2.4, 2.6_

  - [x] 3.3 Implement `calculateProjectedROI(userId, facilityType, targetLevel)` method
    - Replace `economyCalculations.calculateFacilityROI` functionality
    - Keep same response shape: `upgradeCost`, `dailyCostIncrease`, `dailyBenefitIncrease`, `netDailyChange`, `breakevenDays`, `net30Days`, `net90Days`, `net180Days`, `affordable`, `recommendation`, `recommendationType`
    - Use unified data source (cycle snapshots) for activity metrics instead of separate audit log queries
    - _Preservation: Response shape and projection logic must match existing `/api/finances/roi-calculator` behavior_
    - _Requirements: 3.4_

- [ ] 4. Add new API endpoint and update existing routes
  - [x] 4.1 Add `GET /api/analytics/facility/:userId/roi/all-economic` endpoint in `app/backend/src/routes/analytics.ts`
    - Call `unifiedFacilityROIService.calculateAllEconomicROIs(userId)`
    - Return all 5 economic facilities' ROI data in one response (eliminates 5 separate API calls)
    - Include Zod schema validation for params
    - _Requirements: 2.4, 2.6_

  - [x] 4.2 Update `GET /api/analytics/facility/:userId/roi` endpoint in `app/backend/src/routes/analytics.ts`
    - Replace `roiCalculatorService.calculateFacilityROI` with `unifiedFacilityROIService.calculateFacilityROI`
    - Remove the `if (!roi) throw 404` pattern — unified service always returns data for owned facilities
    - Keep returning 404 only when facility is genuinely not owned (level === 0)
    - _Requirements: 2.1, 2.2_

  - [x] 4.3 Update `POST /api/finances/roi-calculator` endpoint in `app/backend/src/routes/finances.ts`
    - Replace `calculateFacilityROI` import from `economyCalculations` with `unifiedFacilityROIService.calculateProjectedROI`
    - Keep same response shape for backward compatibility
    - _Preservation: Response shape must remain identical_
    - _Requirements: 3.4_

  - [x] 4.4 Update `facilityRecommendationService.ts` to use unified service
    - Replace `import { roiCalculatorService } from './roiCalculatorService'` with unified service import
    - Replace `roiCalculatorService.calculateAllFacilityROIs(userId)` call with `unifiedFacilityROIService.calculateAllEconomicROIs(userId)`
    - Remove `lastNCycles` parameter dependency from `generateRecommendations()` — use lifetime data from unified service
    - Keep recommendation output shape unchanged (facilityName, priority, projectedPayoffCycles, reason)
    - _Requirements: 2.3, 3.3_

- [ ] 5. Delete old backend files
  - [x] 5.1 Delete `app/backend/src/services/economy/roiCalculatorService.ts`
    - Remove all imports of `roiCalculatorService` across the codebase
    - Update `app/backend/src/services/economy/index.ts` barrel export to remove old exports and add unified service exports
    - _Requirements: 2.4_

  - [x] 5.2 Remove `calculateFacilityROI` function from `app/backend/src/utils/economyCalculations.ts`
    - Remove the function and its helper functions (`calculateTotalUpgradeCost`, `calculateOperatingCostIncrease`, `calculateDailyBenefitIncrease`) that are only used by it
    - Keep all other functions in the file intact
    - _Requirements: 2.4_

  - [x] 5.3 Delete `app/backend/src/services/analytics/facilityAnalyticsService.ts`
    - Remove `getAllFacilityROIs` import from `app/backend/src/services/analytics/index.ts`
    - Update `app/backend/src/routes/analytics.ts` to remove the old `/roi/all` endpoint or redirect it to the new unified service
    - _Requirements: 2.4_

- [ ] 6. Create new frontend component and update page
  - [x] 6.1 Create `app/frontend/src/components/facilities/InvestmentOverviewTab.tsx`
    - Lifetime overview per facility: total investment, total returns, paid-off status (boolean badge), projected payoff cycles if not yet paid off
    - Upgrade recommendations section (from recommendation service) with facility name, current/recommended level, upgrade cost, projected payoff, reason, priority badge
    - Only render the 5 economic facilities (Merchandising Hub, Streaming Studio, Repair Bay, Training Facility, Weapons Workshop)
    - No "last N cycles" selector — lifetime data only
    - Clean card layout with clear visual hierarchy, consistent with existing design system (Tailwind CSS, bg-surface, text-primary/secondary/tertiary patterns)
    - Show `dataSource` indicator when data is estimate-based vs snapshot-based
    - Loading state and empty state handling
    - _Requirements: 2.5, 2.6_

  - [x] 6.2 Update `app/frontend/src/pages/FacilitiesPage.tsx`
    - Remove `InvestmentsTab` and `AdvisorTab` imports
    - Add `InvestmentOverviewTab` import
    - Change from 3 tabs to 2 tabs: "Facilities & Upgrades" and "Investment Overview"
    - Update tab button rendering (remove "Investments & ROI" and "Investment Advisor" buttons, add single "Investment Overview" button)
    - Update `TabType` usage: remove 'advisor' case, rename 'investments' to 'investment-overview'
    - Remove `lastNCycles`, `setLastNCycles` from destructured hook values
    - _Requirements: 2.5, 1.5_

  - [x] 6.3 Update `app/frontend/src/components/facilities/useFacilities.ts`
    - Replace 5 individual ROI API calls with single `GET /api/analytics/facility/${user.id}/roi/all-economic` call
    - Remove `lastNCycles` state and `setLastNCycles` setter
    - Remove `lastNCycles` from the `useEffect` dependency array
    - Simplify `fetchAdvisorData` to single API call for ROI + single call for recommendations (without lastNCycles param)
    - Update `TabType` type to `'facilities' | 'investment-overview'`
    - Remove `lastNCycles` and `setLastNCycles` from return value
    - _Requirements: 2.3, 2.5_

  - [x] 6.4 Update `app/frontend/src/components/facilities/types.ts`
    - Add new `UnifiedFacilityROI` interface matching the unified service response (includes `paidOff`, `projectedPayoffCycles`, `dataSource`)
    - Update `TabType` to `'facilities' | 'investment-overview'`
    - Keep `FacilityRecommendation` interface (still used by recommendations)
    - _Requirements: 2.5_

  - [x] 6.5 Update `app/frontend/src/components/facilities/index.ts` barrel export
    - Remove `InvestmentsTab` and `AdvisorTab` exports
    - Add `InvestmentOverviewTab` export
    - _Requirements: 2.5_

- [ ] 7. Delete old frontend files
  - [x] 7.1 Delete `app/frontend/src/components/facilities/InvestmentsTab.tsx`
    - _Requirements: 1.5, 4.1_

  - [x] 7.2 Delete `app/frontend/src/components/facilities/AdvisorTab.tsx`
    - _Requirements: 1.5, 4.1_

- [ ] 8. Backend unit tests for unified service
  - [x] 8.1 Create `app/backend/src/services/economy/__tests__/unifiedFacilityROIService.test.ts`
    - Test correct ROI calculation from snapshot data for each of the 5 facility types
    - Test graceful fallback when no snapshots exist (formula-based estimates with `dataSource: 'estimate'`)
    - Test correct purchase cycle inference without audit event (fallback to earliest snapshot, then cycle 1)
    - Test correct `paidOff` calculation and `projectedPayoffCycles` when not paid off
    - Test only returns data for economic facilities (rejects non-economic types like `roster_expansion`, `storage_facility`)
    - Test `calculateAllEconomicROIs` returns exactly the owned economic facilities
    - Test `calculateProjectedROI` returns same response shape as old `economyCalculations.calculateFacilityROI`
    - _Requirements: 4.3_

  - [x] 8.2 Create `app/backend/src/services/economy/__tests__/unifiedFacilityROIService.property.test.ts`
    - Property: For random facility states (type from 5 economic types, level 1-10, random cycle counts 0-1000), `totalInvestment` always equals `getFacilityConfig(type).costs.slice(0, level).reduce(sum)`
    - Property: For random snapshot data arrays, ROI calculation is mathematically consistent: `netROI === (returns - opCosts - investment) / investment`
    - Property: For random inputs to `calculateAllEconomicROIs`, response always contains exactly the owned economic facilities (no more, no less)
    - Property: For random non-economic facility types, the service rejects them (throws or returns null)
    - _Requirements: 4.3_

- [ ] 9. Integration tests
  - [x] 9.1 Create `app/backend/src/services/economy/__tests__/unifiedFacilityROI.integration.test.ts`
    - End-to-end: create user, purchase facility, create cycle snapshots with stableMetrics, verify `/api/analytics/facility/:userId/roi?facilityType=merchandising_hub` returns 200 with correct data
    - End-to-end: create user with facility at level > 0 but no audit events, verify `/api/analytics/facility/:userId/roi` returns 200 (not 404)
    - End-to-end: verify `/api/analytics/facility/:userId/roi/all-economic` returns all owned economic facilities in one response
    - End-to-end: verify `/api/finances/roi-calculator` continues to work for prospective upgrade analysis with same response shape
    - End-to-end: verify recommendations endpoint works without `lastNCycles` parameter
    - _Requirements: 4.4_

- [ ] 10. Frontend component tests
  - [x] 10.1 Create `app/frontend/src/__tests__/facilities/InvestmentOverviewTab.test.tsx`
    - Test rendering with ROI data (all 5 economic facilities displayed with correct metrics)
    - Test rendering empty state (no facilities owned)
    - Test rendering recommendations section with priority badges and payoff periods
    - Test only economic facilities appear (no academies, roster expansion, storage, etc.)
    - Test loading state renders correctly
    - Test `dataSource` indicator shows "Estimated" vs "Historical" appropriately
    - _Requirements: 4.2_

  - [x] 10.2 Remove or update old test files
    - Remove any existing test files for `InvestmentsTab` and `AdvisorTab` (check `app/frontend/src/__tests__/facilities/`)
    - _Requirements: 4.1_

- [ ] 11. Fix verification
  - [x] 11.1 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Owned Economic Facilities Always Return ROI Data
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior (non-null ROI with valid fields)
    - When this test passes, it confirms the expected behavior is satisfied
    - Run `app/backend/src/services/economy/__tests__/unifiedFacilityROI.bugcondition.property.test.ts`
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed — owned facilities always return ROI data)
    - _Requirements: 2.1, 2.2, 2.4_

  - [x] 11.2 Verify preservation tests still pass
    - **Property 2: Preservation** - Investment Calculation and Non-ROI Operations Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run `app/backend/src/services/economy/__tests__/unifiedFacilityROI.preservation.property.test.ts`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions in investment calculations)
    - Confirm all preservation tests still pass after fix
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.6_

- [ ] 12. Update documentation
  - [x] 12.1 Update `docs/game-systems/PRD_ECONOMY_SYSTEM.md`
    - Update ROI calculation methodology section to describe unified cycle-snapshot-based approach
    - Remove references to dual-path calculation (audit-log-based historical vs formula-based projections)
    - Document the new `unifiedFacilityROIService` as the single source of truth for facility ROI
    - Document the fallback strategy (snapshots → formula-based estimates)
    - _Requirements: 5.2_

  - [x] 12.2 Update `docs/prd_pages/PRD_FACILITIES_PAGE.md`
    - Update tab structure documentation: 2 tabs instead of 3 ("Facilities & Upgrades" and "Investment Overview")
    - Remove references to separate "Investments & ROI" and "Investment Advisor" tabs
    - Document the consolidated Investment Overview tab layout and behavior
    - Document that only 5 economic facilities appear in the investment view
    - _Requirements: 5.3_

  - [x] 12.3 Update `app/backend/src/content/guide/facilities/investment-strategy.md`
    - Update to reflect the new consolidated layout (single "Investment Overview" tab)
    - Remove references to separate "Investments & ROI" and "Investment Advisor" tabs
    - Update formula descriptions to reflect cycle-snapshot-based calculations
    - Explain lifetime overview (total investment, total returns, paid-off status, projected payoff)
    - _Requirements: 5.1_

  - [x] 12.4 Update `docs/BACKLOG.md`
    - Move backlog item #1 ("Facility Investment Advisor & ROI Calculator") from the active backlog table to the "Recently Completed" section
    - Add completion note referencing this spec (spec #30)
    - _Requirements: 5.4_

- [x] 13. Checkpoint — Ensure all tests pass and run verification criteria
  - Run all backend tests: `cd app/backend && npx jest --no-coverage`
  - Run all frontend tests: `cd app/frontend && npx vitest --run`
  - Run verification criteria from bugfix.md:
    - Verify `GET /api/analytics/facility/{userId}/roi?facilityType=merchandising_hub` returns 200 (not 404) for any user who owns the facility
    - Verify `GET /api/analytics/facility/{userId}/recommendations` returns at least one recommendation for a user with facilities
    - Verify `grep -r "calculateFacilityROI" app/backend/src/ --include="*.ts" | grep -v test | grep -v ".d.ts"` shows only one implementation (the unified service)
    - Verify all existing economy tests pass: `cd app/backend && npx jest tests/economyCalculations.test.ts tests/prestigeFeatures.integration.test.ts --no-coverage`
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4_
