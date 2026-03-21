# Requirements Document

## Introduction

King of the Hill (KotH) is a zone-control game mode for Armoured Souls that builds on the 2D Combat Arena system. Instead of pure elimination, robots compete to accumulate points by occupying a central control zone. Victory is determined by point accumulation — combat is the tool for contesting the zone, not the end goal.

Phase 1 (this spec) delivers free-for-all KotH with 5–6 robots per match, supporting both fixed center zone and rotating zone variants. Future phases will add team-based KotH (2v2, 3v3 with shared team scoring). This phased approach keeps the initial scope focused on the core zone-control loop while the extensibility architecture supports future formats without structural changes.

This mode plugs into the 2D arena's extensibility architecture (Requirement 16): the `TargetPriorityStrategy` for zone-aware targeting, `MovementIntentModifier` for zone-biased movement, `WinConditionEvaluator` for point-based victory, `ArenaZone` for the control point, and `GameModeConfig`/`GameModeState` for mode configuration. No structural changes to the combat engine are required.

Destruction and yield are permanent within a KotH match — once a robot is out, it stays out for the remainder of the match. This mirrors the real-world robot combat model where league and tournament battles end participation upon destruction or yield. Post-match repair costs are handled by the existing repair cost system (base cost = sum of 23 attributes × 100, damage multiplier 2.0× if HP=0, Repair Bay discount applies).

KotH shifts the attribute meta compared to standard 1v1 league battles. servoMotors (zone racing), threatAnalysis (zone awareness), combatAlgorithms (zone entry timing), hullIntegrity (sustained multi-opponent combat), and armorPlating (absorbing hits from multiple contesters) all increase in value. The mode creates a distinct strategic identity where spatial control matters more than raw damage output.

KotH matchmaking is open to all robots with no league or facility prerequisites — any robot with equipped weapons can participate. Robots are distributed into balanced groups where each group's total ELO is as equal as possible, forming groups of 6 first with any remainder forming a group of 5. This maximizes participation and ensures fair matches based on overall group strength.

KotH operates as a scheduled event within the existing cycle system, with KotH execution integrated into the existing battle orchestrator (`battleOrchestrator.ts`), its own matchmaking service (`kothMatchmakingService.ts`), and cron schedule integrated into `cycleScheduler.ts`.

## Glossary

- **KotH_Engine**: The King of the Hill game mode engine that implements the pluggable strategy interfaces from the 2D Combat Arena's extensibility layer (Requirement 16). Responsible for zone scoring, zone-aware targeting, zone-biased movement, and point-based win condition evaluation
- **KotH_Battle_Orchestrator**: The KotH execution path within the extended `battleOrchestrator.ts` that queries scheduled KotH matches from the database, executes them using the Combat_Simulator with KotH GameModeConfig, tracks results, and returns a summary. Extends the existing league orchestrator with mode-specific branching rather than duplicating shared plumbing into a separate file
- **KotH_Matchmaking_Service**: The service (`kothMatchmakingService.ts`) that groups all eligible robots into ELO-balanced groups of 6 (or 5 for remainders) and creates scheduled KotH match records. Follows the same pattern as `matchmakingService.ts` and `tagTeamMatchmakingService.ts`
- **Control_Zone**: A circular `ArenaZone` of type `control_point` positioned within the arena where robots accumulate points by occupying it. Defined by a center `Position` and a radius in grid units
- **Zone_Occupation**: The state of a robot being physically inside the Control_Zone (distance from robot Position to Control_Zone center is less than or equal to Control_Zone radius)
- **Contested_State**: The condition where two or more individual robots simultaneously occupy the Control_Zone, preventing point accumulation
- **Uncontested_State**: The condition where only a single robot occupies the Control_Zone, enabling point accumulation
- **Zone_Score**: The cumulative point total tracked per team (team mode) or per robot (free-for-all) in the `GameModeState.zoneScores` map
- **Score_Threshold**: The point total required to win the match. First team or robot to reach the Score_Threshold wins
- **Time_Limit**: The maximum match duration in seconds. If no team or robot reaches the Score_Threshold before the Time_Limit, the highest Zone_Score wins
- **Kill_Bonus**: A small point reward granted when a robot destroys an opponent, equivalent to a fixed number of seconds of uncontested zone occupation
- **Zone_Awareness**: A robot's ability to detect and prioritize the Control_Zone in its decision-making, derived from the threatAnalysis attribute
- **Zone_Entry_Timing**: A robot's ability to choose optimal moments to enter the Control_Zone (e.g., waiting for two opponents to weaken each other), derived from the combatAlgorithms attribute
- **Permanent_Elimination**: The state where a robot is destroyed (HP=0) or yields during a KotH match and is removed from the match for its remainder. No respawning occurs — this is consistent with how league and tournament battles handle destruction and yield
- **Rotating_Zone**: A variant where the Control_Zone moves to a new position within the arena at fixed intervals, forcing repositioning
- **Zone_Transition_Period**: The brief window during which the Control_Zone is moving from one position to another in the Rotating_Zone variant, during which no points are scored
- **Match_Format**: The configuration specifying the match structure. Phase 1: free-for-all with 5–6 individual robots, with fixed zone or rotating zone variant. Future phases: team-based (2v2 or 3v3 with shared team score)
- **Combat_Simulator**: The backend service that executes time-based battle simulation, as defined in the 2D Combat Arena spec
- **Cycle_Scheduler**: The cron-based scheduling system (`cycleScheduler.ts`) that orchestrates daily game cycles including league, tournament, tag team, and settlement jobs

## Requirements

### Requirement 1: Control Zone Definition and Arena Layout

**User Story:** As a player, I want a clearly defined control zone in the arena, so that I know exactly where to position my robot to score points.

#### Acceptance Criteria

1. THE KotH_Engine SHALL create a Control_Zone as an `ArenaZone` with `effect: 'control_point'`, positioned at the arena center `{x: 0, y: 0}` with a default radius of 5 grid units
2. THE KotH_Engine SHALL use a fixed arena radius of 24 grid units for all KotH matches (5–6 robots, free-for-all)
3. WHEN a KotH match begins, THE KotH_Engine SHALL distribute robots evenly around the arena perimeter using equal angular spacing (60° apart for 6 robots, 72° apart for 5 robots), each offset from the center by (arena radius − 2) units, placing all robots equidistant from the Control_Zone
4. THE KotH_Engine SHALL pass the Control_Zone in the `GameModeConfig.arenaZones` array so the Combat_Simulator includes it in the `ArenaConfig`
5. THE KotH_Engine SHALL accept an optional Control_Zone radius override in the match configuration, constrained between 3 and 8 grid units
6. THE KotH_Engine SHALL emit a `zone_defined` event at match start containing the Control_Zone center, radius, and arena dimensions

### Requirement 2: Zone Occupation Detection

**User Story:** As a player, I want the game to accurately track which robots are inside the control zone, so that scoring is fair and transparent.

#### Acceptance Criteria

1. THE KotH_Engine SHALL evaluate Zone_Occupation for every robot every Simulation_Step (0.1 seconds) by calculating the Euclidean distance from the robot's Position to the Control_Zone center
2. WHEN a robot's distance to the Control_Zone center is less than or equal to the Control_Zone radius, THE KotH_Engine SHALL classify that robot as occupying the zone
3. WHEN a robot enters the Control_Zone (transitions from outside to inside), THE KotH_Engine SHALL emit a `zone_enter` event with the robot's identity and timestamp
4. WHEN a robot exits the Control_Zone (transitions from inside to outside), THE KotH_Engine SHALL emit a `zone_exit` event with the robot's identity and timestamp
5. THE KotH_Engine SHALL track the set of robots currently inside the Control_Zone in the `GameModeState.customData` as `zoneOccupants`
6. THE KotH_Engine SHALL include zone occupation status for each robot in position update events

### Requirement 3: Scoring System

**User Story:** As a player, I want to earn points by holding the control zone without opposition, so that zone control is the primary path to victory.

#### Acceptance Criteria

1. WHILE the Control_Zone is in Uncontested_State (only one robot occupies it), THE KotH_Engine SHALL award 1 point per second to the occupying robot, accumulated in 0.1-point increments per Simulation_Step
2. WHILE the Control_Zone is in Contested_State (two or more robots occupy it), THE KotH_Engine SHALL award zero points to all occupants
3. WHILE the Control_Zone is empty (no robots inside), THE KotH_Engine SHALL award zero points
4. WHEN a robot destroys an opponent, THE KotH_Engine SHALL award a Kill_Bonus of 5 points to the destroying robot's Zone_Score
5. THE KotH_Engine SHALL track Zone_Score per robot in `GameModeState.zoneScores`
6. THE KotH_Engine SHALL emit a `score_tick` event every 1 second of game time containing the current Zone_Score for all participants and the current zone state (uncontested, contested, or empty)
7. THE KotH_Engine SHALL emit a `kill_bonus` event when a Kill_Bonus is awarded, containing the scoring robot, the destroyed robot, and the bonus amount

### Requirement 4: Win Condition

**User Story:** As a player, I want clear victory conditions so that I know what I need to achieve to win the match.

#### Acceptance Criteria

1. THE KotH_Engine SHALL implement the `WinConditionEvaluator` interface to check for victory each Simulation_Step
2. WHEN a robot's Zone_Score reaches the Score_Threshold, THE KotH_Engine SHALL end the match and declare that robot the winner
3. THE KotH_Engine SHALL use a default Score_Threshold of 30 points (equivalent to 30 seconds of uncontested zone control, or approximately 15 seconds of control plus 3 kills via Kill_Bonus)
4. WHEN the match Time_Limit is reached without any participant reaching the Score_Threshold, THE KotH_Engine SHALL declare the participant with the highest Zone_Score as the winner
5. IF two or more participants have equal Zone_Score when the Time_Limit is reached, THEN THE KotH_Engine SHALL break the tie by total time spent in Zone_Occupation (higher wins), then by total damage dealt (higher wins)
6. THE KotH_Engine SHALL use a default Time_Limit of 150 seconds (2.5 minutes) — calibrated against the average 1v1 match duration of ~22 seconds on ACC; a 6-robot KotH with zone contestation, multi-opponent combat, and permanent elimination should naturally resolve within 90–120 seconds, with the 150-second cap as a hard backstop
7. THE KotH_Engine SHALL accept optional overrides for Score_Threshold and Time_Limit in the match configuration, constrained by the validation ranges in Requirement 11 AC 4
8. WHEN all robots except one are permanently eliminated (destroyed or yielded), THE KotH_Engine SHALL enter a "last standing" phase: the surviving robot receives 10 seconds of uncontested scoring time (accumulating points if inside the Control_Zone), or until the Time_Limit is reached — whichever comes first. After the window expires, the match ends and the robot with the highest Zone_Score wins — which may or may not be the last surviving robot
9. IF the last surviving robot does not enter the Control_Zone during the 10-second last-standing window, THE KotH_Engine SHALL end the match after the window expires and declare the robot with the highest Zone_Score as the winner, even if that robot was eliminated earlier
10. THE KotH_Engine SHALL emit a `last_standing` event when only one robot remains, containing the surviving robot's identity, current Zone_Score, the leading Zone_Score, and the 10-second countdown
11. WHEN the match ends, THE KotH_Engine SHALL emit a `match_end` event containing the winner, final Zone_Scores for all participants, final placement order for all participants, match duration, and the win reason (score threshold reached, time limit with score lead, tiebreaker, or last standing)
12. THE KotH_Engine SHALL determine final placement order based on: (a) all robots (surviving and eliminated) ranked by Zone_Score descending, then (b) ties broken by total time spent in Zone_Occupation (higher wins), then by total damage dealt (higher wins)

### Requirement 5: Zone-Aware Target Priority Strategy

**User Story:** As a player, I want my robot to intelligently prioritize targets based on zone control context, so that high threatAnalysis robots make smart decisions about who to fight.

#### Acceptance Criteria

1. THE KotH_Engine SHALL implement the `TargetPriorityStrategy` interface with zone-aware target selection
2. WHEN selecting targets, THE KotH_Engine SHALL assign priority weights: zone contesters (robots currently inside the Control_Zone) receive 3.0× weight, zone approachers (robots moving toward the Control_Zone with Movement_Intent targeting a position inside the zone) receive 2.0× weight, and all other robots receive 1.0× base weight multiplied by their standard Threat_Score
3. WHEN the robot is inside the Control_Zone in Uncontested_State, THE KotH_Engine SHALL prioritize zone approachers over distant non-approaching robots, representing defensive zone holding
4. WHEN the Control_Zone is in Contested_State and the robot is inside the zone, THE KotH_Engine SHALL prioritize the contester with the lowest current HP for fastest elimination
5. WHEN the robot is outside the Control_Zone, THE KotH_Engine SHALL apply zone-approach bias: robots moving toward the Control_Zone receive 1.5× priority weight (they're about to become zone threats), while robots outside the zone and not approaching it retain standard 1.0× base weight. This biases the robot toward intercepting zone approachers without preventing it from engaging nearby non-approaching opponents when tactically advantageous
6. THE KotH_Engine SHALL scale the zone-aware priority weights by the robot's threatAnalysis attribute: at threatAnalysis below 10, zone priority weights are reduced to 50% effectiveness (the robot partially ignores zone context); at threatAnalysis 10–30, weights scale linearly from 50% to 100%; at threatAnalysis above 30, full zone-aware targeting applies
7. THE KotH_Engine SHALL include zone targeting context (contester, approacher, or standard) in the target selection formula breakdown

### Requirement 6: Zone-Biased Movement Intent

**User Story:** As a player, I want my robot to naturally gravitate toward the control zone when not in immediate combat, so that high combatAlgorithms robots position themselves strategically.

#### Acceptance Criteria

1. THE KotH_Engine SHALL implement the `MovementIntentModifier` interface to bias movement toward the Control_Zone
2. WHEN no opponent is within 6 grid units of the robot, THE KotH_Engine SHALL override the base Movement_Intent to target the Control_Zone center, with bias strength scaled by threatAnalysis: at threatAnalysis 1 the robot moves toward the zone at 30% directional weight, at threatAnalysis 50 the robot moves toward the zone at 100% directional weight
3. WHEN the robot is inside the Control_Zone in Uncontested_State and no opponent is within 8 grid units, THE KotH_Engine SHALL set Movement_Intent to hold position near the zone center rather than chasing distant opponents
4. WHEN the robot's combatAlgorithms attribute exceeds 25 and the Control_Zone is in Contested_State between two other robots, THE KotH_Engine SHALL apply a wait-and-enter bias: the robot holds position just outside the Control_Zone (within 2 grid units of the zone edge) until one contester is eliminated or drops below 30% HP, then enters the zone
5. THE KotH_Engine SHALL NOT override Movement_Intent when the robot is actively engaged in combat (opponent within 4 grid units and attacking), preserving the base combat AI movement logic
6. THE KotH_Engine SHALL include zone movement bias data (bias strength, zone distance, override active) in the movement decision formula breakdown

### Requirement 7: Yield Threshold and Permanent Elimination

**User Story:** As a player, I want my robot's yield threshold to work meaningfully in KotH, so that yielding is a strategic choice about preserving repair costs at the expense of leaving the match permanently.

#### Acceptance Criteria

1. WHEN a robot's HP drops below its configured yield threshold during a KotH match, THE KotH_Engine SHALL trigger a yield evaluation identical to the standard yield mechanic
2. WHEN a robot yields in a KotH match, THE KotH_Engine SHALL permanently remove the robot from the match for its remainder — the robot cannot return. This is consistent with how league and tournament battles handle yield
3. WHEN a robot yields, THE KotH_Engine SHALL NOT award a Kill_Bonus to any opponent, distinguishing voluntary yield from combat destruction
4. WHEN a robot is destroyed (HP reaches 0) in a KotH match, THE KotH_Engine SHALL permanently remove the robot from the match for its remainder and award a Kill_Bonus to the destroying robot. Destroyed robots do not respawn — this is a robot combat simulation, not a video game
5. WHEN a robot yields or is destroyed while inside the Control_Zone, THE KotH_Engine SHALL immediately remove the robot from zone occupation, potentially changing the zone from Contested_State to Uncontested_State for the remaining occupant
6. THE KotH_Engine SHALL record the robot's Zone_Score at the time of elimination for final placement calculation (Requirement 4, AC 11)
7. THE KotH_Engine SHALL emit a `robot_eliminated` event when a robot is destroyed or yields, containing the robot's identity, elimination reason (destroyed or yielded), Zone_Score at elimination, and timestamp

### Requirement 8: Rotating Zone Variant

**User Story:** As a player, I want a variant where the control zone moves periodically, so that the match stays dynamic and rewards adaptability over static defense.

#### Acceptance Criteria

1. WHERE the Rotating_Zone variant is enabled, THE KotH_Engine SHALL move the Control_Zone to a new random position every 30 seconds
2. WHEN the Control_Zone is about to move, THE KotH_Engine SHALL emit a `zone_moving` warning event 5 seconds before the transition, containing the new zone position
3. WHEN the Control_Zone transitions, THE KotH_Engine SHALL enter a Zone_Transition_Period of 3 seconds during which the zone is inactive (no scoring, no occupation tracking)
4. WHEN the Zone_Transition_Period ends, THE KotH_Engine SHALL activate the new Control_Zone position and emit a `zone_active` event
5. THE KotH_Engine SHALL constrain new zone positions to be at least 6 grid units from the arena boundary and at least 8 grid units from the previous zone position, preventing trivial repositioning
6. THE KotH_Engine SHALL generate the new zone position using a deterministic seed derived from the match ID and transition count, ensuring replay consistency
7. WHERE the Rotating_Zone variant is enabled, THE KotH_Engine SHALL increase the default Score_Threshold to 45 points and the default Time_Limit to 210 seconds (3.5 minutes) to account for scoring downtime during transitions

### Requirement 9: Attribute Value Shifts for KotH

**User Story:** As a player, I want the KotH mode to reward different attribute investments than standard 1v1 battles, so that I need to think about my robot's build differently for zone control.

#### Acceptance Criteria

1. THE KotH_Engine SHALL NOT modify any base attribute formulas from the 2D Combat Arena — all attribute value shifts emerge naturally from the zone control mechanics and the pluggable strategy implementations
2. WHEN calculating Movement_Intent in KotH, THE KotH_Engine SHALL cause servoMotors to have increased effective value because faster robots reach the Control_Zone sooner and reposition faster when the zone rotates
3. WHEN calculating zone-aware Target_Priority, THE KotH_Engine SHALL cause threatAnalysis to have increased effective value because higher threatAnalysis produces stronger zone-aware targeting weights (Requirement 5, AC 6)
4. WHEN calculating zone-biased Movement_Intent, THE KotH_Engine SHALL cause combatAlgorithms to have increased effective value because higher combatAlgorithms enables the wait-and-enter tactic (Requirement 6, AC 4) and smarter zone entry timing
5. THE KotH_Engine SHALL cause hullIntegrity and armorPlating to have increased effective value because robots must survive sustained combat from multiple opponents inside the Control_Zone, where fights are concentrated, and because permanent elimination makes survivability critical

### Requirement 10: The Sniper Problem — Anti-Passive Mechanics

**User Story:** As a player, I want the game to discourage passive sniping from outside the zone, so that robots must engage with the zone to win.

#### Acceptance Criteria

1. THE KotH_Engine SHALL rely on the natural counter that snipers cannot score points without entering the Control_Zone, making passive sniping a losing strategy against any robot that holds the zone
2. THE KotH_Engine SHALL rely on the 2D arena's existing Servo_Strain mechanic to prevent indefinite kiting around the zone perimeter
3. THE KotH_Engine SHALL rely on the 2D arena's existing Adaptation_Bonus mechanic to give zone fighters a cumulative combat advantage from absorbing damage while contesting
4. WHEN a robot has not entered the Control_Zone for 30 consecutive seconds, THE KotH_Engine SHALL apply a passive penalty: 3% damage reduction per additional 5 seconds spent outside the zone, capped at 30% reduction, representing loss of combat focus. The penalty is stronger than in a respawn model because permanent elimination makes sniper strategies more oppressive — a sniper can permanently remove zone fighters without risk
5. WHEN a robot with the passive penalty enters the Control_Zone, THE KotH_Engine SHALL remove the passive penalty over 3 seconds (decaying linearly)
6. THE KotH_Engine SHALL emit a `passive_warning` event when a robot reaches 20 seconds without entering the Control_Zone, and a `passive_penalty` event when the penalty activates at 30 seconds
7. WHEN a robot has not entered the Control_Zone for 60 consecutive seconds, THE KotH_Engine SHALL apply an additional accuracy penalty of 15% to all attacks, stacking with the damage reduction penalty, making prolonged passive play increasingly ineffective
8. THE KotH_Engine SHALL track each robot's consecutive time outside the Control_Zone in `GameModeState.customData` as `passiveTimers`, resetting to 0 when the robot enters the zone

### Requirement 11: Match Configuration and Game Mode Integration

**User Story:** As a developer, I want KotH to integrate cleanly with the existing battle system through the GameModeConfig interface, so that matches can be configured and launched without modifying the core combat engine.

#### Acceptance Criteria

1. THE KotH_Engine SHALL produce a complete `GameModeConfig` object containing the KotH-specific `TargetPriorityStrategy`, `MovementIntentModifier`, `WinConditionEvaluator`, and `ArenaZone` configuration
2. THE KotH_Engine SHALL initialize a `GameModeState` with `mode: 'zone_control'`, `zoneScores` initialized to 0 for each participant, and `customData` containing zone occupant tracking, elimination state, and passive penalty timers
3. THE KotH_Engine SHALL accept a match configuration specifying: Score_Threshold override, Time_Limit override, Control_Zone radius override, and Rotating_Zone enabled flag
4. THE KotH_Engine SHALL validate match configuration: minimum 5 robots, maximum 6 robots (target 6, minimum 5 as matchmaking fallback), Score_Threshold between 15 and 90, Time_Limit between 60 and 300 seconds
5. IF an invalid match configuration is provided, THEN THE KotH_Engine SHALL return a descriptive validation error listing all invalid fields and their constraints
6. THE KotH_Engine SHALL override `GameModeConfig.maxDuration` with the KotH Time_Limit, replacing the standard `MAX_BATTLE_DURATION`
7. THE KotH_Engine SHALL target 6 robots per match (minimum 5) for the following reasons: (a) zone contestation dynamics — with 5–6 robots around a radius-5 zone in a radius-24 arena, 2–3 robots fight in or near the zone at any time while others reposition, creating natural pacing; (b) permanent elimination creates a compelling arc from chaotic opening to tense 2–3 way endgame; (c) matchmaking feasibility — distributing all eligible robots into ELO-balanced groups of 6 is straightforward even in smaller environments; (d) performance — 15 pairwise distance calculations per tick (6 robots) is comfortable on the DEV1-S (2 vCPU, 2GB RAM); (e) 8+ robots makes the zone permanently contested (nobody scores) and 4 or fewer robots ends too quickly after one early kill

### Requirement 12: KotH Match Result and Events

**User Story:** As a player, I want detailed match results showing zone control statistics, so that I can understand how the match played out and improve my strategy.

#### Acceptance Criteria

1. WHEN a KotH match ends, THE KotH_Engine SHALL produce a `CombatResult` containing all standard fields plus KotH-specific metadata in the arena metadata fields
2. THE KotH_Engine SHALL include in the match result: final Zone_Scores for all participants, final placement order, total zone occupation time per robot, total uncontested occupation time per robot, total contested time, number of zone entries and exits per robot, kill count and Kill_Bonus points per robot, elimination status per robot (survived, destroyed, or yielded), and match duration
3. THE KotH_Engine SHALL include zone state in position update events: the current zone state (uncontested by whom, contested, or empty) and the set of robots currently inside the zone
4. THE KotH_Engine SHALL produce CombatEvents compatible with the existing event schema, using the optional position fields and adding KotH-specific event types: `zone_enter`, `zone_exit`, `score_tick`, `kill_bonus`, `zone_moving`, `zone_active`, `robot_eliminated`, `passive_warning`, `passive_penalty`, and `match_end`
5. THE KotH_Engine SHALL include a `formulaBreakdown` on zone-aware targeting and movement events showing the zone priority weights, threatAnalysis scaling, and combatAlgorithms influence
6. THE KotH_Engine SHALL define combat message templates for all KotH-specific events, following the existing message template pattern in `COMBAT_MESSAGES.md`. Required message categories: (a) zone_enter — "{robotName} enters the control zone" with variants for contested/uncontested entry, (b) zone_exit — "{robotName} leaves the control zone" with variants for voluntary exit vs forced exit by damage, (c) score_tick — periodic scoring narration such as "{robotName} holds the zone unopposed" or "The zone is contested — no points awarded", (d) kill_bonus — "{robotName} eliminates {opponentName} and earns a kill bonus of 5 points", (e) robot_eliminated — "{robotName} is destroyed/yields and is permanently eliminated" with placement info, (f) passive_warning — "{robotName} hasn't entered the zone in 20 seconds — combat focus fading", (g) passive_penalty — "{robotName} suffers a passive penalty — damage reduced by {x}%" and accuracy penalty variant at 60s, (h) zone_moving — "The control zone is relocating in 5 seconds" with new position, (i) zone_active — "The control zone has moved to a new position", (j) last_standing — "{robotName} is the last robot standing — 10 seconds to score", (k) match_end — winner declaration with win reason and final scores
7. THE KotH_Engine SHALL provide at least 3 message variants per event category to avoid repetitive narration during playback, consistent with the existing combat message variety in `COMBAT_MESSAGES.md`

### Requirement 13: KotH Battle Playback Integration

**User Story:** As a player, I want to watch KotH matches in the Battle Playback Viewer with zone visualization, so that I can see how zone control played out spatially.

#### Acceptance Criteria

1. THE Battle_Playback_Viewer SHALL render the Control_Zone as a translucent circular overlay on the arena canvas, using a distinct color (e.g., gold/amber) that does not conflict with team colors
2. WHEN the Control_Zone is in Uncontested_State during playback, THE Battle_Playback_Viewer SHALL tint the zone overlay with the controlling team's or robot's color
3. WHEN the Control_Zone is in Contested_State during playback, THE Battle_Playback_Viewer SHALL display the zone overlay with a pulsing red tint indicating active contestation
4. THE Battle_Playback_Viewer SHALL display a scoreboard panel showing real-time Zone_Scores for all participants, updated as `score_tick` events are processed during playback
5. WHEN a `zone_moving` event occurs during playback in the Rotating_Zone variant, THE Battle_Playback_Viewer SHALL animate the zone transition by fading out the current zone and fading in the new zone at the target position
6. WHEN a `robot_eliminated` event occurs during playback, THE Battle_Playback_Viewer SHALL visually indicate the robot's removal from the arena with an elimination animation and gray out the robot's entry in the scoreboard
7. THE Battle_Playback_Viewer SHALL display zone occupation indicators on each robot's icon (e.g., a small zone symbol) when the robot is inside the Control_Zone
8. THE Battle_Playback_Viewer SHALL assign each of the 5–6 participating robots a distinct color from a fixed 6-color palette: blue (#3B82F6), red (#EF4444), green (#22C55E), orange (#F97316), purple (#A855F7), and cyan (#06B6D4). These colors SHALL be used consistently across the arena canvas, scoreboard, and all UI elements referencing a specific robot during playback. The existing blue/red 1v1 color scheme is insufficient for 6-robot matches

### Requirement 14: Rewards and Progression

**User Story:** As a player, I want to earn meaningful rewards from KotH matches based on my final placement, so that playing the mode contributes to my overall progression and feels like a real competitive event.

#### Acceptance Criteria

1. WHEN a KotH match ends, THE KotH_Engine SHALL award credits based on final placement using a tiered reward system: 1st place receives ₡25,000, 2nd place receives ₡17,500, 3rd place receives ₡10,000, and 4th–6th place receive ₡5,000 participation reward. Total payout per 6-robot match is ₡67,500. These values are calibrated to provide meaningful but moderate rewards that complement league earnings. For 5-robot matches, 4th–5th receive the same ₡5,000 participation reward
2. THE KotH_Engine SHALL award a zone dominance bonus of +25% to credit, fame, and prestige rewards when the winner accumulated more than 75% of their points from uncontested zone control (as opposed to Kill_Bonus points)
3. THE KotH_Engine SHALL award fame based on final placement: 1st place receives base fame of 8, 2nd place receives base fame of 5, 3rd place receives base fame of 3. The winner's fame is further modified by the existing performance multiplier system (Perfect Victory at 100% HP = 2.0×, Dominating at >80% = 1.5×, Comeback at <20% = 1.25×, Standard = 1.0×). KotH fame values are independent of league tier, making KotH a viable fame progression path for players who specialize in zone-control battles
4. THE KotH_Engine SHALL award prestige based on final placement using flat values independent of league tier: 1st place receives +15 prestige, 2nd place receives +8 prestige, 3rd place receives +3 prestige, 4th–6th receive no prestige. These values are league-independent so that players who specialize in KotH can progress through prestige milestones and unlock facilities without relying on league performance
5. THE KotH_Engine SHALL NOT modify any robot's ELO rating as a result of KotH matches. ELO remains a pure 1v1 metric — multi-robot free-for-all matches do not map cleanly to traditional winner/loser ELO calculations, and KotH uses ELO only for matchmaking group balancing
6. WHEN a robot is destroyed (HP=0) during the match, THE KotH_Engine SHALL apply standard repair costs using the existing repair cost formula (base cost = sum of 23 attributes × 100, damage multiplier 2.0× for HP=0) with Repair Bay facility discount
7. WHEN a robot yields during the match, THE KotH_Engine SHALL apply repair costs based on the robot's HP at the time of yield, using the existing repair cost formula with standard damage multiplier (1.5× if HP < 10%, else 1.0×) and Repair Bay facility discount
8. WHEN a robot survives the match without being eliminated, THE KotH_Engine SHALL apply repair costs based on the robot's HP at match end, using the existing repair cost formula
9. THE KotH_Battle_Orchestrator SHALL award standard streaming revenue to all participating robots in the KotH match, using the existing streaming revenue formula (`1000 × battle_multiplier × fame_multiplier × studio_multiplier`). KotH counts as a battle for streaming purposes, same as league, tournament, and tag team matches

### Requirement 15: Battle Orchestrator Extension for KotH

**User Story:** As a developer, I want the existing league battle orchestrator to be extended to handle KotH battles alongside league battles, so that we have a single unified orchestrator that can be expanded to support future battle types without duplicating shared plumbing.

#### Acceptance Criteria

1. THE existing `battleOrchestrator.ts` SHALL be extended to support multiple battle types, starting with the existing league battles and adding KotH battles. The shared pipeline (robot loading, battle record creation, stats updates, streaming revenue, audit logging) SHALL be reused across battle types, with mode-specific logic (reward calculation, ELO handling, participant count) branching based on battle type
2. THE battleOrchestrator SHALL export a new `executeScheduledKothBattles()` function that queries all scheduled KotH matches from the database with status `scheduled`, following the same pattern as the existing `executeScheduledBattles()` for league matches
3. WHEN executing a KotH match, THE battleOrchestrator SHALL load all participating robots (5–6) with their weapons, build the KotH `GameModeConfig` (including zone variant from the match record), pass them to the Combat_Simulator, and store the `CombatResult` in the Battle table with `battleType: 'koth'`
4. WHEN a KotH match completes, THE battleOrchestrator SHALL create BattleParticipant records for all 5–6 robots (not just 2), calculate and distribute placement-based rewards (credits, fame, prestige) according to Requirement 14, award streaming revenue to all participants, update robot stats (damage taken, kills), and log audit events per robot via the EventLogger
5. THE battleOrchestrator SHALL NOT modify any robot's ELO when processing KotH battles — the ELO fields in BattleParticipant records SHALL be set to the robot's current ELO with zero change
6. THE battleOrchestrator SHALL return a summary object containing: total KotH matches executed, total robots involved, match results with winners and placements, and any errors encountered
7. IF a KotH match fails during execution, THEN THE battleOrchestrator SHALL log the error, mark the match as `failed`, and continue processing remaining scheduled matches
8. THE battleOrchestrator refactoring SHALL NOT change the behavior of existing league battle processing — all existing league tests must continue to pass unchanged

### Requirement 16: KotH Matchmaking

**User Story:** As a developer, I want a dedicated KotH matchmaking service that distributes robots into ELO-balanced groups for fair multi-robot matches, so that KotH matches are competitively balanced.

#### Acceptance Criteria

1. THE KotH_Matchmaking_Service SHALL be implemented as `kothMatchmakingService.ts` following the same service pattern as `matchmakingService.ts` (league) and `tagTeamMatchmakingService.ts` (tag team)
2. THE KotH_Matchmaking_Service SHALL export a `runKothMatchmaking()` function that selects eligible robots and creates scheduled KotH match records
3. WHEN creating matches, THE KotH_Matchmaking_Service SHALL sort all eligible robots by ELO descending and distribute them into groups using a balanced distribution algorithm (e.g., snake draft or round-robin assignment) so that each group's total ELO is as equal as possible. Groups are filled to 6 robots first; if the total eligible count is not evenly divisible by 6, the remainder forms a group of 5. If fewer than 5 robots are eligible in total, THE KotH_Matchmaking_Service SHALL skip match creation and log "insufficient eligible robots"
4. THE KotH_Matchmaking_Service SHALL match robots from the entire eligible pool regardless of league tier. A Bronze robot at 1000 ELO and a Gold robot at 1020 ELO are valid opponents. No league tier restriction applies
5. THE KotH_Matchmaking_Service SHALL enforce a maximum of one robot per stable per KotH match — a player cannot have multiple robots in the same match. If enforcing this constraint makes balanced distribution impossible, THE KotH_Matchmaking_Service SHALL prioritize the one-per-stable rule over perfect ELO balance
6. THE KotH_Matchmaking_Service SHALL only select robots that pass the KotH entry prerequisites (Requirement 17)
7. THE KotH_Matchmaking_Service SHALL create scheduled match records with `matchType: 'koth'`, the selected Match_Format, and the list of participating robot IDs

### Requirement 17: KotH Entry Prerequisites

**User Story:** As a player, I want minimal entry requirements for KotH matches, so that any robot can participate in this game mode without grinding through league tiers first.

#### Acceptance Criteria

1. THE KotH_Matchmaking_Service SHALL require robots to pass the same weapon readiness check as league battles: all required weapons must be equipped for the robot's loadout type
2. THE KotH_Matchmaking_Service SHALL exclude robots that are already scheduled for a KotH match in the current cycle, preventing double-booking
3. THE KotH_Matchmaking_Service SHALL enforce the one-robot-per-stable-per-match rule (Requirement 16, AC 5) during matchmaking, not just as a soft deprioritization
4. IF a robot fails any prerequisite check, THEN THE KotH_Matchmaking_Service SHALL skip that robot and log the reason for exclusion

### Requirement 18: KotH Scheduling and Cycle Integration

**User Story:** As a developer, I want KotH to be scheduled as part of the game's cycle system with its own cron job, so that KotH matches run automatically alongside league, tournament, and tag team events.

#### Acceptance Criteria

1. THE Cycle_Scheduler SHALL add a `kothSchedule` field to the `SchedulerConfig` interface with a default cron expression of `0 16 * * 1,3,5` (4 PM UTC on Monday, Wednesday, Friday), running KotH as a special event 3 times per week rather than daily to maintain its prestige as a distinct competitive event. The 4 PM slot provides 4 hours of separation from the tag team cycle (12 PM) and 4 hours before the league cycle (8 PM), ensuring adequate repair time regardless of whether tag team executes battles (odd cycles) or repair-only (even cycles)
2. THE Cycle_Scheduler SHALL add a `koth` job to the `JobState` interface following the same structure as the existing league, tournament, tagTeam, and settlement jobs
3. WHEN the KotH cron job triggers, THE Cycle_Scheduler SHALL execute the following steps in order: (a) run `repairAllRobots()` for all users to ensure robots enter KotH at full HP, (b) call `executeScheduledKothBattles()` from the KotH_Battle_Orchestrator to execute all scheduled matches, (c) call `runKothMatchmaking()` from the KotH_Matchmaking_Service to schedule matches for the next KotH cycle. No post-battle repair step is needed — matchmaking is based on ELO, not HP, and the league cycle (8 PM) handles its own pre-battle repairs
4. THE Cycle_Scheduler SHALL integrate the KotH job into the existing `SchedulerState` tracking, including `runningJob`, `queue`, and job state history
5. THE Cycle_Scheduler SHALL ensure the KotH job does not overlap with other scheduled jobs (tournament at 8 AM, tag team at 12 PM, league at 8 PM, settlement at 11 PM) — the 4 PM slot provides 4 hours of separation from adjacent events
6. THE Cycle_Scheduler SHALL support manual KotH cycle triggering via the admin panel, following the same pattern as the existing manual cycle trigger for league battles
7. THE KotH_Matchmaking_Service SHALL determine the zone variant for each scheduled KotH event based on a recurring pattern: Monday and Friday use fixed center zone, Wednesday uses rotating zone. This gives players two standard KotH events and one rotating zone event per week, keeping the rotating variant feeling like a special mid-week challenge
8. THE KotH_Matchmaking_Service SHALL store the zone variant (`rotatingZone: true/false`) in the scheduled match record so the KotH_Battle_Orchestrator can build the correct `GameModeConfig` at execution time

### Requirement 19: Cross-System Documentation Updates

**User Story:** As a developer, I want all affected system documents and components to be updated when KotH is implemented, so that the codebase and documentation remain consistent.

#### Acceptance Criteria

1. WHEN the KotH system is implemented, THE KotH_Engine SHALL update `COMBAT_FORMULAS.md` with all new formulas: zone scoring formula (1 point/second uncontested), Kill_Bonus formula (5 points), passive penalty formula (3% damage reduction per 5 seconds after 30s outside zone, capped at 30%), accuracy penalty formula (15% after 60s outside zone), and zone dominance bonus formula (+25% rewards at >75% uncontested scoring)
2. WHEN the KotH system is implemented, THE KotH_Engine SHALL update `PRD_ROBOT_ATTRIBUTES.md` to document the KotH attribute value shifts: servoMotors (zone racing), threatAnalysis (zone awareness and targeting weight scaling), combatAlgorithms (wait-and-enter timing), hullIntegrity and armorPlating (multi-opponent survivability with permanent elimination), and formationTactics (team zone holding)
3. WHEN the KotH system is implemented, THE KotH_Engine SHALL update `COMBAT_MESSAGES.md` with new message templates for KotH-specific events: zone_enter, zone_exit, score_tick, kill_bonus, zone_moving, zone_active, robot_eliminated, passive_warning, passive_penalty, and match_end
4. WHEN the KotH system is implemented, THE KotH_Engine SHALL update `PRD_MATCHMAKING.md` with a new KotH matchmaking section documenting: ELO-balanced group distribution (groups of 6, remainder of 5), one-robot-per-stable enforcement, weapon readiness requirement, and no league tier restriction
5. WHEN the KotH system is implemented, THE KotH_Engine SHALL update `PRD_CYCLE_SYSTEM.md` with the KotH step in the cycle execution flow: cron schedule (`0 14 * * 1,3,5`), execution order (repair → execute KotH → repair → matchmake), and integration with SchedulerConfig
6. WHEN the KotH system is implemented, THE KotH_Engine SHALL update `PRD_ECONOMY_SYSTEM.md` with the KotH rewards section: tiered placement rewards (100%/50%/30%/15%), base reward scaling by participant count, zone dominance bonus, and repair cost handling for eliminated vs surviving robots
7. WHEN the KotH system is implemented, THE KotH_Engine SHALL update `PRD_PRESTIGE_AND_FAME.md` with KotH prestige awards (flat values: +15/+8/+3 for 1st/2nd/3rd) and KotH fame awards (base fame 8/5/3 for 1st/2nd/3rd with performance multipliers for 1st place)
8. WHEN the KotH system is implemented, THE KotH_Engine SHALL update `DATABASE_SCHEMA.md` with new KotH-related tables or fields: scheduled KotH match records (matchType 'koth', participant list, Match_Format), Battle table entries with battleType 'koth', KotH-specific result metadata, and cumulative KotH stats on the Robot model (Requirement 22). The existing `Battle` table has `robot1Id`/`robot2Id` columns hardcoded for 1v1 — KotH matches SHALL use the `BattleParticipant` table as the primary source of participant data (it already supports N participants with `battleId`, `robotId`, `team`, `role`, credits, ELO, and stats fields). For KotH battles, `Battle.robot1Id` SHALL be set to the 1st place robot and `Battle.robot2Id` to the 2nd place robot for backward compatibility with any code that reads these fields. A new `ScheduledKothMatch` table (or equivalent) SHALL be created to store scheduled KotH matches with a participant list, since the existing `ScheduledMatch` table is 1v1-specific (`robot1Id`/`robot2Id`)
9. WHEN the KotH system is implemented, THE KotH_Engine SHALL update `GAME_DESIGN.md` with the KotH game mode description: zone control concept, match formats (FFA/team/rotating), permanent elimination model, scoring mechanics, and strategic identity
10. WHEN the KotH system is implemented, THE KotH_Engine SHALL update `BATTLE_SIMULATION_ARCHITECTURE.md` with KotH integration details: how KotH plugs into the GameModeConfig extensibility layer, the extended battleOrchestrator pattern supporting multiple battle types, and the relationship between KotH_Engine and Combat_Simulator

### Requirement 20: In-Game Guide Content

**User Story:** As a player, I want comprehensive guide content explaining the King of the Hill game mode, so that I can understand the mechanics and develop effective strategies.

#### Acceptance Criteria

1. THE In_Game_Guide SHALL include a new "King of the Hill" section containing articles organized by topic: zone control basics, scoring mechanics, match formats, strategy tips, and anti-passive mechanics
2. THE In_Game_Guide KotH section SHALL include an article explaining zone control fundamentals: what the Control_Zone is, how Zone_Occupation works, the difference between Uncontested_State and Contested_State, and how points accumulate at 1 point per second of uncontested control
3. THE In_Game_Guide KotH section SHALL include an article explaining scoring and win conditions: Score_Threshold (default 30 points), Time_Limit (default 150 seconds), Kill_Bonus (5 points), tiebreaker rules, and the last-standing phase (10 seconds of uncontested scoring time for the final survivor)
4. THE In_Game_Guide KotH section SHALL include an article explaining match formats: free-for-all (5–6 robots), Rotating_Zone variant with zone movement every 30 seconds, and future team-based modes (2v2, 3v3)
5. THE In_Game_Guide KotH section SHALL include an article explaining KotH strategy: attribute builds optimized for zone control (servoMotors, threatAnalysis, combatAlgorithms, hullIntegrity, armorPlating), the importance of survivability given permanent elimination, and the wait-and-enter tactic for high combatAlgorithms robots
6. THE In_Game_Guide KotH section SHALL include an article explaining anti-passive mechanics: the passive damage penalty (3% per 5s after 30s outside zone), the accuracy penalty (15% after 60s), and why entering the zone is necessary to win
7. WHEN the KotH system is implemented, THE In_Game_Guide Combat System section SHALL be updated to mention KotH as an available game mode alongside league, tournament, and tag team battles
8. WHEN the KotH system is implemented, THE In_Game_Guide Weapons and Loadouts section SHALL be updated to explain how weapon range interacts with zone control — melee weapons excel inside the compact Control_Zone while ranged weapons are penalized by the zone's small radius forcing close-quarters combat
9. THE In_Game_Guide KotH section SHALL include an article explaining KotH entry requirements: weapon readiness (all required weapons equipped), one robot per stable per match, no league tier or facility prerequisites, and the 3-times-per-week schedule (Mon/Wed/Fri at 4 PM UTC)
10. THE In_Game_Guide KotH section SHALL include an article explaining KotH rewards: tiered credit rewards by placement (₡25K/₡17.5K/₡10K/₡5K), fame awards (8/5/3 base fame for top 3), prestige awards for top 3 (+15/+8/+3), zone dominance bonus (+25%), and repair costs for eliminated robots

### Requirement 21: KotH Standings Page

**User Story:** As a player, I want a dedicated KotH standings page that ranks robots by their cumulative KotH performance, so that I can see who's dominating the mode over time and track my own progress.

#### Acceptance Criteria

1. THE KotH_Standings_Page SHALL be accessible at route `/koth-standings` and linked from the main navigation under the Competitive category alongside League Standings
2. THE KotH_Standings_Page SHALL display a ranked table of all robots that have participated in at least one KotH match, sorted by KotH wins descending (primary), then by total KotH Zone_Score descending (secondary tiebreaker)
3. THE KotH_Standings_Page table SHALL include the following columns: Rank, Robot Name, Owner, KotH Wins, KotH Matches, Win Rate, Total Zone Score, Avg Zone Score per Match, Total Kills, and Best Placement Streak
4. THE KotH_Standings_Page SHALL highlight the current user's robots with the same blue highlight style used on the League Standings page
5. THE KotH_Standings_Page SHALL display top 3 ranks with medal colors (gold/silver/bronze) consistent with the League Standings page styling
6. THE KotH_Standings_Page SHALL support pagination for large robot lists, following the same pagination pattern as the League Standings page
7. THE backend SHALL expose a `GET /api/koth/standings` endpoint that returns the ranked robot list with cumulative KotH statistics, queried from the robot's tracked KotH stats fields (Requirement 22)
8. THE KotH_Standings_Page SHALL include a summary header showing total KotH events held, total unique participants, and the current #1 ranked robot
9. THE KotH_Standings_Page SHALL be responsive, using the same grid/table patterns as the League Standings page (full table on desktop, condensed card view on mobile)
10. THE KotH_Standings_Page SHALL include a filter toggle to switch between "All Time" and "Last 10 Events" views, allowing players to see both cumulative dominance and recent form

### Requirement 22: KotH Cumulative Statistics Tracking

**User Story:** As a developer, I want cumulative KotH performance stats tracked per robot, so that the KotH standings page and Hall of Records can query them efficiently without aggregating across all battle records.

#### Acceptance Criteria

1. THE Robot model SHALL be extended with the following KotH cumulative stat fields: `kothWins` (Int, default 0), `kothMatches` (Int, default 0), `kothTotalZoneScore` (Float, default 0), `kothTotalZoneTime` (Float, default 0 — total seconds of zone occupation across all KotH matches), `kothKills` (Int, default 0), `kothBestPlacement` (Int, nullable — best placement achieved, 1 = win), and `kothCurrentWinStreak` (Int, default 0)
2. WHEN a KotH match completes, THE KotH_Battle_Orchestrator SHALL update each participating robot's cumulative KotH stats: increment `kothMatches`, add the robot's final Zone_Score to `kothTotalZoneScore`, add zone occupation time to `kothTotalZoneTime`, add kills to `kothKills`, update `kothBestPlacement` if the current placement is better (lower number), and for the winner: increment `kothWins` and `kothCurrentWinStreak`
3. WHEN a robot does not win a KotH match, THE KotH_Battle_Orchestrator SHALL reset that robot's `kothCurrentWinStreak` to 0
4. THE KotH_Battle_Orchestrator SHALL update cumulative stats within the same database transaction as the battle result storage, ensuring consistency
5. THE cumulative stats SHALL be sufficient to power the KotH Standings page (Requirement 21) and KotH Hall of Records entries (Requirement 23) without requiring aggregation queries across the Battle/BattleParticipant tables

### Requirement 23: KotH Hall of Records Entries

**User Story:** As a player, I want KotH-specific records in the Hall of Records, so that exceptional KotH performances are celebrated alongside league records.

#### Acceptance Criteria

1. THE Hall_of_Records SHALL include a new "King of the Hill" category tab alongside the existing Combat, Upsets, Career, Economic, and Prestige categories, using a crown or zone icon (👑) consistent with the existing tab icon style
2. THE KotH records category SHALL include the following records:
   - (a) Most KotH Wins — robot with the highest `kothWins` count, displaying robot name, owner, total wins, total matches, and KotH win rate
   - (b) Highest Single-Match Zone Score — the highest Zone_Score achieved by any robot in a single KotH match, displaying robot name, score, match date, and link to battle details
   - (c) Most KotH Kills (Career) — robot with the highest cumulative `kothKills`, displaying robot name, owner, total kills, and total KotH matches
   - (d) Longest KotH Win Streak — the longest consecutive KotH win streak ever achieved by a single robot, displaying robot name, owner, streak length, and dates of streak start/end
   - (e) Most Zone Time in Single Match — the longest total zone occupation time by a single robot in one KotH match, displaying robot name, time in seconds, match date, and link to battle details
   - (f) Fastest Score Threshold Victory — the shortest match duration where a robot reached the Score_Threshold (30 points), displaying robot name, match duration, final score, and link to battle details
   - (g) Zone Dominator — the robot with the highest percentage of points earned from uncontested zone control (minimum 10 KotH matches), displaying robot name, uncontested percentage, total matches, and total zone score
3. THE `GET /api/records` endpoint SHALL be extended to include a `koth` category in the response, following the same response structure as existing record categories (record object with holder info, value, date, and optional battle link)
4. THE KotH records SHALL query from both the cumulative robot stats (Requirement 22) for career records and the BattleParticipant/Battle tables for single-match records
5. THE KotH records SHALL only appear in the Hall of Records after at least 5 KotH events have been completed, preventing meaningless records from early data
6. WHEN the KotH system is implemented, THE Requirement 19 documentation updates SHALL include the new KotH records in the Hall of Records section of `PRD_HALL_OF_RECORDS.md`

### Requirement 24: KotH Match Cards in Dashboard

**User Story:** As a player, I want KotH matches to appear in my dashboard's upcoming and recent match sections with an appropriate card format, so that I can see my KotH schedule and results alongside my league and tournament matches.

#### Acceptance Criteria

1. THE UpcomingMatches component SHALL display scheduled KotH matches alongside league and tournament matches, using a distinct card style with a crown icon (👑) and a left border color of orange (#F97316) to visually distinguish KotH events from league (green/red/gray), tournament (gold/amber #d29922), and tag team (cyan) match cards
2. THE upcoming KotH match card SHALL display: the label "King of the Hill" (or "KotH — Rotating Zone" for the rotating variant), the user's participating robot name, the full list of opponent robot names in the match group, the total participant count (e.g., "6 robots"), and the scheduled time
3. THE RecentMatches component SHALL display completed KotH matches alongside league and tournament results, using the same orange left border (#F97316) and crown icon
4. THE recent KotH match card SHALL display: the user's robot name, final placement (e.g., "1st of 6" with medal color for top 3), Zone_Score achieved, credits earned, and a "View Battle" link to the KotH battle playback page
5. THE `GET /api/matches/upcoming` endpoint SHALL be extended to include scheduled KotH matches for the user's robots, returning the match type, zone variant, participant count, and scheduled time
6. THE `GET /api/matches/history` endpoint SHALL be extended to include completed KotH battles where the user's robots participated, returning the match type, placement, Zone_Score, and reward data from the BattleParticipant record
7. WHEN a user has multiple robots in different KotH matches (across different groups), THE dashboard SHALL show one card per match, each displaying the relevant robot
8. THE KotH match cards SHALL be visually consistent with the existing compact card layout used by `CompactBattleCard`, adapting the layout from head-to-head (robot vs robot) to event-based (robot in event) without breaking the scrollable container or spacing

### Requirement 25: KotH Performance Section on Robot Analytics Tab

**User Story:** As a player, I want to see my robot's KotH performance stats on the analytics tab, so that I can track how my robot performs in zone-control events separately from league battles.

#### Acceptance Criteria

1. THE RobotPerformanceAnalytics component SHALL render a "King of the Hill Performance" section below the existing league performance summary, only visible when the robot has participated in at least one KotH match (`kothMatches > 0` from the cumulative stats in Requirement 22)
2. THE KotH performance section SHALL display a summary grid with the following metrics: KotH Matches, 1st Place Finishes (from `kothWins`), Podium Rate (percentage of matches finishing 1st–3rd), Avg Zone Score (from `kothTotalZoneScore / kothMatches`), Total Zone Time (formatted as minutes:seconds from `kothTotalZoneTime`), KotH Kills (from `kothKills`), Best Placement (from `kothBestPlacement`), and Current Win Streak (from `kothCurrentWinStreak`)
3. THE backend SHALL expose KotH performance data via `GET /api/analytics/robot/{robotId}/koth-performance` returning the cumulative KotH stats from the Robot model plus derived metrics (podium rate, avg zone score), queried from the robot's tracked fields rather than aggregating across battle records
4. THE KotH performance section SHALL use the same card styling as the existing performance summary (bg-surface-elevated cards in a responsive grid), with an orange (#F97316) accent color for KotH-specific metric values to visually distinguish them from league stats
5. THE existing league performance summary (Battles, Win Rate, W-L-D Record, ELO Change, etc.) SHALL NOT include KotH battles in its calculations — league and KotH stats remain separate. The backend analytics endpoint SHALL filter by `battleType` to exclude KotH battles from the league performance summary
6. WHEN the robot has zero KotH matches, THE RobotPerformanceAnalytics component SHALL NOT render the KotH section at all — no empty state, no placeholder, just absent

### Requirement 26: KotH Battle History Integration

**User Story:** As a player, I want to filter and view KotH battles in my battle history, so that I can review my KotH match results alongside league and tournament history.

#### Acceptance Criteria

1. THE BattleHistoryPage battle type filter SHALL be extended to include a "KotH" option alongside the existing "Overall", "League", and "Tournament" views
2. THE BattleHistorySummary statistics toggle SHALL include a "KotH" view that shows KotH-specific aggregate stats: total KotH matches, placement breakdown (1st/2nd/3rd/other counts), average Zone_Score, total KotH credits earned, and total KotH kills
3. THE CompactBattleCard SHALL render KotH battles with a 👑 icon, orange left border (#F97316), and display the robot's placement (e.g., "1st of 6") instead of a WIN/LOSS badge, the Zone_Score achieved, and credits earned
4. THE CompactBattleCard for KotH battles SHALL display the zone variant ("Fixed Zone" or "Rotating Zone") in the battle type text area where league tier or tournament name normally appears
5. THE backend `GET /api/matches/history` endpoint SHALL include KotH battles in the response, with `battleType: 'koth'`, the robot's placement, Zone_Score, participant count, and zone variant. KotH battles SHALL be sourced from the BattleParticipant table joined with the Battle table where `battleType = 'koth'`
6. THE search functionality SHALL support searching KotH battles by opponent robot names (all participants in the same match)
7. THE sort controls SHALL work with KotH battles: date sorting uses the battle timestamp, reward sorting uses credits earned, and ELO sorting SHALL place KotH battles at the bottom (since ELO change is always 0)

### Requirement 27: KotH Admin Panel Integration

**User Story:** As an admin, I want to view and analyse KotH battles in the admin panel's battles section, so that I can monitor KotH event health, investigate issues, and review match outcomes.

#### Acceptance Criteria

1. THE admin battles page (`/admin#battles`) battle type filter SHALL be extended to include a "koth" option alongside the existing "all", "league", "tournament", and "tagteam" options
2. THE `GET /api/admin/battles` endpoint SHALL support `battleType=koth` as a query parameter, returning KotH battles from the Battle table where `battleType = 'koth'`, joined with BattleParticipant records to include all 5–6 participants per match
3. THE admin battle list SHALL display KotH battles with: match ID, date, zone variant (fixed/rotating), participant count, winner robot name, match duration, and whether the match ended by score threshold, time limit, or last standing
4. THE admin battle detail view for KotH matches SHALL display all participants with their final placement, Zone_Score, zone occupation time, kills, elimination status (survived/destroyed/yielded), credits earned, fame earned, and prestige earned
5. THE admin panel SHALL include KotH battles in the aggregate battle statistics (total battles count, average duration), with the ability to filter statistics by battle type
6. THE admin panel SHALL support manual KotH cycle triggering following the same pattern as the existing manual league cycle trigger, executing the full KotH cycle sequence (repair → execute → matchmake)

### Requirement 28: KotH Discord Notifications

**User Story:** As a player, I want to receive Discord notifications when KotH events complete, so that I can check my results without having to log in.

#### Acceptance Criteria

1. THE `buildSuccessMessage` function in the notification service SHALL include a `'koth'` case in the job name switch that produces a message in the format: "King of the Hill battles have been completed! 👑 Click here to see the results! {link}"
2. THE `JobContext` interface SHALL be extended with a `'koth'` job name, and the KotH cycle execution in the Cycle_Scheduler SHALL dispatch a notification via `dispatchNotification` after KotH battles complete, following the same pattern as league, tournament, and tag team notifications
3. THE KotH Discord notification SHALL only be dispatched when at least one KotH battle was executed (skip notification if zero matches were scheduled), consistent with how tag team notifications are skipped on even cycles
4. THE KotH Discord notification SHALL include the total number of KotH matches completed in the message, e.g., "King of the Hill: 3 matches completed! 👑 Click here to see the results! {link}"
