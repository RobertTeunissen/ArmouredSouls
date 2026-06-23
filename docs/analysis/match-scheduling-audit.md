# Match Scheduling Audit & Unification Plan

> **Status: COMPLETED** — All actions implemented via Spec #41 (Unified Match Scheduling).
> Migration pending deploy: `20250101000041_drop_legacy_scheduling_tables` drops 4 legacy tables, `rotating_zone` column, and the persistent Bye Robot row.

---

## Final Architecture (Post-Unification)

### Trigger Paths

| Path | File | Purpose |
|------|------|---------|
| Cron scheduler | `src/services/cycle/cycleScheduler.ts` | Production ACC — 10 daily cron jobs via `node-cron` |
| Bulk cycles | `src/services/admin/adminCycleService.ts` | Admin panel — runs N full cycles in sequence |
| Admin triggers | `POST /api/admin/scheduler/trigger/:jobName` | Admin panel — triggers exact same cron handler |

All paths use the same matchmaking services and `schedulingService.ts` (`scheduled_matches_v2` table).

### Shared Infrastructure

| Component | File | Consumed By |
|-----------|------|-------------|
| Match scoring (LP-primary + ELO-secondary + recent-opponent + same-stable penalty) | `src/services/matchmaking/teamMatchmakingUtils.ts` | All 5 modes |
| Recent-opponent query factory (`createRecentOpponentQueryFn`) | `src/services/matchmaking/teamMatchmakingUtils.ts` | All 5 modes |
| Default scheduledFor (`defaultScheduledFor()` — 24h + rounded) | `src/services/matchmaking/teamMatchmakingUtils.ts` | All 5 modes |
| Unified scheduling table (`scheduled_matches_v2`) | `src/services/scheduling/schedulingService.ts` | All modes |
| Scheduling readiness check (`checkSchedulingReadiness`) | `src/services/analytics/matchmakingService.ts` | All 5 modes |
| Subscription gating (`batchActivatePendingSubscriptions`) | `src/services/subscription/subscriptionService.ts` | All 5 modes |
| Shared cycle orchestrator (`executeLeagueCycleSteps`) | `src/services/cycle/leagueCycleOrchestrator.ts` | Available for all cron/bulk handlers |
| Unified team matchmaking (`runTeamMatchmaking`) | `src/services/matchmaking/unifiedTeamMatchmaking.ts` | 2v2 League, 3v3 League, Tag Team |

---

## Unified Pipeline (All 5 Modes)

Every mode follows this pipeline identically:

```
1. Source entities from Standing (mode → tier → instance → entityIds)
2. Load entities from DB (robots or teams with members)
3. Check scheduling readiness (checkSchedulingReadiness — validates weapon loadout per type)
4. Activate pending subscriptions (batchActivatePendingSubscriptions)
5. Filter by active subscription for the mode's event type
6. Exclude already-scheduled entities (schedulingService.getUpcomingForRobot/Team)
7. Pair/group using LP-primary scoring (calculateMatchScore)
   - R4.7 fallback: if ALL opponents are recent → select closest-ELO
   - Tie-breaking: createdAt (deterministic)
8. Persist via schedulingService.createMatch() with leagueType + leagueInstanceId
9. Default scheduledFor: 24h + rounded to hour (handled internally by each service)
```

### Per-Mode Specifics

| Mode | Entity | Pairing | Group Size | Bye Handling |
|------|--------|---------|------------|--------------|
| 1v1 League | Robot | Greedy LP-primary pairs | 2 (1v1) | In-memory bye robot (id=-1) |
| 2v2 League | TeamBattle (teamSize=2) | Greedy LP-primary pairs | 2 (team vs team) | In-memory bye team |
| 3v3 League | TeamBattle (teamSize=3) | Greedy LP-primary pairs | 2 (team vs team) | In-memory bye team |
| Tag Team | TeamBattle (teamSize=2, mode=tag_team) | Greedy LP-primary pairs | 2 (team vs team) | In-memory bye team |
| KotH | Robot | LP-banding into contiguous groups | 5-6 | No byes (skip if < 5) |

---

## Cron Schedule (Production ACC)

| Slot | Job Name | Schedule (UTC) | Handler |
|------|----------|----------------|---------|
| 1 | `league` | 08:00 | `executeLeagueCycle()` |
| 2 | `team2v2League` | 09:00 | `executeTeam2v2LeagueCycle()` |
| 3 | `tournament` | 10:00 | `executeTournamentCycle()` |
| 4 | `tagTeam` | 11:00 | `executeTagTeamCycle()` |
| 5 | `koth` | 13:00 | `executeKothCycle()` |
| 6 | `team3v3League` | 14:00 | `executeTeam3v3LeagueCycle()` |
| 7 | `team2v2Tournament` | 15:00 | `executeTeam2v2TournamentCycle()` |
| 8 | `grandMelee` | 17:00 | Reserved stub |
| 9 | `team3v3Tournament` | 18:00 | `executeTeam3v3TournamentCycle()` |
| 10 | `settlement` | 00:00 | `executeSettlement()` |

Each league handler follows: **repair → execute → rebalance → matchmaking** (identical across all trigger paths).

---

## What Was Unified (Summary of Changes)

| Area | Before | After |
|------|--------|-------|
| KotH matchmaking | Snake-draft ELO, global pool, no tier scoping | LP-banding within tier/instance, same pipeline as all modes |
| KotH readiness | Simple `mainWeaponId IS NOT NULL` | `checkSchedulingReadiness()` (validates full loadout type) |
| KotH zone rotation | `cycleNumber % 3` → rotatingZone (broken) | Removed entirely |
| 1v1 bye handling | Persistent "Bye Robot" in DB | In-memory fabrication (id=-1) |
| Recent-opponent source | 1v1: `Battle` table (all types); teams: `ScheduledTeamBattleMatch`; KotH: none | All: `scheduled_matches_v2` filtered by own MatchType |
| R4.7 fallback | Only in 2v2/3v3 | All 5 modes |
| Tie-breaking | Non-deterministic (1v1, tag team) | `createdAt` for all modes |
| scheduledFor | Computed by callers (some round, some don't) | Internal to services (24h + rounded) |
| Already-scheduled check | Mixed: unified table (1v1), legacy tables (others) | All via `schedulingService.getUpcomingForRobot/Team` |
| Locking predicates | `ScheduledTeamBattleMatch` | `schedulingService.getUpcomingForTeam` |
| Match history | `ScheduledTeamBattleMatch` + `ScheduledKothMatch` | `scheduled_matches_v2` (prisma.scheduledMatch) |
| Admin stats | Legacy table counts | `scheduled_matches_v2` grouped by matchType |
| Deploy orchestrator | 3 separate legacy table queries | Single `scheduled_matches_v2` query |
| KotH standings | `ScheduledKothMatch` | `scheduled_matches_v2` where matchType=koth |
| Instance discovery | 1v1: `getInstancesForTier()` helper; others: `Standing.distinct` | All: `Standing.distinct('leagueInstanceId')` |
| Bye Robot exclusions | ~50 `NOT: { name: 'Bye Robot' }` filters | Removed (no persistent bye robot) |
| Piecemeal admin endpoints | No deprecation warnings | All deprecated with warning → use `scheduler/trigger/:jobName` |
| Cron/admin drift | Bulk missing repair (2v2/3v3), missing KotH rebalance | Fixed — all paths identical |

---

## Pending Deploy Actions

The following migration needs to be applied on ACC/production:

**Migration: `20250101000041_drop_legacy_scheduling_tables`**
- Drops `scheduled_koth_match_participants`, `scheduled_koth_matches`, `scheduled_team_battle_matches`, `scheduled_league_matches`
- Drops `rotating_zone` column from `scheduled_matches_v2`
- Deletes "Bye Robot" row and `bye_robot_user`

The legacy Prisma model definitions (`ScheduledLeagueMatch`, `ScheduledTeamBattleMatch`, `ScheduledKothMatch`, `ScheduledKothMatchParticipant`) should be removed from `schema.prisma` before running `prisma generate`.

---

## New Files Created

| File | Purpose |
|------|---------|
| `src/services/matchmaking/unifiedTeamMatchmaking.ts` | Shared parameterized entry point for all team-based matchmaking |
| `src/services/cycle/leagueCycleOrchestrator.ts` | Shared `repair → execute → rebalance → matchmaking` pipeline |
| `src/services/matchmaking/teamMatchmakingUtils.ts` (additions) | `createRecentOpponentQueryFn`, `defaultScheduledFor` |
| `prisma/migrations/20250101000041_drop_legacy_scheduling_tables/migration.sql` | Table drop + column drop + bye robot deletion |

---

## Decisions Record

1. **KotH grouping**: LP-banding (sort by LP, divide into contiguous bands of 5-6, apply same-stable + recent-opponent swaps)
2. **Zone rotation**: Removed entirely (never worked properly)
3. **Bye handling**: In-memory fabrication for all paired modes (id < 0, elo=1000)
4. **Instance discovery**: `Standing.distinct('leagueInstanceId')` for all modes
5. **Recent-opponent source**: `scheduled_matches_v2` filtered by own MatchType (mode-specific isolation)
6. **scheduledFor default**: Handled internally by each service (24h + rounded to hour)
7. **Admin trigger path**: `scheduler/trigger/:jobName` is the canonical trigger; piecemeal endpoints deprecated
