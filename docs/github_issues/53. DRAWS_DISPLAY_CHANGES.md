# Draws Display Feature - Visual Changes

**Date**: February 1, 2026  
**Issue**: Display draws in league standings to show complete battle statistics

---

## Problem

HullIntegrity bots in Platinum league were fighting each other frequently, but many matches ended in **draws** because:
- Both robots had weak weapons
- High armor plating made it difficult to deal damage
- Battles hit the time limit without a clear winner

The W-L display didn't show draws, making it look like these robots had fewer battles than they actually did.

---

## Solution

Added a `draws` field to track and display draw results in the W-D-L format.

---

## Visual Changes

### Before (W-L Format)

```
┌────────────────────────────────────────────────────────────────────┐
│ League Standings - Platinum                                         │
├────┬──────────────┬───────────┬─────┬────┬──────┬──────────┬──────┤
│Rank│ Robot        │ Owner     │ ELO │ LP │ W-L  │ Win Rate │  HP  │
├────┼──────────────┼───────────┼─────┼────┼──────┼──────────┼──────┤
│ #1 │ HullBot 1    │ test_hull │1640 │ 45 │71-31 │  69.6%   │ 60%  │
│ #2 │ ShieldBot 3  │ test_sh   │1300 │ 32 │52-50 │  51.0%   │ 70%  │
│ #3 │ HullBot 2    │ test_hull │1630 │ 30 │73-29 │  71.6%   │ 70%  │
└────┴──────────────┴───────────┴─────┴────┴──────┴──────────┴──────┘
```

**Issue**: The W-L column shows `71-31` but doesn't account for draws. If this robot had 102 total battles, the math doesn't add up (71+31=102, but what about draws?)

---

### After (W-D-L Format)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ League Standings - Platinum                                               │
├────┬──────────────┬───────────┬─────┬────┬──────────┬──────────┬──────┤
│Rank│ Robot        │ Owner     │ ELO │ LP │  W-D-L   │ Win Rate │  HP  │
├────┼──────────────┼───────────┼─────┼────┼──────────┼──────────┼──────┤
│ #1 │ HullBot 1    │ test_hull │1640 │ 45 │54 - 3 -11│  52.9%   │ 60%  │
│ #2 │ ShieldBot 3  │ test_sh   │1300 │ 32 │52 - 0 -50│  51.0%   │ 70%  │
│ #3 │ HullBot 2    │ test_hull │1630 │ 30 │60 - 7 - 6│  58.8%   │ 70%  │
└────┴──────────────┴───────────┴─────┴────┴──────────┴──────────┴──────┘
```

**Improvement**: 
- Now shows complete statistics: 54 wins, 3 draws, 11 losses (54+3+11=68 battles)
- HullBot bots fighting each other show draws (e.g., "60 - 7 - 6")
- Clear color coding:
  - **Green** for wins (54)
  - **Yellow** for draws (3)
  - **Red** for losses (11)

---

## Color Scheme

The W-D-L display uses intuitive color coding:

```
┌──────────────────────────┐
│  54  -  3  -  11         │
│  ↑      ↑      ↑          │
│ Green Yellow Red         │
│ (wins) (draws)(losses)   │
└──────────────────────────┘
```

- **Wins (Green)**: `text-green-400` - Success color
- **Draws (Yellow)**: `text-yellow-400` - Neutral/warning color  
- **Losses (Red)**: `text-red-400` - Danger color
- **Separators (Gray)**: `text-gray-500` - Low emphasis

---

## Technical Implementation

### Database Level
```sql
-- New column added to robots table
ALTER TABLE "robots" ADD COLUMN "draws" INTEGER NOT NULL DEFAULT 0;
```

### Backend (Battle Processing)
```typescript
// In battleOrchestrator.ts
await prisma.robot.update({
  where: { id: robot.id },
  data: {
    wins: isWinner ? robot.wins + 1 : robot.wins,
    draws: isDraw ? robot.draws + 1 : robot.draws,  // NEW
    losses: (!isWinner && !isDraw) ? robot.losses + 1 : robot.losses,
    // ...
  },
});
```

### Frontend (Display)
```tsx
// In LeagueStandingsPage.tsx
<td className="px-4 py-3 text-center font-mono">
  <span className="text-green-400">{robot.wins}</span>
  <span className="text-gray-500"> - </span>
  <span className="text-yellow-400">{robot.draws}</span>  {/* NEW */}
  <span className="text-gray-500"> - </span>
  <span className="text-red-400">{robot.losses}</span>
</td>
```

---

## Win Rate Calculation

**Important**: Win rate calculation remains unchanged:
```
Win Rate = (wins / totalBattles) * 100
```

Draws are **not** counted as wins. This is intentional because:
1. A draw is not a victory
2. Win rate should reflect actual wins vs total battles
3. Players can now see the full picture with W-D-L stats

**Example**:
- Wins: 54
- Draws: 3
- Losses: 11
- Total Battles: 68
- Win Rate: 54/68 = 79.4%

---

## Example Scenarios

### Scenario 1: Balanced Robot (Mixed Results)
```
W-D-L: 45 - 5 - 50
Total: 100 battles
Win Rate: 45.0%
```
Shows robot wins almost as much as it loses, with occasional draws.

### Scenario 2: HullIntegrity Bot (Many Draws)
```
W-D-L: 60 - 20 - 22
Total: 102 battles  
Win Rate: 58.8%
```
Shows robot has many draws (20) from fighting similar bots that can't damage each other.

### Scenario 3: Attack-Focused Bot (Few Draws)
```
W-D-L: 75 - 2 - 25
Total: 102 battles
Win Rate: 73.5%
```
Shows robot rarely draws - either wins decisively or loses.

---

## Benefits

1. **Transparency**: Players can see complete battle statistics
2. **Balance Insights**: Reveals when certain builds lead to stalemates
3. **Accurate Representation**: Shows true battle participation (102 cycles = 102 battles including draws)
4. **Strategic Value**: Players can identify when their robots frequently draw (indicating need for more offensive power)

---

## Migration Path

For existing robots:
- Default draws value: 0
- Historical draws are not retroactively calculated (would require re-analyzing all past battles)
- Going forward, all new battles will correctly track draws
- This is acceptable because:
  - Most robots will accumulate new battle stats quickly
  - The feature is primarily for ongoing visibility
  - Retroactive calculation would be complex and not worth the effort

---

## Files Changed

**Backend**:
1. `prototype/backend/prisma/schema.prisma` - Added draws field
2. `prototype/backend/prisma/migrations/20260201144700_add_draws_field/migration.sql` - Database migration
3. `prototype/backend/src/services/battleOrchestrator.ts` - Increment draws counter
4. `prototype/backend/src/routes/leagues.ts` - Include draws in API response

**Frontend**:
1. `prototype/frontend/src/pages/LeagueStandingsPage.tsx` - Display W-D-L format
2. `prototype/frontend/src/pages/RobotDetailPage.tsx` - Updated interface
3. `prototype/frontend/src/utils/matchmakingApi.ts` - Updated LeagueRobot type

---

## Testing Recommendations

To verify the feature works:

1. **Database Level**:
   ```sql
   -- Check robots table has draws column
   SELECT id, name, wins, draws, losses, total_battles FROM robots LIMIT 5;
   ```

2. **Backend Level**:
   ```bash
   # Test league standings API
   curl http://localhost:3001/api/leagues/platinum/standings
   # Response should include "draws" field
   ```

3. **Frontend Level**:
   - Navigate to League Standings page
   - Select any tier (Bronze, Silver, Gold, Platinum, Diamond, Champion)
   - Verify table header shows "W-D-L"
   - Verify each robot shows three numbers with colors: green - yellow - red
   - Verify draws appear for robots with draws > 0

4. **Battle Processing**:
   - Run a matchmaking cycle
   - Execute battles
   - Check that when a battle ends in a draw (winnerId = null):
     - Both robots get draws incremented
     - Neither robot gets wins or losses incremented
     - Both robots get league points for draw (LEAGUE_POINTS_DRAW)

---

## Conclusion

This feature provides complete visibility into robot battle statistics by displaying draws alongside wins and losses. It particularly helps identify situations where robots frequently stalemate (like HullIntegrity bots fighting each other), which was the original problem that prompted this enhancement.
