# Seed Cleanup Fix

## Problem

The seed file failed with a unique constraint error when trying to create users that already existed:

```
❌ Error seeding database: PrismaClientKnownRequestError: 
Invalid `prisma.user.create()` invocation
Unique constraint failed on the fields: (`username`)
```

This happened because:
1. The seed file didn't delete existing data before creating new data
2. Running `npx prisma db seed` after data already existed caused conflicts
3. Even after `migrate reset`, residual data could cause issues

## Solution

Added cleanup code at the start of the seed's `main()` function to delete all existing data before creating new data.

### Code Changes

**File**: `prototype/backend/prisma/seed.ts` (lines 68-76)

```typescript
async function main() {
  console.log('🌱 Seeding database with COMPLETE future-state schema...');

  // Clean up existing data (allows seed to be run multiple times)
  console.log('🧹 Cleaning up existing data...');
  await prisma.battle.deleteMany();
  await prisma.robot.deleteMany();
  await prisma.weapon.deleteMany();
  await prisma.user.deleteMany();
  await prisma.leagueInstance.deleteMany();
  await prisma.league.deleteMany();
  console.log('✅ Existing data cleaned up\n');

  // ... rest of seed code
}
```

### Delete Order

The deletion order is critical to respect foreign key constraints:

1. **Battles** - References robots (must be deleted first)
2. **Robots** - References users and weapons
3. **Weapons** - Can be deleted after robots
4. **Users** - Can be deleted after robots
5. **LeagueInstances** - References leagues
6. **Leagues** - Can be deleted last

## Usage

### Full Reset and Seed

```bash
cd prototype/backend
npx prisma migrate reset --force
```

This automatically:
1. Drops the database
2. Recreates it
3. Runs all migrations
4. Runs the seed (which now cleans up first)

### Seed Only

```bash
cd prototype/backend
npx prisma db seed
```

This can now be run multiple times without errors because it cleans up existing data first.

## Expected Output

```
🌱 Seeding database with COMPLETE future-state schema...
🧹 Cleaning up existing data...
✅ Existing data cleaned up

Creating weapons...
✅ Created 11 weapons
   - 3 energy weapons (Laser Rifle, Plasma Cannon, Ion Beam)
   - 3 ballistic weapons (Machine Gun, Railgun, Shotgun)
   - 3 melee weapons (Power Sword, Hammer, Plasma Blade)
   - 1 shield weapon (Combat Shield)
   - 1 practice weapon (Practice Sword - FREE)

Creating test users (admin + player1-5 + 100 test users)...
✅ Created admin user
✅ Created 5 player users (player1-player5)
✅ Created 100 test users (test_user_001 - test_user_100)

Creating test robots...
✅ Created 100 robots for test users (1 robot each)

Creating attribute-focused test robots (23 × 10 = 230 bots)...
✅ Created 230 attribute-focused test robots

📊 Total robots created: 331 (100 general + 230 attribute-focused + 1 bye)

📝 HP Formula: maxHP = 30 + (hullIntegrity × 8)
🛡️  Shield Formula: maxShield = shieldCapacity × 2

✅ Database seeded successfully!
```

## Impact

**Before Fix**:
- ❌ Seed failed with unique constraint errors
- ❌ Couldn't run seed multiple times
- ❌ Manual cleanup required

**After Fix**:
- ✅ Seed runs cleanly every time
- ✅ Can be run multiple times
- ✅ Automatic cleanup
- ✅ All robots have correct HP values (38 or 110 HP)

## Verification

To verify the fix works:

1. **Test Multiple Runs**:
   ```bash
   npx prisma db seed
   npx prisma db seed  # Should work without errors
   ```

2. **Check Robot HP Values**:
   ```bash
   npx prisma studio
   # Check robots table
   # Hull=1 robots should have 38 HP
   # Hull=10 robots should have 110 HP
   ```

3. **Full Reset Test**:
   ```bash
   npx prisma migrate reset --force
   # Should complete successfully with seed
   ```

## Related Issues

This fix completes the HP formula implementation:
- ✅ Formula defined in `robotCalculations.ts`
- ✅ Robot creation uses formula
- ✅ Attribute upgrades recalculate HP
- ✅ UI displays correct formula
- ✅ Admin endpoint for existing robots
- ✅ Seed creates with correct HP
- ✅ Seed cleans up before creating (this fix)

## Technical Notes

### Why DeleteMany Instead of Truncate?

Prisma doesn't have a native truncate command, so we use `deleteMany()` which:
- Respects foreign key constraints (with correct order)
- Works across all database providers
- Is safe and predictable
- Allows the seed to be truly idempotent

### Why This Order?

The delete order follows the foreign key dependency graph:
```
Battles → Robots → (Weapons, Users) → LeagueInstances → Leagues
```

If we deleted in the wrong order (e.g., Users before Robots), we'd get foreign key constraint errors.

### Alternative: Transaction

While we could wrap the cleanup in a transaction, it's not necessary here because:
1. The seed is run in isolation
2. If cleanup fails, the seed should fail
3. Simpler code is easier to maintain

## Conclusion

The seed file now properly cleans up existing data before creating new data, making it truly idempotent and allowing it to be run multiple times without errors. Combined with the HP formula fixes, all robots are now created with the correct HP values (38 for hull=1, 110 for hull=10).
