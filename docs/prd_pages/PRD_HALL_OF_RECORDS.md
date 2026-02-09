# Product Requirements Document: Hall of Records Page

**Project**: Armoured Souls  
**Document Type**: Product Requirements Document (PRD)  
**Version**: v1.2  
**Date**: February 9, 2026  
**Status**: ✅ Implemented 

---

## Version History
- v1.0 - Initial draft by GitHub Copilot (February 6, 2026)
- v1.1 - Review done by Robert Teunissen (February 9, 2026)
- v1.2 - Implementation verification, added core design references, enhanced future enhancements (February 9, 2026) 

---

## References

### Core Design Documents
- **[DATABASE_SCHEMA.md](../prd_core/DATABASE_SCHEMA.md)** - Complete database schema with Battle, Robot, User, and Tournament models
- **[PRD_PRESTIGE_AND_FAME.md](../PRD_PRESTIGE_AND_FAME.md)** - Prestige and fame system specification
- **[PRD_BATTLE_HISTORY_PAGE.md](./PRD_BATTLE_HISTORY_PAGE.md)** - Battle history page with battle detail navigation

### Implementation Files
- **Backend**: `prototype/backend/src/routes/records.ts` - Hall of Records API endpoint
- **Frontend**: `prototype/frontend/src/pages/HallOfRecordsPage.tsx` - Hall of Records page component
- **Tests**: `prototype/backend/tests/records.test.ts` - API endpoint tests

---

## Executive Summary

The **Hall of Records** is a feature that displays prestigious achievements and statistical records from across the Armoured Souls battle arena. This page serves as a leaderboard of exceptional performances, creating aspirational goals for players and highlighting impressive feats.

**Implementation Status**: ✅ Fully implemented with all 5 record categories (Combat, Upsets, Career, Economic, Prestige) and 17 individual records.

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

**Total**: 17 individual records implemented

---

## Feature Specification

### Page Location
- **Route:** `/hall-of-records` ✅ Implemented
- **Navigation:** Social category in main navigation ✅ Implemented
- **Access:** Available to all authenticated users ✅ Implemented

### Records Categories

**Implementation Note**: All records below are ✅ fully implemented in `prototype/backend/src/routes/records.ts` and displayed in `prototype/frontend/src/pages/HallOfRecordsPage.tsx`.

#### 1. **Combat Records** (Battle Performance) ✅ Implemented

##### 1.1 Fastest Victory ✅
- **Metric:** Shortest battle duration (in seconds) that resulted in a win
- **Display:**
  - Winner robot name and owner
  - Opponent robot name and owner
  - Battle duration (e.g., "12.5 seconds")
  - Date achieved
  - Link to battle details
- **Database Query:** `MIN(durationSeconds)` where battle has a winner
- **Implementation**: Lines 18-30 in `records.ts`

##### 1.2 Longest Battle ✅
- **Metric:** Longest battle duration before a winner was determined
- **Display:**
  - Both robot names and owners
  - Battle duration (e.g., "8 minutes 47 seconds")
  - Winner
  - Date achieved
  - Link to battle details
- **Database Query:** `MAX(durationSeconds)` where battle has a winner
- **Why It's Cool:** Shows defensive builds and strategic battles of attrition
- **Implementation**: Lines 32-44 in `records.ts`

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

##### 2.2 Biggest ELO Gain ✅
- **Metric:** Largest single-battle ELO increase
- **Display:**
  - Robot name and owner
  - ELO before and after (e.g., "1450 → 1502 (+52)")
  - Opponent's ELO
  - Date achieved
- **Database Query:** `MAX(eloChange)` from Battle table
- **Why It's Cool:** Demonstrates what's possible when beating strong opponents
- **Implementation**: Lines 191-205 in `records.ts`

##### 2.3 Biggest ELO Loss ✅
- **Metric:** Largest single-battle ELO decrease
- **Display:**
  - Robot name (anonymized or with permission)
  - ELO before and after (e.g., "2150 → 2087 (-63)")
  - Opponent's ELO
  - Date achieved
- **Database Query:** `MIN(eloChange)` from Battle table (where negative)
- **Why It's Cool:** Shows risk of overconfidence, adds drama
- **Implementation**: Lines 207-221 in `records.ts` (Note: Currently uses same query as ELO Gain - see Known Issues)

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