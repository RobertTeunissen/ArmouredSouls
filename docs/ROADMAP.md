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

**Goal**: Build a minimal working prototype running locally to validate the core game concept

**Status**: Ready to begin  
**Team**: 2 people (Robert + AI), async development style  
**Testing**: 6 user accounts for local testing  
**Target**: Working game loop - Login → Setup Stable → Create Robot → Battle

### Implementation Strategy: Bottom-Up, Iterative

Since there's a **1-to-1 relationship between User and Stable**, the logical development order is:

1. **User/Stable Setup** → Get authentication and stable management working first
2. **Robot Creation** → Build robot with attributes and equipment
3. **Battle System** → Enable battles between robots

This ensures all database components are in place before implementing battles.

### Phase 1 Milestones

**Milestone 1: User Can Login and See Initial Setup** ✅ PRIORITY
- ✅ User authentication (login/logout)
- ✅ User profile view
- ✅ Display stable info (empty at start, ₡2,000,000 to spend)
- ✅ Display Credits (₡) balance

**Milestone 2: User Can Complete Stable Setup** ✅ PRIORITY
- [ ] View available facility upgrades (14 facility types)
- [ ] Purchase facility upgrades with Credits
- [ ] See updated facility levels
- [ ] Track Credits spending

--> This is not working yet. There are only 4 facility types visible, not 14.
--> Facilities can only be upgraded to level 5, not higher.
--> When buying a facility the credit spending works, but the effect of the facility is not applied: buying the Training Facility doesn't provide a Robot upgrade discount and I am able to create multiple robots without buying the Roster Expansion facility. Make sure all 14 facilities have their intended effects applied. For the ones that have no use yet (we haven't implemented the repair funcitonality yet, so I cannot test the Repair Bay), mark them as "effect not yet implemented" in the browser. Also make sure you have them marked in this ROADMAP.md at the appropriate place so you don't forget.
--> Stables should also have a name. This is a new requirement. Update this in STABLE_SYSTEM.md and DATABASE_SCHEMA.md and implement something a flow so that this is the first thing a user does when logging in for the first time. 

**Milestone 3: User Can Create First Robot** ✅ PRIORITY
- ✅ Create robot with name
- ✅ Distribute 23 attributes (all start at level 1)
- ✅ Upgrade robot attributes with Credits
- ✅ Select weapon from available weapons
- [ ] Select loadout configuration (weapon+shield, two-handed, dual-wield, single)
- ✅ Save robot to database
- [ ] View robot in stable

--> There now is a Weapon Shop where the starting Weapons have been made available. Confirmed working. Players buy a weapon. This places it in the inventory. Users assign a weapon to a robot. They can buy the same weapon multiple times. Confirmed working. Make sure the documentation reflects this (ROBOT_ATTRIBUTES.md)
--> What does not work is the loadout configuration. I cannot see the weapon type in the shop and I can only assign one weapon to each robot, no full loadout configuration.
--> I want to see what the effect is of the weapon I buy. It currently only shows base damage and costs, but the cooldown and attribute changes are important for my buy decision.
--> I want to see what the effect of a weapon is when it is equipped. Present the 23 attributes in the robot view as a stat block and clearly show the effects of equipping the weapon (reason weapons are quite expensive is that this is a way to get your effective stats above the maximum enforced by your training academy facilities). 
--> Robots are not shows on the dashboard. Provide them in a table view (include their fighting record / ELO) and make their name clickable so you can see the details of the robot page with one click

**Milestone 4: Matchmaking in Place** ✅ PRIORITY
- [ ] Manual robot selection for battle (select 2 robots)
- [ ] Simple matchmaking UI (pick opponent's robot)
- [ ] Validate both robots have weapons equipped
- [ ] Queue battle for execution

**Milestone 5: Matches Can Be Triggered Manually** ✅ PRIORITY
- [ ] Manual battle trigger button
- [ ] Execute battle simulation (time-based combat)
- [ ] Calculate battle outcome
- [ ] Apply repair costs (1.0x/1.5x/2.0x multipliers)
- [ ] Update robot HP/shield/ELO/stats
- [ ] Display battle log with timestamps
- [ ] Store battle in database
- [ ] **TEST GAME BALANCE** - Run multiple battles to validate formulas

### Explicit Scope Limitations

**NOT in Phase 1**:
- ❌ Automated matchmaking algorithms
- ❌ Automated battle scheduling (only manual trigger)
- ❌ Battle queues or asynchronous battles
- ❌ Achievements or progression systems
- ❌ Social features (friends, chat, guilds)
- ❌ Cloud deployment (local only)
- ❌ Mobile support
- ❌ Polished UI/UX (functional only)
- ❌ Animations or visual effects
- ❌ Advanced analytics or statistics
- ❌ Tournament system
- ❌ Team battles (2v2, 3v3+)

### Technical Architecture (Simplified)

**Project Structure**: Isolated prototype in `/prototype` directory

```
ArmouredSouls/
├── docs/                 # Project documentation
├── prototype/            # Phase 1 isolated prototype codebase
│   ├── backend/          # Node.js + Express + Prisma
│   ├── frontend/         # React + Tailwind CSS
│   └── docker-compose.yml
└── modules/              # Future production codebase (Phase 2+)
```

**Architecture Diagram**:

```
┌─────────────────────────────────────────┐
│    React + Tailwind CSS (Port 3000)     │
│                                         │
│  • Login/Logout                         │
│  • User Management                      │
│  • Robot List & Creator                 │
│  • Robot Upgrading                      │
│  • Stable Management                    │
│  • Battle Setup                         │
│  • Battle Results & History             │
└─────────────────┬───────────────────────┘
                  │ HTTP/REST
┌─────────────────▼───────────────────────┐
│  Node.js + Express Backend (Port 3001)  │
│                                         │
│  • REST API (Express)                   │
│  • Authentication (JWT + bcrypt)        │
│  • Battle Simulation Engine             │
│  • Database ORM (Prisma)                │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│      PostgreSQL (Port 5432)             │
│      via Docker Compose                 │
│                                         │
│  • Users (username, password_hash, role)│
│  • Robots                               │
│  • Components                           │
│  • Battles                              │
│  • Currency balances                    │
└─────────────────────────────────────────┘
```

**Technology Stack**:
- **Backend**: Express (finalized)
- **ORM**: Prisma (finalized)
- **Frontend**: React + Tailwind CSS (finalized)
- **Database**: PostgreSQL + Docker
- **Testing**: Automated tests on every commit (CI/CD via GitHub Actions)

### Battle Simulation Algorithm

**Note**: The battle simulation uses time-based combat with 23 robot attributes. For complete combat formulas including hit chance, critical hits, energy shields, penetration, and all attribute interactions, see **ROBOT_ATTRIBUTES.md**.

Key aspects:
- Time-based turn processing (measured in seconds)
- Attack cooldowns based on weapon and attackSpeed attribute
- Simultaneous attacks resolved using gyroStabilizers
- Energy shields as separate HP pool with regeneration
- Yield threshold (robots can surrender to avoid destruction)
- Comprehensive battle log with timestamps

For detailed implementation, see ROBOT_ATTRIBUTES.md.

### Sample Components

**Chassis Types**:

| Name | Health | Speed | Defense | Attack |
|------|--------|-------|---------|--------|
| Tank | +50 | -5 | +10 | +0 |
| Scout | +0 | +10 | -5 | +5 |
| Balanced | +20 | +0 | +0 | +0 |
| Berserker | +10 | +5 | -10 | +15 |
| Fortress | +100 | -10 | +20 | -5 |

**Weapons**:

| Name | Attack Bonus | Description |
|------|-------------|-------------|
| Laser Rifle | +15 | Standard energy weapon |
| Plasma Cannon | +25 | High damage, heavy |
| Machine Gun | +10 | Rapid fire |
| Hammer | +20 | Melee weapon |
| Sniper Laser | +30 | Precision weapon |
| Sword | +12 | Basic melee |
| Rocket Launcher | +35 | Maximum damage |

**Armor**:

| Name | Defense Bonus | Speed Penalty |
|------|--------------|---------------|
| Heavy Plate | +20 | -5 |
| Light Armor | +10 | +0 |
| Energy Shield | +15 | +2 |
| Stealth Coating | +5 | +5 |
| Reactive Armor | +25 | -8 |
| Nano-Weave | +12 | +3 |

### Development Workflow: Iterative, Bottom-Up

**Iteration 1: User/Stable Foundation** (Milestone 1-2)
- Set up development environment (Docker, Node.js, PostgreSQL)
- Implement user authentication (login/logout with JWT)
- Create User and Facility database tables
- Build stable management UI (view facilities, purchase upgrades)
- Implement Credits system and spending
- **Validation**: User can login, see ₡2,000,000, upgrade facilities

**Iteration 2: Robot Creation** (Milestone 3)
- Create Robot and Weapon database tables
- Implement robot creation API
- Build robot attribute upgrade system (23 attributes)
- Add weapon selection and loadout configuration
- Create robot management UI
- **Validation**: User can create robot, upgrade stats, equip weapon, save to database

**Iteration 3: Battle System** (Milestone 4-5)
- Create Battle database table
- Implement battle simulation engine (time-based combat, all formulas)
- Build manual matchmaking UI (select 2 robots)
- Add manual battle trigger
- Calculate repair costs and update robot state
- Display battle log with timestamps
- **Validation**: User can trigger battle, see results, robots update correctly

**Iteration 4: Game Balance Testing** (Milestone 5 continued)
- Run 50+ test battles with different robot configurations
- Validate formulas produce interesting outcomes
- Adjust balance if needed (documented in ROBOT_ATTRIBUTES.md)
- Test edge cases (destroyed robots, high damage, yield threshold)
- **Validation**: Battles feel fair, interesting, and strategic

**Total Duration**: 2-6 weeks (depending on available time per week)

### Success Metrics for Phase 1

**Milestone Completion**:
- ✅ All 5 milestones completed
- ✅ User can complete full game loop (login → setup → create robot → battle)
- ✅ All database components working correctly

**Technical Success**:
- ✅ Battle simulation completes in <100ms
- ✅ Can process 100 battles in <10 seconds
- ✅ Zero crashes during testing
- ✅ Database persists correctly between sessions
- ✅ UI functional on laptop screen

**Game Design Success**:
- ✅ At least 3 different viable robot builds (Tank, Glass Cannon, Balanced)
- ✅ Battle outcomes feel logical given robot stats
- ✅ Battle logs show interesting combat progression
- ✅ Repair costs make economic sense
- ✅ Credits economy balanced (can afford upgrades without grinding)

**Validation Criteria**:
- Can create 6 different robots with distinct strategies
- Can run 20+ battles without issues
- Game balance tested (no dominant strategy)
- All formulas from ROBOT_ATTRIBUTES.md work correctly
- Ready to show to friends for feedback

### Risk Management

**Technical Risks**:

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Battle engine too slow | Low | Medium | Profile early, optimize algorithm |
| Database issues | Low | High | Use proven ORM, test thoroughly |
| UI bugs | Medium | Low | Focus on functionality over polish |
| Docker problems | Medium | Medium | Document setup well, test on multiple machines |

**Schedule Risks**:

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Scope creep | High | High | **Strict feature list, no additions** |
| Over-engineering | Medium | Medium | Keep it simple, refactor in Phase 2 |
| Time estimates wrong | Medium | Low | Buffer week built into 4-8 week estimate |

**Game Design Risks**:

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Not fun | Medium | High | **Get feedback early and often** |
| Too complex | Medium | Medium | Simplify if friends are confused |
| Too simple | Low | Medium | Easy to add depth in Phase 2 |

### Database Setup

**Important**: The authoritative database schema is in **DATABASE_SCHEMA.md**. Do not duplicate schema definitions.

Since this is a prototype with no existing data:

1. Copy complete schema from **DATABASE_SCHEMA.md** to `prisma/schema.prisma`
2. Generate database: `npx prisma migrate dev --name init`
3. Run seed script: `npx prisma db seed`

Key points:
- See **ROBOT_ATTRIBUTES.md** for all 23 robot attributes (combatPower, targetingSystems, etc.)
- See **STABLE_SYSTEM.md** for facility types and upgrade mechanics
- See **DATABASE_SCHEMA.md** for complete schema with all tables, fields, and relationships

---

## Phase 2: Foundation & Infrastructure

**Goal**: Make the prototype production-ready with proper infrastructure and security

**Prerequisites**: Phase 1 prototype validated by friends' feedback

### Decision Point: Continue, Pivot, or Stop

Based on Phase 1 feedback, we will choose one of three paths:

**Path A: Continue** (Feedback is positive)
- Proceed with Phase 2 (Foundation & Infrastructure)
- Implement production authentication
- Deploy to AWS
- Add matchmaking and automated scheduling
- Refactor prototype code into modules/ structure

**Path B: Pivot** (Feedback reveals issues)
- Revisit game mechanics based on feedback
- Adjust battle system
- Simplify or add complexity as needed
- Run another prototype iteration
- Document changes and re-test

**Path C: Stop** (Feedback is negative)
- Document learnings and insights
- Archive project
- Consider different game concept
- Share lessons learned

**The goal of Phase 1 is to fail fast or validate fast. Either outcome is valuable!**

### Phase 2 Scope (If Continuing)

**2.1 Development Environment Enhancement**
- [ ] Configure CI/CD pipeline (GitHub Actions)
- [ ] Set up automated testing framework
- [ ] Configure code coverage tracking
- [ ] Security scanning integration (SAST)
- [ ] Set up staging environment

**2.2 Authentication & Security**
- [ ] Proper user registration system
- [ ] Secure login/logout with JWT
- [ ] Password hashing (bcrypt)
- [ ] Password reset flow
- [ ] Email verification
- [ ] Rate limiting
- [ ] Input validation and sanitization
- [ ] CSRF protection

**2.3 Database & Data Layer**
- [ ] Expand database schema for production
- [ ] Add database indexes for performance
- [ ] Set up database backups
- [ ] Implement data validation
- [ ] Add audit logging
- [ ] Connection pooling optimization

**2.4 Testing Infrastructure**
- [ ] Unit tests for battle engine
- [ ] Integration tests for API
- [ ] End-to-end tests for critical flows
- [ ] Load testing setup
- [ ] Automated test runs in CI/CD

**2.5 Module Restructuring**
- [ ] Refactor prototype code into proper module structure
- [ ] Separate concerns (see MODULE_STRUCTURE.md)
- [ ] Implement clean interfaces between modules
- [ ] Move from /prototype to /modules directory

**2.6 AWS Deployment Preparation**
- [ ] Set up AWS account and infrastructure
- [ ] Configure serverless architecture
- [ ] Set up database hosting
- [ ] Configure CDN for static assets
- [ ] Set up monitoring and logging

**Deliverables**:
- Production-ready authentication system
- Comprehensive test coverage
- Security hardened application
- CI/CD pipeline operational
- Deployed to staging environment

---

## Phase 3: Core Game Mechanics

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
