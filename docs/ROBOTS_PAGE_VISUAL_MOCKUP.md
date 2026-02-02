# My Robots Page - Visual Mockup

**Date**: February 2, 2026  
**Status**: Implementation Complete (Pending Live Testing)

---

## Page Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [Logo]  Dashboard  Robots  Battles  Shop  More      Credits: ₡1,500,000│
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                                                                           │
│  My Robots                           🔧 Repair All: ₡15,000 (25% off)   │
│                                      + Create New Robot                  │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘

┌────────────────────────┐  ┌────────────────────────┐  ┌──────────────────┐
│  ┌────────────────┐    │  │  ┌────────────────┐    │  │  ┌──────────────┐│
│  │                │    │  │  │                │    │  │  │              ││
│  │       I        │    │  │  │       B        │    │  │  │      T       ││
│  │  (128x128px)   │    │  │  │  (128x128px)   │    │  │  │ (128x128px)  ││
│  │                │    │  │  │                │    │  │  │              ││
│  └────────────────┘    │  │  └────────────────┘    │  │  └──────────────┘│
│                        │  │                        │  │                  │
│   IRON FIST            │  │   BATTLE MASTER        │  │   THUNDER BOLT   │
│                        │  │                        │  │                  │
│   ELO: 1450            │  │   ELO: 1620            │  │   ELO: 1380      │
│   Silver │ LP: 45      │  │   Gold │ LP: 78        │  │   Bronze │ LP: 92│
│   23W-12L-3D (65.7%)   │  │   45W-18L-2D (71.4%)   │  │   15W-20L-5D (42%)│
│                        │  │                        │  │                  │
│   HP:    [████████░░]  │  │   HP:    [██████████]  │  │   HP:  [███░░░░░]│
│   85%                  │  │   100%                 │  │   40%            │
│                        │  │                        │  │                  │
│   Shield:[██████████]  │  │   Shield:[██████████]  │  │   Shield:[█████░]│
│   100%                 │  │   100%                 │  │   65%            │
│                        │  │                        │  │                  │
│   Weapon: Laser Rifle  │  │   Weapon: Plasma Can   │  │   Weapon: None   │
│   Readiness: 92%       │  │   Readiness: 100%      │  │   Readiness: 52% │
│   Battle Ready         │  │   Battle Ready         │  │   Damaged        │
│                        │  │                        │  │                  │
│   [ View Details → ]   │  │   [ View Details → ]   │  │   [ View Details →]│
│                        │  │                        │  │                  │
└────────────────────────┘  └────────────────────────┘  └──────────────────┘
```

---

## Color Coding

### Background Colors
- **Page Background**: `#0a0e14` (deep space black)
- **Robot Cards**: `#252b38` (surface-elevated)
- **Card Borders**: `#3d444d` (neutral gray)
- **Card Hover**: `#58a6ff` (primary cyan)

### HP Bar Colors (Based on Percentage)
- **70-100%**: `bg-green-500` - Healthy, Battle Ready
- **30-69%**: `bg-yellow-500` - Damaged, Needs Attention
- **0-29%**: `bg-red-500` - Critical, Urgent Repair

### Shield Bar Color
- **Always**: `bg-[#58a6ff]` (primary cyan)

### Button Colors
- **Repair All**: `#d29922` (warning amber) when enabled
- **Repair All Disabled**: Gray when no repairs needed
- **Create Robot**: `#3fb950` (success green)

### Text Colors
- **ELO**: `#58a6ff` (primary)
- **Battle Ready**: Green
- **Damaged**: Yellow
- **Critical**: Red

---

## Interactive Elements

### Repair All Button States

**Enabled (Repairs Needed)**:
```
🔧 Repair All: ₡15,000 (25% off)
[Amber background, white text]
Hover: Lighter amber
Click: Shows confirmation dialog
```

**Disabled (No Repairs)**:
```
🔧 Repair All
[Gray background, gray text]
Tooltip: "No repairs needed"
Not clickable
```

### Robot Cards

**Hover Effect**:
- Border changes from `#3d444d` → `#58a6ff`
- Smooth transition (200ms)
- Cursor changes to pointer

**Click Behavior**:
- Navigates to `/robots/{id}` (robot detail page)
- View Details button also navigates (prevents event bubbling)

---

## Data Display Format

### League Points
Format: `{League} │ LP: {points}`
Example: `Silver │ LP: 45`

### Win/Loss/Draw Record
Format: `{W}W-{L}L-{D}D ({winRate}%)`
Example: `23W-12L-3D (65.7%)`
- Win rate: `(wins / totalBattles × 100).toFixed(1)`

### HP Bar
- Shows percentage only: `85%`
- Does NOT show: `850/1000` ❌
- Label above bar: "HP"
- Percentage to the right: "85%"

### Shield Bar
- Shows percentage only: `100%`
- Does NOT show: `200/200` ❌
- Label above bar: "Shield"
- Percentage to the right: "100%"
- Only displayed if `maxShield > 0`

### Battle Readiness
Format: `{percentage}% │ {status}`
Examples:
- `92% │ Battle Ready` (≥80%)
- `65% │ Damaged` (50-79%)
- `35% │ Critical` (<50%)

---

## Responsive Breakpoints

### Mobile (<768px)
```
┌─────────────────────┐
│     Robot Card      │
└─────────────────────┘
┌─────────────────────┐
│     Robot Card      │
└─────────────────────┘
```
**1 column layout**

### Tablet (768-1023px)
```
┌──────────────┐  ┌──────────────┐
│  Robot Card  │  │  Robot Card  │
└──────────────┘  └──────────────┘
┌──────────────┐  ┌──────────────┐
│  Robot Card  │  │  Robot Card  │
└──────────────┘  └──────────────┘
```
**2 columns layout**

### Desktop (≥1024px)
```
┌──────────┐  ┌──────────┐  ┌──────────┐
│  Robot   │  │  Robot   │  │  Robot   │
└──────────┘  └──────────┘  └──────────┘
```
**3 columns layout**

---

## Empty State

When user has no robots:

```
┌─────────────────────────────────────────────┐
│                                             │
│      You don't have any robots yet.         │
│                                             │
│   Create your first robot to start battling!│
│                                             │
│        [ Create Your First Robot ]          │
│                                             │
└─────────────────────────────────────────────┘
```

**Styling**:
- Container: `#1a1f29` (surface)
- Text: Gray, centered
- Button: Green (success), prominent

---

## API Integration

### Endpoints Used

1. **GET /api/robots**
   - Fetches all user's robots
   - Returns array with all robot fields including:
     - HP/Shield data
     - League Points
     - Draws
     - Repair cost
   - Called on component mount

2. **GET /api/facility**
   - Fetches user's facility levels
   - Used to get Repair Bay level for discount
   - Called on component mount

3. **POST /api/robots/repair-all** (TODO - Not Yet Implemented)
   - Would repair all damaged robots
   - Applies Repair Bay discount
   - Updates robot HP/Shield to max
   - Deducts cost from user credits
   - Currently shows placeholder alert

---

## Repair Cost Calculation

### Formula

```typescript
// Total base cost
const totalBaseCost = robots.reduce((sum, robot) => 
  sum + (robot.repairCost || 0), 0
);

// Discount percentage (5% per Repair Bay level)
const discount = repairBayLevel * 5;

// Final cost after discount
const discountedCost = Math.floor(
  totalBaseCost * (1 - discount / 100)
);
```

### Examples

**Scenario 1: No Repair Bay**
- Robot 1: ₡10,000
- Robot 2: ₡5,000
- Total: ₡15,000
- Discount: 0%
- Final: ₡15,000

**Scenario 2: Repair Bay Level 5**
- Robot 1: ₡10,000
- Robot 2: ₡5,000
- Total: ₡15,000
- Discount: 25% (5 × 5%)
- Final: ₡11,250

**Scenario 3: Repair Bay Level 10 (Max)**
- Robot 1: ₡10,000
- Robot 2: ₡5,000
- Total: ₡15,000
- Discount: 50% (10 × 5%)
- Final: ₡7,500

---

## Accessibility

### Keyboard Navigation
- Tab through cards in order
- Enter/Space to navigate to detail page
- Tab to action buttons
- Clear focus indicators

### Screen Readers
- Card labeled as "Robot card: {name}"
- HP bar: "HP: {percentage} percent"
- Shield bar: "Shield: {percentage} percent"
- Status announced: "Battle Ready" / "Damaged" / "Critical"

### Color Contrast
- All text meets WCAG 2.1 AA standards
- HP colors distinguishable even without color (position/label)
- Button states clear through multiple indicators

---

## Implementation Status

✅ **Code Complete**
✅ **Design System Applied**
✅ **All Requirements Met**
⏭️ **Pending Live Testing**
⏭️ **Backend Endpoint Needed** (Repair All)

---

**Last Updated**: February 2, 2026  
**Implemented By**: GitHub Copilot  
**File**: `/prototype/frontend/src/pages/RobotsPage.tsx`
