# GitHub Issues: Matchmaking System Implementation

**Instructions**: Copy each issue below and create it in GitHub. Issues should be completed in order due to dependencies.

**Total Estimate**: 87 hours across 11 phases  
**Reference Documents**:
- [PRD_MATCHMAKING.md](PRD_MATCHMAKING.md) - Complete requirements
- [MATCHMAKING_IMPLEMENTATION.md](MATCHMAKING_IMPLEMENTATION.md) - Technical specifications
- [MATCHMAKING_DECISIONS.md](MATCHMAKING_DECISIONS.md) - All owner decisions
- [COMBAT_MESSAGES.md](COMBAT_MESSAGES.md) - Battle log messages

---

## Phase 1: Database & Core Models

### Issue #1: Database Schema Updates for Matchmaking

**Labels**: `backend`, `database`, `foundation`, `must-have`  
**Milestone**: Matchmaking System - Phase 1  
**Estimate**: 6 hours

#### Description

Add the database schema changes required for the matchmaking system, including the ScheduledMatch model, battleType field, league instance support, and special entries for testing.

This is the foundation for all matchmaking functionality.

#### Tasks

**Schema Updates:**
- [ ] Add `battleType` field to Battle model
  ```prisma
  battleType  String  @map("battle_type") @db.VarChar(20)  // "league", "tournament", "friendly"
  ```
- [ ] Update Robot model for league instances
  ```prisma
  currentLeague  String  @default("bronze") @db.VarChar(20)
  leagueId       String  @default("bronze_1") @db.VarChar(30)
  
  @@index([currentLeague, leagueId])
  ```
- [ ] Create ScheduledMatch model
  ```prisma
  model ScheduledMatch {
    id           Int      @id @default(autoincrement())
    robot1Id     Int
    robot2Id     Int
    leagueType   String   @db.VarChar(20)
    scheduledFor DateTime
    status       String   @default("scheduled") @db.VarChar(20)
    battleId     Int?
    createdAt    DateTime @default(now())
    
    robot1  Robot   @relation("ScheduledRobot1", fields: [robot1Id], references: [id])
    robot2  Robot   @relation("ScheduledRobot2", fields: [robot2Id], references: [id])
    battle  Battle? @relation(fields: [battleId], references: [id])
    
    @@index([robot1Id])
    @@index([robot2Id])
    @@index([scheduledFor, status])
    @@index([status])
  }
  ```
- [ ] Add relations to Robot model
  ```prisma
  scheduledMatchesAsRobot1  ScheduledMatch[] @relation("ScheduledRobot1")
  scheduledMatchesAsRobot2  ScheduledMatch[] @relation("ScheduledRobot2")
  ```
- [ ] Add relation to Battle model
  ```prisma
  scheduledMatch  ScheduledMatch[]
  ```

**Special Entries:**
- [ ] Create Bye-Robot entry (id: -1, userId: -1, name: "Bye Robot", ELO: 1000)
  - All attributes set to 1 (minimal stats)
  - Not owned by any real user
- [ ] Create Practice Sword weapon
  - Name: "Practice Sword"
  - Type: melee, single weapon
  - Base damage: 5
  - Cooldown: 3 seconds
  - Cost: 0 (free)
  - All bonuses: 0

**Test Data (100 Users/Robots):**
- [ ] Generate 100 test users (test_user_001 to test_user_100)
  - Username format: `test_user_###`
  - Password: `testpass123` (hashed)
  - Starting credits: 100,000
- [ ] Generate 100 test robots (1 per user)
  - Creative thematic names (see name generator in MATCHMAKING_IMPLEMENTATION.md)
  - All attributes set to 1
  - Single weapon loadout
  - Practice Sword equipped
  - Bronze league (bronze_1)
  - ELO: 1200

**Migration:**
- [ ] Run `npx prisma migrate dev --name add_matchmaking_schema`
- [ ] Run `npx prisma generate`
- [ ] Update seed script with test data generation
- [ ] Test migration rollback and reapply

#### Acceptance Criteria

- ✅ All migrations run successfully without errors
- ✅ ScheduledMatch model exists with correct indexes
- ✅ battleType field added to Battle with default value
- ✅ Robot leagueId field supports instance tracking (bronze_1, bronze_2, etc.)
- ✅ Bye-Robot entry exists with id: -1
- ✅ Practice Sword weapon exists and is free
- ✅ 100 test users created with creative robot names
- ✅ All test robots have Practice Sword equipped
- ✅ Database schema validates with `npx prisma validate`
- ✅ Seed script runs successfully

#### Testing Requirements

```bash
# Test migration
cd prototype/backend
npx prisma migrate dev --name add_matchmaking_schema

# Verify schema
npx prisma validate

# Run seed script
npm run seed

# Query test data
npx prisma studio  # Verify bye-robot, practice sword, test users exist
```

#### Reference Documents

- docs/MATCHMAKING_IMPLEMENTATION.md (Database schema section)
- docs/PRD_MATCHMAKING.md (Technical requirements)
- docs/DATABASE_SCHEMA.md

#### Dependencies

None - this is the foundation issue

---

## Phase 2: League Instance System

### Issue #2: League Instance Management System

**Labels**: `backend`, `core-logic`, `complex`, `must-have`  
**Milestone**: Matchmaking System - Phase 2  
**Estimate**: 10 hours

#### Description

Implement the league instance system that manages multiple instances per league tier (max 100 robots per instance) with auto-balancing logic.

This is a complex feature that enables scalable league management and fair matchmaking within league instances.

#### Tasks

**Core Service (`prototype/backend/src/services/leagueInstanceService.ts`):**
- [ ] Implement `getInstancesForTier(tier: string): LeagueInstance[]`
  - Query all robots in a tier
  - Group by leagueId
  - Calculate currentRobots count per instance
- [ ] Implement `assignLeagueInstance(tier: string): string`
  - Find instance with most free spots
  - Create new instance if all are at 100
  - Return leagueId (e.g., "bronze_1", "bronze_2")
- [ ] Implement `createNewInstance(tier: string): string`
  - Get current instances for tier
  - Determine next instance number
  - Return new leagueId
- [ ] Implement `getInstanceStats(leagueId: string)`
  - Count robots in instance
  - Calculate average ELO
  - Get promotion/demotion zone counts

**Auto-Balancing Logic:**
- [ ] Implement `checkInstanceBalance(tier: string): boolean`
  - Calculate max deviation between instances
  - Return true if deviation > 20 robots
- [ ] Implement `rebalanceInstances(tier: string)`
  - Calculate target robots per instance
  - Select robots to move (lowest priority first)
  - Update robot leagueId assignments
  - Log all movements
- [ ] Implement `shouldRebalance(tier: string): boolean`
  - Check if multiple instances exist
  - Check if deviation exceeds threshold
  - Return recommendation

**Robot Assignment:**
- [ ] Update robot creation to use `assignLeagueInstance()`
- [ ] Update promotion logic to use `assignLeagueInstance()`
- [ ] Track instance transfers in database (optional audit log)

**Utilities:**
- [ ] Implement `parseLeagueId(leagueId: string): {tier, instanceNumber}`
- [ ] Implement `formatLeagueId(tier: string, instanceNum: number): string`
- [ ] Implement `getInstanceDisplayName(leagueId: string): string` (e.g., "Bronze League 1")

**Unit Tests:**
- [ ] Test instance assignment with various robot counts
- [ ] Test new instance creation when capacity reached
- [ ] Test auto-balancing with imbalanced instances
- [ ] Test edge cases (0 robots, 1 robot, exactly 100, 101, etc.)

#### Acceptance Criteria

- ✅ Instances auto-create when tier reaches 100 robots
- ✅ New robots assigned to instance with most free spots
- ✅ Auto-balancing triggers when deviation > 20 robots
- ✅ All utility functions work correctly
- ✅ Unit tests pass with >90% coverage
- ✅ Service handles edge cases gracefully
- ✅ Instance assignments logged for debugging

#### Testing Requirements

```typescript
// Test cases to implement
describe('LeagueInstanceService', () => {
  test('assigns robot to least full instance');
  test('creates new instance when all full');
  test('rebalances when deviation exceeds threshold');
  test('handles single instance correctly');
  test('handles empty tier correctly');
});
```

#### Reference Documents

- docs/MATCHMAKING_IMPLEMENTATION.md (League Instance System section)
- docs/MATCHMAKING_DECISIONS.md (Decision #4)

#### Dependencies

- Issue #1 (Database schema must be in place)

---

## Phase 3: Matchmaking Algorithm

### Issue #3: Core Matchmaking Algorithm

**Labels**: `backend`, `core-logic`, `complex`, `must-have`  
**Milestone**: Matchmaking System - Phase 3  
**Estimate**: 8 hours

#### Description

Implement the core matchmaking algorithm that pairs robots for battles using ELO-based matching, recent opponent tracking, and bye-robot handling for odd numbers.

This is the heart of the matchmaking system.

#### Tasks

**Matchmaking Service (`prototype/backend/src/services/matchmakingService.ts`):**

**Queue Building:**
- [ ] Implement `buildMatchmakingQueue(tier: string, instance: string)`
  - Query battle-ready robots (HP ≥75%, weapons equipped)
  - Exclude robots with scheduled matches
  - Sort by: league points DESC → ELO DESC → random
  - Return queue with robot details and priority
- [ ] Implement `isBattleReady(robot: Robot): boolean`
  - Check HP ≥ 75%
  - Validate weapons equipped by loadout type
  - Return true/false with reasons
- [ ] Implement `getRecentOpponents(robotId: number): number[]`
  - Query last 5 battles
  - Extract opponent IDs
  - Return array of robot IDs

**Pairing Algorithm:**
- [ ] Implement `findBestMatch(robot: Robot, queue: Robot[], recentOpponents: number[])`
  - Try ±150 ELO match (within same instance)
  - Soft deprioritize: recent opponents (last 5), same-stable
  - Fallback: ±300 ELO (can use adjacent instances)
  - Last resort: closest available in tier
  - Return matched robot or null
- [ ] Implement `calculateMatchScore(robot1: Robot, robot2: Robot, recentOpponents: number[])`
  - Base score from ELO difference
  - Penalty for recent opponents (-1000 points)
  - Penalty for same stable (-500 points in leagues)
  - Return numeric score (higher = better match)
- [ ] Implement `pairRobots(queue: Robot[]): Match[]`
  - Iterate through queue
  - Find best match for each robot
  - Remove paired robots from queue
  - Handle odd number with bye-robot
  - Return array of matches

**Bye-Robot Handling:**
- [ ] Implement `handleOddRobot(robot: Robot): Match`
  - Load bye-robot from database (id: -1)
  - Create match with bye-robot as opponent
  - Mark as bye match (`isByeMatch: true`)
  - Return match object

**Schedule Creation:**
- [ ] Implement `scheduleMatches(matches: Match[], scheduledFor: Date)`
  - Create ScheduledMatch entries for each pair
  - Set status: 'scheduled'
  - Set scheduledFor timestamp
  - Return created schedule entries
- [ ] Implement `runMatchmaking(tier: string, instance: string, scheduledFor: Date)`
  - Build queue
  - Pair robots
  - Schedule matches
  - Return summary (matched count, bye matches, unmatched)

**Unit Tests:**
- [ ] Test ELO-based pairing
- [ ] Test recent opponent deprioritization
- [ ] Test same-stable deprioritization
- [ ] Test bye-robot matching for odd numbers
- [ ] Test edge cases (0 robots, 1 robot, all ineligible)

#### Acceptance Criteria

- ✅ Robots paired within ±150 ELO when possible
- ✅ Recent opponents (last 5) soft deprioritized
- ✅ Same-stable matchups soft deprioritized
- ✅ Odd-numbered queues match last robot with bye-robot
- ✅ All matches scheduled in database
- ✅ Unit tests pass with >90% coverage
- ✅ Matchmaking completes in <5 seconds for 100 robots

#### Testing Requirements

```typescript
describe('MatchmakingService', () => {
  test('pairs robots within ELO range');
  test('avoids recent opponents when possible');
  test('handles odd number with bye-robot');
  test('creates scheduled matches in database');
  test('returns summary with match counts');
});
```

#### Reference Documents

- docs/PRD_MATCHMAKING.md (Matchmaking Algorithm section)
- docs/MATCHMAKING_IMPLEMENTATION.md (Matchmaking logic)

#### Dependencies

- Issue #1 (Database schema)
- Issue #2 (League instances for instance-based matching)

---

## Phase 4: Battle Readiness System

### Issue #4: Battle Readiness Validation and Warnings

**Labels**: `backend`, `frontend`, `validation`, `must-have`  
**Milestone**: Matchmaking System - Phase 4  
**Estimate**: 5 hours

#### Description

Implement comprehensive battle readiness validation that checks HP and weapon requirements, plus warning UI components displayed on multiple pages.

#### Tasks

**Backend Validation (`prototype/backend/src/utils/battleReadiness.ts`):**
- [ ] Implement `calculateBattleReadiness(robot: Robot): BattleReadinessResult`
  - Check HP ≥ 75%
  - Validate weapons by loadout type:
    - Single: mainWeaponId required
    - Dual-wield: mainWeaponId AND offhandWeaponId required
    - Weapon+shield: mainWeaponId AND shield in offhand
    - Two-handed: two-handed mainWeaponId required
  - Return `{ ready: boolean, reasons: string[], hpCheck: boolean, weaponCheck: boolean }`
- [ ] Implement `getBattleReadinessReasons(robot: Robot): string[]`
  - Generate human-readable reasons
  - Examples: "HP below 75% (current: 45%)", "No main weapon equipped"
- [ ] Implement validation in matchmaking queue building

**API Endpoints:**
- [ ] `GET /api/robots/:id/battle-readiness`
  - Returns readiness status for single robot
  - Include reasons if not ready
- [ ] `GET /api/robots/my/readiness-status`
  - Returns readiness status for all user's robots
  - Batch check for efficiency

**Frontend Components:**

**Robot List Page (`prototype/frontend/src/components/RobotList.tsx`):**
- [ ] Add readiness badge/icon next to each robot
  - ✅ "Ready for Battle" (green)
  - ⚠️ "Not Ready" (yellow/red) with tooltip showing reasons
- [ ] Fetch readiness status for all robots on page load
- [ ] Update styling to highlight non-ready robots

**Robot Detail Page (`prototype/frontend/src/pages/RobotDetail.tsx`):**
- [ ] Add warning banner at top when not ready
  - Display specific issues (HP, weapons)
  - Include action buttons: [Repair Now] [Go to Weapons]
- [ ] Calculate repair cost and display
- [ ] Implement quick actions

**Dashboard (`prototype/frontend/src/pages/Dashboard.tsx`):**
- [ ] Add notification area for non-ready robots
  - Show count of non-ready robots
  - List robot names with issues
  - Include [View Robots] and [Repair All] buttons
- [ ] Fetch readiness status on dashboard load

**Shared Component:**
- [ ] Create `BattleReadinessIndicator` component
  - Reusable across pages
  - Props: robotId, showDetails, size
  - Displays icon + optional tooltip

#### Acceptance Criteria

- ✅ Battle readiness correctly validates HP and weapons
- ✅ Validation enforces loadout-specific weapon rules
- ✅ API endpoints return correct readiness status
- ✅ Robot list shows readiness badges
- ✅ Robot detail shows warning banner when not ready
- ✅ Dashboard shows notification for non-ready robots
- ✅ All UI components display correct information
- ✅ Tooltips explain why robot is not ready

#### Testing Requirements

```typescript
// Backend tests
describe('BattleReadiness', () => {
  test('validates HP threshold correctly');
  test('validates single weapon loadout');
  test('validates dual-wield weapons');
  test('validates weapon+shield combination');
  test('returns correct reasons');
});

// Frontend tests
test('Robot list displays readiness badges');
test('Warning banner shows on detail page when not ready');
test('Dashboard notification displays correctly');
```

#### Reference Documents

- docs/PRD_MATCHMAKING.md (Battle Readiness section)
- docs/MATCHMAKING_DECISIONS.md (Decision #8)

#### Dependencies

- Issue #1 (Database schema)

---

## Phase 5: Battle Execution

### Issue #5: Battle Orchestrator and Execution System

**Labels**: `backend`, `core-logic`, `must-have`  
**Milestone**: Matchmaking System - Phase 5  
**Estimate**: 6 hours

#### Description

Implement the battle orchestrator service that executes scheduled matches, handles bye-robot battles, updates robot stats, and awards rewards.

#### Tasks

**Battle Orchestrator (`prototype/backend/src/services/battleOrchestrator.ts`):**
- [ ] Implement `executeScheduledBattles(scheduledFor: Date)`
  - Query all scheduled matches for the time
  - Process each battle sequentially
  - Update battle results
  - Mark scheduled matches as completed
  - Return summary
- [ ] Implement `processBattle(scheduledMatch: ScheduledMatch)`
  - Load both robots with full details
  - Determine if bye-robot match
  - Execute battle simulation (call battle engine)
  - Create Battle record
  - Update scheduled match with battleId
  - Return battle result
- [ ] Implement `processByeBattle(robot: Robot, byeRobot: Robot)`
  - Simulate predictable, easy win for player robot
  - Duration: ~15 seconds
  - Player robot takes minimal damage (5-10%)
  - Full rewards awarded to compensate for low ELO gain
  - Return battle result

**Stat Updates:**
- [ ] Implement `updateRobotStats(robot: Robot, battle: Battle)`
  - Update ELO rating
  - Update league points (±3, ±1, +1 for draw)
  - Update currentHP based on damage taken
  - Update battle count
  - Update win/loss record
- [ ] Implement `calculateELOChange(winner: Robot, loser: Robot): {winnerChange, loserChange}`
  - Use standard ELO formula (K=32)
  - Return changes for both robots
- [ ] Implement `calculateLeaguePoints(result: BattleResult): {winner, loser}`
  - Win: +3, Loss: -1, Draw: +1
  - Bonus: +1 for beating >200 ELO higher
  - Penalty: -1 for losing to >300 ELO lower
  - Return points for both robots

**Reward System:**
- [ ] Implement `awardRewards(robot: Robot, battle: Battle)`
  - Calculate base reward from battle
  - Add bonus for bye matches (compensation for low ELO)
  - Update user credits
  - Log reward transaction
- [ ] Implement bye-robot reward compensation
  - Standard rewards × 2 for bye matches
  - Ensure player doesn't feel penalized

**Integration:**
- [ ] Integrate with existing battle simulation engine
- [ ] Handle draw conditions (max time reached)
- [ ] Handle yield/surrender mechanics
- [ ] Error handling and rollback for failed battles

**Unit Tests:**
- [ ] Test battle execution flow
- [ ] Test bye-robot battle simulation
- [ ] Test ELO calculations
- [ ] Test league point calculations
- [ ] Test reward calculations
- [ ] Test error handling

#### Acceptance Criteria

- ✅ All scheduled battles execute successfully
- ✅ Bye-robot battles result in easy player wins
- ✅ Robot stats update correctly (ELO, league points, HP)
- ✅ Rewards calculated and awarded accurately
- ✅ Battle records created with all details
- ✅ Scheduled matches marked as completed
- ✅ Bye-robot rewards compensate for low ELO gain
- ✅ Error handling prevents partial updates

#### Testing Requirements

```typescript
describe('BattleOrchestrator', () => {
  test('executes scheduled battles successfully');
  test('processes bye-robot match correctly');
  test('updates robot ELO and league points');
  test('awards correct rewards');
  test('handles draw conditions');
});
```

#### Reference Documents

- docs/PRD_MATCHMAKING.md (Battle Execution section)
- docs/MATCHMAKING_IMPLEMENTATION.md (Battle Execution)

#### Dependencies

- Issue #1 (Database schema)
- Issue #3 (Scheduled matches to execute)

---

## Phase 6: League Rebalancing

### Issue #6: League Promotion and Demotion System

**Labels**: `backend`, `core-logic`, `must-have`  
**Milestone**: Matchmaking System - Phase 6  
**Estimate**: 6 hours

#### Description

Implement the league rebalancing system that promotes and demotes robots based on performance (top/bottom 10%) with instance balancing.

#### Tasks

**Rebalancing Service (`prototype/backend/src/services/leagueRebalancingService.ts`):**
- [ ] Implement `rebalanceLeagues()`
  - Process all league tiers (bronze through champion)
  - For each tier, determine promotions and demotions
  - Execute tier changes
  - Balance instances after changes
  - Return summary
- [ ] Implement `determinePromotions(tier: string): Robot[]`
  - Query robots in tier with ≥5 battles
  - Sort by league points DESC
  - Select top 10%
  - Return robots to promote
- [ ] Implement `determineDemotions(tier: string): Robot[]`
  - Query robots in tier with ≥5 battles
  - Sort by league points ASC
  - Select bottom 10%
  - Return robots to demote
- [ ] Implement `promoteRobot(robot: Robot)`
  - Move to next tier (bronze → silver → gold, etc.)
  - Reset league points to 0
  - Assign to appropriate instance using `assignLeagueInstance()`
  - Keep ELO unchanged
  - Log promotion
- [ ] Implement `demoteRobot(robot: Robot)`
  - Move to previous tier (silver → bronze, etc.)
  - Reset league points to 0
  - Assign to appropriate instance
  - Keep ELO unchanged
  - Log demotion

**Instance Balancing:**
- [ ] Integrate with `rebalanceInstances()` from Issue #2
- [ ] Run balancing after promotions/demotions complete
- [ ] Log all instance redistributions

**Edge Cases:**
- [ ] Handle Champion tier (no promotion available)
- [ ] Handle Bronze tier (no demotion available)
- [ ] Handle small leagues (<10 robots) - skip rebalancing
- [ ] Handle tie-breakers (ELO, then total battles, then random)

**Logging:**
- [ ] Log all promotions with before/after tier
- [ ] Log all demotions
- [ ] Log instance changes
- [ ] Create summary report for admin dashboard

**Unit Tests:**
- [ ] Test 10% threshold calculation
- [ ] Test promotion flow
- [ ] Test demotion flow
- [ ] Test instance balancing trigger
- [ ] Test edge cases (small leagues, ties)
- [ ] Test Champion and Bronze boundary conditions

#### Acceptance Criteria

- ✅ Top 10% of eligible robots promoted
- ✅ Bottom 10% of eligible robots demoted
- ✅ League points reset to 0 after tier change
- ✅ ELO carries over between tiers
- ✅ Robots assigned to appropriate instances
- ✅ Instance balancing runs after rebalancing
- ✅ Champion and Bronze boundaries respected
- ✅ Minimum 5 battles required for eligibility
- ✅ All changes logged for audit

#### Testing Requirements

```typescript
describe('LeagueRebalancing', () => {
  test('promotes top 10% of league');
  test('demotes bottom 10% of league');
  test('resets league points after promotion');
  test('preserves ELO across tiers');
  test('handles small leagues correctly');
  test('respects Champion and Bronze boundaries');
});
```

#### Reference Documents

- docs/PRD_MATCHMAKING.md (League Rebalancing section)
- docs/MATCHMAKING_DECISIONS.md (Decision #3)

#### Dependencies

- Issue #1 (Database schema)
- Issue #2 (Instance assignment functions)

---

## Phase 7: Admin Dashboard

### Issue #7: Admin Dashboard for Testing and Monitoring

**Labels**: `backend`, `frontend`, `admin`, `nice-to-have`  
**Milestone**: Matchmaking System - Phase 7  
**Estimate**: 12 hours

#### Description

Create a separate admin dashboard for manually triggering matchmaking cycles, executing battles, monitoring system health, and running bulk test cycles.

This is a complex feature that provides comprehensive testing and monitoring capabilities.

#### Tasks

**Backend Admin API (`prototype/backend/src/routes/admin.ts`):**
- [ ] Create admin middleware for role checking
  - Verify user has admin role
  - Return 403 if not authorized
- [ ] `POST /api/admin/matchmaking/run`
  - Body: `{ tier?, instance?, scheduledFor }`
  - Trigger matchmaking for specified tier/instance
  - Return match count and summary
- [ ] `POST /api/admin/battles/run`
  - Body: `{ scheduledFor? }`
  - Execute battles scheduled for specified time
  - Return battle results summary
- [ ] `POST /api/admin/leagues/rebalance`
  - Trigger league rebalancing
  - Return promotion/demotion summary
- [ ] `POST /api/admin/cycles/bulk`
  - Body: `{ cycles: number, autoRepair: boolean }`
  - Run multiple complete cycles (up to 100)
  - Auto-repair all robots before each cycle if enabled
  - Deduct repair costs with facility discounts
  - Return detailed log of all cycles
- [ ] `GET /api/admin/stats`
  - Return system statistics:
    - Total robots by tier
    - Average ELO by tier
    - Scheduled matches count
    - Battle readiness percentage
    - Recent activity metrics

**Auto-Repair Functionality:**
- [ ] Implement `autoRepairAllRobots()`
  - Query all robots with HP < 100%
  - Calculate repair cost for each
  - Apply Repair Bay facility discounts
  - Deduct from user credits (allow negative balance for testing)
  - Update robot HP to 100%
  - Log all repairs and costs

**Frontend Admin Dashboard (`prototype/frontend/src/pages/admin/`):**

**Dashboard Home:**
- [ ] Create `AdminDashboard.tsx`
  - System stats overview
  - Quick action buttons
  - Recent activity log
  - Error notifications

**Matchmaking Page:**
- [ ] Create `AdminMatchmaking.tsx`
  - Trigger matchmaking by tier/instance
  - View scheduled matches
  - Cancel scheduled matches
  - Set custom scheduledFor time

**Battle Execution Page:**
- [ ] Create `AdminBattles.tsx`
  - Execute battles button
  - View battle queue
  - Monitor execution progress
  - View recent battle results

**League Management Page:**
- [ ] Create `AdminLeagues.tsx`
  - Trigger league rebalancing
  - View promotion/demotion candidates
  - View instance statistics
  - Force instance rebalancing

**Bulk Testing Page:**
- [ ] Create `AdminBulkTesting.tsx`
  - Cycles input (1-100)
  - Auto-repair toggle
  - Progress indicator
  - Detailed log output
  - Download results as CSV

**Authentication:**
- [ ] Add admin route protection
- [ ] Create admin-only navigation
- [ ] Add admin role to test user

#### Acceptance Criteria

- ✅ Admin endpoints protected by role authentication
- ✅ All admin functions work correctly
- ✅ Bulk cycle testing runs up to 100 cycles
- ✅ Auto-repair deducts costs correctly
- ✅ Frontend dashboard displays all controls
- ✅ Real-time progress indicators work
- ✅ Error handling and logging implemented
- ✅ Admin access restricted to authorized users

#### Testing Requirements

```bash
# Manual testing
# 1. Login as admin user
# 2. Test each admin endpoint via dashboard
# 3. Run bulk cycle with 10 cycles
# 4. Verify all stats update correctly
# 5. Check repair costs in database
```

#### Reference Documents

- docs/PRD_MATCHMAKING.md (Admin Endpoints section)
- docs/MATCHMAKING_DECISIONS.md (Decision #10)

#### Dependencies

- Issue #1 (Database schema)
- Issue #3 (Matchmaking functions)
- Issue #5 (Battle execution)
- Issue #6 (League rebalancing)

---

## Phase 8: Public API Endpoints

### Issue #8: Player-Facing API Endpoints

**Labels**: `backend`, `api`, `must-have`  
**Milestone**: Matchmaking System - Phase 8  
**Estimate**: 6 hours

#### Description

Create the public API endpoints that allow players to view upcoming matches, battle history, league standings, and robot match history.

#### Tasks

**Match Endpoints (`prototype/backend/src/routes/matches.ts`):**
- [ ] `GET /api/matches/upcoming`
  - Query: none (uses authenticated user)
  - Returns scheduled matches for current user's robots
  - Include opponent details
  - Sort by scheduledFor ASC
- [ ] `GET /api/matches/history`
  - Query: `page`, `perPage`, `robotId?`
  - Returns paginated battle history
  - Include opponent details, results, rewards
  - Filter by robotId if provided
  - Default sort: createdAt DESC

**League Endpoints (`prototype/backend/src/routes/leagues.ts`):**
- [ ] `GET /api/leagues/:tier/standings`
  - Path: tier (bronze, silver, gold, etc.)
  - Query: `instance?`, `page`, `perPage`
  - Returns league standings for specified tier/instance
  - Include rank, robot details, league points, W-L record
  - Sort by league points DESC, then ELO DESC
- [ ] `GET /api/leagues/:tier/instances`
  - Returns all instances for a tier
  - Include robot counts per instance
  - Include user's robots in each instance

**Robot Endpoints (`prototype/backend/src/routes/robots.ts`):**
- [ ] `GET /api/robots/:id/matches`
  - Path: robotId
  - Query: `page`, `perPage`
  - Returns paginated match history for specific robot
  - Include full battle details
  - Sort by createdAt DESC
- [ ] `GET /api/robots/:id/upcoming`
  - Returns upcoming scheduled matches for robot
  - Include opponent details

**Response Formatting:**
- [ ] Standardize pagination format:
  ```typescript
  {
    data: [...],
    pagination: {
      page: 1,
      perPage: 20,
      total: 142,
      totalPages: 8
    }
  }
  ```
- [ ] Include opponent summary in matches:
  ```typescript
  {
    opponentId: number,
    opponentName: string,
    opponentELO: number,
    opponentOwner: string
  }
  ```

**Input Validation:**
- [ ] Validate page and perPage parameters
- [ ] Validate tier names
- [ ] Validate robot ownership for private data
- [ ] Return 400 for invalid parameters

**Integration Tests:**
- [ ] Test each endpoint with valid inputs
- [ ] Test pagination
- [ ] Test filtering
- [ ] Test authorization (user can only see their data)
- [ ] Test response format consistency

#### Acceptance Criteria

- ✅ All endpoints return correct data
- ✅ Pagination works correctly
- ✅ Filtering by robotId works
- ✅ League standings sort correctly
- ✅ Authorization prevents data leakage
- ✅ Response format consistent across endpoints
- ✅ Error handling returns appropriate status codes
- ✅ Integration tests pass

#### Testing Requirements

```typescript
describe('Public API Endpoints', () => {
  describe('GET /api/matches/upcoming', () => {
    test('returns user scheduled matches');
    test('includes opponent details');
  });
  
  describe('GET /api/matches/history', () => {
    test('returns paginated battle history');
    test('filters by robotId when provided');
  });
  
  describe('GET /api/leagues/:tier/standings', () => {
    test('returns standings sorted correctly');
    test('supports pagination');
  });
});
```

#### Reference Documents

- docs/PRD_MATCHMAKING.md (API Endpoints section)

#### Dependencies

- Issue #1 (Database schema)
- Issue #3 (Scheduled matches)
- Issue #5 (Battle records)

---

## Phase 9: Frontend UI

### Issue #9: Matchmaking UI Components - Dashboard and Matches

**Labels**: `frontend`, `ui`, `must-have`  
**Milestone**: Matchmaking System - Phase 9A  
**Estimate**: 7 hours

#### Description

Create the dashboard UI components for viewing upcoming matches and last 5 matches per robot.

#### Tasks

**Upcoming Matches Component (`prototype/frontend/src/components/UpcomingMatches.tsx`):**
- [ ] Create component structure
- [ ] Fetch upcoming matches from API
- [ ] Display match cards with:
  - Your robot name and ELO
  - Opponent name, ELO, owner
  - League instance (e.g., "Bronze 1")
  - Scheduled date/time with countdown
- [ ] Add loading state
- [ ] Add empty state ("No upcoming matches")
- [ ] Style with Tailwind CSS

**Last 5 Matches Component (`prototype/frontend/src/components/RecentMatches.tsx`):**
- [ ] Create collapsible sections per robot
- [ ] Fetch last 5 matches per robot
- [ ] Display match results:
  - Win ✅, Loss ❌, Draw 🤝
  - Opponent name
  - ELO change
  - Time ago (e.g., "2 hours ago")
- [ ] Click match to view detailed battle log
- [ ] Expand/collapse functionality per robot
- [ ] Loading and empty states

**Dashboard Integration (`prototype/frontend/src/pages/Dashboard.tsx`):**
- [ ] Add "Upcoming Matches" section
  - Display UpcomingMatches component
  - Show next battle cycle time
- [ ] Add "My Robots & Recent Matches" section
  - Display RecentMatches component grouped by robot
  - Limit to user's robots
- [ ] Responsive layout (mobile-friendly)

**Styling:**
- [ ] Match visual design from PRD mockups
- [ ] Use consistent color scheme (green for wins, red for losses, blue for draws)
- [ ] Add hover effects and transitions
- [ ] Ensure dark mode support

#### Acceptance Criteria

- ✅ Upcoming matches display correctly
- ✅ Last 5 matches grouped per robot
- ✅ Expand/collapse functionality works
- ✅ Loading states display during API calls
- ✅ Empty states show appropriate messages
- ✅ Click match opens detailed view
- ✅ Responsive design works on mobile
- ✅ Styling matches design specifications

#### Testing Requirements

```bash
# Manual testing
npm run dev
# Navigate to dashboard
# Verify upcoming matches section
# Verify recent matches per robot
# Test expand/collapse
# Test responsive layout
```

#### Reference Documents

- docs/PRD_MATCHMAKING.md (UI Specifications - Dashboard sections)

#### Dependencies

- Issue #8 (API endpoints for fetching data)

---

### Issue #10: Matchmaking UI Components - History and Standings

**Labels**: `frontend`, `ui`, `must-have`  
**Milestone**: Matchmaking System - Phase 9B  
**Estimate**: 7 hours

#### Description

Create the battle history page, league standings page, and robot detail match history tab.

#### Tasks

**Battle History Page (`prototype/frontend/src/pages/BattleHistory.tsx`):**
- [ ] Create page structure
- [ ] Fetch paginated battle history
- [ ] Display battle cards with:
  - Result (Victory ✅, Defeat ❌, Draw 🤝)
  - Your robot vs opponent robot
  - ELO change
  - Damage dealt/taken
  - League type and rewards
  - Promotion/Demotion badge (if applicable)
  - [View Details] button
- [ ] Implement pagination controls
- [ ] Add filters:
  - Robot selector dropdown
  - Result filter (all/wins/losses/draws)
  - Date range
- [ ] Loading and empty states

**League Standings Page (`prototype/frontend/src/pages/LeagueStandings.tsx`):**
- [ ] Create page with tier tabs
  - [Bronze] [Silver] [Gold] [Platinum] [Diamond] [Champion]
  - Highlight tabs where player has robots
- [ ] Fetch standings for selected tier
- [ ] Display standings table:
  - Rank
  - Robot name (bold + background + 🎯 icon for player's robots)
  - Owner
  - ELO
  - League Points
  - W-L record
- [ ] Highlight zones:
  - Promotion zone (top 10%) - 🟢 green
  - Demotion zone (bottom 10%) - 🔴 red
- [ ] Show instance selector if multiple instances
- [ ] Pagination for large leagues
- [ ] Loading and empty states

**Robot Detail - Match History Tab (`prototype/frontend/src/pages/RobotDetail.tsx`):**
- [ ] Add "Match History" tab to existing page
- [ ] Fetch match history for specific robot
- [ ] Display same format as Battle History page
- [ ] Implement pagination
- [ ] Add filters (result type, date range)
- [ ] Link back to robot detail overview

**Promotion/Demotion Badges:**
- [ ] Create badge component
- [ ] Display on league battle results:
  - 🏆 "PROMOTED TO [TIER]!" (green)
  - ⬇️ "DEMOTED TO [TIER]" (red)
- [ ] Only show for league matches (not tournaments)

**Styling:**
- [ ] Consistent table styling
- [ ] Responsive design
- [ ] Dark mode support
- [ ] Smooth transitions

#### Acceptance Criteria

- ✅ Battle history page displays correctly
- ✅ Pagination works on all pages
- ✅ Filters function properly
- ✅ League standings show all 6 tiers
- ✅ Player robots highlighted correctly
- ✅ Promotion/Demotion badges display on results
- ✅ Robot detail match history tab works
- ✅ Responsive design on mobile
- ✅ Loading states display during API calls

#### Testing Requirements

```bash
# Manual testing
npm run dev
# Navigate to Battle History page
# Test pagination and filters
# Navigate to League Standings
# Test tier tabs
# Verify player robot highlights
# Check robot detail match history tab
```

#### Reference Documents

- docs/PRD_MATCHMAKING.md (UI Specifications)

#### Dependencies

- Issue #8 (API endpoints)
- Issue #9 (Dashboard components for consistency)

---

## Phase 10: Battle Log System

### Issue #11: Battle Log Message Generation System

**Labels**: `backend`, `battle-system`, `nice-to-have`  
**Milestone**: Matchmaking System - Phase 10  
**Estimate**: 6 hours

#### Description

Implement the action-by-action battle log system with textual combat descriptions and 100+ message templates.

#### Tasks

**Message Catalog (`prototype/backend/src/data/combatMessages.ts`):**
- [ ] Create message template collections
  - Battle initialization messages
  - Attack messages (hit, miss, critical)
  - Counter-attack messages
  - Shield event messages
  - Special weapon messages
  - Yield/surrender messages
  - Destruction/KO messages
  - Victory messages
- [ ] Implement template variables:
  - `{attackerName}`, `{defenderName}`
  - `{weaponName}`
  - `{damage}`, `{currentHP}`, `{maxHP}`
  - `{elo}`, etc.
- [ ] Minimum 100 unique message templates

**Message Generator (`prototype/backend/src/services/combatMessageGenerator.ts`):**
- [ ] Implement `generateMessage(event: BattleEvent): string`
  - Select appropriate message category
  - Choose random message from category
  - Interpolate variables
  - Return formatted message
- [ ] Implement context-aware selection:
  - Check for critical hits
  - Check shield status
  - Check damage amount (heavy/moderate/light)
  - Select message accordingly
- [ ] Implement message variation to avoid repetition
  - Track recently used messages
  - Prefer unused messages

**Battle Event Logging:**
- [ ] Update battle simulation to log events
- [ ] Create event structure:
  ```typescript
  interface BattleEvent {
    timestamp: number;      // seconds from start
    type: string;           // "attack", "counter", "shield_break", etc.
    attacker?: string;
    defender?: string;
    weapon?: string;
    damage?: number;
    shieldDamage?: number;
    hpDamage?: number;
    critical?: boolean;
    message: string;        // Generated message
  }
  ```
- [ ] Store events in Battle.battleLog JSON field

**Integration with Battle System:**
- [ ] Update battle simulation to generate events
- [ ] Generate messages for each event
- [ ] Store complete battle log
- [ ] Ensure events have accurate timestamps

**Battle Detail UI (`prototype/frontend/src/components/BattleLogViewer.tsx`):**
- [ ] Create battle log viewer component
- [ ] Display events chronologically
- [ ] Show timestamps
- [ ] Show message with emoji icons
- [ ] Color-code by event type
- [ ] Add "View Detailed Log" modal on battle history

#### Acceptance Criteria

- ✅ 100+ message templates implemented
- ✅ Messages generated for all event types
- ✅ Variables interpolated correctly
- ✅ Battle logs stored in database
- ✅ Event timestamps accurate
- ✅ UI displays battle log correctly
- ✅ Messages vary appropriately (no excessive repetition)
- ✅ Battle detail view accessible from history

#### Testing Requirements

```typescript
describe('CombatMessageGenerator', () => {
  test('generates attack messages correctly');
  test('interpolates variables properly');
  test('selects appropriate message for context');
  test('avoids excessive repetition');
});

// UI testing
test('Battle log viewer displays events chronologically');
test('Messages show correct emojis and formatting');
```

#### Reference Documents

- docs/COMBAT_MESSAGES.md (Complete message catalog)
- docs/PRD_MATCHMAKING.md (Battle Log section)

#### Dependencies

- Issue #5 (Battle execution to generate logs)

---

## Phase 11: Testing & Polish

### Issue #12: Integration Testing and Final Polish

**Labels**: `testing`, `qa`, `must-have`  
**Milestone**: Matchmaking System - Phase 11  
**Estimate**: 8 hours

#### Description

Comprehensive integration testing of the complete matchmaking system, load testing, edge case validation, and final polish.

#### Tasks

**Integration Tests:**
- [ ] Test complete daily cycle:
  - Run matchmaking
  - Execute battles
  - Update stats
  - Rebalance leagues
  - Run next matchmaking
  - Verify entire flow works
- [ ] Test with 100 test users:
  - Run multiple cycles
  - Verify all robots get matched
  - Verify league progression works
  - Check for deadlocks or infinite loops
- [ ] Test bye-robot matching:
  - Create odd-numbered queue
  - Verify bye-robot match created
  - Verify rewards compensated correctly
- [ ] Test league instance system:
  - Create 101 robots in bronze
  - Verify bronze_2 created automatically
  - Promote some robots
  - Verify instance balancing
- [ ] Test battle readiness:
  - Create robots with low HP
  - Create robots without weapons
  - Verify they're excluded from matchmaking
  - Verify warnings display

**Edge Case Testing:**
- [ ] Zero robots in queue
- [ ] One robot in queue (bye-robot match)
- [ ] All robots ineligible (low HP/no weapons)
- [ ] Large ELO disparities
- [ ] Same-owner matching in small leagues
- [ ] Recent opponent matching when no alternatives
- [ ] Promotion/demotion with tie scores
- [ ] Instance balancing edge cases

**Load Testing:**
- [ ] Test with 100 robots matchmaking simultaneously
- [ ] Measure matchmaking speed (should be <5 seconds)
- [ ] Test 100 battles executing simultaneously
- [ ] Measure database query performance
- [ ] Identify and fix performance bottlenecks

**UI Testing:**
- [ ] Test all UI components with real data
- [ ] Verify responsive design on multiple screen sizes
- [ ] Test dark mode throughout
- [ ] Verify loading states
- [ ] Test error handling and error messages
- [ ] Cross-browser testing (Chrome, Firefox, Safari)

**Bug Fixes and Polish:**
- [ ] Fix any issues found during testing
- [ ] Improve error messages
- [ ] Add loading indicators where missing
- [ ] Optimize database queries
- [ ] Add indexes if needed
- [ ] Clean up console logs
- [ ] Update documentation with any changes

**Documentation Updates:**
- [ ] Update README with matchmaking instructions
- [ ] Document admin dashboard usage
- [ ] Create troubleshooting guide
- [ ] Document known limitations
- [ ] Update API documentation

**Final Validation:**
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] No TypeScript errors
- [ ] No console errors in browser
- [ ] All ESLint rules passing
- [ ] Database migrations clean
- [ ] Seed script works
- [ ] Admin dashboard functional
- [ ] Public UI functional

#### Acceptance Criteria

- ✅ Complete daily cycle runs without errors
- ✅ 100 test users can run multiple cycles successfully
- ✅ All edge cases handled correctly
- ✅ Performance meets targets (<5s matchmaking, <10s battles)
- ✅ UI tested on multiple browsers
- ✅ Responsive design works on mobile
- ✅ All tests passing (unit + integration)
- ✅ Documentation complete and accurate
- ✅ No critical bugs remaining

#### Testing Requirements

```bash
# Run all tests
cd prototype/backend
npm test

cd ../frontend
npm test

# Load test
npm run test:load

# Integration test
npm run test:integration

# Manual testing checklist
# □ Run complete daily cycle
# □ Test admin dashboard all functions
# □ Test public UI all pages
# □ Test on mobile devices
# □ Test with real-world data volumes
```

#### Reference Documents

- docs/PRD_MATCHMAKING.md (All requirements)
- docs/TESTING_STRATEGY.md

#### Dependencies

- All previous issues (1-11)

---

## Summary

**Total Issues**: 12  
**Total Estimate**: 87 hours  
**Critical Path**: Issues 1-3-5-6 (Core matchmaking flow)

**Suggested Implementation Order**:
1. Foundation: Issue #1 (Database)
2. Core Systems: Issues #2, #3, #4 (Instances, Matchmaking, Readiness)
3. Execution: Issues #5, #6 (Battles, Rebalancing)
4. Tools: Issue #7 (Admin Dashboard)
5. API: Issue #8 (Public Endpoints)
6. UI: Issues #9, #10 (Frontend Components)
7. Enhancement: Issue #11 (Battle Logs)
8. Finalization: Issue #12 (Testing & Polish)

**Testing Strategy**:
- Test each issue individually before moving to next
- Integration testing in Issue #12
- Load testing with 100 test users
- Manual testing via admin dashboard

**Deployment Notes**:
- Deploy backend and database changes first
- Deploy frontend after API is stable
- Admin dashboard can be deployed separately

