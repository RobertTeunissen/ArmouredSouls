# Requirements Document: Automaton Catalogue Expansion

**Spec**: 57 — `automaton-catalogue-expansion`
**Status**: Delivered (11 October 2026). Content_Approval of the Expansion_Review_Pack (`review/`) recorded on 11 October 2026; verification in `docs/implementation_notes/AUTOMATON_CATALOGUE_EXPANSION.md`.
**Depends on**: spec 55 (`automaton-stables`) implemented through its task 8.6: the Automaton_Catalogue folder, `catalogueEntrySchema`, `catalogueSchema.test.ts`, `catalogueImages.test.ts` and `automatonCatalogueCoverage.test.ts` exist and pass with the Starter_Stables; and `bugfix/profanity-whole-word-matching` (whole-word `containsProfanity`, `app/backend/src/utils/profanityFilter.ts`) merged to main before Task Group 2 (merged in PR #528; the spec-55 branch must include it).
**UI**: none. This spec changes no page or component, so the UI and mobile contract of `spec-quality-standards.md` does not apply.
**Counts**: this document states no catalogue or starter count of its own. Expansion counts are derived from `source/`, starter counts from the built starter catalogue (`tools/facts/starter.json`); the current numbers are in the generated Totals block at the top of `review/FINDINGS.md` (decision 20).

## Glossary

Domain concepts use `Pascal_Snake` without backticks; code artefacts are backticked as implemented or as proposed in spec-55 `design.md`. Terms marked (spec 55) keep the meaning defined in spec-55 `requirements.md`.

- **Automaton_Catalogue** (spec 55) — the repository-held set of Catalogue_Entries in `app/backend/prisma/automaton-catalogue/` and their Repository_Images.
- **Catalogue_Entry** (spec 55) — one JSON file in the design §15.1 format describing one Automaton_Profile and its Robot_Blueprints; it stores no image path.
- **Catalogue_Sync** (spec 55) — the insert-only `pnpm run automaton:sync` that adds a Draft_Automaton for every Catalogue_Entry whose Catalogue_Key does not exist yet.
- **Automaton_Stable**, **Automaton_Profile**, **Draft_Automaton**, **Active_Automaton**, **Catalogue_Key**, **Robot_Blueprint**, **Blueprint_Slot**, **Refinement_Plan**, **Weapon_Path**, **Weapon_Stage**, **Team_Rule**, **Team_Names**, **Event_Order**, **Build_Order**, **Goal**, **Goal_Target**, **Build_Focus**, **Strategy_Version**, **Repository_Image**, **Coverage_Matrix**, **Content_Approval**, **Turn_Step**, **Turn_Trigger** (spec 55) — as defined in spec-55 `requirements.md`.
- **Starter_Stable** — one of the Automaton_Stables approved in spec-55 `review/CATALOGUE.md` and delivered by spec 55; the built starter files are read into `tools/facts/starter.json`, and their number is the starter row of the Totals block.
- **Expansion_Stable** — an Automaton_Stable the product owner drafted in `source/` and this spec delivers: either a review record in `source/automaton-blueprints/` or a collection folder `source/collection/{NNN}-{catalogueKey}/`. Their number is whatever `source/` holds.
- **Source_Blueprints** — the product owner's drafts in `source/`: `AUTOMATON_STABLE_EXPANSION.md`, `AUTOMATON_ROBOT_BLUEPRINTS.md` and `automaton-blueprints/` (one review-format JSON file per Expansion_Stable, plus `blueprints.json`, `validation-report.json` and `README.md`), and `collection/` (one folder per Expansion_Stable with `stable.json` and `blueprints.json` in the snake_case authoring format, plus its proposal document).
- **Staged_Entry** — the converted Catalogue_Entry of one Expansion_Stable at `catalogue/{catalogueKey}.json` in this spec folder, not yet part of the Automaton_Catalogue.
- **Rule_Facts** — the rule inputs exported from the built spec-55 code into `tools/facts/facts.json` (weapons, refinement and attribute-upgrade prices, attributes, event types, strategies and their Goal bounds, Build_Focus weights, catalogue limits, Team_Rule, `canEquipToSlot`, and the whole-word profanity lists) plus the transcribed name rules in `tools/rules.py`.
- **Plan_Generator** — `tools/refine_plan.py`, the decision-35/36 rule that derives a Refinement_Plan from a blueprint's strategy, robot count, Build_Focus, loadout and final Weapon_Stage.
- **Catalogue_Validator** — `tools/validate.py`, which applies every spec-55 catalogue rule and the analytical checks to the Source_Blueprints and the Staged_Entries.
- **Finding** — one rule violation or review item reported by the Catalogue_Validator, classified as Blocking, Needs product-owner decision or Cosmetic.
- **Expansion_Review_Pack** — `review/README.md`, `review/FINDINGS.md` and `review/CATALOGUE.md`.

## Introduction

Spec 55 delivers the Automaton engine and a fixed set of Starter_Stables (spec-55 R10.9, decision 32: more stables follow through the admin page or a future spec). The product owner has drafted more in two formats: review records and a later collection with portraits. This spec converts every Expansion_Stable in `source/` into a Staged_Entry, validates it against every approved spec-55 rule, resolves the Findings with the product owner, and then delivers the approved entries into the Automaton_Catalogue, so Catalogue_Sync adds them to ACC as Draft_Automatons. The engine, the schema and the strategies are unchanged. The catalogue tests gain the cross-stable checks a large catalogue needs, the heavy test runs every repository Catalogue_Entry, and the scaling of the built engine is investigated without adding an activation cap.

## Expected Contribution

Current numbers for every item are in the Totals block of `review/FINDINGS.md`; the counts per check are in its "Status per check" table.

1. **Catalogue size**: the Automaton_Catalogue grows from the Starter_Stable Catalogue_Entries (the starter row of the Totals block) to the Starter_Stables plus every Expansion_Stable in `source/`. The number of delivered expansion files equals the number of source stables.
2. **Refinement plans**: before this spec, the Source_Blueprints' plans are missing or not value-ordered (FINDINGS V13). After it, every expansion Robot_Blueprint has a validator-clean, value-ordered plan (decisions 35–36), produced by a Plan_Generator that reproduces every approved starter plan.
3. **Rule conformance and names**: before, the Source_Blueprints carry Blocking Findings, names the built validators reject, a strategy spec 55 does not have (Squadron) and names repeated across stables. At delivery, the Staged_Entries have 0 Blocking Findings, the built-code check passes for every entry, and Catalogue_Keys, stable names, robot names and team names are unique across the whole catalogue.
4. **Portraits**: before, nothing checks that an expansion portrait exists or still fits a renamed slot. After, every expansion Blueprint_Slot is checked for a 512×512 WebP, and every slot whose name or art brief a decision changed carries a portrait verdict; missing portraits and slots needing a new portrait are counted in the Totals block.
5. **Idle spare blueprints**: before, some Expansion_Stables hold a Robot_Blueprint above their robots Goal_Target that is never built (FINDINGS A12). After, none: each such target equals the blueprint count (README decision 5).
6. **Specification debt**: spec-55 R10.9 (a fixed set of starter Catalogue_Entries) is superseded by Requirement 4.2; the heavy test runs every repository Catalogue_Entry instead of a fixed population and records the time per Automaton; the scaling of the built engine is recorded in `review/SCALING.md`; and `validate.py --check-spec` fails on any hard-coded catalogue or starter count in the spec documents.

### Verification Criteria

Run from the repository root after the final task, with `S57=.kiro/specs/done-october26/57-automaton-catalogue-expansion`. Each check is recorded as passed, failed or blocked.

1. **Pipeline and Findings**: in `$S57/tools/`, `python3 refine_plan.py --selftest` exits 0 with every starter plan identical (`N/N`, N the blueprints of `tools/facts/starter.json`), `python3 validate.py` exits 0 and `review/findings.json` has an empty `catalogueResidualByCheck` and no `A12` in `decidedResidualByCheck`; `python3 validate.py --check-readme` and `python3 validate.py --check-spec` (traces, design map, no optional task, hard-coded-count scan) exit 0; `pnpm exec tsx "$PWD/$S57/tools/check-built.ts"` run from `app/backend` (as in `review/README.md` §3) exits 0 with no stable name pending the whole-word rule.
2. **Delivered files**: the counts are derived, not typed:
   ```bash
   src=$(( $(ls "$S57"/source/automaton-blueprints/*.json | grep -v -e '/blueprints.json$' -e '/validation-report.json$' | wc -l) + $(ls -d "$S57"/source/collection/[0-9][0-9][0-9]-*/ | wc -l) ))
   staged=$(ls "$S57"/catalogue/*.json | wc -l)
   starters=$(python3 -c 'import json, sys; print(len(json.load(open(sys.argv[1]))["stables"]))' "$S57/tools/facts/starter.json")
   delivered=$(ls app/backend/prisma/automaton-catalogue/*.json | wc -l)
   test "$staged" -eq "$src" && test "$delivered" -eq $(( starters + staged )) && echo counts-ok
   for f in "$S57"/catalogue/*.json; do cmp "$f" "app/backend/prisma/automaton-catalogue/$(basename "$f")" || echo "DIFF $f"; done
   git diff --diff-filter=M --name-only main -- app/backend/prisma/automaton-catalogue/
   ```
   prints `counts-ok`, no `DIFF` line and no modified file (the starter files unchanged).
3. **Catalogue tests**: `cd app/backend && pnpm run test:unit -- catalogueSchema catalogueImages automatonCatalogueCoverage` passes, including the cross-stable uniqueness and starter-subset assertions.
4. **Sync dry run**: on a local database with the spec-55 migrations, `cd app/backend && pnpm run automaton:sync --dry-run` reports no conflict and no schema error, and `pnpm run automaton:sync --dry-run | grep -c '  would add draft: '` equals `ls "$S57"/catalogue/*.json | wc -l` (the Expansion_Stables row of the Totals block).
5. **Backend gates**: `cd app/backend && pnpm run lint && pnpm run build && pnpm run typecheck:tests && pnpm run test:tiers:verify` pass.
6. **Documentation**: `grep -l "Expansion_Stable" docs/game-systems/PRD_AUTOMATON_STABLES.md docs/guides/AUTOMATON_OPERATIONS_GUIDE.md docs/architecture/SEED_DATA_SPECIFICATION.md` lists all three files; `grep -nE "[0-9]{2,} (Expansion_Stables|Draft_Automatons|expansion stables)" docs/game-systems/PRD_AUTOMATON_STABLES.md docs/guides/AUTOMATON_OPERATIONS_GUIDE.md docs/architecture/SEED_DATA_SPECIFICATION.md` prints nothing; `grep -n "activation cap\|review/SCALING.md" docs/guides/AUTOMATON_OPERATIONS_GUIDE.md` finds the no-cap and batch-activation text.
7. **Heavy test**: `cd app/backend && pnpm run test:heavy -- automaton` passes with every repository Catalogue_Entry active and no Turn_Step budget-skipped, and `docs/implementation_notes/AUTOMATON_CATALOGUE_EXPANSION.md` records the Turn_Step duration ÷ Automatons processed per Turn_Trigger. If a Turn_Step is budget-skipped, the check is recorded as failed with the matching open item of `review/SCALING.md` §6.

## Requirements

### Requirement 1: Content_Approval of the Expansion_Review_Pack

**User Story:** As the product owner, I want to review and decide every Finding before any expansion stable reaches ACC.

#### Acceptance Criteria

1. THE Expansion_Review_Pack SHALL consist of `review/README.md` (status, sources, pipeline, numbered open decisions with a recommended answer each, Decisions list, gating, open items), `review/FINDINGS.md` (every Finding with its class and counts per check and per Expansion_Stable) and `review/CATALOGUE.md` (every Expansion_Stable in the spec-55 `review/CATALOGUE.md` §3 layout), each with a status header and an approval checklist per section; `review/SCALING.md`, `review/COLLECTION_205_GAPS.md` and `review/COLLECTION_205_VERIFICATION.md` are supporting records.
2. WHEN the product owner answers an open decision, THE spec SHALL apply the answer to the Staged_Entries, re-run the pipeline and record the answer in the Decisions list of `review/README.md`.
3. THE spec SHALL NOT copy any Staged_Entry into the Automaton_Catalogue before Content_Approval is recorded (every Expansion_Review_Pack document `Status: Approved — <date>`) and before spec 55 is implemented through its task 8.6 and before the spec-55 code on main uses the whole-word `containsProfanity` of `bugfix/profanity-whole-word-matching` (`tools/check-built.ts` reports no stable name pending the whole-word rule).
4. THE tooling SHALL NOT invent or rewrite content to make a rule pass: every content change comes from a recorded product-owner decision, and the Refinement_Plan is the only generated field. Content the product owner delegates to the spec author is recorded as delegated in `tools/decisions.json` and shown for review in `review/CATALOGUE.md`.
5. THE Catalogue_Validator SHALL write a generated Totals block at the top of `review/FINDINGS.md` on every run (stables, blueprints and team names per origin and in total, per strategy, portraits, findings and decisions), and THE hand-written spec and review documents SHALL state no catalogue count, starter count or stable range of their own but derive it from `source/` or the built starter catalogue (`tools/facts/starter.json`) or point to the Totals block, enforced by `validate.py --check-spec`.

### Requirement 2: Staged_Entries

**User Story:** As a developer, I want the expansion stables in exactly the format the spec-55 catalogue schema accepts, reproducibly.

#### Acceptance Criteria

1. THE spec SHALL hold one Staged_Entry per Expansion_Stable in `source/` in exactly the spec-55 design §15.1 format (top-level fields `schemaVersion`, `catalogueKey`, `stableName`, `franchise`, `backstory`, `strategy`, `teamNames`, `eventOrder`, `blueprints`), with none of the Source_Blueprints' review-only fields and no image field.
2. THE conversion SHALL write `strategy.targetOverrides` as Build_Order goal positions: a source robots target N, or a Goal_Target set by a recorded product-owner decision in `tools/decisions.json`, becomes the Build_Order position override only where it differs from that Goal's default; a source value outside the Goal's bounds SHALL be reported as a Blocking Finding and not written, and an invalid decided value SHALL fail the conversion.
3. THE conversion SHALL give every Robot_Blueprint the Refinement_Plan produced by the Plan_Generator, and the Plan_Generator SHALL reproduce every approved starter Refinement_Plan step for step.
4. WHEN the pipeline is re-run on unchanged inputs, THE Staged_Entries and `review/CATALOGUE.md` SHALL be byte-identical to the previous run.
5. THE Staged_Entries SHALL pass the built spec-55 `catalogueEntrySchema` and `loadCatalogueDirectory` together with the Starter_Stable entries and the two-season strategy-runner projection (`projectScenario`), as checked by `tools/check-built.ts`.
6. THE conversion SHALL read both source formats: the review records as they are and the collection mapped field by field as in design §3, with `target_overrides` read defensively (absent or `null` means none); a source strategy without a spec-55 key (Squadron) SHALL convert only through a recorded decision; and the number of `catalogue/*.json` files SHALL equal the number of source stables.

### Requirement 3: Validation and Findings

**User Story:** As the product owner, I want every defect found and classified, with a recommended fix, before I approve.

#### Acceptance Criteria

1. THE Catalogue_Validator SHALL apply every spec-55 catalogue rule (spec-55 design §15.1, `review/CATALOGUE.md` §2, R3.1–R3.7, decisions 23–27 and 35–36) to the Source_Blueprints and to the Staged_Entries, reading its rule inputs from Rule_Facts.
2. THE Catalogue_Validator SHALL classify each Finding as Blocking (breaks an approved rule), Needs product-owner decision or Cosmetic; SHALL state for each Blocking check whether its fix is mechanical and whether it is applied in the Staged_Entries; and SHALL report counts per class, per check and per Expansion_Stable.
3. THE Catalogue_Validator SHALL exit with a non-zero status when a Staged_Entry has a Blocking Finding whose fix is mechanical.
4. THE Catalogue_Validator SHALL check uniqueness across the Starter_Stables and every Expansion_Stable: Catalogue_Keys, stable names (case-insensitive), robot names (exact, as `validateRobotName` checks them, and normalised) and team names (exact and case-insensitive); a repeat is resolved by decision 15 (an original name beats an authored one; where both are original, the higher-numbered stable changes).
5. WHEN Content_Approval is recorded, THE Staged_Entries SHALL have zero Blocking Findings.
6. THE Catalogue_Validator SHALL check every Blueprint_Slot of every Expansion_Stable for a Repository_Image (V15: a malformed image or an image folder without a Catalogue_Entry is Blocking, a missing image is reported), and SHALL list every slot whose name or art brief a decision changed until it carries a portrait verdict (A13); slots whose verdict is "new portrait needed" are counted in the Totals block.

### Requirement 4: Delivery into the Automaton_Catalogue

**User Story:** As an operator, I want the approved expansion stables to appear on ACC through the existing catalogue flow.

#### Acceptance Criteria

1. WHEN Requirement 1.3 is met, THE spec SHALL copy every approved Staged_Entry byte-identical to `app/backend/prisma/automaton-catalogue/{catalogueKey}.json`, and SHALL leave the Starter_Stable entries unchanged.
2. THE System SHALL deliver the Starter_Stable Catalogue_Entries approved in spec-55 `review/CATALOGUE.md` plus every Expansion_Stable Catalogue_Entry approved in `review/CATALOGUE.md`, whatever their number; this replaces the fixed starter count of spec-55 R10.9, whose Coverage_Matrix clause stays in force.
3. WHEN the ACC deploy runs Catalogue_Sync, THE System SHALL add every delivered Expansion_Stable as a Draft_Automaton under the unchanged spec-55 insert-only rules; this spec SHALL NOT activate any Draft_Automaton.
4. THE spec SHALL take Expansion_Stable robot images only as Repository_Images by convention (`app/frontend/public/assets/automatons/{catalogueKey}/{slot}.webp`, 512×512 WebP), SHALL allow missing images, and SHALL commit an image only together with or after the Catalogue_Entry of its Catalogue_Key.

### Requirement 5: Catalogue tests for a catalogue of any size

**User Story:** As a developer, I want CI to catch cross-stable defects, keep the Starter_Stables self-sufficient for coverage and prove the engine with every repository entry active.

#### Acceptance Criteria

1. THE `catalogueSchema.test.ts` suite SHALL fail when two repository Catalogue_Entries share a Catalogue_Key, a stable name (case-insensitive), a robot name (exact) or a team name (exact), naming both entries.
2. THE `catalogueImages.test.ts` suite SHALL include cases proving that an image of an Expansion_Stable slot that exists is accepted and an image for a Blueprint_Slot beyond that entry's blueprints is rejected.
3. THE `automatonCatalogueCoverage.test.ts` suite SHALL keep asserting the Coverage_Matrix over the union of all repository Catalogue_Entries and SHALL additionally assert it over the Starter_Stable entries alone.
4. THE heavy test SHALL activate every repository Catalogue_Entry (no fixed population and no generated entries), SHALL record the Turn_Step duration divided by the Automatons processed for each Turn_Trigger in `docs/implementation_notes/AUTOMATON_CATALOGUE_EXPANSION.md`, and SHALL fail when a Turn_Step is budget-skipped.

### Requirement 6: Documentation and verification

**User Story:** As a maintainer, I want the documentation to describe a catalogue of any size and the delivery to be proven.

#### Acceptance Criteria

1. WHEN the delivery is complete, THE documentation SHALL be updated without catalogue counts of its own: `docs/game-systems/PRD_AUTOMATON_STABLES.md` (the Starter_Stables plus the Expansion_Stables, how they were reviewed and delivered), `docs/guides/AUTOMATON_OPERATIONS_GUIDE.md` (the Draft_Automatons after the deploy, no activation cap, activation in batches, the open items of `review/SCALING.md`, adding Repository_Images for expansion slots) and `docs/architecture/SEED_DATA_SPECIFICATION.md` (the catalogue entry count as derived from the folder, and the cross-stable uniqueness rule).
2. WHEN the final verification task runs, THE task SHALL execute each Verification Criterion and record each as passed, failed or blocked in `docs/implementation_notes/`; no check SHALL be recorded as passed unless it completed successfully.

### Requirement 7: Scale

**User Story:** As the product owner, I want the catalogue to grow without a cap and to know what the engine needs for very large populations.

#### Acceptance Criteria

1. THE spec SHALL NOT add an activation cap or a limit on the number of Catalogue_Entries or Active_Automatons (decision 19).
2. THE scaling investigation of the built spec-55 engine SHALL be recorded in `review/SCALING.md`: cycle execution, cost per Automaton, extrapolation to the current repository size and to larger populations, bottlenecks with `path:line` references, sync, admin and matchmaking effects, and every number marked verified or estimated.
3. THE engine changes larger populations need SHALL be recorded as open items for the product owner in `review/SCALING.md` §6 and `review/README.md` §6, and SHALL NOT be implemented by this spec.
