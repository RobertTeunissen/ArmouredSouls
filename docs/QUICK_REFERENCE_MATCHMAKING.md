# Matchmaking System - Quick Reference Guide

**Version**: 1.0  
**Last Updated**: January 30, 2026  
**Full PRD**: [PRD_MATCHMAKING.md](PRD_MATCHMAKING.md)

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
│     Promote top 20% of each league             │
│     Demote bottom 20% of each league           │
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
- Filter: Battle readiness ≥50%, not already scheduled
- Sort: League points DESC → ELO DESC → Random

**Step 2: Pair Robots**
- Try ±150 ELO match
- Fallback: ±300 ELO match
- Last resort: Closest available opponent
- Skip same-owner matchups (deprioritize, not block)

**Step 3: Create Scheduled Matches**
- Insert into ScheduledMatch table
- Set scheduledFor to next cycle time
- Status: 'scheduled'

---

## League Progression

### Points System
- **Win**: +3 points
- **Draw**: +1 point
- **Loss**: -1 point (min 0)
- **Upset Bonus**: +1 (beat higher ELO)
- **Upset Penalty**: -1 (lose to much lower ELO)

### Promotion/Demotion
- **Promotion**: Top 20% of league (min 5 battles)
- **Demotion**: Bottom 20% of league (min 5 battles)
- **League Points**: Reset to 0 after tier change
- **ELO**: Carries over between leagues

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

### Robot Updates (Relations)
```typescript
scheduledMatchesAsRobot1: ScheduledMatch[]
scheduledMatchesAsRobot2: ScheduledMatch[]
```

---

## API Endpoints

### Admin (Prototype Phase)
- `POST /api/admin/matchmaking/run` - Run matchmaking
- `POST /api/admin/battles/run` - Execute battles
- `POST /api/admin/leagues/rebalance` - Rebalance leagues
- `POST /api/admin/schedule/run-daily-cycle` - Full cycle

### Public (Players)
- `GET /api/matches/upcoming` - View scheduled matches
- `GET /api/matches/history` - View battle history
- `GET /api/leagues/:leagueType/standings` - View league standings
- `GET /api/robots/:id/matches` - View robot's matches

---

## UI Components

### Dashboard - Upcoming Matches
Shows:
- Your robot vs opponent
- ELO ratings
- League type
- Scheduled time

### Battle History Page
Shows:
- Win/Loss/Draw
- ELO change
- Damage dealt/taken
- Rewards earned
- Pagination (20/page)

### League Standings Page
Shows:
- Rank, robot name, owner
- ELO, league points, W-L record
- Promotion zone (🟢 top 20%)
- Demotion zone (🔴 bottom 20%)

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
| **Same-owner matching** | Allow but deprioritize | Small player base needs flexibility |
| **Battles per day** | 1 per robot | Simple, manageable for Phase 1 |
| **Unmatched robots** | Wait for next cycle | Simpler than "bye" matches |
| **League instances** | Single per tier | Sufficient for prototype |
| **Battle schedule** | Manual admin triggers | Flexible testing in prototype |

---

## Implementation Checklist

### Phase 1: Database (4 hours)
- [ ] Add ScheduledMatch model to Prisma schema
- [ ] Add robot relations
- [ ] Run migration
- [ ] Update seed script

### Phase 2: Matchmaking (8 hours)
- [ ] Queue building logic
- [ ] Pairing algorithm
- [ ] Create scheduled matches
- [ ] Unit tests

### Phase 3: Battle Execution (6 hours)
- [ ] Battle orchestrator
- [ ] Execute from scheduled matches
- [ ] Update robot stats
- [ ] Award rewards

### Phase 4: League Rebalancing (6 hours)
- [ ] Rebalancing algorithm
- [ ] Promotion/demotion logic
- [ ] League point reset
- [ ] Edge case handling

### Phase 5: Admin Endpoints (4 hours)
- [ ] Admin middleware
- [ ] Manual trigger endpoints
- [ ] Logging

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
A: It waits for the next cycle. Priority increases for robots waiting longer.

**Q: Can I challenge a specific opponent?**  
A: Not in Phase 1. Future enhancement.

**Q: How do I know when my next battle is?**  
A: Check "Upcoming Matches" on dashboard.

**Q: What if my robot gets promoted?**  
A: Moves to next league tier, league points reset to 0, ELO carries over.

**Q: Can two of my robots fight each other?**  
A: Allowed but deprioritized. System tries to avoid it.

---

## Related Documentation

- **[PRD_MATCHMAKING.md](PRD_MATCHMAKING.md)** - Full Product Requirements Document
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Battle Simulation Architecture
- **[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)** - Complete Database Schema
- **[ROADMAP.md](ROADMAP.md)** - Phase 1 Milestones

---

**For detailed technical specifications, see [PRD_MATCHMAKING.md](PRD_MATCHMAKING.md)**
