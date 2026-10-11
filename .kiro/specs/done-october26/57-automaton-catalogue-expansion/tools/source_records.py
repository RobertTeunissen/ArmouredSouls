#!/usr/bin/env python3
"""Read every Expansion_Stable in source/ as one camelCase review record.

Two origins:
  review      source/automaton-blueprints/{key}.json (the review format convert.py was written for)
  collection  source/collection/{NNN}-{key}/stable.json (+ blueprints.json), the snake_case
              authoring format, mapped field by field as in review/COLLECTION_205_GAPS.md §5

Every record carries private fields (names starting with '_', never written to catalogue/):
  _origin               'review' | 'collection'
  _sourceFile           path relative to source/
  _droppedSourceFields  collection only: source fields with no spec-55 home that are present
  _bundleMatches        collection only: blueprints.json agrees with stable.json (robots, number, key)

The mapping copies values as they are; nothing is renamed or corrected here (Requirement 1.4).
Python 3 standard library only.
"""

from __future__ import annotations

import os
import re
import sys
from typing import List, Optional

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rules  # noqa: E402

FOLDER_RE = re.compile(r"^(\d{3})-([a-z0-9-]+)$")

REQUIRED_STABLE = ("number", "catalogue_key", "name", "franchise", "backstory", "strategy", "opening_robots",
                   "target_robots", "max_planned_robots", "teams", "event_order", "robots")
REQUIRED_ROBOT = ("slot", "name", "loadout", "stance", "yield_threshold", "build_focus", "weapon_path",
                  "refinement_plan", "art_brief")

# Fields with no spec-55 home (COLLECTION_205_GAPS.md §5 "Cannot be mapped").
DROPPED_STABLE = ("strategy_personality", "purchasing_plan", "equipment_budget", "strategy_review_limit",
                  "source_notes", "source_documents", "source_franchise_label", "blueprint_status",
                  "blueprint_origin", "folder", "history_image_count")
DROPPED_ROBOT = ("role", "equipment_interpretation", "combat_rationale", "tuning_plan", "design_basis",
                 "missing_fields", "files", "selected_image", "folder", "refinement_note")


class SourceError(Exception):
    pass


def review_records() -> List[dict]:
    """The review-format records of source/automaton-blueprints/."""
    out = []
    for name in rules.source_stable_files():
        rec = rules.load_json(os.path.join(rules.SOURCE_DIR, name))
        rec["_origin"] = "review"
        rec["_sourceFile"] = f"automaton-blueprints/{name}"
        out.append(rec)
    return out


def collection_folders() -> List[str]:
    """Sorted NNN-key folders of source/collection/ that contain a stable.json."""
    if not os.path.isdir(rules.COLLECTION_DIR):
        return []
    return sorted(d for d in os.listdir(rules.COLLECTION_DIR)
                  if FOLDER_RE.match(d) and os.path.isfile(os.path.join(rules.COLLECTION_DIR, d, "stable.json")))


def _require(obj: dict, fields, where: str) -> None:
    missing = [f for f in fields if f not in obj]
    if missing:
        raise SourceError(f"{where}: required field(s) missing: {missing}")


def _step(s: dict) -> dict:
    out = {"step": s.get("step"), "tier": s.get("operation"), "weapon": s.get("weapon"),
           "weaponSlot": s.get("hand")}
    # Sharpen and Forge steps carry no attribute or magnitude, as in the review format.
    if "attribute" in s:
        out["attribute"] = s["attribute"]
    if "magnitude" in s:
        out["magnitude"] = s["magnitude"]
    out["costCredits"] = s.get("cost_credits")
    out["workshopLevel"] = s.get("workshop_level")
    return out


def _robot(r: dict, where: str) -> dict:
    _require(r, REQUIRED_ROBOT, f"{where} robot {r.get('slot')!r}")
    review = {
        "artBrief": r["art_brief"],
        "refinementTotalCredits": r.get("refinement_total_credits"),
        "minimumRosterExpansionLevel": r.get("minimum_roster_expansion_level"),
        "rangeFromWeapons": r.get("range_from_weapons"),
    }
    if "refinement_note" in r:
        review["refinementNote"] = r["refinement_note"]
    return {
        "slot": r["slot"],
        "name": r["name"],
        "availability": r.get("availability"),
        "blueprintId": r.get("blueprint_id"),
        "sourceAlias": r.get("source_identity"),
        "loadout": r["loadout"],
        "stance": r["stance"],
        "yieldThreshold": r["yield_threshold"],
        "buildFocus": r["build_focus"],
        "weaponPath": [{"mainWeapon": st.get("main_weapon"), "offhandWeapon": st.get("offhand_weapon"),
                        "listPriceCredits": st.get("list_price_credits")}
                       for st in sorted(r["weapon_path"], key=lambda x: x.get("stage", 0))],
        "refinementPlan": [_step(s) for s in r["refinement_plan"]],
        "review": review,
    }


def from_collection(stable: dict, folder: str, bundle: Optional[dict] = None) -> dict:
    """Map one collection stable.json (folder 'NNN-key') to a review record."""
    where = f"collection/{folder}/stable.json"
    m = FOLDER_RE.match(folder)
    if not m:
        raise SourceError(f"{where}: folder name is not NNN-key")
    _require(stable, REQUIRED_STABLE, where)
    if int(m.group(1)) != stable["number"] or m.group(2) != stable["catalogue_key"]:
        raise SourceError(f"{where}: folder {folder} differs from number {stable['number']} / "
                          f"catalogue_key {stable['catalogue_key']!r}")
    teams = stable["teams"] or {}
    dropped = {f for f in DROPPED_STABLE if f in stable}
    for r in stable["robots"]:
        dropped.update(f for f in DROPPED_ROBOT if f in r)
    rec = {
        "number": stable["number"],
        "catalogueKey": stable["catalogue_key"],
        "stableName": stable["name"],
        "franchiseLabel": stable["franchise"],
        "backstory": stable["backstory"],
        "strategy": stable["strategy"],
        "openingRobots": stable["opening_robots"],
        "targetRobots": stable["target_robots"],
        "adminMaximumRobots": stable["max_planned_robots"],
        "targetOverrides": stable.get("target_overrides") or {},
        "teamNames": {size: [{"name": t["name"], "slots": list(t.get("slots") or [])} for t in teams.get(size) or []]
                      for size in ("2v2", "3v3")},
        "eventOrder": list(stable["event_order"]),
        "alternativeBlueprints": list(stable.get("alternatives") or stable.get("replacement_alternatives") or []),
        "robots": [_robot(r, where) for r in sorted(stable["robots"], key=lambda x: x.get("slot", 0))],
        "_origin": "collection",
        "_sourceFile": f"collection/{folder}/stable.json",
        "_droppedSourceFields": sorted(dropped),
    }
    if bundle is not None:
        rec["_bundleMatches"] = (bundle.get("robots") == stable["robots"]
                                 and bundle.get("stable_number") == stable["number"]
                                 and bundle.get("catalogue_key") == stable["catalogue_key"])
    return rec


def collection_records() -> List[dict]:
    out = []
    for folder in collection_folders():
        d = os.path.join(rules.COLLECTION_DIR, folder)
        stable = rules.load_json(os.path.join(d, "stable.json"))
        bundle_path = os.path.join(d, "blueprints.json")
        bundle = rules.load_json(bundle_path) if os.path.isfile(bundle_path) else {}
        out.append(from_collection(stable, folder, bundle))
    return out


def load_all() -> List[dict]:
    """Review records first (file order), then the collection sorted by number. Raises SourceError
    when a Catalogue_Key appears twice."""
    records = review_records() + sorted(collection_records(), key=lambda r: r["number"])
    seen = {}
    for r in records:
        key = r["catalogueKey"]
        if key in seen:
            raise SourceError(f"Catalogue_Key {key!r} appears in {seen[key]} and {r['_sourceFile']}")
        seen[key] = r["_sourceFile"]
    return records


def known_keys() -> List[str]:
    return [r["catalogueKey"] for r in load_all()]
