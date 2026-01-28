# Armoured Souls - Development Roadmap

**Last Updated**: January 27, 2026

## Overview

This document outlines the development roadmap for Armoured Souls, from planning through launch and beyond. The project is organized into distinct phases (0-9), with each phase representing a major milestone. Timeline estimates have been removed in favor of a version-based approach - phases complete when ready, not by arbitrary dates.

---

## Phase 0 - Planning ✅

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

## Phase 1 - Local Prototype 🔄

**Status**: In Progress  
**Started**: January 25, 2026  
**Goal**: Build functional local prototype with core game mechanics

### ✅ Milestone 1: User Can Login and See Initial Setup 
- ✅ JWT-based authentication (login/logout)
- ✅ User dashboard showing profile and credits balance (₡2,000,000 starting)
- ✅ Consistent navigation across all pages
- ✅ Test users seeded: player1-6, admin (all password: password123)

### ✅ Milestone 2: User Can Complete Stable Setup 
- ✅ 14 facility types (Repair Bay, Training Facility, Weapons Workshop, Roster Expansion)
- ✅ Each facility: 10 upgrade levels, progressive costs 
- ✅ Training Facility: 5%-25% discount on attribute upgrades (WORKING)
- ✅ Weapons Workshop: 10%-25% discount on weapon purchases (WORKING)
- ✅ Roster Expansion: Enforces robot creation limit (1-5 robots based on level)

### ⚠️ Milestone 3: User Can Create First Robot (DONE)
- ✅ Robot creation (₡500k cost, all 23 attributes start at level 1)
- ✅ All 23 attributes with correct names from DATABASE_SCHEMA.md
- ✅ Weapon inventory system (buy weapons into inventory)
- ✅ Weapon Shop page with Weapons Workshop discount
- ✅ "My Robots" page to view user's robots
- ✅ "All Robots" page showing all robots with owners and ELO

### ⚠️ Milestone 3: User Can Create First Robot (PENDING)
- ✅ Attribute upgrade system with Training Facility discount applied (fixed in commit f607702)
- [ ] Robot detail page shows the correct amount for upgrading, including the Training Facility discount
--> NOT FIXED in commit 5c63366. Page still shows 2000 credits for upgrading from 1 to 2 while Level 1 Training Academy is active.
--> NOT FIXED in commit f607702. Page still shows 2000 credits for upgrading from 1 to 2 while Level 1 Training Academy is active.
--> NOT FIXED in commit c378ead. Page still shows 2000 credits for upgrading from 1 to 2 while Level 1 Training Academy is active.
- ✅ Roster Expansion facility level is enforced when creating new robots (fixed in commit 5c63366)
- [ ] Training Academy facilities (4 of them!) enforce the cap of their respective attributes group(s)
--> NOT FIXED in commit f607702. Can still upgrade robot attributes to levels above 10 without buying a Training Academy
--> NOT FIXED in commit c378ead. Incorrectly implemented, the page shows and enforces a cap of 50, while STABLE_SYSTEM.md states that the cap should be 10 at level 0 and increase with 5 per level.
- [ ] The attribute groups on the Robot detail page show the attribute cap based on facility upgrades next to each attribute group
--> NOT FIXED in commit 5c63366. For Combat Systems, the page shows: "Attribute Cap: 50 (Upgrade Combat Training Academy to increase)". This is the theoretical maximum, not the current maximum based on upgraded facilities.
--> NOT FIXED in commit f607702. For Combat Systems, the page shows: "Attribute Cap: 50 (Upgrade Combat Training Academy to increase)". This is the theoretical maximum, not the current maximum based on upgraded facilities.
--> NOT FIXED in commit c378ead. For Combat Systems, the page shows: "Attribute Cap: 50 (Upgrade Combat Training Academy to increase)". This is the theoretical maximum, not the current maximum based on upgraded facilities (see STABLE_SYSTEM.md).

Read carefully! 
Facility = a stable upgrade
Training Facility = specific facility that reduces costs for upgrading robot attributes
Combat Training Academy = specific facility that increases Combat Systems attribute caps
Defense Training Academy = specific facility that increases Defensive Systems attribute caps

This might be the root of your confusion on how to implement this. Should we rename them?

### Milestone 4: Matchmaking in Place (NOT STARTED)
- Manual robot selection for battle
- Simple matchmaking UI
- Battle queue system

### Milestone 5: Matches Can Be Triggered Manually (NOT STARTED)
- Manual battle trigger
- Battle simulation execution
- Battle outcome calculation
- Stats/ELO updates

### Current Database State
**Official Migrations (4):**
1. `20260125213123_` - Initial schema
2. `20260125213329_add_facilities` - Adds facilities table
3. `20260126181101_update_schema_to_match_docs` - Renames 23 robot attributes, adds WeaponInventory table
4. `20260127000000_add_loadout_type_to_weapons` - Adds loadoutType to weapons table

**Schema State After Revert:**
- User: currency, prestige, relationships
- Robot: 23 attributes + simple `weaponInventoryId` field
- WeaponInventory: User's owned weapons
- Weapon: 10 seeded weapons with bonuses
- Facility: 4 types, 5 levels each

### API Endpoints (VERIFIED)
```
Authentication:
POST /api/auth/login   - Login with username/password
POST /api/auth/logout  - Logout

User:
GET  /api/user         - Get current user info

Robots:
GET  /api/robots/all/robots - All robots (leaderboard)
GET  /api/robots            - Current user's robots
POST /api/robots            - Create new robot
GET  /api/robots/:id        - Get specific robot
PUT  /api/robots/:id/upgrade - Upgrade robot attribute
PUT  /api/robots/:id/weapon - Equip weapon to robot

Facilities:
GET  /api/facilities         - Get user's facilities
POST /api/facilities/upgrade - Upgrade a facility

Weapons:
GET  /api/weapons                       - List all weapons
GET  /api/weapon-inventory              - User's weapon inventory
POST /api/weapon-inventory/purchase     - Purchase weapon into inventory
```

### Environment Setup
**Required:** `.env` file in `prototype/backend/`

The `.env` file is NOT tracked in git (it's in `.gitignore`). Copy from template:
```bash
cp prototype/backend/.env.example prototype/backend/.env
```

Contains `DATABASE_URL` for Prisma connection to PostgreSQL.

### Next Steps
1. Test reverted schema works (robot pages load correctly)
2. If working, continue with Milestones 4-5 (matchmaking, battle simulation)
3. Later: Properly implement dual weapon slots with migration

### Phase 1 Cleanup Milestone (End of Phase 1)
- Consolidate all migrations into single base migration
- Create clean schema.sql for fresh installations
- Document migration strategy for production
- Review and cleanup temporary/test code
- Ensure all documentation up-to-date
- Run full test suite
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
