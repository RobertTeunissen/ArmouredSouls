# Balance Changes Quick Reference

**Date**: February 5, 2026  
**Related**: BALANCE_PROPOSAL_REBALANCE_2026.md  
**Status**: 📋 Ready for Implementation

This document provides a quick reference for the specific changes proposed in the comprehensive balance proposal.

---

## Summary of Changes

| Category | Current | Proposed | Impact |
|----------|---------|----------|--------|
| **Battle Duration** | ~112 seconds | 40-60 seconds | -54% faster |
| **Draw Rate** | 70-75% | ~10% | -85% draws |
| **Shield Absorption** | 70% effective | 100% effective | +43% damage |
| **Armor Formula** | Capped at 30 | 1.5% per point | Scales smoothly |
| **Weapon Damage** | Current values | -27% (except baseline) | Balanced |
| **Weapon Prices** | Current | -15% to -20% | Minor reduction |

---

## Change #1: Energy Shield Terminology

**Find and Replace in Documentation:**

| File | Find | Replace |
|------|------|---------|
| COMBAT_FORMULAS.md | "Shield Absorption" | "Energy Shield Absorption" |
| COMBAT_FORMULAS.md | "Shield Regeneration" | "Energy Shield Regeneration" |
| ROBOT_ATTRIBUTES.md | "Current Shield" | "Current Energy Shield" |
| ROBOT_ATTRIBUTES.md | "**Energy Shield HP**" | Keep (already correct) |

**Result**: Clear distinction between shield weapons and energy shield HP pool.

---

## Change #2: Damage Application Formula

### Current Code (combatSimulator.ts lines 249-276)

```typescript
if (defenderState.currentShield > 0) {
  // Shields absorb at 70% effectiveness
  const shieldAbsorption = damage * 0.7;
  const penetrationMult = 1 + effectivePenetration / 200;
  const effectiveShieldDamage = shieldAbsorption * penetrationMult;
  
  shieldDamage = Math.min(effectiveShieldDamage, defenderState.currentShield);
  defenderState.currentShield -= shieldDamage;
  
  // Bleed-through damage at reduced rate
  if (effectiveShieldDamage > defenderState.currentShield) {
    const overflow = (effectiveShieldDamage - defenderState.currentShield) * 0.3;
    const rawArmorReduction = effectiveArmor * (1 - effectivePenetration / 100);
    armorReduction = Math.min(rawArmorReduction, MAX_ARMOR_REDUCTION);
    hpDamage = Math.max(1, overflow - armorReduction);
  }
} else {
  const rawArmorReduction = effectiveArmor * (1 - effectivePenetration / 100);
  armorReduction = Math.min(rawArmorReduction, MAX_ARMOR_REDUCTION);
  hpDamage = Math.max(1, damage - armorReduction);
}
```

### New Code

```typescript
// Step 1: Apply damage to Energy Shield first (100% effective)
if (defenderState.currentShield > 0) {
  shieldDamage = Math.min(damage, defenderState.currentShield);
  defenderState.currentShield -= shieldDamage;
  remainingDamage = damage - shieldDamage;
} else {
  remainingDamage = damage;
}

// Step 2: Apply overflow to HP with armor reduction
if (remainingDamage > 0) {
  const armorReductionPercent = Math.max(0, (effectiveArmor - effectivePenetration) * ARMOR_EFFECTIVENESS);
  const damageMultiplier = 1 - (armorReductionPercent / 100);
  hpDamage = Math.max(1, remainingDamage * damageMultiplier);
  
  // If penetration exceeds armor, bonus damage
  if (effectivePenetration > effectiveArmor) {
    const penetrationBonus = (effectivePenetration - effectiveArmor) * PENETRATION_BONUS;
    hpDamage = remainingDamage * (1 + penetrationBonus / 100);
  }
}
```

**Key Differences:**
- ❌ Removed: `* 0.7` shield absorption
- ❌ Removed: `* 0.3` bleed-through
- ❌ Removed: `Math.min(rawArmorReduction, MAX_ARMOR_REDUCTION)` cap
- ✅ Added: Direct 100% damage to shields
- ✅ Added: Percentage-based armor reduction
- ✅ Added: Penetration bonus for high penetration

---

## Change #3: Armor Constants

### New Constants (add to combatSimulator.ts or config file)

```typescript
// Armor reduction per armor point (1.5% recommended)
export const ARMOR_EFFECTIVENESS = 1.5;  // 1.5% damage reduction per armor point

// Penetration bonus per excess penetration point (2% recommended)
export const PENETRATION_BONUS = 2.0;    // 2% damage increase per penetration above armor
```

### Formula

```typescript
// Armor reduces damage by percentage
if (effectivePenetration <= effectiveArmor) {
  const armorReductionPercent = (effectiveArmor - effectivePenetration) * ARMOR_EFFECTIVENESS;
  damageMultiplier = 1 - (armorReductionPercent / 100);
} else {
  // Penetration exceeds armor - bonus damage
  const penetrationBonus = (effectivePenetration - effectiveArmor) * PENETRATION_BONUS;
  damageMultiplier = 1 + (penetrationBonus / 100);
}

finalDamage = baseDamage * damageMultiplier;
```

---

## Change #4: Weapon Damage Values

### Seed Data Updates (prototype/backend/prisma/seed.ts)

**Reduce Practice Sword to 8 damage (new baseline), reduce all others by ~27-35%:**

```typescript
// Current → New
{ name: 'Practice Sword', baseDamage: 10 }  // ➜ 8 (20% nerf, new baseline)
{ name: 'Power Sword', baseDamage: 22 }     // ➜ 16
{ name: 'Heavy Hammer', baseDamage: 40 }    // ➜ 30
{ name: 'Plasma Blade', baseDamage: 28 }    // ➜ 21
{ name: 'Combat Shield', baseDamage: 8 }    // ➜ 6
{ name: 'Machine Gun', baseDamage: 10 }     // ➜ 7
{ name: 'Machine Pistol', baseDamage: 8 }   // ➜ 6
{ name: 'Grenade Launcher', baseDamage: 45 } // ➜ 34
{ name: 'Plasma Rifle', baseDamage: 35 }    // ➜ 26
{ name: 'Plasma Cannon', baseDamage: 55 }   // ➜ 40
{ name: 'Railgun', baseDamage: 55 }         // ➜ 40
```

**Formula for conversion:**
```typescript
// Practice Sword: 20% nerf (becomes new baseline)
newDamage = Math.round(currentDamage * 0.80)  // For Practice Sword

// All others: ~27-35% nerf
newDamage = Math.round(currentDamage * 0.70)  // For other weapons
```

---

## Change #5: Weapon Economy Adjustment

### Price Formula Update (PRD_WEAPON_ECONOMY_OVERHAUL.md)

**Current:**
```typescript
DPS Cost = ₡50,000 × (DPS Ratio - 1.0) × 2.0
```

**New:**
```typescript
DPS Cost = ₡50,000 × (DPS Ratio - 1.0) × 2.67  // Increased multiplier
```

**Why**: Compensates for lower DPS ratios due to reduced damage, keeps prices more stable.

**Expected Price Impact:**
- Low-tier weapons (Practice Sword, Machine Gun): -50% to -20%
- Mid-tier weapons (Power Sword, Plasma Rifle): -15% to -18%
- High-tier weapons (Plasma Cannon, Railgun): -18% to -20%

**Note**: Price reduction is acceptable because:
1. Weapons are relatively more powerful (armor nerfed)
2. Slight player-friendly adjustment improves game economy
3. Still maintains weapon progression and value tiers

---

## Change #6: Documentation Updates

### Files to Update

1. **docs/COMBAT_FORMULAS.md**
   - Section: "Damage Application" (lines 200-236)
   - Action: Replace with new simplified formula
   - Action: Update "Energy Shield Absorption" terminology
   - Action: Remove all references to 70% and 30% bleed-through

2. **docs/ROBOT_ATTRIBUTES.md**
   - Section: "Robot State Attributes" (line 96-99)
   - Action: Standardize "Current Energy Shield" terminology
   - Section: "Combat System" 
   - Action: Reference updated COMBAT_FORMULAS.md

3. **docs/PRD_WEAPON_ECONOMY_OVERHAUL.md**
   - Section: "Pricing Formula" (line 146-154)
   - Action: Update DPS Cost multiplier to 2.67
   - Section: Weapon catalog tables
   - Action: Update damage values for all weapons

---

## Expected Outcomes

### Battle Duration

**Before:**
```
Average: 112 seconds
Range: 80-120 seconds (many hitting timeout)
Issue: Too long, players lose interest
```

**After:**
```
Average: 50 seconds
Range: 35-65 seconds (well under timeout)
Improvement: 55% faster battles ✅
```

### Draw Rate

**Before:**
```
Rate: 70-75% (some leagues)
Historical: 44-45% (Platinum example)
Issue: Majority of battles are draws
```

**After:**
```
Rate: 5-15% (estimated)
Target: ~10%
Improvement: 85% reduction in draws ✅
```

### Damage Effectiveness

**Before:**
```
50 damage weapon → 35 to shield (70% absorption)
→ 15 overflow × 30% = 4.5 bleed
→ 4.5 - armor ≈ 1-3 HP damage
Effective: 38 damage total (76% effective)
```

**After:**
```
50 damage weapon → 50 to shield (100% direct)
→ 0 overflow (shield not broken in this example)
Next hit: 50 × (1 - armor%) ≈ 35-45 HP damage
Effective: 50 shield + 40 HP = 90 damage (180% of old)
```

### Armor Balance

**Before:**
```
50 Armor vs 1 Penetration:
  armorReduction = 50 × (1 - 0.01) = 49.5
  capped at 30
  Result: 30 damage blocked (invincible vs low weapons)
```

**After:**
```
50 Armor vs 1 Penetration:
  reduction = (50 - 1) × 1.5% = 73.5%
  50 damage → 50 × (1 - 0.735) = 13.25 damage
  Result: Still strong but not invincible ✅
```

### Penetration Value

**Before:**
```
10 Armor vs 30 Penetration:
  armorReduction = 10 × (1 - 0.30) = 7
  50 damage → 50 - 7 = 43 damage
  Penetration helped by 30% (10 → 7 reduction)
```

**After:**
```
10 Armor vs 30 Penetration:
  bonus = (30 - 10) × 2% = 40%
  50 damage → 50 × (1 + 0.40) = 70 damage
  Penetration boosted damage by 40% ✅ (strong counter)
```

---

## Testing Checklist

### Pre-Implementation

- [ ] Review proposal with stakeholders
- [ ] Approve constant values (ARMOR_EFFECTIVENESS, PENETRATION_BONUS)
- [ ] Prepare test scenarios
- [ ] Back up current codebase

### Phase 1: Documentation

- [ ] Update COMBAT_FORMULAS.md
- [ ] Update ROBOT_ATTRIBUTES.md
- [ ] Update PRD_WEAPON_ECONOMY_OVERHAUL.md
- [ ] Search for remaining "shield" references needing "energy shield"
- [ ] Commit documentation changes

### Phase 2: Code Implementation

- [ ] Add constants to combatSimulator.ts or config file
- [ ] Rewrite applyDamage() function
- [ ] Update damage formula breakdown messages
- [ ] Update weapon seed data (baseDamage values)
- [ ] Update weapon economy formula (DPS multiplier)
- [ ] Commit code changes

### Phase 3: Testing

- [ ] Run unit tests on applyDamage()
- [ ] Test edge cases (50 armor vs 1 pen, etc.)
- [ ] Run 100-battle simulation
- [ ] Measure average battle duration
- [ ] Measure draw rate
- [ ] Verify weapon prices within expected range
- [ ] Test with Admin panel (manual battles)

### Phase 4: Validation

- [ ] Confirm average battle duration 40-60s
- [ ] Confirm draw rate 5-15%
- [ ] Confirm no single attribute dominates top 20 robots
- [ ] Confirm weapon prices within 25% of current
- [ ] Document results and any adjustments needed

---

## Rollback Procedure

If issues arise:

1. **Immediate Rollback** (< 5 minutes)
   ```bash
   git revert <commit-hash>
   git push
   ```

2. **Database** (if seed data changed)
   ```bash
   npm run prisma:reset
   # Re-run old seed data
   ```

3. **Verification**
   - Run test battle
   - Check damage values match old system
   - Verify shield absorption at 70%

---

## Tuning Options

If initial values need adjustment after testing:

### If Battles Still Too Long (>65s average)

**Option 1**: Reduce weapon damage less
- Current: -27% nerf
- Adjust to: -20% nerf
- Impact: 8% faster battles

**Option 2**: Reduce armor effectiveness
- Current: 1.5% per point
- Adjust to: 1.2% per point
- Impact: Armor less effective, faster damage

**Option 3**: Reduce shield HP
- Current: Energy Shield Capacity × 2
- Adjust to: Energy Shield Capacity × 1.5
- Impact: Shields break faster

### If Battles Too Fast (<35s average)

**Option 1**: Reduce weapon damage more
- Current: -27% nerf
- Adjust to: -35% nerf
- Impact: 11% slower battles

**Option 2**: Increase armor effectiveness
- Current: 1.5% per point
- Adjust to: 1.8% per point
- Impact: Armor more effective, slower damage

**Option 3**: Increase shield HP
- Current: Energy Shield Capacity × 2
- Adjust to: Energy Shield Capacity × 2.5
- Impact: Shields last longer

### If Armor Still Dominant

**Option 1**: Reduce ARMOR_EFFECTIVENESS
- Try: 1.2% or 1.0% per point

**Option 2**: Increase PENETRATION_BONUS
- Try: 2.5% or 3.0% per excess point

**Option 3**: Add soft cap
- Example: Diminishing returns above 30 armor

### If Penetration Dominant

**Option 1**: Reduce PENETRATION_BONUS
- Try: 1.5% or 1.0% per excess point

**Option 2**: Add penetration soft cap
- Example: Diminishing returns above 25 penetration

---

## Success Criteria Summary

✅ **Must Achieve:**
1. Average battle duration: 40-60 seconds
2. Draw rate: 5-15%
3. No attribute in >60% of top 20 robots

✅ **Should Achieve:**
4. Weapon prices change <25%
5. 90% of battles between 35-65 seconds
6. Shields break in 80-90% of battles

✅ **Nice to Have:**
7. Player feedback positive on battle speed
8. Build diversity increases (multiple viable archetypes)
9. No emergency hotfixes needed in first week

---

**End of Quick Reference**

**Next**: Review BALANCE_PROPOSAL_REBALANCE_2026.md for comprehensive analysis, then proceed with implementation when approved.
