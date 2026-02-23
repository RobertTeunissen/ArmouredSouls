# Repair Cost System

**Last Updated**: February 17, 2026  
**Status**: Authoritative Reference

## Overview

The repair cost system in Armoured Souls tracks actual expenses incurred when robots are repaired, not estimated costs during battles. This ensures accurate financial tracking and allows facility upgrades to affect repair costs dynamically.

## Key Principles

1. **Battle execution does NOT calculate repair costs** - battles only track damage
2. **RepairService calculates costs when repairs are triggered** - ensures accuracy
3. **Repair costs are logged as expenses** - tracked in audit log and cycle summaries
4. **Facility upgrades affect repair costs** - upgrading Repair Bay reduces costs

## How It Works

### 1. Battle Execution

When a battle completes:
- Robot HP is reduced based on damage taken
- Damage is stored on the robot record
- **NO repair costs are calculated or stored**
- Battle table fields `robot1RepairCost` and `robot2RepairCost` are set to 0 (deprecated)

### 2. Repair Triggers

Repairs can be triggered in two ways:

**Manual Repair** (from `/robots` page):
- User clicks "Repair All" button
- Calls `repairAllRobots(deductCosts: true)`
- Costs calculated and deducted immediately

**Automatic Repair** (during cycle processing):
- Called 3 times per cycle:
  1. After league battles complete
  2. After tag team battles complete
  3. After tournament battles complete
- Each call to `repairAllRobots(deductCosts: true)` repairs all damaged robots

### 3. Repair Cost Calculation

The `RepairService.repairAllRobots()` function:

1. **Finds all damaged robots** (currentHP < maxHP)
2. **Calculates repair cost for each robot**:
   ```
   Base Repair Cost = Sum of All 23 Attributes × 100
   Damage Multiplier = 2.0x if HP=0, 1.5x if HP<10%, else 1.0x
   Raw Cost = Base × (Damage% / 100) × Multiplier
   
   Repair Bay Discount = Level × (5 + Active Robots), capped at 90%
   Final Cost = Raw Cost × (1 - Discount%)
   ```

3. **Applies Repair Bay discount** based on current facility level
4. **Deducts costs from user currency**
5. **Restores robot HP to maximum**
6. **Logs repair event** in audit log

### 4. Expense Tracking

When repairs are triggered:

```typescript
// Logged in audit log
await eventLogger.logRobotRepair(
  userId,
  robotId,
  repairCost,      // Actual cost with discount
  damageTaken,
  repairBayDiscount
);
```

This creates an audit log entry:
- `eventType`: `'robot_repair'`
- `payload.cost`: Actual repair cost (with discount)
- `payload.robotId`: Robot that was repaired
- `payload.damageTaken`: HP damage repaired
- `payload.repairBayDiscount`: Discount percentage applied

### 5. Cycle Summary

The cycle summary aggregates all repair expenses from the audit log:

```typescript
// CycleSnapshotService aggregates from audit log
const repairEvents = await prisma.auditLog.findMany({
  where: {
    cycleNumber,
    eventType: 'robot_repair',
  },
});

repairEvents.forEach(event => {
  const userId = event.userId;
  const cost = event.payload.cost;
  stableMetrics[userId].totalRepairCosts += cost;
});
```

This appears in the cycle summary as:
- **Repair Costs** column: Total spent on repairs (from audit log)
- **Expenses** column: Repairs + Operating Costs
- **Purchases** column: Weapons + Facilities + Attributes
- **Net Profit** column: Income - Expenses - Purchases
- **Balance** column: Running balance at end of cycle (cumulative, never changes for historical cycles)

### 6. Balance Tracking

Each cycle snapshot includes the end-of-cycle balance:

```typescript
// Calculate starting balance from cycle 0 or first snapshot
let runningBalance = startingBalance;

// For each cycle, add income and subtract expenses/purchases
cycles.forEach(cycle => {
  runningBalance += cycle.income - cycle.expenses - cycle.purchases;
  cycle.balance = runningBalance;
});
```

Key points:
- Balance is calculated cumulatively from starting balance
- Historical cycle balances never change when new cycles run
- Balance = previous balance + income - expenses - purchases

## Example Scenario

### Scenario: Player upgrades Repair Bay mid-cycle

**Starting State:**
- Repair Bay Level: 1
- Active Robots: 2
- Discount: 1 × (5 + 2) = 7%

**Battle 1:**
- Robot takes 50 HP damage
- No repair cost calculated yet

**Player Action:**
- Upgrades Repair Bay to Level 2
- Cost: ₡200,000 (logged as facility_purchase)

**Repair Trigger (after league battles):**
- Repair Bay Level: 2 (NEW)
- Active Robots: 2
- Discount: 2 × (5 + 2) = 14% (NEW)
- Robot repair cost: ₡10,000 × 0.86 = ₡8,600 (with 14% discount)
- Logged as robot_repair expense

**Cycle Summary:**
- Purchases: ₡200,000 (Repair Bay upgrade)
- Expenses: ₡8,600 (Repair costs with 14% discount)
- Net: -₡208,600

**Key Point:** The repair cost reflects the CURRENT Repair Bay level (2), not the level during the battle (1).

## Benefits of This Approach

1. **Accurate Costs**: Repair costs reflect actual facility levels when repairs happen
2. **Dynamic Pricing**: Upgrading facilities immediately affects repair costs
3. **Clear Expenses**: All expenses (repairs, purchases, operating costs) tracked consistently
4. **Strategic Decisions**: Players can upgrade Repair Bay before repairing to save money
5. **Audit Trail**: Complete history of all repair actions and costs

## Implementation Details

### RepairService Location
- **File**: `prototype/backend/src/services/repairService.ts`
- **Function**: `repairAllRobots(deductCosts: boolean)`
- **Formula**: Uses `calculateRepairCost()` from `robotCalculations.ts`

### Repair Triggers
- **Manual**: `/api/robots/repair-all` endpoint
- **Automatic**: Called in `/api/admin/process-cycle` at steps 2, 4, and 6

### Audit Logging
- **Service**: `eventLogger.logRobotRepair()`
- **Event Type**: `'robot_repair'`
- **Payload**: `{ cost, robotId, damageTaken, repairBayDiscount }`

### Cycle Aggregation
- **Service**: `cycleSnapshotService.createSnapshot()`
- **Field**: `stableMetrics[].totalRepairCosts`
- **Source**: Sum of all `robot_repair` events in cycle

## Migration Notes

### Deprecated Fields

The following fields are deprecated and set to 0:
- `Battle.robot1RepairCost` - no longer calculated
- `Battle.robot2RepairCost` - no longer calculated
- `Robot.repairCost` - no longer used for cost tracking

These fields remain in the database schema for backwards compatibility but should not be used for financial calculations.

### Historical Data

For cycles before this change:
- Battle-stored repair costs may not match actual expenses
- Cycle summaries should use audit log data when available
- If audit log is missing, use cycle snapshot `totalRepairCosts` field

## See Also

- [PRD_ECONOMY_SYSTEM.md](prd_core/PRD_ECONOMY_SYSTEM.md) - Economic system overview
- [COMBAT_FORMULAS.md](prd_core/COMBAT_FORMULAS.md) - Damage calculation formulas
- [PRD_FACILITIES_PAGE.md](prd_pages/PRD_FACILITIES_PAGE.md) - Repair Bay facility details
