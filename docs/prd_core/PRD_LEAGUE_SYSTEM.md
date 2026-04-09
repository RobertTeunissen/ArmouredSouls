# Product Requirements Document: League System

**Last Updated**: April 2, 2026  
**Status**: ✅ Implemented  
**Owner**: Robert Teunissen  
**Epic**: League Progression System  
**Version**: 2.0

---

## Version History
- v2.0 (April 2, 2026) — Consolidated from three separate documents (`LEAGUE_SYSTEM_IMPLEMENTATION_GUIDE.md`, `PRD_LEAGUE_PROMOTION.md`, `PRD_LEAGUE_REBALANCING.md`) and the LP matchmaking addendum (`PRD_MATCHMAKING_LP_UPDATE.md`). Removed proposed-but-not-implemented features (PromotionHistory model, Team2v2 model, instance change tracking, UI mockups for non-existent pages). Updated file paths to reflect backend service consolidation.
- v1.1 (February 22, 2026) — Documentation corrections to match implementation
- v1.0 (February 10, 2026) — Initial drafts of promotion and rebalancing PRDs

---

## Executive Summary

The league system provides competitive progression through 6 tiers with instance-based management. Robots compete within league instances (max 100 per instance), earn League Points from matches, and are promoted or demoted based on performance within their specific instance.

The system is intentionally simple: instance-based evaluation, LP retention across tier changes, and automatic demotion protection via a 5-cycle eligibility requirement.

---

## League Structure

### 6 Tiers

Bronze → Silver → Gold → Platinum → Diamond → Champion

Each tier can have multiple instances (e.g., `bronze_1`, `bronze_2`, `bronze_3`) with a maximum of 100 robots per instance.

### League Points

| Result | LP Change |
|---|---|
| Win | +3 |
| Draw | +1 |
| Loss | -1 |

LP is the primary progression metric. It determines promotion eligibility, matchmaking priority, and standings rank.

### ELO Rating

ELO (K=32, starting 1200) is used for matchmaking quality and seeding, not for promotion/demotion decisions. ELO is preserved across tier changes.

---

## Promotion & Demotion

### Promotion Requirements (all three must be met)

1. Top 10% of robots within the specific instance (not the entire tier)
2. ≥25 League Points
3. ≥5 cycles in current tier

### Demotion Requirements (both must be met)

1. Bottom 10% of robots within the specific instance
2. ≥5 cycles in current tier

### Key Rules

- LP is retained across tier changes (no reset to 0)
- `cyclesInCurrentLeague` resets to 0 on promotion or demotion
- This provides automatic demotion protection: newly promoted robots get 5 cycles to adapt
- Cannot demote from Bronze (lowest tier) or promote from Champion (highest tier)
- Minimum 10 eligible robots in an instance for promotion/demotion to trigger
- Promotions and demotions are processed per-instance, not per-tier

### Tag Team Leagues

Tag team leagues follow identical rules using the `TagTeam` model with `tagTeamLeague`, `tagTeamLeagueId`, and `tagTeamLeaguePoints` fields. The tag team rebalancing service mirrors the 1v1 service.

---

## Matchmaking

### LP-Primary Matching

Matchmaking prioritizes League Points proximity, with ELO as a secondary quality check:

| Criterion | Ideal Range | Fallback Range | Weight |
|---|---|---|---|
| LP difference (primary) | ±10 | ±20 | High (×1 ideal, ×5 fallback, ×20 outside) |
| ELO difference (secondary) | ±150 | ±300 | Low (×0.1 ideal, ×0.5 fallback, reject outside) |

Additional scoring penalties:
- Recent opponent (last 5 battles): +200 score penalty
- Same stable: +500 score penalty

Matchmaking runs within each instance. Robots are sorted by LP (desc), then ELO (desc). The scoring algorithm pairs robots with the lowest combined penalty score.

### Bye Robot

When an instance has an odd number of robots, a synthetic "Bye Robot" (ELO 1000) is created for the unmatched robot. Bye battles use reduced damage (8% HP loss) and a fixed 15-second duration.

---

## Instance Rebalancing

### Trigger

Rebalancing only occurs when any instance in a tier exceeds 100 robots. It does not trigger for population imbalances below that threshold — natural placement (promoted/demoted robots go to the instance with the most free spots) keeps instances balanced without forced redistribution.

### Algorithm

1. Collect all robots in the tier
2. Sort by LP (desc), then ELO (desc)
3. Calculate target instance count: `ceil(totalRobots / 100)`
4. Distribute round-robin across instances

Round-robin ensures each instance gets a mix of high, medium, and low LP robots, maintaining competitive balance.

### When It Runs

Rebalancing is checked after each promotion/demotion cycle. The cycle scheduler calls `rebalanceLeagues()` which iterates through all tiers and checks if any instance exceeds the threshold.

### What's Preserved

- League Points: unchanged
- ELO: unchanged
- Robot stats: unchanged
- Only `leagueId` changes (e.g., `bronze_1` → `bronze_2`)

---

## Configuration Constants

### Promotion/Demotion (`services/league/leagueRebalancingService.ts`)

```typescript
const MIN_LEAGUE_POINTS_FOR_PROMOTION = 25;
const PROMOTION_PERCENTAGE = 0.10;           // Top 10%
const DEMOTION_PERCENTAGE = 0.10;            // Bottom 10%
const MIN_CYCLES_IN_LEAGUE_FOR_REBALANCING = 5;
const MIN_ROBOTS_FOR_REBALANCING = 10;
```

### Instance Management (`services/league/leagueInstanceService.ts`)

```typescript
export const MAX_ROBOTS_PER_INSTANCE = 100;
export const REBALANCE_THRESHOLD = 20;  // Historical, not actively used
export const LEAGUE_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'champion'] as const;
```

### Matchmaking (`services/analytics/matchmakingService.ts`)

```typescript
export const LP_MATCH_IDEAL = 10;
export const LP_MATCH_FALLBACK = 20;
export const ELO_MATCH_IDEAL = 150;
export const ELO_MATCH_FALLBACK = 300;
export const RECENT_OPPONENT_LIMIT = 5;
```

---

## Implementation Files

All paths relative to `app/backend/src/`.

| File | Responsibility |
|---|---|
| `services/league/leagueRebalancingService.ts` | 1v1 promotion/demotion logic, tier rebalancing orchestration |
| `services/league/leagueInstanceService.ts` | Instance CRUD, population stats, round-robin rebalancing |
| `services/tag-team/tagTeamLeagueRebalancingService.ts` | Tag team promotion/demotion (mirrors 1v1 logic) |
| `services/tag-team/tagTeamLeagueInstanceService.ts` | Tag team instance management |
| `services/analytics/matchmakingService.ts` | LP-primary matchmaking, robot pairing, scheduled match creation |
| `services/tag-team/tagTeamMatchmakingService.ts` | Tag team matchmaking |

---

## Edge Cases

### Promotion/Demotion

- Robot promoted with high LP (e.g., 45): Retains LP, but still needs 5 cycles before next promotion
- Robot demoted with low LP (e.g., 2): Retains LP, lower tier competition should be easier
- Yo-yo prevention: `cyclesInCurrentLeague` resets to 0 on any tier change, requiring 5 cycles before the next move
- Champion tier: No promotions possible. Demotions still apply.
- Bronze tier: No demotions possible. Promotions still apply.

### Rebalancing

- All instances overcrowded (e.g., 3 instances at 105 each = 315 total): Rebalances into `ceil(315/100) = 4` instances
- Single robot over threshold (101): Still triggers rebalancing
- Uneven populations below threshold (e.g., 95 and 45): No rebalancing — natural placement handles it

### Matchmaking

- Identical LP+ELO scores: Robot ID used as deterministic tiebreaker
- No valid opponent within fallback range: Matched with bye robot
- Robot in scheduled match already: Excluded from matchmaking queue

---

## Future Enhancements (Not Implemented)

These are design ideas documented for future consideration:

- Promotion/demotion history tracking (PromotionHistory model)
- Instance consolidation for underpopulated instances (<20 robots)
- UI promotion zone indicators with LP progress bars
- Promotion/demotion notifications
- Dynamic LP thresholds based on tier difficulty

---

## Related Documentation

- [PRD_MATCHMAKING.md](PRD_MATCHMAKING.md) — Core matchmaking system and scheduling
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) — Robot, TagTeam, ScheduledLeagueMatch models
- [BATTLE_SIMULATION_ARCHITECTURE.md](BATTLE_SIMULATION_ARCHITECTURE.md) — Cycle scheduler and battle orchestration
- [PRD_ECONOMY_SYSTEM.md](PRD_ECONOMY_SYSTEM.md) — League-tier credit rewards
- [LEAGUE_SYSTEM_CHANGES_SUMMARY.md](../implementation_notes/LEAGUE_SYSTEM_CHANGES_SUMMARY.md) — Historical change log from February 2026
