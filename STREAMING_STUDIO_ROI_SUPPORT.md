# Streaming Studio ROI Support - COMPLETE ✅

## Summary
Added backend support for calculating ROI for Streaming Studio facility.

## Problem
The Investments & ROI tab was missing Streaming Studio and Weapons Workshop from the facility list because:
1. Frontend was requesting ROI data for `streaming_studio`
2. Backend ROI calculator didn't support `streaming_studio`
3. Only 4 facilities were supported: income_generator, repair_bay, training_facility, weapons_workshop

## Solution
Added Streaming Studio support to the backend ROI calculator service.

## Changes Made

### Backend: roiCalculatorService.ts
**File**: `prototype/backend/src/services/roiCalculatorService.ts`

**Added**:
1. New method `calculateStreamingStudioReturns()`:
   - Queries audit logs for `battle_complete` events in the cycle range
   - Extracts battleId from each event
   - Looks up BattleParticipant records for user's robots
   - Sums up `streamingRevenue` from all battles

2. Updated `calculateFacilityROI()`:
   - Added streaming_studio case to returns calculation
   - Calls `calculateStreamingStudioReturns()` for streaming studio

3. Updated `calculateBreakevenCycle()`:
   - Added streaming studio support
   - Queries battle events by cycle
   - Tracks cumulative streaming revenue per cycle
   - Calculates when facility breaks even

### Frontend: FacilitiesPage.tsx
**File**: `prototype/frontend/src/pages/FacilitiesPage.tsx`

**Updated**:
1. `fetchAdvisorData()` - Added `weapons_workshop` to facility types array
2. `getFacilityDisplayName()` - Added `weapons_workshop` display name

## How Streaming Studio ROI Works

### Revenue Calculation
Streaming Studio increases streaming revenue earned per battle:
- Base streaming revenue formula includes studio multiplier
- Each battle awards streaming revenue to participants
- Revenue is stored in `BattleParticipant.streamingRevenue`
- ROI calculator sums all streaming revenue from user's battles

### Data Flow
1. Battle completes → streaming revenue calculated
2. Stored in `BattleParticipant.streamingRevenue`
3. Audit log records `battle_complete` event with battleId
4. ROI calculator queries audit logs by cycle range
5. Looks up streaming revenue for each battle
6. Sums total revenue since facility purchase

### ROI Metrics
- **Investment**: Total upgrade costs
- **Returns**: Sum of all streaming revenue from battles
- **Operating Costs**: Daily maintenance costs
- **Net ROI**: (Returns - Operating Costs - Investment) / Investment
- **Breakeven**: Cycle when cumulative returns >= investment + operating costs

## Supported Facilities (Economy & Discounts)
Now all 5 facilities are supported:
1. ✅ Income Generator (passive income)
2. ✅ Streaming Studio (battle streaming revenue)
3. ✅ Repair Bay (repair cost savings)
4. ✅ Training Facility (training cost savings)
5. ✅ Weapons Workshop (weapon purchase savings)

## Technical Details

### Why Battle Data is Complex
- Battle model doesn't have `cycleNumber` field
- Cycle information is in audit logs
- Must query audit logs first, then look up battle participants
- Streaming revenue is per-participant, not per-battle

### Performance Considerations
- Queries audit logs filtered by userId and cycle range
- For each battle event, queries one BattleParticipant record
- Could be optimized with batch queries if needed
- Current implementation is acceptable for typical usage

## Status: COMPLETE ✅
Streaming Studio now appears in Investments & ROI tab with full ROI tracking. Backend builds successfully.
