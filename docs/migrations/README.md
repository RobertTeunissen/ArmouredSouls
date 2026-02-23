# Migration Documentation

This folder contains documentation related to database schema migrations and data structure changes.

## Contents

### Battle Table Migration
- **BATTLE_TABLE_MIGRATION_STATUS.md** - Status tracking for migrating from denormalized Battle table to BattleParticipant table
- **BATTLEPARTICIPANT_MIGRATION_COMPLETE.md** - Completion notes for BattleParticipant migration
- **BATTLE_TABLE_CLEANUP_COMPLETE.md** - Final cleanup after removing redundant Battle table columns

## Related PRDs

For architectural decisions and system design, see:
- [PRD_BATTLE_DATA_ARCHITECTURE.md](../prd_core/PRD_BATTLE_DATA_ARCHITECTURE.md) - Complete BattleParticipant architecture documentation

## Purpose

These documents provide historical context for major schema changes and serve as reference for:
- Understanding migration strategies used
- Troubleshooting migration-related issues
- Learning from past migration approaches
- Documenting lessons learned

## Note

These are historical documents. For current schema documentation, always refer to:
- `docs/prd_core/DATABASE_SCHEMA.md` - Current database schema
- `prototype/backend/prisma/schema.prisma` - Prisma schema definition
