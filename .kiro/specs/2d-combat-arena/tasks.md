# Implementation Plan: 2D Combat Arena

## Overview

Transform the Armoured Souls combat simulator from a stationary exchange-of-blows model into a spatially-aware 2D arena system. Implementation proceeds bottom-up: pure math utilities first, then spatial subsystems, then the main simulation loop refactor, then backward compatibility wiring, then frontend components. All new modules are pure functions with no module-level mutable state.

## Tasks

- [x] 1. Create core spatial math and type foundations
  - [x] 1.1 Create `prototype/backend/src/services/arena/vector2d.ts` with 2D math utilities
    - Implement `Position` and `Vector2D` interfaces
    - Implement `euclideanDistance(a, b)`, `normalizeVector(v)`, `rotateVector(v, angleDeg)`, `lerp(a, b, t)`, `clampMagnitude(v, max)`, `angleBetween(a, b)` (degrees), `normalizeAngle(deg)` (to -180..180), `sign(n)`, `dotProduct(a, b)`
    - All functions are pure, handle zero-length vectors safely
    - _Requirements: 1.5, 1.6_

  - [x] 1.2 Write property tests for vector2d
    - **Property 1: euclideanDistance is symmetric — distance(a,b) === distance(b,a) for all positions**
    - **Validates: Requirement 1.6**
    - **Property 2: normalizeVector produces unit length (magnitude ≈ 1.0) for all non-zero vectors, and {0,0} for zero vectors**
    - **Validates: Requirement 1.6**
    - **Property 3: normalizeAngle always returns a value in [-180, 180] for any input angle**
    - **Validates: Requirement 9.1**

  - [x] 1.3 Create `prototype/backend/src/services/arena/types.ts` with all spatial interfaces
    - Define `RangeBand`, `RANGE_BAND_BOUNDARIES`, `RANGE_PENALTY`, `ArenaConfig`, `ArenaZone`, `MovementIntent`, `ThreatScore`, `WeaponRangeMapping`, `GameModeState`, `GameModeConfig`
    - Define extensibility interfaces: `TargetPriorityStrategy`, `MovementIntentModifier`, `WinConditionEvaluator`
    - Define extended `RobotCombatState` interface with all spatial fields
    - Define extended `CombatEvent` with optional position fields (backward compatible)
    - Define extended `CombatResult` with optional arena metadata
    - _Requirements: 1.1, 3.1, 14.2, 14.3, 15.7, 16.1–16.7_

- [x] 2. Implement arena layout and range band systems
  - [x] 2.1 Create `prototype/backend/src/services/arena/arenaLayout.ts`
    - Implement `calculateArenaRadius(totalRobots, overrideRadius?)` — 16 for 1v1, 20 for 2v2, scaling formula for larger
    - Implement `calculateSpawnPositions(teamSizes, radius)` — teams on opposite sides, vertical spread for multi-robot
    - Implement `createArena(teamSizes, overrideRadius?)` returning `ArenaConfig`
    - Implement `clampToArena(position, arena)` — clamp to circular boundary
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.7, 1.8_

  - [x] 2.2 Write property tests for arenaLayout
    - **Property 4: All spawn positions are inside the arena boundary (distance from center ≤ radius) for any team configuration**
    - **Validates: Requirements 1.2, 1.3, 1.4**
    - **Property 5: clampToArena always returns a position with distance from center ≤ radius for any input position**
    - **Validates: Requirement 1.7**
    - **Property 6: For 1v1, spawn distance between robots equals 2 × (radius − 2) for any valid radius**
    - **Validates: Requirement 1.2**

  - [x] 2.3 Create `prototype/backend/src/services/arena/rangeBands.ts`
    - Implement `classifyRangeBand(distance)` — melee/short/mid/long from distance
    - Implement `getRangePenalty(weaponRange, currentRange)` — 1.1 optimal, 0.75 one away, 0.5 two+ away
    - Implement `getWeaponOptimalRange(weapon)` — weapon type/hands/name to RangeBand mapping
    - Implement `canAttack(weapon, distance)` — melee blocked beyond 2 units
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 2.4 Write property tests for rangeBands
    - **Property 7: classifyRangeBand is monotonic — increasing distance never produces a "closer" range band**
    - **Validates: Requirement 3.1**
    - **Property 8: getRangePenalty returns exactly 1.1 when weaponRange equals currentRange for all range bands**
    - **Validates: Requirement 3.6**
    - **Property 9: All melee weapons return 'melee' optimal range, all shield weapons return 'melee' optimal range**
    - **Validates: Requirement 3.2**

- [x] 3. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement movement and servo strain systems
  - [x] 4.1 Create `prototype/backend/src/services/arena/servoStrain.ts`
    - Implement `calculateBaseSpeed(servoMotors)` — 7.0 + servoMotors × 0.2
    - Implement `calculateEffectiveSpeed(state, opponentSpeed, hasRangedOpponent)` — applies stance modifier, strain reduction, melee closing bonus
    - Implement `updateServoStrain(state, deltaTime)` — accumulation at >80% speed after 3s, decay at <50% speed, cap at 30%
    - Melee closing bonus exempt from strain accumulation
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 4.2 Write property tests for servoStrain
    - **Property 10: servoStrain is always clamped between 0 and 30 regardless of input sequence**
    - **Validates: Requirement 2.6**
    - **Property 11: calculateBaseSpeed is monotonically increasing with servoMotors (1–50)**
    - **Validates: Requirement 2.1**
    - **Property 12: Melee closing bonus always produces speed ≥ base speed (never reduces speed)**
    - **Validates: Requirements 2.5, 2.7**

  - [x] 4.3 Create `prototype/backend/src/services/arena/positionTracker.ts`
    - Implement `calculateTurnSpeed(gyroStabilizers)` — 180 + gyroStabilizers × 6
    - Implement `updateFacing(state, targetPosition, deltaTime, opponent?, threatAnalysis?)` — rotate toward target limited by turn speed, predictive turn bias for high threatAnalysis
    - Implement `checkBackstab(attacker, defender)` — >120° from facing = backstab, +10% bonus reduced by gyro and threatAnalysis
    - Implement `checkFlanking(attackers, defender)` — multi-robot only, >90° apart = flanking, +20% bonus reduced by gyro and threatAnalysis
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9_

  - [x] 4.4 Write property tests for positionTracker
    - **Property 13: Turn speed is always positive and monotonically increasing with gyroStabilizers (1–50)**
    - **Validates: Requirement 9.2**
    - **Property 14: Backstab bonus after gyro/TA reduction is never negative (clamped at 0)**
    - **Validates: Requirements 9.4, 9.5, 9.9**
    - **Property 15: Flanking detection requires at least 2 attackers — single attacker never triggers flanking**
    - **Validates: Requirement 9.7**

- [x] 5. Implement AI decision and attribute systems
  - [x] 5.1 Create `prototype/backend/src/services/arena/movementAI.ts`
    - Implement `calculateMovementIntent(state, opponents, arena, movementModifier?)` — strategy selection based on combatAlgorithms score (<0.3 random_bias, 0.3–0.6 direct_path, >0.6 calculated_path)
    - Implement movement prediction (score ≥ 0.4), threat-aware positioning (threatAnalysis > 15), flank approach bias (threatAnalysis > 20)
    - Implement `getPreferredRange(state)` — weapon-based range preference, DPS-weighted for mixed dual-wield, dynamic adjustment for high combat algorithm score
    - Implement patience timer logic — force attack after (15 − score × 5) seconds
    - Implement `applyMovement(state, intent, arena, deltaTime)` — move toward target, clamp to arena
    - Implement `enforceTeamSeparation(intent, state, teammates)` — minimum 1 unit separation
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10_

  - [x] 5.2 Write property tests for movementAI
    - **Property 16: applyMovement always produces a position inside the arena boundary for any input**
    - **Validates: Requirements 1.7, 5.2**
    - **Property 17: Patience timer limit is always between 10 and 15 seconds for any combatAlgorithms value (1–50)**
    - **Validates: Requirement 5.7**
    - **Property 18: getPreferredRange always returns a valid RangeBand for any weapon configuration**
    - **Validates: Requirement 10.1, 10.2, 10.3, 10.4**

  - [x] 5.3 Create `prototype/backend/src/services/arena/adaptationTracker.ts`
    - Implement `updateAdaptation(state, event)` — increment hit/damage bonus on damage_taken, hit bonus on miss
    - Implement `getEffectiveAdaptation(state)` — 50% effectiveness when HP > 70%
    - Cap at adaptiveAI × 0.5 (hit) and adaptiveAI × 0.25 (damage)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 5.4 Write property tests for adaptationTracker
    - **Property 19: Adaptation bonuses never exceed their caps (adaptiveAI × 0.5 for hit, adaptiveAI × 0.25 for damage) for any sequence of events**
    - **Validates: Requirement 7.4**
    - **Property 20: Effective adaptation at HP > 70% is exactly half of raw adaptation bonus**
    - **Validates: Requirement 7.5**

  - [x] 5.5 Create `prototype/backend/src/services/arena/pressureSystem.ts`
    - Implement `calculatePressureEffects(state)` — pressure threshold, accuracy/damage penalties, composure bonus for logicCores > 30, death spiral cap for logicCores < 10
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 5.6 Write property tests for pressureSystem
    - **Property 21: At logicCores = 30, accuracy and damage penalties are exactly 0 (fully negated)**
    - **Validates: Requirement 8.3**
    - **Property 22: For logicCores < 10, accuracy penalty ≤ 10% and damage penalty ≤ 8% (death spiral cap)**
    - **Validates: Requirement 8.4**
    - **Property 23: Pressure threshold is monotonically increasing with logicCores (1–50)**
    - **Validates: Requirement 8.1**

  - [x] 5.7 Create `prototype/backend/src/services/arena/threatScoring.ts`
    - Implement `calculateThreatScore(robot, opponent, distance, arenaRadius)` — arena-normalized proximity decay, combat power, HP%, weapon threat, targeting-me factor, scaled by threatAnalysis
    - Implement `selectTarget(robot, opponents, arenaRadius)` — sort by threat score, 10% tiebreaker rule for proximity
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 12.3, 12.4_

  - [x] 5.8 Write property tests for threatScoring
    - **Property 24: Threat score proximity decay is always in (0, 1] for any non-negative distance and positive arena radius**
    - **Validates: Requirement 6.1**
    - **Property 25: selectTarget always returns a living opponent when at least one exists**
    - **Validates: Requirement 12.4**

- [x] 6. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Refactor the main combat simulator with spatial mechanics
  - [x] 7.1 Create `prototype/backend/src/services/arena/hydraulicBonus.ts`
    - Implement `calculateHydraulicBonus(hydraulicSystems, rangeBand)` — melee: 1 + hydro × 0.03, short: 1 + hydro × 0.015, mid/long: 1.0
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 7.2 Create `prototype/backend/src/services/arena/teamCoordination.ts`
    - Implement `checkSyncVolley(state, currentTime)` — dual-wield 1.0s window, syncProtocols × 0.2% bonus
    - Implement `getSupportShieldBoost(state)` — supportSystems × 0.1% per tick
    - Implement `getFormationDefenseBonus(state, arena)` — within 3 units of edge, formationTactics × 0.3% reduction
    - _Requirements: 13.1, 13.2, 13.3_

  - [x] 7.3 Create `prototype/backend/src/services/arena/counterAttack.ts`
    - Implement `resolveCounter(defender, attacker, distance)` — range check main weapon, fallback to offhand for mixed dual-wield, hydraulic bonus on melee counters, emit counter_out_of_range when blocked
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6_

  - [x] 7.4 Write property tests for hydraulicBonus, teamCoordination, and counterAttack
    - **Property 26: Hydraulic bonus at melee range is always ≥ hydraulic bonus at short range for any hydraulicSystems value**
    - **Validates: Requirements 4.1, 4.2**
    - **Property 27: Hydraulic bonus at mid and long range is always exactly 1.0**
    - **Validates: Requirement 4.3**
    - **Property 28: Counter-attack with melee weapon at distance > 2 always returns canCounter: false (unless offhand fallback)**
    - **Validates: Requirement 19.1**

  - [x] 7.5 Refactor `prototype/backend/src/services/combatSimulator.ts` — integrate spatial simulation loop
    - Preserve the `simulateBattle(robot1, robot2, isTournament?)` export signature exactly
    - Add internal `initializeCombatState()` that creates extended `RobotCombatState` with position, facing, velocity, strain, AI state
    - Restructure the main loop into phases: Movement → Facing → Attacks (range-gated) → Counters (range-aware) → Shield Regen → State Checks → Position Snapshots
    - Wire in all spatial subsystems: range penalty, hydraulic bonus, backstab/flanking, adaptation, pressure, servo strain, movement AI, team coordination solo bonuses
    - Add arena metadata to `CombatResult` (arenaRadius, startingPositions, endingPositions)
    - Add optional position fields to `CombatEvent` emissions
    - Emit movement events only when significant (>1 unit or >0.5s interval) to control event volume
    - Emit range_transition events on band changes
    - Emit out_of_range events for blocked melee attacks
    - Ensure `simulateBattle` remains a pure function — no module-level mutable state
    - _Requirements: 1.5, 2.2, 3.5, 3.7, 5.4, 5.6, 7.6, 8.5, 9.10, 10.10, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 12.1, 12.2, 12.5, 12.6, 12.7, 14.1, 14.2, 14.3, 14.6, 14.7, 14.8, 14.9, 15.4, 15.7_

  - [x] 7.6 Write unit tests for the refactored simulateBattle
    - Test 1v1 battle completes and returns valid CombatResult with arena metadata
    - Test backward compatibility: all existing CombatResult fields present and correct
    - Test CombatEvent backward compatibility: existing event types retain their structure
    - Test melee vs ranged produces movement events and range transitions
    - Test out_of_range events emitted when melee robot is far from target
    - Test backstab detection produces backstab events
    - Test tournament HP tiebreaker still works correctly
    - Test pure function guarantee: calling simulateBattle twice with same inputs produces structurally consistent results
    - _Requirements: 14.1, 14.2, 14.3, 14.6, 14.7, 14.8, 14.9_

- [x] 8. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Update CombatMessageGenerator for spatial events
  - [x] 9.1 Modify `prototype/backend/src/services/combatMessageGenerator.ts`
    - Add message templates for new event types: movement, range_transition, out_of_range, counter_out_of_range, backstab, flanking
    - Incorporate spatial descriptions into existing attack/counter messages when position data is present
    - Graceful fallback: if CombatEvent lacks position data, use existing non-spatial templates unchanged
    - _Requirements: 14.4, 14.5, 15.3_

  - [x] 9.2 Write unit tests for spatial message generation
    - Test spatial messages generated when position data present
    - Test fallback to non-spatial messages when position data absent
    - Test backstab and flanking message templates
    - _Requirements: 14.4, 14.5_

- [x] 10. Implement frontend Battle Playback Viewer
  - [x] 10.1 Create `prototype/frontend/src/components/BattlePlaybackViewer/types.ts`
    - Define playback-specific types: PlaybackState, PlaybackSpeed, InterpolatedFrame
    - _Requirements: 17.7_

  - [x] 10.2 Create `prototype/frontend/src/components/BattlePlaybackViewer/usePlaybackEngine.ts`
    - Custom hook managing playback state: currentTime, isPlaying, speed (0.5×, 1×, 2×, 4×)
    - Interpolate robot positions between event snapshots for smooth animation
    - Provide play, pause, setSpeed, seekTo, skipToNextEvent controls
    - _Requirements: 17.3, 17.7_

  - [x] 10.3 Create `prototype/frontend/src/components/BattlePlaybackViewer/canvasRenderer.ts`
    - Pure rendering functions for Canvas 2D context
    - Render circular arena boundary, robot icons with team colors and names, HP/shield bars
    - Render attack indicators: projectile line (ranged), melee arc (melee), color-coded by hit/miss/crit/malfunction
    - Render backstab/flanking directional indicators
    - Render range band indicator between focused robot pair
    - Render range transition visual pulse
    - _Requirements: 17.1, 17.2, 17.4, 17.5, 17.8, 17.9, 17.10_

  - [x] 10.4 Create `prototype/frontend/src/components/BattlePlaybackViewer/ArenaCanvas.tsx`
    - React component wrapping Canvas element
    - Uses requestAnimationFrame at 30fps
    - Responsive: scales to viewport width, maintains aspect ratio, minimum 300×300px
    - Calls canvasRenderer functions each frame
    - _Requirements: 17.1, 17.13_

  - [x] 10.5 Create `prototype/frontend/src/components/BattlePlaybackViewer/PlaybackControls.tsx`
    - Play/pause button, speed selector (0.5×, 1×, 2×, 4×), skip to next event button
    - Timeline scrubber showing full battle duration with event markers
    - _Requirements: 17.7_

  - [x] 10.6 Create `prototype/frontend/src/components/BattlePlaybackViewer/CombatLogPanel.tsx`
    - Synchronized combat log panel alongside arena view
    - Auto-scrolls to current event during playback
    - Highlights the active event
    - _Requirements: 17.6_

  - [x] 10.7 Create `prototype/frontend/src/components/BattlePlaybackViewer/BattlePlaybackViewer.tsx`
    - Main container component composing ArenaCanvas, PlaybackControls, CombatLogPanel
    - Loads CombatResult data (including position events)
    - Graceful degradation: if no arenaRadius in data, show existing text-based combat log only
    - _Requirements: 17.11, 17.12_

  - [x] 10.8 Write unit tests for BattlePlaybackViewer
    - Test graceful degradation for battles without position data
    - Test playback engine interpolation produces valid positions
    - Test playback controls state transitions (play/pause/speed)
    - _Requirements: 17.3, 17.7, 17.12_

- [x] 11. Implement Weapon Shop range filter and Battle Results spatial summary
  - [x] 11.1 Create shared `getWeaponOptimalRange()` utility for frontend
    - Create `prototype/frontend/src/utils/weaponRange.ts` with the same weapon-to-range-band mapping as the backend
    - _Requirements: 18.1_

  - [x] 11.2 Add range filter to Weapon Shop page
    - Add range filter toggle buttons: All, Melee, Short, Mid, Long
    - Display Optimal Range badge on each weapon card (color-coded by band)
    - Combine range filter with existing category and owned-only filters via AND logic
    - _Requirements: 18.1, 18.2, 18.3_

  - [x] 11.3 Add Optimal Range label to Robot Detail Page weapon selection modal
    - Display range band label for each weapon in the selection modal
    - _Requirements: 18.4_

  - [x] 11.4 Add spatial summary to Battle Results and Battle History pages
    - Display arena size, starting/ending positions, range band distribution, total distance moved when position data is available
    - _Requirements: 15.6_

- [x] 12. Integrate Playback Viewer into Battle Results and Battle History pages
  - [x] 12.1 Wire BattlePlaybackViewer into Battle Results page
    - Add viewer as primary battle visualization when position data exists
    - Fall back to existing text log for pre-2D battles
    - _Requirements: 17.11, 17.12_

  - [x] 12.2 Wire BattlePlaybackViewer into Battle History page
    - Add viewer accessible from battle history entries
    - _Requirements: 17.11_

- [x] 13. Update documentation
  - [x] 13.1 Update `docs/prd_core/COMBAT_FORMULAS.md`
    - Add all new formulas: Movement_Speed, Range_Penalty, Hydraulic_Bonus, Backstab bonus, Flanking bonus, Patience_Timer, Adaptation_Bonus, Pressure effects, Servo_Strain, Threat_Score
    - _Requirements: 15.1_

  - [x] 13.2 Update `docs/prd_core/PRD_ROBOT_ATTRIBUTES.md`
    - Document combat roles for servoMotors, hydraulicSystems, combatAlgorithms, threatAnalysis, adaptiveAI, logicCores, syncProtocols, supportSystems, formationTactics
    - _Requirements: 15.2_

  - [x] 13.3 Update `docs/prd_core/COMBAT_MESSAGES.md`
    - Add message templates for movement, range_transition, out_of_range, counter_out_of_range, backstab, flanking events
    - _Requirements: 15.3_

- [x] 14. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- All new modules under `prototype/backend/src/services/arena/` are pure functions
- The `simulateBattle` function signature is preserved exactly for backward compatibility
- No database schema changes — position data stored in existing `Battle.battleLog` JSON column
