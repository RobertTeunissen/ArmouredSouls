"""Spec 57 rule inputs shared by every tool.

Decision 6: the built spec-55 code is the source of truth. Everything that code
defines — weapons, refinement and attribute prices, the event registry, the six
strategies' Build_Orders, Build_Focus weights and groups, catalogue limits and
enums, the Team_Rule, ``canEquipToSlot`` and the whole-word profanity list —
comes from ``facts/facts.json``, written by ``export-facts.ts`` from the code
under ``APP_ROOT`` / ``PROFANITY_ROOT``. The few rules that remain transcribed
(name character sets, the source strategy names, the CATALOGUE §2 weapon list,
the profanity matching rules) name their source. Python 3 standard library only.

Roots (environment, relative paths resolved against the repo root):
  APP_ROOT        checkout with the built spec-55 code        (default: repo root)
  PROFANITY_ROOT  checkout with the whole-word profanity filter (default: APP_ROOT)
  IMAGE_ROOT      checkout with the expansion portraits         (default: repo root)
  SPEC55_DIR      spec-55 spec folder (default: the single ``.kiro/specs/*/55-automaton-stables``
                  under the repo root, else under APP_ROOT)
"""

from __future__ import annotations

import glob
import json
import math
import os
import re
from typing import Dict, List, Optional, Tuple

TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))
SPEC57_DIR = os.path.dirname(TOOLS_DIR)
REPO_ROOT = os.path.abspath(os.path.join(SPEC57_DIR, "..", "..", "..", ".."))
SOURCE_DIR = os.path.join(SPEC57_DIR, "source", "automaton-blueprints")
SOURCE_MD_DIR = os.path.join(SPEC57_DIR, "source")
COLLECTION_DIR = os.path.join(SPEC57_DIR, "source", "collection")
CATALOGUE_DIR = os.path.join(SPEC57_DIR, "catalogue")
FACTS_DIR = os.path.join(TOOLS_DIR, "facts")
REVIEW_DIR = os.path.join(SPEC57_DIR, "review")

SOURCE_NON_STABLE_FILES = {"blueprints.json", "validation-report.json"}


# ── Roots ────────────────────────────────────────────────────────────

def _root_from_env(name: str, default: str) -> str:
    value = os.environ.get(name)
    if not value:
        return default
    return os.path.abspath(value if os.path.isabs(value) else os.path.join(REPO_ROOT, value))


def repo_relative(path: str) -> str:
    """Repo-relative path with '/' separators ('.' for the repo root), as export-facts.ts writes it."""
    rel = os.path.relpath(os.path.abspath(path), REPO_ROOT)
    return "." if rel == "." else rel.replace(os.sep, "/")


APP_ROOT = _root_from_env("APP_ROOT", REPO_ROOT)
PROFANITY_ROOT = _root_from_env("PROFANITY_ROOT", APP_ROOT)


def _find_spec55_dir() -> str:
    if os.environ.get("SPEC55_DIR"):
        return _root_from_env("SPEC55_DIR", "")
    # Exact folder name: never matches to-do/55-generated-stable-upgrade-strategies.
    for base in dict.fromkeys([REPO_ROOT, APP_ROOT]):
        matches = sorted(glob.glob(os.path.join(base, ".kiro", "specs", "*", "55-automaton-stables")))
        if len(matches) == 1:
            return matches[0]
        if len(matches) > 1:
            raise SystemExit(f"SPEC55_DIR: {len(matches)} folders named 55-automaton-stables under {base}: "
                             f"{matches}; set SPEC55_DIR")
    raise SystemExit(f"SPEC55_DIR: no .kiro/specs/*/55-automaton-stables under {REPO_ROOT} or {APP_ROOT}; "
                     "set SPEC55_DIR or APP_ROOT")


SPEC55_DIR = _find_spec55_dir()
STARTER_CATALOGUE_DIR = os.path.join(APP_ROOT, "app", "backend", "prisma", "automaton-catalogue")
IMAGE_DIR = os.path.join(APP_ROOT, "app", "frontend", "public", "assets", "automatons")
# Starter and expansion portraits both live under the repository root (IMAGE_ROOT is an optional
# override).
IMAGE_ROOT = _root_from_env("IMAGE_ROOT", REPO_ROOT)
EXPANSION_IMAGE_DIR = os.path.join(IMAGE_ROOT, "app", "frontend", "public", "assets", "automatons")


def load_json(path: str):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def write_json(path: str, data) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(json.dumps(data, indent=2, ensure_ascii=False))
        fh.write("\n")


def _load_facts_at_import() -> dict:
    path = os.path.join(FACTS_DIR, "facts.json")
    if not os.path.exists(path):
        raise SystemExit("tools/facts/facts.json is missing: run export-facts.ts first (README §3)")
    facts = load_json(path)
    want = (repo_relative(APP_ROOT), repo_relative(PROFANITY_ROOT))
    got = (facts.get("appRoot"), facts.get("profanityRoot"))
    if got != want:
        raise SystemExit(f"tools/facts/facts.json was exported for appRoot={got[0]!r}, profanityRoot={got[1]!r}, "
                         f"but the resolved roots are appRoot={want[0]!r}, profanityRoot={want[1]!r}: re-run "
                         "export-facts.ts with the same APP_ROOT / PROFANITY_ROOT")
    return facts


FACTS = _load_facts_at_import()


def load_facts() -> dict:
    return FACTS


def source_stable_files() -> List[str]:
    return sorted(
        f for f in os.listdir(SOURCE_DIR)
        if f.endswith(".json") and f not in SOURCE_NON_STABLE_FILES
    )


# ── Catalogue limits (automatonCatalogueService.ts, robotNaming.ts) ──

_LIMITS = FACTS["catalogueLimits"]
FRANCHISE_MAX_LENGTH: int = _LIMITS["franchiseMaxLength"]
BACKSTORY_MAX_LENGTH: int = _LIMITS["backstoryMaxLength"]
TEAM_NAME_MIN_LENGTH: int = _LIMITS["teamNameMinLength"]
TEAM_NAME_MAX_LENGTH: int = _LIMITS["teamNameMaxLength"]
ROBOT_NAME_MAX_LENGTH: int = _LIMITS["robotNameMaxLength"]
MAX_BLUEPRINTS: int = _LIMITS["maxBlueprints"]
MAX_WEAPON_STAGES: int = _LIMITS["maxWeaponStages"]
MAX_REFINEMENT_STEPS_PER_WEAPON: int = _LIMITS["maxRefinementStepsPerWeapon"]
MAX_YIELD_THRESHOLD: int = _LIMITS["maxYieldThreshold"]
LOADOUTS: List[str] = list(_LIMITS["loadoutTypes"])
STANCES: List[str] = list(_LIMITS["stances"])
# automatonCatalogueService.ts — CATALOGUE_KEY_PATTERN (JS source; same syntax in Python)
CATALOGUE_KEY_RE = re.compile(_LIMITS["catalogueKeyPattern"])


# ── Names ────────────────────────────────────────────────────────────

# utils/validation.ts — validateStableName character set (transcribed; 3–30 characters)
STABLE_NAME_RE = re.compile(r"^[a-zA-Z0-9 _-]+$")
# utils/securityValidation.ts — safeName (1–50). Built catalogue robot names are safeName + no
# surrounding spaces (automatonCatalogueService.ts robotNameSchema); same set as validateRobotName.
ROBOT_NAME_RE = re.compile(r"^[a-zA-Z0-9 _\-'.!]+$")
SAFE_NAME_RE = re.compile(r"^[a-zA-Z0-9 _\-'.!]+$")

# Whole-word profanity (bugfix/profanity-whole-word-matching, utils/profanityFilter.ts):
# lists from facts.json, matching rules 1–3 transcribed with ASCII classes. check-built.ts compares
# this transcription with the TypeScript function on every stable, team and robot name.
PROFANITY_SET = frozenset(FACTS["profanity"]["list"])
COMPOUND_MATCH_ENTRIES: List[str] = list(FACTS["profanity"]["compoundEntries"])
_LETTER_RUN = re.compile(r"[A-Za-z]+")
_CAMEL_CASE_PART = re.compile(r"[A-Z]+(?![a-z])|[A-Z]?[a-z]+")
_UPPER_CASE_RUN = re.compile(r"[A-Z]+")
_LOWER_TO_UPPER = re.compile(r"(?<=[a-z])(?=[A-Z])")


def profanity_hits(text: str) -> List[str]:
    """List entries matched by profanityFilter.ts containsProfanity rules 1–3 (empty list = clean)."""
    hits: List[str] = []

    def hit(word: str) -> None:
        if word not in hits:
            hits.append(word)

    for run in _LETTER_RUN.findall(text):
        lower = run.lower()
        # Rule 1: the whole letter run is a list entry.
        if lower in PROFANITY_SET:
            hit(lower)
        # Rule 2: a camelCase/PascalCase part or an upper-case run is a list entry.
        for part in _CAMEL_CASE_PART.findall(run) + _UPPER_CASE_RUN.findall(run):
            if part.lower() in PROFANITY_SET:
                hit(part.lower())
        # Rule 3: compound entries inside a segment split only at lower→upper boundaries.
        for segment in _LOWER_TO_UPPER.split(run):
            seg = segment.lower()
            for entry in COMPOUND_MATCH_ENTRIES:
                if entry in seg:
                    hit(entry)
    return hits


def contains_profanity(text: str) -> bool:
    return bool(profanity_hits(text))


def validate_stable_name(name: str) -> List[str]:
    """utils/validation.ts validateStableName with the whole-word containsProfanity."""
    errors = []
    if len(name) < 3:
        errors.append("shorter than 3 characters")
    if len(name) > 30:
        errors.append(f"longer than 30 characters ({len(name)})")
    if not STABLE_NAME_RE.match(name):
        errors.append("characters outside [a-zA-Z0-9 _-]")
    hits = profanity_hits(name)
    if hits:
        errors.append("whole-word containsProfanity matches " + ", ".join(repr(h) for h in hits))
    return errors


def validate_robot_name(name: str) -> List[str]:
    errors = []
    t = name.strip()
    if t != name:
        errors.append("leading/trailing whitespace")
    if not 1 <= len(t) <= ROBOT_NAME_MAX_LENGTH:
        errors.append(f"length {len(t)} outside 1–{ROBOT_NAME_MAX_LENGTH}")
    if not ROBOT_NAME_RE.match(t):
        errors.append("characters outside [a-zA-Z0-9 _-'.!]")
    return errors


def validate_team_name(name: str) -> List[str]:
    """automatonCatalogueService.ts teamNamesIssues: 3–32 characters, safeName, no surrounding spaces."""
    errors = []
    if not TEAM_NAME_MIN_LENGTH <= len(name) <= TEAM_NAME_MAX_LENGTH:
        errors.append(f"length {len(name)} outside {TEAM_NAME_MIN_LENGTH}–{TEAM_NAME_MAX_LENGTH}")
    if not SAFE_NAME_RE.match(name):
        errors.append("fails safeName character set")
    if name.strip() != name:
        errors.append("leading/trailing whitespace")
    return errors


def validate_trimmed_text(text: str, max_length: int) -> List[str]:
    """automatonCatalogueService.ts trimmedText: 1–max characters, no surrounding spaces."""
    errors = []
    if not 1 <= len(text) <= max_length:
        errors.append(f"length {len(text)} outside 1–{max_length}")
    if text.strip() != text:
        errors.append("leading/trailing whitespace")
    return errors


# ── Strategies (built src/config/automaton-strategies/*.v1.json via the registry) ──

# Source format: the review documents name strategies by display name (transcribed).
STRATEGY_DISPLAY_TO_KEY = {
    "Swarm": "swarm",
    "Paragon": "paragon",
    "Duo": "duo",
    "Trio": "trio",
    "Tycoon": "tycoon",
    "Generalist": "generalist",
}

# The catalogue uses version 1 of every strategy.
STRATEGIES: Dict[str, dict] = {s["key"]: s for s in FACTS["strategies"] if s["version"] == 1}


def _robots_goals(strategy: dict) -> List[Tuple[int, int, int, int]]:
    return [(g["position"], g["defaultTarget"], g["bounds"]["min"], g["bounds"]["max"])
            for g in strategy["buildOrder"] if g["type"] == "robots"]


def _refine_goal(strategy: dict) -> Tuple[int, int]:
    goals = [g for g in strategy["buildOrder"] if g["type"] == "refine"]
    if len(goals) != 1:
        raise SystemExit(f"strategy {strategy['key']}: expected one refine Goal, found {len(goals)}")
    return goals[0]["position"], goals[0]["defaultTarget"]


def _value_rule(strategy: dict) -> Dict[str, int]:
    # STRATEGIES.md §1.8: the last attributes milestone before Max and the season-end
    # (highest) Training Facility target of the Build_Order.
    milestones = [g["defaultTarget"] for g in strategy["buildOrder"] if g["type"] == "attributes" and not g["isMax"]]
    training = [g["defaultTarget"] for g in strategy["buildOrder"]
                if g["type"] == "facility" and g.get("facilityType") == "training_facility"]
    return {"milestone": milestones[-1], "trainingLevel": max(training) if training else 0}


# Robots goals: (position, default, allowed_min, allowed_max), in Build_Order order.
ROBOTS_GOALS: Dict[str, List[Tuple[int, int, int, int]]] = {k: _robots_goals(s) for k, s in STRATEGIES.items()}
# Refine goal (position, default steps).
REFINE_GOAL: Dict[str, Tuple[int, int]] = {k: _refine_goal(s) for k, s in STRATEGIES.items()}
# §1.8 value rule inputs.
VALUE_RULE: Dict[str, Dict[str, int]] = {k: _value_rule(s) for k, s in STRATEGIES.items()}


def final_robots_goal(strategy: str) -> Tuple[int, int, int, int]:
    return ROBOTS_GOALS[strategy][-1]


def highest_robots_bound(strategy: str) -> int:
    return max(g[3] for g in ROBOTS_GOALS[strategy])


def effective_robots_targets(strategy: str, overrides: Dict[str, int]) -> Dict[int, int]:
    return {pos: int(overrides.get(str(pos), default)) for pos, default, _lo, _hi in ROBOTS_GOALS[strategy]}


def effective_final_robots(strategy: str, overrides: Dict[str, int]) -> int:
    targets = effective_robots_targets(strategy, overrides)
    return max(targets.values())


# ── Team_Rule (shared automatonTeamRule.ts) ─────────────────────────

_TEAM_RULE = FACTS["teamRule"]


def team_rule_2v2(index: int) -> List[int]:
    rows = _TEAM_RULE["twoVsTwo"]
    return list(rows[index]) if 0 <= index < len(rows) else []


def team_rule_3v3(index: int) -> List[int]:
    rows = _TEAM_RULE["threeVsThree"]
    return list(rows[index]) if 0 <= index < len(rows) else []


def required_team_name_counts(max_robots: int) -> Tuple[int, int]:
    n = max(0, min(int(max_robots), MAX_BLUEPRINTS))
    c = _TEAM_RULE["requiredTeamNameCounts"][str(n)]
    return c["twoVsTwo"], c["threeVsThree"]


# ── Build_Focus (buildFocus.ts) ─────────────────────────────────────

GROUPS: List[str] = list(FACTS["buildFocus"]["groups"])  # ATTRIBUTE_GROUPS: tie order Combat, Defense, Mobility, AI/Team
GROUP_ATTRIBUTES: Dict[str, List[str]] = {g: list(FACTS["buildFocus"]["attributesOfGroup"][g]) for g in GROUPS}
ATTRIBUTE_GROUP = {a: g for g, attrs in GROUP_ATTRIBUTES.items() for a in attrs}
BUILD_FOCUS_WEIGHTS: Dict[str, Dict[str, float]] = {k: dict(v) for k, v in FACTS["buildFocus"]["weights"].items()}
BUILD_FOCUS_DISPLAY = {k.capitalize(): k for k in BUILD_FOCUS_WEIGHTS}


def group_priority(build_focus: str) -> List[str]:
    w = BUILD_FOCUS_WEIGHTS[build_focus]
    return sorted(GROUPS, key=lambda g: (-w[g], GROUPS.index(g)))


def group_level(build_focus: str, group: str, milestone: int) -> int:
    # weight × milestone, rounded up (STRATEGIES.md §1.7); round first to avoid 0.6*30 float noise
    return int(math.ceil(round(BUILD_FOCUS_WEIGHTS[build_focus][group] * milestone, 6)))


def display_attribute_to_key(name: str) -> Optional[str]:
    """'Combat Power' -> 'combatPower'; 'Adaptive AI' -> 'adaptiveAI'. None if unknown."""
    words = name.strip().split()
    if not words:
        return None
    key = words[0].lower() + "".join(w if w.isupper() else w.capitalize() for w in words[1:])
    return key if key in ATTRIBUTE_GROUP else None


def attribute_display(key: str) -> str:
    out = re.sub(r"([A-Z]+)", r" \1", key)
    out = out[0].upper() + out[1:]
    return out.replace("Adaptive A I", "Adaptive AI")


# ── Weapons ──────────────────────────────────────────────────────────

# Top-priced weapons per hand type and range, as listed in spec-55 CATALOGUE §2 (doc cross-check only).
CATALOGUE_TOP_WEAPONS = {
    ("one", "short"): "Volt Sabre",
    ("one", "mid"): "Nova Caster",
    ("one", "long"): "Particle Lance",
    ("one", "melee"): "Vibro Mace",
    ("two", "short"): "Arc Projector",
    ("two", "mid"): "Plasma Cannon",
    ("two", "long"): "Ion Beam",
    ("two", "melee"): "Heavy Hammer",
    ("shield", "melee"): "Aegis Bulwark",
}


class Weapons:
    """Weapon facts keyed by name; loadout fit from the built canEquipToSlot (shared weaponSlots.ts)."""

    def __init__(self, facts: dict):
        self.by_name = {w["name"]: w for w in facts["weapons"]}
        self.fit = facts["canEquip"]

    def get(self, name: str) -> Optional[dict]:
        return self.by_name.get(name)

    def top_priced(self, hands: str, range_band: str) -> Optional[str]:
        cands = [w for w in self.by_name.values() if w["handsRequired"] == hands and w["rangeBand"] == range_band]
        if not cands:
            return None
        return max(cands, key=lambda w: w["cost"])["name"]

    def can_equip(self, weapon: dict, slot: str, loadout: str) -> Tuple[bool, str]:
        per_loadout = self.fit.get(weapon["name"], {}).get(slot)
        if per_loadout is None:
            return False, f"no canEquipToSlot fact for {weapon['name']} ({slot})"
        verdict = per_loadout.get(loadout)
        if verdict is None:
            return False, f"unknown loadout {loadout!r}"
        return verdict["canEquip"], verdict["reason"]

    def stage_errors(self, stage: Dict[str, Optional[str]], loadout: str) -> List[str]:
        """Loadout fit per canEquipToSlot plus the loadout's required shape (CATALOGUE §2)."""
        errors = []
        main, off = stage.get("main"), stage.get("offhand")
        for slot, name in (("main", main), ("offhand", off)):
            if name is None:
                continue
            w = self.get(name)
            if w is None:
                errors.append(f"unknown weapon {name!r}")
                continue
            ok, why = self.can_equip(w, slot, loadout)
            if not ok:
                errors.append(f"{name} ({slot}): {why}")
        if main is None:
            errors.append("no main-hand weapon")
        if loadout in ("single", "two_handed") and off is not None:
            errors.append(f"{loadout} has an offhand weapon")
        if loadout == "weapon_shield" and off is None:
            errors.append("weapon_shield without a shield")
        if loadout == "dual_wield" and off is None:
            errors.append("dual_wield without an offhand weapon")
        return errors

    def stage_range(self, stage: Dict[str, Optional[str]]) -> Optional[str]:
        """Range from weapons: main hand decides on equal DPS (decision 15); shields add no range."""
        main = self.get(stage.get("main") or "")
        off = self.get(stage.get("offhand") or "")
        if main is None:
            return None
        if off is None or off["handsRequired"] == "shield":
            return main["rangeBand"]
        dps_main = main["baseDamage"] / main["cooldown"]
        dps_off = off["baseDamage"] / off["cooldown"]
        return off["rangeBand"] if dps_off > dps_main else main["rangeBand"]


# ── Prices (pricing.ts) ─────────────────────────────────────────────

def refinement_cost(facts: dict, tier: str, magnitude: int, existing_same_tier: int) -> int:
    """pricing.refinementStepCost (what refineWeapon charges)."""
    table = facts["refinementCosts"][tier]
    if tier in ("sharpen", "forge"):
        return table[f"{min(existing_same_tier, 1)}:1"]
    return table[f"0:{magnitude}"]


def robot_upgrade_cost(facts: dict, strategy: str, robots: int, level: int, plus: int) -> int:
    """pricing.attributeIncrementCost of +plus from `level` at the strategy's season-end Training Facility level."""
    t = VALUE_RULE[strategy]["trainingLevel"]
    row = facts["attributeIncrementCost"][f"{t}:{max(1, min(robots, MAX_BLUEPRINTS))}"]
    return sum(row[level + i] for i in range(plus))
