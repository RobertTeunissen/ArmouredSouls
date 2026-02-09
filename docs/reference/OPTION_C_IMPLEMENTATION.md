# Option C Implementation: Hybrid Economy Rebalancing

**Date**: February 8, 2026  
**Issue**: Rebalance cost of Facilities  
**Status**: ✅ IMPLEMENTED  
**Approach**: Option C (Hybrid) - Per user decision

---

## Executive Summary

Implemented **Option C (Hybrid approach)** to fix severe imbalance where facilities had terrible ROI compared to robot upgrades and battle farming. This approach provides better long-term balance than the initially implemented Option D.

### Changes Implemented

| System | Old Value | New Value | Change |
|--------|-----------|-----------|--------|
| **Starting Money** | ₡2,000,000 | ₡3,000,000 | +50% |
| **Attribute Upgrade Cost** | level × 1,000 | level × 1,500 | +50% |
| **Facility Costs** | Base prices | -50% reduction | -50% |
| **Weapon Costs** | Base prices | +25% increase | +25% |

---

## Rationale: Why Option C?

### Option D (Initially Implemented)
- **Change**: 70% facility cost reduction only
- **Problem**: Too aggressive, made facilities too cheap
- **Issue**: Didn't address attribute upgrade pacing

### Option C (User Choice - Better)
- **Changes**: Multiple systems adjusted together
- **Benefits**:
  - More balanced long-term progression
  - Facilities attractive without being trivial
  - Slower attribute progression = more strategic choices
  - Higher weapon costs = facilities provide better ROI
  - Extra starting money enables diverse strategies

---

## Detailed Cost Changes

### 1. Starting Money: ₡2M → ₡3M

**Impact**: Players can now afford one maxed robot OR multiple moderate robots OR heavy facility investment

**Strategic Options with ₡3M:**
- **Power Rush**: Max 1 robot (₡1.6M) + elite weapon (₡400K) + facilities (₡500K)
- **Balanced Growth**: 1 robot (₡500K) + moderate upgrades (₡600K) + many facilities (₡1M) + weapons (₡400K)
- **Multi-Robot**: 3 robots (₡1.5M) + basic upgrades (₡900K) + facilities (₡300K) + weapons (₡300K)

### 2. Attribute Upgrade Costs: +50%

**Old Formula**: `cost = (level + 1) × 1,000`
**New Formula**: `cost = (level + 1) × 1,500`

**Cost to Upgrade 1 Attribute (1→10):**
- Old: ₡54,000
- New: ₡81,000
- Increase: +₡27,000 (+50%)

**Cost to Max 15 Attributes (1→10):**
- Old: ₡810,000
- New: ₡1,215,000
- Increase: +₡405,000 (+50%)

**Cost to Max 1 Attribute (1→50):**
- Old: ₡1,274,000
- New: ₡1,911,000
- Increase: +₡637,000 (+50%)

**Impact**: Slower progression, more value from Training Facility discounts

### 3. Facility Costs: -50% (Not -70%)

#### Key Discount Facilities

| Facility | Old L1 | New L1 | Old L5 Total | New L5 Total |
|----------|--------|--------|--------------|--------------|
| **Repair Bay** | ₡200K | ₡100K | ₡3.0M | ₡1.5M |
| **Training Facility** | ₡300K | ₡150K | ₡4.5M | ₡2.25M |
| **Weapons Workshop** | ₡250K | ₡125K | ₡3.8M | ₡1.9M |

#### Training Academies (Cap Increasers)

| Facility | Old L1 | New L1 | Old L5 Total | New L5 Total |
|----------|--------|--------|--------------|--------------|
| **Combat Academy** | ₡400K | ₡200K | ₡11.4M | ₡5.7M |
| **Defense Academy** | ₡400K | ₡200K | ₡11.4M | ₡5.7M |
| **Mobility Academy** | ₡400K | ₡200K | ₡11.4M | ₡5.7M |
| **AI Academy** | ₡500K | ₡250K | ₡14.25M | ₡7.125M |

#### Special Facilities

| Facility | Old L1 | New L1 | Impact |
|----------|--------|--------|---------|
| **Income Generator** | ₡800K | ₡400K | Passive income unlocked earlier |
| **Roster Expansion** | ₡300K | ₡150K | Multi-robot strategies viable |
| **Storage Facility** | ₡150K | ₡75K | Weapon collection affordable |

### 4. Weapon Costs: +25%

#### Budget Tier
| Weapon | Old Cost | New Cost | Change |
|--------|----------|----------|--------|
| Practice Sword | ₡50K | ₡62.5K | +₡12.5K |
| Machine Pistol | ₡75K | ₡94K | +₡19K |
| Laser Pistol | ₡75K | ₡94K | +₡19K |
| Combat Knife | ₡90K | ₡113K | +₡23K |
| Light Shield | ₡50K | ₡62.5K | +₡12.5K |
| Combat Shield | ₡80K | ₡100K | +₡20K |
| Reactive Shield | ₡90K | ₡113K | +₡23K |
| Machine Gun | ₡120K | ₡150K | +₡30K |

#### Mid Tier
| Weapon | Old Cost | New Cost | Change |
|--------|----------|----------|--------|
| Burst Rifle | ₡145K | ₡181K | +₡36K |
| Assault Rifle | ₡150K | ₡188K | +₡38K |
| Energy Blade | ₡190K | ₡238K | +₡48K |
| Laser Rifle | ₡195K | ₡244K | +₡49K |

#### Premium Tier
| Weapon | Old Cost | New Cost | Change |
|--------|----------|----------|--------|
| Plasma Blade | ₡215K | ₡269K | +₡54K |
| Plasma Rifle | ₡220K | ₡275K | +₡55K |
| Power Sword | ₡280K | ₡350K | +₡70K |

#### Elite Tier (Two-Handed)
| Weapon | Old Cost | New Cost | Change |
|--------|----------|----------|--------|
| Shotgun | ₡215K | ₡269K | +₡54K |
| Grenade Launcher | ₡235K | ₡294K | +₡59K |
| Sniper Rifle | ₡295K | ₡369K | +₡74K |
| Battle Axe | ₡310K | ₡388K | +₡78K |
| Plasma Cannon | ₡320K | ₡400K | +₡80K |
| Heavy Hammer | ₡360K | ₡450K | +₡90K |
| Railgun | ₡390K | ₡488K | +₡98K |
| **Ion Beam** | ₡430K | ₡538K | +₡108K |

---

## ROI Analysis with Option C

### Training Facility ROI

**Scenario**: Upgrade 15 attributes from 1→10 on one robot

**Without Training Facility:**
- Cost: 15 × ₡81K = ₡1,215,000

**With Training Facility Level 5 (25% discount):**
- Facility Cost: ₡2,250,000
- Upgrade Cost: 15 × ₡81K × 0.75 = ₡911,250
- Savings: ₡303,750 per robot

**Break-even**: ₡2,250,000 / ₡303,750 = **7.4 robots**

**Conclusion**: Much more balanced than Option D (which was too cheap)

### Weapons Workshop ROI

**Scenario**: Buy 10 high-tier weapons (avg ₡250K each)

**Without Weapons Workshop:**
- Cost: 10 × ₡250K = ₡2,500,000

**With Weapons Workshop Level 5 (25% discount):**
- Facility Cost: ₡1,900,000
- Weapon Cost: ₡2,500,000 × 0.75 = ₡1,875,000
- Savings: ₡625,000

**Break-even**: ₡1,900,000 / ₡62,500 (savings per weapon) = **30 weapons**

**Conclusion**: Reasonable for players who experiment with loadouts

### Income Generator ROI

**Level 1 Analysis:**
- Cost: ₡400,000
- Daily Income: ₡5,000 (merchandising base)
- Daily Operating Cost: ₡1,000
- Net Daily Income: ₡4,000

**Break-even**: ₡400,000 / ₡4,000 = **100 days (~3 months)**

**Comparison to Battle Farming:**
- Gold League avg: ₡30,000/win
- To earn ₡400K: ~13 wins
- At 1 battle/day: 13 days

**Conclusion**: Passive income still slower than active play, but reasonable long-term investment

---

## Game Balance Impact

### Correct League Rewards (2x Progression)

**From economyCalculations.ts (verified correct):**
```typescript
{
  bronze: { min: 5000, max: 10000 },      // avg ₡7.5K
  silver: { min: 10000, max: 20000 },     // avg ₡15K (2x)
  gold: { min: 20000, max: 40000 },       // avg ₡30K (2x)
  platinum: { min: 40000, max: 80000 },   // avg ₡60K (2x)
  diamond: { min: 80000, max: 150000 },   // avg ₡115K (~2x)
  champion: { min: 150000, max: 300000 }, // avg ₡225K (2x)
}
```

**Progression**: Consistent 2x multiplier per league tier (smooth exponential curve)

### Strategic Diversity

With Option C, multiple strategies are viable:

**Strategy 1: Power Rush (Single Robot)**
- Create robot: ₡500K
- Max 15 attributes (1→10): ₡1,215K
- Elite weapon: ₡400K
- Combat Academy L1 (for 15+ caps): ₡200K
- **Total**: ₡2,315K / ₡3M = 77% of budget
- **Outcome**: Strong early robot, limited facilities

**Strategy 2: Balanced Growth**
- Create robot: ₡500K
- Moderate upgrades (avg level 6): ₡500K
- Training Facility L3: ₡600K
- Combat Academy L1: ₡200K
- Income Generator L1: ₡400K
- Mid-tier weapons (2×): ₡400K
- **Total**: ₡2,600K / ₡3M = 87% of budget
- **Outcome**: Good infrastructure, slower start

**Strategy 3: Multi-Robot Stable**
- Create 3 robots: ₡1,500K
- Basic upgrades each (₡200K × 3): ₡600K
- Roster Expansion L2: ₡450K
- Budget weapons (3×): ₡240K
- **Total**: ₡2,790K / ₡3M = 93% of budget
- **Outcome**: Flexible roster, team play ready

---

## Implementation Files Changed

### Backend Changes
1. **`prototype/backend/prisma/schema.prisma`**
   - Line 20: `currency Int @default(3000000)`

2. **`prototype/backend/src/routes/robots.ts`**
   - Line 321: `const baseCost = (Math.floor(currentLevel) + 1) * 1500;`

3. **`prototype/backend/src/config/facilities.ts`**
   - All 14 facility cost arrays updated to 50% of original

4. **`prototype/backend/prisma/seed.ts`**
   - All 23 weapon costs increased by 25%

### Migration Required
- Database migration needed for existing users (starting money change)
- Existing facilities keep their purchase price
- Weapon reseed required for price updates

---

## Verification

### Starting Money
```sql
SELECT currency FROM users WHERE id = 1;
-- Should return: 3000000 for new users
```

### Attribute Upgrade Cost
Test upgrade from level 1→2:
- Expected: ₡3,000 (was ₡2,000)

### Facility Cost
```typescript
getFacilityUpgradeCost('training_facility', 0)
// Expected: 150000 (was 300000)
```

### Weapon Cost
```sql
SELECT name, cost FROM weapons WHERE name = 'Ion Beam';
-- Expected: 538000 (was 430000)
```

---

## Conclusion

Option C provides superior balance compared to Option D:

✅ **Facilities are viable** without being trivial
✅ **Multiple strategic paths** to success  
✅ **Slower progression** prevents power creep  
✅ **Better ROI calculations** for long-term planning  
✅ **More starting money** enables strategic diversity

The 2x league progression remains intact (user decision), providing exciting advancement while Option C's cost changes prevent single-robot dominance from being overwhelming.

---

**Status**: ✅ Implementation Complete  
**Next Steps**: 
- Test with actual database
- Monitor player behavior in playtesting
- Fine-tune if needed based on data
