# Implementation Plan: Tag Team Battle Phase Bugs

## Dependencies

This spec depends on spec 6 (combat-event-hp-tracking-fix) which introduces `robotHP`/`robotShield` maps. Both specs will be merged into one PR.

---

- [x] 1. Write bug condition exploration tests
  - **Property 1: Bug Condition** - Tag team phase transition bugs
  - **CRITICAL**: These tests MUST FAIL on unfixed code - failure confirms the bugs exist
  - Create `app/backend/tests/tagTeamPhaseBugs.pbt.test.ts`
  - Bug condition tests (should FAIL on unfixed code):
    - Test: `winnerId` for tag team battles is NOT a robot ID (should be team ID)
    - Test: Phase 2 narrative events do NOT contain a `battle_start` event at timestamp 0
    - Test: Phase 2 narrative event timestamps are all >= phase 1 final timestamp
    - Test: Surviving robot's shield at phase 2 start equals their shield at phase 1 end (not maxShield)
    - Test: Attack messages in phase 2 have non-empty attacker and defender names
  - Run tests on UNFIXED code to confirm bugs exist
  - Mark task complete when tests are written and failures documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing behavior that must not change
  - Create preservation tests in `app/backend/tests/tagTeamPhaseBugs.pbt.test.ts`
  - Preservation tests (should PASS on unfixed code):
    - Test: Standard 1v1 battles continue to use robot ID as winnerId
    - Test: Phase 1 events start at timestamp 0 with a `battle_start` event
    - Test: Phase 1 attack messages have correct robot names
    - Test: Reserve robot tags in with full HP (maxHP) and full shields (maxShield)
    - Test: Draw is declared when both teams exhaust all robots simultaneously
    - Test: Damage dealt and survival time stats are tracked per robot across phases
    - Test: Existing tag team reward calculation tests still pass (2x standard)
  - Run tests on UNFIXED code to confirm baseline behavior
  - Mark task complete when tests pass on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 3.7, 3.9_

- [x] 3. Fix winner determination in tag team orchestrator

  - [x] 3.1 Update winner ID assignment to use team ID
    - File: `app/backend/src/services/tagTeamBattleOrchestrator.ts`
    - Lines: 900-912
    - Change `winnerId = team1CurrentFighterId` to `winnerId = team1.id`
    - Change `winnerId = team2CurrentFighterId` to `winnerId = team2.id`
    - **Note**: The reward allocation code in `updateTagTeamStats()` already expects team IDs:
      - `const team1Won = result.winnerId === team1.id;` (line 1742)
      - This fix will make rewards work correctly (currently broken)
    - _Requirements: 2.1_

  - [x] 3.2 Fix draw detection logic
    - File: `app/backend/src/services/tagTeamBattleOrchestrator.ts`
    - Lines: 870-912
    - Calculate total remaining HP for each team (active + reserve)
    - Only declare draw when both teams have 0 total HP
    - _Requirements: 2.7_

  - [x] 3.3 Verify reward allocation works correctly
    - Run existing tag team reward tests: `npm test -- --testPathPattern="tagTeamBattleOrchestrator.property" --silent`
    - Verify winning team receives winner rewards (2x standard)
    - Verify losing team receives loser rewards (participation only)
    - Write test: `team1Won === true` when `winnerId === team1.id` and `team2Won === false`
    - Write test: ELO changes are applied to the correct team (winner gains, loser loses)
    - _Requirements: 2.1, 2.7_

  - [x] 3.4 Write draw detection tests
    - Test: When only active robots are destroyed but reserves available, battle continues (NOT a draw)
    - Test: When both teams exhaust all robots (active + reserve HP <= 0), result IS a draw
    - Test: When time limit reached, result IS a draw
    - Test: When one team has HP remaining and other is exhausted, team with HP wins
    - _Requirements: 2.7, 3.6, 3.9_

  - [x] 3.5 Verify bug condition test now passes
    - Re-run winner ID test from task 1
    - Confirm winnerId is team ID for tag team battles
    - _Requirements: 2.1, 2.7_

- [x] 4. Fix shield state preservation

  - [x] 4.1 Capture shield state after each phase
    - File: `app/backend/src/services/tagTeamBattleOrchestrator.ts`
    - After `phase1Result = simulateBattle()`, extract final shield values from `robotShield` map
    - Update `team1CurrentRobot.currentShield` and `team2CurrentRobot.currentShield`
    - Do the same after phase 2 if there's a phase 3
    - _Requirements: 2.4_

  - [x] 4.2 Preserve surviving robot's shields in phase 2
    - When only one team tags out, the surviving robot keeps their depleted shields
    - Reserve robot gets full shields via `activateReserveRobot()` (this is correct behavior)
    - _Requirements: 2.4, 3.4_

  - [x] 4.3 Write shield state transition tests
    - Test: Surviving robot's `currentShield` at phase 2 start < `maxShield` (depleted, not reset)
    - Test: Surviving robot's `currentShield` at phase 2 start === phase 1 final shield value
    - Test: Reserve robot's `currentShield` at tag-in === `maxShield` (fresh fighter)
    - Test: When both teams tag out simultaneously, both reserves have full shields
    - Test: Phase 3 scenario — surviving robot from phase 2 keeps depleted shields into phase 3
    - _Requirements: 2.4, 3.4_

  - [x] 4.4 Verify shield preservation test passes
    - Re-run shield state test from task 1
    - Confirm surviving robot's shield matches phase 1 final state
    - _Requirements: 2.4_

- [x] 5. Fix timestamp and battle_start handling

  - [x] 5.1 Add skipBattleStart flag to convertSimulatorEvents
    - File: `app/backend/src/services/combatMessageGenerator.ts`
    - Add `skipBattleStart?: boolean` to context parameter
    - Skip battle_start emission when flag is true
    - _Requirements: 2.2_

  - [x] 5.2 Update convertTagTeamEvents to track timestamp offset
    - File: `app/backend/src/services/combatMessageGenerator.ts`
    - Track cumulative timestamp from phase end times
    - Pass `skipBattleStart: true` for phase 2+
    - Note: Timestamp offset is already applied by orchestrator (events have correct timestamps)
    - _Requirements: 2.2_

  - [x] 5.3 Write timestamp and battle_start tests
    - Test: Phase 1 narrative events contain exactly one `battle_start` event at timestamp 0
    - Test: Phase 2 narrative events contain zero `battle_start` events
    - Test: All phase 2 narrative event timestamps >= phase 1 final event timestamp
    - Test: Phase 3 narrative event timestamps >= phase 2 final event timestamp
    - Test: Tag-out/tag-in events have timestamps matching the phase boundary
    - _Requirements: 2.2, 3.2_

  - [x] 5.4 Verify timestamp continuity test passes
    - Re-run timestamp test from task 1
    - Confirm phase 2 events have timestamps >= phase 1 final timestamp
    - _Requirements: 2.2_

- [x] 6. Fix robot name display in attack messages

  - [x] 6.1 Ensure attack messages use event.attacker/defender
    - File: `app/backend/src/services/combatMessageGenerator.ts`
    - In `convertSimulatorEvents()`, use `event.attacker` and `event.defender` directly
    - Add fallback to context robot names if event names are missing
    - _Requirements: 2.3, 2.5_

  - [x] 6.2 Write robot name display tests
    - Test: All attack/critical/miss events in phase 1 have non-empty attacker and defender names
    - Test: All attack/critical/miss events in phase 2 have non-empty attacker and defender names
    - Test: Phase 2 attacker/defender names match the robots actually fighting in that phase (not tagged-out robots)
    - Test: Phase 2 attack message text contains the correct robot names (not empty strings)
    - Test: Phase 3 attack messages use the correct reserve robot names
    - _Requirements: 2.3, 2.5, 3.3_

  - [x] 6.3 Verify robot names are correct in phase 2 messages
    - Run a tag team battle simulation
    - Check that attack messages after tag-in show correct robot names
    - _Requirements: 2.3, 2.5_

- [x] 7. Fix admin portal display

  - [x] 7.1 Update BattleLogsTab to show all 4 robots for tag team
    - File: `app/frontend/src/components/admin/BattleLogsTab.tsx`
    - For `battleFormat === '2v2'`, show "Team 1 (Active + Reserve)" format
    - Keep existing display for 1v1 battles
    - _Requirements: 2.6, 3.8_

  - [x] 7.2 Update admin battles API to include team robot names
    - File: `app/backend/src/routes/admin.ts` (or relevant API file)
    - Include `team1ActiveName`, `team1ReserveName`, `team2ActiveName`, `team2ReserveName` in response
    - _Requirements: 2.6_

  - [x] 7.3 Write admin portal display tests
    - Test: BattleLogsTab renders team names for tag team battles (not just robot1 vs robot2)
    - Test: BattleLogsTab renders all 4 robot names for tag team battles
    - Test: BattleLogsTab winner column shows team name (not robot name) for tag team battles
    - Test: BattleDetailsModal winner display matches the winnerId (team ID)
    - Test: 1v1 battles continue to show robot1 vs robot2 format
    - _Requirements: 2.6, 2.8, 3.8, 3.10_

  - [x] 7.4 Ensure admin and frontend show consistent data
    - Both views should use the same underlying battle record
    - Winner display should match between admin portal and frontend
    - _Requirements: 2.8, 3.10_

- [x] 8. Update documentation

  - [x] 8.1 Update BATTLE_SIMULATION_ARCHITECTURE.md
    - Add section on tag team phase transitions
    - Document timestamp handling across phases
    - Document shield state preservation rules
    - _Requirements: 2.2, 2.4_

- [x] 9. Checkpoint - Final verification
  - Run all tag team phase bug tests: `npm test -- --testPathPattern="tagTeamPhaseBugs" --silent`
  - Run existing tag team tests: `npm test -- --testPathPattern="tagTeam" --silent`
  - Run existing combat message generator tests: `npm test -- --testPathPattern="combatMessageGenerator" --silent`
  - **Verification checklist:**
    - [x] Winner ID is team ID for tag team battles (not robot ID)
    - [x] Reward allocation gives winner rewards to winning team
    - [x] Draw only declared when both teams exhausted all robots
    - [x] Timestamps are continuous across phases (no reset to 0)
    - [x] Only one `battle_start` event per battle (in phase 1)
    - [x] Shield state is preserved for surviving robot across phases
    - [x] Reserve robot gets full shields when tagging in
    - [x] Attack messages have correct robot names in all phases
    - [x] Admin portal shows all 4 robots for tag team battles
    - [x] Admin and frontend show consistent winner information
  - _Requirements: All verification criteria from bugfix.md_
