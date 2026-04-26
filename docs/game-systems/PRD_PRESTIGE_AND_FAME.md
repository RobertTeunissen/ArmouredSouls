# Product Requirements Document: Prestige and Fame System

**Last Updated**: April 2, 2026  
**Status**: ✅ Implemented (core earning + benefits active)  
**Owner**: Robert Teunissen  
**Epic**: Economy System — Reputation

---

## Version History
- v2.0 (April 2, 2026) — Consolidated with `PRD_FAME_SYSTEM.md` (deleted). Full audit against codebase. Corrected prestige bonus tiers to match actual code (+10%/+20%/+30%/+40%/+50%, not +5%/+10%/+15%/+20%). Marked prestige gates as ✅ implemented (they are enforced in facility routes). Removed ~800 lines of aspirational content (milestone tables, API endpoints, UI mockups, implementation phases) that aren't built. Added KotH prestige/fame section. Updated file paths for service consolidation.
- v1.0 (February 3, 2026) — Initial PRD

---

## Overview

Prestige and Fame are dual reputation systems that form the backbone of player progression:

- **Prestige** (stable-level): Permanent reputation that unlocks facilities, tournaments, and boosts income. Earned from battle wins. Never spent.
- **Fame** (robot-level): Individual robot reputation that affects streaming revenue. Earned from individual robot victories with performance bonuses.

Both are awarded automatically by the battle orchestrators after each battle via shared helpers in `battlePostCombat.ts`.

---

## Prestige System (Stable-Level)

### Earning Prestige

Prestige is awarded to the winning player's User record. No prestige for draws, losses, or bye matches.

#### League Battles

| League | Prestige per Win |
|---|---|
| Bronze | +5 |
| Silver | +10 |
| Gold | +20 |
| Platinum | +30 |
| Diamond | +50 |
| Champion | +75 |

Tournament battles use the same league-based prestige values, calculated via `tournamentRewards.ts`.

#### King of the Hill

KotH prestige is flat (not league-dependent):

| Placement | Prestige |
|---|---|
| 1st | +15 |
| 2nd | +8 |
| 3rd | +3 |
| 4th–6th | +0 |

Zone dominance bonus: if uncontested zone score > 75% of total score, prestige is multiplied by 1.25×.

### Prestige Benefits

#### Battle Winnings Bonus

Applied via `getPrestigeMultiplier()` in `utils/economyCalculations.ts`:

| Prestige | Bonus |
|---|---|
| 1,000+ | +10% |
| 5,000+ | +20% |
| 10,000+ | +30% |
| 25,000+ | +40% |
| 50,000+ | +50% |

#### Merchandising Income Scaling

```
merchandising_income = (merchandising_hub_level × ₡5,000) × (1 + prestige / 10,000)
```

#### Facility Unlock Gates (✅ Enforced)

Prestige requirements are checked and enforced in `routes/facility.ts` when upgrading. If the player doesn't have enough prestige, the upgrade is rejected with a 403 error.

Prestige thresholds are defined per facility in `config/facilities.ts`. See [STABLE_SYSTEM.md](STABLE_SYSTEM.md) for the complete list of prestige requirements per facility per level.

### Prestige Rank Titles

| Prestige | Rank |
|---|---|
| 0–999 | Novice |
| 1,000–4,999 | Established |
| 5,000–9,999 | Veteran |
| 10,000–24,999 | Elite |
| 25,000–49,999 | Champion |
| 50,000+ | Legendary |

Displayed on the prestige leaderboard (`/leaderboards/prestige`).

---

## Fame System (Robot-Level)

### Earning Fame

Fame is awarded to the winning Robot record. No fame for draws, losses, or bye matches.

#### League Battles

| League | Base Fame |
|---|---|
| Bronze | +2 |
| Silver | +5 |
| Gold | +10 |
| Platinum | +15 |
| Diamond | +25 |
| Champion | +40 |

#### Performance Multipliers

Applied on top of base fame for league and tournament wins:

| Performance | Condition | Multiplier |
|---|---|---|
| Perfect Victory | HP = 100% (no damage taken) | 2.0× |
| Dominating Victory | HP > 80% | 1.5× |
| Comeback Victory | HP < 20% | 1.25× |
| Standard Victory | 20% ≤ HP ≤ 80% | 1.0× |

Result is rounded to nearest integer via `Math.round()`.

#### King of the Hill

KotH fame is flat (not league-dependent). Performance multiplier applies only to 1st place:

| Placement | Base Fame |
|---|---|
| 1st | +8 (with performance multiplier) |
| 2nd | +5 |
| 3rd | +3 |
| 4th–6th | +0 |

Zone dominance bonus (1.25×) applies to fame as well.

### Fame Benefits

#### Streaming Revenue

Fame feeds into the streaming revenue formula (see [STABLE_SYSTEM.md](STABLE_SYSTEM.md) for the Streaming Studio facility):

```
streaming_revenue = 1000 × battle_multiplier × fame_multiplier × studio_multiplier

Where:
  battle_multiplier = 1 + (total_battles / 1000)
  fame_multiplier = 1 + (robot_fame / 5000)
  studio_multiplier = 1 + (streaming_studio_level × 1.0)
```

Higher fame directly increases per-battle streaming revenue for that robot.

### Fame Tiers

| Tier | Fame Required |
|---|---|
| Unknown | 0–99 |
| Known | 100–499 |
| Famous | 500–999 |
| Renowned | 1,000–2,499 |
| Legendary | 2,500–4,999 |
| Mythical | 5,000+ |

Displayed on the fame leaderboard (`/leaderboards/fame`).

---

## Implementation Files

All paths relative to `app/backend/src/`.

| File | Responsibility |
|---|---|
| `services/league/leagueBattleOrchestrator.ts` | `calculatePrestigeForBattle()`, `calculateFameForBattle()`, `_getFameTier()` |
| `services/tournament/tournamentBattleOrchestrator.ts` | Tournament prestige/fame via `tournamentRewards.ts` |
| `services/tag-team/tagTeamBattleOrchestrator.ts` | Tag team prestige/fame (same league-based values) |
| `services/koth/kothBattleOrchestrator.ts` | `calculateKothRewards()` — placement-based prestige/fame |
| `services/battle/battlePostCombat.ts` | `awardPrestigeToUser()`, `awardFameToRobot()`, `logBattleAuditEvent()` |
| `services/economy/streamingRevenueService.ts` | `calculateStreamingRevenue()` — uses fame in multiplier |
| `utils/economyCalculations.ts` | `getPrestigeMultiplier()`, `calculateBattleWinnings()`, merchandising scaling |
| `config/facilities.ts` | `prestigeRequirements` arrays per facility |
| `routes/facility.ts` | Prestige gate enforcement on upgrade |
| `routes/leaderboards.ts` | Prestige and fame leaderboard endpoints |

---

## Frontend

| Page | What it shows |
|---|---|
| `DashboardPage.tsx` | Current prestige value |
| `LeaderboardsPrestigePage.tsx` | Prestige rankings with rank titles, income bonuses |
| `LeaderboardsFamePage.tsx` | Robot fame rankings with tier colors, league filters |
| `PerformanceStats.tsx` | Robot fame on detail page |
| `FacilitiesPage.tsx` | Prestige requirements per facility level, lock/unlock state |

---

## What's Not Implemented

These are documented design ideas, not current features:

- ~~Milestone achievement system (ELO milestones, win count milestones, streak bonuses)~~ → **✅ Implemented** as the Achievement System ([PRD_ACHIEVEMENT_SYSTEM.md](PRD_ACHIEVEMENT_SYSTEM.md), Spec #27)
- PrestigeMilestone / FameMilestone database tables → Replaced by the `UserAchievement` table in the Achievement System
- Fame affecting matchmaking quality
- Fame-based cosmetic unlocks (titles, paint jobs, animations)
- Post-battle reputation summary in UI
- Prestige progress bar toward next facility unlock
- Fame decay for inactive robots
- Tournament-specific prestige tiers (local/regional/national/world)

---

## Related Documentation

- [STABLE_SYSTEM.md](STABLE_SYSTEM.md) — Facility prestige requirements, merchandising/streaming formulas, operating costs
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) — `User.prestige` and `Robot.fame` fields
- [PRD_ECONOMY_SYSTEM.md](PRD_ECONOMY_SYSTEM.md) — Credit rewards, income streams
- [BATTLE_SIMULATION_ARCHITECTURE.md](BATTLE_SIMULATION_ARCHITECTURE.md) — How orchestrators award prestige/fame post-combat
