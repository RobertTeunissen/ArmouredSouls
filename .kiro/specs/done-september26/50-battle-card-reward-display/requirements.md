# Requirements Document

## Glossary

- **Match**: A scheduled event that has not yet been fought. Its primary backend record is a row in `scheduled_matches_v2` or `scheduled_tournament_matches`, and its frontend contract is `ScheduledMatch`.
- **Battle**: A resolved combat result represented by a row in `battles` and its `battle_participants` rows.
- **Resolved_Battle**: A Battle that can be shown in the player-facing history feed after resolution, including a Walkover_Resolution created by Spec #49.
- **Walkover_Resolution**: The Spec #49 resolution path for a Bye_Event: detect the absent opponent, write the bye record, award the mode floor, and run no combat simulation.
- **Placement_Mode**: A mode whose normal result is a finishing position rather than a one-on-one win/loss result: `koth` or `grand_melee`.
- **Battle_Mode_Set**: The exhaustive set of nine battle modes covered by this spec: `league_1v1`, `tournament_1v1`, `league_2v2`, `tournament_2v2`, `league_3v3`, `tournament_3v3`, `tag_team`, `koth`, and `grand_melee`. Bye identity, visibility, reward timing, and card treatment apply to every member.
- **Tournament_Bye_Lifecycle**: The timing contract for a tournament bye: bracket generation creates an upcoming expected Bye_Event without awarding credits or creating a Resolved_Battle; processing the relevant tournament round resolves and credits it once; after that processing, the participant's next-round Match becomes eligible for Upcoming Matches.
- **Bye_Record**: The persisted battle, participant, summary, audit, and scheduling artefacts created by a resolved Bye_Event under Spec #49.
- **Bye_Placeholder**: A negative-id scheduling sentinel for an absent side. It is not a combatant and must never be rendered as an opponent.
- **Battle_Card**: A compact player-facing row that summarizes one Resolved_Battle or Match.
- **Resolved_Battle_Card**: The Battle_Card rendered by `CompactBattleCard` from `BattleHistory` data.
- **Upcoming_Match_Card**: A Battle_Card rendered by one of the four components under `components/match-cards/` for a `ScheduledMatch`.
- **Perspective_Side**: The participant scope represented by one card. In non-FFA modes it is the set of participants owned by the same stable and sharing the perspective participant's `team`; in `koth` and `grand_melee` it is one owned robot because those modes have no opposing team side.
- **Perspective_Side_Participant**: A `BattleParticipantData` entry belonging to the player's stable and the current Perspective_Side. Same-stable participants on another side are deliberately excluded from this instance.
- **Display_Instance**: One rendered card perspective for a scheduled Match or resolved Battle, identified by its source record and perspective robot/team.
- **Upcoming_Match_Instance**: A Display_Instance derived from one `ScheduledMatch`. One raw schedule row can produce two instances when the stable owns both non-FFA sides, or one instance per owned robot in a Placement_Mode.
- **Credit_Total**: The sum of `participants[].credits` for all Perspective_Side_Participant entries. For a same-side 3v3 this is the stable team's total; for opposite-side or FFA instances it is scoped to that instance rather than merged across the battle.
- **Streaming_Total**: The sum of `participants[].streamingRevenue` for all Perspective_Side_Participant entries.
- **Fame_Total**: The sum of `participants[].fameAwarded` for all Perspective_Side_Participant entries.
- **Participant_Prestige_Value**: The `prestigeAwarded` value on the perspective participant for this Display_Instance. It is shown once and is not summed or multiplied when team rows contain rounded display allocations.
- **Stable_Total_Display**: The economic display on a Resolved_Battle_Card for one Perspective_Side: Credit_Total plus Streaming_Total, with Fame_Total shown as the fame indicator and Participant_Prestige_Value shown once. It is a stable-side total, not an across-all-sides total.
- **Reward_Fallback**: The legacy path used when `BattleHistory.participants` is absent: `winnerReward` for a win and `loserReward` otherwise.
- **Bye_Event**: A scheduled event in which the subscribed real side has no fought opponent and receives the mode's bye resolution. Spec #49 owns the reward amount and no-simulation rules; Tournament_Bye_Lifecycle owns when a tournament Bye_Event is invoked and becomes resolved.
- **Bye_Identity**: The combination of `isByeMatch`, mode, and real player-owned robot or team data that lets the UI explain a Bye_Event without fabricating a combatant.
- **Bye_Card**: The single Upcoming_Match_Card representation for every Bye_Event, regardless of mode.
- **Bye_Reward_Display**: The expected or already-awarded credit amount exposed to a Bye_Card as `byeRewardCredits`, together with `byeRewardStatus`: `expected` before resolution, `awarded` after resolution, or the legacy-only `pending` state when context is insufficient. `expected` is informational and is not proof that credits have already been awarded.
- **History_Window**: The existing last-20 resolved records used by `RecentBattles`; this spec does not replace it with a rolling time window.
- **Terminology_Alignment**: The naming rule that a scheduled record is a Match and a resolved record is a Battle, while preserving the existing headings “Upcoming Matches” and “Recent Battles”.
- **Responsive_Card_Layout**: The existing desktop/mobile card treatment, extended so every changed card remains usable from 320px through desktop widths without horizontal overflow.
- **Player_Guide**: Player-facing product content under `app/backend/src/content/guide/` that explains bye behavior, tournament format, and rewards.

## Introduction

The player-facing battle feed is already composed from one resolved-battle card in three places: Dashboard, Robot Detail matches, and Battle History. That shared path is the correct foundation, but it currently displays the first matching robot's economic share. A same-side team battle therefore makes a stable's reward look one-half or one-third of what was actually paid, while a stable owning participants on opposite sides needs distinct perspectives rather than one merged total. The upcoming side has the opposite problem: four separate card implementations do not agree on Bye_Event identity, tournament byes are dropped by backend queries, and the existing `ByeMatchCard` uses tournament-only copy for every bye.

This spec corrects the display and response contracts without changing any reward formula. It also corrects Tournament_Bye_Lifecycle: a generated tournament bye remains an upcoming expected Match until its round is processed; only then is the existing bye resolution invoked, credits are awarded, and a Resolved_Battle becomes visible. The perspective-side correction uses the already-persisted `participants[]` data, so no new battle-reward API is required. Bye visibility requires the existing match-history service to return the real participant/team and a small `Bye_Reward_Display` value so the shared card can explain the event instead of rendering an empty or fictional opponent.

The scope is deliberately limited to player-facing display and the data shaping needed to support it:

1. aggregate additive economic values for the represented Perspective_Side;
2. preserve the non-additive prestige semantics instead of presenting a false total;
3. expose every current Bye_Event through upcoming and resolved history;
4. render all byes with one mode-aware card;
5. enforce Tournament_Bye_Lifecycle without changing the bye reward formula; and
6. align Match/Battle terminology without renaming stable public routes or headings.

Spec #49 remains the owner of the bye reward formula and no-simulation rules. Spec 50 consumes those records and requires the tournament orchestrator to invoke the existing resolution at round processing rather than at bracket generation. The perspective-side correction, persistent bye labeling, card copy, and terminology work do not depend on a balance decision from Spec #49; Placement_Mode and tournament bye rows do.

## Expected Contribution

1. **Correct perspective-side reward display across three surfaces.** Today `getBattleReward` returns one participant's credits and the card adds one participant's streaming value. After this spec, the shared `CompactBattleCard` path displays Credit_Total and Streaming_Total for the represented side, so a same-side 2v2 or 3v3 card reflects the amount paid to that stable side while opposite-side and FFA perspectives remain separate. `Reward_Fallback` preserves older payload compatibility.

2. **Replace fragmented bye presentation with one truthful card.** Today `StandardMatchCard`, `TeamBattleMatchCard`, `KothMatchCard`, and `ByeMatchCard` each have partial bye behavior, and `ByeMatchCard` labels every bye as a tournament. After this spec, every `isByeMatch` record is routed to one `Bye_Card`, with mode, real participant/team, reward status, and no-opponent copy supplied consistently.

3. **Make the existing nine-mode bye record queryable from player surfaces.** Today 1v1 tournament byes lose their robot details, team-tournament byes are filtered out of the upcoming query, placement byes are treated as ordinary FFA matches, and 1v1 league history does not carry a bye marker. After this spec, every bye response contains enough `Bye_Identity` data for Upcoming Matches and Recent Battles to show the event without a `Bye_Placeholder`.

4. **Reduce terminology ambiguity without an endpoint migration.** Today the data model distinguishes Match and Battle, but the history service, response types, and copy use the terms inconsistently. After this spec, scheduled records use Match terminology and resolved records use Battle terminology in the affected types, comments, labels, and tests; `/api/matches/history`, `Recent Battles`, and `Upcoming Matches` remain compatible public names.

5. **Keep the display correction safe on mobile and regression-testable.** The changed cards continue to use the existing responsive layouts from 320px upward, retain accessible interaction targets, and gain focused unit, property-based, backend contract, and component tests for aggregation, bye identity, fallback behavior, and terminology.

6. **Correct tournament-bye timing.** A bye generated into a tournament bracket appears in Upcoming Matches with an expected reward and no Recent Battles/credit transaction before its round runs; processing the first round creates exactly one awarded bye history entry and credit award, after which the participant's second-round Match appears in Upcoming Matches.

### Verification Criteria

These aggregate checks are run after the final implementation task:

1. `rg -n "getBattleReward|Stable_Total_Display|Credit_Total|Streaming_Total|Fame_Total" app/frontend/src` shows one shared aggregation implementation under `utils/` and all three resolved-battle surfaces consume it through `RecentBattles`/`CompactBattleCard`; no page-local reward summation exists.
2. `rg -n "isByeMatch|byeRewardCredits|ByeMatchCard" app/frontend/src/components app/frontend/src/utils app/backend/src/services/match/matchHistoryService.ts` shows the shared bye route, the response fields, and every `Battle_Mode_Set` mode covered by tests; no mode-specific card renders a bye before the shared route.
3. `pnpm --dir app/frontend test -- --run src/components/__tests__/CompactBattleCard.test.tsx src/components/__tests__/RecentBattles.pbt.test.tsx` passes with assertions for multi-robot credit, streaming, fame, prestige non-summing, legacy fallback, and 320px rendering.
4. `pnpm --dir app/frontend test -- --run src/components/__tests__/UpcomingMatches.test.tsx src/components/match-cards` passes with one-card routing and mode-aware bye assertions for every `Battle_Mode_Set` value, including separate league and tournament team-mode fixtures.
5. `pnpm --dir app/backend run test:unit -- matchHistoryService tournamentService teamTournamentService tournamentBattleOrchestrator teamTournamentBattleOrchestrator` passes with contract assertions for every `Battle_Mode_Set` value, persistent `isByeMatch`, real participant/team details, and the distinction between generated tournament byes, round-processed awarded byes, and next-round upcoming matches.
6. `rg -n "Top seed|auto-advances to next round|no opponent in this round" app/frontend/src/components/match-cards` returns no generic tournament-only bye copy, and `rg -n "Recent Battles|Upcoming Matches" app/frontend/src` confirms both established headings remain.
7. A frontend viewport test renders populated bye and team cards at 320px and 1023px and asserts no horizontal overflow; the same test asserts every clickable card/robot target has an activation region of at least 44px.
8. `pnpm --dir app/frontend test -- --run src/utils/__tests__/match-display-instances.test.ts src/components/__tests__/UpcomingMatches.test.tsx src/components/__tests__/RecentBattles.pbt.test.tsx` passes with assertions that same-side 3v3 data produces one instance, opposite-side 1v1 data produces two instances, and multi-robot `grand_melee` data produces one instance per owned robot in both upcoming and resolved views.
9. A tournament-bye lifecycle test proves that bracket generation exposes a `Bye_Reward_Display` with `byeRewardStatus: 'expected'` in Upcoming Matches without awarding credits or creating a Recent Battles entry; processing round one creates one awarded history record and credit transaction, and the participant's round-two Match then appears in Upcoming Matches.
## Requirements

### Requirement 1: Perspective-side additive reward display

**User Story:** As a stable owner, I want each resolved battle card to show what the represented side earned, so same-side team rewards are combined without merging robots that fought for me on another side.

#### Acceptance Criteria

1. WHEN a `BattleHistory` contains `participants` THEN the resolved-battle reward helper SHALL identify the perspective participant from `myRobotId`, derive its Perspective_Side, and sum `credits` for every Perspective_Side_Participant in that instance.
2. WHEN a stable owns two or three robots on the same side of a team battle THEN the resolved-battle card SHALL show the full Credit_Total exactly once; it SHALL NOT choose the first matching participant as the total.
3. WHEN a stable owns robots on both combat sides of one non-FFA battle THEN the presentation SHALL create one Display_Instance per owned side, and each instance SHALL aggregate only its own Perspective_Side_Participant entries.
4. WHEN a stable owns multiple robots in one `koth` or `grand_melee` battle THEN the presentation SHALL create one Display_Instance per owned robot, and SHALL NOT merge those robots into one reward total.
5. WHEN a stable has one participant in a 1v1, FFA, or bye battle THEN Credit_Total SHALL equal that participant's `credits`.
6. WHEN `participants` is absent or empty THEN the helper SHALL use Reward_Fallback and SHALL preserve the existing winner/loser outcome behavior.
7. WHEN `participants` is present but the requested robot is not found THEN the helper SHALL use Reward_Fallback rather than summing an unrelated player's participants.
8. The implementation SHALL keep the aggregation in the shared formatter/helper path used by `RecentBattles` and `BattleHistoryPage`; Dashboard, Robot Detail, and Battle History SHALL receive the same result without page-local arithmetic.
9. The implementation SHALL not change `winnerReward`, `loserReward`, the backend reward formulas, or the amount written to `battle_participants`.

### Requirement 2: Additive indicators and explicit prestige semantics

**User Story:** As a stable owner, I want the economic indicators on a battle card to use honest units, so additive per-robot values are not silently reduced while rounded prestige is not falsely presented as a stable total.

#### Acceptance Criteria

1. For the player's Perspective_Side_Participant entries, the card data SHALL calculate Streaming_Total from `streamingRevenue` and Fame_Total from `fameAwarded`.
2. The displayed credit line SHALL use Credit_Total plus Streaming_Total exactly once; it SHALL not add a participant's streaming value a second time through a legacy field.
3. The card SHALL display Participant_Prestige_Value at most once and SHALL NOT sum `prestigeAwarded` across team participants. The value SHALL come from the perspective participant's `prestigeAwarded`, rather than a raw top-level `BattleHistory.prestigeAwarded` value that may describe a different owned side when one stable owns both sides. The requirements intentionally treat this as a participant-level display allocation because team rows may contain `Math.floor(stableAward / teamSize)` and cannot reconstruct the authoritative stable award after rounding.
4. The implementation SHALL not label Participant_Prestige_Value as a stable total, multiply it by team size, round it up, or derive a new prestige formula in the Frontend.
5. Tests SHALL cover two owned participants on the same side and two owned participants on opposite sides, proving that credits, streaming revenue, and fame aggregate only within the represented side while prestige remains one non-summed display value from that perspective.
6. If a Bye_Card renders economic indicators, they SHALL reflect the persisted zero streaming, fame, and prestige values; the card SHALL not invent non-zero indicators and SHALL still show the bye credit reward.

### Requirement 3: Complete upcoming Bye_Identity response

**User Story:** As a player, I want every subscribed Bye_Event to appear in Upcoming Matches with my real robot or team, so a bye is visible instead of looking like a missing match.

#### Acceptance Criteria

1. The `/api/matches/upcoming` response SHALL preserve `isByeMatch: true` for every bye in the `Battle_Mode_Set`: `league_1v1`, `tournament_1v1`, `league_2v2`, `tournament_2v2`, `league_3v3`, `tournament_3v3`, `tag_team`, `koth`, and `grand_melee`.
2. A unified 1v1 bye SHALL include the real robot in `robot1` or the perspective-equivalent real side; it SHALL not require a second robot and SHALL not expose a `Bye_Placeholder` as an opponent.
3. A unified team or tag-team bye SHALL include the real team in `teamBattleTeam1` or the perspective-equivalent real side and SHALL set the opponent team to null/absent rather than fabricating a combat team.
4. A KotH or Grand Melee bye SHALL include the real player-owned robot in `kothParticipants` and SHALL retain `kothParticipantCount` as the count of real participants; the formatter SHALL set `isByeMatch: true` rather than hard-coding false for all FFA rows.
5. Active-round `tournament_1v1` bye rows SHALL be returned with their real robot before the round is processed, even if bracket generation used a bookkeeping status that is normally associated with completion; a generated bye SHALL remain an upcoming expected Match until its resolved battle exists.
6. Active-round `tournament_2v2` and `tournament_3v3` bye rows SHALL be returned with their real team before the round is processed; bracket-generation bookkeeping SHALL not make a bye disappear from Upcoming Matches or make it awarded before the round runs.
7. Each returned bye SHALL include `byeRewardCredits` and `byeRewardStatus`. A queued or generated but not-yet-processed bye SHALL use `expected`; only a bye linked to its resolved battle after round processing SHALL use `awarded`. The amount SHALL come from the existing Spec #49 bye reward/participant data path, not from a duplicated Frontend formula, and `expected` SHALL not trigger a credit transaction.
8. The response SHALL remain scoped to the authenticated player's robots/teams and SHALL not reveal another stable's real participant details merely because they share the same bye row.

### Requirement 4: One mode-aware Bye_Card

**User Story:** As a player, I want a bye to be explained consistently, so I can distinguish a league walkover, tournament advance, or FFA thin-instance bye without misleading copy.

#### Acceptance Criteria

1. WHEN `UpcomingMatches` receives a ScheduledMatch with `isByeMatch === true` THEN it SHALL render `ByeMatchCard` before dispatching to `StandardMatchCard`, `TeamBattleMatchCard`, or `KothMatchCard`.
2. Every Bye_Card for every `Battle_Mode_Set` value SHALL show a `BYE` state badge, the correct mode label, the real robot or team name, the scheduled/resolution time, and Bye_Reward_Display when available.
3. A league or Placement_Mode bye SHALL not be labeled “Tournament”, “Top seed”, or “auto-advances to next round” unless it is actually a tournament bracket bye.
4. A tournament bye SHALL identify the tournament and round when those fields exist, but SHALL use the same Bye_Card component and reward treatment as every other mode.
5. A Bye_Card SHALL show no opponent as “Bye”, “No opponent”, or equivalent neutral copy; it SHALL never render a `Bye_Placeholder` as if combat were possible.
6. A queued bye whose amount is not yet awarded SHALL show that the reward is expected/processed at the battle slot, not a zero-credit result. A resolved bye SHALL show the awarded amount from the response.
7. The card SHALL not claim that a bye was fought, simulated, drawn, or caused damage. Its copy SHALL describe a walkover/automatic result consistent with Spec #49.
8. The existing `Upcoming Matches` empty, loading, error, sorting, and authentication behavior SHALL remain unchanged for non-bye records.

### Requirement 5: Resolved bye history, tournament lifecycle, and all-mode parity

**User Story:** As a player, I want every resolved bye and every tournament-bye transition to use the same truthful history contract, so no mode awards a bye early, hides it, or presents a fictional opponent.

#### Acceptance Criteria

1. Every `BattleHistory` entry backed by a resolved bye SHALL expose `isByeMatch: true` for every member of the `Battle_Mode_Set`: `league_1v1`, `tournament_1v1`, `league_2v2`, `tournament_2v2`, `league_3v3`, `tournament_3v3`, `tag_team`, `koth`, and `grand_melee`.
2. The backend history formatter SHALL source the durable bye marker from the associated scheduling record: `scheduled_matches_v2.is_bye_match` for `league_1v1`, `league_2v2`, `league_3v3`, `tag_team`, `koth`, and `grand_melee`, and `scheduled_tournament_matches.is_bye_match` for `tournament_1v1`, `tournament_2v2`, and `tournament_3v3`. It SHALL not depend on `battle_log` for permanent history display after the seven-day retention window.
3. A resolved bye SHALL serialize the real subject for every mode family: the real robot for `league_1v1`/`tournament_1v1`, the real team for `league_2v2`/`tournament_2v2`/`league_3v3`/`tournament_3v3`/`tag_team`, and the real owned robot for each `koth`/`grand_melee` Display_Instance. A null/absent opponent is valid; a fake robot named “Unknown” or a negative-id Bye_Placeholder SHALL never be serialized as a combat opponent for new records.
4. Every mode in the `Battle_Mode_Set` SHALL receive the same resolved-bye treatment: `isByeMatch: true`, BYE visual precedence, the real subject, neutral no-opponent copy, and the awarded Bye_Reward_Display. No league, tournament, team, tag-team, KotH, or Grand Melee mode may be omitted or given a separate placeholder path.
5. Team and tag-team bye history SHALL preserve the real team name and show the opponent as Bye/No opponent without requiring a second team lookup to succeed. `getBattlePerspective` and `CompactBattleCard` SHALL handle a bye without dereferencing a missing opponent.
6. WHEN a tournament bracket generates a bye before the relevant round has been processed THEN the bye SHALL appear in Upcoming Matches as an expected `Bye_Reward_Display`, but SHALL not award credits, create a Resolved_Battle/Recent Battles entry, or claim that the bye has been fought. Generation SHALL not invoke the resolved bye payment path merely because the bracket is complete.
7. WHEN the tournament processor processes the first round containing that bye THEN it SHALL invoke the existing no-simulation bye resolution exactly once, award the credits, create the Bye_Record and resolved history entry, and expose `byeRewardStatus: 'awarded'`. Reprocessing or retrying the round SHALL not create a second award or history entry.
8. AFTER first-round processing advances the participant THEN its second-round Match SHALL appear in Upcoming Matches, while the processed first-round Bye_Event remains available in Recent Battles. The second-round Match SHALL not be exposed as the participant's current upcoming event before that advancement occurs.
9. A resolved tournament bye SHALL be included in the same History_Window as fought battles and SHALL navigate through the existing battle-detail route when a battle id exists. A bye SHALL not create a new “fought battle” statistic, playback claim, combat duration claim, or opponent link in the card; playback availability remains governed by the existing battle-detail endpoint.

### Requirement 6: Terminology_Alignment

**User Story:** As a player and maintainer, I want scheduled and resolved records named consistently, so the UI and code do not imply that an upcoming Match has already become a Battle.

#### Acceptance Criteria

1. A scheduled record, its props, and its formatter variables SHALL use Match terminology and the existing `ScheduledMatch` contract; a resolved record, its props, and its formatter variables SHALL use Battle terminology and the existing `BattleHistory` contract.
2. The established headings `Upcoming Matches` and `Recent Battles` SHALL remain unchanged because they correctly distinguish the two states.
3. The public route `/api/matches/history` SHALL not be renamed in this spec. Its service comments and response documentation SHALL explicitly state that it returns resolved Battle history.
4. New or changed tests, comments, and component copy SHALL not call an unfought ScheduledMatch a battle or call a resolved Battle a pending match, except when referring to a specific API route name kept for compatibility.
5. Any new Pascal_Snake term used by the implementation or documentation SHALL be added to this Glossary before the spec is completed.

### Requirement 7: Responsive and accessible card behavior

**User Story:** As a mobile player, I want the corrected cards to remain readable and operable on a phone, so the reward and bye details do not require horizontal scrolling or precision taps.

#### Acceptance Criteria

1. The changed `CompactBattleCard` and `ByeMatchCard` layouts SHALL render from 320px through 1023px using stacked/wrapped content, and SHALL retain the existing desktop row layout at 1024px and above where practical.
2. At widths from 320px through 1023px, mode labels, BYE state, robot/team names, reward values, and time text SHALL wrap or truncate safely without horizontal overflow.
3. Every clickable card or robot link introduced or modified by this spec SHALL expose an activation region of at least 44px and SHALL remain keyboard operable; informational cards SHALL not be made clickable solely to show a reward.
4. The mobile layout SHALL preserve the distinction between Credit_Total, Streaming_Total, Fame_Total, and Participant_Prestige_Value where each indicator is shown; it SHALL not hide the only reward amount on small screens.
5. Frontend tests SHALL cover at least 320px and 1023px render widths with populated multi-robot and bye fixtures.

### Requirement 8: Regression and contract coverage

**User Story:** As a maintainer, I want focused tests around the shared display contract, so future changes cannot silently restore one-robot rewards or hide byes.

#### Acceptance Criteria

1. Formatter/property tests SHALL cover one-participant, two-participant, three-participant, multi-stable, missing-participants, missing-requested-robot, and zero-value economic fixtures.
2. Component tests SHALL cover the three Resolved_Battle_Card surfaces through `RecentBattles`/`CompactBattleCard`, all four Upcoming_Match_Card mode families, all nine `Battle_Mode_Set` values, and the mode-specific bye copy.
3. Backend service tests SHALL cover bye response shaping and lifecycle for every `Battle_Mode_Set` value, including separate league/tournament `2v2` and `3v3` fixtures, generated tournament byes, first-round processing, exactly-once retry behavior, and next-round upcoming visibility.
4. Tests SHALL assert that a bye's real robot/team data is displayed, that no opponent placeholder is displayed, and that the displayed bye reward is not zeroed or omitted when the API supplies it.
5. Tests SHALL assert that `isByeMatch` is true for a resolved history fixture from every `Battle_Mode_Set` value, including separate league/tournament `2v2` and `3v3` fixtures and both Placement_Mode values.
6. The Frontend test suite, Backend targeted unit suite, type checks, and lint checks for changed files SHALL pass without weakening or excluding existing tests.

### Requirement 9: Multiple same-stable display instances

**User Story:** As a stable owner, I want every robot-side perspective represented when my stable enters one event more than once, so an opposite-side 1v1 or multi-robot FFA event is not collapsed into one misleading card.

#### Acceptance Criteria

1. WHEN one raw `ScheduledMatch` or `BattleHistory` contains multiple participants owned by the authenticated stable THEN the presentation layer SHALL expand it into one Display_Instance for each distinct represented Perspective_Side.
2. In non-FFA modes, the expansion SHALL group stable-owned participants by their `team` value: all same-side participants SHALL share one Display_Instance, while participants on different sides SHALL produce separate Display_Instance values.
3. WHEN all three robots from a stable participate on one side of a 3v3 league match THEN Upcoming Matches and Recent Battles SHALL render exactly one card for that side, with the side-scoped reward totals from Requirement 1.
4. WHEN a stable owns one participant on each side of a 1v1 tournament or another non-FFA match THEN Upcoming Matches and Recent Battles SHALL render two cards, each with its own robot/team perspective, opponent perspective, and side-scoped reward values.
5. In `koth` and `grand_melee`, the expansion SHALL create one Display_Instance per owned robot, even when multiple owned robots occur in the same Battle; those robots SHALL never be collapsed because FFA modes do not have a shared opposing team side.
6. Each Upcoming_Match_Instance SHALL carry a unique `displayInstanceKey` and an explicit `perspectiveRobotId` or `perspectiveTeamId` as appropriate. Standard and team card selection SHALL use that explicit perspective rather than inferring the first side from `myUserId`.
7. In all-stable Dashboard and Battle History views, `RecentBattles` SHALL render every expanded instance. Robot Detail SHALL remain scoped to its selected `robotId` and render only that robot's instance, while still allowing the same battle to appear independently for another robot in an all-stable view.
8. Expansion SHALL preserve the existing History_Window of the last 20 raw resolved records; it MAY produce more than 20 rendered cards when a record has multiple instances, and SHALL not discard the second instance merely because its source battle id matches another card.
9. Frontend tests SHALL cover a same-side 3v3 fixture producing one instance, an opposite-side 1v1 fixture producing two instances, and a multi-robot `grand_melee` fixture producing one instance per owned robot for both upcoming and resolved displays.

## Scope Boundaries and Decisions

- This spec does not change any credit, prestige, fame, streaming, LP, or ELO formula. Spec #49 remains the authority for bye reward amounts and no-simulation rules; this spec requires tournament processing to call that existing resolution at the scheduled round rather than during bracket generation.
- This spec does not add a new player page, change the last-20 History_Window, or replace the existing `RecentBattles` composition.
- The perspective-side correction is intentionally client-side over the canonical `participants[]` payload. No new resolved-battle reward endpoint is required.
- Participant_Prestige_Value is intentionally not treated as a stable total. A future API contract may add an authoritative stable-level prestige field, but creating a second inferred value here would be less truthful than retaining the current persisted display allocation.
- Bye visibility and Tournament_Bye_Lifecycle depend on the Bye_Record and Placement_Mode/tournament rows delivered by Spec #49. Spec 50 must consume those rows, defer tournament reward resolution until round processing, and must not duplicate bye reward arithmetic or no-simulation logic.
- The public route name `/api/matches/history` remains for compatibility; only its terminology and documentation are clarified.
- The design must follow `.kiro/steering/frontend-standards.md`, including the existing responsive tab/card patterns, typed API helpers, focused presentational components, and no new global state.
