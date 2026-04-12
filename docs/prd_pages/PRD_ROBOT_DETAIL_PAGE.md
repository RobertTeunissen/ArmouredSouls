# Product Requirements Document: Robot Detail Page (`/robots/:id`)

**Project**: Armoured Souls  
**Document Type**: Product Requirements Document (PRD)  
**Version**: v1.1  
**Date**: February 10, 2026  
**Status**: ✅ Implemented 
**Page**: `/robots/:id` (Detail view for individual robot)

> **Note**: This PRD covers the individual robot DETAIL page. For the robots list page (`/robots`), see [PRD_ROBOTS_LIST_PAGE.md](PRD_ROBOTS_LIST_PAGE.md).

---

## Executive Summary

This PRD defines the requirements for overhauling the Robots page GUI and implementing decimal-precision attribute values. Following the implementation of Battle Stances and Yield Threshold systems, the robot detail page requires a significant redesign to better organize the two primary functions: **Battle Configuration** and **Upgrade Robot**. Additionally, a new **Performance & Statistics** section will provide public-facing robot information accessible to all users.

The database schema will be updated to support decimal values (2 decimal places) for all 23 robot attributes, enabling more nuanced stat calculations where small bonuses from weapons and loadouts provide meaningful strategic value even at lower attribute levels.

**Success Criteria**: 
- Players can easily distinguish between Battle Configuration and Upgrade Robot sections
- Effective stats are presented in a comprehensive table format showing all modifier sources
- Page length is reduced by 30-40% through more efficient layouts
- Decimal attribute values enable strategic weapon choices at all levels
- Future image system integration is accommodated through reserved UI space

---

## Background & Context

### Current State

**What Exists:**
- ✅ Working Battle Configuration system (stance selector, yield threshold, weapon loadout)
- ✅ Working Upgrade Robot system (23 attributes with academy caps)
- ✅ Effective stats calculation including weapons, loadout, and stance modifiers
- ✅ StatComparison component showing modified attributes
- ✅ Complete backend calculations in robotCalculations.ts

**Current Issues:**
- ❌ Page is too long, requires excessive scrolling
- ❌ No clear visual separation between Battle Configuration and Upgrade functions
- ❌ Duplicate information (e.g., credit balance shown twice, upgrade costs repeated)
- ❌ Effective stats section is basic list format, not comprehensive table
- ❌ No performance/statistics section for public viewing
- ❌ Integer-only attributes limit strategic depth (5% bonus on 10 base = 0 effective)
- ❌ No reserved space for upcoming image system

**What's Working Well:**
- ✅ Battle stance blocks are visually clear and functional
- ✅ Weapon slot management is intuitive
- ✅ Upgrade buttons with cost display are straightforward

### Design References

- **[PRD_BATTLE_STANCES_AND_YIELD.md](PRD_BATTLE_STANCES_AND_YIELD.md)**: Recently implemented battle configuration system
- **[PRD_WEAPON_LOADOUT.md](PRD_WEAPON_LOADOUT.md)**: Weapon and loadout system specification
- **[ROBOT_ATTRIBUTES.md](ROBOT_ATTRIBUTES.md)**: Complete attribute specifications
- **[STABLE_SYSTEM.md](STABLE_SYSTEM.md)**: Facility system and academy caps
- **[PRD_IMAGE_SYSTEM.md (future branch)](https://github.com/RobertTeunissen/ArmouredSouls/blob/copilot/implement-images-in-gui/docs/PRD_IMAGE_SYSTEM.md)**: Upcoming image system requirements

### Why This Matters

**GUI Overhaul Benefits:**
- Better information architecture improves decision-making
- Reduced page length decreases cognitive load
- Clear functional separation helps players focus on their current task
- Comprehensive stat table enables strategic planning
- Public stats foster competitive analysis and community engagement

**Decimal Attributes Benefits:**
- 5% weapon bonus on 10 base attribute now yields 10.50 instead of 10
- More granular progression creates meaningful choices at all levels
- Strategic depth: Players can optimize fractional gains
- Better balance: Weapons remain valuable throughout progression

---

## Goals & Objectives

### Primary Goals

1. **Redesign Page Structure**: Clear visual distinction between Battle Configuration and Upgrade Robot sections
2. **Implement Comprehensive Stat Table**: Show base attributes, weapon effects, loadout effects, stance effects, and total in table format
3. **Add Performance/Statistics Section**: Public-facing robot information accessible to all users
4. **Reduce Page Length**: Consolidate duplicate information, use more efficient layouts
5. **Enable Decimal Attributes**: Update database and calculations to support 2-decimal precision
6. **Prepare for Images**: Reserve UI space for robot images, frame previews, and weapon icons

### Success Metrics

- Page scroll length reduced by 30-40%
- Players can identify Battle Configuration vs Upgrade sections without labels (visual clarity test)
- Effective stats table displays all 23 attributes with 4+ columns of modifier information
- Decimal calculations work correctly: 10 base + 5% bonus = 10.50 displayed
- No performance degradation with decimal math
- 90%+ of users understand stat table on first viewing (user testing)

### Non-Goals (Out of Scope for This PRD)

- ❌ Implementation of actual image system (only UI space reservation)
- ❌ Performance analytics dashboard (future enhancement)
- ❌ Comparison tool for multiple robots (future feature)
- ❌ Historical battle performance graphs (future feature)
- ❌ Attribute respec/reset functionality (separate epic)
- ❌ Mobile-specific layouts (desktop first, mobile in Phase 4)

---

## User Stories

### Epic 1: GUI Reorganization

**US-1: Battle Configuration Section**
```
As a player
I want to see all battle-related settings in one dedicated section
So that I can quickly configure my robot for upcoming battles

Acceptance Criteria:
- Battle Configuration section clearly labeled with icon (⚔️)
- Contains: Weapon Loadout, Battle Stance, Yield Threshold
- Grouped in a single, visually distinct card/panel
- Located in upper portion of page (above upgrade section)
- Can be collapsed/expanded (optional enhancement)
```

**US-2: Upgrade Robot Section**
```
As a player
I want to see all attribute upgrade options organized by category
So that I can make informed decisions about robot development

Acceptance Criteria:
- Upgrade section clearly separated from Battle Configuration
- Attributes grouped by category (Combat, Defense, Mobility, AI, Team)
- Academy cap information displayed per category, not per attribute
- Upgrade costs shown only once (not repeated for each attribute)
- More compact layout with less vertical spacing
- Visible to all users, not just robot owner
```

**US-3: Performance & Statistics Section**
```
As a player
I want to view comprehensive statistics about any robot
So that I can analyze opponents and track my own performance

Acceptance Criteria:
- Statistics section accessible on any robot's detail page
- Shows: Total Battles, Wins, Losses, Win Rate %, ELO Rating, League Rank
- Shows: Damage Dealt (lifetime), Damage Taken (lifetime), Kills, K/D Ratio
- Shows: Current HP, Max HP, Damage %, Battle Readiness %
- Shows: Total Repair Costs Paid, Fame, Titles
- Read-only section (no modification controls)
- Visible to all users, not just robot owner
```

**US-4: Effective Stats Comprehensive Table**
```
As a player
I want to see all my robot's effective stats in a table format
So that I can understand exactly how each modifier affects my attributes

Acceptance Criteria:
- Table format with rows for each of 23 attributes
- Columns: Attribute Name | Base Value | Weapon Bonus | Loadout Modifier | Stance Modifier | Total Effective
- Organized by category with visual separators
- Color coding: green for positive modifiers, red for negative
- Shows percentage modifiers explicitly (e.g., "+15%" for loadout)
- Shows decimal values (e.g., "10.50" not "10")
- Located in dedicated "Effective Stats Overview" section
```

**US-5: Reduced Credit Balance Duplication**
```
As a player
I want to see my credit balance only in the navigation banner
So that I don't have redundant information cluttering the page

Acceptance Criteria:
- Credit balance removed from robot detail page body
- Credit balance visible in top-right banner (existing location)
- Upgrade buttons still show "Not Enough Credits" state when applicable
- Upgrade cost preview still visible per attribute
```

**US-6: Image System Space Reservation**
```
As a player (future feature prep)
I want the page layout to accommodate robot images
So that when images are added, the page doesn't require redesign

Acceptance Criteria:
- Reserved space (300x300px) for robot frame image in header area
- Reserved space (64x64px) for weapon icons in loadout section
- Layout remains functional with placeholder images
- Space is utilized meaningfully even without images (e.g., shows text labels)
```

### Epic 2: Decimal Attribute Precision

**US-7: Decimal Attribute Display**
```
As a player
I want to see attribute values with decimal precision
So that I understand the exact benefit of small percentage bonuses

Acceptance Criteria:
- All attribute values display with up to 2 decimal places (e.g., "12.50", "10.75")
- Whole numbers display as "10.00" for consistency
- Effective stats calculations include decimal precision
- Weapon bonuses correctly add fractional values (e.g., 10 base + 5% = 10.50)
- Loadout modifiers correctly multiply with decimals (e.g., 10.50 × 1.15 = 12.07)
```

**US-8: Strategic Weapon Value at Low Levels**
```
As a player with low-level attributes
I want weapon bonuses to provide meaningful benefits
So that my equipment choices matter from the beginning

Acceptance Criteria:
- 5% weapon bonus on 10 base attribute yields 10.50 (not 10)
- 10% loadout bonus on 5 base attribute yields 5.50 (not 5)
- Even 1-point base attributes show fractional improvements
- Battle calculations use decimal precision for damage, defense, etc.
```

**US-9: Decimal Upgrade Path Clarity**
```
As a player
I want to see how decimal values progress when I upgrade
So that I can plan my upgrade strategy with precision

Acceptance Criteria:
- Upgrade preview shows new decimal value (e.g., "15.00 → 16.00")
- With weapons: "15.50 → 16.50" (weapon bonus persists)
- With loadout: "15.50 × 1.15 = 17.82 → 18.97"
- Tooltips explain decimal rounding rules (rounded down to 2 decimals)
```

---

## Functional Requirements

### FR-1: Page Layout Redesign

**New Page Structure:**

```
┌─────────────────────────────────────────────────────────────┐
│ Navigation Banner (with Credit Balance)                     │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│ Robot Header                                                 │
│ ┌──────────────┐  ┌──────────────────────────────────────┐ │
│ │ [Robot Image]│  │ Name: "Iron Fist"                    │ │
│ │ (300x300px)  │  │ ELO: 1450 | League: Silver         │ │
│ │              │  │ [Refresh] [Back to Robots]           │ │
│ └──────────────┘  └──────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ⚔️ BATTLE CONFIGURATION                                     │
│ ├─ Weapon Loadout                                           │
│ │  ├─ Loadout Type Selector (single/shield/two-hand/dual) │
│ │  ├─ Main Weapon Slot [icon][weapon name]                │
│ │  └─ Offhand Weapon Slot [icon][weapon name]             │
│ ├─ Battle Stance                                            │
│ │  └─ [Offensive] [Balanced] [Defensive]                  │
│ └─ Yield Threshold                                          │
│    └─ Slider (0-50%) with repair cost preview             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 📊 EFFECTIVE STATS OVERVIEW                                 │
│ Comprehensive table showing all modifiers                   │
│ (See Table Structure below)                                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 🏆 PERFORMANCE & STATISTICS                                 │
│ ├─ Combat Record: 45W-23L (66.2% win rate)                  │
│ ├─ ELO Rating: 1450 (+15 last battle)                       │
│ ├─ Damage Stats: 125,430 dealt / 89,220 taken               │
│ ├─ Current State: 850/1000 HP (85% readiness)               │
│ └─ Economic: ₡45,000 lifetime repairs                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ⬆️ UPGRADE ROBOT                                            │
│ ├─ Combat Systems (Cap: 35)          [Upgrade Academy]      │
│ │  └─ [Compact attribute list with inline upgrade buttons]  │
│ ├─ Defensive Systems (Cap: 35)       [Upgrade Academy]      │
│ ├─ Chassis & Mobility (Cap: 30)      [Upgrade Academy]      │
│ ├─ AI Processing (Cap: 25)           [Upgrade Academy]      │
│ └─ Team Coordination (Cap: 25)       [Upgrade Academy]      │
└─────────────────────────────────────────────────────────────┘
```

**Component Breakdown:**

1. **Robot Header**
   - Robot name (H1), ELO badge, League badge
   - Reserved image space (300x300px) - initially shows placeholder or text
   - Refresh and navigation buttons

2. **Battle Configuration Section**
   - Single card with clear ⚔️ icon and heading
   - Three subsections: Weapons, Stance, Yield
   - Each subsection uses existing components (LoadoutSelector, StanceSelector, YieldThresholdSlider)
   - More compact spacing than current layout

3. **Effective Stats Overview**
   - Dedicated section with 📊 icon
   - Comprehensive table (detailed in FR-2)
   - Collapsible/expandable header (optional)

4. **Performance & Statistics**
   - New section with 🏆 icon
   - Read-only statistics display
   - Accessible to all users (owner or visitors)
   - Shows aggregated battle data and economic metrics

5. **Upgrade Robot Section**
   - Grouped by category with category header showing academy cap
   - "Upgrade Academy" button per category (links to Facilities page)
   - Compact attribute rows (1-2 lines each instead of 3-4)
   - Upgrade button shows cost only, no base cost line-through on hover

### FR-2: Effective Stats Comprehensive Table

**Table Structure:**

| Category | Attribute | Base | Weapons | Loadout | Stance | **Total** |
|----------|-----------|------|---------|---------|--------|-----------|
| **Combat Systems** |
| | Combat Power | 25.00 | +5 | +15% | +15% | **35.65** |
| | Targeting Systems | 18.00 | +3 | - | - | **21.00** |
| | Critical Systems | 20.00 | +2 | - | - | **22.00** |
| | ... | | | | | |
| **Defensive Systems** |
| | Armor Plating | 15.00 | - | +15% | +15% | **19.86** |
| | ... | | | | | |

**Column Specifications:**

1. **Category**: Visual grouping (Combat Systems, Defensive, etc.)
2. **Attribute**: Attribute display name
3. **Base**: Base upgraded value (decimal precision)
4. **Weapons**: Sum of main + offhand weapon bonuses (e.g., "+5", "+0", "-2")
5. **Loadout**: Percentage modifier from loadout type (e.g., "+15%", "-10%", "-")
6. **Stance**: Percentage modifier from battle stance (e.g., "+15%", "-10%", "-")
7. **Total**: Final effective value with all modifiers applied (bold, large text)

**Visual Design:**
- Alternating row colors for readability
- Category headers with background color
- Green text for positive modifiers, red for negative
- Bold total column
- Decimal precision (2 places) for all numeric values
- Dash "-" for zero/no modifier
- Responsive: collapses to vertical cards on mobile (future)

**Calculation Formula Displayed:**
```
Total = (Base + Weapons) × (1 + Loadout) × (1 + Stance)

Example:
(25.00 + 5) × (1 + 0.15) × (1 + 0.15)
= 30.00 × 1.15 × 1.15
= 39.67
```

### FR-3: Performance & Statistics Section

**Data Fields:**

**Combat Record:**
- Total Battles: `robot.totalBattles`
- Wins: `robot.wins`
- Losses: `robot.losses`
- Win Rate: `(wins / totalBattles * 100).toFixed(1)%`

**Rankings:**
- ELO Rating: `robot.elo` (with trend indicator if available)
- Current League: `robot.currentLeague` with league icon
- League Points: `robot.leaguePoints`
- Fame: `robot.fame`

**Damage Statistics:**
- Lifetime Damage Dealt: `robot.damageDealtLifetime.toLocaleString()`
- Lifetime Damage Taken: `robot.damageTakenLifetime.toLocaleString()`
- Kills: `robot.kills`
- K/D Ratio: `(kills / (losses || 1)).toFixed(2)`

**Current State:**
- Current HP: `robot.currentHP` / `robot.maxHP`
- HP Percentage: `(currentHP / maxHP * 100).toFixed(0)%`
- Current Shield: `robot.currentShield` / `robot.maxShield`
- Damage Taken (Current): `robot.damageTaken`
- Battle Readiness: `robot.battleReadiness%`

**Economic:**
- Lifetime Repairs Paid: `₡${robot.totalRepairsPaid.toLocaleString()}`
- Current Repair Cost: `₡${robot.repairCost.toLocaleString()}`

**Titles/Achievements:**
- Titles: `robot.titles` (comma-separated string, parsed and displayed as badges)

**Visibility Rules:**
- All fields visible to robot owner
- All fields visible to other users (public information for competitive analysis)
- No modification controls in this section
- Link to "View Battle History" (future enhancement)

### FR-4: Compact Attribute Upgrade Display

**Current Layout (per attribute):**
```
┌─────────────────────────────────────────────────────┐
│ Combat Power                     Level 25           │
│   +5 from weapons = 30                              │
│ Upgrade Cost: ₡26,000 (20% off)                    │
│ [Upgrade (₡26,000)]                                 │
└─────────────────────────────────────────────────────┘
(Takes ~80-100px vertical space)
```

**New Layout (per attribute):**
```
┌─────────────────────────────────────────────────────┐
│ Combat Power: 25.00 (+5.00) = 30.00  [Upgrade ₡26K]│
└─────────────────────────────────────────────────────┘
(Takes ~40-50px vertical space)
```

**Compact Row Structure:**
- Left: `Attribute Name: Base (Bonus) = Effective`
- Right: `[Upgrade ₡XXk]` button
- Hover tooltip shows full breakdown and discount details
- Disabled state: "Max Level" or "Upgrade Academy" or "Not Enough Credits"
- Color coding: bonus in green, effective in white

**Category Headers:**
```
┌─────────────────────────────────────────────────────┐
│ 🔫 COMBAT SYSTEMS               Cap: 35/50          │
│ (Combat Training Academy Level 5)  [Upgrade Academy]│
└─────────────────────────────────────────────────────┘
```

- Shows current cap and max cap
- Shows relevant academy name and level
- Link to Facilities page for academy upgrade

### FR-5: Database Schema Changes for Decimal Attributes

**Prisma Schema Updates:**

All 23 robot attributes must be changed from `Int` to `Decimal`:

```prisma
model Robot {
  // ... existing fields ...
  
  // ===== 23 CORE ATTRIBUTES (Range: 1.00-50.00, precision 2 decimals) =====
  
  // Combat Systems (6 attributes)
  combatPower         Decimal  @default(1.00) @map("combat_power") @db.Decimal(5, 2)
  targetingSystems    Decimal  @default(1.00) @map("targeting_systems") @db.Decimal(5, 2)
  criticalSystems     Decimal  @default(1.00) @map("critical_systems") @db.Decimal(5, 2)
  penetration         Decimal  @default(1.00) @db.Decimal(5, 2)
  weaponControl       Decimal  @default(1.00) @map("weapon_control") @db.Decimal(5, 2)
  attackSpeed         Decimal  @default(1.00) @map("attack_speed") @db.Decimal(5, 2)
  
  // Defensive Systems (5 attributes)
  armorPlating        Decimal  @default(1.00) @map("armor_plating") @db.Decimal(5, 2)
  shieldCapacity      Decimal  @default(1.00) @map("shield_capacity") @db.Decimal(5, 2)
  evasionThrusters    Decimal  @default(1.00) @map("evasion_thrusters") @db.Decimal(5, 2)
  damageDampeners     Decimal  @default(1.00) @map("damage_dampeners") @db.Decimal(5, 2)
  counterProtocols    Decimal  @default(1.00) @map("counter_protocols") @db.Decimal(5, 2)
  
  // Chassis & Mobility (5 attributes)
  hullIntegrity       Decimal  @default(1.00) @map("hull_integrity") @db.Decimal(5, 2)
  servoMotors         Decimal  @default(1.00) @map("servo_motors") @db.Decimal(5, 2)
  gyroStabilizers     Decimal  @default(1.00) @map("gyro_stabilizers") @db.Decimal(5, 2)
  hydraulicSystems    Decimal  @default(1.00) @map("hydraulic_systems") @db.Decimal(5, 2)
  powerCore           Decimal  @default(1.00) @map("power_core") @db.Decimal(5, 2)
  
  // AI Processing (4 attributes)
  combatAlgorithms    Decimal  @default(1.00) @map("combat_algorithms") @db.Decimal(5, 2)
  threatAnalysis      Decimal  @default(1.00) @map("threat_analysis") @db.Decimal(5, 2)
  adaptiveAI          Decimal  @default(1.00) @map("adaptive_ai") @db.Decimal(5, 2)
  logicCores          Decimal  @default(1.00) @map("logic_cores") @db.Decimal(5, 2)
  
  // Team Coordination (3 attributes)
  syncProtocols       Decimal  @default(1.00) @map("sync_protocols") @db.Decimal(5, 2)
  supportSystems      Decimal  @default(1.00) @map("support_systems") @db.Decimal(5, 2)
  formationTactics    Decimal  @default(1.00) @map("formation_tactics") @db.Decimal(5, 2)
  
  // ... rest of model ...
}
```

**Precision Specification:**
- `@db.Decimal(5, 2)`: Total 5 digits, 2 after decimal point
- Supports range: 0.00 to 999.99 (50.00 is max in practice)
- Examples: 1.00, 25.50, 49.99

**Migration Strategy:**
1. Create Prisma migration to alter column types
2. Existing integer values automatically converted to decimal (e.g., 25 → 25.00)
3. No data loss during migration
4. Backward compatible (can read old integer values as decimals)

### FR-6: Backend Calculation Updates

**robotCalculations.ts Updates:**

```typescript
// Update return type to handle Decimal
export function calculateEffectiveStats(robot: RobotWithWeapons): Record<string, number> {
  // ... existing logic ...
  
  // Convert Prisma Decimal to JavaScript number for calculations
  const baseValue = Number(robot[attr as keyof Robot]);
  
  // Apply formulas with decimal precision
  const effectiveValue = (baseValue + weaponBonus) * loadoutMultiplier * stanceMultiplier;
  
  // Round to 2 decimal places
  effectiveStats[attr] = Math.round(effectiveValue * 100) / 100;
  
  return effectiveStats;
}
```

**Key Changes:**
1. Convert Prisma `Decimal` objects to JavaScript `number` for math operations
2. Use `Math.round(value * 100) / 100` for 2-decimal precision
3. Ensure all formulas preserve decimal precision throughout calculation chain
4. Update type definitions to reflect `Decimal` in Prisma types

**Upgrade Cost Calculation (Updated Feb 8, 2026):**
- Upgrade costs based on level (integer): `(currentLevel + 1) * 1500` (increased from 1000)
- When base attribute is 25.50, upgrade cost is `Math.floor(26) * 1500 = ₡39,000`
- Level is determined by `Math.floor(attribute)` for upgrade purposes

### FR-7: Frontend Display Updates

**Decimal Formatting Utility:**

```typescript
// utils/formatters.ts
export function formatAttribute(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return num.toFixed(2);
}

export function formatAttributeShort(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  // Show decimals only if non-zero
  return num % 1 === 0 ? num.toFixed(0) : num.toFixed(2);
}
```

**Component Updates:**
1. **RobotDetailPage.tsx**: Handle decimal values from API
2. **StatComparison.tsx**: Display decimal effective stats
3. **New Component: EffectiveStatsTable.tsx**: Comprehensive stat table
4. **New Component: PerformanceStats.tsx**: Statistics section
5. **Refactored Upgrade Section**: Compact attribute display

**Type Updates:**
```typescript
interface Robot {
  // ... existing fields ...
  combatPower: number; // Decimal from backend converted to number
  targetingSystems: number;
  // ... all 23 attributes as number type (converted from Decimal)
}
```

### FR-8: Image System Space Reservation

**Robot Header Image Area:**
```tsx
<div className="flex items-start gap-6">
  {/* Reserved space for robot image */}
  <div className="w-[300px] h-[300px] bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
    {/* Placeholder until image system implemented */}
    <div className="text-center">
      <div className="text-6xl mb-2">🤖</div>
      <div className="text-gray-400 text-sm">Robot Frame</div>
      <div className="text-gray-500 text-xs">Frame ID: {robot.frameId}</div>
    </div>
  </div>
  
  {/* Robot info */}
  <div className="flex-1">
    <h1>{robot.name}</h1>
    {/* ... */}
  </div>
</div>
```

**Weapon Icon Placeholders:**
```tsx
<div className="flex items-center gap-2">
  {/* Reserved 64x64px for weapon icon */}
  <div className="w-16 h-16 bg-gray-600 rounded flex-shrink-0 flex items-center justify-center">
    <span className="text-2xl">⚔️</span>
  </div>
  <div className="flex-1">
    <div className="font-semibold">{weapon.name}</div>
    <div className="text-sm text-gray-400">{weapon.weaponType}</div>
  </div>
</div>
```

**Layout Considerations:**
- Fixed-width containers for image areas
- Layout doesn't break if images are empty/placeholder
- Alt text and aria-labels for accessibility
- Lazy loading preparation (when images added)

---

## Technical Specifications

### Database Migration

**Migration File: `YYYYMMDDHHMMSS_decimal_robot_attributes.sql`**

```sql
-- Convert all 23 robot attributes from INTEGER to DECIMAL(5,2)

-- Combat Systems
ALTER TABLE robots ALTER COLUMN combat_power TYPE DECIMAL(5,2);
ALTER TABLE robots ALTER COLUMN targeting_systems TYPE DECIMAL(5,2);
ALTER TABLE robots ALTER COLUMN critical_systems TYPE DECIMAL(5,2);
ALTER TABLE robots ALTER COLUMN penetration TYPE DECIMAL(5,2);
ALTER TABLE robots ALTER COLUMN weapon_control TYPE DECIMAL(5,2);
ALTER TABLE robots ALTER COLUMN attack_speed TYPE DECIMAL(5,2);

-- Defensive Systems
ALTER TABLE robots ALTER COLUMN armor_plating TYPE DECIMAL(5,2);
ALTER TABLE robots ALTER COLUMN shield_capacity TYPE DECIMAL(5,2);
ALTER TABLE robots ALTER COLUMN evasion_thrusters TYPE DECIMAL(5,2);
ALTER TABLE robots ALTER COLUMN damage_dampeners TYPE DECIMAL(5,2);
ALTER TABLE robots ALTER COLUMN counter_protocols TYPE DECIMAL(5,2);

-- Chassis & Mobility
ALTER TABLE robots ALTER COLUMN hull_integrity TYPE DECIMAL(5,2);
ALTER TABLE robots ALTER COLUMN servo_motors TYPE DECIMAL(5,2);
ALTER TABLE robots ALTER COLUMN gyro_stabilizers TYPE DECIMAL(5,2);
ALTER TABLE robots ALTER COLUMN hydraulic_systems TYPE DECIMAL(5,2);
ALTER TABLE robots ALTER COLUMN power_core TYPE DECIMAL(5,2);

-- AI Processing
ALTER TABLE robots ALTER COLUMN combat_algorithms TYPE DECIMAL(5,2);
ALTER TABLE robots ALTER COLUMN threat_analysis TYPE DECIMAL(5,2);
ALTER TABLE robots ALTER COLUMN adaptive_ai TYPE DECIMAL(5,2);
ALTER TABLE robots ALTER COLUMN logic_cores TYPE DECIMAL(5,2);

-- Team Coordination
ALTER TABLE robots ALTER COLUMN sync_protocols TYPE DECIMAL(5,2);
ALTER TABLE robots ALTER COLUMN support_systems TYPE DECIMAL(5,2);
ALTER TABLE robots ALTER COLUMN formation_tactics TYPE DECIMAL(5,2);

-- Note: Existing integer values (e.g., 25) are automatically converted to DECIMAL (25.00)
-- No data loss occurs during this migration
```

### API Response Changes

**GET /api/robots/:id Response (Updated):**

```json
{
  "id": 1,
  "name": "Iron Fist",
  "elo": 1450,
  // Decimal values returned as strings to preserve precision
  "combatPower": "25.50",
  "targetingSystems": "18.00",
  "criticalSystems": "20.75",
  // ... all 23 attributes with decimal precision
  
  // Performance stats
  "totalBattles": 68,
  "wins": 45,
  "losses": 23,
  "damageDealtLifetime": 125430,
  "damageTakenLifetime": 89220,
  "kills": 38,
  // ... other fields
}
```

**Notes:**
- Decimal values serialized as strings in JSON to prevent precision loss
- Frontend converts to numbers using `parseFloat()` or `Number()`
- Battle calculations use native JavaScript number type (sufficient precision)

### Component Architecture

**New Components:**

1. **EffectiveStatsTable.tsx**
   - Props: `robot`, `showStanceModifiers`
   - Displays comprehensive stat table with all modifiers
   - Uses utility functions from `robotStats.ts`

2. **PerformanceStats.tsx**
   - Props: `robot`, `isOwner`
   - Displays read-only performance and statistics
   - Accessible to all users

3. **CompactAttributeRow.tsx**
   - Props: `attribute`, `robot`, `cap`, `onUpgrade`
   - Single-line attribute display with inline upgrade button
   - Replaces verbose current layout

**Modified Components:**

1. **RobotDetailPage.tsx**
   - Major layout restructure
   - Integration of new components
   - Remove credit balance card

2. **StatComparison.tsx**
   - Update to handle decimal values
   - Enhanced tooltip information

### Performance Considerations

**Decimal Math Performance:**
- JavaScript number type handles up to 15-17 significant digits
- 2-decimal precision well within JavaScript's capabilities
- No performance impact expected for typical operations
- Math operations: `+`, `-`, `*`, `/` work identically with decimals

**Database Performance:**
- `DECIMAL(5,2)` storage: 5 bytes per value
- Previous `INTEGER` storage: 4 bytes per value
- Minimal storage overhead: +1 byte × 23 attributes = +23 bytes per robot
- Index performance unchanged
- Query performance unchanged

**Frontend Rendering:**
- Decimal formatting adds negligible overhead
- Table rendering: ~23 rows × 6 columns = 138 cells (trivial for modern browsers)
- No virtualization needed for single robot view

---

## User Experience

### Information Hierarchy

**Priority 1 (Top of Page):**
1. Robot identity (name, image, ELO, league)
2. Battle Configuration (most frequent action)

**Priority 2 (Middle of Page):**
3. Effective Stats Table (decision support)
4. Performance Statistics (analysis and tracking)

**Priority 3 (Bottom of Page):**
5. Upgrade Robot (less frequent, long-term planning)

### Interaction Patterns

**Battle Configuration:**
- Quick adjustments before battles
- Visual feedback on stat changes
- No page navigation required

**Effective Stats:**
- Passive information display
- No interactions (read-only)
- Sortable/filterable (future enhancement)

**Performance Statistics:**
- Read-only display
- Public visibility encourages competition
- Links to battle history (future)

**Upgrades:**
- Deliberate, infrequent action
- Confirmation via button click
- Cost clearly displayed

### Accessibility

**WCAG 2.1 AA Compliance:**
- Color is not the only means of conveying information (icons + text)
- Sufficient contrast ratios (4.5:1 minimum for text)
- Keyboard navigation for all interactive elements
- ARIA labels for screen readers
- Focus indicators on all focusable elements

**Decimal Value Accessibility:**
- Screen readers announce "25.50" as "twenty-five point five zero"
- Consistent decimal formatting prevents confusion
- Tooltips provide context for fractional values

---

## Testing Strategy

### Unit Tests

**Backend Tests:**
```typescript
describe('Decimal Attribute Calculations', () => {
  it('should calculate 5% weapon bonus on 10 base as 10.50', () => {
    const robot = createTestRobot({ combatPower: 10 });
    const weapon = createTestWeapon({ combatPowerBonus: 0.5 }); // 5%
    const effective = calculateEffectiveStats(robot);
    expect(effective.combatPower).toBe(10.50);
  });
  
  it('should apply loadout modifier to decimal values', () => {
    const robot = createTestRobot({ 
      combatPower: 10.50,
      loadoutType: 'two_handed' 
    });
    const effective = calculateEffectiveStats(robot);
    // 10.50 × 1.25 = 13.125 → 13.12 (rounded)
    expect(effective.combatPower).toBe(13.12);
  });
  
  it('should round to 2 decimal places', () => {
    const result = calculateEffectiveStat(10, 0.333, 0.15);
    // 10.333 × 1.15 = 11.88295 → 11.88
    expect(result).toBe(11.88);
  });
});
```

**Frontend Tests:**
```typescript
describe('EffectiveStatsTable', () => {
  it('should display decimal values correctly', () => {
    const robot = createMockRobot({ combatPower: 25.50 });
    render(<EffectiveStatsTable robot={robot} />);
    expect(screen.getByText('25.50')).toBeInTheDocument();
  });
  
  it('should show all modifier columns', () => {
    const { container } = render(<EffectiveStatsTable robot={robot} />);
    expect(container.querySelectorAll('th')).toHaveLength(7); // 7 columns
  });
});
```

### Integration Tests

**API Tests:**
```typescript
describe('GET /api/robots/:id', () => {
  it('should return decimal attributes as strings', async () => {
    const response = await request(app)
      .get('/api/robots/1')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.body.combatPower).toBe('25.50');
    expect(typeof response.body.combatPower).toBe('string');
  });
});

describe('PUT /api/robots/:id/upgrade', () => {
  it('should upgrade attribute maintaining decimal precision', async () => {
    // Robot has 25.50 combat power (25 base + 0.50 from weapon)
    const response = await request(app)
      .put('/api/robots/1/upgrade')
      .send({ attribute: 'combatPower' })
      .set('Authorization', `Bearer ${token}`);
    
    // After upgrade: 26.50 (26 base + 0.50 from weapon)
    expect(response.body.robot.combatPower).toBe('26.50');
  });
});
```

### E2E Tests

**Playwright Tests:**
```typescript
test('decimal stats display correctly in stat table', async ({ page }) => {
  await page.goto('/robots/1');
  
  // Check that decimal values are displayed
  await expect(page.locator('text=25.50')).toBeVisible();
  
  // Check table structure
  const table = page.locator('[data-testid="effective-stats-table"]');
  await expect(table.locator('th')).toHaveCount(7);
  
  // Check modifier columns show percentage
  await expect(table.locator('text=+15%')).toBeVisible();
});

test('page layout shows clear section separation', async ({ page }) => {
  await page.goto('/robots/1');
  
  // Verify sections exist
  await expect(page.locator('text=⚔️ BATTLE CONFIGURATION')).toBeVisible();
  await expect(page.locator('text=📊 EFFECTIVE STATS OVERVIEW')).toBeVisible();
  await expect(page.locator('text=🏆 PERFORMANCE & STATISTICS')).toBeVisible();
  await expect(page.locator('text=⬆️ UPGRADE ROBOT')).toBeVisible();
  
  // Verify credit balance NOT duplicated in page body
  const creditBalanceCount = await page.locator('text=Credits Balance').count();
  expect(creditBalanceCount).toBe(0); // Should only be in navigation banner
});
```

### Manual Testing Checklist

**Layout & UI:**
- [ ] Page is 30-40% shorter than before
- [ ] Clear visual distinction between sections
- [ ] No credit balance duplication
- [ ] Image placeholders are appropriate size
- [ ] Responsive on different viewport widths

**Decimal Values:**
- [ ] All attributes display with 2 decimals
- [ ] Weapon bonus correctly adds fractional values
- [ ] Loadout modifier correctly multiplies with decimals
- [ ] Stance modifier correctly multiplies with decimals
- [ ] Upgrade maintains decimal precision

**Effective Stats Table:**
- [ ] Table displays all 23 attributes
- [ ] Columns: Base, Weapons, Loadout, Stance, Total
- [ ] Positive modifiers in green, negative in red
- [ ] Category headers clearly visible
- [ ] Tooltips explain calculations

**Performance Statistics:**
- [ ] All stats display correctly for robot owner
- [ ] All stats visible to other users (public)
- [ ] Win rate percentage calculates correctly
- [ ] K/D ratio handles zero losses gracefully

**Upgrade Section:**
- [ ] Compact layout reduces vertical space
- [ ] Upgrade button shows cost in thousands (₡26K)
- [ ] Disabled states clear and informative
- [ ] Academy cap displayed per category

---

## Migration & Rollout Plan

### Phase 1: Database Migration (Day 1)

1. **Backup Database**
   ```bash
   pg_dump armouredsouls > backup_before_decimal.sql
   ```

2. **Create Prisma Migration**
   ```bash
   cd app/backend
   npx prisma migrate dev --name decimal_robot_attributes
   ```

3. **Verify Migration**
   - Check all 23 columns are `DECIMAL(5,2)`
   - Verify existing data converted correctly (25 → 25.00)
   - Test rollback procedure

4. **Deploy Backend Updates**
   - Update robotCalculations.ts to handle Decimal type
   - Update API serialization (Decimal → string)
   - Deploy to development environment

### Phase 2: Backend Calculations (Day 2)

1. **Update Calculation Functions**
   - Modify `calculateEffectiveStats()`
   - Modify `calculateEffectiveStat()`
   - Add decimal rounding utilities

2. **Update API Responses**
   - Serialize Decimal as string in JSON
   - Test with frontend mock data

3. **Run Backend Tests**
   - Unit tests for decimal calculations
   - Integration tests for API responses

### Phase 3: Frontend Components (Days 3-5)

1. **Create New Components**
   - Day 3: EffectiveStatsTable.tsx
   - Day 4: PerformanceStats.tsx
   - Day 4: CompactAttributeRow.tsx

2. **Refactor RobotDetailPage.tsx**
   - Day 5: Implement new layout structure
   - Day 5: Integrate new components
   - Day 5: Remove credit balance duplication

3. **Update Existing Components**
   - StatComparison.tsx: Handle decimals
   - robotStats.ts: Update calculations

### Phase 4: Testing & Refinement (Days 6-7)

1. **Day 6: Testing**
   - Run full test suite
   - Manual testing checklist
   - Cross-browser testing
   - Performance profiling

2. **Day 7: Refinement**
   - Fix bugs identified in testing
   - Polish UI/UX based on feedback
   - Update documentation

### Phase 5: Deployment (Day 8)

1. **Deploy to Production**
   - Run database migration in production
   - Deploy backend updates
   - Deploy frontend updates

2. **Monitor**
   - Check error logs
   - Monitor performance metrics
   - Gather user feedback

---

## Success Criteria & Metrics

### Technical Metrics

- ✅ All 23 attributes stored as `DECIMAL(5,2)` in database
- ✅ Zero data loss during migration
- ✅ API response time < 200ms (unchanged from before)
- ✅ Page load time < 2 seconds (unchanged from before)
- ✅ Zero JavaScript errors in browser console
- ✅ 95%+ test coverage for new/modified code

### UX Metrics

- ✅ Page scroll height reduced by 30-40%
- ✅ Users can identify section purpose without reading labels (90%+ in usability testing)
- ✅ Decimal values display correctly in all contexts
- ✅ No user-reported confusion about fractional attributes
- ✅ Positive user feedback on new layout (target: 80%+ satisfaction)

### Business Metrics

- ✅ No decrease in user engagement (time on page, actions per session)
- ✅ Increase in weapon purchases due to visible fractional benefits
- ✅ Increase in strategic experimentation (loadout changes, stance adjustments)
- ✅ No increase in support tickets about interface confusion

---

## Risks & Mitigations

### Risk 1: Decimal Math Complexity

**Risk**: Floating-point precision issues in JavaScript  
**Likelihood**: Low  
**Impact**: Medium  
**Mitigation**:
- Use `Math.round(value * 100) / 100` for consistent 2-decimal rounding
- Avoid comparison with `===` for decimals; use tolerance: `Math.abs(a - b) < 0.01`
- Comprehensive unit tests for edge cases

### Risk 2: Database Migration Failure

**Risk**: Migration corrupts data or fails mid-process  
**Likelihood**: Very Low  
**Impact**: High  
**Mitigation**:
- Full database backup before migration
- Test migration on staging environment first
- Rollback procedure documented and tested
- Monitor migration with transaction logging

### Risk 3: User Confusion with Decimals

**Risk**: Players confused by fractional attribute values  
**Likelihood**: Low  
**Impact**: Low  
**Mitigation**:
- Clear tooltips explaining decimal values
- "Why decimals?" help text in FAQ
- Visual examples showing benefit of fractional stats
- User education in patch notes

### Risk 4: Performance Degradation

**Risk**: Decimal calculations slower than integer math  
**Likelihood**: Very Low  
**Impact**: Low  
**Mitigation**:
- JavaScript handles decimals efficiently (no measurable difference)
- Performance profiling during testing phase
- Benchmarking: current vs. new calculations

### Risk 5: Page Redesign Rejected by Users

**Risk**: Users prefer old layout, find new one confusing  
**Likelihood**: Low  
**Impact**: Medium  
**Mitigation**:
- User testing before full deployment
- Gradual rollout (beta testers first)
- Feedback collection mechanism
- A/B testing if needed

---

## Open Questions

### Q1: Should effective stats table show stance modifiers by default?

**Options:**
A. Always show stance modifiers (current stance applied)
B. Show stance as separate column (all three stances)
C. Toggle between "Current Stance" and "All Stances" views

**Recommendation**: Option A (always show current stance)  
**Reasoning**: Simpler UX, focused on current battle readiness. Option C could be future enhancement.

### Q2: How to handle decimal display in battle logs?

**Context**: Battle logs will show damage, defense, etc. Should these be integers or decimals?

**Options:**
A. Round to integers for battle logs (25.67 → 26 damage dealt)
B. Show decimals in battle logs for accuracy

**Recommendation**: Option A (integers in logs)  
**Reasoning**: Cleaner, more "game-like" feel. Decimals in stats are for planning, not battle narrative.

### Q3: Should we add sorting/filtering to effective stats table?

**Context**: Table has 23 rows. Should users be able to sort by attribute or filter by category?

**Options:**
A. Static table (no sorting/filtering)
B. Add sort buttons to column headers
C. Add category filter chips

**Recommendation**: Option A for initial release, Option C as future enhancement  
**Reasoning**: Not critical for single robot view; adds complexity. Revisit if users request it.

### Q4: Performance statistics: Should visitors see economic data?

**Context**: Should `totalRepairsPaid` and `repairCost` be visible to other users?

**Options:**
A. Show all stats to everyone (fully transparent)
B. Hide economic data from non-owners
C. Show only aggregate stats (e.g., "High repair costs" label)

**Recommendation**: Option B (hide economic data)  
**Reasoning**: Economic information is sensitive; battle stats are competitive, repair costs are not.

---

## Appendices

### Appendix A: Decimal Calculation Examples

**Example 1: Weapon Bonus at Low Level**
```
Base Attribute: 10
Weapon Bonus: +5% (0.50 absolute)
Calculation: 10 + 0.50 = 10.50
Display: "10.50"
```

**Example 2: Weapon + Loadout Modifier**
```
Base Attribute: 15
Weapon Bonus: +3
Loadout Modifier: +15% (two_handed)
Calculation: (15 + 3) × 1.15 = 18 × 1.15 = 20.70
Display: "20.70"
```

**Example 3: Full Stack (Weapon + Loadout + Stance)**
```
Base Attribute: 25
Weapon Bonus: +5
Loadout Modifier: +15% (weapon_shield armor bonus)
Stance Modifier: +15% (defensive stance armor bonus)
Calculation: (25 + 5) × 1.15 × 1.15 = 30 × 1.3225 = 39.675
Rounded: 39.67 (Math.round(39.675 × 100) / 100)
Display: "39.67"
```

### Appendix B: Page Layout Wireframes

[Wireframes would be included here in the actual document, showing:]
- Current layout (for comparison)
- New layout (full page)
- Effective stats table detail
- Compact attribute row detail
- Performance statistics section detail

### Appendix C: Database Schema Comparison

**Before (Integer Attributes):**
```sql
CREATE TABLE robots (
  combat_power INTEGER DEFAULT 1,
  targeting_systems INTEGER DEFAULT 1,
  -- ... 21 more INTEGER attributes
);
```

**After (Decimal Attributes):**
```sql
CREATE TABLE robots (
  combat_power DECIMAL(5,2) DEFAULT 1.00,
  targeting_systems DECIMAL(5,2) DEFAULT 1.00,
  -- ... 21 more DECIMAL attributes
);
```

**Storage Impact:**
- Before: 23 attributes × 4 bytes = 92 bytes
- After: 23 attributes × 5 bytes = 115 bytes
- Increase: +23 bytes per robot (+25% attribute storage, <1% total row size)

### Appendix D: Component Hierarchy

```
RobotDetailPage
├── Navigation
├── RobotHeader
│   ├── RobotImage (placeholder)
│   └── RobotInfo (name, ELO, league)
├── BattleConfigurationSection
│   ├── LoadoutSelector
│   ├── WeaponSlots
│   │   ├── WeaponSlot (main)
│   │   └── WeaponSlot (offhand)
│   ├── StanceSelector
│   └── YieldThresholdSlider
├── EffectiveStatsTable ⭐ NEW
│   └── StatTableRow × 23
├── PerformanceStats ⭐ NEW
│   ├── CombatRecord
│   ├── Rankings
│   ├── DamageStatistics
│   ├── CurrentState
│   └── Economic
└── UpgradeRobotSection
    └── AttributeCategory × 5
        ├── CategoryHeader
        └── CompactAttributeRow × varies ⭐ NEW
```

---

## Onboarding: GuidedUIOverlay Integration (Battle-Ready Setup)

**Status**: ✅ **IMPLEMENTED**

**Reference**: See [PRD_ONBOARDING_SYSTEM.md](PRD_ONBOARDING_SYSTEM.md) for complete onboarding system specification.

During onboarding Step 3 (Battle-Ready Setup), the Robot Detail Page integrates with the `GuidedUIOverlay` component to guide new players through weapon equipping and battle readiness concepts.

### When the Overlay Appears

The overlay only appears when all of the following conditions are met:
- User's `hasCompletedOnboarding = false`
- User is on the Battle-Ready Setup step of onboarding
- The onboarding system navigates the player to their robot's detail page

The overlay is never shown for users who have completed or skipped onboarding.

### Overlay Behavior

**Loadout Section Highlighting**:
- The GuidedUIOverlay dims the rest of the page and highlights the Battle Configuration section (⚔️)
- A pulsing border draws attention to the weapon loadout slots
- Tooltip arrows point to the Main Weapon Slot with guidance: "Equip your weapon here to prepare for battle"
- After weapon is equipped, the overlay advances to show updated effective stats

**Weapon Equipping Guidance**:
- Overlay highlights the weapon slot and guides the player to select a weapon from their inventory
- Uses existing `WeaponSlot` and `LoadoutSelector` components with overlay tooltips
- After equipping, shows the stat changes (base → effective with weapon bonuses)

**Battle Readiness Education**:
- After weapon equipping, the overlay teaches key battle readiness concepts:
  - **Repair Cost Formula**: `(sum_of_all_23_attributes × 100) × damage_percentage × multiplier`
  - **Multiplier tiers**: 1.0× normal, 1.5× heavily damaged (<10% HP), 2.0× destroyed (0 HP)
  - **HP/Shield Mechanics**: HP does not regenerate between battles; shields regenerate fully after each battle
  - **Battle Readiness Requirements**: Robot must have HP > 0 and a weapon equipped to participate in battles
- For multi-robot strategies (2 average, 3 flimsy), explains that repair costs multiply across robots

**Example Repair Cost Display**:
```
┌─────────────────────────────────────────────────────────────┐
│ 💡 Understanding Repair Costs                                │
│                                                              │
│ Your robot's repair cost depends on total attributes and    │
│ damage taken:                                                │
│                                                              │
│ Base Repair = (Sum of 23 Attributes × 100)                  │
│ Repair Cost = Base × Damage% × Condition Multiplier         │
│                                                              │
│ Condition Multipliers:                                       │
│   Normal damage:        1.0×                                 │
│   Heavily damaged (<10% HP): 1.5×                           │
│   Destroyed (0 HP):     2.0×                                 │
│                                                              │
│ ⚠️ HP does NOT regenerate between battles!                   │
│ ✅ Shields regenerate fully after each battle.               │
└─────────────────────────────────────────────────────────────┘
```

### Overlay Positioning

- Tooltips use top/bottom positioning relative to the highlighted element
- On mobile (<768px), tooltips use full-width positioning
- Touch targets are at least 44×44px
- Keyboard navigation supported (Tab, Enter, Escape to dismiss)

### Related Components

- `GuidedUIOverlay` - Semi-transparent overlay with element highlighting
- `HPBar` - Reused to show current robot health status
- `BattleReadinessBadge` - Reused to show readiness indicators
- `WeaponSlot` - Existing weapon equipping component
- `LoadoutSelector` - Existing loadout type selector

---

---

## Upload Custom Image Tab (RobotImageSelector Modal)

The existing `RobotImageSelector` modal has been extended with a new "Upload Custom Image" tab alongside the preset image grid.

### Tab Navigation
- **Preset Images** tab: Existing grid of bundled robot images (unchanged)
- **Upload Custom Image** tab: New upload flow for user-provided images

### Upload Flow
1. **File Selection**: User selects a JPEG, PNG, or WebP file (max 2 MB). Frontend validates type and size before upload.
2. **Client-Side Crop Preview**: A 512×512 center-crop preview is rendered immediately using canvas, showing the user what the server will produce. "Upload" and "Cancel" buttons are displayed.
3. **Server Preview**: On "Upload", the file is sent to `POST /api/robots/:id/image`. The server validates, moderates (NSFW hard block + robot-likeness soft warning), and processes the image to 512×512 WebP. A base64 preview and confirmation token are returned.
4. **Confirmation**: User reviews the server-processed preview and clicks "Confirm" to store the image, or "Cancel" to discard.

### Error Handling
- `IMAGE_MODERATION_FAILED` (422): "This image was not approved. Please choose a different image." — no override.
- `LOW_ROBOT_LIKENESS` (422): Warning "This doesn't look like a robot — are you sure?" with "Upload anyway" button. Re-sends with `?acknowledgeRobotLikeness=true`.
- `PREVIEW_EXPIRED` (410): "Preview expired, please re-upload the image."
- `RATE_LIMIT_EXCEEDED` (429): Rate limit message displayed.

### Mobile-Responsive Behavior
- Touch-friendly tap targets (minimum 44×44px)
- Responsive modal layout without horizontal scrolling
- Preview image scales to fit viewport
- File picker accesses device camera roll on iOS/Android via `accept="image/*"`

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-30 | Robert Teunissen | Initial draft |
| 1.1 | 2026-02-10 | Robert Teunissen | Implementation complete |
| 1.2 | 2026-03-05 | GitHub Copilot | Added onboarding GuidedUIOverlay integration (Battle-Ready Setup) |

---

## Approval

**Product Owner**: _________________ Date: _________

**Engineering Lead**: _________________ Date: _________

**Design Lead**: _________________ Date: _________

---

**Next Steps:**
1. Review and approval by stakeholders
2. Technical feasibility review with engineering team
3. Create implementation tickets from this PRD
4. Begin Phase 1 (Database Migration) upon approval

