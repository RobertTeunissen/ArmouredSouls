# Hall of Records - Product Requirements Document

**Document Version:** 1.0  
**Last Updated:** February 4, 2026  
**Status:** Draft  
**Author:** GitHub Copilot

---

## Executive Summary

The **Hall of Records** is a new feature that displays prestigious achievements and statistical records from across the Armoured Souls battle arena. This page will serve as a leaderboard of exceptional performances, creating aspirational goals for players and highlighting impressive feats.

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

## Feature Specification

### Page Location
- **Route:** `/hall-of-records`
- **Navigation:** Social category in main navigation
- **Access:** Available to all authenticated users

### Records Categories

#### 1. **Combat Records** (Battle Performance)

##### 1.1 Fastest Victory
- **Metric:** Shortest battle duration (in seconds) that resulted in a win
- **Display:**
  - Winner robot name and owner
  - Opponent robot name and owner
  - Battle duration (e.g., "12.5 seconds")
  - Date achieved
  - Link to battle details
- **Database Query:** `MIN(durationSeconds)` where battle has a winner

##### 1.2 Longest Battle
- **Metric:** Longest battle duration before a winner was determined
- **Display:**
  - Both robot names and owners
  - Battle duration (e.g., "8 minutes 47 seconds")
  - Winner
  - Date achieved
  - Link to battle details
- **Database Query:** `MAX(durationSeconds)` where battle has a winner
- **Why It's Cool:** Shows defensive builds and strategic battles of attrition

##### 1.3 Most Damage in Single Battle
- **Metric:** Highest damage dealt by one robot in a single battle
- **Display:**
  - Robot name and owner
  - Damage dealt (e.g., "2,847 damage")
  - Opponent
  - Battle duration
  - Link to battle details
- **Database Query:** `MAX(robot1DamageDealt)` and `MAX(robot2DamageDealt)` from Battle table
- **Why It's Cool:** Showcases pure offensive power builds

##### 1.4 Narrowest Victory
- **Metric:** Battle won with the smallest remaining HP
- **Display:**
  - Winner robot name and remaining HP (e.g., "3 HP remaining")
  - Opponent name
  - Date achieved
  - Link to battle details
- **Database Query:** Find winner with `MIN(final HP)` where HP > 0
- **Why It's Cool:** Dramatic comebacks and clutch victories

#### 2. **Upset Records** (ELO-Based)

##### 2.1 Biggest Upset
- **Metric:** Largest ELO difference where the underdog won
- **Display:**
  - Underdog robot (lower ELO) name and ELO before battle
  - Favorite robot (higher ELO) name and ELO before battle
  - ELO difference (e.g., "687 ELO underdog")
  - Date achieved
  - Link to battle details
- **Database Query:** Find battle where winner had lower ELO before battle, maximize `ABS(robot1ELOBefore - robot2ELOBefore)`
- **Why It's Cool:** Shows that strategy beats raw stats, inspires underdogs

##### 2.2 Biggest ELO Gain
- **Metric:** Largest single-battle ELO increase
- **Display:**
  - Robot name and owner
  - ELO before and after (e.g., "1450 → 1502 (+52)")
  - Opponent's ELO
  - Date achieved
- **Database Query:** `MAX(eloChange)` from Battle table
- **Why It's Cool:** Demonstrates what's possible when beating strong opponents

##### 2.3 Biggest ELO Loss
- **Metric:** Largest single-battle ELO decrease
- **Display:**
  - Robot name (anonymized or with permission)
  - ELO before and after (e.g., "2150 → 2087 (-63)")
  - Opponent's ELO
  - Date achieved
- **Database Query:** `MIN(eloChange)` from Battle table (where negative)
- **Why It's Cool:** Shows risk of overconfidence, adds drama

#### 3. **Career Records** (Lifetime Stats)

##### 3.1 Most Battles Fought
- **Metric:** Robot with most lifetime battles
- **Display:**
  - Robot name and owner
  - Total battles (e.g., "1,247 battles")
  - Win rate percentage
  - Current ELO
- **Database Query:** `MAX(totalBattles)` from Robot table
- **Why It's Cool:** Recognizes dedication and experience

##### 3.2 Highest Win Rate (Min 50 Battles)
- **Metric:** Best win percentage (with minimum battle requirement to prevent flukes)
- **Display:**
  - Robot name and owner
  - Win rate (e.g., "94.7% (108-6-0)")
  - Total battles
  - Current ELO
- **Database Query:** `MAX(wins/totalBattles)` where `totalBattles >= 50`
- **Why It's Cool:** Shows consistent excellence

##### 3.3 Most Lifetime Damage Dealt
- **Metric:** Highest cumulative damage across all battles
- **Display:**
  - Robot name and owner
  - Total damage (e.g., "487,392 damage")
  - Total battles
  - Average damage per battle
- **Database Query:** `MAX(damageDealtLifetime)` from Robot table
- **Why It's Cool:** Shows offensive prowess over time

##### 3.4 Highest Current ELO
- **Metric:** Current highest ELO rating in the game
- **Display:**
  - Robot name and owner
  - Current ELO (e.g., "2,487 ELO")
  - League tier
  - Win/loss record
- **Database Query:** `MAX(elo)` from Robot table
- **Why It's Cool:** Shows the current king of the arena

##### 3.5 Most Kills (Robot Destructions)
- **Metric:** Most opponents reduced to 0 HP
- **Display:**
  - Robot name and owner
  - Total kills (e.g., "342 destructions")
  - Total battles
  - Kill rate percentage
- **Database Query:** `MAX(kills)` from Robot table
- **Why It's Cool:** Shows lethal efficiency, no mercy

#### 4. **Economic Records**

##### 4.1 Most Expensive Single Battle (Repairs)
- **Metric:** Battle that cost the most in total repairs
- **Display:**
  - Battle participants
  - Total repair cost (e.g., "₡124,500 in repairs")
  - Winner
  - Date
- **Database Query:** `MAX(robot1RepairCost + robot2RepairCost)` from Battle table
- **Why It's Cool:** Shows brutal battles with high stakes

##### 4.2 Highest Fame Robot
- **Metric:** Robot with the most fame points
- **Display:**
  - Robot name and owner
  - Fame points (e.g., "8,472 fame")
  - Current league
  - Major achievements
- **Database Query:** `MAX(fame)` from Robot table
- **Why It's Cool:** Shows celebrity status in the arena

#### 5. **Prestige Records** (Player-Level)

##### 5.1 Highest Prestige Stable
- **Metric:** Player with most prestige points
- **Display:**
  - Player username
  - Prestige points (e.g., "15,234 prestige")
  - Total stable battles
  - Championship titles
- **Database Query:** `MAX(prestige)` from User table
- **Why It's Cool:** Shows overall stable excellence

##### 5.2 Most Championship Titles
- **Metric:** Player with most tournament wins
- **Display:**
  - Player username
  - Championship count (e.g., "7 titles")
  - Prestige
  - Total battles
- **Database Query:** `MAX(championshipTitles)` from User table
- **Why It's Cool:** Recognizes competitive success

---

## Technical Specification

### API Endpoint

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
    "highestFame": { ... }
  },
  "prestige": {
    "highestPrestige": { ... },
    "mostTitles": { ... }
  }
}
```

### Database Queries

All queries will be implemented using Prisma ORM with proper:
- Type safety
- Error handling
- Performance optimization (indexed fields)
- Caching strategy (records updated hourly, not real-time)

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

## Future Enhancements (Phase 2)

1. **Personal Records:** Show user's own records and how they compare
2. **Record History:** Track when records are broken with notifications
3. **Record Attempts:** Badge/notification when you're close to breaking a record
4. **Seasonal Records:** Reset records each season for fresh competition
5. **Category Filters:** Filter by league tier, battle type, time period
6. **Social Sharing:** Share record achievements on social media
7. **Record Alerts:** Notify players when their records are broken
8. **Hall of Fame:** Retired records that were exceptional (like baseball retired numbers)

---

## Implementation Priority

### Phase 1 (MVP - Current Sprint)
1. Combat Records (4 records)
2. Upset Records (3 records)
3. Career Records (5 records)
4. Basic UI with category tabs
5. Simple responsive design

### Phase 2 (Future)
1. Economic Records
2. Prestige Records
3. Enhanced UI animations
4. Personal records comparison
5. Record notifications

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

The Hall of Records will add a competitive, aspirational element to Armoured Souls that encourages diverse strategies, long-term engagement, and creates memorable moments. By highlighting exceptional performances, we give players clear goals to strive for and stories to share.

The feature leverages existing battle data with minimal new infrastructure, making it a high-value, low-effort addition to the game. 

**Estimated Implementation Time:** 8-12 hours
- Backend API: 3-4 hours
- Frontend UI: 4-5 hours  
- Testing & Polish: 2-3 hours
