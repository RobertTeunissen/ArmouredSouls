# Admin Panel Guide

## Overview

The Admin Panel provides tools for managing the game's daily cycle, tournaments, battles, and system operations. Access it at `/admin` (requires admin role).

The panel is organized into 7 tabs:
1. **Dashboard** — System statistics overview with integrated System Health monitoring
2. **Cycle Controls** — Run matchmaking, battles, rebalancing, repairs, and bulk cycles
3. **Tournaments** — Create and manage competitive tournaments
4. **Battle Logs** — Browse and filter battle history (1v1 and 2v2 tag team)
5. **Robot Stats** — Statistical analysis, outlier detection, and performance analytics
6. **Bankruptcy Monitor** — Monitor users at risk of bankruptcy (always visible)
7. **Recent Users** — Recent real users with onboarding status and issue detection

## Component Architecture

The Admin Page uses a **thin shell + tab components** pattern:

- **`AdminPage.tsx`** — Lightweight shell (~100-200 lines) handling tab navigation, URL hash persistence, and localStorage persistence. Renders the active tab component.
- **Tab components** — Each tab is a self-contained component in `components/admin/`:
  - `DashboardTab.tsx`
  - `CycleControlsTab.tsx`
  - `BattleLogsTab.tsx`
  - `RobotStatsTab.tsx`
  - `BankruptcyMonitorTab.tsx`
  - `RecentUsersTab.tsx`
- **Shared types** — `components/admin/types.ts` contains shared interfaces (`SystemStats`, `Battle`, `SessionLogEntry`, `RobotStats`, `AtRiskUser`, etc.)
- **Barrel export** — `components/admin/index.ts` re-exports all tab components

Each tab component manages its own data fetching and refresh logic. The `TournamentManagement` component is imported directly from `components/TournamentManagement.tsx`.

## Tab Navigation

Tabs persist across page reloads via two mechanisms:
- **localStorage** — `adminActiveTab` key stores the active tab ID
- **URL hash** — e.g., `#dashboard`, `#battles`, `#bankruptcy-monitor`

Switching tabs updates both localStorage and the URL hash. On page load, the tab is restored from the URL hash first, then localStorage as fallback.

## Daily Cycle System

### What is a Cycle?

A cycle represents one "day" in the game world. It processes all automated activities in a specific order to ensure fair gameplay.

### New Cycle Flow (8 Steps)

1. **Repair All Robots** - Pre-tournament repair with costs deducted
2. **Tournament Execution** - Process tournament rounds and create new tournaments
3. **Repair All Robots** - Post-tournament repair with costs deducted
4. **Execute League Battles** - Run all scheduled league matches
5. **Rebalance Leagues** - Promote/demote robots between tiers
6. **Auto Generate Users** - Add new AI players (optional)
7. **Repair All Robots** - Post-league repair with costs deducted
8. **Matchmaking** - Schedule matches for next cycle

### Running Cycles

**Location:** Admin Panel → Cycle Controls Tab

**Controls:**
- **Cycles to Run:** 1-100 (default: 1)
- **Include Tournaments:** Enable/disable tournament processing (default: enabled)
- **Include Daily Finances:** Enable/disable daily finance processing
- **Generate Users Per Cycle:** Auto-create N users per cycle where N = cycle number (default: disabled)
- **Auto-Repair:** Enable/disable automatic robot repairs

**Button:** 🚀 Run X Cycle(s)

**What Happens:**
- All 8 steps execute sequentially
- Repair costs are automatically deducted from user balances
- Session log shows detailed progress for each step
- Stats refresh automatically after completion

### Session Log

The session log shows real-time progress:

```
✓ Cycle 1: Step 1 - Repaired 15 robot(s) for ₡60,000
✓ Cycle 1: Step 2 - Tournaments: 1 tournament(s), 1 round(s), 4 match(es)
✓ Cycle 1: Step 3 - Repaired 8 robot(s) for ₡32,000
✓ Cycle 1: Step 4 - Executed 20 battle(s) (20 successful, 0 failed)
ℹ Cycle 1: Step 5 - Rebalanced: 3 promoted, 2 demoted
✓ Cycle 1: Step 8 - Created 18 match(es)
```

Session log features:
- Timestamps and color-coded entry types
- Persists to localStorage (`adminSessionLog` key, max 100 entries FIFO)
- Clear log and export-to-JSON functionality

## Individual Operations

### Matchmaking

**Button:** 🎯 Run Matchmaking

**What it does:**
- Creates scheduled league matches for all battle-ready robots
- Matches are scheduled 24 hours in the future by default
- Uses ELO-based pairing within league instances

**When to use:**
- To manually schedule matches outside of the cycle
- For testing matchmaking algorithms
- When you need immediate match scheduling

### Execute Battles

**Button:** ⚔️ Execute Battles

**What it does:**
- Runs all scheduled matches with status='scheduled'
- Processes combat, updates ELO, awards rewards
- Records battle history

**When to use:**
- To manually execute scheduled matches
- For testing battle mechanics
- When you want battles without running a full cycle

### Rebalance Leagues

**Button:** 🔄 Rebalance Leagues

**What it does:**
- Evaluates robots based on league points
- Promotes top performers to higher tiers
- Demotes bottom performers to lower tiers

**When to use:**
- To manually trigger league rebalancing
- For testing promotion/demotion logic
- After significant ELO changes

### Auto-Repair All Robots

**Button:** 🔧 Auto-Repair All Robots

**What it does:**
- Repairs all damaged robots to full HP
- Applies Repair Bay facility discounts
- **Deducts costs from user balances**

**When to use:**
- To manually repair all robots
- For testing repair cost calculations
- Before important events or testing

### Process Daily Finances

**Button:** 💰 Process Daily Finances

**What it does:**
- Processes daily financial operations for all users
- Applies facility operating costs and income

**When to use:**
- To manually trigger daily finance processing
- For testing economic balance

## Dashboard Tab

### System Statistics

The Dashboard displays a statistics grid organized into sections:

**Robots:**
- Total robots by tier
- Battle-ready percentage
- Average ELO by league

**Battles:**
- Last 24 hours activity
- Total battles
- Draw percentage
- Kill percentage
- Average duration

**Economy:**
- Total credits in system
- Average user balance

**Facilities:**
- Most popular facilities
- Average facility levels
- Total purchases

**Combat Stats:**
- Stance distribution
- Loadout type distribution
- Yield threshold patterns

### System Health (Collapsible Section)

At the bottom of the Dashboard, a collapsible `<details>` section provides System Health monitoring (previously a standalone tab). Expand it to view:

- **Cycle Performance** — Average cycle duration, step durations, degradation detection (fetched from `/api/analytics/performance`)
- **Data Integrity** — Valid/invalid cycle counts, integrity issues (fetched from `/api/analytics/integrity`)
- **Event Statistics** — Total events, active users/robots, events by type (fetched from `/api/analytics/logs/summary`)

## Bankruptcy Monitor Tab

The Bankruptcy Monitor is a dedicated tab for monitoring users at risk of bankruptcy. Unlike the old conditional section buried in the Dashboard, this tab **always renders**:

- **When users are at risk:** Displays a detailed list with balance history, runway days (estimated days until bankruptcy), and robot damage information for each at-risk user
- **When no users are at risk:** Shows a green "✓ No users at risk of bankruptcy" confirmation with the bankruptcy threshold displayed

This tab fetches data from `GET /api/admin/users/at-risk`.

**When to use:**
- To proactively monitor the economic health of the player base
- To identify users who may need balance adjustments
- After running cycles with high repair costs

## Tournaments Tab

### Tournament Management

**Create Tournament:**
- Set tournament name
- Choose number of participants (power of 2: 4, 8, 16, 32, 64)
- System auto-selects top robots by ELO

**Active Tournaments:**
- View current round and progress
- See bracket structure with seedings
- Execute next round manually
- Complete tournament when finished

**Tournament History:**
- View past tournaments
- See winners and participants
- Review tournament statistics

## Battle Logs Tab

### Battle History

**Filters:**
- **League Type:** All, Bronze, Silver, Gold, Platinum, Diamond
- **Battle Type:** All, League, Tournament, Tag Team
- **Search:** Robot names or usernames

### Tag Team Battle Filtering

Select "Tag Team" from the Battle Type filter to view 2v2 tag team battles. When this filter is active, the backend queries `TagTeamMatch` records joined with `Battle` and `TagTeam` data.

Each battle row displays a **battle format indicator**:
- **1v1** — Standard league or tournament battle
- **2v2** — Tag team battle

When "All" is selected, both 1v1 and 2v2 battles are shown together with their format indicators.

### Battle Details

Click any battle to open the Battle Details Modal:

- **1v1 battles:** Side-by-side robot comparison, attribute comparison grid, combat log with expandable formula breakdowns, and battle rewards
- **2v2 tag team battles:** Team layout showing Team 1 (active + reserve robots) vs Team 2 (active + reserve robots), team-level stats, individual robot stats per team member, and the combat log

## Robot Stats Tab

### System Statistics

**Attribute Selector:** Choose which robot attribute to analyze

**Analysis Sections:**
- Statistical analysis cards
- Outlier detection
- Win rate correlation
- League comparison
- Top/bottom performers with clickable robot name links

## Recent Users Tab

Displays recent real users with:
- Per-user onboarding status (completion, skip, current step)
- Robot details per user
- Issue detection flags
- Cycle range control for filtering the time window

## Best Practices

### Testing Workflow

1. **Initial Setup:**
   - Run 1 cycle with tournaments enabled
   - Check session log for any errors
   - Verify matches were created

2. **Ongoing Testing:**
   - Run cycles as needed to progress time
   - Monitor repair costs and user balances via Bankruptcy Monitor
   - Check tournament progression

3. **Debugging:**
   - Use individual operations to isolate issues
   - Check battle details for combat problems (both 1v1 and 2v2)
   - Review session log for error patterns

### Performance Tips

- Running 10+ cycles may take several minutes
- Session log updates in real-time
- Each tab manages its own data refresh
- Use browser console for detailed backend logs

### Common Issues

**No matches created:**
- Check if robots are battle-ready (HP ≥ 80%)
- Verify robots have weapons equipped
- Ensure league instances have enough robots

**Battles failing:**
- Check robot HP levels
- Verify weapon configurations
- Review combat logs for errors

**Users going bankrupt:**
- Use the Bankruptcy Monitor tab to track at-risk users
- Monitor repair costs vs. battle rewards
- Check facility operating costs
- Adjust economic balance if needed

**Tag team battles not appearing:**
- Ensure tag team battles have been executed (odd cycles)
- Select "Tag Team" or "All" in the Battle Type filter
- Verify tag team matchmaking has run

## Keyboard Shortcuts

- None currently (future enhancement)

## Related Documentation

- [Cycle Process Details](../implementation_notes/CYCLE_PROCESS.md)
- [Tournament System](../prd_core/PRD_TOURNAMENT_SYSTEM.md)
- [Matchmaking System](../prd_core/PRD_MATCHMAKING.md)
- [Economy System](../prd_core/PRD_ECONOMY_SYSTEM.md)
- [Admin Page PRD](../prd_pages/PRD_ADMIN_PAGE.md)
