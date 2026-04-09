# Design Document: Battle Replay/Revert Admin Feature

## Overview

This design document describes the architecture for an admin feature that allows reverting and replaying battles from the current (open) cycle. The feature addresses the need to fix battles affected by bugs (like the tag team phase bugs in battle #509) by atomically undoing all battle effects and optionally re-running the battle with corrected code.

### Key Design Decisions

1. **Current-cycle-only constraint**: Reverting battles from closed cycles would require cascading reversions of league rebalancing, matchmaking, and analytics snapshots. This complexity is avoided by restricting the feature to the current cycle only.

2. **Atomic transactions**: All revert operations execute within a single database transaction to ensure data consistency.

3. **BattleParticipant as source of truth**: The BattleParticipant records contain all per-robot data needed to calculate reversions (ELO before/after, damage, rewards).

4. **New Battle fields**: The Battle model gains `revertedAt`, `revertedBy`, and `replayOfBattleId` fields to track revert/replay history.

5. **Separate services**: BattleRevertService handles reversion logic; BattleReplayService handles re-execution using existing orchestrators.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ADMIN PANEL (Frontend)                           │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    BattleRevertTab.tsx                           │   │
│  │                                                                   │   │
│  │  ┌─────────────┐  ┌──────────────────┐  ┌──────────────────┐    │   │
│  │  │ Battle ID   │  │ Preview Panel    │  │ Action Buttons   │    │   │
│  │  │ Input       │  │ (before/after)   │  │ Revert | Replay  │    │   │
│  │  └─────────────┘  └──────────────────┘  └──────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        ADMIN API ROUTES                                 │
│                                                                         │
│  GET  /api/admin/battles/:id/revert-preview                            │
│  POST /api/admin/battles/:id/revert                                    │
│  POST /api/admin/battles/:id/replay                                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           SERVICES                                      │
│                                                                         │
│  ┌─────────────────────────┐    ┌─────────────────────────┐            │
│  │   BattleRevertService   │    │   BattleReplayService   │            │
│  │                         │    │                         │            │
│  │  - validateBattle()     │    │  - replayBattle()       │            │
│  │  - calculatePreview()   │    │  - loadOriginalConfig() │            │
│  │  - executeRevert()      │    │  - callOrchestrator()   │            │
│  │  - revertRobotStats()   │    │                         │            │
│  │  - revertUserStats()    │    │                         │            │
│  │  - revertMatchStatus()  │    │                         │            │
│  └───────────┬─────────────┘    └───────────┬─────────────┘            │
│              │                              │                           │
│              ▼                              ▼                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    EXISTING ORCHESTRATORS                        │   │
│  │  leagueBattleOrchestrator | tournamentBattleOrchestrator        │   │
│  │  tagTeamBattleOrchestrator | kothBattleOrchestrator             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           DATABASE                                      │
│                                                                         │
│  ┌─────────────┐  ┌───────────────────┐  ┌─────────────────────────┐   │
│  │   Battle    │  │ BattleParticipant │  │      AuditLog           │   │
│  │             │  │                   │  │                         │   │
│  │ +revertedAt │  │ eloBefore/After   │  │ eventType:              │   │
│  │ +revertedBy │  │ credits           │  │   battle_reverted       │   │
│  │ +replayOf   │  │ streamingRevenue  │  │   battle_replayed       │   │
│  │  BattleId   │  │ prestigeAwarded   │  │                         │   │
│  └─────────────┘  │ fameAwarded       │  └─────────────────────────┘   │
│                   │ damageDealt       │                                 │
│  ┌─────────────┐  │ finalHP           │  ┌─────────────────────────┐   │
│  │   Robot     │  └───────────────────┘  │    CycleMetadata        │   │
│  │             │                         │                         │   │
│  │ currentHP   │  ┌───────────────────┐  │ totalCycles (current)   │   │
│  │ elo         │  │  Match Tables     │  └─────────────────────────┘   │
│  │ leaguePoints│  │                   │                                 │
│  │ fame        │  │ ScheduledLeague   │                                 │
│  │ wins/losses │  │ ScheduledTagTeam  │                                 │
│  │ damageStats │  │ ScheduledKoth     │                                 │
│  │ kothStats   │  │ ScheduledTourn.   │                                 │
│  │ tagTeamStats│  └───────────────────┘                                 │
│  └─────────────┘                                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. BattleRevertService

Location: `app/backend/src/services/battleRevertService.ts`

```typescript
interface RevertPreview {
  battleId: number;
  battleType: 'league' | 'tournament' | 'tag_team' | 'koth';
  cycleNumber: number;
  isCurrentCycle: boolean;
  
  battle: {
    current: { winnerId: number | null; durationSeconds: number };
    willBecome: { revertedAt: Date; revertedBy: number };
  };
  
  participants: Array<{
    robotId: number;
    robotName: string;
    userId: number;
    username: string;
    team: number;
    role: string | null;
    
    robot: {
      current: RobotStats;
      reverted: RobotStats;
    };
    
    user: {
      current: UserStats;
      reverted: UserStats;
    };
  }>;
  
  auditLogsToMark: number; // Count of AuditLog entries to mark as reverted
  
  matchRecord: {
    table: 'ScheduledLeagueMatch' | 'ScheduledTagTeamMatch' | 'ScheduledKothMatch' | 'ScheduledTournamentMatch';
    id: number;
    currentStatus: string;
    revertedStatus: 'scheduled';
  } | null;
}

interface RobotStats {
  currentHP: number;
  currentShield: number;
  elo: number;
  leaguePoints: number;
  fame: number;
  wins: number;
  losses: number;
  draws: number;
  damageDealtLifetime: number;
  damageTakenLifetime: number;
  kills: number;
  // Tag team stats (if applicable)
  totalTagTeamBattles?: number;
  totalTagTeamWins?: number;
  totalTagTeamLosses?: number;
  totalTagTeamDraws?: number;
  timesTaggedIn?: number;
  timesTaggedOut?: number;
  // KotH stats (if applicable)
  kothWins?: number;
  kothMatches?: number;
  kothTotalZoneScore?: number;
  kothTotalZoneTime?: number;
  kothKills?: number;
  kothBestPlacement?: number | null;
  kothCurrentWinStreak?: number;
  kothBestWinStreak?: number;
}

interface UserStats {
  currency: number;
  prestige: number;
  totalBattles: number;
  totalWins: number;
}

interface RevertResult {
  success: boolean;
  battleId: number;
  revertedAt: Date;
  revertedBy: number;
  summary: {
    robotsReverted: number;
    usersReverted: number;
    auditLogsMarked: number;
    matchRecordReset: boolean;
  };
}

class BattleRevertService {
  // Validates battle exists, not already reverted, and is from current cycle
  async validateBattle(battleId: number): Promise<ValidationResult>;
  
  // Calculates all changes that will occur without executing them
  async calculatePreview(battleId: number, adminUserId: number): Promise<RevertPreview>;
  
  // Executes the revert within a transaction
  async executeRevert(battleId: number, adminUserId: number): Promise<RevertResult>;
  
  // Internal helpers
  private async getCurrentCycleNumber(): Promise<number>;
  private async getBattleCycleNumber(battleId: number): Promise<number>;
  private calculateRevertedRobotStats(participant: BattleParticipant, robot: Robot): RobotStats;
  private calculateRevertedUserStats(participants: BattleParticipant[], user: User): UserStats;
}
```

### 2. BattleReplayService

Location: `app/backend/src/services/battleReplayService.ts`

```typescript
interface ReplayConfig {
  battleId: number;
  adminUserId: number;
}

interface ReplayResult {
  success: boolean;
  originalBattleId: number;
  newBattleId: number;
  newBattle: {
    winnerId: number | null;
    durationSeconds: number;
    isDraw: boolean;
  };
}

class BattleReplayService {
  // Replays a reverted battle using the same robot configurations
  async replayBattle(config: ReplayConfig): Promise<ReplayResult>;
  
  // Loads original robot configurations from BattleParticipant and Battle data
  private async loadOriginalConfig(battleId: number): Promise<BattleConfig>;
  
  // Calls the appropriate orchestrator based on battle type
  private async callOrchestrator(
    battleType: string,
    config: BattleConfig,
    originalBattleId: number
  ): Promise<number>;
}

interface BattleConfig {
  battleType: 'league' | 'tournament' | 'tag_team' | 'koth';
  leagueType: string;
  participants: Array<{
    robotId: number;
    team: number;
    role: string | null;
    // Pre-battle state (from eloBefore, calculated HP)
    eloBefore: number;
    hpBefore: number;
    shieldBefore: number;
  }>;
  // For tournament battles
  tournamentId?: number;
  tournamentRound?: number;
  // For tag team battles
  team1Id?: number;
  team2Id?: number;
  // For KotH battles
  kothMatchId?: number;
  rotatingZone?: boolean;
}
```

### 3. Admin API Routes

Location: `app/backend/src/routes/admin.ts` (additions)

```typescript
// GET /api/admin/battles/:id/revert-preview
// Returns: RevertPreview | ErrorResponse
router.get('/battles/:id/revert-preview', requireAdmin, async (req, res) => {
  const battleId = parseInt(req.params.id);
  const adminUserId = req.user.id;
  
  const validation = await battleRevertService.validateBattle(battleId);
  if (!validation.valid) {
    return res.status(validation.statusCode).json({ error: validation.message });
  }
  
  const preview = await battleRevertService.calculatePreview(battleId, adminUserId);
  return res.json(preview);
});

// POST /api/admin/battles/:id/revert
// Returns: RevertResult | ErrorResponse
router.post('/battles/:id/revert', requireAdmin, async (req, res) => {
  const battleId = parseInt(req.params.id);
  const adminUserId = req.user.id;
  
  const result = await battleRevertService.executeRevert(battleId, adminUserId);
  return res.json(result);
});

// POST /api/admin/battles/:id/replay
// Returns: ReplayResult | ErrorResponse
router.post('/battles/:id/replay', requireAdmin, async (req, res) => {
  const battleId = parseInt(req.params.id);
  const adminUserId = req.user.id;
  
  const result = await battleReplayService.replayBattle({ battleId, adminUserId });
  return res.json(result);
});
```

### 4. Frontend Component

Location: `app/frontend/src/components/admin/BattleRevertTab.tsx`

```typescript
interface BattleRevertTabProps {
  // No props needed - self-contained component
}

interface BattleRevertTabState {
  battleId: string;
  preview: RevertPreview | null;
  loading: boolean;
  error: string | null;
  revertInProgress: boolean;
  replayInProgress: boolean;
  result: RevertResult | ReplayResult | null;
}

// Component structure:
// - Battle ID input with validation
// - "Load Preview" button
// - Preview panel showing:
//   - Cycle number and current-cycle status
//   - Warning if closed cycle (with disabled buttons)
//   - Battle info (type, winner, duration)
//   - Participants table with before/after columns
//   - Affected audit logs count
//   - Match record status
// - "Revert Battle" button (disabled until preview loaded)
// - "Revert and Replay" button (executes revert then replay)
// - Result display (success message or error)
```

## Data Models

### Schema Changes

Add to `app/backend/prisma/schema.prisma`:

```prisma
model Battle {
  // ... existing fields ...
  
  // Revert tracking
  revertedAt       DateTime? @map("reverted_at")
  revertedBy       Int?      @map("reverted_by")
  replayOfBattleId Int?      @map("replay_of_battle_id")
  
  // Self-relation for replay chain
  replayOfBattle   Battle?   @relation("BattleReplay", fields: [replayOfBattleId], references: [id])
  replays          Battle[]  @relation("BattleReplay")
  
  @@index([revertedAt])
  @@index([replayOfBattleId])
}
```

### Cycle Number Determination

The battle's cycle number is determined by querying the AuditLog for `battle_complete` events with the matching `battleId`. The current cycle number comes from `CycleMetadata.totalCycles`.

```typescript
async function getBattleCycleNumber(battleId: number): Promise<number | null> {
  const auditLog = await prisma.auditLog.findFirst({
    where: { battleId, eventType: 'battle_complete' },
    select: { cycleNumber: true }
  });
  return auditLog?.cycleNumber ?? null;
}

async function getCurrentCycleNumber(): Promise<number> {
  const metadata = await prisma.cycleMetadata.findFirst();
  return metadata?.totalCycles ?? 0;
}
```

### Revert Calculation Logic

For each BattleParticipant, calculate the delta to reverse:

```typescript
function calculateRevertedRobotStats(
  participant: BattleParticipant,
  robot: Robot,
  battleType: string,
  wasWinner: boolean,
  wasDraw: boolean
): RobotStats {
  const reverted: RobotStats = {
    // ELO: restore to eloBefore
    elo: participant.eloBefore,
    
    // HP: restore to maxHP (battles start at full HP)
    currentHP: robot.maxHP,
    currentShield: robot.maxShield,
    
    // League points: reverse the change (+3 win, -1 loss, +1 draw)
    leaguePoints: robot.leaguePoints - calculateLPChange(wasWinner, wasDraw),
    
    // Fame: subtract awarded fame
    fame: robot.fame - participant.fameAwarded,
    
    // Win/loss/draw counters
    wins: robot.wins - (wasWinner && !wasDraw ? 1 : 0),
    losses: robot.losses - (!wasWinner && !wasDraw ? 1 : 0),
    draws: robot.draws - (wasDraw ? 1 : 0),
    
    // Damage stats
    damageDealtLifetime: robot.damageDealtLifetime - participant.damageDealt,
    damageTakenLifetime: robot.damageTakenLifetime - calculateDamageTaken(participant),
    
    // Kills (if opponent was destroyed)
    kills: robot.kills - (participant.destroyed ? 0 : opponentDestroyed ? 1 : 0),
  };
  
  // Add battle-type-specific stats
  if (battleType === 'tag_team') {
    reverted.totalTagTeamBattles = robot.totalTagTeamBattles - 1;
    reverted.totalTagTeamWins = robot.totalTagTeamWins - (wasWinner ? 1 : 0);
    reverted.totalTagTeamLosses = robot.totalTagTeamLosses - (!wasWinner && !wasDraw ? 1 : 0);
    reverted.totalTagTeamDraws = robot.totalTagTeamDraws - (wasDraw ? 1 : 0);
    // timesTaggedIn/Out require parsing battle log
  }
  
  if (battleType === 'koth') {
    reverted.kothMatches = robot.kothMatches - 1;
    reverted.kothWins = robot.kothWins - (participant.placement === 1 ? 1 : 0);
    // kothTotalZoneScore, kothTotalZoneTime, kothKills require parsing battle log
    // kothBestPlacement, kothCurrentWinStreak, kothBestWinStreak are complex to reverse
  }
  
  return reverted;
}

function calculateRevertedUserStats(
  participants: BattleParticipant[],
  user: User
): UserStats {
  // Sum all rewards for this user's robots in the battle
  const totalCredits = participants.reduce((sum, p) => sum + p.credits, 0);
  const totalStreaming = participants.reduce((sum, p) => sum + p.streamingRevenue, 0);
  const totalPrestige = participants.reduce((sum, p) => sum + p.prestigeAwarded, 0);
  const wasWinner = participants.some(p => p.robotId === battle.winnerId);
  
  return {
    currency: user.currency - totalCredits - totalStreaming,
    prestige: user.prestige - totalPrestige,
    totalBattles: user.totalBattles - 1,
    totalWins: user.totalWins - (wasWinner ? 1 : 0),
  };
}
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Preview Completeness

*For any* valid battle ID from the current cycle, the revert preview SHALL contain all required fields: battle info (winnerId, durationSeconds), all BattleParticipant records with economic and stat data (eloBefore, eloAfter, credits, streamingRevenue, prestigeAwarded, fameAwarded, damageDealt, finalHP), all affected Robot stats (current and reverted values), all affected User stats (current and reverted values), audit log count, match record info, and cycle number with current-cycle indicator.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.11**

### Property 2: Closed-Cycle Rejection

*For any* battle where the battle's cycle number is less than the current cycle number (from CycleMetadata.totalCycles), both the preview endpoint and the revert execution endpoint SHALL return a 400 error indicating the battle cannot be reverted because it is from a closed cycle.

**Validates: Requirements 1.10, 2.1**

### Property 3: Revert Atomicity

*For any* revert operation that fails at any step (robot update, user update, audit log marking, match status reset), the entire transaction SHALL be rolled back and no partial changes SHALL persist in the database.

**Validates: Requirements 2.2, 2.10**

### Property 4: Revert Restores Pre-Battle State

*For any* successfully reverted battle, each participating robot's stats SHALL equal their pre-battle values: ELO equals eloBefore from BattleParticipant, HP equals maxHP, wins/losses/draws decremented appropriately, damageDealtLifetime reduced by damageDealt, fame reduced by fameAwarded. For tag team battles, tag team stats SHALL also be restored. For KotH battles, KotH stats SHALL also be restored. Each affected user's currency SHALL be reduced by (credits + streamingRevenue), prestige reduced by prestigeAwarded, and totalBattles/totalWins decremented appropriately.

**Validates: Requirements 2.3, 2.4, 2.5, 2.6**

### Property 5: Revert Marks Affected Records

*For any* successfully reverted battle, the Battle record SHALL have revertedAt set to the current timestamp and revertedBy set to the admin user ID, all associated AuditLog entries SHALL have `reverted: true` in their payload, the linked match record (ScheduledLeagueMatch, ScheduledTagTeamMatch, ScheduledKothMatch, or ScheduledTournamentMatch) SHALL have status reset to "scheduled" and battleId cleared, and a new AuditLog entry with eventType "battle_reverted" SHALL be created.

**Validates: Requirements 2.7, 2.8, 2.9, 2.11**

### Property 6: Replay Uses Original Configuration

*For any* replay of a reverted battle, the Battle_Replay_Service SHALL load the original robot configurations from BattleParticipant records (using eloBefore for ELO, calculating HP from robot attributes), use the same robots and team assignments as the original battle, and call the correct orchestrator based on battleType (leagueBattleOrchestrator for "league", tournamentBattleOrchestrator for "tournament", tagTeamBattleOrchestrator for "tag_team", kothBattleOrchestrator for "koth").

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 7: Replay Creates Valid Battle

*For any* successful replay, a new Battle record SHALL be created with replayOfBattleId referencing the original battle, new BattleParticipant records SHALL be created for all robots, Robot and User stats SHALL be updated as normal battle execution would, new AuditLog entries with eventType "battle_complete" SHALL be created for each robot, and an AuditLog entry with eventType "battle_replayed" SHALL be created linking the original and new battle IDs.

**Validates: Requirements 3.4, 3.5, 3.6, 3.7, 3.8**

### Property 8: Battle Type Handling

*For any* battle type (league, tournament, tag_team, koth), the Battle_Revert_Service SHALL correctly identify the type from Battle.battleType, handle the appropriate match table (ScheduledLeagueMatch, ScheduledTournamentMatch, ScheduledTagTeamMatch, ScheduledKothMatch), and process all participants (2 for league/tournament, 4 for tag_team, 5-6 for koth). For tournament battles, bracket progression SHALL NOT be affected by revert.

**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

### Property 9: Admin Authorization

*For any* request to the revert preview, revert execution, or replay execution endpoints, if the requesting user does not have admin role, the endpoint SHALL return a 401 or 403 error and no operation SHALL be performed.

**Validates: Requirements 6.1, 6.2, 6.3**

### Property 10: Audit Completeness

*For any* revert operation, the AuditLog entry SHALL contain: eventType "battle_reverted", adminUserId, battleId, timestamp, and payload with summary of all reverted values. *For any* replay operation, the AuditLog entry SHALL contain: eventType "battle_replayed", adminUserId, originalBattleId, newBattleId, and timestamp. Both entry types SHALL be queryable via the existing admin audit log interface.

**Validates: Requirements 6.4, 6.5, 6.6**


## Error Handling

### Error Codes and Responses

The feature introduces new error types in the existing error hierarchy:

```typescript
// Add to src/errors/battleError.ts
export enum BattleRevertErrorCode {
  BATTLE_NOT_FOUND = 'BATTLE_NOT_FOUND',
  BATTLE_ALREADY_REVERTED = 'BATTLE_ALREADY_REVERTED',
  CLOSED_CYCLE_BATTLE = 'CLOSED_CYCLE_BATTLE',
  UNSUPPORTED_BATTLE_TYPE = 'UNSUPPORTED_BATTLE_TYPE',
  REVERT_NOT_COMPLETED = 'REVERT_NOT_COMPLETED',
  REVERT_TRANSACTION_FAILED = 'REVERT_TRANSACTION_FAILED',
  REPLAY_TRANSACTION_FAILED = 'REPLAY_TRANSACTION_FAILED',
}
```

### Error Response Format

All errors follow the standard `AppError` format:

```typescript
{
  error: string;      // Human-readable message
  code: string;       // Error code from enum
  details?: {         // Optional additional context
    battleId?: number;
    cycleNumber?: number;
    currentCycle?: number;
    battleType?: string;
  };
}
```

### Error Scenarios

| Scenario | Status Code | Error Code | Message |
|----------|-------------|------------|---------|
| Battle ID not found | 404 | BATTLE_NOT_FOUND | "Battle not found" |
| Battle already reverted | 400 | BATTLE_ALREADY_REVERTED | "Battle already reverted" |
| Battle from closed cycle | 400 | CLOSED_CYCLE_BATTLE | "Cannot revert battles from closed cycles. Battle is from cycle {N}, current cycle is {M}." |
| Unknown battle type | 400 | UNSUPPORTED_BATTLE_TYPE | "Unsupported battle type: {type}" |
| Replay without revert | 400 | REVERT_NOT_COMPLETED | "Battle must be reverted before replay" |
| Transaction failure | 500 | REVERT_TRANSACTION_FAILED | "Revert failed: {details}" |
| Replay failure | 500 | REPLAY_TRANSACTION_FAILED | "Replay failed: {details}" |
| Not admin | 403 | FORBIDDEN | "Admin access required" |

### Transaction Rollback

All database operations in `executeRevert()` are wrapped in a Prisma transaction:

```typescript
async executeRevert(battleId: number, adminUserId: number): Promise<RevertResult> {
  return await prisma.$transaction(async (tx) => {
    // 1. Validate battle (throws if invalid)
    const battle = await this.validateAndLoadBattle(tx, battleId);
    
    // 2. Load all participants with robots and users
    const participants = await this.loadParticipants(tx, battleId);
    
    // 3. Revert robot stats
    for (const p of participants) {
      await this.revertRobotStats(tx, p);
    }
    
    // 4. Revert user stats
    const userIds = [...new Set(participants.map(p => p.robot.userId))];
    for (const userId of userIds) {
      await this.revertUserStats(tx, userId, participants);
    }
    
    // 5. Mark audit logs
    await this.markAuditLogsReverted(tx, battleId);
    
    // 6. Reset match status
    await this.resetMatchStatus(tx, battle);
    
    // 7. Mark battle as reverted
    await tx.battle.update({
      where: { id: battleId },
      data: { revertedAt: new Date(), revertedBy: adminUserId }
    });
    
    // 8. Create revert audit log
    await this.createRevertAuditLog(tx, battleId, adminUserId, participants);
    
    return { success: true, ... };
  }, {
    timeout: 30000, // 30 second timeout for complex reverts
    isolationLevel: 'Serializable' // Ensure consistency
  });
}
```

## Testing Strategy

### Property-Based Testing Configuration

- **Library**: fast-check (already in project dependencies)
- **Minimum iterations**: 100 per property test
- **Tag format**: `Feature: battle-replay-admin, Property {N}: {description}`

### Test File Structure

```
app/backend/src/__tests__/
├── services/
│   ├── battleRevertService.test.ts      # Unit tests
│   ├── battleRevertService.property.ts  # Property tests
│   ├── battleReplayService.test.ts      # Unit tests
│   └── battleReplayService.property.ts  # Property tests
└── integration/
    └── battleRevert.integration.test.ts # End-to-end tests

app/frontend/src/components/admin/__tests__/
└── BattleRevertTab.test.tsx             # Component tests
```

### Property Tests

Each correctness property maps to one or more property-based tests:

```typescript
// battleRevertService.property.ts
import fc from 'fast-check';

describe('BattleRevertService Properties', () => {
  // Feature: battle-replay-admin, Property 1: Preview Completeness
  it('should return complete preview for any valid current-cycle battle', async () => {
    await fc.assert(
      fc.asyncProperty(
        validCurrentCycleBattleArb,
        async (battle) => {
          const preview = await service.calculatePreview(battle.id, adminUserId);
          
          // Verify all required fields present
          expect(preview.battleId).toBe(battle.id);
          expect(preview.cycleNumber).toBeDefined();
          expect(preview.isCurrentCycle).toBe(true);
          expect(preview.battle.current).toBeDefined();
          expect(preview.participants.length).toBeGreaterThan(0);
          
          for (const p of preview.participants) {
            expect(p.robot.current).toBeDefined();
            expect(p.robot.reverted).toBeDefined();
            expect(p.user.current).toBeDefined();
            expect(p.user.reverted).toBeDefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: battle-replay-admin, Property 2: Closed-Cycle Rejection
  it('should reject any battle from a closed cycle', async () => {
    await fc.assert(
      fc.asyncProperty(
        closedCycleBattleArb,
        async (battle) => {
          await expect(service.calculatePreview(battle.id, adminUserId))
            .rejects.toThrow('Cannot revert battles from closed cycles');
          
          await expect(service.executeRevert(battle.id, adminUserId))
            .rejects.toThrow('Cannot revert battles from closed cycles');
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: battle-replay-admin, Property 4: Revert Restores Pre-Battle State
  it('should restore pre-battle state for any reverted battle', async () => {
    await fc.assert(
      fc.asyncProperty(
        validCurrentCycleBattleArb,
        async (battle) => {
          // Capture pre-revert state
          const preview = await service.calculatePreview(battle.id, adminUserId);
          
          // Execute revert
          await service.executeRevert(battle.id, adminUserId);
          
          // Verify each robot's stats match reverted values
          for (const p of preview.participants) {
            const robot = await prisma.robot.findUnique({ where: { id: p.robotId } });
            expect(robot.elo).toBe(p.robot.reverted.elo);
            expect(robot.currentHP).toBe(p.robot.reverted.currentHP);
            expect(robot.fame).toBe(p.robot.reverted.fame);
            // ... verify all stats
          }
          
          // Verify each user's stats match reverted values
          const userIds = [...new Set(preview.participants.map(p => p.userId))];
          for (const userId of userIds) {
            const user = await prisma.user.findUnique({ where: { id: userId } });
            const expectedUser = preview.participants.find(p => p.userId === userId).user.reverted;
            expect(user.currency).toBe(expectedUser.currency);
            expect(user.prestige).toBe(expectedUser.prestige);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Unit Tests

Unit tests cover specific examples and edge cases:

```typescript
// battleRevertService.test.ts
describe('BattleRevertService', () => {
  describe('validateBattle', () => {
    it('should return 404 for non-existent battle', async () => {
      await expect(service.validateBattle(999999))
        .rejects.toThrow('Battle not found');
    });

    it('should return 400 for already reverted battle', async () => {
      const battle = await createRevertedBattle();
      await expect(service.validateBattle(battle.id))
        .rejects.toThrow('Battle already reverted');
    });
  });

  describe('calculatePreview', () => {
    it('should include tag team stats for tag team battles', async () => {
      const battle = await createTagTeamBattle();
      const preview = await service.calculatePreview(battle.id, adminUserId);
      
      for (const p of preview.participants) {
        expect(p.robot.reverted.totalTagTeamBattles).toBeDefined();
        expect(p.robot.reverted.totalTagTeamWins).toBeDefined();
      }
    });

    it('should include KotH stats for KotH battles', async () => {
      const battle = await createKothBattle();
      const preview = await service.calculatePreview(battle.id, adminUserId);
      
      for (const p of preview.participants) {
        expect(p.robot.reverted.kothMatches).toBeDefined();
        expect(p.robot.reverted.kothWins).toBeDefined();
      }
    });
  });

  describe('executeRevert', () => {
    it('should rollback on partial failure', async () => {
      const battle = await createLeagueBattle();
      const originalRobot = await prisma.robot.findUnique({ where: { id: battle.robot1Id } });
      
      // Mock a failure mid-transaction
      jest.spyOn(prisma.auditLog, 'updateMany').mockRejectedValueOnce(new Error('DB error'));
      
      await expect(service.executeRevert(battle.id, adminUserId))
        .rejects.toThrow();
      
      // Verify robot stats unchanged
      const robot = await prisma.robot.findUnique({ where: { id: battle.robot1Id } });
      expect(robot.elo).toBe(originalRobot.elo);
    });
  });
});
```

### Integration Tests

Integration tests verify the complete flow:

```typescript
// battleRevert.integration.test.ts
describe('Battle Revert Integration', () => {
  it('should complete full revert and replay flow for league battle', async () => {
    // 1. Create a league battle
    const battle = await createAndExecuteLeagueBattle();
    
    // 2. Get preview
    const previewRes = await request(app)
      .get(`/api/admin/battles/${battle.id}/revert-preview`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(previewRes.status).toBe(200);
    
    // 3. Execute revert
    const revertRes = await request(app)
      .post(`/api/admin/battles/${battle.id}/revert`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(revertRes.status).toBe(200);
    expect(revertRes.body.success).toBe(true);
    
    // 4. Verify battle marked as reverted
    const revertedBattle = await prisma.battle.findUnique({ where: { id: battle.id } });
    expect(revertedBattle.revertedAt).toBeDefined();
    
    // 5. Execute replay
    const replayRes = await request(app)
      .post(`/api/admin/battles/${battle.id}/replay`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(replayRes.status).toBe(200);
    expect(replayRes.body.newBattleId).toBeDefined();
    
    // 6. Verify new battle linked to original
    const newBattle = await prisma.battle.findUnique({ where: { id: replayRes.body.newBattleId } });
    expect(newBattle.replayOfBattleId).toBe(battle.id);
  });

  it('should reject revert for closed-cycle battle', async () => {
    // Create battle in previous cycle
    const battle = await createBattleInCycle(currentCycle - 1);
    
    const res = await request(app)
      .post(`/api/admin/battles/${battle.id}/revert`)
      .set('Authorization', `Bearer ${adminToken}`);
    
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CLOSED_CYCLE_BATTLE');
  });
});
```

### Frontend Component Tests

```typescript
// BattleRevertTab.test.tsx
describe('BattleRevertTab', () => {
  it('should disable revert button until preview is loaded', () => {
    render(<BattleRevertTab />);
    
    const revertButton = screen.getByRole('button', { name: /revert battle/i });
    expect(revertButton).toBeDisabled();
  });

  it('should show warning for closed-cycle battles', async () => {
    mockApi.getRevertPreview.mockResolvedValue({
      isCurrentCycle: false,
      cycleNumber: 5,
      // ... other fields
    });
    
    render(<BattleRevertTab />);
    
    await userEvent.type(screen.getByLabelText(/battle id/i), '123');
    await userEvent.click(screen.getByRole('button', { name: /load preview/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/cannot revert battles from closed cycles/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /revert battle/i })).toBeDisabled();
    });
  });

  it('should display before/after comparison for robot stats', async () => {
    mockApi.getRevertPreview.mockResolvedValue(mockPreviewData);
    
    render(<BattleRevertTab />);
    
    await userEvent.type(screen.getByLabelText(/battle id/i), '123');
    await userEvent.click(screen.getByRole('button', { name: /load preview/i }));
    
    await waitFor(() => {
      // Verify comparison columns exist
      expect(screen.getByText(/current/i)).toBeInTheDocument();
      expect(screen.getByText(/after revert/i)).toBeInTheDocument();
      
      // Verify robot stats displayed
      expect(screen.getByText(/elo/i)).toBeInTheDocument();
      expect(screen.getByText(/fame/i)).toBeInTheDocument();
    });
  });
});
```

### Test Data Generators (Arbitraries)

```typescript
// testArbitraries.ts
import fc from 'fast-check';

// Generate a valid battle from the current cycle
export const validCurrentCycleBattleArb = fc.integer({ min: 1, max: 1000 })
  .chain(async (seed) => {
    // Create battle in current cycle with random participants
    const battle = await createTestBattle({
      cycleNumber: await getCurrentCycleNumber(),
      battleType: fc.sample(fc.constantFrom('league', 'tournament', 'tag_team', 'koth'), 1)[0],
      seed
    });
    return fc.constant(battle);
  });

// Generate a battle from a closed cycle
export const closedCycleBattleArb = fc.integer({ min: 1, max: 1000 })
  .chain(async (seed) => {
    const currentCycle = await getCurrentCycleNumber();
    const closedCycle = Math.max(1, currentCycle - fc.sample(fc.integer({ min: 1, max: 10 }), 1)[0]);
    
    const battle = await createTestBattle({
      cycleNumber: closedCycle,
      seed
    });
    return fc.constant(battle);
  });
```

## Documentation Impact

The following documentation files will need updates:

### Steering Files
- `.kiro/steering/project-overview.md` - Add mention of battle revert/replay admin feature
- `.kiro/steering/coding-standards.md` - No changes needed (follows existing patterns)

### Guide Documents
- `docs/guides/ADMIN_PANEL_GUIDE.md` - Add section for Battle Revert tab usage
- `docs/guides/ERROR_CODES.md` - Add new BattleRevertErrorCode entries

### PRD Documents
- `docs/prd_core/DATABASE_SCHEMA.md` - Document new Battle fields (revertedAt, revertedBy, replayOfBattleId)
- `docs/prd_pages/PRD_ADMIN_PAGE.md` - Add Battle Revert tab documentation
