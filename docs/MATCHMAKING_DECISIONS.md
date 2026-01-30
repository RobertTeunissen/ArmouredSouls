# Matchmaking PRD - Decision Checklist

**Date**: January 30, 2026  
**Status**: Awaiting Owner Decisions  
**Full Questions**: See [MATCHMAKING_QUESTIONS.md](MATCHMAKING_QUESTIONS.md)

---

## Quick Decision Form

### Critical Decisions (Must Answer)

**1. Draw Mechanics**
- [ ] Option A: Draws when both robots hit 0 HP simultaneously
- [ ] Option B: Draws when battle exceeds max time (60 seconds)
- [ ] Option C: Draws when both robots yield at same threshold
- [ ] Option D: No draws - always have winner (coin flip if needed)
- [ ] My decision: ___________________________________________

**2. League Instance Size (Phase 1)**
- [ ] Single instance per tier (bronze_1, silver_1, etc.) - Simplest
- [ ] Multiple instances with max size: _____ robots per instance
- [ ] My decision: ___________________________________________

**3. Promotion/Demotion Percentage**
- [ ] Keep 20% (original proposal)
- [ ] Change to 10% (slower progression, more stable)
- [ ] Other percentage: _____
- [ ] My decision: ___________________________________________

**4. Admin Testing Portal**
- [ ] API endpoints only (test via Postman/curl)
- [ ] API + simple admin page in main app
- [ ] Separate admin dashboard/portal
- [ ] CLI tool for local testing
- [ ] My decision: ___________________________________________

**5. Odd Number of Robots**
- [ ] Robot sits out this cycle (rotates who sits out)
- [ ] Gets "bye" match (auto-win with minimal rewards)
- [ ] Matched with adjacent league instance
- [ ] Matched with bye-robot (dummy opponent)
- [ ] My decision: ___________________________________________

---

### UI/UX Decisions

**6. Battle Result - League Changes**
- [ ] Show "Promoted!" or "Demoted" badge on battle result
- [ ] Only for league matches (add battleType field)
- [ ] My decision: ___________________________________________

**7. Dashboard - Last 5 Matches**
- [ ] Per robot (expandable for each)
- [ ] Aggregated across all robots (mixed)
- [ ] User selects which robot to view
- [ ] My decision: ___________________________________________

**8. Robot Detail Page - Match History**
- [ ] Same format as Battle History page (paginated)
- [ ] Separate tab on robot detail
- [ ] Show _____ matches by default
- [ ] My decision: ___________________________________________

**18. League Standings - Show All Leagues**
- [ ] Yes, show all 6 tiers in tabs
- [ ] Highlight/expand player's tiers
- [ ] Show top _____ robots per league by default
- [ ] My decision: ___________________________________________

**19. Highlight Player's Robots**
- [ ] Background color highlight
- [ ] Bold robot name
- [ ] Icon/badge next to name
- [ ] Separate section at top
- [ ] Combination: ___________________________________________
- [ ] My decision: ___________________________________________

---

### Matchmaking Logic

**9. Recent Opponent Avoidance**
- [ ] Hard rule: Never match last 5 opponents
- [ ] Soft rule: Deprioritize recent opponents (try others first)
- [ ] Weighted: Penalty score for recent opponents
- [ ] My decision: ___________________________________________

**11. Same-Stable Matching**
- [ ] League: Strongly deprioritize (but allow as last resort)
- [ ] Tournament: No restriction
- [ ] Add battleType field to Battle model: [ ] Yes [ ] No
- [ ] My decision: ___________________________________________

**12. Battle Readiness - Weapon Check**
- [ ] Yes, check mainWeaponId IS NOT NULL
- [ ] For dual-wield: Also check offhandWeaponId
- [ ] For weapon+shield: Require both weapon AND shield
- [ ] Formula: (HP ≥ 75%) AND (weapon equipped) AND (loadout valid)
- [ ] My decision: ___________________________________________

**13. Battle Readiness Warnings**
- [ ] Robot list page (icon/badge)
- [ ] Robot detail page (banner at top)
- [ ] Dashboard (notification area)
- [ ] All of the above
- [ ] My decision: ___________________________________________

---

### Scheduling & Timing

**14. Matchmaking Timing Sequence**
```
Proposed Flow:
1. Execute battles (8:00 PM)
2. Calculate rewards & update stats
3. Rebalance leagues (promotion/demotion)
4. Run matchmaking for next day (schedule for tomorrow 8:00 PM)
5. Players have 24 hours to adjust strategy
```
- [ ] Approve this flow
- [ ] Modify: ___________________________________________
- [ ] Player adjustment time needed: _____ hours
- [ ] My decision: ___________________________________________

---

### Testing Infrastructure

**15. Practice Sword Specifications**
- Name: "Practice Sword"
- Base Damage: 5
- Cooldown: _____ seconds (suggest 3)
- Cost: ₡_____ (suggest ₡1,000 or free)
- Weapon Type: melee
- Hands Required: one
- All attribute bonuses: 0
- [ ] Approve / Modify: ___________________________________________

**16. 100 Test Users/Robots**
- Usernames: test_user_001 to test_user_100 - [ ] Approve / Change: _____
- Passwords: All "testpass123" - [ ] Approve / Change: _____
- Robot names: "Test Bot 001" format - [ ] Approve / Change: _____
- All attributes = 1 - [ ] Approve / Change: _____
- Loadout: Single weapon - [ ] Approve
- Weapon: Practice Sword - [ ] Approve
- Starting credits: ₡2,000,000 - [ ] Approve / Change: _____
- League: All Bronze - [ ] Approve / Change: _____

**17. Bulk Cycle Auto-Repair**
- [ ] Force repair all robots to 100% before each cycle
- [ ] Deduct repair costs (allow negative balance for testing)
- [ ] Apply Repair Bay facility discount
- [ ] Log all repairs for analysis
- [ ] My decision: ___________________________________________

---

### Additional Details Needed

**2. Detailed Battle Log Structure**
```
What to show in detailed view?
- [ ] Turn-by-turn combat log
- [ ] Damage breakdown per turn
- [ ] Critical hits and special events
- [ ] Stance information
- [ ] Yield/surrender events
- [ ] Final stats comparison
- [ ] Timeline visualization
- [ ] Other: ___________________________________________
```

---

## Summary of My Recommendations

Based on game design principles and Phase 1 scope:

1. ✅ **Draws**: Max battle time (60 sec) approach
2. ✅ **League Size**: Single instance per tier for Phase 1
3. ✅ **Promotion %**: 10% (slower, more stable)
4. ✅ **Admin Tools**: API + simple admin page
5. ✅ **Odd Robots**: Rotating sit-out with priority next cycle
6. ✅ **Recent Opponents**: Soft deprioritization
7. ✅ **Battle Type**: Add battleType field
8. ✅ **Battle Readiness**: Include weapon checks + show warnings
9. ✅ **Timing**: 24-hour adjustment period after matchmaking
10. ✅ **Auto-Repair**: Allow negative balance during testing

**Do you agree with these recommendations?**
- [ ] Yes, approve all recommendations
- [ ] No, see my specific answers above

---

## How to Respond

**Option 1: Quick Approval**
If you agree with all my recommendations, simply reply:
```
APPROVE ALL RECOMMENDATIONS
```

**Option 2: Specific Answers**
Fill out the checkboxes above and reply with your decisions.

**Option 3: Detailed Discussion**
Reply with question numbers you want to discuss further.

---

**Once decisions are confirmed, I will**:
1. Update PRD_MATCHMAKING.md with all decisions
2. Update database schema specifications
3. Update UI/UX specifications
4. Add testing requirements section
5. Create implementation tickets

