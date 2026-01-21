# Armoured Souls - Planning Questions

This document contains key questions that need to be answered to refine our development roadmap and make informed architectural decisions.

---

## Game Design Questions

### Core Gameplay

1. **Battle Mechanics**
   - Will battles be turn-based or real-time?
   - How long should a typical battle last? (30 seconds? 5 minutes? 30 minutes?)
   - Will players actively control battles or just set up their robots beforehand?
   - Should there be manual intervention during battles (e.g., special abilities)?

2. **Robot Customization**
   - How deep should customization go? (visual only? stats? abilities?)
   - How many components can a robot have? (chassis, weapons, armor, engine, etc.)
   - Can players design robots from scratch or choose from templates?
   - How do we balance customization freedom with game balance?

3. **Progression System**
   - What does player progression look like? (XP levels? ranking? unlocks?)
   - How do robots improve? (leveling? upgrades? evolution?)
   - What resources do players collect? (currency? materials? energy?)
   - How quickly should players progress? (casual friendly? grind-heavy?)

4. **Stable Management**
   - How many robots can a player have in their stable?
   - Can players trade or sell robots?
   - Are there stable management costs (maintenance, storage)?
   - Can players specialize stables (PvP, PvE, specific tactics)?

5. **Game Modes**
   - What game modes will we launch with?
     - PvP ranked battles?
     - PvE campaigns/missions?
     - Tournaments?
     - Guild/clan wars?
     - Story mode?
   - Which modes are MVP (launch) vs post-launch?

6. **Social Features**
   - Guilds/clans?
   - Friend system?
   - In-game chat?
   - Spectator mode?
   - Replay sharing?
   - Leaderboards (global? regional? friends?)

---

## Technical Architecture Questions

### Backend Technology

1. **Language & Framework**
   - Node.js (JavaScript/TypeScript) - Fast development, large ecosystem
   - Python (FastAPI) - Great for data science, AI integration
   - Go - High performance, efficient concurrency
   - Rust - Maximum performance, memory safety
   - **Which aligns best with team skills and project needs?**

2. **Database Strategy**
   - Primary database: PostgreSQL (relational) vs MongoDB (document)?
   - Do we need both for different use cases?
   - What's our data model complexity? (relational heavy? document-friendly?)
   - Caching layer: Redis (definitely) but what else?

3. **Real-Time Communication**
   - WebSockets for live battles?
   - Server-Sent Events for updates?
   - Long polling as fallback?
   - How many concurrent battles do we expect?

4. **Game Engine**
   - Build custom battle simulation engine?
   - Use existing framework (Phaser.js, PixiJS)?
   - Server-side simulation vs client-side?
   - Deterministic vs non-deterministic?

---

### Scalability & Infrastructure

1. **Initial Scale**
   - How many players at launch? (100? 1000? 10,000?)
   - How many concurrent users? (10%? 50% of total?)
   - What's our growth projection? (double every month? year?)

2. **Hosting Strategy**
   - Cloud provider: AWS vs Azure vs GCP vs DigitalOcean?
   - Serverless vs traditional servers?
   - Managed services vs self-managed?
   - Multi-region from day one or start with one?

3. **Cost Considerations**
   - What's the budget for infrastructure?
   - How does cost scale with users?
   - Where can we optimize costs?
   - Free tier vs paid tiers?

---

## Security & Compliance Questions

1. **User Authentication**
   - Email/password (required)?
   - Social login (Google, Facebook, Apple)?
   - Guest accounts allowed?
   - Two-factor authentication from start?

2. **Data Privacy**
   - What user data do we collect?
   - Which regions will we target? (affects GDPR, CCPA compliance)
   - How do we handle user data deletion?
   - Age restrictions? (COPPA compliance if <13 years old)

3. **Payment Processing**
   - Will we have in-app purchases at launch?
   - Payment provider: Stripe vs PayPal vs others?
   - What will players buy? (cosmetics? power? convenience?)
   - Subscription model vs one-time purchases?

4. **Cheating Prevention**
   - What are the biggest cheating risks?
   - Server-authoritative or client-authoritative?
   - How do we detect and prevent cheating?
   - What's our ban/suspension policy?

---

## Mobile Strategy Questions

1. **Mobile Priority**
   - How important is mobile vs web?
   - When do we want mobile apps? (6 months? 1 year? later?)
   - iOS and Android simultaneously or one first?

2. **Development Approach**
   - React Native (code sharing with web)?
   - Flutter (better performance, less sharing)?
   - Native (best experience, most work)?

3. **Mobile-Specific Features**
   - Push notifications essential?
   - Offline play needed?
   - Device-specific features (gyroscope, camera)?

---

## Business Model Questions

1. **Monetization Strategy**
   - Free-to-play with in-app purchases?
   - Premium game (upfront cost)?
   - Subscription model?
   - Ad-supported?
   - Hybrid approach?

2. **What Can Players Buy?**
   - Cosmetic items only (fair, not pay-to-win)?
   - Time savers (speed up progress)?
   - Power increases (pay-to-win)?
   - Battle passes / season passes?
   - Premium currency?

3. **Launch Strategy**
   - Free during beta/early access?
   - Soft launch in select regions?
   - Global launch from day one?

---

## Team & Resources Questions

1. **Team Composition**
   - How many developers?
   - Frontend vs backend vs full-stack?
   - Do we have designers?
   - Do we have DevOps expertise?
   - Game designer on team?

2. **Timeline**
   - What's our target launch date?
   - Are we building MVP first or full vision?
   - What's MVP scope? (minimum features to launch)
   - What can wait for post-launch?

3. **Skills & Tools**
   - What technologies is the team already familiar with?
   - What are we willing to learn?
   - Do we have preferences that should influence tech stack?

---

## User Experience Questions

1. **Target Audience**
   - Hardcore gamers vs casual players?
   - Age range?
   - Geographic focus?
   - Mobile-first or desktop-first users?

2. **Onboarding**
   - How quickly should players understand the game?
   - Tutorial required?
   - How much complexity upfront?
   - Guided experience vs exploration?

3. **Session Length**
   - Quick sessions (5 minutes) or long sessions (30+ minutes)?
   - Async gameplay (play when you want) vs real-time (scheduled)?
   - How much daily time commitment expected?

---

## Art & Visual Design Questions

1. **Art Style**
   - Realistic vs stylized?
   - 2D vs 3D?
   - Pixel art vs high-res?
   - Dark/gritty vs colorful/friendly?

2. **Asset Creation**
   - Who creates art assets?
   - Custom art vs asset store?
   - Placeholder art in MVP?

3. **Performance Impact**
   - How detailed can graphics be while maintaining performance?
   - Animation complexity?
   - Effects and particles?

---

## Legal & Administrative Questions

1. **Company Structure**
   - Is there a legal entity?
   - Intellectual property ownership?
   - Contracts for contributors?

2. **Terms of Service**
   - Who writes ToS and Privacy Policy?
   - User agreement requirements?
   - Age restrictions?

3. **Content Moderation**
   - User-generated content allowed?
   - Moderation strategy?
   - Reporting system?

---

## Analytics & Metrics Questions

1. **Key Metrics to Track**
   - Daily Active Users (DAU)?
   - Retention (Day 1, Day 7, Day 30)?
   - Session length?
   - Battle completion rate?
   - Conversion rate (free to paid)?

2. **Analytics Tools**
   - Google Analytics?
   - Mixpanel, Amplitude?
   - Custom analytics?
   - Privacy-compliant tracking?

3. **A/B Testing**
   - Will we A/B test features?
   - What should we test first?
   - Tools for experimentation?

---

## Risk & Contingency Questions

1. **Technical Risks**
   - What's the biggest technical challenge?
   - Backup plans if primary tech choice fails?
   - Scalability concerns?

2. **Market Risks**
   - What if users don't engage?
   - Competitor analysis done?
   - Unique value proposition clear?

3. **Resource Risks**
   - What if we run out of budget?
   - What if key team members leave?
   - Can we reduce scope if needed?

---

## Prioritization Framework

For each feature/decision, let's consider:
1. **Impact**: How much does it improve the game? (High/Medium/Low)
2. **Effort**: How much work is required? (High/Medium/Low)
3. **Risk**: What could go wrong? (High/Medium/Low)
4. **Priority**: MVP vs Post-Launch vs Future

### Priority Matrix
```
High Impact + Low Effort + Low Risk = DO FIRST (MVP)
High Impact + High Effort + Low Risk = DO EARLY (Post-MVP)
High Impact + High Effort + High Risk = RESEARCH FIRST
Low Impact + Any Effort + Any Risk = DEFER
```

---

## Next Steps

Once we answer these questions, we can:
1. Finalize technology stack
2. Define MVP scope precisely
3. Create detailed project timeline
4. Assign responsibilities
5. Set up development environment
6. Begin iterative development

---

## Decision Log

As we answer these questions, we'll document decisions here:

| Date | Question | Decision | Rationale |
|------|----------|----------|-----------|
| TBD | Backend Language | TBD | TBD |
| TBD | Database | TBD | TBD |
| TBD | Mobile Strategy | TBD | TBD |
| ... | ... | ... | ... |

---

## Questions for Robert

**Immediate Priority Questions** (need answers to proceed):

1. What's your vision for battle gameplay - real-time or turn-based?
2. Do you have a target launch date in mind?
3. What's the team size and skill set?
4. Do you have a budget allocated for infrastructure and tools?
5. Is monetization planned for launch or post-launch?
6. What's the scope of MVP - minimal features to test concept or fuller experience?
7. Any strong preferences on technology stack (programming languages, frameworks)?
8. Target audience - age range, casual vs hardcore, geographic focus?

**Follow-up Questions** (can be answered as we progress):

1. Detailed game mechanics and rules
2. Art style and visual direction
3. Social features priority
4. Mobile timeline
5. Content moderation needs
6. Analytics requirements

---

Let's discuss these questions and start making decisions to move forward with a clear plan!