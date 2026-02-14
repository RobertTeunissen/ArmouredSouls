# Tag Team Match Winner Determination Fix

## Problem

Tag team matches were incorrectly resulting in draws when one team had a robot with HP remaining. For example, battle 175 showed:
- Team 1's robot: 65 HP remaining
- Team 2's robot: 0 HP
- Result: DRAW (incorrect)

## Root Cause

The winner determination logic in `simulateTagTeamBattle()` was checking if both the active AND reserve robots were at 0 HP to determine if a team was defeated:

```typescript
const team1Defeated = team1ActiveFinalHP <= 0 && team1ReserveFinalHP <= 0;
const team2Defeated = team2ActiveFinalHP <= 0 && team2ReserveFinalHP <= 0;
```

This logic was flawed because:
1. It required BOTH robots on a team to be at 0 HP for the team to lose
2. If a reserve robot was never used, it would still have full HP
3. This meant a team could "lose" (their active robot destroyed) but not be marked as defeated because their unused reserve had full HP

## Solution

Changed the logic to check which robot is CURRENTLY FIGHTING for each team, and determine the winner based on that robot's HP:

```typescript
// Determine which robot is currently fighting for each team
const team1CurrentFighterHP = team1ReserveUsed ? team1ReserveFinalHP : team1ActiveFinalHP;
const team2CurrentFighterHP = team2ReserveUsed ? team2ReserveFinalHP : team2ActiveFinalHP;

// A team is defeated when their currently fighting robot is at 0 HP
const team1Defeated = team1CurrentFighterHP <= 0;
const team2Defeated = team2CurrentFighterHP <= 0;
```

## Additional Changes

1. Added `team1ReserveUsed` and `team2ReserveUsed` boolean fields to the `TagTeamBattleResult` interface to track which robots participated
2. Updated `createTagTeamBattleRecord()` to store the HP of the CURRENTLY FIGHTING robots in the battle record, not just the active robots
3. This ensures the battle record accurately reflects which robot was fighting at the end of the match

## Test Results

All test cases now pass:
- ✓ Battle 175 scenario: Team with reserve robot at 65 HP wins
- ✓ Both reserves fighting: Team with HP remaining wins
- ✓ Both teams defeated: Correctly marked as draw
- ✓ No tag-outs: Team with HP remaining wins

## Files Modified

- `prototype/backend/src/services/tagTeamBattleOrchestrator.ts`
  - Updated `TagTeamBattleResult` interface
  - Fixed winner determination logic in `simulateTagTeamBattle()`
  - Updated `createTagTeamBattleRecord()` to store correct HP values

## Impact

This fix ensures that tag team matches correctly determine winners based on which robots are actually fighting at the end of the battle, not on whether all robots on a team have been defeated.
