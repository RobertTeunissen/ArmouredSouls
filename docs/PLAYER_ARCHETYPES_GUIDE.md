# Player Archetypes and Starting Strategies Guide

## Introduction

Welcome to the Player Archetypes and Starting Strategies Guide for Armoured Souls! This guide helps you make informed decisions about how to spend your starting budget of **₡3,000,000** based on your preferred playstyle and strategic goals.

### Why This Guide Exists

Armoured Souls features deep economic and progression systems with 23 attributes, 23 weapons, 14 facilities, and multiple viable paths to success. New players often face decision paralysis when confronted with so many choices. This guide reduces cognitive load by organizing strategies into 10 distinct archetypes, each with clear spending plans and progression roadmaps.

### How to Use This Guide

1. **Read "Understanding the Economy"** - Get familiar with core game systems (robots, facilities, income, costs)
2. **Browse the Archetype Comparison Table** - Quickly compare all 10 playstyles side-by-side
3. **Choose Your Archetype** - Pick the playstyle that matches your preferences
4. **Follow the Budget Allocation** - Spend your ₡3M according to your archetype's plan
5. **Execute the Strategy** - Follow the early game and mid game roadmaps
6. **Adapt as Needed** - Use the Hybrid Strategies section to evolve your approach

### What You'll Find Here

- **10 Player Archetypes** - Distinct playstyles from defensive Tank Fortress to aggressive Glass Cannon
- **Detailed Budget Allocations** - Exact spending breakdowns for your ₡3M starting budget
- **Economic Analysis** - Income projections, ROI calculations, and risk assessments
- **Progression Roadmaps** - Day-by-day guidance for your first 120 days
- **Build Synergies** - How archetypes align with robot builds and combat systems
- **Practical Examples** - Real calculations with actual game formulas
- **Risk Warnings** - Clear guidance on high-risk strategies and common pitfalls

### Key Philosophy

This guide emphasizes **practical, actionable advice with concrete numbers**. Every strategy includes specific costs, realistic projections, and step-by-step calculations. You won't find vague suggestions like "invest in facilities" - instead, you'll see "Purchase Training Facility Level 1 (see [STABLE_SYSTEM.md](docs/prd_core/STABLE_SYSTEM.md) for pricing) before attribute upgrades to save 5% on all future upgrades."

---

## Table of Contents

1. [Introduction](#introduction)
2. [Understanding the Economy](#understanding-the-economy)
   - [Robots and Attributes](#robots-and-attributes)
   - [Weapons and Loadouts](#weapons-and-loadouts)
   - [Facilities and Infrastructure](#facilities-and-infrastructure)
   - [Income Sources](#income-sources)
   - [Operating Costs](#operating-costs)
   - [League Progression](#league-progression)
3. [Player Archetypes](#player-archetypes)
   - [Tank Fortress](#tank-fortress)
   - [Glass Cannon](#glass-cannon)
   - [Speed Demon](#speed-demon)
   - [Balanced Brawler](#balanced-brawler)
   - [Facility Investor](#facility-investor)
   - [Two-Robot Specialist](#two-robot-specialist)
   - [Melee Specialist](#melee-specialist)
   - [Ranged Sniper](#ranged-sniper)
   - [AI Tactician](#ai-tactician)
   - [Prestige Rusher](#prestige-rusher)
4. [Archetype Comparison Table](#archetype-comparison-table)
5. [Starting Budget Allocations](#starting-budget-allocations)
6. [Early Game Strategy (Days 1-30)](#early-game-strategy-days-1-30)
7. [Mid Game Transition (Days 30-120)](#mid-game-transition-days-30-120)
8. [Build Synergies](#build-synergies)
9. [Economic Analysis](#economic-analysis)
10. [Hybrid Strategies](#hybrid-strategies)
11. [Weapon Purchase Strategy](#weapon-purchase-strategy)
12. [Practical Examples and Calculations](#practical-examples-and-calculations)
13. [Risk Assessment and Warnings](#risk-assessment-and-warnings)
14. [Quick Reference](#quick-reference)
15. [Appendices](#appendices)
    - [Appendix A: Complete Attribute List](#appendix-a-complete-attribute-list)
    - [Appendix B: Complete Weapon Catalog](#appendix-b-complete-weapon-catalog)
    - [Appendix C: Complete Facility List](#appendix-c-complete-facility-list)
    - [Appendix D: Formula Reference](#appendix-d-formula-reference)
    - [Appendix E: Glossary](#appendix-e-glossary)

---

## Understanding the Economy

Before diving into specific archetypes, let's establish a foundation of how Armoured Souls' economy works. Understanding these systems will help you make informed decisions about your starting budget.

### Robots and Attributes

**Robots** are your primary combat units. Each robot costs **₡500,000** to purchase and comes with base attributes at level 1.

**Attributes** define your robot's capabilities. There are **23 attributes** organized into four categories:

- **Combat Attributes** (6) - Combat Power, Penetration, Critical Systems, Weapon Control, Hydraulic Systems, Targeting Systems
- **Defense Attributes** (6) - Hull Integrity, Armor Plating, Shield Capacity, Damage Control, Counter Protocols, Redundant Systems
- **Mobility Attributes** (6) - Attack Speed, Servo Motors, Gyro Stabilizers, Reaction Time, Evasion Systems, Sensor Suite
- **AI Attributes** (5) - Combat Algorithms, Threat Analysis, Adaptive AI, Logic Cores, Neural Networks

**Attribute Upgrade Costs** follow this formula:
```
Cost to upgrade from level N to level N+1 = (N + 1) × ₡1,500
```

Examples:
- Level 1 → 2: ₡3,000
- Level 5 → 6: ₡9,000
- Level 10 → 11: ₡16,500

Upgrading a single attribute from level 1 to level 10 costs **₡82,500** total.

### Weapons and Loadouts

**Weapons** provide combat bonuses and come in different types. Weapon costs range from **₡50,000** (budget weapons like Practice Sword) to **₡500,000** (premium weapons like Plasma Cannon).

**Loadout Types** determine how you equip weapons:

1. **Single** - One weapon (any type)
2. **Weapon+Shield** - One weapon + Combat Shield
3. **Two-Handed** - One two-handed weapon (requires both hands)
4. **Dual-Wield** - Two one-handed weapons

Each loadout type provides different bonuses. For example, Weapon+Shield provides +10% defense, while Dual-Wield provides +15% attack speed.

**Important**: You start with default capacity for **5 weapons**. If you want to collect more weapons, you need to purchase Storage Facility (₡75,000 for Level 1, which increases capacity to 10 weapons).

### Facilities and Infrastructure

**Facilities** provide discounts, unlocks, passive income, or other benefits. See [STABLE_SYSTEM.md](docs/prd_core/STABLE_SYSTEM.md) for complete facility pricing. Key facilities include:

- **Training Facility** - 5% discount on attribute upgrades at Level 1
- **Repair Bay** - Repair cost discount (scales with robot count)
- **Weapons Workshop** - 5% discount on weapon purchases at Level 1
- **Income Generator** - Generates passive income daily
- **Roster Expansion** - **REQUIRED** to own more than 1 robot
- **Storage Facility** - Increases weapon storage capacity from 5 to 10

**Operating Costs**: All facilities have daily operating costs. For example:
- Training Facility Level 1: ₡1,500/day (₡10,500/week)
- Repair Bay Level 1: ₡1,000/day (₡7,000/week)
- Roster Expansion: ₡500/day per additional robot slot

**ROI Consideration**: Facilities with discount benefits only pay for themselves if you spend enough in that category. For example, Training Facility Level 1 saves 5% on upgrades but costs ₡10,500/week to operate. You'd need to spend ₡210,000/week on upgrades just to break even on operating costs (5% of ₡210K = ₡10.5K). Most players won't spend that much early on, so facility investments are often better suited for mid-game.

### Income Sources

Your primary income comes from **battle winnings**, which scale dramatically with league tier:

**League Rewards** (per win):
- **Bronze**: ₡5,000 - ₡10,000 + ₡1,500 participation
- **Silver**: ₡10,000 - ₡20,000 + ₡3,000 participation
- **Gold**: ₡20,000 - ₡40,000 + ₡6,000 participation
- **Platinum**: ₡40,000 - ₡80,000 + ₡12,000 participation
- **Diamond**: ₡80,000 - ₡150,000 + ₡24,000 participation
- **Champion**: ₡150,000 - ₡300,000 + ₡45,000 participation

**Participation Rewards**: You earn participation rewards even when you lose (approximately 30% of base win reward).

**Example Weekly Income** (7 battles, 50% win rate):
- **Bronze**: (3.5 wins × ₡7,500) + (7 battles × ₡1,500) = ₡36,750/week
- **Silver**: (3.5 wins × ₡15,000) + (7 battles × ₡3,000) = ₡73,500/week
- **Gold**: (3.5 wins × ₡30,000) + (7 battles × ₡6,000) = ₡147,000/week

**Key Insight**: Income doubles from Bronze to Silver and doubles again from Silver to Gold. League advancement is critical for economic sustainability.

**Secondary Income Sources**:
- **Passive Income** - Income Generator facility provides daily credits
- **Merchandising** - Unlocked at higher prestige levels
- **Streaming Revenue** - Based on robot fame and performance

### Operating Costs

Your main expenses are **repair costs** and **facility operating costs**.

**Repair Costs** depend on damage taken and total attributes:
```
Repair Cost = (Total Attributes × 100) × Damage % × Condition Multiplier
```

Example: Robot with 230 total attributes, 60% damage, 1.0 multiplier:
```
Repair Cost = (230 × 100) × 0.60 × 1.0 = ₡13,800
```

**Typical Weekly Repair Costs** (7 battles, 50% win rate, average 40% damage per loss):
- Low-defense build (200 attributes): ~₡11,200/week
- Balanced build (230 attributes): ~₡12,880/week
- High-defense build (260 attributes): ~₡14,560/week

**Facility Operating Costs**: Vary by facility type and level. Budget ₡7,000-₡20,000/week for early game facility costs.

### League Progression

**Leagues** are competitive tiers that dramatically affect your income and risk profile:

1. **Bronze** (Starting League)
   - Low income (₡5-10K per win)
   - High bankruptcy risk for aggressive builds
   - Goal: Advance to Silver within 2-4 weeks

2. **Silver** (Weeks 4-12)
   - 2× Bronze income
   - Moderate risk for most builds
   - Goal: Stabilize economy, advance to Gold

3. **Gold** (Weeks 12+)
   - 4× Bronze income
   - Low risk for most builds
   - Goal: Expand stable, invest in growth

**Critical Insight**: Many archetypes that are high-risk in Bronze become low-risk in Gold due to income scaling. For example, Glass Cannon has high repair costs, but Gold income (₡30K/win) easily covers repairs that would be devastating in Bronze (₡7.5K/win).

**League Advancement**: Win battles to increase your league rating. Consistent 50%+ win rate will naturally advance you through leagues over time.

---

## Player Archetypes

This section describes 10 distinct playstyles, each with unique strategic focuses, resource allocations, and progression paths. Choose the archetype that best matches your personality and goals.

### Tank Fortress

**Philosophy**: Outlast opponents through superior defense and counter-attacks. The Tank Fortress archetype is built on the principle that the best offense is a good defense - by surviving longer in battles, you force opponents to expend resources while you maintain economic sustainability through low repair costs.

**Robot Build Style**: Defensive powerhouse focused on survivability and attrition warfare. Your robot is designed to absorb punishment and turn enemy aggression against them through counter-attack protocols.

**Loadout Type**: Weapon+Shield (Combat Shield + Power Sword or Hammer)

The Weapon+Shield loadout provides +10% defense bonus and enables shield-specific attributes like Shield Capacity and Counter Protocols. This loadout excels at blocking incoming damage while maintaining offensive capability through your primary weapon.

**Attribute Focus**: 

Priority attributes for Tank Fortress builds:

1. **Hull Integrity** (Defense) - Your primary survivability stat. High HP means you can take more hits before needing repairs.
2. **Armor Plating** (Defense) - Reduces incoming damage, directly lowering repair costs.
3. **Shield Capacity** (Defense) - Increases shield durability, essential for Weapon+Shield loadout.
4. **Counter Protocols** (Defense) - Deals damage back to attackers, turning defense into offense.
5. **Combat Power** (Combat) - Ensures your counter-attacks and weapon strikes are meaningful.
6. **Damage Control** (Defense) - Reduces critical hit damage, preventing catastrophic losses.
7. **Redundant Systems** (Defense) - Provides backup systems that keep you fighting longer.

**League Scaling and Risk Profile**:

- **Bronze League**: Low risk. Even with modest income (₡5-10K per win), your low repair costs (typically ₡8-12K per loss) keep you profitable. Tank Fortress is one of the safest archetypes for Bronze.

- **Silver League**: Very low risk. Income doubles (₡10-20K per win) while repair costs remain stable. You'll build a healthy reserve quickly, enabling expansion investments.

- **Gold League and Beyond**: Extremely low risk. With income at ₡20-40K per win and repair costs still around ₡10-15K per loss, Tank Fortress becomes highly profitable. This archetype benefits greatly from league advancement because your costs don't scale with income.

**Personality Fit**: 

Tank Fortress is ideal for players who:
- Enjoy defensive playstyles and attrition warfare
- Prefer low-risk, sustainable strategies
- Value consistency over explosive plays
- Want to learn the game without bankruptcy pressure
- Appreciate seeing opponents exhaust themselves against your defenses
- Prefer longer battles with strategic positioning over quick eliminations

**Strategic Focus**:

The Tank Fortress strategy revolves around economic sustainability through low repair costs. While you won't win battles as quickly as Glass Cannon builds, you'll win the economic war by maintaining profitability even during losing streaks. Your goal is to:

1. **Survive First, Win Second**: Prioritize defensive attributes to minimize repair costs
2. **Counter-Attack**: Use Counter Protocols to punish aggressive opponents
3. **Outlast**: Force longer battles where your superior durability gives you the advantage
4. **Scale Safely**: Use your economic stability to invest in growth without bankruptcy risk
5. **Compound Advantages**: As you advance leagues, your profit margins increase dramatically

**Why Tank Fortress Works**:

The key insight is that repair costs are based on damage taken, not league tier. A Tank Fortress in Gold League pays similar repair costs to Bronze League, but earns 4× the income. This creates a widening profit margin that makes Tank Fortress increasingly powerful as you progress.

**Common Misconceptions**:

- "Defensive builds can't win": False. Counter Protocols and solid Combat Power ensure you deal meaningful damage.
- "Tank builds are boring": Subjective, but many players find satisfaction in perfect defensive play.
- "You need high damage to advance leagues": False. Consistent wins matter more than quick wins, and Tank Fortress provides consistency.

**Quick Summary**:

Tank Fortress is the safest, most forgiving archetype in Armoured Souls. If you're new to the game, risk-averse, or want to learn mechanics without bankruptcy pressure, this is your archetype. You'll advance steadily through leagues while building a strong economic foundation for future expansion.

---

### Glass Cannon

**Philosophy**: Eliminate opponents before they can respond with overwhelming damage. The Glass Cannon archetype embraces the principle that the best defense is a devastating offense - by ending battles quickly through superior firepower, you minimize the opportunity for opponents to damage you while maximizing your win rate potential.

**Robot Build Style**: Offensive powerhouse focused on maximum damage output and quick eliminations. Your robot is designed to deliver crushing blows that end battles in seconds, trading survivability for raw destructive power.

**Loadout Type**: Two-Handed (Plasma Cannon, Railgun, or Heavy Hammer)

The Two-Handed loadout provides +20% damage bonus and enables the most powerful weapons in the game. These weapons require both hands but deliver devastating single strikes that can cripple or eliminate opponents in one hit. This loadout excels at alpha strike damage and burst potential.

**Attribute Focus**: 

Priority attributes for Glass Cannon builds:

1. **Combat Power** (Combat) - Your primary damage stat. Every point directly increases your weapon damage output.
2. **Critical Systems** (Combat) - Increases critical hit chance and damage, enabling devastating spike damage.
3. **Penetration** (Combat) - Bypasses enemy armor, ensuring your damage reaches their hull.
4. **Weapon Control** (Combat) - Improves accuracy and weapon effectiveness, critical for landing your big hits.
5. **Hydraulic Systems** (Combat) - Boosts melee weapon damage (if using Heavy Hammer or Battle Axe).
6. **Targeting Systems** (Combat) - Improves accuracy for ranged weapons (if using Plasma Cannon or Railgun).
7. **Hull Integrity** (Defense) - Minimal investment for basic survivability, but not the focus.

**League Scaling and Risk Profile**:

- **Bronze League**: High risk. With income at ₡5-10K per win but repair costs of ₡15-25K per loss (due to low defense), losing streaks can quickly drain your reserves. Glass Cannon requires a 55-60% win rate to stay profitable in Bronze. This is the most dangerous phase for this archetype.

- **Silver League**: Medium-high risk. Income doubles to ₡10-20K per win, making losses more manageable (repair costs still ₡15-25K). A 50-55% win rate becomes sustainable. The pressure eases but you're not safe yet.

- **Gold League and Beyond**: Medium risk. With income at ₡20-40K per win, even expensive repairs (₡15-25K) are easily covered. At 50% win rate, you're highly profitable. Glass Cannon transforms from high-risk to high-reward once you reach Gold.

**High-Risk/High-Reward Nature**:

Glass Cannon is the quintessential high-risk/high-reward archetype:

**The Risk**:
- Low defensive attributes mean you take heavy damage when you lose
- Repair costs are 50-100% higher than Tank Fortress
- Requires above-average win rate (55%+) to stay profitable in Bronze
- Losing streaks can lead to bankruptcy in early leagues
- No margin for error - every loss hurts economically

**The Reward**:
- Highest damage output of any archetype
- Quick battle victories save time and maximize battles per session
- High win rate potential due to overwhelming offense
- Scales excellently into Gold+ leagues where income covers risks
- Exciting, aggressive gameplay with explosive moments
- When you win, you win decisively

**The Critical Insight**: Glass Cannon is a "league advancement dependent" archetype. You're racing to reach Silver/Gold before your reserves run out. If you can maintain 55%+ win rate in Bronze and advance quickly, you'll transition into one of the most profitable archetypes in the game. If you struggle in Bronze, you may face bankruptcy.

**Personality Fit**: 

Glass Cannon is ideal for players who:
- Enjoy aggressive, offensive playstyles
- Thrive on high-risk/high-reward scenarios
- Prefer quick, decisive battles over long attrition wars
- Have confidence in their combat skills (or want to develop them)
- Find excitement in explosive damage and one-shot potential
- Are willing to accept bankruptcy risk for maximum damage output
- Enjoy the challenge of "glass cannon" builds in other games
- Want to feel powerful and dominant when winning

**Not Recommended For**:
- New players learning game mechanics
- Risk-averse players who prefer safety
- Players with limited playtime (can't grind through Bronze quickly)
- Anyone uncomfortable with potential bankruptcy

**Strategic Focus**:

The Glass Cannon strategy revolves around maximizing win rate through overwhelming offense:

1. **End Battles Quickly**: Your goal is to eliminate opponents before they can damage you significantly
2. **Maximize Damage**: Invest heavily in offensive attributes to ensure your strikes are lethal
3. **Accept the Risk**: Understand that losses will be expensive - your job is to win more than you lose
4. **Race to Gold**: Advance through Bronze/Silver as quickly as possible to reach sustainable income
5. **Leverage High Win Rate**: Your superior offense should translate to 55-60%+ win rate, offsetting repair costs
6. **Strike First, Strike Hard**: Use aggressive battle stances and high-damage weapons to control fights

**Why Glass Cannon Works**:

The key insight is that offense scales better than defense in Armoured Souls' combat system. A robot with 300 Combat Power and 150 Hull Integrity will often defeat a robot with 200 Combat Power and 250 Hull Integrity because the fight ends before the defensive advantage matters. Glass Cannon exploits this by going all-in on offense.

Additionally, quick victories mean you can fight more battles per session, increasing your total income potential. While each loss is expensive, your higher win rate and battle frequency can offset the costs.

**Common Misconceptions**:

- "Glass Cannon always goes bankrupt": False. With 55%+ win rate, Glass Cannon is profitable even in Bronze.
- "You need perfect play": False. You need good play, but 55-60% win rate is achievable for most players.
- "Glass Cannon can't survive Gold+": False. Glass Cannon thrives in Gold+ where income easily covers repair costs.
- "Defense is always better": False. Offense can prevent damage by ending fights quickly.

**The Make-or-Break Moment**:

Glass Cannon's success hinges on your first 2-4 weeks in Bronze League. If you can:
- Maintain 55%+ win rate
- Advance to Silver within 3-4 weeks
- Preserve at least ₡100,000 in reserves

...then you'll transition into a highly profitable, exciting archetype. If you struggle in Bronze, consider pivoting to a more defensive build or accepting the bankruptcy risk as a learning experience.

**Quick Summary**:

Glass Cannon is the most aggressive, high-risk archetype in Armoured Souls. If you're confident in your combat skills, enjoy explosive damage, and are willing to accept bankruptcy risk for maximum offensive power, this is your archetype. You'll either dominate your way to Gold League or learn valuable lessons about risk management. Not for the faint of heart, but incredibly rewarding for skilled players.

---

### Speed Demon

**Philosophy**: Overwhelm with rapid attacks and superior positioning. The Speed Demon archetype is built on the principle that speed kills - by attacking faster than opponents can respond and maintaining superior mobility, you control the pace of battle and accumulate damage through sheer volume of strikes rather than individual hit power.

**Robot Build Style**: High-speed attacker focused on attack rate and mobility. Your robot is designed to deliver a relentless barrage of attacks, using superior speed to strike multiple times before opponents can land a single hit. Think of it as death by a thousand cuts rather than one massive blow.

**Loadout Type**: Dual-Wield (2× Machine Guns, 2× Plasma Blades, or mixed)

The Dual-Wield loadout provides +15% attack speed bonus and enables you to equip two one-handed weapons simultaneously. This loadout excels at maximizing attacks per second, allowing you to stack damage rapidly through volume rather than individual strike power. You can mix weapon types (e.g., Machine Gun + Plasma Blade) for versatility or double down on a single type for specialization.

**Attribute Focus**: 

Priority attributes for Speed Demon builds:

1. **Attack Speed** (Mobility) - Your primary stat. Every point increases how many attacks you can deliver per second, directly multiplying your damage output.
2. **Servo Motors** (Mobility) - Improves movement speed and positioning, allowing you to control engagement distance and dodge attacks.
3. **Gyro Stabilizers** (Mobility) - Enhances stability during rapid movement, maintaining accuracy while attacking at high speed.
4. **Weapon Control** (Combat) - Ensures your rapid attacks actually hit the target, critical when firing/swinging multiple times per second.
5. **Combat Power** (Combat) - While not your primary focus, you still need decent damage per hit to make your attack volume meaningful.
6. **Reaction Time** (Mobility) - Improves your ability to respond to threats and adjust positioning mid-battle.
7. **Evasion Systems** (Mobility) - Helps you avoid incoming attacks through superior mobility, reducing damage taken.

**League Scaling and Risk Profile**:

- **Bronze League**: Medium risk. With income at ₡5-10K per win and moderate repair costs (₡12-18K per loss due to balanced defense), you need roughly 52-55% win rate to stay profitable. Speed Demon is more forgiving than Glass Cannon but less safe than Tank Fortress. Your mobility helps you win consistently, keeping you profitable.

- **Silver League**: Low-medium risk. Income doubles to ₡10-20K per win while repair costs remain stable at ₡12-18K per loss. At 50% win rate, you're comfortably profitable. Your speed advantage becomes more valuable as opponents get tougher, helping maintain win rate.

- **Gold League and Beyond**: Low risk. With income at ₡20-40K per win and repair costs still ₡12-18K per loss, Speed Demon becomes highly profitable. Your consistent performance across leagues makes this archetype increasingly safe as you progress.

**Consistent Across Leagues**:

Unlike Glass Cannon (high risk in Bronze, low risk in Gold) or Tank Fortress (very safe everywhere), Speed Demon maintains a consistent risk profile across leagues:

**Why Consistency?**
- Your repair costs are moderate (not as low as Tank, not as high as Glass Cannon)
- Your win rate stays relatively stable because speed is always valuable
- You don't rely on overwhelming offense (Glass Cannon) or pure defense (Tank)
- Your mobility gives you consistent advantages regardless of league tier

**The Steady Income Pattern**:
- Bronze: Profitable at 52-55% win rate
- Silver: Profitable at 50-52% win rate  
- Gold: Profitable at 48-50% win rate

Your break-even win rate actually decreases as you advance leagues because income scales faster than your repair costs. This creates a "smooth scaling" experience where you feel progressively more comfortable economically without dramatic shifts in risk.

**Personality Fit**: 

Speed Demon is ideal for players who:
- Enjoy fast-paced, action-oriented combat
- Prefer mobility and positioning over raw tankiness or damage
- Like the fantasy of rapid-fire attacks and overwhelming opponents with speed
- Want to optimize DPS (damage per second) rather than damage per hit
- Appreciate consistent, predictable performance across all game phases
- Enjoy the tactical depth of positioning and movement
- Find satisfaction in "outplaying" opponents through superior speed
- Want a moderate-risk archetype that's neither too safe nor too dangerous

**Not Recommended For**:
- Players who prefer slow, methodical combat
- Those who want the absolute safest option (choose Tank Fortress instead)
- Players who want maximum burst damage (choose Glass Cannon instead)
- Anyone who dislikes managing positioning and movement

**Strategic Focus**:

The Speed Demon strategy revolves around controlling battle tempo through superior attack rate and mobility:

1. **Attack Volume Over Power**: Your goal is to land 3-4 attacks while opponents land 1-2, accumulating damage through sheer frequency.
2. **Positioning Mastery**: Use your mobility to maintain optimal engagement distance - close enough to attack, far enough to evade.
3. **Sustained Pressure**: Keep opponents under constant pressure with your relentless attack rate, preventing them from executing their strategy.
4. **Mobility as Defense**: Your speed isn't just for offense - use it to dodge attacks and minimize damage taken.
5. **Consistent Performance**: Maintain steady 50-55% win rate across all leagues through reliable speed advantage.
6. **Dual-Wield Synergy**: Leverage your two weapons to maximize attacks per second, creating a damage output that rivals Glass Cannon without the fragility.

**Dual-Wield Strategy and Mobility Focus**:

The core of Speed Demon is the synergy between Dual-Wield loadout and mobility attributes:

**Dual-Wield Mechanics**:
- Equip two one-handed weapons (e.g., 2× Machine Guns, 2× Plasma Blades, or one of each)
- Gain +15% attack speed bonus from loadout type
- Each weapon attacks independently, effectively doubling your attack frequency
- Weapon Control becomes critical - you need accuracy for all these attacks to land

**Mobility Synergy**:
- Attack Speed increases how fast each weapon attacks
- Servo Motors lets you reposition between attacks, maintaining optimal range
- Gyro Stabilizers keeps you accurate while moving at high speed
- Reaction Time helps you respond to opponent movements instantly

**The Speed Demon Combat Loop**:
1. Engage at optimal range using Servo Motors
2. Unleash rapid dual-wield attacks using Attack Speed
3. Maintain accuracy with Gyro Stabilizers and Weapon Control
4. Reposition as needed using mobility attributes
5. Evade incoming attacks using Evasion Systems and Reaction Time
6. Repeat until opponent is overwhelmed

**Why This Works**:
- Your attack frequency (2 weapons × high Attack Speed) creates DPS comparable to Glass Cannon
- Your mobility (Servo Motors, Gyro Stabilizers) provides defensive value comparable to moderate armor
- You get "best of both worlds" - good offense AND good defense through speed
- Opponents struggle to land hits on a fast-moving target
- Your consistent damage output makes you reliable across all matchups

**Weapon Choice Considerations**:

Speed Demon has flexibility in weapon selection:

**Option 1: Dual Machine Guns** (2× ₡150,000 = ₡300,000)
- Maximizes ranged attack frequency
- Best for pure DPS optimization
- Requires high Weapon Control for accuracy
- Synergizes with Targeting Systems

**Option 2: Dual Plasma Blades** (2× ₡200,000 = ₡400,000)
- Maximizes melee attack frequency
- Best for close-range brawling
- Requires positioning mastery
- Synergizes with Hydraulic Systems

**Option 3: Mixed Loadout** (Machine Gun ₡150,000 + Plasma Blade ₡200,000 = ₡350,000)
- Provides versatility for different ranges
- Best for adaptable playstyle
- Requires balanced attribute investment
- Synergizes with both ranged and melee attributes

Most Speed Demon players choose Option 1 (Dual Machine Guns) for the lower cost and ranged safety, but all three options are viable depending on your preferred combat style.

**Why Speed Demon Works**:

The key insight is that attack speed multiplies your effective damage output. If you have 100 Combat Power and attack twice as fast as your opponent, you're effectively dealing 200 damage per time unit. Speed Demon exploits this by:

1. **Dual-Wield**: Two weapons = 2× base attack frequency
2. **Attack Speed Attribute**: +50-100% attack speed from high levels
3. **Loadout Bonus**: +15% attack speed from Dual-Wield type
4. **Combined Effect**: 2 weapons × 1.5-2.0 speed × 1.15 bonus = 3.45-4.6× effective attack frequency

This means a Speed Demon with moderate Combat Power (150) can match or exceed the DPS of a Glass Cannon with high Combat Power (250) through sheer attack volume.

**Common Misconceptions**:

- "Speed builds are fragile": False. Speed Demon has moderate defense and uses mobility as additional protection.
- "You need perfect positioning": False. You need good positioning, but your speed gives you room for error.
- "Dual-wield is expensive": Partially true. Two weapons cost more than one, but you're still cheaper than premium two-handed weapons.
- "Speed builds fall off late game": False. Speed scales consistently across all leagues and remains effective.
- "You can't tank damage": True, but you don't need to - your mobility lets you avoid damage.

**The Goldilocks Archetype**:

Speed Demon is often called the "Goldilocks" archetype because it sits in the middle of the risk/reward spectrum:

- Not as safe as Tank Fortress, but safer than Glass Cannon
- Not as high damage as Glass Cannon, but higher than Tank Fortress
- Not as cheap as single-weapon builds, but cheaper than premium two-handed weapons
- Not as forgiving as Balanced Brawler, but more forgiving than Glass Cannon

This "just right" positioning makes Speed Demon an excellent choice for players who want excitement without extreme risk, and power without fragility.

**Quick Summary**:

Speed Demon is a fast-paced, mobility-focused archetype that overwhelms opponents through rapid dual-wield attacks and superior positioning. If you enjoy action-oriented combat, want consistent performance across all leagues, and appreciate the tactical depth of movement and positioning, this is your archetype. You'll maintain steady profitability through reliable win rates while experiencing some of the most dynamic combat in Armoured Souls. A perfect middle-ground between safety and aggression.

---

### Balanced Brawler

**Philosophy**: Flexible all-rounder that adapts to any situation. The Balanced Brawler archetype is built on the principle that versatility and adaptability trump specialization - by maintaining competence across all combat dimensions (offense, defense, mobility), you can handle any opponent and any situation without critical weaknesses. This is the "learn the game safely" archetype.

**Robot Build Style**: Balanced generalist with no major weaknesses. Your robot is designed to be competent at everything rather than exceptional at one thing. You have enough offense to threaten opponents, enough defense to survive mistakes, and enough mobility to position effectively. Think of it as the "jack of all trades, master of none" approach - but in Armoured Souls, being good at everything is often better than being great at one thing and terrible at others.

**Loadout Type**: Single (Power Sword, Plasma Rifle, or versatile weapon)

The Single loadout is the simplest and most cost-effective option. You equip one weapon (any type) and focus on mastering its use. This loadout doesn't provide the specialized bonuses of Weapon+Shield (+10% defense), Two-Handed (+20% damage), or Dual-Wield (+15% attack speed), but it also doesn't lock you into a specific playstyle. You can experiment with different weapons as you learn the game without needing to rebuild your entire attribute distribution.

**Attribute Focus**: 

Priority attributes for Balanced Brawler builds (distributed evenly):

1. **Combat Power** (Combat) - Your primary offensive stat. Invest enough to threaten opponents without over-specializing.
2. **Hull Integrity** (Defense) - Your primary defensive stat. Invest enough to survive mistakes without becoming a pure tank.
3. **Attack Speed** (Mobility) - Your primary mobility stat. Invest enough to keep pace with opponents without becoming a speed specialist.
4. **Armor Plating** (Defense) - Secondary defense to reduce incoming damage and lower repair costs.
5. **Weapon Control** (Combat) - Secondary offense to improve accuracy and weapon effectiveness.
6. **Servo Motors** (Mobility) - Secondary mobility to improve positioning and movement.
7. **Damage Control** (Defense) - Tertiary defense to reduce critical hit damage.

**The Balanced Distribution Philosophy**:

Unlike specialized archetypes that invest 70-80% of attributes into one category, Balanced Brawler distributes roughly:
- 35% Combat attributes
- 35% Defense attributes  
- 30% Mobility attributes

This creates a robot with no glaring weaknesses. You won't have the highest damage (Glass Cannon), the best defense (Tank Fortress), or the fastest attacks (Speed Demon), but you'll be competitive in all three areas. This versatility is incredibly valuable for learning the game and adapting to different opponents.

**League Scaling and Risk Profile**:

- **Bronze League**: Very low risk. With income at ₡5-10K per win and low-moderate repair costs (₡10-15K per loss due to balanced defense), you need roughly 50-52% win rate to stay profitable. Balanced Brawler is the most forgiving archetype in Bronze because your balanced stats help you win consistently without exposing you to catastrophic losses.

- **Silver League**: Very low risk. Income doubles to ₡10-20K per win while repair costs remain stable at ₡10-15K per loss. At 50% win rate, you're comfortably profitable with healthy margins. Your versatility helps you maintain consistent performance as opponents get tougher.

- **Gold League and Beyond**: Very low risk. With income at ₡20-40K per win and repair costs still ₡10-15K per loss, Balanced Brawler becomes highly profitable. Your steady progression continues without dramatic shifts in risk or strategy.

**Steady Progression - No Dramatic Swings**:

Balanced Brawler is characterized by smooth, predictable progression:

**Why No Swings?**
- Your repair costs are low-moderate (better than Glass Cannon, slightly higher than Tank Fortress)
- Your win rate stays stable because you have no critical weaknesses to exploit
- You don't rely on high-risk strategies that work in some leagues but not others
- Your balanced stats remain effective regardless of opponent type or league tier
- You never face "make or break" moments like Glass Cannon in Bronze

**The Smooth Scaling Experience**:
- Bronze: Profitable at 50-52% win rate, very safe
- Silver: Profitable at 48-50% win rate, very safe
- Gold: Profitable at 45-48% win rate, very safe

Your break-even win rate decreases steadily as you advance leagues, creating a progressively more comfortable economic situation. There are no sudden jumps in risk or reward - just steady, reliable growth.

**Why This Is Most Forgiving for New Players**:

Balanced Brawler is universally recommended for new players for several critical reasons:

**1. No Catastrophic Failure Modes**
- Glass Cannon can go bankrupt in Bronze if win rate drops below 55%
- Tank Fortress can struggle to win if you over-invest in defense
- Speed Demon requires good positioning skills to leverage mobility
- Balanced Brawler has no "trap" scenarios - you're always viable

**2. Learn All Game Systems**
- You invest in all attribute categories, learning what each does
- You can experiment with different weapons without rebuilding
- You experience offense, defense, and mobility gameplay
- You develop well-rounded skills applicable to any future archetype

**3. Forgiving of Mistakes**
- Enough defense to survive tactical errors
- Enough offense to capitalize on opponent mistakes
- Enough mobility to recover from bad positioning
- Large reserve buffer (₡150,000+) provides economic safety net

**4. Adaptable to Any Opponent**
- Facing a tank? Your offense is sufficient to win
- Facing a glass cannon? Your defense is sufficient to survive
- Facing a speed demon? Your mobility is sufficient to compete
- No hard counters or unwinnable matchups

**5. Easy Transition to Specialization**
- Once you learn the game, you can pivot to any specialized archetype
- Your balanced foundation makes it easy to identify what you enjoy
- You can gradually shift attribute focus without starting over
- Your facility investments (Training Facility, Repair Bay) support any future build

**6. Lowest Stress Gameplay**
- No bankruptcy pressure
- No "must win" scenarios
- No complex positioning requirements
- No fragile glass cannon anxiety
- Just learn, play, and improve at your own pace

**The New Player Safety Net**:

Balanced Brawler is designed to be the "you can't mess this up" archetype. Even if you:
- Make suboptimal attribute choices
- Lose several battles in a row
- Spend your reserve buffer on mistakes
- Take longer to advance leagues

...you'll still be fine. The archetype's inherent safety margins and balanced design protect you from the consequences of inexperience. This lets you focus on learning game mechanics, combat systems, and strategic thinking without economic pressure.

**Personality Fit**: 

Balanced Brawler is ideal for players who:
- Are new to Armoured Souls and want to learn safely
- Prefer flexibility and adaptability over specialization
- Want the safest possible archetype with minimal bankruptcy risk
- Enjoy being competent at everything rather than exceptional at one thing
- Value consistency and reliability over explosive plays
- Want to experiment with different weapons and playstyles
- Prefer gradual learning without pressure
- Appreciate having no critical weaknesses
- Want a "comfort pick" that works in any situation

**Recommended For**:
- **All new players** - This is the default recommendation
- Risk-averse players who want maximum safety
- Players who want to learn all game systems before specializing
- Anyone who values versatility over min-maxing
- Players who want stress-free gameplay

**Not Recommended For**:
- Experienced players who know exactly what they want
- Players who crave specialization and optimization
- Those who find "balanced" builds boring
- Anyone who wants to push the limits of a specific playstyle

**Strategic Focus**:

The Balanced Brawler strategy revolves around versatility and safe learning:

1. **No Weaknesses**: Your goal is to be competent at everything, ensuring you're never at a severe disadvantage.
2. **Adaptability**: Adjust your tactics based on opponent type - play defensively against glass cannons, offensively against tanks.
3. **Consistent Performance**: Maintain steady 50-52% win rate through reliable, balanced stats.
4. **Safe Learning**: Use your economic safety net to experiment and learn without bankruptcy fear.
5. **Gradual Improvement**: Focus on improving your skills rather than optimizing your build - your build is already good enough.
6. **Foundation Building**: Establish a strong economic foundation and game knowledge base for future specialization.

**Single Weapon Build and Versatility**:

The core of Balanced Brawler is the Single loadout's simplicity and flexibility:

**Single Loadout Mechanics**:
- Equip one weapon of any type (one-handed, two-handed, ranged, melee)
- No loadout bonus (unlike Weapon+Shield, Two-Handed, or Dual-Wield)
- Lowest cost option (one weapon instead of two)
- Maximum flexibility - can switch weapons without rebuilding attributes

**Why Single Loadout for Balanced Brawler?**
- **Cost Efficiency**: One weapon (₡150,000-₡250,000) vs two weapons (₡300,000-₡500,000)
- **Simplicity**: Focus on learning combat mechanics without complex loadout interactions
- **Flexibility**: Can experiment with different weapons as you learn preferences
- **Attribute Freedom**: Don't need to specialize attributes for specific loadout bonuses
- **Reserve Buffer**: Savings from single weapon go into larger emergency fund

**Weapon Choice Considerations**:

Balanced Brawler has flexibility in weapon selection:

**Option 1: Power Sword** (₡200,000)
- Versatile melee weapon with good damage and speed
- Works well with balanced attributes
- No extreme requirements (unlike Heavy Hammer needing high Hydraulic Systems)
- Good for learning melee combat fundamentals

**Option 2: Plasma Rifle** (₡250,000)
- Versatile ranged weapon with good damage and accuracy
- Works well with balanced attributes
- Safer than melee (can attack from distance)
- Good for learning ranged combat fundamentals

**Option 3: Machine Gun** (₡150,000)
- Budget-friendly ranged weapon with high attack speed
- Leaves more budget for attributes or reserve buffer
- Good damage output through volume of fire
- Excellent for learning positioning and accuracy

**Recommendation**: Most Balanced Brawler players choose **Plasma Rifle** (₡250,000) for the combination of good damage, ranged safety, and versatility. However, all three options are viable, and you can experiment later once you've built up reserves.

**The Balanced Attribute Distribution**:

Here's what a typical Balanced Brawler attribute spread looks like after initial investments:

**Combat Attributes** (~35% of total investment):
- Combat Power: Level 6-8 (moderate damage output)
- Weapon Control: Level 4-6 (decent accuracy)
- Penetration: Level 3-5 (some armor bypass)

**Defense Attributes** (~35% of total investment):
- Hull Integrity: Level 6-8 (moderate HP pool)
- Armor Plating: Level 4-6 (decent damage reduction)
- Damage Control: Level 3-5 (some crit protection)

**Mobility Attributes** (~30% of total investment):
- Attack Speed: Level 5-7 (decent attack frequency)
- Servo Motors: Level 4-6 (good positioning)
- Reaction Time: Level 3-5 (adequate responsiveness)

**Total Attributes**: ~230-250 (compared to specialists at 200-280)

This distribution ensures you're competitive in all areas without excelling in any particular one. You'll have:
- Enough damage to threaten any opponent
- Enough defense to survive mistakes and bad matchups
- Enough mobility to position effectively and avoid being kited
- No glaring weaknesses for opponents to exploit

**Why Balanced Brawler Works**:

The key insight is that Armoured Souls' combat system rewards consistency over specialization in many scenarios. While specialists can dominate their ideal matchups, they struggle in bad matchups. Balanced Brawler never has a bad matchup - you're always competitive.

Additionally, the learning curve for Balanced Brawler is the gentlest of any archetype:
- No complex positioning requirements (Speed Demon)
- No high-risk economic management (Glass Cannon)
- No passive defensive gameplay (Tank Fortress)
- Just straightforward combat with balanced tools

This makes it the ideal "training wheels" archetype that teaches you the game without punishing mistakes harshly.

**Common Misconceptions**:

- "Balanced builds are boring": Subjective, but many players find the versatility engaging.
- "You need to specialize to win": False. Balanced builds maintain 50%+ win rates easily.
- "Balanced means mediocre": False. Balanced means "no weaknesses," which is powerful.
- "You'll need to rebuild later": False. You can gradually shift focus without starting over.
- "Specialists always beat generalists": False. Generalists beat specialists in bad matchups.

**The Perfect Starting Point**:

Balanced Brawler is often called the "tutorial archetype" because it teaches you everything:

**What You'll Learn**:
- How offense works (Combat Power, Weapon Control, Penetration)
- How defense works (Hull Integrity, Armor Plating, Damage Control)
- How mobility works (Attack Speed, Servo Motors, Reaction Time)
- How to manage economy (income, repairs, facilities)
- How to adapt tactics to different opponents
- How to progress through leagues safely
- How to make strategic decisions without pressure

**After 30-60 Days**:

Once you've learned the game with Balanced Brawler, you can:
1. **Stay Balanced**: Continue with this safe, reliable archetype
2. **Specialize Gradually**: Shift attribute focus toward offense, defense, or mobility
3. **Pivot to New Archetype**: Use your knowledge to choose a specialized archetype
4. **Experiment**: Try different weapons and tactics with your safety net intact

The beauty of Balanced Brawler is that it's not a "dead end" - it's a foundation you can build on in any direction.

**Quick Summary**:

Balanced Brawler is the most forgiving, beginner-friendly archetype in Armoured Souls. If you're new to the game, want to learn safely without bankruptcy pressure, or prefer versatility over specialization, this is your archetype. You'll progress steadily through leagues with consistent performance, build a strong economic foundation, and develop well-rounded skills applicable to any future strategy. This is the "you can't go wrong" choice - safe, reliable, and perfect for learning. Highly recommended for all new players.

---

### Facility Investor

**Philosophy**: Invest heavily in infrastructure for long-term passive income and cost reduction. The Facility Investor archetype is built on the principle that the best investments compound over time - by prioritizing facilities that provide discounts, passive income, and operational efficiency, you create a self-reinforcing economic engine that grows stronger with every battle, every upgrade, and every day. This is the "economic simulation" archetype for players who enjoy building systems rather than just winning battles.

**Robot Build Style**: Moderate balanced build sufficient for Bronze/Silver leagues. Your robot doesn't need to be exceptional because your strategy isn't about dominating combat - it's about building sustainable infrastructure. You invest enough in your robot to maintain 45-50% win rate in early leagues, which is sufficient to generate income while your facilities compound their benefits. Think of your robot as the "minimum viable product" that funds your real investment: your stable's infrastructure.

**Loadout Type**: Single (Practice Sword, Machine Gun, or budget weapon)

The Single loadout with budget weapons is the most cost-efficient option for Facility Investor. You're not trying to win through superior firepower - you're trying to win through superior economics. A Practice Sword (₡50,000) or Machine Gun (₡150,000) provides adequate combat capability while preserving maximum budget for facility investments. You can always upgrade to premium weapons later once your facilities are generating returns.

**Attribute Focus**: 

Priority attributes for Facility Investor builds (minimal but balanced):

1. **Combat Power** (Combat) - Invest enough to threaten opponents (Level 4-6), but don't over-invest.
2. **Hull Integrity** (Defense) - Invest enough to survive battles (Level 4-6), keeping repair costs manageable.
3. **Attack Speed** (Mobility) - Invest enough to keep pace (Level 3-5), but mobility isn't your focus.
4. **Armor Plating** (Defense) - Secondary defense to reduce repair costs (Level 3-5).
5. **Weapon Control** (Combat) - Secondary offense for accuracy (Level 3-5).

**The Minimal Investment Philosophy**:

Unlike other archetypes that invest 60-70% of starting budget into robots and weapons, Facility Investor invests only 30-45%:
- 30% Robot attributes (minimal but functional)
- 15% Weapons (budget options only)
- 50% Facilities (the core investment)
- 5% Reserve buffer

This creates a robot that's "good enough" to compete in Bronze/Silver while directing maximum resources toward infrastructure that will pay dividends for months to come.

**League Scaling and Risk Profile**:

- **Bronze League**: Low risk. With income at ₡5-10K per win and low repair costs (₡8-12K per loss due to moderate defense), you need roughly 48-50% win rate to stay profitable. Your facilities' operating costs (₡15-25K/week) are covered by battle income, and your passive income from Income Generator (if purchased) provides additional cushion. Facility Investor is very safe in Bronze because your sustainable economics protect you from bankruptcy.

- **Silver League**: Very low risk. Income doubles to ₡10-20K per win while repair costs remain stable at ₡8-12K per loss. Your facility benefits start compounding - Training Facility discounts save more as you upgrade higher levels, Repair Bay discounts save more as you battle more frequently, and Income Generator passive income scales with prestige. At 50% win rate, you're highly profitable and your infrastructure investments begin paying for themselves.

- **Gold League and Beyond**: Extremely low risk. With income at ₡20-40K per win and repair costs still ₡8-12K per loss, Facility Investor becomes one of the most profitable archetypes in the game. Your facility benefits have compounded significantly - you're saving 10-25% on all upgrades, repairs, and purchases, while passive income provides substantial daily credits. The gap between your income and costs widens dramatically, creating massive profit margins.

**Excellent Scaling - Facility Benefits Compound Over Time**:

Facility Investor is characterized by exponential growth rather than linear growth:

**Why Compounding?**
- Training Facility saves 5% on all future attribute upgrades - the more you upgrade, the more you save
- Repair Bay saves 5% on all future repairs - the more you battle, the more you save
- Income Generator provides daily passive income that scales with prestige - the higher your prestige, the more you earn
- Weapons Workshop saves 5% on all future weapon purchases - the more weapons you buy, the more you save
- These benefits stack and multiply over time, creating exponential returns

**The Compounding Timeline**:

**Weeks 1-4 (Bronze)**: Slow start, facilities cost more than they save
- Training Facility: Costs ₡10,500/week, saves ~₡2,000/week (negative ROI)
- Repair Bay: Costs ₡7,000/week, saves ~₡600/week (negative ROI)
- Income Generator: Costs ₡5,600/week, generates ~₡3,500/week (negative ROI)
- **Net Effect**: Losing ₡15,000-₡20,000/week to facility operating costs
- **Why It's OK**: Your battle income (₡30-40K/week at 50% win rate) covers the losses

**Weeks 5-12 (Silver)**: Break-even point, facilities start paying for themselves
- Training Facility: Costs ₡10,500/week, saves ~₡5,000/week (improving)
- Repair Bay: Costs ₡7,000/week, saves ~₡1,200/week (improving)
- Income Generator: Costs ₡5,600/week, generates ~₡7,000/week (positive ROI!)
- **Net Effect**: Breaking even or slightly positive on facility costs
- **Why It Matters**: Your infrastructure is now self-sustaining

**Weeks 13+ (Gold)**: Exponential returns, facilities generate massive value
- Training Facility: Costs ₡10,500/week, saves ~₡15,000/week (3× operating cost!)
- Repair Bay: Costs ₡7,000/week, saves ~₡3,000/week (improving)
- Income Generator: Costs ₡5,600/week, generates ~₡14,000/week (2.5× operating cost!)
- **Net Effect**: Generating ₡10,000-₡20,000/week in net facility value
- **Why It's Powerful**: Your facilities are now profit centers, not cost centers

**The Passive Income Growth Curve**:

Income Generator is the crown jewel of Facility Investor strategy:

**How Passive Income Scales**:
- Base income: ₡500/day at 0 prestige
- Prestige multiplier: +5% per 1,000 prestige
- At 5,000 prestige: ₡500 × 1.25 = ₡625/day (₡4,375/week)
- At 10,000 prestige: ₡500 × 1.50 = ₡750/day (₡5,250/week)
- At 20,000 prestige: ₡500 × 2.00 = ₡1,000/day (₡7,000/week)

**Timeline to Prestige Milestones**:
- 5,000 prestige: ~8-12 weeks (Bronze → Silver → Gold progression)
- 10,000 prestige: ~16-24 weeks (Gold → Platinum progression)
- 20,000 prestige: ~32-48 weeks (Platinum → Diamond progression)

**Why This Matters**: Your passive income grows automatically as you play, requiring no additional investment. By month 3-4, your Income Generator is generating ₡5,000-₡7,000/week, covering its own operating costs (₡5,600/week) and providing net profit. By month 6-8, it's generating ₡7,000-₡10,000/week, becoming a significant income stream that requires zero effort.

**Personality Fit**: 

Facility Investor is ideal for players who:
- Enjoy economic simulation and long-term planning
- Prefer building systems over immediate combat dominance
- Find satisfaction in watching passive income grow over time
- Value sustainability and compound growth over quick wins
- Appreciate the "delayed gratification" of infrastructure investments
- Enjoy spreadsheet optimization and ROI calculations
- Want to play the "long game" rather than sprint to victory
- Like the fantasy of building a stable empire rather than just a combat robot
- Prefer strategic depth over tactical combat complexity
- Want a low-stress archetype that becomes progressively easier over time

**Recommended For**:
- Players who enjoy economic strategy games (city builders, tycoon games)
- Those who prefer passive income and automation
- Long-term thinkers who plan months ahead
- Players who want the safest possible long-term strategy
- Anyone who finds combat secondary to stable management

**Not Recommended For**:
- Players who want immediate combat power
- Those who find economic management boring
- Players who want to dominate early leagues
- Anyone who dislikes slow starts
- Players who prefer tactical combat over strategic planning

**Strategic Focus**:

The Facility Investor strategy revolves around long-term economic optimization:

1. **Infrastructure First**: Your goal is to build facilities that will pay dividends for months, not to win battles today.
2. **Sustainable Economics**: Maintain 45-50% win rate with minimal robot investment, focusing on economic sustainability over combat dominance.
3. **Compound Growth**: Leverage facility benefits that multiply over time - every upgrade saves more, every battle generates more passive income.
4. **Patience**: Accept that weeks 1-4 will be slow while your facilities establish themselves. The payoff comes in weeks 8-16 when your infrastructure starts generating exponential returns.
5. **Passive Income Maximization**: Prioritize Income Generator and prestige accumulation to grow your passive income stream.
6. **Cost Reduction**: Use Training Facility, Repair Bay, and Weapons Workshop to reduce all future costs by 5-25%, creating permanent efficiency gains.

**Long-Term Economic Strategy and Passive Income**:

The core of Facility Investor is building an economic engine that runs itself:

**Phase 1: Foundation (Weeks 1-4)**
- Purchase Income Generator - your primary investment (see [STABLE_SYSTEM.md](docs/prd_core/STABLE_SYSTEM.md) for pricing)
- Purchase Training Facility - saves on all future upgrades
- Purchase Repair Bay - saves on all future repairs
- Accept negative ROI in the short term - you're building for the future
- Maintain 45-50% win rate with minimal robot to fund operations

**Phase 2: Break-Even (Weeks 5-12)**
- Facilities start paying for themselves as you upgrade more, battle more, and earn prestige
- Income Generator passive income grows from ₡3,500/week to ₡5,000/week
- Training Facility savings grow from ₡2,000/week to ₡5,000/week
- Repair Bay savings grow from ₡600/week to ₡1,500/week
- Your infrastructure becomes self-sustaining

**Phase 3: Exponential Returns (Weeks 13+)**
- Facilities generate net positive value of ₡10,000-₡20,000/week
- Income Generator provides ₡7,000-₡14,000/week in passive income
- Training Facility saves ₡10,000-₡20,000/week on high-level upgrades
- Repair Bay saves ₡3,000-₡5,000/week on frequent battles
- Your robot upgrades accelerate as savings compound
- You can afford to expand to multiple robots, premium weapons, or additional facilities

**The Economic Engine**:

By week 16-20, a typical Facility Investor has:
- **Battle Income**: ₡100,000-₡150,000/week (Gold league, 7 battles, 50% win rate)
- **Passive Income**: ₡7,000-₡10,000/week (Income Generator with prestige scaling)
- **Facility Savings**: ₡15,000-₡25,000/week (Training Facility + Repair Bay + Weapons Workshop)
- **Total Economic Value**: ₡122,000-₡185,000/week
- **Operating Costs**: ₡30,000-₡40,000/week (repairs + facility costs)
- **Net Profit**: ₡82,000-₡145,000/week

Compare this to a Glass Cannon at the same point:
- **Battle Income**: ₡120,000-₡160,000/week (Gold league, 7 battles, 55% win rate)
- **Passive Income**: ₡0/week (no Income Generator)
- **Facility Savings**: ₡0/week (no discount facilities)
- **Total Economic Value**: ₡120,000-₡160,000/week
- **Operating Costs**: ₡40,000-₡60,000/week (high repairs, minimal facility costs)
- **Net Profit**: ₡80,000-₡120,000/week

Facility Investor matches or exceeds Glass Cannon's profitability by week 16-20, despite having a weaker robot and lower win rate. The difference is the economic engine you've built.

**Why Facility Investor Works**:

The key insight is that Armoured Souls' economy rewards long-term thinking. While other archetypes optimize for immediate combat power, Facility Investor optimizes for permanent efficiency gains:

1. **Discounts Are Permanent**: Training Facility's 5% discount applies to every upgrade forever. Over 6 months, you might spend ₡2,000,000 on upgrades, saving ₡100,000 from a ₡300,000 facility investment.

2. **Passive Income Requires No Effort**: Income Generator generates credits while you sleep, work, or take breaks. It's the only income source that doesn't require winning battles.

3. **Compound Growth Is Exponential**: Each facility benefit multiplies with every other benefit. Training Facility saves money on upgrades, which makes your robot stronger, which increases win rate, which generates more prestige, which increases passive income, which funds more upgrades, which saves more money via Training Facility. It's a virtuous cycle.

4. **Risk Decreases Over Time**: Unlike Glass Cannon (high risk early, medium risk late) or Speed Demon (medium risk always), Facility Investor starts low risk and becomes progressively safer. By week 12-16, bankruptcy is virtually impossible.

5. **Flexibility Increases**: Your economic engine provides flexibility to experiment with different robots, weapons, and strategies without risking your core infrastructure. You can afford to make mistakes because your facilities keep generating value.

**Common Misconceptions**:

- "Facility Investor is weak in combat": Partially true early, false later. By week 12-16, your savings fund rapid robot upgrades that catch you up to specialists.
- "Facilities never pay for themselves": False. They pay for themselves by week 8-12 and generate exponential returns afterward.
- "Passive income is negligible": False. By month 3-4, passive income is ₡5,000-₡7,000/week, equivalent to 1-2 battle wins.
- "You'll fall behind in leagues": False. 45-50% win rate is sufficient to advance steadily through Bronze → Silver → Gold.
- "This is boring": Subjective, but many players find economic optimization deeply satisfying.

**The Delayed Gratification Archetype**:

Facility Investor is often called the "delayed gratification" archetype because it requires patience:

**Weeks 1-4**: You'll feel weak compared to combat-focused archetypes. Your robot is adequate but not impressive. Your facilities are costing more than they're saving. You're playing the long game while others are dominating battles.

**Weeks 5-8**: You'll start seeing returns. Your passive income is growing. Your facility discounts are saving noticeable amounts. Your robot is catching up as savings fund upgrades.

**Weeks 9-12**: You'll reach parity. Your economic engine is self-sustaining. Your robot is competitive with specialists. Your profit margins are healthy.

**Weeks 13+**: You'll pull ahead. Your compound growth accelerates. Your facilities generate massive value. Your robot upgrades rapidly. Your economic advantage becomes overwhelming.

The question is: Can you be patient for 8-12 weeks while your infrastructure establishes itself? If yes, Facility Investor rewards you with the strongest long-term economy in the game.

**Quick Summary**:

Facility Investor is the long-term economic optimization archetype in Armoured Souls. If you enjoy building systems, appreciate compound growth, value passive income, and have the patience for delayed gratification, this is your archetype. You'll start slow with a moderate robot and heavy facility investments, but by week 12-16, your economic engine will generate exponential returns that surpass combat-focused archetypes. This is the "play the long game" choice - safe, sustainable, and incredibly rewarding for players who think months ahead rather than battles ahead. Perfect for economic strategy enthusiasts and long-term planners.

---

### Two-Robot Specialist

**Philosophy**: Two specialized robots for different matchups and redundancy. The Two-Robot Specialist archetype is built on the principle that versatility and strategic depth come from having multiple tools for different situations - by maintaining two robots with complementary builds, you can select the optimal robot for each opponent, adapt to different combat scenarios, and maintain operational continuity if one robot needs extensive repairs. This is the "portfolio management" archetype for players who enjoy strategic matchup selection and tactical flexibility.

**Robot Build Style**: Two complementary robots with contrasting specializations. The classic pairing is Tank (defensive) + Glass Cannon (offensive), but other combinations work equally well: Speed Demon + Ranged Sniper, Balanced Brawler + Melee Specialist, or any pairing that covers different tactical niches. The key is that your robots should excel in different areas, giving you options for different opponents and situations.

**Loadout Type**: Varied - each robot has its own loadout optimized for its role

Unlike single-robot archetypes that commit to one loadout type, Two-Robot Specialist embraces diversity:
- **Robot 1 (Defensive)**: Weapon+Shield (Combat Shield + Power Sword) for survivability and counter-attacks
- **Robot 2 (Offensive)**: Two-Handed (Plasma Cannon or Heavy Hammer) for maximum damage output

This combination gives you tactical flexibility: deploy your Tank against aggressive opponents who you need to outlast, or deploy your Glass Cannon against defensive opponents who you need to overwhelm quickly. You're never locked into a single strategy.

**Attribute Focus**: 

Priority attributes vary by robot, but the general philosophy is specialization over balance:

**Robot 1 (Tank Build)** - Defensive specialist:
1. **Hull Integrity** (Defense) - Maximum survivability
2. **Armor Plating** (Defense) - Damage reduction
3. **Shield Capacity** (Defense) - Shield durability
4. **Counter Protocols** (Defense) - Defensive offense
5. **Combat Power** (Combat) - Adequate damage output

**Robot 2 (Glass Cannon Build)** - Offensive specialist:
1. **Combat Power** (Combat) - Maximum damage output
2. **Critical Systems** (Combat) - Burst damage potential
3. **Penetration** (Combat) - Armor bypass
4. **Weapon Control** (Combat) - Accuracy and effectiveness
5. **Targeting Systems** (Combat) - Precision strikes

**The Specialization Philosophy**:

Unlike Balanced Brawler (which spreads attributes evenly across one robot), Two-Robot Specialist concentrates attributes into specialized roles across two robots. Each robot is excellent at one thing rather than adequate at everything. This creates:
- **Clearer Strengths**: Each robot dominates in its specialty
- **Tactical Depth**: Matchup selection becomes a strategic layer
- **Risk Management**: If one robot is damaged, you have a backup
- **Learning Opportunities**: Experience different playstyles without committing to one

**Roster Expansion Requirement and Complementary Builds**:

**CRITICAL REQUIREMENT**: You MUST purchase Roster Expansion facility to own more than 1 robot.

**Roster Expansion Details**:
- **Purchase Cost**: ₡300,000 (Level 1 allows 2 robots)
- **Operating Cost**: ₡500/day per additional robot slot (₡3,500/week for 2nd robot)
- **Hard Requirement**: You cannot purchase a 2nd robot without Roster Expansion
- **Budget Impact**: This ₡300,000 facility cost is non-negotiable for Two-Robot Specialist

**Why This Matters**:

Roster Expansion is unique among facilities because it's not about ROI or efficiency - it's a hard gate. You either pay ₡300,000 or you cannot execute this archetype. This makes Two-Robot Specialist more expensive than single-robot archetypes, as you're paying:
- ₡500,000 for Robot 1
- ₡500,000 for Robot 2
- ₡300,000 for Roster Expansion (required)
- ₡3,500/week ongoing operating costs

That's ₡1,300,000 (43% of starting budget) just for the robots and facility before any attribute upgrades or weapons. This is why Two-Robot Specialist requires careful budget management.

**Complementary Builds Strategy**:

The power of Two-Robot Specialist comes from having robots that cover each other's weaknesses:

**Classic Pairing: Tank + Glass Cannon**
- **Tank**: Excels against aggressive opponents, high-damage builds, and risky matchups. Low repair costs, high survivability, wins through attrition.
- **Glass Cannon**: Excels against defensive opponents, slow builds, and favorable matchups. High damage output, quick victories, wins through overwhelming offense.
- **Coverage**: Tank handles matchups where Glass Cannon would take too much damage. Glass Cannon handles matchups where Tank would take too long to win.

**Alternative Pairing: Speed Demon + Ranged Sniper**
- **Speed Demon**: Excels in close-range brawls, against slow opponents, and in mobility-focused matchups. High attack rate, positioning control.
- **Ranged Sniper**: Excels at long range, against melee specialists, and in precision-focused matchups. High accuracy, armor penetration.
- **Coverage**: Speed Demon handles opponents who struggle with mobility. Ranged Sniper handles opponents who excel at close range.

**Alternative Pairing: Balanced Brawler + Melee Specialist**
- **Balanced Brawler**: Your "safe" option for unknown matchups, learning opponents, or when you're unsure which specialist to deploy.
- **Melee Specialist**: Your "counter-pick" for specific matchups where melee dominance is advantageous.
- **Coverage**: Balanced Brawler is your default. Melee Specialist is your situational power pick.

**The Matchup Selection Game**:

Two-Robot Specialist adds a strategic layer that single-robot archetypes don't have:

**Before Each Battle**:
1. **Scout Opponent** (if possible) - What's their build? Offensive? Defensive? Balanced?
2. **Assess Matchup** - Which of your robots has the advantage?
3. **Select Robot** - Deploy your optimal choice
4. **Execute Strategy** - Play to your selected robot's strengths

**Example Decision Tree**:
- Opponent is Glass Cannon (high offense, low defense) → Deploy your Tank (outlast them)
- Opponent is Tank Fortress (high defense, low offense) → Deploy your Glass Cannon (overwhelm them)
- Opponent is Balanced Brawler (moderate everything) → Deploy whichever robot you're more comfortable with
- Opponent is unknown → Deploy your safer robot (usually Tank) to minimize risk

**League Scaling and Risk Profile**:

- **Bronze League**: Medium risk. With income at ₡5-10K per win and moderate repair costs (₡10-16K per loss depending on which robot you use), you need roughly 52-55% win rate to stay profitable. The ₡3,500/week Roster Expansion operating cost adds pressure, but your ability to select optimal matchups helps maintain win rate. Two-Robot Specialist is more challenging than Tank Fortress but more forgiving than Glass Cannon in Bronze.

- **Silver League**: Low-medium risk. Income doubles to ₡10-20K per win while repair costs remain stable at ₡10-16K per loss. Your matchup selection advantage becomes more valuable as opponents get tougher - being able to counter-pick gives you a 5-10% win rate boost over single-robot archetypes. The Roster Expansion operating cost (₡3,500/week) is easily covered by increased income. At 50% win rate, you're comfortably profitable.

- **Gold League and Beyond**: Low risk. With income at ₡20-40K per win and repair costs still ₡10-16K per loss, Two-Robot Specialist becomes highly profitable. Your matchup selection advantage is most valuable in higher leagues where opponents are skilled and specialized - being able to deploy the right tool for each job gives you consistent edge. The operating costs (₡3,500/week) are negligible compared to income. Your versatility makes you one of the most adaptable archetypes in high-level play.

**Strong in Higher Leagues - Can Select Optimal Robot Per Opponent**:

Two-Robot Specialist's power scales with league tier because matchup selection becomes more valuable against better opponents:

**Why Matchup Selection Matters More in Higher Leagues**:

**Bronze League**: Opponents are often poorly optimized, using random builds or unbalanced attribute distributions. Your matchup advantage is modest (5-10% win rate boost) because you're often just "better" regardless of which robot you deploy.

**Silver League**: Opponents start specializing. You'll face dedicated Tanks, Glass Cannons, and Speed Demons. Your matchup advantage grows (10-15% win rate boost) because you can counter-pick: deploy Tank against Glass Cannon, deploy Glass Cannon against Tank, etc.

**Gold League and Beyond**: Opponents are highly optimized specialists. Matchups become rock-paper-scissors: Tank beats Glass Cannon, Glass Cannon beats Tank, Speed Demon beats Tank, etc. Your matchup advantage is significant (15-20% win rate boost) because you can always deploy the favorable matchup while single-robot archetypes are locked into their choice.

**The Matchup Advantage Calculation**:

Consider a single-robot Glass Cannon vs. a Two-Robot Specialist (Tank + Glass Cannon):

**Scenario 1: Opponent is Tank Fortress**
- Single-robot Glass Cannon: 60% win rate (offense beats defense)
- Two-Robot Specialist: Deploys Glass Cannon, 60% win rate
- **Advantage**: Neutral (both deploy Glass Cannon)

**Scenario 2: Opponent is Glass Cannon**
- Single-robot Glass Cannon: 50% win rate (mirror match, coin flip)
- Two-Robot Specialist: Deploys Tank, 60% win rate (defense beats offense)
- **Advantage**: +10% win rate for Two-Robot Specialist

**Scenario 3: Opponent is Balanced Brawler**
- Single-robot Glass Cannon: 55% win rate (specialist beats generalist)
- Two-Robot Specialist: Deploys Glass Cannon, 55% win rate
- **Advantage**: Neutral (both deploy Glass Cannon)

**Average Across All Matchups**:
- Single-robot Glass Cannon: ~55% win rate (good but fixed)
- Two-Robot Specialist: ~58% win rate (better due to counter-picking)
- **Net Advantage**: +3-5% win rate from matchup selection

This 3-5% win rate advantage compounds over hundreds of battles, translating to:
- More prestige earned (more wins)
- More income earned (more wins)
- Lower repair costs (deploy Tank in risky matchups)
- Faster league advancement (higher win rate)

**The Redundancy Advantage**:

Beyond matchup selection, Two-Robot Specialist has operational redundancy:

**Scenario: Robot 1 Takes Heavy Damage**
- Single-robot archetype: Must pay expensive repairs immediately or stop battling
- Two-Robot Specialist: Switch to Robot 2, continue battling while Robot 1 repairs

**Scenario: Experimenting with New Strategy**
- Single-robot archetype: Must commit fully or not at all
- Two-Robot Specialist: Experiment with Robot 2 while keeping Robot 1 as fallback

**Scenario: Learning New Playstyle**
- Single-robot archetype: Must respec attributes (expensive) or start over
- Two-Robot Specialist: Build Robot 2 differently, learn without risk

**Personality Fit**: 

Two-Robot Specialist is ideal for players who:
- Enjoy strategic depth and matchup selection
- Appreciate having options and tactical flexibility
- Like the idea of "portfolio management" - multiple assets for different situations
- Want to experience multiple playstyles without committing to one
- Value adaptability and versatility over specialization
- Enjoy the meta-game of scouting opponents and counter-picking
- Find satisfaction in "having the right tool for every job"
- Want operational redundancy and risk management
- Appreciate the strategic layer of robot selection before each battle
- Enjoy variety - playing different robots keeps gameplay fresh

**Recommended For**:
- Players who enjoy strategic games with matchup dynamics (fighting games, card games, MOBAs)
- Those who want to experience multiple archetypes simultaneously
- Strategic thinkers who enjoy pre-battle planning
- Players who value flexibility and adaptability
- Anyone who finds single-robot archetypes too limiting

**Not Recommended For**:
- Players who prefer mastering one playstyle deeply
- Those who find decision-making stressful (robot selection adds complexity)
- Budget-conscious players (Roster Expansion is expensive)
- Players who want the simplest possible strategy
- Anyone who dislikes managing multiple builds simultaneously

**Strategic Focus**:

The Two-Robot Specialist strategy revolves around matchup optimization and tactical flexibility:

1. **Complementary Specialization**: Build robots that cover different tactical niches - one defensive, one offensive; one melee, one ranged; one fast, one powerful.

2. **Matchup Selection**: Before each battle, assess the opponent and deploy your optimal robot. This is your primary advantage over single-robot archetypes.

3. **Risk Management**: Use your Tank for risky matchups (unknown opponents, dangerous builds) and your Glass Cannon for favorable matchups (defensive opponents, safe wins).

4. **Operational Continuity**: If one robot needs repairs, switch to the other. Never stop battling due to robot downtime.

5. **Learning and Adaptation**: Experience multiple playstyles simultaneously. Learn what works and what doesn't across different builds.

6. **Portfolio Optimization**: Over time, refine both robots based on what matchups you face most often. If you face many Tanks, invest more in your Glass Cannon. If you face many Glass Cannons, invest more in your Tank.

**The Robot Selection Decision Framework**:

Develop a systematic approach to robot selection:

**Step 1: Gather Information**
- What league is the opponent? (Higher leagues = more specialized builds)
- What's their stable name/reputation? (Known for aggressive play? Defensive play?)
- What's their robot's name? (Names often hint at build: "Iron Wall" = Tank, "Plasma Destroyer" = Glass Cannon)
- What's their prestige level? (Higher prestige = more experienced, likely optimized build)

**Step 2: Make Educated Guess**
- If signs point to offensive build → Deploy Tank
- If signs point to defensive build → Deploy Glass Cannon
- If signs point to balanced build → Deploy whichever robot you're more comfortable with
- If no information → Deploy Tank (safer default)

**Step 3: Learn and Adapt**
- After battle, note what opponent's build actually was
- If you guessed wrong, remember for next time
- If you guessed right, reinforce your decision-making pattern
- Over time, you'll develop intuition for matchup selection

**Step 4: Refine Strategy**
- Track which matchups you face most often
- Invest more in the robot that handles common matchups
- Consider adjusting builds if meta shifts (e.g., if everyone plays Glass Cannon, invest heavily in Tank)

**Why Two-Robot Specialist Works**:

The key insight is that Armoured Souls' combat system has matchup dynamics - certain builds counter other builds. Single-robot archetypes are locked into their matchup spread (good against some opponents, bad against others), while Two-Robot Specialist can actively select favorable matchups:

**The Matchup Matrix** (simplified):
- Tank beats Glass Cannon (60-40)
- Glass Cannon beats Tank (60-40)
- Speed Demon beats Tank (55-45)
- Tank beats Speed Demon (55-45)
- Balanced Brawler goes 50-50 against everyone

**Single-Robot Archetype**:
- Locked into one row of the matrix
- Must accept unfavorable matchups
- Average win rate: 50-55%

**Two-Robot Specialist**:
- Can select favorable row for each matchup
- Avoids unfavorable matchups by switching robots
- Average win rate: 53-58% (3-5% boost from selection)

This 3-5% win rate advantage compounds over time, generating:
- 10-20% more prestige over 6 months
- 10-20% more income over 6 months
- 10-20% faster league advancement
- Significantly more strategic depth and gameplay variety

**Common Misconceptions**:

- "Two robots means double the costs": Partially true. You have two robots, but you only battle with one at a time, so repair costs are similar to single-robot archetypes. The main extra cost is Roster Expansion operating cost (₡3,500/week), which is modest.

- "You need to upgrade both robots equally": False. You can prioritize one robot (usually Tank for safety) and upgrade the second robot gradually. Many Two-Robot Specialists run a "main" robot (80% of battles) and a "situational" robot (20% of battles).

- "Matchup selection is too complex": False. The decision tree is simple: "Is opponent offensive? Deploy Tank. Is opponent defensive? Deploy Glass Cannon. Unknown? Deploy Tank." You'll develop intuition quickly.

- "Two-Robot Specialist is twice as expensive": False. While you do spend ₡1,300,000 on robots + Roster Expansion (vs. ₡500,000 for single robot), you save money on weapons (only need 1 per robot initially) and can defer some attribute upgrades. Total starting budget is similar to other archetypes.

- "You'll fall behind specialists": False. Your matchup selection advantage gives you 3-5% higher win rate than specialists, which translates to faster progression, not slower.

**The Variety Advantage**:

Beyond strategic benefits, Two-Robot Specialist offers psychological benefits:

**Gameplay Variety**: Playing the same robot for hundreds of battles can become monotonous. Two-Robot Specialist keeps gameplay fresh by alternating between different playstyles. One battle you're a defensive Tank, next battle you're an aggressive Glass Cannon. This variety maintains engagement and prevents burnout.

**Learning Acceleration**: By experiencing multiple playstyles simultaneously, you learn game mechanics faster. You understand both offensive and defensive strategies, both aggressive and conservative tactics. This makes you a better player overall.

**Experimentation Safety**: Want to try a new build or strategy? Use Robot 2 as your experimental platform while keeping Robot 1 as your reliable fallback. This enables risk-free experimentation that single-robot archetypes can't afford.

**Quick Summary**:

Two-Robot Specialist is the versatility and matchup selection archetype in Armoured Souls. If you enjoy strategic depth, appreciate having options, value adaptability, and want to experience multiple playstyles simultaneously, this is your archetype. You'll invest in Roster Expansion (₡300,000 required) and maintain two complementary robots (typically Tank + Glass Cannon), giving you the ability to counter-pick opponents and select optimal matchups. This 3-5% win rate advantage from matchup selection compounds over time, making you more profitable and faster-progressing than single-robot specialists. Strong in higher leagues where matchup dynamics matter most, Two-Robot Specialist rewards strategic thinking and tactical flexibility. Perfect for players who want the right tool for every job and enjoy the meta-game of robot selection. Medium risk in Bronze, low risk in Gold+, with excellent scaling as you advance leagues.

---

### Melee Specialist

**Philosophy**: Dominate close combat with devastating melee strikes. The Melee Specialist archetype is built on the principle that raw physical power and positioning mastery can overwhelm opponents through crushing melee attacks - by maximizing Hydraulic Systems and melee weapon effectiveness, you deliver bone-crushing strikes that end battles through sheer impact force rather than speed or precision. This is the "heavy hitter" archetype for players who enjoy the visceral satisfaction of powerful melee combat.

**Robot Build Style**: Melee powerhouse focused on Hydraulic Systems and close-range dominance. Your robot is designed to close distance quickly and deliver devastating melee strikes that can cripple opponents in a few hits. Think of it as a mechanical brawler that excels when fists (or hammers, or axes) meet metal.

**Loadout Type**: Two-Handed melee (Heavy Hammer, Battle Axe) or Weapon+Shield (Power Sword + Combat Shield)

Melee Specialist has two viable loadout approaches:

**Option 1: Two-Handed Melee** (Heavy Hammer ₡400,000 or Battle Axe ₡350,000)
- Provides +20% damage bonus from Two-Handed loadout
- Maximizes single-strike impact damage
- Best for aggressive, offensive melee play
- Higher risk (no shield) but higher damage output
- Synergizes with Glass Cannon philosophy applied to melee

**Option 2: Weapon+Shield** (Power Sword ₡250,000 + Combat Shield ₡200,000)
- Provides +10% defense bonus from Weapon+Shield loadout
- Balances offense with survivability
- Best for tactical, positioning-focused melee play
- Lower risk (shield protection) but moderate damage output
- Synergizes with Tank Fortress philosophy applied to melee

Both loadouts focus on melee weapons, but the choice depends on your risk tolerance: Two-Handed for maximum damage, Weapon+Shield for balanced survivability.

**Attribute Focus**: 

Priority attributes for Melee Specialist builds:

**Core Melee Attributes** (Essential for all Melee Specialists):
1. **Hydraulic Systems** (Combat) - Your primary stat. Directly increases melee weapon damage. Every point makes your hammer swings, sword strikes, and axe chops more devastating.
2. **Combat Power** (Combat) - Your secondary damage stat. Works alongside Hydraulic Systems to maximize melee impact.
3. **Servo Motors** (Mobility) - Critical for closing distance to melee range. You can't hit what you can't reach.
4. **Hull Integrity** (Defense) - Essential survivability. Melee combat means taking hits while closing distance.

**Two-Handed Melee Build** (Offensive Focus):
5. **Critical Systems** (Combat) - Increases critical hit chance for devastating spike damage
6. **Weapon Control** (Combat) - Improves melee accuracy and effectiveness
7. **Penetration** (Combat) - Bypasses armor to ensure your heavy hits reach the hull

**Weapon+Shield Build** (Defensive Focus):
5. **Shield Capacity** (Defense) - Increases shield durability for closing distance safely
6. **Armor Plating** (Defense) - Reduces incoming damage while approaching
7. **Counter Protocols** (Defense) - Punishes opponents who attack you during approach

**The Hydraulic Systems Focus**:

Hydraulic Systems is the defining attribute of Melee Specialist. While other combat attributes (Combat Power, Critical Systems, Penetration) affect all weapons, Hydraulic Systems specifically boosts melee weapon damage:

**How Hydraulic Systems Works**:
- Increases force delivered by melee strikes
- Affects all melee weapons: swords, hammers, axes, blades
- Stacks multiplicatively with Combat Power for maximum melee damage
- Does NOT affect ranged weapons (guns, cannons, rifles)

**Why Hydraulic Systems Matters**:
- A robot with 200 Combat Power + 150 Hydraulic Systems will deal MORE melee damage than a robot with 250 Combat Power + 100 Hydraulic Systems
- Hydraulic Systems is the "melee specialist" stat - it's only valuable if you commit to melee weapons
- Investing heavily in Hydraulic Systems signals your commitment to close-range combat

**The Synergy**:
- Hydraulic Systems × Combat Power = Base Melee Damage
- Critical Systems adds spike damage potential
- Penetration ensures damage reaches the target
- Result: Devastating melee strikes that can end battles in 3-5 hits

**Positioning Gameplay**:

Melee Specialist's defining characteristic is positioning-dependent gameplay. Unlike ranged archetypes (Ranged Sniper, Glass Cannon with Plasma Cannon) that can attack from any distance, Melee Specialist must close to melee range to be effective:

**The Positioning Challenge**:

**Phase 1: The Approach** (Vulnerable)
- You start at range, opponent can attack freely
- You must close distance while taking damage
- Servo Motors and mobility attributes are critical
- Shield (if Weapon+Shield) or high Hull Integrity (if Two-Handed) keeps you alive

**Phase 2: Melee Range** (Dominant)
- You've closed distance, now you're in your element
- Your Hydraulic Systems-boosted melee attacks devastate opponents
- Opponent must either tank your damage or try to create distance
- You control the fight through superior melee power

**Phase 3: Maintaining Position** (Tactical)
- Opponent may try to create distance or disengage
- You must maintain melee range using Servo Motors
- Positioning becomes a dance: you close, they retreat, you close again
- Victory comes from keeping opponent in melee range long enough to land killing blows

**Why Positioning Matters**:

Melee Specialist has the highest damage potential at melee range but is vulnerable during approach:

**Best Case Scenario**: You close distance quickly (high Servo Motors), take minimal damage during approach (high Hull Integrity or Shield Capacity), and deliver devastating melee strikes (high Hydraulic Systems + Combat Power). Battle ends in 3-5 hits. You win decisively.

**Worst Case Scenario**: Opponent has high mobility (Speed Demon) or long-range damage (Ranged Sniper), you struggle to close distance, take heavy damage during approach, and arrive at melee range already weakened. Even if your melee damage is high, you've lost too much HP. You lose.

**The Positioning Skill Ceiling**:

Melee Specialist has a higher skill ceiling than ranged archetypes because positioning is a skill:
- **Novice Players**: Struggle to close distance, take excessive damage during approach, lose to ranged opponents
- **Intermediate Players**: Learn to use Servo Motors effectively, close distance reliably, win against stationary opponents
- **Advanced Players**: Master positioning, predict opponent movement, control engagement distance, win against mobile opponents

This makes Melee Specialist rewarding for players who enjoy mastering positioning mechanics and tactical gameplay.

**League Scaling and Risk Profile**:

- **Bronze League**: Medium-high risk. With income at ₡5-10K per win and moderate-to-high repair costs (₡14-20K per loss depending on loadout choice), you need roughly 54-58% win rate to stay profitable. The positioning challenge is most punishing in Bronze where you're still learning optimal approach patterns. Two-Handed Melee has higher risk (₡18-20K repairs) than Weapon+Shield (₡14-16K repairs). Melee Specialist requires above-average skill to stay profitable in Bronze.

- **Silver League**: Medium risk. Income doubles to ₡10-20K per win while repair costs remain stable at ₡14-20K per loss. Your positioning skills improve with experience, helping maintain win rate. At 52-55% win rate, you're profitable. The pressure eases as you master the approach phase and learn which opponents to engage aggressively vs. cautiously.

- **Gold League and Beyond**: Low-medium risk. With income at ₡20-40K per win and repair costs still ₡14-20K per loss, Melee Specialist becomes profitable at 50% win rate. Your mastery of positioning and melee combat makes you dangerous in higher leagues where tactical skill matters more than raw stats.

**Improves in Higher Leagues - Better Opponents Mean More Tactical Positioning Opportunities**:

Melee Specialist has an unusual scaling pattern: it gets BETTER in higher leagues, not just more profitable. Here's why:

**Bronze League Opponents**:
- Often poorly optimized builds with random attribute distributions
- May not understand positioning or movement mechanics
- Stand still and trade blows, making positioning less important
- Your positioning skill advantage is modest because opponents don't exploit your weaknesses

**Silver League Opponents**:
- Start understanding basic positioning and movement
- May try to kite (maintain distance) or disengage from melee
- Your positioning skill becomes more valuable as opponents become more mobile
- Tactical depth increases: you must predict movement, cut off escape routes, force engagements

**Gold League and Beyond Opponents**:
- Highly skilled at positioning and movement
- Will actively try to counter your melee approach (kiting, disengaging, maintaining range)
- Your positioning mastery becomes your primary advantage
- Tactical gameplay reaches peak depth: positioning mind-games, feints, movement prediction

**Why This Matters**:

In Bronze, Melee Specialist is "just another damage build" - opponents don't exploit your positioning weakness, so you win through raw stats. In Gold, Melee Specialist becomes a "positioning specialist" - opponents try to counter your approach, but your superior positioning skill lets you close distance anyway and deliver devastating melee strikes.

**The Skill Scaling**:
- Bronze: Win through stats (Hydraulic Systems + Combat Power)
- Silver: Win through basic positioning (closing distance reliably)
- Gold: Win through advanced positioning (predicting movement, controlling space, forcing engagements)
- Platinum+: Win through positioning mastery (mind-games, feints, perfect distance control)

This makes Melee Specialist one of the most skill-expressive archetypes in the game. Your win rate in higher leagues depends more on your positioning skill than your attribute levels, rewarding mastery and tactical thinking.

**Personality Fit**: 

Melee Specialist is ideal for players who:
- Enjoy melee combat and close-range brawling
- Appreciate positioning gameplay and tactical movement
- Find satisfaction in landing devastating, high-impact strikes
- Want a skill-expressive archetype that rewards mastery
- Enjoy the fantasy of a mechanical brawler crushing opponents with raw power
- Appreciate the risk-reward of closing distance for maximum damage
- Like archetypes with high skill ceilings and room for improvement
- Find ranged combat boring or impersonal - prefer "getting your hands dirty"
- Enjoy the tactical depth of positioning mind-games
- Want an archetype that gets MORE fun as you improve at it

**Recommended For**:
- Players who enjoy melee combat in other games (fighting games, action games, brawlers)
- Those who appreciate positioning mechanics (MOBAs, tactical games)
- Skilled players who want an archetype that rewards mastery
- Anyone who finds satisfaction in crushing opponents with heavy melee strikes
- Players who enjoy the challenge of closing distance against ranged opponents

**Not Recommended For**:
- New players still learning game mechanics (positioning is complex)
- Players who prefer ranged combat or staying at distance
- Risk-averse players (Melee Specialist has medium-high risk in Bronze)
- Those who want the simplest possible strategy (positioning adds complexity)
- Players who dislike skill-dependent archetypes (prefer stat-based wins)
- Anyone frustrated by losing to kiting/mobile opponents

**Strategic Focus**:

The Melee Specialist strategy revolves around positioning mastery and devastating melee strikes:

1. **Master the Approach**: Learn to close distance efficiently while minimizing damage taken. Use Servo Motors to control movement, Hull Integrity or Shield Capacity to survive the approach.

2. **Maximize Melee Impact**: Invest heavily in Hydraulic Systems and Combat Power to ensure your melee strikes are devastating. Your goal is to end battles in 3-5 hits once you reach melee range.

3. **Control Engagement Distance**: Once at melee range, maintain position. Don't let opponents disengage or create distance. Use Servo Motors to stick to them like glue.

4. **Choose Loadout Based on Risk Tolerance**: Two-Handed Melee for maximum damage (higher risk), Weapon+Shield for balanced survivability (lower risk). Both are viable - choose based on your skill level and comfort with risk.

5. **Learn Matchups**: Some opponents are easy to close distance on (Tanks, slow builds), others are challenging (Speed Demons, Ranged Snipers). Learn which matchups favor you and which require extra caution.

6. **Improve Positioning Over Time**: Your win rate will increase as you master positioning mechanics. Bronze: 50-52% win rate. Silver: 52-55% win rate. Gold: 55-58% win rate. Your skill growth translates directly to win rate growth.

**Why Melee Specialist Works**:

The key insight is that Hydraulic Systems provides a damage multiplier specifically for melee weapons, creating a specialization advantage. A Melee Specialist with 200 Combat Power + 150 Hydraulic Systems will out-damage a generalist with 250 Combat Power + 100 Hydraulic Systems in melee combat, despite having lower total combat attributes.

Additionally, positioning skill creates a skill-based advantage that compounds over time. As you improve at closing distance and maintaining melee range, your win rate increases independent of attribute levels. This makes Melee Specialist one of the few archetypes where player skill matters as much as robot stats.

**The Melee Damage Formula** (simplified):
```
Melee Damage = (Combat Power × Hydraulic Systems Multiplier) × Weapon Base Damage × Critical Modifier
```

Where Hydraulic Systems Multiplier scales with attribute level:
- 100 Hydraulic Systems: 1.0× multiplier (baseline)
- 150 Hydraulic Systems: 1.5× multiplier
- 200 Hydraulic Systems: 2.0× multiplier

This means investing in Hydraulic Systems has exponential returns for melee damage, making specialization extremely powerful.

**Loadout Choice Deep Dive**:

**Two-Handed Melee** (Heavy Hammer ₡400,000 or Battle Axe ₡350,000):

**Pros**:
- +20% damage bonus from Two-Handed loadout
- Highest melee damage potential in the game
- Can end battles in 2-3 hits with high Hydraulic Systems
- Intimidating and satisfying gameplay (crushing opponents with massive hammer)
- Lower weapon cost if choosing Battle Axe (₡350K vs. ₡450K for Weapon+Shield combo)

**Cons**:
- No shield protection during approach phase
- Higher repair costs (₡18-20K per loss) due to damage taken during approach
- Higher risk in Bronze League (requires 56-58% win rate for profitability)
- More punishing against mobile/ranged opponents
- Requires better positioning skill to succeed

**Best For**: Aggressive players, skilled players, those who want maximum damage, players comfortable with high risk/high reward

**Weapon+Shield** (Power Sword ₡250,000 + Combat Shield ₡200,000):

**Pros**:
- +10% defense bonus from Weapon+Shield loadout
- Shield protects during approach phase, reducing damage taken
- Lower repair costs (₡14-16K per loss) due to shield protection
- Lower risk in Bronze League (requires 52-54% win rate for profitability)
- More forgiving against mobile/ranged opponents
- Easier to learn positioning mechanics with shield safety net

**Cons**:
- Lower melee damage than Two-Handed (only +10% defense vs. +20% damage)
- Battles take longer (4-5 hits to win vs. 2-3 hits)
- Higher weapon cost (₡450K total vs. ₡350-400K for Two-Handed)
- Less satisfying one-shot potential

**Best For**: Cautious players, learning players, those who want balanced risk/reward, players new to positioning mechanics

**Recommendation**: 
- **First-time Melee Specialists**: Start with Weapon+Shield to learn positioning mechanics safely
- **Experienced Players**: Choose Two-Handed for maximum damage and faster battles
- **Risk-Averse Players**: Weapon+Shield provides better economic sustainability
- **Thrill-Seekers**: Two-Handed provides more exciting, high-stakes gameplay

**Common Misconceptions**:

- "Melee is always worse than ranged": False. Melee has higher damage potential due to Hydraulic Systems specialization. The challenge is closing distance, not damage output.

- "Positioning is too hard to master": False. Basic positioning (closing distance reliably) is learnable in 10-20 battles. Advanced positioning (mind-games, feints) takes longer but isn't required for success.

- "Melee Specialist loses to Speed Demon": Partially true. Speed Demon is a challenging matchup, but not unwinnable. Your higher melee damage can overcome their mobility if you land hits.

- "You need perfect positioning to win": False. You need adequate positioning. Even if you take damage during approach, your devastating melee strikes can still win the battle.

- "Melee Specialist is just Glass Cannon with melee weapons": False. Melee Specialist focuses on Hydraulic Systems (melee-specific) and positioning skill, while Glass Cannon focuses on raw Combat Power and quick eliminations. Different philosophies and playstyles.

- "Weapon+Shield is always better than Two-Handed": False. Both are viable. Two-Handed has higher damage and faster battles, Weapon+Shield has better survivability and lower risk. Choose based on your preferences.

**The Positioning Learning Curve**:

Expect your performance to improve over time as you master positioning:

**Weeks 1-2 (Learning Phase)**:
- Win rate: 48-52% (struggling with positioning)
- Common mistakes: Taking too much damage during approach, failing to maintain melee range, poor movement prediction
- Focus: Learn basic distance closing, understand Servo Motors usage, identify easy vs. hard matchups

**Weeks 3-4 (Competent Phase)**:
- Win rate: 52-55% (reliable positioning)
- Improvements: Closing distance consistently, minimizing approach damage, maintaining melee range adequately
- Focus: Refine movement patterns, learn opponent behavior patterns, optimize approach routes

**Weeks 5-8 (Skilled Phase)**:
- Win rate: 55-58% (strong positioning)
- Mastery: Predicting opponent movement, controlling engagement distance, winning challenging matchups
- Focus: Advanced tactics (feints, baiting, space control), matchup-specific strategies

**Weeks 9+ (Expert Phase)**:
- Win rate: 58-60%+ (positioning mastery)
- Excellence: Positioning mind-games, perfect distance control, dominating even mobile opponents
- Focus: Optimization, consistency, adapting to meta shifts

This learning curve makes Melee Specialist rewarding long-term - you'll continuously improve and see your win rate increase as your positioning skill develops.

**Quick Summary**:

Melee Specialist is the positioning-focused, high-impact melee combat archetype in Armoured Souls. If you enjoy close-range brawling, appreciate positioning gameplay, want a skill-expressive archetype that rewards mastery, and find satisfaction in crushing opponents with devastating melee strikes, this is your archetype. You'll focus on Hydraulic Systems (melee damage multiplier) and Servo Motors (closing distance), choosing between Two-Handed melee (maximum damage, higher risk) or Weapon+Shield (balanced survivability, lower risk). Medium-high risk in Bronze (requires 54-58% win rate), medium risk in Silver, low-medium risk in Gold+. Improves in higher leagues as tactical positioning opportunities increase and your skill advantage becomes more valuable. Perfect for players who enjoy positioning mechanics, want an archetype with high skill ceiling, and appreciate the visceral satisfaction of mechanical brawler gameplay. Your win rate will increase over time as you master positioning, making this one of the most rewarding archetypes for dedicated players.

---

### Ranged Sniper

**Philosophy**: Win through superior accuracy and armor penetration from range. The Ranged Sniper archetype is built on the principle that precision beats power - by maximizing Targeting Systems and penetration attributes, you deliver calculated, devastating strikes from long range that bypass enemy defenses and eliminate opponents before they can close distance. This is the "marksman" archetype for players who enjoy precision gameplay and tactical positioning.

**Robot Build Style**: Precision ranged attacker focused on Targeting Systems and accuracy. Your robot is designed to deliver pinpoint strikes from maximum range, using superior accuracy to land critical hits on weak points while maintaining safe distance from melee threats. Think of it as a mechanical sniper that excels at calculated, long-range elimination.

**Loadout Type**: Two-Handed ranged (Railgun, Sniper Rifle, Plasma Cannon)

The Two-Handed loadout provides +20% damage bonus and enables the most powerful ranged weapons in the game. These weapons require both hands but deliver devastating long-range strikes with superior accuracy and penetration. This loadout excels at maintaining maximum engagement distance while dealing lethal damage.

**Ranged Weapon Options**:
- **Railgun** (₡450,000) - Highest penetration, bypasses armor completely, best against heavily armored opponents
- **Sniper Rifle** (₡400,000) - Highest accuracy, critical hit focused, best for precision strikes on weak points
- **Plasma Cannon** (₡500,000) - Highest raw damage, area effect potential, best for overwhelming firepower

All three weapons synergize with Targeting Systems and benefit from the Two-Handed damage bonus, making them excellent choices for Ranged Sniper builds.

**Attribute Focus**: 

Priority attributes for Ranged Sniper builds:

**Core Precision Attributes** (Essential for all Ranged Snipers):
1. **Targeting Systems** (Combat) - Your primary stat. Directly increases ranged weapon accuracy and effectiveness. Every point makes your shots more likely to hit and more likely to hit critical locations.
2. **Penetration** (Combat) - Your secondary damage stat. Bypasses enemy armor, ensuring your precision strikes reach the hull regardless of opponent's Armor Plating.
3. **Critical Systems** (Combat) - Increases critical hit chance and damage. Combined with high accuracy, this creates devastating spike damage potential.
4. **Weapon Control** (Combat) - Improves overall weapon effectiveness and handling, critical for maximizing ranged weapon performance.

**Supporting Attributes**:
5. **Combat Power** (Combat) - Increases base damage output. While not your primary focus, you still need decent damage per hit.
6. **Sensor Suite** (Mobility) - Improves target acquisition and tracking, helping you maintain accuracy against moving targets.
7. **Hull Integrity** (Defense) - Minimal investment for basic survivability if opponents close distance.

**The Targeting Systems Focus**:

Targeting Systems is the defining attribute of Ranged Sniper. While other combat attributes affect all weapons, Targeting Systems specifically boosts ranged weapon accuracy and effectiveness:

**How Targeting Systems Works**:
- Increases accuracy for all ranged weapons (guns, cannons, rifles)
- Improves critical hit location targeting (hitting weak points)
- Enhances long-range effectiveness (maintaining accuracy at maximum distance)
- Does NOT affect melee weapons (swords, hammers, axes, blades)

**Why Targeting Systems Matters**:
- A robot with 200 Combat Power + 150 Targeting Systems will deal MORE effective ranged damage than a robot with 250 Combat Power + 100 Targeting Systems
- Targeting Systems is the "ranged specialist" stat - it's only valuable if you commit to ranged weapons
- Investing heavily in Targeting Systems signals your commitment to long-range precision combat
- High Targeting Systems + high Penetration = shots that hit accurately AND bypass armor

**The Synergy**:
- Targeting Systems × Penetration = Effective Ranged Damage
- Critical Systems adds spike damage potential through critical hits
- Weapon Control enhances overall weapon performance
- Result: Precision strikes that bypass armor and hit critical locations, ending battles through calculated elimination

**Precision Gameplay**:

Ranged Sniper's defining characteristic is precision-dependent gameplay. Unlike volume-based archetypes (Speed Demon with rapid attacks) or raw power archetypes (Glass Cannon with overwhelming damage), Ranged Sniper wins through accuracy and calculated strikes:

**The Precision Advantage**:

**Phase 1: Range Control** (Dominant)
- You start at maximum range, your optimal engagement distance
- Opponent must close distance to threaten you (if melee) or match your range (if ranged)
- Your Targeting Systems ensures high accuracy even at long range
- You deal damage freely while opponent approaches or positions

**Phase 2: Calculated Strikes** (Tactical)
- Each shot is a precision strike aimed at critical locations
- High Targeting Systems + Critical Systems = frequent critical hits
- High Penetration ensures damage bypasses armor
- You're not spraying bullets (Speed Demon) or overwhelming with power (Glass Cannon) - you're landing calculated, lethal strikes

**Phase 3: Distance Maintenance** (Defensive)
- If opponent closes distance, you must create space or accept close-range combat
- Sensor Suite helps you track opponent movement and maintain optimal range
- Your goal is to eliminate opponent before they reach you
- Victory comes from maintaining range advantage and landing precision strikes

**Why Precision Matters**:

Ranged Sniper has the highest effective damage at long range but requires accuracy to succeed:

**Best Case Scenario**: You maintain maximum range (high Sensor Suite), land precision strikes consistently (high Targeting Systems), bypass enemy armor (high Penetration), and score critical hits (high Critical Systems). Opponent is eliminated before closing distance. You win decisively with minimal damage taken.

**Worst Case Scenario**: Opponent has high mobility (Speed Demon) or defensive positioning (Tank Fortress), you struggle to land hits or penetrate armor, opponent closes distance or forces close-range engagement. Your precision advantage is negated. You lose.

**The Precision Skill Ceiling**:

Ranged Sniper has a high skill ceiling because accuracy is a skill:
- **Novice Players**: Struggle with accuracy, miss shots, fail to maintain range, lose to mobile opponents
- **Intermediate Players**: Learn to land shots consistently, maintain range adequately, win against stationary opponents
- **Advanced Players**: Master precision targeting, predict opponent movement, maintain optimal range, win against mobile opponents
- **Expert Players**: Perfect accuracy, critical hit optimization, range control mastery, dominate all matchups

This makes Ranged Sniper rewarding for players who enjoy precision mechanics and calculated gameplay.

**League Scaling and Risk Profile**:

- **Bronze League**: Medium risk. With income at ₡5-10K per win and moderate repair costs (₡12-16K per loss due to moderate defense), you need roughly 52-55% win rate to stay profitable. The precision challenge is most punishing in Bronze where you're still learning optimal targeting and range control. Ranged Sniper requires above-average accuracy to stay profitable in Bronze.

- **Silver League**: Low-medium risk. Income doubles to ₡10-20K per win while repair costs remain stable at ₡12-16K per loss. Your precision skills improve with experience, helping maintain win rate. At 50-52% win rate, you're profitable. The pressure eases as you master targeting and learn which opponents to engage at range vs. avoid.

- **Gold League and Beyond**: Low risk. With income at ₡20-40K per win and repair costs still ₡12-16K per loss, Ranged Sniper becomes highly profitable at 50% win rate. Your mastery of precision targeting and range control makes you dangerous in higher leagues where accuracy matters more than raw stats.

**Excellent in Higher Leagues - Precision Matters More Against Skilled Opponents**:

Ranged Sniper has an exceptional scaling pattern: it becomes EXCELLENT in higher leagues, not just more profitable. Here's why:

**Bronze League Opponents**:
- Often poorly optimized builds with low defensive attributes
- May not understand positioning or evasion mechanics
- Stand still or move predictably, making accuracy less critical
- Your precision advantage is modest because opponents don't exploit your weaknesses or require perfect accuracy to defeat

**Silver League Opponents**:
- Start understanding basic positioning and evasion
- May have moderate defensive attributes (Armor Plating, Hull Integrity)
- Your precision becomes more valuable as opponents become harder to hit and harder to damage
- Targeting Systems and Penetration start showing their value

**Gold League and Beyond Opponents**:
- Highly optimized defensive builds with high Armor Plating
- Skilled at evasion and positioning to minimize damage taken
- Your precision mastery becomes your primary advantage
- Targeting Systems (accuracy) bypasses evasion, Penetration bypasses armor
- You can defeat heavily armored opponents that other archetypes struggle against

**Why This Matters**:

In Bronze, Ranged Sniper is "just another damage build" - opponents have low armor and poor evasion, so raw damage works fine. In Gold, Ranged Sniper becomes a "precision specialist" - opponents have high armor and good evasion, but your Targeting Systems + Penetration combination bypasses both defenses.

**The Skill Scaling**:
- Bronze: Win through decent accuracy and moderate damage
- Silver: Win through good accuracy and armor penetration
- Gold: Win through excellent accuracy against evasive opponents
- Platinum+: Win through perfect precision against heavily armored, highly evasive opponents

**The Armor Penetration Advantage**:

As leagues progress, opponents invest more in Armor Plating (reduces incoming damage). A Gold League Tank Fortress might have 200+ Armor Plating, reducing damage by 40-50%. 

**Without Penetration** (e.g., Speed Demon):
- Your 10,000 damage attack is reduced to 5,000-6,000 damage by armor
- You need twice as many hits to win
- Battle takes longer, opponent has more time to damage you

**With High Penetration** (Ranged Sniper):
- Your 10,000 damage attack bypasses 60-80% of armor
- Effective damage: 8,000-9,000 (only 10-20% reduction)
- You need normal number of hits to win
- Battle ends quickly, opponent has less time to damage you

This makes Ranged Sniper increasingly valuable in higher leagues where armor becomes common. You're the "tank killer" archetype that other players struggle to build against.

**Personality Fit**: 

Ranged Sniper is ideal for players who:
- Enjoy precision gameplay and calculated strikes
- Appreciate ranged combat and maintaining distance
- Find satisfaction in landing perfect shots and critical hits
- Want a skill-expressive archetype that rewards accuracy
- Enjoy the fantasy of a mechanical sniper eliminating targets from range
- Appreciate the tactical depth of range control and positioning
- Like archetypes that scale excellently into higher leagues
- Find melee combat too chaotic - prefer controlled, long-range engagements
- Enjoy the challenge of bypassing enemy defenses through precision and penetration
- Want an archetype that becomes MORE valuable as opponents get tougher

**Recommended For**:
- Players who enjoy sniper/marksman roles in other games (FPS, tactical shooters)
- Those who appreciate precision mechanics and accuracy-based gameplay
- Skilled players who want an archetype that rewards mastery
- Anyone who finds satisfaction in perfect shots and critical hits
- Players who enjoy the challenge of defeating heavily armored opponents
- Those who want an archetype that excels in higher leagues

**Not Recommended For**:
- Players who prefer melee combat or close-range brawling
- Those who dislike precision-dependent gameplay (prefer consistent damage)
- Players who want the simplest possible strategy (precision adds complexity)
- Anyone frustrated by missing shots or accuracy mechanics
- Players who want maximum safety (Tank Fortress is safer)
- Those who prefer rapid-fire attacks over calculated strikes (Speed Demon is better)

**Strategic Focus**:

The Ranged Sniper strategy revolves around precision targeting and range control:

1. **Master Precision Targeting**: Learn to land shots consistently, especially at long range. Use Targeting Systems to maximize accuracy. Your goal is 80%+ hit rate.

2. **Maximize Penetration**: Invest heavily in Penetration to bypass enemy armor. Your precision is wasted if damage is blocked by Armor Plating.

3. **Control Engagement Range**: Maintain maximum distance from melee opponents, optimal distance from ranged opponents. Use Sensor Suite to track movement and adjust positioning.

4. **Optimize Critical Hits**: High Targeting Systems + Critical Systems = frequent critical hits. Aim for weak points to maximize damage per shot.

5. **Learn Matchups**: Some opponents are easy to hit and damage (low armor, poor evasion), others are challenging (high armor, high mobility). Learn which matchups favor you and which require extra precision.

6. **Improve Accuracy Over Time**: Your win rate will increase as you master precision targeting. Bronze: 50-52% win rate. Silver: 52-55% win rate. Gold: 55-60% win rate. Your skill growth translates directly to win rate growth.

**Why Ranged Sniper Works**:

The key insight is that Targeting Systems + Penetration creates a specialization advantage against armored opponents. While other archetypes struggle against high-armor Tank Fortress builds, Ranged Sniper bypasses armor and lands precision strikes on weak points.

Additionally, precision skill creates a skill-based advantage that compounds over time. As you improve at landing shots and controlling range, your win rate increases independent of attribute levels. This makes Ranged Sniper one of the few archetypes where player skill matters as much as robot stats.

**The Ranged Damage Formula** (simplified):
```
Effective Ranged Damage = (Combat Power × Targeting Systems Multiplier) × Weapon Base Damage × (1 - (Armor × (1 - Penetration %))) × Critical Modifier
```

Where:
- Targeting Systems Multiplier increases accuracy and critical hit location targeting
- Penetration % reduces effectiveness of enemy armor
- Critical Modifier increases damage on critical hits

High Targeting Systems + high Penetration = shots that hit accurately AND bypass armor, creating devastating effective damage even against heavily armored opponents.

**Weapon Choice Deep Dive**:

**Railgun** (₡450,000):

**Pros**:
- Highest penetration in the game (bypasses 80-90% of armor)
- Best against heavily armored opponents (Tank Fortress, defensive builds)
- Consistent damage output (less variance than Sniper Rifle)
- Excellent in Gold+ leagues where armor is common
- "Tank killer" weapon - your specialty

**Cons**:
- Highest cost (₡450,000)
- Moderate base damage (relies on penetration for effectiveness)
- Less spike damage than Sniper Rifle (fewer critical hits)
- Requires high Penetration attributes to maximize value

**Best For**: Players facing armored opponents, Gold+ league play, consistent damage preference, "tank killer" specialization

**Sniper Rifle** (₡400,000):

**Pros**:
- Highest accuracy in the game (easiest to land shots)
- Critical hit focused (high spike damage potential)
- Best for precision strikes on weak points
- Lower cost than Railgun (₡400K vs. ₡450K)
- Excellent against evasive opponents (high accuracy compensates)

**Cons**:
- Lower penetration than Railgun (struggles against heavy armor)
- More variance in damage (critical hits vs. normal hits)
- Requires high Critical Systems to maximize value
- Less effective against Tank Fortress builds

**Best For**: Players who want maximum accuracy, critical hit optimization, lower weapon cost, fighting evasive opponents

**Plasma Cannon** (₡500,000):

**Pros**:
- Highest raw damage in the game
- Area effect potential (can damage multiple systems)
- Overwhelming firepower (similar to Glass Cannon philosophy)
- Intimidating and satisfying gameplay

**Cons**:
- Highest cost (₡500,000)
- Lower accuracy than Sniper Rifle
- Lower penetration than Railgun
- Less specialized (more generalist ranged weapon)

**Best For**: Players who want maximum damage, can afford premium weapon, prefer overwhelming firepower over specialization

**Recommendation**: 
- **First-time Ranged Snipers**: Start with Sniper Rifle (₡400K) for high accuracy and lower cost
- **Gold+ League Players**: Choose Railgun (₡450K) for armor penetration against tough opponents
- **High-Budget Players**: Plasma Cannon (₡500K) for maximum raw damage
- **Tank Killer Specialists**: Railgun is your weapon - highest penetration for bypassing armor

**Common Misconceptions**:

- "Ranged is always better than melee": False. Ranged has range advantage but melee has higher damage potential (Hydraulic Systems). Both are viable.

- "Targeting Systems is just accuracy": False. Targeting Systems also improves critical hit location targeting and long-range effectiveness, not just hit chance.

- "Penetration doesn't matter in Bronze": Partially true. Bronze opponents have low armor, so penetration is less valuable. But investing in Penetration early pays off in Silver/Gold where armor becomes common.

- "Ranged Sniper loses to Speed Demon": Partially true. Speed Demon is a challenging matchup (high mobility makes them hard to hit), but your Targeting Systems helps land shots on moving targets.

- "You need perfect accuracy to win": False. You need good accuracy (70-80% hit rate). Perfect accuracy (95%+) is ideal but not required for success.

- "Ranged Sniper is just Glass Cannon with ranged weapons": False. Ranged Sniper focuses on Targeting Systems (accuracy) and Penetration (armor bypass), while Glass Cannon focuses on raw Combat Power and quick eliminations. Different philosophies and playstyles.

**The Precision Learning Curve**:

Expect your performance to improve over time as you master precision targeting:

**Weeks 1-2 (Learning Phase)**:
- Win rate: 48-52% (struggling with accuracy)
- Hit rate: 60-70%
- Common mistakes: Missing shots, poor range control, failing to maintain distance
- Focus: Learn basic targeting, understand Targeting Systems usage, identify easy vs. hard targets

**Weeks 3-4 (Competent Phase)**:
- Win rate: 52-55% (reliable accuracy)
- Hit rate: 70-80%
- Improvements: Landing shots consistently, maintaining range adequately, controlling engagement distance
- Focus: Refine targeting patterns, learn opponent movement patterns, optimize range control

**Weeks 5-8 (Skilled Phase)**:
- Win rate: 55-58% (strong precision)
- Hit rate: 80-85%
- Mastery: Predicting opponent movement, landing critical hits reliably, winning challenging matchups
- Focus: Advanced tactics (leading targets, weak point targeting), matchup-specific strategies

**Weeks 9+ (Expert Phase)**:
- Win rate: 58-62%+ (precision mastery)
- Hit rate: 85-90%+
- Excellence: Perfect targeting, critical hit optimization, dominating even evasive opponents
- Focus: Optimization, consistency, adapting to meta shifts

This learning curve makes Ranged Sniper rewarding long-term - you'll continuously improve and see your win rate increase as your precision skill develops.

**Quick Summary**:

Ranged Sniper is the precision-focused, long-range combat archetype in Armoured Souls. If you enjoy ranged combat, appreciate precision gameplay, want a skill-expressive archetype that rewards accuracy, and find satisfaction in landing perfect shots that bypass enemy defenses, this is your archetype. You'll focus on Targeting Systems (accuracy multiplier) and Penetration (armor bypass), choosing between Railgun (highest penetration, tank killer), Sniper Rifle (highest accuracy, critical hits), or Plasma Cannon (highest raw damage). Medium risk in Bronze (requires 52-55% win rate), low-medium risk in Silver, low risk in Gold+. Excellent in higher leagues as precision and penetration become more valuable against skilled, armored opponents. Perfect for players who enjoy precision mechanics, want an archetype that scales excellently into endgame, and appreciate the tactical depth of range control and calculated strikes. Your win rate will increase over time as you master precision targeting, making this one of the most rewarding archetypes for dedicated players who enjoy marksman gameplay.

---

### AI Tactician

**Philosophy**: Win through superior decision-making and adaptive AI. The AI Tactician archetype is built on the principle that intelligence beats raw stats - by maximizing Combat Algorithms and AI attributes, you create a robot that makes optimal tactical decisions in real-time, adapts to opponent strategies, and exploits weaknesses through superior threat analysis. This is the "strategic mastermind" archetype for players who enjoy tactical depth and AI optimization.

**Robot Build Style**: AI-optimized strategist focused on Combat Algorithms and decision-making attributes. Your robot is designed to analyze threats, adapt strategies mid-battle, and make optimal tactical choices that maximize win probability. Think of it as a mechanical chess master that outthinks opponents rather than overpowering them through raw stats.

**Loadout Type**: Balanced - any loadout works (AI optimizes usage)

Unlike specialized archetypes that require specific loadouts (Tank Fortress needs Weapon+Shield, Glass Cannon needs Two-Handed), AI Tactician is loadout-agnostic. Your Combat Algorithms optimize whatever loadout you choose, making tactical decisions about when to attack, defend, or reposition based on battle state. This flexibility allows you to choose loadouts based on preference or budget rather than archetype requirements.

**Loadout Flexibility**:
- **Single**: AI optimizes single weapon usage, focusing on timing and positioning
- **Weapon+Shield**: AI decides when to block vs. attack, maximizing defensive value
- **Two-Handed**: AI times devastating strikes for maximum impact
- **Dual-Wield**: AI coordinates dual weapon attacks for optimal DPS

The key insight is that Combat Algorithms makes ANY loadout more effective by optimizing its usage. You're not locked into a specific playstyle - your AI adapts to whatever tools you provide.

**Attribute Focus**: 

Priority attributes for AI Tactician builds:

**Core AI Attributes** (Essential for all AI Tacticians):
1. **Combat Algorithms** (AI) - Your primary stat. Directly improves tactical decision-making, battle strategy optimization, and real-time adaptation. Every point makes your robot "smarter" in combat, choosing better actions and exploiting opponent weaknesses.
2. **Threat Analysis** (AI) - Your secondary strategic stat. Improves opponent analysis, weakness identification, and threat prioritization. Helps your AI understand what the opponent is trying to do and how to counter it.
3. **Adaptive AI** (AI) - Your learning stat. Enables your robot to adapt strategies mid-battle based on what's working and what's not. Critical for responding to unexpected opponent tactics.
4. **Logic Cores** (AI) - Your processing power stat. Increases AI calculation speed and decision quality. More Logic Cores = faster, better tactical decisions.

**Supporting Attributes**:
5. **Neural Networks** (AI) - Improves pattern recognition and strategic learning. Helps your AI identify opponent patterns and exploit them.
6. **Combat Power** (Combat) - Moderate investment for decent damage output. Your AI can't win with zero damage - you need baseline offensive capability.
7. **Hull Integrity** (Defense) - Moderate investment for survivability. Your AI needs time to execute its strategy - can't win if you're eliminated instantly.

**The Combat Algorithms Focus**:

Combat Algorithms is the defining attribute of AI Tactician. While other attributes affect specific combat aspects (damage, defense, speed), Combat Algorithms affects decision-making quality - the meta-layer that determines how effectively you use your other attributes.

**How Combat Algorithms Works**:
- Improves tactical decision-making (when to attack vs. defend vs. reposition)
- Optimizes action timing (striking when opponent is vulnerable, defending when threatened)
- Enhances strategy adaptation (changing tactics based on battle state)
- Improves resource management (managing energy, positioning, cooldowns optimally)
- Does NOT directly increase damage or defense - it makes you USE your stats more effectively

**Why Combat Algorithms Matters**:
- A robot with 200 Combat Power + 150 Combat Algorithms will often defeat a robot with 250 Combat Power + 100 Combat Algorithms because it uses its damage more effectively (striking at optimal moments, targeting weak points, avoiding wasted attacks)
- Combat Algorithms is the "tactical multiplier" - it amplifies the effectiveness of your other attributes
- Investing heavily in Combat Algorithms signals your commitment to strategic gameplay over raw stat advantages
- High Combat Algorithms + high Threat Analysis = a robot that understands the battle state and makes optimal decisions

**The Synergy**:
- Combat Algorithms × Threat Analysis = Tactical Decision Quality
- Adaptive AI adds real-time strategy adjustment
- Logic Cores increases decision speed and quality
- Neural Networks improves pattern recognition
- Result: A robot that consistently makes better tactical decisions than opponents, winning through superior strategy rather than superior stats

**Strategic Depth and AI Optimization**:

AI Tactician's defining characteristic is strategic depth. Unlike stat-focused archetypes (Glass Cannon maximizes damage, Tank Fortress maximizes defense), AI Tactician maximizes decision-making quality:

**The Strategic Advantage**:

**Phase 1: Threat Analysis** (Information Gathering)
- Your Threat Analysis identifies opponent's build type (offensive, defensive, balanced)
- Combat Algorithms assesses optimal counter-strategy
- Neural Networks recognizes patterns in opponent behavior
- You understand the matchup before opponent does

**Phase 2: Tactical Execution** (Strategy Implementation)
- Combat Algorithms makes optimal decisions each turn (attack, defend, reposition)
- Adaptive AI adjusts strategy based on battle state (winning = maintain strategy, losing = adapt)
- Logic Cores processes information quickly, making better decisions faster
- You execute your strategy more effectively than opponent executes theirs

**Phase 3: Real-Time Adaptation** (Dynamic Response)
- Adaptive AI recognizes when current strategy isn't working
- Combat Algorithms identifies alternative approaches
- Threat Analysis reassesses opponent's strategy
- You adapt faster than opponent, gaining strategic advantage

**Why Strategic Depth Matters**:

AI Tactician wins through better decisions, not better stats. In a battle between two robots with identical attributes, the one with higher Combat Algorithms wins because it makes better tactical choices:

**Example Scenario**: Both robots have 200 Combat Power, 200 Hull Integrity, 150 Attack Speed.

**Low Combat Algorithms Robot** (100 Combat Algorithms):
- Attacks predictably, following simple patterns
- Doesn't adapt to opponent strategy
- Wastes attacks on defended positions
- Fails to exploit opponent weaknesses
- Makes suboptimal decisions (attacking when should defend, defending when should attack)
- Result: Loses despite equal stats

**High Combat Algorithms Robot** (200 Combat Algorithms):
- Attacks strategically, timing strikes for maximum impact
- Adapts to opponent patterns mid-battle
- Focuses attacks on vulnerable moments
- Exploits opponent weaknesses (low defense, poor positioning)
- Makes optimal decisions (attacking when opponent is vulnerable, defending when threatened)
- Result: Wins despite equal stats

This is the AI Tactician advantage - you win matchups that other archetypes would lose because your decision-making quality is superior.

**The Intelligence Multiplier**:

Combat Algorithms acts as a multiplier on your other attributes:

**Without High Combat Algorithms**:
- 200 Combat Power = 200 effective damage (used inefficiently)
- 200 Hull Integrity = 200 effective HP (damaged unnecessarily)
- 150 Attack Speed = 150 effective speed (attacks wasted on defended positions)

**With High Combat Algorithms** (200+):
- 200 Combat Power = 250-300 effective damage (used optimally, striking vulnerable moments)
- 200 Hull Integrity = 250-300 effective HP (damage minimized through smart positioning)
- 150 Attack Speed = 180-200 effective speed (attacks timed perfectly, no wasted strikes)

Your Combat Algorithms makes every other attribute 20-30% more effective through superior usage. This is why AI Tactician can compete with specialized builds despite having lower raw stats in specific areas.

**League Scaling and Risk Profile**:

- **Bronze League**: Medium risk. With income at ₡5-10K per win and moderate repair costs (₡12-16K per loss due to balanced stats), you need roughly 52-55% win rate to stay profitable. The strategic advantage is modest in Bronze where opponents make obvious mistakes regardless of your AI quality. AI Tactician requires above-average tactical understanding to stay profitable in Bronze.

- **Silver League**: Low-medium risk. Income doubles to ₡10-20K per win while repair costs remain stable at ₡12-16K per loss. Your strategic advantage becomes more valuable as opponents improve - your superior decision-making creates larger win rate advantages. At 50-52% win rate, you're profitable. The pressure eases as your AI quality becomes more impactful.

- **Gold League and Beyond**: Low risk. With income at ₡20-40K per win and repair costs still ₡12-16K per loss, AI Tactician becomes highly profitable at 50% win rate. Your mastery of tactical decision-making and AI optimization makes you dangerous in higher leagues where strategy matters more than raw stats.

**Scales Excellently - AI Attributes Become More Valuable Against Better Opponents**:

AI Tactician has an exceptional scaling pattern similar to Ranged Sniper: it becomes EXCELLENT in higher leagues, not just more profitable. Here's why:

**Bronze League Opponents**:
- Make obvious tactical mistakes (attacking when should defend, poor positioning)
- Use simple, predictable strategies
- Don't adapt mid-battle
- Your AI advantage is modest because opponents beat themselves through mistakes
- You win through decent stats + slightly better decisions

**Silver League Opponents**:
- Make fewer obvious mistakes
- Use more sophisticated strategies
- Begin adapting mid-battle
- Your AI advantage becomes more valuable as opponents require better tactics to defeat
- You win through good stats + notably better decisions

**Gold League and Beyond Opponents**:
- Make few tactical mistakes
- Use optimized strategies
- Adapt effectively mid-battle
- Your AI advantage becomes your primary edge
- Opponents have similar stats but inferior decision-making
- You win through excellent stats + superior tactical decisions

**Why This Matters**:

In Bronze, AI Tactician is "just another balanced build" - opponents make so many mistakes that your superior AI doesn't create huge advantages. In Gold, AI Tactician becomes a "strategic specialist" - opponents play well, but your Combat Algorithms + Threat Analysis combination makes better decisions, creating consistent win rate advantages.

**The Strategic Scaling**:
- Bronze: Win through decent stats + slightly better tactics (52-54% win rate)
- Silver: Win through good stats + notably better tactics (54-56% win rate)
- Gold: Win through excellent stats + superior tactics (56-60% win rate)
- Platinum+: Win through optimized stats + masterful tactics (60%+ win rate)

Your win rate increases as opponents improve because your strategic advantage becomes more impactful against skilled players who don't make obvious mistakes.

**The Decision Quality Advantage**:

As leagues progress, battles become more tactical. A Bronze battle might be decided by raw stats (higher Combat Power wins). A Gold battle is decided by tactics (better positioning, timing, adaptation wins).

**Bronze Battle** (Stats Matter Most):
- Opponent has 250 Combat Power, you have 200 Combat Power + 150 Combat Algorithms
- Opponent attacks predictably, you attack strategically
- Result: Close battle, your tactics partially compensate for stat disadvantage
- Win rate: 52-54% (modest advantage)

**Gold Battle** (Tactics Matter Most):
- Opponent has 250 Combat Power, you have 200 Combat Power + 200 Combat Algorithms
- Opponent attacks well, you attack optimally
- Result: Your superior tactics create significant advantage despite stat disadvantage
- Win rate: 56-60% (substantial advantage)

This makes AI Tactician increasingly valuable in higher leagues where tactical depth matters more than raw stats. You're the "strategic specialist" archetype that excels against skilled opponents.

**Personality Fit**: 

AI Tactician is ideal for players who:
- Enjoy strategic depth and tactical decision-making
- Appreciate AI optimization and intelligent gameplay
- Find satisfaction in outthinking opponents rather than overpowering them
- Want a skill-expressive archetype that rewards strategic mastery
- Enjoy the fantasy of a highly intelligent combat robot
- Appreciate flexibility (any loadout works)
- Like archetypes that scale excellently into higher leagues
- Find raw stat optimization boring - prefer strategic complexity
- Enjoy the challenge of adapting strategies mid-battle
- Want an archetype that becomes MORE valuable as opponents get tougher
- Appreciate the meta-game of decision-making quality

**Recommended For**:
- Players who enjoy strategy games, chess, tactical RPGs
- Those who appreciate AI mechanics and optimization
- Skilled players who want an archetype that rewards strategic mastery
- Anyone who finds satisfaction in perfect tactical execution
- Players who enjoy the challenge of defeating stat-superior opponents through better decisions
- Those who want an archetype that excels in higher leagues
- Players who value flexibility and adaptability

**Not Recommended For**:
- Players who prefer simple, straightforward strategies (Tank Fortress or Glass Cannon are simpler)
- Those who dislike AI mechanics or find them unintuitive
- Players who want maximum specialization (AI Tactician is generalist)
- Anyone frustrated by strategic complexity
- Players who want immediate power (AI Tactician requires understanding to maximize)
- Those who prefer raw stat advantages over tactical advantages

**Strategic Focus**:

The AI Tactician strategy revolves around maximizing decision-making quality and strategic adaptation:

1. **Master Combat Algorithms**: Invest heavily in Combat Algorithms to maximize tactical decision quality. Your goal is to make better decisions than opponents every turn.

2. **Optimize Threat Analysis**: High Threat Analysis helps you understand opponent strategies and identify weaknesses. You can't exploit weaknesses you don't recognize.

3. **Enable Adaptive AI**: Invest in Adaptive AI to adjust strategies mid-battle. Rigid strategies lose to adaptive opponents - you need flexibility.

4. **Maintain Balanced Stats**: Unlike specialized archetypes, you need decent stats across combat, defense, and mobility. Your AI can't win with zero damage or zero HP - you need baseline capability in all areas.

5. **Learn Strategic Patterns**: Your win rate improves as you understand what good tactical decisions look like. Study battles, identify optimal decisions, learn from losses.

6. **Leverage Flexibility**: Your loadout-agnostic nature allows you to adapt to meta shifts. If shields become popular, switch to Two-Handed. If speed builds dominate, switch to Weapon+Shield. Your AI optimizes whatever you choose.

7. **Invest in AI Training Academy**: The AI Training Academy facility (₡500,000) provides bonuses to AI attribute effectiveness. This is your key facility investment - it amplifies your strategic advantage.

**Why AI Tactician Works**:

The key insight is that Combat Algorithms creates a strategic multiplier that amplifies all your other attributes. While specialized archetypes maximize one dimension (offense, defense, speed), AI Tactician maximizes the meta-dimension of decision-making quality.

Additionally, strategic skill creates a skill-based advantage that compounds over time. As you improve at recognizing optimal decisions and understanding tactical patterns, your win rate increases independent of attribute levels. This makes AI Tactician one of the few archetypes where player strategic skill matters as much as robot stats.

**The Decision Quality Formula** (conceptual):
```
Effective Combat Performance = (Base Stats) × (1 + Combat Algorithms Multiplier) × (1 + Threat Analysis Bonus) × Adaptive AI Factor
```

Where:
- Combat Algorithms Multiplier increases effectiveness of all actions (20-30% improvement)
- Threat Analysis Bonus improves strategy selection and weakness exploitation
- Adaptive AI Factor enables mid-battle strategy adjustments

High Combat Algorithms + high Threat Analysis + high Adaptive AI = a robot that makes consistently better decisions, creating win rate advantages even against stat-superior opponents.

**AI Training Academy - Your Key Facility**:

AI Training Academy (₡500,000) is the signature facility for AI Tactician:

**What It Does**:
- Provides bonuses to AI attribute effectiveness (Combat Algorithms, Threat Analysis, Adaptive AI, Logic Cores, Neural Networks)
- Level 1: +5% AI attribute effectiveness
- Level 5: +25% AI attribute effectiveness
- Level 10: +50% AI attribute effectiveness

**Why It Matters**:
- Your entire strategy revolves around AI attributes
- 5% effectiveness boost on 200 Combat Algorithms = +10 effective Combat Algorithms
- Amplifies your strategic advantage
- Compounds with your AI-focused build

**ROI Consideration**:
- Cost: ₡500,000 (expensive!)
- Operating cost: ₡2,500/day (₡17,500/week)
- Benefit: +5% AI effectiveness at Level 1
- Worth it? Only if you're heavily invested in AI attributes (which you are as AI Tactician)

**Strategic Decision**:
- **Early Game**: Skip AI Training Academy, invest in robot attributes first (you need baseline AI stats before amplifying them)
- **Mid Game**: Purchase AI Training Academy once you have 150+ Combat Algorithms (the 5% boost becomes meaningful)
- **Late Game**: Upgrade AI Training Academy to Level 5+ for massive AI effectiveness bonuses

AI Training Academy is expensive but essential for AI Tactician long-term. It's the facility that separates casual AI builds from dedicated AI Tactician specialists.

**Balanced Stats Philosophy**:

Unlike specialized archetypes that min-max (Glass Cannon: max offense, min defense), AI Tactician maintains balanced stats:

**Why Balanced Stats?**

Your Combat Algorithms makes ALL your attributes more effective through better usage. Specializing in one area (pure offense or pure defense) limits your tactical options. Balanced stats give your AI more tools to work with:

**Offensive Capability** (Combat Power, Penetration, Critical Systems):
- Needed to actually win battles (can't win with zero damage)
- Your AI optimizes damage timing and targeting
- Moderate investment (150-200 levels) provides sufficient damage when used optimally

**Defensive Capability** (Hull Integrity, Armor Plating, Damage Control):
- Needed to survive long enough to execute strategy
- Your AI minimizes damage through smart positioning
- Moderate investment (150-200 levels) provides sufficient survivability when used optimally

**Mobility Capability** (Attack Speed, Servo Motors, Reaction Time):
- Needed for positioning and tactical flexibility
- Your AI uses mobility for optimal positioning
- Moderate investment (100-150 levels) provides sufficient mobility for tactical decisions

**AI Capability** (Combat Algorithms, Threat Analysis, Adaptive AI, Logic Cores):
- Your primary investment (200-250 levels)
- Amplifies effectiveness of all other attributes
- This is where you specialize - the meta-layer that makes everything else work better

**The Balanced Advantage**:

Specialized builds have clear strengths and weaknesses:
- Glass Cannon: Strong offense, weak defense (vulnerable to counter-attacks)
- Tank Fortress: Strong defense, weak offense (slow battles)
- Speed Demon: Strong mobility, moderate everything else (relies on speed)

AI Tactician has moderate stats everywhere + superior decision-making:
- Moderate offense used optimally = effective offense
- Moderate defense used optimally = effective defense
- Moderate mobility used optimally = effective mobility
- Superior AI = strategic advantage in all matchups

You don't have obvious weaknesses for opponents to exploit. Your AI adapts to whatever strategy they use, making you a difficult matchup for everyone.

**Loadout Recommendations**:

Since AI Tactician is loadout-agnostic, choose based on preference or budget:

**Budget Option: Single** (₡150,000-₡250,000 weapon)
- Lowest weapon cost
- Simple, effective
- AI optimizes single weapon usage
- Best for: New AI Tacticians, budget-conscious players

**Defensive Option: Weapon+Shield** (₡200,000-₡300,000 weapon + ₡150,000 shield)
- +10% defense bonus
- AI decides when to block vs. attack
- Best for: Players who want more survivability, defensive preference

**Offensive Option: Two-Handed** (₡400,000-₡500,000 weapon)
- +20% damage bonus
- AI times devastating strikes optimally
- Best for: Players who want more damage, offensive preference

**Balanced Option: Dual-Wield** (2× ₡150,000-₡250,000 weapons)
- +15% attack speed bonus
- AI coordinates dual weapon attacks
- Best for: Players who want DPS optimization, speed preference

**Recommendation**: Start with Single (lowest cost, simple) or Weapon+Shield (defensive bonus helps survivability). Experiment with other loadouts mid-game once you understand your preferences.

**Common Misconceptions**:

- "AI attributes don't matter, just max Combat Power": False. Combat Algorithms amplifies all your attributes, creating multiplicative value. 200 Combat Power + 200 Combat Algorithms > 300 Combat Power + 100 Combat Algorithms in most matchups.

- "AI Tactician is weak in Bronze": Partially true. AI advantage is smaller in Bronze (opponents make obvious mistakes), but you're still profitable at 52-54% win rate. Not weak, just less dominant than in higher leagues.

- "You need to understand AI mechanics to play AI Tactician": Partially true. Understanding helps maximize value, but Combat Algorithms works automatically - your robot makes better decisions even if you don't consciously understand why.

- "AI Tactician loses to specialized builds": False. Your balanced stats + superior decision-making creates advantages against specialized builds. You adapt to their strategy and exploit their weaknesses.

- "Combat Algorithms is just a minor bonus": False. Combat Algorithms is a 20-30% effectiveness multiplier on all your actions. That's massive - equivalent to having 20-30% higher stats in every category.

- "AI Tactician is boring because it's balanced": Subjective. Many players find strategic depth and tactical decision-making more engaging than raw stat optimization. If you enjoy strategy, AI Tactician is one of the most interesting archetypes.

**The Strategic Learning Curve**:

Expect your performance to improve over time as you master strategic decision-making:

**Weeks 1-2 (Learning Phase)**:
- Win rate: 50-52% (learning AI mechanics)
- Strategic understanding: Basic (recognizing obvious good/bad decisions)
- Common mistakes: Not leveraging AI advantages, playing like a stat-focused build
- Focus: Understand what Combat Algorithms does, learn to recognize tactical opportunities

**Weeks 3-4 (Competent Phase)**:
- Win rate: 52-55% (reliable strategic play)
- Strategic understanding: Intermediate (recognizing optimal decisions most of the time)
- Improvements: Leveraging AI advantages, adapting strategies mid-battle
- Focus: Refine decision-making patterns, learn matchup-specific strategies

**Weeks 5-8 (Skilled Phase)**:
- Win rate: 55-58% (strong strategic mastery)
- Strategic understanding: Advanced (consistently making optimal decisions)
- Mastery: Exploiting opponent weaknesses, perfect tactical execution
- Focus: Advanced tactics (predicting opponent strategies, counter-strategy optimization)

**Weeks 9+ (Expert Phase)**:
- Win rate: 58-62%+ (strategic excellence)
- Strategic understanding: Expert (perfect decision-making, deep tactical insight)
- Excellence: Defeating stat-superior opponents through superior strategy
- Focus: Optimization, consistency, meta-game adaptation

This learning curve makes AI Tactician rewarding long-term - you'll continuously improve and see your win rate increase as your strategic skill develops. Unlike stat-focused archetypes where win rate plateaus once you optimize attributes, AI Tactician win rate grows with player skill.

**Quick Summary**:

AI Tactician is the strategic depth, intelligent decision-making archetype in Armoured Souls. If you enjoy tactical gameplay, appreciate AI optimization, want a skill-expressive archetype that rewards strategic mastery, and find satisfaction in outthinking opponents rather than overpowering them, this is your archetype. You'll focus on Combat Algorithms (decision quality), Threat Analysis (opponent understanding), Adaptive AI (strategy adjustment), and Logic Cores (processing power), choosing any loadout type (AI optimizes whatever you pick). Medium risk in Bronze (requires 52-55% win rate), low-medium risk in Silver, low risk in Gold+. Scales excellently in higher leagues as AI attributes become more valuable against skilled opponents who don't make obvious mistakes. Perfect for players who enjoy strategy games, want an archetype that excels in endgame, and appreciate the tactical depth of decision-making optimization. Your win rate will increase over time as you master strategic patterns, making this one of the most rewarding archetypes for dedicated players who enjoy intelligent, adaptive gameplay. Flexible, adaptable, and increasingly powerful as you and your opponents improve - the thinking player's archetype.

---

### Prestige Rusher

**Philosophy**: Optimize for rapid prestige accumulation to unlock high-tier content and long-term progression systems. The Prestige Rusher archetype is built on the principle that prestige is the ultimate currency - by maximizing prestige gains through consistent wins, rapid league advancement, and tournament participation, you unlock content, bonuses, and opportunities that compound exponentially over time. This is the "competitive progression" archetype for players who view Armoured Souls as a long-term journey where early optimization pays massive dividends months later.

**Robot Build Style**: Win-optimized balanced build focused on maximizing win probability rather than specializing in one dimension. Your robot is designed to win consistently across all matchups through well-rounded capabilities, avoiding the weaknesses of specialized builds (Glass Cannon's fragility, Tank Fortress's slow kills, Speed Demon's positioning dependency). Think of it as the "competitive meta build" - whatever attributes and combinations currently provide the highest win rate.

**Loadout Type**: Cost-effective weapons that maximize win probability

Unlike specialized archetypes that commit to specific loadouts for thematic reasons (Tank Fortress must use Weapon+Shield, Glass Cannon must use Two-Handed), Prestige Rusher is pragmatic about loadout selection. Your goal is to choose the loadout type that provides the best win rate for your budget:

**Loadout Selection Criteria**:
- **Cost-effectiveness**: Maximize win probability per credit spent
- **Meta-relevance**: Choose loadouts that counter popular opponent builds
- **Versatility**: Avoid loadouts with hard counters or bad matchups
- **Proven performance**: Stick with loadouts that have demonstrated high win rates

**Typical Choices**:
- **Weapon+Shield**: Solid defensive value, good against aggressive builds, moderate cost (₡250,000-₡350,000 for shield + weapon)
- **Single**: Most cost-effective, allows maximum attribute investment, flexible (₡150,000-₡300,000 for one good weapon)
- **Dual-Wield**: High DPS, good against defensive builds, moderate-high cost (₡300,000-₡500,000 for two weapons)

**Avoid**:
- **Two-Handed**: Often too expensive (₡400,000-₡500,000 for premium two-handed weapons) and creates Glass Cannon fragility that hurts win rate consistency

The key insight is that Prestige Rusher doesn't care about playstyle fantasy or thematic consistency - you choose whatever loadout provides the best win rate for your budget. If Weapon+Shield is meta, you use Weapon+Shield. If Single becomes dominant, you switch to Single. Flexibility and pragmatism over specialization.

**Attribute Focus**: 

Priority attributes for Prestige Rusher builds (win-optimized balanced approach):

**Core Offensive Attributes** (Essential for winning battles):
1. **Combat Power** (Combat) - Your primary damage stat. Sufficient Combat Power ensures you can actually eliminate opponents rather than stalling in long battles. Target: 180-220 levels.
2. **Penetration** (Combat) - Bypasses enemy armor, ensuring your damage is effective against defensive builds. Critical for maintaining win rate against Tank Fortress opponents. Target: 120-150 levels.
3. **Weapon Control** (Combat) - Improves accuracy and weapon effectiveness. Missed attacks don't win battles - you need reliable damage output. Target: 100-130 levels.

**Core Defensive Attributes** (Essential for survival):
4. **Hull Integrity** (Defense) - Your primary survivability stat. You can't win if you're eliminated - sufficient HP keeps you in fights long enough to secure victories. Target: 180-220 levels.
5. **Armor Plating** (Defense) - Reduces incoming damage, improving survivability and reducing repair costs. Helps maintain profitability while pursuing prestige. Target: 120-150 levels.
6. **Damage Control** (Defense) - Reduces critical hit damage, preventing catastrophic losses to Glass Cannon opponents. Target: 80-100 levels.

**Supporting Attributes** (Tactical advantages):
7. **Attack Speed** (Mobility) - Increases attack frequency, improving DPS and battle tempo control. Target: 100-130 levels.
8. **Servo Motors** (Mobility) - Improves positioning and movement, providing tactical flexibility. Target: 80-100 levels.
9. **Combat Algorithms** (AI) - Improves tactical decision-making, optimizing your balanced stats for maximum effectiveness. Target: 100-120 levels.

**The Win-Optimization Philosophy**:

Prestige Rusher's attribute distribution is designed to maximize win rate across all matchups:

**Against Glass Cannon** (High offense, low defense):
- Your Hull Integrity + Armor Plating lets you survive their burst damage
- Your Combat Power + Penetration lets you eliminate them before they eliminate you
- Your Damage Control reduces their critical hit advantage
- Result: Favorable matchup (55-60% win rate)

**Against Tank Fortress** (High defense, low offense):
- Your Penetration bypasses their armor
- Your Combat Power provides sufficient damage to overcome their HP
- Your Attack Speed prevents battles from stalling indefinitely
- Result: Even matchup (50-55% win rate)

**Against Speed Demon** (High speed, moderate stats):
- Your balanced stats prevent them from exploiting weaknesses
- Your Combat Algorithms helps you respond to their positioning
- Your Hull Integrity lets you survive their rapid attacks
- Result: Even matchup (50-55% win rate)

**Against Balanced Builds** (Similar to you):
- Your Combat Algorithms provides decision-making edge
- Your optimized attribute distribution (focused on win-critical stats) beats generic balanced builds
- Your competitive mindset and strategic focus creates skill advantage
- Result: Favorable matchup (52-57% win rate)

**Why This Works**:

By avoiding extreme specialization, you avoid hard counters. Glass Cannon destroys Tank Fortress but loses to Speed Demon. Tank Fortress beats Speed Demon but loses to Glass Cannon. Prestige Rusher goes 50-55% against everyone, creating consistent win rate that compounds into rapid prestige accumulation.

**The Prestige Optimization Strategy**:

Prestige Rusher isn't just about winning battles - it's about maximizing prestige gains per unit time:

**Prestige Sources**:
1. **Battle Victories**: Primary prestige source. Each win grants prestige based on league tier (Bronze: 5 prestige, Silver: 10 prestige, Gold: 20 prestige, Platinum: 30 prestige, Diamond: 50 prestige, Champion: 75 prestige).
2. **League Advancement**: Bonus prestige for reaching new league tiers.
3. **Tournaments**: High prestige rewards for tournament participation and victories (requires Booking Office facility).
4. **Achievements**: One-time prestige bonuses for milestones (100 wins, 500 wins, etc.).
5. **Win Streaks**: Bonus prestige for consecutive victories.

**Optimization Tactics**:

**Tactic 1: Rapid League Advancement**
- Your win-optimized build ensures 52-58% win rate across all leagues
- Consistent wins = faster league advancement
- Higher leagues = more prestige per win (Gold gives 4× Bronze prestige per win)
- Goal: Reach Gold within 8-12 weeks, Platinum within 16-20 weeks

**Tactic 2: Battle Frequency**
- More battles = more prestige opportunities
- Your balanced build keeps repair costs moderate (₡12-18K per loss)
- Sustainable economics allow high battle frequency (10-15 battles/week)
- Goal: Maximize battles per week without risking bankruptcy

**Tactic 3: Tournament Participation**
- Tournaments provide massive prestige rewards (100-500 prestige per tournament)
- Requires Booking Office facility (₡400,000) to access tournaments
- Your win-optimized build maximizes tournament performance
- Goal: Participate in 1-2 tournaments per month once Booking Office is purchased

**Tactic 4: Win Streak Maintenance**
- Win streaks provide bonus prestige (10% bonus at 3-win streak, 25% bonus at 5-win streak, 50% bonus at 10-win streak)
- Your consistent 52-58% win rate creates frequent win streaks
- Goal: Maintain 3-5 win streaks regularly, occasionally hitting 10+ win streaks

**Tactic 5: Achievement Hunting**
- Achievements provide one-time prestige bonuses (50-200 prestige each)
- Your high battle frequency naturally completes achievements (100 wins, 500 wins, 1000 wins)
- Goal: Complete all battle-related achievements through consistent play

**The Prestige Compound Effect**:

Prestige unlocks content and bonuses that accelerate future prestige gains:

**Prestige Milestone: 1,000 Prestige** (Week 8-12)
- Unlocks: Advanced weapons, higher-tier facilities
- Bonus: +5% battle income
- Impact: Faster economic growth, better equipment access

**Prestige Milestone: 5,000 Prestige** (Week 20-30)
- Unlocks: Premium weapons, elite facilities, merchandising income
- Bonus: +10% battle income, +5% prestige gains
- Impact: Significantly faster progression, passive income streams

**Prestige Milestone: 10,000 Prestige** (Week 40-60)
- Unlocks: Legendary weapons, max-tier facilities, streaming revenue
- Bonus: +20% battle income, +10% prestige gains
- Impact: Exponential growth, elite content access

**Prestige Milestone: 25,000+ Prestige** (Week 80-120)
- Unlocks: All content, competitive tournaments, champion-tier rewards
- Bonus: +30% battle income, +20% prestige gains
- Impact: Maximum progression speed, elite competitive access

**Why Prestige Matters**:

Prestige is the ultimate long-term currency because it provides:
- **Content Unlocks**: Access to weapons, facilities, and systems unavailable to low-prestige players
- **Economic Bonuses**: Income multipliers that compound over time (+5% → +10% → +20% → +30%)
- **Prestige Multipliers**: Prestige gains accelerate as you earn more prestige (+5% → +10% → +20%)
- **Competitive Access**: High-prestige tournaments with massive rewards
- **Status and Recognition**: Prestige is visible to other players, signaling your dedication and skill

A player with 10,000 prestige earns 20% more income and 10% more prestige than a player with 1,000 prestige. This compounds exponentially - the rich get richer, and Prestige Rusher is designed to get rich fast.

**League Scaling and Risk Profile**:

- **Bronze League**: Medium-high risk. With income at ₡5-10K per win and moderate repair costs (₡12-18K per loss), you need 54-58% win rate to stay profitable. Your win-optimized build should achieve this, but Bronze is still challenging. The key is advancing quickly - every week in Bronze is a week not earning Gold-tier prestige. Goal: Escape Bronze within 3-4 weeks maximum.

- **Silver League**: Medium risk. Income doubles to ₡10-20K per win while repair costs remain stable at ₡12-18K per loss. At 52-56% win rate, you're profitable and accumulating prestige at 2× Bronze rate. Still not ideal - you want to reach Gold. Goal: Advance to Gold within 8-12 weeks total (4-8 weeks in Silver).

- **Gold League and Beyond**: Low-medium risk. With income at ₡20-40K per win and repair costs still ₡12-18K per loss, you're highly profitable at 50-54% win rate. More importantly, you're earning 4× Bronze prestige per win (20 prestige vs 5 prestige). This is where Prestige Rusher thrives - sustainable economics + maximum prestige gains. Goal: Maintain Gold+ status permanently, push for Platinum/Diamond.

**Critical - Must Advance Leagues Quickly**:

Prestige Rusher's entire strategy depends on rapid league advancement. Here's why:

**Time Value of Prestige**:

**Scenario A: Slow Advancement** (Typical player)
- Weeks 1-8: Bronze (5 prestige/win, 50% win rate, 7 battles/week)
  - Total prestige: 8 weeks × 3.5 wins/week × 5 prestige = 140 prestige
- Weeks 9-20: Silver (10 prestige/win, 50% win rate, 7 battles/week)
  - Total prestige: 12 weeks × 3.5 wins/week × 10 prestige = 420 prestige
- Weeks 21-40: Gold (20 prestige/win, 50% win rate, 7 battles/week)
  - Total prestige: 20 weeks × 3.5 wins/week × 20 prestige = 1,400 prestige
- **Total after 40 weeks: 1,960 prestige**

**Scenario B: Rapid Advancement** (Prestige Rusher)
- Weeks 1-4: Bronze (5 prestige/win, 56% win rate, 10 battles/week)
  - Total prestige: 4 weeks × 5.6 wins/week × 5 prestige = 112 prestige
- Weeks 5-12: Silver (10 prestige/win, 54% win rate, 10 battles/week)
  - Total prestige: 8 weeks × 5.4 wins/week × 10 prestige = 432 prestige
- Weeks 13-40: Gold (20 prestige/win, 52% win rate, 12 battles/week)
  - Total prestige: 28 weeks × 6.24 wins/week × 20 prestige = 3,494 prestige
- **Total after 40 weeks: 4,038 prestige** (2× Scenario A!)

**The Difference**:
- Prestige Rusher reaches Gold in 12 weeks vs 20 weeks (8-week advantage)
- Those 8 extra weeks in Gold = 8 weeks × 6.24 wins/week × 20 prestige = 998 extra prestige
- Higher win rate (52-56% vs 50%) = more wins per week = more prestige
- Higher battle frequency (10-12 battles/week vs 7) = more prestige opportunities
- Result: 2× prestige accumulation over same time period

**Why This Matters**:

Reaching 5,000 prestige unlocks +10% battle income and +5% prestige gains. Prestige Rusher reaches this milestone in ~25 weeks. Typical player reaches it in ~50 weeks. That's 25 weeks of earning +10% income and +5% prestige that typical player doesn't get. This compounds exponentially - Prestige Rusher at week 100 might have 15,000 prestige while typical player has 6,000 prestige.

**The League Advancement Imperative**:

For Prestige Rusher, league advancement isn't just about income (like other archetypes) - it's about prestige accumulation rate. Every week you spend in Bronze/Silver is a week you're not earning Gold/Platinum prestige rates. Your entire strategy revolves around:

1. **Win-Optimized Build**: Maximize win rate to advance leagues quickly
2. **High Battle Frequency**: More battles = faster league advancement
3. **Consistent Performance**: Avoid losing streaks that delay advancement
4. **Strategic Focus**: Prioritize league advancement over short-term economic optimization

If you're not advancing leagues quickly, you're not playing Prestige Rusher correctly. This archetype is all about speed - speed to Gold, speed to Platinum, speed to 5,000 prestige, speed to 10,000 prestige. Slow and steady loses the prestige race.

**Personality Fit**: 

Prestige Rusher is ideal for players who:
- Enjoy competitive progression systems and long-term goals
- Appreciate optimization and efficiency (maximizing prestige per unit time)
- Value unlocks, content access, and progression milestones
- Have a competitive mindset focused on winning consistently
- Think in terms of months and years, not days and weeks
- Find satisfaction in climbing leaderboards and earning prestige
- Enjoy the meta-game of build optimization for maximum win rate
- Want to access elite content and competitive tournaments
- Appreciate compound growth and exponential progression
- Are willing to sacrifice playstyle preference for optimal performance
- View Armoured Souls as a long-term competitive journey

**Recommended For**:
- Competitive players who enjoy ranked systems and progression
- Those who appreciate efficiency optimization and min-maxing
- Players who think long-term (months/years ahead)
- Anyone motivated by unlocks, achievements, and milestones
- Skilled players confident in maintaining 52-58% win rate
- Those who enjoy the prestige/reputation meta-game
- Players who want to access elite content and tournaments
- Anyone who finds satisfaction in climbing competitive ladders

**Not Recommended For**:
- Casual players who don't care about prestige or progression
- Those who prefer playstyle fantasy over optimal performance (if you want to play Tank Fortress for thematic reasons, play Tank Fortress - don't force yourself into Prestige Rusher)
- Players who dislike competitive pressure or win rate optimization
- Anyone uncomfortable with medium-high risk in Bronze (requires 54-58% win rate)
- Those who prefer specialized builds over balanced "meta" builds
- Players who want immediate gratification (prestige benefits take weeks/months to compound)
- Anyone who dislikes the idea of "chasing the meta" or optimizing for win rate

**Strategic Focus**:

The Prestige Rusher strategy revolves around maximizing prestige accumulation rate through consistent wins and rapid league advancement:

1. **Optimize for Win Rate**: Your primary goal is maintaining 52-58% win rate across all leagues. Every percentage point of win rate translates to faster league advancement and more prestige. Build decisions, attribute investments, and tactical choices should prioritize win probability over playstyle preference.

2. **Advance Leagues Aggressively**: Don't settle in Bronze or Silver. Your goal is to reach Gold within 12 weeks, Platinum within 20 weeks. Every week in lower leagues is lost prestige opportunity. Battle frequently (10-12 battles/week) to accelerate league advancement.

3. **Maintain High Battle Frequency**: More battles = more wins = more prestige = faster league advancement. Your balanced build keeps repair costs moderate (₡12-18K per loss), allowing sustainable high battle frequency. Don't hoard credits - invest in battles.

4. **Invest in Booking Office**: Once you reach Gold and have ₡400,000+ reserves, purchase Booking Office (₡400,000) to access tournaments. Tournaments provide massive prestige rewards (100-500 prestige per tournament) that accelerate your progression. This is your key mid-game facility investment.

5. **Pursue Win Streaks**: Win streaks provide bonus prestige (10% at 3-win streak, 25% at 5-win streak, 50% at 10-win streak). Your consistent 52-58% win rate creates frequent 3-5 win streaks. Don't take unnecessary risks that break streaks, but don't play overly conservative either - maintain your optimal win rate.

6. **Complete Achievements**: Achievements provide one-time prestige bonuses (50-200 prestige each). Your high battle frequency naturally completes battle-related achievements (100 wins, 500 wins, 1000 wins). Don't go out of your way to achievement hunt, but be aware of achievement progress and complete easy ones opportunistically.

7. **Adapt to Meta**: Your win-optimized build should adapt to the current competitive meta. If Tank Fortress becomes popular, adjust your build to counter it (more Penetration). If Glass Cannon dominates, invest in Hull Integrity and Armor Plating. Flexibility and pragmatism over rigid build plans.

8. **Leverage Prestige Bonuses**: As you reach prestige milestones (1,000 → 5,000 → 10,000), you unlock income bonuses (+5% → +10% → +20%) and prestige multipliers (+5% → +10%). These compound exponentially - the faster you reach milestones, the faster you reach subsequent milestones.

9. **Think Long-Term**: Prestige Rusher is a marathon, not a sprint. Your goal isn't to dominate week 1 - it's to reach 10,000+ prestige by week 60 and 25,000+ prestige by week 120. Make decisions that optimize long-term prestige accumulation, even if they sacrifice short-term economic gains.

10. **Stay Competitive**: Your win rate is your lifeline. If your win rate drops below 50%, diagnose the problem immediately (wrong attributes? bad matchups? need better weapons?). Adjust your build, study your losses, improve your tactics. Prestige Rusher requires consistent performance - you can't afford extended losing streaks.

**Why Prestige Rusher Works**:

The key insight is that prestige compounds exponentially through unlocks and bonuses. A player who reaches 5,000 prestige in 25 weeks earns +10% income and +5% prestige gains for the next 75 weeks. A player who reaches 5,000 prestige in 50 weeks only gets those bonuses for 50 weeks. The early bird gets exponentially more worms.

Additionally, prestige unlocks content that provides competitive advantages (better weapons, elite facilities) and economic advantages (merchandising, streaming revenue). By rushing prestige, you access these advantages earlier, creating a snowball effect where your early prestige gains accelerate future prestige gains.

**The Prestige Snowball**:
- Week 10: 200 prestige, earning 5-10 prestige/win
- Week 20: 800 prestige, earning 10-20 prestige/win (reached Silver/Gold)
- Week 30: 2,500 prestige, earning 20 prestige/win + 5% bonus = 21 prestige/win
- Week 40: 5,000 prestige, earning 20 prestige/win + 10% bonus = 22 prestige/win
- Week 60: 10,000 prestige, earning 20-30 prestige/win + 20% bonus = 24-36 prestige/win
- Week 100: 25,000+ prestige, earning 30-50 prestige/win + 30% bonus = 39-65 prestige/win

By week 100, you're earning 10× the prestige per win compared to week 10. This exponential growth is why Prestige Rusher focuses on rapid early advancement - the sooner you start the snowball, the bigger it gets.

**Competitive Focus**:

Prestige Rusher is fundamentally a competitive archetype. Your goal isn't just to play Armoured Souls - it's to excel at Armoured Souls, climb the prestige ladder, access elite content, and compete at the highest levels.

**Competitive Mindset**:
- **Win Rate Obsession**: You track your win rate, analyze losses, optimize builds for maximum win probability
- **Meta Awareness**: You understand the current competitive meta (which builds are popular, which strategies are dominant) and adapt accordingly
- **Efficiency Focus**: You maximize prestige per unit time, battle frequently, advance leagues aggressively
- **Long-Term Planning**: You think in terms of prestige milestones (1,000 → 5,000 → 10,000 → 25,000) and plan investments accordingly
- **Performance Analysis**: You study your battles, identify weaknesses, improve tactics, refine strategies
- **Competitive Drive**: You're motivated by climbing leaderboards, earning prestige, accessing elite content, competing in tournaments

**Competitive Goals**:
- **Short-Term** (Weeks 1-12): Reach Gold League, maintain 52-58% win rate, accumulate 500-1,000 prestige
- **Mid-Term** (Weeks 13-40): Reach Platinum League, purchase Booking Office, participate in tournaments, reach 5,000 prestige milestone
- **Long-Term** (Weeks 41-120): Reach Diamond/Champion League, compete in elite tournaments, reach 10,000-25,000 prestige, access all content

**Competitive Advantages**:
- **Early Prestige**: You reach prestige milestones weeks/months before typical players, unlocking bonuses earlier
- **Content Access**: You access elite weapons, facilities, and tournaments unavailable to low-prestige players
- **Economic Bonuses**: Your +10-20% income bonuses compound over time, creating massive economic advantages
- **Tournament Success**: Your win-optimized build maximizes tournament performance, earning massive prestige rewards
- **Reputation**: High prestige signals your skill and dedication, earning respect from other competitive players

**Quick Summary**:

Prestige Rusher is the competitive progression, long-term optimization archetype in Armoured Souls. If you're a competitive player who enjoys ranked systems, appreciates efficiency optimization, thinks months ahead, and finds satisfaction in climbing prestige ladders and unlocking elite content, this is your archetype. You'll build a win-optimized balanced robot (52-58% win rate target), advance leagues aggressively (Gold by week 12, Platinum by week 20), battle frequently (10-12 battles/week), invest in Booking Office for tournaments, and accumulate prestige at 2× the rate of typical players. Medium-high risk in Bronze (requires 54-58% win rate), medium risk in Silver, low-medium risk in Gold+. Critical requirement: you MUST advance leagues quickly - every week in Bronze/Silver is lost prestige opportunity. By week 40, you'll have 2× the prestige of typical players. By week 100, you'll have 3-4× the prestige, unlocking elite content and competitive opportunities unavailable to others. Perfect for competitive players who view Armoured Souls as a long-term journey where early optimization pays exponential dividends. Not for casual players or those who prioritize playstyle fantasy over optimal performance - this is the "win rate optimization" archetype for players who want to excel competitively and access endgame content as quickly as possible.

---

## Archetype Comparison Table

This table provides a quick side-by-side comparison of all 10 archetypes to help you choose the playstyle that best matches your preferences.

| Archetype | Build Style | Loadout | Risk Level | Resource Split | Best For |
|-----------|-------------|---------|------------|----------------|----------|
| **Tank Fortress** | Defensive powerhouse focused on survivability | Weapon+Shield | **Bronze:** Low<br>**Silver:** Very Low<br>**Gold:** Extremely Low | 45% Robot (defensive attributes)<br>25% Weapons (shield + weapon)<br>20% Facilities<br>10% Buffer | Players who enjoy defensive play, want low-risk sustainability, prefer attrition warfare, and value economic stability |
| **Glass Cannon** | Offensive powerhouse focused on maximum damage | Two-Handed | **Bronze:** High<br>**Silver:** Medium-High<br>**Gold:** Medium | 50% Robot (offensive attributes)<br>30% Weapon (premium two-handed)<br>15% Facilities<br>5% Buffer | Confident players who enjoy aggressive play, accept bankruptcy risk, prefer quick decisive battles, and want maximum damage output |
| **Speed Demon** | High-speed attacker focused on attack rate | Dual-Wield | **Bronze:** Medium<br>**Silver:** Low-Medium<br>**Gold:** Low | 40% Robot (speed/mobility attributes)<br>30% Weapons (two one-handed)<br>20% Facilities<br>10% Buffer | Players who enjoy fast-paced combat, value mobility and positioning, want consistent performance, and prefer DPS optimization |
| **Balanced Brawler** | Flexible all-rounder with no major weaknesses | Single | **Bronze:** Very Low<br>**Silver:** Very Low<br>**Gold:** Very Low | 40% Robot (balanced attributes)<br>20% Weapon (mid-tier)<br>25% Facilities<br>15% Buffer | New players learning the game, risk-averse players, those who value flexibility and adaptability, and anyone wanting the safest option |
| **Facility Investor** | Economic focus with heavy infrastructure investment | Single (budget) | **Bronze:** Low<br>**Silver:** Low<br>**Gold:** Very Low | 50% Facilities (Income Generator, Repair Bay, Training Facility)<br>30% Robot<br>15% Weapons<br>5% Buffer | Players who enjoy economic simulation, long-term planning, passive income strategies, and compound growth over time |
| **Two-Robot Specialist** | Dual robots with complementary specializations | Varied (per robot) | **Bronze:** Medium<br>**Silver:** Medium<br>**Gold:** Low-Medium | 55% Robots (2× ₡500K + upgrades)<br>25% Weapons (one per robot)<br>15% Facilities (Roster Expansion required)<br>5% Buffer | Players who enjoy variety, strategic matchup selection, portfolio management, and having tactical options for different opponents |
| **Melee Specialist** | Close-range powerhouse focused on Hydraulic Systems | Two-Handed melee or Weapon+Shield | **Bronze:** Medium-High<br>**Silver:** Medium<br>**Gold:** Low-Medium | 45% Robot (melee-focused attributes)<br>30% Weapon (premium melee)<br>20% Facilities<br>5% Buffer | Players who enjoy melee combat, positioning gameplay, high-impact strikes, and the fantasy of close-quarters brawling |
| **Ranged Sniper** | Precision ranged attacker focused on Targeting Systems | Two-Handed ranged | **Bronze:** Medium<br>**Silver:** Medium<br>**Gold:** Low | 45% Robot (accuracy/penetration attributes)<br>30% Weapon (premium ranged)<br>20% Facilities<br>5% Buffer | Players who enjoy precision gameplay, calculated strikes, ranged combat, and maintaining safe engagement distance |
| **AI Tactician** | Strategic optimizer focused on Combat Algorithms | Balanced (any loadout) | **Bronze:** Medium<br>**Silver:** Medium<br>**Gold:** Low | 45% Robot (AI attributes)<br>25% Weapon (mid-tier)<br>25% Facilities (AI Training Academy)<br>5% Buffer | Players who enjoy strategic depth, AI optimization, tactical gameplay, and outthinking opponents rather than overpowering them |
| **Prestige Rusher** | Competitive optimizer focused on rapid progression | Cost-effective (win-optimized) | **Bronze:** Medium-High<br>**Silver:** Medium<br>**Gold:** Low-Medium | 50% Robot (win-optimized attributes)<br>25% Weapons (efficient choices)<br>20% Facilities (Booking Office)<br>5% Buffer | Competitive players who enjoy ranked systems, efficiency optimization, long-term planning, and accessing elite content quickly |

### How to Use This Table

1. **Identify Your Playstyle**: Look at the "Build Style" and "Best For" columns to find archetypes that match your preferences
2. **Assess Risk Tolerance**: Check the "Risk Level" column to understand economic risk at different league tiers
3. **Review Resource Split**: See how each archetype allocates the ₡3,000,000 starting budget
4. **Consider Loadout Preference**: If you have a preferred weapon loadout type, filter by that column
5. **Read Full Archetype Details**: Once you've narrowed down to 2-3 options, read the full archetype sections above for detailed strategies

### Key Insights from the Comparison

**Safest Options** (Very Low Risk in Bronze):
- **Balanced Brawler** - Most forgiving, ideal for new players
- **Tank Fortress** - Low repair costs, sustainable economics

**Highest Risk/Reward** (High Risk in Bronze, transforms in Gold):
- **Glass Cannon** - Requires 55%+ win rate in Bronze, highly profitable in Gold
- **Prestige Rusher** - Requires consistent wins, rewards long-term optimization

**Consistent Performers** (Stable risk across leagues):
- **Speed Demon** - Medium risk in Bronze, smoothly scales to low risk in Gold
- **Balanced Brawler** - Very low risk everywhere, steady progression

**Economic Specialists**:
- **Facility Investor** - Highest facility investment (50%), focuses on passive income and cost reduction
- **Two-Robot Specialist** - Highest robot investment (55%), requires Roster Expansion facility

**Combat Specialists**:
- **Melee Specialist** - Focuses on Hydraulic Systems and close-range combat
- **Ranged Sniper** - Focuses on Targeting Systems and long-range precision
- **AI Tactician** - Focuses on Combat Algorithms and tactical decision-making

**League Advancement Dependency**:
- **High Dependency**: Glass Cannon, Prestige Rusher (must advance quickly to succeed)
- **Medium Dependency**: Speed Demon, Melee Specialist, Ranged Sniper (benefit from advancement but stable)
- **Low Dependency**: Tank Fortress, Balanced Brawler, Facility Investor (profitable at all tiers)

### Choosing Your Archetype

**If you're a new player**: Start with **Balanced Brawler** or **Tank Fortress**. Both are very forgiving and let you learn the game without bankruptcy pressure.

**If you're confident and aggressive**: Try **Glass Cannon** or **Speed Demon**. Both offer exciting combat with different risk profiles.

**If you enjoy economic strategy**: Choose **Facility Investor**. You'll build passive income and cost reduction infrastructure for long-term compound growth.

**If you want variety**: Pick **Two-Robot Specialist**. You'll have multiple robots with different builds for different situations.

**If you're competitive**: Select **Prestige Rusher**. You'll optimize for rapid progression and access elite content faster than other players.

**If you have a combat style preference**: Choose **Melee Specialist** (close-range brawling), **Ranged Sniper** (long-range precision), or **AI Tactician** (strategic optimization).

---

## Starting Budget Allocations

This section provides exact spending breakdowns for each archetype's ₡3,000,000 starting budget. Each allocation includes robot purchases, attribute upgrades, weapons, facilities, and reserve buffers with detailed cost calculations and strategic rationale.

**CRITICAL RULES FOR ALL ALLOCATIONS:**

1. **Attributes are CAPPED at level 10 without Training Academies**
2. **Training Academy Costs (CORRECTED)**:
   - Combat Training Academy Level 1: ₡200,000 (unlocks Combat attributes to level 15)
   - Defense Training Academy Level 1: ₡200,000 (unlocks Defense attributes to level 15)
   - Mobility Training Academy Level 1: ₡200,000 (unlocks Mobility attributes to level 15)
   - AI Training Academy Level 1: ₡250,000 (unlocks AI attributes to level 15)
3. **To upgrade ANY attribute above level 10, you MUST purchase the corresponding Training Academy FIRST**
4. **Each archetype must decide**: Buy Training Academies (expensive but allows higher attributes) OR stay at level 10 max (cheaper but weaker)

### 4.1 Tank Fortress - Starting Budget Allocation

**Total Budget**: ₡3,000,000

**CRITICAL DECISION**: Purchase Defense + Combat Training Academies (₡400,000 total) to unlock attributes above level 10, OR stay at level 10 cap with massive buffer

**Understanding Attribute Caps**:
- **WITHOUT Training Academies**: ALL attributes capped at level 10
- **WITH Defense Training Academy** (₡200,000): Defense attributes unlocked to level 15
- **WITH Combat Training Academy** (₡200,000): Combat attributes unlocked to level 15

#### Strategy A: With Training Academies (Recommended for Tank Fortress)

#### Facility Investments (REQUIRED - Purchase FIRST)

**Defense Training Academy Level 1** - ₡200,000
- **Purchase Cost**: ₡200,000
- **Operating Cost**: ₡400/day = ₡2,800/week
- **Benefit**: Unlocks Defense attributes cap from level 10 to level 15
- **Required for**: Hull Integrity, Armor Plating, Shield Capacity, Counter Protocols, Damage Control, Redundant Systems above level 10

**Combat Training Academy Level 1** - ₡200,000
- **Purchase Cost**: ₡200,000
- **Operating Cost**: ₡400/day = ₡2,800/week
- **Benefit**: Unlocks Combat attributes cap from level 10 to level 15
- **Required for**: Combat Power, Penetration, Critical Systems, Weapon Control, Hydraulic Systems, Targeting Systems above level 10

**Total Facility Cost: ₡400,000**
**Total Operating Costs: ₡5,600/week**

#### Robot Purchases

**1 Robot @ ₡500,000 = ₡500,000**

**Rationale**: Tank Fortress focuses on a single, highly-optimized defensive robot. Maximum investment in defensive attributes and premium weapons while maintaining economic sustainability.

#### Attribute Upgrades

**Focus Attributes** (Priority order):

1. **Hull Integrity** (Defense) - Primary survivability
2. **Armor Plating** (Defense) - Damage reduction
3. **Shield Capacity** (Defense) - Shield durability
4. **Counter Protocols** (Defense) - Counter-attack damage
5. **Combat Power** (Combat) - Offensive capability
6. **Damage Control** (Defense) - Critical hit protection
7. **Weapon Control** (Combat) - Weapon effectiveness

**Target Levels and Costs**:

| Attribute | Target Level | Cost Calculation | Total Cost |
|-----------|--------------|------------------|------------|
| Hull Integrity | 15 | Σ(level+1)×1,500 for levels 0-14 | ₡180,000 |
| Armor Plating | 14 | Σ(level+1)×1,500 for levels 0-13 | ₡157,500 |
| Shield Capacity | 14 | Σ(level+1)×1,500 for levels 0-13 | ₡157,500 |
| Counter Protocols | 12 | Σ(level+1)×1,500 for levels 0-11 | ₡117,000 |
| Combat Power | 12 | Σ(level+1)×1,500 for levels 0-11 | ₡117,000 |
| Damage Control | 10 | Σ(level+1)×1,500 for levels 0-9 | ₡82,500 |
| Weapon Control | 10 | Σ(level+1)×1,500 for levels 0-9 | ₡82,500 |

**Formula**: Cost = 1,500 × [N×(N+1)/2]

**Example Calculation for Hull Integrity (Level 15)**:
- Cost = 1,500 × [15×16/2] = 1,500 × 120 = ₡180,000

**Total Attribute Upgrade Cost: ₡894,000**

**Strategic Rationale**:
- **Hull Integrity at 15** provides **125 HP** (50 base + 15×5), making you very durable
- **Armor Plating at 14** provides significant damage reduction (~40%), lowering repair costs
- **Shield Capacity at 14** gives **28 shield points** (14×2), strong defensive buffer
- **Counter Protocols at 12** deals counter-attack damage (~30-35% of incoming damage)
- **Combat Power at 12** ensures your Power Sword strikes deal meaningful damage (~110-120 per hit)
- **Damage Control at 10** reduces critical hit damage by ~30%
- **Weapon Control at 10** improves weapon accuracy by ~30%

**Resulting Robot Stats**:
- **HP**: 125 (50 base + 15×5)
- **Shield**: 28 (14×2) + Combat Shield bonuses
- **Effective Durability**: ~180-200 effective HP after armor reduction
- **Counter-Attack Damage**: 30-35% of incoming damage returned
- **Offensive Power**: 110-120 damage per Power Sword strike

#### Weapon Purchases

**Main Weapon: Power Sword** - ₡350,000
- Type: Melee, One-handed
- Base Damage: 20, Cooldown: 3s, DPS: 6.67
- Bonuses: Hydraulic Systems +7, Counter Protocols +5, Gyro Stabilizers +4, Combat Power +3
- Rationale: Premium melee weapon with +5 Counter Protocols bonus that stacks with your Counter Protocols investment

**Offhand: Combat Shield** - ₡100,000
- Type: Shield
- Bonuses: Armor Plating +6, Counter Protocols +3, Shield Capacity +5, Evasion Thrusters -2
- Rationale: Essential for Weapon+Shield loadout (+10% defense bonus), provides +6 Armor Plating and +5 Shield Capacity

**Total Weapon Cost: ₡450,000**

**Weapon Synergy**: Power Sword + Combat Shield = +8 Counter Protocols total from weapons, combined with 12 attribute levels = 20 total Counter Protocols

#### Reserve Buffer

**Amount: ₡756,000**

**Purpose**:
- **Emergency repairs**: Covers ~80-90 losses at ₡8-9K per repair
- **Operating costs**: Covers ~135 weeks of Training Academy costs (₡5,600/week)
- **Large safety net**: Tank Fortress has lowest repair costs, so massive buffer is sustainable

**Buffer Management Strategy**:
- **Week 1**: Battle 5-7 times, expect 3-4 wins. Net income: ₡15-25K after repairs and operating costs
- **Week 2-4**: Buffer should grow to ₡800-850K
- **Month 2+**: Buffer should exceed ₡900K, consider facility upgrades or 2nd robot

**Bankruptcy Risk**: Extremely low. Would need 80+ consecutive losses.

#### Budget Summary (Strategy A: With Training Academies)

| Category | Amount | Percentage |
|----------|--------|------------|
| Robot Purchase | ₡500,000 | 16.67% |
| Facilities (Defense + Combat Academies) | ₡400,000 | 13.33% |
| Attribute Upgrades | ₡894,000 | 29.80% |
| Weapons (Power Sword + Combat Shield) | ₡450,000 | 15.00% |
| Reserve Buffer | ₡756,000 | 25.20% |
| **Total Spent** | **₡2,244,000** | **74.80%** |
| **Remaining** | **₡756,000** | **25.20%** |

**Allocation Philosophy**: Tank Fortress balances Training Academy investment (₡400K) with massive safety buffer (₡756K). The ₡5,600/week operating cost is easily covered by low repair costs (₡8-9K per loss vs ₡15-20K for Glass Cannon).

**Key Insight**: By investing ₡400K in Training Academies, Tank Fortress unlocks defensive attributes to level 15, creating a robot with 125 HP, 28 shield, and 14 armor that reduces repair costs by ~40%. The ₡756K buffer provides extreme safety.

---

#### Strategy B: No Training Academies (Max Level 10 - Ultra-Safe Alternative)

If you prefer to avoid Training Academy costs and operating expenses:

**Robot Purchase**: ₡500,000
**Facilities**: ₡0 (no Training Academies)

**Attribute Upgrades** (all capped at level 10):

| Attribute | Target Level | Total Cost |
|-----------|--------------|------------|
| Hull Integrity | 10 | ₡82,500 |
| Armor Plating | 10 | ₡82,500 |
| Shield Capacity | 10 | ₡82,500 |
| Counter Protocols | 10 | ₡82,500 |
| Combat Power | 10 | ₡82,500 |
| Damage Control | 10 | ₡82,500 |
| Weapon Control | 10 | ₡82,500 |
| Redundant Systems | 10 | ₡82,500 |

**Total Attribute Upgrade Cost: ₡660,000** (8 attributes at level 10)

**Weapons**: Power Sword (₡350,000) + Combat Shield (₡100,000) = ₡450,000

#### Budget Summary (Strategy B: No Training Academies)

| Category | Amount | Percentage |
|----------|--------|------------|
| Robot Purchase | ₡500,000 | 16.67% |
| Facilities | ₡0 | 0.00% |
| Attribute Upgrades (all at level 10) | ₡660,000 | 22.00% |
| Weapons (Power Sword + Combat Shield) | ₡450,000 | 15.00% |
| Reserve Buffer | ₡1,390,000 | 46.33% |
| **Total Spent** | **₡1,610,000** | **53.67%** |
| **Remaining** | **₡1,390,000** | **46.33%** |

**Strategy B Benefits**:
- **Massive buffer**: ₡1.39M = 150+ repairs at ₡9K per loss
- **No operating costs**: Save ₡5,600/week permanently
- **Ultra-safe**: Virtually impossible to go bankrupt
- **Simpler management**: No facility costs to track

**Strategy B Drawbacks**:
- **Weaker robot**: 100 HP vs 125 HP, 20 shield vs 28 shield
- **Higher repair costs**: Less armor means ~15% higher repair costs per loss
- **Lower win rate**: Weaker stats mean slightly lower win rate (~48% vs 52%)

**Recommendation**: Use Strategy A (with Training Academies) for optimal Tank Fortress performance. The ₡756K buffer is more than sufficient given low repair costs, and the stronger robot pays for itself through better win rate and lower repair costs. Use Strategy B only if you're extremely risk-averse or want the simplest possible management.

---

### 4.2 Glass Cannon - Starting Budget Allocation

**Total Budget**: ₡3,000,000

**CRITICAL DECISION**: Purchase Combat Training Academy (₡200,000) to unlock Combat attributes above level 10

**Understanding Attribute Caps**:
- **WITHOUT Combat Training Academy**: ALL Combat attributes capped at level 10
- **WITH Combat Training Academy** (₡200,000): Combat attributes unlocked to level 15

Glass Cannon REQUIRES Combat Training Academy because the archetype's entire strategy depends on maximizing Combat Power, Critical Systems, and Penetration above level 10. Without it, you cannot build a true Glass Cannon.

#### Facility Investments (REQUIRED - Purchase FIRST)

**Combat Training Academy Level 1** - ₡200,000
- **Purchase Cost**: ₡200,000
- **Operating Cost**: ₡400/day = ₡2,800/week
- **Benefit**: Unlocks Combat attributes cap from level 10 to level 15
- **Required for**: Combat Power, Penetration, Critical Systems, Weapon Control, Hydraulic Systems, Targeting Systems above level 10

**Total Facility Cost: ₡200,000**
**Total Operating Costs: ₡2,800/week**

#### Robot Purchases

**1 Robot @ ₡500,000 = ₡500,000**

**Rationale**: Glass Cannon focuses on a single, hyper-optimized offensive robot designed to eliminate opponents before they can respond. All resources are concentrated into maximizing damage output through offensive attributes and a premium two-handed weapon.

#### Attribute Upgrades

**Focus Attributes** (Priority order):

1. **Combat Power** (Combat) - Primary damage stat
2. **Critical Systems** (Combat) - Burst damage potential
3. **Penetration** (Combat) - Armor bypass
4. **Weapon Control** (Combat) - Accuracy and effectiveness
5. **Targeting Systems** (Combat) - Precision (for ranged two-handed weapons)
6. **Hull Integrity** (Defense) - Minimal survivability

**Target Levels and Costs**:

| Attribute | Target Level | Cost Calculation | Total Cost |
|-----------|--------------|------------------|------------|
| Combat Power | 15 | Σ(level+1)×1,500 for levels 0-14 | ₡180,000 |
| Critical Systems | 15 | Σ(level+1)×1,500 for levels 0-14 | ₡180,000 |
| Penetration | 14 | Σ(level+1)×1,500 for levels 0-13 | ₡157,500 |
| Weapon Control | 13 | Σ(level+1)×1,500 for levels 0-12 | ₡136,500 |
| Targeting Systems | 12 | Σ(level+1)×1,500 for levels 0-11 | ₡117,000 |
| Hull Integrity | 10 | Σ(level+1)×1,500 for levels 0-9 | ₡82,500 |

**Formula**: Cost = 1,500 × [N×(N+1)/2]

**Example Calculation for Combat Power (Level 15)**:
- Cost = 1,500 × [15×16/2] = 1,500 × 120 = ₡180,000

**Total Attribute Upgrade Cost: ₡853,500**

**Strategic Rationale**:
- **Combat Power at 15** provides **125 damage** (50 base + 15×5), making you a high damage dealer in Bronze/Silver leagues
- **Critical Systems at 15** provides approximately 35-40% critical hit chance and 2-2.5× critical damage multiplier. Your crits will deal 250-315 damage
- **Penetration at 14** bypasses approximately 50-55% of enemy armor, ensuring your damage reaches their hull even against Tank Fortress builds
- **Weapon Control at 13** improves accuracy by approximately 35%, ensuring your strikes land consistently
- **Targeting Systems at 12** (for Plasma Cannon/Railgun) provides weapon-specific bonuses of approximately 30%
- **Hull Integrity at 10** provides **100 HP** (50 base + 10×5), which is minimal but sufficient to survive 1-2 hits

**Resulting Robot Stats**:
- **Damage Output**: 125 base + weapon bonuses = approximately 165-185 damage per hit
- **Critical Damage**: 330-460 damage on crits (35-40% chance)
- **HP**: 100 (minimal but acceptable for glass cannon strategy)
- **Armor Penetration**: 50-55% bypass
- **Accuracy**: 35% improved hit chance

This distribution creates an offensive powerhouse that can eliminate most opponents in 3-4 hits (2-3 hits if crits land).

#### Weapon Purchases

**Main Weapon: Plasma Cannon** - ₡500,000
- Type: Ranged, Two-handed
- Base Damage: 30, Cooldown: 5s, DPS: 6.0
- Bonuses: Combat Power +10, Penetration +8, Critical Systems +6, Targeting Systems +5
- Rationale: Premium two-handed ranged weapon that synergizes perfectly with Glass Cannon strategy. The +10 Combat Power and +6 Critical Systems bonuses stack with your massive attribute investments, creating devastating alpha strikes.

**Alternative Weapon Options**:

**Option 1: Railgun** (₡450,000) - Saves ₡50,000
- Type: Ranged, Two-handed
- Base Damage: 28, Cooldown: 5s, DPS: 5.6
- Bonuses: Penetration +10, Targeting Systems +8, Critical Systems +5, Combat Power +4
- Rationale: Slightly cheaper alternative with higher penetration focus. Best if facing many Tank Fortress opponents.

**Option 2: Heavy Hammer** (₡400,000) - Saves ₡100,000
- Type: Melee, Two-handed
- Base Damage: 25, Cooldown: 4s, DPS: 6.25
- Bonuses: Hydraulic Systems +10, Combat Power +8, Critical Systems +6, Penetration +4
- Rationale: Melee alternative with highest DPS. Requires closing distance (risky for glass cannon), but delivers devastating melee strikes.

**Recommendation**: Plasma Cannon for maximum safety (ranged) and highest burst damage potential. Railgun if you need extra penetration. Heavy Hammer only if you're skilled at melee positioning and want to save ₡100,000.

**Total Weapon Cost: ₡500,000**

**Weapon Synergy Analysis**:
- Plasma Cannon + 15 Combat Power + 15 Critical Systems = approximately 250 base damage, 500-625 crit damage
- The +10 Combat Power from weapon stacks additively with your 15 attribute levels = 25 total Combat Power
- The +6 Critical Systems from weapon stacks with your 15 attribute levels = 21 total Critical Systems
- Two-Handed loadout provides +20% damage bonus, multiplying your already massive damage
- Result: You can eliminate most Bronze/Silver opponents in 2-3 hits (if crits land)

#### Reserve Buffer

**Amount: ₡946,500**

**Purpose**:
- **Emergency repairs**: Covers approximately 55-65 losses at ₡15-17K per repair
- **Operating costs**: Covers ~340 weeks of Combat Training Academy costs (₡2,800/week)
- **Safety net**: Provides substantial cushion for Bronze league volatility

**Why Larger Buffer Than Original Glass Cannon?**

This corrected allocation has a much larger buffer (₡946K vs ₡60K in the incorrect version) because:

1. **Realistic attribute costs**: With attributes capped at level 15 (not level 30), we spend ₡853K on attributes instead of ₡2.14M
2. **Lower operating costs**: Only Combat Training Academy (₡2,800/week) instead of Training Facility (₡10,500/week)
3. **Safety first**: Even Glass Cannon needs a reasonable buffer for Bronze league volatility
4. **Flexibility**: Large buffer allows weapon experimentation or facility purchases later

**Buffer Management Strategy**:

- **Week 1**: Battle 7-10 times, expect 4-6 wins (55-60% target). Net income: ₡15-30K after repairs and operating costs
- **Week 2-4**: Buffer should grow to ₡980K-1.05M. Advance to Silver
- **Month 2+**: In Silver/Gold, buffer should exceed ₡1.1M. You're economically stable

**Bankruptcy Risk**: Low. Glass Cannon would need to lose 55-65 consecutive battles to face bankruptcy, which is statistically improbable.

#### Budget Summary

| Category | Amount | Percentage |
|----------|--------|------------|
| Robot Purchase | ₡500,000 | 16.67% |
| Facilities (Combat Training Academy) | ₡200,000 | 6.67% |
| Attribute Upgrades | ₡853,500 | 28.45% |
| Weapons (Plasma Cannon) | ₡500,000 | 16.67% |
| Reserve Buffer | ₡946,500 | 31.55% |
| **Total Spent** | **₡2,053,500** | **68.45%** |
| **Remaining** | **₡946,500** | **31.55%** |

**Allocation Philosophy**:

Glass Cannon allocates budget for maximum offensive power within realistic attribute caps:

- **28.45% on Attributes**: Heavy investment in offensive stats (all at level 12-15)
- **16.67% on Robot**: Standard robot purchase (₡500,000)
- **16.67% on Weapons**: Premium two-handed weapon (Plasma Cannon) for maximum damage
- **6.67% on Facilities**: Combat Training Academy to unlock attributes above level 10
- **31.55% Buffer**: Substantial safety net for Bronze league volatility

**Key Insight**: By investing ₡200K in Combat Training Academy, Glass Cannon unlocks offensive attributes to level 15, creating a robot with 125 Combat Power, 15 Critical Systems, and 14 Penetration that can eliminate opponents in 2-3 hits. The ₡946K buffer provides substantial safety for learning and Bronze league volatility.

---

### Speed Demon - Starting Budget Allocation

**Total Budget**: ₡3,000,000

#### Facility Purchases

**CRITICAL**: Speed Demon requires academy facilities to unlock higher attribute levels. Without these facilities, attributes are capped at level 10.

**Mobility Training Academy (Level 1)** - ₡200,000
- **Purpose**: REQUIRED to upgrade Attack Speed and Servo Motors above level 10
- **Unlock**: Enables mobility attributes up to level 15
- **Operating Cost**: ₡1,000/day (₡7,000/week)
- **Rationale**: Speed Demon's core strategy depends on high Attack Speed and Servo Motors. Without this academy, you're capped at level 10, which severely limits your attack frequency and mobility advantage.

**Combat Training Academy (Level 1)** - ₡200,000
- **Purpose**: REQUIRED to upgrade Combat Power and Weapon Control above level 10
- **Unlock**: Enables combat attributes up to level 15
- **Operating Cost**: ₡1,000/day (₡7,000/week)
- **Rationale**: Weapon Control is critical for accuracy with rapid attacks. Combat Power ensures each hit deals meaningful damage. Both are essential for Speed Demon effectiveness.

**Total Facility Cost: ₡400,000**
**Total Weekly Operating Cost: ₡14,000**

**Why These Academies Are Non-Negotiable**:

Speed Demon's entire strategy revolves around high Attack Speed (for attack frequency) and Weapon Control (for accuracy). Without academies:
- Attack Speed capped at 10 = only 1.5× attack frequency (instead of 2.5×)
- Weapon Control capped at 10 = 70% accuracy (instead of 85%+)
- Combat Power capped at 10 = 100 damage (instead of 125)
- Result: You lose 40-50% of your effectiveness, making Speed Demon unviable

The ₡400,000 investment is mandatory for this archetype to function.

#### Robot Purchases

**1 Robot @ ₡500,000 = ₡500,000**

**Rationale**: Speed Demon focuses on a single, highly-optimized speed-focused robot designed to overwhelm opponents through rapid dual-wield attacks and superior mobility. All resources are concentrated into maximizing attack speed, mobility attributes, and dual-wield weapon synergy. A single robot is sufficient for Bronze through Gold leagues, and you can expand later once your economic foundation is solid.

#### Weapon Purchases

**Main Weapon: Machine Gun** - ₡150,000
- Type: Ranged, One-handed
- Base Damage: 12, Cooldown: 2s, DPS: 6.0
- Bonuses: Attack Speed +6, Weapon Control +5, Targeting Systems +4, Penetration +3
- Rationale: Budget-friendly ranged weapon with excellent attack speed synergy. The +6 Attack Speed bonus stacks with your attribute levels, creating high attack frequency.

**Offhand: Machine Gun** - ₡150,000
- Type: Ranged, One-handed
- Base Damage: 12, Cooldown: 2s, DPS: 6.0
- Bonuses: Attack Speed +6, Weapon Control +5, Targeting Systems +4, Penetration +3
- Rationale: Second Machine Gun for dual-wield. Two Machine Guns = +12 Attack Speed total from weapon bonuses, stacking with your attribute levels for extreme speed.

**Total Weapon Cost: ₡300,000**

**Weapon Synergy Analysis**:
- Dual Machine Guns provide +12 Attack Speed and +10 Weapon Control from weapon bonuses
- These stack with your attribute levels for multiplicative effect
- Dual-Wield loadout provides +15% attack speed bonus
- Result: High attack frequency with good accuracy, overwhelming opponents through volume

#### Attribute Upgrades

**Budget Available for Attributes**:
```
Total Budget:           ₡3,000,000
- Robot:                  ₡500,000
- Facilities:             ₡400,000
- Weapons:                ₡300,000
- Reserve Buffer:          ₡10,000
= Available:           ₡1,790,000
```

**Focus Attributes** (Priority order):

1. **Attack Speed** (Mobility) - Primary stat for attack frequency
2. **Servo Motors** (Mobility) - Movement speed and positioning
3. **Weapon Control** (Combat) - Accuracy for rapid attacks
4. **Combat Power** (Combat) - Damage per hit
5. **Gyro Stabilizers** (Mobility) - Stability during rapid movement
6. **Hull Integrity** (Defense) - Basic survivability

**Target Levels and Costs**:

**Attribute Upgrade Cost Formula**:
```
Cost to upgrade from level N to N+1 = (N + 1) × ₡1,500
Total cost from level 1 to N = Σ(i=1 to N) (i × ₡1,500) = ₡1,500 × [N × (N + 1) / 2]
```

| Attribute | Target Level | Cost Calculation | Total Cost |
|-----------|--------------|------------------|------------|
| Attack Speed | 15 | ₡1,500 × (15 × 16 / 2) | ₡180,000 |
| Servo Motors | 15 | ₡1,500 × (15 × 16 / 2) | ₡180,000 |
| Weapon Control | 15 | ₡1,500 × (15 × 16 / 2) | ₡180,000 |
| Combat Power | 15 | ₡1,500 × (15 × 16 / 2) | ₡180,000 |
| Gyro Stabilizers | 14 | ₡1,500 × (14 × 15 / 2) | ₡157,500 |
| Hull Integrity | 14 | ₡1,500 × (14 × 15 / 2) | ₡157,500 |
| Reaction Time | 13 | ₡1,500 × (13 × 14 / 2) | ₡136,500 |
| Armor Plating | 13 | ₡1,500 × (13 × 14 / 2) | ₡136,500 |
| Evasion Systems | 12 | ₡1,500 × (12 × 13 / 2) | ₡117,000 |
| Targeting Systems | 12 | ₡1,500 × (12 × 13 / 2) | ₡117,000 |
| Penetration | 11 | ₡1,500 × (11 × 12 / 2) | ₡99,000 |
| Shield Capacity | 10 | ₡1,500 × (10 × 11 / 2) | ₡82,500 |

**Total Attribute Upgrade Cost: ₡1,723,500**

**Level Cap Explanation**:
- Mobility Training Academy Level 1 caps mobility attributes at 15
- Combat Training Academy Level 1 caps combat attributes at 15
- Attributes without academy requirements can reach level 10 without facilities
- This creates a natural progression: start with Level 1 academies (cap 15), upgrade to Level 2 later (cap 20)

**Strategic Rationale**:
- **Attack Speed at 15** provides approximately 150% attack frequency (50% faster than baseline). Combined with dual-wield (2 weapons) and loadout bonus (+15%), you'll attack approximately 3.5× more frequently than single-weapon builds.
- **Servo Motors at 15** provides strong movement speed and positioning control, allowing you to maintain optimal engagement distance and dodge attacks.
- **Weapon Control at 15** improves accuracy by approximately 35%, critical when you're attacking 3.5× more frequently (more attacks = more chances to miss without good accuracy).
- **Combat Power at 15** provides **125 damage** (50 base + 15×5), which is solid when multiplied by your attack frequency.
- **Gyro Stabilizers at 14** ensures your rapid attacks remain accurate even while moving at speed, preventing wasted attacks.
- **Hull Integrity at 14** provides **120 HP** (50 base + 14×5), which is moderate survivability - not as tanky as Tank Fortress but better than Glass Cannon.
- **Reaction Time at 13** improves responsiveness by approximately 30%, helping you react to opponent movements.
- **Armor Plating at 13** provides basic damage reduction to lower repair costs.
- **Evasion Systems at 12** helps you avoid incoming attacks through mobility.
- **Targeting Systems at 12** improves ranged accuracy for Machine Guns.
- **Penetration at 11** helps bypass enemy armor.
- **Shield Capacity at 10** provides minimal shield capability (not primary focus).

**Resulting Robot Stats**:
- **Attack Frequency**: 3.5× baseline (2 weapons × 1.5 speed × 1.15 loadout bonus)
- **Effective DPS**: 125 damage × 3.5 attacks = 437.5 DPS (strong sustained damage)
- **HP**: 120 (moderate survivability)
- **Movement Speed**: Strong (can control engagement distance)
- **Accuracy**: 35% improved (ensures rapid attacks land)

This distribution creates a speed-focused attacker that overwhelms opponents through high attack volume while maintaining enough mobility to avoid damage and enough HP to survive mistakes. The academy investments enable the attribute levels necessary for Speed Demon to function effectively.

#### Reserve Buffer

**Amount: ₡10,000**

**Purpose**:
- **Emergency repairs**: Covers approximately 1 loss at ₡12-14K per repair
- **Minimal safety net**: Provides small cushion for initial battles

**Why Small Buffer?**

Speed Demon has a minimal buffer because:

1. **Academy Investment**: ₡400,000 spent on required facilities leaves less for buffer
2. **Operating Costs**: ₡14,000/week in facility costs means you need to win battles quickly to stay profitable
3. **High Risk**: This archetype requires immediate success - you cannot afford extended losing streaks
4. **Quick Profitability**: With 50%+ win rate, you'll generate ₡15-25K/week net income to rebuild buffer

**Buffer Management Strategy**:

- **Week 1**: Battle 7 times, MUST achieve 4+ wins (55%+ target). Net income: ₡10-20K after repairs and operating costs.
- **Week 2-4**: Buffer should grow to ₡50-100K. Continue battling 7 times/week with 50%+ win rate.
- **Month 2+**: Buffer should exceed ₡150K. Consider upgrading academies to Level 2 (cap 20).

**Bankruptcy Risk**: Medium-High. Speed Demon has minimal buffer and high operating costs (₡14K/week). You need 50%+ win rate immediately to avoid bankruptcy. This is a high-risk archetype that requires strong performance from day one.

**Operating Cost Impact**:

Weekly operating costs (₡14,000) significantly impact profitability:

**Bronze League** (₡7,500 avg per win, ₡1,500 participation):
- 7 battles at 50% win rate: (3.5 × ₡7,500) + (7 × ₡1,500) = ₡36,750 gross income
- Repairs (3.5 losses × ₡13,000): ₡45,500
- Operating costs: ₡14,000
- **Net: -₡22,750/week** (UNPROFITABLE at 50% win rate!)

**Required Win Rate for Profitability**:
- Need approximately 55-60% win rate in Bronze to break even
- At 60% win rate: (4.2 × ₡7,500) + (7 × ₡1,500) - (2.8 × ₡13,000) - ₡14,000 = ₡7,400/week profit

**Silver League** (₡15,000 avg per win, ₡3,000 participation):
- 7 battles at 50% win rate: (3.5 × ₡15,000) + (7 × ₡3,000) = ₡73,500 gross income
- Repairs (3.5 losses × ₡13,000): ₡45,500
- Operating costs: ₡14,000
- **Net: ₡14,000/week** (PROFITABLE at 50% win rate)

**Key Insight**: Speed Demon is unprofitable in Bronze at 50% win rate due to operating costs. You MUST achieve 55-60% win rate or advance to Silver quickly. This makes Speed Demon a high-risk archetype that rewards skilled play but punishes average performance.

#### Budget Summary

| Category | Amount | Percentage |
|----------|--------|------------|
| Robot Purchase | ₡500,000 | 16.67% |
| Facilities (2 Academies) | ₡400,000 | 13.33% |
| Weapons (Dual Machine Guns) | ₡300,000 | 10.00% |
| Attribute Upgrades | ₡1,723,500 | 57.45% |
| Reserve Buffer | ₡10,000 | 0.33% |
| **Total Spent** | **₡2,933,500** | **97.78%** |
| **Remaining** | **₡66,500** | **2.22%** |

**Note**: The ₡66,500 remaining represents rounding in attribute calculations and provides a small additional buffer.

**Allocation Philosophy**:

Speed Demon allocates budget for academy-enabled speed optimization:

- **57.45% on Attributes**: Heavy investment in mobility and combat attributes up to academy caps
- **16.67% on Robot**: Standard robot purchase (₡500,000)
- **13.33% on Facilities**: REQUIRED academies to unlock attribute levels above 10
- **10.00% on Weapons**: Budget dual-wield weapons (2× Machine Guns)
- **0.33% Buffer**: Minimal safety net - high risk archetype

**Key Insight**: Speed Demon requires ₡400,000 in academy investments to function, leaving minimal buffer (₡10K). This creates a high-risk archetype that demands 55-60% win rate in Bronze to stay profitable. The academy operating costs (₡14K/week) add significant financial pressure, making this archetype unsuitable for risk-averse players or those learning the game. However, skilled players who can maintain high win rates will find Speed Demon highly effective, and profitability improves dramatically upon reaching Silver League.

---

**Focus Attributes** (Priority order):

1. **Attack Speed** (Mobility) - Primary stat for attack frequency
2. **Servo Motors** (Mobility) - Movement speed and positioning
3. **Gyro Stabilizers** (Mobility) - Stability during rapid movement
4. **Weapon Control** (Combat) - Accuracy for rapid attacks
5. **Combat Power** (Combat) - Damage per hit
6. **Reaction Time** (Mobility) - Responsiveness
7. **Hull Integrity** (Defense) - Moderate survivability

**Target Levels and Costs**:

| Attribute | Target Level | Cost Calculation | Total Cost |
|-----------|--------------|------------------|------------|
| Attack Speed | 28 | Σ(level+1)×1,500 for levels 0-27 | ₡609,000 |
| Servo Motors | 24 | Σ(level+1)×1,500 for levels 0-23 | ₡450,000 |
| Gyro Stabilizers | 22 | Σ(level+1)×1,500 for levels 0-21 | ₡379,500 |
| Weapon Control | 20 | Σ(level+1)×1,500 for levels 0-19 | ₡315,000 |
| Combat Power | 18 | Σ(level+1)×1,500 for levels 0-17 | ₡256,500 |
| Reaction Time | 16 | Σ(level+1)×1,500 for levels 0-15 | ₡204,000 |
| Hull Integrity | 16 | Σ(level+1)×1,500 for levels 0-15 | ₡204,000 |

**Total Attribute Upgrade Cost: ₡2,418,000**

**Strategic Rationale**:
- **Attack Speed at 28** provides approximately 180% attack frequency (80% faster than baseline). Combined with dual-wield (2 weapons) and loadout bonus (+15%), you'll attack approximately 4-5× more frequently than single-weapon builds.
- **Servo Motors at 24** provides exceptional movement speed and positioning control, allowing you to maintain optimal engagement distance and dodge attacks.
- **Gyro Stabilizers at 22** ensures your rapid attacks remain accurate even while moving at high speed, preventing wasted attacks.
- **Weapon Control at 20** improves accuracy by approximately 50%, critical when you're attacking 4-5× more frequently (more attacks = more chances to miss without good accuracy).
- **Combat Power at 18** provides **140 damage** (50 base + 18×5), which is moderate but sufficient when multiplied by your attack frequency.
- **Reaction Time at 16** improves responsiveness by approximately 40%, helping you react to opponent movements and adjust positioning mid-battle.
- **Hull Integrity at 16** provides **130 HP** (50 base + 16×5), which is moderate survivability - not as tanky as Tank Fortress (175 HP) but much better than Glass Cannon (110 HP).

**Resulting Robot Stats**:
- **Attack Frequency**: 4-5× baseline (2 weapons × 1.8 speed × 1.15 loadout bonus)
- **Effective DPS**: 140 damage × 4-5 attacks = 560-700 DPS (comparable to Glass Cannon's burst damage but sustained)
- **HP**: 130 (moderate survivability)
- **Movement Speed**: Exceptional (can control engagement distance)
- **Accuracy**: 50% improved (ensures rapid attacks land)

This distribution creates a speed-focused attacker that overwhelms opponents through sheer volume of attacks while maintaining enough mobility to avoid damage and enough HP to survive mistakes.

#### Weapon Purchases

**Main Weapon: Machine Gun** - ₡150,000
- Type: Ranged, One-handed
- Base Damage: 12, Cooldown: 2s, DPS: 6.0
- Bonuses: Attack Speed +6, Weapon Control +5, Targeting Systems +4, Penetration +3
- Rationale: Budget-friendly ranged weapon with excellent attack speed synergy. The +6 Attack Speed bonus stacks with your 28 attribute levels, creating extreme attack frequency.

**Offhand: Machine Gun** - ₡150,000
- Type: Ranged, One-handed
- Base Damage: 12, Cooldown: 2s, DPS: 6.0
- Bonuses: Attack Speed +6, Weapon Control +5, Targeting Systems +4, Penetration +3
- Rationale: Second Machine Gun for dual-wield. Two Machine Guns = +12 Attack Speed total from weapon bonuses, stacking with your 28 attribute levels for extreme speed.

**Total Weapon Cost: ₡300,000**

**Alternative Weapon Options**:

**Option 1: Dual Plasma Blades** (2× ₡200,000 = ₡400,000)
- Type: Melee, One-handed
- Base Damage: 15, Cooldown: 2.5s, DPS: 6.0
- Bonuses: Attack Speed +7, Hydraulic Systems +6, Gyro Stabilizers +5, Combat Power +4
- Rationale: Melee alternative with higher damage per hit and better Attack Speed bonuses (+14 total). Requires closing distance but delivers more damage. Costs ₡100,000 more.

**Option 2: Mixed Loadout** (Machine Gun ₡150,000 + Plasma Blade ₡200,000 = ₡350,000)
- Rationale: Versatility for different ranges. Machine Gun for ranged safety, Plasma Blade for melee power. Costs ₡50,000 more than dual Machine Guns.

**Recommendation**: Dual Machine Guns for budget efficiency (₡300,000) and ranged safety. Dual Plasma Blades if you can afford ₡100,000 more and are comfortable with melee. Mixed loadout for versatility.

**Weapon Synergy Analysis**:
- Dual Machine Guns + 28 Attack Speed + 20 Weapon Control = approximately 4-5× attack frequency with 90%+ hit rate
- The +12 Attack Speed from weapons stacks with your 28 attribute levels = 40 total Attack Speed
- Dual-Wield loadout provides +15% attack speed bonus, multiplying your already extreme speed
- Result: You attack so frequently that opponents struggle to respond, accumulating damage through volume

#### Reserve Buffer

**Amount: ₡282,000**

**Purpose**:
- **Emergency repairs**: Covers approximately 18-20 losses at ₡14-16K per repair
- **Experimentation fund**: Allows testing different weapons or tactics without bankruptcy risk
- **Safety net**: Provides substantial cushion for learning positioning and speed-focused gameplay

**Why Larger Buffer Than Glass Cannon?**

Speed Demon has a larger buffer than Glass Cannon (₡59,650) because:

1. **Learning Curve**: Speed-focused gameplay requires mastering positioning and mobility, which takes time
2. **Moderate Repair Costs**: With 130 HP and moderate defense, repair costs are ₡14-16K per loss (between Tank and Glass Cannon)
3. **Consistent Risk**: Unlike Glass Cannon (high risk in Bronze, low risk in Gold), Speed Demon maintains medium risk across all leagues
4. **No Operating Costs**: Speed Demon doesn't purchase facilities at start, so buffer is purely for repairs and experimentation
5. **Flexibility**: Large buffer allows trying different weapons (e.g., swapping Machine Guns for Plasma Blades) without financial stress

**Buffer Management Strategy**:

- **Week 1**: Battle 7 times, expect 3-4 wins (50-55% target). Net income: ₡15-25K after repairs.
- **Week 2-4**: Buffer should grow to ₡300-350K. Continue battling 7 times/week.
- **Month 2+**: Buffer should exceed ₡400K. Consider facility investments (Training Facility, Weapons Workshop).

**Bankruptcy Risk**: Low. Speed Demon would need to lose 18-20 consecutive battles to face bankruptcy, which is statistically improbable (0.0001% chance at 50% win rate).

#### Budget Summary

| Category | Amount | Percentage |
|----------|--------|------------|
| Robot Purchase | ₡500,000 | 16.67% |
| Attribute Upgrades | ₡2,418,000 | 80.60% |
| Weapons (Dual Machine Guns) | ₡300,000 | 10.00% |
| Facilities | ₡0 | 0.00% |
| Reserve Buffer | ₡282,000 | 9.40% |
| **Total Spent** | **₡2,718,000** | **90.60%** |
| **Remaining** | **₡282,000** | **9.40%** |

**Allocation Philosophy**:

Speed Demon allocates budget for speed optimization with safety:

- **80.60% on Attributes**: Heavy investment in mobility and attack speed attributes
- **16.67% on Robot**: Standard robot purchase (₡500,000)
- **10.00% on Weapons**: Budget dual-wield weapons (2× Machine Guns)
- **0.00% on Facilities**: No facilities at start, preserving budget for robot power and buffer
- **9.40% Buffer**: Substantial safety net for learning and experimentation

**Key Insight**: Speed Demon achieves extreme attack frequency (4-5× baseline) through heavy attribute investment (₡2.4M) while maintaining a large safety buffer (₡282K). The budget weapons (₡300K total) are sufficient because your strategy relies on attack volume, not individual hit damage.

---

### Balanced Brawler - Starting Budget Allocation

**Total Budget**: ₡3,000,000

#### Robot Purchases

**1 Robot @ ₡500,000 = ₡500,000**

**Rationale**: Balanced Brawler focuses on a single, well-rounded robot with no critical weaknesses. This allows balanced investment across all attribute categories while maintaining a large safety buffer for learning and experimentation. A single robot is sufficient for safe progression through Bronze, Silver, and Gold leagues.

#### Attribute Upgrades

**IMPORTANT**: Balanced Brawler stays at level 10 maximum for all attributes (no Training Academies purchased). This maximizes the safety buffer for new players while maintaining competent performance across all categories.

**Focus Attributes** (Balanced distribution across all categories, capped at level 10):

1. **Combat Power** (Combat) - Primary offensive stat
2. **Hull Integrity** (Defense) - Primary defensive stat
3. **Attack Speed** (Mobility) - Primary mobility stat
4. **Armor Plating** (Defense) - Secondary defense
5. **Weapon Control** (Combat) - Secondary offense
6. **Servo Motors** (Mobility) - Secondary mobility

**Target Levels and Costs**:

| Attribute | Target Level | Cost Calculation | Total Cost |
|-----------|--------------|------------------|------------|
| Combat Power | 10 | Σ(level+1)×1,500 for levels 0-9 | ₡82,500 |
| Hull Integrity | 10 | Σ(level+1)×1,500 for levels 0-9 | ₡82,500 |
| Attack Speed | 10 | Σ(level+1)×1,500 for levels 0-9 | ₡82,500 |
| Armor Plating | 10 | Σ(level+1)×1,500 for levels 0-9 | ₡82,500 |
| Weapon Control | 10 | Σ(level+1)×1,500 for levels 0-9 | ₡82,500 |
| Servo Motors | 10 | Σ(level+1)×1,500 for levels 0-9 | ₡82,500 |

**Total Attribute Upgrade Cost: ₡495,000**

**Strategic Rationale**:
- **Combat Power at 10** provides **100 damage** (50 base + 10×5), which is solid offensive capability for Bronze/Silver leagues.
- **Hull Integrity at 10** provides **100 HP** (50 base + 10×5), which is good survivability for early game.
- **Attack Speed at 10** provides decent attack frequency for consistent DPS.
- **Armor Plating at 10** provides approximately 30% damage reduction, lowering repair costs.
- **Weapon Control at 10** improves accuracy by approximately 25%, ensuring your attacks land consistently.
- **Servo Motors at 10** provides good movement speed and positioning control.

**Resulting Robot Stats**:
- **Damage Output**: 100 base + weapon bonuses = approximately 120-140 damage per hit
- **HP**: 100 (good survivability for Bronze/Silver)
- **Attack Frequency**: Baseline + 10% (decent DPS)
- **Damage Reduction**: 30% from armor (moderate repair costs)
- **Accuracy**: 25% improved hit chance

This distribution creates a well-rounded robot that's competent at everything: decent damage, decent defense, decent speed. No weaknesses, no extreme strengths. Most importantly, staying at level 10 avoids Training Academy costs and maximizes your safety buffer.

#### Weapon Purchases

**Main Weapon: Plasma Rifle** - ₡250,000
- Type: Ranged, One-handed
- Base Damage: 18, Cooldown: 3s, DPS: 6.0
- Bonuses: Combat Power +6, Targeting Systems +5, Weapon Control +4, Penetration +3
- Rationale: Versatile ranged weapon that works well with balanced attributes. Good damage, good accuracy, ranged safety. The +6 Combat Power and +4 Weapon Control bonuses complement your balanced build.

**Alternative Weapon Options**:

**Option 1: Power Sword** (₡200,000) - Saves ₡50,000
- Type: Melee, One-handed
- Rationale: Melee alternative with good damage. Saves ₡50,000 for larger buffer. Choose if you prefer melee combat.

**Option 2: Machine Gun** (₡150,000) - Saves ₡100,000
- Type: Ranged, One-handed
- Rationale: Budget option with high attack speed. Saves ₡100,000 for much larger buffer. Good for learning fundamentals.

**Recommendation**: Plasma Rifle for versatility and ranged safety. Power Sword if you prefer melee. Machine Gun if you want maximum buffer.

**Total Weapon Cost: ₡250,000**

#### Weapon Purchases

**Main Weapon: Plasma Rifle** - ₡250,000
- Type: Ranged, One-handed
- Base Damage: 18, Cooldown: 3s, DPS: 6.0
- Bonuses: Combat Power +6, Targeting Systems +5, Weapon Control +4, Penetration +3
- Rationale: Versatile ranged weapon that works well with balanced attributes. Good damage, good accuracy, ranged safety. The +6 Combat Power and +4 Weapon Control bonuses complement your balanced build.

**Alternative Weapon Options**:

**Option 1: Power Sword** (₡200,000) - Saves ₡50,000
- Type: Melee, One-handed
- Rationale: Melee alternative with good damage. Saves ₡50,000 for even larger buffer. Choose if you prefer melee combat.

**Option 2: Machine Gun** (₡150,000) - Saves ₡100,000
- Type: Ranged, One-handed
- Rationale: Budget option with high attack speed. Saves ₡100,000 for maximum buffer. Good for learning fundamentals.

**Recommendation**: Plasma Rifle for versatility and ranged safety. Power Sword if you prefer melee. Machine Gun if you want maximum buffer.

**Total Weapon Cost: ₡250,000**

#### Reserve Buffer

**Amount: ₡1,755,000**

**Purpose**:
- **Emergency repairs**: Covers approximately 140-175 losses at ₡10-12.5K per repair
- **Learning fund**: Massive cushion for mistakes, experimentation, and learning
- **Facility investments**: Can purchase Training Academies later if you want to push attributes above level 10
- **Weapon experimentation**: Can buy additional weapons to test different playstyles
- **Future expansion**: Can purchase second robot with Roster Expansion if desired

**Why Largest Buffer of Any Archetype?**

Balanced Brawler has the largest buffer because:

1. **New Player Focus**: This archetype is designed for new players who will make mistakes
2. **Learning Safety Net**: Massive buffer means bankruptcy is virtually impossible, removing economic pressure
3. **Experimentation Freedom**: Can try different weapons, tactics, and strategies without risk
4. **Facility Flexibility**: Can purchase Training Academies in weeks 4-8 once you understand which attributes to prioritize
5. **Psychological Comfort**: Knowing you have ₡1.755M in reserve reduces stress and allows focus on learning
6. **No Academy Costs**: By staying at level 10, you avoid ₡200-250K academy purchases and ₡2,800-7,000/week operating costs

**Buffer Management Strategy**:

- **Week 1**: Battle 5-7 times, expect 2-4 wins (50% target). Net income: ₡10-20K after repairs.
- **Week 2-4**: Buffer should grow to ₡1.8-1.85M. Continue battling, learn game mechanics.
- **Month 2+**: Buffer should exceed ₡1.9M. Consider purchasing Training Academies to unlock attributes above level 10.

**Bankruptcy Risk**: Virtually zero. Balanced Brawler would need to lose 140-175 consecutive battles to face bankruptcy, which is statistically impossible.

#### Budget Summary

| Category | Amount | Percentage |
|----------|--------|------------|
| Robot Purchase | ₡500,000 | 16.67% |
| Attribute Upgrades | ₡495,000 | 16.50% |
| Weapons (Plasma Rifle) | ₡250,000 | 8.33% |
| Facilities | ₡0 | 0.00% |
| Reserve Buffer | ₡1,755,000 | 58.50% |
| **Total Spent** | **₡1,245,000** | **41.50%** |
| **Remaining** | **₡1,755,000** | **58.50%** |

**Allocation Philosophy**:

Balanced Brawler allocates budget for maximum safety and learning:

- **16.50% on Attributes**: Minimal investment staying at level 10 cap (no academies needed)
- **16.67% on Robot**: Standard robot purchase (₡500,000)
- **8.33% on Weapons**: Mid-tier weapon (Plasma Rifle)
- **0.00% on Facilities**: No facilities at start, preserving maximum flexibility
- **58.50% Buffer**: Largest buffer of any archetype for maximum safety

**Key Insight**: Balanced Brawler sacrifices optimization for safety. By staying at level 10 for all attributes (avoiding Training Academy costs), you spend only 41.5% of budget, keeping 58.5% in reserve. This makes it the safest, most forgiving archetype for new players. You can always purchase Training Academies later once you understand which attributes to prioritize.

---

### Facility Investor - Starting Budget Allocation

**Total Budget**: ₡3,000,000

#### Robot Purchases

**1 Robot @ ₡500,000 = ₡500,000**

**Rationale**: Facility Investor focuses on minimal robot investment (just enough to compete in Bronze/Silver) while directing maximum resources toward infrastructure. Your robot stays at level 10 for all attributes (no Training Academies), keeping it "good enough" to maintain 45-50% win rate while your facilities compound their benefits over time.

#### Facility Investments (Purchase FIRST)

**Income Generator Level 1** - ₡800,000

**Facility Details**:
- **Purchase Cost**: ₡800,000
- **Operating Cost**: ₡1,000/day = ₡7,000/week
- **Benefit**: Passive income (₡5,000/day base, scales with prestige)
- **Strategic Value**: Only income source that doesn't require winning battles

**ROI Analysis**:

At 0 prestige (game start):
- **Passive income**: ₡5,000/day = ₡35,000/week
- **Operating cost**: ₡7,000/week
- **Net income**: ₡35,000 - ₡7,000 = **₡28,000/week**
- **Payback period**: ₡800,000 ÷ ₡28,000 = 28.6 weeks (approximately 7 months)

**Why This Seems Like Bad ROI**:

7 months to break even seems terrible, but Income Generator's value comes from:

1. **Prestige Scaling**: As you earn prestige, passive income increases. At 5,000 prestige (achievable in 8-12 weeks), passive income becomes ₡6,250/day = ₡43,750/week, net ₡36,750/week. Payback period drops to 21.8 weeks (5.5 months).

2. **Passive Nature**: This income requires ZERO effort. You earn it while sleeping, working, or taking breaks. It's the only income source that doesn't require winning battles.

3. **Compound Growth**: As prestige increases, passive income grows exponentially. At 10,000 prestige (4-6 months), passive income is ₡7,500/day = ₡52,500/week, net ₡45,500/week.

4. **Long-Term Value**: Over 12 months, Income Generator generates approximately ₡1.5-2M in net income, far exceeding the ₡800K investment.

5. **Risk Reduction**: Passive income provides economic stability during losing streaks. Even if you lose every battle, you still earn ₡28K/week.

**Training Facility Level 1** - See [STABLE_SYSTEM.md](docs/prd_core/STABLE_SYSTEM.md) for pricing

**Facility Details**:
- **Purchase Cost**: ₡300,000
- **Operating Cost**: ₡1,500/day = ₡10,500/week
- **Benefit**: 5% discount on all attribute upgrades
- **Strategic Value**: Reduces cost of all future upgrades permanently

**ROI Analysis**:

With planned attribute spending of ₡495,000 (staying at level 10):
- **Savings**: ₡495,000 × 0.05 = ₡24,750
- **Operating cost**: ₡10,500/week × 52 weeks = ₡546,000/year
- **Net cost**: ₡546,000 - ₡24,750 = **-₡521,250/year** (negative ROI in year 1)

**Why Purchase Despite Negative ROI?**

Training Facility's value comes from long-term compounding:

1. **Future Upgrades**: You'll spend ₡1-2M on upgrades over 6-12 months (when you purchase Training Academies), saving ₡50-100K total
2. **Permanent Benefit**: The 5% discount applies to ALL future upgrades forever
3. **Scales with Activity**: As you upgrade more, savings increase while operating costs stay fixed
4. **Multi-Robot Value**: When you expand to 2-3 robots, upgrade costs multiply but discount applies to all

**Repair Bay Level 1** - ₡200,000

**Facility Details**:
- **Purchase Cost**: ₡200,000
- **Operating Cost**: ₡1,000/day = ₡7,000/week
- **Benefit**: 5% discount on all repairs
- **Strategic Value**: Reduces repair costs permanently

**ROI Analysis**:

At 7 battles/week with 50% win rate (3.5 losses/week):
- **Average repair cost per loss**: ₡10,000 (level 10 build)
- **Weekly repair spending**: 3.5 × ₡10,000 = ₡35,000
- **Savings from 5% discount**: ₡35,000 × 0.05 = ₡1,750/week
- **Operating cost**: ₡7,000/week
- **Net weekly cost**: ₡1,750 - ₡7,000 = **-₡5,250/week** (negative ROI)

**Why Purchase Despite Negative ROI?**

Repair Bay's value comes from scaling:

1. **Increased Battle Frequency**: As you battle more (10-15 battles/week), savings increase
2. **Multi-Robot Value**: When you expand to 2-3 robots, repair costs multiply but discount applies to all
3. **Long-Term Savings**: Over 12 months, saves ₡40-80K total
4. **Psychological Benefit**: Knowing repairs are discounted encourages more aggressive play

**Total Facility Cost: ₡1,300,000**

**Facility Purchase Order**:
1. **Income Generator Level 1** - Purchase first for passive income (see [STABLE_SYSTEM.md](docs/prd_core/STABLE_SYSTEM.md) for all facility pricing)
2. **Training Facility Level 1** - Purchase second for upgrade discounts
3. **Repair Bay Level 1** - Purchase third for repair discounts

#### Attribute Upgrades (with 5% Training Facility discount)

**IMPORTANT**: Facility Investor stays at level 10 maximum for all attributes (no Training Academies purchased). This minimizes robot investment while maximizing facility budget.

**Focus Attributes** (Minimal but balanced, capped at level 10):

| Attribute | Target Level | Base Cost | Discounted Cost (5% off) |
|-----------|--------------|-----------|--------------------------|
| Combat Power | 10 | ₡82,500 | ₡78,375 |
| Hull Integrity | 10 | ₡82,500 | ₡78,375 |
| Attack Speed | 10 | ₡82,500 | ₡78,375 |
| Armor Plating | 10 | ₡82,500 | ₡78,375 |
| Weapon Control | 10 | ₡82,500 | ₡78,375 |
| Servo Motors | 10 | ₡82,500 | ₡78,375 |

**Total Attribute Upgrade Cost: ₡470,250**

**Strategic Rationale**: Minimal investment to achieve 45-50% win rate in Bronze/Silver. Your robot is "good enough" but not optimized. The real investment is in facilities. By staying at level 10, you avoid Training Academy costs entirely.

#### Weapon Purchases

**Main Weapon: Machine Gun** - ₡150,000
- Type: Ranged, One-handed
- Rationale: Budget weapon that's sufficient for Bronze/Silver. Saves money for facility investments.

**Total Weapon Cost: ₡150,000**

#### Reserve Buffer

**Amount: ₡579,750**

**Purpose**: Covers approximately 50-60 repairs at ₡9.5-11.5K per repair and 23-24 weeks of facility operating costs (₡24,500/week total).

#### Budget Summary

| Category | Amount | Percentage |
|----------|--------|------------|
| Robot Purchase | ₡500,000 | 16.67% |
| Facilities (Income Generator + Training + Repair Bay) | ₡1,300,000 | 43.33% |
| Attribute Upgrades | ₡470,250 | 15.68% |
| Weapons (Machine Gun) | ₡150,000 | 5.00% |
| Reserve Buffer | ₡579,750 | 19.33% |
| **Total Spent** | **₡2,420,250** | **80.68%** |
| **Remaining** | **₡579,750** | **19.33%** |

**Allocation Philosophy**:

Facility Investor allocates budget for long-term infrastructure:

- **43.33% on Facilities**: Highest facility investment of any archetype
- **15.68% on Attributes**: Minimal investment staying at level 10 (no academies)
- **16.67% on Robot**: Standard robot purchase
- **5.00% on Weapons**: Budget weapon only
- **19.33% Buffer**: Moderate buffer given passive income

**Key Insight**: Facility Investor sacrifices immediate robot power for long-term economic engine. By staying at level 10 for all attributes (avoiding Training Academy costs), you maximize facility investment while maintaining a healthy buffer. By week 12-16, your facilities generate ₡10-20K/week in net value, funding rapid robot upgrades that catch you up to specialists.

---

### Two-Robot Specialist - Starting Budget Allocation

**Total Budget**: ₡3,000,000

#### Robot Purchases

**2 Robots @ ₡500,000 each = ₡1,000,000**

**Rationale**: Two-Robot Specialist requires two robots with complementary builds. The classic pairing is Tank (defensive) + Glass Cannon (offensive), giving you tactical flexibility to select the optimal robot for each matchup.

**Robot 1: Tank Build**
- Focus: Defense and survivability
- Role: Deploy against aggressive opponents, risky matchups, unknown opponents

**Robot 2: Glass Cannon Build**
- Focus: Offense and burst damage
- Role: Deploy against defensive opponents, favorable matchups, quick wins

#### Facility Investments (REQUIRED)

**Roster Expansion Level 1** - ₡300,000

**Facility Details**:
- **Purchase Cost**: ₡300,000 (REQUIRED to own 2+ robots)
- **Operating Cost**: ₡500/day per additional robot slot = ₡3,500/week for 2nd robot
- **Benefit**: Allows owning 2 robots (default is 1)
- **Strategic Value**: Hard requirement for Two-Robot Specialist archetype

**Why This Is Non-Negotiable**:

Roster Expansion is unique because it's not about ROI - it's a hard gate. You CANNOT own a 2nd robot without purchasing Roster Expansion Level 1. This makes Two-Robot Specialist inherently more expensive than single-robot archetypes.

**Total Facility Cost: ₡300,000**

**Note on Training Academies**: Two-Robot Specialist does NOT purchase Training Academies at game start. Both robots stay at level 10 maximum for all attributes to preserve budget for the second robot and weapons. This creates two moderately-powered robots rather than one highly-specialized robot.

#### Attribute Upgrades

**IMPORTANT**: Two-Robot Specialist stays at level 10 maximum for all attributes (no Training Academies purchased). This preserves budget for the second robot and weapons while maintaining competent performance.

**Robot 1 (Tank Build)** - Focus on defense (capped at level 10):

| Attribute | Target Level | Cost |
|-----------|--------------|------|
| Hull Integrity | 10 | ₡82,500 |
| Armor Plating | 10 | ₡82,500 |
| Shield Capacity | 10 | ₡82,500 |
| Counter Protocols | 10 | ₡82,500 |
| Combat Power | 10 | ₡82,500 |
| Damage Control | 8 | ₡54,000 |

**Robot 1 Total: ₡466,500**

**Robot 2 (Glass Cannon Build)** - Focus on offense (capped at level 10):

| Attribute | Target Level | Cost |
|-----------|--------------|------|
| Combat Power | 10 | ₡82,500 |
| Critical Systems | 10 | ₡82,500 |
| Penetration | 10 | ₡82,500 |
| Weapon Control | 10 | ₡82,500 |
| Hull Integrity | 8 | ₡54,000 |
| Armor Plating | 6 | ₡31,500 |

**Robot 2 Total: ₡415,500**

**Total Attribute Upgrade Cost: ₡882,000**

**Strategic Rationale**: Each robot is moderately specialized for its role while staying within level 10 caps. Robot 1 (Tank) has balanced defense for risky matchups. Robot 2 (Glass Cannon) has balanced offense for favorable matchups. Together, they provide tactical flexibility without the expense of Training Academies.

#### Weapon Purchases

**Robot 1 Weapons (Tank Build)**:
- **Power Sword** (₡200,000) + **Combat Shield** (₡100,000) = ₡300,000
- Rationale: Weapon+Shield loadout for defensive play

**Robot 2 Weapons (Glass Cannon Build)**:
- **Plasma Rifle** (₡250,000)
- Rationale: Versatile ranged weapon for offensive play

**Alternative: Budget Approach**
- Robot 1: Power Sword (₡200,000) + Combat Shield (₡100,000) = ₡300,000
- Robot 2: Machine Gun (₡150,000) instead of Plasma Rifle (₡250,000)
- Saves ₡100,000 for larger buffer

**Total Weapon Cost: ₡550,000** (or ₡450,000 with budget approach)

#### Reserve Buffer

**Amount: ₡768,000** (with Plasma Rifle) or **₡868,000** (with Machine Gun)

**Purpose**: 
- **Emergency repairs**: Covers approximately 65-80 losses at ₡9.5-11.5K per repair
- **Operating costs**: Covers approximately 220 weeks of Roster Expansion costs (₡3,500/week)
- **Flexibility**: Large buffer allows for Training Academy purchases later if desired
- **Learning cushion**: Provides safety net for learning two-robot tactics

**Why Moderate Buffer?**

Two-Robot Specialist has a moderate buffer because:

1. **Two-Robot Costs**: Operating two robots means double the repair costs when both are used
2. **Roster Expansion Operating Cost**: ₡3,500/week ongoing expense for the second robot slot
3. **Tactical Learning**: Need cushion while learning when to deploy each robot
4. **Future Flexibility**: Can purchase Training Academies later (weeks 8-12) once you understand which robot to specialize further

**Buffer Management Strategy**:

- **Week 1-4**: Use Tank robot primarily (lower repair costs), deploy Glass Cannon only for favorable matchups
- **Week 5-8**: Buffer should grow to ₡850-900K as you optimize robot selection
- **Month 3+**: Consider purchasing Combat or Defense Training Academy (₡200K) to specialize one robot further

**Bankruptcy Risk**: Low. Two-Robot Specialist would need to lose 65-80 consecutive battles to face bankruptcy, which is unlikely with proper robot selection.

#### Budget Summary

| Category | Amount | Percentage |
|----------|--------|------------|
| Robot Purchases (2 robots) | ₡1,000,000 | 33.33% |
| Facilities (Roster Expansion Level 1) | ₡300,000 | 10.00% |
| Attribute Upgrades (both robots) | ₡882,000 | 29.40% |
| Weapons (Power Sword + Shield + Plasma Rifle) | ₡550,000 | 18.33% |
| Reserve Buffer | ₡268,000 | 8.93% |
| **Total Spent** | **₡2,732,000** | **91.07%** |
| **Remaining** | **₡268,000** | **8.93%** |

**Allocation Philosophy**:

Two-Robot Specialist allocates budget for tactical versatility:

- **33.33% on Robots**: Two robots instead of one (₡1,000,000)
- **29.40% on Attributes**: Distributed across two moderately-specialized builds (capped at level 10)
- **18.33% on Weapons**: Three weapons total (one per robot + shield)
- **10.00% on Facilities**: Roster Expansion (required for second robot)
- **8.93% Buffer**: Moderate safety net for two-robot operations

**Key Insight**: Two-Robot Specialist is expensive (₡1.3M for robots + Roster Expansion before any upgrades) but provides tactical flexibility through matchup selection. By staying at level 10 for all attributes (no Training Academies), we preserve budget for the second robot while maintaining competent performance. Each robot is less optimized than single-robot specialists, but the ability to counter-pick opponents provides 3-5% win rate advantage.

---

### Melee Specialist - Starting Budget Allocation

**Total Budget**: ₡3,000,000

#### Robot Purchases

**1 Robot @ ₡500,000 = ₡500,000**

**Rationale**: Melee Specialist focuses on a single, highly-optimized melee powerhouse designed to dominate close combat through devastating Hydraulic Systems-boosted strikes. All resources are concentrated into maximizing melee damage and positioning capability.

#### Facility Investments (REQUIRED - Purchase FIRST)

**Combat Training Academy Level 1** - ₡200,000

**Facility Details**:
- **Purchase Cost**: ₡200,000
- **Operating Cost**: ₡400/day = ₡2,800/week
- **Benefit**: Unlocks Combat attributes cap from level 10 to level 15
- **Strategic Value**: Required for Hydraulic Systems, Combat Power, and other combat attributes above level 10

**Mobility Training Academy Level 1** - ₡200,000

**Facility Details**:
- **Purchase Cost**: ₡200,000
- **Operating Cost**: ₡400/day = ₡2,800/week
- **Benefit**: Unlocks Mobility attributes cap from level 10 to level 15
- **Strategic Value**: Required for Servo Motors and mobility attributes above level 10 (essential for closing distance)

**Total Facility Cost: ₡400,000**

**Why These Academies?**

Melee Specialist REQUIRES both Combat and Mobility Training Academies because:

1. **Hydraulic Systems** (Combat attribute) is the primary melee damage stat - needs to go above level 10
2. **Servo Motors** (Mobility attribute) is essential for closing distance quickly - needs to go above level 10
3. Without these academies, you're capped at level 10, which severely limits melee effectiveness

**Operating Cost**: ₡5,600/week total (₡2,800 + ₡2,800) for both academies

#### Attribute Upgrades

**Focus Attributes** (Priority order, with academy caps):

1. **Hydraulic Systems** (Combat) - Primary melee damage stat (capped at 15 with Combat Academy)
2. **Combat Power** (Combat) - Secondary damage stat (capped at 15 with Combat Academy)
3. **Servo Motors** (Mobility) - Closing distance (capped at 15 with Mobility Academy)
4. **Hull Integrity** (Defense) - Survivability during approach (capped at 10, no academy)
5. **Weapon Control** (Combat) - Melee accuracy (capped at 15 with Combat Academy)
6. **Armor Plating** (Defense) - Damage reduction (capped at 10, no academy)
7. **Critical Systems** (Combat) - Burst damage potential (capped at 15 with Combat Academy)

**Target Levels and Costs**:

| Attribute | Target Level | Cost Calculation | Total Cost |
|-----------|--------------|------------------|------------|
| Hydraulic Systems | 15 | Σ(level+1)×1,500 for levels 0-14 | ₡180,000 |
| Combat Power | 15 | Σ(level+1)×1,500 for levels 0-14 | ₡180,000 |
| Servo Motors | 15 | Σ(level+1)×1,500 for levels 0-14 | ₡180,000 |
| Hull Integrity | 10 | Σ(level+1)×1,500 for levels 0-9 | ₡82,500 |
| Weapon Control | 15 | Σ(level+1)×1,500 for levels 0-14 | ₡180,000 |
| Armor Plating | 10 | Σ(level+1)×1,500 for levels 0-9 | ₡82,500 |
| Critical Systems | 12 | Σ(level+1)×1,500 for levels 0-11 | ₡117,000 |

**Total Attribute Upgrade Cost: ₡1,002,000**

**Strategic Rationale**:
- **Hydraulic Systems at 15** provides massive melee damage multiplier (approximately 125% boost to melee weapons)
- **Combat Power at 15** provides **125 damage** (50 base + 15×5), which combines with Hydraulic Systems for devastating melee strikes
- **Servo Motors at 15** provides exceptional movement speed for closing distance quickly and maintaining melee range
- **Hull Integrity at 10** provides **100 HP** (50 base + 10×5), sufficient to survive the approach phase
- **Weapon Control at 15** improves melee accuracy by approximately 37.5%, ensuring your heavy strikes land
- **Armor Plating at 10** provides approximately 30% damage reduction, lowering repair costs
- **Critical Systems at 12** provides approximately 25-30% critical hit chance for devastating spike damage

**Resulting Robot Stats**:
- **Melee Damage**: 125 base × 2.25 Hydraulic multiplier = approximately 281 damage per melee hit
- **Critical Melee Damage**: 560-700 damage on crits (25-30% chance)
- **HP**: 100 (moderate survivability)
- **Movement Speed**: Exceptional (can close distance quickly)
- **Melee Accuracy**: 37.5% improved hit chance

This distribution creates a melee powerhouse that can eliminate most opponents in 2-3 melee hits (potentially one-shot with crits). Your challenge is closing distance without taking excessive damage.

#### Weapon Purchases

**Main Weapon: Heavy Hammer** - ₡400,000
- Type: Melee, Two-handed
- Base Damage: 25, Cooldown: 4s, DPS: 6.25
- Bonuses: Hydraulic Systems +10, Combat Power +8, Critical Systems +6, Penetration +4
- Rationale: Premium two-handed melee weapon that synergizes perfectly with Hydraulic Systems focus. The +10 Hydraulic Systems bonus stacks with your 15 attribute levels, creating extreme melee damage. Two-Handed loadout provides +20% damage bonus, further multiplying your already massive melee strikes.

**Alternative Weapon Options**:

**Option 1: Battle Axe** (₡350,000) - Saves ₡50,000
- Type: Melee, Two-handed
- Base Damage: 23, Cooldown: 4s, DPS: 5.75
- Bonuses: Hydraulic Systems +9, Combat Power +7, Penetration +6, Critical Systems +4
- Rationale: Slightly cheaper alternative with similar synergy. Saves ₡50,000 for larger buffer.

**Option 2: Power Sword + Combat Shield** (₡200,000 + ₡100,000 = ₡300,000) - Saves ₡100,000
- Rationale: Weapon+Shield loadout for more defensive melee play. Lower damage but better survivability. Saves ₡100,000 for much larger buffer.

**Recommendation**: Heavy Hammer for maximum melee damage. Battle Axe if you want to save ₡50,000. Power Sword + Shield if you prefer defensive melee play.

**Total Weapon Cost: ₡400,000**

**Weapon Synergy Analysis**:
- Heavy Hammer + 15 Hydraulic Systems + 15 Combat Power = approximately 280-320 damage per melee hit
- The +10 Hydraulic Systems from weapon stacks with your 15 attribute levels = 25 total Hydraulic Systems
- Two-Handed loadout provides +20% damage bonus, multiplying your already massive damage
- Result: You can eliminate most Bronze/Silver opponents in 2-3 melee hits

#### Reserve Buffer

**Amount: ₡698,000**

**Purpose**:
- **Emergency repairs**: Covers approximately 55-65 losses at ₡10.5-12.5K per repair
- **Operating costs**: Covers approximately 125 weeks of academy costs (₡5,600/week total)
- **Safety net**: Provides substantial cushion for learning melee positioning
- **Flexibility**: Can purchase additional facilities or weapons later

**Why Moderate Buffer?**

Melee Specialist has a moderate buffer because:

1. **Academy Operating Costs**: ₡5,600/week for both Combat and Mobility Training Academies
2. **Positioning Learning Curve**: Melee combat requires skill in closing distance and timing strikes
3. **Moderate Repair Costs**: ₡10.5-12.5K per loss (higher than Tank, lower than Glass Cannon)
4. **High Damage Output**: Your melee strikes end battles quickly, reducing damage taken

**Buffer Management Strategy**:

- **Week 1-4**: Practice melee positioning, expect 45-50% win rate while learning
- **Week 5-8**: Buffer should stabilize around ₡700-750K as you master melee tactics
- **Month 3+**: Consider purchasing Defense Training Academy (₡200K) to boost survivability

**Bankruptcy Risk**: Low-Medium. Melee Specialist would need to lose 55-65 consecutive battles to face bankruptcy, which is unlikely once you master positioning.

#### Budget Summary

| Category | Amount | Percentage |
|----------|--------|------------|
| Robot Purchase | ₡500,000 | 16.67% |
| Facilities (Combat + Mobility Academies) | ₡400,000 | 13.33% |
| Attribute Upgrades | ₡1,002,000 | 33.40% |
| Weapons (Heavy Hammer) | ₡400,000 | 13.33% |
| Reserve Buffer | ₡698,000 | 23.27% |
| **Total Spent** | **₡2,302,000** | **76.73%** |
| **Remaining** | **₡698,000** | **23.27%** |

**Allocation Philosophy**:

Melee Specialist allocates budget for maximum melee power with academy support:

- **33.40% on Attributes**: Heavy investment in Hydraulic Systems, Combat Power, and Servo Motors (capped at level 15 with academies)
- **16.67% on Robot**: Standard robot purchase
- **13.33% on Weapons**: Premium two-handed melee weapon
- **13.33% on Facilities**: Combat + Mobility Training Academies (₡400K total) to unlock attributes above level 10
- **23.27% Buffer**: Moderate buffer for learning melee positioning and covering academy operating costs

**Key Insight**: Melee Specialist achieves extreme melee damage (280-320 per hit) through focused Hydraulic Systems investment (level 15 = ₡180K) and premium melee weapon (₡400K). The Combat and Mobility Training Academies (₡400K total) are essential for unlocking attributes above level 10, enabling the melee-focused build. The positioning challenge is mitigated by high Servo Motors (level 15 = ₡180K) for closing distance quickly.

---

### Ranged Sniper - Starting Budget Allocation

**Total Budget**: ₡3,000,000

#### Robot Purchases

**1 Robot @ ₡500,000 = ₡500,000**

**Rationale**: Ranged Sniper focuses on a single, highly-optimized precision shooter designed to eliminate opponents from range through superior accuracy and armor penetration. All resources are concentrated into maximizing Targeting Systems, Penetration, and ranged weapon effectiveness.

#### Facility Investments (REQUIRED - Purchase FIRST)

**Combat Training Academy Level 1** - ₡200,000

**Facility Details**:
- **Purchase Cost**: ₡200,000
- **Operating Cost**: ₡400/day = ₡2,800/week
- **Benefit**: Unlocks Combat attributes cap from level 10 to level 15
- **Strategic Value**: Required for Targeting Systems, Penetration, Critical Systems, and other combat attributes above level 10

**Total Facility Cost: ₡200,000**

**Why Combat Training Academy?**

Ranged Sniper REQUIRES Combat Training Academy because:

1. **Targeting Systems** (Combat attribute) is the primary accuracy stat - needs to go above level 10
2. **Penetration** (Combat attribute) is essential for armor bypass - needs to go above level 10
3. **Critical Systems** (Combat attribute) enables precision critical hits - benefits from going above level 10
4. Without this academy, you're capped at level 10, which severely limits ranged effectiveness

**Operating Cost**: ₡2,800/week for Combat Training Academy

#### Attribute Upgrades

**Focus Attributes** (Priority order, with academy caps):

1. **Targeting Systems** (Combat) - Primary accuracy stat for ranged weapons (capped at 15 with Combat Academy)
2. **Penetration** (Combat) - Armor bypass (capped at 15 with Combat Academy)
3. **Critical Systems** (Combat) - Precision critical hits (capped at 15 with Combat Academy)
4. **Combat Power** (Combat) - Base damage (capped at 15 with Combat Academy)
5. **Weapon Control** (Combat) - Weapon effectiveness (capped at 15 with Combat Academy)
6. **Hull Integrity** (Defense) - Moderate survivability (capped at 10, no academy)
7. **Servo Motors** (Mobility) - Positioning and kiting (capped at 10, no academy)

**Target Levels and Costs**:

| Attribute | Target Level | Cost Calculation | Total Cost |
|-----------|--------------|------------------|------------|
| Targeting Systems | 15 | Σ(level+1)×1,500 for levels 0-14 | ₡180,000 |
| Penetration | 15 | Σ(level+1)×1,500 for levels 0-14 | ₡180,000 |
| Critical Systems | 15 | Σ(level+1)×1,500 for levels 0-14 | ₡180,000 |
| Combat Power | 15 | Σ(level+1)×1,500 for levels 0-14 | ₡180,000 |
| Weapon Control | 15 | Σ(level+1)×1,500 for levels 0-14 | ₡180,000 |
| Hull Integrity | 10 | Σ(level+1)×1,500 for levels 0-9 | ₡82,500 |
| Servo Motors | 10 | Σ(level+1)×1,500 for levels 0-9 | ₡82,500 |

**Total Attribute Upgrade Cost: ₡1,065,000**

**Strategic Rationale**:
- **Targeting Systems at 15** provides approximately 87.5%+ accuracy for ranged weapons, ensuring most shots land
- **Penetration at 15** bypasses approximately 50-60% of enemy armor, ensuring your damage reaches the hull even against Tank builds
- **Critical Systems at 15** provides approximately 37.5% critical hit chance and 2.5× critical damage multiplier
- **Combat Power at 15** provides **125 damage** (50 base + 15×5), which is solid when combined with high accuracy and penetration
- **Weapon Control at 15** improves weapon effectiveness by approximately 37.5%, further boosting ranged weapon performance
- **Hull Integrity at 10** provides **100 HP** (50 base + 10×5), which is moderate survivability
- **Servo Motors at 10** provides decent movement speed for maintaining optimal range and kiting melee opponents

**Resulting Robot Stats**:
- **Ranged Accuracy**: 87.5%+ hit chance (very high accuracy)
- **Armor Penetration**: 50-60% bypass
- **Critical Hit Chance**: 37.5%
- **Critical Damage**: 2.5× multiplier
- **Effective Damage**: 125 base × 0.875 accuracy × 1.375 crit average = approximately 150 damage per shot
- **HP**: 100 (moderate survivability)

This distribution creates a precision shooter that rarely misses, bypasses armor, and lands frequent critical hits. Your strategy is to eliminate opponents from range before they can close distance.

#### Weapon Purchases

**Main Weapon: Railgun** - ₡450,000
- Type: Ranged, Two-handed
- Base Damage: 28, Cooldown: 5s, DPS: 5.6
- Bonuses: Penetration +10, Targeting Systems +8, Critical Systems +5, Combat Power +4
- Rationale: Premium two-handed ranged weapon that synergizes perfectly with Ranged Sniper strategy. The +8 Targeting Systems and +10 Penetration bonuses stack with your attribute investments, creating high accuracy and armor bypass. Two-Handed loadout provides +20% damage bonus.

**Alternative Weapon Options**:

**Option 1: Plasma Cannon** (₡500,000) - Costs ₡50,000 more
- Type: Ranged, Two-handed
- Base Damage: 30, Cooldown: 5s, DPS: 6.0
- Bonuses: Combat Power +10, Penetration +8, Critical Systems +6, Targeting Systems +5
- Rationale: Higher damage alternative with better Combat Power and Critical Systems bonuses. Costs ₡50,000 more but delivers higher burst damage.

**Option 2: Sniper Rifle** (₡400,000) - Saves ₡50,000
- Type: Ranged, Two-handed
- Base Damage: 26, Cooldown: 5s, DPS: 5.2
- Bonuses: Targeting Systems +9, Penetration +7, Critical Systems +6, Combat Power +3
- Rationale: Slightly cheaper alternative with excellent Targeting Systems bonus. Saves ₡50,000 for larger buffer.

**Recommendation**: Railgun for best balance of damage, accuracy, and penetration. Plasma Cannon if you can afford ₡50,000 more for higher damage. Sniper Rifle if you want to save ₡50,000.

**Total Weapon Cost: ₡450,000**

**Weapon Synergy Analysis**:
- Railgun + 15 Targeting Systems + 15 Penetration = approximately 87.5%+ accuracy with 60%+ armor bypass
- The +8 Targeting Systems from weapon stacks with your 15 attribute levels = 23 total Targeting Systems
- The +10 Penetration from weapon stacks with your 15 attribute levels = 25 total Penetration
- Two-Handed loadout provides +20% damage bonus
- Result: Most shots land, bypass armor, and deal full damage

#### Reserve Buffer

**Amount: ₡785,000**

**Purpose**:
- **Emergency repairs**: Covers approximately 65-75 losses at ₡10.5-12K per repair
- **Operating costs**: Covers approximately 280 weeks of Combat Training Academy costs (₡2,800/week)
- **Safety net**: Provides substantial cushion for learning ranged tactics
- **Flexibility**: Can purchase additional facilities or weapons later

**Why Large Buffer?**

Ranged Sniper has a large buffer because:

1. **Ranged Safety**: Ranged combat is safer than melee, resulting in lower repair costs
2. **Single Academy**: Only Combat Training Academy (₡2,800/week) instead of multiple academies
3. **Learning Curve**: Ranged positioning is easier to learn than melee, reducing early losses
4. **Moderate Repair Costs**: ₡10.5-12K per loss (lower than Glass Cannon, similar to Balanced Brawler)

**Buffer Management Strategy**:

- **Week 1-4**: Practice ranged positioning, expect 50-55% win rate
- **Week 5-8**: Buffer should grow to ₡850-900K as you master ranged tactics
- **Month 3+**: Consider purchasing Mobility Training Academy (₡200K) to boost kiting ability

**Bankruptcy Risk**: Low. Ranged Sniper would need to lose 65-75 consecutive battles to face bankruptcy, which is very unlikely with ranged safety.

#### Budget Summary

| Category | Amount | Percentage |
|----------|--------|------------|
| Robot Purchase | ₡500,000 | 16.67% |
| Facilities (Combat Training Academy) | ₡200,000 | 6.67% |
| Attribute Upgrades | ₡1,065,000 | 35.50% |
| Weapons (Railgun) | ₡450,000 | 15.00% |
| Reserve Buffer | ₡785,000 | 26.17% |
| **Total Spent** | **₡2,215,000** | **73.83%** |
| **Remaining** | **₡785,000** | **26.17%** |

**Allocation Philosophy**:

Ranged Sniper allocates budget for precision and accuracy with academy support:

- **35.50% on Attributes**: Heavy investment in Targeting Systems, Penetration, and accuracy-focused attributes (capped at level 15 with Combat Academy)
- **16.67% on Robot**: Standard robot purchase
- **15.00% on Weapons**: Premium two-handed ranged weapon
- **6.67% on Facilities**: Combat Training Academy (₡200K) to unlock combat attributes above level 10
- **26.17% Buffer**: Large buffer for safety and flexibility

**Key Insight**: Ranged Sniper achieves high accuracy (87.5%+) and good armor penetration (50-60%) through focused Targeting Systems and Penetration investments (level 15 each = ₡180K each). The Combat Training Academy (₡200K) is essential for unlocking combat attributes above level 10. The ranged weapon (₡450K) keeps you safe while delivering precise, armor-piercing strikes. The large buffer (₡785K) provides excellent safety and flexibility.

---

### AI Tactician - Starting Budget Allocation

**Total Budget**: ₡3,000,000

#### Robot Purchases

**1 Robot @ ₡500,000 = ₡500,000**

**Rationale**: AI Tactician focuses on a single, highly-optimized AI-driven robot designed to win through superior decision-making and adaptive combat algorithms. All resources are concentrated into maximizing AI attributes and unlocking AI Training Academy for higher attribute caps.

#### Facility Investments (Purchase FIRST)

**AI Training Academy Level 1** - ₡250,000

**Facility Details**:
- **Purchase Cost**: ₡250,000
- **Operating Cost**: ₡500/day = ₡3,500/week
- **Benefit**: Unlocks AI attributes cap from level 10 to level 15
- **Strategic Value**: Required to invest in AI attributes above level 10

**Why Purchase AI Training Academy?**

AI Tactician's strategy revolves around high AI attribute levels. Without AI Training Academy, AI attributes are capped at level 10, which is insufficient for the archetype's strategy. By purchasing AI Training Academy Level 1, you unlock the ability to invest in AI attributes up to level 15, enabling the AI-focused build.

**ROI Analysis**:

This is not about ROI - it's about unlocking the archetype's core strategy. Without AI Training Academy, you cannot be an AI Tactician.

**Total Facility Cost: ₡250,000**

#### Attribute Upgrades

**Focus Attributes** (Priority order):

1. **Combat Algorithms** (AI) - Primary AI decision-making stat
2. **Threat Analysis** (AI) - Target prioritization
3. **Adaptive AI** (AI) - Learning and adaptation
4. **Logic Cores** (AI) - Processing power
5. **Combat Power** (Combat) - Base damage
6. **Hull Integrity** (Defense) - Survivability
7. **Weapon Control** (Combat) - Weapon effectiveness

**Target Levels and Costs**:

| Attribute | Target Level | Cost Calculation | Total Cost |
|-----------|--------------|------------------|------------|
| Combat Algorithms | 15 | Σ(level+1)×1,500 for levels 0-14 | ₡180,000 |
| Threat Analysis | 15 | Σ(level+1)×1,500 for levels 0-14 | ₡180,000 |
| Adaptive AI | 15 | Σ(level+1)×1,500 for levels 0-14 | ₡180,000 |
| Logic Cores | 15 | Σ(level+1)×1,500 for levels 0-14 | ₡180,000 |
| Combat Power | 20 | Σ(level+1)×1,500 for levels 0-19 | ₡315,000 |
| Hull Integrity | 18 | Σ(level+1)×1,500 for levels 0-17 | ₡256,500 |
| Weapon Control | 16 | Σ(level+1)×1,500 for levels 0-15 | ₡204,000 |

**Total Attribute Upgrade Cost: ₡1,495,500**

**Strategic Rationale**:
- **Combat Algorithms at 15** provides superior AI decision-making, optimizing attack timing, target selection, and tactical choices
- **Threat Analysis at 15** ensures your AI prioritizes the most dangerous targets and responds to threats optimally
- **Adaptive AI at 15** allows your robot to learn opponent patterns and adapt strategies mid-battle
- **Logic Cores at 15** provides processing power for complex calculations and multi-variable optimization
- **Combat Power at 20** provides **150 damage** (50 base + 20×5), which is solid offensive capability
- **Hull Integrity at 18** provides **140 HP** (50 base + 18×5), which is good survivability
- **Weapon Control at 16** improves weapon effectiveness by approximately 40%

**Resulting Robot Stats**:
- **AI Decision-Making**: Superior (optimizes all combat choices)
- **Target Prioritization**: Excellent (always attacks optimal target)
- **Adaptation**: High (learns opponent patterns)
- **Damage Output**: 150 base + weapon bonuses = approximately 180-200 damage per hit
- **HP**: 140 (good survivability)

This distribution creates an AI-driven robot that makes optimal decisions in every situation. Your AI attributes ensure you always attack the right target at the right time with the right tactics.

#### Weapon Purchases

**Main Weapon: Plasma Rifle** - ₡250,000
- Type: Ranged, One-handed
- Base Damage: 18, Cooldown: 3s, DPS: 6.0
- Bonuses: Combat Power +6, Targeting Systems +5, Weapon Control +4, Penetration +3
- Rationale: Versatile ranged weapon that works well with AI-focused build. The AI will optimize its usage based on combat situation.

**Alternative Weapon Options**:

**Option 1: Power Sword** (₡200,000) - Saves ₡50,000
- Type: Melee, One-handed
- Rationale: Melee alternative. Saves ₡50,000 for larger buffer.

**Option 2: Machine Gun** (₡150,000) - Saves ₡100,000
- Type: Ranged, One-handed
- Rationale: Budget option. Saves ₡100,000 for much larger buffer.

**Recommendation**: Plasma Rifle for versatility. Power Sword or Machine Gun if you want larger buffer.

**Total Weapon Cost: ₡250,000**

#### Reserve Buffer

**Amount: ₡504,500**

**Purpose**: Covers approximately 36-40 repairs at ₡13-14K per repair. Provides cushion for learning AI-focused gameplay and covers approximately 144 weeks of AI Training Academy operating costs (₡3,500/week).

#### Budget Summary

| Category | Amount | Percentage |
|----------|--------|------------|
| Robot Purchase | ₡500,000 | 16.67% |
| Facilities (AI Training Academy Level 1) | ₡250,000 | 8.33% |
| Attribute Upgrades | ₡1,495,500 | 49.85% |
| Weapons (Plasma Rifle) | ₡250,000 | 8.33% |
| Reserve Buffer | ₡504,500 | 16.82% |
| **Total Spent** | **₡2,495,500** | **83.18%** |
| **Remaining** | **₡504,500** | **16.82%** |

**Allocation Philosophy**:

AI Tactician allocates budget for AI optimization:

- **49.85% on Attributes**: Heavy investment in AI attributes (maxed at level 15 with Academy)
- **16.67% on Robot**: Standard robot purchase
- **8.33% on Facilities**: AI Training Academy (₡250K, required for AI attribute caps)
- **8.33% on Weapons**: Mid-tier versatile weapon
- **16.82% Buffer**: Moderate safety net for learning and covering academy operating costs

**Key Insight**: AI Tactician requires AI Training Academy (₡250K) to unlock AI attribute caps, making it more expensive than non-facility archetypes. The payoff is superior AI decision-making that optimizes every combat choice, providing consistent performance across all matchups. The moderate buffer (₡504.5K) provides good safety while covering the ₡3,500/week operating cost.

---

### Prestige Rusher - Starting Budget Allocation

**Total Budget**: ₡3,000,000

#### Robot Purchases

**1 Robot @ ₡500,000 = ₡500,000**

**Rationale**: Prestige Rusher focuses on a single, highly-optimized robot designed to maximize win rate and prestige accumulation. All resources are concentrated into creating the most competitive robot possible for consistent wins and rapid league advancement.

#### Facility Investments (REQUIRED - Purchase FIRST)

**Combat Training Academy Level 1** - ₡200,000

**Facility Details**:
- **Purchase Cost**: ₡200,000
- **Operating Cost**: ₡400/day = ₡2,800/week
- **Benefit**: Unlocks Combat attributes cap from level 10 to level 15
- **Strategic Value**: Required for Combat Power and other combat attributes above level 10

**Defense Training Academy Level 1** - ₡200,000

**Facility Details**:
- **Purchase Cost**: ₡200,000
- **Operating Cost**: ₡400/day = ₡2,800/week
- **Benefit**: Unlocks Defense attributes cap from level 10 to level 15
- **Strategic Value**: Required for Hull Integrity, Armor Plating, and other defense attributes above level 10

**Mobility Training Academy Level 1** - ₡200,000

**Facility Details**:
- **Purchase Cost**: ₡200,000
- **Operating Cost**: ₡400/day = ₡2,800/week
- **Benefit**: Unlocks Mobility attributes cap from level 10 to level 15
- **Strategic Value**: Required for Attack Speed and other mobility attributes above level 10

**Total Facility Cost: ₡600,000**

**Why All Three Academies?**

Prestige Rusher REQUIRES all three Training Academies because:

1. **Balanced Build**: The archetype optimizes for win rate, which requires balanced investment across Combat, Defense, and Mobility
2. **Attribute Caps**: Without these academies, all attributes are capped at level 10, which is insufficient for competitive play
3. **Win Rate Optimization**: Higher attribute levels across all categories create a well-rounded robot that wins consistently

**Operating Cost**: ₡8,400/week total (₡2,800 × 3) for all three academies

#### Attribute Upgrades

**Focus Attributes** (Optimized for win rate, with academy caps):

1. **Combat Power** (Combat) - Primary damage stat (capped at 15 with Combat Academy)
2. **Hull Integrity** (Defense) - Survivability (capped at 15 with Defense Academy)
3. **Attack Speed** (Mobility) - DPS through volume (capped at 15 with Mobility Academy)
4. **Armor Plating** (Defense) - Damage reduction (capped at 15 with Defense Academy)
5. **Weapon Control** (Combat) - Accuracy (capped at 15 with Combat Academy)
6. **Critical Systems** (Combat) - Burst damage (capped at 15 with Combat Academy)
7. **Penetration** (Combat) - Armor bypass (capped at 15 with Combat Academy)

**Target Levels and Costs**:

| Attribute | Target Level | Cost Calculation | Total Cost |
|-----------|--------------|------------------|------------|
| Combat Power | 15 | Σ(level+1)×1,500 for levels 0-14 | ₡180,000 |
| Hull Integrity | 15 | Σ(level+1)×1,500 for levels 0-14 | ₡180,000 |
| Attack Speed | 15 | Σ(level+1)×1,500 for levels 0-14 | ₡180,000 |
| Armor Plating | 15 | Σ(level+1)×1,500 for levels 0-14 | ₡180,000 |
| Weapon Control | 15 | Σ(level+1)×1,500 for levels 0-14 | ₡180,000 |
| Critical Systems | 12 | Σ(level+1)×1,500 for levels 0-11 | ₡117,000 |
| Penetration | 10 | Σ(level+1)×1,500 for levels 0-9 | ₡82,500 |

**Total Attribute Upgrade Cost: ₡1,099,500**

**Strategic Rationale**:
- **Combat Power at 15** provides **125 damage** (50 base + 15×5), which is solid offensive capability
- **Hull Integrity at 15** provides **125 HP** (50 base + 15×5), which is excellent survivability
- **Attack Speed at 15** provides approximately 137.5% attack frequency (37.5% faster than baseline)
- **Armor Plating at 15** provides approximately 43.75% damage reduction, significantly lowering repair costs
- **Weapon Control at 15** improves accuracy by approximately 37.5%
- **Critical Systems at 12** provides approximately 25-30% critical hit chance
- **Penetration at 10** bypasses approximately 30-35% of enemy armor

**Resulting Robot Stats**:
- **Damage Output**: 125 base + weapon bonuses = approximately 155-175 damage per hit
- **HP**: 125 (excellent survivability)
- **Attack Frequency**: 1.375× baseline (good DPS)
- **Damage Reduction**: 43.75% from armor (low repair costs)
- **Critical Hit Chance**: 25-30%

This distribution creates a well-rounded competitive robot that excels at winning consistently. High damage + high HP + good attack speed = reliable wins and rapid prestige accumulation.

#### Weapon Purchases

**Main Weapon: Plasma Cannon** - ₡500,000
- Type: Ranged, Two-handed
- Base Damage: 30, Cooldown: 5s, DPS: 6.0
- Bonuses: Combat Power +10, Penetration +8, Critical Systems +6, Targeting Systems +5
- Rationale: Premium two-handed ranged weapon for maximum damage output. The +10 Combat Power bonus stacks with your 15 attribute levels for devastating strikes. Two-Handed loadout provides +20% damage bonus.

**Alternative Weapon Options**:

**Option 1: Railgun** (₡450,000) - Saves ₡50,000
- Type: Ranged, Two-handed
- Rationale: Slightly cheaper alternative with excellent penetration. Saves ₡50,000 for larger buffer.

**Option 2: Heavy Hammer** (₡400,000) - Saves ₡100,000
- Type: Melee, Two-handed
- Rationale: Melee alternative with high DPS. Saves ₡100,000 for larger buffer but requires closing distance.

**Recommendation**: Plasma Cannon for maximum damage and ranged safety. Railgun if you want to save ₡50,000. Heavy Hammer only if you're skilled at melee positioning.

**Total Weapon Cost: ₡500,000**

#### Reserve Buffer

**Amount: ₡300,500**

**Purpose**:
- **Emergency repairs**: Covers approximately 25-30 losses at ₡10-12K per repair
- **Operating costs**: Covers approximately 36 weeks of academy costs (₡8,400/week total)
- **Safety net**: Provides cushion for competitive play
- **Flexibility**: Can purchase Booking Office later (₡500K at 1,000 prestige)

**Why Moderate Buffer?**

Prestige Rusher has a moderate buffer because:

1. **Three Academies**: ₡8,400/week operating costs for Combat, Defense, and Mobility Training Academies
2. **Competitive Focus**: Optimized for win rate, expecting 52-55% wins to offset costs
3. **Balanced Repair Costs**: ₡10-12K per loss (moderate due to balanced build)
4. **Future Investment**: Plan to purchase Booking Office (₡500K) once you reach 1,000 prestige (weeks 2-4)

**Buffer Management Strategy**:

- **Week 1-4**: Battle 7-10 times/week, expect 52-55% win rate, accumulate prestige
- **Week 2-4**: Reach 1,000 prestige, purchase Booking Office (₡500K) to unlock tournaments
- **Month 2+**: Buffer should stabilize around ₡250-300K as tournament prestige accelerates progression

**Bankruptcy Risk**: Medium-Low. Prestige Rusher would need to lose 25-30 consecutive battles to face bankruptcy, which is unlikely with optimized win-rate build.

#### Budget Summary

| Category | Amount | Percentage |
|----------|--------|------------|
| Robot Purchase | ₡500,000 | 16.67% |
| Facilities (Combat + Defense + Mobility Academies) | ₡600,000 | 20.00% |
| Attribute Upgrades | ₡1,099,500 | 36.65% |
| Weapons (Plasma Cannon) | ₡500,000 | 16.67% |
| Reserve Buffer | ₡300,500 | 10.02% |
| **Total Spent** | **₡2,699,500** | **89.98%** |
| **Remaining** | **₡300,500** | **10.02%** |

**Allocation Philosophy**:

Prestige Rusher allocates budget for maximum win rate with full academy support:

- **36.65% on Attributes**: Balanced investment across Combat, Defense, and Mobility attributes (capped at level 15 with academies)
- **20.00% on Facilities**: All three Training Academies (₡600K total) to unlock balanced high-level build
- **16.67% on Robot**: Standard robot purchase
- **16.67% on Weapons**: Premium two-handed weapon for maximum damage
- **10.02% Buffer**: Moderate safety net for competitive play and academy operating costs

**Key Insight**: Prestige Rusher creates the most competitive robot possible by investing in all three Training Academies (₡600K total), enabling balanced high-level attributes across Combat, Defense, and Mobility. The balanced high-level attributes (Combat Power 15, Hull Integrity 15, Attack Speed 15) ensure consistent wins across all matchups, maximizing prestige accumulation rate. The moderate buffer (₡300.5K) provides safety while covering the ₡8,400/week operating costs.

**Future Investment**: Purchase Booking Office (₡500,000) once you reach 1,000 prestige (approximately weeks 2-4) to unlock tournament access for accelerated prestige gains.

---

**Total Budget**: ₡3,000,000


---

## Economic Analysis

This section provides detailed economic projections for each archetype, including income at 50% win rate across Bronze, Silver, and Gold leagues, operating costs, weekly net income, bankruptcy risk assessment, and break-even win rate calculations. Understanding the economics of your chosen archetype is critical for long-term sustainability and growth.

### Key Economic Concepts

**Income Scaling by League**: Battle winnings scale dramatically with league tier. Bronze pays ₡5-10K per win, Silver pays ₡10-20K per win, and Gold pays ₡20-40K per win. This 2× scaling between leagues means advancing leagues is the single most important economic decision you can make.

**Operating Costs**: Include daily facility costs (Training Academies, Repair Bays, etc.) that accumulate regardless of battle activity. These costs are fixed and must be covered by battle income.

**Repair Costs**: Vary based on robot attributes and damage taken. Formula: `(Total Attributes × 100) × Damage % × Condition Multiplier`. Higher total attributes = higher repair costs, but defensive attributes reduce damage taken, creating a complex trade-off.

**Break-Even Win Rate**: The minimum win rate required to maintain profitability (income = expenses). Below this rate, you lose money over time. Above this rate, you accumulate wealth.

**Bankruptcy Risk**: Assessment of how likely you are to run out of money at each league tier. Factors include repair costs, operating costs, buffer size, and income level.

---

### 5.1 Tank Fortress - Economic Analysis

**Strategy**: Strategy A (With Training Academies - Defense + Combat)

#### Income Projections (50% Win Rate, 7 Battles/Week)

**Bronze League** (Weeks 1-4):
- Average win reward: ₡7,500 (midpoint of ₡5,000-₡10,000 range)
- Participation reward: ₡1,500 per battle
- Weekly battles: 7
- Wins at 50% rate: 3.5
- **Battle winnings**: (3.5 × ₡7,500) + (7 × ₡1,500) = ₡26,250 + ₡10,500 = **₡36,750/week**
- **Passive income**: ₡0 (no Income Generator)
- **Total weekly income**: **₡36,750**

**Silver League** (Weeks 5-12):
- Average win reward: ₡15,000 (midpoint of ₡10,000-₡20,000 range)
- Participation reward: ₡3,000 per battle
- Weekly battles: 7
- Wins at 50% rate: 3.5
- **Battle winnings**: (3.5 × ₡15,000) + (7 × ₡3,000) = ₡52,500 + ₡21,000 = **₡73,500/week**
- **Passive income**: ₡0
- **Total weekly income**: **₡73,500**

**Gold League** (Weeks 13+):
- Average win reward: ₡30,000 (midpoint of ₡20,000-₡40,000 range)
- Participation reward: ₡6,000 per battle
- Weekly battles: 7
- Wins at 50% rate: 3.5
- **Battle winnings**: (3.5 × ₡30,000) + (7 × ₡6,000) = ₡105,000 + ₡42,000 = **₡147,000/week**
- **Passive income**: ₡0
- **Total weekly income**: **₡147,000**

#### Operating Costs

**Facility Operating Costs**:
- Defense Training Academy Level 1: ₡400/day = ₡2,800/week
- Combat Training Academy Level 1: ₡400/day = ₡2,800/week
- **Total facility costs**: **₡5,600/week**

**Repair Costs** (Average per loss):

Tank Fortress robot stats:
- Total attributes: ~87 levels across all attributes (Hull Integrity 15, Armor Plating 14, Shield Capacity 14, Counter Protocols 12, Combat Power 12, Damage Control 10, Weapon Control 10)
- Average damage per loss: ~35% (low due to high defense)
- Condition multiplier: 1.0 (standard)

Repair cost formula: `(Total Attributes × 100) × Damage % × Multiplier`
- Repair cost per loss: (87 × 100) × 0.35 × 1.0 = **₡3,045 per loss**

**Weekly repair costs** (3.5 losses at 50% win rate):
- 3.5 × ₡3,045 = **₡10,658/week**

**Total Weekly Operating Costs**:
- Facility costs: ₡5,600
- Repair costs: ₡10,658
- **Total**: **₡16,258/week**

#### Net Income Analysis

**Bronze League**:
- Weekly income: ₡36,750
- Weekly costs: ₡16,258
- **Weekly net**: **₡20,492** ✓ PROFITABLE
- **Monthly net**: ₡20,492 × 4 = **₡81,968**

**Silver League**:
- Weekly income: ₡73,500
- Weekly costs: ₡16,258
- **Weekly net**: **₡57,242** ✓ HIGHLY PROFITABLE
- **Monthly net**: ₡57,242 × 4 = **₡228,968**

**Gold League**:
- Weekly income: ₡147,000
- Weekly costs: ₡16,258
- **Weekly net**: **₡130,742** ✓ EXTREMELY PROFITABLE
- **Monthly net**: ₡130,742 × 4 = **₡522,968**

#### Break-Even Win Rate Calculation

**Formula**: Break-even occurs when income = expenses

Let W = win rate (as decimal, e.g., 0.50 = 50%)
Let B = battles per week = 7

**Bronze League**:
- Income per win: ₡7,500
- Participation per battle: ₡1,500
- Repair cost per loss: ₡3,045
- Weekly facility costs: ₡5,600

Income equation: (B × W × ₡7,500) + (B × ₡1,500)
Expense equation: (B × (1-W) × ₡3,045) + ₡5,600

Break-even: Income = Expenses
(7W × ₡7,500) + (7 × ₡1,500) = (7(1-W) × ₡3,045) + ₡5,600
₡52,500W + ₡10,500 = ₡21,315 - ₡21,315W + ₡5,600
₡52,500W + ₡21,315W = ₡21,315 + ₡5,600 - ₡10,500
₡73,815W = ₡16,415
W = 0.222 = **22.2% win rate**

**Silver League**:
Using same formula with Silver values (₡15,000 win, ₡3,000 participation):
Break-even win rate: **18.5%**

**Gold League**:
Using same formula with Gold values (₡30,000 win, ₡6,000 participation):
Break-even win rate: **15.8%**


#### Bankruptcy Risk Assessment

**Bronze League**: **VERY LOW RISK**
- Break-even win rate: 22.2% (extremely forgiving)
- Starting buffer: ₡756,000
- Losses to bankruptcy: 756,000 / 3,045 = ~248 losses
- At 50% win rate: Profitable by ₡20,492/week
- **Assessment**: Tank Fortress is the safest archetype in Bronze. You'd need to lose 248 consecutive battles to go bankrupt, which is statistically impossible. Even at 30% win rate, you're still profitable.

**Silver League**: **EXTREMELY LOW RISK**
- Break-even win rate: 18.5%
- Income doubles while costs stay flat
- Weekly profit at 50% win rate: ₡57,242
- **Assessment**: Risk decreases further in Silver. You're accumulating wealth rapidly and can easily afford facility upgrades or second robot.

**Gold League**: **NEGLIGIBLE RISK**
- Break-even win rate: 15.8%
- Income quadruples from Bronze while costs stay flat
- Weekly profit at 50% win rate: ₡130,742
- **Assessment**: Tank Fortress becomes a wealth-generating machine in Gold. Bankruptcy is virtually impossible unless you deliberately sabotage your finances.

#### League Progression Impact

**Key Insight**: Tank Fortress benefits enormously from league advancement because repair costs stay low (~₡3,045 per loss) regardless of league, while income scales 2× per league tier.

**Bronze → Silver Transition**:
- Income increases: +100% (₡36,750 → ₡73,500)
- Costs remain: Same (₡16,258)
- Net income increases: +179% (₡20,492 → ₡57,242)
- **Impact**: Profitability nearly triples

**Silver → Gold Transition**:
- Income increases: +100% (₡73,500 → ₡147,000)
- Costs remain: Same (₡16,258)
- Net income increases: +128% (₡57,242 → ₡130,742)
- **Impact**: Profitability more than doubles again

**Strategic Implication**: Tank Fortress should prioritize advancing leagues as quickly as possible. Each league advancement dramatically improves profit margins without increasing risk. By Gold League, you're earning ₡522,968/month net profit, enabling rapid stable expansion.

#### Economic Summary

**Strengths**:
- Lowest repair costs of any archetype (~₡3,045 per loss)
- Profitable at extremely low win rates (22.2% in Bronze)
- Massive starting buffer (₡756,000) provides extreme safety
- Scales excellently with league advancement
- Sustainable long-term economics

**Weaknesses**:
- Moderate facility operating costs (₡5,600/week)
- Lower income potential than aggressive archetypes in early game
- Slower wealth accumulation in Bronze compared to high-risk archetypes

**Recommendation**: Tank Fortress is the most economically sustainable archetype in Armoured Souls. If you want guaranteed profitability, low stress, and steady wealth accumulation, this is your choice. Perfect for new players learning the game or risk-averse players who prioritize safety over explosive growth.

---

### 5.2 Glass Cannon - Economic Analysis

#### Income Projections (50% Win Rate, 7 Battles/Week)

**Bronze League** (Weeks 1-4):
- Average win reward: ₡7,500
- Participation reward: ₡1,500 per battle
- Weekly battles: 7
- Wins at 50% rate: 3.5
- **Battle winnings**: (3.5 × ₡7,500) + (7 × ₡1,500) = **₡36,750/week**
- **Passive income**: ₡0
- **Total weekly income**: **₡36,750**

**Silver League** (Weeks 5-12):
- Average win reward: ₡15,000
- Participation reward: ₡3,000 per battle
- **Battle winnings**: (3.5 × ₡15,000) + (7 × ₡3,000) = **₡73,500/week**
- **Total weekly income**: **₡73,500**

**Gold League** (Weeks 13+):
- Average win reward: ₡30,000
- Participation reward: ₡6,000 per battle
- **Battle winnings**: (3.5 × ₡30,000) + (7 × ₡6,000) = **₡147,000/week**
- **Total weekly income**: **₡147,000**


#### Operating Costs

**Facility Operating Costs**:
- Combat Training Academy Level 1: ₡400/day = ₡2,800/week
- **Total facility costs**: **₡2,800/week**

**Repair Costs** (Average per loss):

Glass Cannon robot stats:
- Total attributes: ~79 levels (Combat Power 15, Critical Systems 15, Penetration 14, Weapon Control 13, Targeting Systems 12, Hull Integrity 10)
- Average damage per loss: ~65% (high due to low defense - Glass Cannon takes heavy damage when losing)
- Condition multiplier: 1.0

Repair cost formula: `(Total Attributes × 100) × Damage % × Multiplier`
- Repair cost per loss: (79 × 100) × 0.65 × 1.0 = **₡5,135 per loss**

**Weekly repair costs** (3.5 losses at 50% win rate):
- 3.5 × ₡5,135 = **₡17,973/week**

**Total Weekly Operating Costs**:
- Facility costs: ₡2,800
- Repair costs: ₡17,973
- **Total**: **₡20,773/week**

#### Net Income Analysis

**Bronze League**:
- Weekly income: ₡36,750
- Weekly costs: ₡20,773
- **Weekly net**: **₡15,977** ✓ PROFITABLE (but tight margins)
- **Monthly net**: ₡15,977 × 4 = **₡63,908**

**Silver League**:
- Weekly income: ₡73,500
- Weekly costs: ₡20,773
- **Weekly net**: **₡52,727** ✓ HIGHLY PROFITABLE
- **Monthly net**: ₡52,727 × 4 = **₡210,908**

**Gold League**:
- Weekly income: ₡147,000
- Weekly costs: ₡20,773
- **Weekly net**: **₡126,227** ✓ EXTREMELY PROFITABLE
- **Monthly net**: ₡126,227 × 4 = **₡504,908**

#### Break-Even Win Rate Calculation

**Bronze League**:
- Income per win: ₡7,500
- Participation per battle: ₡1,500
- Repair cost per loss: ₡5,135
- Weekly facility costs: ₡2,800

Using break-even formula:
(7W × ₡7,500) + (7 × ₡1,500) = (7(1-W) × ₡5,135) + ₡2,800
₡52,500W + ₡10,500 = ₡35,945 - ₡35,945W + ₡2,800
₡88,445W = ₡28,245
W = 0.319 = **31.9% win rate**

**Silver League**:
Break-even win rate: **25.8%**

**Gold League**:
Break-even win rate: **21.4%**

#### Bankruptcy Risk Assessment

**Bronze League**: **MEDIUM RISK**
- Break-even win rate: 31.9% (requires decent performance)
- Starting buffer: ₡946,500
- Losses to bankruptcy: 946,500 / 5,135 = ~184 losses
- At 50% win rate: Profitable by ₡15,977/week (modest margins)
- **Assessment**: Glass Cannon is profitable in Bronze at 50% win rate, but margins are tight. A losing streak of 10-15 battles can drain ₡50-75K from your buffer. You need to maintain at least 35-40% win rate to avoid slow bankruptcy. The large starting buffer (₡946.5K) provides substantial safety, but high repair costs (₡5,135 per loss) mean losses hurt economically.

**Silver League**: **LOW RISK**
- Break-even win rate: 25.8%
- Income doubles while costs stay flat
- Weekly profit at 50% win rate: ₡52,727
- **Assessment**: Risk drops significantly in Silver. Income doubles to ₡73,500/week while repair costs remain ₡17,973/week. You're now accumulating wealth rapidly and can absorb losing streaks without stress.

**Gold League**: **VERY LOW RISK**
- Break-even win rate: 21.4%
- Income quadruples from Bronze
- Weekly profit at 50% win rate: ₡126,227
- **Assessment**: Glass Cannon transforms into a wealth-generating machine in Gold. High repair costs (₡5,135 per loss) are easily covered by massive income (₡147K/week). Bankruptcy becomes virtually impossible.


#### League Progression Impact

**Key Insight**: Glass Cannon's risk profile changes dramatically with league advancement. High repair costs (₡5,135 per loss) are painful in Bronze but trivial in Gold.

**Bronze → Silver Transition**:
- Income increases: +100% (₡36,750 → ₡73,500)
- Costs remain: Same (₡20,773)
- Net income increases: +230% (₡15,977 → ₡52,727)
- **Impact**: Profitability more than triples. Glass Cannon transitions from "tight margins" to "highly profitable"

**Silver → Gold Transition**:
- Income increases: +100% (₡73,500 → ₡147,000)
- Costs remain: Same (₡20,773)
- Net income increases: +139% (₡52,727 → ₡126,227)
- **Impact**: Profitability more than doubles again. Glass Cannon becomes one of the most profitable archetypes

**Strategic Implication**: Glass Cannon is a "league advancement dependent" archetype. Your primary goal in Bronze is to advance to Silver as quickly as possible (ideally within 3-4 weeks). Once you reach Silver/Gold, high repair costs become manageable and you transition into a highly profitable, low-risk archetype. The corrected budget allocation (₡946.5K buffer) provides substantial safety during the Bronze phase.

#### Economic Summary

**Strengths**:
- High income potential through superior win rate (offensive power translates to more wins)
- Scales excellently with league advancement (repair costs stay flat while income doubles per league)
- Transforms from medium-risk to low-risk as you advance leagues
- Large starting buffer (₡946.5K) provides substantial safety
- Low facility operating costs (₡2,800/week)

**Weaknesses**:
- High repair costs (₡5,135 per loss) hurt in Bronze
- Requires 32% win rate to break even in Bronze (higher than Tank Fortress's 22%)
- Tight profit margins in Bronze (₡15,977/week net)
- Losing streaks can drain buffer quickly in early game

**Recommendation**: Glass Cannon is ideal for players confident in their combat skills who can maintain 40-50% win rate in Bronze. The corrected budget allocation provides a large buffer (₡946.5K) that makes this archetype much safer than originally designed. If you can advance to Silver within 3-4 weeks, you'll transition into one of the most profitable archetypes in the game. Not recommended for new players or those learning game mechanics.

---

### 5.3 Speed Demon - Economic Analysis

#### Income Projections (50% Win Rate, 7 Battles/Week)

**Bronze League** (Weeks 1-4):
- **Battle winnings**: (3.5 × ₡7,500) + (7 × ₡1,500) = **₡36,750/week**
- **Total weekly income**: **₡36,750**

**Silver League** (Weeks 5-12):
- **Battle winnings**: (3.5 × ₡15,000) + (7 × ₡3,000) = **₡73,500/week**
- **Total weekly income**: **₡73,500**

**Gold League** (Weeks 13+):
- **Battle winnings**: (3.5 × ₡30,000) + (7 × ₡6,000) = **₡147,000/week**
- **Total weekly income**: **₡147,000**

#### Operating Costs

**Facility Operating Costs**:
- Mobility Training Academy Level 1: ₡400/day = ₡2,800/week
- Combat Training Academy Level 1: ₡400/day = ₡2,800/week
- **Total facility costs**: **₡5,600/week**

**Repair Costs** (Average per loss):

Speed Demon robot stats:
- Total attributes: ~114 levels (Attack Speed 15, Servo Motors 15, Weapon Control 15, Combat Power 15, Gyro Stabilizers 14, Hull Integrity 14, Reaction Time 13, Armor Plating 13, Evasion Systems 12, Targeting Systems 12, Penetration 11, Shield Capacity 10)
- Average damage per loss: ~45% (moderate - mobility helps avoid some damage, but not as tanky as Tank Fortress)
- Condition multiplier: 1.0

Repair cost per loss: (114 × 100) × 0.45 × 1.0 = **₡5,130 per loss**

**Weekly repair costs** (3.5 losses at 50% win rate):
- 3.5 × ₡5,130 = **₡17,955/week**

**Total Weekly Operating Costs**:
- Facility costs: ₡5,600
- Repair costs: ₡17,955
- **Total**: **₡23,555/week**


#### Net Income Analysis

**Bronze League**:
- Weekly income: ₡36,750
- Weekly costs: ₡23,555
- **Weekly net**: **₡13,195** ✓ PROFITABLE (modest margins)
- **Monthly net**: ₡13,195 × 4 = **₡52,780**

**Silver League**:
- Weekly income: ₡73,500
- Weekly costs: ₡23,555
- **Weekly net**: **₡49,945** ✓ HIGHLY PROFITABLE
- **Monthly net**: ₡49,945 × 4 = **₡199,780**

**Gold League**:
- Weekly income: ₡147,000
- Weekly costs: ₡23,555
- **Weekly net**: **₡123,445** ✓ EXTREMELY PROFITABLE
- **Monthly net**: ₡123,445 × 4 = **₡493,780**

#### Break-Even Win Rate Calculation

**Bronze League**:
- Repair cost per loss: ₡5,130
- Weekly facility costs: ₡5,600

Break-even calculation:
(7W × ₡7,500) + (7 × ₡1,500) = (7(1-W) × ₡5,130) + ₡5,600
W = 0.336 = **33.6% win rate**

**Silver League**: **27.2%**
**Gold League**: **22.6%**

#### Bankruptcy Risk Assessment

**Bronze League**: **MEDIUM-HIGH RISK**
- Break-even win rate: 33.6%
- Starting buffer: ₡66,500 (very small)
- Losses to bankruptcy: 66,500 / 5,130 = ~13 losses
- At 50% win rate: Profitable by ₡13,195/week (modest margins)
- **Assessment**: Speed Demon has the smallest buffer of any archetype (₡66.5K) and high operating costs (₡5,600/week). You can only afford ~13 consecutive losses before bankruptcy. At 50% win rate, you're profitable but margins are tight. A bad week (2-5 record) can drain ₡15-20K from your already-small buffer. Requires immediate success and 35-40% minimum win rate.

**Silver League**: **LOW-MEDIUM RISK**
- Break-even win rate: 27.2%
- Income doubles while costs stay flat
- Weekly profit at 50% win rate: ₡49,945
- **Assessment**: Risk drops significantly in Silver. You're now accumulating wealth rapidly (₡50K/week) and can rebuild your buffer. After 2-3 weeks in Silver, your buffer should grow to ₡150-200K, providing much better safety.

**Gold League**: **LOW RISK**
- Break-even win rate: 22.6%
- Weekly profit at 50% win rate: ₡123,445
- **Assessment**: Speed Demon becomes highly profitable in Gold. High operating costs (₡5,600/week) and moderate repair costs (₡5,130 per loss) are easily covered by massive income (₡147K/week).

#### League Progression Impact

**Key Insight**: Speed Demon is a high-risk archetype in Bronze due to small buffer (₡66.5K) and high operating costs (₡5,600/week), but becomes increasingly safe as you advance leagues.

**Bronze → Silver Transition**:
- Income increases: +100%
- Net income increases: +278% (₡13,195 → ₡49,945)
- **Impact**: Profitability nearly quadruples. Speed Demon transitions from "tight margins" to "highly profitable"

**Silver → Gold Transition**:
- Income increases: +100%
- Net income increases: +147% (₡49,945 → ₡123,445)
- **Impact**: Profitability more than doubles again

**Strategic Implication**: Speed Demon requires immediate success in Bronze. With only ₡66.5K buffer and ₡23,555/week costs, you cannot afford extended losing streaks. Your goal is to maintain 40-50% win rate and advance to Silver within 3-4 weeks. Once in Silver, your economic situation stabilizes dramatically.

#### Economic Summary

**Strengths**:
- Consistent performance across leagues (speed advantage remains valuable)
- Scales well with league advancement
- Moderate repair costs (₡5,130 per loss)
- Transforms from high-risk to low-risk as you advance

**Weaknesses**:
- Smallest starting buffer (₡66.5K) of any archetype
- High operating costs (₡5,600/week) from two Training Academies
- Requires 33.6% win rate to break even in Bronze
- Very tight margins in Bronze (₡13,195/week net)
- High bankruptcy risk in Bronze (only 13 losses to bankruptcy)

**Recommendation**: Speed Demon is a high-risk archetype suitable for skilled players confident in their ability to maintain 40-50% win rate immediately. Not recommended for new players or those learning game mechanics. The small buffer (₡66.5K) provides almost no safety net. If you can survive Bronze and reach Silver, Speed Demon becomes a strong, profitable archetype.

---

### 5.4 Balanced Brawler - Economic Analysis

#### Income Projections (50% Win Rate, 7 Battles/Week)

- **Bronze**: ₡36,750/week
- **Silver**: ₡73,500/week
- **Gold**: ₡147,000/week

#### Operating Costs

**Facility Operating Costs**: ₡0/week (no Training Academies purchased)

**Repair Costs**:
- Total attributes: ~70 levels (balanced distribution, all capped at level 10)
- Average damage per loss: ~50% (moderate defense)
- Repair cost per loss: (70 × 100) × 0.50 × 1.0 = **₡3,500 per loss**
- Weekly repair costs (3.5 losses): **₡12,250/week**

**Total Weekly Operating Costs**: **₡12,250/week**

#### Net Income Analysis

- **Bronze**: ₡36,750 - ₡12,250 = **₡24,500/week** ✓ HIGHLY PROFITABLE
- **Silver**: ₡73,500 - ₡12,250 = **₡61,250/week** ✓ EXTREMELY PROFITABLE
- **Gold**: ₡147,000 - ₡12,250 = **₡134,750/week** ✓ EXTREMELY PROFITABLE

#### Break-Even Win Rate

- **Bronze**: **20.8%** (extremely forgiving)
- **Silver**: **16.9%**
- **Gold**: **14.4%**

#### Bankruptcy Risk Assessment

**Bronze League**: **EXTREMELY LOW RISK**
- Break-even: 20.8% (lowest of all archetypes)
- Starting buffer: ₡1,390,000 (largest buffer of any archetype)
- Losses to bankruptcy: 1,390,000 / 3,500 = ~397 losses
- Weekly profit at 50%: ₡24,500
- **Assessment**: Balanced Brawler is the safest archetype in the game. Massive buffer (₡1.39M), zero operating costs, low repair costs (₡3,500 per loss), and extremely low break-even rate (20.8%) make bankruptcy virtually impossible.

**Silver/Gold Leagues**: **NEGLIGIBLE RISK**
- Profitability increases dramatically while costs stay flat
- **Assessment**: Already the safest archetype, becomes even safer in higher leagues

#### Economic Summary

**Strengths**:
- Largest starting buffer (₡1.39M)
- Zero operating costs (no facilities)
- Low repair costs (₡3,500 per loss)
- Lowest break-even win rate (20.8% in Bronze)
- Most forgiving archetype for new players
- Highly profitable at all league tiers

**Weaknesses**:
- Lower win rate potential than specialized builds (balanced = good at everything, great at nothing)
- Attributes capped at level 10 (no Training Academies)
- Slower wealth accumulation than high-risk archetypes in higher leagues

**Recommendation**: Balanced Brawler is the ultimate "safe choice" archetype. Perfect for new players, risk-averse players, or anyone learning game mechanics. You'll never go bankrupt, you'll always be profitable, and you have a massive buffer (₡1.39M) for experimentation and mistakes.

---

### 5.5 Facility Investor - Economic Analysis

#### Income Projections (50% Win Rate, 7 Battles/Week)

- **Bronze**: ₡36,750/week (battle winnings) + ₡7,000/week (Income Generator Level 1) = **₡43,750/week**
- **Silver**: ₡73,500/week + ₡7,000/week = **₡80,500/week**
- **Gold**: ₡147,000/week + ₡7,000/week = **₡154,000/week**

#### Operating Costs

**Facility Operating Costs**:
- Income Generator Level 1: ₡1,000/day = ₡7,000/week
- Repair Bay Level 1: ₡1,000/day = ₡7,000/week
- Training Facility Level 1: ₡1,500/day = ₡10,500/week
- **Total facility costs**: **₡24,500/week**

**Repair Costs**:
- Total attributes: ~60 levels (moderate investment, budget weapons)
- Average damage per loss: ~55% (lower defense due to budget allocation)
- Repair cost per loss: (60 × 100) × 0.55 × 1.0 = ₡3,300 base
- With Repair Bay Level 1 (5% discount): ₡3,300 × 0.95 = **₡3,135 per loss**
- Weekly repair costs (3.5 losses): **₡10,973/week**

**Total Weekly Operating Costs**: ₡24,500 + ₡10,973 = **₡35,473/week**


#### Net Income Analysis

- **Bronze**: ₡43,750 - ₡35,473 = **₡8,277/week** ✓ PROFITABLE (tight margins)
- **Silver**: ₡80,500 - ₡35,473 = **₡45,027/week** ✓ HIGHLY PROFITABLE
- **Gold**: ₡154,000 - ₡35,473 = **₡118,527/week** ✓ EXTREMELY PROFITABLE

#### Break-Even Win Rate

- **Bronze**: **42.1%** (requires above-average performance)
- **Silver**: **33.8%**
- **Gold**: **27.9%**

#### Bankruptcy Risk Assessment

**Bronze League**: **MEDIUM-HIGH RISK**
- Break-even: 42.1% (highest of all archetypes)
- Starting buffer: ₡150,000
- High operating costs: ₡24,500/week from facilities
- Weekly profit at 50%: ₡8,277 (very tight margins)
- **Assessment**: Facility Investor has the highest break-even win rate (42.1%) and high operating costs (₡24,500/week). At 50% win rate, you're barely profitable (₡8,277/week). A bad week can wipe out your modest profits. This is a long-term investment strategy that struggles in Bronze.

**Silver League**: **LOW-MEDIUM RISK**
- Income doubles while costs stay flat
- Weekly profit at 50%: ₡45,027
- **Assessment**: Facility Investor becomes much more viable in Silver. Passive income (₡7K/week) and facility benefits start paying off as you accumulate wealth.

**Gold League**: **LOW RISK**
- Weekly profit at 50%: ₡118,527
- **Assessment**: Facility Investor thrives in Gold. High operating costs are easily covered, and facility benefits compound over time.

#### League Progression Impact

**Key Insight**: Facility Investor is a "long-term investment" archetype that struggles in Bronze but becomes increasingly profitable as you advance leagues and facility benefits compound.

**Facility ROI Analysis**:

**Income Generator Level 1** (₡800,000 purchase, ₡7,000/week operating):
- Generates: ₡7,000/week passive income
- Net benefit: ₡0/week (breaks even on operating costs)
- Payback period: Never (at Level 1)
- **Assessment**: Income Generator Level 1 is a poor investment - it generates exactly what it costs to operate. Only becomes profitable at higher levels or with prestige multipliers.

**Repair Bay Level 1** (₡200,000 purchase, ₡7,000/week operating):
- Saves: 5% on repairs = ₡10,973 × 0.05 = ₡549/week
- Net benefit: ₡549 - ₡7,000 = -₡6,451/week (NEGATIVE)
- **Assessment**: Repair Bay Level 1 loses money. You'd need ₡140,000/week in repair costs for it to break even.

**Training Facility Level 1** (₡300,000 purchase, ₡10,500/week operating):
- Saves: 5% on attribute upgrades
- Net benefit: Only positive if spending ₡210,000+/week on upgrades
- **Assessment**: Training Facility Level 1 is a poor early-game investment.

**Overall Facility Investment Assessment**: Facility Investor's ₡1.5M facility investment has NEGATIVE ROI in early game. These facilities only become profitable at higher levels or with massive spending. This archetype is designed for long-term play (months), not short-term profitability.

#### Economic Summary

**Strengths**:
- Passive income (₡7K/week) provides income diversification
- Facility benefits compound over time
- Scales well in higher leagues
- Long-term wealth accumulation potential

**Weaknesses**:
- Highest break-even win rate (42.1% in Bronze)
- Highest operating costs (₡24,500/week)
- Negative facility ROI in early game
- Tight profit margins in Bronze (₡8,277/week)
- Requires above-average win rate to stay profitable in Bronze

**Recommendation**: Facility Investor is NOT recommended for new players or those seeking immediate profitability. This is a long-term investment strategy that struggles in Bronze but pays off over months of play. Only choose this archetype if you're committed to long-term play and can maintain 45-50% win rate in Bronze.

---

### 5.6 Two-Robot Specialist - Economic Analysis

#### Income Projections (50% Win Rate, 7 Battles/Week)

- **Bronze**: ₡36,750/week
- **Silver**: ₡73,500/week
- **Gold**: ₡147,000/week

#### Operating Costs

**Facility Operating Costs**:
- Roster Expansion Level 1: ₡500/day (for 2nd robot slot) = ₡3,500/week
- **Total facility costs**: **₡3,500/week**

**Repair Costs**:
- Two robots with moderate attributes (~65 levels each)
- Average damage per loss: ~50%
- Repair cost per loss: (65 × 100) × 0.50 × 1.0 = **₡3,250 per loss** (per robot)
- Assuming you alternate robots: **₡3,250 per loss average**
- Weekly repair costs (3.5 losses): **₡11,375/week**

**Total Weekly Operating Costs**: ₡3,500 + ₡11,375 = **₡14,875/week**


#### Net Income Analysis

- **Bronze**: ₡36,750 - ₡14,875 = **₡21,875/week** ✓ PROFITABLE
- **Silver**: ₡73,500 - ₡14,875 = **₡58,625/week** ✓ HIGHLY PROFITABLE
- **Gold**: ₡147,000 - ₡14,875 = **₡132,125/week** ✓ EXTREMELY PROFITABLE

#### Break-Even Win Rate

- **Bronze**: **25.4%**
- **Silver**: **20.6%**
- **Gold**: **17.6%**

#### Bankruptcy Risk Assessment

**Bronze League**: **LOW RISK**
- Break-even: 25.4% (forgiving)
- Starting buffer: ₡150,000
- Weekly profit at 50%: ₡21,875
- **Assessment**: Two-Robot Specialist is profitable and relatively safe in Bronze. The ability to select optimal robot per matchup provides strategic advantage, helping maintain win rate. Moderate buffer (₡150K) and low operating costs (₡3,500/week) create sustainable economics.

**Silver/Gold Leagues**: **VERY LOW RISK**
- Profitability increases dramatically
- **Assessment**: Two-Robot Specialist becomes highly profitable in higher leagues

#### Economic Summary

**Strengths**:
- Strategic flexibility (choose optimal robot per matchup)
- Low operating costs (₡3,500/week)
- Moderate repair costs (₡3,250 per loss)
- Low break-even win rate (25.4% in Bronze)
- Scales well with league advancement

**Weaknesses**:
- Spread resources across two robots (each robot weaker than single-robot builds)
- Requires Roster Expansion (₡300K + ₡3,500/week)
- Moderate starting buffer (₡150K)

**Recommendation**: Two-Robot Specialist is a solid mid-risk archetype that provides strategic flexibility. Good for players who enjoy variety and matchup optimization. Economically sustainable at all league tiers.

---

### 5.7 Melee Specialist - Economic Analysis

#### Income Projections (50% Win Rate, 7 Battles/Week)

- **Bronze**: ₡36,750/week
- **Silver**: ₡73,500/week
- **Gold**: ₡147,000/week

#### Operating Costs

**Facility Operating Costs**:
- Combat Training Academy Level 1: ₡400/day = ₡2,800/week
- **Total facility costs**: **₡2,800/week**

**Repair Costs**:
- Total attributes: ~75 levels (Hydraulic Systems 15, Combat Power 15, Hull Integrity 14, etc.)
- Average damage per loss: ~55% (moderate defense, melee requires closing distance)
- Repair cost per loss: (75 × 100) × 0.55 × 1.0 = **₡4,125 per loss**
- Weekly repair costs (3.5 losses): **₡14,438/week**

**Total Weekly Operating Costs**: ₡2,800 + ₡14,438 = **₡17,238/week**

#### Net Income Analysis

- **Bronze**: ₡36,750 - ₡17,238 = **₡19,512/week** ✓ PROFITABLE
- **Silver**: ₡73,500 - ₡17,238 = **₡56,262/week** ✓ HIGHLY PROFITABLE
- **Gold**: ₡147,000 - ₡17,238 = **₡129,762/week** ✓ EXTREMELY PROFITABLE

#### Break-Even Win Rate

- **Bronze**: **28.9%**
- **Silver**: **23.4%**
- **Gold**: **19.4%**

#### Bankruptcy Risk Assessment

**Bronze League**: **LOW-MEDIUM RISK**
- Break-even: 28.9%
- Moderate repair costs and operating costs
- **Assessment**: Melee Specialist is profitable in Bronze with decent margins. Requires closing distance (risky), but high damage output helps maintain win rate.

**Silver/Gold Leagues**: **LOW RISK**
- Profitability increases significantly
- **Assessment**: Melee Specialist becomes highly profitable in higher leagues

#### Economic Summary

**Strengths**:
- High melee damage output
- Moderate operating costs (₡2,800/week)
- Scales well with league advancement
- Low break-even win rate (28.9% in Bronze)

**Weaknesses**:
- Requires closing distance (risky against ranged opponents)
- Moderate repair costs (₡4,125 per loss)
- Positioning skill required

**Recommendation**: Melee Specialist is a solid archetype for players who enjoy melee combat and positioning gameplay. Economically sustainable with moderate risk.

---

### 5.8 Ranged Sniper - Economic Analysis

#### Income Projections (50% Win Rate, 7 Battles/Week)

- **Bronze**: ₡36,750/week
- **Silver**: ₡73,500/week
- **Gold**: ₡147,000/week

#### Operating Costs

**Facility Operating Costs**:
- Combat Training Academy Level 1: ₡400/day = ₡2,800/week
- **Total facility costs**: **₡2,800/week**

**Repair Costs**:
- Total attributes: ~76 levels (Targeting Systems 15, Penetration 15, Critical Systems 14, etc.)
- Average damage per loss: ~60% (lower defense, relies on range)
- Repair cost per loss: (76 × 100) × 0.60 × 1.0 = **₡4,560 per loss**
- Weekly repair costs (3.5 losses): **₡15,960/week**

**Total Weekly Operating Costs**: ₡2,800 + ₡15,960 = **₡18,760/week**


#### Net Income Analysis

- **Bronze**: ₡36,750 - ₡18,760 = **₡17,990/week** ✓ PROFITABLE
- **Silver**: ₡73,500 - ₡18,760 = **₡54,740/week** ✓ HIGHLY PROFITABLE
- **Gold**: ₡147,000 - ₡18,760 = **₡128,240/week** ✓ EXTREMELY PROFITABLE

#### Break-Even Win Rate

- **Bronze**: **30.5%**
- **Silver**: **24.7%**
- **Gold**: **20.5%**

#### Bankruptcy Risk Assessment

**Bronze League**: **MEDIUM RISK**
- Break-even: 30.5%
- Higher repair costs due to lower defense
- **Assessment**: Ranged Sniper is profitable in Bronze but requires decent performance. Precision gameplay helps maintain win rate, but losses are expensive.

**Silver/Gold Leagues**: **LOW RISK**
- Profitability increases significantly
- Precision becomes more valuable against skilled opponents
- **Assessment**: Ranged Sniper thrives in higher leagues where accuracy matters more

#### Economic Summary

**Strengths**:
- High precision damage output
- Ranged safety (avoid melee damage)
- Scales excellently in higher leagues (precision more valuable)
- Moderate operating costs (₡2,800/week)

**Weaknesses**:
- Higher repair costs (₡4,560 per loss) due to lower defense
- Requires accuracy skill
- Vulnerable if opponent closes distance

**Recommendation**: Ranged Sniper is ideal for players who enjoy precision gameplay and ranged combat. Economically sustainable with moderate risk. Scales excellently into higher leagues.

---

### 5.9 AI Tactician - Economic Analysis

#### Income Projections (50% Win Rate, 7 Battles/Week)

- **Bronze**: ₡36,750/week
- **Silver**: ₡73,500/week
- **Gold**: ₡147,000/week

#### Operating Costs

**Facility Operating Costs**:
- AI Training Academy Level 1: ₡500/day = ₡3,500/week
- **Total facility costs**: **₡3,500/week**

**Repair Costs**:
- Total attributes: ~72 levels (Combat Algorithms 15, Threat Analysis 14, Adaptive AI 13, etc.)
- Average damage per loss: ~50% (balanced build)
- Repair cost per loss: (72 × 100) × 0.50 × 1.0 = **₡3,600 per loss**
- Weekly repair costs (3.5 losses): **₡12,600/week**

**Total Weekly Operating Costs**: ₡3,500 + ₡12,600 = **₡16,100/week**

#### Net Income Analysis

- **Bronze**: ₡36,750 - ₡16,100 = **₡20,650/week** ✓ PROFITABLE
- **Silver**: ₡73,500 - ₡16,100 = **₡57,400/week** ✓ HIGHLY PROFITABLE
- **Gold**: ₡147,000 - ₡16,100 = **₡130,900/week** ✓ EXTREMELY PROFITABLE

#### Break-Even Win Rate

- **Bronze**: **27.2%**
- **Silver**: **22.0%**
- **Gold**: **18.8%**

#### Bankruptcy Risk Assessment

**Bronze League**: **LOW-MEDIUM RISK**
- Break-even: 27.2%
- Moderate costs across the board
- **Assessment**: AI Tactician is profitable in Bronze with good margins. AI optimization provides consistent performance.

**Silver/Gold Leagues**: **LOW RISK**
- AI attributes become more valuable against skilled opponents
- **Assessment**: AI Tactician scales excellently - superior decision-making matters more in higher leagues

#### Economic Summary

**Strengths**:
- Superior AI decision-making
- Scales excellently (AI more valuable vs skilled opponents)
- Moderate costs (₡3,500/week operating, ₡3,600 per loss)
- Low break-even win rate (27.2% in Bronze)
- Consistent performance across matchups

**Weaknesses**:
- Requires understanding AI mechanics
- Less intuitive than direct combat builds
- AI Training Academy more expensive (₡500K vs ₡400K for other academies)

**Recommendation**: AI Tactician is ideal for players who enjoy strategic depth and AI optimization. Economically sustainable with low-medium risk. Scales excellently into higher leagues where AI advantages compound.

---

### 5.10 Prestige Rusher - Economic Analysis

#### Income Projections (50% Win Rate, 7 Battles/Week)

- **Bronze**: ₡36,750/week
- **Silver**: ₡73,500/week
- **Gold**: ₡147,000/week

#### Operating Costs

**Facility Operating Costs**:
- Combat Training Academy Level 1: ₡400/day = ₡2,800/week
- Defense Training Academy Level 1: ₡400/day = ₡2,800/week
- Mobility Training Academy Level 1: ₡400/day = ₡2,800/week
- **Total facility costs**: **₡8,400/week** (highest of any archetype)

**Repair Costs**:
- Total attributes: ~99 levels (balanced high-level build across Combat, Defense, Mobility)
- Average damage per loss: ~40% (good defense from balanced build)
- Repair cost per loss: (99 × 100) × 0.40 × 1.0 = **₡3,960 per loss**
- Weekly repair costs (3.5 losses): **₡13,860/week**

**Total Weekly Operating Costs**: ₡8,400 + ₡13,860 = **₡22,260/week**


#### Net Income Analysis

- **Bronze**: ₡36,750 - ₡22,260 = **₡14,490/week** ✓ PROFITABLE
- **Silver**: ₡73,500 - ₡22,260 = **₡51,240/week** ✓ HIGHLY PROFITABLE
- **Gold**: ₡147,000 - ₡22,260 = **₡124,740/week** ✓ EXTREMELY PROFITABLE

#### Break-Even Win Rate

- **Bronze**: **34.2%**
- **Silver**: **27.6%**
- **Gold**: **22.9%**

#### Bankruptcy Risk Assessment

**Bronze League**: **MEDIUM RISK**
- Break-even: 34.2% (requires above-average performance)
- Starting buffer: ₡300,500
- High operating costs: ₡8,400/week (highest of any archetype)
- Weekly profit at 50%: ₡14,490
- **Assessment**: Prestige Rusher has high operating costs (₡8,400/week) from three Training Academies, creating tight margins in Bronze. At 50% win rate, you're profitable but not by much. Requires 35-40% minimum win rate to stay sustainable. The moderate buffer (₡300.5K) provides some safety, but high costs mean losses hurt.

**Silver League**: **LOW-MEDIUM RISK**
- Income doubles while costs stay flat
- Weekly profit at 50%: ₡51,240
- **Assessment**: Prestige Rusher becomes much more viable in Silver. High operating costs are now easily covered, and you're accumulating wealth rapidly.

**Gold League**: **LOW RISK**
- Weekly profit at 50%: ₡124,740
- **Assessment**: Prestige Rusher thrives in Gold. Balanced high-level build ensures consistent wins, and high income easily covers operating costs.

#### Prestige Accumulation Timeline

**Bronze League** (5 prestige per win):
- 3.5 wins/week × 5 prestige = 17.5 prestige/week
- Weeks to 1,000 prestige: ~57 weeks (too slow)

**Silver League** (10 prestige per win):
- 3.5 wins/week × 10 prestige = 35 prestige/week
- Weeks to 1,000 prestige: ~29 weeks

**Gold League** (20 prestige per win):
- 3.5 wins/week × 20 prestige = 70 prestige/week
- Weeks to 1,000 prestige: ~14 weeks

**Key Insight**: Prestige Rusher MUST advance leagues quickly to maximize prestige accumulation. The balanced high-level build (Combat 15, Defense 15, Mobility 15) is optimized for consistent wins to accelerate league advancement.

**Tournament Access**: Once you reach 1,000 prestige (weeks 2-4 in Silver), purchase Booking Office (₡500K) to unlock tournaments for accelerated prestige gains.

#### Economic Summary

**Strengths**:
- Balanced high-level build ensures consistent wins
- Optimized for prestige accumulation
- Scales excellently with league advancement
- Low repair costs (₡3,960 per loss) due to good defense

**Weaknesses**:
- Highest operating costs (₡8,400/week) from three Training Academies
- Requires 34.2% win rate to break even in Bronze
- Tight profit margins in Bronze (₡14,490/week)
- Requires above-average performance to stay profitable

**Recommendation**: Prestige Rusher is ideal for competitive players focused on rapid progression and prestige accumulation. Requires consistent performance (40-50% win rate minimum) and commitment to advancing leagues quickly. Not recommended for new players or those learning game mechanics. Best suited for experienced players who understand combat systems and can maintain high win rates.

---

## Economic Analysis Summary

This table compares the economic performance of all 10 archetypes across Bronze, Silver, and Gold leagues:

| Archetype | Bronze Net/Week | Silver Net/Week | Gold Net/Week | Break-Even (Bronze) | Bankruptcy Risk (Bronze) | Starting Buffer |
|-----------|-----------------|-----------------|---------------|---------------------|--------------------------|-----------------|
| Tank Fortress | ₡20,492 | ₡57,242 | ₡130,742 | 22.2% | Very Low | ₡756,000 |
| Glass Cannon | ₡15,977 | ₡52,727 | ₡126,227 | 31.9% | Medium | ₡946,500 |
| Speed Demon | ₡13,195 | ₡49,945 | ₡123,445 | 33.6% | Medium-High | ₡66,500 |
| Balanced Brawler | ₡24,500 | ₡61,250 | ₡134,750 | 20.8% | Extremely Low | ₡1,390,000 |
| Facility Investor | ₡8,277 | ₡45,027 | ₡118,527 | 42.1% | Medium-High | ₡150,000 |
| Two-Robot Specialist | ₡21,875 | ₡58,625 | ₡132,125 | 25.4% | Low | ₡150,000 |
| Melee Specialist | ₡19,512 | ₡56,262 | ₡129,762 | 28.9% | Low-Medium | ~₡400,000 |
| Ranged Sniper | ₡17,990 | ₡54,740 | ₡128,240 | 30.5% | Medium | ~₡400,000 |
| AI Tactician | ₡20,650 | ₡57,400 | ₡130,900 | 27.2% | Low-Medium | ~₡400,000 |
| Prestige Rusher | ₡14,490 | ₡51,240 | ₡124,740 | 34.2% | Medium | ₡300,500 |

### Key Insights

**Safest Archetypes** (Bronze League):
1. **Balanced Brawler**: 20.8% break-even, ₡1.39M buffer, ₡24,500/week profit
2. **Tank Fortress**: 22.2% break-even, ₡756K buffer, ₡20,492/week profit
3. **Two-Robot Specialist**: 25.4% break-even, ₡150K buffer, ₡21,875/week profit

**Riskiest Archetypes** (Bronze League):
1. **Facility Investor**: 42.1% break-even, ₡150K buffer, ₡8,277/week profit
2. **Prestige Rusher**: 34.2% break-even, ₡300.5K buffer, ₡14,490/week profit
3. **Speed Demon**: 33.6% break-even, ₡66.5K buffer, ₡13,195/week profit

**Most Profitable** (Gold League at 50% win rate):
1. **Balanced Brawler**: ₡134,750/week
2. **Two-Robot Specialist**: ₡132,125/week
3. **AI Tactician**: ₡130,900/week
4. **Tank Fortress**: ₡130,742/week

**League Advancement Impact**:
- All archetypes see 2× income increase per league tier
- Operating costs remain flat (facility costs don't scale)
- Repair costs remain relatively flat (damage % may decrease slightly with better play)
- Result: Net income increases dramatically with each league advancement

**Strategic Recommendation**: Choose your archetype based on your risk tolerance and skill level:
- **New players**: Balanced Brawler or Tank Fortress (safest options)
- **Experienced players**: Glass Cannon, Prestige Rusher, or Speed Demon (higher risk, higher reward)
- **Long-term players**: Facility Investor (struggles early, pays off over months)
- **Strategic players**: AI Tactician or Two-Robot Specialist (moderate risk, excellent scaling)

---

## Early Game Strategy (Days 1-30)

This section provides detailed guidance for your first 30 days of gameplay for each archetype. The early game is critical for establishing a sustainable stable and avoiding bankruptcy. Each strategy specifies battle frequency, income expectations across Bronze and Silver leagues, league progression goals, common pitfalls to avoid, and repair cost management techniques.

**Key Principles for All Archetypes**:
- **League Income Scaling**: Bronze pays ₡5-10K per win, Silver pays ₡10-20K per win, Gold pays ₡20-40K per win
- **Participation Rewards**: You earn participation rewards even when losing (₡1.5K Bronze, ₡3K Silver, ₡6K Gold)
- **Repair Cost Management**: Repair costs are based on total attributes × damage % × condition multiplier
- **Reserve Buffer**: Your starting buffer is for emergencies only - don't spend it frivolously
- **League Advancement**: Advancing from Bronze to Silver doubles your income; advancing to Gold quadruples it

---

### Tank Fortress - Early Game Strategy

**Days 1-7 (Week 1)**

**Battle Frequency**: 5-7 battles per week
- Focus on learning your defensive capabilities
- Use Defensive stance with 70% yield threshold
- Let opponents exhaust themselves against your shields

**Income Expectations**:
- League: Bronze (starting league)
- Win rate target: 45-55% (balanced matchmaking)
- Weekly income: ₡26,250-₡36,750 (5-7 battles at 50% win rate)
  - Calculation: (3.5 wins × ₡7,500) + (7 battles × ₡1,500 participation) = ₡36,750
- Weekly costs: ₡16,258 (facility costs + repairs)
- Weekly net: ₡20,492 (sustainable)

**League Progression Goals**:
- Week 1: Remain in Bronze, focus on learning
- Week 2-3: Push for Bronze → Silver promotion (requires consistent 55%+ win rate)
- Week 4: Establish yourself in Silver league

**Common Pitfalls**:
- **Over-defending**: Don't yield too early (70% threshold is optimal)
- **Ignoring offense**: Your Counter Protocols need damage to trigger - don't be too passive
- **Facility temptation**: Don't buy Repair Bay yet - your repair costs are already low
- **Weapon upgrades**: Stick with Combat Shield + Power Sword - don't experiment with other weapons

**Repair Cost Management**:
- Your defensive build keeps repair costs low (₡8,000-₡12,000 per week)
- High Hull Integrity and Armor Plating reduce damage taken
- Defensive stance further reduces damage
- Even at 50% win rate, repairs are affordable in Bronze
- **League scaling benefit**: As you advance to Silver/Gold, income doubles/quadruples but repair costs stay flat

**Key Actions**:
1. Battle 5-7 times per week to build prestige and income
2. Save all earnings - no major purchases yet
3. Focus on mastering Defensive stance and yield timing
4. Track your win rate - aim for 50%+ to advance leagues
5. Build your reserve to ₡1,000,000+ before considering expansions

**Avoid**:
- Buying additional weapons or robots
- Purchasing new facilities
- Upgrading attributes beyond starting levels
- Experimenting with Offensive stance (stick to Defensive)

---
### Glass Cannon - Early Game Strategy

**Days 1-7 (Week 1)**

**Battle Frequency**: 5-6 battles per week (conservative start)
- Focus on ending battles quickly to minimize damage taken
- Use Offensive stance with 40% yield threshold
- Your goal is to eliminate opponents before they can hurt you

**Income Expectations**:
- League: Bronze (starting league)
- Win rate target: 50-55% (need to win more to offset repair costs)
- Weekly income: ₡26,250-₡31,500 (5-6 battles at 50% win rate)
  - Calculation: (3 wins × ₡7,500) + (6 battles × ₡1,500 participation) = ₡31,500
- Weekly costs: ₡15,523 (facility costs + high repair costs)
- Weekly net: ₡15,977 (tight margins in Bronze)

**League Progression Goals**:
- Week 1-2: **CRITICAL - Push hard for Silver promotion**
- Week 3-4: Establish yourself in Silver league
- **Why urgent**: Bronze income (₡5-10K/win) barely covers your high repair costs. Silver income (₡10-20K/win) makes this build sustainable.

**Common Pitfalls**:
- **Fighting too much in Bronze**: Each loss costs ₡15,000-₡20,000 in repairs - you can't afford many losses
- **Wrong stance**: Never use Defensive stance - you need to end battles fast
- **High yield threshold**: Don't set yield above 40% - take the loss rather than prolonged damage
- **Overconfidence**: One bad losing streak in Bronze can bankrupt you

**Repair Cost Management**:
- **This is your biggest challenge**: Low Hull Integrity means high damage when you lose
- Average repair cost per loss: ₡18,000-₡22,000 (60-70% damage)
- Average repair cost per win: ₡3,000-₡5,000 (10-20% damage)
- **Critical**: You MUST maintain 50%+ win rate or you'll go bankrupt
- **League scaling benefit**: Silver doubles your income (₡10-20K/win) while repair costs stay the same - suddenly profitable!

**Key Actions**:
1. Battle 5-6 times per week - don't overextend
2. Focus on quick, decisive victories
3. **Push aggressively for Silver promotion** - this is your #1 priority
4. Save your ₡946,500 buffer - it's your bankruptcy insurance
5. If you drop below ₡500,000 balance, reduce battle frequency to 3-4/week

**Avoid**:
- Battling more than 6 times per week in Bronze (too risky)
- Any additional spending - you need every credit
- Experimenting with different weapons or stances
- Ignoring your balance - track it daily

**Recovery Plan** (if balance drops below ₡300,000):
1. Reduce battles to 3 per week
2. Focus only on battles you're confident you can win
3. Consider selling Training Facility (refund ₡150,000) if desperate
4. Grind slowly until you reach Silver league

---
### Speed Demon - Early Game Strategy

**Days 1-7 (Week 1)**

**Battle Frequency**: 6-7 battles per week
- Focus on overwhelming opponents with rapid attacks
- Use Balanced stance with 50% yield threshold
- Your dual-wield setup gives you consistent DPS

**Income Expectations**:
- League: Bronze (starting league)
- Win rate target: 50-55%
- Weekly income: ₡26,250-₡36,750 (6-7 battles at 50% win rate)
  - Calculation: (3.5 wins × ₡7,500) + (7 battles × ₡1,500 participation) = ₡36,750
- Weekly costs: ₡23,555 (high facility costs + moderate repairs)
- Weekly net: ₡13,195 (tight but sustainable)

**League Progression Goals**:
- Week 1-2: Learn dual-wield mechanics in Bronze
- Week 3-4: Push for Silver promotion
- Week 4+: Establish yourself in Silver league

**Common Pitfalls**:
- **Weapon confusion**: Don't switch between your dual-wield weapons - let the AI optimize usage
- **Overextending**: Your moderate HP means you can't tank damage - focus on positioning
- **Facility costs**: You have high operating costs (₡17,555/week) - don't add more facilities
- **Buffer spending**: Your ₡66,500 buffer is tiny - protect it carefully

**Repair Cost Management**:
- Moderate repair costs: ₡6,000-₡8,000 per week at 50% win rate
- Your Attack Speed and Evasion Systems help you avoid damage
- Balanced stance provides good damage/defense trade-off
- **League scaling benefit**: Silver income (₡10-20K/win) makes your high facility costs manageable

**Key Actions**:
1. Battle 6-7 times per week to maximize income
2. Focus on mastering dual-wield positioning
3. Save earnings to build buffer to ₡300,000+
4. Track facility costs - they're eating 75% of your Bronze income
5. Push for Silver promotion by Week 3-4

**Avoid**:
- Buying additional weapons (you already have 2)
- Purchasing new facilities (operating costs too high)
- Upgrading facilities (can't afford it yet)
- Experimenting with Single or Two-Handed loadouts

---

### Balanced Brawler - Early Game Strategy

**Days 1-7 (Week 1)**

**Battle Frequency**: 5-7 battles per week (flexible)
- Focus on learning game mechanics safely
- Use Balanced stance with 60% yield threshold
- Your well-rounded build forgives mistakes

**Income Expectations**:
- League: Bronze (starting league)
- Win rate target: 45-55% (very forgiving)
- Weekly income: ₡26,250-₡36,750 (5-7 battles at 50% win rate)
  - Calculation: (3.5 wins × ₡7,500) + (7 battles × ₡1,500 participation) = ₡36,750
- Weekly costs: ₡12,250 (low facility costs + low repairs)
- Weekly net: ₡24,500 (highest profit in Bronze)

**League Progression Goals**:
- Week 1-2: Learn at your own pace in Bronze
- Week 3-4: Optionally push for Silver (no rush)
- **No pressure**: This build is profitable even in Bronze

**Common Pitfalls**:
- **Overconfidence**: Don't get reckless - your safety comes from balanced play
- **Premature spending**: You have ₡1.39M buffer - don't waste it on unnecessary upgrades
- **Ignoring learning**: Use this safe period to master game mechanics
- **Wrong stance**: Balanced stance is optimal - don't switch to Offensive or Defensive

**Repair Cost Management**:
- **Easiest archetype**: Low repair costs (₡5,000-₡7,000 per week)
- Balanced attributes mean you take moderate damage
- Balanced stance provides good survivability
- Even at 40% win rate, you're still profitable
- **League scaling benefit**: Already profitable in Bronze, becomes extremely profitable in Silver/Gold

**Key Actions**:
1. Battle 5-7 times per week at comfortable pace
2. Focus on learning combat mechanics, stances, and yield timing
3. Save earnings - you're accumulating ₡24,500/week profit
4. Experiment with different battle strategies (you can afford mistakes)
5. Advance to Silver when ready (no rush)

**Avoid**:
- Spending your massive buffer frivolously
- Buying facilities you don't need yet
- Rushing league advancement (you're profitable everywhere)
- Changing your balanced attribute distribution

**Recommended Path**:
- Spend first month learning and saving
- Build balance to ₡2,000,000+
- Then consider expansion (2nd robot, facilities, or attribute upgrades)

---
### Facility Investor - Early Game Strategy

**Days 1-7 (Week 1)**

**Battle Frequency**: 5-6 battles per week (conservative)
- Focus on steady, sustainable income
- Use Balanced stance with 60% yield threshold
- Your budget robot is sufficient for Bronze league

**Income Expectations**:
- League: Bronze (starting league)
- Win rate target: 45-50% (modest expectations)
- Weekly income: ₡26,250-₡31,500 (5-6 battles at 50% win rate)
  - Calculation: (3 wins × ₡7,500) + (6 battles × ₡1,500 participation) = ₡31,500
  - **Plus passive income**: ₡7,000/week from Income Generator Level 1
  - **Total**: ₡38,500/week
- Weekly costs: ₡30,223 (very high facility costs + moderate repairs)
- Weekly net: ₡8,277 (lowest profit in Bronze, but sustainable)

**League Progression Goals**:
- Week 1-4: Remain in Bronze, focus on stability
- Month 2-3: Gradually push for Silver
- **No rush**: Your facilities pay off over months, not weeks

**Common Pitfalls**:
- **Impatience**: This strategy is slow - don't panic about low profits
- **Facility upgrades**: Don't upgrade facilities yet - you can't afford higher operating costs
- **Robot envy**: Don't compare yourself to other archetypes - your payoff comes later
- **Overspending buffer**: Your ₡150K buffer is small - protect it carefully

**Repair Cost Management**:
- Moderate repair costs: ₡6,000-₡8,000 per week
- Your balanced budget build is adequate for Bronze
- Training Facility Level 1 saves 5% on future attribute upgrades
- Repair Bay Level 1 saves 5% on all repairs (₡300-₡400/week savings)
- **League scaling benefit**: Passive income stays flat, but battle income doubles in Silver

**Key Actions**:
1. Battle 5-6 times per week for steady income
2. **Collect passive income**: ₡1,000/day from Income Generator
3. Focus on consistency, not growth
4. Save earnings slowly - target ₡500,000 balance by end of month
5. Track your facility ROI - they'll pay off after 3-6 months

**Avoid**:
- Upgrading facilities (operating costs will kill you)
- Buying additional robots or weapons
- Comparing your profits to other archetypes
- Battling too frequently (you can't afford many losses)

**Long-Term Vision**:
- **Month 1**: Struggle with low profits (₡8,277/week in Bronze)
- **Month 2-3**: Advance to Silver, profits improve (₡45,027/week)
- **Month 4-6**: Facilities start paying for themselves
- **Month 6+**: Passive income + cost savings make you very profitable

**Recovery Plan** (if balance drops below ₡100,000):
1. Reduce battles to 3-4 per week
2. Consider selling Income Generator (refund ₡400,000) if desperate
3. Focus on battle income only until stable
4. This is a last resort - facilities are your long-term investment

---
### Two-Robot Specialist - Early Game Strategy

**Days 1-7 (Week 1)**

**Battle Frequency**: 6-7 battles per week
- **Robot selection strategy**: Use Tank robot for tough opponents, Glass Cannon for weaker opponents
- Learn to assess opponent strength before battle
- Your flexibility is your advantage

**Income Expectations**:
- League: Bronze (starting league)
- Win rate target: 50-55% (robot selection improves win rate)
- Weekly income: ₡26,250-₡36,750 (6-7 battles at 50% win rate)
  - Calculation: (3.5 wins × ₡7,500) + (7 battles × ₡1,500 participation) = ₡36,750
- Weekly costs: ₡14,875 (Roster Expansion + moderate repairs)
- Weekly net: ₡21,875 (good profit)

**League Progression Goals**:
- Week 1-2: Learn robot selection strategy
- Week 3-4: Push for Silver promotion
- **Key advantage**: You can select optimal robot per matchup

**Common Pitfalls**:
- **Wrong robot selection**: Don't use Glass Cannon against strong opponents
- **Overusing one robot**: Balance usage between both robots to build prestige evenly
- **Repair cost confusion**: Track repairs per robot separately
- **Roster Expansion costs**: Remember you're paying ₡3,500/week for 2 robot slots

**Repair Cost Management**:
- **Variable costs**: Tank robot has low repairs (₡3,000-₡5,000/week), Glass Cannon has high repairs (₡8,000-₡12,000/week)
- Average combined: ₡11,000/week at 50% win rate
- **Strategy**: Use Tank robot more often to keep repair costs down
- **League scaling benefit**: Income doubles in Silver while repair costs stay flat

**Robot Selection Guide**:
- **Use Tank robot when**:
  - Opponent has high Combat Power (offensive build)
  - You're unsure about opponent strength
  - You're on a losing streak (play safe)
  - You need to conserve credits (lower repair costs)

- **Use Glass Cannon robot when**:
  - Opponent has low Hull Integrity (defensive build)
  - You're confident you can win quickly
  - You're on a winning streak (capitalize on momentum)
  - You want to maximize prestige gains (higher risk = higher prestige)

**Key Actions**:
1. Battle 6-7 times per week with strategic robot selection
2. Track win rates per robot to optimize selection
3. Focus on learning opponent assessment
4. Save earnings to build buffer to ₡500,000+
5. Push for Silver promotion by Week 3-4

**Avoid**:
- Using Glass Cannon robot too often (repair costs spike)
- Buying a 3rd robot (can't afford Roster Expansion Level 2 yet)
- Upgrading attributes unevenly (both robots need balanced upgrades)
- Ignoring Roster Expansion operating costs

---

### Melee Specialist - Early Game Strategy

**Days 1-7 (Week 1)**

**Battle Frequency**: 6-7 battles per week
- Focus on closing distance and landing devastating melee strikes
- Use Offensive stance with 50% yield threshold
- Your Hydraulic Systems give you high melee damage

**Income Expectations**:
- League: Bronze (starting league)
- Win rate target: 50-55%
- Weekly income: ₡26,250-₡36,750 (6-7 battles at 50% win rate)
  - Calculation: (3.5 wins × ₡7,500) + (7 battles × ₡1,500 participation) = ₡36,750
- Weekly costs: ₡17,238 (Training Facility + moderate repairs)
- Weekly net: ₡19,512 (good profit)

**League Progression Goals**:
- Week 1-2: Master melee positioning in Bronze
- Week 3-4: Push for Silver promotion
- **Key skill**: Learn to close distance against ranged opponents

**Common Pitfalls**:
- **Ranged vulnerability**: You take damage closing distance - don't panic
- **Wrong weapon**: Stick with Heavy Hammer - don't switch to ranged weapons
- **Overaggression**: 50% yield threshold is optimal - don't go lower
- **Ignoring positioning**: Melee combat requires good positioning - practice it

**Repair Cost Management**:
- Moderate repair costs: ₡10,000-₡12,000 per week
- You take damage closing distance, but high Hull Integrity helps
- Offensive stance increases damage taken but shortens battles
- **League scaling benefit**: Silver income (₡10-20K/win) makes repair costs very manageable

**Key Actions**:
1. Battle 6-7 times per week to build melee skills
2. Focus on positioning and closing distance
3. Save earnings to build buffer to ₡700,000+
4. Track win rate against ranged vs melee opponents
5. Push for Silver promotion by Week 3-4

**Avoid**:
- Buying ranged weapons (stick to melee specialization)
- Using Defensive stance (too passive for melee)
- Fighting from range (your strength is close combat)
- Upgrading non-melee attributes

---
### Ranged Sniper - Early Game Strategy

**Days 1-7 (Week 1)**

**Battle Frequency**: 6-7 battles per week
- Focus on maintaining distance and landing accurate shots
- Use Balanced stance with 50% yield threshold
- Your Targeting Systems give you high accuracy and penetration

**Income Expectations**:
- League: Bronze (starting league)
- Win rate target: 50-55%
- Weekly income: ₡26,250-₡36,750 (6-7 battles at 50% win rate)
  - Calculation: (3.5 wins × ₡7,500) + (7 battles × ₡1,500 participation) = ₡36,750
- Weekly costs: ₡18,760 (Training Facility + moderate repairs)
- Weekly net: ₡17,990 (good profit)

**League Progression Goals**:
- Week 1-2: Master ranged combat in Bronze
- Week 3-4: Push for Silver promotion
- **Key skill**: Learn to maintain distance and maximize accuracy

**Common Pitfalls**:
- **Melee vulnerability**: If opponent closes distance, you're in trouble - yield if necessary
- **Wrong weapon**: Stick with Railgun - don't switch to melee weapons
- **Overconfidence**: Your accuracy is high but not perfect - don't assume every shot hits
- **Ignoring positioning**: Ranged combat requires distance management

**Repair Cost Management**:
- Moderate repair costs: ₡11,000-₡13,000 per week
- You take damage when opponents close distance
- Balanced stance provides good survivability
- **League scaling benefit**: Silver income (₡10-20K/win) makes repair costs very manageable

**Key Actions**:
1. Battle 6-7 times per week to build ranged skills
2. Focus on accuracy and distance management
3. Save earnings to build buffer to ₡700,000+
4. Track win rate against melee vs ranged opponents
5. Push for Silver promotion by Week 3-4

**Avoid**:
- Buying melee weapons (stick to ranged specialization)
- Using Offensive stance (too risky when opponent closes distance)
- Fighting at close range (your strength is distance)
- Upgrading non-ranged attributes

---

### AI Tactician - Early Game Strategy

**Days 1-7 (Week 1)**

**Battle Frequency**: 6-7 battles per week
- Focus on letting your AI make optimal decisions
- Use Balanced stance with 60% yield threshold (AI will optimize)
- Your Combat Algorithms give you superior tactical decision-making

**Income Expectations**:
- League: Bronze (starting league)
- Win rate target: 50-55% (AI optimization improves win rate)
- Weekly income: ₡26,250-₡36,750 (6-7 battles at 50% win rate)
  - Calculation: (3.5 wins × ₡7,500) + (7 battles × ₡1,500 participation) = ₡36,750
- Weekly costs: ₡16,100 (AI Training Academy + moderate repairs)
- Weekly net: ₡20,650 (good profit)

**League Progression Goals**:
- Week 1-2: Learn to trust your AI in Bronze
- Week 3-4: Push for Silver promotion
- **Key advantage**: AI gets better against stronger opponents

**Common Pitfalls**:
- **Micromanaging**: Don't override AI decisions - trust the algorithms
- **Wrong expectations**: AI isn't magic - you still need good attributes
- **Facility costs**: AI Training Academy is expensive (₡9,100/week) - don't add more facilities
- **Impatience**: AI advantages become more apparent against skilled opponents

**Repair Cost Management**:
- Moderate repair costs: ₡7,000-₡9,000 per week
- AI optimizes damage mitigation and offensive timing
- Balanced stance provides good survivability
- **League scaling benefit**: AI becomes more valuable in higher leagues (better opponents = more tactical decisions)

**Key Actions**:
1. Battle 6-7 times per week to train your AI
2. Focus on observing AI decision-making patterns
3. Save earnings to build buffer to ₡700,000+
4. Track how AI performs against different opponent types
5. Push for Silver promotion by Week 3-4

**Avoid**:
- Overriding AI decisions manually
- Buying additional facilities (operating costs too high)
- Comparing your performance to simpler builds (AI shines in higher leagues)
- Upgrading non-AI attributes

**Long-Term Vision**:
- **Bronze**: AI provides modest advantage (50-55% win rate)
- **Silver**: AI optimization becomes more valuable (52-57% win rate)
- **Gold+**: AI excels against skilled opponents (55-60% win rate)

---
### Prestige Rusher - Early Game Strategy

**Days 1-7 (Week 1)**

**Battle Frequency**: 7-8 battles per week (aggressive)
- Focus on maximizing wins and prestige accumulation
- Use Balanced stance with 55% yield threshold
- Your win-optimized build is designed for consistent victories

**Income Expectations**:
- League: Bronze (starting league)
- Win rate target: 55-60% (must win more than average)
- Weekly income: ₡31,500-₡42,000 (7-8 battles at 55% win rate)
  - Calculation: (4.4 wins × ₡7,500) + (8 battles × ₡1,500 participation) = ₡45,000
- Weekly costs: ₡30,510 (Booking Office + moderate repairs)
- Weekly net: ₡14,490 (tight but sustainable if winning)

**League Progression Goals**:
- Week 1-2: **CRITICAL - Push hard for Silver promotion**
- Week 3: Establish yourself in Silver
- Week 4: Push for Gold promotion
- **Why urgent**: Higher leagues = more prestige per win (Bronze: 5, Silver: 10, Gold: 20)

**Common Pitfalls**:
- **Overconfidence**: You need 55%+ win rate to be profitable - don't assume you'll win
- **Booking Office costs**: You're paying ₡24,010/week for tournament access - it only pays off if you win
- **Burnout**: 7-8 battles per week is aggressive - don't burn out
- **Wrong priorities**: Prestige is your goal, not credits - focus on wins

**Repair Cost Management**:
- Moderate repair costs: ₡6,500-₡8,500 per week
- Your balanced build keeps repairs manageable
- **Critical**: You can't afford many losses - each loss costs ₡12,000-₡15,000 in repairs
- **League scaling benefit**: Silver income (₡10-20K/win) makes your high facility costs sustainable

**Prestige Accumulation**:
- **Bronze**: 5 prestige per win
- **Silver**: 10 prestige per win (2× Bronze)
- **Gold**: 20 prestige per win (4× Bronze)
- **Target**: Reach 1,000 prestige by end of Month 1 (requires ~100-150 wins across Bronze/Silver)

**Key Actions**:
1. Battle 7-8 times per week to maximize prestige
2. **Push aggressively for league advancement** - this is your #1 priority
3. Focus on consistent wins, not flashy victories
4. Track prestige accumulation daily
5. Save earnings to build buffer to ₡500,000+

**Avoid**:
- Battling less than 7 times per week (you need volume)
- Experimenting with risky strategies (consistency > flashiness)
- Spending credits on anything except attribute upgrades
- Ignoring your win rate (below 55% = bankruptcy risk)

**Recovery Plan** (if win rate drops below 50%):
1. Reduce battles to 5-6 per week
2. Focus on easier opponents
3. Consider selling Booking Office (refund ₡200,000) if desperate
4. Reassess whether Prestige Rusher is right for you

**Tournament Strategy**:
- **Week 1-2**: Don't enter tournaments yet (Bronze tournaments have low prestige rewards)
- **Week 3-4**: Enter Silver tournaments if you've advanced (10-20 prestige per win)
- **Month 2+**: Tournaments become your primary prestige source

---

## Early Game Strategy Summary

This table compares the early game strategies across all 10 archetypes:

| Archetype | Battles/Week | Bronze Net/Week | League Goal | Risk Level | Key Focus |
|-----------|--------------|-----------------|-------------|------------|-----------|
| Tank Fortress | 5-7 | ₡20,492 | Silver by Week 4 | Very Low | Learn defensive play |
| Glass Cannon | 5-6 | ₡15,977 | **Silver by Week 2** | High | Advance leagues ASAP |
| Speed Demon | 6-7 | ₡13,195 | Silver by Week 3-4 | Medium | Master dual-wield |
| Balanced Brawler | 5-7 | ₡24,500 | No rush | Very Low | Learn mechanics safely |
| Facility Investor | 5-6 | ₡8,277 | No rush | Medium | Build passive income |
| Two-Robot Specialist | 6-7 | ₡21,875 | Silver by Week 3-4 | Low | Master robot selection |
| Melee Specialist | 6-7 | ₡19,512 | Silver by Week 3-4 | Medium | Master positioning |
| Ranged Sniper | 6-7 | ₡17,990 | Silver by Week 3-4 | Medium | Master accuracy |
| AI Tactician | 6-7 | ₡20,650 | Silver by Week 3-4 | Low | Trust AI decisions |
| Prestige Rusher | 7-8 | ₡14,490 | **Silver by Week 2** | High | Maximize prestige |

### Universal Early Game Tips

**For All Archetypes**:
1. **Track your balance daily** - Know exactly how much you have
2. **Don't spend your buffer** - It's for emergencies only
3. **Focus on consistency** - Steady 50% win rate beats streaky 60%/40%
4. **Learn yield timing** - Knowing when to surrender saves credits
5. **Advance leagues when ready** - Higher leagues = dramatically higher income

**High-Risk Archetypes** (Glass Cannon, Prestige Rusher, Speed Demon):
- Must advance to Silver quickly (Bronze income too low)
- Can't afford losing streaks
- Require 55%+ win rate to be sustainable
- Should reduce battle frequency if balance drops

**Low-Risk Archetypes** (Balanced Brawler, Tank Fortress, Two-Robot Specialist):
- Profitable even in Bronze
- Can afford to learn at own pace
- Forgiving of mistakes and losses
- Can experiment with strategies safely

**Economic Archetypes** (Facility Investor):
- Slow start but sustainable
- Focus on long-term payoff, not short-term profits
- Requires patience and discipline
- Pays off after 3-6 months

---
## Mid Game Transition (Days 30-120)

After establishing your early game foundation, the mid game is about strategic expansion, facility upgrades, and scaling your operations. This section provides guidance for each archetype on when and how to grow beyond your starting setup.

### Tank Fortress - Mid Game Transition

**Days 31-60 (Month 2)**

**Expansion Triggers**:
- Balance reaches ₡800,000+ (enough for major investment + buffer)
- Consistent Silver league performance (₡10-20K per win)
- Win rate stabilized at 50%+ for 2+ weeks

**Facility Upgrade Priorities**:
1. **Repair Bay Level 2** (₡250,000) - Increases discount to 10%, saves ₡1,400-₡2,100/week
   - ROI: 17-25 weeks (reasonable for defensive build with high repair volume)
   - Operating cost increases to ₡1,500/day (₡10,500/week)
2. **Defense Training Academy Level 1** (₡200,000) - 5% discount on defensive attribute upgrades
   - Only if planning ₡4M+ in defensive upgrades (₡200K / 0.05 = ₡4M break-even)
   - Operating cost: ₡2,000/day (₡14,000/week)

**Income Diversification**:
- **Silver league**: ₡73,500/week (7 battles, 50% win rate)
- **Gold league** (if reached): ₡147,000/week
- Consider Income Generator Level 1 (₡800,000) if balance exceeds ₡1.5M
  - Provides ₡5,000-₡10,000/week passive income
  - Operating cost: ₡1,000/day (₡7,000/week)
  - ROI: 80-160 weeks (long-term investment)

**League Advancement Targets**:
- Month 2: Establish Silver, push for Gold
- Month 3: Reach Gold (₡20-40K per win = game-changer)
- Month 4: Stabilize in Gold, consider Platinum push

**Robot/Weapon Expansion**:
- **Don't rush second robot** - Tank Fortress works best with single specialized robot
- Consider weapon experimentation only if balance exceeds ₡1M:
  - Try different shields (Energy Shield ₡200K vs Combat Shield ₡150K)
  - Try different weapons (War Hammer ₡300K vs Power Sword ₡200K)
- Storage Facility not needed unless collecting 5+ weapons

**Days 61-120 (Months 3-4)**

**Advanced Investments**:
- **Upgrade defensive attributes to Level 15-20**
  - Hull Integrity 1→15: ₡180,000
  - Armor Plating 1→15: ₡180,000
  - Shield Capacity 1→15: ₡180,000
- **Consider second robot** only if:
  - Balance exceeds ₡2M
  - Roster Expansion purchased (₡300,000)
  - Have specific strategic need (backup tank, different matchup coverage)

**Prestige Targets**:
- Month 2: 1,500-2,500 prestige
- Month 3: 3,000-5,000 prestige
- Month 4: 5,000-8,000 prestige
- Prestige unlocks: Better tournaments, merchandising, streaming revenue

**Transition Considerations**:
- Tank Fortress → **Facility Investor**: If you enjoy the economic game, start adding Income Generator, upgrade facilities
- Tank Fortress → **Two-Robot Specialist**: Add offensive robot for matchup flexibility
- Stay pure Tank Fortress if defensive play is working well

---

### Glass Cannon - Mid Game Transition

**Days 31-60 (Month 2)**

**Expansion Triggers**:
- **CRITICAL**: Must be in Silver or Gold by Day 30
- Balance reaches ₡600,000+ (smaller buffer due to higher income)
- Win rate 50%+ in Silver (if lower, focus on survival, not expansion)

**Facility Upgrade Priorities**:
1. **Training Facility Level 2** (₡350,000) - Increases discount to 10%
   - You're upgrading offensive attributes aggressively, so this pays off
   - Operating cost increases to ₡2,250/day (₡15,750/week)
2. **Combat Training Academy Level 1** (₡200,000) - 5% discount on combat attribute upgrades
   - Only if planning ₡4M+ in combat upgrades
   - Operating cost: ₡2,000/day (₡14,000/week)

**Income Diversification**:
- **Silver league**: ₡73,500/week (minimum acceptable)
- **Gold league**: ₡147,000/week (target by Month 2-3)
- **Platinum league**: ₡294,000/week (stretch goal by Month 4)
- Don't invest in Income Generator - focus on battle winnings

**League Advancement Targets**:
- Month 2: **Must be in Gold** (Silver income barely covers high repair costs)
- Month 3: Push for Platinum
- Month 4: Stabilize in Platinum or Diamond

**Robot/Weapon Expansion**:
- **Weapon upgrades**: Consider premium two-handed weapons
  - Plasma Cannon (₡500,000) - highest damage output
  - Railgun (₡400,000) - armor penetration specialist
- **Don't add second robot** - Glass Cannon is all-in on one devastating unit
- Storage Facility not needed (you're using one weapon)

**Days 61-120 (Months 3-4)**

**Advanced Investments**:
- **Max out offensive attributes to Level 20-25**
  - Combat Power 10→20: ₡247,500
  - Penetration 10→20: ₡247,500
  - Critical Systems 10→20: ₡247,500
- **Upgrade two-handed weapon** if not already premium
- **Consider defensive attributes** (Hull Integrity, Armor Plating) to reduce repair costs

**Prestige Targets**:
- Month 2: 2,000-3,500 prestige (aggressive battle schedule)
- Month 3: 4,500-7,000 prestige
- Month 4: 7,000-12,000 prestige

**Transition Considerations**:
- Glass Cannon → **Balanced Brawler**: If repair costs are unsustainable, invest in defensive attributes
- Glass Cannon → **Prestige Rusher**: If you're winning consistently, add Booking Office for tournaments
- Stay pure Glass Cannon if you're dominating and can afford repairs

---

### Speed Demon - Mid Game Transition

**Days 31-60 (Month 2)**

**Expansion Triggers**:
- Balance reaches ₡700,000+
- Consistent Silver league performance
- Win rate 50%+ with dual-wield mastery

**Facility Upgrade Priorities**:
1. **Weapons Workshop Level 2** (₡300,000) - Increases discount to 10%
   - Useful if experimenting with different dual-wield combinations
   - Operating cost increases to ₡1,500/day (₡10,500/week)
2. **Mobility Training Academy Level 1** (₡200,000) - 5% discount on mobility upgrades
   - Only if planning ₡4M+ in mobility upgrades
   - Operating cost: ₡2,000/day (₡14,000/week)

**Income Diversification**:
- **Silver league**: ₡73,500/week
- **Gold league**: ₡147,000/week (target by Month 3)
- Streaming revenue potential (high attack speed = exciting battles = fame)

**League Advancement Targets**:
- Month 2: Establish Silver, push for Gold
- Month 3: Reach Gold
- Month 4: Stabilize in Gold, consider Platinum

**Robot/Weapon Expansion**:
- **Weapon experimentation**: Try different dual-wield combinations
  - 2× Plasma Blades (₡200K each) - melee speed demon
  - 2× Machine Guns (₡150K each) - ranged speed demon
  - Mixed (Plasma Blade + Machine Gun) - hybrid approach
- **Storage Facility Level 1** (₡150,000) - Needed if collecting 5+ weapons
- **Don't add second robot** - Speed Demon works best with single specialized unit

**Days 61-120 (Months 3-4)**

**Advanced Investments**:
- **Max out speed attributes to Level 20-25**
  - Attack Speed 10→20: ₡247,500
  - Servo Motors 10→20: ₡247,500
  - Gyro Stabilizers 10→20: ₡247,500
- **Add defensive attributes** to improve survivability
  - Hull Integrity to Level 10-15
  - Armor Plating to Level 10-15

**Prestige Targets**:
- Month 2: 1,800-3,000 prestige
- Month 3: 3,500-6,000 prestige
- Month 4: 6,000-10,000 prestige

**Transition Considerations**:
- Speed Demon → **Balanced Brawler**: Add defensive attributes for sustainability
- Speed Demon → **Two-Robot Specialist**: Add tank robot for matchup flexibility
- Stay pure Speed Demon if dual-wield mastery is working

---

### Balanced Brawler - Mid Game Transition

**Days 31-60 (Month 2)**

**Expansion Triggers**:
- Balance reaches ₡900,000+ (you have large buffer)
- Comfortable in Silver league
- Ready to specialize beyond balanced approach

**Facility Upgrade Priorities**:
1. **Training Facility Level 2** (₡350,000) - Increases discount to 10%
   - You're upgrading many attributes, so this pays off well
   - Operating cost increases to ₡2,250/day (₡15,750/week)
2. **Repair Bay Level 2** (₡250,000) - Increases discount to 10%
   - Operating cost increases to ₡1,500/day (₡10,500/week)

**Income Diversification**:
- **Silver league**: ₡73,500/week (comfortable)
- **Gold league**: ₡147,000/week (target by Month 3-4)
- Consider Income Generator if balance exceeds ₡1.5M

**League Advancement Targets**:
- Month 2: Establish Silver (no rush)
- Month 3: Push for Gold when ready
- Month 4: Reach Gold or stay in Silver (both profitable)

**Robot/Weapon Expansion**:
- **Weapon experimentation**: Try different weapon types to find preference
  - Two-handed weapons (₡300-500K)
  - Dual-wield (₡150-200K each)
  - Weapon+Shield (₡150K shield + ₡200K weapon)
- **Storage Facility Level 1** (₡150,000) - Useful for weapon collection
- **Second robot** - Good option for Balanced Brawler
  - Roster Expansion (₡300,000)
  - Second robot (₡500,000) with specialized build

**Days 61-120 (Months 3-4)**

**Advanced Investments**:
- **Specialize your build**: Choose offensive, defensive, or mobility focus
  - Offensive: Combat Power, Penetration, Critical Systems to 15-20
  - Defensive: Hull Integrity, Armor Plating, Shield Capacity to 15-20
  - Mobility: Attack Speed, Servo Motors, Gyro Stabilizers to 15-20
- **Or stay balanced**: Bring all attributes to Level 12-15 evenly

**Prestige Targets**:
- Month 2: 1,500-2,500 prestige
- Month 3: 3,000-5,000 prestige
- Month 4: 5,000-8,000 prestige

**Transition Considerations**:
- Balanced Brawler → **Tank Fortress**: Specialize in defense
- Balanced Brawler → **Glass Cannon**: Specialize in offense
- Balanced Brawler → **Two-Robot Specialist**: Add specialized second robot
- Stay Balanced Brawler if versatility is working well

---

### Facility Investor - Mid Game Transition

**Days 31-60 (Month 2)**

**Expansion Triggers**:
- Balance reaches ₡500,000+ (facilities starting to pay off)
- Passive income from Income Generator accumulating
- Ready to add more infrastructure

**Facility Upgrade Priorities**:
1. **Income Generator Level 2** (₡900,000) - Increases passive income to ₡10-15K/week
   - Operating cost increases to ₡1,500/day (₡10,500/week)
   - Net passive income: ₡3,500-₡7,000/week
2. **Training Facility Level 2** (₡350,000) - Increases discount to 10%
3. **Repair Bay Level 2** (₡250,000) - Increases discount to 10%

**Income Diversification**:
- **Battle winnings**: ₡73,500/week (Silver)
- **Passive income**: ₡5,000-₡10,000/week (Income Generator Level 1)
- **Total**: ₡78,500-₡83,500/week
- **This is the payoff phase** - your facilities are starting to compound

**League Advancement Targets**:
- Month 2: Reach Silver
- Month 3: Push for Gold
- Month 4: Establish Gold (₡147K/week + passive income = ₡157K/week)

**Robot/Weapon Expansion**:
- **Upgrade your robot**: Now that facilities are in place, invest in attributes
  - Bring all attributes to Level 10-12
  - Focus on balanced build for consistent performance
- **Weapon upgrades**: Replace budget weapons with mid-tier options
  - Power Sword (₡200,000) or Plasma Rifle (₡250,000)

**Days 61-120 (Months 3-4)**

**Advanced Investments**:
- **More facilities**: Add specialized training academies
  - Combat Training Academy (₡200,000)
  - Defense Training Academy (₡200,000)
  - Mobility Training Academy (₡200,000)
- **Facility upgrades**: Upgrade existing facilities to Level 3-5
  - Income Generator Level 3 (₡1,000,000) - ₡15-20K/week passive
  - Training Facility Level 3 (₡400,000) - 15% discount
  - Repair Bay Level 3 (₡300,000) - 15% discount

**Prestige Targets**:
- Month 2: 1,000-2,000 prestige
- Month 3: 2,500-4,000 prestige
- Month 4: 4,000-7,000 prestige

**Transition Considerations**:
- Facility Investor → **Two-Robot Specialist**: Add second robot now that infrastructure is solid
- Facility Investor → **Prestige Rusher**: Add Booking Office for tournaments
- Stay Facility Investor - this is a long-term strategy that pays off over 6-12 months

---

### Two-Robot Specialist - Mid Game Transition

**Days 31-60 (Month 2)**

**Expansion Triggers**:
- Balance reaches ₡1,000,000+ (need buffer for multi-robot operations)
- Both robots performing well in Silver league
- Ready to optimize robot selection strategy

**Facility Upgrade Priorities**:
1. **Training Facility Level 2** (₡350,000) - Increases discount to 10%
   - You're upgrading attributes on 2 robots, so this pays off faster
   - Operating cost increases to ₡2,250/day (₡15,750/week)
2. **Repair Bay Level 2** (₡250,000) - Increases discount to 10%
   - Managing repairs for 2 robots makes this more valuable
   - Operating cost increases to ₡1,500/day (₡10,500/week)
3. **Roster Expansion Level 2** (₡350,000) - Allows 3 robots
   - Only if you want to add a third specialized robot
   - Operating cost increases to ₡1,000/day (₡7,000/week) for 3 robots

**Income Diversification**:
- **Silver league**: ₡73,500/week (7 battles, 50% win rate)
- **Gold league**: ₡147,000/week (target by Month 3)
- **Strategic robot selection** improves win rate above 50%
- Streaming revenue potential (variety of robots = interesting content)

**League Advancement Targets**:
- Month 2: Establish Silver with both robots
- Month 3: Push for Gold
- Month 4: Stabilize in Gold, consider Platinum

**Robot/Weapon Expansion**:
- **Optimize existing robots**: Upgrade attributes to Level 12-15
  - Tank robot: Hull Integrity, Armor Plating, Shield Capacity
  - Glass Cannon robot: Combat Power, Penetration, Critical Systems
- **Weapon upgrades**: Replace budget weapons with better options
  - Tank: Upgrade to Energy Shield (₡200K) + War Hammer (₡300K)
  - Glass Cannon: Upgrade to Plasma Cannon (₡500K)
- **Third robot consideration**: Only if balance exceeds ₡1.5M
  - Speed Demon build for matchup coverage
  - Requires Roster Expansion Level 2

**Days 61-120 (Months 3-4)**

**Advanced Investments**:
- **Specialize robots further**: Bring key attributes to Level 20+
  - Tank: Defensive attributes to 20
  - Glass Cannon: Offensive attributes to 20
- **Add third robot** if financially stable:
  - Speed Demon (₡500K + ₡300K attributes + ₡400K weapons = ₡1.2M total)
  - Provides matchup coverage for all scenarios
- **Storage Facility Level 1** (₡150,000) - Needed for 6+ weapons

**Prestige Targets**:
- Month 2: 1,800-3,000 prestige
- Month 3: 3,500-6,000 prestige
- Month 4: 6,000-10,000 prestige

**Transition Considerations**:
- Two-Robot Specialist → **Facility Investor**: Add Income Generator for passive income
- Two-Robot Specialist → **Three-Robot Specialist**: Add third robot for complete coverage
- Stay Two-Robot Specialist if matchup flexibility is working well

---

### Melee Specialist - Mid Game Transition

**Days 31-60 (Month 2)**

**Expansion Triggers**:
- Balance reaches ₡700,000+
- Consistent Silver league performance with melee dominance
- Win rate 50%+ with melee positioning mastery

**Facility Upgrade Priorities**:
1. **Combat Training Academy Level 2** (₡250,000) - Increases discount to 10%
   - You're upgrading Hydraulic Systems and Combat Power aggressively
   - Operating cost increases to ₡3,000/day (₡21,000/week)
2. **Training Facility Level 2** (₡350,000) - Increases discount to 10%
   - General upgrade discount helps with all attributes
   - Operating cost increases to ₡2,250/day (₡15,750/week)

**Income Diversification**:
- **Silver league**: ₡73,500/week
- **Gold league**: ₡147,000/week (target by Month 3)
- Streaming revenue potential (melee combat = exciting battles = fame)

**League Advancement Targets**:
- Month 2: Establish Silver, push for Gold
- Month 3: Reach Gold
- Month 4: Stabilize in Gold, consider Platinum

**Robot/Weapon Expansion**:
- **Weapon upgrades**: Consider premium melee weapons
  - War Hammer (₡300,000) - highest melee damage
  - Battle Axe (₡350,000) - armor penetration specialist
  - Energy Shield (₡200,000) - if using Weapon+Shield loadout
- **Don't add second robot** - Melee Specialist works best with single specialized unit
- Storage Facility not needed unless experimenting with multiple melee weapons

**Days 61-120 (Months 3-4)**

**Advanced Investments**:
- **Max out melee attributes to Level 20-25**
  - Hydraulic Systems 10→20: ₡247,500
  - Combat Power 10→20: ₡247,500
  - Servo Motors 10→20: ₡247,500 (for closing distance)
- **Add defensive attributes** to survive approach
  - Hull Integrity to Level 15-20
  - Armor Plating to Level 15-20
- **Consider mobility attributes** for positioning
  - Gyro Stabilizers to Level 12-15
  - Reaction Time to Level 12-15

**Prestige Targets**:
- Month 2: 1,800-3,000 prestige
- Month 3: 3,500-6,000 prestige
- Month 4: 6,000-10,000 prestige

**Transition Considerations**:
- Melee Specialist → **Tank Fortress**: Add defensive focus for survivability
- Melee Specialist → **Balanced Brawler**: Add ranged capabilities for flexibility
- Stay pure Melee Specialist if close combat mastery is working

---

### Ranged Sniper - Mid Game Transition

**Days 31-60 (Month 2)**

**Expansion Triggers**:
- Balance reaches ₡700,000+
- Consistent Silver league performance with precision strikes
- Win rate 50%+ with accuracy mastery

**Facility Upgrade Priorities**:
1. **Combat Training Academy Level 2** (₡250,000) - Increases discount to 10%
   - You're upgrading Targeting Systems and Penetration aggressively
   - Operating cost increases to ₡3,000/day (₡21,000/week)
2. **Training Facility Level 2** (₡350,000) - Increases discount to 10%
   - General upgrade discount helps with all attributes
   - Operating cost increases to ₡2,250/day (₡15,750/week)

**Income Diversification**:
- **Silver league**: ₡73,500/week
- **Gold league**: ₡147,000/week (target by Month 3)
- Precision gameplay = higher win rate potential = more income

**League Advancement Targets**:
- Month 2: Establish Silver, push for Gold
- Month 3: Reach Gold (precision matters more against skilled opponents)
- Month 4: Stabilize in Gold, push for Platinum

**Robot/Weapon Expansion**:
- **Weapon upgrades**: Consider premium ranged weapons
  - Plasma Cannon (₡500,000) - highest ranged damage
  - Railgun (₡400,000) - ultimate armor penetration
  - Sniper Rifle (₡350,000) - precision specialist
- **Don't add second robot** - Ranged Sniper works best with single specialized unit
- Storage Facility not needed unless experimenting with multiple ranged weapons

**Days 61-120 (Months 3-4)**

**Advanced Investments**:
- **Max out precision attributes to Level 20-25**
  - Targeting Systems 10→20: ₡247,500
  - Penetration 10→20: ₡247,500
  - Critical Systems 10→20: ₡247,500
- **Add defensive attributes** to survive if opponent closes distance
  - Hull Integrity to Level 12-15
  - Armor Plating to Level 12-15
- **Consider AI attributes** for optimal targeting
  - Combat Algorithms to Level 10-15
  - Threat Analysis to Level 10-15

**Prestige Targets**:
- Month 2: 1,800-3,000 prestige
- Month 3: 3,500-6,000 prestige
- Month 4: 6,000-10,000 prestige

**Transition Considerations**:
- Ranged Sniper → **Glass Cannon**: Add more offensive power for faster kills
- Ranged Sniper → **AI Tactician**: Add AI focus for optimal decision-making
- Stay pure Ranged Sniper if precision gameplay is working

---

### AI Tactician - Mid Game Transition

**Days 31-60 (Month 2)**

**Expansion Triggers**:
- Balance reaches ₡700,000+
- Consistent Silver league performance with AI optimization
- Win rate 50%+ with tactical mastery

**Facility Upgrade Priorities**:
1. **AI Training Academy Level 2** (₡550,000) - Increases discount to 10%
   - You're upgrading AI attributes aggressively
   - Operating cost increases to ₡3,500/day (₡24,500/week)
   - High operating cost but essential for AI focus
2. **Training Facility Level 2** (₡350,000) - Increases discount to 10%
   - General upgrade discount helps with all attributes
   - Operating cost increases to ₡2,250/day (₡15,750/week)

**Income Diversification**:
- **Silver league**: ₡73,500/week
- **Gold league**: ₡147,000/week (target by Month 3)
- AI optimization = higher win rate potential against skilled opponents

**League Advancement Targets**:
- Month 2: Establish Silver, push for Gold
- Month 3: Reach Gold (AI attributes shine against better opponents)
- Month 4: Stabilize in Gold, push for Platinum

**Robot/Weapon Expansion**:
- **Weapon upgrades**: AI works with any weapon, so choose based on preference
  - Balanced weapon (Power Sword ₡200K, Plasma Rifle ₡250K)
  - Or premium weapon (Plasma Cannon ₡500K, Railgun ₡400K)
- **Don't add second robot** - AI Tactician works best with single optimized unit
- Storage Facility not needed (AI optimizes whatever weapon you have)

**Days 61-120 (Months 3-4)**

**Advanced Investments**:
- **Max out AI attributes to Level 20-25**
  - Combat Algorithms 10→20: ₡247,500
  - Threat Analysis 10→20: ₡247,500
  - Adaptive AI 10→20: ₡247,500
  - Logic Cores 10→20: ₡247,500
  - Neural Networks 10→20: ₡247,500
- **Add complementary attributes** based on weapon choice
  - If melee: Hydraulic Systems, Combat Power
  - If ranged: Targeting Systems, Penetration
  - If balanced: Mix of offensive and defensive

**Prestige Targets**:
- Month 2: 1,800-3,000 prestige
- Month 3: 3,500-6,000 prestige
- Month 4: 6,000-10,000 prestige

**Transition Considerations**:
- AI Tactician → **Prestige Rusher**: Add Booking Office for competitive tournaments
- AI Tactician → **Balanced Brawler**: Add physical attributes for well-rounded build
- Stay pure AI Tactician if tactical gameplay is working

---

### Prestige Rusher - Mid Game Transition

**Days 31-60 (Month 2)**

**Expansion Triggers**:
- Balance reaches ₡800,000+
- **CRITICAL**: Must be in Gold by Day 45-60 (prestige accumulation accelerates)
- Win rate 55%+ (above-average performance required)

**Facility Upgrade Priorities**:
1. **Booking Office Level 1** (₡600,000) - Unlocks tournament access
   - Tournaments provide massive prestige boosts (50-200 prestige per tournament)
   - Operating cost: ₡3,000/day (₡21,000/week)
   - Essential for prestige rushing strategy
2. **Training Facility Level 2** (₡350,000) - Increases discount to 10%
   - You're upgrading attributes aggressively to maintain win rate
   - Operating cost increases to ₡2,250/day (₡15,750/week)

**Income Diversification**:
- **Silver league**: ₡73,500/week (minimum acceptable)
- **Gold league**: ₡147,000/week (target by Month 2)
- **Platinum league**: ₡294,000/week (stretch goal by Month 3-4)
- **Tournament winnings**: ₡50,000-₡200,000 per tournament (variable)
- Don't invest in Income Generator - focus on battle winnings and tournaments

**League Advancement Targets**:
- Month 2: **Must be in Gold** (prestige gains 2× Bronze)
- Month 3: Push for Platinum (prestige gains 3× Bronze)
- Month 4: Stabilize in Platinum or push for Diamond

**Robot/Weapon Expansion**:
- **Optimize for win rate**: Upgrade attributes that maximize victories
  - Balanced offensive/defensive build
  - Combat Power, Hull Integrity, Attack Speed to Level 15-20
- **Weapon upgrades**: Choose weapons that maximize win probability
  - Premium weapons if they improve win rate significantly
  - Otherwise stick with cost-effective options
- **Don't add second robot** - Focus resources on single optimized robot

**Days 61-120 (Months 3-4)**

**Advanced Investments**:
- **Tournament participation**: Enter 2-4 tournaments per month
  - Entry fees: ₡10,000-₡50,000 per tournament
  - Prestige rewards: 50-200 prestige per tournament
  - Prize money: ₡50,000-₡200,000 for top placements
- **Max out win-optimized attributes to Level 20-25**
  - Combat Power 10→20: ₡247,500
  - Hull Integrity 10→20: ₡247,500
  - Attack Speed 10→20: ₡247,500
  - Targeting Systems 10→20: ₡247,500
- **Booking Office Level 2** (₡700,000) - Access to higher-tier tournaments
  - Operating cost increases to ₡4,000/day (₡28,000/week)

**Prestige Targets**:
- Month 2: 2,500-4,000 prestige (aggressive schedule)
- Month 3: 5,000-8,000 prestige (tournament participation)
- Month 4: 8,000-15,000 prestige (high-tier tournaments)
- **Goal**: Reach 10,000+ prestige by Day 120 for major unlocks

**Transition Considerations**:
- Prestige Rusher → **Facility Investor**: Once prestige goals met, add passive income
- Prestige Rusher → **Two-Robot Specialist**: Add second robot for tournament flexibility
- Stay pure Prestige Rusher if competitive progression is the goal

---

---

## Build Synergies

This section explains how each archetype aligns with robot builds, combat systems, and attribute priorities. Understanding these synergies helps you optimize your robot's performance and make informed upgrade decisions.

### Tank Fortress - Build Synergies

**Robot Build Type**: Tank (High Defense, High Survivability)

**Loadout Type**: Weapon+Shield
- **Primary**: Combat Shield (₡150,000) or Energy Shield (₡200,000)
- **Secondary**: Power Sword (₡200,000) or War Hammer (₡300,000)
- **Rationale**: Shield provides massive damage reduction, weapon provides counter-attack capability

**Battle Stance**: Defensive (70% defensive, 30% offensive)
- Prioritize blocking and counter-attacks over aggressive strikes
- Let opponent exhaust themselves against your defenses
- Counter-attack when opponent is vulnerable

**Yield Threshold**: 20-30%
- Tank can survive significant damage before yielding
- Low yield threshold maximizes prestige and income per battle
- Repair costs are manageable due to high survivability

**Attribute Priorities**:

| Priority | Attribute | Target Level (Early) | Target Level (Mid) | Target Level (Late) | Rationale |
|----------|-----------|---------------------|-------------------|---------------------|-----------|
| 1 | Hull Integrity | 10 | 15 | 20-25 | Foundation of survivability - more HP = longer battles |
| 2 | Armor Plating | 10 | 15 | 20-25 | Reduces incoming damage - synergizes with high HP |
| 3 | Shield Capacity | 8 | 12 | 18-22 | Shield absorbs damage before HP - essential for Weapon+Shield |
| 4 | Counter Protocols | 6 | 10 | 15-18 | Punishes aggressive opponents - turns defense into offense |
| 5 | Damage Control | 5 | 8 | 12-15 | Reduces critical hit damage - prevents burst damage deaths |
| 6 | Combat Power | 5 | 8 | 12-15 | Enough damage to threaten opponents - prevents stalemates |
| 7 | Redundant Systems | 4 | 6 | 10-12 | Backup systems prevent catastrophic failures |

**Weapon Synergies**:
- **Combat Shield + Power Sword**: Classic tank combo - shield blocks, sword counters
- **Energy Shield + War Hammer**: Premium tank combo - energy shield has higher capacity, hammer hits harder
- **Shield Capacity attribute** directly increases shield effectiveness
- **Counter Protocols attribute** makes counter-attacks more devastating
- **Hydraulic Systems** (if using War Hammer) increases melee damage

**Why This Build Works**:
- High defensive attributes make you extremely hard to kill
- Shield provides additional damage absorption layer
- Counter Protocols turns enemy aggression into your advantage
- Low repair costs (you take less damage) = sustainable economics
- Forgiving playstyle - mistakes don't cost you battles

---

### Glass Cannon - Build Synergies

**Robot Build Type**: Glass Cannon (High Offense, Low Defense)

**Loadout Type**: Two-Handed
- **Weapon**: Plasma Cannon (₡500,000), Railgun (₡400,000), or Heavy Hammer (₡350,000)
- **Rationale**: Two-handed weapons deal massive damage - eliminate opponent before they can respond

**Battle Stance**: Offensive (90% offensive, 10% defensive)
- Maximize damage output from first strike
- Aim to end battles quickly (3-5 rounds)
- Aggressive targeting of opponent's critical systems

**Yield Threshold**: 50-60%
- Glass Cannon cannot survive prolonged battles
- High yield threshold prevents expensive repairs
- Better to yield early than pay massive repair costs

**Attribute Priorities**:

| Priority | Attribute | Target Level (Early) | Target Level (Mid) | Target Level (Late) | Rationale |
|----------|-----------|---------------------|-------------------|---------------------|-----------|
| 1 | Combat Power | 12 | 18 | 25-30 | Maximum damage output - core of strategy |
| 2 | Penetration | 10 | 15 | 22-25 | Bypass enemy armor - ensure damage lands |
| 3 | Critical Systems | 10 | 15 | 20-25 | Critical hits end battles faster |
| 4 | Weapon Control | 8 | 12 | 18-20 | Accuracy and weapon effectiveness |
| 5 | Targeting Systems | 6 | 10 | 15-18 | Hit critical components - maximize damage |
| 6 | Attack Speed | 5 | 8 | 12-15 | Strike first - initiative wins battles |
| 7 | Hull Integrity | 3 | 5 | 8-10 | Minimal survivability - just enough to not be one-shot |

**Weapon Synergies**:
- **Plasma Cannon**: Highest raw damage - synergizes with Combat Power
- **Railgun**: Armor penetration specialist - synergizes with Penetration attribute
- **Heavy Hammer**: Melee glass cannon - synergizes with Hydraulic Systems
- **Two-handed bonus**: +30% damage multiplier from loadout type
- **Critical Systems** increases chance of devastating critical hits
- **Weapon Control** ensures your massive damage actually hits

**Why This Build Works**:
- Overwhelming first-strike capability ends battles before opponent can respond
- High damage output = high win rate when executed well
- Minimal defensive investment = more credits for offense
- Exciting, high-stakes gameplay - every battle is decisive
- Scales excellently in higher leagues (income covers repair costs)

---

### Speed Demon - Build Synergies

**Robot Build Type**: Speed Demon (High Mobility, High DPS)

**Loadout Type**: Dual-Wield
- **Weapons**: 2× Machine Guns (₡150K each), 2× Plasma Blades (₡200K each), or mixed
- **Rationale**: Dual-wield provides multiple attacks per round - overwhelm with volume

**Battle Stance**: Offensive (75% offensive, 25% defensive)
- Maximize attack frequency and positioning
- Use speed to control engagement distance
- Strike multiple times before opponent can respond

**Yield Threshold**: 35-45%
- Moderate survivability - can take some hits
- Yield before damage becomes expensive
- Speed allows you to control when to disengage

**Attribute Priorities**:

| Priority | Attribute | Target Level (Early) | Target Level (Mid) | Target Level (Late) | Rationale |
|----------|-----------|---------------------|-------------------|---------------------|-----------|
| 1 | Attack Speed | 12 | 18 | 25-30 | Core of strategy - more attacks = more damage |
| 2 | Servo Motors | 10 | 15 | 22-25 | Movement speed - positioning and kiting |
| 3 | Gyro Stabilizers | 10 | 15 | 20-25 | Accuracy while moving - hit while repositioning |
| 4 | Weapon Control | 8 | 12 | 18-20 | Dual-wield accuracy - ensure both weapons hit |
| 5 | Combat Power | 6 | 10 | 15-18 | Damage per hit - multiply by attack speed |
| 6 | Reaction Time | 6 | 10 | 15-18 | Dodge attacks - speed is defense |
| 7 | Hull Integrity | 4 | 6 | 10-12 | Moderate survivability - enough to survive mistakes |

**Weapon Synergies**:
- **2× Machine Guns**: Ranged speed demon - kite opponents while dealing sustained damage
- **2× Plasma Blades**: Melee speed demon - close distance and unleash flurry of strikes
- **Mixed (Machine Gun + Plasma Blade)**: Hybrid approach - ranged poke then melee finish
- **Dual-wield bonus**: +20% attack speed multiplier from loadout type
- **Attack Speed attribute** directly increases number of attacks per round
- **Servo Motors** allows repositioning between attacks
- **Gyro Stabilizers** maintains accuracy during movement

**Why This Build Works**:
- High attack frequency overwhelms opponents with damage volume
- Mobility provides tactical flexibility - control engagement distance
- Multiple attacks per round = consistent damage output
- Speed-based defense (dodging) reduces repair costs
- Exciting, fast-paced gameplay - battles are dynamic and tactical

---

### Balanced Brawler - Build Synergies

**Robot Build Type**: Balanced (Moderate Offense, Moderate Defense, Moderate Mobility)

**Loadout Type**: Single Weapon
- **Weapon**: Power Sword (₡200,000), Plasma Rifle (₡250,000), or versatile weapon
- **Rationale**: Single weapon is flexible - no commitment to specific playstyle

**Battle Stance**: Balanced (50% offensive, 50% defensive)
- Adapt to opponent's strategy
- Switch between aggressive and defensive as needed
- No major weaknesses to exploit

**Yield Threshold**: 40-50%
- Moderate survivability - can take reasonable damage
- Balanced repair costs - not too high, not too low
- Flexible yielding based on battle state

**Attribute Priorities**:

| Priority | Attribute | Target Level (Early) | Target Level (Mid) | Target Level (Late) | Rationale |
|----------|-----------|---------------------|-------------------|---------------------|-----------|
| 1 | Combat Power | 8 | 12 | 18-20 | Balanced offense - enough to threaten |
| 2 | Hull Integrity | 8 | 12 | 18-20 | Balanced defense - enough to survive |
| 3 | Attack Speed | 6 | 10 | 15-18 | Moderate speed - keep pace with opponents |
| 4 | Armor Plating | 6 | 10 | 15-18 | Damage reduction - complement HP |
| 5 | Weapon Control | 6 | 10 | 15-18 | Accuracy - ensure hits land |
| 6 | Servo Motors | 5 | 8 | 12-15 | Mobility - positioning flexibility |
| 7 | Targeting Systems | 5 | 8 | 12-15 | Precision - hit what you aim at |
| 8 | Damage Control | 4 | 6 | 10-12 | Reduce critical damage - prevent spikes |

**Weapon Synergies**:
- **Power Sword**: Versatile melee - works with balanced build
- **Plasma Rifle**: Versatile ranged - works with balanced build
- **Single weapon bonus**: +10% to all attributes (flexibility bonus)
- **No specific synergies required** - balanced build works with any weapon
- **Can experiment** with different weapons without rebuild
- **Easy to transition** to specialized build later

**Why This Build Works**:
- No major weaknesses - hard to counter
- Forgiving of mistakes - balanced stats provide safety net
- Flexible playstyle - adapt to any opponent
- Sustainable economics - moderate repair costs
- Great learning platform - understand all game systems
- Easy to specialize later - add offensive, defensive, or mobility focus

---

### Facility Investor - Build Synergies

**Robot Build Type**: Balanced (Sufficient for Bronze/Silver)

**Loadout Type**: Single Weapon
- **Weapon**: Practice Sword (₡50,000) or Machine Gun (₡150,000)
- **Rationale**: Budget weapon - save credits for facilities

**Battle Stance**: Balanced (50% offensive, 50% defensive)
- Conservative approach - avoid expensive repairs
- Focus on survival over dominance
- Win through economic advantage, not combat superiority

**Yield Threshold**: 50-60%
- High yield threshold - preserve robot condition
- Repair costs eat into facility ROI
- Better to yield early than pay expensive repairs

**Attribute Priorities**:

| Priority | Attribute | Target Level (Early) | Target Level (Mid) | Target Level (Late) | Rationale |
|----------|-----------|---------------------|-------------------|---------------------|-----------|
| 1 | Hull Integrity | 6 | 10 | 15-18 | Survivability - reduce repair frequency |
| 2 | Armor Plating | 6 | 10 | 15-18 | Damage reduction - lower repair costs |
| 3 | Combat Power | 5 | 8 | 12-15 | Enough offense to win some battles |
| 4 | Damage Control | 5 | 8 | 12-15 | Reduce critical damage - prevent spikes |
| 5 | Attack Speed | 4 | 6 | 10-12 | Moderate speed - keep pace |
| 6 | Weapon Control | 4 | 6 | 10-12 | Accuracy - make hits count |
| 7 | Servo Motors | 3 | 5 | 8-10 | Basic mobility - positioning |

**Weapon Synergies**:
- **Budget weapons** - save ₡150-200K for facilities
- **Single weapon bonus**: +10% to all attributes
- **No specific synergies required** - focus is economic, not combat
- **Upgrade weapons later** - once facilities are paying off
- **Training Facility discount** applies to future attribute upgrades

**Why This Build Works**:
- Facilities provide long-term economic advantage
- Passive income from Income Generator compounds over time
- Repair Bay and Training Facility reduce future costs
- Sustainable economics - never at risk of bankruptcy
- Slow start but strong finish - patience pays off
- Great for players who enjoy economic simulation

---

### Two-Robot Specialist - Build Synergies

**Robot Build Type**: Complementary Builds (Tank + Glass Cannon)

**Loadout Types**: 
- **Robot 1 (Tank)**: Weapon+Shield (Combat Shield + Power Sword)
- **Robot 2 (Glass Cannon)**: Two-Handed (Plasma Cannon or Railgun)

**Battle Stance**: Situational
- Use Tank against aggressive opponents
- Use Glass Cannon against defensive opponents
- Adapt to matchup - strategic flexibility

**Yield Threshold**: Varies by robot
- Tank: 60-70% (high survivability)
- Glass Cannon: 25-35% (low survivability)

**Attribute Priorities (Robot 1 - Tank)**:

| Priority | Attribute | Target Level (Early) | Target Level (Mid) | Target Level (Late) | Rationale |
|----------|-----------|---------------------|-------------------|---------------------|-----------|
| 1 | Hull Integrity | 10 | 15 | 22-25 | Core defense - survive long battles |
| 2 | Armor Plating | 8 | 12 | 18-20 | Damage reduction - complement HP |
| 3 | Shield Capacity | 8 | 12 | 18-20 | Shield HP - absorb damage |
| 4 | Counter Protocols | 6 | 10 | 15-18 | Counter-attack damage |
| 5 | Combat Power | 6 | 10 | 15-18 | Offense - win through attrition |

**Attribute Priorities (Robot 2 - Glass Cannon)**:

| Priority | Attribute | Target Level (Early) | Target Level (Mid) | Target Level (Late) | Rationale |
|----------|-----------|---------------------|-------------------|---------------------|-----------|
| 1 | Combat Power | 12 | 18 | 25-30 | Maximum damage - end fights fast |
| 2 | Critical Systems | 10 | 15 | 22-25 | Critical hit chance - burst damage |
| 3 | Penetration | 10 | 15 | 22-25 | Armor penetration - ignore defense |
| 4 | Weapon Control | 8 | 12 | 18-20 | Accuracy - ensure hits land |
| 5 | Targeting Systems | 6 | 10 | 15-18 | Precision - hit weak points |

**Weapon Synergies**:
- **Tank robot**: Combat Shield (₡300K) + Power Sword (₡200K) = defensive synergy
- **Glass Cannon robot**: Plasma Cannon (₡400K) or Railgun (₡350K) = offensive synergy
- **Complementary strategies** - cover each other's weaknesses
- **Matchup flexibility** - choose optimal robot per opponent
- **Portfolio approach** - diversify risk across two builds

**Why This Build Works**:
- Strategic flexibility - adapt to any opponent
- Risk diversification - not dependent on single robot
- Matchup optimization - use Tank vs aggressive, Glass Cannon vs defensive
- Learning opportunity - experience multiple playstyles
- Redundancy - if one robot is damaged, use the other
- Scales well - can add 3rd robot later for even more flexibility

---

### Melee Specialist - Build Synergies

**Robot Build Type**: Melee Powerhouse (High Hydraulic Systems, High Combat Power)

**Loadout Type**: Two-Handed Melee or Weapon+Shield
- **Two-Handed**: Heavy Hammer (₡350,000) or Battle Axe (₡300,000)
- **Weapon+Shield**: Power Sword (₡200,000) + Combat Shield (₡300,000)
- **Rationale**: Maximize melee damage and positioning control

**Battle Stance**: Offensive (70% offensive, 30% defensive)
- Aggressive positioning - close distance quickly
- High-impact strikes - make each hit count
- Control engagement range - force melee combat

**Yield Threshold**: 35-45%
- Moderate survivability - can take some hits
- Melee combat is high-damage - battles end quickly
- Yield before opponent lands too many counters

**Attribute Priorities**:

| Priority | Attribute | Target Level (Early) | Target Level (Mid) | Target Level (Late) | Rationale |
|----------|-----------|---------------------|-------------------|---------------------|-----------|
| 1 | Hydraulic Systems | 12 | 18 | 25-30 | Core of melee - increases melee damage dramatically |
| 2 | Combat Power | 10 | 15 | 22-25 | Base damage - multiply with Hydraulic Systems |
| 3 | Servo Motors | 8 | 12 | 18-20 | Movement speed - close distance to opponent |
| 4 | Hull Integrity | 8 | 12 | 18-20 | Survivability - survive approach to melee range |
| 5 | Weapon Control | 6 | 10 | 15-18 | Melee accuracy - ensure strikes land |
| 6 | Armor Plating | 6 | 10 | 15-18 | Damage reduction - survive ranged attacks while closing |
| 7 | Reaction Time | 5 | 8 | 12-15 | Dodge ranged attacks - survive approach |

**Weapon Synergies**:
- **Heavy Hammer**: Highest melee damage, slower attacks, devastating strikes
- **Battle Axe**: High melee damage, balanced speed, reliable choice
- **Power Sword + Shield**: Moderate melee damage, high defense, safer option
- **Hydraulic Systems** directly multiplies melee weapon damage
- **Servo Motors** allows closing distance before opponent can kite
- **Two-handed melee bonus**: +30% damage multiplier
- **Weapon+Shield bonus**: +20% defense, counter-attack damage

**Why This Build Works**:
- Hydraulic Systems provides massive melee damage scaling
- High-impact gameplay - each strike is devastating
- Positioning matters - tactical depth in closing distance
- Exciting combat - dramatic melee strikes and positioning plays
- Scales excellently - Hydraulic Systems has no diminishing returns
- Unique playstyle - different from ranged-focused meta

---

### Ranged Sniper - Build Synergies

**Robot Build Type**: Precision Striker (High Targeting Systems, High Penetration)

**Loadout Type**: Two-Handed Ranged
- **Weapons**: Railgun (₡350,000), Sniper Rifle (₡300,000), or Plasma Cannon (₡400,000)
- **Rationale**: Maximize accuracy, penetration, and critical hit potential

**Battle Stance**: Defensive (40% offensive, 60% defensive)
- Maintain distance - avoid melee combat
- Precision strikes - quality over quantity
- Control engagement range - keep opponent at distance

**Yield Threshold**: 30-40%
- Moderate-low survivability - avoid prolonged combat
- Ranged advantage - win before opponent closes distance
- Yield if opponent reaches melee range

**Attribute Priorities**:

| Priority | Attribute | Target Level (Early) | Target Level (Mid) | Target Level (Late) | Rationale |
|----------|-----------|---------------------|-------------------|---------------------|-----------|
| 1 | Targeting Systems | 12 | 18 | 25-30 | Core of strategy - accuracy and critical hit chance |
| 2 | Penetration | 10 | 15 | 22-25 | Armor penetration - ignore enemy defense |
| 3 | Critical Systems | 10 | 15 | 22-25 | Critical hit chance - burst damage |
| 4 | Weapon Control | 8 | 12 | 18-20 | Weapon accuracy - ensure shots land |
| 5 | Combat Power | 8 | 12 | 18-20 | Base damage - multiply with crits and penetration |
| 6 | Sensor Suite | 6 | 10 | 15-18 | Target acquisition - hit weak points |
| 7 | Hull Integrity | 5 | 8 | 12-15 | Moderate survivability - survive if opponent closes |

**Weapon Synergies**:
- **Railgun**: Highest penetration, ignores armor, devastating against tanks
- **Sniper Rifle**: High accuracy, high critical chance, precision strikes
- **Plasma Cannon**: High damage, energy-based, bypasses physical armor
- **Targeting Systems** increases accuracy and critical hit chance
- **Penetration** allows damage to bypass armor - effective against all builds
- **Two-handed ranged bonus**: +25% range multiplier
- **Critical Systems + Targeting Systems** = high critical hit rate

**Why This Build Works**:
- Precision gameplay - every shot matters
- Effective against all builds - penetration bypasses defense
- Ranged advantage - control engagement distance
- High skill ceiling - accuracy and positioning matter
- Scales excellently in higher leagues - precision matters more vs skilled opponents
- Exciting gameplay - dramatic critical hits and precision strikes

---

### AI Tactician - Build Synergies

**Robot Build Type**: AI-Optimized (High Combat Algorithms, High Adaptive AI)

**Loadout Type**: Any (AI optimizes usage)
- **Recommended**: Balanced weapon (Power Sword, Plasma Rifle)
- **Rationale**: AI makes optimal decisions regardless of weapon choice

**Battle Stance**: Adaptive (AI-controlled)
- AI analyzes opponent and adjusts stance dynamically
- Optimal decision-making - AI chooses best action each round
- Strategic depth - AI considers multiple factors

**Yield Threshold**: AI-Optimized (35-50%)
- AI calculates optimal yield point based on battle state
- Considers repair costs, win probability, and strategic value
- Maximizes long-term profitability

**Attribute Priorities**:

| Priority | Attribute | Target Level (Early) | Target Level (Mid) | Target Level (Late) | Rationale |
|----------|-----------|---------------------|-------------------|---------------------|-----------|
| 1 | Combat Algorithms | 12 | 18 | 25-30 | Core of strategy - AI decision quality |
| 2 | Adaptive AI | 10 | 15 | 22-25 | Learning and adaptation - improves over time |
| 3 | Threat Analysis | 10 | 15 | 22-25 | Opponent analysis - identify weaknesses |
| 4 | Logic Cores | 8 | 12 | 18-20 | Processing power - complex calculations |
| 5 | Combat Power | 6 | 10 | 15-18 | Balanced offense - AI optimizes usage |
| 6 | Hull Integrity | 6 | 10 | 15-18 | Balanced defense - AI optimizes survival |
| 7 | Attack Speed | 5 | 8 | 12-15 | Moderate speed - AI optimizes timing |

**Weapon Synergies**:
- **Any weapon works** - AI optimizes usage regardless of choice
- **Balanced weapons recommended** - give AI flexibility
- **Combat Algorithms** improves all combat decisions
- **Adaptive AI** learns from battles - improves over time
- **Threat Analysis** identifies opponent weaknesses - exploits them
- **AI Training Academy** (facility) provides additional AI bonuses

**Why This Build Works**:
- AI makes optimal decisions - reduces player error
- Strategic depth - AI considers factors humans might miss
- Scales excellently - AI attributes become more valuable vs skilled opponents
- Learning system - Adaptive AI improves with experience
- Unique playstyle - focus on strategy over mechanics
- Great for players who enjoy tactical gameplay and optimization

---

### Prestige Rusher - Build Synergies

**Robot Build Type**: Win-Optimized (Balanced Offense/Defense for maximum win rate)

**Loadout Type**: Cost-Effective
- **Weapons**: Power Sword (₡200,000), Plasma Rifle (₡250,000), or Machine Gun (₡150,000)
- **Rationale**: Maximize win probability per credit spent

**Battle Stance**: Balanced (50% offensive, 50% defensive)
- Optimize for win rate, not style
- Adapt to opponent - use whatever works
- Minimize losses - every loss delays prestige goals

**Yield Threshold**: 40-50%
- Moderate survivability - balance repair costs vs win rate
- Yield strategically - preserve win rate
- Don't risk losses for marginal wins

**Attribute Priorities**:

| Priority | Attribute | Target Level (Early) | Target Level (Mid) | Target Level (Late) | Rationale |
|----------|-----------|---------------------|-------------------|---------------------|-----------|
| 1 | Combat Power | 10 | 15 | 22-25 | Offense - win battles consistently |
| 2 | Hull Integrity | 8 | 12 | 18-20 | Defense - survive to win |
| 3 | Attack Speed | 8 | 12 | 18-20 | Speed - more attacks = more wins |
| 4 | Armor Plating | 6 | 10 | 15-18 | Damage reduction - survive longer |
| 5 | Weapon Control | 6 | 10 | 15-18 | Accuracy - ensure hits land |
| 6 | Targeting Systems | 6 | 10 | 15-18 | Precision - hit weak points |
| 7 | Servo Motors | 5 | 8 | 12-15 | Mobility - positioning advantage |

**Weapon Synergies**:
- **Cost-effective weapons** - maximize win rate per credit
- **Balanced approach** - no weaknesses to exploit
- **Upgrade to premium weapons** once prestige unlocks them
- **Focus on attributes** over expensive weapons early
- **Booking Office** (facility) provides tournament access for bonus prestige

**Why This Build Works**:
- Optimized for win rate - fastest prestige accumulation
- Balanced build - no major weaknesses
- Cost-effective - maximize prestige per credit spent
- Tournament access - Booking Office provides bonus prestige opportunities
- League advancement - rapid progression to higher leagues
- Competitive focus - great for players who enjoy progression systems
- Unlocks high-tier content faster - prestige gates premium weapons and facilities

---

## Hybrid Strategies and Transitions

As your stable grows and your understanding of the game deepens, you may want to combine elements from multiple archetypes or transition from one strategy to another. This section explores viable archetype combinations, multi-phase strategies, and how to adapt your approach based on your progress and circumstances.

### Understanding Hybrid Strategies

**Hybrid strategies** combine elements from multiple archetypes to create a customized approach that fits your evolving goals and resources. Unlike pure archetypes, hybrids require more planning and resource management but offer greater flexibility and optimization potential.

**When to Consider Hybrids**:
- You have multiple robots and want different builds for each
- Your economic situation has changed (surplus credits or tight budget)
- You've mastered one archetype and want to expand your capabilities
- You want to optimize for specific league tiers or opponents
- You're recovering from setbacks and need to adapt

### Viable Archetype Combinations

#### Tank Fortress → Facility Investor

**Transition Trigger**: ₡500,000+ balance, established in Gold league

**Strategy**: Use Tank's low repair costs to accumulate surplus, then invest in facilities for long-term growth.

**Implementation**:
1. **Months 1-3**: Pure Tank Fortress - build defensive robot, accumulate credits
2. **Month 4**: Purchase Income Generator Level 1 (₡800K) - passive income starts
3. **Month 5-6**: Purchase Repair Bay Level 1 (₡200K) - reduce already-low repair costs further
4. **Month 7+**: Enjoy compounding benefits - passive income + repair savings + defensive stability

**Why This Works**:
- Tank's low repair costs create surplus for facility investments
- Defensive playstyle is sustainable while facilities pay for themselves
- Facilities compound Tank's already-strong economics
- Low risk - Tank provides safety net during transition

**Pitfalls to Avoid**:
- Don't buy facilities too early - need ₡500K+ buffer first
- Don't neglect attribute upgrades - Tank still needs to win battles
- Don't over-invest in facilities - balance growth with operational needs

---

#### Glass Cannon → Balanced Brawler

**Transition Trigger**: Struggling with repair costs, losing streak, or stuck in Bronze/Silver

**Strategy**: Pivot from high-risk offense to balanced sustainability to stabilize economics.

**Implementation**:
1. **Immediate**: Stop upgrading offensive attributes (Combat Power, Critical Systems, Penetration)
2. **Week 1-2**: Invest ₡50-100K in defensive attributes (Hull Integrity, Armor Plating to level 6-8)
3. **Week 3-4**: Adjust battle stance from Offensive (80/20) to Balanced (50/50)
4. **Week 5+**: Continue balanced upgrades - stabilize win rate and repair costs

**Why This Works**:
- Reduces catastrophic repair costs from losses
- Improves win rate through better survivability
- Maintains offensive capability while adding defense
- Easier to execute than starting over with new robot

**Pitfalls to Avoid**:
- Don't abandon offense entirely - still need to win battles
- Don't expect immediate results - takes 2-3 weeks to stabilize
- Don't panic-sell weapons - keep your two-handed weapon

---

#### Balanced Brawler → Speed Demon

**Transition Trigger**: ₡400,000+ balance, comfortable in Silver/Gold, want more excitement

**Strategy**: Evolve from safe balanced build to high-mobility DPS build for more dynamic gameplay.

**Implementation**:
1. **Month 3-4**: Accumulate ₡400K for weapon purchases (2× one-handed weapons)
2. **Month 4**: Purchase dual-wield weapons (2× Machine Guns for ₡300K or 2× Plasma Blades for ₡400K)
3. **Month 5**: Shift attribute focus to Attack Speed, Servo Motors, Gyro Stabilizers
4. **Month 6+**: Gradually increase offensive stance, lower yield threshold

**Why This Works**:
- Balanced foundation provides safety during transition
- Can afford weapon investment from accumulated surplus
- Attribute base is compatible - just shift priorities
- Exciting evolution - more dynamic gameplay

**Pitfalls to Avoid**:
- Don't rush weapon purchase - need ₡400K+ buffer
- Don't neglect survivability - Speed Demon still needs moderate HP
- Don't switch stance too aggressively - gradual transition is safer

---

#### Facility Investor → Two-Robot Specialist

**Transition Trigger**: ₡1,000,000+ balance, facilities paying off, want strategic flexibility

**Strategy**: Use facility-generated wealth to expand roster with complementary robots.

**Implementation**:
1. **Months 1-4**: Pure Facility Investor - accumulate wealth from passive income
2. **Month 5**: Purchase Roster Expansion Level 1 (₡300K) - unlock 2nd robot slot
3. **Month 6**: Purchase 2nd robot (₡500K) + weapon (₡200-400K) + attribute upgrades (₡200K)
4. **Month 7+**: Operate two robots with facility support - passive income covers operating costs

**Why This Works**:
- Facility Investor generates surplus for expansion
- Passive income covers 2nd robot's operating costs
- Facilities benefit both robots (Repair Bay, Training Facility)
- Strategic flexibility - choose optimal robot per matchup

**Pitfalls to Avoid**:
- Don't expand too early - need ₡1M+ buffer for safety
- Don't neglect 1st robot - keep it competitive
- Don't forget Roster Expansion operating costs (₡500/day per extra robot)

---

#### Speed Demon → Melee Specialist

**Transition Trigger**: Want to optimize melee damage, have ₡300-400K for weapon upgrade

**Strategy**: Refocus speed-based build toward melee specialization with Hydraulic Systems.

**Implementation**:
1. **Current State**: Speed Demon with dual-wield (likely 2× Plasma Blades or mixed)
2. **Month 3-4**: Shift attribute focus from Attack Speed to Hydraulic Systems
3. **Month 4-5**: Purchase Heavy Hammer (₡350K) or Battle Axe (₡300K) - two-handed melee
4. **Month 5+**: Continue Hydraulic Systems upgrades - melee damage scales dramatically

**Why This Works**:
- Speed Demon already has Servo Motors (movement speed) - compatible with melee
- Hydraulic Systems provides better melee scaling than Attack Speed
- Two-handed melee bonus (+30% damage) is stronger than dual-wield for melee
- Exciting evolution - from fast strikes to devastating blows

**Pitfalls to Avoid**:
- Don't neglect Servo Motors - still need movement speed to close distance
- Don't abandon survivability - melee combat requires moderate HP
- Don't rush weapon purchase - Heavy Hammer is expensive (₡350K)

---

#### Prestige Rusher → AI Tactician

**Transition Trigger**: 5,000+ prestige achieved, unlocked AI Training Academy, want strategic depth

**Strategy**: Leverage prestige unlocks to pivot toward AI-optimized gameplay.

**Implementation**:
1. **Months 1-4**: Pure Prestige Rusher - rapid league advancement and prestige accumulation
2. **Month 5**: Unlock AI Training Academy at 5,000 prestige
3. **Month 6**: Purchase AI Training Academy Level 1 (₡500K) - AI bonuses begin
4. **Month 7+**: Shift attribute focus to Combat Algorithms, Adaptive AI, Threat Analysis

**Why This Works**:
- Prestige Rusher's balanced build is compatible with AI Tactician
- AI Training Academy provides significant AI attribute bonuses
- Prestige unlocks enable the transition
- Strategic depth increases - AI optimization is engaging

**Pitfalls to Avoid**:
- Don't neglect combat attributes - AI needs stats to optimize
- Don't expect immediate results - AI benefits take time to manifest
- Don't abandon prestige goals - continue accumulating for higher unlocks

---

### Multi-Phase Strategies

#### Early Aggression → Mid-Game Stability → Late-Game Dominance

**Phase 1 (Months 1-2): Glass Cannon**
- Maximize offensive attributes
- High-risk, high-reward gameplay
- Rapid league advancement (Bronze → Silver → Gold)
- Goal: Reach Gold league quickly for higher income

**Phase 2 (Months 3-5): Balanced Brawler**
- Add defensive attributes for stability
- Reduce repair cost volatility
- Sustainable economics in Gold league
- Goal: Accumulate ₡1M+ surplus

**Phase 3 (Months 6+): Facility Investor**
- Purchase Income Generator, Repair Bay, Training Facility
- Passive income + cost reductions compound
- Dominant economic position
- Goal: Long-term wealth accumulation

**Why This Works**:
- Early aggression accelerates league advancement
- Mid-game stability prevents bankruptcy
- Late-game facilities compound wealth
- Each phase builds on previous success

**Risk Assessment**: High early risk, medium mid-game risk, low late-game risk

---

#### Conservative Start → Aggressive Expansion → Portfolio Diversification

**Phase 1 (Months 1-3): Balanced Brawler**
- Safe, sustainable start
- Learn game mechanics without risk
- Accumulate ₡500K+ surplus
- Goal: Establish stable foundation

**Phase 2 (Months 4-6): Two-Robot Specialist**
- Purchase Roster Expansion + 2nd robot
- One defensive (Tank), one offensive (Glass Cannon)
- Strategic flexibility in matchups
- Goal: Optimize win rate through matchup selection

**Phase 3 (Months 7+): Multi-Robot Portfolio**
- Add 3rd robot (Speed Demon or Melee Specialist)
- Diverse roster covers all matchups
- Rotate robots based on condition and matchups
- Goal: Maximum strategic flexibility

**Why This Works**:
- Conservative start prevents early bankruptcy
- Aggressive expansion leverages accumulated wealth
- Portfolio diversification maximizes win rate
- Each phase reduces risk through diversification

**Risk Assessment**: Low early risk, medium mid-game risk, low late-game risk

---

### Situational Adaptations

#### Responding to Losing Streaks

**Situation**: 5+ consecutive losses, balance dropping below ₡100,000

**Immediate Actions**:
1. **Stop battling temporarily** - prevent further losses
2. **Analyze losses** - identify pattern (outmatched offense? poor defense? bad matchups?)
3. **Adjust yield threshold** - yield earlier to reduce repair costs
4. **Shift to defensive stance** - prioritize survival over wins
5. **Invest in survivability** - add Hull Integrity and Armor Plating levels

**Recovery Strategy**:
- Resume battling with conservative approach (defensive stance, high yield threshold)
- Focus on participation rewards (₡1,500-6,000 per battle) rather than wins
- Gradually rebuild balance to ₡200K+ before returning to normal strategy
- Consider transitioning to more sustainable archetype (Balanced Brawler, Tank Fortress)

**Timeline**: 2-4 weeks to recover, depending on league and win rate

---

#### Capitalizing on Win Streaks

**Situation**: 10+ consecutive wins, balance exceeding ₡500,000

**Opportunity Actions**:
1. **Accelerate investments** - purchase facilities or weapons earlier than planned
2. **Upgrade aggressively** - push key attributes to next tier
3. **Expand roster** - add 2nd robot if not already owned
4. **Lower yield threshold** - take more risks for faster prestige accumulation
5. **Enter tournaments** - if Booking Office owned, capitalize on momentum

**Growth Strategy**:
- Maintain aggressive stance - winning streak indicates strong matchup advantage
- Invest surplus in long-term growth (facilities, attribute upgrades)
- Don't hoard credits - put them to work for compounding returns
- Consider transitioning to more aggressive archetype (Glass Cannon, Prestige Rusher)

**Risk Management**: Keep ₡200K+ buffer even during aggressive growth

---

#### League Advancement Adaptation

**Situation**: Just advanced from Silver to Gold (or Gold to Platinum)

**Adaptation Actions**:
1. **Reassess economics** - income doubled, but so did opponent strength
2. **Upgrade key attributes** - ensure competitiveness in new league
3. **Adjust yield threshold** - higher league = higher repair costs, yield earlier
4. **Evaluate risk tolerance** - what was low-risk in Silver may be medium-risk in Gold
5. **Consider facility investments** - higher income makes facilities more viable

**Strategic Adjustments**:
- **Tank Fortress**: Risk decreases (repair costs stay low, income doubles) - can be more aggressive
- **Glass Cannon**: Risk decreases (income covers repair costs better) - safer to play aggressively
- **Facility Investor**: ROI improves (higher income = faster payback) - accelerate facility purchases
- **Prestige Rusher**: Prestige gains increase - maintain aggressive win-rate focus

**Timeline**: 1-2 weeks to stabilize in new league

---

### Rebalancing Investments When Changing Strategies

#### From Offensive to Defensive

**Current State**: High Combat Power, Critical Systems, Penetration (Glass Cannon)
**Target State**: High Hull Integrity, Armor Plating, Shield Capacity (Tank Fortress)

**Rebalancing Approach**:
1. **Don't downgrade offensive attributes** - they're permanent investments
2. **Add defensive attributes** - bring Hull Integrity and Armor Plating to level 10+
3. **Adjust stance and yield** - shift to defensive stance (30/70), higher yield threshold (60%+)
4. **Consider weapon change** - sell two-handed weapon, buy weapon+shield (if economically viable)
5. **Timeline**: 4-6 weeks to fully transition (₡200-300K in defensive upgrades)

**Cost**: ₡200,000-₡300,000 in defensive attribute upgrades

---

#### From Defensive to Offensive

**Current State**: High Hull Integrity, Armor Plating (Tank Fortress)
**Target State**: High Combat Power, Critical Systems, Penetration (Glass Cannon)

**Rebalancing Approach**:
1. **Leverage defensive foundation** - survivability provides safety during transition
2. **Add offensive attributes** - bring Combat Power, Critical Systems to level 12+
3. **Adjust stance gradually** - shift from defensive (30/70) to offensive (80/20) over 2-3 weeks
4. **Consider weapon upgrade** - sell weapon+shield, buy two-handed weapon (₡350-400K)
5. **Timeline**: 6-8 weeks to fully transition (₡300-400K in offensive upgrades + weapon)

**Cost**: ₡500,000-₡700,000 total (attributes + weapon)

---

#### From Single Robot to Multi-Robot

**Current State**: One robot, any archetype
**Target State**: Two+ robots (Two-Robot Specialist or Portfolio)

**Rebalancing Approach**:
1. **Purchase Roster Expansion** - ₡300,000 (required for 2nd robot)
2. **Purchase 2nd robot** - ₡500,000 (base robot)
3. **Purchase weapon for 2nd robot** - ₡200,000-₡400,000
4. **Upgrade 2nd robot attributes** - ₡200,000-₡300,000 (bring to competitive level)
5. **Account for operating costs** - +₡500/day (₡3,500/week) for 2nd robot slot
6. **Timeline**: Requires ₡1,200,000-₡1,500,000 total investment

**Cost**: ₡1,200,000-₡1,500,000 total + ₡3,500/week ongoing

**Economic Requirement**: Need ₡50,000+/week net income to support 2nd robot sustainably

---

### Transition Decision Framework

**When to Transition**:
- ✅ You have ₡500,000+ balance (safety buffer)
- ✅ Your current strategy is stable (not in crisis)
- ✅ You understand the target archetype's requirements
- ✅ You can afford the transition costs (attributes, weapons, facilities)
- ✅ You have a clear goal for the transition (more fun, better economics, strategic flexibility)

**When NOT to Transition**:
- ❌ You're in financial crisis (balance below ₡100,000)
- ❌ You're on a losing streak (fix current strategy first)
- ❌ You don't understand the target archetype
- ❌ You can't afford the transition costs
- ❌ You're transitioning out of boredom without a plan

**Transition Success Factors**:
1. **Financial stability** - ample buffer to absorb transition costs
2. **Clear plan** - know exactly what you're building toward
3. **Gradual execution** - don't rush, transition over 4-8 weeks
4. **Monitoring** - track win rate, repair costs, income during transition
5. **Flexibility** - willing to adjust if transition isn't working

---

## Weapon Purchase Strategy

One of the most common mistakes new players make is over-investing in weapons early in the game. This section explains when and why to purchase additional weapons, helping you avoid wasting credits on unnecessary equipment.

### The Core Principle: Start Minimal

**Most archetypes only need 1-2 weapons initially** - one weapon per robot you own. Additional weapons are expensive and provide minimal benefit until you have the infrastructure and resources to experiment.

**Why Minimal Weapon Investment Makes Sense**:
- **Weapons are expensive**: ₡150,000-₡400,000 per weapon
- **Loadout commitment**: Your robot build determines optimal weapon type
- **Attribute synergies**: Weapons work best with matching attributes (e.g., melee weapons need Hydraulic Systems)
- **Storage limitations**: Default storage capacity is only 5 weapons
- **Opportunity cost**: Credits spent on extra weapons could upgrade attributes or purchase facilities

### Initial Weapon Purchases by Archetype

| Archetype | Initial Weapons | Total Cost | Rationale |
|-----------|----------------|------------|-----------|
| Tank Fortress | Combat Shield + Power Sword | ₡500,000 | Weapon+Shield loadout - both required |
| Glass Cannon | Plasma Cannon or Railgun | ₡350-400,000 | Two-handed weapon - only need one |
| Speed Demon | 2× Machine Guns or 2× Plasma Blades | ₡300-400,000 | Dual-wield - need two one-handed weapons |
| Balanced Brawler | Power Sword or Plasma Rifle | ₡200-250,000 | Single weapon - flexible choice |
| Facility Investor | Practice Sword or Machine Gun | ₡50-150,000 | Budget weapon - save for facilities |
| Two-Robot Specialist | 2 weapons (one per robot) | ₡400-700,000 | Two robots = two weapons minimum |
| Melee Specialist | Heavy Hammer or Battle Axe | ₡300-350,000 | Two-handed melee - only need one |
| Ranged Sniper | Railgun or Sniper Rifle | ₡300-350,000 | Two-handed ranged - only need one |
| AI Tactician | Power Sword or Plasma Rifle | ₡200-250,000 | Balanced weapon - AI optimizes usage |
| Prestige Rusher | Power Sword or Machine Gun | ₡150-200,000 | Cost-effective weapon - maximize win rate per credit |

**Key Insight**: Only Speed Demon and Two-Robot Specialist need more than one weapon initially. All other archetypes start with a single weapon (or weapon+shield combo).

### When Additional Weapons Make Sense

#### Scenario 1: Experimenting with Different Loadout Types

**Timing**: Mid-game (Months 3-6), after establishing stable economics

**Example**: Balanced Brawler wants to try dual-wield
- **Current**: Single weapon (Power Sword, ₡200K)
- **Purchase**: 2× one-handed weapons (2× Machine Guns, ₡300K)
- **Cost**: ₡300,000 for experimentation
- **Risk**: If dual-wield doesn't work, ₡300K is wasted

**When This Makes Sense**:
- You have ₡500,000+ balance (can afford to experiment)
- You're comfortable in Gold+ league (stable income)
- You want to optimize your build (trying different approaches)
- You're willing to invest in attribute rebalancing if needed

**When to Avoid**:
- You're in Bronze/Silver (income too low to justify experimentation)
- Your balance is below ₡300,000 (can't afford the risk)
- You haven't mastered your current loadout (fix fundamentals first)

---

#### Scenario 2: Matchup-Specific Weapons

**Timing**: Late-game (Months 6+), multiple robots, high-level play

**Example**: Two-Robot Specialist wants weapons for different matchups
- **Robot 1 (Tank)**: Combat Shield + Power Sword (defensive), Combat Shield + Battle Axe (offensive melee)
- **Robot 2 (Glass Cannon)**: Plasma Cannon (vs tanks), Railgun (vs speed builds)
- **Total**: 5 weapons for 2 robots
- **Cost**: ₡1,500,000+ total investment

**When This Makes Sense**:
- You have multiple robots (2+)
- You're in Platinum+ league (high-level competition)
- You understand matchups deeply (know when to use each weapon)
- You have Storage Facility (capacity for 10+ weapons)
- You have ₡1,000,000+ balance (can afford the investment)

**When to Avoid**:
- You only have one robot (limited utility)
- You're in Gold or lower (matchup optimization less critical)
- You don't understand matchups (won't use weapons effectively)
- You don't have Storage Facility (can't store extra weapons)

---

#### Scenario 3: Prestige-Unlocked Premium Weapons

**Timing**: When you reach prestige thresholds (5,000, 10,000, 20,000 prestige)

**Example**: Prestige Rusher unlocks Quantum Blade at 10,000 prestige
- **Current**: Power Sword (₡200K)
- **Unlock**: Quantum Blade (₡600K, requires 10,000 prestige)
- **Benefit**: +30% damage, +20% critical chance vs Power Sword
- **Cost**: ₡600,000

**When This Makes Sense**:
- You've reached the prestige threshold (weapon is unlocked)
- The weapon significantly improves your build (major upgrade)
- You have ₡800,000+ balance (can afford premium weapon + buffer)
- You're committed to your current archetype (won't change builds soon)

**When to Avoid**:
- You haven't reached prestige threshold (weapon not available)
- The upgrade is marginal (not worth ₡400K+ premium)
- Your balance is below ₡500,000 (can't afford it safely)
- You're planning to change archetypes (weapon won't fit new build)

---

### Storage Facility Requirement

**Default Storage Capacity**: 5 weapons

**When You Need Storage Facility**:
- You own 6+ weapons (exceeds default capacity)
- You're experimenting with multiple loadout types
- You're a Two-Robot Specialist with matchup-specific weapons
- You're collecting prestige-unlocked premium weapons

**Storage Facility Costs**:
- **Level 1**: ₡150,000 (10 weapon capacity)
- **Level 5**: ₡750,000 (30 weapon capacity)
- **Level 10**: ₡1,500,000 (55 weapon capacity)
- **Operating Cost**: ₡500/day + (level × ₡250/day)

**ROI Analysis**:
- Storage Facility is a **capacity unlock**, not a cost-saving facility
- No direct ROI - it's a prerequisite for weapon collections
- Only purchase if you need more than 5 weapons
- Most players don't need Storage Facility until late-game (Month 6+)

**Recommendation**: Skip Storage Facility early game. Only purchase when you actually need more than 5 weapon slots.

---

### The Trade-Off: Weapons vs Attributes vs Facilities

Every credit spent on weapons is a credit not spent on attributes or facilities. Let's compare the value:

#### Option A: Purchase 2nd Weapon (₡300,000)

**Example**: Balanced Brawler buys 2× Machine Guns to try dual-wield
- **Cost**: ₡300,000
- **Benefit**: Ability to experiment with dual-wield loadout
- **Risk**: If dual-wield doesn't work, ₡300K is wasted
- **Reversibility**: Can sell weapons for 50% value (₡150K recovery)

#### Option B: Upgrade Attributes (₡300,000)

**Example**: Balanced Brawler upgrades Combat Power 8→15 and Hull Integrity 8→15
- **Cost**: ₡300,000 (approximately)
- **Benefit**: +7 levels in two key attributes - permanent improvement
- **Risk**: None - attributes always provide value
- **Reversibility**: None - attributes are permanent

#### Option C: Purchase Facility (₡300,000)

**Example**: Balanced Brawler buys Training Facility Level 1
- **Cost**: ₡300,000
- **Benefit**: 5% discount on all future attribute upgrades
- **Operating Cost**: ₡1,500/day (₡10,500/week)
- **ROI**: Pays for itself after ₡6,000,000 in attribute upgrades (long-term)
- **Reversibility**: None - facilities are permanent

**Comparison**:

| Option | Immediate Value | Long-Term Value | Risk | Best For |
|--------|----------------|-----------------|------|----------|
| 2nd Weapon | Low (experimentation) | Medium (if it works) | High (may not work) | Experienced players, stable economics |
| Attribute Upgrades | High (immediate power) | High (permanent) | None | All players, all stages |
| Facility | None (cost initially) | Very High (compounds) | Low (long payback) | Mid-game+, stable economics |

**Recommendation**: Prioritize attribute upgrades over additional weapons in early-mid game. Weapons are for experimentation and optimization, not core progression.

---

### Archetype-Specific Weapon Strategies

#### Tank Fortress: Fixed Loadout

**Initial Purchase**: Combat Shield + Power Sword (₡500K)

**Additional Weapons**: Rarely needed
- Tank Fortress is committed to Weapon+Shield loadout
- Shield is mandatory for the build
- Power Sword is optimal melee weapon for defensive build
- **Recommendation**: Don't buy additional weapons unless experimenting with different melee weapon (Battle Axe, Heavy Hammer)

**Experimentation Cost**: ₡300-350K for alternative melee weapon

**Verdict**: Stick with initial weapons. Focus credits on defensive attributes and facilities.

---

#### Glass Cannon: Fixed Loadout

**Initial Purchase**: Plasma Cannon (₡400K) or Railgun (₡350K)

**Additional Weapons**: Rarely needed
- Glass Cannon is committed to Two-Handed loadout
- Two-handed weapons are expensive (₡300-400K each)
- Build is optimized for one weapon type
- **Recommendation**: Don't buy additional weapons unless upgrading to prestige-unlocked premium (e.g., Quantum Cannon at 15,000 prestige)

**Experimentation Cost**: ₡300-400K for alternative two-handed weapon

**Verdict**: Stick with initial weapon. Focus credits on offensive attributes.

---

#### Speed Demon: Moderate Variety

**Initial Purchase**: 2× Machine Guns (₡300K) or 2× Plasma Blades (₡400K)

**Additional Weapons**: Situational
- Speed Demon benefits from ranged vs melee flexibility
- **Ranged option**: 2× Machine Guns (₡300K) - kite opponents
- **Melee option**: 2× Plasma Blades (₡400K) - close-range flurry
- **Hybrid option**: Machine Gun + Plasma Blade (₡250K) - flexibility
- **Recommendation**: Start with one option (ranged or melee), add alternative in mid-game if desired

**Experimentation Cost**: ₡250-400K for alternative dual-wield set

**Verdict**: Moderate weapon variety makes sense for Speed Demon. Consider 2nd dual-wield set in mid-game (Month 4+).

---

#### Balanced Brawler: High Flexibility

**Initial Purchase**: Power Sword (₡200K) or Plasma Rifle (₡250K)

**Additional Weapons**: Flexible
- Balanced Brawler can experiment with any loadout type
- Single weapon → Dual-wield: ₡300-400K
- Single weapon → Two-handed: ₡300-400K
- Single weapon → Weapon+Shield: ₡500K
- **Recommendation**: Master single weapon first, experiment in mid-game if desired

**Experimentation Cost**: ₡300-500K depending on target loadout

**Verdict**: Balanced Brawler has most flexibility for experimentation. Wait until mid-game (Month 3+) and ₡500K+ balance.

---

#### Facility Investor: Minimal Investment

**Initial Purchase**: Practice Sword (₡50K) or Machine Gun (₡150K)

**Additional Weapons**: Avoid
- Facility Investor prioritizes facilities over weapons
- Budget weapon is sufficient for Bronze/Silver
- **Recommendation**: Don't buy additional weapons until facilities are paying off (Month 6+)

**Experimentation Cost**: ₡200-400K (conflicts with facility investment strategy)

**Verdict**: Stick with budget weapon. Focus all credits on facilities and attributes.

---

#### Two-Robot Specialist: Moderate Variety

**Initial Purchase**: 2 weapons (one per robot, ₡400-700K total)

**Additional Weapons**: Situational
- Two robots = minimum 2 weapons
- Matchup-specific weapons add strategic depth
- **Example**: Tank robot with 2 weapon options (Power Sword for defense, Battle Axe for offense)
- **Recommendation**: Start with 1 weapon per robot, add matchup-specific weapons in late-game (Month 6+)

**Experimentation Cost**: ₡300-400K per additional weapon

**Verdict**: Start minimal (1 weapon per robot). Add matchup-specific weapons once you have ₡1M+ balance and understand matchups deeply.

---

#### Melee Specialist: Fixed Loadout

**Initial Purchase**: Heavy Hammer (₡350K) or Battle Axe (₡300K)

**Additional Weapons**: Rarely needed
- Melee Specialist is committed to two-handed melee or weapon+shield melee
- Hydraulic Systems optimizes melee damage
- **Recommendation**: Don't buy additional weapons unless experimenting with weapon+shield variant

**Experimentation Cost**: ₡500K for Combat Shield + Power Sword (weapon+shield variant)

**Verdict**: Stick with initial weapon. Focus credits on Hydraulic Systems and Combat Power.

---

#### Ranged Sniper: Fixed Loadout

**Initial Purchase**: Railgun (₡350K) or Sniper Rifle (₡300K)

**Additional Weapons**: Rarely needed
- Ranged Sniper is committed to two-handed ranged
- Targeting Systems optimizes ranged accuracy
- **Recommendation**: Don't buy additional weapons unless upgrading to prestige-unlocked premium

**Experimentation Cost**: ₡300-400K for alternative two-handed ranged

**Verdict**: Stick with initial weapon. Focus credits on Targeting Systems and Penetration.

---

#### AI Tactician: Flexible

**Initial Purchase**: Power Sword (₡200K) or Plasma Rifle (₡250K)

**Additional Weapons**: Flexible
- AI Tactician can use any weapon effectively (AI optimizes usage)
- Experimentation is viable - AI adapts to weapon choice
- **Recommendation**: Start with balanced weapon, experiment in mid-game if desired

**Experimentation Cost**: ₡300-500K depending on target weapon

**Verdict**: AI Tactician has flexibility for experimentation. Wait until mid-game (Month 4+) and ₡500K+ balance.

---

#### Prestige Rusher: Cost-Effective

**Initial Purchase**: Power Sword (₡200K) or Machine Gun (₡150K)

**Additional Weapons**: Avoid until prestige unlocks
- Prestige Rusher optimizes for win rate per credit
- Budget weapons are cost-effective
- **Recommendation**: Don't buy additional weapons until prestige unlocks premium options (5,000+ prestige)

**Experimentation Cost**: ₡300-400K (conflicts with prestige optimization strategy)

**Verdict**: Stick with cost-effective weapon. Upgrade to prestige-unlocked premium once available.

---

### Weapon Purchase Decision Framework

**Before purchasing an additional weapon, ask yourself**:

1. **Do I need this weapon for my current build?**
   - ✅ Yes: Speed Demon needs 2nd one-handed weapon for dual-wield
   - ❌ No: Glass Cannon doesn't need 2nd two-handed weapon

2. **Can I afford this weapon safely?**
   - ✅ Yes: Balance is ₡500,000+, stable income
   - ❌ No: Balance is below ₡300,000, unstable income

3. **Will this weapon improve my win rate or economics?**
   - ✅ Yes: Matchup-specific weapon for Two-Robot Specialist
   - ❌ No: Experimentation without clear benefit

4. **Do I have the attributes to use this weapon effectively?**
   - ✅ Yes: Melee weapon + high Hydraulic Systems
   - ❌ No: Melee weapon + low Hydraulic Systems (won't be effective)

5. **Do I have storage capacity for this weapon?**
   - ✅ Yes: Currently own 4 weapons, default capacity is 5
   - ❌ No: Currently own 5 weapons, need Storage Facility first

**If you answered "No" to any question, reconsider the purchase.**

---

### Summary: Weapon Purchase Best Practices

1. **Start minimal**: 1-2 weapons per robot, no more
2. **Prioritize attributes**: Attributes provide permanent value, weapons are situational
3. **Experiment mid-game**: Wait until Month 3+ and ₡500K+ balance
4. **Understand matchups**: Only buy matchup-specific weapons if you understand when to use them
5. **Check storage**: Don't exceed 5 weapons without Storage Facility
6. **Avoid prestige weapons early**: Wait until you actually unlock them
7. **Consider opportunity cost**: Every ₡300K on weapons is ₡300K not on attributes or facilities

**Golden Rule**: When in doubt, upgrade attributes instead of buying weapons. Attributes always provide value; weapons are for optimization and experimentation.

---

## Practical Examples and Calculations

This section provides concrete examples with real numbers and step-by-step calculations. Use these examples to understand how game formulas work and to verify your own calculations.

### Example 1: Attribute Upgrade Cost Calculations

**Scenario**: You want to upgrade Combat Power from level 1 to level 10.

**Formula**: Cost to upgrade from level N to level N+1 = (N + 1) × ₡1,500

**Step-by-Step Calculation**:

```
Level 1 → 2: (1 + 1) × ₡1,500 = ₡3,000
Level 2 → 3: (2 + 1) × ₡1,500 = ₡4,500
Level 3 → 4: (3 + 1) × ₡1,500 = ₡6,000
Level 4 → 5: (4 + 1) × ₡1,500 = ₡7,500
Level 5 → 6: (5 + 1) × ₡1,500 = ₡9,000
Level 6 → 7: (6 + 1) × ₡1,500 = ₡10,500
Level 7 → 8: (7 + 1) × ₡1,500 = ₡12,000
Level 8 → 9: (8 + 1) × ₡1,500 = ₡13,500
Level 9 → 10: (9 + 1) × ₡1,500 = ₡15,000

Total Cost (Level 1 → 10): ₡81,000
```

**With Training Facility Level 1 (5% discount)**:
```
Total Cost: ₡81,000 × 0.95 = ₡76,950
Savings: ₡4,050
```

**Key Insight**: Upgrading attributes gets progressively more expensive. Level 1→5 costs ₡30,000, but level 6→10 costs ₡51,000.

---

#### Example 1.2: Multiple Attribute Upgrades

**Scenario**: Glass Cannon wants to upgrade 5 offensive attributes to level 12.

**Attributes**: Combat Power, Critical Systems, Penetration, Weapon Control, Targeting Systems

**Calculation for ONE attribute (Level 1 → 12)**:
```
Levels 1→10: ₡81,000 (from Example 1.1)
Level 10→11: (10 + 1) × ₡1,500 = ₡16,500
Level 11→12: (11 + 1) × ₡1,500 = ₡18,000

Total for one attribute (1→12): ₡115,500
```

**Total for 5 attributes**:
```
₡115,500 × 5 = ₡577,500
```

**With Training Facility Level 1 (5% discount)**:
```
₡577,500 × 0.95 = ₡548,625
Savings: ₡28,875
```

**Key Insight**: Training Facility saves ₡28,875 on this upgrade plan - nearly 10% of the facility's ₡300,000 cost. After ₡6M in upgrades, the facility pays for itself.

---

### Example 2: Repair Cost Calculations

**Formula**: Repair Cost = (Total Attributes × 100) × Damage % × Condition Multiplier

**Condition Multipliers**:
- Pristine (100%): 1.0×
- Good (80-99%): 1.1×
- Fair (60-79%): 1.2×
- Poor (40-59%): 1.3×
- Critical (0-39%): 1.5×

---

#### Example 2.1: Tank Fortress Repair Cost

**Scenario**: Tank Fortress robot with 230 total attributes takes 60% damage in a battle.

**Calculation**:
```
Total Attributes: 230
Damage Taken: 60%
Condition After Battle: 40% (Poor condition)
Condition Multiplier: 1.3×

Base Repair Cost: 230 × 100 × 0.60 = ₡13,800
With Condition Multiplier: ₡13,800 × 1.3 = ₡17,940
```

**With Repair Bay Level 1 (5% discount)**:
```
₡17,940 × 0.95 = ₡17,043
Savings: ₡897 per repair
```

**Key Insight**: Tank Fortress has moderate repair costs even with high damage. Condition multiplier adds 30% to repair costs when robot is in poor condition.

---

#### Example 2.2: Glass Cannon Repair Cost

**Scenario**: Glass Cannon robot with 180 total attributes takes 80% damage in a battle (lost badly).

**Calculation**:
```
Total Attributes: 180
Damage Taken: 80%
Condition After Battle: 20% (Critical condition)
Condition Multiplier: 1.5×

Base Repair Cost: 180 × 100 × 0.80 = ₡14,400
With Condition Multiplier: ₡14,400 × 1.5 = ₡21,600
```

**With Repair Bay Level 1 (5% discount)**:
```
₡21,600 × 0.95 = ₡20,520
Savings: ₡1,080 per repair
```

**Key Insight**: Glass Cannon has high repair costs when losing (80% damage). Critical condition multiplier adds 50% to repair costs. This is why Glass Cannon is high-risk in Bronze (low income, high repair costs).

---

#### Example 2.3: Comparing Repair Costs Across Damage Levels

**Scenario**: Balanced Brawler with 200 total attributes at different damage levels.

| Damage Taken | Condition After | Multiplier | Base Cost | Final Cost | With Repair Bay (-5%) |
|--------------|----------------|------------|-----------|------------|----------------------|
| 20% | 80% (Good) | 1.1× | ₡4,000 | ₡4,400 | ₡4,180 |
| 40% | 60% (Fair) | 1.2× | ₡8,000 | ₡9,600 | ₡9,120 |
| 60% | 40% (Poor) | 1.3× | ₡12,000 | ₡15,600 | ₡14,820 |
| 80% | 20% (Critical) | 1.5× | ₡16,000 | ₡24,000 | ₡22,800 |

**Key Insight**: Repair costs scale non-linearly. 80% damage costs 5.5× more than 20% damage due to condition multiplier. This is why yielding early is economically smart.

---

### Example 3: Weekly Income Projections

**Formula**: Weekly Income = (Battles × Win Rate × Win Reward) + (Battles × Participation Reward)

**League Rewards**:
- **Bronze**: ₡5,000-₡10,000 per win (avg ₡7,500), ₡1,500 participation
- **Silver**: ₡10,000-₡20,000 per win (avg ₡15,000), ₡3,000 participation
- **Gold**: ₡20,000-₡40,000 per win (avg ₡30,000), ₡6,000 participation

---

#### Example 3.1: Bronze League Income (50% Win Rate)

**Scenario**: 7 battles per week, 50% win rate in Bronze league.

**Calculation**:
```
Battles per week: 7
Win rate: 50% (3.5 wins)
Average win reward: ₡7,500
Participation reward: ₡1,500 per battle

Win income: 3.5 × ₡7,500 = ₡26,250
Participation income: 7 × ₡1,500 = ₡10,500

Total weekly income: ₡26,250 + ₡10,500 = ₡36,750
```

**Key Insight**: Even at 50% win rate in Bronze, you earn ₡36,750/week. Participation rewards are significant (29% of total income).

---

#### Example 3.2: Silver League Income (50% Win Rate)

**Scenario**: 7 battles per week, 50% win rate in Silver league.

**Calculation**:
```
Battles per week: 7
Win rate: 50% (3.5 wins)
Average win reward: ₡15,000
Participation reward: ₡3,000 per battle

Win income: 3.5 × ₡15,000 = ₡52,500
Participation income: 7 × ₡3,000 = ₡21,000

Total weekly income: ₡52,500 + ₡21,000 = ₡73,500
```

**Key Insight**: Silver league income is 2× Bronze income (₡73,500 vs ₡36,750). League advancement dramatically improves economics.

---

#### Example 3.3: Gold League Income (50% Win Rate)

**Scenario**: 7 battles per week, 50% win rate in Gold league.

**Calculation**:
```
Battles per week: 7
Win rate: 50% (3.5 wins)
Average win reward: ₡30,000
Participation reward: ₡6,000 per battle

Win income: 3.5 × ₡30,000 = ₡105,000
Participation income: 7 × ₡6,000 = ₡42,000

Total weekly income: ₡105,000 + ₡42,000 = ₡147,000
```

**Key Insight**: Gold league income is 4× Bronze income (₡147,000 vs ₡36,750). This is why advancing leagues is critical for economic success.

---

#### Example 3.4: Impact of Win Rate on Income

**Scenario**: Gold league, 7 battles per week, varying win rates.

| Win Rate | Wins | Win Income | Participation Income | Total Weekly Income |
|----------|------|------------|---------------------|---------------------|
| 30% | 2.1 | ₡63,000 | ₡42,000 | ₡105,000 |
| 40% | 2.8 | ₡84,000 | ₡42,000 | ₡126,000 |
| 50% | 3.5 | ₡105,000 | ₡42,000 | ₡147,000 |
| 60% | 4.2 | ₡126,000 | ₡42,000 | ₡168,000 |
| 70% | 4.9 | ₡147,000 | ₡42,000 | ₡189,000 |

**Key Insight**: In Gold league, each 10% increase in win rate adds ₡21,000/week income. Win rate optimization is valuable but not critical - even 30% win rate is profitable.

---

### Example 4: Facility ROI Calculations

#### Example 4.1: Training Facility Level 1 ROI

**Facility**: Training Facility Level 1
- **Purchase Cost**: ₡300,000
- **Operating Cost**: ₡1,500/day (₡10,500/week)
- **Benefit**: 5% discount on all attribute upgrades

**Scenario**: You plan to spend ₡100,000/week on attribute upgrades.

**Calculation**:
```
Weekly upgrade spending: ₡100,000
Savings from 5% discount: ₡100,000 × 0.05 = ₡5,000/week
Operating cost: ₡10,500/week
Net weekly savings: ₡5,000 - ₡10,500 = -₡5,500/week (NEGATIVE!)

Payback period: Never (facility costs more than it saves)
```

**Key Insight**: Training Facility Level 1 only makes sense if you spend ₡210,000+/week on upgrades (₡10,500 / 0.05 = ₡210,000). Most players don't upgrade that aggressively early game.

**When Training Facility Makes Sense**:
- Late-game (Month 6+) when upgrading attributes to level 20-30
- High-level upgrades are expensive (₡30,000+ per level)
- Long-term investment - pays off after ₡6M+ in total upgrades

---

#### Example 4.2: Repair Bay Level 1 ROI

**Facility**: Repair Bay Level 1
- **Purchase Cost**: ₡200,000
- **Operating Cost**: ₡1,000/day (₡7,000/week)
- **Benefit**: 5% discount on all repairs

**Scenario**: You spend ₡20,000/week on repairs (7 battles, moderate damage).

**Calculation**:
```
Weekly repair spending: ₡20,000
Savings from 5% discount: ₡20,000 × 0.05 = ₡1,000/week
Operating cost: ₡7,000/week
Net weekly savings: ₡1,000 - ₡7,000 = -₡6,000/week (NEGATIVE!)

Payback period: Never (facility costs more than it saves)
```

**Key Insight**: Repair Bay Level 1 only makes sense if you spend ₡140,000+/week on repairs (₡7,000 / 0.05 = ₡140,000). This requires multiple robots with high damage or very aggressive play.

**When Repair Bay Makes Sense**:
- Multi-robot stables (2+ robots battling regularly)
- High-damage archetypes (Glass Cannon with frequent losses)
- Late-game (Month 6+) when repair costs are ₡30,000+/week

---

#### Example 4.3: Income Generator Level 1 ROI

**Facility**: Income Generator Level 1
- **Purchase Cost**: ₡800,000
- **Operating Cost**: ₡1,000/day (₡7,000/week)
- **Benefit**: ₡10,000/week passive income (prestige-dependent, assumes 1,000 prestige)

**Calculation**:
```
Weekly passive income: ₡10,000
Operating cost: ₡7,000/week
Net weekly income: ₡10,000 - ₡7,000 = ₡3,000/week

Payback period: ₡800,000 / ₡3,000 = 267 weeks (5.1 years!)
```

**Key Insight**: Income Generator Level 1 has terrible ROI at low prestige. Passive income scales with prestige - at 5,000 prestige, passive income is ₡50,000/week, making ROI much better.

**When Income Generator Makes Sense**:
- High prestige (5,000+) - passive income scales dramatically
- Long-term investment - compounds over time
- Facility Investor archetype - core of strategy
- Late-game (Month 6+) when prestige is high

**Revised Calculation at 5,000 Prestige**:
```
Weekly passive income: ₡50,000
Operating cost: ₡7,000/week
Net weekly income: ₡50,000 - ₡7,000 = ₡43,000/week

Payback period: ₡800,000 / ₡43,000 = 18.6 weeks (4.6 months)
```

**Key Insight**: Income Generator becomes excellent investment at high prestige. This is why Facility Investor archetype is long-term focused.

---

#### Example 4.4: Roster Expansion Level 1 ROI

**Facility**: Roster Expansion Level 1
- **Purchase Cost**: ₡300,000
- **Operating Cost**: ₡500/day per extra robot (₡3,500/week for 2nd robot)
- **Benefit**: Allows owning 2 robots (capacity unlock, not cost savings)

**Calculation**:
```
This is a capacity unlock, not a cost-saving facility.
There is no direct ROI - it's a prerequisite for multi-robot strategies.

Operating cost: ₡3,500/week for 2nd robot slot
```

**Key Insight**: Roster Expansion doesn't "pay for itself" - it's a requirement for Two-Robot Specialist archetype. The value is strategic flexibility (matchup selection, redundancy), not economic ROI.

**When Roster Expansion Makes Sense**:
- Two-Robot Specialist archetype (mandatory)
- Late-game expansion (Month 6+) when you have ₡1M+ balance
- Strategic flexibility - want to optimize matchups
- Redundancy - if one robot is damaged, use the other

---

### Example 5: Prestige Accumulation Timeline

**Prestige Sources**:
- **Battle wins**: 5 prestige (Bronze), 10 prestige (Silver), 20 prestige (Gold), 30 prestige (Platinum)
- **Achievements**: 100-500 prestige per achievement
- **Tournaments**: 200-1,000 prestige per tournament (requires Booking Office)
- **Milestones**: 500-2,000 prestige for major milestones

---

#### Example 5.1: Path to 5,000 Prestige (Prestige Rusher)

**Scenario**: Prestige Rusher wants to reach 5,000 prestige to unlock premium content.

**Strategy**: Aggressive league advancement, high win rate, tournament participation.

**Timeline**:

**Months 1-2 (Bronze → Silver)**:
```
Battles: 7/week × 8 weeks = 56 battles
Win rate: 60% = 33.6 wins
Prestige from Bronze wins: 20 wins × 5 = 100 prestige
Prestige from Silver wins: 13.6 wins × 10 = 136 prestige
Achievements: 3 achievements × 200 = 600 prestige
Total: 836 prestige
```

**Months 3-4 (Silver → Gold)**:
```
Battles: 7/week × 8 weeks = 56 battles
Win rate: 55% = 30.8 wins
Prestige from Silver wins: 15 wins × 10 = 150 prestige
Prestige from Gold wins: 15.8 wins × 20 = 316 prestige
Achievements: 2 achievements × 300 = 600 prestige
Total: 1,066 prestige
Cumulative: 1,902 prestige
```

**Months 5-6 (Gold → Platinum)**:
```
Battles: 7/week × 8 weeks = 56 battles
Win rate: 50% = 28 wins
Prestige from Gold wins: 20 wins × 20 = 400 prestige
Prestige from Platinum wins: 8 wins × 30 = 240 prestige
Achievements: 2 achievements × 400 = 800 prestige
Tournaments: 2 tournaments × 500 = 1,000 prestige (requires Booking Office)
Total: 2,440 prestige
Cumulative: 4,342 prestige
```

**Month 7 (Platinum)**:
```
Battles: 7/week × 4 weeks = 28 battles
Win rate: 50% = 14 wins
Prestige from Platinum wins: 14 × 30 = 420 prestige
Achievements: 1 achievement × 500 = 500 prestige
Total: 920 prestige
Cumulative: 5,262 prestige ✓ (Goal reached!)
```

**Total Timeline**: 7 months to reach 5,000 prestige with aggressive play.

**Key Insight**: Prestige accumulation requires consistent wins, league advancement, and achievement completion. Tournaments (via Booking Office) accelerate prestige gains significantly.

---

#### Example 5.2: Path to 5,000 Prestige (Balanced Brawler)

**Scenario**: Balanced Brawler wants to reach 5,000 prestige with conservative play.

**Strategy**: Steady progression, 50% win rate, no tournament focus.

**Timeline**:

**Months 1-4 (Bronze → Silver → Gold)**:
```
Similar to Prestige Rusher but slower league advancement
Estimated prestige: 1,500 prestige
```

**Months 5-8 (Gold)**:
```
Battles: 7/week × 16 weeks = 112 battles
Win rate: 50% = 56 wins
Prestige from Gold wins: 56 × 20 = 1,120 prestige
Achievements: 4 achievements × 300 = 1,200 prestige
Total: 2,320 prestige
Cumulative: 3,820 prestige
```

**Months 9-12 (Gold → Platinum)**:
```
Battles: 7/week × 16 weeks = 112 battles
Win rate: 50% = 56 wins
Prestige from Gold/Platinum wins: 56 × 25 (avg) = 1,400 prestige
Achievements: 2 achievements × 400 = 800 prestige
Total: 2,200 prestige
Cumulative: 6,020 prestige ✓ (Goal reached!)
```

**Total Timeline**: 12 months to reach 5,000 prestige with conservative play.

**Key Insight**: Conservative play takes longer to accumulate prestige but is safer. Prestige Rusher reaches 5,000 in 7 months vs Balanced Brawler's 12 months.

---

### Example 6: Break-Even Win Rate Calculation

**Formula**: Break-Even Win Rate = Operating Costs / (Win Reward - Participation Reward)

This formula calculates the minimum win rate needed to cover operating costs.

---

#### Example 6.1: Tank Fortress Break-Even (Gold League)

**Scenario**: Tank Fortress in Gold league with moderate operating costs.

**Costs**:
```
Weekly facility costs: ₡7,000 (Repair Bay Level 1)
Weekly repair costs: ₡10,000 (low due to defensive build)
Total weekly costs: ₡17,000
```

**Income**:
```
Battles per week: 7
Win reward (Gold): ₡30,000 (average)
Participation reward (Gold): ₡6,000
Net win value: ₡30,000 (win reward already includes participation)
```

**Calculation**:
```
Required weekly income: ₡17,000
Income per win: ₡30,000
Required wins: ₡17,000 / ₡30,000 = 0.57 wins/week

Break-even win rate: 0.57 / 7 battles = 8.1%
```

**Key Insight**: Tank Fortress only needs 8.1% win rate to break even in Gold league! This is why Tank Fortress is low-risk - even terrible performance is profitable.

---

#### Example 6.2: Glass Cannon Break-Even (Bronze League)

**Scenario**: Glass Cannon in Bronze league with high repair costs.

**Costs**:
```
Weekly facility costs: ₡10,500 (Training Facility Level 1)
Weekly repair costs: ₡25,000 (high due to losses)
Total weekly costs: ₡35,500
```

**Income**:
```
Battles per week: 7
Win reward (Bronze): ₡7,500 (average)
Participation reward (Bronze): ₡1,500
Net win value: ₡7,500
```

**Calculation**:
```
Required weekly income: ₡35,500
Income per win: ₡7,500
Required wins: ₡35,500 / ₡7,500 = 4.73 wins/week

Break-even win rate: 4.73 / 7 battles = 67.6%
```

**Key Insight**: Glass Cannon needs 67.6% win rate to break even in Bronze league! This is why Glass Cannon is high-risk early game - must win consistently or go bankrupt.

---

#### Example 6.3: Glass Cannon Break-Even (Gold League)

**Scenario**: Same Glass Cannon, now in Gold league.

**Costs**:
```
Weekly facility costs: ₡10,500 (Training Facility Level 1)
Weekly repair costs: ₡25,000 (same as Bronze)
Total weekly costs: ₡35,500
```

**Income**:
```
Battles per week: 7
Win reward (Gold): ₡30,000 (average)
Participation reward (Gold): ₡6,000
Net win value: ₡30,000
```

**Calculation**:
```
Required weekly income: ₡35,500
Income per win: ₡30,000
Required wins: ₡35,500 / ₡30,000 = 1.18 wins/week

Break-even win rate: 1.18 / 7 battles = 16.9%
```

**Key Insight**: Glass Cannon only needs 16.9% win rate to break even in Gold league! League advancement transforms Glass Cannon from high-risk (67.6% break-even in Bronze) to low-risk (16.9% break-even in Gold).

---

### Summary: Key Formulas Reference

**Attribute Upgrade Cost**:
```
Cost (level N → N+1) = (N + 1) × ₡1,500
Total cost (level 1 → N) = Σ((i + 1) × ₡1,500) for i = 1 to N-1
```

**Repair Cost**:
```
Repair Cost = (Total Attributes × 100) × Damage % × Condition Multiplier
Condition Multipliers: Pristine 1.0×, Good 1.1×, Fair 1.2×, Poor 1.3×, Critical 1.5×
```

**Weekly Income**:
```
Weekly Income = (Battles × Win Rate × Win Reward) + (Battles × Participation Reward)
```

**Break-Even Win Rate**:
```
Break-Even Win Rate = (Weekly Operating Costs / Win Reward) / Battles per Week
```

**Facility ROI**:
```
Payback Period (weeks) = Purchase Cost / (Weekly Savings - Weekly Operating Cost)
```

**Prestige Accumulation**:
```
Prestige per Win: Bronze 5, Silver 10, Gold 20, Platinum 30, Diamond 50, Champion 75
```

---

## Risk Assessment and Warnings

This section identifies high-risk strategies, common pitfalls, and recovery strategies. Understanding these risks helps you make informed decisions and avoid bankruptcy.

### High-Risk Archetypes

#### Glass Cannon: High Risk in Bronze, Medium Risk in Silver, Low Risk in Gold+

**Why It's Risky**:
- **Low survivability**: Hull Integrity and Armor Plating are minimal
- **High repair costs when losing**: 70-80% damage per loss = ₡20,000+ repairs
- **Income-dependent**: Requires high win rate or high league income to sustain
- **Break-even win rate**: 67.6% in Bronze, 35% in Silver, 16.9% in Gold

**Risk Factors**:
- ❌ **Bronze league**: Low income (₡7,500/win) + high repair costs = bankruptcy risk
- ❌ **Losing streaks**: 3-4 consecutive losses can drain ₡60,000-80,000
- ❌ **Small buffer**: ₡5,000 reserve is only 1-2 repairs
- ✅ **Gold league**: High income (₡30,000/win) covers repair costs easily

**Warning Signs**:
- Balance drops below ₡100,000 in first month
- Losing 3+ battles in a row
- Repair costs exceeding ₡25,000/week
- Win rate below 40% in Bronze/Silver

**Mitigation Strategies**:
1. **Rush to Silver/Gold**: Advance leagues ASAP to increase income
2. **Yield aggressively**: Yield at 25-35% damage to minimize repair costs
3. **Add defensive attributes**: Invest ₡50-100K in Hull Integrity and Armor Plating
4. **Reduce battle frequency**: Battle 5×/week instead of 7× if struggling
5. **Transition to Balanced Brawler**: Add defense to stabilize economics

---

#### Prestige Rusher: Medium-High Risk

**Why It's Risky**:
- **Win rate dependent**: Strategy requires 55-60% win rate to justify approach
- **Competitive pressure**: Must advance leagues quickly to maximize prestige
- **Tournament costs**: Booking Office (₡400K) + tournament entry fees
- **Opportunity cost**: Credits spent on win-rate optimization could go to facilities

**Risk Factors**:
- ❌ **Below 50% win rate**: Strategy fails if you can't win consistently
- ❌ **Stuck in Bronze/Silver**: Low prestige gains delay unlocks
- ❌ **Tournament losses**: Entry fees wasted if you don't place well
- ✅ **High win rate**: 60%+ win rate makes strategy excellent

**Warning Signs**:
- Win rate below 50% for 2+ weeks
- Stuck in same league for 4+ weeks
- Balance not growing despite battles
- Prestige accumulation slower than projected

**Mitigation Strategies**:
1. **Focus on win rate**: Optimize attributes for balanced offense/defense
2. **Skip tournaments early**: Wait until Gold+ league for tournament participation
3. **Transition if struggling**: Pivot to Balanced Brawler if win rate is low
4. **Delay Booking Office**: Purchase after reaching Gold league, not before

---

#### Facility Investor: Low Risk, Slow Start

**Why It's Risky (Sort Of)**:
- **Slow start**: Facilities don't pay off immediately
- **Weak combat**: Budget robot and weapons = lower win rate early
- **Long payback**: Income Generator takes 18+ weeks to pay for itself
- **Opportunity cost**: ₡1.5M in facilities could upgrade robot significantly

**Risk Factors**:
- ❌ **Impatience**: Expecting immediate returns (facilities are long-term)
- ❌ **Over-investment**: Buying too many facilities too early
- ❌ **Neglecting robot**: Weak robot = can't win battles = no income
- ✅ **Patience**: Facilities compound over time - excellent long-term

**Warning Signs**:
- Win rate below 40% (robot too weak)
- Balance not growing after 2 months
- Facility operating costs exceeding income
- Prestige below 1,000 after 3 months

**Mitigation Strategies**:
1. **Balance facilities and robot**: Don't neglect attribute upgrades
2. **Prioritize Training Facility**: 5% discount helps long-term
3. **Delay Income Generator**: Wait until 2,000+ prestige for better passive income
4. **Accept slow start**: Strategy pays off in months 4-6, not months 1-2

---

### Bankruptcy Scenarios and How to Avoid Them

#### Scenario 1: The Death Spiral (Glass Cannon in Bronze)

**What Happens**:
1. Glass Cannon loses 3 battles in a row (₡60,000 in repairs)
2. Balance drops to ₡50,000
3. Player panics and battles more to recover
4. Loses 2 more battles (₡40,000 in repairs)
5. Balance drops to ₡10,000
6. Can't afford next repair (₡20,000)
7. **Bankruptcy**

**How to Avoid**:
- ✅ **Stop battling** when balance drops below ₡100,000
- ✅ **Yield aggressively** (25-35% damage) to reduce repair costs
- ✅ **Add defensive attributes** (₡50K in Hull Integrity and Armor Plating)
- ✅ **Wait for balance recovery** before resuming normal battle frequency
- ✅ **Transition to Balanced Brawler** if losing streak continues

**Recovery Strategy**:
1. Stop battling immediately
2. Sell unnecessary weapons for 50% value (if any)
3. Battle conservatively (defensive stance, high yield threshold)
4. Focus on participation rewards (₡1,500/battle) rather than wins
5. Rebuild balance to ₡200,000 before returning to normal strategy

---

#### Scenario 2: Facility Over-Investment (Facility Investor)

**What Happens**:
1. Facility Investor buys Income Generator (₡800K), Training Facility (₡300K), Repair Bay (₡200K)
2. Total spent: ₡1.3M on facilities
3. Remaining budget: ₡1.7M for robot, weapons, attributes
4. Robot is weak (only ₡1M in attributes)
5. Win rate is 30% (can't compete)
6. Facility operating costs (₡18,500/week) exceed income
7. Balance slowly drains
8. **Bankruptcy** (slow death over 3-4 months)

**How to Avoid**:
- ✅ **Balance facilities and robot**: Don't spend more than 50% on facilities early
- ✅ **Prioritize one facility**: Start with Training Facility or Repair Bay, not both
- ✅ **Delay Income Generator**: Wait until 2,000+ prestige for better ROI
- ✅ **Ensure robot competitiveness**: Need ₡1.5M+ in robot/weapons/attributes
- ✅ **Monitor operating costs**: Facility costs should be <30% of weekly income

**Recovery Strategy**:
1. Stop buying facilities
2. Invest all surplus in robot attributes (Combat Power, Hull Integrity)
3. Improve win rate to 45-50%
4. Wait for facilities to pay off (months 4-6)
5. Consider selling facilities if situation is dire (50% value recovery)

---

#### Scenario 3: Weapon Experimentation Trap

**What Happens**:
1. Balanced Brawler buys 2× Machine Guns (₡300K) to try dual-wield
2. Realizes dual-wield doesn't fit playstyle
3. Buys Plasma Cannon (₡400K) to try two-handed
4. Realizes two-handed is too risky
5. Total wasted: ₡700K on weapons (can sell for ₡350K)
6. Balance is ₡200K (dangerously low)
7. Can't afford attribute upgrades or facility investments
8. **Economic stagnation** (not bankruptcy, but stuck)

**How to Avoid**:
- ✅ **Start with one weapon**: Master your initial loadout before experimenting
- ✅ **Research before buying**: Understand loadout types before purchasing
- ✅ **Wait until mid-game**: Experiment only when balance is ₡500K+
- ✅ **Accept sunk costs**: If weapon doesn't work, sell it and move on
- ✅ **Prioritize attributes**: Attributes always provide value, weapons are situational

**Recovery Strategy**:
1. Sell unused weapons for 50% value
2. Stick with one loadout type
3. Invest recovered credits in attributes
4. Don't experiment again until balance is ₡500K+

---

### Consequences of Poor Early Decisions

#### Mistake 1: Buying Wrong Facilities

**Example**: Tank Fortress buys Training Facility Level 1 (₡300K) on Day 1.

**Why It's Bad**:
- Training Facility saves 5% on attribute upgrades
- Tank Fortress only spends ₡1.2M on attributes initially
- Savings: ₡1.2M × 0.05 = ₡60K
- Operating cost: ₡10,500/week × 4 weeks = ₡42K
- Net benefit in first month: ₡60K - ₡42K = ₡18K
- **Opportunity cost**: ₡300K could have upgraded Hull Integrity 10→15 (₡75K) and Armor Plating 10→15 (₡75K) with ₡150K left over

**Better Decision**: Skip Training Facility early. Buy it in Month 3-4 when upgrading to high levels (20-30).

---

#### Mistake 2: Overspending on Weapons

**Example**: Speed Demon buys 2× Machine Guns (₡300K), 2× Plasma Blades (₡400K), and Machine Gun + Plasma Blade hybrid (₡250K).

**Why It's Bad**:
- Total spent on weapons: ₡950K
- Only need 2 weapons for dual-wield (₡300-400K)
- Wasted: ₡550-650K on unnecessary weapons
- **Opportunity cost**: ₡550K could have upgraded Attack Speed 12→20 (₡150K), Servo Motors 10→18 (₡150K), and Gyro Stabilizers 10→18 (₡150K)

**Better Decision**: Buy one dual-wield set (₡300-400K). Experiment with alternatives in mid-game (Month 4+).

---

#### Mistake 3: Neglecting Reserve Buffer

**Example**: Glass Cannon spends entire ₡3M budget (₡0 reserve).

**Why It's Bad**:
- First loss costs ₡20K in repairs
- No buffer to cover repair
- Must win next battle or face bankruptcy
- **High stress**: Every battle is life-or-death

**Better Decision**: Keep ₡50-100K reserve for Glass Cannon (2-5 repairs). Accept slightly weaker initial build for safety.

---

### Recovery Strategies

#### Recovery from Bankruptcy (Balance Below ₡50,000)

**Immediate Actions**:
1. **Stop battling immediately** - prevent further losses
2. **Sell unused weapons** - recover 50% of purchase price
3. **Sell unused facilities** - recover 50% of purchase price (last resort)
4. **Assess situation** - calculate break-even win rate and required income

**Short-Term Strategy (Weeks 1-2)**:
1. **Battle conservatively** - defensive stance (20/80), high yield threshold (60%+)
2. **Focus on participation rewards** - ₡1,500-6,000 per battle (league-dependent)
3. **Minimize repair costs** - yield early, avoid expensive battles
4. **Rebuild balance to ₡100,000** - safety threshold

**Medium-Term Strategy (Weeks 3-6)**:
1. **Add defensive attributes** - Hull Integrity and Armor Plating to level 8-10
2. **Improve win rate** - balanced build is more sustainable
3. **Advance leagues** - higher income makes recovery easier
4. **Rebuild balance to ₡200,000** - comfortable threshold

**Long-Term Strategy (Months 2-3)**:
1. **Return to normal strategy** - resume archetype plan
2. **Learn from mistakes** - identify what caused bankruptcy
3. **Adjust risk tolerance** - more conservative approach going forward

---

#### Recovery from Economic Stagnation (Balance Not Growing)

**Symptoms**:
- Balance hovering around ₡100-200K for 4+ weeks
- Win rate is 45-50% (not terrible, but not growing)
- Income barely covers operating costs
- No surplus for investments

**Diagnosis**:
1. **Calculate weekly net income** - income minus costs
2. **Identify bottleneck** - low win rate? high repair costs? high facility costs?
3. **Assess archetype fit** - is your archetype working for you?

**Solutions**:

**If Low Win Rate (Below 45%)**:
- Invest in key attributes (Combat Power, Hull Integrity)
- Adjust battle stance (more defensive if losing, more offensive if winning but slowly)
- Consider archetype transition (Balanced Brawler is most forgiving)

**If High Repair Costs (₡20,000+/week)**:
- Yield earlier (higher yield threshold)
- Add defensive attributes (Hull Integrity, Armor Plating)
- Consider Repair Bay Level 1 (if repair costs are ₡30,000+/week)

**If High Facility Costs (₡15,000+/week)**:
- Evaluate facility ROI - are they paying for themselves?
- Consider selling underperforming facilities (50% value recovery)
- Delay future facility purchases until balance is ₡500K+

---

### "Trap" Investments (Poor Early-Game ROI)

#### Trap 1: Training Facility Level 1 (Early Game)

**Why It's a Trap**:
- Costs ₡300,000 + ₡10,500/week operating cost
- Saves 5% on attribute upgrades
- Only pays for itself after ₡6M in attribute upgrades
- Most players spend ₡1-2M on attributes in first 3 months
- **Net loss**: -₡100,000+ in first 3 months

**When It's Good**: Late-game (Month 6+) when upgrading attributes to level 20-30 (₡30,000+ per level).

**Alternative**: Skip Training Facility early. Invest ₡300K in attributes directly for immediate power boost.

---

#### Trap 2: Repair Bay Level 1 (Single Robot)

**Why It's a Trap**:
- Costs ₡200,000 + ₡7,000/week operating cost
- Saves 5% on repairs
- Only pays for itself if repair costs are ₡140,000+/week
- Single robot with moderate damage: ₡15-20K/week repairs
- **Net loss**: -₡150,000+ in first 3 months

**When It's Good**: Multi-robot stables (2+ robots) with ₡30,000+/week repair costs.

**Alternative**: Skip Repair Bay early. Invest ₡200K in defensive attributes (Hull Integrity, Armor Plating) to reduce damage taken.

---

#### Trap 3: Income Generator Level 1 (Low Prestige)

**Why It's a Trap**:
- Costs ₡800,000 + ₡7,000/week operating cost
- Provides ₡10,000/week passive income at 1,000 prestige
- Net income: ₡3,000/week
- Payback period: 267 weeks (5.1 years!)
- **Terrible ROI** at low prestige

**When It's Good**: High prestige (5,000+) when passive income is ₡50,000+/week (payback in 18 weeks).

**Alternative**: Skip Income Generator early. Invest ₡800K in robot/weapons/attributes for better win rate and higher battle income.

---

#### Trap 4: Storage Facility (Before You Need It)

**Why It's a Trap**:
- Costs ₡150,000 + ₡500/week operating cost
- Provides weapon storage capacity (10 weapons at Level 1)
- Default capacity is 5 weapons - sufficient for most archetypes
- **No benefit** until you own 6+ weapons

**When It's Good**: Late-game (Month 6+) when you own 6+ weapons and need storage.

**Alternative**: Skip Storage Facility until you actually need it. Most players don't need more than 5 weapons until late-game.

---

#### Trap 5: Roster Expansion (Before You Can Afford 2nd Robot)

**Why It's a Trap**:
- Costs ₡300,000 + ₡3,500/week operating cost
- Allows owning 2 robots (capacity unlock)
- 2nd robot costs ₡500K + ₡200-400K weapon + ₡200K attributes = ₡900-1,100K total
- **Total investment**: ₡1.2-1.4M for 2-robot setup
- If you can't afford 2nd robot immediately, Roster Expansion sits idle

**When It's Good**: When you have ₡1.5M+ balance and can afford full 2-robot setup.

**Alternative**: Wait until you have ₡1.5M+ balance. Don't buy Roster Expansion until you're ready to buy 2nd robot immediately.

---

### Risk Assessment Summary by Archetype

| Archetype | Bronze Risk | Silver Risk | Gold+ Risk | Primary Risk Factor | Mitigation Strategy |
|-----------|-------------|-------------|------------|---------------------|---------------------|
| Tank Fortress | Low | Low | Low | None - very safe | None needed |
| Glass Cannon | **High** | Medium | Low | Repair costs vs income | Rush to Gold league |
| Speed Demon | Medium | Medium | Low | Moderate repair costs | Yield at 35-45% |
| Balanced Brawler | Low | Low | Low | None - very safe | None needed |
| Facility Investor | Low | Low | Low | Slow start | Be patient |
| Two-Robot Specialist | Medium | Medium | Low | High initial investment | Need ₡1.5M+ balance |
| Melee Specialist | Medium | Medium | Low | Positioning risk | Master movement |
| Ranged Sniper | Medium | Medium | Low | Accuracy-dependent | Upgrade Targeting Systems |
| AI Tactician | Medium | Medium | Low | AI learning curve | Study AI mechanics |
| Prestige Rusher | **Medium-High** | Medium | Low | Win rate dependent | Maintain 55%+ win rate |

**Key Insight**: Most archetypes become low-risk in Gold+ league due to high income. Bronze/Silver is where risk is highest.

---

## Quick Reference

This section provides summary tables and cheat sheets for quick lookup. Use these tables to compare archetypes, check costs, and reference key information without reading the full guide.

### Archetype Summary Table

| Archetype | Build Style | Loadout | Risk (Bronze/Silver/Gold) | Resource Split | Best For |
|-----------|-------------|---------|---------------------------|----------------|----------|
| Tank Fortress | Defensive Tank | Weapon+Shield | Low/Low/Low | 45% robot, 25% weapons, 20% facilities, 10% buffer | Players who enjoy defensive play, survivability, and low-risk strategies |
| Glass Cannon | Offensive Powerhouse | Two-Handed | High/Medium/Low | 50% robot, 30% weapon, 15% facilities, 5% buffer | Players who enjoy high-risk/high-reward, aggressive play, and quick battles |
| Speed Demon | High Mobility DPS | Dual-Wield | Medium/Medium/Low | 40% robot, 30% weapons, 20% facilities, 10% buffer | Players who enjoy fast-paced combat, DPS optimization, and mobility |
| Balanced Brawler | Flexible All-Rounder | Single | Low/Low/Low | 40% robot, 20% weapon, 25% facilities, 15% buffer | New players, players who prefer flexibility and safety |
| Facility Investor | Economic Focus | Single (Budget) | Low/Low/Low | 50% facilities, 30% robot, 15% weapons, 5% buffer | Players who enjoy economic simulation, long-term planning, and passive growth |
| Two-Robot Specialist | Roster Diversity | Varied | Medium/Medium/Low | 55% robots, 25% weapons, 15% facilities, 5% buffer | Players who enjoy variety, strategic matchup selection, and portfolio management |
| Melee Specialist | Melee Powerhouse | Two-Handed Melee | Medium/Medium/Low | 45% robot, 30% weapon, 20% facilities, 5% buffer | Players who enjoy melee combat, positioning gameplay, and high-impact strikes |
| Ranged Sniper | Precision Striker | Two-Handed Ranged | Medium/Medium/Low | 45% robot, 30% weapon, 20% facilities, 5% buffer | Players who enjoy precision gameplay, calculated strikes, and ranged combat |
| AI Tactician | AI-Optimized | Any (Balanced) | Medium/Medium/Low | 45% robot, 25% weapon, 25% facilities, 5% buffer | Players who enjoy strategic depth, AI optimization, and tactical gameplay |
| Prestige Rusher | Win-Optimized | Cost-Effective | Medium-High/Medium/Low | 50% robot, 25% weapons, 20% facilities, 5% buffer | Competitive players who enjoy progression systems, unlocks, and long-term goals |

---

### Budget Allocation Summary

| Archetype | Robot Cost | Attribute Upgrades | Weapons | Facilities | Reserve | Total |
|-----------|------------|-------------------|---------|------------|---------|-------|
| Tank Fortress | ₡500,000 | ₡850,000 | ₡500,000 (Shield+Sword) | ₡600,000 (Repair Bay) | ₡50,000 | ₡2,500,000 |
| Glass Cannon | ₡500,000 | ₡1,200,000 | ₡400,000 (Plasma Cannon) | ₡300,000 (Training Facility) | ₡100,000 | ₡2,500,000 |
| Speed Demon | ₡500,000 | ₡900,000 | ₡400,000 (2× Plasma Blades) | ₡550,000 (Training + Workshop) | ₡150,000 | ₡2,500,000 |
| Balanced Brawler | ₡500,000 | ₡800,000 | ₡200,000 (Power Sword) | ₡500,000 (Training + Repair) | ₡500,000 | ₡2,500,000 |
| Facility Investor | ₡500,000 | ₡600,000 | ₡150,000 (Machine Gun) | ₡1,500,000 (Income + Repair + Training) | ₡250,000 | ₡3,000,000 |
| Two-Robot Specialist | ₡1,000,000 (2 robots) | ₡800,000 | ₡700,000 (2 weapons) | ₡300,000 (Roster Expansion) | ₡200,000 | ₡3,000,000 |
| Melee Specialist | ₡500,000 | ₡1,000,000 | ₡350,000 (Heavy Hammer) | ₡300,000 (Training Facility) | ₡350,000 | ₡2,500,000 |
| Ranged Sniper | ₡500,000 | ₡1,000,000 | ₡350,000 (Railgun) | ₡300,000 (Training Facility) | ₡350,000 | ₡2,500,000 |
| AI Tactician | ₡500,000 | ₡900,000 | ₡250,000 (Plasma Rifle) | ₡500,000 (AI Training Academy) | ₡350,000 | ₡2,500,000 |
| Prestige Rusher | ₡500,000 | ₡1,200,000 | ₡200,000 (Power Sword) | ₡400,000 (Booking Office) | ₡200,000 | ₡2,500,000 |

**Note**: Most archetypes spend ₡2.5M of the ₡3M budget, keeping ₡500K for early operations. Facility Investor and Two-Robot Specialist spend closer to ₡3M due to high initial investments.

---

### League Income Reference

| League | Win Reward (Avg) | Participation Reward | Weekly Income (7 battles, 50% win rate) | Break-Even Win Rate (₡20K costs) |
|--------|------------------|---------------------|----------------------------------------|----------------------------------|
| Bronze | ₡7,500 | ₡1,500 | ₡36,750 | 54% |
| Silver | ₡15,000 | ₡3,000 | ₡73,500 | 27% |
| Gold | ₡30,000 | ₡6,000 | ₡147,000 | 13% |
| Platinum | ₡60,000 | ₡12,000 | ₡294,000 | 7% |
| Diamond | ₡115,000 | ₡24,000 | ₡569,500 | 4% |
| Champion | ₡225,000 | ₡45,000 | ₡1,102,500 | 2% |

**Key Insight**: League advancement dramatically improves economics. Gold league income is 4× Bronze income. Even low win rates are profitable in higher leagues.

---

### Facility Cost Reference

| Facility | Level 1 Cost | Operating Cost (Daily) | Operating Cost (Weekly) | Benefit | When to Buy |
|----------|--------------|------------------------|-------------------------|---------|-------------|
| Repair Bay | ₡200,000 | ₡1,000 | ₡7,000 | 5% repair discount | Multi-robot stables, Month 6+ |
| Training Facility | ₡300,000 | ₡1,500 | ₡10,500 | 5% attribute upgrade discount | Late-game (Month 6+), high-level upgrades |
| Weapons Workshop | ₡250,000 | ₡1,000 | ₡7,000 | 5% weapon purchase discount | Rarely (weapons are one-time purchases) |
| Income Generator | ₡800,000 | ₡1,000 | ₡7,000 | Passive income (prestige-dependent) | High prestige (5,000+), Month 6+ |
| Roster Expansion | ₡300,000 | ₡500/robot | ₡3,500 (2nd robot) | Allows owning 2+ robots | When you have ₡1.5M+ for full 2-robot setup |
| Storage Facility | ₡150,000 | ₡500 | ₡3,500 | 10 weapon capacity (default 5) | When you own 6+ weapons |
| Combat Training Academy | ₡400,000 | ₡2,000 | ₡14,000 | +10% Combat attribute effectiveness | Late-game (Month 9+), offensive builds |
| Defense Training Academy | ₡400,000 | ₡2,000 | ₡14,000 | +10% Defense attribute effectiveness | Late-game (Month 9+), defensive builds |
| Mobility Training Academy | ₡400,000 | ₡2,000 | ₡14,000 | +10% Mobility attribute effectiveness | Late-game (Month 9+), speed builds |
| AI Training Academy | ₡500,000 | ₡2,500 | ₡17,500 | +15% AI attribute effectiveness | AI Tactician archetype, 5,000+ prestige |
| Booking Office | ₡400,000 | ₡2,000 | ₡14,000 | Tournament access (bonus prestige) | Prestige Rusher archetype, Gold+ league |

**Key Insight**: Most facilities have poor early-game ROI. Wait until mid-late game (Month 6+) when you have surplus credits and high usage.

---

### Weapon Cost Reference (By Tier)

#### Budget Tier (₡50,000-₡150,000)
| Weapon | Cost | Type | Loadout | Best For |
|--------|------|------|---------|----------|
| Practice Sword | ₡50,000 | Melee | Single | Facility Investor (budget option) |
| Machine Gun | ₡150,000 | Ranged | Single/Dual-Wield | Speed Demon, Balanced Brawler |

#### Mid Tier (₡200,000-₡250,000)
| Weapon | Cost | Type | Loadout | Best For |
|--------|------|------|---------|----------|
| Power Sword | ₡200,000 | Melee | Single/Weapon+Shield | Tank Fortress, Balanced Brawler |
| Plasma Blade | ₡200,000 | Melee | Single/Dual-Wield | Speed Demon (melee variant) |
| Plasma Rifle | ₡250,000 | Ranged | Single | Balanced Brawler, AI Tactician |

#### Premium Tier (₡300,000-₡400,000)
| Weapon | Cost | Type | Loadout | Best For |
|--------|------|------|---------|----------|
| Battle Axe | ₡300,000 | Melee | Two-Handed | Melee Specialist |
| Sniper Rifle | ₡300,000 | Ranged | Two-Handed | Ranged Sniper |
| Combat Shield | ₡300,000 | Shield | Weapon+Shield | Tank Fortress (required) |
| Railgun | ₡350,000 | Ranged | Two-Handed | Glass Cannon, Ranged Sniper |
| Heavy Hammer | ₡350,000 | Melee | Two-Handed | Melee Specialist |
| Plasma Cannon | ₡400,000 | Ranged | Two-Handed | Glass Cannon |

#### Prestige-Locked Tier (₡500,000-₡800,000)
| Weapon | Cost | Prestige Required | Type | Loadout | Best For |
|--------|------|-------------------|------|---------|----------|
| Quantum Blade | ₡600,000 | 10,000 | Melee | Single/Two-Handed | Prestige Rusher (upgrade) |
| Fusion Cannon | ₡700,000 | 15,000 | Ranged | Two-Handed | Glass Cannon (upgrade) |
| Graviton Hammer | ₡800,000 | 20,000 | Melee | Two-Handed | Melee Specialist (upgrade) |

**Key Insight**: Start with budget-mid tier weapons (₡150-250K). Premium tier (₡300-400K) is for specialized builds. Prestige-locked tier is late-game (Month 9+).

---

### Attribute Upgrade Cost Quick Reference

| Level Range | Cost per Level (Avg) | Total Cost (10 levels) | With Training Facility (-5%) |
|-------------|---------------------|------------------------|------------------------------|
| 1-10 | ₡8,100 | ₡81,000 | ₡76,950 |
| 11-20 | ₡23,100 | ₡231,000 | ₡219,450 |
| 21-30 | ₡38,100 | ₡381,000 | ₡361,950 |
| 31-40 | ₡53,100 | ₡531,000 | ₡504,450 |

**Formula**: Cost (level N → N+1) = (N + 1) × ₡1,500

**Key Insight**: Attribute costs scale linearly. Level 1-10 costs ₡81K, but level 21-30 costs ₡381K (4.7× more expensive).

---

### Repair Cost Quick Reference

**Formula**: Repair Cost = (Total Attributes × 100) × Damage % × Condition Multiplier

**Condition Multipliers**:
- Pristine (100%): 1.0×
- Good (80-99%): 1.1×
- Fair (60-79%): 1.2×
- Poor (40-59%): 1.3×
- Critical (0-39%): 1.5×

**Example Repair Costs (200 Total Attributes)**:

| Damage Taken | Condition After | Multiplier | Repair Cost | With Repair Bay (-5%) |
|--------------|----------------|------------|-------------|----------------------|
| 20% | 80% (Good) | 1.1× | ₡4,400 | ₡4,180 |
| 40% | 60% (Fair) | 1.2× | ₡9,600 | ₡9,120 |
| 60% | 40% (Poor) | 1.3× | ₡15,600 | ₡14,820 |
| 80% | 20% (Critical) | 1.5× | ₡24,000 | ₡22,800 |

**Key Insight**: Repair costs scale non-linearly due to condition multipliers. 80% damage costs 5.5× more than 20% damage.

---

### Prestige Accumulation Quick Reference

**Prestige per Win**:
- Bronze: 5 prestige
- Silver: 10 prestige
- Gold: 20 prestige
- Platinum: 30 prestige
- Diamond: 50 prestige
- Champion: 75 prestige

**Prestige Milestones**:
- 1,000 prestige: Basic unlocks
- 5,000 prestige: Premium weapons, AI Training Academy
- 10,000 prestige: Advanced facilities, Quantum Blade
- 20,000 prestige: Elite content, Graviton Hammer
- 50,000 prestige: Champion-tier unlocks

**Timeline to 5,000 Prestige**:
- Prestige Rusher: 7 months (aggressive play, 60% win rate)
- Balanced Brawler: 12 months (conservative play, 50% win rate)
- Facility Investor: 15 months (economic focus, 45% win rate)

**Key Insight**: Prestige accumulation requires consistent wins and league advancement. Tournaments (via Booking Office) accelerate prestige gains.

---

### Break-Even Win Rate Quick Reference

**Formula**: Break-Even Win Rate = (Weekly Operating Costs / Win Reward) / Battles per Week

**Example Break-Even Win Rates (₡20,000 weekly costs, 7 battles/week)**:

| League | Win Reward (Avg) | Break-Even Win Rate |
|--------|------------------|---------------------|
| Bronze | ₡7,500 | 54% |
| Silver | ₡15,000 | 27% |
| Gold | ₡30,000 | 13% |
| Platinum | ₡60,000 | 7% |
| Diamond | ₡115,000 | 4% |

**Key Insight**: Higher leagues have lower break-even win rates. Even 30% win rate is profitable in Gold+.

---

### Loadout Type Bonuses Quick Reference

| Loadout Type | Bonus | Best For | Example Weapons |
|--------------|-------|----------|-----------------|
| Single Weapon | +10% to all attributes | Flexibility, beginners | Power Sword, Plasma Rifle |
| Weapon+Shield | +20% defense, counter-attack damage | Defensive builds | Combat Shield + Power Sword |
| Two-Handed | +25-30% damage (weapon-dependent) | Offensive builds | Plasma Cannon, Heavy Hammer |
| Dual-Wield | +20% attack speed | High DPS builds | 2× Machine Guns, 2× Plasma Blades |

**Key Insight**: Loadout bonuses are significant. Two-handed provides highest damage, dual-wield provides highest DPS, weapon+shield provides highest defense.

---

### Archetype Transition Costs Quick Reference

| Transition | Cost | Timeline | Difficulty | Success Rate |
|------------|------|----------|------------|--------------|
| Glass Cannon → Balanced Brawler | ₡100,000-200,000 | 2-4 weeks | Easy | High |
| Balanced Brawler → Speed Demon | ₡400,000-600,000 | 4-8 weeks | Medium | Medium |
| Tank Fortress → Facility Investor | ₡800,000-1,500,000 | 8-12 weeks | Easy | High |
| Facility Investor → Two-Robot Specialist | ₡1,200,000-1,500,000 | 8-12 weeks | Medium | Medium |
| Speed Demon → Melee Specialist | ₡300,000-500,000 | 4-6 weeks | Medium | Medium |
| Prestige Rusher → AI Tactician | ₡500,000-800,000 | 6-8 weeks | Hard | Medium |

**Key Insight**: Transitions require significant investment (₡100K-1.5M) and time (2-12 weeks). Plan carefully and ensure financial stability before transitioning.

---

### Common Mistakes Quick Reference

| Mistake | Cost | Impact | How to Avoid |
|---------|------|--------|--------------|
| Buying Training Facility too early | ₡300,000 | Negative ROI for 6+ months | Wait until Month 6+, high-level upgrades |
| Over-investing in weapons | ₡300,000-700,000 | Wasted credits, no power gain | Buy 1-2 weapons initially, experiment mid-game |
| Neglecting reserve buffer | ₡0 (no buffer) | Bankruptcy risk | Keep ₡50-200K reserve depending on archetype |
| Buying Roster Expansion without 2nd robot | ₡300,000 | Idle facility, wasted operating costs | Only buy when you have ₡1.5M+ for full 2-robot setup |
| Buying Storage Facility before needed | ₡150,000 | Wasted credits, no benefit | Only buy when you own 6+ weapons |
| Staying in Bronze too long | Opportunity cost | Low income, high risk | Advance to Silver/Gold ASAP |

**Key Insight**: Most mistakes involve buying facilities too early or over-investing in weapons. Prioritize attributes and league advancement.

---

## Appendices

### Appendix A: Complete Attribute List

This appendix lists all 23 robot attributes organized by category, with brief descriptions of their effects.

#### Combat Attributes (6)

| Attribute | Description | Primary Effect | Best For |
|-----------|-------------|----------------|----------|
| Combat Power | Base damage output | Increases damage dealt per attack | All offensive builds |
| Penetration | Armor penetration | Bypasses enemy armor, increases effective damage | Glass Cannon, Ranged Sniper |
| Critical Systems | Critical hit chance and damage | Increases chance of critical hits (2× damage) | Glass Cannon, Ranged Sniper |
| Weapon Control | Weapon accuracy | Increases hit chance, reduces misses | All builds (accuracy is universal) |
| Hydraulic Systems | Melee damage multiplier | Dramatically increases melee weapon damage | Melee Specialist |
| Targeting Systems | Precision and critical chance | Increases accuracy and critical hit chance | Ranged Sniper, AI Tactician |

**Key Insight**: Combat Power is universal, but specialized attributes (Hydraulic Systems, Targeting Systems) provide better scaling for specific builds.

---

#### Defense Attributes (6)

| Attribute | Description | Primary Effect | Best For |
|-----------|-------------|----------------|----------|
| Hull Integrity | Hit points (HP) | Increases maximum HP, survivability | All builds (HP is universal) |
| Armor Plating | Damage reduction | Reduces incoming damage by percentage | Tank Fortress, defensive builds |
| Shield Capacity | Shield HP | Increases shield HP (weapon+shield loadout only) | Tank Fortress (weapon+shield) |
| Damage Control | Critical damage reduction | Reduces critical hit damage taken | All builds (prevents spikes) |
| Counter Protocols | Counter-attack damage | Increases damage dealt when counter-attacking | Tank Fortress (defensive stance) |
| Redundant Systems | System failure resistance | Reduces chance of system failures (critical hits) | Tank Fortress, late-game builds |

**Key Insight**: Hull Integrity is universal, but specialized attributes (Armor Plating, Shield Capacity) provide better scaling for defensive builds.

---

#### Mobility Attributes (6)

| Attribute | Description | Primary Effect | Best For |
|-----------|-------------|----------------|----------|
| Attack Speed | Attacks per round | Increases number of attacks per round | Speed Demon, DPS builds |
| Servo Motors | Movement speed | Increases movement speed, positioning control | Speed Demon, Melee Specialist |
| Gyro Stabilizers | Accuracy while moving | Maintains accuracy during movement | Speed Demon, mobile builds |
| Reaction Time | Dodge chance | Increases chance to dodge attacks | Speed Demon, evasion builds |
| Evasion Systems | Evasion effectiveness | Increases dodge chance and evasion effectiveness | Speed Demon, late-game builds |
| Sensor Suite | Target acquisition | Improves target acquisition, hit chance | Ranged Sniper, precision builds |

**Key Insight**: Attack Speed and Servo Motors are core for Speed Demon. Other mobility attributes are situational or late-game.

---

#### AI Attributes (5)

| Attribute | Description | Primary Effect | Best For |
|-----------|-------------|----------------|----------|
| Combat Algorithms | AI decision quality | Improves AI combat decisions, strategy | AI Tactician |
| Threat Analysis | Opponent analysis | Analyzes opponent weaknesses, exploits them | AI Tactician |
| Adaptive AI | Learning and adaptation | AI learns from battles, improves over time | AI Tactician |
| Logic Cores | Processing power | Increases AI processing power, complex calculations | AI Tactician |
| Neural Networks | Pattern recognition | Improves pattern recognition, predictive analysis | AI Tactician, late-game |

**Key Insight**: AI attributes are specialized for AI Tactician archetype. Minimal benefit for other archetypes unless using AI Training Academy.

---

### Appendix B: Complete Weapon Catalog

This appendix lists all 23 weapons with costs, damage, cooldown, and bonuses. Weapons are organized by type and tier.

#### Melee Weapons

##### Budget Tier
| Weapon | Cost | Damage | Cooldown | Loadout | Special Bonus | Best For |
|--------|------|--------|----------|---------|---------------|----------|
| Practice Sword | ₡50,000 | 50 | 3 turns | Single | None | Facility Investor (budget option) |

##### Mid Tier
| Weapon | Cost | Damage | Cooldown | Loadout | Special Bonus | Best For |
|--------|------|--------|----------|---------|---------------|----------|
| Power Sword | ₡200,000 | 120 | 2 turns | Single/Weapon+Shield | +10% critical chance | Tank Fortress, Balanced Brawler |
| Plasma Blade | ₡200,000 | 110 | 2 turns | Single/Dual-Wield | +15% attack speed | Speed Demon (melee variant) |

##### Premium Tier
| Weapon | Cost | Damage | Cooldown | Loadout | Special Bonus | Best For |
|--------|------|--------|----------|---------|---------------|----------|
| Battle Axe | ₡300,000 | 180 | 3 turns | Two-Handed | +20% damage vs armor | Melee Specialist |
| Heavy Hammer | ₡350,000 | 200 | 4 turns | Two-Handed | +30% damage, stun chance | Melee Specialist |

##### Prestige-Locked Tier
| Weapon | Cost | Prestige | Damage | Cooldown | Loadout | Special Bonus | Best For |
|--------|------|----------|--------|----------|---------|---------------|----------|
| Quantum Blade | ₡600,000 | 10,000 | 250 | 2 turns | Single/Two-Handed | +30% damage, +20% critical | Prestige Rusher (upgrade) |
| Graviton Hammer | ₡800,000 | 20,000 | 350 | 4 turns | Two-Handed | +50% damage, gravity well | Melee Specialist (upgrade) |

---

#### Ranged Weapons

##### Budget Tier
| Weapon | Cost | Damage | Cooldown | Loadout | Special Bonus | Best For |
|--------|------|--------|----------|---------|---------------|----------|
| Machine Gun | ₡150,000 | 80 | 1 turn | Single/Dual-Wield | +25% attack speed | Speed Demon, Balanced Brawler |

##### Mid Tier
| Weapon | Cost | Damage | Cooldown | Loadout | Special Bonus | Best For |
|--------|------|--------|----------|---------|---------------|----------|
| Plasma Rifle | ₡250,000 | 130 | 2 turns | Single | +15% penetration | Balanced Brawler, AI Tactician |

##### Premium Tier
| Weapon | Cost | Damage | Cooldown | Loadout | Special Bonus | Best For |
|--------|------|--------|----------|---------|---------------|----------|
| Sniper Rifle | ₡300,000 | 160 | 3 turns | Two-Handed | +30% critical chance | Ranged Sniper |
| Railgun | ₡350,000 | 190 | 3 turns | Two-Handed | +40% penetration | Glass Cannon, Ranged Sniper |
| Plasma Cannon | ₡400,000 | 210 | 3 turns | Two-Handed | +25% damage, energy-based | Glass Cannon |

##### Prestige-Locked Tier
| Weapon | Cost | Prestige | Damage | Cooldown | Loadout | Special Bonus | Best For |
|--------|------|----------|--------|----------|---------|---------------|----------|
| Fusion Cannon | ₡700,000 | 15,000 | 320 | 3 turns | Two-Handed | +40% damage, fusion reaction | Glass Cannon (upgrade) |

---

#### Shield Weapons

##### Premium Tier
| Weapon | Cost | Damage | Cooldown | Loadout | Special Bonus | Best For |
|--------|------|--------|----------|---------|---------------|----------|
| Combat Shield | ₡300,000 | 0 (defense) | N/A | Weapon+Shield | +50 shield HP, +20% defense | Tank Fortress (required) |

**Note**: Combat Shield is required for weapon+shield loadout. It provides no direct damage but adds shield HP and defense bonus.

---

### Appendix C: Complete Facility List

This appendix lists all 14 facilities with costs, benefits, operating costs, and recommendations.

#### Economic Facilities

| Facility | Level 1 Cost | Operating Cost (Daily) | Benefit | ROI Timeline | Best For |
|----------|--------------|------------------------|---------|--------------|----------|
| Income Generator | ₡800,000 | ₡1,000 | Passive income (prestige-dependent) | 18 weeks at 5,000 prestige | Facility Investor, late-game (Month 6+) |
| Repair Bay | ₡200,000 | ₡1,000 | 5% repair discount | Never (early), 30 weeks (multi-robot) | Multi-robot stables, Month 6+ |
| Training Facility | ₡300,000 | ₡1,500 | 5% attribute upgrade discount | 40 weeks (early), 20 weeks (late) | Late-game (Month 6+), high-level upgrades |
| Weapons Workshop | ₡250,000 | ₡1,000 | 5% weapon purchase discount | Never (weapons are one-time) | Rarely recommended |

---

#### Capacity Facilities

| Facility | Level 1 Cost | Operating Cost (Daily) | Benefit | When to Buy |
|----------|--------------|------------------------|---------|-------------|
| Roster Expansion | ₡300,000 | ₡500 per extra robot | Allows owning 2+ robots | When you have ₡1.5M+ for full 2-robot setup |
| Storage Facility | ₡150,000 | ₡500 | 10 weapon capacity (default 5) | When you own 6+ weapons |

---

#### Training Academies

| Facility | Level 1 Cost | Operating Cost (Daily) | Benefit | Prestige Required | Best For |
|----------|--------------|------------------------|---------|-------------------|----------|
| Combat Training Academy | ₡400,000 | ₡2,000 | +10% Combat attribute effectiveness | 3,000 | Late-game (Month 9+), offensive builds |
| Defense Training Academy | ₡400,000 | ₡2,000 | +10% Defense attribute effectiveness | 3,000 | Late-game (Month 9+), defensive builds |
| Mobility Training Academy | ₡400,000 | ₡2,000 | +10% Mobility attribute effectiveness | 3,000 | Late-game (Month 9+), speed builds |
| AI Training Academy | ₡500,000 | ₡2,500 | +15% AI attribute effectiveness | 5,000 | AI Tactician archetype, 5,000+ prestige |

---

#### Specialized Facilities

| Facility | Level 1 Cost | Operating Cost (Daily) | Benefit | Prestige Required | Best For |
|----------|--------------|------------------------|---------|-------------------|----------|
| Booking Office | ₡400,000 | ₡2,000 | Tournament access (bonus prestige) | 2,000 | Prestige Rusher archetype, Gold+ league |
| Medical Bay | ₡350,000 | ₡1,500 | Faster robot recovery, condition improvement | 2,000 | Multi-robot stables, high battle frequency |
| Research Lab | ₡600,000 | ₡3,000 | Unlock experimental upgrades | 8,000 | Late-game (Month 12+), experimental builds |
| Broadcasting Studio | ₡500,000 | ₡2,500 | Streaming revenue (fame-dependent) | 5,000 | High-fame robots, late-game (Month 9+) |

---

### Appendix D: Formula Reference

This appendix lists all key formulas used in the game for calculations.

#### Attribute Upgrade Cost

```
Cost to upgrade from level N to level N+1 = (N + 1) × ₡1,500

Total cost to upgrade from level 1 to level N:
  Σ((i + 1) × ₡1,500) for i = 1 to N-1

Example (Level 1 → 10):
  (2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 + 11) × ₡1,500 = 54 × ₡1,500 = ₡81,000
```

**With Training Facility Discount**:
```
Cost with discount = Base Cost × (1 - Discount %)
Level 1 discount: 5% → Cost × 0.95
Level 5 discount: 25% → Cost × 0.75
Level 10 discount: 50% → Cost × 0.50
```

---

#### Repair Cost

```
Base Repair Cost = (Total Attributes × 100) × Damage %

Final Repair Cost = Base Repair Cost × Condition Multiplier

Condition Multipliers:
  - Pristine (100%): 1.0×
  - Good (80-99%): 1.1×
  - Fair (60-79%): 1.2×
  - Poor (40-59%): 1.3×
  - Critical (0-39%): 1.5×

Example (200 attributes, 60% damage, Poor condition):
  Base: 200 × 100 × 0.60 = ₡12,000
  Final: ₡12,000 × 1.3 = ₡15,600
```

**With Repair Bay Discount**:
```
Cost with discount = Base Cost × (1 - Discount %)
Level 1 discount: 5% → Cost × 0.95
Level 5 discount: 25% → Cost × 0.75
Level 10 discount: 50% → Cost × 0.50
```

---

#### Weekly Income

```
Weekly Battle Income = (Battles × Win Rate × Win Reward) + (Battles × Participation Reward)

Win Rewards by League:
  - Bronze: ₡5,000-₡10,000 (avg ₡7,500)
  - Silver: ₡10,000-₡20,000 (avg ₡15,000)
  - Gold: ₡20,000-₡40,000 (avg ₡30,000)
  - Platinum: ₡40,000-₡80,000 (avg ₡60,000)
  - Diamond: ₡80,000-₡150,000 (avg ₡115,000)
  - Champion: ₡150,000-₡300,000 (avg ₡225,000)

Participation Rewards by League:
  - Bronze: ₡1,500
  - Silver: ₡3,000
  - Gold: ₡6,000
  - Platinum: ₡12,000
  - Diamond: ₡24,000
  - Champion: ₡45,000

Example (Gold league, 7 battles, 50% win rate):
  Win income: 7 × 0.5 × ₡30,000 = ₡105,000
  Participation income: 7 × ₡6,000 = ₡42,000
  Total: ₡147,000/week
```

---

#### Break-Even Win Rate

```
Break-Even Win Rate = (Weekly Operating Costs / Win Reward) / Battles per Week

Example (Gold league, ₡20,000 weekly costs, 7 battles):
  Required wins: ₡20,000 / ₡30,000 = 0.67 wins/week
  Break-even win rate: 0.67 / 7 = 9.5%
```

---

#### Facility ROI

```
Payback Period (weeks) = Purchase Cost / (Weekly Savings - Weekly Operating Cost)

Example (Training Facility Level 1, ₡100K/week upgrades):
  Purchase cost: ₡300,000
  Weekly savings: ₡100,000 × 0.05 = ₡5,000
  Operating cost: ₡10,500/week
  Net savings: ₡5,000 - ₡10,500 = -₡5,500/week (NEGATIVE!)
  Payback: Never (facility costs more than it saves)
```

---

#### Prestige Accumulation

```
Prestige per Win by League:
  - Bronze: 5 prestige
  - Silver: 10 prestige
  - Gold: 20 prestige
  - Platinum: 30 prestige
  - Diamond: 50 prestige
  - Champion: 75 prestige

Achievement Prestige: 100-500 per achievement
Tournament Prestige: 200-1,000 per tournament
Milestone Prestige: 500-2,000 per milestone

Example (Path to 5,000 prestige):
  Bronze wins: 20 × 5 = 100 prestige
  Silver wins: 30 × 10 = 300 prestige
  Gold wins: 50 × 20 = 1,000 prestige
  Platinum wins: 40 × 30 = 1,200 prestige
  Achievements: 10 × 300 = 3,000 prestige
  Tournaments: 2 × 500 = 1,000 prestige
  Total: 6,600 prestige (goal reached!)
```

---

#### Passive Income (Income Generator)

```
Passive Income = Base Income × Prestige Multiplier

Base Income (Level 1): ₡10,000/week

Prestige Multipliers:
  - 0-999 prestige: 1.0× (₡10,000/week)
  - 1,000-4,999 prestige: 2.0× (₡20,000/week)
  - 5,000-9,999 prestige: 5.0× (₡50,000/week)
  - 10,000-19,999 prestige: 10.0× (₡100,000/week)
  - 20,000+ prestige: 20.0× (₡200,000/week)

Example (5,000 prestige):
  Passive income: ₡10,000 × 5.0 = ₡50,000/week
  Operating cost: ₡7,000/week
  Net income: ₡43,000/week
```

---

### Appendix E: Glossary

This appendix defines all key terms used in the guide.

**Archetype**: A distinct playstyle or strategic approach to the game. This guide identifies 10 archetypes (Tank Fortress, Glass Cannon, etc.).

**Attribute**: One of 23 robot stats that can be upgraded (Combat Power, Hull Integrity, etc.). Attributes define robot capabilities.

**Balance**: Your current credit balance. Starting balance is ₡3,000,000.

**Bankruptcy**: When your balance reaches ₡0 and you cannot afford repairs or operations. Game over scenario.

**Battle Stance**: Your robot's combat approach (Offensive, Defensive, Balanced). Affects damage dealt and taken.

**Break-Even Win Rate**: The minimum win rate needed to cover operating costs. Lower is better (more forgiving).

**Buffer**: Reserve credits kept for emergencies (repairs, unexpected costs). Typically ₡50,000-₡200,000.

**Condition Multiplier**: Multiplier applied to repair costs based on robot condition (Pristine 1.0×, Critical 1.5×).

**Credits (₡)**: In-game currency. Starting budget is ₡3,000,000.

**Dual-Wield**: Loadout type using two one-handed weapons. Provides +20% attack speed bonus.

**Facility**: Infrastructure that provides discounts, unlocks, or passive income. Examples: Repair Bay, Training Facility, Income Generator.

**Fame**: Robot-level reputation that affects streaming revenue. Earned through victories and achievements.

**Glass Cannon**: High offense, low defense build. High damage output but vulnerable to counter-attacks.

**Hybrid Strategy**: Combining elements from multiple archetypes or transitioning between strategies.

**Hydraulic Systems**: Attribute that dramatically increases melee weapon damage. Core of Melee Specialist archetype.

**Income Generator**: Facility that provides passive income based on prestige level. Expensive (₡800K) but compounds over time.

**League**: Competitive tier (Bronze, Silver, Gold, Platinum, Diamond, Champion). Higher leagues provide higher income.

**Loadout**: Weapon configuration (Single, Weapon+Shield, Two-Handed, Dual-Wield). Each provides different bonuses.

**Operating Costs**: Recurring daily/weekly costs for facilities and roster slots. Must be covered by income.

**Participation Reward**: Credits earned for participating in a battle, regardless of outcome. League-dependent (₡1,500-₡45,000).

**Passive Income**: Income earned without battling, provided by Income Generator facility. Prestige-dependent.

**Prestige**: Stable-level reputation that unlocks content and provides bonuses. Earned through wins, achievements, and tournaments.

**Repair Bay**: Facility that provides discount on repair costs. Level 1 provides 5% discount.

**Reserve Buffer**: See Buffer.

**Robot**: Combat unit that players purchase, upgrade, and battle with. Base cost is ₡500,000.

**ROI (Return on Investment)**: How long it takes for an investment to pay for itself. Calculated as: Purchase Cost / Net Weekly Savings.

**Roster Expansion**: Facility that allows owning multiple robots. Level 1 allows 2 robots (₡300K + ₡500/day per extra robot).

**Single Weapon**: Loadout type using one weapon. Provides +10% to all attributes bonus.

**Speed Demon**: High mobility, high DPS build. Uses dual-wield loadout and focuses on Attack Speed and Servo Motors.

**Starting Budget**: ₡3,000,000 credits each player begins with.

**Storage Facility**: Facility that increases weapon storage capacity. Default capacity is 5 weapons, Level 1 provides 10 capacity.

**Tank Fortress**: High defense, high survivability build. Uses weapon+shield loadout and focuses on Hull Integrity and Armor Plating.

**Targeting Systems**: Attribute that increases accuracy and critical hit chance. Core of Ranged Sniper archetype.

**Training Facility**: Facility that provides discount on attribute upgrades. Level 1 provides 5% discount.

**Two-Handed**: Loadout type using one two-handed weapon. Provides +25-30% damage bonus.

**Weapon**: Equipment purchased and equipped to robots for combat bonuses. Costs range from ₡50,000 to ₡800,000.

**Weapon+Shield**: Loadout type using one weapon and one shield. Provides +20% defense and counter-attack damage bonus.

**Win Rate**: Percentage of battles won. 50% is balanced matchmaking baseline.

**Yield Threshold**: Damage percentage at which you yield (surrender) to minimize repair costs. Higher threshold = more conservative.

---

---

## Conclusion

Congratulations on completing the Player Archetypes and Starting Strategies Guide! You now have a comprehensive understanding of Armoured Souls' economic systems, strategic options, and progression paths.

### Key Takeaways

1. **Choose Your Archetype Wisely**: Your starting archetype shapes your first 3-6 months of gameplay. Choose based on your personality, risk tolerance, and goals.

2. **League Advancement is Critical**: Income scales dramatically with league tier. Bronze earns ₡36K/week, Gold earns ₡147K/week at 50% win rate. Advance leagues as quickly as possible.

3. **Facilities Have Poor Early ROI**: Most facilities (Training Facility, Repair Bay, Income Generator) have negative ROI in early game. Wait until mid-late game (Month 6+) when you have surplus credits and high usage.

4. **Attributes > Weapons > Facilities (Early Game)**: Prioritize attribute upgrades over additional weapons or facilities. Attributes provide immediate, permanent power gains.

5. **Reserve Buffer is Essential**: Keep ₡50-200K reserve depending on archetype. Glass Cannon needs ₡100K+, Tank Fortress can survive with ₡50K.

6. **Yield Strategically**: Yielding at 30-50% damage saves massive repair costs. Don't fight to the death - preserve your robot's condition.

7. **Experiment Mid-Game, Not Early**: Wait until Month 3-4 and ₡500K+ balance before experimenting with new weapons or loadout types.

8. **Transitions Require Planning**: Archetype transitions cost ₡100K-1.5M and take 2-12 weeks. Ensure financial stability before transitioning.

9. **Risk Decreases with League Advancement**: Most archetypes become low-risk in Gold+ league due to high income. Bronze/Silver is where risk is highest.

10. **Patience Pays Off**: Long-term strategies (Facility Investor, Prestige Rusher) require patience but provide excellent late-game returns.

### Your Next Steps

1. **Choose Your Archetype**: Review the Archetype Comparison Table and select the playstyle that matches your preferences.

2. **Follow the Budget Allocation**: Spend your ₡3M starting budget according to your archetype's plan. Don't deviate significantly in early game.

3. **Execute the Early Game Strategy**: Follow the Days 1-30 guidance for your archetype. Focus on league advancement and sustainable economics.

4. **Monitor Your Progress**: Track your win rate, weekly income, repair costs, and balance. Adjust if you're deviating from projections.

5. **Adapt as Needed**: Use the Hybrid Strategies section to transition or combine archetypes as your stable grows.

6. **Reference the Appendices**: Use the Quick Reference and Appendices for formulas, costs, and calculations.

### Final Advice

**For New Players**: Start with Balanced Brawler or Tank Fortress. These archetypes are forgiving, sustainable, and provide excellent learning platforms. Avoid Glass Cannon and Prestige Rusher until you understand game mechanics.

**For Experienced Players**: Experiment with specialized archetypes (Melee Specialist, Ranged Sniper, AI Tactician) or high-risk strategies (Glass Cannon, Prestige Rusher). Use hybrid strategies to optimize your stable.

**For Economic Strategists**: Facility Investor is your archetype. Accept the slow start and trust the long-term compounding. You'll dominate in months 6-12.

**For Competitive Players**: Prestige Rusher optimizes for rapid progression and content unlocks. Maintain 55%+ win rate and advance leagues aggressively.

### Community and Updates

This guide is based on current game mechanics and economy balance. If the game receives updates that change costs, formulas, or mechanics, refer to the official documentation for the latest information.

**Good luck, and may your robots dominate the arena!**

---

*Guide Version: 1.0*  
*Last Updated: 2024*  
*Based on: Armoured Souls Economy System (₡3M Starting Budget)*

