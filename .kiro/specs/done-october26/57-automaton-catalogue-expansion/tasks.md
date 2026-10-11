# Implementation Plan: Automaton Catalogue Expansion

## Overview

Spec 57 first finishes the content review of every Expansion_Stable in `source/` (Group 0, can run now). After spec 55 is implemented through its task 8.6 (Group 1), it delivers the approved Staged_Entries, extends the catalogue tests and the heavy test, proves the sync, updates the documentation and runs the Verification Criteria. All tasks are mandatory and run in group order. Each group lists its requirement trace. No task states a catalogue or starter count: counts are derived from `source/` and the built starter catalogue (`tools/facts/starter.json`) and read from the Totals block of `review/FINDINGS.md` (decision 20).

## Task Group 0: Content_Approval of the Expansion_Review_Pack

_Requirements: R1.1, R1.2, R1.4, R1.5, R2.1, R2.2, R2.3, R2.4, R2.5, R2.6, R3.1, R3.2, R3.3, R3.4, R3.5, R3.6, R7.2, R7.3_

- [x] 0.1 Present `review/README.md`, `review/FINDINGS.md` (opening with the Totals block), `review/CATALOGUE.md` and the supporting `review/SCALING.md` (status headers, per-section checklists, numbered open decisions 1–20, open items in README §6) to the product owner (R1.1, R1.5, R7.2, R7.3).
- [x] 0.2 Record each answered decision of `review/README.md` §4 (decisions 1–20) as exactly what the answer says in `tools/decisions.json`: one entry in the `_decisions` register per decision (number, checks, answer, `changesContent`, `delegated`, date; numbers from 1 without a gap), and per Catalogue_Key the changed fields (stable name, franchise label, backstory, team names, strategy, robot name, art brief, designation, portrait verdict, chosen alternative, Goal_Targets (`targetOverrides`)) with their decision numbers; overlaid by `convert.py`. Content the product owner delegates to the spec author is marked `delegated` and listed per stable in `review/CATALOGUE.md`. Record each answer in the README Decisions list without counts. `source/` and `catalogue/` are never edited by hand, and no content is made up by the tools (R1.2, R1.4).
- [x] 0.3 Apply the mechanical decisions: Squadron stables as Trio with `targetOverrides {"12": 6}` (decision 12), renames close to the original (decision 13), franchise labels (decisions 7 and 16), team and robot names chosen with the portrait (decisions 3, 14 and 18), catalogue-wide uniqueness by the decision-15 rule (R2.2, R2.6, R3.4).
- [x] 0.4 For every slot that check A13 lists, view its portrait under `app/frontend/public/assets/automatons/{catalogueKey}/{slot}.webp`, make the name and art brief follow the image, and record the verdict (`aligned` or `new-portrait-needed`) in `tools/decisions.json`; list the slots needing a new portrait (or state none) in README decision 18 (R3.6).
- [x] 0.5 Re-run the pipeline in order, with `APP_ROOT` / `PROFANITY_ROOT` / `IMAGE_ROOT` as in `review/README.md` §3: `export-facts.ts`, `parse_starter.py`, `refine_plan.py --selftest` (every starter plan identical, exit 0), `convert.py`, `check-built.ts`, `validate.py`, `render_catalogue.py`, `validate.py --check-readme`, `validate.py --check-spec`. Run it twice and confirm `catalogue/` and `review/CATALOGUE.md` are byte-identical between runs, that `check-built.ts` exits 0, and that the Totals block's line "`catalogue/*.json` files = source stables" ends in "yes" (R2.1, R2.2, R2.3, R2.4, R2.5, R2.6, R3.1, R3.2, R3.3).
- [x] 0.6 Confirm `review/findings.json` `catalogueResidualByCheck` is empty, i.e. zero Blocking Findings in the Staged_Entries, including cross-stable uniqueness and every A13 slot verdicted; confirm the Totals block reports no invalid portrait and no image folder without a Catalogue_Entry (R3.4, R3.5, R3.6).
- [x] 0.7 Record Content_Approval: each Expansion_Review_Pack document `Status: Approved — <date>`, every checklist ticked (R1.1).

## Task Group 1: Spec-55 prerequisite check

_Requirements: R1.3, R2.5_

- [x] 1.1 Confirm spec 55 is implemented through task 8.6: `app/backend/prisma/automaton-catalogue/` holds the Starter_Stable entries (the starter row of the Totals block), and `cd app/backend && pnpm run test:unit -- catalogueSchema catalogueImages automatonCatalogueCoverage` passes. If not, stop. No later task starts before 0.7, 1.1 and 1.2 are done (R1.3).
- [x] 1.2 Confirm `bugfix/profanity-whole-word-matching` is merged to main: `app/backend/src/utils/profanityFilter.ts` exists, `cd app/backend && pnpm run test:unit -- profanityFilter` passes, and `tools/check-built.ts` run with the default roots reports no stable name pending the whole-word rule. If not, stop: no Group 2 task starts (R1.3, R2.5).

## Task Group 2: Delivery

_Requirements: R4.1, R4.2, R4.4_

- [x] 2.1 Copy every approved `catalogue/{key}.json` to `app/backend/prisma/automaton-catalogue/{key}.json`; verify that the number of delivered files equals the starter entries of `tools/facts/starter.json` plus the number of `catalogue/*.json` files, and that the number of `catalogue/*.json` files equals the source stables (the shell arithmetic of Verification Criterion 2), `cmp` per file, and that `git diff --diff-filter=M --name-only main -- app/backend/prisma/automaton-catalogue/` prints nothing, so no starter file changed (R4.1, R4.2).
- [ ] 2.2 Commit the expansion Repository_Images at `app/frontend/public/assets/automatons/{catalogueKey}/{slot}.webp` in the same change as their entries, never before; missing images stay missing. First confirm that every slot A13 listed has a decision-18 verdict and that no slot marked `new-portrait-needed` is committed with the old image unless the product owner accepts it (R4.4).
  Deferred: commit of the entries and their Repository_Images together is left to the product owner (instruction: do not commit); checks done (every A13 slot verdicted, none `new-portrait-needed`, every image folder has an entry and every entry slot has an image).

## Task Group 3: Catalogue tests and heavy test

_Requirements: R3.4, R4.4, R5.1, R5.2, R5.3, R5.4, R7.1_

- [x] 3.1 Extend `app/backend/src/services/automaton/__tests__/catalogueSchema.test.ts` (design §7): replace the hard-coded starter-only assertions (entry, blueprint, team-name and stable-name counts of the starters, the `toEqual` strategies map over all entries, the image-field loop over the starter keys only) with assertions derived from the repository folder, and add cross-entry uniqueness of Catalogue_Key, case-insensitive stable name, exact robot name and exact team name, with accept and reject fixtures whose failure message names both entries (R3.4, R5.1).
- [x] 3.2 Extend `catalogueImages.test.ts` with temporary-directory cases: an existing expansion slot image is accepted, a slot beyond the entry's blueprints is rejected (R4.4, R5.2).
- [x] 3.3 Extend `automatonCatalogueCoverage.test.ts` with a second Coverage_Matrix assertion over the Starter_Stable keys only (R5.3).
- [x] 3.4 Change the heavy test (design §7, D18): `app/backend/tests/helpers/automatonHeavyFixture.ts` takes its population from every file of the repository Automaton_Catalogue (remove `HEAVY_POPULATION_SIZE`, `GENERATED_ENTRY_COUNT` and the generated entries; keep `STARTER_CATALOGUE_KEYS` for starter checks); `app/backend/tests/integration/automatonMultiSeason.test.ts` asserts that every repository entry is active, logs per Turn_Step the `durationMs`, the Automatons processed and their quotient per Turn_Trigger plus the budget-skip count under `[automaton-heavy]`, and fails on any `step_budget_exhausted` Turn_Record. Add no activation cap and do not raise `TURN_STEP_BUDGET_MS` (R5.4, R7.1).
- [x] 3.5 Run `cd app/backend && pnpm run test:unit -- catalogueSchema catalogueImages automatonCatalogueCoverage`, `pnpm run test:heavy -- automaton` and `pnpm run test:tiers:verify`. Record the heavy test's seconds per Automaton per Turn_Trigger; if a Turn_Step is budget-skipped, record the failure with the matching open item of `review/SCALING.md` §6 for the product owner (R5.1, R5.2, R5.3, R5.4).

## Task Group 4: Sync dry run

_Requirements: R4.3_

- [x] 4.1 On a local database with the spec-55 migrations, run `cd app/backend && pnpm run automaton:sync --dry-run` and confirm that the number of "would add draft" lines equals the number of `catalogue/*.json` files (the Expansion_Stables row of the Totals block), 0 conflicts, no schema error; then run without `--dry-run` twice and confirm the second run adds nothing (R4.3).

## Task Group 5: Documentation

_Requirements: R6.1, R7.1, R7.3_

- [x] 5.1 Update `docs/game-systems/PRD_AUTOMATON_STABLES.md`: the catalogue is the Starter_Stables plus the Expansion_Stables of spec 57, with no count (point to the Automaton_Catalogue folder); link this spec's `review/` as the approval record; note Squadron converted as Trio (decision 12) and that there is no activation cap, with a link to `review/SCALING.md` (R6.1, R7.1).
- [x] 5.2 Update `docs/guides/AUTOMATON_OPERATIONS_GUIDE.md`: every Expansion_Stable appears as a Draft_Automaton after the deploy; there is no activation cap; activate in batches through the per-stable activation rather than "activate all", because each new Active_Automaton's first turn is an opening build and the 300 s Turn_Step budget serves only a limited number per day; list the open items of `review/SCALING.md` §6; add expansion Repository_Images only together with or after their entry (R6.1, R7.1, R7.3).
- [x] 5.3 Update `docs/architecture/SEED_DATA_SPECIFICATION.md`: the catalogue entry count is whatever `app/backend/prisma/automaton-catalogue/` holds (derived, not stated), and the cross-stable uniqueness rule of `catalogueSchema.test.ts` (R6.1).

## Task Group 6: Final verification

_Requirements: R6.2, R1.1, R1.3, R1.5, R2.4, R3.5, R4.1, R4.3, R5.4, R6.1, R7.1_

- [x] 6.1 Run Verification Criteria 1–7 from `requirements.md` and record each as passed, failed or blocked, with output excerpts or reasons, in `docs/implementation_notes/AUTOMATON_CATALOGUE_EXPANSION.md`, including the heavy test's seconds per Automaton per Turn_Trigger; a check is recorded as passed only if it completed successfully (R6.2).
- [x] 6.2 Move the spec folder to `.kiro/specs/done-{month}{year}/` (spec lifecycle) (R6.2).
