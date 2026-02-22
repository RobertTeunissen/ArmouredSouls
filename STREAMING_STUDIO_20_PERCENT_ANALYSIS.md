# Streaming Studio Break-Even Analysis: 20% Per Level

## Proposed Changes

**Keep Investment Costs:**
- L1: ₡100,000 (unchanged)
- L2: ₡200,000 (unchanged)
- L3: ₡300,000 (unchanged)

**Increase Studio Multiplier:**
- L1: 1.20× (was 1.1×) - +20% bonus
- L2: 1.40× (was 1.2×) - +40% bonus
- L3: 1.60× (was 1.3×) - +60% bonus
- Formula: 1 + (level × 0.20)

**Keep Operating Costs:**
- L1: ₡100/day (unchanged)
- L2: ₡200/day (unchanged)
- L3: ₡300/day (unchanged)

---

## Break-Even Analysis: Level 1 (₡100K Investment, +20% Bonus)

### 1-Robot Strategy

**Starting Point (Cycle 10):**
- Battles: 80
- Fame: 100
- Base revenue (no studio): 1000 × 1.08 × 1.02 × 1.0 = ₡1,102/battle

**With Studio L1 (+20%):**
- Revenue: 1000 × 1.08 × 1.02 × 1.2 = ₡1,322/battle
- Gain per battle: ₡220 (was ₡110 with +10%)
- Battles per cycle: 8
- Gross gain per cycle: 8 × ₡220 = ₡1,760
- Operating cost: ₡100/day
- **Net gain per cycle: ₡1,660**

**Break-even:** ₡100,000 / ₡1,660 ≈ **60 cycles**

**With Growth (Cycle 20):**
- Battles: 160
- Fame: 250
- Base revenue: 1000 × 1.16 × 1.05 × 1.0 = ₡1,218/battle
- With Studio L1: 1000 × 1.16 × 1.05 × 1.2 = ₡1,462/battle
- Gain per battle: ₡244
- Net per cycle: (8 × ₡244) - ₡100 = ₡1,852

**With Growth (Cycle 30):**
- Battles: 240
- Fame: 450
- Base revenue: 1000 × 1.24 × 1.09 × 1.0 = ₡1,352/battle
- With Studio L1: 1000 × 1.24 × 1.09 × 1.2 = ₡1,622/battle
- Gain per battle: ₡270
- Net per cycle: (8 × ₡270) - ₡100 = ₡2,060

**Average net gain over first 30 cycles:** ~₡1,850/cycle
**Adjusted break-even:** ₡100,000 / ₡1,850 ≈ **54 cycles**

---

### 2-Robot Strategy

**Starting Point (Cycle 10):**
- Battles per robot: 60
- Fame per robot: 75
- Base revenue per robot: 1000 × 1.06 × 1.015 × 1.0 = ₡1,076/battle
- Total battles per cycle: 12

**With Studio L1 (+20%):**
- Revenue per robot: 1000 × 1.06 × 1.015 × 1.2 = ₡1,291/battle
- Gain per battle: ₡215 (was ₡108 with +10%)
- Gross gain per cycle: 12 × ₡215 = ₡2,580
- Operating cost: ₡100/day
- **Net gain per cycle: ₡2,480**

**Break-even:** ₡100,000 / ₡2,480 ≈ **40 cycles**

**With Growth (Cycle 20):**
- Battles per robot: 120
- Fame per robot: 175
- Base revenue: 1000 × 1.12 × 1.035 × 1.0 = ₡1,159/battle
- With Studio L1: 1000 × 1.12 × 1.035 × 1.2 = ₡1,391/battle
- Gain per battle: ₡232
- Net per cycle: (12 × ₡232) - ₡100 = ₡2,684

**With Growth (Cycle 30):**
- Battles per robot: 180
- Fame per robot: 300
- Base revenue: 1000 × 1.18 × 1.06 × 1.0 = ₡1,251/battle
- With Studio L1: 1000 × 1.18 × 1.06 × 1.2 = ₡1,501/battle
- Gain per battle: ₡250
- Net per cycle: (12 × ₡250) - ₡100 = ₡2,900

**Average net gain over first 30 cycles:** ~₡2,700/cycle
**Adjusted break-even:** ₡100,000 / ₡2,700 ≈ **37 cycles**

---

### 3-Robot Strategy

**Starting Point (Cycle 10):**
- Battles per robot: 50
- Fame per robot: 60
- Base revenue per robot: 1000 × 1.05 × 1.012 × 1.0 = ₡1,063/battle
- Total battles per cycle: 15

**With Studio L1 (+20%):**
- Revenue per robot: 1000 × 1.05 × 1.012 × 1.2 = ₡1,275/battle
- Gain per battle: ₡212 (was ₡106 with +10%)
- Gross gain per cycle: 15 × ₡212 = ₡3,180
- Operating cost: ₡100/day
- **Net gain per cycle: ₡3,080**

**Break-even:** ₡100,000 / ₡3,080 ≈ **32 cycles** ✓

**With Growth (Cycle 20):**
- Battles per robot: 100
- Fame per robot: 135
- Base revenue: 1000 × 1.10 × 1.027 × 1.0 = ₡1,130/battle
- With Studio L1: 1000 × 1.10 × 1.027 × 1.2 = ₡1,356/battle
- Gain per battle: ₡226
- Net per cycle: (15 × ₡226) - ₡100 = ₡3,290

**With Growth (Cycle 30):**
- Battles per robot: 150
- Fame per robot: 225
- Base revenue: 1000 × 1.15 × 1.045 × 1.0 = ₡1,202/battle
- With Studio L1: 1000 × 1.15 × 1.045 × 1.2 = ₡1,442/battle
- Gain per battle: ₡240
- Net per cycle: (15 × ₡240) - ₡100 = ₡3,500

**Average net gain over first 30 cycles:** ~₡3,300/cycle
**Adjusted break-even:** ₡100,000 / ₡3,300 ≈ **30 cycles** ✓

---

## Summary: Level 1 Break-Even (20% Bonus)

| Strategy | Battles/Cycle | Initial Net/Cycle | Break-even (cycles) | Assessment |
|----------|--------------|-------------------|---------------------|------------|
| 1 Robot | 8 | ₡1,660 | ~54 cycles | ⚠️ Acceptable |
| 2 Robots | 12 | ₡2,480 | ~37 cycles | ✓ Good |
| 3 Robots | 15 | ₡3,080 | ~30 cycles | ✓ Target met! |

**Improvement from +10% to +20%:**
- 1-robot: 118 → 54 cycles (54% faster)
- 2-robot: 80 → 37 cycles (54% faster)
- 3-robot: 65 → 30 cycles (54% faster)

---

## Break-Even Analysis: Level 2 (₡300K Total, +40% Bonus)

### 3-Robot Strategy (Best Case)

**Cycle 20:**
- Battles per robot: 100
- Fame per robot: 135
- Base revenue: 1000 × 1.10 × 1.027 × 1.0 = ₡1,130/battle
- With Studio L2: 1000 × 1.10 × 1.027 × 1.4 = ₡1,582/battle
- Gain per battle: ₡452
- Operating cost: ₡200/day
- Net per cycle: (15 × ₡452) - ₡200 = ₡6,580

**Break-even for L2 upgrade (₡200K additional):**
₡200,000 / ₡6,580 ≈ **30 cycles**

**Total break-even from L0 to L2:**
- L1 investment: ₡100K, breaks even in 30 cycles
- L2 upgrade: ₡200K, breaks even in 30 more cycles
- **Total: 60 cycles to fully recover L2 investment**

---

## Break-Even Analysis: Level 3 (₡600K Total, +60% Bonus)

### 3-Robot Strategy (Best Case)

**Cycle 30:**
- Battles per robot: 150
- Fame per robot: 225
- Base revenue: 1000 × 1.15 × 1.045 × 1.0 = ₡1,202/battle
- With Studio L3: 1000 × 1.15 × 1.045 × 1.6 = ₡1,923/battle
- Gain per battle: ₡721
- Operating cost: ₡300/day
- Net per cycle: (15 × ₡721) - ₡300 = ₡10,515

**Break-even for L3 upgrade (₡300K additional):**
₡300,000 / ₡10,515 ≈ **29 cycles**

**Total break-even from L0 to L3:**
- L1: 30 cycles
- L2: 30 cycles
- L3: 29 cycles
- **Total: 89 cycles to fully recover L3 investment**

---

## Comparison: +10% vs +20% Per Level

### Level 1 (₡100K Investment)

| Strategy | +10% Bonus | +20% Bonus | Improvement |
|----------|-----------|-----------|-------------|
| 1 Robot | 118 cycles | 54 cycles | 54% faster |
| 2 Robots | 80 cycles | 37 cycles | 54% faster |
| 3 Robots | 65 cycles | 30 cycles | 54% faster |

### Level 3 (₡600K Total Investment)

| Strategy | +30% Bonus | +60% Bonus | Improvement |
|----------|-----------|-----------|-------------|
| 1 Robot | 229 cycles | 105 cycles | 54% faster |
| 2 Robots | 155 cycles | 71 cycles | 54% faster |
| 3 Robots | 125 cycles | 57 cycles | 54% faster |

---

## Return on Investment Analysis

### 3-Robot Strategy (Recommended)

**Year 1 (52 cycles):**
- Investment: ₡100K (L1)
- Break-even: Cycle 30
- Profit after break-even: 22 cycles × ₡3,300 = ₡72,600
- **ROI: 73%** (₡72,600 profit on ₡100K investment)

**Year 2 (104 cycles total):**
- Additional investment: ₡200K (L2 upgrade at cycle 52)
- L1 continues earning: 52 cycles × ₡3,300 = ₡171,600
- L2 breaks even: Cycle 82
- L2 profit: 22 cycles × ₡6,580 = ₡144,760
- **Total profit: ₡316,360 on ₡300K investment**
- **ROI: 105%**

### 2-Robot Strategy (Balanced)

**Year 1 (52 cycles):**
- Investment: ₡100K (L1)
- Break-even: Cycle 37
- Profit after break-even: 15 cycles × ₡2,700 = ₡40,500
- **ROI: 41%**

### 1-Robot Strategy (Tournament Focused)

**Year 1 (52 cycles):**
- Investment: ₡100K (L1)
- Break-even: Cycle 54
- Still paying off at end of year
- **ROI: -4%** (not yet profitable)

---

## Comparison to Merchandising Hub

### Level 1 Investment (₡150K vs ₡100K)

| Facility | Investment | Strategy | Net/Cycle | Break-even | Year 1 Profit |
|----------|-----------|----------|-----------|------------|---------------|
| Merchandising Hub | ₡150K | Any | ₡4,800 | 31 cycles | ₡100,800 |
| Streaming Studio | ₡100K | 3 robots | ₡3,080 | 30 cycles | ₡72,600 |
| Streaming Studio | ₡100K | 2 robots | ₡2,480 | 37 cycles | ₡40,500 |
| Streaming Studio | ₡100K | 1 robot | ₡1,660 | 54 cycles | -₡4,000 |

**Key Insights:**
1. **Merchandising Hub** is more profitable per cycle (₡4,800 vs ₡3,080)
2. **Streaming Studio** requires less upfront investment (₡100K vs ₡150K)
3. **Streaming Studio** rewards active play (more robots = better ROI)
4. **Both facilities** achieve ~30 cycle break-even with optimal strategy

---

## Strategic Implications

### Early Game (Cycles 1-30)
- **Merchandising Hub first** - guaranteed passive income, works with any strategy
- **Streaming Studio second** - if running 2+ robots, adds significant battle income

### Mid Game (Cycles 31-100)
- **Upgrade Merchandising Hub** - scales with prestige
- **Add Streaming Studio L1** - if not already purchased
- **Consider Studio L2** - if running 3+ robots actively

### Late Game (Cycles 100+)
- **Max both facilities** - complementary income streams
- **Merchandising** provides stable base income
- **Streaming** rewards high battle activity

---

## Recommendation: 20% Per Level

**Pros:**
- ✓ Achieves 30-cycle break-even for 3-robot strategy (target met!)
- ✓ Keeps ₡100K investment (feels substantial)
- ✓ Rewards active play (more robots = faster ROI)
- ✓ Competitive with Merchandising Hub
- ✓ Clear progression (20%, 40%, 60%, 80%, 100% at L5)

**Cons:**
- ⚠️ 1-robot strategy takes 54 cycles (acceptable but not ideal)
- ⚠️ Requires multi-robot investment to be optimal

**Verdict:** 
The 20% per level bonus achieves the 25-30 cycle target for active players (2-3 robots) while keeping the ₡100K investment meaningful. It creates a clear strategic choice:
- **Merchandising Hub:** Safe, passive, works for everyone
- **Streaming Studio:** Active, scales with battles, rewards multi-robot play

This differentiation is healthy for the game economy.

---

## Final Numbers: Streaming Studio (20% Per Level)

| Level | Investment | Operating Cost | Studio Multiplier | Benefit |
|-------|-----------|----------------|------------------|---------|
| 1 | ₡100,000 | ₡100/day | 1.20× | +20% |
| 2 | ₡200,000 | ₡200/day | 1.40× | +40% |
| 3 | ₡300,000 | ₡300/day | 1.60× | +60% |
| 4 | ₡400,000 | ₡400/day | 1.80× | +80% |
| 5 | ₡500,000 | ₡500/day | 2.00× | +100% (double!) |
| 6 | ₡600,000 | ₡600/day | 2.20× | +120% |
| 7 | ₡700,000 | ₡700/day | 2.40× | +140% |
| 8 | ₡800,000 | ₡800/day | 2.60× | +160% |
| 9 | ₡900,000 | ₡900/day | 2.80× | +180% |
| 10 | ₡1,000,000 | ₡1,000/day | 3.00× | +200% (triple!) |

**Break-even Summary:**
- **3 robots:** 30 cycles ✓
- **2 robots:** 37 cycles ✓
- **1 robot:** 54 cycles (acceptable)
