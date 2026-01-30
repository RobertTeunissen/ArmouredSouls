# Matchmaking PRD - Clarifying Questions

**Date**: January 30, 2026  
**Status**: Awaiting Answers  
**Context**: Questions based on PRD_MATCHMAKING.md review comments

---

## Critical Design Decisions Needed

### 1. Draw Mechanics

**Question**: Are draws possible in battles? If so, how/when do they occur?

**Context**: Multiple comments reference draws in battle results, league point calculations mention +1 for draws, but the actual draw mechanics haven't been defined.

**Impact**: 
- Battle simulation engine logic
- Battle model fields (winnerId can be null)
- League points calculation
- UI display of draw results

**Options**:
- A) Draws occur when both robots reach 0 HP simultaneously
- B) Draws occur when battle duration exceeds maximum time limit
- C) Draws occur when both robots yield at same HP threshold
- D) No draws - always have a winner (even if by coin flip)

**Recommendation Needed**: Which option(s) should we implement?

---

### 2. Detailed Battle Log Design

**Question**: What should a detailed battle log look like?

**Context**: Battle history allows clicking "View Details" but the detailed view isn't specified.

**Information to Display**:
- Turn-by-turn combat log?
- Damage breakdown per turn?
- Critical hits and special events?
- Stance changes during battle?
- Yield/surrender events?
- Final stats comparison?
- Timeline visualization?

**Related Technical Question**: 
- Battle.battleLog field is JSON - what's the exact structure?
- How detailed should event timestamps be?

---

### 3. League Instance Size & Management

**Question**: What's the maximum size of a league instance (e.g., bronze_1)?

**Context**: You mentioned preferring robots in bronze_1 fight each other before searching bronze_2. Need to define when a new instance opens.

**Sub-questions**:
- How many robots trigger opening a new league instance?
- Is this configurable or hardcoded?
- Do we ever merge league instances if they become too small?
- For Phase 1 prototype, should we just use single instances?

**Suggested Approach for Phase 1**:
- Single instance per tier (bronze_1, silver_1, etc.)
- Add multi-instance logic in Phase 2
- Does this work for your testing needs?

---

### 4. Admin Testing Portal

**Question**: How should we implement the admin trigger controls?

**Options**:
- A) Admin-only page in the main web app (requires login as admin)
- B) Separate admin dashboard/portal
- C) API endpoints only (test via Postman/curl)
- D) CLI tool for local testing

**Your Requirements**:
- Trigger up to 100 cycles at once
- Auto-repair robots between cycles (use normal repair costs)
- Generate 100 test users/robots with Practice Sword

**Follow-up Questions**:
- Do you want a UI for triggering, or is API + CLI sufficient for Phase 1?
- Should the bulk cycle trigger be synchronous (wait for all) or async (start and monitor)?
- Where should we display progress/results of bulk testing?

---

### 5. Promotion/Demotion Percentage

**Question**: Should we change from 20% to 10% for promotion/demotion?

**Context**: You commented "10% sounds more reasonable, otherwise you're switching leagues too often."

**Confirmation Needed**:
- Change to **10% promoted**, **10% demoted**?
- This means slower league progression (harder to climb/fall)
- Should this be configurable or hardcoded?

---

## UI/UX Clarifications

### 6. Battle Result Display - League Changes

**Question**: How should league changes be displayed on battle results?

**Scenarios**:
- Robot promoted after this battle → Show "Promoted to Silver!" badge?
- Robot demoted after this battle → Show "Demoted to Bronze" indicator?
- No change → Show current league only

**Tournament Consideration**: You noted tournaments don't have league changes. Should we:
- Add a `battleType` field to Battle model: "league" | "tournament" | "friendly"
- Only show league changes for `battleType === "league"`?

---

### 7. Dashboard - Last 5 Matches

**Question**: Should the dashboard show the last 5 matches:
- A) Per robot (expandable list for each robot)?
- B) Aggregated across all user's robots (mixed)?
- C) User selects which robot to view?

**UI Space Consideration**: With multiple robots, showing 5 matches per robot could be lengthy.

---

### 8. Robot Detail Page - Match History

**Question**: On the robot detail page, you want "entire match history in battle result format."

**Clarifications**:
- Same format as Battle History page (paginated list)?
- Should it be a separate tab/section on robot detail page?
- Include filters (date range, result type)?
- Default to showing how many matches (20, 50, all)?

---

## Matchmaking Logic Details

### 9. Recent Opponent Avoidance

**Question**: "Decrease likelihood of opponent from last 5 league matches"

**Implementation Options**:
- A) Hard rule: Never match against last 5 opponents
- B) Soft rule: Deprioritize recent opponents (try others first)
- C) Weighted: Recent opponents get penalty score in pairing algorithm

**Recommendation**: Option B (soft rule) to avoid deadlocks in small leagues. Acceptable?

---

### 10. Odd Number of Robots

**Question**: "With 15 robots in the league we get 7 matches. What happens to the 15th robot?"

**Options**:
- A) Sits out this cycle (rotates who sits out each cycle)
- B) Gets a "bye" match (auto-win with minimal rewards)
- C) Can be matched with robot from adjacent league instance
- D) Matched with bye-robot (dummy opponent, guaranteed win but low rewards)

**Your Preference?**: Which option fits the game design best?

---

### 11. Same-Stable Matching in Tournaments

**Question**: You noted same-stable restriction "cannot be a hard requirement" for tournaments.

**Proposed Solution**:
- League matches: Strongly deprioritize same-stable (but allow as last resort)
- Tournament matches: No restriction on same-stable matching

**Database Change Needed?**:
- Add `battleType` to Battle model?
- Add `allowSameStable` parameter to matchmaking function?

---

## Battle Readiness Enhancements

### 12. Weapon Check for Battle Readiness

**Question**: "Robots without weapons equipped are NOT battle ready"

**Implementation**:
- Check `mainWeaponId IS NOT NULL`?
- For dual-wield loadout, also check `offhandWeaponId`?
- For weapon+shield loadout, require both main weapon AND shield?

**Calculation**:
```typescript
battleReadiness = 
  (currentHP / maxHP >= 0.75) AND
  (mainWeaponId IS NOT NULL) AND
  (loadout requirements met)
```

**Agree?**

---

### 13. Battle Readiness Warnings

**Question**: "Users need to be warned about their robots not being battle ready"

**Where to Show Warnings**:
- Robot list page (icon/badge next to non-ready robots)?
- Robot detail page (banner at top)?
- Dashboard (notification area)?
- All of the above?

**Warning Threshold**: Show warning when `battleReadiness < 75%` (same as matchmaking cutoff)?

---

## Scheduling & Timing

### 14. Matchmaking Timing Sequence

**Question**: You stated "matchmaking happens directly after matches complete, not 1 hour before."

**Proposed Daily Cycle Sequence**:
```
1. Execute scheduled battles (e.g., 8:00 PM)
2. Calculate rewards and update stats
3. Rebalance leagues (promotion/demotion)
4. Run matchmaking for NEXT day (e.g., schedule for tomorrow 8:00 PM)
5. Players have 24 hours to view matchups and adjust strategy
```

**Confirmation**: Is this the correct flow?

**Follow-up**: How much time do players need to adjust after seeing matchups? 
- 24 hours?
- 12 hours?
- Configurable?

---

## Testing Infrastructure

### 15. Practice Sword Weapon

**Question**: New weapon "Practice Sword" for testing

**Specifications Confirmed**:
- Name: "Practice Sword"
- Base Damage: 5
- Cooldown: ? (suggest 3 seconds)
- Weapon Type: melee
- Hands Required: one
- Damage Type: melee
- Loadout Type: single, weapon_shield, dual_wield
- All attribute bonuses: 0
- Cost: ? (suggest ₡1,000 or free for testing)

**Missing Details**: What should cooldown and cost be?

---

### 16. 100 Test Users/Robots

**Question**: Seed script for 100 test users/robots

**Specifications**:
- **Usernames**: test_user_001 through test_user_100?
- **Passwords**: All same (testpass123) or unique?
- **Robots**: 1 per user, all named format "Test Bot 001"?
- **Attributes**: All 23 attributes = 1
- **Loadout**: Single weapon loadout
- **Weapon**: Practice Sword equipped (mainWeaponId)
- **Starting Credits**: ₡2,000,000 (standard) or different?
- **League**: All start in Bronze?

**Confirmation Needed**: Approve these specs?

---

### 17. Bulk Cycle Testing with Auto-Repair

**Question**: "When skipping time by triggering multiple cycles, robots need to be made battle ready (auto force repair)"

**Implementation Clarification**:
- Before each cycle: Force repair all robots to 100% HP?
- Deduct repair costs from user credits (even if user goes negative)?
- Apply Repair Bay facility discount during auto-repair?
- Log all repair costs for testing analysis?

**Edge Case**: What if user doesn't have enough credits for repair?
- A) Repair anyway (allow negative balance during testing)
- B) Skip robot (don't match if can't afford repair)

**Recommendation**: Option A (allow negative) for testing purposes. Agree?

---

## League Standings Display

### 18. Show All Leagues

**Question**: "Player needs to know how he stacks up with other players; show all leagues, not only the ones he is in."

**Implementation**:
- Default view: Show all league tiers (Bronze through Champion) in tabs?
- Current approach was showing only leagues player participates in
- Change to: Always show all 6 tiers, but highlight/expand player's tiers?

**UI Consideration**: With 6 league tiers × potentially many robots, should we:
- Show top N (10? 20?) per league by default?
- Expand to see more?
- Separate page per league?

---

### 19. Highlight Player's Robots

**Question**: "Player should easily identify his own robots when checking league standings"

**Visual Options**:
- A) Highlight row background color (e.g., light blue)
- B) Bold robot name
- C) Icon/badge next to robot name
- D) Separate section at top showing "Your Robots in This League"
- E) Combination of above

**Your Preference?**

---

## Summary of Required Decisions

**Must Answer Before Implementation**:
1. ✅ Draw mechanics (Yes/No, and how they work)
2. ✅ League instance size (single instance for Phase 1?)
3. ✅ Promotion/demotion % (10% instead of 20%?)
4. ✅ Admin trigger interface (API-only or UI?)
5. ✅ Odd robot handling (sits out, bye match, or other?)

**Should Answer for Better Design**:
6. Detailed battle log structure
7. Battle type field in database
8. Recent opponent avoidance strategy
9. Battle readiness weapon checks
10. Matchmaking timing confirmation

**Can Decide During Implementation**:
11. UI styling choices (highlights, icons, etc.)
12. Test data specifications (usernames, passwords)
13. Warning placement and thresholds

---

## My Recommendations Summary

Based on game design principles and implementation feasibility:

1. **Draws**: Allow draws when battle exceeds max time (e.g., 60 seconds) - prevents infinite stalemates
2. **League Size**: Single instance per tier for Phase 1, add multi-instance in Phase 2
3. **Promotion/Demotion**: Change to 10% (slower progression, more stable leagues)
4. **Admin Tools**: API endpoints + simple admin page in main app (not separate portal)
5. **Odd Robots**: Rotating sit-out with priority next cycle (fairest approach)
6. **Recent Opponents**: Soft deprioritization (not hard block)
7. **Battle Type**: Add `battleType` field to Battle model for future tournament support
8. **Battle Readiness**: Include weapon check + show warnings on dashboard and robot list

**Do these recommendations align with your vision?**

---

**Next Steps After Answers**:
1. Update PRD with confirmed decisions
2. Update database schema as needed
3. Update UI specifications
4. Create implementation tickets
5. Begin development

