#!/usr/bin/env python3
"""Build tools/facts/starter.json from the built spec-55 starter catalogue.

Decision 6: the built JSON (``$APP_ROOT/app/backend/prisma/automaton-catalogue``)
is the starter source of truth; its counts are derived, never typed in (decision 20). The approved spec-55
``review/CATALOGUE.md`` (§3–§13, under SPEC55_DIR) is still parsed, for the
review-only fields (art brief, range, plan cost, stated totals) and to list
every doc-vs-code difference field by field (the built JSON wins).

starter.json = built entries in CATALOGUE.md order, each blueprint with
``_review`` {artBrief, range, planCost}, each stable with ``_review``
{statedTotal}, plus ``docVsCode`` (list of differences).

Asserts: the built entries and the markdown stables are non-empty and agree in
stable and blueprint count, and every per-stable plan total stated in the prose
("All <n> robots: <s> steps, ₡<c> …") equals the parsed plan.

Usage: python3 parse_starter.py
"""

from __future__ import annotations

import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rules  # noqa: E402

CATALOGUE_MD = os.path.join(rules.SPEC55_DIR, "review", "CATALOGUE.md")


def money(text: str) -> int:
    return int(text.replace(",", ""))


def table_rows(lines):
    """Yield cell lists of a markdown table (skips the header separator)."""
    for line in lines:
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if all(re.fullmatch(r":?-+:?", c) for c in cells if c):
            continue
        yield cells


def parse_stage(cell: str) -> dict:
    cell = re.split(r" \(₡", cell)[0].strip()
    m = re.fullmatch(r"(.+?) \(main\) \+ (.+?) \(off\)", cell)
    if m:
        return {"main": m.group(1), "offhand": m.group(2)}
    m = re.fullmatch(r"(.+?) ×2", cell)
    if m:
        return {"main": m.group(1), "offhand": m.group(1)}
    if " + " in cell:
        a, b = cell.split(" + ", 1)
        return {"main": a, "offhand": b}
    return {"main": cell}


STEP_RE = re.compile(
    r"^(?P<num>\d+)(?:–(?P<num2>\d+))?\s+(?P<tier>Sharpen|Forge|Hone|Augment)"
    r"(?:\s+(?P<attr>[A-Za-z ]+?)\s+\+(?P<mag>\d+)(?: each)?(?:\s+\([^)]*\))?)?"
    r"\s+₡(?P<cost>[\d,]+)(?: each)?$"
)


def parse_steps(cell: str, hand: str):
    out = []
    for part in cell.split(" · "):
        part = part.strip()
        m = STEP_RE.match(part)
        if not m:
            raise ValueError(f"cannot parse step {part!r}")
        first = int(m.group("num"))
        last = int(m.group("num2") or first)
        tier = m.group("tier").lower()
        for n in range(first, last + 1):
            step = {"tier": tier, "hand": hand, "magnitude": int(m.group("mag") or 1)}
            if tier in ("hone", "augment"):
                key = rules.display_attribute_to_key(m.group("attr"))
                if key is None:
                    raise ValueError(f"unknown attribute in {part!r}")
                step["targetAttribute"] = key
            out.append((n, step, money(m.group("cost"))))
    return out


def parse_section(title: str, body: list) -> dict:
    m = re.match(r"## \d+\. (.+?) \(`([a-z0-9-]+)`\) — (\w+)", title)
    if not m:
        raise ValueError(title)
    stable_name, key, strategy_display = m.groups()
    fields = {}
    robots = []
    paths = {}
    plans = {}
    plan_costs = {}
    mode = None
    current_robot = None
    for line in body:
        if line.startswith("| Field |"):
            mode = "fields"
            continue
        if line.startswith("| Slot | Robot |"):
            mode = "robots"
            continue
        if line.startswith("| Slot | Stage 0 |"):
            mode = "paths"
            continue
        if line.startswith("| Robot | Weapon (hand) |"):
            mode = "plans"
            continue
        if not line.startswith("|"):
            if line.strip():
                mode = None if not line.startswith("|") else mode
            continue
        cells = next(iter(table_rows([line])), None)
        if cells is None:
            continue
        if mode == "fields":
            fields[cells[0]] = cells[1]
        elif mode == "robots":
            robots.append({
                "slot": int(cells[0]),
                "robotName": cells[1],
                "loadoutType": cells[2].strip("`"),
                "range": cells[3],
                "stance": cells[4],
                "yieldThreshold": int(cells[5]),
                "buildFocus": cells[6].lower(),
                "artBrief": cells[7],
            })
        elif mode == "paths":
            slot = int(cells[0].split()[0])
            paths[slot] = [parse_stage(cells[1]), parse_stage(cells[2])]
        elif mode == "plans":
            if cells[0]:
                rm = re.match(r"(.+?) \((\d+) steps, ₡([\d,]+)\)", cells[0])
                current_robot = rm.group(1)
                plans[current_robot] = []
                plan_costs[current_robot] = (int(rm.group(2)), money(rm.group(3)))
            wm = re.match(r"(.+?) \((main|offhand)\)", cells[1])
            plans[current_robot].extend(parse_steps(cells[2], wm.group(2)))

    # overrides
    ov = fields["Target overrides"]
    overrides = {}
    om = re.match(r"goal (\d+) Robots → (\d+)", ov)
    if om:
        overrides[om.group(1)] = int(om.group(2))
    elif not ov.startswith("none"):
        raise ValueError(f"unparsed override {ov!r}")

    teams = fields["Team names"]
    part2, part3 = teams.split(" · ")
    two = re.findall(r"\*\*(.+?)\*\*", part2)
    three = re.findall(r"\*\*(.+?)\*\*", part3)
    event_order = re.findall(r"`([a-z0-9_]+)`", fields["Event order"])

    blueprints = []
    by_name = {r["robotName"]: r for r in robots}
    for r in robots:
        steps = sorted(plans[r["robotName"]], key=lambda s: s[0])
        nums = [s[0] for s in steps]
        if nums != list(range(1, len(nums) + 1)):
            raise ValueError(f"{key} {r['robotName']}: plan step numbers {nums}")
        n_steps, cost = plan_costs[r["robotName"]]
        if n_steps != len(steps) or cost != sum(s[2] for s in steps):
            raise ValueError(f"{key} {r['robotName']}: stated {n_steps} steps ₡{cost} vs parsed")
        blueprints.append({
            "slot": r["slot"],
            "robotName": r["robotName"],
            "loadoutType": r["loadoutType"],
            "stance": r["stance"],
            "yieldThreshold": r["yieldThreshold"],
            "buildFocus": r["buildFocus"],
            "weaponPath": paths[r["slot"]],
            "refinementPlan": [s[1] for s in steps],
            "_review": {"artBrief": r["artBrief"], "range": r["range"], "planCost": cost},
        })
    assert set(by_name) == set(plans), key

    # stated stable totals
    text = "\n".join(body)
    tm = re.search(r"(?:All \d+ robots|Both robots)[^:\n]*: (\d+) steps, ₡([\d,]+)", text)
    if not tm:
        raise ValueError(f"{key}: stable plan total sentence not found")
    total_steps = sum(len(b["refinementPlan"]) for b in blueprints)
    total_cost = sum(b["_review"]["planCost"] for b in blueprints)
    if (int(tm.group(1)), money(tm.group(2))) != (total_steps, total_cost):
        raise ValueError(f"{key}: stated total {tm.group(0)!r} vs parsed {total_steps} steps ₡{total_cost}")

    return {
        "schemaVersion": 1,
        "catalogueKey": key,
        "stableName": fields["Stable name"],
        "franchise": fields["Franchise label"],
        "backstory": fields["Backstory"],
        "strategy": {"key": rules.STRATEGY_DISPLAY_TO_KEY[strategy_display], "version": 1, "targetOverrides": overrides},
        "teamNames": {"twoVsTwo": two, "threeVsThree": three},
        "eventOrder": event_order,
        "blueprints": blueprints,
        "_review": {"statedTotal": {"steps": total_steps, "credits": total_cost}},
    }


ENTRY_FIELDS = ["schemaVersion", "catalogueKey", "stableName", "franchise", "backstory", "strategy", "teamNames",
                "eventOrder"]
BLUEPRINT_FIELDS = ["robotName", "loadoutType", "stance", "yieldThreshold", "buildFocus", "weaponPath",
                    "refinementPlan"]


def parse_markdown() -> list:
    with open(CATALOGUE_MD, encoding="utf-8") as fh:
        lines = fh.read().splitlines()
    sections = []
    current = None
    for line in lines:
        if line.startswith("## "):
            current = [line, []]
            sections.append(current)
        elif current is not None:
            current[1].append(line)
    stables = []
    for title, body in sections:
        n = int(re.match(r"## (\d+)\.", title).group(1))
        if 3 <= n <= 13:
            stables.append(parse_section(title, body))
    assert stables, f"{CATALOGUE_MD}: no starter stable in §3–§13"
    return stables


def load_built() -> dict:
    # After Task Group 2 the repository folder also holds the delivered Expansion_Stables; a file
    # with a Staged_Entry of the same name in catalogue/ is one of them, not a starter.
    staged = set(os.listdir(rules.CATALOGUE_DIR)) if os.path.isdir(rules.CATALOGUE_DIR) else set()
    files = sorted(f for f in os.listdir(rules.STARTER_CATALOGUE_DIR) if f.endswith(".json") and f not in staged)
    built = {}
    for f in files:
        e = rules.load_json(os.path.join(rules.STARTER_CATALOGUE_DIR, f))
        built[e["catalogueKey"]] = e
    assert built, f"{rules.STARTER_CATALOGUE_DIR}: no starter entry"
    return built


def doc_vs_code(doc: dict, code: dict) -> list:
    """Every §15.1 field where the spec-55 markdown differs from the built JSON."""
    out = []
    key = code["catalogueKey"]
    for field in ENTRY_FIELDS:
        if doc.get(field) != code.get(field):
            out.append({"catalogueKey": key, "field": field, "doc": doc.get(field), "code": code.get(field)})
    doc_bps = {b["slot"]: b for b in doc["blueprints"]}
    code_bps = {b["slot"]: b for b in code["blueprints"]}
    for slot in sorted(set(doc_bps) | set(code_bps)):
        d, c = doc_bps.get(slot), code_bps.get(slot)
        if d is None or c is None:
            out.append({"catalogueKey": key, "field": f"blueprints[slot {slot}]",
                        "doc": None if d is None else d["robotName"], "code": None if c is None else c["robotName"]})
            continue
        for field in BLUEPRINT_FIELDS:
            if d.get(field) != c.get(field):
                out.append({"catalogueKey": key, "field": f"blueprints[slot {slot}].{field}",
                            "doc": d.get(field), "code": c.get(field)})
    return out


def main() -> int:
    doc_stables = parse_markdown()
    built = load_built()
    # The starter set is whatever the built folder and the spec-55 markdown both hold; they must agree.
    doc_robots = sum(len(s["blueprints"]) for s in doc_stables)
    built_robots = sum(len(e["blueprints"]) for e in built.values())
    assert (len(built), built_robots) == (len(doc_stables), doc_robots), (
        f"{rules.STARTER_CATALOGUE_DIR}: {len(built)} entries with {built_robots} blueprints, but "
        f"{CATALOGUE_MD} §3–§13 has {len(doc_stables)} stables with {doc_robots} robots")
    diffs = []
    doc_keys = [s["catalogueKey"] for s in doc_stables]
    for k in sorted(set(doc_keys) ^ set(built)):
        diffs.append({"catalogueKey": k, "field": "(entry)", "doc": k in doc_keys, "code": k in built})
    stables = []
    # Markdown order (§3–§13), built content; entries only one side has are reported above.
    for doc in doc_stables:
        code = built.get(doc["catalogueKey"])
        if code is None:
            continue
        diffs.extend(doc_vs_code(doc, code))
        review = {b["slot"]: b["_review"] for b in doc["blueprints"]}
        entry = dict(code)
        entry["blueprints"] = [dict(b, _review=review[b["slot"]]) if b["slot"] in review else dict(b)
                               for b in code["blueprints"]]
        entry["_review"] = doc["_review"]
        stables.append(entry)
    for k in sorted(set(built) - set(doc_keys)):
        stables.append(built[k])
    robots = sum(len(s["blueprints"]) for s in stables)
    out = os.path.join(rules.FACTS_DIR, "starter.json")
    rules.write_json(out, {
        "source": f"{rules.repo_relative(rules.STARTER_CATALOGUE_DIR)}/*.json (built, authoritative); "
                  f"_review from {rules.repo_relative(CATALOGUE_MD)} §3–§13",
        "docVsCode": diffs,
        "stables": stables,
    })
    for s in stables:
        t = s.get("_review", {}).get("statedTotal", {"steps": 0, "credits": 0})
        print(f"  {s['catalogueKey']:<22} {len(s['blueprints']):>2} robots  {t['steps']:>3} steps  ₡{t['credits']:,}")
    print(f"starter.json: {len(stables)} stables, {robots} robots (built JSON); all stated plan totals match")
    print(f"doc-vs-code differences (spec-55 CATALOGUE.md vs built JSON): {len(diffs)}")
    for d in diffs:
        print(f"  {d['catalogueKey']} {d['field']}: doc {d['doc']!r} vs code {d['code']!r}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
