# ANSWER: How to Verify What's Going Wrong

You asked for the precise steps being taken. Here they are:

## THE DATA FLOW

### 1. Battle Generation
**Code:** `battleOrchestrator.ts` (executeScheduledBattles)  
**What:** Tournament battles are executed  
**Terminal:** Shows `[Streaming] WimpBot 54 earned ₡1,002 from Tournament Battle #102`

### 2. Actions Stored in Database

**Table 1: `AuditLog`**
- Event type: `battle_complete`
- Payload contains:
  ```json
  {
    "battleId": 102,
    "streamingRevenue1": 1002,
    "streamingRevenue2": 1004,
    "winnerReward": 4383,
    "loserReward": 1315,
    ...
  }
  ```

**Table 2: `robot_streaming_revenue`**
- robotId: 54
- cycleNumber: 2  
- streamingRevenue: 1002

**Table 3: `Battle`**
- Stores battle results
- Has winnerReward, loserReward fields

### 3. Terminal Logging
**Code:** `streamingRevenueService.ts` (line 269)  
**What:** Logs `[Streaming] ...` message to console

### 4. CSV Export
**Code:** `cycleCsvExportService.ts`  
**What:** Reads `battle_complete` events from AuditLog  
**Output:** `cycle2.csv` file with streaming_revenue column

### 5. Cycle Snapshot Creation
**Code:** `cycleSnapshotService.ts` (aggregateStableMetrics)  
**What:** 
- Reads `battle_complete` events from AuditLog
- Extracts streaming from payload
- Stores aggregated data in `CycleSnapshot` table

**Table: `CycleSnapshot`**
- cycleNumber: 2
- stableMetrics: JSON with `streamingIncome` field

### 6. Cycle Summary Page
**Frontend:** `/cycle-summary`  
**API:** `GET /api/analytics/stable/:userId/summary`  
**Code:** `analytics.ts` (lines 85-312)  
**What:**
- Reads `CycleSnapshot` table
- Returns `breakdown.streaming` from `stableMetrics.streamingIncome`

---

## WHY IT'S NOT WORKING

**The problem:** Your Cycle 2 snapshot was created BEFORE my latest fix (commit feba095).

**Evidence:**
- Terminal shows streaming being earned ✓
- AuditLog likely has the data ✓
- CycleSnapshot has streamingIncome: 0 ✗

**Solution:** Regenerate the snapshot

---

## HOW TO FIX IT

### Option 1: Run the diagnostic script
```bash
cd /home/runner/work/ArmouredSouls/ArmouredSouls
./diagnostic.sh
```

This will show you exactly where the data stops flowing.

### Option 2: Regenerate the snapshot manually
```bash
curl -X POST http://localhost:3001/api/admin/snapshots/backfill \
  -H "Authorization: ******"
```

This deletes old snapshots and recreates them with the fixed code.

### Option 3: Check the data manually

**Step 1: Check AuditLog**
```sql
SELECT 
  payload->>'battleId',
  payload->>'streamingRevenue1',
  payload->>'streamingRevenue2'
FROM "AuditLog" 
WHERE "cycleNumber" = 2 AND "eventType" = 'battle_complete'
LIMIT 3;
```

**Step 2: Check CycleSnapshot**
```sql
SELECT 
  "stableMetrics"::json->0->>'streamingIncome' as streaming,
  "stableMetrics"::json->0->>'totalCreditsEarned' as credits
FROM "CycleSnapshot" 
WHERE "cycle_number" = 2;
```

**Step 3: Compare**
- If AuditLog has streaming data but CycleSnapshot shows 0 → Snapshot needs regeneration
- If AuditLog doesn't have streaming data → Bug in battleOrchestrator.ts

---

## THE COMPLETE FLOW DIAGRAM

```
┌─────────────────────┐
│  Execute Battle     │
│  (Tournament #102)  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Calculate Rewards  │
│  - Battle credits   │
│  - Streaming ₡1,002 │
└──────────┬──────────┘
           │
           ├─────────────────────┐
           │                     │
           ▼                     ▼
┌──────────────────┐   ┌─────────────────────┐
│  Log to Terminal │   │  Store in AuditLog  │
│  [Streaming]...  │   │  battle_complete    │
└──────────────────┘   │  payload:           │
                       │  {streaming: 1002}  │
                       └──────────┬──────────┘
                                  │
                                  ▼
                       ┌─────────────────────┐
                       │  Track in Table     │
                       │  robot_streaming_   │
                       │  revenue            │
                       └──────────┬──────────┘
                                  │
                       (at end of cycle)
                                  │
                                  ▼
                       ┌─────────────────────┐
                       │  Create Snapshot    │
                       │  Read AuditLog      │
                       │  Aggregate data     │
                       │  Store in           │
                       │  CycleSnapshot      │
                       └──────────┬──────────┘
                                  │
                       (when viewing page)
                                  │
                                  ▼
                       ┌─────────────────────┐
                       │  API reads snapshot │
                       │  Returns breakdown  │
                       └──────────┬──────────┘
                                  │
                                  ▼
                       ┌─────────────────────┐
                       │  Frontend displays  │
                       │  /cycle-summary     │
                       └─────────────────────┘
```

---

## MY DIAGNOSIS

Based on your screenshots:

1. **Terminal shows streaming** → Battle execution works ✓
2. **Cycle summary shows ₡0** → Snapshot has bad data ✗

**Most likely cause:** Snapshot was created with old code before my fix.

**Solution:** Run the backfill endpoint to regenerate snapshots.

---

## FILES TO CHECK

1. **DEBUGGING_CYCLE_SUMMARY.md** - Full debugging guide with SQL queries
2. **diagnostic.sh** - Automated script to check all steps
3. **REGENERATE_SNAPSHOTS.md** - How to fix the snapshot data

---

## IF REGENERATING DOESN'T WORK

If you regenerate the snapshot and it STILL shows ₡0:

1. Run `./diagnostic.sh` and share the output
2. Check the AuditLog payload structure
3. I'll debug why my aggregation code isn't reading it correctly

The code SHOULD work - it reads `payload.streamingRevenue1` directly from the events. But I need to see your actual data to debug further.
