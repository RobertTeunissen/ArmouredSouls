# Product Requirements Document: Battle Data Architecture

**Last Updated**: April 2, 2026  
**Status**: ✅ Implemented  
**Owner**: Robert Teunissen  
**Epic**: Battle System — Data Architecture  
**Version**: 2.0

---

## Version History
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
| `services/tournament/tournamentBattleOrchestrator.ts` | Creates Battle + 2 BattleParticipant records for tournaments |
| `services/tag-team/tagTeamBattleOrchestrator.ts` | Creates Battle + 4 BattleParticipant records for tag team |
| `services/koth/kothBattleOrchestrator.ts` | Creates Battle + 5-6 BattleParticipant records for KotH |
| `services/battle/battlePostCombat.ts` | Shared helpers: `awardStreamingRevenueForParticipant()`, `logBattleAuditEvent()`, `updateRobotCombatStats()` |

---

## Related Documentation

- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) — Complete schema including Battle and BattleParticipant models
- [BATTLE_SIMULATION_ARCHITECTURE.md](BATTLE_SIMULATION_ARCHITECTURE.md) — Battle engine, orchestrators, data flow diagrams
- [PRD_AUDIT_SYSTEM.md](PRD_AUDIT_SYSTEM.md) — Audit log architecture (one event per robot per battle)
