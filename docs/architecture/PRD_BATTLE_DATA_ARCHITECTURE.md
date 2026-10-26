# Product Requirements Document: Battle Data Architecture

**Last Updated**: October 19, 2026
**Status**: ✅ Implemented  
**Owner**: Robert Teunissen  
**Epic**: Battle System — Data Architecture  
**Version**: 3.3

---

## Version History
- v3.4 (October 25, 2026) — Added "Combat Log Storage": KotH and Grand Melee logs keep formula breakdowns (`battleLog.storage` marker), the player battle log no longer sends them, and the admin Battles page reads them.
- v3.3 (October 19, 2026) — Added "Robot Deletion and Battle Retention": account reset and the Generated_Stable purge delete only the deleted robots' participant rows (#294).
- v3.2 (October 15, 2026) — Added "Forfeit Battle Records" (`battle_participants.forfeited`, the forfeit battle shape, the history classifier) and "Match failure policy" (#536).
- v3.1 (October 14, 2026) — Added "Standings lifecycle": rows are created by `standingPlacement` on the first matchable subscription, never at robot/team creation or by battle recording.
- v3.0 (June 25, 2026) — Added "Post-Battle Robot State Update (Unified)" section documenting `updateRobotCombatStats()` as the single source of truth for all orchestrators. Added bye-match handling patterns. Updated implementation files table to include team battle and team tournament orchestrators.
- v2.0 (April 2, 2026) — Full audit against Prisma schema. Fixed BattleParticipant model (removed non-existent `userId` field/relation/index, added `createdAt`, added table mapping). Corrected Battle model documentation (it still has robot1Id/robot2Id, tag team fields, ELO tracking — not the "simplified" version the old doc claimed). Fixed battleType values (`"league"` not `"1v1"`). Updated file paths for backend service consolidation. Removed incorrect "26+ columns removed" claim.
- v1.0 (February 23, 2026) — Initial document

---

## Executive Summary

The BattleParticipant table provides a normalized, scalable approach to storing per-robot battle data. Each robot in a battle gets one BattleParticipant record containing its economic rewards, stat changes, and combat outcome. This replaces the need for per-robot columns on the Battle table (e.g., `robot1DamageDealt`, `robot2PrestigeAwarded`) and scales to any number of participants.

The Battle table still exists and retains core battle metadata, robot references, tag team composition fields, and ELO tracking for backward compatibility. BattleParticipant is the canonical source for per-robot data.

---

## BattleParticipant Model

One record per robot per battle. This is the canonical source for per-robot combat stats, rewards, and ELO changes.

```prisma
model BattleParticipant {
  id       Int     @id @default(autoincrement())
  battleId Int     @map("battle_id")
  robotId  Int     @map("robot_id")
  team     Int                          // 1 or 2 (team affiliation)
  role     String? @db.VarChar(20)      // "active"/"reserve" for tag team, null for 1v1

  // KotH placement (null for non-KotH battles)
  placement Int?                        // 1-6 final placement

  // Economic effects
  credits          Int
  streamingRevenue Int @default(0) @map("streaming_revenue")

  // Stat changes
  eloBefore       Int @map("elo_before")
  eloAfter        Int @map("elo_after")
  prestigeAwarded Int @default(0) @map("prestige_awarded")
  fameAwarded     Int @default(0) @map("fame_awarded")

  // Battle stats
  damageDealt Int     @default(0) @map("damage_dealt")
  finalHP     Int     @map("final_hp")
  yielded     Boolean @default(false)
  destroyed   Boolean @default(false)
  forfeited   Boolean @default(false)    // no main weapon at battle start (#536)

  createdAt DateTime @default(now()) @map("created_at")

  battle Battle @relation(fields: [battleId], references: [id], onDelete: Cascade)
  robot  Robot  @relation(fields: [robotId], references: [id])

  @@unique([battleId, robotId])
  @@index([battleId])
  @@index([robotId])
  @@index([battleId, team])
  @@map("battle_participants")
}
```

### Records Per Battle Type

| Battle Type | `battleType` | Participants | `team` | `role` | `placement` |
|---|---|---|---|---|---|
| League (1v1) | `"league"` | 2 | 1 or 2 | null | null |
| Tournament | `"tournament"` | 2 | 1 or 2 | null | null |
| Tag Team (2v2) | `"tag_team"` | 4 | 1 or 2 | `"active"` or `"reserve"` | null |
| King of the Hill | `"koth"` | 5-6 | 1 (FFA) | null | 1-6 |

---

## Bye Battle Records (Spec #49)

A **bye** is what a subscribed robot gets when the schedule has nothing for it to fight: an odd number of entrants, a `koth`/`grand_melee` tier instance below its `MIN_GROUP_SIZE`, or a non-power-of-two tournament bracket. Byes exist in all nine battle modes and every one of them writes the same record.

### The record every bye writes

| Artefact | Count | Notes |
|---|---|---|
| `battles` | 1 | `battleLog.isByeMatch: true`, `durationSeconds: 15`, `loserReward: 0` |
| `battle_participants` | one per **real** robot | Never a row for a Bye_Placeholder — those carry negative ids and the `robot` FK would reject them |
| `battle_summaries` | 1 | `hasData: false`, `totalEvents: 0` — a truthful, queryable marker that no combat occurred |
| `audit_logs` (`battle_complete`) | one per real robot | `payload.isByeMatch: true` plus the credits paid |
| Credit award | 1 | Through `awardCreditsWithLedger` with `battle_income` |

Before Spec #49 this was uneven: a `league_1v1` bye wrote no summary and no audit row (its early return preceded both), a `tag_team` bye wrote no audit row, and the three tournament modes wrote **no `battles` row at all** — which is why no tournament bye was visible anywhere.

### Participant column values

Every bye participant row is inert by construction, because nothing is simulated:

| Column | Value |
|---|---|
| `damageDealt` | `0` |
| `finalHP` | the robot's `currentHP` at the time of the bye — unchanged |
| `destroyed`, `yielded` | `false` |
| `prestigeAwarded`, `fameAwarded`, `streamingRevenue` | `0` |
| `eloBefore` / `eloAfter` | differ only in the four league modes; equal in tournaments and Placement_Modes |
| `credits` | share of the stable award; the shares sum to it exactly |

### This satisfies the summary rule, which byes used to violate

This document requires a `BattleSummary` at battle creation. The `league_1v1` bye path violated that rule for as long as it existed — `computeBattleSummary` sat inside `createBattleRecord`, which only the fought path called. Routing every bye through `resolveByeEvent` closes it for all nine modes at once.

### Where the code lives

- Amounts: `app/backend/src/utils/byeRewards.ts` (`resolveByeReward`, `BYE_MODE_SPECS`)
- Records: `app/backend/src/services/battle/byeResolutionService.ts` (`resolveByeEvent`)
- Placement_Mode bye creation: `app/backend/src/services/scheduling/thinInstanceByes.ts`

---

## Forfeit Battle Records (#536)

A **forfeit** is what happens when a robot has no main weapon when its battle starts. The battle-time check (`services/battle/combatReadiness.ts`) runs in every orchestrator on the robots loaded for the battle. A forfeit is never simulated.

### Two-sided modes (league 1v1, 2v2/3v3, tag team, solo and team tournaments)

One writer, `resolveForfeitEvent` (`services/battle/forfeitResolutionService.ts`), modelled on the bye writer and sharing its claim (`walkoverClaim.ts`):

| Artefact | Count | Notes |
|---|---|---|
| `battles` | 1 | `durationSeconds: 15`, `winnerReward` = the bye-level reward (0 on a double forfeit), `loserReward: 0`; `winnerId`/`winningSide` = the ready side, both `null` on a double forfeit |
| `battle_participants` | one per robot of both sides | `forfeited: true` on every robot of the forfeiting side; `credits` 0 for the forfeiter; `damageDealt: 0`; `finalHP` = `currentHP` (unchanged) |
| `battle_summaries` | 1 | `hasData: false`, `totalEvents: 0` |
| `standings` | per side | the ready side wins, the forfeiter loses (league LP and ELO as for a fought result); a double forfeit is a draw. Tournaments write no standings |
| `audit_logs` (`battle_complete`) | one per robot | `payload.forfeit: true`, `forfeited`, `forfeitReason`; `isByeMatch: false` |
| Credit award | 0 or 1 per receiving stable | `battle_income` through `awardCreditsWithLedger`, `forfeit:` identity (see the Financial Ledger and Audit Guide) |

Knockout tournaments set `tournament_matches.status = 'forfeit'`. The forfeiter is eliminated. On a double forfeit the battle row is a draw and `tournament_matches.winnerId` names the higher seed, who advances without credits.

### Placement modes (KotH, Grand Melee)

Unready robots are split off with `partitionPlacementField` and the rest fight. Each forfeiter gets a `battle_participants` row in the fought battle with `forfeited: true`, `credits: 0`, the last placements (`ready + 1 … N`) and no rewards; `BattleSummary.kothPlacements` marks them `forfeited: true`. Standings record the placement with 0 points. When too few ready robots remain, `resolveBelowMinimumField` (`services/scheduling/thinInstanceByes.ts`) writes a forfeit-only battle for the forfeiters and queues normal per-robot byes for the ready robots.

### Classification is permanent

History and battle detail classify a forfeit from permanent data only (`classifyForfeit` in `matchHistoryService.ts`): any participant with `forfeited = true`, or a `tournament_matches` row with `status = 'forfeit'` linked to the battle. The `battleLog.isForfeit` flag is display data and is never read for classification.

---

## Robot Deletion and Battle Retention (#294)

`battle_participants.robot_id` is a RESTRICT foreign key. Any path that deletes robots while their battles stay must delete those robots' participant rows first, by robot id, inside the deleting transaction. The shared helper is `deleteRobotBattleReferences` (`services/robot/robotReferenceCleanup.ts`), used by:

- `performAccountReset` (`services/common/resetService.ts`) — a player's mid-season reset.
- `deleteGeneratedStables` (`services/season/seasonPurgeService.ts`) — Season_Rollover purge of Generated_Stables (the battles themselves are purged in a later rollover stage).

Durable battle rows outlive participants: the `battles` row, its `battle_summaries` row (which keeps each robot's name in `per_robot`) and every other robot's participant rows are kept. Readers must tolerate a missing side: the match history and battle log show it as `Unknown`, and the admin Battles list shows the side as `Unknown` with no winner marked; the battle stays a win (a draw is only `winnerId = null` and `winningSide = null`). Archive tables have no FK to robots or battles and are not touched.

A bye or walkover whose only participant was a deleted robot ends with zero participants; see the unpaid-walkover signature in the [Financial Ledger Audit Guide](../guides/FINANCIAL_LEDGER_AUDIT_GUIDE.md).

---

## Combat Log Storage

`battles.battle_log` holds the replay and debug data; the nightly retention job (`services/retention/battleLogRetentionService.ts`, 01:30 UTC) sets it to NULL after `BATTLE_LOG_RETENTION_DAYS` (7). Everything permanent lives in `battle_participants` and `battle_summaries`.

| Modes | `detailedCombatEvents` |
|---|---|
| League 1v1, 2v2, 3v3, Tag Team, all tournaments | Every simulator event, with `formulaBreakdown` (calculation text, components, result) on attack, critical, miss, counter and malfunction events, and positions |
| KotH, Grand Melee | `buildKothBattleLog` (`services/battle/combat-messages/kothEventConverter.ts`) under `KOTH_LOG_STORAGE`: every event with its formula breakdown, like the other modes. The log records this in `battleLog.storage = { formulas, sampled }`; logs without the marker predate it (sampled by `sampleEventsForStorage`, no formulas) |

Storing every KotH / Grand Melee event measured ×4–5 the size of the old log (Grand Melee ~20 MB raw JSON per battle; ≈ +5.5 GB for the 7-day window on ACC). If disk runs short, `sampled: true` in `KOTH_LOG_STORAGE` thins movement, range-transition and shield-regen events again (≈ +0.9 GB with formulas kept).

Formula breakdowns are admin-only: `/api/matches/battles/:id/log` strips `formulaBreakdown`, `rangePenalty` and `attackAngle` (`PLAYER_LOG_HIDDEN_FIELDS` in `matchHistoryService.ts`); the admin Battles routes (`/api/admin/battles/:id/log`, `/export`) serve them. The admin outcome rule (`services/admin/battles/battleOutcome.ts`) reads only permanent data.

---

## Battle Model (Current State)

The Battle table retains core battle metadata. Some legacy per-robot columns were removed (see Migration History), but it still contains robot references, tag team fields, and ELO tracking for backward compatibility.

Key fields on Battle:
- `robot1Id`, `robot2Id` — combatant references (still present)
- `winnerId` — winner's robot ID (null for draws; team ID for tag team)
- `battleType` — `"league"`, `"tournament"`, `"tag_team"`, `"koth"`
- `leagueType` — tier name (e.g., `"bronze"`, `"silver"`)
- `battleLog` — JSON combat event log
- `durationSeconds` — battle length
- `winnerReward`, `loserReward` — aggregate credit awards
- Tag team fields: `team1ActiveRobotId`, `team1ReserveRobotId`, etc.
- Tag team per-robot stats: `team1ActiveDamageDealt`, `team1ActiveFameAwarded`, etc.
- ELO tracking: `robot1ELOBefore`, `robot1ELOAfter`, `robot2ELOBefore`, `robot2ELOAfter`, `eloChange`

For the complete Battle schema, see [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md).

---

## What Moved to BattleParticipant

The following per-robot data is now stored exclusively in BattleParticipant (removed from Battle):

| Data | Old Battle Columns | New Location |
|---|---|---|
| Final HP | `robot1FinalHP`, `robot2FinalHP` | `BattleParticipant.finalHP` |
| Yielded | `robot1Yielded`, `robot2Yielded` | `BattleParticipant.yielded` |
| Destroyed | `robot1Destroyed`, `robot2Destroyed` | `BattleParticipant.destroyed` |
| Damage dealt | `robot1DamageDealt`, `robot2DamageDealt` | `BattleParticipant.damageDealt` |
| Prestige awarded | `robot1PrestigeAwarded`, `robot2PrestigeAwarded` | `BattleParticipant.prestigeAwarded` |
| Fame awarded | `robot1FameAwarded`, `robot2FameAwarded` | `BattleParticipant.fameAwarded` |

### What Stayed on Battle

These fields remain on the Battle table for backward compatibility, aggregate queries, or because they're battle-level (not per-robot) data:

- `robot1Id`, `robot2Id` — still used for quick combatant lookup
- ELO columns — kept for aggregate queries and backward compat
- `winnerReward`, `loserReward` — battle-level economic summary
- Tag team composition fields — needed for replay reconstruction
- Tag team per-robot damage/fame — legacy, also in BattleParticipant

---

## Query Patterns

### Before (Battle table, robot1/robot2 conditionals)

```typescript
const battles = await prisma.battle.findMany({
  where: { OR: [{ robot1Id: robotId }, { robot2Id: robotId }] }
});
battles.forEach(b => {
  const isRobot1 = b.robot1Id === robotId;
  const elo = isRobot1 ? b.robot1ELOAfter : b.robot2ELOAfter;
});
```

### After (BattleParticipant, direct lookup)

```typescript
const participations = await prisma.battleParticipant.findMany({
  where: { robotId },
  include: { battle: true }
});
participations.forEach(p => {
  const elo = p.eloAfter;       // No conditionals
  const credits = p.credits;    // Direct access
});
```

---

## Scalability

The BattleParticipant model scales to any number of robots per battle without schema changes:

| Format | Participants | Supported |
|---|---|---|
| 1v1 League | 2 | ✅ Current |
| 1v1 Tournament | 2 | ✅ Current |
| 2v2 Tag Team | 4 | ✅ Current |
| KotH (FFA) | 5-6 | ✅ Current |
| 3v3 | 6 | ✅ No schema change needed |
| Battle Royale | N | ✅ No schema change needed |

---

## Implementation Files

All paths relative to `app/backend/src/`.

| File | Responsibility |
|---|---|
| `services/league/leagueBattleOrchestrator.ts` | Creates Battle + 2 BattleParticipant records for league 1v1 |
| `services/tournament/tournamentBattleOrchestrator.ts` | Creates Battle + 2 BattleParticipant records for 1v1 tournaments |
| `services/tournament/teamTournamentBattleOrchestrator.ts` | Creates Battle + 2N BattleParticipant records for team tournaments |
| `services/team-battle/teamBattleOrchestrator.ts` | Creates Battle + 2N BattleParticipant records for 2v2/3v3 league |
| `services/tag-team/tagTeamScheduler.ts` + `tagTeamBattleRecord.ts` | Creates Battle + 2–4 BattleParticipant records for tag team |
| `services/koth/kothBattleOrchestrator.ts` | Creates Battle + 5-6 BattleParticipant records for KotH |
| `services/battle/battlePostCombat.ts` | Shared helpers: `updateRobotCombatStats()`, `awardStreamingRevenueForParticipant()`, `logBattleAuditEvent()`, `awardCreditsWithLedger()`, `awardPrestigeToUser()` |

---

## Post-Battle Robot State Update (Unified)

Every orchestrator calls `updateRobotCombatStats()` from `battlePostCombat.ts` for each participating robot after a battle. This is the SINGLE function responsible for persisting combat outcome to the `robots` table. No orchestrator uses inline `prisma.robot.update` for combat stats.

### Fields written by `updateRobotCombatStats`

| Field | Description | KotH exception |
|---|---|---|
| `currentHP` | Final HP clamped to stored `maxHP` | ✅ Written |
| `elo` | New absolute ELO value | Passes unchanged value |
| `totalBattles` | Lifetime battle counter | Skipped (`skipBattleCounters`) |
| `wins` / `losses` / `draws` | Lifetime outcome counters | Skipped |
| `kills` | Lifetime kill counter | Skipped |
| `damageDealtLifetime` | Cumulative damage dealt | ✅ Written |
| `damageTakenLifetime` | Cumulative damage received | ✅ Written |
| `fame` | Incremented by `fameIncrement` param | ✅ Written (0 for KotH, handled separately) |
| `offensiveWins` / `defensiveWins` / `balancedWins` | Stance win counters (winner only) | Skipped |
| `dualWieldWins` | Loadout win counter (winner only) | Skipped |

### What lives outside `updateRobotCombatStats` (per-mode logic)

| Concern | Where | Why separate |
|---|---|---|
| Credits / prestige | `awardCreditsWithLedger()`, `awardPrestigeToUser()` | Reward formulas differ per mode and per tier |
| LP / streaks / tier | `standingsService.recordBattleResult()` | Per-mode standings in unified `standings` table |
| Achievements | `checkAndAwardAchievements()` | Context differs per mode (placement, previous battle, etc.) |
| Streaming revenue | `awardStreamingRevenueForParticipant()` | Mode-specific eligibility rules |
| KotH points | `standingsService.awardKothPoints()` | Placement-based scoring unique to KotH |

### Standings lifecycle

Battle recording updates existing `standings` rows; it does not decide when a row exists. The rule lives in `services/standings/standingPlacement.ts`:

- **Created** the first time the entity becomes matchable by subscription: a robot holds `league_1v1`/`koth`/`grand_melee`, or a complete team has every member subscribed to `league_2v2`/`tag_team` (2-robot teams) or `league_3v3` (3-robot teams). Callers are `subscriptionService.applySubscriptionChange` (`ensureStandingsForSubscriptionGain`), `teamBattleService.registerTeam` and `swapTeamMember` (`ensureTeamStandings`), plus the generator/seed paths. New rows start in Bronze, 0 LP, in the least-full Bronze instance (`leagueInstancePlacement.pickLeagueInstanceInTransaction`). Robot and team creation create no rows.
- **Kept** on unsubscribe and on member swap.
- **Deleted** explicitly (the table is polymorphic with no FK): team disband, account reset, generated-stable purge and the season rollover purge.
- `standingsService.recordBattleResult()` updates the row by id. `getOrCreateStanding()` is a safety net: for standing-backed modes it places through `ensureStanding` and logs `[Standings] Safety net created a missing standing` when it had to create one, which indicates a caller bypassed the rule.

### Bye-match handling

All orchestrators fabricate bye opponents in-memory (id < 0). They never exist in the database.

| Mode | Bye detection | Battle record FK | BattleParticipant |
|---|---|---|---|
| 1v1 League | `scheduledMatch.robot1Id < 0 \|\| robot2Id < 0` | `robot2Id = realRobot.id` (self-ref) | Only real robot |
| 2v2/3v3 League | `match.team2Id === null` | `robot2Id = team1Robots[0].id` | `.filter(p => p.robotId > 0)` |
| Tag Team | `match.team2Id === null` | `robot2Id = team1.activeRobotId`, team2 fields = null | `.filter(p => p.robotId > 0)` |
| Team Tournament | Bye = no match scheduled (bracket logic) | N/A | N/A |

### Match failure policy

An unexpected error in one match never stops the run. Every orchestrator's per-match catch calls `handleMatchFailure` (`services/battle/matchFailurePolicy.ts`); tournaments go through `recoverTournamentMatch`, which first gives a linked fought battle one idempotent resume.

| Situation | Result |
|---|---|
| League 1v1, team league, tag team, KotH, Grand Melee | The queued match is set to `cancelled` with the error summary in `cancelReason`. No rewards. Never retried, reset to `scheduled` or left `error` |
| Tournament match with a linked fought battle | One in-run resume; if that fails too, the row is finalised `completed` with the battle's winner |
| Tournament match with nothing fought | `cancelled`, `winnerId` = the higher seed (it advances), no battle row, no rewards, no ELO/stat change. Exception: the battle row and the robots' ELO/stat updates are written before `battleId` is linked, so an error in that window also lands here while an unlinked fought battle with its ELO/stat changes exists (possibly won by the lower seed). It is never paid (income follows the link); the guide §11 has the query that finds it |
| Failed tournament bye | The sole participant advances without reward |
| Already-terminal row | No write; logged as `battle_match_already_terminal` |

Each branch logs a structured `error` event (`battle_match_cancelled`, `battle_match_finalized_after_error`, `battle_match_resumed_after_error`, `battle_match_cancel_failed`). Money is never paid twice; the reconciliation signatures for partial payments are in the Financial Ledger and Audit Guide §11.

---

## Related Documentation

- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) — Complete schema including Battle and BattleParticipant models
- [BATTLE_SIMULATION_ARCHITECTURE.md](BATTLE_SIMULATION_ARCHITECTURE.md) — Battle engine, orchestrators, data flow diagrams
- [PRD_AUDIT_SYSTEM.md](PRD_AUDIT_SYSTEM.md) — Audit log architecture (one event per robot per battle)
