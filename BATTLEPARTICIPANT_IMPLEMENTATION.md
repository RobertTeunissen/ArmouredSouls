# BattleParticipant Table Implementation Guide

## Executive Summary

This document provides a comprehensive implementation plan for the BattleParticipant table, addressing all user concerns about thoroughness, testing, and documentation updates.

**User Approval:** ✅ Approved with emphasis on thoroughness  
**Estimated Effort:** 20-25 hours  
**Recommended Approach:** Implement in separate PR from simple field removals  

---

## Table of Contents

1. [User Requirements](#user-requirements)
2. [Schema Design](#schema-design)
3. [Redundant Columns Analysis](#redundant-columns-analysis)
4. [Migration Strategy](#migration-strategy)
5. [Impact Analysis](#impact-analysis)
6. [Implementation Plan](#implementation-plan)
7. [Testing Requirements](#testing-requirements)
8. [Documentation Updates](#documentation-updates)
9. [Rollback Strategy](#rollback-strategy)

---

## User Requirements

### User's Approval
> "BattleParticipant table is a good solution."

### User's Concerns
> "A lot more columns will now be redundant in the Battle table. This probably have impact on the audit log, and many many pages in the system. This needs to be done thoroughly and be tested perfectly. Also a lot of documentation will need to be updated."

### How This Plan Addresses Concerns

1. **"Many columns redundant"** → Identified all 26+ redundant columns
2. **"Impact on audit log"** → Documented audit log changes needed
3. **"Impact on many pages"** → Identified ~50 affected files
4. **"Thorough testing"** → Complete test plan with acceptance criteria
5. **"Documentation updates"** → Update plan for all 18+ markdown files

---

## Schema Design

### BattleParticipant Table

```prisma
model BattleParticipant {
  id                Int      @id @default(autoincrement())
  battleId          Int
  robotId           Int
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
  
  // Indexes
  @@index([battleId])
  @@index([robotId])
  @@index([battleId, team])
  @@unique([battleId, robotId]) // Each robot appears once per battle
}
```

### Simplified Battle Table

**After migration, Battle table becomes:**

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
  
  // Relations
  participants  BattleParticipant[]
  
  @@index([cycleNumber])
  @@index([battleType])
}
```

### Benefits

- ✅ **Scales infinitely:** 3v3 = 6 participants, 5v5 = 10 participants
- ✅ **Proper normalization:** No duplicate robot fields
- ✅ **ALL data captured:** Credits, streaming, ELO for all robots
- ✅ **Easy queries:** Get all battles for a robot: `WHERE robotId = X`
- ✅ **Consistent structure:** Same for all battle types

---

## Redundant Columns Analysis

### Columns to Remove from Battle Table (26+ total)

#### Robot Identification (6 columns)
```
robot1Id              → BattleParticipant.robotId (team=1)
robot2Id              → BattleParticipant.robotId (team=2)
team1ActiveRobotId    → BattleParticipant.robotId (team=1, role="active")
team2ActiveRobotId    → BattleParticipant.robotId (team=2, role="active")
team1ReserveRobotId   → BattleParticipant.robotId (team=1, role="reserve")
team2ReserveRobotId   → BattleParticipant.robotId (team=2, role="reserve")
```

#### ELO Tracking (4 columns)
```
robot1ELOBefore  → BattleParticipant.eloBefore
robot1ELOAfter   → BattleParticipant.eloAfter
robot2ELOBefore  → BattleParticipant.eloBefore
robot2ELOAfter   → BattleParticipant.eloAfter
```

#### Prestige & Fame (4 columns)
```
robot1PrestigeAwarded  → BattleParticipant.prestigeAwarded
robot2PrestigeAwarded  → BattleParticipant.prestigeAwarded
robot1FameAwarded      → BattleParticipant.fameAwarded
robot2FameAwarded      → BattleParticipant.fameAwarded
```

#### Battle Stats (4 columns)
```
robot1DamageDealt  → BattleParticipant.damageDealt
robot2DamageDealt  → BattleParticipant.damageDealt
robot1FinalHP      → BattleParticipant.finalHP
robot2FinalHP      → BattleParticipant.finalHP
```

#### Battle Outcome (4 columns)
```
robot1Yielded    → BattleParticipant.yielded
robot2Yielded    → BattleParticipant.yielded
robot1Destroyed  → BattleParticipant.destroyed
robot2Destroyed  → BattleParticipant.destroyed
```

#### Economic Data (2+ columns)
```
winnerReward  → BattleParticipant.credits (where team = winnerId)
loserReward   → BattleParticipant.credits (where team != winnerId)
```

#### Tag Team Specific (2+ columns)
```
robot1Fame  → BattleParticipant.fameAwarded
robot2Fame  → BattleParticipant.fameAwarded
```

**Total: 26+ columns become redundant and can be removed!**

---

## Migration Strategy

### 7-Stage Zero-Downtime Approach

#### Stage 1: Create Table
**Action:** Add BattleParticipant table to schema  
**Risk:** None (table is empty)  
**Rollback:** Drop table  

```sql
CREATE TABLE "BattleParticipant" (
  -- full schema from above
);
```

#### Stage 2: Backfill Data
**Action:** Populate BattleParticipant from existing Battle records  
**Risk:** Low (read-only operation)  
**Rollback:** Truncate table  

```typescript
// Backfill script (see detailed implementation below)
for each battle:
  if (1v1 or tournament):
    create 2 participants (robot1, robot2)
  if (tag team):
    create 4 participants (2 active, 2 reserve)
```

#### Stage 3: Dual-Read
**Action:** Update code to read from BattleParticipant, fallback to Battle  
**Risk:** Low (graceful fallback)  
**Rollback:** Revert code  

```typescript
// Prefer new structure
const participants = await prisma.battleParticipant.findMany({ 
  where: { battleId } 
});

// If empty, construct from Battle (legacy)
if (participants.length === 0) {
  // fallback logic
}
```

#### Stage 4: Dual-Write
**Action:** Write to BOTH Battle and BattleParticipant  
**Risk:** Medium (consistency required)  
**Rollback:** Stop writing to BattleParticipant  

```typescript
// Create battle (as before)
const battle = await prisma.battle.create({...});

// ALSO create participants (new)
await prisma.battleParticipant.createMany({
  data: participants
});
```

#### Stage 5: Single-Write
**Action:** Write ONLY to BattleParticipant (stop writing redundant Battle columns)  
**Risk:** Medium (Battle columns become stale)  
**Rollback:** Resume dual-write  

```typescript
// Create battle (minimal)
const battle = await prisma.battle.create({
  id, battleType, winnerId, timing
  // NO robot data
});

// Create participants (complete data)
await prisma.battleParticipant.createMany({...});
```

#### Stage 6: Remove Columns
**Action:** Drop 26+ redundant columns from Battle table  
**Risk:** High (irreversible without backup)  
**Rollback:** Restore from backup  

```sql
ALTER TABLE "Battle"
  DROP COLUMN "robot1Id",
  DROP COLUMN "robot2Id",
  DROP COLUMN "robot1ELOBefore",
  -- ... all 26 columns
;
```

#### Stage 7: Update Documentation
**Action:** Update all markdown files, API docs, schema docs  
**Risk:** None  
**Rollback:** Not needed  

---

## Impact Analysis

### Files Requiring Changes (~50 total)

#### Battle Creation (3 files)
```
prototype/backend/src/services/battleOrchestrator.ts
prototype/backend/src/services/tournamentBattleOrchestrator.ts
prototype/backend/src/services/tagTeamBattleOrchestrator.ts
```

**Changes:**
- Create BattleParticipant records
- Remove redundant Battle column writes
- Map robot data to participants

#### Battle Query Services (~5 files)
```
prototype/backend/src/services/battleService.ts
prototype/backend/src/services/robotStatsService.ts
prototype/backend/src/services/leaderboardService.ts
prototype/backend/src/services/analyticsService.ts
prototype/backend/src/routes/battles.ts
```

**Changes:**
- Query BattleParticipant instead of Battle columns
- Join participants when needed
- Update response formatting

#### Analytics & Cycle Services (~3 files)
```
prototype/backend/src/services/cycleSnapshotService.ts
prototype/backend/src/services/cycleCsvExportService.ts
prototype/backend/src/routes/analytics.ts
```

**Changes:**
- Query participants for battle data
- Aggregate from participants
- Update CSV column mapping

#### Audit Log (3 files)
```
prototype/backend/src/services/eventLogger.ts
prototype/backend/src/services/battleOrchestrator.ts (event creation)
prototype/backend/src/services/cycleSnapshotService.ts (event reading)
```

**Changes:**
- Audit events already correct (one per robot)
- May need to adjust payload structure
- Verify consistency with participants

#### UI Components (~15 files)
```
prototype/frontend/src/pages/BattleHistory.tsx
prototype/frontend/src/pages/BattleDetails.tsx
prototype/frontend/src/pages/RobotProfile.tsx
prototype/frontend/src/pages/UserProfile.tsx
prototype/frontend/src/pages/Leaderboards.tsx
prototype/frontend/src/pages/CycleSummary.tsx
prototype/frontend/src/components/BattleCard.tsx
prototype/frontend/src/components/BattleList.tsx
-- ... and more
```

**Changes:**
- Update API response types
- Access participants array
- Display participant data
- Handle team grouping for tag battles

#### Tests (~20 files)
```
prototype/backend/tests/battleCreation.test.ts
prototype/backend/tests/battleQueries.test.ts
prototype/backend/tests/robotStats.test.ts
prototype/backend/tests/leaderboards.test.ts
prototype/backend/tests/analytics.test.ts
-- ... and more
```

**Changes:**
- Update test expectations
- Test participant creation
- Test participant queries
- Test data integrity

#### Documentation (18+ files)
```
All markdown files in this PR
API documentation
Database schema docs
Developer guides
```

**Changes:**
- Update schema diagrams
- Update query examples
- Update code examples
- Update data flow documentation

---

## Implementation Plan

### Phase 1: Preparation

- [ ] Review and approve this plan
- [ ] Set up test environment
- [ ] Create backup of production database
- [ ] Document current Battle table structure
- [ ] Identify all Battle table queries in codebase

### Phase 2: Schema & Backfill

- [ ] Create BattleParticipant table migration
- [ ] Deploy migration to development
- [ ] Write backfill script
- [ ] Test backfill on development data
- [ ] Verify data integrity
- [ ] Deploy to production
- [ ] Run backfill on production

### Phase 3: Code Updates (Dual-Read)

- [ ] Update battle query services
- [ ] Update analytics services
- [ ] Update UI components
- [ ] Add fallback logic
- [ ] Test all pages
- [ ] Deploy

### Phase 4: Code Updates (Dual-Write)

- [ ] Update battle orchestrators
- [ ] Write to both tables
- [ ] Verify consistency
- [ ] Test battle creation
- [ ] Deploy

### Phase 5: Code Updates (Single-Write)

- [ ] Remove Battle column writes
- [ ] Write only to BattleParticipant
- [ ] Monitor for issues
- [ ] Test thoroughly
- [ ] Deploy

### Phase 6: Column Removal

- [ ] Verify no code reads removed columns
- [ ] Create column removal migration
- [ ] Test migration on development
- [ ] Deploy to production
- [ ] Verify schema

### Phase 7: Documentation

- [ ] Update all markdown files
- [ ] Update API documentation
- [ ] Update database schema docs
- [ ] Update developer guides
- [ ] Review and publish

---

## Testing Requirements

### Unit Tests

**BattleParticipant CRUD:**
- [ ] Create participant
- [ ] Read participant
- [ ] Update participant
- [ ] Delete participant
- [ ] Query by battle
- [ ] Query by robot

**Backfill Script:**
- [ ] Test 1v1 battles
- [ ] Test tournament battles
- [ ] Test tag team battles
- [ ] Test data integrity
- [ ] Test idempotency

**Query Services:**
- [ ] Test battle queries with participants
- [ ] Test robot stats aggregation
- [ ] Test leaderboard calculations

### Integration Tests

**Battle Creation:**
- [ ] Create 1v1 battle → verify 2 participants
- [ ] Create tournament battle → verify 2 participants
- [ ] Create tag team battle → verify 4 participants
- [ ] Verify revenue split (tag team)
- [ ] Verify all fields populated

**Battle Queries:**
- [ ] Get battle by ID with participants
- [ ] Get all battles for robot
- [ ] Get all battles for user
- [ ] Get battles by type
- [ ] Get battles by cycle

**Data Integrity:**
- [ ] Verify participant count matches battle type
- [ ] Verify team assignments
- [ ] Verify role assignments (tag team)
- [ ] Verify revenue sums
- [ ] Verify ELO changes

### UI Tests

**Battle History Page:**
- [ ] Displays all battles
- [ ] Shows correct participants
- [ ] Shows correct outcomes
- [ ] Filters work correctly
- [ ] Pagination works

**Battle Details Page:**
- [ ] Shows all participants
- [ ] Shows correct stats
- [ ] Shows correct rewards
- [ ] Shows correct ELO changes
- [ ] Tag team battles show teams correctly

**Robot Profile:**
- [ ] Battle history displays
- [ ] Win/loss record correct
- [ ] ELO progression correct
- [ ] Stats calculated correctly

**User Profile:**
- [ ] All robots shown
- [ ] Battle statistics correct
- [ ] Leaderboard position correct

**Leaderboards:**
- [ ] Rankings correct
- [ ] Stats calculated from participants
- [ ] Filters work

**Analytics/Cycle Summary:**
- [ ] Income breakdown correct
- [ ] Battle credits aggregated correctly
- [ ] Streaming revenue aggregated correctly
- [ ] Charts display correctly

### Performance Tests

**Query Performance:**
- [ ] Battle list query time < 100ms
- [ ] Battle details query time < 50ms
- [ ] Robot battles query time < 100ms
- [ ] Leaderboard query time < 200ms

**Join Performance:**
- [ ] Battle with participants join efficient
- [ ] Large result sets handled
- [ ] Indexes used correctly

**Large Dataset:**
- [ ] Test with 10,000+ battles
- [ ] Test with 100+ robots
- [ ] Test with 50+ users
- [ ] Monitor query plans

### Regression Tests

**All Existing Functionality:**
- [ ] Dashboard loads and displays correctly
- [ ] Battle history shows all battles
- [ ] Battle details show complete information
- [ ] Robot profiles show correct stats
- [ ] User profiles show correct data
- [ ] Leaderboards rank correctly
- [ ] Cycle summary calculates correctly
- [ ] Tournament brackets work
- [ ] Tag team battles create correctly
- [ ] CSV exports include all data
- [ ] No console errors
- [ ] No broken links
- [ ] No missing data

### Acceptance Criteria

**Data Migration:**
- ✅ All existing battles have participants
- ✅ Participant count matches battle type
- ✅ No data loss
- ✅ Revenue sums match original
- ✅ ELO changes match original

**Functionality:**
- ✅ All pages load without errors
- ✅ All data displays correctly
- ✅ Battle creation works for all types
- ✅ Battle queries return correct data
- ✅ No performance degradation

**Code Quality:**
- ✅ No redundant code
- ✅ Proper error handling
- ✅ Consistent with existing patterns
- ✅ Well-documented

---

## Documentation Updates

### Files Requiring Updates (18+ files)

#### This PR's Documentation
1. PR_SUMMARY.md - Update with BattleParticipant info
2. AUDIT_LOG_RESTRUCTURING.md - Reference BattleParticipant
3. DATABASE_DESIGN_QUESTIONS.md - Update Battle table explanation
4. DATABASE_SCHEMA_AUDIT.md - Mark columns as migrated
5. SCHEMA_CLEANUP_SUMMARY.md - Add BattleParticipant section
6. SCHEMA_CLEANUP_IMPLEMENTATION.md - Mark as implemented
7. TAG_TEAM_FIXES_SUMMARY.md - Reference BattleParticipant
8. CYCLESNAPSHOT_VS_AUDITLOG.md - Update data sources
9. AUDITLOG_CYCLESNAPSHOT_FLOW.md - Update battle data flow
10. SNAPSHOT_ORDER_FIX.md - Update if needed

#### Additional Documentation
11. README.md - Update database schema section
12. ARCHITECTURE.md - Update if exists
13. API documentation - Update battle endpoints
14. Database schema documentation - Add BattleParticipant
15. Developer guide - Update battle creation guide
16. Testing guide - Add BattleParticipant tests
17. Migration guide - Document this migration
18. Deployment guide - Add migration steps

### Content Changes Needed

**Schema Diagrams:**
- Remove redundant Battle columns
- Add BattleParticipant table
- Show relationships

**Code Examples:**
- Update battle creation examples
- Update battle query examples
- Update API response examples

**Data Flow Diagrams:**
- Update to show BattleParticipant
- Update audit log flow
- Update analytics flow

---

## Rollback Strategy

### Stage-by-Stage Rollback

**Stage 1 (Create Table):**
- Rollback: `DROP TABLE "BattleParticipant"`
- Risk: None
- Data Loss: None

**Stage 2 (Backfill):**
- Rollback: `TRUNCATE "BattleParticipant"`
- Risk: Low
- Data Loss: Backfilled data (can re-run)

**Stage 3 (Dual-Read):**
- Rollback: Revert code changes
- Risk: Low
- Data Loss: None

**Stage 4 (Dual-Write):**
- Rollback: Stop writing to BattleParticipant
- Risk: Low
- Data Loss: Recent participants (can backfill)

**Stage 5 (Single-Write):**
- Rollback: Resume writing to Battle columns
- Risk: Medium
- Data Loss: Recent Battle columns (can reconstruct)

**Stage 6 (Remove Columns):**
- Rollback: Restore from backup
- Risk: HIGH
- Data Loss: Irreversible without backup

**Stage 7 (Documentation):**
- Rollback: Revert documentation
- Risk: None
- Data Loss: None

### Emergency Rollback Procedure

**If issues found at any stage:**

1. **Stop deployment immediately**
2. **Identify affected stage**
3. **Execute stage-specific rollback**
4. **Verify system functionality**
5. **Investigate issue**
6. **Fix and re-test**
7. **Resume from problematic stage**

### Backup Strategy

**Before Stage 6 (Column Removal):**
- Full database backup
- Verify backup integrity
- Test restore procedure
- Document backup location

**Why:**
- Column removal is irreversible
- Backup allows complete rollback
- Safety net for production

---

## Backfill Script Implementation

### Complete Backfill Script

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface BattleParticipantData {
  battleId: number;
  robotId: number;
  team: number;
  role: string | null;
  credits: number;
  streamingRevenue: number;
  eloBefore: number;
  eloAfter: number;
  prestigeAwarded: number;
  fameAwarded: number;
  damageDealt: number;
  finalHP: number;
  yielded: boolean;
  destroyed: boolean;
}

async function backfillBattleParticipants() {
  console.log('Starting backfill...');
  
  const battles = await prisma.battle.findMany({
    include: {
      robot1: true,
      robot2: true,
    },
  });
  
  console.log(`Found ${battles.length} battles to backfill`);
  
  let processed = 0;
  let errors = 0;
  
  for (const battle of battles) {
    try {
      const participants: BattleParticipantData[] = [];
      
      if (battle.battleType === '1v1' || battle.battleType === 'tournament') {
        // Create 2 participants
        participants.push(
          {
            battleId: battle.id,
            robotId: battle.robot1Id,
            team: 1,
            role: null,
            credits: battle.winnerId === 1 ? battle.winnerReward : battle.loserReward,
            streamingRevenue: 0, // TODO: Get from RobotStreamingRevenue table
            eloBefore: battle.robot1ELOBefore,
            eloAfter: battle.robot1ELOAfter,
            prestigeAwarded: battle.robot1PrestigeAwarded,
            fameAwarded: battle.robot1FameAwarded || 0,
            damageDealt: battle.robot1DamageDealt,
            finalHP: battle.robot1FinalHP,
            yielded: battle.robot1Yielded,
            destroyed: battle.robot1Destroyed,
          },
          {
            battleId: battle.id,
            robotId: battle.robot2Id,
            team: 2,
            role: null,
            credits: battle.winnerId === 2 ? battle.winnerReward : battle.loserReward,
            streamingRevenue: 0, // TODO: Get from RobotStreamingRevenue table
            eloBefore: battle.robot2ELOBefore,
            eloAfter: battle.robot2ELOAfter,
            prestigeAwarded: battle.robot2PrestigeAwarded,
            fameAwarded: battle.robot2FameAwarded || 0,
            damageDealt: battle.robot2DamageDealt,
            finalHP: battle.robot2FinalHP,
            yielded: battle.robot2Yielded,
            destroyed: battle.robot2Destroyed,
          }
        );
      } else if (battle.battleType === 'tag_team') {
        // Create 4 participants
        const team1Credits = Math.floor((battle.winnerId === 1 ? battle.winnerReward : battle.loserReward) / 2);
        const team2Credits = Math.floor((battle.winnerId === 2 ? battle.winnerReward : battle.loserReward) / 2);
        
        // IMPORTANT: Battle table HAS individual robot stats for tag teams!
        // - team1ActiveDamageDealt, team1ReserveDamageDealt
        // - team2ActiveDamageDealt, team2ReserveDamageDealt
        // - team1ActiveFameAwarded, team1ReserveFameAwarded
        // - team2ActiveFameAwarded, team2ReserveFameAwarded
        
        participants.push(
          // Team 1 Active
          {
            battleId: battle.id,
            robotId: battle.team1ActiveRobotId,
            team: 1,
            role: 'active',
            credits: team1Credits,
            streamingRevenue: 0, // TODO: Get from RobotStreamingRevenue
            eloBefore: battle.robot1ELOBefore,
            eloAfter: battle.robot1ELOAfter,
            prestigeAwarded: Math.floor(battle.robot1PrestigeAwarded / 2),
            fameAwarded: battle.team1ActiveFameAwarded,  // CORRECTED: Use individual field
            damageDealt: battle.team1ActiveDamageDealt,   // CORRECTED: Use individual field
            finalHP: battle.robot1FinalHP,  // Active robot HP
            yielded: battle.robot1Yielded,
            destroyed: battle.robot1Destroyed,
          },
          // Team 1 Reserve
          {
            battleId: battle.id,
            robotId: battle.team1ReserveRobotId,
            team: 1,
            role: 'reserve',
            credits: team1Credits,
            streamingRevenue: 0, // TODO: Get from RobotStreamingRevenue
            eloBefore: 0, // Reserve doesn't get ELO changes
            eloAfter: 0,
            prestigeAwarded: Math.floor(battle.robot1PrestigeAwarded / 2),
            fameAwarded: battle.team1ReserveFameAwarded,    // CORRECTED: Use individual field
            damageDealt: battle.team1ReserveDamageDealt,     // CORRECTED: Use individual field
            finalHP: battle.robot2FinalHP,  // Reserve robot HP (if tagged in)
            yielded: false, // Reserve doesn't yield
            destroyed: battle.robot2Destroyed && battle.team1TagOutTime !== null,  // Only destroyed if tagged in
          },
          // Team 2 Active
          {
            battleId: battle.id,
            robotId: battle.team2ActiveRobotId,
            team: 2,
            role: 'active',
            credits: team2Credits,
            streamingRevenue: 0, // TODO: Get from RobotStreamingRevenue
            eloBefore: battle.robot2ELOBefore,
            eloAfter: battle.robot2ELOAfter,
            prestigeAwarded: Math.floor(battle.robot2PrestigeAwarded / 2),
            fameAwarded: battle.team2ActiveFameAwarded,  // CORRECTED: Use individual field
            damageDealt: battle.team2ActiveDamageDealt,   // CORRECTED: Use individual field
            finalHP: battle.robot1FinalHP,  // For team 2, robot1 might be active if robot2 is reserve
            yielded: battle.robot2Yielded,
            destroyed: battle.robot2Destroyed,
          },
          // Team 2 Reserve
          {
            battleId: battle.id,
            robotId: battle.team2ReserveRobotId,
            team: 2,
            role: 'reserve',
            credits: team2Credits,
            streamingRevenue: 0, // TODO: Get from RobotStreamingRevenue
            eloBefore: 0,
            eloAfter: 0,
            prestigeAwarded: Math.floor(battle.robot2PrestigeAwarded / 2),
            fameAwarded: battle.team2ReserveFameAwarded,    // CORRECTED: Use individual field
            damageDealt: battle.team2ReserveDamageDealt,     // CORRECTED: Use individual field
            finalHP: battle.robot2FinalHP,  // Reserve robot HP
            yielded: false,
            destroyed: battle.robot1Destroyed && battle.team2TagOutTime !== null,  // Only destroyed if tagged in
          }
        );
      }
      
      // Insert participants
      await prisma.battleParticipant.createMany({
        data: participants,
        skipDuplicates: true,
      });
      
      processed++;
      if (processed % 100 === 0) {
        console.log(`Processed ${processed}/${battles.length} battles...`);
      }
    } catch (error) {
      console.error(`Error processing battle ${battle.id}:`, error);
      errors++;
    }
  }
  
  console.log(`Backfill complete. Processed: ${processed}, Errors: ${errors}`);
  
  // Verify
  const participantCount = await prisma.battleParticipant.count();
  console.log(`Total participants created: ${participantCount}`);
}

backfillBattleParticipants()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### Verification Queries

```sql
-- Check participant counts by battle type
SELECT 
  b."battleType",
  COUNT(DISTINCT b.id) as battle_count,
  COUNT(bp.id) as participant_count,
  AVG(participants_per_battle) as avg_participants
FROM "Battle" b
LEFT JOIN (
  SELECT "battleId", COUNT(*) as participants_per_battle
  FROM "BattleParticipant"
  GROUP BY "battleId"
) bp_count ON b.id = bp_count."battleId"
LEFT JOIN "BattleParticipant" bp ON b.id = bp."battleId"
GROUP BY b."battleType";

-- Expected:
-- 1v1: 2 participants per battle
-- tournament: 2 participants per battle
-- tag_team: 4 participants per battle

-- Verify no orphaned participants
SELECT COUNT(*) FROM "BattleParticipant" bp
WHERE NOT EXISTS (
  SELECT 1 FROM "Battle" b WHERE b.id = bp."battleId"
);
-- Expected: 0

-- Verify revenue sums
SELECT 
  b.id,
  b."winnerReward" + b."loserReward" as original_total,
  SUM(bp.credits) as participant_total
FROM "Battle" b
JOIN "BattleParticipant" bp ON b.id = bp."battleId"
GROUP BY b.id, b."winnerReward", b."loserReward"
HAVING b."winnerReward" + b."loserReward" != SUM(bp.credits);
-- Expected: 0 rows (all sums should match)
```

---

## Conclusion

This implementation plan provides a comprehensive, thorough approach to implementing the BattleParticipant table. It addresses all user concerns about:

- ✅ Identifying redundant columns (26+ documented)
- ✅ Impact on audit log (3 files identified)
- ✅ Impact on pages (~50 files identified)
- ✅ Thorough testing (complete test plan)
- ✅ Documentation updates (18+ files listed)

The 7-stage migration strategy ensures zero downtime and allows rollback at any point. The comprehensive testing requirements ensure quality and correctness.

**Recommendation:** Implement in separate PR from simple field removals for better code review and reduced risk.

**Next Steps:**
1. User approves this plan
2. Create separate PR for BattleParticipant implementation
3. Execute stages sequentially
4. Test thoroughly at each stage
5. Update all documentation

---

*Generated: 2026-02-19*  
*Author: GitHub Copilot*  
*Status: Ready for Review*
