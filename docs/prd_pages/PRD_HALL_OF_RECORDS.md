# Product Requirements Document: Hall of Records Page

**Project**: Armoured Souls  
**Document Type**: Product Requirements Document (PRD)  
**Version**: v1.4  
**Date**: July 26, 2026  
**Status**: ✅ Implemented 

---

## Version History
- v1.0 - Initial draft by GitHub Copilot (February 6, 2026)
- v1.1 - Review done by Robert Teunissen (February 9, 2026)
- v1.2 - Implementation verification, added core design references, enhanced future enhancements (February 9, 2026) 
- v1.3 - Added King of the Hill Records category (7 records), updated category tabs with 👑 KotH tab (March 18, 2026)
- v1.4 - Spec #46: removed five degenerate Record_Categories, scoped Most Damage per battle mode, restricted Biggest Upset to tournament modes and added summed-team-ELO team upsets, rounded the KotH zone metrics, labelled Career mode coverage, added the 🔥 Win Streaks tab, added kills per match to Grand Melee (July 26, 2026)

---

## References

### Core Design Documents
- **[DATABASE_SCHEMA.md](../prd_core/DATABASE_SCHEMA.md)** - Complete database schema with Battle, Robot, User, and Tournament models
- **[PRD_PRESTIGE_AND_FAME.md](../PRD_PRESTIGE_AND_FAME.md)** - Prestige and fame system specification
- **[PRD_BATTLE_HISTORY_PAGE.md](./PRD_BATTLE_HISTORY_PAGE.md)** - Battle history page with battle detail navigation

### Implementation Files
- **Backend**: `app/backend/src/routes/records.ts` - Hall of Records API endpoint
- **Frontend**: `app/frontend/src/pages/HallOfRecordsPage.tsx` - Hall of Records page component
- **Tests**: `app/backend/tests/records.test.ts` - API endpoint tests

---

## Executive Summary

The **Hall of Records** is a feature that displays prestigious achievements and statistical records from across the Armoured Souls battle arena. This page serves as a leaderboard of exceptional performances, creating aspirational goals for players and highlighting impressive feats.

**Implementation Status**: ✅ Fully implemented with all 5 record categories (Combat, Upsets, Career, Economic, Prestige) and 17 individual records. King of the Hill records (7 additional) added March 2026.

---

## Goals & Objectives

### Primary Goals
1. **Player Engagement**: Give players aspirational goals and bragging rights
2. **Competition**: Encourage players to push boundaries and try different strategies
3. **Discovery**: Help players discover impressive robots and strategies
4. **Entertainment**: Provide interesting stats that tell stories about battles

### Success Metrics
- Page views per active user
- Social sharing of records
- Player retention improvement
- Battle diversity (players trying new strategies to break records)

---

## User Stories

1. **As a competitive player**, I want to see the fastest battle victories so I can understand aggressive strategies and aim to beat the record.

2. **As a new player**, I want to see impressive upsets so I understand that skill and strategy matter more than just robot stats.

3. **As a casual player**, I want to see entertaining battle statistics to learn about the game and get inspired.

4. **As a stable owner**, I want my achievements displayed prominently when I set records so I feel recognized and rewarded.

---

## Implementation Status

### ✅ Fully Implemented Features

**Page Structure**:
- Route: `/hall-of-records` ✅
- Navigation: Social category in main navigation ✅
- Access: All authenticated users ✅
- Category tabs: Combat, Upsets, Career, Economic, Prestige ✅
- Responsive design: Desktop 2-column grid, mobile single column ✅

**API Endpoint**: `GET /api/records` ✅
- Returns all 17 records across 5 categories
- Includes null handling for empty database
- Filters out "Bye Robot" from career records
- Proper error handling and logging

**Record Categories Implemented**:
1. ✅ Combat Records (4 records)
2. ✅ Upset Records (3 records)
3. ✅ Career Records (5 records)
4. ✅ Economic Records (3 records)
5. ✅ Prestige Records (2 records)
6. ✅ King of the Hill Records (7 records)

**Total**: 24 individual records implemented

---

## Feature Specification

### Page Location
- **Route:** `/hall-of-records` ✅ Implemented
- **Navigation:** Social category in main navigation ✅ Implemented
- **Access:** Available to all authenticated users ✅ Implemented

### Records Categories

**Implementation Note**: All records below are ✅ fully implemented in `app/backend/src/routes/records.ts` and displayed in `app/frontend/src/pages/HallOfRecordsPage.tsx`.

---

### Spec #46 category disposition (July 2026)

A record is only worth a leaderboard if distinct performances produce distinct ranked values. Five categories failed that test because their ranking metric was capped, quantised, or otherwise saturated, so every entry reported the same number. Those were removed rather than filtered.

| Record_Category | Tab | Disposition | Reason |
|---|---|---|---|
| Fastest Victory | Combat | **Removed** | The top of the list was occupied by ~1s degenerate resolutions |
| Longest Battle | Combat | **Removed** | `MAX_BATTLE_DURATION` forces a draw at 120s, so every entry read 2:00 |
| Most Damage in Single Battle | Combat | **Retained, scoped per mode** | A Grand Melee robot swings at 19 opponents over the clock a 1v1 robot spends on one |
| Narrowest Victory | Combat | Retained unchanged | Not degenerate |
| Biggest Upset | Upsets | **Retained, tournament modes only** | League matchmaking pairs on LP within a tier instance, so a league "upset" measured matchmaker tolerance |
| Biggest Upset — Team Tournaments | Upsets | **Added** | Differential computed from *summed* team `elo_before`, matching `calculateTeamBattleELOChanges()` |
| Biggest ELO Gain | Upsets | **Removed** | `ELO_K_FACTOR` is a fixed 32, so every entry read +32 |
| Biggest ELO Loss | Upsets | **Removed** | Same, at −32 |
| Best Placement | KotH | **Removed** | Any robot that has ever won ties at placement 1 |
| Zone Dominator | KotH | **Retained, rounded** | Raw `Float` accumulation shipped `1642.7000000000005` |
| Most Zone Time | KotH | **Retained, rounded** | Same defect class |
| Most Kills (Career) | Grand Melee | **Retained, kills per match added** | Total kills alone ranks match volume over lethality |
| Longest Win Streak (×4 modes) | Win Streaks | **Added** | See below |

**No Longest Battle replacement was added.** Any duration-derived metric inherits the same `MAX_BATTLE_DURATION` ceiling, and a non-duration endurance metric would need a new computation over `battle_summaries`. Left to a future spec.

#### Most Damage mode scoping

`mostDamageInBattle` is an object keyed by `battles.battle_type`, covering `league_1v1`, `tournament_1v1`, `league_2v2`, `league_3v3`, `koth`, and `grand_melee`. The opponent field is present only for the two 1v1 modes — in the others a single opponent is not well defined, so it is omitted rather than populated with an arbitrary one of many. The UI renders a mode switcher above one list, so narrow viewports get one section rather than six stacked ones.

#### Career tab mode coverage

`updateRobotCombatStats()` is called with `skipBattleCounters: true` by the KotH and Grand Melee orchestrators, because both modes resolve by placement and a "win" is undefined for placements 2 through N. The counters were deliberately **not** widened: doing so would corrupt the win-rate denominator Highest Win Rate ranks on and change `robots.wins` semantics for every other consumer. Instead each Career category states its scope:

| Career category | Coverage |
|---|---|
| Most Battles Fought | 1v1 League, 1v1 Tournament, Tag Team, 2v2/3v3 League |
| Highest Win Rate | 1v1 League, 1v1 Tournament, Tag Team, 2v2/3v3 League |
| Most Lifetime Damage | Every mode — `damageDealtLifetime` increments regardless of the flag |
| Highest Current ELO | 1v1 League and 1v1 Tournament — ELO is a 1v1 rating |
| Most Robot Destructions | 1v1 League, 1v1 Tournament, Tag Team, 2v2/3v3 League |

#### Win Streaks tab (🔥)

One list per League_Mode: `league_1v1`, `league_2v2`, `league_3v3`, `tag_team`. All four render side by side in a single grouped section so streaks can be compared across modes rather than being scattered over the per-mode tabs.

- Read from `standings.best_win_streak` directly. Never recomputed from battle history: `battle_log` is NULLed by the 7-day retention cron (Spec #39), so a recomputation would silently truncate to the retention window.
- `league_1v1` resolves `standings.entity_id` as a `Robot`; the three team modes resolve it as a `TeamBattle`.
- Ordered by `best_win_streak` descending with `entity_id` ascending as the deterministic tiebreak, so equal streaks render in a stable order across cache refreshes.
- `currentWinStreak` and an `isActive` flag (`currentWinStreak === bestWinStreak`) accompany each entry.
- Cards carry no battle link: a streak spans many battles and no single battle represents it.
- A mode section with no non-zero streak is omitted entirely.

**Excluded modes.** The three tournament modes are excluded because their orchestrators never call `recordBattleResult()`, so their streak columns are permanently zero — including them would render empty lists. `grand_melee` is excluded by decision: a win there is placement 1 of 20, so streaks would sit near zero for everyone and inviting a comparison against a 1v1 streak of 15 would mislead. `koth` already has its own streak category on the KotH tab.

**Bye-win caveat.** `processByeBattle()` calls `recordBattleResult()` with a `'win'` outcome, so a `league_1v1` streak can be extended by a walkover the robot never fought. This is accepted rather than corrected, because league points already treat a bye as a win — changing it here would put the streak and the LP total into disagreement.

#### Open observation: ~1-second battles

Removing Fastest Victory removes the only surface where ~1-second battle resolutions were visible. It does not remove the cause. A battle resolving in about one second may indicate a combat defect, and this is recorded for separate investigation rather than being treated as closed. The Team Battle tab's own `fastestVictory` and `longestNonDrawBattle` categories share the structural weaknesses that justified removing the Combat tab equivalents, but Spec #46 did not scope them, so they remain.

#### Battle detail resolution

`buildStandardLogResponse()` previously declared `robot1` and `robot2` non-nullable and dereferenced both on its first statement, while its caller passed `?? null`. Migration `20260611120000_drop_legacy_scheduling_tables` deleted `battle_participants` and `battles` rows through two different keys, leaving battles with one participant or none, so opening one of those from the Hall of Records threw a `TypeError` that Express 5 forwarded as a 500. Both sides are now emitted as `null` when unresolvable, and the page renders from `participants` and `battle_summaries` instead. A NULL `battle_log` is unrelated: `playbackAvailable` already reports it and the Overview tab reads from the summary permanently.

No data remediation accompanies the fix. The orphaned rows cannot be reconstructed, and Spec #45 deletes battle history at the season boundary.

---

#### 1. **Combat Records** (Battle Performance) ✅ Implemented

##### 1.1 Fastest Victory ❌ REMOVED (Spec #46 R4.2)
- **Status:** Removed July 2026. No longer returned by the API or rendered.
- **Original metric:** Shortest battle duration (in seconds) that resulted in a win
- **Why removed:** The top of the ranking was occupied by ~1-second degenerate resolutions rather than by skilful fast wins, so the list measured a suspected combat defect instead of performance. See the Spec #46 disposition table above, and the open observation on ~1-second battles.
- **Replacement:** None. Any duration-derived metric inherits the same problem.

##### 1.2 Longest Battle ❌ REMOVED (Spec #46 R4.1)
- **Status:** Removed July 2026. No longer returned by the API or rendered.
- **Original metric:** Longest battle duration before a winner was determined
- **Why removed:** `MAX_BATTLE_DURATION` forces a draw at 120s, so every entry in the ranking reported an identical 2:00. Distinct performances did not produce distinct ranked values.
- **Replacement:** None, deliberately. Any duration-derived metric inherits the same ceiling, and a non-duration endurance metric would need a new computation over `battle_summaries`.

##### 1.3 Most Damage in Single Battle ✅
- **Metric:** Highest damage dealt by one robot in a single battle
- **Display:**
  - Robot name and owner
  - Damage dealt (e.g., "2,847 damage")
  - Opponent
  - Battle duration
  - Link to battle details
- **Database Query:** `MAX(robot1DamageDealt)` and `MAX(robot2DamageDealt)` from Battle table
- **Why It's Cool:** Showcases pure offensive power builds
- **Implementation**: Lines 46-97 in `records.ts`

##### 1.4 Narrowest Victory ✅
- **Metric:** Battle won with the smallest remaining HP
- **Display:**
  - Winner robot name and remaining HP (e.g., "3 HP remaining")
  - Opponent name
  - Date achieved
  - Link to battle details
- **Database Query:** Find winner with `MIN(final HP)` where HP > 0
- **Why It's Cool:** Dramatic comebacks and clutch victories
- **Implementation**: Lines 99-139 in `records.ts`

#### 2. **Upset Records** (ELO-Based) ✅ Implemented

##### 2.1 Biggest Upset ✅
- **Metric:** Largest ELO difference where the underdog won
- **Display:**
  - Underdog robot (lower ELO) name and ELO before battle
  - Favorite robot (higher ELO) name and ELO before battle
  - ELO difference (e.g., "687 ELO underdog")
  - Date achieved
  - Link to battle details
- **Database Query:** Find battle where winner had lower ELO before battle, maximize `ABS(robot1ELOBefore - robot2ELOBefore)`
- **Why It's Cool:** Shows that strategy beats raw stats, inspires underdogs
- **Implementation**: Lines 145-189 in `records.ts`

##### 2.2 Biggest ELO Gain ❌ REMOVED (Spec #46 R4.8)
- **Status:** Removed July 2026. No longer returned by the API or rendered.
- **Original metric:** Largest single-battle ELO increase
- **Why removed:** `ELO_K_FACTOR` is a fixed 32, so the maximum possible gain is +32 and every entry in the ranking reported the same value.

##### 2.3 Biggest ELO Loss ❌ REMOVED (Spec #46 R4.8)
- **Status:** Removed July 2026. No longer returned by the API or rendered.
- **Original metric:** Largest single-battle ELO decrease
- **Why removed:** Same fixed `ELO_K_FACTOR` of 32 — every entry reported −32. This also retires the recorded Known Issue that it shared a query with Biggest ELO Gain.

#### 3. **Career Records** (Lifetime Stats) ✅ Implemented

##### 3.1 Most Battles Fought ✅
- **Metric:** Robot with most lifetime battles
- **Display:**
  - Robot name and owner
  - Total battles (e.g., "1,247 battles")
  - Win rate percentage
  - Current ELO
- **Database Query:** `MAX(totalBattles)` from Robot table (excludes "Bye Robot")
- **Why It's Cool:** Recognizes dedication and experience
- **Implementation**: Lines 227-237 in `records.ts`

##### 3.2 Highest Win Rate (Min 50 Battles) ✅
- **Metric:** Best win percentage (with minimum battle requirement to prevent flukes)
- **Display:**
  - Robot name and owner
  - Win rate (e.g., "94.7% (108-6-0)")
  - Total battles
  - Current ELO
- **Database Query:** `MAX(wins/totalBattles)` where `totalBattles >= 50` (excludes "Bye Robot")
- **Why It's Cool:** Shows consistent excellence
- **Implementation**: Lines 239-260 in `records.ts`

##### 3.3 Most Lifetime Damage Dealt ✅
- **Metric:** Highest cumulative damage across all battles
- **Display:**
  - Robot name and owner
  - Total damage (e.g., "487,392 damage")
  - Total battles
  - Average damage per battle
- **Database Query:** `MAX(damageDealtLifetime)` from Robot table (excludes "Bye Robot")
- **Why It's Cool:** Shows offensive prowess over time
- **Implementation**: Lines 262-271 in `records.ts`

##### 3.4 Highest Current ELO ✅
- **Metric:** Current highest ELO rating in the game
- **Display:**
  - Robot name and owner
  - Current ELO (e.g., "2,487 ELO")
  - League tier
  - Win/loss record
- **Database Query:** `MAX(elo)` from Robot table (excludes "Bye Robot")
- **Why It's Cool:** Shows the current king of the arena
- **Implementation**: Lines 273-282 in `records.ts`

##### 3.5 Most Kills (Robot Destructions) ✅
- **Metric:** Most opponents reduced to 0 HP
- **Display:**
  - Robot name and owner
  - Total kills (e.g., "342 destructions")
  - Total battles
  - Kill rate percentage
- **Database Query:** `MAX(kills)` from Robot table (excludes "Bye Robot")
- **Why It's Cool:** Shows lethal efficiency, no mercy
- **Implementation**: Lines 284-293 in `records.ts`

#### 4. **Economic Records** ✅ Implemented

##### 4.1 Most Expensive Single Battle (Repairs) ✅
- **Metric:** Battle that cost the most in total repairs
- **Display:**
  - Battle participants
  - Total repair cost (e.g., "₡124,500 in repairs")
  - Winner
  - Date
- **Database Query:** `MAX(robot1RepairCost + robot2RepairCost)` from Battle table
- **Why It's Cool:** Shows brutal battles with high stakes
- **Implementation**: Lines 299-327 in `records.ts`

##### 4.2 Highest Fame Robot ✅
- **Metric:** Robot with the most fame points
- **Display:**
  - Robot name and owner
  - Fame points (e.g., "8,472 fame")
  - Current league
  - Major achievements
- **Database Query:** `MAX(fame)` from Robot table (excludes "Bye Robot")
- **Why It's Cool:** Shows celebrity status in the arena
- **Implementation**: Lines 329-338 in `records.ts`
- **Related**: See [PRD_PRESTIGE_AND_FAME.md](../PRD_PRESTIGE_AND_FAME.md) for fame system details

##### 4.3 Richest Stables ✅
- **Metric:** Players with the most accumulated currency (Credits)
- **Display:**
  - Player username
  - Currency balance (e.g., "₡12,847,500")
  - Total battles
  - Prestige rank
- **Database Query:** `MAX(currency)` from User table
- **Why It's Cool:** Shows economic mastery and resource management skills, represents successful stable management
- **Implementation**: Lines 340-354 in `records.ts`

#### 5. **Prestige Records** (Player-Level) ✅ Implemented

##### 5.1 Highest Prestige Stable ✅
- **Metric:** Player with most prestige points
- **Display:**
  - Player username
  - Prestige points (e.g., "15,234 prestige")
  - Total stable battles
  - Championship titles
- **Database Query:** `MAX(prestige)` from User table
- **Why It's Cool:** Shows overall stable excellence
- **Implementation**: Lines 360-377 in `records.ts`
- **Related**: See [PRD_PRESTIGE_AND_FAME.md](../PRD_PRESTIGE_AND_FAME.md) for prestige system details

##### 5.2 Most Championship Titles ✅
- **Metric:** Player with most tournament wins
- **Display:**
  - Player username
  - Championship count (e.g., "7 titles")
  - Prestige
  - Total battles
- **Database Query:** `MAX(championshipTitles)` from User table
- **Why It's Cool:** Recognizes competitive success
- **Implementation**: Lines 379-396 in `records.ts`

#### 6. **King of the Hill Records** 👑 — Added March 18, 2026

KotH records are only displayed after 5+ KotH events have been completed. A new "King of the Hill" tab with 👑 icon is added to the category tabs alongside Combat ⚔️, Upsets 🎯, Career 🏅, Economic 💰, and Prestige 👑.

##### 6.1 Most KotH Wins
- **Metric:** Robot with the most 1st place finishes in KotH matches
- **Display:**
  - Robot name and owner
  - Total KotH wins (e.g., "42 wins")
  - Total KotH matches played
  - Win rate percentage
- **Database Query:** `MAX(kothWins)` from Robot table
- **Why It's Cool:** Shows the dominant zone controller

##### 6.2 Highest Single-Match Zone Score
- **Metric:** Best zone score achieved in a single KotH match
- **Display:**
  - Robot name and owner
  - Zone score (e.g., "47.3 points")
  - Match date and zone variant (fixed/rotating)
  - Win reason (score threshold, time limit, last standing)
- **Database Query:** `MAX(zoneScore)` from BattleParticipant where Battle.battleType = 'koth'
- **Why It's Cool:** Showcases total zone dominance in a single match

##### 6.3 Most KotH Kills (Career)
- **Metric:** Robot with the most career kills across all KotH matches
- **Display:**
  - Robot name and owner
  - Total KotH kills (e.g., "156 kills")
  - Total KotH matches
  - Kills per match average
- **Database Query:** `MAX(kothKills)` from Robot table
- **Why It's Cool:** Recognizes the most lethal zone fighter

##### 6.4 Longest KotH Win Streak
- **Metric:** Best consecutive 1st place streak in KotH matches
- **Display:**
  - Robot name and owner
  - Win streak length (e.g., "12 consecutive wins")
  - Current streak (if active)
- **Database Query:** `MAX(kothBestWinStreak)` from Robot table
- **Why It's Cool:** Shows sustained excellence in zone control

##### 6.5 Most Zone Time (Single Match)
- **Metric:** Longest total zone occupation time in a single KotH match
- **Display:**
  - Robot name and owner
  - Zone time (e.g., "127.4 seconds")
  - Match duration and zone variant
- **Database Query:** `MAX(zoneOccupationTime)` from BattleParticipant where Battle.battleType = 'koth'
- **Why It's Cool:** Shows the robot that held the zone the longest in one match

##### 6.6 Fastest Threshold Victory
- **Metric:** Quickest time to reach the score threshold and win a KotH match
- **Display:**
  - Robot name and owner
  - Match duration (e.g., "43.2 seconds")
  - Score threshold reached (30 or 45)
  - Zone variant (fixed/rotating)
- **Database Query:** `MIN(durationSeconds)` from Battle where battleType = 'koth' AND win reason = 'score_threshold'
- **Why It's Cool:** Shows blitz-style zone domination

##### 6.7 Zone Dominator (Career)
- **Metric:** Highest career cumulative zone score across all KotH matches
- **Display:**
  - Robot name and owner
  - Total zone score (e.g., "1,247.5 points")
  - Total KotH matches
  - Average zone score per match
- **Database Query:** `MAX(kothTotalZoneScore)` from Robot table
- **Why It's Cool:** Recognizes the all-time greatest zone controller

---

## Known Issues

### Issue #1: Biggest ELO Loss Query
**Status**: ⚠️ Bug in Implementation

**Current Behavior**: The "Biggest ELO Loss" record uses the same query as "Biggest ELO Gain" (lines 207-221 in `records.ts`), so it shows the same data.

**Expected Behavior**: Should find the battle where the loser had the largest ELO decrease.

**Fix Required**:
```typescript
// Should query for battles where loser had biggest ELO drop
const biggestEloLoss = await prisma.battle.findFirst({
  where: {
    winnerId: { not: null },
    eloChange: { gt: 0 },
  },
  orderBy: { eloChange: 'desc' }, // This finds biggest gain for winner = biggest loss for loser
  include: { /* ... */ },
});
```

**Impact**: Low - record displays but shows incorrect data (duplicate of ELO Gain)

---

## Technical Specification

### API Endpoint ✅ Implemented

**Route:** `GET /api/records`

**Response Format:**
```json
{
  "combat": {
    "fastestVictory": {
      "battle": { ... },
      "winner": { ... },
      "loser": { ... },
      "durationSeconds": 12.5,
      "date": "2026-02-01T15:30:00Z"
    },
    "longestBattle": { ... },
    "mostDamageInBattle": { ... },
    "narrowestVictory": { ... }
  },
  "upsets": {
    "biggestUpset": { ... },
    "biggestEloGain": { ... },
    "biggestEloLoss": { ... }
  },
  "career": {
    "mostBattles": { ... },
    "highestWinRate": { ... },
    "mostLifetimeDamage": { ... },
    "highestElo": { ... },
    "mostKills": { ... }
  },
  "economic": {
    "mostExpensiveBattle": { ... },
    "highestFame": { ... },
    "richestStables": { ... }
  },
  "prestige": {
    "highestPrestige": { ... },
    "mostTitles": { ... }
  }
}
```

### Database Queries ✅ Implemented

All queries implemented using Prisma ORM with:
- ✅ Type safety (TypeScript interfaces)
- ✅ Error handling (try-catch with logging)
- ✅ Performance optimization (indexed fields: `elo`, `totalBattles`, `fame`, `prestige`, `currency`)
- ✅ Null handling (returns null for missing records)
- ✅ "Bye Robot" filtering (excluded from career records)
- ⚠️ Real-time updates (no caching - consider adding for Phase 2)

**Database Indexes Used** (from DATABASE_SCHEMA.md):
- Robot: `@@index([elo])`, `@@index([currentLeague])`
- Battle: `@@index([createdAt])`
- User: No specific indexes for currency/prestige (consider adding)

**Performance Considerations**:
- Most queries use simple `findFirst` with `orderBy` (efficient)
- Some queries iterate all battles (e.g., Most Damage, Narrowest Victory) - consider optimization for large datasets
- No pagination on records endpoint (returns all 17 records at once)

### Frontend Component Structure

```
HallOfRecordsPage.tsx
├── Header Section (title, description)
├── Category Tabs (Combat, Upsets, Career, Economic, Prestige)
├── Record Cards
│   ├── Record Title
│   ├── Record Holder Info
│   ├── Record Value (prominent display)
│   ├── Context Info (opponent, date, etc.)
│   └── "View Battle" link (when applicable)
└── Loading/Error States
```

---

## UI/UX Design ✅ Implemented

### Visual Design
- **Theme:** Dark mode consistent with existing pages ✅
- **Accent Color:** Gold/yellow (#d29922) for record values ✅
- **Card Style:** Elevated cards (`bg-gray-800 border border-gray-700`) with hover effects ✅
- **Icons:** Trophy (🏆), medal (🏅), flame (🔥) icons for different record types ✅

### Layout ✅ Implemented
- **Desktop:** 2-column grid for record cards (`grid-cols-1 lg:grid-cols-2`)
- **Mobile:** Single column, scrollable
- **Category Navigation:** Horizontal tabs at top with icons
  - Combat ⚔️
  - Upsets 🎯
  - Career 🏅
  - Economic 💰
  - Prestige 👑
  - King of the Hill 👑

### Information Hierarchy ✅ Implemented
1. **Record value** (largest, most prominent - `text-3xl font-bold text-yellow-400`)
2. **Record holder name** (clickable - navigates to robot/user details)
3. **Context information** (opponent, date, etc. - `text-gray-400`)
4. **Action button** ("View Battle Details →" - `text-yellow-500`)

### Component Structure ✅ Implemented
```typescript
HallOfRecordsPage.tsx
├── Header Section (title, description)
├── Category Tabs (Combat, Upsets, Career, Economic, Prestige)
├── Record Cards Grid
│   └── RecordCard Component
│       ├── Record Title (with icon)
│       ├── Record Value (prominent display)
│       ├── Description (context)
│       ├── Details Array (bullet points)
│       └── "View Battle" link (conditional)
└── Loading/Error States
```

### Responsive Behavior ✅ Implemented
- **Desktop (≥1024px):** 2-column grid, horizontal tabs
- **Tablet (768-1023px):** 2-column grid, scrollable tabs
- **Mobile (<768px):** Single column, scrollable tabs with `overflow-x-auto`

---

## UI/UX Design

### Visual Design
- **Theme:** Dark mode consistent with existing pages
- **Accent Color:** Gold/yellow for record values (prestige feel)
- **Card Style:** Elevated cards with hover effects
- **Icons:** Trophy, medal, flame icons for different record types

### Layout
- **Desktop:** 2-column grid for record cards
- **Mobile:** Single column, scrollable
- **Category Navigation:** Horizontal tabs at top, scrolls on mobile

### Information Hierarchy
1. Record value (largest, most prominent)
2. Record holder name (clickable)
3. Context information (opponent, date, etc.)
4. Action button ("View Battle Details")

---

## Privacy Considerations

- All records are public information (battles are public)
- Robot names and usernames are already public in battle history
- For "Biggest ELO Loss" - consider if this should be displayed (could embarrass players)
  - **Recommendation:** Include it but frame it as "highest stakes" rather than "biggest failure"

---

## Future Enhancements

### Phase 2: Performance & Caching
1. **Caching Strategy:** Cache records for 5-15 minutes to reduce database load
   - Use Redis or in-memory cache
   - Invalidate cache when new battles complete
   - Add `Cache-Control` headers to API response
   
2. **Query Optimization:** Optimize queries that iterate all battles
   - Add database indexes for `currency` and `prestige` on User table
   - Consider materialized views for complex aggregations
   - Use database-level MAX/MIN functions where possible

3. **Loading States:** Add skeleton loaders while fetching records
   - Improve perceived performance
   - Better UX on slow connections

### Phase 3: Personalization
4. **Personal Records:** Show user's own records and how they compare
   - "You're #5 in Most Battles Fought"
   - Highlight user's robots in record cards
   - Show distance to next record ("23 battles away from #1")

5. **Record Attempts:** Badge/notification when you're close to breaking a record
   - "You're 2 ELO points away from Biggest ELO Gain!"
   - Encourage strategic play to break records

6. **Personal Best Tracking:** Track each user's personal bests
   - Fastest victory for this user
   - Highest damage for this user
   - Compare personal bests to global records

### Phase 4: Social & Competitive
7. **Record History:** Track when records are broken with notifications
   - Timeline of record holders
   - "This record has been broken 3 times this month"
   - Notification when your record is broken

8. **Social Sharing:** Share record achievements on social media
   - Generate shareable images with record details
   - "I just set the record for Fastest Victory in Armoured Souls!"
   - Include QR code or link to battle details

9. **Record Alerts:** Notify players when their records are broken
   - In-app notifications
   - Email notifications (optional)
   - Push notifications (mobile)

10. **Leaderboard Integration:** Link to full leaderboards
    - "View Top 10 Fastest Victories"
    - Expand each record to show top 5-10 holders
    - Filter by league tier or time period

### Phase 5: Advanced Features
11. **Seasonal Records:** Reset records each season for fresh competition
    - Archive previous season records
    - "Season 1 Hall of Records" historical view
    - Seasonal achievements and badges

12. **Category Filters:** Filter by league tier, battle type, time period
    - "Bronze League Records"
    - "Tournament Records Only"
    - "Last 30 Days Records"

13. **Hall of Fame:** Retired records that were exceptional
    - Records that stood for 6+ months
    - "Legendary" tier for unbeaten records
    - Special recognition for record holders

14. **Record Challenges:** Time-limited challenges to break specific records
    - "Weekend Challenge: Break the Fastest Victory record"
    - Bonus rewards for breaking records during challenges
    - Community events around record attempts

15. **2v2 Records:** Add records for team battles
    - Fastest 2v2 victory
    - Best 2v2 team win rate
    - Most coordinated team damage

16. **Statistical Insights:** Add more analytical records
    - Most consistent robot (lowest ELO variance)
    - Best comeback (largest HP deficit overcome)
    - Most efficient robot (highest damage per HP lost)
    - Longest win streak
    - Longest undefeated streak in a league

17. **Record Verification:** Add verification for suspicious records
    - Flag potential exploits or bugs
    - Admin review for exceptional records
    - Community reporting for suspicious achievements

---

## Dependencies & Risks

### Dependencies
- Requires battle data to exist (at least 50+ battles for meaningful records)
- Requires Prisma database access
- Requires authentication middleware

### Risks
1. **Insufficient Data:** Early game may not have impressive records
   - Mitigation: Start with seed data or simulated battles
2. **Performance:** Complex queries on large battle tables
   - Mitigation: Add database indexes, implement caching
3. **Player Toxicity:** Public failures could discourage players
   - Mitigation: Frame negatives as "learning opportunities" or remove them

---

## Testing Plan

### Unit Tests
- Test each record calculation function independently
- Test edge cases (ties, no data, etc.)

### Integration Tests
- Test API endpoint returns correct data structure
- Test with various database states (empty, partial, full)

### Manual Testing
- Verify UI displays correctly on desktop and mobile
- Test navigation integration
- Verify links to battle details work
- Test loading and error states

---

## Success Criteria

✅ **Must Have**
- Page accessible from navigation
- Displays at least 10 different records
- Responsive design works on mobile
- Loading and error states handled
- Links to battle details functional

✅ **Should Have**
- Category tabs for organization
- Professional, polished UI
- Fast page load (<2 seconds)
- Accurate data with proper calculations

✅ **Nice to Have**
- Animations and visual polish
- Tooltips explaining each record type
- Personal record indicators ("You're #5 in this category!")

---

## Open Questions

1. Should we display records that might embarrass players (e.g., biggest loss)?
   - **Recommendation:** Yes, but frame positively ("Most Epic Upset")

2. Should records be real-time or cached?
   - **Recommendation:** Cache for 1 hour (balance freshness vs. performance)

3. Should we set minimum thresholds (e.g., "min 50 battles" for win rate)?
   - **Recommendation:** Yes, prevents flukes and meaningless records

4. Should users be able to opt-out of appearing in records?
   - **Recommendation:** No for MVP (all battle data is already public)

---

## Conclusion

The Hall of Records adds a competitive, aspirational element to Armoured Souls that encourages diverse strategies, long-term engagement, and creates memorable moments. By highlighting exceptional performances, we give players clear goals to strive for and stories to share.

The feature leverages existing battle data with minimal new infrastructure, making it a high-value, low-effort addition to the game. 