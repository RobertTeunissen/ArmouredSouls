# Design Document: Repair Bay Multi-Robot Discount System

## Overview

This design updates the Repair Bay discount formula to incentivize multi-robot strategies by adding a bonus based on the number of robots owned by a stable. The new formula multiplies the Repair Bay level by a factor that increases with robot count: `discount = repairBayLevel × (5 + activeRobotCount)`, capped at 90%.

This change affects:
- The core `calculateRepairCost()` function in `robotCalculations.ts`
- The repair service that applies discounts when repairing robots
- All UI pages that display repair costs (Robots page, Robot Detail page, Income Dashboard)
- Documentation describing the Repair Bay facility

## Architecture

### Component Interaction Flow

```
┌─────────────────┐
│  API Endpoint   │
│  (repair robot) │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│   Repair Service        │
│  - Query robot count    │
│  - Query facility levels│
└────────┬────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│  calculateRepairCost()           │
│  (CANONICAL - robotCalculations) │
│  - Apply new formula             │
│  - Cap at 90%                    │
└────────┬─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Database Update        │
│  - Deduct currency      │
│  - Restore robot HP     │
└─────────────────────────┘
```

### Consolidation Strategy

**Problem**: Three different repair cost calculation functions exist:
1. `robotCalculations.ts::calculateRepairCost` - Attribute-sum formula with Medical Bay support
2. `economyCalculations.ts::calculateRepairCostWithDiscounts` - Duplicate of #1
3. `tagTeamBattleOrchestrator.ts::calculateRepairCost` - Different formula (HP-based)

**Solution**: Consolidate to single canonical function in `robotCalculations.ts`

**Rationale**:
- The attribute-sum formula is more accurate (scales with robot power)
- Medical Bay integration is already implemented
- Most of the codebase already uses this function
- The HP-based formula in tagTeamBattleOrchestrator is simpler but less accurate

**Migration Steps**:
1. Update `robotCalculations.ts::calculateRepairCost` to accept `activeRobotCount` parameter
2. Remove `economyCalculations.ts::calculateRepairCostWithDiscounts` (exact duplicate)
3. Update `tagTeamBattleOrchestrator.ts` to import and use the canonical function
4. Update all call sites to pass correct parameters
5. Update tests to verify consistency across all battle types

### Affected Files

**Core Logic**:
- `prototype/backend/src/utils/robotCalculations.ts` - Update `calculateRepairCost()` function (CANONICAL)
- `prototype/backend/src/utils/economyCalculations.ts` - Remove duplicate function
- `prototype/backend/src/services/tagTeamBattleOrchestrator.ts` - Remove local function, use canonical
- `prototype/backend/src/services/repairService.ts` - Pass robot count to calculation

**API Integration**:
- Any API endpoints that call repair service (already integrated via repairService)

**Documentation**:
- `docs/prd_core/STABLE_SYSTEM.md` - Update Repair Bay facility description
- `docs/prd_pages/PRD_FACILITIES_PAGE.md` - Update benefits display
- `docs/prd_core/PRD_ECONOMY_SYSTEM.md` - Update repair cost formulas and examples
- `docs/prd_pages/PRD_BATTLE_STANCES_AND_YIELD.md` - Update repair cost calculations

**Testing**:
- `prototype/backend/tests/stanceAndYield.test.ts` - Update existing tests
- `prototype/backend/tests/tagTeamBattleOrchestrator.property.test.ts` - Update to use canonical function
- New property-based tests for the 90% cap and multi-robot discount

## Components and Interfaces

### 1. Updated `calculateRepairCost()` Function

**Location**: `prototype/backend/src/utils/robotCalculations.ts`

**Current Signature**:
```typescript
export function calculateRepairCost(
  sumOfAllAttributes: number,
  damagePercent: number,
  hpPercent: number,
  repairBayLevel: number = 0,
  medicalBayLevel: number = 0
): number
```

**New Signature**:
```typescript
export function calculateRepairCost(
  sumOfAllAttributes: number,
  damagePercent: number,
  hpPercent: number,
  repairBayLevel: number = 0,
  medicalBayLevel: number = 0,
  activeRobotCount: number = 0  // NEW PARAMETER
): number
```

**Updated Logic**:
```typescript
// OLD: const repairBayDiscount = Math.min(repairBayLevel * 5, 50) / 100;
// NEW:
const rawDiscount = repairBayLevel * (5 + activeRobotCount);
const repairBayDiscount = Math.min(rawDiscount, 90) / 100;
```

### 2. Updated Repair Service

**Location**: `prototype/backend/src/services/repairService.ts`

**Changes**:
1. Query robot count for each user
2. Pass robot count to `calculateRepairCost()`
3. Update discount reporting to reflect new formula

**Implementation**:
```typescript
// Inside the user loop, after querying facilities:
const activeRobotCount = await prisma.robot.count({
  where: {
    userId,
    NOT: { name: 'Bye Robot' }
  }
});

// When calling calculateRepairCost:
const repairCost = calculateRepairCost(
  sumOfAllAttributes,
  damagePercent,
  hpPercent,
  repairBayLevel,
  medicalBayLevel,
  activeRobotCount  // NEW
);

// Update discount calculation for reporting:
const rawDiscount = repairBayLevel * (5 + activeRobotCount);
const repairBayDiscount = Math.min(rawDiscount, 90);
```

### 3. Consolidation: Remove Duplicate Functions

**Location**: `prototype/backend/src/utils/economyCalculations.ts`

**Action**: Remove `calculateRepairCostWithDiscounts()` function entirely

**Rationale**: This function is an exact duplicate of `robotCalculations.ts::calculateRepairCost()`. All call sites should use the canonical function instead.

**Location**: `prototype/backend/src/services/tagTeamBattleOrchestrator.ts`

**Action**: Remove local `calculateRepairCost()` function and import from `robotCalculations.ts`

**Current Implementation** (to be removed):
```typescript
export function calculateRepairCost(
  robot: Robot,
  finalHP: number,
  isDestroyed: boolean,
  repairBayDiscount: number = 0
): number {
  const damageTaken = robot.maxHP - finalHP;
  let baseCost = damageTaken * REPAIR_COST_PER_HP;
  
  if (isDestroyed) {
    baseCost *= DESTRUCTION_MULTIPLIER;
  }
  
  const discountMultiplier = 1 - repairBayDiscount / 100;
  const finalCost = Math.round(baseCost * discountMultiplier);
  
  return Math.max(0, finalCost);
}
```

**New Implementation** (use canonical function):
```typescript
import { calculateRepairCost, calculateAttributeSum } from '../utils/robotCalculations';

// When calculating repair costs in tag team battles:
const sumOfAllAttributes = calculateAttributeSum(robot);
const damagePercent = ((robot.maxHP - finalHP) / robot.maxHP) * 100;
const hpPercent = (finalHP / robot.maxHP) * 100;

const repairCost = calculateRepairCost(
  sumOfAllAttributes,
  damagePercent,
  hpPercent,
  repairBayLevel,
  medicalBayLevel,
  activeRobotCount
);
```

### 4. Update All Call Sites

**Locations to Update**:
1. `prototype/backend/src/services/repairService.ts` - Main repair service
2. `prototype/backend/src/services/battleOrchestrator.ts` - League battle repairs
3. `prototype/backend/src/services/tagTeamBattleOrchestrator.ts` - Tag team battle repairs
4. `prototype/backend/src/services/tournamentService.ts` - Tournament battle repairs (if applicable)
5. Any admin endpoints that trigger auto-repair

**Consistency Requirements**:
- All call sites must pass `activeRobotCount` parameter
- All call sites must use the same parameter order
- All call sites must handle the returned repair cost consistently

## Data Models

### Database Queries

**Robot Count Query**:
```typescript
const activeRobotCount = await prisma.robot.count({
  where: {
    userId: userId,
    NOT: { name: 'Bye Robot' }
  }
});
```

**Rationale**: 
- Counts all robots owned by the user
- Excludes the "Bye Robot" (system robot used for matchmaking)
- Does not filter by HP or battle-ready status (damaged robots still count)

### No Schema Changes Required

The existing database schema already supports this feature:
- `User.id` - Identifies the stable owner
- `Robot.userId` - Links robots to their owner
- `Facility.level` - Stores Repair Bay level
- No new fields needed

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Multi-Robot Discount Formula with Cap

*For any* repair bay level (0-10) and active robot count (0-10), the discount percentage should be calculated as `repairBayLevel × (5 + activeRobotCount)`, and the result should never exceed 90%.

**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: Robot Count Includes All Robots

*For any* stable, the active robot count used in repair cost calculations should include all robots owned by that stable, regardless of their current HP status or battle-ready state.

**Validates: Requirements 2.1, 2.2, 2.3**

### Property 3: Medical Bay Reduction Preserved

*For any* robot with HP = 0 (destroyed), the repair cost multiplier should be reduced by Medical Bay level × 10%, maintaining the existing Medical Bay functionality.

**Validates: Requirements 3.4, 8.4**

### Property 4: Attribute-Sum Formula Consistency

*For any* robot, the base repair cost should be calculated as `sumOfAllAttributes × 100 × (damagePercent / 100) × multiplier`, where multiplier depends on HP percentage (2.0 for HP=0, 1.5 for HP<10%, 1.0 otherwise).

**Validates: Requirements 8.3**

### Property 5: Repair Cost Consistency Across Battle Types

*For any* robot with the same damage, HP, facility levels, and robot count, the repair cost calculated should be identical whether the damage occurred in a league battle, tag team battle, or tournament battle.

**Validates: Requirements 8.6, 8.7, 8.8, 8.9**

### Property 6: Backward Compatibility with Default Parameter

*For any* repair cost calculation where `activeRobotCount` is not provided, the function should behave as if `activeRobotCount = 0`, producing the same results as the old formula for single-robot scenarios.

**Validates: Requirements 3.2**

## Error Handling

### Invalid Input Handling

**Negative Values**:
- Repair Bay level < 0: Treat as 0
- Active robot count < 0: Treat as 0
- Damage percent < 0: Treat as 0
- HP percent < 0: Treat as 0

**Out of Range Values**:
- Repair Bay level > 10: Cap at 10
- Active robot count > 10: Use actual count (no cap, but Roster Expansion limits to 10)
- Damage percent > 100: Cap at 100
- HP percent > 100: Cap at 100

**Edge Cases**:
- Zero damage: Return 0 repair cost
- Zero attributes: Return 0 repair cost (shouldn't happen in practice)
- Discount = 90%: Repair cost should be 10% of base cost

### Database Query Failures

**Robot Count Query Fails**:
- Fallback: Use `activeRobotCount = 0` (conservative, no multi-robot bonus)
- Log error for monitoring
- Continue with repair calculation

**Facility Query Fails**:
- Fallback: Use `repairBayLevel = 0` and `medicalBayLevel = 0`
- Log error for monitoring
- Continue with repair calculation (no discount)

## Testing Strategy

### Unit Tests

**Discount Calculation Examples**:
- Level 1 Repair Bay, 4 robots = 9% discount
- Level 3 Repair Bay, 2 robots = 21% discount
- Level 5 Repair Bay, 7 robots = 60% discount
- Level 10 Repair Bay, 10 robots = 90% discount (capped)
- Level 6 Repair Bay, 10 robots = 90% discount (capped)

**Edge Cases**:
- Zero robots: Discount = repairBayLevel × 5
- Zero repair bay level: Discount = 0
- Maximum discount scenarios (verify 90% cap)
- Backward compatibility (missing activeRobotCount parameter)

**Medical Bay Integration**:
- Verify Medical Bay reduction still applies to critical damage multiplier
- Test combinations of Repair Bay and Medical Bay discounts

### Property-Based Tests

**Property Test Configuration**:
- Minimum 100 iterations per test
- Use fast-check or similar PBT library for TypeScript
- Tag each test with feature name and property number

**Property 1 Test**:
```typescript
// Feature: repair-bay-multi-robot-discount, Property 1: Multi-Robot Discount Formula with Cap
fc.assert(
  fc.property(
    fc.integer({ min: 0, max: 10 }), // repairBayLevel
    fc.integer({ min: 0, max: 10 }), // activeRobotCount
    (repairBayLevel, activeRobotCount) => {
      const rawDiscount = repairBayLevel * (5 + activeRobotCount);
      const expectedDiscount = Math.min(rawDiscount, 90);
      
      // Call function and verify discount is applied correctly
      const result = calculateRepairCost(
        23000, // sumOfAllAttributes
        100,   // damagePercent
        50,    // hpPercent
        repairBayLevel,
        0,     // medicalBayLevel
        activeRobotCount
      );
      
      // Verify discount was capped at 90%
      return expectedDiscount <= 90;
    }
  ),
  { numRuns: 100 }
);
```

**Property 2 Test**:
```typescript
// Feature: repair-bay-multi-robot-discount, Property 2: Robot Count Includes All Robots
// Test that damaged robots are included in count
fc.assert(
  fc.property(
    fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 1, maxLength: 10 }), // robot HP values
    async (robotHPs) => {
      // Create robots with various HP values
      const userId = await createTestUser();
      for (const hp of robotHPs) {
        await createTestRobot(userId, hp);
      }
      
      // Query robot count
      const count = await prisma.robot.count({
        where: { userId, NOT: { name: 'Bye Robot' } }
      });
      
      // Verify all robots are counted
      return count === robotHPs.length;
    }
  ),
  { numRuns: 100 }
);
```

**Property 5 Test**:
```typescript
// Feature: repair-bay-multi-robot-discount, Property 5: Repair Cost Consistency Across Battle Types
// Verify repair costs are identical regardless of battle type
fc.assert(
  fc.property(
    fc.integer({ min: 1, max: 23000 }), // sumOfAllAttributes
    fc.integer({ min: 0, max: 100 }),   // damagePercent
    fc.integer({ min: 0, max: 100 }),   // hpPercent
    fc.integer({ min: 0, max: 10 }),    // repairBayLevel
    fc.integer({ min: 0, max: 10 }),    // medicalBayLevel
    fc.integer({ min: 0, max: 10 }),    // activeRobotCount
    (sumOfAllAttributes, damagePercent, hpPercent, repairBayLevel, medicalBayLevel, activeRobotCount) => {
      // Calculate repair cost using canonical function
      const cost1 = calculateRepairCost(
        sumOfAllAttributes,
        damagePercent,
        hpPercent,
        repairBayLevel,
        medicalBayLevel,
        activeRobotCount
      );
      
      // Simulate calling from different contexts (should all use same function)
      const cost2 = calculateRepairCost(
        sumOfAllAttributes,
        damagePercent,
        hpPercent,
        repairBayLevel,
        medicalBayLevel,
        activeRobotCount
      );
      
      // Verify costs are identical
      return cost1 === cost2;
    }
  ),
  { numRuns: 100 }
);
```

### Integration Tests

**Repair Service Integration**:
- Test that repair service correctly queries robot count
- Test that repair service passes robot count to calculation
- Test that repair costs are deducted correctly

**Battle Integration**:
- Test league battles use canonical function
- Test tag team battles use canonical function
- Test tournament battles use canonical function
- Test auto-repair (3 triggers per cycle) uses canonical function

**UI Integration**:
- Test Robots page displays correct repair costs
- Test Robot Detail page displays correct repair costs
- Test Income Dashboard displays correct repair costs
- Test all pages query robot count correctly

