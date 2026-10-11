#!/usr/bin/env python3
"""Spec 57 validator: rule checks V00–V19 and analytical checks A01–A13 (A12: a spare blueprint
above the robots target; A13: a decision changed a slot's name or art brief after its portrait).

Runs every check on every source stable (source_records.load_all(): the review
records and the collection; input defects, the findings that
count), the rule checks again on catalogue/ (the converted output: the
residual must be only findings marked "not mechanically fixable") plus V19
from tools/facts/built-check.json (check-built.ts: the built spec-55 code),
and the analytical checks once more on the source with tools/decisions.json
applied (the "decided" pass: what is left after the product-owner decisions).

Writes review/findings.json and the generated blocks of review/FINDINGS.md
(text between <!-- generated:NAME:start --> and <!-- generated:NAME:end -->;
everything else in FINDINGS.md is hand-written and preserved).

Exit status: 0 when it ran and catalogue/ has no Blocking finding that is
mechanically fixable; 1 otherwise. Violations never crash the script.

Usage:
  python3 validate.py                 run all checks, write findings
  python3 validate.py --check-readme  every PO check ID appears in review/README.md, each §4 decision
                                      of the register has one ticked box and a Decisions entry, the
                                      decisions.json register numbers run from 1 without a gap and
                                      answer every decided residual check
  python3 validate.py --check-spec    every requirement criterion is traced in tasks.md and mapped in
                                      design.md, no optional task, and no hard-coded catalogue or starter
                                      count (also as an N/N ratio or a shell-arithmetic term) or stable
                                      range in the spec documents or review/README.md (decision 20)
"""

from __future__ import annotations

import argparse
import collections
import hashlib
import json
import os
import re
import sys
from typing import Dict, List, Optional

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import convert  # noqa: E402
import refine_plan  # noqa: E402
import rules  # noqa: E402
import source_records  # noqa: E402

BLOCKING, PO, COSMETIC = "blocking", "po", "cosmetic"
CLASS_LABEL = {BLOCKING: "Blocking", PO: "Needs product-owner decision", COSMETIC: "Cosmetic"}

# Check catalogue: id -> (title, class, recommended fix, mechanical, applied in catalogue/)
CHECKS = {
    "V00": ("§15.1 Catalogue_Entry shape (catalogue/ only)", BLOCKING, "Re-run convert.py.", "yes", "n/a"),
    "V01": ("Catalogue key format and uniqueness", BLOCKING, "Rename the key.", "no", "no"),
    "V02": ("Stable name: validateStableName (3–30, charset, whole-word containsProfanity) and uniqueness", BLOCKING,
            "Product owner picks a new stable name (the filter is the whole-word rule of "
            "bugfix/profanity-whole-word-matching, merged to main in PR #528).", "no", "no"),
    "V03": ("Robot names: validateRobotName rules and uniqueness across all repository entries", BLOCKING,
            "Rename the robot.", "no", "no"),
    "V04": ("Franchise label 1–60 characters, no surrounding spaces (trimmedText)", BLOCKING,
            "Shorten or trim the label.", "no", "no"),
    "V05": ("Backstory 1–400 characters, no surrounding spaces (trimmedText)", BLOCKING,
            "Shorten or trim the backstory.", "no", "no"),
    "V06": ("Strategy maps to one of the six keys", BLOCKING, "Pick one of the six strategies.", "no", "no"),
    "V07": ("Robots Goal_Targets ≤ blueprints ≤ 11, slots contiguous (decision 24, R3.7)", BLOCKING,
            "Add blueprints or lower the target.", "no", "no"),
    "V08": ("targetOverrides conversion ({robots: N} → Build_Order goal position)", COSMETIC,
            "None: converted mechanically to the final robots goal position.", "yes", "yes"),
    "V09": ("Team_Names: Team_Rule slots, required counts, 3–32 + safeName + trimmed, distinct within the stable "
            "and across all repository entries (decision 23, R3.6)", BLOCKING,
            "Add/remove/rename team names.", "no", "no"),
    "V10": ("Event_Order lists the 9 event types once (decision 26, R3.5)", BLOCKING, "Fix the order.", "no", "no"),
    "V11": ("Weapons exist and fit the loadout (canEquipToSlot)", BLOCKING, "Pick a fitting weapon.", "no", "no"),
    "V12": ("Weapon_Path: 2 stages, top-priced final weapon, same range band (decision 25)", BLOCKING,
            "Swap to the top-priced weapon for the hand type and range.", "yes", "no"),
    "V13": ("Refinement_Plan present, value-ordered, validator-clean (decisions 35–36, R3.4)", BLOCKING,
            "Regenerate with the decision-35/36 generator (refine_plan.py).", "yes", "yes"),
    "V14": ("Source refinement prices vs calculateRefinementCost", COSMETIC,
            "None: prices are documentation; catalogue/ carries no prices.", "yes", "yes"),
    "V15": ("Images: no placeholder references; Repository_Image files are 512×512 WebPs named {slot}.webp for a "
            "blueprint slot; no image folder without a Catalogue_Entry (decision 27)",
            BLOCKING, "Remove or re-export the stray file.", "no", "no"),
    "V16": ("Franchise duplication (one franchise is one stable)", PO,
            "Merge, keep apart deliberately, or relabel.", "no", "no"),
    "V17": ("Enums: loadout, stance, yield 0–50, Build_Focus", BLOCKING, "Fix the value.", "no", "no"),
    "V18": ("Franchise label malformed (markdown residue, slash, dash, parentheses, instruction, year, medium or "
            "authorship annotation, bare publisher)", PO,
            "Use the intended title in the starter format 'Title' or 'Title — subtitle'.", "no", "no"),
    "V19": ("Built spec-55 code: catalogueEntrySchema, loadCatalogueDirectory with the starters, cross-stable "
            "uniqueness and the two-season strategy-runner projection (tools/check-built.ts)", BLOCKING,
            "Investigate; a content fix needs a product-owner decision.", "no", "n/a"),
    "A01": ("No blueprint beyond the robots target (starter precedent keeps one)", PO,
            "Accept (valid under R3.7), or add a blueprint per stable before approval.", "no", "no"),
    "A02": ("Name collisions: case-insensitive, normalised, robot = stable/team name", PO,
            "Rename one of the pair, or accept.", "no", "no"),
    "A03": ("Generic numbered names (team 'X Pair 01', robot 'X 04')", PO,
            "Author franchise-flavoured names.", "no", "no"),
    "A04": ("Templated backstories (shared sentence skeleton)", PO,
            "Rewrite in the franchise's voice (CATALOGUE §2 backstory rule).", "no", "no"),
    "A05": ("Source listPriceCredits vs seed prices", COSMETIC, "None: dropped from catalogue/.", "yes", "yes"),
    "A07": ("Source plans the shared validators or R3.4 reject (e.g. no step on the main weapon)", BLOCKING,
            "Regenerate (as V13).", "yes", "yes"),
    "A08": ("alternativeBlueprints (no such engine feature)", PO,
            "Pick or discard each alternative before approval.", "no", "yes (dropped)"),
    "A09": ("Real persons, avoided themes, sensitive wording", PO, "Review the hit.", "no", "no"),
    "A11": ("Source consistency (bundle, markdown, validation report, review fields)", COSMETIC,
            "None for catalogue/; correct the source documents if they are kept.", "yes", "n/a"),
    "A12": ("Spare blueprint above the robots target (never built unless an admin raises the target)", PO,
            "Raise the robots target to the blueprint count where the spare is a good candidate "
            "(README decision 5).", "no", "no"),
    "A13": ("Portrait alignment: a decision changed the slot's name or art brief after its portrait was made", PO,
            "Check the portrait; name and brief follow the image (decision 18).", "no", "no"),
}

SPEC55_IMPACT_ID = "S55"

# Checks the decided pass (analytical_checks on the source with tools/decisions.json applied) produces.
DECIDED_PASS_CHECKS = {"V03", "V16", "V18", "A01", "A02", "A03", "A04", "A08", "A09", "A12", "A13"}

SENSITIVE_WORDS = ["murder", "kill", "gigolo", "sex", "slave", "nazi", "hitler", "terror", "genocide",
                   "suicide", "drug", "gore", "rape", "minion", "battlebots", "robot wars", "child"]
# Art-brief wording that asks for a human likeness (live-action androids are played by real actors).
LIKENESS_WORDS = ["human-looking", "humanlike", "pale skin", "portrayed by"]

# V18 label annotations (decisions 7 and 16): in the part after an em dash a year, medium or
# authorship note; anywhere a fan/web-fiction note. ' by ' only after an em dash, because titles
# such as 'Raised by Wolves' contain it.
LABEL_ANNOTATION_AFTER_DASH = re.compile(
    r"\b(\d{4}|films?|games?|anime|adaptations?|continuity|mods?|fan-made|fan-origin|manga|television|series|"
    r"miniseries|novels?)\b|\bby\b", re.I)
LABEL_ANNOTATION_ANYWHERE = re.compile(r"fan fiction|web fiction|fan-made", re.I)
BARE_PUBLISHER_LABELS = {"DC", "Marvel"}


class Findings:
    def __init__(self, scope: str = "source"):
        self.items: List[dict] = []
        self.scope = scope

    def add(self, check: str, key: Optional[str], message: str, slot: Optional[int] = None,
            scope: Optional[str] = None, cls: Optional[str] = None, **extra) -> None:
        self.items.append({
            "check": check,
            "class": cls or CHECKS[check][1],
            "catalogueKey": key,
            "slot": slot,
            "scope": scope or self.scope,
            "message": message,
            **extra,
        })


# ── Normalisation ────────────────────────────────────────────────────

def normalise_source(src: dict, log: dict, final_overrides: bool = False) -> dict:
    """``final_overrides``: use the written overrides with the decided Goal_Targets merged (decided
    pass); otherwise the converted source override only (source pass)."""
    if not log:
        overrides = {}
    elif final_overrides:
        overrides = log["targetOverrides"]
    else:
        overrides = log["override"]["written"]
    strategy = rules.STRATEGY_DISPLAY_TO_KEY.get(src.get("strategy"))
    teams = {}
    for size in ("2v2", "3v3"):
        teams[size] = sorted(((t["name"], list(t.get("slots") or [])) for t in src.get("teamNames", {}).get(size, [])),
                             key=lambda t: (t[1] or [99])[0])
    bps = []
    for r in sorted(src["robots"], key=lambda r: r["slot"]):
        bps.append({
            "slot": r["slot"], "name": r["name"], "loadout": r["loadout"], "stance": r["stance"],
            "yield": r["yieldThreshold"], "buildFocus": str(r["buildFocus"]).lower(),
            "path": [convert.convert_stage(s) for s in r["weaponPath"]],
            "plan": convert.source_plan_as_steps(r),
            "rawPlan": r.get("refinementPlan") or [],
            "raw": r,
        })
    return {
        "key": src["catalogueKey"], "stableName": src["stableName"], "franchise": src["franchiseLabel"],
        "backstory": src["backstory"], "strategyDisplay": src.get("strategy"), "strategy": strategy,
        "overrides": overrides, "teams": teams,
        "eventOrder": list(src["eventOrder"]), "blueprints": bps, "raw": src,
    }


def normalise_catalogue(e: dict) -> dict:
    teams = {
        "2v2": [(n, rules.team_rule_2v2(i)) for i, n in enumerate(e["teamNames"]["twoVsTwo"])],
        "3v3": [(n, rules.team_rule_3v3(i)) for i, n in enumerate(e["teamNames"]["threeVsThree"])],
    }
    return {
        "key": e["catalogueKey"], "stableName": e["stableName"], "franchise": e["franchise"],
        "backstory": e["backstory"], "strategyDisplay": e["strategy"]["key"], "strategy": e["strategy"]["key"],
        "overrides": e["strategy"]["targetOverrides"], "teams": teams, "eventOrder": e["eventOrder"],
        "blueprints": [{
            "slot": b["slot"], "name": b["robotName"], "loadout": b["loadoutType"], "stance": b["stance"],
            "yield": b["yieldThreshold"], "buildFocus": b["buildFocus"], "path": b["weaponPath"],
            "plan": b["refinementPlan"],
        } for b in e["blueprints"]],
    }


# ── Rule checks shared by source and catalogue ──────────────────────

def check_shape(e: dict, F: Findings) -> None:
    key = e.get("catalogueKey")
    top = ["schemaVersion", "catalogueKey", "stableName", "franchise", "backstory", "strategy", "teamNames",
           "eventOrder", "blueprints"]
    if list(e.keys()) != top:
        F.add("V00", key, f"top-level keys {list(e.keys())} != §15.1 {top}", scope="catalogue")
    if e.get("schemaVersion") != 1:
        F.add("V00", key, "schemaVersion is not 1", scope="catalogue")
    if set(e.get("strategy", {}).keys()) != {"key", "version", "targetOverrides"}:
        F.add("V00", key, "strategy keys differ from {key, version, targetOverrides}", scope="catalogue")
    if set(e.get("teamNames", {}).keys()) != {"twoVsTwo", "threeVsThree"}:
        F.add("V00", key, "teamNames keys differ from {twoVsTwo, threeVsThree}", scope="catalogue")
    bkeys = ["slot", "robotName", "loadoutType", "stance", "yieldThreshold", "buildFocus", "weaponPath",
             "refinementPlan"]
    for b in e.get("blueprints", []):
        if list(b.keys()) != bkeys:
            F.add("V00", key, f"blueprint keys {list(b.keys())}", slot=b.get("slot"), scope="catalogue")
        for st in b.get("weaponPath", []):
            if not set(st) <= {"main", "offhand"} or "main" not in st:
                F.add("V00", key, f"weapon stage keys {list(st)}", slot=b.get("slot"), scope="catalogue")
        for s in b.get("refinementPlan", []):
            allowed = {"tier", "hand", "magnitude", "targetAttribute"}
            if not set(s) <= allowed:
                F.add("V00", key, f"plan step keys {list(s)}", slot=b.get("slot"), scope="catalogue")
    if "image" in json.dumps(e):
        if re.search(r'"image[A-Za-z]*"\s*:', json.dumps(e)):
            F.add("V00", key, "an image key is present (schema is strict)", scope="catalogue")


def rule_checks(n: dict, scope: str, F: Findings, facts: dict, W: "rules.Weapons") -> None:
    key = n["key"]

    # V01
    if not rules.CATALOGUE_KEY_RE.match(key or ""):
        F.add("V01", key, f"key {key!r} does not match {rules.CATALOGUE_KEY_RE.pattern}", scope=scope)

    # V02 (format + whole-word profanity; uniqueness is global, below)
    for err in rules.validate_stable_name(n["stableName"]):
        F.add("V02", key, f"stable name {n['stableName']!r}: {err}", scope=scope)

    # V04 / V05 (built trimmedText)
    for err in rules.validate_trimmed_text(n["franchise"], rules.FRANCHISE_MAX_LENGTH):
        F.add("V04", key, f"franchise label {n['franchise']!r}: {err}", scope=scope)
    for err in rules.validate_trimmed_text(n["backstory"], rules.BACKSTORY_MAX_LENGTH):
        F.add("V05", key, f"backstory: {err}", scope=scope)

    # V06
    strategy = n["strategy"]
    if strategy not in rules.ROBOTS_GOALS:
        F.add("V06", key, f"strategy {n['strategyDisplay']!r} is not one of the six", scope=scope)
        return

    bps = n["blueprints"]
    count = len(bps)
    # V07
    slots = [b["slot"] for b in bps]
    if slots != list(range(1, count + 1)):
        F.add("V07", key, f"slots {slots} are not contiguous from 1", scope=scope)
    if count > rules.MAX_BLUEPRINTS:
        F.add("V07", key, f"{count} blueprints (max {rules.MAX_BLUEPRINTS})", scope=scope)
    for pos, target in rules.effective_robots_targets(strategy, n["overrides"]).items():
        if target > count:
            F.add("V07", key, f"robots goal {pos} target {target} > {count} blueprints", scope=scope)

    # V09
    max_robots = min(rules.highest_robots_bound(strategy), count)
    need2, need3 = rules.required_team_name_counts(max_robots)
    names_seen = []
    for size, need, rule in (("2v2", need2, rules.team_rule_2v2), ("3v3", need3, rules.team_rule_3v3)):
        teams = n["teams"][size]
        if len(teams) != need:
            F.add("V09", key, f"{size}: {len(teams)} team names, Team_Rule needs {need} (maxRobots {max_robots})",
                  scope=scope)
        for i, (name, team_slots) in enumerate(teams):
            if team_slots != rule(i):
                F.add("V09", key, f"{size} team {name!r} slots {team_slots} != Team_Rule {rule(i)}", scope=scope)
            for err in rules.validate_team_name(name):
                F.add("V09", key, f"{size} team {name!r}: {err}", scope=scope)
            names_seen.append(name)
    dup = [x for x, c in collections.Counter(names_seen).items() if c > 1]
    if dup:
        F.add("V09", key, f"team names repeat within the stable: {dup}", scope=scope)

    # V10
    ev = n["eventOrder"]
    if len(ev) != 9 or set(ev) != set(facts["eventTypes"]):
        F.add("V10", key, f"event order {ev} is not the 9 SUBSCRIBABLE_EVENT_TYPES once each", scope=scope)

    for b in bps:
        s = b["slot"]
        # V03 per-name rules
        for err in rules.validate_robot_name(b["name"]):
            F.add("V03", key, f"robot {b['name']!r}: {err}", slot=s, scope=scope)
        # V17
        if b["loadout"] not in rules.LOADOUTS:
            F.add("V17", key, f"loadout {b['loadout']!r}", slot=s, scope=scope)
        if b["stance"] not in rules.STANCES:
            F.add("V17", key, f"stance {b['stance']!r}", slot=s, scope=scope)
        if not isinstance(b["yield"], int) or not 0 <= b["yield"] <= rules.MAX_YIELD_THRESHOLD:
            F.add("V17", key, f"yield {b['yield']!r}", slot=s, scope=scope)
        if b["buildFocus"] not in rules.BUILD_FOCUS_WEIGHTS:
            F.add("V17", key, f"Build_Focus {b['buildFocus']!r}", slot=s, scope=scope)
        # V11
        path = b["path"]
        for i, st in enumerate(path):
            for err in W.stage_errors(st, b["loadout"]):
                F.add("V11", key, f"{b['name']} stage {i}: {err}", slot=s, scope=scope)
        if not 1 <= len(path) <= 4:
            F.add("V11", key, f"{b['name']}: {len(path)} weapon stages (1–4)", slot=s, scope=scope)
        # V12
        if len(path) != 2:
            F.add("V12", key, f"{b['name']}: {len(path)} stages; starter convention is exactly 2", slot=s, scope=scope)
        final = path[-1]
        for hand in ("main", "offhand"):
            name = final.get(hand)
            w = W.get(name or "")
            if w is None:
                continue
            top = W.top_priced(w["handsRequired"], w["rangeBand"])
            if top != name:
                F.add("V12", key, f"{b['name']} final {hand} {name} is not the top-priced "
                      f"{w['handsRequired']}-handed {w['rangeBand']} weapon ({top})", slot=s, scope=scope)
            if rules.CATALOGUE_TOP_WEAPONS.get((w["handsRequired"], w["rangeBand"])) != top:
                F.add("V12", key, f"seed top weapon {top} differs from CATALOGUE §2 list", slot=s, scope=scope)
        if len(path) >= 2:
            r0, r1 = W.stage_range(path[0]), W.stage_range(final)
            if r0 is not None and r1 is not None and r0 != r1:
                F.add("V12", key, f"{b['name']}: stage-0 range {r0} != final range {r1}", slot=s, scope=scope)

        # V13 / A07
        if not all(W.get(x) for x in final.values() if x):
            continue
        plan = b["plan"]
        if scope == "source":
            if not plan:
                note = b["raw"]["review"].get("refinementNote", "")
                F.add("V13", key, f"{b['name']}: empty refinementPlan (source note: {note!r})", slot=s,
                      scope=scope, kind="empty")
                continue
            for err in refine_plan.order_errors(plan, b["loadout"], final, W):
                F.add("V13", key, f"{b['name']}: {err}; source order "
                      + " ".join(f"{x['tier'][0].upper()}({x['hand'][0]})" for x in plan), slot=s,
                      scope=scope, kind="misordered")
            if b["loadout"] == "dual_wield" and not any(x["hand"] == "offhand" for x in plan):
                F.add("V13", key, f"{b['name']}: dual-wield offhand weapon has no step (R3.4)", slot=s,
                      scope=scope, kind="offhand-missing")
            errs = refine_plan.plan_errors(facts, W, b["loadout"], final, plan)
            errs = [e for e in errs if "no step on non-shield offhand" not in e]
            for err in errs:
                F.add("A07", key, f"{b['name']}: {err}", slot=s, scope=scope)
        else:
            for err in refine_plan.plan_errors(facts, W, b["loadout"], final, plan):
                F.add("V13", key, f"{b['name']}: {err}", slot=s, scope=scope)
            for err in refine_plan.order_errors(plan, b["loadout"], final, W):
                F.add("V13", key, f"{b['name']}: {err}", slot=s, scope=scope)
            robots = rules.effective_final_robots(strategy, n["overrides"])
            for err in value_rule_errors(facts, W, strategy, robots, b, final):
                F.add("V13", key, f"{b['name']}: {err}", slot=s, scope=scope)


def value_rule_errors(facts, W, strategy, robots, b, final) -> List[str]:
    """Independent check of the §1.8 value rule on a catalogue plan (fifth steps and shield steps)."""
    errs = []
    milestone = rules.VALUE_RULE[strategy]["milestone"]
    per_hand = collections.defaultdict(list)
    for s in b["plan"]:
        per_hand[s["hand"]].append(s)
    for hand, steps in per_hand.items():
        w = W.get(final.get(hand) or "")
        extra = [s for s in steps if s["tier"] in ("hone", "augment")]
        if w["weaponType"] != "shield" and len(extra) > 1:
            errs.append(f"{hand}: more than one fifth step")
        for s in extra:
            group = rules.ATTRIBUTE_GROUP[s["targetAttribute"]]
            level = rules.group_level(b["buildFocus"], group, milestone)
            price = rules.refinement_cost(facts, s["tier"], s["magnitude"], 0)
            robot = rules.robot_upgrade_cost(facts, strategy, robots, level, s["magnitude"])
            if price >= robot:
                errs.append(f"{hand} {s['tier']} +{s['magnitude']} {s['targetAttribute']} ₡{price:,} "
                            f"is not cheaper than the robot (₡{robot:,})")
            if w["weaponType"] == "shield" and (s["tier"] != "hone" or s["magnitude"] != 1):
                errs.append(f"shield step is not Hone +1")
    # STRATEGIES §1.8 table: "Paragon (L10, 1 robot: 90%) … none". At 2 robots (admin override,
    # README decision 5) the discount is 80% and the value rule above decides the fifth step.
    if strategy == "paragon" and robots == 1 and any(s["tier"] in ("hone", "augment") for s in b["plan"]):
        errs.append("Paragon plan has a Hone/Augment step (STRATEGIES §1.8: none at 1 robot, 90%)")
    return errs


# ── Cross-stable and source-only checks ─────────────────────────────

def global_name_checks(norms: List[dict], starter: dict, scope: str, F: Findings) -> None:
    starter_keys = {s["catalogueKey"] for s in starter["stables"]}
    starter_stables = {s["stableName"] for s in starter["stables"]}
    starter_robots = {b["robotName"]: s["catalogueKey"] for s in starter["stables"] for b in s["blueprints"]}

    keys = collections.Counter(n["key"] for n in norms)
    for n in norms:
        if keys[n["key"]] > 1:
            F.add("V01", n["key"], "catalogue key repeats in the expansion", scope=scope)
        if n["key"] in starter_keys:
            F.add("V01", n["key"], "catalogue key collides with a starter key", scope=scope)

    names = collections.defaultdict(list)
    for n in norms:
        names[n["stableName"].lower()].append(n["key"])
    for n in norms:
        if len(names[n["stableName"].lower()]) > 1:
            F.add("V02", n["key"], f"stable name {n['stableName']!r} repeats (case-insensitive) in the expansion",
                  scope=scope)
        if n["stableName"].lower() in {x.lower() for x in starter_stables}:
            F.add("V02", n["key"], f"stable name {n['stableName']!r} equals a starter stable name", scope=scope)

    exact = collections.defaultdict(list)
    for n in norms:
        for b in n["blueprints"]:
            exact[b["name"].strip()].append((n["key"], b["slot"]))
    for name, where in exact.items():
        if len(where) > 1:
            for k, s in where:
                F.add("V03", k, f"robot name {name!r} repeats exactly: {where}", slot=s, scope=scope)
        if name in starter_robots:
            k, s = where[0]
            F.add("V03", k, f"robot name {name!r} equals starter robot in {starter_robots[name]}", slot=s,
                  scope=scope)

    # V09 cross-stable: team names exact-unique across the expansion and against the starter teams
    # (built catalogueSchema.test.ts asserts every team name distinct across the catalogue; decision 3).
    starter_teams = {t: s["catalogueKey"] for s in starter["stables"]
                     for t in s["teamNames"]["twoVsTwo"] + s["teamNames"]["threeVsThree"]}
    team_keys = collections.defaultdict(list)
    for n in norms:
        for size in ("2v2", "3v3"):
            for t, _ in n["teams"][size]:
                if n["key"] not in team_keys[t]:
                    team_keys[t].append(n["key"])
    for name, ks in team_keys.items():
        if len(ks) > 1:
            for k in ks:
                F.add("V09", k, f"team name {name!r} repeats across stables: {ks}", scope=scope)
        if name in starter_teams:
            for k in ks:
                F.add("V09", k, f"team name {name!r} equals a starter team name in {starter_teams[name]}",
                      scope=scope)


def label_format_issues(lab: str) -> List[str]:
    """V18 starter-format rules (decision 16) for a label that is not markdown residue."""
    issues = []
    if " / " in lab:
        issues.append("slash between titles")
    if " - " in lab:
        issues.append("hyphen used as a dash")
    for m in re.finditer("—", lab):
        i = m.start()
        before_ok = i >= 1 and lab[i - 1] == " " and (i < 2 or lab[i - 2] != " ")
        after_ok = i + 1 < len(lab) and lab[i + 1] == " " and (i + 2 >= len(lab) or lab[i + 2] != " ")
        if not (before_ok and after_ok):
            issues.append("em dash not surrounded by single spaces")
            break
    if "(" in lab or ")" in lab:
        issues.append("parentheses")
    if "use the" in lab.lower():
        issues.append("an instruction, not a title")
    if "—" in lab:
        after = lab.split("—", 1)[1]
        m = LABEL_ANNOTATION_AFTER_DASH.search(after)
        if m:
            issues.append(f"year, medium or authorship annotation after the dash ({m.group(0)!r})")
    m = LABEL_ANNOTATION_ANYWHERE.search(lab)
    if m:
        issues.append(f"fan-work annotation ({m.group(0)!r})")
    if lab in BARE_PUBLISHER_LABELS:
        issues.append("bare publisher label")
    return issues


def analytical_checks(norms: List[dict], starter: dict, F: Findings, facts: dict, W, logs,
                      decided: bool = False) -> dict:
    """Analytical checks. ``decided`` = the pass over the source with tools/decisions.json applied:
    A03 skips robots with an accepted ``_designation`` and adds identical-art-brief items."""
    stats = {}
    starter_robot_names = [(s["catalogueKey"], b["slot"], b["robotName"]) for s in starter["stables"]
                           for b in s["blueprints"]]

    # V03 whole-word profanity on robot and team names (the built filter does not apply to them) -> PO
    for n in norms:
        for b in n["blueprints"]:
            hits = rules.profanity_hits(b["name"])
            if hits:
                F.add("V03", n["key"],
                      f"robot {b['name']!r} would match the whole-word containsProfanity {hits} "
                      "(not applied to robot names)", slot=b["slot"], cls=PO)
        for size in ("2v2", "3v3"):
            for t, _ in n["teams"][size]:
                hits = rules.profanity_hits(t)
                if hits:
                    F.add("V03", n["key"], f"{size} team {t!r} would match the whole-word containsProfanity {hits} "
                          "(not applied to team names)", cls=PO)

    # A01 distribution + no blueprint beyond target
    dist = collections.Counter()
    for n in norms:
        st = n["strategy"]
        if st is None:  # unmapped strategy (Squadron): only its V06 finding
            continue
        count = len(n["blueprints"])
        target = rules.effective_final_robots(st, n["overrides"])
        dist[(st, count, target)] += 1
        if count == target and rules.highest_robots_bound(st) > count:
            F.add("A01", n["key"], f"{st}: {count} blueprint(s) = target {target}; highest robots bound "
                  f"{rules.highest_robots_bound(st)} cannot be used without adding a blueprint",
                  strategy=st, target=target, bound=rules.highest_robots_bound(st))
        if count > target:
            spare = ", ".join(str(b["slot"]) for b in n["blueprints"] if b["slot"] > target)
            F.add("A12", n["key"], f"{st}: {count} blueprints > robots target {target}; slot(s) {spare} "
                  "are never built at the target")
    stats["distribution"] = sorted([list(k) + [v] for k, v in dist.items()])

    # A02 collisions
    all_robots = [(n["key"], b["slot"], b["name"]) for n in norms for b in n["blueprints"]]
    pool = starter_robot_names + all_robots
    def norm(x): return re.sub(r"[^a-z0-9]", "", x.lower())
    by_ci = collections.defaultdict(list)
    by_norm = collections.defaultdict(list)
    for k, s, name in pool:
        by_ci[name.lower()].append((k, s, name))
        by_norm[norm(name)].append((k, s, name))
    reported = set()
    for group in by_ci.values():
        if len({g[2] for g in group}) > 1:
            names = sorted({g[2] for g in group})
            F.add("A02", group[-1][0], f"case-insensitive robot name collision: {names} in {[g[0] for g in group]}",
                  slot=group[-1][1])
            reported.add(norm(group[0][2]))
    for nk, group in by_norm.items():
        if nk in reported:
            continue
        if len({g[2] for g in group}) > 1:
            F.add("A02", group[-1][0], f"robot names equal after removing spaces/punctuation: "
                  f"{sorted({g[2] for g in group})} in {[g[0] for g in group]}", slot=group[-1][1])
    def base(x): return re.sub(r"(\s*(mk[\s-]*[ivx]+|[-\s]?\d+))+$", "", x.lower()).strip()
    by_base = collections.defaultdict(list)
    for k, s, name in pool:
        by_base[base(name)].append((k, s, name))
    for b_, group in by_base.items():
        stables = {g[0] for g in group}
        if len(stables) > 1 and len({g[2] for g in group}) > 1 and len(b_) >= 3:
            F.add("A02", group[-1][0], f"near-duplicate robot names across stables (same base {b_!r}): "
                  f"{sorted({(g[0], g[2]) for g in group})}", slot=group[-1][1])
    stable_and_team = {}
    for s in starter["stables"]:
        stable_and_team[s["stableName"].lower()] = ("stable", s["catalogueKey"])
        for t in s["teamNames"]["twoVsTwo"] + s["teamNames"]["threeVsThree"]:
            stable_and_team[t.lower()] = ("team", s["catalogueKey"])
    for n in norms:
        stable_and_team[n["stableName"].lower()] = ("stable", n["key"])
        for size in ("2v2", "3v3"):
            for t, _ in n["teams"][size]:
                stable_and_team.setdefault(t.lower(), ("team", n["key"]))
    for k, s, name in pool:
        hit = stable_and_team.get(name.lower())
        if hit and not any(st["catalogueKey"] == k for st in starter["stables"]):
            F.add("A02", k, f"robot name {name!r} equals a {hit[0]} name in {hit[1]}", slot=s)
    first_word = collections.defaultdict(list)
    for s in starter["stables"]:
        first_word[s["stableName"].split()[0].lower()].append((s["catalogueKey"], s["stableName"]))
    for n in norms:
        first_word[n["stableName"].split()[0].lower()].append((n["key"], n["stableName"]))
    for w, group in first_word.items():
        if len(group) > 1 and len(w) >= 4:
            F.add("A02", group[-1][0], f"stable names share the first word {w!r}: {[g[1] for g in group]} "
                  f"(different franchises; players see both names)")
    team_where = collections.defaultdict(list)
    for s in starter["stables"]:
        for t in s["teamNames"]["twoVsTwo"] + s["teamNames"]["threeVsThree"]:
            team_where[t.lower()].append(s["catalogueKey"])
    for n in norms:
        for size in ("2v2", "3v3"):
            for t, _ in n["teams"][size]:
                team_where[t.lower()].append(n["key"])
    for t, ks in team_where.items():
        if len(set(ks)) > 1:
            F.add("A02", ks[-1], f"team name {t!r} used by several stables {sorted(set(ks))} (case-insensitive; "
                  "exact repeats are Blocking under V09)")

    # A03 generic names
    team_re = re.compile(r"\b(Pair|Squad|Team|Unit)\s*\d+\b")
    robot_re = re.compile(r"(\s(0[1-9]|1[01])$)|(\bUnit \d+$)")
    stats["genericTeamNames"] = 0
    stats["genericRobotNames"] = 0
    stats["teamNames"] = 0
    accepted = collections.Counter()
    for n in norms:
        teams = [t for size in ("2v2", "3v3") for t, _ in n["teams"][size]]
        stats["teamNames"] += len(teams)
        gen = [t for t in teams if team_re.search(t)]
        if gen:
            stats["genericTeamNames"] += len(gen)
            F.add("A03", n["key"], f"{len(gen)}/{len(teams)} team names are numbered placeholders: {gen}",
                  names=gen, kind="team")
        numbered = [b for b in n["blueprints"] if robot_re.search(b["name"])]
        if decided:
            accepted.update(b["raw"]["_designation"] for b in n["blueprints"] if b["raw"].get("_designation"))
            numbered = [b for b in numbered if not b["raw"].get("_designation")]
        rgen = [b["name"] for b in numbered]
        if rgen:
            stats["genericRobotNames"] += len(rgen)
            briefs = collections.Counter(re.sub(r"\d+", "#", b["raw"]["review"].get("artBrief", ""))
                                         for b in n["blueprints"])
            same = max(briefs.values())
            F.add("A03", n["key"], f"{len(rgen)}/{len(n['blueprints'])} robot names are numbered designations: {rgen}"
                  + (f"; {same} art briefs are identical apart from the number" if same >= 3 else ""),
                  names=rgen, kind="robot")
        if decided:
            by_brief = collections.defaultdict(list)
            for b in n["blueprints"]:
                brief = (b["raw"].get("review") or {}).get("artBrief", "")
                by_brief[re.sub(r"\d+", "#", brief)].append(b["slot"])
            for brief, slots in sorted(by_brief.items(), key=lambda kv: kv[1]):
                if len(slots) > 1:
                    F.add("A03", n["key"], f"art briefs of slots {slots} are identical after masking digits: "
                          f"{brief!r}", slot=slots[0], kind="brief", slots=slots)

    # A04 templated backstories
    skeletons = collections.defaultdict(list)
    sentences = collections.Counter()
    for n in norms:
        raw = n["raw"]
        text = n["backstory"].replace(n["stableName"], "{stable}")
        concept = raw.get("conceptIdentity", "")
        if concept and concept in text:
            text = text.replace(concept, "{concept}")
        skeletons[text].append(n["key"])
        for sent in re.split(r"(?<=[.!?])\s+", n["backstory"].replace(n["stableName"], "{stable}")):
            sentences[sent.strip()] += 1
    shared = {s: c for s, c in sentences.items() if c > 1}
    stats["backstorySkeletons"] = sorted(((len(v), k) for k, v in skeletons.items()), reverse=True)[:5]
    stats["sharedBackstorySentences"] = sorted(((c, s) for s, c in shared.items()), reverse=True)
    for n in norms:
        raw = n["raw"]
        text = n["backstory"].replace(n["stableName"], "{stable}")
        concept = raw.get("conceptIdentity", "")
        verbatim = bool(concept) and concept in n["backstory"]
        shared_here = [s for s in re.split(r"(?<=[.!?])\s+", text) if s.strip() in shared]
        if verbatim or shared_here:
            F.add("A04", n["key"], ("backstory = stable name + conceptIdentity verbatim + shared sentences"
                                    if verbatim else "backstory shares template sentences")
                  + f" ({len(shared_here)} shared)", verbatim=verbatim)

    # V16 franchise duplication
    labels = [(s["catalogueKey"], s["franchise"]) for s in starter["stables"]] + [(n["key"], n["franchise"]) for n in norms]
    def root(x): return x.split(" — ")[0].split(" / ")[0].strip().lower()
    by_label = collections.defaultdict(list)
    by_root = collections.defaultdict(list)
    for k, lab in labels:
        by_label[lab.lower()].append(k)
        by_root[root(lab)].append(k)
    starter_keys = {s["catalogueKey"] for s in starter["stables"]}
    for lab, ks in by_label.items():
        if len(ks) > 1:
            F.add("V16", [k for k in ks if k not in starter_keys][-1], f"franchise label {lab!r} used by {ks}")
    for r_, ks in by_root.items():
        if len(ks) > 1 and len({lab.lower() for k, lab in labels if root(lab) == r_}) > 1:
            exp = [k for k in ks if k not in starter_keys]
            if exp:
                F.add("V16", exp[-1], f"franchise root {r_!r} shared by {ks}")

    # V18 malformed labels
    for n in norms:
        lab = n["franchise"]
        if lab.count("[") != lab.count("]") or lab.count("(") != lab.count(")") or lab.startswith("["):
            md_title = n["raw"].get("_mdTitle")
            F.add("V18", n["key"], f"franchise label {lab!r} is markdown residue"
                  + (f"; expansion table link text reads {md_title!r}" if md_title else ""))
        elif lab and lab[0].islower():
            F.add("V18", n["key"], f"franchise label {lab!r} starts in lower case (title is '*batteries not included')",
                  cls=COSMETIC)
        else:
            issues = label_format_issues(lab)
            if issues:
                F.add("V18", n["key"], f"franchise label {lab!r}: " + "; ".join(issues)
                      + " (starter format 'Title' or 'Title — subtitle', decision 16)")

    # A08 alternatives
    for n in norms:
        for a in n["raw"].get("alternativeBlueprints") or []:
            replaced = next((b for b in n["blueprints"] if b["slot"] == a["slot"]), None)
            final = convert.convert_stage(a["weaponPath"][-1])
            errs = rules.validate_robot_name(a["name"])
            F.add("A08", n["key"], f"alternative {a['name']!r} ({a['loadout']}, {a['buildFocus']}, final "
                  f"{'/'.join(v for v in final.values())}) would replace slot {a['slot']} "
                  f"{replaced['name'] if replaced else '?'}; refinementPlan has {len(a['refinementPlan'])} steps"
                  + (f"; name errors {errs}" if errs else ""), slot=a["slot"])

    # A09 sensitive wording
    for n in norms:
        fields = [("franchise label", n["franchise"]), ("stable name", n["stableName"]), ("backstory", n["backstory"])]
        fields += [(f"robot slot {b['slot']}", b["name"]) for b in n["blueprints"]]
        fields += [(f"art brief slot {b['slot']}", b["raw"]["review"].get("artBrief", "")) for b in n["blueprints"]]
        fields += [(f"team", t) for size in ("2v2", "3v3") for t, _ in n["teams"][size]]
        for a in n["raw"].get("alternativeBlueprints") or []:
            fields.append((f"alternative slot {a['slot']}", a["name"]))
        hits = []
        for label, text in fields:
            low = text.lower()
            for w in SENSITIVE_WORDS:
                if re.search(r"\b" + re.escape(w), low):
                    hits.append(f"{label} {text!r} contains {w!r}")
            if label.startswith("art brief"):
                for w in LIKENESS_WORDS:
                    if w in low:
                        hits.append(f"{label} asks for a {w!r} figure (performer-likeness review)")
                        break
        if hits:
            F.add("A09", n["key"], "; ".join(hits), hits=len(hits))

    if decided:
        stats["acceptedDesignations"] = dict(sorted(accepted.items()))
    return stats


def source_detail_checks(norms: List[dict], F: Findings, facts: dict, W) -> None:
    """V14 refinement prices, A05 list prices, A11 review-field consistency (source only, both origins)."""
    opening = {"swarm": 3, "paragon": 1, "duo": 2, "trio": 3, "tycoon": 2, "generalist": 2}  # STRATEGIES §5–§10
    workshop = {"hone": 1, "augment": 3, "sharpen": 5, "forge": 8}
    for n in norms:
        raw = n["raw"]
        st = n["strategy"]
        if st is not None:  # unmapped strategy (Squadron): only its V06 finding for the strategy fields
            target = rules.effective_final_robots(st, n["overrides"])
            if raw.get("targetRobots") != target:
                F.add("A11", n["key"], f"targetRobots {raw.get('targetRobots')} != effective target {target}")
            if raw.get("openingRobots") != opening[st]:
                F.add("A11", n["key"], f"openingRobots {raw.get('openingRobots')} != strategy opening {opening[st]}")
            cap = min(rules.highest_robots_bound(st), len(n["blueprints"]))
            if raw.get("adminMaximumRobots") != cap:
                F.add("A11", n["key"], f"adminMaximumRobots {raw.get('adminMaximumRobots')} != "
                      f"min(highest robots bound {rules.highest_robots_bound(st)}, {len(n['blueprints'])} blueprints) "
                      f"= {cap}", kind="adminMaximum")
        for b in n["blueprints"]:
            r = b["raw"]
            rev = r.get("review", {})
            # V14
            counts = collections.Counter()
            bad = []
            for s in b["rawPlan"]:
                tier = convert.SOURCE_TIER.get(s.get("tier"))
                if tier is None:
                    continue
                hand = s.get("weaponSlot")
                exp = rules.refinement_cost(facts, tier, s.get("magnitude", 1), counts[(hand, tier)])
                counts[(hand, tier)] += 1
                if s.get("costCredits") != exp:
                    bad.append(f"step {s.get('step')} {tier} ₡{s.get('costCredits'):,} vs ₡{exp:,}")
                if s.get("workshopLevel") != workshop[tier]:
                    bad.append(f"step {s.get('step')} {tier} workshop L{s.get('workshopLevel')} vs L{workshop[tier]}")
            total = sum(s.get("costCredits", 0) for s in b["rawPlan"])
            if rev.get("refinementTotalCredits") != total:
                bad.append(f"refinementTotalCredits ₡{rev.get('refinementTotalCredits'):,} vs sum ₡{total:,}")
            if bad:
                F.add("V14", n["key"], f"{b['name']}: " + "; ".join(bad), slot=b["slot"])
            # A05
            for i, stg in enumerate(r["weaponPath"]):
                names = [stg.get("mainWeapon"), stg.get("offhandWeapon")]
                seed = sum(W.get(x)["cost"] for x in names if x and W.get(x))
                if stg.get("listPriceCredits") != seed:
                    F.add("A05", n["key"], f"{b['name']} stage {i}: listPriceCredits ₡{stg.get('listPriceCredits'):,} "
                          f"vs seed ₡{seed:,}", slot=b["slot"])
            # A11 review fields
            if rev.get("minimumRosterExpansionLevel") != b["slot"] - 1:
                F.add("A11", n["key"], f"{b['name']}: minimumRosterExpansionLevel {rev.get('minimumRosterExpansionLevel')} "
                      f"!= slot − 1 ({b['slot'] - 1})", slot=b["slot"])
            want = f"app/frontend/public/assets/automatons/{n['key']}/{b['slot']}.webp"
            has_convention = raw.get("_origin") == "review" or "imageConvention" in rev
            if has_convention and rev.get("imageConvention") != want:
                F.add("A11", n["key"], f"{b['name']}: imageConvention {rev.get('imageConvention')!r}", slot=b["slot"])
            rng = W.stage_range(b["path"][0])
            if rev.get("rangeFromWeapons") != rng:
                F.add("A11", n["key"], f"{b['name']}: rangeFromWeapons {rev.get('rangeFromWeapons')} vs stage-0 {rng}",
                      slot=b["slot"])


IMAGE_SIZE = (512, 512)  # spec-55 decisions 27–28: 512×512 WebP


def webp_size(head: bytes) -> Optional[tuple]:
    """(width, height) of a WebP from its first 30 bytes, or None when it is not a WebP the parser knows."""
    if len(head) < 30 or head[:4] != b"RIFF" or head[8:12] != b"WEBP":
        return None
    chunk = head[12:16]
    if chunk == b"VP8 ":
        if head[23:26] != b"\x9d\x01\x2a":
            return None
        return (int.from_bytes(head[26:28], "little") & 0x3FFF, int.from_bytes(head[28:30], "little") & 0x3FFF)
    if chunk == b"VP8L":
        if head[20] != 0x2F:
            return None
        bits = int.from_bytes(head[21:25], "little")
        return ((bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1)
    if chunk == b"VP8X":
        return (int.from_bytes(head[24:27], "little") + 1, int.from_bytes(head[27:30], "little") + 1)
    return None


def image_checks(norms: List[dict], F: Findings, starter_keys) -> dict:
    """V15 on EXPANSION_IMAGE_DIR: per slot a 512×512 WebP named {slot}.webp (Blocking when wrong; a slot
    without a file is Cosmetic, R4.4), no stray files, no folder without a Catalogue_Entry."""
    present = {}
    slots_total = missing = invalid = 0
    for n in norms:
        d = os.path.join(rules.EXPANSION_IMAGE_DIR, n["key"])
        files = sorted(f for f in os.listdir(d) if not f.startswith(".")) if os.path.isdir(d) else []
        present[n["key"]] = files
        slots = {b["slot"] for b in n["blueprints"]}
        slots_total += len(slots)
        for f in files:
            m = re.fullmatch(r"(\d+)\.webp", f)
            if not m:
                F.add("V15", n["key"], f"image file {f!r} is not named {{slot}}.webp")
                invalid += 1
            elif int(m.group(1)) not in slots:
                F.add("V15", n["key"], f"image {f} has no blueprint slot")
                invalid += 1
            else:
                with open(os.path.join(d, f), "rb") as fh:
                    size = webp_size(fh.read(30))
                if size is None:
                    F.add("V15", n["key"], f"image {f} is not a WebP file", slot=int(m.group(1)))
                    invalid += 1
                elif size != IMAGE_SIZE:
                    F.add("V15", n["key"], f"image {f} is {size[0]}×{size[1]}, not "
                          f"{IMAGE_SIZE[0]}×{IMAGE_SIZE[1]}", slot=int(m.group(1)))
                    invalid += 1
        for s in sorted(slots - {int(f[:-5]) for f in files if re.fullmatch(r"\d+\.webp", f)}):
            F.add("V15", n["key"], f"slot {s} has no portrait yet; allowed (R4.4)", slot=s, cls=COSMETIC)
            missing += 1
    known = {n["key"] for n in norms} | set(starter_keys)
    orphans = []
    if os.path.isdir(rules.EXPANSION_IMAGE_DIR):
        orphans = sorted(d for d in os.listdir(rules.EXPANSION_IMAGE_DIR)
                         if os.path.isdir(os.path.join(rules.EXPANSION_IMAGE_DIR, d)) and d not in known)
    for d in orphans:
        F.add("V15", d, "image folder without a Catalogue_Entry (catalogueImages.test.ts)")
    hits = []
    for root_, _dirs, files in os.walk(rules.SOURCE_MD_DIR):
        for f in files:
            if f.endswith((".md", ".json")):
                with open(os.path.join(root_, f), encoding="utf-8") as fh:
                    for i, line in enumerate(fh, 1):
                        if re.search(r"placeholder|stand-in", line, re.I):
                            hits.append(f"{f}:{i}")
    for h in hits:
        F.add("V15", None, f"placeholder/stand-in reference at {h}")
    return {"slots": slots_total, "present": slots_total - missing, "missing": missing, "invalid": invalid,
            "orphanFolders": len(orphans),
            "withImages": sum(1 for v in present.values() if v), "files": sum(len(v) for v in present.values()),
            "placeholderHits": len(hits)}


def portrait_alignment(norms: List[dict], dec_norms: List[dict], decisions: dict, F: Findings, C: Findings,
                       D: Findings) -> dict:
    """A13 (decision 18): a slot with a portrait whose name or art brief a decision changed. Source scope:
    one finding per changed slot (old → new). Catalogue scope: the slot has no portrait verdict yet (open).
    Decided scope: the verdict is 'new-portrait-needed' (accepted by decision 18). 'aligned' adds nothing."""
    decided_by_key = {n["key"]: n for n in dec_norms}
    stats = collections.Counter()
    for n in norms:
        dn = decided_by_key[n["key"]]
        numbers = sorted((decisions.get(n["key"]) or {}).get("_decisions") or [])
        origin = n["raw"].get("_origin")
        dec_slots = {b["slot"]: b for b in dn["blueprints"]}
        for b in n["blueprints"]:
            d = dec_slots.get(b["slot"])
            if d is None:
                continue
            path = os.path.join(rules.EXPANSION_IMAGE_DIR, n["key"], f"{b['slot']}.webp")
            if not os.path.isfile(path):
                continue
            old_brief = (b["raw"].get("review") or {}).get("artBrief", "")
            new_brief = (d["raw"].get("review") or {}).get("artBrief", "")
            changes = []
            if d["name"] != b["name"]:
                changes.append(f"name {b['name']!r} → {d['name']!r}")
            if new_brief != old_brief:
                changes.append("art brief changed")
            if not changes:
                continue
            stats[f"{origin}:changed"] += 1
            F.add("A13", n["key"], f"portrait {n['key']}/{b['slot']}.webp predates the change: "
                  + ", ".join(changes) + f" (decision {', '.join(map(str, numbers))})", slot=b["slot"], origin=origin)
            verdict = d["raw"].get("_portrait")
            if verdict is None:
                stats[f"{origin}:open"] += 1
                C.add("A13", n["key"], f"{d['name']}: no portrait verdict yet; check "
                      f"{n['key']}/{b['slot']}.webp (decision 18)", slot=b["slot"], scope="catalogue", cls=PO,
                      origin=origin)
            elif verdict == "new-portrait-needed":
                stats[f"{origin}:newPortraitNeeded"] += 1
                D.add("A13", n["key"], f"{d['name']}: needs a new portrait ({n['key']}/{b['slot']}.webp)",
                      slot=b["slot"], origin=origin)
            else:
                stats[f"{origin}:aligned"] += 1
    return dict(sorted(stats.items()))


def consistency_checks(norms: List[dict], F: Findings) -> dict:
    """A11: for the review records the blueprints.json bundle, both markdown documents and
    validation-report.json vs the per-stable files; for the collection each folder's blueprints.json
    vs its stable.json (robots, number, key)."""
    out = {}
    collection = [n for n in norms if n["raw"].get("_origin") == "collection"]
    norms = [n for n in norms if n["raw"].get("_origin") == "review"]
    out["collectionStables"] = len(collection)
    out["collectionBundleMismatches"] = 0
    for n in collection:
        if not n["raw"].get("_bundleMatches"):
            out["collectionBundleMismatches"] += 1
            F.add("A11", n["key"], f"{n['raw']['_sourceFile'].rsplit('/', 1)[0]}/blueprints.json differs from "
                  "stable.json (robots, stable_number or catalogue_key)")
    bundle = rules.load_json(os.path.join(rules.SOURCE_DIR, "blueprints.json"))
    bkeys = {s["catalogueKey"]: s for s in bundle.get("stables", [])}
    files = {n["key"]: n["raw"] for n in norms}
    out["bundleStables"] = len(bkeys)
    for k in sorted(set(bkeys) ^ set(files)):
        F.add("A11", k, "stable present in only one of blueprints.json / individual files")
    for k in sorted(set(bkeys) & set(files)):
        a = {x: y for x, y in files[k].items() if not x.startswith("_")}
        if bkeys[k] != a:
            F.add("A11", k, "blueprints.json record differs from the individual file")

    # AUTOMATON_STABLE_EXPANSION.md rows
    exp_md = open(os.path.join(rules.SOURCE_MD_DIR, "AUTOMATON_STABLE_EXPANSION.md"), encoding="utf-8").read()
    rows = re.findall(r"^\| (\d+) \| \*\*(.+?)\*\* · `([a-z0-9-]+)`.*?\| (.*?) \| (\w+) \| (Direct|Adapt) \|", exp_md, re.M)
    out["expansionRows"] = len(rows)
    seen = set()
    for num, name, key, theme, strategy, _fit in rows:
        seen.add(key)
        n = next((x for x in norms if x["key"] == key), None)
        if n is None:
            F.add("A11", key, "AUTOMATON_STABLE_EXPANSION.md lists a key with no stable file")
            continue
        if n["stableName"] != name or n["strategyDisplay"] != strategy or n["raw"].get("number") != int(num):
            F.add("A11", key, f"AUTOMATON_STABLE_EXPANSION.md row differs ({num} {name} {strategy})")
        m = re.match(r"\[([^\]]+)\]\(", theme)
        if m:
            n["raw"]["_mdTitle"] = m.group(1)
    for n in norms:
        if n["key"] not in seen:
            F.add("A11", n["key"], "stable missing from AUTOMATON_STABLE_EXPANSION.md")

    # AUTOMATON_ROBOT_BLUEPRINTS.md sections
    bp_md = open(os.path.join(rules.SOURCE_MD_DIR, "AUTOMATON_ROBOT_BLUEPRINTS.md"), encoding="utf-8").read()
    sections = re.split(r"^## (?=\d+\. )", bp_md, flags=re.M)[1:]
    out["blueprintSections"] = len(sections)
    for sec in sections:
        hm = re.match(r"(\d+)\. (.+?) \(`([a-z0-9-]+)`\)", sec)
        if not hm:
            continue
        key = hm.group(3)
        n = next((x for x in norms if x["key"] == key), None)
        if n is None:
            F.add("A11", key, "AUTOMATON_ROBOT_BLUEPRINTS.md section with no stable file")
            continue
        diffs = []
        if hm.group(2) != n["stableName"]:
            diffs.append("stable name")
        def field(label):
            m = re.search(r"^\| " + re.escape(label) + r" \| (.*) \|$", sec, re.M)
            return m.group(1) if m else None
        if field("Franchise label") != n["franchise"]:
            diffs.append("franchise label")
        if field("Backstory") != n["backstory"]:
            diffs.append("backstory")
        if field("Strategy") != n["strategyDisplay"]:
            diffs.append("strategy")
        em = re.search(r"\*\*Stable event order:\*\* (.*)", sec)
        if not em or re.findall(r"`([a-z0-9_]+)`", em.group(1)) != n["eventOrder"]:
            diffs.append("event order")
        teams = re.findall(r"^\| (2v2|3v3) \| (.+?) \| ([\d + ]+) \|", sec, re.M)
        md_teams = sorted((t[0], t[1], [int(x) for x in t[2].split("+")]) for t in teams)
        js_teams = sorted((size, name, sl) for size in ("2v2", "3v3") for name, sl in n["teams"][size])
        if md_teams != js_teams:
            diffs.append("team names")
        main = sec.split("### Complete alternative blueprints")[0]
        robots = re.findall(r"^\| (\d+) \| (.+?) \| (\w+) \| `(\w+)` \| (\w+) \| (\w+) \| (\d+) \| (\w+) \|$", main, re.M)
        md_r = [(int(r[0]), r[1], r[3], r[5], int(r[6]), r[7].lower()) for r in robots]
        js_r = [(b["slot"], b["name"], b["loadout"], b["stance"], b["yield"], b["buildFocus"]) for b in n["blueprints"]]
        if md_r != js_r:
            diffs.append("robot table")
        wp = main.split("**Weapon paths")[-1].split("**Refinement plans")[0]
        paths = re.findall(r"^\| (\d+) · (.+?) \| (.+?) \| (.+?) \|$", wp, re.M)
        md_p = []
        for p in paths:
            def st(c):
                c = re.split(r" \(₡", c)[0]
                m2 = re.fullmatch(r"(.+?) ×2", c)
                if m2:
                    return {"main": m2.group(1), "offhand": m2.group(1)}
                m3 = re.fullmatch(r"(.+?) \(main\) \+ (.+?) \(off(?:hand)?\)", c)
                if m3:
                    return {"main": m3.group(1), "offhand": m3.group(2)}
                if " + " in c:
                    a, b2 = c.split(" + ", 1)
                    return {"main": a, "offhand": b2}
                return {"main": c}
            md_p.append((int(p[0]), [st(p[2]), st(p[3])]))
        js_p = [(b["slot"], b["path"]) for b in n["blueprints"]]
        if md_p != js_p:
            diffs.append("weapon paths")
        if diffs:
            F.add("A11", key, "AUTOMATON_ROBOT_BLUEPRINTS.md differs from the JSON: " + ", ".join(diffs))

    # validation-report.json claims
    rep = rules.load_json(os.path.join(rules.SOURCE_DIR, "validation-report.json"))
    out["reportResult"] = rep.get("result")
    return out


def report_claims(F: Findings, all_items: List[dict], review_keys) -> None:
    """validation-report.json covers the review records only, so only their findings count."""
    all_items = [i for i in all_items if i["catalogueKey"] in review_keys]
    by = collections.Counter(i["check"] for i in all_items if i["scope"] == "source")
    rep = rules.load_json(os.path.join(rules.SOURCE_DIR, "validation-report.json"))
    if str(rep.get("result", "")).startswith("PASS") and any(
            i["class"] == BLOCKING for i in all_items if i["scope"] == "source"):
        F.add("A11", None, f"validation-report.json says {rep.get('result')!r} while the source has "
              f"{sum(1 for i in all_items if i['scope'] == 'source' and i['class'] == BLOCKING)} Blocking findings")
    if by.get("V02"):
        F.add("A11", None, "validation-report.json claims names 'fit local length rules' and profanity was "
              f"'not verified'; {len({i['catalogueKey'] for i in all_items if i['check'] == 'V02'})} stable names "
              "fail validateStableName")
    if by.get("V13"):
        F.add("A11", None, "validation-report.json claims all 333 blueprints contain resolved refinement values; "
              f"{sum(1 for i in all_items if i['check'] == 'V13' and i.get('kind') == 'empty')} plans are empty")


def built_checks(cat_files: List[str], C: Findings) -> dict:
    """V19 from tools/facts/built-check.json (written by check-built.ts); returns stats.builtCheck."""
    path = os.path.join(rules.FACTS_DIR, "built-check.json")
    if not os.path.exists(path):
        C.add("V19", None, "tools/facts/built-check.json is missing: run check-built.ts (README §3)", scope="catalogue")
        return {"pendingWholeWord": [], "present": False}
    data = rules.load_json(path)
    want_roots = (rules.repo_relative(rules.APP_ROOT), rules.repo_relative(rules.PROFANITY_ROOT))
    if (data.get("appRoot"), data.get("profanityRoot")) != want_roots:
        C.add("V19", None, f"built-check.json is stale: roots {data.get('appRoot')!r}/{data.get('profanityRoot')!r} "
              f"differ from {want_roots[0]!r}/{want_roots[1]!r}; re-run check-built.ts", scope="catalogue")
    for f in data.get("controlFailures", []) + data.get("failures", []):
        C.add("V19", f["key"], f"{f['check']}: {f['message']}", scope="catalogue")
    hashes = data.get("files", {})
    current = {}
    for f in cat_files:
        with open(os.path.join(rules.CATALOGUE_DIR, f), "rb") as fh:
            current[f[:-5]] = hashlib.sha256(fh.read()).hexdigest()
    for key in sorted(set(current) | set(hashes)):
        if current.get(key) != hashes.get(key):
            C.add("V19", key, "built-check.json is stale for this file (sha256 differs or file missing); "
                  "re-run check-built.ts", scope="catalogue")
    disagree = 0
    for n in data.get("names", []):
        if rules.contains_profanity(n["name"]) != n["wholeWordHit"]:
            disagree += 1
            C.add("V19", n["key"], f"rules.py whole-word transcription disagrees with profanityFilter.ts on "
                  f"{n['kind']} name {n['name']!r} (TypeScript: {n['wholeWordHit']})", slot=n.get("slot"),
                  scope="catalogue")
    projections = data.get("projections", {})
    metrics = [p["metrics"] for p in projections.values() if p.get("metrics")]
    return {
        "present": True,
        "staged": data.get("staged"),
        "starters": data.get("starters"),
        "pendingWholeWord": data.get("pendingWholeWord", []),
        "failures": len(data.get("failures", [])),
        "controlFailures": len(data.get("controlFailures", [])),
        "uniqueness": {k: len(v) for k, v in sorted(data.get("uniqueness", {}).items())},
        "names": len(data.get("names", [])),
        "nameHits": dict(sorted(collections.Counter(n["kind"] for n in data.get("names", []) if n["wholeWordHit"]).items())),
        "transcriptionDisagreements": disagree,
        "projections": {
            "checked": len(projections),
            "passed": sum(1 for p in projections.values() if p.get("passed")),
            "robotsBelowTarget": sum(1 for m in metrics if m["robotsBuilt"] < m["robotsTarget"]),
            "robotsNotOnFinalStage": sum(m["robotsBuilt"] - m["robotsOnFinalStage"] for m in metrics),
            "robotsBelowRefineTarget": sum(1 for m in metrics for r in m["refinementRows"]
                                           if r["rows"] < r["withinTarget"]),
            "robotsProjected": sum(len(m["refinementRows"]) for m in metrics),
            "stillSpendingIntoLastGoal": sum(1 for m in metrics if m["finalNextGoal"] is not None),
        },
    }


SPEC55_IMPACT = [
    ("R10.9 / decision 32", "spec-55 R10.9 says the System delivers *exactly* the {starters} starter entries; with "
     "spec 57 the repository holds {repo_total}. Spec 57 amends this wording in its own requirements (spec 55 is not "
     "edited)."),
    ("design §15.1 example note", "\"Slot 2 (ED-209) … is required, because Paragon's robots bounds allow 2 robots "
     "(R3.7)\" reads as if every stable needs blueprints up to its highest robots bound. R3.7 and the schema bullet "
     "only require robots Goal_Targets ≤ blueprints, so the {paragon_one} one-blueprint Paragons are valid. The note should be "
     "read as content precedent, not a schema rule (A01)."),
    ("Coverage_Matrix (§15.5, CATALOGUE §14)", "the test asserts the union of all repository entries covers every "
     "row; adding {expansion} entries can only add coverage. Rows that name starter stables (e.g. 'Kamino Clone "
     "Legion at 3 robots') stay starter-specific. Decision 11: the matrix stays starter-defined, and spec 57 adds an "
     "assertion that the {starters} starter entries alone cover it (task 3.3)."),
    ("heavy tier (R14.4, design §21)", "spec 55's heavy test runs a fixed population of starter plus generated "
     "entries. Spec 57 changes it to run every repository Catalogue_Entry ({repo_total} today, whatever their "
     "number) and to record the timing per automaton (decision 19, R5.4)."),
    ("activation volume on ACC", "the deploy-time Catalogue_Sync adds {expansion} Draft_Automatons at once "
     "(invisible, R2.1). There is no activation cap (decision 19); activating in batches stays the operations "
     "advice. review/SCALING.md has the scaling investigation."),
    ("containsProfanity (app code)", "main's `validateStableName` uses the whole-word `containsProfanity` "
     "(app/backend/src/utils/profanityFilter.ts, bugfix/profanity-whole-word-matching, PR #528; spec 55 merged "
     "in PR #529), so the Assembly names and the collection stable names with 'ass' or 'crap' inside a word "
     "pass (README decision 1; confirmed by task 1.2)."),
    ("review-only concepts with no engine home", "openingRobots (derived from the Build_Order), adminMaximumRobots "
     "(engine maximum is min(highest robots bound, blueprints); the source value is wrong for "
     "{admin_max_bad} stables), availability opening/growth/reserve/alternative, minimumRosterExpansionLevel "
     "(derived), fit, conceptIdentity, sourceAlias/nameBasis, purchaseOrder/reserveSlots and the price subtotals "
     "are dropped by the conversion."),
    ("alternativeBlueprints", "spec 55 has no alternative-blueprint concept (one blueprint per slot). The "
     "{alternatives} alternatives are dropped from catalogue/ (decision 2: discard all; A08)."),
    ("Squadron strategy", "spec 55 has no Squadron strategy. Its stables convert as Trio with robots target 6 "
     "(decision 12); the Squadron purchase order, upgrade order, authored plans and Workshop L8 path have no "
     "spec-55 equivalent and are dropped."),
    ("refinement semantics in the source", "the source assumes 'dual-wield refinements affect the main-hand copy "
     "only' and 'Swarm, Trio and Tycoon do not refine'. Both contradict decision 35 and R3.4 (offhand steps exist; "
     "every blueprint has a plan). The source was built from an earlier starter draft."),
]


# ── Report writing ───────────────────────────────────────────────────

def md_escape(s: str) -> str:
    return s.replace("|", "\\|")


def generated_blocks(items, cat_items, norms, stats, img, cons, conv_logs, dec_items=None,
                     register=None, starter=None) -> Dict[str, str]:
    dec_items = dec_items or []
    register = register or {}
    src = [i for i in items if i["scope"] == "source"]
    blocks = {}
    cls_count = collections.Counter(i["class"] for i in src)
    stables_by_cls = {c: len({i["catalogueKey"] for i in src if i["class"] == c and i["catalogueKey"]}) for c in CLASS_LABEL}
    lines = ["| Class | Findings | Stables affected |", "|---|---:|---:|"]
    for c in (BLOCKING, PO, COSMETIC):
        lines.append(f"| {CLASS_LABEL[c]} | {cls_count.get(c, 0)} | {stables_by_cls[c]} |")
    lines.append(f"| **Total** | **{len(src)}** | **{len({i['catalogueKey'] for i in src if i['catalogueKey']})}** |")
    cat_block = [i for i in cat_items if i["class"] == BLOCKING]
    lines.append("")
    lines.append(f"Residual Blocking findings in `catalogue/` (re-validated output): **{len(cat_block)}**, "
                 f"in {', '.join(sorted({i['check'] for i in cat_block})) or 'no check'} "
                 f"({sum(1 for i in cat_block if CHECKS[i['check']][3] == 'yes')} of them mechanically fixable).")
    blocks["summary"] = "\n".join(lines)

    lines = ["| Check | Title | Class | Findings in draft | Stables | Fix mechanical | Applied in `catalogue/` | Residual in `catalogue/` "
             "| After decisions | Decision |",
             "|---|---|---|---:|---:|---|---|---:|---:|---|"]
    for cid, (title, cls, _fix, mech, applied) in CHECKS.items():
        here = [i for i in src if i["check"] == cid]
        resid = [i for i in cat_items if i["check"] == cid]
        classes = sorted({i["class"] for i in here}) or [cls]
        st = check_status(cid, src, cat_items, dec_items, register)
        after = "n/a" if st["decided"] is None else str(st["decided"])
        lines.append(f"| {cid} | {md_escape(title)} | {', '.join(CLASS_LABEL[c] for c in classes)} | {len(here)} | "
                     f"{len({i['catalogueKey'] for i in here if i['catalogueKey']})} | {mech} | "
                     f"{md_escape(applied_text(st, applied))} | {len(resid)} | "
                     f"{after} | {', '.join(map(str, st['numbers'])) or '—'} |")
    blocks["checks"] = "\n".join(lines)

    lines = ["| # | Catalogue key | Stable name | Strategy | Blueprints | Blocking | PO decision | Cosmetic |",
             "|---:|---|---|---|---:|---:|---:|---:|"]
    for n in sorted(norms, key=lambda x: x["raw"].get("number", 0)):
        here = [i for i in src if i["catalogueKey"] == n["key"]]
        c = collections.Counter(i["class"] for i in here)
        lines.append(f"| {n['raw'].get('number')} | `{n['key']}` | {md_escape(n['stableName'])} | "
                     f"{n['strategy'] or n['strategyDisplay']} | "
                     f"{len(n['blueprints'])} | {c.get(BLOCKING, 0)} | {c.get(PO, 0)} | {c.get(COSMETIC, 0)} |")
    glob_items = [i for i in src if not i["catalogueKey"]]
    gc = collections.Counter(i["class"] for i in glob_items)
    lines.append(f"| — | (source documents, no stable) | | | | {gc.get(BLOCKING, 0)} | {gc.get(PO, 0)} | {gc.get(COSMETIC, 0)} |")
    blocks["per-stable"] = "\n".join(lines)

    # details per check
    out = []
    for cid, (title, cls, fix, mech, applied) in CHECKS.items():
        here = [i for i in src if i["check"] == cid] if cid != "V00" else cat_items_by(cat_items, "V00")
        out.append(f"#### {cid} — {title}")
        out.append("")
        sub = collections.Counter(i["class"] for i in here)
        st = check_status(cid, src, cat_items, dec_items, register)
        after = ""
        if st["found"] or st["numbers"]:
            if st["decided"] is not None:
                added = added_after_decisions(cid, src, dec_items, register)
                after = f"; {st['decided']} after decisions" + (f" ({added})" if added else "")
            after += f". Status: {st['status']}"
        applied_now = applied_text(st, applied) if cid != "V00" else applied
        out.append(f"Findings: {len(here)}" + (" in the draft" if cid != "V00" else "")
                   + (f" ({', '.join(f'{CLASS_LABEL[k]} {v}' for k, v in sorted(sub.items()))})" if here else "")
                   + f"{after}. Recommended fix: {fix} Mechanical: {mech}. Applied in `catalogue/`: {applied_now}.")
        out.append("")
        if cid == "V13":
            kinds = collections.Counter(i.get("kind") for i in here)
            out.append(f"Breakdown: empty plans {kinds.get('empty', 0)}, misordered plans {kinds.get('misordered', 0)}, "
                       f"dual-wield offhand without steps {kinds.get('offhand-missing', 0)}.")
            out.append("")
        if here:
            limit = 400
            for i in here[:limit]:
                where = f"`{i['catalogueKey']}`" if i["catalogueKey"] else "source"
                if i.get("slot") is not None:
                    where += f" slot {i['slot']}"
                out.append(f"- {where}: {md_escape(i['message'])}")
            if len(here) > limit:
                out.append(f"- … {len(here) - limit} more in `review/findings.json`")
            out.append("")
    blocks["details"] = "\n".join(out)

    v13 = [i for i in src if i["check"] == "V13"]
    kinds = collections.Counter(i.get("kind") for i in v13)
    a03 = [i for i in src if i["check"] == "A03"]
    toa_like = sum(1 for i in v13 if "no verified Hone/Augment facts" in i["message"])
    toa_pair = any("Toa Pair 01" in i["message"] for i in a03)
    overrides = [l for l in conv_logs if l["override"]["written"]]
    lines = ["| Pre-flagged item | Confirmed | Count |", "|---|---|---:|",
             f"| Empty refinement plans (V13) | yes | {kinds.get('empty', 0)} robots |",
             f"| … of which with the note \"no verified Hone/Augment facts\" (Toa Foundry style) | yes | {toa_like} robots |",
             f"| Non-empty plans that are misordered (V13) | yes | {kinds.get('misordered', 0)} robots |",
             f"| Generic team names such as \"Toa Pair 01\" (A03) | {'yes' if toa_pair else 'no'} | "
             f"{stats['genericTeamNames']} of {stats['teamNames']} team names, {sum(1 for i in a03 if i.get('kind') == 'team')} stables |",
             f"| `targetOverrides` keyed by `robots` (V08), converted | yes | {len(overrides)} stables "
             f"({', '.join(sorted({json.dumps(l['override']['written']) for l in overrides}))}) |",
             f"| `alternativeBlueprints` for a feature that does not exist (A08) | yes | "
             f"{sum(1 for i in src if i['check'] == 'A08')} alternatives |"]
    blocks["preflagged"] = "\n".join(lines)

    # Distribution after decisions (what ships); the source distribution stays in findings.json.
    lines = ["| Strategy | Blueprints | Robots target | Stables |", "|---|---:|---:|---:|"]
    for st, count, target, num in (stats.get("decided") or {}).get("distribution", stats["distribution"]):
        lines.append(f"| {st} | {count} | {target} | {num} |")
    lines.append(f"| **Total** | **{sum(len(n['blueprints']) for n in norms)}** | | **{len(norms)}** |")
    lines.append("")
    lines.append(f"After decisions (`tools/decisions.json`). In the source, "
                 f"{sum(1 for i in src if i['check'] == 'A12')} stables had more blueprints than their robots "
                 f"target (A12); after decisions {sum(1 for i in dec_items if i['check'] == 'A12')}.")
    blocks["distribution"] = "\n".join(lines)

    lines = ["| Shared backstory sentence (stable name replaced by {stable}) | Stables |", "|---|---:|"]
    for c, s in stats["sharedBackstorySentences"][:10]:
        lines.append(f"| {md_escape(s)} | {c} |")
    blocks["backstory"] = "\n".join(lines)

    admin_bad = sum(1 for i in src if i["check"] == "A11" and i.get("kind") == "adminMaximum")
    starters_n = len((starter or {}).get("stables", []))
    lines = []
    for i, (where, text) in enumerate(SPEC55_IMPACT, 1):
        paragon_one = sum(1 for n in norms if n["strategy"] == "paragon" and len(n["blueprints"]) == 1)
        lines.append(f"{i}. **{where}** — " + text.format(
            admin_max_bad=admin_bad, paragon_one=paragon_one, starters=starters_n, expansion=len(norms),
            repo_total=starters_n + len(norms), alternatives=sum(1 for i_ in src if i_["check"] == "A08")))
    blocks["spec55"] = "\n".join(lines)

    lines = [f"- Expansion stables with any Repository_Image: {img['withImages']} ({img['files']} files); slots with a "
             f"portrait {img['present']} of {img['slots']}, invalid files {img['invalid']}, image folders without a "
             f"Catalogue_Entry {img['orphanFolders']} — missing images are allowed (R10.2).",
             f"- Placeholder / stand-in references in the source: {img['placeholderHits']}.",
             f"- Review records: blueprints.json stables: {cons['bundleStables']}; AUTOMATON_STABLE_EXPANSION.md rows: "
             f"{cons['expansionRows']}; AUTOMATON_ROBOT_BLUEPRINTS.md stable sections: {cons['blueprintSections']}; "
             f"validation-report.json result: {cons['reportResult']!r}.",
             f"- Collection: {cons['collectionStables']} folders; blueprints.json differs from stable.json in "
             f"{cons['collectionBundleMismatches']}."]
    blocks["inventory"] = "\n".join(lines)

    # headline numbers (so the narrative never restates a count by hand)
    def n_of(cid, **kw):
        return [i for i in src if i["check"] == cid and all(i.get(k) == v for k, v in kw.items())]

    def phrase(cid):
        return status_phrase(check_status(cid, src, cat_items, dec_items, register))
    a12 = check_status("A12", src, cat_items, dec_items, register)
    a01 = check_status("A01", src, cat_items, dec_items, register)
    a01_added = added_after_decisions("A01", src, dec_items, register)
    tiers = collections.Counter()
    plan_steps = 0
    for e in stats.get("catalogueEntries", []):
        for b in e["blueprints"]:
            plan_steps += len(b["refinementPlan"])
            tiers.update(s["tier"] for s in b["refinementPlan"])
    v02 = n_of("V02")
    pending = (stats.get("builtCheck") or {}).get("pendingWholeWord", [])
    if not v02:
        first = (f"- **Stable names**: all {len(norms)} pass `validateStableName` under the whole-word "
                 "`containsProfanity` of `bugfix/profanity-whole-word-matching` (merged to `main` in PR #528)."
                 + (f" {len(pending)} of them (" + ", ".join(f"`{k}`" for k in pending) + ") pass only under that "
                    "rule, and the checked application code rejects them: it must use the whole-word "
                    "`containsProfanity` before Task Group 2 (task 1.2)." if pending else ""))
    else:
        first = (f"- **Stable names that fail `validateStableName` in the draft: {len(v02)}** — "
                 + ", ".join(sorted({"`" + i["catalogueKey"] + "`" for i in v02}))
                 + f". Not mechanically fixable; renamed by a recorded decision or open. {phrase('V02')}")
    lines = [
        first,
        f"- **Refinement plans: {len(n_of('V13'))} source defects** (empty {len(n_of('V13', kind='empty'))}, "
        f"misordered {len(n_of('V13', kind='misordered'))}, dual-wield offhand without steps "
        f"{len(n_of('V13', kind='offhand-missing'))}) plus {len(n_of('A07'))} plans with no step on the main "
        f"weapon (A07). All are replaced in `catalogue/` by generated decision-35/36 plans: {plan_steps} steps "
        f"(Sharpen {tiers.get('sharpen', 0)}, Forge {tiers.get('forge', 0)}, Hone {tiers.get('hone', 0)}, "
        f"Augment {tiers.get('augment', 0)}); residual 0. Confirmed under decision 6. {phrase('V13')}",
        f"- **Generic numbered names (A03)**: in the draft, {stats['genericTeamNames']} of {stats['teamNames']} "
        f"team names (\"Toa Pair 01\" style) and {stats['genericRobotNames']} robot names (\"Tachikoma 04\" style). "
        f"{phrase('A03')}",
        f"- **Templated backstories (A04)**: {len(n_of('A04'))} of {len(norms)} use the same two sentences around "
        f"the stable name and the concept line. {phrase('A04')}",
        f"- **Robots target vs blueprints**: in the draft, {len(n_of('A12'))} stables had a blueprint above the "
        f"robots target that was never built (A12) and {len(n_of('A01'))} had no blueprint beyond it (A01); both "
        f"are valid under R3.7. A12: {phrase('A12')[len('Status: '):-1]}, {a12['decided']} after decisions. "
        f"A01: {phrase('A01')[len('Status: '):-1]}, {a01['decided']} after decisions"
        + (f" ({a01_added})" if a01_added else "")
        + ".",
        f"- **Alternatives (A08)**: in the draft, {len(n_of('A08'))} `alternativeBlueprints` describe a feature "
        f"spec 55 does not have; dropped from `catalogue/` (decision 2). {phrase('A08')}",
        f"- **Franchise labels (V18)**: {len(n_of('V18'))} malformed or mis-cased labels in the draft. "
        f"{phrase('V18')}",
        f"- **Content review (A09)**: {len(n_of('A09'))} stables with sensitive wording or human-likeness art "
        f"briefs. {phrase('A09')}",
        "- **Rule checks with no Blocking finding**: "
        + ", ".join(f"{cid} ({CHECKS[cid][0].split(' (')[0]})" for cid in CHECKS
                    if cid.startswith("V") and cid != "V00" and CHECKS[cid][1] == BLOCKING
                    and not any(i["check"] == cid and i["class"] == BLOCKING for i in src)) + ".",
    ]
    blocks["headline"] = "\n".join(lines)
    blocks["status"] = status_block(src, cat_items, dec_items, register, stats)
    blocks["totals"] = totals_block(src, cat_items, dec_items, register, stats, img, conv_logs, starter or {})
    return blocks


def totals_block(src, cat_items, dec_items, register, stats, img, conv_logs, starter) -> str:
    """Generated Totals (decision 20): every count derived from source/, catalogue/ and the portraits."""
    origin = {l["catalogueKey"]: l.get("origin", "review") for l in conv_logs}
    entries = stats.get("catalogueEntries", [])

    def teams(e: dict) -> int:
        return len(e["teamNames"]["twoVsTwo"]) + len(e["teamNames"]["threeVsThree"])

    s_stables = starter.get("stables", [])
    rows = []
    s_row = (len(s_stables), sum(len(s["blueprints"]) for s in s_stables), sum(teams(s) for s in s_stables))
    rows.append(("Starter stables (spec 55, `tools/facts/starter.json`)",) + s_row)
    exp_total = [0, 0, 0]
    for label, which in (("Expansion_Stables: review records (`source/automaton-blueprints/`)", "review"),
                         ("Expansion_Stables: collection (`source/collection/`)", "collection")):
        es = [e for e in entries if origin.get(e["catalogueKey"]) == which]
        row = (len(es), sum(len(e["blueprints"]) for e in es), sum(teams(e) for e in es))
        exp_total = [a + b for a, b in zip(exp_total, row)]
        rows.append((label,) + row)
    rows.append(("Expansion_Stables, all",) + tuple(exp_total))
    rows.append(("**Repository total if delivered** (starters + expansion)",)
                + tuple(a + b for a, b in zip(s_row, exp_total)))
    lines = ["| What | Stables | Robots (blueprints) | Team names |", "|---|---:|---:|---:|"]
    lines += [f"| {r[0]} | {r[1]} | {r[2]} | {r[3]} |" for r in rows]
    n_source = len(conv_logs)
    lines.append("")
    lines.append(f"`catalogue/*.json` files = source stables: {len(entries)} = {n_source} → "
                 f"{'yes' if len(entries) == n_source else 'no'}.")
    lines.append("")
    lines.append("| Strategy (decided) | Stables | Blueprints | Robots at the robots target |")
    lines.append("|---|---:|---:|---:|")
    per = collections.defaultdict(lambda: [0, 0, 0])
    for e in entries:
        st = e["strategy"]["key"]
        per[st][0] += 1
        per[st][1] += len(e["blueprints"])
        per[st][2] += rules.effective_final_robots(st, e["strategy"]["targetOverrides"])
    for st in sorted(per):
        lines.append(f"| {st} | {per[st][0]} | {per[st][1]} | {per[st][2]} |")
    lines.append("")
    new_portrait = sum(1 for i in dec_items if i["check"] == "A13")
    lines.append(f"Portraits (`app/frontend/public/assets/automatons/`): expansion slots {img['slots']}, present "
                 f"{img['present']}, missing {img['missing']}, invalid {img['invalid']}, image folders without a "
                 f"Catalogue_Entry {img['orphanFolders']}, slots needing a new portrait {new_portrait}.")
    lines.append("")
    t = status_totals(src, cat_items, dec_items, register)
    lines.append(f"Findings: {t['found']} in the draft — {t['fixed']} fixed, {t['accepted']} accepted, "
                 f"{t['open']} open. Decisions recorded: {len(register)}.")
    return "\n".join(lines)


# One line per check for the "Status per check" table (no counts; those are generated).
STATUS_HOW = {
    "V02": "whole-word `containsProfanity` (decision 1, on main since PR #528; confirmed by task 1.2); "
           "invalid collection names renamed close to the original (decision 13)",
    "V03": "robot and team names: no whole-word hit; not filtered (decision 10); invalid names renamed "
           "(decision 13); cross-stable repeats made unique (decision 15)",
    "V06": "Squadron mapped to Trio with robots target 6 (decision 12); its purchase order and authored plans "
           "have no spec-55 equivalent",
    "V08": "converted mechanically to the final robots goal position",
    "V13": "plans regenerated by the decision-35/36 Plan_Generator (decision 6)",
    "V16": "franchise labels corrected (decisions 7, 16)",
    "V18": "franchise labels corrected (decisions 7, 16)",
    "A01": "no spare blueprint added (decision 5)",
    "A02": "both Metropolis names kept (decision 9); names unique catalogue-wide (decision 15)",
    "A03": "team and robot names authored, delegated (decisions 3, 14)",
    "A04": "backstories kept until backlog #61 (decision 4)",
    "A07": "as V13 (decision 6)",
    "A08": "alternatives dropped (decision 2)",
    "A09": "kept; names pass the whole-word filter (decisions 8, 17)",
    "A11": "review-only source fields dropped by the conversion",
    "A12": "robots target raised to the blueprint count (decision 5)",
    "A13": "names and briefs follow the portraits (decision 18)",
}


def check_status(cid, src, cat_items, dec_items, register) -> dict:
    """Status of one check's draft findings, shared by the status table, the checks table, the details
    and the headline so they never disagree. Each draft finding is Open (catalogue residual, or a decided
    item no register decision answers), Accepted by decision N (decided residual) or Fixed in catalogue
    (the rest). ``decided`` is the decided-pass count (None when the check has no decided pass)."""
    found = sum(1 for i in src if i["check"] == cid)
    numbers = sorted(n for n, rec in register.items() if cid in rec.get("checks", []))
    open_ = min(found, sum(1 for i in cat_items if i["check"] == cid))
    decided = sum(1 for i in dec_items if i["check"] == cid) if cid in DECIDED_PASS_CHECKS else None
    settled = min(decided or 0, found - open_)
    accepted = settled if numbers else 0
    undecided = 0 if numbers else settled
    fixed = found - open_ - settled
    buckets = [(label, n) for label, n in (
        ("Open", open_),
        ("Open (no decision recorded)", undecided),
        (f"Accepted by decision {', '.join(map(str, numbers))}", accepted),
        ("Fixed in catalogue", fixed)) if n]
    if not buckets:
        status = "Fixed in catalogue"
    elif len(buckets) == 1:
        status = buckets[0][0]
    else:
        status = "; ".join(f"{label} ({n})" for label, n in buckets)
    return {"found": found, "numbers": numbers, "open": open_ + undecided, "accepted": accepted,
            "fixed": fixed, "decided": decided, "status": status}


def applied_text(st: dict, static: str) -> str:
    """'Applied in catalogue/' derived from the check status (the static CHECKS value is kept only
    where it already says yes and every draft finding is fixed)."""
    nums = ", ".join(map(str, st["numbers"]))
    if not st["found"]:
        return "n/a"
    if st["open"]:
        return f"no ({st['open']} open)"
    if st["fixed"] == st["found"]:
        if static.startswith("yes"):
            return static
        return f"yes (decision {nums})" if nums else "yes"
    if st["accepted"] == st["found"]:
        return f"no; accepted by decision {nums}"
    return f"partly: {st['fixed']} fixed, {st['accepted']} accepted by decision {nums}"


def status_phrase(st: dict) -> str:
    """One sentence on the draft findings' status, for the headline bullets."""
    nums = ", ".join(map(str, st["numbers"]))
    parts = []
    if st["fixed"]:
        parts.append(f"{'all ' if st['fixed'] == st['found'] else ''}{st['fixed']} fixed in `catalogue/`")
    if st["accepted"]:
        parts.append(f"{'all ' if st['accepted'] == st['found'] else ''}{st['accepted']} accepted by decision {nums}")
    if st["open"]:
        parts.append(f"{st['open']} open")
    return "Status: " + (", ".join(parts) or "no findings") + "."


def added_after_decisions(cid, src, dec_items, register) -> str:
    """Explain decided-pass items on stables the draft did not have, e.g. A01 after decision 5:
    '+4: decision 5 raised the robots target of 4 trio stables (…) to their blueprint
    count of 4, below the trio bound of 6, so they still have no blueprint beyond the target'."""
    before = {i["catalogueKey"] for i in src if i["check"] == cid}
    added = [i for i in dec_items if i["check"] == cid and i["catalogueKey"] not in before]
    if not added:
        return ""
    if cid != "A01":
        return f"+{len(added)}: " + ", ".join(sorted(f"`{i['catalogueKey']}`" for i in added))
    raised = ", ".join(str(n) for n in sorted(register) if "A12" in register[n].get("checks", []))
    groups = collections.defaultdict(list)
    for i in added:
        groups[(i["strategy"], i["target"], i["bound"])].append(i["catalogueKey"])
    parts = [f"{len(keys)} {st} stable{'s' if len(keys) > 1 else ''} ("
             + ", ".join(f"`{k}`" for k in sorted(keys)) + f") to their blueprint count of {target}, below the "
             f"{st} bound of {bound}"
             for (st, target, bound), keys in sorted(groups.items())]
    return (f"+{len(added)}: decision {raised or '—'} raised the robots target of "
            + "; ".join(parts) + ", so they still have no blueprint beyond the target")


def status_rows(src, register) -> List[str]:
    found_by = collections.Counter(i["check"] for i in src)
    named = {c for rec in register.values() for c in rec.get("checks", []) if c in CHECKS}
    return [cid for cid in CHECKS if found_by.get(cid) or cid in named]


def status_totals(src, cat_items, dec_items, register) -> collections.Counter:
    """Draft findings found / fixed / accepted / open over the 'Status per check' rows."""
    totals = collections.Counter()
    for cid in status_rows(src, register):
        st = check_status(cid, src, cat_items, dec_items, register)
        totals.update(found=st["found"], fixed=st["fixed"], accepted=st["accepted"], open=st["open"])
    return totals


def status_block(src, cat_items, dec_items, register, stats) -> str:
    """'Status per check': one row per check with draft findings or a register decision (check_status)."""
    rows = status_rows(src, register)
    pending = len((stats.get("builtCheck") or {}).get("pendingWholeWord", []))
    lines = ["| Check | What | Found in draft | Status | How |", "|---|---|---:|---|---|"]
    totals = collections.Counter()
    for cid in rows:
        st = check_status(cid, src, cat_items, dec_items, register)
        found = st["found"]
        totals.update(found=found, fixed=st["fixed"], accepted=st["accepted"], open=st["open"])
        found_txt = str(found) + (f" ({pending} pass only under the whole-word filter)"
                                  if cid == "V02" and pending else "")
        how = STATUS_HOW.get(cid, CHECKS[cid][2])
        added = added_after_decisions(cid, src, dec_items, register)
        if added:
            how += f"; {st['decided']} after decisions ({added})"
        elif (st["decided"] or 0) > found:
            how += f" (+{st['decided'] - found} after decisions)"
        lines.append(f"| {cid} | {md_escape(CHECKS[cid][0].split(' (')[0])} | {found_txt} | {st['status']} | {how} |")
    lines.append("")
    lines.append(f"{totals['found']} draft findings: {totals['fixed']} fixed, {totals['accepted']} accepted, "
                 f"{totals['open']} open.")
    return "\n".join(lines)


def cat_items_by(items, cid):
    return [i for i in items if i["check"] == cid]


def write_findings_md(blocks: Dict[str, str]) -> List[str]:
    """Rewrite the generated blocks; return the names of blocks whose markers are missing."""
    path = os.path.join(rules.REVIEW_DIR, "FINDINGS.md")
    missing: List[str] = []
    if os.path.exists(path):
        text = open(path, encoding="utf-8").read()
    else:
        text = "# Spec 57 — Findings\n\n" + "\n\n".join(
            f"<!-- generated:{k}:start -->\n<!-- generated:{k}:end -->" for k in blocks) + "\n"
    for k, v in blocks.items():
        pat = re.compile(r"(<!-- generated:" + re.escape(k) + r":start -->\n).*?(<!-- generated:" + re.escape(k) + r":end -->)", re.S)
        if pat.search(text):
            text = pat.sub(lambda m: m.group(1) + "\n" + v + "\n\n" + m.group(2), text)
        else:
            missing.append(k)
    os.makedirs(rules.REVIEW_DIR, exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(text)
    return missing


# ── Modes ────────────────────────────────────────────────────────────

def run() -> int:
    facts = rules.load_facts()
    W = rules.Weapons(facts)
    starter = rules.load_json(os.path.join(rules.FACTS_DIR, "starter.json"))
    conv = rules.load_json(os.path.join(rules.FACTS_DIR, "conversion-log.json"))["stables"]
    logs = {l["catalogueKey"]: l for l in conv}
    try:
        decisions = convert.load_decisions()
    except convert.ConversionError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    register = {rec["number"]: rec for rec in decisions.get("_decisions") or []}

    try:
        records = source_records.load_all()
    except source_records.SourceError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    F = Findings()
    norms = []
    dec_norms = []
    for src in records:
        key = src["catalogueKey"]
        if src["_origin"] == "review":
            if src["_sourceFile"] != f"automaton-blueprints/{key}.json":
                F.add("V01", key, f"file name {src['_sourceFile']} differs from catalogueKey")
        else:
            folder = src["_sourceFile"].split("/")[1]
            if folder != f"{src['number']:03d}-{key}":
                F.add("V01", key, f"folder {folder} differs from number {src['number']} and catalogueKey")
        norms.append(normalise_source(src, logs.get(key)))
        # Decided view: decisions applied, alternatives dropped (decision 2: no backup blueprints).
        decided = dict(convert.apply_decisions(src, decisions.get(key)))
        decided.pop("alternativeBlueprints", None)
        dec_norms.append(normalise_source(decided, logs.get(key), final_overrides=True))

    cons = consistency_checks(norms, F)
    for n in norms:
        rule_checks(n, "source", F, facts, W)
        if n["strategy"] is None:  # unmapped strategy (Squadron): only its V06 finding
            continue
        lg = logs[n["key"]]["override"]
        if lg["written"]:
            F.add("V08", n["key"], f"targetOverrides {json.dumps(lg['source'])} → {json.dumps(lg['written'])} "
                  f"(final robots goal {lg['finalRobotsGoal']}, default {lg['default']}, allowed "
                  f"{lg['allowed'][0]}–{lg['allowed'][1]})")
        if lg["blocking"]:
            F.add("V08", n["key"], lg["blocking"], cls=BLOCKING)
    global_name_checks(norms, starter, "source", F)
    stats = analytical_checks(norms, starter, F, facts, W, logs)
    source_detail_checks(norms, F, facts, W)
    starter_keys = [s["catalogueKey"] for s in starter["stables"]]
    img = image_checks(norms, F, starter_keys)
    report_claims(F, list(F.items), {n["key"] for n in norms if n["raw"]["_origin"] == "review"})

    # decided pass: the analytical checks again with the recorded decisions applied
    D = Findings(scope="decided")
    dec_stats = analytical_checks(dec_norms, starter, D, facts, W, logs, decided=True)
    stats["acceptedDesignations"] = dec_stats["acceptedDesignations"]
    stats["decided"] = {k: dec_stats[k] for k in ("genericTeamNames", "genericRobotNames", "teamNames",
                                                  "distribution")}

    # catalogue/ re-validation
    C = Findings()
    cat_norms = []
    cat_files = sorted(f for f in os.listdir(rules.CATALOGUE_DIR) if f.endswith(".json"))
    for f in cat_files:
        try:
            e = rules.load_json(os.path.join(rules.CATALOGUE_DIR, f))
        except json.JSONDecodeError as exc:
            C.add("V00", f, f"does not parse: {exc}", scope="catalogue")
            continue
        check_shape(e, C)
        if f != f"{e.get('catalogueKey')}.json":
            C.add("V01", e.get("catalogueKey"), f"file name {f} differs from catalogueKey", scope="catalogue")
        cat_norms.append(normalise_catalogue(e))
    for n in cat_norms:
        rule_checks(n, "catalogue", C, facts, W)
    global_name_checks(cat_norms, starter, "catalogue", C)
    stats["builtCheck"] = built_checks(cat_files, C)
    stats["portraitAlignment"] = portrait_alignment(norms, dec_norms, decisions, F, C, D)

    items = F.items
    cat_items = C.items
    dec_items = D.items
    stats["catalogueEntries"] = [rules.load_json(os.path.join(rules.CATALOGUE_DIR, f)) for f in cat_files]
    blocks = generated_blocks(items, cat_items, norms, stats, img, cons, conv, dec_items, register, starter)
    missing_markers = write_findings_md(blocks)
    stats.pop("catalogueEntries")
    src_items = [i for i in items if i["scope"] == "source"]
    rules.write_json(os.path.join(rules.REVIEW_DIR, "findings.json"), {
        "generatedBy": "tools/validate.py",
        "summary": {
            "sourceStables": len(norms), "sourceBlueprints": sum(len(n["blueprints"]) for n in norms),
            "sourceStablesByOrigin": dict(sorted(collections.Counter(n["raw"]["_origin"] for n in norms).items())),
            "catalogueFiles": len(cat_files),
            "byClass": dict(collections.Counter(i["class"] for i in src_items)),
            "byCheck": dict(sorted(collections.Counter(i["check"] for i in src_items).items())),
            "catalogueResidualByCheck": dict(sorted(collections.Counter(i["check"] for i in cat_items).items())),
            "decidedResidualByCheck": dict(sorted(collections.Counter(i["check"] for i in dec_items).items())),
        },
        "stats": stats, "images": img, "consistency": cons,
        "findings": items, "catalogueFindings": cat_items, "decidedFindings": dec_items,
    })

    # stdout summary (build-notes copy this)
    by_class = collections.Counter(i["class"] for i in src_items)
    print(f"source: {len(norms)} stables, {sum(len(n['blueprints']) for n in norms)} blueprints; "
          f"catalogue/: {len(cat_files)} files")
    print(f"source findings: {len(src_items)} total — Blocking {by_class.get(BLOCKING, 0)}, "
          f"Needs product-owner decision {by_class.get(PO, 0)}, Cosmetic {by_class.get(COSMETIC, 0)}")
    for cid in CHECKS:
        n_ = sum(1 for i in src_items if i["check"] == cid)
        r_ = sum(1 for i in cat_items if i["check"] == cid)
        d_ = sum(1 for i in dec_items if i["check"] == cid)
        if n_ or r_ or d_:
            print(f"  {cid}: {n_:>4} source   {r_:>3} catalogue/   {d_:>4} after decisions")
    bc = stats["builtCheck"]
    print(f"built check: pendingWholeWord {bc.get('pendingWholeWord')}; failures {bc.get('failures', 'n/a')}; "
          f"projections {bc.get('projections', {}).get('passed', 'n/a')}/{bc.get('projections', {}).get('checked', 'n/a')}")
    resid = [i for i in cat_items if i["class"] == BLOCKING]
    fixable = [i for i in resid if CHECKS[i["check"]][3] == "yes"]
    print(f"catalogue/ residual Blocking: {len(resid)} (mechanically fixable but not fixed: {len(fixable)})")
    for name in missing_markers:
        print(f"ERROR: FINDINGS.md lacks generated:{name} markers", file=sys.stderr)
    return 1 if fixable or missing_markers else 0


def check_readme() -> int:
    """README gate: PO check IDs named, one ticked box per §4 decision, a Decisions
    entry per decision, register numbers 1..max without a gap, and every decided residual check mapped.
    The expected decision numbers come from the tools/decisions.json register."""
    try:
        register = convert.load_decisions().get("_decisions") or []
    except convert.ConversionError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    numbers = sorted(rec["number"] for rec in register)
    expected = list(range(1, (max(numbers) if numbers else 0) + 1))
    data = rules.load_json(os.path.join(rules.REVIEW_DIR, "findings.json"))
    po = sorted({i["check"] for i in data["findings"] if i["class"] == PO})
    text = open(os.path.join(rules.REVIEW_DIR, "README.md"), encoding="utf-8").read()
    problems = []
    missing = [c for c in po if c not in text]
    print(f"PO-class checks: {po}; missing from README.md: {missing or 'none'}")
    if missing:
        problems.append(f"PO checks not named in README.md: {missing}")

    # (a) §4: exactly one '- [x]' per numbered decision of the register.
    m4 = re.search(r"^## 4\..*?$(.*?)^### Decisions", text, re.M | re.S)
    items = {}
    if m4:
        parts = re.split(r"^(\d+)\. \*\*", m4.group(1), flags=re.M)
        for num, body in zip(parts[1::2], parts[2::2]):
            items[int(num)] = len(re.findall(r"- \[[xX]\]", body))
    else:
        problems.append("README.md has no '## 4.' section followed by '### Decisions'")
    bad_ticks = {n: items.get(n, "missing") for n in expected if items.get(n) != 1}
    print(f"§4 decisions with exactly one ticked box: {sum(1 for n in expected if items.get(n) == 1)}"
          f"/{len(expected)}; wrong: {bad_ticks or 'none'}")
    if bad_ticks:
        problems.append(f"§4 decisions without exactly one '- [x]' (ticked count): {bad_ticks}")

    # (b) '### Decisions' list has an entry per register decision.
    md = re.search(r"^### Decisions\s*$(.*?)(?=^---|^## |\Z)", text, re.M | re.S)
    listed = {int(n) for n in re.findall(r"^(\d+)\. ", md.group(1), re.M)} if md else set()
    absent = [n for n in expected if n not in listed]
    print(f"Decisions list entries: {sorted(listed)}; missing: {absent or 'none'}")
    if absent:
        problems.append(f"Decisions list lacks entries {absent}")

    # (c) tools/decisions.json register numbers run from 1 to their maximum without a gap.
    print(f"decisions.json register: {len(register)} entries {numbers}")
    if not numbers or numbers != expected:
        problems.append(f"decisions.json register numbers must run from 1 without a gap, has {numbers}")

    # (d) every decided residual check is answered by a register entry.
    answered = {c for rec in register for c in rec.get("checks", [])}
    residual = sorted((data.get("summary", {}).get("decidedResidualByCheck") or {}).keys())
    unmapped = [c for c in residual if c not in answered]
    print(f"decided residual checks: {residual}; not in any register entry: {unmapped or 'none'}")
    if unmapped:
        problems.append(f"decided residual checks without a register decision: {unmapped}")

    for p in problems:
        print(f"MISSING: {p}")
    return 1 if problems else 0


# Hard-coded-count scan of --check-spec (decision 20): the hand-written spec documents and the README
# derive every catalogue count from source/ and every starter count from tools/facts/starter.json (the
# built starter catalogue), and point to the generated Totals block. No bypass marker.
COUNT_SCAN_DOCS = ("requirements.md", "design.md", "tasks.md", "review/README.md")
# Catalogue counts of earlier baselines (the 12–100 draft and its totals).
STALE_COUNT_BASELINES = (89, 100, 189, 257, 326, 376, 720)
# A number is a catalogue count when one of these starts within the three words after it.
COUNT_NOUNS = ("stables", "Expansion_Stables", "Catalogue_Entries", "entries", "blueprints", "Robot_Blueprints",
               "robots", "team names", "names", "portraits", "images", "slots", "Draft_Automatons",
               "Active_Automatons", "starters", "Starter_Stables", "Automaton_Stables", "Catalogue_Keys", "keys",
               "files", "folders", "plans", "Refinement_Plans")
# "N/M" pairs (decision-35/36, ratios) are left to COUNT_RATIO_RE.
COUNT_NUMBER_RE = re.compile(r"(?<![\w.,/])(\d{1,3}(?:,\d{3})+|\d+)(?![\w,]*\d)(?!/\d)")
# A derived total typed as a selftest ratio ("50/50") or as a term of shell arithmetic ("$(( 11 + staged ))").
COUNT_RATIO_RE = re.compile(r"(?<![\w.,/])(\d+)/(\d+)(?![\w/])")
COUNT_ARITH_RE = re.compile(r"\$\(\(\s*(\d+)\s*[-+*]|[-+*]\s*(\d+)\s*\)\)")
STABLE_RANGE_RE = re.compile(r"(?<!\d)(?<!\d\.)(?:12[–-](?:100|205)|101[–-]205)(?!\d)(?!\.\d)")
WORD_STRIP = "`*_()[]{},.;:!?\"'—–-/"


def read_spec_doc(rel: str) -> str:
    """One hand-written spec document, relative to the spec folder (replaced in the negative test)."""
    return open(os.path.join(rules.SPEC57_DIR, rel), encoding="utf-8").read()


def derived_count_totals() -> Dict[str, int]:
    """The current catalogue totals, derived from review/findings.json, catalogue/ and the starter facts."""
    data = rules.load_json(os.path.join(rules.REVIEW_DIR, "findings.json"))
    starter = rules.load_json(os.path.join(rules.FACTS_DIR, "starter.json"))
    summary = data["summary"]

    def teams(e: dict) -> int:
        return len(e["teamNames"]["twoVsTwo"]) + len(e["teamNames"]["threeVsThree"])

    s_stables = starter.get("stables", [])
    exp_teams = sum(teams(rules.load_json(os.path.join(rules.CATALOGUE_DIR, f)))
                    for f in sorted(os.listdir(rules.CATALOGUE_DIR)) if f.endswith(".json"))
    s_teams = sum(teams(s) for s in s_stables)
    s_blueprints = sum(len(s["blueprints"]) for s in s_stables)
    return {
        "starter stables": len(s_stables),
        "starter blueprints": s_blueprints,
        "starter team names": s_teams,
        "Expansion_Stables": summary["sourceStables"],
        "starters + Expansion_Stables": len(s_stables) + summary["sourceStables"],
        "expansion blueprints": summary["sourceBlueprints"],
        "all blueprints": s_blueprints + summary["sourceBlueprints"],
        "expansion team names": exp_teams,
        "all team names": s_teams + exp_teams,
        "expansion portraits": data["images"]["present"],
    }


def count_noun_follows(text: str) -> Optional[str]:
    """The COUNT_NOUNS entry that starts within the first three words of ``text``, or None."""
    words = [w.strip(WORD_STRIP) for w in text.split()[:4]]
    for i in range(min(3, len(words))):
        for noun in COUNT_NOUNS:
            parts = noun.split()
            cand = [w.lower() for w in words[i:i + len(parts)]]
            if cand == [p.lower() for p in parts]:
                return noun
    return None


def count_scan(docs: Dict[str, str], totals: Dict[str, int]) -> List[str]:
    """file:line hits for a hard-coded catalogue count or stable range in the hand-written documents."""
    numbers = set(totals.values()) | set(STALE_COUNT_BASELINES)
    hits = []
    for rel, text in docs.items():
        for m in COUNT_NUMBER_RE.finditer(text):
            value = int(m.group(1).replace(",", ""))
            if value not in numbers:
                continue
            noun = count_noun_follows(text[m.end():m.end() + 200])
            if noun is None:
                continue
            line = text.count("\n", 0, m.start()) + 1
            hits.append(f"{rel}:{line}: count {m.group(1)} followed by '{noun}'")
        for m in COUNT_RATIO_RE.finditer(text):
            if m.group(1) == m.group(2) and int(m.group(1)) in numbers:
                line = text.count("\n", 0, m.start()) + 1
                hits.append(f"{rel}:{line}: count ratio {m.group(0)}")
        for m in COUNT_ARITH_RE.finditer(text):
            value = m.group(1) or m.group(2)
            if int(value) in numbers:
                line = text.count("\n", 0, m.start()) + 1
                hits.append(f"{rel}:{line}: count {value} in shell arithmetic")
        for m in STABLE_RANGE_RE.finditer(text):
            line = text.count("\n", 0, m.start()) + 1
            hits.append(f"{rel}:{line}: stable range {m.group(0)}")
    return hits


def check_spec() -> int:
    req = read_spec_doc("requirements.md")
    tasks = read_spec_doc("tasks.md")
    design = read_spec_doc("design.md")
    criteria = []
    for m in re.finditer(r"^### Requirement (\d+)", req, re.M):
        num = m.group(1)
        block = req[m.end():].split("\n### ")[0]
        for c in re.findall(r"^(\d+)\. ", block, re.M):
            criteria.append(f"{num}.{c}")
    traced = set()
    for line in tasks.splitlines():
        if "_Requirements:" in line:
            traced.update(re.findall(r"R(\d+\.\d+)(?![\d.])", line))
    in_design = set(re.findall(r"\bR(\d+\.\d+)\b", design))
    missing_tasks = [c for c in criteria if c not in traced]
    missing_design = [c for c in criteria if c not in in_design]
    optional = re.findall(r"^- \[ \]\*", tasks, re.M)
    print(f"criteria: {len(criteria)}; not traced in tasks: {missing_tasks or 'none'}; "
          f"not mapped in design: {missing_design or 'none'}; optional tasks: {len(optional)}")
    try:
        totals = derived_count_totals()
    except (OSError, KeyError, ValueError) as exc:
        print(f"ERROR: count scan needs review/findings.json, catalogue/ and tools/facts/starter.json "
              f"(run validate.py first): {exc}", file=sys.stderr)
        return 1
    hits = count_scan({rel: read_spec_doc(rel) for rel in COUNT_SCAN_DOCS}, totals)
    print(f"count scan over {', '.join(COUNT_SCAN_DOCS)}: derived totals "
          f"{', '.join(f'{k} {v}' for k, v in totals.items())}; stale baselines "
          f"{', '.join(str(n) for n in STALE_COUNT_BASELINES)}; hits: {len(hits)}")
    for hit in hits:
        print(f"HARD-CODED COUNT: {hit}")
    return 1 if missing_tasks or missing_design or optional or hits else 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check-readme", action="store_true")
    ap.add_argument("--check-spec", action="store_true")
    args = ap.parse_args()
    if args.check_readme:
        return check_readme()
    if args.check_spec:
        return check_spec()
    return run()


if __name__ == "__main__":
    sys.exit(main())
