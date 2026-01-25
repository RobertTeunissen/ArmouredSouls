# Armoured Souls - Planning Questions & Action Items

This document tracks remaining open questions, decisions needed for the project, and Robert's review tasks. All answered questions have been removed to avoid redundancy - refer to the respective documentation files for implemented decisions.

**Last Updated**: January 25, 2026  
**Current Phase**: Phase 1 - Local Prototype (Design Complete, Implementation Pending)

---

## 📋 ROBERT'S ACTION ITEMS (Review Tasks)

### Documentation Review

**Priority: Complete these reviews before implementation starts**

1. **Review ROADMAP.md (Pending)**
   - [ ] Verify Phase 1 implementation priorities are correct (1a: Core, 1b: Weapons, 1c: Stable)
   - [ ] Approve database migration path
   - [ ] Review breaking changes from design evolution
   - [ ] Confirm Phase 1a/1b/1c split makes sense
   - [ ] Check that stable system is properly marked as Phase 1c (optional)
   - [ ] Review "Design Discussions Needed" section:
     - Prestige vs Fame system interaction
     - Tournament system comprehensive design

2. **Review Prisma Schema Updates Needed**
   - [ ] Location: `/prototype/backend/prisma/schema.prisma`
   - [ ] Approve attribute renames (8 attributes being renamed)
   - [ ] Confirm new Robot fields (state tracking, loadout, stance)
   - [ ] Verify new Weapon fields (cooldown, handsRequired, damageType)
   - [ ] Approve new Shield model handling (Weapon model with weaponType="shield")
   - [ ] Approve new Facility model (14 types including 4 Training Academies)
   - [ ] Check User model updates for stable system

### Implementation Decisions Needed

3. **Phase 1 Scope Confirmation**
   - [ ] Confirm Phase 1a (core prototype with time-based combat) is the immediate focus
   - [ ] Decide if Phase 1b (weapon & equipment system) should be included in Phase 1
   - [ ] Decide if Phase 1c (stable system) should be deferred to Phase 2
   - [ ] Review updated ROADMAP.md implementation priorities

4. **Database Setup**
   - [ ] Approve database schema from DATABASE_SCHEMA.md (authoritative source)
   - [ ] Confirm seed data approach for prototype
   - [ ] No migration needed - fresh start for prototype

### Testing & Validation

5. **Game Balance Review** (after initial implementation)
   - [ ] Test various robot builds (tank, glass cannon, speed demon, etc.)
   - [ ] Verify combat formulas produce interesting battles
   - [ ] Check repair costs are balanced with battle rewards
   - [ ] Validate yield threshold creates meaningful strategic choice
   - [ ] Test loadout bonuses/penalties feel significant

6. **Documentation Completeness**
   - [ ] Confirm all design questions from previous iterations are resolved
   - [ ] Verify no duplicate information between documents
   - [ ] Check all cross-references between documents are correct
   - [ ] Ensure PHASE1_PLAN.md aligns with updated ROADMAP.md

---

## 🔄 OPEN QUESTIONS

**All Phase 1 design questions have been answered and documented.**

Awaiting Robert's review of documentation updates before proceeding with implementation.

See respective documentation files for all design decisions:
- **ROBOT_ATTRIBUTES.md**: Combat system, attributes, formulas
- **STABLE_SYSTEM.md**: Facilities, prestige, economy
- **DATABASE_SCHEMA.md**: Complete schema specifications
- **ROADMAP.md**: Implementation phases and priorities

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
