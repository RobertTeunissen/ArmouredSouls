#!/usr/bin/env python3
"""Render review/CATALOGUE.md from catalogue/*.json (plus art briefs from the source).

Layout follows spec-55 review/CATALOGUE.md §3: per stable a field table, the
robot table with art briefs, weapon paths with list prices, refinement plans
in plan order with costs, image paths, a storage estimate, the findings for
the stable (open after decisions, accepted by a decision, source before
decisions) and an approval checklist. Deterministic: re-running produces a
byte-identical file.

Usage: python3 render_catalogue.py
"""

from __future__ import annotations

import collections
import math
import os
import re
import sys
from typing import Optional

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import convert  # noqa: E402
import rules  # noqa: E402
import source_records  # noqa: E402

DISPLAY = {"swarm": "Swarm", "paragon": "Paragon", "duo": "Duo", "trio": "Trio", "tycoon": "Tycoon",
           "generalist": "Generalist"}

# Content_Approval (task 0.7): recorded here because CATALOGUE.md is generated.
APPROVAL_DATE = "11 October 2026"
APPROVAL_NOTE = ("Content_Approval given by the product owner in conversation on 11 October 2026, after reviewing "
                 "this pack (\"You have my approval for the … other automaton stables\").")
APPROVED_CHECKLIST = (f"- [x] Approved  - [ ] Changes requested — notes: approved by the product owner on "
                      f"{APPROVAL_DATE}")


def money(v: int) -> str:
    return f"₡{v:,}"


def build_goal(strategy: str, pos) -> dict:
    return next(g for g in rules.STRATEGIES[strategy]["buildOrder"] if g["position"] == int(pos))


def goal_label(goal: dict) -> str:
    """'Robots', or the facility name for a facility goal ('booking_office' → 'Booking Office')."""
    if goal["type"] == "facility":
        return goal["facilityType"].replace("_", " ").title()
    return goal["type"].capitalize()


def goal_value(goal: dict, value: int) -> str:
    return f"L{value}" if goal["type"] == "facility" else str(value)


def override_text(strategy: str, overrides: dict) -> str:
    """Every Goal_Target override in position order, with the strategy default and allowed range."""
    parts = []
    for pos in sorted(overrides, key=int):
        g = build_goal(strategy, pos)
        lo, hi = g["bounds"]["min"], g["bounds"]["max"]
        parts.append(f"goal {pos} {goal_label(g)} → {goal_value(g, overrides[pos])} (strategy default "
                     f"{goal_value(g, g['defaultTarget'])}, allowed {goal_value(g, lo)}–{goal_value(g, hi)})")
    return "; ".join(parts)


def signed(v: int) -> str:
    return f"−{-v}" if v < 0 else str(v)


def stage_text(stage: dict, W) -> str:
    main, off = stage.get("main"), stage.get("offhand")
    price = sum(W.get(x)["cost"] for x in (main, off) if x and W.get(x))
    if off is None:
        txt = main
    elif off == main:
        txt = f"{main} ×2"
    elif W.get(off) and W.get(off)["handsRequired"] == "shield":
        txt = f"{main} + {off}"
    else:
        txt = f"{main} (main) + {off} (off)"
    return f"{txt} ({money(price)})"


def plan_rows(bp: dict, facts: dict, W) -> list:
    """Rows: (hand, weapon, step text, weapon total). Also returns plan total."""
    final = bp["weaponPath"][-1]
    counts = collections.Counter()
    added = collections.Counter()
    per_hand = collections.OrderedDict()
    for hand in ("main", "offhand"):
        if final.get(hand):
            per_hand[hand] = []
    for i, s in enumerate(bp["refinementPlan"], 1):
        hand = s["hand"]
        w = W.get(final[hand])
        cost = rules.refinement_cost(facts, s["tier"], s["magnitude"], counts[(hand, s["tier"])])
        counts[(hand, s["tier"])] += 1
        per_hand[hand].append((i, s, cost, w))
    rows = []
    total = 0
    for hand, steps in per_hand.items():
        w = W.get(final[hand])
        parts = []
        j = 0
        while j < len(steps):
            i, s, cost, _ = steps[j]
            if s["tier"] in ("sharpen", "forge"):
                parts.append(f"{i} {s['tier'].capitalize()} {money(cost)}")
                j += 1
                continue
            attr = s["targetAttribute"]
            name = rules.attribute_display(attr)
            base = w["bonuses"].get(attr, 0) + added[(hand, attr)]
            # group consecutive identical +1 Hones (shield steps)
            k = j
            while (k + 1 < len(steps) and steps[k + 1][1].get("targetAttribute") == attr
                   and steps[k + 1][1]["tier"] == s["tier"] and steps[k + 1][1]["magnitude"] == s["magnitude"]):
                k += 1
            n_same = k - j + 1
            end = base + s["magnitude"] * n_same
            if s["tier"] == "augment":
                effect = "(new)"
            else:
                effect = f"({signed(base)} → {signed(end)})"
            if n_same > 1:
                parts.append(f"{i}–{steps[k][0]} {s['tier'].capitalize()} {name} +{s['magnitude']} each {effect} "
                             f"{money(cost)} each")
            else:
                parts.append(f"{i} {s['tier'].capitalize()} {name} +{s['magnitude']} {effect} {money(cost)}")
            added[(hand, attr)] += s["magnitude"] * n_same
            j = k + 1
        wt = sum(c for _, _, c, _ in steps)
        total += wt
        rows.append((hand, w["name"], " · ".join(parts) if parts else "no step (allowed: shields need no step)", wt))
    return rows, total


def storage_note(entry: dict, target: int) -> str:
    def equipped(bps):
        return sum(1 + (1 if b["weaponPath"][-1].get("offhand") else 0) for b in bps)
    at_target = equipped(entry["blueprints"][:target])
    all_bp = equipped(entry["blueprints"])

    def level(n):
        lv = max(0, math.ceil((n - 5) / 5))
        return "no Storage Facility level" if lv == 0 else f"Storage Facility L{lv}"
    txt = (f"Storage (estimate; the engine counts at run time): {at_target} final weapons equipped at the robots "
           f"target of {target}")
    if all_bp != at_target:
        txt += f", {all_bp} with every blueprint"
    txt += (f". Base storage holds 5 and each Storage Facility level 5 more, so the equipped weapons alone need "
            f"{level(at_target)}")
    if all_bp != at_target:
        txt += f" ({level(all_bp)} with every blueprint)"
    txt += "; replaced starters stay in storage until it is full and are then sold first."
    return txt


BRIEF_MAX = 200


def short_brief(text: Optional[str]) -> Optional[str]:
    """A one-line excerpt of a long art brief (the collection's briefs are full image prompts): the
    'Subject:' paragraph (prefix removed) or else the first paragraph, cut at its first sentence end and
    capped at BRIEF_MAX characters on a word boundary. Short one-line briefs are returned unchanged."""
    if text is None or ("\n" not in text and len(text) <= BRIEF_MAX):
        return text
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n|\n", text) if p.strip()]
    subject = next((p for p in paragraphs if p.startswith("Subject:")), None)
    para = subject[len("Subject:"):].strip() if subject else (paragraphs[0] if paragraphs else "")
    m = re.search(r"[.!?](\s|$)", para)
    if m:
        para = para[:m.start() + 1]
    if len(para) > BRIEF_MAX:
        cut = para[:BRIEF_MAX - 1]
        if " " in cut:
            cut = cut[:cut.rfind(" ")]
        para = cut.rstrip(" ,;:—-") + "…"
    return para


def decision_tag(numbers: list, register: dict) -> str:
    delegated = any(register.get(n, {}).get("delegated") for n in numbers)
    return (f" (decision{'s' if len(numbers) > 1 else ''} {', '.join(map(str, numbers))}"
            + ("; delegated authoring" if delegated else "") + ")")


def changes_from_draft(raw: dict, decided: dict, decision: dict, register: dict, strategy: str,
                       new_overrides: dict) -> list:
    """One line per field the decision overlay changed: old (raw source) → new, with decision numbers.
    Goal_Target lines carry the stable's decisions on A12 (decision 5); the other lines the rest."""
    if not decision:
        return []
    all_numbers = sorted(decision.get("_decisions") or [])
    target_numbers = [n for n in all_numbers if "A12" in register.get(n, {}).get("checks", [])]
    numbers = [n for n in all_numbers if n not in target_numbers] or all_numbers
    tag = decision_tag(numbers, register)
    out = []

    def change(label: str, old, new) -> None:
        if old != new:
            out.append(f"- {label}: {'—' if old in (None, '') else repr(old)} → {repr(new)}{tag}")

    change("Stable name", raw.get("stableName"), decided.get("stableName"))
    if raw.get("strategy") != decided.get("strategy"):
        out.append(f"- Strategy: {raw.get('strategy')} → {decided.get('strategy')}{tag}")
    change("Franchise label", raw.get("franchiseLabel"), decided.get("franchiseLabel"))
    change("Backstory", raw.get("backstory"), decided.get("backstory"))
    for size in ("2v2", "3v3"):
        old = sorted(raw.get("teamNames", {}).get(size, []), key=lambda t: (t.get("slots") or [99])[0])
        new = sorted(decided.get("teamNames", {}).get(size, []), key=lambda t: (t.get("slots") or [99])[0])
        for o, n in zip(old, new):
            change(f"{size} team {'+'.join(map(str, n.get('slots') or []))}", o["name"], n["name"])
    old_robots = {r["slot"]: r for r in raw.get("robots", [])}
    for r in sorted(decided.get("robots", []), key=lambda x: x["slot"]):
        o = old_robots.get(r["slot"], {})
        change(f"Slot {r['slot']} robot name", o.get("name"), r.get("name"))
        old_brief = (o.get("review") or {}).get("artBrief")
        new_brief = (r.get("review") or {}).get("artBrief")
        if old_brief != new_brief:
            change(f"Slot {r['slot']} art brief", short_brief(old_brief), new_brief)
        if r.get("_designation"):
            out.append(f"- Slot {r['slot']} {r['name']!r}: numbered name accepted as a {r['_designation']} "
                       f"designation{tag}")
        if r.get("_portrait") == "aligned":
            out.append(f"- Slot {r['slot']} portrait: aligned{tag}")
        elif r.get("_portrait") == "new-portrait-needed":
            out.append(f"- Slot {r['slot']} portrait: needs a new portrait{tag}")
    for slot, alt in sorted((decision.get("useAlternative") or {}).items()):
        out.append(f"- Slot {slot}: alternative blueprint {alt!r} used{tag}")
    if "targetOverrides" in decision:
        old_overrides = convert.convert_overrides(raw, strategy, len(raw["robots"]))[0]
        target_tag = decision_tag(target_numbers or all_numbers, register)
        for pos in sorted(set(old_overrides) | set(new_overrides), key=int):
            g = build_goal(strategy, pos)
            old = old_overrides.get(pos, g["defaultTarget"])
            new = new_overrides.get(pos, g["defaultTarget"])
            if old != new:
                out.append(f"- Goal {pos} {goal_label(g)} target: {goal_value(g, old)} → {goal_value(g, new)}"
                           f"{target_tag}")
    return out


def main() -> int:
    facts = rules.load_facts()
    W = rules.Weapons(facts)
    findings = rules.load_json(os.path.join(rules.REVIEW_DIR, "findings.json"))
    # Three views per stable: open (catalogue-scope residual after decisions), accepted (the decided
    # residual, each answered by a register decision) and the source draft before decisions.
    by_stable = collections.defaultdict(list)
    for i in findings["findings"]:
        if i["scope"] == "source" and i["catalogueKey"]:
            by_stable[i["catalogueKey"]].append(i)
    open_by_stable = collections.defaultdict(list)
    for i in findings.get("catalogueFindings") or []:
        if i["catalogueKey"]:
            open_by_stable[i["catalogueKey"]].append(i)
    accepted_by_stable = collections.defaultdict(list)
    for i in findings.get("decidedFindings") or []:
        if i["catalogueKey"]:
            accepted_by_stable[i["catalogueKey"]].append(i)
    try:
        decisions = convert.load_decisions()
    except convert.ConversionError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    register = {rec["number"]: rec for rec in decisions.get("_decisions") or []}
    try:
        raw_by_key = {r["catalogueKey"]: r for r in source_records.load_all()}
    except source_records.SourceError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    starter = rules.load_json(os.path.join(rules.FACTS_DIR, "starter.json"))["stables"]
    images = findings.get("images") or {}
    entries = []
    changes = {}
    for f in sorted(os.listdir(rules.CATALOGUE_DIR)):
        if f.endswith(".json"):
            e = rules.load_json(os.path.join(rules.CATALOGUE_DIR, f))
            raw = raw_by_key[f[:-5]]
            decision = decisions.get(f[:-5])
            src = convert.apply_decisions(raw, decision)
            changes[f[:-5]] = changes_from_draft(raw, src, decision, register, e["strategy"]["key"],
                                                 e["strategy"]["targetOverrides"])
            entries.append((src["number"], e, src))
    entries.sort(key=lambda t: t[0])

    out = []
    out.append("# Review: Expansion Automaton Catalogue")
    out.append("")
    out.append(f"**Status**: Approved — {APPROVAL_DATE}")
    out.append(f"**Approval**: {APPROVAL_NOTE}")
    out.append("**Scope**: every Expansion_Stable in `source/` (spec 57). Every value below is generated from "
               "`catalogue/{catalogueKey}.json` (the converted §15.1 Catalogue_Entries) by "
               "`tools/render_catalogue.py`; art briefs come from the source review data with the decisions overlay "
               "applied (`tools/decisions.json`; delegated briefs are listed under \"Changes from your draft\"). "
               "The approved files are delivered byte-identical to "
               "`app/backend/prisma/automaton-catalogue/` by spec 57 Task Group 2.")
    out.append("**Depends on**: spec-55 `review/STRATEGIES.md` and `review/CATALOGUE.md` (approved 9 Oct 2026); "
               "`review/FINDINGS.md` in this folder lists every open finding.")
    out.append("")
    out.append("---")
    out.append("")
    out.append("## 1. Overview")
    out.append("")
    out.append("Open findings are what is left after your decisions; accepted findings are answered by a decision "
               "in `review/README.md` §4; source findings are those of your draft before the decisions were applied "
               "(B / PO / C = Blocking / Needs product-owner decision / Cosmetic).")
    out.append("")
    out.append("| # | Catalogue key | Stable name | Franchise label | Strategy | Blueprints → robots target | "
               "Open findings (B / PO / C) | Accepted by decision | Source findings before decisions (B / PO / C) |")
    out.append("|---|---|---|---|---|---|---|---|---|")
    for num, e, _src in entries:
        st = e["strategy"]["key"]
        target = rules.effective_final_robots(st, e["strategy"]["targetOverrides"])
        key = e["catalogueKey"]
        o = collections.Counter(i["class"] for i in open_by_stable[key])
        c = collections.Counter(i["class"] for i in by_stable[key])
        out.append(f"| {num} | `{key}` | {e['stableName']} | {e['franchise']} | {DISPLAY[st]} | "
                   f"{len(e['blueprints'])} → {target} | {o.get('blocking', 0)} / {o.get('po', 0)} / {o.get('cosmetic', 0)} | "
                   f"{len(accepted_by_stable[key])} | "
                   f"{c.get('blocking', 0)} / {c.get('po', 0)} / {c.get('cosmetic', 0)} |")
    total_bp = sum(len(e["blueprints"]) for _, e, _ in entries)
    out.append("")
    starter_bp = sum(len(s["blueprints"]) for s in starter)
    out.append(f"{len(entries)} stables, {total_bp} blueprints. With the {len(starter)} starter stables "
               f"({starter_bp} blueprints) the repository catalogue would hold {len(entries) + len(starter)} stables "
               f"and {total_bp + starter_bp} blueprints.")
    out.append("")
    out.append(APPROVED_CHECKLIST)
    out.append("")
    out.append("---")
    out.append("")
    out.append("## 2. Field rules")
    out.append("")
    out.append("The field rules are spec 55's, unchanged: spec-55 `review/CATALOGUE.md` §2 (field table, teams, "
               "events, refinement plans, name collisions, images) and design §15.1 (file format and schema rules). "
               "`tools/validate.py` applies them to every entry below; `review/FINDINGS.md` lists what fails.")
    out.append("")
    out.append("Conventions in this document:")
    out.append("")
    out.append("- **Refinement plans** are generated by `tools/refine_plan.py`, the decision-35/36 rule that "
               f"reproduces all {starter_bp} approved starter plans exactly: Sharpen, Sharpen, Forge, Forge on every "
               "non-shield weapon (two weapons interleaved), a fifth Hone/Augment only when cheaper than the same + "
               "on the robot at the strategy's last milestone and season-end Training Facility discount, and five "
               "Hone +1 Evasion Thrusters on an Aegis Bulwark where ₡10,000 is below +1 on the robot. The source "
               "plans were empty or misordered (FINDINGS V13); these generated plans replace them and need your "
               "confirmation.")
    out.append("- **Re-confirmed against the built spec-55 code**: plans, strategies and blueprints use the rule "
               "facts exported from the built code (strategies, Build_Focus, catalogue limits, Team_Rule, "
               "`canEquipToSlot`, built pricing `attributeIncrementCost` / `refinementStepCost`), and every entry "
               "passes the built `catalogueEntrySchema`, `loadCatalogueDirectory` and a two-season strategy-runner "
               "projection (`tools/check-built.ts`).")
    out.append("- **Names**: stable names are checked with the whole-word profanity rule of "
               "`bugfix/profanity-whole-word-matching` (merged to `main` in PR #528); team names are unique across all "
               "repository entries (exact), as are robot names (`FINDINGS.md` lists any repeat still open).")
    out.append("- **Changes from your draft** under each stable lists every field a recorded decision changed "
               "(old → new, decision number; \"delegated authoring\" where you delegated the wording).")
    out.append("- **Images**: `app/frontend/public/assets/automatons/{catalogueKey}/{slot}.webp`, 512×512 WebP, "
               f"found by convention (spec-55 decisions 27–28). {images.get('present', 0)} of "
               f"{images.get('slots', 0)} expansion slots have a portrait; a robot without a file starts with no "
               "image.")
    out.append("- **Art briefs** longer than one line (full image prompts) are shown as a short excerpt: the "
               "`Subject:` paragraph's first sentence, else the first sentence, capped at "
               f"{BRIEF_MAX} characters; the full text stays in `source/`.")
    out.append("- **Range** is informational: the range the stage-0 weapons give.")
    out.append("- Storage notes are estimates of the final weapons equipped; the engine decides at run time.")
    out.append("")
    out.append(APPROVED_CHECKLIST)
    out.append("")
    out.append("---")

    sec = 3
    for num, e, src in entries:
        st = e["strategy"]["key"]
        key = e["catalogueKey"]
        ov = e["strategy"]["targetOverrides"]
        target = rules.effective_final_robots(st, ov)
        pos, default, lo, hi = rules.final_robots_goal(st)
        refine_pos, refine_default = rules.REFINE_GOAL[st]
        art = {r["slot"]: short_brief(r["review"].get("artBrief", "")) for r in src["robots"]}
        out.append("")
        out.append(f"## {sec}. {e['stableName']} (`{key}`) — {DISPLAY[st]}")
        out.append("")
        out.append("| Field | Value |")
        out.append("|---|---|")
        out.append(f"| Stable name | {e['stableName']} |")
        out.append(f"| Franchise label | {e['franchise']} |")
        out.append(f"| Backstory | {e['backstory']} |")
        out.append(f"| Strategy | {DISPLAY[st]} |")
        if ov:
            out.append(f"| Target overrides | {override_text(st, ov)} |")
        else:
            out.append(f"| Target overrides | none (goal {pos} Robots → {default}, the strategy default) |")
        two = [f"**{n}** (robots {'+'.join(map(str, rules.team_rule_2v2(i)))})" if i == 0 else
               f"**{n}** ({'+'.join(map(str, rules.team_rule_2v2(i)))})" for i, n in enumerate(e["teamNames"]["twoVsTwo"])]
        three = [f"**{n}** ({rules.team_rule_3v3(i)[0]}–{rules.team_rule_3v3(i)[-1]})"
                 for i, n in enumerate(e["teamNames"]["threeVsThree"])]
        out.append(f"| Team names | 2v2: {', '.join(two) or 'none'} · 3v3: {', '.join(three) or 'none'} |")
        out.append(f"| Event order | {', '.join(f'`{x}`' for x in e['eventOrder'])} |")
        out.append("")
        if changes[key]:
            out.append("**Changes from your draft** (recorded in `tools/decisions.json`):")
            out.append("")
            out.extend(changes[key])
        else:
            out.append("**Changes from your draft**: none.")
        out.append("")
        beyond = [b for b in e["blueprints"] if b["slot"] > target]
        if beyond:
            label = "Slot" if len(beyond) == 1 else "Slots"
            verb = "is" if len(beyond) == 1 else "are"
            out.append(f"{label} {', '.join(str(b['slot']) for b in beyond)} {verb} used only if an admin raises goal "
                       f"{pos} (Robots) above {target}.")
        else:
            out.append(f"Every blueprint is used at the robots target of {target}; there is no slot beyond the target.")
        out.append("")
        out.append("| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief | Image file |")
        out.append("|---|---|---|---|---|---|---|---|---|")
        for b in e["blueprints"]:
            out.append(f"| {b['slot']} | {b['robotName']} | `{b['loadoutType']}` | {W.stage_range(b['weaponPath'][0])} | "
                       f"{b['stance']} | {b['yieldThreshold']} | {b['buildFocus'].capitalize()} | {art.get(b['slot'], '')} | "
                       f"`{key}/{b['slot']}.webp` |")
        out.append("")
        out.append("**Weapon paths** (stage 0 starter → stage 1 final; list prices)")
        out.append("")
        out.append("| Slot | Stage 0 | Stage 1 (final) |")
        out.append("|---|---|---|")
        for b in e["blueprints"]:
            out.append(f"| {b['slot']} {b['robotName']} | {stage_text(b['weaponPath'][0], W)} | "
                       f"{stage_text(b['weaponPath'][-1], W)} |")
        out.append("")
        all_steps = sum(len(b["refinementPlan"]) for b in e["blueprints"])
        all_cost = 0
        target_cost = 0
        applied_cost = 0
        plan_lines = []
        for b in e["blueprints"]:
            rows, total = plan_rows(b, facts, W)
            all_cost += total
            if b["slot"] <= target:
                target_cost += total
                counts = collections.Counter()
                for s in b["refinementPlan"][:refine_default]:
                    applied_cost += rules.refinement_cost(facts, s["tier"], s["magnitude"], counts[(s["hand"], s["tier"])])
                    counts[(s["hand"], s["tier"])] += 1
            for j, (hand, wname, steps, wt) in enumerate(rows):
                first = f"{b['robotName']} ({len(b['refinementPlan'])} steps, {money(total)})" if j == 0 else ""
                plan_lines.append(f"| {first} | {wname} ({hand}) | {steps} | {money(wt)} |")
        n_bp = len(e["blueprints"])
        who = "The only blueprint" if n_bp == 1 else f"All {n_bp} robots"
        applied = (f"; Refine → {refine_default} applies {money(applied_cost)} of the target robots' plans"
                   if refine_default < 10 else "")
        out.append(f"**Refinement plans** (generated; applied by {DISPLAY[st]} goal {refine_pos}, Refine → "
                   f"{refine_default} steps per robot). {who}: {all_steps} steps, "
                   f"{money(all_cost)}; {'the robot' if target == 1 else f'the {target} robots'} at the target: "
                   f"{money(target_cost)}{applied}.")
        out.append("")
        out.append("| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |")
        out.append("|---|---|---|---:|")
        out.extend(plan_lines)
        out.append("")
        out.append(storage_note(e, target))
        out.append("")
        opened = collections.Counter(i["check"] for i in open_by_stable[key])
        out.append("Open findings: " + (", ".join(f"{k} ×{v}" for k, v in sorted(opened.items()))
                                        + " (details in `FINDINGS.md`)." if opened else "none."))
        accepted = collections.Counter(i["check"] for i in accepted_by_stable[key])
        if accepted:
            parts = []
            for k, v in sorted(accepted.items()):
                numbers = sorted(n for n, rec in register.items() if k in rec.get("checks", []))
                parts.append(f"{k} ×{v} (decision {', '.join(map(str, numbers))})")
            out.append("")
            out.append("Accepted by your decisions: " + ", ".join(parts) + ".")
        here = collections.Counter(i["check"] for i in by_stable[key])
        if here:
            out.append("")
            out.append("Source findings before decisions: "
                       + ", ".join(f"{k} ×{v}" for k, v in sorted(here.items())) + ".")
        out.append("")
        out.append(APPROVED_CHECKLIST)
        out.append("")
        out.append("---")
        sec += 1

    out.append("")
    out.append(f"## {sec}. Coverage and name checks")
    out.append("")
    caps = collections.defaultdict(set)
    for _, e, _ in entries:
        caps["strategy"].add(e["strategy"]["key"])
        for b in e["blueprints"]:
            caps["buildFocus"].add(b["buildFocus"])
            caps["loadout"].add(b["loadoutType"])
            caps["stance"].add(b["stance"])
            caps["range"].add(W.stage_range(b["weaponPath"][0]))
            for s in b["refinementPlan"]:
                caps["tier"].add(s["tier"])
                if s["hand"] == "offhand":
                    caps["offhand"].add(b["loadoutType"])
    out.append("The expansion adds no new capability: the spec-55 Coverage_Matrix (§14) is already satisfied by the "
               "starter set, and the union with these entries only adds more rows. The expansion alone covers: "
               f"strategies {sorted(caps['strategy'])}; Build_Focus {sorted(caps['buildFocus'])}; loadouts "
               f"{sorted(caps['loadout'])}; stances {sorted(caps['stance'])}; ranges {sorted(caps['range'])}; "
               f"refinement tiers {sorted(caps['tier'])}; offhand refinement on {sorted(caps['offhand'])}.")
    out.append("")
    robot_names = [b["robotName"] for _, e, _ in entries for b in e["blueprints"]]
    team_names = [t for _, e, _ in entries for t in e["teamNames"]["twoVsTwo"] + e["teamNames"]["threeVsThree"]]
    out.append(f"Names: {len(entries)} stable names ({min(len(e['stableName']) for _, e, _ in entries)}–"
               f"{max(len(e['stableName']) for _, e, _ in entries)} characters), {len(robot_names)} robot names "
               f"({min(map(len, robot_names))}–{max(map(len, robot_names))} characters), {len(team_names)} team "
               f"names ({min(map(len, team_names))}–{max(map(len, team_names))} characters). Uniqueness against "
               "existing ACC stables and robots cannot be checked from the repository; Catalogue_Sync reports "
               "stable-name conflicts and robot-name conflicts get the \"Mk II\" suffix at purchase time.")
    out.append("")
    out.append(APPROVED_CHECKLIST)
    out.append("")
    path = os.path.join(rules.REVIEW_DIR, "CATALOGUE.md")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(out))
    print(f"CATALOGUE.md: {len(entries)} stable sections, {total_bp} blueprints")
    return 0


if __name__ == "__main__":
    sys.exit(main())
