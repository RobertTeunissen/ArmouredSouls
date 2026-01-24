# Armoured Souls - Planning Questions

This document contains remaining questions that need to be answered to refine our development roadmap and make informed implementation decisions.

**Note**: Core design questions have been answered and documented in GAME_DESIGN.md. This document contains follow-up questions, implementation details, and documentation inconsistencies identified during review.

**Last Updated**: January 24, 2026  
**Current Phase**: Phase 0 Complete, Ready to Start Phase 1 (Local Prototype)

---

## 📋 DOCUMENTATION INCONSISTENCIES FOUND (January 24, 2026)

The following inconsistencies were discovered during documentation review and need clarification before proceeding:

### 1. Technology Stack - Framework Decision
**Status**: ⚠️ NEEDS CLARIFICATION  
**Documents**: ARCHITECTURE.md vs SUMMARY.md, GAME_DESIGN.md, ROADMAP.md

- **Issue**: ARCHITECTURE.md (Lines 75-78) lists "Express or Fastify (TBD based on performance needs)" as undecided
- **Conflict**: SUMMARY.md states tech stack is "FINALIZED: Node.js + TypeScript + React"
- **Question**: Has the backend framework been decided? Should we update ARCHITECTURE.md to reflect Express or Fastify as the chosen framework?
- **Impact**: Blocks Phase 1 initialization

--> Update all related documents to reflect "FINALIZED: Node.js + TypeScript + React" and assess what the impact would be on other parts of the documents. 
--> Make a choice for Express vs Fastify based on the requirements you have captured so far and update all relevant documentation.

### 2. Real-time Features vs Batch Processing
**Status**: ⚠️ NEEDS CLARIFICATION  
**Documents**: ARCHITECTURE.md vs MODULE_STRUCTURE.md vs PORTABILITY.md

- **Issue**: ARCHITECTURE.md says "Real-time: ❌ Not needed (scheduled batch battle processing)"
- **Conflict**: MODULE_STRUCTURE.md mentions "WebSockets for real-time updates" and PORTABILITY.md references "Web Push API"
- **Question**: Are real-time features needed for notifications/updates, or is everything truly async/scheduled? What specifically needs real-time vs what can be polled?
- **Impact**: Affects architecture decisions and technology choices

--> The scheduled batch processing relates to the processing of matches. You can decide whether you need Websockets or "Web Push API" for making sure all components work and multiple platforms (eg. iOS and browser) can access the same data at the same time. Update the relevant documentation to remove inconsistency.

### 3. Phase Numbering and Structure
**Status**: ⚠️ NEEDS CLARIFICATION  
**Documents**: MODULE_STRUCTURE.md vs ROADMAP.md

- **Issue**: MODULE_STRUCTURE.md defines "Phase 1-5" focusing on module development order
- **Conflict**: ROADMAP.md defines "Phase 0-9" focusing on feature completion and deployment
- **Question**: Should we use different terminology (e.g., "Module Phases" vs "Project Phases") or consolidate to one phasing system?
- **Impact**: Could cause confusion in planning and communication

--> Consolidate into one phasing system, keep it consistent. Also make sure you refer to other documents rather than duplicate, otherwise we need to do a review like this every day. There should be ONE document stating the phases and what we need to do, but the MODULE_STRUCTURE.md should reflect what is currently in place and what is not and this should be reflected in your instructions for every query. Make sure you incorporate this. 

### 4. Database Migration Tool
**Status**: ⚠️ NEEDS CLARIFICATION  
**Documents**: MODULE_STRUCTURE.md

- **Issue**: References "Flyway, Alembic" for migrations - Flyway is Java-based, Alembic is Python-based
- **Conflict**: Using Node.js/TypeScript stack, should use TypeORM or Prisma migrations
- **Question**: Which ORM and migration tool will be used? TypeORM or Prisma?
- **Impact**: Affects Phase 1 database setup

--> Pick the most logical one and update the relevant documentation.

### 5. Battle Processing Schedule for MVP
**Status**: 🟡 NEEDS SPECIFICATION  
**Documents**: GAME_DESIGN.md, ARCHITECTURE.md

- **Issue**: Multiple options mentioned (1-2 times daily, 4-6 times daily, etc.) but no clear MVP decision
- **Question**: What is the specific battle processing schedule for the MVP/Phase 1 prototype?
  - Once per day at specific time?
  - Multiple times per day (how many)?
  - Manual trigger for prototype?
- **Impact**: Affects prototype implementation and testing

--> In the later stages, we should be able to schedule this: regular matches on a set time, tournament matches on a set time. Maybe even let users set times for sparring / test matches.
--> For the prototype: we'll trigger scheduled matches manually. 

### 6. Authentication Approach for Prototype
**Status**: 🟡 CLARIFICATION HELPFUL  
**Documents**: PHASE1_PLAN.md vs GAME_DESIGN.md vs SECURITY.md

- **Issue**: Prototype plan says "hardcode test user" or "basic auth", but final game requires OAuth
- **Question**: For Phase 1 prototype:
  - Should we implement basic username/password to test the flow?
  - Or truly hardcode a single test user to save time?
  - Or implement OAuth from the start?
- **Impact**: Affects Phase 1 scope and development time

--> Prototype: Test the flow. This is crucial. I want to be able to test with different users, and I want you to test automatically as well with every commit (this is a new rule that should be reflecte in your instructions). There will also be an admin user with elevated rights. This needs to be in place for the prototype.

### 7. Documentation Dates Inconsistent
**Status**: ⚠️ NEEDS UPDATE  
**Documents**: Multiple files

- **Issue**: Last updated dates are inconsistent:
  - SUMMARY.md: "January 2024" (very outdated)
  - ROADMAP.md: "January 21, 2026" (3 days ago)
  - QUESTIONS.md: "January 2026" (no specific date)
- **Question**: Should we standardize all documentation dates to January 24, 2026?
- **Impact**: Minor - documentation clarity only

--> Standardize all documentation dates in the format "January 24, 2026" and keep it updated. "January 21, 2026" for the roadmap is probably accurate, "January 2024" surely isn't. 

### 8. Current Project Status
**Status**: ⚠️ NEEDS ALIGNMENT  
**Documents**: SUMMARY.md vs ROADMAP.md

- **Issue**: SUMMARY.md says "Status: Awaiting Design Decisions & Tech Stack Selection"
- **Conflict**: ROADMAP.md shows decisions are complete and "Phase 1 Ready to Start"
- **Question**: What is the actual current status? Are we truly ready for Phase 1, or are there pending decisions?
- **Impact**: Affects whether we can start implementation

--> That's why we're doing this review. This is due to capturing the same information in multiple documents. SUMMARY.md is only useful if the information is accurate. Is this document really relevant or should the information be integrated in other documents?

### 9. UI Component Library Choice
**Status**: 🟡 NEEDS DECISION  
**Documents**: ARCHITECTURE.md, PORTABILITY.md

- **Issue**: ARCHITECTURE.md (Line 86) lists "Material-UI or Tailwind CSS (TBD)"
- **Question**: Has this been decided for the prototype? Or should prototype use basic HTML/CSS?
- **Impact**: Affects Phase 1 UI implementation approach

--> Is has not been decided. You can make the choice based on the current requirements. Make sure this is reflected in the relevant documentation.

### 10. Monorepo Structure Timeline
**Status**: 🟡 NEEDS CLARIFICATION  
**Documents**: PORTABILITY.md vs ROADMAP.md

- **Issue**: PORTABILITY.md describes monorepo structure in detail
- **Question**: When should monorepo structure be implemented?
  - Phase 1 prototype (overkill?)
  - Phase 2 (before mobile)?
  - Phase 6 (when starting mobile)?
- **Impact**: Affects initial project structure decisions

--> This doesn't really matter. It'll be a long time before we enter Phase 2. What I DO want is to make sure we have an isolated code base for the prototype. Maybe in a seperate directory? You figure out what is best. 

---

## ❓ PRIORITY LEVELS FOR QUESTIONS

### 🔴 CRITICAL - Must answer before Phase 1 start
1. Technology Stack - Framework Decision (#1)
2. Current Project Status (#8)
3. Database Migration Tool (#4)

### 🟡 HIGH - Should answer during early Phase 1
1. Battle Processing Schedule for MVP (#5)
2. Authentication Approach for Prototype (#6)
3. Real-time Features vs Batch Processing (#2)

### 🟢 MEDIUM - Can answer during Phase 1
1. Phase Numbering and Structure (#3)
2. UI Component Library Choice (#9)
3. Monorepo Structure Timeline (#10)

### ⚪ LOW - Cosmetic/Documentation only
1. Documentation Dates Inconsistent (#7)

--> Everything should have been answered. 

---

## Battle Simulation Engine

**Overall Status**: 🟡 PARTIALLY SPECIFIED - Core mechanics defined, details need refinement

### Deterministic Simulation

1. **Random Number Generation** - 🟡 PARTIALLY ANSWERED
   - **Current Decision**: Use seeded RNG for deterministic replay (PHASE1_PLAN.md mentions this)
   - **Remaining Questions**:
     - Specific seed generation method (battle ID + timestamp)?
     - Balance between randomness and predictability percentage?
   - **Status**: Good enough for Phase 1 prototype, can refine during testing

2. **Battle Duration Calculation** - 🟢 ANSWERED
   - **Decision**: Variable duration based on stats (PHASE1_PLAN.md line 290-292)
   - **Implementation**: max_turns = 100 to prevent infinite battles
   - **Status**: Specified in Phase 1 algorithm

3. **Victory Conditions** - 🟢 ANSWERED
   - **Decision**: Robot destroyed (health = 0) is primary victory condition
   - **Implementation**: Specified in PHASE1_PLAN.md battle algorithm
   - **Future**: Surrender, timeout, tactical retreat marked as future features
   - **Status**: MVP condition defined

4. **Damage Calculation** - 🟢 ANSWERED
   - **Formula**: `damage = max(1, attack - defense)` (PHASE1_PLAN.md line 300-306)
   - **Minimum**: Always at least 1 damage
   - **Future**: Critical hits, armor penetration, status effects mentioned as enhancements
   - **Status**: Basic formula ready for Phase 1

5. **Action Resolution Order** - 🟢 ANSWERED
   - **Decision**: Speed-based (faster robots act first) - PHASE1_PLAN.md line 235-237
   - **Implementation**: Higher speed value goes first each turn
   - **Status**: Defined in battle algorithm

### Conditional Triggers (Future Feature)

**Overall Status**: ⚪ DEFERRED - Marked as post-MVP feature, not needed for Phase 1

1. **Trigger Conditions** - ⚪ DEFERRED
   - Status: Future feature, not in MVP scope
   - Decision: Will be designed after MVP launch based on player feedback

2. **Trigger Actions** - ⚪ DEFERRED
   - Status: Future feature, not in MVP scope
   - Decision: Will be designed after MVP launch

3. **Trigger Limits** - ⚪ DEFERRED
   - Status: Future feature, not in MVP scope
   - Decision: Will be designed after MVP launch

---

## Robot Component System

**Overall Status**: 🟢 SPECIFIED FOR PHASE 1 - Basic system defined in PHASE1_PLAN.md

### Component Types

1. **Chassis** - 🟢 SPECIFIED
   - **Decision**: 3-5 chassis types (Tank, Scout, Balanced, Berserker, Fortress)
   - **Stats Affected**: Health, speed, defense, attack (PHASE1_PLAN.md lines 319-327)
   - **Status**: Sample chassis defined, ready for Phase 1

2. **Weapons** - 🟢 SPECIFIED
   - **Decision**: 5-10 preset weapons for Phase 1
   - **Types**: Laser Rifle, Plasma Cannon, Machine Gun, Hammer, Sniper, Sword, Rocket Launcher
   - **Stats**: Attack bonus defined (PHASE1_PLAN.md lines 329-339)
   - **Status**: Sample weapons ready for Phase 1

3. **Armor** - 🟢 SPECIFIED
   - **Decision**: 5-10 preset armor types for Phase 1
   - **Types**: Heavy Plate, Light Armor, Energy Shield, Stealth Coating, Reactive Armor, Nano-Weave
   - **Stats**: Defense bonus and speed penalties defined (PHASE1_PLAN.md lines 341-350)
   - **Status**: Sample armor ready for Phase 1

4. **Engine/Power** - 🟡 NOT IN PHASE 1
   - **Status**: Not included in Phase 1 prototype scope
   - **Decision**: Can be added in Phase 2+ based on balance needs
   - **Rationale**: Keeping Phase 1 simple with chassis providing speed stats

5. **Modules/Special Systems** - ⚪ DEFERRED
   - **Status**: Post-MVP feature
   - **Decision**: Will be designed after core system is validated

### Component Balancing

**Overall Status**: 🟡 INITIAL VALUES SET - Phase 1 has starting values, requires playtesting

1. **Stat Ranges** - 🟡 PARTIALLY ANSWERED
   - **Current**: Sample ranges provided in PHASE1_PLAN.md
   - **Remaining**: Need playtesting to validate and adjust
   - **Status**: Good enough for Phase 1, iterate based on testing

2. **Weight and Capacity** - 🟡 NOT IN PHASE 1
   - **Status**: Simplified for Phase 1 - no weight system yet
   - **Decision**: Can add complexity in Phase 2 if needed

3. **Cost Balancing** - ⚪ DEFERRED
   - **Status**: No economy in Phase 1 prototype
   - **Decision**: Will be designed in Phase 2-3 when currency system is added

---

## Progression and Economy

**Overall Status**: ⚪ DEFERRED - Not in Phase 1 prototype, designed for Phase 2+

### Currency System

**Status**: ⚪ ALL DEFERRED TO PHASE 2+
- Currency types, earning, spending, economy balance
- Decision: Not needed for Phase 1 prototype validation
- Timeline: Phase 2-3 implementation

### Fame System

**Status**: ⚪ ALL DEFERRED TO PHASE 2+
- Fame earning, benefits
- Decision: Not needed for Phase 1 prototype
- Timeline: Phase 3+ implementation

### Progression Pacing

**Status**: ⚪ ALL DEFERRED TO PHASE 2+
- New player experience, mid-game, end-game progression
- Decision: Will be designed based on Phase 1 feedback
- Timeline: Phase 2-3 implementation

---

## Trading and Marketplace

**Overall Status**: ⚪ DEFERRED - Post-MVP feature (GAME_DESIGN.md confirms)

**Status**: ⚪ ALL TRADING FEATURES DEFERRED
- Not in Phase 1 prototype
- Not in MVP (marked as Post-MVP in GAME_DESIGN.md line 311)
- Decision: Will be designed after core game is validated
- Timeline: Post-MVP (Phase 6+)

---

## Matchmaking System

**Overall Status**: 🟡 SIMPLIFIED FOR PHASE 1 - Full system in Phase 2+

### 1v1 Matchmaking

**Status**: 🟡 SIMPLIFIED
- **Phase 1**: Manual robot selection for battles (no matchmaking)
- **Phase 2+**: Implement proper matchmaking system
- **Details**: All matchmaking questions deferred to Phase 2

### Team Battles (Future)

**Status**: ⚪ DEFERRED
- Marked as future feature in GAME_DESIGN.md
- Not in MVP scope
- Timeline: Post-MVP

---

## Tournament System

**Overall Status**: ⚪ DEFERRED - Marked as "Important Feature" but post-MVP

**Status**: ⚪ ALL TOURNAMENT FEATURES DEFERRED
- Not in Phase 1 prototype
- Important post-MVP feature (GAME_DESIGN.md line 141-144)
- Decision: Will be designed after MVP launch
- Timeline: Post-MVP (Phase 5-6)

---

## Social Features Priority

**Overall Status**: ⚪ DEFERRED - All marked as post-MVP in GAME_DESIGN.md

### Guild System
**Status**: ⚪ DEFERRED TO POST-MVP

### Friend System
**Status**: ⚪ DEFERRED TO POST-MVP

### Leaderboards
**Status**: ⚪ DEFERRED TO POST-MVP

**Note**: All social features confirmed as post-MVP in GAME_DESIGN.md (line 309-317)

---

## Technical Implementation Questions

**Overall Status**: 🟢 MOSTLY ANSWERED - Core decisions made, some details need confirmation

### Local Development Setup

**Status**: 🟢 ANSWERED IN PHASE1_PLAN.md

1. **Development Stack** - 🟢 DECIDED
   - **Decision**: Docker Compose for local services
   - **PostgreSQL**: Any recent version (14+)
   - **Redis**: Latest stable
   - **Node.js**: LTS version (18+ or 20+)
   - **Status**: Specified in PHASE1_PLAN.md

2. **Development Database** - 🟢 DECIDED
   - **Seed Data**: Yes, for testing (PHASE1_PLAN.md line 77)
   - **Migration Strategy**: Database migrations tool (ORM-based)
   - **Test Data**: Seed script will generate
   - **Status**: Approach defined

3. **Local Battle Processing** - 🟢 DECIDED
   - **Decision**: Manual trigger for Phase 1 development (PHASE1_PLAN.md line 101-104)
   - **Future**: Cron/scheduled processing for Phase 2+
   - **Status**: Clear approach for prototype

### AWS Migration Strategy

**Status**: ⚪ DEFERRED - Not needed until Phase 2, but strategy documented

1. **Initial AWS Services** - 🟡 PARTIALLY DECIDED
   - **Current Decision**: AWS with serverless architecture (GAME_DESIGN.md, ARCHITECTURE.md)
   - **Remaining Question**: Specific AWS services (Lambda vs ECS vs Fargate) - can decide in Phase 2
   - **Status**: High-level strategy clear, details deferred

2. **Serverless Architecture** - 🟡 GENERAL STRATEGY CLEAR
   - **Decision**: Serverless where possible for cost control
   - **Details**: Specific service choices deferred to Phase 2
   - **Status**: Philosophy defined, implementation details later

3. **Cost Management** - 🟢 STRATEGY DEFINED
   - **Decision**: Free tier, scale-to-zero, managed services
   - **Documented**: ARCHITECTURE.md lines 271-274
   - **Status**: Clear strategy

4. **Deployment Pipeline** - ⚪ DEFERRED
   - **Status**: Phase 2 feature (ROADMAP.md Phase 2.1)
   - **Decision**: Will use GitHub Actions
   - **Timeline**: Phase 2 implementation

---

## Data Schema Questions

**Overall Status**: 🟢 PHASE 1 SCHEMA DEFINED - Full schema deferred to Phase 2

### Database Design

**Status**: 🟢 MINIMAL SCHEMA FOR PHASE 1 READY

1. **User Data** - 🟢 SPECIFIED
   - **Phase 1**: Minimal (id, username, password_hash) - PHASE1_PLAN.md lines 126-133
   - **Phase 2+**: Expand with full profile, preferences, social connections
   - **Status**: Prototype schema ready

2. **Robot Data** - 🟢 SPECIFIED
   - **Phase 1**: Full robot table defined (PHASE1_PLAN.md lines 135-152)
   - **Status**: Ready for Phase 1 implementation

3. **Battle Data** - 🟢 SPECIFIED
   - **Phase 1**: Battle table with JSON log (PHASE1_PLAN.md lines 174-189)
   - **Status**: Ready for Phase 1 implementation

4. **Indexes and Performance** - 🟡 DEFERRED
   - **Status**: Add during Phase 2 based on actual usage patterns
   - **Decision**: Start simple, optimize when needed

---

## Art and Visual Design

**Overall Status**: ⚪ INTENTIONALLY OPEN - Placeholder art acceptable for MVP

### Visual Style

**Status**: ⚪ DEFERRED - All design questions remain open

**Decision**: Use placeholder/basic UI for Phase 1 prototype (GAME_DESIGN.md lines 378-386)
**Rationale**: Focus on gameplay mechanics first, polish later
**Timeline**: Post-MVP consideration

### Asset Creation

**Status**: ⚪ DEFERRED - Not critical for Phase 1

**Decision**: Placeholder graphics acceptable for MVP (GAME_DESIGN.md line 445-448)
**Timeline**: Address after core gameplay validated

---

## Testing Strategy Details

**Overall Status**: 🟡 STRATEGY DEFINED - Automated testing deferred to Phase 2

### Battle Simulation Testing

**Status**: 🟡 MANUAL FOR PHASE 1, AUTOMATED FOR PHASE 2

1. **Unit Tests** - 🟡 DEFERRED TO PHASE 2
   - **Phase 1**: Manual testing of battle algorithm
   - **Phase 2**: Comprehensive automated test suite (ROADMAP.md Phase 2.4)
   - **Status**: Strategy documented in TESTING_STRATEGY.md

2. **Integration Tests** - ⚪ DEFERRED TO PHASE 2
   - **Status**: Not in Phase 1 scope (PHASE1_PLAN.md confirms)
   - **Timeline**: Phase 2.4 implementation

3. **Balance Testing** - 🟢 APPROACH DEFINED
   - **Phase 1**: Manual playtesting with friends
   - **Phase 2+**: Automated simulation analysis
   - **Status**: Clear testing approach

---

## Analytics and Metrics

**Overall Status**: ⚪ DEFERRED - Post-MVP feature

### Data Collection

**Status**: ⚪ ALL DEFERRED
- Not in Phase 1 prototype
- Not in MVP scope
- Decision: Add after launch based on needs
- Timeline: Phase 6+ (GAME_DESIGN.md mentions as post-MVP)

### Analytics Tools

**Status**: ⚪ DEFERRED
- Decision: Will be chosen when implementing analytics
- Timeline: Post-MVP

---

## Content Moderation

**Overall Status**: ⚪ DEFERRED - Not needed for Phase 1/small user base

### User-Generated Content

**Status**: ⚪ DEFERRED
- Not relevant for Phase 1 (testing with friends)
- Will be designed when approaching public beta
- Timeline: Phase 6 (Beta Launch)

---

## Legal and Administrative

**Overall Status**: 🟡 STRATEGY CLEAR - Detailed implementation deferred

### Terms and Policies

**Status**: 🟡 REQUIREMENTS DOCUMENTED
- **Decision**: Must have Terms of Service, Privacy Policy before public launch
- **Timeline**: Before Phase 6 (Beta Launch)
- **Status**: Requirements clear in SECURITY.md, implementation later

### Compliance

**Status**: 🟡 STRATEGY DOCUMENTED
- **Decision**: GDPR compliance required (SECURITY.md, GAME_DESIGN.md)
- **Timeline**: Must be ready before beta launch (Phase 6)
- **Status**: Requirements documented, implementation during Phase 4-5

### Intellectual Property

**Status**: ⚪ DEFERRED
- Not urgent for prototype/MVP
- Timeline: Before public launch

---

## Launch Strategy Details

**Overall Status**: ⚪ DEFERRED - Post-MVP planning

### Beta Testing

**Status**: ⚪ DEFERRED - Will be planned in Phase 5

**Timeline**: Phase 6 (ROADMAP.md)

### Marketing

**Status**: ⚪ DEFERRED
- Not needed for Phase 1 prototype
- Will be planned before public launch
- Timeline: Phase 6-7

---

## Prioritization Summary

### ✅ ANSWERED & READY (No Action Needed)
The following have been answered and documented:
- Battle simulation core mechanics
- Damage calculation formula
- Victory conditions
- Action resolution order
- Robot component system basics (chassis, weapons, armor)
- Phase 1 database schema
- Local development setup approach
- Battle processing for prototype (manual trigger)
- Testing approach for Phase 1 (manual, automated in Phase 2)

### 🔴 CRITICAL - Must Answer BEFORE Starting Phase 1
1. **Backend Framework Decision** (Express vs Fastify) - Inconsistency #1
2. **Database ORM/Migration Tool** (TypeORM vs Prisma) - Inconsistency #4
3. **Current Project Status Confirmation** - Are we ready for Phase 1? - Inconsistency #8

### 🟡 HIGH PRIORITY - Answer DURING Early Phase 1
1. **Battle Processing Schedule for MVP** (#5) - How often do battles run?
2. **Authentication for Prototype** (#6) - Hardcode user or implement basic auth?
3. **Real-time vs Batch** (#2) - Clarify notification strategy
4. **UI Component Library** (#9) - Material-UI, Tailwind, or basic HTML/CSS?

### 🟢 MEDIUM PRIORITY - Answer During Phase 1 Development
1. **Phase Numbering System** (#3) - Consolidate or rename to avoid confusion
2. **Monorepo Structure Timeline** (#10) - When to implement?
3. **Component Stat Balance** - Refine through playtesting

### ⚪ LOW PRIORITY - Can Be Addressed Anytime
1. **Documentation Date Standardization** (#7)
2. **Art and Visual Design** - Using placeholders for now
3. **All Post-MVP Features** - Economy, trading, tournaments, social features, etc.

### ⚪ DEFERRED - Post-MVP (No Action Needed Now)
- Economy and currency system
- Trading and marketplace
- Tournament system
- Guild system and social features
- Advanced matchmaking
- Team battles
- Conditional triggers
- Analytics and metrics
- Content moderation
- Marketing and launch strategy

---

## Summary: What's Blocking Phase 1 Start?

### CRITICAL BLOCKERS (Must Resolve First)
1. ⚠️ **Backend Framework**: Express or Fastify?
2. ⚠️ **ORM Tool**: TypeORM or Prisma?
3. ⚠️ **Status Confirmation**: Is Phase 0 truly complete and ready for Phase 1?

### RECOMMENDED (Should Clarify Soon)
4. 🟡 **Battle Schedule**: Once per day? Multiple times? Manual trigger?
5. 🟡 **Auth Approach**: Hardcode, basic auth, or full OAuth for prototype?

### MINOR (Can Decide During Development)
6. 🟢 **UI Library**: Material-UI, Tailwind, or bare-bones?
7. 🟢 **Real-time Strategy**: WebSockets for notifications, or pure batch?

--> Stop making summaries of summaries. This is already covered above. Remove this section.

---

## Questions for Robert

Before proceeding with Phase 1 implementation, please provide guidance on:

### 1. Critical Decisions (Must Answer)
- **Backend Framework**: Should we use Express (more familiar, larger ecosystem) or Fastify (better performance)? I recommend **Express** for simplicity.
- **ORM/Migrations**: Should we use TypeORM or Prisma? I recommend **Prisma** (better TypeScript support, easier migrations).
- **Ready for Phase 1?**: Confirm we have everything needed to start implementation.

--> Answered. Again, this is double/triple. Don't do this. 

### 2. High Priority (Should Answer)
- **Battle Schedule**: For the prototype, should battles run:
  - On-demand/manual trigger (simplest for testing)?
  - Once per day at a set time?
  - Multiple times per day?
- **Prototype Authentication**: Should we:
  - Hardcode a single test user (fastest)?
  - Implement basic username/password (tests the flow)?
  - Implement OAuth from start (more work but production-ready)?
 
--> Answered. Again, this is double/triple. Don't do this. 

### 3. Clarifications Helpful
- **Real-time Features**: Are notifications/updates truly batch-only, or do we need WebSockets for anything?
- **Phase Naming**: Should we rename "Module Phases" to avoid confusion with "Project Phases"?
- **UI Component Library**: Should prototype use a component library (faster, prettier) or basic HTML/CSS (simpler, no dependencies)?

--> Answered. Again, this is double/triple. Don't do this. 

---

## Additional Questions Before Building Prototype

Beyond the inconsistencies found, here are additional clarifications that would help:

### Development Process
1. **Time Commitment**: How many hours per week can you dedicate to this project?
   - Affects whether 4-8 week timeline is realistic
  
--> This really doesn't matter. It's you and me. You're always available, I work on it when I can. Not for you to worry about. Remove all the references to timelines. Keep the roadmap in versions instead. 

2. **Development Style**: Do you prefer:
   - Pair programming style (work together in real-time)?
   - Async style (I build, you review)?
   - Hybrid?
  
--> We go for Async. You build, I review. 

### Prototype Testing
3. **Friend Group Size**: How many friends will test the prototype?
   - Affects whether we need multiple simultaneous battles
  
--> Probably a total of 6 people. So 6 accounts (logins) where they can click around, but still all local on my machine. 

4. **Feedback Goals**: What's the main question you want answered?
   - "Is the core concept fun?"
   - "Are the mechanics balanced?"
   - "Is the UI intuitive?"
   - All of the above?
  
--> All of the above and more. The testers will have different focuses. For them it's probably mainly the UI, for me it's to balance the gameplay / robot stats / currency system / battle mechanics.

### Technical Preferences
5. **Learning vs Speed**: Would you rather:
   - Use familiar tools to move faster?
   - Learn new tools that might be better long-term?

--> I always prefer long term. So go slower if this means it makes the migration to AWS easier, for example. 

6. **IDE/Editor**: What development environment do you use?
   - VS Code, WebStorm, other?
   - Helps ensure setup instructions are clear
  
--> I have you in GitHub Copilot, I have VS Code and I have Kiro. Setup instructions in order to start testing from my side would be useful.

### Scope Flexibility
7. **Must-Have for Demo**: What absolutely must work for the prototype demo?
   - Robot creation?
   - Battle simulation?
   - Battle results viewing?
   - All of the above?
  
--> All of the above and (simple) user management, stable management, robot upgrading (so currency system)

8. **Nice-to-Have**: What can we skip if we run short on time?
   - Battle replay visualization?
   - Robot comparison tools?
   - Battle history?
  
--> We'll make everything text based, no fancy animations in the prototype. So no visualizations, no comparisons. Battle history is integral, keep that in the prototype.

---

## Recommended Next Actions

1. **Resolve Critical Blockers** (This Week)
   - Decide: Express or Fastify → Recommend **Express**
   - Decide: TypeORM or Prisma → Recommend **Prisma**
   - Confirm: Ready to start Phase 1

--> I already asked you to pick above. Go ahead. Confirmed. 

2. **Answer High Priority Questions** (This Week)
   - Battle processing schedule for prototype
   - Authentication approach for prototype
  
--> Already answered. 

3. **Begin Phase 1 Implementation** (Next Week)
   - Set up development environment
   - Initialize project with chosen stack
   - Create database schema
   - Begin battle engine development
  
--> Yes we can proceed after we have all documentation cleaned and confirmed. 

4. **Iterate on Questions During Development**
   - Answer remaining questions as they become relevant
   - Update documentation with decisions made
   - Keep QUESTIONS.md current
  
--> Yes, keep QUESTIONS.md current, but this applies to ALL documentation. 

---

**Document Status**: ✅ COMPREHENSIVE REVIEW COMPLETE  
**Last Updated**: January 24, 2026  
**Review Date**: January 24, 2026  
**Reviewer**: AI Development Assistant  
**Current Phase**: Phase 0 Complete, Awaiting Clarifications to Start Phase 1

**Next Review**: After Phase 1 decisions are made and implementation begins
