# Battle to Event Log Migration

This directory contains scripts for migrating existing Battle table data to the new event sourcing architecture.

## Overview

The migration converts Battle table rows into `battle_complete` events in the AuditLog table. This is a one-time migration required for the Cycle-Based Audit Logging and Analytics System.

## Scripts

### `migrateBattlesToEvents.ts`

Main migration script that converts Battle records to audit log events.

**Features:**
- Batch processing for large datasets
- Automatic cycle number estimation based on battle timestamps
- Duplicate detection (skips already migrated battles)
- Dry run mode for testing
- Comprehensive error handling
- Data integrity verification

**Usage:**

```bash
# Run migration (live mode)
npx ts-node src/scripts/migrateBattlesToEvents.ts

# Dry run (no changes to database)
npx ts-node src/scripts/migrateBattlesToEvents.ts --dry-run

# Verbose output
npx ts-node src/scripts/migrateBattlesToEvents.ts --verbose

# Verify migration integrity only
npx ts-node src/scripts/migrateBattlesToEvents.ts --verify
```

**Options:**
- `--dry-run`: Preview migration without making changes
- `--verbose`: Show detailed progress for each battle
- `--verify`: Run integrity checks only (no migration)

### `verifyMigration.ts`

Simple verification script to check migrated data.

**Usage:**

```bash
npx ts-node src/scripts/verifyMigration.ts
```

Shows sample migrated events and verifies counts match.

## Migration Process

1. **Backup your database** (recommended)
   ```bash
   pg_dump your_database > backup.sql
   ```

2. **Run dry run** to preview changes
   ```bash
   npx ts-node src/scripts/migrateBattlesToEvents.ts --dry-run
   ```

3. **Run actual migration**
   ```bash
   npx ts-node src/scripts/migrateBattlesToEvents.ts --verbose
   ```

4. **Verify results**
   ```bash
   npx ts-node src/scripts/verifyMigration.ts
   ```

## What Gets Migrated

Each Battle record is converted to a `battle_complete` event with the following data:

- Battle identification (battleId, robot IDs, winner)
- ELO tracking (before/after values for both robots)
- Damage statistics (dealt/received, final HP/shield)
- Rewards (credits, prestige, fame)
- Repair costs
- Battle details (type, league, duration, yield/destruction flags)
- Tag team data (if applicable)
- Tournament data (if applicable)

## Cycle Number Assignment

Since historical battles don't have explicit cycle numbers, the script estimates them by:
1. Grouping battles by creation date
2. Assigning sequential cycle numbers starting from 1
3. All battles on the same date get the same cycle number

## Data Integrity Checks

The migration includes automatic verification:
- ✓ Battle count matches event count
- ✓ All battles have corresponding events
- ✓ No duplicate events
- ✓ Unique sequence numbers per cycle
- ✓ Timestamps preserved from original battles

## Idempotency

The migration is **idempotent** - you can run it multiple times safely:
- Already migrated battles are automatically skipped
- No duplicate events are created
- Sequence numbers are properly managed

## Error Handling

If errors occur during migration:
- Individual battle errors are logged but don't stop the process
- Error summary is displayed at the end
- Failed battles can be retried by running the script again

## Testing

Run the test suite to verify migration logic:

```bash
npm test -- migrateBattlesToEvents.test.ts
```

Tests cover:
- Empty database handling
- Data preservation
- Duplicate detection
- Sequence number uniqueness
- Timestamp preservation
- Dry run mode
- Integrity verification
- Tag team and tournament battles

## Troubleshooting

### "Mismatch: X battles but Y events"

Some battles failed to migrate. Check the error log and re-run the migration.

### "Battle X has no corresponding event"

A specific battle failed to migrate. Check database logs for errors related to that battle ID.

### "Battle X has N duplicate events"

Multiple events exist for the same battle. This shouldn't happen with the migration script. Contact support.

## Requirements

- Node.js 18+
- TypeScript
- Prisma Client
- PostgreSQL database with AuditLog table

## Related Files

- `src/services/eventLogger.ts` - Event logging service
- `prisma/schema.prisma` - Database schema (AuditLog table)
- `tests/migrateBattlesToEvents.test.ts` - Migration tests

## Support

For issues or questions, refer to:
- Design document: `.kiro/specs/cycle-audit-logging-system/design.md`
- Requirements: `.kiro/specs/cycle-audit-logging-system/requirements.md`
- Task list: `.kiro/specs/cycle-audit-logging-system/tasks.md`
