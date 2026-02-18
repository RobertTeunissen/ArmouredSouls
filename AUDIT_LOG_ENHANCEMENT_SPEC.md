# Audit Log Enhancement Specification

## Problem Statement

The current cycle summary and at-risk users features show inconsistent data because:
1. **Missing purchase tracking**: Weapon purchases, facility purchases, robot purchases, and attribute upgrades are not logged in the audit system
2. **Incomplete balance tracking**: We don't have ending balance snapshots for each cycle
3. **Data reconciliation impossible**: Cannot trace from starting balance → income → expenses → purchases → ending balance

### Example Discrepancy
For player1 (Epic Ride):
- Cycle Summary shows: Cycle 2 repair costs = ₡4,744
- At-Risk page shows: Cycle 2 total costs = ₡61,072 (includes ₡59,572 repairs)
- The ₡54,828 difference is unexplained without purchase tracking

## Requirements

### 1. Add Purchase Event Logging

#### 1.1 Weapon Purchases
**Location**: Wherever weapons are purchased (likely in weapon shop routes)
**Event Type**: `WEAPON_PURCHASE` (already exists in EventLogger)
**Payload**:
```typescript
{
  weaponId: number,
  weaponName: string,
  cost: number,
  balanceBefore: number,
  balanceAfter: number
}
```

#### 1.2 Facility Purchases & Upgrades  
**Location**: Facility purchase/upgrade routes
**Event Type**: `FACILITY_PURCHASE` / `FACILITY_UPGRADE` (already exist)
**Current Payload** (needs enhancement):
```typescript
{
  facilityType: string,
  oldLevel: number,
  newLevel: number,
  cost: number,
  action: 'purchase' | 'upgrade',
  balanceBefore: number,  // ADD THIS
  balanceAfter: number    // ADD THIS
}
```

#### 1.3 Robot Purchases
**Location**: Robot creation routes
**Event Type**: `ROBOT_PURCHASE` (NEW - needs to be added to EventLogger)
**Payload**:
```typescript
{
  robotId: number,
  robotName: string,
  cost: number,  // If robots cost credits
  balanceBefore: number,
  balanceAfter: number
}
```

#### 1.4 Attribute Upgrades
**Location**: Attribute upgrade routes
**Event Type**: `ROBOT_ATTRIBUTE_UPGRADE` (already exists)
**Current Payload** (needs enhancement):
```typescript
{
  attributeName: string,
  oldValue: number,
  newValue: number,
  cost: number,
  balanceBefore: number,  // ADD THIS
  balanceAfter: number    // ADD THIS
}
```

### 2. Add Balance Snapshot Events

#### 2.1 Cycle End Balance
**Location**: End of each cycle in bulk cycle execution
**Event Type**: `CYCLE_END_BALANCE` (NEW)
**Payload**:
```typescript
{
  balance: number,
  timestamp: string
}
```

#### 2.2 Battle Reward Tracking
**Location**: After battle rewards are distributed
**Event Type**: `CREDIT_CHANGE` (already exists, but ensure it's being used)
**Payload** (verify this is complete):
```typescript
{
  amount: number,
  newBalance: number,
  source: 'battle' | 'passive_income' | 'facility_purchase' | 'repair' | 'weapon_purchase' | 'other',
  referenceEventId?: number
}
```

### 3. Update Cycle Snapshot Service

**File**: `prototype/backend/src/services/cycleSnapshotService.ts`

Add to `stableMetrics`:
```typescript
{
  // ... existing fields ...
  
  // NEW FIELDS:
  weaponPurchases: number,        // Total spent on weapons
  facilityPurchases: number,      // Total spent on facilities
  robotPurchases: number,         // Total spent on robots
  attributeUpgrades: number,      // Total spent on upgrades
  totalPurchases: number,         // Sum of all purchases
  balanceStart: number,           // Balance at cycle start
  balanceEnd: number,             // Balance at cycle end
  balanceChange: number,          // Net change in balance
}
```

### 4. Update Analytics API

**File**: `prototype/backend/src/routes/analytics.ts`

Update `/api/analytics/stable/:userId/summary` response:
```typescript
{
  userId: number,
  cycleRange: [number, number],
  totalIncome: number,
  totalExpenses: number,
  totalPurchases: number,  // NEW
  netProfit: number,
  cycles: Array<{
    cycleNumber: number,
    income: number,
    expenses: number,
    purchases: number,  // NEW
    netProfit: number,
    balanceStart: number,  // NEW
    balanceEnd: number,    // NEW
    breakdown: {
      battleCredits: number,
      merchandising: number,
      streaming: number,
      repairCosts: number,
      operatingCosts: number,
      weaponPurchases: number,      // NEW
      facilityPurchases: number,    // NEW
      robotPurchases: number,       // NEW
      attributeUpgrades: number,    // NEW
    }
  }>
}
```

### 5. Update Frontend Cycle Summary Page

**File**: `prototype/frontend/src/pages/CycleSummaryPage.tsx`

Add columns to the table:
1. **Purchases** column (after Operating Costs)
   - Shows: weaponPurchases + facilityPurchases + robotPurchases + attributeUpgrades
   - Expandable details showing breakdown
2. **Ending Balance** column (at the end)
   - Shows: balanceEnd for each cycle
   - Color coded: green if positive, red if negative

Updated table structure:
```
| Cycle | Battle Credits | Merchandising | Streaming | Total Income | 
| Repair Costs | Operating Costs | Purchases | Total Expenses | 
| Net Profit | Ending Balance |
```

### 6. Update At-Risk Users Feature

**File**: `prototype/backend/src/routes/admin.ts`

The at-risk users endpoint should now be able to accurately calculate balance history by:
1. Starting with current balance
2. Working backwards through cycles
3. Including ALL transactions: income, expenses, repairs, AND purchases
4. Showing accurate balance at end of each cycle

## Implementation Plan

### Phase 1: Add Event Logging (Priority: HIGH)
1. Add `ROBOT_PURCHASE` and `CYCLE_END_BALANCE` to EventLogger enum
2. Find all purchase locations and add event logging:
   - Weapon shop routes
   - Facility routes  
   - Robot creation routes
   - Attribute upgrade routes
3. Add balance snapshots at cycle end
4. Ensure battle rewards log `CREDIT_CHANGE` events

### Phase 2: Update Cycle Snapshot Service (Priority: HIGH)
1. Modify snapshot calculation to aggregate purchase events
2. Add balance tracking fields
3. Test with existing cycles

### Phase 3: Update Analytics API (Priority: MEDIUM)
1. Modify `/api/analytics/stable/:userId/summary` endpoint
2. Add purchase breakdown to response
3. Add balance fields to response

### Phase 4: Update Frontend (Priority: MEDIUM)
1. Update CycleSummaryPage interface types
2. Add Purchases column to table
3. Add Ending Balance column to table
4. Add expandable purchase details

### Phase 5: Fix At-Risk Users (Priority: LOW)
1. Update calculation to include purchases
2. Verify balance history accuracy
3. Test with multiple users

## Testing Checklist

- [ ] Weapon purchase logs event with correct balance
- [ ] Facility purchase/upgrade logs event with correct balance
- [ ] Robot creation logs event (if applicable)
- [ ] Attribute upgrade logs event with correct balance
- [ ] Cycle end balance is logged
- [ ] Battle rewards log credit_change events
- [ ] Cycle snapshots include all purchase data
- [ ] Analytics API returns purchase breakdown
- [ ] Frontend displays purchases column
- [ ] Frontend displays ending balance column
- [ ] At-risk users shows accurate balance history
- [ ] Balance reconciliation: start + income - expenses - purchases = end

## Success Criteria

1. **Complete Audit Trail**: Every credit transaction is logged
2. **Balance Reconciliation**: Can trace balance changes cycle-by-cycle
3. **Accurate Reporting**: Cycle summary matches audit log data
4. **User Transparency**: Users can see exactly where their credits went

## Notes

- This is a significant enhancement that touches multiple parts of the codebase
- Requires careful testing to ensure no transactions are missed
- May want to add a "reconciliation check" endpoint that verifies balance calculations
- Consider adding a migration script to backfill purchase data from existing database records (if possible)
