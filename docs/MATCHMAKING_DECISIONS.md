# Matchmaking PRD - Decisions Record

**Date**: January 30, 2026  
**Status**: ✅ All Decisions Received  
**Note**: This document consolidates all questions and decisions. MATCHMAKING_QUESTIONS.md is archived as detailed reference.

---

## Decision Summary

All 19 questions have been answered by the owner. Key decisions documented below with full context.

### Critical Decisions (Must Answer)

**1. Draw Mechanics**
**DECISION**: Option B - Max battle time approach (adjustable, ~60 seconds)

**Owner Notes**:
- Option B is a good plan but we might need to adjust the max time
- Option A (simultaneous 0 HP) and C (simultaneous yield) should not happen - one always hits first, one yields before the other

**Impact**: 
- Prevents infinite battles
- Allows tuning for gameplay balance
- Battle simulation must track elapsed time
- Draw occurs when max time reached without winner

**2. League Instance Size (Phase 1)**
**DECISION**: Multiple instances with 100 robots per instance, auto-balancing system

**Owner Notes**:
- 100 robots per instance (e.g., bronze_1, bronze_2, etc.)
- When one league is full (100 robots, not all battle-ready), open next instance
- Balance underlying leagues when promotions occur

**Example Scenario**:
```
Day 5: 250 robots total
- bronze_1 (100), bronze_2 (100), bronze_3 (50)
- Top 10% promoted to silver_1 (25 robots)

Day 6: 250 robots total (no new robots)
- bronze_1 (90), bronze_2 (90), bronze_3 (45), silver_1 (25)
- New robots start in bronze_3 to balance leagues
```

**Alternative Approach (Owner's idea)**:
When bronze_1 and bronze_2 are full and robot 201 is added:
- Create bronze_3
- Redistribute all robots equally: bronze_1 (67), bronze_2 (67), bronze_3 (67)
- Every new robot entry checks for most free spots

**Impact**:
- More complex than single instance per tier
- Requires league balancing algorithm
- Matchmaking prefers same instance (bronze_1 vs bronze_1)
- Fallback to adjacent instances if needed  

**3. Promotion/Demotion Percentage**
**DECISION**: 10%

**Impact**:
- Slower league progression (more stable)
- Top 10% promoted, Bottom 10% demoted
- Requires minimum 5 battles to be eligible
- More competitive at each tier

**4. Admin Testing Portal**
**DECISION**: Separate admin dashboard/portal

**Impact**:
- Dedicated admin interface separate from main app
- More comprehensive testing tools
- Can include bulk operations, analytics, system monitoring
- Requires separate UI implementation
- Not accessible to regular users

**5. Odd Number of Robots**
**DECISION**: Matched with bye-robot (ELO 1000, low stats, full rewards)

**Owner Notes**:
- Bye-robot has ELO 1000 and low stats
- Full rewards in compensation for low ELO gains
- Ensures no robot sits out completely

**Impact**:
- Creates dummy opponent for matchmaking
- Robot always gets to fight (no sitting out)
- Low ELO opponent means small ELO gain
- Compensated with full battle rewards (credits)
- Bye-robot needs to be implemented in database

---

### UI/UX Decisions

**6. Battle Result - League Changes**

**DECISION**: Yes, show "Promoted!" or "Demoted" badges for league matches

**Owner Notes**: "Yes badges for leagues are nice!"

**Impact**:
- Add visual badges to battle results
- Only display for league matches (requires battleType field)
- Clear feedback on league progression
- Motivational element for players

---

**7. Dashboard - Last 5 Matches**

**DECISION**: Last 5 matches per robot, grouped per robot

**Impact**:
- Dashboard organizes matches by robot
- Each robot shows its last 5 matches
- Expandable/collapsible sections per robot
- Clear overview of all robot activity

---

**8. Robot Detail Page - Match History**

**DECISION**: Separate tab on robot detail page

**Impact**:
- New "Match History" tab on robot detail page
- Full paginated match history for that robot
- Same format as main Battle History page
- Keeps robot detail page organized

---

**18. League Standings - Show All Leagues**

**DECISION**: Show all 6 tiers in tabs, highlight leagues with player's active robots

**Owner Notes**: 
- All 6 tiers in tabs
- Highlight leagues a player has active robots

**Impact**:
- Main league page shows Bronze, Silver, Gold, Platinum, Diamond, Champion tabs
- Tabs with player's robots are highlighted/emphasized
- Shows full competitive landscape
- Easy to see all tiers

---

**19. Highlight Player's Robots**

**DECISION**: Flexible - "Whatever you want"

**Recommendation**: Combination approach
- Bold robot name
- Background color highlight (subtle)
- Icon badge next to name

**Impact**:
- Clear visual distinction in league standings
- Multiple cues for easy identification
- Professional appearance

---

### Matchmaking Logic

**9. Recent Opponent Avoidance**

**DECISION**: Soft rule - Deprioritize recent opponents

**Impact**:
- Algorithm tries to avoid last 5 opponents first
- If no other options, can match with recent opponent
- Prevents deadlocks in small leagues
- Adds variety to matchups

---

**11. Same-Stable Matching**

**DECISION**: 
- League: Strongly deprioritize (but allow as last resort)
- Tournament: No restriction (captured for future PRD)

**Owner Notes**: "League: Strongly deprioritize (but allow as last resort). Tournament: No restriction (not as part of this PRD, but capture the requirement)"

**Impact**:
- Matchmaking algorithm heavily penalizes same-stable in leagues
- Only matches same-stable if absolutely no other option
- Tournament system (future) will have no same-stable restriction
- Requires battleType field in Battle model

---

**12. Battle Readiness - Weapon Check**

**DECISION**: All weapons must be equipped for loadout to be valid

**Owner Notes**: "All weapons need to be in order. So both for dual wield and weapon+shield."

**Battle Readiness Formula**:
```typescript
battleReadiness = 
  (currentHP / maxHP >= 0.75) && 
  (mainWeaponId !== null) && 
  (loadoutType === 'single' ? true :
   loadoutType === 'dual_wield' ? offhandWeaponId !== null :
   loadoutType === 'weapon_shield' ? (offhandWeaponId !== null && isShield(offhand)) :
   loadoutType === 'two_handed' ? true : false)
```

**Impact**:
- Single weapon: mainWeapon required
- Dual-wield: mainWeapon AND offhandWeapon required
- Weapon+shield: mainWeapon AND shield required
- Two-handed: mainWeapon required
- More strict validation prevents incomplete loadouts

---

**13. Battle Readiness Warnings**

**DECISION**: All of the above - "It's important"

**Display Warnings On**:
- Robot list page (icon/badge next to non-ready robots)
- Robot detail page (banner at top)
- Dashboard (notification area)

**Impact**:
- Multiple touchpoints ensure players see warnings
- Prevents accidental non-participation
- Clear visual feedback on robot status

---

### Scheduling & Timing

**14. Matchmaking Timing Sequence**

**DECISION**: Approved

**Daily Flow**:
```
1. Execute battles (e.g., 8:00 PM)
2. Calculate rewards & update stats
3. Rebalance leagues (promotion/demotion)
4. Run matchmaking for next day (schedule for tomorrow 8:00 PM)
5. Players have 24 hours to adjust strategy
```

**Impact**:
- Clear, predictable schedule
- Players have full day to prepare
- No rushing to adjust before battles
- Matchmaking happens immediately after rebalancing

---

### Testing Infrastructure

**15. Practice Sword Specifications**

**DECISION**: 
- Name: "Practice Sword"
- Base Damage: 5
- Cooldown: 3 seconds
- Cost: Free (₡0)
- Weapon Type: melee
- Hands Required: one
- All attribute bonuses: 0

**Impact**:
- Baseline weapon for testing
- Zero cost ensures all test users can equip
- Simple stats for balance testing
- Suitable for new players too

---

**16. 100 Test Users/Robots**

**DECISION**: All specifications approved EXCEPT robot names

**Specifications**:
- Usernames: test_user_001 to test_user_100 ✅
- Passwords: All "testpass123" ✅
- Robot names: **Random creative names within game theme** ⚠️
- All attributes = 1 ✅
- Loadout: Single weapon ✅
- Weapon: Practice Sword ✅
- Starting credits: ₡2,000,000 ✅
- League: All Bronze ✅

**Owner Notes**: "Give them random creative names within the theme of the game"

**Impact**:
- Need to generate 100 thematic robot names
- Examples: "Iron Gladiator", "Steel Sentinel", "Plasma Knight", "Cyber Warrior", etc.
- More realistic test data
- Better testing experience

---

**17. Bulk Cycle Auto-Repair**

**DECISION**: 
- Force repair all robots to 100% HP before each cycle ✅
- Deduct repair costs ✅
- Apply Repair Bay facility discounts ✅
- Log repairs for analysis (implicit) ✅

**Impact**:
- Realistic cost simulation during testing
- Tests repair cost mechanics
- Tests facility discount system
- Ensures all robots battle-ready for testing

---

### Additional Details

**Detailed Battle Log Structure**

**DECISION**: Action-by-action combat log with timestamps and textual descriptions

**Owner Notes**: 
- "Basically all of the above and more you can think of"
- "Not turn-by-turn but action by action combat log, with timestamps"
- Textual representations of what happens

**Required Elements**:
- ✅ Action-by-action combat log (not turn-based)
- ✅ Timestamps for each action
- ✅ Damage breakdown per action
- ✅ Critical hits and special events
- ✅ Stance information
- ✅ Yield/surrender events
- ✅ Final stats comparison
- ✅ Timeline visualization (optional)

**Example Combat Messages** (Owner provided):
- "Robot X hits Robot Y with his Practice Sword for x damage. y damage is absorbed by Robot Y's energy shield."
- "Robot Y counters Robot X's attack but missed with his Laser Gun."
- "Robot X is badly damaged and signals he wants to yield"

**Request**: Full draft of possible interactions and messages during combat needed

**Impact**:
- Battle log stored as JSON with detailed events
- Each event has timestamp, type, actors, results
- Rich combat narrative for players
- Enables detailed post-battle analysis
- Foundation for future replay system

---

## Implementation Requirements

Based on owner decisions, the following must be implemented:

### Database Changes
1. **battleType field** in Battle model: 'league' | 'tournament' | 'friendly'
2. **Bye-robot** implementation (special robot entity for odd matchups)
3. **League instance management** (bronze_1, bronze_2, etc. with 100-robot cap)
4. **Practice Sword** weapon entry (free, 3sec cooldown, 5 damage)

### Matchmaking Algorithm
1. **League instance preference** (match within same instance first)
2. **Auto-balancing** when promotions occur
3. **Soft deprioritize** recent opponents (last 5 matches)
4. **Strongly deprioritize** same-stable in leagues
5. **Bye-robot matching** for odd numbers (ELO 1000)

### Battle Readiness
1. **Weapon validation** for all loadout types
2. **HP threshold** check (≥75%)
3. **Warnings** on: robot list, robot detail, dashboard

### UI Components
1. **Dashboard**: Last 5 matches per robot, grouped
2. **Robot Detail**: Separate "Match History" tab
3. **League Standings**: All 6 tiers in tabs, highlight player's leagues
4. **Battle Results**: Promotion/Demotion badges for league matches
5. **Player Robots**: Visual highlighting in standings (bold + background + icon)

### Testing Infrastructure
1. **Admin Dashboard**: Separate portal for testing
2. **100 Test Users**: With creative robot names
3. **Bulk Cycle Trigger**: Up to 100 cycles with auto-repair
4. **Practice Sword**: Free weapon for testing

### Battle Log System
1. **Action-by-action** logging with timestamps
2. **Textual descriptions** of combat events
3. **Full draft of combat messages** required
4. **JSON structure** for battle_log field

---

## Next Steps

✅ All decisions received and documented  
🔄 Currently updating PRD_MATCHMAKING.md  
⏳ Will update QUICK_REFERENCE_MATCHMAKING.md  
⏳ Will create detailed implementation plan  
⏳ Will draft combat message catalog

**Status**: Ready to finalize PRD and begin implementation planning 

