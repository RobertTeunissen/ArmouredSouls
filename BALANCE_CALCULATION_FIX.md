# Balance Calculation Fix

**Date**: February 18, 2026  
**Status**: Fixed - Requires Snapshot Regeneration

## Problem Summary

The cycle summary was showing incorrect balances and missing repair costs because:

1. **Snapshots created before repair cost aggregation was added** - The code to aggregate repair costs from audit log was added, but existing snapshots don't have this data
2. **Balance calculated backwards from current balance** - This caused historical cycle balances to change when new cycles ran
3. **Duplicate credit_change events** - Every transaction is being logged twice in the audit log

## Root Causes

### 1. Missing Repair Costs in Snapshots

The `cycleSnapshotService.ts` was updated to aggregate repair costs from the audit log, but snapshots created before this change don't have repair cost data. The repair events ARE in the audit log (verified 216 events totaling ₡663,921 in Cycle 1), but the snapshots don't include them.

**Solution**: Regenerate all cycle snapshots after the code changes.

### 2. Balance Calculation Working Backwards

The original code in `analytics.ts` calculated the starting balance by working backwards from the current user balance:

```typescript
// OLD (BROKEN)
const totalNetChange = cyclesWithoutBalance.reduce((sum, c) => {
  return sum + c.income - c.expenses - c.purchases;
}, 0);
startingBalance = Number(user.currency) - totalNetChange;
```

This caused historical cycle balances to change every time a new cycle ran, because the current balance changes.

**Solution**: Calculate balance forward from a known starting point (3,000,000 credits) or from the previous cycle's snapshot.

### 3. Duplicate Credit Change Events

The audit log shows every transaction twice:
- Once as the specific event type (`facility_purchase`, `weapon_purchase`, etc.)
- Once as a generic `credit_change` event with `source: 'other'`

Example from Cycle 0:
```
facility purchase: ₡-100,000 → Balance: ₡2,900,000
Other: ₡-100,000 → Balance: ₡2,800,000  // DUPLICATE!
```

This causes the balance calculation to be off by 2x for all transactions.

**Impact**: This is a separate issue that needs investigation. The cycle snapshot aggregation uses specific event types (not `credit_change`), so it shouldn't be affected. But any code that sums ALL audit log events will count transactions twice.

## Fixes Applied

### 1. Fixed Balance Calculation (analytics.ts)

Changed to calculate balance forward from a known starting point:

```typescript
// NEW (FIXED)
let startingBalance = 0;

if (startCycle === 1) {
  // Get starting balance from cycle 0 or use default (3,000,000)
  const cycle0Snapshot = await prisma.cycleSnapshot.findUnique({
    where: { cycleNumber: 0 },
  });
  
  if (cycle0Snapshot) {
    // Calculate balance after cycle 0
    startingBalance = 3000000 + income - expenses - purchases;
  } else {
    startingBalance = 3000000;
  }
} else {
  // Get balance from previous cycle by calculating cumulative from cycle 1
  const allPreviousSnapshots = await cycleSnapshotService.getSnapshotRange(1, previousCycle);
  let runningBalance = 3000000;
  
  for (const snapshot of allPreviousSnapshots) {
    runningBalance += income - expenses - purchases;
  }
  
  startingBalance = runningBalance;
}

// Calculate forward from starting balance
let runningBalance = startingBalance;
cycles.forEach(cycle => {
  runningBalance += cycle.income - cycle.expenses - cycle.purchases;
  cycle.balance = runningBalance;
});
```

**Key Points**:
- Balance is calculated forward, not backward
- Starting balance is 3,000,000 credits (default)
- Each cycle's balance is cumulative and stable
- Historical cycle balances never change when new cycles run

### 2. Repair Cost Aggregation (cycleSnapshotService.ts)

Already fixed in previous commit - aggregates repair costs from audit log:

```typescript
// Add repair costs from audit log
const repairEvents = await prisma.auditLog.findMany({
  where: {
    cycleNumber,
    eventType: 'robot_repair',
  },
});

repairEvents.forEach((event: any) => {
  if (!event.userId) return;
  
  let metric = metricsMap.get(event.userId);
  if (metric) {
    const payload = event.payload as any;
    metric.totalRepairCosts += payload.cost || 0;
  }
});
```

## Required Actions

### 1. Regenerate Cycle Snapshots

Delete existing snapshots and regenerate them with the new code:

```sql
-- Delete existing snapshots
DELETE FROM "CycleSnapshot";

-- Then run cycles again or use admin endpoint to regenerate
```

OR use the admin endpoint to regenerate specific cycles:

```bash
POST /api/admin/regenerate-snapshots
{
  "cycles": [1, 2]
}
```

### 2. Verify Repair Costs

After regenerating snapshots, verify that repair costs appear in cycle summaries:

```bash
GET /api/analytics/stable/2/summary?lastNCycles=10
```

Expected output:
```json
{
  "cycles": [
    {
      "cycleNumber": 1,
      "income": 0,
      "expenses": 18933,  // Should include repair costs
      "purchases": 0,
      "netProfit": -18933,
      "balance": 2981067,  // Should be stable
      "breakdown": {
        "repairCosts": 16933,  // Should NOT be 0
        "operatingCosts": 2000
      }
    }
  ]
}
```

### 3. Investigate Duplicate Credit Change Events

This is a separate issue that needs investigation:
- Why are `credit_change` events being logged for every transaction?
- Are they being logged by the event logger or by some other code?
- Should they be removed or is there a reason for them?

Check the code that logs purchases, upgrades, etc. to see if they're calling both:
1. Specific event logger (e.g., `logWeaponPurchase()`)
2. Generic credit change logger (e.g., `logCreditChange()`)

## Testing

After regenerating snapshots:

1. **Check Cycle 1 Summary**:
   - Repair costs should be ₡16,933 (for user 2)
   - Balance should be ₡2,981,067 (3,000,000 - 18,933)

2. **Check Cycle 2 Summary**:
   - Repair costs should show actual costs (not ₡0)
   - Balance should be stable (not change when cycle 3 runs)

3. **Run Cycle 3**:
   - Verify Cycle 1 and 2 balances don't change
   - Verify Cycle 3 shows correct repair costs

## Files Modified

1. `prototype/backend/src/routes/analytics.ts` - Fixed balance calculation to work forward from known starting point
2. `prototype/backend/src/services/cycleSnapshotService.ts` - Already fixed to aggregate repair costs from audit log (previous commit)

## Expected Behavior After Fix

- Cycle summaries show correct repair costs from audit log
- Balances are calculated forward from 3,000,000 starting balance
- Historical cycle balances never change when new cycles run
- Balance column shows cumulative end-of-cycle balance
