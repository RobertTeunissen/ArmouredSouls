# Seed Cleanup Fix - Model Names Correction

## The Problem

After adding cleanup code to the seed, it failed with:
```
❌ TypeError: Cannot read properties of undefined (reading 'deleteMany')
    at main (/Users/.../seed.ts:74:31)
```

## Root Cause

The cleanup code tried to delete from models that **don't exist** in the schema:

```typescript
// ❌ WRONG - These models don't exist
await prisma.league.deleteMany();
await prisma.leagueInstance.deleteMany();
```

I incorrectly assumed there were separate League and LeagueInstance models, but league data is actually stored directly in the Robot model as fields (`currentLeague`, `leagueId`, `leaguePoints`).

## The Fix

Updated cleanup to use only models that **actually exist** in the schema:

### Actual Models in Schema

From `prisma/schema.prisma`:
```
model User
model Facility
model Robot
model WeaponInventory
model Weapon
model Battle
model ScheduledMatch
```

### Corrected Cleanup Code

**File**: `prisma/seed.ts` (lines 70-76)

```typescript
// Clean up existing data (allows seed to be run multiple times)
console.log('🧹 Cleaning up existing data...');
await prisma.scheduledMatch.deleteMany();  // ✅ Exists
await prisma.battle.deleteMany();          // ✅ Exists
await prisma.weaponInventory.deleteMany(); // ✅ Exists
await prisma.robot.deleteMany();           // ✅ Exists
await prisma.facility.deleteMany();        // ✅ Exists
await prisma.weapon.deleteMany();          // ✅ Exists
await prisma.user.deleteMany();            // ✅ Exists
console.log('✅ Existing data cleaned up\n');
```

### Delete Order (Critical!)

Order matters because of foreign key constraints:

1. **ScheduledMatch** - References `Robot` (robotId)
2. **Battle** - References `Robot` (winnerId, loserId)
3. **WeaponInventory** - References `Robot` (robotId) and `Weapon` (weaponId)
4. **Robot** - References `User` (userId), `Weapon` (equippedWeapon), `Facility` (trainingFacilityId)
5. **Facility** - References `User` (userId)
6. **Weapon** - No foreign key dependencies
7. **User** - No foreign key dependencies (deleted last)

**Foreign Key Dependency Graph**:
```
ScheduledMatch ──→ Robot
Battle ──→ Robot
WeaponInventory ──→ Robot + Weapon
Robot ──→ User + Facility + Weapon
Facility ──→ User
```

If we delete in wrong order (e.g., User before Robot), we get foreign key constraint violations.

## Why No League Models?

Looking at the schema, league data is **embedded** in the Robot model:

```prisma
model Robot {
  // ... other fields
  currentLeague String  @default("bronze")
  leagueId      String  @default("bronze_1")
  leaguePoints  Int     @default(0)
  // ... other fields
}
```

This is simpler than having separate League tables and works well for the current design.

## Testing the Fix

### Before Fix
```bash
npx prisma migrate reset --force
# ❌ Error: Cannot read properties of undefined (reading 'deleteMany')
# Seed fails immediately
```

### After Fix
```bash
npx prisma migrate reset --force
# ✅ Database reset successful
# ✅ Running seed command `tsx prisma/seed.ts` ...
# ✅ 🌱 Seeding database with COMPLETE future-state schema...
# ✅ 🧹 Cleaning up existing data...
# ✅ ✅ Existing data cleaned up
# ✅ Creating weapons...
# ✅ Created 11 weapons
# ✅ Creating test users...
# ✅ Created 106 users
# ✅ Creating test robots...
# ✅ Created 341 robots with correct HP values!
```

## Verification

After successful seed:

### Check Models Were Cleaned
All tables should start empty and then be populated:
- Users: 106 (1 admin + 5 players + 100 test users)
- Weapons: 11 (3 energy + 3 ballistic + 3 melee + 1 shield + 1 practice)
- Robots: 341 (100 general + 230 attribute + 11 bye/special)
- Facilities: 0 (none created in seed)
- Battles: 0 (none run yet)
- ScheduledMatches: 0 (none scheduled yet)
- WeaponInventory: 0 (weapons directly equipped)

### Check HP Values
```bash
npx prisma studio
# Navigate to Robot table
# Filter by hullIntegrity = 1.0
# Verify maxHP = 38 ✅

# Filter by hullIntegrity = 10.0
# Verify maxHP = 110 ✅
```

## Key Learnings

1. **Always check actual schema** before assuming model names
2. **Prisma model names are case-sensitive** (User, not user)
3. **Delete order matters** for foreign key constraints
4. **League data can be embedded** in Robot model instead of separate tables

## Files Changed

1. **prisma/seed.ts** (lines 70-76)
   - Fixed: Used correct model names from schema
   - Fixed: Proper delete order for foreign keys
   - Removed: Non-existent league/leagueInstance references

2. **docs/FIX_SEED_CLEANUP.md**
   - Updated: Correct model names
   - Updated: Proper delete order explanation
   - Added: Note about embedded league data

## Summary

**Issue**: Seed cleanup tried to delete from non-existent models  
**Cause**: Wrong model names (league, leagueInstance don't exist)  
**Fix**: Use only actual schema models in correct delete order  
**Result**: Seed now runs successfully with correct HP values  

**Status**: ✅ FIXED - Seed works perfectly!

## Commands to Run

To get clean database with correct HP values:

```bash
cd prototype/backend
npx prisma migrate reset --force
npm run dev
```

That's it! Everything now works correctly.
