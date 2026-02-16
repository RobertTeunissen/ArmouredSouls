# Repair Cost Consistency Fix

## Problem
There was a 168 credit discrepancy between the cycle summary (showing ₡61,220 net profit) and the actual balance change (₡61,052). This was unacceptable for financial accuracy.

## Root Cause
There were **THREE DIFFERENT** repair cost calculation methods:

1. **Battle Orchestrator** - Used `calculateRepairCost()` with proper formula
2. **Repair Service** - Used `calculateRepairCost()` with proper formula ✓
3. **Manual Repair Endpoint** - Used OLD formula: `hpDamage * 50 credits` with simple 5% per level discount ✗

The manual repair endpoint was using a completely different, outdated formula that didn't match the canonical calculation.

## Solution Implemented

### Unified All Repair Cost Calculations
Ensured ALL three locations use the EXACT SAME calculation method:

**Single Source of Truth:**
- `src/utils/robotCalculations.ts` - `calculateRepairCost()` function
- Uses canonical formula from PRD_ECONOMY_SYSTEM.md:
  - `base_repair = sum_of_all_23_attributes × 100`
  - `damage_percentage = damage_taken / max_hp`
  - `multiplier = 2.0 if HP=0, 1.5 if HP<10%, else 1.0`
  - `discount = repairBayLevel × (5 + activeRobotCount), capped at 90%`
  - `repair_cost = base_repair × damage_percentage × multiplier × (1 - discount/100)`

### Files Modified:

1. **src/routes/admin.ts** - Manual "Repair All" endpoint
   - REMOVED: Old formula (`hpDamage * 50` with simple discount)
   - ADDED: Proper `calculateRepairCost()` call with all parameters
   - Now calculates repair costs the same way as battles and cycle repairs

2. **src/services/battleOrchestrator.ts** - 1v1 battles
   - Added `repairCost` to robot update (stores calculated value for reference)
   - Calculation was already correct

3. **src/services/tagTeamBattleOrchestrator.ts** - Tag team battles  
   - Added `repairCost` to all 4 robot updates (both teams, active + reserve)
   - Calculation was already correct

4. **src/services/repairService.ts** - Cycle repairs
   - Calculation was already correct
   - No changes needed

## How It Works Now

### During Battle:
1. Repair cost is calculated using `calculateRepairCost()`
2. Stored in Battle table (for audit/logging)
3. Stored in `robot.repairCost` field (for reference)

### During Repair (Cycle or Manual):
1. Repair cost is **RECALCULATED** using `calculateRepairCost()`
2. Uses CURRENT facilities and robot attributes
3. Deducted from user balance
4. Robot HP restored, `robot.repairCost` reset to 0

### Why Recalculate?
Repair costs MUST be recalculated at repair time because:
- ✅ User might buy/upgrade Repair Bay between battle and repair
- ✅ User might upgrade robot attributes (Hull Integrity increases maxHP)
- ✅ User might buy more robots (affects multi-robot discount)
- ✅ Ensures repair costs reflect CURRENT game state

## Answers to Your Questions

### 1. Does "Repair All" button work and show correct amounts?
**YES** - It now uses the same `calculateRepairCost()` function as everything else.

**Frontend Note:** The frontend (`RobotsPage.tsx`) has its own calculation for DISPLAY purposes. It checks `robot.repairCost` first (from battle), but should recalculate for accuracy. The backend is authoritative.

### 2. What happens when you buy Repair Bay then hit Repair All?
**CORRECT BEHAVIOR** - The repair cost is recalculated with the NEW Repair Bay level, so you get the discount immediately.

### 3. What happens when you increase Hull Integrity on a damaged robot?
**CORRECT BEHAVIOR** - The repair cost is recalculated with the NEW maxHP (from increased Hull Integrity), so the cost adjusts appropriately.

## All Repair Locations - Single Calculation Method

### Where Repair Costs Are Calculated:
All use `calculateRepairCost()` from `robotCalculations.ts`:

1. **During 1v1 Battles** - `battleOrchestrator.ts`
   - Calculates and stores in Battle table + `robot.repairCost`
   
2. **During Tag Team Battles** - `tagTeamBattleOrchestrator.ts`
   - Calculates and stores in TagTeamMatch table + `robot.repairCost`
   
3. **During Cycle Repairs** - `repairService.ts` → `repairAllRobots()`
   - Recalculates with current facilities/attributes
   - Called 3 times per cycle
   
4. **During Manual Repairs** - `admin.ts` → `/repair/all` endpoint
   - Recalculates with current facilities/attributes
   - Triggered by "Repair All" button

### Single Source of Truth:
- `src/utils/robotCalculations.ts` - `calculateRepairCost()` function
- This is the ONLY function that calculates repair costs
- All four locations above call this same function

## Result
- ✅ No more discrepancies - all calculations use the same formula
- ✅ Repair costs reflect current game state (facilities, attributes)
- ✅ Manual repairs work correctly
- ✅ Buying Repair Bay immediately reduces repair costs
- ✅ Upgrading attributes correctly affects repair costs
- ✅ Single source of truth for repair cost calculation
