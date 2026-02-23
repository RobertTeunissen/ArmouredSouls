# Admin Panel Guide

## Overview

The Admin Panel provides tools for managing the game's daily cycle, tournaments, and system operations. Access it at `/admin` (requires admin role).

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

**Location:** Admin Panel → Dashboard Tab

**Controls:**
- **Cycles to Run:** 1-100 (default: 1)
- **Include Tournaments:** Enable/disable tournament processing (default: enabled)
- **Generate Users Per Cycle:** Auto-create N users per cycle where N = cycle number (default: disabled)

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

## Tournaments Tab

### Tournament Management

**Create Tournament:**
- Set tournament name
- Choose number of participants (power of 2: 4, 8, 16, 32, 64)
- System auto-selects top robots by ELO

**Active Tournaments:**
- View current round and progress
- See bracket structure
- Execute next round manually
- Complete tournament when finished

**Tournament History:**
- View past tournaments
- See winners and participants
- Review tournament statistics

## Battles Tab

### Battle History

**Filters:**
- League Type: All, Bronze, Silver, Gold, Platinum, Diamond
- Battle Type: All, League, Tournament
- Search: Robot names or usernames

**Battle Details:**
- Click any battle to see full combat log
- View round-by-round actions
- See damage dealt, HP changes, ELO changes
- Review rewards and costs

## Stats Tab

### System Statistics

**Robots:**
- Total robots by tier
- Battle-ready percentage
- Average ELO by league

**Matches:**
- Scheduled matches count
- Completed matches count

**Battles:**
- Last 24 hours activity
- Total battles
- Draw percentage
- Kill percentage
- Average duration

**Finances:**
- Total credits in system
- Average user balance
- Users at bankruptcy risk

**Facilities:**
- Most popular facilities
- Average facility levels
- Total purchases

**Combat Stats:**
- Stance distribution
- Loadout type distribution
- Yield threshold patterns

## Best Practices

### Testing Workflow

1. **Initial Setup:**
   - Run 1 cycle with tournaments enabled
   - Check session log for any errors
   - Verify matches were created

2. **Ongoing Testing:**
   - Run cycles as needed to progress time
   - Monitor repair costs and user balances
   - Check tournament progression

3. **Debugging:**
   - Use individual operations to isolate issues
   - Check battle details for combat problems
   - Review session log for error patterns

### Performance Tips

- Running 10+ cycles may take several minutes
- Session log updates in real-time
- Stats refresh automatically after operations
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
- Monitor repair costs vs. battle rewards
- Check facility operating costs
- Adjust economic balance if needed

## Keyboard Shortcuts

- None currently (future enhancement)

## Related Documentation

- [Cycle Process Details](./CYCLE_PROCESS.md)
- [Tournament System](./prd_core/PRD_TOURNAMENT_SYSTEM.md)
- [Matchmaking System](./prd_core/PRD_MATCHMAKING.md)
- [Economy System](./prd_core/PRD_ECONOMY_SYSTEM.md)
