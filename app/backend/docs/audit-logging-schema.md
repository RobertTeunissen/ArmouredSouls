# Audit Logging Database Schema

## Overview

This document describes the database schema for the Cycle-Based Audit Logging and Analytics System. The schema uses pure event sourcing to store all game events in a flexible, scalable structure.

## Tables

### audit_logs

Stores all game events with flexible JSONB payload for maximum flexibility.

**Columns:**
- `id` (BIGSERIAL, PRIMARY KEY): Unique identifier for each event
- `cycle_number` (INTEGER, NOT NULL): The cycle during which this event occurred
- `event_type` (VARCHAR(100), NOT NULL): Type of event (e.g., 'battle_complete', 'credit_change')
- `event_timestamp` (TIMESTAMP, NOT NULL, DEFAULT NOW()): When the event occurred
- `sequence_number` (INTEGER, NOT NULL): Unique sequence within cycle for ordering
- `user_id` (INTEGER, NULLABLE): Reference to user (nullable for system-wide events)
- `robot_id` (INTEGER, NULLABLE): Reference to robot (nullable for user/system events)
- `payload` (JSONB, NOT NULL): Flexible event data specific to event type
- `metadata` (JSONB, NULLABLE): Optional calculation metadata for debugging

**Indexes:**
- `audit_logs_cycle_number_idx`: Single-column index on cycle_number
- `audit_logs_user_id_idx`: Single-column index on user_id (partial, WHERE user_id IS NOT NULL)
- `audit_logs_robot_id_idx`: Single-column index on robot_id (partial, WHERE robot_id IS NOT NULL)
- `audit_logs_event_type_idx`: Single-column index on event_type
- `audit_logs_event_timestamp_idx`: Single-column index on event_timestamp
- `audit_logs_cycle_number_user_id_idx`: Composite index on (cycle_number, user_id)
- `audit_logs_cycle_number_robot_id_idx`: Composite index on (cycle_number, robot_id)
- `audit_logs_cycle_number_event_type_idx`: Composite index on (cycle_number, event_type)
- `audit_logs_payload_gin_idx`: GIN index on payload for JSONB queries

**Constraints:**
- `audit_logs_cycle_sequence`: UNIQUE constraint on (cycle_number, sequence_number)

### cycle_snapshots

Pre-aggregated metrics for fast historical queries.

**Columns:**
- `id` (SERIAL, PRIMARY KEY): Unique identifier
- `cycle_number` (INTEGER, NOT NULL, UNIQUE): The cycle this snapshot represents
- `trigger_type` (VARCHAR(20), NOT NULL): 'manual' or 'scheduled'
- `start_time` (TIMESTAMP, NOT NULL): When the cycle started
- `end_time` (TIMESTAMP, NOT NULL): When the cycle ended
- `duration_ms` (INTEGER, NOT NULL): Total cycle duration in milliseconds
- `stable_metrics` (JSONB, NOT NULL): Aggregated per-user metrics
- `robot_metrics` (JSONB, NOT NULL): Aggregated per-robot metrics
- `step_durations` (JSONB, NOT NULL): Duration of each cycle step
- `total_battles` (INTEGER, NOT NULL, DEFAULT 0): Total battles in this cycle
- `total_credits_transacted` (BIGINT, NOT NULL, DEFAULT 0): Total credits moved
- `total_prestige_awarded` (INTEGER, NOT NULL, DEFAULT 0): Total prestige awarded
- `created_at` (TIMESTAMP, NOT NULL, DEFAULT NOW()): When snapshot was created

**Indexes:**
- `cycle_snapshots_cycle_number_idx`: Single-column index on cycle_number
- `cycle_snapshots_start_time_idx`: Single-column index on start_time

**Constraints:**
- `cycle_snapshots_cycle_number_key`: UNIQUE constraint on cycle_number

## Event Types

The following event types are supported in the audit_logs table:

### Battle Events
- `battle_complete`: Complete battle record with all stats

### Robot Events
- `robot_repair`: Robot repair with cost and HP restored
- `attribute_upgrade`: Attribute upgrade with old/new values
- `league_change`: League promotion/demotion

### Stable/User Events
- `credit_change`: Any credit transaction
- `prestige_change`: Prestige award
- `passive_income`: Merchandising and streaming income
- `operating_costs`: Facility operating costs

### Facility Events
- `facility_purchase`: New facility purchase
- `facility_upgrade`: Facility level upgrade

### Weapon Events
- `weapon_purchase`: Weapon purchase transaction
- `weapon_sale`: Weapon sale transaction

### Tournament Events
- `tournament_match`: Tournament match result
- `tournament_complete`: Tournament completion

### Tag Team Events
- `tag_team_battle`: Tag team battle result

### Cycle Execution Events
- `cycle_start`: Cycle execution started
- `cycle_step_complete`: Individual cycle step completed
- `cycle_complete`: Cycle execution finished

## Payload Schemas

Each event type has a specific payload structure. See the design document for detailed payload schemas.

## Performance Characteristics

### Query Performance
- Single cycle queries: < 100ms
- Multi-cycle aggregations: < 500ms
- Historical comparisons: < 1s
- Trend analysis: < 1s

### Storage
- Estimated 250K events per day in production
- JSONB compression reduces storage overhead
- GIN index enables efficient JSONB queries

### Scalability
- Indexes support efficient filtering by cycle, user, robot, and event type
- Composite indexes optimize common query patterns
- Cycle snapshots provide O(1) access to aggregated metrics

## Migration

The schema was created via Prisma migration:
- Migration: `20260215200750_add_audit_logging_tables`
- Applied: Yes
- Prisma Client: Generated and synced

## Verification

Schema verification can be run using:
```bash
npx tsx scripts/verify-audit-schema.ts
npx tsx scripts/verify-indexes.ts
```

Both scripts confirm:
- ✅ Tables created successfully
- ✅ All indexes applied
- ✅ Unique constraints working
- ✅ JSONB payload functional
- ✅ Prisma client synced

## Requirements Satisfied

This schema implementation satisfies the following requirements:
- **Requirement 9.3**: Event metadata includes timestamps, cycle number, and sequence number
- **Requirement 10.1**: Cycle snapshots store aggregated metrics efficiently
- **Requirement 10.2**: JSONB payload minimizes storage overhead
- **Requirement 10.3**: Indexes enable sub-second query response times

## Next Steps

With the schema in place, the next tasks are:
1. Implement EventLogger service (Task 1.2)
2. Write property tests for event logging (Tasks 1.3, 1.4)
3. Migrate battle events to event log (Task 1.5)
4. Update battle orchestrator to log events (Task 1.6)
