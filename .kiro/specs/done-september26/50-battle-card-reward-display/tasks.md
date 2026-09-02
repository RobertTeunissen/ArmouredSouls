# Implementation Tasks

## Task 1: Extend the match response contracts and defer tournament-bye resolution

- Add `byeRewardCredits` and `byeRewardStatus` to the frontend `ScheduledMatch` contract in `app/frontend/src/utils/matchmakingApi.ts`, preserving the existing route and legacy compatibility.
- Add the exact nullable one-sided `robot2` shape and the durable `isByeMatch` response field to the frontend `BattleHistory` contract.
- Add `app/backend/src/services/match/byeDisplayService.ts` with the discriminated `ByeDisplayContext`, `ByeRewardDisplay`, `getExpectedByeReward`, and `getAwardedByeReward` interfaces/functions described in the design. Delegate all expected reward arithmetic to `resolveByeReward` in `app/backend/src/utils/byeRewards.ts`; do not duplicate a reward formula.
- Update `getUpcomingMatches` and its formatters in `app/backend/src/services/match/matchHistoryService.ts`:
  - preserve the database `isByeMatch` value for all `Battle_Mode_Set` rows;
  - use the authenticated robot/team ids when selecting the primary real subject;
  - retain real FFA participants and set the FFA bye marker from the row;
  - return generated current-round `tournament_1v1` byes with the real robot and `byeRewardStatus: 'expected'` before round processing;
  - return generated current-round `tournament_2v2`/`tournament_3v3` byes with the real team and `byeRewardStatus: 'expected'` before round processing;
  - exclude a tournament bye from Upcoming Matches only after its resolved battle/processing state exists; and
  - include awarded participant credits only for already-resolved byes.
- Update `app/backend/src/services/tournament/tournamentService.ts`, `app/backend/src/services/tournament/teamTournamentService.ts`, `app/backend/src/services/tournament/tournamentBattleOrchestrator.ts`, `app/backend/src/services/tournament/teamTournamentBattleOrchestrator.ts`, and `app/backend/src/services/cycle/cycleScheduler.ts` (or the active round-dispatch entry point) to remove generation-time `completeByeMatch`/`resolveByeEvent` calls, process each current-round bye exactly once, create the Bye_Record and credit award at round processing, and expose the next-round Match only after advancement.
- Update the history query/formatter in `app/backend/src/services/match/matchHistoryService.ts` to batch-load `scheduled_matches_v2` and `scheduled_tournament_matches` markers by battle id, pass the durable marker into `formatBattleHistoryEntry`, and produce a real one-sided bye response instead of a fake opponent.
- Keep `battle_log` out of permanent history marker derivation and make no Prisma schema, reward-formula, or combat-simulation changes. The only lifecycle change is the timing of the existing tournament bye resolution/payment call.

_Requirements: R3.1–R3.8, R5.1–R5.4, R5.6–R5.9, R6.1–R6.4, R8.3–R8.5._

## Task 2: Implement pure perspective-side economic and instance helpers

- Update `app/frontend/src/utils/battleFormatters.ts` with `BattleEconomicDisplay`, `getBattleEconomicDisplay`, and the new participant aggregation behavior for `getBattleReward`.
- Identify ownership from the `myRobotId` participant's `robot.userId`; in non-FFA modes sum only same-owner participants with the same `team`, while in `koth`/`grand_melee` use only the perspective robot.
- Preserve the perspective participant's `prestigeAwarded` once as Participant_Prestige_Value. Do not sum, multiply, round, or recompute prestige in the Frontend, and do not use a raw top-level value for an opposite-side instance.
- Preserve Reward_Fallback when `participants` is missing/empty or the requested robot is not present; do not sum another stable's rows.
- Add `app/frontend/src/utils/match-display-instances.ts` with pure `expandBattleDisplayInstances` and `expandUpcomingMatchInstances` helpers, explicit `displayInstanceKey`, and `perspectiveRobotId`/`perspectiveTeamId` fields.
- Group non-FFA same-stable participants by `team`, emit one instance per owned side, emit one instance per owned robot for Placement_Mode, and retain selected-robot filtering for Robot Detail.
- Update the shared resolved-battle consumers to render expanded instances rather than deduplicating by source battle id; preserve `getBattleReward` for Battle History sorting and keep the displayed credit line as credits plus streaming exactly once.
- Add unit and fast-check coverage in `app/frontend/src/utils/battleFormatters.test.ts` and `app/frontend/src/utils/match-display-instances.test.ts` for one-, two-, and three-participant same-side fixtures, mixed owners, opposite-side instances, multi-robot FFA instances, missing participants, missing requested robot, zero values, unique keys, and non-summed prestige.

_Requirements: R1.1–R1.9, R2.1–R2.6, R8.1, R9.1–R9.6, R9.8–R9.9._

## Task 3: Make resolved bye history and expanded instances safe and truthful in the shared card

- Update `getBattlePerspective` in `app/frontend/src/utils/battleFormatters.ts` so `opponent` is nullable for a bye and non-bye legacy fallback behavior remains intact.
- Update `app/frontend/src/components/RecentBattles.tsx` and `app/frontend/src/pages/BattleHistoryPage.tsx` to consume the expanded resolved instances, pass each instance's explicit perspective robot to `getBattlePerspective`/`getBattleEconomicDisplay`, and keep Robot Detail scoped to its selected `robotId`.
- Update `app/frontend/src/components/CompactBattleCard.tsx` to:
  - give `isByeMatch` a BYE visual state before WIN/LOSS/DRAW;
  - render neutral no-opponent/walkover copy for a one-sided bye;
  - preserve mode labels, reward totals, and existing detail navigation; and
  - avoid claims about combat, damage, playback, or a real opponent for a bye.
- Update any affected `BattleHistoryPage` props/fixtures to accept a nullable opponent without weakening ordinary-battle behavior.
- Convert the changed resolved card to the existing accessible interaction pattern, retaining keyboard operation and a minimum 44px activation region.
- Add/update `app/frontend/src/components/__tests__/CompactBattleCard.test.tsx`, `app/frontend/src/components/__tests__/RecentBattles.pbt.test.tsx`, and `app/frontend/src/pages/__tests__/BattleHistoryPage.test.tsx`.
- Assert same-side 3v3 renders one card, opposite-side 1v1 renders two independent cards, multi-robot FFA renders one card per owned robot, every `Battle_Mode_Set` bye renders BYE with no opponent and correct expected/awarded distinction, stable-side totals remain correct, generated tournament byes do not appear in Recent Battles before round processing, processed byes do appear exactly once, and unchanged last-20 raw history behavior.

_Requirements: R1.6–R1.9, R2.2, R2.6, R5.5–R5.9, R7.3–R7.4, R8.2, R8.4, R9.7–R9.8._

## Task 4: Expand upcoming perspectives and route all byes through the shared mode-aware card

- Add `app/frontend/src/components/match-cards/bye-match-data.ts` with the pure `ByeCardSubject` union and `resolveByeCardSubject(match, perspective)` helper.
- Update `app/frontend/src/components/UpcomingMatches.tsx` to call `expandUpcomingMatchInstances` before rendering, preserve one same-side 3v3 instance, create two explicit instances when a stable owns opposite non-FFA sides, and create one instance per owned FFA robot.
- Ensure every expanded upcoming instance has a unique `displayInstanceKey` and that standard/team card result selection uses `perspectiveRobotId`/`perspectiveTeamId` rather than `myUserId` alone.
- Check each instance's `isByeMatch` before all mode-specific branches, resolve the real robot/team/FFA subject using its explicit perspective, and render `ByeMatchCard` for every mode.
- Refactor `app/frontend/src/components/match-cards/ByeMatchCard.tsx` to use `getModeConfig`, show BYE, mode, subject, time, neutral no-opponent copy, and expected/awarded/pending Bye_Reward_Display. Remove tournament-only text such as “Top seed” and “auto-advances to next round” from non-tournament paths.
- Remove or make unreachable the duplicate bye branches in `TeamBattleMatchCard.tsx` and `KothMatchCard.tsx`; ordinary match cards must not render a bye before the shared route.
- Preserve `UpcomingMatches` loading, error, empty, authentication, sorting, and ordinary-card behavior.
- Add/update `app/frontend/src/components/__tests__/UpcomingMatches.test.tsx`, `app/frontend/src/components/match-cards/__tests__/ByeMatchCard.test.tsx`, and the pure instance tests covering every `Battle_Mode_Set` value (`league_1v1`, `tournament_1v1`, `league_2v2`, `tournament_2v2`, `league_3v3`, `tournament_3v3`, `tag_team`, `koth`, and `grand_melee`) with distinct league/tournament team fixtures, expected/awarded reward states, generated tournament byes remaining upcoming, next-round Matches appearing after processing, distinct opposite-side cards, and malformed data that must not fall through to a normal card.

_Requirements: R3.2–R3.7, R4.1–R4.8, R7.1–R7.5, R8.2, R8.4, R9.1–R9.6, R9.9._

## Task 5: Apply terminology, responsive behavior, and documentation decisions

- Align comments, helper names, props, fixtures, and copy in the changed files so scheduled records use Match terminology and resolved records use Battle terminology. Keep `/api/matches/history`, “Upcoming Matches”, and “Recent Battles” unchanged.
- Update changed card breakpoints to the existing `<1024px` stacked / `>=1024px` desktop contract from `.kiro/steering/frontend-standards.md`, with safe wrapping/truncation and no horizontal overflow at 320px–1023px.
- Add responsive/accessibility assertions for 320px, 768px, 1023px, and 1024px, including visible reward/bye content, no `scrollWidth > clientWidth`, keyboard operation, and 44px activation regions.
- Create `docs/implementation_notes/BATTLE_CARD_DISPLAY.md` documenting the `participants[]` perspective-side aggregation boundary, the same-side versus opposite-side/FFA Display_Instance expansion, the explicit `displayInstanceKey`/perspective fields, the non-additive prestige decision, the durable scheduling-table bye marker, the expected-versus-awarded bye lifecycle, the additive bye response fields, and the Match/Battle terminology rule. Do not restate or redefine Spec #49 reward formulas.
- Review `docs/game-systems/PRD_LEAGUE_SYSTEM.md` and record/update any all-mode bye or card references so they remain consistent with the shared nine-mode treatment.
- Update `docs/game-systems/PRD_TOURNAMENT_SYSTEM.md` to document that generated tournament byes remain upcoming/expected, are credited and added to Recent Battles only when their round is processed, and expose the next-round Match only after advancement.
- Update `app/backend/src/content/guide/tournaments/bye-matches.md`, `app/backend/src/content/guide/tournaments/tournament-format.md`, and `app/backend/src/content/guide/tournaments/rewards.md` so player-facing copy matches the deferred Tournament_Bye_Lifecycle without changing the reward amount or formula.
- Review `.kiro/steering/frontend-standards.md`, `.kiro/steering/project-overview.md`, `.kiro/steering/coding-standards.md`, and `docs/guides/` against the completed implementation, including the new pure instance-expansion convention. Keep the steering/project-overview/guide files unchanged unless the implementation actually introduces a reusable general convention; record the no-change decisions in `BATTLE_CARD_DISPLAY.md`.

_Requirements: R6.1–R6.5, R7.1–R7.5, R8.2, R8.6._

## Task 6: Run backend/frontend validation and Spec 50 aggregate verification

- Run targeted Frontend tests for `battleFormatters`, `match-display-instances`, `CompactBattleCard`, `RecentBattles`, `UpcomingMatches`, and `ByeMatchCard`.
- Run `pnpm --dir app/backend run test:unit -- matchHistoryService tournamentService teamTournamentService tournamentBattleOrchestrator teamTournamentBattleOrchestrator` and focused `byeDisplayService`/tournament-bye lifecycle tests.
- Run changed-file diagnostics, Frontend lint/build, Backend lint/build/typecheck, and the repository-required test tiers applicable to the changed packages. Do not add `continue-on-error`, `|| true`, or an unguarded pipe.
- Run every Verification Criterion in `requirements.md`:
  1. shared perspective-side aggregation and no page-local summation;
  2. shared bye route, response fields, and all nine mode coverage;
  3. resolved-battle formatter/component tests;
  4. scheduled bye-card, perspective-instance, and generated/processed tournament-bye timing tests;
  5. backend match-history and tournament lifecycle contract tests;
  6. removal of generic tournament-only bye copy while preserving headings;
  7. 320px/1023px viewport and 44px activation checks;
  8. same-side 3v3, opposite-side 1v1, and multi-robot `grand_melee` instance expansion in upcoming and resolved views; and
  9. no generation-time tournament bye credit/history, exactly-once round processing, and next-round upcoming visibility.
- If any check fails, fix the implementation or the incorrect test and rerun the affected validation. Do not weaken, exclude, or delete a test to obtain a pass.

_Requirements: R1.1–R1.9, R2.1–R2.6, R3.1–R3.8, R4.1–R4.8, R5.1–R5.9, R6.1–R6.5, R7.1–R7.5, R8.1–R8.6, R9.1–R9.9; Verification Criteria 1–9._

## Requirements Coverage Check

The task groups intentionally overlap at their boundaries so no acceptance criterion is owned by only an untested layer:

| Requirement | Covered by |
|---|---|
| R1.1–R1.9 | Tasks 2, 3, and 6 |
| R2.1–R2.6 | Tasks 2, 3, and 6 |
| R3.1–R3.8 | Tasks 1, 4, and 6 |
| R4.1–R4.8 | Tasks 4 and 6 |
| R5.1–R5.9 | Tasks 1, 3, and 6 |
| R6.1–R6.5 | Tasks 1, 5, and 6 |
| R7.1–R7.5 | Tasks 3, 4, 5, and 6 |
| R8.1–R8.6 | Tasks 1–6 |
| R9.1–R9.9 | Tasks 2, 3, 4, and 6 |
