# Implementation Plan: Type Safety — `any` Elimination in Route Handlers

## Overview

Replace all `any` type annotations in the three route files with proper types. Each task group handles one file, followed by verification.

## Tasks

- [x] 1. Type robots.ts
  - [x] 1.1 Define typed interfaces for battle query results (`BattleWithParticipants`) and robot query results (`RobotWithRelations`) using `Prisma.{Model}GetPayload` types at the top of `robots.ts` (or in a shared types file)
  - [x] 1.2 Replace `sanitizeRobotForPublic(robot: any): any` with typed signature using `RobotWithRelations` input and explicit return type
  - [x] 1.3 Replace all `(p: any)` participant finder lambdas with `(p: BattleParticipant)` typed lambdas
  - [x] 1.4 Replace `(value as any).toNumber()` Decimal casts with `Number(value)` using Prisma's Decimal type
  - [x] 1.5 Replace `getBattleResult = (battle: any)` and `getBattleStats = (battle: any)` with typed signatures
  - [x] 1.6 Replace `calculateCategorySum = (robot: any, ...)` and `calculateRanking = (value: number, ...)` with typed signatures
  - [x] 1.7 Remove all `eslint-disable-next-line @typescript-eslint/no-explicit-any` comments from `robots.ts`
  - [x] 1.8 Run `npx tsc --noEmit` and full backend test suite to verify
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 4.1, 4.2_

- [x] 2. Type admin.ts
  - [x] 2.1 Define typed interfaces for admin battle query results (`BattleWithDetails`, `TagTeamMatchWithBattle`) using Prisma payload types
  - [x] 2.2 Replace `mapBattleRecord(battle: any, ...)` and `mapTagTeamRecord(match: any)` with typed signatures
  - [x] 2.3 Replace all `(p: any)` participant finder lambdas with typed lambdas
  - [x] 2.4 Remove all `eslint-disable-next-line @typescript-eslint/no-explicit-any` comments from `admin.ts`
  - [x] 2.5 Run `npx tsc --noEmit` and full backend test suite to verify
  - _Requirements: 2.1, 2.2, 2.3, 4.1, 4.2_

- [x] 3. Type user.ts
  - [x] 3.1 Define `StableMetric` and `RobotMetric` interfaces matching the JSON structure stored in cycle snapshots
  - [x] 3.2 Replace all `as any[]` casts on snapshot metrics with typed casts using the new interfaces
  - [x] 3.3 Replace all `(m: any)` callbacks with typed callbacks using `StableMetric` or `RobotMetric`
  - [x] 3.4 Remove all `eslint-disable-next-line @typescript-eslint/no-explicit-any` comments from `user.ts`
  - [x] 3.5 Run `npx tsc --noEmit` and full backend test suite to verify
  - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2_

- [x] 4. Documentation and verification
  - [x] 4.1 Update `.kiro/steering/coding-standards.md` Type Safety section to add guidance on using `Prisma.{Model}GetPayload` for typed query results and `Number()` for Decimal conversion
  - [x] 4.2 Run verification criteria: confirm zero `eslint-disable.*no-explicit-any` and zero `: any` in all three route files, confirm `npx tsc --noEmit` succeeds, confirm all backend tests pass
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 4.1, 4.2_
