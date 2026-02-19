# CycleSnapshot vs AuditLog - What's the Difference?

## Question: "What's in CycleSnapshot that is NOT in AuditLog?"

The answer: **Pre-aggregated metrics and timing data**. Here's the complete breakdown:

---

## AuditLog Table

**Purpose:** Complete, immutable record of EVERY event that happens

**Schema:**
```typescript
{
  id: BigInt,
  cycleNumber: Int,
  eventType: String,        // "battle_complete", "robot_purchase", etc.
  eventTimestamp: DateTime,
  sequenceNumber: Int,      // Order within cycle
  
  userId: Int?,             // Who did it
  robotId: Int?,            // Which robot
  battleId: Int?,           // Which battle
  
  payload: Json,            // Event-specific data
  metadata: Json?           // Debug info
}
```

**Contains:**
- Individual events (one row per event)
- Battle results, purchases, repairs, income, etc.
- Raw data (not aggregated)

**Example rows:**
```
Event 1: battle_complete, userId=60, robotId=54, payload={credits:1315, streamingRevenue:1002}
Event 2: battle_complete, userId=61, robotId=75, payload={credits:4383, streamingRevenue:1004}
Event 3: robot_repair, userId=60, robotId=54, payload={cost:500}
... (hundreds more events)
```

---

## CycleSnapshot Table

**Purpose:** Pre-computed summary of entire cycle for fast analytics

**Schema:**
```typescript
{
  id: Int,
  cycleNumber: Int,
  triggerType: String,      // "manual" or "scheduled"
  
  // ⭐ NOT in AuditLog:
  startTime: DateTime,       // When cycle started
  endTime: DateTime,         // When cycle ended
  durationMs: Int,           // How long cycle took
  
  // ⭐ NOT in AuditLog (aggregated):
  stableMetrics: Json,       // Per-user totals
  robotMetrics: Json,        // Per-robot stats
  stepDurations: Json,       // How long each step took
  
  // ⭐ NOT in AuditLog (summary stats):
  totalBattles: Int,         // Total battles in cycle
  totalCreditsTransacted: BigInt,
  totalPrestigeAwarded: Int,
  
  createdAt: DateTime
}
```

**Contains:**
- ONE row per cycle (not per event)
- Aggregated data (sums, totals, averages)
- Timing metadata (start, end, duration)
- Step-by-step execution times

**Example row:**
```json
{
  "cycleNumber": 2,
  "startTime": "2026-02-19T10:00:00Z",
  "endTime": "2026-02-19T10:02:30Z",
  "durationMs": 150000,
  
  "stableMetrics": [
    {
      "userId": 60,
      "username": "player1",
      "battlesParticipated": 5,
      "totalCreditsEarned": 19266,
      "streamingIncome": 5010,
      "merchandising": 0,
      "totalExpenses": 17968,
      "repairCosts": 16368,
      "operatingCosts": 1600,
      "balance": 122113
    }
  ],
  
  "robotMetrics": [
    {
      "robotId": 54,
      "battles": 3,
      "wins": 1,
      "losses": 2,
      "creditsEarned": 5678
    }
  ],
  
  "stepDurations": {
    "step1_league_battles": 45000,
    "step2_tournament": 30000,
    "step3_repairs": 15000,
    ...
  },
  
  "totalBattles": 24,
  "totalCreditsTransacted": 95432,
  "totalPrestigeAwarded": 120
}
```

---

## What's ONLY in CycleSnapshot (NOT in AuditLog)?

### 1. Cycle Timing Data ⏱️
- `startTime` - When cycle execution began
- `endTime` - When cycle execution completed
- `durationMs` - Total milliseconds to execute cycle
- `triggerType` - Was it manual or scheduled?

**Why not in AuditLog?**
- AuditLog has individual event timestamps, not cycle-level timing
- No concept of "cycle start" or "cycle end" events

### 2. Step Execution Times 📊
```json
"stepDurations": {
  "step1_league_battles": 45000,
  "step2_tournament_battles": 30000,
  "step3_tag_team_battles": 15000,
  "step4_apply_damage_decay": 2000,
  "step5_passive_income": 5000,
  ...
}
```

**Why not in AuditLog?**
- Performance monitoring data
- Shows which steps are slow
- Not part of game logic

### 3. Pre-Aggregated Metrics 📈

**stableMetrics (per user):**
```json
{
  "userId": 60,
  "battlesParticipated": 5,      // COUNT(battles)
  "totalCreditsEarned": 19266,   // SUM(credits)
  "streamingIncome": 5010,       // SUM(streaming)
  "totalExpenses": 17968,        // SUM(expenses)
  "balance": 122113              // Final balance
}
```

**robotMetrics (per robot):**
```json
{
  "robotId": 54,
  "battles": 3,      // COUNT(battles)
  "wins": 1,         // COUNT(wins)
  "losses": 2,       // COUNT(losses)
  "draws": 0
}
```

**Why not in AuditLog?**
- AuditLog has raw events, you'd need to aggregate them yourself
- Snapshot pre-computes these for fast queries
- Calculating from scratch on every page load would be slow

### 4. Summary Statistics 📊
- `totalBattles` - Total battles in cycle
- `totalCreditsTransacted` - Total credits moved
- `totalPrestigeAwarded` - Total prestige earned

**Why not in AuditLog?**
- Quick filtering/sorting without aggregation queries
- Enables "find cycles with >100 battles" without scanning all events

---

## Why Both Tables?

### AuditLog = Complete History 📜
- **Purpose**: Immutable record of everything
- **Use case**: Debugging, verification, detailed analysis
- **Query**: "Show me all battles for user 60"
- **Speed**: Slower (many rows)

### CycleSnapshot = Fast Analytics ⚡
- **Purpose**: Pre-computed summaries
- **Use case**: Dashboards, charts, comparisons
- **Query**: "Show me cycle 2 summary"
- **Speed**: Fast (one row)

---

## Real-World Comparison

### To Get User's Total Streaming Income in Cycle 2:

**Using AuditLog (SLOW):**
```sql
SELECT SUM(CAST(payload->>'streamingRevenue' AS INT))
FROM "AuditLog"
WHERE "cycleNumber" = 2
  AND "userId" = 60
  AND "eventType" = 'battle_complete';
```
- Scans hundreds of rows
- JSON parsing required
- ~100ms query time

**Using CycleSnapshot (FAST):**
```sql
SELECT stableMetrics::json->0->>'streamingIncome'
FROM "CycleSnapshot"
WHERE "cycleNumber" = 2;
```
- Reads ONE row
- Pre-computed value
- ~1ms query time

---

## Summary Table

| Feature | AuditLog | CycleSnapshot |
|---------|----------|---------------|
| **Rows per cycle** | Hundreds | One |
| **Data granularity** | Individual events | Aggregated totals |
| **Cycle timing** | ❌ No | ✅ Yes (start/end/duration) |
| **Step durations** | ❌ No | ✅ Yes |
| **Pre-aggregated metrics** | ❌ No | ✅ Yes |
| **Summary stats** | ❌ No | ✅ Yes |
| **Query speed** | Slow (scan many rows) | Fast (one row) |
| **Use case** | Audit trail, debugging | Analytics, dashboards |

---

## Conclusion

**CycleSnapshot is NOT redundant!**

It contains:
1. ⏱️ **Cycle timing data** (start, end, duration, step times)
2. 📊 **Pre-aggregated metrics** (totals, sums, counts)
3. 📈 **Summary statistics** (for filtering/sorting)

These are **NOT** in AuditLog and would be expensive to compute on every query.

**Think of it like:**
- **AuditLog** = Your bank transaction history (every deposit/withdrawal)
- **CycleSnapshot** = Your monthly bank statement (totals and summary)

Both are necessary for different purposes!
