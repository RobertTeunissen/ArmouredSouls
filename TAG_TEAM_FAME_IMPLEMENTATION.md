# Tag Team Fame Implementation

## Summary
Implemented fame awards for tag team matches based on individual robot contribution (damage dealt and survival time), fulfilling Requirement 10.7.

## Changes Made

### 1. Updated TagTeamBattleResult Interface
Added tracking fields for damage dealt and survival time for each robot:
- `team1ActiveDamageDealt`, `team1ReserveDamageDealt`
- `team2ActiveDamageDealt`, `team2ReserveDamageDealt`
- `team1ActiveSurvivalTime`, `team1ReserveSurvivalTime`
- `team2ActiveSurvivalTime`, `team2ReserveSurvivalTime`

### 2. Enhanced simulateTagTeamBattle Function
Modified to track damage and survival time across all battle phases:
- Phase 1: Active robots fight - tracks damage and time for both active robots
- Phase 2: After tag-out - tracks damage and time for robots in combat
- Phase 3: If second tag-out occurs - continues tracking for reserve robots

The function now accumulates:
- Damage dealt by each robot from `simulateBattle()` results
- Time each robot spent in combat (phase durations)

### 3. Updated calculateTagTeamFame Function
Enhanced the fame calculation to handle reserves that didn't fight:
- **Only winning team robots receive fame** (consistent with 1v1 battles)
- Losers and draws receive 0 fame
- Robots with 0 survival time (didn't fight) get base fame if on winning team
- Robots that fought get contribution-based fame:
  - Base fame by league tier (bronze: 2, silver: 5, gold: 10, platinum: 15, diamond: 25, champion: 40)
  - Damage multiplier: 0.5x to 1.5x based on damage dealt
  - Survival multiplier: 0.5x to 1.5x based on time in battle
  - No winner/loser multiplier (only winners get fame at all)

### 4. Updated Robot Updates (Normal Matches)
Added fame increments to all four robot updates:
- Team 1 active robot: `fame: { increment: team1ActiveFame }`
- Team 1 reserve robot: `fame: { increment: team1ReserveFame }`
- Team 2 active robot: `fame: { increment: team2ActiveFame }`
- Team 2 reserve robot: `fame: { increment: team2ReserveFame }`

### 5. Updated Robot Updates (Bye Matches)
Added fame calculation and increments for bye-match robots:
- Extracts damage and survival time data based on which team is real
- Calculates fame using the same contribution-based formula
- Updates both active and reserve robots with fame awards

### 6. Updated Battle Record
Modified battle record updates to include:
- `robot1FameAwarded`: Total fame for team 1 (active + reserve)
- `robot2FameAwarded`: Total fame for team 2 (active + reserve)
- `robot1DamageDealt`: Total damage dealt by team 1 (active + reserve)
- `robot2DamageDealt`: Total damage dealt by team 2 (active + reserve)
- **Per-robot stats for tag team battles:**
  - `team1ActiveDamageDealt`, `team1ReserveDamageDealt`
  - `team2ActiveDamageDealt`, `team2ReserveDamageDealt`
  - `team1ActiveFameAwarded`, `team1ReserveFameAwarded`
  - `team2ActiveFameAwarded`, `team2ReserveFameAwarded`

### 7. Added Fame Logging
Added console logging to show fame awards:
```
[TagTeamBattles] Fame awarded - Team X: RobotA +15, RobotB +10
```

### 8. Database Schema Update
Added migration `20260214120000_add_per_robot_tag_team_stats` to add per-robot tracking fields to the Battle model.

### 9. Updated Battle Log API
Modified `/api/matches/battles/:id/log` endpoint to provide clean separation between tag team and 1v1 battles:

**For Tag Team Battles:**
- `tagTeam` section contains per-robot details:
  - Each robot includes `damageDealt` and `fameAwarded`
- `team1Summary` and `team2Summary` contain team-level aggregates:
  - `reward`: Credits awarded to stable
  - `prestige`: Prestige awarded to stable
  - `totalDamage`: Combined team damage
  - `totalFame`: Combined team fame (for reference)
- No `robot1`/`robot2` fields (to avoid confusion)

**For 1v1 Battles:**
- `robot1` and `robot2` contain all individual stats
- No `tagTeam` or team summary fields

This clear separation prevents confusion about what stats represent team totals vs individual contributions.

## Fame Calculation Examples

### Example 1: Active Robot Fights Entire Battle (Winner)
- League: Gold (base fame: 10)
- Damage dealt: 150 (multiplier: 1.5x)
- Survival time: 100s / 100s total (multiplier: 1.0x)
- Winner: Yes
- **Fame: 10 × 1.5 × 1.0 = 15**

### Example 2: Reserve Tagged In, Fights Half Battle (Winner)
- League: Gold (base fame: 10)
- Damage dealt: 80 (multiplier: 0.8x)
- Survival time: 50s / 100s total (multiplier: 0.5x)
- Winner: Yes
- **Fame: 10 × 0.8 × 0.5 = 4**

### Example 3: Reserve Never Tagged In (Winner)
- League: Gold (base fame: 10)
- Damage dealt: 0
- Survival time: 0s / 100s total
- Winner: Yes
- **Fame: 10** (base fame only, still part of winning team)

### Example 4: Active Robot Fights, Loses
- League: Gold (base fame: 10)
- Damage dealt: 120 (multiplier: 1.2x)
- Survival time: 100s / 100s total (multiplier: 1.0x)
- Winner: No
- **Fame: 0** (losers get no fame)

### Example 5: Draw
- Any stats
- **Fame: 0** (no fame for draws)

## Requirements Fulfilled

✅ **Requirement 10.7**: "WHEN a robot participates in a tag team match, THE System SHALL award fame based on their individual contribution (damage dealt, survival time)"

- Fame is now calculated based on actual damage dealt and survival time
- **Only winning team robots receive fame** (consistent with 1v1 battles)
- Reserves that don't fight still receive base fame as part of the winning team
- Losers receive 0 fame
- Draws award no fame

## Testing Recommendations

1. Test tag team match with no tag-outs (both reserves get base fame only)
2. Test tag team match with one tag-out (one reserve fights, one doesn't)
3. Test tag team match with both tag-outs (all four robots fight)
4. Test bye-match fame awards
5. Verify fame awards appear in battle records
6. Verify fame accumulates correctly on robot profiles
7. Test draw scenarios (should award 0 fame)
