# Product Requirements Document: New Player Onboarding System

**Last Updated**: March 29, 2026  
**Status**: ✅ IMPLEMENTED (Streamlined to 5 display steps)  
**Owner**: Robert Teunissen  
**Epic**: New Player Onboarding

> **Note**: The original 9-step tutorial has been streamlined to 5 display steps with automated purchases. The backend still uses steps 1-9 internally. See `docs/implementation_notes/ONBOARDING_IMPLEMENTATION_NOTES.md` for the current implementation details.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Background & Context](#background--context)
3. [Goals & Objectives](#goals--objectives)
4. [9-Step Tutorial Flow](#9-step-tutorial-flow)
5. [Roster Strategies](#roster-strategies)
6. [Budget System](#budget-system)
7. [Facility Education](#facility-education)
8. [Reset Functionality](#reset-functionality)
9. [Skip and Resume](#skip-and-resume)
10. [Database Schema](#database-schema)
11. [API Endpoints](#api-endpoints)
12. [Frontend Components](#frontend-components)
13. [Accessibility](#accessibility)
14. [Analytics](#analytics)
15. [Performance](#performance)
16. [Testing Requirements](#testing-requirements)
17. [Dependencies & Risks](#dependencies--risks)
18. [Success Metrics](#success-metrics)

---

## Executive Summary

The New Player Onboarding System is a 9-step interactive tutorial that guides new players through the strategic decisions required to build and manage a competitive robot stable in Armoured Souls. Rather than a passive walkthrough, the onboarding teaches players to think strategically about roster composition, budget allocation, facility investment, and combat loadouts.

**Target Audience**: New players who have just registered an account and have not yet created a robot or purchased any facilities.

**Key Goals**:
- Teach strategic decision-making (not just UI mechanics)
- Reduce early player churn by providing clear direction
- Help players understand the fundamental question: "How many robots should I build?"
- Guide players through their first robot creation, weapon purchase, and battle preparation
- Provide personalized recommendations based on chosen strategy

**Success Criteria**: 70%+ of new players complete the full tutorial, 50%+ retention at day 7 for onboarded players, and measurable reduction in "lost" players who register but never create a robot.

---

## Background & Context

### Current State

New players currently receive no guided introduction to the game. After registration, they land on the dashboard with ₡3,000,000 in credits and no direction on how to spend them. This leads to:

- Players spending all credits on a single expensive weapon without a robot to equip it on
- Players buying facilities in suboptimal order (e.g., Streaming Studio before having any robots)
- Players creating 3+ robots but not having enough credits to equip any of them
- High early churn (players register, feel overwhelmed, and never return)

### Design References

- **[PRD_ECONOMY_SYSTEM.md](PRD_ECONOMY_SYSTEM.md)** - Starting budget, facility costs, revenue streams
- **[PRD_WEAPONS_LOADOUT.md](PRD_WEAPONS_LOADOUT.md)** - Weapon types, loadout configurations, pricing
- **[PRD_ROBOT_ATTRIBUTES.md](PRD_ROBOT_ATTRIBUTES.md)** - Robot creation costs, attribute upgrades
- **[STABLE_SYSTEM.md](../STABLE_SYSTEM.md)** - Facility types, costs, and benefits
- **[PRD_FAME_SYSTEM.md](PRD_FAME_SYSTEM.md)** - Fame and prestige progression
- **[COMBAT_FORMULAS.md](COMBAT_FORMULAS.md)** - Battle mechanics and damage calculations

---

## Goals & Objectives

### Primary Goals

1. **Teach Strategic Thinking**: Help players understand that Armoured Souls is about strategic resource allocation, not just clicking buttons
2. **Reduce Early Churn**: Provide clear direction so new players don't feel lost or overwhelmed
3. **Establish Viable Stables**: Ensure players end the tutorial with at least one battle-ready robot
4. **Introduce Core Systems**: Familiarize players with facilities, robots, weapons, loadouts, and battles

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Tutorial completion rate | ≥ 70% | Players who reach Step 9 / Players who start Step 1 |
| Day-7 retention (onboarded) | ≥ 50% | Onboarded players active on day 7 |
| Day-7 retention (skipped) | Baseline | Comparison group for skip vs complete |
| First battle within 24h | ≥ 80% | Onboarded players who fight within 24h of completing tutorial |
| Average time to complete | 5-10 min | Time from Step 1 start to Step 9 completion |
| Strategy distribution | Balanced | No single strategy chosen by >60% of players |

### Non-Goals

- ❌ Teaching advanced mechanics (league promotion, tournaments, prestige optimization)
- ❌ Replacing the existing game documentation
- ❌ Forcing players to follow a specific strategy (recommendations only)
- ❌ Gating game access behind tutorial completion (skip is always available)

---

## 9-Step Tutorial Flow

The onboarding consists of 9 sequential steps. Each step teaches a strategic concept and may involve the player making a choice or performing an action. Players can navigate back to previous steps but cannot skip ahead.

### Step 1: Welcome and Strategic Overview

**Purpose**: Introduce the game and frame the core strategic question.

**Content**:
- Welcome message with game theme (robot combat strategy)
- Brief explanation: "You manage a stable of combat robots. Your job is to build, equip, and train robots to fight in leagues."
- Introduce the starting budget: ₡3,000,000
- Frame the fundamental question: **"How many robots should I build?"**
- Explain that this single decision shapes the entire early-game strategy

**Player Action**: Read and continue (no choice required).

**UI Elements**:
- Animated welcome banner with game logo
- Starting budget displayed prominently: "Your Starting Budget: ₡3,000,000"
- "Next" button to proceed

---

### Step 2: Roster Strategy Selection

**Purpose**: Help the player choose a roster composition strategy.

**Content**:
- Present three roster strategies with clear trade-offs
- Each strategy shows: number of robots, power level, battles per day, management complexity
- Visual comparison cards for each strategy
- Recommendation badge on "2 Average Robots" for new players

**Player Action**: Select one of three roster strategies.

**Strategy Options**:

| Strategy | Robots | Power | Battles/Day | Complexity | Recommended |
|----------|--------|-------|-------------|------------|-------------|
| 1 Mighty Robot | 1 | ★★★★★ | ~2.2 | Low | No |
| 2 Average Robots | 2 | ★★★☆☆ | ~3.6 | Medium | ✅ Yes |
| 3 Flimsy Robots | 3 | ★★☆☆☆ | ~5.0 | High | No |

**Detailed Strategy Descriptions**:

**1 Mighty Robot**:
- All resources focused on a single powerful robot
- Fewer battles per day but higher win rate
- Simpler management (one robot to upgrade and equip)
- Higher risk: if your robot loses, you have no backup
- Best for: Players who prefer quality over quantity

**2 Average Robots** (Recommended):
- Balanced resource distribution across two robots
- Moderate battle frequency and win rate
- Good learning experience (compare strategies between robots)
- Lower risk: one robot can compensate for the other
- Best for: New players learning the game

**3 Flimsy Robots**:
- Resources spread thin across three robots
- Most battles per day but lower individual power
- Complex management (three robots to upgrade, equip, and repair)
- Highest repair costs (more battles = more damage)
- Best for: Experienced players who enjoy optimization

**UI Elements**:
- Three strategy cards with visual robot silhouettes
- Hover/tap for detailed breakdown
- "Recommended for new players" badge on 2-robot strategy
- Selection highlights chosen card
- "Confirm Strategy" button

---

### Step 3: Facility Timing and Priority Education

**Purpose**: Teach players which facilities to buy first and why order matters.

**Content**:
- Explain that facilities provide ongoing benefits but cost credits to purchase and operate
- Present facility priority tiers based on ROI and strategic value
- Show how facility discounts compound (e.g., Weapons Workshop discount saves more the more weapons you buy)
- Explain operating costs and why buying too many facilities early can drain your budget

**Facility Priority Tiers**:

**Tier 1 — Mandatory First** (Buy before creating robots):
| Facility | Cost | Why First |
|----------|------|-----------|
| Repair Bay (Level 1) | ₡75,000 | Reduces repair costs for all robots. Every battle causes damage. Without this, repair costs eat your budget. |
| Training Facility (Level 1) | ₡75,000 | 10% discount on all attribute upgrades. Pays for itself quickly with regular upgrades. |

**Tier 2 — Recommended Early** (Buy within first few cycles):
| Facility | Cost | Why Early |
|----------|------|-----------|
| Weapons Workshop (Level 1) | ₡75,000 | 10% discount on weapon purchases. Buy before your first weapon to save immediately. |
| Merchandising Hub (Level 1) | ₡75,000 | Generates passive income from prestige. Start earning early. |
| Streaming Studio (Level 1) | ₡50,000 | Doubles streaming revenue per battle. More battles = more value. |

**Tier 3 — Strategy-Dependent** (Buy based on your roster strategy):
| Facility | Cost | When |
|----------|------|------|
| Roster Expansion | ₡100,000 | Only if you plan to add more robots beyond your initial strategy |
| Medical Bay (Level 1) | ₡100,000 | If your robots frequently reach 0 HP (reduces critical damage repair multiplier) |
| Storage Facility (Level 1) | ₡75,000 | When you own more than 5 weapons |

**Tier 4 — Optional/Later** (Buy when profitable):
| Facility | Cost | Notes |
|----------|------|-------|
| Coaching Staff | ₡150,000 | Expensive operating costs (₡3,000/day when active). Wait until profitable. |
| Combat/Defense/Mobility Academies | ₡100,000 each | Specialized training. Buy after core facilities. |
| AI Training Academy | ₡100,000 | Late-game investment. |
| Booking Office | ₡100,000 | Generates prestige, not credits. Buy when prestige matters. |
| Research Lab | ₡150,000 | Advanced upgrades. Mid-to-late game. |

**Player Action**: Review facility priorities (no purchase required at this step). Information is saved for reference.

**UI Elements**:
- Collapsible tier sections with facility cards
- Each card shows: name, cost, operating cost/day, benefit summary
- ROI indicator (e.g., "Pays for itself in ~15 cycles")
- Strategy-specific highlights based on Step 2 selection
- "I understand, continue" button

---

### Step 4: Budget Allocation Guidance

**Purpose**: Show players how to divide their ₡3,000,000 starting budget across categories.

**Content**:
- Present recommended budget allocation based on chosen roster strategy
- Show visual budget breakdown (pie chart or bar chart)
- Explain the importance of keeping a reserve (for repairs and unexpected costs)
- Warn about common mistakes (spending everything on one category)

**Budget Allocations by Strategy**:

**1 Mighty Robot Strategy**:
| Category | Amount | Percentage | Notes |
|----------|--------|------------|-------|
| Facilities | ₡350,000 | 12% | Tier 1 + Tier 2 essentials |
| Robot | ₡500,000 | 17% | One robot frame |
| Attributes | ₡800,000 | 27% | Heavy investment in upgrades |
| Weapons | ₡550,000 | 18% | One premium weapon + backup |
| Reserve | ₡800,000 | 27% | Repairs, future upgrades |

**2 Average Robots Strategy** (Recommended):
| Category | Amount | Percentage | Notes |
|----------|--------|------------|-------|
| Facilities | ₡350,000 | 12% | Tier 1 + Tier 2 essentials |
| Robots | ₡1,000,000 | 33% | Two robot frames |
| Attributes | ₡500,000 | 17% | Moderate upgrades for both |
| Weapons | ₡500,000 | 17% | Two mid-tier weapons |
| Reserve | ₡650,000 | 22% | Repairs, future upgrades |

**3 Flimsy Robots Strategy**:
| Category | Amount | Percentage | Notes |
|----------|--------|------------|-------|
| Facilities | ₡350,000 | 12% | Tier 1 + Tier 2 essentials |
| Robots | ₡1,500,000 | 50% | Three robot frames |
| Attributes | ₡300,000 | 10% | Minimal upgrades |
| Weapons | ₡350,000 | 12% | Three budget weapons |
| Reserve | ₡500,000 | 17% | Repairs (higher with 3 robots) |

**Budget Warnings**:
- **Yellow Warning** at ₡600,000 remaining: "Your budget is getting low. Consider saving for repairs and operating costs."
- **Red Warning** at ₡200,000 remaining: "Critical: You may not have enough for repairs after your first battles. Consider your spending carefully."

**Player Action**: Review budget allocation (informational step). Budget tracker activates for remaining steps.

**UI Elements**:
- Visual budget breakdown (pie chart or stacked bar)
- Budget tracker sidebar showing remaining credits by category
- Warning thresholds displayed
- Spending recommendations highlighted for chosen strategy
- "Got it, let's start spending" button

---

### Step 5: Robot Creation Guidance

**Purpose**: Guide the player through creating their first robot.

**Content**:
- Explain robot creation cost: ₡500,000 per robot
- Show what a new robot includes (all 23 attributes at level 1, full HP, full shields)
- Guide player through the robot creation form (name input)
- For multi-robot strategies, prompt creation of additional robots after the first
- Update budget tracker after each purchase

**Robot Creation Details**:
- **Cost**: ₡500,000 per robot (bare metal chassis)
- **Starting Attributes**: All 23 attributes at level 1
- **Starting HP**: Full health (based on Hull Integrity attribute)
- **Starting Shields**: Full shields (based on Shield Capacity attribute)
- **No recurring cost**: Owning a robot has no daily operating fee

**Flow by Strategy**:
- **1 Mighty Robot**: Create 1 robot → proceed to Step 6
- **2 Average Robots**: Create 1st robot → prompt for 2nd → proceed to Step 6
- **3 Flimsy Robots**: Create 1st robot → prompt for 2nd → prompt for 3rd → proceed to Step 6

**Player Action**: Create robot(s) using the actual robot creation API. This is a real action, not a simulation.

**UI Elements**:
- Robot creation form embedded in onboarding flow
- Name input with validation (unique per user, 3-50 characters)
- Cost display: "₡500,000 will be deducted from your balance"
- Budget tracker updates in real-time
- For multi-robot strategies: "Create another robot?" prompt after each creation
- Robot preview card showing the newly created robot
- "Continue to Weapons" button (enabled after minimum robots created per strategy)

---

### Step 6: Weapon Type and Loadout Education

**Purpose**: Teach the four weapon types and four loadout configurations.

**Content**:
- Introduce the 4 weapon categories with characteristics
- Explain the 4 loadout types with bonuses and penalties
- Show how weapon type + loadout type creates different combat styles
- Provide strategy-specific recommendations

**Weapon Categories**:

| Category | Weapons | Damage Type | Characteristics |
|----------|---------|-------------|-----------------|
| Energy | 13 weapons | Energy (+20% vs shields) | Precise, consistent damage. Good against shielded opponents. |
| Ballistic | 17 weapons | Kinetic | Variable damage, high penetration. Reliable all-around. |
| Melee | 11 weapons | Impact | High burst damage. Benefits from Hydraulic Systems attribute. |
| Shield | 6 weapons | N/A (defensive) | Defensive bonuses, enables counter-attacks. Offhand only. |

**Loadout Types**:

| Loadout | Equipment | Key Bonuses | Key Penalties | Best For |
|---------|-----------|-------------|---------------|----------|
| Single Weapon | 1 one-handed weapon | +10% Gyro Stabilizers, +5% Servo Motors | None | Balanced builds, flexibility |
| Weapon + Shield | 1 weapon + 1 shield | +20% Shield Capacity, +15% Armor | -15% Attack Speed | Tank builds, defense |
| Two-Handed | 1 two-handed weapon | +10% Combat Power, +20% Critical Systems | -10% Evasion | Glass cannon, burst damage |
| Dual-Wield | 2 one-handed weapons | +30% Attack Speed, +15% Weapon Control | -20% Penetration, -10% Combat Power | Speed builds, sustained DPS |

**Player Action**: Read and understand weapon/loadout system (no purchase at this step).

**UI Elements**:
- Interactive weapon category cards with example weapons
- Loadout type comparison with visual robot diagrams
- "Try different loadouts" interactive preview (shows stat changes)
- Strategy-specific recommendation callout
- "Ready to buy weapons" button

---

### Step 7: Weapon Purchase Guidance

**Purpose**: Guide the player through purchasing their first weapon with budget awareness.

**Content**:
- Show recommended weapons based on chosen strategy and remaining budget
- Highlight budget-friendly options for each weapon category
- Show Weapons Workshop discount if purchased in Step 3 recommendations
- Guide through the actual weapon purchase flow
- Update budget tracker after purchase

**Recommended First Weapons by Budget**:

**Budget Tier (<₡100K)** — Best for 3-robot strategy:
| Weapon | Price | Type | DPS | Notes |
|--------|-------|------|-----|-------|
| Practice Sword | ₡50,000 | Melee | 2.0 | Cheapest melee starter |
| Practice Blaster | ₡50,000 | Ballistic | 2.0 | Cheapest short-range starter |
| Training Rifle | ₡50,000 | Ballistic | 2.0 | Cheapest mid-range starter (two-handed) |
| Training Beam | ₡50,000 | Energy | 2.0 | Cheapest long-range starter (two-handed) |
| Laser Pistol | ₡57,000 | Energy | 2.0 | Energy budget option |
| War Club | ₡84,000 | Melee | 2.0 | Budget two-handed melee |
| Scatter Cannon | ₡84,000 | Ballistic | 2.0 | Budget two-handed short-range |
| Bolt Carbine | ₡93,000 | Ballistic | 2.5 | One-handed mid-range option |
| Beam Pistol | ₡93,000 | Energy | 2.5 | One-handed long-range option |
| Machine Pistol | ₡94,000 | Ballistic | 2.5 | Ranged budget option |

**Mid Tier (₡100K–₡250K)** — Best for 2-robot strategy:
| Weapon | Price | Type | DPS | Notes |
|--------|-------|------|-----|-------|
| Machine Gun | ₡107,000 | Ballistic | 2.5 | Reliable short-range |
| Barrier Shield | ₡111,000 | Shield | — | Mid-tier defensive option |
| Burst Rifle | ₡117,000 | Ballistic | 2.67 | Solid short-range DPS |
| Flux Repeater | ₡147,000 | Energy | 3.0 | One-handed mid-range energy |
| Photon Marksman | ₡147,000 | Energy | 3.0 | One-handed long-range energy |
| Mortar System | ₡163,000 | Ballistic | 2.5 | Two-handed mid-range |
| Shock Maul | ₡183,000 | Energy | 2.67 | Two-handed melee energy |
| Laser Rifle | ₡243,000 | Energy | 3.0 | Two-handed short-range precision |

**Premium Tier (₡250K–₡400K)** — Best for 1-robot strategy:
| Weapon | Price | Type | DPS | Notes |
|--------|-------|------|-----|-------|
| Plasma Rifle | ₡258,000 | Energy | 4.33 | High DPS short-range energy |
| Thermal Lance | ₡279,000 | Energy | 3.25 | Two-handed melee energy |
| Shotgun | ₡283,000 | Ballistic | 3.5 | Strong two-handed mid-range |
| Fortress Shield | ₡291,000 | Shield | — | Heavy defensive shield |
| Assault Rifle | ₡293,000 | Ballistic | 4.67 | Elite short-range ballistic |
| Disruptor Cannon | ₡293,000 | Energy | 4.67 | One-handed mid-range energy |
| Power Sword | ₡325,000 | Melee | 5.0 | Highest one-handed melee DPS |
| Sniper Rifle | ₡387,000 | Ballistic | 3.67 | Two-handed long-range |

**Luxury Tier (₡400K+)** — Elite weapons for focused builds:
| Weapon | Price | Type | DPS | Notes |
|--------|-------|------|-----|-------|
| Plasma Cannon | ₡408,000 | Energy | 4.0 | Elite two-handed mid-range |
| Aegis Bulwark | ₡409,000 | Shield | — | Ultimate defensive shield |
| Vibro Mace | ₡425,000 | Melee | 6.0 | Top one-handed melee |
| Volt Sabre | ₡425,000 | Energy | 6.0 | Top one-handed short-range |
| Nova Caster | ₡425,000 | Energy | 6.0 | Top one-handed mid-range |
| Particle Lance | ₡425,000 | Energy | 6.0 | Top one-handed long-range |

**Player Action**: Purchase weapon(s) using the actual weapon shop API. Real purchase, not simulation.

**UI Elements**:
- Filtered weapon shop showing recommended weapons for chosen strategy
- Budget tracker with remaining credits prominently displayed
- "Recommended for your strategy" badges on suggested weapons
- Price comparison with/without Weapons Workshop discount
- Purchase confirmation with budget impact preview
- "Continue to Battle Prep" button (enabled after at least one weapon purchased)

---

### Step 8: Battle Readiness and Repair Costs

**Purpose**: Teach weapon equipping, repair costs, and battle readiness requirements.

**Content**:
- Guide player through equipping their purchased weapon to their robot
- Explain loadout selection and its impact on stats
- Teach the repair cost formula so players understand ongoing costs
- Explain battle readiness requirements (must have weapon equipped)
- Show the player their robot's effective stats with equipment

**Weapon Equipping Flow**:
1. Select robot from roster
2. Choose loadout type (recommend Single Weapon for first-time)
3. Equip purchased weapon to main weapon slot
4. Review effective stats (base + weapon bonuses + loadout bonuses)

**Repair Cost Education**:

**Base Formula**:
```
repair_cost = (max_hp - current_hp) × 100
```

**With Repair Bay Discount**:
```
discount = repair_bay_level × (5 + active_robots)
repair_cost = base_cost × (1 - discount/100)
```
- Capped at 90% maximum discount
- Repair Bay Level 1 with 2 robots: 7% discount
- Repair Bay Level 1 with 3 robots: 8% discount

**Critical Damage Multiplier** (when robot reaches 0 HP):
```
critical_multiplier = 2.0 - (medical_bay_level × 0.1)
```
- Without Medical Bay: 2× repair cost when HP hits 0
- Medical Bay Level 1: 1.9× multiplier
- Medical Bay Level 10: 1.0× (no critical penalty)

**Manual Repair Discount (50%)**:
- When players use the "Repair All" button on the Robots page, they receive a 50% discount on repair costs
- This discount stacks with the Repair Bay discount (applied after Repair Bay discount)
- Automatic repairs during cycle processing pay full price
- Formula: `finalManualCost = Math.floor(costAfterRepairBay × 0.5)`
- Incentivizes active play between cycles
- Manual repairs are the only action allowed with negative credits — helps struggling players stay active and recover

**Battle Readiness Requirements**:
- Robot must have at least one weapon equipped
- Robot must have HP > 0 (not destroyed)
- Robot must not be currently in a battle

**Player Action**: Equip weapon to robot using the actual equip API. Real action.

**UI Elements**:
- Step-by-step equipping walkthrough with highlights on UI elements
- Loadout type selector with recommendation
- Before/after stat comparison showing weapon and loadout impact
- Repair cost calculator showing estimated costs per battle
- "Battle Ready!" confirmation when robot meets all requirements
- "Almost there!" button to proceed to final step

---

### Step 9: Completion and Personalized Recommendations

**Purpose**: Summarize what the player has learned and provide next steps.

**Content**:
- Congratulations message
- Summary of choices made during onboarding
- Personalized recommendations based on chosen strategy
- Next steps checklist
- Link to full game documentation for advanced topics

**Summary Display**:
- Chosen strategy (e.g., "2 Average Robots")
- Robots created (names and count)
- Weapons purchased (names and costs)
- Facilities recommended (from Step 3)
- Budget remaining
- Estimated daily income vs daily costs

**Personalized Recommendations by Strategy**:

**1 Mighty Robot**:
- "Focus on upgrading your robot's key combat attributes (Combat Power, Armor Plating, Shield Capacity)"
- "Consider buying a Weapon + Shield loadout for survivability"
- "Save credits for premium weapon upgrades"
- "Your robot will fight ~2.2 battles per day — make each one count"

**2 Average Robots**:
- "Try different loadout types on each robot to learn what works"
- "Upgrade Repair Bay early — you'll have double the repair costs"
- "Consider specializing each robot (one offensive, one defensive)"
- "You'll fight ~3.6 battles per day — good balance of income and learning"

**3 Flimsy Robots**:
- "Keep a larger credit reserve — three robots means triple the repair costs"
- "Upgrade Repair Bay and Streaming Studio early for cost savings and income"
- "Don't spread attribute upgrades too thin — focus on one robot at a time"
- "You'll fight ~5 battles per day — maximize your Streaming Studio income"

**Next Steps Checklist**:
- [ ] Buy Tier 1 facilities (Repair Bay, Training Facility) if not already purchased
- [ ] Upgrade key attributes on your primary robot
- [ ] Check the league standings to see your competition
- [ ] Wait for the next battle cycle to see your robot fight
- [ ] Review the Financial Report page to track income vs expenses

**Player Action**: Mark tutorial as complete. Redirected to dashboard.

**UI Elements**:
- Celebration animation/confetti
- Summary card with all choices
- Personalized recommendation cards
- Next steps checklist (interactive, links to relevant pages)
- "Enter the Arena" button (redirects to dashboard)
- "Replay Tutorial" link in footer

---

## Roster Strategies

This section provides detailed analysis of each roster strategy to inform the onboarding recommendations and help players understand long-term implications.

### Strategy Comparison Matrix

| Aspect | 1 Mighty Robot | 2 Average Robots | 3 Flimsy Robots |
|--------|---------------|-------------------|------------------|
| Robot Cost | ₡500,000 | ₡1,000,000 | ₡1,500,000 |
| Budget for Upgrades | ₡2,150,000 | ₡1,650,000 | ₡1,150,000 |
| Battles per Day | ~2.2 | ~3.6 | ~5.0 |
| Daily Repair Costs | Low (₡5K–₡15K) | Medium (₡10K–₡30K) | High (₡15K–₡50K) |
| Daily Battle Income | Low-Medium | Medium | Medium-High |
| Streaming Revenue | Lower (fewer battles) | Moderate | Higher (more battles) |
| Management Complexity | Simple | Moderate | Complex |
| Risk Profile | High (single point of failure) | Balanced | Spread (but individually weak) |
| Recommended For | Quality-focused players | New players (default) | Optimization-focused players |

### 1 Mighty Robot — Detailed Analysis

**Strengths**:
- Maximum attribute levels on a single robot
- Can afford premium/elite weapons immediately
- Simpler decision-making (one robot to manage)
- Higher individual win rate in battles
- Lower total repair costs per day

**Weaknesses**:
- Fewer battles per day means less income from battle rewards
- Lower streaming revenue (fewer battles to stream)
- Single point of failure — if your robot loses, no backup
- Slower fame accumulation (fame is per-robot, fewer battles)
- Less variety in combat strategies

**Recommended Loadout**: Two-Handed or Weapon + Shield (maximize the single robot's power or survivability)

**Recommended First Weapon**: Power Sword (₡325,000) or Plasma Cannon (₡408,000)

### 2 Average Robots — Detailed Analysis

**Strengths**:
- Good balance of power and battle frequency
- Can experiment with different strategies on each robot
- One robot can compensate if the other loses
- Moderate streaming and battle income
- Natural learning experience (compare two approaches)

**Weaknesses**:
- Neither robot is as strong as a single focused robot
- Higher total repair costs than single robot
- More decisions to make (two sets of upgrades, weapons, loadouts)
- Budget spread means slower progression per robot

**Recommended Loadout**: One offensive (Single or Two-Handed) + one defensive (Weapon + Shield)

**Recommended First Weapons**: Bolt Carbine (₡93,000) + Combat Shield (₡78,000) or two mid-tier weapons (e.g., Flux Repeater ₡147,000, Photon Marksman ₡147,000)

### 3 Flimsy Robots — Detailed Analysis

**Strengths**:
- Most battles per day (highest potential income)
- Maximum streaming revenue potential
- Fastest fame accumulation across the stable
- Can try three different combat strategies simultaneously
- Resilient — losing one robot still leaves two active

**Weaknesses**:
- Each robot is individually weak (low attributes, budget weapons)
- Highest total repair costs per day
- Most complex management (three robots to upgrade, equip, repair)
- Budget weapons limit combat effectiveness
- Risk of going bankrupt from repair costs if all three lose frequently

**Recommended Loadout**: Mix of Single Weapon (cheap, no penalties) and Dual-Wield (maximize attack speed)

**Recommended First Weapons**: Practice Sword (₡50,000) × 3 or Machine Pistol (₡94,000) × 3

---

## Budget System

The onboarding tracks the player's spending across categories to provide real-time feedback and warnings.

### Starting Budget

- **Amount**: ₡3,000,000 (as defined in [PRD_ECONOMY_SYSTEM.md](PRD_ECONOMY_SYSTEM.md))
- **Tracked from**: Step 4 (Budget Allocation Guidance) onward
- **Persists across**: Steps 5–8 (robot creation, weapon purchase, equipping)

### Budget Tracking Categories

| Category | Description | Tracked Actions |
|----------|-------------|-----------------|
| Facilities | Facility purchases during onboarding | Facility purchase API calls |
| Robots | Robot frame purchases | Robot creation API calls |
| Attributes | Attribute upgrades | Attribute upgrade API calls |
| Weapons | Weapon purchases | Weapon purchase API calls |
| Reserve | Unspent credits | Calculated: total - sum(other categories) |

### Budget Warnings

**Warning Thresholds**:

| Threshold | Level | Message | UI Treatment |
|-----------|-------|---------|--------------|
| ₡600,000 remaining | Yellow | "Your budget is getting low. Consider saving for repairs and operating costs." | Yellow banner at top of onboarding step |
| ₡200,000 remaining | Red | "Critical: You may not have enough for repairs after your first battles. Consider your spending carefully." | Red banner, pulsing animation |

**Warning Behavior**:
- Warnings appear as non-blocking banners (player can still make purchases)
- Warnings persist until budget rises above threshold (unlikely during onboarding)
- Warnings are dismissible but reappear on next step if still below threshold
- Budget tracker sidebar always shows current balance regardless of warnings

### Budget Tracker UI

The budget tracker is a persistent sidebar element visible during Steps 5–8:

```
┌─────────────────────────┐
│ 💰 Budget Tracker        │
│                         │
│ Starting:  ₡3,000,000   │
│ Spent:     ₡1,850,000   │
│ Remaining: ₡1,150,000   │
│                         │
│ ── Breakdown ──         │
│ Facilities:  ₡350,000   │
│ Robots:    ₡1,000,000   │
│ Weapons:     ₡500,000   │
│ Attributes:        ₡0   │
│                         │
│ 🟢 Budget Status: OK    │
└─────────────────────────┘
```

---

## Facility Education

### Priority System Rationale

Facilities are ordered by ROI (Return on Investment) and strategic necessity. The priority system accounts for:

1. **Immediate value**: Does this facility save/earn money from day 1?
2. **Compounding returns**: Does the benefit grow over time?
3. **Strategy dependency**: Is this only useful for certain roster strategies?
4. **Operating cost burden**: Can a new player afford the daily operating costs?

### ROI Calculations

**Repair Bay (Level 1)** — Tier 1 Mandatory:
- Cost: ₡50,000
- Operating cost: ₡100/day
- Discount: `level × (5 + active_robots)` percent
- With 2 robots: 7% repair discount
- Average daily repair savings: ~₡2,100 (assuming ₡30,000 daily repairs)
- Net daily benefit: ₡2,100 - ₡1,000 = ₡1,100
- **Break-even**: ~68 cycles (₡75,000 / ₡1,100)

**Training Facility (Level 1)** — Tier 1 Mandatory:
- Cost: ₡75,000
- Operating cost: ₡250/day
- Discount: 10% on all attribute upgrades
- Average daily upgrade spending: ~₡5,000
- Daily savings: ₡500
- Net daily benefit: ₡500 - ₡250 = ₡250
- **Break-even**: ~300 cycles (but essential for long-term progression)

**Weapons Workshop (Level 1)** — Tier 2 Recommended:
- Cost: ₡75,000
- Operating cost: ₡100/day
- Discount: 10% on weapon purchases
- Savings per weapon: ₡6,250–₡53,750 depending on weapon price
- **Break-even**: After purchasing 1–2 weapons

**Streaming Studio (Level 1)** — Tier 2 Recommended:
- Cost: ₡50,000
- Operating cost: ₡100/day
- Benefit: 2× streaming revenue per battle
- Base streaming per battle: ~₡1,000
- With 2 robots (~3.6 battles/day): ₡3,600 extra/day
- Net daily benefit: ₡3,600 - ₡100 = ₡3,500
- **Break-even**: ~14 cycles (excellent ROI)

### Discount Compounding Example

Buying facilities in the right order maximizes savings:

1. Buy Weapons Workshop (Level 1) first: ₡75,000
2. Buy weapons with 5% discount: Save ₡10,000–₡20,000 per weapon
3. Buy Training Facility (Level 1): ₡75,000
4. Upgrade attributes with 10% discount: Save ₡200–₡5,000 per upgrade
5. Cumulative savings over 30 cycles can exceed ₡100,000

**Key Insight**: Facility purchase order matters. Buying discount-providing facilities before making the purchases they discount maximizes value.

---

## Reset Functionality

Players who have completed (or skipped) the onboarding can reset their account to start fresh. This is useful for players who made poor early decisions or want to try a different strategy.

### Reset Scope

**What Gets Reset**:
- Credits restored to ₡3,000,000
- All robots deleted (including equipped weapons)
- All weapon inventory cleared
- All facilities removed
- All attribute upgrades reverted
- Onboarding state reset to Step 1
- League standings reset (placed in Bronze)
- Fame and prestige reset to 0

**What Is Preserved**:
- User account (username, email, password)
- Account creation date
- Reset history log
- Achievement history (future feature)

### Reset Eligibility Checks

Before allowing a reset, the system validates that the player has no active commitments:

| Check | Condition | Error Message |
|-------|-----------|---------------|
| Scheduled Matches | No robots in upcoming matchmaking queue | "You have scheduled matches. Wait for them to complete before resetting." |
| Active Tournaments | Not enrolled in any active tournament | "You are enrolled in an active tournament. Complete or withdraw first." |
| Pending Battles | No battles currently in progress | "You have battles in progress. Wait for them to resolve before resetting." |

### Reset Confirmation Flow

1. Player navigates to Settings → Account → Reset Account
2. System checks reset eligibility (API call to `/api/onboarding/reset-eligibility`)
3. If eligible, display warning dialog:
   - "This will permanently delete all your robots, weapons, facilities, and progress."
   - "Your credits will be restored to ₡3,000,000."
   - "This action cannot be undone."
4. Player must type **"RESET"** in a confirmation input field
5. "Reset Account" button enabled only when input matches "RESET" exactly
6. On confirmation, execute reset and redirect to onboarding Step 1

### Reset Logging

Every reset is logged for analytics and abuse prevention:

```typescript
interface ResetLog {
  id: number;
  userId: number;
  resetAt: DateTime;
  reason?: string;           // Optional player-provided reason
  creditsAtReset: number;    // Credits before reset
  robotCount: number;        // Robots deleted
  weaponCount: number;       // Weapons deleted
  facilityCount: number;     // Facilities removed
  onboardingStep: number;    // Step they were on before reset
  onboardingStrategy?: string; // Strategy they had chosen
}
```

### Reset Rate Limiting

- Maximum 3 resets per 30-day period
- After 3 resets, display: "You've reached the maximum number of resets this month. Try again after [date]."
- Admin can override this limit if needed

---

## Skip and Resume

### Skip Tutorial

Players can skip the onboarding at any step. Skipping is discouraged but always available.

**Skip Flow**:
1. "Skip Tutorial" link visible on every onboarding step (subtle, not prominent)
2. Clicking "Skip" shows confirmation dialog:
   - "Are you sure you want to skip the tutorial?"
   - "You can replay it anytime from Settings → Tutorial."
   - "We recommend completing it — it only takes 5-10 minutes."
3. Player confirms skip
4. `onboardingSkipped` set to `true`, `hasCompletedOnboarding` set to `true`
5. Player redirected to dashboard

**Skip Analytics**: Track which step players skip from to identify where the tutorial loses engagement.

### Resume Tutorial

If a player closes the browser or navigates away during the onboarding, they can resume from where they left off.

**Resume Behavior**:
- On login, check `hasCompletedOnboarding` and `onboardingSkipped`
- If both are `false`, redirect to onboarding at `onboardingStep`
- Player sees "Welcome back! You left off at Step [N]." message
- All previous choices are preserved (strategy, purchases, etc.)
- Player can navigate back to review previous steps

### Replay Tutorial

Players who completed or skipped the tutorial can replay it from Settings.

**Replay Flow**:
1. Settings → Tutorial → "Replay Tutorial"
2. Confirmation: "This will restart the tutorial from Step 1. Your current progress and purchases will not be affected."
3. On confirm, set `onboardingStep` to 1, `hasCompletedOnboarding` to `false`, `onboardingSkipped` to `false`
4. Redirect to onboarding Step 1
5. Tutorial runs in "replay mode" — purchases and actions are informational only (no real API calls)

---

## Database Schema

### User Table Additions

7 new columns added to the existing `User` model:

```prisma
model User {
  // ... existing fields ...

  // Onboarding fields
  hasCompletedOnboarding  Boolean   @default(false)
  onboardingSkipped       Boolean   @default(false)
  onboardingStep          Int       @default(1)
  onboardingStrategy      String?   // "1_mighty" | "2_average" | "3_flimsy"
  onboardingChoices       Json?     // Stores all choices made during onboarding
  onboardingStartedAt     DateTime?
  onboardingCompletedAt   DateTime?
}
```

**Field Descriptions**:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `hasCompletedOnboarding` | Boolean | `false` | `true` when player completes Step 9 or skips |
| `onboardingSkipped` | Boolean | `false` | `true` if player skipped instead of completing |
| `onboardingStep` | Int | `1` | Current step (1–9). Updated as player progresses. |
| `onboardingStrategy` | String? | `null` | Chosen roster strategy from Step 2 |
| `onboardingChoices` | Json? | `null` | JSON blob storing all choices for recommendations |
| `onboardingStartedAt` | DateTime? | `null` | Timestamp when player first entered Step 1 |
| `onboardingCompletedAt` | DateTime? | `null` | Timestamp when player completed Step 9 or skipped |

**`onboardingChoices` JSON Structure**:
```json
{
  "strategy": "2_average",
  "facilitiesPurchased": ["repair_bay", "training_facility"],
  "robotsCreated": [
    { "id": 123, "name": "Striker-01" },
    { "id": 124, "name": "Guardian-02" }
  ],
  "weaponsPurchased": [
    { "id": 456, "name": "Bolt Carbine", "cost": 93000 },
    { "id": 457, "name": "Combat Shield", "cost": 100000 }
  ],
  "loadoutsChosen": [
    { "robotId": 123, "loadout": "single" },
    { "robotId": 124, "loadout": "weapon_shield" }
  ],
  "budgetSpent": {
    "facilities": 350000,
    "robots": 1000000,
    "weapons": 300000,
    "attributes": 0
  },
  "stepsCompleted": [1, 2, 3, 4, 5, 6, 7, 8, 9],
  "stepTimestamps": {
    "1": "2026-03-02T10:00:00Z",
    "2": "2026-03-02T10:01:30Z",
    "3": "2026-03-02T10:03:00Z"
  }
}
```

### ResetLog Table

New table to track account resets:

```prisma
model ResetLog {
  id                 Int       @id @default(autoincrement())
  userId             Int
  resetAt            DateTime  @default(now())
  reason             String?   @db.VarChar(500)
  creditsAtReset     Decimal   @db.Decimal(15, 2)
  robotCount         Int
  weaponCount        Int
  facilityCount      Int
  onboardingStep     Int
  onboardingStrategy String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([resetAt])
  @@index([userId, resetAt])
}
```

### Migration

**Migration Name**: `add_onboarding_system`

**SQL Operations**:
1. Add 7 columns to `users` table with defaults
2. Create `reset_logs` table
3. Add indexes on `reset_logs`
4. Set `hasCompletedOnboarding = true` for all existing users (they don't need onboarding)

**Existing User Handling**:
```sql
-- All existing users are considered to have completed onboarding
UPDATE users SET has_completed_onboarding = true WHERE id > 0;
```

---

## API Endpoints

All onboarding endpoints are authenticated (require valid JWT token).

### GET /api/onboarding/state

**Purpose**: Retrieve the current onboarding state for the authenticated user.

**Request**:
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3001/api/onboarding/state
```

**Response (in progress)**:
```json
{
  "success": true,
  "data": {
    "hasCompletedOnboarding": false,
    "onboardingSkipped": false,
    "currentStep": 3,
    "strategy": "2_average",
    "choices": {
      "strategy": "2_average",
      "robotsCreated": [],
      "weaponsPurchased": [],
      "facilitiesPurchased": []
    },
    "startedAt": "2026-03-02T10:00:00Z",
    "completedAt": null
  }
}
```

**Response (completed)**:
```json
{
  "success": true,
  "data": {
    "hasCompletedOnboarding": true,
    "onboardingSkipped": false,
    "currentStep": 9,
    "strategy": "2_average",
    "choices": { "...full choices object..." },
    "startedAt": "2026-03-02T10:00:00Z",
    "completedAt": "2026-03-02T10:08:30Z"
  }
}
```

### POST /api/onboarding/state

**Purpose**: Update the onboarding state (advance step, save choices).

**Request**:
```bash
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "step": 3,
    "choices": {
      "strategy": "2_average"
    }
  }' \
  http://localhost:3001/api/onboarding/state
```

**Validation Rules**:
- `step` must be between 1 and 9
- `step` must be ≤ current step + 1 (can't skip ahead)
- `step` can be < current step (navigating back)
- `choices` is merged with existing choices (not replaced)

**Response**:
```json
{
  "success": true,
  "data": {
    "currentStep": 3,
    "choices": { "...merged choices..." }
  }
}
```

### POST /api/onboarding/complete

**Purpose**: Mark the onboarding as completed (called at end of Step 9).

**Request**:
```bash
curl -X POST -H "Authorization: Bearer <token>" \
  http://localhost:3001/api/onboarding/complete
```

**Response**:
```json
{
  "success": true,
  "data": {
    "hasCompletedOnboarding": true,
    "completedAt": "2026-03-02T10:08:30Z",
    "recommendations": [
      "Focus on upgrading your robots' key combat attributes",
      "Buy Tier 1 facilities if you haven't already",
      "Check the league standings to see your competition"
    ]
  }
}
```

### POST /api/onboarding/skip

**Purpose**: Skip the onboarding tutorial.

**Request**:
```bash
curl -X POST -H "Authorization: Bearer <token>" \
  http://localhost:3001/api/onboarding/skip
```

**Response**:
```json
{
  "success": true,
  "data": {
    "hasCompletedOnboarding": true,
    "onboardingSkipped": true,
    "skippedAtStep": 3
  }
}
```

### GET /api/onboarding/recommendations

**Purpose**: Get personalized recommendations based on onboarding choices and current game state.

**Request**:
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3001/api/onboarding/recommendations
```

**Response**:
```json
{
  "success": true,
  "data": {
    "strategy": "2_average",
    "recommendations": [
      {
        "category": "facilities",
        "priority": "high",
        "message": "Buy Repair Bay (Level 1) — saves ₡1,100/day on repairs",
        "action": "navigate",
        "target": "/facilities"
      },
      {
        "category": "weapons",
        "priority": "medium",
        "message": "Your robot Guardian-02 has no weapon equipped",
        "action": "navigate",
        "target": "/robots/124"
      },
      {
        "category": "upgrades",
        "priority": "low",
        "message": "Consider upgrading Combat Power on Striker-01",
        "action": "navigate",
        "target": "/robots/123"
      }
    ],
    "nextMilestones": [
      "First battle victory",
      "Reach 10,000 fame on any robot",
      "Upgrade any attribute to level 5"
    ]
  }
}
```

### POST /api/onboarding/reset-account

**Purpose**: Reset the player's account to starting state.

**Request**:
```bash
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "confirmation": "RESET",
    "reason": "Want to try a different strategy"
  }' \
  http://localhost:3001/api/onboarding/reset-account
```

**Validation**:
- `confirmation` must be exactly `"RESET"` (case-sensitive)
- `reason` is optional (max 500 characters)
- Must pass all eligibility checks (no active matches, tournaments, or battles)
- Must not exceed 3 resets in 30 days

**Response (success)**:
```json
{
  "success": true,
  "data": {
    "message": "Account has been reset successfully",
    "newBalance": 3000000,
    "deletedRobots": 2,
    "deletedWeapons": 3,
    "deletedFacilities": 4,
    "resetCount": 1,
    "resetsRemaining": 2
  }
}
```

**Response (ineligible)**:
```json
{
  "success": false,
  "error": {
    "code": "RESET_INELIGIBLE",
    "message": "Cannot reset account at this time",
    "reasons": [
      "You have 1 scheduled match. Wait for it to complete."
    ]
  }
}
```

### GET /api/onboarding/reset-eligibility

**Purpose**: Check if the player is eligible to reset their account.

**Request**:
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3001/api/onboarding/reset-eligibility
```

**Response**:
```json
{
  "success": true,
  "data": {
    "eligible": true,
    "resetCount": 1,
    "resetsRemaining": 2,
    "nextResetAvailable": null,
    "checks": {
      "noScheduledMatches": true,
      "noActiveTournaments": true,
      "noPendingBattles": true,
      "withinResetLimit": true
    }
  }
}
```

---

## Frontend Components

### Component Architecture

```
src/
├── components/
│   └── onboarding/
│       ├── OnboardingContainer.tsx      # Main container, step routing
│       ├── OnboardingProgress.tsx       # Progress bar (Step X of 9)
│       ├── BudgetTracker.tsx            # Persistent budget sidebar
│       ├── StepWelcome.tsx              # Step 1: Welcome
│       ├── StepRosterStrategy.tsx       # Step 2: Strategy selection
│       ├── StepFacilityEducation.tsx    # Step 3: Facility priorities
│       ├── StepBudgetAllocation.tsx     # Step 4: Budget guidance
│       ├── StepRobotCreation.tsx        # Step 5: Create robots
│       ├── StepWeaponEducation.tsx      # Step 6: Weapon/loadout types
│       ├── StepWeaponPurchase.tsx       # Step 7: Buy weapons
│       ├── StepBattleReadiness.tsx      # Step 8: Equip and prepare
│       ├── StepCompletion.tsx           # Step 9: Summary and next steps
│       └── SkipConfirmation.tsx         # Skip tutorial modal
├── hooks/
│   └── useOnboarding.ts                # Onboarding state management hook
├── services/
│   └── onboardingService.ts            # API client for onboarding endpoints
└── pages/
    └── OnboardingPage.tsx              # Route: /onboarding
```

### OnboardingContainer

The main container manages step navigation, state persistence, and layout:

```typescript
interface OnboardingState {
  currentStep: number;
  strategy: string | null;
  choices: OnboardingChoices;
  startedAt: string | null;
  isLoading: boolean;
  error: string | null;
}
```

**Layout**:
- Full-screen overlay (covers dashboard during onboarding)
- Progress bar at top (Step X of 9)
- Step content in center
- Budget tracker sidebar (Steps 5–8)
- Navigation buttons at bottom (Back / Next)
- Skip link in top-right corner

### OnboardingProgress

Visual progress indicator:

```
Step 1    Step 2    Step 3    Step 4    Step 5    Step 6    Step 7    Step 8    Step 9
  ●─────────●─────────●─────────○─────────○─────────○─────────○─────────○─────────○
Welcome   Strategy  Facilities Budget   Robots   Weapons  Purchase  Battle   Complete
```

- Completed steps: filled circle (●)
- Current step: pulsing circle
- Future steps: empty circle (○)
- Clickable for completed steps (navigate back)

### Routing

**Route**: `/onboarding`

**Route Guard**:
- On login, if `hasCompletedOnboarding === false` and `onboardingSkipped === false`, redirect to `/onboarding`
- If user navigates to `/onboarding` after completion, show "Tutorial completed" with replay option
- Onboarding page is accessible without completing it (no hard gate on other routes)

---

## Accessibility

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `Tab` | Move focus to next interactive element |
| `Shift + Tab` | Move focus to previous interactive element |
| `Enter` | Activate focused button or select focused option |
| `Space` | Toggle focused checkbox or select focused radio button |
| `Escape` | Close modal dialogs (skip confirmation, reset confirmation) |
| `Arrow Keys` | Navigate between strategy cards (Step 2) and loadout options (Step 6) |

### ARIA Labels

**Required ARIA attributes**:

```html
<!-- Progress bar -->
<div role="progressbar" aria-valuenow="3" aria-valuemin="1" aria-valuemax="9"
     aria-label="Onboarding progress: Step 3 of 9">

<!-- Strategy selection -->
<div role="radiogroup" aria-label="Choose your roster strategy">
  <div role="radio" aria-checked="true" aria-label="2 Average Robots - Recommended">
  <div role="radio" aria-checked="false" aria-label="1 Mighty Robot">
  <div role="radio" aria-checked="false" aria-label="3 Flimsy Robots">
</div>

<!-- Budget tracker -->
<aside aria-label="Budget tracker" aria-live="polite">
  <span aria-label="Remaining budget: 1,150,000 credits">₡1,150,000</span>
</aside>

<!-- Warning banners -->
<div role="alert" aria-live="assertive">
  Your budget is getting low. Consider saving for repairs.
</div>

<!-- Step navigation -->
<nav aria-label="Onboarding step navigation">
  <button aria-label="Go back to previous step">Back</button>
  <button aria-label="Continue to next step">Next</button>
</nav>
```

### WCAG 2.1 AA Compliance

| Requirement | Implementation |
|-------------|----------------|
| Color contrast | Minimum 4.5:1 for text, 3:1 for large text and UI components |
| Focus indicators | Visible focus ring on all interactive elements (2px solid outline) |
| Text alternatives | Alt text on all images, icons have aria-labels |
| Resize support | Content readable at 200% zoom without horizontal scrolling |
| Motion preferences | Respect `prefers-reduced-motion` for animations (confetti, pulsing) |
| Screen reader | All content accessible via screen reader in logical order |
| Error identification | Form errors announced via `aria-live` regions |

### Mobile Responsive Design

| Breakpoint | Layout Changes |
|------------|----------------|
| ≥ 1024px (Desktop) | Side-by-side layout: content + budget tracker sidebar |
| 768px–1023px (Tablet) | Stacked layout: content above, budget tracker below |
| < 768px (Mobile) | Full-width single column, budget tracker as collapsible header |

**Mobile-Specific Requirements**:
- Tooltips display as full-width bottom sheets (not hover popups)
- Touch targets minimum 44×44px
- Strategy cards stack vertically on mobile
- Swipe gestures for step navigation (optional enhancement)
- Budget tracker collapses to a single-line summary bar

---

## Analytics

### Events to Track

**Step-Level Events**:

| Event | Data | Purpose |
|-------|------|---------|
| `onboarding_started` | `userId`, `timestamp` | Track tutorial start rate |
| `onboarding_step_entered` | `userId`, `step`, `timestamp` | Track step progression |
| `onboarding_step_completed` | `userId`, `step`, `duration`, `choices` | Track completion and time per step |
| `onboarding_step_back` | `userId`, `fromStep`, `toStep` | Identify confusing steps |
| `onboarding_completed` | `userId`, `totalDuration`, `strategy`, `choices` | Track full completion |
| `onboarding_skipped` | `userId`, `skippedAtStep`, `timestamp` | Track skip rate and drop-off point |
| `onboarding_resumed` | `userId`, `resumedAtStep`, `timestamp` | Track resume behavior |
| `onboarding_replayed` | `userId`, `timestamp` | Track replay interest |

**Action Events**:

| Event | Data | Purpose |
|-------|------|---------|
| `onboarding_strategy_selected` | `userId`, `strategy` | Track strategy distribution |
| `onboarding_robot_created` | `userId`, `robotId`, `robotName`, `step` | Track robot creation during onboarding |
| `onboarding_weapon_purchased` | `userId`, `weaponId`, `weaponName`, `cost`, `step` | Track weapon purchases during onboarding |
| `onboarding_weapon_equipped` | `userId`, `robotId`, `weaponId`, `loadoutType` | Track equipping behavior |
| `onboarding_budget_warning` | `userId`, `warningLevel`, `remainingBudget` | Track budget management |
| `onboarding_reset_requested` | `userId`, `resetCount` | Track reset frequency |

### Key Metrics Dashboard

**Funnel Metrics**:
- Step 1 → Step 2 conversion (should be >95%)
- Step 2 → Step 5 conversion (strategy to first robot)
- Step 5 → Step 7 conversion (robot to first weapon)
- Step 7 → Step 9 conversion (weapon to completion)
- Overall completion rate (Step 1 → Step 9)

**Engagement Metrics**:
- Average time per step (identify slow/confusing steps)
- Skip rate by step (identify where players lose interest)
- Back-navigation frequency (identify confusing content)
- Strategy distribution (ensure balance)

**Retention Correlation**:
- Day-1 retention: completed vs skipped vs never started
- Day-7 retention: completed vs skipped vs never started
- Day-30 retention: completed vs skipped vs never started
- First battle timing: hours after onboarding completion
- First week battle count: onboarded vs non-onboarded

**Strategy Performance**:
- Win rate by chosen strategy (first 30 days)
- Credit balance by strategy (first 30 days)
- Churn rate by strategy
- Strategy switch rate (players who reset to try different strategy)

### Drop-Off Analysis

Track where players abandon the tutorial to identify improvement areas:

```
Step 1 (Welcome)          ████████████████████████████████ 100%
Step 2 (Strategy)         ██████████████████████████████   95%
Step 3 (Facilities)       ████████████████████████████     88%
Step 4 (Budget)           ██████████████████████████       82%
Step 5 (Robot Creation)   ████████████████████████         78%
Step 6 (Weapon Education) ██████████████████████           75%
Step 7 (Weapon Purchase)  ████████████████████             72%
Step 8 (Battle Readiness) ██████████████████               70%
Step 9 (Completion)       ██████████████████               70%
```

Target: ≥70% completion rate. If any step shows >5% drop-off, investigate and simplify.

---

## Performance

### Loading Requirements

| Metric | Target | Implementation |
|--------|--------|----------------|
| Initial load | < 2s | Lazy load step components, code split per step |
| Step transition | < 300ms | Preload next step while current step is displayed |
| API response | < 500ms | Cache onboarding state, debounce updates |
| Image assets | < 100KB each | WebP format, responsive sizes, lazy loading |
| Total bundle | < 150KB | Tree-shake unused components, dynamic imports |

### Optimization Strategies

**Lazy Loading Step Components**:
```typescript
const StepWelcome = lazy(() => import('./StepWelcome'));
const StepRosterStrategy = lazy(() => import('./StepRosterStrategy'));
const StepFacilityEducation = lazy(() => import('./StepFacilityEducation'));
// ... etc
```

**Debounced State Updates**:
- Onboarding state is saved to the backend with a 500ms debounce
- Prevents excessive API calls during rapid navigation
- Immediate save on step completion or critical actions (purchases)

**Cached Recommendations**:
- `/api/onboarding/recommendations` response cached for 5 minutes
- Cache invalidated on robot creation, weapon purchase, or facility purchase
- Client-side cache using React state or SWR/React Query

**Image Optimization**:
- Robot silhouettes and weapon icons: SVG format (scalable, small)
- Strategy comparison illustrations: WebP, max 100KB each
- Lazy load images below the fold
- Placeholder skeletons during image load

**Preloading**:
- When player is on Step N, preload Step N+1 component
- Preload weapon catalog data during Step 5 (before Step 7 needs it)
- Preload robot list during Step 6 (before Step 8 needs it)

---

## Testing Requirements

### Unit Tests (Required)

**Onboarding Service Tests** (`tests/onboarding.test.ts`):
- State retrieval for new user (default values)
- State retrieval for in-progress user
- State retrieval for completed user
- State update with valid step progression
- State update rejects skipping ahead (step > current + 1)
- State update allows navigating back
- Choices merge correctly (not overwrite)
- Complete endpoint sets correct flags and timestamp
- Skip endpoint sets correct flags
- Recommendations return strategy-specific content

**Reset Service Tests** (`tests/onboardingReset.test.ts`):
- Reset restores credits to ₡3,000,000
- Reset deletes all robots
- Reset deletes all weapon inventory
- Reset deletes all facilities
- Reset resets onboarding state to Step 1
- Reset creates ResetLog entry with correct data
- Reset fails when scheduled matches exist
- Reset fails when enrolled in active tournament
- Reset fails when battles are pending
- Reset fails when confirmation is not "RESET"
- Reset fails when rate limit exceeded (3 per 30 days)
- Reset eligibility check returns correct status

**Budget Tracking Tests**:
- Budget warnings trigger at ₡600,000 threshold
- Budget warnings trigger at ₡200,000 threshold
- Budget tracker calculates category totals correctly
- Budget tracker updates after robot creation
- Budget tracker updates after weapon purchase

### Integration Tests (Required for Critical Paths)

**Full Onboarding Flow** (`tests/integration/onboardingFlow.test.ts`):
- Complete 9-step flow with 2-robot strategy
- Verify robot creation during Step 5 persists
- Verify weapon purchase during Step 7 persists
- Verify weapon equipping during Step 8 persists
- Verify onboarding state is correct after completion
- Verify recommendations reflect actual game state

**Reset Flow** (`tests/integration/onboardingReset.test.ts`):
- Full reset: create robots → buy weapons → reset → verify clean state
- Reset eligibility with active match → ineligible
- Reset eligibility with no commitments → eligible
- Multiple resets within rate limit
- Reset exceeding rate limit → rejected

### Property-Based Tests (Recommended)

**Budget Calculations** (`tests/onboarding.property.test.ts`):
- For any combination of robot count (1–3) and weapon purchases, remaining budget is always ≥ 0 or warning is shown
- Budget category totals always sum to total spent
- Strategy recommendations are always consistent with chosen strategy

### Frontend Tests

**Component Tests**:
- OnboardingProgress renders correct step indicators
- Strategy selection cards are keyboard navigable
- Budget tracker updates on state changes
- Skip confirmation modal opens and closes correctly
- Reset confirmation requires typing "RESET"
- Step navigation respects completion rules (can't skip ahead)

**Accessibility Tests**:
- All interactive elements have ARIA labels
- Focus management works correctly between steps
- Screen reader announces step changes
- Color contrast meets WCAG 2.1 AA requirements

---

## Dependencies & Risks

### Dependencies

| Dependency | Type | Impact |
|------------|------|--------|
| User authentication system | Required | Onboarding state is per-user, requires JWT auth |
| Robot creation API | Required | Step 5 uses real robot creation |
| Weapon shop API | Required | Step 7 uses real weapon purchase |
| Weapon equip API | Required | Step 8 uses real weapon equipping |
| Facility purchase API | Optional | Step 3 may link to facility purchase |
| Database migration | Required | New columns on User table, new ResetLog table |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Tutorial too long, players skip | Medium | High | Keep each step concise (<2 min). Track skip rates. |
| Strategy recommendations become outdated after balance changes | Medium | Medium | Recommendations reference game constants, not hardcoded values. |
| Reset functionality abused | Low | Low | Rate limit (3 per 30 days). Log all resets. |
| Onboarding blocks access to game | Low | High | Skip is always available. No hard gate on routes. |
| Mobile experience is poor | Medium | Medium | Mobile-first design. Test on multiple devices. |
| API failures during onboarding | Low | High | Graceful error handling. Retry logic. State persists on backend. |

---

## Success Metrics

### Launch Metrics (First 30 Days)

| Metric | Target | Action if Below Target |
|--------|--------|----------------------|
| Tutorial start rate | ≥ 90% of new users | Improve redirect logic, make entry more prominent |
| Tutorial completion rate | ≥ 70% | Identify drop-off steps, simplify content |
| Average completion time | 5–10 minutes | If >10 min, reduce content. If <3 min, add depth. |
| Skip rate | ≤ 30% | Investigate skip reasons, improve engagement |
| Day-7 retention (completed) | ≥ 50% | Review recommendations, improve post-onboarding guidance |
| Day-7 retention (skipped) | Baseline | Compare with completed to measure onboarding impact |
| First battle within 24h | ≥ 80% | Ensure Step 8 clearly explains battle readiness |
| Reset rate | ≤ 10% | Review strategy education, improve decision support |

### Long-Term Metrics (90 Days)

| Metric | Target | Notes |
|--------|--------|-------|
| Day-30 retention (completed) | ≥ 30% | Healthy retention for strategy games |
| Strategy distribution | No strategy >60% | Indicates balanced presentation |
| Post-onboarding facility purchase rate | ≥ 60% within 7 days | Validates facility education effectiveness |
| Average robots per player (day 30) | ≥ 1.5 | Players expanding beyond initial strategy |

---

## Appendices

### Appendix A: Onboarding State Machine

```
                    ┌──────────┐
                    │  Login   │
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │  Check   │
                    │ Onboard  │
                    │  State   │
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
         ┌────▼───┐ ┌───▼────┐ ┌──▼───────┐
         │Complete│ │In Prog │ │Not Started│
         └────┬───┘ └───┬────┘ └──┬───────┘
              │         │         │
         ┌────▼───┐ ┌───▼────┐ ┌──▼───────┐
         │Dashboard│ │Resume  │ │ Step 1   │
         └────────┘ │at Step │ └──┬───────┘
                    └───┬────┘    │
                        │         │
                    ┌───▼─────────▼──┐
                    │  Step Flow     │
                    │  1 → 2 → ... → 9│
                    └───┬────────┬───┘
                        │        │
                   ┌────▼──┐ ┌──▼────┐
                   │ Skip  │ │Complete│
                   └───┬───┘ └───┬───┘
                       │         │
                   ┌───▼─────────▼──┐
                   │   Dashboard    │
                   └────────────────┘
```

### Appendix B: Related Documents

- [PRD_ECONOMY_SYSTEM.md](PRD_ECONOMY_SYSTEM.md) — Starting budget, facility costs, revenue streams
- [PRD_WEAPONS_LOADOUT.md](PRD_WEAPONS_LOADOUT.md) — Weapon types, loadout configurations, pricing
- [PRD_ROBOT_ATTRIBUTES.md](PRD_ROBOT_ATTRIBUTES.md) — Robot creation costs, attribute upgrades
- [STABLE_SYSTEM.md](../STABLE_SYSTEM.md) — Facility types, costs, and benefits
- [PRD_FAME_SYSTEM.md](PRD_FAME_SYSTEM.md) — Fame and prestige progression
- [COMBAT_FORMULAS.md](COMBAT_FORMULAS.md) — Battle mechanics and damage calculations
- [PRD_LEAGUE_PROMOTION.md](PRD_LEAGUE_PROMOTION.md) — League system and progression
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) — Current database schema

### Appendix C: Glossary

| Term | Definition |
|------|-----------|
| Stable | A player's collection of robots, facilities, and resources |
| Roster | The set of robots a player owns |
| Loadout | The weapon configuration on a robot (single, weapon+shield, two-handed, dual-wield) |
| Cycle | An automated game processing period (daily) that runs battles and updates standings |
| LP | League Points — determine standings within a league |
| Prestige | Stable-level progression resource (never decreases) |
| Fame | Robot-level reputation earned through victories |
| ROI | Return on Investment — how quickly a purchase pays for itself |
