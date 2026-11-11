# Product Requirements Document: League Standings Page

**Project**: Armoured Souls
**Document Type**: Product Requirements Document (PRD)
**Version**: v2.1
**Date**: November 11, 2026
**Status**: ✅ Implemented

---

## Version History
- v1.0 - Initial draft by GitHub Copilot (February 5, 2026)
- v1.1 - Unified all head-to-head modes behind the canonical fixed-zone planner; added tier-wide effective promotion/demotion display and cohort-hold messaging (September 12, 2026)
- v1.2 - Documented who appears in standings: robots and teams enter on their first matchable subscription; robots and teams without a standing show "Unranked" (October 14, 2026)
- v2.0 - Redesign (November 8, 2026): the page opens on the viewer's own robots and teams. League cards per league (`GET /api/leagues/my-standings`), tier and instance chips with the viewer's counts, one instance on one page with promotion and demotion bands, and a status chip per zone place that says whether it moves or why it is held. Rows, zones and statuses come from the executor's tier plan in one backend service for all six leagues. Fixed: an unknown `mode` or malformed `instance` answered 500 (now 400); Champion's legend read "≥ LP"; robot names were not links; a slow response could show another tier's rows; the KotH and Grand Melee tabs fetched one standing per robot. Dropped the Fame column and ELO outside 1v1. Every standings endpoint now needs a login. This document now describes v2.0 only; the v1.x feature notes are in git history.
- v2.1 - "Stables: All | Players" filter (#595, November 11, 2026): only human players' robots and teams, each keeping its place among every entry; player counts on the instance chips; a Group column in the whole-tier view. The choice is shared with the Hall of Records, remembered on the device and carried in the URL.

---

## References

- [PRD_LEAGUE_SYSTEM.md](../game-systems/PRD_LEAGUE_SYSTEM.md): tiers, instances, LP, promotion and demotion rules, "Entering a League"
- [PRD_MATCHMAKING.md](../game-systems/PRD_MATCHMAKING.md): matches are made within an instance
- [PRD_AUTOMATON_STABLES.md](../game-systems/PRD_AUTOMATON_STABLES.md): Automaton_Badge on stable names
- [PRD_SECURITY.md](../architecture/PRD_SECURITY.md): "What needs a login"
- Player guide: `leagues/league-points` ("LP and Instance Standings"), `leagues/promotion-demotion` (linked as "How leagues work")

## Code map

| Area | Files |
|---|---|
| Page | `app/frontend/src/pages/LeagueStandingsPage.tsx` (root `data-testid="league-standings"`) |
| Components | `app/frontend/src/components/league-standings/` (`LeagueCards`, `TierChips`, `InstanceChips`, `StandingsTable`, `StatusChip`, `StandingsPager`, `StandingsLegend`, `useLeagueStandings`) |
| View model | `app/frontend/src/utils/leagueStandings.ts` (modes, opening view, card summaries, status and zone wording) |
| API client | `app/frontend/src/utils/leagueStandingsApi.ts` (normalises robot and team responses to one row shape) |
| Routes | `app/backend/src/routes/leagues.ts` (`/my-standings`, `/:tier/standings`, `/:tier/instances`), `app/backend/src/routes/teamBattles.ts` (2v2/3v3 and Tag Team standings and instances) |
| Services | `services/league/leagueStandingsService.ts` (pages), `myStandingsService.ts` (league cards), `standing-status.ts` (status per zone place), `league-zone-meta.ts` (`zoneMeta`), `league-rebalancing-preview.ts` (`buildLeagueTierPreview`, the executor's plan), `services/standings/playerStables.ts` (the "Players" rule, player counts per instance) |
| Stables filter | `components/StableFilterControl.tsx`, `hooks/useStableFilter.ts`, `utils/stableFilter.ts` (shared with the Hall of Records) |

---

## Page

### Layout (top to bottom)
1. **Header**: "League Standings", the season line ("Season 1 · cycle 97 of 100 · places move at each league's rebalance, after its battles") and "How leagues work ›" (guide).
2. **League cards** (`LeagueCards`): one card per league (1v1, 2v2, 3v3, Tag Team, King of the Hill, Grand Melee), which is also the league picker. A card with entries says "11 robots in 4 tiers", "Best: #10, Champion 1" (highest tier, then best place) and one movement line, the first that applies: "N promote · N demote", "N held below the LP minimum" (LP or cohort holds), "N in promotion places" (residency), "N in demotion places", "Nobody in a zone". A league without entries says "No robots entered" / "No teams entered", so every league stays reachable. Six columns from `xl`; below that the cards scroll sideways (`ScrollRow`).
3. **Tier chips** (`TierChips`): the six tiers with the viewer's entry count. A tier links to the viewer's best instance in it, or the whole tier.
4. **Stables: All | Players** (`StableFilterControl`, see below) and the **instance chips** (`InstanceChips`): every instance in number order, "Diamond 1 · 67 · 3 yours", then "All of Diamond · 133" when the tier has more than one. On phones the control comes first, full width; from `lg` it sits right of the chips.
5. **Standings** for the selected instance or tier: heading ("Diamond 1" / "All of Diamond"), the zone summary, an optional warning, the table, the pager (whole tier only) and the legend.

### Opening view
Without `tier` in the URL the page waits for `my-standings` and replaces the URL with the viewer's best instance in the chosen league (highest tier, then best place). Without entries in that league it opens all of Bronze. A URL with a tier (deep links from battle reports, robot pages and the admin League Health page) is kept as it is.

### URL state
`mode` (`1v1`, `2v2`, `3v3`, `tag_team`, `koth`, `grand_melee`; the old values, so existing links land), `tier`, `instance` (absent = whole tier), `page` (whole tier only), `stables=players` (Players filter; kept by the league cards, tier chips, instance chips and pager).

### Stables filter (#595)
The same control and words as the Hall of Records and the admin portal. **Players** are human stables (`stableType = human`, not generated); Automatons and generated stables are left out.

- Filtering never re-ranks: places are computed over the whole instance (or tier) first, then the players' rows are kept. A player's robot at #14 stays #14, and its status chip is the one it has among everyone.
- Promotion and demotion bands are hidden (their lines would fall between rows that are not neighbours); status chips stay.
- Instance chips show player counts instead: "Diamond 1 · 6 players", "All of Diamond · 14 players".
- A summary line under the zone summary: "6 players among 67 robots in Diamond 1. Places count every robot, so they don't change when you filter." with **Show all stables**. Without players: "No players' robots in Diamond 1."
- The whole-tier view pages the players' rows (50 per page) and shows a **Group** column with each row's instance (it shows in the unfiltered whole-tier view too).
- The choice is stored on the device (`localStorage` `stableFilter`) and carried in the URL; a remembered Players is written into the URL on load (replace). Changing it goes back to page 1.

### Table (`StandingsTable`)
- **One instance** is one page (instances hold at most 100). The top `floor(10%)` places sit under a green "Promotion places · top N" band and end at a dashed line; the bottom places sit under a red "Demotion places · bottom N" band. Instances under 10 entries have no zone places.
- **Whole tier**: 50 per page with a pager, no bands (zones are counted per instance); status chips still show.
- **Columns**: Place, robot or team (stable underneath, with the "bot" chip for generated stables and the Automaton_Badge; team members linked to their robots), record (W-D-L, or wins / matches in KotH and Grand Melee), ELO (1v1 only), LP, Status. Below `md` the record moves under the stable name, the chip under the name, and ELO and Status columns are hidden; fixed column widths apply from `md` only.
- **The viewer's rows**: blue fill and left bar, a "You" chip, robot names link to the Workshop (everyone else's to the public profile). A viewer's robot outside the zone places with fewer cycles than the minimum shows "New in Diamond · 0 of 5 cycles".
- **Not subscribed**: the row keeps its place, its text is dimmed and it shows "Not entered".
- While the next page loads the current rows stay (dimmed); a response for a request that is no longer current is dropped.

### Status chip (`StatusChip`, `standing-status.ts`)
Only entries in a zone place get one. From the executor's tier plan, per instance:

| Chip | When |
|---|---|
| Promotes | in a promotion place and in the plan's effective promotions |
| Demotes | in a demotion place, enough cycles |
| Needs 125 LP | promotion place, enough cycles, below the tier's LP minimum (Bronze 25 … Diamond 125; none in KotH/Grand Melee) |
| N cycles to go | zone place, fewer cycles in the tier than the minimum (5; KotH and Grand Melee 10); residency is reported before LP |
| Held: Champion is empty | qualifies, but promotion would open an empty tier with fewer than 3 qualifiers tier-wide |

Places are not backfilled: a held place stays empty, so the chips never move down the list. The legend explains the four common chips.

### Zone summary and warnings (`zoneSummary`, `zoneWarning`)
- Instance: "67 robots · top 6 go up to Champion, bottom 6 down to Platinum · moving needs 5 cycles in Diamond; going up also needs 125 LP". Champion omits promotion and the LP minimum; Bronze omits demotion.
- Whole tier: "603 robots in 7 instances · top 10% of each instance go up to Diamond, bottom 10% down to Gold · …".
- Warnings: a cohort hold, instances below 10 entries ("nobody moves there yet"), or a single instance below 10.

---

## API

All endpoints need a login (`authenticateToken`); query parameters are validated with Zod (`leagueInstanceId` primitive in `utils/securityValidation.ts`); invalid input answers `400 VALIDATION_ERROR`.

| Endpoint | Query | Returns |
|---|---|---|
| `GET /api/leagues/my-standings` | — | `{ entries: [{ mode, entityType, entityId, name, tier, leagueInstanceId, place, instanceSize, leaguePoints, cyclesInTier, minCycles, status }] }`, `Cache-Control: private, no-store` |
| `GET /api/leagues/:tier/standings` | `mode` (`league_1v1` default, `koth`, `grand_melee`), `instance`, `page`, `perPage` ≤ 100, `stables` (`all` default, `players`) | `{ data: [robot rows with rank, status, leagueInstanceId], pagination, zoneMeta }` |
| `GET /api/leagues/:tier/instances` | `mode` | instances in number order, each with `players` |
| `GET /api/team-battles/leagues/:2|3/:tier/standings` | `instance`, `page`, `perPage` ≤ 100, `stables` | `{ standings: [team rows with status], pagination, zoneMeta }` |
| `GET /api/team-battles/leagues/2/:tier/tag-team-standings` | same | Tag Team rows |
| `GET /api/team-battles/leagues/:2|3/:tier/instances`, `/leagues/2/:tier/tag-team-instances` | — | instances in number order |

- Rows keep their earlier fields (`zone`, `eligible` and the rest) and add `rank` (robot rows) and `status` (`{ kind, zone, cyclesToGo?, minLP? }` or null).
- v2.1 (additive): `stables=players` keeps only player-owned rows with their place among all, and `pagination` counts the players' rows; `zoneMeta` stays that of the whole instance or tier. Robot rows carry `leagueInstanceId`; instance lists carry `players` (player-owned entries). An unknown `stables` value answers 400.
- `zoneMeta.minLP` is `null` in Champion (it used to serialise Infinity as null and render "≥ LP").
- `my-standings` loads the viewer's standings, then every row of the tiers they occupy (planner fields only) and the tier populations, and runs the planner in memory. On ACC (ApenRots, 46 entries in 16 tiers) that is 5,215 rows read in 69 ms.

## Who appears
A robot or team appears in a league's standings once it has a standings row, created the first time it becomes matchable by subscription (robot subscribed; team complete with every member subscribed) and placed in the least-full Bronze instance. Unsubscribing keeps the row ("Not entered"); disbanding a team removes it. Robots and teams without a row are **Unranked** on the robot, team and dashboard cards. Full rule: `PRD_LEAGUE_SYSTEM.md` ("Entering a League").

## Automaton stables
Automaton_Stables appear in every league on the same terms as human stables. The stable name renders through `OwnerNameLink` (inside `RecordStable`), with the Automaton_Badge as the name's direct sibling on one non-wrapping line (`tests/e2e/automaton-badge.spec.ts` at 320, 360, 768 and 1024 px).

---

## Tests
- Backend: `tests/services/league/standing-status.test.ts` (each status, residency before LP, cohort hold, placement rules, paused instances, a property that `promotes`/`demotes` equal the executor plan, `zoneMeta` for Champion and selected instances), `tests/leagues.test.ts` (rank and status on rows, `my-standings` place/size/status, validation 400s, login required, the players filter for robot and team leagues and the instance player counts), `tests/unit/signedInOnlyRoutes.route.test.ts`.
- Frontend: `utils/__tests__/leagueStandings.test.ts` (URL params, opening view, card summaries, status and zone wording), `pages/__tests__/LeagueStandingsPage.test.tsx` (opening view, cards, chips, bands, own rows, per-mode columns, request parameters, whole-tier pager, retry, stale responses, the Stables filter).
- Playwright: `tests/e2e/league-standings.spec.ts` (chromium). Against the seeded backend: opens on the player's league, every league card loads, the Battle menu reaches the page. With the league endpoints answered from an ACC-like fixture (`tests/e2e/helpers/leagueStandings.ts`): opening view, bands, chips, own rows and Workshop links, bot chip and Automaton_Badge, league/tier/instance navigation and paging, and at 320 and 390 px no horizontal overflow, 44 px touch targets and the chip rows scrolling.
