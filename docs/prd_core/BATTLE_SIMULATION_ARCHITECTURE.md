# Battle Simulation Architecture

**Last Updated**: March 15, 2026
**Status**: ✅ Implemented
**Owner**: Robert Teunissen
**Epic**: Battle System - Simulation & Orchestration

---

## Executive Summary

This document provides a unified architectural overview of the battle simulation system. It ties together the shared combat engine, the three battle orchestrators (league, tournament, tag team), the narrative generation pipeline, the BattleParticipant data model, and the audit log — all of which were previously documented in isolation.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     CYCLE SCHEDULER (cycleScheduler.ts)                 │
│                     4 independent cron jobs via node-cron               │
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
│  │  TAG TEAM CYCLE      │  │  SETTLEMENT           │                      │
│  │  cron: 0 12 * * *    │  │  cron: 0 23 * * *     │                      │
│  │  (daily 12:00 UTC)   │  │  (daily 23:00 UTC)    │                      │
│  │                      │  │                       │                      │
│  │  1. Repair robots    │  │  1. Passive income    │                      │
│  │  2. Execute battles  │  │  2. Operating costs   │                      │
│  │     (odd cycles only)│  │  3. End-of-cycle      │                      │
│  │  3. Rebalance leagues│  │     balance logging   │                      │
│  │  4. Matchmaking (48h)│  │  4. Increment cycle   │                      │
│  └──────────┬───────────┘  │  5. Analytics snapshot │                      │
│             │              │  6. Auto-generate users│                      │
│             │              └──────────┬────────────┘                      │
│             │                        │                                   │
│  Also triggered via:    POST /api/admin/cycles/bulk (manual/dev)         │
└─────────────┼────────────────────────┼───────────────────────────────────┘
              │                        │
  ┌───────────▼────────────────────────▼───────────────────┐
  │                                                         │
  │  ┌──────────────────┐ ┌──────────────┐ ┌────────────┐  │
  │  │ League            │ │ Tournament   │ │ Tag Team   │  │
  │  │ Orchestrator      │ │ Orchestrator │ │ Orchestrator│  │
  │  │ battleOrchestrator│ │ tournament   │ │ tagTeamBattle│ │
  │  │ .ts               │ │ Battle       │ │ Orchestrator│  │
  │  │                   │ │ Orchestrator │ │ .ts         │  │
  │  │                   │ │ .ts          │ │             │  │
  │  └────────┬──────────┘ └──────┬──────┘ └──────┬──────┘  │
  │           │                   │               │          │
  └───────────┼───────────────────┼───────────────┼──────────┘
              │                   │               │
        ┌─────▼───────────────────▼───────────────▼────────┐
        │              COMBAT SIMULATOR                     │
        │            (combatSimulator.ts)                    │
        │                                                    │
        │  simulateBattle(robot1, robot2, isTournament?)     │
        │                                                    │
        │  Returns: CombatResult                             │
        │    ├─ winnerId                                     │
        │    ├─ robot1FinalHP / robot2FinalHP                │
        │    ├─ robot1Damage / robot2Damage                  │
        │    ├─ durationSeconds                              │
        │    ├─ isDraw                                       │
        │    └─ events: CombatEvent[]                        │
        └──────────────────────┬───────────────────────────┘
                               │
        ┌──────────────────────▼───────────────────────────┐
        │          COMBAT MESSAGE GENERATOR                 │
        │        (combatMessageGenerator.ts)                 │
        │                                                    │
        │  generateBattleLog({ simulatorEvents, ... })       │
        │    └─ convertSimulatorEvents()  (1v1/tournament)   │
        │    └─ convertTagTeamEvents()    (tag team)         │
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

## The Three Orchestrators

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


### 1. League Battle Orchestrator (`battleOrchestrator.ts`)

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
| Audit event type | `tournament_match` (2 events) |
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
| Audit event type | `tag_team_battle` (4 events, one per robot) |
| Cycle step | Independent scheduling |

---

## Combat Simulator Deep Dive

The combat simulator (`combatSimulator.ts`) is the shared, stateless engine used by all three orchestrators. It has no database dependencies — it takes two `RobotWithWeapons` objects and returns a `CombatResult`.

### Simulation Model

```
  Time: 0.0s                                    Time: 120.0s (max)
  ├─────────────────────────────────────────────────┤
  │  Tick-based simulation (100ms per tick)          │
  │                                                  │
  │  Each tick:                                      │
  │    1. Regenerate shields (both robots)            │
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
  │       - Time limit → draw (or HP tiebreaker)      │
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
┌─────────────────────────────┐         ┌─────────────────────────────┐
│  INPUT: RobotWithWeapons ×2 │         │  OUTPUT: CombatResult       │
│                             │         │                             │
│  All 23 robot attributes:   │         │  winnerId: number | null    │
│  - combatPower              │  ────►  │  robot1FinalHP              │
│  - weaponControl            │         │  robot2FinalHP              │
│  - accuracy, evasion        │         │  robot1Damage (taken)       │
│  - armor, penetration       │         │  robot2Damage (taken)       │
│  - critChance, critDamage   │         │  robot1DamageDealt          │
│  - attackSpeed              │         │  robot2DamageDealt          │
│  - counterChance            │         │  durationSeconds            │
│  - shieldCapacity, etc.     │         │  isDraw                     │
│                             │         │  events: CombatEvent[]      │
│  + mainWeapon, offhandWeapon│         │                             │
│  + stance                   │         │                             │
│  + isTournament flag        │         │                             │
└─────────────────────────────┘         └─────────────────────────────┘
```

ELO is NOT used in combat calculations — it's only for matchmaking.

---

## Narrative Generation Pipeline

All three orchestrators convert raw `CombatEvent[]` into human-readable battle narratives using `CombatMessageGenerator`:

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
| `generateBattleLog()` | All orchestrators | Entry point — delegates to converter or generates minimal log for byes |
| `convertSimulatorEvents()` | League + Tournament | Converts 1v1 CombatEvent[] to narrative messages |
| `convertTagTeamEvents()` | Tag Team | Handles phase transitions, tag-outs, reserve activations |

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

| Orchestrator | Event Type | Events per Battle |
|---|---|---|
| League | `battle_complete` | 2 (one per robot) |
| Tournament | `tournament_match` | 2 (one per robot) |
| Tag Team | `tag_team_battle` | 4 (one per robot) |

---

## Shared Utilities

The orchestrators share several utility modules:

```
  ┌─────────────────────────────────────────────────────────────┐
  │                    SHARED UTILITIES                          │
  │                                                              │
  │  battleMath.ts                                               │
  │    ├─ calculateExpectedScore()    ELO expected outcome       │
  │    ├─ calculateELOChange()        ELO delta after battle     │
  │    └─ ELO_K_FACTOR               K-factor constant           │
  │                                                              │
  │  economyCalculations.ts                                      │
  │    ├─ getLeagueBaseReward()       Credits by league tier     │
  │    ├─ getParticipationReward()    Loser/draw credits         │
  │    ├─ calculateBattleWinnings()   Total credit calculation   │
  │    └─ getPrestigeMultiplier()     Prestige bonus %           │
  │                                                              │
  │  tournamentRewards.ts                                        │
  │    ├─ calculateTournamentBattleRewards()                     │
  │    └─ getTournamentRewardBreakdown()                         │
  │                                                              │
  │  streamingRevenueService.ts                                  │
  │    ├─ calculateStreamingRevenue()       (1v1)                │
  │    ├─ calculateTagTeamStreamingRevenue() (tag team)          │
  │    └─ awardStreamingRevenue()           (DB write)           │
  │                                                              │
  │  eventLogger.ts                                              │
  │    └─ EventLogger class (singleton)                          │
  │       ├─ logEvent()                                          │
  │       └─ logEventBatch()                                     │
  └─────────────────────────────────────────────────────────────┘
```

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
  │  20:00    LEAGUE CYCLE                                           │
  │  ├────────────────────────────────────────────────────────┐      │
  │  │  1. Repair all robots                                  │      │
  │  │  2. Execute scheduled league battles (1v1)             │      │
  │  │     └─ battleOrchestrator.executeScheduledBattles()    │      │
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

### Why 4 Independent Jobs?

The acc/production environment uses individual cron triggers rather than a monolithic cycle. This gives:
- Independent scheduling per battle type (tournaments morning, leagues evening)
- Tag team battles on a 48h cadence (odd cycles only) without blocking league play
- Settlement runs last, after all battles are done, to capture the full day's economic activity
- Each job repairs robots first, so no battle type depends on another job having run
- Lock-based mutual exclusion prevents overlapping execution

---

## File Reference

| File | Purpose |
|---|---|
| `src/services/cycleScheduler.ts` | 4 independent cron jobs (league, tournament, tag team, settlement) |
| `src/services/combatSimulator.ts` | Shared combat engine — tick-based simulation using all 23 attributes |
| `src/services/battleOrchestrator.ts` | League 1v1 battle orchestration, ELO, rewards, audit logging |
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
