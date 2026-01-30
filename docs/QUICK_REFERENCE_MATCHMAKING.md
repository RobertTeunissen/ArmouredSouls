# Matchmaking System - Quick Reference Guide

**Version**: 2.0  
**Last Updated**: January 30, 2026  
**Status**: ✅ All Decisions Finalized  
**Full PRD**: [PRD_MATCHMAKING.md](PRD_MATCHMAKING.md)  
**Decisions**: [MATCHMAKING_DECISIONS.md](MATCHMAKING_DECISIONS.md)  
**Technical Specs**: [MATCHMAKING_IMPLEMENTATION.md](MATCHMAKING_IMPLEMENTATION.md)  
**Combat Messages**: [COMBAT_MESSAGES.md](COMBAT_MESSAGES.md)

---

## Overview

Quick reference for implementing and understanding the Matchmaking System in Armoured Souls.

---

## Daily Cycle Flow

```
┌─────────────────────────────────────────────────┐
│  1. RUN BATTLES                                  │
│     Execute all scheduled matches               │
│     Update robot stats (ELO, HP, league points) │
│     Award rewards (credits, fame)               │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  2. REBALANCE LEAGUES                           │
│     Promote top 10% of each league              │
│     Demote bottom 10% of each league            │
│     Balance instances if deviation >20          │
│     Reset league points                         │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  3. MATCHMAKING FOR NEXT CYCLE                  │
│     Build queue (battle-ready robots)          │
│     Pair robots by ELO within leagues          │
│     Schedule matches for next day              │
└─────────────────────────────────────────────────┘
```

---

## Matchmaking Algorithm (Quick Version)

**Step 1: Build Queue**
- Filter: Battle readiness ≥75%, not already scheduled
  - HP ≥75% of maximum
  - All required weapons equipped (by loadout type)
- Sort: League points DESC → ELO DESC → Random

**Step 2: Pair Robots**
- Try ±150 ELO match (within same league instance)
- Fallback: ±300 ELO match (can use adjacent instance)
- Last resort: Closest available opponent
- Soft deprioritize: Same-owner matchups, recent opponents (last 5)
- Odd numbers: Match with bye-robot (ELO 1000, full rewards)

**Step 3: Create Scheduled Matches**
- Insert into ScheduledMatch table
- Set scheduledFor to next cycle time (24 hours ahead)
- Status: 'scheduled'

---

## League Progression

### Points System
- **Win**: +3 points
- **Draw**: +1 point (battle exceeds max time ~60s)
- **Loss**: -1 point (min 0)
- **Upset Bonus**: +1 (beat >200 ELO higher)
- **Upset Penalty**: -1 (lose to >300 ELO lower)

### Promotion/Demotion
- **Promotion**: Top 10% of league (min 5 battles)
- **Demotion**: Bottom 10% of league (min 5 battles)
- **League Points**: Reset to 0 after tier change
- **ELO**: Carries over between leagues

### League Instances
- **Max per instance**: 100 robots
- **Matchmaking**: Prefers same instance (bronze_1 vs bronze_1)
- **Fallback**: Adjacent instances if needed
- **Auto-balancing**: When deviation >20 robots after promotions
- **New robots**: Placed in instance with most free spots

### League Hierarchy
```
Champion  ← (no promotion)
   ↕
Diamond
   ↕
Platinum
   ↕
Gold
   ↕
Silver
   ↕
Bronze    ← (no demotion)
```

---

## Database Schema Additions

### ScheduledMatch Model (NEW)
```typescript
{
  id: number
  robot1Id: number
  robot2Id: number
  leagueType: string
  scheduledFor: DateTime
  status: 'scheduled' | 'completed' | 'cancelled'
  battleId: number | null  // Links to Battle after completion
}
```

### Battle Model Updates
```typescript
{
  // ... existing fields ...
  battleType: 'league' | 'tournament' | 'friendly'  // NEW
}
```

### Robot Model Updates
```typescript
{
  // ... existing fields ...
  currentLeague: string      // bronze/silver/gold/etc.
  leagueId: string           // Specific instance: bronze_1, bronze_2, etc.
  
  // Relations
  scheduledMatchesAsRobot1: ScheduledMatch[]
  scheduledMatchesAsRobot2: ScheduledMatch[]
}
```

### New Entries
- **Bye-Robot**: Special robot (id: -1, ELO 1000) for odd-numbered matchmaking
- **Practice Sword**: Free weapon (3sec cooldown, 5 damage, no bonuses) for testing

---

## API Endpoints

### Admin (Prototype Phase - Separate Dashboard)
- `POST /api/admin/matchmaking/run` - Run matchmaking
- `POST /api/admin/battles/run` - Execute battles
- `POST /api/admin/leagues/rebalance` - Rebalance leagues
- `POST /api/admin/cycles/bulk` - Run multiple cycles (up to 100)
  - With auto-repair, cost deduction, facility discounts
- `POST /api/admin/schedule/run-daily-cycle` - Full cycle

### Public (Players)
- `GET /api/matches/upcoming` - View scheduled matches
- `GET /api/matches/history` - View battle history (paginated)
- `GET /api/leagues/:tier/standings` - View league standings (supports instances)
- `GET /api/robots/:id/matches` - View robot's match history
- `GET /api/robots/:id/battle-readiness` - Check battle readiness
- `GET /api/robots/my/readiness-status` - All user's robot statuses

---

## UI Components

### Dashboard - Upcoming Matches
Shows:
- Your robot vs opponent
- ELO ratings
- League instance (e.g., Bronze 1)
- Scheduled day and time
- Countdown timer

### Dashboard - Last 5 Matches per Robot
Shows:
- Grouped by robot (expandable/collapsible)
- Last 5 matches per robot
- Win/Loss/Draw with ELO change
- Click to view detailed battle log

### Robot Detail Page - Match History Tab
New tab showing:
- Full paginated match history for this robot
- Filters: date range, result type
- 20 matches per page
- Same format as main Battle History

### Battle History Page
Shows:
- Win/Loss/Draw with visual indicators
- ELO change
- Damage dealt/taken
- Rewards earned
- Battle type (League/Tournament/Friendly)
- Promotion/Demotion badges (for league matches)
- Pagination (20/page)

### League Standings Page
Shows:
- All 6 league tiers in tabs
- Highlight tabs with player's active robots
- Rank, robot name, owner
- ELO, league points, W-L record
- Player's own robots: Bold + background + icon (🎯)
- Promotion zone (🟢 top 10%)
- Demotion zone (🔴 bottom 10%)

### Battle Readiness Warnings
Display on:
- **Robot List**: Icon/badge next to non-ready robots
- **Robot Detail**: Banner at top with specific issues
- **Dashboard**: Notification area with count and actions

---

## First Day Initialization

**Problem**: No historical data, all robots new

**Solution**:
1. All robots start in Bronze, ELO 1200
2. First matchmaking uses ELO only
3. Random pairings within ELO range
4. After first battle, normal cycle begins

**Special Rules**:
- First 3 battles: Stricter ELO matching (±100)
- Match new robots against new robots when possible
- Bonus credits for first battle (win or lose)

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Same-owner matching** | Strongly deprioritize (allow as last resort) | Flexible for small player base, tournaments need it |
| **Battles per day** | 1 per robot | Simple, manageable for Phase 1 |
| **Unmatched robots** | Bye-robot match (ELO 1000, full rewards) | Every robot fights, no sitting out |
| **League instances** | 100 per instance, auto-balance | Manageable size, promotes familiarity |
| **Battle schedule** | 24-hour cycle with admin triggers | Ample adjustment time, flexible testing |
| **Promotion/Demotion** | 10% (was 20%) | Slower, more stable progression |
| **Draw mechanics** | Max battle time (~60s) | Prevents infinite stalemates |
| **Battle readiness** | HP ≥75% + all weapons | Complete loadout validation |
| **Recent opponents** | Soft deprioritize last 5 | Adds variety, avoids deadlocks |
| **Admin portal** | Separate dashboard | Comprehensive testing tools |

---

## Battle Log System

**Format**: Action-by-action with timestamps and textual descriptions

**Example Messages**:
- "⚡ BattleBot Alpha's Laser Rifle penetrates Iron Crusher's shield! 30 shield damage, 15 hull damage!"
- "💥 Iron Crusher strikes BattleBot Alpha with Power Sword for 28 damage!"
- "🏳️ Iron Crusher yields! Battle ends with BattleBot Alpha victorious!"

**Full Catalog**: See [COMBAT_MESSAGES.md](COMBAT_MESSAGES.md) for 100+ message templates

---

## Implementation Checklist

### Phase 1: Database & Core Models (6 hours)
- [ ] Add battleType field to Battle model
- [ ] Update Robot leagueId for instances
- [ ] Add ScheduledMatch model to Prisma schema
- [ ] Add robot relations
- [ ] Create Bye-Robot entry (id: -1)
- [ ] Add Practice Sword weapon
- [ ] Generate 100 test users with creative names
- [ ] Run migrations

### Phase 2: League Instance System (10 hours)
- [ ] Instance creation logic (max 100)
- [ ] Robot placement algorithm
- [ ] Promotion/demotion balancing
- [ ] Instance preference in matchmaking
- [ ] Auto-balancing logic
- [ ] Unit tests

### Phase 3: Matchmaking Algorithm (8 hours)
- [ ] Queue building with battle readiness (HP + weapons)
- [ ] ELO-based pairing within instances
- [ ] Recent opponent tracking (last 5)
- [ ] Same-stable deprioritization
- [ ] Bye-robot matching for odd numbers
- [ ] Unit tests

### Phase 4: Battle Readiness System (5 hours)
- [ ] Comprehensive weapon validation
- [ ] HP threshold checks
- [ ] API endpoints
- [ ] Warning system (3 locations)
- [ ] Unit tests

### Phase 5: Battle Execution (6 hours)
- [ ] Battle orchestrator
- [ ] Execute from scheduled matches
- [ ] Bye-robot simulation
- [ ] Update robot stats
- [ ] Award rewards

### Phase 6: League Rebalancing (6 hours)
- [ ] Promotion/demotion (10% thresholds)
- [ ] Instance balancing
- [ ] League point reset
- [ ] Min 5 battles check
- [ ] Edge case handling

### Phase 7: Admin Dashboard (12 hours)
- [ ] Separate admin portal setup
- [ ] Authentication
- [ ] Matchmaking trigger UI
- [ ] Battle execution UI
- [ ] Bulk cycle execution (up to 100)
- [ ] Auto-repair controls
- [ ] System monitoring

### Phase 8: Public API Endpoints (6 hours)
- [ ] Upcoming matches
- [ ] Battle history (paginated)
- [ ] League standings (instance support)
- [ ] Robot matches
- [ ] Battle readiness endpoints
- [ ] Tests

### Phase 9: Frontend UI (14 hours)
- [ ] Dashboard: Last 5 matches per robot
- [ ] Dashboard: Upcoming matches
- [ ] Robot Detail: Match History tab
- [ ] Battle History page
- [ ] League Standings: All 6 tiers, highlights
- [ ] Battle results: Promotion/Demotion badges
- [ ] Battle readiness: Warnings on all pages
- [ ] Battle detail: Action log display

### Phase 10: Battle Log System (6 hours)
- [ ] Combat message generation
- [ ] Action-by-action logging
- [ ] Textual descriptions
- [ ] JSON structure
- [ ] Detail view UI

### Phase 11: Testing & Polish (8 hours)
- [ ] First day initialization
- [ ] Various robot counts
- [ ] Instance balancing scenarios
- [ ] Bye-robot matching
- [ ] Load test (100 users)
- [ ] Complete daily cycle
- [ ] Edge cases
- [ ] UI polish

**Total**: ~87 hours (was 50)

### Phase 6: Public Endpoints (6 hours)
- [ ] Upcoming matches API
- [ ] Battle history API
- [ ] League standings API
- [ ] Tests

### Phase 7: Frontend (10 hours)
- [ ] Upcoming matches component
- [ ] Battle history page
- [ ] League standings page
- [ ] Match details modal

### Phase 8: Testing (6 hours)
- [ ] First day scenario
- [ ] Edge cases
- [ ] Load testing
- [ ] Integration tests

**Total**: ~50 hours

---

## Edge Cases to Test

- Odd number of robots (one sits out)
- No suitable opponent (skip cycle)
- Same owner matching (allowed but rare)
- Robot damaged mid-schedule (cancel match)
- Small league population (<5 robots)
- Tied league points (ELO tiebreaker)
- System downtime during cycle (catch-up)
- Database transaction failures (rollback)

---

## Performance Targets

- **Matchmaking**: <10 seconds for 100 robots
- **Battle Execution**: <5 seconds per battle
- **League Rebalancing**: <5 seconds per league
- **Full Daily Cycle**: <2 minutes for 100 robots

---

## Monitoring Metrics

- Average time to find match
- % robots matched per cycle
- Average ELO difference in matches
- Battles completed per cycle
- Promotion/demotion rates
- Player engagement (battles/week)

---

## Common Questions

**Q: What if a robot can't find a match?**  
A: Matched with bye-robot (ELO 1000). Gets full rewards but low ELO gain.

**Q: Can I challenge a specific opponent?**  
A: Not in Phase 1. Future enhancement.

**Q: How do I know when my next battle is?**  
A: Check "Upcoming Matches" on dashboard (24 hours before battle time).

**Q: What if my robot gets promoted?**  
A: Moves to next league tier, league points reset to 0, ELO carries over. May change instance if balancing needed.

**Q: Can two of my robots fight each other?**  
A: Strongly deprioritized but allowed as last resort in small leagues.

**Q: What happens with draws?**  
A: Battle ends in draw if max time reached (~60 seconds). Both get +1 league point.

---

## Related Documentation

- **[PRD_MATCHMAKING.md](PRD_MATCHMAKING.md)** - Full Product Requirements Document
- **[MATCHMAKING_DECISIONS.md](MATCHMAKING_DECISIONS.md)** - All Owner Decisions
- **[MATCHMAKING_IMPLEMENTATION.md](MATCHMAKING_IMPLEMENTATION.md)** - Technical Specifications
- **[COMBAT_MESSAGES.md](COMBAT_MESSAGES.md)** - Battle Log Message Catalog
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Battle Simulation Architecture
- **[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)** - Complete Database Schema
- **[ROADMAP.md](ROADMAP.md)** - Phase 1 Milestones

---

**For detailed technical specifications, see [MATCHMAKING_IMPLEMENTATION.md](MATCHMAKING_IMPLEMENTATION.md)**
