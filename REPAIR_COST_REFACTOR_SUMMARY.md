# Repair Cost System Refactor - Summary

**Date**: February 17, 2026  
**Status**: Complete

## Overview

Refactored the repair cost system to track actual expenses when repairs are triggered, rather than estimated costs during battles. This ensures accurate financial tracking and allows facility upgrades to dynamically affect repair costs.

## Changes Made

### 1. Battle Execution - Removed Repair Cost Calculations

**Files Modified:**
- `prototype/backend/src/services/battleOrchestrator.ts`
- `prototype/backend/src/services/tagTeamBattleOrchestrator.ts`

**Changes:**
- Removed `calculateRepairCost()` calls from battle execution
- Set `robot1RepairCost` and `robot2RepairCost` to 0 in battle records
- Set `robot.repairCost` to 0 when updating robot state
- Added comments explaining that repair costs are calculated by RepairService

**Rationale:**
- Battle-calculated costs were estimates that didn't reflect actual facility levels
- RepairService recalculates costs anyway, making battle costs redundant
- Simplifies battle execution logic

### 2. RepairService - Confirmed as Single Source of Truth

**File**: `prototype/backend/src/services/repairService.ts`

**Verification:**
- ✅ RepairService recalculates costs from scratch based on current robot HP
- ✅ Uses `calculateRepairCost()` with current facility levels
- ✅ Applies Repair Bay discount: `Level × (5 + Active Robots)`, capped at 90%
- ✅ Logs expenses via `eventLogger.logRobotRepair()`
- ✅ Deducts costs from user currency

**Repair Triggers:**
1. Manual: `/api/robots/repair-all` endpoint (user clicks "Repair All")
2. Automatic: Called 3 times during cycle processing:
   - After league battles (step 2)
   - After tag team battles (step 4)
   - After tournament battles (step 6)

### 3. Cycle Summary - Added Balance Column

**Files Modified:**
- `prototype/backend/src/routes/analytics.ts` (backend API)
- `prototype/frontend/src/pages/CycleSummaryPage.tsx` (frontend UI)

**Backend Changes:**
- Added `runningBalance` calculation
- Calculates starting balance by working backwards from current balance
- Adds `balance` field to each cycle showing balance at END of cycle
- Formula: `balance = previousBalance + income - expenses - purchases`

**Frontend Changes:**
- Added "Balance" column to cycle summary table
- Displays balance at end of each cycle in blue text
- Updated TypeScript interface to include `balance: number`

**Example:**
```
Cycle | Income | Expenses | Purchases | Net Profit | Balance
------|--------|----------|-----------|------------|--------
  1   | 10,000 |   5,000  |   2,000   |   +3,000   |  19,000
  2   | 19,266 |  27,779  |       0   |   -8,513   |   7,487
```

### 4. Documentation

**New File**: `docs/REPAIR_COST_SYSTEM.md`

**Contents:**
- Overview of repair cost system
- Key principles (battles don't calculate costs, RepairService does)
- How it works (battle → repair trigger → cost calculation → expense logging)
- Repair cost formula with Repair Bay discount
- Example scenario showing dynamic pricing
- Benefits of this approach
- Implementation details
- Migration notes for deprecated fields

## Benefits

### 1. Accurate Financial Tracking
- Repair costs reflect actual facility levels when repairs happen
- No discrepancy between estimated and actual costs
- Cycle summaries show real expenses, not estimates

### 2. Dynamic Pricing
- Upgrading Repair Bay immediately affects repair costs
- Players can strategically upgrade before repairing to save money
- Costs adjust based on number of active robots

### 3. Simplified Battle Logic
- Battles only track damage, not costs
- Removes redundant calculations
- Easier to maintain and debug

### 4. Clear Audit Trail
- All repair actions logged in audit log
- Complete history of expenses
- Easy to trace where money was spent

### 5. Strategic Depth
- Players must decide when to repair (before/after facility upgrades)
- Upgrading attributes increases repair costs (higher attribute sum)
- Buying more robots increases discount (more active robots)

## Example: Cycle 2 for player1

**Before Refactor:**
- Battle table showed: ₡30,988 (estimated, pre-discount)
- Cycle summary showed: ₡30,988 (incorrect)
- Actual deducted: ₡25,779 (with 14% discount)
- **Discrepancy**: ₡5,209

**After Refactor:**
- Battle table shows: ₡0 (deprecated field)
- RepairService calculates: ₡25,779 (with 14% discount)
- Audit log records: ₡25,779
- Cycle summary shows: ₡25,779 (correct)
- **No discrepancy**: ✅

**Balance Tracking:**
```
Starting: ₡16,000
+ Income: ₡19,266
- Repairs: ₡25,779 (actual, with 14% discount)
- Operating: ₡2,000
= Ending: ₡7,487 ✅
```

## Deprecated Fields

The following fields are no longer used for cost calculations:

- `Battle.robot1RepairCost` - set to 0
- `Battle.robot2RepairCost` - set to 0
- `Robot.repairCost` - set to 0

These fields remain in the database schema for backwards compatibility but should not be used for financial tracking.

## Testing Recommendations

1. **Verify repair costs match formula**:
   - Check RepairService logs for actual costs
   - Verify discount calculation: `Level × (5 + Robots)`
   - Confirm costs deducted from user currency

2. **Test facility upgrade timing**:
   - Damage robots in battle
   - Upgrade Repair Bay
   - Trigger repair
   - Verify new discount applied

3. **Verify cycle summary**:
   - Check repair costs match audit log
   - Verify balance column shows correct running total
   - Confirm no discrepancies between estimated and actual

4. **Test edge cases**:
   - Robot with 0 HP (2.0x multiplier)
   - Robot with <10% HP (1.5x multiplier)
   - Multiple robots repaired at once
   - Repair Bay at max level (90% discount cap)

## Migration Path

For existing data:
1. Battle-stored repair costs are deprecated (ignore them)
2. Use audit log `robot_repair` events for actual costs
3. Cycle snapshots `totalRepairCosts` field is accurate (aggregated from audit log)
4. Balance column will calculate correctly from cycle 1 onwards

## Conclusion

The repair cost system now accurately tracks actual expenses when repairs are triggered, not estimated costs during battles. This provides:
- ✅ Accurate financial tracking
- ✅ Dynamic pricing based on facility levels
- ✅ Clear audit trail
- ✅ Strategic depth for players
- ✅ Simplified battle logic

All repair costs are calculated by RepairService using the same formula, ensuring consistency across manual and automatic repairs.
