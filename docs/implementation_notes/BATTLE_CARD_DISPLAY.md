# Battle Card Display Contract

**Last Updated**: September 1, 2026  
**Status**: Implemented  
**Spec**: 50 — Battle Card Reward Display

## Scope

This note records the display and scheduling boundaries introduced by Spec 50. It covers how resolved Battles and scheduled Matches are shaped for player-facing cards, how a stable's perspective is selected, and when tournament byes become resolved. It does not redefine or duplicate the reward arithmetic owned by Spec #49.

## Match and Battle terminology

- A **Match** is a scheduled, unfought record. The frontend contract is `ScheduledMatch`; backend rows come from `scheduled_matches_v2` or `scheduled_tournament_matches`. It appears under **Upcoming Matches**.
- A **Battle** is a resolved record. The frontend contract is `BattleHistory`; its durable economics come from `battle_participants` and its history marker comes from the associated scheduling row. It appears under **Recent Battles**.
- `/api/matches/history` remains the compatible route name. Its response is resolved Battle history, not a list of pending Matches.
- The visible headings **Upcoming Matches** and **Recent Battles** remain unchanged.

## Resolved Battle economics

`participants[]` is the canonical source for per-robot economic display data. `getBattleEconomicDisplay(battle, robotId)` in `app/frontend/src/utils/battleFormatters.ts` finds the perspective participant and returns:

- `credits`: the sum of `credits` for the same stable and same team in non-FFA modes;
- `streamingRevenue`: the corresponding additive streaming total;
- `fameAwarded`: the corresponding additive fame total; and
- `prestigeAwarded`: the perspective participant's allocation once, without summing, multiplying, rounding, or recomputing it.

`koth` and `grand_melee` are Placement_Mode values. Their display instance contains one owned robot, so their economics are not merged across the stable's other FFA robots. If `participants[]` is missing, empty, or does not contain the requested robot, the helper uses the existing `winnerReward`/`loserReward` fallback and does not sum another stable's rows. `getBattleReward` remains the compatibility credit-only helper used by sorting and delegates to the shared economic display.

The credit line is `credits + streamingRevenue`, exactly once. Bye records normally carry zero streaming, fame, and prestige; the card displays the persisted bye credits without inventing other indicators.

## Battle Display_Instance expansion

`expandBattleDisplayInstances` in `app/frontend/src/utils/match-display-instances.ts` expands one raw Battle only at the presentation boundary:

- non-FFA participants owned by the same stable are grouped by `team`, so a same-side 2v2 or 3v3 produces one card and a stable-owned opposite side produces a second card;
- `koth` and `grand_melee` produce one instance per owned robot; and
- Robot Detail can retain only the instance containing its selected `robotId`.

Each instance carries `displayInstanceKey`, `perspectiveRobotId`, `perspectiveRobotIds`, and, for side-grouped records, `perspectiveTeamId`. Keys include the source Battle id and the explicit team or robot perspective, for example `battle:<id>:team:<team>` or `battle:<id>:robot:<robotId>`. A source Battle id alone is therefore never used to collapse distinct stable-owned perspectives.

`RecentBattles` and `BattleHistoryPage` pass the explicit instance perspective through `getBattlePerspective` and `getBattleEconomicDisplay` into `CompactBattleCard`. Dashboard, Battle History, and Robot Detail consequently use the same aggregation boundary.

## Upcoming Match expansion and bye subjects

`expandUpcomingMatchInstances` applies the same perspective rule to one raw `ScheduledMatch`:

- robot modes create an instance for each authenticated-stable robot side;
- `league_2v2`, `tournament_2v2`, `league_3v3`, `tournament_3v3`, and `tag_team` create one instance for each authenticated-stable team side; and
- `koth` and `grand_melee` create one instance per authenticated-stable robot in `kothParticipants`.

Instances carry a unique `displayInstanceKey`, `perspectiveRobotId`/`perspectiveRobotIds`, and, for team instances, `perspectiveTeamId`. `UpcomingMatches` uses these explicit fields rather than selecting the first side from `myUserId`.

When `isByeMatch === true`, `UpcomingMatches` routes the instance to `ByeMatchCard` before any ordinary mode card. `resolveByeCardSubject` in `app/frontend/src/components/match-cards/bye-match-data.ts` accepts the explicit perspective and returns only the real robot, team, or FFA participant. Negative-id `Bye_Placeholder` values and malformed absent subjects are never rendered as opponents. Ordinary `StandardMatchCard`, `TeamBattleMatchCard`, and `KothMatchCard` paths do not render byes.

## Bye display contract and lifecycle

All nine modes receive the same Bye_Card treatment: `league_1v1`, `tournament_1v1`, `league_2v2`, `tournament_2v2`, `league_3v3`, `tournament_3v3`, `tag_team`, `koth`, and `grand_melee`.

The additive response fields are:

- `byeRewardCredits`: the informational expected amount or the persisted awarded participant total; and
- `byeRewardStatus`: `expected` before resolution, `awarded` after a resolved Bye_Record, or legacy `pending` when the response lacks enough context.

Expected amounts are created by `getExpectedByeReward` in `app/backend/src/services/match/byeDisplayService.ts`, which delegates to `resolveByeReward` in `app/backend/src/utils/byeRewards.ts`. Awarded amounts are read from persisted `battle_participants.credits` for the authenticated stable's real robots. The frontend does not reproduce a bye formula, pay an expected amount, or infer an awarded amount from a ledger or cached quote.

`ByeMatchCard` shows the `BYE` state, the mode label, the real subject, the scheduled/resolution time, neutral `No opponent — walkover` copy, and the expected/awarded/pending reward state. Tournament name and round are shown only when the Match is a tournament Match. A bye card does not claim that combat occurred, that an opponent was fought, that the result was a draw, or that damage/playback exists. It is informational and is not made clickable merely to show a reward. Resolved bye history keeps the existing battle-detail navigation when a Battle id exists, while playback and combat statistics remain governed by the existing detail contract.

### Tournament_Bye_Lifecycle

1. Bracket generation creates the current-round tournament bye row with the real robot or team subject. It remains an Upcoming Match with `byeRewardStatus: 'expected'`; no credits, Bye_Record, or Recent Battles entry exists yet.
2. The current-round tournament processor resolves that bye through the existing no-simulation bye path exactly once. The scheduling row receives its terminal processing state and Battle link, the persisted credit award is created, and the resolved Battle becomes visible in Recent Battles with `byeRewardStatus: 'awarded'`.
3. Advancement exposes the participant's next-round Match only after the current round, including its bye, has been processed. A later-round generated bye follows the same expected-then-awarded lifecycle. Retry processing uses the scheduling row and resolved Battle link as the idempotency boundary.

History obtains the durable bye marker from `scheduled_matches_v2.is_bye_match` for unified league/team/tag/Placement_Mode rows and from `scheduled_tournament_matches.is_bye_match` for tournament rows. `battle_log` is not a permanent history source. A resolved one-sided bye may have a real `robot1`/team subject and a null opponent; it never needs a fabricated `Unknown` opponent.

## Responsive and accessible card contract

The changed cards follow the existing frontend breakpoint convention:

- below `1024px` (`lg`) cards use a stacked, wrapped layout;
- at `1024px` and above cards may use the desktop row layout; and
- supported widths start at `320px`.

Mode labels, subjects, reward values, and time text use wrapping/truncation-safe containers. The cards do not introduce horizontal scrolling. Tests exercise `320px`, `768px`, `1023px`, and `1024px`, assert that bye/reward content remains in the rendered card, and check `scrollWidth <= clientWidth`.

`CompactBattleCard` retains its existing detail action as a keyboard-operable `role="button"` with `tabIndex={0}`, Enter/Space handling, and a `min-h-[44px]` activation region. `ByeMatchCard` remains informational, but also has a minimum 44px card height. The mobile layout does not hide the only credit/reward amount.

## Documentation and convention review

The following files were reviewed against the implementation:

- `.kiro/steering/frontend-standards.md` — unchanged. Its pure-function/API-derivation guidance and existing `lg`/1024px responsive pattern already cover the new formatter and card behavior; the implementation was aligned to that convention rather than adding a new one.
- `.kiro/steering/project-overview.md` — unchanged. Spec 50 changes display shaping and tournament timing within the existing architecture; it introduces no new project structure, stack, or system boundary that belongs in the overview.
- `.kiro/steering/coding-standards.md` — unchanged. The existing shared-formula, Battle Data Architecture, Bye Reward Architecture, and frontend testing rules already cover the implementation. No additional reusable coding rule was introduced.
- `docs/guides/` — unchanged. The reviewed files there are admin, error-code, onboarding, and operations guides; none describes the player-facing Match/Battle card contract. The affected player-facing articles live under `app/backend/src/content/guide/` and were updated separately.

The league and tournament PRDs and the three affected tournament player-guide articles record the same deferred tournament-bye lifecycle and all-mode shared card treatment. No reward formula is restated or redefined in this implementation note.
