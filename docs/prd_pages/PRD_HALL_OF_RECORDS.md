# Product Requirements Document: Hall of Records Page

**Project**: Armoured Souls
**Document Type**: Product Requirements Document (PRD)
**Version**: v2.0
**Date**: November 8, 2026
**Status**: ✅ Implemented

---

## Version History
- v1.0 - Initial draft by GitHub Copilot (February 6, 2026)
- v1.1 - Review done by Robert Teunissen (February 9, 2026)
- v1.2 - Implementation verification, added core design references, enhanced future enhancements (February 9, 2026)
- v1.3 - Added King of the Hill Records category (7 records) (March 18, 2026)
- v1.4 - Spec #46: removed five degenerate record categories, scoped Most Damage per battle mode, restricted Biggest Upset to tournament modes and added summed-team-ELO team upsets, rounded the KotH zone metrics, labelled Career mode coverage, added the Win Streaks tab, added kills per match to Grand Melee (July 26, 2026)
- v2.0 - Redesign (November 8, 2026): record board with one tile per record and a top-10 view per record, URL-addressable groups, "your places" for the viewer, links to every robot and stable; the payload is served from a background-refreshing cache warmed at start-up (a cold build took 9–10 s on ACC). Removed Narrowest Victory, Grand Melee Highest LP and four team duration/duplicate records; fixed the KotH win streak (it never reset), the KotH average zone score ranking, the per-battle figures of lifetime damage and destructions, and the missing league on two cards; generated bot stables no longer rank as richest. This document now describes v2.0 only; the v1.x feature catalogue is in git history.

---

## References

- [PRD_SEASON_SYSTEM.md](../game-systems/PRD_SEASON_SYSTEM.md): season scope, accolades captured at rollover
- [PRD_AUTOMATON_STABLES.md](../game-systems/PRD_AUTOMATON_STABLES.md): parity (decision 33) and the Automaton_Badge on every record (decision 42)
- [PRD_ROBOT_DETAIL_PAGE.md](./PRD_ROBOT_DETAIL_PAGE.md) and [PRD_STABLE_VIEW_PAGE.md](./PRD_STABLE_VIEW_PAGE.md): where robot and stable names link to
- [DESIGN_SYSTEM_AND_UX_GUIDE.md](../design_ux/DESIGN_SYSTEM_AND_UX_GUIDE.md): tokens, Automaton_Badge

### Implementation files
| Layer | File |
|---|---|
| Route | `app/backend/src/routes/records.ts` (`GET /api/records`) |
| Payload and cache | `app/backend/src/services/records/hallOfRecordsService.ts` (`buildHallOfRecords`, `getHallOfRecords`, `warmHallOfRecords`, `invalidateHallOfRecords`), `app/backend/src/lib/refreshingCache.ts` |
| Queries | `app/backend/src/services/records/recordsQueryService.ts` |
| Accolades | `app/backend/src/services/season/seasonArchiveService.ts` (`writeAccolades`) |
| KotH streak | `app/backend/src/services/standings/standingsService.ts` (`awardKothPoints`), migration `20261108120000_rebuild_koth_win_streaks` |
| Page | `app/frontend/src/pages/HallOfRecordsPage.tsx` (composition and URL state) |
| Components | `app/frontend/src/components/hall-of-records/` (RecordBoard, RecordTile, RecordDetail, RecordGroupTabs, ScrollRow, YourPlacesStrip, RecordNames, RecordStableName, useHallOfRecords, types) |
| View model | `app/frontend/src/utils/hallOfRecords.ts` (`buildRecordCatalogue`, `findMyPlaces`, `summariseMyPlaces`, `rankRows`, `tileFootprint`, `boardColumns`) |

---

## Purpose

The Hall of Records shows who holds each record of the season in progress, and where the viewer's stable stands. It is a "who is best at what" board, not a set of leaderboards: one tile per record answers the question at a glance, and the full top 10 is one tap away.

Records are live, current-season data. When a season ends the top placements are copied into `season_accolades` and the live data resets; earlier seasons' records are read in the Season Archive (`/seasons`), which already lists them per season. The Hall of Records does not show past seasons itself, so each season's records have one home.

---

## Page structure

1. **Header**: "Hall of Records", the season line ("Season 1 records · cycle 97 of 100 · updated after every cycle"; "preparation" during the preparation phase) and a link "Past seasons: Season Archive ›".
2. **Your stable strip** (`YourPlacesStrip`): the viewer's stable name, "N records held · M top-10 places", the records held (or the best place when none is held), and a **Show only my places** toggle. "Records held" counts each record (or record mode) once, even when two of the stable's robots tie for its top spot. A stable with no place says "No top-10 places yet this season" and shows no toggle, unless the filter is already on (a bookmarked `mine=1` link), so it can always be switched off.
3. **Group tabs** (`RecordGroupTabs`): All records, Robots, Single battles, Streaks, KotH & Melee, Stables. A group without any record gets no tab.
4. **Record board** (`RecordBoard`): per group a heading with a one-line note, then a grid of tiles: 1 column on phones, 2 from `md`, and from `xl` 3 or 4 columns per group, whichever leaves fewer empty cells (`boardColumns`; six robot records fill two rows of three, not one and a half of four).
5. **Footer note**: names open profiles; records reset at season end and stay in the Season Archive.

On phones the full board ("All records", not filtered to mine) shows the first two tiles of each group and a full-width "Show all N records" button (`aria-expanded`), which expands that group only. A selected group tab or "Show only my places" shows every tile. This takes the 390 px board from about 5,800 px to about 3,600 px.

The group tabs, the record chips and the mode switcher (`ScrollRow`) are single rows that scroll sideways on phones, with a fade on each edge that still has chips beyond it. The selected chip is scrolled into view when the selection changes. In the full list both chip rows wrap from `md`.

### Tiles (`RecordTile`)
- **Single list**: record title, "Top 10 ›" (or "Full leaderboard ›"), the value of the top spot, the holder ("Robot · Stable", or the stable alone for stable records), one line of context, "Battle report ›" for battle records, and "You: #N · Robot" when the viewer is in the top 10.
- **Per-mode records** (Most damage in one battle, Longest league win streak, Most decisive team victory) span two columns and list the top holder of each mode. With only one populated mode they take the single-list layout but keep that mode's label under the title (e.g. "3v3 League"), so they never read as an all-mode ranking. Records with four or more modes also span two rows on `xl`, so the single tiles beside them keep their own height (`tileFootprint`).
- **Latest champions** stacks one entry per tournament type (tournament name, then champion and stable) in a single column; its link reads "Last 10 per type ›", because the log holds the 10 most recent winners per type.
- A shared top spot adds "tied with X" / "tied with N others". A streak that is still running is marked "● running".
- A generated bot stable gets the same "bot" chip as the Season Archive after its name (never the Automaton_Badge). Generated stables still hold records other than Richest Stable, e.g. zone time or the biggest team upset.

### Full list (`RecordDetail`, `?record=<key>[&mode=<variant>]`)
"← All records", title, scope line, chips for the other records of the group, a mode switcher for per-mode records (a static "Mode: …" line when only one mode is populated), and an ordered list of up to 10 rows: rank (🥇🥈🥉 for 1–3), holder, stable, context, battle report link, value. The viewer's rows are highlighted with a "You" chip; when none is present a note says so. An unknown record key falls back to the board.

### Links
- Robot names link to `robotPath(id, isOwner)`: the owner's Workshop for their own robots, the public Robot Profile for everyone else.
- Stable names link to `/stables/:userId` through `OwnerNameLink` (Automaton_Badge included); names without an id render through `RecordStableName`.
- Team and line-up names are plain text (team pages do not exist).
- Most destructions, Highest fame and Highest prestige link to `/leaderboards/losses`, `/leaderboards/fame` and `/leaderboards/prestige` instead of a top-10 view: those pages already rank the full list.

### URL state
`group` (board filter), `record` and `mode` (full list), `mine=1` (only records the viewer appears in). Changing the group or the "mine" filter clears `record` and `mode`.

---

## Record catalogue

| Key | Group | Value | Scope / ranking |
|---|---|---|---|
| `mostBattles` | Robots | battles | Every mode, KotH and Grand Melee included (`getTopRobotsByAllModesBattleCount`); context shows the win/loss-mode W-L-D |
| `highestWinRate` | Robots | win % | Win/loss modes, minimum `WIN_RATE_MIN_BATTLES` (50) battles |
| `highestElo` | Robots | ELO | 1v1 rating |
| `mostLifetimeDamage` | Robots | damage | Every mode; per battle = damage ÷ all-modes battle count |
| `mostKills` | Robots | destroyed | `robots.kills`, every mode (KotH and Grand Melee included); per battle = kills ÷ all-modes battle count; links to the Destructions Leaderboard (`/leaderboards/losses`, renamed from "Total Losses Leaderboard" so both pages use one word) |
| `highestFame` | Robots | fame | Robot fame; links to the Fame Leaderboard |
| `mostDamageInBattle` | Single battles | damage | Per mode: 1v1 League, 1v1 Tournament, 2v2 League, 3v3 League, KotH, Grand Melee (Spec #46 R4.5); opponent shown for the 1v1 modes |
| `biggestUpset` | Single battles | +ELO | `tournament_1v1` only (Spec #46 R4.6) |
| `biggestTeamUpset` | Single battles | +ELO | 2v2/3v3 tournaments, summed team ELO (R4.7) |
| `mostDecisiveVictory` | Single battles | HP | Per size (2v2/3v3 League): HP left on the winning side minus the losing side, `battles.winning_side` required |
| `leagueWinStreak` | Streaks | wins in a row | Per league mode from `standings.best_win_streak` (Spec #46 R7); a bye counts as a win |
| `kothWinStreak` | Streaks | first places in a row | `standings.best_win_streak` for KotH |
| `kothMostWins` | KotH & Melee | first places | |
| `kothAvgZoneScore` | KotH & Melee | avg per match | Ranked in SQL on total zone score ÷ matches, minimum `KOTH_AVG_ZONE_SCORE_MIN_MATCHES` (10) |
| `kothZoneTime` | KotH & Melee | time | Total zone time, one decimal (R4.10) |
| `kothZoneDominator` | KotH & Melee | zone score | Total zone score, one decimal |
| `kothKills` | KotH & Melee | destroyed | `robot_mode_kills` for KotH |
| `meleeWins` | KotH & Melee | first places | `robots.grand_melee_wins` |
| `meleeKills` | KotH & Melee | destroyed | `robot_mode_kills` for Grand Melee, with kills per match (R4.17) |
| `highestPrestige` | Stables | prestige | Links to the Prestige Leaderboard |
| `mostTitles` | Stables | titles | Stables with at least one title |
| `richestStable` | Stables | credits | `users.currency`; **generated bot stables are excluded** (they never spend); Automatons stay ranked |
| `tournamentChampions` | Stables | tournament | The 10 most recent champions per type (1v1, 2v2, 3v3); a log, not a ranking |

Every list is the top 10. Rows that tie on the ranked value share a rank ("1, 1, 3"); queries order ties deterministically (usually the lower id first).

### Removed records
| Record | Removed | Reason |
|---|---|---|
| Fastest Victory, Longest Battle (Combat) | Spec #46 | ~1 s degenerate resolutions; every Longest Battle read the duration cap |
| Biggest ELO Gain / Loss | Spec #46 | Fixed `ELO_K_FACTOR`, every entry ±32 |
| KotH Best Placement | Spec #46 | Every winner tied at 1 |
| Narrowest Victory | v2.0 | 94 1v1 wins at exactly 1 HP on ACC: the whole list read "1 HP remaining" |
| Team Fastest Victory | v2.0 | 3v3 top 10 all 2 s, 2v2 3–4 s |
| Team Longest Survival, Longest Non-Draw Battle | v2.0 | Pile up at the 300 s battle limit (252 2v2 survivals of 290 s or more) |
| Team Most Damage Dealt | v2.0 | Same query as Most damage in one battle for 2v2/3v3 League |
| Most Expensive Battle | v2.0 | Never implemented; always an empty list |
| Grand Melee Highest LP | v2.0 | The top of the Grand Melee league standings, which League Standings already ranks (and the season archive keeps as a standing snapshot) |

---

## Data rules

- **KotH win streak.** `awardKothPoints` now resets `current_win_streak` on any finish other than 1st and on a forfeit, as Grand Melee always did; it is not a loss. Before v2.0 the streak never reset, so `best_win_streak` equalled `wins` for every KotH robot (4,470 of 4,470 rows on ACC). Migration `20261108120000_rebuild_koth_win_streaks` rebuilds both streak columns from the season's KotH battles (`battle_participants.placement`, battle time then id; rows without a placement are byes and are skipped). It only touches KotH robot standings with history and leaves wins and LP alone; running it twice gives the same values. ACC dry run: top best streak 26 instead of 41.
- **Per-battle figures** for lifetime damage and destructions divide by the all-modes battle count (`getAllModesBattleCounts`), because both totals include KotH and Grand Melee. The old figures divided by the win/loss-mode count (a 373% "kill rate" on ACC). `killRate` is replaced by `killsPerBattle`.
- **Owner ids.** Every owner object carries `userId` (from `getRecordOwner`); tournament champions carry `ownerUserId` and, for 1v1, `championRobotId`. The viewer's places are matched on that id.
- **Automatons** hold records on equal terms (decision 33) and carry the Automaton_Badge on every record that names a stable (decision 42).
- **Season scope.** Robots, standings and battles are current-season data, so every record is too.

---

## API

`GET /api/records` (authenticated) returns:

```text
combat.mostDamageInBattle      { [mode]: [{ battleId, damageDealt, robot, opponent?, durationSeconds, date }] }
upsets.biggestUpset            [{ battleId, eloDifference, underdog, favorite, date }]
upsets.biggestTeamUpset        [{ battleId, battleType, eloDifference, underdog: { robots, teamEloBefore }, favorite, date }]
career.mostBattles | highestWinRate | mostLifetimeDamage | highestElo | mostKills
economic.highestFame | richestStables
prestige.highestPrestige | mostTitles
koth.mostWins | highestAvgZoneScore | mostKillsCareer | longestWinStreak | mostZoneTime | zoneDominator
teamBattle['2v2' | '3v3'].mostDecisiveVictory   [{ battleId, hpDifference, winners, losers, date }]
grandMelee.mostWins | mostKillsCareer
winStreaks                     { [league mode]: [{ entityId, entityName, bestWinStreak, currentWinStreak, isActive, wins, ...owner }] }
tournamentChampions1v1 | 2v2 | 3v3 (omitted when empty)
timestamp
```

v2.0 removed `combat.narrowestVictory`, `economic.mostExpensiveBattle`, `grandMelee.highestLp`, `career.mostKills[].killRate` and the team keys `fastestVictory`, `longestSurvival`, `mostDamageDealt`, `longestNonDrawBattle` (team decisive victories now return `winners`/`losers` instead of `team1`/`team2`). It added `userId` on every owner, `allModesBattleCount` and `killsPerBattle` on career rows, `currentWinStreak`/`isActive` on KotH streaks, and `ownerUserId`/`championRobotId` on champions. The SPA is the only client.

## Performance and caching

A cold build of the payload took 9–10 s on ACC (`request_metrics`, `/api/records`, 3 and 8 Nov 2026), and the old 5-minute `TimedCache` made the first visitor after every expiry wait for it. Measured read-only on ACC (1.0 M `battle_participants`, 254 k `battles`), the cost is dominated by the six Most damage lists (a parallel sequential scan of `battle_participants` each, 0.4–0.75 s) and the upset self-join (~0.6 s); everything else is under 0.3 s. A single windowed query over all six modes (3.4 s) and a battle-type-first upset join (1.1 s) were both slower, and an index on `damage_dealt` would make the rarer modes walk most of the index, so the queries stay as they are and the payload is kept off the request path:

- **`RefreshingCache`** (stale-while-revalidate): a fresh payload (under 5 minutes) is returned as is; a stale one is returned at once and rebuilt once in the background; concurrent first requests share one build; a failed rebuild keeps the previous payload and is logged.
- **Warm-up**: the server builds the payload 5 s after start-up, so the first visitor after a deploy does not wait either.
- **Season rollover**: once the old season is purged and the next one opened, the rollover calls `invalidateHallOfRecords()`. That drops the payload and discards any build still in flight (it may have read half-purged data), so the Hall never shows the previous season's records, or links to deleted robots and battles, under the new season's heading. The first visitor after the rollover waits for one build.
- **Narrower reads**: Most damage no longer loads the battles' combat logs (`battle_log_zst`, ~4.8 MB per build across the 60 battles on ACC) or full robot rows; every robot a record names is read as id, name and stable only; tournament champions load all winners of a type in one query instead of one per tournament.
- Each build logs `[HallOfRecords] Built in N ms`.

## Accolades

`writeAccolades` reads the same service, so the season archive follows these lists: Narrowest Victory and Grand Melee Highest LP are no longer captured, Richest Stable excludes generated stables, the KotH streak and average zone score accolades use the corrected values. Accolades written before v2.0 are never rewritten.

---

## Season Archive

The Season Archive (`/seasons`) shows each completed season's records with the same tiles, groups and top-10 list as the Hall (`components/season/SeasonArchiveRecords.tsx`). `utils/seasonArchiveRecords.ts` (`archiveRecordCatalogue`) turns the season's accolades into the same record definitions, with the Hall's keys, titles, groups and value formats; categories the live Hall dropped (Narrowest Victory, Grand Melee LP) stay readable for the seasons that captured them, and unknown categories fall back to their spaced name.

- Accolades keep no robot or stable id, so names do not link, except the viewer's own stable (matched on its name, as the archive always did), which links to the viewer's stable page and drives the "You: #N" lines and highlighted rows.
- The open season and record are in the URL: `/seasons?season=0`, `/seasons?season=0&record=mostDamageInBattle&mode=grand_melee`; "← All records" returns to the season. The "Show only my stable" toggle filters records the same way as standings: only the viewer's own rows remain, at their stored ranks (a #2 shows as #2, not under someone else's #1), and the champions log keeps the viewer's own tournament wins.
- Group notes are hidden (they describe the live season); group and record titles are `h3` under the archive's "Records" `h2`; the list has no "not in this top 10 yet" note.
- The archive page uses the same container, header pattern, design tokens and "You"/"bot" chips as the Hall, and the two pages link to each other ("This season: Hall of Records ›" / "Past seasons: Season Archive ›").

## Accessibility and responsiveness

- Tiles are `article`s with links inside; no clickable card wrappers. Tab buttons, chips and links on the board are at least 44 px tall.
- Group tabs and the "mine" toggle are buttons with `aria-pressed`; the mode switcher and sibling chips are links with `aria-current`.
- Context text uses `text-secondary`; `text-tertiary` is only used for separators.
- No page-level horizontal scroll at 320, 390 and 1440 px (checked with screenshots against ACC-like data); only the chip rows scroll sideways on phones. Names wrap instead of truncating.

## Tests

- Backend: `src/services/standings/__tests__/standingsService.test.ts` (KotH streak reset), `src/services/records/__tests__/careerMostBattles.test.ts` (per-battle figures), `tests/records.test.ts` (removed keys, generated stables), `tests/integration/automatonPublicExposure.test.ts` (owner type and id on every record), `tests/integration/kothWinStreakRebuildMigration.test.ts` (migration).
- Backend cache: `src/lib/__tests__/refreshingCache.test.ts` (including invalidation discarding a build in flight), `src/services/season/__tests__/seasonRolloverRun.test.ts` (rollover invalidates the Hall once the new season is open).
- Season Archive: `utils/__tests__/seasonArchiveRecords.test.ts`, `pages/__tests__/SeasonArchivePage.test.tsx`, `pages/__tests__/AutomatonBadgePages.test.tsx`, and the archive block of the Playwright spec below.
- Playwright: `tests/e2e/hall-of-records.spec.ts` (chromium project). Against the seeded backend: the page loads, a record opens its top 10 and returns, the Social menu reaches it. With `/api/records` answered from an ACC-like fixture (`tests/e2e/helpers/hallOfRecords.ts`): every group, the viewer's places, Automaton badge and bot chip, group and "mine" filters in the URL, mode deep links and switching, the viewer's highlighted row, the leaderboard link, robot and stable links, and at 320 and 390 px no horizontal overflow, 44 px touch targets, collapsed groups and the scroll fade.
- Frontend: `utils/__tests__/hallOfRecords.test.ts`, `components/hall-of-records/__tests__/RecordTile.test.tsx`, `RecordBoard.test.tsx`, `ScrollRow.test.tsx`, `AutomatonRecordBadge.test.tsx`, `pages/__tests__/HallOfRecordsPage.test.tsx`.
