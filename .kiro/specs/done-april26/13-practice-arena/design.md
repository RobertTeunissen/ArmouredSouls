# Design Document: Practice Arena

## Overview

The Practice Arena is a standalone 1v1 sandbox battle simulator that lets players run consequence-free battles between their own robots or against configurable AI sparring partners. It reuses the existing `simulateBattle` combat engine and `convertBattleEvents`/`convertSimulatorEvents` narrative pipeline with zero modifications — the new code is a thin service layer that builds virtual robot objects, calls the simulator, and returns results without touching the database.

The feature consists of four layers:
1. A backend service (`services/practice-arena/`) that constructs in-memory robot data and invokes the combat engine
2. An API route that validates input, enforces rate limiting, and tracks in-memory metrics
3. A frontend page with robot selection, sparring partner configuration, what-if overrides, and battle report display
4. An admin metrics integration that exposes usage counters via the admin portal

### Design Decisions

1. **No database writes** — Practice battles are entirely stateless on the server. The service constructs `RobotWithWeapons` objects in memory from either persisted robot data (cloned, not referenced) or sparring partner definitions. No Battle, BattleParticipant, or robot update records are created. No migrations needed.

2. **Reuse `simulateBattle` directly** — The existing 1v1 wrapper around `simulateBattleMulti` accepts two `RobotWithWeapons` objects and returns a `CombatResult`. We pass it cloned data with `allowDraws: true` (same as league 1v1) and return the result. Zero changes to combat logic.

3. **Architectural independence** — The Practice Arena is NOT an orchestrator. It does not use `BattleStrategy`/`BattleProcessor`, is not invoked by `cycleScheduler.ts`, does not import `battlePostCombat.ts`, and has no dependency on `ScheduledMatch` tables. It is a synchronous request/response service. The only imports from the `battle/` domain are `simulateBattle` from `combatSimulator.ts` and `convertBattleEvents`/`convertSimulatorEvents` from `combatMessageGenerator.ts`.

4. **Sparring partners use existing tier configs + auto-weapon-selection** — WimpBot (attr 1, Budget ₡0–₡99,999), AverageBot (attr 5, Standard ₡100K–₡250K), and ExpertBot (attr 10, Premium ₡250K–₡400K) reuse the existing `tierConfig.ts` definitions exactly. LuxuryBot (attr 15, Luxury ₡400K+) is a new tier for practice arena only. Players select bot tier, loadout type, range band, stance, and yield threshold — weapons are auto-selected via the existing `selectWeapon()`/`selectShield()` from `weaponSelection.ts`. No free-form attribute editing, no default loadout presets (Tank, Glass Cannon, etc.).

5. **localStorage for result history** — Practice battle results are stored in the browser's `localStorage` keyed per player, not in-memory React state. Results survive page navigation and refreshes. Last 10 results retained.

6. **BattlePlaybackViewer for results** — The existing `BattlePlaybackViewer` component accepts `PlaybackCombatResult` and `PlaybackRobotInfo`. We map the practice battle result to this shape and render it inline with distinct "PRACTICE MATCH" visual styling.

7. **In-memory admin metrics with daily DB persistence** — Simple counters (total battles, battles today, rate limit hits today, unique players today) tracked in a singleton module. At settlement time (23:00 UTC), counters are flushed to a `practice_arena_daily_stats` table (one INSERT per day) and daily values are reset. The `totalBattlesSinceStart` counter persists in memory until server restart. Historical data is queryable from the DB for trend analysis.

8. **Rate limiting at 30 battles per 15 minutes** — Practice battles are CPU-intensive (tick-based simulation). A per-user rate limiter prevents abuse. Rate limit violations tracked by `securityMonitor` and counted in admin metrics.

9. **Cycle execution guard** — The Practice Arena checks `getSchedulerState().runningJob` before executing any battle. If a cycle job (league, tournament, tag team, KotH, settlement) is currently running, the API returns 503 Service Unavailable. This prevents CPU contention with the real battle pipeline, which is already stressed during KotH execution. The frontend shows a clear "unavailable" message and auto-retries when the cycle completes.

## Architecture

```
Frontend                              Backend
┌─────────────────────────┐          ┌──────────────────────────────────────┐
│ PracticeArenaPage        │          │                                      │
│                          │  POST    │ POST /api/practice-arena/battle      │
│ ┌──────────────────────┐ │ ──────►  │ ┌──────────────────────────────────┐ │
│ │ Robot Selector        │ │         │ │ practiceArenaService.ts           │ │
│ │ (own robot + what-if  │ │         │ │                                  │ │
│ │  OR sparring partner) │ │         │ │ 1. Validate input (Zod)          │ │
│ └──────────────────────┘ │         │ │ 2. Build RobotWithWeapons        │ │
│ ┌──────────────────────┐ │         │ │    (clone owned OR construct     │ │
│ │ Sparring Config       │ │         │ │     sparring partner w/ auto-    │ │
│ │ (tier, loadout, range │ │         │ │     selected weapons)            │ │
│ │  band, stance, yield) │ │         │ │ 3. simulateBattle(r1, r2)       │ │
│ └──────────────────────┘ │         │ │ 4. convertBattleEvents(...)      │ │
│ ┌──────────────────────┐ │ ◄────── │ │ 5. Return PracticeBattleResult   │ │
│ │ BattlePlaybackViewer  │ │  JSON   │ └──────────────────────────────────┘ │
│ │ (reused, "PRACTICE    │ │         │                                      │
│ │  MATCH" styling)      │ │         │ GET /api/practice-arena/             │
│ └──────────────────────┘ │         │     sparring-partners                │
│ ┌──────────────────────┐ │         │     (4 bot type definitions)         │
│ │ localStorage History  │ │         │                                      │
│ │ (last 10 results,    │ │         │ practiceArenaMetrics.ts (in-memory)  │
│ │  keyed per player)   │ │         │   ├─ totalBattles, battlesToday     │
│ └──────────────────────┘ │         │   ├─ rateLimitHitsToday             │
└─────────────────────────┘          │   └─ uniquePlayersToday             │
                                     │                                      │
Admin Portal                         │ GET /api/admin/practice-arena/stats  │
┌─────────────────────────┐          │     (admin-only, reads counters)     │
│ DashboardTab             │          │                                      │
│ ┌──────────────────────┐ │          └──────────────────────────────────────┘
│ │ Practice Arena section│ │
│ │ (battles today,      │ │
│ │  unique players,     │ │
│ │  rate limit hits,    │ │
│ │  total since start)  │ │
│ └──────────────────────┘ │
└─────────────────────────┘
```

No arrows touch the database for writes. The service reads robot data and weapon data, clones it, and passes it to the simulator.

### Dependency Boundary

```
services/practice-arena/
  ├── practiceArenaService.ts
  │     IMPORTS FROM battle/:
  │       - simulateBattle from combatSimulator.ts
  │       - CombatMessageGenerator.convertBattleEvents from combatMessageGenerator.ts
  │       - CombatMessageGenerator.convertSimulatorEvents from combatMessageGenerator.ts
  │     IMPORTS FROM utils/:
  │       - selectWeapon, selectShield from weaponSelection.ts
  │       - TIER_CONFIGS from tierConfig.ts
  │       - calculateMaxHP, calculateMaxShield from robotCalculations.ts
  │     DOES NOT IMPORT:
  │       - battlePostCombat.ts (no post-combat pipeline)
  │       - battleStrategy.ts (no BattleStrategy/BattleProcessor)
  │       - cycleScheduler.ts (no cron triggers)
  │       - baseOrchestrator.ts (no orchestrator base)
  │       - Any ScheduledMatch model
  │
  └── practiceArenaMetrics.ts
        Pure in-memory counters, no DB dependency
```

## Components and Interfaces

### 1. Practice Arena Service (`src/services/practice-arena/practiceArenaService.ts`)

_Addresses: Requirements 1, 2, 5, 6, 7, 12_

Stateless service that builds robot objects and runs the combat engine.

```typescript
import { simulateBattle, RobotWithWeapons, CombatResult } from '../battle/combatSimulator';
import { CombatMessageGenerator } from '../battle/combatMessageGenerator';
import { selectWeapon, selectShield, WeaponSelectionParams } from '../../utils/weaponSelection';
import { TIER_CONFIGS } from '../../utils/tierConfig';
import prisma from '../../lib/prisma';

/** Sparring partner bot tier — player selects one of these */
type BotTier = 'WimpBot' | 'AverageBot' | 'ExpertBot' | 'LuxuryBot';

/** Sparring partner configuration from the API request */
interface SparringPartnerConfig {
  botTier: BotTier;
  loadoutType: 'single' | 'weapon_shield' | 'two_handed' | 'dual_wield';
  rangeBand: 'melee' | 'short' | 'mid' | 'long';
  stance: 'offensive' | 'defensive' | 'balanced';
  yieldThreshold: number;  // 0-50
}

/** What-If overrides for an owned robot */
interface WhatIfOverrides {
  attributes?: Partial<Record<string, number>>;  // any of 23 attributes, each 1-50
  loadoutType?: 'single' | 'weapon_shield' | 'two_handed' | 'dual_wield';
  stance?: 'offensive' | 'defensive' | 'balanced';
  yieldThreshold?: number;
  mainWeaponId?: number;
  offhandWeaponId?: number;
}

/** A battle slot is either an owned robot ID or a sparring partner config */
type BattleSlot =
  | { type: 'owned'; robotId: number; overrides?: WhatIfOverrides }
  | { type: 'sparring'; config: SparringPartnerConfig };

/** Practice battle request */
interface PracticeBattleRequest {
  robot1: BattleSlot;
  robot2: BattleSlot;
}

/** Practice battle result returned to the frontend */
interface PracticeBattleResult {
  combatResult: CombatResult;
  battleLog: any[];  // narrative events from convertBattleEvents
  robot1Info: { name: string; maxHP: number; maxShield: number };
  robot2Info: { name: string; maxHP: number; maxShield: number };
}

/** Batch result returned when count > 1 */
interface PracticeBatchResult {
  results: PracticeBattleResult[];
  aggregate: {
    totalBattles: number;
    robot1Wins: number;
    robot2Wins: number;
    draws: number;
    avgDurationSeconds: number;
    avgRobot1DamageDealt: number;
    avgRobot2DamageDealt: number;
  };
}
```

Key functions:

- `executePracticeBattle(userId: number, request: PracticeBattleRequest): Promise<PracticeBattleResult>` — Main entry point for a single battle. Builds two `RobotWithWeapons` from the request, calls `simulateBattle(r1, r2)` with default config (`allowDraws: true`), generates narrative via `CombatMessageGenerator.convertBattleEvents(...)`, returns the combined result. Increments metrics counters.
- `executePracticeBatch(userId: number, request: PracticeBattleRequest, count: number): Promise<PracticeBatchResult>` — Runs `count` battles (2-10) sequentially with the same configuration. Each iteration re-clones robot data and calls `simulateBattle` independently (fresh random seed each time). Returns all individual `PracticeBattleResult`s plus aggregate stats (win count per robot, avg damage dealt per robot, avg duration). Each battle increments the metrics counter.
- `buildOwnedRobot(userId: number, robotId: number, overrides?: WhatIfOverrides): Promise<RobotWithWeapons>` — Calls `verifyRobotOwnership(prisma, robotId, userId)` from `middleware/ownership.ts` (logs auth failures to `securityMonitor`), reads the robot from DB (with weapon includes), deep-clones the data, sets `currentHP = maxHP` and `currentShield = maxShield` (full repair, same as all real orchestrators), applies what-if overrides (attributes, loadout, stance, yieldThreshold, weapon swaps from catalog), recalculates `maxHP`/`maxShield` and re-applies full HP/shield after recalculation.
- `buildSparringPartner(config: SparringPartnerConfig, allWeapons: WeaponRecord[]): RobotWithWeapons` — Constructs a virtual robot from the config. Uses `selectWeapon(allWeapons, { loadoutType, rangeBand, priceTier })` and `selectShield(allWeapons, priceTier)` to auto-select weapons. Sets all 23 attributes to the tier's attribute level. Assigns a synthetic negative ID (-1, -2) to avoid collisions with real robots.
- `getSparringPartnerDefinitions(): SparringPartnerDefinition[]` — Returns the 4 bot type definitions with attribute levels, price tiers, and available options.

### 2. Sparring Partner Tier Definitions

_Addresses: Requirements 6.1, 6.8_

Four bot tiers. The first three reuse `tierConfig.ts` values exactly:

| Bot Tier | Attribute Level | Price Tier | Source |
|----------|----------------|------------|--------|
| WimpBot | 1 | ₡0–₡99,999 (Budget) | `TIER_CONFIGS[0]` from `tierConfig.ts` |
| AverageBot | 5 | ₡100,000–₡250,000 (Standard) | `TIER_CONFIGS[1]` from `tierConfig.ts` |
| ExpertBot | 10 | ₡250,000–₡400,000 (Premium) | `TIER_CONFIGS[2]` from `tierConfig.ts` |
| LuxuryBot | 15 | ₡400,000+ (Luxury) | New constant in `practiceArenaService.ts` only |

The LuxuryBot tier is defined as a constant within the practice arena service, NOT added to `tierConfig.ts` or `TIER_CONFIGS` array (it's practice-only, not used for auto-generation):

```typescript
const LUXURY_BOT_CONFIG = {
  name: 'LuxuryBot' as const,
  attributeLevel: 15,
  priceTier: { min: 400000, max: Infinity },
};
```

Player configures: bot tier → loadout type → range band → stance → yield threshold. Weapons are auto-selected. No free-form attribute editing. No default loadout presets.

### 3. Practice Arena Metrics (`src/services/practice-arena/practiceArenaMetrics.ts`)

_Addresses: Requirement 13_

In-memory singleton tracking usage counters:

```typescript
interface PracticeArenaStats {
  totalBattlesSinceStart: number;
  battlesToday: number;
  rateLimitHitsToday: number;
  uniquePlayersToday: Set<number>;  // player IDs
}

class PracticeArenaMetrics {
  private stats: PracticeArenaStats;

  recordBattle(userId: number): void;
  recordRateLimitHit(): void;
  getStats(): { totalBattlesSinceStart: number; battlesToday: number; rateLimitHitsToday: number; uniquePlayersToday: number };
  flushAndReset(): Promise<void>;  // persists daily counters to practice_arena_daily_stats table, then zeroes daily counters
}

export const practiceArenaMetrics = new PracticeArenaMetrics();
```

`flushAndReset()` is called by the settlement cycle at 23:00 UTC. It inserts one row into `practice_arena_daily_stats` with the current day's counters and the `playerIds` array (serialized from the `uniquePlayersToday` Set), then zeroes `battlesToday`, `rateLimitHitsToday`, and `uniquePlayersToday`. The `totalBattlesSinceStart` counter is never reset (it resets naturally on server restart).

### 4. Practice Arena Route (`src/routes/practiceArena.ts`)

_Addresses: Requirements 9, 10_

```typescript
import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/schemaValidator';
import { securityMonitor } from '../services/security/securityMonitor';
import { practiceArenaMetrics } from '../services/practice-arena/practiceArenaMetrics';
import { getSchedulerState } from '../services/cycle/cycleScheduler';

const router = express.Router();

// Middleware: block practice battles while a cycle job is running
function rejectDuringCycleExecution(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const state = getSchedulerState();
  if (state.runningJob) {
    res.status(503).json({
      error: 'Practice Arena is temporarily unavailable while battles are being processed',
      code: 'CYCLE_IN_PROGRESS',
      runningJob: state.runningJob,
    });
    return;
  }
  next();
}

// 30 battles per 15 minutes per user
const practiceRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => (req as AuthRequest).user?.userId?.toString() || req.ip || 'unknown',
  handler: (req, res) => {
    practiceArenaMetrics.recordRateLimitHit();
    securityMonitor.trackRateLimitViolation(/* ... */);
    res.status(429).json({ error: 'Rate limit exceeded', retryAfter: /* ... */ });
  },
});

// POST /api/practice-arena/battle
router.post('/battle', authenticateToken, rejectDuringCycleExecution, practiceRateLimiter, validateRequest({ body: battleSchema }), battleHandler);

// GET /api/practice-arena/sparring-partners
router.get('/sparring-partners', authenticateToken, sparringPartnersHandler);
```

Zod schemas validate:
- `robot1` and `robot2` as discriminated union on `type` field (`'owned'` or `'sparring'`)
- Owned slot: `robotId` via `positiveIntParam` from `securityValidation.ts`, optional `overrides` with explicitly named 23 attribute keys each `z.number().int().min(1).max(50)` (no arbitrary keys — schema lists `combatPower`, `targetingSystems`, etc.), optional weapon IDs via `positiveInt`, loadout/stance via `z.enum()`, yieldThreshold via `z.number().int().min(0).max(50)`
- Sparring slot: `botTier` via `z.enum(['WimpBot', 'AverageBot', 'ExpertBot', 'LuxuryBot'])`, `loadoutType` via `z.enum()`, `rangeBand` via `z.enum(['melee', 'short', 'mid', 'long'])`, `stance` via `z.enum()`, `yieldThreshold` via `z.number().int().min(0).max(50)`
- All unknown fields stripped by Zod's default `.strip()` mode (mass-assignment prevention)

### 5. Admin Metrics Endpoint (added to `src/routes/admin.ts`)

_Addresses: Requirement 13_

```typescript
// GET /api/admin/practice-arena/stats
router.get('/practice-arena/stats', authenticateToken, requireAdmin, async (req, res) => {
  const stats = practiceArenaMetrics.getStats();
  res.json(stats);
});
```

### 6. Practice Arena Frontend Page (`src/pages/PracticeArenaPage.tsx`)

_Addresses: Requirements 3, 7, 8, 11_

The Practice Arena is presented in-universe as an AI combat simulation — a virtual training facility where players run predictive battle models of their robots before committing to real arena matches. All player-facing copy uses this framing.

A single page with these sections:

**Section 1: Robot Selection (two slots)**
- Page header: "Combat Simulation Lab" or "Battle Simulator" — framed as an AI-powered training facility
- Subheading: "Run predictive combat simulations to test configurations before entering the real arena"
- Each slot has a toggle: "Deploy Robot" (own robot) or "Simulate Opponent" (sparring partner)
- "Deploy Robot" shows a dropdown of the player's robots (from existing `/api/robots` endpoint)
- "Simulate Opponent" shows bot tier buttons labeled as training dummies with in-universe names: "Scrapyard Drone" (WimpBot), "Standard Combatant" (AverageBot), "Elite Sparring Unit" (ExpertBot), "Apex Prototype" (LuxuryBot) — and configuration controls

**Section 2: Configuration Panel (per slot)**
- For owned robots: shows current stats with What-If override controls (attribute sliders 1-50, weapon dropdowns from full catalog, loadout/stance/yield selectors). Overridden values highlighted with color. Estimated upgrade cost displayed. Notice: "Simulation parameters only — your robot is not modified"
- For sparring partners: bot tier selector, loadout type selector, range band selector (melee/short/mid/long), stance selector, yield threshold slider (0-50). Weapons auto-selected — displayed as read-only after selection with label "AI-assigned loadout"

**Section 3: Battle Results**
- "Run Simulation" button (disabled until both slots are configured), with batch count selector (1-10) labeled "Simulation runs"
- Loading state: "Running combat simulation..." (with progress for batches, e.g., "Simulating battle 3 of 10...")
- Cycle unavailability: "Combat Simulation Lab is offline — real arena battles are in progress. Simulations will resume shortly."
- `BattlePlaybackViewer` renders inline with "SIMULATION" badge/styling (distinct from real battle pages)
- Battle report header: "Simulation Report" (not "Battle Report")
- Summary: winner, duration, damage dealt/received, final HP/shield
- Per-robot stats: hit rate %, crit rate %, malfunction rate %, counter rate %, avg damage per hit
- Effective attribute breakdown: base + weapon bonuses + loadout modifiers + stance modifiers
- Batch aggregate panel (when count > 1): "Simulation Analysis" showing win rate, avg damage, avg duration
- "Re-Run Simulation" button to repeat the same configuration

**Section 4: Simulation History**
- Sidebar/panel showing last 10 results from localStorage, labeled "Recent Simulations"
- Win/loss indicators and timestamps
- Comparison view for repeated matchups (win/loss count, avg damage, avg duration)
- "Clear Simulation History" button

### 7. localStorage History Hook (`src/hooks/usePracticeHistory.ts`)

_Addresses: Requirement 8_

```typescript
const STORAGE_KEY = (userId: number) => `practice-arena-history-${userId}`;
const MAX_RESULTS = 10;

function usePracticeHistory(userId: number) {
  // Reads from localStorage on mount, writes on new result
  // Returns: { results, addResult, clearHistory }
}
```

### 8. Navigation Integration

_Addresses: Requirement 11.1_

The navigation already has a "Practice Arena" entry at `/practice` in the Battle section. Update the path to `/practice-arena` if needed, or keep `/practice` — confirm with existing route. Add the route to `App.tsx` as a `ProtectedRoute`.

### 9. Admin Dashboard Integration

_Addresses: Requirement 13.3_

Add a "Practice Arena" section to `DashboardTab.tsx` that fetches from `GET /api/admin/practice-arena/stats` and displays:
- Battles today
- Unique players today
- Rate limit hits today
- Total battles since server start

## Data Models

One new database table for admin metrics persistence. No changes to any existing tables.

### `practice_arena_daily_stats` (new table)

```prisma
model PracticeArenaDailyStats {
  id            Int      @id @default(autoincrement())
  date          DateTime @unique @db.Date
  totalBattles  Int      @default(0)
  uniquePlayers Int      @default(0)
  rateLimitHits Int      @default(0)
  playerIds     Json     @default("[]")  // JSON array of integer user IDs
  createdAt     DateTime @default(now())

  @@map("practice_arena_daily_stats")
}
```

One row per day, inserted by `practiceArenaMetrics.flushAndReset()` during the settlement cycle at 23:00 UTC.

### Virtual Robot Construction

When building a `RobotWithWeapons` for the simulator, the service constructs an object matching the Prisma `Robot` model shape with weapon relations:

- **Owned robots**: Read from DB via `prisma.robot.findUnique({ include: { mainWeapon: { include: { weapon: true } }, offhandWeapon: { include: { weapon: true } } } })`, deep-clone with `structuredClone()`, apply what-if overrides, recalculate `maxHP`/`maxShield`.
- **Sparring partners**: Construct from scratch with all 23 attributes set to the tier's `attributeLevel`, weapons auto-selected via `selectWeapon()`/`selectShield()`, synthetic negative IDs (-1, -2).

### API Contracts

**POST /api/practice-arena/battle**

Request (owned vs sparring):
```json
{
  "robot1": {
    "type": "owned",
    "robotId": 42,
    "overrides": {
      "attributes": { "combatPower": 15, "accuracy": 20 },
      "stance": "offensive",
      "mainWeaponId": 7
    }
  },
  "robot2": {
    "type": "sparring",
    "config": {
      "botTier": "ExpertBot",
      "loadoutType": "weapon_shield",
      "rangeBand": "mid",
      "stance": "defensive",
      "yieldThreshold": 20
    }
  }
}
```

Response:
```json
{
  "combatResult": { /* CombatResult / SpatialCombatResult shape */ },
  "battleLog": [ /* narrative events from convertBattleEvents */ ],
  "robot1Info": { "name": "Iron Fist", "maxHP": 95, "maxShield": 12 },
  "robot2Info": { "name": "ExpertBot Sparring Partner", "maxHP": 300, "maxShield": 200 }
}
```

**GET /api/practice-arena/sparring-partners**

Response:
```json
{
  "sparringPartners": [
    {
      "botTier": "WimpBot",
      "description": "Weak opponent with level 1 attributes",
      "attributeLevel": 1,
      "priceTier": { "min": 0, "max": 99999 },
      "loadoutOptions": ["single", "weapon_shield", "two_handed", "dual_wield"],
      "rangeBandOptions": ["melee", "short", "mid", "long"],
      "stanceOptions": ["offensive", "defensive", "balanced"]
    },
    ...
  ]
}
```

**GET /api/admin/practice-arena/stats**

Response:
```json
{
  "current": {
    "totalBattlesSinceStart": 1247,
    "battlesToday": 83,
    "rateLimitHitsToday": 2,
    "uniquePlayersToday": 15
  },
  "history": [
    { "date": "2026-04-02", "totalBattles": 142, "uniquePlayers": 23, "rateLimitHits": 5 },
    { "date": "2026-04-01", "totalBattles": 98, "uniquePlayers": 18, "rateLimitHits": 1 }
  ]
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Practice battle result completeness

*For any* two valid `RobotWithWeapons` objects (owned or sparring partner), executing a practice battle should return a `PracticeBattleResult` containing: a non-null `combatResult` with `winnerId` (number or null for draw), `durationSeconds` > 0, `isDraw` (boolean), non-empty `events` array, and `robot1Info`/`robot2Info` with `name`, `maxHP` > 0, and `maxShield` >= 0.

**Validates: Requirements 1.1, 3.4**

### Property 2: Default robot state used without overrides

*For any* owned robot read from the database, building it for a practice battle with no What-If overrides should produce a `RobotWithWeapons` whose 23 attribute values, loadout type, stance, yield threshold, and weapon IDs are identical to the persisted robot state.

**Validates: Requirements 1.3**

### Property 3: Narrative generation produces non-empty battle log

*For any* valid `CombatResult` with a non-empty `events` array, calling `CombatMessageGenerator.convertBattleEvents` (or `convertSimulatorEvents`) should produce a non-empty narrative array where each entry has a `timestamp` and a `message` string.

**Validates: Requirements 3.1**

### Property 4: Battle statistics within valid ranges

*For any* non-empty `CombatEvent[]` array from a practice battle, the computed per-robot statistics should satisfy: hit rate in [0, 100], critical hit rate in [0, 100], malfunction rate in [0, 100], counter-attack rate in [0, 100], and average damage per hit >= 0.

**Validates: Requirements 3.5**

### Property 5: Zero database side effects

*For any* practice battle execution (owned vs owned, owned vs sparring, sparring vs sparring), zero Prisma `create`, `update`, `delete`, `upsert`, or `createMany` operations should be called on any table, and zero `eventLogger.logEvent` calls should be made.

**Validates: Requirements 4.1, 4.3, 5.1, 5.2, 5.3**

### Property 6: Robot data cloning integrity

*For any* owned robot, after building it for a practice battle and executing `simulateBattle`, the original robot object retrieved from the database should remain unchanged — all 23 attributes, HP, shield, weapon IDs, and stats should be identical to their pre-battle values.

**Validates: Requirements 5.4**

### Property 7: Sparring partner weapon auto-selection validity

*For any* valid sparring partner configuration (bot tier, loadout type, range band), the auto-selected weapons via `selectWeapon`/`selectShield` should satisfy: weapon cost is within the tier's price range, weapon `handsRequired` is compatible with the loadout type (one-handed for single/weapon_shield/dual_wield, two-handed for two_handed, shield for weapon_shield offhand), and if loadout is `weapon_shield` then the offhand is a shield.

**Validates: Requirements 6.5, 6.6, 7.6**

### Property 8: What-If override application

*For any* owned robot and any valid What-If override (attribute values in 1-50, valid weapon IDs, valid loadout/stance/yield), the built `RobotWithWeapons` should reflect the overridden values exactly, while non-overridden fields retain their original persisted values.

**Validates: Requirements 7.1, 7.2, 7.3**

### Property 9: Upgrade cost estimation non-negative

*For any* pair of (current attribute level, target attribute level) where both are in [1, 50], the estimated upgrade cost should be >= 0, and should be 0 when current >= target.

**Validates: Requirements 7.7**

### Property 10: localStorage result history round trip

*For any* practice battle result and player ID, storing the result in localStorage and then reading it back should produce an equivalent result object (serialization round trip via JSON).

**Validates: Requirements 8.1**

### Property 11: localStorage max capacity invariant

*For any* sequence of N practice battle results added to localStorage (where N > 10), the stored history should contain exactly 10 results, and they should be the 10 most recently added results in order.

**Validates: Requirements 8.2**

### Property 12: Ownership verification rejects non-owned robots

*For any* robot ID that does not belong to the authenticated user, the practice battle endpoint should reject the request with a 403 status code.

**Validates: Requirements 10.3**

### Property 13: Invalid configuration rejection

*For any* request payload with attribute values outside [1, 50], yield threshold outside [0, 50], invalid loadout type, invalid stance, or incompatible weapon-loadout combination, the practice battle endpoint should return a 400 status code.

**Validates: Requirements 10.5**

### Property 14: Metrics counter accuracy

*For any* sequence of `recordBattle(userId)` and `recordRateLimitHit()` calls, `getStats()` should return: `totalBattlesSinceStart` equal to the total number of `recordBattle` calls, `battlesToday` equal to the number of `recordBattle` calls since the last midnight reset, `rateLimitHitsToday` equal to the number of `recordRateLimitHit` calls since the last midnight reset, and `uniquePlayersToday` equal to the count of distinct `userId` values passed to `recordBattle` since the last midnight reset.

**Validates: Requirements 13.1**

### Property 15: Metrics daily flush preserves lifetime counter

*For any* metrics state, after calling `flushAndReset()`, `battlesToday` should be 0, `rateLimitHitsToday` should be 0, `uniquePlayersToday` should be 0, and `totalBattlesSinceStart` should be unchanged from its pre-flush value. Additionally, a row should have been inserted into `practice_arena_daily_stats` with the pre-flush counter values.

**Validates: Requirements 13.4**

## Security Design

The Practice Arena follows all established security patterns from the Security Playbook (`docs/guides/SECURITY.md`). Although the feature has no credit mutations (so `lockUserForSpending` is not needed), it introduces new API endpoints and must enforce the same input validation, ownership verification, and monitoring standards as all other routes.

### Input Validation

All routes use the `validateRequest` middleware from `middleware/schemaValidator.ts` with Zod schemas. Zod's default `.strip()` mode removes unknown fields, preventing mass-assignment attacks. Schemas use centralized primitives from `utils/securityValidation.ts`:

- `positiveIntParam` for `robotId` and weapon ID parameters (rejects non-numeric, zero, negative, floats)
- `z.enum()` for `botTier`, `loadoutType`, `rangeBand`, `stance` (rejects arbitrary strings)
- `z.number().int().min(1).max(50)` for each of the 23 named attribute keys (no arbitrary keys accepted — the schema explicitly lists all 23 attribute names)
- `z.number().int().min(0).max(50)` for `yieldThreshold`
- Discriminated union on `type` field for battle slots (only `'owned'` or `'sparring'` accepted)

Validation failures are automatically logged by `validateRequest` via `securityMonitor.logValidationFailure()`.

### Ownership Verification

Robot ownership is verified using the `verifyRobotOwnership` helper from `middleware/ownership.ts`, which:
- Queries the robot and checks `robot.userId === userId`
- Logs authorization failures via `securityMonitor.logAuthorizationFailure(userId, 'robot', robotId)`
- Returns a generic 403 "Access denied" (never reveals whether the robot exists)

The `buildOwnedRobot` function calls `verifyRobotOwnership(prisma, robotId, userId)` before reading the full robot data.

### Rate Limiting

- Per-user rate limiter: 30 battles per 15 minutes, keyed by `authReq.user.userId`
- On exceed: `practiceArenaMetrics.recordRateLimitHit()` + `securityMonitor.trackRateLimitViolation(userId, endpoint)` + 429 response with `retryAfter`
- Follows the same pattern as the account reset limiter in `onboarding.ts`

### Admin Endpoint Protection

The `GET /api/admin/practice-arena/stats` endpoint is protected by `authenticateToken` + `requireAdmin`. The `requireAdmin` middleware automatically logs unauthorized access attempts via `securityMonitor.logAuthorizationFailure()` with resource type `admin_endpoint`.

### No Credit Mutations

Since the Practice Arena performs zero database writes and zero credit mutations, the `lockUserForSpending` / transaction integrity pattern does not apply. This is explicitly by design — the feature is read-only on the server side.

### XSS Prevention

Sparring partner names are generated server-side (e.g., "WimpBot Sparring Partner") — no user input flows into displayed names. What-If overrides are numeric values only. The `BattlePlaybackViewer` component already handles narrative rendering safely.



| Scenario | Status | Error Code | Message |
|----------|--------|------------|---------|
| Owned robot not found | 404 | `ROBOT_NOT_FOUND` | "Robot not found" |
| Robot not owned by player | 403 | `ACCESS_DENIED` | "Access denied" |
| Robot has no weapon (and no override) | 400 | `VALIDATION_ERROR` | "Robot requires a main weapon to participate" |
| Invalid attribute range (outside 1-50) | 400 | `VALIDATION_ERROR` | Zod field-level error |
| Invalid yield threshold (outside 0-50) | 400 | `VALIDATION_ERROR` | Zod field-level error |
| Weapon-loadout incompatibility | 400 | `VALIDATION_ERROR` | "Weapon X is not compatible with loadout Y" |
| No weapon found in price tier for sparring partner | 400 | `WEAPON_SELECTION_FAILED` | "No weapon found in price tier for the selected loadout and range band" |
| Rate limit exceeded | 429 | `RATE_LIMIT_EXCEEDED` | "Rate limit exceeded. Try again in X seconds" |
| Cycle job running | 503 | `CYCLE_IN_PROGRESS` | "Practice Arena is temporarily unavailable while battles are being processed" |
| Combat engine error | 500 | `BATTLE_SIMULATION_FAILED` | "Practice battle simulation failed" (logged, not exposed) |
| Admin stats endpoint — non-admin user | 403 | `ADMIN_REQUIRED` | "Admin access required" |

All errors follow the standard `{ error: string, code: string, details?: unknown }` response shape. Express 5 async error forwarding handles promise rejections automatically.

## Testing Strategy

### Property-Based Testing

Property-based tests use `fast-check` (already in the project for both backend Jest and frontend Vitest). Each property test runs a minimum of 100 iterations.

Each test is tagged with: `Feature: practice-arena, Property {number}: {property_text}`

Backend property tests (`prototype/backend/tests/unit/practiceArena.property.test.ts`):
- Properties 1-9, 12-15 (service logic, validation, metrics)

Frontend property tests (`prototype/frontend/src/hooks/__tests__/usePracticeHistory.property.test.ts`):
- Properties 10-11 (localStorage round trip, max capacity)

### Unit Tests

Unit tests cover specific examples, edge cases, and integration points:

Backend (`prototype/backend/tests/unit/practiceArenaService.test.ts`):
- `buildOwnedRobot` clones robot data correctly
- `buildOwnedRobot` rejects non-owned robots with 403
- `buildOwnedRobot` rejects weaponless robots with 400
- `buildSparringPartner` constructs valid robot from each of the 4 bot tiers
- `buildSparringPartner` auto-selects weapons via `selectWeapon`/`selectShield`
- `executePracticeBattle` returns complete result without DB writes
- `getSparringPartnerDefinitions` returns exactly 4 entries with correct attribute levels
- LuxuryBot config has attributeLevel 15 and priceTier min 400000

Backend route tests (`prototype/backend/tests/unit/practiceArena.route.test.ts`):
- POST /battle returns 400 for invalid body
- POST /battle returns 403 for non-owned robot
- GET /sparring-partners returns 4 definitions
- Rate limiter returns 429 after 30 requests

Backend metrics tests (`prototype/backend/tests/unit/practiceArenaMetrics.test.ts`):
- `recordBattle` increments counters correctly
- `recordRateLimitHit` increments rate limit counter
- `getStats` returns correct unique player count
- Daily reset zeroes daily counters but preserves lifetime counter

Frontend tests (`prototype/frontend/src/pages/__tests__/PracticeArenaPage.test.tsx`):
- Renders two battle slot panels
- "My Robot" mode shows robot dropdown
- "Sparring Partner" mode shows bot tier buttons and config controls
- "Run Battle" disabled when slots incomplete
- Loading state during simulation
- Battle result renders with BattlePlaybackViewer
- "Re-Run" triggers another API call
- Result history shows previous results from localStorage
- "Clear History" removes all results
- Rate limit error displays retry message

Frontend hook tests (`prototype/frontend/src/hooks/__tests__/usePracticeHistory.test.ts`):
- Stores and retrieves results from localStorage
- Caps at 10 results
- Clears history
- Keys by player ID (different players don't see each other's results)

Admin integration tests:
- GET /api/admin/practice-arena/stats returns expected shape
- DashboardTab renders Practice Arena section with metrics

## Documentation Impact

- `docs/prd_pages/PRD_PRACTICE_ARENA.md` — New file documenting the Practice Arena feature (overview, sparring partners, API, frontend, rate limiting, zero-consequence guarantee)
- `docs/prd_core/BATTLE_SIMULATION_ARCHITECTURE.md` — Add a section noting the Practice Arena as a fifth consumer of the combat engine, distinct from the four orchestrators (no post-combat pipeline, no DB writes, synchronous request/response)
- `docs/prd_pages/PRD_ADMIN_PAGE.md` — Add Practice Arena metrics section to the Dashboard tab documentation
- `docs/guides/SECURITY.md` — Add practice arena rate limiting (30 battles/15min per user) to the Rate Limiting section
- `.kiro/steering/project-overview.md` — No changes needed (project structure and tech stack unchanged)
- `.kiro/steering/coding-standards.md` — No changes needed (follows existing patterns)
