# Quick Fix: Admin Page Database Error

## The Problem You're Seeing

When you open `/admin` for the first time, you get this error:
```
Failed to retrieve battles
The column `battles.robot1_prestige_awarded` does not exist in the current database.
```

## Why This Happened

In the recent updates, I added new features to track battle rewards (credits, prestige, fame) in the database. The Prisma schema was updated, but the actual database columns haven't been created yet. This is a normal part of database development - schema changes need to be "migrated" to the actual database.

## How to Fix It (Takes 30 seconds)

### Option 1: Run the Migration Script (Easiest)

```bash
cd prototype/backend
./apply-battle-rewards-migration.sh
```

This script will:
- ✅ Check if your database is running
- ✅ Add the 4 new columns to the battles table
- ✅ Verify everything worked
- ✅ Show you a success message

### Option 2: Use Prisma Migrate

```bash
cd prototype/backend
npx prisma migrate deploy
```

This applies all pending migrations automatically.

## After Running the Migration

1. Refresh the `/admin` page - the error should be gone
2. You'll now see battle rewards (prestige, fame, credits) in battle details
3. Everything else continues to work normally

## What Changed

The migration adds 4 new columns to track rewards:
- `robot1_prestige_awarded` - Prestige given to robot 1's owner
- `robot2_prestige_awarded` - Prestige given to robot 2's owner
- `robot1_fame_awarded` - Fame points robot 1 earned
- `robot2_fame_awarded` - Fame points robot 2 earned

All existing battles will have these values set to 0, and new battles will populate them automatically.

## Need Help?

See `prototype/backend/MIGRATION_BATTLE_REWARDS.md` for:
- Detailed instructions
- Troubleshooting tips
- Manual SQL if needed
- Full explanation of changes

## TL;DR

Run this:
```bash
cd prototype/backend
./apply-battle-rewards-migration.sh
```

Then refresh `/admin` - it should work! ✨
