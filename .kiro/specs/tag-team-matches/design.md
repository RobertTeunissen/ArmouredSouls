# Design Document: Tag Team Matches

## Overview

Tag Team Matches extend Armoured Souls' battle system to support 2v2 cooperative gameplay while maintaining the game's core scheduled batch processing model. This feature introduces team formation, cooperative matchmaking, tag-out mechanics, and a separate league structure for team competition.

The design integrates seamlessly with existing systems:
- Uses the same scheduled daily cycle as 1v1 matches
- Leverages existing ELO and league point systems with team-specific calculations
- Reuses battle simulation engine with tag-out event handling
- Extends matchmaking algorithm to handle team pairing
- Integrates with existing UI components for match display and history

Key design principles:
- Minimal disruption to existing 1v1 system
- Separate league progression for tag teams
- Robots can participate in both match types
- Economic balance maintains 2x rewards for 2x robots
- Tag-out mechanics create strategic depth

## Architecture

### System Components

**Tag Team Management Service**
- Handles team creation, validation, and disbanding
- Validates team composition (same stable, battle readiness)
- Manages team roster and active/reserve positions
- Provides team lookup and listing functionality

**Tag Team Matchmaking Service**
- Extends existing matchmaking algorithm for team pairing
- Calculates combined ELO for team matching
- Handles bye-team creation for odd numbers
- Schedules tag team matches every other cycle (odd cycles only)
- Tracks cycle counter to determine when to run

**Tag Team Battle Orchestrator**
- Extends existing battle orchestrator with tag-out logic
- Manages active/reserve robot transitions
- Tracks which robot is currently fighting
- Handles tag-out events (yield or destruction)
- Calculates team-based rewards and ELO changes

**Tag Team League Service**
- Manages separate tag team league structure
- Handles team promotion/demotion
- Maintains tag team league instances (max 50 teams)
- Tracks tag team league points separately from 1v1

**Tag Team UI Components**
- Team creation and management interface
- Tag team standings display
- Match history with tag team indicators
- Battle log visualization with tag events

### Data Flow

```
1. Team Formation
   Player selects 2 robots → Validation → Team created → Stored in database

2. Matchmaking (Every Other Cycle)
   Cycle counter checked → If even cycle, skip tag team matchmaking
   If odd cycle: Eligible teams queried → Combined ELO calculated → Teams paired → Matches scheduled

3. Battle Execution
   Match starts → Active robots fight → Tag-out triggered → Reserve activates → Battle continues → Results calculated

4. Results Processing
   ELO updated (all 4 robots) → League points awarded → Credits distributed → Repair costs calculated → Battle log stored

5. League Rebalancing (Every Other Cycle)
   If odd cycle: Tag team league points evaluated → Top 10% promoted → Bottom 10% demoted → Instances rebalanced
```

### Integration Points

**Database Schema Extensions**
- New TagTeam model for team storage
- New TagTeamMatch model for scheduled matches
- Extended Battle model with tag team fields
- Extended Robot model with tag team statistics

**Existing Services Modified**
- Matchmaking service: Add tag team matchmaking phase
- Battle orchestrator: Add tag-out event handling
- League service: Add tag team league management
- Dashboard service: Include tag team matches in displays

**UI Extensions**
- New tag team management page
- Extended match list components (tag team indicator)
- Extended battle log display (tag events)
- Extended standings page (tag team leagues)

## Components and Interfaces

### TagTeam Model

```typescript
interface TagTeam {
  id: number;
  stableId: number;
  activeRobotId: number;    // Robot that starts the match
  reserveRobotId: number;   // Robot that tags in
  tagTeamLeague: string;    // bronze/silver/gold/platinum/diamond/champion
  tagTeamLeagueId: string;  // Specific instance: bronze_1, bronze_2, etc.
  tagTeamLeaguePoints: number;
  cyclesInTagTeamLeague: number;
  totalTagTeamWins: number;
  totalTagTeamLosses: number;
  totalTagTeamDraws: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### TagTeamMatch Model

```typescript
interface TagTeamMatch {
  id: number;
  team1Id: number;
  team2Id: number;
  tagTeamLeague: string;
  scheduledFor: Date;
  status: 'scheduled' | 'completed' | 'cancelled';
  battleId?: number;
  createdAt: Date;
}
```

### Extended Battle Model

```typescript
interface Battle {
  // ... existing fields ...
  battleType: 'league' | 'tournament' | 'tag_team';
  
  // Tag team specific fields
  team1ActiveRobotId?: number;
  team1ReserveRobotId?: number;
  team2ActiveRobotId?: number;
  team2ReserveRobotId?: number;
  team1TagOutTime?: number;  // Timestamp when team1 tagged out
  team2TagOutTime?: number;  // Timestamp when team2 tagged out
}
```

### Extended Robot Model

```typescript
interface Robot {
  // ... existing fields ...
  
  // Tag team statistics
  totalTagTeamBattles: number;
  totalTagTeamWins: number;
  totalTagTeamLosses: number;
  totalTagTeamDraws: number;
  timesTaggedIn: number;
  timesTaggedOut: number;
}
```

### TagTeamService Interface

```typescript
interface TagTeamService {
  // Team management
  createTeam(stableId: number, activeRobotId: number, reserveRobotId: number): Promise<TagTeam>;
  validateTeam(activeRobotId: number, reserveRobotId: number): Promise<ValidationResult>;
  disbandTeam(teamId: number): Promise<void>;
  getTeamsByStable(stableId: number): Promise<TagTeam[]>;
  getTeamById(teamId: number): Promise<TagTeam | null>;
  
  // Team readiness
  checkTeamReadiness(teamId: number): Promise<ReadinessResult>;
  getEligibleTeams(tagTeamLeague: string, tagTeamLeagueId: string): Promise<TagTeam[]>;
}
```

### TagTeamMatchmakingService Interface

```typescript
interface TagTeamMatchmakingService {
  // Matchmaking
  runMatchmaking(): Promise<MatchmakingResult>;
  pairTeams(teams: TagTeam[]): Promise<TagTeamMatch[]>;
  calculateCombinedELO(team: TagTeam): Promise<number>;
  findOpponent(team: TagTeam, availableTeams: TagTeam[]): Promise<TagTeam | null>;
  createByeTeam(): Promise<TagTeam>;
  
  // Scheduling
  scheduleMatches(matches: TagTeamMatch[]): Promise<void>;
}
```

### TagTeamBattleOrchestrator Interface

```typescript
interface TagTeamBattleOrchestrator {
  // Battle execution
  executeBattle(match: TagTeamMatch): Promise<Battle>;
  simulateCombat(team1: TagTeam, team2: TagTeam): Promise<BattleResult>;
  handleTagOut(battle: Battle, teamNumber: 1 | 2, reason: 'yield' | 'destruction'): Promise<void>;
  activateReserve(battle: Battle, teamNumber: 1 | 2): Promise<void>;
  
  // Results calculation
  calculateELOChanges(battle: Battle): Promise<ELOChanges>;
  calculateRewards(battle: Battle): Promise<Rewards>;
  calculateRepairCosts(battle: Battle): Promise<RepairCosts>;
  updateStatistics(battle: Battle): Promise<void>;
}
```

### TagTeamLeagueService Interface

```typescript
interface TagTeamLeagueService {
  // League management
  rebalanceLeagues(): Promise<RebalanceResult>;
  promoteTeams(league: string): Promise<TagTeam[]>;
  demoteTeams(league: string): Promise<TagTeam[]>;
  balanceInstances(league: string): Promise<void>;
  
  // Standings
  getStandings(league: string, instanceId: string): Promise<TagTeam[]>;
  getTeamRank(teamId: number): Promise<number>;
}
```

## Data Models

### TagTeam Table Schema

```sql
CREATE TABLE tag_teams (
  id SERIAL PRIMARY KEY,
  stable_id INTEGER NOT NULL REFERENCES users(id),
  active_robot_id INTEGER NOT NULL REFERENCES robots(id),
  reserve_robot_id INTEGER NOT NULL REFERENCES robots(id),
  tag_team_league VARCHAR(20) NOT NULL DEFAULT 'bronze',
  tag_team_league_id VARCHAR(30) NOT NULL DEFAULT 'bronze_1',
  tag_team_league_points INTEGER NOT NULL DEFAULT 0,
  cycles_in_tag_team_league INTEGER NOT NULL DEFAULT 0,
  total_tag_team_wins INTEGER NOT NULL DEFAULT 0,
  total_tag_team_losses INTEGER NOT NULL DEFAULT 0,
  total_tag_team_draws INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_team_robots UNIQUE(active_robot_id, reserve_robot_id),
  CONSTRAINT different_robots CHECK(active_robot_id != reserve_robot_id)
);

CREATE INDEX idx_tag_teams_stable ON tag_teams(stable_id);
CREATE INDEX idx_tag_teams_league ON tag_teams(tag_team_league, tag_team_league_id);
CREATE INDEX idx_tag_teams_active_robot ON tag_teams(active_robot_id);
CREATE INDEX idx_tag_teams_reserve_robot ON tag_teams(reserve_robot_id);
```

### TagTeamMatch Table Schema

```sql
CREATE TABLE tag_team_matches (
  id SERIAL PRIMARY KEY,
  team1_id INTEGER NOT NULL REFERENCES tag_teams(id),
  team2_id INTEGER NOT NULL REFERENCES tag_teams(id),
  tag_team_league VARCHAR(20) NOT NULL,
  scheduled_for TIMESTAMP NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  battle_id INTEGER REFERENCES battles(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT different_teams CHECK(team1_id != team2_id)
);

CREATE INDEX idx_tag_team_matches_team1 ON tag_team_matches(team1_id);
CREATE INDEX idx_tag_team_matches_team2 ON tag_team_matches(team2_id);
CREATE INDEX idx_tag_team_matches_scheduled ON tag_team_matches(scheduled_for, status);
CREATE INDEX idx_tag_team_matches_status ON tag_team_matches(status);
```

### Extended Battle Table

```sql
ALTER TABLE battles ADD COLUMN battle_type VARCHAR(20) NOT NULL DEFAULT 'league';
ALTER TABLE battles ADD COLUMN team1_active_robot_id INTEGER REFERENCES robots(id);
ALTER TABLE battles ADD COLUMN team1_reserve_robot_id INTEGER REFERENCES robots(id);
ALTER TABLE battles ADD COLUMN team2_active_robot_id INTEGER REFERENCES robots(id);
ALTER TABLE battles ADD COLUMN team2_reserve_robot_id INTEGER REFERENCES robots(id);
ALTER TABLE battles ADD COLUMN team1_tag_out_time BIGINT;
ALTER TABLE battles ADD COLUMN team2_tag_out_time BIGINT;

CREATE INDEX idx_battles_battle_type ON battles(battle_type);
```

### Extended Robot Table

```sql
ALTER TABLE robots ADD COLUMN total_tag_team_battles INTEGER NOT NULL DEFAULT 0;
ALTER TABLE robots ADD COLUMN total_tag_team_wins INTEGER NOT NULL DEFAULT 0;
ALTER TABLE robots ADD COLUMN total_tag_team_losses INTEGER NOT NULL DEFAULT 0;
ALTER TABLE robots ADD COLUMN total_tag_team_draws INTEGER NOT NULL DEFAULT 0;
ALTER TABLE robots ADD COLUMN times_tagged_in INTEGER NOT NULL DEFAULT 0;
ALTER TABLE robots ADD COLUMN times_tagged_out INTEGER NOT NULL DEFAULT 0;
```

### Bye-Team Configuration

```typescript
const BYE_TEAM_CONFIG = {
  id: -1,
  stableId: -1,
  activeRobotId: -1,  // Bye robot 1
  reserveRobotId: -2, // Bye robot 2
  combinedELO: 2000,
  tagTeamLeague: 'bronze',
  tagTeamLeagueId: 'bronze_1',
  tagTeamLeaguePoints: 0
};

const BYE_ROBOT_1_CONFIG = {
  id: -1,
  elo: 1000,
  // ... minimal stats
};

const BYE_ROBOT_2_CONFIG = {
  id: -2,
  elo: 1000,
  // ... minimal stats
};
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Before writing correctness properties, I need to analyze the acceptance criteria for testability:


### Property 1: Team Creation Validation
*For any* two robots selected for a tag team, if they pass validation, then both robots must be from the same stable AND both must meet battle readiness requirements (HP ≥75%, HP > yield threshold, all weapons equipped).
**Validates: Requirements 1.2, 1.3**

### Property 2: Team Configuration Round Trip
*For any* valid tag team configuration, creating the team and then retrieving it should return the same active robot, reserve robot, and stable ID.
**Validates: Requirements 1.4**

### Property 3: Team Creation Limit
*For any* stable with N robots, the system should allow creating at most floor(N/2) tag teams, and reject attempts to create more.
**Validates: Requirements 1.5**

### Property 4: Combined ELO Calculation
*For any* tag team, the combined ELO should equal the sum of the active robot's ELO and the reserve robot's ELO.
**Validates: Requirements 2.1**

### Property 5: ELO-Based Team Matching
*For any* pair of matched tag teams, the absolute difference in their combined ELOs should be ≤300 (or ≤600 if no ±300 match exists).
**Validates: Requirements 2.2**

### Property 6: Same-Stable Exclusion
*For any* matchmaking result, no tag team match should pair two teams from the same stable.
**Validates: Requirements 2.6**

### Property 7: Recent Opponent Deprioritization
*For any* team with recent match history, opponents from the last 5 matches should have lower match priority scores than opponents not in recent history.
**Validates: Requirements 2.4**

### Property 8: Tag-Out Trigger Conditions
*For any* active robot in a tag team battle, when HP reaches the yield threshold OR drops to 0, a tag-out event must be triggered.
**Validates: Requirements 3.3**

### Property 9: Reserve Robot Initial State
*For any* reserve robot that tags in, the robot should start with HP at 100% of maximum and all weapon cooldowns reset to 0.
**Validates: Requirements 3.5**

### Property 10: Team Defeat Condition
*For any* tag team battle, when both robots on a team have yielded or been destroyed, the opposing team must be declared the winner.
**Validates: Requirements 3.6**

### Property 11: Battle Timeout Draw
*For any* tag team battle, if the battle duration exceeds the maximum time limit, the battle must end in a draw regardless of robot states.
**Validates: Requirements 3.8**

### Property 12: Tag Team Reward Multiplier
*For any* tag team match outcome (win, loss, or draw), the credits awarded should be exactly 2x the standard league match rewards for that tier and outcome type.
**Validates: Requirements 4.1, 4.2, 4.3**

### Property 13: Repair Cost Calculation
*For any* tag team match, both robots should have repair costs calculated based on damage taken, with the stable's Repair Bay discount applied, and destroyed robots should have the 2x destruction multiplier applied.
**Validates: Requirements 4.4, 4.5, 4.6, 4.7**

### Property 14: Four-Robot ELO Updates
*For any* completed tag team match, all four robots (both teams' active and reserve robots) should have ELO changes calculated using the K=32 formula with combined team ELO as the basis.
**Validates: Requirements 5.1, 5.2**

### Property 15: Tag Team League Point Awards
*For any* tag team match outcome, winning teams should receive +3 points per robot, losing teams should receive -1 point per robot (minimum 0), and draws should award +1 point to all four robots.
**Validates: Requirements 5.3, 5.4, 5.5**

### Property 16: League Point Separation
*For any* robot, changes to tag team league points should not affect 1v1 league points, and vice versa.
**Validates: Requirements 5.6**

### Property 17: Shared ELO Rating
*For any* robot, ELO changes from tag team matches should affect the same ELO rating used for 1v1 matches.
**Validates: Requirements 5.7**

### Property 18: New Team Initial Placement
*For any* newly created tag team, the team should be placed in the Bronze tag team league (bronze_1 instance).
**Validates: Requirements 6.2**

### Property 19: League Rebalancing Percentages
*For any* tag team league tier with at least 10 teams, rebalancing should promote the top 10% of eligible teams (≥5 cycles in tier) and demote the bottom 10% of eligible teams (≥5 cycles in tier).
**Validates: Requirements 6.3, 6.4**

### Property 20: Tier Change Resets
*For any* team that is promoted or demoted, both the tag team league points and cycles counter should be reset to 0.
**Validates: Requirements 6.5, 6.6**

### Property 21: League Instance Capacity
*For any* tag team league instance, the number of teams should never exceed 50, and when the 51st team would be added, a new instance should be created.
**Validates: Requirements 6.7, 6.8**

### Property 22: Battle Log Completeness
*For any* completed tag team battle, the battle log should contain all combat events including tag-out events, tag-in events, and combat messages for tag transitions.
**Validates: Requirements 7.1, 7.2, 7.3, 7.6**

### Property 23: Tag Team Readiness Validation
*For any* tag team, the team should be considered ready for battle if and only if both robots have HP ≥75%, HP > yield threshold, and all required weapons equipped.
**Validates: Requirements 8.1, 8.2, 8.3**

### Property 24: Unready Team Exclusion
*For any* matchmaking cycle, teams that fail readiness checks should not appear in the eligible teams list.
**Validates: Requirements 8.4**

### Property 25: Match List Inclusion
*For any* player's upcoming matches and battle history, tag team matches should be included alongside 1v1 matches with appropriate indicators.
**Validates: Requirements 9.4, 9.5**

### Property 26: Team Disbanding
*For any* existing tag team, disbanding the team should remove it from the database and make both robots available for new team formations.
**Validates: Requirements 9.7**

### Property 27: Prestige Award Calculation
*For any* tag team victory, the prestige awarded should be 1.6x the standard individual match prestige for that tier (Bronze: +8, Silver: +16, Gold: +32, Platinum: +48, Diamond: +80, Champion: +120).
**Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6**

### Property 28: Contribution-Based Fame
*For any* robot participating in a tag team match, fame awarded should be proportional to their contribution (damage dealt and survival time).
**Validates: Requirements 10.7**

### Property 29: Tag Team Statistics Tracking
*For any* robot participating in tag team matches, the system should correctly increment tag team-specific statistics (battles, wins, losses, draws, times tagged in, times tagged out).
**Validates: Requirements 10.8**

### Property 30: Multi-Match Scheduling
*For any* robot, the system should allow scheduling both a 1v1 match and a tag team match in the same cycle.
**Validates: Requirements 11.1**

### Property 31: Cumulative Damage Application
*For any* robot scheduled for multiple matches in a cycle, damage from all matches should accumulate, and the robot's HP should reflect the total damage taken.
**Validates: Requirements 11.2**

### Property 32: Dynamic Eligibility After Damage
*For any* robot scheduled for multiple matches, if HP drops below battle readiness after an earlier match, the robot should be excluded from subsequent matches in that cycle.
**Validates: Requirements 11.3**

### Property 33: Match Processing Order
*For any* daily cycle, 1v1 matches should be processed before tag team matches.
**Validates: Requirements 11.4**

### Property 37: Tag Team Cycle Scheduling
*For any* cycle number N, tag team matchmaking should run if and only if N is odd (1, 3, 5, 7, etc.).
**Validates: Requirements 2.7, 2.8**

### Property 34: Separate League Standings
*For any* robot, their 1v1 league standings and tag team league standings should be maintained independently.
**Validates: Requirements 11.6**

### Property 35: Bye-Team Full Rewards
*For any* tag team that defeats the bye-team, the rewards (credits, ELO, league points) should be the same as defeating a real team.
**Validates: Requirements 12.4**

### Property 36: Bye-Team Normal Penalties
*For any* tag team that loses to the bye-team, the penalties (credits, ELO, league points) should be the same as losing to a real team.
**Validates: Requirements 12.5**

## Error Handling

### Team Creation Errors

**Invalid Robot Selection**
- Error: Robots from different stables
- Response: Return validation error with message "Robots must be from the same stable"
- HTTP Status: 400 Bad Request

**Unready Robots**
- Error: One or both robots fail battle readiness checks
- Response: Return validation error listing which readiness checks failed for each robot
- HTTP Status: 400 Bad Request

**Duplicate Team**
- Error: Team with same robot pair already exists
- Response: Return validation error "A team with these robots already exists"
- HTTP Status: 409 Conflict

**Robot Already in Team**
- Error: Robot is already part of another active team
- Response: Return validation error "Robot is already assigned to another team"
- HTTP Status: 409 Conflict

**Roster Limit Exceeded**
- Error: Attempting to create more teams than roster size allows
- Response: Return validation error "Maximum number of teams reached (roster size / 2)"
- HTTP Status: 400 Bad Request

### Matchmaking Errors

**No Eligible Teams**
- Error: No teams meet battle readiness requirements
- Response: Log warning, skip tag team matchmaking for this cycle
- Recovery: Continue with next cycle

**Database Connection Failure**
- Error: Cannot query teams or robots
- Response: Log error, retry up to 3 times with exponential backoff
- Recovery: If retries fail, skip tag team matchmaking and alert admin

**Matchmaking Timeout**
- Error: Matchmaking takes longer than 30 seconds
- Response: Log error, cancel matchmaking for this cycle
- Recovery: Investigate performance issues, continue with next cycle

### Battle Execution Errors

**Missing Robot Data**
- Error: Robot data not found during battle execution
- Response: Log error, cancel battle, mark match as failed
- Recovery: Investigate data integrity, no penalties applied to teams

**Tag-Out Logic Failure**
- Error: Exception during tag-out event processing
- Response: Log error with full stack trace, attempt to continue battle
- Recovery: If unrecoverable, end battle in draw, investigate logs

**Battle Simulation Crash**
- Error: Unhandled exception in battle simulation
- Response: Log error, mark battle as failed, no results recorded
- Recovery: Investigate crash, teams can be rematched in next cycle

**Reward Calculation Error**
- Error: Exception during reward/cost calculation
- Response: Log error, use default values (0 rewards, 0 costs)
- Recovery: Manual review and correction by admin if needed

### League Management Errors

**Rebalancing Failure**
- Error: Exception during promotion/demotion
- Response: Log error, rollback any partial changes
- Recovery: Retry rebalancing in next cycle

**Instance Balancing Failure**
- Error: Cannot balance teams across instances
- Response: Log error, leave teams in current instances
- Recovery: Retry balancing in next cycle

**Data Inconsistency**
- Error: Team league points or cycles counter is negative or invalid
- Response: Log error, reset to 0
- Recovery: Investigate data corruption

### UI/API Errors

**Team Not Found**
- Error: Requested team ID does not exist
- Response: Return 404 Not Found with message "Team not found"

**Unauthorized Access**
- Error: User attempts to access/modify team they don't own
- Response: Return 403 Forbidden with message "You do not own this team"

**Invalid Request Data**
- Error: Malformed request body or missing required fields
- Response: Return 400 Bad Request with detailed validation errors

## Testing Strategy

### Dual Testing Approach

The tag team matches feature will be validated using both unit tests and property-based tests:

**Unit Tests**: Focus on specific examples, edge cases, and error conditions
- Team creation with specific robot configurations
- Tag-out events at exact HP thresholds
- Bye-team match execution
- Error handling scenarios
- UI component rendering

**Property-Based Tests**: Verify universal properties across all inputs
- Team validation rules hold for all robot pairs
- ELO calculations are correct for all team combinations
- Reward multipliers apply correctly for all outcomes
- Battle mechanics work correctly for all robot states
- League rebalancing percentages are accurate for all team counts

### Property-Based Testing Configuration

**Testing Library**: fast-check (for TypeScript/JavaScript)

**Test Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with feature name and property number
- Tag format: `Feature: tag-team-matches, Property N: [property description]`

**Example Property Test**:
```typescript
// Feature: tag-team-matches, Property 4: Combined ELO Calculation
test('combined ELO equals sum of robot ELOs', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 800, max: 2500 }), // robot1 ELO
      fc.integer({ min: 800, max: 2500 }), // robot2 ELO
      (robot1ELO, robot2ELO) => {
        const team = createTeam(robot1ELO, robot2ELO);
        const combinedELO = calculateCombinedELO(team);
        expect(combinedELO).toBe(robot1ELO + robot2ELO);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Unit Test Coverage

**Team Management** (15-20 tests):
- Create team with valid robots
- Reject team with robots from different stables
- Reject team with unready robots
- Reject duplicate teams
- Disband team successfully
- List teams for stable
- Enforce roster limit

**Matchmaking** (20-25 tests):
- Match teams within ±300 ELO
- Fallback to ±600 ELO when needed
- Create bye-team for odd numbers
- Deprioritize recent opponents
- Exclude same-stable matchups
- Handle empty team pool
- Schedule matches correctly

**Battle Execution** (25-30 tests):
- Start battle with active robots
- Trigger tag-out at yield threshold
- Trigger tag-out at 0 HP
- Activate reserve robot correctly
- Declare winner when both robots down
- Handle simultaneous destruction (draw)
- Handle battle timeout (draw)
- Generate complete battle logs

**Rewards and Costs** (15-20 tests):
- Award 2x credits for wins
- Award 2x credits for losses
- Award 2x credits for draws
- Calculate repair costs for both robots
- Apply Repair Bay discount
- Apply 2x destruction multiplier
- Calculate ELO changes for all four robots

**League Management** (15-20 tests):
- Place new teams in Bronze
- Promote top 10% of eligible teams
- Demote bottom 10% of eligible teams
- Reset points and cycles on tier change
- Create new instance at 51 teams
- Balance instances correctly
- Maintain separate 1v1 and tag team standings

**Integration Tests** (5-10 tests):
- Complete daily cycle with tag team matches
- Robot participates in both 1v1 and tag team
- Cumulative damage across multiple matches
- Tag team match appears in UI components
- End-to-end team creation to battle completion

### Test Data Requirements

**Test Robots**:
- 20 test robots with varying ELO (1000-2000)
- 10 robots with different yield thresholds (10%-50%)
- 5 robots with different loadout types
- 5 robots with HP below 75% (unready)
- 5 robots missing weapons (unready)

**Test Teams**:
- 10 valid teams across different ELO ranges
- 5 teams with unready robots
- 5 teams from same stable (for exclusion testing)

**Test Matches**:
- 20 completed tag team battles with various outcomes
- 10 battles with tag-out events
- 5 battles ending in draws
- 5 battles with bye-team

### Performance Targets

**Matchmaking**:
- Process 100 teams in <5 seconds
- Find optimal matches in <2 seconds per team

**Battle Execution**:
- Execute single tag team battle in <1 second
- Process 50 tag team battles in <30 seconds

**API Response Times**:
- Team creation: <200ms
- Team listing: <100ms
- Match scheduling: <500ms
- Battle log retrieval: <200ms

### Monitoring and Metrics

**Key Metrics to Track**:
- Tag team creation rate
- Tag team match completion rate
- Average tag-out time (when do robots typically tag out)
- Bye-team match frequency
- Tag team vs 1v1 participation ratio
- Average combined ELO by league tier
- Tag team league progression rate

**Alerts**:
- Matchmaking failures >5% of cycles
- Battle execution failures >1% of matches
- API error rate >0.5%
- Average response time >500ms
- Database query time >1 second
