# Admin Portal Guide

## Overview

The Admin Portal (`/admin`) is the primary management and monitoring tool for Armoured Souls. It requires the `admin` role and is accessed via a dedicated sidebar-based layout separate from the player-facing game UI.

## Architecture

The portal uses a **sidebar + page** architecture:

- **`AdminLayout.tsx`** — Fixed sidebar with grouped navigation, header bar with page title, error boundary, and `<Outlet>` for page content
- **Pages** — Each page is a lazy-loaded standalone component in `pages/admin/`
- **Shared components** — Reusable UI in `components/admin/shared/`: `AdminPageHeader`, `AdminStatCard`, `AdminDataTable`, `AdminFilterBar`, `AdminSlideOver`, `AdminEmptyState`
- **Shared types** — `components/admin/types.ts` contains shared interfaces
- **Store** — `stores/adminStore.ts` (Zustand) manages scheduler status, session log, and cached stats

All pages manage their own data fetching. The sidebar collapses to icons on narrow screens (`w-16` → `md:w-60`).

## Navigation Structure

| Section | Page | Route | Description |
|---------|------|-------|-------------|
| **Overview** | Dashboard | `/admin/dashboard` | Status strip, needs attention, player KPIs, battle activity per mode |
| **Game Operations** | Cycle Controls | `/admin/cycles` | Running job, daily schedule with Run buttons, persistent run history (restarts, missed and interrupted runs), bulk cycle runner |
| | Practice Arena | `/admin/practice-arena` | Practice usage per UTC day, refusals and unavailable time, top practitioners, how it is used |
| **Battle Data** | Battle Logs | `/admin/battles` | Paginated battle history with type filters and detail slide-over |
| | Robot Stats | `/admin/robot-stats` | Attribute analysis, outlier detection, win rate correlation |
| | Meta | `/admin/meta` | What stables choose: stances, loadouts, yield thresholds, facilities, weapons |
| | League Health | `/admin/league-health` | Per-league robot counts, ELO averages, instance counts |
| | Weapons | `/admin/weapons` | Weapon popularity, type breakdown, ownership stats |
| **Player Management** | Players | `/admin/players` | Player list with tabs (New Players, Auto-Generated, At-Risk), churn risk, engagement, search, detail slide-over |
| | Automatons | `/admin/automatons` | Automaton stables: status bar, stables, strategies, editor, catalogue (Spec #55) |
| | Economy | `/admin/economy` | Credit circulation, balance distribution, facility adoption |
| **Security & Moderation** | Security | `/admin/security` | Security events, severity summary, flagged users |
| | Image Uploads | `/admin/image-uploads` | Upload history, moderation events, orphan cleanup |
| **Content** | Changelog | `/admin/changelog` | Create, edit, publish changelog entries |
| | Achievements | `/admin/achievements` | Unlock rates, participation stats |
| | Tuning | `/admin/tuning` | Tuning allocation adoption, attribute ranking |
| | Search Analytics | `/admin/search-analytics` | Settled searches, no-result rate, results by category, phrase table with CSV export |
| **Maintenance** | Repair Log | `/admin/repair-log` | Manual vs automatic repairs, savings tracking |
| | Audit Log | `/admin/audit-log` | Admin action audit trail with filters |

## UI Patterns

### Filter Style

All pages use the `AdminFilterBar` component for filter controls — pill-shaped toggle buttons with a consistent look. This includes:
- Tab-like navigation within pages (e.g., Players: New Players / Auto-Generated / At-Risk)
- Data type filters (e.g., Battle Logs: All / League / Tournament / Tag Team / KotH)
- User type filters (e.g., Achievements: Real Players / Auto-Generated / All)

### Stat Cards

`AdminStatCard` provides KPI display with label, value, color coding, optional trend indicator, and icon. Used at the top of most pages for summary metrics.

### Data Tables

`AdminDataTable` provides sortable, paginated tables with custom column renderers, row click handlers, and empty state messages.

### Slide-Overs

`AdminSlideOver` provides a right-side panel for detail views (player detail, battle detail) without leaving the current page.

## Page Details

### Dashboard (`/admin/dashboard`)

The landing page answers "is the game healthy, and does anything need me?". It is read-only and sends no alerts (Discord alerts have their own single emitters).

Sections, top to bottom:

1. **Toolbar** — the user filter (Real players / Auto-generated / Automatons / All, kept in the URL as `?filter=`, default `real`), "Last updated" and Refresh. Refresh refetches every section and bypasses the battle-activity cache.
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
| Security alerts | Warning + critical events in the security monitor's in-memory buffer; an error if any is critical. |
| Automatons need attention | `needAttentionCount` of the Automatons status bar; an error if any turn failed. Links to the Stables tab filtered on attention. |
| Cycle problems | One item, red if any of: settlement overdue (scheduler active and the last settlement missing or older than 26 h; "last settlement" is the later of `cycle_metadata.last_cycle_at` and the season's `last_settlement_at`, so daily Preparation_Phase settlements count too and a missed one still shows); a scheduler job whose last run failed; matches still `scheduled` more than 2 h after their slot ("left behind"). Otherwise "Last cycle healthy". The scheduler's job states are in memory and reset on every restart or deploy, so the item then reports "k/10 jobs reported since restart"; the overdue and left-behind checks read the database and work across restarts. |
| Battle activity · Last cycle | Battles created between the ends of the two most recent settlements (`cycle_snapshots.end_time`). "—" until a season has two settlements. |
| Battle activity · Season | Every row in `battles` (truncated at Season_Rollover). Counts include battles with at least one participant robot owned by a filtered user. |
| Battle activity · Walkovers | Byes and battle-time forfeits (`is_bye_match` on the scheduling row, a forfeited participant, or a bracket row with status `forfeit`). Counted as battles, left out of the rates. |
| Battle activity · Queued | System-wide: `scheduled_matches_v2` rows still `scheduled`, plus outstanding bracket rows of active tournaments that already have a participant. |
| Draw % / Kill % / Avg time | Over fought battles. Draw = `winner_id IS NULL AND winning_side IS NULL` (team battles record their result in `winning_side`); n/a for KotH and Grand Melee. Kill = at least one participant `destroyed`. |

**API:** `GET /api/admin/dashboard/status` (no filter), `GET /api/admin/dashboard/kpis?filter=`, `GET /api/admin/dashboard/battle-activity?filter=&fresh=` (cached 60 s per filter; `fresh=true` bypasses). All require `authenticateToken` + `requireAdmin`. `kpis.activeUsersLast7d` is deprecated (it counted robots updated by battles); use `humanPlayers.active7d`.

### Meta (`/admin/meta`)

An overview of what stables choose, for the selected stable type. It moved off the Dashboard (where it was the collapsed "Meta snapshot") so the landing page stays short. The toolbar is the Dashboard's: the same filter (`?filter=`, default `real`), "Last updated" and Refresh.

Sections (desktop: three cards, then Yield thresholds beside Facilities; they stack below 1280 px and 768 px):

| Section | Shows |
|---|---|
| Stances / Loadouts | One stacked bar per distribution plus a legend: share and robot count per option, largest first. |
| Weapons | Owned, Equipped (owned weapons in any robot's main **or** offhand slot, `equippedInventoryItems`) and the equip rate; links to Weapons. |
| Yield thresholds | One column per threshold in use (labels at 0–20% in steps of 5 and on the highest), the most common value highlighted. Above it: Most common (with its share), Median (the threshold of the middle robot) and Above 20% (robots and share). Exact counts per threshold are in each column's tooltip and in a screen-reader table. |
| Facilities | Stables owning each facility at level ≥ 1 and their average level (L), most owned first, with a bar relative to the most owned; two columns from 640 px. |

All counts are robots (or stables, for Facilities) owned by users in the filter. With All or Auto-generated, generated stables dominate and their choices are randomised, so near-even splits are expected; Real players shows what people pick. Usage share next to win rate is planned as a follow-up.

**API:** `GET /api/admin/stats?filter=` (`authenticateToken` + `requireAdmin`), read by its own filter-scoped loader (`hooks/useMetaOverview.ts`): a filter change aborts the previous request, so a late response for another filter is never shown.

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
| Run | One row of `scheduler_job_runs`: job, trigger (`cron`, `manual`, `resume` for a settlement resumed at startup, `bulk`), who started it, status, queued / started / finished, duration, result summary or error. Written for every run, never failing the job. |
| Queued / Running | Waiting for the scheduler lock / holding it. |
| Skipped | A battle job that returned at once because the season is in its Preparation_Phase. |
| Interrupted | The backend stopped (usually a deploy) before the run finished. Marked at the next start; it ends at the stopped process's last heartbeat. |
| Backend restarted | A `scheduler_processes` row: one per backend start, with a 60 s heartbeat. "Down X–Y" is the previous process's last heartbeat to this start. |
| Missed | A daily slot with no cron or resumed run queued between 1 min before and 15 min after it, while the scheduler was enabled. A later manual run is its own row and does not hide the miss. Slots before history tracking started, while the scheduler was disabled, or less than 15 min ago are never missed. A miss inside a restart gap shows that downtime. |

Season rollovers are runs too (job **Season rollover**, `seasonRollover`): trigger `manual` from Season Control, `cron` when the settlement rolls the season over. They appear in Run history and in the job filter.

**API:** `GET /api/admin/scheduler/overview`, `GET /api/admin/scheduler/runs?jobName&problemsOnly&days(1–30)&page&limit`, `GET /api/admin/scheduler/runs/:id`, `POST /api/admin/scheduler/runs` `{ jobName }` → 202 `{ run }` (400 unknown job, 409 already active), `POST /api/admin/cycles/bulk` with `background: true` → 202 `{ run }` (without it the call waits and returns the full result, as before; 409 while a bulk run is active). `GET /api/admin/scheduler/status` (in-memory state) and `POST /api/admin/scheduler/trigger/:jobName` (waits for the job) remain for scripts; the page no longer uses them. All require `authenticateToken` + `requireAdmin`; manual and bulk starts write an `admin_audit_logs` row.

### Season Control (`/admin/seasons`)

Answers: where is the season, when does it roll over, what would a rollover do, and how did earlier rollovers go. All times are UTC. The page polls every 5 s while a rollover is queued or running and every 60 s otherwise.

Sections, top to bottom:

1. **Season timeline** — season number and phase; cycle (or preparation day) of the length with a progress bar; estimated dates; the configuration (season length, marked "extended" after an Extend, preparation length, countdown, accolade depth, images kept per stable). Competitive: player countdown start, rollover, next season's competitive start. Preparation: competitive start, rollover, balance-change window. Season 0 explains that only a manual rollover closes it.
2. **Season rollover** — what it does, **Preview rollover** (on demand) and **Roll over Season N…**. The preview splits stables by type: human players and Automatons (archived, then reset) and generated stables (deleted; results stay in the archive), lists retained images, and groups the rows it empties into Battles and summaries / Ledger, audit and snapshots / Standings, tournaments and other, each expanding to per-table counts. While a rollover is queued or running (either trigger) the card shows who or what started it, the elapsed time and the five stages live: Archive, Verify, Purge and reset (with a generated-stables bar), Clean up, Automaton turns.
3. **Rollover history** — every completed season (dates, cycles, stables archived, generated count) with the rollover that closed it: when, Admin · name or Settlement, duration, what it archived, deleted and emptied, and Details (stage durations). Failed and interrupted attempts fold under the season they tried to close, with the stage they stopped at. Failed attempts on the current season come first.
4. **Testing tools** (collapsed) — Extend the season (1–365 cycles; shows "100 → 105 cycles · rollover moves to ~15 Nov" before confirming) and Remaining preparation cycles (0 to the configured preparation length, only during a preparation phase).

**Roll over.** The dialog repeats the preview's counts and needs the phrase `CONFIRM_ROLLOVER` typed; the season number is sent for you. Confirming starts the rollover **in the background** under the scheduler lock (scheduled jobs wait for it), because a rollover on a full environment can outlast the proxy's 30 s response timeout. A queued rollover that finds the season changed while it waited (a settlement rolled it over) stops without changing anything. A second start while one is queued or running answers 409. When a rollover the page watched ends, a message gives the outcome.

**Definitions**

| Term | Definition |
|---|---|
| Estimated date | Counted from the scheduler's next settlement at one cycle per day: rollover = next settlement + (remaining − 1) days, next competitive start = rollover + preparation length. No dates when automated scheduling is off. |
| Rollover run | A `scheduler_job_runs` row of job `seasonRollover` with the stage progress and result in its summary. |
| Legacy rollover | A rollover from before runs were recorded, read from its `admin_audit_logs` `season_rollover` row (audit rows newer than the first run are not read again). |

**API:** see [Season Management](#season-management-spec-45) below.

### Players (`/admin/players`)

Unified player management page combining player listing, engagement monitoring, and at-risk detection.

**Tabs** (via `AdminFilterBar` pills):
- **New Players** — Real (non-test, non-auto) players from recent cycles
- **Auto-Generated** — Bot accounts created by the bulk cycle runner
- **At-Risk** — Users near bankruptcy threshold (₡10,000)

**Controls:**
- Cycle range dropdown (5 / 10 / 25 / 50 / 100 / All)
- Churn risk filter dropdown (All / High / Medium / Low) — client-side filter on the loaded data

**Table columns:** Player name, Balance, Robots, Battles, Win %, Last Login, Churn Risk, Issues count

Stable-level Battles and Win % (this table, the detail summary, and `GET /api/admin/engagement/players`) count each battle once per stable, as on the player dashboard: summed robot counters minus the shared-side overlap (`services/auth/stable-battle-overlap.ts`, one batch query per list). Per-robot figures in the detail slide-over are the robot's own counters. Churn risk still reads the summed robot counters as its activity signal.

**List size:** `GET /api/admin/users/recent` lists at most the 500 newest users in range (`RECENT_USER_ACTIVITY_LIMIT`), also on "All" or when no cycle cutoff exists. Generated stables grow to thousands, and every listed user's robots and shared-side overlap are loaded per request. `totalUsers` (the Real Players / Auto-Generated card) still counts every user in range. When the list is capped the page says "Listing the N newest of M …"; sorting, the churn filter and the With Issues count then cover the listed users.

**Search:** Username, stable name, or robot name search across all users

**Detail slide-over** (click any row):
- Basic info: ID, username, stable, balance, role, join date, onboarding status, last login, churn risk
- Summary stats: robots, battle ready, win rate, facilities
- Issues list (if any)
- Robot details with HP, battle readiness badge, stance, win rate
- Facility list
- Password reset form

**API:** `GET /api/admin/users/recent?cycles=N&filter=real|auto|automaton|all`, `GET /api/admin/users/at-risk`, `GET /api/admin/users/search?q=...`, `GET /api/admin/users/:id`, `POST /api/admin/users/:id/reset-password`

A password reset on an Automaton account is refused with `AUTOMATON_ACCOUNT_LOCKED` (409): Automaton accounts cannot log in.

### Automatons (`/admin/automatons`, Spec #55)

Manages Automaton_Stables on any environment. Title "Automaton Stables"; NAV entry "Automatons" under Player Management. Operator procedures (activation, Turn_Step knobs, incidents, export and strategy workflow) are in [AUTOMATON_OPERATIONS_GUIDE.md](AUTOMATON_OPERATIONS_GUIDE.md); product rules in [PRD_AUTOMATON_STABLES.md](../game-systems/PRD_AUTOMATON_STABLES.md).

**Status_Bar** (above every section): Program_Switch with confirmation, last Turn_Step (`Cycle {n}` / `Prep {n}` / `Season start`, time, stables processed, duration), failed-last-cycle count and Needs attention count; both counts link to the Stables section filtered on Needs attention.

**Sections** (`TabLayout`: tabs at ≥ 1024 px, stacked sections below; the active tab is kept in `?tab=`):

- **Stables** — list with status, strategy, robots, credits, prestige, highest tier, last cycle and Needs attention reason. Filter chips All · Active · Draft · Needs attention (`?filter=`); the selected chip shows a check mark. Toolbar: a **Strategy** dropdown (`?strategy=`; also shown as a removable "Strategy: {name}" chip), **Search stables** over stable name, catalogue key and franchise (`?q=`), and **Sort by** (Catalogue order, Stable name, Strategy, Robots, Credits, Prestige, Highest tier, Last cycle) with an Ascending/Descending button (`?sort=key:dir`, e.g. `sort=credits:desc`). From 768 px the column headers sort too; below that the Sort by control is the only sort. Empty values (drafts, never played, no turn) always sort last. Sorting by Highest tier compares the tier only: stables with the same tier in different modes (e.g. "Gold · Grand Melee" and "Gold · 1v1 League") are a tie and stay in catalogue key order (A→Z) in both directions. Chip counts follow the strategy and search, a status line shows "{n} of {m} stables", and **Clear filters** removes status, strategy and search (the sort stays). **Highest tier (any mode)** is the highest league tier one of the stable's robots or teams holds right now (not its peak), with its mode, e.g. "Gold · 3v3 League"; only modes the stable has actually played count, and "—" means never played. **Activate all drafts** with confirmation (prefer activating in batches; see the operations guide).
- **Strategies** — the **Strategy_Comparison** for the current season (stables, robots average/target, prestige, **highest current tier** with the number of stables at it, credits, **win rate vs humans** with the number of battles, e.g. "43% · 61–78–3 (n = 142)"; a human reference row when humans own robots). Below it, **Performance by mode**: pick one of the six tiered modes (1v1 League, 2v2 League, 3v3 League, Tag Team, King of the Hill, Grand Melee; default 1v1 League); the selected mode shows a check mark. Head-to-head modes show Stables played ("{played} / {stables}"), Robots or Teams played, W–L–D, Win % and Battles (n); King of the Hill and Grand Melee show Stables played, Robots played, Matches (n), 1st places, 1st-place rate and Best placement, because those modes record no losses. A row with fewer than 5 stables or fewer than 20 battles/matches gets a **Low sample** pill. The numbers include Automaton-vs-Automaton battles and mirror matches between stables of the same strategy (which pull the win % toward 50%), and byes count as wins. Then the **Strategy_Library** (strategies, versions, stables per version, **Upgrade** with dry run and confirmation, **New version**, **New strategy**) and the **Strategy_Builder** (numbered Goal list with move up/down, defaults and bounds, inline rule errors, draft preview on a stable and on a fresh stable, **Save draft**, **Export strategy file**).
- **Editor** — stable picker, **New stable**, **Delete draft stable** (drafts only), **Export**, **Save changes**. Cards: Stable (name, franchise, backstory, strategy, Event_Order with move buttons), Teams (Team_Rule teams with names and Formed / Waits for robot {n}), Build order (numbered Goals with editable targets and Turn_Preview statuses, **Preview next cycle**, per-robot attribute plan), blueprints (`BlueprintEditor`: loadout, stance, yield, Build_Focus, Weapon_Path per hand, Refinement_Plan, **Upload image**, **Add blueprint**, **Delete blueprint**), Cycle history (Turn_Records), **Activate** with confirmation.
- **Catalogue** — last Catalogue_Sync summary (added, present, images filled, conflicts), **Export this stable** / **Export all**.

There are no controls to run a turn, delete an active stable, change a balance or edit live robots, teams, subscriptions or weapons. Every mutation is written to the admin audit log as `automaton.*`.

**API:** `/api/admin/automatons` — `GET /status`, `GET /strategies`, `GET /strategies/comparison`, `POST /strategies/:key/upgrade`, `GET|POST /strategy-drafts`, `GET|PUT|DELETE /strategy-drafts/:id`, `POST /strategy-drafts/:id/preview`, `GET /strategy-drafts/:id/export`, `GET|PUT /program`, `GET /export`, `GET /catalogue/sync-status`, `POST /activate-drafts`, `GET|POST /`, `GET|PATCH|DELETE /:key`, `PUT /:key/strategy`, `POST /:key/blueprints`, `PATCH|DELETE /:key/blueprints/:slot`, `POST /:key/blueprints/:slot/image`, `POST /:key/activate`, `GET /:key/preview`, `GET /:key/turns`. Error codes: [ERROR_CODES.md](ERROR_CODES.md) "Automaton Errors".

### Economy (`/admin/economy`)

Credit circulation, average/median balance, bankruptcy risk count, and facility adoption table.

**API:** `GET /api/admin/economy/overview`

### Battle Logs (`/admin/battles`)

Paginated battle list with type filter (All / League / Tournament / Tag Team / KotH), robot name search, format indicators (1v1 / 2v2 / KotH), ELO changes, and duration. Detail slide-over shows formula breakdowns.

**API:** `GET /api/admin/battles`, `GET /api/admin/battles/:id`

### League Health (`/admin/league-health`)

Per-league tier breakdown: robot count, average ELO, number of league instances, and per-instance robot counts.

**API:** `GET /api/admin/league-health`

### Weapons (`/admin/weapons`)

Weapon popularity ranking, type breakdown, total weapons owned.

**API:** `GET /api/admin/weapons/analytics`
**Filter:** Real / Auto / Automatons / All user filter

### Security (`/admin/security`)

Security event summary (by severity), flagged users, filterable event list with severity/type/user/date filters.

**API:** `GET /api/admin/security/summary`, `GET /api/admin/security/events`

### Achievements (`/admin/achievements`)

Per-achievement unlock count and rate, participation stats, never-unlocked and high-unlock flags.

**API:** `GET /api/admin/achievements/analytics`
**Filter:** Real / Auto / Automatons / All user filter

### Tuning (`/admin/tuning`)

Tuning allocation adoption rate, total robots with tuning, and attribute ranking showing which attributes players invest tuning points into most.

**API:** `GET /api/admin/tuning/adoption`
**Filter:** Real / Auto / Automatons / All user filter

### Refinement (`/admin/refinement`)

Weapon Refinement (Spec #34) feature usage. Tracks adoption rate (users who refined ≥1 weapon), per-tier slot counts (Hone / Augment / Sharpen / Forge), most-targeted attributes, total credits spent on refinement, and the top 10 spenders.

**API:** `GET /api/admin/refinement/adoption`
**Filter:** Real / Auto / Automatons / All user filter

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

**API:** `GET /api/admin/practice-arena/overview` (the page). `GET /api/admin/practice-arena/stats` keeps its original shape, now computed from the events; `totalBattlesSinceStart` is this season's battles. Both require `authenticateToken` + `requireAdmin`.

### Repair Log (`/admin/repair-log`)

Manual vs automatic repair events with cost breakdowns, pre-discount costs, and savings tracking. Filterable by repair type and date range.

**API:** `GET /api/admin/audit-log/repairs`

### Audit Log (`/admin/audit-log`)

Paginated admin action audit trail. Filterable by operation type and date range.

**API:** `GET /api/admin/audit-log`

### Changelog (`/admin/changelog`)

Create, edit, publish, and delete changelog entries. Supports categories (balance, feature, bugfix, economy), draft/published status, and optional image upload.

**API:** Changelog CRUD endpoints under `/api/changelog/`

### Image Uploads (`/admin/image-uploads`)

Uploaded image history with user/robot info, moderation event log (rejections, warnings), and orphan file cleanup tool.

**API:** `GET /api/admin/uploads`, `POST /api/admin/uploads/cleanup`, `GET /api/admin/security/events`

### Robot Stats (`/admin/robot-stats`)

Statistical analysis of all 23 robot attributes: mean/median/stddev, outlier detection (IQR method), win rate correlation by quintile, league tier comparison, top/bottom performers.

**API:** `GET /api/admin/stats/robots`

## Churn Risk Classification

The Players page includes a churn risk indicator for each user, combining login recency with battle engagement to flag players who may be leaving the game.

### Risk Levels

| Level | Criteria | Meaning |
|-------|----------|---------|
| **High** | Last login > 14 days ago, OR no battles and last login > 3 days ago | Player is likely gone or never engaged |
| **Medium** | Last login > 7 days ago, OR fewer than 5 total battles | Player is disengaging or hasn't found their footing |
| **Low** | Recent login and 5+ battles | Player is active and engaged |

### How It Works

The `classifyChurnRisk` function in `adminStatsService.ts` evaluates two signals:

1. **Login recency** — days since `lastLoginAt` (falls back to `createdAt` if the user never logged in after account creation)
2. **Battle activity** — total battles across all of the user's robots

These two signals catch different churn patterns:
- A veteran player who stops logging in (high battles, stale login)
- A new player who registered but never engaged (zero battles, stale login)
- A player who logs in but doesn't play (recent login, low battles)

### Filtering by Churn Risk

The Players page provides a churn risk filter dropdown alongside the cycle range selector. Options: All / High / Medium / Low. The filter is applied client-side on the already-fetched user list, so switching between risk levels is instant.

### Data Source

Churn risk is computed per-user in the `GET /api/admin/users/recent` endpoint response. Each user object includes:
- `lastLoginAt` — ISO timestamp of last login, or `null` if never logged in after registration
- `churnRisk` — `'low'` | `'medium'` | `'high'`

## User Filter System

Many admin pages support filtering data by user type to separate real player activity from auto-generated bot noise:

| Filter | What it shows |
|--------|---------------|
| **Real** (default) | Human players only: excludes `auto_wimpbot_*`, `auto_averagebot_*`, `auto_expertbot_*`, `test_user_*`, `bye_robot_user` and Automaton stables (`stableType = automaton`) |
| **Auto** | Only auto-generated bot accounts (`auto_*` prefixes) |
| **Automatons** | Only Automaton stables (`stableType = automaton`, Spec #55) |
| **All** | Everything including test and system accounts |

The filter is implemented by `buildUserFilter()` in `src/utils/buildUserFilter.ts` which returns a Prisma `UserWhereInput` clause. The accepted values are `USER_FILTER_TYPES` (`all`, `real`, `auto`, `automaton`), used by every admin `filter` query parameter; the Real Players chip explains "Human players only. Excludes auto-generated bots and Automatons."

## Daily Cycle System

A cycle represents one "day" in the game world. The bulk cycle runner on the Cycle Controls page executes these steps in sequence:

1. Repair all robots (with cost deduction)
2. Tournament execution
3. Post-tournament repair
4. League battle execution
5. League rebalancing (promotions/demotions)
6. Auto-generate users (optional)
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
