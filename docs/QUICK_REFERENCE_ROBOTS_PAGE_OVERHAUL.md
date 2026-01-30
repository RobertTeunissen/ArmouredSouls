# Quick Reference: Robots Page Overhaul & Decimal Attributes Implementation

**Related PRD**: [PRD_ROBOTS_PAGE_OVERHAUL.md](PRD_ROBOTS_PAGE_OVERHAUL.md)  
**Last Updated**: January 30, 2026  
**Implementation Status**: 🟡 PRD Complete, Ready for Implementation

---

## 🎯 Quick Summary

This guide provides a fast reference for implementing the Robots page overhaul and decimal attributes system. For complete requirements, see the full PRD.

### What We're Building

1. **Redesigned Robot Detail Page** with clear section separation
2. **Decimal Attributes** (2 decimal places) for all 23 robot attributes
3. **Comprehensive Stat Table** showing all modifiers in one view
4. **Performance Statistics** section visible to all users
5. **Compact Layouts** to reduce page scrolling by 30-40%
6. **Image Placeholders** for future image system

---

## 📋 Implementation Checklist

### Phase 1: Database Migration

- [ ] **Update Prisma Schema** (`prototype/backend/prisma/schema.prisma`)
  - Change all 23 robot attributes from `Int` to `Decimal @db.Decimal(5, 2)`
  - Update defaults from `@default(1)` to `@default(1.00)`
  
- [ ] **Create Migration**
  ```bash
  cd prototype/backend
  npx prisma migrate dev --name decimal_robot_attributes
  ```

- [ ] **Test Migration**
  - Backup database first: `pg_dump armouredsouls > backup.sql`
  - Verify data converts correctly (25 → 25.00)
  - Test rollback if needed

### Phase 2: Backend Updates

- [ ] **Update `robotCalculations.ts`**
  - Convert Prisma `Decimal` to JavaScript `number` for calculations
  - Use `Math.round(value * 100) / 100` for 2-decimal precision
  - Update `calculateEffectiveStats()` function
  - Update `calculateEffectiveStatsWithStance()` function

- [ ] **Update API Serialization**
  - Ensure Decimal values serialize as strings in JSON
  - Frontend will convert with `parseFloat()` or `Number()`

- [ ] **Add Backend Tests**
  - Test decimal calculations with various scenarios
  - Test weapon bonus on low-level attributes (10 + 5% = 10.50)
  - Test loadout modifiers on decimals
  - Test stance modifiers on decimals

### Phase 3: Frontend Components

- [ ] **Create `EffectiveStatsTable.tsx`**
  - Table with columns: Attribute | Base | Weapons | Loadout | Stance | Total
  - 23 rows (one per attribute), grouped by category
  - Color coding: green for positive, red for negative
  - Decimal formatting (2 places)
     
--> Decimal formatting display only where applicable. Base attributes and Weapons only have integer effects. 

- [ ] **Create `PerformanceStats.tsx`**
  - Display: battles, wins, losses, win rate, ELO, damage stats
  - Read-only, visible to all users
  - Shows current HP, battle readiness, repair costs
     
--> No. This is going to be an overview that is accessible to all users. I want current HP, battle readiness and current repair costs in the Battle Configuration.

- [ ] **Create `CompactAttributeRow.tsx`**
  - Single-line attribute display: `Name: Base (Bonus) = Effective [Upgrade ₡XXK]`
  - Replaces verbose current layout
  - Hover tooltip for full details

- [ ] **Update `RobotDetailPage.tsx`**
  - Remove credit balance card (already in navigation)
  - Restructure into sections:
    1. Robot Header (with image placeholder)
    2. ⚔️ Battle Configuration
    3. 📊 Effective Stats Overview (new table)
    4. 🏆 Performance & Statistics (new section)
    5. ⬆️ Upgrade Robot (compact layout)
  - Integrate new components
     
--> Robot Header and Performance & Statistics should be accessible by all users that are logged in, the other sections only for the owner.
--> Define what should be visible in the Robot Header, this is not captured anywhere.

- [ ] **Update Utility Functions**
  - Add `formatAttribute(value): string` → returns `value.toFixed(2)`
  - Update `robotStats.ts` to handle decimals
  - Update type definitions for decimal values

### Phase 4: Testing

- [ ] **Unit Tests**
  - Decimal calculation functions
  - Rounding behavior
  - Edge cases (0.99, 49.99, etc.)

- [ ] **Integration Tests**
  - API returns decimal values as strings
  - Upgrade maintains decimal precision
  - Effective stats calculate correctly

- [ ] **E2E Tests**
  - Page layout shows sections correctly
  - Stat table displays all 23 attributes
  - Decimal values display in UI
  - Upgrade flow works with decimals

- [ ] **Manual Testing**
  - Page is visibly shorter (less scrolling)
  - Sections are clearly separated
  - Stat table is readable and informative
  - Decimals work at all attribute levels

---

## 🔧 Key Technical Details

### Decimal Type Configuration

**Prisma Schema:**
```prisma
combatPower Decimal @default(1.00) @map("combat_power") @db.Decimal(5, 2)
```

**Format**: `Decimal(5, 2)` = 5 total digits, 2 after decimal
**Range**: 0.00 to 999.99 (max in practice is 50.00)

### Calculation Formula

```typescript
// Formula: (base + weaponBonus) × loadoutMultiplier × stanceMultiplier
const effectiveValue = (baseValue + weaponBonus) * (1 + loadoutBonus) * (1 + stanceBonus);

// Round to 2 decimals
const rounded = Math.round(effectiveValue * 100) / 100;
```

### Example Calculations

**Example 1: Weapon Bonus**
```
Base: 10
Weapon: +5% = 0.50
Result: 10.50
```

**Example 2: Weapon + Loadout**
```
Base: 15
Weapon: +3
Loadout: +15%
Result: (15 + 3) × 1.15 = 20.70
```

**Example 3: Full Stack**
```
Base: 25
Weapon: +5
Loadout: +15%
Stance: +15%
Result: (25 + 5) × 1.15 × 1.15 = 39.67
```

---

## 📐 Page Layout Structure

```
┌─ Robot Header ──────────────────────────────────────┐
│ [Image 300x300]  Name | ELO | League                │
└─────────────────────────────────────────────────────┘

┌─ ⚔️ BATTLE CONFIGURATION ───────────────────────────┐
│ • Weapon Loadout (selector + slots)                 │
│ • Battle Stance (3 options)                         │
│ • Yield Threshold (slider)                          │
└─────────────────────────────────────────────────────┘

┌─ 📊 EFFECTIVE STATS OVERVIEW ────────────────────-──┐
│ Comprehensive table with all 23 attributes          │
│ Columns: Attribute | Base | Weapons | Loadout |     │
│          Stance | Total                             │
└─────────────────────────────────────────────────────┘

┌─ 🏆 PERFORMANCE & STATISTICS ────────────────-──────┐
│ Combat Record | Rankings | Damage Stats             │
│ Current State | Economic | Titles                   │
└─────────────────────────────────────────────────────┘

┌─ ⬆️ UPGRADE ROBOT ──────────────────────────────────┐
│ Category Headers (with academy cap)                 │
│ Compact attribute rows with inline upgrade buttons  │
└─────────────────────────────────────────────────────┘
```

---

## 🎨 Stat Table Design

| Category | Attribute | Base | Weapons | Loadout | Stance | **Total** |
|----------|-----------|------|---------|---------|--------|-----------|
| **Combat Systems** |
| | Combat Power | 25.00 | +5 | +15% | +15% | **35.65** |
| | Targeting | 18.00 | +3 | - | - | **21.00** |
| **Defensive Systems** |
| | Armor Plating | 15.00 | - | +15% | +15% | **19.86** |

**Visual Features:**
- Category headers with background color
- Alternating row colors
- Green text for positive modifiers ("+15%")
- Red text for negative modifiers ("-10%")
- Bold total column
- Dash "-" for zero/no modifier

---

## 🧪 Testing Scenarios

### Scenario 1: Low-Level Weapon Bonus
```
Given: Robot with combatPower = 10
And: Weapon with +5% bonus (0.50)
When: Stats calculated
Then: Effective combatPower = 10.50 (not 10)
```

### Scenario 2: Loadout Modifier
```
Given: Robot with combatPower = 10.50
And: Two-handed loadout (+25%)
When: Stats calculated
Then: Effective combatPower = 13.12
```

### Scenario 3: Full Stack
```
Given: Robot with combatPower = 25
And: Weapon bonus = +5
And: Weapon+Shield loadout (no combat bonus)
And: Offensive stance (+15%)
When: Stats calculated
Then: Effective combatPower = 34.50
```

### Scenario 4: Page Layout
```
Given: User views robot detail page
Then: See 5 distinct sections
And: Battle Configuration at top
And: Upgrade Robot at bottom
And: No duplicate credit balance
And: Page scroll reduced by 30-40%
```

---

## 📦 File Locations

### Backend
- **Schema**: `prototype/backend/prisma/schema.prisma`
- **Calculations**: `prototype/backend/src/utils/robotCalculations.ts`
- **API Routes**: `prototype/backend/src/routes/robots.ts`
- **Tests**: `prototype/backend/tests/robotCalculations.test.ts`

### Frontend
- **Robot Page**: `prototype/frontend/src/pages/RobotDetailPage.tsx`
- **Stat Table**: `prototype/frontend/src/components/EffectiveStatsTable.tsx` (NEW)
- **Performance**: `prototype/frontend/src/components/PerformanceStats.tsx` (NEW)
- **Compact Row**: `prototype/frontend/src/components/CompactAttributeRow.tsx` (NEW)
- **Utilities**: `prototype/frontend/src/utils/robotStats.ts`

---

## 🚨 Common Pitfalls

### Pitfall 1: Floating-Point Precision
❌ **Wrong**: `(10.5 * 1.15).toFixed(2)` → "12.08" (precision loss)  
✅ **Right**: `Math.round(10.5 * 1.15 * 100) / 100` → 12.07

### Pitfall 2: Decimal Comparison
❌ **Wrong**: `if (value === 10.50)` (floating-point equality)  
✅ **Right**: `if (Math.abs(value - 10.50) < 0.01)` (tolerance)

### Pitfall 3: Integer Division
❌ **Wrong**: `Math.floor((25 + 5) / 2)` → 15 (loses decimals)  
✅ **Right**: `Math.round((25.00 + 5.00) / 2 * 100) / 100` → 15.00

### Pitfall 4: API Serialization
❌ **Wrong**: Sending Decimal as number (precision loss)  
✅ **Right**: Serialize Decimal as string, parse on client

---

## 📊 Success Metrics

- ✅ Page scroll height reduced by 30-40%
- ✅ All 23 attributes display with 2 decimal places
- ✅ Weapon bonus on 10 base = 10.50 (not 10)
- ✅ Stat table shows all 5 columns correctly
- ✅ Performance section accessible to all users
- ✅ No JavaScript errors in console
- ✅ API response time < 200ms
- ✅ 95%+ test coverage

---

## 🔗 Related Documentation

- **Full PRD**: [PRD_ROBOTS_PAGE_OVERHAUL.md](PRD_ROBOTS_PAGE_OVERHAUL.md)
- **Robot Attributes**: [ROBOT_ATTRIBUTES.md](ROBOT_ATTRIBUTES.md)
- **Database Schema**: [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)
- **Weapon System**: [PRD_WEAPON_LOADOUT.md](PRD_WEAPON_LOADOUT.md)
- **Battle Stances**: [PRD_BATTLE_STANCES_AND_YIELD.md](PRD_BATTLE_STANCES_AND_YIELD.md)

---

## ❓ Questions?

For questions or clarifications, refer to the "Open Questions" section in the full PRD or consult with the product owner.

**Ready to implement?** Follow the checklist above in order, starting with Phase 1 (Database Migration).
