# Counter-Attack System Rework

**Date**: March 12, 2026  
**Status**: ✅ Implemented  
**Priority**: High - Combat fairness and depth

---

## What Changed

### Counter-Attack Trigger Timing

| Aspect | Old Behavior | New Behavior |
|--------|-------------|--------------|
| Trigger window | Only on successful hits | On any attack attempt (hit or miss), excluding malfunctions |
| Hit check | None — counters always landed | Full hit check using defender's targeting vs attacker's evasion |
| Miss outcome | N/A | Counter triggers but can miss (logged as counter-miss event) |
| Damage source | Fixed 70% of the *attacker's* base damage | 70% of the *defender's* own main-hand weapon base damage |
| Formula logging | Counter chance logged inside the hit branch only | Counter chance, hit roll, and damage logged as a separate post-attack phase |

### Counter-Attack Damage Formula

| Component | Old | New |
|-----------|-----|-----|
| Base damage | `attackerBaseDamage × 0.70` | `defenderBaseDamage(main hand) × 0.70` |
| Hit check | None (auto-hit) | `calculateHitChance(defender → attacker, main hand)` |
| Can miss | No | Yes |

### Event Structure

Counter events now include a `hit` boolean field (`true` for landed counters, `false` for missed counters) and use the defender's actual main-hand weapon name instead of inheriting the attacker's weapon context.

---

## Why It Changed

1. **Counters were guaranteed damage with no counterplay**: Once a counter triggered, it always landed. This made high-counterProtocols builds frustrating to play against because there was no way to mitigate the incoming counter damage through evasion or other defensive stats. Adding a hit check gives the original attacker's evasion and gyro stats a role in reducing counter effectiveness.

2. **Counter damage was based on the wrong robot's stats**: The old system used the *attacker's* base damage for the counter, meaning a high-damage attacker hitting a counter-focused defender would take heavy counter damage scaled to their own power. The new system uses the *defender's* main-hand weapon damage, so counter damage reflects the counter-attacking robot's actual offensive capability.

3. **Counters only triggered on hits, ignoring near-misses**: Thematically, a counter-attack represents the defender exploiting an opening during the attacker's action. This opening exists whether the attack lands or not — the attacker still committed to the strike. Allowing counters on misses makes the mechanic more consistent and rewards defensive positioning.

4. **Formula transparency**: Counter logic was embedded inside the hit branch, making it harder to trace in battle logs. Moving it to a standalone post-attack phase with its own event entries improves readability and debugging.

---

## Expected Impact on Gameplay

### Build Diversity
- Pure counter-tank builds are slightly weaker since counters can now miss
- Evasion stats (evasionThrusters, gyroStabilizers) gain value as a soft counter to counter-heavy opponents
- Defenders with strong main-hand weapons benefit more from counter builds than before (damage scales from their own stats)

### Combat Balance
- High-counterProtocols robots face a new accuracy gate, reducing average counter DPS by roughly 10–30% depending on matchup
- Counters now trigger on misses, partially offsetting the accuracy nerf by increasing trigger frequency
- Net effect: counters are more frequent but less reliable, rewarding stat investment on both sides

### Battle Log Clarity
- Counter events are now distinct entries with full formula breakdowns
- Missed counters are explicitly logged (`🔄❌` prefix) so players can see when their evasion saved them
- Counter hit chance, roll, and damage components are all visible in the formula breakdown

### No Changes To
- Counter trigger chance formula (still based on counterProtocols, stance, loadout)
- Maximum counter chance cap (still 40%)
- 70% damage multiplier for counters
- Malfunction behavior (malfunctions still skip the entire attack sequence including counters)

---

## Files Modified

1. `prototype/backend/src/services/combatSimulator.ts` — Counter-attack logic extracted from hit branch, moved to post-attack phase with independent hit check and defender-based damage

---

## Testing Checklist

- [ ] Verify counters can trigger after a missed attack
- [ ] Verify counters can trigger after a successful hit (existing behavior preserved)
- [ ] Verify counters do NOT trigger after a malfunction
- [ ] Verify counter damage uses defender's main-hand weapon base damage
- [ ] Verify counter hit check uses defender's targeting vs attacker's evasion
- [ ] Verify missed counters produce `hit: false` events with 0 damage
- [ ] Verify landed counters produce `hit: true` events with correct damage
- [ ] Verify counter chance cap remains at 40%
- [ ] Verify battle log formula breakdowns include counter hit roll details
- [ ] Verify dead defenders (currentHP ≤ 0) cannot counter-attack
