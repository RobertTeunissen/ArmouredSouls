# Armoured Souls — Design System & User Experience Guide

**Last Updated**: February 1, 2026  
**Status**: Master Reference Document  
**Purpose**: Comprehensive guide for implementing visual design and user experience across all pages

---

## Document Purpose

This guide consolidates all design documentation into a **unified, actionable reference** for implementing the Armoured Souls visual design system. It defines:
- What users should see and feel on each page
- Which images and visual elements reinforce the experience
- How brand identity aligns with user flow
- Clear implementation priorities and specifications

**This document supersedes ad-hoc visual decisions and ensures all design work aligns with brand strategy.**

---

## Table of Contents

1. [Design Philosophy & Brand Alignment](#design-philosophy--brand-alignment)
2. [Emotional Design Strategy](#emotional-design-strategy)
3. [Visual Hierarchy System](#visual-hierarchy-system)
4. [Page-by-Page Design Specifications](#page-by-page-design-specifications)
5. [Image & Asset System](#image--asset-system)
6. [Typography & Type System](#typography--type-system)
7. [Motion & Micro-Animations](#motion--micro-animations)
8. [Color & Material System](#color--material-system)
9. [Component Design Patterns](#component-design-patterns)
10. [Implementation Priority Matrix](#implementation-priority-matrix)

---

## Design Philosophy & Brand Alignment

### Core Brand Premise

**Armoured Souls is a system-driven robot combat management game.**

The player is **not** the robot. The player is **the manager**.

Like a cycling team manager, players:
- Build their stable their own way
- Make strategic trade-offs
- Optimize, specialize, and commit to long-term strategies
- Express identity through systems mastery

### Primary Player Fantasy

> *"I built this stable deliberately, and it reflects who I am as a manager."*

### Brand Emotional Targets

**Primary Emotions** (must dominate):
- **Mastery** - Players feel competent and in control
- **Pride** - Players take ownership of their strategic decisions

**Secondary Emotions** (supporting):
- Control
- Ownership
- Belonging

**Excluded Emotions** (must avoid):
- Whimsy, chaos, spectacle-for-spectacle's-sake
- Anime expressiveness
- Fantasy RPG tropes
- Mobile gacha aesthetics

### Design North Star

> "Does this reinforce mastery, pride, and deliberate ownership — or does it distract from them?"

If it distracts, it is wrong.

---

## Emotional Design Strategy

### The Three Logo States & Their Meaning

Armoured Souls uses **logo hierarchy** to signal context and stakes:

#### Direction B — Precision/Engineering (CORE)
- **Context**: Management screens, stable operations, economy
- **Emotional Target**: Control, mastery, managerial authority
- **Visual Treatment**: Engineered letterforms, minimal ornamentation, brushed metal
- **Usage**: Navigation, dashboard, facilities, upgrades, robot management

#### Direction C — Soul/Energy (HEART)
- **Context**: Arena entry, match start, victory/defeat, major milestones
- **Emotional Target**: Emotional bond, pride, significance
- **Visual Treatment**: Inner glow (never outer), energy contained within form
- **Usage**: Battle screens, achievements, promotions, championships

#### Direction D — Minimal/Icon (SCALING)
- **Context**: Infrastructure, loading, login, dense UI
- **Emotional Target**: Confidence, professionalism, maturity
- **Visual Treatment**: Reduced mark, flat rendering, high contrast
- **Usage**: Login screen, loading states, favicon, responsive headers

### Emotional Escalation Ladder

| User Journey Stage | Logo State | Emotional Weight | Design Approach |
|-------------------|-----------|------------------|------------------|
| Entry/Infrastructure | D | Neutral | Calm, professional |
| Management/Planning | B | Controlled | Systematic, clear |
| Pre-Battle Focus | B → C | Rising Stakes | Subtle activation |
| Battle/Resolution | C | Peak Emotion | Brief, decisive |
| Return to Planning | C → B | Settling | Return to control |

**Critical Rule**: Direction C is **earned**, not constant. Emotional peaks must be brief to remain meaningful.

---

## Visual Hierarchy System

### Information Architecture Principles

1. **Progressive Disclosure**
   - Dashboard: High-level overview
   - Detail Pages: Comprehensive information
   - Modals: Context-specific actions

2. **Task-Oriented Organization**
   - Pages organized around player goals, not arbitrary categories
   - Pre-Battle Flow: Configure → Battle → Results → Adjust
   - Progression Flow: Upgrades → Facilities
   - Management Flow: Shop → Inventory → Equipment

3. **Contextual Information**
   - Critical data visible without navigation (Credits in header)
   - Robot HP status always visible on cards
   - Storage capacity shown during purchasing

4. **Consistent Navigation**
   - Main nav present on all pages
   - Breadcrumbs for hierarchy (future)
   - Quick actions on cards for common tasks

---

## Page-by-Page Design Specifications

### 1. Login & Registration Pages

**Route**: `/login`, `/register`  
**Logo State**: Direction D (Minimal)  
**Emotional Target**: Confidence, professionalism, calm entry

#### What Users Should See
- **Logo**: Direction D (minimal icon or compact wordmark)
- **Background**: Subtle, non-distracting tech pattern or gradient
- **Form**: Clean, focused input fields with clear labels
- **Call-to-Action**: Single, prominent button

#### Visual Elements Required
- [ ] Direction D logo (square format, 64×64px minimum)
- [ ] Background texture or pattern (low-contrast, dark theme)
- [ ] Input field styling (consistent with system)
- [ ] Loading state animation (if applicable)

#### Design Rationale
- **Infrastructure context** requires minimal visual complexity
- Players entering the system should feel **establishment and professionalism**
- No battle imagery or excitement here - this is the threshold
- Simple, fast, functional

#### Implementation Priority: **IMPLEMENTED**

---

### 2. Dashboard Page

**Route**: `/dashboard`  
**Logo State**: Direction B (Precision)  
**Emotional Target**: Control, mastery, ownership

#### What Users Should See
- **Logo**: Direction B in navigation (engineering, precise)
- **Stable Section**: Stable name with edit capability, Credits/Prestige prominently displayed
  - Finances with link to detail pages (Daily finance statements)
- **Statistics Panel**: Stable-wide stats (battles, wins/draws/losses, win rate)
- **Robot Cards**: Visual grid/list of active robots (sorted with highest League first) with:
  - Robot portrait (primary identity)
  - Robot name (Link to Robot details for battle configuration or upgrades)
  - HP bar (with critical/warning states)
  - Battle Readiness indicator
  - ELO rating badge
  - Current League and League Points (Link to league)
  - Quick action buttons (View Details, Repair)
  - Upcoming matches (grouped per type - only Leagues are immplemented)
  - Recent battle results

#### Visual Elements Required
- [ ] **Robot Portraits** (256×256px, framed in cards)
  - Suggest mechanical, distinct identities per frame type
  - Show damage state visually (cracks, missing parts if critical HP)
- [ ] **HP Bar Component** with color coding:
  - Green (100-70%)
  - Yellow (69-30%)
  - Red (29-1%)
  - Critical flash if <10%
- [ ] **Currency Icon** (₡ Credits symbol, styled to match typography)
- [ ] **Prestige Icon** (star or badge, prestigious feel)
- [ ] **Empty State Illustration** if no robots (welcoming, instructional)

#### Image Types & Visual Reinforcement
1. **Robot Portraits**: Instant recognition, reduce list blindness
2. **HP Bars**: Status-at-a-glance, immediate triage decisions
3. **Icons**: Credits/Prestige as game world currency, not abstract numbers
4. **Empty State**: Friendly prompt to create first robot

#### User Flow & Emotional Journey
- **Entry**: Player sees their stable at a glance
- **Feeling**: "This is mine. I'm in control."
- **Action**: Scan robot health, check resources, decide next step
- **Goal**: Quick assessment → Navigate to action (repair, upgrade, battle)

#### Design Rationale
- Dashboard is the **default home** - must feel like a **command center**
- Robot portraits transform "reading lists" into "scanning assets"
- HP bars provide **instant status feedback** without clicking through
- Credits/Prestige visibility reinforces **economic decision-making**
- Direction B logo reinforces **managerial control**

#### Implementation Priority: **P0** (Highest priority)

---

### 3. Robots Page

**Route**: `/robots`  
**Logo State**: Direction B (Precision)  
**Emotional Target**: Ownership, organization

#### What Users Should See
- **Logo**: Direction B in navigation
- **Header**: "My Robots" with robot count (X/Y slots)
- **Robot List/Grid**: All robots in stable
  - Robot portrait (larger than dashboard cards)
  - Robot name (editable inline or via icon)
  - Frame type badge/label
  - HP/Shield status bars
  - ELO rating
  - Quick stats (Wins/Losses, Damage Dealt)
  - Action buttons (View Details, Repair, Configure)
- **Create Robot Button**: Prominent, always visible
- **Filter/Sort Controls** (future): By HP, ELO, frame, name

#### Visual Elements Required
- [ ] **Robot Portraits** (larger, 320×320px or similar)
- [ ] **Frame Type Badges** (small icons showing robot chassis category)
- [ ] **HP/Shield Dual Bars** (stacked or side-by-side)
- [ ] **ELO Badge** (styled as competitive ranking indicator)
- [ ] **Action Icons** (View, Repair, Configure - clear, consistent)
- [ ] **Empty State** if no robots (instructional, encouraging)

#### Image Types & Visual Reinforcement
1. **Portraits**: Primary visual identity
2. **Frame Badges**: Quick frame recognition (Humanoid, Tank, Quadruped, etc.)
3. **Status Bars**: Health monitoring at scale
4. **ELO Badge**: Competitive context, pride

#### User Flow & Emotional Journey
- **Entry**: "Here's my collection"
- **Feeling**: "I own these robots. They're mine to command."
- **Action**: Browse, assess, select robot for action
- **Goal**: Navigate to specific robot or create new one

#### Design Rationale
- Robots Page is the **roster overview** - players manage their fleet
- Larger portraits emphasize **individual robot identity**
- Status bars allow **quick triage** across multiple robots
- Frame badges provide **visual categorization** without reading
- Direction B reinforces **systematic management**

#### Implementation Priority: **P0** (Highest priority)

--> What's the function of this page? What does it show that's not on the Dashboard Robot Cards?
--> Currently it's mainly used to create another robot and as alternative to the Weapons Shop (which is also in the Top Bar)
--> This could be part of a higher hierarchy showing "My Assets" (Facilities / Robots / Weapons are currently defined)?

---

### 4. Robot Detail Page

**Route**: `/robots/:id`  
**Logo State**: Direction B (Precision)  
**Emotional Target**: Mastery, strategic planning

#### What Users Should See
- **Logo**: Direction B in navigation
- **Hero Section**: Large robot portrait with name, frame, ELO
- **Performance Stats**: Battles, wins, losses, damage dealt/taken
- **Combat State Panel**:
  - Current HP / Max HP (bar + numbers)
  - Current Shield / Max Shield (bar + numbers)
  - Damage Taken (last battle)
- **Loadout Configuration**:
  - 4 loadout type buttons (visual icons + labels)
  - Main Weapon Slot (shows equipped weapon thumbnail + stats)
  - Offhand Weapon Slot (shows equipped weapon thumbnail + stats)
  - Equip/Unequip buttons with weapon selection modal
- **Battle Stance Selector**:
  - 3 stance options (Offensive, Defensive, Balanced)
  - Visual icons showing stance posture
- **Yield Threshold Slider**:
  - Slider 0-50%
  - Repair cost preview calculation
- **Attributes Section**:
  - All 23 attributes displayed with icons
  - Base stat + bonuses breakdown
  - Effective stat calculation shown
  - Color-coded by category (Combat, Defense, Chassis, AI, Team)
 
--> Do we need to add that everyone can see the basics of every robot (as already implemented) but only owners can see everything?

#### Visual Elements Required
- [ ] **Large Robot Portrait** (512×512px, hero placement)
- [ ] **Weapon Thumbnails** (128×128px, for equipped weapons)
- [ ] **Loadout Type Icons** (64×64px each: Single, Weapon+Shield, Two-Handed, Dual-Wield)
- [ ] **Stance Icons** (64×64px each: Offensive, Defensive, Balanced postures)
- [ ] **Attribute Category Icons** (32×32px, 5 categories)
- [ ] **23 Individual Attribute Icons** (24×24px each)
- [ ] **HP/Shield Bars** (dual display with color coding)
- [ ] **Background Panel** (subtle tech pattern or grid, non-distracting)

#### Image Types & Visual Reinforcement
1. **Robot Portrait**: Identity, ownership, pride
2. **Weapon Thumbnails**: Instant recognition of loadout
3. **Loadout Icons**: Visual representation of tactical stance
4. **Stance Icons**: Communicate battle approach without text
5. **Attribute Icons**: Reduce text-heavy stat lists to scannable glyphs
6. **Category Icons**: Color-coding for rapid categorization

#### User Flow & Emotional Journey
- **Entry**: "This is my robot. Let me configure it."
- **Feeling**: "I understand every option. I'm making deliberate choices."
- **Action**: Adjust loadout, stance, yield, weapon equipment
- **Goal**: Optimize robot for next battle

#### Design Rationale
- Robot Detail is the **strategic configuration hub** - most complex page
- Large portrait reinforces **attachment and ownership**
- Visual icons reduce cognitive load from **23 attributes + weapons + loadout + stance**
- Real-time stat preview helps players **understand consequences**
- All battle-relevant settings in one place = **efficient workflow**
- Direction B emphasizes **precision and control**

#### Implementation Priority: **P0** (Highest priority)

---

### 5. Create Robot Page

**Route**: `/robots/create`  
**Logo State**: Direction B (Precision)  
**Emotional Target**: Anticipation, investment

--> How do you access this page? Currently accessible via /robots or via /dashboard. 

#### What Users Should See
- **Logo**: Direction B in navigation
- **Header**: "Create New Robot"
- **Robot Frame Selection**:
  - Frame type cards (currently one, future multiple)
  - Frame preview illustration
  - Frame cost (₡500,000)
  - Frame specifications (base stats, size, role)
- **Name Input**: Text field with character limit
- **Roster Capacity Indicator**: "X/Y slots used"
- **Credits Balance**: Prominent display with affordability check
- **Create Button**: Large, confirms purchase

#### Visual Elements Required
- [ ] **Frame Type Illustrations** (512×512px, blueprint or silhouette style)
- [ ] **Cost Badge** (₡ icon + amount, clear pricing)
- [ ] **Capacity Indicator** (visual progress bar or counter)
- [ ] **Preview State**: Show what robot will look like after creation
- [ ] **Affordability Visual**: Green if affordable, red/disabled if not

#### Image Types & Visual Reinforcement
1. **Frame Illustrations**: Blueprint aesthetic, engineering drawing style
2. **Cost Icon**: Reinforces economic decision
3. **Capacity Visual**: Shows investment in roster expansion

#### User Flow & Emotional Journey
- **Entry**: "I want to expand my stable"
- **Feeling**: "This is a significant investment. I'm deliberate."
- **Action**: Choose frame, name robot, confirm purchase
- **Goal**: Add robot to roster, navigate to configuration

#### Design Rationale
- Frame illustrations use **engineering aesthetic** to match Direction B
- Blueprint style emphasizes **construction and planning**
- Clear cost display reinforces **economic consequence**
- Roster capacity shows **stable growth progression**

#### Implementation Priority: **P1** (After core roster/detail pages)

---

### 6. Weapon Shop Page

**Route**: `/weapon-shop`  
**Logo State**: Direction B (Precision)  
**Emotional Target**: Comparison, strategic purchasing

#### What Users Should See
- **Logo**: Direction B in navigation
- **Header**: "Weapon Shop" with Credits balance, storage capacity (X/Y)
- **Filter Tabs**: All / Melee / Ranged / Shields / Two-Handed
- **Weapon Cards** (10 weapons total):
  - Weapon thumbnail/illustration (primary visual)
  - Weapon name
  - Weapon type badge (Melee, Ballistic, Energy, Shield)
  - Base damage
  - Cooldown
  - Attribute bonuses (compact list)
  - Cost (₡) (with discount when applicable)
  - Purchase button (disabled if storage full or insufficient Credits)
- **Workshop Discount Badge** (if Weapons Workshop upgraded)

--> There's 11 weapons now, Practice Sword has been added. Update relevant documentation, it's in the seed. 

#### Visual Elements Required
- [ ] **Weapon Illustrations** (256×256px, detailed mechanical renderings)
  - Energy Sword - glowing blade
  - Plasma Rifle - futuristic gun
  - Ion Cannon - heavy weapon
  - Nano Blade - sleek dagger
  - Photon Lance - lance/spear
  - Shield Generator - energy field
  - Pulse Hammer - melee bludgeon
  - Particle Beam - beam weapon
  - Kinetic Barrier - shield variant
  - Fusion Blade - two-handed sword
     
--> Many of the names are incorrect. We have a Combat Shield, Shotgun, Hammer, Plasma Cannon. These should carry the same names as the weapons in the actual database.

- [ ] **Weapon Type Icons** (32×32px: Melee, Ballistic, Energy, Shield)

--> I'm not happy with those namings. Currently they don't really have any effect. If we keep those icons, we need to properly define them and use them. Melee and Shield are how you use something, Ballistic is a mix, Energy how damage is dealt. Let's stick to one system. 

- [ ] **Cost Badge** (₡ icon + amount)
- [ ] **Storage Full Warning** (visual indicator)
- [ ] **Discount Badge** (% off, if applicable)

#### Image Types & Visual Reinforcement
1. **Weapon Illustrations**: Instant recognition, comparison shopping
2. **Type Icons**: Quick filtering and categorization
3. **Cost Icons**: Economic decision-making
4. **Storage Indicator**: Capacity planning

#### User Flow & Emotional Journey
- **Entry**: "I need to upgrade my arsenal"
- **Feeling**: "I'm comparing options strategically"
- **Action**: Browse weapons, compare stats, purchase
- **Goal**: Acquire weapons that fit current strategy

#### Design Rationale
- Weapon illustrations transform **text-heavy descriptions** into **scannable cards**
- Type badges enable **quick filtering** without reading
- Storage capacity shown to prevent **over-purchasing frustration**
- Direction B emphasizes **catalog browsing and comparison**

--> How can a user do a quick comparison between the weapons?

#### Implementation Priority: **P1** (After robot pages)

---

### 7. Weapon Inventory Page

**Route**: `/weapon-inventory`  
**Logo State**: Direction B (Precision)  
**Emotional Target**: Organization, asset management

#### What Users Should See
- **Logo**: Direction B in navigation
- **Header**: "Weapon Inventory" with storage capacity (X/Y)
- **Filter Controls**: All / Equipped / Available / By Type
- **Weapon Cards**:
  - Weapon thumbnail
  - Weapon name
  - Type badge
  - Specs (damage, cooldown)
  - Equipped Status: "Equipped on [Robot Name]" or "Available"
  - Quick Unequip button (if equipped)
  - Ability to equip on a robot (if Robot loadout allows)

#### Visual Elements Required
- [ ] **Weapon Thumbnails** (same as shop, 256×256px)
- [ ] **Equipped Badge** (visual indicator: "In Use" banner or ribbon)
- [ ] **Robot Portrait (small)** showing which robot uses weapon
- [ ] **Storage Capacity Bar** (visual progress indicator)
- [ ] **Empty State** if no weapons (encouragement to visit shop)

#### Image Types & Visual Reinforcement
1. **Weapon Thumbnails**: Consistent with shop for recognition
2. **Equipped Badges**: Allocation visibility
3. **Robot Thumbnails**: Quick reference to equipped robots

#### User Flow & Emotional Journey
- **Entry**: "What weapons do I own?"
- **Feeling**: "I'm managing my resources efficiently"
- **Action**: Review inventory, unequip weapons, allocate to robots
- **Goal**: Understand weapon allocation, free up weapons

#### Design Rationale
- Inventory is **management-focused**, not shopping
- Equipped status must be **immediately visible**
- Small robot portraits show **weapon allocation** without navigation
- Direction B reinforces **systematic inventory control**

--> How can a user do a quick comparison between the weapons?

#### Implementation Priority: **P1** (After weapon shop)

---

### 8. Facilities Page

**Route**: `/facilities`  
**Logo State**: Direction B (Precision)  
**Emotional Target**: Long-term investment, strategic planning

#### What Users Should See
- **Logo**: Direction B in navigation
- **Header**: "Stable Facilities" with Credits and Prestige displayed
- **Facility Grid** (14 facilities):
  - Facility illustration (building/tech icon)
  - Facility name
  - Current level (0-10)
  - Next level cost
  - Next level benefit description
  - Operating cost per day
  - Prestige requirement (if any)
  - Upgrade button (disabled if locked or unaffordable)
- **Category Headers**: Economic, Progression, Combat Effectiveness

#### Visual Elements Required
- [ ] **Facility Illustrations** (256×256px each, 14 unique)
  1. Repair Bay - repair docks
  2. Training Facility - workout/training area
  3. Weapons Workshop - forge/crafting
  4. Research Lab - computers/screens
  5. Medical Bay - medical cross
  6. Roster Expansion - hangar/slots
  7. Storage Facility - warehouse
  8. Coaching Staff - office/trainers
  9. Booking Office - tournament desk
  10. Combat Training Academy - combat room
  11. Defense Training Academy - shield training
  12. Mobility Training Academy - agility course
  13. AI Training Academy - AI processors
  14. Income Generator - money/resources
- [ ] **Level Indicator** (progress bar or badge, 0-10 scale)
- [ ] **Prestige Lock Icon** (if level requires prestige)
- [ ] **Cost Badge** (₡ icon + upgrade cost)
- [ ] **Operating Cost Badge** (daily cost icon)

#### Image Types & Visual Reinforcement
1. **Facility Illustrations**: Transform spreadsheet into game world
2. **Level Indicators**: Progression visualization
3. **Lock Icons**: Gating and aspiration
4. **Cost/Benefit Text**: Economic clarity

#### User Flow & Emotional Journey
- **Entry**: "How do I improve my stable long-term?"
- **Feeling**: "I'm building infrastructure. This is strategic."
- **Action**: Compare facilities, evaluate cost-benefit, upgrade
- **Goal**: Invest in facilities that match strategy

#### Design Rationale
- Facility illustrations **transform abstract upgrades** into **tangible structures**
- Level indicators show **progression state** at a glance
- Prestige locks create **aspiration and goals**
- Cost/benefit clarity enables **strategic investment**
- Direction B emphasizes **systematic planning**

#### Implementation Priority: **P1** (After core gameplay loop)

---

### 9. Battle Preparation Screen 

**Route**: `/battle/prepare/:robotId`  
**Logo State**: Direction B → C (Transition)  
**Emotional Target**: Focus, rising stakes

#### What Users Should See
- **Logo**: Direction B transitioning to Direction C (subtle activation)
- **Hero Section**: Large robot portrait, battle-ready stance
- **Opponent Preview**: Enemy robot silhouette or portrait
- **Configuration Summary**:
  - Loadout (visual icons)
  - Stance (visual icon)
  - Yield threshold
  - Effective stats preview
- **Confirm Battle Button**: Large, decisive action

--> How will a user access this page? How does he arrive here?

#### Visual Elements Required
- [ ] **Robot Portrait** (battle-ready pose, 512×512px)
- [ ] **Opponent Preview** (shadowed or partially revealed)
- [ ] **Arena Background** (subtle, atmospheric)
- [ ] **Logo Transition Animation** (B → C, inner glow activation)
- [ ] **Confirm Button** (prominent, styled for high stakes)

#### Image Types & Visual Reinforcement
1. **Battle-Ready Pose**: Shifts from management to combat context
2. **Opponent Silhouette**: Builds anticipation
3. **Arena Background**: Atmospheric reinforcement
4. **Logo Transition**: Signals emotional escalation

#### User Flow & Emotional Journey
- **Entry**: "I'm about to commit to battle"
- **Feeling**: "Stakes are rising. This matters."
- **Action**: Final review, confirm entry
- **Goal**: Enter battle with confidence

#### Design Rationale
- This page is the **threshold between management and combat**
- Logo transition (B → C) signals **rising emotional stakes**
- Large robot portrait reinforces **player attachment**
- Opponent preview builds **anticipation without revealing too much**
- Arena background begins **atmospheric shift** to battle context

#### Implementation Priority: **P2**

---

### 10. Battle Result Screen (Future)

--> You seem to have difficulties with what's already there and what is future. We already have a screen: /battle-history. Here users can see there own battles for all their robots. They can also click and do a deep dive into the battle log. 

**Route**: `/battles/:id/result`  
**Logo State**: Direction C (Energized)  
**Emotional Target**: Pride (victory) or consequence (defeat)

#### What Users Should See
- **Logo**: Direction C (inner glow, peak emotional state)
- **Result Banner**: "VICTORY" or "DEFEAT" (large, decisive)
- **Robot Portrait**: Winner's pose (if victory) or damaged state (if defeat)
- **Battle Statistics**:
  - Damage dealt / taken
  - HP remaining
  - Critical hits
  - Duration
- **Rewards/Consequences**:
  - Credits earned/spent
  - ELO change
  - Fame gained
  - Repair cost (if damaged)
- **Action Buttons**: View Replay, Return to Stable, Next Battle

#### Visual Elements Required
- [ ] **Direction C Logo** (inner glow, energized state)
- [ ] **Result Banner** (stylized, impactful typography)
- [ ] **Victory Robot Pose** (triumphant stance)
- [ ] **Defeat Robot Pose** (damaged, but not destroyed)
- [ ] **Reward Icons** (Credits, ELO, Fame, styled consistently)
- [ ] **Battle Replay Button** (play icon, video-style)
- [ ] **Background** (arena environment, subtle smoke/effects)

#### Image Types & Visual Reinforcement
1. **Direction C Logo**: Peak emotional moment marker
2. **Result Banner**: Clear outcome communication
3. **Robot Pose**: Outcome visualization
4. **Reward Icons**: Consequence feedback
5. **Arena Background**: Battle context reinforcement

#### User Flow & Emotional Journey
- **Entry**: "The battle is over. What happened?"
- **Feeling**: Pride (if won) or determination to improve (if lost)
- **Action**: Review outcome, absorb results
- **Goal**: Understand outcome, plan next action

#### Design Rationale
- Direction C logo signals **this moment matters**
- Large result banner provides **immediate clarity**
- Robot pose reinforces **emotional outcome**
- Statistics offer **detailed feedback** for strategic learning
- Rewards/costs provide **economic consequence**
- **Brief emotional peak**, then return to control (back to Direction B)

#### Implementation Priority: **P2** (Post-MVP, with battle system)

--> Battle system is already implemented. Where did you find it is not?

---

### 11. Leaderboards / Rankings (Future)

--> Leaderboards were introduced in League system. /league-standings! 

**Route**: `/leaderboards`  
**Logo State**: Direction B (Precision)  
**Emotional Target**: Competition, aspiration

#### What Users Should See
- **Logo**: Direction B in navigation
- **Header**: "Global Rankings" with filter tabs (ELO, Wins, Prestige, etc.)
- **Ranking List**:
  - Rank number
  - Robot portrait (small thumbnail)
  - Robot name
  - Owner stable name
  - ELO / Wins / Prestige (depending on filter)
  - Player's own rank highlighted
- **Player Position Card**: Sticky header showing player's current rank

#### Visual Elements Required
- [ ] **Robot Thumbnails** (small, 64×64px)
- [ ] **Rank Badges** (1st/2nd/3rd special, Gold/Silver/Bronze)
- [ ] **League Tier Icons** (Bronze, Silver, Gold, Platinum, Diamond, Master)
- [ ] **Trophy Icon** (for top players)
- [ ] **Highlight Style** (for player's position in list)

#### Image Types & Visual Reinforcement
1. **Robot Thumbnails**: Visual recognition in list
2. **Rank Badges**: Competition and hierarchy
3. **League Icons**: Progression tiers
4. **Trophy**: Excellence recognition

#### User Flow & Emotional Journey
- **Entry**: "Where do I stand?"
- **Feeling**: "I want to climb. I want to compete."
- **Action**: Compare rankings, set goals
- **Goal**: Understand competitive position, aspire to improve

#### Design Rationale
- Leaderboards are **competitive**, not emotional
- Direction B maintains **systematic presentation**
- Rank badges add **prestige to top positions**
- Player highlight ensures **personal context**
- Visual consistency with robot portraits

#### Implementation Priority: **P2** (Post-MVP)

---

## Image & Asset System

### Asset Categories

Based on the comprehensive design system, the following asset categories are defined:

#### 1. Robot Identity Assets

**1.1 Robot Portraits**
- **Purpose**: Primary visual identity, instant recognition
- **Sizes**:
  - Small thumbnail: 64×64px (leaderboards, inventory)
  - Card size: 256×256px (lists, cards)
  - Hero size: 512×512px (detail pages, battle screens)
- **Format**: PNG with transparency, WebP for web
- **Style**: Mechanical, detailed, distinct per frame type
- **Variants**: Standard pose, battle-ready pose (future), damaged state (future)
- **Color Palette**: Metallic grays, accent colors per frame
- **Quantity**: 1 per frame type initially (expand to 10+ frame types)

**1.2 Frame Type Badges**
- **Purpose**: Quick visual categorization
- **Size**: 48×48px
- **Format**: SVG (preferred), PNG fallback
- **Style**: Simplified icon, high contrast
- **Examples**: Humanoid icon, Tank icon, Quadruped icon
- **Quantity**: 1 per frame type

**1.3 HP/Shield Status Bars**
- **Purpose**: Health monitoring at a glance
- **Type**: Component (CSS/SVG)
- **Color Coding**:
  - HP: Green (100-70%), Yellow (69-30%), Red (29-1%), Flashing Red (<10%)
  - Shield: Blue (100-50%), Cyan (49-1%)
- **Style**: Metallic gradient, subtle inner glow

#### 2. Weapon Assets

**2.1 Weapon Illustrations**
- **Purpose**: Visual recognition in shop and inventory
- **Size**: 256×256px (primary), 128×128px (thumbnails in robot detail)
- **Format**: PNG with transparency, WebP
- **Style**: Detailed mechanical rendering, sci-fi aesthetic
- **Color Palette**: Metallic base + type-specific accents:
  - Melee: Steel with blue edge
  - Ballistic: Dark metal with orange details
  - Energy: Chrome with cyan/purple glow
  - Shield: Translucent blue energy

 --> See comment about weapon types above.

- **Quantity**: 10 weapons (expandable)

**2.2 Weapon Type Icons**
- **Purpose**: Category identification, filtering
- **Size**: 32×32px
- **Format**: SVG (preferred), PNG fallback
- **Style**: Simple glyphs (sword, gun, shield, two-handed)
- **Color**: Consistent with type palette
- **Quantity**: 4 types

#### 3. Facility Assets

**3.1 Facility Illustrations**
- **Purpose**: Transform facility upgrades into game world structures
- **Size**: 256×256px
- **Format**: PNG, WebP
- **Style**: Isometric or blueprint aesthetic, technical/industrial
- **Color Palette**: Neutral grays with functional accents
- **Quantity**: 14 facilities

**3.2 Facility Level Indicators**
- **Type**: Component (CSS/SVG)
- **Style**: Progress bar or badge (Level 0-10)
- **Color**: Bronze (1-3), Silver (4-6), Gold (7-9), Platinum (10)

#### 4. Attribute Icons

**4.1 Category Icons**
- **Purpose**: Visual grouping of attribute categories
- **Size**: 32×32px
- **Format**: SVG (preferred)
- **Style**: Geometric, minimal
- **Color Coding**:
  - 🔴 Combat Systems: Red
  - 🔵 Defensive Systems: Blue
  - 🟢 Chassis & Mobility: Green
  - 🟡 AI Processing: Yellow
  - 🟣 Team Coordination: Purple
- **Quantity**: 5 categories

**4.2 Individual Attribute Icons**
- **Purpose**: Replace text labels with scannable glyphs
- **Size**: 24×24px
- **Format**: SVG (preferred), PNG fallback
- **Style**: Line icons, technical aesthetic
- **Color**: Category color or neutral
- **Quantity**: 23 attributes

Examples:
- Combat Power: ⚔️ Sword/power symbol
- Armor Plating: 🛡️ Shield/armor
- Hull Integrity: ❤️ Heart/HP
- Targeting Systems: 🎯 Crosshair
- Servo Motors: ⚙️ Gear/speed

#### 5. UI & System Icons

**5.1 Currency & Resource Icons**
- **Credits (₡)**: Stylized C with strikethrough, metallic
- **Prestige**: Star or badge, golden
- **Fame**: Similar to prestige but silver/bronze
- **Size**: 24×24px (inline), 48×48px (prominent)
- **Format**: SVG

**5.2 Navigation Icons**
- **Dashboard**: Home/grid
- **Robots**: Robot head silhouette
- **Weapon Shop**: Crossed swords
- **Inventory**: Storage/chest
- **Facilities**: Building/structure
- **Battles**: Arena/combat
- **Leaderboards**: Trophy/rankings
- **Size**: 24×24px
- **Format**: SVG
- **Style**: Line icons, consistent weight

**5.3 Action Icons**
- **View**: Eye
- **Edit**: Pencil
- **Delete**: Trash
- **Equip**: Plus/attach
- **Unequip**: Minus/detach
- **Repair**: Wrench/tools
- **Upgrade**: Arrow up
- **Size**: 20×20px
- **Format**: SVG

#### 6. Logo Assets

**6.1 Direction B — Core Logo**
- **Format**: SVG (primary), PNG (fallback)
- **Sizes**: 32px, 40px, 64px height
- **Color**: Adaptive (dark on light, light on dark)
- **Style**: Industrial grotesk, DIN-class typeface, ALL CAPS
- **Usage**: Navigation, persistent UI

**6.2 Direction C — Energized Logo**
- **Format**: SVG with inner glow effect, WebP fallback
- **Sizes**: 64px, 120px height
- **Color**: Base + inner glow (cyan/blue energy)
- **Style**: Identical geometry to B, energy inside letterforms
- **Usage**: Battle entry, results, achievements

**6.3 Direction D — Minimal Logo**
- **Format**: SVG (primary), PNG in multiple sizes
- **Sizes**: 16×16, 32×32, 48×48, 64×64, 512×512 (for PWA)
- **Color**: Monochrome or single-color
- **Style**: Reduced mark, flat rendering
- **Usage**: Favicon, loading, login, PWA icon

#### 7. Background & Atmospheric Assets

**7.1 Page Backgrounds**
- **Purpose**: Subtle texture, not distracting
- **Style**: Dark theme, tech grid pattern, circuit board subtle texture
- **Format**: SVG pattern (tiled) or CSS gradient
- **Opacity**: Low (10-20%), non-intrusive

**7.2 Arena Backgrounds (Future)**
- **Purpose**: Battle screen atmosphere
- **Style**: Industrial arena, smoke, dramatic lighting
- **Format**: WebP, optimized for performance
- **Size**: Full viewport width, responsive

**7.3 Empty State Illustrations**
- **Purpose**: Friendly UX when no content exists
- **Examples**:
  - No robots: Illustration of empty hangar with "Create your first robot"
  - No weapons: Illustration of empty armory
  - No battles: Illustration of quiet arena
- **Size**: 256×256px or larger
- **Format**: PNG, WebP
- **Style**: Friendly but consistent with brand (not cartoony)

#### 8. Badge & Status Assets

**8.1 ELO/League Tier Badges**
- **Purpose**: Competitive ranking visualization
- **Sizes**: 32×32px (small), 64×64px (large)
- **Format**: PNG, WebP
- **Style**: Metallic badges with tier insignia
- **Tiers**: Bronze, Silver, Gold, Platinum, Diamond, Master
- **Quantity**: 6 tiers

**8.2 Achievement Badges (Future)**
- **Purpose**: Recognition of milestones
- **Size**: 64×64px
- **Format**: PNG, WebP
- **Style**: Trophy, medal, or emblem
- **Quantity**: Expandable

---

## Typography & Type System

### Type System Selection

**System A — Industrial Precision (RECOMMENDED AND LOCKED)**

#### Display / Logo Font
- **Family**: DIN Condensed / DIN Next / Inter Tight (or similar industrial grotesk)
- **Weight**: Bold / Heavy only for logos
- **Casing**: ALL CAPS for logo wordmarks
- **Usage**: Logo, page headers, section titles

#### UI / Body Font
- **Family**: Inter / Source Sans 3 / IBM Plex Sans
- **Weights**: Regular (400), Medium (500), Bold (700)
- **Usage**: Body text, labels, buttons, descriptions

### Typography Hierarchy

| Element | Font | Size | Weight | Color | Usage |
|---------|------|------|--------|-------|-------|
| Logo | DIN Next / Inter Tight | 32-40px | Bold | Adaptive | Navigation |
| H1 | DIN Next / Inter Tight | 32px | Bold | Primary | Page titles |
| H2 | DIN Next / Inter Tight | 24px | Bold | Primary | Section titles |
| H3 | Inter | 18px | Medium | Primary | Subsection |
| Body | Inter | 16px | Regular | Secondary | Descriptions |
| Label | Inter | 14px | Medium | Secondary | Form labels, tags |
| Small | Inter | 12px | Regular | Tertiary | Metadata, footnotes |
| Button | Inter | 16px | Medium | Primary | Action buttons |

### Typography Rules

1. **Readability First**: Never sacrifice legibility for style
2. **Hierarchy Through Scale**: Size and weight create hierarchy, not color alone
3. **Consistent Line Height**: 1.5x for body text, 1.2x for headings
4. **Adequate Spacing**: 16px base spacing, scale up for sections
5. **Avoid All-Caps in Body Text**: Use for headings and labels only

---

## Motion & Micro-Animations

### Core Motion Philosophy

Motion in Armoured Souls is:
- **Deliberate** - Responds to user action or system state
- **Contained** - Energy is internal, not explosive
- **Earned** - Emotional peaks are brief and meaningful

**If motion draws attention to itself, it is wrong.**

### Motion States

#### 1. Infrastructure Motion (Direction D)
- **Context**: Login, loading, empty states
- **Duration**: 200-300ms
- **Easing**: Linear fades
- **Rules**: No scale changes, no bounce

#### 2. Management Motion (Direction B)
- **Context**: Stable overview, robot lists, facilities
- **Duration**: 150-250ms
- **Easing**: Ease-out
- **Rules**: Subtle transitions, minimal movement (2-6px)

#### 3. Focused Interaction Motion (B → C)
- **Context**: Pre-battle, arena entry, match start
- **Duration**: 250-400ms
- **Easing**: Ease-out
- **Rules**: One directional movement, slight scale-in (≤1.05×)

#### 4. Resolution Motion (Direction C)
- **Context**: Victory, defeat, promotions, major unlocks
- **Duration**: 400-600ms
- **Easing**: Ease-out
- **Rules**: Brief expressive beat, settles quickly, no looping

### Logo Motion Rules

**Allowed**:
- Fade in/out
- Scale-in (≤5%)
- Inner glow ramp-up
- Opacity-based reveal

**Forbidden**:
- Rotation
- Bounce
- Elastic easing
- Continuous pulsing
- Particle effects
- Screen shake

### UI Component Animations

| Component | Animation | Duration | Trigger |
|-----------|-----------|----------|---------|
| Button Hover | Slight lift (2px) | 150ms | Mouse enter |
| Card Hover | Shadow expansion | 200ms | Mouse enter |
| Modal Open | Fade + scale-in | 250ms | Modal trigger |
| HP Bar Update | Smooth fill transition | 300ms | Data change |
| Notification | Slide-in from top | 300ms | Event |
| Loading Spinner | Continuous rotation | - | Loading state |

### Accessibility

- **Respect `prefers-reduced-motion`**: Replace movement with fades
- **Remove scale changes** in reduced motion mode
- **Keep durations short**: Never delay user input

---

## Color & Material System

### Color Palette

Based on dark theme aesthetic with industrial metallic tones:

#### Primary Colors
- **Background**: `#0a0e14` (Deep space black)
- **Surface**: `#1a1f29` (Dark panel)
- **Surface Elevated**: `#252b38` (Raised cards)
- **Primary Text**: `#e6edf3` (Off-white)
- **Secondary Text**: `#8b949e` (Gray)
- **Tertiary Text**: `#57606a` (Muted gray)

#### Accent Colors
- **Primary Accent**: `#58a6ff` (Cyan-blue, for actions)
- **Success**: `#3fb950` (Green, for HP healthy, success states)
- **Warning**: `#d29922` (Amber, for HP medium, caution)
- **Error**: `#f85149` (Red, for HP critical, errors)
- **Info**: `#a371f7` (Purple, for prestige, special)

#### Category Colors (Attributes)
- **Combat Systems**: `#f85149` (Red)
- **Defensive Systems**: `#58a6ff` (Blue)
- **Chassis & Mobility**: `#3fb950` (Green)
- **AI Processing**: `#d29922` (Yellow)
- **Team Coordination**: `#a371f7` (Purple)

#### Material Colors
- **Metallic Base**: `#6e7681` (Steel gray)
- **Metallic Highlight**: `#c9d1d9` (Chrome)
- **Metallic Shadow**: `#30363d` (Dark metal)
- **Energy Glow**: `#58a6ff` with opacity (Cyan energy)

### Material System

#### Surface Materials
1. **Panel/Card**: Dark surface with subtle border
   - Background: Surface color
   - Border: 1px solid `#30363d`
   - Border-radius: 8px
   - Shadow: Subtle elevation

2. **Button - Primary**: Call-to-action
   - Background: Primary accent gradient
   - Hover: Lighten 10%
   - Active: Darken 10%
   - Text: White

3. **Button - Secondary**: Support actions
   - Background: Transparent
   - Border: 1px solid Primary accent
   - Hover: Background Primary accent 10% opacity
   - Text: Primary accent

4. **Input Field**: Form inputs
   - Background: Surface elevated
   - Border: 1px solid Tertiary text
   - Focus: Border Primary accent, glow
   - Text: Primary text

#### Status Materials
1. **HP Bar - Healthy** (100-70%)
   - Fill: Success green gradient
   - Glow: Subtle green inner shadow
   - Animation: Smooth transition

2. **HP Bar - Warning** (69-30%)
   - Fill: Warning amber gradient
   - Glow: Amber inner shadow

3. **HP Bar - Critical** (29-1%)
   - Fill: Error red gradient
   - Glow: Red inner shadow, pulsing if <10%

4. **Shield Bar**
   - Fill: Cyan-blue gradient
   - Glow: Cyan energy effect
   - Animation: Smooth transition

#### Metallic Materials
1. **Logo - Direction B**
   - Fill: Brushed metal texture
   - Gradient: Light to dark gray
   - Highlight: Subtle specular

2. **Logo - Direction C**
   - Fill: Same as Direction B
   - Inner glow: Cyan energy, 20-40% opacity
   - Animation: Glow ramp-up

3. **Weapon Illustrations**
   - Base: Metallic gray
   - Accents: Type-specific color
   - Highlights: Chrome specular
   - Shadows: Dark metal

---

## Component Design Patterns

### Card Component Pattern

**Purpose**: Container for game entities (robots, weapons, facilities)

**Structure**:
```
┌─────────────────────────────────┐
│  [Thumbnail/Portrait]           │
│                                 │
│  [Title/Name]                   │
│  [Subtitle/Type]                │
│                                 │
│  [Status Bars / Metadata]       │
│                                 │
│  [Action Buttons]               │
└─────────────────────────────────┘
```

**Specifications**:
- Background: Surface elevated
- Border: 1px solid border color
- Border-radius: 8px
- Padding: 16px
- Hover: Slight shadow expansion
- Click: Navigate or modal

**Variants**:
- Robot Card: Portrait + Name + HP/Shield + ELO + Actions
- Weapon Card: Illustration + Name + Type + Stats + Cost + Purchase
- Facility Card: Illustration + Name + Level + Cost + Benefits + Upgrade

### Modal Component Pattern

**Purpose**: Context-specific overlays (weapon selection, confirmation dialogs)

**Structure**:
```
┌────────────────────────────┐
│  [X Close]                 │
│                            │
│  [Modal Title]             │
│                            │
│  [Content Area]            │
│  ...                       │
│  ...                       │
│                            │
│  [Cancel] [Confirm]        │
└────────────────────────────┘
```

**Specifications**:
- Backdrop: Black 60% opacity
- Modal: Surface color, 600px max-width
- Border-radius: 12px
- Shadow: Large elevation shadow
- Animation: Fade + scale-in (250ms)
- Close: X button top-right, Escape key

### Status Bar Component Pattern

**Purpose**: Visual representation of current/max values (HP, Shield, storage)

**Structure**:
```
[Label]  ████████░░  [100/150]
```

**Specifications**:
- Height: 24px (single bar), 20px (dual bar)
- Border-radius: 4px
- Fill: Color-coded based on percentage
- Background: Dark surface
- Animation: Smooth fill transition (300ms)
- Text: Numbers inline or above

**Variants**:
- HP Bar: Color transitions (green → yellow → red)
- Shield Bar: Cyan, single color
- Storage Bar: Neutral gray, shows capacity
- Dual Bar: HP + Shield stacked or side-by-side

### Button Component Pattern

**Purpose**: User actions throughout UI

**Types**:
1. **Primary**: Main CTA (Create, Purchase, Upgrade, Battle)
2. **Secondary**: Support actions (Cancel, View, Edit)
3. **Tertiary**: Low-priority actions (Delete, Reset)
4. **Icon Button**: Icon-only actions (Edit, Delete, View)

**Specifications**:
- Height: 40px (default), 48px (prominent)
- Padding: 12px 24px
- Border-radius: 6px
- Font: Inter, 16px, Medium
- Hover: Slight lift (2px), shadow
- Active: Depress (no lift)
- Disabled: Opacity 50%, no interaction

### Icon Component Pattern

**Purpose**: Visual glyphs for categories, actions, attributes

**Specifications**:
- Size: 24×24px (default), 16px (small), 32px (large)
- Format: SVG (preferred), PNG fallback
- Color: Inherit from parent or category color
- Line weight: 2px for line icons
- Hover: Slight scale-up (1.1×) if interactive
- Accessibility: Always paired with label or aria-label

---

## Comprehensive Asset Specifications & Technical Details

This section provides detailed technical specifications for all visual assets, including file formats, naming conventions, directory structure, and specific content requirements.

### Asset Directory Structure

```
prototype/frontend/src/assets/
├── brand/                  # Logo variants, currency, UI frames
│   ├── logo-b.svg          # Direction B (precision/management)
│   ├── logo-c.svg          # Direction C (soul/energy/battle)
│   ├── logo-d.svg          # Direction D (minimal/infrastructure)
│   ├── logo-icon.svg       # Icon-only mark
│   ├── logo-white.svg      # White variant
│   ├── currency-icon.svg   # Credits (₡) icon
│   ├── prestige-icon.svg   # Prestige icon
│   └── ui-*.svg            # UI frame elements (corners, dividers)
├── robots/                 # Robot portraits
│   ├── robot-chassis-{type}-{colorway}.webp
│   └── (48 total: 12 chassis × 4 colorways)
├── weapons/                # Weapon illustrations
│   ├── weapon-{name}-full.webp     # 256×256px catalog
│   └── weapon-{name}-thumb.webp    # 128×128px thumbnails
├── facilities/             # Facility illustrations
│   └── facility-{name}.webp        # 256×256px
├── icons/                  # All SVG icons (organized by category)
│   ├── attributes/         # 23 attribute icons
│   │   └── ic-attr-{name}.svg
│   ├── weapons/            # 4 weapon type icons
│   │   └── ic-weapon-{type}.svg
│   ├── benefits/           # 8 facility benefit icons
│   │   └── ic-benefit-{category}.svg
│   ├── navigation/         # 8 navigation icons
│   │   └── ic-nav-{page}.svg
│   ├── loadout/            # Loadout slot icons
│   │   └── slot-{type}-{state}.svg
│   └── silhouettes/        # 12 chassis fallback icons
│       └── silhouette-{type}.svg
├── backgrounds/            # Page and arena backgrounds
│   ├── bg-arena-{variant}.webp
│   └── bg-page-pattern.svg
├── empty-states/           # Empty state illustrations
│   └── empty-{state}.webp
├── badges/                 # Rank and achievement badges
│   └── rank-badge-{tier}-{size}.png
└── frames/                 # Rarity frames (future)
    └── frame-{rarity}-{size}.png
```

### File Naming Conventions

**General Rules**:
- Use kebab-case for all file names (lowercase with hyphens)
- Be descriptive but concise
- Include size in file name if multiple variants exist
- Use consistent suffixes (-full, -thumb, -icon)

**Format Selection**:
- **SVG**: Icons, logos, UI elements (scalable, tiny payload)
- **WEBP**: Photos, portraits, complex illustrations (superior compression)
- **PNG**: Badges, overlays with transparency (when WEBP not supported)

### Robot Portrait Specifications

**12 Base Chassis Archetypes**:
1. Humanoid Standard (balanced)
2. Heavy Tank (bulky, slow)
3. Scout Runner (light, agile)
4. Siege Frame (artillery-focused)
5. Berserker (close combat)
6. Defender (shield-focused)
7. Sniper Platform (long-range)
8. Brawler (melee specialist)
9. Support Unit (team coordination)
10. Assault Class (all-rounder)
11. Interceptor (fast striker)
12. Juggernaut (massive, armored)

**Colorway Variants** (4 per chassis = 48 total portraits):
- **Red/Black** - Aggressive, offensive-focused
- **Blue/Silver** - Defensive, tank-oriented
- **Gold/Bronze** - Prestige, balanced
- **Green/Gray** - Utility, support-oriented

**Technical Specs**:
- Format: WEBP (optimized for web)
- Master size: 512×512px (scales down cleanly)
- Style: Industrial sci-fi, hard-surface mech rendering
- Angle: 3/4 view (shows depth, recognizable silhouette)
- Background: Dark gradient matching UI theme, subtle grid/hazard pattern
- Lighting: Consistent rim light from top-right

**Responsive Usage**:
- List view: 64×64px thumbnail
- Card view: 128×128px or 256×256px medium
- Detail page header: 512×512px hero

**File Naming**:
```
robot-chassis-humanoid-red.webp
robot-chassis-heavy-tank-blue.webp
robot-chassis-scout-green.webp
```

### Weapon Asset Specifications

**10 Weapons (Current)**:

**Melee Weapons (4)**:
1. **Plasma Blade** - Glowing energy sword, blue plasma trail
2. **Crushing Hammer** - Heavy industrial hammer, hazard stripes
3. **Energy Lance** - Spear-like weapon, yellow energy tip
4. **Shock Gauntlets** - Fist weapons, electric arcs

**Ranged Weapons (4)**:
5. **Laser Rifle** - Sleek energy weapon, green sight laser
6. **Autocannon** - Belt-fed ballistic gun, ammo belt visible
7. **Missile Launcher** - Shoulder-mounted rocket pod, missiles loaded
8. **Railgun** - High-tech magnetic accelerator, glowing coils

**Shields (1)**:
9. **Energy Shield Emitter** - Arm-mounted shield generator, blue energy field

**Two-Handed Weapons (1)**:
10. **Heavy Cannon** - Massive artillery piece, stabilizer legs deployed

--> Is this canonical with the weapons defined in the system?

**Technical Specs**:
- Format: WEBP
- Catalog size: 256×256px (shop grid)
- Thumbnail size: 128×128px (robot detail loadout)
- Style: Consistent lighting, dark background, 3/4 angle
- Background: Matches robot portrait aesthetic
- Lighting: Same rim light as robots (cohesive world lighting)

**File Naming**:
```
weapon-plasma-blade-full.webp      # 256×256px
weapon-plasma-blade-thumb.webp     # 128×128px
weapon-crushing-hammer-full.webp
weapon-laser-rifle-full.webp
```

### Weapon Type Icons (SVG)

**4 Categories**:
- `ic-weapon-melee.svg` - Crossed swords icon
- `ic-weapon-ranged.svg` - Crosshair/targeting icon
- `ic-weapon-shield.svg` - Shield icon
- `ic-weapon-twohanded.svg` - Large weapon icon

**Specs**:
- Format: SVG
- Viewbox: 0 0 24 24 (for 24px base size)
- Style: Line icons, 2px stroke
- Color: Adaptive (primary accent or category color)

### Facility Asset Specifications

**14 Facilities** (all need illustrations):
1. Training Academy
2. Weapons Workshop
3. Armor Plating Bay
4. Propulsion Lab
5. AI Processing Center
6. Sensor Array
7. Energy Reactor
8. Shield Generator
9. Medical Bay
10. Repair Bay
11. Research Lab
12. Roster Expansion
13. Storage Expansion
14. Booking Office

--> Check your namings, this is not correct. In truth we have "Storage Facility" and "Defense Training Academy" for example. 

**Technical Specs**:
- Format: WEBP
- Size: 256×256px square
- Style: Blueprint/isometric industrial buildings
- Color scheme: Blue/gray tech aesthetic
- Background: Dark with subtle grid
- Visual progression: Higher levels = more complex structures (optional detail)

**File Naming**:
```
facility-training-academy.webp
facility-weapons-workshop.webp
facility-armor-plating-bay.webp
```

--> Use real examples

### Attribute Icon Set (23 Icons)

Organized by category with color coding:

**Combat Systems (Red #f85149)** - 7 icons:
- ic-attr-weapon-damage.svg
- ic-attr-melee-damage.svg
- ic-attr-ranged-damage.svg
- ic-attr-crit-chance.svg
- ic-attr-crit-multiplier.svg
- ic-attr-accuracy.svg
- ic-attr-penetration.svg

**Defensive Systems (Blue #58a6ff)** - 5 icons:
- ic-attr-armor.svg
- ic-attr-shield-capacity.svg
- ic-attr-shield-regen.svg
- ic-attr-evasion.svg
- ic-attr-damage-reduction.svg

**Chassis & Mobility (Green #3fb950)** - 5 icons:
- ic-attr-health-integrity.svg
- ic-attr-speed.svg
- ic-attr-agility.svg
- ic-attr-weight-limit.svg
- ic-attr-stability.svg

**AI Processing (Yellow #d29922)** - 3 icons:
- ic-attr-processing-speed.svg
- ic-attr-targeting-priority.svg
- ic-attr-scan-radius.svg

**Team Coordination (Purple #a371f7)** - 3 icons:
- ic-attr-command-range.svg
- ic-attr-support-efficiency.svg
- ic-attr-sync-bonus.svg

--> If you are going to create attritbute icons, at least use the correct naming for the icons. Where did you get these names?

**Specs**:
- Format: SVG
- Viewbox: 0 0 24 24 (24×24px base)
- Style: Simple geometric icons, 2px stroke
- Color: Category-specific (see above)

### Benefit Category Icons (8 Icons)

For facility upgrade benefits:
- ic-benefit-damage.svg
- ic-benefit-defense.svg
- ic-benefit-speed.svg
- ic-benefit-accuracy.svg
- ic-benefit-health.svg
- ic-benefit-income.svg
- ic-benefit-capacity.svg
- ic-benefit-discount.svg

--> Why these? Which benefit which? And where do you want to use them?

**Specs**: Same as attribute icons (24×24px SVG)

### Navigation Icon Set (8 Icons)

- ic-nav-dashboard.svg - Grid/dashboard icon
- ic-nav-robots.svg - Robot head icon
- ic-nav-weapons.svg - Sword/weapon icon
- ic-nav-facilities.svg - Building/factory icon
- ic-nav-battles.svg - Crossed swords icon
- ic-nav-inventory.svg - Backpack/storage icon
- ic-nav-profile.svg - User icon
- ic-nav-settings.svg - Gear icon

**Specs**:
- Format: SVG
- Viewbox: 0 0 24 24
- Style: Line icons, 2px stroke
- States: Default (gray), Active (primary accent), Hover (with glow)

### Loadout Slot Icons

Visual representation of equipment slots:
- slot-main-empty.svg
- slot-main-filled.svg
- slot-offhand-empty.svg
- slot-offhand-filled.svg
- slot-twohanded-empty.svg
- slot-dual-wield-left.svg
- slot-dual-wield-right.svg

**Specs**: SVG, outlined slot plates with hand labels (R/L)

### Status Badges & Overlays

**ELO Rank Badges** (6 tiers):
- Bronze: 1000-1399 ELO (bronze frame, #cd7f32)
- Silver: 1400-1799 ELO (silver frame, #c0c0c0)
- Gold: 1800-2199 ELO (gold frame, #ffd700)
- Platinum: 2200-2599 ELO (platinum frame, #e5e4e2)
- Diamond: 2600+ ELO (diamond frame, #b9f2ff)
- Champion: Top 100 (animated, #ff00ff)

--> We should not confuse ELO with Leagues. A certain ELO does not mean immediate promotion, we use League Points for this. 

**Format**: PNG with transparency (32px, 64px, 128px variants)

**File Naming**:
```
rank-badge-bronze-32.png
rank-badge-silver-64.png
rank-badge-champion-128.png
```

### Empty State Illustrations

**5 Scenarios**:
1. **No Robots** (`empty-no-robots.webp`)
   - Empty hangar, "Build Your First Robot" CTA
   - Used: RobotsPage when 0 robots
   
2. **No Weapons Equipped** (`empty-no-weapons-equipped.webp`)
   - Empty weapon rack, "Equip Weapons to Boost Stats"
   - Used: RobotDetailPage when no weapons equipped
   
3. **No Inventory** (`empty-no-inventory.webp`)
   - Empty storage room, "Visit Weapon Shop" CTA
   - Used: WeaponInventoryPage when 0 weapons owned
   
4. **Facility Locked** (`empty-facility-locked.webp`)
   - Locked facility door, "Upgrade to Unlock"
   - Used: FacilitiesPage for locked facilities (future)
   
5. **No Battles** (`empty-no-battles.webp`)
   - Empty arena, "Your First Battle Awaits"
   - Used: DashboardPage when 0 battles

**Specs**:
- Format: WEBP
- Size: 512×256px (wide format)
- Style: Simple line art with accent color
- Tone: Encouraging, not negative

### Background Assets

**Arena Backgrounds** (3 variants):
- bg-arena-main.webp - General arena environment
- bg-arena-hangar.webp - Robot storage/maintenance area
- bg-arena-grid.webp - Tech grid pattern

**Specs**:
- Format: WEBP
- Size: 1920×1080px minimum (full viewport)
- Usage: Full-screen background at low opacity (10-20%)
- Style: Atmospheric, non-distracting

### UI Frame Elements

**Corner Brackets** (4 corners):
- ui-corner-tl.svg (top-left)
- ui-corner-tr.svg (top-right)
- ui-corner-bl.svg (bottom-left)
- ui-corner-br.svg (bottom-right)

**Section Dividers**:
- ui-divider.svg - Horizontal line with center tech ornament

**Specs**: SVG, subtle sci-fi HUD aesthetic, primary accent color at 20% opacity

### Performance & Optimization Guidelines

**Image Optimization**:
- WEBP compression: Quality 85 (balance size/quality)
- SVG optimization: Run through SVGO tool
- Progressive loading: Use srcset for responsive images
- Lazy loading: Defer off-screen images

**Performance Targets**:
- Total asset payload: <5MB for initial load
- Individual image: <100KB for portraits, <50KB for icons
- Page load time increase: <500ms with full assets

**Browser Support**:
- WEBP fallback to PNG for older browsers
- SVG supported in all modern browsers

**Caching Strategy**:
- Long-term caching for immutable assets (versioned filenames)
- Cache-busting via build tool hash in filename

### Asset Creation Workflow

**For AI Generation**:
1. Create detailed prompts for each asset type
2. Generate multiple variants for selection
3. Optimize output files (WEBP compression, SVGO)
4. Test at multiple sizes/contexts
5. Iterate based on consistency and brand alignment

**Quality Checklist**:
- [ ] Consistent lighting across all robot portraits
- [ ] Same background style for portraits and weapons
- [ ] Color palette matches design system
- [ ] Readable at smallest usage size
- [ ] File size optimized (<100KB for portraits)
- [ ] Alt text provided for accessibility

### Asset Inventory Summary

**Total Assets Required** (Phase 1 MVP):

| Category | Count | Format | Total Size Estimate |
|----------|-------|--------|-------------------|
| Robot Portraits | 48 | WEBP | ~2.4MB (50KB each) |
| Weapon Illustrations | 20 | WEBP | ~1.0MB (50KB each) |
| Facility Illustrations | 14 | WEBP | ~0.7MB (50KB each) |
| Attribute Icons | 23 | SVG | ~46KB (2KB each) |
| Weapon Type Icons | 4 | SVG | ~8KB |
| Benefit Icons | 8 | SVG | ~16KB |
| Navigation Icons | 8 | SVG | ~16KB |
| Loadout Icons | 7 | SVG | ~14KB |
| Silhouettes | 12 | SVG | ~24KB |
| Logos (3 directions) | 3 | SVG | ~9KB |
| Currency Icons | 2 | SVG | ~4KB |
| Empty States | 5 | WEBP | ~0.25MB (50KB each) |
| Rank Badges | 18 | PNG | ~0.36MB (20KB each) |
| UI Frames | 5 | SVG | ~10KB |
| **TOTAL** | **176** | — | **~4.9MB** |

**Note**: Actual payload will be smaller due to lazy loading and progressive image loading. Only assets for current page are loaded initially.

---

## Implementation Priority Matrix

### Priority Levels

- **P0**: Critical for MVP, blocks core gameplay
- **P1**: Important for complete experience, adds polish
- **P2**: Post-MVP, enhances immersion but not blocking
- **P3**: Future enhancements, aspirational

### Asset Implementation Priority

| Asset Category | Priority | Rationale |
|---------------|----------|-----------|
| **Direction B Logo** | P0 | Navigation identity, present on all pages |
| **Robot Portraits (3-5 frames)** | P0 | Core visual identity, eliminates list blindness |
| **HP/Shield Status Bars** | P0 | Critical game state feedback |
| **Weapon Illustrations (10 weapons)** | P0 | Shop/inventory usability |
| **Attribute Icons (23 attributes)** | P1 | Reduces cognitive load on detail page |
| **Weapon Type Icons (4 types)** | P1 | Filtering and categorization |
| **Facility Illustrations (14 facilities)** | P1 | Transforms spreadsheet to game world |
| **Currency Icons (₡ Credits, Prestige)** | P1 | Game world consistency |
| **Navigation Icons** | P1 | UI clarity and consistency |
| **Direction D Logo** | P1 | Login/loading polish |
| **Empty State Illustrations** | P2 | UX polish, not blocking |
| **Direction C Logo** | P2 | Post-MVP, when battle system launches |
| **Arena Backgrounds** | P2 | Battle screen atmosphere |
| **ELO/League Badges** | P2 | Competitive visualization |
| **Frame Type Badges** | P2 | Robot categorization |
| **Achievement Badges** | P3 | Future progression system |

### Page Implementation Priority

| Page | Priority | Readiness for Visual Design |
|------|----------|---------------------------|
| Dashboard | P0 | ✅ Ready - Robot cards need portraits + HP bars |
| Robots Page | P0 | ✅ Ready - Larger portraits + status bars |
| Robot Detail Page | P0 | ✅ Ready - Hero portrait + attribute icons + weapon thumbnails |
| Weapon Shop | P0 | ✅ Ready - Weapon illustrations essential |
| Weapon Inventory | P1 | ✅ Ready - Same weapon illustrations |
| Facilities Page | P1 | ✅ Ready - Facility illustrations transform experience |
| Create Robot | P1 | ✅ Ready - Frame illustrations needed |
| Login/Register | P1 | ✅ Ready - Direction D logo + simple background |
| Battle Preparation | P2 | ⏳ Post-MVP - Needs battle system first |
| Battle Result | P2 | ⏳ Post-MVP - Needs battle system first |
| Leaderboards | P2 | ⏳ Post-MVP - Functional but not urgent |

-> Not correct, all these pages are already present. 

### Development Phases

#### Phase 1: Core Visual Identity (MVP)
**Goal**: Transform text-heavy prototype into visually recognizable game

**Assets Needed**:
- Direction B logo (all sizes)
- Robot portraits (3-5 frame types, standard pose, 256×256px + 512×512px)
- HP/Shield status bars (component)
- Weapon illustrations (10 weapons, 256×256px + 128×128px thumbnails)
- Currency icons (₡ Credits, Prestige)
- Basic navigation icons

**Pages Updated**:
- Dashboard (robot cards with portraits + HP bars)
- Robots Page (larger portraits + HP bars)
- Robot Detail Page (hero portrait + weapon thumbnails)
- Weapon Shop (weapon illustrations)
- Weapon Inventory (weapon illustrations)

**Success Metric**: Players can identify robots and weapons visually without reading text

#### Phase 2: Polish & Expansion (Post-MVP)
**Goal**: Add depth, reduce cognitive load, improve atmosphere

**Assets Needed**:
- Attribute icons (23 attributes, 24×24px SVG)
- Weapon type icons (4 types, 32×32px SVG)
- Facility illustrations (14 facilities, 256×256px)
- Frame type badges (per frame, 48×48px)
- Action icons (view, edit, delete, etc.)
- Direction D logo (login, loading)
- Empty state illustrations

**Pages Updated**:
- Robot Detail Page (attribute icons)
- Facilities Page (facility illustrations)
- Weapon Shop (type icons for filtering)
- Create Robot (frame illustrations)
- Login/Register (Direction D logo)
- All pages (empty states)

**Success Metric**: UI feels like a complete game, not a prototype

#### Phase 3: Battle & Competition (Future)
**Goal**: Emotional peaks and competitive visualization

**Assets Needed**:
- Direction C logo (energized, battle state)
- Robot battle-ready poses
- Arena backgrounds
- ELO/League badges
- Achievement badges (expandable)
- Victory/defeat visuals

**Pages Updated**:
- Battle Preparation (logo transition B → C, battle pose)
- Battle Result (logo C, result visuals)
- Leaderboards (ELO badges, trophies)

**Success Metric**: Players feel emotional peaks during battles

---

## Design System Checklist

Use this checklist to ensure all design work aligns with brand strategy:

### Brand Alignment Check
- [ ] Does this reinforce **mastery, pride, and ownership**?
- [ ] Does this avoid **whimsy, chaos, anime expressiveness**?
- [ ] Does this use **appropriate logo state** (B, C, or D)?
- [ ] Does this feel **engineered and deliberate**, not accidental?

### Visual Consistency Check
- [ ] Does this use **color palette** from Design System?
- [ ] Does this use **typography hierarchy** correctly?
- [ ] Does this use **appropriate material** (metallic, panel, button)?
- [ ] Does this follow **component pattern** established?

### Motion Check
- [ ] Does motion **respond to user action** or **system state**?
- [ ] Is motion **contained and deliberate**, not explosive?
- [ ] Does motion **settle quickly** to avoid distraction?
- [ ] Does motion respect **`prefers-reduced-motion`**?

### User Experience Check
- [ ] Does this **reduce cognitive load** or add to it?
- [ ] Does this **speed up recognition** or slow it down?
- [ ] Does this feel like **a game** or **a spreadsheet**?
- [ ] Does this **guide the user** or confuse them?

### Performance Check
- [ ] Are images **optimized** (WebP, appropriate sizes)?
- [ ] Are SVGs **used for icons** (scalable, small file size)?
- [ ] Are backgrounds **non-intrusive** (low opacity, tiled patterns)?
- [ ] Is page load time **minimal** (<500ms increase with assets)?

---

## Next Steps

### For Designers/Artists

1. **Review this document thoroughly** - Understand brand strategy and emotional targets
2. **Start with P0 assets** - Robot portraits, weapon illustrations, Direction B logo
3. **Follow specifications exactly** - Sizes, formats, color palettes
4. **Use brand alignment checklist** - Verify all work reinforces mastery/pride
5. **Deliver assets in batches** - Priority order (P0 → P1 → P2)

### For Frontend Developers

1. **Implement component patterns** - Card, modal, status bar, button
2. **Apply color/material system** - Use palette, avoid arbitrary colors
3. **Integrate logo states** - Direction B in navigation, C for battles (future), D for login
4. **Add motion sparingly** - Follow motion rules, respect reduced-motion
5. **Test with assets** - Replace placeholder text with actual visual assets

### For Product Owner

1. **Prioritize asset production** - Focus on P0 assets first
2. **Review implementation against guide** - Use checklists to verify alignment
3. **Gather user feedback** - Test if visuals reduce cognitive load
4. **Iterate based on metrics** - Recognition speed, user satisfaction

---

## Conclusion

This Design System & UX Guide provides a comprehensive, actionable reference for implementing Armoured Souls' visual identity. By following these specifications, we ensure:

- **Brand Consistency**: All visual work reinforces mastery, pride, and ownership
- **User Experience**: Reduced cognitive load, faster recognition, game-like immersion
- **Implementation Clarity**: Clear priorities, specifications, and patterns
- **Quality Assurance**: Checklists and alignment checks for every decision

**The game's visual design must feel deliberate, engineered, and serious — never accidental or frivolous.**

---

## Document Maintenance

**Owner**: Design Team / Product Owner  
**Review Frequency**: After each major feature release or visual asset batch  
**Update Triggers**: New pages, new game entities, brand evolution decisions

**Version History**:
- v1.0 (February 1, 2026) - Initial comprehensive guide consolidating all design documentation
