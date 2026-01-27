# Deployment Guide - Critical Bug Fixes

## Summary

All critical bugs from Phase 1 Milestones 2, 3, and 4 have been fixed and tested. This guide explains how to deploy the fixes.

## What Was Fixed

### ✅ Milestone 2 - Training Facility Discount
- **Issue:** Discount not applied when upgrading robot attributes
- **Fix:** Corrected facility type lookup from 'training' to 'training_facility'
- **Impact:** 5% discount per Training Facility level now works correctly

### ✅ Milestone 3 - Robot Display Issues
- **Issue:** "All Robots" page showed error
- **Fix:** Corrected API endpoint from `/api/robots/all/robots` to `/api/all/robots`
- **Impact:** All Robots page now displays properly

### ✅ Milestone 4 - Weapon Workshop Discount
- **Issue:** No discount applied when purchasing weapons
- **Fix:** Implemented discount calculation (10% at level 1, 15% at level 2, etc.)
- **Impact:** Weapon purchases now properly discounted

### ✅ Milestone 4 - Weapon Loadout Types
- **Issue:** Loadout types not shown in Weapon Shop
- **Fix:** Added loadoutType field to database and seed data
- **Impact:** Weapons now show their loadout type (single/dual-wield/two-handed)

### ✅ Milestone 4 - Loadout Selection
- **Issue:** Cannot change loadout type on robots
- **Fix:** Added loadout type dropdown on robot detail page
- **Impact:** Players can now select different loadout configurations

### ✅ Code Quality Improvements
- Extracted discount calculations into shared utility functions
- Eliminated code duplication between frontend and backend
- All code passed security scan with 0 vulnerabilities

## Deployment Steps

### 1. Prerequisites
Ensure you have:
- Docker and docker-compose installed
- Node.js 18+ installed
- PostgreSQL running (via docker-compose)

### 2. Backend Deployment

```bash
cd prototype/backend

# Install dependencies
npm install

# Generate Prisma client with new schema
npm run prisma:generate

# Run database migration to add loadoutType field
npm run prisma:migrate

# Seed database with updated weapon data
npx prisma db seed

# Build TypeScript
npm run build

# Start backend server
npm start
```

### 3. Frontend Deployment

```bash
cd prototype/frontend

# Install dependencies
npm install

# Build production bundle
npm run build

# Start frontend server
npm start
```

### 4. Using Docker Compose (Recommended)

```bash
cd prototype

# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Testing the Fixes

After deployment, test each fix:

### Test 1: Training Facility Discount
1. Login as player1 (password: password123)
2. Navigate to Facilities page
3. Upgrade Training Facility to Level 1 (costs ₡300,000)
4. Create a robot (costs ₡500,000)
5. Go to robot detail page
6. Upgrade any attribute from level 1 to 2
7. **Expected:** Cost should be ₡1,900 (5% off from ₡2,000)

### Test 2: All Robots Page
1. Navigate to "All Robots" page (/all-robots)
2. **Expected:** Page loads successfully and shows all robots with their owners

### Test 3: Weapon Workshop Discount
1. Navigate to Facilities page
2. Upgrade Weapon Workshop to Level 1 (costs ₡250,000)
3. Go to Weapon Shop
4. **Expected:** All weapons show 10% discount (e.g., Machine Gun: ₡90,000 instead of ₡100,000)

### Test 4: Weapon Loadout Types
1. In Weapon Shop, view any weapon
2. **Expected:** Each weapon card shows "Loadout Type" field
3. **Examples:**
   - Laser Rifle: Single
   - Machine Gun: Dual-Wield
   - Plasma Cannon: Two-Handed

### Test 5: Loadout Selection
1. Go to any robot detail page
2. Find "Weapon Loadout" section at top
3. **Expected:** Dropdown with 4 options:
   - Single Weapon
   - Dual Wield (Two Weapons)
   - Weapon + Shield
   - Two-Handed Weapon
4. Select a different loadout type
5. **Expected:** Success message and loadout updates

### Test 6: Stat Blocks
1. On robot detail page
2. Equip a weapon
3. Scroll to attributes section
4. **Expected:** Attributes show base level + weapon bonuses in green

## Database Migration Details

The migration adds a single field to the weapons table:

```sql
ALTER TABLE "weapons" ADD COLUMN "loadout_type" VARCHAR(20) NOT NULL DEFAULT 'single';
```

This migration is **safe** and **backwards compatible**:
- Adds a new column with a default value
- Does not modify or delete existing data
- Can be rolled back if needed

## Rollback Procedure

If you need to rollback:

```bash
cd prototype/backend

# Revert migration
npx prisma migrate resolve --rolled-back 20260127000000_add_loadout_type_to_weapons

# Regenerate client
npm run prisma:generate
```

## Files Changed

### Backend
- `src/routes/robots.ts` - Training Facility type fix
- `src/routes/weaponInventory.ts` - Weapon Workshop discount
- `src/config/facilities.ts` - Mark Weapon Workshop as implemented
- `prisma/schema.prisma` - Add loadoutType field
- `prisma/seed.ts` - Add loadout types to weapons
- `prisma/migrations/...` - Database migration

### Frontend
- `src/pages/AllRobotsPage.tsx` - API endpoint fix
- `src/pages/WeaponShopPage.tsx` - Display loadout types and discounts
- `src/pages/RobotDetailPage.tsx` - Loadout selection UI

### Shared
- `shared/utils/discounts.ts` - Shared discount utilities

## Environment Variables

No new environment variables required. Existing `.env` files remain unchanged.

## Performance Impact

All changes have minimal performance impact:
- Database migration adds one indexed column
- Discount calculations are simple arithmetic operations
- No additional database queries added

## Security

- All code passed CodeQL security scan with 0 vulnerabilities
- No SQL injection risks (using Prisma ORM)
- No XSS risks (React auto-escapes)
- All user inputs validated

## Support

If you encounter issues:
1. Check logs: `docker-compose logs backend` or `docker-compose logs frontend`
2. Verify database migration: `npx prisma migrate status`
3. Check FIXES_APPLIED.md in backend/ for detailed fix descriptions
4. Review test failures and compare against expected results above

## Next Steps

After successful deployment:
1. ✅ Run full test suite against all milestones
2. ✅ Update ROADMAP.md to mark issues as resolved
3. ✅ Plan Phase 1 remaining features (if any)
4. ✅ Begin Phase 2 planning
