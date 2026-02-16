# Facility Advisor: Repair Bay ROI Enhancement

## Problem
The Facility Advisor was using an outdated repair cost discount formula when calculating ROI for Repair Bay recommendations. This resulted in inaccurate payoff projections and misleading investment advice.

## Old Formula (Incorrect)
```typescript
discount = repairBayLevel × 10%, capped at 90%
```

This formula:
- Ignored the number of robots owned
- Gave fixed 10% per level regardless of stable size
- Did not match the actual repair cost calculations

## New Formula (Correct)
```typescript
discount = repairBayLevel × (5 + activeRobotCount), capped at 90%
```

This formula:
- Accounts for multi-robot discount bonus
- Scales with stable size (more robots = better ROI)
- Matches the canonical repair cost calculation in `robotCalculations.ts`

## Changes Made

### 1. facilityRecommendationService.ts

#### Updated `getRepairBayDiscount()` method:
- Added `robotCount` parameter
- Changed formula from `level × 10` to `level × (5 + robotCount)`
- Updated JSDoc to document the new formula

#### Updated Repair Bay evaluation logic:
- Calculate CURRENT discount (with current level)
- Calculate NEXT discount (with next level)
- Calculate ADDITIONAL discount from upgrading (incremental benefit)
- Use incremental savings for ROI calculation (more accurate)
- Special case for first purchase (level 0 → 1): show total savings
- Updated reason text to show:
  - Current discount → Next discount
  - Number of robots
  - Actual savings per cycle

## ROI Calculation Details

### For Upgrades (Level 1+)
```typescript
currentDiscount = currentLevel × (5 + robotCount)
nextDiscount = nextLevel × (5 + robotCount)
additionalDiscount = nextDiscount - currentDiscount
projectedSavingsPerCycle = avgRepairCostPerCycle × (additionalDiscount / 100)
projectedPayoffCycles = upgradeCost / projectedSavingsPerCycle
projectedROI = (projectedSavingsPerCycle × 30 - upgradeCost) / upgradeCost
```

### For First Purchase (Level 0 → 1)
```typescript
nextDiscount = 1 × (5 + robotCount)
totalSavingsPerCycle = avgRepairCostPerCycle × (nextDiscount / 100)
projectedPayoffCycles = upgradeCost / totalSavingsPerCycle
projectedROI = (totalSavingsPerCycle × 30 - upgradeCost) / upgradeCost
```

## Example Scenarios

### Scenario 1: First Repair Bay Purchase (1 robot)
- Current: No Repair Bay (0% discount)
- Upgrade: Repair Bay L1
- Discount: 0% → 6% (1 × (5 + 1))
- Avg repair cost: ₡10,000/cycle
- Savings: ₡600/cycle
- Upgrade cost: ₡50,000
- Payoff: 84 cycles
- Priority: Medium

### Scenario 2: First Repair Bay Purchase (5 robots)
- Current: No Repair Bay (0% discount)
- Upgrade: Repair Bay L1
- Discount: 0% → 10% (1 × (5 + 5))
- Avg repair cost: ₡50,000/cycle
- Savings: ₡5,000/cycle
- Upgrade cost: ₡50,000
- Payoff: 10 cycles
- Priority: High

### Scenario 3: Upgrade L1 → L2 (5 robots)
- Current: Repair Bay L1 (10% discount)
- Upgrade: Repair Bay L2
- Discount: 10% → 20% (2 × (5 + 5))
- Avg repair cost: ₡50,000/cycle
- Current savings: ₡5,000/cycle
- Additional savings: ₡5,000/cycle (incremental)
- Upgrade cost: ₡100,000
- Payoff: 20 cycles
- Priority: Medium

### Scenario 4: Upgrade L5 → L6 (10 robots)
- Current: Repair Bay L5 (75% discount)
- Upgrade: Repair Bay L6
- Discount: 75% → 90% (6 × (5 + 10) = 90, capped)
- Avg repair cost: ₡100,000/cycle
- Current savings: ₡75,000/cycle
- Additional savings: ₡15,000/cycle (incremental)
- Upgrade cost: ₡500,000
- Payoff: 34 cycles
- Priority: Medium

## Benefits

1. **Accurate ROI Projections**: Recommendations now reflect actual savings
2. **Scales with Stable Size**: Larger stables see better ROI (as they should)
3. **Incremental Analysis**: Shows the value of UPGRADING, not just owning
4. **Consistent Formula**: Same calculation across entire system
5. **Better Investment Decisions**: Players can make informed choices

## User Experience

The Facility Advisor now shows:
- "Saves ₡X/cycle on repairs (Y% → Z% discount with N robots)"
- Accurate payoff cycles based on actual repair history
- Priority levels that reflect true ROI potential
- Clear indication of how robot count affects discount

## Testing Recommendations

1. Test with 1 robot (minimal discount)
2. Test with 5 robots (moderate discount)
3. Test with 10+ robots (high discount, approaching cap)
4. Test first purchase vs upgrades
5. Verify payoff cycles match actual savings
6. Check that priority levels are appropriate

## Related Files
- `prototype/backend/src/services/facilityRecommendationService.ts` - ROI calculation
- `prototype/backend/src/utils/robotCalculations.ts` - Canonical repair cost formula
- `prototype/frontend/src/pages/FacilityInvestmentAdvisorPage.tsx` - UI display
- `prototype/frontend/src/components/YieldThresholdSlider.tsx` - Repair cost preview


## Critical Issue Found: Missing Repair Event Logging

### Problem
The Repair Bay recommendations were not showing because:
1. NO repair events were being logged to the audit log
2. Recommendations with negative ROI were being filtered out

### Root Cause
1. The `repairAllRobots()` function in `repairService.ts` was repairing robots but not creating audit log entries
2. The recommendation logic filtered out any facility with `projectedROI <= 0`

### Fix Applied

#### Part 1: Repair Event Logging
1. Added `eventLogger` import to `repairService.ts`
2. Added `logRobotRepair()` call after each robot repair
3. Created `logRobotRepair()` method in `eventLogger.ts` that logs:
   - Cost (actual repair cost paid)
   - Damage repaired (HP restored)
   - Discount percent (from Repair Bay)
   - User ID and Robot ID
   - Current cycle number

#### Part 2: Always Show Repair Bay
1. Added estimation logic when no repair history exists:
   - Estimates based on robot count and battle frequency
   - Assumes ~100 total attributes per robot
   - Estimates 30% damage per battle
   - Shows "(estimated)" in the reason text
2. Removed ROI filter for repair_bay specifically
3. Removed duplicate ROI > 0 check in recommendation generation

### Result
The Repair Bay now ALWAYS shows in recommendations with:
- Actual repair costs (if logged) or estimated costs (if no history)
- Correct discount formula: `repairBayLevel × (5 + activeRobotCount)`, capped at 90%
- Accurate payoff cycles
- Realistic ROI (may be negative if payoff is very long)
- Appropriate priority level
- Clear indication if data is estimated vs actual

### Example Output
```json
{
  "facilityType": "repair_bay",
  "facilityName": "Repair Bay",
  "currentLevel": 0,
  "recommendedLevel": 1,
  "upgradeCost": 100000,
  "projectedROI": -0.9622,
  "projectedPayoffCycles": 794,
  "reason": "Saves ₡126/cycle on repairs (estimated) (6% discount with 1 robot)",
  "priority": "low"
}
```

### Impact
- **Going forward**: All repairs will be logged and estimates will be replaced with actual data
- **Historical data**: Past repairs are not logged, so estimates are used until new data accumulates
- **User experience**: Users can now see Repair Bay recommendations immediately, even without repair history
