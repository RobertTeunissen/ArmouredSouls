# League Rebalancing Fix - Round-Robin Distribution

**Date**: February 22, 2026  
**Issue**: Instances were stratified by LP (bronze_1 had max 44 LP, bronze_2 max 27 LP, etc.)  
**Fix**: Changed from sequential to round-robin distribution

## Problem

The rebalancing algorithm was sorting robots by LP+ELO and then distributing them sequentially:
- Robots 0-25 → bronze_1 (highest LP: 44-50)
- Robots 26-50 → bronze_2 (medium LP: 20-27)
- Robots 51-75 → bronze_3 (low LP: 10-21)
- Robots 76-100 → bronze_4 (lowest LP: 0-17)

This created stratified instances where bronze_1 had all the high-LP robots and bronze_4 had all the low-LP robots.

## Solution

Changed distribution to round-robin:
- Robot 0 (50 LP) → bronze_1
- Robot 1 (49 LP) → bronze_2
- Robot 2 (48 LP) → bronze_3
- Robot 3 (47 LP) → bronze_4
- Robot 4 (46 LP) → bronze_1 (cycle repeats)

This ensures each instance has a MIX of high, medium, and low LP robots.

## Additional Fix: Simplified Trigger

Removed the deviation-based trigger (>20 from average) because:
- Promotions/demotions naturally keep instances balanced by filling evenly
- Only need to rebalance when an instance exceeds 100 robots
- At that point, all instances are typically near 100, so we split them

## Files Changed

1. **prototype/backend/src/services/leagueInstanceService.ts**
   - Changed `rebalanceInstances()` to use round-robin: `(i % targetInstanceCount) + 1`
   - Removed deviation check from `needsRebalancing` (only checks >100 robots)
   - Added comments explaining round-robin distribution

2. **prototype/backend/src/services/tagTeamLeagueInstanceService.ts**
   - Changed `rebalanceTagTeamInstances()` to use round-robin: `(i % targetInstanceCount) + 1`
   - Removed deviation check from `needsRebalancing` (only checks >50 teams)
   - Added comments explaining round-robin distribution

3. **prototype/backend/src/services/leagueRebalancingService.ts**
   - Updated console log message for clarity

4. **docs/prd_core/PRD_LEAGUE_REBALANCING.md**
   - Updated all references to distribution strategy
   - Added "Distribution Strategy: Round-Robin" section with examples
   - Clarified that rebalancing only triggers when instance >100 robots
   - Explained natural balancing through even placement
   - Updated all user stories and acceptance criteria

## Result

After rebalancing, all instances within a tier will have similar LP distributions:
- bronze_1: 0-50 LP (mixed)
- bronze_2: 0-50 LP (mixed)
- bronze_3: 0-50 LP (mixed)
- bronze_4: 0-50 LP (mixed)

Same applies to silver, gold, platinum, diamond, and champion tiers.

## Testing

Build successful. Tests have foreign key constraint issues unrelated to this change (pre-existing test cleanup issue).
