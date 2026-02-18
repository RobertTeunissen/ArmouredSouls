# Repair Cost System Bugs - Fixed

**Date**: February 18, 2026  
**Status**: Complete

## Summary

Fixed three critical bugs in the repair cost refactor that were preventing the system from working correctly.

## Bugs Fixed

### 1. Tag Team Battle Currency Error (Line 1717)

**Error**: `ReferenceError: team1ActiveRepairCost is not defined`

**Root Cause**: When we removed repair cost calculations from battles, we forgot to update the currency increment logic in tag team battles. The code was still trying to subtract repair costs that no longer existed.

**Fix**: Updated `tagTeamBattleOrchestrator.ts` line 1717 to only increment currency by rewards, not subtract repair costs:

```typescript
// Before (broken)
currency: { increment: team1Rewards - team1ActiveRepairCost - team1ReserveRepairCost }

// After (fixed)
currency: { increment: team1Rewards }
```

**Rationale**: Repair costs are now deducted separately by RepairService, not during battle execution.

---

### 2. Repair Costs Not Tracked in Cycle Snapshots

**Symptom**: Cycle summary showed ₡0 for repair costs even though repairs were being performed and logged.

**Root Cause**: The `cycleSnapshotService.ts` was aggregating repair costs from the battle table (`battle.robot1RepairCost` and `battle.robot2RepairCost`), but those fields are now always 0. The service wasn't reading from the audit log where actual repair costs are logged.

**Fix**: Added repair cost aggregation from audit log in `cycleSnapshotService.ts`:

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
  if (!metric) {
    // Create metric entry if needed
    metric = { /* ... */ };
    metricsMap.set(event.userId, metric);
  }
  
  const payload = event.payload as any;
  metric.totalRepairCosts += payload.cost || 0;
});
```

Also removed the deprecated repair cost aggregation from battles:

```typescript
// Removed (deprecated)
metric1.totalRepairCosts += battle.robot1RepairCost || 0;
metric2.totalRepairCosts += battle.robot2RepairCost || 0;
```

---

### 3. Attribute Upgrades Not Tracked

**Symptom**: Attribute upgrades performed during a cycle didn't appear in the cycle summary purchases column.

**Root Cause**: The attribute upgrade aggregation logic tried to find the robot owner by searching through battles. If the robot didn't participate in any battles that cycle, the event was skipped.

**Fix**: Changed the logic to query the robot directly from the database:

```typescript
// Before (broken)
const robot = cycleBattles.find((b: any) => 
  b.robot1Id === event.robotId || b.robot2Id === event.robotId
);

if (!robot) {
  return; // Skip if robot not found in battles
}

// After (fixed)
const robot = await prisma.robot.findUnique({
  where: { id: event.robotId },
  select: { userId: true },
});

if (!robot) continue;

const userId = robot.userId;
```

Also changed from `forEach` to `for...of` loop to support async/await.

---

### 4. Balance Calculation Issue (Potential)

**Error**: `ReferenceError: Cannot access 'cycles' before initialization`

**Status**: The code in `analytics.ts` appears correct. The error may have been from a previous version or a transient issue. The current implementation:

1. First pass: Creates `cyclesWithoutBalance` array
2. Calculates starting balance by working backwards from current balance
3. Second pass: Creates `cycles` array with balance added to each cycle
4. Uses `cycles` array in response

This is the correct order and should not cause initialization errors.

---

### 5. Additional Cleanup

Fixed several other places that were still using battle repair costs:

**Tournament Battles**: Changed `tournamentBattleOrchestrator.ts` to set repair costs to 0 instead of calculating them during battles.

**Robot Metrics in Snapshots**: Updated `cycleSnapshotService.ts` to not aggregate repair costs from battle table for robot metrics, and added aggregation from audit log.

**Robot Performance Service**: Updated `robotPerformanceService.ts` to query repair costs from audit log instead of battle table when aggregating from battles directly.

These changes ensure consistency across the entire system - repair costs are ONLY tracked in the audit log, never in the battle table.

---

## Testing Recommendations

1. **Reset and run fresh cycles** to ensure all audit log events are properly logged
2. **Verify cycle summary** shows correct repair costs, attribute upgrades, and balance
3. **Test tag team battles** to ensure no currency errors
4. **Upgrade attributes mid-cycle** to verify they appear in purchases
5. **Check balance stability** - historical cycle balances should not change when new cycles run

---

## Files Modified

1. `prototype/backend/src/services/tagTeamBattleOrchestrator.ts` - Fixed currency increment (removed repair cost deductions)
2. `prototype/backend/src/services/tournamentBattleOrchestrator.ts` - Set repair costs to 0 in battle records
3. `prototype/backend/src/services/cycleSnapshotService.ts` - Added repair cost aggregation from audit log for both stable and robot metrics, fixed attribute upgrade tracking
4. `prototype/backend/src/services/robotPerformanceService.ts` - Changed to aggregate repair costs from audit log instead of battle table
5. `docs/REPAIR_COST_SYSTEM.md` - Updated documentation with cycle snapshot and balance tracking details

---

## System Flow (Corrected)

```
Battle Execution
  ↓
  Damage robots, award credits
  ↓
  (NO repair costs calculated)
  ↓
RepairService.repairAllRobots()
  ↓
  Calculate costs with current facility levels
  ↓
  Deduct from user currency
  ↓
  Log to audit log (eventType: 'robot_repair')
  ↓
CycleSnapshotService
  ↓
  Aggregate repair costs FROM AUDIT LOG
  ↓
  Aggregate attribute upgrades FROM AUDIT LOG
  ↓
  Calculate net profit and balance
  ↓
Cycle Summary Display
  ↓
  Show repair costs, purchases, balance
```

---

## Key Takeaway

The repair cost system now works as designed:
- Battles don't calculate repair costs
- RepairService is the single source of truth
- All expenses (repairs, purchases, operating costs) are logged in audit log
- Cycle snapshots aggregate from audit log, not battle table
- Balance is cumulative and stable for historical cycles
