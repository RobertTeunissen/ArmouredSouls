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
| **Overview** | Dashboard | `/admin/dashboard` | KPI cards, system stats, battle type breakdown |
| **Game Operations** | Cycle Controls | `/admin/cycles` | Scheduler status, manual triggers, bulk cycle runner |
| | Practice Arena | `/admin/practice-arena` | Practice battle usage and daily trends |
| **Battle Data** | Battle Logs | `/admin/battles` | Paginated battle history with type filters and detail slide-over |
| | Robot Stats | `/admin/robot-stats` | Attribute analysis, outlier detection, win rate correlation |
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

KPI cards showing total users, new users (7d), total robots, battles (24h), total battles, active users (7d), current cycle, and last cycle timestamp. Below the KPIs: system stats grid with robot tier breakdown, match scheduling, battle statistics (overall and per-type: league/tournament/tag team/KotH), economy overview, facility stats, weapon stats, stance/loadout/yield distributions.

**API:** `GET /api/admin/dashboard/kpis`, `GET /api/admin/stats`
**Filter:** Real / Auto / Automatons / All user filter

### Cycle Controls (`/admin/cycles`)

Scheduler status panel showing active state, running job, and queue. Manual trigger buttons with confirmation dialogs for: matchmaking, battles, league rebalancing, repairs, daily finances, KotH. Bulk cycle runner with configurable cycle count (1-100), tournament/KotH/finance/user-generation toggles. Session log with export and clear.

**API:** `GET /api/admin/scheduler/status`, `POST /api/admin/cycles/bulk`, and individual operation endpoints

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

Manages Automaton_Stables on any environment. Title "Automaton Stables"; NAV entry "Automatons" under Player Management. Operator procedures (activation in batches, incidents, export and strategy workflow) are in [AUTOMATON_OPERATIONS_GUIDE.md](AUTOMATON_OPERATIONS_GUIDE.md); product rules in [PRD_AUTOMATON_STABLES.md](../game-systems/PRD_AUTOMATON_STABLES.md).

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

### Practice Arena (`/admin/practice-arena`)

Current session stats (battles today, unique players, rate limit hits, total since start) and daily usage history table.

**API:** `GET /api/admin/practice-arena/stats`

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

Current season number, phase, cycles completed and remaining, whether a rollover is running, whether the phase is an appropriate window for balance changes, and the effective configuration.

### Rollover preview — `GET /api/admin/seasons/rollover-preview`

Read-only. Reports player stables and robots that would be archived, generated stables that would be **deleted** (reported separately), rows that would be purged per table, and image files that would be retained versus deleted. Modifies nothing — run this before any rollover.

### Manual rollover — `POST /api/admin/seasons/rollover`

Requires both `confirm: "CONFIRM_ROLLOVER"` and the current `seasonNumber`. A mismatched season number is rejected, so a stale browser tab cannot reset the wrong season.

This is the **only** way to close Season 0, which has no fixed length. It executes immediately rather than waiting for a settlement boundary.

Returns archived counts, generated stables deleted, total rows purged, and per-stage durations. A concurrent rollover returns `409`.

### Extend the current season — `POST /api/admin/seasons/extend`

Defers the boundary for the current season only, leaving `SEASON_LENGTH_CYCLES` authoritative for later seasons.

### Adjust the preparation window — `POST /api/admin/seasons/preparation-cycles`

Sets remaining preparation cycles, 0–7. Rejected when the season is not in its preparation phase.

### Before a rollover

1. Run the preview and check the counts look right.
2. Confirm a recent database backup exists — the purge is not reversible.
3. Announce the reset if the countdown banner has not been running.
4. After it completes, write and publish a balance changelog entry at `/admin/changelog` during the preparation window.
