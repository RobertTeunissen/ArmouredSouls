# Automaton Stables

**Spec:** #55 · **Status:** Implemented (ACC) · **Last updated:** October 2026

Automaton_Stables are persistent, themed, computer-run stables that play by the same rules as human players. They buy robots, facilities, attributes, weapons and refinements through the same services and credit paths as a player, enter the same events, survive every Season_Rollover and rebuild themselves from the human starting balance.

Operator procedures are in `docs/guides/AUTOMATON_OPERATIONS_GUIDE.md`. The approved creative content (strategies, Build_Focus weights, the 11 starter stables, every player- and admin-visible string) is the Review_Pack in `.kiro/specs/done-october26/55-automaton-stables/review/`.

## Purpose

Before Spec #55 the only computer stables were Generated_Stables (`auto_*` bots and seeded `test_user_*` accounts): created per cycle, never upgraded, deleted at every rollover. They fill matchmaking pools but never grow, so a human stable that improves leaves them behind within weeks. Automatons give the game a stable, recognisable population of opponents that grows over a season like a human stable and makes the same economic trade-offs.

## Stable_Type

`User.stableType` classifies every account:

| Value | Meaning | `isGenerated` |
|---|---|---|
| `human` | A player account (default) | `false` |
| `generated` | Generated_Stable: `auto_*` bots and `test_user_*` seeds | `true` |
| `automaton` | An activated Automaton_Stable (`automaton_{catalogueKey}`) | `false` |

Invariant I1: `isGenerated = true` ⇔ `stableType = generated`. Because Automatons are `isGenerated = false`, the existing rollover archives and resets them exactly like humans; the persistent Automaton_Profile lets them rebuild.

## Lifecycle

- **Draft_Automaton:** an `automaton_profiles` row with no `User`. Invisible to players by construction. Its stable name is reserved in `plannedStableName` and checked against `User.stableName` and other drafts.
- **Activation** (one-way): creates the `User` (`stableType = automaton`, ₡3,000,000, `hasCompletedOnboarding = true`, random never-stored password), clears `plannedStableName`. Requires a valid strategy, enough Robot_Blueprints for every robots Goal_Target (R3.7) and the Team_Names the Team_Rule needs. The stable joins the cohort at the next Turn_Step, like a human registering mid-season.
- **Active_Automaton:** cannot be deleted, paused or retired individually. An active stable can be renamed under the human rename rules.
- **Program_Switch:** one global switch (`automaton_program_settings.turns_enabled`). When off, every Automaton_Turn is recorded `skipped` with `program_off`; nothing else changes. Used for incidents.
- **Access:** Automaton accounts cannot log in (generic `401 Invalid credentials` before the password check), any token for one is rejected, and password reset or account reset returns `AUTOMATON_ACCOUNT_LOCKED` (409).

## Strategies

An Upgrade_Strategy is a numbered Build_Order of Goals. Each strategy version is a Strategy_Definition_File (`app/backend/src/config/automaton-strategies/{key}.v{n}.json`) that combines Goal types from the code Goal_Library (`services/automaton/goals/`): `robots`, `facility(type)`, `attributes`, `weapons`, `refine`. New Goal types are code changes; new strategies and versions are data.

| Strategy | Intent |
|---|---|
| Swarm | Goes wide: as many robots as prestige allows (target 11), kept evenly upgraded |
| Paragon | Goes tall: one robot built as far as facilities allow, premium weapon fully refined |
| Duo | Two robots, a 2v2 team at once; 2v2 League, Tag Team and 2v2 Tournament first |
| Trio | Three robots in a 3v3 and a 2v2 team; 3v3 events first (up to 6 robots when configured) |
| Tycoon | Income first: Merchandising Hub and Streaming Studio before growing to two robots |
| Generalist | Steady all-rounder: two robots, a moderate mix of every facility and upgrade |

Rules every strategy follows (decisions 1, 2, 14, 19, 29, 30):

- The planner walks the Build_Order and takes the first Goal that is not Satisfied or Blocked. If its next step is affordable it is bought; if not, the stable is Saving and buys nothing lower in the list. There is no reserve, no buffer and no saving timeout.
- A Goal buys its own prerequisites (Goal_Chain): robots buy Roster Expansion and Storage Facility levels, attributes buy academy levels, refinements buy the Weapons Workshop level their tier needs. A prerequisite behind an unmet Prestige_Gate makes the Goal Blocked, which costs nothing, and the planner moves on.
- Every Build_Order contains every required Goal type with a default above 0 and ends with "Attributes → Max".
- Booking Office is bought early and never above the useful level: L1 with one robot, L4 when a 2v2 team exists, L6 when a 3v3 team exists.

Goal_Targets are editable per stable in the admin page within the bounds of the strategy version. The conformance suite proves every target combination inside those bounds safe, so a target edit needs no deploy and no test run.

### Build_Focus

Each Robot_Blueprint has one of six Build_Focus presets (Bruiser, Deadeye, Warden, Sprinter, Tactician, Versatile). A preset is a set of attribute-group weights. Attribute milestones are raised group by group in the preset's priority order across all robots, lowest attribute first; the same weights split the Tuning Bay pool. Weights and opening builds are in the Review_Pack `STRATEGIES.md` §3–§10.

### Weapons and refinements

- A Weapon_Path has one column per hand. The starter catalogue uses two stages: starter and final. Range is never configured; the combat engine derives it from the equipped weapons.
- Weapon_Reuse: before buying, the Automaton equips a matching unequipped weapon from storage. A new robot starts at the highest stage storage can fill.
- Storage_Overflow_Rule (fixed): replaced weapons stay in storage; when storage is full, an unequipped weapon no blueprint still needs is sold first, then the cheapest; a Storage Facility level is bought only when nothing unequipped is left.
- Every blueprint has a Refinement_Plan (decision 35): at least one step on every non-shield weapon of the final stage, at most 5 per weapon. Starter plans are ordered by value: Sharpen, Sharpen, Forge, Forge first; a Hone or Augment only where it is cheaper than the same points on the robot. The Refine Goal_Target is the number of plan steps per robot (0–10).

### Teams and events

- Team_Rule (fixed): 2v2 teams are slots 1+2, 3+4, 5+6, 7+8, 9+10; 3v3 teams are slots 1–3, 4–6, 7–9; slot 11 is in no team. A team registers in the turn its last member joins and is never disbanded, swapped or renamed. The catalogue only supplies Team_Names.
- Event_Order: each stable lists all 9 subscribable event types in order of preference. Solo events go to every robot with a free Booking Office slot; a team event goes to the whole team or to none of it.

### Versioning and pinned profiles

Each Automaton_Profile is pinned to a Strategy_Version. Deploying `{key}.v{n+1}.json` changes no stable. An admin upgrades stables in the Strategy_Library with a dry run and confirmation; Goal_Targets migrate by Goal type and occurrence, clamped to the new bounds. A stable whose migrated targets break its own rules stays on its version and raises an alert (decision 37). The server refuses to start when a profile's pinned file is missing or invalid.

New strategies are designed in the admin Strategy_Builder, previewed, exported and merged through a pull request; CI runs the conformance suite and the generic scenario test on every file (see the operations guide).

## Turn timing and budgets

An Automaton acts once per cycle in a Turn_Step that runs after the cycle is closed, never inside the Serialized_Cycle_Cutover:

| Turn_Trigger | When | Turn_Slot |
|---|---|---|
| `settlement` | After a competitive settlement close (scheduler and admin bulk cycles), not on the season's boundary settlement | the closed global cycle number |
| `preparation` | After each Preparation_Phase advance (scheduler and admin bulk cycles) | `preparationCyclesCompleted` |
| `season_open` | Rollover Stage 5, after the new season opens | 0 |

Purchases therefore book to the new cycle exactly like a human buying after settlement, and on the boundary settlement no credits are spent before the reset.

- Each stable gets at most one Turn_Record per `(profile, season, trigger, slot)`. A retried step skips completed turns and re-plans failed ones from fresh facts; deterministic request keys prevent a duplicate charge.
- Turn_Budget: 60 charged actions and 10 s per Automaton_Turn (`turn_budget_exhausted`); 300 s per Turn_Step, after which the remaining stables are `skipped` with `step_budget_exhausted` and an alert is raised. Skipped stables build at their next turn.
- A failing Automaton never fails settlement or rollover and never blocks the other Automatons; the turn is recorded `failed` and alerts.
- Free_Upkeep (teams, subscriptions, stance and yield sync, tuning) runs at the start and end of every turn and costs nothing.

Measured on the heavy simulation (100 Active_Automatons, local Apple Silicon, PostgreSQL 17): opening-build Turn_Steps 244 s (first preparation) and 260 s (`season_open`), steady-state settlement steps 5–12 s, slowest single turn 4.5 s. The opening steps pass the 300 s hard limit but miss the 180 s design target; most time is spent in the shared purchase path (audit, locks, cycle identity, achievement checks). With the 11 starter stables the opening step scales to roughly 27 s (an extrapolation from the 100-stable figure, not a measurement). The full simulation runs about 14 minutes locally.

## Economic boundaries

- Every charge goes through the extracted domain services and Credit_Mutation_Service, with one Financial_Pair per charged action and an Automaton audit context. No code in `services/automaton/` writes `User.currency`.
- No grants: an Automaton gets exactly the human starting balance (₡3,000,000) and the income every stable earns. There is no catch-up money.
- **Handicap:** Automatons never use Manual_Repair. Automatic_Repair before each battle charges them the full quote, as it does a human who did not repair manually.
- A negative balance is possible, as for humans (operating costs). The turn still runs upkeep, buys nothing, and raises a negative-balance alert.

## Season_Rollover behaviour

- Archive: Active_Automatons are archived like humans; `stable_season_archives.stable_type` and `subject_stable_type` on snapshots and accolades record the Stable_Type.
- Reset: the Human_Reset_Contract applies (robots, facilities, weapons, standings deleted; ₡3,000,000; prestige 0).
- Preserved: Automaton_Profiles, blueprints, Goal_Targets, Team_Names, Event_Orders, the Program_Switch row and uploaded images. `automaton_turns` is purged with the history tables.
- Stage 5 runs the `season_open` Turn_Step, so every Automaton opens the new season with its opening build.
- Achievements: Automatons are re-awarded preserved-state achievements like humans (decision 3).

## Catalogue flow

Reviewed stable definitions live in the repository as Catalogue_Entries (`app/backend/prisma/automaton-catalogue/{catalogueKey}.json`). On every ACC deploy Catalogue_Sync (`pnpm run automaton:sync`) inserts new entries as Draft_Automatons. It is insert-only, with one exception: a blueprint without an image gets its Repository_Image (`app/frontend/public/assets/automatons/{catalogueKey}/{slot}.webp`). Edits made in the admin page are never overwritten. Admin edits travel back to the repository through Catalogue_Export → `pnpm run automaton:unpack` → pull request.

### The 11 starter stables

This spec delivers exactly these stables (decision 32). More follow through the admin page or a later spec.

| Catalogue_Key | Stable | Franchise | Strategy | Blueprints |
|---|---|---|---|---|
| `clone-legion` | Kamino Clone Legion | Star Wars — Clone Troopers | Swarm | 11 |
| `dalek-empire` | Skaro Dalek Empire | Doctor Who — Daleks | Swarm | 11 |
| `robocop-precinct` | Old Detroit Precinct | RoboCop | Paragon | 2 |
| `skynet-terminators` | Cyberdyne Skynet | The Terminator | Paragon | 2 |
| `jaeger-corps` | Pan Pacific Defense Corps | Pacific Rim — Jaegers | Duo | 3 |
| `light-labs` | Light Labs | Mega Man | Duo | 3 |
| `decepticon-armada` | Decepticon Armada | Transformers — Decepticons | Trio | 4 |
| `white-base` | White Base Mobile Suits | Mobile Suit Gundam | Trio | 4 |
| `planet-express` | Planet Express Crew | Futurama | Tycoon | 3 |
| `world-robot-boxing` | World Robot Boxing | Real Steel | Tycoon (goal 20 Robots → 3) | 3 |
| `autobots-ark` | Autobots of the Ark | Transformers — Autobots | Generalist (goal 14 Robots → 3) | 4 |

Franchise and backstory are admin-only; showing them to players is backlog #61.

## Competitive parity and matchmaking

- Automatons compete with full parity (decision 33): promotions and demotions, tournaments, season accolades, Hall of Records and the season archive work exactly as for human stables. They earn achievements by the same triggers, except those only a manual action triggers (Manual_Repair, practice battles).
- Achievement rarity ("x% of players") counts humans only (decision 38).
- On a local or otherwise empty environment Automatons win everything. That is expected; the Strategy_Comparison then shows no human reference row.
- Matchmaking is unchanged (decision 34): Automatons are matched against each other and against humans like any stable.

## Player-facing presentation

The only player-visible marker is the Automaton_Badge (gear icon and "Automaton", theme `info` purple) after the stable name on leaderboards, league standings, every Hall of Records record that names a stable (decision 42), the stable profile, robot detail, battle report and season archive. The strategy name, franchise and backstory are never shown. There is no in-game guide article. Page details are in the page PRDs and `DESIGN_SYSTEM_AND_UX_GUIDE.md`.

## Admin control

`/admin/automatons` (admin only, audited) has a Status_Bar and four sections: Stables (with Needs attention), Strategies (Strategy_Comparison, Strategy_Library, Strategy_Builder), Editor (stable, teams, Event_Order, numbered Build_Order with Turn_Preview statuses, blueprints, cycle history) and Catalogue. There are deliberately no controls to run a turn, delete an active stable, edit live robots, teams, subscriptions or weapons, or change a balance. See `docs/guides/ADMIN_PANEL_GUIDE.md` and `docs/prd_pages/PRD_ADMIN_PAGE.md`.

## Related documents

- `docs/guides/AUTOMATON_OPERATIONS_GUIDE.md` — operator procedures
- `docs/game-systems/PRD_SEASON_SYSTEM.md` — rollover stages incl. Stage 5
- `docs/game-systems/PRD_CYCLE_SYSTEM.md` — Turn_Step placement
- `docs/game-systems/PRD_ECONOMY_SYSTEM.md` — Automaton spending paths
- `docs/architecture/DATABASE_SCHEMA.md` — `automaton_*` tables and invariants
- `docs/architecture/PRD_SERVICE_DIRECTORY.md` — `services/automaton/`
- `docs/architecture/SEED_DATA_SPECIFICATION.md` — catalogue and strategy file formats
- `docs/guides/ERROR_CODES.md` — Automaton error codes
