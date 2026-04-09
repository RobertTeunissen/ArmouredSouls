# Requirements Document

## Introduction

The Battle Replay/Revert feature provides administrators with the ability to undo and optionally replay battles that had bugs or issues. When a battle runs, it modifies multiple data entities: the Battle record, BattleParticipant records, Robot stats (ELO, HP, wins/losses, damage stats), User stats (currency, prestige), AuditLog entries, and ScheduledMatch/TagTeamMatch status. This feature enables reverting all these changes atomically and optionally re-running the battle with current (fixed) code.

This is essential for:
- Fixing battles that had bugs (like the tag team phase bugs in battle #509)
- Testing battle fixes on real match data
- Correcting incorrect rewards/stats from buggy battles

**Important Scope Limitation**: This feature only supports reverting/replaying battles from the current (open) cycle. Battles from closed cycles cannot be reverted because:
- League rebalancing has already promoted/demoted robots based on those results
- Next cycle's matchmaking was created based on the resulting ELO standings
- Tournament brackets may have already progressed
- Cycle analytics snapshots are frozen

Reverting closed-cycle battles would require cascading reversions of all downstream effects, which is extremely complex and risky. For closed-cycle issues, manual database corrections with careful analysis are recommended.

## Glossary

- **Battle_Revert_Service**: The backend service responsible for calculating and executing battle reversions
- **Battle_Replay_Service**: The backend service responsible for re-executing a reverted battle with current code
- **Revert_Preview**: A read-only calculation showing what data will be changed before confirming a revert
- **Admin_Panel**: The existing admin interface at `/admin` with tabbed navigation
- **BattleParticipant**: Database record storing per-robot battle data (ELO changes, damage, rewards)
- **AuditLog**: Event tracking system with one event per robot per battle
- **Current_Cycle**: The cycle that is currently open (not yet settled). Settlement runs at 23:00 UTC daily.
- **Closed_Cycle**: A cycle that has completed settlement, meaning league rebalancing, matchmaking for next cycle, and analytics snapshots have already occurred

## Expected Contribution

This feature delivers a critical admin tool for maintaining data integrity when battle bugs occur.

1. **Bug recovery capability**: Before: No way to fix battles affected by bugs — incorrect stats and rewards persist permanently. After: Admins can revert and replay current-cycle battles, restoring correct game state.

2. **Reduced manual intervention**: Before: Fixing a buggy battle requires manual database queries to identify and reverse 6+ entity types across multiple tables. After: Single admin action reverts all changes atomically with full audit trail.

3. **Testing on production data**: Before: Battle fixes can only be tested on synthetic test data. After: Admins can replay real battles to verify fixes work correctly on actual match configurations.

4. **Audit trail completeness**: Before: Manual database fixes leave no audit trail. After: All revert/replay actions logged with full before/after state for accountability.

5. **Support for all battle types**: Before: N/A. After: Feature supports league, tournament, tag team, and KotH battles with type-specific reversion logic.

6. **Safe scope limitation**: Before: N/A. After: Feature explicitly prevents reverting closed-cycle battles with clear error messaging, avoiding cascading data inconsistencies.

### Verification Criteria

After all tasks are complete, run these checks to confirm the feature works:

1. **Revert endpoint exists and is admin-protected**:
   ```bash
   grep -r "battle.*revert\|revert.*battle" app/backend/src/routes/ | grep -v test | wc -l
   # Expected: >= 1 (route defined)
   ```

2. **Revert service handles all battle types**:
   ```bash
   grep -E "league|tournament|tag_team|koth" app/backend/src/services/battleRevertService.ts | wc -l
   # Expected: >= 4 (all battle types handled)
   ```

3. **Audit log events created for revert actions**:
   ```bash
   grep -r "battle_reverted\|battle_replayed" app/backend/src/services/ | wc -l
   # Expected: >= 2 (both event types logged)
   ```

4. **Frontend tab component exists**:
   ```bash
   ls app/frontend/src/components/admin/BattleRevertTab.tsx 2>/dev/null && echo "exists"
   # Expected: "exists"
   ```

5. **Integration test covers revert flow**:
   ```bash
   grep -r "revert" app/backend/src/__tests__/ | grep -i battle | wc -l
   # Expected: >= 1 (test exists)
   ```

6. **Closed cycle check is enforced**:
   ```bash
   grep -r "closed.*cycle\|current.*cycle" app/backend/src/services/battleRevertService.ts | wc -l
   # Expected: >= 1 (cycle validation exists)
   ```

## Requirements

### Requirement 1: Battle Revert Preview

**User Story:** As an admin, I want to see what data will be reverted before confirming, so that I can verify the revert scope and avoid unintended changes.

#### Acceptance Criteria

1. WHEN an admin requests a revert preview for a battle ID, THE Battle_Revert_Service SHALL return a preview object containing all entities that will be modified
2. THE Revert_Preview SHALL include the Battle record with current and original values for: winnerId, battleLog, durationSeconds
3. THE Revert_Preview SHALL include each BattleParticipant record with current and original values for: eloBefore, eloAfter, damageDealt, finalHP, credits, streamingRevenue, prestigeAwarded, fameAwarded
4. THE Revert_Preview SHALL include each affected Robot with current and reverted values for: currentHP, currentShield, elo, leaguePoints, fame, wins, losses, draws, damageDealtLifetime, damageTakenLifetime, kills, and tag team stats if applicable
5. THE Revert_Preview SHALL include each affected User with current and reverted values for: currency, prestige, totalBattles, totalWins
6. THE Revert_Preview SHALL include the count of AuditLog entries that will be marked as reverted
7. THE Revert_Preview SHALL include the ScheduledMatch or TagTeamMatch record with current and reverted status values
8. IF the battle ID does not exist, THEN THE Battle_Revert_Service SHALL return a 404 error with message "Battle not found"
9. IF the battle has already been reverted, THEN THE Battle_Revert_Service SHALL return a 400 error with message "Battle already reverted"
10. IF the battle is from a Closed_Cycle (cycle number < current cycle), THEN THE Battle_Revert_Service SHALL return a 400 error with message "Cannot revert battles from closed cycles. Battle is from cycle {N}, current cycle is {M}. Reverting closed-cycle battles would cause cascading inconsistencies with league rebalancing, matchmaking, and analytics."
11. THE Revert_Preview SHALL include the battle's cycle number and indicate whether it is from the Current_Cycle or a Closed_Cycle

### Requirement 2: Battle Revert Execution

**User Story:** As an admin, I want to revert a battle's effects atomically, so that all data changes from that battle are undone consistently.

#### Acceptance Criteria

1. WHEN an admin confirms a battle revert, THE Battle_Revert_Service SHALL verify the battle is from the Current_Cycle before proceeding
2. WHEN an admin confirms a battle revert, THE Battle_Revert_Service SHALL execute all reversions within a single database transaction
2. THE Battle_Revert_Service SHALL restore each Robot's stats to their pre-battle values: currentHP, currentShield, elo, leaguePoints, fame, wins, losses, draws, damageDealtLifetime, damageTakenLifetime, kills
3. FOR tag team battles, THE Battle_Revert_Service SHALL also restore: totalTagTeamBattles, totalTagTeamWins, totalTagTeamLosses, totalTagTeamDraws, timesTaggedIn, timesTaggedOut
4. FOR KotH battles, THE Battle_Revert_Service SHALL also restore: kothWins, kothMatches, kothTotalZoneScore, kothTotalZoneTime, kothKills, kothBestPlacement, kothCurrentWinStreak, kothBestWinStreak
5. THE Battle_Revert_Service SHALL restore each User's stats to their pre-battle values: currency (credits + streamingRevenue), prestige, totalBattles, totalWins
6. THE Battle_Revert_Service SHALL mark the Battle record with a `revertedAt` timestamp and `revertedBy` admin user ID
7. THE Battle_Revert_Service SHALL mark all associated AuditLog entries with `reverted: true` in their payload
8. THE Battle_Revert_Service SHALL reset the ScheduledMatch or TagTeamMatch status from "completed" back to "scheduled" and clear the battleId reference
9. IF the transaction fails, THEN THE Battle_Revert_Service SHALL rollback all changes and return a 500 error with details
10. WHEN a revert completes successfully, THE Battle_Revert_Service SHALL create a new AuditLog entry with eventType "battle_reverted" containing the battle ID, admin user ID, and summary of reverted values

### Requirement 3: Battle Replay Execution

**User Story:** As an admin, I want to optionally replay a reverted battle with current code, so that I can verify bug fixes and restore correct battle results.

#### Acceptance Criteria

1. WHEN an admin requests a replay after revert, THE Battle_Replay_Service SHALL re-execute the battle using the same robot configurations from the original battle
2. THE Battle_Replay_Service SHALL load each robot's pre-battle state (attributes, weapons, stance, loadout) from the BattleParticipant records and original Battle data
3. THE Battle_Replay_Service SHALL call the appropriate orchestrator based on battleType: leagueBattleOrchestrator for "league", tournamentBattleOrchestrator for "tournament", tagTeamBattleOrchestrator for "tag_team", kothBattleOrchestrator for "koth"
4. THE Battle_Replay_Service SHALL create a new Battle record linked to the original via a `replayOfBattleId` field
5. THE Battle_Replay_Service SHALL update all Robot and User stats as normal battle execution would
6. THE Battle_Replay_Service SHALL create new BattleParticipant records for the replayed battle
7. THE Battle_Replay_Service SHALL create new AuditLog entries with eventType "battle_complete" for each robot
8. WHEN a replay completes, THE Battle_Replay_Service SHALL create an AuditLog entry with eventType "battle_replayed" linking the original and new battle IDs
9. IF replay is requested without prior revert, THEN THE Battle_Replay_Service SHALL return a 400 error with message "Battle must be reverted before replay"

### Requirement 4: Admin Panel Integration

**User Story:** As an admin, I want to access battle revert/replay functionality from the admin panel, so that I can manage battle corrections through the existing admin interface.

#### Acceptance Criteria

1. THE Admin_Panel SHALL include a "Battle Revert" tab accessible from the main tab navigation
2. THE Admin_Panel SHALL provide a battle ID input field with validation for numeric IDs
3. WHEN a valid battle ID is entered, THE Admin_Panel SHALL display the revert preview with all affected entities grouped by type (Battle, Robots, Users, Audit Logs, Match Record)
4. THE Admin_Panel SHALL prominently display the battle's cycle number and whether it is from the Current_Cycle or a Closed_Cycle
5. IF the battle is from a Closed_Cycle, THE Admin_Panel SHALL display a warning message explaining why revert is not available and disable the revert/replay buttons
6. THE Admin_Panel SHALL display before/after values for each affected field in a comparison format
5. THE Admin_Panel SHALL provide a "Revert Battle" button that is disabled until preview is loaded
6. THE Admin_Panel SHALL provide a "Revert and Replay" button that executes revert followed by replay in sequence
7. WHEN revert or replay is in progress, THE Admin_Panel SHALL display a loading indicator and disable action buttons
8. WHEN revert completes successfully, THE Admin_Panel SHALL display a success message with summary of changes
9. WHEN replay completes successfully, THE Admin_Panel SHALL display the new battle ID with a link to view battle details
10. IF an error occurs, THEN THE Admin_Panel SHALL display the error message with details

### Requirement 5: Battle Type Support

**User Story:** As an admin, I want the revert/replay feature to work correctly for all battle types, so that I can fix issues in any type of match.

#### Acceptance Criteria

1. FOR league battles, THE Battle_Revert_Service SHALL handle ScheduledMatch status reversion and league point changes
2. FOR tournament battles, THE Battle_Revert_Service SHALL handle TournamentMatch status reversion without affecting tournament bracket progression (revert only reverts stats, not tournament advancement)
3. FOR tag team battles, THE Battle_Revert_Service SHALL handle TagTeamMatch status reversion and all 4 robot participants
4. FOR KotH battles, THE Battle_Revert_Service SHALL handle ScheduledKothMatch status reversion and all 5-6 robot participants
5. THE Battle_Revert_Service SHALL correctly identify battle type from the Battle.battleType field
6. IF a battle type is not recognized, THEN THE Battle_Revert_Service SHALL return a 400 error with message "Unsupported battle type"

### Requirement 6: Authorization and Audit Trail

**User Story:** As a system administrator, I want all revert/replay actions to be logged and restricted to admins, so that there is accountability for data corrections.

#### Acceptance Criteria

1. THE revert preview endpoint SHALL require admin role authentication
2. THE revert execution endpoint SHALL require admin role authentication
3. THE replay execution endpoint SHALL require admin role authentication
4. WHEN a revert is executed, THE Battle_Revert_Service SHALL log an AuditLog entry with: eventType "battle_reverted", adminUserId, battleId, timestamp, and payload containing summary of all reverted values
5. WHEN a replay is executed, THE Battle_Replay_Service SHALL log an AuditLog entry with: eventType "battle_replayed", adminUserId, originalBattleId, newBattleId, timestamp
6. THE AuditLog entries for revert/replay SHALL be queryable via the existing admin audit log interface
