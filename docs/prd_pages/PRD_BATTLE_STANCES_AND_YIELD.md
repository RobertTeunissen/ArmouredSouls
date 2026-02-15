# Product Requirements Document: Battle Stances and Yield Threshold System

**Last Updated**: January 30, 2026  
**Status**: Implementation Ready  
**Owner**: Robert Teunissen  
**Epic**: Combat Configuration System Implementation

---

## Executive Summary

This PRD defines the requirements for implementing the Battle Stance and Yield Threshold systems for Armoured Souls Phase 1 prototype. These systems enable players to configure their robot's combat behavior and surrender thresholds before battles, providing tactical depth and economic risk management.

**Battle Stances** allow players to choose how their robot approaches combat (Offensive, Defensive, or Balanced), with each stance providing distinct stat modifiers and behavioral changes that affect combat outcomes.

**Yield Threshold** enables players to set an HP percentage where their robot will attempt to surrender, creating a strategic risk/reward decision around repair costs versus victory chances.

**Success Criteria**: Players can configure stance and yield settings through an intuitive interface, see the impact of stance modifiers on stats in real-time, and understand the economic implications of their yield threshold choices.

---

## Background & Context

### Current State

**What Exists:**
- ✅ Complete database schema (Robot model with `stance` and `yieldThreshold` fields)
- ✅ Comprehensive design documentation in ROBOT_ATTRIBUTES.md
- ✅ Battle Stance mechanics fully specified (3 stance types with formulas)
- ✅ Yield Threshold mechanics fully specified (0-50% range with repair cost scaling)
- ✅ Logic Cores attribute integration with yield system
- ✅ Stance modifiers defined (+15% Combat Power, +10% Attack Speed for Offensive, etc.)
- ✅ Repair Bay facility system (5% repair cost discount per level, max 50% at level 10)

**What's Missing:**
- ❌ Stance selection UI on robot detail/configuration page
- ❌ Yield Threshold slider/input UI
- ❌ Backend validation for stance and yield threshold changes
- ❌ Real-time stat preview showing stance modifiers
- ❌ Repair cost calculator showing yield threshold implications
- ❌ Battle preparation/configuration screen
- ❌ Educational tooltips explaining stance and yield mechanics
- ❌ Pre-battle configuration summary
- ❌ Historical tracking of stance/yield performance (future)

### Design References

- **[ROBOT_ATTRIBUTES.md](ROBOT_ATTRIBUTES.md)**: Complete stance and yield threshold specifications (lines 166-340)
- **[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)**: Database structure with stance and yieldThreshold fields
- **[GAME_DESIGN.md](GAME_DESIGN.md)**: Overall game design philosophy and combat principles
- **[STABLE_SYSTEM.md](STABLE_SYSTEM.md)**: Facility system including Repair Bay mechanics and discount formula

### Why These Features Matter

**Battle Stances** provide:
- Tactical flexibility without changing robot builds
- Ability to adapt strategy to different opponents
- Meaningful AI attribute utilization
- Clear risk/reward tradeoffs

**Yield Threshold** provides:
- Economic risk management
- Strategic depth in combat
- Consequence for being too aggressive or too conservative
- Integration with Logic Cores attribute

---

## Goals & Objectives

### Primary Goals

1. **Enable Pre-Battle Configuration**: Players can set stance and yield threshold before battles
2. **Clear Visual Feedback**: Real-time stat preview showing stance effects
3. **Economic Transparency**: Players understand repair cost implications of yield decisions
4. **Intuitive UX**: Simple controls with educational guidance for new players

### Success Metrics

- Players successfully configure stance and yield settings without confusion
- 80%+ of players adjust stance/yield at least once in first 5 battles
- Stance modifiers display correctly and update robot stats in real-time
- Repair cost preview accurately reflects yield threshold choices
- No bugs or edge cases in stance/yield validation

### Non-Goals (Out of Scope for This PRD)

- ❌ In-battle stance changes (stances are set before battle, not during)
- ❌ Advanced stance types beyond the 3 core options
- ❌ Yield threshold automation based on opponent strength
- ❌ Historical analytics for stance/yield performance (future enhancement)
- ❌ Team battle stance coordination (future for 2v2+)

---

## User Stories

### Epic: Pre-Battle Configuration

**US-1: Select Battle Stance**
```
As a player
I want to choose my robot's battle stance before a fight
So that I can adapt my tactics to different opponents and situations

Acceptance Criteria:
- I can select from 3 stance options: Offensive, Defensive, Balanced
- Each stance displays clear description of behavior
- Stat modifiers are shown for each stance (+15% Combat Power, etc.)
- My robot's effective stats update in real-time when I change stance
- Stance selection persists across battles until I change it
- Default stance is "Balanced" for new robots
```

**US-2: Set Yield Threshold**
```
As a player
I want to set the HP percentage where my robot will attempt to surrender
So that I can manage repair costs and avoid total destruction

Acceptance Criteria:
- I can set yield threshold from 0% to 50% using a slider or numeric input
- Default threshold is 10% for new robots
- I see estimated repair cost differences for various threshold values
- Clear explanation of what happens when threshold is reached
- Warning shown for aggressive thresholds (0-5%) explaining destruction risk
- Threshold persists across battles until I change it
```

**US-3: View Stance Modifiers in Real-Time**
```
As a player
I want to see how my stance choice affects my robot's stats
So that I understand the tactical impact of my decision

Acceptance Criteria:
- Robot stats display shows base value, stance modifier, and final value
- Positive modifiers shown in green (+15% Combat Power)
- Negative modifiers shown in red (-10% Attack Speed)
- "Net Effect" or "Effective Stats" section clearly visible
- Stance modifiers apply to displayed stats immediately
- Tooltip explains how each modifier works in combat
```

**US-4: Understand Repair Cost Implications**
```
As a player
I want to see how my yield threshold affects repair costs
So that I can make informed economic decisions

Acceptance Criteria:
- Repair cost preview shows costs for different HP scenarios
- Examples: "At 15% HP: ₡19,550" vs "Destroyed (0% HP): ₡46,000"
- Visual indicator shows risk level (green/yellow/red) for threshold
- Tooltip explains 2.0x multiplier for total destruction
- Calculator factors in my robot's total attribute points
- Calculator applies Repair Bay multi-robot discount if facility is upgraded (Level × (5 + Active Robots), capped at 90%)
- Display shows both base cost and discounted cost when Repair Bay is active
- Display shows how discount increases with robot count
- Clear explanation that yielding prevents destruction multiplier
```

**US-5: Pre-Battle Configuration Screen**
```
As a player
I want a dedicated screen to configure my robot before battle
So that I can review and adjust all settings in one place

Acceptance Criteria:
- Battle preparation screen accessible from robot detail or match queue
- Shows: Current loadout, equipped weapons, stance, yield threshold
- I can change stance and yield without leaving the screen
- "Ready for Battle" button confirms configuration
- Warning if robot is heavily damaged (low HP) before battle
- Ability to cancel and return to robot management
```

**US-6: Educational Tooltips and Guidance**
```
As a player (especially new)
I want helpful explanations of stance and yield mechanics
So that I can make good decisions without reading full documentation

Acceptance Criteria:
- "?" icons or hover tooltips on stance and yield controls
- Brief explanation of each stance's tactical approach
- Examples of when to use each stance
- Yield threshold guidance: "10-20% for balanced play"
- Link to full documentation for advanced details
- First-time user sees guided walkthrough (dismissible)
```

---

## Functional Requirements

### FR-1: Stance Configuration API

**Backend Endpoints Required:**

```
PATCH /api/robots/:robotId/stance
Body: { stance: 'offensive' | 'defensive' | 'balanced' }
- Validates stance is one of the 3 allowed values
- Updates robot.stance field
- Recalculates robot effective stats with stance modifiers
- Returns updated robot object
- No authorization check needed beyond robot ownership
```

**Stance Validation Rules:**
- Stance must be exactly one of: "offensive", "defensive", "balanced"
- Case-insensitive input, stored in lowercase
- Cannot be null/empty (defaults to "balanced")
- No restrictions on changing stance (can change anytime)

### FR-2: Yield Threshold Configuration API

**Backend Endpoints Required:**

```
PATCH /api/robots/:robotId/yield-threshold
Body: { yieldThreshold: number }
- Validates yieldThreshold is between 0 and 50 (inclusive)
- Updates robot.yieldThreshold field
- Returns updated robot object
- No complex validation beyond range check
```

**Yield Threshold Validation Rules:**
- Must be a number between 0 and 50 (inclusive)
- Decimal values allowed (e.g., 12.5)
- Default value: 10
- Cannot exceed 50 (game design limit)

### FR-3: Stat Calculation with Stance Modifiers

**Implementation Required:**

The system must apply stance modifiers to robot stats for display purposes. These calculations happen on-the-fly when displaying stats, not stored in database.

**Offensive Stance Modifiers:**
```javascript
effectiveCombatPower = baseCombatPower * 1.15      // +15%
effectiveAttackSpeed = baseAttackSpeed * 1.10      // +10%
effectiveCounterProtocols = baseCounterProtocols * 0.90  // -10%
effectiveEvasionThrusters = baseEvasionThrusters * 0.90  // -10%
```

**Defensive Stance Modifiers:**
```javascript
effectiveArmorPlating = baseArmorPlating * 1.15    // +15%
effectiveCounterProtocols = baseCounterProtocols * 1.15  // +15%
effectiveShieldRegen = baseShieldRegen * 1.20      // +20%
effectiveCombatPower = baseCombatPower * 0.90      // -10%
effectiveAttackSpeed = baseAttackSpeed * 0.90      // -10%
```

**Balanced Stance Modifiers:**
```javascript
// No modifiers - all stats at base values
```

### FR-4: Repair Cost Preview Calculation

**Implementation Required:**

Calculate estimated repair costs for different HP scenarios based on yield threshold.

**Formula:**
```javascript
baseRepairCost = sumOfAllAttributes * 100

// Scenario calculations
function calculateRepairCost(damagePercent, hpPercent, repairBayLevel = 0, activeRobotCount = 0) {
  let multiplier = 1.0;
  
  if (hpPercent === 0) {
    // Total destruction
    multiplier = 2.0;
  } else if (hpPercent < 10) {
    // Heavily damaged
    multiplier = 1.5;
  }
  
  // Calculate base repair cost
  const rawCost = baseRepairCost * (damagePercent / 100) * multiplier;
  
  // Apply Repair Bay multi-robot discount (capped at 90%)
  const rawDiscount = repairBayLevel * (5 + activeRobotCount);
  const repairBayDiscount = Math.min(rawDiscount, 90) / 100;
  const finalCost = rawCost * (1 - repairBayDiscount);
  
  return finalCost;
}

// Examples for display (single robot, no Repair Bay)
- At 100% damage (destroyed): baseRepairCost × 1.0 × 2.0
- At 95% damage (5% HP): baseRepairCost × 0.95 × 1.5
- At 85% damage (15% HP): baseRepairCost × 0.85 × 1.0
- At 60% damage (40% HP): baseRepairCost × 0.60 × 1.0

// Examples with Repair Bay Level 5 + 7 robots (60% discount)
- At 100% damage (destroyed): baseRepairCost × 1.0 × 2.0 × 0.40 = ₡18,400 (vs ₡46,000)
- At 85% damage (15% HP): baseRepairCost × 0.85 × 1.0 × 0.40 = ₡7,820 (vs ₡19,550)
```

**Note**: The Repair Bay discount is applied AFTER the damage and destruction multipliers are calculated. The multi-robot discount formula (Level × (5 + Active Robots), capped at 90%) makes the Repair Bay significantly more valuable for players with multiple robots.

### FR-5: Default Values

**For New Robots:**
- Stance: "balanced"
- Yield Threshold: 10

**For Existing Robots (migration):**
- If stance is null: set to "balanced"
- If yieldThreshold is null: set to 10

---

## Technical Design

### API Endpoints Specification

#### 1. Update Robot Stance

**Endpoint:** `PATCH /api/robots/:robotId/stance`

**Request:**
```json
{
  "stance": "offensive"
}
```

**Response (Success):**
```json
{
  "id": "robot-123",
  "name": "BattleBot",
  "stance": "offensive",
  "yieldThreshold": 10,
  "combatPower": 25,
  "attackSpeed": 20,
  // ... other attributes
}
```

**Response (Error):**
```json
{
  "error": "Invalid stance. Must be one of: offensive, defensive, balanced",
  "code": "INVALID_STANCE"
}
```

**Error Codes:**
- 400: Invalid stance value
- 404: Robot not found
- 403: Not authorized to modify this robot

#### 2. Update Yield Threshold

**Endpoint:** `PATCH /api/robots/:robotId/yield-threshold`

**Request:**
```json
{
  "yieldThreshold": 15
}
```

**Response (Success):**
```json
{
  "id": "robot-123",
  "name": "BattleBot",
  "stance": "offensive",
  "yieldThreshold": 15,
  // ... other attributes
}
```

**Response (Error):**
```json
{
  "error": "Yield threshold must be between 0 and 50",
  "code": "INVALID_YIELD_THRESHOLD"
}
```

**Error Codes:**
- 400: Invalid yield threshold value (out of range or not a number)
- 404: Robot not found
- 403: Not authorized to modify this robot

#### 3. Get Robot with Effective Stats

**Endpoint:** `GET /api/robots/:robotId?includeEffectiveStats=true`

**Response:**
```json
{
  "id": "robot-123",
  "name": "BattleBot",
  "stance": "offensive",
  "yieldThreshold": 10,
  "attributes": {
    "combatPower": 25,
    "attackSpeed": 20,
    "counterProtocols": 15,
    "evasionThrusters": 18,
    // ... other base attributes
  },
  "effectiveStats": {
    "combatPower": 28.75,      // 25 * 1.15
    "attackSpeed": 22,          // 20 * 1.10
    "counterProtocols": 13.5,   // 15 * 0.90
    "evasionThrusters": 16.2,   // 18 * 0.90
    // ... other effective stats
  },
  "stanceModifiers": {
    "combatPower": "+15%",
    "attackSpeed": "+10%",
    "counterProtocols": "-10%",
    "evasionThrusters": "-10%"
  }
}
```

### Frontend Components

#### StanceSelector Component

**Location:** `prototype/frontend/src/components/StanceSelector.tsx`

**Props:**
```typescript
interface StanceSelectorProps {
  currentStance: 'offensive' | 'defensive' | 'balanced';
  onStanceChange: (stance: string) => void;
  showModifiers?: boolean;
}
```

**Features:**
- Radio buttons or card-based selection for 3 stances
- Visual icons for each stance (sword, shield, scales)
- Displays stat modifiers when stance is selected
- Tooltips explaining each stance's behavior

#### YieldThresholdSlider Component

**Location:** `prototype/frontend/src/components/YieldThresholdSlider.tsx`

**Props:**
```typescript
interface YieldThresholdSliderProps {
  currentThreshold: number;
  onThresholdChange: (threshold: number) => void;
  robotAttributes: RobotAttributes;  // For repair cost calculation
}
```

**Features:**
- Slider input (0-50 range) with numeric display
- Color-coded risk indicator (green 20-50, yellow 10-20, red 0-10)
- Repair cost preview table showing 3-4 scenarios
- Warning message for very low thresholds (0-5)

#### EffectiveStatsDisplay Component

**Location:** `prototype/frontend/src/components/EffectiveStatsDisplay.tsx`

**Props:**
```typescript
interface EffectiveStatsDisplayProps {
  baseStats: RobotAttributes;
  stance: 'offensive' | 'defensive' | 'balanced';
  showBreakdown?: boolean;
}
```

**Features:**
- Displays base stats, modifiers, and effective stats
- Color-coding for positive (green) and negative (red) modifiers
- Expandable/collapsible detailed breakdown
- Tooltip on each stat explaining the calculation

#### BattleConfigurationPanel Component

**Location:** `prototype/frontend/src/components/BattleConfigurationPanel.tsx`

**Props:**
```typescript
interface BattleConfigurationPanelProps {
  robot: Robot;
  onSave: (config: { stance: string; yieldThreshold: number }) => void;
  onCancel: () => void;
}
```

**Features:**
- Combines StanceSelector and YieldThresholdSlider
- Shows current loadout and equipped weapons (read-only)
- Displays effective stats with stance modifiers
- "Save Configuration" and "Cancel" buttons
- Warnings for damaged robots or risky settings

### Database Considerations

**No schema changes needed** - Both `stance` and `yieldThreshold` fields already exist in the Robot model:

```prisma
model Robot {
  // ... other fields
  stance          String  @default("balanced")  // offensive, defensive, balanced
  yieldThreshold  Int     @default(10)          // 0-50
  // ... other fields
}
```

**Migration needed only if:**
- Existing robots have null values for stance or yieldThreshold
- In that case, run a data migration to set defaults

---

## UI/UX Specifications

### Stance Selector Design

**Layout:** Horizontal card selection (3 cards side-by-side on desktop, stacked on mobile)

**Each Card Contains:**
- Large icon (⚔️ Offensive, 🛡️ Defensive, ⚖️ Balanced)
- Stance name in bold
- 1-2 sentence behavior description
- List of stat modifiers with +/- indicators
- Selected card has highlighted border and background

**Example Card (Offensive):**
```
┌─────────────────────────────┐
│         ⚔️                  │
│    OFFENSIVE STANCE          │
│                              │
│ Prioritize attacks and       │
│ aggressive positioning       │
│                              │
│ ✅ +15% Combat Power         │
│ ✅ +10% Attack Speed         │
│ ❌ -10% Counter Protocols    │
│ ❌ -10% Evasion Thrusters    │
└─────────────────────────────┘
```

### Yield Threshold Slider Design

**Layout:** Vertical panel with slider, numeric input, and preview table

**Components:**
1. **Slider Input**
   - Range: 0-50
   - Step: 1
   - Current value displayed prominently above slider
   - Color-coded track (green → yellow → red)

2. **Risk Indicator**
   - Badge or pill showing risk level
   - "Conservative (30%+)", "Balanced (10-30%)", "Aggressive (0-10%)"
   - Color matches risk level

3. **Repair Cost Preview Table**
```
┌────────────────────────────────────────────────────┐
│  Repair Cost Scenarios                             │
│  (Based on your robot's attributes)                │
│  Repair Bay Level 5 Active: 25% discount           │
├────────────────────────────────────────────────────┤
│  ✅ Victory (40% HP)      ₡10,350 (was ₡13,800)   │
│  ⚠️  Yield at 15% HP      ₡14,662 (was ₡19,550)   │
│  ⚠️  Heavily Damaged (5%) ₡24,581 (was ₡32,775)   │
│  ❌ Destroyed (0% HP)     ₡34,500 (was ₡46,000)   │
└────────────────────────────────────────────────────┘

Note: If no Repair Bay is built, show costs without discount.
If Repair Bay exists, show discounted cost with original in parentheses.
```

4. **Warning Messages** (conditional)
   - Threshold 0-5%: "⚠️ High risk of destruction! 2x repair cost."
   - Threshold 40-50%: "ℹ️ Conservative setting. You'll yield frequently."

### Effective Stats Display Design

**Layout:** Two-column comparison table (desktop) or expandable section (mobile)

**Structure:**
```
┌─────────────────────────────────────────────────────┐
│  Attribute Name      Base  →  Modifier  →  Effective│
├─────────────────────────────────────────────────────┤
│  Combat Power         25   →   +15%    →    28.75   │
│  Attack Speed         20   →   +10%    →    22.00   │
│  Counter Protocols    15   →   -10%    →    13.50   │
│  Evasion Thrusters    18   →   -10%    →    16.20   │
│  Armor Plating        22   →    --     →    22.00   │
└─────────────────────────────────────────────────────┘
```

**Visual Indicators:**
- Positive modifiers: Green text and "↑" arrow
- Negative modifiers: Red text and "↓" arrow
- No change: Gray text and "--"
- Effective stat shown in bold

### Battle Configuration Panel Layout

**Page/Modal Structure:**
```
┌──────────────────────────────────────────────────────┐
│  Battle Configuration: [Robot Name]                  │
├──────────────────────────────────────────────────────┤
│                                                       │
│  Current Status:                                     │
│  HP: 245/250 (98%) ✅                                │
│  Shield: 40/40 (100%)                                │
│  Loadout: Weapon + Shield                            │
│  Equipped: Combat Shield + Power Sword               │
│                                                       │
├──────────────────────────────────────────────────────┤
│                                                       │
│  ⚔️ Battle Stance                                    │
│  [Offensive Card] [Defensive Card] [Balanced Card]   │
│                                                       │
├──────────────────────────────────────────────────────┤
│                                                       │
│  🏳️ Yield Threshold: 15%                            │
│  [━━━━━●━━━━━━━━━━] 0% ──────────── 50%             │
│                                                       │
│  Repair Cost Preview:                                │
│  Repair Bay Level 5: 25% discount                   │
│  - Victory (40% HP): ₡10,350 (was ₡13,800)          │
│  - Yield at 15%: ₡14,662 (was ₡19,550)              │
│  - Destroyed: ₡34,500 (was ₡46,000)                 │
│                                                       │
├──────────────────────────────────────────────────────┤
│                                                       │
│  📊 Effective Stats with Offensive Stance            │
│  [Expandable stats table]                            │
│                                                       │
├──────────────────────────────────────────────────────┤
│                                                       │
│  [Cancel]                        [Ready for Battle]  │
│                                                       │
└──────────────────────────────────────────────────────┘
```

---

## Testing Requirements

### Unit Tests

**Backend Tests (Jest):**

```typescript
describe('Stance Configuration', () => {
  it('should update robot stance to offensive', async () => {
    const response = await request(app)
      .patch('/api/robots/robot-123/stance')
      .set('Authorization', `Bearer ${token}`)
      .send({ stance: 'offensive' });
    
    expect(response.status).toBe(200);
    expect(response.body.stance).toBe('offensive');
  });
  
  it('should reject invalid stance value', async () => {
    const response = await request(app)
      .patch('/api/robots/robot-123/stance')
      .set('Authorization', `Bearer ${token}`)
      .send({ stance: 'super_aggressive' });
    
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Invalid stance');
  });
  
  it('should handle case-insensitive stance input', async () => {
    const response = await request(app)
      .patch('/api/robots/robot-123/stance')
      .set('Authorization', `Bearer ${token}`)
      .send({ stance: 'DEFENSIVE' });
    
    expect(response.status).toBe(200);
    expect(response.body.stance).toBe('defensive');
  });
});

describe('Yield Threshold Configuration', () => {
  it('should update yield threshold to 25', async () => {
    const response = await request(app)
      .patch('/api/robots/robot-123/yield-threshold')
      .set('Authorization', `Bearer ${token}`)
      .send({ yieldThreshold: 25 });
    
    expect(response.status).toBe(200);
    expect(response.body.yieldThreshold).toBe(25);
  });
  
  it('should reject yield threshold above 50', async () => {
    const response = await request(app)
      .patch('/api/robots/robot-123/yield-threshold')
      .set('Authorization', `Bearer ${token}`)
      .send({ yieldThreshold: 75 });
    
    expect(response.status).toBe(400);
  });
  
  it('should reject negative yield threshold', async () => {
    const response = await request(app)
      .patch('/api/robots/robot-123/yield-threshold')
      .set('Authorization', `Bearer ${token}`)
      .send({ yieldThreshold: -5 });
    
    expect(response.status).toBe(400);
  });
  
  it('should accept decimal yield threshold', async () => {
    const response = await request(app)
      .patch('/api/robots/robot-123/yield-threshold')
      .set('Authorization', `Bearer ${token}`)
      .send({ yieldThreshold: 12.5 });
    
    expect(response.status).toBe(200);
    expect(response.body.yieldThreshold).toBe(12.5);
  });
});

describe('Stance Modifier Calculations', () => {
  it('should calculate offensive stance modifiers correctly', () => {
    const baseStats = { combatPower: 20, attackSpeed: 15 };
    const effectiveStats = calculateEffectiveStats(baseStats, 'offensive');
    
    expect(effectiveStats.combatPower).toBe(23);  // 20 * 1.15
    expect(effectiveStats.attackSpeed).toBe(16.5); // 15 * 1.10
  });
  
  it('should not apply modifiers for balanced stance', () => {
    const baseStats = { combatPower: 20, attackSpeed: 15 };
    const effectiveStats = calculateEffectiveStats(baseStats, 'balanced');
    
    expect(effectiveStats.combatPower).toBe(20);
    expect(effectiveStats.attackSpeed).toBe(15);
  });
});

describe('Repair Cost Calculations', () => {
  it('should calculate 2x multiplier for total destruction', () => {
    const baseRepair = 23000;  // 230 total attributes
    const cost = calculateRepairCost(baseRepair, 100, 0); // 100% damage, 0% HP, no Repair Bay
    
    expect(cost).toBe(46000);  // 23000 * 1.0 * 2.0
  });
  
  it('should calculate 1.5x multiplier for heavy damage', () => {
    const baseRepair = 23000;
    const cost = calculateRepairCost(baseRepair, 95, 5); // 95% damage, 5% HP, no Repair Bay
    
    expect(cost).toBe(32775);  // 23000 * 0.95 * 1.5
  });
  
  it('should calculate no multiplier for normal yield', () => {
    const baseRepair = 23000;
    const cost = calculateRepairCost(baseRepair, 85, 15); // 85% damage, 15% HP, no Repair Bay
    
    expect(cost).toBe(19550);  // 23000 * 0.85 * 1.0
  });
  
  it('should apply Repair Bay discount correctly', () => {
    const baseRepair = 23000;
    const cost = calculateRepairCost(baseRepair, 100, 0, 5); // 100% damage, 0% HP, Repair Bay Level 5
    
    expect(cost).toBe(34500);  // 23000 * 1.0 * 2.0 * 0.75 (25% discount)
  });
  
  it('should cap Repair Bay discount at 50%', () => {
    const baseRepair = 23000;
    const cost = calculateRepairCost(baseRepair, 100, 0, 10); // Repair Bay Level 10
    
    expect(cost).toBe(23000);  // 23000 * 1.0 * 2.0 * 0.5 (50% discount max)
  });
  
  it('should apply Repair Bay discount after damage multipliers', () => {
    const baseRepair = 23000;
    const costLevel5 = calculateRepairCost(baseRepair, 85, 15, 5); // Repair Bay Level 5
    
    expect(costLevel5).toBe(14662.5);  // 23000 * 0.85 * 1.0 * 0.75
  });
});
```

**Frontend Tests (Jest + React Testing Library):**

```typescript
describe('StanceSelector Component', () => {
  it('should render 3 stance options', () => {
    render(<StanceSelector currentStance="balanced" onStanceChange={jest.fn()} />);
    
    expect(screen.getByText('Offensive')).toBeInTheDocument();
    expect(screen.getByText('Defensive')).toBeInTheDocument();
    expect(screen.getByText('Balanced')).toBeInTheDocument();
  });
  
  it('should highlight current stance', () => {
    render(<StanceSelector currentStance="offensive" onStanceChange={jest.fn()} />);
    
    const offensiveCard = screen.getByText('Offensive').closest('div');
    expect(offensiveCard).toHaveClass('selected');
  });
  
  it('should call onStanceChange when stance clicked', () => {
    const handleChange = jest.fn();
    render(<StanceSelector currentStance="balanced" onStanceChange={handleChange} />);
    
    fireEvent.click(screen.getByText('Defensive'));
    expect(handleChange).toHaveBeenCalledWith('defensive');
  });
});

describe('YieldThresholdSlider Component', () => {
  it('should display current threshold value', () => {
    render(
      <YieldThresholdSlider 
        currentThreshold={15} 
        onThresholdChange={jest.fn()} 
        robotAttributes={mockAttributes}
      />
    );
    
    expect(screen.getByText('15%')).toBeInTheDocument();
  });
  
  it('should show repair cost preview', () => {
    render(
      <YieldThresholdSlider 
        currentThreshold={10} 
        onThresholdChange={jest.fn()} 
        robotAttributes={mockAttributes}
      />
    );
    
    expect(screen.getByText(/Victory/)).toBeInTheDocument();
    expect(screen.getByText(/Destroyed/)).toBeInTheDocument();
  });
  
  it('should show warning for very low threshold', () => {
    render(
      <YieldThresholdSlider 
        currentThreshold={3} 
        onThresholdChange={jest.fn()} 
        robotAttributes={mockAttributes}
      />
    );
    
    expect(screen.getByText(/High risk/)).toBeInTheDocument();
  });
});
```

### Integration Tests

**Battle Configuration Flow:**

```typescript
describe('Battle Configuration Integration', () => {
  it('should allow player to configure stance and yield, then save', async () => {
    const { user } = await setupAuthenticatedUser();
    const robot = await createRobotForUser(user);
    
    // Navigate to robot detail page
    render(<RobotDetailPage robotId={robot.id} />);
    
    // Open battle configuration
    const configButton = screen.getByText('Configure for Battle');
    fireEvent.click(configButton);
    
    // Select offensive stance
    fireEvent.click(screen.getByText('Offensive'));
    
    // Set yield threshold to 20
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: 20 } });
    
    // Save configuration
    fireEvent.click(screen.getByText('Ready for Battle'));
    
    // Verify API calls
    await waitFor(() => {
      expect(mockApi.updateStance).toHaveBeenCalledWith(robot.id, 'offensive');
      expect(mockApi.updateYieldThreshold).toHaveBeenCalledWith(robot.id, 20);
    });
    
    // Verify UI updates
    expect(screen.getByText('Offensive')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
  });
});
```

### Manual Testing Scenarios

**Scenario 1: First-Time Configuration**
1. Create new robot (should default to Balanced stance, 10% yield)
2. Navigate to Battle Configuration panel
3. Verify default values displayed
4. Change to Offensive stance
5. Verify stat modifiers appear (+15% Combat Power, etc.)
6. Adjust yield threshold to 25%
7. Verify repair cost preview updates
8. Save configuration
9. Verify changes persist on robot detail page

**Scenario 2: Stance Comparison**
1. Open Battle Configuration for existing robot
2. Select Offensive stance, note effective stats
3. Switch to Defensive stance, verify stats change
4. Switch to Balanced stance, verify no modifiers
5. Select Offensive again, verify consistency

**Scenario 3: Yield Threshold Economics**
1. Configure robot with 230 total attributes
2. Set yield threshold to 5% (aggressive)
3. Verify repair cost preview shows high destruction cost (₡46,000)
4. Adjust to 20% (balanced)
5. Verify repair costs become more reasonable
6. Adjust to 40% (conservative)
7. Verify lowest repair costs but more frequent yields

**Scenario 4: Mobile Responsiveness**
1. Open Battle Configuration on mobile device
2. Verify stance cards stack vertically
3. Verify yield slider is easily adjustable
4. Verify stats table is readable
5. Verify all touch interactions work smoothly

---

## Implementation Plan

### Phase 1: Backend API (Week 1)

**Tasks:**
1. Create `PATCH /api/robots/:robotId/stance` endpoint
   - Input validation (offensive/defensive/balanced)
   - Case-insensitive handling
   - Update database
   - Return updated robot
2. Create `PATCH /api/robots/:robotId/yield-threshold` endpoint
   - Range validation (0-50)
   - Decimal support
   - Update database
   - Return updated robot
3. Add stance modifier calculation utility
   - `calculateEffectiveStats(baseStats, stance)` function
   - Apply multipliers per stance type
   - Return effective stats object
4. Add repair cost preview utility
   - `calculateRepairCost(baseRepair, damagePercent, hpPercent)` function
   - Handle 2.0x, 1.5x, 1.0x multipliers
   - Return cost breakdown
5. Write unit tests for all endpoints and utilities
6. Write integration tests for API flows

**Acceptance Criteria:**
- All API endpoints work correctly with proper validation
- Stance modifiers calculate accurately for all 3 stances
- Repair cost formulas match specification exactly
- 100% test coverage for new code
- API documentation updated

### Phase 2: Frontend Components (Week 2)

**Tasks:**
1. Create `StanceSelector.tsx` component
   - Three-card layout with icons
   - Display stat modifiers
   - Handle selection and callbacks
   - Mobile-responsive layout
2. Create `YieldThresholdSlider.tsx` component
   - Slider with 0-50 range
   - Numeric display
   - Risk indicator
   - Repair cost preview table
   - Warning messages for extreme values
3. Create `EffectiveStatsDisplay.tsx` component
   - Base → Modifier → Effective layout
   - Color-coded positive/negative
   - Expandable/collapsible
   - Tooltips on stats
4. Create `BattleConfigurationPanel.tsx` component
   - Combine all sub-components
   - Show current robot status
   - Save/cancel functionality
   - Integration with API
5. Add routing and navigation
   - Link from robot detail page
   - Breadcrumb navigation
   - Back button handling

**Acceptance Criteria:**
- All components render correctly on desktop and mobile
- Stance selection updates stats in real-time
- Yield slider adjusts repair cost preview dynamically
- Save button persists changes to backend
- Visual polish matches design specifications
- Accessibility standards met (ARIA labels, keyboard navigation)

### Phase 3: Integration & Polish (Week 3)

**Tasks:**
1. Integrate Battle Configuration panel into robot detail page
   - Add "Configure for Battle" button
   - Modal or dedicated panel
   - Save changes back to robot detail
2. Add educational tooltips and help text
   - Stance descriptions with examples
   - Yield threshold guidance
   - First-time user walkthrough
3. Add validation and error handling
   - Network error recovery
   - Invalid input handling
   - Loading states
4. Update robot detail page to display current stance and yield
   - Badge or indicator for stance
   - Yield percentage shown
   - Quick-edit option
5. Add confirmation dialogs for risky settings
   - Yield threshold 0-5%: Warn about destruction risk
   - Low HP robot going into battle: Suggest repair
6. Performance optimization
   - Debounce slider changes
   - Memoize stat calculations
   - Optimize re-renders

**Acceptance Criteria:**
- Battle Configuration accessible from all relevant pages
- All edge cases handled gracefully
- Error messages clear and actionable
- Performance smooth with no lag
- User testing feedback incorporated
- Documentation complete

### Phase 4: Testing & Documentation (Week 4)

**Tasks:**
1. Comprehensive manual testing
   - Test all user flows end-to-end
   - Test on multiple devices and browsers
   - Test edge cases and error conditions
2. User acceptance testing (UAT)
   - Get feedback from 5-10 players
   - Iterate on UX issues
   - Fix bugs discovered
3. Update documentation
   - Add Battle Configuration to user guide
   - Update API documentation
   - Create video tutorial (optional)
4. Performance testing
   - Load test API endpoints
   - Test with 100+ robots
   - Optimize queries if needed
5. Accessibility audit
   - Screen reader testing
   - Keyboard navigation verification
   - Color contrast check

**Acceptance Criteria:**
- Zero critical bugs remaining
- UAT feedback positive (80%+ satisfaction)
- Documentation complete and accurate
- Performance meets targets (<100ms API response)
- Accessibility WCAG 2.1 AA compliant

---

## Success Criteria

### Must-Have (Launch Blockers)

✅ **Core Functionality:**
- Players can select Offensive, Defensive, or Balanced stance
- Players can set yield threshold from 0-50%
- Stance modifiers calculate correctly for all attributes
- Repair cost preview shows accurate costs
- Changes persist to database correctly

✅ **User Experience:**
- Battle Configuration panel accessible from robot detail
- Stance and yield settings display clearly
- Real-time stat preview updates immediately
- Mobile-responsive layout works smoothly

✅ **Technical Quality:**
- All API endpoints tested and validated
- Frontend components tested (unit + integration)
- No critical bugs or edge case failures
- Performance acceptable (<200ms for stat calculations)

### Should-Have (Post-Launch)

⭐ **Enhanced UX:**
- Educational tooltips and first-time walkthrough
- Historical performance tracking by stance
- Stance recommendations based on opponent
- Advanced repair cost calculator with "what-if" scenarios

⭐ **Quality of Life:**
- Preset stance/yield configurations (save favorites)
- Quick-toggle stance from robot list view
- Bulk configure multiple robots at once
- Stance comparison tool (side-by-side)

### Nice-to-Have (Future Enhancements)

💡 **Advanced Features:**
- AI-suggested stance based on opponent analysis
- Dynamic yield threshold automation (AI adjusts based on battle)
- Team battle stance coordination (2v2+)
- Stance-specific achievements and titles

---

## Open Questions & Decisions Needed

### Resolved

✅ **Q: Should stance be changeable during battle?**  
**A:** No. Stance is set before battle and cannot change mid-battle. This keeps combat deterministic and prevents exploitation.

✅ **Q: Should there be a cooldown on stance changes?**  
**A:** No. Players can change stance freely between battles. No restrictions or cooldowns.

✅ **Q: What happens if a robot is configured with 0% yield threshold?**  
**A:** The robot will never attempt to yield, fighting until destroyed. This results in 2.0x repair cost multiplier if HP reaches 0.

✅ **Q: Should we enforce minimum Logic Cores for low yield thresholds?**  
**A:** No. Any robot can set any yield threshold regardless of Logic Cores. However, low Logic Cores will suffer penalties when damaged.

### Pending

❓ **Q: Should we show historical performance data by stance?**  
**Discussion:** Would help players optimize, but adds complexity. Defer to post-launch?  
**Decision:** ✅ **APPROVED** - Defer to Phase 2. Track data in background for future feature. Historical tracking must be implemented to support future analytics.

❓ **Q: Should there be stance-specific achievements?**  
**Discussion:** "Win 10 battles with Offensive stance", etc. Good for engagement.  
**Decision:** ✅ **APPROVED** - Add after core system is stable, during gamification phase (not Phase 1). Track stance usage data to support future achievements.

❓ **Q: Should team battles (2v2+) require coordinated stances?**  
**Discussion:** Could add tactical depth, but may be too complex for initial launch.  
**Decision:** ✅ **APPROVED** - Defer until team battle system is implemented in Phase 2 (not Phase 1). Nice team feature for future development.

---

## Risks & Mitigations

### Technical Risks

**Risk 1: Stat calculation performance with many modifiers**
- **Impact:** High (affects UX)
- **Likelihood:** Low
- **Mitigation:** Memoize calculations, benchmark with 50+ attributes, optimize if needed

**Risk 2: Database migration for existing robots with null stance/yield**
- **Impact:** Medium (data integrity)
- **Likelihood:** High (if existing data has nulls)
- **Mitigation:** Run data migration script before deployment, set defaults for all nulls

**Risk 3: Frontend state management complexity with real-time updates**
- **Impact:** Medium (UX bugs)
- **Likelihood:** Medium
- **Mitigation:** Use React state carefully, add comprehensive tests, review code carefully

### UX Risks

**Risk 4: Players don't understand stance modifiers**
- **Impact:** High (feature underutilized)
- **Likelihood:** Medium
- **Mitigation:** Clear tooltips, examples, tutorial, and educational content

**Risk 5: Yield threshold economics are confusing**
- **Impact:** Medium (poor decisions)
- **Likelihood:** Medium
- **Mitigation:** Repair cost preview, examples, warnings, and documentation

**Risk 6: Too many configuration options overwhelm new players**
- **Impact:** Medium (analysis paralysis)
- **Likelihood:** Low
- **Mitigation:** Good defaults (Balanced + 10%), optional advanced settings, gradual disclosure

### Business Risks

**Risk 7: Feature not used frequently enough to justify development**
- **Impact:** Medium (wasted effort)
- **Likelihood:** Low
- **Mitigation:** Quick user testing, MVP approach, analytics tracking post-launch

---

## Dependencies & Assumptions

### Dependencies

- ✅ Database schema with `stance` and `yieldThreshold` fields (already exists)
- ✅ Robot attributes system fully implemented (already exists)
- ✅ Authentication and authorization system (already exists)
- ⏳ Robot detail page where configuration panel will be integrated
- ⏳ Battle system to actually use stance and yield data (separate epic)

### Assumptions

- Players understand basic RPG/strategy game mechanics (stats, bonuses, penalties)
- Players have economic incentive to manage repair costs carefully
- Battle system will respect stance and yield settings when implemented
- Database can handle frequent small updates to stance/yield without performance issues
- Frontend can calculate stat modifiers in real-time without lag

---

## Metrics & Analytics

### Key Performance Indicators (KPIs)

**Adoption Metrics:**
- % of players who configure stance/yield at least once
- Average number of stance changes per player per week
- Distribution of stance preferences (Offensive vs Defensive vs Balanced)
- Distribution of yield threshold values

**Engagement Metrics:**
- Time spent on Battle Configuration panel
- Number of stance changes before first battle
- Correlation between stance choice and battle outcomes
- Correlation between yield threshold and actual repair costs

**Economic Metrics:**
- Average repair costs by yield threshold setting
- % of battles ending in yield vs destruction
- Credits saved/lost by yield threshold optimization
- Player satisfaction with repair cost system

### Analytics Implementation

**Events to Track:**
```javascript
// Stance changes
analytics.track('stance_changed', {
  robotId: string,
  previousStance: string,
  newStance: string,
  timestamp: Date
});

// Yield threshold changes
analytics.track('yield_threshold_changed', {
  robotId: string,
  previousThreshold: number,
  newThreshold: number,
  timestamp: Date
});

// Battle configuration saves
analytics.track('battle_config_saved', {
  robotId: string,
  stance: string,
  yieldThreshold: number,
  timestamp: Date
});

// Battle Configuration panel opens
analytics.track('battle_config_opened', {
  robotId: string,
  source: string,  // 'robot_detail', 'match_queue', etc.
  timestamp: Date
});
```

**Note on Analytics Display:**  
The analytics tracking implementation is defined for Phase 1, but the display/viewing interface for this data is out of scope for this PRD. Analytics data will be tracked in the background to support future features:
- Historical performance data by stance (Phase 2)
- Stance-specific achievements (post-Phase 1 gamification)
- Admin portal or analytics dashboard (future enhancement)

For Phase 1, analytics events will be logged but not displayed to players. The display mechanism will be defined in a separate PRD for an admin/analytics interface.

---

## Glossary

**Battle Stance:** A pre-battle configuration setting that determines robot combat behavior and applies stat modifiers. Three options: Offensive, Defensive, Balanced.

**Yield Threshold:** The HP percentage at which a robot will attempt to surrender during battle. Range: 0-50%. Default: 10%.

**Effective Stats:** The actual combat statistics after applying stance modifiers and other bonuses to base attributes.

**Repair Cost Multiplier:** A penalty multiplier applied to repair costs when a robot is destroyed (2.0x) or heavily damaged <10% HP (1.5x).

**Repair Bay:** A stable facility that provides repair cost discounts. Discount formula: Level × (5 + Active Robot Count), capped at 90%. The discount applies after damage and destruction multipliers are calculated. With multiple robots, the discount becomes significantly more valuable.

**Logic Cores:** A robot attribute that reduces penalties when HP is low, making robots more effective under pressure.

**Stance Modifier:** A percentage bonus or penalty applied to specific attributes based on the selected battle stance.

**Base Attributes:** The raw attribute values before any modifiers are applied.

**Surrender:** The act of yielding during battle when HP drops below the yield threshold, ending the battle with a loss but potentially lower repair costs.

**Total Destruction:** When a robot reaches 0 HP, triggering the 2.0x repair cost multiplier.

---

## Appendix

### Stance Modifier Reference Table

| Attribute            | Offensive | Defensive | Balanced |
|----------------------|-----------|-----------|----------|
| Combat Power         | +15%      | -10%      | --       |
| Attack Speed         | +10%      | -10%      | --       |
| Armor Plating        | --        | +15%      | --       |
| Counter Protocols    | -10%      | +15%      | --       |
| Evasion Thrusters    | -10%      | --        | --       |
| Shield Regeneration  | --        | +20%      | --       |

### Repair Cost Formula Reference

```
baseRepairCost = sumOfAllAttributes × 100

if hpPercent === 0:
    multiplier = 2.0    // Total destruction
elif hpPercent < 10:
    multiplier = 1.5    // Heavily damaged
else:
    multiplier = 1.0    // Normal damage

rawCost = baseRepairCost × (damagePercent / 100) × multiplier

// Apply Repair Bay multi-robot discount
rawDiscount = repairBayLevel × (5 + activeRobotCount)
repairBayDiscount = Math.min(rawDiscount, 90) / 100  // Cap at 90%
finalRepairCost = rawCost × (1 - repairBayDiscount)
```

### Example Repair Cost Calculations

**Robot with 230 total attribute points (Base Repair Cost: ₡23,000):**

**Without Repair Bay:**

| Scenario              | Damage % | HP % | Multiplier | Base Cost | Final Cost |
|-----------------------|----------|------|------------|-----------|------------|
| Victory               | 60%      | 40%  | 1.0x       | ₡23,000   | ₡13,800    |
| Yield at 15%          | 85%      | 15%  | 1.0x       | ₡23,000   | ₡19,550    |
| Heavily Damaged (5%)  | 95%      | 5%   | 1.5x       | ₡23,000   | ₡32,775    |
| Total Destruction     | 100%     | 0%   | 2.0x       | ₡23,000   | ₡46,000    |

**With Repair Bay Level 5 + 7 robots (60% discount):**

| Scenario              | Damage % | HP % | Multiplier | Raw Cost  | Discount | Final Cost |
|-----------------------|----------|------|------------|-----------|----------|------------|
| Victory               | 60%      | 40%  | 1.0x       | ₡13,800   | -60%     | ₡5,520     |
| Yield at 15%          | 85%      | 15%  | 1.0x       | ₡19,550   | -60%     | ₡7,820     |
| Heavily Damaged (5%)  | 95%      | 5%   | 1.5x       | ₡32,775   | -60%     | ₡13,110    |
| Total Destruction     | 100%     | 0%   | 2.0x       | ₡46,000   | -60%     | ₡18,400    |

**With Repair Bay Level 6 + 10 robots (90% discount - maximum):**

| Scenario              | Damage % | HP % | Multiplier | Raw Cost  | Discount | Final Cost |
|-----------------------|----------|------|------------|-----------|----------|------------|
| Victory               | 60%      | 40%  | 1.0x       | ₡13,800   | -90%     | ₡1,380     |
| Yield at 15%          | 85%      | 15%  | 1.0x       | ₡19,550   | -90%     | ₡1,955     |
| Heavily Damaged (5%)  | 95%      | 5%   | 1.5x       | ₡32,775   | -90%     | ₡3,278     |
| Total Destruction     | 100%     | 0%   | 2.0x       | ₡46,000   | -90%     | ₡4,600     |

**Key Takeaway:** Repair Bay multi-robot discount applies AFTER damage and destruction multipliers, making it exceptionally valuable for all scenarios. With a large roster (7-10 robots), repair costs become minimal even for total destruction. The 90% discount cap is reached with Level 6 Repair Bay + 10 robots.

---

**This comprehensive PRD provides all specifications needed to implement the Battle Stance and Yield Threshold systems. Implementation should follow the phased approach, with backend API first, then frontend components, followed by integration and polish.**

**Next Steps:**
1. Review and approve PRD
2. Create engineering tickets from Implementation Plan
3. Begin Phase 1 (Backend API development)
4. Schedule UAT for Phase 4

---

**Version History:**
- v1.0 (2026-01-30): Initial PRD created based on ROBOT_ATTRIBUTES.md specifications
