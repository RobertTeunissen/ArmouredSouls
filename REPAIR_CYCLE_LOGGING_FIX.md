# Cycle Event Logging Fixes

## Problems

### Problem 1: Missing Repair Costs in Cycle Summary
Repair costs were being logged but not appearing in the cycle summary for the correct cycle.

### Problem 2: Incorrect Balance Calculation  
The balance shown in the cycle summary was incorrect due to double-counting cycle 0 purchases.

### Problem 3: Missing Attribute Upgrades in Cycle Summary
Attribute upgrades done between cycles (after one cycle ends, before the next starts) were not appearing in the cycle summary.

### Problem 4: Balance Still Wrong After Fixes 1-2
Even after fixing repairs and the starting balance, Cycle 3 balance was still incorrect because attribute upgrades weren't being counted.

## Root Causes

### Root Cause 1: Wrong Cycle Number for Repair Logging

The issue was in how the cycle number was determined when logging repair events:

1. **Cycle Execution Flow:**
   - Cycle N starts (e.g., Cycle 2)
   - Step 1: Execute battles
   - Step 2: Repair robots (first repair)
   - Step 3: Execute tag team battles
   - Step 4: Repair robots (second repair)
   - Step 5: Execute tournaments
   - Step 6: Repair robots (third repair)
   - ...
   - Step 10: **Update cycleMetadata.totalCycles to N**

2. **The Bug:**
   - When `repairAllRobots()` was called in Steps 2, 4, and 6, it called `eventLogger.logRobotRepair()`
   - `logRobotRepair()` queried `cycleMetadata.totalCycles` to get the current cycle number
   - But `totalCycles` was still set to N-1 (the previous cycle) because it's only updated in Step 10
   - Result: All repairs for Cycle 2 were logged as Cycle 1 repairs

3. **Why Console Logs Showed Correct Cycle:**
   - The console logs in `repairService.ts` didn't use the cycle number from metadata
   - They just logged the repair action without cycle context
   - The cycle logger (`cycleLogger`) used a different mechanism that tracked the current cycle correctly

## The Fix

### Fix 1: Repair Cycle Logging

#### 1. Updated `eventLogger.logRobotRepair()` (eventLogger.ts)

Changed the method signature to accept an optional `cycleNumber` parameter:

```typescript
async logRobotRepair(
  userId: number,
  robotId: number,
  cost: number,
  damageRepaired: number,
  discountPercent: number,
  cycleNumber?: number  // NEW: Optional cycle number
): Promise<void> {
  // Use provided cycle number, or fall back to querying metadata
  let actualCycleNumber = cycleNumber;
  if (actualCycleNumber === undefined) {
    const cycleMetadata = await prisma.cycleMetadata.findUnique({
      where: { id: 1 },
    });
    actualCycleNumber = cycleMetadata?.totalCycles || 0;
  }
  
  await this.logEvent(
    actualCycleNumber,  // Use the correct cycle number
    EventType.ROBOT_REPAIR,
    // ...
  );
}
```

### 2. Updated `repairAllRobots()` (repairService.ts)

Added `cycleNumber` parameter and passed it to `logRobotRepair()`:

```typescript
export async function repairAllRobots(
  deductCosts: boolean = true,
  cycleNumber?: number  // NEW: Optional cycle number
): Promise<RepairSummary> {
  // ...
  await eventLogger.logRobotRepair(
    userId,
    robot.id,
    repairCost,
    damageTaken,
    repairBayDiscount,
    cycleNumber  // Pass the cycle number
  );
  // ...
}
```

### 3. Updated All Calls in admin.ts

Updated all three repair calls to pass the current cycle number:

```typescript
// Step 2
const repair1Summary = await repairAllRobots(true, currentCycleNumber);

// Step 4
const repair2Summary = await repairAllRobots(true, currentCycleNumber);

// Step 6
const repair3Summary = await repairAllRobots(true, currentCycleNumber);
```

### Root Cause 2: Double-Counting Cycle 0 Purchases

The balance calculation had a double-counting bug:

1. **Cycle 0 purchases** (purchases made before the first cycle) were being collected
2. These were **subtracted from the starting balance**: `startingBalance = 3000000 - cycle0TotalPurchases`
3. But they were **also added to Cycle 1's purchases** in the cycle data
4. Then the balance calculation did: `runningBalance = startingBalance + income - expenses - purchases`
5. This meant cycle 0 purchases were subtracted **twice**!

**Example:**
- Cycle 0 purchases: ₡2,982,000
- Starting balance calculation: `3,000,000 - 2,982,000 = 18,000`
- Cycle 1 purchases (includes cycle 0): ₡2,982,000
- Balance after Cycle 1: `18,000 + 0 - 2,000 - 2,982,000 = -2,966,000` ❌
- **Should be:** `3,000,000 + 0 - 2,000 - 2,982,000 = 16,000` ✓

### Fix 2: Balance Calculation

#### Updated analytics.ts

Changed the starting balance calculation to NOT subtract cycle 0 purchases, since they're already included in Cycle 1's purchase data:

```typescript
// BEFORE (WRONG):
if (startCycle === 1) {
  startingBalance = 3000000 - cycle0TotalPurchases;  // Double-counting!
}

// AFTER (CORRECT):
if (startCycle === 1) {
  startingBalance = 3000000;  // Cycle 0 purchases already in cycle 1 data
}
```

The cycle 0 purchases are still correctly included in Cycle 1's purchases field (lines 217-227), so they show up in the "Purchases" column and are subtracted from the balance. We just don't need to subtract them from the starting balance too.

### Root Cause 3: Wrong Cycle Number for Attribute Upgrades

Similar to repairs, attribute upgrades done between cycles were being logged to the wrong cycle:

1. **Timeline:**
   - Cycle 2 completes → `totalCycles` updated to 2 → Snapshot created for Cycle 2
   - User manually upgrades attributes (between cycles)
   - Cycle 3 starts

2. **The Bug:**
   - When upgrading attributes, code queried `cycleMetadata.totalCycles` (returns 2)
   - Upgrades were logged to Cycle 2
   - But Cycle 2's snapshot was already created!
   - Result: Upgrades don't appear in any cycle summary

3. **The Fix:**
   - Attribute upgrades between cycles should be logged to `totalCycles + 1` (the NEXT cycle)
   - This ensures they appear in the correct cycle's snapshot

### Fix 3: Attribute Upgrade Cycle Logging

#### Updated robots.ts

Changed attribute upgrade logging to use the NEXT cycle number:

```typescript
// BEFORE (WRONG):
const currentCycle = cycleMetadata?.totalCycles || 0;  // Logs to completed cycle

// AFTER (CORRECT):
const currentCycle = (cycleMetadata?.totalCycles || 0) + 1;  // Logs to next cycle
```

This ensures attribute upgrades done between cycles are counted in the next cycle's snapshot.

## Impact

### Fix 1 (Repair Logging):
- **Backward Compatible:** The `cycleNumber` parameter is optional, so existing code that doesn't pass it will still work (though it will use the old behavior)
- **Fixes Cycle Summary:** Repair costs will now be logged to the correct cycle and appear in `/api/analytics/stable/:userId/summary`

### Fix 2 (Balance Calculation):
- **Fixes Balance Display:** The balance shown in cycle summary will now correctly start from ₡3,000,000 and subtract expenses/purchases only once
- **Accurate Financial Tracking:** Users will see their actual balance after each cycle

### Fix 3 (Attribute Upgrades):
- **Fixes Missing Purchases:** Attribute upgrades done between cycles now appear in the next cycle's summary
- **Accurate Balance:** Balance calculation now includes all purchases (weapons, facilities, attributes)

## Testing

After this fix, you need to:

1. **Clean the database** (as you mentioned you did)
2. **Restart backend**
3. **Restart frontend**
4. **Run cycles again**

The repair costs should now appear in the correct cycle in the cycle summary.

### Verification Script

Run this script to verify repair events are logged to the correct cycle:

```bash
node prototype/backend/verify_repair_cycle_fix.js
```

This will show:
- Current cycle metadata
- All repair events grouped by cycle
- Cycle timing events

## Files Changed

1. `prototype/backend/src/services/eventLogger.ts` - Added optional `cycleNumber` parameter to `logRobotRepair()`
2. `prototype/backend/src/services/repairService.ts` - Added optional `cycleNumber` parameter to `repairAllRobots()` and passed it to `logRobotRepair()`
3. `prototype/backend/src/routes/admin.ts` - Updated all three calls to `repairAllRobots()` to pass `currentCycleNumber`
4. `prototype/backend/src/routes/analytics.ts` - Fixed balance calculation to not double-subtract cycle 0 purchases
5. `prototype/backend/src/routes/robots.ts` - Fixed attribute upgrade logging to use `totalCycles + 1` for between-cycle upgrades

## Expected Results After Fix

With the test scenario (User 2, Cycle 1 setup, Cycle 2 with 4 matches and 3 repairs):

**Cycle 1:**
- Starting Balance: ₡3,000,000
- Income: ₡0 (no battles, just matchmaking)
- Expenses: ₡2,000 (operating costs)
- Purchases: ₡2,982,000 (cycle 0 purchases)
- **Balance: ₡3,000,000 - ₡2,000 - ₡2,982,000 = ₡16,000** ✓

**Cycle 2:**
- Starting Balance: ₡16,000
- Income: (battle rewards)
- Expenses: ₡2,000 (operating costs) + repair costs (₡6,149 + ₡15,136 + ₡851 = ₡22,136)
- **Repair costs will now appear in Cycle 2** ✓
- Balance will be calculated correctly ✓

**Cycle 3 (with manual upgrades before cycle):**
- Manual upgrades between Cycle 2 and 3: ₡21,000 (₡10,500 × 2)
- These upgrades logged to Cycle 3 ✓
- Starting Balance: ₡34,428 (from Cycle 2)
- Income: ₡32,396
- Expenses: ₡32,796
- Purchases: ₡21,000 (attribute upgrades)
- **Balance: ₡34,428 + ₡32,396 - ₡32,796 - ₡21,000 = ₡13,028** ✓

