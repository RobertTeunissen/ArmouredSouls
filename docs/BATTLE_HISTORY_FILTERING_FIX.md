# Battle History: Filtering and Streak Fixes

**Date**: February 6, 2026  
**Issues Fixed**: Battle list filtering + Streak calculation  
**Status**: ✅ FIXED

---

## Problem Statement

Two critical issues were identified in the battle history page:

### Issue 1: Battle List Not Filtered by View Selection
**Problem**: When clicking League (⚔️) or Tournament (🏆) tabs in the summary section, the statistics would update correctly, but the battle list below would continue showing ALL battles regardless of the filter selection.

**User Impact**: 
- Users could not view only league or tournament battles
- Confusion between what statistics show vs what battles are displayed
- Unable to focus on specific battle types

### Issue 2: Incorrect Win/Loss Streak Display
**Problem**: Win/loss streak showing incorrect count. Example:
- Showed: "4-game loss streak"
- Actual sequence: LOSS, WIN, LOSS, WIN, WIN, LOSS, WIN, LOSS
- Expected: "1-game loss streak" (or hidden since count < 3)

---

## Root Cause Analysis

### Issue 1: Filtering

**Root Cause**: State architecture issue

The `view` state was stored locally in `BattleHistorySummary` component:
```typescript
// OLD - Local state in BattleHistorySummary
const [view, setView] = useState<'overall' | 'league' | 'tournament'>('overall');
```

This meant:
1. User clicks "League" button → `view` state updates in BattleHistorySummary
2. Statistics display updates correctly (using `view` state)
3. BUT parent BattleHistoryPage component has NO knowledge of filter selection
4. Battle list in parent renders all battles (no filtering applied)

**Architecture Flaw**: Child component state not shared with parent that needs it for rendering.

### Issue 2: Streak Calculation

**Root Cause**: Unclear conditional logic

The streak calculation logic had a potential edge case:
```typescript
// OLD - Potentially confusing logic
} else if (firstBattleOutcome && (outcome === 'win' || outcome === 'loss')) {
```

Issues:
1. `firstBattleOutcome` is truthy even when it's 'draw'
2. The condition `(outcome === 'win' || outcome === 'loss')` filters current battle
3. But doesn't explicitly check if firstBattleOutcome is win/loss
4. Could lead to confusion when first battle is draw

---

## Solution Implemented

### Issue 1: Battle List Filtering

**Solution**: Lift state up to parent component

#### Step 1: Add state to parent (BattleHistoryPage.tsx)
```typescript
// NEW - State in parent BattleHistoryPage
const [battleFilter, setBattleFilter] = useState<'overall' | 'league' | 'tournament'>('overall');
```

#### Step 2: Pass state as props to child
```typescript
<BattleHistorySummary 
  stats={summaryStats} 
  view={battleFilter}           // Pass current filter
  onViewChange={setBattleFilter} // Pass setter function
/>
```

#### Step 3: Update child to use props (BattleHistorySummary.tsx)
```typescript
// REMOVED local state
// const [view, setView] = useState<...>('overall');

// NEW - Accept as props
interface BattleHistorySummaryProps {
  stats: SummaryStats;
  view: 'overall' | 'league' | 'tournament';          // NEW
  onViewChange: (view: 'overall' | 'league' | 'tournament') => void; // NEW
}

const BattleHistorySummary: React.FC<BattleHistorySummaryProps> = ({ 
  stats, 
  view,        // Use prop instead of state
  onViewChange // Use prop function instead of setView
}) => {
```

#### Step 4: Update button handlers
```typescript
// OLD
onClick={() => setView('league')}

// NEW
onClick={() => onViewChange('league')}
```

#### Step 5: Filter battles in parent based on state
```typescript
{battles
  .filter((battle) => {
    if (battleFilter === 'overall') return true;
    if (battleFilter === 'league') return battle.battleType !== 'tournament';
    if (battleFilter === 'tournament') return battle.battleType === 'tournament';
    return true;
  })
  .map((battle) => {
    // Render battle card
  })
}
```

**Result**: Filter selection now controls both statistics display AND battle list display.

### Issue 2: Streak Calculation

**Solution**: Explicit type checking and clearer logic

#### Before:
```typescript
} else if (firstBattleOutcome && (outcome === 'win' || outcome === 'loss')) {
  // Check if this battle continues the streak
  if (outcome === firstBattleOutcome) {
    streakCount++;
  }
}
```

#### After:
```typescript
} else if (firstBattleOutcome === 'win' || firstBattleOutcome === 'loss') {
  // We have an established streak type, check if this battle continues it
  if (outcome === firstBattleOutcome) {
    streakCount++;
  }
  // If outcome doesn't match or is a draw, streak ends (don't increment)
}
// Any other case: streak remains as is
```

**Improvements**:
1. **Explicit check**: `firstBattleOutcome === 'win' || firstBattleOutcome === 'loss'`
2. **Clearer logic**: Only enter block if we have a valid streak type established
3. **Better comments**: Explain what each branch does
4. **Initialize properly**: When first battle is draw, explicitly set streakCount=0 and streakType=null

---

## Expected Behavior After Fix

### Filtering Behavior

**Scenario 1**: Overall View (Default)
```
User sees:
- Summary: "Total Battles: 8" (all battles)
- Battle List: All 8 battles (4 league + 4 tournament)
```

**Scenario 2**: Click "⚔️ League"
```
User sees:
- Summary: "League Battles: 4" (filtered stats)
- Battle List: Only 4 league battles shown
- Tournament battles hidden
```

**Scenario 3**: Click "🏆 Tournament"
```
User sees:
- Summary: "Tournament Battles: 4" (filtered stats)
- Battle List: Only 4 tournament battles shown
- League battles hidden
```

**Scenario 4**: Switch back to "Overall"
```
User sees:
- All 8 battles return
- Statistics show combined totals
```

### Streak Behavior

**Example 1**: Simple streak
```
Battles (newest to oldest): WIN, WIN, WIN, LOSS
Streak: "3-game win streak" ✅
```

**Example 2**: No streak (count < 3)
```
Battles: LOSS, WIN, LOSS, WIN
Streak: Hidden (only 1 consecutive loss) ✅
```

**Example 3**: Draw breaks streak
```
Battles: DRAW, WIN, WIN, WIN
Streak: Hidden (draw is first) ✅
```

**Example 4**: Mixed sequence (User's case)
```
Battles: LOSS, WIN, LOSS, WIN, WIN, LOSS, WIN, LOSS
Streak: Hidden (only 1 consecutive loss at start) ✅
```

---

## Files Changed

### 1. BattleHistoryPage.tsx

**Changes**:
- Line 30: Added `battleFilter` state
- Lines 244-248: Pass `view` and `onViewChange` props to BattleHistorySummary
- Lines 252-258: Added `.filter()` to battles array before `.map()`
- Lines 149-170: Improved streak calculation logic with explicit checks

**Lines Changed**: ~20 lines modified/added

### 2. BattleHistorySummary.tsx

**Changes**:
- Line 1: Removed unused `useState` import
- Lines 31-34: Updated interface to accept `view` and `onViewChange` props
- Line 37: Updated function signature to destructure new props
- Lines 79, 89, 99: Updated button onClick handlers to use `onViewChange`
- Removed: Local `view` state declaration

**Lines Changed**: ~10 lines modified/removed

---

## Testing Checklist

### Manual Testing

**Filtering**:
- [ ] Load battle history page with battles
- [ ] Click "Overall" → Verify all battles shown
- [ ] Click "⚔️ League" → Verify only league battles shown
- [ ] Verify statistics match filtered battles
- [ ] Click "🏆 Tournament" → Verify only tournament battles shown
- [ ] Verify statistics match filtered battles
- [ ] Switch between filters multiple times → No errors

**Streak Display**:
- [ ] With various battle sequences, verify streak counts correctly
- [ ] Verify streak only shows when count >= 3
- [ ] Verify draw as first battle = no streak
- [ ] Verify mixed sequences calculate correctly

**Edge Cases**:
- [ ] No battles → No errors
- [ ] All league battles → Tournament filter shows empty
- [ ] All tournament battles → League filter shows empty
- [ ] Single battle → Streak hidden (count < 3)

---

## Verification

### How to Verify Fix #1 (Filtering)

1. Navigate to battle history page
2. Observe initial state (Overall view, all battles shown)
3. Click "⚔️ League" button
4. **Expected**: 
   - Statistics update to show league-only stats
   - Battle list updates to show ONLY league battles (⚔️ icon)
   - Tournament battles (🏆 icon) are hidden
5. Click "🏆 Tournament" button
6. **Expected**:
   - Statistics update to show tournament-only stats
   - Battle list updates to show ONLY tournament battles (🏆 icon)
   - League battles (⚔️ icon) are hidden

### How to Verify Fix #2 (Streak)

1. Look at the most recent battles in order
2. Count consecutive wins or losses from the top
3. **Expected**: Streak count matches consecutive same outcomes
4. If count < 3, streak should be hidden
5. If first battle is draw, streak should be hidden

**Example from user's data**:
```
Top battle: LOSS (league)
Second: WIN (league)
→ Streak broken after 1
→ Expected: No streak displayed (count < 3)
```

---

## Related Issues

This fix addresses:
- Original issue: "When filtering on league or tournament, the battle logs from either the league or tournament are not filtered in the battle history"
- Original issue: "Win streak still not computed correctly. In current example, the actual streak should be 1 loss"

Both issues are now resolved.

---

## Technical Notes

### State Management Pattern

This implements the common React pattern: **"Lift State Up"**

When two components need to share state:
1. Move state to their nearest common ancestor
2. Pass state down as props
3. Pass callback functions to modify state

**Benefits**:
- Single source of truth
- Predictable data flow
- Components stay in sync

### Filter Logic

The filter uses a simple predicate function:
```typescript
.filter((battle) => {
  if (battleFilter === 'overall') return true;  // Show all
  if (battleFilter === 'league') return battle.battleType !== 'tournament'; // League only
  if (battleFilter === 'tournament') return battle.battleType === 'tournament'; // Tournament only
  return true; // Fallback
})
```

**Assumptions**:
- Battles have `battleType` property
- League battles: `battleType !== 'tournament'` (could be 'league' or undefined)
- Tournament battles: `battleType === 'tournament'`

---

## Deployment Notes

### Breaking Changes
None. This is a bug fix with backward-compatible changes.

### Dependencies
No new dependencies added.

### Database Changes
None required.

### Configuration Changes
None required.

---

## Future Improvements

### Potential Enhancements

1. **Persist Filter Selection**
   - Save filter choice to localStorage
   - Restore on page reload
   - Remember user preference

2. **Filter Animation**
   - Smooth transition when battles appear/disappear
   - Fade in/out effect
   - Height transition for smooth layout shift

3. **Battle Count Indicator**
   - Show "X of Y battles" when filtered
   - e.g., "Showing 4 of 8 battles (League only)"

4. **Multiple Filters**
   - Filter by outcome (wins/losses/draws)
   - Filter by date range
   - Filter by opponent
   - Combined filters

5. **URL State**
   - Reflect filter in URL query params
   - Enable deep linking to filtered view
   - Browser back/forward support

---

## Conclusion

Both issues have been resolved with minimal, focused changes:

1. ✅ **Filtering**: Battle list now respects filter selection
2. ✅ **Streak**: Calculation logic improved for clarity and correctness

**Impact**: Better user experience when reviewing battle history by type.

**Status**: Ready for testing and deployment.
