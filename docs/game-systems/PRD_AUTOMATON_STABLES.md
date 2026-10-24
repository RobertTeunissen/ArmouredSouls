# Automaton Stables

**Spec:** #55 (engine and starter stables), #57 (catalogue expansion), economy and event-fit change (`docs/implementation_notes/AUTOMATON_ECONOMY_AND_EVENT_FIT.md`) · **Status:** Implemented (ACC) · **Last updated:** 24 October 2026

Automaton_Stables are persistent, themed, computer-run stables that play by the same rules as human players. They buy robots, facilities, attributes, weapons and refinements through the same services and credit paths as a player, enter the same events, survive every Season_Rollover and rebuild themselves from the human starting balance.

Operator procedures are in `docs/guides/AUTOMATON_OPERATIONS_GUIDE.md`. The approved creative content (strategies, Build_Focus weights, the starter stables, every player- and admin-visible string) is the Review_Pack in `.kiro/specs/done-october26/55-automaton-stables/review/`; the Expansion_Stables were approved in the spec-57 Expansion_Review_Pack (`.kiro/specs/done-october26/57-automaton-catalogue-expansion/review/`).

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

An Upgrade_Strategy is a numbered Build_Order of Goals. Each strategy version is a Strategy_Definition_File (`app/backend/src/config/automaton-strategies/{key}.v{n}.json`) that combines Goal types from the code Goal_Library (`services/automaton/goals/`): `robots`, `facility(type)`, `attributes`, `weapons`, `refine`, `economy`. New Goal types are code changes; new strategies and versions are data.

Every strategy exists in v1 (the approved spec-55 Build_Orders) and v2 (October 2026, `docs/implementation_notes/AUTOMATON_ECONOMY_AND_EVENT_FIT.md`). v2 keeps every v1 Goal and target, so an upgrade migrates targets unchanged, and adds two things: an Economy Goal right after the opening robots and Booking Office L1, and Repair Bay, Merchandising Hub and Streaming Studio levels ahead of the larger attribute milestones (Swarm and Trio: Merchandising Hub and Repair Bay before the first attribute milestone; Swarm: Streaming Studio before the fourth robot). Booking Office L3 moves behind them. Every stable and Catalogue_Entry moves to v2 automatically (see "Versioning and pinned profiles").

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
- A Goal buys its own prerequisites (Goal_Chain): robots buy Roster Expansion and Storage Facility levels, attributes buy academy levels, refinements buy the Refinement Lab level their tier needs (Season 2; before that the Weapons Workshop). A prerequisite behind an unmet Prestige_Gate makes the Goal Blocked, which costs nothing, and the planner moves on.
- Every Build_Order contains every required Goal type with a default above 0 and ends with "Attributes → Max".
- Booking Office is bought early and never above the useful level: L1 with one robot, L4 when a 2v2 team exists, L6 when a 3v3 team exists.

Goal_Targets are editable per stable in the admin page within the bounds of the strategy version. The conformance suite proves every target combination inside those bounds safe, so a target edit needs no deploy and no test run.

### Economy Goal

"Economy → {n} cycles" (`goals/economyGoal.ts`, estimate in `economyEstimate.ts`). Target 0 turns it off; bounds 0–50; v2 default 20.

- **Input:** the stable's recurring ledger entries of the last three closed cycles of the current season (`stableHistory.ts`): battle income, streaming revenue divided by the Studio Multiplier recorded on each row, repair cost divided by (1 − the Repair Bay discount recorded on each row), and the operating costs facility levels do not explain (roster upkeep). Achievement rewards, purchases and sales are left out. Read once per turn; the turn's own purchases do not change the past.
- **Estimate:** those amounts re-priced at the current facility levels with the charging formulas (`calculateRepairBayDiscountPercent`, the Studio Multiplier, `calculateMerchandisingIncome`, `calculateFacilityOperatingCost`).
- **Acts** only while the estimate is a deficit: it buys the next level of Repair Bay, Merchandising Hub or Streaming Studio with the shortest payback (cost ÷ change of the recurring net), provided the payback is at most the target and at most the competitive cycles left in the season (facilities reset at rollover). Like every Goal it saves when the balance is short, so nothing below it is bought meanwhile. Because the estimate is re-priced after each level, it stops once the deficit is covered.
- **Satisfied** with target 0, fewer than two closed cycles of recurring entries this season (the opening build), no deficit, or no level that pays back in time. **Blocked** when none of the three can be bought (Prestige_Gate or maximum level).
- It is not a required Goal type; v1 files do not have it.

### Build_Focus

Each Robot_Blueprint has one of six Build_Focus presets (Bruiser, Deadeye, Warden, Sprinter, Tactician, Versatile). A preset is a set of attribute-group weights. Attribute milestones are raised group by group in the preset's priority order across all robots, lowest attribute first; the same weights split the Tuning Bay pool. Weights and opening builds are in the Review_Pack `STRATEGIES.md` §3–§10.

### Weapons and refinements

- A Weapon_Path has one column per hand. The starter catalogue uses two stages: starter and final. Range is never configured; the combat engine derives it from the equipped weapons.
- Weapon_Reuse: before buying, the Automaton equips a matching unequipped weapon from storage. A new robot starts at the highest stage storage can fill.
- Storage_Overflow_Rule (fixed): replaced weapons stay in storage; when storage is full, an unequipped weapon no blueprint still needs is sold first, then the cheapest; a Storage Facility level is bought only when nothing unequipped is left.
- Every blueprint has a Refinement_Plan (decision 35): at least one step on every non-shield weapon of the final stage, at most 5 per weapon. Starter plans are ordered by value: Sharpen, Sharpen, Forge, Forge first; a Hone or Augment only where it is cheaper than the same points on the robot. The Refine Goal_Target is the number of plan steps per robot (0–10).
- The Refine Goal's Goal_Chain buys the Refinement Lab levels a step's tier needs (hone L1, augment L3, sharpen L5, forge L8); a Lab level behind an unmet Prestige_Gate blocks the step. The pinned v1 strategy files are unchanged: no strategy has a Refinement Lab facility Goal, the refine chain buys it. The Lab is not a required facility Goal type.

### Teams and events

- Team_Rule (fixed): 2v2 teams are slots 1+2, 3+4, 5+6, 7+8, 9+10; 3v3 teams are slots 1–3, 4–6, 7–9; slot 11 is in no team. A team registers in the turn its last member joins and is never disbanded, swapped or renamed. Registering creates no standings: a team's standings row for a mode appears when Event_Allocation subscribes the whole team to that mode (the unified rule in `PRD_LEAGUE_SYSTEM.md` "Entering a League"). A robot's 1v1 League, KotH and Grand Melee standings likewise appear on its first subscription to that event. The catalogue only supplies Team_Names.
- Event_Order: each stable lists all 9 subscribable event types in order of preference. A team event goes to the whole team or to none of it.
- Event_Allocation (`upkeep/subscriptionUpkeep.ts`) fills each robot's Booking Office slots in this order, every turn:
  1. Held event types (a booked match is still owed).
  2. The robot's first league in the Event_Order it can enter (1v1, 2v2 or 3v3 League, Tag Team), whatever it pays: its promotion path, where higher tiers pay more.
  3. Every other event by expected value per battle: income (credits plus streaming) minus the repair that battle's damage would cost the robot now (its current attribute total and Repair Bay level, the shared repair quote, so a destroyed robot costs double). The battles are the robot's own last 10 in that event, or, below 3, those of the stable's robots with the same main-weapon range band, or of all its robots. A robot that does well in Grand Melee keeps Grand Melee; one that is destroyed there for little pay gives the slot to a better event. A team event scores the mean of its members. An event without enough battles counts as neutral (₡0), so a new stable tries its events in Event_Order order and keeps those that pay. An event the robot already holds gets ₡1,000 extra, so near-equal events do not swap every turn.
  Ties and events without results follow the Event_Order. Every free slot is still filled; ranking decides which events get the slots, not whether a robot plays. Without results (a hand-built fact set) the allocation is the Event_Order alone, plus the pinned league.

### Versioning and pinned profiles

Each Automaton_Profile is pinned to a Strategy_Version, and every profile runs the latest version of its strategy (product owner, 24 October 2026; this replaces the spec-55 rule that a deploy changes no stable and an admin upgrades by hand). The ACC deploy runs `pnpm run automaton:upgrade` after the backend restart: every profile, draft or active, on an older version is upgraded. Goal_Targets migrate by Goal type and occurrence, clamped to the new bounds. A stable whose migrated targets break its own rules stays on its version and raises an alert (decision 37), again at each deploy until it is fixed. The strategy key never changes automatically: moving a stable to a different strategy is an admin edit (Editor → strategy), which pins the latest version of the new key, and later versions of that key then reach it automatically. The Strategy_Library's manual **Upgrade** still exists for an immediate upgrade. The server refuses to start when a profile's pinned file is missing or invalid.

Catalogue_Entries follow the same rule: every entry pins the latest version of its strategy (`catalogueUpgrade.test.ts`). After adding `{key}.v{n+1}.json`, run `pnpm run automaton:catalogue-upgrade`, which rewrites each entry's `strategy` member and carries its Goal_Target overrides (stored by Goal position) to the new positions by Goal type and occurrence.

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
- Turn_Budget: 60 charged actions and 10 s per Automaton_Turn (`turn_budget_exhausted`).
- Turn_Step deadline: every Active_Automaton takes its turn the same night. The step keeps starting turns until the earlier of step start + `AUTOMATON_TURN_STEP_MAX_MS` (default 6 h) and the next scheduled cycle-scheduler job − `AUTOMATON_TURN_STEP_SCHEDULE_MARGIN_MS` (default 15 min), but never less than 300 s (the floor). On the default schedule the 6 h cap is the earlier of the two: after the 00:00 settlement the step may start turns until about 06:00 UTC (step start + 6 h), well before the 08:00 league job − 15 min. The schedule term only binds when a step starts less than 6 h 15 min before the next job, for example after a late, admin-triggered settlement. Stables not started by the deadline are `skipped` with `step_budget_exhausted`, build at their next turn, and one "Turn_Step deadline reached" alert names the count, deadline and concurrency. In-flight turns finish within their own Turn_Budget.
- Concurrency: up to `AUTOMATON_TURN_CONCURRENCY` turns run in parallel (default 3; 1 = sequential), clamped to ⌊(`DB_POOL_MAX` − 5) / 2⌋ so five pool connections always stay free for players. Turns start in ascending `User.id` order. Each Automaton is its own user, so parallel turns touch disjoint balances and rows.
- The Turn_Step lease is a heartbeat (120 s TTL, renewed every 30 s). If it is lost, the step starts no further stables and alerts `TURN_STEP_LEASE_LOST`.
- A Serialized_Cycle_Cutover that starts during the step (admin bulk cycles) stops new turns: the remaining stables are `skipped` with `cutover_in_progress` and an `automaton_turn_step_failed` alert is raised; settlement continues.
- This supersedes spec 55 R7.10 and the 300 s hard limit in spec 55 design §8.8 and §19. Rationale and measurements: `docs/implementation_notes/AUTOMATON_TURN_STEP_DEADLINE.md`.
- A failing Automaton never fails settlement or rollover and never blocks the other Automatons; the turn is recorded `failed` and alerts.
- Free_Upkeep (teams, subscriptions, stance and yield sync, tuning) runs at the start and end of every turn and costs nothing.
- Fit-out recovery (`services/automaton/fitoutRecovery.ts`): the robot purchase and its fit-out are separate charged transactions, so a fit-out failure after the robot committed leaves it unarmed, and an unarmed robot fails the shared loadout readiness rule and is never scheduled. Every turn, before Free_Upkeep and before the planner buys anything, robots that fail `evaluateLoadoutReadiness` (the rule `checkSchedulingReadiness` uses) get their fit-out resumed: the blueprint loadout, then each empty hand of the target stage (the stage of a held main weapon, else the starting stage) from an unequipped weapon in storage first and a purchase only for what is missing, with storage room by the Storage_Overflow_Rule. That storage room never sells a stored weapon that this robot or any other unready robot of the stable will equip, so a later robot does not have to buy it back. Charges go through the same purchase/sale/facility services and Credit_Mutation_Service as any action and count against the Turn_Budget. Hands that hold a weapon and ready robots are left alone. A robot is tried once per turn; a weapon bought by a failed attempt stays in storage and is equipped from there next turn, so nothing is bought twice. An unaffordable fit-out waits for credits. Each resumed fit-out is logged at `warn` and each failed or blocked one at `error`, with the robot id, slot and stable.

Measured on the heavy simulation (100 Active_Automatons, local Apple Silicon, PostgreSQL 17): opening-build Turn_Steps 244 s (first preparation) and 260 s (`season_open`), steady-state settlement steps 5–12 s, slowest single turn 4.5 s. The opening steps passed the then 300 s hard limit but missed the 180 s design target; most time is spent in the shared purchase path (audit, locks, cycle identity, achievement checks). With the 11 starter stables the opening step scales to roughly 27 s (an extrapolation from the 100-stable figure, not a measurement). The full simulation runs about 14 minutes locally. These are spec 55's figures. Since spec 57 the heavy test runs every repository Catalogue_Entry instead of a fixed population; its seconds per Automaton per Turn_Trigger, budget skips and wall time are recorded in `docs/implementation_notes/AUTOMATON_CATALOGUE_EXPANSION.md`. The current timings at concurrency 1 and 3, and the ACC capacity estimate, are in `docs/implementation_notes/AUTOMATON_TURN_STEP_DEADLINE.md`.

## Economic boundaries

- Every charge goes through the extracted domain services and Credit_Mutation_Service, with one Financial_Pair per charged action and an Automaton audit context. No code in `services/automaton/` writes `User.currency`.
- No grants: an Automaton gets exactly the human starting balance (₡3,000,000) and the income every stable earns. There is no catch-up money.
- **Handicap:** Automatons never use Manual_Repair. Automatic_Repair before each battle charges them the full quote, as it does a human who did not repair manually.
- A negative balance is possible, as for humans (repairs and operating costs). The turn still runs upkeep and buys nothing. An alert names the stable when it turns negative and when it recovers; a stable that stays negative is only counted in those messages and in the step log, so a persistent state does not repeat every night.

## Season_Rollover behaviour

- Archive: Active_Automatons are archived like humans; `stable_season_archives.stable_type` and `subject_stable_type` on snapshots and accolades record the Stable_Type.
- Reset: the Human_Reset_Contract applies (robots, facilities, weapons, standings deleted; ₡3,000,000; prestige 0).
- Preserved: Automaton_Profiles, blueprints, Goal_Targets, Team_Names, Event_Orders, the Program_Switch row and uploaded images. `automaton_turns` is purged with the history tables.
- Stage 5 runs the `season_open` Turn_Step, so every Automaton opens the new season with its opening build.
- Achievements: Automatons are re-awarded preserved-state achievements like humans (decision 3).

## Catalogue flow

Reviewed stable definitions live in the repository as Catalogue_Entries (`app/backend/prisma/automaton-catalogue/{catalogueKey}.json`). On every ACC deploy Catalogue_Sync (`pnpm run automaton:sync`) inserts new entries as Draft_Automatons. It is insert-only, with one exception: a blueprint without an image gets its Repository_Image (`app/frontend/public/assets/automatons/{catalogueKey}/{slot}.webp`). Edits made in the admin page are never overwritten. Admin edits travel back to the repository through Catalogue_Export → `pnpm run automaton:unpack` → pull request.

### Starter stables (spec 55)

Spec 55 delivered these stables (decision 32); spec 57 adds the Expansion_Stables below. They alone cover the Coverage_Matrix, so no Expansion_Stable is ever needed for engine coverage.

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
| `world-robot-boxing` | World Robot Boxing | Real Steel | Tycoon (v2 goal 21 Robots → 3) | 3 |
| `autobots-ark` | Autobots of the Ark | Transformers — Autobots | Generalist (v2 goal 15 Robots → 3) | 4 |

Franchise and backstory are admin-only; showing them to players is backlog #61.

### Expansion stables (spec 57)

The Automaton_Catalogue is the Starter_Stables plus the Expansion_Stables of spec 57, whatever their number: the folder `app/backend/prisma/automaton-catalogue/` is the source, and its file count is the catalogue size (`ls app/backend/prisma/automaton-catalogue/*.json | wc -l`). The current totals per origin and per strategy are in the generated Totals block of the spec-57 `review/FINDINGS.md`.

- **Review and approval**: every Expansion_Stable was converted from the product owner's drafts, validated against every spec-55 catalogue rule and the built code, and approved with the spec-57 Expansion_Review_Pack (`.kiro/specs/done-october26/57-automaton-catalogue-expansion/review/`, Content_Approval 11 October 2026). The approved entries were copied byte-identical into the catalogue folder; the starter entries are unchanged.
- **Strategies**: the engine and the six strategies are unchanged. The collection's Squadron stables were converted as Trio with robots target 6 (`targetOverrides {"12": 6}`, decision 12).
- **Names**: Catalogue_Keys, stable names (case-insensitive), robot names and team names are unique across the whole catalogue (`catalogueSchema.test.ts`).
- **Portraits**: each expansion Blueprint_Slot has its Repository_Image at `app/frontend/public/assets/automatons/{catalogueKey}/{slot}.webp`; renamed slots follow their portrait (decision 18).
- **No activation cap** (decision 19): after the deploy every Expansion_Stable is a Draft_Automaton, and an admin activates them (`docs/guides/AUTOMATON_OPERATIONS_GUIDE.md` §1); the Turn_Step deadline serves every opening build the same night. What the built engine needs for very large populations is investigated in `.kiro/specs/done-october26/57-automaton-catalogue-expansion/review/SCALING.md`; of its open items, parallel turns, a deadline scaled to the night window and a lease heartbeat are done (`docs/implementation_notes/AUTOMATON_TURN_STEP_DEADLINE.md`), the rest are not implemented.

## Competitive parity and matchmaking

- Automatons compete with full parity (decision 33): promotions and demotions, tournaments, season accolades, Hall of Records and the season archive work exactly as for human stables. They earn achievements by the same triggers, except those only a manual action triggers (Manual_Repair, practice battles).
- Achievement rarity ("x% of players") counts humans only (decision 38).
- On a local or otherwise empty environment Automatons win everything. That is expected; the Strategy_Comparison then shows no human reference row.
- Matchmaking is unchanged (decision 34): Automatons are matched against each other and against humans like any stable.

## Player-facing presentation

The only player-visible marker is the Automaton_Badge (gear icon and "Automaton", theme `info` purple) after the stable name on leaderboards, league standings, every Hall of Records record that names a stable (decision 42), the stable profile, robot detail, battle report and season archive. The strategy name, franchise and backstory are never shown. There is no in-game guide article. Page details are in the page PRDs and `DESIGN_SYSTEM_AND_UX_GUIDE.md`.

## Admin control

`/admin/automatons` (admin only, audited) has a Status_Bar and four sections: Stables (with Needs attention), Strategies (Strategy_Comparison, Strategy_Library, Strategy_Builder), Editor (stable, teams, Event_Order, numbered Build_Order with Turn_Preview statuses, blueprints, cycle history) and Catalogue. There are deliberately no controls to run a turn, delete an active stable, edit live robots, teams, subscriptions or weapons, or change a balance. See `docs/guides/ADMIN_PANEL_GUIDE.md` and `docs/prd_pages/PRD_ADMIN_PAGE.md`.

### Highest tier and strategy performance

Both the Stables list ("Highest tier (any mode)") and the Strategy_Comparison ("Highest current tier", "Performance by mode") read the current season's `standings`, never entity models or `battle_log`. The shared rules live in `app/shared/utils/automatonStandingsTier.ts` so the frontend sort and the backend selection cannot drift.

- **Played rows only.** A standing counts when `wins + losses + draws > 0` or `totalMatches > 0`; a bye is a recorded league result and counts. Unplayed rows are ignored because matchmaking scopes candidates by `standings.leagueInstanceId` (Spec #40), so a row exists before anything is played: a robot or team gets a Bronze row with 0 LP on its first matchable subscription to a mode and keeps it after unsubscribing (`PRD_LEAGUE_SYSTEM.md` "Entering a League"). Robot creation and team registration create no rows, so a stable whose robots hold no subscription has no rows at all. Without the rule every subscribed stable would show at least "Bronze" before its first match.
- **Tiered modes:** 1v1, 2v2 and 3v3 League, Tag Team, King of the Hill and Grand Melee. Tournaments have no tier. The tier is the one held right now, not the season's peak.
- **Tie-break:** when several modes hold the highest tier, the mode with the most matches played at that tier wins (W+L+D, or `totalMatches` for King of the Hill and Grand Melee); then the fixed order 1v1, 2v2, 3v3, Tag Team, King of the Hill, Grand Melee. The Stables list shows the tier with that mode ("Gold · 3v3 League"); the Comparison shows the tier with the number of stables at it.
- **Win rate vs humans** shows its sample size: "43% · 61–78–3 (n = 142)", "— (n = 0)" without battles. Byes, King of the Hill and Grand Melee are not counted.
- **Performance by mode** (one mode at a time, default 1v1 League), per strategy and the human reference row, played rows only: stables played out of the strategy's stables, robots or teams played, and for head-to-head modes W–L–D, win % and battles (n). King of the Hill and Grand Melee only record first places (`wins`), matches (`totalMatches`) and the best placement (`bestPlacement`); losses and draws are never written and no placement sum is stored. They therefore show matches (n), 1st places, the first-place rate (first places ÷ matches) and the best placement, not W–L–D or an average placement. The first-place rate is not comparable with a head-to-head win %. The figures include Automaton-vs-Automaton battles and mirror matches between stables of the same strategy, which pull the win % toward 50%, and byes count as wins.
- **Low sample:** fewer than 5 stables (`LOW_SAMPLE_MIN_STABLES`) or fewer than 20 battles or matches (`LOW_SAMPLE_MIN_MATCHES`) in the mode; the row carries a visible "Low sample" pill.

These labels replace the approved Spec #55 wording in `PLAYER_FACING_TEXT.md` §6.3 ("Best tier") and §6.4 ("Best tier reached" and its footnote), which counted unplayed default rows and gave no sample size. The done spec files are history and are not edited.

## Related documents

- `docs/guides/AUTOMATON_OPERATIONS_GUIDE.md` — operator procedures
- `docs/game-systems/PRD_SEASON_SYSTEM.md` — rollover stages incl. Stage 5
- `docs/game-systems/PRD_CYCLE_SYSTEM.md` — Turn_Step placement
- `docs/game-systems/PRD_ECONOMY_SYSTEM.md` — Automaton spending paths
- `docs/architecture/DATABASE_SCHEMA.md` — `automaton_*` tables and invariants
- `docs/architecture/PRD_SERVICE_DIRECTORY.md` — `services/automaton/`
- `docs/architecture/SEED_DATA_SPECIFICATION.md` — catalogue and strategy file formats
- `docs/guides/ERROR_CODES.md` — Automaton error codes
