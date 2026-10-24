# Automaton economy and event fit (October 2026)

**Status:** Implemented on `feat/automaton-economy-and-event-fit` · **Product rules:** `docs/game-systems/PRD_AUTOMATON_STABLES.md` ("Economy Goal", "Teams and events", "Strategies") · **Operations:** `docs/guides/AUTOMATON_OPERATIONS_GUIDE.md`

## Why

The 205 Automaton_Stables were activated on ACC on 11–12 October 2026 (Season 1, cycles 70–71). By cycle 82, 121 of them started their turn with a negative balance, and the count was still rising (cycle 74: 4, 80: 95, 81: 106, 82: 121). Read-only ACC queries, cycles 79–83:

- **Recurring costs above recurring income for every strategy but Tycoon.** Per stable per cycle (battle income + streaming + merchandising vs repairs + upkeep): Generalist ~68k vs ~133k, Duo ~65k vs ~111k, Swarm ~99k vs ~150k, Trio ~86k vs ~117k, Paragon ~31k vs ~56k, Tycoon ~149k vs ~104k. Purchases were negligible from cycle 78 on; one-off achievement rewards had hidden the gap during the first week.
- **Repairs dominate.** Over cycles 81–83: ₡47.8M repairs against ₡24.5M battle income. Opening builds give robots about 127 attribute points, and Bronze pays ₡9.1k for a win and ₡1.5k for a loss, so most Bronze battles cost more to repair than they pay. 386 Automaton robots sat in Bronze 1v1 (max 24 LP; promotion needs 25, a top-10% place and 5 cycles).
- **Grand Melee and King of the Hill at Bronze.** Grand Melee: ~90% of entries destroyed (double repair price), about ₡24k repair against ₡8.3k income per entry, an estimated 35–40% of the repair bill. KotH about ₡12.7k against ₡7.8k. (Estimates from the repair formula; the ledger does not link repairs to battles.) Main-weapon range band did not predict Grand Melee placement at Bronze (average placement 8.0–9.2 for every band); melee robots did better in KotH.
- **Economy facilities came too late.** Most stables were Saving for small attribute steps that sit before Repair Bay, Merchandising Hub and Streaming Studio in the v1 Build_Orders (51 Paragons at goal 7, 37 Trios at goal 6, 22 Duos at goal 7); 22 Swarms were saving ₡1M+ for a fourth robot.

## Decisions (product owner, 24 October 2026)

1. New v2 strategy files that buy Repair Bay, Merchandising Hub and Streaming Studio earlier.
2. A new Economy Goal that buys the fastest-paying of those three whenever recent income is below running costs.
3. Event_Allocation ranks events by expected value per robot ("I place well in Grand Melee, so I play Grand Melee"), rather than dropping events by type; higher tiers of KotH and Grand Melee pay more, so the robot's first league stays pinned as its promotion path.
4. No cash reserve: a reserve only delays the negative balance. The manual-repair handicap stays (players who do not log in pay full price too).
5. The negative-balance alert names only stables that turned negative or recovered, plus the total.

The remaining Season 1 cycles are not a target; new Automatons and Season 2 start fresh on these rules.

## What changed

| Area | Change | Code |
|---|---|---|
| History facts | `StableFacts.history`: economy window (last 3 closed cycles of the season, normalised repair and streaming) and each robot's last 10 battles per event type with its main-weapon range band. Read once per turn; reloads reuse it (`reloadOptions`). | `stableHistory.ts`, `stableFacts.ts` |
| Economy Goal | New Goal type `economy` (target = longest payback in cycles, 0 = off, 0–50). Pure estimate re-priced at current facility levels; payback also capped by the cycles left in the season. | `economyEstimate.ts`, `goals/economyGoal.ts`, strategy schema, registry, Strategy_Builder |
| v2 strategies | Six `{key}.v2.json` files: every v1 Goal kept (targets migrate unchanged, see `strategiesV2.test.ts`), Economy Goal added, economy facilities moved ahead of the larger attribute milestones, Booking Office L3 behind them. | `config/automaton-strategies/*.v2.json` |
| Event_Allocation | Held events, then the pinned league, then expected value per battle (income − current repair quote of the observed damage; own battles, else same-range-band robots, else the stable; unknown = ₡0; held event +₡1,000). Event_Order breaks ties. | `upkeep/subscriptionUpkeep.ts` |
| Alert | `automaton_negative_balance` only on a transition to negative; new `automaton_balance_recovered`; both state the step's negative total; a step with no transition sends nothing and logs the count. | `automatonObservability.ts`, `turnRecords.ts`, `automatonTurnService.ts` |

Opening builds from ₡3,000,000 with the starter blueprints (projection, `projectApprovedOpening`):

| Strategy | v1 facilities after the opening | v2 facilities after the opening |
|---|---|---|
| Duo | Booking L3, Training L1, Workshop L1 | Repair L2, Merchandising L1, Streaming L1, Booking L1, Workshop L1 |
| Generalist | Booking L3, Workshop L1 | Repair L2, Merchandising L1, Streaming L1, Booking L1, Workshop L1 |
| Paragon | Training L3, Combat Academy L1, Workshop L1, Booking L1 | Repair L3, Merchandising L2, Training L1, Workshop L1, Booking L1 |
| Swarm | Booking L1 (3 robots) | Repair L3, Merchandising L1, Booking L1 (3 robots, fewer attributes) |
| Trio | Booking L1 (3 robots) | Repair L1, Merchandising L1, Booking L1 (3 robots, fewer attributes) |
| Tycoon | Merchandising L2, Streaming L1, Booking L2 | Merchandising L2, Streaming L1, Repair L2, Booking L1 |

## Rollout

- Deploying the files changes no stable. Upgrade existing stables in Strategy_Library → **Upgrade** per strategy (dry run first; every v1 Goal maps to v2, only the Economy Goal is new).
- Event_Allocation and the alert apply to every stable, v1 or v2, from the first turn after the deploy.
- New Catalogue_Entries should pin `"version": 2`; admin-created stables get the latest version already. Existing entries stay on v1 (Catalogue_Sync is insert-only and the entries are approved content).

## Verification

- Backend unit tier (7,948 tests), every `tests/integration/automaton*.test.ts` suite (history loader against seeded ledger rows and battles included), lint, build, `typecheck:tests` and `test:tiers:verify`; frontend Automaton admin Vitest suites and type-check.
- Heavy `automatonMultiSeason.test.ts` on a throwaway local database (205 repository Catalogue_Entries, v1 pins, new Event_Allocation and history loader): passed in 282 s, no failed or skipped turns, settlement Turn_Steps 1.6–2.1 s for 205 stables, opening steps 72 s (preparation) and 65 s (`season_open`), peak 12 database connections, 8 alerts over two seasons.

## Not verified

- Live effect on ACC: no stable has run v2 or the new allocation yet. Watch the Strategy_Comparison and the alert after the next activations.
- The heavy multi-season simulation runs the repository catalogue, which still pins v1; v2 is covered by the conformance and scenario suites (unit tier) and `strategiesV2.test.ts`.
- Expected values use each robot's current max HP for past battles; a robot whose HP grew since then looks slightly more damaged than it was.
