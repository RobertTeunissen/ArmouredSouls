# Admin Battle Debugging Guide

**Date**: February 1, 2026  
**Status**: Active  
**Purpose**: Guide for administrators to debug and analyze battle system mechanics

---

## Overview

The battle system now includes comprehensive debugging capabilities that allow administrators to:
- View detailed turn-by-turn combat events
- Analyze formula calculations for each action
- Verify which attributes are affecting outcomes
- Understand why battles ended in specific results

---

## Key Changes in Combat System

### ✅ What's Fixed

1. **All 23 Attributes Now Matter**
   - Previously: Only ELO and Combat Power affected outcomes
   - Now: Every attribute (targeting, evasion, armor, shields, etc.) influences combat

2. **ELO Removed from Combat**
   - Previously: ELO directly affected win probability
   - Now: ELO only used for matchmaking and ranking
   - Combat outcomes based purely on robot attributes and configuration

3. **Real Turn-by-Turn Simulation**
   - Previously: Winner determined by single formula, damage assigned arbitrarily
   - Now: Time-based simulation with attacks, misses, criticals, counters

4. **Detailed Event Logging**
   - Every action logged with timestamp
   - Formula breakdowns show exact calculations
   - HP/shield state tracked at each step

---

## Battle Log Structure

Each battle record in the database contains:

```json
{
  "battleLog": {
    "events": [...],                    // User-friendly messages
    "isByeMatch": false,
    "detailedCombatEvents": [...]       // Admin debugging data
  }
}
```

### User-Friendly Events (events)
Simple messages shown to players:
- "⚔️ Battle commences! RobotA vs RobotB"
- "💥 RobotA hits for 45 damage"
- "🏆 RobotA wins!"

### Detailed Combat Events (detailedCombatEvents)
Full debugging data for admins:

```json
{
  "timestamp": 5.2,
  "type": "attack",
  "attacker": "BattleBot Alpha",
  "defender": "Iron Crusher",
  "weapon": "weapon",
  "damage": 45.3,
  "shieldDamage": 20.1,
  "hpDamage": 25.2,
  "hit": true,
  "critical": false,
  "robot1HP": 85,
  "robot2HP": 60,
  "robot1Shield": 30,
  "robot2Shield": 0,
  "message": "💥 BattleBot Alpha hits for 45 damage (20 shield, 25 HP)",
  "formulaBreakdown": {
    "calculation": "Hit: 70 base + 12.5 targeting + 5 stance - 8.3 evasion - 4.0 gyro + 3.2 variance | Damage: 20 base × 1.15 combat_power × 1.25 loadout × 1.10 weapon_control × 1.15 stance | Apply: 36.5 base × 1.00 crit → 20.1 shield, 25.2 HP",
    "components": {
      "base": 70,
      "targeting": 12.5,
      "stance": 5,
      "evasion": -8.3,
      "gyro": -4.0,
      "variance": 3.2,
      "weaponBase": 20,
      "combatPower": 1.15,
      "loadout": 1.25,
      "weaponControl": 1.10,
      "penetration": 15,
      "armor": 25
    },
    "result": 45.3
  }
}
```

---

## Understanding Formula Breakdowns

### Hit Chance Formula

```
base_hit_chance = 70%
targeting_bonus = attacker.targeting_systems / 2
stance_bonus = (attacker.stance == offensive) ? 5% : 0%
evasion_penalty = defender.evasion_thrusters / 3
gyro_penalty = defender.gyro_stabilizers / 5
random_variance = random(-10, +10)

hit_chance = clamp(base + targeting + stance - evasion - gyro + variance, 10%, 95%)
```

**Example**:
- Attacker Targeting Systems: 25 → +12.5%
- Attacker Stance: Offensive → +5%
- Defender Evasion Thrusters: 15 → -5%
- Defender Gyro Stabilizers: 20 → -4%
- Random Variance: +3.2%
- **Final Hit Chance: 70 + 12.5 + 5 - 5 - 4 + 3.2 = 81.7%**

### Damage Calculation Formula

```
base_damage = weapon.base_damage
combat_power_mult = 1 + (attacker.combat_power / 100)
loadout_mult = loadout-specific (two_handed: 1.10, dual_wield: 0.90, default: 1.0)
weapon_control_mult = 1 + (attacker.weapon_control / 100)
stance_mult = stance-specific (offensive: 1.15, defensive: 0.90, balanced: 1.0)

damage = base × combat_power × loadout × weapon_control × stance
```

**Example**:
- Weapon Base: 20
- Combat Power: 15 → ×1.15
- Loadout (two-handed): ×1.10
- Weapon Control: 10 → ×1.10
- Stance (offensive): ×1.15
- **Final Damage: 20 × 1.15 × 1.10 × 1.10 × 1.15 = 32.1**

### Damage Application (Shields & Armor)

```
// If defender has shields
shield_absorption = damage × 0.7
penetration_mult = 1 + (attacker.penetration / 200)
effective_shield_damage = shield_absorption × penetration_mult
shield_damage = min(effective_shield_damage, current_shield)

// Bleed-through if shields break
if effective_shield_damage > current_shield:
    overflow = (effective_shield_damage - current_shield) × 0.3
    armor_reduction = defender.armor_plating × (1 - attacker.penetration / 150)
    hp_damage = max(1, overflow - armor_reduction)

// If no shields
armor_reduction = defender.armor_plating × (1 - attacker.penetration / 150)
hp_damage = max(1, damage - armor_reduction)
```

### Critical Hit Formula

```
base_crit = 5%
crit_systems_bonus = attacker.critical_systems / 8
targeting_bonus = attacker.targeting_systems / 25
loadout_bonus = (loadout == two_handed) ? 10% : 0%
random_variance = random(-10, +10)

crit_chance = clamp(base + crit + targeting + loadout + variance, 0%, 50%)

// If critical hits
crit_multiplier = (loadout == two_handed) ? 2.5 : 2.0
crit_multiplier -= defender.damage_dampeners / 100
crit_multiplier = max(crit_multiplier, 1.2)

damage × crit_multiplier
```

### Counter-Attack Formula

```
base_counter = defender.counter_protocols / 100

if defender.stance == defensive:
    base_counter × 1.15

if defender.loadout == weapon_shield:
    base_counter × 1.10

counter_chance = clamp(base_counter × 100, 0%, 40%)

// If counter triggers
counter_damage = normal_damage × 0.7
```

---

## Debugging Workflow

### 1. Identify Battle of Interest

Query the battle:
```sql
SELECT * FROM battles 
WHERE id = <battle_id>;
```

### 2. Extract Detailed Combat Events

```sql
SELECT 
  id,
  robot1_id,
  robot2_id,
  winner_id,
  battle_log->'detailedCombatEvents' as combat_events
FROM battles
WHERE id = <battle_id>;
```

### 3. Analyze Event Sequence

For each event in `combat_events`:
1. Check timestamp - when did it occur?
2. Check type - attack, miss, critical, counter?
3. Look at damage numbers - shield vs HP
4. Review formula breakdown - which attributes contributed?
5. Verify HP/shield state - correct calculations?

### 4. Verify Attribute Usage

Examine formula components to confirm:
- **Targeting Systems** appears in hit chance calculations
- **Combat Power** affects damage multiplier
- **Evasion Thrusters** reduces opponent hit chance
- **Armor Plating** reduces incoming HP damage
- **Shield Capacity** determines max shield HP
- **Power Core** enables shield regeneration
- **Critical Systems** affects crit chance
- **Damage Dampeners** reduces crit damage
- **Counter Protocols** enables counter-attacks
- **Weapon Control** increases damage output
- **Penetration** bypasses armor and shields
- **Attack Speed** reduces cooldown between attacks
- **Gyro Stabilizers** provides evasion
- **Other attributes** affect their respective mechanics

### 5. Verify ELO Not Used

Check that `elo` does NOT appear anywhere in:
- Hit chance calculations
- Damage calculations
- Critical chance
- Any combat formula

ELO should only appear in:
- Battle matchmaking logic
- Post-battle ELO updates
- League ranking calculations

---

## Common Debugging Scenarios

### Scenario 1: "Why did my high-ELO robot lose?"

**Check**:
1. View detailed combat events
2. Compare attribute levels (not ELO)
3. Look at hit chance calculations - was high-ELO robot missing attacks?
4. Check damage calculations - was opponent's armor reducing damage?
5. Verify shield mechanics - were shields absorbing damage effectively?

**Expected**: ELO should NOT affect combat. Lower ELO robot can win with better attributes.

### Scenario 2: "This attribute doesn't seem to matter"

**Check**:
1. Find battles where both robots differ significantly in that attribute
2. View formula breakdowns for those battles
3. Confirm the attribute appears in component calculations
4. Verify the magnitude of its effect

**Example**: Testing Evasion Thrusters
- Robot A: Evasion Thrusters 1
- Robot B: Evasion Thrusters 30
- Hit chance against A: ~78%
- Hit chance against B: ~78% - 30/3 = ~68%
- Expected: B should be hit ~10% less often

### Scenario 3: "Battle ended too quickly/slowly"

**Check**:
1. Review attack cooldowns for both robots
2. Calculate based on Attack Speed attribute
3. Check if one robot destroyed/yielded early
4. Verify damage output vs HP pools

**Formula**: `cooldown = base_cooldown / (1 + attack_speed / 50)`
- Attack Speed 1: 4 / (1 + 0.02) = 3.92s
- Attack Speed 25: 4 / (1 + 0.5) = 2.67s
- Attack Speed 50: 4 / (1 + 1.0) = 2.00s

---

## Admin API Endpoints (Future)

Planned endpoints for admin debugging:

### GET /api/admin/battles/:id/debug
Returns detailed combat analysis:
```json
{
  "battleId": 123,
  "robots": {
    "robot1": { "name": "...", "attributes": {...} },
    "robot2": { "name": "...", "attributes": {...} }
  },
  "combatEvents": [...],
  "statistics": {
    "totalAttacks": { "robot1": 15, "robot2": 12 },
    "totalHits": { "robot1": 11, "robot2": 9 },
    "totalMisses": { "robot1": 4, "robot2": 3 },
    "criticalHits": { "robot1": 2, "robot2": 1 },
    "counterAttacks": { "robot1": 1, "robot2": 2 },
    "damageDealt": { "robot1": 234.5, "robot2": 189.2 },
    "averageHitChance": { "robot1": 73.3, "robot2": 75.0 }
  },
  "attributeContributions": {
    "targetingSystems": { "robot1": 12.5, "robot2": 15.0 },
    "evasionThrusters": { "robot1": 5.0, "robot2": 8.3 },
    ...
  }
}
```

### GET /api/admin/battles/analyze
Batch analyze multiple battles:
- Identify patterns (e.g., "Offensive stance wins 65% of the time")
- Attribute correlation analysis
- Balance recommendations

---

## Troubleshooting

### Issue: No detailed combat events in battle log

**Cause**: Battle may be a bye-match or occurred before the update.

**Solution**: 
- Bye matches don't generate detailed events (only summary)
- Old battles (before this PR) used old system without detailed logging
- Re-run battles to generate new detailed logs

### Issue: Formula breakdown shows unexpected values

**Check**:
1. Robot's current attribute levels in database
2. Stance and loadout settings
3. Random variance (-10 to +10) affects each calculation
4. Clamping (hit chance: 10-95%, crit chance: 0-50%, etc.)

### Issue: ELO still appears in combat

**This is a bug** - ELO should NOT be in:
- Hit chance calculations
- Damage calculations
- Any combat formula

If you see ELO in formula breakdowns, report immediately.

---

## Testing Checklist

When validating the battle system:

- [ ] Verify all 23 attributes appear in combat calculations
- [ ] Confirm ELO does NOT affect combat outcomes
- [ ] Check hit chance varies based on targeting/evasion
- [ ] Validate damage calculation uses all relevant attributes
- [ ] Test critical hits occur and scale with critical_systems
- [ ] Verify counter-attacks trigger based on counter_protocols
- [ ] Confirm shields absorb damage and regenerate
- [ ] Test armor reduces HP damage
- [ ] Validate penetration bypasses defenses
- [ ] Check attack speed affects cooldown timing
- [ ] Verify yield threshold causes surrender
- [ ] Test battle duration varies realistically (20-120 seconds)

---

## FAQ

**Q: Why do identical robots have different battle outcomes?**  
A: Random variance (±10%) is added to hit chance, crit chance, and other calculations to create variety. Same robots can have different outcomes.

**Q: Can I disable randomness for testing?**  
A: Currently no, but seeded randomness could be added for reproducible testing.

**Q: How do I verify a specific attribute is working?**  
A: Create two robots identical except for that attribute. Run battles and compare formula breakdowns.

**Q: Do loadout and stance stack?**  
A: Yes. Offensive stance (+15% combat power) + Two-handed loadout (+25% combat power) = +40% total.

**Q: Why did my robot with higher attributes lose?**  
A: Combat is probabilistic. Higher attributes improve chances but don't guarantee victory. Check:
- Hit rate (did attacks land?)
- Critical hits (did opponent get lucky crits?)
- Shield regeneration (did opponent's shields regenerate more?)
- Counter-attacks (did opponent land multiple counters?)

---

## Future Enhancements

Potential additions:
- [ ] Admin UI for visualizing combat events
- [ ] Combat replay system with animation
- [ ] Attribute balance scoring algorithm
- [ ] Automated regression testing for combat formulas
- [ ] Export detailed combat logs to CSV/JSON
- [ ] A/B testing framework for formula adjustments

---

**Status**: Active  
**Maintained By**: Development Team  
**Last Updated**: February 1, 2026
