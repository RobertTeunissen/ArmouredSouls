# Database Schema Audit - Field Usage Analysis

User identified several unused, broken, or confusing fields in the database schema. This document analyzes each issue and proposes solutions.

---

## USER TABLE ISSUES

### 1. `totalBattles` - Always 0 ❌ BROKEN

**Current State:**
- Always shows 0
- Never updated when robots battle

**Code Usage:**
- Referenced in: robotStatsViewService, facilityRecommendationService, eventLogger
- But these use **Robot.totalBattles**, not **User.totalBattles**!

**Problem:**
- Field exists but is never updated
- Misleading name (sounds like it should be aggregated from robots)

**Solutions:**
- **Option A**: Remove the field (not used)
- **Option B**: Update it properly (aggregate from all user's robots)
- **Option C**: Rename to clarify it's NOT being tracked

**Recommendation:** **REMOVE** - Redundant with Robot.totalBattles aggregation

---

### 2. `totalWins` - Shows 2, No Draws/Losses ⚠️ INCOMPLETE

**Current State:**
- Shows 2 (seems to be updated)
- No corresponding `totalDraws` or `totalLosses` fields

**Code Usage:**
- Used in user profile display
- Manually aggregated from robots in some places

**Problem:**
- Incomplete stat tracking (wins but not draws/losses)
- Inconsistent (why track wins but not others?)

**Solutions:**
- **Option A**: Add `totalDraws` and `totalLosses` fields
- **Option B**: Remove all three, aggregate from robots when needed
- **Option C**: Keep as achievement/highlight stat (wins only)

**Recommendation:** **Option B** - Remove, aggregate from robots (single source of truth)

---

### 3. `highestELO` - Always 1200 ❌ BROKEN

**Current State:**
- Shows 1200 for all users (default value)
- Never updated when robots gain/lose ELO

**Dashboard Shows:** 1185 (correct value)

**How Dashboard Gets It:**
```typescript
// routes/user.ts line 196
const highestELO = Math.max(...robots.map(r => r.elo));
```

**Code Usage:**
- user.ts: Queries the field but then recalculates from robots!
- leaderboards.ts: Same - queries then recalculates

**Problem:**
- Field is never updated
- Code doesn't trust it (recalculates every time)

**Solutions:**
- **Option A**: Remove field, always calculate from robots
- **Option B**: Update field when robot ELO changes
- **Option C**: Keep for caching (update on robot ELO change)

**Recommendation:** **Option A** - Remove, calculate when needed (simpler, single source of truth)

---

### 4. `battles` Relation - Only Shows Robot1 Battles ❌ BROKEN

**Current State:**
- Battle.userId set to robot1's owner
- Missing battles where user owns robot2

**Example:**
- User has 5 robots that fought 5 battles each = 25 total
- But `user.battles` only shows ~5 (where user's robot was robot1)

**Code Usage:**
- Defined in schema but rarely queried directly
- Most code queries via `user.robots.battles` instead

**Problem:**
- Battle.userId is ambiguous (which user?)
- Incomplete battle history per user

**Solutions:**
- **Option A**: Remove Battle.userId (query via robots instead)
- **Option B**: Remove `battles` relation, always query via robots
- **Option C**: Store BOTH user IDs (userId1, userId2)

**Recommendation:** **Option A** - Remove Battle.userId field (redundant with robot relations)

---

## BATTLE TABLE ISSUES

### 1. Only One `userId` Column - Should Be Two ❌ WRONG DESIGN

**Current State:**
```typescript
Battle.userId  // Set to robot1's owner
```

**Problem:**
- Every battle involves 2 users
- Only one userId stored (robot1's owner)
- Missing robot2's owner

**Impact:**
- Can't easily query "all battles for user X"
- Must join through robots: `Robot.userId -> Robot -> Battle`

**Solutions:**
- **Option A**: Remove userId (redundant - use robot1.userId, robot2.userId)
- **Option B**: Add userId2 field (store both users)
- **Option C**: Keep as-is (use robot relations for queries)

**Recommendation:** **Option A** - Remove Battle.userId

**Rationale:**
- Already have robot1Id and robot2Id
- Can get user IDs via `robot1.userId` and `robot2.userId`
- Simpler schema, no duplication

---

### 2. Duplicate Fields: `robot1Id` vs `team1ActiveRobotId` ⚠️ CONFUSING

**Current State:**
- 1v1 battles: Use robot1Id, robot2Id
- Tag team: Use team1ActiveRobotId, team2ActiveRobotId (+ reserve)
- Both sets of fields exist

**Code Usage:**
- battleOrchestrator.ts (1v1): Uses robot1Id, robot2Id
- tagTeamBattleOrchestrator.ts: Uses team fields
- Both get stored in same Battle table

**Problem:**
- Confusing which fields to check
- Duplication for tag team battles

**Why It Exists:**
- Different battle types need different data
- Tag team: 4 robots (active + reserve per team)
- 1v1: 2 robots

**Solutions:**
- **Option A**: Always use team fields (set active=robot, reserve=null for 1v1)
- **Option B**: Keep separate (clearer semantics)
- **Option C**: Separate table for tag team battles

**Recommendation:** **Option B** - Keep as-is (different battle types, clear intent)

**Rationale:**
- Tag team battles ARE different (4 robots vs 2)
- Separate fields make code clearer
- No real problem, just different use cases

---

### 3. ELO Tracking Only for 2 Robots ⚠️ TAG TEAM LIMITATION

**Current State:**
```typescript
robot1ELOBefore, robot1ELOAfter  // Robot 1
robot2ELOBefore, robot2ELOAfter  // Robot 2
```

**Problem:**
- Tag team battles have 4 robots
- Only 2 ELO tracking fields

**Current Implementation:**
- Tag team ELO changes tracked separately
- Battle table stores "main" robots (team1Active, team2Active)
- Reserve robots ELO updated but not logged in Battle table

**Solutions:**
- **Option A**: Add team1ReserveELOBefore/After, team2ReserveELOBefore/After
- **Option B**: Keep as-is (track in audit log events instead)
- **Option C**: Separate tag team battle table

**Recommendation:** **Option B** - Keep as-is

**Rationale:**
- ELO changes now logged in audit events (one per robot)
- Battle table doesn't need all 4 robot ELOs
- Audit log is source of truth

---

### 4. `robot1RepairCost`, `robot2RepairCost` ❌ DEPRECATED

**Current State:**
```typescript
// battleOrchestrator.ts line 640
robot1RepairCost: 0, // Deprecated: repair costs calculated by RepairService
robot2RepairCost: 0, // Deprecated: repair costs calculated by RepairService
```

**Always Set To:** 0

**Problem:**
- Fields exist but always 0
- Comment says "Deprecated"
- Repairs calculated by RepairService (later)

**Code Still References Them:**
- Used in audit events (but value is 0)
- Used in economyCalculations.ts (but value is 0)

**Solutions:**
- **Option A**: Remove fields (truly deprecated)
- **Option B**: Actually populate them with repair costs
- **Option C**: Keep for backward compatibility

**Recommendation:** **Option A** - Remove fields

**Impact:**
- Update audit event payloads (remove repairCost field)
- Update economyCalculations to not reference these
- Migration to drop columns

---

### 5. No Streaming Revenue in Battle Table ✅ CORRECT

**User Asked:** "Why no streaming revenue per robot?"

**Current State:**
- Battle table has: winnerReward, loserReward
- Streaming stored in: RobotStreamingRevenue table
- Streaming also in audit events

**Why This Is Correct:**
- Streaming revenue is PER ROBOT (not per battle)
- One battle can have different streaming for each robot
- Better normalized in separate table

**Recommendation:** **Keep as-is** - Proper normalization

---

### 6. `robot1FinalShield`, `robot2FinalShield` - Always 0 ⚠️ SIMPLIFIED

**Current State:**
```typescript
// battleOrchestrator.ts line 643
robot1FinalShield: 0, // Simplified: shields depleted in battle
robot2FinalShield: 0,
```

**Comment Says:** "Simplified: shields depleted in battle"

**Code Usage:**
- Stored in Battle table
- Included in audit events
- Always set to 0

**Original Intent:**
- Track ending shield for battle efficiency metrics
- Show if robot won with shields intact

**Current Reality:**
- Shields always depleted/reset
- No shield persistence between battles
- Always 0

**Solutions:**
- **Option A**: Remove fields (always 0, unused)
- **Option B**: Keep for future shield mechanics
- **Option C**: Actually track final shields

**Recommendation:** **Option A** - Remove fields

**Rationale:**
- If shields always reset, final shield is meaningless
- Adds no value (always 0)
- Can add back if mechanics change

---

## SUMMARY OF RECOMMENDATIONS

### User Table - REMOVE:
- ❌ `totalBattles` - Never updated, redundant with Robot stats
- ❌ `totalWins` - Aggregate from robots instead
- ❌ `highestELO` - Always recalculated from robots anyway

### User Table - KEEP:
- ✅ `prestige` - Used for stable reputation
- ✅ `currency` - Core resource
- ✅ `championshipTitles` - Achievement tracking

### Battle Table - REMOVE:
- ❌ `userId` - Redundant with robot1.userId, robot2.userId
- ❌ `robot1RepairCost` - Deprecated, always 0
- ❌ `robot2RepairCost` - Deprecated, always 0
- ❌ `robot1FinalShield` - Always 0, unused
- ❌ `robot2FinalShield` - Always 0, unused

### Battle Table - KEEP:
- ✅ `robot1Id`, `robot2Id` - Core 1v1 fields
- ✅ `team1ActiveRobotId`, etc. - Tag team fields (different use case)
- ✅ `robot1ELOBefore/After` - ELO tracking (audit events now have per-robot)
- ✅ `winnerReward`, `loserReward` - Battle economics
- ✅ No streaming revenue - Correct (in separate table)

---

## IMPLEMENTATION PLAN

### Phase 1: Documentation
- ✅ Create this document
- [ ] Update schema comments
- [ ] Create migration plan

### Phase 2: Code Updates
- [ ] Update queries that reference removed fields
- [ ] Remove fields from audit event payloads
- [ ] Update economyCalculations.ts
- [ ] Test all affected endpoints

### Phase 3: Schema Migration
- [ ] Create Prisma migration to drop fields:
  - User: totalBattles, totalWins, highestELO
  - Battle: userId, robot1RepairCost, robot2RepairCost, robot1FinalShield, robot2FinalShield
- [ ] Run migration
- [ ] Verify no broken queries

### Phase 4: Verification
- [ ] Test user profile display
- [ ] Test battle history
- [ ] Test leaderboards
- [ ] Test cycle execution
- [ ] Verify audit logs still work

---

## QUESTIONS ANSWERED

**Q: What is User.totalBattles used for?**  
A: Nothing - it's never updated. Robots have totalBattles which IS updated.

**Q: Why does User.totalWins show 2?**  
A: Unclear - might be manually updated somewhere, but shouldn't exist.

**Q: Where does dashboard get highestELO from?**  
A: Calculates from robots: `Math.max(...robots.map(r => r.elo))`

**Q: Why only see 1 battle in user.battles?**  
A: Battle.userId only set to robot1's owner. Should query via robots instead.

**Q: Why both robot1Id and team1ActiveRobotId?**  
A: Different battle types - 1v1 vs tag team. Both needed.

**Q: Are robot1RepairCost/robot2RepairCost used?**  
A: No - deprecated, always 0. Should be removed.

**Q: Why no streaming revenue in Battle table?**  
A: Correct design - streaming is per-robot in separate table + audit events.

**Q: What's the use of robot1FinalShield?**  
A: None currently - always 0. Originally meant to track shield efficiency.

---

## USER FEEDBACK INCORPORATED

All 11 observations from user have been:
1. ✅ Investigated
2. ✅ Explained
3. ✅ Solutions proposed
4. ⏳ Implementation pending user approval

Thank you for the thorough database audit! These observations will significantly improve schema clarity.
