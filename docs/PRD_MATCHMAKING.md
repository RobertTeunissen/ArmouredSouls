# Product Requirements Document: Matchmaking System

**Last Updated**: January 30, 2026  
**Status**: ✅ All Decisions Finalized - Ready for Implementation  
**Owner**: Robert Teunissen  
**Epic**: Matchmaking and Battle Scheduling System Implementation  
**Related Documents**: 
- [MATCHMAKING_DECISIONS.md](MATCHMAKING_DECISIONS.md) - All owner decisions
- [MATCHMAKING_IMPLEMENTATION.md](MATCHMAKING_IMPLEMENTATION.md) - Technical specifications
- [COMBAT_MESSAGES.md](COMBAT_MESSAGES.md) - Battle log message catalog

---

## Executive Summary

This PRD defines the requirements for implementing the Matchmaking System for Armoured Souls Phase 1 prototype. The matchmaking system is responsible for pairing robots for battles, scheduling battles in batches, managing league progression, and displaying match history and upcoming matches to players.

**Matchmaking** enables the game's core loop: Players configure their robots → Matchmaking pairs opponents → Battles execute in scheduled batches → Results displayed → League rankings update → Next cycle begins.

This system adopts a **scheduled batch processing** model inspired by Football Manager, where players set up their robots and strategy, then check back later to see results. This approach prioritizes strategic planning over real-time action, making it ideal for casual players who can engage 15-30 minutes per day.

**Success Criteria**: Players can see upcoming matches, view historical battle results, understand league standings, and have confidence that matchmaking is fair and transparent. The system must handle the "first day problem" where initial matches need to be seeded without historical data.

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
- ❌ Tournament system - separate PRD needed
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

--> Do you have a design for what a detailed battle log would look like?
--> Battle Result: Draw? Has it been defined this is possible? If so, how?
--> Battle Result: Show also show league change if applicable. This is not the case in Tournaments. I know Tournaments are for another PRD but we need to take it into account.
--> Battle Result: Should show the type of battle (League Match / Tournament / etc). Implications for database?
--> Dashboard should display the last 5 matches an owned robot has fought with links to detailed results
--> Robot detail page should display the entire match history in "battle result format".

**US-3: View League Standings**
- **As a** player competing in leagues
- **I want to** see current standings in my robots' leagues
- **So that** I understand where I rank and what's needed for promotion/demotion

**Acceptance Criteria:**
- League standings page shows robots in each league
- Display: Rank, Robot name, Owner, ELO, League points, Win/Loss record
- Show promotion zone (top X robots) and demotion zone (bottom Y robots) highlighted
- Separate tab/section for each league tier
- Update after each battle batch completes

--> A player also needs to know how he stacks up with other players; not only show the leagues he is in, but all leagues that are in the system.
--> Player should easily identity his own robots when checking the league standings.

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
- League rebalancing runs after battles complete
- Promotion threshold: Top 10% of robots in league (minimum 5 battles)
- Demotion threshold: Bottom 10% of robots in league (minimum 5 battles)
- Champion league has no promotion (highest tier)
- Bronze league has no demotion (lowest tier)
- League points reset after promotion/demotion
- ELO carries over between leagues
- Instance balancing after promotions/demotions if deviation >20 robots

**Design Decision**: 10% promotion/demotion provides slower, more stable league progression. Robots need minimum 5 battles to be eligible, preventing premature tier changes.

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

*Note: This table may not be needed if matchmaking happens entirely in-memory during scheduled runs. Discuss during implementation.*

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
- **Promotion**: Top 20% of robots in league (minimum 5 battles completed)
- **Demotion**: Bottom 20% of robots in league (minimum 5 battles completed)
- **Alternative approach**: Fixed league points thresholds (e.g., 15 points = promotion, 0 points after 10 battles = demotion)

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
      totalBattles: { gte: 5 },  // Minimum battles to be eligible
    },
    orderBy: [
      { leaguePoints: 'desc' },
      { elo: 'desc' },
    ],
  });
  
  const totalRobots = robots.length;
  const promotionCount = Math.ceil(totalRobots * 0.2);  // Top 20%
  const demotionCount = Math.floor(totalRobots * 0.2);  // Bottom 20%
  
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

### Phase 1: Database & Core Models (6 hours)

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

**Estimated Effort**: 6 hours (was 4)

### Phase 2: League Instance System (10 hours)

**Tasks:**
- [ ] Implement instance creation logic (max 100 per instance)
- [ ] Robot placement algorithm (find instance with most free spots)
- [ ] Promotion/demotion balancing across instances
- [ ] Instance preference in matchmaking (same instance first)
- [ ] Auto-balancing when deviation >20 robots
- [ ] Unit tests for instance management

**Estimated Effort**: 10 hours

### Phase 3: Matchmaking Algorithm (8 hours)

**Tasks:**
- [ ] Build queue with comprehensive battle readiness checks (HP + weapons)
- [ ] ELO-based pairing within league instances
- [ ] Recent opponent tracking (last 5 matches)
- [ ] Same-stable deprioritization logic
- [ ] Bye-robot matching for odd numbers
- [ ] Unit tests for pairing algorithm

**Estimated Effort**: 8 hours

### Phase 4: Battle Readiness System (5 hours)

**Tasks:**
- [ ] Comprehensive weapon validation by loadout type
- [ ] HP threshold checks (≥75%)
- [ ] API endpoints for readiness status
- [ ] Warning system implementation
- [ ] Display warnings on robot list, detail, dashboard
- [ ] Unit tests

**Estimated Effort**: 5 hours

### Phase 5: Battle Execution (6 hours)

**Tasks:**
- [ ] Battle orchestrator service
- [ ] Execute from scheduled matches
- [ ] Bye-robot battle simulation (predictable, easy win)
- [ ] Update robot stats (ELO, league points, damage)
- [ ] Award rewards (with bye-match compensation)
- [ ] Integration tests

**Estimated Effort**: 6 hours

### Phase 6: League Rebalancing (6 hours)

**Tasks:**
- [ ] Promotion/demotion algorithm (10% thresholds)
- [ ] Instance balancing after tier changes
- [ ] League point reset
- [ ] Minimum 5 battles eligibility check
- [ ] Edge case handling
- [ ] Tests

**Estimated Effort**: 6 hours

### Phase 7: Admin Dashboard (12 hours)

**Tasks:**
- [ ] Separate admin portal setup
- [ ] Authentication and authorization
- [ ] Matchmaking trigger UI
- [ ] Battle execution UI
- [ ] Bulk cycle execution (up to 100 cycles)
- [ ] Auto-repair controls and monitoring
- [ ] System monitoring dashboard
- [ ] API endpoint implementation

**Estimated Effort**: 12 hours (was 4 - separate portal is more complex)

### Phase 8: Public API Endpoints (6 hours)

**Tasks:**
- [ ] Implement GET /api/matches/upcoming
- [ ] Implement GET /api/matches/history (with pagination)
- [ ] Implement GET /api/leagues/:tier/standings (with instance support)
- [ ] Implement GET /api/robots/:id/matches
- [ ] Battle readiness endpoints
- [ ] Add input validation and error handling
- [ ] Write integration tests for all endpoints

**Estimated Effort**: 6 hours

### Phase 9: Frontend UI (14 hours)

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

**Estimated Effort**: 14 hours (was 10 - more UI components)

### Phase 10: Battle Log System (6 hours)

**Tasks:**
- [ ] Implement combat message generation (see COMBAT_MESSAGES.md)
- [ ] Action-by-action logging with timestamps
- [ ] Textual descriptions for all event types
- [ ] JSON structure implementation
- [ ] Message selection algorithm
- [ ] Detail view UI for battle logs

**Estimated Effort**: 6 hours (new phase)

### Phase 11: Testing & Polish (8 hours)

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

**Estimated Effort**: 8 hours (was 6)

### Total Estimated Effort: 87 hours (was 50 hours)

**Increase Reasons**:
- League instance complexity (+15 hours)
- Separate admin dashboard (+8 hours)
- Battle log system (+6 hours)
- Bye-robot system (+4 hours)
- Enhanced battle readiness (+3 hours)
- Additional testing (+1 hour)

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

All decisions have been finalized based on owner review. See [MATCHMAKING_DECISIONS.md](MATCHMAKING_DECISIONS.md) for complete decision record.

### Core Design Decisions

**D1: Robots from Same Stable**
- **Decision**: Strongly deprioritize in leagues (allow as last resort)
- **Tournament mode** (future): No restriction
- **Rationale**: Flexible matchmaking for small player base, tournaments need less restriction

**D2: Battles Per Day Per Robot**
- **Decision**: 1 battle per day per robot
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

See [MATCHMAKING_DECISIONS.md](MATCHMAKING_DECISIONS.md) for complete decision record with context and rationale.

### Nice-to-Have Features (Out of Scope for Phase 1)

- [ ] Revenge matches (challenge someone who beat you)
- [ ] Spectator mode (watch live or replay)
- [ ] Match predictions (AI predicts winner)
- [ ] Betting system (wager credits on match outcomes)
- [ ] Custom tournaments (player-organized events)
- [ ] Team battles (2v2, 3v3) with synchronized matchmaking
- [ ] League history tracking (robot's journey through leagues)

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

These features are not in scope for Phase 1 but should be considered for future phases:

### Phase 2 Enhancements
- [ ] Automated scheduling (cron jobs instead of manual triggers)
- [ ] WebSocket notifications (notify players when matches scheduled/completed)
- [ ] Multiple league instances (bronze_1, bronze_2, etc.)
- [ ] Revenge matches (challenge specific opponent)
- [ ] Match predictions based on stats

### Phase 3 Enhancements
- [ ] Team battles (2v2, 3v3) with synchronized matchmaking
- [ ] Tournament system (bracket-based competitions)
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
- Percentage approach: Bottom 20% of league

**Recommendation:** Use percentage approach (20%) for Phase 1 to auto-balance leagues.

--> 10% sounds more reasonable, otherwise you're switching leagues too often.

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

This PRD provides a comprehensive specification for the Matchmaking System in Armoured Souls Phase 1 prototype. The system enables the core game loop by pairing robots for battles, executing battles in scheduled batches, rebalancing leagues, and displaying results to players.

**Key Takeaways:**
- Matchmaking uses ELO-based pairing within league tiers
- Battles execute in scheduled batches (Football Manager style)
- League progression through promotion/demotion system
- Manual triggers for prototype phase, automated scheduling for production
- Complete transparency for players (upcoming matches, history, standings)

**Next Steps:**
1. Review and approve this PRD
2. Create implementation tickets based on Phase 1-8 plan
3. Prioritize database schema changes
4. Begin matchmaking algorithm implementation
5. Iterate based on prototype testing feedback

---

**Document Status**: Ready for Review  
**Version**: 1.0  
**Last Updated**: January 30, 2026  
**Author**: Copilot AI (with guidance from Robert Teunissen)
