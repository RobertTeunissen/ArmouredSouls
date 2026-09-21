# Product Requirements Document: League System

**Last Updated**: September 12, 2026
**Status**: ✅ Implemented  
**Owner**: Robert Teunissen  
**Epic**: League Progression System  
**Version**: 2.3

---

## Version History
- v2.3 (September 12, 2026) — Unified `league_1v1`, `league_2v2`, `league_3v3`, and `tag_team` behind one policy and planner. Zones now use complete instance population and fixed positions before LP/residency filters; standings previews and history reporting use the same mode-aware results.
- v2.2 (September 1, 2026) — Spec #50 shared Bye_Card display, durable bye markers, expected/awarded reward display, and all-mode Match/Battle treatment.
- v2.1 (April 18, 2026) — Per-tier LP promotion thresholds: Bronze 25, Silver 50, Gold 75, Platinum 100, Diamond 125. Replaces flat 25 LP threshold for all tiers.
- v2.0 (April 2, 2026) — Consolidated from three separate documents (`LEAGUE_SYSTEM_IMPLEMENTATION_GUIDE.md`, `PRD_LEAGUE_PROMOTION.md`, `PRD_LEAGUE_REBALANCING.md`) and the LP matchmaking addendum (`PRD_MATCHMAKING_LP_UPDATE.md`). Removed proposed-but-not-implemented features (PromotionHistory model, Team2v2 model, instance change tracking, UI mockups for non-existent pages). Updated file paths to reflect backend service consolidation.
- v1.1 (February 22, 2026) — Documentation corrections to match implementation
- v1.0 (February 10, 2026) — Initial drafts of promotion and rebalancing PRDs

---

## Executive Summary

The league system provides competitive progression through six tiers with instance-based management. The four head-to-head modes—1v1 League, 2v2 League, 3v3 League, and Tag Team—share one policy, planner, and execution pipeline. Every mode uses the same 100-entity instance capacity, LP thresholds, 10% zones, five-cycle residency rule, and empty-destination cohort rule.

Promotion and demotion zones are positional. Their size is calculated from the complete population of each instance; LP and residency requirements are then applied only inside those fixed positions. An ineligible entity never causes a lower-ranked entity outside the zone to backfill it.

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

1. The entity occupies one of the fixed top 10% positions in its specific instance
2. League Points are at or above the source-tier threshold
3. The entity has completed ≥5 cycles in its current tier

Zone size is `floor(total instance population × 0.10)`. The planner creates one canonical ranking sorted by LP descending, then entity ID ascending as a deterministic tie-break. Promotion takes the first positions from that ranking, then applies LP and residency without backfill.

#### Per-Tier LP Thresholds

| Current Tier | Promotion To | LP Required |
|---|---|---|
| Bronze | Silver | ≥25 |
| Silver | Gold | ≥50 |
| Gold | Platinum | ≥75 |
| Platinum | Diamond | ≥100 |
| Diamond | Champion | ≥125 |

### Demotion Requirements (both must be met)

1. The entity occupies one of the fixed bottom 10% positions in its specific instance
2. The entity has completed ≥5 cycles in its current tier

The planner takes the demotion zone from the tail of that same canonical LP-descending, entity-ID-ascending ranking and reverses it, so the lowest-ranked entity appears first. Residency is applied inside the fixed bottom zone without backfill. Because promotion and demotion come from opposite ends of one list, tied entities cannot occupy both zones.

### Key Rules

- The policy applies identically to `league_1v1`, `league_2v2`, `league_3v3`, and `tag_team`
- LP is retained across tier changes (no reset to 0)
- `cyclesInTier` resets to 0 on promotion or demotion
- Newly moved entities therefore receive five cycles of movement protection
- Bronze cannot demote and Champion cannot promote
- An instance needs at least 10 total entities before either zone is created
- Promotions and demotions are planned per instance
- If the destination tier is empty, all source-instance candidates are combined; at least 3 are required to open it
- A blocked empty-tier cohort is shown as blocked in the standings preview and is not executed

### Shared Head-to-Head Implementation

The four modes call `planLeagueInstanceRebalancing` and `planLeagueTierRebalancing` with `HEAD_TO_HEAD_LEAGUE_RULES`. Mode adapters handle persistence, locks, history, and mode-specific achievements only; they do not redefine promotion arithmetic.

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

When an instance has an odd number of robots, scheduling may use a synthetic "Bye Robot" sentinel (ELO 1000) so a `scheduled_matches_v2` row can name two sides. The sentinel is a scheduling artefact only: it is never simulated, never used as a player-facing opponent, and never included as a real participant in a Bye_Card.

**A bye is never simulated (Spec #49).** No combat runs, so the real robot takes **no damage at all** — the "reduced damage (8% HP loss)" this section previously described no longer occurs, and a bye can never produce a repair bill. A drawn bye is structurally impossible rather than corrected after the fact.

**What a bye pays.** The participation reward for the tier (20% of the base win reward), multiplied by the number of robots on the real side — so ×1 for `league_1v1`, ×2 for `league_2v2` and Tag Team, ×3 for `league_3v3`. Plus the usual LP and ELO for a win. It pays **no prestige, no fame and no streaming revenue**. The reward declaration remains in `app/backend/src/utils/byeRewards.ts`; this display note does not create another formula.

**Byes exist in all nine modes, not just the odd-robot case.** The same rule covers a `koth` or `grand_melee` tier instance that falls below its minimum field size, and a non-power-of-two tournament bracket. See `docs/architecture/PRD_BATTLE_DATA_ARCHITECTURE.md` § Bye Battle Records.

### Shared Bye_Event display

League byes use the same player-facing Bye_Card as tournament, tag-team, and Placement_Mode byes. The nine covered modes are `league_1v1`, `tournament_1v1`, `league_2v2`, `tournament_2v2`, `league_3v3`, `tournament_3v3`, `tag_team`, `koth`, and `grand_melee`.

A queued league bye appears in Upcoming Matches with the real robot, team, or FFA participant, `isByeMatch: true`, and an expected Bye_Reward_Display. It is not a zero-credit result and it does not expose the sentinel as an opponent. After the battle slot resolves the walkover, the record appears in Recent Battles with the awarded participant credits. History reads the durable `scheduled_matches_v2.is_bye_match` marker rather than relying on the retained battle log.

The shared card shows BYE, the mode, the real subject, scheduled/resolution time, neutral no-opponent copy, and expected or awarded credits. It never claims that a league bye was fought, simulated, drawn, or damaging. These display rules do not change league matchmaking, reward arithmetic, or the existing Upcoming Matches and Recent Battles headings.

---

## Instance Rebalancing

### Execution

After each promotion/demotion run, every tier is redistributed from its complete post-movement population. The target instance count is `ceil(totalEntities / 100)` for all four head-to-head modes, and LP-descending rows are assigned round-robin. This both enforces the 100-entity capacity and corrects material population imbalances; redistribution is not overflow-only.

### Algorithm

1. Collect all robots in the tier
2. Sort by LP (desc), then ELO (desc)
3. Calculate target instance count: `ceil(totalRobots / 100)`
4. Distribute round-robin across instances

Round-robin ensures each instance gets a mix of high, medium, and low LP robots, maintaining competitive balance.

### When It Runs

The cycle scheduler calls the shared league executor after each promotion/demotion cycle. It snapshots every tier before movement, executes those fixed plans, then redistributes every tier's post-movement population.

### What's Preserved

- League Points: unchanged
- ELO: unchanged
- Robot stats: unchanged
- Only `leagueId` changes (e.g., `bronze_1` → `bronze_2`)

---

## Configuration Constants

### Promotion/Demotion (`services/league/league-rules.ts`)

```typescript
export const HEAD_TO_HEAD_LEAGUE_RULES = {
  tiers: LEAGUE_TIERS,
  promotionPercentage: 0.10,
  demotionPercentage: 0.10,
  minCyclesForRebalancing: 5,
  minEntitiesForRebalancing: 10,
  minCohortForNewTier: 3,
};
```

Per-tier LP thresholds remain declared once in `services/league/leaguePromotionThresholds.ts`.

### Instance Management (`services/league/leagueInstanceService.ts`)

```typescript
export const MAX_ROBOTS_PER_INSTANCE = 100;
export const MAX_TEAMS_PER_INSTANCE = 100;
export const REBALANCE_THRESHOLD = 20;
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
| `services/league/league-rules.ts` | Canonical rules shared by all four head-to-head modes |
| `services/league/league-rebalancing-planner.ts` | Pure fixed-zone, no-backfill, and cohort planner |
| `services/league/league-rebalancing-preview.ts` | Standings preview built from the execution planner |
| `services/league/leagueEngine.ts` | Shared execution pipeline for all mode adapters |
| `services/league/leagueRebalancingService.ts` | 1v1 adapter and orchestration |
| `services/team-battle/teamBattleAdapter.ts` | 2v2/3v3 persistence adapter |
| `services/tag-team/tagTeamLeagueRebalancingService.ts` | Tag Team adapter and orchestration |
| `services/league/leagueInstanceService.ts` | Canonical 100-entity capacity and instance management |
| `services/analytics/matchmakingService.ts` | LP-primary matchmaking, robot pairing, scheduled match creation |
| `services/tag-team/tagTeamMatchmakingService.ts` | Tag team matchmaking |

---

## Edge Cases

### Promotion/Demotion

- Robot promoted with high LP (e.g., 45): Retains LP, but still needs 5 cycles before next promotion. Note: higher tiers require more LP (e.g., 50 for Silver→Gold)
- Robot demoted with low LP (e.g., 2): Retains LP, lower tier competition should be easier
- Yo-yo prevention: `cyclesInCurrentLeague` resets to 0 on any tier change, requiring 5 cycles before the next move
- Champion tier: No promotions possible. Demotions still apply.
- Bronze tier: No demotions possible. Promotions still apply.

### Rebalancing

- All instances overcrowded (e.g., 3 instances at 105 each = 315 total): Rebalances into `ceil(315/100) = 4` instances
- Single entity over capacity (101): Rebalances into two instances
- Uneven populations below capacity (e.g., 95 and 45): Rebalances the complete 140-entity tier into two 70-entity instances

### Matchmaking

- Identical LP+ELO scores: Robot ID used as deterministic tiebreaker
- No valid opponent within fallback range: Matched with bye robot
- Robot in scheduled match already: Excluded from matchmaking queue

---

## Future Enhancements (Not Implemented)

These are design ideas documented for future consideration:

- Instance consolidation for underpopulated instances (<20 entities)
- Promotion/demotion notifications

---

## Related Documentation

- [PRD_MATCHMAKING.md](PRD_MATCHMAKING.md) — Core matchmaking system and scheduling
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) — Robot, TagTeam, ScheduledLeagueMatch models
- [BATTLE_SIMULATION_ARCHITECTURE.md](BATTLE_SIMULATION_ARCHITECTURE.md) — Cycle scheduler and battle orchestration
- [PRD_ECONOMY_SYSTEM.md](PRD_ECONOMY_SYSTEM.md) — League-tier credit rewards
- [LEAGUE_SYSTEM_CHANGES_SUMMARY.md](../implementation_notes/LEAGUE_SYSTEM_CHANGES_SUMMARY.md) — Historical change log from February 2026

## Season Reset (Spec #45)

**All competitive standings reset at each Season_Rollover.** Every `standings` row is deleted, so LP, tier, league instance, cycles-in-tier, streaks, and per-mode win/loss records start fresh. Robot ELO resets with the robots themselves.

`league_history` is purged once the archive is written, so promotion and demotion history does not span seasons.

Before the purge, the top `ACCOLADE_DEPTH` entities per mode, tier, and league instance are captured into `season_standing_snapshots` as denormalized text — including system-generated stables, so each tier's champion stays identifiable after those stables are deleted. Per-robot final standings are recorded in `robot_season_archives`, with `Instance_Rank` computed against the full field.
