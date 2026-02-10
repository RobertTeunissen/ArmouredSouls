# Product Requirements Document: Matchmaking System

**Last Updated**: February 9, 2026  
**Status**: ✅ IMPLEMENTED - All Core Features Complete  
**Owner**: Robert Teunissen  
**Epic**: Matchmaking and Battle Scheduling System  
**Version**: 2.0

## Version History
- v1.0 - Initial Implemented Version by GitHub Copilot (January 31, 2026)
- v2.0 - Consolidated Version (February 9, 2025)

---

## Document Status

**Implementation Status**: ✅ **COMPLETE** (All 11 phases implemented as of January 31, 2026)

This PRD now serves as:
1. **Historical Record**: Documents what was built and why
2. **System Reference**: Complete specification of the matchmaking system
3. **Future Roadmap**: Identifies potential enhancements

**What's Implemented**:
- ✅ ELO-based matchmaking algorithm
- ✅ League instance system (100 robots per instance)
- ✅ Battle scheduling and execution
- ✅ League rebalancing (promotion/demotion)
- ✅ Battle readiness validation
- ✅ Combat message generation
- ✅ Admin dashboard with bulk cycle testing
- ✅ Public APIs for matches and standings
- ✅ Frontend UI components
- ✅ Complete test coverage (49 unit tests, 4 integration tests)

**Related Documentation** (can be archived after consolidation):
- MATCHMAKING_DECISIONS.md - Design decisions (consolidated here)
- MATCHMAKING_IMPLEMENTATION.md - Technical specs (consolidated here)
- MATCHMAKING_COMPLETE_LOGIC.md - Logic explanation (consolidated here)
- MATCHMAKING_STATUS.md - Status tracking (obsolete)
- MATCHMAKING_SYSTEM_GUIDE.md - Implementation guide (consolidated here)
- MATCHMAKING_TESTING_GUIDE.md - Testing guide (consolidated here)
- QUICK_REFERENCE_MATCHMAKING.md - Quick reference (consolidated here)

---

## Executive Summary

The Armoured Souls matchmaking system is a **fully implemented** turn-based multiplayer battle system that pairs robots for competitive league matches. Completed in January 2026, it enables the game's core loop: Players configure robots → Matchmaking pairs opponents → Battles execute in scheduled batches → Results displayed → League rankings update → Next cycle begins.

**System Architecture**: Scheduled batch processing model (inspired by Football Manager) where players set strategy and check back for results. This prioritizes strategic planning over real-time action, ideal for casual engagement (15-30 minutes per day).

**Key Features Implemented**:
- **ELO-Based Matchmaking**: Pairs robots within ±150 ELO (±300 fallback) for fair matches
- **League Instance System**: Max 100 robots per instance with auto-balancing
- **Battle Scheduling**: Daily cycle with 24-hour adjustment period
- **League Progression**: 10% promotion/demotion every cycle (min 5 cycles in tier)
- **Battle Readiness**: HP ≥75% + HP > yield threshold + all weapons equipped
- **Bye-Robot System**: Handles odd numbers (ELO 1000, full rewards)
- **Combat Logs**: Action-by-action with 50+ message templates
- **Admin Tools**: Bulk cycle testing (up to 100 cycles) with auto-repair
- **Complete UI**: Dashboard, battle history, league standings, match details

**Performance Achieved**:
- Matchmaking: <2 seconds (100 robots) ✅ Target: <5s
- Battle execution: <5 seconds (50 battles) ✅ Target: <30s
- API response: <100ms ✅ Target: <200ms
- Test coverage: 53 unit tests + 4 integration tests ✅

---

## Implementation Summary (January 2026)

### What Was Built

**Phase 1-11 Complete** 

#### Core Systems
1. **Database Schema** 
   - ScheduledMatch model for match scheduling
   - League instance support (leagueId field)
   - Bye-Robot entry (id: -1, ELO 1000)
   - Practice Sword weapon (free, 3sec cooldown, 5 damage)
   - 100 test robots with creative names
   - battleType field in Battle model

2. **League Instance Management** 
   - Max 100 robots per instance
   - Auto-balancing when deviation >20
   - Dynamic instance creation
   - Instance statistics tracking
   - Files: `leagueInstanceService.ts` (12 tests passing)

3. **Matchmaking Algorithm** 
   - Battle readiness: HP ≥75%, HP > yield threshold, weapons equipped
   - ELO-based pairing (±150 ideal, ±300 fallback)
   - Recent opponent tracking (soft deprioritize last 5)
   - Same-stable deprioritization (heavy penalty)
   - Bye-robot for odd numbers
   - Duplicate match prevention
   - Files: `matchmakingService.ts` (9 tests passing)

4. **Battle Orchestrator** 
   - Deterministic battle simulation
   - ELO calculation (K=32 formula)
   - HP reduction (Winners 10-15%, Losers 35-40%)
   - League points (+3 win, -1 loss, +1 draw, min 0)
   - Economic rewards (1000 credits win, 300 loss)
   - Bye-robot battles (easy wins, minimal damage)
   - Files: `battleOrchestrator.ts` (7 tests passing)

5. **League Rebalancing** 
   - Top 10% promoted (≥5 cycles in league, ≥10 robots/tier)
   - Bottom 10% demoted (same requirements)
   - Runs every cycle
   - League points reset on tier change
   - Cycles counter reset on tier change
   - ELO preserved
   - Instance rebalancing after moves
   - Files: `leagueRebalancingService.ts` (11 tests passing)

6. **Admin Dashboard** 
   - POST /api/admin/matchmaking/run
   - POST /api/admin/battles/run
   - POST /api/admin/leagues/rebalance
   - POST /api/admin/repair/all
   - POST /api/admin/cycles/bulk (1-100 cycles)
   - GET /api/admin/stats
   - Files: `routes/admin.ts`, `scripts/testAdminAPI.js`

7. **Public APIs** 
   - GET /api/matches/upcoming
   - GET /api/matches/history (paginated)
   - GET /api/matches/battles/:id/log
   - GET /api/leagues/:tier/standings
   - GET /api/leagues/:tier/instances
   - GET /api/robots/:id/matches
   - Files: `routes/matches.ts`, `routes/leagues.ts`

8. **Frontend UI** 
   - Dashboard: Upcoming and recent matches
   - Battle history page with pagination
   - League standings (all 6 tiers)
   - Battle readiness warnings
   - ELO change indicators
   - HP status displays
   - Responsive design
   - Files: Multiple React components

9. **Battle Log System** 
   - 50+ message templates (9 categories)
   - Context-aware message selection
   - Random variation
   - Complete battle timeline
   - JSON storage
   - API endpoint for retrieval
   - Files: `combatMessageGenerator.ts` (10 tests passing)

10. **Integration Testing** 
    - Complete daily cycle test
    - Bye-robot handling test
    - Edge case tests
    - Data consistency validation
    - Files: `tests/integration.test.ts`

### Key Design Decisions

**D1: Draw Mechanics**
- **Decision**: Max battle time (~120 seconds, adjustable)
- **Rationale**: Prevents infinite stalemates, tunable for balance
- **Implementation**: Battle ends in draw when time limit reached, +1 league point

**D2: League Instance Size**
- **Decision**: 100 robots per instance with auto-balancing
- **Rationale**: Manageable size, promotes familiarity
- **Implementation**: bronze_1, bronze_2, etc. Auto-balance when deviation >20

**D3: Promotion/Demotion**
- **Decision**: 10% thresholds, min 5 cycles in current league
- **Rationale**: Slower, more stable progression
- **Implementation**: Runs every cycle, checks eligibility, resets points and cycles counter

**D4: Odd Robot Handling**
- **Decision**: Bye-robot (ELO 1000, full rewards)
- **Rationale**: Every robot fights, no sitting out
- **Implementation**: Special robot id: -1, predictable weak stats

**D5: Battle Readiness**
- **Decision**: HP ≥75% AND HP > yield threshold AND all weapons equipped
- **Rationale**: Prevents incomplete loadouts and immediate surrenders
- **Implementation**: Comprehensive validation by loadout type

**D6: Same-Stable Matching**
- **Decision**: Strongly deprioritize (allow as last resort)
- **Rationale**: Flexible for small player base
- **Implementation**: +500 penalty in match scoring

**D7: Recent Opponents**
- **Decision**: Soft deprioritize last 5
- **Rationale**: Adds variety, avoids deadlocks
- **Implementation**: +200 penalty in match scoring

**D8: Admin Portal**
- **Decision**: Separate admin dashboard
- **Rationale**: Comprehensive testing tools
- **Implementation**: Bulk cycles (up to 100) with auto-repair

**D9: Battle Logs**
- **Decision**: Action-by-action with textual descriptions
- **Rationale**: Rich combat narrative
- **Implementation**: 50+ message templates, timestamp ordering

**D10: Test Data**
- **Decision**: 100 test users with creative robot names
- **Rationale**: Realistic test environment
- **Implementation**: Practice Sword (free baseline weapon)

### Current System Capabilities

**Daily Cycle Workflow**:
1. Auto-repair all robots (optional, admin-triggered)
2. Run matchmaking (schedules matches for all tiers)
3. Execute battles (processes all scheduled matches)
4. Rebalance leagues (promotion/demotion every cycle)
5. Repeat

**Admin Testing**:
- Manual trigger for each step
- Bulk cycle execution (1-100 cycles)
- Auto-repair with cost simulation
- System statistics dashboard

**Player Experience**:
- View upcoming matches (24 hours before battle)
- View battle history (paginated, filterable)
- View league standings (all 6 tiers)
- Battle readiness warnings (3 locations)
- Detailed battle logs with combat messages

### Known Limitations & Edge Cases

**Handled**:
- ✅ Odd number of robots (bye-robot system)
- ✅ No suitable opponent (bye-robot fallback)
- ✅ Same-stable matching (deprioritized but allowed)
- ✅ Recent opponent matching (deprioritized but allowed)
- ✅ League instance imbalance (auto-balancing)
- ✅ Small league population (<10 robots, skip rebalancing)
- ✅ Tied league points (ELO tiebreaker)
- ✅ Robot promoted while scheduled (battles before rebalancing)

**Current Behavior**:
- Matchmaking processes tiers sequentially (Bronze → Champion)
- Scheduled match query is global (not filtered by tier/time)
- Battle readiness threshold is 75% HP (ensures no immediate yield)
- Rebalancing runs every cycle (checks eligibility each time)

---

## Background & Context

### Current State

**What Exists:**
- ✅ Complete database schema (Robot, Battle, User models)
- ✅ Robot creation and attribute upgrade system
- ✅ 23-attribute robot system with combat stats
- ✅ Weapon loadout system with 10 weapon types
- ✅ Battle stances (Offensive, Defensive, Balanced)
- ✅ Yield threshold system (surrender mechanics)
- ✅ League system in database (bronze/silver/gold/platinum/diamond/champion)
- ✅ ELO rating system in database (stored per robot)
- ✅ Battle model with complete tracking (damage, ELO changes, rewards)
- ✅ Facility system (14 facility types with upgrades)
- ✅ Training Academies that cap attribute upgrades
- ✅ Roster Expansion limiting number of robots per stable

**What's Missing:**
- ❌ Matchmaking algorithm and queue system
- ❌ Battle scheduling system (daily batch processing)
- ❌ League rebalancing logic (promotion/demotion)
- ❌ Match display UI (upcoming matches, historical matches)
- ❌ Manual battle trigger for prototype phase
- ❌ League standings/leaderboard display
- ❌ "First day" initialization logic
- ❌ Battle simulation engine (separate from matchmaking, but dependent)

### Design References

- **[ARCHITECTURE.md](ARCHITECTURE.md)**: Battle Simulation Architecture (lines 170-268) describes scheduled batch processing
- **[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)**: Complete schema with Battle and Robot models
- **[ROADMAP.md](ROADMAP.md)**: Phase 1 Milestone 4 and 5 (Matchmaking + Manual Battle Triggers)
- **[PRD_BATTLE_STANCES_AND_YIELD.md](PRD_BATTLE_STANCES_AND_YIELD.md)**: Related PRD format reference

### Why Matchmaking Matters

Matchmaking is the **core game loop connector** - without it, robots are just statistics on a page. It:
- Enables competitive progression through leagues
- Creates narrative through ongoing rivalries
- Drives economic decisions (repair costs, upgrades, weapon choices)
- Provides feedback on player strategy effectiveness
- Generates engagement through anticipation of results

The scheduled batch model allows:
- **Strategic depth**: Players plan ahead rather than react in real-time
- **Casual-friendly**: No requirement to be online at specific times
- **Scalability**: Process thousands of battles simultaneously
- **Determinism**: Same inputs always produce same outputs (for replay accuracy)

---

## Goals & Objectives

### Primary Goals

1. **Fair Matchmaking**: Pair robots of similar skill level (ELO-based with league constraints)
2. **Automated Scheduling**: Run battles in scheduled batches without manual intervention
3. **League Progression**: Promote/demote robots based on performance (league points)
4. **Transparent Display**: Show upcoming matches and historical results clearly
5. **First Day Solution**: Handle initial matches before historical data exists

### Success Metrics

- Matchmaking successfully pairs robots within ±150 ELO range (with fallbacks)
- Battles execute on schedule without errors
- League rebalancing occurs correctly (10% promotion, 10% demotion)
- League instances balanced (max 100 robots per instance)
- Players can view upcoming matches and recent battle history
- "First day" initialization seeds initial matches successfully
- No matchmaking deadlocks or infinite loops
- Battle readiness warnings display on all pages
- Bye-robot matches awarded correctly for odd numbers

### Non-Goals (Out of Scope for This PRD)

- ❌ Real-time battle processing (battles are batch processed, not real-time)
- ❌ Player-initiated matchmaking requests (all matchmaking is automated)
- ❌ Cross-league matchmaking (robots fight within their league only)
- ❌ Team battles (2v2, 3v3) - future phase
- ✅ Tournament system - separate PRD (PRD_TOURNAMENT_SYSTEM.MD)
- ❌ Custom match requests (challenge specific opponents) - future phase
- ❌ Battle replay visualization - future phase (but battle logs are stored)

---

## User Stories

### Epic: View Upcoming and Historical Matches

**US-1: View My Upcoming Matches**
- **As a** player with robots in leagues
- **I want to** see which opponents my robots will face in the next batch
- **So that** I can prepare my robots' configuration and understand upcoming challenges

**Acceptance Criteria:**
- Dashboard shows "Upcoming Matches" section with list of scheduled matches
- Each match shows: Robot name, Opponent robot name, Opponent ELO, League, Scheduled day and time
- If no matches scheduled yet, show "Waiting for matchmaking..." message
- Matches are sorted by scheduled time (soonest first)

**US-2: View My Battle History**
- **As a** player who has participated in battles
- **I want to** see results of my recent battles
- **So that** I can understand my robots' performance and make strategic adjustments

**Acceptance Criteria:**
- Battle history page shows list of completed battles (most recent first)
- Each battle result shows: Robot name, Opponent, Result (Win/Loss/Draw), ELO change, Damage dealt/taken, Date
- Clicking a battle opens detailed battle log
- Filter by robot, league, date range
- Pagination for large battle histories (20 results per page)

**Detailed Battle Log Format**:
- **Battle Header**:
  - Battle type (League Match / Tournament / etc.)
  - Date and time
  - Participants (robot names, owners, portraits)
  - League change indicator (if applicable - not shown for Tournaments)
- **Battle Result**:
  - Winner/Loser/Draw
  - Draw condition: Battle exceeds maximum time limit (~60 seconds of simulated combat)
  - ELO changes
  - Credits earned/spent
  - Repair costs
- **Turn-by-Turn Combat Log**:
  - Each turn shows: Attacker, Defender, Action, Damage, HP remaining
  - Critical hits highlighted
  - Special abilities/effects noted
- **Battle Statistics**:
  - Total damage dealt/taken
  - Critical hit count
  - Average damage per turn
  - Battle duration (turns/seconds)

**Battle Display Locations**:
- **Dashboard**: Displays last 5 matches for owned robots with links to detailed battle results
- **Robot Detail Page**: Displays entire match history for that robot in battle result format (with pagination)
- **Battle History Page**: Comprehensive view of all battles across all owned robots

**US-3: View League Standings**
- **As a** player competing in leagues
- **I want to** see current standings in my robots' leagues
- **So that** I understand where I rank and what's needed for promotion/demotion

**Acceptance Criteria:**
- League standings page shows robots in each league
- Display: Rank, Robot name, Owner, ELO, League points, Win/Loss record
- Show promotion zone (top X robots) and demotion zone (bottom Y robots) highlighted
- Separate tab/section for each league tier
- **All leagues visible**: Players can view all leagues in the system, not just leagues their robots are in
- **Own robot identification**: Player's own robots are clearly highlighted (distinct background color, badge, or border)
- Update after each battle batch completes

### Epic: Matchmaking Algorithm

**US-4: ELO-Based Matchmaking**
- **As the** matchmaking system
- **I need to** pair robots of similar skill level
- **So that** battles are competitive and fair

**Acceptance Criteria:**
- Robots matched within ±150 ELO when possible
- If no match within ±150 ELO, expand to ±300 ELO
- If still no match, pair with closest available opponent in league
- Never match robot against itself
- Never match robot against same opponent twice in same batch
- Soft deprioritize same-stable matchups (strongly in leagues, allow as last resort)
- Soft deprioritize recent opponents (last 5 matches)
- Odd-numbered robots matched with bye-robot (ELO 1000, full rewards)

**Design Decision**: Soft deprioritization prevents deadlocks in small leagues while maintaining fairness. Recent opponent tracking adds variety to matchups.

**US-5: League-Based Matchmaking**
- **As the** matchmaking system
- **I need to** respect league boundaries when pairing robots
- **So that** robots only face opponents in their league tier

**Acceptance Criteria:**
- Bronze robots only matched with Bronze robots
- Silver robots only matched with Silver robots  
- (Same for Gold, Platinum, Diamond, Champion)
- Robots in promotion/demotion zones prioritized for matches
- Support multiple league instances (bronze_1, bronze_2, etc.)
- Maximum 100 robots per instance
- Matchmaking prefers same instance (bronze_1 vs bronze_1)
- Falls back to adjacent instances if needed
- Auto-balancing when instances become imbalanced after promotions

**Design Decision**: 100 robots per instance with auto-balancing. When bronze_1 reaches 100, bronze_2 opens. New robots placed in instance with most free spots. After promotions/demotions, system balances instances if deviation >20 robots.

**US-6: Matchmaking Queue Management**
- **As the** matchmaking system
- **I need to** track which robots are eligible for matchmaking
- **So that** I can pair them efficiently

**Acceptance Criteria:**
- Queue includes all robots with battleReadiness ≥ 75%
- Battle readiness checks:
  - HP ≥ 75% of maximum
  - All required weapons equipped based on loadout type:
    - Single weapon: mainWeapon required
    - Dual-wield: mainWeapon AND offhandWeapon required
    - Weapon+shield: mainWeapon AND shield required
    - Two-handed: two-handed mainWeapon required
- Exclude robots currently scheduled for a match
- Exclude robots that have yielded/been destroyed until repaired
- Queue sorted by: Priority (league points) → ELO → Random tiebreaker
- Queue refreshes before each matchmaking cycle

**Battle Readiness Warnings**: Display on robot list page (icon/badge), robot detail page (banner at top), and dashboard (notification area). Multiple touchpoints ensure players see warnings.

### Epic: Battle Scheduling

**US-7: Daily Battle Schedule**
- **As the** game system
- **I need to** process battles in scheduled batches
- **So that** battles occur predictably and players can plan around them

**Acceptance Criteria:**
- Battles scheduled to run at specific times (e.g., 8 AM, 2 PM, 8 PM server time)
- Daily cycle sequence:
  1. Execute battles at scheduled time (e.g., 8:00 PM)
  2. Calculate rewards & update stats
  3. Rebalance leagues (promotion/demotion)
  4. Run matchmaking for next day (schedule for tomorrow 8:00 PM)
  5. Players have 24 hours to adjust strategy
- All scheduled battles execute simultaneously when batch time arrives
- Battle results posted immediately after completion
- Next matchmaking cycle begins after league rebalancing

**Design Decision**: 24-hour adjustment period gives players ample time to view matchups and configure robots. Matchmaking runs after rebalancing ensures robots are in correct leagues.

**US-8: Manual Battle Trigger (Prototype Phase)**
- **As a** developer testing the prototype
- **I want to** manually trigger battle processing
- **So that** I can test matchmaking without waiting for scheduled times

**Acceptance Criteria:**
- Separate admin dashboard/portal (not embedded in main app)
- Admin endpoints:
  - POST /api/admin/matchmaking/run - Trigger matchmaking
  - POST /api/admin/battles/run - Execute battles
  - POST /api/admin/leagues/rebalance - Rebalance leagues
  - POST /api/admin/cycles/bulk - Run multiple cycles (up to 100)
- Bulk cycle functionality:
  - Auto-repair all robots to 100% HP before each cycle
  - Deduct repair costs from user credits
  - Apply Repair Bay facility discounts
  - Log all repairs for analysis
- Endpoints protected by admin role authentication
- Logs all actions for debugging
- Returns summary of actions taken (matches created, battles processed, etc.)

**Design Decision**: Separate admin dashboard provides comprehensive testing tools without cluttering main app. Bulk cycle execution enables rapid balance testing with realistic cost simulation.

**Test Data Requirements**:
- 100 test users (test_user_001 to test_user_100, password: testpass123)
- 100 test robots (1 per user, creative thematic names)
- All attributes set to 1
- Single weapon loadout
- Practice Sword equipped (new weapon: base damage 5, 3sec cooldown, free, no bonuses)

### Epic: League Progression

**US-9: League Rebalancing**
- **As the** game system
- **I need to** promote/demote robots based on performance
- **So that** leagues remain balanced and competitive

**Acceptance Criteria:**
- League rebalancing runs after every cycle (battles complete)
- Promotion threshold: Top 10% of robots in league (minimum 5 cycles in current league)
- Demotion threshold: Bottom 10% of robots in league (minimum 5 cycles in current league)
- Champion league has no promotion (highest tier)
- Bronze league has no demotion (lowest tier)
- League points reset after promotion/demotion
- Cycles in current league counter resets after promotion/demotion
- ELO carries over between leagues
- Instance balancing after promotions/demotions if deviation >20 robots

**Design Decision**: 10% promotion/demotion provides slower, more stable league progression. Robots need minimum 5 cycles in their current league to be eligible, preventing premature tier changes and ensuring robots have established themselves in their tier before moving up or down.

**US-10: League Points Calculation**
- **As the** game system
- **I need to** award league points based on battle outcomes
- **So that** robots progress toward promotion or risk demotion

**Acceptance Criteria:**
- Win: +3 league points
- Loss: -1 league point (can't go below 0)
- Draw: +1 league point (occurs when battle exceeds max time, ~60 seconds)
- Bonus: +1 point for winning against higher ELO opponent (>200 difference)
- Penalty: -1 additional point for losing to much lower ELO opponent (>300 difference)
- League points displayed on robot detail page

**Draw Mechanics**: Battles end in draw when maximum battle time reached. Prevents infinite stalemates. Time limit adjustable for balance.

### Epic: First Day Initialization

**US-11: Initial League Seeding**
- **As the** game system
- **I need to** handle the first day when no historical data exists
- **So that** new robots can start competing immediately

**Acceptance Criteria:**
- All new robots start in Bronze league with 0 league points
- Initial ELO: 1200 (default)
- First matchmaking uses ELO only (no league points yet)
- Random pairings within ELO range for first batch
- After first battle, league points system activates normally
- "First day" flag in system to track initialization state

**US-12: First Match Protection**
- **As a** new player
- **I want** my first matches to be reasonably fair
- **So that** I don't get discouraged by overwhelming defeats

**Acceptance Criteria:**
- Robots with 0 total battles matched against other new robots when possible
- If no other new robots, match against lowest ELO veterans
- First 3 battles use stricter ELO matching (±100 instead of ±150)
- First-time players receive bonus credits after first battle (win or lose)

---

## Technical Requirements

### Database Schema Changes

For complete database information, see [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)

#### New Model: MatchmakingQueue (Optional - Can be managed in-memory)

```prisma
model MatchmakingQueue {
  id              Int      @id @default(autoincrement())
  robotId         Int      @unique
  leagueType      String   @db.VarChar(20)
  elo             Int
  leaguePoints    Int
  priority        Int                              // Higher = match sooner
  enqueuedAt      DateTime @default(now())
  
  @@index([leagueType, elo])
  @@index([priority])
}
```

#### New Model: ScheduledMatch

```prisma
model ScheduledMatch {
  id              Int      @id @default(autoincrement())
  robot1Id        Int
  robot2Id        Int
  leagueType      String   @db.VarChar(20)
  scheduledFor    DateTime                         // When battle will execute
  status          String   @default("scheduled") @db.VarChar(20)  // "scheduled", "completed", "cancelled"
  battleId        Int?                             // Links to Battle after completion
  createdAt       DateTime @default(now())
  
  robot1          Robot    @relation("ScheduledRobot1", fields: [robot1Id], references: [id])
  robot2          Robot    @relation("ScheduledRobot2", fields: [robot2Id], references: [id])
  battle          Battle?  @relation(fields: [battleId], references: [id])
  
  @@index([robot1Id])
  @@index([robot2Id])
  @@index([scheduledFor, status])
  @@index([status])
}
```

**Purpose**: Tracks matches scheduled but not yet executed. Allows players to see upcoming matches.

#### Updates to Existing Models

**Robot Model - Add Relations:**
```prisma
model Robot {
  // ... existing fields ...
  
  scheduledMatchesAsRobot1  ScheduledMatch[] @relation("ScheduledRobot1")
  scheduledMatchesAsRobot2  ScheduledMatch[] @relation("ScheduledRobot2")
}
```

**Battle Model - Add battleType and Relation:**
```prisma
model Battle {
  // ... existing fields ...
  
  battleType      String   @map("battle_type") @db.VarChar(20)  // "league", "tournament", "friendly"
  scheduledMatch  ScheduledMatch[]
}
```

**Robot Model - Update leagueId for instances:**
```prisma
model Robot {
  // ... existing fields ...
  
  currentLeague   String  @default("bronze") @db.VarChar(20)     // bronze/silver/gold/etc.
  leagueId        String  @default("bronze_1") @db.VarChar(30)   // Specific instance: bronze_1, bronze_2
  
  // ... relations ...
  scheduledMatchesAsRobot1  ScheduledMatch[] @relation("ScheduledRobot1")
  scheduledMatchesAsRobot2  ScheduledMatch[] @relation("ScheduledRobot2")
  
  @@index([currentLeague, leagueId])
}
```

**Bye-Robot Entry**: Special robot (id: -1) for odd-numbered matchmaking with ELO 1000, minimal stats, not owned by any user.

### API Endpoints

#### Public Endpoints (Authenticated Users)

**GET /api/matches/upcoming**
- Returns list of scheduled matches for current user's robots
- Response: Array of ScheduledMatch objects with robot details

**GET /api/matches/history**
- Returns paginated battle history for current user's robots
- Query params: `page`, `perPage`, `robotId` (optional), `leagueType` (optional)
- Response: Array of Battle objects with pagination metadata

**GET /api/leagues/:leagueType/standings**
- Returns current standings for specified league
- Query params: `page`, `perPage`
- Response: Array of Robot objects with rank, sorted by league points then ELO

**GET /api/robots/:id/matches**
- Returns upcoming and recent matches for specific robot
- Response: Object with `upcoming` and `history` arrays

#### Admin Endpoints (Prototype Phase)

**POST /api/admin/matchmaking/run**
- Manually trigger matchmaking for all leagues
- Protected: Admin role required
- Returns: Summary of matches created

**POST /api/admin/battles/run**
- Manually trigger battle execution for all scheduled matches
- Protected: Admin role required
- Returns: Summary of battles processed

**POST /api/admin/leagues/rebalance**
- Manually trigger league rebalancing (promotion/demotion)
- Protected: Admin role required
- Returns: Summary of robots promoted/demoted

**POST /api/admin/schedule/run-daily-cycle**
- Runs complete daily cycle: matchmaking → battles → rebalancing
- Protected: Admin role required
- Returns: Detailed summary of all operations

### Matchmaking Algorithm Specification

**Phase 1: Queue Building**
```typescript
// Pseudo-code
function buildMatchmakingQueue(leagueType: string): RobotQueueEntry[] {
  const eligibleRobots = await prisma.robot.findMany({
    where: {
      currentLeague: leagueType,
      battleReadiness: { gte: 50 },  // At least 50% HP
      // Exclude robots already scheduled for this batch
      scheduledMatchesAsRobot1: { none: { status: 'scheduled' } },
      scheduledMatchesAsRobot2: { none: { status: 'scheduled' } },
    },
    include: {
      user: true,
    },
  });
  
  // Sort by priority: league points desc, then ELO desc, then random
  return eligibleRobots
    .sort((a, b) => {
      if (a.leaguePoints !== b.leaguePoints) return b.leaguePoints - a.leaguePoints;
      if (a.elo !== b.elo) return b.elo - a.elo;
      return Math.random() - 0.5;  // Random tiebreaker
    });
}
```

**Phase 2: Pairing Algorithm**
```typescript
function pairRobots(queue: RobotQueueEntry[]): [RobotQueueEntry, RobotQueueEntry][] {
  const pairs: [RobotQueueEntry, RobotQueueEntry][] = [];
  const matched = new Set<number>();
  
  for (let i = 0; i < queue.length; i++) {
    if (matched.has(queue[i].id)) continue;
    
    const robot1 = queue[i];
    let opponent = null;
    
    // Try to find match within ±150 ELO
    for (let j = i + 1; j < queue.length; j++) {
      if (matched.has(queue[j].id)) continue;
      
      const robot2 = queue[j];
      
      // Skip if same owner (optional - discuss)
      if (robot1.userId === robot2.userId) continue;
      
      if (Math.abs(robot1.elo - robot2.elo) <= 150) {
        opponent = robot2;
        break;
      }
    }
    
    // If no match within ±150, try ±300
    if (!opponent) {
      for (let j = i + 1; j < queue.length; j++) {
        if (matched.has(queue[j].id)) continue;
        const robot2 = queue[j];
        if (robot1.userId === robot2.userId) continue;
        
        if (Math.abs(robot1.elo - robot2.elo) <= 300) {
          opponent = robot2;
          break;
        }
      }
    }
    
    // If still no match, pair with closest available
    if (!opponent) {
      for (let j = i + 1; j < queue.length; j++) {
        if (matched.has(queue[j].id)) continue;
        const robot2 = queue[j];
        if (robot1.userId === robot2.userId) continue;
        
        opponent = robot2;
        break;
      }
    }
    
    if (opponent) {
      pairs.push([robot1, opponent]);
      matched.add(robot1.id);
      matched.add(opponent.id);
    }
  }
  
  return pairs;
}
```

**Phase 3: Create Scheduled Matches**
```typescript
async function createScheduledMatches(
  pairs: [RobotQueueEntry, RobotQueueEntry][],
  scheduledFor: Date
): Promise<ScheduledMatch[]> {
  const matches = await Promise.all(
    pairs.map(([robot1, robot2]) =>
      prisma.scheduledMatch.create({
        data: {
          robot1Id: robot1.id,
          robot2Id: robot2.id,
          leagueType: robot1.currentLeague,
          scheduledFor: scheduledFor,
          status: 'scheduled',
        },
      })
    )
  );
  
  return matches;
}
```

### League Rebalancing Specification

**Promotion/Demotion Thresholds:**
- **Promotion**: Top 10% of robots in league (minimum 5 cycles in current league)
- **Demotion**: Bottom 10% of robots in league (minimum 5 cycles in current league)
- **Frequency**: Rebalancing runs every cycle to check eligibility
- **Alternative approach**: Fixed league points thresholds (e.g., 15 points = promotion, 0 points after 10 battles = demotion) - Not currently implemented

**League Tiers:**
```typescript
const LEAGUE_TIERS = [
  'bronze',    // Lowest tier (no demotion)
  'silver',
  'gold',
  'platinum',
  'diamond',
  'champion'   // Highest tier (no promotion)
];

const LEAGUE_HIERARCHY = {
  bronze: { promotion: 'silver', demotion: null },
  silver: { promotion: 'gold', demotion: 'bronze' },
  gold: { promotion: 'platinum', demotion: 'silver' },
  platinum: { promotion: 'diamond', demotion: 'gold' },
  diamond: { promotion: 'champion', demotion: 'platinum' },
  champion: { promotion: null, demotion: 'diamond' },
};
```

**Rebalancing Algorithm:**
```typescript
async function rebalanceLeague(leagueType: string): Promise<RebalanceResult> {
  const robots = await prisma.robot.findMany({
    where: {
      currentLeague: leagueType,
      cyclesInCurrentLeague: { gte: 5 },  // Minimum cycles in current league to be eligible
    },
    orderBy: [
      { leaguePoints: 'desc' },
      { elo: 'desc' },
    ],
  });
  
  const totalRobots = robots.length;
  const promotionCount = Math.floor(totalRobots * 0.10);  // Top 10%
  const demotionCount = Math.floor(totalRobots * 0.10);  // Bottom 10%
  
  const toPromote = robots.slice(0, promotionCount);
  const toDemote = robots.slice(-demotionCount);
  
  const promotedLeague = LEAGUE_HIERARCHY[leagueType].promotion;
  const demotedLeague = LEAGUE_HIERARCHY[leagueType].demotion;
  
  // Promote robots
  if (promotedLeague) {
    for (const robot of toPromote) {
      await prisma.robot.update({
        where: { id: robot.id },
        data: {
          currentLeague: promotedLeague,
          leagueId: `${promotedLeague}_1`,  // Default to instance 1
          leaguePoints: 0,  // Reset league points
          cyclesInCurrentLeague: 0,  // Reset cycles counter for new league
          // ELO carries over
        },
      });
    }
  }
  
  // Demote robots
  if (demotedLeague) {
    for (const robot of toDemote) {
      await prisma.robot.update({
        where: { id: robot.id },
        data: {
          currentLeague: demotedLeague,
          leagueId: `${demotedLeague}_1`,  // Default to instance 1
          leaguePoints: 0,  // Reset league points
          cyclesInCurrentLeague: 0,  // Reset cycles counter for new league
          // ELO carries over
        },
      });
    }
  }
  
  return {
    leagueType,
    totalRobots,
    promoted: toPromote.length,
    demoted: toDemote.length,
  };
}
```

### Daily Cycle Orchestration

**Normal Daily Flow:**
```typescript
async function runDailyCycle(): Promise<CycleResult> {
  console.log('[Daily Cycle] Starting...');
  
  // Step 1: Execute any pending scheduled battles
  console.log('[Daily Cycle] Step 1: Running battles...');
  const battleResults = await executePendingBattles();
  
  // Step 2: Rebalance leagues (promotion/demotion)
  console.log('[Daily Cycle] Step 2: Rebalancing leagues...');
  const rebalanceResults = await rebalanceAllLeagues();
  
  // Step 3: Run matchmaking for next cycle
  console.log('[Daily Cycle] Step 3: Running matchmaking...');
  const nextBattleTime = addHours(new Date(), 24);  // Next day
  const matchmakingResults = await runMatchmaking(nextBattleTime);
  
  console.log('[Daily Cycle] Complete!');
  
  return {
    battlesExecuted: battleResults.count,
    robotsPromoted: rebalanceResults.promoted,
    robotsDemoted: rebalanceResults.demoted,
    matchesScheduled: matchmakingResults.count,
  };
}
```

**First Day Initialization:**
```typescript
async function initializeFirstDay(): Promise<void> {
  console.log('[First Day] Initializing game state...');
  
  // Check if this is truly the first day (no battles exist)
  const battleCount = await prisma.battle.count();
  if (battleCount > 0) {
    console.log('[First Day] Not first day, skipping initialization.');
    return;
  }
  
  // All robots should be in Bronze league by default
  // Run initial matchmaking for tomorrow
  const firstBattleTime = addHours(new Date(), 24);
  await runMatchmaking(firstBattleTime);
  
  console.log('[First Day] Initialization complete!');
}
```

---

## User Experience Design

### Dashboard - Upcoming Matches Section

**Layout:**
```
┌───────────────────────────────────────────────────────────┐
│  UPCOMING MATCHES                                         │
│  Next battle cycle: January 31, 8:00 PM (in 4h 15m)       │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  Your Robot          vs      Opponent         League      │
│  ──────────────────────────────────────────────────────── │
│  BattleBot Alpha     vs      Iron Crusher     Bronze 1    │
│  ELO: 1250                   ELO: 1280                    │
│  Stance: Offensive           Owner: player3               │
│                                                           │
│  ──────────────────────────────────────────────────────── │
│  Steel Destroyer     vs      Thunder Bolt     Silver 5    │
│  ELO: 1450                   ELO: 1420                    │
│  Stance: Balanced            Owner: player5               │
│                                                           │
│  ──────────────────────────────────────────────────────── │
│  [No more upcoming matches]                               │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### Battle History Page

**Layout:**
```
┌───────────────────────────────────────────────────────────┐
│  BATTLE HISTORY                          [Filter ▼]       │
│                                                           │
│  Showing 20 of 142 battles                                │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  ✅ VICTORY                            January 30, 2:00 PM│
│  BattleBot Alpha  vs  Iron Crusher                        │
│  ELO: 1250 → 1265 (+15)                                   │
│  Damage: 120 dealt, 45 taken                              │
│  League: Bronze  |  Reward: ₡12,500                       │
│  [View Details]                                           │
│                                                           │
│  ──────────────────────────────────────────────────────── │
│                                                           │
│  ❌ DEFEAT                             January 30, 8:00 AM│
│  Steel Destroyer  vs  Plasma Titan                        │
│  ELO: 1450 → 1438 (-12)                                   │
│  Damage: 80 dealt, 150 taken                              │
│  League: Silver  |  Reward: ₡3,500                        │
│  [View Details]                                           │
│                                                           │
│  ──────────────────────────────────────────────────────── │
│                                                           │
│  [< Previous]  Page 1 of 8  [Next >]                      │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### League Standings Page

**Layout:**
```
┌───────────────────────────────────────────────────────────┐
│  LEAGUE STANDINGS                                         │
│  [Bronze] [Silver] [Gold] [Platinum] [Diamond] [Champion] │
├───────────────────────────────────────────────────────────┤
│  SILVER LEAGUE                                            │
│                                                           │
│  Rank  Robot Name        Owner      ELO    LP   W-L       │
│  ──────────────────────────────────────────────────────── │
│  🟢 1   Plasma Titan     player2    1510   18   12-3      │
│  🟢 2   Thunder Bolt     player5    1480   15   10-4      │
│  🟢 3   Steel Destroyer  player1    1450   14   9-5       │
│   4   Lightning Core   player4    1425   12   8-6         │
│   5   Battle Master    player3    1405   10   7-7         │
│   ...                                                     │
│  12   Iron Wall        player6    1320    4   4-10        │
│  🔴 13   Bronze Bot       player1    1280    2   3-11     │
│  🔴 14   Old Fighter     player3    1250    1   2-12      │
│                                                           │
│  🟢 Promotion Zone (Top 10%)  |  🔴 Demotion Zone (Bottom 10%)  │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

**Notes**: 
- All 6 league tiers shown in tabs
- Player's leagues highlighted (where they have active robots)
- Player's own robots: Bold name + background highlight + icon badge (🎯)
- Promotion zone: Green (🟢) - Top 10%
- Demotion zone: Red (🔴) - Bottom 10%

### Dashboard - Last 5 Matches per Robot

**Layout:**
```
┌───────────────────────────────────────────────────────────┐
│  MY ROBOTS & RECENT MATCHES                               │
├───────────────────────────────────────────────────────────┤
│  🤖 BattleBot Alpha ▼                    [Robot Details]  │
│     Recent Matches:                                       │
│     ✅ Won vs Iron Crusher      +15 ELO    2 hours ago   │
│     ❌ Lost vs Plasma Titan     -12 ELO    1 day ago     │
│     ✅ Won vs Thunder Bolt      +18 ELO    2 days ago    │
│     🤝 Draw vs Steel Guard       +5 ELO    3 days ago    │
│     ✅ Won vs Bronze Warrior    +14 ELO    4 days ago    │
│  ──────────────────────────────────────────────────────── │
│  🤖 Steel Destroyer ▼                    [Robot Details]  │
│     Recent Matches:                                       │
│     ✅ Won vs Lightning Core    +16 ELO    1 hour ago    │
│     ✅ Won vs Battle Master     +15 ELO    1 day ago     │
│     ... (3 more matches)                                  │
└───────────────────────────────────────────────────────────┘
```

**Features**:
- Grouped per robot (expandable/collapsible)
- Last 5 matches per robot
- Click match to view detailed battle log
- Visual indicators: Win ✅, Loss ❌, Draw 🤝

### Robot Detail Page - Match History Tab

**New Tab Structure:**
```
ROBOT DETAIL PAGE
[Overview] [Attributes] [Loadout] [Match History] ← NEW TAB
```

**Match History Tab Content**:
- Full paginated battle history for this robot
- Same format as main Battle History page
- Filters: date range, result type (win/loss/draw)
- Shows 20 matches per page
- Click any match to see detailed battle log

### Battle Result Display - Promotion/Demotion Badges

**For League Matches:**
```
┌─────────────────────────────────────────────────┐
│  ✅ VICTORY                 January 30, 2:00 PM │
│  BattleBot Alpha  vs  Iron Crusher              │
│  Battle Type: League Match                      │
│  ELO: 1250 → 1265 (+15)                        │
│  Damage: 120 dealt, 45 taken                    │
│  League: Bronze  |  Reward: ₡12,500             │
│  🏆 PROMOTED TO SILVER!                         │  ← Badge
│  [View Detailed Battle Log]                     │
└─────────────────────────────────────────────────┘
```

**Badge Types**:
- 🏆 PROMOTED TO [TIER]! (green)
- ⬇️ DEMOTED TO [TIER] (red)
- No badge if no tier change
- Only shown for league matches (not tournaments)

### Battle Readiness Warnings

**Robot List Page**:
```
MY ROBOTS
├─ BattleBot Alpha  ✅ Ready for Battle
├─ Steel Destroyer  ⚠️ Not Ready (Low HP - 45%)      ← Warning badge
└─ Iron Crusher     ⚠️ Not Ready (No Weapon Equipped) ← Warning badge
```

**Robot Detail Page - Banner**:
```
┌─────────────────────────────────────────────────────┐
│  ⚠️ WARNING: Robot Not Battle Ready                 │
│  Issues:                                            │
│  • HP below 75% (current: 45%) - Repair needed     │
│  • No main weapon equipped - Equip weapon          │
│  [Repair Now ₡15,000] [Go to Weapons]              │
└─────────────────────────────────────────────────────┘
```

**Dashboard - Notifications**:
```
NOTIFICATIONS
⚠️ 2 robots not battle ready and will miss next matchmaking
   → Steel Destroyer (HP: 45%, needs repair)
   → Iron Crusher (No weapon equipped)
[View Robots] [Repair All ₡25,000]
```

---

## Battle Log System

### Action-by-Action Combat Log

Battle logs use action-by-action format with timestamps and textual descriptions. See [COMBAT_MESSAGES.md](COMBAT_MESSAGES.md) for complete message catalog.

**Event Categories**:
1. Battle initialization (start, stances)
2. Attack actions (hit, miss, critical, counter)
3. Shield events (break, regeneration, absorption)
4. Special weapon properties (armor piercing, burst fire, etc.)
5. Yield/surrender events
6. Destruction/KO events
7. Battle status updates
8. Draw conditions (max time reached)
9. Victory types (dominant, close, by yield, by destruction)
10. Battle statistics summary

**Example Battle Log Entry**:
```
[2.5s] ⚡ BattleBot Alpha's Laser Rifle penetrates Iron Crusher's shield! 
       30 shield damage, 15 hull damage!
       
[5.0s] 💥 Iron Crusher strikes BattleBot Alpha with Power Sword for 28 damage!

[7.5s] ❌ BattleBot Alpha's counter with Laser Rifle fails to connect!

[45.2s] 🏳️ Iron Crusher yields! Battle ends with BattleBot Alpha victorious!
```

**Battle Log JSON Structure**:
```json
{
  "battleId": 123,
  "events": [
    {
      "timestamp": 2.5,
      "type": "attack",
      "attacker": "robot1",
      "defender": "robot2",
      "weapon": "Laser Rifle",
      "damage": 45,
      "shieldDamage": 30,
      "hpDamage": 15,
      "critical": false,
      "message": "⚡ BattleBot Alpha's Laser Rifle penetrates..."
    }
  ]
}
```

See [COMBAT_MESSAGES.md](COMBAT_MESSAGES.md) for 100+ message templates and complete implementation details.

---

## Implementation Plan

**NOTE**: Updated estimates based on finalized decisions. See [MATCHMAKING_IMPLEMENTATION.md](MATCHMAKING_IMPLEMENTATION.md) for detailed technical specifications.

### Phase 1: Database & Core Models

**Status**: Database schema exists, additions needed

**Tasks:**
- [x] Robot model with ELO, league fields (already exists)
- [x] Battle model with complete tracking (already exists)
- [ ] Add battleType field to Battle model
- [ ] Update Robot leagueId handling for instances
- [ ] Add ScheduledMatch model to schema
- [ ] Add robot relations for scheduled matches
- [ ] Create Bye-Robot entry (id: -1, ELO 1000)
- [ ] Add Practice Sword weapon (free, 3sec cooldown, 5 damage)
- [ ] Generate 100 test users with creative robot names
- [ ] Run Prisma migrations
- [ ] Update seed script

### Phase 2: League Instance System

**Tasks:**
- [ ] Implement instance creation logic (max 100 per instance)
- [ ] Robot placement algorithm (find instance with most free spots)
- [ ] Promotion/demotion balancing across instances
- [ ] Instance preference in matchmaking (same instance first)
- [ ] Auto-balancing when deviation >20 robots
- [ ] Unit tests for instance management

### Phase 3: Matchmaking Algorithm 

**Tasks:**
- [ ] Build queue with comprehensive battle readiness checks (HP + weapons)
- [ ] ELO-based pairing within league instances
- [ ] Recent opponent tracking (last 5 matches)
- [ ] Same-stable deprioritization logic
- [ ] Bye-robot matching for odd numbers
- [ ] Unit tests for pairing algorithm

### Phase 4: Battle Readiness System 

**Tasks:**
- [ ] Comprehensive weapon validation by loadout type
- [ ] HP threshold checks (≥75%)
- [ ] API endpoints for readiness status
- [ ] Warning system implementation
- [ ] Display warnings on robot list, detail, dashboard
- [ ] Unit tests

### Phase 5: Battle Execution

**Tasks:**
- [ ] Battle orchestrator service
- [ ] Execute from scheduled matches
- [ ] Bye-robot battle simulation (predictable, easy win)
- [ ] Update robot stats (ELO, league points, damage)
- [ ] Award rewards (with bye-match compensation)
- [ ] Integration tests

### Phase 6: League Rebalancing

**Tasks:**
- [ ] Promotion/demotion algorithm (10% thresholds)
- [ ] Instance balancing after tier changes
- [ ] League point reset
- [ ] Minimum 5 battles eligibility check
- [ ] Edge case handling
- [ ] Tests

### Phase 7: Admin Dashboard

**Tasks:**
- [ ] Separate admin portal setup
- [ ] Authentication and authorization
- [ ] Matchmaking trigger UI
- [ ] Battle execution UI
- [ ] Bulk cycle execution (up to 100 cycles)
- [ ] Auto-repair controls and monitoring
- [ ] System monitoring dashboard
- [ ] API endpoint implementation

### Phase 8: Public API Endpoints 

**Tasks:**
- [ ] Implement GET /api/matches/upcoming
- [ ] Implement GET /api/matches/history (with pagination)
- [ ] Implement GET /api/leagues/:tier/standings (with instance support)
- [ ] Implement GET /api/robots/:id/matches
- [ ] Battle readiness endpoints
- [ ] Add input validation and error handling
- [ ] Write integration tests for all endpoints

### Phase 9: Frontend UI

**Tasks:**
- [ ] Dashboard: Last 5 matches per robot (grouped, expandable)
- [ ] Dashboard: Upcoming matches section
- [ ] Robot Detail: New Match History tab
- [ ] BattleHistory page with pagination and filters
- [ ] LeagueStandings page: All 6 tiers in tabs
- [ ] LeagueStandings: Player robot highlighting (bold + background + icon)
- [ ] Battle results: Promotion/Demotion badges
- [ ] Battle readiness: Warnings on all pages
- [ ] Battle detail: Action-by-action log display
- [ ] Add loading states and error handling

### Phase 10: Battle Log System

**Tasks:**
- [ ] Implement combat message generation (see COMBAT_MESSAGES.md)
- [ ] Action-by-action logging with timestamps
- [ ] Textual descriptions for all event types
- [ ] JSON structure implementation
- [ ] Message selection algorithm
- [ ] Detail view UI for battle logs

### Phase 11: Testing & Polish

**Tasks:**
- [ ] Test first day initialization
- [ ] Test matchmaking with various robot counts
- [ ] Test league instance balancing scenarios
- [ ] Test bye-robot matching
- [ ] Test scheduled match execution
- [ ] Load test with 100 test users
- [ ] Integration test complete daily cycle
- [ ] Edge case testing
- [ ] UI polish

---

## Edge Cases & Considerations

### Matchmaking Edge Cases

1. **Odd Number of Robots in Queue**
   - **Solution**: Match with bye-robot (special robot id: -1, ELO 1000)
   - Bye-robot has minimal stats, predictable behavior
   - Player robot gets easy win
   - Full battle rewards awarded (compensates for low ELO gain)
   - Bye-robot never gains/loses ELO

2. **No Suitable Opponent**
   - **Solution**: Robot waits for next cycle, priority increases
   - Log unmatched robots for monitoring
   - Expand ELO range on subsequent attempts

3. **Same Owner Matching**
   - **Decision**: Strongly deprioritize in leagues (allow as last resort)
   - Tournament mode (future): No restriction
   - Rationale: Small player base in prototype, tournaments need flexibility

4. **Recent Opponent Matching**
   - **Solution**: Soft deprioritize last 5 opponents
   - Track recent matches in matchmaking queue
   - Try other opponents first, allow if no alternatives

5. **League Instance Imbalance**
   - **Solution**: Auto-balance when deviation >20 robots
   - Redistribute robots proportionally
   - Run after each promotion/demotion cycle
   - New robots placed in instance with most free spots

4. **Robots Scheduled But Not Battle-Ready**
   - Solution: Cancel scheduled match if robot HP drops below 50%
   - Notify player of cancellation

### League Rebalancing Edge Cases

1. **Small League Population**
   - If league has <5 robots, skip promotion/demotion for that league
   - Prevents empty leagues

2. **Tied League Points**
   - Tiebreaker: ELO → Total battles → Random
   - Document tiebreaker rules clearly

3. **Robot Promoted/Demoted While Scheduled Match Pending**
   - Solution: Complete scheduled matches before rebalancing
   - Order: Battles → Rebalancing → Next cycle matchmaking

### First Day Considerations

1. **All Robots Are New**
   - Use pure ELO-based matching (all start at 1200)
   - First cycle may have very mismatched fights
   - Consider: Initial randomness adds excitement

2. **No League Points History**
   - League points start at 0 for all robots
   - First rebalancing (after ~5 battles) establishes rankings

3. **Testing First Day Logic**
   - Create seeded scenario in development
   - Test with fresh database state
   - Document initialization procedure

### Scheduled Battle Execution

1. **System Downtime During Scheduled Time**
   - Solution: Catch-up processing on restart
   - Execute any missed scheduled battles immediately
   - Log missed executions for monitoring

2. **Database Transaction Failures**
   - Solution: Rollback incomplete battle results
   - Retry failed battles (max 3 attempts)
   - Mark permanently failed matches for investigation

3. **Concurrent Execution**
   - Use database locks to prevent duplicate processing
   - Ensure one daily cycle runs at a time
   - Queue subsequent requests if cycle in progress

---

## Confirmed Decisions

### Core Design Decisions

**D1: Robots from Same Stable**
- **Decision**: Strongly deprioritize in leagues (allow as last resort)
- **Tournament mode** (future): No restriction
- **Rationale**: Flexible matchmaking for small player base, tournaments need less restriction

**D2: Battles Per Day Per Robot**
- **Decision**: 1 League battle per day per robot 
- **Rationale**: Simple, manageable for Phase 1, easy to balance

**D3: League Promotion/Demotion Percentage**
- **Decision**: 10% promoted, 10% demoted
- **Minimum eligibility**: 5 battles completed
- **Rationale**: Slower, more stable progression

**D4: League Instance Size**
- **Decision**: Maximum 100 robots per instance
- **Auto-balancing**: When deviation >20 robots after promotions
- **Rationale**: Manageable size, promotes familiarity within instance

**D5: Draw Mechanics**
- **Decision**: Battles end in draw when max time reached (~60 seconds, adjustable)
- **League points**: +1 for draw
- **Rationale**: Prevents infinite stalemates, time limit tunable for balance

**D6: Odd Robot Handling**
- **Decision**: Match with bye-robot (special robot, ELO 1000)
- **Rewards**: Full rewards to compensate for low ELO gain
- **Rationale**: Every robot gets to fight, no sitting out

**D7: Recent Opponent Avoidance**
- **Decision**: Soft deprioritize last 5 opponents
- **Rationale**: Adds match variety, avoids deadlocks

**D8: Battle Readiness**
- **Decision**: HP ≥75% AND all required weapons equipped
- **Warnings**: Display on robot list, detail page, and dashboard
- **Rationale**: Prevents incomplete loadouts, ensures fair fights

**D9: Matchmaking Timing**
- **Decision**: 24-hour cycle (matchmaking after battles → 24h adjustment → battles)
- **Rationale**: Ample time for strategy adjustment

**D10: Admin Portal**
- **Decision**: Separate admin dashboard (not embedded in main app)
- **Bulk testing**: Up to 100 cycles with auto-repair
- **Rationale**: Comprehensive testing tools, doesn't clutter main app

**D11: Battle Log Format**
- **Decision**: Action-by-action with timestamps and textual descriptions
- **Message catalog**: 100+ templates (see COMBAT_MESSAGES.md)
- **Rationale**: Rich combat narrative, enables detailed post-battle analysis

**D12: Test Data**
- **Decision**: 100 test users with creative thematic robot names
- **Practice Sword**: Free weapon, 3sec cooldown, 5 damage, no bonuses
- **Rationale**: Realistic test environment with baseline weapon

### Resolved Questions
- **Option C**: Dynamic based on league tier (champion = 1/day, bronze = 3/day)
### Resolved Questions

All critical questions have been answered and documented:
- Same-stable matching: Strongly deprioritize ✅
- Battles per day: 1 per robot ✅
- Unmatched robots: Bye-robot system ✅
- League instances: 100 per instance with auto-balancing ✅
- Scheduled times: Flexible admin triggers for prototype ✅
- Draw mechanics: Max battle time ✅
- Promotion/demotion: 10% thresholds ✅
- Battle readiness: HP + weapons ✅
- Battle log: Action-by-action textual ✅

---

## Success Criteria & Acceptance

### Functional Requirements

- [x] Database schema includes ScheduledMatch model
- [ ] Matchmaking algorithm pairs robots within ELO constraints
- [ ] League rebalancing promotes/demotes robots correctly
- [ ] Admin endpoints allow manual triggering of all processes
- [ ] Public endpoints display upcoming and historical matches
- [ ] UI shows upcoming matches on dashboard
- [ ] UI shows battle history with pagination
- [ ] UI shows league standings with promotion/demotion zones

### Quality Requirements

- [ ] Unit tests cover matchmaking logic (>80% coverage)
- [ ] Integration tests cover complete daily cycle
- [ ] Edge cases handled gracefully (odd numbers, no opponents)
- [ ] Performance: Matchmaking completes in <10 seconds for 100 robots
- [ ] Performance: Battle execution completes in <5 seconds per battle
- [ ] No infinite loops or deadlocks in matchmaking
- [ ] Clear error messages and logging for debugging

### User Experience Requirements

- [ ] Players understand when next battles occur
- [ ] Players can see who they're matched against before battles
- [ ] Battle history is easy to navigate and filter
- [ ] League standings are clear and understandable
- [ ] System feels fair and transparent

---

## Dependencies & Risks

### Dependencies

**Blocker:** Battle Simulation Engine
- Matchmaking can be implemented without battle engine
- But battles can't execute until simulation engine exists
- Recommendation: Implement matchmaking first, mock battles initially

**Dependency:** Robot Configuration System
- Battle stances, yield thresholds must be implemented
- Matchmaking doesn't need these, but battles do

### Risks & Mitigation

**Risk 1: Matchmaking Too Slow at Scale**
- Mitigation: Profile and optimize algorithm
- Mitigation: Consider caching eligible robot list
- Fallback: Simplify matching criteria

**Risk 2: Unfair Matches (Mismatched ELO)**
- Mitigation: Strictly enforce ELO ranges
- Mitigation: Log all matchups for analysis
- Fallback: Adjust ELO ranges based on feedback

**Risk 3: League Imbalance**
- Mitigation: Monitor league populations
- Mitigation: Adjust promotion/demotion thresholds dynamically
- Fallback: Manual rebalancing by admin

**Risk 4: First Day Experience Is Poor**
- Mitigation: Test first day scenario extensively
- Mitigation: Consider AI bots for initial population
- Fallback: Manual seeding of initial matchups

---

## Monitoring & Analytics

### Key Metrics to Track

**Matchmaking Metrics:**
- Average time to find match
- Percentage of robots matched per cycle
- Average ELO difference in matches
- Same-owner matchups (should be rare)

**Battle Execution Metrics:**
- Battles completed per cycle
- Average battle duration
- Battle success/failure rate
- Transaction rollback rate

**League Metrics:**
- Robots per league tier
- Promotion rate per league
- Demotion rate per league
- Average battles per robot per week

**Player Engagement Metrics:**
- Daily active robots (participating in battles)
- Battle history page views
- Upcoming matches page views
- Average time between battles for robot

### Logging Strategy

**Info Level:**
- Daily cycle start/completion
- Matchmaking summary (X robots matched, Y unmatched)
- Battle execution summary (X battles completed)
- League rebalancing summary (X promoted, Y demoted)

**Debug Level:**
- Individual match pairings
- Individual battle results
- Robot state changes

**Error Level:**
- Matchmaking failures
- Battle execution failures
- Database transaction failures
- Unexpected states (e.g., robot scheduled twice)

---

## Future Enhancements

### Short-Term Optimizations

**1. Matchmaking Performance**
- **Current**: Sequential tier processing (Bronze → Champion)
- **Improvement**: Parallel tier processing for faster execution
- **Benefit**: Reduce total matchmaking time from ~10s to ~3s
- **Complexity**: Medium (requires careful transaction handling)

**2. Scheduled Match Query Optimization**
- **Current**: Global query for scheduled matches (no tier/time filter)
- **Improvement**: Add tier and scheduledFor filters
- **Benefit**: Better query performance, prevents theoretical cross-tier issues
- **Complexity**: Low (simple WHERE clause addition)

**3. Instance Balancing Algorithm**
- **Current**: Rebalance when deviation >20 robots
- **Improvement**: Predictive balancing (anticipate promotions/demotions)
- **Benefit**: Smoother instance populations over time
- **Complexity**: Medium (requires historical data analysis)

#### Medium-Term Features

**4. Revenge Matches**
- Allow players to challenge specific opponents who beat them
- Separate from league matches (doesn't affect standings)
- Costs credits to initiate
- Opponent must accept challenge

**5. Match Predictions**
- AI predicts battle outcomes based on stats
- Display confidence percentage
- Track prediction accuracy over time
- Educational tool for players

**6. Advanced Battle Readiness**
- Weapon durability system (weapons degrade over time)
- Ammunition tracking for ranged weapons
- Maintenance requirements (periodic servicing)
- More strategic resource management

**7. League History Tracking**
- Track robot's journey through leagues over time
- Display promotion/demotion history
- Show peak ELO and league tier
- Career statistics dashboard

**8. Spectator Mode**
- Watch other players' battles in real-time
- Replay past battles with visualization
- Commentary system (AI-generated or player-written)
- Learning tool for new players

#### Long-Term Enhancements

**9. Team Battles**
- 2v2, 3v3 synchronized matchmaking
- Team composition strategies
- Shared rewards and rankings
- Guild/stable team competitions

**10. Dynamic League Seasons**
- Periodic league resets (e.g., every 3 months)
- Season rewards based on final standings
- Prestige system (carry over between seasons)
- Fresh start for new players

**11. Advanced Matchmaking Preferences**
- Player-set preferences (avoid certain opponents, preferred times)
- Opt-in to cross-league exhibition matches
- Training matches (no ELO/league point changes)
- Custom rule sets for friendly matches

**12. AI-Driven Matchmaking Optimization**
- Machine learning to predict match quality
- Dynamic ELO K-factor based on consistency
- Adaptive matching criteria based on queue size
- Personalized matchmaking for player retention

**13. Cross-League Exhibition Matches**
- Special events where different leagues can fight
- No league point changes, ELO changes reduced
- Showcase top robots from each tier
- Community engagement events

### Improvements NOT Recommended

**1. Lower Battle Readiness Threshold**
- **Proposal**: Reduce from 75% to 50% HP
- **Reason Against**: Robots might yield immediately (if HP ≤ yield threshold)
- **Current Solution**: 75% + yield check prevents this issue
- **Verdict**: Keep current system

**2. Increase Promotion/Demotion Percentage**
- **Proposal**: Increase from 10% to 20%
- **Reason Against**: Too volatile, robots change tiers too quickly
- **Current Solution**: 10% provides stable progression
- **Verdict**: Keep current system

**3. Allow Same-Stable Matching Without Penalty**
- **Proposal**: Remove same-stable deprioritization
- **Reason Against**: Reduces competitive variety
- **Current Solution**: Strongly deprioritize but allow as last resort
- **Verdict**: Keep current system

**4. Real-Time Battle Processing**
- **Proposal**: Process battles immediately when matched
- **Reason Against**: Removes strategic planning phase, increases server load
- **Current Solution**: Scheduled batch processing works well
- **Verdict**: Keep current system

---

## Testing & Validation

### Test Coverage (Implemented)

**Unit Tests**: 53 passing
- League instance service: 12 tests
- Matchmaking service: 13 tests (includes battle readiness validation)
- Battle orchestrator: 7 tests (includes kill tracking)
- League rebalancing: 11 tests (includes double-promotion prevention)
- Combat messages: 10 tests

**Integration Tests**: 4 tests (require database)
- Complete daily cycle (full workflow test)
- Bye-robot handling (odd number scenarios)
- Edge cases (no battle-ready robots)
- Data consistency validation

**Test Scripts** (prototype/backend/scripts/):
- `testMatchmaking.ts` - Matchmaking algorithm
- `executeBattles.js` - Battle execution
- `testLeagueRebalancing.js` - Promotion/demotion
- `testAdminAPI.js` - All admin endpoints
- `showDatabaseSummary.js` - Database state
- `testBattleExecution.js` - Battle simulation

### How to Test the System

#### Complete Daily Cycle Test

**Step 1: Check Initial State**
```bash
cd prototype/backend
node scripts/showDatabaseSummary.js
# Expected: 101 robots (100 test + 1 bye-robot), 100% battle-ready
```

**Step 2: Login as Admin**
```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}' | \
  jq -r '.token')
```

**Step 3: Optional - Repair All Robots**
```bash
curl -X POST http://localhost:3001/api/admin/repair/all \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"deductCosts": false}'
# Expected: {"robotsRepaired": 100, "totalCost": 0}
```

**Step 4: Run Matchmaking**
```bash
curl -X POST http://localhost:3001/api/admin/matchmaking/run \
  -H "Authorization: Bearer $TOKEN"
# Expected: {"matchesCreated": 50, "scheduledFor": "..."}
```

**Step 5: Execute Battles**
```bash
curl -X POST http://localhost:3001/api/admin/battles/run \
  -H "Authorization: Bearer $TOKEN"
# Expected: {"totalBattles": 50, "successfulBattles": 50}
```

**Step 6: Rebalance Leagues**
```bash
curl -X POST http://localhost:3001/api/admin/leagues/rebalance \
  -H "Authorization: Bearer $TOKEN"
# Expected: {"totalPromoted": 0, "totalDemoted": 0} (first cycle)
```

#### Bulk Cycle Testing

**Run 10 Complete Cycles**:
```bash
curl -X POST http://localhost:3001/api/admin/cycles/bulk \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cycles": 10, "autoRepair": true}'
# Expected: {"cyclesCompleted": 10, "totalDuration": "~25s"}
```

#### Frontend UI Testing

**Test Dashboard**:
1. Login as admin
2. Go to http://localhost:3000/dashboard
3. Verify:
   - ✅ "Upcoming Matches" section shows scheduled matches
   - ✅ "Recent Matches" section shows last 5 battles
   - ✅ Battle readiness warnings appear if robots have low HP

**Test Battle History**:
1. Go to http://localhost:3000/battle-history
2. Verify:
   - ✅ List of battles with pagination
   - ✅ Win/loss indicators (green/red)
   - ✅ ELO changes shown (+16 or -16)
   - ✅ HP status displayed
   - ✅ Rewards shown in credits

**Test League Standings**:
1. Go to http://localhost:3000/league-standings
2. Verify:
   - ✅ Tabs for all 6 tiers
   - ✅ Robot rankings with ELO, league points, W-L record
   - ✅ Your robots highlighted
   - ✅ Pagination working

**Test Admin Portal**:
1. Login as admin
2. Click ⚡ Admin link (yellow text, right side of nav)
3. Test each button:
   - ✅ Refresh Stats
   - ✅ Auto-Repair All Robots
   - ✅ Run Matchmaking
   - ✅ Execute Battles
   - ✅ Rebalance Leagues
   - ✅ Run Bulk Cycles (try 3 cycles)

### Edge Cases Tested

**Handled Correctly**:
- ✅ Odd number of robots (bye-robot match)
- ✅ No suitable opponent (bye-robot fallback)
- ✅ Same-stable matching (deprioritized, allowed as last resort)
- ✅ Recent opponent matching (deprioritized, allowed as last resort)
- ✅ League instance imbalance (auto-balancing when deviation >20)
- ✅ Small league population (<10 robots, skip rebalancing)
- ✅ Tied league points (ELO tiebreaker)
- ✅ Robot promoted while scheduled (battles execute before rebalancing)
- ✅ First day initialization (all robots start in Bronze)
- ✅ Database transaction failures (rollback incomplete battles)

### Performance Benchmarks

**Achieved Performance** (development machine):

| Operation | Target | Achieved | Status |
|-----------|--------|----------|--------|
| Matchmaking (100 robots) | <5s | <2s | ✅ |
| Battle execution (50 battles) | <30s | <5s | ✅ |
| League rebalancing | <5s | <1s | ✅ |
| API response time | <200ms | <100ms | ✅ |
| Complete cycle | <40s | <10s | ✅ |
| 10 bulk cycles | <400s | <100s | ✅ |

### Troubleshooting Common Issues

**Issue: No matches being created**
- **Cause**: Robots have HP <75% or HP ≤ yield threshold
- **Solution**: Run auto-repair first
- **Check**: `node scripts/showDatabaseSummary.js`

**Issue: Battles not executing**
- **Cause**: No scheduled matches with due time
- **Solution**: Run matchmaking first
- **Check**: Query ScheduledMatch table

**Issue: League rebalancing does nothing**
- **Cause**: Robots need ≥5 cycles in current league
- **Solution**: Run more cycles (use bulk cycle feature)
- **Check**: Robot cyclesInCurrentLeague field

**Issue: 401 Unauthorized on API calls**
- **Cause**: JWT token expired or invalid
- **Solution**: Get fresh token (login again)

**Issue: 403 Forbidden on admin endpoints**
- **Cause**: Logged in as regular user, not admin
- **Solution**: Logout and login as admin

### Test User Accounts

**Admin Account**:
- Username: `admin`
- Password: `admin123`
- Role: admin
- Currency: ₡10,000,000

**Special Account**:
- Username: `bye-robot-user`
- Robot: "Bye Robot" (id: -1, ELO 1000)
- Purpose: Odd-number matchmaking

---

## API Reference

### Admin Endpoints

All admin endpoints require JWT authentication with admin role.

#### Trigger Matchmaking
```http
POST /api/admin/matchmaking/run
Authorization: Bearer <admin-jwt>
Content-Type: application/json

{
  "scheduledFor": "2026-02-01T12:00:00Z"  // Optional
}

Response:
{
  "matchesCreated": 50,
  "scheduledFor": "2026-02-01T12:00:00Z",
  "timestamp": "2026-01-31T10:00:00Z"
}
```

#### Execute Battles
```http
POST /api/admin/battles/run
Authorization: Bearer <admin-jwt>
Content-Type: application/json

{
  "scheduledFor": "2026-02-01T12:00:00Z"  // Optional
}

Response:
{
  "totalBattles": 50,
  "successfulBattles": 50,
  "failedBattles": 0,
  "byeBattles": 0,
  "errors": []
}
```

#### Rebalance Leagues
```http
POST /api/admin/leagues/rebalance
Authorization: Bearer <admin-jwt>

Response:
{
  "summary": {
    "totalPromoted": 10,
    "totalDemoted": 10,
    "message": "Rebalancing complete"
  },
  "details": [
    {
      "tier": "bronze",
      "promoted": 2,
      "demoted": 0
    },
    ...
  ]
}
```

#### Auto-Repair All Robots
```http
POST /api/admin/repair/all
Authorization: Bearer <admin-jwt>
Content-Type: application/json

{
  "deductCosts": false  // Optional, default: false
}

Response:
{
  "robotsRepaired": 100,
  "totalCost": 0,
  "costsDeducted": false,
  "repairs": [
    {
      "robotId": 1,
      "robotName": "Iron Gladiator",
      "hpBefore": 5,
      "hpAfter": 10,
      "cost": 0
    },
    ...
  ]
}
```

#### Run Bulk Cycles
```http
POST /api/admin/cycles/bulk
Authorization: Bearer <admin-jwt>
Content-Type: application/json

{
  "cycles": 10,
  "autoRepair": true
}

Response:
{
  "cyclesCompleted": 10,
  "results": [
    {
      "cycle": 1,
      "matchmakingSuccess": true,
      "matchesCreated": 50,
      "battlesSuccess": true,
      "battlesExecuted": 50,
      "rebalancingSuccess": true,
      "promotions": 10,
      "demotions": 10,
      "duration": "2.5s"
    },
    ...
  ],
  "totalDuration": "25s",
  "averageCycleDuration": "2.5s"
}
```

#### Get System Statistics
```http
GET /api/admin/stats
Authorization: Bearer <admin-jwt>

Response:
{
  "robots": {
    "total": 101,
    "battleReady": 100,
    "byTier": {
      "bronze": 80,
      "silver": 15,
      "gold": 5,
      "platinum": 1,
      "diamond": 0,
      "champion": 0
    }
  },
  "matches": {
    "scheduled": 50,
    "completed": 1250
  },
  "battles": {
    "last24Hours": 50,
    "total": 1250
  }
}
```

### Public Endpoints

All public endpoints require JWT authentication.

#### Get Upcoming Matches
```http
GET /api/matches/upcoming
Authorization: Bearer <user-jwt>

Response:
{
  "matches": [
    {
      "matchId": 123,
      "scheduledFor": "2026-02-01T12:00:00Z",
      "leagueType": "bronze",
      "userRobot": {
        "id": 1,
        "name": "Iron Gladiator",
        "currentHP": 10,
        "maxHP": 10,
        "elo": 1200
      },
      "opponent": {
        "id": 2,
        "name": "Steel Warrior",
        "elo": 1195,
        "owner": "player2"
      }
    }
  ],
  "total": 1
}
```

#### Get Battle History
```http
GET /api/matches/history?page=1&perPage=20
Authorization: Bearer <user-jwt>

Response:
{
  "data": [
    {
      "battleId": 456,
      "createdAt": "2026-01-31T10:30:00Z",
      "leagueType": "bronze",
      "userRobot": {
        "id": 1,
        "name": "Iron Gladiator",
        "finalHP": 9,
        "damageDealt": 40,
        "eloBefore": 1200,
        "eloAfter": 1216
      },
      "opponent": {
        "id": 2,
        "name": "Steel Warrior",
        "owner": "player2",
        "finalHP": 6,
        "damageDealt": 10
      },
      "result": {
        "won": true,
        "isDraw": false,
        "reward": 1000,
        "duration": 35
      }
    }
  ],
  "pagination": {
    "page": 1,
    "perPage": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

#### Get Battle Log
```http
GET /api/matches/battles/456/log
Authorization: Bearer <user-jwt>

Response:
{
  "battleId": 456,
  "createdAt": "2026-01-31T10:30:00Z",
  "leagueType": "bronze",
  "duration": 35,
  "robot1": {
    "id": 1,
    "name": "Iron Gladiator",
    "owner": "player1",
    "elo": 1200,
    "finalHP": 9
  },
  "robot2": {
    "id": 2,
    "name": "Steel Warrior",
    "owner": "player2",
    "elo": 1200,
    "finalHP": 6
  },
  "winner": "robot1",
  "battleLog": {
    "events": [
      {
        "timestamp": 0.0,
        "type": "battle_start",
        "message": "⚔️ Battle commences! Iron Gladiator (ELO 1200) vs Steel Warrior (ELO 1200)"
      },
      {
        "timestamp": 2.5,
        "type": "attack",
        "attacker": "robot1",
        "message": "💥 Iron Gladiator strikes Steel Warrior with Practice Sword for 15 damage!"
      },
      {
        "timestamp": 35.0,
        "type": "battle_end",
        "winner": "robot1",
        "message": "🏆 VICTORY! Iron Gladiator defeats Steel Warrior!"
      },
      {
        "timestamp": 35.0,
        "type": "elo_change",
        "robot": "robot1",
        "message": "📈 Iron Gladiator: 1200 → 1216 (+16 ELO)"
      }
    ],
    "isByeMatch": false
  }
}
```

#### Get League Standings
```http
GET /api/leagues/bronze/standings?page=1&perPage=100
Authorization: Bearer <user-jwt>

Response:
{
  "tier": "bronze",
  "standings": [
    {
      "rank": 1,
      "robotId": 5,
      "robotName": "Thunder Bolt",
      "owner": "player3",
      "elo": 1350,
      "leaguePoints": 18,
      "wins": 12,
      "losses": 3,
      "draws": 1,
      "isPromotionZone": true,
      "isDemotionZone": false,
      "isOwnRobot": false
    },
    ...
  ],
  "pagination": {
    "page": 1,
    "perPage": 100,
    "total": 80,
    "totalPages": 1
  }
}
```

#### Get League Instances
```http
GET /api/leagues/bronze/instances
Authorization: Bearer <user-jwt>

Response:
{
  "tier": "bronze",
  "instances": [
    {
      "leagueId": "bronze_1",
      "instanceNumber": 1,
      "currentRobots": 95,
      "maxRobots": 100,
      "isFull": false
    },
    {
      "leagueId": "bronze_2",
      "instanceNumber": 2,
      "currentRobots": 45,
      "maxRobots": 100,
      "isFull": false
    }
  ]
}
```

#### Get Robot Matches
```http
GET /api/robots/1/matches?page=1&perPage=20
Authorization: Bearer <user-jwt>

Response:
{
  "robotId": 1,
  "robotName": "Iron Gladiator",
  "upcoming": [
    {
      "matchId": 123,
      "scheduledFor": "2026-02-01T12:00:00Z",
      "opponent": {
        "id": 2,
        "name": "Steel Warrior",
        "elo": 1195
      }
    }
  ],
  "history": {
    "data": [...],  // Same format as /api/matches/history
    "pagination": {...}
  }
}
```

#### Get Robot Upcoming Matches
```http
GET /api/robots/1/upcoming
Authorization: Bearer <user-jwt>

Response:
{
  "robotId": 1,
  "robotName": "Iron Gladiator",
  "matches": [
    {
      "matchId": 123,
      "scheduledFor": "2026-02-01T12:00:00Z",
      "leagueType": "bronze",
      "opponent": {
        "id": 2,
        "name": "Steel Warrior",
        "elo": 1195,
        "owner": "player2"
      }
    }
  ]
}
```

---

## Configuration & Tuning

### Matchmaking Constants

**File**: `prototype/backend/src/services/matchmakingService.ts`

```typescript
// ELO matching ranges
ELO_MATCH_IDEAL = 150           // Ideal ELO difference for fair matches
ELO_MATCH_FALLBACK = 300        // Maximum ELO difference allowed

// Recent opponent tracking
RECENT_OPPONENT_LIMIT = 5       // Number of recent battles to track

// Battle readiness
BATTLE_READINESS_HP_THRESHOLD = 0.75  // 75% HP required

// Special robots
BYE_ROBOT_NAME = 'Bye Robot'    // Name of bye robot for odd numbers
```

**Match Quality Scoring**:
```typescript
// Lower score = better match
score = ELO_difference + recent_opponent_penalty + same_stable_penalty

// Penalties
recent_opponent_penalty = 200   // Soft deprioritize
same_stable_penalty = 500       // Strong deprioritize
```

### Battle Execution Constants

**File**: `prototype/backend/src/services/battleOrchestrator.ts`

```typescript
// ELO calculation
ELO_K_FACTOR = 32               // ELO volatility factor

// League points
LEAGUE_POINTS_WIN = 3           // Points for winning
LEAGUE_POINTS_LOSS = -1         // Points for losing (min 0)
LEAGUE_POINTS_DRAW = 1          // Points for draw

// Economic rewards
BASE_REWARD_WIN = 1000          // Credits for winning
BASE_REWARD_LOSS = 300          // Credits for losing

// HP reduction
WINNER_DAMAGE_PERCENT = 0.15    // Winners lose 10-15% HP
LOSER_DAMAGE_PERCENT = 0.40     // Losers lose 35-40% HP
```

### League Rebalancing Constants

**File**: `prototype/backend/src/services/leagueRebalancingService.ts`

```typescript
// Promotion/demotion thresholds
PROMOTION_THRESHOLD = 0.10      // Top 10% promoted
DEMOTION_THRESHOLD = 0.10       // Bottom 10% demoted

// Eligibility requirements
MIN_BATTLES_FOR_REBALANCE = 5   // Minimum cycles in current league
MIN_ROBOTS_FOR_REBALANCE = 10   // Minimum robots in tier for rebalancing

// Instance management
MAX_ROBOTS_PER_INSTANCE = 100   // Maximum robots per instance
REBALANCE_THRESHOLD = 20        // Deviation triggering rebalancing
```

### League Hierarchy

```typescript
const LEAGUE_TIERS = [
  'bronze',    // Lowest tier (no demotion)
  'silver',
  'gold',
  'platinum',
  'diamond',
  'champion'   // Highest tier (no promotion)
];

const LEAGUE_HIERARCHY = {
  bronze: { promotion: 'silver', demotion: null },
  silver: { promotion: 'gold', demotion: 'bronze' },
  gold: { promotion: 'platinum', demotion: 'silver' },
  platinum: { promotion: 'diamond', demotion: 'gold' },
  diamond: { promotion: 'champion', demotion: 'platinum' },
  champion: { promotion: null, demotion: 'diamond' },
};
```

### Tuning Recommendations

**If too many byes**:
- Lower BATTLE_READINESS_HP_THRESHOLD (but not below 0.50)
- Increase ELO_MATCH_FALLBACK (allow wider ELO ranges)
- Check robot yield thresholds (ensure HP > yield threshold)

**If matches too unbalanced**:
- Decrease ELO_MATCH_FALLBACK (stricter ELO matching)
- Increase ELO_MATCH_IDEAL (tighter ideal range)

**If league progression too fast**:
- Decrease PROMOTION_THRESHOLD (e.g., 0.05 = top 5%)
- Increase MIN_BATTLES_FOR_REBALANCE (e.g., 10 cycles)

**If league progression too slow**:
- Increase PROMOTION_THRESHOLD (e.g., 0.15 = top 15%)
- Decrease MIN_BATTLES_FOR_REBALANCE (e.g., 3 cycles)

**If too many same-stable matches**:
- Increase same_stable_penalty (e.g., 1000)
- Add hard limit (never allow same-stable)

**If too many repeat opponents**:
- Increase RECENT_OPPONENT_LIMIT (e.g., 10)
- Increase recent_opponent_penalty (e.g., 500)

---

## Monitoring & Analytics

### Key Metrics Tracked

**Matchmaking Metrics**:
- Average time to find match
- Percentage of robots matched per cycle
- Average ELO difference in matches
- Same-owner matchups (should be rare)
- Recent opponent matchups (should be uncommon)
- Bye-robot matches (indicates odd numbers)

**Battle Execution Metrics**:
- Battles completed per cycle
- Average battle duration
- Battle success/failure rate
- Transaction rollback rate
- Bye-robot battle outcomes

**League Metrics**:
- Robots per league tier
- Robots per instance
- Promotion rate per league
- Demotion rate per league
- Average cycles in current league
- Average battles per robot per week

**Player Engagement Metrics**:
- Daily active robots (participating in battles)
- Battle history page views
- Upcoming matches page views
- League standings page views
- Average time between battles for robot

### Logging Strategy

**Info Level**:
- Daily cycle start/completion
- Matchmaking summary (X robots matched, Y unmatched)
- Battle execution summary (X battles completed)
- League rebalancing summary (X promoted, Y demoted)

**Debug Level**:
- Individual match pairings
- Individual battle results
- Robot state changes
- ELO calculations

**Error Level**:
- Matchmaking failures
- Battle execution failures
- Database transaction failures
- Unexpected states (e.g., robot scheduled twice)

### Database Indexes (Implemented)

**Critical Indexes for Performance**:
```sql
-- Robot matchmaking queries
CREATE INDEX idx_robot_league_elo ON robots(current_league, elo);
CREATE INDEX idx_robot_league_instance ON robots(current_league, league_id);

-- Scheduled matches queries
CREATE INDEX idx_scheduledmatch_status_time ON scheduled_matches(status, scheduled_for);
CREATE INDEX idx_scheduledmatch_robot1 ON scheduled_matches(robot1_id);
CREATE INDEX idx_scheduledmatch_robot2 ON scheduled_matches(robot2_id);

-- Battle history queries
CREATE INDEX idx_battle_created ON battles(created_at DESC);
CREATE INDEX idx_battle_robot1 ON battles(robot1_id, created_at DESC);
CREATE INDEX idx_battle_robot2 ON battles(robot2_id, created_at DESC);
```

---

## Conclusion

These features are not in scope for Phase 1 but should be considered for future phases:

### Phase 2 Enhancements
- [ ] Automated scheduling (cron jobs instead of manual triggers)
- [ ] WebSocket notifications (notify players when matches scheduled/completed)
- ✅ Multiple league instances (bronze_1, bronze_2, etc.)
- [ ] Revenge matches (challenge specific opponent)
- [ ] Match predictions based on stats

### Phase 3 Enhancements
- [ ] Team battles (2v2, 3v3) with synchronized matchmaking
- ✅ Tournament system (bracket-based competitions)
- [ ] Spectator mode (watch other players' battles)
- [ ] Battle replay visualization
- [ ] Advanced matchmaking preferences (avoid certain opponents, preferred times)

### Phase 4 Enhancements
- [ ] AI-driven matchmaking optimization
- [ ] Dynamic ELO K-factor based on consistency
- [ ] League seasons (periodic resets)
- [ ] Prestige-based champion league qualification
- [ ] Cross-league exhibition matches

---

## Documentation & Training

### Developer Documentation

**To Be Created:**
- [ ] Matchmaking algorithm technical specification
- [ ] Daily cycle orchestration guide
- [ ] Database schema migration guide
- [ ] API endpoint documentation (OpenAPI/Swagger)
- [ ] Testing guide for matchmaking scenarios

### User Documentation

**To Be Created:**
- [ ] How matchmaking works (player guide)
- [ ] League progression explained
- [ ] ELO system overview
- [ ] Battle schedule information
- [ ] FAQ: "Why didn't my robot get matched?"

---

## Appendices

### Appendix A: ELO Rating System

**ELO Formula:**
```
Expected Score = 1 / (1 + 10^((opponent_elo - robot_elo) / 400))

New ELO = Old ELO + K * (Actual Score - Expected Score)

Where:
- K = 32 (ELO volatility factor)
- Actual Score = 1 (win), 0.5 (draw), 0 (loss)
```

**Example:**
```
Robot A: ELO 1200 vs Robot B: ELO 1300

Expected Score (A) = 1 / (1 + 10^((1300-1200)/400)) = 0.36
Expected Score (B) = 1 / (1 + 10^((1200-1300)/400)) = 0.64

If A wins:
New ELO (A) = 1200 + 32 * (1 - 0.36) = 1220
New ELO (B) = 1300 + 32 * (0 - 0.64) = 1280

If B wins:
New ELO (A) = 1200 + 32 * (0 - 0.36) = 1188
New ELO (B) = 1300 + 32 * (1 - 0.64) = 1312
```

### Appendix B: League Point System

**Points Awarded:**
- Win: +3 points
- Draw: +1 point
- Loss: -1 point (minimum 0)
- Upset bonus (win against >200 ELO higher): +1 point
- Upset penalty (loss against >300 ELO lower): -1 point

**Promotion Threshold:**
- Fixed approach: 15 league points
- Percentage approach: Top 20% of league

**Demotion Threshold:**
- Fixed approach: 0 league points after 10+ battles
- Percentage approach: Bottom 10% of league

**Recommendation:** Use percentage approach (10%) for Phase 1 to auto-balance leagues.

### Appendix C: Matchmaking Priority

**Priority Score Formula:**
```typescript
priority = (leaguePoints * 100) + elo + random(0, 10)
```

**Rationale:**
- League points dominate (robots close to promotion/demotion matched first)
- ELO provides secondary sorting
- Random tiebreaker prevents stale matchups

### Appendix D: Database Indexes

**Critical Indexes for Performance:**
```sql
-- Robot matchmaking queries
CREATE INDEX idx_robot_league_elo ON robots(current_league, elo);
CREATE INDEX idx_robot_battlereadiness ON robots(battle_readiness);

-- Scheduled matches queries
CREATE INDEX idx_scheduledmatch_status_time ON scheduled_matches(status, scheduled_for);
CREATE INDEX idx_scheduledmatch_robot1 ON scheduled_matches(robot1_id);
CREATE INDEX idx_scheduledmatch_robot2 ON scheduled_matches(robot2_id);

-- Battle history queries
CREATE INDEX idx_battle_user_created ON battles(user_id, created_at DESC);
CREATE INDEX idx_battle_robot1 ON battles(robot1_id, created_at DESC);
CREATE INDEX idx_battle_robot2 ON battles(robot2_id, created_at DESC);
```

---

## Conclusion

The Armoured Souls matchmaking system is **fully implemented and operational** as of January 31, 2026. All 11 implementation phases are complete, with comprehensive test coverage and documentation.

### System Status

**✅ Complete Features**:
- ELO-based matchmaking with league constraints
- League instance management (100 robots per instance)
- Battle scheduling and execution
- League rebalancing (promotion/demotion every cycle)
- Battle readiness validation (HP + weapons + yield check)
- Bye-robot system for odd numbers
- Combat message generation (50+ templates)
- Admin dashboard with bulk cycle testing
- Public APIs for matches, history, and standings
- Frontend UI components (dashboard, history, standings)
- Comprehensive test suite (49 unit + 4 integration tests)

**📊 Performance Achieved**:
- Matchmaking: <2 seconds (100 robots) ✅
- Battle execution: <5 seconds (50 battles) ✅
- League rebalancing: <1 second ✅
- API response: <100ms ✅
- Complete cycle: <10 seconds ✅

**🎯 Success Criteria Met**:
- ✅ Fair matchmaking (ELO-based with ±150 ideal, ±300 fallback)
- ✅ Automated scheduling (daily cycle workflow)
- ✅ League progression (10% promotion/demotion, min 5 cycles)
- ✅ Transparent display (upcoming matches, history, standings)
- ✅ First day solution (all robots start in Bronze)
- ✅ Edge cases handled (odd numbers, no opponents, same-stable, etc.)
- ✅ Battle readiness warnings (3 locations)
- ✅ Bye-robot matches (full rewards compensation)

### Key Achievements

**1. Robust Matchmaking Algorithm**
- ELO-based pairing ensures fair matches
- Recent opponent tracking adds variety
- Same-stable deprioritization encourages competition
- Bye-robot system handles odd numbers gracefully

**2. Scalable League System**
- Instance management (max 100 per instance)
- Auto-balancing when deviation >20
- Dynamic instance creation
- Smooth promotion/demotion flow

**3. Rich Battle Experience**
- Action-by-action combat logs
- 50+ contextual message templates
- Complete battle statistics
- Detailed post-battle analysis

**4. Comprehensive Testing Tools**
- Admin dashboard for manual control
- Bulk cycle execution (up to 100 cycles)
- Auto-repair with cost simulation
- System statistics monitoring

**5. Player-Friendly UI**
- Upcoming matches with countdown
- Battle history with pagination
- League standings (all 6 tiers)
- Battle readiness warnings
- Detailed battle logs

**This PRD consolidates**:
- ✅ Original requirements and design decisions
- ✅ Implementation details and technical specs
- ✅ Testing procedures and validation
- ✅ API reference and configuration
- ✅ Future enhancement suggestions