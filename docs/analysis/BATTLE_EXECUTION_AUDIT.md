# Battle Execution System — Cross-Type Reference

**Project**: Armoured Souls  
**Document Type**: Technical Reference  
**Version**: v2.0  
**Last Updated**: April 9, 2026  
**Status**: ✅ Current  
**Owner**: Robert Teunissen

**Revision History**:

v1.0 (Mar 18, 2026): Initial comprehensive audit of all 4 battle modes  
v2.0 (Apr 9, 2026): Converted from audit to reference doc — removed resolved audit trail (sections 10–12), added versioning header

---

**Related Documents**:
- [BATTLE_SIMULATION_ARCHITECTURE.md](../prd_core/BATTLE_SIMULATION_ARCHITECTURE.md) — Engine architecture and simulator design
- [COMBAT_FORMULAS.md](../prd_core/COMBAT_FORMULAS.md) — Detailed combat math
- [PRD_MATCHMAKING.md](../prd_core/PRD_MATCHMAKING.md) — Matchmaking algorithm
- [PRD_TOURNAMENT_SYSTEM.md](../prd_core/PRD_TOURNAMENT_SYSTEM.md) — Tournament bracket and rewards
- [PRD_CYCLE_SYSTEM.md](../prd_core/PRD_CYCLE_SYSTEM.md) — Cycle execution and scheduler
- [PRD_BATTLE_DATA_ARCHITECTURE.md](../prd_core/PRD_BATTLE_DATA_ARCHITECTURE.md) — BattleParticipant data model

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Shared Combat Engine](#2-shared-combat-engine)
3. [Match Type: League (1v1)](#3-match-type-league-1v1)
4. [Match Type: Tournament](#4-match-type-tournament)
5. [Match Type: Tag Team (2v2)](#5-match-type-tag-team-2v2)
6. [Match Type: King of the Hill](#6-match-type-king-of-the-hill)
7. [Cross-Type Comparison Matrix](#7-cross-type-comparison-matrix)
8. [Database Schema & Storage](#8-database-schema--storage)
9. [Frontend Presentation](#9-frontend-presentation)

---

## 1. System Architecture Overview

### Execution Flow

All battles are triggered by the **Cycle Scheduler** (`cycleScheduler.ts`) via 5 independent cron jobs:

| Job | Schedule | Handler |
|-----|----------|---------|
| League | `0 20 * * *` (daily 20:00 UTC) | `executeLeagueCycle()` |
| Tournament | `0 8 * * *` (daily 08:00 UTC) | `executeTournamentCycle()` |
| Tag Team | `0 12 * * *` (daily 12:00 UTC) | `executeTagTeamCycle()` |
| KotH | `0 16 * * 1,3,5` (Mon/Wed/Fri 16:00 UTC) | `executeKothCycle()` |
| Settlement | `0 23 * * *` (daily 23:00 UTC) | `executeSettlement()` |

All cycles follow the same pattern: **Repair → Execute → Post-process → Matchmake**.

```
┌──────────────────────────────────────────────────────────────────────┐
│                        CYCLE SCHEDULER                               │
│                   (cycleScheduler.ts — node-cron)                    │
│                                                                      │
│  League 20:00 ──► Repair → executeScheduledBattles()                │
│                   → rebalanceLeagues() → runMatchmaking(+24h)       │
│                                                                      │
│  Tournament 08:00 ► Repair → processTournamentBattle() per match    │
│                     → advanceWinnersToNextRound()                    │
│                     → autoCreateNextTournament()                     │
│                                                                      │
│  Tag Team 12:00 ──► Repair → executeScheduledTagTeamBattles()       │
│                     (odd cycles only)                                │
│                     → rebalanceTagTeamLeagues()                      │
│                     → runTagTeamMatchmaking(+48h)                    │
│                                                                      │
│  KotH 16:00 M/W/F ► Repair → executeScheduledKothBattles()         │
│                      → runKothMatchmaking(next M/W/F)               │
│                                                                      │
│  Settlement 23:00 ─► Passive income → Operating costs               │
│                      → Cycle increment → Analytics snapshot          │
└──────────────────────────────────────────────────────────────────────┘
```

### Orchestrator Architecture

Each match type has a dedicated orchestrator that wraps the shared combat engine:

| Match Type | Orchestrator File | Key Entry Function |
|-----------|-------------------|-------------------|
| League | `leagueBattleOrchestrator.ts` | `processBattle()` |
| Tournament | `tournamentBattleOrchestrator.ts` | `processTournamentBattle()` |
| Tag Team | `tagTeamBattleOrchestrator.ts` | `executeTagTeamBattle()` |
| KotH | `kothBattleOrchestrator.ts` | `processKothBattle()` |

### Concurrency Control

The scheduler uses an in-memory mutex (`acquireLock()` / `releaseLock()`) with a FIFO queue. Only one job runs at a time. If a job is already running, subsequent jobs queue and wait.

---

## 2. Shared Combat Engine

### Core Simulator: `combatSimulator.ts`

The function `simulateBattle(robot1, robot2, isTournament?)` is the shared 1v1 combat engine used by League, Tournament, and Tag Team battles. KotH uses `simulateBattleMulti()` with a `GameModeConfig` from `kothEngine.ts`, sharing the same tick-based combat engine.

**Formula Sharing Summary:**
- League, Tournament, and Tag Team call `simulateBattle()` directly — they share 100% of the same combat formulas, movement system, and mechanics. The only difference is a single boolean flag (`isTournament`) that swaps the time-limit draw for an HP tiebreaker.
- KotH imports and calls 5 individual formula functions from `combatSimulator.ts` (`calculateMalfunctionChance`, `calculateHitChance`, `calculateCritChance`, `calculateBaseDamage`, `applyDamage`) — so the core damage pipeline is shared. However, it skips counter-attacks, shield regen, yield, offhand attacks, range bands, backstab/flanking, adaptation, pressure, and servo strain. It also replaces the full spatial movement system with a simplified personality-based AI.

**Simulation Parameters:**
- Tick rate: `SIMULATION_TICK = 0.1s` (100ms)
- Max duration: `MAX_BATTLE_DURATION = 120s`
- Base weapon cooldown: `BASE_WEAPON_COOLDOWN = 4s`

**Per-Tick Loop (7 phases):**
1. **Movement** — Robots move toward preferred range using `calculateMovementIntent()` + `applyMovement()`
2. **Facing** — Robots turn toward opponent, limited by `calculateTurnSpeed()` (Gyro Stabilizers)
3. **Attacks** — Range-gated attacks with patience timer forcing attacks at suboptimal range
4. *(Phase 4 skipped in numbering)*
5. **Shield Regen** — `regenerateShields()` per tick with support boost
6. **State Checks** — Destruction (HP ≤ 0), yield (`shouldYield()`), alive flags
7. **Position Snapshots** — Throttled movement events for playback

**Attack Resolution Order (per `performAttack()`):**
1. Malfunction check → `calculateMalfunctionChance()`: `Max(0, 20% - (WeaponControl × 0.4%))`
2. Hit check → `calculateHitChance()`: `Clamp(70% + Targeting/2 + Stance - Evasion/3 - Gyro/5 ± variance, 10%, 95%)`
3. Critical check → `calculateCritChance()`: `Clamp(5% + CritSystems/8 + Targeting/25 + loadout + variance, 0%, 50%)`
4. Damage calc → `calculateBaseDamage()`: `WeaponDmg × CPMultiplier × WCMultiplier × LoadoutMult × StanceMult`
5. Spatial modifiers: range penalty, hydraulic bonus, backstab/flanking, adaptation, pressure
6. Damage application → `applyDamage()`: shield absorption → armor reduction → HP damage
7. Counter-attack check → `resolveCounter()`: `Clamp(CounterProtocols/100 × StanceMult × LoadoutMult, 0%, 40%)`

**Tournament Mode Difference:**
When `isTournament = true`, the time-limit handler uses an HP tiebreaker instead of declaring a draw:
- Higher HP% wins
- Equal HP%: robot1 wins (tournament tiebreaker)

### What the Orchestrators Actually Do

The orchestrators are NOT about combat formulas — they handle everything around the fight. The combat simulator is the physics engine; the orchestrators are the game modes.

| Orchestrator | Role |
|---|---|
| `leagueBattleOrchestrator.ts` (league) | Wraps `simulateBattle()` with league-specific rewards (LP, prestige, fame, streaming), ELO updates, bye-match handling, `ScheduledMatch` lifecycle, audit logging |
| `tournamentBattleOrchestrator.ts` | Wraps `simulateBattle(true)` with tournament-specific rewards (round-based multipliers, championship titles), bracket advancement (`TournamentMatch` updates), ELO updates |
| `tagTeamBattleOrchestrator.ts` | Runs `simulateBattle()` multiple times in phases, manages tag-out logic (`shouldTagOut()`, `activateReserveRobot()`), merges multi-phase event logs, splits rewards/ELO across 4 robots |
| `kothBattleOrchestrator.ts` (KotH) | Runs `simulateBattleMulti()` with KotH game mode config, placement-based rewards (1st-6th), no ELO changes, zone scoring, `ScheduledKothMatch` lifecycle |

In short: League, Tournament, and Tag Team differ only in how they set up the match, what the stakes are, and how they process results. The actual combat is identical. KotH is the exception — it runs a fundamentally different simulation.

**Return Type: `CombatResult`**
```typescript
{
  winnerId, robot1FinalHP, robot2FinalHP, robot1FinalShield, robot2FinalShield,
  robot1Damage, robot2Damage, robot1DamageDealt, robot2DamageDealt,
  durationSeconds, isDraw, events: CombatEvent[],
  arenaRadius, startingPositions, endingPositions
}
```

---

## 3. Match Type: League (1v1)

### Trigger & Scheduling
- **Matchmaking**: `runMatchmaking()` in `matchmakingService.ts`
- **Scheduling**: Creates `ScheduledMatch` records with 24h lead time
- **Execution**: `executeScheduledBattles()` → `processBattle()` per match
- **Readiness**: Weapons-only check (`checkBattleReadiness()`). HP not checked — auto-repair runs first.

### Matchmaking Algorithm
- Primary: LP-based (±10 ideal, ±20 fallback)
- Secondary: ELO-based (±150 ideal, ±300 fallback)
- Penalties: +200 recent opponent (last 5), +500 same-stable
- Bye-robot (ELO 1000) for odd numbers
- Per-instance, per-tier matching (no cross-tier or cross-instance)

### Combat Execution
- Calls `simulateBattle(robot1, robot2)` (isTournament = false)
- Draws are possible (time limit → draw)
- Bye matches use `simulateByeBattle()` — simplified, always player wins

### Reward System
| Reward | Winner | Loser | Draw |
|--------|--------|-------|------|
| Credits | Base win + participation + prestige bonus | Participation only | Participation only |
| ELO | K=32 standard formula | K=32 standard formula | K=32 draw formula |
| League Points | +3 | -1 (min 0) | +1 |
| Prestige | Flat by league tier | 0 | 0 |
| Fame | Base by league tier × performance bonus | 0 | 0 |
| Streaming Revenue | Per-battle calculation | Per-battle calculation | N/A for bye |

**League Win Rewards by Tier:**
| Tier | Base Win (credits) | Participation (credits) | Prestige | Fame (base) |
|------|-------------------|------------------------|----------|-------------|
| Bronze | 7,500 | 1,500 | 5 | 2 |
| Silver | 15,000 | 3,000 | 10 | 5 |
| Gold | 30,000 | 6,000 | 20 | 10 |
| Platinum | 60,000 | 12,000 | 30 | 15 |
| Diamond | 115,000 | 23,000 | 50 | 25 |
| Champion | 225,000 | 45,000 | 75 | 40 |

*Base win credits from `getLeagueWinReward()`. Participation = win reward × 0.2 via `getParticipationReward()`. Win credits are further multiplied by a prestige bonus via `calculateBattleWinnings()`. Prestige is flat per tier (winners only). Fame base is multiplied by a performance bonus: ×2.0 (perfect, 100% HP), ×1.5 (dominating, >80% HP), ×1.25 (comeback, <20% HP), ×1.0 (normal).*

### DB Storage
- `Battle` record: `battleType = 'league'`, `leagueType = <tier>`
- `BattleParticipant` × 2: one per robot, `team = 1|2`, `role = null`
- `ScheduledMatch` updated to `status = 'completed'`
- `AuditLog` × 2: one `BATTLE_COMPLETE` event per robot

### Key Functions Called
```
processBattle() → simulateBattleWrapper() → simulateBattle()
                → createBattleRecord() → prisma.battle.create + prisma.battleParticipant.createMany
                → updateRobotStats() → ELO update, LP update, prestige, fame, credits
                → calculateStreamingRevenue() → awardStreamingRevenue()
                → eventLogger.logEvent() × 2
```

---

## 4. Match Type: Tournament

### Trigger & Scheduling
- **Creation**: `autoCreateNextTournament()` or manual admin trigger
- **Bracket**: `createSingleEliminationTournament()` → `generateBracketPairs()` with ELO seeding
- **Execution**: `executeTournamentCycle()` iterates active tournaments, calls `processTournamentBattle()` per non-bye match
- **Advancement**: `advanceWinnersToNextRound()` after each round

### Matchmaking Algorithm
- No LP/ELO-based pairing — bracket is pre-determined by ELO seeding
- Seeds sorted by ELO descending, placed in standard tournament bracket positions
- Top seeds on opposite sides (1 vs 2 can only meet in finals)
- Bye matches for non-power-of-2 counts (top seeds get byes)
- Eligibility: weapon-equipped, not Bye Robot

### Combat Execution
- Calls `simulateBattle(robot1, robot2, true)` — tournament mode enabled
- **No draws possible**: HP tiebreaker at time limit, robot1 wins on perfect tie
- Bye matches are auto-completed at creation (no battle, no rewards)

### Reward System
| Reward | Winner | Loser |
|--------|--------|-------|
| Credits | `20,000 × sizeMultiplier × roundProgressMultiplier` | 30% of winner's credits |
| ELO | K=32 standard formula | K=32 standard formula |
| Prestige | `15 × progressMult × sizeMult` (+500 championship bonus for finals) | 0 |
| Fame | `10 × exclusivityMult × performanceBonus` | 0 |
| Streaming Revenue | Per-battle calculation | Per-battle calculation |
| Championship Title | +1 for finals winner | — |

**Size Multiplier**: `1 + (log10(participants / 10) × 0.5)`
**Round Progress**: `currentRound / maxRounds`
**Exclusivity**: `(robotsRemaining / totalParticipants)^-0.5`

**Performance Bonus (fame only):**
- Perfect (100% HP): 2.0×
- Dominating (>80% HP): 1.5×
- Comeback (<20% HP): 1.25×
- Normal: 1.0×

### DB Storage
- `Battle` record: `battleType = 'tournament'`, `leagueType = 'tournament'`, `tournamentId`, `tournamentRound`
- `BattleParticipant` × 2: one per robot
- `TournamentMatch` updated: `winnerId`, `battleId`, `status = 'completed'`
- `AuditLog` × 2: one `BATTLE_COMPLETE` event per robot

### Key Functions Called
```
processTournamentBattle() → simulateBattle(r1, r2, true)
                          → createTournamentBattleRecord() → prisma.battle.create + prisma.battleParticipant.createMany
                          → updateRobotStatsForTournament() → ELO update, prestige, fame, credits
                          → calculateStreamingRevenue() → awardStreamingRevenue()
                          → eventLogger.logEvent() × 2
                          → prisma.tournamentMatch.update()
```

---

## 5. Match Type: Tag Team (2v2)

### Trigger & Scheduling
- **Matchmaking**: `runTagTeamMatchmaking()` in `tagTeamMatchmakingService.ts` with 48h lead time
- **Scheduling**: Creates `TagTeamMatch` records (via `ScheduledTagTeamMatch` or equivalent)
- **Execution**: `executeScheduledTagTeamBattles()` → `executeTagTeamBattle()` per match
- **Frequency**: Odd cycles only (even cycles skip battle execution per Requirement 24.9)
- **Readiness**: Both active and reserve robots must have weapons equipped

### Matchmaking Algorithm
- Snake-draft team composition
- One team per stable (no cross-stable teams)
- ELO-balanced pairing
- Bye-team for odd numbers (combined ELO 2000, two bye robots at ELO 1000 each)

### Combat Execution
- **Multi-phase simulation** using the shared `simulateBattle()` engine
- Phase 1: Active robots fight (`simulateBattle(team1.active, team2.active)`)
- Tag-out triggers: `shouldTagOut()` — HP ≤ yield threshold OR HP ≤ 0, or phase winner detected
- Phase 2+: Reserve robot tags in at full HP with fresh cooldowns (`activateReserveRobot()`)
- Up to 3 phases possible (both tag out → reserves fight; one tags out → reserve vs active → second tags out → reserves fight)
- `BATTLE_TIME_LIMIT = 300s` (5 minutes total across all phases)
- Draws possible on timeout or simultaneous destruction

### Tag-Out Mechanics
- When active robot yields or is destroyed, reserve enters at full HP
- Terminal events (yield/destroyed) from the ending phase are stripped from the battle log so the narrative continues seamlessly
- Tag-out/tag-in events are injected into the battle log with timestamps
- Each subsequent phase's events are offset by the cumulative time of prior phases

### Winner Determination
1. Timeout (≥300s) → Draw
2. Both current fighters at 0 HP → Draw
3. One fighter at 0 HP → Other team wins
4. Both alive → Higher HP wins
5. Equal HP → Draw

### Reward System
| Reward | Winner | Loser | Draw |
|--------|--------|-------|------|
| Credits | League base × 2 (TAG_TEAM_REWARD_MULTIPLIER) | Participation × 2 | Participation × 2 |
| ELO | K=32 on combined team ELO, split to individual robots | Same | Draw formula |
| League Points | +3 (tag team league) | -1 (min 0) | +1 |
| Prestige | Base × 1.6 (TAG_TEAM_PRESTIGE_MULTIPLIER), split between team members | 0 | 0 |
| Fame | Base by league tier, split between team members | 0 | 0 |
| Streaming Revenue | Per-team calculation | Per-team calculation | — |

### DB Storage
- `Battle` record: `battleType = 'tag_team'`, plus tag team-specific fields:
  - `team1ActiveRobotId`, `team1ReserveRobotId`, `team2ActiveRobotId`, `team2ReserveRobotId`
  - `team1TagOutTime`, `team2TagOutTime` (BigInt, milliseconds)
  - Per-robot damage: `team1ActiveDamageDealt`, `team1ReserveDamageDealt`, etc.
  - Per-robot fame: `team1ActiveFameAwarded`, `team1ReserveFameAwarded`, etc.
- `BattleParticipant` × 4: one per robot, `team = 1|2`, `role = 'active'|'reserve'`
- `TagTeamMatch` updated with result
- `AuditLog` × 4: one `BATTLE_COMPLETE` event per robot

### Key Functions Called
```
executeTagTeamBattle() → simulateTagTeamBattle()
    → simulateBattle(active1, active2)     [Phase 1]
    → shouldTagOut() check
    → activateReserveRobot()
    → simulateBattle(reserve/active, ...)  [Phase 2]
    → shouldTagOut() check (other team)
    → simulateBattle(reserve, reserve)     [Phase 3, if needed]
  → createTagTeamBattleRecord()
    → CombatMessageGenerator.convertBattleEvents() with convertTagTeamEvents()
    → prisma.battle.create + prisma.battleParticipant.createMany
  → calculateTagTeamRewards()
  → calculateTagTeamELOChanges()
  → calculateTagTeamPrestige()
  → calculateTagTeamFame()
  → updateTagTeamBattleResults()
  → eventLogger.logEvent() × 4
```

---

## 6. Match Type: King of the Hill

### Trigger & Scheduling
- **Matchmaking**: `runKothMatchmaking()` in `kothMatchmakingService.ts`
- **Scheduling**: Creates `ScheduledKothMatch` + `ScheduledKothMatchParticipant` records
- **Execution**: `executeScheduledKothBattles()` → `processKothBattle()` per match
- **Frequency**: Mon/Wed/Fri at 16:00 UTC
- **Zone variant**: Monday & Friday = Fixed Zone; Wednesday = Rotating Zone

### Matchmaking Algorithm
- Eligibility: weapon equipped, not already scheduled, one robot per stable (highest ELO)
- Group size: 5-6 robots per match (MIN_GROUP_SIZE=5, IDEAL_GROUP_SIZE=6)
- Distribution: ELO-balanced snake-draft (`distributeIntoGroups()`)
- Remainder handling: if remainder < 5, those robots sit out; if remainder ≥ 5, extra group

### Combat Execution — SEPARATE ENGINE
KotH uses the unified N-robot simulator `simulateBattleMulti()` via `kothBattleOrchestrator.ts`, with KotH-specific game mode config from `kothEngine.ts`. Key differences from 1v1:

| Aspect | 1v1 Engine | KotH Engine |
|--------|-----------|-------------|
| Tick rate | 0.1s | 0.5s |
| Max duration | 120s | 150s (fixed) / 210s (rotating) |
| Participants | 2 | 5-6 |
| Movement AI | `calculateMovementIntent()` + spatial subsystem | Personality-based (aggressive/cautious, derived from robot ID) |
| Spatial system | Full 2D arena with range bands, backstab, adaptation, pressure, servo strain | Simplified: distance-based, no range bands, no backstab/flanking |
| Attack resolution | Full formula chain (malfunction → hit → crit → damage → shield → armor → counter) | Partial: malfunction → hit → crit → damage → shield+armor (via `applyDamage`), NO counter-attacks |
| Offhand attacks | Yes (dual-wield) | No (main hand only) |
| Shield regen | Yes (per-tick) | No |
| Yield mechanic | Yes (`shouldYield()`) | No (fight to destruction only) |
| Range bands | melee/short/mid/long with penalties | Single 8-unit attack range, no range penalties |
| Zone scoring | N/A | 1 pt/sec uncontested, +5 kill bonus |

**Win Conditions:**
1. Score threshold: 30 pts (fixed) / 45 pts (rotating)
2. Time limit: 150s (fixed) / 210s (rotating)
3. Last standing: 10-second countdown after all but one eliminated, then highest scorer wins

**Tiebreakers:** Zone score → Zone time → Damage dealt

**Last Standing Phase:** When one robot remains, it gets 10 seconds to score. It moves toward the zone and accumulates points. The winner is still determined by highest zone score, not survival.

### Reward System
| Placement | Credits | Fame | Prestige |
|-----------|---------|------|----------|
| 1st | 25,000 | 8 | 15 |
| 2nd | 17,500 | 5 | 8 |
| 3rd | 10,000 | 3 | 3 |
| 4th-6th | 5,000 | 0 | 0 |

**Zone Dominance Bonus:** If >75% of a robot's zone score came from uncontested time → +25% all rewards.

**No ELO change.** ELO before = ELO after for all participants.
**No league points.** KotH is a standalone mode.
**Streaming revenue:** Awarded to all participants.

### DB Storage
- `Battle` record: `battleType = 'koth'`, `leagueType = 'koth'`
  - `robot1Id` = 1st place, `robot2Id` = 2nd place (backward compat)
  - `winnerId` = 1st place robot
  - `battleLog` contains: narrative events, detailed events, KotH-specific data (placements, zone scores, arena config)
  - `winnerReward = 0`, `loserReward = 0` (rewards stored in BattleParticipant)
  - `eloChange = 0`
- `BattleParticipant` × N (5-6): one per robot
  - `team` = placement number (1-6), NOT team affiliation
  - `role = null`
  - Individual credits, fame, prestige per placement
- `ScheduledKothMatch` updated: `status = 'completed'`, `battleId`
- `AuditLog` × N: one `BATTLE_COMPLETE` event per robot with KotH-specific fields

### Key Functions Called
```
processKothBattle() → simulateKothBattle(robots, config)
                    → prisma.battle.create
                    → for each placement:
                        → calculateKothRewards()
                        → prisma.battleParticipant.create
                        → prisma.user.update (credits, prestige)
                        → prisma.robot.update (fame)
                        → calculateStreamingRevenue() → awardStreamingRevenue()
                        → updateKothRobotStats()
                        → eventLogger.logEvent()
                    → prisma.scheduledKothMatch.update
```

---

## 7. Cross-Type Comparison Matrix

### Combat Engine Differences

| Feature | League | Tournament | Tag Team | KotH |
|---------|--------|------------|----------|------|
| Simulator | `simulateBattle()` | `simulateBattle(true)` | `simulateBattle()` × phases | `simulateKothBattle()` |
| Tick rate | 0.1s | 0.1s | 0.1s | 0.5s |
| Max duration | 120s | 120s | 300s (total) | 150s/210s |
| Participants | 2 | 2 | 4 (2v2) | 5-6 |
| Draws possible | Yes | No (HP tiebreaker) | Yes | No (score tiebreaker) |
| Range bands | Yes | Yes | Yes | No |
| Backstab/flanking | Yes | Yes | Yes | No |
| Counter-attacks | Yes | Yes | Yes | No |
| Shield regen | Yes | Yes | Yes | No |
| Offhand attacks | Yes | Yes | Yes | No |
| Yield mechanic | Yes | Yes | Yes (triggers tag-out) | No |
| Adaptation/Pressure | Yes | Yes | Yes | No |
| Servo strain | Yes | Yes | Yes | No |
| Movement AI | Full spatial | Full spatial | Full spatial | Simplified personality |

### Reward Differences

| Reward | League | Tournament | Tag Team | KotH |
|--------|--------|------------|----------|------|
| Credits (winner) | 7,500-225,000 (by tier) | 20,000 × multipliers | League base × 2 | 25,000 (1st) |
| Credits (loser) | Participation only | 30% of winner | Participation × 2 | 5,000 (4th-6th) |
| ELO change | Yes (K=32) | Yes (K=32) | Yes (K=32, combined) | No |
| League points | +3/-1/+1 | No | +3/-1/+1 (tag team league) | No |
| Prestige | By tier × ELO mult | By round × size mult (+500 finals) | By tier × 1.6, split | By placement |
| Fame | By tier × ELO mult × perf | By exclusivity × perf | By tier, split | By placement |
| Streaming revenue | Yes | Yes | Yes | Yes |
| Championship title | No | Yes (finals winner) | No | No |

### Matchmaking Differences

| Aspect | League | Tournament | Tag Team | KotH |
|--------|--------|------------|----------|------|
| Algorithm | LP+ELO scoring | ELO seeding bracket | Snake-draft teams | ELO snake-draft groups |
| Lead time | 24h | Pre-determined bracket | 48h | Next Mon/Wed/Fri |
| Frequency | Daily | Daily (1 round/cycle) | Every other cycle (odd) | Mon/Wed/Fri |
| Per-instance | Yes | No (all eligible) | Yes | No (all eligible) |
| Bye handling | Bye Robot (ELO 1000) | Auto-advance (no battle) | Bye Team (ELO 2000) | Sit out (< 5 robots) |

### DB Storage Differences

| Field | League | Tournament | Tag Team | KotH |
|-------|--------|------------|----------|------|
| `battleType` | `'league'` | `'tournament'` | `'tag_team'` | `'koth'` |
| `leagueType` | tier name | `'tournament'` | tier name | `'koth'` |
| `tournamentId` | null | set | null | null |
| `tournamentRound` | null | set | null | null |
| Tag team fields | null | null | set (4 robot IDs, tag times) | null |
| `BattleParticipant` count | 2 | 2 | 4 | 5-6 |
| `BattleParticipant.team` | 1 or 2 | 1 or 2 | 1 or 2 | placement (1-6) |
| `BattleParticipant.role` | null | null | 'active'/'reserve' | null |
| Scheduling table | `ScheduledMatch` | `TournamentMatch` | `TagTeamMatch` | `ScheduledKothMatch` |

---

## 8. Database Schema & Storage

### Battle Table (core record)

The `Battle` table stores one record per battle across all types. Key fields:

```
id, robot1Id, robot2Id, winnerId, battleType, leagueType,
tournamentId?, tournamentRound?,
team1ActiveRobotId?, team1ReserveRobotId?, team2ActiveRobotId?, team2ReserveRobotId?,
team1TagOutTime?, team2TagOutTime?,
battleLog (JSON), durationSeconds,
winnerReward?, loserReward?,
robot1ELOBefore, robot2ELOBefore, robot1ELOAfter, robot2ELOAfter, eloChange,
team1ActiveDamageDealt, team1ReserveDamageDealt, team2ActiveDamageDealt, team2ReserveDamageDealt,
team1ActiveFameAwarded, team1ReserveFameAwarded, team2ActiveFameAwarded, team2ReserveFameAwarded,
createdAt
```

**Indexes:** robot1Id, robot2Id, createdAt, tournamentId, battleType

**Note on KotH:** The `robot1Id`/`robot2Id` fields store 1st and 2nd place for backward compatibility. The full participant list is in `BattleParticipant` records and the `battleLog` JSON.

### BattleParticipant Table (normalized per-robot data)

One record per robot per battle:

```
id, battleId, robotId, team, role?,
credits, streamingRevenue, eloBefore, eloAfter, prestigeAwarded, fameAwarded,
damageDealt, finalHP, yielded, destroyed, createdAt
```

**Indexes:** battleId, robotId, [battleId, team]
**Unique constraint:** [battleId, robotId]

### Scheduling Tables

| Table | Used By | Key Fields |
|-------|---------|------------|
| `ScheduledMatch` | League | robot1Id, robot2Id, leagueType, scheduledFor, status, battleId? |
| `TournamentMatch` | Tournament | tournamentId, round, matchNumber, robot1Id?, robot2Id?, winnerId?, battleId?, isByeMatch |
| `TagTeamMatch` | Tag Team | team1Id, team2Id, winnerId?, battleId? |
| `ScheduledKothMatch` | KotH | scheduledFor, status, rotatingZone, battleId? |
| `ScheduledKothMatchParticipant` | KotH | matchId, robotId |

### Audit & Analytics

- `AuditLog`: One `BATTLE_COMPLETE` event per robot per battle (all types)
- `CycleSnapshot`: Aggregated cycle metrics including battle counts
- `CycleMetadata`: Global cycle counter

---

## 9. Frontend Presentation

### Battle History Page (`BattleHistoryPage.tsx`)

- Filters: `'overall' | 'league' | 'tournament' | 'tag_team' | 'koth'`
- Sub-filters: outcome (win/loss/draw), sort by date/ELO/reward, search by robot name
- Statistics breakdown per battle type in `BattleHistorySummary.tsx`:
  - League/Tournament/Tag Team: battles, W/L/D, win rate, avg ELO change
  - KotH: battles, W/L/D, win rate, avg ELO change, avg zone score, total credits, total kills, placements (1st/2nd/3rd/other)

### Compact Battle Card (`CompactBattleCard.tsx`)

Type-specific display:
- League: ⚔️ icon + league tier name (e.g., "Bronze League")
- Tournament: 🏆 icon + tournament name + round name (e.g., "Semi-Finals")
- Tag Team: 🤝 icon + team names
- KotH: 👑 icon + variant (e.g., "King of the Hill • Rotating Zone")

### Battle Detail Page (`BattleDetailPage.tsx`)

- Loads full battle log via `GET /api/matches/battles/:id/log`
- Renders combat events in `BattlePlaybackViewer` component
- KotH battles include spatial playback with zone visualization

### Tournament Pages

- `TournamentsPage.tsx`: List of active/completed tournaments
- `TournamentDetailPage.tsx`: Full bracket visualization via `BracketView` component


---

Two open items from the original March 2026 audit (battle table denormalization, tag team time limit overrun) are tracked in [docs/BACKLOG.md](../BACKLOG.md).
