# Battle League Display Fix

## Issue
Battle history was displaying the robot's **current league** instead of the league the battle was actually fought in. This made reward amounts appear inconsistent when they were actually correct.

## Root Cause
- Battle records store `leagueType` (the league at time of battle)
- API was returning `robot.currentLeague` (robot's current league)
- Frontend was displaying the current league, not the historical league

## Solution
Updated the battle history system to display the actual league each battle was fought in:

### Backend Changes
**File: `prototype/backend/src/routes/matches.ts`**
- Added `leagueType: battle.leagueType` to the battle history response
- This field contains the league tier at the time the battle occurred

### Frontend Changes
**File: `prototype/frontend/src/utils/matchmakingApi.ts`**
- Added `leagueType?: string` to the `BattleHistory` interface
- Documents that this is the league at time of battle

**File: `prototype/frontend/src/components/CompactBattleCard.tsx`**
- Updated `getBattleTypeText()` to use `battle.leagueType` instead of `myRobot.currentLeague`
- Now displays the correct league for both tag team and regular league matches

## Impact
- Battle history now accurately shows which league each battle was fought in
- Reward amounts now make sense relative to the displayed league
- No changes to reward calculation (it was already correct)

## Example
Before: All battles showed "Gold Tag Team" but had varying rewards (€72k, €36k, €18k)
After: Battles correctly show "Gold Tag Team" (€72k), "Silver Tag Team" (€36k), "Bronze Tag Team" (€18k)
