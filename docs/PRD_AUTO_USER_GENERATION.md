# Product Requirements Document: Auto-User Generation Per Cycle

**Version**: 1.0  
**Date**: February 4, 2026  
**Author**: GitHub Copilot  
**Status**: Approved for Implementation

---

## 1. Executive Summary

This PRD defines the requirements for an automated user and robot generation system that progressively adds new battle-ready players to the Armoured Souls system during each cycle. This feature simulates organic user growth and ensures a healthy, growing player base for matchmaking as the game progresses through multiple cycles.

### Key Objectives
- Add 1 user in cycle 1, 2 users in cycle 2, 3 users in cycle 3, etc.
- Generate fully functional, battle-ready robots for each new user
- Support continuous cycle generation (works across multiple bulk cycle runs)
- Provide admin control via UI flag in `/admin` dashboard

---

## 2. Problem Statement

### Current State
- The admin dashboard allows triggering cycles via `POST /api/admin/cycles/bulk`
- User base is static (100 test users + manual users created during seeding)
- No mechanism for simulating user growth over time

### Desired State
- Each cycle automatically generates N new users (where N = cycle number)
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
**Description**: A reusable utility function creates battle-ready users with equipped robots.

**Acceptance Criteria**:
- Function generates N users in a single call
- Each user receives a unique username (format: `auto_user_NNNN`)
- Each user starts with ₡100,000 currency (standard test user amount)
- Each user receives 1 robot with:
  - Randomized name from existing `generateRobotName()` function
  - All 23 attributes set to 1.00 (baseline)
  - HP: 55 (calculated: 50 + hullIntegrity × 5)
  - Shield: 2 (calculated: shieldCapacity × 2)
  - ELO: 1200 (starting rank)
  - League: bronze_1 (entry tier)
  - Loadout: single-handed with Practice Sword equipped
  - Battle readiness: 100%

**Function Signature**:
```typescript
async function generateBattleReadyUsers(count: number): Promise<{
  usersCreated: number;
  robotsCreated: number;
  usernames: string[];
}>
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
  "generateUsersPerCycle": true  // NEW FLAG
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
        "robotsCreated": 1,
        "usernames": ["auto_user_0001"]
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
[✓] Generate Users Per Cycle  // NEW CHECKBOX
    ℹ️ Adds N users each cycle (cycle 1 → 1 user, cycle 2 → 2 users, etc.)
```

---

### 3.2 Non-Functional Requirements

#### NFR-1: Performance
- User generation must complete within 5 seconds for batches up to 100 users
- Should not block cycle execution for more than 10% of total cycle time
- Database writes must use batch operations where possible

#### NFR-2: Data Integrity
- All generated users must have valid weapon inventory entries
- Robots must pass battle-readiness checks (HP ≥ 75%, weapons equipped)
- No duplicate usernames (auto-increment numbering ensures uniqueness)

#### NFR-3: Maintainability
- Reuse existing `generateRobotName()` function from seed.ts
- Follow existing code patterns for user/robot creation
- Add comprehensive inline comments for future developers

---

## 4. Implementation Plan

### Phase 1: Database Schema (30 minutes)
1. Create `CycleMetadata` model in `schema.prisma`
2. Run migration: `npm run prisma:migrate -- --name add_cycle_metadata`
3. Update seed script to initialize `CycleMetadata` record with `totalCycles: 0`

**Files Modified**:
- `prototype/backend/prisma/schema.prisma`
- `prototype/backend/prisma/seed.ts`

---

### Phase 2: User Generation Utility (1 hour)
1. Create `/utils/userGeneration.ts` with `generateBattleReadyUsers()` function
2. Import `generateRobotName()` logic from seed.ts (or extract to shared utility)
3. Implement transaction-safe user/robot/weapon-inventory creation
4. Add comprehensive error handling and logging

**Files Created**:
- `prototype/backend/src/utils/userGeneration.ts`

**Dependencies**:
- Reuse `DEFAULT_ROBOT_ATTRIBUTES` from seed.ts
- Reuse robot name generation logic

---

### Phase 3: Admin Endpoint Integration (1 hour)
1. Update `POST /api/admin/cycles/bulk` to accept `generateUsersPerCycle` flag
2. Fetch current `totalCycles` from `CycleMetadata` at start of bulk run
3. For each cycle:
   - Increment `totalCycles` counter
   - If flag enabled, call `generateBattleReadyUsers(totalCycles)`
   - Store generation summary in cycle results
4. Update `CycleMetadata.totalCycles` after all cycles complete

**Files Modified**:
- `prototype/backend/src/routes/admin.ts`

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

### Phase 4: Frontend Integration (1 hour)
1. Update admin dashboard component to add checkbox
2. Add state variable: `generateUsersPerCycle` (boolean, default: false)
3. Include in API request body when triggering cycles
4. Update results display to show user generation summary

**Files Modified**:
- `prototype/frontend/src/pages/Admin.tsx` (or equivalent admin component)

---

### Phase 5: Testing & Validation (1 hour)
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
- `prototype/backend/tests/utils/userGeneration.test.ts`
- `prototype/backend/tests/routes/adminCycleGeneration.test.ts`

---

### Phase 6: Documentation (30 minutes)
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
✅ currentHP >= 75% of maxHP (55 >= 0.75 × 55 = 41.25) → PASS
✅ currentHP % >= yieldThreshold (100% >= 10%) → PASS
✅ mainWeaponId is not null → PASS
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
- [ ] `CycleMetadata` table created and seeded with initial record
- [ ] `generateBattleReadyUsers()` utility function implemented
- [ ] `POST /api/admin/cycles/bulk` accepts `generateUsersPerCycle` flag
- [ ] Admin UI checkbox for "Generate Users Per Cycle" functional
- [ ] Unit tests pass with >80% coverage
- [ ] Integration tests verify cycle persistence
- [ ] Manual testing confirms:
  - 5 cycles → 15 users (1+2+3+4+5)
  - Wait, 5 more cycles → 40 users (6+7+8+9+10)
  - `totalCycles` counter = 10
- [ ] Documentation updated (PRD, API docs, inline comments)
- [ ] Code reviewed and approved by maintainer

---

## 11. Timeline & Resources

**Total Effort**: 5.5 hours (single developer)

| Phase | Duration | Owner |
|-------|----------|-------|
| Database Schema | 30 min | Backend Dev |
| User Generation Utility | 1 hour | Backend Dev |
| Admin Endpoint Integration | 1 hour | Backend Dev |
| Frontend Integration | 1 hour | Frontend Dev |
| Testing & Validation | 1 hour | QA/Dev |
| Documentation | 30 min | Dev/PM |

**Risk Level**: Low  
**Complexity**: Medium  
**Priority**: High (enables matchmaking scalability testing)

---

## 12. Appendix

### A. Database Migration Preview
```sql
-- Migration: 20260204_add_cycle_metadata
CREATE TABLE "cycle_metadata" (
  "id" SERIAL PRIMARY KEY,
  "total_cycles" INTEGER NOT NULL DEFAULT 0,
  "last_cycle_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Initialize with single record (id=1)
INSERT INTO "cycle_metadata" (id, total_cycles) VALUES (1, 0);
```

### B. Code Style Guidelines
- Follow existing TypeScript conventions in `prototype/backend/`
- Use async/await (no callbacks or raw promises)
- Add JSDoc comments for public functions
- Log all user generation operations at INFO level
- Use Prisma transactions for multi-step operations

### C. References
- Robot creation: `prototype/backend/prisma/seed.ts:660-695`
- Cycle processing: `prototype/backend/src/routes/admin.ts:290-387`
- Robot name generation: `prototype/backend/prisma/seed.ts:54-63`
- Battle readiness checks: `prototype/backend/src/services/matchmakingService.ts`

---

**End of PRD**
