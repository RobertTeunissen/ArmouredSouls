# URGENT FIX: Regenerate Cycle Snapshots

## Problem
The cycle summary page shows ₡0 for Merchandising and Streaming income, even though:
- Terminal logs show streaming revenue being earned (₡1,002, ₡1,004, etc.)
- The total income IS correct (₡19,266)

## Root Cause
The cycle snapshots in your database were created with **broken code** (commit 37ff6f0) that failed to aggregate income properly because:
1. It relied only on audit log battle IDs
2. If those were missing/incomplete, it created empty snapshots
3. Your existing Cycle 2 snapshot has bad data (₡0 for streaming/merchandising)

## Solution

### Step 1: Regenerate Snapshots

Run this command to regenerate ALL cycle snapshots with the fixed code:

```bash
curl -X POST http://localhost:3001/api/admin/snapshots/backfill \
  -H "Authorization: ******" \
  -H "Content-Type: application/json"
```

**What this does:**
- Deletes old snapshots with bad data
- Recreates them using the FIXED aggregation logic
- Queries `RobotStreamingRevenue` table for accurate streaming income
- Properly aggregates merchandising from passive_income events
- Stores accurate balance values

### Step 2: Verify the Fix

After running backfill:

1. **Refresh the cycle summary page**: `http://localhost:3000/cycle-summary`

2. **Expected result**:
   ```
   Cycle 2:
   - Battle Credits: ₡19,266 ✓
   - Merchandising: ₡[some value] ✓ (not ₡0)
   - Streaming: ₡[some value] ✓ (not ₡0)
   - Total Income: ₡[sum of above] ✓
   ```

3. **Terminal check**: Run backfill and watch for:
   ```
   [CycleSnapshotService] Found X battle_complete events for cycle 2
   [CycleSnapshotService] Retrieved Y battles from audit log IDs
   ```

### Step 3: Provide Screenshots

Take screenshots showing:
1. The backfill command response
2. The cycle summary page AFTER backfill (showing non-zero values)
3. The Cycle Details table with all income components populated

## Technical Details

### What Was Fixed

**Commit 0d8f3a7** restored a smarter fallback mechanism:

```typescript
// Primary: Use audit log battle IDs
if (battleIdsInCycle.size > 0) {
  cycleBattles = await prisma.battle.findMany({
    where: { id: { in: Array.from(battleIdsInCycle) } }
  });
} else {
  // Fallback: Query by timestamp (robustness)
  cycleBattles = await prisma.battle.findMany({
    where: {
      createdAt: { gte: start, lte: end }
    }
  });
}
```

This ensures:
- ✅ Audit log is primary source (preferred)
- ✅ Timestamp fallback for robustness (if audit incomplete)
- ✅ Streaming revenue correctly aggregated from `RobotStreamingRevenue` table
- ✅ Merchandising correctly aggregated from `passive_income` events

### Why Backfill is Needed

Your current snapshots were created with commit 37ff6f0 (broken code):
- That code had NO fallback
- If `battleIdsInCycle` was empty, it created empty snapshots
- Income data was lost

The backfill regenerates snapshots with the FIXED code:
- Uses the restored fallback
- Properly aggregates all income sources
- Creates accurate snapshots

## Alternative: Manual Snapshot Regeneration

If you prefer to regenerate specific cycles:

```bash
# Delete old snapshot
curl -X DELETE "http://localhost:3001/api/admin/snapshots/2" \
  -H "Authorization: ******"

# Trigger new cycle to recreate snapshot
# (or use backfill to recreate all)
```

## Verification Queries

Check snapshot data directly:

```sql
-- Check Cycle 2 snapshot has streaming income
SELECT 
  "cycleNumber",
  "stableMetrics"::json->0->>'streamingIncome' as streaming,
  "stableMetrics"::json->0->>'merchandisingIncome' as merchandising,
  "stableMetrics"::json->0->>'totalCreditsEarned' as battle_credits
FROM "CycleSnapshot"
WHERE "cycle_number" = 2;
```

Expected: All values should be > 0

---

**Status**: Code fixed, awaiting snapshot regeneration  
**Action Required**: Run backfill command and provide screenshots
