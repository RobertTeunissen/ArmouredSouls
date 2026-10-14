# Standings Creation Rule

**Status:** Implemented (branch `fix/unified-standings-creation`, October 2026)
**Owner module:** `app/backend/src/services/standings/standingPlacement.ts`

## Why

Standings used to be created in several unrelated places: robot creation made `league_1v1`, `koth` and `grand_melee` rows, `subscriptionService` seeded placement rows, `registerTeam` callers made team rows with `createInitialTeamStandings`, and generators/seed wrote their own. A robot was "Bronze" in modes it had never entered, those rows counted towards league populations and promotion slots, and team modes behaved differently from robot modes. There is now one rule.

## The rule

- A `standings` row is created the first time its entity becomes **matchable** in a standing-backed mode:
  - robot modes (`league_1v1`, `koth`, `grand_melee`): the robot holds the subscription;
  - team modes: the team is complete and every member holds the subscription — `league_2v2` and `tag_team` for 2-robot teams (independent of each other), `league_3v3` for 3-robot teams.
- Robot creation and team registration create no rows by themselves.
- New rows: Bronze, 0 LP, least-full Bronze instance (ties to the lowest number); a new instance opens when all hold 100 (`leagueInstancePlacement.pickLeagueInstanceInTransaction`).
- Rows are **kept** on unsubscribe and on member swap.
- Rows are **deleted** on team disband, account reset, generated-stable purge and season rollover. The table is polymorphic with no FK, so deletes are explicit and come before the entity.
- Tournament modes are not standing-backed; their rows stay lazily find-or-created.

## Call sites

| Caller | Helper |
|---|---|
| `subscriptionService.applySubscriptionChange` (single, bulk and Automaton Event_Allocation subscriptions) | `ensureStandingsForSubscriptionGain(tx, robotId, toAdd)` |
| `teamBattleService.registerTeam`, `swapTeamMember` | `ensureTeamStandings(tx, teamId)` |
| `utils/userGeneration.ts` | `ensureStanding` per subscribed robot mode; team rows via `registerTeam` |
| `prisma/seed.ts` (WimpBots) | `ensureStandingsForSubscriptionGain` |
| `standingsService.getOrCreateStanding` | `ensureStanding`, as a safety net that logs `[Standings] Safety net created a missing standing` |

`teamBattleService.disbandTeam` and `resetService.performAccountReset` delete the team rows. Removed with this change: `createInitialTeamStandings`, the team league-instance assigners in `teamBattleAdapter`, robot-creation standings, `ensurePlacementStandings`, the dead `addTeamMember`/`removeTeamMember` and `matchmaking/unifiedTeamMatchmaking.ts`.

## Locking

Lock order, which keeps the wait-for graph acyclic:

`(2, robotId)` → `(3, cycle)` → `(5, teamId)` ascending → mode/tier hash lock (modes in canonical order `league_1v1, koth, grand_melee, league_2v2, tag_team, league_3v3`).

- Namespace 2 serialises team membership per robot. `applySubscriptionChange` takes it before writing subscriptions when a team mode is added.
- Namespace 5 (new) serialises every team-standing check. Without it, two members subscribing at the same time each read the other's uncommitted subscription as missing, and the team row is never created.
- The single-argument mode/tier hash lock serialises instance picks.
- The audit cycle number is read before the subscription transaction opens, so a subscription change holds one pool connection, not two.

## Why `createMany({ skipDuplicates: true })`

Postgres aborts an interactive transaction on a unique violation, so "create → catch P2002 → re-read" cannot run on `tx`. `ensureStanding` inserts with `ON CONFLICT DO NOTHING` and then reads the row back with `findUniqueOrThrow`. Concurrent callers converge on one row and the transaction survives.

## Owner decisions

- **D1:** no cleanup script or migration. Existing never-played rows disappear at the next season rollover (acceptable on ACC).
- **D2:** rebalancing population, slot maths and `cyclesInTier` are unchanged.
- **D3:** a member swap needs no subscription. If the new line-up completes a mode's set, the team enters it.
- **D4:** disband followed by re-registration starts fresh in Bronze.
- **D5:** disband and account reset delete the team's standings.
- **D6:** `userGeneration` keeps writing subscriptions directly; only its standing creates were replaced by the helpers.

## Player-visible effects

Robots without a `league_1v1` row show "Unranked" (robot list, robot detail, dashboard). The swap modal lists every eligible robot, not only subscribed ones. Guide articles updated: `team-battles/overview`, `team-battles/tag-team`, `leagues/league-tiers`, `leagues/tier-progression`, `facilities/booking-office`, `king-of-the-hill/entry-requirements`, `grand-melee/entry-requirements`.

## Tests

`tests/integration/standingsCreationRule.test.ts` (integration tier) covers every rule, swap and deletion case, concurrency (team subscribe races, swap plus subscribe, 20 concurrent placements across a full instance), Automaton upkeep, the generator and matchmaking. `tests/integration/kothNeverPlayedPromotion.test.ts` (heavy) checks that never-subscribed robots no longer appear in KotH promotion. Unit and property suites live in `src/services/standings/__tests__/`.
