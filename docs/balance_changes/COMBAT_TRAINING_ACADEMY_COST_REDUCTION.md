# Combat Training Academy Cost Reduction

**Date**: March 11, 2026  
**Status**: ✅ Implemented  
**Priority**: Medium - Economic parity fix

---

## What Changed

### Upgrade Costs (All 10 Levels)

| Level | Old Cost | New Cost | Reduction |
|-------|----------|----------|-----------|
| 1 | ₡200,000 | ₡100,000 | 50% |
| 2 | ₡400,000 | ₡200,000 | 50% |
| 3 | ₡600,000 | ₡300,000 | 50% |
| 4 | ₡800,000 | ₡400,000 | 50% |
| 5 | ₡1,000,000 | ₡500,000 | 50% |
| 6 | ₡1,200,000 | ₡600,000 | 50% |
| 7 | ₡1,400,000 | ₡700,000 | 50% |
| 8 | ₡1,600,000 | ₡800,000 | 50% |
| 9 | ₡1,800,000 | ₡900,000 | 50% |
| 10 | ₡2,000,000 | ₡1,000,000 | 50% |

**Total cost to max**: ₡12,000,000 → ₡5,500,000 (54% reduction)

---

## Why It Changed

The Combat Training Academy costs were exactly 2× the Defense Training Academy costs despite both facilities serving the same role (raising attribute caps for their respective stat). This created an unintended imbalance:

1. **Cost parity with Defense Training Academy**: The Defense Training Academy already uses the ₡100K–₡1M linear cost curve. Combat Training Academy now matches this, since both facilities provide equivalent value (attribute cap increases in their respective trees).

2. **Offensive vs. defensive investment fairness**: Players investing in Combat Systems were paying double compared to those investing in Defensive Systems for the same type of benefit (raising an attribute cap by 5 per level). This discouraged offensive builds and skewed the meta toward defense-heavy strategies.

3. **Progression smoothing**: The old ₡200K entry cost was a steep barrier at the point in the game where players first need to push past the default Combat Systems cap. The new ₡100K entry point aligns with typical mid-game credit availability.

---

## Expected Impact on Gameplay

### Build Diversity
- Offensive and hybrid builds become more economically viable
- Players no longer penalized for choosing Combat Systems progression over Defensive Systems
- Should reduce the prevalence of defense-heavy meta strategies

### Economy
- Earlier access to Combat Systems cap increases (lower entry cost)
- Total investment to max Combat Training Academy drops from ₡12M to ₡5.5M, freeing credits for other facilities and upgrades
- More consistent facility pricing across the board

### Progression Pacing
- Mid-game players can start raising Combat Systems caps sooner
- Late-game players reach max Combat Training Academy level with less total spend, but prestige gates remain unchanged so progression timing is still gated

### No Changes To
- Benefit per level (still +5 Combat Systems cap per level)
- Max level (still 10)
- Prestige requirements (L3: 2000, L5: 4000, L7: 7000, L9: 10000, L10: 15000)
- Any other facility costs

---

## Files Modified

1. `prototype/backend/src/config/facilities.ts` — Combat Training Academy `costs` array updated

---

## Testing Checklist

- [ ] Verify Combat Training Academy L1 costs ₡100,000
- [ ] Verify Combat Training Academy L10 costs ₡1,000,000
- [ ] Confirm costs now match Defense Training Academy
- [ ] Verify prestige gates are unaffected
- [ ] Test upgrade purchase flow at each level
