# Spec #40 Legacy Column Drop — Implementation Plan

> **⚠️ Superseded by [Spec #43](/.kiro/specs/to-do/43-legacy-column-drop/).** This document was an initial draft. The formal spec contains the authoritative requirements, design, and task breakdown.

---


## Overview

The unified tables (`standings`, `scheduled_matches_v2`, `battle_participants`) are fully operational. This plan addresses the remaining cleanup: dropping dead scheduling tables, migrating remaining read paths from legacy columns to unified tables, and eventually removing the legacy columns themselves.

**Scope exclusions:**
- Phase 4 (tournament migration to `scheduled_matches_v2`) — separate spec-sized effort, not covered here
- Phase 3.13 (Battle `robot1Id`/`robot2Id` removal) — highest risk, deferred until all other phases complete

---

## Phase 1: Drop Dead Scheduling Tables (Low Risk, ~2 hours)

These tables have **zero Prisma reads and zero writes** in production. Only type imports remain.

### 1.1 — Drop `ScheduledLeagueMatch` table

**Steps:**
1. Remove the `ScheduledLeagueMatch` model from `prisma/schema.prisma`
2. Remove `scheduledMatchesAsRobot1` and `scheduledMatchesAsRobot2` relations from the `Robot` model
3. Remove `scheduledMatch` relation from the `Battle` model
4. Fix any TypeScript compilation errors from removed types
5. Run `pnpm exec prisma migrate dev --name drop-scheduled-league-match`
6. Run `pnpm exec prisma generate`

**Risk:** None — zero production usage confirmed by audit.

### 1.2 — Drop `ScheduledKothMatch` + `ScheduledKothMatchParticipant` tables

**Steps:**
1. Remove both models from `prisma/schema.prisma`
2. Remove `kothMatchParticipations` relation from `Robot` model
3. Remove `scheduledKothMatch` relation from `Battle` model
4. Clean up any type references in `matchHistoryService.ts` (import-only, no runtime usage)
5. Run migration

**Risk:** None — zero production usage.

### 1.3 — Drop `ScheduledTeamBattleMatch` table

**Steps:**
1. Remove the model from `prisma/schema.prisma`
2. Remove `matchesAsTeam1` and `matchesAsTeam2` relations from `TeamBattle` model
3. Clean up type imports in:
   - `tagTeamBattleRecord.ts`
   - `tagTeamResultUpdater.ts`
   - `matchHistoryService.ts`
   - `teamBattleOrchestrator.ts`
4. Run migration

**Risk:** None — zero production usage.

### Phase 1 Verification
- `pnpm exec prisma generate` succeeds
- `pnpm run build` compiles cleanly
- `pnpm test` passes
- Manual smoke test: schedule + execute a league match, team match, KotH match

---

## Phase 2: Read Path Migration (Medium Risk, ~1 day)

All these columns have **zero writes** — standings is already the write target. We're migrating the remaining consumers that still *read* from the legacy columns.

### 2.1 — `kothAnalyticsService.ts` → Read from `Standing` table

**Current:** Reads 8 KotH columns directly from `prisma.robot.findUnique()`  
**Target:** Read from `prisma.standing.findUnique({ where: { entityType_entityId_mode: { entityType: 'robot', entityId: robotId, mode: 'koth' } } })`

**Mapping:**
| Legacy column | Standing field |
|---------------|---------------|
| `kothMatches` | `totalMatches` |
| `kothWins` | `wins` |
| `kothTotalZoneScore` | `totalZoneScore` |
| `kothTotalZoneTime` | `totalZoneTime` |
| `kothKills` | `totalKills` |
| `kothBestPlacement` | `bestPlacement` |
| `kothCurrentWinStreak` | `currentWinStreak` |
| `kothBestWinStreak` | `bestWinStreak` |

**Implementation:**
```typescript
export async function getKothPerformance(robotId: number): Promise<KothPerformance | null> {
  const [robot, standing] = await Promise.all([
    prisma.robot.findUnique({ where: { id: robotId }, select: { id: true, name: true } }),
    prisma.standing.findUnique({
      where: { entityType_entityId_mode: { entityType: 'robot', entityId: robotId, mode: 'koth' } },
    }),
  ]);

  if (!robot || !standing || (standing.totalMatches ?? 0) === 0) return null;

  const totalMatches = standing.totalMatches ?? 0;
  return {
    robotId: robot.id,
    robotName: robot.name,
    kothMatches: totalMatches,
    kothWins: standing.wins,
    podiumRate: totalMatches > 0 ? Number(((standing.wins / totalMatches) * 100).toFixed(1)) : 0,
    avgZoneScore: totalMatches > 0 ? Number(((standing.totalZoneScore ?? 0) / totalMatches).toFixed(1)) : 0,
    kothTotalZoneTime: standing.totalZoneTime ?? 0,
    kothKills: standing.totalKills ?? 0,
    kothBestPlacement: standing.bestPlacement,
    kothCurrentWinStreak: standing.currentWinStreak,
    kothBestWinStreak: standing.bestWinStreak,
  };
}
```

### 2.2 — `records-queries.ts` `fetchKothRecords()` → Read from `Standing` table

**Current:** Queries `prisma.robot.findMany({ where: { kothMatches: { gt: 0 } }, orderBy: { kothWins: 'desc' } })`  
**Target:** Join standings with robots for ordering + data retrieval.

**Strategy:** Use raw SQL or a two-step approach:
1. Query `standings` where `mode = 'koth'` with appropriate orderBy
2. Join with `robots` table for robot name + user info

**Implementation approach:**
```typescript
// For "most KotH wins":
const standings = await prisma.standing.findMany({
  where: { mode: 'koth', totalMatches: { gt: 0 } },
  orderBy: { wins: 'desc' },
  take: 10,
});
const robotIds = standings.map(s => s.entityId);
const robots = await prisma.robot.findMany({
  where: { id: { in: robotIds } },
  include: { user: { select: userSelect } },
});
// Merge by entityId
```

This pattern repeats for each KotH leaderboard category (wins, zone score, kills, streak, etc.).

### 2.3 — `records-queries.ts` `fetchCareerRecords()` / `fetchEconomicRecords()` — `currentLeague` in raw SQL and response

**Current:** Raw SQL references `r."current_league"` and mapped result uses `robot.currentLeague`  
**Target:** Join with standings or accept that `currentLeague` on the Robot model stays as a **denormalized read cache** until Phase 5.

**Decision point:** These are read-only display fields (used in Hall of Records and high-score lists). Two options:
- **Option A (recommended for now):** Keep reading from robot for these display contexts. They're stale but harmless for leaderboards (standings is the write target, so the value on robot represents the last-written value before the migration). Mark these as "Phase 5 cleanup" — they'll be addressed when we drop the robot columns entirely.
- **Option B:** Rewrite all raw SQL to join with standings. More correct, more effort, and the displayed value would be identical anyway since standings and robot columns were in sync at cutover time.

**Recommendation:** Option A — defer `currentLeague` reads in `records-queries.ts` and `economyCalculations.ts` to Phase 5. They're cosmetic context fields in leaderboard displays, not used for any logic.

### 2.4 — `leaderboardService.ts` — `currentLeague` filter

**Current:** `where.currentLeague = league` (filters robots by league)  
**Target:** Filter via standings table.

**Implementation:**
```typescript
if (league && league !== 'all') {
  // Get robot IDs in this league from standings
  const leagueRobotIds = await prisma.standing.findMany({
    where: { mode: 'league_1v1', tier: league, entityType: 'robot' },
    select: { entityId: true },
  });
  where.id = { in: leagueRobotIds.map(s => s.entityId) };
}
```

Also map the response `currentLeague` from the standings lookup rather than robot model.

### 2.5 — `finances.ts` — `currentLeague` select

**Current:** `select: { currentLeague: true }` on robots query  
**Target:** This field isn't actually *used* in the response — verify and remove if dead code. If it IS used (e.g., passed to economyCalculations), replace with standings lookup.

**Verification needed:** Check what `robots` is used for in the full finances route handler.

### 2.6 — `userProfileService.ts` — tag team stats from Robot model

**Current:** Reads `totalTagTeamBattles`, `totalTagTeamWins`, `totalTagTeamLosses`, `totalTagTeamDraws` from Robot.  
**Target:** Aggregate from standings where `mode = 'tag_team'` and `entityType = 'team'`.

**Complication:** The tag team stats on Robot are *per-robot* counts (how many tag team battles this robot participated in). Standings tracks wins/losses per *team*. These are different granularities.

**Options:**
- Sum across all teams the user's robots are members of (via TeamBattleMember → Standing)
- Keep reading from Robot model until columns are dropped (robot counters were populated by the old write path, are now stale, but represent historical totals up to the migration cutoff)

**Recommendation:** Since `userProfileService.ts` already reads `highestLeague` from standings (it was already migrated), the tag team stats can be migrated similarly. But note these numbers will only reflect pre-cutoff data since the Robot columns are no longer written. The correct source is `BattleParticipant` count or `Standing.wins/losses` per team.

**Pragmatic approach:** Replace with standings-based aggregation for the user's teams:
```typescript
const userTeams = await prisma.teamBattle.findMany({
  where: { stableId: userId, teamSize: 2 },
  select: { id: true },
});
const tagTeamStandings = await prisma.standing.findMany({
  where: { entityType: 'team', entityId: { in: userTeams.map(t => t.id) }, mode: 'tag_team' },
  select: { wins: true, losses: true, draws: true },
});
const totalTagTeamWins = tagTeamStandings.reduce((sum, s) => sum + s.wins, 0);
// etc.
```

### 2.7 — `stableViewService.ts` — team battle stats from TeamBattle columns

**Current:** Reads `totalLeagueWins`, `totalLeagueLosses`, `totalLeagueDraws` directly from TeamBattle.  
**Target:** Read from standings where `entityType = 'team'` and `mode` in ('league_2v2', 'league_3v3').

**Implementation:**
```typescript
// Replace the teamBattles select with a standings query
const teamIds = user.robots.flatMap(/* ... */); // Actually we need user's teams
const teamStandings = await prisma.standing.findMany({
  where: { entityType: 'team', entityId: { in: teamIds }, mode: { in: ['league_2v2', 'league_3v3'] } },
  select: { wins: true, losses: true, draws: true },
});
const teamBattleWins = teamStandings.reduce((sum, s) => sum + s.wins, 0);
const teamBattleLosses = teamStandings.reduce((sum, s) => sum + s.losses, 0);
const teamBattleDraws = teamStandings.reduce((sum, s) => sum + s.draws, 0);
```

### 2.8 — `economyCalculations.ts` — `currentLeague` on robot

**Current:** Selects `currentLeague` from robot, passes it through to return value.  
**Target:** Defer to Phase 5 (cosmetic display field).

### Phase 2 Verification
- `pnpm run build` compiles cleanly
- `pnpm test` passes (especially KotH analytics, records, leaderboard, profile, stable view tests)
- Manual verification: check KotH analytics page, Hall of Records, leaderboard, stable profile, finances page show correct data

---

## Phase 3: Battle Dual-Write Removal (High Risk, ~2 days)

These columns are still **actively written** during every battle creation. Removal requires updating all battle orchestrators.

### 3.1 — Remove Battle ELO columns

**Steps:**
1. Update `leagueBattleOrchestrator.ts`: remove `robot1ELOBefore/After`, `robot2ELOBefore/After`, `eloChange` from battle creation
2. Update `kothBattleOrchestrator.ts`: remove ELO column writes (currently writes 0s)
3. Update `teamBattleOrchestrator.ts`: remove ELO column writes
4. Update `tournamentBattleOrchestrator.ts`: remove ELO column writes + migrate ELO reads to `battle_participants`
5. Update `tagTeamResultUpdater.ts`: replace reads of `battle.robot1ELOBefore` etc. with `battle.participants[].eloBefore`
6. Update `matchHistoryService.ts`: if it reads ELO from battle record, switch to participants
7. Remove columns from schema, make them optional first (allow NULL), then drop in a later migration

**Migration strategy:** Two-step migration:
- **Step A:** Make columns nullable (`Int?`), stop writing them. Deploy. Verify nothing breaks.
- **Step B:** After 1 week of clean operation, drop columns entirely.

### 3.2 — Remove Battle tag-team columns

**Steps:**
1. Update `tagTeamBattleRecord.ts`: stop writing `team1ActiveRobotId`, `team1ReserveRobotId`, etc.
2. Update `matchHistoryService.ts`: rewrite tag-team battle log rendering to use `battle_participants` (team field + slot)
3. Update `adminBattleService.ts`: rewrite admin detail view to use participants
4. Update `tagTeamResultUpdater.ts`: replace reads of `team1TagOutTime`, `team2TagOutTime`, damage columns
5. Remove columns from schema (two-step: nullable → drop)

**Key challenge:** `matchHistoryService.ts` has complex tag-team formatting that relies on knowing which robot was Active vs Reserve, and the tag-out timestamps. The `battle_participants` table stores `team` (1 or 2) and `slot` (position), which maps to Active/Reserve for 2v2. Tag-out time would need to come from `battleLog` JSON (already stored there) or a new participant column.

**Decision needed before implementation:** Where does tag-out time live after column removal?
- Option A: Read from `battleLog` JSON (field `tagOutTime` per participant in the log)
- Option B: Add `tagOutTime` column to `BattleParticipant`
- **Recommendation:** Option A — the data already lives in battleLog, and tag-out time is only needed for display/analytics, not for any write-path logic.

### 3.3 — Remove Battle `robot1Id`/`robot2Id` (DEFERRED)

This is the hardest migration — 13+ files reference these columns, they're used in FK constraints, and they're the primary mechanism for match-history queries. **Defer to a separate effort** after Phases 1–3.2 are stable.

**When ready, the approach would be:**
1. Add a covering index on `battle_participants(battle_id, robot_id)` if not already present
2. Rewrite all `robot1Id`/`robot2Id` WHERE clauses to use `battleParticipations` relation
3. Drop FK constraints
4. Make columns nullable, stop writing
5. Drop after verification period

### Phase 3 Verification
- All battle orchestrators still create valid battles
- Match history pages render correctly (no missing ELO or tag-team data)
- Admin battle detail page works
- Run full battle cycle (1v1 + tag team + KotH + 2v2 + 3v3) in dev environment

---

## Phase 5: Column Drops + Interface Cleanup (Low Risk, ~½ day)

After Phases 1–3 are stable and deployed for at least a cycle:

### 5.1 — Drop Robot legacy columns from schema
- `currentLeague`, `leagueId`, `leaguePoints`, `cyclesInCurrentLeague`
- All 8 KotH columns
- `currentWinStreak`, `bestWinStreak`, `currentLoseStreak`
- `totalTagTeamBattles/Wins/Losses/Draws`, `timesTaggedIn`, `timesTaggedOut`
- `totalLeague1v1Wins/Losses/Draws`, `totalLeague2v2Wins`, `totalLeague3v3Wins`

### 5.2 — Drop TeamBattle legacy columns from schema
- `teamLp`, `teamLeague`, `teamLeagueId`, `cyclesInLeague`
- `totalLeagueWins`, `totalLeagueLosses`, `totalLeagueDraws`
- `tagTeamLp`, `tagTeamLeague`, `tagTeamLeagueId`, `cyclesInTagTeamLeague`
- `totalTagTeamWins`, `totalTagTeamLosses`, `totalTagTeamDraws`

### 5.3 — Update remaining read paths
- `records-queries.ts`: Remove `currentLeague` references (or read from standings)
- `economyCalculations.ts`: Accept league as parameter instead of reading from robot
- Bye-robot constructors: Remove legacy fields from mock object shapes

### 5.4 — Frontend type cleanup
- Update `robotApi.ts`, `teamBattleApi.ts`, etc. to remove legacy field names from interfaces
- Update any components that display `currentLeague` from the robot object

### 5.5 — Remove database indexes on dropped columns
- `@@index([currentLeague])` on Robot
- `@@index([currentLeague, leagueId])` on Robot
- `@@index([teamLeagueId])` on TeamBattle
- `@@index([teamSize, teamLeague])` on TeamBattle
- `@@index([teamSize, tagTeamLeague, tagTeamLeagueId])` on TeamBattle

---

## Execution Order & Dependencies

```
Phase 1 (dead tables) ─────────────────────────────────┐
                                                        │
Phase 2 (read migrations) ─────────────────────────────├──→ Phase 5 (column drops)
                                                        │
Phase 3.1 (ELO dual-write) ────────────────────────────┤
Phase 3.2 (tag-team dual-write) ───────────────────────┘
                                                        
Phase 3.3 (robot1Id/robot2Id) ─── Separate future effort
Phase 4 (tournament migration) ─── Separate spec
```

Phases 1, 2, and 3 can be worked on in parallel PRs, but Phase 5 requires all preceding phases to be merged and stable.

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Production data loss | Column drops use two-step (nullable → drop). Revert migration if issues. |
| Stale data in standings vs robot columns | Verified: standings is the write target since Spec #40 merge. All new data is correct. |
| Match history rendering breaks | Phase 3.2 has highest UI risk — test all 6 battle types in match history |
| Performance regression (extra joins) | Standing queries use `@@unique([entityType, entityId, mode])` — O(1) lookups. No performance concern. |
| Achievement system reads wrong data | Achievement system already mapped to standings (confirmed in audit). Low risk. |

---

## Estimated Total Effort

| Phase | Effort | Risk |
|-------|--------|------|
| Phase 1 | 2 hours | Low |
| Phase 2 | 1 day | Medium |
| Phase 3.1 | ½ day | Medium-High |
| Phase 3.2 | 1 day | High |
| Phase 5 | ½ day | Low |
| **Total** | **~3.5 days** | |

Phase 4 (tournament migration) and Phase 3.3 (robot1Id/robot2Id) are separate efforts estimated at 2–3 days each.

---

## PR Strategy

1. **PR #1: Phase 1** — Drop dead scheduling tables. Small, safe, mergeable immediately.
2. **PR #2: Phase 2.1–2.2** — KotH analytics + Hall of Records KotH → standings. Paired because they share the same columns.
3. **PR #3: Phase 2.4 + 2.7** — Leaderboard + stable view → standings. Related (both filter/aggregate by league).
4. **PR #4: Phase 2.6** — User profile tag team stats → standings.
5. **PR #5: Phase 3.1** — ELO dual-write removal.
6. **PR #6: Phase 3.2** — Tag-team dual-write removal (largest PR, needs careful review).
7. **PR #7: Phase 5** — Final column drops + interface cleanup.

Each PR is independently deployable. No PR depends on the next being merged immediately (except Phase 5 which needs all others).
