# Bugfix Requirements Document

## Introduction

Multiple bugs occur during tag team battle phase transitions in battle #509, causing incorrect display and data in the battle log and results. These bugs affect winner determination, timestamp continuity, robot name display, and shield state preservation across phases.

## Expected Contribution

This bugfix addresses critical tag team battle phase transition bugs that cause incorrect battle results and confusing user experience. It ensures tag team battles work correctly end-to-end.

1. **Fix winner determination**: Before: Winner shows robot name (e.g., "FEANOR REX WINS") instead of team. After: Winner correctly shows winning team ID, displayed as "Team 1 Wins" or "Team 2 Wins".

2. **Fix timestamp continuity**: Before: Phase 2 events reset to 00:00.0 causing confusing battle logs. After: Phase 2 events continue from phase 1 end time (e.g., 46.4s → 46.5s).

3. **Fix robot name display**: Before: Attack messages show empty names after tag-in ("🔪 executes a clean strike on with Fists"). After: Attack messages show correct robot names for current phase.

4. **Fix shield state preservation**: Before: Surviving robot gets full shields after tag-in despite just fighting. After: Surviving robot keeps depleted shields from phase 1.

5. **Fix admin portal display**: Before: Tag team battles show only "Robot 1 vs Robot 2". After: Tag team battles show all 4 robots with team groupings.

6. **Fix draw detection**: Before: Battles incorrectly declared as draw when reserves should tag in. After: Draw only declared when both teams exhausted all robots.

7. **Fix frontend/admin consistency**: Before: Admin portal and frontend show different information for same battle. After: Both views show identical battle data.

### Verification Criteria

After all tasks are complete, run these checks to confirm the fix:

1. **Winner ID is team ID for tag team battles**:
   ```bash
   # Run tag team battle test
   cd app/backend && npm test -- --testPathPattern="tagTeam" --silent
   # Expected: All tests pass, winnerId is team.id not robot.id
   ```

2. **Timestamp continuity across phases**:
   ```bash
   # Check that phase 2 events have timestamps > phase 1 end
   cd app/backend && npm test -- --testPathPattern="tagTeamPhase" --silent
   # Expected: All phase 2 timestamps >= phase 1 final timestamp
   ```

3. **Shield state preserved for surviving robot**:
   ```bash
   # Run shield preservation test
   cd app/backend && npm test -- --testPathPattern="shieldPreservation" --silent
   # Expected: Surviving robot's shield matches phase 1 final state
   ```

4. **Admin portal shows all 4 robots**:
   ```bash
   # Verify BattleLogsTab renders team info
   grep -n "team1ActiveName\|team2ActiveName" app/frontend/src/components/admin/BattleLogsTab.tsx | wc -l
   # Expected: >= 2 (team names rendered for tag team battles)
   ```

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a tag team battle ends THEN the system sets `winnerId` to the robot ID (`team1CurrentFighterId` or `team2CurrentFighterId`) instead of the team ID

1.2 WHEN phase 2+ begins after a tag-in THEN the system resets event timestamps to 0 and emits a new `battle_start` event at timestamp 0

1.3 WHEN attack events occur after a tag-in THEN the system displays empty attacker/defender names in attack messages

1.4 WHEN phase 2 starts after a tag-in THEN the system gives the surviving robot (who just defeated their opponent) full shields instead of their depleted shield state

1.5 WHEN HP display is rendered after a tag-in THEN the system shows the tagged-out robot's name instead of the tagged-in robot's name

1.6 WHEN tag team battles are displayed in the admin portal battle logs THEN the system only shows "robot 1 vs robot 2" instead of all 4 participating robots

1.7 WHEN determining the winner of a tag team battle where both active robots are destroyed but reserves tag in THEN the system incorrectly declares a draw instead of continuing the battle with reserves

1.8 WHEN viewing the same tag team battle in the admin portal vs the frontend battle detail page THEN the system displays inconsistent information (different winner, different robot names, different event data)

### Expected Behavior (Correct)

2.1 WHEN a tag team battle ends THEN the system SHALL set `winnerId` to the winning team's ID (`team1.id` or `team2.id`) since this is a team battle

2.2 WHEN phase 2+ begins after a tag-in THEN the system SHALL continue timestamps from where the previous phase ended (e.g., if phase 1 ended at 46.4s, phase 2 events SHALL start at 46.4s) and SHALL NOT emit a new `battle_start` event

2.3 WHEN attack events occur after a tag-in THEN the system SHALL display the correct robot names for the current phase's active fighters

2.4 WHEN phase 2 starts after a tag-in THEN the system SHALL preserve the surviving robot's depleted shield state from phase 1

2.5 WHEN HP display is rendered after a tag-in THEN the system SHALL show the current active robot's name (the tagged-in robot)

2.6 WHEN tag team battles are displayed in the admin portal battle logs THEN the system SHALL show all 4 participating robots (team1 active, team1 reserve, team2 active, team2 reserve) with their respective teams

2.7 WHEN both active robots are destroyed in a tag team battle but reserves are available THEN the system SHALL tag in the reserves and continue the battle (only declare draw if both teams have exhausted all robots simultaneously)

2.8 WHEN viewing the same tag team battle in the admin portal vs the frontend battle detail page THEN the system SHALL display consistent information (same winner, same robot names, same event data) from the same underlying battle record

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a standard 1v1 battle ends THEN the system SHALL CONTINUE TO set `winnerId` to the winning robot's ID

3.2 WHEN phase 1 of a tag team battle begins THEN the system SHALL CONTINUE TO emit `battle_start` at timestamp 0 with correct robot names

3.3 WHEN attack events occur during phase 1 (before any tag-in) THEN the system SHALL CONTINUE TO display correct attacker/defender names

3.4 WHEN a reserve robot tags in THEN the system SHALL CONTINUE TO have full HP and fresh cooldowns (only shields of the surviving opponent should be preserved)

3.5 WHEN HP display is rendered during phase 1 THEN the system SHALL CONTINUE TO show the correct active robot names

3.6 WHEN a tag team battle results in a draw THEN the system SHALL CONTINUE TO set `isDraw` to true and `winnerId` to null

3.7 WHEN calculating damage dealt and survival time statistics THEN the system SHALL CONTINUE TO track these correctly per robot across all phases

3.8 WHEN a standard 1v1 battle is displayed in the admin portal THEN the system SHALL CONTINUE TO show "robot 1 vs robot 2" format

3.9 WHEN both teams have exhausted all robots simultaneously (both active and reserve destroyed) THEN the system SHALL CONTINUE TO declare a draw

3.10 WHEN viewing a standard 1v1 battle in both admin portal and frontend THEN the system SHALL CONTINUE TO display consistent information between both views
