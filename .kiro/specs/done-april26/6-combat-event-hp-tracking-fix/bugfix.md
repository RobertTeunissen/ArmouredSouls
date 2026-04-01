# Bugfix Requirements Document

## Introduction

Combat events in the battle simulator have inconsistent HP/Shield tracking that causes incorrect data to be displayed in both the admin portal and player-facing battle logs. The `robot1HP`/`robot2HP` fields in combat events swap based on who is attacking rather than maintaining consistent robot identity throughout the battle. This results in:
- Admin portal showing HP values swapped between robots after certain attacks
- Player-facing narrative messages showing incorrect damage status
- Shield break messages appearing multiple times when shields only broke once
- Final "100% HP" display contradicting earlier "critically damaged" messages

A partial fix exists: a proxy injects `robotHP` and `robotShield` maps (keyed by robot name) on every event. These are correct but not used by the message generator or admin portal.

## Expected Contribution

This bugfix addresses the combat event data model inconsistency that emerged during the multi-robot battle mode merge. It establishes a single source of truth for HP/Shield tracking that scales to any number of robots.

1. **Eliminate HP/Shield display errors**: Before: Admin portal shows swapped HP values ~50% of the time (whenever robot2 attacks). After: HP values always correctly attributed to each robot.

2. **Fix duplicate shield break messages**: Before: Shield break messages can appear 2-5 times per robot per battle. After: Exactly one shield break message per robot when their shield depletes.

3. **Fix incorrect damage status messages**: Before: "Hull integrity critical" messages appear for robots that took no HP damage. After: Damage status messages only appear for the robot actually taking damage.

4. **Establish N-robot compatible data model**: Before: `robot1HP`/`robot2HP` fields cannot represent >2 robots. After: `robotHP`/`robotShield` maps work for 1v1, 2v2, KotH (4-8 robots), and future modes.

5. **Reduce code complexity**: Before: Consumers must handle both `robot1HP`/`robot2HP` and `robotHP` maps with unclear precedence. After: Single source of truth via `robotHP`/`robotShield` maps with fallback for legacy data.

### Verification Criteria

After all tasks are complete, run these checks to confirm the fix:

1. **No direct robot1HP/robot2HP usage in message generator**:
   ```bash
   grep -n "event\.robot1HP\|event\.robot2HP\|event\.robot1Shield\|event\.robot2Shield" prototype/backend/src/services/combatMessageGenerator.ts | grep -v "// legacy fallback" | wc -l
   # Expected: 0 (all usages should be robotHP/robotShield maps or marked as legacy fallback)
   ```

2. **Admin portal uses robotHP maps**:
   ```bash
   grep -n "event\.robotHP\|event\.robotShield" prototype/frontend/src/components/BattleDetailsModal.tsx | wc -l
   # Expected: >= 2 (at least HP and Shield map usage)
   ```

3. **Combat simulator tests pass**:
   ```bash
   cd prototype/backend && npm test -- --testPathPattern="combatSimulator|combatMessageGenerator" --silent
   # Expected: All tests pass
   ```

4. **Property-based test for HP consistency**:
   ```bash
   cd prototype/backend && npm test -- --testPathPattern="hpTracking.pbt" --silent
   # Expected: New PBT test passes, verifying robotHP[name] === states[index].currentHP for all events
   ```

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN robot2 attacks robot1 THEN the system assigns `robot1HP = robot2's HP` and `robot2HP = robot1's HP` (values swapped based on attacker/defender roles)

1.2 WHEN the combatMessageGenerator determines damage status THEN the system uses the incorrect `robot1HP`/`robot2HP` fields instead of the correct `robotHP` map

1.3 WHEN the combatMessageGenerator checks for shield breaks THEN the system uses the incorrect `robot1Shield`/`robot2Shield` fields, causing duplicate shield break messages

1.4 WHEN the admin portal BattleDetailsModal displays HP values THEN the system uses the incorrect `robot1HP`/`robot2HP` fields instead of the correct `robotHP` map

1.5 WHEN a battle has more than 2 robots (KotH, FFA) THEN the system cannot correctly represent HP for all robots using only `robot1HP`/`robot2HP` fields

### Expected Behavior (Correct)

2.1 WHEN any robot attacks any other robot THEN the system SHALL maintain consistent robot identity in HP/Shield tracking using the `robotHP` and `robotShield` maps keyed by robot name

2.2 WHEN the combatMessageGenerator determines damage status THEN the system SHALL use the `robotHP` map to get the correct HP value for each robot by name

2.3 WHEN the combatMessageGenerator checks for shield breaks THEN the system SHALL use the `robotShield` map to accurately detect shield depletion without false duplicates

2.4 WHEN the admin portal BattleDetailsModal displays HP values THEN the system SHALL use the `robotHP` and `robotShield` maps to show correct values for each robot

2.5 WHEN a battle has N robots (1v1, 2v2, KotH, FFA, or future modes) THEN the system SHALL correctly track and display HP/Shield for all robots using the name-keyed maps

### Unchanged Behavior (Regression Prevention)

3.1 WHEN existing battle logs are loaded from the database THEN the system SHALL CONTINUE TO display them correctly (backward compatibility with legacy `robot1HP`/`robot2HP` fields)

3.2 WHEN a 1v1 battle is simulated THEN the system SHALL CONTINUE TO produce valid combat events with all required fields

3.3 WHEN combat damage is calculated THEN the system SHALL CONTINUE TO apply damage correctly to the defender's HP/Shield state

3.4 WHEN shield regeneration occurs THEN the system SHALL CONTINUE TO regenerate shields correctly

3.5 WHEN yield/destruction conditions are checked THEN the system SHALL CONTINUE TO trigger at the correct HP thresholds
