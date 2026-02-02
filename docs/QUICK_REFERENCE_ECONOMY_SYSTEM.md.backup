# Quick Reference: Economy System

**Last Updated**: February 2, 2026  
**For Complete Details**: See [PRD_ECONOMY_SYSTEM.md](PRD_ECONOMY_SYSTEM.md)

---

## At a Glance

### Currency
- **Credits (₡)**: Primary currency for all purchases
- **Prestige**: Unlock threshold (earned, never spent)
- **Starting Balance**: ₡2,000,000

### Key Formulas

**Attribute Upgrade Cost**:
```
cost = (current_level + 1) × 1,000 Credits
```

**Repair Cost**:
```
base = sum_of_attributes × 100
multiplier = 2.0 (HP=0), 1.5 (HP<10%), 1.0 (otherwise)
final = base × damage% × multiplier × (1 - discounts)
```

**Merchandising Income**:
```
daily = base_rate × (1 + prestige/10000)
```

**Streaming Income**:
```
daily = base_rate × (1 + battles/1000) × (1 + fame/5000)
```

---

## Cost Centers (What Costs Money)

### 1. Robot Acquisition
- **Robot Frame**: ₡500,000 (bare metal, all attributes at level 1)
- **Max All Attributes**: ₡29,302,000 (1→50 for all 23 attributes)

### 2. Facilities (14 types, 10 levels each)

| Facility | Level 1 Cost | Operating Cost/Day |
|----------|-------------|-------------------|
| Repair Bay | ₡200K | ₡1,000 |
| Training Facility | ₡300K | ₡1,500 |
| Weapons Workshop | ₡250K | ₡1,000 |
| Research Lab | ₡400K | ₡2,000 |
| Medical Bay | ₡350K | ₡2,000 |
| Roster Expansion | ₡300K | ₡500/slot |
| Storage Facility | ₡150K | ₡500 |
| Coaching Staff | ₡500K | ₡3,000 (active) |
| Booking Office | ₡500K | ₡0 |
| Combat Academy | ₡400K | ₡800 |
| Defense Academy | ₡400K | ₡800 |
| Mobility Academy | ₡400K | ₡800 |
| AI Academy | ₡500K | ₡1,000 |
| Income Generator | ₡800K | ₡1,000 |

**Total to Purchase All (Level 1)**: ₡5,450,000

### 3. Weapons (11 implemented)

| Weapon | Type | Cost | Hands |
|--------|------|------|-------|
| Practice Sword | Melee | **₡0** | One |
| Machine Gun | Ballistic | ₡100K | One |
| Combat Shield | Shield | ₡100K | Shield |
| Shotgun | Ballistic | ₡120K | Two |
| Laser Rifle | Energy | ₡150K | One |
| Power Sword | Melee | ₡180K | One |
| Hammer | Melee | ₡200K | Two |
| Plasma Blade | Melee | ₡250K | One |
| Plasma Cannon | Energy | ₡300K | Two |
| Railgun | Ballistic | ₡350K | Two |
| Ion Beam | Energy | ₡400K | Two |

### 4. Repairs
- **Formula**: `base_repair × damage% × multiplier × (1 - discounts)`
- **Multipliers**: 
  - Robot destroyed (HP=0): 2.0x
  - Heavily damaged (HP<10%): 1.5x
  - Normal damage: 1.0x
- **Discounts**: 
  - Repair Bay: 5% to 50%
  - Medical Bay: Reduces critical multiplier

### 5. Daily Operating Costs
- **Early Game**: ₡5,000-₡10,000/day (1 robot, 2-3 facilities)
- **Mid Game**: ₡20,000-₡30,000/day (3-4 robots, 6-8 facilities)
- **Late Game**: ₡40,000-₡60,000/day (6-10 robots, 10+ facilities)

---

## Revenue Streams (How to Earn Money)

### 1. Battle Winnings

| League | Win Reward | Prestige/Win |
|--------|-----------|-------------|
| Bronze | ₡5K-₡10K | +5 |
| Silver | ₡10K-₡20K | +10 |
| Gold | ₡20K-₡40K | +20 |
| Platinum | ₡40K-₡80K | +30 |
| Diamond | ₡80K-₡150K | +50 |
| Champion | ₡150K-₡300K | +75 |

### 2. Prestige Bonuses

| Prestige | Battle Bonus |
|----------|-------------|
| 5,000+ | +5% |
| 10,000+ | +10% |
| 25,000+ | +15% |
| 50,000+ | +20% |

### 3. Passive Income (Income Generator)

**Merchandising** (Level 1+):
- Base: ₡5K-₡35K/day
- Scales with: Prestige
- Formula: `base × (1 + prestige/10000)`

**Streaming** (Level 3+):
- Base: ₡3K-₡22K/day
- Scales with: Total battles + Total fame
- Formula: `base × (1 + battles/1000) × (1 + fame/5000)`

### 4. Tournaments

| Tournament | Prize | Prestige |
|-----------|-------|----------|
| Local | ₡50K-₡100K | +100 |
| Regional | ₡150K-₡300K | +250 |
| National | ₡400K-₡800K | +500 |
| International | ₡1M-₡2M | +1,000 |
| World Championship | ₡3M-₡5M | +2,500 |

### 5. Achievements (One-time)
- ELO 1500: ₡50K + 50 prestige
- ELO 1800: ₡100K + 100 prestige
- ELO 2000: ₡200K + 200 prestige
- 100 wins: ₡75K + 50 prestige
- 500 wins: ₡300K + 250 prestige
- 1,000 wins: ₡750K + 500 prestige

---

## Economic Progression

### Early Game (Days 1-30)
**Starting**: ₡2,000,000

**Recommended Spending**:
- 1 Robot: ₡500K
- 1 Good weapon: ₡150K-₡300K
- Repair Bay Level 1: ₡200K
- Training Facility Level 1: ₡300K
- Upgrades: ₡300K-₡500K
- Buffer: ₡500K

**Daily Income**: ₡15K-₡75K/week (from battles)  
**Daily Costs**: ₡5K-₡10K/day  
**Net**: Break-even to slight profit

### Mid Game (Days 30-120)
**Balance**: ₡3M-₡8M

**Investments**:
- Expand to 3-4 robots: ₡1.5M-₡2M
- Upgrade facilities to L3-5: ₡2M-₡4M
- Premium weapons: ₡800K-₡1.5M
- Income Generator: ₡800K

**Daily Income**: ₡40K-₡80K/day  
**Daily Costs**: ₡20K-₡40K/day  
**Net**: Profitable, can save for upgrades

### Late Game (Days 120+)
**Balance**: ₡10M-₡50M

**Investments**:
- Max facilities: ₡10M-₡20M
- 6-10 robot roster: ₡3M-₡5M
- Premium weapons: ₡3M-₡5M
- Custom crafting: ₡1M-₡3M per weapon

**Daily Income**: ₡150K-₡400K/day  
**Daily Costs**: ₡50K-₡80K/day  
**Net**: Highly profitable

---

## Facility Investment ROI

### Quick Payback Analysis

**Repair Bay Level 1** (₡200K):
- Saves ~5% on repairs (₡500-₡1,000/battle)
- Payback: 200-400 battles (40-80 days)
- **Priority**: HIGH (long-term savings)

**Training Facility Level 1** (₡300K):
- Saves 5% on upgrades (₡50-₡500/upgrade)
- Payback: 600-1,000 upgrades
- **Priority**: MEDIUM (depends on upgrade frequency)

**Income Generator Level 1** (₡800K):
- Generates ₡4,000 net/day (₡5K - ₡1K operating)
- Payback: 200 days
- With prestige scaling: 50-100 days
- **Priority**: HIGH (passive income)

**Weapons Workshop Level 1** (₡250K):
- Saves 5% on weapons (₡5K-₡20K/weapon)
- Payback: 10-15 weapon purchases
- **Priority**: LOW (unless buying many weapons)

---

## Daily Financial Report Example

```
═══════════════════════════════════════
         DAILY STABLE REPORT
         February 2, 2026
═══════════════════════════════════════

REVENUE STREAMS:
  Battle Winnings:         ₡45,000
  Prestige Bonus (10%):    ₡4,500
  Merchandising:           ₡30,000
  Streaming:               ₡27,000
  ─────────────────────────────────
  Total Revenue:           ₡106,500

OPERATING COSTS:
  Repair Bay (Lvl 5):      ₡3,500
  Training Facility (Lvl 4): ₡4,500
  Weapons Workshop (Lvl 3): ₡2,000
  Research Lab (Lvl 2):    ₡3,000
  Medical Bay (Lvl 2):     ₡3,000
  Roster Expansion (4):    ₡1,500
  Coaching Staff (active): ₡3,000
  Combat Academy (Lvl 3):  ₡1,600
  Defense Academy (Lvl 2): ₡1,200
  Mobility Academy (Lvl 2): ₡1,200
  AI Academy (Lvl 1):      ₡1,000
  Income Generator (Lvl 5): ₡3,500
  ─────────────────────────────────
  Total Operating Costs:   ₡29,000

REPAIRS:
  Robot "Thunder":         ₡8,500
  Robot "Blitz":           ₡12,000
  ─────────────────────────────────
  Total Repair Costs:      ₡20,500

═══════════════════════════════════════
NET INCOME:                ₡57,000
CURRENT BALANCE:           ₡1,904,000
═══════════════════════════════════════

Financial Health: Excellent ✅
Daily profit margin: 54%
Days until bankruptcy: 67 days
```

---

## Financial Health Indicators

| Status | Criteria | Icon |
|--------|----------|------|
| Excellent | Net positive, balance > ₡1M | ✅ |
| Good | Net positive, balance ₡500K-₡1M | ✅ |
| Stable | Break-even, balance ₡100K-₡500K | ⚠️ |
| Warning | Net negative, balance ₡50K-₡100K | ⚠️ |
| Critical | Heavy losses, balance < ₡50K | ❌ |

---

## Common Economic Strategies

### Conservative (Low Risk)
- 1 robot, focus on quality
- Upgrade Repair Bay early
- Avoid high operating costs
- Save ₡500K+ buffer
- **Pros**: Safe, sustainable
- **Cons**: Slower progression

### Balanced (Medium Risk)
- 2-3 robots, diversified
- Mix of facilities
- Income Generator for passive income
- ₡300K buffer
- **Pros**: Good progression, stable income
- **Cons**: Requires active management

### Aggressive (High Risk)
- 3-4 robots early
- Many facilities quickly
- Low buffer (₡100K)
- Focus on high-reward battles
- **Pros**: Fast progression if successful
- **Cons**: Risk of bankruptcy

---

## Quick Tips

💡 **Always maintain buffer**: Keep ₡100K+ for emergencies  
💡 **Repair Bay first**: Best long-term investment  
💡 **Income Generator scales**: More valuable with high prestige  
💡 **Watch operating costs**: Can add up quickly  
💡 **Use yield threshold**: Balance repair costs vs win chances  
💡 **Prestige matters**: +20% battle bonus at 50K prestige is huge  
💡 **Facility discounts stack**: Repair Bay + Medical Bay = massive savings  

---

## See Also

- **[PRD_ECONOMY_SYSTEM.md](PRD_ECONOMY_SYSTEM.md)** - Complete economy system documentation
- **[STABLE_SYSTEM.md](STABLE_SYSTEM.md)** - Detailed facility costs and benefits
- **[ROBOT_ATTRIBUTES.md](ROBOT_ATTRIBUTES.md)** - Upgrade costs and repair formulas
- **[WEAPONS_AND_LOADOUT.md](WEAPONS_AND_LOADOUT.md)** - Weapon catalog with prices
- **[GAME_DESIGN.md](GAME_DESIGN.md)** - Overall game design philosophy
