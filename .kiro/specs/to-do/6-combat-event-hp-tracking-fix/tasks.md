# Tasks: Combat Event HP Tracking Fix

## Task 1: Add HP extraction helper to CombatMessageGenerator
_Requirements: 2.1, 2.2, 3.1_

- [ ] 1.1 Add `getHPFromEvent()` private static method that extracts HP/Shield from `robotHP`/`robotShield` maps with legacy fallback
- [ ] 1.2 Add `robotHP` and `robotShield` optional fields to the internal CombatEvent type references
- [ ] 1.3 Write unit tests for `getHPFromEvent()` covering: map present, map missing (legacy), unknown robot name

## Task 2: Fix checkShieldBreak to use robotShield maps
_Requirements: 2.3, 3.1_

- [ ] 2.1 Refactor `checkShieldBreak()` signature to use `Map<string, number>` for previous shields instead of separate variables
- [ ] 2.2 Update `checkShieldBreak()` implementation to use `getHPFromEvent()` for current shield values
- [ ] 2.3 Update all call sites in `convertSimulatorEvents()` to pass the new Map-based parameters
- [ ] 2.4 Write unit tests verifying shield break messages appear exactly once per robot

## Task 3: Fix checkDamageStatus to use robotHP maps
_Requirements: 2.2, 3.1_

- [ ] 3.1 Refactor `checkDamageStatus()` signature to use `Map<string, Set<number>>` for thresholds instead of separate variables
- [ ] 3.2 Update `checkDamageStatus()` implementation to use `getHPFromEvent()` for current HP values
- [ ] 3.3 Update all call sites in `convertSimulatorEvents()` to pass the new Map-based parameters
- [ ] 3.4 Write unit tests verifying damage status messages only appear for the actual defender

## Task 4: Update convertSimulatorEvents initialization
_Requirements: 2.1, 2.2, 2.3_

- [ ] 4.1 Replace `robot1PrevShield`/`robot2PrevShield` variables with `prevShields: Map<string, number>`
- [ ] 4.2 Replace `robot1Thresholds`/`robot2Thresholds` variables with `thresholds: Map<string, Set<number>>`
- [ ] 4.3 Update the event loop to update Map entries after each event
- [ ] 4.4 Ensure backward compatibility when `robotShield` map is missing (legacy data)

## Task 5: Update BattleDetailsModal to use robotHP maps
_Requirements: 2.4, 3.1_

- [ ] 5.1 Add `robotHP` and `robotShield` fields to the CombatEvent interface in BattleDetailsModal.tsx
- [ ] 5.2 Create `getEventHP()` helper function with legacy fallback logic
- [ ] 5.3 Update the HP/Shield display JSX to use `getEventHP()` instead of direct `robot1HP`/`robot2HP` access
- [ ] 5.4 Test manually with existing battle data to verify backward compatibility

## Task 6: Create property-based test for HP consistency
_Requirements: 2.1, 2.5_

- [ ] 6.1 Create `hpTracking.pbt.test.ts` with robot pair arbitrary generator
- [ ] 6.2 Add property test: `robotHP[name]` always matches robot's actual state regardless of attacker/defender
- [ ] 6.3 Add property test: shield break count per robot equals 1 when shield depletes
- [ ] 6.4 Add property test: damage status messages only reference the actual defender

## Task 7: Update documentation
_Requirements: Documentation update requirement from spec standards_

- [ ] 7.1 Update `docs/prd_core/COMBAT_MESSAGES.md` to document `robotHP`/`robotShield` maps as canonical source
- [ ] 7.2 Update `docs/prd_core/BATTLE_SIMULATION_ARCHITECTURE.md` to add HP tracking data model section
- [ ] 7.3 Add deprecation note for `robot1HP`/`robot2HP` fields in code comments

## Task 8: Final verification
_Requirements: All verification criteria from requirements.md_

- [ ] 8.1 Run verification command: no direct robot1HP/robot2HP usage in message generator (except legacy fallback)
- [ ] 8.2 Run verification command: admin portal uses robotHP maps
- [ ] 8.3 Run combat simulator and message generator test suites
- [ ] 8.4 Run new HP tracking PBT test
- [ ] 8.5 Manual verification: simulate a battle and check admin portal displays correct HP values
