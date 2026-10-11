#!/usr/bin/env python3
"""Decision-35/36 Refinement_Plan generator (spec-55 CATALOGUE §2, STRATEGIES §1.8).

Input: strategy key, robot count at the strategy's final robots target,
Build_Focus, loadout, final Weapon_Stage, facts. Output: ordered steps
``{tier, hand, magnitude, targetAttribute?}``.

Rules, in the reading that reproduces every approved starter plan:

1. Every non-shield weapon of the final stage gets Sharpen, Sharpen, Forge,
   Forge. ``dual_wield`` interleaves tier by tier (main S, off S, main S,
   off S, main F, off F, main F, off F), then main fifth step, then offhand
   fifth step. ``weapon_shield``: the weapon's steps first, then the shield's.
2. Fifth step per non-shield weapon (value rule, STRATEGIES §1.8): compare each
   candidate refinement price with the price of the same + on the robot at the
   attribute's level at the strategy's last milestone before Max
   (``ceil(group weight × milestone)``), at the strategy's season-end Training
   Facility level and robot count (built ``pricing.attributeIncrementCost`` per
   level, exported in facts.json). A candidate qualifies when it is strictly cheaper.
   Groups are walked in Build_Focus priority order (ties Combat, Defense,
   Mobility, AI/Team); the first group with any qualifying candidate wins.
   Within that group the largest qualifying magnitude wins; on equal magnitude
   Hone before Augment, then attribute order (``ROBOT_ATTRIBUTES``).
   Candidates: Hone +m on an attribute the weapon has (negative counts) with
   catalogue bonus + m ≤ 10; Augment +m on an attribute the weapon lacks.
   Adjustment noted while matching the starter tables: the prose names only the
   first-priority group, but Proto Man, Roll, Soundwave, Guntank, Ironhide and
   Ratchet take their second group's Hone when the first group has no
   qualifying candidate, so the generator falls through the groups in order.
3. Shields: Hone +1 on each negative catalogue bonus (attribute order), one
   step per point until 0, at most 5 steps, only when ₡10,000-per-step Hone is
   cheaper than +1 on the robot at that attribute's group level. On the Aegis
   Bulwark this is five Hone +1 Evasion Thrusters (−5 → 0) for every strategy
   except Paragon.
4. Every step is checked cumulatively per weapon with the four shared
   validators' rules (slot cap 5, Sharpen/Forge ≤ 2, stack cap +10, Hone needs
   the attribute / Augment needs it absent, no DPS tiers on shields).

Usage:
  python3 refine_plan.py --selftest   regenerate every starter plan of facts/starter.json and compare
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import Dict, List, Optional

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rules  # noqa: E402


def _fifth_step(facts, strategy: str, robots: int, build_focus: str, weapon: dict) -> Optional[dict]:
    milestone = rules.VALUE_RULE[strategy]["milestone"]
    bonuses = weapon["bonuses"]
    attr_order = facts["robotAttributes"]
    for group in rules.group_priority(build_focus):
        level = rules.group_level(build_focus, group, milestone)
        best = None
        for attr in rules.GROUP_ATTRIBUTES[group]:
            present = bonuses.get(attr, 0) != 0
            tier = "hone" if present else "augment"
            lo, hi = facts["magnitudeRanges"][tier]
            for m in range(lo, hi + 1):
                if bonuses.get(attr, 0) + m > 10:
                    break
                price = rules.refinement_cost(facts, tier, m, 0)
                if price >= rules.robot_upgrade_cost(facts, strategy, robots, level, m):
                    continue
                key = (m, 0 if tier == "hone" else 1, -attr_order.index(attr))
                cand = (key, {"tier": tier, "magnitude": m, "targetAttribute": attr})
                # prefer larger magnitude, then hone, then earlier attribute
                if best is None or (cand[0][0], -cand[0][1], cand[0][2]) > (best[0][0], -best[0][1], best[0][2]):
                    best = cand
        if best is not None:
            return best[1]
    return None


def _shield_steps(facts, strategy: str, robots: int, build_focus: str, shield: dict) -> List[dict]:
    milestone = rules.VALUE_RULE[strategy]["milestone"]
    steps: List[dict] = []
    price = rules.refinement_cost(facts, "hone", 1, 0)
    for attr in facts["robotAttributes"]:
        bonus = shield["bonuses"].get(attr, 0)
        if bonus >= 0:
            continue
        level = rules.group_level(build_focus, rules.ATTRIBUTE_GROUP[attr], milestone)
        if price >= rules.robot_upgrade_cost(facts, strategy, robots, level, 1):
            continue
        for _ in range(-bonus):
            if len(steps) >= 5:
                return steps
            steps.append({"tier": "hone", "magnitude": 1, "targetAttribute": attr})
    return steps


def generate(facts, weapons: "rules.Weapons", strategy: str, robots: int, build_focus: str,
             loadout: str, final_stage: Dict[str, Optional[str]]) -> List[dict]:
    main = weapons.get(final_stage["main"])
    off = weapons.get(final_stage.get("offhand") or "") if final_stage.get("offhand") else None
    dps = ["sharpen", "sharpen", "forge", "forge"]

    def step(tier, hand, magnitude=1, attr=None):
        s = {"tier": tier, "hand": hand, "magnitude": magnitude}
        if attr is not None:
            s["targetAttribute"] = attr
        return s

    plan: List[dict] = []
    if loadout == "dual_wield" and off is not None and off["handsRequired"] != "shield":
        for t in dps:
            plan.append(step(t, "main"))
            plan.append(step(t, "offhand"))
        for hand, w in (("main", main), ("offhand", off)):
            f = _fifth_step(facts, strategy, robots, build_focus, w)
            if f:
                plan.append(step(f["tier"], hand, f["magnitude"], f["targetAttribute"]))
        return plan

    for t in dps:
        plan.append(step(t, "main"))
    f = _fifth_step(facts, strategy, robots, build_focus, main)
    if f:
        plan.append(step(f["tier"], "main", f["magnitude"], f["targetAttribute"]))
    if off is not None and off["handsRequired"] == "shield":
        for s in _shield_steps(facts, strategy, robots, build_focus, off):
            plan.append(step("hone", "offhand", s["magnitude"], s["targetAttribute"]))
    return plan


def plan_errors(facts, weapons: "rules.Weapons", loadout: str, final_stage: Dict[str, Optional[str]],
                plan: List[dict]) -> List[str]:
    """§15.1 schema rules + the four shared validators, cumulatively per weapon."""
    errors: List[str] = []
    hands = {"main": weapons.get(final_stage.get("main") or "")}
    if final_stage.get("offhand"):
        hands["offhand"] = weapons.get(final_stage["offhand"])
    if not plan:
        errors.append("empty refinementPlan")
    applied: Dict[str, List[dict]] = {h: [] for h in hands}
    for i, s in enumerate(plan, 1):
        hand = s.get("hand")
        if hand not in hands or hands[hand] is None:
            errors.append(f"step {i}: hand {hand!r} has no weapon in the final stage")
            continue
        w = hands[hand]
        tier = s.get("tier")
        rows = applied[hand]
        if tier not in ("hone", "augment", "sharpen", "forge"):
            errors.append(f"step {i}: unknown tier {tier!r}")
            continue
        lo, hi = facts["magnitudeRanges"][tier]
        if not lo <= s.get("magnitude", 0) <= hi:
            errors.append(f"step {i}: magnitude {s.get('magnitude')} outside {lo}–{hi}")
        if len(rows) >= 5:
            errors.append(f"step {i}: SLOT_CAP_EXCEEDED on {hand}")
        if tier in ("sharpen", "forge") and sum(1 for r in rows if r["tier"] == tier) >= 2:
            errors.append(f"step {i}: TIER_CAP_EXCEEDED ({tier}) on {hand}")
        if w["weaponType"] == "shield" and tier in ("sharpen", "forge"):
            errors.append(f"step {i}: SHIELD_CANNOT_TAKE_DPS_TIER")
        if tier in ("hone", "augment"):
            attr = s.get("targetAttribute")
            if attr not in rules.ATTRIBUTE_GROUP:
                errors.append(f"step {i}: unknown targetAttribute {attr!r}")
            else:
                bonus = w["bonuses"].get(attr, 0)
                on = bonus != 0 or any(r["tier"] == "augment" and r.get("targetAttribute") == attr for r in rows)
                if tier == "hone" and not on:
                    errors.append(f"step {i}: ATTRIBUTE_NOT_ON_WEAPON ({attr} on {w['name']})")
                if tier == "augment" and on:
                    errors.append(f"step {i}: ATTRIBUTE_ALREADY_ON_WEAPON ({attr} on {w['name']})")
                total = bonus + sum(r["magnitude"] for r in rows
                                    if r["tier"] in ("hone", "augment") and r.get("targetAttribute") == attr)
                if total + s.get("magnitude", 0) > 10:
                    errors.append(f"step {i}: ATTRIBUTE_STACK_CAP_EXCEEDED ({attr} {total}+{s.get('magnitude')})")
        elif "targetAttribute" in s:
            errors.append(f"step {i}: targetAttribute on {tier}")
        rows.append(s)
    for hand, w in hands.items():
        if w is not None and w["weaponType"] != "shield" and not applied[hand]:
            errors.append(f"no step on non-shield {hand} weapon {w['name']}")
    return errors


def order_errors(plan: List[dict], loadout: str, final_stage: Dict[str, Optional[str]], weapons) -> List[str]:
    """Decision-35 value ordering (a content rule): S,S,F,F first per non-shield weapon."""
    errs = []
    off = weapons.get(final_stage.get("offhand") or "") if final_stage.get("offhand") else None
    if loadout == "dual_wield" and off is not None:
        want = [("sharpen", "main"), ("sharpen", "offhand"), ("sharpen", "main"), ("sharpen", "offhand"),
                ("forge", "main"), ("forge", "offhand"), ("forge", "main"), ("forge", "offhand")]
    else:
        want = [("sharpen", "main"), ("sharpen", "main"), ("forge", "main"), ("forge", "main")]
    got = [(s.get("tier"), s.get("hand")) for s in plan[:len(want)]]
    if got != want:
        errs.append("plan does not start with Sharpen, Sharpen, Forge, Forge per non-shield weapon"
                    + (" (interleaved)" if len(want) == 8 else ""))
    return errs


def selftest() -> int:
    facts = rules.load_facts()
    weapons = rules.Weapons(facts)
    starter = rules.load_json(os.path.join(rules.FACTS_DIR, "starter.json"))
    total = same = 0
    for st in starter["stables"]:
        strategy = st["strategy"]["key"]
        robots = rules.effective_final_robots(strategy, st["strategy"]["targetOverrides"])
        for bp in st["blueprints"]:
            total += 1
            final = bp["weaponPath"][-1]
            gen = generate(facts, weapons, strategy, robots, bp["buildFocus"], bp["loadoutType"], final)
            errs = plan_errors(facts, weapons, bp["loadoutType"], final, gen)
            if gen == bp["refinementPlan"] and not errs:
                same += 1
            else:
                print(f"MISMATCH {st['catalogueKey']} slot {bp['slot']} {bp['robotName']}")
                print("  approved :", bp["refinementPlan"])
                print("  generated:", gen)
                if errs:
                    print("  errors   :", errs)
    print(f"selftest: {same}/{total} starter plans identical (tier, hand, attribute, magnitude, order)")
    # Every blueprint of the built starter set (facts/starter.json) must match; no count is typed in (decision 20).
    return 0 if 0 < total == same else 1


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()
    if args.selftest:
        return selftest()
    ap.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
