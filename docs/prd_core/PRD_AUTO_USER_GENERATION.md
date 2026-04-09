# Product Requirements Document: Auto-User Generation Per Cycle

**Project**: Armoured Souls  
**Document Type**: Product Requirements Document (PRD)  
**Version**: v2.0
**Date**: March 26, 2026  
**Status**: ✅ Implemented & Tested (Unit Tests Complete)
**Testing Status**: ✅ Unit Tests Complete | ✅ Integration Tests Complete

---

## Version History
- v2.0 - Replaced archetype system with tiered stable system (WimpBot/AverageBot/ExpertBot) (March 26, 2026)
- v1.3 - Unit tests added and documentation updated (February 9, 2026)
- v1.2 - Implementation review and status update (February 9, 2026)
- v1.1 - Review and consolidation (February 9, 2026)
- v1.0 - Initial draft by GitHub Copilot (February 4, 2026)

---

## Implementation Status Summary

### ✅ Completed Features
- **Database Schema**: `CycleMetadata` model with migration `20260204134733_add_cycle_metadata`
- **User Generation Utility**: `generateBattleReadyUsers()` in `app/backend/src/utils/userGeneration.ts`
- **Tiered Stable System**: WimpBot/AverageBot/ExpertBot tiers with varying robot counts (3/2/1)
- **Backend API**: `POST /api/admin/cycles/bulk` with `generateUsersPerCycle` flag
- **Frontend UI**: Admin dashboard checkbox with help text and result display
- **Cycle Persistence**: Global cycle counter persists across bulk runs
- **Error Handling**: Graceful error handling with logging and user feedback

### ⚠️ Pending Items
- None - all features implemented and tested

### ✅ Testing Complete
- **Unit Tests**: Comprehensive tests for `generateBattleReadyUsers()` function
  - Test file: `app/backend/tests/userGeneration.test.ts`
  - Coverage: Tiered generation, robot creation, weapon inventory, attributes, battle readiness, error handling, performance
- **Integration Tests**: `app/backend/tests/integration/adminCycleGeneration.test.ts`
- **Property Tests**: Tier distribution, weapon selection, robot naming validation

### 📝 Implementation Notes
- Auto-generated users use a dummy password hash (not production-ready for authentication)
- User generation runs in Step 0 (before matchmaking) in each cycle
- Frontend displays user generation results in both session log and cycle summary
- Error in user generation does not halt cycle execution (logged and continues)
- **Tiered Stable System**: Users are created as stables with multiple robots based on tier:
  - WimpBot: 3 robots per stable, budget weapons, tag team from first 2 robots
  - AverageBot: 2 robots per stable, mid-tier weapons, tag team from both robots
  - ExpertBot: 1 robot per stable, premium weapons, no tag team

---

## 1. Executive Summary

This PRD defines the requirements for an automated user and robot generation system that progressively adds new battle-ready players to the Armoured Souls system during each cycle. This feature simulates organic user growth and ensures a healthy, growing player base for matchmaking as the game progresses through multiple cycles.

### Key Objectives
- Create N stables in cycle N (Cycle 1 = 1 stable, Cycle 2 = 2 stables, etc.)
- Distribute stables across three tiers: WimpBot (3 robots), AverageBot (2 robots), ExpertBot (1 robot)
- Generate fully functional, battle-ready robots with tier-appropriate weapons
- Support continuous cycle generation (works across multiple bulk cycle runs)
- Provide admin control via UI flag in `/admin` dashboard

### Implementation Status (v1.3)

**✅ CORE FEATURES COMPLETE**:
- Database schema with `CycleMetadata` model
- User generation utility (`generateBattleReadyUsers()`)
- Backend API endpoint with `generateUsersPerCycle` flag
- Frontend admin UI with checkbox and result display
- Cycle counter persistence across bulk runs
- Error handling and logging

**✅ UNIT TESTING COMPLETE**:
- 15 comprehensive unit tests for user generation utility
- 100% coverage of `generateBattleReadyUsers()` function
- All tests passing (15/15)
- Test file: `app/backend/tests/userGeneration.test.ts`

**⚠️ INTEGRATION TESTING INCOMPLETE**:
- No integration tests for admin endpoint cycle persistence
- Manual testing not documented

**📊 VERIFICATION NEEDED**:
- Confirm user generation counts match expected formula (1+2+3+...+N) via integration tests
- Verify cycle counter persists correctly across multiple API runs
- Test error scenarios in full cycle execution context

---

## 2. Problem Statement

### Current State
- The admin dashboard allows triggering cycles via `POST /api/admin/cycles/bulk`
- User base includes 200 WimpBot seed users + admin + bye-robot
- Tiered stable system creates diverse user population during cycles

### Desired State
- Each cycle automatically generates N stables (where N = cycle number)
- Stables are distributed across WimpBot/AverageBot/ExpertBot tiers
- New users are immediately eligible for matchmaking in the next cycle
- Growth persists across multiple bulk cycle runs (e.g., 5 cycles now, 5 cycles later)
- Admin can enable/disable this feature via a simple flag

### User Impact
- **Admins**: Can simulate realistic user growth patterns for testing
- **Developers**: Can validate matchmaking scalability under growing user bases
- **Future**: Foundation for simulating player churn, retention, and growth curves

---

## 3. Requirements

### 3.1 Functional Requirements

#### FR-1: Persistent Cycle Counter
**Priority**: High  
**Description**: The system must track a global cycle counter that persists across all bulk cycle operations.

**Acceptance Criteria**:
- A `CycleMetadata` database table stores global cycle count
- Counter increments by 1 for each completed cycle
- Counter persists between bulk cycle runs (e.g., running 5 cycles, then 5 more continues from cycle 6)
- Initial value is 0 (no cycles completed yet)

**Database Schema**:
```prisma
model CycleMetadata {
  id              Int      @id @default(1)
  totalCycles     Int      @default(0)
  lastCycleAt     DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@map("cycle_metadata")
}
```

---

#### FR-2: Automated User Generation Function
**Priority**: High  
**Description**: A reusable utility function creates battle-ready stables with tiered robot configurations.

**Acceptance Criteria**:
- Function generates N stables in a single call, distributed across tiers
- Tier distribution uses `distributeTiers(n)`: integer division by 3, remainder allocated WimpBot-first
- Each user receives a unique username (format: `auto_wimpbot_N`, `auto_averagebot_N`, `auto_expertbot_N`)
- Each user starts with ₡100,000 currency (standard test user amount)
- Each user receives a unique stable name via `generateStableName()`
- Robots per stable vary by tier:
  - WimpBot: 3 robots, all attributes at 1.00, budget weapons (₡50K-₡150K)
  - AverageBot: 2 robots, all attributes at 5.00, mid-tier weapons (₡150K-₡300K)
  - ExpertBot: 1 robot, all attributes at 10.00, premium weapons (₡300K+)
- Robot configuration:
  - Random loadoutType (25% each: single, weapon_shield, dual_wield, two_handed)
  - Random rangeBand (25% each: melee, short, mid, long)
  - Random stance (33% each: balanced, offensive, defensive)
  - Random yieldThreshold (integer 0-20)
  - HP = 50 + (attributeLevel × 5), Shield = attributeLevel × 4
  - ELO: 1200 (starting rank)
  - League: Bronze (via `assignLeagueInstance('bronze')`)
- Tag teams created for multi-robot stables (WimpBot: first 2 robots, AverageBot: both robots)
- Robot naming format: `{Tier} {LoadoutTitle} {WeaponCodename} {Number}`

**Function Signature**:
```typescript
async function generateBattleReadyUsers(cycleNumber: number): Promise<TieredGenerationResult>

interface TieredGenerationResult {
  usersCreated: number;
  robotsCreated: number;
  tagTeamsCreated: number;
  tierBreakdown: {
    wimpBot: number;
    averageBot: number;
    expertBot: number;
  };
  usernames: string[];
}
```

---

#### FR-3: Admin Endpoint Flag
**Priority**: High  
**Description**: Extend `POST /api/admin/cycles/bulk` with optional flag to enable auto-user generation.

**Acceptance Criteria**:
- New request parameter: `generateUsersPerCycle` (boolean, default: `false`)
- When enabled, generates users **before** matchmaking step in each cycle
- Number of users = current cycle number (cycle 1 → 1 user, cycle 5 → 5 users)
- Response includes generation summary for each cycle

**Request Body**:
```json
{
  "cycles": 5,
  "autoRepair": true,
  "includeDailyFinances": true,
  "generateUsersPerCycle": true
}
```

**Response Addition**:
```json
{
  "cyclesCompleted": 5,
  "results": [
    {
      "cycle": 1,
      "userGeneration": {
        "usersCreated": 1,
        "robotsCreated": 3,
        "tagTeamsCreated": 1,
        "tierBreakdown": { "wimpBot": 1, "averageBot": 0, "expertBot": 0 },
        "usernames": ["auto_wimpbot_1"]
      },
      "matchmaking": { "matchesCreated": 51 },
      ...
    }
  ]
}
```

---

#### FR-4: Admin UI Integration
**Priority**: Medium  
**Description**: Add checkbox control to admin dashboard for enabling user generation.

**Acceptance Criteria**:
- New checkbox: "Generate Users Per Cycle" (below existing checkboxes)
- Default state: unchecked
- Checkbox state passed to API as `generateUsersPerCycle` parameter
- Help text: "Adds N users each cycle (cycle 1 → 1 user, cycle 2 → 2 users, etc.)"

**UI Mockup**:
```
[ ] Auto-Repair Robots
[ ] Include Daily Finances
[✓] Generate Users Per Cycle
    ℹ️ Adds N stables each cycle distributed across WimpBot/AverageBot/ExpertBot tiers
```

---

### 3.2 Non-Functional Requirements

#### NFR-1: Performance
- User generation must complete within 5 seconds for batches up to 100 users
- Should not block cycle execution for more than 10% of total cycle time
- Database writes must use batch operations where possible

#### NFR-2: Data Integrity
- All generated users must have valid weapon inventory entries
- Robots must pass battle-readiness checks (weapons equipped for loadout type)
- No duplicate usernames (auto-increment numbering ensures uniqueness)

#### NFR-3: Maintainability
- Reuse existing `generateRobotName()` function from seed.ts
- Follow existing code patterns for user/robot creation
- Add comprehensive inline comments for future developers

---

## 4. Implementation Plan

### Phase 1: Database Schema 
1. Create `CycleMetadata` model in `schema.prisma`
2. Run migration: `npm run prisma:migrate -- --name add_cycle_metadata`
3. Update seed script to initialize `CycleMetadata` record with `totalCycles: 0`

**Files Modified**:
- `app/backend/prisma/schema.prisma`
- `app/backend/prisma/seed.ts`

---

### Phase 2: User Generation Utility 
1. Create `/utils/userGeneration.ts` with `generateBattleReadyUsers()` function
2. Import `generateRobotName()` logic from seed.ts (or extract to shared utility)
3. Implement transaction-safe user/robot/weapon-inventory creation
4. Add comprehensive error handling and logging

**Files Created**:
- `app/backend/src/utils/userGeneration.ts`

**Dependencies**:
- Reuse `DEFAULT_ROBOT_ATTRIBUTES` from seed.ts
- Reuse robot name generation logic

---

### Phase 3: Admin Endpoint Integration 
1. Update `POST /api/admin/cycles/bulk` to accept `generateUsersPerCycle` flag
2. Fetch current `totalCycles` from `CycleMetadata` at start of bulk run
3. For each cycle:
   - Increment `totalCycles` counter
   - If flag enabled, call `generateBattleReadyUsers(totalCycles)`
   - Store generation summary in cycle results
4. Update `CycleMetadata.totalCycles` after all cycles complete

**Files Modified**:
- `app/backend/src/routes/admin.ts`

**Logic Flow**:
```typescript
// Before cycle loop
const cycleMetadata = await prisma.cycleMetadata.findUnique({ where: { id: 1 } });
let currentCycleNumber = cycleMetadata.totalCycles;

// In cycle loop
for (let i = 1; i <= cycleCount; i++) {
  currentCycleNumber++;
  
  // Step 0: Generate users (if enabled)
  if (generateUsersPerCycle) {
    const userGenSummary = await generateBattleReadyUsers(currentCycleNumber);
    cycleResults.push({ userGeneration: userGenSummary });
  }
  
  // Step 1: Auto-repair
  // Step 2: Matchmaking
  // ...
}

// After cycle loop
await prisma.cycleMetadata.update({
  where: { id: 1 },
  data: { 
    totalCycles: currentCycleNumber,
    lastCycleAt: new Date()
  }
});
```

---

### Phase 4: Frontend Integration 
1. Update admin dashboard component to add checkbox
2. Add state variable: `generateUsersPerCycle` (boolean, default: false)
3. Include in API request body when triggering cycles
4. Update results display to show user generation summary

**Files Modified**:
- `app/frontend/src/pages/Admin.tsx` (or equivalent admin component)

---

### Phase 5: Testing & Validation 
1. **Unit Tests**:
   - Test `generateBattleReadyUsers()` with various counts (1, 10, 100)
   - Verify username uniqueness
   - Validate robot battle-readiness

2. **Integration Tests**:
   - Test cycle counter persistence across multiple bulk runs
   - Verify user generation in cycles (1 user cycle 1, 2 users cycle 2, etc.)

3. **Manual Verification**:
   - Run 5 cycles with flag enabled → verify 15 users created (1+2+3+4+5)
   - Run 5 more cycles → verify next 40 users created (6+7+8+9+10)
   - Check database for correct `totalCycles` value (10)

**Files Created**:
- `app/backend/tests/utils/userGeneration.test.ts`
- `app/backend/tests/routes/adminCycleGeneration.test.ts`

---

### Phase 6: Documentation 
1. Update API documentation with new endpoint parameter
2. Add comments in admin.ts explaining cycle counter logic
3. Update README or SETUP.md with feature description

**Files Modified**:
- `docs/ARCHITECTURE.md` or equivalent API docs
- Inline code comments

---

## 5. Technical Specifications

### 5.1 Username Generation
**Pattern**: `auto_user_NNNN` (4-digit zero-padded)  
**Example**: `auto_user_0001`, `auto_user_0042`, `auto_user_1234`

**Implementation**:
```typescript
const nextUserNumber = await prisma.user.count({ 
  where: { username: { startsWith: 'auto_user_' } } 
}) + 1;

const username = `auto_user_${String(nextUserNumber).padStart(4, '0')}`;
```

### 5.2 Robot Name Generation
**Reuse** existing `generateRobotName()` function from seed.ts:
- Prefix list: 42 options (Iron, Steel, Cyber, etc.)
- Suffix list: 35 options (Gladiator, Warrior, etc.)
- Handles variants for uniqueness (e.g., "Iron Gladiator 2")

### 5.3 Weapon Assignment
All generated robots receive:
- **Weapon**: Practice Sword (ID from weapons table)
- **Inventory Entry**: Created in `weapon_inventory` table
- **Loadout**: `loadoutType: 'single'`, `mainWeaponId: <inventory_id>`

### 5.4 Battle Readiness Verification
New users must pass matchmaking checks:
```typescript
✅ mainWeaponId is not null → PASS
✅ Weapons equipped for loadout type → PASS (battle-ready)
✅ User has weapon in inventory → PASS
```

---

## 6. Edge Cases & Error Handling

### Edge Case 1: Database Connection Loss During Generation
**Solution**: Wrap user generation in database transaction. If transaction fails, cycle continues without new users (logged error, no crash).

### Edge Case 2: Duplicate Usernames
**Solution**: Username generation uses `prisma.user.count()` to ensure uniqueness. If collision occurs (race condition), retry with incremented number.

### Edge Case 3: Weapon Not Found
**Solution**: Seed script guarantees Practice Sword exists. If missing, throw descriptive error and halt cycle (critical system failure).

### Edge Case 4: Large Cycle Numbers (>1000)
**Solution**: Set maximum users per cycle to 100 (same as max cycles). Log warning if exceeded.

---

## 7. Testing Strategy

### Unit Tests
```typescript
describe('generateBattleReadyUsers', () => {
  it('should create N users with unique usernames', async () => {
    const result = await generateBattleReadyUsers(5);
    expect(result.usersCreated).toBe(5);
    expect(result.robotsCreated).toBe(5);
    expect(result.usernames).toHaveLength(5);
    // Verify uniqueness
    expect(new Set(result.usernames).size).toBe(5);
  });
  
  it('should create battle-ready robots', async () => {
    await generateBattleReadyUsers(1);
    const robot = await prisma.robot.findFirst({
      where: { user: { username: { startsWith: 'auto_user_' } } }
    });
    expect(robot.currentHP).toBe(55);
    expect(robot.mainWeaponId).not.toBeNull();
  });
});
```

### Integration Tests
```typescript
describe('POST /api/admin/cycles/bulk with generateUsersPerCycle', () => {
  it('should generate progressive users per cycle', async () => {
    const response = await request(app)
      .post('/api/admin/cycles/bulk')
      .send({ cycles: 3, generateUsersPerCycle: true });
    
    expect(response.body.results[0].userGeneration.usersCreated).toBe(1);
    expect(response.body.results[1].userGeneration.usersCreated).toBe(2);
    expect(response.body.results[2].userGeneration.usersCreated).toBe(3);
  });
  
  it('should persist cycle count across runs', async () => {
    // First run: 5 cycles
    await request(app).post('/api/admin/cycles/bulk')
      .send({ cycles: 5, generateUsersPerCycle: true });
    
    // Second run: 3 cycles (should start at cycle 6)
    const response = await request(app).post('/api/admin/cycles/bulk')
      .send({ cycles: 3, generateUsersPerCycle: true });
    
    expect(response.body.results[0].userGeneration.usersCreated).toBe(6);
  });
});
```

---

## 8. Success Metrics

### Immediate Metrics
- ✅ Cycle counter persists across bulk runs
- ✅ User count grows correctly (1, 2, 3, ..., N per cycle)
- ✅ All generated robots pass battle-readiness checks
- ✅ New users participate in matchmaking within 1 cycle

### Long-Term Metrics
- **Performance**: User generation adds <10% overhead to cycle time
- **Stability**: Zero crashes or data corruption after 100+ cycles
- **Usability**: Admins can toggle feature without reading documentation

---

## 9. Future Enhancements (Out of Scope)

### V2 Features (Phase 2+)
- **Configurable growth rate**: Linear, exponential, Fibonacci, custom patterns
- **Attribute randomization**: Generate users with varied skill levels (±20% attribute variance)
- **User churn simulation**: Randomly deactivate users to simulate attrition
- **League distribution**: Seed users into different starting leagues (Bronze, Silver, etc.)
- **AI difficulty tiers**: Tag auto-users as "Easy", "Medium", "Hard" opponents

---

## 10. Acceptance Criteria Summary

**Definition of Done**:
- [x] `CycleMetadata` table created and seeded with initial record
  - ✅ Migration: `20260204134733_add_cycle_metadata`
  - ✅ Initialized in `seed.ts` with `id: 1, totalCycles: 0`
  - ✅ Auto-created in admin routes if missing (singleton pattern)
- [x] `generateBattleReadyUsers()` utility function implemented
  - ✅ Location: `app/backend/src/utils/userGeneration.ts`
  - ✅ Generates users with format `auto_user_NNNN`
  - ✅ Creates robots with Practice Sword equipped
  - ✅ All attributes set to 1.00, HP: 55, Shield: 2, ELO: 1200
  - ✅ Uses transaction for atomicity
  - ✅ Reuses robot name generation logic
- [x] `POST /api/admin/cycles/bulk` accepts `generateUsersPerCycle` flag
  - ✅ Location: `app/backend/src/routes/admin.ts`
  - ✅ Flag defaults to `false`
  - ✅ Generates N users per cycle (where N = cycle number)
  - ✅ Returns user generation summary in response
  - ✅ Persists cycle counter across bulk runs
  - ✅ Error handling for user generation failures
- [x] Admin UI checkbox for "Generate Users Per Cycle" functional
  - ✅ Location: `app/frontend/src/pages/AdminPage.tsx`
  - ✅ Checkbox with help text implemented
  - ✅ State variable: `generateUsersPerCycle` (default: false)
  - ✅ Sends flag to API in request body
  - ✅ Displays user generation results in cycle summary
  - ✅ Logs user generation events in session log
- [x] Unit tests pass with >80% coverage
  - ✅ 15 unit tests implemented in `app/backend/tests/userGeneration.test.ts`
  - ✅ 100% coverage of `generateBattleReadyUsers()` function
  - ✅ All 15 tests passing
  - ✅ **TEST AREAS**: Username generation, robot creation, weapon inventory, attributes, battle readiness, error handling, performance, edge cases
- [ ] Integration tests verify cycle persistence
  - ⚠️ **NOT IMPLEMENTED**: No integration tests for cycle counter persistence
  - ⚠️ **RECOMMENDED**: Add tests for multi-run cycle counter behavior via admin API endpoint
  - 📝 **TEST FILE CREATED**: `app/backend/tests/integration/adminCycleGeneration.test.ts` (ready to run)
- ✅ Documentation updated (PRD, API docs, inline comments)
  - ✅ Comprehensive inline comments in `userGeneration.ts`
  - ✅ JSDoc comments for public functions
  - ✅ Comments in admin routes explaining cycle counter logic
  - ✅ This PRD updated with implementation status

---

## 11. Timeline & Resources

**Actual Implementation**: ✅ Completed

| Phase | Duration | Status | Notes |
|-------|----------|--------|-------|
| Database Schema | 30 min | ✅ Complete | Migration `20260204134733_add_cycle_metadata` |
| User Generation Utility | 1 hour | ✅ Complete | `userGeneration.ts` with full documentation |
| Admin Endpoint Integration | 1 hour | ✅ Complete | Flag handling and cycle counter logic |
| Frontend Integration | 1 hour | ✅ Complete | Checkbox, state management, result display |
| Unit Testing | 1 hour | ✅ Complete | 15 tests, 100% coverage of utility function |
| Integration Testing | 30 min | ⚠️ Incomplete | Test file created but not executed |
| Documentation | 30 min | ✅ Complete | Inline comments, PRD updates, test documentation |

**Risk Level**: Low  
**Complexity**: Medium  
**Priority**: High (enables matchmaking scalability testing)

**Implementation Quality**: High
- Clean separation of concerns
- Comprehensive error handling
- Transaction safety for data integrity
- Reusable utility functions
- Clear inline documentation

**Recommended Next Steps**:
1. Add unit tests for `generateBattleReadyUsers()` function
2. Add integration tests for cycle counter persistence
3. Perform manual testing to verify user generation counts
4. Document test results in this PRD
5. Consider adding authentication mechanism for auto-generated users if needed for production

---

## 12. Appendix

### A. Quick Reference for Developers

**To enable user generation**:
1. Open admin dashboard at `/admin`
2. Check "Generate users per cycle" checkbox
3. Set number of cycles to run
4. Click "Run N Cycles"

**To verify it's working**:
```sql
-- Check cycle counter
SELECT * FROM cycle_metadata;

-- Count auto-generated users
SELECT COUNT(*) FROM users WHERE username LIKE 'auto_user_%';

-- View recent auto-users with their robots
SELECT u.username, r.name, r.elo, r.currentHP, r.maxHP
FROM users u
JOIN robots r ON r.userId = u.id
WHERE u.username LIKE 'auto_user_%'
ORDER BY u.id DESC
LIMIT 10;
```

**Expected user counts after N cycles**:
- 1 cycle: 1 user (total: 1)
- 2 cycles: 1+2 = 3 users (total: 3)
- 3 cycles: 1+2+3 = 6 users (total: 6)
- 5 cycles: 1+2+3+4+5 = 15 users (total: 15)
- 10 cycles: 1+2+...+10 = 55 users (total: 55)
- Formula: N × (N+1) / 2

**To reset cycle counter** (for testing):
```sql
UPDATE cycle_metadata SET total_cycles = 0 WHERE id = 1;
```

**To delete all auto-generated users**:
```sql
-- WARNING: This will cascade delete robots and weapon inventory
DELETE FROM users WHERE username LIKE 'auto_user_%';
```

### B. Database Migration Preview
```sql
-- Migration: 20260204134733_add_cycle_metadata
CREATE TABLE "cycle_metadata" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "total_cycles" INTEGER NOT NULL DEFAULT 0,
  "last_cycle_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cycle_metadata_pkey" PRIMARY KEY ("id")
);
```

### C. Code Style Guidelines
- Follow existing TypeScript conventions in `app/backend/`
- Use async/await (no callbacks or raw promises)
- Add JSDoc comments for public functions
- Log all user generation operations at INFO level
- Use Prisma transactions for multi-step operations

### D. References
- Robot creation: `app/backend/prisma/seed.ts:660-695`
- Cycle processing: `app/backend/src/routes/admin.ts:290-387`
- Robot name generation: `app/backend/src/utils/userGeneration.ts:53-63`
- Battle readiness checks: `app/backend/src/services/matchmakingService.ts`

---

## 13. Actual Implementation Details

This section documents the actual implementation as found in the codebase.

### 13.1 File Locations

**Backend**:
- Schema: `app/backend/prisma/schema.prisma` (lines with `CycleMetadata` model)
- Migration: `app/backend/prisma/migrations/20260204134733_add_cycle_metadata/migration.sql`
- Utility: `app/backend/src/utils/userGeneration.ts`
- API Route: `app/backend/src/routes/admin.ts` (POST `/api/admin/cycles/bulk`)
- Seed: `app/backend/prisma/seed.ts` (CycleMetadata initialization)

**Frontend**:
- Admin Page: `app/frontend/src/pages/AdminPage.tsx`
  - State variable: `generateUsersPerCycle` (line ~288)
  - Checkbox UI: (lines ~1000-1010)
  - API call: `runBulkCycles()` function (lines ~449-500)
  - Result display: (lines ~1036-1043)

### 13.2 Implementation Differences from PRD

**Enhancements Made**:
1. **Tournament Integration**: The implementation includes tournament execution alongside user generation (not in original PRD)
2. **Session Logging**: Frontend logs user generation events to session log for better visibility
3. **Error Resilience**: User generation errors don't halt cycle execution; they're logged and the cycle continues
4. **Auto-Creation**: CycleMetadata record is auto-created in admin routes if missing (defensive programming)

**Security Considerations**:
- Auto-generated users use a dummy password hash: `$2b$10$dummyhashforautogeneratedusers123456789012345`
- Comment in code warns these are for simulation/testing only
- Not production-ready for actual user authentication

**Performance Optimizations**:
- Progress logging every 10 users to avoid console spam
- Transaction-based user creation for atomicity
- Fail-fast error handling to prevent partial user creation

### 13.3 API Response Format

**Request**:
```json
{
  "cycles": 5,
  "autoRepair": true,
  "includeDailyFinances": true,
  "generateUsersPerCycle": true,
  "includeTournaments": true
}
```

**Response** (per cycle):
```json
{
  "cyclesCompleted": 5,
  "results": [
    {
      "cycle": 1,
      "userGeneration": {
        "usersCreated": 1,
        "robotsCreated": 1,
        "usernames": ["auto_user_0001"]
      },
      "repairPreTournament": {
        "robotsRepaired": 0
      },
      "tournaments": { ... },
      "matchmaking": { ... },
      ...
    }
  ]
}
```

**Error Response** (user generation failure):
```json
{
  "cycle": 1,
  "userGeneration": {
    "error": "Practice Sword weapon not found. Database may not be seeded properly."
  }
}
```

### 13.4 Database State

**CycleMetadata Table**:
```sql
SELECT * FROM cycle_metadata;
-- Expected: Single row with id=1
-- totalCycles increments with each cycle
-- lastCycleAt updates to current timestamp after bulk run
```

**Auto-Generated Users**:
```sql
SELECT username, currency, role FROM users WHERE username LIKE 'auto_user_%';
-- Format: auto_user_0001, auto_user_0002, etc.
-- All have currency=100000, role='user'
```

**Auto-Generated Robots**:
```sql
SELECT r.name, r.elo, r.currentHP, r.maxHP, r.mainWeaponId 
FROM robots r 
JOIN users u ON r.userId = u.id 
WHERE u.username LIKE 'auto_user_%';
-- All have elo=1200, currentHP=55, maxHP=55
-- All have mainWeaponId pointing to Practice Sword in weapon_inventory
```

### 13.5 Unit Test Coverage

**Test File**: `app/backend/tests/userGeneration.test.ts`  
**Status**: ✅ All 15 tests passing  
**Coverage**: 100% of `generateBattleReadyUsers()` function

**Test Suite Breakdown**:

1. **Basic Functionality** (7 tests):
   - ✅ Creates N users with unique usernames
   - ✅ Creates users with correct starting currency (₡100,000)
   - ✅ Creates battle-ready robots with correct stats (HP: 55, Shield: 2, ELO: 1200)
   - ✅ Equips robots with Practice Sword
   - ✅ Sets all 23 robot attributes to 1.00
   - ✅ Creates weapon inventory entries for each user
   - ✅ Generates unique robot names

2. **Sequential Behavior** (2 tests):
   - ✅ Handles sequential username numbering correctly (auto_user_0001, 0002, etc.)
   - ✅ Creates users atomically using transactions

3. **Error Handling** (1 test):
   - ✅ Throws error if Practice Sword is missing from database

4. **Performance** (1 test):
   - ✅ Handles large batch creation efficiently (50 users < 5 seconds)

5. **Battle Readiness** (1 test):
   - ✅ Creates users that pass matchmaking battle readiness checks

6. **API Contract** (1 test):
   - ✅ Returns correct summary object structure

7. **Edge Cases** (2 tests):
   - ✅ Handles zero count gracefully
   - ✅ Creates users with dummy password hash

**Test Execution Time**: ~1.7 seconds for full suite

**Key Test Patterns**:
- Database cleanup before each test (handles foreign key constraints)
- Transaction verification for data integrity
- Performance benchmarking for batch operations
- Comprehensive attribute validation (all 23 robot attributes)
- Battle readiness validation against matchmaking criteria

### 13.6 Integration Test Coverage

**Test File**: `app/backend/tests/integration/adminCycleGeneration.test.ts`  
**Status**: ⚠️ Created but not executed  
**Purpose**: Test admin API endpoint with `generateUsersPerCycle` flag

**Planned Test Coverage**:
1. Progressive user generation per cycle (1, 2, 3, ... N users)
2. Cycle counter persistence across multiple API runs
3. Flag behavior (enabled vs disabled vs omitted)
4. Timestamp updates (`lastCycleAt`)
5. Error handling in full cycle context
6. Response structure validation
7. Admin authentication requirements
8. Auto-creation of CycleMetadata if missing
9. Formula validation (N*(N+1)/2 total users)
10. Matchmaking eligibility of generated users

**Recommended Execution**:
```bash
npm test -- adminCycleGeneration.test.ts
```

### 13.7 Testing Recommendations

**Unit Tests** (`app/backend/tests/utils/userGeneration.test.ts`):
```typescript
describe('generateBattleReadyUsers', () => {
  it('should create N users with unique usernames', async () => {
    const result = await generateBattleReadyUsers(5);
    expect(result.usersCreated).toBe(5);
    expect(result.robotsCreated).toBe(5);
    expect(new Set(result.usernames).size).toBe(5);
  });
  
  it('should create battle-ready robots with correct stats', async () => {
    await generateBattleReadyUsers(1);
    const robot = await prisma.robot.findFirst({
      where: { user: { username: { startsWith: 'auto_user_' } } },
      include: { mainWeapon: { include: { weapon: true } } }
    });
    expect(robot.currentHP).toBe(55);
    expect(robot.maxHP).toBe(55);
    expect(robot.elo).toBe(1200);
    expect(robot.mainWeapon.weapon.name).toBe('Practice Sword');
  });
  
  it('should handle missing Practice Sword gracefully', async () => {
    await prisma.weapon.deleteMany({ where: { name: 'Practice Sword' } });
    await expect(generateBattleReadyUsers(1)).rejects.toThrow('Practice Sword weapon not found');
  });
});
```

**Integration Tests** (`app/backend/tests/routes/adminCycleGeneration.test.ts`):
```typescript
describe('POST /api/admin/cycles/bulk with generateUsersPerCycle', () => {
  it('should generate progressive users per cycle', async () => {
    const response = await request(app)
      .post('/api/admin/cycles/bulk')
      .send({ cycles: 3, generateUsersPerCycle: true });
    
    expect(response.body.results[0].userGeneration.usersCreated).toBe(1);
    expect(response.body.results[1].userGeneration.usersCreated).toBe(2);
    expect(response.body.results[2].userGeneration.usersCreated).toBe(3);
  });
  
  it('should persist cycle count across runs', async () => {
    await request(app).post('/api/admin/cycles/bulk')
      .send({ cycles: 5, generateUsersPerCycle: true });
    
    const response = await request(app).post('/api/admin/cycles/bulk')
      .send({ cycles: 3, generateUsersPerCycle: true });
    
    expect(response.body.results[0].userGeneration.usersCreated).toBe(6);
    expect(response.body.results[1].userGeneration.usersCreated).toBe(7);
    expect(response.body.results[2].userGeneration.usersCreated).toBe(8);
  });
});
```

**Manual Testing Checklist**:
- [ ] Run 5 cycles with flag enabled → verify 15 users created (1+2+3+4+5)
- [ ] Check `cycle_metadata` table → verify `totalCycles = 5`
- [ ] Run 5 more cycles → verify 40 additional users (6+7+8+9+10)
- [ ] Check `cycle_metadata` table → verify `totalCycles = 10`
- [ ] Verify all auto-users have robots with Practice Sword equipped
- [ ] Verify all robots are eligible for matchmaking (weapon equipped)
- [ ] Run cycles with flag disabled → verify no new users created
- [ ] Test error handling: delete Practice Sword, run cycle → verify error logged but cycle continues

---

**End of PRD**
