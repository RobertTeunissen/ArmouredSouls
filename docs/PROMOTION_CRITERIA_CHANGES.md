# League Promotion Criteria Changes

**Date**: February 18, 2026  
**Status**: ✅ IMPLEMENTED

## Summary

Updated league promotion eligibility from a percentage-only system to a dual-criteria system requiring BOTH top 10% ranking AND ≥25 league points. This change slows league progression and levels the playing field between single-robot and multi-robot strategies.

## Changes Made

### Promotion Criteria (NEW)

**Previous System:**
- Top 10% of robots/teams in league
- Minimum 5 cycles in current league

**New System:**
- Top 10% of robots/teams in league AND
- ≥25 league points AND
- Minimum 5 cycles in current league

### Rationale

1. **Slower Progression**: Requiring 25 league points means at least 9 cycles are needed for promotion (with perfect wins: 9 cycles × 3 points = 27 points). With 1-2 losses, 10-11 cycles is more likely.

2. **Levels Playing Field**: Since prestige progression is tied to league advancement, slower promotion dampens the effects of prestige on single-robot strategies, making multi-robot strategies more competitive.

3. **More Meaningful Advancement**: Robots must demonstrate both consistent performance (top 10%) and accumulated success (25+ points) to advance.

### Demotion Criteria (UNCHANGED)

- Bottom 10% of robots/teams in league
- Minimum 5 cycles in current league

## Files Modified

### Code Changes

1. **prototype/backend/src/services/leagueRebalancingService.ts**
   - Added `MIN_LEAGUE_POINTS_FOR_PROMOTION = 25` constant
   - Updated `determinePromotions()` to filter by ≥25 league points before selecting top 10%

2. **prototype/backend/src/services/tagTeamLeagueRebalancingService.ts**
   - Added `MIN_LEAGUE_POINTS_FOR_PROMOTION = 25` constant
   - Updated `determinePromotions()` to filter by ≥25 league points before selecting top 10%

### Test Updates

3. **prototype/backend/tests/leagueRebalancingService.test.ts**
   - Updated test data to use appropriate league point values
   - Added new test case for robots without ≥25 league points
   - Updated assertions to verify both criteria

4. **prototype/backend/tests/tagTeamLeagueRebalancing.test.ts**
   - Updated test data to use appropriate league point values
   - Added new test case for teams without ≥25 league points
   - Updated assertions to verify both criteria

5. **prototype/backend/tests/integration/tagTeamLeagueRebalancing.test.ts**
   - Updated comments to reflect new dual criteria

### Documentation Updates

6. **docs/prd_core/PRD_MATCHMAKING.md**
   - Updated promotion threshold specifications
   - Updated tuning parameters section
   - Updated all references to promotion criteria throughout document

7. **docs/ROADMAP.md**
   - Updated automated promotion/demotion description

8. **docs/design_ux/DESIGN_SYSTEM_AND_UX_GUIDE.md**
   - Updated promotion zone description
   - Updated league progression explanation

9. **.kiro/specs/tag-team-matches/requirements.md**
   - Updated Requirement 6.3 to include ≥25 league points

10. **.kiro/specs/tag-team-matches/design.md**
    - Updated league rebalancing flow diagram
    - Updated Property 19 specification
    - Updated league management test descriptions

11. **.kiro/specs/tag-team-matches/tasks.md**
    - Updated task 10.3 description

## Impact Analysis

### Minimum Cycles for Promotion

With the new system:
- **Perfect record** (all wins): 9 cycles minimum (9 × 3 = 27 points)
- **One loss**: 10 cycles (8 wins + 1 loss = 24 - 1 = 23, need 1 more cycle)
- **Two losses**: 11 cycles (9 wins + 2 losses = 27 - 2 = 25 points)
- **Typical scenario** (60% win rate): 12-15 cycles

### Comparison to Previous System

**Previous**: Could promote in 5 cycles if in top 10%  
**New**: Requires 9-11+ cycles even if consistently in top 10%

This represents a **80-120% increase** in minimum time to promotion, significantly slowing league progression as intended.

## Testing

All tests have been updated to reflect the new criteria:
- Unit tests for `determinePromotions()` in both services
- Integration tests for full rebalancing workflow
- Edge case tests for boundary conditions

Run tests with:
```bash
cd prototype/backend
npm test -- leagueRebalancingService.test.ts
npm test -- tagTeamLeagueRebalancing.test.ts
npm test -- integration/tagTeamLeagueRebalancing.test.ts
```

## Configuration

To adjust promotion speed in the future, modify these constants in the service files:

```typescript
// Make progression faster
MIN_LEAGUE_POINTS_FOR_PROMOTION = 20  // Reduce points needed
PROMOTION_PERCENTAGE = 0.15           // Increase percentage

// Make progression slower
MIN_LEAGUE_POINTS_FOR_PROMOTION = 30  // Increase points needed
PROMOTION_PERCENTAGE = 0.05           // Decrease percentage
```

## Related Documents

- [PRD: Matchmaking System](prd_core/PRD_MATCHMAKING.md)
- [Tag Team Matches Requirements](.kiro/specs/tag-team-matches/requirements.md)
- [Tag Team Matches Design](.kiro/specs/tag-team-matches/design.md)
- [Player Archetypes Guide](PLAYER_ARCHETYPES_GUIDE.md)
