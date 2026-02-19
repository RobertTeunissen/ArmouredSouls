# CYCLE SUMMARY DATA FLOW - DEBUGGING GUIDE

## Overview
This document explains EXACTLY how data flows from battle execution to the cycle summary page, so you can verify where things are breaking.

---

## Step-by-Step Data Flow

### 1. BATTLE EXECUTION

**When:** Admin triggers cycle execution  
**What happens:** Battles are executed via `battleOrchestrator.ts`

**Actions:**
- Tournament matches are processed
- Each battle generates rewards, streaming revenue, etc.
- **Terminal logs show:** `[Streaming] WimpBot 54 earned ₡1,002 from Tournament Battle #102`

---

### 2. AUDIT LOG STORAGE

**Table:** `AuditLog`  
**Event Type:** `battle_complete`

**Code location:** `prototype/backend/src/services/battleOrchestrator.ts` (lines 615-685)

**What's stored in the event payload:**
```typescript
{
  battleId: 102,
  robot1Id: 54,
  robot2Id: 75,
  winnerId: 75,
  winnerReward: 4383,
  loserReward: 1315,
  streamingRevenue1: 1002,  // ← Streaming for robot 54
  streamingRevenue2: 1004,  // ← Streaming for robot 75
  robot1PrestigeAwarded: 3,
  robot2PrestigeAwarded: 3,
  robot1RepairCost: 0,
  robot2RepairCost: 0,
  // ... more fields
}
```

**VERIFY THIS STEP:**
```sql
-- Check if battle_complete events exist for cycle 2
SELECT 
  id,
  "eventType",
  payload->>'battleId' as battle_id,
  payload->>'streamingRevenue1' as streaming1,
  payload->>'streamingRevenue2' as streaming2
FROM "AuditLog"
WHERE "cycleNumber" = 2 
  AND "eventType" = 'battle_complete'
LIMIT 5;
```

**Expected:** You should see rows with battleId, streamingRevenue1, streamingRevenue2 values

---

### 3. STREAMING REVENUE TABLE

**Table:** `robot_streaming_revenue`

**Code location:** `prototype/backend/src/services/robotAnalyticsService.ts` (lines 29-73)

**What's stored:**
- robotId: 54
- cycleNumber: 2
- streamingRevenue: 1002
- battlesInCycle: 1

**VERIFY THIS STEP:**
```sql
-- Check if streaming revenue was tracked for cycle 2
SELECT 
  "robotId",
  "cycleNumber",
  "streamingRevenue",
  "battlesInCycle"
FROM "robot_streaming_revenue"
WHERE "cycle_number" = 2
ORDER BY "streamingRevenue" DESC
LIMIT 10;
```

**Expected:** You should see entries for each robot that battled in cycle 2

---

### 4. CYCLE SNAPSHOT CREATION

**Table:** `CycleSnapshot`

**Code location:** `prototype/backend/src/services/cycleSnapshotService.ts` (line 70+)

**When:** End of cycle execution, snapshot is created

**What it does:**
1. Query `battle_complete` events from AuditLog
2. Extract streaming revenue from event payloads
3. Aggregate by user (robot owner)
4. Store in `stableMetrics` JSON field

**Code flow (MY LATEST FIX):**
```typescript
// Get battle_complete events
const battleCompleteEvents = await prisma.auditLog.findMany({
  where: { cycleNumber, eventType: 'battle_complete' }
});

// Extract streaming from payload
battleCompleteEvents.forEach(event => {
  const payload = event.payload;
  metric.streamingIncome += payload.streamingRevenue1;
  metric.streamingIncome += payload.streamingRevenue2;
});
```

**VERIFY THIS STEP:**
```sql
-- Check the snapshot for cycle 2
SELECT 
  "cycleNumber",
  "stableMetrics"
FROM "CycleSnapshot"
WHERE "cycle_number" = 2;
```

**Expected:** The `stableMetrics` JSON should contain:
```json
[
  {
    "userId": 2,
    "totalCreditsEarned": 19266,
    "streamingIncome": [SOME NUMBER > 0],
    "merchandisingIncome": 0,
    ...
  }
]
```

**If streamingIncome is 0 here, the snapshot aggregation is broken!**

---

### 5. CYCLE SUMMARY API

**Endpoint:** `GET /api/analytics/stable/:userId/summary?lastNCycles=10`

**Code location:** `prototype/backend/src/routes/analytics.ts` (lines 85-312)

**What it does:**
1. Fetch snapshots from `CycleSnapshot` table
2. Extract `stableMetrics` for the user
3. Return breakdown including streaming

**Code:**
```typescript
return {
  cycleNumber: snapshot.cycleNumber,
  breakdown: {
    battleCredits: userMetrics.totalCreditsEarned,
    streaming: userMetrics.streamingIncome,  // ← This value
    merchandising: userMetrics.merchandisingIncome,
    // ...
  }
};
```

**VERIFY THIS STEP:**
```bash
# Call the API directly
curl "http://localhost:3001/api/analytics/stable/2/summary?lastNCycles=2" | jq
```

**Expected:** You should see:
```json
{
  "cycles": [
    {
      "cycleNumber": 2,
      "breakdown": {
        "battleCredits": 19266,
        "streaming": [SOME NUMBER > 0],
        "merchandising": 0
      }
    }
  ]
}
```

**If streaming is 0 here, check the snapshot data (Step 4)**

---

### 6. FRONTEND DISPLAY

**Page:** `/cycle-summary`  
**Component:** `prototype/frontend/src/pages/CycleSummaryPage.tsx`

**What it does:**
1. Calls the API from Step 5
2. Displays the data in a table

**Code:** Lines 285-295 render the table with `cycle.breakdown.streaming`

---

## DIAGNOSIS STEPS

### Step 1: Check AuditLog has battle_complete events
```sql
SELECT COUNT(*) 
FROM "AuditLog" 
WHERE "cycleNumber" = 2 AND "eventType" = 'battle_complete';
```

**If 0:** Battles aren't being logged to audit log!  
**If > 0:** Continue to Step 2

### Step 2: Check event payload has streaming revenue
```sql
SELECT 
  payload->>'battleId' as battle,
  payload->>'streamingRevenue1' as stream1,
  payload->>'streamingRevenue2' as stream2
FROM "AuditLog" 
WHERE "cycleNumber" = 2 AND "eventType" = 'battle_complete'
LIMIT 3;
```

**If stream1/stream2 are null:** Payload isn't being populated correctly!  
**If they have values:** Continue to Step 3

### Step 3: Check snapshot has streaming data
```sql
SELECT 
  "cycleNumber",
  "stableMetrics"::json->0->>'streamingIncome' as streaming,
  "stableMetrics"::json->0->>'totalCreditsEarned' as credits
FROM "CycleSnapshot" 
WHERE "cycle_number" = 2;
```

**If streaming is "0":** Snapshot aggregation is broken! (MY CODE BUG)  
**If streaming has a value:** Continue to Step 4

### Step 4: Check API response
```bash
curl "http://localhost:3001/api/analytics/stable/2/summary?lastNCycles=2" | jq '.cycles[] | select(.cycleNumber == 2) | .breakdown.streaming'
```

**If 0:** Snapshot has bad data, need to regenerate  
**If > 0:** Frontend isn't displaying correctly

---

## LIKELY PROBLEMS

Based on your screenshot showing ₡0 for streaming:

### Problem A: Snapshot was created BEFORE my fix
- **Symptom:** AuditLog has data, but snapshot shows 0
- **Solution:** Regenerate snapshot
```bash
curl -X POST http://localhost:3001/api/admin/snapshots/backfill \
  -H "Authorization: ******"
```

### Problem B: Snapshot aggregation is broken
- **Symptom:** AuditLog has data, regenerating snapshot still shows 0
- **Solution:** My code has a bug - need to debug `cycleSnapshotService.ts`

### Problem C: AuditLog doesn't have streaming data
- **Symptom:** battle_complete events exist but payload is missing streamingRevenue1/2
- **Solution:** Bug in `battleOrchestrator.ts` - streaming isn't being logged

### Problem D: AuditLog doesn't have battle_complete events
- **Symptom:** No battle_complete events for cycle 2
- **Solution:** Bug in `battleOrchestrator.ts` - events aren't being created

---

## DEBUGGING COMMANDS

Run these in order to find the problem:

```bash
# 1. Connect to database
psql "postgresql://user:password@localhost:5432/armouredsouls"

# 2. Check battle_complete events exist
SELECT COUNT(*) FROM "AuditLog" WHERE "cycleNumber" = 2 AND "eventType" = 'battle_complete';

# 3. Check payload structure
SELECT payload FROM "AuditLog" WHERE "cycleNumber" = 2 AND "eventType" = 'battle_complete' LIMIT 1;

# 4. Check snapshot data
SELECT "stableMetrics" FROM "CycleSnapshot" WHERE "cycle_number" = 2;

# 5. Check API response
curl "http://localhost:3001/api/analytics/stable/2/summary?lastNCycles=2" | jq
```

---

## NEXT STEPS

1. Run the SQL queries above
2. Report back which step is failing
3. I can fix the specific issue once we know where it breaks

The data flow is:
**Battle → AuditLog → CycleSnapshot → API → Frontend**

We need to find which link in the chain is broken.
