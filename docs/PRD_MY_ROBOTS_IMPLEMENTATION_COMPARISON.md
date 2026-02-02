# My Robots List Page: Current State vs PRD Requirements

**Document Purpose**: Quick reference comparison between current implementation and PRD requirements  
**Created**: February 2, 2026  
**Related PRD**: [PRD_MY_ROBOTS_LIST_PAGE.md](PRD_MY_ROBOTS_LIST_PAGE.md)

---

## Executive Summary

This document provides a side-by-side comparison of the current RobotsPage.tsx implementation versus the requirements specified in the comprehensive PRD. Use this as a checklist during implementation.

---

## Page Structure Comparison

### ✅ IMPLEMENTED (Already Working)

| Feature | Status | Notes |
|---------|--------|-------|
| Navigation component | ✅ | Direction B logo, menu, credits display |
| Page route `/robots` | ✅ | Accessible via navigation |
| Robot data fetching | ✅ | API endpoint `GET /api/robots` |
| Grid layout | ✅ | Responsive (1-3 columns) |
| Card-based display | ✅ | Each robot in separate card |
| Click to detail | ✅ | Navigate to `/robots/:id` |
| "Create New Robot" button | ✅ | Navigate to `/robots/create` |
| "Weapon Shop" button | ✅ | Navigate to `/weapon-shop` |
| Empty state | ✅ | Message when no robots |
| Loading state | ✅ | "Loading robots..." during fetch |
| Error state | ✅ | Error message on API failure |
| Authentication | ✅ | Token-based with logout |

### ❌ MISSING (Needs Implementation)

| Feature | Priority | Complexity | PRD Section |
|---------|----------|------------|-------------|
| HP status bar | P0 | Medium | FR-2, Card Component |
| Shield status bar | P0 | Medium | FR-2, Card Component |
| Win/Loss record | P0 | Easy | FR-2, Card Component |
| Win rate calculation | P0 | Easy | Technical Implementation |
| League display | P0 | Easy | FR-2, Card Component |
| Battle Readiness % | P0 | Easy | FR-2, Card Component |
| Portrait placeholder | P1 | Easy | FR-2, Portrait Section |
| Design system colors | P0 | Easy | Design Specifications |
| Utility functions | P0 | Easy | Technical Implementation |
| Roster capacity (X/Y) | P2 | Easy | FR-3, Header Section |

### 🔧 NEEDS UPDATE (Partially Implemented)

| Feature | Current State | Required Change | Priority |
|---------|---------------|-----------------|----------|
| Button colors | Purple/green | Success/info from design system | P0 |
| Card background | `bg-gray-800` | `surface-elevated` (#252b38) | P0 |
| Card borders | `border-gray-700` | Design system gray (#3d444d) | P0 |
| Hover states | `border-blue-500` | `primary` (#58a6ff) | P0 |
| Typography | Generic | DIN Next/Inter | P1 |
| Spacing | Adequate | Match design system specs | P1 |

---

## Data Fields Comparison

### Backend Database Schema (Available)

All required fields exist in Robot model:

```typescript
// ✅ Already in schema
currentHP: Int
maxHP: Int
currentShield: Int
maxShield: Int
wins: Int
losses: Int
totalBattles: Int
currentLeague: String
battleReadiness: Int
elo: Int
repairCost: Int
damageDealtLifetime: Int
damageTakenLifetime: Int
kills: Int
```

### Frontend Interface (Current)

```typescript
// Current RobotsPage.tsx Interface
interface Robot {
  id: number;
  name: string;
  elo: number;  // ✅ Displayed
  weaponInventoryId: number | null;
  weaponInventory: {  // ✅ Displayed
    weapon: {
      name: string;
      weaponType: string;
    };
  } | null;
  createdAt: string;  // ✅ Displayed
  
  // ❌ Missing fields (exist in DB, not in interface):
  // currentHP, maxHP, currentShield, maxShield
  // wins, losses, totalBattles
  // currentLeague, battleReadiness
}
```

### Frontend Interface (Required)

```typescript
// PRD Required Interface
interface Robot {
  // Current fields (keep)
  id: number;
  name: string;
  elo: number;
  weaponInventoryId: number | null;
  weaponInventory: { weapon: { name: string; weaponType: string; } } | null;
  createdAt: string;
  
  // ADD these fields:
  currentHP: number;           // For HP bar
  maxHP: number;               // For HP bar
  currentShield: number;       // For Shield bar
  maxShield: number;           // For Shield bar
  wins: number;                // For Win/Loss record
  losses: number;              // For Win/Loss record
  totalBattles: number;        // For win rate calculation
  currentLeague: string;       // For League display
  battleReadiness: number;     // For Readiness indicator
}
```

---

## Visual Elements Comparison

### Current Card Display

```
┌─────────────────────────────────────┐
│ IRON FIST                          │
│                                     │
│ Robot ID: #1                        │
│ ELO: 1450                          │
│ Weapon: Laser Rifle                │
│ Weapon Type: laser                 │
│ Created: 1/15/2026                 │
│                                     │
│ [ View Details ]                   │
└─────────────────────────────────────┘
```

### PRD Required Card Display

```
┌──────────────────────────────────────────────┐
│ ┌─────────┐  IRON FIST                      │
│ │         │  ELO: 1450  │  Silver League    │
│ │ [Image] │  23W-12L (65.7%)                │
│ │ 256x256 │                                 │
│ └─────────┘                                 │
│                                              │
│ HP:    [████████░░] 850/1000 (85%)         │
│ Shield:[██████████] 200/200 (100%)         │
│                                              │
│ Weapon: Laser Rifle                         │
│ Readiness: 92%  │  Battle Ready             │
│                                              │
│ [ View Details → ]                          │
└──────────────────────────────────────────────┘
```

### Information Density

| Metric | Current | Required | Change |
|--------|---------|----------|--------|
| Data points per card | 5 | 11+ | +6 |
| Portrait space | None | 256×256px | Add |
| Status bars | 0 | 2 | Add |
| Performance data | 0 | 3 | Add |
| League context | None | Yes | Add |

---

## Color Usage Comparison

### Current Colors (Not Design System)

```css
/* Current RobotsPage.tsx */
background: gray-900        /* Page background */
cards: gray-800             /* Card background */
borders: gray-700           /* Card borders */
hover: blue-500             /* Hover state */
text: white                 /* Primary text */
create-btn: green-600       /* Create button */
shop-btn: purple-600        /* Shop button */
```

### Required Colors (Design System)

```css
/* PRD Required Colors */
background: #0a0e14         /* Page background */
cards: #252b38              /* surface-elevated */
borders: #3d444d            /* Neutral gray */
hover: #58a6ff              /* primary */
text: #e6edf3               /* text-primary */
create-btn: #3fb950         /* success */
shop-btn: #a371f7           /* info */

/* Status Colors */
hp-healthy: #3fb950         /* success (70-100%) */
hp-warning: #d29922         /* warning (30-69%) */
hp-critical: #f85149        /* error (0-29%) */
shield: #58a6ff             /* primary */
```

---

## Component Architecture

### Current Structure

```
RobotsPage.tsx
  └── Inline rendering (all in one component)
      ├── Navigation
      ├── Header with buttons
      ├── Robot cards (map)
      └── Empty state
```

### Recommended Structure (Optional Refactor)

```
RobotsPage.tsx
  ├── Navigation
  ├── PageHeader
  │   ├── Title with capacity
  │   └── Action buttons
  ├── RobotGrid
  │   └── RobotCard (component)
  │       ├── PortraitPlaceholder
  │       ├── RobotHeader
  │       ├── StatusBars
  │       │   ├── HPBar (component)
  │       │   └── ShieldBar (component)
  │       ├── WeaponDisplay
  │       ├── ReadinessIndicator
  │       └── ActionButton
  └── EmptyState (component)
```

---

## Implementation Checklist

### Phase 1: Data & API (Priority 0)
- [ ] Update Robot interface with missing fields
- [ ] Verify API returns all required fields
- [ ] Test data fetching with console.log
- [ ] Handle missing/null values gracefully

### Phase 2: Utility Functions (Priority 0)
- [ ] Create `getHPColor(currentHP, maxHP)` function
- [ ] Create `calculateReadiness(currentHP, maxHP, currentShield, maxShield)` function
- [ ] Create `calculateWinRate(wins, totalBattles)` function
- [ ] Create `getReadinessStatus(readiness)` function
- [ ] Add unit tests for utility functions

### Phase 3: Visual Updates (Priority 0)
- [ ] Update card background to `surface-elevated` (#252b38)
- [ ] Update card borders to design system gray (#3d444d)
- [ ] Update hover state to `primary` (#58a6ff)
- [ ] Update Create button to `success` (#3fb950)
- [ ] Update Shop button to `info` (#a371f7)
- [ ] Verify all text colors use design system tokens

### Phase 4: Add Status Bars (Priority 0)
- [ ] Add HP bar component/rendering
- [ ] Implement color coding (green/amber/red)
- [ ] Add Shield bar component/rendering
- [ ] Add percentage display next to bars
- [ ] Add smooth fill transitions (300ms)
- [ ] Test with various HP/Shield values

### Phase 5: Add Performance Data (Priority 0)
- [ ] Add Win/Loss record display
- [ ] Add win rate calculation and display
- [ ] Add League display
- [ ] Add Battle Readiness percentage
- [ ] Add Readiness status text (Battle Ready/Damaged/Critical)
- [ ] Color code readiness status

### Phase 6: Add Portrait Space (Priority 1)
- [ ] Add 256×256px portrait container
- [ ] Add placeholder styling (background, border)
- [ ] Add robot name initial OR generic icon
- [ ] Position portrait correctly in card layout
- [ ] Ensure layout works with/without image

### Phase 7: Polish & Testing (Priority 0)
- [ ] Verify responsive layout (mobile/tablet/desktop)
- [ ] Test keyboard navigation
- [ ] Test screen reader compatibility
- [ ] Verify WCAG AA color contrast
- [ ] Add reduced motion support
- [ ] Test with 0, 1, 5, 20 robots
- [ ] Test with various HP/Shield states
- [ ] Screenshot comparison (before/after)

### Phase 8: Optional Enhancements (Priority 2)
- [ ] Add roster capacity indicator (X/Y)
- [ ] Add filter/sort controls
- [ ] Add inline robot name editing
- [ ] Add frame type badge
- [ ] Refactor into smaller components

---

## Testing Scenarios

### Data Scenarios to Test

1. **No Robots (Empty State)**
   - User has 0 robots
   - Should show empty state with Create button

2. **Single Robot**
   - User has 1 robot
   - Should display correctly without grid issues

3. **Multiple Robots**
   - User has 5-20 robots
   - Should display in responsive grid

4. **HP Variations**
   - Robot with 100% HP → Green bar
   - Robot with 50% HP → Amber bar
   - Robot with 20% HP → Red bar
   - Robot with 0% HP → Red bar

5. **Shield Variations**
   - Robot with shield → Show shield bar
   - Robot without shield (max = 0) → Handle gracefully

6. **Performance Variations**
   - Robot with no battles (0-0-0) → "0.0% win rate"
   - Robot with wins only → "100% win rate"
   - Robot with mixed record → Calculate correctly

7. **League Variations**
   - Bronze league → Display correctly
   - Silver, Gold, etc. → Display correctly
   - Missing league → Show "Unranked" or handle gracefully

8. **Weapon Variations**
   - Robot with weapon → Show weapon name
   - Robot without weapon → Show "None equipped"

---

## Quick Reference: Key Changes

### 1. Update Interface
```typescript
// Add to Robot interface
currentHP: number;
maxHP: number;
currentShield: number;
maxShield: number;
wins: number;
losses: number;
totalBattles: number;
currentLeague: string;
battleReadiness: number;
```

### 2. Add Utility Functions
```typescript
const getHPColor = (currentHP: number, maxHP: number): string => {
  const percentage = (currentHP / maxHP) * 100;
  if (percentage >= 70) return 'bg-success';
  if (percentage >= 30) return 'bg-warning';
  return 'bg-error';
};

const calculateWinRate = (wins: number, totalBattles: number): string => {
  if (totalBattles === 0) return '0.0';
  return ((wins / totalBattles) * 100).toFixed(1);
};
```

### 3. Update Card Styling
```typescript
// Change from:
className="bg-gray-800 border-2 border-gray-700 hover:border-blue-500"

// To:
className="bg-[#252b38] border-2 border-[#3d444d] hover:border-[#58a6ff]"
```

### 4. Add HP Bar
```tsx
<div className="space-y-2">
  <div className="flex justify-between text-sm text-secondary">
    <span>HP</span>
    <span>{robot.currentHP}/{robot.maxHP} ({Math.round(robot.currentHP/robot.maxHP*100)}%)</span>
  </div>
  <div className="w-full h-6 bg-surface rounded-full overflow-hidden">
    <div 
      className={`h-full transition-all duration-300 ${getHPColor(robot.currentHP, robot.maxHP)}`}
      style={{ width: `${(robot.currentHP/robot.maxHP)*100}%` }}
    />
  </div>
</div>
```

### 5. Add Win/Loss Display
```tsx
<div className="flex justify-between">
  <span className="text-secondary">Record:</span>
  <span className="font-semibold">
    {robot.wins}W-{robot.losses}L ({calculateWinRate(robot.wins, robot.totalBattles)}%)
  </span>
</div>
```

---

## Success Metrics

When implementation is complete, verify:

- [ ] Page loads without errors
- [ ] All robot data displays correctly
- [ ] HP bars show correct colors (green/amber/red)
- [ ] Shield bars display correctly
- [ ] Win rate calculated correctly
- [ ] League displays correctly
- [ ] Battle Readiness shows correct percentage
- [ ] Design system colors applied throughout
- [ ] Responsive layout works at all breakpoints
- [ ] Keyboard navigation functional
- [ ] Screen reader announces content correctly
- [ ] No console errors or warnings
- [ ] Screenshot shows visual improvement

---

## Resources

- **PRD**: [PRD_MY_ROBOTS_LIST_PAGE.md](PRD_MY_ROBOTS_LIST_PAGE.md) - Complete requirements
- **Design System**: [design_ux/DESIGN_SYSTEM_QUICK_REFERENCE.md](design_ux/DESIGN_SYSTEM_QUICK_REFERENCE.md) - Color palette, typography
- **Current Code**: `/prototype/frontend/src/pages/RobotsPage.tsx` - Existing implementation
- **Backend API**: `/prototype/backend/src/routes/robots.ts` - API endpoint
- **Database Schema**: `/prototype/backend/prisma/schema.prisma` - Robot model

---

**Status**: Ready for Implementation  
**Last Updated**: February 2, 2026  
**Estimated Effort**: 4-6 hours for complete implementation
