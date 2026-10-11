#!/usr/bin/env python3
"""Convert every source stable into spec-55 design §15.1 Catalogue_Entries.

Reads  every Expansion_Stable in source/ through source_records.load_all():
         source/automaton-blueprints/{key}.json (review format) and
         source/collection/{NNN}-{key}/stable.json (collection format, mapped to the review format)
Writes catalogue/{key}.json               (exact §15.1 shape, 2-space indent)
       tools/facts/conversion-log.json    (origin, source file, dropped fields, override
                                            conversion, source plan vs generated plan)

Product-owner decisions (README §4) are recorded in the optional
tools/decisions.json — the ``_decisions`` register plus per-key overlays, each
naming the register numbers it implements (validate_decisions) — and overlaid
on the source record before conversion (apply_decisions); the source files are
never edited. Unknown keys, fields or decision numbers fail the run. Decided
Goal_Targets (``targetOverrides`` by Build_Order position, README decision 5)
are merged over the converted source override (apply_target_decisions); an
invalid decided value fails the run.

Conversion is mechanical. The only content that is generated rather than
copied is the Refinement_Plan (plan decision D2: the source plans are empty or
misordered; the decision-35/36 generator is proven on the approved starter
plans). Everything else is copied as is; defects are reported by validate.py,
not fixed here.

Fails loudly (exit 1) on an unknown strategy name, an unknown
targetOverrides key or an invalid decided Goal_Target.

Usage: python3 convert.py
"""

from __future__ import annotations

import copy
import os
import re
import sys
from typing import Dict, Optional

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import refine_plan  # noqa: E402
import rules  # noqa: E402
import source_records  # noqa: E402

DROPPED_TOP = ["number", "fit", "conceptIdentity", "openingRobots", "targetRobots", "adminMaximumRobots",
               "review", "alternativeBlueprints"]
DROPPED_ROBOT = ["blueprintId", "sourceAlias", "nameBasis", "availability", "review"]
SOURCE_TIER = {"Sharpen": "sharpen", "Forge": "forge", "Hone": "hone", "Augment": "augment"}


class ConversionError(Exception):
    pass


def convert_overrides(src: dict, strategy: str, blueprint_count: int):
    """targetOverrides {robots: N} -> {"<final robots goal position>": N} when N differs from the default."""
    raw = src.get("targetOverrides") or {}
    unknown = sorted(set(raw) - {"robots"})
    if unknown:
        raise ConversionError(f"{src['catalogueKey']}: unknown targetOverrides keys {unknown}")
    n = raw.get("robots", src.get("targetRobots"))
    pos, default, lo, hi = rules.final_robots_goal(strategy)
    log = {"source": raw, "targetRobots": src.get("targetRobots"), "finalRobotsGoal": pos,
           "default": default, "allowed": [lo, hi], "written": {}, "blocking": None}
    if n is None:
        return {}, log
    n = int(n)
    earlier_max = max([g[1] for g in rules.ROBOTS_GOALS[strategy][:-1]] or [0])
    if not lo <= n <= hi:
        log["blocking"] = f"robots {n} outside goal {pos} Allowed {lo}–{hi}; not written"
        return {}, log
    if n < earlier_max:
        log["blocking"] = f"robots {n} below an earlier robots goal default {earlier_max}; not written"
        return {}, log
    if n != default:
        log["written"] = {str(pos): n}
        return {str(pos): n}, log
    return {}, log


def convert_stage(stage: dict) -> dict:
    out = {"main": stage.get("mainWeapon")}
    if stage.get("offhandWeapon") is not None:
        out["offhand"] = stage["offhandWeapon"]
    return out


def source_plan_as_steps(robot: dict) -> list:
    out = []
    for s in robot.get("refinementPlan") or []:
        step = {"tier": SOURCE_TIER.get(s.get("tier"), str(s.get("tier")).lower()),
                "hand": s.get("weaponSlot"), "magnitude": s.get("magnitude", 1)}
        if s.get("attribute"):
            step["targetAttribute"] = rules.display_attribute_to_key(s["attribute"]) or s["attribute"]
        out.append(step)
    return out


DECISIONS_PATH = os.path.join(rules.TOOLS_DIR, "decisions.json")
REGISTER_FIELDS = {"number": int, "checks": list, "answer": str, "changesContent": bool, "delegated": bool,
                   "date": str}
CONTENT_FIELDS = ("stableName", "franchiseLabel", "backstory", "teamNames", "robots", "useAlternative",
                  "targetOverrides", "strategy")
TARGET_POSITION_RE = re.compile(r"^[1-9]\d?$")
ROBOT_FIELDS = ("name", "artBrief", "designation", "portrait")
DESIGNATIONS = ("canon", "mass-produced")
PORTRAIT_VERDICTS = ("aligned", "new-portrait-needed")


def validate_decisions(decisions: dict, known_keys) -> Dict[int, dict]:
    """Check the decisions.json contract; return the register by decision number.

    Top level: ``_comment`` (str), ``_decisions`` (register: one record per README §4 decision,
    {number ≥ 1 and unique, checks [ids], answer, changesContent, delegated, date YYYY-MM-DD}; that the
    numbers run 1..max without a gap is checked by validate.py --check-readme), then
    Catalogue_Keys. A per-key overlay lists in ``_decisions`` the register numbers (changesContent
    true) it implements; it is required whenever a content field is present.
    """
    if not isinstance(decisions, dict):
        raise ConversionError("decisions.json: top level must be an object")
    if "_comment" in decisions and not isinstance(decisions["_comment"], str):
        raise ConversionError("decisions.json: _comment must be a string")
    register: Dict[int, dict] = {}
    for i, rec in enumerate(decisions.get("_decisions") or []):
        if not isinstance(rec, dict) or set(rec) != set(REGISTER_FIELDS):
            raise ConversionError(f"decisions.json: _decisions[{i}] must have exactly the fields "
                                  f"{sorted(REGISTER_FIELDS)}")
        for field, kind in REGISTER_FIELDS.items():
            if not isinstance(rec[field], kind) or (kind is int and isinstance(rec[field], bool)):
                raise ConversionError(f"decisions.json: _decisions[{i}].{field} must be {kind.__name__}")
        if rec["number"] < 1 or rec["number"] in register:
            raise ConversionError(f"decisions.json: _decisions[{i}].number {rec['number']} is below 1 or repeats")
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", rec["date"]):
            raise ConversionError(f"decisions.json: _decisions[{i}].date {rec['date']!r} is not YYYY-MM-DD")
        if not all(isinstance(c, str) for c in rec["checks"]):
            raise ConversionError(f"decisions.json: _decisions[{i}].checks must list check ids")
        register[rec["number"]] = rec
    unknown = sorted(set(decisions) - set(known_keys) - {"_comment", "_decisions"})
    if unknown:
        raise ConversionError(f"decisions.json names unknown keys {unknown}")
    for key, decision in decisions.items():
        if key.startswith("_"):
            continue
        if not isinstance(decision, dict):
            raise ConversionError(f"decisions.json: {key} must be an object")
        bad = sorted(set(decision) - set(CONTENT_FIELDS) - {"_decisions"})
        if bad:
            raise ConversionError(f"decisions.json: {key} has unknown fields {bad}")
        numbers = decision.get("_decisions")
        has_content = any(f in decision for f in CONTENT_FIELDS)
        if has_content and not numbers:
            raise ConversionError(f"decisions.json: {key} changes content but lists no _decisions")
        for n in numbers or []:
            rec = register.get(n) if isinstance(n, int) and not isinstance(n, bool) else None
            if rec is None:
                raise ConversionError(f"decisions.json: {key} names unknown decision {n!r}")
            if not rec["changesContent"]:
                raise ConversionError(f"decisions.json: {key} names decision {n}, which changes no content")
    return register


def load_decisions() -> dict:
    """tools/decisions.json, contract-checked ({} when the file is absent)."""
    if not os.path.exists(DECISIONS_PATH):
        return {}
    decisions = rules.load_json(DECISIONS_PATH)
    try:
        keys = source_records.known_keys()
    except source_records.SourceError as exc:
        raise ConversionError(str(exc))
    validate_decisions(decisions, keys)
    return decisions


def apply_decisions(src: dict, decision: Optional[dict]) -> dict:
    """Overlay recorded product-owner decisions (tools/decisions.json) on a source record.

    Shape per catalogueKey (every part optional except ``_decisions`` with content):
      { "_decisions": [int, ...],                                      # register numbers implemented
        "stableName": str, "franchiseLabel": str, "backstory": str,
        "teamNames": {"2v2": [str, ...], "3v3": [str, ...]},          # names in Team_Rule order
        "robots": {"<slot>": {"name"?: str, "artBrief"?: str, "designation"?: "canon"|"mass-produced",
                              "portrait"?: "aligned"|"new-portrait-needed"}},
        "useAlternative": {"<slot>": "<alternative robot name>"},
        "strategy": "<display name>",                                 # a rules.STRATEGY_DISPLAY_TO_KEY key
        "targetOverrides": {"<goal position>": int} }                 # decided Goal_Targets
    ``name`` sets the robot name, ``artBrief`` the source review art brief (other review fields kept),
    ``designation`` marks an accepted numbered name (``_designation``, read by validate.py, never
    written to catalogue/), ``portrait`` records the portrait check of decision 18 (``_portrait``,
    never written to catalogue/). ``strategy`` replaces the source strategy display name.
    ``targetOverrides`` is kept as ``_targetOverrides`` (never written as
    such; apply_target_decisions merges it into the converted override). The source files
    themselves are never edited.
    """
    if not decision:
        return src
    key = src["catalogueKey"]
    bad = sorted(set(decision) - set(CONTENT_FIELDS) - {"_decisions"})
    if bad:
        raise ConversionError(f"{key}: decisions has unknown fields {bad}")
    out = copy.deepcopy(src)
    for field in ("stableName", "franchiseLabel", "backstory"):
        if field in decision:
            if not isinstance(decision[field], str):
                raise ConversionError(f"{key}: decisions {field} must be a string")
            out[field] = decision[field]
    if "strategy" in decision:
        if decision["strategy"] not in rules.STRATEGY_DISPLAY_TO_KEY:
            raise ConversionError(f"{key}: decisions strategy {decision['strategy']!r} must be one of "
                                  f"{sorted(rules.STRATEGY_DISPLAY_TO_KEY)}")
        out["strategy"] = decision["strategy"]
    bad_sizes = sorted(set(decision.get("teamNames") or {}) - {"2v2", "3v3"})
    if bad_sizes:
        raise ConversionError(f"{key}: decisions teamNames has unknown sizes {bad_sizes}")
    for size, names in (decision.get("teamNames") or {}).items():
        teams = sorted(out["teamNames"].get(size, []), key=lambda t: t["slots"][0])
        if len(names) != len(teams):
            raise ConversionError(f"{src['catalogueKey']}: decisions teamNames.{size} has {len(names)} names, "
                                  f"source has {len(teams)} teams")
        for t, n in zip(teams, names):
            t["name"] = n
        out["teamNames"][size] = teams
    for slot, alt_name in (decision.get("useAlternative") or {}).items():
        alt = next((a for a in out.get("alternativeBlueprints", []) if a["slot"] == int(slot) and a["name"] == alt_name), None)
        if alt is None:
            raise ConversionError(f"{src['catalogueKey']}: no alternative {alt_name!r} for slot {slot}")
        out["robots"] = [alt if r["slot"] == int(slot) else r for r in out["robots"]]
    for slot, fields in (decision.get("robots") or {}).items():
        robot = next((r for r in out["robots"] if str(r["slot"]) == str(slot)), None)
        if robot is None:
            raise ConversionError(f"{key}: decisions name unknown slot {slot}")
        if not isinstance(fields, dict):
            raise ConversionError(f"{key}: decisions robots.{slot} must be an object")
        bad = sorted(set(fields) - set(ROBOT_FIELDS))
        if bad:
            raise ConversionError(f"{key}: decisions robots.{slot} has unknown fields {bad}")
        if "name" in fields:
            robot["name"] = fields["name"]
        if "artBrief" in fields:
            robot["review"] = dict(robot.get("review") or {}, artBrief=fields["artBrief"])
        if "designation" in fields:
            if fields["designation"] not in DESIGNATIONS:
                raise ConversionError(f"{key}: decisions robots.{slot}.designation must be one of {DESIGNATIONS}")
            robot["_designation"] = fields["designation"]
        if "portrait" in fields:
            if fields["portrait"] not in PORTRAIT_VERDICTS:
                raise ConversionError(f"{key}: decisions robots.{slot}.portrait must be one of {PORTRAIT_VERDICTS}")
            robot["_portrait"] = fields["portrait"]
    if "targetOverrides" in decision:
        targets = decision["targetOverrides"]
        if not isinstance(targets, dict) or not targets:
            raise ConversionError(f"{key}: decisions targetOverrides must be a non-empty object")
        for pos, value in targets.items():
            if not TARGET_POSITION_RE.fullmatch(str(pos)):
                raise ConversionError(f"{key}: decisions targetOverrides key {pos!r} is not a goal position")
            if not isinstance(value, int) or isinstance(value, bool):
                raise ConversionError(f"{key}: decisions targetOverrides.{pos} must be an integer")
        out["_targetOverrides"] = dict(targets)
    return out


def apply_target_decisions(key: str, strategy: str, overrides: Dict[str, int], decided: Optional[Dict[str, int]],
                           blueprint_count: int):
    """Merge decided Goal_Targets over the converted source override (README decision 5).

    Keys are Build_Order positions. Raises ConversionError on an unknown position, a value outside the
    Goal's bounds, a robots target above the blueprint count (R3.7) or a final robots target below an
    earlier robots goal. Values equal to the Goal default are dropped; keys are sorted by position.
    Returns (merged overrides, log record).
    """
    if not decided:
        return dict(overrides), None
    goals = {g["position"]: g for g in rules.STRATEGIES[strategy]["buildOrder"]}
    merged = dict(overrides)
    for pos, value in decided.items():
        goal = goals.get(int(pos))
        if goal is None:
            raise ConversionError(f"{key}: decided targetOverrides names unknown goal position {pos}")
        lo, hi = goal["bounds"]["min"], goal["bounds"]["max"]
        if not lo <= value <= hi:
            raise ConversionError(f"{key}: decided goal {pos} target {value} outside Allowed {lo}–{hi}")
        merged[str(pos)] = value
    merged = {p: v for p, v in sorted(merged.items(), key=lambda kv: int(kv[0]))
              if v != goals[int(p)]["defaultTarget"]}
    robots = rules.effective_robots_targets(strategy, merged)
    for pos, n in robots.items():
        if n > blueprint_count:
            raise ConversionError(f"{key}: decided goal {pos} targets {n} robots, but the stable has "
                                  f"{blueprint_count} blueprints (R3.7)")
    final_pos = rules.final_robots_goal(strategy)[0]
    earlier = [n for pos, n in robots.items() if pos != final_pos]
    if earlier and robots[final_pos] < max(earlier):
        raise ConversionError(f"{key}: decided final robots target {robots[final_pos]} is below an earlier "
                              f"robots goal ({max(earlier)})")
    return merged, {"requested": dict(decided), "written": merged}


def convert_stable(src: dict, facts: dict, weapons: "rules.Weapons", decision: Optional[dict] = None):
    src = apply_decisions(src, decision)
    key = src["catalogueKey"]
    display = src.get("strategy")
    if display not in rules.STRATEGY_DISPLAY_TO_KEY:
        raise ConversionError(f"{key}: unknown strategy {display!r}")
    strategy = rules.STRATEGY_DISPLAY_TO_KEY[display]
    robots_src = sorted(src["robots"], key=lambda r: r["slot"])
    source_overrides, ov_log = convert_overrides(src, strategy, len(robots_src))
    overrides, decided_log = apply_target_decisions(key, strategy, source_overrides, src.get("_targetOverrides"),
                                                    len(robots_src))
    robots_at_target = rules.effective_final_robots(strategy, overrides)

    def team_names(size_key: str) -> list:
        teams = sorted(src.get("teamNames", {}).get(size_key, []), key=lambda t: (t.get("slots") or [99])[0])
        return [t["name"] for t in teams]

    blueprints = []
    plan_log = []
    for r in robots_src:
        path = [convert_stage(s) for s in r["weaponPath"]]
        final = path[-1]
        build_focus = str(r.get("buildFocus", "")).lower()
        known = all(weapons.get(n) for n in final.values() if n) and build_focus in rules.BUILD_FOCUS_WEIGHTS
        plan = (refine_plan.generate(facts, weapons, strategy, robots_at_target, build_focus,
                                     r["loadout"], final) if known else [])
        blueprints.append({
            "slot": r["slot"],
            "robotName": r["name"],
            "loadoutType": r["loadout"],
            "stance": r["stance"],
            "yieldThreshold": r["yieldThreshold"],
            "buildFocus": build_focus,
            "weaponPath": path,
            "refinementPlan": plan,
        })
        plan_log.append({
            "slot": r["slot"], "robotName": r["name"],
            "sourceSteps": len(r.get("refinementPlan") or []),
            "generatedSteps": len(plan),
            "identical": source_plan_as_steps(r) == plan,
            "generatorSkipped": not known,
        })

    entry = {
        "schemaVersion": 1,
        "catalogueKey": key,
        "stableName": src["stableName"],
        "franchise": src["franchiseLabel"],
        "backstory": src["backstory"],
        "strategy": {"key": strategy, "version": 1, "targetOverrides": overrides},
        "teamNames": {"twoVsTwo": team_names("2v2"), "threeVsThree": team_names("3v3")},
        "eventOrder": list(src["eventOrder"]),
        "blueprints": blueprints,
    }
    log = {
        "catalogueKey": key,
        "strategy": {"source": display, "key": strategy},
        "droppedTopLevel": [f for f in DROPPED_TOP if f in src],
        "droppedPerRobot": sorted({f for r in robots_src for f in DROPPED_ROBOT if f in r}),
        "droppedAlternatives": len(src.get("alternativeBlueprints") or []),
        "override": ov_log,
        "targetOverrides": overrides,
        "decisionOverrides": decided_log,
        "robotsAtTarget": robots_at_target,
        "plans": plan_log,
    }
    return entry, log


def main() -> int:
    facts = rules.load_facts()
    weapons = rules.Weapons(facts)
    try:
        records = source_records.load_all()
        decisions = load_decisions()
    except (ConversionError, source_records.SourceError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    logs = []
    os.makedirs(rules.CATALOGUE_DIR, exist_ok=True)
    try:
        for src in records:
            decision = decisions.get(src["catalogueKey"])
            entry, log = convert_stable(src, facts, weapons, decision)
            log["decisionsApplied"] = sorted(f for f in decision if f != "_decisions") if decision else []
            log["decisionNumbers"] = sorted(decision.get("_decisions") or []) if decision else []
            rules.write_json(os.path.join(rules.CATALOGUE_DIR, f"{entry['catalogueKey']}.json"), entry)
            log["origin"] = src["_origin"]
            log["sourceFile"] = src["_sourceFile"]
            log["droppedSourceFields"] = list(src.get("_droppedSourceFields") or [])
            logs.append(log)
    except ConversionError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    rules.write_json(os.path.join(rules.FACTS_DIR, "conversion-log.json"), {"stables": logs})
    overrides = sum(1 for l in logs if l["override"]["written"])
    blocked = sum(1 for l in logs if l["override"]["blocking"])
    robots = sum(len(l["plans"]) for l in logs)
    print(f"converted {len(logs)} stables, {robots} blueprints -> catalogue/")
    print(f"  targetOverrides converted to goal positions: {overrides}; not written (blocking): {blocked}")
    print(f"  decided Goal_Targets: {sum(1 for l in logs if l['decisionOverrides'])} stables")
    print(f"  plans generated: {sum(1 for l in logs for p in l['plans'] if p['generatedSteps'])}; "
          f"generator skipped: {sum(1 for l in logs for p in l['plans'] if p['generatorSkipped'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
