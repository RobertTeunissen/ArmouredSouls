# Product Requirements Document: Matchmaking System

**Last Updated**: January 30, 2026  
**Status**: Implementation Ready  
**Owner**: Robert Teunissen  
**Epic**: Matchmaking and Battle Scheduling System Implementation

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
- League rebalancing occurs correctly (promotion/demotion thresholds)
- Players can view upcoming matches and recent battle history
- "First day" initialization seeds initial matches successfully
- No matchmaking deadlocks or infinite loops

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
- Each match shows: Robot name, Opponent robot name, Opponent ELO, League, Scheduled time
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
- Prevent robots from same stable fighting each other (optional - discuss)

**US-5: League-Based Matchmaking**
- **As the** matchmaking system
- **I need to** respect league boundaries when pairing robots
- **So that** robots only face opponents in their league tier

**Acceptance Criteria:**
- Bronze robots only matched with Bronze robots
- Silver robots only matched with Silver robots
- (Same for Gold, Platinum, Diamond, Champion)
- Robots in promotion/demotion zones prioritized for matches
- Support multiple league instances (bronze_1, bronze_2, etc.) for scalability

**US-6: Matchmaking Queue Management**
- **As the** matchmaking system
- **I need to** track which robots are eligible for matchmaking
- **So that** I can pair them efficiently

**Acceptance Criteria:**
- Queue includes all robots with battleReadiness ≥ 50%
- Exclude robots currently scheduled for a match
- Exclude robots that have yielded/been destroyed until repaired
- Queue sorted by: Priority (league points) → ELO → Random tiebreaker
- Queue refreshes before each matchmaking cycle

### Epic: Battle Scheduling

**US-7: Daily Battle Schedule**
- **As the** game system
- **I need to** process battles in scheduled batches
- **So that** battles occur predictably and players can plan around them

**Acceptance Criteria:**
- Battles scheduled to run at specific times (e.g., 8 AM, 2 PM, 8 PM server time)
- Matchmaking occurs 1 hour before scheduled battle time
- All scheduled battles execute simultaneously when batch time arrives
- Battle results posted immediately after completion
- Next matchmaking cycle begins after results processing

**US-8: Manual Battle Trigger (Prototype Phase)**
- **As a** developer testing the prototype
- **I want to** manually trigger battle processing
- **So that** I can test matchmaking without waiting for scheduled times

**Acceptance Criteria:**
- Admin endpoint: POST /api/admin/trigger-matchmaking
- Admin endpoint: POST /api/admin/trigger-battles
- Admin endpoint: POST /api/admin/trigger-league-rebalance
- Endpoints protected by admin role authentication
- Logs all actions for debugging
- Returns summary of actions taken (matches created, battles processed, etc.)

### Epic: League Progression

**US-9: League Rebalancing**
- **As the** game system
- **I need to** promote/demote robots based on performance
- **So that** leagues remain balanced and competitive

**Acceptance Criteria:**
- League rebalancing runs after battles complete
- Promotion threshold: Top X% of robots in league (or specific league points threshold)
- Demotion threshold: Bottom Y% of robots in league (or specific league points threshold)
- Champion league has no promotion (highest tier)
- Bronze league has no demotion (lowest tier)
- League points reset after promotion/demotion
- ELO carries over between leagues

**US-10: League Points Calculation**
- **As the** game system
- **I need to** award league points based on battle outcomes
- **So that** robots progress toward promotion or risk demotion

**Acceptance Criteria:**
- Win: +3 league points
- Loss: -1 league point (can't go below 0)
- Draw: +1 league point
- Bonus: +1 point for winning against higher ELO opponent
- Penalty: -1 additional point for losing to much lower ELO opponent (>300 difference)
- League points displayed on robot detail page

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

**Battle Model - Add Relation:**
```prisma
model Battle {
  // ... existing fields ...
  
  scheduledMatch  ScheduledMatch[]
}
```

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
│  UPCOMING MATCHES                                          │
│  Next battle cycle: January 31, 8:00 PM (in 4h 15m)      │
├───────────────────────────────────────────────────────────┤
│                                                            │
│  Your Robot          vs      Opponent         League      │
│  ──────────────────────────────────────────────────────── │
│  BattleBot Alpha     vs      Iron Crusher     Bronze      │
│  ELO: 1250                   ELO: 1280                    │
│  Stance: Offensive           Owner: player3               │
│                                                            │
│  ──────────────────────────────────────────────────────── │
│  Steel Destroyer     vs      Thunder Bolt     Silver      │
│  ELO: 1450                   ELO: 1420                    │
│  Stance: Balanced            Owner: player5               │
│                                                            │
│  ──────────────────────────────────────────────────────── │
│  [No more upcoming matches]                                │
│                                                            │
└───────────────────────────────────────────────────────────┘
```

### Battle History Page

**Layout:**
```
┌───────────────────────────────────────────────────────────┐
│  BATTLE HISTORY                          [Filter ▼]       │
│                                                            │
│  Showing 20 of 142 battles                                │
├───────────────────────────────────────────────────────────┤
│                                                            │
│  ✅ VICTORY                            January 30, 2:00 PM│
│  BattleBot Alpha  vs  Iron Crusher                        │
│  ELO: 1250 → 1265 (+15)                                   │
│  Damage: 120 dealt, 45 taken                              │
│  League: Bronze  |  Reward: ₡12,500                       │
│  [View Details]                                            │
│                                                            │
│  ──────────────────────────────────────────────────────── │
│                                                            │
│  ❌ DEFEAT                             January 30, 8:00 AM│
│  Steel Destroyer  vs  Plasma Titan                        │
│  ELO: 1450 → 1438 (-12)                                   │
│  Damage: 80 dealt, 150 taken                              │
│  League: Silver  |  Reward: ₡3,500                        │
│  [View Details]                                            │
│                                                            │
│  ──────────────────────────────────────────────────────── │
│                                                            │
│  [< Previous]  Page 1 of 8  [Next >]                      │
│                                                            │
└───────────────────────────────────────────────────────────┘
```

### League Standings Page

**Layout:**
```
┌───────────────────────────────────────────────────────────┐
│  LEAGUE STANDINGS                                          │
│  [Bronze] [Silver] [Gold] [Platinum] [Diamond] [Champion] │
├───────────────────────────────────────────────────────────┤
│  SILVER LEAGUE                                             │
│                                                            │
│  Rank  Robot Name        Owner      ELO    LP   W-L       │
│  ──────────────────────────────────────────────────────── │
│  🟢 1   Plasma Titan     player2    1510   18   12-3      │
│  🟢 2   Thunder Bolt     player5    1480   15   10-4      │
│  🟢 3   Steel Destroyer  player1    1450   14   9-5       │
│   4   Lightning Core   player4    1425   12   8-6       │
│   5   Battle Master    player3    1405   10   7-7       │
│   ...                                                      │
│  12   Iron Wall        player6    1320    4   4-10      │
│  🔴 13   Bronze Bot       player1    1280    2   3-11      │
│  🔴 14   Old Fighter     player3    1250    1   2-12      │
│                                                            │
│  🟢 Promotion Zone  |  🔴 Demotion Zone                    │
│                                                            │
└───────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Database & Models ✅ (Mostly Complete)

**Status**: Database schema already exists, minor additions needed

**Tasks:**
- [x] Robot model with ELO, league fields (already exists)
- [x] Battle model with complete tracking (already exists)
- [ ] Add ScheduledMatch model to schema
- [ ] Add robot relations for scheduled matches
- [ ] Run Prisma migration
- [ ] Update seed script to test matchmaking

**Estimated Effort**: 4 hours

### Phase 2: Matchmaking Algorithm

**Tasks:**
- [ ] Implement queue building logic
- [ ] Implement pairing algorithm (ELO-based)
- [ ] Create scheduled matches in database
- [ ] Add unit tests for matchmaking logic
- [ ] Handle edge cases (odd number of robots, no opponents)

**Estimated Effort**: 8 hours

### Phase 3: Battle Execution Coordination

**Tasks:**
- [ ] Create battle orchestrator service
- [ ] Implement battle execution from scheduled matches
- [ ] Update robot stats after battles (ELO, league points, damage)
- [ ] Calculate and award rewards (credits, fame)
- [ ] Mark scheduled matches as completed
- [ ] Link completed battles to scheduled matches

**Estimated Effort**: 6 hours

### Phase 4: League Rebalancing

**Tasks:**
- [ ] Implement league rebalancing algorithm
- [ ] Calculate promotion/demotion thresholds
- [ ] Update robot leagues and reset league points
- [ ] Add logging for rebalancing actions
- [ ] Test edge cases (small leagues, no eligible robots)

**Estimated Effort**: 6 hours

### Phase 5: Admin Endpoints (Prototype)

**Tasks:**
- [ ] Create admin middleware for role checking
- [ ] Implement POST /api/admin/matchmaking/run
- [ ] Implement POST /api/admin/battles/run
- [ ] Implement POST /api/admin/leagues/rebalance
- [ ] Implement POST /api/admin/schedule/run-daily-cycle
- [ ] Add request logging and error handling

**Estimated Effort**: 4 hours

### Phase 6: Public API Endpoints

**Tasks:**
- [ ] Implement GET /api/matches/upcoming
- [ ] Implement GET /api/matches/history (with pagination)
- [ ] Implement GET /api/leagues/:leagueType/standings
- [ ] Implement GET /api/robots/:id/matches
- [ ] Add input validation and error handling
- [ ] Write integration tests for all endpoints

**Estimated Effort**: 6 hours

### Phase 7: Frontend UI

**Tasks:**
- [ ] Create UpcomingMatches component (dashboard)
- [ ] Create BattleHistory page with pagination
- [ ] Create LeagueStandings page with tabs
- [ ] Add match details modal/page
- [ ] Update robot detail page to show upcoming matches
- [ ] Add loading states and error handling

**Estimated Effort**: 10 hours

### Phase 8: Testing & Edge Cases

**Tasks:**
- [ ] Test first day initialization
- [ ] Test matchmaking with various robot counts
- [ ] Test league rebalancing edge cases
- [ ] Test scheduled match execution
- [ ] Load test with 100+ robots
- [ ] Integration test complete daily cycle

**Estimated Effort**: 6 hours

### Total Estimated Effort: 50 hours

---

## Edge Cases & Considerations

### Matchmaking Edge Cases

1. **Odd Number of Robots in Queue**
   - Solution: One robot sits out this cycle (lowest priority/ELO)
   - Alternative: Create bye match (robot automatically wins vs dummy)

2. **No Suitable Opponent**
   - Solution: Robot waits for next cycle
   - Log unmatched robots for monitoring

3. **Same Owner Matching**
   - Decision needed: Should robots from same stable fight each other?
   - Current recommendation: Allow it, but deprioritize
   - Rationale: Small player base in prototype phase

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

## Open Questions & Decisions Needed

### Critical Decisions

**Q1: Should robots from the same stable fight each other?**
- **Option A**: No, prevent same-owner matchups entirely
  - Pro: Avoids collusion/fixing
  - Con: Reduces available opponents in small player base
- **Option B**: Allow but deprioritize same-owner matchups
  - Pro: More flexible matchmaking
  - Con: Could feel weird for players
- **Recommendation**: Option B (allow but deprioritize) for prototype phase

**Q2: How many battles per day per robot?**
- **Option A**: 1 battle per day (simple, manageable)
- **Option B**: 2-3 battles per day (more engagement)
- **Option C**: Dynamic based on league tier (champion = 1/day, bronze = 3/day)
- **Recommendation**: Option A (1 battle per day) for prototype phase

**Q3: What happens to unmatched robots?**
- **Option A**: Wait for next cycle (simpler)
- **Option B**: Create "bye" match (robot auto-wins with minimal rewards)
- **Recommendation**: Option A (wait) for prototype phase

**Q4: League instance management**
- **Question**: How do we handle multiple league instances (bronze_1, bronze_2)?
- **Current approach**: All robots in "bronze_1", "silver_1", etc. (single instance per tier)
- **Future enhancement**: Split leagues when population exceeds threshold (e.g., 50 robots)
- **Recommendation**: Single instance per tier for Phase 1 prototype

**Q5: Scheduled times for prototype**
- **Question**: What time(s) should battles run during prototype testing?
- **Recommendation**: Flexible manual triggers via admin endpoints
- **Future**: Implement cron-style scheduling (e.g., 8 AM, 2 PM, 8 PM server time)

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
