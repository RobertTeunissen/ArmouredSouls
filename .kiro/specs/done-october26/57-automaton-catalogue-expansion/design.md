# Design Document: Automaton Catalogue Expansion

**Spec**: 57 — `automaton-catalogue-expansion`
**Status**: Delivered (11 October 2026). Content_Approval of `review/` recorded on 11 October 2026 (Requirement 1); verification in `docs/implementation_notes/AUTOMATON_CATALOGUE_EXPANSION.md`.
**Depends on**: spec 55 implemented through task 8.6, and `bugfix/profanity-whole-word-matching` (whole-word `containsProfanity`, `app/backend/src/utils/profanityFilter.ts`) merged to main before Task Group 2 (merged in PR #528; the spec-55 branch must include it). The built spec-55 code is the source of truth for every rule (README decision 6); this design adds no engine, schema or UI change.
**Counts**: none are stated here. They are derived from `source/` by the tools; the current numbers are in the Totals block of `review/FINDINGS.md` (D19).

## 1. Overview

Two phases:

1. **Review (now).** A Python pipeline in `tools/` reads every Expansion_Stable in `source/` (review records and the collection, through one reader), converts them into Staged_Entries (`catalogue/`), validates them against Rule_Facts taken from the built code and against the expansion portraits, runs them through the built spec-55 code itself (`check-built.ts`), and renders the Expansion_Review_Pack. The product owner decides the Findings; the pipeline is re-run after every answer.
2. **Delivery (after spec 55 and Content_Approval).** The approved Staged_Entries are copied byte-identical into `app/backend/prisma/automaton-catalogue/`. Three spec-55 catalogue tests get cross-stable assertions, the heavy test activates every repository entry, and the existing deploy-time Catalogue_Sync adds every Expansion_Stable as a Draft_Automaton on ACC.

```
source/automaton-blueprints/*.json ─┐
source/collection/{NNN}-{key}/ ─────┴─source_records.py─┐
tools/decisions.json ───────────────────────────────────┴─convert.py──▶ catalogue/*.json ──(approved, after spec 55)──▶ app/backend/prisma/automaton-catalogue/
          │                                                   ▲              │
          └───────────────validate.py─────────────────────────┼──────────────┘──▶ review/findings.json, FINDINGS.md (Totals, status, findings)
                              ▲                               │
IMAGE_ROOT/app/frontend/public/assets/automatons/{key}/{slot}.webp ─┘ (V15 portraits, A13 portrait verdicts, Totals)
built code at APP_ROOT / PROFANITY_ROOT ──export-facts.ts──▶ tools/facts/facts.json ──▶ rules.py, refine_plan.py (selftest on every starter plan)
built starter JSON (APP_ROOT) + spec-55 review/CATALOGUE.md ──parse_starter.py──▶ tools/facts/starter.json
catalogue/*.json + built starters ──check-built.ts (built code at APP_ROOT / PROFANITY_ROOT)──▶ tools/facts/built-check.json ──▶ validate.py (V19)
catalogue/*.json + source art briefs + decisions ──render_catalogue.py──▶ review/CATALOGUE.md
```

`APP_ROOT` is the checkout with the built spec-55 code, `PROFANITY_ROOT` the checkout with the whole-word filter and `IMAGE_ROOT` the checkout with the expansion portraits. `PROFANITY_ROOT` defaults to `APP_ROOT`, `APP_ROOT` and `IMAGE_ROOT` to the repository root (README §3).

## 2. Pipeline components

| Component | Responsibility | Key behaviour |
|---|---|---|
| `tools/export-facts.ts` | Rule_Facts from the built code, run with the checkout's `tsx` from `$APP_ROOT/app/backend` | Loads from `APP_ROOT`: `WEAPON_DEFINITIONS` (`prisma/seed.ts`), `refinementStepCost` and `attributeIncrementCost` (`services/automaton/pricing.ts`), `getRefinementMagnitudeRange`, `calculateTrainingFacilityDiscount`, `ROBOT_ATTRIBUTES`, `SUBSCRIBABLE_EVENT_TYPES`, the repository strategies with their Goal bounds (`loadStrategyRegistry`), `BUILD_FOCUS_WEIGHTS` / `ATTRIBUTE_GROUPS` / `attributesOfGroup`, the catalogue limits and enums of `automatonCatalogueService.ts`, `ROBOT_NAME_MAX_LENGTH`, `TEAM_RULE_2V2` / `TEAM_RULE_3V3` / `requiredTeamNameCounts` (`automatonTeamRule.ts`) and the `canEquipToSlot` verdict table (`weaponSlots.ts`); from `PROFANITY_ROOT`: `PROFANITY_LIST` and `COMPOUND_MATCH_ENTRIES` (`profanityFilter.ts`). Records both roots and their commits. Writes only `tools/facts/facts.json`. |
| `tools/rules.py` | Rule tables from `facts.json`; the few remaining transcriptions with source comments; folder roots | Robots Goals, Refine Goal, Build_Focus weights and groups, loadouts, stances, limits, Catalogue_Key pattern, Team_Rule, `canEquipToSlot` and the robot price (`attributeIncrementCost`) all come from `facts.json`. Transcribed: `validateStableName` (3–30, `^[a-zA-Z0-9 _-]+$`, whole-word `containsProfanity` rules on the exported lists), `validateRobotName` (trimmed 1–50, `^[a-zA-Z0-9 _\-'.!]+$`), `safeName` + 3–32 + trimmed for team names, trimmed franchise and backstory text. `COLLECTION_DIR` (`source/collection/`), `IMAGE_ROOT` (environment, default the repository root) and `EXPANSION_IMAGE_DIR` (`$IMAGE_ROOT/app/frontend/public/assets/automatons/`). `check-built.ts` proves the profanity transcription agrees with the TypeScript filter on every name. |
| `tools/source_records.py` (new) | One reader for both source formats (R2.6, D13) | `review_records()` reads `source/automaton-blueprints/{key}.json` as they are; `collection_records()` maps every `source/collection/{NNN}-{key}/stable.json` to the same camelCase review record (§3). Private fields `_origin`, `_sourceFile`, `_droppedSourceFields`, `_bundleMatches` (the folder's `blueprints.json` agrees with `stable.json`) never reach `catalogue/`. Raises `SourceError` on a folder name that differs from `number` / `catalogue_key`, a missing required field or a Catalogue_Key that appears twice. `load_all()` returns review records first, then the collection by number. |
| `tools/parse_starter.py` | Starter fixture | Reads the built starter files in `$APP_ROOT/app/backend/prisma/automaton-catalogue/` and parses spec-55 `review/CATALOGUE.md` §3–§13 for art briefs and stated plan totals (asserted; the built and markdown stable and blueprint counts must agree, no expected count is typed in); writes `tools/facts/starter.json` with a doc-vs-code difference list (the built JSON wins). |
| `tools/refine_plan.py` (Plan_Generator) | Decision-35/36 plans | See §4. `--selftest` regenerates every starter plan of `tools/facts/starter.json` and must report all of them identical (`N/N`). |
| `tools/convert.py` | Source_Blueprints → Staged_Entries | Reads every source stable through `source_records.load_all()` and overlays `tools/decisions.json`: a register `_decisions` of the README §4 answers (number ≥ 1 without a gap, checks, answer, `changesContent`, `delegated`, date) and per Catalogue_Key the fields a decision changes (stable name, franchise label, backstory, team names, `strategy` (display name, decision 12), robot name, `artBrief`, `designation` canon or mass-produced, `portrait` verdict `aligned` or `new-portrait-needed`, chosen alternative), each naming its decision numbers. Delegated authoring is marked as such and listed per stable under "Changes from your draft" in `review/CATALOGUE.md`. `artBrief`, `designation` and `portrait` go to the review copy only, never to `catalogue/`. Decided Goal_Targets (`targetOverrides` by Build_Order position) are merged over the converted source override. Applies the field mapping in §3. Fails on an unknown strategy, `targetOverrides` key, decision key, field, decision number, designation or portrait verdict, and on content without a `changesContent` decision. A decided Goal_Target also fails the run when it names an unknown goal position, lies outside the Goal's bounds, sets more robots than blueprints (R3.7) or sets a final robots target below an earlier robots goal. Writes `tools/facts/conversion-log.json` with `origin`, `sourceFile` and `droppedSourceFields` per stable. `source/` is never edited. |
| `tools/check-built.ts` | Built-code check (R2.5), run from `$APP_ROOT/app/backend` | Loads the built functions: `validateCatalogueEntry` (`catalogueEntrySchema` in the context of the built catalogue tests) on every Staged_Entry and every starter; `loadCatalogueDirectory` on `catalogue/` and on the starter directory; uniqueness over every repository entry (Catalogue_Key, stable name exact and case-insensitive, robot name exact, team name exact); the whole-word verdict for every stable, team and robot name; a two-season `projectScenario` + `planNextStep` projection per entry with the income model and assertions of `strategyScenario.test.ts`. A stable name rejected only by the spec-55 branch's substring `containsProfanity` is reported as pending the whole-word rule. Writes only `tools/facts/built-check.json`; exit 0, 1 (failure) or 2 (a starter failed: harness defect). |
| `tools/validate.py` (Catalogue_Validator) | Findings, Totals, gates | Checks §5 on source and Staged_Entries, through the same reader; writes `review/findings.json` and the generated blocks of `review/FINDINGS.md`: the Totals block (D19), the status per check (Fixed in catalogue / Accepted by decision N / Open) and the finding tables; fails when a generated marker is missing. `--check-readme` derives the expected decision numbers from the register. `--check-spec` checks traces, the design map and optional tasks, and runs the hard-coded-count scan (D19). |
| `tools/render_catalogue.py` | Readable catalogue | `review/CATALOGUE.md` in the spec-55 §3 layout, deterministic; title, scope and totals texts derived from the entries; a short art-brief excerpt for collection robots (the first sentence of the brief's `Subject:` paragraph, else its first sentence, at most 200 characters) unless a decision authored a brief; "Changes from your draft" lines for strategy and portrait verdicts. |

All Python is standard library only (Python 3.9+). Nothing in the pipeline writes under `app/`.

## 3. Field mapping (source → §15.1 Catalogue_Entry)

### 3.1 Review record → Catalogue_Entry

| §15.1 field | Source | Transform |
|---|---|---|
| `schemaVersion` | — | `1` |
| `catalogueKey`, `stableName`, `backstory`, `eventOrder` | same names | as is |
| `franchise` | `franchiseLabel` | as is |
| `strategy.key` / `.version` | `strategy`, or the decided `strategy` (decision 12) | Swarm/Paragon/Duo/Trio/Tycoon/Generalist → lower-case key; version `1` |
| `strategy.targetOverrides` | `targetOverrides.robots` (else `targetRobots`), then the decided Goal_Targets of `tools/decisions.json` | `{ "<goal position>": N }` only where N ≠ the Goal default. Source conversion: Tycoon `{"20": 3}`, Generalist `{"14": 3}`. Decision 5 (spare blueprints): Paragon `{"3": 4, "8": 2}`, Duo `{"11": 6, "13": 3}`, Trio `{"12": 4}`, Generalist `{"14": 4}`. Decision 12 (Squadron as Trio): `{"12": 6}`. All others `{}` |
| `teamNames.twoVsTwo` / `.threeVsThree` | `teamNames["2v2"]` / `["3v3"]` | ordered by first slot; names only (slots are checked against the Team_Rule) |
| `blueprints[]` | `robots[]` | `slot`, `name`→`robotName`, `loadout`→`loadoutType`, `stance`, `yieldThreshold`, `buildFocus` lower-cased, `weaponPath[]` → `{ main, offhand? }` |
| `blueprints[].refinementPlan` | — | generated by the Plan_Generator |

Dropped: `number`, `fit`, `conceptIdentity`, `openingRobots`, `targetRobots`, `adminMaximumRobots`, `review`, `alternativeBlueprints`; per robot `blueprintId`, `sourceAlias`, `nameBasis`, `availability`, `review` (art briefs are carried into `review/CATALOGUE.md` only), and `listPriceCredits` per stage.

### 3.2 Collection → review record (`tools/source_records.py`)

The snake_case `source/collection/{NNN}-{key}/stable.json` is mapped to the review record of §3.1; §3.1 then applies unchanged.

| Collection | Review record | Notes |
|---|---|---|
| `number`, `catalogue_key`, `name`, `franchise`, `backstory` | `number`, `catalogueKey`, `stableName`, `franchiseLabel`, `backstory` | folder name must equal `{number:03d}-{catalogue_key}`; `number` is dropped by §3.1 |
| `strategy` (display name) | `strategy` | Squadron has no spec-55 key: converted only through decision 12 (D14) |
| `opening_robots`, `target_robots`, `max_planned_robots` | `openingRobots`, `targetRobots`, `adminMaximumRobots` | only the target is used (§3.1) |
| `target_overrides` (`{}`, `{"robots": N}`, `null`, or absent) | `targetOverrides` | absent or `null` → `{}` |
| `teams.2v2` / `teams.3v3` `[{name, slots, forms}]` | `teamNames.2v2` / `.3v3` `[{name, slots}]` | `forms` dropped |
| `event_order` | `eventOrder` | as is |
| `alternatives` / `replacement_alternatives` | `alternativeBlueprints` | dropped by §3.1 (decision 2) |
| robot `slot`, `name`, `availability`, `blueprint_id`, `source_identity` | `slot`, `name`, `availability`, `blueprintId`, `sourceAlias` | robots sorted by `slot` |
| robot `loadout`, `stance`, `yield_threshold`, `build_focus` | `loadout`, `stance`, `yieldThreshold`, `buildFocus` | as is (lower-cased by §3.1) |
| robot `weapon_path[{stage, main_weapon, offhand_weapon, list_price_credits}]` | `weaponPath[{mainWeapon, offhandWeapon, listPriceCredits}]` | ordered by `stage` |
| robot `refinement_plan[{operation, weapon, hand, attribute, magnitude, cost_credits, workshop_level}]` | `refinementPlan[{tier, weapon, weaponSlot, attribute, magnitude, costCredits, workshopLevel}]` | checked as source plans, then regenerated (decision 6) |
| robot `art_brief`, `refinement_total_credits`, `minimum_roster_expansion_level`, `range_from_weapons`, `refinement_note` | `review.artBrief`, `review.*` | the full image prompt; `CATALOGUE.md` shows the short excerpt of §2 |

Cannot be mapped (no spec-55 home; listed per stable in `tools/facts/conversion-log.json` as `droppedSourceFields`):

- Stable level: `strategy_personality`, `purchasing_plan`, `equipment_budget`, `strategy_review_limit`, `source_notes`, `source_documents`, `source_franchise_label`, `blueprint_status`, `blueprint_origin`, `folder`, `history_image_count`.
- Per robot: `role`, `equipment_interpretation`, `combat_rationale`, `tuning_plan`, `design_basis`, `missing_fields`, `files`, `selected_image`, `folder`, `refinement_note`.
- Per refinement step: `effect`, `occurrence`, `prestige_gate`, `requirements`, `source_text`, `base_value`, `result_value`.
- Also: team `forms`, the Squadron purchase order and the collection's authored plans.

## 4. Plan_Generator rules

Reading of decisions 35–36 (spec-55 `review/CATALOGUE.md` §2, `STRATEGIES.md` §1.8) that reproduces every starter plan:

1. Sharpen, Sharpen, Forge, Forge on every non-shield weapon of the final Weapon_Stage. `dual_wield` interleaves main/offhand tier by tier, then the main hand's fifth step, then the offhand's. `weapon_shield` does the weapon first, then the shield.
2. Fifth step per non-shield weapon: a Hone (attribute on the weapon, bonus + m ≤ 10) or an Augment (attribute absent) qualifies when it is strictly cheaper than +m on the robot. The robot price is the built `attributeIncrementCost` (`pricing.ts`, not `calculateDiscountedUpgradeCost`) summed per level from level ⌈group weight × last milestone before Max⌉, at the strategy's season-end Training Facility level and the robot count at the stable's robots target after the converted and decided overrides (Swarm L1/11, Paragon L10/1 or 2, Duo L8/2 or 3, Trio L9/3, 4 or 6, Tycoon L6/3, Generalist L7/3 or 4). Groups are tried in Build_Focus priority order; within the first group that has a candidate, the largest magnitude wins, then Hone before Augment, then `ROBOT_ATTRIBUTES` order. Falling through to the second group is needed to match Proto Man, Roll, Soundwave, Guntank, Ironhide and Ratchet.
3. Shields: Hone +1 per point of each negative bonus (`ROBOT_ATTRIBUTES` order), at most 5 steps, only where ₡10,000 is below +1 on the robot at that attribute's group level. On the Aegis Bulwark that is five Hone +1 Evasion Thrusters, except in a one-robot Paragon (none). A one-robot Paragon also gets no fifth step at 90% off (STRATEGIES §1.8); a two-robot Paragon (80% off) gets the fifth step the value rule gives.
4. Every step passes the four shared validators' rules cumulatively per weapon (slot cap 5, Sharpen/Forge ≤ 2, stack cap +10, Hone needs the attribute, Augment needs it absent, no DPS tier on a shield).

The plans are an output to confirm, not authored content (Requirement 1.4): every step follows from fields the product owner wrote.

## 5. Checks

Rule checks run on the source and again on the Staged_Entries. A Finding counts once on the source; `catalogue/` shows the residual. The analytical checks run once more on the source with `tools/decisions.json` applied (the decided pass). Counts per check are generated in `review/FINDINGS.md`.

| ID | Rule | Class |
|---|---|---|
| V00 | §15.1 shape of each Staged_Entry (keys, no image key) | Blocking |
| V01 | Catalogue_Key format, unique, no starter collision, equals file name (review record) or folder name (collection) | Blocking |
| V02 | `validateStableName` with the whole-word `containsProfanity`; unique case-insensitive across the starters and every Expansion_Stable | Blocking |
| V03 | `validateRobotName` rules; exact uniqueness across every repository blueprint (whole-word profanity on robot and team names: Needs product-owner decision, not enforced) | Blocking |
| V04 / V05 | franchise 1–60, backstory 1–400, both trimmed (`trimmedText`) | Blocking |
| V06 | strategy maps to a key (Squadron only through decision 12) | Blocking |
| V07 | robots Goal_Targets ≤ blueprints ≤ `catalogueLimits.maxBlueprints`, contiguous slots (R3.7, decision 24) | Blocking |
| V08 | `targetOverrides` conversion record (out-of-bounds = Blocking) | Cosmetic |
| V09 | Team_Rule slots, `requiredTeamNameCounts`, 3–32 + `safeName` + trimmed, distinct within the stable and unique across every repository entry (R3.6, decision 23, README decisions 3 and 15) | Blocking |
| V10 | Event_Order = the 9 `SUBSCRIBABLE_EVENT_TYPES` (R3.5) | Blocking |
| V11 | weapons exist; `canEquipToSlot` and loadout shape (R3.3) | Blocking |
| V12 | 2 stages, top-priced final weapon per hand type and range, same range band (decision 25) | Blocking |
| V13 | Refinement_Plan present, value-ordered, validator-clean; on Staged_Entries also the value rule (R3.4, decisions 35–36) | Blocking |
| V14, A05 | source refinement and list prices vs code | Cosmetic |
| V15 | images (decision 27): no placeholder reference; every Blueprint_Slot of every Expansion_Stable has `{slot}.webp` under `EXPANSION_IMAGE_DIR`, a 512×512 WebP by its header; a malformed image or an image folder without a Catalogue_Entry is Blocking; a missing image is Cosmetic | Blocking / Cosmetic |
| V16 | franchise duplication: a label shared by several stables (decisions 7, 16) | Needs product-owner decision |
| V18 | malformed label: markdown residue, slash, misused dash, parentheses, instruction, year, medium or authorship annotation after the dash, fan/web-fiction note, bare publisher label (decisions 7, 16) | Needs product-owner decision |
| V17 | enums (R3.2) | Blocking |
| V19 | `tools/facts/built-check.json` from `check-built.ts`: any failure, a stale report (catalogue hash or roots changed) or a profanity transcription disagreement; stable names pending the whole-word rule are reported, not failed (R2.5, D11) | Blocking |
| A01–A04, A08, A09, A12 | no slot beyond the target, collisions (case-insensitive, normalised, robot = stable/team name), generic names, templated backstories, alternatives, sensitive content (including `portrayed by` likeness wording), spare blueprint above the target | Needs product-owner decision |
| A13 | portrait alignment (D17): every slot whose name or art brief a decision changed is listed until `decisions.json` records its portrait verdict; a slot with verdict `new-portrait-needed` stays a decided item and is counted in the Totals block | Needs product-owner decision |
| A07 | source plans R3.4 rejects | Blocking |
| A11 | source consistency (review records: bundle, both markdown files, validation report, review fields; collection: `blueprints.json` agrees with `stable.json`) | Cosmetic |

## 6. Decisions

- **D1 — Rule inputs from the built code, located by `APP_ROOT` / `PROFANITY_ROOT`.** Rule_Facts come from one TypeScript export; Python never re-implements a price or bonus. Rationale: one source of truth, nothing written to `app/` or to either checkout.
- **D2 — Regenerate every Refinement_Plan.** Source plans are empty or misordered; the generator is proven on every starter plan. The source defect stays a Blocking Finding marked "applied", for confirmation (README decision 6).
- **D3 — Everything else is copied faithfully.** Names, teams, backstories and weapons are not corrected by the tools; defects are reported (Requirement 1.4). The only content changes are the recorded decisions in `tools/decisions.json`; where the product owner delegated the writing to the spec author (README decisions 3, 7, 14, 15, 16 and 18: team names, robot names and art briefs, franchise labels), the register marks the decision `delegated` and `review/CATALOGUE.md` lists every such change per stable for review.
- **D4 — Alternatives dropped.** Spec 55 has one Robot_Blueprint per slot; `alternativeBlueprints` go to a pick-or-discard decision.
- **D5 — Generated review documents.** `review/CATALOGUE.md`, the Totals block and the FINDINGS tables are generated so they cannot drift from `catalogue/`. README and the FINDINGS narrative are hand-written.
- **D6 — Delivery by copy.** The approved Staged_Entry is the delivered file, byte for byte (`cmp`). No second conversion at delivery time.
- **D7 — Coverage_Matrix stays starter-defined** (README decision 11). The matrix rows remain those of spec-55 `review/CATALOGUE.md` §14. `automatonCatalogueCoverage.test.ts` keeps the union assertion and adds a starter-only assertion. Alternative considered: the matrix over all repository entries only. Rejected, because removing an Expansion_Stable could then silently move coverage.
- **D8 — R10.9 amended here.** Requirement 4.2 replaces spec 55's fixed starter count with "the Starter_Stable Catalogue_Entries … plus every Expansion_Stable Catalogue_Entry approved …, whatever their number", without editing spec 55, as decision 32 anticipated ("a future spec").
- **D9 — No activation by this spec.** Catalogue_Sync only adds drafts; activation stays an admin action, in batches (spec-55 impact item 5), and has no cap (D18).
- **D10 — Whole-word profanity rule as a prerequisite** (README decision 1). The four stable names "Hero Factory Assembly", "Nindroid Assembly Line", "Robocraft Assembly Yard" and "Wanzer Assembly Corps" are kept; `bugfix/profanity-whole-word-matching` (whole-word `containsProfanity`, `app/backend/src/utils/profanityFilter.ts`) must be merged to main before Task Group 2, and task 1.2 confirms it. The same rule keeps the collection stable names with 'ass' or 'crap' inside a word ("HK Assassin Protocol", "Infinite War Assembly", "Kaylon Assembly Array", "Striker Assembly Wing", "Chimera City Scrapworks", "Scrap Garden Restoration Shop"); `check-built.ts` reports every such name as pending the whole-word rule until the spec-55 branch includes the merge. Rationale: keeps the four franchise-true names, and the substring match was the defect. Alternative considered: renaming the four stables. Rejected, because it would change product-owner content to work around a filter defect.
- **D11 — Built-code check** (README decision 6). `tools/check-built.ts` runs every Staged_Entry, together with the starters, through the built `catalogueEntrySchema`, `loadCatalogueDirectory`, cross-stable uniqueness and a two-season `projectScenario` projection; `validate.py` reports its result as check V19. Rationale: the built schema and strategy runner are the source of truth (decision 6), and the starters act as a control group. Alternative considered: Python transcriptions only. Rejected, because a transcription can drift from the code it copies.
- **D12 — No idle spare blueprints** (README decision 5). Where a stable has a blueprint above its robots target and that spare is a good candidate, the robots Goal_Target is raised to the blueprint count, with the Booking Office Goal_Target the larger roster needs (STRATEGIES.md §6 and §7: Paragon goal 3 → L4, Duo goal 11 → L6; Trio and Generalist already default to L6). The values are recorded as `targetOverrides` in `tools/decisions.json`; check A12 counts stables with a blueprint above the target. Team names need no change, because the built `requiredTeamNameCountsFor` counts them from the blueprint count. Rationale: every robot the product owner drafted is built. Alternative considered: keep the spares idle, as the starters do. Rejected by the product owner.
- **D13 — Two source readers, one review-record shape** (README decision 20 context, R2.6). `tools/source_records.py` maps the collection into the review record `convert.py` already reads (§3.2), so every check and the converter run unchanged on both origins and the review-format output stays byte-identical. Alternative considered: a second converter for the collection. Rejected, because two converters can drift and every check would need a second input path.
- **D14 — Squadron converts as Trio with robots target 6** (README decision 12). The Squadron stables' roster, team layout (two 3v3 and three 2v2 teams) and event order fit Trio at 6 robots; the overlay is recorded in `tools/decisions.json` (`strategy: "Trio"`, `targetOverrides {"12": 6}`), plans are regenerated and the Squadron purchase order is dropped. Alternatives considered: a new `squadron` strategy (rejected: an engine change outside this spec) and deferring the stables (rejected by the product owner, "Approved").
- **D15 — Renames close to the original** (README decision 13). Names the built validators reject (apostrophes, non-ASCII letters, em dashes, length) are renamed in `tools/decisions.json` to plain ASCII with minimal shortening. Alternative considered: free renames. Rejected, because the product owner asked to stay as close to the original as possible.
- **D16 — Catalogue-wide uniqueness** (README decision 15). Stable, robot and team names are unique across the starters and every Expansion_Stable (exact, case-insensitive and normalised; a robot name never equals a stable or team name). Resolution rule: an original name beats a decision-authored one; where both are original, the higher-numbered stable changes; canon or mass-produced designations keep their numbered line inside one stable. Alternative considered: accepting repeats across stables. Rejected by the product owner ("Make them unique").
- **D17 — Names follow the portraits** (README decision 18). Portraits are not regenerated. Every slot whose name or art brief a decision changed is viewed against its image, and the name and brief follow the image; `decisions.json` records the verdict per slot (`aligned` or `new-portrait-needed`), and check A13 keeps every unverdicted slot open. Alternative considered: regenerating portraits after renames. Rejected by the product owner ("Align images and names").
- **D18 — No activation cap; the heavy test runs every repository entry** (README decision 19, R5.4, Requirement 7). The heavy fixture activates every repository Catalogue_Entry, records seconds per Automaton per Turn_Trigger and fails on a budget skip; the scaling of the built engine is recorded in `review/SCALING.md` with its open items. Alternatives considered: a cap until a larger heavy run passes (rejected by the product owner: "This should be able to scale to 10000 Automatons") and keeping spec 55's fixed population (rejected, because it proves nothing about the catalogue actually delivered).
- **D19 — Derived counts and one generated Totals block** (README decision 20, R1.5). The tools derive every count from `source/`, `catalogue/`, the starter facts (`tools/facts/starter.json`, built from the starter catalogue) and the portrait folder; `validate.py` writes the Totals block at the top of `review/FINDINGS.md`; the hand-written documents point to it. `validate.py --check-spec` scans `requirements.md`, `design.md`, `tasks.md` and `review/README.md` and fails on any current derived total (expansion and starter: stables, blueprints, team names, portraits) or stale baseline followed within three words by a catalogue noun, on a starter total written as a selftest ratio (`N/N`) or as a term of shell arithmetic, and on any literal stable range of the earlier drafts; there is no bypass marker. Alternative considered: keeping counts in the documents and updating them by hand. Rejected by the product owner ("don't hardcode it or update it").

## 7. Test changes (delivery phase)

| File (spec 55) | Change | Requirement |
|---|---|---|
| `services/automaton/__tests__/catalogueSchema.test.ts` | Cross-entry uniqueness over all repository files: Catalogue_Key, `stableName.toLowerCase()`, exact `robotName`, exact team name; the failure message names both keys. Accept and reject fixtures. Also replaces the starter-only assertions the built suite hard-codes (entry, blueprint, team-name and stable-name counts of the starters, the `toEqual` strategies map over all entries, the image-field loop over the starter keys only) with assertions derived from the folder. | R3.4, R5.1 |
| `services/automaton/__tests__/catalogueImages.test.ts` | Fixture cases with a temporary directory: an expansion key with `1.webp` accepted, a slot beyond the entry's blueprints rejected. | R4.4, R5.2 |
| `services/automaton/__tests__/automatonCatalogueCoverage.test.ts` | Second assertion over the starter keys only (list of keys in the test). | R5.3 |
| `tests/helpers/automatonHeavyFixture.ts` | Population = every file of the repository Automaton_Catalogue; `HEAVY_POPULATION_SIZE`, `GENERATED_ENTRY_COUNT` and `generatedEntries` go; `STARTER_CATALOGUE_KEYS` stays for the starter-subset checks. | R5.4, R7.1 |
| `tests/integration/automatonMultiSeason.test.ts` | Asserts every repository entry is active; per Turn_Step records `durationMs`, Automatons processed and their quotient per Turn_Trigger, plus the budget-skip count, in the `[automaton-heavy]` log for the implementation note; fails on any `step_budget_exhausted` record. Phase timeouts derived from the population. | R5.4, R7.1 |

All files keep their spec-55 tier in `jest.tiers.js`; `pnpm run test:tiers:verify` must pass.

## 8. Requirement → design map

| Criterion | Design |
|---|---|
| R1.1 | `review/` documents (§1, D5); `review/SCALING.md`, `COLLECTION_205_GAPS.md`, `COLLECTION_205_VERIFICATION.md` as supporting records |
| R1.2 | `tools/decisions.json` overlay and pipeline re-run (§2), README Decisions list |
| R1.3 | gating (§1 phase 2), D10, tasks Group 0 and Group 1 |
| R1.4 | D2, D3, §4 last paragraph |
| R1.5 | D19; `validate.py` Totals block and `--check-spec` count scan (§2) |
| R2.1 | §3 mapping, check V00, `source_records.load_all()` |
| R2.2 | §3 `targetOverrides` row, check V08, D12, D14 |
| R2.3 | §4, `refine_plan.py --selftest` |
| R2.4 | deterministic writers (§2), D5 |
| R2.5 | §2 check-built.ts, D11, check V19 |
| R2.6 | §3.2, `tools/source_records.py` (§2), D13, D14; Totals block file-count line |
| R3.1 | §5 checks, D1 |
| R3.2 | §5 classes, `findings.json` / FINDINGS tables, status per check |
| R3.3 | `validate.py` exit status (§2) |
| R3.4 | V01, V02, V03, V09, A02; D16; `check-built.ts` uniqueness; §7 `catalogueSchema.test.ts` |
| R3.5 | §5 residual, tasks Group 0 |
| R3.6 | V15, A13 (§5), D17, Totals block portrait line |
| R4.1 | D6 |
| R4.2 | D8 |
| R4.3 | D9; spec-55 §15.2 unchanged |
| R4.4 | spec-55 §16 convention; V15; §7 `catalogueImages.test.ts` |
| R5.1 | §7 |
| R5.2 | §7 |
| R5.3 | D7, §7 |
| R5.4 | §7 heavy rows, D18, §11 |
| R6.1 | §9 |
| R6.2 | tasks final group, Verification Criteria |
| R7.1 | D18, D9 |
| R7.2 | §11, `review/SCALING.md` |
| R7.3 | §10, §11, `review/SCALING.md` §6, README §6 |

## 9. Documentation impact

- `docs/game-systems/PRD_AUTOMATON_STABLES.md` (created by spec 55): the catalogue section names the Starter_Stables plus the Expansion_Stables of this spec (no count; "see the Automaton_Catalogue folder"), how they were reviewed (this spec's `review/`) and delivered, Squadron converted as Trio (decision 12), and no activation cap with a pointer to `review/SCALING.md`.
- `docs/guides/AUTOMATON_OPERATIONS_GUIDE.md` (spec 55): after the deploy every Expansion_Stable appears as a Draft_Automaton; there is no activation cap; activate in batches through the per-stable activation, because each new Active_Automaton's first turn is an opening build and the Turn_Step budget serves only a limited number of those per day; the open items of `review/SCALING.md` §6; add Repository_Images for expansion slots by convention, together with or after the entry.
- `docs/architecture/SEED_DATA_SPECIFICATION.md`: the catalogue entry count is whatever the folder holds (derived, not stated), and the cross-stable uniqueness rule of `catalogueSchema.test.ts`.
- `docs/implementation_notes/AUTOMATON_CATALOGUE_EXPANSION.md` (new): the verification record (Requirement 6.2) with the heavy test's seconds per Automaton per Turn_Trigger (R5.4).
- Unchanged: `docs/architecture/PRD_SERVICE_DIRECTORY.md` (no new service), steering files (no new rule), player guide (no player decision; backlog #61 still governs franchise/backstory display).

## 10. Out of scope

- Matchmaking (spec-55 decision 34), achievements (rarity counts humans only, decision 38), new strategies or Strategy_Versions (including a `squadron` strategy, D14), an alternative-blueprint feature, changes to `containsProfanity` (made by `bugfix/profanity-whole-word-matching`, a prerequisite, not part of this spec), activation of Draft_Automatons, and any UI.
- The engine changes of `review/SCALING.md` §6: bounded parallel Turn_Steps, fair rotation after budget skips, a budget scaled with the population or chunked steps, fewer statements per charged action, bulk skip marking with a lease heartbeat, batched or background admin operations, and a battle-volume measurement. They are open items for the product owner (R7.3).

## 11. Scaling

Full report with `path:line` evidence: `review/SCALING.md`. Summary:

- As built, the engine runs every Active_Automaton one after another in one Turn_Step per day, within a fixed 300 s budget; Automatons not reached are skipped, always the highest `User.id` first (verified).
- The opening build at each season start is the expensive turn: about 0.6–2.6 s per Automaton from the recorded heavy runs, so one Turn_Step serves roughly 115–470 opening builds (estimated). At the current repository size it is borderline; at 1,000 the openings spill over several days; at 10,000 they need hours against a 5-minute budget, and even the steady-state turn alone fills most of the budget (estimated).
- Sync, admin listing and matchmaking scale linearly with no hard stop; the Status_Bar, activate-all and a key-less export read every profile (verified code, estimated cost).
- No activation cap is added (D18). The heavy test over every repository entry measures the real figure (R5.4); the engine changes are open items (§10, R7.3).
