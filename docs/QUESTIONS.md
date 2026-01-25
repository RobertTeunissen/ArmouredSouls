# Armoured Souls - Planning Questions & Action Items

This document tracks remaining open questions, decisions needed for the project, and Robert's review tasks. All answered questions have been removed to avoid redundancy - refer to the respective documentation files for implemented decisions.

**Last Updated**: January 25, 2026  
**Current Phase**: Phase 1 - Local Prototype (Design Complete, Implementation Pending)

---

## 📋 ROBERT'S ACTION ITEMS (Review Tasks)

### Documentation Review

**Priority: Complete these reviews before implementation starts**

1. **Review ROBOT_ATTRIBUTES.md (Complete)**
   - [ ] Review new Database Schema Implementation section
   - [ ] Verify all 23 attributes are correct with weapon-neutral names
   - [ ] Confirm loadout system (4 configurations) matches vision
   - [ ] Review stance system (offensive/defensive/balanced)
   - [ ] Approve yield threshold mechanics (0-50% HP, 2.5x destruction penalty)
   - [ ] Validate time-based vs turn-based combat discussion
   - [ ] Check shield mechanics (separate HP pool, regeneration)
   - [ ] Review damage type system (Energy/Ballistic/Melee/Explosive)
   - [ ] Approve HP formula: `max_hp = hullIntegrity × 10`
   - [ ] Verify all combat formulas are balanced

2. **Review STABLE_SYSTEM.md**
   - [ ] Approve stable resources (Credits, Prestige, League Tier)
   - [ ] Review 5 facility upgrade paths and costs
   - [ ] Check prestige milestones and unlocks
   - [ ] Approve coach system and bonuses
   - [ ] Verify roster management (2-10 robot slots)
   - [ ] Review weapon storage system
   - [ ] Check economic balance (facility ROI calculations)

3. **Review ROADMAP.md Updates**
   - [ ] Verify Phase 1 implementation priorities are correct
   - [ ] Approve database migration path
   - [ ] Review breaking changes from design evolution
   - [ ] Confirm Phase 1a/1b/1c split makes sense
   - [ ] Check that stable system is properly marked as Phase 1c (optional)

4. **Review Prisma Schema Updates Needed**
   - [ ] Location: `/prototype/backend/prisma/schema.prisma`
   - [ ] Approve attribute renames (8 attributes being renamed)
   - [ ] Confirm new Robot fields (state tracking, loadout, stance)
   - [ ] Verify new Weapon fields (cooldown, handsRequired, damageType)
   - [ ] Approve new Shield model
   - [ ] Approve new Facility model
   - [ ] Check User model updates for stable system

### Implementation Decisions Needed

5. **Phase 1 Scope Confirmation**
   - [ ] Confirm Phase 1a (core prototype with time-based combat) is the immediate focus
   - [ ] Decide if Phase 1b (weapon & equipment system) should be included in Phase 1
   - [ ] Decide if Phase 1c (stable system) should be deferred to Phase 2
   - [ ] Review updated ROADMAP.md implementation priorities

6. **Database Setup**
   - [ ] Approve database schema from DATABASE_SCHEMA.md (authoritative source)
   - [ ] Confirm seed data approach for prototype
   - [ ] No migration needed - fresh start for prototype

### Testing & Validation

7. **Game Balance Review** (after initial implementation)
   - [ ] Test various robot builds (tank, glass cannon, speed demon, etc.)
   - [ ] Verify combat formulas produce interesting battles
   - [ ] Check repair costs are balanced with battle rewards
   - [ ] Validate yield threshold creates meaningful strategic choice
   - [ ] Test loadout bonuses/penalties feel significant

8. **Documentation Completeness**
   - [ ] Confirm all design questions from previous iterations are resolved
   - [ ] Verify no duplicate information between documents
   - [ ] Check all cross-references between documents are correct
   - [ ] Ensure PHASE1_PLAN.md aligns with updated ROADMAP.md

---

## ✅ RECENT DECISIONS (January 25, 2026)

Major design evolution completed addressing all feedback:

26. **Weapon-Neutral Attributes**: 23 attributes work for all weapon types (Combat Power, Targeting Systems, etc.) - See ROBOT_ATTRIBUTES.md
27. **Robot State Tracking**: currentHP, currentShield, elo, wins, losses, fame, yield threshold, etc. - See DATABASE_SCHEMA.md
28. **Loadout System**: 4 configurations (Weapon+Shield, Two-Handed, Dual-Wield, Single) with percentage-based bonuses - See ROBOT_ATTRIBUTES.md
29. **Battle Stances**: Pre-battle settings (Offensive/Defensive/Balanced) affect combat behavior - See ROBOT_ATTRIBUTES.md
30. **Yield Threshold**: Players set surrender HP %, destroyed robots (0% HP) have repair_cost_multiplier 2.0x - See ROBOT_ATTRIBUTES.md
31. **Time-Based Combat**: Exclusive combat system (turn-based removed from all plans) - See ROBOT_ATTRIBUTES.md
32. **Energy Shield Mechanics**: Separate HP pool from robot HP, regenerates during battle (HP does not) - See ROBOT_ATTRIBUTES.md
33. **Shield Nomenclature**: "Energy Shield" (HP pool) vs "Shield" weapon (physical equipment) - See ROBOT_ATTRIBUTES.md
34. **HP Calculation**: Formula-based: `max_hp = hullIntegrity × 10`, `max_shield = shieldCapacity × 2` - See ROBOT_ATTRIBUTES.md
35. **Critical Mechanics**: Only rolls after hit confirmed, randomness added (±10%), 2.5x for two-handed - See ROBOT_ATTRIBUTES.md
36. **Shield Equipment**: Shield weapons use weaponType="shield" in Weapon model - See DATABASE_SCHEMA.md
37. **Stable System**: 11 facility types, 10 levels each, prestige-gated unlocks, daily income/expense system - See STABLE_SYSTEM.md
38. **Database Schema**: DATABASE_SCHEMA.md is authoritative source for all models - See DATABASE_SCHEMA.md
39. **Implementation Phases**: Phase 1a (time-based core), 1b (weapons), 1c (stable system) - See ROADMAP.md
40. **League System**: Per-robot (not stable), supports multiple Bronze leagues via leagueId - See DATABASE_SCHEMA.md
40. **Documentation Cleanup**: Removed ROBOT_ATTRIBUTES_OLD.md, consolidating DESIGN_CHANGES_V2.md content

---

## 🔄 OPEN QUESTIONS

**All Phase 1 design questions have been answered and documented.**

Awaiting Robert's review of documentation updates before proceeding with implementation.

---

## ⚪ DEFERRED TO LATER PHASES

All questions related to the following features are deferred as they are post-MVP:
- Economy and currency system (Phase 2-3)
- Trading and marketplace (Post-MVP, Phase 6+)
- Tournament system (Post-MVP, Phase 5-6)
- Guild system and social features (Post-MVP)
- Advanced matchmaking algorithms (Phase 2+)
- Team battles (Post-MVP)
- Conditional triggers (Post-MVP)
- Analytics and metrics (Phase 6+)
- Content moderation (Phase 6+)
- Marketing and launch strategy (Phase 6-7)
- Legal and administrative setup (Phase 6+)

**Note**: Specific questions for these features have been removed from this document to avoid redundancy. They will be addressed when we reach the relevant development phase.

---

**Document Status**: ✅ CLEANED AND CONSOLIDATED  
**Last Updated**: January 24, 2026  
**Maintainer**: Keep this document minimal - only active questions that need decisions  
**Rule**: Once answered, move decisions to the appropriate documentation file and remove from here
