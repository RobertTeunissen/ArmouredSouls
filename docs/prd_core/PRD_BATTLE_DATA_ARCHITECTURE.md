# Product Requirements Document: Battle Data Architecture

**Last Updated**: February 23, 2026  
**Status**: ✅ Implemented  
**Owner**: Robert Teunissen  
**Epic**: Battle System - Data Architecture

---

## Executive Summary

This PRD documents the BattleParticipant table architecture, which provides a normalized, scalable approach to storing per-robot battle data. This architecture replaces the previous denormalized Battle table structure that stored robot1/robot2 data in separate columns.

**Key Achievement**: The BattleParticipant table enables consistent data structure across all battle types (1v1, tournament, tag team) and scales infinitely to support future N-player battle modes.

---

## Background & Context

### Problem Statement

The original Battle table stored per-robot data in denormalized columns:
- `robot1Id`, `robot2Id` (robot identification)
- `robot1ELOBefore`, `robot2ELOBefore`, `robot1ELOAfter`, `robot2ELOAfter` (ELO tracking)
- `robot1DamageDealt`, `robot2DamageDealt` (battle stats)
- `robot1FinalHP`, `robot2FinalHP` (outcome data)
- `robot1PrestigeAwarded`, `robot2PrestigeAwarded` (rewards)
- `robot1FameAwarded`, `robot2FameAwarded` (reputation)
- Plus additional fields for tag team battles (team1ActiveRobotId, team1ReserveRobotId, etc.)

**Problems with this approach:**
- ❌ Queries required OR conditions: `WHERE robotId = X OR robot2Id = X`
- ❌ Different structure for different battle types (1v1 vs tag team)
- ❌ Cannot scale beyond 2v2 without adding more columns
- ❌ Complex conditional logic to determine if robot is "robot1" or "robot2"
- ❌ Duplicate code for handling robot1 vs robot2 data
- ❌ 26+ redundant columns in Battle table

### Solution: BattleParticipant Table

Create a separate table with **one record per robot per battle**, normalizing the data structure and enabling consistent queries across all battle types.

---

## Architecture Design

### Database Schema

#### BattleParticipant Table

```prisma
model BattleParticipant {
  id                Int      @id @default(autoincrement())
  battleId          Int
  robotId           Int
  userId            Int      // Denormalized for query performance
  team              Int      // 1 or 2
  role              String?  // "active" or "reserve" for tag team, null for 1v1
  
  // Economic effects
  credits           Int
  streamingRevenue  Int
  
  // Stat changes
  eloBefore         Int
  eloAfter          Int
  prestigeAwarded   Int
  fameAwarded       Int
  
  // Battle stats
  damageDealt       Int
  finalHP           Int
  yielded           Boolean
  destroyed         Boolean
  
  // Relationships
  battle  Battle @relation(fields: [battleId], references: [id], onDelete: Cascade)
  robot   Robot  @relation(fields: [robotId], references: [id])
  user    User   @relation(fields: [userId], references: [id])
  
  // Indexes
  @@index([battleId])
  @@index([robotId])
  @@index([userId])
  @@index([battleId, team])
  @@unique([battleId, robotId]) // Each robot appears once per battle
}
```

#### Simplified Battle Table

After migration, the Battle table contains only core battle information:

```prisma
model Battle {
  id            Int      @id @default(autoincrement())
  battleType    String   // "1v1", "tournament", "tag_team"
  winnerId      Int?     // Team number (1 or 2) or null for draw
  
  // Timing
  startTime     DateTime
  endTime       DateTime
  duration      Int
  
  // Context
  cycleNumber   Int
  leagueType    String?  // null for tournaments
  
  // Battle log (combat narrative)
  battleLog     String?
  
  // Relations
  participants  BattleParticipant[]
  
  @@index([cycleNumber])
  @@index([battleType])
}
```

### Data Structure by Battle Type

#### 1v1 Battles
- **2 BattleParticipant records** (one per robot)
- `team`: 1 or 2
- `role`: null
- Winner determined by `Battle.winnerId` matching participant's `team`

#### Tournament Battles
- **2 BattleParticipant records** (one per robot)
- Same structure as 1v1
- `Battle.battleType = "tournament"`

#### Tag Team Battles
- **4 BattleParticipant records** (2 per team)
- `team`: 1 or 2
- `role`: "active" or "reserve"
- Credits split evenly between team members
- ELO changes only for active robots

---

## Benefits

### 1. Consistent Query Structure

**Before (Battle table):**
```typescript
// Complex OR condition
const battles = await prisma.battle.findMany({
  where: {
    OR: [
      { robot1Id: robotId },
      { robot2Id: robotId }
    ]
  }
});

// Conditional logic to extract data
battles.forEach(battle => {
  const isRobot1 = battle.robot1Id === robotId;
  const credits = isRobot1 ? battle.winnerReward : battle.loserReward;
  const elo = isRobot1 ? battle.robot1ELOAfter : battle.robot2ELOAfter;
  // ... more conditionals
});
```

**After (BattleParticipant table):**
```typescript
// Simple direct query
const participants = await prisma.battleParticipant.findMany({
  where: { robotId },
  include: { battle: true }
});

// Direct data access
participants.forEach(participant => {
  const credits = participant.credits;
  const elo = participant.eloAfter;
  // No conditionals needed!
});
```

### 2. Scalability

**Current support:**
- 1v1: 2 participants
- Tag team (2v2): 4 participants

**Future support (no schema changes needed):**
- 3v3: 6 participants
- 5v5: 10 participants
- Battle royale: N participants

### 3. Complete Data Capture

Every participant record includes:
- Economic data (credits, streaming revenue)
- Performance data (ELO changes, prestige, fame)
- Battle stats (damage dealt, final HP)
- Outcome data (yielded, destroyed)

### 4. Simplified Code

**Removed complexity:**
- No robot1/robot2 conditional logic
- No different code paths for different battle types
- No duplicate field handling
- Consistent API responses

---

## Migration Strategy

### Implementation Phases

The migration was executed in 7 stages to ensure zero downtime:

#### Stage 1: Create Table ✅
- Added BattleParticipant table to schema
- Created indexes for performance
- Risk: None (empty table)

#### Stage 2: Backfill Data ✅
- Populated BattleParticipant from existing Battle records
- Converted robot1/robot2 columns to participant records
- Risk: Low (read-only operation)

#### Stage 3: Dual-Read ✅
- Updated code to read from BattleParticipant
- Added fallback to Battle table for old data
- Risk: Low (graceful degradation)

#### Stage 4: Dual-Write ✅
- Battle orchestrators write to BOTH tables
- Ensures consistency during transition
- Risk: Medium (requires transaction consistency)

#### Stage 5: Single-Write ✅
- Write ONLY to BattleParticipant
- Stop writing redundant Battle columns
- Risk: Medium (Battle columns become stale)

#### Stage 6: Remove Columns ✅
- Dropped 26+ redundant columns from Battle table
- Irreversible change (requires backup)
- Risk: High (data loss if rollback needed)

#### Stage 7: Update Documentation ✅
- Updated all markdown files
- Updated API documentation
- Updated code examples

### Columns Removed from Battle Table

**26+ columns removed:**
- Robot identification (6): robot1Id, robot2Id, team1ActiveRobotId, team2ActiveRobotId, team1ReserveRobotId, team2ReserveRobotId
- ELO tracking (4): robot1ELOBefore, robot1ELOAfter, robot2ELOBefore, robot2ELOAfter
- Prestige & Fame (4): robot1PrestigeAwarded, robot2PrestigeAwarded, robot1FameAwarded, robot2FameAwarded
- Battle stats (4): robot1DamageDealt, robot2DamageDealt, robot1FinalHP, robot2FinalHP
- Battle outcome (4): robot1Yielded, robot2Yielded, robot1Destroyed, robot2Destroyed
- Economic data (2+): winnerReward, loserReward
- Tag team specific (2+): team1ActiveDamageDealt, team2ActiveDamageDealt, etc.

---

## API Impact

### Battle Creation

**Battle Orchestrators Updated:**
- `battleOrchestrator.ts` - 1v1 and league battles
- `tournamentBattleOrchestrator.ts` - Tournament battles
- `tagTeamBattleOrchestrator.ts` - Tag team battles

**New pattern:**
```typescript
// Create battle record
const battle = await prisma.battle.create({
  data: {
    battleType: '1v1',
    winnerId: winner.team,
    startTime, endTime, duration,
    cycleNumber, leagueType,
    battleLog
  }
});

// Create participant records
await prisma.battleParticipant.createMany({
  data: [
    {
      battleId: battle.id,
      robotId: robot1.id,
      userId: robot1.userId,
      team: 1,
      role: null,
      credits: winnerCredits,
      streamingRevenue: robot1Streaming,
      eloBefore: robot1.elo,
      eloAfter: newElo1,
      prestigeAwarded: prestige1,
      fameAwarded: fame1,
      damageDealt: damage1,
      finalHP: hp1,
      yielded: false,
      destroyed: hp1 === 0
    },
    {
      battleId: battle.id,
      robotId: robot2.id,
      userId: robot2.userId,
      team: 2,
      role: null,
      credits: loserCredits,
      streamingRevenue: robot2Streaming,
      eloBefore: robot2.elo,
      eloAfter: newElo2,
      prestigeAwarded: prestige2,
      fameAwarded: fame2,
      damageDealt: damage2,
      finalHP: hp2,
      yielded: false,
      destroyed: hp2 === 0
    }
  ]
});
```

### Battle Queries

**API Endpoints Updated:**
- `GET /api/matches/battles/:id/log` - Battle detail
- `GET /api/records` - Hall of Records
- `GET /api/analytics/robot/:robotId/performance` - Robot analytics
- `GET /api/admin/battles/:id` - Admin battle details

**New response format:**
```typescript
{
  id: 102,
  battleType: "1v1",
  winnerId: 2,
  startTime: "2026-02-20T10:00:00Z",
  endTime: "2026-02-20T10:00:45Z",
  duration: 45,
  cycleNumber: 2,
  leagueType: "bronze",
  participants: [
    {
      id: 1,
      robotId: 54,
      userId: 60,
      team: 1,
      role: null,
      credits: 1315,
      streamingRevenue: 1002,
      eloBefore: 1200,
      eloAfter: 1195,
      prestigeAwarded: 3,
      fameAwarded: 13,
      damageDealt: 450,
      finalHP: 0,
      yielded: false,
      destroyed: true
    },
    {
      id: 2,
      robotId: 75,
      userId: 61,
      team: 2,
      role: null,
      credits: 4383,
      streamingRevenue: 1004,
      eloBefore: 1210,
      eloAfter: 1215,
      prestigeAwarded: 3,
      fameAwarded: 13,
      damageDealt: 500,
      finalHP: 850,
      yielded: false,
      destroyed: false
    }
  ]
}
```

---

## Performance Considerations

### Indexes

**Critical indexes for query performance:**
```sql
CREATE INDEX "BattleParticipant_battleId_idx" ON "BattleParticipant"("battleId");
CREATE INDEX "BattleParticipant_robotId_idx" ON "BattleParticipant"("robotId");
CREATE INDEX "BattleParticipant_userId_idx" ON "BattleParticipant"("userId");
CREATE INDEX "BattleParticipant_battleId_team_idx" ON "BattleParticipant"("battleId", "team");
CREATE UNIQUE INDEX "BattleParticipant_battleId_robotId_key" ON "BattleParticipant"("battleId", "robotId");
```

### Query Patterns

**Efficient queries:**
- Get all battles for a robot: `WHERE robotId = X` (uses robotId index)
- Get all battles for a user: `WHERE userId = X` (uses userId index)
- Get participants for a battle: `WHERE battleId = X` (uses battleId index)
- Get team members: `WHERE battleId = X AND team = 1` (uses composite index)

**Query performance:**
- Battle list: < 100ms
- Battle details: < 50ms
- Robot battle history: < 100ms
- Leaderboard queries: < 200ms

---

## Data Integrity

### Constraints

**Unique constraint:**
- Each robot can appear only once per battle
- `@@unique([battleId, robotId])`

**Cascade delete:**
- Deleting a battle deletes all participants
- `onDelete: Cascade`

**Validation rules:**
- `team` must be 1 or 2
- `role` must be null, "active", or "reserve"
- `credits` must be non-negative
- `eloBefore` and `eloAfter` must be valid ELO values (800-2500)

### Consistency Checks

**Participant count validation:**
- 1v1 battles: exactly 2 participants
- Tournament battles: exactly 2 participants
- Tag team battles: exactly 4 participants

**Team balance validation:**
- Each team must have at least 1 participant
- Tag team: each team must have 1 active and 1 reserve

**Economic validation:**
- Sum of participant credits should match battle rewards
- Streaming revenue should be non-negative

---

## Testing

### Unit Tests

**BattleParticipant CRUD:**
- ✅ Create participant
- ✅ Read participant
- ✅ Query by battle
- ✅ Query by robot
- ✅ Query by user

**Data integrity:**
- ✅ Unique constraint (battleId + robotId)
- ✅ Cascade delete
- ✅ Valid team values
- ✅ Valid role values

### Integration Tests

**Battle creation:**
- ✅ 1v1 battle creates 2 participants
- ✅ Tournament battle creates 2 participants
- ✅ Tag team battle creates 4 participants
- ✅ All fields populated correctly

**Battle queries:**
- ✅ Get battle with participants
- ✅ Get all battles for robot
- ✅ Get all battles for user
- ✅ Filter by battle type
- ✅ Filter by cycle

**Data consistency:**
- ✅ Participant count matches battle type
- ✅ Team assignments correct
- ✅ Role assignments correct (tag team)
- ✅ Credits sum correctly
- ✅ ELO changes tracked

### Performance Tests

**Query performance:**
- ✅ Battle list query < 100ms
- ✅ Battle details query < 50ms
- ✅ Robot battles query < 100ms
- ✅ Leaderboard query < 200ms

**Large dataset:**
- ✅ Tested with 10,000+ battles
- ✅ Tested with 100+ robots
- ✅ Tested with 50+ users
- ✅ Indexes used correctly

---

## Related Documentation

### Core Documents
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - Complete database schema
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture overview
- [PRD_AUDIT_SYSTEM.md](PRD_AUDIT_SYSTEM.md) - Audit log architecture (related)

### Implementation Files
- `prototype/backend/prisma/schema.prisma` - Schema definition
- `prototype/backend/src/services/battleOrchestrator.ts` - 1v1 battle creation
- `prototype/backend/src/services/tournamentBattleOrchestrator.ts` - Tournament battles
- `prototype/backend/src/services/tagTeamBattleOrchestrator.ts` - Tag team battles

### Migration Documents
- `BATTLEPARTICIPANT_IMPLEMENTATION.md` - Implementation guide
- `BATTLEPARTICIPANT_MIGRATION_COMPLETE.md` - Migration completion notes
- `BATTLE_TABLE_CLEANUP_COMPLETE.md` - Column removal completion

---

## Future Enhancements

### Potential Extensions

**Multi-team battles:**
- 3-team battles (team 1, 2, 3)
- Free-for-all (each robot is own team)
- No schema changes needed!

**Additional participant data:**
- Ability usage tracking
- Damage breakdown by type
- Healing/support stats
- Positioning data

**Performance optimizations:**
- Materialized views for common queries
- Denormalized summary fields
- Caching strategies

---

## Status: ✅ COMPLETE

**Implementation:** Fully implemented and tested  
**Migration:** Successfully completed  
**Documentation:** Updated  
**Status:** Production-ready

All battle data now uses the BattleParticipant table architecture. The system supports 1v1, tournament, and tag team battles with a consistent, scalable data structure.
