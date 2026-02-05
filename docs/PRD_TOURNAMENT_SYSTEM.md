# Product Requirements Document: Tournament System

**Last Updated**: February 5, 2026  
**Status**: 🚧 Draft - Ready for Review  
**Owner**: Robert Teunissen  
**Epic**: Tournament Framework and Single Elimination Implementation  
**Related Documents**: 
- [PRD_MATCHMAKING.md](PRD_MATCHMAKING.md) - Matchmaking system architecture
- [PRD_ECONOMY_SYSTEM.md](PRD_ECONOMY_SYSTEM.md) - Financial integration
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - Current database structure

---

## Executive Summary

This PRD defines the requirements for implementing a **Tournament System** for Armoured Souls. The tournament system introduces a new competitive format alongside the existing league battles, enabling robots to compete in structured elimination events with enhanced rewards and prestige.

**Key Features:**
- **Tournament Framework**: Flexible architecture supporting multiple concurrent tournaments with various formats
- **Single Elimination Tournament**: First tournament type where all available robots compete in knockout rounds
- **Automatic Progression**: Tournaments run continuously - when one completes, a new one begins
- **Admin Integration**: Triggerable manually or as part of the daily cycle
- **Financial Integration**: Full compliance with existing economy system (participation credits, win rewards, streaming income)
- **Battle Variety**: New "tournament" battle type alongside "league" battles

**Success Criteria**: Players can participate in tournaments alongside league battles, view tournament brackets and progress, earn enhanced rewards for tournament victories, and experience continuous competitive events that drive engagement.

---

## Background & Context

### Current State

**What Exists:**
- ✅ Complete battle system with combat simulator
- ✅ Matchmaking and scheduling system for league battles
- ✅ Financial system with battle rewards, operating costs, and income streams
- ✅ Battle types: Currently only "league" battles
- ✅ ScheduledMatch model for upcoming battles
- ✅ Battle model with complete tracking (damage, ELO, rewards, battle logs)
- ✅ Admin endpoints for daily cycle management
- ✅ Robot battle readiness system (HP, weapons, yield threshold)

**What's Missing:**
- ❌ Tournament framework architecture
- ❌ Tournament bracket/pairing logic
- ❌ Tournament state management (rounds, progression)
- ❌ Tournament-specific battle rewards
- ❌ Tournament display UI (brackets, progress)
- ❌ Multiple upcoming match support per robot
- ❌ Tournament history tracking

### Why Tournaments Matter

Tournaments provide:
- **Narrative Structure**: Clear beginning, middle, and end with climactic finals
- **Enhanced Rewards**: Higher stakes battles with bigger payouts
- **Prestige Opportunities**: Championship titles and fame accumulation
- **Engagement Driver**: Continuous competitive events maintain player interest
- **Strategic Depth**: Different optimal strategies for tournament vs. league play
- **Community Building**: Shared tournament experiences create player stories

The continuous tournament model ensures:
- **Always-On Competition**: Players always have tournament opportunities
- **No Downtime**: Seamless transition between tournament cycles
- **Multiple Match Types**: Robots can have both league and tournament matches scheduled

---

## Goals & Objectives

### Primary Goals

1. **Flexible Tournament Framework**: Support multiple concurrent tournaments with different formats
2. **Single Elimination Implementation**: First tournament type with knockout progression
3. **Seamless Integration**: Works alongside existing league battles without conflicts
4. **Enhanced Rewards**: Tournament victories provide greater rewards than league battles
5. **Admin Control**: Tournaments triggerable manually and via daily cycle automation

### Success Metrics

- Tournaments successfully run alongside league battles without scheduling conflicts
- Robots can have multiple upcoming matches (league + tournament)
- Tournament brackets properly handle odd numbers of participants (bye matches)
- Financial rewards correctly calculated and awarded (participation, wins, streaming)
- Tournament battles appear in battle history with proper categorization
- Admin can manually trigger tournaments and include in daily cycle
- Tournament state persists correctly across rounds
- Winner determination and new tournament creation work automatically

### Non-Goals (Out of Scope for Initial Release)

- **Team tournaments (2v2, 3v3)**: Future feature, not in initial release
- **Swiss-style tournaments**: Single elimination only for now
- **Player-created tournaments**: Admin-only in Phase 1
- **Tournament bracketing UI**: Simple list view initially, full brackets later
- **Tournament registration system**: All available robots auto-enter
- **Prize pools**: Fixed rewards initially, prize pools in future versions

---

## User Stories & Requirements

### Epic 1: Tournament Framework

**As a developer**, I need a flexible tournament framework so that multiple tournament types can run concurrently.

#### User Story 1.1: Tournament Model
- **As a developer**, I need a Tournament database model to track tournament state
- **Acceptance Criteria:**
  - Tournament model includes: id, name, tournamentType, status, currentRound, maxRounds, createdAt, startedAt, completedAt, winnerId
  - Tournament statuses: "pending", "active", "completed"
  - Tournament types: "single_elimination" (extensible for future types)
  - Can query active tournaments
  - Can track tournament progression through rounds

#### User Story 1.2: Tournament Match Model
- **As a developer**, I need a TournamentMatch model to track individual tournament battles
- **Acceptance Criteria:**
  - Links to parent Tournament
  - Includes: round number, match number in round, robot1Id, robot2Id, winnerId, battleId
  - Supports bye matches (one robot, no opponent)
  - Can query matches by tournament and round
  - Links to Battle record after execution

#### User Story 1.3: Multiple Tournaments
- **As a system**, I need to support multiple concurrent tournaments
- **Acceptance Criteria:**
  - Multiple tournaments can be "active" simultaneously
  - Tournaments don't interfere with each other's progression
  - Each tournament tracks its own state independently
  - Different tournament types can run concurrently

### Epic 2: Single Elimination Tournament

**As a player**, I want to compete in single elimination tournaments so that I can earn prestige and test my robot against all competitors.

#### User Story 2.1: Tournament Creation
- **As an admin**, I can create a new single elimination tournament
- **Acceptance Criteria:**
  - Tournament includes all battle-ready robots (HP ≥75%, weapons equipped)
  - Excludes bye-robot and robots already in active tournaments
  - Excludes robots with scheduled league matches (conflict avoidance)
  - Generates initial bracket with proper seeding (by ELO)
  - Handles odd numbers with bye matches in first round
  - Sets tournament to "active" status

#### User Story 2.2: Bracket Generation
- **As a system**, I need to generate proper single elimination brackets
- **Acceptance Criteria:**
  - Seeds robots by ELO rating (highest vs lowest)
  - Calculates correct number of rounds: ceil(log2(participants))
  - First round pairs: #1 vs #16, #8 vs #9, etc. (power-of-2 bracket)
  - Assigns bye matches for odd participants
  - Creates TournamentMatch records for first round
  - Creates placeholder matches for future rounds

#### User Story 2.3: Round Execution
- **As a system**, I execute tournament rounds via battle orchestrator
- **Acceptance Criteria:**
  - Creates ScheduledMatch records for current round
  - ScheduledMatches marked with battleType: "tournament"
  - Links ScheduledMatch to TournamentMatch
  - Battle execution uses same combat simulator as league battles
  - Battle records link back to TournamentMatch
  - Winners advance to next round automatically

#### User Story 2.4: Tournament Progression
- **As a system**, I progress tournaments through rounds automatically
- **Acceptance Criteria:**
  - After round completes, winners populate next round matches
  - Current round increments
  - Final round (1 match remaining) determines tournament winner
  - Winner recorded in Tournament.winnerId
  - Tournament status changes to "completed"
  - User's championshipTitles increments for winner

#### User Story 2.5: Continuous Tournaments
- **As a system**, I start a new tournament when one completes
- **Acceptance Criteria:**
  - On tournament completion, check if new tournament should start
  - Auto-create new tournament if sufficient battle-ready robots exist
  - New tournament excludes recent tournament participants (cooldown: 1 cycle)
  - Seamless transition - no manual intervention needed
  - Configurable via admin settings (auto-start on/off)

### Epic 3: Battle Integration

**As a player**, I want tournament battles to integrate seamlessly with the existing battle system.

#### User Story 3.1: Tournament Battle Type
- **As a system**, I categorize tournament battles separately from league battles
- **Acceptance Criteria:**
  - Battle.battleType supports "tournament" (existing: "league")
  - Tournament battles use same combat simulator
  - Tournament battles generate same detailed battle logs
  - Battle reports display tournament context
  - ELO changes apply same as league battles

#### User Story 3.2: Multiple Upcoming Matches
- **As a player**, I can see all my upcoming matches (league + tournament)
- **Acceptance Criteria:**
  - ScheduledMatch queries return both league and tournament matches
  - UI displays match type clearly (league vs tournament)
  - Robots can have up to 2 upcoming matches simultaneously
  - No scheduling conflicts (can't schedule tournament match if league match exists for same time)
  - Battle readiness warnings account for both match types

#### User Story 3.3: Battle Reports
- **As a player**, I can view tournament battle results in my battle history
- **Acceptance Criteria:**
  - Battle history includes tournament battles
  - Tournament battles labeled clearly
  - Shows tournament name and round information
  - Links to tournament bracket view (future enhancement)
  - Same financial breakdown as league battles

### Epic 4: Financial Integration

**As a player**, I want to earn rewards for tournament participation and victories.

#### User Story 4.1: Tournament Rewards
- **As a player**, I earn enhanced rewards for tournament battles
- **Acceptance Criteria:**
  - **Participation Rewards**: Same as league battles (30% of league base)
  - **Win Rewards**: 1.5× league battle rewards (tournament bonus)
  - **Prestige**: 2× prestige for tournament wins vs league wins
  - **Fame**: 1.5× fame for tournament wins vs league wins
  - **Championship Title**: +1 championshipTitles for tournament winner
  - **Streaming Income**: Tournament battles count toward streaming multiplier

#### User Story 4.2: Reward Calculation
- **As a system**, I calculate tournament rewards using existing economy functions
- **Acceptance Criteria:**
  - Uses getLeagueBaseReward() for robot's current league
  - Applies tournament multiplier (1.5×) to win rewards
  - Applies prestige multiplier from user's prestige level
  - Awards participation reward to loser
  - Bye matches award reduced participation reward (50%)
  - All rewards deposited immediately after battle

#### User Story 4.3: Financial Tracking
- **As a player**, I can track my tournament earnings separately
- **Acceptance Criteria:**
  - Battle records include tournament rewards breakdown
  - User stats track total tournament earnings (future enhancement)
  - Financial reports distinguish league vs tournament income (future enhancement)

### Epic 5: Admin Integration

**As an admin**, I can control tournament execution and integrate with daily cycle.

#### User Story 5.1: Manual Tournament Trigger
- **As an admin**, I can manually start a tournament
- **Acceptance Criteria:**
  - POST /api/admin/tournaments/create endpoint
  - Creates tournament with all eligible robots
  - Returns tournament details (id, participants, bracket)
  - Error handling for insufficient participants

#### User Story 5.2: Tournament Round Execution
- **As an admin**, I can manually execute tournament rounds
- **Acceptance Criteria:**
  - POST /api/admin/tournaments/:id/execute-round endpoint
  - Executes current round battles
  - Advances to next round if all battles complete
  - Completes tournament if final round finishes
  - Returns round execution summary

#### User Story 5.3: Daily Cycle Integration
- **As an admin**, tournaments execute as part of daily cycle
- **Acceptance Criteria:**
  - /api/admin/cycles/bulk includes tournament execution
  - Step added: "Execute tournament rounds" (after league battles)
  - Auto-creates new tournament if none active and robots available
  - Configurable option: includeTournaments (default: true)
  - Tournament execution summary in cycle results

#### User Story 5.4: Tournament Status Endpoint
- **As an admin**, I can view active tournament status
- **Acceptance Criteria:**
  - GET /api/admin/tournaments endpoint lists all tournaments
  - GET /api/admin/tournaments/:id endpoint shows tournament details
  - Includes: current round, participants, bracket, winners
  - Shows pending matches in current round

---

## Technical Specifications

### Database Schema Changes

#### New Model: Tournament

```prisma
model Tournament {
  id              Int       @id @default(autoincrement())
  name            String    @db.VarChar(100) // "Tournament #1", "Grand Championship"
  tournamentType  String    @map("tournament_type") @db.VarChar(50) // "single_elimination", "double_elimination", "swiss"
  status          String    @default("pending") @db.VarChar(20) // "pending", "active", "completed"
  
  // Progression tracking
  currentRound    Int       @default(1) @map("current_round") // Current round number (1-based)
  maxRounds       Int       @map("max_rounds") // Total rounds (calculated from participants)
  totalParticipants Int     @map("total_participants") // Number of robots at start
  
  // Winner tracking
  winnerId        Int?      @map("winner_id") // Winner's robot ID (null until completed)
  
  // Timestamps
  createdAt       DateTime  @default(now()) @map("created_at")
  startedAt       DateTime? @map("started_at") // When first round started
  completedAt     DateTime? @map("completed_at") // When tournament finished
  
  // Relations
  winner          Robot?    @relation("TournamentWinner", fields: [winnerId], references: [id])
  matches         TournamentMatch[]
  
  @@index([status])
  @@index([winnerId])
  @@map("tournaments")
}
```

#### New Model: TournamentMatch

```prisma
model TournamentMatch {
  id           Int       @id @default(autoincrement())
  tournamentId Int       @map("tournament_id")
  round        Int       // Round number (1 = first round, 2 = quarter-finals, etc.)
  matchNumber  Int       @map("match_number") // Position in round (1, 2, 3, ...)
  
  // Participants
  robot1Id     Int?      @map("robot1_id") // Null for placeholder matches
  robot2Id     Int?      @map("robot2_id") // Null for bye matches or placeholders
  
  // Result
  winnerId     Int?      @map("winner_id") // Winner's robot ID (null until completed)
  battleId     Int?      @map("battle_id") // Links to Battle record
  status       String    @default("pending") @db.VarChar(20) // "pending", "scheduled", "completed"
  isByeMatch   Boolean   @default(false) @map("is_bye_match") // True if robot advances without battle
  
  // Timestamps
  createdAt    DateTime  @default(now()) @map("created_at")
  completedAt  DateTime? @map("completed_at")
  
  // Relations
  tournament   Tournament @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  robot1       Robot?     @relation("TournamentRobot1", fields: [robot1Id], references: [id])
  robot2       Robot?     @relation("TournamentRobot2", fields: [robot2Id], references: [id])
  winner       Robot?     @relation("TournamentMatchWinner", fields: [winnerId], references: [id])
  battle       Battle?    @relation(fields: [battleId], references: [id])
  
  @@index([tournamentId, round])
  @@index([status])
  @@index([robot1Id])
  @@index([robot2Id])
  @@map("tournament_matches")
}
```

#### Updated Model: Robot

```prisma
model Robot {
  // ... existing fields ...
  
  // Add tournament relations
  tournamentsWon          Tournament[]     @relation("TournamentWinner")
  tournamentMatchesAsRobot1 TournamentMatch[] @relation("TournamentRobot1")
  tournamentMatchesAsRobot2 TournamentMatch[] @relation("TournamentRobot2")
  tournamentMatchesWon     TournamentMatch[] @relation("TournamentMatchWinner")
  
  // ... rest of model ...
}
```

#### Updated Model: Battle

```prisma
model Battle {
  // ... existing fields ...
  
  // Change battleType to support "tournament"
  battleType String @map("battle_type") @db.VarChar(20) // "league", "tournament"
  
  // Add tournament reference (optional)
  tournamentId      Int?            @map("tournament_id")
  tournamentRound   Int?            @map("tournament_round")
  
  // Add relation
  tournamentMatches TournamentMatch[]
  
  @@index([tournamentId])
  
  // ... rest of model ...
}
```

### Service Architecture

#### Tournament Service (`tournamentService.ts`)

```typescript
// Core tournament management
export async function createSingleEliminationTournament(): Promise<Tournament>
export async function generateTournamentBracket(participants: Robot[]): Promise<TournamentMatch[]>
export async function executeCurrentRound(tournamentId: number): Promise<RoundExecutionSummary>
export async function advanceWinners(tournamentId: number): Promise<void>
export async function completeTournament(tournamentId: number): Promise<Tournament>
export async function autoCreateNextTournament(): Promise<Tournament | null>

// Query functions
export async function getActiveTournaments(): Promise<Tournament[]>
export async function getTournamentById(id: number): Promise<Tournament>
export async function getEligibleRobotsForTournament(): Promise<Robot[]>
export async function getCurrentRoundMatches(tournamentId: number): Promise<TournamentMatch[]>

// Helper functions
function calculateMaxRounds(participants: number): number
function seedRobotsByELO(robots: Robot[]): Robot[]
function createBracketPairs(seededRobots: Robot[]): TournamentMatch[]
```

#### Tournament Rewards (`tournamentRewards.ts`)

```typescript
// Tournament-specific reward calculations
export function calculateTournamentWinReward(baseReward: number, prestige: number): number
export function calculateTournamentPrestige(robot: Robot, round: number): number
export function calculateTournamentFame(robot: Robot, round: number, finalHP: number): number
export function calculateChampionshipBonus(robot: Robot): number

// Integration with existing economy
export async function awardTournamentRewards(battle: Battle, tournamentMatch: TournamentMatch): Promise<void>
```

#### Battle Orchestrator Updates (`battleOrchestrator.ts`)

```typescript
// Add tournament battle support
export async function processTournamentBattle(tournamentMatch: TournamentMatch): Promise<BattleResult>

// Update existing function signatures
export async function executeScheduledBattles(
  scheduledFor?: Date,
  battleType?: 'league' | 'tournament' | 'all' // New parameter
): Promise<BattleExecutionSummary>
```

### API Endpoints

#### Tournament Management

```
POST   /api/admin/tournaments/create
  Body: { tournamentType: "single_elimination" }
  Response: { tournament: Tournament, bracket: TournamentMatch[] }

POST   /api/admin/tournaments/:id/execute-round
  Response: { summary: RoundExecutionSummary }

POST   /api/admin/tournaments/:id/complete
  Response: { tournament: Tournament, winner: Robot }

GET    /api/admin/tournaments
  Query: ?status=active
  Response: { tournaments: Tournament[] }

GET    /api/admin/tournaments/:id
  Response: { tournament: Tournament, matches: TournamentMatch[], currentRound: TournamentMatch[] }
```

#### Daily Cycle Integration

```
POST   /api/admin/cycles/bulk
  Body: { 
    cycles: number,
    autoRepair: boolean,
    includeDailyFinances: boolean,
    includeTournaments: boolean // NEW
  }
  Response: { 
    success: true,
    results: [{
      cycle: number,
      matchmaking: {...},
      battles: {...},
      tournaments: TournamentExecutionSummary // NEW
    }]
  }
```

#### Player-Facing Endpoints (Future Enhancement)

```
GET    /api/tournaments
  Response: { active: Tournament[], completed: Tournament[] }

GET    /api/tournaments/:id
  Response: { tournament: Tournament, bracket: TournamentMatch[], myMatches: TournamentMatch[] }

GET    /api/robots/:id/tournaments
  Response: { upcoming: TournamentMatch[], history: TournamentMatch[] }
```

### Tournament Reward Formulas

#### Win Rewards (Tournament Multiplier)

```typescript
// Base formula (same as league)
const leagueReward = getLeagueBaseReward(robot.currentLeague).midpoint;
const prestigeMultiplier = getPrestigeMultiplier(user.prestige);
const baseReward = leagueReward * prestigeMultiplier;

// Tournament bonus
const TOURNAMENT_WIN_MULTIPLIER = 1.5;
const tournamentReward = baseReward * TOURNAMENT_WIN_MULTIPLIER;
```

#### Prestige Awards (Tournament Multiplier)

```typescript
// Base prestige by league (same as league battles)
const leaguePrestige = {
  bronze: 5,
  silver: 10,
  gold: 20,
  platinum: 30,
  diamond: 50,
  champion: 75,
}[robot.currentLeague];

// Tournament multiplier
const TOURNAMENT_PRESTIGE_MULTIPLIER = 2.0;
const tournamentPrestige = leaguePrestige * TOURNAMENT_PRESTIGE_MULTIPLIER;

// Championship title bonus (final round only)
if (isFinalRound && isWinner) {
  user.championshipTitles += 1;
  const CHAMPIONSHIP_PRESTIGE_BONUS = 500;
  tournamentPrestige += CHAMPIONSHIP_PRESTIGE_BONUS;
}
```

#### Fame Awards (Tournament Multiplier)

```typescript
// Base fame by league (same as league battles)
const leagueFame = {
  bronze: 2,
  silver: 5,
  gold: 10,
  platinum: 15,
  diamond: 25,
  champion: 40,
}[robot.currentLeague];

// Performance multipliers (same as league)
if (finalHP === maxHP) {
  leagueFame *= 2.0; // Perfect victory
} else if (finalHP / maxHP > 0.8) {
  leagueFame *= 1.5; // Dominating victory
} else if (finalHP / maxHP < 0.2) {
  leagueFame *= 1.25; // Comeback victory
}

// Tournament multiplier
const TOURNAMENT_FAME_MULTIPLIER = 1.5;
const tournamentFame = leagueFame * TOURNAMENT_FAME_MULTIPLIER;
```

#### Round-Based Bonuses (Progressive Rewards)

```typescript
// Later rounds = higher rewards
const roundMultipliers = {
  1: 1.0,    // First round (many participants)
  2: 1.2,    // Round of 16/32
  3: 1.4,    // Quarter-finals
  4: 1.6,    // Semi-finals
  5: 2.0,    // Finals
};

const roundBonus = roundMultipliers[round] || 1.0;
finalReward *= roundBonus;
```

---

## Business Logic & Rules

### Tournament Eligibility

**Robots eligible for tournament:**
- ✅ HP ≥ 75% (battle-ready threshold)
- ✅ All required weapons equipped (based on loadoutType)
- ✅ Not already participating in an active tournament
- ✅ Not the bye-robot (system robot)
- ⚠️ **Conflict Avoidance**: Can participate even if scheduled for league match (tournaments and leagues run independently)

**Tournament creation requirements:**
- Minimum participants: 4 robots
- Maximum participants: Unlimited (bracket size determined by participants)
- Auto-start: Only if ≥8 eligible robots available (ensures competitive field)

### Bracket Generation Algorithm

**Single Elimination Seeding:**

1. **Get Eligible Robots**: Query all battle-ready robots not in active tournaments
2. **Sort by ELO**: Highest to lowest (skill-based seeding)
3. **Calculate Rounds**: `maxRounds = Math.ceil(Math.log2(participants))`
4. **Handle Byes**: If participants not power of 2, highest seeds get byes
   - Example: 13 participants → 16-slot bracket → 3 byes (#1, #2, #3 seeds)
5. **Generate Pairings**: Traditional bracket structure
   - Round 1: #1 vs #16, #8 vs #9, #4 vs #13, #5 vs #12, etc.
6. **Create Placeholder Matches**: Future rounds have null robot IDs until winners determined

**Example Bracket (8 participants):**
```
Round 1 (4 matches):
  Match 1: Seed #1 vs Seed #8
  Match 2: Seed #4 vs Seed #5
  Match 3: Seed #2 vs Seed #7
  Match 4: Seed #3 vs Seed #6

Round 2 (2 matches):
  Match 5: Winner Match 1 vs Winner Match 2
  Match 6: Winner Match 3 vs Winner Match 4

Round 3 (1 match):
  Match 7: Winner Match 5 vs Winner Match 6 (FINALS)
```

### Tournament Progression Flow

```
1. Tournament Created → status: "pending"
   - Generate bracket
   - Create TournamentMatch records for all rounds
   - First round has robot IDs, later rounds have placeholders

2. Start Tournament → status: "active", currentRound: 1
   - Create ScheduledMatch records for Round 1
   - Link ScheduledMatch → TournamentMatch

3. Execute Round 1 Battles
   - Battle orchestrator processes scheduled matches
   - Battle records created with battleType: "tournament"
   - Winners recorded in TournamentMatch.winnerId

4. Advance to Round 2 → currentRound: 2
   - Populate Round 2 TournamentMatches with Round 1 winners
   - Create ScheduledMatch records for Round 2
   - Repeat until...

5. Final Round Completes → status: "completed"
   - Last match determines tournament winner
   - Tournament.winnerId = final match winner
   - User.championshipTitles += 1 for winner
   - completedAt timestamp set

6. Auto-Create Next Tournament
   - Check if sufficient eligible robots (≥8)
   - Create new tournament automatically
   - Exclude recent tournament participants (cooldown: 1 day)
```

### Conflict Management

**League vs Tournament Scheduling:**
- Robots CAN have both league and tournament matches scheduled
- Maximum 2 upcoming matches per robot (1 league + 1 tournament)
- Scheduled times must differ by ≥1 hour (prevents simultaneous battles)
- Battle readiness warnings account for both match types

**Tournament vs Tournament:**
- Robots CANNOT participate in multiple active tournaments simultaneously
- Tournament creation excludes robots already in active tournaments
- Tournament completion allows robot to enter next tournament

### Bye Match Handling

**When Byes Occur:**
- Participant count not a power of 2 (e.g., 13 participants → 3 byes in Round 1)

**Bye Match Rules:**
- Highest seeds receive byes (reward better ELO)
- TournamentMatch created with: robot1Id = seeded robot, robot2Id = null, isByeMatch = true
- No Battle record created (robot advances automatically)
- Reduced participation reward: 50% of normal (no combat effort)
- Robot takes no damage (fully repaired state maintained)
- Advances to next round immediately

### Tournament Rewards Summary

| **Reward Type** | **League Battle** | **Tournament Battle** | **Tournament Finals** |
|-----------------|-------------------|----------------------|----------------------|
| Win Credits     | Base reward       | Base × 1.5 × round   | Base × 1.5 × 2.0     |
| Loss Credits    | Participation (30%) | Participation (30%) | Participation (30%)  |
| Prestige (Win)  | League prestige   | League × 2.0         | League × 2.0 + 500   |
| Fame (Win)      | League fame       | League × 1.5         | League × 1.5 × 2.0   |
| Championship    | N/A               | N/A                  | +1 Title             |
| Streaming Income | Counts toward total | Counts toward total | Counts toward total |

---

## User Experience & UI/UX

### Admin Page - Tournament Controls

**New Section: Tournament Management**

**Manual Tournament Creation:**
```
┌─────────────────────────────────────────────────────┐
│ 🏆 Tournament Management                            │
├─────────────────────────────────────────────────────┤
│                                                       │
│  Current Status:                                      │
│  • Active Tournaments: 1                              │
│  • Eligible Robots: 47                                │
│                                                       │
│  [Create Single Elimination Tournament]               │
│                                                       │
│  Tournament #1 (Active)                               │
│  • Round: 2/4 (Quarter-finals)                        │
│  • Participants: 16                                   │
│  • Pending Matches: 4                                 │
│                                                       │
│  [Execute Current Round] [View Bracket]               │
└─────────────────────────────────────────────────────┘
```

**Daily Cycle Configuration:**
```
┌─────────────────────────────────────────────────────┐
│ ⚙️ Daily Cycle Settings                              │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ☑ Auto-repair robots                                 │
│  ☑ Include daily finances                             │
│  ☑ Include tournaments (NEW)                          │
│                                                       │
│  Cycles to run: [5]                                   │
│                                                       │
│  [Run Daily Cycle]                                    │
└─────────────────────────────────────────────────────┘
```

### My Robots Page - Multiple Upcoming Matches

**Upcoming Matches Display:**
```
┌─────────────────────────────────────────────────────┐
│ 📅 Upcoming Matches                                  │
├─────────────────────────────────────────────────────┤
│                                                       │
│  BattleBot-Alpha                                      │
│  ├─ League Match (Gold League)                        │
│  │  vs. IronCrusher | Tomorrow 10:00 AM              │
│  │                                                    │
│  └─ Tournament Match (Round 2)                        │
│     vs. ThunderStrike | Tomorrow 2:00 PM             │
│                                                       │
│  RoboCrusher-99                                       │
│  └─ Tournament Match (Finals!)                        │
│     vs. UltimateDestroyer | Tomorrow 6:00 PM         │
│                                                       │
└─────────────────────────────────────────────────────┘
```

### Battle History - Tournament Battles

**Battle List with Tournament Indicator:**
```
┌─────────────────────────────────────────────────────┐
│ 📜 Battle History                                    │
├─────────────────────────────────────────────────────┤
│                                                       │
│  🏆 TOURNAMENT #1 - Finals                            │
│  BattleBot-Alpha defeated RoboCrusher-99             │
│  Victory | +₡75,000 | +150 Prestige | +60 Fame      │
│  Championship Title Earned! 👑                        │
│                                                       │
│  🏆 Tournament #1 - Semi-finals                       │
│  BattleBot-Alpha defeated IronCrusher                │
│  Victory | +₡48,000 | +60 Prestige | +22 Fame       │
│                                                       │
│  ⚔️ League Battle (Gold League)                       │
│  BattleBot-Alpha defeated ThunderStrike              │
│  Victory | +₡30,000 | +20 Prestige | +10 Fame       │
│                                                       │
└─────────────────────────────────────────────────────┘
```

### Tournament Bracket View (Future Enhancement)

**Visual Bracket Display:**
```
┌─────────────────────────────────────────────────────┐
│ 🏆 Tournament #1 - Single Elimination                │
├─────────────────────────────────────────────────────┤
│                                                       │
│  Round 1          Round 2       Finals               │
│                                                       │
│  #1 Seed ──┐                                          │
│            ├─→ Winner 1 ──┐                           │
│  #8 Seed ──┘              │                           │
│                           ├─→ CHAMPION 👑             │
│  #4 Seed ──┐              │                           │
│            ├─→ Winner 2 ──┘                           │
│  #5 Seed ──┘                                          │
│                                                       │
│  Current Round: 2 (Semi-finals)                       │
│  Matches Remaining: 1                                 │
│                                                       │
└─────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Database & Core Framework (Week 1)

**Milestone 1.1: Database Migration**
- [ ] Create Tournament model migration
- [ ] Create TournamentMatch model migration
- [ ] Update Battle model (battleType, tournamentId fields)
- [ ] Update Robot model (add tournament relations)
- [ ] Add database indexes
- [ ] Run migration and test

**Milestone 1.2: Tournament Service Foundation**
- [ ] Create `tournamentService.ts` service
- [ ] Implement `createSingleEliminationTournament()`
- [ ] Implement `getEligibleRobotsForTournament()`
- [ ] Implement `seedRobotsByELO()`
- [ ] Implement `calculateMaxRounds()`
- [ ] Write unit tests for eligibility logic

### Phase 2: Bracket Generation (Week 1-2)

**Milestone 2.1: Bracket Algorithm**
- [ ] Implement `generateTournamentBracket()`
- [ ] Implement bye match handling
- [ ] Implement placeholder match creation
- [ ] Test bracket generation with various participant counts (4, 8, 13, 16, 32)
- [ ] Validate bracket structure

**Milestone 2.2: Tournament Match Management**
- [ ] Implement `getCurrentRoundMatches()`
- [ ] Implement `getTournamentById()`
- [ ] Implement `getActiveTournaments()`
- [ ] Write unit tests for query functions

### Phase 3: Tournament Execution (Week 2)

**Milestone 3.1: Round Execution**
- [ ] Implement `executeCurrentRound()`
- [ ] Create ScheduledMatch records from TournamentMatches
- [ ] Link TournamentMatch to Battle after execution
- [ ] Update `battleOrchestrator.ts` to support tournament battles
- [ ] Implement `processTournamentBattle()`

**Milestone 3.2: Progression Logic**
- [ ] Implement `advanceWinners()`
- [ ] Populate next round with winners
- [ ] Handle bye match advancement
- [ ] Increment current round
- [ ] Test multi-round progression

**Milestone 3.3: Tournament Completion**
- [ ] Implement `completeTournament()`
- [ ] Set winner in Tournament model
- [ ] Increment user's championshipTitles
- [ ] Set completedAt timestamp
- [ ] Test tournament completion flow

### Phase 4: Rewards Integration (Week 2-3)

**Milestone 4.1: Reward Calculations**
- [ ] Create `tournamentRewards.ts` utility
- [ ] Implement `calculateTournamentWinReward()`
- [ ] Implement `calculateTournamentPrestige()`
- [ ] Implement `calculateTournamentFame()`
- [ ] Implement `calculateChampionshipBonus()`
- [ ] Add round-based multipliers

**Milestone 4.2: Reward Application**
- [ ] Implement `awardTournamentRewards()`
- [ ] Update battle creation to use tournament rewards
- [ ] Test reward calculations with various scenarios
- [ ] Validate prestige and fame awards

### Phase 5: Admin Endpoints (Week 3)

**Milestone 5.1: Tournament Management APIs**
- [ ] POST /api/admin/tournaments/create
- [ ] POST /api/admin/tournaments/:id/execute-round
- [ ] GET /api/admin/tournaments
- [ ] GET /api/admin/tournaments/:id
- [ ] Test all endpoints with Postman/Thunder Client

**Milestone 5.2: Daily Cycle Integration**
- [ ] Update POST /api/admin/cycles/bulk
- [ ] Add includeTournaments parameter
- [ ] Integrate tournament execution into cycle
- [ ] Test cycle with tournaments enabled/disabled

**Milestone 5.3: Auto-Tournament Creation**
- [ ] Implement `autoCreateNextTournament()`
- [ ] Add cooldown logic (exclude recent participants)
- [ ] Test continuous tournament flow
- [ ] Validate no duplicate entries

### Phase 6: Frontend Updates (Week 3-4)

**Milestone 6.1: Admin Page UI**
- [ ] Add Tournament Management section
- [ ] Create tournament button and status display
- [ ] Add execute round button
- [ ] Update daily cycle config to include tournaments
- [ ] Test UI interactions

**Milestone 6.2: My Robots Page Updates**
- [ ] Update upcoming matches query to include tournaments
- [ ] Display tournament matches alongside league matches
- [ ] Add tournament badge/indicator
- [ ] Show tournament round information
- [ ] Test with robots having both match types

**Milestone 6.3: Battle History Updates**
- [ ] Update battle list to distinguish tournament battles
- [ ] Add tournament badge/icon
- [ ] Display tournament name and round
- [ ] Show championship title award notification
- [ ] Test filtering and display

### Phase 7: Testing & Validation (Week 4)

**Milestone 7.1: Unit Tests**
- [ ] Test bracket generation (all participant counts)
- [ ] Test eligibility filtering
- [ ] Test reward calculations
- [ ] Test progression logic
- [ ] Test bye match handling

**Milestone 7.2: Integration Tests**
- [ ] Test complete tournament flow (create → execute → complete)
- [ ] Test tournament + league battle coexistence
- [ ] Test daily cycle with tournaments
- [ ] Test edge cases (1 robot, max robots)

**Milestone 7.3: Manual Testing**
- [ ] Create tournament via admin
- [ ] Execute multiple rounds
- [ ] Verify rewards awarded correctly
- [ ] Check battle history display
- [ ] Validate database state at each step

### Phase 8: Documentation & Deployment (Week 4)

**Milestone 8.1: Documentation**
- [ ] Update DATABASE_SCHEMA.md with new models
- [ ] Create TOURNAMENT_SYSTEM_GUIDE.md (user guide)
- [ ] Update ARCHITECTURE.md with tournament flow
- [ ] Add API documentation for new endpoints

**Milestone 8.2: Deployment Preparation**
- [ ] Review all code for quality
- [ ] Run full test suite
- [ ] Test database migrations
- [ ] Create deployment checklist

---

## Risk Assessment & Mitigation

### High Risk Issues

**Risk 1: Scheduling Conflicts (League + Tournament)**
- **Impact**: High - Could double-schedule robots or prevent participation
- **Likelihood**: Medium
- **Mitigation**: 
  - Strict validation before creating tournament matches
  - Check for existing scheduled matches before pairing
  - Add time buffer between match types (1+ hours)
  - Comprehensive conflict detection in eligibility checks

**Risk 2: Tournament State Corruption**
- **Impact**: High - Could break tournament progression
- **Likelihood**: Low-Medium
- **Mitigation**:
  - Use database transactions for state updates
  - Validate tournament state before each operation
  - Add rollback capability for failed rounds
  - Log all state changes for debugging

**Risk 3: Reward Calculation Errors**
- **Impact**: Medium-High - Could unbalance economy
- **Likelihood**: Low
- **Mitigation**:
  - Extensive unit tests for reward formulas
  - Compare tournament vs league rewards in tests
  - Add financial audit logging
  - Implement reward caps/sanity checks

### Medium Risk Issues

**Risk 4: Bracket Generation Bugs (Odd Participants)**
- **Impact**: Medium - Could create invalid brackets
- **Likelihood**: Medium
- **Mitigation**:
  - Test all participant counts (especially non-powers of 2)
  - Validate bracket structure after generation
  - Add logging for bye match creation
  - Create extensive test cases (1-100 participants)

**Risk 5: Continuous Tournament Overload**
- **Impact**: Medium - Could overwhelm system with battles
- **Likelihood**: Low
- **Mitigation**:
  - Add minimum participant threshold (≥8 robots)
  - Implement cooldown between tournaments
  - Make auto-creation configurable (admin toggle)
  - Monitor system load in production

**Risk 6: UI Complexity (Multiple Matches per Robot)**
- **Impact**: Low-Medium - Could confuse players
- **Likelihood**: Medium
- **Mitigation**:
  - Clear visual distinction between league/tournament
  - Limit to 2 upcoming matches max
  - Group matches by type
  - Add tooltips and help text

### Low Risk Issues

**Risk 7: Tournament History Performance**
- **Impact**: Low - Could slow down queries with many tournaments
- **Likelihood**: Low
- **Mitigation**:
  - Add database indexes on tournament queries
  - Paginate tournament lists
  - Archive completed tournaments after threshold
  - Use caching for active tournament data

---

## Success Criteria & Acceptance Tests

### Functional Acceptance Tests

**Test 1: Tournament Creation**
- ✅ Creates tournament with eligible robots only
- ✅ Excludes robots with <75% HP
- ✅ Excludes robots without weapons
- ✅ Excludes bye-robot
- ✅ Excludes robots already in active tournament
- ✅ Generates correct bracket structure
- ✅ Handles odd participant counts with byes

**Test 2: Tournament Execution**
- ✅ Executes current round battles successfully
- ✅ Records winners in TournamentMatch
- ✅ Advances winners to next round
- ✅ Increments current round counter
- ✅ Completes tournament when final round finishes
- ✅ Awards championship title to winner

**Test 3: Financial Integration**
- ✅ Awards correct win rewards (1.5× league base)
- ✅ Awards correct participation rewards
- ✅ Awards correct prestige (2× league base)
- ✅ Awards correct fame (1.5× league base)
- ✅ Applies round multipliers correctly
- ✅ Awards championship bonus in finals

**Test 4: Battle Integration**
- ✅ Creates Battle records with battleType: "tournament"
- ✅ Links Battle to TournamentMatch
- ✅ Generates correct battle logs
- ✅ Updates robot stats (HP, ELO, wins/losses)
- ✅ Tournament battles appear in battle history

**Test 5: Admin Control**
- ✅ Manual tournament creation works
- ✅ Manual round execution works
- ✅ Daily cycle includes tournament execution
- ✅ Auto-creation works when tournament completes
- ✅ Tournament status queries work

### Performance Acceptance Tests

**Test 6: Scalability**
- ✅ Tournament creation completes in <5 seconds (100 participants)
- ✅ Bracket generation handles 256+ participants
- ✅ Round execution processes all matches without timeout
- ✅ Queries for active tournaments return in <1 second

### User Experience Acceptance Tests

**Test 7: UI Clarity**
- ✅ Tournament matches clearly distinguished from league matches
- ✅ Upcoming matches display both types correctly
- ✅ Battle history shows tournament context
- ✅ Admin page displays tournament status clearly

---

## Future Enhancements (Phase 2+)

### Advanced Tournament Types
- **Double Elimination**: Losers bracket for second chances
- **Swiss-Style**: Round-robin with pairing algorithm
- **Team Tournaments**: 2v2 and 3v3 elimination brackets
- **Ladder Tournaments**: Continuous ranking with challenges

### Tournament Features
- **Prize Pools**: Accumulated entry fees or sponsor contributions
- **Seeding Options**: Manual seeding, random seeding, historical performance
- **Tournament Tiers**: Bronze-only, Gold+, All-league tournaments
- **Special Rules**: Weapon restrictions, attribute caps, themed tournaments

### Player Features
- **Tournament Registration**: Opt-in instead of auto-entry
- **Entry Fees**: Pay credits to join premium tournaments
- **Tournament History**: Detailed stats and achievements
- **Bracket Predictions**: Let players predict outcomes

### Visual Enhancements
- **Bracket Visualization**: Interactive tournament tree
- **Live Updates**: Real-time match results during execution
- **Spectator Mode**: Watch tournament battles as they occur
- **Highlight Reels**: Best moments from tournament battles

---

## Appendix

### Glossary

- **Tournament**: A structured competitive event where robots compete in elimination rounds
- **Bracket**: The structured pairing of participants showing progression path
- **Round**: A set of matches in a tournament (all participants battle once per round)
- **Bye Match**: A non-combat advancement when participant count isn't a power of 2
- **Seeding**: Ranking participants to ensure fair pairings (highest vs lowest)
- **Championship Title**: Achievement awarded to tournament winner (stored in User.championshipTitles)
- **Tournament Battle**: A battle with battleType: "tournament" (distinct from league battles)

### Reference Documentation

- **PRD_MATCHMAKING.md**: Matchmaking algorithm and league battle system
- **PRD_ECONOMY_SYSTEM.md**: Financial calculations and reward structures
- **DATABASE_SCHEMA.md**: Complete database schema and relationships
- **BATTLE_REWARDS_IMPLEMENTATION.md**: Battle reward calculation details

### Database Diagram (Simplified)

```
Tournament
  ├─→ TournamentMatch (1:N)
  │     ├─→ Robot (robot1Id)
  │     ├─→ Robot (robot2Id)
  │     ├─→ Robot (winnerId)
  │     └─→ Battle (battleId)
  └─→ Robot (winnerId)

User
  └─→ Robot (1:N)
        ├─→ Battle (1:N)
        │     └─→ TournamentMatch (1:1)
        └─→ ScheduledMatch (1:N)
```

### Example API Workflow

```
1. Admin creates tournament:
   POST /api/admin/tournaments/create
   → Returns tournament with 16 participants, 4 rounds

2. Admin checks status:
   GET /api/admin/tournaments/1
   → Shows Round 1, 8 pending matches

3. Admin executes Round 1:
   POST /api/admin/tournaments/1/execute-round
   → Creates 8 scheduled matches, executes battles
   → Returns summary: 8 battles completed, 8 winners

4. Admin executes Round 2:
   POST /api/admin/tournaments/1/execute-round
   → 4 matches executed, quarter-finals complete

5. Auto-progression continues:
   → Semi-finals executed
   → Finals executed
   → Tournament completes
   → Winner awarded championship title
   → New tournament auto-created

6. Player views their robot:
   GET /api/robots/123
   → Shows: 1 league match, 1 tournament match upcoming
   → Battle history shows tournament victories
```

---

## Conclusion

This PRD provides a comprehensive specification for implementing the Tournament System in Armoured Souls. The design emphasizes:
- **Flexibility**: Framework supports multiple tournament types
- **Integration**: Works seamlessly with existing league battles and economy
- **Automation**: Tournaments run continuously without manual intervention
- **Player Value**: Enhanced rewards and prestige for competitive events

The phased implementation plan ensures incremental delivery with testable milestones. The single elimination tournament provides immediate competitive value while establishing the foundation for future tournament types (double elimination, team tournaments, etc.).

**Next Steps:**
1. Review and approve PRD
2. Create database migrations (Phase 1)
3. Implement core tournament service (Phase 2-3)
4. Integrate with battle system (Phase 4)
5. Deploy admin controls (Phase 5)
6. Update frontend UIs (Phase 6)
7. Comprehensive testing (Phase 7)

**Estimated Timeline**: 4 weeks for full implementation
**Dependencies**: Requires existing battle system, matchmaking, and economy systems (all currently implemented)
