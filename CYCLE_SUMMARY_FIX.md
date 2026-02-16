# Cycle Summary Fix - Root Cause Resolution

## Problem
The cycle-summary page at `/cycle-summary` showed no values (all zeros) for all users, even though 10 cycles had been completed with battles.

## Root Cause
The cycle execution was missing two critical steps:
1. **Passive Income Calculation** - Merchandising and streaming revenue from Income Generator facilities were never calculated or logged
2. **Operating Costs Calculation** - Daily facility operating costs were never calculated or logged

Without these audit log events (`passive_income` and `operating_costs`), the `cycleSnapshotService` couldn't aggregate user financial data, resulting in empty `stableMetrics` arrays in snapshots.

## Solution Implemented

### 1. Added Passive Income & Operating Costs Step to Cycle Execution
**File**: `prototype/backend/src/routes/admin.ts`

Added new Step 11 that:
- Iterates through all users (excluding system users)
- Calculates passive income using `calculateDailyPassiveIncome()`:
  - Merchandising income (based on Income Generator level and prestige)
  - Streaming income (based on Income Generator level, total battles, and fame)
- Calculates operating costs using `calculateFacilityOperatingCost()` for each facility
- Logs `passive_income` events via `eventLogger.logPassiveIncome()`
- Logs `operating_costs` events via `eventLogger.logOperatingCosts()`

### 2. Exported Required Function
**File**: `prototype/backend/src/utils/economyCalculations.ts`

Ensured `calculateDailyPassiveIncome()` is exported so it can be used by the admin cycle execution.

### 3. Backfilled Missing Battle Events
**Action**: Ran migration script `src/scripts/migrateBattlesToEvents.ts`

- Migrated 202 battles that were missing `battle_complete` audit log events
- Total: 827 battles now have corresponding audit log events

## What Happens Next

### For Future Cycles (Cycle 11+)
- Passive income and operating costs will be automatically calculated and logged
- Cycle snapshots will contain complete `stableMetrics` data
- Cycle summary page will display correct income/expense data

### For Past Cycles (Cycles 1-10)
The existing snapshots still have empty `stableMetrics` because:
- Passive income and operating costs were never logged for those cycles
- The data cannot be retroactively calculated (we don't know historical facility levels, prestige values, etc.)

**Options**:
1. **Accept historical data loss** - Cycles 1-10 will show zeros (recommended)
2. **Estimate historical data** - Create a script to estimate based on current facility levels (inaccurate)
3. **Reset and rerun** - Delete cycles 1-10 and rerun them (loses battle history)

## Testing

To verify the fix works:
1. Run a new cycle (cycle 11) via admin panel
2. Check audit logs for `passive_income` and `operating_costs` events:
   ```sql
   SELECT event_type, COUNT(*) 
   FROM audit_logs 
   WHERE cycle_number = 11 
   GROUP BY event_type;
   ```
3. Check cycle snapshot has populated `stableMetrics`:
   ```sql
   SELECT cycle_number, jsonb_array_length(stable_metrics) as user_count
   FROM cycle_snapshots 
   WHERE cycle_number = 11;
   ```
4. Visit `/cycle-summary` and verify data displays for cycle 11

## Files Modified
- `prototype/backend/src/routes/admin.ts` - Added passive income/costs calculation step
- `prototype/backend/src/utils/economyCalculations.ts` - Exported calculateDailyPassiveIncome
- `prototype/backend/src/routes/analytics.ts` - Fixed getCyclePerformanceMetrics call

## Related Issues
- Battle events were partially missing (fixed by running migration script)
- Cycle snapshot service was working correctly but had no data to aggregate
