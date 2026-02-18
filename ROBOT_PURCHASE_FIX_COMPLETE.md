# Robot Purchase Tracking - Fix Complete

## The Problem

Robot creations WERE being logged (as `credit_change` events with `source: 'other'`), but the analytics API wasn't querying for them. It was only looking for:
- `weapon_purchase`
- `facility_purchase`  
- `facility_upgrade`
- `attribute_upgrade`

So robot purchases (₡1,000,000) were missing from the cycle summary.

## The Fix

Updated `prototype/backend/src/routes/analytics.ts` to:

1. **Query robot creation events** separately:
   ```typescript
   const cycle0RobotCreations = await prisma.auditLog.findMany({
     where: {
       cycleNumber: 0,
       userId,
       eventType: 'credit_change',
       payload: {
         path: ['source'],
         equals: 'other'
       }
     },
   });
   ```

2. **Calculate robot purchase costs**:
   ```typescript
   const cycle0RobotPurchases = cycle0RobotCreations
     .reduce((sum, e) => sum + Math.abs(Number((e.payload as any).amount) || 0), 0);
   ```

3. **Include in total purchases**:
   ```typescript
   const purchases = finalWeaponPurchases + finalFacilityPurchases + 
                    finalAttributeUpgrades + finalRobotPurchases;
   ```

4. **Add to breakdown**:
   ```typescript
   breakdown: {
     weaponPurchases: finalWeaponPurchases,
     facilityPurchases: finalFacilityPurchases,
     robotPurchases: finalRobotPurchases,  // NEW
     attributeUpgrades: finalAttributeUpgrades,
   }
   ```

5. **Updated frontend** to show robots in tooltip

## Expected Result

For player2 (userId: 2), Cycle 1 should now show:

**Purchases: ₡2,202,000**

Breakdown (hover tooltip):
- Weapons: ₡752,000
- Facilities: ₡450,000
- Robots: ₡1,000,000 ← NOW INCLUDED!
- Upgrades: ₡0

## To Apply the Fix

1. **Backend is already rebuilt** (`npm run build` completed successfully)

2. **Restart the backend**:
   ```bash
   # Stop current backend (Ctrl+C)
   cd prototype/backend
   npm run dev
   ```

3. **Refresh the frontend** (or rebuild if needed):
   ```bash
   cd prototype/frontend
   npm run build  # if needed
   ```

4. **View the cycle summary**:
   - Go to http://localhost:3000/cycle-summary
   - Log in as player2
   - Should now show ₡2,202,000 in purchases for Cycle 1

## Verification

Run this to verify the data:
```bash
cd prototype/backend
node test_analytics_fix.js
```

Should output:
```
Weapons: ₡752,000
Facilities: ₡450,000
Robots: ₡1,000,000
Attributes: ₡0

TOTAL PURCHASES: ₡2,202,000
```

## What About Attributes?

Attribute upgrades are still ₡0 because player2 didn't upgrade any attributes. If you upgrade attributes and run another cycle, they WILL be logged and show up.

The attribute upgrade logging code is working - it just hasn't been used yet.

## Summary

✅ Robot creation logging - WORKING (was already working)
✅ Analytics API robot query - FIXED (was missing)
✅ Frontend display - UPDATED (now shows robots)
✅ Attribute upgrade logging - WORKING (ready to use)

**After restarting the backend, the cycle summary will show ₡2,202,000 in purchases instead of ₡1,202,000.**
