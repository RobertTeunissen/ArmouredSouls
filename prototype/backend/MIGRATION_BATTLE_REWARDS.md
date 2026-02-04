# Database Migration: Battle Rewards Tracking

## Issue
When opening `/admin` for the first time after recent updates, you may see the error:
```
Failed to retrieve battles
The column `battles.robot1_prestige_awarded` does not exist in the current database.
```

## Cause
The Prisma schema was updated to include battle rewards tracking fields, but the database migration hasn't been applied yet.

## Solution

### Quick Fix (Recommended)
Run the migration script from the `prototype/backend` directory:

```bash
cd prototype/backend
./apply-battle-rewards-migration.sh
```

This script will:
1. Check if the database is running
2. Apply the migration to add the 4 new columns
3. Verify the columns were added successfully

### Alternative: Using Prisma Migrate

If you prefer using Prisma's built-in migration tool:

```bash
cd prototype/backend
npx prisma migrate deploy
```

This will apply all pending migrations, including the battle rewards tracking migration.

### Manual SQL (If needed)

If both methods above fail, you can apply the migration manually using psql:

```bash
cd prototype/backend
PGPASSWORD=password psql -h localhost -U armouredsouls -d armouredsouls
```

Then run:
```sql
ALTER TABLE battles 
ADD COLUMN IF NOT EXISTS robot1_prestige_awarded INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS robot2_prestige_awarded INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS robot1_fame_awarded INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS robot2_fame_awarded INTEGER NOT NULL DEFAULT 0;
```

## Verification

After applying the migration, you should be able to:
1. Open `/admin` without errors
2. View battle details with rewards information
3. See prestige and fame awards in battle details modal

## New Columns Added

The migration adds these columns to the `battles` table:

| Column Name                 | Type    | Default | Description                           |
|----------------------------|---------|---------|---------------------------------------|
| robot1_prestige_awarded    | INTEGER | 0       | Prestige awarded to robot 1's user    |
| robot2_prestige_awarded    | INTEGER | 0       | Prestige awarded to robot 2's user    |
| robot1_fame_awarded        | INTEGER | 0       | Fame awarded to robot 1               |
| robot2_fame_awarded        | INTEGER | 0       | Fame awarded to robot 2               |

These columns track the rewards awarded for each battle, allowing the admin interface to display detailed reward information.

## Troubleshooting

### Database not running
If you see "Cannot connect to database", start the database:
```bash
docker-compose up -d
```

### Permission denied on script
If you get a permission error, make the script executable:
```bash
chmod +x apply-battle-rewards-migration.sh
```

### Migration already applied
If the columns already exist, the script will safely skip adding them (using `IF NOT EXISTS`).

## More Information

See:
- `docs/BATTLE_REWARDS_IMPLEMENTATION.md` - Complete implementation details
- `docs/FAME_SYSTEM.md` - Fame system documentation
- `prisma/migrations/20260204082700_add_battle_rewards_tracking/migration.sql` - The migration SQL
