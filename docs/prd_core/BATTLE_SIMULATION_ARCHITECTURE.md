# Battle Simulation Architecture

**Last Updated**: March 19, 2026
**Status**: ✅ Implemented
**Owner**: Robert Teunissen
**Epic**: Battle System - Simulation & Orchestration

---

## Executive Summary

This document provides a unified architectural overview of the battle simulation system. It ties together the shared combat engine, the four battle orchestrators (league, tournament, tag team, KotH), the narrative generation pipeline, the BattleParticipant data model, and the audit log — all of which were previously documented in isolation.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     CYCLE SCHEDULER (cycleScheduler.ts)                 │
│                     5 independent cron jobs via node-cron               │
│                                                                         │
│  ┌─────────────────────┐  ┌─────────────────────┐                      │
│  │  LEAGUE CYCLE        │  │  TOURNAMENT CYCLE    │                      │
│  │  cron: 0 20 * * *    │  │  cron: 0 8 * * *     │                      │
│  │  (daily 20:00 UTC)   │  │  (daily 08:00 UTC)   │                      │
│  │                      │  │                      │                      │
│  │  1. Repair robots    │  │  1. Repair robots    │                      │
│  │  2. Execute battles  │  │  2. Execute matches  │                      │
│  │  3. Rebalance leagues│  │  3. Advance winners  │                      │
│  │  4. Matchmaking (24h)│  │  4. Auto-create next │                      │
│  └──────────┬───────────┘  └──────────┬───────────┘                      │
│             │                         │                                  │
│  ┌──────────┴──────────┐  ┌──────────┴───────────┐                      │
│  │  TAG TEAM CYCLE      │  │  KOTH CYCLE           │                      │
│  │  cron: 0 12 * * *    │  │  cron: 0 16 * * 1,3,5 │                      │
│  │  (daily 12:00 UTC)   │  │  (Mon/Wed/Fri 16:00)  │                      │
│  │                      │  │                       │                      │
│  │  1. Repair robots    │  │  1. Repair robots     │                      │
│  │  2. Execute battles  │  │  2. Execute KotH      │                      │
│  │     (odd cycles only)│  │     battles            │                      │
│  │  3. Rebalance leagues│  │  3. KotH matchmaking   │                      │
│  │  4. Matchmaking (48h)│  │     (next Mon/Wed/Fri) │                      │
│  └──────────┬───────────┘  └──────────┬────────────┘                      │
│             │                         │                                  │
│  ┌──────────┴─────────────────────────┴─────────────┐                    │
│  │  SETTLEMENT            cron: 0 23 * * *           │                    │
│  │  (daily 23:00 UTC)                                │                    │
│  │                                                   │                    │
│  │  1. Passive income    4. Increment cycle          │                    │
│  │  2. Operating costs   5. Analytics snapshot        │                    │
│  │  3. Balance logging   6. Auto-generate users      │                    │
│  └──────────┬────────────────────────────────────────┘                    │
│             │                                                            │
│  Also triggered via:    POST /api/admin/cycles/bulk (manual/dev)         │
└─────────────┼────────────────────────────────────────────────────────────┘
              │
  ┌───────────▼────────────────────────────────────────┐
  │                                                     │
  │  ┌──────────────────┐ ┌──────────────┐ ┌────────────┐  │
  │  │ League            │ │ Tournament   │ │ Tag Team   │  │
  │  │ Orchestrator      │ │ Orchestrator │ │ Orchestrator│  │
  │  │ leagueBattle      │ │ tournament   │ │ tagTeamBattle│ │
  │  │ Orchestrator.ts   │ │ Battle       │ │ Orchestrator│  │
  │  │                   │ │ Orchestrator │ │ .ts         │  │
  │  │                   │ │ .ts          │ │             │  │
  │  └────────┬──────────┘ └──────┬──────┘ └──────┬──────┘  │
  │           │                   │               │          │
  │  ┌────────┴──────────┐                                   │
  │  │ KotH Orchestrator │                                   │
  │  │ kothBattle        │                                   │
  │  │ Orchestrator.ts   │                                   │
  │  └────────┬──────────┘                                   │
  │           │                                              │
  └───────────┼───────────────────┼───────────────┼──────────┘
              │                   │               │
        ┌─────▼───────────────────▼───────────────▼────────┐
        │              COMBAT SIMULATOR                     │
        │            (combatSimulator.ts)                    │
        │                                                    │
        │  simulateBattleMulti(robots[], config)             │
        │    └─ N-robot unified entry point                  │
        │                                                    │
        │  simulateBattle(robot1, robot2, isTournament?)     │
        │    └─ Backward-compatible 1v1 wrapper              │
        │       delegates to simulateBattleMulti()           │
        │                                                    │
        │  Returns: CombatResult / SpatialCombatResult       │
        │    ├─ winnerId                                     │
        │    ├─ robot1FinalHP / robot2FinalHP                │
        │    ├─ robot1Damage / robot2Damage                  │
        │    ├─ durationSeconds                              │
        │    ├─ isDraw                                       │
        │    ├─ events: CombatEvent[]                        │
        │    └─ kothMetadata (optional, zone control only)   │
        └──────────────────────┬───────────────────────────┘
                               │
        ┌──────────────────────▼───────────────────────────┐
        │          COMBAT MESSAGE GENERATOR                 │
        │        (combatMessageGenerator.ts)                 │
        │                                                    │
        │  convertBattleEvents({ simulatorEvents, ... })     │
        │    └─ convertSimulatorEvents()  (1v1/tournament)   │
        │    └─ convertTagTeamEvents()    (tag team)         │
        │    └─ buildKothBattleLog()      (KotH)             │
        │                                                    │
        │  Raw CombatEvent[] → Narrative battle log          │
        └──────────────────────┬───────────────────────────┘
                               │
        ┌──────────────────────▼───────────────────────────┐
        │              DATABASE WRITES                      │
        │                                                    │
        │  ┌─────────────┐    ┌──────────────────────┐      │
        │  │   Battle     │    │  BattleParticipant   │      │
        │  │   (1 row)    │    │  (1 row per robot)   │      │
        │  │              │    │                      │      │
        │  │  battleType  │    │  robotId, team, role │      │
        │  │  winnerId    │    │  eloBefore/After     │      │
        │  │  duration    │    │  damageDealt         │      │
        │  │  battleLog   │    │  finalHP             │      │
        │  │  leagueType  │    │  credits             │      │
        │  │  cycleNumber │    │  streamingRevenue    │      │
        │  └──────┬───────┘    │  prestigeAwarded     │      │
        │         │            │  fameAwarded         │      │
        │         │            │  yielded/destroyed   │      │
        │         │            └──────────┬───────────┘      │
        └─────────┼───────────────────────┼──────────────────┘
                  │                       │
        ┌─────────▼───────────────────────▼──────────────────┐
        │              AUDIT LOG (EventLogger)               │
        │                                                    │
        │  One event PER ROBOT (not per battle)              │
        │                                                    │
        │  ┌──────────────────────────────────────────┐      │
        │  │  AuditLog record (robot 1's perspective) │      │
        │  │  eventType: battle_complete               │      │
        │  │  userId: robot1.userId                    │      │
        │  │  robotId: robot1.id                       │      │
        │  │  battleId: battle.id                      │      │
        │  │  payload: { credits, elo, prestige, ... } │      │
        │  └──────────────────────────────────────────┘      │
        │  ┌──────────────────────────────────────────┐      │
        │  │  AuditLog record (robot 2's perspective) │      │
        │  │  (same structure, robot 2's data)        │      │
        │  └──────────────────────────────────────────┘      │
        │                                                    │
        │  Tag team battles: 4 events (one per robot)        │
        └────────────────────────────────────────────────────┘
```

---

## The Four Orchestrators

Each orchestrator handles a different match type but follows the same core pattern:

```
  Load robots with weapons from DB
           │
           ▼
  Reset HP/Shield to max (full repair before combat)
           │
           ▼
  Call simulateBattle() from combatSimulator.ts
           │
           ▼
  Calculate rewards (credits, ELO, prestige, fame, streaming)
           │
           ▼
  Create Battle record + BattleParticipant records
           │
           ▼
  Convert CombatEvent[] → narrative via CombatMessageGenerator
           │
           ▼
  Update robot stats (ELO, HP, league points)
           │
           ▼
  Log audit events (one per robot) via EventLogger
```


### 1. League Battle Orchestrator (`leagueBattleOrchestrator.ts`)

| Aspect | Detail |
|---|---|
| Match source | `ScheduledMatch` records (created by matchmaking in Step 8) |
| Battle type | `"1v1"` |
| Participants | 2 robots → 2 BattleParticipant records |
| Bye handling | Creates a synthetic "Bye Robot" (ELO 1000), fights normally, reduced damage (8% HP loss) |
| Draw handling | Allowed — both robots get `LEAGUE_POINTS_DRAW` (+1) |
| Rewards | League-based credits, prestige (winner only), fame (winner + performance bonuses), streaming revenue |
| League points | Win: +3, Loss: -1, Draw: +1 |
| Audit event type | `battle_complete` (2 events) |
| Cycle step | Step 4 |

### 2. Tournament Battle Orchestrator (`tournamentBattleOrchestrator.ts`)

| Aspect | Detail |
|---|---|
| Match source | `TournamentMatch` records (created by tournament bracket system) |
| Battle type | `"tournament"` |
| Participants | 2 robots → 2 BattleParticipant records |
| Bye handling | Tournament byes are auto-completed at creation — no battle, no rewards, no combat |
| Draw handling | Not allowed — `isTournament=true` flag triggers HP% tiebreaker, then deterministic fallback |
| Rewards | Round-based tournament rewards (scale with bracket depth), prestige, fame, streaming revenue |
| League points | Not affected |
| Audit event type | `battle_complete` (2 events) |
| Cycle step | Step 2 |

### 3. Tag Team Battle Orchestrator (`tagTeamBattleOrchestrator.ts`)

| Aspect | Detail |
|---|---|
| Match source | `TagTeamMatch` records |
| Battle type | `"tag_team"` |
| Participants | 4 robots (2 per team) → 4 BattleParticipant records |
| Roles | `"active"` and `"reserve"` per team |
| Tag-out mechanics | When active robot yields or is destroyed, reserve robot tags in |
| Bye handling | Creates a synthetic bye-team with 2 robots (combined ELO 2000) |
| Draw handling | Allowed |
| Rewards | 2× credit multiplier, 1.6× prestige multiplier vs standard 1v1 |
| Audit event type | `battle_complete` (4 events, one per robot) |
| Cycle step | Independent scheduling |

### 4. KotH Battle Orchestrator (`kothBattleOrchestrator.ts`)

| Aspect | Detail |
|---|---|
| Match source | `ScheduledKothMatch` + `ScheduledKothMatchParticipant` records |
| Battle type | `"koth"` |
| Participants | 5-6 robots → 5-6 BattleParticipant records |
| Simulator call | `simulateBattleMulti(robots, kothConfig)` with `GameModeConfig` from `kothEngine.ts` |
| Draw handling | Not possible — score tiebreaker (zone score → zone time → damage dealt) |
| Rewards | Placement-based: 1st 25K credits, 2nd 17.5K, 3rd 10K, 4th-6th 5K. Zone dominance bonus +25% |
| ELO | No ELO changes |
| League points | Not affected (standalone mode) |
| Audit event type | `battle_complete` (one per robot, 5-6 events) |
| Cycle step | KotH cycle (Mon/Wed/Fri 16:00 UTC) |

---

## Combat Simulator Deep Dive

The combat simulator (`combatSimulator.ts`) is the shared, stateless engine used by all orchestrators. It has no database dependencies — it takes an array of `RobotWithWeapons` objects and a `BattleConfig`, and returns a `SpatialCombatResult`.

The primary entry point is `simulateBattleMulti(robots[], config)` which supports N-robot battles. The legacy `simulateBattle(robot1, robot2, isTournament?)` function is preserved as a backward-compatible wrapper that delegates to `simulateBattleMulti()`.

### Simulation Model

```
  Time: 0.0s                                    Time: 120.0s (max)
  ├─────────────────────────────────────────────────┤
  │  Tick-based simulation (100ms per tick)          │
  │                                                  │
  │  Each tick:                                      │
  │    1. Regenerate shields (all robots)             │
  │    2. Check attack cooldowns                      │
  │    3. Perform attacks (main + offhand if dual)    │
  │       a. Malfunction check (weapon control)       │
  │       b. Hit chance (accuracy vs evasion)         │
  │       c. Critical strike check                    │
  │       d. Damage calculation (armor/penetration)   │
  │       e. Shield → HP damage distribution          │
  │       f. Counter-attack check (post-attack)       │
  │    4. Check end conditions:                       │
  │       - HP ≤ 0 → destroyed                        │
  │       - HP < yield threshold → yield              │
  │       - Time limit → draw (or HP% tiebreaker)     │
  │       - Game mode win condition (e.g. KotH score)  │
  └──────────────────────────────────────────────────┘
```

### Key Constants

| Constant | Value | Purpose |
|---|---|---|
| `SIMULATION_TICK` | 0.1s | Time resolution per tick |
| `MAX_BATTLE_DURATION` | 120s | Maximum battle length before timeout |
| `BASE_WEAPON_COOLDOWN` | 4s | Default attack interval |
| `ARMOR_EFFECTIVENESS` | 1.5 | % damage reduction per armor point |
| `PENETRATION_BONUS` | 2.0 | % damage increase per penetration above armor |

### Input / Output Contract

```
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│  INPUT: simulateBattleMulti()   │       │  OUTPUT: SpatialCombatResult    │
│                                 │       │                                 │
│  robots: RobotWithWeapons[]     │       │  winnerId: number | null        │
│    All 23 robot attributes:     │       │  robot1FinalHP                  │
│    - combatPower                │ ────► │  robot2FinalHP                  │
│    - weaponControl              │       │  robot1Damage (taken)           │
│    - accuracy, evasion          │       │  robot2Damage (taken)           │
│    - armor, penetration         │       │  robot1DamageDealt              │
│    - critChance, critDamage     │       │  robot2DamageDealt              │
│    - attackSpeed                │       │  durationSeconds                │
│    - counterChance              │       │  isDraw                         │
│    - shieldCapacity, etc.       │       │  events: CombatEvent[]          │
│    + mainWeapon, offhandWeapon  │       │  arenaRadius                    │
│    + stance                     │       │  startingPositions              │
│                                 │       │  endingPositions                │
│  config: BattleConfig           │       │  kothMetadata (optional)        │
│    - allowDraws                 │       │                                 │
│    - maxDuration                │       │                                 │
│    - gameModeConfig (optional)  │       │                                 │
│    - gameModeState (optional)   │       │                                 │
│    - arenaRadius (optional)     │       │                                 │
└─────────────────────────────────┘       └─────────────────────────────────┘

Legacy wrapper: simulateBattle(robot1, robot2, isTournament?)
  → simulateBattleMulti([robot1, robot2], { allowDraws: !isTournament })
  → Maps SpatialCombatResult back to CombatResult shape
```

ELO is NOT used in combat calculations — it's only for matchmaking.

---

## Narrative Generation Pipeline

The orchestrators convert raw `CombatEvent[]` into human-readable battle narratives, but each takes a different approach based on its event structure:

```
  CombatEvent[]                    Narrative Battle Log
  (raw simulator output)           (stored in Battle.battleLog)
  ┌──────────────────┐             ┌──────────────────────────────────┐
  │ timestamp: 2.3   │             │ "⚔️ Thunderstrike lunges with   │
  │ type: 'attack'   │   ──────►  │  Plasma Blade, dealing 45       │
  │ damage: 45       │             │  damage to IronClad's shields!" │
  │ hit: true        │             │                                  │
  │ critical: false  │             │ "🛡️ IronClad's shields absorb  │
  │ shieldDamage: 45 │             │  the blow (62% remaining)"      │
  │ hpDamage: 0      │             └──────────────────────────────────┘
  └──────────────────┘
```

### Conversion Methods

| Method | Used by | Purpose |
|---|---|---|
| `convertBattleEvents()` | League, Tournament | Unified entry point — delegates to `convertSimulatorEvents()` or generates minimal log for byes |
| `convertSimulatorEvents()` | League, Tournament (via `convertBattleEvents()`), Tag Team (per phase) | Low-level converter: raw 1v1 `CombatEvent[]` → narrative messages |
| `convertTagTeamEvents()` | Tag Team | Multi-phase event stream converter — handles tag-out/tag-in transitions, calls `convertSimulatorEvents()` per phase |
| `buildKothBattleLog()` | KotH | Assembles battle log structure from raw events (already contain inline narrative from KotH tick hooks), spatial metadata, and placement data |

---

## Data Flow: Battle → BattleParticipant → AuditLog

This is the complete write path for a single battle:

```
  ┌─ Orchestrator ─────────────────────────────────────────────────────┐
  │                                                                     │
  │  1. CREATE Battle record                                            │
  │     ┌──────────────────────────────────────────────┐                │
  │     │ Battle { id, battleType, winnerId,           │                │
  │     │   robot1Id, robot2Id, durationSeconds,       │                │
  │     │   leagueType, cycleNumber, battleLog }       │                │
  │     └──────────────────────────────────────────────┘                │
  │                                                                     │
  │  2. CREATE BattleParticipant records (in same transaction)          │
  │     ┌─────────────────────────┐  ┌─────────────────────────┐       │
  │     │ Participant (Robot 1)   │  │ Participant (Robot 2)   │       │
  │     │ team: 1                 │  │ team: 2                 │       │
  │     │ role: null (1v1)        │  │ role: null (1v1)        │       │
  │     │ eloBefore/After         │  │ eloBefore/After         │       │
  │     │ damageDealt, finalHP    │  │ damageDealt, finalHP    │       │
  │     │ yielded, destroyed      │  │ yielded, destroyed      │       │
  │     └─────────────────────────┘  └─────────────────────────┘       │
  │     (Tag team: 4 records with role = "active" | "reserve")          │
  │                                                                     │
  │  3. UPDATE BattleParticipant with economic data                     │
  │     credits, streamingRevenue, prestigeAwarded, fameAwarded         │
  │                                                                     │
  │  4. UPDATE Robot stats                                              │
  │     currentHP, currentELO, leaguePoints, fame                       │
  │                                                                     │
  │  5. UPDATE User stats                                               │
  │     currency (credits + streaming), prestige                        │
  │                                                                     │
  │  6. LOG AuditLog events (one per robot)                             │
  │     ┌─────────────────────────┐  ┌─────────────────────────┐       │
  │     │ AuditLog (Robot 1)      │  │ AuditLog (Robot 2)      │       │
  │     │ eventType: battle_*     │  │ eventType: battle_*     │       │
  │     │ userId: robot1.userId   │  │ userId: robot2.userId   │       │
  │     │ robotId: robot1.id      │  │ robotId: robot2.id      │       │
  │     │ battleId: battle.id     │  │ battleId: battle.id     │       │
  │     │ payload: {              │  │ payload: {              │       │
  │     │   credits, elo,         │  │   credits, elo,         │       │
  │     │   prestige, fame,       │  │   prestige, fame,       │       │
  │     │   streaming, damage,    │  │   streaming, damage,    │       │
  │     │   result (win/loss/draw)│  │   result (win/loss/draw)│       │
  │     │ }                       │  │ }                       │       │
  │     └─────────────────────────┘  └─────────────────────────┘       │
  │                                                                     │
  └─────────────────────────────────────────────────────────────────────┘
```

### Audit Event Types by Orchestrator

All orchestrators emit the unified `battle_complete` event type via the shared `logBattleAuditEvent()` helper in `battlePostCombat.ts`. Type-specific metadata (e.g., KotH placement, tag team role) is included in the `extras` field of the payload.

| Orchestrator | Event Type | Events per Battle |
|---|---|---|
| League | `battle_complete` | 2 (one per robot) |
| Tournament | `battle_complete` | 2 (one per robot) |
| Tag Team | `battle_complete` | 4 (one per robot) |
| KotH | `battle_complete` | 5-6 (one per robot) |

> **Note:** The `EventType` enum in `eventLogger.ts` still contains `TOURNAMENT_MATCH` and `TAG_TEAM_BATTLE` for backward compatibility with old audit log records in the database. New code should never emit these event types.

---

## Shared Utilities

The orchestrators share several utility modules:

```
  ┌─────────────────────────────────────────────────────────────┐
  │                    SHARED UTILITIES                          │
  │                                                              │
  │  battleMath.ts                                               │
  │    ├─ calculateExpectedScore()    ELO expected outcome       │
  │    ├─ calculateELOChange()        ELO delta (K=32 hardcoded) │
  │    └─ ELO_K_FACTOR               K-factor constant (32)     │
  │                                                              │
  │  economyCalculations.ts                                      │
  │    ├─ getLeagueWinReward()        Credits by league tier     │
  │    ├─ getParticipationReward()    Loser/draw credits         │
  │    ├─ calculateBattleWinnings()   Total credit calculation   │
  │    └─ getPrestigeMultiplier()     Prestige bonus %           │
  │                                                              │
  │  tournamentRewards.ts                                        │
  │    ├─ calculateTournamentBattleRewards()                     │
  │    └─ getTournamentRewardBreakdown()                         │
  │                                                              │
  │  streamingRevenueService.ts                                  │
  │    ├─ calculateStreamingRevenue()       (per-robot)          │
  │    ├─ getStreamingStudioLevel()         (facility query)     │
  │    └─ awardStreamingRevenue()           (DB write)           │
  │                                                              │
  │  eventLogger.ts                                              │
  │    └─ EventLogger class (singleton)                          │
  │       ├─ logEvent()                                          │
  │       └─ logEventBatch()                                     │
  └─────────────────────────────────────────────────────────────┘
```

---

## Shared Post-Combat Layer

**Added**: March 18, 2026

All four orchestrators previously duplicated the same 6-step post-combat pipeline. This has been extracted into two shared modules:

### `battlePostCombat.ts` — Shared Post-Combat Helpers

Reusable functions that eliminate copy-paste across orchestrators. Each orchestrator still owns its own `processBattle()` flow and reward formulas — these helpers just handle the repetitive DB writes:

```
  ┌─────────────────────────────────────────────────────────────┐
  │              battlePostCombat.ts (shared helpers)            │
  │                                                              │
  │  awardStreamingRevenueForParticipant()                       │
  │    └─ calc + award + update BattleParticipant in one call    │
  │    └─ Replaces 3-step pattern across all orchestrators       │
  │                                                              │
  │  logBattleAuditEvent()                                       │
  │    └─ One audit event per robot with standard fields         │
  │    └─ Type-specific extras merged via AuditEventExtras       │
  │    └─ Replaces ~50-line eventLogger.logEvent blocks          │
  │                                                              │
  │  updateRobotCombatStats()                                    │
  │    └─ wins/losses/draws/kills/damage lifetime + ELO + HP     │
  │    └─ Optional LP change with min-0 clamping                 │
  │    └─ Optional fame increment                                │
  │    └─ Replaces per-orchestrator prisma.robot.update blocks   │
  │                                                              │
  │  awardCreditsToUser()                                        │
  │    └─ Simple currency increment (no-op if amount ≤ 0)        │
  │                                                              │
  │  awardPrestigeToUser()                                       │
  │    └─ Simple prestige increment (no-op if amount ≤ 0)        │
  │                                                              │
  │  awardFameToRobot()                                          │
  │    └─ Simple fame increment (no-op if amount ≤ 0)            │
  │                                                              │
  │  Shared types:                                               │
  │    ParticipantOutcome, RobotStatUpdateOptions,               │
  │    AuditEventExtras                                          │
  └─────────────────────────────────────────────────────────────┘
```

### `battleStrategy.ts` — Strategy Pattern for New Match Types

Defines the `BattleStrategy<TMatch>` interface and `BattleProcessor` class. New match types implement the strategy (~100-150 lines of unique logic) and plug into the shared 11-step pipeline:

```
  ┌─────────────────────────────────────────────────────────────┐
  │              BattleProcessor (battleStrategy.ts)              │
  │                                                              │
  │  process(match) executes this pipeline:                      │
  │                                                              │
  │   1. loadParticipants()          ← strategy provides         │
  │   2. simulate()                  ← strategy provides         │
  │   3. calculateELO()              ← shared (opt-out via flag) │
  │   4. calculateRewards()          ← strategy provides         │
  │   5. createBattleRecord()        ← shared structure          │
  │   6. createParticipants()        ← shared structure          │
  │   7. updateRobotStats()          ← shared via postCombat     │
  │   8. awardStreamingRevenue()     ← shared via postCombat     │
  │   9. logAuditEvents()            ← shared via postCombat     │
  │  10. updateScheduleRecord()      ← strategy provides         │
  │  11. postProcess()               ← strategy hook (optional)  │
  │                                                              │
  │  Config flags per strategy:                                  │
  │    affectsELO, affectsLeaguePoints, allowsDraws,             │
  │    hasStreamingRevenue, hasByeMatches                         │
  └─────────────────────────────────────────────────────────────┘
```

### How Existing Orchestrators Use the Shared Layer

The four existing orchestrators have been refactored to use `battlePostCombat.ts` helpers directly within their existing `processBattle()` flows. They do NOT use `BattleProcessor` — their battle-tested flows are preserved:

| Orchestrator | Shared Helpers Used |
|---|---|
| League | `updateRobotCombatStats()`, `awardCreditsToUser()`, `awardPrestigeToUser()`, `awardStreamingRevenueForParticipant()`, `logBattleAuditEvent()` |
| Tournament | `updateRobotCombatStats()`, `awardCreditsToUser()`, `awardPrestigeToUser()`, `awardStreamingRevenueForParticipant()`, `logBattleAuditEvent()` |
| Tag Team | `awardCreditsToUser()`, `awardPrestigeToUser()`, `logBattleAuditEvent()` |
| KotH | `awardCreditsToUser()`, `awardPrestigeToUser()`, `awardFameToRobot()`, `awardStreamingRevenueForParticipant()`, `logBattleAuditEvent()` |

### How to Add a New Match Type

New match types should use `BattleProcessor` instead of writing a full orchestrator from scratch. Here's the pattern:

```typescript
// 1. Implement BattleStrategy (~100-150 lines)
class MyNewBattleStrategy implements BattleStrategy<MyMatchRecord> {
  readonly battleType = 'my_new_type';
  readonly leagueType = 'my_league';
  readonly affectsELO = true;
  readonly affectsLeaguePoints = false;
  readonly allowsDraws = true;
  readonly hasStreamingRevenue = true;
  readonly hasByeMatches = false;

  async loadParticipants(match: MyMatchRecord) { /* load robots from DB */ }
  simulate(participants, match) { /* call simulateBattle() or simulateBattleMulti() */ }
  async calculateRewards(result, participants, match) { /* your reward formulas */ }
  buildBattleLog(result, participants, match) { /* narrative generation */ }
  getExtraBattleFields(result, match) { return {}; }
  getExtraParticipantFields(robotId, result, match) { return {}; }
  getAuditExtras(robotId, result, match) { return {}; }
  async updateScheduleRecord(match, battleId) { /* mark schedule as completed */ }
}

// 2. Use BattleProcessor to run it
const strategy = new MyNewBattleStrategy();
const processor = new BattleProcessor(strategy);
const result = await processor.process(matchRecord);
// → Creates Battle + BattleParticipants, updates robot stats,
//   awards credits/prestige/fame/streaming, logs audit events
```

The `BattleProcessor` handles all 11 pipeline steps. You only write the parts that are genuinely unique to your match type.

---

## How It All Connects: Scheduling Model

The battle system is driven by `cycleScheduler.ts`, which registers 4 independent cron jobs via `node-cron`. Each job runs on its own schedule, acquires a lock (only one job at a time), and executes its own self-contained cycle. There is no monolithic "8-step cycle" — each job owns its own repair → battle → rebalance → matchmaking flow.

```
  ┌─────────────────────────────────────────────────────────────────┐
  │                    DAILY TIMELINE (UTC)                          │
  │                                                                  │
  │  08:00    TOURNAMENT CYCLE                                       │
  │  ├────────────────────────────────────────────────────────┐      │
  │  │  1. Repair all robots                                  │      │
  │  │  2. Execute pending tournament matches                 │      │
  │  │     └─ tournamentBattleOrchestrator                    │      │
  │  │        .processTournamentBattle()                      │      │
  │  │     └─ simulateBattle(r1, r2, isTournament=true)       │      │
  │  │     └─ No draws (HP tiebreaker)                        │      │
  │  │  3. Advance winners to next round                      │      │
  │  │  4. Auto-create next tournament if none active         │      │
  │  └────────────────────────────────────────────────────────┘      │
  │                                                                  │
  │  12:00    TAG TEAM CYCLE                                         │
  │  ├────────────────────────────────────────────────────────┐      │
  │  │  1. Repair all robots                                  │      │
  │  │  2. Execute tag team battles (ODD cycles only)         │      │
  │  │     └─ tagTeamBattleOrchestrator                       │      │
  │  │        .executeScheduledTagTeamBattles()               │      │
  │  │     └─ simulateBattle() called per phase               │      │
  │  │     └─ Tag-out on yield/destruction → reserve tags in  │      │
  │  │  3. Rebalance tag team leagues                         │      │
  │  │  4. Matchmaking with 48h lead time                     │      │
  │  │  (Even cycles: repair only, skip battles)              │      │
  │  └────────────────────────────────────────────────────────┘      │
  │                                                                  │
  │  16:00    KOTH CYCLE (Mon/Wed/Fri only)                          │
  │  ├────────────────────────────────────────────────────────┐      │
  │  │  1. Repair all robots                                  │      │
  │  │  2. Execute scheduled KotH battles (5-6 robots each)   │      │
  │  │     └─ kothBattleOrchestrator                           │     │
  │  │        .executeScheduledKothBattles()                   │     │
  │  │     └─ simulateBattleMulti(robots, kothConfig)          │     │
  │  │     └─ Zone scoring, placement-based rewards, no ELO   │      │
  │  │  3. KotH matchmaking (next Mon/Wed/Fri)                │      │
  │  │  (Mon/Fri = Fixed Zone, Wed = Rotating Zone)           │      │
  │  └────────────────────────────────────────────────────────┘      │
  │                                                                  │
  │  20:00    LEAGUE CYCLE                                           │
  │  ├────────────────────────────────────────────────────────┐      │
  │  │  1. Repair all robots                                  │      │
  │  │  2. Execute scheduled league battles (1v1)             │      │
  │  │     └─ leagueBattleOrchestrator                        │      │
  │  │        .executeScheduledBattles()                      │      │
  │  │     └─ simulateBattle(r1, r2, isTournament=false)      │      │
  │  │     └─ Draws allowed                                   │      │
  │  │  3. Rebalance leagues (promote/demote)                 │      │
  │  │  4. Matchmaking with 24h lead time                     │      │
  │  └────────────────────────────────────────────────────────┘      │
  │                                                                  │
  │  23:00    SETTLEMENT (end-of-day economics)                      │
  │  ├────────────────────────────────────────────────────────┐      │
  │  │  1. Credit passive income (merchandising hub)          │      │
  │  │  2. Debit operating costs (facilities + roster)        │      │
  │  │  3. Log end-of-cycle balances for all users            │      │
  │  │  4. Increment cycle number (cycleMetadata.totalCycles) │      │
  │  │  5. Create analytics snapshot (CycleSnapshot)          │      │
  │  │  6. Auto-generate users (if enabled)                   │      │
  │  └────────────────────────────────────────────────────────┘      │
  │                                                                  │
  │  Locking: acquireLock() ensures only one job runs at a time      │
  │  Manual:  POST /api/admin/cycles/bulk also available (dev/test)  │
  └─────────────────────────────────────────────────────────────────┘
```

### Why 5 Independent Jobs?

The acc/production environment uses individual cron triggers rather than a monolithic cycle. This gives:
- Independent scheduling per battle type (tournaments morning, KotH afternoon, leagues evening)
- Tag team battles on a 48h cadence (odd cycles only) without blocking league play
- KotH on a Mon/Wed/Fri schedule with alternating zone variants
- Settlement runs last, after all battles are done, to capture the full day's economic activity
- Each job repairs robots first, so no battle type depends on another job having run
- Lock-based mutual exclusion prevents overlapping execution

---

## File Reference

| File | Purpose |
|---|---|
| `src/services/cycleScheduler.ts` | 5 independent cron jobs (league, tournament, tag team, KotH, settlement) |
| `src/services/combatSimulator.ts` | Shared combat engine — tick-based simulation using all 23 attributes |
| `src/services/battlePostCombat.ts` | Shared post-combat helpers (streaming revenue, audit logging, robot stats, credits/prestige/fame) |
| `src/services/battleStrategy.ts` | Strategy Pattern interface (`BattleStrategy`) + `BattleProcessor` for new match types |
| `src/services/leagueBattleOrchestrator.ts` | League 1v1 battle orchestration, ELO, rewards, audit logging |
| `src/services/kothBattleOrchestrator.ts` | KotH battle orchestration, placement rewards, zone scoring |
| `src/services/tournamentBattleOrchestrator.ts` | Tournament bracket battles, round-based rewards |
| `src/services/tagTeamBattleOrchestrator.ts` | 2v2 tag team battles, tag-out mechanics, 4-robot participation |
| `src/services/combatMessageGenerator.ts` | Raw events → narrative battle log conversion |
| `src/services/eventLogger.ts` | Audit log writer (one event per robot pattern) |
| `src/services/streamingRevenueService.ts` | Streaming revenue calculation and awarding |
| `src/utils/battleMath.ts` | ELO calculations (K-factor, expected score, delta) |
| `src/utils/economyCalculations.ts` | Credit rewards, prestige multipliers, participation rewards |
| `src/utils/tournamentRewards.ts` | Tournament-specific reward scaling |

All paths relative to `prototype/backend/`.

---

## King of the Hill Integration

**Last Updated**: March 18, 2026  
**Status**: ✅ Implemented

### Architecture Approach

KotH plugs into the existing battle simulation architecture via the `GameModeConfig` extensibility system. The core `combatSimulator.ts` is **unchanged** — KotH provides strategy implementations that the simulator consumes through its existing interfaces:

| Interface | KotH Implementation | Purpose |
|---|---|---|
| `TargetPriorityStrategy` | `KothTargetPriorityStrategy` | Zone contesters 3×, approachers 2×, threat-analysis-scaled weights |
| `MovementIntentModifier` | `KothMovementIntentModifier` | Zone-biased movement, wait-and-enter tactic |
| `WinConditionEvaluator` | `KothWinConditionEvaluator` | Score threshold, last standing (10s), time limit, tiebreakers |
| `ArenaZone` | `createControlZone()` | Center {0,0}, configurable radius [3,8], rotating zone support |

### New Files

| File | Purpose |
|---|---|
| `src/services/arena/kothEngine.ts` | Pure functions + strategy classes: zone scoring, anti-passive mechanics, spawn positions, rotating zone generation, `buildKothGameModeConfig()` |
| `src/services/kothMatchmakingService.ts` | ELO-balanced snake-draft group matchmaking, one-per-stable filtering, zone variant by day of week |

### Extended Files

| File | Change |
|---|---|
| `src/services/battleOrchestrator.ts` → `src/services/leagueBattleOrchestrator.ts` | Renamed for consistency. League-only orchestration. KotH code extracted to `kothBattleOrchestrator.ts`. |
| `src/services/kothBattleOrchestrator.ts` | Extracted from `battleOrchestrator.ts` — `executeScheduledKothBattles()`, `processKothBattle()`, `calculateKothRewards()`, `updateKothRobotStats()`. Imports `getCurrentCycleNumber` from `leagueBattleOrchestrator.ts`. |
| `src/services/battlePostCombat.ts` | Shared post-combat helpers extracted from all 4 orchestrators. Used by league, tournament, tag team, and KotH. |
| `src/services/battleStrategy.ts` | Strategy Pattern interface (`BattleStrategy<TMatch>`) + `BattleProcessor` class for new match types. |
| `src/services/cycleScheduler.ts` | Added 5th cron job (`koth`, `0 16 * * 1,3,5`) with `executeKothCycle()` handler |
| `src/services/combatSimulator.ts` | **Unchanged** — KotH plugs in via `GameModeConfig` |

### Daily Timeline with KotH

```
UTC   Job
08:00 Tournament Cycle
12:00 Tag Team Cycle (battles on odd cycles only)
16:00 KotH Cycle (Mon/Wed/Fri only) ← NEW
20:00 League Cycle
23:00 Settlement
```

### Updated File Reference

| File | Purpose |
|---|---|
| `src/services/arena/kothEngine.ts` | KotH game mode config, zone scoring, anti-passive, AI strategies |
| `src/services/kothMatchmakingService.ts` | KotH-specific matchmaking (snake-draft, one-per-stable) |

---

## Related Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — High-level system architecture and battle simulation engine design
- [PRD_BATTLE_DATA_ARCHITECTURE.md](PRD_BATTLE_DATA_ARCHITECTURE.md) — BattleParticipant table design and migration
- [PRD_AUDIT_SYSTEM.md](PRD_AUDIT_SYSTEM.md) — One-event-per-robot audit log architecture
- [COMBAT_FORMULAS.md](COMBAT_FORMULAS.md) — Detailed combat math (hit chance, damage, crits, counters)
- [COMBAT_MESSAGES.md](COMBAT_MESSAGES.md) — Narrative generation system and message templates
- [PRD_TOURNAMENT_SYSTEM.md](PRD_TOURNAMENT_SYSTEM.md) — Tournament bracket system and scheduling
- [CYCLE_PROCESS.md](../implementation_notes/CYCLE_PROCESS.md) — Legacy 8-step cycle reference (admin bulk API); acc uses cycleScheduler cron jobs instead
- [PRD_ECONOMY_SYSTEM.md](PRD_ECONOMY_SYSTEM.md) — Credit rewards, streaming revenue, prestige multipliers
- [PRD_PRESTIGE_AND_FAME.md](PRD_PRESTIGE_AND_FAME.md) — Prestige and fame award calculations
