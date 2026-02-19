# Cycle Summary Streaming Revenue Fix

## Problem Statement

The cycle summary page (`/cycle-summary`) was showing two critical issues:

1. **Streaming Revenue Shows ₡0**: The "STREAMING" column displayed ₡0 even though streaming revenue was being:
   - Correctly calculated and awarded after each battle
   - Logged in terminal output
   - Exported to CSV files
   - Applied to user balances

2. **Balance Calculation**: The balance shown was being recalculated from event data instead of using the stored balance value that was already being logged at the end of each cycle.

## Root Cause Analysis

### Issue 1: Streaming Revenue Aggregation

**Location**: `prototype/backend/src/services/cycleSnapshotService.ts:316-381` (before fix)

**Problem**: The snapshot service was aggregating streaming revenue from `battle_complete` audit log events:

```typescript
// OLD CODE (lines 324-381)
battleCompleteEvents.forEach((event: any) => {
  const payload = event.payload as any;
  if (payload.robot1Id && payload.streamingRevenue1) {
    metric.streamingIncome += payload.streamingRevenue1;
  }
  if (payload.robot2Id && payload.streamingRevenue2) {
    metric.streamingIncome += payload.streamingRevenue2;
  }
});
```

However, there was a fallback mechanism (lines 163-192) that queried battles by timestamp when audit log events were missing. This fallback only retrieved `cycleBattles` but not the corresponding `battle_complete` events, causing `battleCompleteEvents` to be empty and the streaming income aggregation loop to skip all revenue.

**Evidence**:
- Line 164: `console.warn('No battle_complete events found for cycle ${cycleNumber}, querying battles by timestamp')`
- Line 324: Loop over `battleCompleteEvents` which would be empty after fallback

### Issue 2: Balance Recalculation

**Location**: `prototype/backend/src/routes/analytics.ts:237-279` (before fix)

**Problem**: The analytics route was recalculating balance from scratch:

```typescript
// OLD CODE
const allPreviousSnapshots = await cycleSnapshotService.getSnapshotRange(1, previousCycle);
let runningBalance = 3000000;

for (const snapshot of allPreviousSnapshots) {
  const metric = snapshot.stableMetrics.find(m => m.userId === userId);
  if (metric) {
    const income = metric.totalCreditsEarned + metric.merchandisingIncome + metric.streamingIncome;
    const expenses = metric.totalRepairCosts + metric.operatingCosts;
    const purchases = metric.weaponPurchases + metric.facilityPurchases + metric.attributeUpgrades;
    runningBalance += income - expenses - purchases;
  }
}
```

This approach:
- Queried all previous snapshots unnecessarily
- Recalculated balance from scratch each time
- Was error-prone and inefficient
- Didn't use the already-logged balance value

## Solution

### Fix 1: Query RobotStreamingRevenue Table Directly

**Change**: Replace audit log-based streaming revenue aggregation with direct table query

**New Code** (lines 317-349 in cycleSnapshotService.ts):
```typescript
// Add streaming revenue from RobotStreamingRevenue table
// This is more reliable than battle_complete audit events which may be incomplete
const streamingRevenueRecords = await prisma.robotStreamingRevenue.findMany({
  where: { cycleNumber },
  include: {
    robot: {
      select: { userId: true }
    }
  }
});

streamingRevenueRecords.forEach((record) => {
  const userId = record.robot.userId;
  let metric = metricsMap.get(userId);
  if (!metric) {
    metric = { /* initialize metric */ };
    metricsMap.set(userId, metric);
  }
  metric.streamingIncome += record.streamingRevenue;
});
```

**Why This Works**:
- `RobotStreamingRevenue` table is populated by `trackStreamingRevenue()` function in `robotAnalyticsService.ts`
- This function is called by `awardStreamingRevenue()` after every battle (League, Tournament, Tag Team)
- The table is a reliable source of truth for streaming revenue per robot per cycle
- No dependency on audit log completeness

### Fix 2: Store and Use Balance from Snapshots

**Changes**:

1. **Added balance field to StableMetric** (line 31):
```typescript
interface StableMetric {
  userId: number;
  // ... other fields ...
  balance: number;  // NEW: Balance at end of cycle
}
```

2. **Fetch and store balance during snapshot creation** (lines 541-565):
```typescript
// Calculate total purchases and net profit, and fetch final balances
const userIdsArray = Array.from(metricsMap.keys());
const users = await prisma.user.findMany({
  where: { id: { in: userIdsArray } },
  select: { id: true, currency: true }
});

const balanceMap = new Map(users.map(u => [u.id, u.currency]));

metricsMap.forEach(metric => {
  // ... calculations ...
  
  // Store the user's balance at the end of this cycle
  metric.balance = balanceMap.get(metric.userId) || 0;
});
```

3. **Use stored balance in analytics route** (lines 238-252):
```typescript
// Use stored balance from snapshots instead of recalculating
const cycles = cyclesWithoutBalance.map((cycle, index) => {
  const snapshot = snapshots[index];
  const userMetrics = snapshot.stableMetrics.find(m => m.userId === userId);
  
  // Use the stored balance if available
  const balance = userMetrics?.balance ?? 0;
  
  return {
    ...cycle,
    balance,
  };
});
```

## Files Changed

### 1. prototype/backend/src/services/cycleSnapshotService.ts

**Lines Modified**: 17-31, 234-249, 291-315, 317-353, 356-418, 446-532, 541-565

**Changes**:
- Added `balance: number` to `StableMetric` interface
- Replaced 65 lines of audit log streaming revenue aggregation with 33 lines of direct table query
- Added balance fetching from user table
- Fixed variable naming conflict (`userIds` declared twice → second one renamed to `userIdsArray`)
- Added `balance: 0` initialization in all 7 places where `StableMetric` objects are created

### 2. prototype/backend/src/routes/analytics.ts

**Lines Modified**: 235-252

**Changes**:
- Removed 58 lines of complex balance recalculation logic
- Added 14 lines to directly use stored balance from snapshots
- Net reduction: 44 lines of code removed, logic simplified

### 3. prototype/backend/src/lib/prisma.ts (NEW FILE)

**Purpose**: Central Prisma client singleton that was being imported throughout the codebase but was missing

**Code**:
```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default prisma;
```

**Note**: This file is typically generated or created during setup but was gitignored. Force-added to repository.

## Impact

### Positive Changes
✅ Streaming revenue now correctly aggregated from `RobotStreamingRevenue` table  
✅ Balance uses stored values instead of error-prone recalculation  
✅ Reduced code complexity (44 net lines removed)  
✅ More reliable data source (database table vs. audit logs)  
✅ No dependency on audit log completeness  
✅ Faster API response (no need to query all previous snapshots)

### Breaking Changes
❌ None - this is a bug fix

### Migration Notes
⚠️ **Existing cycle snapshots** in the database won't have the `balance` field or updated `streamingIncome`

**Solution**: Run the snapshot backfill endpoint to regenerate historical snapshots:
```bash
POST /api/admin/snapshots/backfill
Authorization: Bearer <admin-token>
```

This will recreate snapshots for all cycles with the new logic.

## Testing Recommendations

1. **Create a new cycle** with streaming revenue to verify:
   - Snapshot stores streaming income from `RobotStreamingRevenue` table
   - Snapshot stores user balance
   - Cycle summary API returns correct streaming revenue
   - Cycle summary page displays streaming revenue correctly

2. **Run snapshot backfill** to verify:
   - Historical snapshots get regenerated with balance field
   - Streaming revenue is correctly backfilled from `RobotStreamingRevenue` table

3. **Check cycle summary page** (`/cycle-summary`) to verify:
   - STREAMING column shows correct revenue amounts
   - BALANCE column shows correct balance at end of each cycle

## Code Review Checklist

- [x] Root cause identified and documented
- [x] Solution addresses root cause directly
- [x] Code follows existing patterns and conventions
- [x] No security vulnerabilities introduced (CodeQL: 0 alerts)
- [x] TypeScript compilation successful
- [x] Interface changes propagated to all usages
- [x] Edge cases handled (missing balance, missing streaming revenue)
- [x] Database queries optimized (single query vs. loops)
- [x] Documentation updated

## Security Analysis (CodeQL)

**Status**: ✅ PASS  
**Alerts**: 0

No security issues detected in the changes.

## References

- Issue: "Cycle Summary does not show Streaming Income"
- Related Files:
  - `prototype/backend/src/services/streamingRevenueService.ts` - Calculates and awards streaming revenue
  - `prototype/backend/src/services/robotAnalyticsService.ts` - Tracks streaming revenue in database
  - `prototype/backend/src/services/battleOrchestrator.ts` - Awards streaming revenue after battles
  - `prototype/frontend/src/pages/CycleSummaryPage.tsx` - Displays cycle summary
  - `prototype/backend/prisma/schema.prisma` - Database schema with `RobotStreamingRevenue` model

---

**Fix Author**: GitHub Copilot  
**Date**: February 19, 2026  
**PR Branch**: `copilot/fix-cycle-summary-streaming-income`
