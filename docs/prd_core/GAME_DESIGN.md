# Armoured Souls - Game Design Document

**Last Updated**: February 9, 2026

## Overview

This document captures the core game design decisions for Armoured Souls, a strategy-based robot battle management game inspired by Football Manager mechanics.

**Implementation Status**: This document now includes implementation status markers (✅ Implemented, 🚧 Partial, ❌ Not Started) to track progress against the original design vision.

---

## Core Game Concept

**Genre**: Strategy Simulation / Management Game  
**Inspiration**: Football Manager (soccer management) - players manage input variables, AI processes outcomes  
**Target Audience**: Casual players (ages 15-100)  
**Session Length**: 15-30 minutes per day  
**Gameplay Style**: Asynchronous scheduled battles

---

## Battle System

### Battle Mechanics - ✅ IMPLEMENTED

**Format**: Scheduled, simulation-based battles
- Battles are **not real-time** and **not turn-based** ✅
- Players set up robots with stats, weapons, and configurations ✅
- Battles are scheduled at specific times ✅
- All scheduled battles are processed simultaneously by the simulation engine ✅
- Results are then presented to players ✅

**Battle Processing**: ✅ FULLY IMPLEMENTED
1. Players configure their robots and select opponents/join queues ✅
2. Battles are scheduled for specific processing times (automated via admin cycle) ✅
3. Server runs all scheduled battles using simulation engine ✅
4. Results, replays, and statistics are generated ✅
5. Players log in to view outcomes and adjust strategies ✅

**Battle Duration**: ✅ Time-based combat system implemented with cooldowns and timestamps

**Player Control**:
- **Pre-Battle**: ✅ Full control over robot configuration, weapon selection, stance, and yield threshold
- **During Battle**: ✅ No manual intervention (automated based on pre-configured settings)
- **Future Feature**: ❌ Conditional triggers (e.g., "activate mega-ultra-destructive BFG9000 on turn 7" or "after 3 minutes" or "when badly damaged")

---

## Robot System

### Robot Customization - ✅ IMPLEMENTED

**Customization Depth**: ✅ Framework-based system with 23 weapon-neutral attributes
- Balance between complexity (interesting gameplay) and simplicity (not overwhelming) ✅
- Both functionality-driven (stats, performance) and visual customization ✅

**Robot Components**: ✅ IMPLEMENTED
- Chassis (determines base stats and size) ✅
- Weapons (primary and secondary with 13 weapons + 2 shields) ✅
- 23 core attributes across 5 categories:
  - Combat Systems (6 attributes) ✅
  - Defensive Systems (5 attributes) ✅
  - Chassis & Mobility (5 attributes) ✅
  - AI Processing (4 attributes) ✅
  - Team Coordination (3 attributes) ✅
- Loadout types: single, weapon_shield, two_handed, dual_wield ✅
- Battle stances: offensive, defensive, balanced ✅
- Yield threshold configuration (0-50% HP) ✅

**Robot Templates**:
- **Visual-driven templates**: ❌ Not implemented (frameId exists but limited options)
- **Functionality-driven templates**: 🚧 Partial (players can configure attributes manually)
- Players can design from scratch ✅

**Balance Strategy**: ✅ ACTIVE
- Extensive simulation testing before launch ✅
- Continuous monitoring and adjustment post-launch ✅
- Player exploitation is expected - adapt through patches ✅

---

## Progression System

### Player Progression - ✅ IMPLEMENTED

**Progression Mechanics**: ✅ FULLY IMPLEMENTED
- **Currency (Credits ₡)**: ✅ Primary resource for upgrades and purchases
- **Prestige**: ✅ Stable-level reputation (earned, never spent)
- **Fame**: ✅ Robot-level reputation
- Tied to victories, achievements, and ranking ✅

**Robot Improvement**: ✅ IMPLEMENTED
- Spend currency on upgrades ✅
- Purchase better components (weapons) ✅
- Unlock new technologies through progression (facility system) ✅

**Resource Collection**: ✅ FULLY IMPLEMENTED
- **Currency (Credits ₡)**: ✅ Earned through battles, achievements, tournaments - See [STABLE_SYSTEM.md](STABLE_SYSTEM.md)
- **Prestige**: ✅ Stable-level reputation, unlocks facilities and content - See [PRD_PRESTIGE_AND_FAME.md](PRD_PRESTIGE_AND_FAME.md)
- **Fame**: ✅ Robot-level reputation, earned through individual victories - See [PRD_PRESTIGE_AND_FAME.md](PRD_PRESTIGE_AND_FAME.md)

**Progression Pace**: ✅ Casual-friendly
- Optimal engagement: One login per day, 15-30 minutes of play ✅
- No heavy grinding required ✅
- Possible Pay-to-Win features for monetization (to cover hosting costs) - ❌ Not implemented yet
  - Players can buy currency (NOT prestige or fame - reputation must be earned)

---

## Stable Management

### Robot Collection - ✅ IMPLEMENTED

**Stable Size**: ✅ Multiple robots per player (1-10 via Roster Expansion facility)

**Trading System**: ❌ NOT IMPLEMENTED
- **Buying/Selling**: Primary trading method (easier to implement than peer-to-peer trading)
- **Tradeable Items**: Robots, weapons, blueprints
- **Marketplace**: Player-driven economy

**Maintenance Costs**: ✅ IMPLEMENTED
- Small repair fees for damaged robots after battles ✅
- Cost scales with damage severity ✅
- Strategic decision: "Fight to the death" vs "Bail out when badly damaged" ✅ (yield threshold system)

**Stable Strategies**: ✅ SUPPORTED
- Multiple tactics are viable:
  - Many weak robots (swarm strategy) ✅
  - One powerful robot (quality over quantity) ✅
  - Specialist roles (weapon designer/seller ❌, tournament fighter ✅, etc.)
- Multiple paths to success and "winning" ✅

---

## Game Modes

### MVP Launch Modes

1. **PvP Ranked Battles** (Primary Focus) - ✅ IMPLEMENTED
   - 1v1 battles initially ✅
   - Ranking system (ELO-based) ✅
   - League/division structure (6 tiers: Bronze → Champion) ✅
   - Future: ❌ 2v2, 5v5, 11v11 team battles
   - Future: ❌ "Last Man Standing" battle royale mode

2. **PvE Sparring Matches** (Training Mode) - 🚧 PARTIAL
   - Lower stakes (no prestige/fame earned, reduced repair costs) 🚧
   - Practice and testing ground 🚧
   - AI opponents (Bye Robot exists for matchmaking) ✅

3. **Tournaments** (Important Feature) - ✅ IMPLEMENTED
   - Multi-day/multi-week events ✅
   - Special rewards and prestige ✅
   - Single elimination format ✅
   - Continuous tournament system (auto-creates new tournaments) ✅

### Post-Launch Modes - ❌ NOT IMPLEMENTED

- **Guild/Clan Wars**: Mass battles between groups
- **Story Mode**: Tutorial and lore introduction (small scale)
- **Special Events**: Seasonal content, limited-time challenges

---

## Social Features

### Community & Competition - 🚧 PARTIAL IMPLEMENTATION

**Social Systems**:
- ❌ Guilds/Clans - Not implemented
- ❌ Friend system - Not implemented
- ❌ In-game chat - Not implemented
- ✅ Spectator mode (view others' battle results) - Battle history and logs viewable
- ✅ Replay sharing - Battle logs with detailed combat events
- ✅ Multiple leaderboards:
  - Global rankings (ELO-based) ✅
  - League standings by tier ✅
  - Prestige leaderboard ✅
  - Fame leaderboard (robot-level) ✅
  - Losses leaderboard ✅
  - Hall of Records (various stats) ✅
  - ❌ Regional rankings - Not implemented
  - ❌ Friend rankings - Not implemented
  - ❌ Specialized rankings: "Fastest robot", "Most dominant victory", "Highest win streak" - Not implemented

**Achievement System**: 🚧 PARTIAL
- Rich achievement system - 🚧 Prestige/fame milestones defined but not fully implemented
- Records and statistics tracking ✅
- Fame-based rewards ✅
- Multiple ways to gain recognition ✅

---

## Monetization

### Business Model - ❌ NOT IMPLEMENTED

**Model**: Free-to-Play with optional purchases (planned)

**Monetization Strategy** (All planned, none implemented):
- ❌ **In-Game Currency**: Players can purchase currency with real money
- ❌ **Fame**: Can be purchased to accelerate progression
- ❌ **Cosmetics**: Visual customization items (fair, non-pay-to-win)
- ❌ **Battle Passes/Season Passes**: Possible access to special tournaments or leagues
- ✅ **No Pay-to-Win**: Players cannot buy power directly, only resources/currency (design principle)
- ✅ **No Time Savers**: Progression is not artificially slowed (design principle)

**Ad Support**: ❌ Not implemented

**Launch Strategy**: ✅ Free during beta/early access (current state), free-to-play at launch (planned)

---

## User Experience

### Target Audience - ✅ DESIGN VALIDATED

- **Player Type**: Casual players, not hardcore gamers ✅
- **Age Range**: 15-100 years old ✅
- **Time Commitment**: 15-30 minutes per day ✅
- **Geographic**: Global audience ✅
- **Platform**: Both desktop and mobile (responsive web ✅, later native apps ❌)

### Onboarding - 🚧 PARTIAL

**Philosophy**: Easy to learn, hard to master ✅

**New Player Experience**:
- Quick understanding of core mechanics 🚧
- Tutorial recommended to explain basic concepts ❌ Not implemented
- Minimal complexity upfront ✅
- Progressive depth reveal ✅

**Game Flow**: ✅ IMPLEMENTED
- Create robot → Enlist in battle → View results → Adjust strategy → Repeat ✅
- Both guided experience and exploration supported ✅
- Multiple valid playstyles ✅

### Session Structure - ✅ IMPLEMENTED

**Gameplay Pattern**: ✅ FULLY IMPLEMENTED
- **Quick Sessions**: 5-20 minutes typical ✅
- **Async/Scheduled**: Battles processed at scheduled times ✅
- **Daily Engagement**: Players check in once per day ✅
- **Strategic Planning**: Players spend time optimizing robots and strategy ✅

**Battle Schedule Examples**: ✅ IMPLEMENTED
- Daily battles at fixed time (admin-controlled cycle) ✅
- Multiple processing windows per day for high activity ✅
- Weekend tournaments with special schedules ✅

---

## Technical Requirements

### Game Engine Requirements - ✅ IMPLEMENTED

**Battle Simulation**: ✅ FULLY IMPLEMENTED
- Custom simulation engine (server-side) ✅
- Deterministic outcomes for replay consistency ✅
- Batch processing capability ✅
- Scalable to process thousands of battles simultaneously ✅

**Input Variables**: ✅ IMPLEMENTED
- Robot stats (23 attributes across 5 categories) ✅
- Weapon configurations (13 weapons + 2 shields) ✅
- Strategic settings (stance, yield threshold, loadout type) ✅
- Conditional triggers ❌ (future feature)

**Output**: ✅ FULLY IMPLEMENTED
- Battle log/replay with timestamped events ✅
- Statistics and metrics ✅
- Damage dealt/received ✅
- Winner determination ✅
- Fame/currency/prestige rewards ✅

### Local Development & Scaling - ✅ IMPLEMENTED

**Development Environment**: ✅ ACTIVE
- Initially: Run on laptop for testing with friends ✅
- No immediate hosting contract ✅
- Need strategy for local development → AWS migration path 🚧

**Scaling Strategy**: ✅ ARCHITECTURE IN PLACE
- Start simple, build for scale ✅
- "Aim for the moon" with scalability in mind ✅
- Serverless architecture for cost control 🚧 (PostgreSQL + Node.js backend)
- Scale-to-zero capability during low usage 🚧
- AWS as eventual hosting platform (managed services, serverless when possible) 🚧

---

## MVP Scope Definition

### Must-Have Features (MVP)

1. **User Management** - ✅ IMPLEMENTED
   - Registration and login (email/password) ✅ (username/password)
   - Profile management ✅
   - Social login (Google, Facebook, Apple) ❌ - no anonymous emails (planned)

2. **Robot Management** - ✅ IMPLEMENTED
   - Create robots ✅
   - Configure robots (stats, weapons, components) ✅
   - Upgrade system ✅
   - Multiple robots per player (1-10 via facility) ✅

3. **Stable Management** - ✅ IMPLEMENTED
   - Organize robot collection ✅
   - Select active robots for battles ✅
   - View robot statistics ✅
   - 14 facility types with 10 levels each ✅
   - Daily income/expense tracking ✅

4. **Battle System** - ✅ IMPLEMENTED
   - 1v1 ranked matches ✅
   - Battle scheduling and processing ✅
   - Results viewing ✅
   - Battle replay system with detailed logs ✅
   - Time-based combat simulation ✅

5. **Progression** - ✅ IMPLEMENTED
   - Currency system (Credits ₡) ✅
   - Prestige system (stable-level) ✅
   - Fame system (robot-level) ✅
   - Basic achievements 🚧 (prestige/fame milestones defined)
   - Ranking/league system (6 tiers) ✅

### Post-MVP Features

- ❌ Trading/marketplace
- ❌ Advanced battle modes (2v2, tournaments ✅ single elimination implemented)
- ❌ Guild system
- ❌ Advanced social features (chat, friends)
- ❌ Mobile native apps
- 🚧 Extensive achievement system (partial)
- ❌ Story mode
- 🚧 Advanced analytics dashboard (financial reports ✅, battle analytics 🚧)

---

## Security & Compliance

### Authentication - 🚧 PARTIAL

- **Required**: Email/password authentication ✅ (username/password implemented)
- **Social Login**: ❌ Google, Facebook, Apple (no random email addresses) - Not implemented
- **Guest Accounts**: ✅ Not allowed
- **2FA**: ❌ Post-launch feature

### Data Privacy - 🚧 PARTIAL

- **GDPR Compliance**: 🚧 Follow strictest guidelines (EU standards) - Basic structure in place
- **Data Collection**: ✅ Minimize to what's necessary
- **User Rights**: ❌ Full data deletion support - Not implemented
- **Age Restriction**: 🚧 13+ (COPPA compliance) - Not enforced
- **Global**: ✅ Designed for worldwide use

### Cheating Prevention - 🚧 PARTIAL

**Known Risks**:
- Multiple account abuse to manipulate matchmaking
- Account trading/selling

**Mitigation Strategies**:
- ❌ IP tracking and analysis - Not implemented
- ❌ Behavioral analysis - Not implemented
- ✅ Server-authoritative game logic - Implemented
- ❌ Ban/suspension policy (TBD based on testing)

---

## Platform Strategy

### Initial Platform - ✅ IMPLEMENTED

**Web-First Approach**: ✅ ACTIVE
- Responsive web application ✅
- Mobile-responsive design ✅
- Desktop and mobile browser support ✅
- PWA capabilities for mobile web experience 🚧

### Mobile Native Apps - ❌ NOT STARTED

**Priority**: Lower priority, after web MVP is proven

**Technology**: React + TypeScript for maximum code sharing with React Native ✅

---

## Art & Visual Design

**Status**: 🚧 Basic implementation with placeholders

**Considerations**:
- Budget constraints (low-cost or free assets initially) ✅
- Placeholder art acceptable for MVP ✅
- Visual style TBD (2D vs 3D, realistic vs stylized) 🚧
- Performance must be prioritized over visual fidelity ✅

**Current Implementation**:
- Basic UI with Tailwind CSS ✅
- Minimal robot visuals (frameId system exists) ✅
- Functional design prioritized over aesthetics ✅

---

## Development Team

**Team Composition**: 
- Robert (Project Owner, Product Management, DevOps expertise)
- AI Assistant (Development, Design, Architecture)

**Skills**:
- Open to learning new technologies
- No strong tech stack preferences
- Pragmatic approach prioritized

---

## Timeline & Launch Strategy

**Target Launch**: ASAP (timeline-driven by available development time)

**Approach**: ✅ MVP-first (ACTIVE)
- Build minimum viable product ✅ COMPLETE
- Test with small group of friends 🚧 IN PROGRESS
- Iterate based on feedback 🚧 ONGOING
- Scale up gradually 🚧 PLANNED

**Launch Strategy**:
- Free beta/early access ✅ CURRENT STATE
- Global launch from day one ✅ DESIGN PRINCIPLE
- Soft launch not required ✅

**Current Status** (February 2026):
- Core systems implemented ✅
- Battle system fully functional ✅
- Economy and progression systems active ✅
- Tournament system operational ✅
- Ready for expanded testing 🚧

---

## Open Questions & Future Decisions

### Art & Visual Design - 🚧 ONGOING
- Art style direction 🚧
- Asset creation strategy (custom vs asset store) 🚧
- Animation complexity ❌
- Visual effects scope ❌

### Analytics & Metrics - 🚧 PARTIAL
- Specific KPIs to track 🚧
- Analytics platform choice ❌
- A/B testing strategy ❌

### Legal & Administrative - ❌ NOT STARTED
- Legal entity formation ❌
- Terms of Service drafting ❌
- Privacy Policy ❌
- Content moderation policies ❌

### Technical Details - ✅ MOSTLY RESOLVED
- Exact robot component system ✅ (23 attributes implemented)
- Battle simulation algorithm specifics ✅ (time-based combat)
- Matchmaking algorithm ✅ (ELO-based with league tiers)
- Trading system mechanics ❌ (future feature)

---

## Summary

Armoured Souls is a **casual, strategy-based robot battle management game** where players:
1. Build and configure battle robots ✅
2. Set strategies and enlist in scheduled battles ✅
3. View simulation results and replays ✅
4. Iterate and improve based on outcomes ✅
5. Progress through rankings, achieve fame, and master the game ✅

The game prioritizes:
- **Accessibility**: Easy to learn, playable in 15-30 min/day ✅
- **Strategy**: Deep customization and multiple paths to success ✅
- **Community**: Social features, competition, and cooperation 🚧
- **Fairness**: No pay-to-win, skill and strategy matter most ✅
- **Scalability**: Built to handle growth from 10 to 10,000+ players ✅

Development focuses on:
- **MVP first**: Core features before expansion ✅
- **Pragmatic choices**: Best tool for the job, not latest trends ✅
- **Sustainable costs**: Serverless, scale-to-zero, managed services 🚧
- **Quality**: Security, testing, and performance from day one ✅

## Implementation Status Summary

**✅ Fully Implemented (Core MVP Complete)**:
- Battle system with time-based combat simulation
- Robot management with 23 attributes and weapon system
- Matchmaking and league system (6 tiers)
- Tournament system (single elimination)
- Economy system (currency, prestige, fame)
- Facility system (14 types, 10 levels each)
- Daily cycle automation
- Battle history and detailed logs
- Multiple leaderboards
- Responsive web UI

**🚧 Partially Implemented**:
- Achievement system (milestones defined, not all tracked)
- Social features (leaderboards yes, chat/friends no)
- Analytics dashboard (financial yes, battle analytics partial)
- Onboarding/tutorial
- PvE sparring mode

**❌ Not Yet Implemented**:
- Trading/marketplace
- Guild/clan system
- Social login (OAuth)
- Mobile native apps
- Monetization features
- Advanced battle modes (2v2, team battles)
- Story mode
- Cosmetic shop
- Full GDPR compliance tools

**Next Priority Areas**:
1. Tutorial and onboarding flow
2. Achievement tracking system
3. Social features (friends, chat)
4. Trading/marketplace
5. Mobile app development