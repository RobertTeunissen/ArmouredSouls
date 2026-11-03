# Admin Portal Guide

## Overview

The Admin Portal (`/admin`) is the primary management and monitoring tool for Armoured Souls. It requires the `admin` role and is accessed via a dedicated sidebar-based layout separate from the player-facing game UI.

## Architecture

The portal uses a **sidebar + page** architecture:

- **`AdminLayout.tsx`** — Fixed sidebar with grouped navigation, header bar with page title, error boundary, and `<Outlet>` for page content
- **Pages** — Each page is a lazy-loaded standalone component in `pages/admin/`
- **Shared components** — Reusable UI in `components/admin/shared/`: `AdminPageHeader`, `AdminPanel` (section shell with loading and error states), `StableScopeToggle`, `ToggleChip`, `AdminPagination`, `AdminFilterBar`, `AdminStatCard`, `AdminSlideOver`
- **Types and formatting** — each page has a typed API module (`utils/admin*Api.ts`, mirroring its backend service) and a format module (`utils/admin*Format.ts`); shared number formatting is `utils/adminFormat.ts`

All pages manage their own data fetching (no shared admin store). The sidebar shows labels only, grouped under section headings (`components/admin/adminNavConfig.ts`, shared with the drawer). Below 768 px the sidebar is replaced by a hamburger menu and a navigation drawer.

## Navigation Structure

| Section | Page | Route | Description |
|---------|------|-------|-------------|
| **Overview** | Dashboard | `/admin/dashboard` | Status strip, needs attention, player KPIs, battle activity per mode |
| | System | `/admin/system` | Server health: disk, memory, database, backup, backend starts, failing and slow requests, scheduler job durations, largest tables |
| **Game Operations** | Cycle Controls | `/admin/cycles` | Running job, daily schedule with Run buttons, persistent run history (restarts, missed and interrupted runs), bulk cycle runner |
| | Practice Arena | `/admin/practice-arena` | Practice usage per UTC day, refusals and unavailable time, top practitioners, how it is used |
| **Battle Data** | Battles | `/admin/battles` | Find any battle (all 9 modes, stable type, outcome, date, search); admin check with payout check, combat log with formulas, and export |
| | Attributes | `/admin/attributes` | Which attributes, groups and build profiles win, per mode, from battle-time builds (was Robot Stats) |
| | Meta | `/admin/meta` | What stables choose: combat settings (stances, loadouts, yield), robot builds (tuning, weapons and refinements), stable investments (event entry, facilities) |
| | League Health | `/admin/league-health` | Every tiered league: tiers, instances, stable mix, and whether promotion and demotion move |
| | Weapons | `/admin/weapons` | What winning robots fight with: archetype (range × loadout) and weapon effects, matchups, usage per league tier, price vs effect, refinements |
| **Player Management** | Players | `/admin/players` | Human stables with segment cards (Active, Inactive, Dormant, Stuck in onboarding, Low balance), search over every stable type, detail panel |
| | Automatons | `/admin/automatons` | Automaton stables: status bar, stables, strategies, editor, catalogue (Spec #55) |
| | Economy | `/admin/economy` | Where credits come from and go, repairs and their discounts, balances, per stable type |
| **Security & Moderation** | Security | `/admin/security` | Security signals per window: who triggered them and sources without an account |
| | Image Uploads | `/admin/image-uploads` | Images in use, moderation outcomes, image removal, storage cleanup |
| | Admin actions | `/admin/actions` | Everything an admin changed, newest first, by area and result (was the Audit Log) |
| **Content** | Changelog | `/admin/changelog` | Create, edit, publish changelog entries |
| | Achievements | `/admin/achievements` | This season's unlock rates per achievement and tier, for players, Automatons or generated stables |
| | Search Analytics | `/admin/search-analytics` | Settled searches, no-result rate, results by category, phrase table with CSV export |

The Maintenance group is gone (Nov 2026, admin redesign part 8): the Repair Log is the Repairs block on Economy (`/admin/repair-log` redirects there) and the Audit Log is Admin actions (`/admin/audit-log` redirects to `/admin/actions`).

## UI Patterns

### Stable-type filter

Pages that split by stable type use one filter, `StableScopeToggle`, kept in the URL as `?stables=`: **Players** (human stables without system and test accounts), **Automatons**, **Generated** (every generated bot stable, including the seeded `test_user_*` stables) and **All**. Backend: `utils/stableScope.ts` (`buildStableScopeFilter`). Used by Dashboard, Meta, Economy, Achievements (no All) and League Health's "This season" (default All). Dashboard and Meta used `?filter=real|auto|automaton|all` before (where `test_user_*` stables showed only under All); old links still read correctly. Battles keeps its own "battle has a robot of this type" filter (`?stable=`).

### Other controls

- `ToggleChip` — pressed-state chip (check mark and border, never colour alone) for single-choice filters: window, area, result.
- `AdminFilterBar` — pill or segmented filter groups (Battles, Search Analytics).
- `AdminPagination` — Previous / Next with "Showing a–b of N"; the buttons are named "Previous page of {rows}" / "Next page of {rows}".
- `AdminSlideOver` — right-side panel for detail views (player detail, battle detail, image detail) without leaving the page.
- `AdminPanel` — section shell with heading, header actions, skeleton and error with Retry.

### Links between pages

A stable's name in a battle's admin check (sides, placements, payout check) opens its detail panel on Players (`/admin/players?user=`), which serves every stable type. The detail panel links to the stable's battles on Battles, its player page and, for an Automaton, the Editor. Admin actions link to the page each action was taken on.

## Page Details

### Dashboard (`/admin/dashboard`)

The landing page answers "is the game healthy, and does anything need me?". It is read-only and sends no alerts (Discord alerts have their own single emitters).

Sections, top to bottom:

1. **Toolbar** — the stable-type filter (Players / Automatons / Generated / All, `?stables=`, default Players; see [Stable-type filter](#stable-type-filter)), "Last updated" and Refresh. Refresh refetches every section and bypasses the battle-activity cache.
2. **Status strip** (system-wide) — Cycle and Season (with a "(preparation)" marker), Last cycle (settlement time and age), Next cycle (next `settlement` cron run), Scheduler, Queued matches.
3. **KPI cards** — Active players (7 days), New players (7 days), Inactive players (3+ days), Battle-ready robots.
4. **Needs attention** (system-wide) — open items first, each linking to the page that resolves it; OK items collapse to a muted ✓ line.
5. **Battle activity** — one row per battle mode plus Total. Below 768 px a Volume / Rates toggle switches columns.

What stables choose (stances, loadouts, yield thresholds, facilities, weapons) is on the [Meta](#meta-adminmeta) page; tier distributions are on League Health.

Below 1280 px the sections stack in one column. Below 768 px the admin sidebar is replaced by a hamburger menu that opens the navigation in a drawer (all admin pages).

**Filter scope.** The filter applies to Battle-ready robots and the Last cycle and Season columns of Battle activity. The status strip, Needs attention and the Queued column are system-wide. The three player cards are always human stables, because they are login-based and bots and Automatons never log in.

**Definitions**

| Number | Definition |
|---|---|
| Active players (7 days) | Human stables with `lastLoginAt` in the last 7 days. `lastLoginAt` is written at password login; JWTs expire after 24 h without refresh, so it is at most a day stale. |
| New players (7 days) | Human stables registered in the last 7 days; trend vs `[now − 14d, now − 7d)`. |
| Inactive players (3+ days) | Human stables whose last login (or registration, if they never logged in) is more than 3 days ago. A rise is shown red. |
| Trends on Active / Inactive | Compared with the `admin_kpi_snapshots` row captured about 7 days ago (each competitive settlement writes one). "No comparison yet" until such a row exists. |
| Battle-ready robots | `currentHP ≥ maxHP` and a main weapon, as a percentage with one decimal. |
| Bankruptcy risk | Human stables below ₡10,000 (`BANKRUPTCY_RISK_THRESHOLD`). Links to Players → At-Risk (`/admin/players?tab=at-risk`). |
| Security | Failed-login bursts, ownership violations and race-condition or robot-creation bursts in the last 24 hours (stored signals); a warning when any, otherwise OK with the number of ordinary signals. Links to `/admin/security?window=24h`. |
| Automatons need attention | `needAttentionCount` of the Automatons status bar; an error if any turn failed. Links to the Stables tab filtered on attention. |
| Failed requests | Only listed when a request failed with a server error (5xx) in the last 24 hours: "N requests failed in the last 24 h", red, naming the route and error code with the most. Links to [System](#system-adminsystem). Counted per hour, so "24 h" can include up to one hour more. No item when nothing failed or the counts could not be read. |
| Cycle problems | One item, red if any of: settlement overdue (scheduler active and the last settlement missing or older than 26 h; "last settlement" is the later of `cycle_metadata.last_cycle_at` and the season's `last_settlement_at`, so daily Preparation_Phase settlements count too and a missed one still shows); a scheduler job whose last run failed; matches still `scheduled` more than 2 h after their slot ("left behind"). Otherwise "Last cycle healthy". The scheduler's job states are in memory and reset on every restart or deploy, so the item then reports "k/10 jobs reported since restart"; the overdue and left-behind checks read the database and work across restarts. |
| Battle activity · Last cycle | Battles created between the ends of the two most recent settlements (`cycle_snapshots.end_time`). "—" until a season has two settlements. |
| Battle activity · Season | Every row in `battles` (truncated at Season_Rollover). Counts include battles with at least one participant robot owned by a filtered user. |
| Battle activity · Walkovers | Byes and battle-time forfeits (`is_bye_match` on the scheduling row, a forfeited participant, or a bracket row with status `forfeit`). Counted as battles, left out of the rates. |
| Battle activity · Queued | System-wide: `scheduled_matches_v2` rows still `scheduled`, plus outstanding bracket rows of active tournaments that already have a participant. |
| Draw % / Kill % / Avg time | Over fought battles. Draw = `winner_id IS NULL AND winning_side IS NULL` (team battles record their result in `winning_side`); n/a for KotH and Grand Melee. Kill = at least one participant `destroyed`. |

**API:** `GET /api/admin/dashboard/status` (no filter; `attention.requests` is `{ failures24h, topRoute, topCode }` or null), `GET /api/admin/dashboard/kpis?stables=`, `GET /api/admin/dashboard/battle-activity?stables=&fresh=` (cached 60 s per stable type; `fresh=true` bypasses). All require `authenticateToken` + `requireAdmin`. `kpis.activeUsersLast7d` is deprecated (it counted robots updated by battles); use `humanPlayers.active7d`.

### System (`/admin/system`)

Answers "is the server healthy, and is anything failing?". Status only: alerts stay with their single emitters (disk-monitor.sh, backup.sh, the deploy workflow and the daily health report in Discord). Read-only; refreshes every 60 s and on Refresh. All times UTC.

Sections, top to bottom:

1. **Status cards** — Disk, Database, Memory, Last backup, Backend, Failing requests. The left border carries the tone, the caption says it in words.
2. **Failing requests** — server errors (5xx) per route and error code over the last 7 UTC days: page, count, kind, last time and a per-day strip.
3. **Slow requests** — routes that took 2 s or longer in the last 7 days: count, average and slowest.
4. **Backend starts** — the last 7 days, newest first, each marked Deploy or Restart.
5. **Scheduler jobs** — per job over the last 8 UTC days: last run, median, slowest (amber when over 1.5× the median, with its day and any interrupted or failed runs) and the last 8 runs as a strip (grey: failed or interrupted). Below: **Lock held per day**, the time any job held the scheduler lock (Practice Arena refuses battles meanwhile).
6. **Largest tables** — the six biggest tables on disk with their row estimate, and the database total.

Below 768 px the tables become lists.

**Definitions**

| Number | Definition |
|---|---|
| Disk | Usage of the root filesystem (`df`), with the disk monitor's thresholds: amber from 80%, red from 90%. |
| Database | `pg_database_size`; largest table by `pg_total_relation_size` (data, indexes and TOAST). |
| Memory | `MemAvailable` from `/proc/meminfo` (memory the kernel can hand out without swapping, page cache included), of `MemTotal`, and swap in use. Amber below 15% available. Locally (macOS) the OS free memory, without swap. |
| Last backup | Newest file in `/opt/armouredsouls/backups/daily` (`.sql.zst`, or the older `.sql.gz` / `.dump`): time, size and age. Amber when older than 26 h, red when none is found (or the directory is missing on ACC/production); "—" on a local machine. |
| Backend | Uptime of this backend process and its start time. |
| Failing requests | Server errors (status 500 or higher) since the start of the hour 24 hours ago. 4xx answers (bad links, probes, invalid input) are not counted. |
| Error kind | The error code `errorHandler` answered with: `STATEMENT_TIMEOUT` (Postgres cancelled the query at the 30 s statement timeout), `INTERNAL_ERROR` (any other unexpected error), the code of a 5xx `AppError`, or `HTTP_<status>` when a 5xx left without passing `errorHandler`. |
| Page | The admin page the route serves (`/api/admin/economy/...` → Economy), or the API area for player routes (`/api/robots/...` → Robots). |
| Slow request | Any request, failed or not, that took 2 s or longer (`SLOW_REQUEST_MS`). Counts are summed per hour, so the page shows average and slowest, not a median. |
| Deploy / Restart | A start is a Deploy when its deploy tag differs from the start before it. PM2 keeps the environment of the last deploy, so a crash restart or host reboot repeats the tag and is a Restart; starts before deploy tags existed are Restarts too. |
| Median (jobs) | Median duration of successful runs in the window; slowest is over all finished runs. |

**Recording.** Request counts live in `request_metrics`: one row per UTC hour, kind (`error` / `slow`), method, route pattern and error code. The route is the Express route pattern (`/api/admin/users/:id`), never the raw URL, so ids and query strings are not stored; requests that matched no route (404s, probes) are left out. `requestLogger` reports every finished request; counts are summed in memory and written once a minute (one upsert per bucket, at most 500 buckets per minute), and rows older than 30 days are deleted hourly. A restart loses at most the last minute. Before the first row the request sections say "Nothing recorded yet". Backend starts come from `scheduler_processes`, job runs from `scheduler_job_runs`.

**Deploy tag.** The deploy workflow sets `DEPLOY_TAG=deploy-{acc|prd}-YYYYMMDD-HHMMSS` (UTC), passes it to PM2 (`reconcile-pm2-backend.sh`, `--update-env`) and uses the same value for the git tag, so Backend starts and Cycle Controls show which release started.

**API:** `GET /api/admin/system/overview` (`services/admin/system/`), `authenticateToken` + `requireAdmin`. The Dashboard's Failed requests item reads the same counts (`getRequestFailures`).

### Meta (`/admin/meta`)

An overview of what stables choose, for the selected stable type. It moved off the Dashboard (where it was the collapsed "Meta snapshot") so the landing page stays short, and the old Tuning, Refinement and Subscriptions pages were merged into it: `/admin/tuning`, `/admin/refinement` and `/admin/subscriptions` redirect here. The toolbar is the Dashboard's: the same filter (`?stables=`, default Players), "Last updated" and Refresh (reloads both requests).

Three groups, ordered from choices made per battle to long-term investments (desktop: three cards, then two per row; they stack below 1280 px):

| Group | Section | Shows |
|---|---|---|
| Combat settings | Stances / Loadouts | One stacked bar per distribution plus a legend: share and robot count per option, largest first. |
| | Yield thresholds | One column per threshold in use (labels at 0–20% in steps of 5 and on the highest), the most common value highlighted. Above it: Most common (with its share), Median (the threshold of the middle robot) and Above 20% (robots and share). Exact counts per threshold are in each column's tooltip and in a screen-reader table. |
| Robot builds | Tuning | Robots tuned (at least one point) of all robots; pool used = allocated points of the summed pools, where each robot's pool is (its stable's Tuning Bay level + 1) × 10; points per attribute group (Combat, Defence, Chassis, AI, Team, as on Attributes); the top 10 attributes by points with the robots using each, and "Show all" for every tuned attribute. |
| | Weapons and refinements | Owned, Equipped (owned weapons in any robot's main **or** offhand slot, `equippedInventoryItems`, with the share), weapons refined (share of owned), stables refining (of stables with robots) and lifetime credits spent on refinements; refinements per kind (Hone, Augment, Sharpen, Forge: count, stables, credits, with the kind's effect); the attributes Hone and Augment target most (count and total magnitude); the top 5 spenders, each linking to the Players panel. What a refinement does to winning is on Weapons (linked). |
| Stable investments | Event entry | Robots entered in at least one event, average events per robot, robots per event (all nine, registry order, share of robots) and robots by number of events entered (0 to all nine). The Booking Office level sets how many events a robot may enter. |
| | Facilities | Stables owning each facility at level ≥ 1 and their average level (L), most owned first, with a bar relative to the most owned; two columns from 640 px. Tuning Bay and Booking Office ownership are read here (not repeated in their sections). |

All counts are robots (or stables, for Facilities and refinement stables) owned by users in the filter. With All or Generated, generated stables dominate and their choices are randomised, so near-even splits are expected; Players shows what people pick.

Dropped with the merge: subscribe/unsubscribe per cycle (it only moves at the start of a season) and the per-stable subscription table (each robot's events are in the Players panel).

**API:** `GET /api/admin/meta/choices?stables=` (stances, loadouts, yield, weapons, facilities; replaced `GET /api/admin/stats`, which also counted every battle of the season, 4.1 s on ACC, for figures no page showed) and `GET /api/admin/meta/builds?stables=` (tuning, refinements, event entry), both in `services/admin/meta/`, both `authenticateToken` + `requireAdmin`, read by their own filter-scoped loaders (`hooks/useMetaOverview.ts`): a filter change aborts the previous request, so a late response for another filter is never shown, and one failing request leaves the other sections in place. Removed: `GET /api/admin/tuning/adoption`, `GET /api/admin/refinement/adoption`, `GET /api/subscriptions/admin/analytics`.

### Cycle Controls (`/admin/cycles`)

Answers three questions: what is running right now and for how long, did every slot run, and what happened around a deploy. All times are UTC. The page polls every 10 s while a job is queued or running and every 60 s otherwise.

Sections, top to bottom:

1. **Status strip** — Season and cycle (phase, season day); Scheduler (Active / Disabled, and since when this backend runs, with `DEPLOY_TAG` when set); **Running now** (job, start, elapsed time); Queue (jobs waiting for the lock); Next (next slot and countdown, or "after the running job").
2. **Missed-run banner** — shown when a slot did not run in the last 7 days; "Show in history" filters the history to problems.
3. **Daily schedule** — the ten slots in time order. Per slot: last run (day, time, trigger), status, duration (`3s`, `4m 12s`, `1h 50m`), one-line result ("669 battles", "Round 3/12 · 512 matches", "Cycle 81 closed") and **Run**. A queued or running slot shows Queued / Running instead of the button. Below 768 px the table becomes a list.
4. **Run history** — runs, **Backend restarted** markers and **Missed** runs, newest first. Filters: job (including Bulk cycles), Problems only (failed, interrupted, missed, restarts), last 24 h / 7 / 14 / 30 days. 25 entries per page.
5. **Testing tools** (collapsed) — the bulk cycle runner: cycles (1–100) and options (stable generation **off** by default, tournaments, KotH, finances), an estimate from the last run of every slot on this environment, and the state of an active bulk run.

**Run buttons.** Each opens a confirmation describing the job (settlement and bulk runs get the red confirm). Confirming starts the job **in the background**: the server answers at once and the job waits for the scheduler lock, then runs exactly like its cron run (repair, preparation gate, notifications). A slot can take 20 minutes on a full environment; the proxy cuts responses at 30 s, which is why runs no longer wait for the result. Starting a job that is already queued or running answers 409 ("already queued or running"). Jobs can be run by hand with `SCHEDULER_ENABLED=false` too (local, CI); only automated scheduling is off then.

**Definitions**

| Term | Definition |
|---|---|
| Run | One row of `scheduler_job_runs`: job, trigger (`cron`, `manual`, `resume` for a settlement resumed at startup, `bulk`), who started it, status, queued / started / finished, duration, result summary or error. Written for every run, never failing the job. A bulk run counts only cycles that ran through as completed; if any cycle threw, the run is Failed and its error lists the failed cycles. |
| Queued / Running | Waiting for the scheduler lock / holding it. |
| Skipped | A battle job that returned at once because the season is in its Preparation_Phase. |
| Interrupted | The backend stopped (usually a deploy) before the run finished. Marked at the next start; it ends at the stopped process's last heartbeat. |
| Backend restarted | A `scheduler_processes` row: one per backend start, with a 60 s heartbeat. "Down X–Y" is the previous process's last heartbeat to this start. |
| Missed | A daily slot with no cron or resumed run queued between 1 min before and 15 min after it, while the scheduler was enabled. A later manual run is its own row and does not hide the miss. Slots before history tracking started, while the scheduler was disabled, or less than 15 min ago are never missed. A miss inside a restart gap shows that downtime. |

Season rollovers are runs too (job **Season rollover**, `seasonRollover`): trigger `manual` from Season Control, `cron` when the settlement rolls the season over. They appear in Run history and in the job filter.

**API:** `GET /api/admin/scheduler/overview`, `GET /api/admin/scheduler/runs?jobName&problemsOnly&days(1–30)&page&limit`, `GET /api/admin/scheduler/runs/:id`, `POST /api/admin/scheduler/runs` `{ jobName }` → 202 `{ run }` (400 unknown job, 409 already active), `POST /api/admin/cycles/bulk` with `background: true` → 202 `{ run }` (without it the call waits and returns the full result, as before; 409 while a bulk run is active). Removed because nothing called them: `POST /api/admin/scheduler/trigger/:jobName` (part 8; `POST /scheduler/runs` replaces it) and `GET /api/admin/scheduler/status` (in-memory state; the overview and run history replace it). All require `authenticateToken` + `requireAdmin`; manual and bulk starts write an `admin_audit_logs` row.

### Season Control (`/admin/seasons`)

Answers: where is the season, when does it roll over, what would a rollover do, and how did earlier rollovers go. All times are UTC. The page polls every 5 s while a rollover is queued or running and every 60 s otherwise.

Sections, top to bottom:

1. **Season timeline** — season number and phase; cycle (or preparation day) of the length with a progress bar; estimated dates; the configuration (season length, marked "extended" after an Extend, preparation length, countdown, accolade depth, images kept per stable). Competitive: player countdown start, rollover, next season's competitive start. Preparation: competitive start, rollover, balance-change window. Season 0 explains that only a manual rollover closes it.
2. **Season rollover** — what it does, **Preview rollover** (on demand) and **Roll over Season N…**. The preview splits stables by type: human players and Automatons (archived, then reset) and generated stables (deleted; results stay in the archive), lists the **dormant human stables** it deletes (no login since the season started; archived first, never admins, with the first 50 names), lists retained images, and groups the rows it empties into Battles and summaries / Ledger, audit and snapshots / Standings, tournaments and other, each expanding to per-table counts. While a rollover is queued or running (either trigger) the card shows who or what started it, the elapsed time and the five stages live: Archive, Verify, Purge and reset (with a generated-stables bar), Clean up, Automaton turns.
3. **Rollover history** — every completed season (dates, cycles, stables archived, generated count) with the rollover that closed it: when, Admin · name or Settlement, duration, what it archived, deleted and emptied, and Details (stage durations). Failed and interrupted attempts fold under the season they tried to close, with the stage they stopped at. Failed attempts on the current season come first.
4. **Testing tools** (collapsed) — Extend the season (1–365 cycles; shows "100 → 105 cycles · rollover moves to ~15 Nov" before confirming) and Remaining preparation cycles (0 to the configured preparation length, only during a preparation phase).

**Roll over.** The dialog repeats the preview's counts and needs the phrase `CONFIRM_ROLLOVER` typed. It is bound to the season it was opened for, and that season number is sent for you: if the page's polling finds that season closed (or a rollover started) while the dialog is open, the confirm button is disabled until you reopen it. Confirming starts the rollover **in the background** under the scheduler lock (scheduled jobs wait for it), because a rollover on a full environment can outlast the proxy's 30 s response timeout. A queued rollover that finds the season changed while it waited (a settlement rolled it over) stops without changing anything. A second start while one is queued or running answers 409. When a rollover the page watched ends, a message gives the outcome.

**Definitions**

| Term | Definition |
|---|---|
| Estimated date | Counted from the scheduler's next settlement at one cycle per day: rollover = next settlement + (remaining − 1) days, next competitive start = rollover + preparation length. No dates when automated scheduling is off. |
| Rollover run | A `scheduler_job_runs` row of job `seasonRollover` with the stage progress and result in its summary. |
| Legacy rollover | A rollover from before runs were recorded, read from its `admin_audit_logs` `season_rollover` row (audit rows newer than the first run are not read again). |

**API:** see [Season Management](#season-management-spec-45) below.

### Players (`/admin/players`)

Answers: who plays, who dropped off, and who needs help. Human stables only in the list; any stable in the search.

1. **Find any stable**: a player, Automaton or generated stable by `#id`, username, email, stable name or robot name (one query, at most 10 results, each tagged Player / Automaton / Generated). A result opens the detail panel.
2. **Segment cards**: Active (last activity within 3 days), Inactive (older, but this season) and Dormant (no activity since the current season started; the rollover deletes these) add up to every human stable; Stuck in onboarding and Low balance (below ₡10,000, the dashboard's bankruptcy threshold) are issue filters. Activity is the last login, or the registration for an account that never logged in; registration sets the first login. A card filters the list (`?segment=`), pressing it again clears it. The dashboard's bankruptcy item links to `?segment=low-balance`; the old `?tab=at-risk` link opens the same.
3. **Human stables**: stable, robots, battles this season (each battle once per stable: summed robot counters minus the shared-side overlap), win %, balance, last login, joined and issues (Stuck in onboarding, No robots, No weapons equipped, No battle-ready robots, No battles yet, Low balance). Search this list (`?q=`), sortable headers (`?sort=key:dir`, default last login, newest first), 25 per page (`?page=`). Below 768 px the rows are cards.

**Detail panel** (`?user=<id>`, also from Search Analytics, Practice Arena and Tournaments; the same content wherever it opens): stable type and segment, balance, last login, onboarding, battles this season with win %; **Balance, last 10 cycles** from the financial ledger (balance after each cycle, with the low-balance line, and what it earned, paid in running costs and bought); issues; robots (link to `/robots/:id`, ELO, HP, weapons, loadout, stance, W/L/D, 1v1 League / King of the Hill / Grand Melee tier from `standings`, subscriptions); teams with their 2v2 / 3v3 / Tag Team tiers; facilities; links to the stable's battles, its stable page and, for an Automaton, its Editor. **Password reset** shows for player accounts only (signs the player out everywhere and is logged); the server refuses generated stables (`PASSWORD_RESET_NOT_ALLOWED`) and Automatons (`AUTOMATON_ACCOUNT_LOCKED`).

**API:** `GET /api/admin/players`, `GET /api/admin/users/search?q=...`, `GET /api/admin/users/:id`, `POST /api/admin/users/:id/reset-password`.

### Automatons (`/admin/automatons`, Spec #55)

Manages Automaton_Stables on any environment. Title "Automaton Stables"; NAV entry "Automatons" under Player Management. Operator procedures (activation, Turn_Step knobs, incidents, export and strategy workflow) are in [AUTOMATON_OPERATIONS_GUIDE.md](AUTOMATON_OPERATIONS_GUIDE.md); product rules in [PRD_AUTOMATON_STABLES.md](../game-systems/PRD_AUTOMATON_STABLES.md).

**Status_Bar** (above every section): Program_Switch with confirmation, last Turn_Step (`Cycle {n}` / `Prep {n}` / `Season start`, time, stables processed, duration), failed-last-cycle count and Needs attention count with one chip per reason (Balance negative, Last cycle failed, Nothing bought 14+ cycles; a stable can have several). The counts and chips open the Stables section filtered on Needs attention, a chip on that reason (`?reason=`, shown as a removable "Reason: ..." chip).

**Sections** (`TabLayout`: tabs at ≥ 1024 px, stacked sections below; the active tab is kept in `?tab=`):

- **Stables** — list with status, strategy, robots, credits, prestige, highest tier, last cycle and Needs attention reason. Filter chips All · Active · Draft · Needs attention (`?filter=`); the selected chip shows a check mark. Toolbar: a **Strategy** dropdown (`?strategy=`; also shown as a removable "Strategy: {name}" chip), **Search stables** over stable name, catalogue key and franchise (`?q=`), and **Sort by** (Catalogue order, Stable name, Strategy, Robots, Credits, Prestige, Highest tier, Last cycle) with an Ascending/Descending button (`?sort=key:dir`, e.g. `sort=credits:desc`). From 768 px the column headers sort too; below that the Sort by control is the only sort. Empty values (drafts, never played, no turn) always sort last. Sorting by Highest tier compares the tier only: stables with the same tier in different modes (e.g. "Gold · Grand Melee" and "Gold · 1v1 League") are a tie and stay in catalogue key order (A→Z) in both directions. Chip counts follow the strategy and search, a status line shows "{n} of {m} stables", and **Clear filters** removes status, strategy and search (the sort stays). **Highest tier (any mode)** is the highest league tier one of the stable's robots or teams holds right now (not its peak), with its mode, e.g. "Gold · 3v3 League"; only modes the stable has actually played count, and "—" means never played. **Activate all drafts** with confirmation (prefer activating in batches; see the operations guide).
- **Strategies** — the **Strategy_Comparison** for the current season (stables, robots average/target, prestige, **highest current tier** with the number of stables at it, credits; a human reference row when humans own robots). The win rate against human stables was dropped: with few human stables its sample was tiny, and Performance by mode covers every opponent. Below it, **Performance by mode**: pick one of the six tiered modes (1v1 League, 2v2 League, 3v3 League, Tag Team, King of the Hill, Grand Melee; default 1v1 League); the selected mode shows a check mark. Head-to-head modes show Stables played ("{played} / {stables}"), Robots or Teams played, W–L–D, Win % and Battles (n); King of the Hill and Grand Melee show Stables played, Robots played, Matches (n), 1st places, 1st-place rate and Best placement, because those modes record no losses. A row with fewer than 5 stables or fewer than 20 battles/matches gets a **Low sample** pill. The numbers include Automaton-vs-Automaton battles and mirror matches between stables of the same strategy (which pull the win % toward 50%), and byes count as wins. **Economy** (`?view=economy`): per strategy the stables in deficit (balance below ₡0, count and share), median balance, earned and running costs (repairs + operating costs) per stable per cycle over the last 7 closed cycles, divided by the cycles each stable has ledger rows in, and the Goal most stables' latest completed turn ended saving on. Chips per activation day compare a later batch with the first. Red: 30% or more in deficit, or running costs above earnings. Then the **Strategy_Library** (strategies, versions, stables per version, **Upgrade** with dry run and confirmation, **New version**, **New strategy**) and the **Strategy_Builder** (numbered Goal list with move up/down, defaults and bounds, inline rule errors, draft preview on a stable and on a fresh stable, **Save draft**, **Export strategy file**).
- **Editor** — searchable stable picker (type a name, catalogue key or franchise; ArrowUp/ArrowDown, Enter, Escape), **New stable**, **Delete draft stable** (drafts only), **Export**, **Save changes**. Cards: Stable (name, franchise, backstory, strategy, Event_Order with move buttons), Teams (Team_Rule teams with names and Formed / Waits for robot {n}), Build order (numbered Goals with editable targets and Turn_Preview statuses, **Preview next cycle**, per-robot attribute plan), blueprints (`BlueprintEditor`: loadout, stance, yield, Build_Focus, Weapon_Path per hand, Refinement_Plan, **Upload image**, **Add blueprint**, **Delete blueprint**), **Cashflow · last 10 cycles** (earned, running costs and purchases per cycle from the ledger, with the balance it ended on), Cycle history (Turn_Records), **Activate** with confirmation.
- **Catalogue** — last Catalogue_Sync summary (added, present, images filled, conflicts), **Export this stable** (searchable picker) / **Export all**.

There are no controls to run a turn, delete an active stable, change a balance or edit live robots, teams, subscriptions or weapons. Every mutation is written to the admin audit log as `automaton.*`.

**API:** `/api/admin/automatons` — `GET /status`, `GET /strategies`, `GET /strategies/comparison`, `GET /strategies/economy?activated=YYYY-MM-DD`, `POST /strategies/:key/upgrade`, `GET|POST /strategy-drafts`, `GET|PUT|DELETE /strategy-drafts/:id`, `POST /strategy-drafts/:id/preview`, `GET /strategy-drafts/:id/export`, `GET|PUT /program`, `GET /export`, `GET /catalogue/sync-status`, `POST /activate-drafts`, `GET|POST /`, `GET|PATCH|DELETE /:key`, `PUT /:key/strategy`, `POST /:key/blueprints`, `PATCH|DELETE /:key/blueprints/:slot`, `POST /:key/blueprints/:slot/image`, `POST /:key/activate`, `GET /:key/preview`, `GET /:key/cashflow`, `GET /:key/turns`. The list (`GET /`) serves up to 1,000 profiles per request, so the page loads every stable at once. Error codes: [ERROR_CODES.md](ERROR_CODES.md) "Automaton Errors".

### Economy (`/admin/economy`)

Answers: where credits come from, where they go, and where they pile up. Toolbar: **Stables** Players (default) / Automatons / Generated / All (`?stables=`) and **Window** 7 (default) / 14 / 30 closed cycles or the season (`?window=`); the cycle in progress is left out. A scope line names both.

- **KPIs**: earned, spent and net in the window (with per-cycle averages: total ÷ cycles), repairs as a share of battle income, and what the stables hold now with the median balance.
- **Where credits come from / go**: `financial_ledger` by transaction type: battle income (all modes, participation pay included), streaming, merchandising, achievements, weapon sales; attribute upgrades, facility upgrades, repairs, weapon refinement, operating costs, weapons + robots. Legacy types show as Other.
- **Repairs** (replaced the Repair Log): repairs, paid (and per repair), saved by discounts and, when the scope has players, how many player stables that repaired used Manual Repair. A table splits automatic / manual / total into full price, Repair Bay discount, Manual Repair discount (50%), paid and per repair; beside it every stable type in the same window: repairs, paid, Repair Bay share of the full price ("Bay off") and the share of repairs done by hand. From `financial_ledger` `repair_cost` rows: full price is `metadata.baseQuote`, after the Repair Bay `metadata.quoteBeforeManualDiscount`, paid the amount; rows without a breakdown count at what was paid. One stable's repairs belong in its Players panel, so there is no per-stable list.
- **Per cycle**: earned vs spent for at least the last 15 closed cycles.
- **Balances**: stables per balance band now (below ₡0 up to ₡10M+).
- **All stable types**: count, earned, spent, net and held for players, Automatons and generated stables side by side in the same window.

Players, Automatons and Generated follow the portal's [stable-type filter](#stable-type-filter). The ledger holds the current season only. Facility adoption is on Meta, low balances on Players. Cached 60 s; Refresh bypasses the cache.

Each closed ledger cycle is summed once into `economy_cycle_rollups` (one cycle takes 1–2 s on ACC; the whole season took 36–42 s and hit the 30 s statement timeout); the newest closed cycle is summed on every load. After a deploy the missing cycles are summed in the background, newest first (about 2 s each, ~3 min for a full season on ACC). Until the cycles a view needs (its window and the 15-cycle chart) are ready, the page shows "Preparing the economy figures" with progress and asks again every 5 s; the 7-cycle view is ready after about 30 s. A closed cycle's stored totals never change; if ledger rows of a closed cycle are ever edited by hand, delete the table's rows to have them summed again.

**API:** `GET /api/admin/economy?stables=players|automatons|generated|all&window=7|14|30|season&fresh=true` → `{ status: 'ready', … }`, or `{ status: 'preparing', scope, cyclesReady, cyclesNeeded, timestamp }` while cycles are summed.

### Battles (`/admin/battles`)

A lookup tool for any battle this season, across all stables, plus an admin check of one battle. Any battle also opens in the player report (`/battle/:id`); this page adds what players can't see and doesn't repeat the report.

**List.** Filters (all kept in the URL, together with the open battle `?battle=`, so a view can be linked):
- **Stables:** All / Players / Generated / Automatons. Matches battles with at least one robot whose stable has that `users.stable_type`. Every side shows the same tag.
- **Mode:** the 9 battle types, grouped League (1v1, 2v2, 3v3, Tag Team), Tournament (1v1, 2v2, 3v3), Multi-robot (KotH, Grand Melee).
- **Date range:** last 24 h, last 7 days (default; the combat-log window), last 30 days, this season.
- **Search:** robot name, stable name or username, or `#id` / `id` (an id search ignores the date range).
- **Outcome:** Draws, Byes, Forfeits, Time limit. Byes and forfeits are never counted as draws or time limits.

A row shows mode and tier (or tournament and round, or field size), the sides with their stable (team modes show the team name; KotH and Grand Melee show the winner and "+ N others" by stable type), the result (Win / Draw / Bye / Forfeit), how it ended (Destroyed, Yield, Team eliminated, Time limit, Score reached, Last standing), the largest ELO change, the length and the UTC time. The scope line above the table states the count and every active filter.

**Outcome rule.** Team modes store the winning *team* id in `battles.winner_id`, so the side comes from `winning_side` first, then from the winner robot's team; neither is a draw. Byes come from `is_bye_match` on the schedule or bracket row; forfeits follow `classifyForfeit` (match history service). "Time limit" means the battle lasted its limit: 120 s (1v1, tournament 1v1, Grand Melee), 300 s (team modes, Tag Team), KotH the scheduled match's `time_limit` or 150 s by default. Tag Team runs each phase with its own 120 s limit and a timed-out phase ends the battle in a draw before 300 s, so a tag-team draw with a robot still standing also counts as a time limit (the engine declares tag-team draws only on a timeout, when every robot is out, or on exactly equal HP). The Time limit filter applies the same rule. "Score reached" is a KotH winner at the score threshold (from `battle_summaries`). A KotH / Grand Melee winner whose robot was deleted shows as Unknown; the runner-up is never promoted. Only permanent data is used, never `battle_log`.

**Admin check (slide-over).**
- **Copy for analysis:** the whole battle as text: context, the robots' setup at battle start (from the battle-start event), results per robot, payouts against the ledger with the battle-income formula inputs, and every stored event in time order (movement included), with each hit's stored calculation text verbatim. Meant for pasting into an analysis chat or checking calculations by hand.
- **Download JSON:** the complete record (detail, ledger entries, summary, full stored log).
- **Open player report ↗.**
- **Result and context:** cycle (from the ledger entries), league instance or tournament and round, scheduled or bracket match id, and when the combat log is removed.
- **Participants:** grouped by side (by placement for KotH / Grand Melee): end HP against the battle-time max HP (from the battle-time build record; only the end HP for battles fought before recording started, since the robot row holds today's max HP), damage, ELO (or zone score and kills), credits, streaming, prestige, fame, and the battle time at which each robot was destroyed, yielded or tagged out (`perRobot.exitTime`; a tag-team reserve's active time is shown separately in the export).
- **Payout check:** per stable, the credits on the participants against the `battle_income` and `streaming_revenue` ledger entries that reference the battle (Match / Mismatch with the gap / Missing). "Show formula" gives the floor and win components; for KotH and Grand Melee (`battle.placement_income`) it lists each robot's award instead: tier base × mode multiplier × placement multiplier (× zone dominance, or the participation floor) = credits. Prestige and fame aren't in the ledger.
- **Combat log:** loaded separately; chips for All / Combat / Movement / Critical hits / Misses / Destroyed and a robot filter; 200 events at a time; "Formula" opens a hit's calculation and components. The log is removed after `BATTLE_LOG_RETENTION_DAYS` (7) by the 01:30 UTC retention job; older battles keep everything else.

KotH and Grand Melee logs store every event with its formula breakdown from this release, like the other modes (`KOTH_LOG_STORAGE` in `kothEventConverter.ts`). That measured ×4–5 the size of the old log (≈ +5.5 GB for the 7-day window on ACC); if disk runs short, `sampled: true` thins movement, range and shield-regen events again (≈ +0.9 GB). Logs from before the change have no formulas and thinned movement, and the panel and export say so.

**API:** `GET /api/admin/battles` (`page`, `limit` ≤ 100, `mode`, `stable`, `outcome`, `range`, `q`), `GET /api/admin/battles/:id`, `GET /api/admin/battles/:id/log`, `GET /api/admin/battles/:id/export?format=text|json`. Admin-only, read-only. Unknown filter values are rejected with 400; a missing battle is 404 `BATTLE_NOT_FOUND`.

### League Health (`/admin/league-health`)

Is every tiered league working: does promotion and demotion actually move, and can each tier be played? Covers all six tiered modes: 1v1, 2v2, 3v3, Tag Team, King of the Hill and Grand Melee. Read-only.

**Sections**
1. **Needs attention**: one line per problem, linking to the tier. Identical problems in the same tier are grouped across modes ("Champion can't open in 2v2, 3v3 and Tag Team"); few demotions and unsubscribed rows are one notice each. The badge counts blocked and warning items, not notices.
2. **All leagues**: a mode × tier grid with the active count (and the total when some rows are unsubscribed) and the status. A cell opens that mode and tier below. Below 768 px each mode is one strip of short counts; tapping it selects the mode.
3. **League detail** of one mode (`?mode=`, default 1v1): the rules line, then one row per tier (cards below 768 px): active / total, instances (count · size range), stable mix (human / Automaton / generated, by `users.stable_type`), average ELO, eligible (enough cycles in tier), promotion and demotion, status. `?tier=` expands a tier's instances: size, humans, top LP, the LP at the promotion and demotion lines with their rank, who qualifies now, and a link to the player standings of that instance (`/league-standings?mode=&tier=&instance=`).
4. **This season** of the selected mode, by stable type (`?stables=`: All / Players / Automatons / Generated, by `users.stable_type`; default All). Replaces the former League History page (`/admin/league-history` redirects here):
   - **Per-cycle trend**: promotions up, demotions down, on one scale. A cycle in which the mode recorded no moves at all gets a dashed amber marker and is listed with a link to Cycle Controls' run history (on ACC: KotH cycle 86, interrupted by a deploy restart). Quiet cycles are judged over all stables, so a stable filter shows zeros, not markers.
   - **Season so far**: total promotions and demotions with their ratio, and the last cycle.
   - **Tier boundaries**: per boundary (Bronze ↔ Silver … Diamond ↔ Champion) promoted, demoted and **back within 10 cycles**: of the promotions at least 10 cycles old, the share demoted back across the same boundary within 10 cycles. Noted (amber, "About 1 in 4 promoted robots is back within 10 cycles") above 20% with at least 20 judged promotions; "not judged yet" when every promotion is too recent. KotH and Grand Melee hardly demote, so their bounce-back stays low; that is not better-judged promotion. This is a balance signal, not an attention item.

**Two kinds of numbers**
- **Structure (now)**: places, zones and who qualifies come from the rebalancer's own planner (`league-rebalancing-planner.ts`) on the current standings. Each league rebalances right after its event's battles, so a snapshot taken after a rebalance always shows almost nobody qualifying. "Qualify now" is therefore shown only in the instance view, labelled as a snapshot.
- **Flow (history)**: promotion and demotion cells read "moved in the last rebalance of the places · average", from the mode's last 5 rebalances in `league_history`. A rebalance is observed as a cycle with at least one row for that mode (every rebalance of a populated mode moves someone); KotH can skip a cycle, so its window can span 6 cycles. `league_history` is emptied at season rollover; until a mode has 5 rebalances, flow is "not judged yet".

**Status** (first match wins; thresholds in `services/admin/adminThresholds.ts`)
| Status | Rule |
|---|---|
| Empty | no standings rows |
| Promotion blocked | the tier above is empty and this tier has fewer promotion places than the 3 an empty tier needs to open, so it never can |
| Frozen | every instance is below the 10 entities an instance needs for zones |
| No promotions | the tier has promotion places, but nobody was promoted in the last 5 rebalances |
| Low promotion | on average fewer than a quarter of the promotion places were filled |
| OK | otherwise; notices: "N% unsubscribed" at ≥ 5% of the tier's rows, "few demotions" when fewer than a quarter of the demotion places are filled on average |

**Definitions**
- **Active**: a robot with an active subscription to the event; a team when every member is subscribed. Standings rows survive an unsubscribe, keep their instance seat and count toward the 10% zone sizes.
- **ELO**: current robot ELO; team modes show the combined team ELO (sum of the members), as the league pages do.
- **Places**: floor(10%) of each instance with at least 10 entities; zones are fixed places, so a place that doesn't qualify (LP or cycles in tier) stays empty and nobody below moves up into it.

**API:** `GET /api/admin/league-health` (admin-only, no parameters): `{ generatedAt, season, thresholds, modes[], attention[] }`, built by `services/admin/league-health/`. `GET /api/admin/league-health/season?mode=&stable=` (mode one of the six tiered modes, default `league_1v1`; stable `all|human|automaton|generated`, default `all`; anything else is 400): `{ mode, stable, window, noteShare, minSample, firstCycle, lastCycle, judgedThroughCycle, cycles[], quietCycles[], totals, boundaries[] }` from `league_history` (~20–45 ms on ACC). Removed with this redesign (this page and the former League History page were their only callers): `GET /api/admin/team-battle-league-health`, `GET /api/admin/tag-team-league-health`, and `GET /api/admin/league-history`, `/league-history/aggregates`, `/league-history/entity/:entityType/:entityId`, `/league-history/yo-yo`. Player-facing league history (robot and team pages) is unchanged. On ACC (Oct 2026) the standings query takes ~0.4 s for 19k rows and the history query ~70 ms.

### Tournaments (`/admin/tournaments`)

Are the three tournaments (1v1, 2v2, 3v3) on schedule, when do they finish, and who wins them this season? Read-only. One tournament per type runs at a time, one round per daily cycle (jobs at 10:00 / 15:00 / 18:00 UTC by default); the table is emptied at season rollover.

**Sections**
1. **Now** — one card per type: name, "Round 11 of 12 · Semi-finals" with a segmented round bar, participants, start and expected finish (next run of the type's job plus one day per remaining round), the current round's matches done of total and its job time, and first-round byes (the bracket fills up to the next power of two). Links: **Bracket** (player page `/tournaments/:id`) and **Tournament battles** (Battles filtered to the mode, last 30 days). Without a running tournament the card says the job creates the next one once enough entrants are subscribed.
2. **This season** — one panel per type: completed, average length in days (= rounds), champions who are players, participants per tournament (oldest first, the running one highlighted), champion stables with their titles, and the last five champions (tournament linked to its bracket, stable to the admin player detail). A deleted champion reads "Deleted".
3. **Balance note** — when one stable holds more than half of a type's titles (with at least 3 completed tournaments), e.g. "Hit Machine won 7 of 8 1v1 and 10 of 12 2v2 tournaments this season". A note, not an action item.

**Status of a running tournament**
| Status | Rule |
|---|---|
| On schedule | a match finished within the last 26 hours (or the tournament started then) and no match of an earlier round is still pending or scheduled |
| Not advancing | no progress for more than 26 hours (same margin as settlement) — check the run history in Cycle Controls |
| Matches left behind | matches of an earlier round never finished |
| Paused | the season is in its preparation phase; no rounds run |

**API:** `GET /api/admin/tournaments/overview` (admin-only, no parameters): `{ generatedAt, seasonPhase, thresholds, types[] }`, built by `services/admin/tournaments/` (two small queries, ~20–30 ms on ACC). Removed with this redesign (the old page was their only caller; rounds and auto-creation run from the scheduler): `GET /api/admin/tournaments`, `/:id`, `/history`, `/eligible-robots`, `POST /api/admin/tournaments/create`, `/:id/execute-round`.

### Weapons (`/admin/weapons`)

What winning robots fight with, and what that implies: usage shows the meta, effects show whether it pays. Same data, comparisons and engine as [Attributes](#attributes-adminattributes) (battle-time builds, seven days of records before anything is shown). Replaces the old ownership page (owned counts were mostly generated stables' free starter weapons; Meta keeps the owned / equipped totals).

**Controls** (kept in the URL: `?range=&column=&strength=&matchups=`):
- **Battles from:** last 7 days (default), 14 days, 30 days, this season.
- **Mode:** All modes / 1v1 / Team / Free-for-all (KotH and Grand Melee: every robot for itself, by placement). Picks the column every block shows; no new request.
- **Strength:** All robots (default) / Top 10%. Top 10% keeps only fights where every robot is in the top 10% of points invested in its mode and window, so the analysis is not dominated by low-investment generated stables. The page states the cut per mode.

**Equally strong.** Every effect is against an opponent with the same points invested (base + tuning over the 23 attributes) and the same stance (offensive / defensive share of the side). Weapon bonuses, refinements and the loadout multiplier are deliberately not in that control: they come with the choice, so a weapon gets the credit for its own bonuses. Which attributes win is the Attributes page's question.

**Blocks** (all for the selected mode):
- **Archetypes: range × loadout.** Main weapon range band (melee, short, mid, long) × loadout (single, weapon + shield, two-handed, dual wield). Effect = change in win chance (pp at even odds) against an equally strong average robot (usage-weighted), coloured when at least twice its standard error. Each cell also shows the share of all robots and of players' robots that fought with it.
- **Matchups.** Row's win % against the column at equal strength, from single-robot comparisons (1v1 and Free-for-all pairs; team modes have none). Views: Range bands (default), Loadouts, Top archetypes (the six most used in the mode). Antisymmetric by construction (A vs B + B vs A = 100%).
- **Usage by league tier.** Share of robots per tier (Bronze … Champion; KotH tiers come from the scheduled match because KotH battle rows store `league_type = 'koth'`), tournaments as their own row. Segments: the five archetypes with the highest share in any tier with at least 20 robots, the rest as Other. From 30% concentration the page notes that many fights there are mirror matches, so the archetype's own win rate in that tier says little; its edge shows in the grid and matchups.
- **Weapons.** Every catalogue weapon, carried in either slot (a shield is its own row; the same weapon twice counts once): range band, hands, price, share of robots and of players' robots, raw win rate (comparisons where only one side had it; context only, it follows price), and the effect against the average robot with ± 1 SE. Collapsed: the strongest and weakest six; "Show all".
- **Price vs effect.** One dot per weapon with an estimate; top left = cheap and strong, bottom right = pricey and weak. The two strongest and weakest are labelled.
- **Refinements and coverage.** Share of robots with any refinement and per tier (Hone, Augment, Sharpen, Forge); the effect of having refined weapons once 100 comparisons differ. Catalogue weapons fought with (all / players' robots) and the list of weapons no player owns right now.

**Method.** Logistic models without intercept on the paired comparisons (as Attributes), cluster-robust standard errors by battle, ridge on the choice features only:
- weapons: Δ log points invested, Δ offensive / defensive share, Δ share of robots with refined weapons, and per weapon the Δ share of the side's robots carrying it;
- archetypes: the same controls and per archetype the Δ share of the side;
- matchups: the same controls and one ±1 feature per pair of categories, on comparisons whose robots differ in category.

A mode needs 300 comparisons for effects; a weapon, archetype or matchup cell needs 100 comparisons where it differs between the sides, else "too few". Effects are associations: robots that pick a weapon often share other choices.

**API:** `GET /api/admin/analysis/weapons?range=7d|14d|30d|season&strength=all|top10` (admin-only, read-only). Answers the collecting state like Attributes, or `{ status: 'ready', window, strength, columns, weapons, archetypes, matchups, tiers, refinements, coverage, notOwnedByPlayers, … }` per mode column. Cached per window and strength until a new build is recorded (at most 10 minutes); shares the loaded window with Attributes. Removed with this redesign (the old page was its only caller): `GET /api/admin/weapons/analytics`.

### Security (`/admin/security`)

Answers "is anyone abusing or attacking the game, and who?". The window picker (Last 24 hours / 7 days / 30 days, default 7 days, `?window=24h|7d|30d`) drives every section:

- **Status line**: which signal types fired in the window, or "No signals" in green. There are no severity levels; a signal fired or it did not.
- **Signal cards**: failed logins (wrong password, unknown name, or an Automaton name), rate-limit hits (any limiter, per player or by IP before login), ownership violations (another stable's robot, weapon or facility, or a non-admin on an admin endpoint), race-condition bursts (the 11th 409 conflict of one player within a minute), robot-creation bursts (the 4th robot within 10 minutes) and NSFW blocks (from the audit log, linking to Image Uploads). Each card has a per-bucket sparkline and the last time it fired.
- **Signals per hour/day**: stacked by type, UTC.
- **Stables with signals**: the stable, chips per signal and last seen. Failed logins count attempts on that account. The name opens the stable's detail panel on Players.
- **Without an account**: per source IP, failed logins, existing accounts tried, malformed requests (schema validation failures without a logged-in user), rate-limit hits, endpoints and last seen. A **burst** is 5 or more failed logins from one IP within 15 minutes (the login limiter's window).

Signals are stored in `security_events` (90 days, nightly retention at 01:50 UTC) and survive deploys. Not recorded: admin page views, purchases (the old rapid-spending alert flagged normal shopping and was removed), and a logged-in player's malformed requests (usually UI bugs; they go to the security log only). The submitted login name and password are never stored. No Discord alerts. The dashboard's security item counts failed-login bursts, ownership violations and race-condition or robot-creation bursts of the last 24 hours and links to `?window=24h`.

**API:** `GET /api/admin/security/overview?window=24h|7d|30d`. Removed with this redesign: `GET /api/admin/security/events`, `GET /api/admin/security/summary` (they read an in-memory buffer that every deploy wiped and that was mostly the admin's own page views).

### Achievements (`/admin/achievements`)

Answers "which achievements are too easy or too hard?" for this season. Unlocks are season-scoped: the rollover deletes every `user_achievements` row and re-awards the few whose condition reads preserved state (those show as "before start").

- **Stable type** — Players (default), Automatons, Generated (`?stables=`). Player rates are out of the **active players**: human stables that logged in since the season started (not dormant, the rollover's dormant rule). Automatons and generated stables never log in, so every stable of the type counts.
- **Headline numbers** — achievements in the catalogue (incl. secret), unlocked by someone, never unlocked, and unlocks (per active player).
- **Unlock rate per achievement, by tier** — one dot per achievement on a 0–100% axis, a bar at the tier median; a screen-reader table gives count, median, lowest and highest rate per tier.
- **Easier than its tier says** (hard or very hard, unlocked by 80%+) and **Harder than its tier says** (easy or medium, 25% or fewer), up to 6 each. Notes for next season's balance, not alerts.
- **All achievements** — category filter and sortable columns: achievement, category, tier, unlocked (with rate), median day (day 1 = season start; "before start" for preparation and rollover re-awards) and, for players, All accounts (dormant players included).

**API:** `GET /api/admin/achievements/analytics?stables=players|automatons|generated` (`services/admin/achievements/`).

### Search Analytics (`/admin/search-analytics`)

What players search for in the universal search, what they don't find, and whether a search led anywhere. Active season only (events are purged at Season_Rollover). Under **Content** in the navigation.

Sections, top to bottom:

1. **Toolbar** — period: This cycle / Last 7 cycles (default) / Whole season / Custom… (from–to range, validated), the resolved "Season N · cycles a–b", "Last updated" and Refresh.
2. **Counting banner** — how many requests were typing in progress, with a Settled / All requests switch.
3. **Cards** — Settled searches (trend vs the previous same-length window), Unique searchers (says how many are admin accounts; they are included), No-result rate (a drop is green), Led to a result.
4. **Searches per cycle** — bars plus no-result-rate line; "View as table" shows the numbers.
5. **Results by category** — per category the share of searches that returned a result and the share where the player opened one.
6. **Phrases** — All phrases / No results tabs, a filter, Export CSV, and per phrase: searches, share, no-result rate, which categories returned results (R/S/G), mostly chosen category. Below 768 px a Volume / Quality toggle switches columns.
7. **Searchers** — collapsed; per-player search and no-result counts, each linking to `/admin/players?user=<id>`.

All filters live in the URL (`period`, `from`, `to`, `count`, `tab`, `q`, `page`). Controls keep 44 px touch targets (search contract).

**Definitions**

| Number | Definition |
|---|---|
| Settled search | A recorded search that the same player did not extend within 5 seconds (a strictly longer phrase starting with it). The palette sends a request after every typing pause, so "la", "laser", "laser c" before "laser cannon" are typing in progress. Corrections that are not prefixes and repeated phrases still count. |
| All requests | Every recorded search request. |
| No-result rate | Searches with no result in any category ÷ searches, one decimal. |
| Led to a result | Searches after which the player opened a result ÷ searches recorded since selection tracking started (category-only, see the search contract §8.4). "Not tracked yet" before then. |
| Returned (category) | Share of searches with at least one result in that category. |
| Chosen (category) | Share of tracked searches where the player opened a result of that category; the rest "opened nothing". |
| Previous period | The same number of cycles just before the selected range. None for Whole season or at the start of a season. |

**API:** `GET /api/admin/search-analytics/report`, `GET /api/admin/search-analytics/phrases`, `GET /api/admin/search-analytics/phrases/export` (CSV, ≤ 5,000 rows, formulas neutralised). All accept `mode=settled|all`, `lastCycles` or `cycleFrom`/`cycleTo`. Contract: `docs/implementation_notes/UNIVERSAL_SEARCH_CONTRACT.md` §8 and §10.

### Practice Arena (`/admin/practice-arena`)

Answers: who practises, how much, how they use the arena, and how often it turned players away. All times UTC; days are UTC days. Every request is recorded (`practice_arena_events`), so the numbers survive restarts and deploys; the table is emptied at season rollover. Refreshes every 60 s.

Sections, top to bottom:

1. **Status strip** — Battles today (requests, yesterday), Players today, This season (battles and players from each stable's practice counter), Refused today (rate limit · during a job), Unavailable yesterday.
2. **Last 30 days** — battles and refusals (bars) with players (line), and per day: battles, requests, players, rate limited, during a job, unavailable. Three days show; "Show all 30 days" opens the rest. Below 768 px the table becomes a list.
3. **Top practitioners this season** — the 10 stables with the most practice battles (their season counter) and their last recorded practice ("before {date}" when it predates recording). Names open the player in Players.
4. **How it is used** — last 30 days: opponent (own vs sparring, own vs own, sparring vs sparring, by battles), sparring partner tier (the opponent's, by battles), batch size (by requests) and the share of requests with what-if overrides.

**Definitions**

| Term | Definition |
|---|---|
| Battle / request | One `POST /api/practice-arena/battle` that ran: 1–10 battles. Recorded after the battles ran; a failed simulation is not counted. |
| Players | Distinct players with at least one battle that day. |
| Rate limited | Refused (429) by the limit of 30 battles per 15 minutes per player. |
| During a job | Refused (503 `CYCLE_IN_PROGRESS`) because a scheduler job held the lock. |
| Unavailable | Time scheduler jobs held the lock that day (the union of run intervals from Cycle Controls' run history), so practice was refused. "—" before run history existed. |
| "—" in a day row | Before recording started this season (the later of the switch to per-request recording and the season start): no data, not zero. |
| This season | Sum of `users.total_practice_battles` (reset at rollover), so it covers the whole season, including battles from before recording started. |

**API:** `GET /api/admin/practice-arena/overview` (`authenticateToken` + `requireAdmin`). `GET /api/admin/practice-arena/stats` (the pre-redesign shape) was removed: nothing called it.

### Admin actions (`/admin/actions`)

Answers "what did an admin change, and did it work?". Under **Security & Moderation**; replaced the Audit Log (`/admin/audit-log` redirects here).

- **Area chips** with counts over every recorded action: Cycles (manual job runs, bulk cycles), Season (rollover, extend, preparation cycles), Automatons, Moderation (image removal, storage clean-up), Players (password resets), Changelog (create, edit, publish, delete); Other only when an unknown operation exists. **All results / Failures**. Both and the page live in the URL (`?area=&result=failure&page=`).
- **Rows**, newest first, 50 per page: when (UTC), area, a plain title ("Rolled over season 0 → 1", "Rollover of season 0 failed"), one line of details, the admin's stable name, OK / Failed. Background job and bulk starts are recorded when queued, so they read "Started …" (OK means it was queued; the outcome is in Cycle Controls' Run history). "Activate all drafts" with rejections reads "Activated 1 of 3 Automaton drafts" with the rejected stables. A page number past the end jumps to the last page. A row opens the stored details as label / value lines, the operation name and a link to the page the action was taken on (a password reset links to that player's panel).

Recorded with `recordAction` into `admin_audit_logs`, which is kept forever (not to be confused with `audit_logs`, the 30-day game event log). Password resets record the player's id, username and stable name, never the password; changelog edits record the entry id, title and the names of the changed fields, never the body text. Rows written by removed endpoints still read well. Titles and details come from `services/admin/admin-actions/adminActionCatalogue.ts`; add new operations there.

**API:** `GET /api/admin/actions?area=cycles|season|automatons|moderation|players|changelog|other&result=all|failure&page&pageSize(≤100)` → `{ entries, total, page, pageSize, totalPages, counts: { all, failures, byArea }, since }`. Removed in part 8: `GET /api/admin/audit-log`, `POST /api/admin/audit-log` (any admin session could write any entry), `GET /api/admin/audit-log/repairs`, and the unused maintenance endpoints `POST /api/admin/repair/all`, `/recalculate-hp`, `/daily-finances/process`, `/snapshots/backfill`, `/scheduler/trigger/:jobName` and the team-battle triggers (`/team-battles/*`, team league and tournament triggers).

### Changelog (`/admin/changelog`)

Create, edit, publish, and delete changelog entries. Supports categories (balance, feature, bugfix, economy), draft/published status, and optional image upload.

**API:** Changelog CRUD endpoints under `/api/changelog/`

### Image Uploads (`/admin/image-uploads`)

Answers "is every image on a robot acceptable?". Only player uploads (`uploads/user-robots/`) are in scope; generated stables use shared `/assets/robots/` images and Automaton images live in `uploads/automatons/`.

- **Cards**: images in use (and on how many robots and stables), saved but not in use (retained in players' Image Libraries), uploaded this season (and in its first week), NSFW blocks and "uploaded anyway" overrides of the last 30 days, disk use.
- **Uploads per week**, this season (from the season's creation, Monday-started UTC weeks), and **Moderation, last 30 days** from the audit log: saved, blocked by the NSFW filter, warned "doesn't look like a robot", then uploaded anyway or gave up, refused because the filter was offline.
- **Images in use**: every uploaded image on a current robot, newest first, filter All / Uploaded anyway, search on stable or robot name (`?filter=`, `?q=`, `?page=`). There is no review state; the list is small and most uploads happen at the start of a season.
- **Image slide-over** (`?image=<id>`): full size, owner (links to Players), current robots, archived seasons, library use, and the nsfwjs scores at upload against the block thresholds (porn and hentai 0.30, sexy 0.50) and the robot-likeness check (drawing + neutral ≥ 0.60). Files uploaded before November 2026 have no scores. **Remove image** is for an image that got past the NSFW filter: it needs a reason and a second confirmation naming the robots; its robots and archived seasons fall back to the default frame, the file is deleted, the player is not notified, and the action is written to `admin_audit_logs` (`image_removed`).
- **Storage**: orphan files (no live robot, archived season or live user's library uses them) and missing files (robot or archive references whose file is gone). **Preview cleanup** lists what would change; **Clean up** runs the same sweep as the season rollover and clears the missing references, audited as `image_cleanup`.

The inventory is `uploaded_images` (written on upload confirm with the moderation scores, removed with the file, reconciled with the disk at startup and after every sweep).

**API:** `GET /api/admin/images/overview`, `GET /api/admin/images?filter=all|anyway&q=&page=`, `GET /api/admin/images/:id`, `DELETE /api/admin/images/:id` (body `{ confirm: true, reason }`), `GET /api/admin/images/cleanup` (preview), `POST /api/admin/images/cleanup`. Removed: `GET /api/admin/uploads`, `POST /api/admin/uploads/cleanup`.

### Attributes (`/admin/attributes`)

Which attributes, attribute groups and build profiles win battles, to plan how the meta should shift next season. Replaces Robot Stats; `/admin/robot-stats` redirects here. Weapons, refinements and loadouts are on [Weapons](#weapons-adminweapons), on the same engine and loaded window; stance and yield win rates follow on Meta.

**Data.** The battle-time build of every robot that fought (`battle_participant_builds`, written by all seven fought-battle writers), never the robots' current values. Recording started with this release; until there are seven days of records the page shows when the analysis appears. Ranges never reach back before recording started.

**Controls** (kept in the URL: `?range=&column=&off=`):
- **Battles from:** last 7 days (default), 14 days, 30 days, this season. Late-season shifts show in the shorter ranges.
- **Sort by:** All modes / 1v1 / Team / Free-for-all. Sorts the heatmap and picks the column of the biggest-effects list, group matrix and profiles.
- **Layers:** base attributes, then + Tuning, + Weapon bonuses (catalog), + Refinements (Hone/Augment), + Loadout (multiplier). With all four on, the values are exactly the effective attributes the simulator read (parity-tested against `prepareRobotForCombat`). **+ Stance** is not an attribute layer: combat never changes attribute values by stance; it applies stance inside its hit, damage, counter, shield-regen and movement formulas. So the toggle adds stance to the model as its own effect (the share of each side fighting offensive / defensive, balanced as reference), shown per column as "vs balanced: offensive … · defensive …". The shared `STANCE_MODIFIERS` table is for display only and is not used. The catalog bonus is derived from the stored effective value, so it stays right if the catalog changes mid-season. Damage and cooldown refinements (Sharpen) are weapon stats, not attributes.

**Columns.** All modes; 1v1 (league and tournament); Team (2v2, 3v3, tag team, team tournaments; a side is the average of its robots); Free-for-all (KotH and Grand Melee: every robot for itself, by placement; formerly labelled "Multi-robot", which read as if team modes were excluded from having several robots). A column with fewer than 300 comparisons is not analysed.

**Method.**
- Every fought battle becomes paired comparisons. Two-sided modes: side 1 against side 2, winner from `winning_side`, then `winner_id`. KotH / Grand Melee: every pair of robots with different placements, the better placement winning; a battle weighs n/2 in total (each robot once), spread over its pairs, and Grand Melee is sampled to 30 pairs per battle. Byes, forfeits, draws and tied placements are left out and counted.
- A logistic model without intercept on the difference in log total points (the investment control) and the differences in each attribute's share of points, with a small ridge penalty on the shares (they sum to one). Standard errors are cluster-robust by battle.
- **Attribute effect:** the change in win chance (percentage points, at even odds) from moving 5 share points into the attribute, taken evenly from the other 22, against an opponent with the same total. Coloured only when at least twice its standard error. The 23 effects of a column sum to zero.
- **10% more points:** the investment effect per column, for scale.
- **Group combinations:** a second model on the five group shares (Combat 6, Defence 5, Chassis 5, AI 4, Team 3) plus the ten pairwise products. Diagonal: moving 5 share points into the group; above it: the extra win chance when both groups are 10 share points above average, beyond what each adds alone.
- **Build profiles:** a group is heavy at ≥ 1.5× the share an even spread gives it; a pair needs both groups at ≥ 1.25×; otherwise Balanced. Win rate against a different profile with a total within about 10% (shown from 50 comparisons), plus the share of all robots and of human players' robots that fought.
- **Model fit by layer:** log-loss and accuracy on held-out battles (one in five, by battle id) for base only, then each layer added in combat order (All modes, up to 60,000 training comparisons). A coin flip scores 0.693 and 50%.
- Effects are associations: builds that favour an attribute often share other choices. Generated stables' random builds give most of the variation; "Players' share" shows what humans build.

**Cost.** Up to 100,000 comparisons per window; longer windows are sampled deterministically by battle id (the page says so). A cold analysis at that size takes several seconds (about 7 s locally) and yields to the event loop throughout; results are cached per window and layer set until a new build is recorded (at most 10 minutes), and the loaded battles of the last window (about 70 MB) are kept for other layer sets.

**API:** `GET /api/admin/analysis/attributes?range=7d|14d|30d|season&tuning=&weapons=&refinements=&loadout=&stance=` (layer flags `true`/`false`, default `true`). Admin-only, read-only. Answers `{ status: 'collecting', recordingSince, availableFrom, battlesRecorded }` or the full analysis with `status: 'ready'`.

## Player Activity Segments

The Players page and the dashboard read one activity rule (`adminThresholds.ts`): a player's activity is their last login, or their registration when they never logged in (registration counts as the first login). JWTs expire after 24 h without refresh, so the last login is at most a day stale.

| Segment | Rule |
|---------|------|
| **Active** | Activity within the last 3 days (`INACTIVE_PLAYER_AFTER_MS`) |
| **Inactive** | Activity older than 3 days, but on or after the current season's start |
| **Dormant** | No activity since the current season started; the season rollover deletes these stables (see [PRD_SEASON_SYSTEM.md](../game-systems/PRD_SEASON_SYSTEM.md)) |

The three add up to every human stable. The old churn-risk classification (High / Medium / Low with a 5-battle rule) and its filter were removed with the redesign; it disagreed with the dashboard's definitions.

## User Filter System

The admin pages split by stable type with the [stable-type filter](#stable-type-filter) (`?stables=`, `utils/stableScope.ts`). Under it, Players is `buildUserFilter('real')` from `src/utils/buildUserFilter.ts`: human stables without `auto_*bot_*`, `test_user_*`, `archetype_*`, `attr_*` and `bye_robot_user` accounts. The same rule decides who counts as a human player for activity, dormant-stable purges and low balances; `buildUserFilter` itself is unchanged.

## Daily Cycle System

A cycle represents one "day" in the game world. The bulk cycle runner on the Cycle Controls page executes these steps in sequence:

1. Repair all robots (with cost deduction)
2. Tournament execution
3. Post-tournament repair
4. League battle execution
5. League rebalancing (promotions/demotions)
6. Top up generated stables to `GENERATED_STABLE_TARGET` (optional, "Top up generated stables"; default 150; also runs on preparation days)
7. Post-league repair
8. Matchmaking for next cycle

Individual operations can also be triggered manually via the production job buttons.

## Related Documentation

- [Cycle System](../game-systems/PRD_CYCLE_SYSTEM.md)
- [Tournament System](../game-systems/PRD_TOURNAMENT_SYSTEM.md)
- [Matchmaking System](../game-systems/PRD_MATCHMAKING.md)
- [Economy System](../game-systems/PRD_ECONOMY_SYSTEM.md)
- [Security Architecture](../architecture/PRD_SECURITY.md)
- [Robot Statistics](../../app/backend/docs/ROBOT_STATISTICS.md)
- [Achievement System](../game-systems/PRD_ACHIEVEMENT_SYSTEM.md)
- [Tuning Bay System](../game-systems/TUNING_BAY_SYSTEM.md)
- [Automaton Stables](../game-systems/PRD_AUTOMATON_STABLES.md) and [Automaton Operations Guide](AUTOMATON_OPERATIONS_GUIDE.md)

## Season Management (Spec #45)

All routes are admin-only and every action writes an `admin_audit_logs` entry.

### Season state — `GET /api/admin/seasons/state`

Current season number, phase, cycles completed and remaining, whether a rollover is queued or running (`rolloverInProgress`), whether the phase is an appropriate window for balance changes, and the effective configuration. Also `startedAt` (when the season opened), `nextSettlementAt` (the scheduler's next settlement, `null` with automated scheduling off) and `activeRollover` (`null`, or the queued / running rollover: run id, trigger, who, times and stage progress).

### Rollover preview — `GET /api/admin/seasons/rollover-preview`

Read-only. Reports player stables and robots that would be archived (`humanStables` / `humanRobots` include Automatons), generated stables that would be **deleted**, the same split by type in `breakdown` (`human`, `automaton`, `generated`, using the rollover's own deletion criteria), rows per table for every table the rollover empties, and image files retained versus deleted. Modifies nothing — run this before any rollover.

### Manual rollover — `POST /api/admin/seasons/rollover`

Requires both `confirm: "CONFIRM_ROLLOVER"` and the current `seasonNumber`. A mismatched season number is rejected, so a stale browser tab cannot reset the wrong season.

This is the **only** way to close Season 0, which has no fixed length. It runs under the scheduler lock (after the running job, if any) rather than waiting for a settlement boundary, and is recorded as a `seasonRollover` run.

With `background: true` it answers 202 `{ run }` at once (Season Control uses this). Without it the call waits and returns archived counts, generated stables deleted, total rows purged and per-stage durations, as before. A rollover already queued or running (either trigger) returns `409 ROLLOVER_IN_PROGRESS`. A queued rollover whose season is no longer current when it reaches the lock fails with `SEASON_NUMBER_MISMATCH` and changes nothing.

### Rollover history — `GET /api/admin/seasons/history`

Completed seasons, newest first, each with the rollover that closed it and its failed or interrupted attempts, plus `currentSeasonAttempts`. Built from `seasonRollover` runs and, for rollovers before the first run, `admin_audit_logs` `season_rollover` rows.

### Extend the current season — `POST /api/admin/seasons/extend`

Defers the boundary for the current season only, leaving `SEASON_LENGTH_CYCLES` authoritative for later seasons.

### Adjust the preparation window — `POST /api/admin/seasons/preparation-cycles`

Sets remaining preparation cycles, from 0 to `PREPARATION_LENGTH_CYCLES`. A larger value is rejected with `400 INVALID_PREPARATION_CYCLES` (it used to be clamped silently). Rejected when the season is not in its preparation phase.

### Before a rollover

1. Run the preview and check the counts look right.
2. Confirm a recent database backup exists — the purge is not reversible.
3. Announce the reset if the countdown banner has not been running.
4. After it completes, write and publish a balance changelog entry at `/admin/changelog` during the preparation window.
