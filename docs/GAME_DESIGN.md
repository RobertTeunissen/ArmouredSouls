# Armoured Souls - Game Design Document

**Last Updated**: January 24, 2026

## Overview

This document captures the core game design decisions for Armoured Souls, a strategy-based robot battle management game inspired by Football Manager mechanics.

---

## Core Game Concept

**Genre**: Strategy Simulation / Management Game  
**Inspiration**: Football Manager (soccer management) - players manage input variables, AI processes outcomes  
**Target Audience**: Casual players (ages 15-100)  
**Session Length**: 15-30 minutes per day  
**Gameplay Style**: Asynchronous scheduled battles

---

## Battle System

### Battle Mechanics

**Format**: Scheduled, simulation-based battles
- Battles are **not real-time** and **not turn-based**
- Players set up robots with stats, weapons, and configurations
- Battles are scheduled at specific times
- All scheduled battles are processed simultaneously by the simulation engine
- Results are then presented to players

**Battle Processing**:
1. Players configure their robots and select opponents/join queues
2. Battles are scheduled for specific processing times (e.g., daily at 8 PM)
3. Server runs all scheduled battles using simulation engine
4. Results, replays, and statistics are generated
5. Players log in to view outcomes and adjust strategies

**Battle Duration**: Variable based on robot statistics and configurations. Duration doesn't matter as battles are processed in batch, not in real-time.

**Player Control**:
- **Pre-Battle**: Full control over robot configuration, weapon selection, and strategy settings
- **During Battle**: No manual intervention (automated based on pre-configured settings)
- **Future Feature**: Conditional triggers (e.g., "activate mega-ultra-destructive BFG9000 on turn 7" or "after 3 minutes" or "when badly damaged")

---

## Robot System

### Robot Customization

**Customization Depth**: 
- Framework-based system designed for expansion
- Balance between complexity (interesting gameplay) and simplicity (not overwhelming)
- Both functionality-driven (stats, performance) and visual customization

**Robot Components**:
- Chassis (determines base stats and size)
- Weapons (primary and secondary)
- Armor plating
- Engine/power system
- Other modules (to be designed)

**Robot Templates**:
- **Visual-driven templates**: Humanoid, quadruped, tank, etc.
- **Functionality-driven templates**: Sturdy & slow, fast & fragile, balanced, etc.
- Players can choose templates or design from scratch

**Balance Strategy**:
- Extensive simulation testing before launch
- Continuous monitoring and adjustment post-launch
- Player exploitation is expected - adapt through patches

---

## Progression System

### Player Progression

**Progression Mechanics**:
- **Currency**: Primary resource for upgrades and purchases
- **Fame**: Secondary progression currency/metric
- Tied to victories, achievements, and ranking

**Robot Improvement**:
- Spend currency on upgrades
- Purchase better components
- Unlock new technologies through progression

**Resource Collection**:
- **Currency**: Earned through battles, achievements, trading
- **Fame**: Earned through victories, rankings, achievements

**Progression Pace**: Casual-friendly
- Optimal engagement: One login per day, 15-30 minutes of play
- No heavy grinding required
- Possible Pay-to-Win features for monetization (to cover hosting costs) - players can buy currency or fame

---

## Stable Management

### Robot Collection

**Stable Size**: Multiple robots per player (exact number TBD)

**Trading System**:
- **Buying/Selling**: Primary trading method (easier to implement than peer-to-peer trading)
- **Tradeable Items**: Robots, weapons, blueprints
- **Marketplace**: Player-driven economy

**Maintenance Costs**:
- Small repair fees for damaged robots after battles
- Cost scales with damage severity
- Strategic decision: "Fight to the death" vs "Bail out when badly damaged"

**Stable Strategies**:
- Multiple tactics should be viable:
  - Many weak robots (swarm strategy)
  - One powerful robot (quality over quantity)
  - Specialist roles (weapon designer/seller, tournament fighter, etc.)
- Multiple paths to success and "winning"

---

## Game Modes

### MVP Launch Modes

1. **PvP Ranked Battles** (Primary Focus)
   - 1v1 battles initially
   - Ranking system
   - League/division structure
   - Future: 2v2, 5v5, 11v11 team battles
   - Future: "Last Man Standing" battle royale mode

2. **PvE Sparring Matches** (Training Mode)
   - Lower stakes (less fame, less repair costs)
   - Practice and testing ground
   - AI opponents

3. **Tournaments** (Important Feature)
   - Multi-day/multi-week events
   - Special rewards and prestige
   - Various formats

### Post-Launch Modes

- **Guild/Clan Wars**: Mass battles between groups
- **Story Mode**: Tutorial and lore introduction (small scale)
- **Special Events**: Seasonal content, limited-time challenges

---

## Social Features

### Community & Competition

**Social Systems** (All planned):
- ✅ Guilds/Clans
- ✅ Friend system
- ✅ In-game chat
- ✅ Spectator mode (view others' battle results)
- ✅ Replay sharing
- ✅ Multiple leaderboards:
  - Global rankings
  - Regional rankings
  - Friend rankings
  - League system
  - Specialized rankings: "Fastest robot", "Most dominant victory", "Highest win streak"

**Achievement System**:
- Rich achievement system
- Records and statistics tracking
- Fame-based rewards
- Multiple ways to gain recognition

---

## Monetization

### Business Model

**Model**: Free-to-Play with optional purchases

**Monetization Strategy**:
- **In-Game Currency**: Players can purchase currency with real money
- **Fame**: Can be purchased to accelerate progression
- **Cosmetics**: Visual customization items (fair, non-pay-to-win)
- **Battle Passes/Season Passes**: Possible access to special tournaments or leagues
- **No Pay-to-Win**: Players cannot buy power directly, only resources/currency
- **No Time Savers**: Progression is not artificially slowed

**Ad Support**: Possible but not primary revenue source

**Launch Strategy**: Free during beta/early access, free-to-play at launch

---

## User Experience

### Target Audience

- **Player Type**: Casual players, not hardcore gamers
- **Age Range**: 15-100 years old
- **Time Commitment**: 15-30 minutes per day
- **Geographic**: Global audience
- **Platform**: Both desktop and mobile (responsive web, later native apps)

### Onboarding

**Philosophy**: Easy to learn, hard to master

**New Player Experience**:
- Quick understanding of core mechanics
- Tutorial recommended to explain basic concepts
- Minimal complexity upfront
- Progressive depth reveal

**Game Flow**:
- Create robot → Enlist in battle → View results → Adjust strategy → Repeat
- Both guided experience and exploration supported
- Multiple valid playstyles

### Session Structure

**Gameplay Pattern**:
- **Quick Sessions**: 5-20 minutes typical
- **Async/Scheduled**: Battles processed at scheduled times
- **Daily Engagement**: Players check in once per day
- **Strategic Planning**: Players spend time optimizing robots and strategy

**Battle Schedule Examples**:
- Daily battles at fixed time (e.g., 8 PM server time)
- Multiple processing windows per day for high activity
- Weekend tournaments with special schedules

---

## Technical Requirements

### Game Engine Requirements

**Battle Simulation**:
- Custom simulation engine (server-side)
- Deterministic outcomes for replay consistency
- Batch processing capability
- Scalable to process thousands of battles simultaneously

**Input Variables**:
- Robot stats (attack, defense, speed, armor, etc.)
- Weapon configurations
- Strategic settings
- Conditional triggers (future feature)

**Output**:
- Battle log/replay
- Statistics and metrics
- Damage dealt/received
- Winner determination
- Fame/currency rewards

### Local Development & Scaling

**Development Environment**:
- Initially: Run on laptop for testing with friends
- No immediate hosting contract
- Need strategy for local development → AWS migration path

**Scaling Strategy**:
- Start simple, build for scale
- "Aim for the moon" with scalability in mind
- Serverless architecture for cost control
- Scale-to-zero capability during low usage
- AWS as eventual hosting platform (managed services, serverless when possible)

---

## MVP Scope Definition

### Must-Have Features (MVP)

1. **User Management**
   - Registration and login (email/password)
   - Profile management
   - Social login (Google, Facebook, Apple) - no anonymous emails

2. **Robot Management**
   - Create robots
   - Configure robots (stats, weapons, components)
   - Upgrade system
   - Multiple robots per player

3. **Stable Management**
   - Organize robot collection
   - Select active robots for battles
   - View robot statistics

4. **Battle System**
   - 1v1 ranked matches
   - Battle scheduling and processing
   - Results viewing
   - Basic replay system

5. **Progression**
   - Currency system
   - Fame system
   - Basic achievements
   - Ranking/league system

### Post-MVP Features

- Trading/marketplace
- Advanced battle modes (2v2, tournaments, etc.)
- Guild system
- Advanced social features
- Mobile native apps
- Extensive achievement system
- Story mode
- Advanced analytics dashboard

---

## Security & Compliance

### Authentication

- **Required**: Email/password authentication
- **Social Login**: Google, Facebook, Apple (no random email addresses)
- **Guest Accounts**: Not allowed
- **2FA**: Post-launch feature

### Data Privacy

- **GDPR Compliance**: Follow strictest guidelines (EU standards)
- **Data Collection**: Minimize to what's necessary
- **User Rights**: Full data deletion support
- **Age Restriction**: 13+ (COPPA compliance)
- **Global**: Designed for worldwide use

### Cheating Prevention

**Known Risks**:
- Multiple account abuse to manipulate matchmaking
- Account trading/selling

**Mitigation Strategies**:
- IP tracking and analysis
- Behavioral analysis
- Server-authoritative game logic
- Ban/suspension policy (TBD based on testing)

---

## Platform Strategy

### Initial Platform

**Web-First Approach**:
- Responsive web application
- Mobile-responsive design
- Desktop and mobile browser support
- PWA capabilities for mobile web experience

### Mobile Native Apps

**Priority**: Lower priority, after web MVP is proven

**Timeline**:
1. Web MVP (6-12 months)
2. Mobile-responsive web (concurrent with MVP)
3. iOS native app (12-18 months)
4. Android native app (18-24 months)

**Technology**: React + TypeScript for maximum code sharing with React Native

---

## Art & Visual Design

**Status**: To be determined

**Considerations**:
- Budget constraints (low-cost or free assets initially)
- Placeholder art acceptable for MVP
- Visual style TBD (2D vs 3D, realistic vs stylized)
- Performance must be prioritized over visual fidelity

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

**Approach**: MVP-first
- Build minimum viable product
- Test with small group of friends
- Iterate based on feedback
- Scale up gradually

**Launch Strategy**:
- Free beta/early access
- Global launch from day one
- Soft launch not required

---

## Open Questions & Future Decisions

### Art & Visual Design
- Art style direction
- Asset creation strategy (custom vs asset store)
- Animation complexity
- Visual effects scope

### Analytics & Metrics
- Specific KPIs to track
- Analytics platform choice
- A/B testing strategy

### Legal & Administrative
- Legal entity formation
- Terms of Service drafting
- Privacy Policy
- Content moderation policies

### Technical Details
- Exact robot component system
- Battle simulation algorithm specifics
- Matchmaking algorithm
- Trading system mechanics

---

## Summary

Armoured Souls is a **casual, strategy-based robot battle management game** where players:
1. Build and configure battle robots
2. Set strategies and enlist in scheduled battles
3. View simulation results and replays
4. Iterate and improve based on outcomes
5. Progress through rankings, achieve fame, and master the game

The game prioritizes:
- **Accessibility**: Easy to learn, playable in 15-30 min/day
- **Strategy**: Deep customization and multiple paths to success
- **Community**: Social features, competition, and cooperation
- **Fairness**: No pay-to-win, skill and strategy matter most
- **Scalability**: Built to handle growth from 10 to 10,000+ players

Development focuses on:
- **MVP first**: Core features before expansion
- **Pragmatic choices**: Best tool for the job, not latest trends
- **Sustainable costs**: Serverless, scale-to-zero, managed services
- **Quality**: Security, testing, and performance from day one