# Prisma 7.3.0 Upgrade Verification Plan

## Current Status
- **Current Version**: Prisma 5.22.0 (both `@prisma/client` and `prisma`)
- **Target Version**: Prisma 7.3.0
- **Database**: PostgreSQL
- **Node.js**: v20.20.0 ✅ (Compatible - Prisma 7.x requires Node 18+)
- **TypeScript**: v5.9.3 ✅ (Compatible - Prisma 7.x requires TypeScript 5.1+)

## Executive Summary

⚠️ **IMPORTANT**: Before attempting this upgrade, ensure you understand the risks. If you encounter installation issues during or after the upgrade, refer to [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for recovery steps.

This upgrade spans **2 major versions** (5.x → 6.x → 7.x), which means significant breaking changes need to be carefully evaluated. Based on the codebase analysis, the Armoured Souls application uses standard Prisma features that should be compatible, but testing is critical.

## Prisma Usage Analysis

### Current Prisma Features in Use
1. **Standard CRUD Operations**: ✅ Low Risk
   - `findMany`, `findUnique`, `findFirst`
   - `create`, `update`, `delete`, `upsert`
   - Used extensively across all route files

2. **Transactions**: ⚠️ Medium Risk
   - Interactive transactions using `prisma.$transaction(async (tx) => {...})`
   - Used in 3 locations:
     - `weaponInventory.ts` - weapon purchase
     - `facility.ts` - facility upgrade
     - `robots.ts` - robot attribute upgrade
   - **Action**: Verify transaction behavior hasn't changed

3. **Relations & Includes**: ✅ Low Risk
   - Nested includes for weapons and facilities
   - Standard relation queries
   - **Example**: `include: { mainWeapon: { include: { weapon: true } } }`

4. **Schema Features**: ✅ Low Risk
   - `@id`, `@default`, `@unique`, `@@unique`, `@@index`
   - `@map` for column names (e.g., `@map("user_id")`)
   - `@relation` for foreign keys with `onDelete: Cascade`
   - `Json` type for battle logs
   - Auto-increment IDs
   - DateTime fields with `@updatedAt`

5. **Connection Management**: ✅ Low Risk
   - Basic `prisma.$connect()` and `prisma.$disconnect()`
   - Multiple `new PrismaClient()` instances (could be optimized but not breaking)

### Features NOT Currently Used
- ❌ Raw SQL queries (`$executeRaw`, `$queryRaw`)
- ❌ Prisma Client Extensions
- ❌ Field-level encryption
- ❌ Custom database adapters
- ❌ Enum types with `@map` (no enums in schema)

## Breaking Changes Assessment

### Major Breaking Changes (5.x → 7.x)

#### 1. **Node.js & TypeScript Versions** ✅ PASS
- **Required**: Node.js 18+ and TypeScript 5.1+
- **Current**: Node.js 20.20.0 and TypeScript 5.9.3
- **Impact**: None - versions are compatible

#### 2. **Query Compiler Changes** ⚠️ VERIFY
- Prisma 7.x introduces new query compiler options
- **Impact**: Performance may change (likely improve)
- **Action**: Run performance benchmarks if critical

#### 3. **Transaction Behavior** ⚠️ TEST REQUIRED
- Transaction API may have subtle changes
- **Impact**: 3 transaction usages need verification
- **Action**: Test weapon purchase, facility upgrade, and robot upgrade flows

#### 4. **BigInt in JSON** ℹ️ NOT APPLICABLE
- BigInt fields in JSON are now cast to strings
- **Impact**: None - we don't use BigInt in JSON aggregations
- **Current**: `Json` type only used for `battleLog`

#### 5. **Relation Table Handling (PostgreSQL)** ⚠️ VERIFY
- Implicit many-to-many relations may need migration
- **Impact**: Low - we don't use implicit many-to-many (all relations are explicit)
- **Action**: Review schema after upgrade

#### 6. **Prisma Client Generation** ⚠️ REQUIRED
- Must regenerate client after upgrade
- **Impact**: Critical - app will fail without regeneration
- **Action**: Run `prisma generate` after upgrade

### Schema-Specific Considerations

1. **Mapped Column Names**: ✅ Low Risk
   - Heavy use of `@map` for snake_case columns
   - Behavior should be consistent in v7

2. **Composite Unique Keys**: ✅ Low Risk
   - `@@unique([userId, facilityType])` in Facility model
   - Should work identically in v7

3. **Cascading Deletes**: ✅ Low Risk
   - `onDelete: Cascade` used throughout
   - PostgreSQL handles this at DB level

## Upgrade Verification Steps

### Phase 1: Pre-Upgrade Preparation ✅
- [x] Document current versions and environment
- [x] Analyze Prisma usage patterns
- [x] Identify breaking changes
- [x] Check Node.js and TypeScript compatibility
- [x] Review schema for deprecated features

### Phase 2: Backup & Safety
- [ ] **CRITICAL**: Backup production database before upgrade
- [ ] Document current schema state
- [ ] Create rollback plan
- [ ] Set up test environment with database copy

### Phase 3: Upgrade Execution
1. [ ] Update package.json dependencies:
   ```bash
   npm install --save-dev prisma@7.3.0
   npm install @prisma/client@7.3.0
   ```

2. [ ] Regenerate Prisma Client:
   ```bash
   npm run prisma:generate
   ```

3. [ ] Check for schema warnings:
   ```bash
   npx prisma validate
   ```

4. [ ] Review migration status:
   ```bash
   npx prisma migrate status
   ```

### Phase 4: Testing & Validation

#### Automated Tests
- [ ] Run existing test suite: `npm test`
- [ ] Verify all 21 tests pass
- [ ] Check for new warnings in test output
- [ ] Monitor test execution time for performance changes

#### Manual API Testing
- [ ] **Authentication**: Login/register flows
- [ ] **User Operations**: Profile fetch and update
- [ ] **Robot Management**:
  - [ ] Create new robot
  - [ ] Fetch robot details
  - [ ] Upgrade robot attributes (tests transaction)
- [ ] **Facility Operations**:
  - [ ] View facilities
  - [ ] Upgrade facility (tests transaction)
- [ ] **Weapon Inventory**:
  - [ ] View weapon inventory
  - [ ] Purchase weapon (tests transaction)
  - [ ] Equip/unequip weapons

#### Database Verification
- [ ] Connect to database: `npm run prisma:studio`
- [ ] Verify data integrity
- [ ] Check foreign key constraints
- [ ] Test database migrations if any pending

#### Integration Testing
- [ ] Start backend: `npm run dev`
- [ ] Verify server starts without errors
- [ ] Check console for Prisma warnings
- [ ] Test API endpoints with frontend
- [ ] Monitor for runtime errors

### Phase 5: Performance Verification
- [ ] Compare query execution times (optional but recommended)
- [ ] Monitor memory usage
- [ ] Check connection pool behavior
- [ ] Verify no N+1 query issues

### Phase 6: Production Readiness
- [ ] Update deployment scripts if needed
- [ ] Document any code changes made
- [ ] Update team on upgrade results
- [ ] Plan production deployment window
- [ ] Prepare rollback procedure

## Risk Assessment Matrix

| Area | Risk Level | Impact | Mitigation |
|------|-----------|--------|------------|
| Node.js/TypeScript versions | ✅ Low | None | Already compatible |
| Standard CRUD operations | ✅ Low | None | Well-tested API surface |
| Transactions | ⚠️ Medium | High | Comprehensive testing required |
| Schema migrations | ✅ Low | Low | No breaking schema changes |
| Relation queries | ✅ Low | Low | Standard features |
| Connection management | ⚠️ Medium | Medium | Monitor connection behavior |
| Overall upgrade | ⚠️ Medium | Medium | Follow verification plan |

## Expected Outcomes

### ✅ Likely Success Indicators
- Application uses standard, well-documented Prisma features
- No raw SQL or advanced features that often break
- Runtime versions are compatible
- Simple schema with standard PostgreSQL features

### ⚠️ Areas Requiring Attention
- 3 transaction usages need functional verification
- Connection pooling behavior should be monitored
- Test suite must pass completely

### ❌ Potential Issues
- None identified in static analysis
- If issues arise, they'll likely be in:
  1. Transaction behavior edge cases
  2. Query performance changes
  3. Generated client TypeScript types

## Rollback Plan

⚠️ **IMPORTANT**: If you've attempted an upgrade and your installation is now broken, follow the complete recovery steps in [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) instead of just running these commands.

If critical issues are discovered during testing:

1. **Immediate Rollback**:
   ```bash
   npm install --save-dev prisma@5.22.0
   npm install @prisma/client@5.22.0
   npm run prisma:generate
   ```

2. **Clear node_modules** (if needed):
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **If prisma generate fails**: Follow the complete clean installation procedure in [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

4. **Restore database backup** (if database corruption occurs)

## Recommendations

### ✅ SAFE TO PROCEED
The upgrade from Prisma 5.22.0 to 7.3.0 appears **safe to proceed** with the following conditions:

1. **Follow the verification plan completely**
2. **Test transactions thoroughly** - they're mission-critical
3. **Run the full test suite** with a test database
4. **Have database backups** before production deployment
5. **Plan for a maintenance window** in case issues arise

### 🎯 Immediate Next Steps
1. Set up test database environment
2. Execute Phase 3: Upgrade Execution
3. Run comprehensive tests (Phase 4)
4. Document any issues found
5. Decide go/no-go for production

### 📊 Confidence Level
**75-80%** - The application uses standard Prisma features in a straightforward way. The main risk is transaction behavior changes and thorough testing will validate safety.

## References

- [Prisma 7.3.0 Release Notes](https://github.com/prisma/prisma/releases/tag/7.3.0)
- [Prisma 6.x Breaking Changes](https://github.com/prisma/prisma/releases/tag/6.0.0)
- [Prisma Upgrade Guide](https://www.prisma.io/docs/guides/upgrade-guides/upgrading-versions)
- [PostgreSQL Compatibility](https://www.prisma.io/docs/reference/database-reference/database-features)

---

**Document Version**: 1.0  
**Created**: 2026-01-29  
**Author**: GitHub Copilot Agent  
**Status**: Ready for Review
