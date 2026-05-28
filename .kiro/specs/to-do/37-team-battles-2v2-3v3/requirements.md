# Requirements Document

## Spec: Team Battles (2v2 and 3v3)

## Glossary

- **Team Battle**: A new battle mode in which two opposing teams of N robots (N = 2 or N = 3) fight simultaneously inside a single combat instance. All robots on both sides are active in the arena at the same time. Distinct from the existing Tag Team Battle mode (see below). This spec introduces two sizes — 2v2 and 3v3 — that share rules and infrastructure; only the team size differs.
- **Team Battle 2v2**: A Team Battle with N = 2 robots per side (4 robots in the arena).
- **Team Battle 3v3**: A Team Battle with N = 3 robots per side (6 robots in the arena).
- **Team Battle Mode**: An umbrella term covering both 2v2 and 3v3.
- **Tag Team Battle**: The existing 2v2-flavoured mode implemented in `app/backend/src/services/tag-team/tagTeamBattleOrchestrator.ts`. Tag Team Battle has exactly one **active** robot per side at any moment, with the other robot held in **reserve** and tagged in on yield or KO. Tag Team is **not** a Team Battle and is not modified by this spec.
- **Team_Battle_Engine**: The new component that orchestrates Team Battle simulations. Built on top of `combatSimulator.ts` (the engine used by 1v1 league battles) — not on `tagTeamBattleOrchestrator.ts`. Reuses combat resolution primitives shared with the King-of-the-Hill engine (`kothEngine.ts`) for multi-robot arena handling.
- **Combat_Simulator**: The existing module at `app/backend/src/services/battle/combatSimulator.ts` that resolves time-based 2D arena combat. Extended by this spec to accept N-vs-N team rosters.
- **KotH_Engine**: The existing module at `app/backend/src/services/arena/kothEngine.ts` referenced for prior art on multi-robot arena state. Not modified by this spec.
- **Tag_Team_Orchestrator**: The existing module at `app/backend/src/services/tag-team/tagTeamBattleOrchestrator.ts`. Not modified by this spec.
- **Team**: A persistent grouping of robots owned by the same player, registered for a specific Team Battle size. A 2v2 team has exactly 2 robots; a 3v3 team has exactly 3 robots. A robot may belong to at most one 2v2 team and at most one 3v3 team at the same time, owned by the same stable.
- **Team_Roster**: The ordered list of robots that participate in a single Team Battle. For a 2v2 battle the team roster is 2 robots; for 3v3 it is 3 robots. The roster is read from the registered Team at the moment matchmaking pairs the team for a battle.
- **Stable**: The existing player-account concept. A stable owns robots and (after this spec) Teams.
- **Team_Coordination_Attributes**: The three robot attributes already present in the schema — `syncProtocols`, `supportSystems`, `formationTactics` — currently providing only minor 1v1 self-bonuses via `app/backend/src/services/arena/teamCoordination.ts`. After this spec they additionally produce ally-targeted effects in Team Battle Mode. The 1v1 effects are out of scope for this spec and remain unchanged.
- **Team_Coordination_Discussion**: A required activity of the design phase of this spec. A written discussion of the existing 1v1 effects of `syncProtocols`, `supportSystems`, and `formationTactics`, together with the proposed Team Battle Mode ally-effect formulas and the rationale for the chosen coefficients. The discussion outputs live as a dedicated section inside the design document for this spec — there is no separate audit document under `docs/balance_changes/`.
- **Featured_Team_Battle_Mode**: The Team Battle size (2v2 or 3v3) that is active for the current cycle. The Featured Team Battle Mode alternates between 2v2 and 3v3 on consecutive cycles. Only the Featured Team Battle Mode produces scheduled battles on a given cycle.
- **Daily_Cycle**: The existing automated cycle implemented via `cycleMetadata.totalCycles`. Cycle parity (even/odd) drives Featured Team Battle Mode selection (the same parity mechanism that already gates Tag Team matchmaking).
- **Cycle_Scheduler**: The existing production cron at `app/backend/src/services/cycle/cycleScheduler.ts` (entry point `initScheduler`) that runs league, tournament, tag-team, KotH, and settlement jobs on a schedule. Extended by this spec to additionally invoke Team Battle matchmaking and Team Battle execution.
- **Admin_Bulk_Cycle_Service**: The existing local "run N cycles" admin tool at `app/backend/src/services/admin/adminCycleService.ts` (entry point `executeBulkCycles`) used to exercise the full cycle pipeline locally on ACC. Extended by this spec to include Team Battle steps so the local tool exercises Team Battle exactly as production does.
- **Admin_Cycle_Controls**: The existing admin UI at `app/frontend/src/pages/admin/CycleControlsPage.tsx`, served by the admin routes in `app/backend/src/routes/admin.ts`, that exposes manual-trigger endpoints for matchmaking and battle execution per mode.
- **Team_LP**: League Points held by a Team (per size). Independent of robot LP and tag-team LP. Each Team has its own `teamLp` per size.
- **Team_ELO**: An ELO rating held by a Team (per size). Independent of robot ELO and tag-team ELO. Used for matchmaking inside a league instance.
- **Team_League_Tier**: A league tier (`bronze`/`silver`/`gold`/`platinum`/`diamond`/`champion`) and instance ID held by a Team (per size). Mirrors the existing tag-team league tier model.
- **Bye_Team**: A synthetic opponent inserted by matchmaking when an odd number of eligible Teams exist for a given league instance, mirroring the existing tag-team bye-team behaviour.
- **Robot_Readiness**: An existing concept (already used by tag-team scheduling) meaning a robot is alive (`hp > 0`), not under irreversible damage, and not flagged as unavailable. A robot must be ready for its Team to be eligible for a battle.
- **Battle_Mode**: The persisted value in `Battle.battleType`. After this spec the allowed values include `'team_2v2'` and `'team_3v3'` in addition to the existing `'league'`, `'tournament'`, `'tag_team'`, and `'koth'`.
- **Focus_Fire**: A Team Battle behaviour where multiple allied robots target the same opposing robot in the same combat tick. Surfaced as a measurable metric in battle results and influenced by `syncProtocols`.
- **Ally_Support_Effect**: An aggregate term for the ally-targeted effects produced by Team Coordination Attributes inside a Team Battle (e.g. `supportSystems` ally shield regen, `formationTactics` ally damage reduction at close grid distance, `syncProtocols` focus-fire damage bonus). Specific effect formulas are not fixed by this requirements document; they are deliverables of the Team_Coordination_Discussion captured in the design document.
- **Hall_of_Records**: The existing public read-only surface that ranks notable battle outcomes. After this spec, Hall of Records additionally surfaces Team Battle records (per size).

## Introduction

Backlog item #31 ("3v3 Team Battles") calls out that the `BattleParticipant` model already supports an arbitrary number of robots per battle and that the engine pieces exist (`combatSimulator.ts` for 1v1, `kothEngine.ts` for multi-robot KotH arenas) but no team-vs-team mode beyond Tag Team has been built. Tag Team is a phased fight (one active robot per side at a time, with reserves swapping in on yield/KO) and doesn't expose the Team Coordination Attributes that ship on every robot today.

This spec covers both 2v2 and 3v3 in one delivery because the rules are identical — only the team size differs. The two sizes alternate on a daily cadence so that on any given cycle there is exactly one Featured Team Battle Mode running. Players register a Team per size; matchmaking pairs Teams within a league tier; the Team Battle Engine simulates all robots in the arena simultaneously; rewards distribute across the Team. The Team Coordination Attributes — `syncProtocols`, `supportSystems`, `formationTactics` — finally drive ally-facing effects, with their formulas chosen during the design phase via the Team_Coordination_Discussion.

Team Battle is a **league-only** mode in v1. The existing 1v1 tournament system (`app/backend/src/services/tournament/tournamentBattleOrchestrator.ts`) is unchanged by this spec; bracketed Team Battle events are out of scope.

This spec deliberately does **not** re-use the Tag Team Orchestrator. The two systems share the goal of "two players, four robots" only at the surface; the simulation models are different (phased vs. simultaneous) and merging them would compromise both. Instead, the Team Battle Engine extends the 1v1 `combatSimulator.ts` to accept N-vs-N team rosters, drawing from the multi-robot arena patterns already established in `kothEngine.ts`.

There is no unified "battle-onboarding" construct in the existing codebase: each existing mode (League, Tournament, Tag Team, KotH) has its own `{Mode}BattleOrchestrator.ts`, `{Mode}MatchmakingService.ts`, and `{Mode}LeagueRebalancingService.ts`, wired into the cycle scheduler and the admin bulk-cycle service separately. This spec follows the same per-mode pattern under `app/backend/src/services/team-battle/` and explicitly reuses the following existing modules and patterns rather than re-implementing them:

- `app/backend/src/services/battle/combatSimulator.ts` — combat resolution engine, extended to accept N-vs-N rosters.
- `app/backend/src/services/arena/arenaLayout.ts` — arena radius scaling (`calculateArenaRadius`), spawn-position computation (`calculateSpawnPositions`), and arena assembly (`createArena`). Team Battle invokes `createArena(teamSizes, override?)` directly.
- `app/backend/src/services/arena/teamCoordination.ts` — existing 1v1 self-bonus implementation referenced by the Team_Coordination_Discussion. The 1v1 effects remain unchanged.
- `app/backend/src/services/arena/kothEngine.ts` — referenced for prior art on multi-robot arena state; not modified by this spec.
- `BattleParticipant` (Prisma model) — already supports an arbitrary number of robots per battle.
- `LeagueHistory` (Prisma model and `app/backend/src/services/league/leagueHistoryService.ts`) — reused for Team Battle promotion/relegation history rows, mirroring the existing `entityType` pattern.
- `app/backend/src/services/tag-team/tagTeamMatchmakingService.ts` — pattern source for bye-team handling (`createByeTeam`), recent-opponent exclusion (`TAG_TEAM_RECENT_OPPONENT_LIMIT = 5`), and same-stable penalty.
- `app/backend/src/services/tag-team/tagTeamLeagueInstanceService.ts` — pattern source for `assignTagTeamLeagueInstance`; the Team Battle equivalent will reuse this helper directly or add a parallel `assignTeamBattleLeagueInstance` (decided in design).
- `app/backend/src/lib/timedCache.ts` (`TimedCache`) — reused for caching the new Team Battle Hall of Records rows alongside existing records.

## Context: Discussion Notes

The following decisions and rationale were settled during scoping. Recorded for traceability so future changes know what was deliberately chosen vs. accidentally inherited.

### Why one spec for both 2v2 and 3v3

The rules are the same. Team size is a parameter. Splitting into two specs would force every requirement, every formula, and every UI surface to be written twice and would invite subtle drift between the two modes. A single spec with `N ∈ {2, 3}` everywhere keeps the symmetry honest.

### Why this is not a Tag Team variant

Tag Team is a phased fight: one active robot per side, the other in reserve, with explicit tag-out events on yield or KO. The orchestration logic is built around state transitions between phases (`active battle` → `tag transition` → `reserve battle` → `victory check`). Team Battle is a single arena with all robots active for the entire fight — the orchestration logic is a single sustained simulation, not a state machine. Reusing the Tag Team Orchestrator would mean either (a) bolting an N-active-robots mode onto a 1-active-robot phased orchestrator, which corrupts the phased model, or (b) passing every robot through the orchestrator individually, which loses the simultaneity that's the whole point of the mode. Building on `combatSimulator.ts` (already used by 1v1) and borrowing arena handling patterns from `kothEngine.ts` is the right separation.

### Why daily alternating instead of both modes every day

Battle fatigue. A stable with three robots will typically register both a 2v2 and a 3v3 Team alongside an existing Tag Team. Running every mode every day means the same stable fires Tag Team + 2v2 + 3v3 in the same cycle, every cycle, with three independent rankings and three independent reward streams to follow. Alternating 2v2 and 3v3 on consecutive cycles spreads participation across days, gives each mode its own "day in the spotlight," and keeps each mode feeling distinct rather than blurred together. It also matches the existing tag-team scheduling pattern (odd cycles = tag team), so the cycle scheduler stays predictable.

### Why Teams are persistent (not ad-hoc per battle)

Tag Team uses persistent `TagTeam` rows, and players have responded well to the team-as-identity framing. Persistent Teams give the league/ELO/LP system a stable subject, let players name their teams, let achievements track team accomplishments, and let the matchmaker maintain ELO history across battles. Ad-hoc team selection per battle would force every battle to do its own composition logic and would tie ELO/LP to robots rather than teams, which couples team-mode standings to single-robot performance in ways that would feel unfair.

### Why a robot can be in both a 2v2 team and a 3v3 team simultaneously

The two sizes alternate on different days, so a robot can never be physically in two team battles on the same cycle. Forcing a robot to choose one size would punish players for participating in both modes and would split rosters in half. Allowing both is consistent with the existing rule that a robot can be in a Tag Team and still participate in 1v1 league battles.

### Why Team Coordination Attributes get a discussion (not a separate audit document)

The three attributes currently have a tiny 1v1 effect (`syncProtocols` dual-wield sync window bonus, `supportSystems` self shield regen, `formationTactics` near-edge damage reduction) that is, by the implementation's own admission, a placeholder until "full team coordination bonuses (2v2+) are handled in the main simulation loop". This spec is what the placeholder was waiting for. Before defining the new Team Battle ally effects we need a written discussion of what these attributes do today and what the new ally-effect formulas should be. That discussion happens during the design phase of this spec and its outputs — the proposed scaling table, the chosen formulas, and the rationale — live as a dedicated section inside `design.md`. There is no separate audit document under `docs/balance_changes/`. The design freezes the formulas; no constants are left as TBD.

### Why we don't change the 1v1 effects in this spec

Scope discipline. This spec adds Team Battle Mode and the ally-facing effects of the Team Coordination Attributes. The existing 1v1 effects of `syncProtocols`, `supportSystems`, and `formationTactics` defined in `app/backend/src/services/arena/teamCoordination.ts` are out of scope and remain unchanged. If a future balance pass concludes the 1v1 effects need adjustment, that becomes its own balance spec — mixing balance corrections to existing 1v1 mechanics into a new-mode spec would muddy regression detection.

### Why no facility or prestige gating in v1

The team-battles-2v2-3v3 review surfaced two related ideas: a Booking Office-style facility level requirement, and a more general "battle subscription facility" (Backlog #55) that would let players opt into a chosen subset of event modes. Neither is in scope here because:

1. **Cross-cutting concern.** Subscription gating applies to every event mode (Tag Team, Team Battle 2v2, Team Battle 3v3, future team tournaments, future seasonal events), not specifically to Team Battles. Building it inside this spec would tie a system-wide mechanic to one feature.
2. **Roster size already gates 3v3.** Registering a 3v3 Team requires 3 owned robots, which in turn requires Roster Expansion L2+ (which itself starts gaining prestige requirements at L4). The natural progression provides a soft gate without a new system.
3. **Risk.** Adding a facility schema change inside a new-mode spec multiplies regression surface unnecessarily.

The full subscription-facility design lives in Backlog #55 and may retroactively gate Team Battle participation when it ships. Until then, Team Battle league participation is open to any stable that owns the required number of robots.

### Out of Scope

- **Cross-stable team formation** ("guild" or "party" play). All robots in a Team are owned by a single stable. Multiplayer party play is a separate future feature (see Backlog #45 social features).
- **Manual matchmaking / friendly Team Battles**. Matchmaking is automatic on the Featured Team Battle Mode cycle, mirroring league/tag-team. Manual challenge flows are out of scope.
- **Practice Arena Team Battle**. The existing Practice Arena (Spec #13) is 1v1 only. Extending it to N-vs-N is a separate concern.
- **Team Battle in tournaments**. Tournaments remain 1v1; `app/backend/src/services/tournament/tournamentBattleOrchestrator.ts` is unchanged. Team Battle tournaments are tracked as a follow-up spec via Backlog #54, with the agreed approach being to generalise the existing tournament schema to be entity-keyed (Robot or Team) rather than build a parallel team-tournament system.
- **Gating Team Battle league participation behind a facility or prestige threshold**. v1 ships with no gating — any stable with the required robot count (R2.11) can register a Team. The general "battle subscription facility" mechanism is tracked as Backlog #55 and may retroactively gate Team Battle participation when it ships. This spec does not implement that gating.
- **Per-tier Team Coordination prestige gating**. Team Coordination Attributes already exist on every robot from cycle 1 — no new prestige gates introduced.
- **Re-architecting the existing Tag Team mode**. Tag Team continues to exist and operate as today.
- **Refactoring `combatSimulator.ts` or `tagTeamBattleOrchestrator.ts` per Backlog #49**. The Mega-Orchestrator Refactor is its own spec. This spec extends `combatSimulator.ts` for N-vs-N; if the result would push it past acceptable size limits the design will introduce a thin team-mode wrapper module rather than inflate the simulator.
- **New robot attributes**. The three Team Coordination Attributes are reused; no new attributes are added to the schema.
- **Changes to the 1v1 effects of `syncProtocols`, `supportSystems`, and `formationTactics`**. The existing self-bonus implementation in `app/backend/src/services/arena/teamCoordination.ts` is unchanged by this spec.
- **A separate Team_Coordination_Audit document under `docs/balance_changes/`**. The design phase produces a Team_Coordination_Discussion section inside `design.md` instead.
- **Team Battle replays in the admin replay tool** (Backlog #8 / Spec to-do/8-battle-replay-admin). Replay works against `Battle.battleLog`; once Team Battle writes that field with the documented schema, the replay tool will be able to consume it without changes. If the replay tool needs format-specific rendering for >2 robots that is out of scope for this spec.
- **Cosmetic team customization** (skins, banners, taunts).

## Expected Contribution

This spec addresses Backlog #31 ("3v3 Team Battles"), expands it to also cover 2v2, and resolves the long-standing dormant state of the Team Coordination Attributes.

1. **Two new battle modes shipped together.** Before — the only multi-robot team mode is Tag Team (phased, 2v2 only). After — Team Battle 2v2 and Team Battle 3v3 are first-class modes with their own persistent Teams, league standings, matchmaking, rewards, and battle records. Teams alternate on a daily cadence so that exactly one of {2v2, 3v3} produces scheduled battles per cycle. Verifiable by: a Cycle N produces only 2v2 Team Battle records, Cycle N+1 produces only 3v3 Team Battle records, both share rule code paths.

2. **Team Coordination Attributes finally drive ally effects.** Before — `syncProtocols`, `supportSystems`, and `formationTactics` exist on every robot in the schema and only produce small self-bonuses in 1v1; an inline comment in `teamCoordination.ts` calls this a placeholder waiting for "2v2+" mode. After — these three attributes additionally produce documented ally-targeted effects in Team Battle Mode, with formulas chosen during the design phase via the Team_Coordination_Discussion. Players who invested in Team Coordination Attributes finally see the investment pay off in the new mode. Verifiable by: a Team Battle simulation with all-zero Team Coordination Attributes vs. one with maxed Team Coordination Attributes produces measurably different outcomes on focus fire damage, ally shield regen, and ally damage reduction (each metric exposed in battle log and asserted in property tests).

3. **Team Coordination Discussion captured in design.** Before — no documented analysis of the 1v1 placeholder bonuses or the proposed Team Battle ally formulas. After — `design.md` contains a "Team Coordination Discussion" section enumerating the existing 1v1 effects, the proposed Team Battle Mode scaling table for `syncProtocols`, `supportSystems`, and `formationTactics`, and the rationale for the chosen coefficients. The 1v1 effects are unchanged by this spec. Verifiable by: design.md contains the section heading, the scaling table covers all three attributes across the full attribute range with no TBD values, and the property-based tests anchor on those formulas.

4. **Reuse of existing infrastructure, no Tag Team coupling.** Before — backlog item identified `BattleParticipant` already supports N robots and the engine pieces exist. After — the Team Battle Engine is built on `combatSimulator.ts` extended for N-vs-N, with arena handling driven by `arenaLayout.createArena(teamSizes, override?)` and patterns borrowed from `kothEngine.ts`. The Tag Team Orchestrator is not touched. The `Battle` and `BattleParticipant` schemas absorb the new mode via `battleType IN ('team_2v2', 'team_3v3')` and the existing `participants` relation, with no new battle-row migration. Verifiable by: zero diffs in `tagTeamBattleOrchestrator.ts`; `Battle` schema gains no new columns (only new enum values for `battleType`); all Team Battle participants use `BattleParticipant` rows; the Team Battle Engine imports `createArena` from `app/backend/src/services/arena/arenaLayout.ts` rather than duplicating arena sizing.

5. **League/LP/ELO system per size, mirroring tag-team patterns.** Before — only robot-level and tag-team-level league/ELO. After — Team Battle has its own per-size Team_LP, Team_ELO, Team_League_Tier with promotion/relegation. Players see standings on a Team Battle leaderboard separate from individual robots. Verifiable by: a Team that wins a Team Battle gains Team_LP and Team_ELO without affecting either robot's individual league standing or the player's tag-team standings.

6. **Daily alternation cadence integrated with the cycle scheduler.** Before — only tag-team has a parity-based scheduling rule (odd cycles run tag-team matchmaking). After — Team Battle 2v2 and Team Battle 3v3 share a parity rule that selects exactly one Featured Team Battle Mode per cycle. The selection is deterministic and observable from `cycleMetadata.totalCycles`. Production cron (`cycleScheduler.initScheduler`) and the local bulk-cycle admin tool (`adminCycleService.executeBulkCycles`) both invoke Team Battle matchmaking and execution gated by the same parity selector, and admin manual-trigger endpoints in `app/backend/src/routes/admin.ts` mirror the existing tag-team triggers so an admin on ACC can fire a Team Battle pass on demand. Verifiable by: a unit test asserts `selectFeaturedTeamBattleMode(cycle)` returns `'team_2v2'` on one cycle and `'team_3v3'` on the next cycle for any pair of consecutive cycles; both `cycleScheduler.ts` and `adminCycleService.ts` call the new Team Battle matchmaking and execution functions; the new admin endpoints exist alongside the existing `/api/admin/tag-teams/matchmaking` and `/api/admin/tag-teams/battles` endpoints.

7. **Seeded stables auto-generate Team Battle rosters.** Before — `app/backend/src/utils/userGeneration.ts` auto-creates a `TagTeam` for stables in tiers whose `TIER_CONFIGS` row has `createTagTeam = true`, but Team Battle Teams have no equivalent. After — `TIER_CONFIGS` gains `createTeamBattle2v2` and `createTeamBattle3v3` flags, seeded stables with sufficient robots get a 2v2 and/or 3v3 Team registered through the same code path as a player-initiated registration (no validation bypass), and the `generateBattleReadyUsers` summary returns `teamBattle2v2Created` and `teamBattle3v3Created` counts surfaced in the admin UI. Verifiable by: a seeded run on a tier with both flags enabled produces the expected per-stable Team rows visible in the database and in the admin user-generation summary.

8. **Achievement system extended to cover Team Battle.** Before — `AchievementTriggerType` covers `tag_team_wins` and `koth_wins`, and the C18 "Autobots, Roll Out!" all-modes achievement requires wins in league + KotH + tag-team + tournament (four modes). After — the enum gains `team_2v2_wins` and `team_3v3_wins`, two new robot metric fields track per-robot Team Battle wins per size, four new achievement rows ship (one easy and one hard per size), C18's `checkAllModesWin` requires wins in all six modes (league, KotH, tag-team, tournament, team_2v2, team_3v3) for new earners, and existing C18 holders retain the achievement. Verifiable by: the enum, the metric fields, the achievement rows, and the updated C18 logic exist in code; the achievement progress UI renders the new triggers with the same component pattern used for `tag_team_wins`; an integration test confirms a player who already holds C18 keeps it, and a player without C18 needs all six wins to earn it.

9. **Unified Team Battles UI.** Before — Tag Team has its own `/tag-teams` route serving `TagTeamManagementPage.tsx` and `/tag-teams/standings` serving `TagTeamStandingsPage.tsx`. After — a single `/team-battles` route is the unified surface for Tag Team, Team Battle 2v2, and Team Battle 3v3, listing all three Team types side-by-side from one stable's perspective with per-type "Register a Team" affordances. The existing `/tag-teams` route redirects to the equivalent tab on `/team-battles` so existing in-app links keep working. Robot cards display every Team membership the robot has (Tag Team, 2v2, 3v3) as independent chips. Verifiable by: the new route exists; navigating to `/tag-teams` redirects to `/team-battles`; a robot belonging to all three Team types renders three chips on its card.

### Verification Criteria

After all tasks are complete, the following automatable checks confirm the spec was delivered as designed.

1. `npx prisma migrate status` — the migration adding the Team Battle tables is applied with no drift.
2. `psql ... -c "\d team_battle"` — a `team_battle` table exists holding per-size Team rows with columns `id`, `stable_id`, `team_size`, `team_name`, `team_lp`, `team_elo`, `team_league`, `team_league_id`, `created_at`, plus a unique constraint on `(stable_id, team_size)` and an index on `(team_league_id, team_elo)`. (Final table name and column names confirmed in design.)
3. `psql ... -c "\d team_battle_member"` — a `team_battle_member` table exists holding `(team_id, robot_id, slot_index)` with a unique constraint on `(team_id, slot_index)` and an FK to `robot.id`.
4. `psql ... -c "\d scheduled_team_battle_match"` — a `scheduled_team_battle_match` table exists analogous to `scheduled_tag_team_match` with per-size routing.
5. `grep -rn "battleType.*team_2v2\|battleType.*team_3v3" app/backend/src/` — Team Battle producers write the correct `battleType` values.
6. `grep -rn "selectFeaturedTeamBattleMode\b" app/backend/src/services/` — the cycle-parity selector exists exactly once and is the single source of truth.
7. `grep -rn "from .*combatSimulator" app/backend/src/services/team-battle/` — the new Team Battle Engine imports `combatSimulator`. `grep -rn "from .*tagTeamBattleOrchestrator" app/backend/src/services/team-battle/` returns no matches.
8. `git diff --name-only HEAD~ -- app/backend/src/services/tag-team/` — empty (Tag Team is untouched).
9. `cd app/backend && npm test -- team-battle` — all Team Battle backend tests pass, covering: team registration, eligibility checks, matchmaking pairing, bye-team handling, simulation correctness for 2v2 and 3v3, focus fire metrics, ally support effects, reward distribution, ELO/LP updates, audit log emission.
10. `cd app/backend && npm test -- teamCoordination.property` — property-based tests confirm: damage with Team Coordination Attributes ≥ damage without, focus fire bonus monotonic in `syncProtocols`, ally shield regen monotonic in `supportSystems`, formation defence monotonic in `formationTactics`. Existing 1v1 property tests still pass.
11. `cd app/frontend && npm test -- TeamBattle` — frontend tests pass: Team registration form (per size), Team standings page, Team Battle results screen rendering N robots per side, Battle History filter for Team Battle Mode, Robots page eligibility chip showing whether a robot is in an active Team.
12. `psql ... -c "SELECT battle_type, COUNT(*) FROM battle GROUP BY battle_type;"` — after a 2-cycle dev simulation, `team_2v2` and `team_3v3` rows both exist; on any single cycle's worth of new battles, only one of the two is incremented.
13. Manual integration: register a 2v2 Team and a 3v3 Team for the same stable, run a cycle of each mode, confirm: cycle that is the 2v2 cycle generates only `team_2v2` battles, the alternate cycle generates only `team_3v3` battles, both Teams' Team_LP and Team_ELO update, the Battle History shows the new battles, the Hall of Records ranks them, the results screen lists all N robots per side.
14. Manual integration: a robot with `syncProtocols = 1` and a robot with `syncProtocols = 50` on otherwise identical Teams produces a measurably different focus fire damage output in Team Battle Mode (battle log records show different focus-fire damage totals).
15. `grep -n "## Team Coordination Discussion" .kiro/specs/to-do/37-team-battles-2v2-3v3/design.md` — design document contains a "Team Coordination Discussion" section with the chosen formulas for `syncProtocols`, `supportSystems`, and `formationTactics` ally effects, and `grep -in "TBD\|TODO" .kiro/specs/to-do/37-team-battles-2v2-3v3/design.md | grep -i "team coordination\|formula"` returns no matches inside that section.
16. `grep -n "Team Battle" docs/game-systems/PRD_MATCHMAKING.md` — matchmaking PRD documents Team Battle pairing rules.
17. `grep -n "Team Battle" docs/architecture/COMBAT_FORMULAS.md` — combat formulas doc documents Team Coordination effect formulas.
18. `grep -n "Team Battle" .kiro/steering/game-mechanics-reference.md` — steering file lists Team Battle as a key game system alongside the other modes.
19. `grep -n "team-battles-2v2-3v3\|37\|Team Battles" docs/BACKLOG.md` — backlog item #31 marked complete and references this spec.
20. Race-condition stress test: a Jest test that fires 50 parallel "register team / change member / matchmake / simulate / settle rewards" cycles asserts: no Team has more or fewer than its size's required member count, no robot belongs to two same-size Teams, no `BattleParticipant` row links to a robot not in the producing Team, total currency change equals sum of expected reward deltas.
21. `grep -n "selectFeaturedTeamBattleMode\b" app/backend/src/services/cycle/cycleScheduler.ts app/backend/src/services/admin/adminCycleService.ts` — both the production cron and the local bulk-cycle service gate Team Battle steps on the parity selector.
22. `grep -nE "router\\.(post|get)\\([\"']/team-battles/(matchmaking|battles)[\"']" app/backend/src/routes/admin.ts` — admin manual-trigger endpoints for Team Battle matchmaking and Team Battle execution exist alongside the existing `/api/admin/tag-teams/*` endpoints, and `grep -nE "recordAuditAction.*team_battle" app/backend/src/routes/admin.ts` confirms they emit `adminAuditLog` rows.
23. `grep -nE "createTeamBattle2v2|createTeamBattle3v3" app/backend/src/utils/tierConfig.ts app/backend/src/utils/userGeneration.ts` — the seeded user generation system gains the new flags and the seeded-creation code path; `grep -nE "teamBattle2v2Created|teamBattle3v3Created" app/backend/src/utils/userGeneration.ts` confirms the summary fields exist.
24. `grep -nE "team_2v2_wins|team_3v3_wins" app/backend/src/config/achievements.ts app/backend/src/services/achievement/achievementService.ts` — the new trigger types are wired in achievements config and trigger evaluation; `grep -nE "totalTeam2v2Wins|totalTeam3v3Wins" app/backend/prisma/schema.prisma` confirms the metric fields exist.
25. `grep -n "Autobots, Roll Out!" app/backend/src/config/achievements.ts` followed by inspection of the achievement description confirms it lists all six modes (league, KotH, tag team, tournament, team 2v2, team 3v3); a Jest test asserts that an existing `UserAchievement` row for C18 is preserved across the migration and that a player without C18 must have wins in all six modes for `checkAllModesWin` to return true.
26. `grep -nE "/team-battles" app/frontend/src/App.tsx` — the unified `/team-battles` route exists; `grep -nE "/tag-teams" app/frontend/src/App.tsx` shows `/tag-teams` redirects to `/team-battles` (or equivalent tab) instead of rendering a separate page; a Vitest component test asserts that a robot belonging to a Tag Team, a 2v2 Team, and a 3v3 Team renders three independent chips on its robot card.

## Requirements

### R1: Battle Mode Definition and Distinction from Tag Team

**R1.1** THE Team_Battle_Engine SHALL implement a battle mode in which two opposing teams of N robots fight in a single arena instance with exactly 2N robots acting per round and all 2N robots active simultaneously, where N ∈ {2, 3}, AND THE Team_Battle_Engine SHALL NOT support substitution or active-reserve rotation during a battle.

**R1.2** THE Team_Battle_Engine SHALL be implemented as a new module under `app/backend/src/services/team-battle/` AND SHALL NOT modify `app/backend/src/services/tag-team/tagTeamBattleOrchestrator.ts`.

**R1.3** THE Team_Battle_Engine SHALL invoke `app/backend/src/services/battle/combatSimulator.ts` for combat resolution, AND `app/backend/src/services/battle/combatSimulator.ts` SHALL accept a 2N-robot roster partitioned into two teams of N robots.

**R1.4** WHEN a Team Battle is recorded in the database, THE Team_Battle_Engine SHALL set `Battle.battleType` to `'team_2v2'` for a 2v2 battle and to `'team_3v3'` for a 3v3 battle.

**R1.5** WHEN a Team Battle is persisted, THE Team_Battle_Engine SHALL persist exactly 2N `BattleParticipant` rows (where N ∈ {2, 3}), with `BattleParticipant.team` set to `1` for robots from the team supplied first to the engine entry point and `2` for robots from the team supplied second, and with `BattleParticipant.role` set to `null` (no active/reserve distinction in Team Battle).

**R1.6** THE codebase SHALL continue to use the term "Tag Team" exclusively for the existing phased 2v2 mode AND THE codebase SHALL use the term "Team Battle" exclusively for the simultaneous N-vs-N mode introduced by this spec.

**R1.7** THE Team_Battle_Engine SHALL NOT delegate any portion of Team Battle execution to `tagTeamBattleOrchestrator.executeTagTeamBattle` AND THE Team_Battle_Engine SHALL NOT share request paths or invocation entry points with `tagTeamBattleOrchestrator`.

**R1.8** IF the Tag_Team_Orchestrator receives a payload whose `Battle.battleType` is `'team_2v2'` or `'team_3v3'`, THEN THE Tag_Team_Orchestrator SHALL reject the payload without performing any database writes.

**R1.9** IF the roster supplied to the Team_Battle_Engine has a team count other than 2, THEN THE Team_Battle_Engine SHALL reject the request with error code `TEAM_INVALID_COMPOSITION`, AND IF either supplied team's robot count is not equal to N (where N ∈ {2, 3}), THEN THE Team_Battle_Engine SHALL reject the request with error code `TEAM_INVALID_SIZE`.

### R2: Team Composition and Eligibility

**R2.1** THE Team_Battle_Engine SHALL persist Teams as rows in the `team_battle` table such that a Team's `team_size` and member set survive process restarts and are readable by subsequent matchmaking and registration requests, where each Team has exactly one `team_size` ∈ {2, 3} and exactly that many member robots, AND IF a registration or member-change request would leave a Team with a member count not equal to its `team_size`, THEN THE Team_Battle_Engine SHALL reject the request with error code `TEAM_INVALID_SIZE`.

**R2.2** THE Team_Battle_Engine SHALL reject any Team registration request that would result in a Stable owning more than one Team for a given `team_size`, such that for every Stable and every `team_size` ∈ {2, 3} the count of registered Teams is at most one as observed via the registration interface and the database.

**R2.3** THE Team_Battle_Engine SHALL permit a single robot to belong to at most one 2v2 Team and at most one 3v3 Team owned by the same Stable simultaneously, AND THE Team_Battle_Engine SHALL treat 2v2 Team membership, 3v3 Team membership, and Tag Team membership as three independent memberships such that one robot owned by a single Stable MAY belong to all three at the same time.

**R2.4** WHEN a player registers a 2v2 Team, THE Team_Battle_Engine SHALL require exactly 2 distinct robot IDs owned by the registering Stable, AND IF the request supplies any other count or contains duplicate robot IDs, THEN THE Team_Battle_Engine SHALL reject the request with error code `TEAM_INVALID_COMPOSITION`.

**R2.5** WHEN a player registers a 3v3 Team, THE Team_Battle_Engine SHALL require exactly 3 distinct robot IDs owned by the registering Stable, AND IF the request supplies any other count or contains duplicate robot IDs, THEN THE Team_Battle_Engine SHALL reject the request with error code `TEAM_INVALID_COMPOSITION`.

**R2.6** IF a player attempts to assign a robot to a Team where that robot is already a member of another Team of the same size owned by the same Stable, THEN THE Team_Battle_Engine SHALL reject the request with error code `TEAM_MEMBER_CONFLICT` AND SHALL leave the existing Team membership unchanged.

**R2.7** IF a player attempts to assign a robot to a Team that is not owned by the same Stable, THEN THE Team_Battle_Engine SHALL reject the request with error code `TEAM_OWNERSHIP_VIOLATION` AND SHALL leave the existing Team membership unchanged.

**R2.8** WHEN a player removes a robot from a Team, IF that Team has a `ScheduledTeamBattleMatch` row queued for execution in the next cycle but not yet executed, THEN THE Team_Battle_Engine SHALL reject the removal with error code `TEAM_LOCKED_FOR_BATTLE`.

**R2.9** WHEN a Team's member robot is destroyed (deleted from the Stable), THE Team_Battle_Engine SHALL set the Team's eligibility status to `INELIGIBLE` such that the matchmaker excludes the Team from all subsequent matchmaking runs, AND WHEN the player assigns a replacement robot that satisfies R2.1, THE Team_Battle_Engine SHALL set the Team's eligibility status back to `ELIGIBLE`.

**R2.10** A Team SHALL have a player-set `team_name` validated against the existing `safeName` security primitive in `app/backend/src/utils/securityValidation.ts`, AND IF the supplied `team_name` fails `safeName` validation, THEN THE Team_Battle_Engine SHALL reject the registration with error code `TEAM_NAME_INVALID`.

**R2.11** IF a Stable's count of non-deleted owned robots is less than N (where N ∈ {2, 3}), THEN THE Team_Battle_Engine SHALL reject any request to register a Team of size N for that Stable with error code `TEAM_INSUFFICIENT_ROBOTS` until the Stable owns at least N non-deleted robots.

### R3: Daily Alternating Schedule

**R3.1** THE Team_Battle_Engine SHALL implement a function `selectFeaturedTeamBattleMode(cycleNumber: number): 'team_2v2' | 'team_3v3'` that, for any non-negative integer `cycleNumber`, returns the same output every time it is invoked with that input.

**R3.2** IF `cycleNumber % 2 === 0`, THEN `selectFeaturedTeamBattleMode(cycleNumber)` SHALL return `'team_2v2'`.

**R3.3** IF `cycleNumber % 2 === 1`, THEN `selectFeaturedTeamBattleMode(cycleNumber)` SHALL return `'team_3v3'`.

**R3.4** WHEN the cycle scheduler runs Team Battle matchmaking for a cycle, THE Team_Battle_Engine SHALL run matchmaking only for Teams whose `team_size === selectFeaturedTeamBattleMode(cycleNumber)` evaluated as 2 for `'team_2v2'` and 3 for `'team_3v3'`, AND THE Team_Battle_Engine SHALL NOT pair, queue, or persist `ScheduledTeamBattleMatch` records for any other `team_size` during that cycle.

**R3.5** WHEN the cycle scheduler runs Team Battle execution for a cycle, THE Team_Battle_Engine SHALL execute battles only for `ScheduledTeamBattleMatch` rows whose `team_size === selectFeaturedTeamBattleMode(cycleNumber)` evaluated as 2 for `'team_2v2'` and 3 for `'team_3v3'`, AND THE Team_Battle_Engine SHALL NOT start, simulate, or finalize any other Team Battles during that cycle.

**R3.6** WHILE `selectFeaturedTeamBattleMode(cycleNumber)` returns `'team_2v2'` for the current cycle, THE Team_Battle_Engine SHALL NOT generate any 3v3 scheduled matches or 3v3 battles in that cycle.

**R3.7** WHILE `selectFeaturedTeamBattleMode(cycleNumber)` returns `'team_3v3'` for the current cycle, THE Team_Battle_Engine SHALL NOT generate any 2v2 scheduled matches or 2v2 battles in that cycle.

**R3.8** IF a Stable's only registered Team is for the non-featured size on a given cycle, THEN THE Team_Battle_Engine SHALL skip that Stable for that cycle's matchmaking pass without propagating any exception out of the matchmaking pass and SHALL emit an informational log entry recording that the Stable was skipped for the cycle.

**R3.9** THE function `selectFeaturedTeamBattleMode` defined in R3.1–R3.3 SHALL be the sole derivation of Featured Team Battle Mode in the codebase, AND every other module that needs the Featured Team Battle Mode for a cycle SHALL invoke `selectFeaturedTeamBattleMode(cycleNumber)` rather than reimplementing the parity check.

### R4: Matchmaking

**R4.1** WHEN matchmaking runs for the Featured Team Battle Mode during a cycle's scheduled matchmaking phase, THE Team_Battle_Engine SHALL pair eligible Teams within the same Team_League_Tier instance by selecting, for each Team, the opponent with the smallest absolute Team_ELO difference; ties SHALL be broken by selecting the candidate Team with the earliest Team creation timestamp, mirroring the eligibility/pairing pattern in `tagTeamMatchmakingService.ts`.

**R4.2** IF at least one member robot of a Team is not Robot_Ready at the moment matchmaking runs, THEN THE Team_Battle_Engine SHALL exclude that Team from the current matchmaking run, leave the Team unpaired for that cycle, and not create a `ScheduledTeamBattleMatch` record for it.

**R4.3** IF an odd number of eligible Teams remain in a Team_League_Tier instance for the Featured Team Battle Mode after all other Teams have been paired, THEN THE Team_Battle_Engine SHALL pair the single unmatched Team against a Bye_Team using the same bye-team semantics as the existing tag-team matchmaker.

**R4.4** WHEN a Team is paired for a battle, THE Team_Battle_Engine SHALL persist a `ScheduledTeamBattleMatch` record with `team1_id`, `team2_id` (set to null when the opponent is a Bye_Team and to the opposing Team's identifier otherwise), `team_size`, `team_battle_league`, `team_battle_league_id`, `scheduled_for`, and `status` set to the value that indicates the match is scheduled and has not yet been executed.

**R4.5** WHEN selecting an opponent for a Team during matchmaking, THE Team_Battle_Engine SHALL exclude every Team that appears as that Team's opposing Team in any of that Team's 5 most recently completed battles, mirroring `TAG_TEAM_RECENT_OPPONENT_LIMIT = 5`.

**R4.6** IF an error occurs during pairing or persistence for a single Team such that the Team cannot be paired or its `ScheduledTeamBattleMatch` record cannot be persisted, THEN THE Team_Battle_Engine SHALL log the error with the Team identifier and the matchmaking phase, leave that Team unpaired for the current cycle, and continue matchmaking for the remaining eligible Teams in the Team_League_Tier instance without aborting the matchmaking run.

**R4.7** IF every otherwise-eligible opponent for a Team in its Team_League_Tier instance is excluded by the recent-opponent rule defined in R4.5, THEN THE Team_Battle_Engine SHALL pair that Team with the closest-Team_ELO opponent from the excluded set using the same tie-breaker as R4.1, applying the bye-team rule from R4.3 only if no other Team remains in the tier instance.

### R5: Battle Execution (Simultaneous Active Robots)

**R5.1** WHEN the Team_Battle_Engine simulates a Team Battle with team size N where N ∈ {2, 3}, THE Team_Battle_Engine SHALL place all 2N robots in the arena at combat tick 0 with every robot active (`hp > 0`) and no robot held in reserve.

**R5.2** WHEN the Team_Battle_Engine simulates a Team Battle, THE Team_Battle_Engine SHALL allow each robot with `hp > 0` to independently select exactly one target per combat tick, where a target must be a robot on the opposing side with `hp > 0`, using the same fixed combat tick interval as the 1v1 and Tag Team simulations.

**R5.3** WHEN two or more robots on one side target the same robot on the other side within the same combat tick, THE Team_Battle_Engine SHALL append a Focus_Fire event to the battle log containing the combat tick number, the count of contributors (an integer ≥ 2 and ≤ N), and the target robot ID.

**R5.4** WHEN a combat tick completes, THE Team_Battle_Engine SHALL evaluate whether either side has zero robots remaining with `hp > 0` to determine victory or continuation.

**R5.5** WHEN one side reaches zero robots with `hp > 0` while the other side has at least one robot with `hp > 0`, THE Team_Battle_Engine SHALL set `Battle.winnerId` to the surviving robot with the highest `finalHP` (ties broken by ascending `BattleParticipant.id`), set `BattleParticipant.team` for the surviving side as the winning team, and end the simulation at the end of the current combat tick.

**R5.6** IF the elapsed simulation time reaches 300 seconds before either side has zero robots with `hp > 0`, THEN THE Team_Battle_Engine SHALL declare a draw, set `Battle.winnerId` to `null`, and record a draw outcome entry in the battle log containing the elapsed simulation time and the final `hp` value of every participant.

**R5.7** THE Team_Battle_Engine SHALL persist a single `Battle.battleLog` JSON payload containing the simultaneous-combat narrative for all 2N participants, conforming to a typed schema defined in `app/backend/src/types/`.

**R5.8** WHEN a Team Battle simulation ends (by victory under R5.5 or draw under R5.6), THE Team_Battle_Engine SHALL record per-robot statistics on each `BattleParticipant` row, where `damageDealt` is the cumulative damage the robot dealt, `damageTaken` is the cumulative damage the robot received, `finalHP` is the robot's hp at simulation end clamped to a value ≥ 0, and `survivalSeconds` is the elapsed simulation time at which the robot's `hp` first reached 0 or the total simulation duration if the robot survived, using the same column semantics already used by Tag Team and 1v1 modes.

**R5.9** WHEN a robot's `hp` reaches 0 before the simulation ends, THE Team_Battle_Engine SHALL append an elimination event to the battle log containing the eliminated robot ID, the combat tick number, and the elapsed simulation time in seconds, and SHALL continue the simulation using only the robots that still have `hp > 0`.

**R5.10** IF two or more robots on the winning side have `hp > 0` at the combat tick the Team Battle is decided under R5.5, THEN THE Team_Battle_Engine SHALL distribute reward attribution across all N team members (both surviving and eliminated) using the per-robot contribution metrics defined in R7.

### R6: Team Coordination Attribute Effects and Discussion

**R6.1** WHEN the design document for this spec is submitted for review, THE design document SHALL contain a section with the heading `## Team Coordination Discussion` that contains:
1. A written description of the current 1v1 effects of `syncProtocols`, `supportSystems`, and `formationTactics` as implemented in `app/backend/src/services/arena/teamCoordination.ts`.
2. A proposed scaling table for Team Battle Mode ally effects enumerating the coefficient at each attribute value across the full supported attribute range from 0 to the documented attribute cap, for each of `syncProtocols`, `supportSystems`, and `formationTactics`.
3. The exact formulas chosen for the focus-fire damage bonus (R6.3), the ally shield regeneration bonus (R6.4), and the formation defence bonus (R6.5), with no constant left as TBD.
4. A short rationale paragraph explaining why those formulas and coefficients were chosen.

**R6.2** WHEN a Team Battle simulation is in progress, THE Team_Battle_Engine SHALL apply an Ally_Support_Effect derived from each robot's `syncProtocols`, `supportSystems`, and `formationTactics` attributes, with the exact formulas defined in the Team Coordination Discussion section of the design document and additionally documented in `docs/architecture/COMBAT_FORMULAS.md`.

**R6.3** WHILE two or more allied robots target the same opposing robot in the same combat tick, THE Team_Battle_Engine SHALL apply a focus-fire damage bonus that is non-negative, monotonically non-decreasing in the average `syncProtocols` of the contributing allies, and bounded above by the maximum coefficient defined in the Team Coordination Discussion's scaling table.

**R6.4** WHILE an allied robot is alive and within the formation range defined by the Team Coordination Discussion, THE Team_Battle_Engine SHALL apply a shield regeneration bonus to nearby allies that is non-negative, monotonically non-decreasing in the supporting robot's `supportSystems`, bounded above by the maximum coefficient defined in the Team Coordination Discussion's scaling table, AND THE Team_Battle_Engine SHALL NOT raise any ally's shield value above its documented shield maximum.

**R6.5** WHILE two or more allied robots are positioned within the formation range defined by the Team Coordination Discussion, THE Team_Battle_Engine SHALL apply a damage reduction bonus to those allies that is non-negative, monotonically non-decreasing in the average `formationTactics` of the formation members, and bounded above by the maximum coefficient defined in the Team Coordination Discussion's scaling table.

**R6.6** THE Team_Battle_Engine SHALL expose a Focus_Fire metric, an Ally_Support_Effect metric, and a formation-defence metric per Team in the battle log, each computed as the sum of contributions across every combat tick of the battle and recorded as a non-negative scalar value per Team.

**R6.7** WHEN a Team Battle simulation is run with all participants at `syncProtocols = supportSystems = formationTactics = 0`, THE Team_Battle_Engine SHALL produce zero contribution from R6.3, R6.4, and R6.5 (within a floating-point tolerance of 1e-9), AND the Focus_Fire, Ally_Support_Effect, and formation-defence metrics defined in R6.6 SHALL each be zero (within the same 1e-9 tolerance) for both Teams.

**R6.8** THE 1v1 effects of `syncProtocols`, `supportSystems`, and `formationTactics` defined in `app/backend/src/services/arena/teamCoordination.ts` are out of scope for this spec AND SHALL remain unchanged after this spec is delivered.

### R7: Reward Distribution

**R7.1** WHEN a Team Battle is won, THE Team_Battle_Engine SHALL grant the winning Team a credit reward whose value lies between 0.5× and 2.0× of the existing tag-team winner reward at the same league tier and the same `team_size`, computed by a formula documented in the design.

**R7.2** WHEN a Team Battle is lost, THE Team_Battle_Engine SHALL grant the losing Team a "loser reward" credit grant that is strictly greater than 0 credits and strictly less than the R7.1 winner reward at the same league tier and the same `team_size`.

**R7.3** WHEN a Team Battle ends in a draw, THE Team_Battle_Engine SHALL grant both Teams a draw reward credit grant equal to the R7.2 loser reward at the same league tier and the same `team_size`.

**R7.4** WHEN credits are distributed across the N member robots of a Team that received a credit reward under R7.1, R7.2, or R7.3, THE Team_Battle_Engine SHALL split the Team's credit reward across the N robots such that every surviving robot (`finalHP > 0`) receives at least 1 credit, every destroyed robot (`finalHP = 0`) receives 0 credits only if its `damageDealt = 0` (otherwise it receives at least 1 credit), and the sum of the per-robot credit awards equals the Team's credit reward exactly with no rounding loss.

**R7.5** WHEN a Team Battle completes, THE Team_Battle_Engine SHALL award fame to each member robot using a formula derived from the existing tag-team fame formula `calculateTagTeamFame`, parameterised by `team_size`, such that the sum of fame awarded across the three robots of a 3v3 Team is less than or equal to the sum of fame awarded across the two robots of a 2v2 Team at the same league tier and the same outcome.

**R7.6** WHEN a Team Battle completes, THE Team_Battle_Engine SHALL update the Team_ELO of both Teams using the existing ELO formula already used by tag-team Teams, with the K-factor read from a configuration table keyed by `team_size`, falling back to the existing tag-team K-factor when no `team_size`-specific entry is configured.

**R7.7** WHEN a Team Battle completes, THE Team_Battle_Engine SHALL update the Team_LP of the participating Teams using the existing LP delta rules (won/lost/draw) already used by 1v1 league battles and tag-team battles.

**R7.8** WHEN a Team Battle outcome is settled, THE Team_Battle_Engine SHALL NOT execute any database write that modifies any participating robot's individual robot LP, any participant's tag-team Team_LP, or any tournament standing.

**R7.9** WHEN a Team Battle is a Bye_Team match (`team2_id IS NULL`), THE Team_Battle_Engine SHALL apply the bye-team semantics already used by the tag-team mode, computing the real Team's reward as if its opponent's rating equalled the existing tag-team Bye_Team rating, AND THE Team_Battle_Engine SHALL NOT execute any database write against any opposing Team record.

**R7.10** WHEN a Team Battle execution completes, THE Team_Battle_Engine SHALL emit exactly one audit log row per participating robot per Team Battle, mirroring the existing per-participant audit pattern used by `tagTeamBattleOrchestrator`.

**R7.11** IF any step of reward distribution (audit log emission, credit grant, fame grant, ELO update, Team_LP update, or team-history record) fails for a Team Battle, THEN THE Team_Battle_Engine SHALL roll back every reward-distribution write performed for that Team Battle within the same Prisma interactive transaction AND SHALL mark the match as `cancelled`.

### R8: League and Standing System

**R8.1** A Team SHALL hold its own per-`team_size` `team_lp`, `team_elo`, `team_league`, and `team_league_id` fields for each of `team_size` ∈ {2, 3} independently, AND THE Team_Battle_Engine SHALL NOT modify any robot-level league standing or any tag-team standing as a result of any Team Battle outcome.

**R8.2** WHEN a Team's `team_lp` reaches or exceeds the promotion threshold defined for its current Team_League_Tier instance, THE Team_Battle_Engine SHALL promote the Team to the next Team_League_Tier instance and adjust its `team_lp` according to the existing league-tier promotion rules already used per Team Battle size.

**R8.3** WHEN a Team's `team_lp` reaches or falls below the relegation threshold defined for its current Team_League_Tier instance, THE Team_Battle_Engine SHALL relegate the Team to the previous Team_League_Tier instance and adjust its `team_lp` according to the existing league-tier relegation rules already used per Team Battle size.

**R8.4** WHEN a Team is promoted or relegated, THE Team_Battle_Engine SHALL record a row containing at minimum the Team identifier, the `team_size`, the previous Team_League_Tier instance, the new Team_League_Tier instance, the change type (promotion or relegation), and the timestamp, AND THE row SHALL be retrievable in chronological order via the existing league history query interface.

**R8.5** THE Team Battle league system SHALL use the same six-tier structure (`bronze`, `silver`, `gold`, `platinum`, `diamond`, `champion`) used by 1v1 and tag-team modes, with the same per-tier instance subdivisions (`bronze_1`, `bronze_2`, `silver_1`, `silver_2`, …) applied independently per `team_size`.

**R8.6** WHEN a Team is registered, THE Team_Battle_Engine SHALL place the Team in the `bronze_1` instance for its `team_size` and SHALL set the Team's starting `team_lp` to the value defined by the existing 1v1 and tag-team registration rules, AND the Team SHALL progress from there through normal play.

**R8.7** WHILE a Team is in the `champion` tier, THE Team_Battle_Engine SHALL NOT promote the Team further AND SHALL NOT record a league history row of type promotion for that Team.

**R8.8** WHILE a Team is in the `bronze_1` instance, THE Team_Battle_Engine SHALL NOT relegate the Team further AND SHALL NOT record a league history row of type relegation for that Team.

### R9: UI Surfaces

**R9.1** WHEN the Battle page (`app/frontend/src/pages/BattlePage.tsx`) is rendered, THE Battle page SHALL display the Featured Team Battle Mode for the current cycle and the player's Team_Battle_League standings (rank and current Team_LP) for both the 2v2 Team and the 3v3 Team.

**R9.2** WHEN a robot card is rendered on the Robots page, THE robot card SHALL display, for each of the three Team types the robot belongs to, an independent membership chip — chip text "Tag Team" for Tag Team membership, "2v2 Team" for 2v2 Team Battle membership, and "3v3 Team" for 3v3 Team Battle membership — using the existing chip pattern, AND IF the robot belongs to none of the three Team types, THEN THE robot card SHALL NOT display a Team membership chip.

**R9.3** WHEN the Robot Detail page is rendered, THE Robot Detail page SHALL include a Team Battle history section that lists, per `team_size`, each battle the robot participated in with the fields `team_size`, opponent Team name (or "Bye" for Bye_Team matches), outcome, `damageDealt`, `damageTaken`, `finalHP`, `survivalSeconds`, Team_LP delta, and Team_ELO delta, ordered most-recent-first and limited to 50 rows per page.

**R9.4** WHEN a Team Battle results screen is rendered, THE results screen SHALL list every participating robot for each of the two sides with the per-robot fields `damageDealt`, `damageTaken`, `finalHP`, and `survivalSeconds`, AND SHALL display the Team_LP delta and Team_ELO delta as Team-level fields distinct from the per-robot fields.

**R9.5** THE Battle History page SHALL include a battle-mode filter implemented as a mutually-exclusive option set with options "All" (default), "Tag Team", "Team Battle 2v2", "Team Battle 3v3", and the existing battle modes already exposed by the filter.

**R9.6** THE Hall of Records page SHALL include a Team Battle records section that lists, per `team_size`, the top 10 records for each of the following categories: fastest victory (lowest battle duration in seconds for a non-draw battle), longest survival by a single robot in Team Battle (highest `survivalSeconds` on a single `BattleParticipant` row in a `team_2v2` or `team_3v3` battle), most damage dealt by a single robot in Team Battle (highest `damageDealt` on a single `BattleParticipant` row in a `team_2v2` or `team_3v3` battle), most decisive victory (largest absolute difference between the sums of `finalHP` across the two sides for a non-draw battle), and longest battle that still ended in a winner (highest battle duration in seconds for a non-draw battle), AND THE Team Battle records SHALL be cached using the existing `TimedCache` instance in `app/backend/src/routes/records.ts`, AND `app/backend/src/routes/records.ts` SHALL be extended (not replaced) to return Team Battle records alongside the existing records, AND the frontend `app/frontend/src/components/hall-of-records/` components SHALL render the new records using the same component pattern used by the existing records.

**R9.7** WHEN a Team Battle completes for a player, THE Match Notifications system SHALL emit a notification to the player containing the `team_size`, the outcome, the opponent Team name (or "Bye" for Bye_Team matches), and the Team_LP delta.

**R9.8** A unified `/team-battles` page SHALL serve as the single management surface for Tag Team, 2v2 Team Battle, and 3v3 Team Battle from one stable's perspective, AND the page SHALL list all three Team types side-by-side with a "Register a Team" affordance per type when the stable does not yet own a Team of that type, a member-management view per type when the stable owns a Team of that type, and the standings view per type, AND the page MAY reuse `app/frontend/src/pages/TagTeamManagementPage.tsx` and `app/frontend/src/pages/TagTeamStandingsPage.tsx` as components rather than replacing them, AND for each type the assigned roster size SHALL be enforced as exactly 2 robots for a Tag Team or a 2v2 Team Battle Team and exactly 3 robots for a 3v3 Team Battle Team, AND the `team_name` for a Team Battle Team SHALL be validated against `safeName` and bounded between 3 and 32 characters inclusive (Tag Team naming rules are unchanged).

**R9.9** WHEN the Battle page is rendered for a player, IF no Team_Battle_League standings exist for the player at the Featured Team Battle Mode size, THEN THE Battle page SHALL display an explicit empty-state placeholder for the missing standings instead of leaving the standings region blank.

**R9.10** WHEN the Battle page is rendered for a player, IF the player has not registered a Team for the Featured Team Battle Mode size, THEN THE Battle page SHALL display an explicit empty-state placeholder describing that no Team is registered for the featured size.

**R9.11** WHEN the Robot Detail page is rendered for a robot, IF the robot has no Team Battle participation history, THEN THE Team Battle history section SHALL display an explicit empty-state placeholder instead of an empty list.

**R9.12** WHEN a request is made to the existing `/tag-teams` route in `app/frontend/src/App.tsx` (or to `/tag-teams/standings`), THE frontend router SHALL redirect the request to the equivalent tab on `/team-battles` (e.g. `/team-battles?tab=tag-team`) such that no existing in-app link to `/tag-teams` resolves to a 404, AND no existing component, navigation entry, or test that links to `/tag-teams` SHALL be left pointing at a removed route without a redirect.

### R10: Validation, Authorization, and Security

**R10.1** Every new Team Battle route SHALL declare a Zod schema covering its body, query, and params (as applicable) and SHALL use the existing `validateRequest` middleware from `app/backend/src/middleware/schemaValidator.ts`, AND no Team Battle route file SHALL contain an ESLint disable directive for the existing `custom-routes/require-validate-request` rule.

**R10.2** Every Team Battle route that mutates a Team SHALL invoke an ownership-verification helper inside the same Prisma interactive transaction as the mutation it gates, such that ownership is verified and the mutation is committed atomically with no intervening read available to a concurrent caller.

**R10.3** WHEN a Team registration or member-change route is invoked, THE Team_Battle_Engine SHALL run inside a Prisma interactive transaction that issues `SELECT … FOR UPDATE` on the affected `team_battle` row and on every affected `team_battle_member` row, AND THE row locks SHALL be held until the transaction commits or rolls back, AND the locks SHALL block concurrent matchmaking reads against the same Team and concurrent member-change writes against the same Team.

**R10.4** WHEN a Team Battle match execution completes (whether the match succeeded or was cancelled), THE Team_Battle_Engine SHALL emit exactly one `audit_log` row per participating Team member with `eventType` value `'team_battle_2v2'` for a 2v2 battle and `'team_battle_3v3'` for a 3v3 battle, with payload schemas documented in `app/backend/docs/audit-logging-schema.md`, AND the audit rows SHALL be persisted before the execution returns to the caller.

**R10.5** IF a Team Battle execution fails for a single match, THEN THE Team_Battle_Engine SHALL mark that match as `cancelled`, record the failure cause on the match record, surface the cancelled match in the result returned to the caller, AND continue executing the remaining scheduled matches in the same cycle.

**R10.6** IF an ownership-verification helper invoked by a Team Battle mutating route fails because the requester does not own the Team, the Team does not exist, or the requester is not a member of the Team, THEN THE Team Battle route SHALL return HTTP status 403 with the response body string "Access denied", AND the response payload SHALL be byte-identical across all three failure causes so that the caller cannot distinguish whether the Team exists.

### R11: Telemetry and Observability

**R11.1** WHEN a Team Battle execution completes, THE Team_Battle_Engine SHALL emit a structured log line with the cycle number, `team_size` (2 or 3), `team1_id`, `team2_id`, league instance, duration in milliseconds, and outcome (one of `team1_win`, `team2_win`, `draw`), using the same field structure and `[TagTeamBattles]`-style log prefix conventions already used by the existing tag-team log line format.

**R11.2** THE admin Battle dashboard SHALL accept a `team_size` filter restricted to the values 2 or 3 and a league tier filter restricted to the values defined by the existing league system, AND WHEN a filter value is selected, THE admin Battle dashboard SHALL display the filtered Team Battle records within 2 seconds of the filter selection.

**R11.3** WHERE existing analytics views already split battle records by `battleType`, THOSE existing analytics views SHALL recognise `'team_2v2'` and `'team_3v3'` and SHALL render them with the same row, column, and chart-series treatment given to other `battleType` values.

**R11.4** IF the admin Battle dashboard receives a `team_size` filter value other than 2 or 3 or a league tier filter value not recognised by the existing league system, THEN THE admin Battle dashboard SHALL reject the filter selection while preserving the previously applied filter state and SHALL NOT crash the UI.

### R12: Documentation Updates

**R12.1** `docs/game-systems/PRD_MATCHMAKING.md` SHALL contain a section with the heading `## Team Battle Matchmaking` describing Team Battle pairing rules per `team_size`, the parity-based Featured Team Battle Mode selection, the Bye_Team rule, and the recent-opponent exclusion rule.

**R12.2** `docs/architecture/COMBAT_FORMULAS.md` SHALL contain a section with the heading `## Team Battle Engine` describing Team Battle resolution rules and the formulas for the Team Coordination Attribute ally effects (focus-fire damage, ally shield regen, formation defence) referencing the scaling table defined in the Team Coordination Discussion section of the design document.

**R12.3** `.kiro/steering/game-mechanics-reference.md` SHALL list the entries `Team Battle 2v2` and `Team Battle 3v3` in the section that enumerates battle modes, alongside the existing battle modes.

**R12.4** `.kiro/steering/project-overview.md` SHALL include the entry `Team Battle Mode` in the "Key Systems" list.

**R12.5** `docs/BACKLOG.md` SHALL mark item #31 as completed and SHALL contain a reference to this spec at `.kiro/specs/to-do/37-team-battles-2v2-3v3/`.

**R12.6** A new in-game guide article on Team Battle Mode SHALL be created via the existing in-game guide system AND SHALL contain at minimum: an explanation of the difference between Team Battle 2v2 and Team Battle 3v3, the Team Coordination Attribute ally effects, the daily alternation rule, the Team registration flow, and the Team eligibility rules.

**R12.7** A public changelog entry SHALL be created via the in-game changelog system AND SHALL contain at minimum: a list of both new modes (Team Battle 2v2 and Team Battle 3v3), a summary of the Team Coordination Attribute changes, and a link to the in-game guide article created under R12.6.

**R12.8** `docs/architecture/PRD_SERVICE_DIRECTORY.md` SHALL list the new directory `app/backend/src/services/team-battle/` AND SHALL contain a one-line description for each file under that directory.

**R12.9** A pull request or release for this spec SHALL be blocked from merging or shipping IF any of the documentation updates required by R12.1 through R12.8 is absent, where absence is verified via the grep checks listed in the Verification Criteria section of this requirements document.

### R13: Property-Based Test Coverage

**R13.1** A property-based test file SHALL exist that, for at least 100 randomised runs over Team Battles composed of randomly generated valid Teams with `team_size` ∈ {2, 3} and Team Coordination Attribute values in the closed interval [0, the documented attribute cap], asserts that the absolute difference between total damage dealt across all participants and total damage taken across all opposing participants is at most 0.01 HP (combat conservation invariant).

**R13.2** A property-based test file SHALL exist that, for at least 100 randomised runs over `cycleNumber` in the closed interval [0, 10000], asserts that `selectFeaturedTeamBattleMode(cycle)` returns the same value on every invocation for a given `cycle` (determinism) AND returns a different documented mode value (`'team_2v2'` for one and `'team_3v3'` for the other) for `cycle` and `cycle + 1`.

**R13.3** A property-based test file SHALL exist that, for at least 100 randomised runs with `team_size` ∈ {2, 3} and `syncProtocols` values A and B in the closed interval [0, the documented attribute cap] with all other inputs held identical, asserts that A ≤ B implies focus-fire damage bonus at A ≤ focus-fire damage bonus at B (pairwise monotonically non-decreasing).

**R13.4** A property-based test file SHALL exist that, for at least 100 randomised runs with `team_size` ∈ {2, 3} and `supportSystems` values A and B (and separately `formationTactics` values A and B) in the closed interval [0, the documented attribute cap] with all other inputs held identical, asserts that A ≤ B implies ally shield regen bonus at A ≤ ally shield regen bonus at B AND that A ≤ B implies ally formation defence at A ≤ ally formation defence at B (pairwise monotonically non-decreasing).

**R13.5** A property-based test file SHALL exist that, for at least 100 randomised runs over Team Battles with `team_size` ∈ {2, 3} that terminate with exactly one Team flagged as winner per the documented win-condition rules (a non-draw simulation), asserts that the winning Team has at least one member with `finalHP` strictly greater than zero.

**R13.6** A property-based test file SHALL exist that, for at least 100 randomised runs over Team Battles with `team_size` ∈ {2, 3}, asserts that:
1. The absolute difference between the sum of credits distributed across the N member robots and the documented Team-level credit reward is at most 1 credit (rounding tolerance).
2. No member robot receives a negative credit reward.

**R13.7** WHEN any property defined in R13.1–R13.6 fails, fast-check SHALL report the seed and the shrunk counter-example AND THE CI run SHALL fail.

### R14: Cycle Integration (Production Cron, Local Bulk-Cycle, Manual Triggers)

**R14.1** WHEN the Cycle_Scheduler runs the production cycle for a given `cycleNumber`, THE Cycle_Scheduler SHALL invoke Team Battle matchmaking and Team Battle execution for the size returned by `selectFeaturedTeamBattleMode(cycleNumber)` once per cycle, AND THE Cycle_Scheduler SHALL NOT invoke Team Battle matchmaking or execution for any other size during that cycle.

**R14.2** WHEN the Admin_Bulk_Cycle_Service `executeBulkCycles` runs a cycle for a given `cycleNumber`, THE Admin_Bulk_Cycle_Service SHALL include a Team Battle matchmaking step and a Team Battle execution step gated by the same `selectFeaturedTeamBattleMode(cycleNumber)` selector used by R14.1, such that running N cycles locally exercises Team Battle exactly as production does.

**R14.3** THE admin routes file `app/backend/src/routes/admin.ts` SHALL expose two manual-trigger endpoints — one for Team Battle matchmaking and one for Team Battle execution — that accept the Featured Team Battle Mode size as input and that mirror the existing `/api/admin/tag-teams/matchmaking` and `/api/admin/tag-teams/battles` endpoints in URL shape, request body shape, and response body shape, so an admin on Admin_Cycle_Controls can fire a Team Battle pass on demand.

**R14.4** THE two manual-trigger endpoints required by R14.3 SHALL be guarded by `authenticateToken` followed by `requireAdmin` (mirroring the tag-team endpoints) AND SHALL emit one `adminAuditLog` row per invocation via `recordAuditAction`, with the same success/failure outcome semantics as the tag-team endpoints.

**R14.5** THE two manual-trigger endpoints required by R14.3 SHALL declare Zod schemas via `validateRequest` from `app/backend/src/middleware/schemaValidator.ts` for their body, query, and params (as applicable), conforming to R10.1 and the `custom-routes/require-validate-request` ESLint rule.

**R14.6** THE cycle integration introduced by R14.1 through R14.5 SHALL NOT modify `executeScheduledTagTeamBattles`, `runTagTeamMatchmaking`, `executeScheduledBattles`, `executeScheduledKothBattles`, `runKothMatchmaking`, `processTournamentBattle`, or any other existing mode's cycle integration code, AND `git diff --name-only` for the spec implementation SHALL NOT show changes inside `app/backend/src/services/tag-team/`, `app/backend/src/services/league/`, `app/backend/src/services/koth/`, or `app/backend/src/services/tournament/` for purposes related to the existing modes' cycle wiring.

**R14.7** IF the Team Battle matchmaking step or the Team Battle execution step fails inside `executeBulkCycles` for a single cycle iteration, THEN THE Admin_Bulk_Cycle_Service SHALL record the failure on the per-cycle result, continue executing the remaining steps for that cycle (mirroring the current behaviour for tag-team failures), and continue executing subsequent cycle iterations.

### R15: Seeded / Auto-Generated Stables

**R15.1** THE tier configuration system in `app/backend/src/utils/tierConfig.ts` SHALL extend the `TierConfig` interface with two boolean flags `createTeamBattle2v2` and `createTeamBattle3v3`, and the `TIER_CONFIGS` array SHALL set values for these flags on every existing tier row.

**R15.2** WHEN `generateBattleReadyUsers` in `app/backend/src/utils/userGeneration.ts` creates a seeded stable from a tier whose `createTeamBattle2v2` is `true` and the seeded stable owns at least 2 robots, THE user generation utility SHALL register a 2v2 Team for that stable using exactly 2 of the seeded robots.

**R15.3** WHEN `generateBattleReadyUsers` in `app/backend/src/utils/userGeneration.ts` creates a seeded stable from a tier whose `createTeamBattle3v3` is `true` and the seeded stable owns at least 3 robots, THE user generation utility SHALL register a 3v3 Team for that stable using exactly 3 of the seeded robots.

**R15.4** WHEN a seeded 2v2 or 3v3 Team is created under R15.2 or R15.3, THE user generation utility SHALL invoke the same Team registration code path used by a player-initiated Team registration request, such that every validation rule defined in R2 (size, ownership, member uniqueness, name validation, robot eligibility) is enforced for seeded Teams identically to player-initiated Teams.

**R15.5** WHEN a seeded 2v2 or 3v3 Team is created under R15.2 or R15.3, THE user generation utility SHALL assign the Team to its initial `Team_League_Tier` instance using either the existing `assignTagTeamLeagueInstance` helper from `app/backend/src/services/tag-team/tagTeamLeagueInstanceService.ts` or a parallel `assignTeamBattleLeagueInstance` helper exposed by the Team Battle service module (the choice between the two SHALL be made in the design document).

**R15.6** THE return value of `generateBattleReadyUsers` (`TieredGenerationResult`) SHALL be extended with two integer fields `teamBattle2v2Created` and `teamBattle3v3Created`, both populated from the count of seeded Teams successfully registered during the run, AND THE admin UI surface that displays the existing `tagTeamsCreated` count SHALL be extended to display the two new counts alongside it.

**R15.7** IF a seeded Team registration under R15.2 or R15.3 fails validation under R15.4 for a given stable, THEN THE user generation utility SHALL log the failure with the seeded stable's username and the validation error code, skip the Team registration for that stable, and continue generating subsequent stables without aborting the run.

### R16: Achievement System Integration

**R16.1** THE `AchievementTriggerType` union in `app/backend/src/config/achievements.ts` SHALL gain two new values `team_2v2_wins` and `team_3v3_wins`, AND THE `EVENT_TRIGGER_MAP` for the `'battle_complete'` event in `app/backend/src/services/achievement/achievementService.ts` SHALL include both new trigger types.

**R16.2** WHEN a Team Battle of `battleType` `'team_2v2'` is settled and a robot's Team won, THE Team_Battle_Engine SHALL increment that robot's `totalTeam2v2Wins` field by 1, AND WHEN a Team Battle of `battleType` `'team_3v3'` is settled and a robot's Team won, THE Team_Battle_Engine SHALL increment that robot's `totalTeam3v3Wins` field by 1.

**R16.3** THE Prisma schema for the `Robot` model SHALL gain two new integer fields `totalTeam2v2Wins` and `totalTeam3v3Wins` with default value 0, AND THE migration adding these fields SHALL backfill existing rows to 0.

**R16.4** `app/backend/src/config/achievements.ts` SHALL gain at least one easy-tier achievement row and at least one hard-tier achievement row per Team Battle size, for a total of at least four new rows: a 2v2 first-win achievement (`triggerType: 'team_2v2_wins'`, `triggerThreshold: 1`, easy tier), a 2v2 mastery achievement (`triggerType: 'team_2v2_wins'`, hard tier, threshold defined in design), a 3v3 first-win achievement (`triggerType: 'team_3v3_wins'`, `triggerThreshold: 1`, easy tier), and a 3v3 mastery achievement (`triggerType: 'team_3v3_wins'`, hard tier, threshold defined in design). Iconography is decided in the design document.

**R16.5** THE `checkAllModesWin` logic in `app/backend/src/services/achievement/achievementService.ts` (which backs the existing C18 "Autobots, Roll Out!" achievement) SHALL be updated to require the user to hold at least one win in each of six modes — league, KotH, tag-team, tournament, `team_2v2`, and `team_3v3` — and SHALL return `true` only when wins exist in all six.

**R16.6** THE description string of the existing C18 "Autobots, Roll Out!" achievement row in `app/backend/src/config/achievements.ts` SHALL be updated to enumerate the six modes (league, KotH, tag team, tournament, 2v2 Team Battle, 3v3 Team Battle), AND a public changelog entry SHALL be created via the existing changelog system that documents the C18 expansion so existing earners understand why the achievement may now show "in progress" again on profiles.

**R16.7** WHEN the C18 achievement requirement is expanded under R16.5, IF a player already holds a `UserAchievement` row for `achievementId = 'C18'`, THEN THE achievement service SHALL leave that row in place (the existing earner retains the achievement), AND IF a player does not yet hold a `UserAchievement` row for `achievementId = 'C18'`, THEN the new six-mode requirement SHALL apply.

**R16.8** THE achievement progress UI in the frontend SHALL render `team_2v2_wins` and `team_3v3_wins` progress (current value, target threshold, label, and best-robot-for highlight) using the same component pattern and best-robot-selection helper currently used to render `tag_team_wins` progress, with the helper extended to recognise the two new trigger types.
