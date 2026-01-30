# Product Requirements Document: Visual Asset System

**Last Updated**: January 30, 2026  
**Status**: Ready for Implementation  
**Owner**: Robert Teunissen  
**Epic**: Image & Visual Asset Implementation

---

## Executive Summary

This PRD defines the requirements for implementing a comprehensive visual asset system for Armoured Souls Phase 1 prototype. The system will transform the current text-heavy interface into an engaging, visually-rich game experience through strategic use of robot portraits, weapon thumbnails, facility illustrations, attribute icons, and brand assets.

**Success Criteria**: Users can instantly recognize robots, weapons, and facilities through visual identity; reduce cognitive load by 60%+ through icon language; transform browsing experience from "reading lists" to "scanning cards" in under 2 seconds per item.

**Impact**: Convert Armoured Souls from a spreadsheet-like interface to an immersive sci-fi battle arena environment that feels like a complete game world.

---

## Background & Context

### Current State

**What Exists:**
- ✅ Complete functional prototype with working game mechanics
- ✅ All pages implemented: RobotsPage, AllRobotsPage, DashboardPage, RobotDetailPage, WeaponShopPage, FacilitiesPage
- ✅ 23 robot attributes fully defined and functional
- ✅ 10 weapons across 4 categories (Melee Weapons, Ranged Weapons, Shields, Two-Handed Weapons)
- ✅ 14 facility types with 10 upgrade levels each
- ✅ Loadout system (single, weapon+shield, two-handed, dual-wield)
- ✅ Combat simulation engine
- ✅ Tailwind CSS styling with dark theme aesthetic

**What's Missing:**
- ❌ No visual identity for robots (all look identical in lists)
- ❌ No weapon thumbnails or icons (users read descriptions to understand weapons)
- ❌ No facility illustrations (upgrade page feels like a spreadsheet)
- ❌ No attribute icon set (repeated text labels create visual noise)
- ❌ No background imagery or arena atmosphere
- ❌ No empty state illustrations (missing content feels broken, not intentional)
- ❌ No brand identity (logo, currency icon, navigation icons)
- ❌ No consistent visual language across UI

### Design References

- **[ROBOT_ATTRIBUTES.md](ROBOT_ATTRIBUTES.md)**: Complete robot attribute system (23 attributes)
- **[WEAPONS_AND_LOADOUT.md](WEAPONS_AND_LOADOUT.md)**: Weapon specifications and categories
- **[STABLE_SYSTEM.md](STABLE_SYSTEM.md)**: 14 facility types with upgrade benefits
- **[GAME_DESIGN.md](GAME_DESIGN.md)**: Core game concept and battle mechanics
- **[ARCHITECTURE.md](ARCHITECTURE.md)**: Technical stack and project structure

### User Pain Points

1. **List Blindness**: Users struggle to differentiate robots in lists - all look identical
2. **Decision Fatigue**: Weapon shop requires reading full descriptions to compare items
3. **Spreadsheet Feel**: Facilities page feels like Excel, not a game
4. **Cognitive Overload**: 23 attributes shown as repeated text labels
5. **Lack of Polish**: Empty states and placeholders feel unfinished
6. **Missing Identity**: No cohesive visual brand or game world atmosphere

---

## Goals & Objectives

### Primary Goals

1. **Visual Identity**: Give every robot, weapon, and facility a unique, recognizable visual representation
2. **Reduce Cognitive Load**: Replace text-heavy interfaces with scannable visual elements
3. **Game World Immersion**: Transform UI from "web application" to "sci-fi battle arena"
4. **Consistent Design Language**: Establish a cohesive visual style across all pages
5. **Performance Optimization**: Deliver visual assets with minimal impact on load times

### Success Metrics

- **Recognition Speed**: Users identify robots/weapons in <2 seconds (vs current 5-10 seconds of reading)
- **Visual Consistency**: 100% of UI elements follow established art direction
- **Performance**: Page load time increase <500ms with full assets
- **Asset Coverage**: 100% of game entities have visual representation
- **User Satisfaction**: Qualitative feedback shows "feels like a real game" vs "looks like a prototype"

### Non-Goals (Out of Scope for This PRD)

- ❌ Animated sprites or real-time 3D rendering
- ❌ Character creation/customization UI (future phase)
- ❌ Video content (battle replays as video)
- ❌ Audio assets (sound effects, music)
- ❌ Dynamic procedural generation of art assets
- ❌ User-generated content (custom paint jobs, decals)

---

## Image Categories & Specifications

### 1. Robot Identity Assets

**Purpose**: Make robot lists scannable, provide instant visual differentiation, show status at a glance.

**Where Used**: RobotsPage, AllRobotsPage, DashboardPage, RobotDetailPage

#### 1.1 Robot Portraits (Primary Visual)

**Specifications:**
- **Format**: WEBP (optimized for web, small file size)
- **Size**: 512×512px (square, scales down cleanly)
- **Style**: Industrial sci-fi, hard-surface mech rendering
- **Angle**: 3/4 view (shows depth, recognizable silhouette)
- **Background**: Dark gradient (matches UI theme), subtle grid or hazard pattern
- **Lighting**: Consistent rim light (from top-right)

**Content Requirements:**
- **12 Base Chassis Archetypes**: 
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

- **Colorway Variants**: Each chassis × 4 color schemes = 48 total portraits
  - Primary: Red/black (aggressive)
  - Secondary: Blue/silver (defensive)
  - Tertiary: Gold/bronze (prestige)
  - Quaternary: Green/gray (balanced)

**Usage:**
- List view: 64×64px thumbnail
- Card view: 128×128px medium
- Detail page: 256×256px large
- Header/hero: 512×512px full-size

**File Naming Convention:**
```
frontend/src/assets/robots/robot_chassis_{type}_{colorway}.webp

Examples:
robot_chassis_humanoid_red.webp
robot_chassis_heavy_tank_blue.webp
robot_chassis_scout_silver.webp
```

#### 1.2 Robot Silhouettes (Fallback)

**Specifications:**
- **Format**: SVG (scalable, tiny payload)
- **Style**: Minimal outlines, single color (#3b82f6 - blue-500)
- **Size**: Viewbox 0 0 100 100 (scales infinitely)
- **Usage**: Shown when portrait not available yet

**File Naming Convention:**
```
frontend/src/assets/icons/silhouette_chassis_{type}.svg
```

#### 1.3 Status Overlay Badges

**ELO Rank Badges**: Visual frames overlaid on portraits
- **Bronze**: 1000-1399 ELO (bronze frame, #cd7f32)
- **Silver**: 1400-1799 ELO (silver frame, #c0c0c0)
- **Gold**: 1800-2199 ELO (gold frame, #ffd700)
- **Platinum**: 2200-2599 ELO (platinum frame, #e5e4e2)
- **Diamond**: 2600+ ELO (diamond frame, #b9f2ff)
- **Champion**: Top 100 (animated champion frame, #ff00ff)

**Format**: PNG with transparency (32px, 64px, 128px variants)

**File Naming:**
```
frontend/src/assets/badges/rank_badge_{tier}_{size}.png
```

**Damage State Indicators**: Color overlays for health
- Healthy (100-75% HP): No overlay
- Damaged (74-40% HP): Yellow warning overlay (opacity 20%)
- Critical (39-1% HP): Red critical overlay (opacity 40%)
- Destroyed (0% HP): Grayscale with red X

**Implementation**: CSS filters applied dynamically based on currentHP

---

### 2. Weapon Assets

**Purpose**: Stop users from reading descriptions; make weapon shop browseable; show loadout configuration visually.

**Where Used**: WeaponShopPage, RobotDetailPage (loadout section), WeaponInventoryPage

#### 2.1 Weapon Thumbnails

**Specifications:**
- **Format**: WEBP
- **Size**: 512×512px (square for consistent grid layout)
- **Style**: Consistent lighting, dark background, 3/4 angle
- **Background**: Matching robot portrait background (cohesive aesthetic)
- **Lighting**: Same rim light as robots (consistent world lighting)

**Content Requirements:** 10 weapons + future expansion

**Melee Weapons (4):**
1. **Plasma Blade** - Glowing energy sword, blue plasma trail
2. **Crushing Hammer** - Heavy industrial hammer, hazard stripes
3. **Energy Lance** - Spear-like weapon, yellow energy tip
4. **Shock Gauntlets** - Fist weapons, electric arcs

**Ranged Weapons (4):**
5. **Laser Rifle** - Sleek energy weapon, green sight laser
6. **Autocannon** - Belt-fed ballistic gun, ammo belt visible
7. **Missile Launcher** - Shoulder-mounted rocket pod, missiles loaded
8. **Railgun** - High-tech magnetic accelerator, glowing coils

**Shields (1):**
9. **Energy Shield Emitter** - Arm-mounted shield generator, blue energy field

**Two-Handed Weapons (1):**
10. **Heavy Cannon** - Massive artillery piece, stabilizer legs deployed

**File Naming Convention:**
```
frontend/src/assets/weapons/weapon_{name}_thumb.webp

Examples:
weapon_plasma_blade_thumb.webp
weapon_crushing_hammer_thumb.webp
weapon_laser_rifle_thumb.webp
```

#### 2.2 Weapon Type Icons (SVG)

**Purpose**: Quick recognition of weapon category without reading.

**Specifications:**
- **Format**: SVG
- **Viewbox**: 0 0 24 24 (for 24px base size)
- **Style**: Line icons, 2px stroke, #3b82f6 (blue-500) color
- **Usage**: Shop filters, loadout slot indicators, stat bonus tags

**Icon Set:**
- `ic_weapon_melee.svg` - Crossed swords icon
- `ic_weapon_ranged.svg` - Crosshair/targeting icon
- `ic_weapon_shield.svg` - Shield icon
- `ic_weapon_twohanded.svg` - Large weapon icon

**File Location:**
```
frontend/src/assets/icons/ic_weapon_{type}.svg
```

#### 2.3 Loadout Slot Art

**Purpose**: Visual slots showing "main hand", "off hand", empty slots.

**Specifications:**
- **Format**: SVG
- **Style**: Outlined slot plates with "R" (right hand) or "L" (left hand) labels
- **States**: Empty (dotted outline), Filled (solid outline)

**Slot Types:**
- **Main Weapon Slot**: Large slot on right side
- **Offhand Slot**: Medium slot on left side
- **Two-Handed Slot**: Full-width slot spanning both hands
- **Empty Slot Placeholder**: "+" icon, "Equip Weapon" label

**File Naming:**
```
frontend/src/assets/icons/slot_{type}_{state}.svg

Examples:
slot_main_empty.svg
slot_main_filled.svg
slot_offhand_empty.svg
slot_twohanded_empty.svg
```

#### 2.4 Rarity/Quality Frames (Future-Proof)

**Purpose**: Visual distinction for weapon tiers (even if all weapons same rarity now).

**Specifications:**
- **Format**: PNG with transparency or SVG
- **Sizes**: 64px, 128px, 256px, 512px
- **Tiers**: Common (gray), Uncommon (green), Rare (blue), Epic (purple), Legendary (orange)

**Implementation Note**: All weapons currently "common" tier, but frames implemented now for easy expansion later.

**File Naming:**
```
frontend/src/assets/frames/frame_{rarity}_{size}.png
```

---

### 3. Facility Assets

**Purpose**: Transform upgrade page from spreadsheet to tech tree; make facilities feel substantial and meaningful.

**Where Used**: FacilitiesPage

#### 3.1 Facility Card Art

**Specifications:**
- **Format**: WEBP
- **Size**: 1024×576px (16:9 wide format for card headers)
- **Style**: Industrial sci-fi interior scenes, worn metal aesthetic
- **Lighting**: Consistent overhead lighting, blue accent lights
- **Composition**: Wide shot showing facility interior/exterior

**Content Requirements:** 14 facility types from STABLE_SYSTEM.md

**Facility Illustrations:**

1. **Weapon Workshop** - Factory floor with weapon assembly lines, sparks flying
2. **Targeting Lab** - High-tech control room with targeting computers, holographic displays
3. **Armor Forge** - Industrial forge with glowing metal, hydraulic presses
4. **Shield Reactor Bay** - Energy reactors with blue shield generators, electrical arcs
5. **Drone Hangar** - Open hangar with maintenance drones, conveyor systems
6. **Combat Algorithms Center** - Server room with glowing processors, AI core
7. **Hydraulics Bay** - Mechanical workshop with large pistons and hydraulic systems
8. **Power Plant** - Energy generators, glowing power cores, cable management
9. **Training Arena** - Combat simulation room with holographic targets
10. **Medical Bay** - Repair station with robotic arms, diagnostic screens
11. **R&D Laboratory** - Research facility with prototype equipment, blueprints
12. **Storage Facility** - Warehouse interior with weapon racks, organized storage
13. **Command Center** - Strategic planning room with large displays, tactical maps
14. **Prestige Hall** - Trophy room with achievements, championship banners

**File Naming Convention:**
```
frontend/src/assets/facilities/facility_{name}.webp

Examples:
facility_weapon_workshop.webp
facility_targeting_lab.webp
facility_armor_forge.webp
```

**Display Usage:**
- Card header: Full image 1024×576px
- Thumbnail: 256×144px (16:9 maintained)
- Background: Subtle overlay behind facility stats

#### 3.2 Benefit Category Icons (SVG)

**Purpose**: Visual tags for facility upgrade benefits.

**Specifications:**
- **Format**: SVG
- **Viewbox**: 0 0 24 24
- **Style**: Solid icons, single color (#10b981 - green-500 for positive buffs)

**Icon Set:**
- `ic_benefit_damage.svg` - Sword with up arrow
- `ic_benefit_defense.svg` - Shield with up arrow
- `ic_benefit_speed.svg` - Lightning bolt
- `ic_benefit_accuracy.svg` - Crosshair/bullseye
- `ic_benefit_crit.svg` - Star burst
- `ic_benefit_armor.svg` - Armor plate
- `ic_benefit_evasion.svg` - Dodge/sidestep icon
- `ic_benefit_discount.svg` - Coin with percentage

**File Location:**
```
frontend/src/assets/icons/ic_benefit_{type}.svg
```

#### 3.3 Upgrade Level Indicators

**Purpose**: Visual representation of facility level (0-10).

**Specifications:**
- **Implementation**: CSS-based level bar (no image files needed)
- **Style**: Horizontal progress bar with 10 segments
- **Colors**: 
  - Empty: #374151 (gray-700)
  - Filled: #3b82f6 (blue-500)
  - Max Level: #10b981 (green-500)

**Visual Design:**
```
Level 3/10: [███·······] 30%
Level 10/10: [██████████] MAX
```

**Alternative**: Star rating system (10 stars, filled/unfilled)

---

### 4. Attribute Icon Set

**Purpose**: Replace text labels with recognizable icons; create consistent visual language for 23 attributes.

**Where Used**: RobotDetailPage (attribute display), WeaponShopPage (bonus indicators), stat comparisons

#### 4.1 Core Attribute Icons (23 Icons)

**Specifications:**
- **Format**: SVG
- **Viewbox**: 0 0 24 24 (base 24px, scales to 32px, 48px)
- **Style**: Line icons, 2px stroke, themed colors by category
- **Colors**:
  - Combat Systems: #ef4444 (red-500)
  - Defensive Systems: #3b82f6 (blue-500)
  - Chassis & Mobility: #10b981 (green-500)
  - AI Processing: #f59e0b (amber-500)
  - Team Coordination: #8b5cf6 (violet-500)

**Icon Set (mapped to ROBOT_ATTRIBUTES.md):**

**🔴 Combat Systems (6 icons, red):**
1. `ic_attr_combat_power.svg` - Fist icon
2. `ic_attr_targeting.svg` - Crosshair icon
3. `ic_attr_critical.svg` - Star burst
4. `ic_attr_penetration.svg` - Arrow through shield
5. `ic_attr_weapon_control.svg` - Hand holding weapon
6. `ic_attr_attack_speed.svg` - Double arrow forward

**🔵 Defensive Systems (5 icons, blue):**
7. `ic_attr_armor.svg` - Shield plate icon
8. `ic_attr_shield_cap.svg` - Energy shield icon
9. `ic_attr_evasion.svg` - Sidestep/dodge icon
10. `ic_attr_dampeners.svg` - Absorption icon
11. `ic_attr_counter.svg` - Counter-punch icon

**🟢 Chassis & Mobility (5 icons, green):**
12. `ic_attr_hull.svg` - Robot torso icon
13. `ic_attr_servo.svg` - Leg/movement icon
14. `ic_attr_gyro.svg` - Balance/stabilizer icon
15. `ic_attr_hydraulic.svg` - Piston icon
16. `ic_attr_power.svg` - Battery/energy icon

**🟡 AI Processing (4 icons, amber):**
17. `ic_attr_algorithms.svg` - Brain/chip icon
18. `ic_attr_threat.svg` - Radar/scan icon
19. `ic_attr_adaptive.svg` - Learning curve icon
20. `ic_attr_logic.svg` - Circuit board icon

**🟣 Team Coordination (3 icons, violet):**
21. `ic_attr_sync.svg` - Connected nodes icon
22. `ic_attr_support.svg` - Heart/buff icon
23. `ic_attr_formation.svg` - Grid formation icon

**File Naming Convention:**
```
frontend/src/assets/icons/ic_attr_{attribute_name}.svg

Examples:
ic_attr_combat_power.svg
ic_attr_targeting.svg
ic_attr_hull.svg
```

#### 4.2 Category Section Headers (Optional Mini-Illustrations)

**Purpose**: Visual dividers for attribute groups on robot detail page.

**Specifications:**
- **Format**: SVG
- **Size**: Wide banner format (400×80px viewbox)
- **Style**: Simple geometric dividers with category icon

**Usage:**
```
=== Combat Systems ========= (with red sword icon)
[Attribute icons and values here]

=== Defensive Systems ===== (with blue shield icon)
[Attribute icons and values here]
```

**Implementation**: Can be CSS-based dividers with inline icons instead of separate images.

---

### 5. Battle Arena & Atmosphere Assets

**Purpose**: Make the app feel like a game world, not a CRUD interface; provide context and immersion.

**Where Used**: DashboardPage (background), Empty states, Loading screens

#### 5.1 Arena Background Plates

**Specifications:**
- **Format**: WEBP
- **Size**: 1920×1080px (standard HD, cropped for viewport)
- **Style**: Subtle, dark sci-fi textures (won't distract from content)
- **Opacity**: Used at 10-30% opacity as subtle background
- **Content**: Industrial arena interiors, metal grating, hazard stripes

**Background Variants:**
1. **Arena Main** - Central battle arena, overhead lighting
2. **Hangar Bay** - Industrial hangar with robots in background
3. **Tech Grid** - Abstract digital grid with scanlines
4. **Maintenance Deck** - Workshop floor with tools and equipment

**File Naming:**
```
frontend/src/assets/backgrounds/bg_arena_{variant}.webp

Examples:
bg_arena_main.webp
bg_arena_hangar.webp
bg_arena_grid.webp
```

**Usage:**
- DashboardPage: `bg_arena_main.webp` at 20% opacity
- RobotsPage: `bg_arena_hangar.webp` at 15% opacity
- FacilitiesPage: `bg_arena_grid.webp` at 10% opacity

#### 5.2 Empty State Illustrations

**Purpose**: Transform "no content" states from feeling broken to feeling intentional and branded.

**Specifications:**
- **Format**: WEBP
- **Size**: 512×256px (wide format, smaller than hero images)
- **Style**: Simple line art with blue accent color, transparent background
- **Tone**: Encouraging, not negative ("Start your journey" vs "No data found")

**Empty State Scenes:**

1. **No Robots Yet** - Empty robot hangar, "Build Your First Robot" CTA
   - File: `empty_no_robots.webp`
   - Used on: RobotsPage when user has 0 robots

2. **No Weapons Equipped** - Empty weapon rack, "Equip Weapons to Boost Stats" hint
   - File: `empty_no_weapons.webp`
   - Used on: RobotDetailPage when no weapons equipped

3. **No Weapons in Inventory** - Empty storage room, "Visit Weapon Shop" CTA
   - File: `empty_no_inventory.webp`
   - Used on: WeaponInventoryPage when 0 weapons owned

4. **Facility Locked** - Locked facility door, "Upgrade to Unlock" text
   - File: `empty_facility_locked.webp`
   - Used on: FacilitiesPage for facilities not yet unlocked (future)

5. **No Battle History** - Empty arena, "Your First Battle Awaits" motivational text
   - File: `empty_no_battles.webp`
   - Used on: DashboardPage when user has 0 battles

**File Naming:**
```
frontend/src/assets/empty/empty_{state}.webp
```

#### 5.3 Loading Illustrations/Placeholders

**Purpose**: Branded loading experience, not generic spinners.

**Specifications:**
- **Format**: SVG (animated) or WEBP + CSS animation
- **Style**: HUD scanline effect, tech aesthetic
- **Animation**: Subtle pulse or scanline sweep

**Loading States:**
1. **General Loader** - Rotating gear icon with "Loading..." text
2. **Battle Processing** - "Battle Simulation in Progress..." with progress bar
3. **Skeleton Screen** - Card layout placeholders for robot/weapon lists

**File Naming:**
```
frontend/src/assets/loaders/loader_{type}.svg
```

---

### 6. Brand Identity Kit

**Purpose**: Establish cohesive visual identity; make UI feel professional and polished.

**Where Used**: LoginPage, Navigation, Global header/footer, All pages

#### 6.1 App Logo

**Specifications:**
- **Format**: SVG (primary), PNG 512px (social media fallback)
- **Variants**:
  - Full logo with wordmark (horizontal layout)
  - Icon-only mark (square)
  - White version (for dark backgrounds)
  - Single-color version (for monochrome usage)

**Logo Design Brief:**
- **Style**: Industrial, mechanical, bold
- **Elements**: Robot silhouette or gear/cog integrated with text
- **Colors**: Primary #3b82f6 (blue-500), Accent #10b981 (green-500)
- **Typography**: Bold, sans-serif, tech-inspired font

**File Naming:**
```
frontend/src/assets/brand/logo_full.svg          # Full wordmark
frontend/src/assets/brand/logo_icon.svg          # Icon only
frontend/src/assets/brand/logo_white.svg         # White version
frontend/src/assets/brand/logo_monochrome.svg    # Single color
frontend/src/assets/brand/logo_512.png           # PNG fallback
```

**Usage:**
- Navigation header: `logo_icon.svg` at 32px
- Login page: `logo_full.svg` at 256px width
- Favicon: `logo_icon.svg` converted to .ico

#### 6.2 Currency Icon

**Specifications:**
- **Format**: SVG
- **Size**: 16px, 24px, 32px viewbox variants
- **Style**: Coin icon with "₡" symbol or custom emblem
- **Color**: #fbbf24 (amber-400, gold-like)

**File Naming:**
```
frontend/src/assets/brand/currency_icon.svg
```

**Usage:**
- Next to all currency amounts: "₡ 2,000,000"
- Weapon shop prices: Large currency icon for emphasis
- Transaction confirmations: Animated coin icon

#### 6.3 Navigation Icon Set

**Purpose**: Consistent icons for main navigation menu.

**Specifications:**
- **Format**: SVG
- **Viewbox**: 0 0 24 24
- **Style**: Line icons, 2px stroke
- **States**: Default (gray), Active (blue), Hover (blue with glow)

**Icon Set:**
1. `ic_nav_dashboard.svg` - Grid/dashboard icon
2. `ic_nav_robots.svg` - Robot head icon
3. `ic_nav_weapons.svg` - Sword/weapon icon
4. `ic_nav_facilities.svg` - Building/factory icon
5. `ic_nav_battles.svg` - Crossed swords icon
6. `ic_nav_inventory.svg` - Backpack/storage icon
7. `ic_nav_profile.svg` - User icon
8. `ic_nav_settings.svg` - Gear icon

**File Naming:**
```
frontend/src/assets/icons/ic_nav_{page}.svg
```

#### 6.4 UI Frame Elements

**Purpose**: Add subtle "HUD corners" and dividers for sci-fi aesthetic.

**Specifications:**
- **Format**: SVG or PNG with transparency
- **Style**: Corner brackets, panel dividers, tech borders
- **Color**: #3b82f6 with 20% opacity (subtle accent)

**UI Elements:**
1. **Corner Brackets** - 4 corner SVGs (top-left, top-right, bottom-left, bottom-right)
2. **Section Dividers** - Horizontal line with center tech ornament
3. **Panel Frames** - Border elements for card containers

**File Naming:**
```
frontend/src/assets/brand/ui_corner_tl.svg       # Top-left
frontend/src/assets/brand/ui_corner_tr.svg       # Top-right
frontend/src/assets/brand/ui_corner_bl.svg       # Bottom-left
frontend/src/assets/brand/ui_corner_br.svg       # Bottom-right
frontend/src/assets/brand/ui_divider.svg         # Horizontal divider
```

**Usage:**
- Robot detail cards: Corner brackets at all 4 corners
- Section headers: Divider after heading text
- Modal dialogs: Frame around modal content

---

## Technical Specifications

### Asset Directory Structure

```
prototype/
└── frontend/
    └── src/
        └── assets/
            ├── brand/              # Logo, currency, UI frames
            │   ├── logo_full.svg
            │   ├── logo_icon.svg
            │   ├── currency_icon.svg
            │   └── ui_*.svg
            ├── icons/              # All SVG icons
            │   ├── ic_attr_*.svg       # 23 attribute icons
            │   ├── ic_benefit_*.svg    # 8 benefit icons
            │   ├── ic_nav_*.svg        # 8 navigation icons
            │   ├── ic_weapon_*.svg     # 4 weapon type icons
            │   ├── silhouette_*.svg    # 12 chassis silhouettes
            │   └── slot_*.svg          # Loadout slot plates
            ├── backgrounds/        # Arena atmosphere
            │   ├── bg_arena_main.webp
            │   ├── bg_arena_hangar.webp
            │   └── bg_arena_grid.webp
            ├── robots/             # Robot portraits
            │   ├── robot_chassis_humanoid_red.webp
            │   ├── robot_chassis_humanoid_blue.webp
            │   └── ... (48 total)
            ├── weapons/            # Weapon thumbnails
            │   ├── weapon_plasma_blade_thumb.webp
            │   ├── weapon_crushing_hammer_thumb.webp
            │   └── ... (10 total)
            ├── facilities/         # Facility illustrations
            │   ├── facility_weapon_workshop.webp
            │   ├── facility_targeting_lab.webp
            │   └── ... (14 total)
            ├── badges/             # Rank badges, overlays
            │   ├── rank_badge_bronze_64.png
            │   ├── rank_badge_silver_64.png
            │   └── ... (6 tiers × 3 sizes)
            ├── frames/             # Rarity frames (future)
            │   ├── frame_common_128.png
            │   └── ... (5 tiers × 4 sizes)
            ├── empty/              # Empty state illustrations
            │   ├── empty_no_robots.webp
            │   ├── empty_no_weapons.webp
            │   └── ... (5 total)
            └── loaders/            # Loading animations
                ├── loader_general.svg
                └── loader_battle.svg
```

### File Format Guidelines

| Asset Type | Format | Size | Rationale |
|------------|--------|------|-----------|
| Robot Portraits | WEBP | 512×512px | Small file size, high quality, broad support |
| Weapon Thumbnails | WEBP | 512×512px | Consistency with robot portraits |
| Facility Cards | WEBP | 1024×576px | Wide format for card headers |
| Backgrounds | WEBP | 1920×1080px | HD standard, used at low opacity |
| Empty States | WEBP | 512×256px | Smaller, decorative purpose |
| All Icons | SVG | Viewbox-based | Infinite scalability, tiny payload |
| Silhouettes | SVG | 100×100 viewbox | Fallback images, minimal data |
| Badges/Overlays | PNG (transparency) | 32/64/128px | Requires transparency, simple shapes |
| Logo | SVG + PNG 512px | Vector + raster | SVG primary, PNG for social media |

### Naming Conventions

**Rules:**
- **All lowercase**: No uppercase letters in filenames
- **Underscores**: Use `_` for word separation (not hyphens or spaces)
- **Prefixes**: Consistent prefixes for categorization
  - `ic_` - Icons (SVG)
  - `robot_chassis_` - Robot portraits
  - `weapon_` - Weapon thumbnails
  - `facility_` - Facility illustrations
  - `bg_` - Background images
  - `empty_` - Empty state illustrations
  - `rank_badge_` - Status badges
  - `frame_` - Rarity frames
  - `logo_` - Logo variants
  - `ui_` - UI frame elements
  - `loader_` - Loading animations

**Examples:**
```
✅ Good:
- ic_attr_combat_power.svg
- robot_chassis_humanoid_red.webp
- facility_weapon_workshop.webp
- empty_no_robots.webp

❌ Bad:
- CombatPowerIcon.svg          # Uppercase, no prefix
- robot-portrait-red.webp      # Hyphens instead of underscores
- weaponWorkshopFacility.webp  # camelCase, inconsistent naming
- NoRobots.webp                # Missing prefix and context
```

### Performance Optimization

#### Image Optimization Requirements

1. **WEBP Compression**:
   - Quality: 85% (balance between quality and file size)
   - Target: <100KB per 512×512 portrait
   - Target: <200KB per 1024×576 facility card
   - Tool: `cwebp` command-line tool or online converters

2. **SVG Optimization**:
   - Minify SVGs using SVGO
   - Remove unnecessary metadata
   - Target: <5KB per icon
   - Keep viewBox for proper scaling

3. **Lazy Loading**:
   - Implement lazy loading for all images except above-the-fold content
   - Use native `loading="lazy"` attribute
   - Priority: Load navigation icons, logo first; defer backgrounds, badges

4. **Responsive Images**:
   - Use `srcset` for multi-size assets (robot portraits, badges)
   - Example: `srcset="robot_64.webp 64w, robot_128.webp 128w, robot_256.webp 256w"`
   - Let browser choose optimal size based on viewport

5. **Caching Strategy**:
   - Set aggressive caching headers for static assets (1 year)
   - Use versioned filenames or cache-busting for updates
   - CDN recommended for production (future phase)

#### Load Time Budget

**Target Performance:**
- Initial page load with assets: <3 seconds on 3G
- Asset download overhead: <500ms vs text-only version
- Largest Contentful Paint (LCP): <2.5 seconds

**Asset Load Priority:**
1. Critical (immediate load): Logo, navigation icons, UI frames
2. High (above fold): Robot portraits in lists, weapon thumbnails
3. Medium (visible on scroll): Facility cards, backgrounds
4. Low (deferred): Empty states, badges, decorative elements

---

## Art Direction & Style Guide

### Visual Consistency Requirements

**All assets MUST follow these guidelines to maintain cohesive look:**

#### Style Direction: Industrial Sci-Fi / Mech Arena

**Core Aesthetic:**
- Hard-surface modeling (clean edges, mechanical details)
- Worn metal textures (not pristine, shows use)
- Hazard stripes and industrial markings (yellow/black warning patterns)
- HUD overlays (subtle digital UI elements in images)
- Dark color palette with bright accent lights

**Color Palette:**
- **Base**: Dark grays (#1f2937 to #374151)
- **Accent 1**: Electric blue (#3b82f6) - tech, energy
- **Accent 2**: Warning yellow (#fbbf24) - hazards, alerts
- **Accent 3**: Success green (#10b981) - positive indicators
- **Accent 4**: Danger red (#ef4444) - critical, damage

**Lighting Setup (Consistent Across All Assets):**
- **Primary Light**: Top-right, 45-degree angle (simulates overhead arena lights)
- **Rim Light**: Blue-tinted edge lighting (separates subject from background)
- **Fill Light**: Subtle ambient bounce (prevents pure black shadows)
- **Consistency**: All robots, weapons, facilities use SAME lighting setup

**Background Treatment:**
- **Robot Portraits**: Dark gradient (top-to-bottom, dark blue to black) + subtle grid
- **Weapon Thumbnails**: Same as robot portraits (consistency)
- **Facilities**: Contextual backgrounds (interior scenes) but same lighting
- **Icons**: Transparent background (no background color)

**Camera Angle (3D Assets):**
- **Robots**: 3/4 view (shows depth, recognizable from front)
- **Weapons**: 3/4 view (shows weapon profile and detail)
- **Facilities**: Wide shot (shows full scene, not extreme close-up)

### Art Creation Workflow

#### Option A: AI-Generated Assets (Fastest, Recommended for Prototype)

**Tools:**
- Midjourney, DALL-E 3, Stable Diffusion
- Consistency: Use same prompt template + style reference

**Prompt Template (Robot Example):**
```
industrial sci-fi battle robot, [chassis type], [color scheme], 
3/4 view, hard surface modeling, worn metal texture, 
dark gradient background with subtle grid, rim lighting from top-right, 
mechanical details, hazard stripes, high detail, 512x512px
```

**Workflow:**
1. Generate base image with AI
2. Upscale to 512×512 or higher
3. Manual touch-ups in Photoshop/GIMP (crop, adjust colors, add overlays)
4. Convert to WEBP at 85% quality
5. Verify consistency with existing assets

#### Option B: 3D Modeling (Higher Quality, Slower)

**Tools:**
- Blender (free, powerful)
- Asset libraries: Sketchfab, TurboSquid (for base models)

**Workflow:**
1. Model robot/weapon in Blender (or purchase base model)
2. Apply textures (PBR materials, metal/rust)
3. Set up consistent lighting rig (save as template)
4. Render at 1024×1024px (downscale to 512×512 later)
5. Post-processing in Photoshop (add effects, adjust colors)
6. Convert to WEBP

#### Option C: 2D Illustration (Stylized, Artistic)

**Tools:**
- Procreate, Adobe Illustrator, Inkscape

**Workflow:**
1. Sketch robot/weapon silhouette
2. Refine lines, add mechanical details
3. Apply flat colors + shading
4. Add highlights, rim lighting
5. Export as PNG, convert to WEBP

**Recommendation**: **Option A (AI-Generated)** for Phase 1 prototype to achieve fast iteration. Transition to Option B (3D Modeling) for production phase when higher quality and full customization are needed.

### Quality Assurance Checklist

Before adding any asset to the repository, verify:

- [ ] **Correct format**: SVG for icons, WEBP for images
- [ ] **Correct size**: Matches specification (512×512 for portraits, etc.)
- [ ] **Naming convention**: Follows lowercase_underscore_prefix format
- [ ] **File size**: <100KB for portraits, <5KB for icons
- [ ] **Visual consistency**: Matches lighting, style, color palette
- [ ] **No copyright issues**: Original creation, licensed, or public domain
- [ ] **Transparent background** (where applicable): Icons, overlays
- [ ] **Optimized**: Compressed with WEBP or minified with SVGO

---

## Implementation Plan

### Phase 1: Foundation (Week 1) - Highest ROI

**Objective**: Implement assets with immediate visual impact.

**Tasks:**
1. ✅ Set up asset directory structure
2. ✅ Create attribute icon set (23 SVG icons)
3. ✅ Create weapon type icons (4 SVG icons)
4. ✅ Generate weapon thumbnails (10 WEBP images)
5. ✅ Create brand assets (logo, currency icon)
6. ✅ Create navigation icon set (8 SVG icons)

**Outcome**: WeaponShopPage becomes visual, attributes show icons instead of text labels.

**Acceptance Criteria:**
- [ ] All 23 attribute icons rendered in RobotDetailPage
- [ ] Weapon shop displays weapon thumbnails in grid
- [ ] Navigation shows icons next to menu items
- [ ] Logo appears in header on all pages

### Phase 2: Robot Identity (Week 2)

**Objective**: Give robots visual identity in lists and detail pages.

**Tasks:**
1. Generate 12 base chassis robot portraits
2. Create 4 colorway variants for each chassis (48 total)
3. Create chassis silhouettes (12 SVG fallbacks)
4. Implement rank badges (6 tiers)
5. Implement damage state overlays (CSS filters)

**Outcome**: Robot lists become scannable, each robot recognizable at a glance.

**Acceptance Criteria:**
- [ ] RobotsPage displays robot portraits in list view
- [ ] RobotDetailPage shows large robot portrait as hero image
- [ ] Rank badges overlay correctly on portraits
- [ ] Damaged robots show visual indication (color overlay)

### Phase 3: Facilities & Environment (Week 3)

**Objective**: Transform FacilitiesPage from spreadsheet to tech tree.

**Tasks:**
1. Generate 14 facility card illustrations
2. Create benefit category icons (8 SVG icons)
3. Implement upgrade level indicators (CSS progress bars)
4. Add subtle background images to main pages
5. Create empty state illustrations (5 images)

**Outcome**: Facilities feel substantial, pages have atmosphere.

**Acceptance Criteria:**
- [ ] Each facility card shows unique illustration
- [ ] Benefit icons appear next to upgrade bonuses
- [ ] DashboardPage has subtle arena background
- [ ] Empty states show custom illustrations instead of generic text

### Phase 4: Polish & UX Enhancements (Week 4)

**Objective**: Complete the visual experience with final touches.

**Tasks:**
1. Create UI frame elements (corner brackets, dividers)
2. Implement loadout slot art for weapon equipping
3. Add loading illustrations/animations
4. Create rarity frames for weapons (future-proofing)
5. Final optimization pass (compress all images)

**Outcome**: Complete, polished visual system that feels professional.

**Acceptance Criteria:**
- [ ] All pages have consistent HUD aesthetic with corner brackets
- [ ] Weapon loadout UI shows visual slots
- [ ] Loading states show branded animations
- [ ] All assets optimized, page load time <3 seconds

### Phase 5: Integration & Testing (Week 5)

**Objective**: Ensure all assets integrate seamlessly, no regressions.

**Tasks:**
1. Comprehensive visual regression testing
2. Performance testing (load times, Lighthouse scores)
3. Mobile responsiveness verification
4. Accessibility audit (alt text, contrast ratios)
5. Cross-browser testing (Chrome, Firefox, Safari, Edge)

**Outcome**: Production-ready visual system with zero bugs.

**Acceptance Criteria:**
- [ ] Lighthouse performance score >90
- [ ] All images have descriptive alt text
- [ ] Mobile layout shows assets correctly (responsive images)
- [ ] No visual bugs across major browsers

---

## User Stories

### Epic: Visual Asset Implementation

**US-1: Robot Portrait System**
```
As a player
I want to see unique portraits for my robots in lists and detail pages
So that I can quickly identify and differentiate my robots without reading names

Acceptance Criteria:
- Each robot displays a portrait based on chassis type and colorway
- Portraits are shown in RobotsPage list (64×64px), AllRobotsPage (128×128px)
- RobotDetailPage displays large portrait (256×256px)
- Rank badges overlay on portraits showing ELO tier
- Damaged robots show visual indication (color overlay)
- Fallback to silhouette icon when portrait unavailable
```

**US-2: Weapon Visual Shop**
```
As a player
I want to browse weapons visually with thumbnails and type icons
So that I can compare weapons at a glance without reading full descriptions

Acceptance Criteria:
- WeaponShopPage displays weapon thumbnails in grid layout
- Each weapon shows type icon (melee, ranged, shield, two-handed)
- Hovering over weapon shows larger preview
- Weapon thumbnails show consistent style (same lighting, background)
- Purchased weapons are visually indicated in shop
- Empty loadout slots show "equip weapon" placeholder
```

**US-3: Attribute Icon Language**
```
As a player
I want to see icons next to attribute names and values
So that I can recognize stats without reading repeated labels

Acceptance Criteria:
- RobotDetailPage shows 23 attribute icons in color-coded groups
- Each icon is consistently colored by category (red for combat, blue for defense, etc.)
- Weapon stat bonuses show relevant attribute icons
- Facility upgrade benefits show attribute icons
- Hovering over icons shows tooltip with attribute name
- Icons are scalable and crisp at all sizes (24px, 32px, 48px)
```

**US-4: Facility Tech Tree**
```
As a player
I want to see visual representations of facilities with illustrations
So that upgrades feel meaningful and substantial rather than abstract

Acceptance Criteria:
- FacilitiesPage displays unique illustration for each of 14 facilities
- Facility cards show illustration as header image
- Upgrade benefits show benefit category icons
- Facility level is visually represented with progress bar (0-10)
- Max-level facilities show distinct visual treatment (green/gold indicator)
- Locked facilities show locked state illustration
```

**US-5: Game World Atmosphere**
```
As a player
I want the UI to feel like a sci-fi battle arena environment
So that I'm immersed in the game world, not just using a web form

Acceptance Criteria:
- DashboardPage has subtle arena background image (low opacity)
- Pages show HUD-style corner brackets on cards
- Empty states show custom illustrations (not generic "no data" text)
- Loading screens show branded loading animation
- Navigation shows themed icons for each section
- App logo and currency icon are consistently displayed
```

---

## Success Metrics & KPIs

### Quantitative Metrics

| Metric | Baseline (Text-Only) | Target (With Images) | Measurement Method |
|--------|---------------------|----------------------|-------------------|
| **Time to Identify Robot** | 5-10 seconds (read name + stats) | <2 seconds | User testing |
| **Weapon Comparison Speed** | 20-30 seconds (read descriptions) | <10 seconds | User testing |
| **Page Load Time** | 1.5 seconds | <2.5 seconds | Lighthouse |
| **Visual Consistency Score** | N/A | 90%+ (all assets follow style) | Design audit |
| **Asset Coverage** | 0% (no images) | 100% (all entities) | Inventory check |

### Qualitative Metrics

**User Feedback Categories:**
- "Feels like a real game" vs "looks like a prototype"
- "Easy to scan lists" vs "too much text to read"
- "Immersive experience" vs "just a web form"
- "Professional polish" vs "unfinished"

**Success Threshold**: >80% positive feedback on qualitative measures

### Performance Benchmarks

**Lighthouse Scores (Target):**
- Performance: >90
- Accessibility: >95
- Best Practices: >95
- SEO: >90

**Load Time Targets:**
- First Contentful Paint: <1.5 seconds
- Largest Contentful Paint: <2.5 seconds
- Time to Interactive: <3.5 seconds

**Asset Budget:**
- Total asset payload: <5MB per page
- Critical path assets: <1MB
- Above-fold images: <500KB

---

## Risks & Mitigation

### Risk 1: Asset Creation Time

**Risk**: Generating 100+ assets (48 robot portraits + 10 weapons + 14 facilities + icons) may take weeks.

**Mitigation:**
- **Prioritize by ROI**: Implement Phase 1 (icons + weapon thumbnails) first for immediate impact
- **Use AI generation**: Leverage Midjourney/DALL-E for fast iteration
- **Reusable templates**: Create lighting/background templates for consistency
- **Parallel work**: Icons can be created while portraits are being generated

### Risk 2: File Size / Performance

**Risk**: 100+ images may significantly increase page load times, degrading UX.

**Mitigation:**
- **Aggressive optimization**: WEBP at 85% quality, SVGO for icons
- **Lazy loading**: Defer non-critical images below the fold
- **Responsive images**: Use srcset to serve appropriately-sized images
- **CDN delivery**: Cache assets aggressively (future phase)
- **Performance budget**: Monitor Lighthouse scores, stay within targets

### Risk 3: Visual Inconsistency

**Risk**: Assets created by different tools/people may look inconsistent, breaking immersion.

**Mitigation:**
- **Strict style guide**: Document lighting, color, angle requirements
- **Single source**: Use one AI model or one 3D artist for all assets
- **Template system**: Reuse same background, lighting setup for all renders
- **Design review**: QA checklist before adding any asset to repo
- **Iteration process**: Generate samples, get approval, then batch-create

### Risk 4: Copyright / Licensing Issues

**Risk**: Using AI-generated or sourced assets may have licensing restrictions.

**Mitigation:**
- **Original creation**: Generate all assets specifically for this project
- **Commercial license**: Ensure AI tool usage rights allow commercial use
- **Attribution tracking**: Document source/creation method for each asset
- **Legal review**: Consult on licensing before using third-party assets

### Risk 5: Over-Engineering

**Risk**: Creating unnecessary asset variants or overly complex implementation.

**Mitigation:**
- **MVP mindset**: Start with 12 chassis, not 100; 48 portraits, not 500
- **Future-proof structure**: Build system to add more later without rework
- **Validate assumptions**: User testing after Phase 1 to confirm ROI
- **Defer complexity**: Rarity frames, advanced animations can wait for later phases

---

## Dependencies & Prerequisites

### Design Dependencies

**Required Before Implementation:**
- [ ] Finalized 12 chassis archetype list (names, roles)
- [ ] Approved color palette for 4 colorway variants
- [ ] Style reference images for AI generation or 3D modeling
- [ ] Logo design approval (if creating new logo)

### Technical Dependencies

**Frontend/Infrastructure:**
- ✅ Vite build system (supports asset imports)
- ✅ React 18 (image components, lazy loading)
- ✅ Tailwind CSS (responsive image utilities)
- [ ] Image optimization pipeline (Vite plugins or build script)
- [ ] Asset versioning/cache-busting strategy

### Resource Dependencies

**Team/Tools:**
- [ ] Designer or AI art account (Midjourney Pro, DALL-E subscription)
- [ ] Image optimization tools (cwebp, SVGO)
- [ ] Design review process (who approves assets?)
- [ ] Asset storage (GitHub repo size, consider Git LFS if needed)

---

## Open Questions

1. **Robot Chassis Types**: Do we need to define specific chassis names now, or use generic names (Type A, Type B, etc.) for prototype?
   - **Recommendation**: Use descriptive archetypes (Humanoid, Heavy Tank, Scout) to guide art direction

2. **Colorway Mapping**: Should specific colors map to robot roles (red = aggressive, blue = defensive)?
   - **Recommendation**: Yes, create role-color associations for intuitive recognition

3. **Asset Sourcing**: AI generation vs hiring artist vs stock assets?
   - **Recommendation**: AI generation for Phase 1 (speed), consider artist for production quality

4. **Animation**: Should loading states be animated SVGs or static images?
   - **Recommendation**: Static for MVP, add subtle CSS animations later if needed

5. **Accessibility**: What alt text standards for game assets vs informational images?
   - **Recommendation**: Descriptive for informational, decorative marked as such for screen readers

6. **Version Control**: Do we need Git LFS for large assets, or is regular Git acceptable?
   - **Recommendation**: Regular Git fine for Phase 1 (<50MB total), reassess if assets exceed 100MB

---

## Appendix

### Glossary

- **WEBP**: Modern image format with superior compression (smaller files than PNG/JPG)
- **SVG**: Scalable Vector Graphics - resolution-independent image format
- **Srcset**: HTML attribute for responsive images (browser picks optimal size)
- **Lazy Loading**: Defer loading images until they're about to enter viewport
- **Lighthouse**: Google's web performance auditing tool
- **LCP**: Largest Contentful Paint - performance metric for page load
- **HUD**: Heads-Up Display - sci-fi UI aesthetic with overlays and frames

### Reference Links

- **[Tailwind CSS - Image Optimization](https://tailwindcss.com/docs/responsive-design)**: Responsive image utilities
- **[SVGO Tool](https://github.com/svg/svgo)**: SVG optimization tool
- **[WEBP Conversion Tool](https://squoosh.app/)**: Online image compression
- **[Midjourney](https://www.midjourney.com/)**: AI art generation platform
- **[Blender](https://www.blender.org/)**: Free 3D modeling software

### Asset Inventory Checklist

**Icons (SVG) - Total: 62**
- [ ] 23 Attribute icons (Combat, Defense, Chassis, AI, Team)
- [ ] 8 Benefit icons (damage, defense, speed, accuracy, etc.)
- [ ] 8 Navigation icons (dashboard, robots, weapons, etc.)
- [ ] 4 Weapon type icons (melee, ranged, shield, two-handed)
- [ ] 12 Chassis silhouettes (fallback icons)
- [ ] 7 Loadout slot icons (main, offhand, two-handed, empty variants)

**Images (WEBP) - Total: 72+**
- [ ] 48 Robot portraits (12 chassis × 4 colorways)
- [ ] 10 Weapon thumbnails (all 10 weapons)
- [ ] 14 Facility illustrations (all 14 facilities)

**Brand Assets - Total: 10+**
- [ ] 4 Logo variants (full, icon, white, monochrome)
- [ ] 1 Currency icon (SVG)
- [ ] 5+ UI frames (corners, dividers)

**Supporting Assets - Total: 28**
- [ ] 3 Background plates (arena, hangar, grid)
- [ ] 5 Empty state illustrations (no robots, no weapons, etc.)
- [ ] 2 Loading animations (general, battle)
- [ ] 18 Rank badges (6 tiers × 3 sizes)

**Grand Total: ~172 asset files**

---

## Approval & Sign-Off

**Document Version**: 1.0  
**Date**: January 30, 2026  
**Status**: Ready for Review

**Stakeholder Approval:**
- [ ] Product Owner: _____________________
- [ ] Lead Developer: _____________________
- [ ] UI/UX Designer: _____________________
- [ ] Technical Lead: _____________________

**Next Steps After Approval:**
1. Kick off Phase 1 implementation (Foundation assets)
2. Set up asset directory structure in repository
3. Create first batch of attribute icons for validation
4. Review and iterate on style consistency
5. Proceed with full asset generation pipeline

---

**End of PRD**