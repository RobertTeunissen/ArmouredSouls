# Design Document: Type Safety — `any` Elimination in Route Handlers

## Overview

Replace all `any` type annotations in `robots.ts`, `admin.ts`, and `user.ts` with Prisma-generated types and explicit interfaces. This is a compile-time-only change — no runtime behavior changes.

### Key Research Findings

- Prisma 7 generates types in `generated/prisma/` including model types and `Prisma.{Model}GetPayload<{include}>` utility types for queries with includes.
- `robots.ts` has 15+ `any` usages: `sanitizeRobotForPublic(robot: any): any`, battle participant finders `(p: any)`, Decimal `.toNumber()` casts `(value as any).toNumber()`.
- `admin.ts` has 5+ `any` usages: `mapBattleRecord(battle: any, ...)`, `mapTagTeamRecord(match: any)`, participant finders.
- `user.ts` has 10+ `any` usages: cycle snapshot metrics cast to `any[]`, reduce callbacks `(m: any)`.
- The Prisma schema defines `Decimal` fields for robot attributes — these need `Prisma.Decimal` type instead of `any` for `.toNumber()` calls.

## Architecture

### Type Strategy

1. **Prisma model types**: Use `import { Robot, Battle, BattleParticipant, User } from '../../generated/prisma'` for simple model references.
2. **Query result types with includes**: Use `Prisma.BattleGetPayload<{ include: { participants: true, robot1: true, robot2: true } }>` for queries that include relations.
3. **Explicit interfaces**: For complex shapes not directly matching a Prisma model (e.g., sanitized robot output, mapped battle record), define explicit interfaces in the service or route file.
4. **Decimal handling**: Use `import { Decimal } from '../../generated/prisma/runtime/library'` or cast via `Number()` instead of `(value as any).toNumber()`.

### Type Definitions

```typescript
// For sanitizeRobotForPublic
type RobotWithRelations = Prisma.RobotGetPayload<{ include: { mainWeapon: true; offhandWeapon: true } }>;
type PublicRobot = Omit<RobotWithRelations, 'internalField1' | 'internalField2'>;

// For cycle snapshot metrics in user.ts
interface StableMetric {
  userId: number;
  credits: number;
  totalFame: number;
  // ... other fields from the snapshot JSON
}

interface RobotMetric {
  robotId: number;
  wins: number;
  losses: number;
  eloChange: number;
  // ... other fields
}
```

## Components and Interfaces

### robots.ts Changes

| Current | Replacement |
|---------|-------------|
| `sanitizeRobotForPublic(robot: any): any` | `sanitizeRobotForPublic(robot: RobotWithRelations): PublicRobot` |
| `(p: any) => p.robotId === robotId` | `(p: BattleParticipant) => p.robotId === robotId` |
| `(robotCurrentLevelValue as any).toNumber()` | `Number(robotCurrentLevelValue)` |
| `getBattleResult = (battle: any)` | `getBattleResult = (battle: BattleWithParticipants)` |
| `getBattleStats = (battle: any)` | `getBattleStats = (battle: BattleWithParticipants)` |

### admin.ts Changes

| Current | Replacement |
|---------|-------------|
| `mapBattleRecord(battle: any, ...)` | `mapBattleRecord(battle: BattleWithDetails, ...)` |
| `mapTagTeamRecord(match: any)` | `mapTagTeamRecord(match: TagTeamMatchWithBattle)` |
| `(p: any) => p.robotId === battle.robot1Id` | `(p: BattleParticipant) => p.robotId === battle.robot1Id` |

### user.ts Changes

| Current | Replacement |
|---------|-------------|
| `(currentSnapshot.stableMetrics as any[])` | `(currentSnapshot.stableMetrics as StableMetric[])` |
| `(m: any) => m.userId === userId` | `(m: StableMetric) => m.userId === userId` |
| `(m: any) => sum + (m.wins \|\| 0)` | `(m: RobotMetric) => sum + (m.wins \|\| 0)` |

## Data Models

No data model changes. Types are derived from existing Prisma schema.

## Documentation Impact

- `.kiro/steering/coding-standards.md` — The "Type Safety" section already says "avoid `any` unless absolutely necessary." Add a note about using `Prisma.{Model}GetPayload` for typed query results and `Number()` for Decimal conversion.

## Testing Strategy

### Approach
- This is a compile-time-only change. No new tests needed.
- All existing tests must pass unchanged.
- TypeScript compilation (`npx tsc --noEmit`) must succeed with zero errors.

### Verification
- Run `npx tsc --noEmit` to confirm type correctness.
- Run full backend test suite to confirm no runtime regressions.
- Grep for remaining `any` and `eslint-disable` comments.
