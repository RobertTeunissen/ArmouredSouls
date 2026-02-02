# Product Requirements Document: Prestige and Fame System

**Last Updated**: February 2, 2026  
**Status**: Draft - Implementation Planning  
**Owner**: Robert Teunissen  
**Epic**: Economy System - Prestige and Fame

---

## Executive Summary

This PRD defines the requirements for implementing the Prestige and Fame systems for Armoured Souls Phase 1 prototype. These dual reputation systems form the backbone of player progression and unlock mechanics, providing both stable-level (Prestige) and robot-level (Fame) advancement paths.

**Prestige** is the stable's permanent reputation score that unlocks facilities, tournaments, and content. It is earned through victories and milestones, never spent, and represents the overall success and history of the player's stable.

**Fame** is an individual robot's reputation that affects matchmaking quality, income generation, and cosmetic unlocks. It is earned through individual robot performance and creates identity for each robot in the player's roster.

**Success Criteria**: Players understand the distinction between Prestige and Fame, earn both currencies through gameplay, see meaningful benefits from accumulating reputation, and have clear visibility into unlock requirements and progress.

---

## Background & Context

### Current State

**What Exists:**
- ✅ Database schema with `prestige` field on User model (stable-level)
- ✅ Database schema with `fame` field on Robot model (robot-level)
- ✅ Prestige earning formulas documented in STABLE_SYSTEM.md (battles, tournaments, milestones)
- ✅ Prestige benefits documented in STABLE_SYSTEM.md (facility unlocks, income multipliers)
- ✅ 14 facility types with prestige-gated levels (ranging from 1,000 to 50,000 prestige)
- ✅ Income multiplier formulas that scale with prestige
- ✅ Frontend displays prestige in dashboard (prototype/frontend/src/pages/DashboardPage.tsx)
- ✅ Frontend displays fame in robot performance stats (prototype/frontend/src/components/PerformanceStats.tsx)

**What's Missing:**
- ❌ Fame earning mechanics (not yet defined beyond database field)
- ❌ Fame benefits system (how fame affects gameplay)
- ❌ Prestige earning system (backend implementation for battles/tournaments)
- ❌ UI showing prestige unlocks and progress toward next milestone
- ❌ UI showing fame benefits and individual robot reputation
- ❌ Backend API endpoints for prestige/fame tracking
- ❌ Prestige leaderboard
- ❌ Fame-based matchmaking considerations
- ❌ Visual representation of prestige tiers/ranks
- ❌ Educational tooltips explaining prestige vs fame
- ❌ Achievement system integration with prestige milestones

### Design References

- **[STABLE_SYSTEM.md](STABLE_SYSTEM.md)**: Complete prestige system documentation (lines 292-330)
- **[GAME_DESIGN.md](GAME_DESIGN.md)**: Fame as secondary progression currency (line 82)
- **[ROBOT_ATTRIBUTES.md](ROBOT_ATTRIBUTES.md)**: Individual robot fame tracking (line 126)
- **[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)**: Database structure for prestige and fame fields

### Why These Features Matter

**Prestige** provides:
- Long-term progression goals beyond currency
- Meaningful unlock system that rewards commitment
- Aspirational content for experienced players
- Stable identity and reputation in the community
- Economic benefits through income multipliers
- Access to high-tier tournaments and content

**Fame** provides:
- Individual robot identity and reputation
- Matchmaking quality improvements (famous robots attract better opponents)
- Income generation through streaming revenue
- Cosmetic unlocks and customization options
- Robot-specific progression separate from stable progression
- Incentive to maintain and upgrade individual robots

---

## Goals & Objectives

### Primary Goals

1. **Dual Reputation System**: Implement both stable-level (Prestige) and robot-level (Fame) reputation tracking
2. **Clear Earning Mechanics**: Define how players earn Prestige and Fame through gameplay
3. **Meaningful Benefits**: Provide tangible benefits for accumulating Prestige and Fame
4. **Transparent Progression**: Players can see current reputation, unlock requirements, and progress
5. **Economic Integration**: Prestige and Fame integrate with income generation and facility unlocks

### Success Metrics

- Players earn Prestige from victories and can see progression toward facility unlocks
- Players earn Fame for individual robots and understand its benefits
- 90%+ of players understand the difference between Prestige and Fame
- Prestige gates are balanced (players reach 1,000 prestige within ~50 battles)
- Fame provides meaningful benefits without creating "abandon low-fame robots" behavior
- Facility unlock progression feels rewarding and achievable
- Income multipliers create noticeable benefit from high Prestige

### Non-Goals (Out of Scope for This PRD)

- ❌ Prestige spending (Prestige is never spent, only earned)
- ❌ Fame spending (Fame is earned, not a currency to spend)
- ❌ Prestige trading between players
- ❌ Fame decay over time (future consideration)
- ❌ Guild/clan prestige (future Phase 2+ feature)
- ❌ Prestige-based matchmaking (ELO handles matchmaking)
- ❌ Detailed achievement system (separate PRD)
- ❌ Cosmetic shop implementation (separate PRD)

---

## System Overview

### Prestige System (Stable-Level)

**Definition**: Prestige is the permanent reputation score of a player's stable. It represents overall success, achievement, and history. Prestige is **never spent** - it only increases and serves as an unlock threshold for content.

**Key Characteristics**:
- Stable-wide (one value per player/user)
- Permanent (never decreases or resets)
- Earned through victories, tournaments, and milestones
- Used as unlock threshold (not spent)
- Displayed prominently in stable dashboard
- Affects income multipliers and merchandising revenue
- Unlocks facility upgrades, tournaments, and cosmetics

**Starting Value**: 0 prestige

**Maximum Value**: Unbounded (no hard cap, aspirational content at 50,000+)

### Fame System (Robot-Level)

**Definition**: Fame is the individual reputation of a specific robot. It represents that robot's performance, victories, and legacy. Fame creates identity for individual robots and affects income generation and matchmaking quality.

**Key Characteristics**:
- Robot-specific (each robot has independent fame value)
- Permanent (does not decay over time in Phase 1)
- Earned through individual robot victories and achievements
- Affects streaming income generation
- Influences matchmaking quality (famous robots attract attention)
- May unlock robot-specific cosmetics (future)
- Creates "star robot" dynamics in stable

**Starting Value**: 0 fame

**Maximum Value**: Unbounded (no hard cap)

---

## Prestige System - Detailed Specification

### Prestige Earning Mechanics

#### Battle Performance (Per Win)

**League-Based Earnings**:
```
Bronze league win:    +5 prestige
Silver league win:    +10 prestige
Gold league win:      +20 prestige
Platinum league win:  +30 prestige
Diamond league win:   +50 prestige
Champion league win:  +75 prestige
```

**Rationale**:
- Higher leagues reward more prestige (incentive to climb)
- Bronze earnings (5 per win) allow reaching 1,000 prestige in ~200 wins (achievable)
- Champion league earnings (75 per win) provide strong incentive for top-tier play
- Prestige earnings scale roughly exponentially with league tier

**Implementation Notes**:
- Prestige awarded to stable (User model) after battle resolution
- Win must be official (not sparring/practice matches)
- Draw = no prestige earned
- Loss = no prestige earned
- Yield before destruction = standard prestige if win, 0 if loss

#### Tournament Performance

**Tournament Tiers**:
```
Local tournament win:          +100 prestige
Regional tournament win:       +250 prestige
National tournament win:       +500 prestige
International tournament win:  +1,000 prestige
World Championship win:        +2,500 prestige
```

**Rationale**:
- Tournaments provide significant prestige "jumps"
- World Championship (2,500 prestige) is equivalent to ~34 Champion league wins or ~500 Bronze wins
- Creates aspirational content and goal for competitive players
- Tournament prestige supplements regular battle prestige

**Implementation Notes**:
- Tournament system is Phase 2+ feature (placeholder values for now)
- Prestige awarded upon tournament completion
- Placement rewards: 1st = full value, 2nd = 60%, 3rd = 40%, 4th-8th = 20%
- Requires Booking Office facility to access tournaments

#### Milestone Achievements

**ELO Milestones** (First robot to reach):
```
First robot to ELO 1500:  +50 prestige
First robot to ELO 1800:  +100 prestige
First robot to ELO 2000:  +200 prestige
First robot to ELO 2200:  +300 prestige
First robot to ELO 2500:  +500 prestige
```

**Win Count Milestones** (Total wins across all robots):
```
100 total wins:    +50 prestige
250 total wins:    +100 prestige
500 total wins:    +250 prestige
1,000 total wins:  +500 prestige
2,500 total wins:  +1,000 prestige
5,000 total wins:  +2,000 prestige
```

**Championship Milestones**:
```
First tournament win:       +50 prestige (bonus on top of tournament prestige)
10 tournament wins:         +200 prestige
Championship title earned:  +500 prestige
```

**Special Achievements** (Future Expansion):
```
Perfect season (20-0):        +300 prestige
Undefeated streak (50 wins): +400 prestige
Defeat higher league opponent: +25 prestige (per win)
```

**Rationale**:
- Milestones provide "bonus" prestige for notable achievements
- One-time rewards (don't repeat)
- Create memorable progression moments
- Provide alternative paths to prestige beyond grinding battles

**Implementation Notes**:
- Backend tracks milestones and awards prestige when threshold crossed
- Milestones are account-wide (stable-level)
- One-time awards (flag in database to prevent repeat awards)
- UI notification when milestone reached

### Prestige Benefits

#### Facility Unlock Requirements

**Prestige Thresholds by Facility Level** (from STABLE_SYSTEM.md):

**Repair Bay**:
- Level 4: 1,000 prestige required
- Level 7: 5,000 prestige required
- Level 9: 10,000 prestige required

**Training Facility**:
- Level 4: 1,000 prestige required
- Level 7: 5,000 prestige required
- Level 9: 10,000 prestige required

**Weapons Workshop**:
- Level 4: 1,500 prestige required
- Level 7: 5,000 prestige required
- Level 9: 10,000 prestige required

**Research Lab**:
- Level 4: 2,000 prestige required
- Level 7: 7,500 prestige required
- Level 9: 15,000 prestige required

**Medical Bay**:
- Level 4: 2,000 prestige required
- Level 7: 7,500 prestige required
- Level 9: 15,000 prestige required

**Roster Expansion**:
- Level 4: 1,000 prestige required (5 robot slots)
- Level 7: 5,000 prestige required (8 robot slots)
- Level 9: 10,000 prestige required (10 robot slots)

**Coaching Staff**:
- Level 3: 2,000 prestige required (Tactical Coach)
- Level 6: 5,000 prestige required (Improved Tactical Coach)
- Level 9: 10,000 prestige required (Improved Defensive Coach)

**Booking Office**:
- Level 1: 1,000 prestige required (Silver league tournaments)
- Level 2: 2,500 prestige required (Gold league tournaments)
- Level 3: 5,000 prestige required (Platinum tournaments)
- Level 4: 10,000 prestige required (Diamond tournaments)
- Level 5: 15,000 prestige required (Enhanced rewards)
- Level 6: 20,000 prestige required (Enhanced rewards)
- Level 7: 25,000 prestige required (Champion tournaments, hall of fame)
- Level 8: 35,000 prestige required (Enhanced rewards)
- Level 9: 45,000 prestige required (Enhanced rewards)
- Level 10: 50,000 prestige required (World Championship access)

**Training Academies** (Combat, Defense, Mobility, AI):
- Level 3: 2,000 prestige required (cap to 25)
- Level 5: 4,000 prestige required (cap to 35)
- Level 7: 7,000 prestige required (cap to 42)
- Level 9: 10,000 prestige required (cap to 48)
- Level 10: 15,000 prestige required (cap to 50)

**Income Generator**:
- Level 4: 3,000 prestige required
- Level 7: 7,500 prestige required
- Level 9: 15,000 prestige required

**Design Rationale**:
- Entry-level gates (1,000-2,000) achievable early (50-100 battles)
- Mid-tier gates (5,000-10,000) for committed players (200-500 battles)
- High-tier gates (15,000-25,000) for veteran players (1,000+ battles)
- Aspirational gates (35,000-50,000) for elite players (2,000+ battles or tournaments)
- Multiple facilities unlock at same thresholds (1,000, 5,000, 10,000) for "milestone moments"

#### Income Multipliers

**Battle Winnings Bonus**:
```
5,000+ prestige:   +5% to all battle winnings
10,000+ prestige:  +10% to all battle winnings
25,000+ prestige:  +15% to all battle winnings
50,000+ prestige:  +20% to all battle winnings
```

**Example**:
- Bronze league win base: ₡5,000 - ₡10,000
- With 10,000 prestige: ₡5,500 - ₡11,000 (10% bonus)
- Champion league win base: ₡150,000 - ₡300,000
- With 50,000 prestige: ₡180,000 - ₡360,000 (20% bonus)

**Merchandising Income Scaling**:
```
merchandising_income = base_merchandising × (1 + prestige / 10000)
```

**Example**:
- Income Generator Level 1: ₡5,000/day base
- Prestige 0: ₡5,000/day
- Prestige 5,000: ₡5,000 × (1 + 0.5) = ₡7,500/day (+50%)
- Prestige 10,000: ₡5,000 × (1 + 1.0) = ₡10,000/day (+100%)
- Prestige 25,000: ₡5,000 × (1 + 2.5) = ₡17,500/day (+250%)

**Design Rationale**:
- Battle winnings bonus provides immediate benefit (every battle)
- Merchandising scaling creates passive income incentive
- High prestige (25,000+) provides significant economic advantage
- Encourages long-term play and prestige accumulation

#### Tournament and Content Access

**Tournament Tiers** (gated by Booking Office facility + prestige):
- Bronze tournaments: No prestige required (available from start)
- Silver tournaments: 1,000 prestige required (Booking Office Level 1)
- Gold tournaments: 2,500 prestige required (Booking Office Level 2)
- Platinum tournaments: 5,000 prestige required (Booking Office Level 3)
- Diamond tournaments: 10,000 prestige required (Booking Office Level 4)
- Champion tournaments: 25,000 prestige required (Booking Office Level 7)
- World Championship: 50,000 prestige required (Booking Office Level 10)

**Hall of Fame** (Booking Office Level 7+, 25,000 prestige):
- Permanent listing in Hall of Fame
- Special profile badge
- Visible to all players

**Cosmetic Unlocks**:
- Custom paint jobs: 2,500 prestige (Booking Office Level 2)
- Exclusive weapon skins: 5,000 prestige (Booking Office Level 3)
- Legendary frame designs: 10,000 prestige (Booking Office Level 4)
- Custom arena design: 50,000 prestige (Booking Office Level 10)

#### Prestige Rank Titles

**Visual Progression Tiers**:
```
0-999:       "Novice" (no title)
1,000-4,999:   "Established"
5,000-9,999:   "Veteran"
10,000-24,999: "Elite"
25,000-49,999: "Champion"
50,000+:       "Legendary"
```

**Display**:
- Title shown next to stable name in leaderboards
- Badge icon in UI indicating tier
- Color-coded prestige display (Bronze → Gold → Platinum → Diamond)

---

## Fame System - Detailed Specification

### Fame Earning Mechanics

#### Battle Performance (Per Win)

**League-Based Earnings**:
```
Bronze league win:    +2 fame
Silver league win:    +5 fame
Gold league win:      +10 fame
Platinum league win:  +15 fame
Diamond league win:   +25 fame
Champion league win:  +40 fame
```

**Rationale**:
- Fame earned per robot (not stable-wide)
- Lower values than prestige (robot-level vs stable-level)
- Climbing leagues with same robot provides increasing fame
- Famous robots emerge through consistent performance

**Implementation Notes**:
- Fame awarded to individual robot after battle
- Only winning robot earns fame (losing robot earns 0)
- Draw = no fame earned
- Fame persists even if robot switches leagues

#### Performance Bonuses

**Dominating Victory** (win with >80% HP remaining):
- +50% fame bonus
- Example: Champion win (40 fame) + 50% = 60 fame total

**Comeback Victory** (win after dropping below 20% HP):
- +25% fame bonus
- Example: Gold win (10 fame) + 25% = 12.5 → 13 fame total

**Perfect Victory** (win without taking any HP damage):
- +100% fame bonus
- Example: Silver win (5 fame) + 100% = 10 fame total

**Streak Bonus** (consecutive wins with same robot):
```
5 win streak:  +10 fame bonus (one-time)
10 win streak: +25 fame bonus (one-time)
25 win streak: +50 fame bonus (one-time)
50 win streak: +100 fame bonus (one-time)
```

**Higher-Tier Opponent Victory**:
- Defeat opponent from higher league: +5 fame bonus
- Example: Gold robot defeats Platinum robot: 10 + 5 = 15 fame

#### Robot-Specific Milestones

**ELO Achievements** (per robot):
```
Reach ELO 1500:  +25 fame
Reach ELO 1800:  +50 fame
Reach ELO 2000:  +100 fame
Reach ELO 2200:  +150 fame
Reach ELO 2500:  +250 fame
```

**Kill Count** (opponents reduced to 0 HP):
```
10 kills:   +20 fame
25 kills:   +50 fame
50 kills:   +100 fame
100 kills:  +200 fame
250 kills:  +400 fame
```

**Battle Count**:
```
50 battles:   +15 fame
100 battles:  +30 fame
250 battles:  +75 fame
500 battles:  +150 fame
1,000 battles: +300 fame
```

**Damage Milestones**:
```
10,000 damage dealt:  +30 fame
25,000 damage dealt:  +75 fame
50,000 damage dealt:  +150 fame
100,000 damage dealt: +300 fame
```

**Rationale**:
- Robot-specific milestones create individual identity
- Multiple paths to fame (wins, kills, longevity)
- Encourages maintaining robots over time
- Famous robots have history and achievements

### Fame Benefits

#### Streaming Revenue Scaling

**Formula** (from STABLE_SYSTEM.md):
```
streaming_income = base_streaming × (1 + (total_battles / 1000)) × (1 + (total_fame / 5000))

// total_battles = sum of all robot battle counts in stable
// total_fame = sum of all robot fame values in stable
```

**Example**:
- Income Generator Level 3: ₡3,000/day base
- Robot 1: 200 battles, 500 fame
- Robot 2: 150 battles, 300 fame
- Robot 3: 100 battles, 200 fame
- Total: 450 battles, 1,000 fame

```
streaming = ₡3,000 × (1 + 450/1000) × (1 + 1000/5000)
         = ₡3,000 × 1.45 × 1.2
         = ₡5,220/day
```

**High Fame Example**:
- Income Generator Level 7: ₡10,000/day base
- 4 robots with 1,000 battles total, 10,000 fame total

```
streaming = ₡10,000 × (1 + 1.0) × (1 + 2.0)
         = ₡10,000 × 2.0 × 3.0
         = ₡60,000/day
```

**Rationale**:
- Fame directly impacts stable income
- Incentivizes building up individual robot reputations
- High-fame robots become valuable assets
- Multiple robots with moderate fame better than one super-famous robot (multiplicative scaling)

#### Matchmaking Quality

**Famous Robot Matching** (Future Enhancement):
- Robots with high fame (1,000+) attract more attention
- Higher chance of being matched against active players
- Famous robots appear in "Featured Matches" section
- Spectator mode prioritizes famous robot battles

**Implementation Notes**:
- Phase 1: Fame tracked but doesn't affect matchmaking
- Phase 2+: Fame influences matchmaking pool quality
- Never affects ELO-based fairness (ELO remains primary matchmaking factor)

#### Robot Identity & Cosmetics

**Fame Tiers** (Future Enhancement):
```
0-99:       Unknown
100-499:    Known
500-999:    Famous
1,000-2,499: Renowned
2,500-4,999: Legendary
5,000+:      Mythical
```

**Fame-Based Unlocks** (Future):
- Robot-specific titles (displayed in battle intros)
- Fame badges next to robot name
- Special entrance animations (1,000+ fame)
- Custom robot paint schemes (2,500+ fame)
- Hall of Fame robot listing (5,000+ fame)

**Rationale**:
- Creates attachment to individual robots
- "Star robot" becomes centerpiece of stable
- Encourages long-term investment in specific robots
- Cosmetic rewards for fame (not gameplay advantages)

#### Trading Value Modifier (Future Phase 2+)

**Fame Impact on Robot Trading**:
- High-fame robots have higher market value
- Fame visible in marketplace listings
- Famous robots attract premium prices
- Creates "celebrity robot" economy

**Implementation Notes**:
- Phase 2+ feature (requires marketplace)
- Fame persists when robot is traded
- New owner inherits robot's fame and history

---

## User Stories

### Epic: Prestige System

**US-1: View Current Prestige**
```
As a player
I want to see my current prestige score in the dashboard
So that I understand my stable's reputation level
```

**Acceptance Criteria**:
- Dashboard displays current prestige prominently
- Prestige value updates after battles/milestones
- Prestige rank title shown next to value
- Tooltip explains what prestige is

**US-2: Earn Prestige from Battles**
```
As a player
I want to earn prestige when my robots win battles
So that I can unlock facilities and content
```

**Acceptance Criteria**:
- Winning battles awards league-appropriate prestige
- Battle results screen shows prestige earned
- Prestige value updates in user profile
- Different leagues award different amounts

**US-3: See Prestige Unlock Requirements**
```
As a player
I want to see which facilities require prestige to unlock
So that I can plan my progression
```

**Acceptance Criteria**:
- Facility screen shows prestige requirements for locked levels
- Locked levels display "Requires X prestige" message
- Current prestige shown in facility screen
- Progress bar toward next prestige unlock

**US-4: Earn Prestige from Milestones**
```
As a player
I want to earn bonus prestige when I reach milestones
So that I feel rewarded for achievements
```

**Acceptance Criteria**:
- Milestone achievements trigger prestige rewards
- UI notification when milestone reached
- Prestige earned from milestone visible in notification
- Milestone progress visible somewhere in UI

**US-5: Benefit from High Prestige**
```
As a player
I want to see economic benefits from high prestige
So that I understand the value of accumulating reputation
```

**Acceptance Criteria**:
- Battle winnings reflect prestige bonus
- Merchandising income scales with prestige
- Income screen shows prestige multipliers
- Clear indication of prestige benefits

### Epic: Fame System

**US-6: View Robot Fame**
```
As a player
I want to see each robot's individual fame score
So that I understand their reputation
```

**Acceptance Criteria**:
- Robot detail page displays fame prominently
- Fame updates after battles
- Robot list shows fame for each robot
- Fame tier/title displayed next to robot name

**US-7: Earn Fame from Robot Wins**
```
As a player
I want my robots to earn fame when they win battles
So that successful robots build reputation
```

**Acceptance Criteria**:
- Winning robot earns league-appropriate fame
- Battle results show fame earned
- Fame persists on robot record
- Only winning robot earns fame

**US-8: Earn Fame Bonuses**
```
As a player
I want to earn bonus fame for impressive victories
So that dominant performances are rewarded
```

**Acceptance Criteria**:
- Dominating victories (>80% HP) earn +50% fame
- Perfect victories (no damage) earn +100% fame
- Streak bonuses awarded at 5, 10, 25, 50 wins
- Bonus fame clearly indicated in results

**US-9: See Fame Impact on Income**
```
As a player
I want to see how robot fame affects stable income
So that I understand the value of famous robots
```

**Acceptance Criteria**:
- Income screen shows streaming revenue calculation
- Fame contribution to streaming revenue visible
- Total stable fame displayed
- Clear explanation of fame scaling formula

**US-10: Build Robot Identity Through Fame**
```
As a player
I want my famous robots to have visual recognition
So that their reputation is visible to others
```

**Acceptance Criteria**:
- Fame tiers display badge/title on robot
- Famous robots (1,000+) have special indicator
- Leaderboards show robot fame
- Hall of Fame for robots with 5,000+ fame

---

## Technical Specification

### Database Schema

**Existing Fields** (already implemented):

**User Model** (Stable-level):
```typescript
interface User {
  prestige: number;  // Default: 0
  // ... other fields
}
```

**Robot Model** (Robot-level):
```typescript
interface Robot {
  fame: number;  // Default: 0
  // ... other fields
}
```

**Required New Tables**:

**PrestigeMilestone**:
```typescript
interface PrestigeMilestone {
  id: number;
  userId: number;
  milestoneType: string;  // "elo_1500", "wins_100", "tournament_win", etc.
  prestigeAwarded: number;
  earnedAt: Date;
}
```

**FameMilestone**:
```typescript
interface FameMilestone {
  id: number;
  robotId: number;
  milestoneType: string;  // "elo_1500", "kills_10", "streak_5", etc.
  fameAwarded: number;
  earnedAt: Date;
}
```

**Rationale**:
- Milestone tables prevent duplicate awards
- Track when milestones were earned
- Enable achievement history and analytics

### Backend API Endpoints

**Prestige Endpoints**:

```typescript
GET /api/user/prestige
// Returns current prestige, rank, next unlock threshold
Response: {
  prestige: number;
  rank: string;
  nextUnlock: {
    facility: string;
    level: number;
    prestigeRequired: number;
    progressPercent: number;
  }
}

GET /api/user/prestige/milestones
// Returns milestone history
Response: {
  milestones: Array<{
    type: string;
    prestigeAwarded: number;
    earnedAt: Date;
  }>
}

POST /api/user/prestige/award
// Internal endpoint - called after battle/milestone
Request: {
  amount: number;
  source: string;  // "battle_win", "milestone_elo_1500", etc.
  metadata?: object;
}
```

**Fame Endpoints**:

```typescript
GET /api/robots/:robotId/fame
// Returns robot fame, tier, milestones
Response: {
  fame: number;
  tier: string;
  milestones: Array<{
    type: string;
    fameAwarded: number;
    earnedAt: Date;
  }>
}

POST /api/robots/:robotId/fame/award
// Internal endpoint - called after battle/milestone
Request: {
  amount: number;
  source: string;  // "battle_win", "streak_5", etc.
  metadata?: object;
}

GET /api/stable/fame
// Returns stable-wide fame statistics
Response: {
  totalFame: number;
  famousRobots: Array<{
    robotId: number;
    name: string;
    fame: number;
    tier: string;
  }>;
  streamingIncomeMultiplier: number;
}
```

**Battle Integration Endpoints**:

```typescript
POST /api/battles/:battleId/resolve
// Modified to award prestige and fame
// After battle resolution:
// 1. Determine winner
// 2. Award prestige to winner's user
// 3. Award fame to winning robot
// 4. Check for milestones
// 5. Award milestone prestige/fame if triggered
```

### Frontend Components

**Prestige Display Components**:

**PrestigeCard** (Dashboard):
```typescript
interface PrestigeCardProps {
  prestige: number;
  rank: string;
  nextUnlock?: {
    facility: string;
    level: number;
    required: number;
  };
}
```

**PrestigeProgressBar**:
```typescript
interface PrestigeProgressBarProps {
  current: number;
  nextThreshold: number;
  label: string;
}
```

**FameDisplay** (Robot Detail Page):
```typescript
interface FameDisplayProps {
  fame: number;
  tier: string;
  milestones: FameMilestone[];
}
```

**IncomeBreakdown** (Enhanced to show prestige/fame multipliers):
```typescript
interface IncomeBreakdownProps {
  battleWinnings: number;
  prestigeBonus: number;
  merchandising: number;
  streaming: number;
  prestigeMultiplier: number;
  fameMultiplier: number;
}
```

### Calculation Functions

**Prestige Calculations**:

```typescript
function calculatePrestigeForWin(league: string): number {
  const prestigeByLeague = {
    bronze: 5,
    silver: 10,
    gold: 20,
    platinum: 30,
    diamond: 50,
    champion: 75,
  };
  return prestigeByLeague[league] || 0;
}

function getPrestigeRank(prestige: number): string {
  if (prestige < 1000) return "Novice";
  if (prestige < 5000) return "Established";
  if (prestige < 10000) return "Veteran";
  if (prestige < 25000) return "Elite";
  if (prestige < 50000) return "Champion";
  return "Legendary";
}

function calculateBattleWinningsBonus(prestige: number): number {
  if (prestige >= 50000) return 1.20;  // +20%
  if (prestige >= 25000) return 1.15;  // +15%
  if (prestige >= 10000) return 1.10;  // +10%
  if (prestige >= 5000) return 1.05;   // +5%
  return 1.0;  // No bonus
}

function calculateMerchandisingIncome(
  baseMerchandising: number,
  prestige: number
): number {
  return baseMerchandising * (1 + prestige / 10000);
}
```

**Fame Calculations**:

```typescript
function calculateFameForWin(league: string): number {
  const fameByLeague = {
    bronze: 2,
    silver: 5,
    gold: 10,
    platinum: 15,
    diamond: 25,
    champion: 40,
  };
  return fameByLeague[league] || 0;
}

function getFameTier(fame: number): string {
  if (fame < 100) return "Unknown";
  if (fame < 500) return "Known";
  if (fame < 1000) return "Famous";
  if (fame < 2500) return "Renowned";
  if (fame < 5000) return "Legendary";
  return "Mythical";
}

function calculateStreamingIncome(
  baseStreaming: number,
  totalBattles: number,
  totalFame: number
): number {
  const battleMultiplier = 1 + (totalBattles / 1000);
  const fameMultiplier = 1 + (totalFame / 5000);
  return baseStreaming * battleMultiplier * fameMultiplier;
}

function applyVictoryBonus(
  baseFame: number,
  hpPercent: number,
  damageTaken: number
): number {
  // Perfect victory (no HP damage)
  if (damageTaken === 0) {
    return baseFame * 2.0;
  }
  
  // Dominating victory (>80% HP remaining)
  if (hpPercent > 0.8) {
    return baseFame * 1.5;
  }
  
  // Comeback victory (<20% HP remaining)
  if (hpPercent < 0.2) {
    return baseFame * 1.25;
  }
  
  return baseFame;
}
```

**Milestone Checking**:

```typescript
async function checkPrestigeMilestones(userId: number): Promise<void> {
  const user = await getUser(userId);
  const robots = await getUserRobots(userId);
  
  // Check ELO milestones
  const highestElo = Math.max(...robots.map(r => r.elo));
  if (highestElo >= 1500 && !hasMilestone(userId, "elo_1500")) {
    await awardPrestigeMilestone(userId, "elo_1500", 50);
  }
  // ... more milestone checks
  
  // Check win count milestones
  if (user.totalWins >= 100 && !hasMilestone(userId, "wins_100")) {
    await awardPrestigeMilestone(userId, "wins_100", 50);
  }
  // ... more milestone checks
}

async function checkFameMilestones(robotId: number): Promise<void> {
  const robot = await getRobot(robotId);
  
  // Check ELO milestones
  if (robot.elo >= 1500 && !hasRobotMilestone(robotId, "elo_1500")) {
    await awardFameMilestone(robotId, "elo_1500", 25);
  }
  
  // Check kill count milestones
  if (robot.kills >= 10 && !hasRobotMilestone(robotId, "kills_10")) {
    await awardFameMilestone(robotId, "kills_10", 20);
  }
  
  // Check battle count milestones
  if (robot.totalBattles >= 50 && !hasRobotMilestone(robotId, "battles_50")) {
    await awardFameMilestone(robotId, "battles_50", 15);
  }
  // ... more milestone checks
}
```

---

## UI/UX Requirements

### Dashboard Prestige Display

**Location**: Main stable dashboard, top section

**Components**:
- Large prestige number with rank badge
- Rank title (Novice, Established, Veteran, Elite, Champion, Legendary)
- Progress bar to next major threshold (1K, 5K, 10K, 25K, 50K)
- "Next Unlock" preview showing closest facility unlock

**Visual Design**:
- Color-coded based on rank tier (Bronze → Gold → Platinum → Diamond)
- Animated sparkle effect when prestige increases
- Hover tooltip with full rank description

**Mockup Description**:
```
┌────────────────────────────────────┐
│ 🏆 Prestige: 3,247                 │
│ Rank: Established                  │
│                                    │
│ Progress to Veteran (5,000):      │
│ [████████░░░░░░░] 65%             │
│                                    │
│ Next Unlock: Research Lab Lvl 7   │
│ (Requires 7,500 prestige)          │
└────────────────────────────────────┘
```

### Robot Detail Fame Display

**Location**: Robot detail page, performance section

**Components**:
- Fame value with tier badge
- Fame tier name (Unknown, Known, Famous, etc.)
- Recent fame milestones list
- Fame contribution to streaming income

**Visual Design**:
- Star icon with tier color
- Fame history graph (last 30 days)
- Milestone achievement cards

**Mockup Description**:
```
┌────────────────────────────────────┐
│ ⭐ Fame: 856                        │
│ Tier: Famous                       │
│                                    │
│ Recent Milestones:                 │
│ • Reached ELO 1500 (+25 fame)      │
│ • 10 kill streak (+20 fame)        │
│ • 50 battles completed (+15 fame)  │
│                                    │
│ Income Contribution:               │
│ +17% to streaming revenue          │
└────────────────────────────────────┘
```

### Facility Screen Prestige Gates

**Location**: Facility upgrade screen

**Components**:
- Prestige requirement badge on locked levels
- Current prestige vs required comparison
- Disabled upgrade button with prestige message
- Tooltip explaining prestige requirement

**Visual Design**:
- Locked levels have gray background with lock icon
- Red text if prestige insufficient, green if unlocked
- Progress indicator showing how far from requirement

**Mockup Description**:
```
┌────────────────────────────────────┐
│ Repair Bay                         │
│                                    │
│ Level 3: ₡600,000 [UPGRADE]       │
│                                    │
│ Level 4: ₡800,000 🔒               │
│ Requires 1,000 prestige            │
│ (You have: 847 prestige)           │
│ [Need 153 more prestige]           │
└────────────────────────────────────┘
```

### Income Screen with Multipliers

**Location**: Stable dashboard, financial section

**Components**:
- Income breakdown with prestige/fame multipliers
- Battle winnings with prestige bonus percentage
- Merchandising with prestige scaling
- Streaming with fame scaling
- Tooltip explanations for each multiplier

**Mockup Description**:
```
┌────────────────────────────────────┐
│ Daily Income Breakdown             │
│                                    │
│ Battle Winnings:      ₡45,000      │
│  + Prestige Bonus (10%): ₡4,500    │
│                                    │
│ Merchandising:        ₡30,000      │
│  (Base ₡12,000 × 2.5x prestige)    │
│                                    │
│ Streaming:            ₡27,000      │
│  (Base ₡6,000 × fame multiplier)   │
│                                    │
│ Total Daily Revenue:  ₡106,500     │
└────────────────────────────────────┘
```

### Battle Results with Reputation Earned

**Location**: Post-battle results screen

**Components**:
- Prestige earned (stable-level)
- Fame earned (robot-level)
- Bonuses applied (dominating victory, streak, etc.)
- Milestone notifications if triggered

**Mockup Description**:
```
┌────────────────────────────────────┐
│ Victory!                           │
│                                    │
│ Reputation Earned:                 │
│ • Prestige: +20 (Gold league win)  │
│ • Fame: +10 (Robot: Thunderstrike) │
│   + Dominating bonus: +5 fame      │
│                                    │
│ 🎉 Milestone Reached!              │
│ 100 Total Wins - Bonus +50 prestige│
└────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Backend Foundation (Week 1-2)

**Tasks**:
- [ ] Create PrestigeMilestone and FameMilestone tables
- [ ] Implement prestige/fame calculation functions
- [ ] Create prestige/fame award endpoints
- [ ] Integrate prestige earning into battle resolution
- [ ] Integrate fame earning into battle resolution
- [ ] Implement milestone checking system
- [ ] Add prestige bonus to battle winnings calculation
- [ ] Add merchandising income scaling with prestige
- [ ] Add streaming income scaling with fame
- [ ] Write unit tests for all calculation functions

**Acceptance Criteria**:
- Prestige awarded correctly after battle wins
- Fame awarded correctly to winning robot
- Milestones detected and awarded once only
- Income multipliers calculate correctly
- All tests pass

### Phase 2: API Integration (Week 2)

**Tasks**:
- [ ] Create GET /api/user/prestige endpoint
- [ ] Create GET /api/user/prestige/milestones endpoint
- [ ] Create GET /api/robots/:id/fame endpoint
- [ ] Create GET /api/stable/fame endpoint
- [ ] Update battle resolution endpoint to return prestige/fame earned
- [ ] Add prestige/fame to user profile response
- [ ] Add prestige/fame to robot detail response
- [ ] Write integration tests for all endpoints

**Acceptance Criteria**:
- All endpoints return correct data
- Battle resolution includes reputation earned
- Frontend can fetch prestige/fame data
- Integration tests pass

### Phase 3: Frontend UI (Week 3)

**Tasks**:
- [ ] Create PrestigeCard component for dashboard
- [ ] Create PrestigeProgressBar component
- [ ] Create FameDisplay component for robot detail
- [ ] Update IncomeBreakdown to show multipliers
- [ ] Add prestige gates to facility screen
- [ ] Add prestige/fame to battle results screen
- [ ] Implement tooltips explaining prestige/fame
- [ ] Add animations for prestige/fame increases
- [ ] Style rank badges and tier indicators

**Acceptance Criteria**:
- Prestige visible in dashboard with rank
- Fame visible on robot detail page
- Income screen shows multiplier calculations
- Facility screen shows prestige requirements
- Battle results show reputation earned
- UI is polished and intuitive

### Phase 4: Testing & Refinement (Week 4)

**Tasks**:
- [ ] End-to-end testing of prestige earning
- [ ] End-to-end testing of fame earning
- [ ] Balance testing: verify milestone thresholds
- [ ] UX testing: ensure clarity of prestige vs fame
- [ ] Performance testing: milestone checking overhead
- [ ] Bug fixes and refinements
- [ ] Documentation updates
- [ ] Create user guide for prestige/fame system

**Acceptance Criteria**:
- No critical bugs
- System performs well under load
- Players understand prestige vs fame distinction
- Milestone thresholds feel balanced
- Documentation complete

### Phase 5: Analytics & Monitoring (Ongoing)

**Tasks**:
- [ ] Track prestige distribution across player base
- [ ] Track fame distribution across robots
- [ ] Monitor milestone achievement rates
- [ ] Track income multiplier impact
- [ ] Analyze facility unlock progression
- [ ] Identify balance issues (too easy/hard to earn)
- [ ] Gather player feedback
- [ ] Iterate based on data

**Acceptance Criteria**:
- Analytics dashboard shows prestige/fame metrics
- Balance adjustments based on data
- Player feedback incorporated
- System refined over time

---

## Success Metrics & KPIs

### Player Understanding

**Target**: 90% of players understand prestige vs fame distinction
- Survey: "What is prestige used for?"
- Survey: "What is fame used for?"
- Support ticket analysis: confusion rate

### Earning Rates

**Target**: Players reach first prestige threshold (1,000) within 50-100 battles
- Average prestige at 50 battles: 250-500
- Average prestige at 100 battles: 500-1,000
- Median time to 1,000 prestige: 2-4 weeks

**Target**: Famous robots emerge naturally through play
- 20% of robots reach 100+ fame
- 5% of robots reach 500+ fame
- 1% of robots reach 1,000+ fame

### Economic Impact

**Target**: High prestige players earn 15-30% more income
- Battle winnings bonus utilized: 80%+ of eligible players
- Merchandising income scales linearly with prestige
- Streaming income correlates with fame

### Facility Unlocks

**Target**: Prestige gates don't block progression
- 90% of players unlock first prestige gate (1,000) within month
- 50% of players unlock second tier (5,000) within 3 months
- 20% of players unlock high tier (10,000+) within 6 months

### Engagement

**Target**: Prestige/fame system increases long-term retention
- Players with 5,000+ prestige have 2x higher retention
- Players with 500+ fame robots play 30% more battles
- Milestone achievements correlate with session length

---

## Open Questions & Future Enhancements

### Open Questions

1. **Fame Decay**: Should fame decay over time if robot is inactive? Or remain permanent?
   - Option A: Permanent (simpler, encourages long-term investment)
   - Option B: Decay (more realistic, encourages active play)
   - **Recommendation**: Start with permanent, consider decay in Phase 2 if needed

2. **Prestige Loss**: Should players ever lose prestige (banned, cheating)?
   - Option A: Prestige can be revoked for rule violations
   - Option B: Prestige is permanent, ban account instead
   - **Recommendation**: Prestige permanent, handle violations through bans

3. **Fame Transfer**: If robot is sold/traded, does fame transfer?
   - Option A: Fame transfers (robot identity persists)
   - Option B: Fame resets (new owner starts fresh)
   - **Recommendation**: Fame transfers (creates "legendary robot" economy)

4. **Milestone Caps**: Should milestones have upper limits?
   - Example: "Win 1,000 battles" milestone, but only first 10K wins count
   - **Recommendation**: No caps for now, monitor for abuse

### Future Enhancements (Phase 2+)

**Prestige System**:
- [ ] Guild/clan prestige (aggregate of member prestige)
- [ ] Prestige leaderboard (global, regional, friend)
- [ ] Prestige seasons (soft reset annually with legacy bonuses)
- [ ] Prestige-based matchmaking queue (optional high-stakes)
- [ ] Prestige betting (wager prestige on tournament outcomes)
- [ ] Prestige cosmetics shop (spend prestige for exclusive items)

**Fame System**:
- [ ] Famous robot showcase page (profiles of legendary robots)
- [ ] Fame-based endorsements (NPCs sponsor famous robots)
- [ ] Robot retirement (high-fame robots can "retire" for bonuses)
- [ ] Fame decay for inactive robots (balance mechanism)
- [ ] Cross-stable fame comparison (compare robots globally)
- [ ] Robot biography system (write story for famous robots)

**Integration Features**:
- [ ] Achievement system (badges for prestige/fame milestones)
- [ ] Notification system (alerts for milestones, unlocks)
- [ ] Social features (share prestige rank, famous robots)
- [ ] Spectator mode (watch famous robot battles)
- [ ] Replay sharing (showcase famous robot victories)
- [ ] Hall of Fame page (top prestige stables, top fame robots)

---

## Risks & Mitigation

### Risk: Players confuse prestige and fame

**Impact**: Medium  
**Likelihood**: High  
**Mitigation**:
- Clear UI labels and tooltips
- Separate visual styling (prestige = stable, fame = robot)
- Educational content in tutorial
- In-game guide explaining distinction

### Risk: Prestige gates block progression

**Impact**: High  
**Likelihood**: Medium  
**Mitigation**:
- Balance testing with target: 1,000 prestige in 50-100 battles
- Multiple facilities unlock at same thresholds (milestone moments)
- Low prestige gates for essential facilities
- High prestige gates for luxury/cosmetic content

### Risk: Fame becomes meaningless (too easy to earn)

**Impact**: Medium  
**Likelihood**: Medium  
**Mitigation**:
- Lower fame earnings than prestige (2-40 per battle vs 5-75)
- Fame bonuses require impressive performance
- Monitor fame distribution and adjust rates
- Fame tiers set high enough to feel exclusive

### Risk: Income multipliers break economy

**Impact**: High  
**Likelihood**: Low  
**Mitigation**:
- Multipliers scale gradually (10% at 10K prestige)
- Income streams balanced for average prestige (3K-5K)
- High prestige (25K+) provides advantage but not game-breaking
- Monitor economy and adjust multipliers if needed

### Risk: Milestone abuse (farming milestones)

**Impact**: Medium  
**Likelihood**: Low  
**Mitigation**:
- Milestones are one-time awards (database tracking)
- Server-side validation prevents duplicate awards
- Monitor for suspicious patterns (rapid milestone completion)
- Ban system for detected abuse

---

## Appendix

### Glossary

**Prestige**: Stable-level permanent reputation score that unlocks facilities and content. Earned from victories and milestones. Never spent or lost.

**Fame**: Robot-level permanent reputation score that affects income and matchmaking quality. Earned from individual robot victories and achievements.

**Milestone**: One-time achievement that awards bonus prestige or fame (e.g., "First robot to ELO 1500").

**Prestige Gate**: Facility level that requires minimum prestige to unlock (e.g., "Repair Bay Level 4 requires 1,000 prestige").

**Fame Tier**: Categorical rank based on fame value (Unknown, Known, Famous, Renowned, Legendary, Mythical).

**Prestige Rank**: Categorical rank based on prestige value (Novice, Established, Veteran, Elite, Champion, Legendary).

### Reference Documents

- **[STABLE_SYSTEM.md](STABLE_SYSTEM.md)**: Complete facility system and prestige mechanics
- **[GAME_DESIGN.md](GAME_DESIGN.md)**: Overall game design and progression philosophy
- **[ROBOT_ATTRIBUTES.md](ROBOT_ATTRIBUTES.md)**: Robot state tracking and fame field
- **[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)**: Complete database structure

### Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | Feb 2, 2026 | Initial PRD draft | GitHub Copilot |

---

**This PRD provides:**
- ✅ Comprehensive overview of prestige and fame systems
- ✅ Clear distinction between stable-level and robot-level reputation
- ✅ Detailed earning mechanics for both systems
- ✅ Complete benefits and unlock specifications
- ✅ Technical implementation requirements
- ✅ UI/UX mockups and requirements
- ✅ Implementation plan with phases
- ✅ Success metrics and KPIs
- ✅ Risk analysis and mitigation strategies
- ✅ Future enhancement roadmap
