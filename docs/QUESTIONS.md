# Armoured Souls - Planning Questions

This document contains remaining questions that need to be answered to refine our development roadmap and make informed implementation decisions.

**Note**: Core design questions have been answered and documented in GAME_DESIGN.md. This document contains follow-up questions and implementation details.

---

## Battle Simulation Engine

### Deterministic Simulation

1. **Random Number Generation**
   - How do we handle randomness in battles while maintaining determinism?
   - Use seeded RNG based on battle ID + timestamp?
   - What's the balance between randomness and predictability?

2. **Battle Duration Calculation**
   - What factors determine battle length?
   - Is there a minimum/maximum battle duration?
   - How do we prevent infinite battles?

3. **Victory Conditions**
   - Robot destroyed (health = 0)?
   - Surrender mechanism?
   - Timeout/draw conditions?
   - Tactical retreat implementation?

4. **Damage Calculation**
   - Formula for damage: Attack - Defense?
   - Critical hits and their probability?
   - Armor penetration mechanics?
   - Status effects (stun, slow, burn)?

5. **Action Resolution Order**
   - Speed-based (faster robots act first)?
   - Simultaneous actions?
   - Turn-based within the simulation?

### Conditional Triggers (Future Feature)

1. **Trigger Conditions**
   - Turn number (e.g., "turn 7")
   - Time-based (e.g., "after 3 minutes")
   - Health-based (e.g., "when health < 30%")
   - Situational (e.g., "when enemy uses special ability")

2. **Trigger Actions**
   - Activate special weapon
   - Change strategy/stance
   - Use consumable item
   - Attempt retreat

3. **Trigger Limits**
   - How many triggers per battle?
   - Cooldowns between trigger activations?
   - Cost to use triggers?

---

## Robot Component System

### Component Types

1. **Chassis**
   - What stats does chassis affect? (health, size, weight, defense?)
   - Size categories: Small, Medium, Large, Huge?
   - Weight impact on speed?
   - Slot limitations based on chassis?

2. **Weapons**
   - Primary and secondary weapon slots?
   - Weapon categories: Melee, Ranged, Energy, Explosive?
   - Weapon stats: Damage, speed, range, accuracy, ammo?
   - Can weapons break or degrade?

3. **Armor**
   - Physical armor vs energy shield?
   - Coverage zones (front, side, rear, top)?
   - Armor rating system?
   - Weight vs protection tradeoff?

4. **Engine/Power**
   - Speed vs power tradeoff?
   - Energy capacity for special abilities?
   - Fuel/energy consumption?

5. **Modules/Special Systems**
   - Utility modules: Repair, sensor, stealth?
   - Offensive modules: Targeting computer, weapon mods?
   - Defensive modules: Active protection, countermeasures?
   - How many module slots?

### Component Balancing

1. **Stat Ranges**
   - What's the minimum and maximum for each stat?
   - Linear or exponential scaling?
   - Diminishing returns at high values?

2. **Weight and Capacity**
   - Total weight limit per robot?
   - Over-weight penalties?
   - Capacity for weapons/modules?

3. **Cost Balancing**
   - How is component cost calculated?
   - Rarity tiers: Common, Uncommon, Rare, Epic, Legendary?
   - Maintenance cost scaling?

---

## Progression and Economy

### Currency System

1. **Currency Types**
   - Single currency or multiple?
   - "Credits" for purchases?
   - "Fame" as prestige currency?
   - Premium currency for monetization?

2. **Currency Earning**
   - Base rewards per battle?
   - Bonus for wins vs participation?
   - Achievement rewards?
   - Daily login bonuses?
   - Tournament prizes?

3. **Currency Spending**
   - Component purchases?
   - Robot repairs?
   - Upgrades?
   - Marketplace fees?
   - Tournament entry fees?

4. **Economy Balance**
   - Average earnings per day for active player?
   - Cost of a new robot?
   - Cost of high-end components?
   - Inflation prevention strategy?

### Fame System

1. **Fame Earning**
   - Fame per victory?
   - Bonus fame for impressive victories?
   - Fame from achievements?
   - Fame decay over time?

2. **Fame Benefits**
   - Unlock new components?
   - Access to special tournaments?
   - Cosmetic items?
   - Leaderboard position?

### Progression Pacing

1. **New Player Experience**
   - Starting currency amount?
   - Starter robot provided?
   - How quickly can they get second robot?
   - Tutorial rewards?

2. **Mid-Game**
   - Average time to competitive robot?
   - Progression milestones?
   - Unlock gates?

3. **End-Game**
   - What's the ceiling for progression?
   - Ongoing goals for maxed players?
   - Prestige/reset systems?

---

## Trading and Marketplace

### Implementation Details

1. **Marketplace Type**
   - Player-to-player auction house?
   - System-based store with dynamic prices?
   - Hybrid approach?

2. **Transaction Mechanics**
   - Listing fees?
   - Transaction taxes?
   - Escrow system?
   - Trade verification?

3. **Tradeable Items**
   - Complete robots?
   - Components?
   - Blueprints?
   - Cosmetics?
   - Currency (player-to-player trading)?

4. **Price Discovery**
   - Player-set prices?
   - Suggested pricing?
   - Price history tracking?
   - Market manipulation prevention?

5. **Blueprint System**
   - How do blueprints work?
   - One-time use or infinite?
   - Blueprint rarity?
   - Blueprint creation mechanics?

---

## Matchmaking System

### 1v1 Matchmaking

1. **Matching Criteria**
   - Skill-based (ELO/MMR)?
   - Robot power level?
   - Player level?
   - Win/loss record?
   - Fame tier?

2. **Queue System**
   - Single queue or multiple (ranked, casual, practice)?
   - Queue times - immediate or batched?
   - Can you select specific opponents?

3. **Fair Matching**
   - Maximum rating difference?
   - Widening search over time?
   - New player protection?
   - Smurf account prevention?

4. **Opt-in vs Opt-out**
   - Do players automatically enter queues?
   - Manual match creation?
   - Friend challenges?

### Team Battles (Future)

1. **Team Composition**
   - 2v2, 5v5, 11v11 mechanics?
   - Can one player control multiple robots?
   - Team formation strategies?

2. **Team Matchmaking**
   - Pre-made teams vs random?
   - Team MMR calculation?
   - Role selection?

---

## Tournament System

### Tournament Structure

1. **Tournament Types**
   - Single elimination?
   - Double elimination?
   - Round robin?
   - Swiss system?

2. **Tournament Duration**
   - Single-day tournaments?
   - Multi-day (week-long)?
   - Multi-week seasons?

3. **Tournament Entry**
   - Entry fee?
   - Fame requirement?
   - Invitation-only?
   - Open to all?

4. **Tournament Brackets**
   - Fixed size (8, 16, 32, 64 players)?
   - Dynamic based on registrations?
   - Seeding system?

5. **Rewards**
   - Prize pool distribution (winner takes all vs graduated)?
   - Unique rewards?
   - Titles/badges?
   - Fame multipliers?

---

## Social Features Priority

### Guild System

1. **Guild Structure**
   - Guild size limits?
   - Leadership hierarchy (leader, officers, members)?
   - Guild ranks?

2. **Guild Features**
   - Guild chat?
   - Guild warehouse/shared resources?
   - Guild-specific tournaments?
   - Guild vs Guild wars?

3. **Guild Benefits**
   - Experience bonuses?
   - Shared blueprints?
   - Guild-exclusive items?

### Friend System

1. **Friend Features**
   - Friend requests and acceptance?
   - Friend list size limit?
   - Online status visibility?
   - Friend-only battles?

2. **Friend Benefits**
   - Practice battles?
   - Gift system?
   - Referral bonuses?

### Leaderboards

1. **Leaderboard Types**
   - Global rankings?
   - Regional rankings?
   - Friend rankings?
   - Specialized rankings (fastest robot, most victories, etc.)?
   - Seasonal vs all-time?

2. **Leaderboard Updates**
   - Real-time or periodic?
   - Reset schedules?
   - Historical tracking?

---

## Technical Implementation Questions

### Local Development Setup

1. **Development Stack**
   - Docker Compose for local services?
   - PostgreSQL version?
   - Redis version?
   - Node.js version (LTS)?

2. **Development Database**
   - Seed data for testing?
   - Migration strategy?
   - Test data generation?

3. **Local Battle Processing**
   - How to test scheduled processing locally?
   - Cron simulation?
   - Manual trigger for development?

### AWS Migration Strategy

1. **Initial AWS Services**
   - Elastic Beanstalk vs ECS vs Lambda?
   - RDS for PostgreSQL?
   - ElastiCache for Redis?
   - S3 for assets?

2. **Serverless Architecture**
   - Which services should be Lambda functions?
   - API Gateway setup?
   - DynamoDB vs RDS for certain data?
   - Cold start mitigation?

3. **Cost Management**
   - Free tier utilization?
   - Reserved instances vs on-demand?
   - Auto-scaling policies?
   - Budget alerts?

4. **Deployment Pipeline**
   - GitHub Actions to AWS?
   - Infrastructure as Code (Terraform, CloudFormation)?
   - Staging environment?
   - Blue-green deployments?

---

## Data Schema Questions

### Database Design

1. **User Data**
   - User profile fields?
   - Authentication data storage?
   - User preferences?
   - Social connections?

2. **Robot Data**
   - Robot entity structure?
   - Component relationships?
   - Configuration snapshots for battles?
   - Historical robot states?

3. **Battle Data**
   - Battle records storage?
   - Replay data format (JSON, binary)?
   - Replay retention period?
   - Battle statistics aggregation?

4. **Indexes and Performance**
   - Key indexes for common queries?
   - Denormalization strategy?
   - Read replicas needed?

---

## Art and Visual Design (Still Open)

### Visual Style

1. **Art Direction**
   - 2D sprites vs 3D models?
   - Pixel art vs high-res?
   - Realistic vs stylized?
   - Dark/gritty vs colorful?

2. **Robot Visualization**
   - How detailed should robots look?
   - Customization visibility (can you see equipped weapons)?
   - Animation complexity?
   - Battle visualization style?

3. **UI Design**
   - Clean minimal vs information-dense?
   - Color scheme?
   - Accessibility considerations?
   - Mobile-responsive design patterns?

### Asset Creation

1. **Asset Sources**
   - Custom art commission?
   - Asset store purchases?
   - AI-generated art?
   - Community submissions?

2. **MVP Assets**
   - Placeholder graphics acceptable?
   - Minimum asset requirements?
   - Asset pipeline (creation, review, integration)?

---

## Testing Strategy Details

### Battle Simulation Testing

1. **Unit Tests**
   - Test individual damage calculations?
   - Test action resolution?
   - Test victory conditions?
   - Mock random number generation?

2. **Integration Tests**
   - Full battle simulation tests?
   - Performance tests (1000 battles/second)?
   - Load testing (10,000 concurrent battles)?

3. **Balance Testing**
   - Automated simulation of thousands of battles?
   - Statistical analysis of outcomes?
   - Dominant strategy detection?
   - Balance adjustment process?

---

## Analytics and Metrics

### Data Collection

1. **Player Metrics**
   - What player actions to track?
   - Session duration tracking?
   - Conversion funnel analysis?
   - Retention cohorts?

2. **Battle Metrics**
   - Average battle duration?
   - Most used components?
   - Win rates by robot type?
   - Balance indicators?

3. **Economy Metrics**
   - Currency flow analysis?
   - Inflation tracking?
   - Trading volume?
   - Monetization conversion rates?

### Analytics Tools

1. **Implementation**
   - Custom analytics vs third-party?
   - Real-time vs batch processing?
   - Data warehouse?
   - Visualization dashboards?

---

## Content Moderation

### User-Generated Content

1. **What Can Players Create?**
   - Custom robot names?
   - Profile descriptions?
   - Guild names and descriptions?
   - Chat messages?

2. **Moderation Strategy**
   - Automated filtering (profanity)?
   - Report system?
   - Moderator review?
   - Appeals process?

3. **Moderation Tools**
   - Admin dashboard?
   - Chat logs?
   - User history?
   - Ban/mute capabilities?

---

## Legal and Administrative

### Terms and Policies

1. **Documentation**
   - Who drafts Terms of Service?
   - Privacy Policy requirements?
   - Cookie policy?
   - Age verification method?

2. **Compliance**
   - GDPR compliance checklist?
   - COPPA compliance (if allowing under 13)?
   - Regional restrictions?
   - Data residency requirements?

3. **Intellectual Property**
   - Trademark registration?
   - Copyright for game assets?
   - User content ownership?

---

## Launch Strategy Details

### Beta Testing

1. **Beta Scope**
   - How many beta testers?
   - Open beta or closed?
   - Beta duration?
   - Beta player rewards?

2. **Beta Objectives**
   - What to test during beta?
   - Success criteria?
   - Feedback collection method?

3. **Beta to Launch Transition**
   - Wipe or keep progress?
   - Founder rewards?
   - Early access period?

### Marketing

1. **Initial Marketing**
   - Marketing budget?
   - Target channels (Reddit, Discord, etc.)?
   - Press outreach?
   - Influencer partnerships?

2. **Community Building**
   - Discord server setup?
   - Social media presence?
   - Dev blogs/updates?
   - Community feedback loops?

---

## Prioritization

For each remaining question, consider:
- **Impact**: How critical is this decision?
- **Timeline**: When do we need to decide?
- **Dependencies**: What blocks on this decision?

### High Priority (Need answers before Phase 1)
- Local development setup specifics
- Database schema basics
- Battle simulation core mechanics
- Component system fundamentals

### Medium Priority (Need answers during Phase 1-2)
- Matchmaking details
- Economy balancing
- Trading system mechanics
- Tournament structure

### Low Priority (Can decide during/after MVP)
- Art style
- Advanced features
- Marketing strategy
- Legal entity formation

---

## Next Actions

1. Review open questions
2. Answer high-priority questions
3. Create detailed specification documents for:
   - Battle simulation algorithm
   - Component system
   - Economy and progression
   - Database schema
4. Begin Phase 1 implementation

---

**Last Updated**: January 2026
**Status**: Core questions answered, implementation details remain
