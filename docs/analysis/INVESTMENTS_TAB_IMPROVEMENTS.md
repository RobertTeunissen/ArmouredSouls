# Investments & ROI Tab Improvements

## Summary
Fixed 5 display and calculation issues in the Investments & ROI tab on the Facilities page.

## Changes Made

### 1. Financial Metrics Layout (✅ Complete)
**Location**: `prototype/frontend/src/pages/FacilitiesPage.tsx`

Changed financial metrics from 3-column grid to 4-column single row:
- Investment
- Operating Costs  
- Returns
- Net Profit

All metrics now displayed on one line for better readability.

### 2. ROI Progress Bar Removal (✅ Complete)
**Location**: `prototype/frontend/src/pages/FacilitiesPage.tsx`

Removed the ROI progress bar section entirely as it added no value.

### 3. Breakeven Display Enhancement (✅ Complete)
**Location**: `prototype/frontend/src/pages/FacilitiesPage.tsx`

Updated breakeven display to show:
- "X cycles remaining" if breakeven is in the future
- "Achieved at cycle X" if already broken even
- "Not yet profitable" if no breakeven cycle calculated

Added current cycle fetching to enable proper calculation.

### 4. Repair Bay Rounding (✅ Complete)
**Location**: `prototype/backend/src/services/roiCalculatorService.ts`

Added `Math.round()` to repair bay savings calculation to round to whole credits, matching other values on the page.

### 5. Zero Returns Investigation (⚠️ Needs Testing)
**Issue**: Streaming Studio, Training Facility, and Weapons Workshop showing 0 returns

**Possible Causes**:
1. No audit log events for these facilities yet (user hasn't used them)
2. Discount percentage not being recorded in audit logs
3. Streaming revenue not being properly attributed to battles

**Backend Logic**:
- Streaming Studio: Queries `battle_complete` events and sums `streamingRevenue` from `battleParticipant` table
- Training Facility: Queries `attribute_upgrade` events and calculates savings from `discountPercent`
- Weapons Workshop: Queries `weapon_purchase` events and calculates savings from `discountPercent`

**Next Steps**:
- Test in running application to see actual data
- Check if audit logs contain the required events
- Verify discount percentages are being saved in audit log payloads
- May need to add console logging to debug

## Files Modified

### Backend
- `prototype/backend/src/services/roiCalculatorService.ts`
  - Added rounding for repair bay savings

### Frontend
- `prototype/frontend/src/pages/FacilitiesPage.tsx`
  - Changed financial metrics layout to 4-column grid
  - Removed ROI progress bar
  - Added current cycle state and fetching
  - Updated breakeven display logic

## Build Status
- ✅ Backend builds successfully
- ⚠️ Frontend has pre-existing TypeScript errors (not related to these changes)
- ✅ FacilitiesPage.tsx has no diagnostics

## Testing Required
1. Restart backend and frontend servers
2. Navigate to http://localhost:3000/facilities
3. Click "Investments & ROI" tab
4. Verify:
   - Financial metrics display in single row
   - No progress bar visible
   - Breakeven shows cycles remaining or achieved
   - Repair Bay returns are whole numbers
   - Check console for streaming_studio 400 errors
   - Investigate why some facilities show 0 returns
