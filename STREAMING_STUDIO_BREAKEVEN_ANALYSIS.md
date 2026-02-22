# Streaming Studio Break-Even Analysis

## Streaming Revenue Formula

**Base Formula:**
```
Revenue = 1000 × (1 + battles/1000) × (1 + fame/5000) × (1 + level×0.1)
```

**Components:**
- Base: ₡1,000
- Battle Multiplier: 1 + (total_battles / 1000)
- Fame Multiplier: 1 + (fame / 5000)
- Studio Multiplier: 1 + (level × 0.1)

## Streaming Studio Economics

| Level | Investment | Operating Cost/Day | Studio Multiplier | Benefit |
|-------|-----------|-------------------|------------------|---------|
| 0 | ₡0 | ₡0 | 1.0× | No bonus |
| 1 | ₡100K | ₡100 | 1.1× | +10% |
| 2 | ₡300K total | ₡200 | 1.2× | +20% |
| 3 | ₡600K total | ₡300 | 1.3× | +30% |

## Strategy Assumptions

### 1-Robot Strategy (Tournament Focused)
- **Battles per cycle:** 8 (more tournament matches, higher win rate)
- **Win rate:** 60% (focused training, better matchmaking)
- **Fame accumulation:** Faster (more wins)
- **Starting fame:** 100 (after 10 cycles)
- **Battle count:** 80 (after 10 cycles)

### 2-Robot Strategy (Balanced)
- **Battles per cycle:** 6 per robot = 12 total
- **Win rate:** 50% (standard matchmaking)
- **Fame accumulation:** Moderate
- **Starting fame per robot:** 75 (after 10 cycles)
- **Battle count per robot:** 60 (after 10 cycles)

### 3-Robot Strategy (Volume Play)
- **Battles per cycle:** 5 per robot = 15 total
- **Win rate:** 45% (spread thin, lower win rate)
- **Fame accumulation:** Slower per robot
- **Starting fame per robot:** 60 (after 10 cycles)
- **Battle count per robot:** 50 (after 10 cycles)

## Break-Even Analysis: Level 1 (₡100K Investment)

### 1-Robot Strategy

**Starting Point (Cycle 10):**
- Battles: 80
- Fame: 100
- Base revenue: 1000 × 1.08 × 1.02 × 1.0 = ₡1,102/battle

**With Studio L1:**
- Revenue: 1000 × 1.08 × 1.02 × 1.1 = ₡1,212/battle
- Gain per battle: ₡110
- Operating cost: ₡100/day

**Cycle 11 (8 battles):**
- Additional revenue: 8 × ₡110 = ₡880
- Operating cost: ₡100
- Net gain: ₡780

**Break-even:** ₡100,000 / ₡780 ≈ **128 cycles** ❌

**But wait - fame and battles grow!**

**Cycle 20 (after 10 more cycles):**
- Battles: 160
- Fame: 250 (assuming 60% win rate, ~15 prestige/cycle)
- Base revenue: 1000 × 1.16 × 1.05 × 1.0 = ₡1,218/battle
- With Studio: 1000 × 1.16 × 1.05 × 1.1 = ₡1,340/battle
- Gain per battle: ₡122
- Net per cycle: (8 × ₡122) - ₡100 = ₡876

**Cycle 30:**
- Battles: 240
- Fame: 450
- Base revenue: 1000 × 1.24 × 1.09 × 1.0 = ₡1,352/battle
- With Studio: 1000 × 1.24 × 1.09 × 1.1 = ₡1,487/battle
- Gain per battle: ₡135
- Net per cycle: (8 × ₡135) - ₡100 = ₡980

**Average net gain over 30 cycles:** ~₡850/cycle
**Break-even:** ₡100,000 / ₡850 ≈ **118 cycles** ❌

---

### 2-Robot Strategy

**Starting Point (Cycle 10):**
- Battles per robot: 60
- Fame per robot: 75
- Base revenue per robot: 1000 × 1.06 × 1.015 × 1.0 = ₡1,076/battle
- Total battles per cycle: 12

**With Studio L1:**
- Revenue per robot: 1000 × 1.06 × 1.015 × 1.1 = ₡1,184/battle
- Gain per battle per robot: ₡108
- Total gain per cycle: 12 × ₡108 = ₡1,296
- Operating cost: ₡100/day
- Net gain: ₡1,196/cycle

**Break-even:** ₡100,000 / ₡1,196 ≈ **84 cycles** ❌

**With growth (Cycle 20):**
- Battles per robot: 120
- Fame per robot: 175
- Base revenue: 1000 × 1.12 × 1.035 × 1.0 = ₡1,159/battle
- With Studio: 1000 × 1.12 × 1.035 × 1.1 = ₡1,275/battle
- Gain per battle: ₡116
- Net per cycle: (12 × ₡116) - ₡100 = ₡1,292

**Average net gain over 30 cycles:** ~₡1,250/cycle
**Break-even:** ₡100,000 / ₡1,250 ≈ **80 cycles** ❌

---

### 3-Robot Strategy

**Starting Point (Cycle 10):**
- Battles per robot: 50
- Fame per robot: 60
- Base revenue per robot: 1000 × 1.05 × 1.012 × 1.0 = ₡1,063/battle
- Total battles per cycle: 15

**With Studio L1:**
- Revenue per robot: 1000 × 1.05 × 1.012 × 1.1 = ₡1,169/battle
- Gain per battle per robot: ₡106
- Total gain per cycle: 15 × ₡106 = ₡1,590
- Operating cost: ₡100/day
- Net gain: ₡1,490/cycle

**Break-even:** ₡100,000 / ₡1,490 ≈ **67 cycles** ❌

**With growth (Cycle 20):**
- Battles per robot: 100
- Fame per robot: 135
- Base revenue: 1000 × 1.10 × 1.027 × 1.0 = ₡1,130/battle
- With Studio: 1000 × 1.10 × 1.027 × 1.1 = ₡1,243/battle
- Gain per battle: ₡113
- Net per cycle: (15 × ₡113) - ₡100 = ₡1,595

**Average net gain over 30 cycles:** ~₡1,550/cycle
**Break-even:** ₡100,000 / ₡1,550 ≈ **65 cycles** ❌

---

## Summary: Level 1 Break-Even

| Strategy | Battles/Cycle | Break-even (cycles) | Assessment |
|----------|--------------|---------------------|------------|
| 1 Robot | 8 | ~118 cycles | ❌ Too long |
| 2 Robots | 12 | ~80 cycles | ❌ Too long |
| 3 Robots | 15 | ~65 cycles | ❌ Too long |

**Problem:** Even with the best strategy (3 robots), break-even takes over 2 months. This is much worse than Merchandising Hub's 25-30 cycles.

---

## Break-Even Analysis: Level 3 (₡600K Total Investment)

### 1-Robot Strategy

**Cycle 20:**
- Battles: 160
- Fame: 250
- Base revenue: 1000 × 1.16 × 1.05 × 1.0 = ₡1,218/battle
- With Studio L3: 1000 × 1.16 × 1.05 × 1.3 = ₡1,583/battle
- Gain per battle: ₡365
- Operating cost: ₡300/day
- Net per cycle: (8 × ₡365) - ₡300 = ₡2,620

**Break-even:** ₡600,000 / ₡2,620 ≈ **229 cycles** ❌

---

### 2-Robot Strategy

**Cycle 20:**
- Battles per robot: 120
- Fame per robot: 175
- Base revenue: 1000 × 1.12 × 1.035 × 1.0 = ₡1,159/battle
- With Studio L3: 1000 × 1.12 × 1.035 × 1.3 = ₡1,507/battle
- Gain per battle: ₡348
- Net per cycle: (12 × ₡348) - ₡300 = ₡3,876

**Break-even:** ₡600,000 / ₡3,876 ≈ **155 cycles** ❌

---

### 3-Robot Strategy

**Cycle 20:**
- Battles per robot: 100
- Fame per robot: 135
- Base revenue: 1000 × 1.10 × 1.027 × 1.0 = ₡1,130/battle
- With Studio L3: 1000 × 1.10 × 1.027 × 1.3 = ₡1,469/battle
- Gain per battle: ₡339
- Net per cycle: (15 × ₡339) - ₡300 = ₡4,785

**Break-even:** ₡600,000 / ₡4,785 ≈ **125 cycles** ❌

---

## Key Findings

### 1. Streaming Studio Has Poor ROI
- **Best case (3 robots, L1):** 65 cycles to break even
- **Worst case (1 robot, L3):** 229 cycles to break even
- **Target (25-30 cycles):** Not achieved by any strategy

### 2. Multi-Robot Strategies Are Better
- More battles per cycle = more streaming revenue
- 3-robot strategy breaks even ~2× faster than 1-robot
- But still far from the 25-30 cycle target

### 3. The Problem: Low Incremental Gain
- Studio L1 adds only 10% to streaming revenue
- At early game (100 battles, 100 fame): ~₡110 per battle
- With 8 battles/cycle: ₡880/cycle gain
- Against ₡100K investment: 114 cycles to break even

### 4. Comparison to Merchandising Hub
- **Merchandising Hub L1:** ₡4,800/day net, 31 cycles break-even ✓
- **Streaming Studio L1 (best case):** ₡1,490/cycle net, 67 cycles break-even ❌
- Merchandising Hub is **2× faster** to break even

---

## Recommendations

### Option A: Reduce Investment Costs
Make Streaming Studio more accessible:

| Level | Current Cost | Proposed Cost | Change |
|-------|-------------|---------------|--------|
| L1 | ₡100K | ₡50K | -50% |
| L2 | ₡200K | ₡100K | -50% |
| L3 | ₡300K | ₡150K | -50% |

**New break-even (3 robots, L1):** ₡50K / ₡1,490 ≈ **34 cycles** ✓

### Option B: Increase Studio Multiplier
Make each level more impactful:

| Level | Current Bonus | Proposed Bonus | Multiplier |
|-------|--------------|----------------|------------|
| L1 | +10% | +20% | 1.2× |
| L2 | +20% | +40% | 1.4× |
| L3 | +30% | +60% | 1.6× |

**New break-even (3 robots, L1):** 
- Gain per battle: ₡212 (was ₡106)
- Net per cycle: (15 × ₡212) - ₡100 = ₡3,080
- Break-even: ₡100K / ₡3,080 ≈ **32 cycles** ✓

### Option C: Reduce Operating Costs
Lower the daily cost:

| Level | Current Cost | Proposed Cost | Change |
|-------|-------------|---------------|--------|
| L1 | ₡100/day | ₡50/day | -50% |
| L2 | ₡200/day | ₡100/day | -50% |
| L3 | ₡300/day | ₡150/day | -50% |

**New break-even (3 robots, L1):** ₡100K / ₡1,540 ≈ **65 cycles** (still too long)

### Option D: Combination Approach (RECOMMENDED)
- Reduce costs by 40%: L1 = ₡60K
- Increase bonus by 50%: L1 = +15% (1.15× multiplier)
- Keep operating costs the same

**New break-even (3 robots, L1):**
- Investment: ₡60K
- Gain per battle: ₡159 (was ₡106)
- Net per cycle: (15 × ₡159) - ₡100 = ₡2,285
- Break-even: ₡60K / ₡2,285 ≈ **26 cycles** ✓

---

## Proposed New Economics

### Streaming Studio (Revised)

**Investment Costs:**
- L1: ₡60,000 (was ₡100,000) - 40% reduction
- L2: ₡120,000 (was ₡200,000) - 40% reduction
- L3: ₡180,000 (was ₡300,000) - 40% reduction
- Formula: ₡60K per level

**Studio Multiplier:**
- L1: 1.15× (was 1.1×) - +15% bonus
- L2: 1.30× (was 1.2×) - +30% bonus
- L3: 1.45× (was 1.3×) - +45% bonus
- Formula: 1 + (level × 0.15)

**Operating Costs:**
- L1: ₡100/day (unchanged)
- L2: ₡200/day (unchanged)
- L3: ₡300/day (unchanged)
- Formula: level × ₡100

### New Break-Even Analysis

**3-Robot Strategy (Cycle 10):**
- Investment: ₡60K
- Gain per battle: ₡159
- Net per cycle: (15 × ₡159) - ₡100 = ₡2,285
- **Break-even: 26 cycles** ✓

**2-Robot Strategy (Cycle 10):**
- Investment: ₡60K
- Gain per battle: ₡162
- Net per cycle: (12 × ₡162) - ₡100 = ₡1,844
- **Break-even: 33 cycles** ✓

**1-Robot Strategy (Cycle 10):**
- Investment: ₡60K
- Gain per battle: ₡165
- Net per cycle: (8 × ₡165) - ₡100 = ₡1,220
- **Break-even: 49 cycles** (acceptable for single-robot)

---

## Conclusion

The current Streaming Studio economics don't meet the 25-30 cycle break-even target. The recommended changes:

1. **Reduce investment costs by 40%** (₡100K → ₡60K for L1)
2. **Increase studio multiplier by 50%** (+10% → +15% for L1)
3. **Keep operating costs unchanged** (₡100/day for L1)

This achieves:
- **26 cycles** break-even for 3-robot strategy ✓
- **33 cycles** break-even for 2-robot strategy ✓
- **49 cycles** break-even for 1-robot strategy (acceptable)

The facility now rewards active play (more robots = faster ROI) while remaining viable for all strategies.
