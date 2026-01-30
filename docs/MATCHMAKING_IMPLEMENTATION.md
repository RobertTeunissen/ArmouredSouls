# Matchmaking System - Implementation Summary

**Date**: January 30, 2026  
**Status**: Ready for Implementation  
**All Decisions**: See [MATCHMAKING_DECISIONS.md](MATCHMAKING_DECISIONS.md)

---

## Overview

This document summarizes all owner decisions and provides a clear implementation roadmap for the Matchmaking System.

---

## Executive Summary of Decisions

### ✅ Approved as Recommended (9 decisions)
1. **Promotion/Demotion**: 10%
2. **Recent Opponents**: Soft deprioritize
3. **Same-Stable**: Strongly deprioritize in leagues
4. **Battle Readiness**: All weapons required
5. **Warnings**: Display on all pages
6. **Daily Flow**: 24-hour adjustment period
7. **Practice Sword**: 3sec cooldown, free
8. **Auto-Repair**: With costs and discounts
9. **Battle Type Field**: Add to Battle model

### ⚠️ Modified from Recommendations (5 decisions)
1. **League Instances**: 100 per instance with auto-balancing (not single instance)
2. **Admin Portal**: Separate dashboard (not simple page in app)
3. **Odd Robots**: Bye-robot with rewards (not rotating sit-out)
4. **Test Robot Names**: Creative thematic names (not "Test Bot 001")
5. **Draw Mechanics**: Max time adjustable (confirmed with note)

### ✨ New Details Provided (5 decisions)
1. **Battle Log**: Action-by-action with textual descriptions
2. **UI - Last 5 Matches**: Per robot, grouped
3. **UI - Match History**: Separate tab on robot detail
4. **UI - League Standings**: All 6 tiers, highlight player's
5. **UI - Robot Highlights**: Flexible styling (bold + background + icon)

---

## Critical Implementation Changes

### 1. League Instance System (Complex)

**Decision**: 100 robots per instance with auto-balancing

**Implementation Requirements**:
```typescript
interface LeagueInstance {
  leagueId: string;        // e.g., "bronze_1", "bronze_2"
  tier: string;            // "bronze", "silver", etc.
  instanceNumber: number;   // 1, 2, 3, etc.
  maxRobots: 100;
  currentRobots: number;
  isFull: boolean;
}
```

**Key Algorithms**:

**A. Instance Creation**:
- When a league tier reaches 100 robots, create next instance
- Redistribute robots when new instance opens (optional approach)

**B. New Robot Placement**:
```typescript
function assignLeagueInstance(tier: string): string {
  const instances = getInstancesForTier(tier);
  
  // Find instance with most free spots
  const leastFull = instances.sort((a, b) => 
    a.currentRobots - b.currentRobots
  )[0];
  
  if (leastFull.currentRobots >= 100) {
    // Create new instance
    const nextNumber = instances.length + 1;
    return `${tier}_${nextNumber}`;
  }
  
  return leastFull.leagueId;
}
```

**C. Promotion/Demotion Balancing**:
```typescript
function rebalanceAfterPromotions(tier: string) {
  const instances = getInstancesForTier(tier);
  const totalRobots = sum(instances.map(i => i.currentRobots));
  
  // Check if rebalancing needed
  const avgPerInstance = totalRobots / instances.length;
  const imbalanceThreshold = 20; // robots
  
  if (maxDeviation(instances) > imbalanceThreshold) {
    redistributeRobots(instances);
  }
}
```

**D. Matchmaking Preference**:
```typescript
function findOpponent(robot: Robot): Robot | null {
  // 1. Try same instance first
  let opponent = findInSameInstance(robot);
  if (opponent) return opponent;
  
  // 2. Try adjacent instances
  opponent = findInAdjacentInstances(robot);
  if (opponent) return opponent;
  
  // 3. Last resort: any instance in tier
  return findInAnyInstance(robot);
}
```

### 2. Bye-Robot System

**Decision**: Match odd-numbered robots with bye-robot (ELO 1000, full rewards)

**Implementation Requirements**:
```typescript
interface ByeRobot {
  id: number;              // Special ID (e.g., -1)
  name: "Bye Robot";
  elo: 1000;
  // All attributes set to minimum viable
  // Not a real user robot
}
```

**Battle Simulation**:
- Bye-robot has predictable, low stats
- Player robot should win easily
- Full battle rewards (credits) awarded
- ELO gain minimal (opponent is only 1000)

**Key Logic**:
```typescript
function handleOddNumberMatchmaking(eligibleRobots: Robot[]): Match[] {
  const matches = [];
  
  while (eligibleRobots.length > 1) {
    const [robot1, robot2] = selectBestPair(eligibleRobots);
    matches.push({ robot1, robot2 });
    remove(eligibleRobots, robot1, robot2);
  }
  
  // One robot left
  if (eligibleRobots.length === 1) {
    const robot = eligibleRobots[0];
    matches.push({ 
      robot1: robot, 
      robot2: BYE_ROBOT,
      isByeMatch: true 
    });
  }
  
  return matches;
}
```

### 3. Admin Dashboard (Separate Portal)

**Decision**: Separate admin dashboard, not embedded in main app

**Implementation Requirements**:
- Separate React app or admin section
- Protected by admin-only authentication
- Features needed:
  - Trigger matchmaking
  - Trigger battles
  - Trigger league rebalancing
  - Bulk cycle execution (up to 100 cycles)
  - Auto-repair toggle
  - View system stats
  - Monitor active battles
  - Test data generation

**URL Structure**:
```
Main App:     https://armouredsouls.com/
Admin Portal: https://admin.armouredsouls.com/
              or
              https://armouredsouls.com/admin/
```

### 4. Battle Readiness - Comprehensive Weapon Check

**Decision**: All loadout weapon slots must be filled

**Implementation**:
```typescript
function calculateBattleReadiness(robot: Robot): boolean {
  // HP Check
  const hpCheck = (robot.currentHP / robot.maxHP) >= 0.75;
  if (!hpCheck) return false;
  
  // Weapon Check by Loadout Type
  switch (robot.loadoutType) {
    case 'single':
      return robot.mainWeaponId !== null;
      
    case 'dual_wield':
      return robot.mainWeaponId !== null && 
             robot.offhandWeaponId !== null;
      
    case 'weapon_shield':
      return robot.mainWeaponId !== null && 
             robot.offhandWeaponId !== null &&
             isShield(robot.offhandWeapon);
      
    case 'two_handed':
      return robot.mainWeaponId !== null &&
             isTwoHanded(robot.mainWeapon);
      
    default:
      return false;
  }
}
```

### 5. Test Data - Creative Robot Names

**Decision**: 100 test robots with thematic names

**Implementation**: Generate creative names following game theme

**Name Categories**:
- Gladiator theme: "Iron Gladiator", "Steel Champion", "Bronze Warrior"
- Tech theme: "Cyber Sentinel", "Plasma Core", "Quantum Striker"
- Elemental: "Thunder Bolt", "Frost Titan", "Inferno Guard"
- Combat roles: "Battle Forged", "War Machine", "Combat Protocol"
- Legendary: "Valiant Knight", "Apex Predator", "Supreme Commander"

**Generator**:
```typescript
const prefixes = [
  "Iron", "Steel", "Titanium", "Cyber", "Plasma", "Quantum",
  "Thunder", "Lightning", "Frost", "Inferno", "Shadow", "Light",
  "Battle", "War", "Combat", "Strike", "Guard", "Shield",
  "Alpha", "Beta", "Gamma", "Delta", "Omega", "Prime"
];

const suffixes = [
  "Gladiator", "Warrior", "Champion", "Sentinel", "Guardian",
  "Striker", "Destroyer", "Crusher", "Breaker", "Reaper",
  "Titan", "Colossus", "Behemoth", "Juggernaut", "Warlord",
  "Knight", "Paladin", "Vanguard", "Enforcer", "Protector"
];

function generateRobotName(): string {
  const prefix = random(prefixes);
  const suffix = random(suffixes);
  return `${prefix} ${suffix}`;
}
```

---

## Database Schema Updates Required

### 1. Battle Model - Add battleType

```prisma
model Battle {
  // ... existing fields ...
  
  battleType      String   @map("battle_type") @db.VarChar(20)   // "league", "tournament", "friendly"
  
  // ... rest of fields ...
}
```

### 2. Robot Model - Update leagueId for instances

```prisma
model Robot {
  // ... existing fields ...
  
  currentLeague   String  @default("bronze") @db.VarChar(20)     // bronze/silver/gold/etc.
  leagueId        String  @default("bronze_1") @db.VarChar(30)   // Specific instance: bronze_1, bronze_2
  
  // ... rest of fields ...
  
  @@index([currentLeague, leagueId])
}
```

### 3. New: ByeRobot Entry

Add special robot for bye matches:
```sql
INSERT INTO robots (
  id, userId, name, elo,
  -- All attributes = 1
  currentHP, maxHP, currentShield, maxShield,
  -- etc.
) VALUES (
  -1, -1, 'Bye Robot', 1000,
  10, 10, 2, 2,
  -- minimal stats
);
```

### 4. Weapon - Practice Sword

```sql
INSERT INTO weapons (
  name, weaponType, baseDamage, cooldown, cost,
  handsRequired, damageType, loadoutType,
  -- All bonus fields = 0
) VALUES (
  'Practice Sword', 'melee', 5, 3, 0,
  'one', 'melee', 'single',
  -- 0, 0, 0, ... for all bonuses
);
```

---

## UI Implementation Requirements

### 1. Dashboard - Last 5 Matches

**Layout**:
```
DASHBOARD
├─ My Robots
│  ├─ [Robot 1 Name] ▼
│  │  └─ Last 5 Matches
│  │     ├─ Match 1 (Win vs Opponent A)
│  │     ├─ Match 2 (Loss vs Opponent B)
│  │     └─ ...
│  │
│  └─ [Robot 2 Name] ▼
│     └─ Last 5 Matches
│        └─ ...
```

**Features**:
- Expandable/collapsible per robot
- Click match to see details
- Visual indicators (Win ✅, Loss ❌, Draw 🤝)

### 2. Robot Detail - Match History Tab

**Tab Structure**:
```
ROBOT DETAIL PAGE
├─ [Overview] [Attributes] [Loadout] [Match History] ← NEW TAB
```

**Match History Tab Content**:
- Full paginated battle history
- Same format as main Battle History page
- Filters: date range, result type
- Shows 20 matches per page

### 3. League Standings - All Tiers

**Tab Structure**:
```
LEAGUE STANDINGS
[Bronze] [Silver] [Gold] [Platinum] [Diamond] [Champion]
   ↑
Active (player has robots here)
```

**Per Tier View**:
- Top 100 robots shown by default
- Player's robots highlighted:
  - **Bold name**
  - Light background color
  - Icon badge (🎯 or similar)
- Promotion zone (top 10%): 🟢 green highlight
- Demotion zone (bottom 10%): 🔴 red highlight

### 4. Battle Results - Promotion/Demotion Badges

**For League Matches Only**:
```
BATTLE RESULT
┌─────────────────────────────────────┐
│ ✅ VICTORY                          │
│ BattleBot Alpha vs Iron Crusher     │
│ ELO: 1250 → 1265 (+15)             │
│ 🏆 PROMOTED TO SILVER!              │ ← NEW BADGE
└─────────────────────────────────────┘
```

**Badge Types**:
- 🏆 PROMOTED TO [TIER]!
- ⬇️ DEMOTED TO [TIER]
- No badge if no tier change

### 5. Battle Readiness Warnings

**Robot List Page**:
```
MY ROBOTS
├─ BattleBot Alpha  ✅ Ready
├─ Steel Destroyer  ⚠️ Not Ready (Low HP)    ← WARNING
└─ Iron Crusher     ⚠️ Not Ready (No Weapon) ← WARNING
```

**Robot Detail Page**:
```
┌─────────────────────────────────────────────┐
│ ⚠️ WARNING: Robot Not Battle Ready          │
│ • HP below 75% (need repair)                │
│ • No main weapon equipped                   │
│ [Repair Now] [Equip Weapon]                 │
└─────────────────────────────────────────────┘
```

**Dashboard**:
```
NOTIFICATIONS
⚠️ 2 robots not battle ready
   → Steel Destroyer (Low HP)
   → Iron Crusher (No Weapon)
[View Robots]
```

---

## API Endpoints - New/Updated

### Matchmaking & Scheduling

```typescript
// Admin only
POST /api/admin/matchmaking/run
POST /api/admin/battles/run
POST /api/admin/leagues/rebalance
POST /api/admin/cycles/bulk
  Body: { cycles: number, autoRepair: boolean }

// Public
GET  /api/matches/upcoming
GET  /api/matches/history?page=1&perPage=20&robotId=123
GET  /api/leagues/:tier/standings?instance=1
GET  /api/robots/:id/matches?page=1&perPage=20
```

### Battle Readiness

```typescript
GET  /api/robots/:id/battle-readiness
  Returns: { 
    ready: boolean, 
    reasons: string[],
    hpCheck: boolean,
    weaponCheck: boolean
  }
  
GET  /api/robots/my/readiness-status
  Returns: Array of robot readiness statuses
```

### League Instances

```typescript
GET  /api/leagues/:tier/instances
  Returns: List of all instances for tier
  
GET  /api/leagues/:tier/:instance/robots
  Returns: Robots in specific instance
```

---

## Implementation Phases (Updated)

### Phase 1: Database & Core Models (6 hours)
- [x] Add ScheduledMatch model
- [ ] Add battleType to Battle model
- [ ] Update Robot leagueId handling for instances
- [ ] Create Bye-Robot entry
- [ ] Add Practice Sword weapon
- [ ] Generate 100 test users with creative names
- [ ] Run migrations

### Phase 2: League Instance System (10 hours)
- [ ] Instance creation logic
- [ ] Robot placement algorithm
- [ ] Promotion/demotion balancing
- [ ] Instance preference in matchmaking
- [ ] Unit tests

### Phase 3: Matchmaking Algorithm (8 hours)
- [ ] Build queue with battle readiness checks
- [ ] ELO-based pairing within instances
- [ ] Recent opponent tracking (last 5)
- [ ] Same-stable deprioritization
- [ ] Bye-robot matching for odd numbers
- [ ] Unit tests

### Phase 4: Battle Readiness System (5 hours)
- [ ] Comprehensive weapon validation
- [ ] HP threshold checks
- [ ] API endpoints
- [ ] Warning system
- [ ] Unit tests

### Phase 5: Battle Execution (6 hours)
- [ ] Battle orchestrator
- [ ] Execute from scheduled matches
- [ ] Bye-robot battle simulation
- [ ] Update robot stats
- [ ] Award rewards
- [ ] Integration tests

### Phase 6: League Rebalancing (6 hours)
- [ ] Promotion/demotion (10%)
- [ ] Instance balancing after changes
- [ ] League point reset
- [ ] Edge case handling
- [ ] Tests

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
- [ ] Battle history with pagination
- [ ] League standings by instance
- [ ] Robot match history
- [ ] Battle readiness endpoints
- [ ] Tests

### Phase 9: Frontend UI (14 hours)
- [ ] Dashboard: Last 5 matches per robot
- [ ] Robot Detail: Match History tab
- [ ] League Standings: All tiers with highlights
- [ ] Battle Results: Promotion/Demotion badges
- [ ] Battle Readiness: Warnings on all pages
- [ ] Battle Detail: Action-by-action log display

### Phase 10: Battle Log System (6 hours)
- [ ] Implement combat message generation
- [ ] Action-by-action logging
- [ ] Textual descriptions
- [ ] JSON structure
- [ ] Detail view UI

### Phase 11: Testing & Polish (8 hours)
- [ ] Integration tests
- [ ] Load testing with 100 users
- [ ] Edge case testing
- [ ] UI polish
- [ ] Documentation

**Total Estimated Effort**: ~87 hours (vs original 50 hours)

**Increase due to**:
- League instance complexity (+15 hours)
- Separate admin dashboard (+8 hours)
- Bye-robot system (+4 hours)
- Enhanced battle readiness (+3 hours)
- Battle log system (+6 hours)

---

## Testing Strategy

### Unit Tests
- League instance management
- Matchmaking algorithm
- Battle readiness validation
- ELO calculations
- Message generation

### Integration Tests
- Complete daily cycle (matchmaking → battles → rebalancing)
- 100-robot stress test
- Instance balancing scenarios
- Bye-robot matching

### E2E Tests
- User views upcoming matches
- User sees promotion badge
- User receives battle readiness warning
- Admin triggers bulk cycles

---

## Risk Assessment

### High Risk
1. **League Instance Balancing** - Complex logic, many edge cases
2. **Admin Dashboard** - Separate deployment, more infrastructure
3. **100-Robot Testing** - Requires significant seed data

### Medium Risk
1. **Bye-Robot System** - New concept, needs careful design
2. **Battle Log Messages** - Large catalog, context selection
3. **UI Complexity** - Multiple warning locations

### Low Risk
1. **10% Promotion** - Simple percentage change
2. **Battle Type Field** - Straightforward addition
3. **Practice Sword** - Basic weapon entry

---

## Next Steps

1. ✅ All decisions documented
2. ✅ Combat message catalog created
3. ⏳ Update PRD_MATCHMAKING.md with decisions
4. ⏳ Update QUICK_REFERENCE_MATCHMAKING.md
5. ⏳ Begin Phase 1 implementation
6. ⏳ Create detailed tickets for each phase

**Status**: Ready to update PRD and begin implementation

