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
   - [ ] Confirm Phase 1a (core prototype with turn-based) is the immediate focus
   - [ ] Decide if Phase 1b (enhanced features) should be included in Phase 1
   - [ ] Decide if Phase 1c (stable system) should be deferred to Phase 2
   - [ ] Approve starting with turn-based combat (migrate to time-based in Phase 2)

6. **Migration Strategy**
   - [ ] Approve database migration approach outlined in ROADMAP.md
   - [ ] Confirm seed data needs to be updated with new attribute names
   - [ ] Decide if we need data migration script or fresh start for prototype

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

26. **Weapon-Neutral Attributes**: Renamed 8 attributes to work for all weapon types - See ROBOT_ATTRIBUTES.md
27. **Robot State Tracking**: Added currentHP, currentShield, elo, wins, losses, fame, yield threshold, etc. - See ROBOT_ATTRIBUTES.md
28. **Loadout System**: 4 configurations (Weapon+Shield, Two-Handed, Dual-Wield, Single) with bonuses/penalties - See ROBOT_ATTRIBUTES.md
29. **Battle Stances**: Pre-battle settings (Offensive/Defensive/Balanced) affect combat behavior - See ROBOT_ATTRIBUTES.md
30. **Yield Threshold**: Players set surrender HP %, destroyed robots (0% HP) cost 2.5x repairs - See ROBOT_ATTRIBUTES.md
31. **Time-Based Combat**: Designed as Phase 2 enhancement, Phase 1 uses turn-based - See ROBOT_ATTRIBUTES.md
32. **Shield Mechanics**: Separate HP pool from robot HP, regenerates during battle - See ROBOT_ATTRIBUTES.md
33. **Damage Types**: Energy (+20% vs shields), Melee (Hydraulic Systems bonus), Ballistic (penetration), Explosive (area) - See ROBOT_ATTRIBUTES.md
34. **HP Calculation**: Formula-based: `max_hp = hullIntegrity × 10` - See ROBOT_ATTRIBUTES.md
35. **Critical Mechanics**: Only rolls after hit confirmed, 2.5x for two-handed weapons - See ROBOT_ATTRIBUTES.md
36. **Shield Equipment**: New Shield model added for defensive builds - See ROBOT_ATTRIBUTES.md
37. **Stable System**: Complete facility upgrade system, prestige, coaches - See STABLE_SYSTEM.md
38. **Database Schema**: Full implementation spec added to ROBOT_ATTRIBUTES.md
39. **Implementation Phases**: Consolidated into ROADMAP.md (Phase 1a/1b/1c)
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
