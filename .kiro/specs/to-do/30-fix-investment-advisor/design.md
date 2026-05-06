# Fix Investment Advisor Bugfix Design

## Overview

The Investments & ROI tab and Investment Advisor tab on the Facilities page display empty lists or incorrect numbers because `roiCalculatorService.calculateFacilityROI()` depends on finding a `facility_purchase` audit log event — returning `null` (converted to 404) when that event is missing, even though the facility exists at a non-zero level. Additionally, two separate ROI calculation paths (`roiCalculatorService` audit-log-based and `economyCalculations.calculateFacilityROI` formula-based) produce conflicting numbers.

The fix replaces both calculation paths with a single unified service that sources historical data from `CycleSnapshot.stableMetrics` (already aggregated per user per cycle), falls back to formula-based estimates when snapshots are unavailable, and consolidates the two broken frontend tabs into one clean lifetime-overview tab showing only the 5 economic facilities.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — when a user owns a facility (level > 0) but the system cannot find a `facility_purchase` audit log event, OR when the system uses audit-log-based calculations that return zero/null due to missing or incomplete event data
- **Property (P)**: The desired behavior — all owned economic facilities display accurate lifetime ROI metrics sourced from cycle snapshots, with formula-based fallback when snapshot data is unavailable
- **Preservation**: Existing facility upgrade flow, audit event logging, cycle snapshot creation, `/finances/roi-calculator` projection endpoint, and the Facilities & Upgrades tab must remain unchanged
- **roiCalculatorService**: The service in `app/backend/src/services/economy/roiCalculatorService.ts` that calculates historical ROI by querying individual audit log events — to be replaced
- **economyCalculations.calculateFacilityROI**: The function in `app/backend/src/utils/economyCalculations.ts` that calculates formula-based ROI projections for prospective upgrades — to be replaced by the unified service
- **CycleSnapshot.stableMetrics**: Pre-aggregated per-user financial data stored as JSON in the `CycleSnapshot` table, containing merchandisingIncome, streamingIncome, operatingCosts, totalRepairCosts, attributeUpgrades, weaponPurchases, facilityPurchases per user per cycle
- **Economic Facilities**: The 5 facilities with direct financial returns: Merchandising Hub, Streaming Studio, Repair Bay, Training Facility, Weapons Workshop

## Bug Details

### Bug Condition

The bug manifests when a user owns an economic facility (level > 0) and navigates to the Investments or Advisor tab. The `roiCalculatorService.calculateFacilityROI()` function queries for a `facility_purchase` audit log event and returns `null` when none is found. The analytics route converts this `null` into a 404 error. The frontend `useFacilities.ts` hook catches the 404 and filters it out, resulting in an empty `facilityROIs` array. Even when the purchase event exists, downstream audit events may be missing or have mismatched payload structures, causing zero-value returns.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { userId: number, facilityType: string }
  OUTPUT: boolean

  LET facility = database.getFacility(input.userId, input.facilityType)
  LET purchaseEvent = database.findAuditLog(input.userId, 'facility_purchase', input.facilityType)
  LET snapshotData = database.getCycleSnapshots(input.userId)

  RETURN facility.level > 0
         AND facilityType IN ['merchandising_hub', 'streaming_studio', 'repair_bay', 'training_facility', 'weapons_workshop']
         AND (purchaseEvent IS NULL
              OR snapshotData.length === 0
              OR auditLogEvents ARE incomplete/missing)
END FUNCTION
```

### Examples

- **Missing purchase event**: User owns Merchandising Hub at level 3 (upgraded via admin tool or data migration) but no `facility_purchase` audit log exists → API returns 404, tab shows "No facility data available"
- **Missing downstream events**: User owns Repair Bay at level 2, purchase event exists, but no `robot_repair` events with `discountPercent` in payload → ROI shows ₡0 returns, misleading 0% ROI
- **Incomplete streaming data**: User owns Streaming Studio at level 5, but `battle_complete` events lack `battleId` field → streaming revenue calculation returns 0 despite actual revenue earned
- **Dual calculation conflict**: `/api/analytics/facility/{userId}/roi?facilityType=merchandising_hub` returns -15% ROI (audit-log-based) while `/api/finances/roi-calculator` returns "Excellent investment, pays for itself in 12 days" (formula-based) for the same facility

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Facility upgrade flow via `POST /api/facilities/upgrade` must continue to work exactly as before, including audit event logging (`facility_purchase`, `facility_upgrade`)
- The cycle processor must continue to log `passive_income`, `operating_costs`, and other audit events with existing payload structures
- `CycleSnapshotService.createSnapshot()` must continue to aggregate `stableMetrics` with the existing `StableMetric` interface
- The Facilities & Upgrades tab (first tab) must remain completely unchanged
- The `POST /api/finances/roi-calculator` endpoint must continue to return projected ROI for prospective upgrades (breakeven days, net 30/90/180 day projections)
- The `/api/analytics/facility/{userId}/recommendations` endpoint must continue to return recommendations (though its internal data source will change)

**Scope:**
All inputs that do NOT involve viewing facility ROI/investment data should be completely unaffected by this fix. This includes:
- Facility purchases and upgrades
- Battle processing and streaming revenue calculation
- Cycle snapshot creation
- All other pages (Income, Cycle Summary, Leaderboards, etc.)
- The `/api/finances/daily`, `/api/finances/summary`, `/api/finances/operating-costs`, `/api/finances/revenue-streams`, `/api/finances/projections`, `/api/finances/per-robot` endpoints

## Hypothesized Root Cause

Based on the bug description and code analysis, the confirmed issues are:

1. **Hard dependency on `facility_purchase` audit event**: `roiCalculatorService.calculateFacilityROI()` at line ~100 does `findFirst({ where: { eventType: 'facility_purchase', payload: { path: ['facilityType'], equals: facilityType } } })` and returns `null` if not found. This is the primary cause of the 404 errors.

2. **Fragile audit-log-based calculation**: The service queries individual `passive_income`, `operating_costs`, `robot_repair`, `attribute_upgrade`, `weapon_purchase`, and `battle_complete` events. Any missing event type or payload field mismatch causes zero returns. The streaming studio calculation even does N+1 queries (one per battle event to find `battleParticipant`).

3. **Dual calculation paths producing conflicting numbers**: `roiCalculatorService.calculateFacilityROI()` uses historical audit data while `economyCalculations.calculateFacilityROI()` uses formula-based projections. Both are called "ROI" but measure different things, confusing users and developers.

4. **Frontend silently swallows errors**: `useFacilities.ts` catches 404 responses in `fetchAdvisorData()` and returns `null`, which is filtered out. No error state is shown to the user — just an empty list.

5. **Redundant UI with duplicated data**: Both `InvestmentsTab` and `AdvisorTab` display the same facility performance cards (ROI, investment, returns, operating costs), creating a cluttered experience with no clear purpose distinction.

## Correctness Properties

Property 1: Bug Condition - Owned Economic Facilities Always Return ROI Data

_For any_ input where a user owns an economic facility (level > 0) and the facility type is one of the 5 economic facilities, the unified ROI service SHALL return valid ROI data (not null, not 404) containing totalInvestment, totalReturns, totalOperatingCosts, netROI, and paidOff status — using cycle snapshot data when available, or formula-based estimates when snapshots are missing.

**Validates: Requirements 2.1, 2.2, 2.4**

Property 2: Preservation - Non-ROI Facility Operations Unchanged

_For any_ input that does NOT involve viewing facility ROI/investment data (facility upgrades, cycle processing, audit logging, other financial endpoints, the Facilities & Upgrades tab), the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing functionality for facility management, cycle processing, and financial reporting.

**Validates: Requirements 3.1, 3.2, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

**File**: `app/backend/src/services/economy/unifiedFacilityROIService.ts` (NEW)

**Purpose**: Single service that replaces both `roiCalculatorService.calculateFacilityROI` and `economyCalculations.calculateFacilityROI`

**Specific Changes**:

1. **Create unified service using cycle snapshots as primary data source**:
   - Query `CycleSnapshot` table for all snapshots since facility purchase
   - Extract user's `StableMetric` from each snapshot's `stableMetrics` JSON array
   - Sum relevant fields per facility type:
     - Merchandising Hub: `merchandisingIncome` across all cycles
     - Streaming Studio: `streamingIncome` across all cycles
     - Repair Bay: estimate savings from `totalRepairCosts` + facility discount formula
     - Training Facility: estimate savings from `attributeUpgrades` + facility discount formula
     - Weapons Workshop: estimate savings from `weaponPurchases` + facility discount formula
   - Sum `operatingCosts` across all cycles (proportional to facility)
   - Calculate `totalInvestment` from facility config costs array (sum of costs[0..level-1])

2. **Determine purchase cycle without requiring audit event**:
   - First try: find `facility_purchase` audit event (existing behavior)
   - Fallback: find earliest cycle snapshot where user has non-zero activity for that facility type
   - Final fallback: use cycle 1 (assume facility was always owned)

3. **Graceful fallback for missing snapshot data**:
   - If no cycle snapshots exist for the ownership period, use formula-based estimates:
     - Merchandising Hub: `facilityConfig.baseIncome[level] × prestigeMultiplier × cyclesOwned`
     - Streaming Studio: `avgStreamingPerBattle × avgBattlesPerCycle × cyclesOwned`
     - Discount facilities: `avgSpendingPerCycle × discountPercent × cyclesOwned`
   - Mark the response with `dataSource: 'snapshot' | 'estimate'` so the UI can indicate confidence

4. **Compute paid-off status and projected payoff**:
   - `paidOff = (totalReturns - totalOperatingCosts) >= totalInvestment`
   - If not paid off: `projectedPayoffCycles = remainingCost / avgNetReturnPerCycle`

5. **Update `/api/analytics/facility/{userId}/roi` endpoint**:
   - Replace `roiCalculatorService.calculateFacilityROI` call with unified service
   - Remove the `null` → 404 conversion — always return data for owned facilities
   - Add `/api/analytics/facility/{userId}/roi/all-economic` endpoint that returns all 5 economic facilities in one call (eliminates 5 separate API calls from frontend)

6. **Update `/api/finances/roi-calculator` endpoint**:
   - Replace `economyCalculations.calculateFacilityROI` with unified service's projection method
   - Keep the same response shape for backward compatibility

7. **Update `facilityRecommendationService`**:
   - Replace `roiCalculatorService.calculateAllFacilityROIs()` dependency with unified service
   - Remove `lastNCycles` parameter — use lifetime data instead

8. **Delete old files**:
   - Remove `app/backend/src/services/economy/roiCalculatorService.ts`
   - Remove `calculateFacilityROI` function from `app/backend/src/utils/economyCalculations.ts`
   - Remove `app/backend/src/services/analytics/facilityAnalyticsService.ts` (thin wrapper around old service)

**File**: `app/frontend/src/components/facilities/InvestmentOverviewTab.tsx` (NEW)

**Purpose**: Single consolidated tab replacing both `InvestmentsTab` and `AdvisorTab`

**Specific Changes**:

9. **Create new consolidated component**:
   - Lifetime overview per facility: total investment, total returns, paid-off status, projected payoff if not yet paid off
   - Upgrade recommendations section (from recommendation service)
   - Only show the 5 economic facilities
   - No "last N cycles" selector — lifetime data only
   - Clean card layout with clear visual hierarchy

10. **Update `FacilitiesPage.tsx`**:
    - Remove `InvestmentsTab` and `AdvisorTab` imports
    - Add `InvestmentOverviewTab` import
    - Change from 3 tabs to 2 tabs: "Facilities & Upgrades" and "Investment Overview"
    - Update `TabType` to remove 'advisor', rename 'investments' to 'investment-overview'

11. **Update `useFacilities.ts` hook**:
    - Replace 5 individual ROI API calls with single `/roi/all-economic` call
    - Remove `lastNCycles` state and setter
    - Remove `setLastNCycles` from return value
    - Simplify `fetchAdvisorData` to single API call

12. **Delete old tab files**:
    - Remove `app/frontend/src/components/facilities/InvestmentsTab.tsx`
    - Remove `app/frontend/src/components/facilities/AdvisorTab.tsx`

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that call `roiCalculatorService.calculateFacilityROI()` for users who own facilities but lack audit events. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **Missing Purchase Event Test**: Create a user with `merchandising_hub` at level 3 but no `facility_purchase` audit event → expect `null` return (will fail on unfixed code by returning null)
2. **Missing Downstream Events Test**: Create a user with `repair_bay` at level 2, add purchase event but no `robot_repair` events → expect zero returns (will show misleading data on unfixed code)
3. **Streaming N+1 Query Test**: Create a user with `streaming_studio` at level 5, add battle events without `battleId` → expect zero streaming revenue (will fail on unfixed code)
4. **Dual Path Conflict Test**: Call both `roiCalculatorService.calculateFacilityROI` and `economyCalculations.calculateFacilityROI` for same facility → expect conflicting numbers (demonstrates inconsistency on unfixed code)

**Expected Counterexamples**:
- `roiCalculatorService.calculateFacilityROI(userId, 'merchandising_hub')` returns `null` for users without purchase events
- ROI calculations return 0% when audit events exist but have incomplete payloads
- Two calculation paths return different ROI values for the same facility state

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the unified service produces correct ROI data.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := unifiedFacilityROIService.calculateFacilityROI(input.userId, input.facilityType)
  ASSERT result IS NOT NULL
  ASSERT result.totalInvestment === sum(facilityConfig.costs[0..facility.level-1])
  ASSERT result.totalReturns >= 0
  ASSERT result.netROI === (result.totalReturns - result.totalOperatingCosts - result.totalInvestment) / result.totalInvestment
  ASSERT result.paidOff === ((result.totalReturns - result.totalOperatingCosts) >= result.totalInvestment)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed system produces the same observable behavior as the original system.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT facilityUpgrade(input) produces same result before and after fix
  ASSERT cycleProcessor(input) logs same audit events before and after fix
  ASSERT financesEndpoints(input) return same data before and after fix
  ASSERT facilitiesTab(input) renders same content before and after fix
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (random facility types, levels, cycle counts)
- It catches edge cases that manual unit tests might miss (boundary levels, zero cycles, max levels)
- It provides strong guarantees that the unified service's investment calculation matches the config-based sum for all valid facility states

**Test Plan**: Observe behavior on UNFIXED code first for facility upgrades and financial endpoints, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Investment Calculation Preservation**: For any facility type and level, `totalInvestment` must equal `sum(config.costs[0..level-1])` — same as old service
2. **Projection Endpoint Preservation**: `/api/finances/roi-calculator` must return same response shape with breakeven days and net projections
3. **Recommendation Generation Preservation**: Recommendations must still include facility name, priority, projected payoff, and reason
4. **Facilities Tab Preservation**: The Facilities & Upgrades tab must render identically (no changes to that component)

### Unit Tests

- Test unified service: correct ROI from snapshot data for each of the 5 facility types
- Test unified service: graceful fallback when no snapshots exist (formula-based estimates)
- Test unified service: correct purchase cycle inference without audit event
- Test unified service: correct paid-off calculation and projected payoff
- Test unified service: only returns data for economic facilities (rejects non-economic types)
- Test API endpoint: returns 200 (not 404) for owned facilities without purchase events
- Test API endpoint: `/roi/all-economic` returns all 5 facilities in one response

### Property-Based Tests

- Generate random facility states (type, level 1-10, random cycle counts 0-1000) and verify `totalInvestment` always equals config cost sum
- Generate random snapshot data arrays and verify ROI calculation is mathematically consistent: `netROI = (returns - opCosts - investment) / investment`
- Generate random inputs to `/roi/all-economic` and verify response always contains exactly the owned economic facilities (no more, no less)
- Generate random non-economic facility types and verify the service rejects them

### Integration Tests

- End-to-end: create user, purchase facility, run cycles, verify ROI endpoint returns correct data
- End-to-end: create user with facility but no audit events, verify ROI endpoint still returns data
- End-to-end: verify `/api/finances/roi-calculator` continues to work for prospective upgrade analysis
- Frontend integration: verify new `InvestmentOverviewTab` renders with mock API data
- Frontend integration: verify only 5 economic facilities appear (no academies, no roster expansion)

### Documentation Impact

The following documentation files need updating after the fix:
- `docs/game-systems/PRD_ECONOMY_SYSTEM.md` — update ROI calculation methodology (cycle-snapshot-based, unified service)
- `docs/prd_pages/PRD_FACILITIES_PAGE.md` — update tab structure (2 tabs instead of 3), describe consolidated investment overview
- `docs/BACKLOG.md` — mark backlog item #1 as completed
- In-game guide content (prestige bonuses, facility ROI explanations) — update to reflect new layout
