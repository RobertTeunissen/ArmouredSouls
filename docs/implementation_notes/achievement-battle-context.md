# Achievement Battle Context

**Date:** November 2026 · **Related:** [PRD_ACHIEVEMENT_SYSTEM.md](../game-systems/PRD_ACHIEVEMENT_SYSTEM.md), issue #446

## Problem

Every battle orchestrator calls `checkAndAwardAchievements` with a context describing the battle. Six of them passed placeholder values instead of the robot's own build and result:

| Orchestrator | Placeholders |
|---|---|
| `teamBattleOrchestrator` (2v2/3v3 league) | yield 0, no tuning, 0% final HP, `single`, `balanced` |
| `tagTeamResultUpdater` | yield 0, no tuning, 0% final HP, `single`, `balanced` |
| `teamTournamentBattleOrchestrator` | yield 0, no tuning, 0% final HP, `single`, `balanced` |
| `kothBattleOrchestrator` | yield 0, no tuning |
| `grandMeleeBattleOrchestrator` | yield 0, no tuning |
| `tournamentBattleOrchestrator` (1v1, first run and resume) | no tuning |

The placeholders satisfy the matching triggers, so a win in those modes unlocked achievements the robot had not earned:

- S8 "No Retreat, No Surrender" (`zero_yield_win`) and C17 "There Is No Spoon" (`no_tuning_win`) on any win in the affected modes.
- C10 "It's Just a Flesh Wound" (`low_hp_win`) and C19 "Peace Through Tyranny" (`low_hp_survival`) on any team, tag team or team tournament win. S9 "Glass Cannon" also unlocked on such a win when the robot dealt 500+ damage.

ACC evidence (Season 1, cycle 93): 25 human stables held S8 but only 2 human robots had ever fought at 0% yield; 498 Automaton stables held S8 against 30 Automaton robots set to 0% yield.

## Fix

- Each orchestrator passes the robot's `yieldThreshold`, its tuning allocation, its final HP as a percentage of its max HP, and its battle loadout and stance.
- Shared pure helpers live in `services/battle/battleAchievementContext.ts` (`hasAllocatedTuning`, `hpPercentOf`). They sit outside `battlePostCombat` so suites that mock that module still run them.
- Paths without a battle-time tuning map read the allocations again with `getTuningBonusesBatch`: the tag team result updater, the 1v1 tournament resume, and team tournaments (first run and resume, so both evaluate the same facts).

## Review follow-ups (PR #577)

- **Yields are persisted in every mode.** KotH and Grand Melee set `battle_participants.yielded` from the battle's `yield` events (`yieldedRobotNames`). Tag team counts a tag-out with HP left, or a yield event, as a yield (`getTagTeamYields`). Grand Melee rows now split `destroyed` and `yielded`; battle-log placements are unchanged. C23 counts these rows.
- **S13 counts 1v1 battles only.** `checkYieldsForcedCumulative` reads `league_1v1` and `tournament_1v1`, where the one opponent is the robot that yielded. In multi-robot modes a yield is not forced by one robot.
- **Destroyed means 0 HP.** C24 and S12 count a row as destroyed only with `finalHP <= 0`.
- **Ledger counters restart at the latest account reset.** `sumLedger` (E27, E33) and `hasDippedBelow` (E28) only read rows after `getAchievementCounterStart`. The reset keeps the ledger but deletes the unlocks, so older rows would re-award at once.
- **L39 uses the `last_standing` event.** The winner must be the `survivorId` of that event, not just the match winner.
- **HP percentages use battle-time max HP.** Final HP is on the combat scale (effective hull integrity). The tag team updater reads max HP from `result.phases`. The 1v1 tournament resume and team tournaments (first run and resume) rebuild it from `battle_participant_builds.effectiveAttributes.hullIntegrity` (`loadBattleTimeMaxHP`), and fall back to the stored max HP when a robot has no build row.

## Not changed

- Season 1 unlocks stay as awarded. Unlocks reset at the Season 2 rollover anyway.
- The KotH `uncontestedTimes` metadata is still wrong. L40 reads `uncontestedScore` instead.
