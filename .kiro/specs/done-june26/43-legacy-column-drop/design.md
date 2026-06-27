# Design Document: Spec #40 Legacy Column Drop (Phase 2)

## Overview

This design describes the completion of the Spec #40 database unification by removing legacy columns, tables, and read paths that were left behind after the write-path migration. The work is purely subtractive — no new tables, no new features, no new API endpoints. Every change either deletes dead code, rewires a read path from a legacy column to the unified `standings` table, or stops writing redundant data.

The migration is structured as a dependency chain: read migrations must complete before column drops, and dual-write removals must complete before the Battle model columns are dropped. Each phase is independently deployable.

## Architecture

### Migration Dependency Graph

```
Phase 1: Drop dead scheduling tables (no code deps)
    │
Phase 2: Read migrations (7 services)
    │   ├── kothAnalyticsService → standings
    │   ├── records-queries.ts (KotH) → standings
    │   ├── leaderboardService → standings
    │   ├── stableViewService → standings
    │   ├── userProfileService → standings
    │   ├── finances.ts → standings (or remove dead select)
    │   ├── economyCalculations.ts → standings / parameter
    │   ├── triggerEvaluator.ts → standings (verify)
    │   ├── matchHistoryService (currentLeague read) → standings
    │   ├── tournamentParticipantResolver (fallback reads) → standings
    │   └── routes/teamBattles.ts → verify mapped from standings
    │
Phase 3: Dual-write removal (battle orchestrators)
    │   ├── ELO columns: 5 orchestrators stop writing
    │   ├── Tag-team columns: tagTeamBattleRecord + tagTeamResultUpdater stop writing
    │   ├── tagTeamBattleRecord: migrate tagTeamLeagueId read to standings
    │   ├── adminStatsService: migrate tag team league references to standings
    │   └── matchHistoryService (tag-team rendering) → battle_participants
    │
Phase 4: Column drops (schema migrations)
    │   ├── Robot: 26 columns dropped
    │   ├── TeamBattle: 14 columns dropped
    │   └── Battle: 19 columns dropped (two-step: nullable → drop)
    │
Phase 5: Cleanup (bye-robot types, interfaces, docs)
```

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| Two-step column drop for Battle model (nullable → drop) | Battle columns are currently `Int` (non-nullable). Making them nullable first allows a deploy without immediately breaking any code that might still reference them. The drop happens in a follow-up migration after 1 cycle of clean operation. |
| Robot + TeamBattle columns dropped in single migration | These columns have zero writes already. Once reads are migrated, they're purely dead weight. No need for a two-step approach since nothing writes to them. |
| Tag-out time sourced from `battleLog` JSON, not a new BattleParticipant column | The `BattleParticipant` model already has `tagOutTimeMs` (added by Spec #40). However, audit shows `tagTeamResultUpdater` reads tag-out from Battle columns for result processing. After migration, it should read from `battleParticipants.tagOutTimeMs` which is already populated during tag-team battle recording. |
| `robot.currentLeague` in raw SQL (records-queries, economyCalculations) deferred to column-drop phase | These are display-only reads in Hall of Records and economy projections. They return the correct (stale) value. The simplest fix is to join with standings when the column is dropped — attempting a raw SQL rewrite mid-spec adds risk without user-visible benefit. |
| No frontend changes in this spec | All API response shapes remain identical. The frontend never knows the data source changed. Frontend type cleanup (removing unused fields from TS interfaces) is a follow-up concern if/when we reduce response payloads. |
| Achievement system: verify-only, not rewrite | The audit shows "✅ Mapped" for most achievement reads (they already query standings). The `triggerEvaluator.ts` references need verification — if they already delegate to the mapped service, no code change is needed. |

## Components and Interfaces

### Phase 1: Dead Table Removal

**Files modified:**
- `prisma/schema.prisma` — Remove 4 models: `ScheduledLeagueMatch`, `ScheduledKothMatch`, `ScheduledKothMatchParticipant`, `ScheduledTeamBattleMatch`
- `prisma/schema.prisma` — Remove relations from Robot: `scheduledMatchesAsRobot1`, `scheduledMatchesAsRobot2`, `kothMatchParticipations`
- `prisma/schema.prisma` — Remove relations from Battle: `scheduledMatch`, `scheduledKothMatch`
- `prisma/schema.prisma` — Remove relations from TeamBattle: `matchesAsTeam1`, `matchesAsTeam2`
- Any `.ts` file importing types from removed models — delete or replace with unified types

**Migration:** `prisma migrate dev --name drop-dead-scheduling-tables`

No service logic changes. Only type/import cleanup.

### Phase 2: Read Migrations

#### 2.1 — kothAnalyticsService.ts

**Current interface (unchanged):**
```typescript
interface KothPerformance {
  robotId: number;
  robotName: string;
  kothMatches: number;
  kothWins: number;
  podiumRate: number;
  avgZoneScore: number;
  kothTotalZoneTime: number;
  kothKills: number;
  kothBestPlacement: number | null;
  kothCurrentWinStreak: number;
  kothBestWinStreak: number;
}
```

**New data source:** Single query to `prisma.standing` + robot name lookup.

```typescript
const [robot, standing] = await Promise.all([
  prisma.robot.findUnique({ where: { id: robotId }, select: { id: true, name: true } }),
  prisma.standing.findUnique({
    where: { entityType_entityId_mode: { entityType: 'robot', entityId: robotId, mode: 'koth' } },
  }),
]);
```

**Field mapping:**
| KothPerformance field | Standing field |
|----------------------|----------------|
| kothMatches | totalMatches |
| kothWins | wins |
| avgZoneScore | totalZoneScore / totalMatches |
| kothTotalZoneTime | totalZoneTime |
| kothKills | totalKills |
| kothBestPlacement | bestPlacement |
| kothCurrentWinStreak | currentWinStreak |
| kothBestWinStreak | bestWinStreak |

#### 2.2 — records-queries.ts (fetchKothRecords)

**Strategy:** Replace 7 `prisma.robot.findMany()` calls (each with a different KotH orderBy) with `prisma.standing.findMany()` calls joined with robot data.

**Pattern for each category:**
```typescript
const standings = await prisma.standing.findMany({
  where: { mode: 'koth', totalMatches: { gt: 0 } },
  orderBy: { wins: 'desc' },  // varies per category
  take: 10,
});
const robotIds = standings.map(s => s.entityId);
const robots = await prisma.robot.findMany({
  where: { id: { in: robotIds } },
  include: { user: { select: userSelect } },
});
const robotMap = new Map(robots.map(r => [r.id, r]));
```

Then merge standings data with robot names for the response.

#### 2.3 — leaderboardService.ts

**Current:** `where.currentLeague = league` filtering directly on Robot.
**New:** Pre-filter robot IDs from standings, then apply to the robot query:

```typescript
if (league && league !== 'all') {
  const leagueStandings = await prisma.standing.findMany({
    where: { mode: 'league_1v1', tier: league, entityType: 'robot' },
    select: { entityId: true },
  });
  where.id = { in: leagueStandings.map(s => s.entityId) };
}
```

Response `currentLeague` field: source from a standings lookup or include it in the pre-filtered results.

#### 2.4 — stableViewService.ts

**Current:** Includes `teamBattles: { select: { totalLeagueWins, totalLeagueLosses, totalLeagueDraws } }` on the User query.
**New:** Fetch team IDs from `TeamBattle` (just IDs), then query standings:

```typescript
const userTeams = await prisma.teamBattle.findMany({
  where: { stableId: userId },
  select: { id: true },
});
const teamStandings = await prisma.standing.findMany({
  where: {
    entityType: 'team',
    entityId: { in: userTeams.map(t => t.id) },
    mode: { in: ['league_2v2', 'league_3v3'] },
  },
  select: { wins: true, losses: true, draws: true },
});
```

#### 2.5 — userProfileService.ts

**Current:** Reads `totalTagTeamBattles`, `totalTagTeamWins`, `totalTagTeamLosses`, `totalTagTeamDraws` from Robot select.
**New:** Aggregate from team standings (tag_team mode):

```typescript
const userTeams = await prisma.teamBattle.findMany({
  where: { stableId: userId, teamSize: 2 },
  select: { id: true },
});
const tagTeamStandings = userTeams.length > 0
  ? await prisma.standing.findMany({
      where: { entityType: 'team', entityId: { in: userTeams.map(t => t.id) }, mode: 'tag_team' },
      select: { wins: true, losses: true, draws: true },
    })
  : [];
const totalTagTeamWins = tagTeamStandings.reduce((s, st) => s + st.wins, 0);
const totalTagTeamLosses = tagTeamStandings.reduce((s, st) => s + st.losses, 0);
const totalTagTeamDraws = tagTeamStandings.reduce((s, st) => s + st.draws, 0);
const totalTagTeamBattles = totalTagTeamWins + totalTagTeamLosses + totalTagTeamDraws;
```

#### 2.6 — finances.ts

**Verification needed:** The route selects `robot.currentLeague` but the audit suggests it may be unused in the response. If unused: simply remove from the select. If used: replace with a standings lookup.

#### 2.7 — economyCalculations.ts

**Current:** Selects `currentLeague` from robots, passes through to response object.
**Approach:** The function signature changes to accept league tier as a parameter (passed in by the caller from standings), OR performs an inline standings lookup. The caller (finances route) fetches league from standings and passes it down.

#### 2.8 — triggerEvaluator.ts

**Verification step:** Check if `triggerEvaluator.ts` reads from robot directly or already delegates to a service that maps from standings. If already mapped: document and move on. If direct read: migrate to standings lookup.

#### 2.9 — matchHistoryService.ts (currentLeague read)

**Current:** `matchHistoryService.ts` reads `robot.currentLeague` for display in match history entries.
**Target:** Source league tier from standings lookup, or from the battle participants context (the standing tier at the time of battle is already stored in `Battle.leagueType`/`leagueInstanceId`).

If the `currentLeague` reference is used to display what league a robot was in *at the time of the battle*: this is already available from `Battle.leagueType`. If it's used to show the robot's *current* league: source from standings.

#### 2.10 — tournamentParticipantResolver.ts (fallback reads)

**Current:** Falls back to `robot.currentLeague` and `teamBattle.teamLeague` when standings lookup returns no result.
**Target:** Remove fallback paths. If no standings row exists, return a sensible default (e.g., `'bronze'`) rather than falling back to a stale legacy column.

#### 2.11 — routes/teamBattles.ts (verification)

**Current:** The audit marks this as "✅ Mapped from standings" — the route already reads team standings. However, it still appears in the legacy references appendix (`teamLp`, `teamLeague`, `teamLeagueId`, `tagTeamLp`, `tagTeamLeague`).
**Target:** Verify all reads are indeed mapped. If the route still has residual Prisma selects on these TeamBattle columns (even if it then overwrites them with standings data), remove the dead selects. If any fallback logic reads from TeamBattle directly: migrate to standings-only.

### Phase 3: Dual-Write Removal

#### 3.1 — ELO Columns (5 orchestrators)

**Files modified:**
- `leagueBattleOrchestrator.ts` — Remove `robot1ELOBefore`, `robot2ELOBefore`, `robot1ELOAfter`, `robot2ELOAfter`, `eloChange` from `prisma.battle.create()` data
- `kothBattleOrchestrator.ts` — Same (currently writes 0s for ELO)
- `teamBattleOrchestrator.ts` — Same (writes sum ELO for teams)
- `tournamentBattleOrchestrator.ts` — Same + migrate reads to `battle_participants`
- `teamTournamentBattleOrchestrator.ts` — Same

**Read migration (required before drop):**
- `tagTeamResultUpdater.ts` — reads `battle.robot1ELOBefore` for audit log → switch to `battle.participants[0].eloBefore`
- `matchHistoryService.ts` — if it reads ELO from battle for display → switch to participants

#### 3.2 — Tag-Team Columns (2 services)

**Files modified:**
- `tagTeamBattleRecord.ts` — Remove writes of `team1ActiveRobotId`, `team1ReserveRobotId`, `team2ActiveRobotId`, `team2ReserveRobotId`, `team1TagOutTime`, `team2TagOutTime`
- `tagTeamResultUpdater.ts` — Remove writes of 8 damage/fame columns; migrate reads of `tagOutTime` to `battle_participants.tagOutTimeMs`

**Read migration (required before drop):**
- `matchHistoryService.ts` — Tag-team battle rendering uses `team1ActiveRobotId`, `team2ActiveRobotId`, `team1TagOutTime`, etc. Must be rewritten to derive from `battle_participants`:
  - Active robot = participant with `role = 'active'` and matching `team`
  - Reserve robot = participant with `role = 'reserve'` and matching `team`
  - Tag-out time = `participant.tagOutTimeMs` on the active robot
- `adminBattleService.ts` — Same pattern for admin detail view
- `adminStatsService.ts` — References tag team league columns; migrate to standings lookups
- `robotQueryService.ts` — Match history query uses tag-team robot IDs for filtering
- `tagTeamBattleRecord.ts` — Reads `teamBattle.tagTeamLeagueId` to populate `leagueInstanceId` on the battle record. After TeamBattle column drop, must source from `prisma.standing.findUnique({ where: { entityType: 'team', entityId: teamId, mode: 'tag_team' } }).leagueInstanceId`

### Phase 4: Schema Migrations

**Migration sequence:**
1. `drop-dead-scheduling-tables` — Phase 1 (tables only, no column changes)
2. `drop-robot-legacy-columns` — All 26 Robot columns + 2 indexes
3. `drop-teambattle-legacy-columns` — All 14 TeamBattle columns + 3 indexes
4. `make-battle-elo-tagteem-nullable` — Make 19 Battle columns nullable (Int → Int?)
5. `drop-battle-elo-tagteam-columns` — Drop the 19 nullable columns (runs after verification period)

Migrations 2 and 3 can run in the same deploy (Robot and TeamBattle have zero writes). Migration 4 runs after Phase 3 code changes are deployed. Migration 5 runs after 1 cycle of clean operation.

### Phase 5: Interface and Type Cleanup

**Bye-robot constructors** (5+ files across matchmaking services):
- These construct minimal Robot-shaped objects for bye matches
- After column drops, the Prisma type shrinks automatically — constructors just need fewer fields
- No logic change, only type satisfaction

**`TagTeamWithRobots` interface** in `tagTeamTypes.ts`:
- Remove `tagTeamLp`, `tagTeamLeague`, `tagTeamLeagueId`, `cyclesInTagTeamLeague`, `totalTagTeamWins/Losses/Draws`

**`teamBattleService.ts` team creation:**
- Remove initial value writes for dropped columns (standings row creation already handles this)

## Documentation Impact

| Document | Change needed |
|----------|--------------|
| `.kiro/steering/project-overview.md` | Add note about completed column cleanup; update model sizes |
| `.kiro/steering/coding-standards.md` | Add rule: "Never read league/KotH/tag-team stats from Robot/TeamBattle — use standings table" |
| `docs/BACKLOG.md` | Move item #59 to "Recently Completed" with spec reference |
| `docs/implementation_notes/SPEC40_LEGACY_CLEANUP_PLAN.md` | Delete (superseded by this spec) |
| `docs/analysis/SPEC40_LEGACY_COLUMN_AUDIT.md` | Keep as historical reference, add header noting completion |
| `docs/architecture/PRD_SERVICE_DIRECTORY.md` | Remove references to dropped scheduling tables if present |
| `docs/architecture/PRD_BATTLE_DATA_ARCHITECTURE.md` | Update to note ELO/tag-team columns removed from Battle |

## Data Models

This spec does not introduce new models. It only modifies existing models by removing columns:

### Robot Model — Columns Removed (26)

| Column | Replacement |
|--------|-------------|
| `currentLeague` | `standings.tier` (mode=league_1v1) |
| `leagueId` | `standings.leagueInstanceId` (mode=league_1v1) |
| `leaguePoints` | `standings.leaguePoints` (mode=league_1v1) |
| `cyclesInCurrentLeague` | `standings.cyclesInTier` (mode=league_1v1) |
| `kothWins` | `standings.wins` (mode=koth) |
| `kothMatches` | `standings.totalMatches` (mode=koth) |
| `kothTotalZoneScore` | `standings.totalZoneScore` (mode=koth) |
| `kothTotalZoneTime` | `standings.totalZoneTime` (mode=koth) |
| `kothKills` | `standings.totalKills` (mode=koth) |
| `kothBestPlacement` | `standings.bestPlacement` (mode=koth) |
| `kothCurrentWinStreak` | `standings.currentWinStreak` (mode=koth) |
| `kothBestWinStreak` | `standings.bestWinStreak` (mode=koth) |
| `currentWinStreak` | `standings.currentWinStreak` (mode=league_1v1) |
| `bestWinStreak` | `standings.bestWinStreak` (mode=league_1v1) |
| `currentLoseStreak` | `standings.currentLoseStreak` (mode=league_1v1) |
| `totalTagTeamBattles` | Sum of standings wins+losses+draws (mode=tag_team) |
| `totalTagTeamWins` | `standings.wins` (mode=tag_team) |
| `totalTagTeamLosses` | `standings.losses` (mode=tag_team) |
| `totalTagTeamDraws` | `standings.draws` (mode=tag_team) |
| `timesTaggedIn` | Derivable from `battle_participants` (role=reserve) |
| `timesTaggedOut` | Derivable from `battle_participants` (tagOutTimeMs != null) |
| `totalLeague1v1Wins` | `standings.wins` (mode=league_1v1) |
| `totalLeague1v1Losses` | `standings.losses` (mode=league_1v1) |
| `totalLeague1v1Draws` | `standings.draws` (mode=league_1v1) |
| `totalLeague2v2Wins` | `standings.wins` (mode=league_2v2, via team) |
| `totalLeague3v3Wins` | `standings.wins` (mode=league_3v3, via team) |

### TeamBattle Model — Columns Removed (14)

| Column | Replacement |
|--------|-------------|
| `teamLp` | `standings.leaguePoints` (mode=league_2v2 or league_3v3) |
| `teamLeague` | `standings.tier` |
| `teamLeagueId` | `standings.leagueInstanceId` |
| `cyclesInLeague` | `standings.cyclesInTier` |
| `totalLeagueWins` | `standings.wins` |
| `totalLeagueLosses` | `standings.losses` |
| `totalLeagueDraws` | `standings.draws` |
| `tagTeamLp` | `standings.leaguePoints` (mode=tag_team) |
| `tagTeamLeague` | `standings.tier` (mode=tag_team) |
| `tagTeamLeagueId` | `standings.leagueInstanceId` (mode=tag_team) |
| `cyclesInTagTeamLeague` | `standings.cyclesInTier` (mode=tag_team) |
| `totalTagTeamWins` | `standings.wins` (mode=tag_team) |
| `totalTagTeamLosses` | `standings.losses` (mode=tag_team) |
| `totalTagTeamDraws` | `standings.draws` (mode=tag_team) |

### Battle Model — Columns Removed (19)

| Column | Replacement |
|--------|-------------|
| `robot1ELOBefore` | `battle_participants.eloBefore` (team=1, slot=1) |
| `robot2ELOBefore` | `battle_participants.eloBefore` (team=2, slot=1) |
| `robot1ELOAfter` | `battle_participants.eloAfter` (team=1, slot=1) |
| `robot2ELOAfter` | `battle_participants.eloAfter` (team=2, slot=1) |
| `eloChange` | Computed: `participant.eloAfter - participant.eloBefore` |
| `team1ActiveRobotId` | `battle_participants` where team=1, role='active' |
| `team1ReserveRobotId` | `battle_participants` where team=1, role='reserve' |
| `team2ActiveRobotId` | `battle_participants` where team=2, role='active' |
| `team2ReserveRobotId` | `battle_participants` where team=2, role='reserve' |
| `team1TagOutTime` | `battle_participants.tagOutTimeMs` (team=1, role='active') |
| `team2TagOutTime` | `battle_participants.tagOutTimeMs` (team=2, role='active') |
| `team1ActiveDamageDealt` | `battle_participants.damageDealt` (team=1, role='active') |
| `team1ReserveDamageDealt` | `battle_participants.damageDealt` (team=1, role='reserve') |
| `team2ActiveDamageDealt` | `battle_participants.damageDealt` (team=2, role='active') |
| `team2ReserveDamageDealt` | `battle_participants.damageDealt` (team=2, role='reserve') |
| `team1ActiveFameAwarded` | `battle_participants.fameAwarded` (team=1, role='active') |
| `team1ReserveFameAwarded` | `battle_participants.fameAwarded` (team=1, role='reserve') |
| `team2ActiveFameAwarded` | `battle_participants.fameAwarded` (team=2, role='active') |
| `team2ReserveFameAwarded` | `battle_participants.fameAwarded` (team=2, role='reserve') |

### Models Dropped Entirely (4)

- `ScheduledLeagueMatch` — superseded by `ScheduledMatch` (matchType=league_1v1)
- `ScheduledKothMatch` — superseded by `ScheduledMatch` (matchType=koth)
- `ScheduledKothMatchParticipant` — superseded by `ScheduledMatchParticipant`
- `ScheduledTeamBattleMatch` — superseded by `ScheduledMatch` (matchType=league_2v2/3v3/tag_team)

## Correctness Properties

### Property 1: Response Shape Invariance

Every API endpoint that previously read from legacy columns must return the identical JSON shape and values after migration. The standings table was populated from the same data source — values must be equivalent.

**Validates: Requirements 2.3, 3.4, 4.2, 5.3, 6.3, 7.3**

### Property 2: Zero-Write Verification

All 26 Robot columns and 14 TeamBattle columns have had zero production writes since Spec #40 shipped. The values in standings are canonical. Any divergence between legacy column values and standings values means the legacy column is stale (standings is correct).

**Validates: Requirements 12.5, 13.6**

### Property 3: Battle Participant Data Completeness

All `battle_participants` rows have been written alongside legacy columns since Spec #40. The ELO, damage, fame, and tag-out data already exists in participants for every historical battle. No backfill is needed — data integrity is guaranteed by the dual-write that has been active since Spec #40 went live.

**Validates: Requirements 10.7, 11.5, 11.6, 14.2**

### Property 4: Ordering Equivalence

For Hall of Records and leaderboard queries, the ordering must produce the same top-10/top-200 results. Since `standings.wins == robot.kothWins` (populated from the same source at migration time and standings is the sole write target since), ordering is equivalent.

**Validates: Requirements 3.3, 4.4**

## Testing Strategy

No new test files are created. Existing tests are updated to:
- Mock `prisma.standing` instead of `prisma.robot` for KotH/league/tag-team queries
- Remove assertions on legacy column values in battle creation
- Assert on `battle_participants` data instead of Battle-level columns

Integration testing is covered by the existing battle cycle tests — they exercise the full write→read path and will fail if any read migration is incorrect.

The verification criteria (9 grep commands + build + test) serve as the acceptance test gate.

## Error Handling

No new error paths are introduced. All changes maintain existing error behavior:
- If a standings row is missing (should never happen for active entities), the existing null-check patterns return null/empty data — same as the current "no KotH data" behavior
- Migration failures are handled by Prisma's rollback mechanism
- The two-step Battle column drop provides a recovery window if any missed read path surfaces after the nullable migration

## Performance Considerations

- **KotH analytics:** Replaces 1 robot query (50+ column SELECT) with 2 queries (1 standings lookup + 1 minimal robot select). Net improvement — standings rows are ~15 columns vs robot's ~95.
- **Hall of Records KotH:** Same pattern — smaller row scans from standings vs robot table.
- **Leaderboard filter:** Adds 1 standings query to resolve IDs before the main robot query. The standings index `(mode, tier)` makes this sub-millisecond. Net: similar performance, cleaner semantics.
- **Stable view / profile:** Adds 1 standings query but removes a JOIN on teamBattles. Net neutral.
- **Battle creation:** Removes 19 column writes per battle. Net improvement to write throughput.
- **Index removal:** 5 fewer indexes to maintain on Robot and TeamBattle — improves write performance for those tables.
