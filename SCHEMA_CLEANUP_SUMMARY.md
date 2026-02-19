# Database Schema Cleanup - Quick Reference

Based on user's thorough audit of the database schema, here's a quick summary of findings and recommendations.

---

## Fields to Remove (8 total)

### User Table (3 fields)

```typescript
// ❌ REMOVE - Never updated, always 0
totalBattles: Int @default(0)

// ❌ REMOVE - Aggregate from robots instead
totalWins: Int @default(0)

// ❌ REMOVE - Always 1200, code recalculates from robots
highestELO: Int @default(1200)
```

**Why Remove:**
- User.totalBattles: Never updated when robots battle
- User.totalWins: Incomplete (no draws/losses), better to aggregate
- User.highestELO: Code doesn't trust it, recalculates every time

**Code Impact:**
- user.ts: Remove field from queries, keep recalculation logic
- leaderboards.ts: Remove field from queries, keep recalculation

### Battle Table (5 fields)

```typescript
// ❌ REMOVE - Only stores robot1's owner, incomplete
userId: Int

// ❌ REMOVE - Deprecated, always 0
robot1RepairCost: Int?
robot2RepairCost: Int?

// ❌ REMOVE - Always 0, shields don't persist
robot1FinalShield: Int
robot2FinalShield: Int
```

**Why Remove:**
- userId: Can't represent 2 users, redundant with robot.userId
- repair costs: Deprecated, always set to 0 (RepairService calculates later)
- final shields: Always 0 (shields reset after battle)

**Code Impact:**
- battleOrchestrator.ts: Remove from battle creation
- tournamentBattleOrchestrator.ts: Remove from battle creation
- tagTeamBattleOrchestrator.ts: Remove from battle creation
- Audit events: Remove repairCost field from payload
- economyCalculations.ts: Remove repair cost references

---

## Fields to Keep (Clarifications)

### Battle Table - Keep These

```typescript
// ✅ KEEP - 1v1 battles
robot1Id: Int
robot2Id: Int

// ✅ KEEP - Tag team battles (different use case)
team1ActiveRobotId: Int?
team1ReserveRobotId: Int?
team2ActiveRobotId: Int?
team2ReserveRobotId: Int?

// ✅ KEEP - Main robots' ELO (tag team tracked in audit events)
robot1ELOBefore: Int
robot1ELOAfter: Int
robot2ELOBefore: Int
robot2ELOAfter: Int

// ✅ KEEP - Battle economics
winnerReward: Int?
loserReward: Int?
```

**Why Keep:**
- robot1/2 vs team fields: Different battle types, both needed
- ELO for 2 robots: Tag team has 4, but per-robot ELO in audit events
- No streaming revenue: Correct design (RobotStreamingRevenue table)

---

## Migration Plan

### Step 1: Create Migration

```prisma
// 1. Remove from User table
- totalBattles Int @default(0)
- totalWins Int @default(0)
- highestELO Int @default(1200)

// 2. Remove from Battle table
- userId Int
- robot1RepairCost Int?
- robot2RepairCost Int?
- robot1FinalShield Int
- robot2FinalShield Int

// 3. Remove from User relations
- battles Battle[] @relation("UserBattles")
```

### Step 2: Update Code

**Remove field references:**
- user.ts: totalBattles, totalWins, highestELO queries
- leaderboards.ts: highestELO queries
- battleOrchestrator.ts: userId, repair costs, final shields
- tournamentBattleOrchestrator.ts: Same
- tagTeamBattleOrchestrator.ts: Same
- eventLogger.ts: repairCost from event payloads

**Keep calculations:**
- user.ts: `Math.max(...robots.map(r => r.elo))` for highestELO
- user.ts: Aggregate wins/draws/losses from robots

### Step 3: Test

**Verify no broken queries:**
```bash
# Search for removed field references
grep -r "totalBattles" src/
grep -r "totalWins" src/
grep -r "highestELO" src/
grep -r "robot1RepairCost\|robot2RepairCost" src/
grep -r "robot1FinalShield\|robot2FinalShield" src/
```

**Test endpoints:**
- GET /api/user/profile
- GET /api/leaderboards
- POST /api/admin/cycles/execute
- GET /api/battles/:id

---

## User Questions Answered

**Q: Why is User.totalBattles always 0?**  
A: Never updated. Robot.totalBattles IS updated. Remove User.totalBattles.

**Q: Why no User.totalDraws/totalLosses?**  
A: Incomplete tracking. Better to aggregate from robots on demand.

**Q: Why does highestELO show 1200 when dashboard shows 1185?**  
A: Field never updated. Dashboard recalculates from robots. Remove field.

**Q: Why do I only see 1 battle when I have 5?**  
A: Battle.userId only stores robot1's owner. Query via robots instead.

**Q: Why both robot1Id and team1ActiveRobotId?**  
A: Different battle types (1v1 vs tag team). Both needed.

**Q: Where's streaming revenue in Battle table?**  
A: Correct design - per-robot in RobotStreamingRevenue table + audit events.

**Q: Why robot1/2RepairCost in schema?**  
A: Deprecated. Always 0. Should remove.

**Q: What's robot1/2FinalShield for?**  
A: Meant to track shield efficiency. Always 0 now. Should remove.

---

## Benefits of Cleanup

**Clarity:**
- Remove confusing unused fields
- Clear which fields are authoritative

**Maintainability:**
- Less code to update
- Fewer places to make mistakes

**Performance:**
- Smaller Battle table (5 fewer columns)
- Smaller User table (3 fewer columns)

**Data Integrity:**
- Single source of truth (robots)
- No duplicate data

---

## Implementation Checklist

- [ ] Review this summary
- [ ] Approve removals
- [ ] Create Prisma migration
- [ ] Update code (remove references)
- [ ] Update tests
- [ ] Run migration on dev database
- [ ] Test all affected endpoints
- [ ] Deploy to production
- [ ] Update documentation

---

## See Also

- **DATABASE_SCHEMA_AUDIT.md** - Complete field-by-field analysis
- **PR_SUMMARY.md** - Full PR overview
- **AUDIT_LOG_RESTRUCTURING.md** - Event structure changes

---

**Total Cleanup:** Remove 8 unnecessary fields, clarify 10+ confusing ones

**User feedback led to this comprehensive audit - thank you!** 🙏
