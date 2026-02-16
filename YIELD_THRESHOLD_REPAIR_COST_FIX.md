# Yield Threshold Repair Cost Fix

## Problem
The Yield Threshold slider on the Battle Config tab (`/robots/:id?tab=battle-config`) was showing incorrect repair cost projections because it used the OLD discount formula.

## Old Formula (Incorrect)
```typescript
discount = repairBayLevel × 5%, capped at 50%
```

## New Formula (Correct)
```typescript
discount = repairBayLevel × (5 + activeRobotCount), capped at 90%
```

## Changes Made

### 1. RobotDetailPage.tsx
- Added `repairBayLevel` state
- Added `activeRobotCount` state
- Fetch repair bay level from facilities API
- Fetch active robot count from robots API
- Pass both values to BattleConfigTab

### 2. BattleConfigTab.tsx
- Added `repairBayLevel` prop
- Added `activeRobotCount` prop
- Pass both values to YieldThresholdSlider

### 3. YieldThresholdSlider.tsx
- Added `activeRobotCount` prop
- Updated `calculateRepairCost()` to use new formula:
  - `discount = Math.min(repairBayLevel * (5 + activeRobotCount), 90)`
- Updated discount display text to show:
  - "Repair Bay Level X: Y% discount (Z robots)"

## Result
The repair cost scenarios now match the actual repair costs that will be charged:
- ✅ Uses same formula as backend (`calculateRepairCost` in `robotCalculations.ts`)
- ✅ Accounts for number of robots owned (multi-robot discount)
- ✅ Shows correct discount percentage
- ✅ Projections match reality

## Example
With Repair Bay Level 1 and 1 robot:
- Old formula: 5% discount
- New formula: 1 × (5 + 1) = 6% discount

With Repair Bay Level 1 and 5 robots:
- Old formula: 5% discount
- New formula: 1 × (5 + 5) = 10% discount

With Repair Bay Level 5 and 10 robots:
- Old formula: 25% discount (5 × 5%)
- New formula: 75% discount (5 × (5 + 10))

## Note on Medical Bay
Medical Bay effects are not yet implemented, so they are not included in the calculation (as requested).
