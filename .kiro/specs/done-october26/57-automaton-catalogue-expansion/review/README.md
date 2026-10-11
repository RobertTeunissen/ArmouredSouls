# Spec 57 — Content Review Pack

**Status**: Approved — 11 October 2026
**Approval**: Content_Approval given by the product owner in conversation on 11 October 2026, after reviewing this pack ("You have my approval for the … other automaton stables").
**Spec**: 57 — `automaton-catalogue-expansion` (requirements, design and tasks in the parent folder)

This pack is the content gate of spec 57. It turns every expansion stable you drafted in `../source/` into spec-55 Catalogue_Entries, checks them against every approved spec-55 rule and lists what needs your decision. Nothing in it touches application code. Nothing moves into `app/backend/prisma/automaton-catalogue/` until this pack is approved **and** spec 55 (including the whole-word profanity fix) is implemented (§5).

This file states no catalogue or starter count. The current numbers (starter and expansion stables, robots, team names, strategies, portraits, findings, decisions) are in the generated Totals block at the top of `FINDINGS.md` (decision 20); the counts per check are in its "Status per check" table.

---

## 1. Documents and status

| Document | What it is | Status |
|---|---|---|
| `README.md` (this file) | Status, sources, pipeline, open decisions, gating, open engine items | Approved — 11 October 2026 |
| `FINDINGS.md` | Opens with the generated Totals block and a generated status per check (fixed in catalogue / accepted by decision / open); then every finding, classified Blocking / Needs product-owner decision / Cosmetic, with counts per check and per stable, recommended fixes and the spec-55 impact list | Approved — 11 October 2026 |
| `CATALOGUE.md` | Every expansion stable in the spec-55 `CATALOGUE.md` §3 layout, generated from `../catalogue/`: fields, teams, event order, robots with art briefs and image paths, weapon paths, refinement plans with costs, storage notes, changes from your draft; one approval checklist per section | Approved — 11 October 2026 |
| `SCALING.md` | Read-only investigation of the built spec-55 engine at larger populations (decision 19): how a cycle runs Automatons, cost per Automaton, extrapolation, bottlenecks with `path:line`, sync, admin and matchmaking effects, open engine items, verified vs estimated | Investigation |
| `COLLECTION_205_GAPS.md` | Dated gap check of your 11 October collection against spec 57 (the input to decisions 12–20) | Record (11 Oct 2026) |
| `COLLECTION_205_VERIFICATION.md` | Raw evidence of that gap check | Record (11 Oct 2026) |
| `findings.json` | Machine-readable findings (the source of the FINDINGS.md tables and the Totals block) | generated |
| `../catalogue/{catalogueKey}.json` | One converted Catalogue_Entry per source stable, in exactly the spec-55 design §15.1 format | Approved (delivered by Task Group 2) |
| `../tools/` | Conversion and validation scripts plus their rule-input facts | tooling |
| `../tools/check-built.ts` → `../tools/facts/built-check.json` | Check against the built spec-55 code: `catalogueEntrySchema`, `loadCatalogueDirectory` with the starters, cross-stable name uniqueness, whole-word profanity verdicts and a two-season strategy-runner projection per entry (read by `validate.py` as check V19) | tooling / generated |
| `../tools/decisions.json` | Your recorded answers: the decision register plus the per-stable content changes they make (delegated authoring marked as such); `convert.py` overlays it on `source/` | Approved (your decisions) |

---

## 2. Sources

Your drafts live in `../source/` as you delivered them; the tools only read them.

- `source/AUTOMATON_STABLE_EXPANSION.md` — the first proposal, for the review-record stables.
- `source/AUTOMATON_ROBOT_BLUEPRINTS.md` — the readable blueprints of the review-record stables.
- `source/automaton-blueprints/{catalogueKey}.json` — one review record per stable, plus `blueprints.json` (the same records bundled), `validation-report.json` and `README.md`.
- `source/collection/{NNN}-{catalogueKey}/stable.json` and `blueprints.json` — your 11 October collection, one folder per stable, in its snake_case authoring format.
- `source/collection/AUTOMATON_STABLE_EXPANSION_*.md` (the only Markdown file in `source/collection/`) — the 11 October proposal for the collection plus the Squadron rules. It sits next to `source/AUTOMATON_STABLE_EXPANSION.md`, which stays unchanged and authoritative for the review-record stables.
- `app/frontend/public/assets/automatons/{catalogueKey}/{slot}.webp` — the expansion portraits, one per Blueprint_Slot (the starter folders are tracked on main; the expansion folders are delivered together with their Catalogue_Entries). `validate.py` reads them under `IMAGE_ROOT` (default: the repository root). Commit them only with or after their Catalogue_Entries (§5).

`tools/source_records.py` reads both formats into one review-record shape: the review records as they are, and each collection `stable.json` mapped field by field (design §3.2). Fields with no spec-55 home are listed per stable in `tools/facts/conversion-log.json`.

The conversion copies content as is. It changes only the format: field names, the strategy key, lower-case Build_Focus, `targetOverrides` `{robots: N}` → `{"<final robots goal>": N}` (only where N differs from the default), team names ordered by slot. It **drops** the review-only fields, which have no home in spec 55: `number`, `fit`, `conceptIdentity`, `openingRobots`, `targetRobots`, `adminMaximumRobots`, `review.*`, `alternativeBlueprints`, and per robot `blueprintId`, `sourceAlias`, `nameBasis`, `availability`, `review.*` (art briefs survive in `CATALOGUE.md`). The one generated field is the Refinement_Plan (decision 6 below). Nothing was renamed or rewritten to make a rule pass.

Your answers to §4 live in `tools/decisions.json`, which `convert.py` overlays on `source/` (the source stays your original). Decided Goal_Targets (decisions 5 and 12, `targetOverrides` by Build_Order position) are merged into the converted `targetOverrides`; an invalid decided value (unknown goal, outside its bounds, more robots than blueprints) stops the conversion. Where you asked me to write the content (decisions 3, 7, 13–16 and 18: team names, names and art briefs of the numbered robots, renames, franchise labels, portrait alignment), the decision is marked as delegated authoring, and `CATALOGUE.md` lists every such change per stable under "Changes from your draft" so you can review and replace it.

---

## 3. Pipeline (re-run after any change)

Spec 55 (PR #529) and the whole-word profanity fix (`bugfix/profanity-whole-word-matching`, PR #528) are on `main`, so the pipeline runs against the main checkout. From the repository root:

```bash
export PYTHONDONTWRITEBYTECODE=1                          # no __pycache__ in tools/
export S57="$(ls -d "$PWD"/.kiro/specs/*/57-automaton-catalogue-expansion)"
(cd app/backend && pnpm exec tsx "$S57/tools/export-facts.ts")
(cd "$S57/tools" && python3 parse_starter.py && python3 refine_plan.py --selftest && python3 convert.py)
(cd app/backend && pnpm exec tsx "$S57/tools/check-built.ts")
(cd "$S57/tools" && python3 validate.py && python3 render_catalogue.py && python3 validate.py --check-readme && python3 validate.py --check-spec)
```

`APP_ROOT` (built spec-55 code), `PROFANITY_ROOT` (whole-word filter), `IMAGE_ROOT` (portraits) and `SPEC55_DIR` (spec-55 docs) are optional overrides; set one only to check another checkout. All default to the repository root, derived from the tools' own location, and the spec-55 docs are found at `.kiro/specs/done-october26/55-automaton-stables/`.

What each step reads and writes:

1. `export-facts.ts` reads the built code under `APP_ROOT` (weapons, `refinementStepCost` and `attributeIncrementCost` prices, Training Facility discount, `ROBOT_ATTRIBUTES`, `SUBSCRIBABLE_EVENT_TYPES`, the six strategies, Build_Focus weights and groups, catalogue limits, the Team_Rule, `canEquipToSlot`) and `PROFANITY_LIST` / `COMPOUND_MATCH_ENTRIES` under `PROFANITY_ROOT`, and writes `tools/facts/facts.json`.
2. `parse_starter.py` reads the built starter files (`$APP_ROOT/app/backend/prisma/automaton-catalogue/`, without the delivered Expansion_Stables, i.e. the files that have a Staged_Entry of the same name in `catalogue/`; `check-built.ts` separates them the same way; their stables, blueprints and team names are the starter row of the Totals block) and the spec-55 `review/CATALOGUE.md`, and writes `tools/facts/starter.json` with the art briefs, plan costs and a doc-vs-code difference list (the built JSON wins).
3. `refine_plan.py --selftest` regenerates every approved starter plan of `tools/facts/starter.json` from the facts and must report all of them identical (`N/N`, exit 0); it writes nothing.
4. `convert.py` reads every stable in `source/` (review records and collection, through `source_records.py`) and `tools/decisions.json`, and writes `catalogue/*.json` and `tools/facts/conversion-log.json`.
5. `check-built.ts` reads `catalogue/` and the starter files and runs them through the built code (schema, directory load, uniqueness, whole-word verdicts, two-season projection); it writes `tools/facts/built-check.json` and exits 0, 1 (a failure) or 2 (a starter failed: harness defect).
6. `validate.py` reads everything above plus the expansion portraits under `IMAGE_ROOT` (`app/frontend/public/assets/automatons/`) and writes `review/findings.json` and the generated blocks of `FINDINGS.md` (including the Totals block); `render_catalogue.py` writes `CATALOGUE.md`; `--check-readme` and `--check-spec` write nothing. `--check-spec` also fails on a hard-coded catalogue or starter count or stable range in `requirements.md`, `design.md`, `tasks.md` or this file (decision 20).

Nothing is written outside the spec-57 folder: `app/` is only read. Rule tables in `tools/rules.py` come from `facts.json`; only the name character sets, the source strategy names, the CATALOGUE §2 weapon list and the profanity matching rules are transcribed, each with its source file named (`check-built.ts` proves the profanity transcription agrees with the TypeScript filter on every name).

---

## 4. Open decisions

Each decision has a recommended answer. Tick one box and add notes. Answers are recorded in `tools/decisions.json`, which `convert.py` overlays on the source, so `source/` stays your original. The pipeline is then re-run and the answer is noted under "Decisions" below.

1. **Four stable names contain "ass" (V02).** "Hero Factory Assembly", "Nindroid Assembly Line", "Robocraft Assembly Yard" and "Wanzer Assembly Corps" failed only the old substring `containsProfanity`. Under the whole-word rule of `bugfix/profanity-whole-word-matching` (merged to `main` in PR #528) all four pass, so this is no longer Blocking. Spec 55 on `main` uses the whole-word filter, and `check-built.ts` with the default roots reports no stable name pending the whole-word rule (task 1.2).
   The collection stable names "HK Assassin Protocol", "Infinite War Assembly", "Kaylon Assembly Array", "Striker Assembly Wing" ('ass' inside a word), "Chimera City Scrapworks" and "Scrap Garden Restoration Shop" ('crap' inside a word) are in the same position: they pass the whole-word rule and are kept under this decision; on `main` none of them is pending. Assumption, flagged for product-owner review: decision 1 extends to them, as decision 13 only renames names that fail the whole-word rule.
   Recommended: rename them. Suggestions: "Hero Factory Works", "Nindroid Production Line", "Robocraft Build Yard", "Wanzer Fabrication Corps".
   - [ ] Rename as suggested  - [ ] Rename differently — names:  - [x] Change the filter in a separate fix instead (`bugfix/profanity-whole-word-matching`, whole-word rule; merge before Task Group 2)
   Notes: the four franchise-true names are kept; the filter was the defect.
2. **Alternatives (A08).** The drafted `alternativeBlueprints` (Northstar, Ramattra, Phineas Ratchet, Foxy, Black Lion, Platinum, Lead) replace a slot. Spec 55 has one blueprint per slot and no selection feature.
   Recommended: discard them and keep the main rosters; they stay in `source/` for reference. A chosen alternative replaces its slot, keeps the slot's team membership and gets a generated plan.
   - [x] Discard all  - [ ] Use these instead — slot/name:
   Notes: no backup blueprints; every robot has a working blueprint.
3. **Generic numbered names (A03).** Every drafted team name is "{Prefix} Pair 01 / Squad 01". Many Swarm robots are "{Unit} 04 … 11", and their art briefs differ only in the number. The starter catalogue names every team and robot after the franchise (Torrent Company, Cult of Skaro, CT-5555 Fives).
   Recommended: author franchise-flavoured team names for all stables. Keep numbered robot names only where the franchise itself mass-produces identical units (Tachikoma, Egg Pawn, NS-5, Centurion), each with its own art brief.
   - [ ] As recommended  - [ ] Keep all as is  - [x] Other: authored (delegated) team names for every review-record stable with teams, and names + art briefs for the numbered robots; designations only where mass-produced or canon
   Notes: you asked for names unique to the stable or franchise; review them in `CATALOGUE.md` under "Changes from your draft".
4. **Templated backstories (A04).** The review-record backstories all read "{stable} enters the arena with a clear doctrine. {concept line}. Every surviving machine returns to the workshop before the next booking." The collection's backstories are authored.
   Recommended: rewrite them in the franchise's voice (CATALOGUE §2 backstory rule) before approval. They are admin-only until backlog #61, so this does not block ACC; it blocks the content quality the starter set has.
   - [ ] Rewrite before approval  - [x] Accept for now, rewrite with backlog #61
   Notes: backstories are not shown to players anywhere yet; they are stored for the admin page and for backlog #61.
5. **Spare blueprints and the robots target (A01, A12).** In the draft, some stables have one blueprint above their robots target (Paragons with 2, Duos with 3, Trios and Generalists with 4; FINDINGS A12). That blueprint is never built unless an admin raises the target. The other stables have no blueprint beyond the target (A01). Both are valid under R3.7. The starter catalogue keeps one spare slot (ED-209, Crimson Typhoon, Shockwave, Ratchet).
   Recommended: raise the target to the blueprint count where the spare is a good candidate, with the Booking Office target the larger roster needs; add no spare blueprints.
   - [ ] Accept as drafted (spares stay idle)  - [x] Raise the target to the blueprint count where the spare is a good candidate; no spare blueprints
   Notes: "Why are there more blueprints than robots target? Just up the target if we have another good candidate. Make sure there is a team name etc." This supersedes the earlier answer "Accept: no spare blueprint per stable".
6. **Generated refinement plans (V13, A07).** The source plans are empty or misordered, because the source was built from an earlier starter draft ("Swarm, Trio and Tycoon do not refine", "dual wield refines the main hand only"). `catalogue/` carries plans generated by the decision-35/36 rule, which reproduces every approved starter plan exactly.
   Recommended: confirm the generated plans.
   - [x] Confirm  - [ ] Changes:
   Notes: re-confirmed against the spec-55 code as built (see FINDINGS §7.1).
7. **Franchise labels (V18).** "[Detroit" and "[One Must Fall" are cut-off link text; "batteries not included" is mis-cased.
   Recommended: "Detroit: Become Human", "One Must Fall: 2097", "*batteries not included".
   - [ ] As recommended  - [x] Other: the three recommended labels plus BattleTech, Marvel — Ultron, DC — Metal Men
   Notes: "make it pretty looking": the changed labels are listed per stable in `CATALOGUE.md`; the other review-record labels were checked and kept.
8. **Content review (A09).** "Gigolo Joe" is a player-visible name with a sexual connotation. "David Mecha" is briefed as child-shaped. Several live-action androids (Data/Lore/B-4, David 8/Walter One/Bishop, Dolores/Maeve/Bernard) are briefed as human-looking, which invites portraits of the actors.
   Recommended: rename Gigolo Joe (for example "Joe"), replace or re-brief David Mecha as adult-proportioned, and add "visibly synthetic, not a likeness of the actor" to the human-looking art briefs. Details in FINDINGS §6.
   - [ ] As recommended  - [x] Other: keep as is; the names pass the whole-word filter
9. **Two "Metropolis" stables (A02).** "Metropolis Automaton Lab" (Metropolis, 1927) and "Metropolis Combat Systems" (Rise of the Robots) share their first word.
   Recommended: accept; both names are canonical to their franchise.
   - [x] Accept  - [ ] Rename:
10. **Robot names that would fail the stable-name filter (V03, informational).** "Shell-Walker", "Centurion Classic 01", "Sea Brass" and "Wasteland Assaultron 02" contain a list word. Robot names are not profanity-filtered.
    Recommended: no change.
    - [x] No change  - [ ] Rename:
11. **Coverage_Matrix scope (spec-55 impact 3).** Recommended: the Coverage_Matrix stays defined by the starter set (spec-55 CATALOGUE §14). The test keeps asserting over the union of all repository entries, and spec 57 adds one assertion that the starter entries alone still cover it, so no expansion stable is ever needed for coverage.
    - [x] As recommended  - [ ] Matrix over all repository entries only
12. **Squadron strategy (V06).** The collection's Squadron stables name a strategy spec 55 does not have. Their roster, teams and event order fit Trio with robots target 6 (`COLLECTION_205_GAPS.md` §3).
    Recommended: convert them as Trio with `targetOverrides {"12": 6}`; plans regenerated (decision 6); the Squadron purchase order and authored plans are dropped.
    - [x] As recommended  - [ ] A new `squadron` strategy (engine change)  - [ ] Defer these stables
    Notes: "Approved". Trio's default Weapons Workshop target is kept (no `{"20": 8}`).
13. **Names that fail the built validators (V02, V03).** Some collection stable names contain an apostrophe or are too long; some robot names contain non-ASCII letters or an em dash.
    Recommended: rename them close to the original.
    - [x] Rename, close to the original  - [ ] Rename differently — names:
    Notes: "Rename them. Stay as close to the original as possible." Plain ASCII (German umlauts as their standard digraph: "Löwe" → "Loewe"; other diacritics dropped: "Śmiały" → "Smialy", "Łowca" → "Lowca"), apostrophes and em dashes dropped, minimal shortening.
14. **Generic numbered names in the collection (A03).** Decision 3 for the collection.
    Recommended: apply decision 3 unchanged (franchise-flavoured team names, distinct robot names with their own art briefs, designations only for mass-produced or canon units).
    - [x] Apply decision 3  - [ ] Keep as is
    Notes: "What's your question? Will it work or not?" Names are chosen together with the portrait (decision 18).
15. **Name collisions across stables (V03, V09, A02).** Some robot names repeat across stables.
    Recommended: make stable, robot and team names unique across the starters and every Expansion_Stable; an original name beats a decision-3/14-authored one; where both are original the higher-numbered stable changes.
    - [x] Make them unique  - [ ] Accept the repeats
    Notes: "Make them unique."
16. **Franchise labels in the collection (V18, V16).** Decision 7 for the collection: labels with a slash, a dash used wrongly, parentheses, an instruction, or a year, medium or authorship annotation; bare publisher labels; labels shared by several stables.
    Recommended: apply decision 7 (starter format "Title" or "Title — subtitle"; shared labels get a subtitle).
    - [x] Apply decision 7  - [ ] Keep as drafted
    Notes: "Go for it."
17. **Content review in the collection (A09).** Decision 8 for the collection: art briefs that ask for an actor's likeness ("portrayed by"), M3GAN, and fan-work and web-fiction franchises.
    Recommended: review each.
    - [ ] Re-brief or drop  - [x] Keep them
    Notes: "Keep them. They are metal on the inside."
18. **Portraits after renaming (A13).** A decision that changes a slot's name or art brief can leave the portrait showing something else.
    Recommended: check every changed slot against its portrait; name and brief follow the image, because images are not regenerated; record a slot whose image clearly shows the wrong robot as needing a new portrait.
    - [x] Align images and names  - [ ] Regenerate the portraits
    Notes: "Align images and names."
19. **Activation volume (spec-55 impact).** Spec 55's heavy test proves a fixed population.
    Recommended: cap activation until a larger heavy run passes.
    - [ ] Cap activation  - [x] No cap: investigate scaling and run the heavy test over every repository entry
    Notes: "Why would it not work? This should be able to scale to 10000 Automatons. What's the problem?" The investigation is in `SCALING.md`; engine changes for larger populations are open items for you (§6).
20. **Hard-coded counts.** The spec documents and tools stated catalogue counts by hand.
    Recommended: derive every count from `source/`.
    - [x] Derive them; one generated Totals block  - [ ] Keep them and update by hand
    Notes: "Then don't hardcode it or update it. I do like to get informed of totals though." The Totals block opens `FINDINGS.md`.

### Decisions

Recorded in the `_decisions` register of `tools/decisions.json` (decisions 1–11 on 2026-10-10, 12–20 on 2026-10-11); the pipeline was re-run afterwards. What each decision fixed or accepted, with its counts, is in the "Status per check" table of `FINDINGS.md`; the totals are in its Totals block.

1. Change the filter in a separate fix (`bugfix/profanity-whole-word-matching`, merged to `main` in PR #528) and keep the four names — applied: `tools/rules.py` and `check-built.ts` use the whole-word rule, so the four names pass V02 in `catalogue/`. The collection names listed under §4 decision 1 ("HK Assassin Protocol", "Infinite War Assembly", "Kaylon Assembly Array", "Striker Assembly Wing", "Chimera City Scrapworks", "Scrap Garden Restoration Shop") are kept under the same rule (assumption flagged in §4). Spec 55 on `main` uses the whole-word filter, and `check-built.ts` with the default roots reports no stable name pending the whole-word rule (task 1.2). No content change.
2. Discard all — applied: the alternatives stay out of `catalogue/` and out of the decided view (A08 0 after decisions); they remain in `source/` for reference. No content change.
3. Other: delegated authoring of team names, robot names and art briefs — applied: `tools/decisions.json` carries decision 3 on the review-record stables with teams: authored team names for every team and, where robots were numbered, a new art brief for each numbered robot, renamed or kept as a designation (mass-produced or canon). A03 is 0 after decisions; every change is listed per stable in `CATALOGUE.md`.
4. Accept for now, rewrite with backlog #61 — applied: no change; the templated review-record backstories remain the accepted A04 items.
5. Raise the target to the blueprint count where the spare is a good candidate; no spare blueprints — applied: `tools/decisions.json` carries decision 5 (`targetOverrides`) on every stable with a good spare: Paragon goal 8 Robots → 2 and goal 3 Booking Office → L4; Duo goal 13 Robots → 3 and goal 11 Booking Office → L6; Trio goal 12 Robots → 4; Generalist goal 14 Robots → 4. Trio and Generalist need no Booking Office change, because L6 is already their default. Every spare was a good candidate (FINDINGS §5 lists the reason per stable). The team names the larger rosters need were already present, because the built rule counts team names from the blueprint count. Event orders are unchanged. The plans are re-priced at the new robot count; some fifth steps change tier, attribute or magnitude, because robot upgrades cost more with more roster slots. A12 is 0 in `catalogue/`; the A01 items (no blueprint beyond the target, including the raised Trios still below the Trio bound of 6) are accepted. `check-built.ts` builds every robot to the new target in every projection. The starters keep their spare slots (spec 55 is not edited). Gigolo Joe is now a built robot; decision 8 already accepts the name.
6. Confirm, re-confirmed against the spec-55 code as built — applied: the Plan_Generator prices robots with the built `attributeIncrementCost`; `refine_plan.py --selftest` reproduces every starter plan, and `check-built.ts` passes every two-season projection. Doc-vs-code differences are in FINDINGS §7.1.
7. Other: the three recommended labels plus BattleTech, Marvel — Ultron, DC — Metal Men — applied: the labels in `tools/decisions.json` (decision 7); V18 is 0 after decisions, and the remaining V16 items are accepted under decision 16.
8. Other: keep as is; the names pass the whole-word filter — applied: no change; `check-built.ts` finds no whole-word hit on any stable, team or robot name; the remaining A09 items are accepted.
9. Accept — applied: no change; the two "Metropolis" stables (A02) are accepted.
10. No change — applied: "Shell-Walker" and "Sea Brass" are kept; "Centurion Classic 01" and "Wasteland Assaultron 02" became "Centurion Classic" and "Assaultron" under decision 3. Under the whole-word rule none of them hits the filter (V03 0).
11. As recommended — applied: design D7 and task 3.3 (starter-only Coverage_Matrix assertion). No content change.
12. Squadron as Trio — applied: every Squadron stable carries `strategy: "Trio"` and `targetOverrides {"12": 6}` in `tools/decisions.json`; their plans are generated (decision 6) and the dropped Squadron fields are listed per stable in `tools/facts/conversion-log.json`. V06 is 0 in `catalogue/`.
13. Rename close to the original — applied: the invalid collection stable and robot names are renamed in `tools/decisions.json` (plain ASCII with umlauts as their standard digraph, so "Löwe 01–03" became "Loewe 01–03"; no apostrophe or em dash; minimal shortening); each change is listed per stable in `CATALOGUE.md`. V02 is 0 in `catalogue/`; every renamed slot carries a portrait verdict (decision 18).
14. Apply decision 3 to the collection — applied: authored franchise-flavoured team names for every collection team and distinct robot names with their own short art briefs for the numbered robots, each chosen with its portrait; designations only for mass-produced or canon lines. A03 is 0 after decisions.
15. Make names unique — applied: stable, robot and team names are unique across the starters and every Expansion_Stable by the decision-15 rule; `check-built.ts` exits 0 with no cross-stable repeat. The remaining A02 items are stable names that share only a first word across different franchises, accepted with decision 9.
16. Apply decision 7 to the collection — applied: every collection label the V18 rule flags is changed in `tools/decisions.json` (annotation dropped, official title kept), and labels shared with another stable got a starter-format subtitle naming the faction. V18 is 0 after decisions; the remaining V16 items are franchise roots shared by distinct subtitled labels and the repeated "Armoured Souls original" label, both accepted.
17. Keep them — applied: no change; the A09 items of the collection are accepted.
18. Align images and names — applied: every slot whose name or art brief a decision changed was viewed against its portrait, its name and brief follow the image, and its verdict is recorded in `tools/decisions.json`. The slots needing a new portrait are counted in the Totals block ("slots needing a new portrait") and listed as decided A13 items in `FINDINGS.md`; at the last run there were none.
19. No activation cap — applied: the read-only scaling investigation is in `SCALING.md` (cycle and Turn_Step execution, the lease, the sequential cohort loop, budget skips and their fixed order, cost per charged action, Catalogue_Sync, admin listing and unpaginated reads, matchmaking and leagues), and the heavy test of spec 57 runs every repository Catalogue_Entry with timing per Automaton (requirements R5.4, Requirement 7). Its open engine items are in §6.
20. Derive the counts — applied: `validate.py` writes the Totals block at the top of `FINDINGS.md`, the tools name no catalogue or starter count, and `validate.py --check-spec` fails on a hard-coded catalogue or starter count or stable range in the spec documents or this file.

---

## 5. Gating

- Every task after Group 0 waits for **both** this pack's approval (every document `Status: Approved — <date>`, every checklist ticked) **and** spec 55 being implemented through task 8.6: the catalogue folder, `catalogueEntrySchema`, `catalogueSchema.test.ts`, `catalogueImages.test.ts` and `automatonCatalogueCoverage.test.ts`. Both gates are met: Content_Approval was recorded on 11 October 2026, and spec 55 is merged to `main` (PR #529).
- Next to spec 55, Task Group 2 also waits for `bugfix/profanity-whole-word-matching` (whole-word `containsProfanity`, `app/backend/src/utils/profanityFilter.ts`) being merged to `main` (decision 1). It was merged in PR #528 and is part of `main` with spec 55; task 1.2 confirms that `check-built.ts` with the default roots reports no stable name pending the whole-word rule.
- Spec 55 stays at exactly its starter entries (R10.9, decision 32). Spec 57 amends that wording in its own requirements; spec 55 is not edited.
- Images can be added at any time as `app/frontend/public/assets/automatons/{catalogueKey}/{slot}.webp` (512×512 WebP). Commit them only together with or after the matching Catalogue_Entry, because `catalogueImages.test.ts` fails on a folder without an entry.

---

## 6. Open items for the product owner

Engine changes the built spec-55 code would need for populations well above a few hundred Active_Automatons. Spec 57 implements none of them and adds no activation cap (decision 19). Evidence and rough scope: `SCALING.md` §4 and §6.

- Bounded parallel Turn_Steps: run several Automaton turns at a time instead of one sequential loop, so one daily Turn_Step serves more Automatons.
- Fair rotation after budget skips: start each Turn_Step where the previous one stopped, or serve last time's skipped profiles first, so the last-activated stables are not always the ones skipped.
- A Turn_Step budget scaled with the population, or follow-up chunks until the cohort is done, so season-start opening builds finish before the competitive season.
- Fewer SQL statements per charged action (incremental facts instead of a full reload after every action, batched event-log and spending writes), lowering the cost per Automaton.
- Bulk skip marking and a lease heartbeat, so a very large Turn_Step cannot outlive its lease and overlap with another.
- Batched or background admin operations: a batch size for activate-drafts, a paginated or streamed catalogue export, a cached Need_Attention count for the Status_Bar.
- A battle-volume measurement at the target robot count before activating thousands of Automatons.
