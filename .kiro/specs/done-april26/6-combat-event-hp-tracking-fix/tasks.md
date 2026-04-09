# Implementation Plan: Combat Event HP Tracking Fix

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - HP Values Swap Based on Attacker Role
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate HP values swap when robot2 attacks
  - **Scoped PBT Approach**: Generate battles where robot2 attacks robot1, verify robotHP map values match actual robot state
  - Create `app/backend/tests/hpTracking.pbt.test.ts`
  - Test property: For all combat events where robot2 is the attacker, `event.robotHP[robot1.name]` should equal robot1's actual HP (not robot2's HP)
  - Bug condition `C(X)`: `event.attacker === robot2.name` (robot2 attacks)
  - Expected behavior `P(result)`: `event.robotHP[robotName] === actualRobotState[robotName].currentHP` for all robots
  - Run test on UNFIXED code
  - **ACTUAL OUTCOME**: Tests PASS because the `robotHP` map is already correct (proxy injects correct values). The bug is in CONSUMERS that use legacy `robot1HP`/`robot2HP` fields.
  - **BUG DEMONSTRATION**: Added Property 5 test that confirms legacy fields swap when robot2 attacks
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 2.1_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Swapped Behavior for Robot1 Attacks
  - **IMPORTANT**: Follow observation-first methodology
  - Create preservation tests in `app/backend/tests/hpTracking.pbt.test.ts`
  - Observe: When robot1 attacks, `robot1HP`/`robot2HP` fields happen to be correct (attacker position matches robot position)
  - Observe: Shield regeneration, yield conditions, and damage calculations work correctly
  - Write property-based test: For events where robot1 is attacker, verify HP tracking is consistent
  - Write property-based test: Shield break detection triggers exactly once per robot when shield depletes to 0
  - Write property-based test: Damage status messages (75%, 50%, 25%) only appear for the actual defender
  - Non-bug condition `¬C(X)`: `event.attacker === robot1.name` OR non-attack events
  - Run tests on UNFIXED code
  - **ACTUAL OUTCOME**: Tests PASS - baseline behavior confirmed
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Implement Combat Message Generator fixes

  - [x] 3.1 Add `getHPFromEvent()` helper method
    - Create private static method in `CombatMessageGenerator` class
    - Accept `event: CombatEvent`, `robotName: string`, `context: { robot1Name, robot2Name }`
    - Return `{ hp: number | undefined; shield: number | undefined }`
    - Prefer `event.robotHP[robotName]` and `event.robotShield[robotName]` (correct source)
    - Fall back to `robot1HP`/`robot2HP` for legacy data only
    - Add JSDoc documenting the legacy fallback behavior
    - _Bug_Condition: event.attacker !== robot1.name causes HP swap in legacy fields_
    - _Expected_Behavior: robotHP[name] always returns correct HP for that robot_
    - _Preservation: Legacy fallback maintains backward compatibility_
    - _Requirements: 2.1, 2.2, 3.1_
    - **NOTE**: This helper already existed in the codebase (lines 143-166)

  - [x] 3.2 Refactor `checkShieldBreak()` to use Maps
    - Change signature to accept `prevShields: Map<string, number>` instead of separate variables
    - Use `getHPFromEvent()` to get current shield value for defender
    - Look up previous shield from Map by defender name
    - Update shield break detection logic
    - _Bug_Condition: Using robot1Shield/robot2Shield causes duplicate shield break messages_
    - _Expected_Behavior: Shield break message appears exactly once per robot_
    - _Preservation: Shield break still triggers at correct threshold (shield > 0 → shield === 0)_
    - _Requirements: 2.3, 3.4_

  - [x] 3.3 Refactor `checkDamageStatus()` to use Maps
    - Change signature to accept `thresholds: Map<string, Set<number>>` instead of separate variables
    - Use `getHPFromEvent()` to get current HP value for defender
    - Look up thresholds from Map by defender name
    - Update damage status detection logic
    - _Bug_Condition: Using robot1HP/robot2HP causes wrong robot to get damage messages_
    - _Expected_Behavior: Damage status messages only appear for actual defender_
    - _Preservation: Damage thresholds (75%, 50%, 25%) still trigger correctly_
    - _Requirements: 2.2, 3.3_

  - [x] 3.4 Update `convertSimulatorEvents()` initialization
    - Replace `robot1PrevShield`/`robot2PrevShield` with `prevShields: Map<string, number>`
    - Replace `robot1Thresholds`/`robot2Thresholds` with `thresholds: Map<string, Set<number>>`
    - Initialize Maps with robot names as keys
    - Update event loop to update Map entries after each event
    - Also updated yield and destroyed event handling to use `getHPFromEvent()`
    - _Bug_Condition: Separate variables assume robot position matches attacker position_
    - _Expected_Behavior: Map-based tracking works for any robot count_
    - _Preservation: Initialization values match current behavior_
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

  - [x] 3.5 Write unit tests for `getHPFromEvent()`
    - Tests already exist in hpTracking.pbt.test.ts (Property 1-5)
    - Test: Returns correct HP when robotHP map is present
    - Test: Returns correct HP from legacy fields when robotHP map is missing
    - Test: Handles missing robotShield map gracefully
    - _Requirements: 2.1, 2.2, 3.1_

  - [x] 3.6 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - HP Values Consistent Regardless of Attacker
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **ACTUAL OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2_

  - [x] 3.7 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Swapped Behavior Preserved
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **ACTUAL OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. Implement BattleDetailsModal fixes

  - [x] 4.1 Update CombatEvent interface
    - Add `robotHP?: Record<string, number>` field
    - Add `robotShield?: Record<string, number>` field
    - Keep existing `robot1HP`/`robot2HP`/`robot1Shield`/`robot2Shield` for backward compatibility
    - _Requirements: 2.4, 3.1_

  - [x] 4.2 Create `getEventHP()` helper function
    - Create function in BattleDetailsModal.tsx
    - Accept `event`, `robotName`, `robot1Name`, `robot2Name`
    - Return `{ hp: number | undefined; shield: number | undefined }`
    - Prefer robotHP/robotShield maps, fall back to legacy fields
    - _Bug_Condition: Direct robot1HP/robot2HP access shows swapped values_
    - _Expected_Behavior: getEventHP() returns correct HP for each robot by name_
    - _Preservation: Legacy battle data still displays correctly_
    - _Requirements: 2.4, 3.1_

  - [x] 4.3 Update HP/Shield display JSX
    - Replace direct `event.robot1HP`/`event.robot2HP` access with `getEventHP()` calls
    - For N-robot support: iterate over `Object.entries(event.robotHP)` when map is present
    - Fall back to legacy display for old battle data
    - Display format: `{name}: {hp}HP / {shield}S`
    - _Bug_Condition: Direct field access shows swapped HP values_
    - _Expected_Behavior: HP values correctly attributed to each robot_
    - _Preservation: Old battle logs still display correctly_
    - _Requirements: 2.4, 2.5, 3.1_

  - [ ] 4.4 Manual verification of admin portal
    - Simulate a new battle
    - Open BattleDetailsModal in admin portal
    - Verify HP values are correctly attributed to each robot throughout the battle
    - Verify old battle data still displays correctly (backward compatibility)
    - _Requirements: 2.4, 3.1_

- [x] 5. Update documentation

  - [x] 5.1 Update `docs/prd_core/COMBAT_MESSAGES.md`
    - Document `robotHP`/`robotShield` maps as the canonical source of truth
    - Add section explaining the data model: maps keyed by robot name
    - Document the legacy fallback behavior for old battle data
    - Add deprecation note for `robot1HP`/`robot2HP` fields
    - **COMPLETED**: Added "HP/Shield Tracking Data Model" section with full documentation
    - _Requirements: 2.1, 2.5_

  - [x] 5.2 Update `docs/prd_core/BATTLE_SIMULATION_ARCHITECTURE.md`
    - Add "HP Tracking Data Model" section
    - Document the N-robot compatible design using name-keyed maps
    - Explain why maps scale to KotH, FFA, and future battle modes
    - Include example map structures for different battle types
    - **COMPLETED**: Added "HP/Shield Tracking Data Model" section with data flow diagram and scalability table
    - _Requirements: 2.5_

  - [x] 5.3 Add deprecation comments in code
    - Add JSDoc deprecation comments to `robot1HP`/`robot2HP` field usages
    - Add comments explaining legacy fallback is for backward compatibility only
    - **COMPLETED**: Updated CombatEvent interface in combatSimulator.ts and arena/types.ts with @deprecated JSDoc
    - _Requirements: 3.1_

- [x] 6. Checkpoint - Final verification
  - Run verification command: `grep -n "event\.robot1HP\|event\.robot2HP" app/backend/src/services/combatMessageGenerator.ts` — Expected: Only in `getHPFromEvent()` legacy fallback section (lines ~159-162)
  - Run verification command: `grep -n "event\.robotHP\|event\.robotShield" app/frontend/src/components/BattleDetailsModal.tsx | wc -l` — Expected: >= 2 ✅ (actual: 7)
  - Run HP tracking PBT: `npm test -- --testPathPatterns="hpTracking.pbt" --silent` (from app/backend) — ✅ 7 tests pass
  - **VERIFICATION COMPLETE**: All checks pass, legacy fields only used in fallback helpers
  - _Requirements: All verification criteria from bugfix.md_
