# Cycle Process Changes - Summary

## What Changed

The daily cycle process has been completely restructured to ensure all robots are battle-ready at each stage and repair costs are properly managed.

## Old Flow (Deprecated)

1. Generate users (optional)
2. Auto-repair (optional, no costs)
3. Tournament execution
4. Auto-repair (optional, no costs)
5. Matchmaking
6. Execute battles
7. Daily finances (optional)
8. Rebalance leagues

**Problems:**
- Repairs were optional and didn't deduct costs
- Matchmaking happened before battles (wrong order)
- Robots could be excluded from matchmaking due to low HP
- No repair between tournaments and leagues

## New Flow (Current)

1. **Repair All Robots** (costs deducted from user balances)
2. **Tournament Execution / Scheduling**
3. **Repair All Robots** (costs deducted from user balances)
4. **Execute League Battles**
5. **Rebalance Leagues**
6. **Auto Generate New Users** (optional, battle-ready)
7. **Repair All Robots** (costs deducted from user balances)
8. **Matchmaking for Leagues**

**Benefits:**
- All robots start tournaments at full HP (fair competition)
- Tournament damage doesn't affect league battles
- League damage doesn't affect next cycle's matchmaking
- Repair costs are properly tracked and deducted
- Matchmaking happens after battles (correct order)
- Maximum participation in all activities

## Technical Changes

### Backend

**New File:**
- `prototype/backend/src/services/repairService.ts` - Centralized repair logic with proper PRD formula

**Key Implementation Details:**
- Uses the correct repair cost formula from PRD_ECONOMY_SYSTEM.md
- Formula: `base_repair = (sum_of_all_23_attributes × 100)`
- Applies damage multipliers: 2.0x for destroyed (HP=0), 1.5x for heavy damage (HP<10%)
- Supports both Repair Bay (all repairs) and Medical Bay (critical damage only) discounts
- Fetches all robot attributes for accurate cost calculation

**Modified Files:**
- `prototype/backend/src/routes/admin.ts` - Updated cycle flow, removed `autoRepair` and `includeDailyFinances` parameters

**API Changes:**
```typescript
// Old
POST /api/admin/cycles/bulk
{
  cycles: 1,
  autoRepair: false,        // REMOVED
  includeDailyFinances: true, // DEPRECATED
  generateUsersPerCycle: false,
  includeTournaments: true
}

// New
POST /api/admin/cycles/bulk
{
  cycles: 1,
  generateUsersPerCycle: false,
  includeTournaments: true
}
```

**Response Changes:**
```typescript
// Old result structure
{
  cycle: 1,
  userGeneration: {...},
  repairPreTournament: {...},
  tournaments: {...},
  repairPreLeague: {...},
  matchmaking: {...},
  battles: {...},
  finances: {...},
  rebalancing: {...}
}

// New result structure
{
  cycle: 1,
  repair1: {
    robotsRepaired: 15,
    totalBaseCost: 75000,
    totalFinalCost: 60000,
    costsDeducted: true,
    userSummaries: [...]
  },
  tournaments: {...},
  repair2: {...},
  battles: {...},
  rebalancing: {...},
  userGeneration: {...},
  repair3: {...},
  matchmaking: {...}
}
```

### Frontend

**Modified Files:**
- `prototype/frontend/src/pages/AdminPage.tsx` - Updated session log formatting, removed deprecated parameters

**UI Changes:**
- Session log now shows "Step 1", "Step 2", etc. for clarity
- Repair costs are displayed in session log
- Removed auto-repair and daily finances toggles (always enabled)

### Documentation

**New Files:**
- `docs/CYCLE_PROCESS.md` - Detailed cycle flow documentation
- `docs/ADMIN_PANEL_GUIDE.md` - Admin panel user guide
- `docs/CYCLE_CHANGES_SUMMARY.md` - This file

## Migration Guide

### For Developers

1. **Update API calls:**
   - Remove `autoRepair` parameter (repairs always happen)
   - Remove `includeDailyFinances` parameter (deprecated)
   - Repairs now always deduct costs

2. **Update response handling:**
   - Use `repair1`, `repair2`, `repair3` instead of `repairPreTournament`, `repairPreLeague`
   - Check `totalFinalCost` for repair costs
   - `finances` field is deprecated

3. **Import new service:**
   ```typescript
   import { repairAllRobots } from '../services/repairService';
   ```

### For Testers

1. **Monitor user balances:**
   - Repair costs are now deducted automatically
   - Check that users have sufficient funds
   - Watch for bankruptcy scenarios

2. **Verify cycle flow:**
   - All robots should be at full HP before tournaments
   - All robots should be at full HP before league battles
   - Matchmaking should only include healthy robots

3. **Check session logs:**
   - Should show 8 steps per cycle
   - Repair costs should be displayed
   - No errors about missing HP or weapons

## Why Three Repairs?

This may seem excessive, but it's necessary for testing:

1. **Pre-Tournament (Step 1):**
   - Ensures fair tournament competition
   - All participants start at full strength

2. **Post-Tournament (Step 3):**
   - Prevents tournament damage from affecting league play
   - Maintains separation between tournament and league systems

3. **Post-League (Step 7):**
   - Ensures only healthy robots are matched for next cycle
   - Maximizes matchmaking participation

In production, this may be adjusted based on economic balance and strategic depth requirements.

## Testing Checklist

- [ ] Run 1 cycle and verify all 8 steps execute
- [ ] Check that repair costs are deducted from user balances
- [ ] Verify robots are at full HP before tournaments
- [ ] Verify robots are at full HP before league battles
- [ ] Confirm matchmaking only includes battle-ready robots
- [ ] Check session log shows all steps clearly
- [ ] Verify tournament matches are created/executed
- [ ] Verify league matches are scheduled after battles
- [ ] Monitor for any errors in console or logs
- [ ] Check that upcoming matches show both league and tournament

## Rollback Plan

If issues arise, the old cycle logic is preserved in git history. To rollback:

1. Revert `prototype/backend/src/routes/admin.ts`
2. Delete `prototype/backend/src/services/repairService.ts`
3. Revert `prototype/frontend/src/pages/AdminPage.tsx`
4. Restart backend server

## Future Enhancements

- Make repair frequency configurable
- Add repair cost multipliers for testing
- Implement partial repairs (e.g., 50% HP threshold)
- Add repair cost predictions before cycle
- Create repair cost analytics dashboard
- Add user notifications for low balance warnings

## Questions?

See:
- [Cycle Process Documentation](./CYCLE_PROCESS.md)
- [Admin Panel Guide](./ADMIN_PANEL_GUIDE.md)
- [Economy System PRD](./prd_core/PRD_ECONOMY_SYSTEM.md)
