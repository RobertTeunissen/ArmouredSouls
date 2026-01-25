# Stable System

**Last Updated**: January 25, 2026  
**Status**: Design Document

## Overview

A **Stable** is the player's collection and management system for their robots. Each user has one stable where they manage Credits, Prestige, upgrades, and their robot roster.

---

## Stable-Level Attributes

### Core Resources

**Credits (₡)** - Primary currency
- Starting balance: ₡1,000,000
- Used for: Robot purchases, upgrades, weapons, repairs, stable upgrades
- Earned from: Battles, tournaments, achievements

**Prestige** - Stable reputation and ranking
- Starting prestige: 0
- Separate from individual robot fame
- Represents overall stable success and history
- Used to unlock: Special tournaments, exclusive equipment, cosmetic options
- Earned from: Tournament wins, high rankings, achievements, robot milestones

**League Tier** - Current competitive division
- Starting league: Bronze
- Progression: Bronze → Silver → Gold → Platinum → Diamond → Champion
- Affects: Battle rewards, matchmaking, tournament access
- Promotion/demotion based on ELO and win rate

--> Leagues are for robots and not for Stables. Move this to the relevant documentation about robots. 

### Stable Statistics

**Total Battles** - Lifetime battle count across all robots
**Win Rate** - Overall stable win percentage
**Highest ELO** - Best ELO achieved by any robot
**Championship Titles** - Tournament victories
**Active Robots** - Current roster size

--> For everything you need to decide whether to capture the information / statistics on a stable level or a robot level and then aggregate the view on the stable. This decision might also have impact on the overall statistics / rankings. 

---

## Stable Upgrades

Players can invest Credits in stable-wide upgrades that benefit all robots.

### Facility Upgrades

**1. Repair Bay**
- **Level 1** (₡200,000): Basic repairs, 10% discount on repair costs
- **Level 2** (₡500,000): Advanced repairs, 20% discount, +5% post-battle HP recovery
- **Level 3** (₡1,000,000): Elite repairs, 30% discount, +10% post-battle HP recovery
- **Max Level** (₡2,500,000): Master repairs, 40% discount, +15% post-battle HP recovery, automatic minor repairs

**2. Training Facility**
- **Level 1** (₡300,000): Reduce attribute upgrade costs by 5%
- **Level 2** (₡750,000): Reduce attribute upgrade costs by 10%, +2% EXP gain
- **Level 3** (₡1,500,000): Reduce attribute upgrade costs by 15%, +5% EXP gain
- **Max Level** (₡3,000,000): Reduce attribute upgrade costs by 20%, +10% EXP gain, unlock special training programs

--> We have never discussed EXP. What are you talking about? 

**3. Weapons Workshop**
- **Level 1** (₡250,000): 10% discount on weapon purchases
- **Level 2** (₡600,000): 15% discount, unlock weapon modifications
- **Level 3** (₡1,200,000): 20% discount, unlock custom weapon design
- **Max Level** (₡2,000,000): 25% discount, unlock legendary weapon crafting

**4. Research Lab**
- **Level 1** (₡400,000): Unlock advanced battle analytics
- **Level 2** (₡1,000,000): Unlock loadout presets (save 3 configurations per robot)
- **Level 3** (₡2,000,000): Unlock AI behavior customization
- **Max Level** (₡4,000,000): Unlock experimental technology, robot cloning

**5. Medical Bay**
- **Level 1** (₡350,000): Reduce critical damage repair costs by 15%
- **Level 2** (₡800,000): Reduce critical damage repair costs by 30%, faster recovery
- **Level 3** (₡1,600,000): Reduce critical damage repair costs by 50%, prevent permanent damage
- **Max Level** (₡3,500,000): Eliminate critical damage penalties, emergency field repairs in battle

--> New Facility Upgrade: upgrade to advance a certain (group of) robot attributes to a certain level? So an upgrade to be able to advance all your robots Combat Systems to 10+, 20+ or whatever. 
--> New Facility Upgrade: A new stable can hold 1 robot. Create an upgrade system for more robots. 
--> New Facility Upgrade: add several upgrades to create additional streams of income like merchandising, live streaming views (people watching the matches), etc
--> I would like to have more levels implemented. Upgrade to 10 for each facility upgrade, we'll balance the costs later.
--> Certain upgrades require a prestige amount before they can be unlocked. Prestige is never spent. 

### Roster Management

**Robot Slots**
- **Starting slots**: 2 (can build 2 robots initially with ₡1M)
- **Slot upgrades**: ₡300,000 per additional slot
- **Maximum slots**: 10 robots per stable

--> I just decided to make this a facility upgrade. Incorporate this. 

**Storage**
- **Weapon Storage**: Store weapons not currently equipped
  - Starting: 10 weapons
  - Upgrades: +10 slots for ₡100,000
  - Maximum: 50 weapons
- **Loadout Presets**: Save robot configurations
  - Starting: 1 preset per robot
  - Upgrade: +2 presets for ₡200,000 (from Research Lab Level 2)
  - Maximum: 5 presets per robot
 
--> Storage will also be a facility (upgrade).

### Coaching & Support

**Coaches** - Hire AI coaches to provide bonuses
- **Offensive Coach** (₡500,000): +3% damage for all robots
- **Defensive Coach** (₡500,000): +3% defense for all robots
- **Tactical Coach** (₡500,000): +5% positioning bonuses for all robots
- **Team Coach** (₡750,000): +5% team coordination bonuses (arena battles)

Only one coach can be active at a time. Switching coaches costs ₡100,000.

--> Coaches will also be a facility (upgrade).

---

## Prestige System

### Earning Prestige

**Battle Performance:**
- Win in Bronze league: +5 prestige
- Win in Silver league: +10 prestige
- Win in Gold league: +20 prestige
- Win in Platinum league: +30 prestige
- Win in Diamond league: +50 prestige
- Win in Champion league: +75 prestige

**Tournament Performance:**
- Local tournament win: +100 prestige
- Regional tournament win: +250 prestige
- National tournament win: +500 prestige
- International tournament win: +1,000 prestige
- World Championship win: +2,500 prestige

**Milestones:**
- First robot to ELO 1500: +50 prestige
- First robot to ELO 1800: +100 prestige
- First robot to ELO 2000: +200 prestige
- 100 total wins: +50 prestige
- 500 total wins: +250 prestige
- 1,000 total wins: +500 prestige

### Prestige Benefits

**Unlocks:**
- **1,000 Prestige**: Access to Silver league tournaments
- **2,500 Prestige**: Access to Gold league tournaments, custom paint jobs
- **5,000 Prestige**: Access to Platinum tournaments, exclusive weapon skins
- **10,000 Prestige**: Access to Diamond tournaments, legendary frame designs
- **25,000 Prestige**: Access to Champion tournaments, hall of fame listing
- **50,000 Prestige**: Access to World Championship, custom arena design

--> Should also unlock certain facility upgrades. 
--> Change this in a facility upgrade like "Booking Office"

**Passive Bonuses:**
- **5,000+ Prestige**: +5% Credits from all battles
- **10,000+ Prestige**: +10% Credits from all battles, +1 free repair per day
- **25,000+ Prestige**: +15% Credits from all battles, +2 free repairs per day, VIP matchmaking

--> Change this to a system where we present the user an income sheet daily, with all the earnings / revenue streams and the costs of operations. 
--> Higher prestige (stable level) and higher fame (robot level) will affect certain revenue streams (like merchandise and live streaming income).
--> Facilities will cost money to operate, as do repairs on robots.

---

## Stable Management Interface

### Dashboard View
- Total Credits
- Current Prestige & Prestige Rank
- Active Robots (with HP status, ELO)
- Recent Battle Results
- Facility Upgrade Status (per facility)
- Current League Tier (per robot)

### Robots Tab
- List all robots with:
  - Name, thumbnail
  - Current HP / Max HP
  - ELO rating
  - Win/Loss record
  - Battle readiness status
  - Quick repair button
  - Equip/modify button
  - Upgrade button

### Facilities Tab
- View all stable upgrades
- Purchase/upgrade facilities
- View bonuses and benefits
- Manage coaches

### Workshop Tab
- View owned weapons
- Purchase new weapons
- Design custom weapons (if unlocked)
- Modify weapons (if unlocked)

### Statistics Tab
- Overall stable statistics
- Individual robot statistics
- Battle history
- Achievement progress
- Prestige milestones

---

## Progression Strategy

### Early Game (₡1M starting budget)
1. Build 1-2 robots with basic weapons
2. Focus on battles to earn Credits
3. Save for Repair Bay Level 1 (reduces long-term costs)
4. Gradually upgrade robot attributes

### Mid Game (₡5M+ total earned)
1. Upgrade key facilities (Repair Bay, Training Facility)
2. Expand robot roster to 4-5 robots
3. Specialize robots for different strategies
4. Invest in better weapons
5. Participate in tournaments

### Late Game (₡20M+ total earned)
1. Max out all facilities
2. Build specialized arena teams
3. Invest in prestige-locked content
4. Compete in high-tier tournaments
5. Build legendary custom weapons

---

## Economic Balance

**Starting Phase:**
- ₡1,000,000 starting Credits
- Can afford: 1 robot (₡500K) + medium weapon (₡200K) + some upgrades (₡300K)
- Or: 2 robots (₡1M) with no weapons (very weak, but viable strategy)

--> 2 robots at the start is not feasbile anymore with the proposed facility changes. Either we make the robots cheaper or change the starting money. 

**Stable Investment Payoff:**
- Repair Bay Level 1: Pays for itself after ~40 battles
- Training Facility Level 1: Pays for itself after upgrading ~400 attribute levels
- Weapons Workshop Level 1: Pays for itself after buying ~10 weapons

**Prestige Unlocks:**
- Encourage long-term play
- Provide goals beyond Credits
- Create aspirational content
- Reward consistent performance

---

## Future Enhancements (Post-Phase 1)

- **Stable vs Stable Wars**: Team battles between stables
- **Alliances**: Form alliances with other stables for shared bonuses
- **Stable Customization**: Custom logos, colors, banners
- **Staff Management**: Hire technicians, analysts, scouts
- **Sponsorships**: Stable sponsors provide Credits/bonuses in exchange for performance
- **Stable Rankings**: Global leaderboards for stables
- **Legacy System**: Retired robot bonuses, historical achievements
- **Training Programs**: Long-term attribute development options

--> Don't put this here, move to ROADMAP.md in the ideas section. This is a design document, not a phasing or implementation document. 

---

**This stable system provides:**
- ✅ Clear resource management (Credits, Prestige)
- ✅ Meaningful long-term investments (facilities)
- ✅ Progression goals (prestige milestones)
- ✅ Strategic choices (which facilities to upgrade first)
- ✅ Roster management (robot slots, weapons storage)
- ✅ Economic depth (upgrade payoff calculations)
- ✅ Aspirational content (high-prestige unlocks)
