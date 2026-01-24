# Armoured Souls - Planning Questions

This document tracks remaining open questions and decisions needed for the project. All answered questions have been removed to avoid redundancy - refer to the respective documentation files for implemented decisions.

**Last Updated**: January 24, 2026  
**Current Phase**: Phase 0 Complete, Ready to Start Phase 1 (Local Prototype)

---

## ✅ RECENT DECISIONS (January 24, 2026)

The following decisions were made during documentation review and have been implemented in the relevant documentation:

1. **Backend Framework**: Express (chosen for simplicity and larger ecosystem) - See ARCHITECTURE.md
2. **ORM/Migrations**: Prisma (better TypeScript support, easier migrations) - See ARCHITECTURE.md, MODULE_STRUCTURE.md
3. **Real-time Features**: WebSockets/Web Push API for notifications across platforms; batch processing for battle computation - See ARCHITECTURE.md
4. **Phase Structure**: Consolidated to single system in ROADMAP.md (Phase 0-9); MODULE_STRUCTURE.md references ROADMAP.md
5. **Battle Schedule (Prototype)**: Manual trigger for Phase 1, scheduled processing in later phases - See PHASE1_PLAN.md
6. **Authentication (Prototype)**: Basic username/password with admin user to test the flow - See PHASE1_PLAN.md
7. **Documentation Dates**: Standardized to January 24, 2026 across all documents
8. **UI Component Library**: Tailwind CSS (lightweight, utility-first, good for prototyping) - See ARCHITECTURE.md
9. **Project Structure**: Isolated prototype codebase in `/prototype` directory - See PHASE1_PLAN.md
10. **Development Style**: Async - AI builds, Robert reviews
11. **Prototype Testing**: 6 test user accounts for local testing
12. **Prototype Scope**: Robot creation, battle simulation, results viewing, user management, stable management, robot upgrading (currency system), battle history - all text-based, no animations

---

## 🔄 OPEN QUESTIONS

### Phase 1 Setup - Technical Questions

1. **Stat Point Distribution System**
   - **Question**: How many total stat points should a player have to distribute when creating a robot? What are the min/max values for each stat (attack, defense, speed, health)?
   - **Context**: Need to balance flexibility vs preventing extreme builds
   - **Status**: Awaiting decision
   - **Reference**: PHASE1_PLAN.md mentions stat distribution but not specifics

2. **Robot Upgrade Costs**
   - **Question**: How much currency should it cost to upgrade each stat point? Should costs increase with each upgrade?
   - **Context**: Currency system balance - starting currency is 1000
   - **Status**: Awaiting decision
   - **Reference**: PHASE1_PLAN.md mentions upgrade system

3. **Battle Rewards**
   - **Question**: How much currency/fame should be rewarded for winning/losing battles?
   - **Context**: Need to balance progression pace with starting currency and upgrade costs
   - **Status**: Awaiting decision
   - **Reference**: PHASE1_PLAN.md mentions currency earned through battles

### Phase 1 Setup - Functional Questions

4. **Robot Limit per User**
   - **Question**: How many robots should each user be able to create in their stable?
   - **Context**: "Multiple robots per player" mentioned but no specific limit
   - **Status**: Awaiting decision
   - **Reference**: PHASE1_PLAN.md and GAME_DESIGN.md mention multiple robots

5. **Component Cost**
   - **Question**: Should components (weapons, armor, chassis) cost currency to equip, or are they freely available in Phase 1?
   - **Context**: Simplicity vs economy simulation
   - **Status**: Awaiting decision
   - **Reference**: PHASE1_PLAN.md has component library but doesn't mention costs

6. **Battle Selection**
   - **Question**: In Phase 1, can users battle their own robots against each other, or only against other users' robots?
   - **Context**: Testing convenience vs realistic gameplay
   - **Status**: Awaiting decision
   - **Reference**: PHASE1_PLAN.md mentions manual battle trigger

### Battle Simulation Details

7. **Random Number Generation Seed**
   - **Question**: Confirm seed generation method (battle ID + timestamp)?
   - **Status**: Good enough for Phase 1, can refine during testing
   - **Reference**: PHASE1_PLAN.md mentions seeded RNG

8. **Critical Hit and Miss Mechanics**
   - **Question**: Confirm percentages - 10% crit chance, 5% miss chance? Should these be configurable per component?
   - **Context**: PHASE1_PLAN.md suggests these mechanics for interest
   - **Status**: Awaiting decision
   - **Reference**: PHASE1_PLAN.md battle algorithm section

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
