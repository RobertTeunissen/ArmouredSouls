# Requirements Document

## Introduction

The 2D Combat Arena redesigns the Armoured Souls battle simulation to introduce spatial positioning, range-based mechanics, and meaningful combat roles for all 23 robot attributes. Currently, 9 of 23 attributes (servoMotors, hydraulicSystems, combatAlgorithms, threatAnalysis, adaptiveAI, logicCores, syncProtocols, supportSystems, formationTactics) have zero impact on combat outcomes. The existing simulator is effectively 1D — two robots stand in place and trade attacks on cooldown with no concept of distance, movement, or positioning.

This feature introduces a 2D arena where robots occupy positions, move continuously each simulation step (0.1s), and must respect weapon range constraints. Melee weapons require closing distance, ranged weapons benefit from keeping distance, and the previously dead attributes gain concrete mechanical roles in movement, positioning, target selection, and tactical adaptation.

The system is designed for 1v1 battles as the primary mode, with explicit support for multi-robot battles (2v2, 5v5) using the team coordination attributes. The arena architecture is extensible to future game modes (battle royale, king of the hill) without requiring structural changes.

## Glossary

- **Arena**: A bounded 2D circular coordinate space where combat takes place, defined by a center point and radius in grid units. Circular shape prevents corner-camping exploits and fits the gladiatorial combat theme
- **Combat_Simulator**: The backend service (`combatSimulator.ts`) that executes time-based battle simulation using a continuous loop with SIMULATION_TICK = 0.1 seconds
- **Simulation_Step**: A single iteration of the combat loop, advancing currentTime by SIMULATION_TICK (0.1 seconds). All movement, attacks, and regeneration occur per simulation step
- **Position**: An (x, y) coordinate pair representing a robot's location within the Arena, updated every Simulation_Step
- **Distance**: The Euclidean distance between two robot Positions, measured in grid units
- **Range_Band**: A classification of distance into melee (0–2 units), short (3–6 units), mid (7–12 units), and long (13+ units) categories
- **Movement_Speed**: The rate at which a robot moves, expressed in grid units per second, derived from the servoMotors attribute. Per Simulation_Step, a robot moves Movement_Speed × 0.1 units
- **Movement_Intent**: The AI-determined direction and target position a robot attempts to move toward each Simulation_Step, driven by AI Processing attributes
- **Optimal_Range**: The Range_Band at which a weapon deals full damage without penalty
- **Range_Penalty**: A damage multiplier reduction applied when attacking outside a weapon's Optimal_Range. Penalty increases with distance from Optimal_Range (one band away: 0.75×, two bands away: 0.5×)
- **Threat_Score**: A numerical evaluation of an opponent's danger level, computed using the threatAnalysis attribute. In multi-robot battles, used for target selection priority
- **Adaptation_Bonus**: A cumulative combat bonus that increases when a robot takes damage or misses attacks, based on the adaptiveAI attribute. Designed to help losing robots adapt
- **Pressure_Threshold**: The HP percentage below which logicCores modifies combat performance. Calculated as (15 + logicCores × 0.6)%, so the attribute itself determines how early the pressure system activates. Low logicCores = tiny pressure window with penalties, high logicCores = wide pressure window with bonuses
- **Hydraulic_Bonus**: Additional melee damage scaling derived from the hydraulicSystems attribute, compensating for the positioning cost of closing distance
- **Combat_Algorithm_Score**: A decision-quality metric derived from combatAlgorithms that influences movement decisions, attack timing, and target selection
- **Positioning_Advantage**: A combat bonus granted when a robot achieves superior positioning relative to its opponent. In 1v1, this is based on movement speed differential and approach angle. In multi-robot battles, this extends to true flanking (2+ attackers from different angles)
- **Flanking**: A multi-robot combat mechanic where 2 or more attackers engage a defender from different angles (>90° apart). Grants a damage bonus to all flanking attackers. Only available in team battles (2v2+)
- **Backstab**: A 1v1 positioning mechanic where the attacker is behind the defender (>120° from Facing_Direction), granting a smaller damage bonus than Flanking
- **Facing_Direction**: The angular orientation of a robot toward its current target, updated each Simulation_Step limited by Turn_Speed
- **Turn_Speed**: The rate at which a robot can rotate its Facing_Direction, expressed in degrees per second, derived from gyroStabilizers. Determines how quickly a robot can react to flanking or backstab attempts
- **Arena_Boundary**: The circular edge of the Arena; robots cannot move beyond the radius from center
- **Patience_Timer**: A countdown that forces a robot to attack even when not at optimal range, preventing indefinite waiting. Resets when the robot attacks
- **Engagement_Zone**: In multi-robot battles, the area around a robot where it can be targeted. Robots must choose which Engagement_Zone to enter based on Threat_Score
- **Target_Priority**: In multi-robot battles, the order in which a robot selects opponents to attack, determined by threatAnalysis and combatAlgorithms
- **Preferred_Range**: For robots with mixed-range loadouts (e.g., melee main + ranged offhand in dual-wield), the DPS-weighted compromise position between the two weapons' Optimal_Ranges. Dynamically adjusted by Combat_Algorithm_Score based on combat state
- **Servo_Strain**: A fatigue mechanic that reduces Movement_Speed when a robot moves continuously at full speed for extended periods. Represents servo motor overheating. Prevents indefinite kiting by fast ranged robots
- **Counter_Range**: The maximum Distance at which a counter-attack can be executed, determined by the counter-attacking robot's main weapon Optimal_Range. Melee counters require melee range; ranged counters can trigger within the weapon's Optimal_Range band

## Requirements

### Requirement 1: 2D Arena Space

**User Story:** As a player, I want battles to take place on a 2D arena with spatial positioning, so that movement and positioning become meaningful tactical elements.

#### Acceptance Criteria

1. THE Combat_Simulator SHALL represent the Arena as a 2D coordinate space defined by a center point and a radius, forming a circular arena. The default radius SHALL be 16 grid units for 1v1 battles (32 unit diameter), providing a starting distance of approximately 16 units between robots on opposite sides
2. WHEN a 1v1 battle begins, THE Combat_Simulator SHALL place robots at starting Positions on opposite sides of the Arena along the horizontal axis, each offset from the center by (radius − 2) units (e.g., robot1 at (center − 14, center), robot2 at (center + 14, center)), producing a starting distance of 28 units (well into long range)
3. WHEN a 2v2 battle begins, THE Combat_Simulator SHALL place each team on opposite sides of the Arena, with teammates spaced vertically by 4 grid units from the team center. The arena radius SHALL scale to 20 grid units for 2v2
4. WHEN a battle with more than 4 robots begins, THE Combat_Simulator SHALL distribute each team evenly along their side of the Arena with equal angular spacing. The arena radius SHALL scale as: base 16 + (total robots − 2) × 3 grid units (e.g., 5v5 = 40 unit radius)
5. THE Combat_Simulator SHALL track each robot's Position as an (x, y) coordinate pair updated every Simulation_Step (0.1 seconds)
6. THE Combat_Simulator SHALL calculate Distance between robots using Euclidean distance
7. IF a robot's Movement_Intent would place the robot outside the Arena boundary (distance from center exceeds radius), THEN THE Combat_Simulator SHALL clamp the robot's Position to the nearest valid coordinate on the Arena boundary circle
8. THE Combat_Simulator SHALL accept an optional arena configuration parameter specifying the radius (overriding the default scaling)

### Requirement 2: Continuous Movement System Using Servo Motors

**User Story:** As a player, I want my robot's servoMotors attribute to determine how fast it moves around the arena, so that investing in mobility provides a tangible combat advantage.

#### Acceptance Criteria

1. THE Combat_Simulator SHALL calculate Movement_Speed in units per second as: base 7.0 units/s + servoMotors × 0.2 units/s (range: 7.2 at servoMotors 1 to 17.0 at servoMotors 50, a 2.4× difference that is meaningful without being dominant)
2. WHEN a Simulation_Step occurs (every 0.1 seconds), THE Combat_Simulator SHALL move each robot toward its Movement_Intent by up to (Movement_Speed × 0.1) units
3. WHILE a robot has a Movement_Speed greater than the opponent's Movement_Speed, THE Combat_Simulator SHALL allow that robot to control engagement distance by outpacing the opponent
4. THE Combat_Simulator SHALL include Movement_Speed (in units/second) in the battle start event formula breakdown
5. WHEN a melee-equipped robot has lower Movement_Speed than a ranged-equipped opponent, THE Combat_Simulator SHALL grant the melee robot a closing speed bonus that scales with the speed gap: base +15% Movement_Speed plus an additional +1% per point of Movement_Speed difference (e.g., if the ranged robot is 5 units/s faster, the melee robot gets +20% closing bonus). This bonus applies while the Distance exceeds the melee Range_Band maximum, representing aggressive charge behavior
6. THE Combat_Simulator SHALL track Servo_Strain per robot, starting at 0. WHEN a robot moves at more than 80% of its maximum Movement_Speed for more than 3 consecutive seconds, THE Combat_Simulator SHALL increase Servo_Strain by 2% per second of sustained movement. WHEN Servo_Strain exceeds 0, THE Combat_Simulator SHALL reduce effective Movement_Speed by the Servo_Strain percentage (capped at 30% reduction). WHEN a robot moves at less than 50% of its maximum Movement_Speed or stands still, Servo_Strain SHALL decay at 5% per second. This prevents fast ranged robots from kiting indefinitely — they must periodically slow down, giving melee robots windows to close distance
7. THE Combat_Simulator SHALL exempt the melee closing speed bonus (AC 5) from Servo_Strain accumulation, so that melee robots charging toward a ranged opponent do not get penalized for sustained pursuit


### Requirement 3: Range Bands and Weapon Range Enforcement

**User Story:** As a player, I want weapons to have effective ranges so that positioning relative to my opponent determines which weapons are most effective.

#### Acceptance Criteria

1. THE Combat_Simulator SHALL classify Distance into four Range_Bands: melee (0–2 units), short (3–6 units), mid (7–12 units), and long (13+ units)
2. THE Combat_Simulator SHALL assign each weapon an Optimal_Range based on its weapon category: melee weapons → melee band, energy/ballistic one-handed → short band, energy/ballistic two-handed (non-sniper) → mid band, sniper/railgun/ion beam → long band
3. WHEN a robot attacks with a weapon one Range_Band away from its Optimal_Range, THE Combat_Simulator SHALL apply a Range_Penalty of 0.75× damage multiplier
4. WHEN a robot attacks with a weapon two or more Range_Bands away from its Optimal_Range, THE Combat_Simulator SHALL apply a Range_Penalty of 0.5× damage multiplier
5. WHEN a robot attacks with a melee weapon and the Distance exceeds the melee Range_Band maximum (2 units), THE Combat_Simulator SHALL prevent the attack and log an "out of range" event
6. WHEN a robot attacks within its weapon's Optimal_Range, THE Combat_Simulator SHALL apply a 1.1× damage bonus representing optimal engagement distance
7. THE Combat_Simulator SHALL include the current Distance, Range_Band, and any Range_Penalty or optimal range bonus in each attack event's formula breakdown

### Requirement 4: Hydraulic Systems — Proximity-Scaled Damage Bonus

**User Story:** As a player, I want my robot's hydraulicSystems attribute to increase damage at close range, scaling with proximity, so that investing in hydraulics rewards aggressive positioning across all weapon types while giving melee the strongest bonus.

#### Acceptance Criteria

1. WHEN a robot attacks within the melee Range_Band (0–2 units), THE Combat_Simulator SHALL apply a Hydraulic_Bonus damage multiplier of (1 + hydraulicSystems × 0.03), representing full physical force at point-blank range
2. WHEN a robot attacks within the short Range_Band (3–6 units), THE Combat_Simulator SHALL apply a reduced Hydraulic_Bonus damage multiplier of (1 + hydraulicSystems × 0.015), representing diminished but still relevant physical force at close range
3. WHEN a robot attacks within the mid Range_Band (7–12 units) or long Range_Band (13+ units), THE Combat_Simulator SHALL NOT apply the Hydraulic_Bonus
4. THE Combat_Simulator SHALL include the Hydraulic_Bonus and the current Range_Band in the damage formula breakdown for attacks where the bonus applies

### Requirement 5: Combat Algorithms — Movement AI and Attack Timing

**User Story:** As a player, I want my robot's combatAlgorithms attribute to drive intelligent movement decisions and attack timing, so that investing in AI processing produces smarter combat behavior.

#### Acceptance Criteria

1. THE Combat_Simulator SHALL calculate a Combat_Algorithm_Score from the combatAlgorithms attribute (combatAlgorithms / 50, range 0.0–1.0)
2. WHEN determining Movement_Intent each Simulation_Step, THE Combat_Simulator SHALL use the Combat_Algorithm_Score to select the movement strategy: score below 0.3 results in semi-random movement biased toward the opponent, score 0.3–0.6 results in direct-path movement toward Optimal_Range, score above 0.6 results in calculated pathing that considers approach angles and Arena_Boundary positioning
3. WHEN the Combat_Algorithm_Score exceeds 0.4, THE Combat_Simulator SHALL read the opponent's current movement vector (direction and speed) and use it to predict the opponent's position 1–2 seconds ahead. Movement_Intent SHALL target the predicted position rather than the current position, enabling interception (for melee) or preemptive repositioning (for ranged). Prediction accuracy scales with Combat_Algorithm_Score: at 0.4 = 50% weight on predicted position, at 1.0 = 100% weight
4. WHEN a robot's attack cooldown is ready but the robot is outside its weapon's Optimal_Range, THE Combat_Simulator SHALL use the Combat_Algorithm_Score to decide between attacking immediately with a Range_Penalty or waiting up to the Patience_Timer limit to reach Optimal_Range
5. WHEN the Combat_Algorithm_Score exceeds 0.5, THE Combat_Simulator SHALL grant a 1–5% hit chance bonus representing superior target tracking (scaled linearly from the score)
6. THE Combat_Simulator SHALL include the Combat_Algorithm_Score, the chosen movement strategy, and any movement prediction data in the movement decision formula breakdown
7. THE Combat_Simulator SHALL enforce a Patience_Timer of (15 − Combat_Algorithm_Score × 5) seconds; WHEN the Patience_Timer expires without the robot attacking, THE Combat_Simulator SHALL force the robot to attack at its current range with applicable Range_Penalty


### Requirement 6: Threat Analysis — Positioning, Target Priority, and Defensive Awareness

**User Story:** As a player, I want my robot's threatAnalysis attribute to improve its positioning decisions and target selection, so that high threat analysis leads to better arena control.

#### Acceptance Criteria

1. THE Combat_Simulator SHALL calculate a Threat_Score for each opponent based on the robot's threatAnalysis attribute and the opponent's current combat power, HP percentage, and weapon type
2. WHEN determining Movement_Intent, THE Combat_Simulator SHALL use the Threat_Score to bias movement toward the robot's Optimal_Range for its equipped weapon
3. WHEN a robot has threatAnalysis above 15, THE Combat_Simulator SHALL evaluate the opponent's equipped weapons to determine the opponent's Optimal_Range, and apply an avoidance bias to Movement_Intent that steers away from the opponent's Optimal_Range when it conflicts with the robot's own Optimal_Range (avoidance strength scales linearly with threatAnalysis: at 15 = 25% avoidance weight, at 50 = 100% avoidance weight)
4. WHEN a robot has threatAnalysis above 25, THE Combat_Simulator SHALL grant a defensive awareness bonus that reduces incoming Backstab damage bonus by (threatAnalysis − 25) × 1%, representing spatial awareness of attacker positioning
5. WHEN a multi-robot battle occurs, THE Combat_Simulator SHALL use the Threat_Score to determine Target_Priority, selecting the highest-threat opponent as the primary target
6. THE Combat_Simulator SHALL include the Threat_Score, opponent Optimal_Range awareness, and target selection reasoning in the movement decision formula breakdown

### Requirement 7: Adaptive AI — Reactive Learning from Adversity

**User Story:** As a player, I want my robot's adaptiveAI attribute to help it adapt when losing, so that longer fights give struggling robots a chance to recover rather than snowballing the winner's advantage.

#### Acceptance Criteria

1. THE Combat_Simulator SHALL track an Adaptation_Bonus per robot that starts at 0
2. WHEN a robot takes damage, THE Combat_Simulator SHALL increase that robot's Adaptation_Bonus by (adaptiveAI × 0.02)% to hit chance and (adaptiveAI × 0.01)% to damage per hit received
3. WHEN a robot misses an attack, THE Combat_Simulator SHALL increase that robot's Adaptation_Bonus by (adaptiveAI × 0.03)% to hit chance, representing learning from failed attacks
4. THE Combat_Simulator SHALL cap the Adaptation_Bonus at a maximum of (adaptiveAI × 0.5)% for hit chance and (adaptiveAI × 0.25)% for damage
5. WHEN a robot's HP is above 70%, THE Combat_Simulator SHALL apply the Adaptation_Bonus at 50% effectiveness, preventing the winning robot from gaining full adaptive benefits
6. THE Combat_Simulator SHALL include the current Adaptation_Bonus and its trigger (damage taken or miss) in each attack event formula breakdown

### Requirement 8: Logic Cores — Composure Under Pressure

**User Story:** As a player, I want my robot's logicCores attribute to maintain combat effectiveness when damaged, so that high logic cores robots stay dangerous at low HP without creating a death spiral for low logic cores robots.

#### Acceptance Criteria

1. WHILE a robot's current HP is below its Pressure_Threshold (15 + logicCores × 0.6)%, THE Combat_Simulator SHALL apply a low-HP accuracy penalty of max(0, (15 − logicCores × 0.5))% and a damage penalty of max(0, (10 − logicCores × 0.33))%
2. WHEN logicCores exceeds 30 and the robot's HP is below its Pressure_Threshold, THE Combat_Simulator SHALL grant a composure bonus of (logicCores − 30) × 0.5% to both hit chance and damage, representing a robot that performs BETTER under pressure (e.g., logicCores 40 = +5% bonus, logicCores 50 = +10% bonus)
3. THE Combat_Simulator SHALL fully negate the low-HP penalty when logicCores reaches 30, providing a clear mid-investment milestone. At logicCores 30, the Pressure_Threshold is 33% HP — a meaningful window where the robot operates penalty-free
4. WHILE a robot's current HP is below its Pressure_Threshold and logicCores is below 10, THE Combat_Simulator SHALL cap the combined accuracy penalty at 10% and the damage penalty at 8%, preventing extreme death spirals. At logicCores below 10, the Pressure_Threshold is below 21% HP — a narrow window that limits exposure to penalties
5. THE Combat_Simulator SHALL include the logicCores adjustment, the robot's calculated Pressure_Threshold, and the current HP percentage in the attack formula breakdown when the robot's HP is below the Pressure_Threshold


### Requirement 9: Positioning Advantage — Backstab (1v1) and Flanking (Team Battles)

**User Story:** As a player, I want positioning angles to matter in combat, with backstab mechanics in 1v1 and true flanking in team battles, so that maneuvering provides a tactical advantage appropriate to the battle format.

#### Acceptance Criteria

1. THE Combat_Simulator SHALL track a Facing_Direction for each robot as an angle in degrees, initialized to point toward the nearest opponent at battle start
2. THE Combat_Simulator SHALL calculate a Turn_Speed for each robot in degrees per second as: base 180°/s + gyroStabilizers × 6°/s (at gyroStabilizers 1 = 186°/s, at 50 = 480°/s)
3. WHEN a Simulation_Step occurs, THE Combat_Simulator SHALL rotate each robot's Facing_Direction toward its current target by up to (Turn_Speed × 0.1) degrees, meaning robots with low gyroStabilizers cannot instantly face a fast-moving attacker
4. WHEN in a 1v1 battle and an attacker's Position is more than 120 degrees from the defender's Facing_Direction at the moment of attack, THE Combat_Simulator SHALL classify the attack as a Backstab and apply a +10% damage bonus
5. THE Combat_Simulator SHALL reduce the Backstab damage bonus by (defender's gyroStabilizers × 0.25)%, representing faster turning and spatial awareness
6. WHEN a robot has threatAnalysis above 20 and the opponent's Movement_Intent is directed toward the robot's rear arc (>90° from Facing_Direction), THE Combat_Simulator SHALL apply a predictive turn bias: the robot begins rotating toward the flanking attacker at 50% + (threatAnalysis − 20) × 1.5% of its Turn_Speed, even before the attacker reaches the rear arc
7. WHEN in a multi-robot battle (2v2+) and two or more attackers engage the same defender from angles more than 90 degrees apart, THE Combat_Simulator SHALL classify attacks from the secondary attacker(s) as Flanking and apply a +20% damage bonus
8. THE Combat_Simulator SHALL reduce the Flanking damage bonus by (defender's gyroStabilizers × 0.3)%, representing the defender's ability to track multiple threats
9. WHEN a robot has threatAnalysis above 25, THE Combat_Simulator SHALL reduce incoming Backstab and Flanking damage bonuses by an additional (threatAnalysis − 25) × 1% (as defined in Requirement 6)
10. THE Combat_Simulator SHALL include the attack angle, Facing_Direction, Turn_Speed, and any Backstab or Flanking bonus in the attack formula breakdown

### Requirement 10: Movement AI Decision Framework

**User Story:** As a player, I want my robot to intelligently choose where to move based on its full loadout (all equipped weapons and shields), combat stance, and AI attributes, so that the AI makes sensible positioning decisions every simulation step.

#### Acceptance Criteria

1. WHEN a robot has only melee weapons equipped (single melee or dual-wield melee), THE Combat_Simulator SHALL set the Movement_Intent to close distance toward the nearest opponent to reach the melee Range_Band
2. WHEN a robot has only ranged weapons equipped (single ranged, dual-wield ranged, or two-handed ranged), THE Combat_Simulator SHALL set the Movement_Intent to maintain distance within the main weapon's Optimal_Range
3. WHEN a robot has a weapon+shield loadout, THE Combat_Simulator SHALL set the Movement_Intent based on the main weapon's Optimal_Range, identical to a single-weapon loadout. The shield provides passive defensive value regardless of positioning and does not influence range preference
4. WHEN a robot has a mixed dual-wield loadout (weapons with different Optimal_Ranges, e.g., melee main + ranged offhand), THE Combat_Simulator SHALL calculate a Preferred_Range as a weighted position between the two weapons' Optimal_Ranges, weighted by each weapon's DPS contribution (higher DPS weapon has more influence on positioning)
5. WHEN a robot has a mixed dual-wield loadout and Combat_Algorithm_Score exceeds 0.5, THE Combat_Simulator SHALL dynamically adjust Preferred_Range based on combat state: bias toward the melee weapon's range when the opponent's shield is depleted (melee burst opportunity), and bias toward the ranged weapon's range when the opponent has high shield/armor (chip damage from range)
6. WHILE a robot is in defensive stance, THE Combat_Simulator SHALL reduce Movement_Speed by 20% and bias Movement_Intent toward maintaining current distance
7. WHILE a robot is in offensive stance, THE Combat_Simulator SHALL increase Movement_Speed by 10% and bias Movement_Intent toward closing distance
8. THE Combat_Simulator SHALL use the combatAlgorithms attribute to determine movement quality: low combatAlgorithms (below 15) adds ±30° random deviation to Movement_Intent direction, mid combatAlgorithms (15–30) adds ±15° deviation, high combatAlgorithms (above 30) produces direct optimal pathing
9. THE Combat_Simulator SHALL use the threatAnalysis attribute to influence target-relative positioning: high threatAnalysis (above 20) biases movement to approach from the opponent's flank or rear when Movement_Speed advantage allows
10. WHEN a robot cannot reach its Preferred_Range or Optimal_Range within the Patience_Timer duration (calculated from Movement_Speed and current Distance), THE Combat_Simulator SHALL adjust Movement_Intent to the nearest reachable Range_Band and attack with the applicable Range_Penalty

### Requirement 11: Range-Aware Combat Events and Battle Log

**User Story:** As a player, I want the battle log to describe movement, positioning, and range so that I can understand the spatial flow of combat.

#### Acceptance Criteria

1. WHEN a robot moves more than 1 grid unit in a single Simulation_Step, THE Combat_Simulator SHALL emit a movement event with the robot's new Position and Distance to the nearest opponent
2. WHEN a robot enters a new Range_Band relative to its target, THE Combat_Simulator SHALL emit a range transition event (e.g., "closes to melee range" or "falls back to long range")
3. WHEN a Backstab attack occurs in 1v1, THE Combat_Simulator SHALL include backstab context in the attack event message
4. WHEN a Flanking attack occurs in team battles, THE Combat_Simulator SHALL include flanking context in the attack event message
5. THE Combat_Simulator SHALL include Position coordinates in each CombatEvent for all robots in the battle
6. WHEN a melee attack is blocked by distance, THE Combat_Simulator SHALL emit an "out of range" event describing the failed attack attempt and the remaining distance to close


### Requirement 12: Multi-Robot Battle Support

**User Story:** As a player, I want the 2D arena to support team battles (2v2, 5v5, and larger), so that team coordination attributes become meaningful and battles scale beyond 1v1.

#### Acceptance Criteria

1. THE Combat_Simulator SHALL support battles with any number of robots per team (minimum 1v1, designed for up to 5v5)
2. WHEN a multi-robot battle begins, THE Combat_Simulator SHALL track Position, Facing_Direction, and combat state independently for each robot
3. THE Combat_Simulator SHALL require each robot to select a single target each Simulation_Step using Target_Priority derived from threatAnalysis
4. WHEN a robot's current target is destroyed or yields, THE Combat_Simulator SHALL immediately reassign the robot to the next highest-priority target
5. WHEN multiple robots on the same team target the same opponent, THE Combat_Simulator SHALL evaluate Flanking conditions (Requirement 9) based on the attackers' relative positions
6. THE Combat_Simulator SHALL calculate Movement_Intent independently for each robot, with team-aware positioning: robots on the same team avoid overlapping positions (minimum 1 unit separation)
7. THE Combat_Simulator SHALL end a multi-robot battle when all robots on one team are destroyed or have yielded

### Requirement 13: Team Coordination Attributes — Sync Protocols, Support Systems, Formation Tactics

**User Story:** As a player, I want the team coordination attributes to provide minor solo combat benefits in 1v1 and full team coordination bonuses in team battles, so that these attributes are valuable in all battle formats.

#### Acceptance Criteria

1. WHEN a 1v1 battle occurs, THE Combat_Simulator SHALL apply syncProtocols as a minor attack timing bonus: when both the robot's main and offhand weapons are ready within a 1.0-second window of each other, syncProtocols × 0.2% bonus damage for the coordinated volley
2. WHEN a 1v1 battle occurs, THE Combat_Simulator SHALL apply supportSystems as a passive self-repair effect: energy shield regeneration rate increased by supportSystems × 0.1% per Simulation_Step
3. WHEN a 1v1 battle occurs, THE Combat_Simulator SHALL apply formationTactics as a positional defense bonus: when the robot is within 3 grid units of the Arena_Boundary (circular edge), formationTactics × 0.3% damage reduction representing wall-bracing
4. WHEN a team battle (2v2+) occurs, THE Combat_Simulator SHALL apply the team coordination formulas as defined in PRD_ROBOT_ATTRIBUTES.md: syncProtocols provides coordination_mult = 1 + (avg_sync / 50) applied to team damage and defense; supportSystems provides buff_amount = support_systems × 0.3 applied to ally armor or combat power for 5 seconds; formationTactics provides defense_bonus = formation_tactics / 10 and accuracy_bonus = formation_tactics / 15 when robots maintain formation
5. THE Combat_Simulator SHALL include team coordination attribute effects in the relevant formula breakdowns
6. WHEN validating the sync window for syncProtocols in 1v1, THE Combat_Simulator SHALL use a 1.0-second window (accounting for the typical cooldown differential between main hand and offhand weapons with the 1.4× offhand penalty)

### Requirement 14: Backward Compatibility

**User Story:** As a developer, I want the new 2D combat system to maintain the same CombatResult interface contract, so that existing orchestrators and message generators continue to work without modification.

#### Acceptance Criteria

1. THE Combat_Simulator SHALL continue to export the same `simulateBattle(robot1, robot2, isTournament?)` function signature for 1v1 battles
2. THE CombatResult SHALL retain all existing fields (winnerId, robot1FinalHP, robot2FinalHP, robot1Damage, robot2Damage, durationSeconds, isDraw, events)
3. THE CombatEvent SHALL retain all existing fields and add new optional position fields without breaking existing consumers
4. WHEN the Combat_Message_Generator receives CombatEvents with position data, THE Combat_Message_Generator SHALL incorporate spatial descriptions into narrative messages
5. IF a CombatEvent lacks position data, THEN THE Combat_Message_Generator SHALL fall back to existing non-spatial message templates
6. WHEN `simulateBattle(robot1, robot2, true)` is called with isTournament set to true, THE Combat_Simulator SHALL resolve draws via HP tiebreaker (the robot with higher remaining HP wins), preserving the existing tournament draw-resolution behavior used by `tournamentBattleOrchestrator.ts`. Robots enter tournament battles at full HP and full shield, and the HP tiebreaker SHALL work correctly with the new spatial combat system
7. WHEN `simulateBattle()` is called multiple times in sequence by the tag team orchestrator (`tagTeamBattleOrchestrator.ts`), THE Combat_Simulator SHALL treat each call as a fresh battle with a fresh arena and fresh starting positions, maintaining no persistent state between calls. The tag team orchestrator runs up to 3 sequential phases: Phase 1 fights active robots, then when a robot yields or is destroyed the reserve robot tags in at full HP and a new `simulateBattle()` call begins
8. THE Combat_Simulator SHALL produce CombatEvents that are compatible with the tag team event aggregation — the tag team orchestrator strips terminal events (yield, destroyed, battle_end) from intermediate phases and offsets timestamps, so CombatEvent timestamps and types SHALL remain consistent with the existing event schema
9. THE Combat_Simulator SHALL NOT store or rely on any global or module-level mutable state between `simulateBattle()` invocations, ensuring that sequential calls from the tag team orchestrator produce independent, deterministic results per call

### Requirement 15: Cross-System Impact and Documentation Updates

**User Story:** As a developer, I want all affected system documents and components to be updated when the 2D arena is implemented, so that the codebase and documentation remain consistent.

#### Acceptance Criteria

1. WHEN the 2D arena system is implemented, THE Combat_Simulator SHALL update COMBAT_FORMULAS.md with all new formulas: Movement_Speed calculation, Range_Penalty multipliers, Hydraulic_Bonus, Precision_Bonus, Backstab bonus (1v1 angle-based +10%), Flanking bonus (team 2v2+ multi-attacker +20%), Patience_Timer, and Adaptation_Bonus
2. WHEN the 2D arena system is implemented, THE Combat_Simulator SHALL update PRD_ROBOT_ATTRIBUTES.md to document the combat roles of servoMotors, hydraulicSystems, combatAlgorithms, threatAnalysis, adaptiveAI, logicCores, syncProtocols, supportSystems, and formationTactics
3. WHEN the 2D arena system is implemented, THE Combat_Simulator SHALL update COMBAT_MESSAGES.md with new message templates for movement events, range transition events, out-of-range events, backstab events, flanking events, and positioning descriptions
4. WHEN the 2D arena system is implemented, THE Combat_Simulator SHALL extend the CombatEvent interface with optional position fields (robot1X, robot1Y, robot2X, robot2Y) and range/movement metadata without removing existing fields
5. WHEN the 2D arena system is implemented, THE Admin_Panel battle viewer SHALL display position data for each combat event when available
6. WHEN the 2D arena system is implemented, THE Battle_History and Battle_Results pages SHALL display spatial summary data (arena size, total distance moved, range band distribution) when position data is available
7. THE CombatResult SHALL include the arena radius, starting Positions, and ending Positions of all robots in the battle
8. WHEN the 2D arena system is implemented, THE Onboarding_System Step 6 (Weapon Type and Loadout Education) SHALL teach range bands as part of weapon education — weapon categories now have Optimal_Ranges (melee weapons → melee band, energy/ballistic one-handed → short band, energy/ballistic two-handed → mid band, sniper/railgun/ion beam → long band) and players need to understand how weapon choice affects positioning strategy
9. WHEN the 2D arena system is implemented, THE Onboarding_System Step 8 (Battle Readiness) SHALL include 2D arena context — battles now involve spatial positioning, movement, and range, and the battle readiness explanation SHALL mention that robots will move, maintain distance, and fight within a 2D arena rather than standing in place
10. WHEN the 2D arena system is implemented, THE In_Game_Guide Combat System section (Requirement 6 in the in-game-guide spec) SHALL include articles explaining positioning mechanics, range bands (melee/short/mid/long), movement and Movement_Speed, Backstab mechanics (1v1 angle-based +10%), and Flanking mechanics (team 2v2+ multi-attacker +20%)
11. WHEN the 2D arena system is implemented, THE In_Game_Guide Weapons and Loadouts section (Requirement 7 in the in-game-guide spec) SHALL include articles explaining weapon range bands, Optimal_Range per weapon category, Range_Penalty mechanics, and how weapon choice affects positioning strategy in the 2D arena

### Requirement 16: Extensibility for Future Game Modes

**User Story:** As a developer, I want the arena system architecture to support future game modes (battle royale, king of the hill) without requiring structural changes, so that new modes can be added incrementally.

#### Acceptance Criteria

1. THE Combat_Simulator SHALL separate arena configuration (dimensions, boundaries, spawn points) from combat logic, allowing different arena shapes and sizes per game mode
2. THE Combat_Simulator SHALL separate win condition evaluation from the main combat loop, allowing different victory conditions (last standing, zone control, point accumulation) to be plugged in
3. THE Combat_Simulator SHALL support dynamic robot entry and exit during battle (robots can be eliminated without ending the battle for remaining participants)
4. THE Combat_Simulator SHALL support arena zones (regions with special properties such as damage amplification, healing, or control points) through an optional zone configuration parameter
5. THE Combat_Simulator SHALL support a pluggable Target_Priority strategy, so that different game modes can override the default threatAnalysis-based targeting. For zone control modes (king of the hill), the strategy SHALL factor in: (a) opponents currently contesting the zone, (b) opponents closest to entering the zone, and (c) the standard Threat_Score, with zone-related factors weighted higher than pure combat threat
6. THE Combat_Simulator SHALL support a pluggable Movement_Intent modifier, so that zone control modes can bias movement toward the control zone when no immediate combat threat exists, with the bias strength influenced by the robot's threatAnalysis (higher = better zone awareness) and combatAlgorithms (higher = smarter zone entry timing)
7. IF no game mode configuration is provided, THEN THE Combat_Simulator SHALL default to the standard elimination mode (last team standing wins)

### Requirement 17: 2D Battle Playback Viewer

**User Story:** As a player, I want to watch a visual replay of my battle on a 2D arena view showing robot positions, movement, and attacks in real time, so that I can see how the fight played out spatially — similar to a Football Manager match engine.

#### Acceptance Criteria

1. THE Frontend SHALL render a 2D top-down arena view using an HTML5 Canvas element, displaying the circular arena boundary at the radius specified in the CombatResult
2. THE Battle_Playback_Viewer SHALL render each robot as a distinct icon or sprite on the arena, using team colors to differentiate sides, with the robot's name displayed adjacent to its icon
3. THE Battle_Playback_Viewer SHALL animate robot positions by interpolating between CombatEvent position snapshots, producing smooth continuous movement across the arena
4. WHEN an attack event occurs during playback, THE Battle_Playback_Viewer SHALL display a visual indicator between attacker and target (projectile line for ranged, melee arc for melee) with color coding for hit (green), miss (gray), critical (orange), and malfunction (red)
5. WHEN a Backstab or Flanking attack occurs during playback, THE Battle_Playback_Viewer SHALL highlight the positioning advantage with a directional indicator showing the attack angle relative to the defender's Facing_Direction
6. THE Battle_Playback_Viewer SHALL display a synchronized combat log panel alongside the arena view, scrolling to the current event during playback and highlighting the active event
7. THE Battle_Playback_Viewer SHALL provide playback controls: play, pause, speed (0.5×, 1×, 2×, 4×), skip to next event, and a timeline scrubber showing the full battle duration with event markers
8. THE Battle_Playback_Viewer SHALL display real-time HP and shield bars for each robot overlaid on or adjacent to their arena icon, updating as damage is applied during playback
9. THE Battle_Playback_Viewer SHALL display the current Range_Band between the focused robot pair (melee/short/mid/long) as a visual indicator or label that updates as robots move
10. WHEN a range transition event occurs during playback, THE Battle_Playback_Viewer SHALL briefly highlight the range band change with a visual pulse or text notification on the arena
11. THE Battle_Playback_Viewer SHALL be accessible from the Battle Results page and the Battle History page, loading the CombatResult data (including position events) for the selected battle
12. THE Battle_Playback_Viewer SHALL gracefully degrade for battles without position data (pre-2D arena battles) by displaying the existing text-based combat log without the arena view
13. THE Battle_Playback_Viewer SHALL be responsive, scaling the arena canvas to fit the available viewport width while maintaining aspect ratio, with a minimum readable size of 300×300 pixels on mobile devices

### Requirement 18: Weapon Shop Range Filter

**User Story:** As a player, I want to filter weapons in the weapon shop by their effective range band, so that I can easily find weapons that match my positioning strategy.

#### Acceptance Criteria

1. THE Weapon_Shop SHALL display an Optimal_Range label for each weapon (melee, short, mid, or long) based on the weapon category assignment defined in Requirement 3
2. THE Weapon_Shop SHALL provide a range filter with options: All, Melee, Short, Mid, Long, allowing players to filter the weapon catalog by Optimal_Range
3. THE Weapon_Shop SHALL allow the range filter to be combined with existing filters (weapon category, owned weapons) using AND logic
4. THE Robot_Detail_Page weapon selection modal SHALL also display the Optimal_Range label for each weapon, helping players choose weapons that complement their loadout's positioning strategy

### Requirement 19: Range-Aware Counter-Attacks

**User Story:** As a player, I want counter-attacks to respect weapon range so that a melee robot can't counter-swing a sniper from across the arena, while melee counters become devastating up close.

#### Acceptance Criteria

1. WHEN a counter-attack is triggered, THE Combat_Simulator SHALL check whether the counter-attacking robot's main weapon can reach the attacker at the current Distance. IF the main weapon is a melee weapon and the Distance exceeds the melee Range_Band maximum (2 units), THE Combat_Simulator SHALL block the counter-attack and log a "counter out of range" event
2. WHEN a counter-attack is triggered and the counter-attacking robot has a ranged main weapon, THE Combat_Simulator SHALL allow the counter-attack at any Distance within the weapon's Optimal_Range at full effectiveness, and apply the standard Range_Penalty (0.75× one band away, 0.5× two bands away) if the Distance falls outside the Optimal_Range
3. WHEN a counter-attack is triggered and the counter-attacking robot has a mixed dual-wield loadout (melee main + ranged offhand), THE Combat_Simulator SHALL attempt the counter with the main weapon first; IF the main weapon is out of range, THE Combat_Simulator SHALL fall back to the offhand weapon at 50% of the offhand's counter damage (combining the existing 70% counter multiplier with the offhand penalty)
4. WHEN a counter-attack lands within the melee Range_Band, THE Combat_Simulator SHALL apply the Hydraulic_Bonus (Requirement 4) to the counter damage, making melee counters at close range significantly more powerful than ranged counters
5. THE Combat_Simulator SHALL include the counter-attack range check, the weapon used for the counter, and any Range_Penalty or Hydraulic_Bonus in the counter-attack formula breakdown
6. WHEN a counter-attack is blocked due to range, THE Combat_Simulator SHALL emit a "counter out of range" event describing the failed counter attempt, the weapon that couldn't reach, and the current Distance
