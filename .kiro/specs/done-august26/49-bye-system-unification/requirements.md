# Requirements Document

## Glossary

- **Bye_Event**: A Battle_Slot in which a robot or team holds an active Subscription, is eligible to be matched, and receives no fought battle. Covers all nine modes after this spec: the odd-entity walkover in `league_1v1`, `tag_team`, `league_2v2` and `league_3v3`, the empty bracket slot in `tournament_1v1`, `tournament_2v2` and `tournament_3v3`, and the Thin_Instance case in `koth` and `grand_melee`.
- **Bye_Record**: The set of database artefacts written when a Bye_Event resolves: one `battles` row, one `battle_participants` row per real participating robot, one `battle_summaries` row, one `audit_logs` row with `eventType: 'battle_complete'` per real participating robot, and one credit award through `awardCreditsWithLedger`. A Bye_Event that writes fewer artefacts than this is not queryable and not displayable.
- **Bye_Reward_Module**: The single shared Backend component this spec introduces. It is the only declaration of what a Bye_Event pays and what Bye_Record it writes, for every mode. Replaces the reward arithmetic currently duplicated across `leagueBattleOrchestrator.processByeBattle`, `tagTeamResultUpdater`, `teamBattleOrchestrator`, `tournamentService` and `teamTournamentBattleOrchestrator`.
- **Participation_Floor**: The unifying principle of this spec — a Bye_Event pays the participation floor of the mode it occurred in, at that mode's own scale, and nothing else. In the six Tier_Scaled_Modes that floor is the Scaled_Participation_Reward. In the three Tournament_Modes it is the Tournament_Round_Loss_Reward, which is flat rather than tier-scaled and so has no tier base to take a fraction of. Both resolutions carry the same single `× teamSize` factor, so both scale by team size in the same way: a bye pays the same *fraction* of what a fought battle in its own mode pays, rather than the same absolute credits.
- **Participation_Reward_Per_Robot**: `getParticipationReward(tier)` in `app/backend/src/utils/economyFormulas.ts:177` — Participation_Reward_Fraction of `getLeagueWinReward(tier)`, so 0.20 × tier base. Identical in all six Tier_Scaled_Modes at a given tier. This is the per-robot floor, not the amount a Bye_Event pays; `getLeagueWinReward` is a single tier table with no mode in it, and every team mode gets its higher payout from a separate `× teamSize` factor applied on top of that same table.
- **Scaled_Participation_Reward**: What a Tier_Scaled_Mode Bye_Event pays in total — `getParticipationReward(tier) × teamSize`, where `teamSize` is 1 for `league_1v1`, `koth` and `grand_melee`, 2 for `tag_team` and `league_2v2`, and 3 for `league_3v3`.
- **Participation_Reward_Fraction**: The 0.20 fraction of a tier win reward that a participation reward pays. Currently a bare inline literal at `economyFormulas.ts:178`; this spec names it as the exported constant `PARTICIPATION_REWARD_FRACTION`.
- **Tournament_Round_Loss_Reward**: The credits a losing participant is paid for a tournament round — `calculateTournamentParticipationReward(totalParticipants, currentRound, maxRounds)` in `app/backend/src/utils/tournamentRewards.ts`, which is `PARTICIPATION_PERCENTAGE` (0.30) of that round's win reward. For a team tournament the figure paid to an owner carries the mode's single `× teamSize` factor, so a team bye and a team loss in the same round are the same number.
- **Tier_Scaled_Mode**: A mode whose credit rewards derive from `getLeagueWinReward(tier)`. Six of the nine modes: `league_1v1`, `tag_team`, `league_2v2`, `league_3v3`, `koth`, `grand_melee`.
- **Tournament_Mode**: `tournament_1v1`, `tournament_2v2`, `tournament_3v3`. Credits are flat (`BASE_CREDIT_REWARD = 20000` × size multiplier × round progress) and are not tier-scaled.
- **Placement_Mode**: A mode whose result is a finishing position rather than a win or a loss: `koth` and `grand_melee`. Term established in Spec #48.
- **Placement_Matchmaker**: The two Placement_Mode matchmaking services, `app/backend/src/services/koth/kothMatchmakingService.ts` and `app/backend/src/services/grand-melee/grandMeleeMatchmakingService.ts`. Both share the same instance-skip control flow, so every requirement addressed to the Placement_Matchmaker applies to both.
- **Minimum_Field_Size**: The smallest field a Placement_Mode instance will run, declared as `MIN_GROUP_SIZE` in each Placement_Matchmaker: 5 for `koth`, 8 for `grand_melee`.
- **Thin_Instance**: A Placement_Mode tier instance whose eligible robot count at matchmaking time is below its Minimum_Field_Size. Today the whole instance is skipped with a single `logger.info` and nothing is written to any table. This is a whole-instance condition, not a per-robot remainder: when an instance does run, `groupByLPBanding` places every eligible robot into a match.
- **Team_Tournament_Reward_Distributor**: `distributeTeamTournamentRewards` in `app/backend/src/services/tournament/teamTournamentBattleOrchestrator.ts`, which pays credits, prestige and fame for a 2v2 or 3v3 tournament battle.
- **Grand_Melee_Reward_Module**: `app/backend/src/services/grand-melee/grandMeleeRewards.ts`, which computes credits, fame, prestige and `lpDelta` per Grand Melee placement.
- **Standings_Service**: `app/backend/src/services/standings/standingsService.ts`, the only writer of `standings`, including `awardGrandMeleePoints`.
- **Standing**: The existing `standings` table, the single source of truth for competitive ranking data including LP. Term established in Spec #48.
- **Battle_Slot**: One of the nine daily times at which battle events run. Term established in Spec #48; the canonical map is `docs/architecture/PRD_SERVICE_DIRECTORY.md` § Cron Schedule.
- **Booking_Office**: The existing per-robot event subscription system that gates participation in all nine events. Term established in Spec #35.
- **Subscription**: A row in the `subscriptions` table representing one robot's opt-in to one event type. Term established in Spec #35.
- **Max_Events_Per_Robot**: The cap on concurrent Subscriptions per robot, `3 + booking_office` level. Term established in Spec #35.
- **Outstanding_Match**: A match a player holds that has been booked but not yet fought — for the six unified modes a `scheduled_matches_v2` row with status `'scheduled'`, resolved by `resolveOutstandingEventsForRobots` in `app/backend/src/services/scheduling/eventScheduleScope.ts`. Term established in Spec #48.
- **Slot_Accounting**: The Booking_Office rule from Spec #35 that a robot's occupied event slots are `subscriptions ∪ Outstanding_Matches`. Unsubscribing is free, immediate and always allowed; the freed slot is not reusable until the booked match resolves.
- **Pre_Battle_Repair_Scoping**: The repair pass that charges only the robots taking part in the Battle_Slot about to run, scoped by `resolveRobotIdsForEvent`. That function is declared in `app/backend/src/services/scheduling/eventScheduleScope.ts` and consumed through `app/backend/src/services/economy/repairScope.ts`, which is the path its own test suite imports. Both paths matter: the declaration is where the tournament bye filter is removed, and `repairScope` is where the existing tests that assert the filter live.
- **Cycle_Execution_Summary**: The per-event result object each battle orchestrator returns from a cycle run, surfaced to the operator by the Admin_Cycle_Surface. `LeagueBattleExecutionSummary` carries a `byeBattles` count; `KothBattleExecutionSummary` and `GrandMeleeBattleExecutionSummary` carry no bye count at all, which is the gap Requirement 10 closes.
- **Admin_Cycle_Surface**: The Admin Portal page that displays the Cycle_Execution_Summary for a manually triggered or inspected cycle, `app/frontend/src/pages/admin/CycleControlsPage.tsx`. The only surface in this spec's scope that renders anything, and the reason the Mobile Responsiveness Requirement applies.
- **Admin_Bracket_View**: The Admin Portal tournament page, `app/frontend/src/pages/admin/TournamentsPage.tsx`, which renders bracket matches including their `isByeMatch` badge and their `battleId`. A bracket bye's `battleId` is null today and populated after this spec.
- **Player_Guide**: The in-game guide players read, served by `GuideService` from markdown files under `app/backend/src/content/guide/` with a `sections.json` manifest and `lastUpdated` frontmatter per article. A player-facing product surface, not developer documentation, which is why its accuracy is a requirement rather than only a documentation task.
- **Placement_Credit_Floor**: The credits a Placement_Mode pays its *last-place finisher* — 0.30 × tier base in `koth` and 0.50 × tier base in `grand_melee`. Distinct from Participation_Floor, which is what a Bye_Event pays. The Player_Guide currently calls the Grand Melee figure a "Participation Floor", and Requirement 11 resolves that collision.
- **Walkover_Resolution**: The single resolution shape every Bye_Event follows after this spec — detect the bye before any combat is set up, compute the reward, write the Bye_Record, and return. No simulation, no opponent, no result to override. It is `processByeBattle`'s existing shape in `leagueBattleOrchestrator`, generalised to all nine modes. Requirement 12.
- **Bye_Combat_Simulation**: The behaviour Walkover_Resolution removes. `teamBattleOrchestrator` calls `simulateTeamBattle` for a bye against fabricated opponents and then overrides the result; the tag team scheduler calls `simulateTagTeamBattle` and overrides a draw to a win. Both persist the simulated HP to the real robots.
- **Bye_Placeholder**: A fabricated, never-persisted stand-in for an absent opponent, carrying a negative `id`. Produced by `createByeRobot` in `app/backend/src/services/battle/byeRobot.ts` and wrapped for team modes by `createByeTeam` in `app/backend/src/services/matchmaking/teamMatchmakingUtils.ts`, plus per-mode factories in `teamBattleMatchmakingService.ts`, `unifiedTeamMatchmaking.ts` and `tagTeamMatchmakingService.ts`. After Walkover_Resolution a Bye_Placeholder is needed only as a scheduling sentinel, never as a combatant — which is why `tagTeamByeTeam.ts`, whose sole purpose was building a combat-ready bye team, is deleted rather than narrowed.
- **Fists_Fallback**: `getWeaponInfo` in `app/backend/src/services/battle/combat-simulator/combatFormulas.ts` returning `{ name: 'Fists', baseDamage: 10 }` when no weapon is equipped. Combined with the `!weaponLike` branch in `simulationLoop.ts`, which skips the range check entirely for an unarmed attacker, this is why a Bye_Placeholder currently deals real damage rather than standing inert.

## Introduction

A bye is what a subscribed robot gets when the schedule has nothing for it to fight. Nine modes implement that idea five different ways, and the numbers disagree by up to eighteen-fold: a `league_1v1` bye pays 0.20 × tier base, a `league_3v3` bye pays 3.60 × tier base with full prestige and full fame, a tournament bye pays nothing and writes no record at all, and `koth` and `grand_melee` have no bye concept — a thin tier on a quiet day skips the whole instance, writing no `scheduled_matches_v2` row, no `battles` row, no Standing update and no `audit_logs` row. A player who allocated a Subscription gets nothing and cannot even see that nothing happened.

This spec makes one rule out of five: **a Bye_Event pays the Participation_Floor of its mode, at that mode's own scale, and nothing else**, declared once in the Bye_Reward_Module and read by every bye path. Credits only — no prestige, no fame, no streaming revenue, in any mode. It creates byes for `koth` and `grand_melee` on a Thin_Instance, gives every Bye_Event in every mode the same queryable Bye_Record, and fixes two duplicate-declaration defects found during the audit: team tournament credits multiplied by team size twice, and the Grand Melee placement point scale declared in two places.

Five product decisions are settled and binding. The first three are about what a bye pays, and two of those are balance changes rather than tidy-ups; the fourth and fifth, covered further down, are that a bye simulates nothing and that auto-repair exempts no mode.

1. **The floor is the same fraction in every mode, not each mode's own fraction.** Every Tier_Scaled_Mode bye pays 0.20 × tier base per robot, not the 0.30 a `koth` last place pays or the 0.50 a `grand_melee` last place pays. A bye therefore pays *less per robot* than an actual last-place finish in either Placement_Mode. Turning up and fighting should beat not fighting. A `league_3v3` bye does pay more in total than a `grand_melee` last place — 0.60 × tier base against 0.50 — because it is three robots' floors against one robot's placement. That is the team-size shape of the game showing through, not a bye being overpaid, and it is not a defect.
2. **Team byes are nerfed to the participation floor at team scale — a uniform ÷6 cut.** A Tier_Scaled_Mode bye pays the Scaled_Participation_Reward: `getParticipationReward(tier) × teamSize`. `tag_team` and `league_2v2` go from 2.40 × tier base to 0.40, and `league_3v3` from 3.60 to 0.60. Because the cut is exactly the drop from `teamSize × (win reward + participation reward)` to `teamSize × participation reward`, every team mode is cut by the same factor of 6, and the team-size shape of the game is left intact — a team bye stays proportional to a team win. This is signed off, and the figures are stated in Expected Contribution rather than buried in an implementation note.
3. **No prestige and no fame for any bye, in any mode.** Team byes currently award full prestige and full fame; both go to zero. This is deliberate even though prestige gates facility levels (Spec #45).

Tournament byes do pay, overriding the audit's recommendation of zero: a tournament bye pays exactly what a loss pays for that round, through the same function and with the same team size factor, so the two figures cannot drift apart. Because tournament credits are flat rather than tier-scaled, this is the one place the Participation_Floor does not resolve to a fraction of a tier base — but the Tournament_Round_Loss_Reward already carries its own single `× teamSize` factor, so both arms of the principle scale by team size identically. The two resolutions differ only in which floor they read, not in how they scale.

It also stops a bye pretending to be a fight. A `league_2v2` or `tag_team` bye currently runs a full combat simulation against Bye_Placeholders that punch with the Fists_Fallback and are never out of range, then overrides the result and persists the damage to the real robots — so a walkover produces a repair bill, while a `league_1v1` walkover does not. Requirement 12 removes Bye_Combat_Simulation from every mode and generalises `league_1v1`'s Walkover_Resolution to all nine, which makes a drawn bye structurally impossible instead of patched, and collapses four resolution shapes into one.

This spec is mostly backend semantics: what a bye pays, when one exists, what it writes, whether anything is simulated, and how it interacts with Slot_Accounting. It carries two smaller surfaces alongside that. The Admin_Cycle_Surface cannot currently tell an operator that a Placement_Mode bye happened, because neither Placement_Mode Cycle_Execution_Summary counts byes — so creating byes in `koth` and `grand_melee` without also counting them would make a new event type invisible in the one place operators watch cycles from (Requirement 10). And the Player_Guide tells players, in six places, things about byes that this spec makes false — including one whole article whose argument is that byes pay nothing (Requirement 11). A balance change that leaves the in-game explanation contradicting the behaviour is not finished.

Player-facing *battle display* remains Spec 50's. The Admin Portal is not in Spec 50's scope, and this spec does not touch Dashboard, Robot Detail or Battle History.

## Expected Contribution

1. **Bye reward arithmetic collapses from five call sites to one declaration.** Today `processByeBattle` calls `getParticipationReward`, `tagTeamResultUpdater` calls `calculateTagTeamRewards`, `teamBattleOrchestrator` calls `calculateTeamBattleReward`, and the two tournament services pay nothing at all — four behaviours, none of them aware of the others, nothing enforcing agreement. This is the same defect class as the repair-formula duplication that Spec #48 collapsed into `calculateRepairQuote` (see the coding-standards steering file). After: one Bye_Reward_Module read by six call sites, one per orchestrator, each supplying only the identity of the queued match; and Participation_Reward_Fraction promoted from a bare `0.2` literal at `economyFormulas.ts:178` to a named exported constant.

2. **Team bye payouts drop to the participation floor at team scale — a signed-off, uniform ÷6 cut.** Credits paid to the stable for one bye:

   | Mode | `teamSize` | Before (bronze) | After (bronze) | Before (champion) | After (champion) | Factor |
   |---|---|---|---|---|---|---|
   | `league_1v1` | 1 | 1,500 | 1,500 | 45,000 | 45,000 | unchanged |
   | `tag_team` | 2 | 18,000 | 3,000 | 540,000 | 90,000 | ÷6 |
   | `league_2v2` | 2 | 18,000 | 3,000 | 540,000 | 90,000 | ÷6 |
   | `league_3v3` | 3 | 27,000 | 4,500 | 810,000 | 135,000 | ÷6 |
   | `koth`, `grand_melee` | 1 | nothing written | 1,500 | nothing written | 45,000 | new |
   | `tournament_1v1/2v2/3v3` | 1 / 2 / 3 | 0 | round loss reward × `teamSize` | 0 | round loss reward × `teamSize` | new |

   The factor is the same 6 in all three team modes because the cut is exactly the drop from `teamSize × (win reward + participation reward)` to `teamSize × participation reward`, and `teamSize` cancels: at bronze, `2 × (7,500 + 1,500) = 18,000` against `2 × 1,500 = 3,000`, and `3 × (7,500 + 1,500) = 27,000` against `3 × 1,500 = 4,500`. The nerf changes what a bye is worth relative to a win; it does not change what a 3v3 is worth relative to a 2v2.

3. **Bye prestige and fame go to zero everywhere.** A bronze `tag_team` bye currently awards 8 prestige to the stable (`5 × 1.6`) and base fame to each robot; a champion `tag_team` bye awards 120 prestige. A `league_2v2` or `league_3v3` bye awards full `PRESTIGE_BY_LEAGUE` (5 bronze, 75 champion) and full `FAME_BY_LEAGUE` per robot (2 bronze, 40 champion). After: 0 prestige and 0 fame for every bye in every mode. Streaming revenue is already 0 for byes via the `isByeMatch` early return at `battlePostCombat.ts:80` and stays that way.

4. **Every bye becomes queryable and displayable.** Bye_Record coverage today versus after:

   | Artefact | Before | After |
   |---|---|---|
   | `battles` row | 4 of 9 modes | 9 of 9 |
   | `battle_summaries` row | 3 of 9 (`league_1v1` bye writes none) | 9 of 9 |
   | `audit_logs` `battle_complete` row | 2 of 9 (`league_1v1` and `tag_team` byes write none) | 9 of 9 |
   | `scheduled_matches_v2` row for a Thin_Instance | 0 rows — nothing written anywhere | one row per byed robot |

5. **Team tournament credit overpayment removed.** `teamTournamentBattleOrchestrator.ts:737-744` multiplies by `teamSize` twice on both sides of the match, so an owner is paid `base × teamSize²`. For a round-1 win in a 16-team 3v3 tournament the winning owner receives 49,590 credits instead of 16,530, and the losing owner 14,877 instead of 4,959. After: `× teamSize` once, and per-robot `battle_participants.credits` that sum to the amount the owner was actually paid.

6. **The Grand Melee placement point scale goes from two declarations to one.** `GRAND_MELEE_LP_SCALE` (`grandMeleeRewards.ts:23`) only fills the result object's `lpDelta`; the value actually written to `standings.leaguePoints` comes from `GRAND_MELEE_POINT_SCALE` (`standingsService.ts:344`). Same ten numbers, two declarations, no test tying them together. After: one declaration, one import, and a test asserting the computed `lpDelta` equals the persisted LP for every placement.

7. **A Placement_Mode bye becomes visible to an operator instead of masquerading as a fought match.** Bye counts on each Cycle_Execution_Summary today versus after:

   | Summary | Bye count today | After |
   |---|---|---|
   | `LeagueBattleExecutionSummary` | `byeBattles`, incremented at `leagueBattleOrchestrator.ts:938` | unchanged |
   | `KothBattleExecutionSummary` | none — a bye would increment only `successfulMatches` | `byeMatches` |
   | `GrandMeleeBattleExecutionSummary` | none — same | `byeMatches` |
   | Tournament execution result | none, and byes pay nothing so there is nothing to report | count of bracket byes resolved and paid |

   Without this, the spec's own new event type is untraceable: an operator reading "12 successful KotH matches" on the Admin_Cycle_Surface would have no way to know four of them ran no combat, and the figure that tells them so is the one this spec makes non-zero for the first time.

8. **Player_Guide bye claims go from six wrong and three missing to zero.** Verified article by article:

   | State | Today | After |
   |---|---|---|
   | Articles asserting a bye pays nothing | 2 (`tournaments/bye-matches.md`, `tournaments/rewards.md`) | 0 |
   | Articles asserting a bye pays full or win-equivalent rewards | 1 (`leagues/matchmaking.md`) | 0 |
   | Articles misstating the team bye reward | 1 (`team-battles/overview.md`, "reduced rewards" where today it is full) | 0 |
   | Articles asserting a thin instance produces no match | 2 (`king-of-the-hill/entry-requirements.md`, `grand-melee/entry-requirements.md`) | 0 |
   | Articles stating the participation reward as 30% while their own table shows 20% | 2 (`economy/battle-rewards.md`, `leagues/league-tiers.md`) | 0 |
   | Articles that should cover byes and do not | 3 (`economy/battle-rewards.md`, `facilities/booking-office.md`, `team-battles/tag-team.md`) | 0 |

   Two of these are wrong *today*, not merely wrong after: `leagues/matchmaking.md:111` promises "full rewards" for a `league_1v1` bye that has always paid 0.20 × tier base, and `team-battles/overview.md:129` promises "reduced rewards" for a team bye that currently pays full. The Player_Guide has been wrong in both directions simultaneously, which is what happens when nothing ties player-facing text to a single declaration.

9. **A bye stops damaging the player's robots, and four resolution shapes collapse into one.** A team or tag team bye currently runs a full combat simulation against Bye_Placeholders that attack with the Fists_Fallback — 10 base damage, and the `!weaponLike` branch means they are never out of range — then persists the resulting HP to the real robots through `updateRobotCombatStats`. A walkover therefore produces a repair bill, while a `league_1v1` walkover does not. Before and after:

   | Mode | Simulates today | Real robot HP today | After |
   |---|---|---|---|
   | `league_1v1` | No | Untouched | Unchanged |
   | `tag_team` | Yes, 2 Bye_Placeholders, draw overridden to a win | Damaged, repair bill follows | No simulation, HP untouched |
   | `league_2v2` | Yes, 2 Bye_Placeholders, result overridden | Damaged, repair bill follows | No simulation, HP untouched |
   | `league_3v3` | Yes, 3 Bye_Placeholders, result overridden | Damaged, repair bill follows | No simulation, HP untouched |
   | `tournament_1v1/2v2/3v3` | Nothing runs at all | N/A | No simulation, HP untouched |
   | `koth`, `grand_melee` | No bye exists | N/A | No simulation, HP untouched |

   Two whole mechanisms disappear rather than being kept correct: the result-override blocks that exist only to correct a simulation that should not have run, and the possibility of a bye drawing. A draw becomes structurally impossible instead of being patched after the fact. Resolution shapes go from four (no-simulation early return, simulate-and-override, simulate-and-override-a-draw, nothing at all) to one Walkover_Resolution. The `battles` row gains a single birthplace, which removes the need for the writer to accept a pre-existing battle id.

   This is partly a **buff that offsets the Expected Contribution 2 nerf** and the two must be read together: team byes lose 5/6 of their credits and simultaneously stop costing repair credits. It is also a defect fix, not only a simplification — billing a player to repair damage from a battle that never happened is not defensible at any reward level, and least of all at a reward capped to what a loss pays.

### Verification Criteria

Run after the final task is marked done. Recursive greps over `app/` follow the `app/backend/src/shared` symlink on macOS and not in CI, so pass `--exclude-dir=shared` where a check counts matches.

1. **One participation fraction declaration**: `rg -n "PARTICIPATION_REWARD_FRACTION\s*=" app/backend/src app/shared` returns exactly one line, in `economyFormulas.ts`; and `rg -n "\* 0\.2\b" app/backend/src/utils/economyFormulas.ts` returns no lines.
2. **One bye reward declaration**: `rg -ln "byeReward|resolveByeReward" app/backend/src` lists the Bye_Reward_Module plus its six call sites only; and no bye path calls `calculateTagTeamRewards`, `calculateTeamBattleReward`, `calculateTagTeamPrestige`, `calculateTeamBattlePrestige`, `calculateTeamBattleFame` or `calculateTagTeamFame` — verified by `rg -n` on each of those six symbols showing only fought-battle call sites.
3. **No second Grand Melee point scale**: `rg -n "GRAND_MELEE_POINT_SCALE" app/backend/src --exclude-dir=shared` returns no lines, and `rg -n "GRAND_MELEE_LP_SCALE\s*:" app/backend/src` returns exactly one declaration.
4. **No double team-size multiplication**: `rg -n "CreditPerRobot \* teamSize" app/backend/src` returns no lines.
5. **Zero prestige and zero fame on every bye**: a property test over all nine mode identifiers asserts the Bye_Reward_Module returns `prestige === 0`, `fame === 0` and `streamingRevenue === 0` for every mode and every tier, and `credits > 0`.
6. **Per-robot floor agreement across the six tier-scaled modes**: a property test asserts that for every tier, the Bye_Reward_Module's credit figure divided by that mode's `teamSize` is the identical Participation_Reward_Per_Robot for `league_1v1`, `tag_team`, `league_2v2`, `league_3v3`, `koth` and `grand_melee`; that the total returned equals `getParticipationReward(tier) × teamSize` exactly for each of the six modes; and that the per-robot figure is strictly less than the per-robot last-place credit figure from `calculateKothRewards` and `calculateGrandMeleeRewards` at the same tier.
7. **Tournament bye equals tournament loss**: a property test asserts that for every `(totalParticipants, currentRound, maxRounds)` triple and every team size, the Bye_Reward_Module credit figure equals the figure the losing owner is paid by the Team_Tournament_Reward_Distributor for the same round. This composes with check 6 rather than contradicting it: both the Tier_Scaled_Mode and Tournament_Mode arms carry exactly one `× teamSize` factor, so the same property shape holds on both sides.
8. **Thin_Instance writes rows**: an integration test seeds a `koth` instance with 4 eligible robots and a `grand_melee` instance with 7, runs matchmaking, and asserts `SELECT count(*) FROM scheduled_matches_v2 WHERE match_type IN ('koth','grand_melee') AND is_bye_match = true` equals 11, with one participant row each, and that resolution writes the full Bye_Record for each.
9. **Slot_Accounting unchanged and exploit-closed**: a test asserts `resolveOutstandingEventsForRobots` reports the event type for a robot holding an unresolved `koth` bye with no bye-specific branch in the query, that a subscribe request that would exceed Max_Events_Per_Robot counting a bye-held slot is refused, and that a robot which unsubscribes and re-subscribes elsewhere within one cycle receives at most one Bye_Event credit award.
10. **Both Placement_Mode summaries expose a bye count**: `rg -n "byeMatches" app/backend/src/services/koth/kothBattleOrchestrator.ts app/backend/src/services/grand-melee/grandMeleeBattleOrchestrator.ts` returns a declaration and an increment in each file; and a unit test asserts that resolving a Thin_Instance bye increments `byeMatches` and does not increment `successfulMatches` alone.
11. **The Admin_Cycle_Surface renders every bye count**: a frontend test asserts the panel displays the league `byeBattles` figure and the new `byeMatches` figures for `koth` and `grand_melee`, and the tournament bracket-bye count, for a summary payload containing all four.
12. **No Player_Guide article claims a bye pays nothing**: `rg -in "bye" app/backend/src/content/guide -A2 -B2 | rg -i "no rewards|earn nothing|zero credits"` returns no lines.
13. **No Player_Guide article claims a bye pays full rewards**: `rg -in "full rewards|as if it won" app/backend/src/content/guide` returns no lines.
14. **No Player_Guide article states the participation reward as 30%**: `rg -n "30% of the tier" app/backend/src/content/guide` returns no lines, and `rg -n "20%" app/backend/src/content/guide/economy/battle-rewards.md app/backend/src/content/guide/leagues/league-tiers.md` returns a match in each.
15. **Neither Placement_Mode entry-requirement article still claims nothing happens**: `rg -n "no match is created|no matches are created" app/backend/src/content/guide` returns no lines.
16. **The Participation_Floor naming collision is resolved**: `rg -n "Participation Floor" app/backend/src/content/guide` returns at most one section heading, and the article containing it states the figure it means and links to the other concept.
17. **Every Player_Guide article touched has a bumped `lastUpdated`**: `git diff --stat app/backend/src/content/guide` lists exactly the articles named in Requirement 11, and `git diff app/backend/src/content/guide | rg "^\+lastUpdated"` shows one bumped line per listed article.
18. **Guide content tests pass**: `cd app/backend && pnpm run test:unit -- guide` passes, including the existing content-existence and link-integrity checks in `src/__tests__/guide/guide-service.test.ts`, so no rewritten article breaks an internal `/guide/...` cross-link.
19. **No bye path reaches a combat simulator**: `rg -n "simulateTeamBattle|simulateTagTeamBattle|simulateBattleMulti|simulateBattleWrapper" app/backend/src/services` shows every call site sitting after a bye early-return, and no call is reachable when `isByeMatch` is true. Asserted behaviourally by a test that spies the simulator and resolves a bye in each of the nine modes, expecting zero calls.
20. **A bye leaves every participating robot's HP untouched**: an integration test records `currentHP` for every robot on the real side before resolving a bye in each of the nine modes and asserts the value is byte-identical afterwards, and that no `audit_logs` row with `eventType: 'robot_repair'` is attributable to the bye's cycle for those robots.
21. **A bye can never be a draw**: `rg -n "isDraw = false|isDraw: false" app/backend/src/services/tag-team app/backend/src/services/team-battle` returns no line whose purpose is correcting a bye result, and an integration test asserts that a resolved bye in each of the nine modes records the real entity as winner with `isDraw` false — the guarantee coming from the absence of a simulated result rather than from a corrective assignment.
22. **The writer accepts no pre-existing battle id**: `rg -n "existingBattleId" app/backend/src` returns no lines, confirming every mode's bye `battles` row is born in one place.
23. **One summary and participant shape across all nine modes**: an integration test asserts that a resolved bye in each of the nine modes produces `battle_summaries.hasData === false` and `totalEvents === 0`, and `battle_participants` rows carrying `damageDealt` 0, `damageTaken` 0, `destroyed` false, `yielded` false and `finalHP` equal to the robot's pre-Bye_Event `currentHP`. This is the check that would have caught the two modes producing real combat data while the other seven produced none.
24. **Auto-repair exempts no mode**: `rg -n "isByeMatch" app/backend/src/services/scheduling/eventScheduleScope.ts` returns no line filtering byes out of repair scoping; `rg -n "isByeMatch" app/backend/tests/services/economy/repairScope.test.ts` returns no line asserting the filter; and an integration test asserts `resolveRobotIdsForEvent` includes a byed robot for all nine event types, tournaments included. The second grep matters because `repairScope.test.ts` currently asserts `isByeMatch: false` in the expected where clause, so the code change alone would leave a red suite.
25. **One bye resolution entry point, no duplicated adapter**: `rg -n "resolvePlacementModeBye|resolveTeamLeagueBye" app/backend/src` returns no lines, and `rg -c "resolveByeEvent" app/backend/src/services` shows exactly six call sites outside the bye module itself.
26. **Dead bye code is deleted, not left unreachable**: `app/backend/src/services/tag-team/tagTeamByeTeam.ts` no longer exists; `rg -n "createByeTeamForBattle" app/backend/src` returns no lines; and `rg -n "isByeMatch" app/backend/src/services/tag-team/tagTeamResultUpdater.ts` returns no lines, confirming the updater's bye branch is gone rather than orphaned.
27. **Every existing test that asserted the old behaviour has been updated, not silenced**: `rg -n "Simulation should still be called" app/backend/tests` returns no lines; `rg -n "still award full winner reward" app/backend/tests` returns no lines; no `testPathIgnorePatterns` entry was added by this spec; and `git diff --stat app/backend/tests` lists exactly the six files named in the design's "Existing tests that must change" table. A suite made green by exclusion rather than by correction fails this check.
28. **No test asserts a formula against a copy of that formula**: `rg -n "Mirrors the orchestrator's reward arithmetic" app/backend/tests` returns no lines, confirming `tagTeamBattleOrchestrator.property.test.ts` imports the real reward functions rather than re-declaring them.
29. **Suites green**: `cd app/backend && pnpm run test:unit`, `pnpm run test:integration` and `pnpm run typecheck:tests` all pass, and `cd app/frontend && pnpm run test:ci` passes.

## Scope Boundary and Non-Goals

- **Spec 50 owns player-facing battle display; this spec owns the Admin Portal.** `.kiro/specs/to-do/50-battle-card-reward-display/` owns what the three player-facing surfaces show — Dashboard, Robot Detail matches tab and Battle History — including bye visibility and the stable-total reward fix. This spec owns backend reward semantics, whether anything is simulated, bye row creation, Slot_Accounting and repair scoping, the two defects, the Admin_Cycle_Surface and Admin_Bracket_View, and the Player_Guide. The two do not overlap: the admin surfaces are in neither Spec 50's scope nor its file list, and nothing here touches a player-facing React component. Spec 50 depends on this spec only for bye rows existing in `koth` and `grand_melee` and for the Bye_Record being complete; its stable-total fix is wrong today regardless of byes and is not blocked by this balance change.
- **LP is unchanged where it already exists.** The four league modes award +3 LP for a bye today and continue to; tournament byes leave LP untouched and continue to. LP is specified here only for `koth` and `grand_melee` byes, which have no existing behaviour to preserve — and a Placement_Mode bye writes no LP at all, because crediting a full-field placement score for a match that never ran would read as a win the robot did not earn (Requirement 4 criteria 7 and 8).
- **No new Slot_Accounting rule.** Requirement 7 criteria 1 through 6 state existing behaviour explicitly so it is not re-litigated. Nothing in this spec changes how slots are counted or when unsubscribing is allowed. Pre_Battle_Repair_Scoping *does* change, in one direction only: criterion 8 removes the tournament exemption so auto-repair covers a bye in all nine modes. That is a scoping change, not a Slot_Accounting change — the two live in the same module and must not be conflated.
- **The duplicate tier tables inside `tagTeamRewards.ts`** (local copies of `PRESTIGE_BY_LEAGUE` and `FAME_BY_LEAGUE`) are out of scope. They are the same defect class, but they feed win rewards, and bye prestige and fame become zero regardless of which copy is read.
- **Mobile responsiveness applies, narrowly.** Requirement 10 adds fields to the existing Admin_Cycle_Surface panel and touches the Admin_Bracket_View, so the Mobile Responsiveness Requirement in the spec-quality-standards steering file is in force. It applies to those two admin surfaces only, and the bar is not breaking their existing responsive layout rather than designing a new one — no new page and no new component is introduced. Criteria are on Requirement 10.
- **`team-battles/overview.md:194` saying "With 6 total events available"** when there are nine is out of scope. It is stale and player-facing, but it is a Booking_Office count error unrelated to byes, and fixing it here would widen the spec for no gain in bye correctness. Flagged for a future spec.

## Requirements

### Requirement 1: One declaration of what a bye pays

**User Story:** As a developer, I want the bye reward declared in exactly one place, so that nine modes cannot drift into nine different answers.

#### Acceptance Criteria

1. THE Bye_Reward_Module SHALL be the only declaration in the Backend of the credit, prestige, fame and streaming revenue amounts a Bye_Event pays.
2. WHEN a Bye_Event resolves in any of the nine Battle_Slots, THE Bye_Reward_Module SHALL supply all four reward amounts for that Bye_Event.
3. THE Bye_Reward_Module SHALL obtain Participation_Reward_Per_Robot by calling `getParticipationReward`, and SHALL obtain the Tournament_Round_Loss_Reward by calling `calculateTournamentParticipationReward`, rather than restating either formula.
4. THE `economyFormulas` module SHALL declare Participation_Reward_Fraction as the exported constant `PARTICIPATION_REWARD_FRACTION` with the value 0.2, and `getParticipationReward` SHALL read that constant.
5. THE six bye resolution call sites — the bye branches of `leagueBattleOrchestrator`, `teamBattleOrchestrator`, `tagTeamScheduler`, `kothBattleOrchestrator` and `grandMeleeBattleOrchestrator`, plus `tournamentService.completeByeMatch` for the three Tournament_Modes and the admin bulk-cycle path — SHALL each obtain every bye reward figure from the Bye_Reward_Module and SHALL hold no bye reward logic of their own.
6. THE Bye_Reward_Module SHALL accept the mode identifier as an input and SHALL return a defined reward for each of the nine mode identifiers, so that adding a tenth mode without declaring its bye reward fails to compile.

### Requirement 2: A bye pays the participation floor of its mode

**User Story:** As a player, I want a bye to pay the same thing wherever it happens, so that I can reason about what a Subscription is worth.

#### Acceptance Criteria

1. WHERE a Bye_Event occurs in a Tier_Scaled_Mode, THE Bye_Reward_Module SHALL pay the Scaled_Participation_Reward for the entity's tier, which is `getParticipationReward(tier) × teamSize`.
2. THE Bye_Reward_Module SHALL use the same Participation_Reward_Per_Robot figure for `league_1v1`, `tag_team`, `league_2v2`, `league_3v3`, `koth` and `grand_melee` at a given tier, and SHALL apply that mode's `teamSize` as the only multiplier on top of it.
3. THE Bye_Reward_Module SHALL pay a Tier_Scaled_Mode Bye_Event strictly fewer credits per robot than the last-place finish in `koth` pays per robot at the same tier, and strictly fewer credits per robot than the last-place finish in `grand_melee` pays per robot at the same tier, both Placement_Modes having a `teamSize` of 1.
4. THE Bye_Reward_Module SHALL pay a credit amount greater than zero for every Bye_Event, in every mode and at every tier, because holding a Battle_Slot always pays something.
5. WHERE a Bye_Event occurs in a Tournament_Mode, THE Bye_Reward_Module SHALL pay the Tournament_Round_Loss_Reward for the round in which the Bye_Event occurred.
6. THE Bye_Reward_Module SHALL derive the Tournament_Round_Loss_Reward from the same `totalParticipants`, `currentRound` and `maxRounds` values, through the same function, and with the same team size factor that the losing-participant path applies for that round.
7. WHERE a Bye_Event occurs in `tournament_2v2` or `tournament_3v3`, THE Bye_Reward_Module SHALL pay the owner the same total the Team_Tournament_Reward_Distributor pays a losing owner for that round.

### Requirement 3: Team byes are reduced to the participation floor at team scale

**User Story:** As a product owner, I want a team walkover to stop paying like a team win, so that byes are not the most profitable outcome in the game.

#### Acceptance Criteria

1. WHEN a `tag_team` Bye_Event resolves, THE Bye_Reward_Module SHALL pay the real team's stable `getParticipationReward(tier) × 2` for the team's tier, in place of the `2 × (win reward + participation reward)` amount `calculateTagTeamRewards` returns today.
2. WHEN a `league_2v2` Bye_Event resolves, THE Bye_Reward_Module SHALL pay the real team's stable `getParticipationReward(tier) × 2` for the team's tier, in place of the `2 × (win reward + participation reward)` amount `calculateTeamBattleReward` returns today.
3. WHEN a `league_3v3` Bye_Event resolves, THE Bye_Reward_Module SHALL pay the real team's stable `getParticipationReward(tier) × 3` for the team's tier, in place of the `3 × (win reward + participation reward)` amount `calculateTeamBattleReward` returns today.
4. WHERE a Bye_Event occurs in `tag_team`, `league_2v2` or `league_3v3`, THE Bye_Reward_Module SHALL apply the mode's `teamSize` factor to Participation_Reward_Per_Robot exactly once, so a `league_3v3` bye pays 1.5 times what a `league_2v2` bye pays at the same tier.
5. THE Bye_Reward_Module SHALL write per-robot `battle_participants.credits` values that sum exactly to the credit amount awarded to the stable for that Bye_Event.
6. WHERE the credit amount for a team Bye_Event does not divide evenly among the team's robots, THE Bye_Reward_Module SHALL distribute the remainder one credit at a time so that the per-robot values still sum exactly to the amount awarded, following the existing `distributeTeamCredits` rule.

### Requirement 4: A bye pays credits and nothing else

**User Story:** As a product owner, I want a bye to award no prestige and no fame in any mode, so that progression is earned by fighting.

#### Acceptance Criteria

1. WHEN a Bye_Event resolves in any mode, THE Bye_Reward_Module SHALL award zero prestige to the stable.
2. WHEN a Bye_Event resolves in any mode, THE Bye_Reward_Module SHALL award zero fame to every participating robot.
3. WHEN a Bye_Event resolves in any mode, THE Bye_Reward_Module SHALL award zero streaming revenue, preserving the existing early return in `awardStreamingRevenueForParticipant` when `isByeMatch` is true.
4. THE Bye_Reward_Module SHALL write `prestigeAwarded` as 0 and `fameAwarded` as 0 on every `battle_participants` row it creates.
5. WHEN a `league_1v1`, `tag_team`, `league_2v2` or `league_3v3` Bye_Event resolves, THE Bye_Reward_Module SHALL apply the same LP delta that mode applies to a bye today, leaving league bye LP behaviour unchanged.
6. WHEN a Bye_Event resolves in a Tournament_Mode, THE Bye_Reward_Module SHALL leave Standing unchanged, as tournament byes do today.
7. WHERE a Bye_Event occurs in a Placement_Mode, THE Bye_Reward_Module SHALL write no LP change, no placement and no `totalMatches` increment to Standing, so a match that never ran cannot register as a finishing position.
8. WHERE a Bye_Event occurs in a Placement_Mode, THE Bye_Reward_Module SHALL leave `robots.elo` unchanged, because a Thin_Instance bye has no opponent to rate against.

### Requirement 5: Every bye leaves the same trail

**User Story:** As a player, I want a bye to appear in my history, so that I can see what my Subscription produced on a quiet day.

#### Acceptance Criteria

1. WHEN a Bye_Event resolves in any mode, THE Bye_Reward_Module SHALL write exactly one `battles` row whose `battleLog` carries `isByeMatch: true`.
2. THE Bye_Reward_Module SHALL write one `battle_participants` row per real participating robot and no row for a placeholder bye robot, which is identified by a negative `id` from `createByeRobot`.
3. THE Bye_Reward_Module SHALL write one `battle_summaries` row for every Bye_Event by calling `computeBattleSummary`, including for `league_1v1` byes, which write none today.
4. THE Bye_Reward_Module SHALL write one `audit_logs` row with `eventType: 'battle_complete'` per real participating robot, carrying `isByeMatch: true` and the credits paid, including for `league_1v1` and `tag_team` byes, which write none today.
5. THE Bye_Reward_Module SHALL award bye credits through `awardCreditsWithLedger` with the `battle_income` event type and the current cycle number.
6. WHEN a Bye_Event resolves in a Tournament_Mode, THE Bye_Reward_Module SHALL write the same `battles`, `battle_participants`, `battle_summaries` and `audit_logs` rows, with the same columns populated, that it writes for a Tier_Scaled_Mode Bye_Event.
7. WHEN a Bye_Event resolves for a mode whose queued match lives in `scheduled_matches_v2`, THE Bye_Reward_Module SHALL set that row's status to `'completed'` and SHALL set its `battleId` to the `battles` row it created.
8. IF writing the `battle_summaries` row fails, THEN THE Bye_Reward_Module SHALL complete the Bye_Event, log the failure and pay the credits, so that a summary failure cannot cost a player a reward.

### Requirement 6: KotH and Grand Melee byes for a thin instance

**User Story:** As a player with a KotH subscription in a thin tier, I want a record and a reward when my instance is too small to run, so that a quiet day is not silently nothing.

#### Acceptance Criteria

1. WHILE a Placement_Mode instance is a Thin_Instance at matchmaking time, THE Placement_Matchmaker SHALL create one Bye_Event for each eligible robot in that instance, in place of skipping the instance with only a log line.
2. THE Placement_Matchmaker SHALL create a Bye_Event only for a robot that passes every existing eligibility gate for that instance: a Standing in the instance, `checkSchedulingReadiness` returning ready, an active Subscription for the mode, and no existing scheduled match for the mode.
3. IF a Thin_Instance has zero eligible robots, THEN THE Placement_Matchmaker SHALL create no Bye_Event for that instance.
4. WHERE an instance has at least Minimum_Field_Size eligible robots, THE Placement_Matchmaker SHALL place every eligible robot into a scheduled match that is fought and SHALL create no Bye_Event, because `groupByLPBanding` consumes the whole sorted pool rather than discarding a remainder.
5. THE Placement_Matchmaker SHALL record each Placement_Mode Bye_Event as one `scheduled_matches_v2` row with `matchType` `'koth'` or `'grand_melee'`, `isByeMatch` true, the instance's `leagueType` and `leagueInstanceId`, and one `scheduled_match_participants` row for the byed robot.
6. THE Placement_Matchmaker SHALL log each Thin_Instance with the instance identifier, the eligible robot count, the Minimum_Field_Size and the number of Bye_Events created.

### Requirement 7: Slot behaviour is unchanged and auto-repair covers every bye

**User Story:** As a player, I want the slot rules to stay as they are and a bye to be prepared like any other match, so that a bye behaves like the booked match it is.

#### Acceptance Criteria

1. THE Booking_Office SHALL derive Slot_Accounting as `subscriptions ∪ Outstanding_Matches` through the existing `resolveOutstandingEventsForRobots`, with no bye-specific branch, so a Placement_Mode bye row holds its slot as soon as Requirement 6 creates it.
2. WHILE a robot holds a Bye_Event whose `scheduled_matches_v2` row status is `'scheduled'`, THE Booking_Office SHALL count that event type toward the robot's Max_Events_Per_Robot.
3. IF a subscribe request would take a robot's occupied slot count above Max_Events_Per_Robot when Bye_Event slots are counted, THEN THE Booking_Office SHALL refuse the request.
4. THE Booking_Office SHALL allow a player to unsubscribe a robot from any event type at any time, free of charge and with immediate effect.
5. WHEN a robot unsubscribes from an event type for which it holds an unresolved Bye_Event, THE Booking_Office SHALL keep that slot occupied until the Bye_Event resolves.
6. THE Bye_Reward_Module SHALL pay at most one Bye_Event credit award per robot per Battle_Slot per cycle, so that unsubscribing and re-subscribing within one cycle cannot collect two rewards from one slot.
7. WHEN Pre_Battle_Repair_Scoping runs for a Battle_Slot, THE Pre_Battle_Repair_Scoping SHALL include a robot holding a Bye_Event for that slot, in all nine modes, because a Bye_Event is a scheduled match that is resolved differently rather than a match that does not exist.
8. THE Pre_Battle_Repair_Scoping SHALL apply the same rule to a Tournament_Mode Bye_Event as to every other mode, and the `isByeMatch: false` filter in `resolveTournamentParticipants` SHALL be removed, so that no mode exempts a byed robot from auto-repair.

### Requirement 8: Team tournament credits are multiplied by team size once

**User Story:** As a product owner, I want team tournament credits paid at the intended rate, so that a 3v3 tournament does not pay nine times a solo round.

#### Acceptance Criteria

1. WHEN the Team_Tournament_Reward_Distributor awards credits to a winning owner, THE Team_Tournament_Reward_Distributor SHALL award `calculateTournamentWinReward(totalParticipants, currentRound, maxRounds) × teamSize` in total.
2. WHEN the Team_Tournament_Reward_Distributor awards credits to a losing owner, THE Team_Tournament_Reward_Distributor SHALL award `calculateTournamentParticipationReward(totalParticipants, currentRound, maxRounds) × teamSize` in total.
3. THE Team_Tournament_Reward_Distributor SHALL write per-robot `battle_participants.credits` as an equal share of the total awarded for that side, with any remainder distributed one credit at a time so the per-robot values sum to that total.
4. THE Team_Tournament_Reward_Distributor SHALL write `battles.winnerReward` and `battles.loserReward` as the per-owner totals from criteria 1 and 2.
5. THE Team_Tournament_Reward_Distributor SHALL apply the `teamSize` factor to a credit amount exactly once along each of the winner and loser paths.

### Requirement 9: One declaration of the Grand Melee placement point scale

**User Story:** As a developer, I want the Grand Melee point scale declared once, so that the LP a player is shown and the LP a player is given cannot diverge.

#### Acceptance Criteria

1. THE Grand_Melee_Reward_Module SHALL declare `GRAND_MELEE_LP_SCALE` as the only placement point scale for `grand_melee`.
2. THE Standings_Service SHALL read `GRAND_MELEE_LP_SCALE` from the Grand_Melee_Reward_Module when writing `standings.leaguePoints` for a Grand Melee placement, and SHALL declare no scale of its own.
3. WHEN `calculateGrandMeleeRewards` returns an `lpDelta` for a placement, THE Standings_Service SHALL write that same value to `standings.leaguePoints` for that placement.
4. WHERE a placement is greater than the length of `GRAND_MELEE_LP_SCALE`, THE Standings_Service SHALL write an LP delta of 0.

### Requirement 10: The admin cycle summary distinguishes a bye from a fought match

**User Story:** As an operator, I want a cycle summary to tell me how many byes ran, so that a Bye_Event is traceable rather than counted as a battle that was fought.

#### Acceptance Criteria

1. THE `KothBattleExecutionSummary` and `GrandMeleeBattleExecutionSummary` interfaces SHALL each declare a bye count field named `byeMatches`, matching the intent of the `byeBattles` field `LeagueBattleExecutionSummary` already declares.
2. WHEN a Placement_Mode Bye_Event resolves during a cycle run, THE Placement_Mode orchestrator SHALL increment `byeMatches` for that run.
3. THE Placement_Mode orchestrator SHALL count a resolved Bye_Event in `totalMatches` and in `byeMatches`, and SHALL NOT count it in `successfulMatches`, so that `successfulMatches` continues to mean matches in which combat was simulated.
4. THE Placement_Mode orchestrator SHALL count the byed robot in `totalRobotsInvolved`, because the robot held a Battle_Slot and was paid for it.
5. THE tournament execution result SHALL report the number of bracket Bye_Events resolved and paid during that run.
6. THE Placement_Mode orchestrator SHALL include the `byeMatches` figure in the completion log line it already emits for a run.
7. THE Admin_Cycle_Surface SHALL display the bye count for each event type that reports one — the league `byeBattles`, the `koth` and `grand_melee` `byeMatches`, and the tournament bracket-bye count.
8. WHERE a Cycle_Execution_Summary omits a bye count, THE Admin_Cycle_Surface SHALL render the remainder of that summary without error, so an older or partial payload does not break the panel.
9. THE admin bulk-cycle path SHALL resolve and pay a bracket Bye_Event identically to the scheduled cron path, so that the two cannot pay different amounts for the same bye.
10. WHERE a bracket Bye_Event carries a populated `battleId`, THE Admin_Bracket_View SHALL offer the same battle link it offers a fought match, so that a bye battle record is reachable from the bracket it belongs to.
11. THE Admin_Cycle_Surface SHALL render the added bye counts without horizontal overflow at viewport widths from 320px upward, following the responsive patterns in `.kiro/steering/frontend-standards.md`.
12. WHERE the viewport is narrower than 1024px, THE Admin_Cycle_Surface SHALL keep the added bye counts legible in the existing panel layout rather than introducing a new breakpoint or a horizontal scroll region.
13. WHERE the Admin_Bracket_View adds an interactive battle link for a bye, THE Admin_Bracket_View SHALL give it a touch target of at least 44px.

### Requirement 11: Player-facing guide content states what a bye actually pays

**User Story:** As a player, I want the guide to tell me what a bye pays, so that I can decide what a Subscription is worth without reading the source.

#### Acceptance Criteria

1. THE Player_Guide SHALL NOT state that a Bye_Event earns no rewards, in any article.
2. THE Player_Guide SHALL NOT state that a Bye_Event earns full, win-equivalent, or "as if it won" rewards, in any article.
3. THE `tournaments/bye-matches.md` article SHALL state that a bracket bye pays the same credits a loss pays for that round, and SHALL state that it pays no prestige and no fame.
4. THE `tournaments/bye-matches.md` article SHALL revise its bye trade-off argument so that forgone rewards are no longer presented as the cost of a bye, since that cost no longer exists.
5. THE `tournaments/rewards.md` article SHALL revise its bye callout, which currently states that a bye recipient earns nothing for that round.
6. THE `king-of-the-hill/entry-requirements.md` and `grand-melee/entry-requirements.md` articles SHALL state that a tier instance below its Minimum_Field_Size produces a Bye_Event for each eligible robot, in place of stating that no match is created.
7. THE `leagues/matchmaking.md` article SHALL state the actual `league_1v1` bye reward in place of its current claim of full rewards.
8. THE `team-battles/overview.md` and `team-battles/tag-team.md` articles SHALL state the team bye reward as the participation floor at team scale, rather than as "reduced rewards" or not at all.
9. THE `economy/battle-rewards.md` article SHALL cover what a Bye_Event pays, because it is the article describing how battles generate income.
10. THE `facilities/booking-office.md` article SHALL state that a Subscription always returns something when the schedule produces no fought match, and that a Bye_Event holds its slot until it resolves.
11. THE Player_Guide SHALL state the participation reward as 20% of the tier win reward, consistently with `PARTICIPATION_REWARD_FRACTION` and with the credit figures tabulated in the same articles.
12. THE Player_Guide SHALL distinguish the Placement_Credit_Floor from the Participation_Floor wherever either is named, so that the Grand Melee last-place payout is not read as the Grand Melee bye payout.
13. THE Player_Guide SHALL have its `lastUpdated` frontmatter bumped on every article changed by this spec.
14. THE Player_Guide SHALL retain working internal cross-links after every revision, so that no `/guide/...` reference in a rewritten article points at a missing section or article.

### Requirement 12: A bye is resolved without simulating combat, in every mode

**User Story:** As a player, I want a walkover to leave my robots as they were, so that a match nobody turned up to cannot cost me a repair bill.

#### Acceptance Criteria

1. WHEN a Bye_Event resolves in any of the nine modes, THE Bye_Reward_Module SHALL follow Walkover_Resolution and SHALL NOT invoke `simulateBattle`, `simulateBattleMulti`, `simulateTeamBattle` or `simulateTagTeamBattle`.
2. THE bye branch of every orchestrator SHALL detect the Bye_Event and return before an opponent is loaded or fabricated for combat, following the placement of the existing detection in `leagueBattleOrchestrator.processBattle`.
3. WHEN a Bye_Event resolves in any mode, THE Bye_Reward_Module SHALL leave `robots.currentHP` unchanged for every robot on the real side.
4. WHEN a Bye_Event resolves in any mode, THE Bye_Reward_Module SHALL leave `robots.currentShield`, `robots.damageTaken` and `robots.battleReadiness` unchanged for every robot on the real side.
5. WHEN a Bye_Event resolves in any mode, THE Bye_Reward_Module SHALL cause no repair charge, so no `audit_logs` row with `eventType: 'robot_repair'` arises from the Bye_Event.
6. THE Bye_Reward_Module SHALL record a Bye_Event as a win for the real side in every mode that has a win concept, and SHALL make a drawn outcome structurally unreachable rather than correcting one after a simulation.
7. THE `tag_team` and team league bye paths SHALL NOT retain a result-override block, and the draw override in `tagTeamScheduler.ts` and the result override in `teamBattleOrchestrator.ts` SHALL be deleted rather than kept as guards, because with no simulation there is no result to override.
8. THE Bye_Reward_Module SHALL write `damageDealt` as 0 and `finalHP` as the robot's pre-existing `currentHP` on every `battle_participants` row it creates.
9. THE Bye_Reward_Module SHALL write `battle_summaries` rows for a Bye_Event with no combat events in every mode, so that a team bye's summary carries the same absence of combat data as every other mode's.
10. WHEN a `league_1v1`, `tag_team`, `league_2v2` or `league_3v3` Bye_Event resolves, THE Bye_Reward_Module SHALL apply the same ELO change that mode applies to a bye today, leaving league bye ELO behaviour unchanged alongside league bye LP.
11. WHERE a Bye_Event occurs in a Tournament_Mode or a Placement_Mode, THE Bye_Reward_Module SHALL leave `robots.elo` unchanged, as those modes do today.
12. THE Bye_Reward_Module SHALL create the `battles` row for a Bye_Event in exactly one place for all nine modes, and SHALL NOT accept a battle row created elsewhere.
13. THE Bye_Placeholder factories SHALL be required only to supply a scheduling sentinel and the identity of the absent side, and SHALL NOT be relied on to supply combat attributes, weapons, HP or shields to any resolution path.
