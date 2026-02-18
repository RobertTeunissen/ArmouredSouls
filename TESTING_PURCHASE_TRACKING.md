# Testing Purchase Tracking Implementation

## Quick Test Guide

### Prerequisites
- Backend running on port 3001
- Frontend running on port 3000
- Logged in as admin (username: "admin", password: "admin123")

### Test Steps

#### 1. Backfill Cycle Snapshots (IMPORTANT!)
Since we've added new fields to the cycle snapshots, you need to regenerate them:

1. Open your browser to `http://localhost:3000/admin`
2. Scroll down to the "Cycle Management" section
3. Click "Backfill Cycle Snapshots"
4. Wait for completion message

This will regenerate all cycle snapshots with the new purchase tracking data.

#### 2. View Cycle Summary with Purchases

1. Navigate to `http://localhost:3000/cycle-summary`
2. You should now see:
   - **4 summary cards** at the top:
     - Total Income (green)
     - Total Expenses (red)
     - Total Purchases (orange) ← NEW!
     - Net Profit (green/red)
   
   - **Table with new "Purchases" column** between "Total Expenses" and "Net Profit"
     - Hover over any purchase amount to see breakdown:
       - Weapons: ₡X,XXX
       - Facilities: ₡X,XXX
       - Upgrades: ₡X,XXX

#### 3. Make New Purchases and Test

1. **Buy a weapon:**
   - Go to Weapon Shop
   - Purchase any weapon
   - Note the cost

2. **Upgrade a facility:**
   - Go to Facilities page
   - Upgrade any facility
   - Note the cost

3. **Upgrade robot attributes:**
   - Go to Robots page
   - Select a robot
   - Upgrade any attribute
   - Note the cost

4. **Run a cycle:**
   - Go to Admin panel
   - Click "Run Cycle"
   - Wait for completion

5. **Verify in Cycle Summary:**
   - Go back to Cycle Summary
   - Check the latest cycle
   - Verify the Purchases column shows your purchases
   - Hover to see the breakdown
   - Verify: `Net Profit = Income - Expenses - Purchases`

#### 4. Verify Data Reconciliation

Compare the data between:
- **Cycle Summary page** (`/cycle-summary`)
- **At-Risk Users section** in Admin panel (`/admin`)

The numbers should now reconcile because purchases are tracked!

### Expected Results for player1 (Epic Ride)

After backfilling and viewing Cycle 2:
- **Before:** Showed ₡26,766 income, ₡6,244 expenses, Net Profit +₡20,522
- **After:** Should show purchases column with actual costs (weapons, facilities, upgrades)
- **Net Profit:** Should be adjusted to account for purchases

### Troubleshooting

#### Purchases column shows ₡0
- Make sure you ran the backfill snapshots
- Check that purchases were made during the cycle (not between cycles)
- Verify the backend is running the latest code

#### Hover tooltip doesn't show
- Make sure there are actual purchases (not ₡0)
- Try refreshing the page
- Check browser console for errors

#### Numbers don't match
- Verify all purchases are being logged (check browser network tab)
- Check backend logs for any errors during event logging
- Ensure cycle snapshots were regenerated after code changes

### API Testing

You can also test the API directly:

```bash
# Get cycle summary for player1 (userId: 2)
curl http://localhost:3001/api/analytics/stable/2/summary?lastNCycles=10

# Should return JSON with new fields:
# - totalPurchases
# - cycles[].purchases
# - cycles[].breakdown.weaponPurchases
# - cycles[].breakdown.facilityPurchases
# - cycles[].breakdown.attributeUpgrades
```

### Verification Checklist

- [ ] Backfilled cycle snapshots successfully
- [ ] Cycle Summary page loads without errors
- [ ] Purchases column is visible in the table
- [ ] Total Purchases card shows in summary
- [ ] Hover tooltip shows purchase breakdown
- [ ] Made a weapon purchase and it appears in next cycle
- [ ] Made a facility upgrade and it appears in next cycle
- [ ] Made an attribute upgrade and it appears in next cycle
- [ ] Net Profit calculation is correct: `Income - Expenses - Purchases`
- [ ] Data reconciles between Cycle Summary and At-Risk Users

## Next Steps

Once purchase tracking is verified:

1. **Add Ending Balance Column** - Track balance at end of each cycle
2. **Verify Historical Data** - Check that old cycles now show purchase data
3. **Test Edge Cases** - Multiple purchases in one cycle, no purchases, etc.
4. **Performance Testing** - Ensure snapshot generation is still fast

## Need Help?

If you encounter issues:
1. Check backend logs for errors
2. Check browser console for frontend errors
3. Verify database has audit log entries for purchases
4. Ensure cycle snapshots were regenerated
5. Try a fresh cycle with new purchases
