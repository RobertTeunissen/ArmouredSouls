# Battle Execution System — Comprehensive Audit

**Date**: March 18, 2026
**Scope**: All four match types (League, Tournament, Tag Team, King of the Hill)
**Status**: Complete audit of implementation vs. documentation

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Shared Combat Engine](#2-shared-combat-engine)
3. [Match Type: League (1v1)](#3-match-type-league-1v1)
4. [Match Type: Tournament](#4-match-type-tournament)
5. [Match Type: Tag Team (2v2)](#5-match-type-tag-team-2v2)
6. [Match Type: King of the Hill (N-player FFA)](#6-match-type-king-of-the-hill)
7. [Cross-Type Comparison Matrix](#7-cross-type-comparison-matrix)
8. [Database Schema & Storage](#8-database-schema--storage)
9. [Frontend Presentation](#9-frontend-presentation)
10. [Documentation Alignment Findings](#10-documentation-alignment-findings)
11. [Issues & Discrepancies](#11-issues--discrepancies)
12. [Recommendations](#12-recommendations)

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

## 10. Documentation Alignment Findings

### PRD vs. Implementation — Aligned ✅

1. **COMBAT_FORMULAS.md** ↔ `combatSimulator.ts`: All formulas match implementation:
   - Malfunction: `Max(0, 20% - WC × 0.4%)` ✅
   - Hit chance: `Clamp(70% + Targeting/2 + Stance - Evasion/3 - Gyro/5 ± variance, 10%, 95%)` ✅
   - Critical: `Clamp(5% + CritSystems/8 + Targeting/25 + loadout + variance, 0%, 50%)` ✅
   - Damage: `WeaponDmg × CPMult × WCMult × LoadoutMult × StanceMult` ✅
   - Armor: `ARMOR_EFFECTIVENESS = 1.5`, `PENETRATION_BONUS = 2.0` ✅
   - Counter: `Clamp(CounterProtocols/100 × StanceMult × LoadoutMult, 0%, 40%)` ✅

2. **PRD_MATCHMAKING.md** ↔ `matchmakingService.ts`: Core algorithm matches:
   - LP primary (±10/±20), ELO secondary (±150/±300) ✅
   - Recent opponent tracking (last 5) ✅
   - Same-stable penalty (+500) ✅
   - Bye-robot for odd numbers ✅
   - Weapons-only readiness check ✅

3. **PRD_TOURNAMENT_SYSTEM.md** ↔ `tournamentService.ts` + `tournamentBattleOrchestrator.ts`:
   - Single elimination format ✅
   - ELO-based seeding ✅
   - HP tiebreaker for draws ✅
   - Auto-create next tournament ✅
   - Bye matches auto-completed (no battle, no rewards) ✅

4. **BATTLE_SIMULATION_ARCHITECTURE.md** ↔ Implementation:
   - 4 cron jobs (league/tournament/tag team/settlement) documented ✅
   - KotH 5th cron job exists in code but architecture doc shows only 4 — see Issues
   - Orchestrator → Simulator → Message Generator → DB pipeline ✅
   - BattleParticipant model ✅

5. **PRD_CYCLE_SYSTEM.md** ↔ `cycleScheduler.ts`:
   - 15-step cycle execution flow documented ✅
   - Repair-first pattern ✅
   - Settlement as separate job ✅

6. **In-Game Guide** ↔ Implementation:
   - `combat/battle-flow.md`: Attack sequence matches `performAttack()` ✅
   - `tournaments/rewards.md`: Reward formulas match `tournamentRewards.ts` ✅
   - `tournaments/tournament-format.md`: Bracket generation matches `tournamentService.ts` ✅
   - `leagues/matchmaking.md`: Scoring system matches `matchmakingService.ts` ✅
   - `king-of-the-hill/scoring-and-win-conditions.md`: Score/time/last-standing match code ✅
   - `king-of-the-hill/rewards.md`: Placement tiers and zone dominance bonus match code ✅
   - `king-of-the-hill/match-formats.md`: Fixed/rotating variants match code ✅

### PRD vs. Implementation — Discrepancies ⚠️

See Section 11 for the full list.

---

## 11. Issues & Discrepancies

### ISSUE-01: Tournament ELO Changes — PRD Contradiction (Severity: Medium) ✅ RESOLVED

**Finding:** The `createTournamentBattleRecord()` function calculates and stores ELO changes for tournament battles using the standard K=32 formula. The PRD_TOURNAMENT_SYSTEM.md (User Story 3.1) states "ELO changes apply normally," confirming this is intentional behavior.

**Resolution:** Tournament ELO changes are by design. The in-game guide `tournaments/rewards.md` has been updated with a dedicated "ELO Impact" section documenting that tournament battles affect ELO using K=32, and explaining the distinction from KotH (which does not affect ELO). The KotH vs tournament difference is intentional: tournaments are competitive seeded events where results should carry weight, while KotH is a casual format.

---

### ISSUE-02: KotH Missing from Architecture Documentation (Severity: Low) ✅ RESOLVED

**Finding:** `BATTLE_SIMULATION_ARCHITECTURE.md` documents 4 cron jobs (league, tournament, tag team, settlement) and 3 orchestrators (league, tournament, tag team). KotH is not mentioned despite being fully implemented.

**Resolution:** Architecture doc updated to show 5 cron jobs, 4 orchestrators, KotH in the system overview diagram, daily timeline, audit event types table, and file reference. KotH Integration section was already present from the unified simulator work.

---

### ISSUE-03: KotH Analysis Doc Says "FUTURE RELEASE" — But It's Implemented (Severity: Low) ✅ RESOLVED

**Finding:** `docs/analysis/KING_OF_THE_HILL_MODE.md` was marked as `📋 FUTURE RELEASE — Design notes only` with open questions about rewards, yield mechanics, and respawning. However, KotH is fully implemented.

**Resolution:** Status changed to "✅ Implemented." Added "Implementation Decisions" section resolving all 5 open questions. Dependencies updated to show all are satisfied.

---

### ISSUE-04: KotH Simplified Combat Engine — ✅ RESOLVED by Unified Simulator

**Finding:** The KotH simulation engine previously used a significantly simplified combat model compared to the shared 1v1 engine, missing 10+ combat mechanics.

**Resolution:** KotH now runs on the unified `simulateBattleMulti()` engine in `combatSimulator.ts`, which uses the full 7-phase tick loop with all 23 attributes active. KotH-specific behavior is injected via `GameModeConfig` strategy objects (`KothTargetPriorityStrategy`, `KothMovementIntentModifier`, `KothWinConditionEvaluator`) defined in `arena/kothEngine.ts`. All combat mechanics (counter-attacks, shield regen, offhand attacks, range bands, backstab/flanking, adaptation, pressure, servo strain, yield) are now active in KotH. The in-game guide `combat/battle-flow.md` has been updated to accurately describe what's shared and what's different.

---

### ISSUE-05: KotH `BattleParticipant.team` Semantic Mismatch (Severity: Low) ✅ RESOLVED

**Finding:** For KotH battles, the `team` field in `BattleParticipant` stored the robot's final placement (1-6) rather than a team number.

**Resolution:** Added a dedicated `placement` column (`Int?`, nullable) to `BattleParticipant`. KotH now writes `team: 1` (free-for-all) and `placement: 1-6`. The API reads `placement` for KotH display with fallback to `team` for old records. Migration: `20260318201357_add_placement_to_battle_participant`.

---

### ISSUE-06: Battle Table Denormalization Still Present (Severity: Low)

**Finding:** The `PRD_BATTLE_DATA_ARCHITECTURE.md` documents the migration from denormalized robot1/robot2 columns to the `BattleParticipant` table. However, the `Battle` table still contains:
- `robot1Id`, `robot2Id` (kept for relations)
- `robot1ELOBefore`, `robot2ELOBefore`, `robot1ELOAfter`, `robot2ELOAfter`, `eloChange`
- Tag team-specific columns: `team1ActiveRobotId`, `team1ReserveRobotId`, etc.
- Tag team damage/fame columns: `team1ActiveDamageDealt`, etc.

The PRD acknowledges these are "kept for backward compatibility and aggregate queries." Both the old columns AND the new `BattleParticipant` records are populated.

**Impact:** Dual-write means data could theoretically diverge. The tag team-specific columns on the Battle table are only used for tag team battles, creating sparse columns for other types.

**Recommendation:** This is a known tradeoff documented in the PRD. No immediate action needed, but consider a future migration to fully rely on `BattleParticipant`.

---

### ISSUE-07: KotH Rotating Zone Implementation vs. Guide (Severity: Low) ✅ RESOLVED

**Finding:** The audit originally flagged that the zone rotation code didn't enforce the 6-unit boundary and 8-unit minimum distance constraints documented in the in-game guide.

**Resolution:** The `kothEngine.ts` implementation in `generateNextZonePosition()` already enforces both constraints correctly: `maxDist = arenaRadius - 6 - zoneRadius` for boundary enforcement, and `distFromPrevious < 8` rejection loop for minimum distance. The audit's finding was based on the old `simulateKothBattle()` code which used `(arenaR * 0.3) + rand() * (arenaR * 0.3)`. That code has been replaced by the unified simulator + kothEngine. The guide is accurate.

---

### ISSUE-08: KotH Score Threshold Discrepancy (Severity: Low)

**Finding:** The in-game guide (`scoring-and-win-conditions.md`) states score thresholds of 30 (fixed) and 45 (rotating). The code uses `KOTH_MATCH_DEFAULTS` which should match, but the actual defaults are resolved in `processKothBattle()` via:
```typescript
const scoreThreshold = match.scoreThreshold ?? (match.rotatingZone
  ? KOTH_MATCH_DEFAULTS.rotatingZoneScoreThreshold
  : KOTH_MATCH_DEFAULTS.scoreThreshold);
```

**Verified:** `KOTH_MATCH_DEFAULTS` in `kothEngine.ts` confirms:
- `scoreThreshold: 30`, `rotatingZoneScoreThreshold: 45` ✅ matches guide
- `timeLimit: 150`, `rotatingZoneTimeLimit: 210` ✅ matches guide
- `killBonus: 5` ✅ matches guide
- `lastStandingDuration: 10` ✅ matches guide
- `zoneWarningTime: 5`, `zoneTransitionDuration: 3` ✅ matches guide

**Status:** No discrepancy. The `kothEngine.ts` defaults are authoritative and match the in-game guide. The old `simulateKothBattle()` code that hardcoded its own values has been replaced by the unified simulator + kothEngine.

---

### ISSUE-09: Tournament Streaming Revenue — PRD Updated (Severity: Medium) ✅ RESOLVED

**Finding:** The PRD_TOURNAMENT_SYSTEM.md stated "No Streaming Income" for tournaments, but the code awards streaming revenue.

**Resolution:** Decision: keep the code, update the PRD. `PRD_TOURNAMENT_SYSTEM.md` updated to document that tournament battles award streaming revenue using the same formula as league battles. The reward summary table row changed from "No streaming for tournaments" to "Same formula as league battles." Bye matches still correctly do not generate streaming income (no match to stream).

---

### ISSUE-10: PRD_BATTLE_RESULTS_PAGE.md — Not Implemented (Severity: Low)

**Finding:** `docs/prd_pages/PRD_BATTLE_RESULTS_PAGE.md` is marked as `❌ NOT IMPLEMENTED`. This page would show post-battle summaries with prestige/fame earned. Currently, players can only see battle results through the Battle History page and Battle Detail page, which do show rewards but not in a dedicated post-battle summary format.

**Impact:** Players don't get immediate feedback after battles. This is a UX gap, not a system correctness issue.

**Recommendation:** This is a known gap documented in the PRD. Prioritize based on player feedback.

---

### ISSUE-11: Tag Team Battle Time Limit Inconsistency (Severity: Low)

**Finding:** The tag team orchestrator defines `BATTLE_TIME_LIMIT = 300` (5 minutes), but each phase calls `simulateBattle()` which has its own `MAX_BATTLE_DURATION = 120s`. The total battle time is the sum of all phase durations, which could theoretically exceed 300s (e.g., 3 phases × 120s = 360s). The code checks `currentTime < maxTime` between phases but not within them.

**Impact:** A tag team battle could run slightly over 300s if the final phase's 120s simulation pushes past the limit. The `durationSeconds` is clamped to `Math.min(currentTime, maxTime)` in the return value, so the stored duration is correct, but the simulation itself may run longer.

**Recommendation:** Minor issue. The clamping handles it for storage purposes. Consider adding a remaining-time parameter to `simulateBattle()` for tag team phases if precise time limits matter.

---

## 12. Recommendations

### Priority 1 — KotH Engine Parity Decision (ISSUE-04) ✅ RESOLVED

This was the single most impactful finding. The KotH engine previously shared only the core damage pipeline with the 1v1 engine, stripping out 10+ combat mechanics.

**Resolution:** KotH now runs on the unified `simulateBattleMulti()` engine. All 23 robot attributes are meaningful in KotH. The old `simulateKothBattle()` function has been replaced by `simulateBattleMulti()` with KotH-specific `GameModeConfig` strategy objects. The in-game guide has been updated to accurately describe the unified engine with KotH-specific strategy differences.

### Priority 2 — Documentation Corrections ✅ RESOLVED

These are straightforward fixes with no code changes required:

1. ✅ **Updated `BATTLE_SIMULATION_ARCHITECTURE.md`** — Added KotH as the 5th cron job. Updated system overview diagram, daily timeline, orchestrator list (now 4), audit event types table, and file reference. (ISSUE-02)
2. ✅ **Updated `KING_OF_THE_HILL_MODE.md`** — Changed status from "FUTURE RELEASE" to "Implemented." Added "Implementation Decisions" section resolving all 5 open questions (zone visibility, scoring mechanic, yield interaction, respawning, rewards). (ISSUE-03)
3. ✅ **Updated in-game guide `combat/battle-flow.md`** — Replaced the misleading "KotH uses the same combat engine" statement with an accurate description of what's shared (full 7-phase tick loop, all 23 attributes, complete attack chain) and what's different (target priority, movement bias, win condition, zone scoring, anti-passive penalties, no ELO). (ISSUE-04)
4. ~~**Clarify tournament ELO policy**~~ ✅ RESOLVED — Added "ELO Impact" section to `tournaments/rewards.md` documenting that tournament battles affect ELO (K=32), with explanation of why this differs from KotH. (ISSUE-01)

### Priority 3 — Design Decisions Needed ✅ RESOLVED

5. ✅ **Tournament streaming revenue** — Decision: keep the code, update the PRD. `PRD_TOURNAMENT_SYSTEM.md` updated to document that tournament battles award streaming revenue using the same formula as league battles. Bye matches still do not generate streaming income. (ISSUE-09)
6. ✅ **KotH rotating zone constraints** — The `kothEngine.ts` implementation in `generateNextZonePosition()` already enforces both constraints: 6-unit boundary (`maxDist = arenaRadius - 6 - zoneRadius`) and 8-unit minimum distance from previous position (`distFromPrevious < 8`). The in-game guide is accurate. The audit's finding was based on the old `simulateKothBattle()` code, which has been replaced by the unified simulator + kothEngine. No changes needed. (ISSUE-07)
7. ✅ **KotH `BattleParticipant.team` semantic overload** — Added a dedicated `placement` column (nullable `Int?`) to `BattleParticipant`. KotH now writes `team: 1` (free-for-all, no team affiliation) and `placement: 1-6` (final placement). The `matches.ts` API reads `placement` for KotH display with fallback to `team` for backward compatibility with old records. Migration created: `20260318201357_add_placement_to_battle_participant`. `PRD_BATTLE_DATA_ARCHITECTURE.md` updated with KotH data structure, validation rules, and participant count. (ISSUE-05)

### Priority 4 — Code Quality ✅ RESOLVED

8. ✅ **Extract KotH orchestration** — Extracted all KotH code (`KothBattleExecutionSummary`, `calculateKothRewards`, `updateKothRobotStats`, `processKothBattle`, `executeScheduledKothBattles`) into `kothBattleOrchestrator.ts`. Renamed `battleOrchestrator.ts` → `leagueBattleOrchestrator.ts` for naming consistency with `tournamentBattleOrchestrator.ts` and `tagTeamBattleOrchestrator.ts`. All four orchestrators now have their own dedicated file. All imports updated across source and test files. (ISSUE-02, ISSUE-04)
9. **Tag team time limit enforcement** — Consider passing a `remainingTime` parameter to `simulateBattle()` for tag team phases so the 300s total limit is enforced within the simulation, not just between phases. Current clamping handles storage correctly but the simulation itself can overrun. (ISSUE-11)
10. ~~**Verify `KOTH_MATCH_DEFAULTS`**~~ — Verified ✅ (values match guide: 30/45 score, 150/210 time, 5 kill bonus, 10s last standing)

### Priority 5 — Orchestrator Architecture for Scalability ✅ RESOLVED

**Original finding:** 3 orchestrator files handling 4 match types with significant code duplication. Each orchestrator independently reimplemented the same 6-step post-combat pipeline (ELO, battle record, participants, stat updates, streaming revenue, audit logging). Adding a 5th or 6th match type would require copying 500+ lines.

**Resolution — Two-layer approach:**

1. **`battlePostCombat.ts`** — Shared post-combat helpers extracted from all 4 orchestrators:
   - `awardStreamingRevenueForParticipant()` — replaces 3-step calc+award+update pattern
   - `logBattleAuditEvent()` — replaces ~50-line `eventLogger.logEvent` blocks with type-specific extras
   - `updateRobotCombatStats()` — replaces per-orchestrator `prisma.robot.update` blocks (wins/losses/kills/damage/ELO/HP/LP/fame)
   - `awardCreditsToUser()`, `awardPrestigeToUser()`, `awardFameToRobot()` — simple currency increments

2. **`battleStrategy.ts`** — Strategy Pattern interface + `BattleProcessor` class:
   - `BattleStrategy<TMatch>` interface with config flags (`affectsELO`, `affectsLeaguePoints`, `allowsDraws`, `hasStreamingRevenue`, `hasByeMatches`) and pipeline methods (`loadParticipants`, `simulate`, `calculateRewards`, `buildBattleLog`, etc.)
   - `BattleProcessor` class with shared 11-step pipeline that new match types plug into

**Migration approach (pragmatic):**
- Existing orchestrators (league, tournament, tag team, KotH) refactored to use `battlePostCombat.ts` helpers directly within their existing `processBattle()` flows. Their battle-tested flows are preserved — no risky rewrites.
- New match types use `BattleProcessor.process()` instead of writing a full orchestrator from scratch (~100-150 lines of strategy implementation vs. 500+ lines of copy-paste).

**Files created:** `battlePostCombat.ts`, `battleStrategy.ts`
**Files refactored:** All 4 orchestrators now use shared helpers (streaming, audit, stats, credits/prestige/fame).

---

*End of audit.*
