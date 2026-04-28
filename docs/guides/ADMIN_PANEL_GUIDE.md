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
**Filter:** Real / Auto / All user filter

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

**API:** `GET /api/admin/users/recent?cycles=N&filter=real|auto|all`, `GET /api/admin/users/at-risk`, `GET /api/admin/users/search?q=...`, `GET /api/admin/users/:id`, `POST /api/admin/users/:id/reset-password`

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
**Filter:** Real / Auto / All user filter

### Security (`/admin/security`)

Security event summary (by severity), flagged users, filterable event list with severity/type/user/date filters.

**API:** `GET /api/admin/security/summary`, `GET /api/admin/security/events`

### Achievements (`/admin/achievements`)

Per-achievement unlock count and rate, participation stats, never-unlocked and high-unlock flags.

**API:** `GET /api/admin/achievements/analytics`
**Filter:** Real / Auto / All user filter

### Tuning (`/admin/tuning`)

Tuning allocation adoption rate, total robots with tuning, and attribute ranking showing which attributes players invest tuning points into most.

**API:** `GET /api/admin/tuning/adoption`
**Filter:** Real / Auto / All user filter

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
| **Real** (default) | Excludes `auto_wimpbot_*`, `auto_averagebot_*`, `auto_expertbot_*`, `test_user_*`, `bye_robot_user` |
| **Auto** | Only auto-generated bot accounts (`auto_*` prefixes) |
| **All** | Everything including test and system accounts |

The filter is implemented by `buildUserFilter()` in `src/utils/buildUserFilter.ts` which returns a Prisma `UserWhereInput` clause.

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
