# Design Document: Service-Layer Type Safety

## Overview

Replace all 140 `eslint-disable @typescript-eslint/no-explicit-any` suppressions across 23 backend service and utility files with proper types. This is a compile-time-only change — no runtime behavior changes.

### Key Research Findings

- The `any` usage falls into 4 patterns:
  1. **JSON payload casts** (60%): Prisma `Json` fields (`CycleSnapshot.stableMetrics`, `AuditLog.payload`, `Battle.battleLog`) cast to `any` for property access. Fix: define explicit interfaces matching the JSON structure.
  2. **Prisma query result typing** (20%): Functions accepting query results as `any` instead of using `Prisma.{Model}GetPayload`. Fix: use Prisma payload types with explicit includes.
  3. **Dynamic objects** (15%): `Record<string, any>` for flexible data structures. Fix: use `Record<string, unknown>` with type narrowing, or define specific interfaces.
  4. **Callback parameters** (5%): `(event: any)` in forEach/map callbacks. Fix: type the array being iterated, and the callback parameter follows.

- `cycleSnapshotService.ts` (33 suppressions) is the worst offender because it serializes/deserializes complex nested objects to/from Prisma `Json` fields. The fix requires defining `StableMetric`, `RobotMetric`, and `StepDuration` interfaces.

- Many of these interfaces already exist in fragments — `user.ts` route file defined `StableMetric` and `RobotMetric` in spec 17, and `stableAnalyticsService.ts` has its own copy. These should be consolidated into a shared types file.

## Architecture

### Shared Type Definitions

Create `app/backend/src/types/` directory for cross-service type definitions:

```
app/backend/src/types/
├── snapshotTypes.ts     # StableMetric, RobotMetric, StepDuration, EventPayload
├── battleLogTypes.ts    # BattleLogData, CombatEventLog, TagTeamBattleLog
└── index.ts             # Barrel export
```

These types describe the JSON structures stored in Prisma `Json` fields. They are NOT Prisma-generated — they're hand-written to match the runtime data shapes.

### Type Strategy by Pattern

**Pattern 1: JSON payload casts**
```typescript
// Before
const metrics = snapshot.stableMetrics as any[];
metrics.forEach((m: any) => m.userId === userId);

// After
import { StableMetric } from '../../types/snapshotTypes';
const metrics = snapshot.stableMetrics as StableMetric[];
metrics.forEach((m) => m.userId === userId);
```

**Pattern 2: Prisma query results**
```typescript
// Before
async function formatBattleHistoryEntry(battle: any, ...) { ... }

// After
type BattleWithRelations = Prisma.BattleGetPayload<{
  include: { participants: true; robot1: true; robot2: true }
}>;
async function formatBattleHistoryEntry(battle: BattleWithRelations, ...) { ... }
```

**Pattern 3: Dynamic objects**
```typescript
// Before
const whereClause: Record<string, any> = {};

// After
const whereClause: Prisma.BattleWhereInput = {};
```

**Pattern 4: Callback parameters**
```typescript
// Before
battleCompleteEvents.forEach((event: any) => { ... });

// After
// Type the array, callback parameter inferred
const events: AuditLogWithPayload[] = battleCompleteEvents;
events.forEach((event) => { ... });
```

## Components and Interfaces

### snapshotTypes.ts

```typescript
export interface StableMetric {
  userId: number;
  battlesParticipated: number;
  totalCreditsEarned: number;
  totalPrestigeEarned: number;
  totalFameEarned: number;
  operatingCosts: number;
  repairCosts: number;
  weaponPurchases: number;
  facilityPurchases: number;
  robotPurchases: number;
  attributeUpgrades: number;
}

export interface RobotMetric {
  robotId: number;
  name: string;
  wins: number;
  losses: number;
  draws: number;
  eloChange: number;
  damageDealt: number;
  damageTaken: number;
  creditsEarned: number;
  fameEarned: number;
}

export interface StepDuration {
  step: string;
  durationMs: number;
}

export interface CycleEventPayload {
  triggerType?: string;
  cycleNumber?: number;
  [key: string]: unknown;
}
```

### battleLogTypes.ts

```typescript
export interface BattleLogData {
  events?: CombatEventLog[];
  startingPositions?: Record<string, { x: number; y: number }>;
  endingPositions?: Record<string, { x: number; y: number }>;
  tagTeam?: TagTeamBattleLogData;
  [key: string]: unknown;
}

export interface CombatEventLog {
  type: string;
  timestamp: number;
  positions?: Record<string, { x: number; y: number }>;
  [key: string]: unknown;
}
```

## Data Models

No data model changes. Types are derived from existing runtime data shapes.

## Documentation Impact

- `.kiro/steering/coding-standards.md` — Add guidance on typing Prisma `Json` fields: "Define explicit interfaces in `src/types/` for all JSON payload structures. Never cast `Json` fields to `any` — cast to the specific interface."
- `.kiro/steering/database-best-practices.md` — Add a "JSON Field Typing" section explaining how to define interfaces for `Json` columns and the `as unknown as TypedInterface[]` cast pattern.
- `docs/guides/MODULE_STRUCTURE.md` — Update the backend directory tree to include `src/types/` (snapshotTypes, battleLogTypes) alongside the existing `src/services/`, `src/routes/`, etc.
- `.kiro/steering/common-tasks.md` — Already references `app/backend/src/types/` — verify it's accurate after the new files are created.

## Testing Strategy

### Approach
- This is a compile-time-only change. No new tests needed.
- All existing tests must pass unchanged.
- TypeScript compilation (`npx tsc --noEmit`) must succeed with zero errors.

### Verification
- Run `npx tsc --noEmit` after each file group.
- Run full backend test suite after each task group.
- Grep for remaining suppressions after each task group.
