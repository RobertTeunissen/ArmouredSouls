# Product Requirements Document: Practice Arena

**Project**: Armoured Souls  
**Document Type**: Product Requirements Document (PRD)  
**Version**: 1.0  
**Date**: April 2026  
**Status**: ✅ IMPLEMENTED

---

## Executive Summary

The Practice Arena (in-universe: "Combat Simulation Lab") is a 1v1 sandbox battle simulator that allows players to run consequence-free battles between their own robots or against configurable AI sparring partners. It reuses the exact same `simulateBattle` combat engine and `convertBattleEvents`/`convertSimulatorEvents` narrative pipeline as real league and tournament battles — zero forked or custom combat logic. Practice battles produce zero database writes, do not affect robot HP, ELO, league points, credits, fame, or prestige, and are excluded from battle history. Results are persisted in the browser's localStorage (last 10 results, keyed per player) so they survive page navigation and refreshes.

**Key Capabilities:**
- ✅ 1v1 battles between owned robots or against AI sparring partners
- ✅ Full combat engine reuse (`simulateBattle` from `combatSimulator.ts`) with zero modifications
- ✅ Battle log and playback via existing `BattlePlaybackViewer` component with "SIMULATION" styling
- ✅ What-If configuration overrides (temporary attribute, weapon, loadout, stance changes)
- ✅ 4 sparring partner tiers: WimpBot (attr 1), AverageBot (attr 5), ExpertBot (attr 10), UltimateBot (attr 15)
- ✅ Auto-weapon selection via existing `selectWeapon`/`selectShield` from `weaponSelection.ts`
- ✅ Batch runs (2-10 battles) with aggregate statistics
- ✅ Zero database writes — no Battle, BattleParticipant, robot, or user records modified
- ✅ Rate limiting: 30 battles per 15 minutes per user
- ✅ Cycle execution guard: 503 when real battles are processing
- ✅ In-memory admin metrics with daily flush to `practice_arena_daily_stats` table
- ✅ localStorage result history (last 10 results per player)

---

## Related Documentation

- [BATTLE_SIMULATION_ARCHITECTURE.md](../prd_core/BATTLE_SIMULATION_ARCHITECTURE.md) — Combat engine architecture (Practice Arena is the fifth consumer)
- [PRD_ADMIN_PAGE.md](PRD_ADMIN_PAGE.md) — Admin portal (includes Practice Arena metrics in Dashboard tab)
- [PRD_SECURITY.md](../architecture/PRD_SECURITY.md) — Security strategy (includes Practice Arena rate limiting)
- [COMBAT_FORMULAS.md](../prd_core/COMBAT_FORMULAS.md) — Combat math reference
- [COMBAT_MESSAGES.md](../prd_core/COMBAT_MESSAGES.md) — Narrative generation system
- [combat-simulator.md](../app/backend/src/content/guide/strategy/combat-simulator.md) — In-game guide article for the Combat Simulator

---

## Feature Overview

### Zero-Consequence Guarantee

Practice battles are entirely stateless on the server. The service constructs `RobotWithWeapons` objects in memory from either persisted robot data (deep-cloned via `structuredClone()`, not referenced) or sparring partner definitions. After the simulation completes, the cloned data is discarded. No writes occur to any database table:

- Zero `Battle` or `BattleParticipant` records created
- Zero robot state mutations (HP, ELO, league points, fame, wins, losses, damage stats)
- Zero user economy mutations (credits, prestige, streaming revenue)
- Zero audit log events emitted
- No imports from `battlePostCombat.ts` (the entire post-combat pipeline is skipped)

The only database table the Practice Arena writes to is `practice_arena_daily_stats`, and only once per day during the settlement cycle — not during battle execution.

### Combat Engine Reuse

The Practice Arena calls the exact same `simulateBattle(r1, r2)` function from `combatSimulator.ts` that league and tournament orchestrators use, with `allowDraws: true`. It generates narratives via the same `CombatMessageGenerator.convertBattleEvents()` / `convertSimulatorEvents()` pipeline. If combat formulas, attribute effects, or combat messages are ever updated, practice battles automatically reflect those changes.

### Architectural Independence

The Practice Arena is NOT an orchestrator. It is a synchronous request/response service that:
- Is not invoked by `cycleScheduler.ts`
- Does not use `BattleStrategy`/`BattleProcessor` from `battleStrategy.ts`
- Does not import `battlePostCombat.ts`
- Has no dependency on `ScheduledMatch`, `ScheduledTagTeamMatch`, `ScheduledKothMatch`, or `ScheduledTournamentMatch`
- Only imports from the `battle/` domain: `simulateBattle` from `combatSimulator.ts` and `CombatMessageGenerator` from `combatMessageGenerator.ts`

---

## Sparring Partner System

Four AI sparring partner tiers are available. The first three reuse existing tier definitions from `tierConfig.ts` exactly; the fourth (UltimateBot) is defined within the practice arena service only.

| Bot Tier | In-Universe Name | Attribute Level | Price Tier | Source |
|----------|-----------------|----------------|------------|--------|
| WimpBot | Scrapyard Drone | 1 (all 23 attributes) | Budget: ₡0–₡99,999 | `TIER_CONFIGS[0]` from `tierConfig.ts` |
| AverageBot | Standard Combatant | 5 (all 23 attributes) | Standard: ₡100,000–₡250,000 | `TIER_CONFIGS[1]` from `tierConfig.ts` |
| ExpertBot | Elite Sparring Unit | 10 (all 23 attributes) | Premium: ₡250,000–₡400,000 | `TIER_CONFIGS[2]` from `tierConfig.ts` |
| UltimateBot | Apex Prototype | 15 (all 23 attributes) | Luxury: ₡400,000+ | `ULTIMATE_BOT_CONFIG` in `practiceArenaService.ts` |

### Configuration Options

Players configure sparring partners by selecting:
1. **Bot tier** — determines attribute levels and weapon price range
2. **Loadout type** — single, weapon_shield, two_handed, dual_wield
3. **Range band** — melee, short, mid, long
4. **Stance** — offensive, defensive, balanced
5. **Yield threshold** — 0 to 50

### Auto-Weapon Selection

Weapons are auto-selected using the existing `selectWeapon()` and `selectShield()` functions from `weaponSelection.ts`, passing the chosen loadout type, range band, and the tier's price range. Players do not manually pick individual weapons. The selected weapons are displayed as read-only with the label "AI-assigned loadout".

### Restrictions

- No free-form attribute editing for sparring partners
- No default loadout presets (Tank, Glass Cannon, etc.)
- The 4 bot-tier types with fixed attribute levels are the only sparring partner configurations

---

## What-If Configuration Overrides

Players can temporarily modify their owned robot's configuration for a practice battle without changing the real robot:

- **Attributes**: Any of the 23 robot attributes, overridable within the range 1–50
- **Weapons**: Any weapon from the full 47-weapon catalog, regardless of owned inventory
- **Loadout type**: single, weapon_shield, two_handed, dual_wield
- **Stance**: offensive, defensive, balanced
- **Yield threshold**: 0–50

### Visual Indicators

- Overridden values are highlighted with color differentiation
- Estimated credit cost of upgrading from current to overridden attribute levels is displayed
- A prominent notice reads: "Simulation parameters only — your robot is not modified"

### Academy Simulation

The What-If panel integrates with the Training Academy system. When a player raises attributes beyond their current academy cap, the simulator automatically:
- Detects that the planned attribute levels exceed the academy's maximum trainable level
- Calculates the academy upgrade cost required to unlock the higher attribute levels
- Displays the total investment: attribute upgrade cost + academy upgrade cost combined
- Shows the academy requirement inline so players can plan facility investments alongside attribute upgrades

### Validation

- Weapon-loadout compatibility rules are enforced (same rules as real robots)
- Attribute values must be within 1–50
- Yield threshold must be within 0–50
- All overrides are discarded when the player navigates away or the session ends

---

## Battle Configuration

### Supported Modes

- **Owned vs Owned**: Two robots from the player's stable
- **Owned vs Sparring Partner**: One owned robot against an AI sparring partner
- **Sparring vs Sparring**: Two AI sparring partners (for testing matchups)

### Robot Preparation

All robots (owned and sparring) enter practice battles at full HP (`maxHP`) and full shield (`maxShield`), regardless of their current repair state. This is consistent with how all real battle orchestrators operate.

### Batch Runs

Players can run 1–10 battles with the same configuration in a single API call. Batch results include:
- All individual `PracticeBattleResult` objects
- Aggregate statistics: win count per robot, average damage dealt per robot, average battle duration, draw count

Each battle in a batch counts toward the rate limit.

---

## Rate Limiting

- **Limit**: 30 practice battles per 15 minutes per authenticated user
- **Key**: `authReq.user.userId`
- **Implementation**: Custom in-memory rate limiter (`practiceRateLimiter` in `practiceArena.ts`) that counts individual battles, not HTTP requests. A batch of 5 counts as 5 battles toward the limit. This replaced `express-rate-limit` which could only count requests.
- **On exceed**: Returns 429 with `retryAfter` information and `remaining` battle count
- **Tracking**: Rate limit violations are recorded by `practiceArenaMetrics.recordRateLimitHit()` and `securityMonitor.trackRateLimitViolation()`
- **Batch handling**: If a batch request would exceed the remaining battle count, the entire batch is rejected before executing any battles
- **Cleanup**: Expired per-user entries are purged every 5 minutes via `setInterval`

### Cycle Execution Guard

When a cycle job is currently executing (`getSchedulerState().runningJob` is non-null), the Practice Arena returns 503 Service Unavailable. This prevents CPU contention with the real battle pipeline. The frontend displays "Combat Simulation Lab is offline — real arena battles are in progress" and auto-polls every 15 seconds to detect when the cycle completes.

---

## API Endpoints

### `POST /api/practice-arena/battle`

Executes one or more practice battles. Protected by `authenticateToken`.

**Request body:**
```json
{
  "robot1": {
    "type": "owned",
    "robotId": 42,
    "overrides": {
      "attributes": { "combatPower": 15, "targetingSystems": 20 },
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
  },
  "count": 1
}
```

**Response** (single battle):
```json
{
  "combatResult": { "winnerId": 42, "durationSeconds": 34.5, "isDraw": false, "events": [...] },
  "battleLog": [...],
  "robot1Info": { "name": "Iron Fist", "maxHP": 95, "maxShield": 12 },
  "robot2Info": { "name": "ExpertBot", "maxHP": 300, "maxShield": 200 }
}
```

**Response** (batch, `count` > 1):
```json
{
  "results": [...],
  "aggregate": {
    "totalBattles": 5,
    "robot1Wins": 3,
    "robot2Wins": 1,
    "draws": 1,
    "avgDurationSeconds": 42.3,
    "avgRobot1DamageDealt": 156.2,
    "avgRobot2DamageDealt": 134.8
  }
}
```

### `GET /api/practice-arena/sparring-partners`

Returns the 4 sparring partner type definitions. Protected by `authenticateToken`.

**Response:**
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
    }
  ]
}
```

### `GET /api/admin/practice-arena/stats`

Returns current in-memory counters plus historical daily summaries. Protected by `authenticateToken` + `requireAdmin`.

**Response:**
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

---

## Frontend Page Structure

### Page: `/practice-arena` (Combat Simulation Lab)

Accessible from the main navigation menu in the Battle section as "Combat Simulator".

**Section 1: Robot Selection (two battle slots)**
- Page header: "Combat Simulation Lab" with subheading "Run predictive combat simulations to test configurations before entering the real arena"
- Each slot has a toggle: "Deploy Robot" (own robot dropdown) or "Simulate Opponent" (sparring partner config)
- Sparring partner tiers displayed with in-universe names (Scrapyard Drone, Standard Combatant, Elite Sparring Unit, Apex Prototype)

**Section 2: Configuration Panel (per slot)**
- Owned robots: What-If override controls (attribute sliders, weapon dropdowns, loadout/stance/yield selectors)
- Sparring partners: bot tier selector, loadout type, range band, stance, yield threshold. Weapons displayed as read-only.

**Section 3: Battle Results**
- "Run Simulation" button with batch count selector (1-10)
- Loading state: "Running combat simulation..." with batch progress
- `BattlePlaybackViewer` with "SIMULATION" badge styling
- Battle report: winner, duration, damage, HP/shield, per-robot stats (hit rate, crit rate, malfunction rate, counter rate, avg damage per hit), effective attribute breakdown
- Batch aggregate panel: "Simulation Analysis" with win rate, avg damage, avg duration
- "Re-Run Simulation" button

**Section 4: Simulation History**
- Last 10 results from localStorage via `usePracticeHistory` hook
- Win/loss indicators and timestamps
- Comparison view for repeated matchups
- "Clear Simulation History" button

### Cycle Unavailability

When the API returns 503 `CYCLE_IN_PROGRESS`, the page displays "Combat Simulation Lab is offline — real arena battles are in progress. Simulations will resume shortly." and auto-polls every 15 seconds.

---

## localStorage Result History

- **Storage key**: `practice-arena-history-${userId}`
- **Max results**: 10 (oldest evicted first when cap is reached)
- **Persistence**: Survives page navigation and browser refreshes
- **Isolation**: Keyed per authenticated player — different players don't see each other's results
- **Hook**: `usePracticeHistory(userId)` returns `{ results, addResult, clearHistory }`

---

## Admin Metrics

### In-Memory Counters

The `practiceArenaMetrics` singleton tracks:
- `totalBattlesSinceStart` — lifetime counter (resets on server restart)
- `battlesToday` — daily counter
- `rateLimitHitsToday` — daily counter
- `uniquePlayersToday` — Set of player IDs (daily)

### Daily Flush

At settlement time (23:00 UTC), `practiceArenaMetrics.flushAndReset()` is called by the settlement cycle. It:
1. Inserts one row into `practice_arena_daily_stats` with the current day's counters and `playerIds` as a JSON array
2. Zeroes `battlesToday`, `rateLimitHitsToday`, and `uniquePlayersToday`
3. Does NOT reset `totalBattlesSinceStart`

### Database Table: `practice_arena_daily_stats`

| Column | Type | Description |
|--------|------|-------------|
| `id` | Int (autoincrement) | Primary key |
| `date` | Date (unique) | UTC date |
| `totalBattles` | Int | Battles executed that day |
| `uniquePlayers` | Int | Distinct players that day |
| `rateLimitHits` | Int | Rate limit rejections that day |
| `playerIds` | JSON | Array of integer user IDs |
| `createdAt` | DateTime | Row creation timestamp |

### Admin Dashboard Integration

The Dashboard tab in the admin portal displays a "Practice Arena" section showing:
- Battles today, unique players today, rate limit hits today, total battles since server start
- Historical trend from the `practice_arena_daily_stats` table (last 30 days)

---

## Testing Status

### Backend Tests ✅
- `practiceArenaService.test.ts` — Service unit tests (robot building, sparring partners, battle execution, zero DB writes)
- `practiceArena.route.test.ts` — Route tests (validation, auth, rate limiting, cycle guard, batch)
- `practiceArenaMetrics.test.ts` — Metrics counter tests (recording, flushing, history)
- `practiceArena.property.test.ts` — Property-based tests with fast-check (zero side effects, weapon selection validity, override application, cost estimation, validation rejection, metrics accuracy, flush preservation)

### Frontend Tests ✅
- `PracticeArenaPage.test.tsx` — Page component tests (slots, toggles, bot tiers, loading, results, history, rate limits, responsive)
- `usePracticeHistory.test.ts` — Hook unit tests (store, retrieve, cap, clear, player isolation)
- `usePracticeHistory.property.test.ts` — Property-based tests (localStorage round trip, max capacity invariant)

---

## File Structure

### Backend
- `app/backend/src/services/practice-arena/practiceArenaService.ts` — Core service (robot building, battle execution)
- `app/backend/src/services/practice-arena/practiceArenaMetrics.ts` — In-memory metrics singleton
- `app/backend/src/services/practice-arena/index.ts` — Barrel exports
- `app/backend/src/routes/practiceArena.ts` — API routes with Zod validation, rate limiting, cycle guard

### Frontend
- `app/frontend/src/pages/PracticeArenaPage.tsx` — Main page component
- `app/frontend/src/hooks/usePracticeHistory.ts` — localStorage history hook

### Database
- `app/backend/prisma/schema.prisma` — `PracticeArenaDailyStats` model
- One migration: `add-practice-arena-daily-stats`
