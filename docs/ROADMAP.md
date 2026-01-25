# Armoured Souls - Development Roadmap

## Overview

This document outlines the development roadmap for Armoured Souls, from planning through launch and beyond.

---

# Armoured Souls - Development Roadmap

**Last Updated**: January 24, 2026

## Overview

This document outlines the development roadmap for Armoured Souls, from planning through launch and beyond. The project is organized into distinct phases (0-9), with each phase representing a major milestone. Timeline estimates have been removed in favor of a version-based approach - phases complete when ready, not by arbitrary dates.

---

## Current Status: Phase 0 - Planning ✅

**Status**: Complete  
**Completed**: January 24, 2026  
**Goal**: Define architecture, modules, and answer key design questions

### Completed
- ✅ Project scaffolding created
- ✅ Module structure defined
- ✅ Architecture documentation
- ✅ Security strategy documented
- ✅ Testing strategy defined
- ✅ Portability strategy outlined
- ✅ All critical questions answered and documented
- ✅ Technology stack finalized:
  - Backend: Node.js + TypeScript + Express + Prisma
  - Frontend: React + Tailwind CSS
  - Database: PostgreSQL + Redis
- ✅ MVP scope defined: User management, robot management, stable management, robot upgrading, 1v1 matches
- ✅ Game design documented: Scheduled battle system inspired by Football Manager
- ✅ Development approach: Local first → AWS serverless
- ✅ Team composition: 2-person team (Robert + AI, async development style)

### Key Decisions Made
- **Battle System**: Scheduled batch processing for battles; WebSockets/Web Push for notifications
- **Target Audience**: Casual players, 15-30 min/day engagement
- **Monetization**: Free-to-play with optional in-game currency purchases
- **Platform Priority**: Web first, mobile later (iOS before Android)
- **Hosting**: AWS with serverless architecture, scale-to-zero capability
- **Game Mechanics**: Football Manager-style - configure robots, view battle outcomes
- **Development Style**: Async (AI builds, Robert reviews)
- **Prototype Testing**: 6 user accounts for local testing

### Ready for Phase 1
- ✅ All critical design questions answered
- ✅ Technology stack finalized (Express, Prisma, Tailwind CSS)
- ✅ MVP scope clearly defined
- ✅ Development style and workflow established
- ✅ Prototype requirements documented

---

## Phase 1: Local Prototype / Proof of Concept

**Goal**: Create a working local prototype to demonstrate core game mechanics to friends

**Status**: Ready to begin  
**Detailed Plan**: See PHASE1_PLAN.md for complete specifications

### Scope Summary
- User management (6 test accounts + admin)
- Robot creation and upgrading  
- Stable management
- Battle simulation (manual trigger)
- Battle history
- Simple currency system
- Text-based UI (React + Tailwind CSS)

### Technology Stack
- Backend: Express + Prisma + PostgreSQL
- Frontend: React + Tailwind CSS
- Testing: Automated on every commit
- Structure: Isolated `/prototype` directory

### Success Criteria
- Core gameplay loop works
- 6 friends can test simultaneously
- Battle mechanics are fun and balanced
- Technical foundation validates architectural decisions

**Detailed Requirements**: See PHASE1_PLAN.md

### Implementation Priority

**Module Development Strategy**: See MODULE_STRUCTURE.md for complete module organization and dependencies.

**Phase 1a - Core Prototype (Time-Based Combat):**
1. Update database schema (see DATABASE_SCHEMA.md for authoritative source)
2. Add robot state tracking fields (currentHP, currentShield, elo, wins, losses, etc.)
3. Implement loadout system (4 configurations: weapon+shield, two-handed, dual-wield, single)
4. Add yield threshold logic (player sets HP %, repair_cost_multiplier = 2.0x for destroyed robots)
5. Implement time-based combat with all formulas (see ROBOT_ATTRIBUTES.md)
6. Update repair cost formula with repair_cost_multiplier
7. Update HP calculation: `max_hp = hullIntegrity × 10`
8. Add stance system (offensive/defensive/balanced pre-battle settings)
9. Implement energy shields as separate HP pool with regeneration

**Phase 1b - Weapon & Equipment System:**
1. Add Shield weapon type and equipment
2. Update weapon system with all properties (cooldown, handsRequired, specialProperty, attribute bonuses)
3. Implement weapon crafting system (requires Workshop Level 3)
4. Test and balance all combat formulas

**Phase 1c - Stable System:**
1. Add stable-level tracking (prestige, totalBattles, totalWins, highestELO)
2. Implement Facility model for stable upgrades (11 facility types)
3. Add facility upgrade mechanics (10 levels per facility, see STABLE_SYSTEM.md)
4. Implement daily income/expense system with revenue streams
5. Coach hiring system (Coaching Staff facility)
6. Prestige milestones and unlocks

### Database Setup (No Migration Needed)

Since this is a prototype with no existing data:

1. **Copy complete schema** from DATABASE_SCHEMA.md to `prisma/schema.prisma`
2. **Generate database**: `npx prisma migrate dev --name init`
3. **Run seed script**: `npx prisma db seed`

See DATABASE_SCHEMA.md for the authoritative, complete schema definition.

### Key Schema Notes

**Current Attribute Names** (never use old names):
- combatPower, targetingSystems, criticalSystems, penetration, weaponControl, attackSpeed, shieldCapacity, hydraulicSystems
- See ROBOT_ATTRIBUTES.md for all 23 attributes

**Key Fields**:
- Robot: currentHP, currentShield, loadout, stance, yieldThreshold, currentLeague, leagueId, fame
- Weapon: weaponType includes "shield" for shield weapons (separate from energy shields)
- User: prestige (never spent), totalBattles, totalWins, highestELO
- Facility: facilityType, level (0-10), maxLevel (10)

**Models**:
- User, Robot, Weapon, Battle, Facility
- Shield weapons are Weapon type with weaponType="shield"

---

## Phase 2: Foundation & Infrastructure

**Goal**: Make the prototype production-ready with proper infrastructure and security

**Prerequisites**: Phase 1 prototype validated by testing

### Scope
- Working API that frontend can call
- Postman/REST Client collection for testing
- Basic error handling

### 1.5 Minimal Web UI (Week 3-4)

Simple React interface to interact with the game:

**Page 1: Robot List**
- [ ] Display all available robots in a grid/list
- [ ] Show robot stats (attack, defense, speed, health)
- [ ] Button to create new robot (simple form)
- [ ] Button to edit robot stats

**Page 2: Battle Setup**
- [ ] Select two robots to fight
- [ ] Button to "Schedule Battle" (which runs immediately for prototype)
- [ ] Show battle is processing

**Page 3: Battle Results**
- [ ] List of all battles (most recent first)
- [ ] Click to view detailed battle log
- [ ] Show turn-by-turn actions
- [ ] Highlight winner
- [ ] Basic styling (doesn't need to be pretty)

**Page 4: Robot Creator (Simple)**
- [ ] Form to set robot name
- [ ] Sliders or inputs for stats (attack, defense, speed)
- [ ] Points system (e.g., 100 points to distribute)
- [ ] Select one weapon, one armor from preset options

**Deliverables**:
- Working web interface
- Can create robots
- Can schedule battles
- Can view battle results
- Responsive enough to work on laptop and phone browser

### 1.6 Robot Component System (Week 4)

Add basic customization:

- [ ] **Weapons** (5-10 preset weapons)
  - Sword: +10 attack
  - Laser: +15 attack, -5 defense
  - Hammer: +8 attack, -2 speed
  - etc.

- [ ] **Armor** (5-10 preset armor types)
  - Heavy: +15 defense, -5 speed
  - Light: +5 defense, +3 speed
  - Shield: +10 defense
  - etc.

- [ ] **Chassis** (3-5 types)
  - Tank: High health, low speed
  - Scout: Low health, high speed
  - Balanced: Medium all stats

- [ ] Integrate components into battle simulation
- [ ] Update UI to show equipped components

**Deliverables**:
- Robots can equip weapons and armor
- Components affect battle outcomes
- Different builds create different strategies

### 1.7 Testing & Refinement (Week 4)

- [ ] Run multiple battle simulations to test balance
- [ ] Fix bugs discovered during testing
- [ ] Adjust damage formulas if needed
- [ ] Add battle log replay visualization (if time permits)
- [ ] Performance test: can it handle 100 battles in a batch?

**Deliverables**:
- Stable prototype
- Known issues documented
- Battle balance roughly working

### 1.8 Demo Preparation (End of Week 4)

- [ ] Create 10-15 interesting pre-configured robots with different builds
- [ ] Pre-run some interesting battles for demonstration
- [ ] Write quick-start guide for friends
- [ ] Ensure Docker setup works on fresh machine
- [ ] Create a "demo script" showing off features

**Deliverables**:
- Working prototype ready to show friends
- Easy setup process documented
- Interesting demo content pre-loaded

---

## What's NOT in Phase 1 Prototype

To keep scope minimal and deliverable:

**Authentication & Security**
- ❌ No proper user authentication (hardcoded test user is fine)
- ❌ No password hashing
- ❌ No JWT tokens
- ❌ No rate limiting
- ❌ No input validation (beyond basic)

**Production Features**
- ❌ No deployment to AWS
- ❌ No CI/CD pipeline
- ❌ No automated testing (manual testing is fine)
- ❌ No logging infrastructure
- ❌ No monitoring

**Advanced Game Features**
- ❌ No matchmaking system
- ❌ No ranking/leaderboards  
- ❌ No currency or economy
- ❌ No achievements
- ❌ No social features
- ❌ No guild system
- ❌ No tournaments
- ❌ No multiple battle modes

**UI Polish**
- ❌ No fancy animations
- ❌ No professional design
- ❌ No accessibility features
- ❌ No loading states (basic is fine)
- ❌ No error recovery

**Data Persistence**
- ❌ No database backups
- ❌ No migrations rollback
- ❌ No data validation

---

## Phase 1 Success Criteria

The prototype is successful if you can demonstrate:

1. ✅ **Core Concept**: Friend can create a robot and understand the stat system
2. ✅ **Battle System**: Can schedule a battle and see interesting results
3. ✅ **Strategy**: Different robot builds lead to different outcomes
4. ✅ **Feedback Loop**: Can adjust robot based on battle results and retry
5. ✅ **Fun Factor**: Friends find it interesting and want to play more battles
6. ✅ **Technical Viability**: System can process battles quickly and reliably

### Questions to Answer During Phase 1

**Game Mechanics**:
- Is the battle simulation interesting to watch/read?
- Are the stat ranges balanced?
- Do different builds feel meaningfully different?
- Is it fun to tinker with robot configurations?
- What's missing that would make it more engaging?

**Technical**:
- Can the battle engine handle batch processing?
- Is the architecture scalable to Phase 2?
- Are there performance bottlenecks?
- What technical debt are we creating?

**UX**:
- Is the robot creation process intuitive?
- Is the battle log readable and interesting?
- What UI improvements are most critical?

---

## Phase 1 Deliverables Summary

**Code**:
- Node.js backend with battle simulation engine
- React frontend with 4 basic pages
- PostgreSQL database with minimal schema
- Docker Compose setup for local development

**Documentation Updates**:
- Battle simulation algorithm specification
- Component stat tables and formulas
- Setup and run instructions
- Known issues and limitations

**Demo Assets**:
- 10-15 pre-configured robots
- Sample battle logs
- Demo script for showing friends

---

## Phase 1 Timeline

| Week | Focus | Deliverable |
|------|-------|-------------|
| Week 1 | Setup & Schema | Dev environment + database |
| Week 2 | Battle Engine + API | Working simulation |
| Week 3 | Basic UI | Can create robots and view battles |
| Week 4 | Components + Polish | Complete prototype ready to demo |

**Total Duration**: 4-8 weeks (depending on available time per week)

---

## After Phase 1: Lessons Learned

At the end of Phase 1, we will:
1. Document all lessons learned
2. Update game design based on playtesting feedback
3. Refine battle mechanics and balance
4. Update architecture decisions if needed
5. Plan Phase 2 based on what worked/didn't work
6. Decide if we need to pivot or continue as planned

---

**Phase 2 Preview**: Once prototype is validated, Phase 2 will focus on making it production-ready with proper authentication, deployment to AWS, real user accounts, and the matchmaking system.

---

## Phase 2: Foundation & Infrastructure (Estimated: 2-3 months)

**Goal**: Make the prototype production-ready with proper infrastructure and security

### 2.1 Development Environment Enhancement
- [ ] Configure CI/CD pipeline (GitHub Actions)
- [ ] Set up automated testing framework
- [ ] Configure code coverage tracking
- [ ] Security scanning integration (SAST)
- [ ] Set up staging environment

### 2.2 Authentication & Security
- [ ] Proper user registration system
- [ ] Secure login/logout with JWT
- [ ] Password hashing (bcrypt)
- [ ] Password reset flow
- [ ] Email verification
- [ ] Rate limiting
- [ ] Input validation and sanitization
- [ ] CSRF protection

### 2.3 Database & Data Layer
- [ ] Expand database schema for production
- [ ] Add database indexes for performance
- [ ] Set up database backups
- [ ] Implement data validation
- [ ] Add audit logging
- [ ] Connection pooling optimization

### 2.4 Testing Infrastructure
- [ ] Unit tests for battle engine
- [ ] Integration tests for API
- [ ] End-to-end tests for critical flows
- [ ] Load testing setup
- [ ] Automated test runs in CI/CD

**Deliverables**:
- Production-ready authentication system
- Comprehensive test coverage
- Security hardened application
- CI/CD pipeline operational

---

## Phase 3: Core Game Mechanics (Estimated: 3-4 months)

**Goal**: Expand game features based on Phase 1 learnings

### 3.1 Player Module
- [ ] Player profile system
- [ ] Player statistics tracking
- [ ] Achievement system (basic)
- [ ] Player inventory
- [ ] Currency management

### 3.2 Robot Module
- [ ] Robot creation system
- [ ] Robot stats and attributes
- [ ] Robot component system
- [ ] Robot upgrade mechanics
- [ ] Robot storage/management

### 3.3 Stable Module
- [ ] Stable creation
- [ ] Robot organization
- [ ] Team composition
- [ ] Loadout management

### 3.4 Game Engine (Enhanced)
- [ ] Battle rules definition
- [ ] Turn/action processing
- [ ] Game state management
- [ ] Resource management
- [ ] Leveling system

### 3.5 Battle Module (Enhanced)
- [ ] Battle initialization
- [ ] Combat simulation
- [ ] Damage calculation
- [ ] Battle outcomes
- [ ] Battle logs

**Deliverables**:
- Players can create and manage robots
- Basic battle system functional
- Core game loop working

---

## Phase 4: Web UI (Estimated: 2-3 months)

**Goal**: Create polished web-based user interface

### 4.1 UI Foundation
- [ ] React app setup
- [ ] Component library creation
- [ ] Routing setup
- [ ] State management
- [ ] API client integration

### 4.2 Core Pages
- [ ] Landing page
- [ ] Registration/login pages
- [ ] Player dashboard
- [ ] Robot creation/management
- [ ] Stable management

### 4.3 Battle UI
- [ ] Battle arena visualization
- [ ] Battle controls
- [ ] Real-time battle updates (if applicable)
- [ ] Battle results screen
- [ ] Battle history

### 4.4 Polish
- [ ] Responsive design
- [ ] Loading states
- [ ] Error handling UI
- [ ] Accessibility improvements
- [ ] Performance optimization

**Deliverables**:
- Fully functional web application
- Complete user experience flow
- Responsive design for all devices

---

## Phase 5: Multiplayer & Advanced Features (Estimated: 2-3 months)

**Goal**: Add multiplayer and social features

### 5.1 Matchmaking Module
- [ ] Matchmaking queue system
- [ ] Skill-based matching
- [ ] Match creation
- [ ] Bot opponents (if needed)

### 5.2 Real-time Features
- [ ] WebSocket integration
- [ ] Live battle updates
- [ ] Real-time notifications
- [ ] Online presence

### 5.3 Social Features
- [ ] Friend system
- [ ] In-game chat
- [ ] Leaderboards
- [ ] Replay sharing
- [ ] Spectator mode (stretch goal)

### 5.4 Advanced Game Modes
- [ ] Ranked battles
- [ ] Tournaments
- [ ] Special events
- [ ] Campaign missions (if applicable)

**Deliverables**:
- Multiplayer matchmaking
- Social features
- Multiple game modes
- Leaderboards and rankings

---

## Phase 6: Beta Launch (Estimated: 1 month)

**Goal**: Launch to limited audience for testing

### 6.1 Pre-Launch
- [ ] Security audit
- [ ] Load testing
- [ ] Bug fixes from testing
- [ ] Documentation completion
- [ ] Terms of Service / Privacy Policy
- [ ] Marketing materials

### 6.2 Beta Program
- [ ] Limited user invitations
- [ ] Feedback collection system
- [ ] Monitoring and analytics
- [ ] Bug tracking
- [ ] Performance monitoring

### 6.3 Iteration
- [ ] Address critical feedback
- [ ] Fix major bugs
- [ ] Performance optimization
- [ ] Balance adjustments

**Deliverables**:
- Beta version live
- User feedback collected
- Critical issues resolved

---

## Phase 7: Official Launch (Estimated: 1 month)

**Goal**: Full public launch

### 7.1 Launch Preparation
- [ ] Final security review
- [ ] Scalability testing
- [ ] Final bug fixes
- [ ] Marketing campaign
- [ ] Support system ready

### 7.2 Launch
- [ ] Open registration
- [ ] Marketing push
- [ ] Community management
- [ ] 24/7 monitoring
- [ ] Rapid response to issues

### 7.3 Post-Launch
- [ ] Gather user feedback
- [ ] Monitor metrics (DAU, retention, etc.)
- [ ] Quick iteration on issues
- [ ] Community engagement

**Deliverables**:
- Public web version live
- Growing user base
- Stable, performant system

---

## Phase 8: Mobile Development (Estimated: 4-6 months)

**Goal**: Launch iOS and Android apps

### 8.1 Mobile Strategy Finalization
- [ ] Confirm React Native vs alternatives
- [ ] Set up monorepo structure
- [ ] Refactor web code for sharing

### 8.2 Mobile Development
- [ ] React Native setup
- [ ] Shared code integration
- [ ] Mobile-specific UI
- [ ] Native features integration
- [ ] Push notifications
- [ ] Deep linking

### 8.3 iOS Development
- [ ] iOS-specific features
- [ ] TestFlight beta
- [ ] App Store submission
- [ ] App Store optimization

### 8.4 Android Development
- [ ] Android-specific features
- [ ] Play Console beta
- [ ] Play Store submission
- [ ] Play Store optimization

### 8.5 Mobile Testing & Launch
- [ ] Beta testing
- [ ] Bug fixes
- [ ] Performance optimization
- [ ] Official launch

**Deliverables**:
- iOS app on App Store
- Android app on Play Store
- Cross-platform sync working

---

## Phase 9: Post-Launch & Growth (Ongoing)

**Goal**: Maintain, improve, and grow the game

### 9.1 Continuous Improvement
- [ ] Regular content updates
- [ ] New features based on feedback
- [ ] Balance updates
- [ ] Bug fixes
- [ ] Performance improvements

### 9.2 Growth Features
- [ ] Guilds/clans
- [ ] Guild wars
- [ ] Advanced social features
- [ ] More game modes
- [ ] Seasonal content

### 9.3 Monetization (if applicable)
- [ ] Monetization strategy implementation
- [ ] In-app purchases
- [ ] Premium features
- [ ] Payment integration

### 9.4 Analytics & Optimization
- [ ] User behavior analysis
- [ ] A/B testing
- [ ] Retention optimization
- [ ] Conversion optimization

---

## Future Ideas & Enhancements

Features and systems to consider for future development. These are not yet planned for specific phases.

### Design Discussions Needed

- **Prestige vs Fame System**:
  - **Current**: Prestige (stable-level) and Fame (robot-level) are separate
  - **To Discuss**: 
    - How do prestige and fame interact?
    - Should prestige be earned only from tournaments or also from battles?
    - Should fame contribute to prestige in any way?
    - Do they unlock different types of content?
    - Economic balance between the two systems
  - **Status**: Requires detailed design discussion

- **Tournament System Design**:
  - **Current**: Tournaments mentioned but not fully detailed
  - **To Discuss**:
    - Tournament types (local, regional, championship, world)
    - Entry requirements (Credits cost, prestige threshold, ELO rating?)
    - Tournament structure (single elimination, Swiss, round-robin)
    - Reward structure (Credits, prestige, fame, exclusive items)
    - How tournaments affect robot/stable rankings
    - Tournament frequency and scheduling
    - Special tournament rules and formats
  - **Status**: Requires comprehensive design specification

### Advanced Combat Mechanics
- **Range System**: Multiple range bands (short/medium/long) beyond just melee vs ranged
  - Different weapons perform better at different ranges
  - Positioning mechanics with range advantages
  - See ROBOT_ATTRIBUTES.md for melee/ranged distinction currently implemented

- **Status Effects System**: 
  - Stun, slow, buff, debuff mechanics
  - Duration-based effects
  - Cleanse/dispel abilities
  - Currently not implemented - combat is direct damage only

### Stable Enhancements (From STABLE_SYSTEM.md)
- **Stable vs Stable Wars**: Team battles between stables
- **Alliances**: Form alliances with other stables for shared bonuses
- **Stable Customization**: Custom logos, colors, banners
- **Staff Management**: Hire technicians, analysts, scouts
- **Sponsorships**: Stable sponsors provide Credits/bonuses in exchange for performance
- **Stable Rankings**: Global leaderboards for stables
- **Legacy System**: Retired robot bonuses, historical achievements
- **Training Programs**: Long-term attribute development options

### Additional Game Modes
- Arena battles (2v2, 3v3) with team coordination
- Tournaments with bracket systems (see Design Discussions above)
- Special events and challenges
- Seasonal leagues

---

## Key Milestones

| Milestone | Target Date | Status |
|-----------|-------------|--------|
| Planning Complete | Complete | ✅ Done |
| Local Prototype Ready | TBD | 🟡 In Progress |
| Prototype Validated by Friends | TBD | ⚪ Not Started |
| Development Environment Ready | TBD | ⚪ Not Started |
| Authentication Working | TBD | ⚪ Not Started |
| Core Game Mechanics Complete | TBD | ⚪ Not Started |
| Web UI Alpha | TBD | ⚪ Not Started |
| Beta Launch | TBD | ⚪ Not Started |
| Official Web Launch | TBD | ⚪ Not Started |
| Mobile Beta | TBD | ⚪ Not Started |
| Mobile Launch | TBD | ⚪ Not Started |

---

## Dependencies & Risks

### Critical Path Items
1. ✅ Design decisions (battle mechanics, tech stack) - COMPLETE
2. **Phase 1 Prototype** - Validates core game concept
3. Battle simulation engine - Proves the game is fun
4. Friends' feedback - Validates if we continue or pivot
5. Authentication system (Phase 2) - Blocks production deployment
6. Web UI polish (Phase 4) - Blocks public launch

### Known Risks
1. **Game Concept Validation**: Core gameplay might not be fun
   - Mitigation: **Phase 1 prototype validates this early with minimal investment**

2. **Technology Stack Choice**: Choosing wrong tech could slow development
   - Mitigation: Prototype in Phase 1 validates tech choices

3. **Scope Creep**: Adding too many features before validation
   - Mitigation: **Strict Phase 1 scope - prove core concept first**

4. **Performance at Scale**: System may not handle 1000+ concurrent users
   - Mitigation: Load testing in Phase 2, scalable architecture from start

5. **Mobile Platform Differences**: iOS/Android specific issues
   - Mitigation: React Native for code sharing, platform-specific testing (Phase 8)

6. **Security Vulnerabilities**: Potential for exploits
   - Mitigation: Security-first design, regular audits (Phase 2+), automated scanning

---

## Success Metrics

### Technical Metrics
- Code coverage: >80%
- API response time: <200ms (p95)
- Uptime: >99.9%
- Security vulnerabilities: 0 critical

### Business Metrics (Post-Launch)
- Daily Active Users (DAU)
- Monthly Active Users (MAU)
- Retention (Day 1, Day 7, Day 30)
- Average session length
- User satisfaction score

---

## Resource Allocation

### Required Roles (Example)
- **Backend Developer(s)**: API, game engine, database
- **Frontend Developer(s)**: Web UI, React components
- **Full-Stack Developer(s)**: Can work on both
- **DevOps Engineer**: Infrastructure, CI/CD, monitoring
- **Game Designer**: Game mechanics, balance
- **UI/UX Designer**: User experience, visual design
- **QA Engineer**: Testing, quality assurance
- **Project Manager**: Coordination, timeline management

### Current Team
- To be defined based on available resources

---

## Next Actions

**Immediate (This Week)** - Phase 1 Start:
1. ✅ Planning complete
2. Set up local development environment (Docker, Node.js, PostgreSQL)
3. Initialize project structure
4. Create minimal database schema
5. Begin battle simulation engine

**Short-term (Next 2 Weeks)** - Phase 1 Core:
1. Complete battle simulation engine
2. Build basic REST API
3. Create simple React UI
4. Implement robot creation and configuration

**Medium-term (Weeks 3-4)** - Phase 1 Completion:
1. Add component system (weapons, armor)
2. Polish prototype for demo
3. Test with friends and gather feedback
4. Document lessons learned
5. Decide: Continue to Phase 2 or pivot based on feedback

---

## Notes

- This roadmap is a living document and will be updated as we progress
- Timelines are estimates and may change based on actual progress
- Phase durations assume full-time development; adjust for part-time work
- Some phases can be done in parallel with proper coordination

---

**Last Updated**: January 21, 2026  
**Version**: 2.0  
**Status**: Phase 1 (Local Prototype) Ready to Start