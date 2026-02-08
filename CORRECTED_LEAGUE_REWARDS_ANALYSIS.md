# Corrected Economy Analysis - League Rewards

## CORRECTED: Actual League Rewards from Code

**Source:** `prototype/backend/src/utils/economyCalculations.ts`

```typescript
const rewards = {
  bronze: { min: 5000, max: 10000 },
  silver: { min: 10000, max: 20000 },    // 2x Bronze
  gold: { min: 20000, max: 40000 },      // 2x Silver
  platinum: { min: 40000, max: 80000 },   // 2x Gold
  diamond: { min: 80000, max: 150000 },   // ~2x Platinum
  champion: { min: 150000, max: 300000 }, // 2x Diamond
};
```

## Progression Analysis

### Growth Pattern
- **Bronze → Silver**: 2x increase
- **Silver → Gold**: 2x increase
- **Gold → Platinum**: 2x increase
- **Platinum → Diamond**: 1.875x increase (slightly less than 2x)
- **Diamond → Champion**: 2x increase

**Conclusion**: Consistent ~2x exponential growth per league tier

### Average Rewards Per Win

| League | Min | Max | Average | Multiplier from Previous |
|--------|-----|-----|---------|--------------------------|
| Bronze | ₡5K | ₡10K | **₡7.5K** | - |
| Silver | ₡10K | ₡20K | **₡15K** | 2x |
| Gold | ₡20K | ₡40K | **₡30K** | 2x |
| Platinum | ₡40K | ₡80K | **₡60K** | 2x |
| Diamond | ₡80K | ₡150K | **₡115K** | 1.9x |
| Champion | ₡150K | ₡300K | **₡225K** | 2x |

## Impact on Strategy

### Cost to Max 15 Attributes: ₡810,000

| League | Wins Needed | Days Needed (1 battle/day) |
|--------|-------------|---------------------------|
| **Bronze** | 108 wins | 3.6 months |
| **Silver** | 54 wins | 1.8 months |
| **Gold** | 27 wins | 0.9 months |
| **Platinum** | 14 wins | 2 weeks |
| **Diamond** | 7 wins | 1 week |
| **Champion** | 4 wins | 4 days |

### Strategic Implications

**Single-Robot Strategy:**
1. Start with ₡2M
2. Create robot (₡500K) → ₡1.5M
3. Max 15 attributes (₡810K) → ₡690K
4. Buy weapon (₡150K) → ₡540K
5. Climb to Gold/Platinum quickly
6. Earn ₡30K-₡60K per win
7. Easily afford facilities and second robot

**Multi-Robot Strategy:**
1. Create 2 robots (₡1M) → ₡1M
2. Moderate upgrades each (₡400K each = ₡800K) → ₡200K
3. Buy weapons (₡200K) → ₡0K
4. Both stuck in Bronze/Silver (₡7.5K-₡15K per win)
5. Slow progression, less total income

**Conclusion**: The 2x progression **heavily favors** single-robot strategy!

## Is This a Problem?

### Arguments FOR Current 2x Progression:
1. **Reward progression**: Makes league advancement feel meaningful
2. **Competition incentive**: Encourages players to improve their best robot
3. **Champion prestige**: Top league feels truly elite
4. **Clear goals**: Players know what to aim for

### Arguments AGAINST (User's Concern):
1. **Strategy dominance**: One-robot strategy is objectively superior
2. **Roster Expansion useless**: No reason to have multiple robots early
3. **Facilities devalued**: Training/repair for multiple robots less valuable
4. **Boring gameplay**: Everyone follows same optimal path

## Alternative Progressions

### Option 1: Softer Curve (1.5x multiplier)
```
Bronze:   ₡5K-10K   (avg ₡7.5K)
Silver:   ₡8K-15K   (avg ₡11.25K) - 1.5x
Gold:     ₡12K-23K  (avg ₡17K)    - 1.5x
Platinum: ₡18K-34K  (avg ₡26K)    - 1.5x
Diamond:  ₡27K-51K  (avg ₡39K)    - 1.5x
Champion: ₡41K-77K  (avg ₡59K)    - 1.5x
```
**Impact**: Multi-robot strategy viable, Champion less special

### Option 2: Linear Progression (constant +₡5K)
```
Bronze:   ₡5K-10K   (avg ₡7.5K)
Silver:   ₡10K-20K  (avg ₡15K)   - +₡7.5K
Gold:     ₡15K-30K  (avg ₡22.5K) - +₡7.5K
Platinum: ₡20K-40K  (avg ₡30K)   - +₡7.5K
Diamond:  ₡25K-50K  (avg ₡37.5K) - +₡7.5K
Champion: ₡30K-60K  (avg ₡45K)   - +₡7.5K
```
**Impact**: Very balanced, but no excitement in progression

### Option 3: Hybrid (1.75x multiplier)
```
Bronze:   ₡5K-10K   (avg ₡7.5K)
Silver:   ₡9K-18K   (avg ₡13K)   - 1.75x
Gold:     ₡16K-31K  (avg ₡23K)   - 1.75x
Platinum: ₡28K-54K  (avg ₡41K)   - 1.75x
Diamond:  ₡49K-95K  (avg ₡72K)   - 1.75x
Champion: ₡86K-166K (avg ₡126K)  - 1.75x
```
**Impact**: Better balance, still feels progressive

### Option 4: Keep 2x, Add Team Battle Bonuses
Keep current progression, but add:
- **2v2 battles**: 1.5x total rewards (shared between robots)
- **3v3 battles**: 2x total rewards (shared between robots)
- **Team synergy bonuses**: Extra rewards for coordinated teams

**Impact**: Single-robot still strong, but multi-robot has advantages

## Recommendation

Given your concern about the steep progression favoring one-robot strategy, I recommend:

**Short-term (this PR):**
- Document the current progression and its strategic implications
- Acknowledge the single-robot advantage
- Add it to future balance considerations

**Future (separate PR):**
- Monitor player behavior in playtesting
- If single-robot dominates, consider:
  - **Option 3 (1.75x)**: Best compromise between progression feel and balance
  - **Option 4 (Team bonuses)**: Adds new mechanics, more interesting

**Note**: Changing league rewards affects all existing player expectations, so should be done carefully with playtesting.
