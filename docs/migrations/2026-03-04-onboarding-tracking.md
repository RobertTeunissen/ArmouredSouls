# Migration: Onboarding Tracking System

**Date**: 2026-03-04  
**Migration Name**: `add_onboarding_tracking`  
**Type**: Schema + Data Migration  
**Feature**: New Player Onboarding System

## Overview

This migration adds onboarding tracking capabilities to the User model and creates a new ResetLog table for tracking account resets. It supports the new interactive tutorial system that guides new players through strategic decisions.

## Schema Changes

### User Table Modifications

Added 7 new columns to the `users` table:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `has_completed_onboarding` | BOOLEAN | false | Whether user has completed or skipped onboarding |
| `onboarding_skipped` | BOOLEAN | false | Whether user explicitly skipped the tutorial |
| `onboarding_step` | INTEGER | 1 | Current tutorial step (1-9) |
| `onboarding_strategy` | VARCHAR(20) | NULL | Chosen roster strategy: "1_mighty", "2_average", or "3_flimsy" |
| `onboarding_choices` | JSONB | {} | Player's choices during onboarding (JSON object) |
| `onboarding_started_at` | TIMESTAMP | NULL | When user started onboarding |
| `onboarding_completed_at` | TIMESTAMP | NULL | When user completed onboarding |

### New Table: reset_logs

Created new table to track account resets:

```sql
CREATE TABLE "reset_logs" (
    "id" SERIAL PRIMARY KEY,
    "user_id" INTEGER NOT NULL,
    "robots_deleted" INTEGER NOT NULL,
    "weapons_deleted" INTEGER NOT NULL,
    "facilities_deleted" INTEGER NOT NULL,
    "credits_before_reset" DECIMAL(15,2) NOT NULL,
    "reason" TEXT,
    "reset_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "reset_logs_user_id_idx" ON "reset_logs"("user_id");
CREATE INDEX "reset_logs_reset_at_idx" ON "reset_logs"("reset_at");
```

## Data Migration

### Existing Users

All existing users must be marked as having completed onboarding to avoid forcing them through the tutorial.

**Script**: `prototype/backend/scripts/migrate-existing-users-onboarding.ts`

**What it does**:
- Marks all existing users with `hasCompletedOnboarding = true`
- Sets `onboardingSkipped = false` (they didn't skip, they pre-date the feature)
- Sets `onboardingCompletedAt` to current timestamp

**How to run**:
```bash
cd prototype/backend
npx tsx scripts/migrate-existing-users-onboarding.ts
```

**Expected output**:
```
Starting data migration: Mark existing users as onboarding complete
======================================================================

Total users in database: 150
Users to update: 150

✓ Successfully updated 150 users
  - hasCompletedOnboarding: true
  - onboardingSkipped: false
  - onboardingCompletedAt: current timestamp

Verification: 150/150 users marked as completed
✓ Migration successful - all users updated

======================================================================
Migration complete
```

## Deployment Steps

### Local Development

1. Pull latest code with schema changes
2. Run Prisma migration:
   ```bash
   cd prototype/backend
   npx prisma migrate dev
   ```
3. Run data migration script:
   ```bash
   npx tsx scripts/migrate-existing-users-onboarding.ts
   ```

### ACC Environment

1. Deploy code to ACC
2. SSH into ACC server
3. Run Prisma migration:
   ```bash
   cd /opt/armouredsouls/backend
   npx prisma migrate deploy
   ```
4. Run data migration script:
   ```bash
   npx tsx scripts/migrate-existing-users-onboarding.ts
   ```
5. Verify migration:
   ```bash
   npx prisma studio
   # Check that all users have hasCompletedOnboarding = true
   ```

### Production Environment

**CRITICAL**: Follow the same steps as ACC, but with extra caution:

1. **Backup database first**:
   ```bash
   /opt/armouredsouls/scripts/backup.sh
   ```
2. Deploy code to production
3. SSH into production server
4. Run Prisma migration:
   ```bash
   cd /opt/armouredsouls/backend
   npx prisma migrate deploy
   ```
5. Run data migration script:
   ```bash
   npx tsx scripts/migrate-existing-users-onboarding.ts
   ```
6. Verify migration:
   ```bash
   # Check user count
   psql -d armouredsouls -c "SELECT COUNT(*) FROM users WHERE has_completed_onboarding = true;"
   ```

## Rollback Procedure

If issues arise, rollback steps:

1. **Restore database from backup**:
   ```bash
   /opt/armouredsouls/scripts/restore.sh /path/to/backup.sql.gz
   ```

2. **Revert code deployment**:
   ```bash
   git checkout <previous-commit>
   pm2 restart armouredsouls-backend
   ```

## Verification Queries

### Check migration status
```sql
-- Count users by onboarding status
SELECT 
  has_completed_onboarding,
  onboarding_skipped,
  COUNT(*) as user_count
FROM users
GROUP BY has_completed_onboarding, onboarding_skipped;
```

### Check new users (registered after migration)
```sql
-- Find users who started onboarding
SELECT 
  id,
  username,
  onboarding_step,
  onboarding_strategy,
  has_completed_onboarding,
  onboarding_started_at
FROM users
WHERE onboarding_started_at IS NOT NULL
ORDER BY onboarding_started_at DESC
LIMIT 10;
```

### Check reset logs
```sql
-- View recent account resets
SELECT 
  rl.*,
  u.username
FROM reset_logs rl
JOIN users u ON rl.user_id = u.id
ORDER BY reset_at DESC
LIMIT 10;
```

## Impact Assessment

### Performance Impact
- **Minimal**: Added 7 columns to User table (< 1KB per user)
- **Indexes**: 2 new indexes on reset_logs table (minimal impact)
- **Query Performance**: No impact on existing queries

### User Impact
- **Existing users**: No impact - marked as completed automatically
- **New users**: Will see onboarding tutorial on first login
- **Skipped users**: Can replay tutorial from settings

### Breaking Changes
- **None**: This is a non-breaking change
- All new columns have default values
- Existing API endpoints continue to work

## Testing

### Manual Testing Checklist

- [ ] Existing user can log in without seeing tutorial
- [ ] New user sees onboarding tutorial after registration
- [ ] User can skip tutorial and it's recorded correctly
- [ ] User can complete tutorial and it's recorded correctly
- [ ] Reset account functionality works correctly
- [ ] Reset logs are created when account is reset

### Automated Tests

Run test suite to verify no regressions:
```bash
cd prototype/backend
npm test
```

## Related Documentation

- **Feature Spec**: `.kiro/specs/new-player-onboarding/`
- **Design Document**: `.kiro/specs/new-player-onboarding/design.md`
- **Requirements**: `.kiro/specs/new-player-onboarding/requirements.md`
- **Database Schema**: `docs/prd_core/DATABASE_SCHEMA.md` (to be updated)

## Notes

- This migration is **required** before deploying the onboarding feature
- The data migration script is **idempotent** - safe to run multiple times
- Existing users will NOT see the tutorial (marked as completed)
- New users (registered after deployment) will see the tutorial automatically
- Users can reset their account and replay the tutorial if desired

## Support

If issues arise during migration:
1. Check migration logs for errors
2. Verify database backup exists
3. Contact development team
4. Do NOT proceed with production deployment if ACC migration fails
