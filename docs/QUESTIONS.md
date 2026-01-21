# Armoured Souls - Planning Questions

This document contains key questions that need to be answered to refine our development roadmap and make informed architectural decisions.

---

## Game Design Questions

### Core Gameplay

1. **Battle Mechanics**
   - Will battles be turn-based or real-time? --> Neither. We'll have input variables (the various stats), planned battles and outcomes. At a specific time we'll run the scheduled matches and process the outcomes and present them to the players. 
   - How long should a typical battle last? (30 seconds? 5 minutes? 30 minutes?) --> Some battles will take longer based on the statistics. Doesn't matter, we'll process them at a specific time and present the results to the players.
   - Will players actively control battles or just set up their robots beforehand? --> They will set up their robots and pick their weapons. They do not control the actual outcome. A comparable game would be the Football Manager series (soccer management). You have input variables and the outcome is presented. 
   - Should there be manual intervention during battles (e.g., special abilities)? --> Might be a feature to add later, but I don't want players to intervent during the battle. I want to run all the battles and then proceed to then next phase. One thing we could look at is "My robot will trigger his mega-ultra-destructive BFG9000 during the 7th turn / after 3 min into the battle / when he is badly damaged"

2. **Robot Customization**
   - How deep should customization go? (visual only? stats? abilities?) --> This kind of depends on what you can do. We need a framework on which we can expand. 
   - How many components can a robot have? (chassis, weapons, armor, engine, etc.) --> We need to make it complex to make it interesting, but not overwhelming
   - Can players design robots from scratch or choose from templates? --> I would say both. They might be visually driven (humanoid) or functionality driven (sturdy but slow)
   - How do we balance customization freedom with game balance? --> Through testing and many, many, simulation matches run before launch. Players will find a way to exploit stuff, we'll need to adapt.

3. **Progression System**
   - What does player progression look like? (XP levels? ranking? unlocks?) --> Tied to the monetary system, but quite likely also tied to another currency like "fame" 
   - How do robots improve? (leveling? upgrades? evolution?) --> Spending money on upgrades
   - What resources do players collect? (currency? materials? energy?) --> Currency and quite possibly fame.
   - How quickly should players progress? (casual friendly? grind-heavy?) --> Casual friendly, one login per day and 15-30 min per day would be optimal. Maybe we need to implement some Pay to Win features to cover the costs for hosting to get additional money or fame.

4. **Stable Management**
   - How many robots can a player have in their stable? --> Not sure. More than one. 
   - Can players trade or sell robots? --> Yes this would be cool. And weapons. Maybe even blueprints. Buying / selling sounds easier to implement than trading. 
   - Are there stable management costs (maintenance, storage)? --> I would say that there is a small fee to be incurred when a robot has fought and is (badly) damaged. This would also give the player the change to "fight to the death" or "bail out when badly damaged" as a strategy for a fight you beforehand know you can't win.
   - Can players specialize stables (PvP, PvE, specific tactics)? --> Yes. It should be a valid strategy to create multiple crappy robots or have one mega good one and both strategies should be effective. Or someone who is only making money by designing and then selling weapons. There should be many ways to get fame / feel like you "win" the game. 

5. **Game Modes**
   - What game modes will we launch with? 
     - PvP ranked battles? --> PvP (ranked) battles should be most important. Let's start with 1v1, but maybe 2v2, 5v5 or even 11v11 might be interesting. Or "last man standing"
     - PvE campaigns/missions? - PvE might be sparring matches (less fame, less costs to repair). 
     - Tournaments? - Tournaments should be an important aspect spanning multiple days/weeks
     - Guild/clan wars? - Not in the first launch, but with mass matches this could be fun.
     - Story mode? - Not in the first launch. Maybe some small story mode to "get started" and explain the game.
   - Which modes are MVP (launch) vs post-launch?

6. **Social Features**
   - Guilds/clans? --> Yes
   - Friend system? --> Yes
   - In-game chat? --> Yes
   - Spectator mode? --> Yes, see the results of others 
   - Replay sharing? --> Yes
   - Leaderboards (global? regional? friends?) --> Yes. Many. Achievements. Rankings. League system. "Fastest robot", "Most dominant victory". Fame! Records!

---

## Technical Architecture Questions

### Backend Technology

1. **Language & Framework**
   - Node.js (JavaScript/TypeScript) - Fast development, large ecosystem
   - Python (FastAPI) - Great for data science, AI integration
   - Go - High performance, efficient concurrency
   - Rust - Maximum performance, memory safety
   - **Which aligns best with team skills and project needs?** --> There is no team. It's just you and me. 

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
  
--> In order to decide on the technology questions, I need to clarify more to give you some input. I think we'll eventually host this on AWS. But for now, I want to run this on my laptop and show it to some friends to test. I have no hosting contract yet. How are we going to achieve that? Or can you honestly tell me this is not the way to go?

---

### Scalability & Infrastructure

1. **Initial Scale**
   - How many players at launch? (100? 1000? 10,000?) --> Let's make it scalable and aim for the moon. 
   - How many concurrent users? (10%? 50% of total?) --> Not that many. I hope to aim for 15-30 min of time for each player each day.
   - What's our growth projection? (double every month? year?) --> Don't know yet.

2. **Hosting Strategy**
   - Cloud provider: AWS vs Azure vs GCP vs DigitalOcean? --> Most likely AWS
   - Serverless vs traditional servers? --> Serverless if possible to keep costs in check and make it scalable.
   - Managed services vs self-managed? --> Managed as far as we can go.
   - Multi-region from day one or start with one? --> Start with one. 

3. **Cost Considerations**
   - What's the budget for infrastructure? --> As low as we can. That's one of the reasons for serverless. Scale to zero should also be a possibility.
   - How does cost scale with users?  
   - Where can we optimize costs?
   - Free tier vs paid tiers? 

---

## Security & Compliance Questions

1. **User Authentication**
   - Email/password (required)? --> Yes
   - Social login (Google, Facebook, Apple)? --> Yes, but no "random" e-mail adresses. 
   - Guest accounts allowed? --> No
   - Two-factor authentication from start? --> No, feature for later.

2. **Data Privacy**
   - What user data do we collect? --> As few as possible to comply with GDPR and others
   - Which regions will we target? (affects GDPR, CCPA compliance) --> Global
   - How do we handle user data deletion? --> Follow the strictest guidelines (probably EU?)
   - Age restrictions? (COPPA compliance if <13 years old) --> Sounds good.

3. **Payment Processing**
   - Will we have in-app purchases at launch? --> To be decided later
   - Payment provider: Stripe vs PayPal vs others? --> To be decided later
   - What will players buy? (cosmetics? power? convenience?) --> Current plan is in game currency or fame. 
   - Subscription model vs one-time purchases? --> One time purchase, micro-transactions.

4. **Cheating Prevention**
   - What are the biggest cheating risks? --> Many multiple accounts to set up matches?
   - Server-authoritative or client-authoritative? 
   - How do we detect and prevent cheating? --> IPs?
   - What's our ban/suspension policy? --> Don't know yet

---

## Mobile Strategy Questions

1. **Mobile Priority**
   - How important is mobile vs web? --> Not very, let's get a working prototype first. The architecture should cater for an expansion. 
   - When do we want mobile apps? (6 months? 1 year? later?) --> Mobile browsing before Mobile native app
   - iOS and Android simultaneously or one first? --> iOS first

2. **Development Approach**
   - React Native (code sharing with web)? 
   - Flutter (better performance, less sharing)?
   - Native (best experience, most work)?

--> I don't care. You are the expert here

3. **Mobile-Specific Features**
   - Push notifications essential? --> We're probably going to process matches daily (or multiple times a day when we're very succesful)
   - Offline play needed? --> No
   - Device-specific features (gyroscope, camera)? --> Not planned currently.
  
--

## Business Model Questions

1. **Monetization Strategy**
   - Free-to-play with in-app purchases? --> Yes
   - Premium game (upfront cost)? --> No
   - Subscription model? --> No
   - Ad-supported? --> Maybe
   - Hybrid approach? --> Yes, in app purchases a possibility

2. **What Can Players Buy?**
   - Cosmetic items only (fair, not pay-to-win)? --> Yes but not only
   - Time savers (speed up progress)? --> No
   - Power increases (pay-to-win)? --> No, currency. Pay for currency.
   - Battle passes / season passes? --> Maybe to get access to special tournaments / leagues.
   - Premium currency? --> Not planned currently.

3. **Launch Strategy**
   - Free during beta/early access? --> Yes start free to play
   - Soft launch in select regions? --> Doesn't matter.
   - Global launch from day one? --> Yes.

---

## Team & Resources Questions

1. **Team Composition**
   - How many developers? --> Me and you. Keep it simple.
   - Frontend vs backend vs full-stack? --> You.
   - Do we have designers? --> Me and you.
   - Do we have DevOps expertise? --> Yes.
   - Game designer on team? --> You.

2. **Timeline**
   - What's our target launch date? --> ASAP whenever we have time.
   - Are we building MVP first or full vision? --> MVP first.
   - What's MVP scope? (minimum features to launch) --> user management, robot management, stable management, 1v1 matches 
   - What can wait for post-launch? --> Other stuff 

3. **Skills & Tools**
   - What technologies is the team already familiar with? --> I'm familiar with a lot of things but I'm not a developer. I have you.
   - What are we willing to learn? --> Everything.
   - Do we have preferences that should influence tech stack? --> Not really. 

---

## User Experience Questions

1. **Target Audience**
   - Hardcore gamers vs casual players? --> Casual, 15-30 min per day. Login each day.
   - Age range? --> 15-100
   - Geographic focus? --> No
   - Mobile-first or desktop-first users? --> Both? 

2. **Onboarding**
   - How quickly should players understand the game? --> Very quickly. Create a robot, enlisted in battle. 
   - Tutorial required? --> It is handy.
   - How much complexity upfront? --> Easy to learn, hard to master.
   - Guided experience vs exploration? --> Both if possible. Many ways to play the game.

3. **Session Length**
   - Quick sessions (5 minutes) or long sessions (30+ minutes)? --> Relatively quick: 5-20 min?
   - Async gameplay (play when you want) vs real-time (scheduled)? --> Scheduled.
   - How much daily time commitment expected? --> 15-30 min per day.

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
