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

## Not changed

- Season 1 unlocks stay as awarded. Unlocks reset at the Season 2 rollover anyway.
- C19 still reads final HP. Nothing records a robot's lowest HP during a fight, so "at <5% HP at any point" behaves as "won with <5% HP left". This is left to the achievement catalogue revamp.
