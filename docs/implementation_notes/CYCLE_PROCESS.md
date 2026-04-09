# Daily Cycle Process

## Overview

The daily cycle is the core game loop that processes all automated game activities. Each cycle represents one "day" in the game world and consists of multiple sequential steps designed to ensure fair gameplay and proper resource management.

## Cycle Flow

### Step 1: Execute League Battles (1v1)
- **Purpose**: Run all scheduled league matches from the previous cycle's matchmaking
- **Process**:
  - Executes all scheduled matches with status='scheduled'
  - Processes combat, updates ELO, awards rewards
  - Records battle history and statistics
  - Updates robot HP based on damage taken
- **Why**: League battles are the core competitive gameplay

### Step 2: Repair All Robots (Post-League)
- **Purpose**: Repair damage from league battles before tag team play
- **Process**:
  - Identifies all robots with HP < maxHP (excluding Bye Robot)
  - Calculates repair costs using attribute-based formula
  - Applies Repair Bay facility discount (5% per level, max 50%)
  - Restores robots to full HP and maxShield
  - **Deducts costs from user currency balances**
- **Why**: Ensures robots damaged in league battles can participate in tag team and KotH

### Step 3: Execute Tag Team Battles (odd cycles only)
- **Purpose**: Run scheduled tag team matches
- **Condition**: Only runs on odd-numbered cycles
- **Process**: Executes all scheduled tag team battles
- **Why**: Tag team battles run on alternating cycles to spread activity

### Step 4: Repair All Robots (Post-Tag-Team)
- **Purpose**: Repair damage from tag team battles
- **Process**: Same as Step 2
- **Why**: Ensures robots are healthy before KotH and tournament phases

### Step 4.5: Execute KotH Battles (Mon/Wed/Fri only)
- **Purpose**: Run scheduled King of the Hill matches
- **Condition**: Only runs on KotH days (Monday, Wednesday, Friday)
- **Bulk cycle simulation**: Uses `simulatedDayOfWeek = ((cycleNumber - 1) % 7) + 1` to determine day (1=Mon through 7=Sun)
- **Process**: Executes all scheduled KotH battles for the current date
- **Why**: KotH is a periodic event with zone-control gameplay

### Step 4.6: Repair All Robots (Post-KotH)
- **Purpose**: Repair damage from KotH battles
- **Condition**: Only runs if KotH battles were executed
- **Process**: Same as Step 2
- **Why**: Ensures robots are healthy before tournament phase

### Step 4.7: KotH Matchmaking (Mon/Wed/Fri only)
- **Purpose**: Schedule KotH matches for the next KotH day
- **Condition**: Only runs on KotH days
- **Process**: Runs KotH matchmaking with a `scheduledFor` date adjusted to the simulated day of week, so the correct zone variant is selected (fixed zone on Mon/Fri, rotating zone on Wed)
- **Why**: Pre-schedules KotH groups for the next event

### Step 5: Tournament Execution / Scheduling
- **Purpose**: Process active tournament rounds and create new tournaments
- **Process**:
  - Gets all active tournaments
  - For each tournament, gets current round matches
  - Auto-completes bye matches (robot1Id set, robot2Id null) before attempting battle execution
  - Executes real matches via `processTournamentBattle`
  - Advances winners to next rounds (with automatic bye detection in later rounds)
  - Marks completed tournaments
  - Auto-creates next tournament if none are active
- **Why**: Tournaments are special events that run independently of league play

### Step 6: Repair All Robots (Post-Tournament)
- **Purpose**: Repair damage from tournament battles before league rebalancing
- **Process**: Same as Step 2
- **Why**: Ensures robots are at full health for next cycle

### Step 7: Rebalance Leagues
- **Purpose**: Promote/demote robots between league tiers
- **Process**:
  - Evaluates robots based on league points and performance
  - Promotes top performers to higher tiers
  - Demotes bottom performers to lower tiers
  - Resets cyclesInCurrentLeague for moved robots
- **Why**: Maintains competitive balance and progression

### Step 7.5: Rebalance Tag Team Leagues (odd cycles only)
- **Purpose**: Promote/demote tag teams between league tiers
- **Condition**: Only runs on odd-numbered cycles (same as tag team battles)
- **Why**: Maintains competitive balance in tag team leagues

### Step 8: Auto Generate New Users
- **Purpose**: Add new AI-controlled players to the ecosystem (optional)
- **Process**:
  - Generates N users per cycle (where N = cycle number)
  - Creates battle-ready robots with random attributes
  - Assigns starting currency and equipment
- **Why**: Keeps the player pool active and competitive
- **Note**: This step is optional and controlled by `generateUsersPerCycle` parameter

### Step 9: Matchmaking for Leagues (1v1)
- **Purpose**: Schedule matches for the next cycle
- **Process**:
  - Builds matchmaking queues per league instance
  - Filters robots by battle readiness (HP ≥ 80% of max)
  - Pairs robots using ELO-based matchmaking algorithm
  - Creates scheduled matches for next cycle
  - Schedules matches 1 second in the future
- **Why**: Pre-scheduling allows players to see upcoming matches and prepare

### Step 9.5: Matchmaking for Tag Teams (odd cycles only)
- **Purpose**: Schedule tag team matches for the next odd cycle
- **Condition**: Only runs on odd-numbered cycles
- **Process**: Runs tag team matchmaking algorithm
- **Why**: Pre-schedules tag team matches

## Post-Cycle Cleanup

After all steps complete:
- Increments `cyclesInCurrentLeague` for all robots
- Updates global cycle metadata (totalCycles, lastCycleAt)
- Records cycle duration and results

## Repair Cost Calculation

### Base Formula (from PRD_ECONOMY_SYSTEM.md)

```
base_repair = (sum_of_all_23_attributes × 100)
damage_percentage = damage_taken / max_hp

// Apply multiplier based on robot condition
if robot_destroyed (HP = 0):
    multiplier = 2.0
elif robot_heavily_damaged (HP < 10%):
    multiplier = 1.5
else:
    multiplier = 1.0

repair_cost_before_discounts = base_repair × damage_percentage × multiplier
```

### Facility Discounts

**Repair Bay** (applies to all repairs):
- Discount: 5% per level (max 50% at level 10)
- Formula: `discount = min(repair_bay_level × 5%, 50%)`

**Medical Bay** (applies only to critical damage, HP = 0):
- Reduces the 2.0x critical damage multiplier
- Formula: `effective_multiplier = 2.0 × (1 - medical_bay_level × 0.1)`
- Level 10: Eliminates critical damage penalty entirely (multiplier becomes 1.0)

### Final Cost Formula

```
final_cost = base_repair × damage_percentage × multiplier × (1 - repair_bay_discount)
```

### Example Calculations

**Example 1: Normal Damage**
- Robot with 230 total attributes
- Took 50% damage (100 HP out of 200 maxHP)
- Current HP: 100 (50% remaining)
- Repair Bay Level 5 (25% discount)

```
base_repair = 230 × 100 = 23,000
damage_percentage = 50%
multiplier = 1.0 (HP > 10%)
repair_bay_discount = 25%

cost_before_discount = 23,000 × 0.50 × 1.0 = 11,500
final_cost = 11,500 × (1 - 0.25) = 8,625 credits
```

**Example 2: Critical Damage**
- Robot with 230 total attributes
- Destroyed (HP = 0)
- Repair Bay Level 5 (25% discount)
- Medical Bay Level 3 (30% reduction to critical multiplier)

```
base_repair = 230 × 100 = 23,000
damage_percentage = 100%
multiplier = 2.0 × (1 - 0.30) = 1.4 (Medical Bay reduces from 2.0)
repair_bay_discount = 25%

cost_before_discount = 23,000 × 1.00 × 1.4 = 32,200
final_cost = 32,200 × (1 - 0.25) = 24,150 credits
```

**Example 3: Heavy Damage**
- Robot with 230 total attributes
- Took 95% damage (190 HP out of 200 maxHP)
- Current HP: 10 (5% remaining, triggers heavy damage multiplier)
- Repair Bay Level 10 (50% discount, max)

```
base_repair = 230 × 100 = 23,000
damage_percentage = 95%
multiplier = 1.5 (HP < 10%)
repair_bay_discount = 50%

cost_before_discount = 23,000 × 0.95 × 1.5 = 32,775
final_cost = 32,775 × (1 - 0.50) = 16,388 credits
```

## Battle Readiness Criteria

For a robot to be included in matchmaking (Step 8):
1. `currentHP ≥ 80% of maxHP`
2. Has a main weapon equipped
3. Not the "Bye Robot"
4. Belongs to an active league instance

## API Endpoint

### POST /api/admin/cycles/bulk

**Request Body:**
```json
{
  "cycles": 1,                      // Number of cycles to run (1-100)
  "includeTournaments": true,       // Enable tournament processing
  "generateUsersPerCycle": false    // Enable auto user generation
}
```

**Response:**
```json
{
  "success": true,
  "cyclesCompleted": 1,
  "totalCyclesInSystem": 42,
  "includeTournaments": true,
  "generateUsersPerCycleEnabled": false,
  "totalDuration": 5234,
  "averageCycleDuration": 5234,
  "results": [
    {
      "cycle": 42,
      "repair1": {
        "robotsRepaired": 15,
        "totalBaseCost": 75000,
        "totalFinalCost": 60000,
        "costsDeducted": true
      },
      "tournaments": {
        "tournamentsExecuted": 1,
        "roundsExecuted": 1,
        "matchesExecuted": 4,
        "tournamentsCompleted": 0,
        "tournamentsCreated": 0
      },
      "repair2": { /* ... */ },
      "battles": {
        "battlesExecuted": 20,
        "totalRewards": 150000
      },
      "rebalancing": {
        "promoted": 3,
        "demoted": 2
      },
      "userGeneration": null,
      "repair3": { /* ... */ },
      "matchmaking": {
        "matchesCreated": 18
      },
      "duration": 5234
    }
  ]
}
```

## Design Rationale

### Why Three Repair Steps?

1. **Pre-Tournament**: Ensures fair tournament competition
2. **Post-Tournament**: Prevents tournament damage from affecting league play
3. **Post-League**: Ensures only healthy robots are matched for next cycle

This may seem excessive, but it's necessary during testing to ensure:
- No robot is excluded from battles due to low HP
- All matches are fair and competitive
- The matchmaking system has maximum participation

### Future Considerations

In production, the repair frequency may be adjusted based on:
- Economic balance (repair costs vs. earnings)
- Player engagement (manual vs. automatic repairs)
- Strategic depth (risk/reward of entering battles damaged)

## Monitoring

Each cycle logs detailed information:
- Step-by-step progress
- Robots repaired and costs
- Battles executed and outcomes
- Matchmaking results
- Errors and warnings

Check server logs for cycle execution details.

## Related Documentation

- [Matchmaking System](../app/backend/src/services/matchmakingService.ts)
- [Battle Orchestrator (League)](../app/backend/src/services/leagueBattleOrchestrator.ts)
- [League Rebalancing](../app/backend/src/services/leagueRebalancingService.ts)
- [Tournament System](./prd_core/PRD_TOURNAMENT_SYSTEM.md)
- [Economy System](./prd_core/PRD_ECONOMY_SYSTEM.md)
