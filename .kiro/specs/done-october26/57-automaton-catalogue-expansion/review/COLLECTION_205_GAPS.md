# Collection 205 — gap check and placement
**Status note**: the open decisions of this record were taken on 2026-10-11 and are recorded as decisions 12–20 in `review/README.md` §4; this file stays the dated gap-check record. Every gap in §1 and every decision in §2 is resolved (marked **Resolved** below). Current totals are in the Totals block of `FINDINGS.md`; the counts below are the 11 Oct snapshot.

**Date**: 11 October 2026 · **main** `4fd40c6d` · **spec-55 worktree** `bc8c8682` (`feature/spec-55-automaton-stables`)
**Input**: `output/` (6,470 files, 2,094.8 MB, read-only) · **Raw evidence**: `COLLECTION_205_VERIFICATION.md`

Nothing was committed. Nothing in `output/` or `.worktrees/spec-55/` changed. The copy was add-only: 856 new files, 0 overwritten. Of the existing spec-57 files, only `review/README.md` §2 changed (a source note). `catalogue/`, `tools/`, the generated review files and the spec docs are byte-identical.

## 1. Summary

| Item | Status | What spec 57 must still do |
|---|---|---|
| a. Starters 1–11 | OK: images identical; content superseded | Nothing. The 50 WebPs match spec 55 byte for byte. The content matches field for field except the refinement plans (the collection has the older draft plans) and the prose `target_overrides`. Spec 55's build is authoritative. Not copied. |
| b. Stables 12–100 | OK: unchanged | Nothing new. The source records match `source/automaton-blueprints/` exactly. The only difference is `max_planned_robots` (48 stables), a dropped field. The `decisions.json` overlay applies cleanly (67/67). Not copied (P4 = 0). |
| c. Stables 101–205 | **Resolved** (decisions 12, 13): names renamed close to the original; Squadron mapped to Trio | Every Catalogue_Entry field is present and every event order has all 9 types. 5 stable names and 8 robot names fail the built validators and need new names. Squadron (8 stables) has no strategy key. |
| d. Squadron → Trio | **Resolved** (decision 12): option (a) without `{"20": 8}` | Roster, teams and event order fit Trio with `{"12": 6}`. Converting all 8 as Trio succeeds in the dry run. The authored plans, purchase order and workshop L8 path are not expressible as-is (§3). |
| e. Decision triggers | **Resolved** (decisions 14–17) | Decision 3: 154 of 194 team names are generic; 131 of 319 robot names are numbered or generic. Decisions 2 and 5: 0 triggers. Profanity: 0 hits over all 1,338 names. Decision 7: 15 labels. Collisions: 13 robot names (stable, team and key names: 0). Decision 8 themes listed (§4.5). |
| f. Images | **Resolved** (decision 18): every changed slot checked against its portrait; none needs a new portrait | 695/695 decode, 695 are 512×512, every one maps to a slot, no slot lacks an image. 148 slots in 12–100 got a new art brief from decision 3, so their portraits predate it. 131 slots in 101–205 are at risk if decision 3 renames them. |
| g. Spec impact | **Resolved** (decisions 19, 20): counts derived (Totals block, `--check-spec` count scan); scaling in `SCALING.md`, no cap | 38 lines with hard-coded counts in the spec docs and 15 in the tools (§4.7), plus 6 structural changes. Activating more than 100 Automatons has not been tested. |
| h. Format | **Resolved**: `tools/source_records.py` reads `source/collection/`; every source stable converts | `convert.py` needs a second reader for snake_case `source/collection/` (mapping in §5). The dry run converted 97/105; the 8 failures are all Squadron. |
| P1 WebPs 12–205 | Placed | 645 files, 34.70 MB, 194 folders. Untracked. Commit only with or after the entries. |
| P2 JSON 101–205 | Placed | 210 files, 5.77 MB, 105 folders |
| P3 proposal 101–205 | Placed under a new name | 1 file, 0.16 MB. It does **not** replace `source/AUTOMATON_STABLE_EXPANSION.md` (§6.2). |
| P4 changed 12–100 | Not needed | 0 stables changed content |
| P5 completed designs JSON | Not needed | Redundant: all 97 stables equal P2 field for field (§6.2) |

## 2. Product-owner decisions (all resolved 2026-10-11)

| # | Resolution | README §4 |
|---|---|---|
| 1 | **Resolved**: (a) Trio with `{"12": 6}`; no `{"20": 8}`; plans generated, purchase order dropped | decision 12 |
| 2 | **Resolved**: decision 2 applies unchanged (no alternatives in 101–205) | decision 2 |
| 3 | **Resolved**: franchise-flavoured team names and distinct robot names authored per portrait; designations only for mass-produced or canon lines | decision 14 |
| 4 | **Resolved**: decision 5 applies unchanged (0 reserves in 101–205) | decision 5 |
| 5 | **Resolved**: the 13 names renamed close to the original (ASCII, no apostrophe or em dash, minimal shortening) | decision 13 |
| 6 | **Resolved**: labels polished to the starter format; shared labels got a faction subtitle | decision 16 |
| 7 | **Resolved**: kept ("they are metal on the inside") | decision 17 |
| 8 | **Resolved**: names unique catalogue-wide; the higher-numbered or decision-3-authored side changed (28, 57, 136 "VGC-60L", 166 "Squiddy 01"–"11") | decision 15 |
| 9 | **Resolved**: no cap; read-only scaling investigation in `SCALING.md`; heavy test runs every repository entry | decision 19 |
| 10 | **Resolved**: every changed slot checked against its portrait; names and briefs follow the image; none needs a new portrait | decision 18 |
| 11 | **Resolved**: scope confirmed; spec docs re-baselined without hard-coded counts (Totals block, `--check-spec` count scan) | decision 20 |

The original questions follow unchanged.

1. **Squadron mapping** (8 stables: 113, 114, 119, 123, 127, 137, 159, 181).
   - (a) Trio with `targetOverrides {"12": 6}`, plus `{"20": 8}` if you want the Workshop to reach L8. Plans are regenerated and the purchase order is dropped.
   - (b) A new `squadron` strategy. That is an engine change outside spec 57's scope.
   - (c) Defer the 8 stables.
   - Recommendation: (a). Every Squadron property that spec 55 actually models fits Trio.
2. **Decision 2 for 101–205**: there are no alternatives in 101–205, so the decision applies unchanged. Confirm.
3. **Decision 3 for 101–205**: author franchise-flavoured names for the 154 generic team names (56 stables) and the 131 numbered or generic robots (23 stables)? Or accept designations where the franchise mass-produces units (for example B1 Battle Droids, Cybus Cybermen, Sentinels, Kaylon)? Renaming invalidates those portraits unless the designation is kept.
4. **Decision 5 for 101–205**: there are 0 reserve robots and target equals blueprint count in all 105. The decision applies unchanged. Confirm.
5. **Invalid names (new, blocking)**:
   - Stable names: "Aphra's Rogue Droid Pair", "Erlin's Eye Sleeper Workshop" and "Candy's Animatronic Workshop" contain an apostrophe. "Interplanetary Peacekeeper Works" (32 characters) and "Wilson Resistance Salvage Works" (31) are too long.
   - Robot names: PZM-7 Śmiały, PZM-11 Łowca, Koubu Kai — Sakura Unit, Koubu Kai — Sumire Unit, Löwe 01–03, Sleeper — Operator. These contain non-ASCII letters or an em dash.
   - Rename, or delegate the renaming as with decision 7?
6. **Decision 7 for 101–205**: polish the 15 franchise labels in §4.4 to the starter format?
7. **Decision 8 for 101–205**:
   - 6 art briefs ask for the likeness of a named actor (AMELIA, Harun, Mother, Father, Demerzel, Murderbot). Decision 8 covered human-looking androids, not real-person likeness.
   - M3GAN is a child-sized doll.
   - 6 franchises are fan works (§4.5).
   - Keep, re-brief or drop?
8. **Name collisions**: E-123 Omega and E-102 Gamma (stable 28 after decision 3, and stable 163); Hammer Bot (57 and 137); Robot (117 and 136); Sentinel 03–11 (156 and 166). Which side changes?
9. **Activation beyond 100**: spec 55's heavy test proves 100 Active_Automatons. Spec 57 adds 194 drafts, so with the 11 starters there are 205 Automatons. Options:
   - Cap activation at 100 until a heavy test at 205 passes.
   - Add a 205-population heavy run to spec 57.
   - Recommendation: the cap, with batch activation as in design D9.
10. **Portraits of the 148 decision-3 slots in 12–100**: their art briefs changed (129 new names, 19 kept designations with a new brief). Re-brief and regenerate, or accept the existing portraits?
11. **Scope change**: spec 57 grows from 89 to 194 Expansion_Stables (205 Catalogue_Entries, 695 blueprints). Confirm, so requirements, design and tasks can be re-baselined (§4.7). This includes the R10.9 amendment wording, R5.4 and Verification Criteria 2, 4 and 6.

## 3. Squadron as Trio (item d)

All 8 stables share this shape: opening 3, target 6, maximum 6, 6 blueprints, 2v2 teams on slots 1+2, 3+4 and 5+6, 3v3 teams on 1–3 and 4–6. They also share one event order (league_3v3, league_2v2, tag_team, tournament_3v3, tournament_2v2, league_1v1, koth, grand_melee, tournament_1v1). Spec-55 Trio Build_Order: goal 1 robots default 3 (1–3), goal 12 robots default 3 (3–6), Booking Office goals 2/4/14 = L1/L3/L6, Weapons Workshop goals 7/15/20 = L1/L3/L6, weapons goal 21, refine goal 22 (10 steps).

| Squadron behaviour | As Trio |
|---|---|
| Opening 3 robots, slots 1–3 | Expressible: goal 1 default 3 |
| Target and hard maximum 6 | Expressible: `{"12": 6}`, within 3–6. Trio's own bound is 6, so 6 is also the ceiling. An admin can still set a lower target. |
| Team_Rule for 6: three 2v2 and two 3v3 teams | Expressible: identical slot sets (8/8) |
| One event order, all 9 types | Expressible (8/8) |
| Recruit 4, then fund 5 and 6 together before buying both | Not expressible. Trio buys robots one at a time toward the goal. |
| Upgrade and refine in slot order 1,4,2,5,3,6 | Not expressible. The spec-55 runner sets the order. |
| Authored plans: 2–5 steps per robot, 181 steps, ₡45,380,000 | Not expressible. The Plan_Generator regenerates them (decision 6): 5 or 10 steps per robot. The dry run produced 8/8 conversions; authored and generated plan lengths per slot are listed in the verification note. |
| Workshop path L1 → L3 → L5 → L8 (Forge at L8) | Partly expressible: `{"20": 8}` lifts Trio's last Workshop goal from L6 to L8. The intermediate gates are engine rules. |
| Booking Office L2 at full roster | Trio goes further (L6 at goal 14). This differs but does not conflict. |
| Storage L1 before slot 4; Roster Expansion L2–L5 gates | Not Trio Build_Order goals. Whether the spec-55 engine buys these is not verified here. |
| Refine only after all six reach stage 1; exactly 2 weapon stages | Roughly: Trio's robots goal 12 and weapons goal 21 come before refine goal 22. All 48 robots have 2 stages. |
| `strategy_personality`, `purchasing_plan`, `equipment_budget` prose | Not expressible. No spec-55 field holds them; they are dropped. |

## 4. Details

### 4.1 Item a — starters 1–11

- **Images**: 50 of 50 files are SHA-256-identical to `.worktrees/spec-55/app/frontend/public/assets/automatons/`. No file is extra or missing on either side.
- **Content**: 510 fields compared per stable and slot, using the item-h mapping, against the built entries.
  - Equal: stable name, franchise, backstory, strategy, final robots target, team names, event order, blueprint count, and per slot the name, loadout, stance, yield, Build_Focus, weapon path and art brief. Art briefs were checked against `tools/facts/starter.json`.
  - **Different, refinement plans (50/50 slots)**: the collection has 0–5 steps (the earlier draft). The build has 4–10 decision-35/36 steps.
  - **Different, `target_overrides` (11/11)**: the collection holds prose, for example "none (goal 8 Robots → 11, the strategy default)" or "goal 18 Robots → 3". The build holds `{}`, `{"20": 3}` for world-robot-boxing and `{"14": 3}` for autobots-ark. The collection's "goal 18" for World Robot Boxing is goal 20 in the built Tycoon order.
- **Conclusion**: the starters stay as built in spec 55. The collection's starter data is superseded. Nothing was copied.

### 4.2 Item b — stables 12–100

- For all 89 stables, `stable.json.source_blueprint` equals `source/automaton-blueprints/{key}.json`. Every robot's `source_blueprint` equals its source robot, and `blueprints.json.robots` equals `stable.json.robots`.
- These fields are all equal: number, name, franchise, strategy, backstory, opening and target robots, event order, team names and slots, slot list, alternatives, and per robot the name, availability, loadout, stance, yield, Build_Focus, weapon path, full refinement plan (tier, weapon, hand, attribute, magnitude, cost) and art brief.
- The only difference is in 48 stables: `max_planned_robots` (the blueprint count) is one lower than the source `adminMaximumRobots` (the blueprint count + 1). `convert.py` drops this field, so the effect is none.
- Collection-only fields such as `strategy_personality`, `purchasing_plan`, `equipment_budget`, `source_notes`, robot `role` and `files` are not part of spec 55; they would be dropped.
- **The 271 completed designs are all in 101–205** (97 stables). None touch 12–100.
- **`decisions.json` overlay**: 67/67 keys exist in 12–100. Every named slot exists and every team count matches. `convert.apply_decisions` runs without error on all 67 (in memory). The overlay still applies cleanly.

### 4.3 Item c — stables 101–205 completeness

Checked with the `tools/rules.py` limits taken from the built code:

| Field | Result |
|---|---|
| Catalogue_Key (pattern, equals folder, unique) | 105/105 OK |
| name (`validateStableName` + whole-word profanity) | **5 fail**: 150, 185 and 201 (apostrophe); 197 (32 characters); 199 (31 characters) |
| franchise (1–60, trimmed), backstory (1–400, trimmed) | 105/105 OK |
| strategy | 97 map to a key; **8 Squadron** have none |
| slots contiguous, blueprints 1–11 | 105/105 OK (319 blueprints: 199 opening, 120 growth, 0 reserve) |
| target_robots within the final robots-goal bounds and ≤ blueprints | 97/97 OK (Squadron excluded); target = blueprints in 105/105 |
| team counts = `requiredTeamNameCounts`; slot sets = Team_Rule; names 3–32 `safeName` | 105/105 OK (194 teams) |
| event_order = the 9 event types once each | 105/105 OK |
| robot name (`validateRobotName`) | **8 fail**: 115 s1 "PZM-7 Śmiały", 115 s2 "PZM-11 Łowca", 143 s1/s2 "Koubu Kai — … Unit", 183 s7–9 "Löwe 01–03", 185 s1 "Sleeper — Operator" |
| loadout, stance, yield 0–50, Build_Focus | 319/319 OK |
| weapon path: 1–3 stages, known weapons, `canEquipToSlot`, loadout shape | 319/319 OK (all have 2 stages) |
| art brief non-empty; `missing_fields` empty | 319/319 OK |

Information only, not defects:

- `opening_robots` is 2 in 16 Generalist and Tycoon stables, whose first robots goal is 1. Spec 55 has no opening field; the second robot arrives at goal 5 (Generalist) or goal 6 (Tycoon). The same pattern occurs in 14 stables in 12–100.
- `strategy_review_limit` differs from the blueprint count in 80 stables. The field is dropped.
- `target_overrides` is `{}` in 81 stables, `{"robots": 3}` in 16 and `null` in the 8 Squadron stables. There is no prose in 101–205.

### 4.4 Item e — decision triggers

- **Decision 3, team names**: 154 of 194 match `"{Prefix} (Pair|Squad) NN"`, in 59 stables; 56 of those have only generic names. The 40 authored names include, for example, Margin Call, Steel Vow and Wind and Fire.
- **Decision 3, robot names**: 131 of 319 have a trailing number or are generic, in 23 stables:
  - 9–11 each: 101, 107, 118, 149, 154, 156, 166, 175, 183, 204.
  - Fewer: 106, 111 (Android 16/17/18, canon), 117 and 136 ("Robot"), 121, 122, 139 ("MARK"), 141, 144, 145, 146, 165, 173.
  - In 63 of them the base name repeats within the stable (mass-produced units such as Cybus Cyberman, Sentinel, Kaylon Unit, Reconstruction Drone, Ameise/Grauwolf/Löwe). In 68 the base name is unique (for example "B1 Battle Droid 02" or "Curb Sweeper 01").
- **Decision 5**: 0 reserves and 0 stables with more blueprints than target in 101–205. The 28 reserves are 8 starters (spec 55) plus 20 in 12–100 (already decided).
- **Decision 2**: 0 alternatives in 101–205. The 7 alternatives are in 16, 17, 21, 51, 88 and 99 (two in 99), already decided.
- **Profanity**: all 1,338 effective names (205 stable, 438 team, 695 robot) went through main's `containsProfanity` (tsx) and through `rules.profanity_hits`. Both found 0 hits and they never disagreed.
  - 29 names contain a list word inside a longer word and pass whole-word matching. 12 of them are in 101–205: Liquid Assets, Striker Assembly Wing, Infinite War Assembly (and its two teams), Casshern, Scrap Collector 07, HK Assassin Protocol, Kaylon Assembly Array, Brassblade, Chimera City Scrapworks, Scrap Garden Restoration Shop.
  - Decision 10 keeps such names.
- **Decision 7, franchise labels (15)**:
  - Slash: 115 "Iron Harvest / World of 1920+", 124 "Cyberbots / Armored Warriors".
  - Hyphen used as a dash: 181 "PLUTO - 2023 anime adaptation".
  - No spaces around the dash: 183 "86—Eighty-Six — anime adaptation".
  - An instruction, not a label: 190 "Scrapland — use the Remastered edition's references".
  - Parentheses instead of the "Title — subtitle" form: 198, 200.
  - Long (41–56 characters, within the 60 limit): 171, 191, 197, 199, 201, 202, 203, 204.
  - Generic one-word labels "DC" and "Marvel" are worth a look.
- **Collisions over 205**: effective names were used (starters as built, 12–100 from `catalogue/` after decisions, 101–205 from the collection).
  - Stable names (case-insensitive), Catalogue_Keys and team names: 0.
  - Robot names (exact): 13, namely E-123 Omega and E-102 Gamma (28/163), Hammer Bot (57/137), Robot (117/136), Sentinel 03–11 (156/166).
  - The raw collection has 10 robot collisions, including stable 48's Sentinel 04–11. Decision 3 already renamed those, but the decision-3 renames in 28 and 57 created the E-series and Hammer Bot clashes with 163 and 137.
  - `output/validation.json` lists the same raw Sentinel and Robot set as "preserved".

### 4.5 Item e — decision-8 themes in 101–205 (for review, no verdict)

- **Real-person likeness**: 6 briefs say "portrayed by" a named actor: 171 s2 AMELIA (Ivanna Sakhno), 173 s1 Harun (Ken Watanabe), 176 s1 Mother (Amanda Collin), 176 s2 Father (Abubakar Salim), 177 s1 Demerzel (Laura Birn), 205 s1 Murderbot (Alexander Skarsgård).
- **Human-looking androids** (positive wording, not negated): 111 s2–3, 129 s1, 130 s1, 131 s1–3, 156 s1, 158 s1–2, 160 s1–2, 168 s1–3, 171 s1, 173 s2–3, 174 s1, 181 s1 and s6, 182 s1, 184 s1, 194 s1. That is 41 matches; 20 more are negated, such as "no human-like face".
- **Child-shaped body**: 171 s1 M3GAN (a child-sized doll). The "child" and "baby" matches in 103 s2 and 180 s1 are negations.
- **Sexual connotation**: 4 matches (111 s3, 130 s1, 131 s3, 158 s1). All are negations such as "not sexualised".
- **Fan works and original web fiction** (licensing and attribution): 198 Portal Stories: Mel, 199 Entropy: Zero 2, 200 Undertale Yellow, 201 Five Nights at Candy's, 202 My Little Pony fan fiction, plus 203 The Last Angel and 204 Chrysalis (original web fiction).
- **15 "original interpretation" portraits** (11 Oct proposal, line 11): #102 s1–2, #104 s1, #105 s3, #106 s1, #156 s3–11, #157 s1.

### 4.6 Item f — images

- 695 slotted WebPs in 205 folders. All 695 decode with sharp (RIFF/WEBP header, `metadata()` and `raw()`), and all are 512×512.
- 0 images without a slot, 0 slots without an image, 0 non-slot files. Each robot's `portrait.webp` equals its runtime WebP (695/695).
- **Decision-3 slots in 12–100 (148 slots, 24 stables)**: every entry in `decisions.json` sets both `name` and `artBrief`. 129 slots are renamed and 19 keep the name with a new brief (designations: Ray 01, AV-98 Unit 1/2, NS-5 Unit 10/11, Centurion 05–11, Tachikoma 05–11).
  - The collection's 12–100 art briefs equal the pre-decision source briefs, so all 148 portraits were drawn for the old brief.
  - Stables: 14, 15, 25, 26, 27, 28, 30, 31, 34, 36, 37, 48, 52, 55, 57, 58, 59, 60, 69, 81, 83, 84, 96, 98. The full slot list is in the verification note.
- **101–205**: the 131 numbered or generic slots in §4.4 are "portrait at risk if renamed".

### 4.7 Item g — spec impact

Hard-coded counts that the 205 scale changes. The new value goes in brackets.

- **requirements.md**:
  - :17 89 Expansion_Stables "12–100" (194, 12–205)
  - :28 (11 + 194)
  - :32 "100 Catalogue_Entries with 376 Robot_Blueprints" (205 / 695 = 50 + 326 + 319)
  - :33 "257 of the 326" (645 expansion blueprints; 101–205: 192 of 319 have no plan)
  - :34
  - :44 `wc -l` prints 100 (205)
  - :46 dry run lists 89 (194)
  - :48 "100 Catalogue_Entries"
  - :84 89
  - :107 "exactly 100 Active_Automatons (11 starter plus 89 generated)"
  - :115
- **design.md**:
  - :12 89 drafts (194)
  - :37 `check-built.ts` "uniqueness over the 100 entries"
  - :77 V02 "across 100"
  - :78 V03 "50 + 326" (50 + 645)
  - :83 V09 "all 100 stables"
  - :105 D7 "all 100"
  - :119 heavy test 100/100
  - :154–156 documentation impact 89/100
- **tasks.md**: :5, :35 (100 repository entries), :38 (heavy test 11 + 89 = 100), :45 (89 drafts), :51–:53.
- **review/README.md**: :6, :16, :18, :29, :31, :94 ("All 89 read…"; 101–205 backstories are authored, not templated), :120, :129, :131, :133 ("all 720 stable, team and robot names", now 1,338).
- **tools**:
  - `convert.py`:2 "the 89 source stables"
  - `check-built.ts`:17 "100 entries"
  - `render_catalogue.py`:244, :247, :308 (title "stables 12–100", "the 89", "all 100 stables")
  - `validate.py`:5, :53, :65, :943–:951 (heavy and activation notes: 100, 89, 189)
  - `validate.py`:876 ("333 blueprints") is about the 12–100 validation report and is unchanged.

Structural impacts:

1. `rules.SOURCE_DIR` reads only `source/automaton-blueprints/`, so 101–205 need a second reader (item h).
2. `validate.py` check A11 parses `source/AUTOMATON_STABLE_EXPANSION.md` as the 12–100 table (89 rows). The 11 Oct file has 0 rows for 12–100, so it cannot replace that file.
3. `convert.validate_decisions` takes its known keys from `source_stable_files()`, so keys for 101–205 would be rejected. The register only allows numbers 1–11, so new decisions (numbered 12 and up) need a code change.
4. The heavy fixture (`HEAVY_POPULATION_SIZE = 100`, 11 starters by `STARTER_CATALOGUE_KEYS` plus 89 generated entries) is unaffected by 205 repository entries. It still proves only 100 Active_Automatons. Activating more than 100 has not been tested.
5. `catalogueImages.test.ts` requires every image folder to belong to a Catalogue_Entry. Once spec 55 is on `main`, the 194 untracked folders fail that test locally until their entries exist.
6. The Squadron strategy has no key in `rules.STRATEGY_DISPLAY_TO_KEY` or the built registry.

## 5. Field mapping for `convert.py` (item h)

Snake_case `source/collection/{NNN-key}/stable.json` → the camelCase review record that `convert.py` reads:

| Collection | Review record | Spec-55 entry / notes |
|---|---|---|
| `number`, `catalogue_key`, `name`, `franchise`, `backstory` | `number`, `catalogueKey`, `stableName`, `franchiseLabel`, `backstory` | `number` dropped |
| `strategy` (display name) | `strategy` | `strategy.key`. "Squadron" raises `ConversionError`. |
| `opening_robots`, `target_robots`, `max_planned_robots` | `openingRobots`, `targetRobots`, `adminMaximumRobots` | Via `convert_overrides`; only the target matters |
| `target_overrides` (`{}`, `{"robots": 3}`, `null`) | `targetOverrides` (`null` → `{}`) | Maps directly; no prose in 101–205 |
| `teams.2v2/3v3[{name, slots, forms}]` | `teamNames.2v2/3v3[{name, slots}]` | `forms` dropped |
| `event_order` | `eventOrder` | — |
| `alternatives` / `replacement_alternatives` | `alternativeBlueprints` | Empty in 101–205 |
| robot `slot`, `name`, `availability`, `blueprint_id`, `source_identity` | `slot`, `name`, `availability`, `blueprintId`, `sourceAlias` | Only `slot` and `robotName` are kept |
| robot `loadout`, `stance`, `yield_threshold`, `build_focus` | `loadout`, `stance`, `yieldThreshold`, `buildFocus` | Build_Focus is lower-cased |
| `weapon_path[{stage, main_weapon, offhand_weapon, list_price_credits}]` | `weaponPath[{mainWeapon, offhandWeapon, listPriceCredits}]`, ordered by `stage` | `weaponPath[{main, offhand?}]` |
| `refinement_plan[{operation, weapon, hand, attribute, magnitude, …}]` | `refinementPlan[{tier, weapon, weaponSlot, attribute, magnitude, …}]` | Regenerated (decision 6); authored plans are logged only |
| `art_brief` | `review.artBrief` | This is the full image prompt (multi-paragraph), not a one-line brief. `CATALOGUE.md` needs a short brief. |
| — | `fit`, `conceptIdentity`, `nameBasis` | Absent. Dropped by `convert.py`; `validate.py` A04 reads `conceptIdentity` with `.get()`. |

**Cannot be mapped** (no spec-55 home):

- Stable level: `strategy_personality`, `purchasing_plan`, `equipment_budget`, `strategy_review_limit`, `source_notes`, `source_documents`, `blueprint_status`, `blueprint_origin`, `folder`, `history_image_count`.
- Per robot: `role`, `equipment_interpretation`, `combat_rationale`, `tuning_plan`, `design_basis`, `range_from_weapons`, `refinement_note`, `refinement_total_credits`, `minimum_roster_expansion_level`, `missing_fields`, `files`, `selected_image`, `folder`.
- Per step: `effect`, `occurrence`, `prestige_gate`, `requirements`, `source_text`, `base_value`, `result_value`, `cost_credits`, `workshop_level`.
- Also: team `forms`, and the Squadron purchase order and authored plans.

The dry run used an in-memory adapter and `convert.convert_stable`, without decisions. Result: 97/105 converted; the 8 errors are all "unknown strategy 'Squadron'". With `strategy=Trio, targetRobots=6`, 8/8 converted to `{"12": 6}` at 6 robots.

## 6. Placement

### 6.1 Totals

| Destination | Files | MB | Folders |
|---|---:|---:|---:|
| `app/frontend/public/assets/automatons/{key}/{slot}.webp` (P1, stables 12–205) | 645 | 34.70 | 194 |
| `source/collection/{NNN-key}/stable.json, blueprints.json` (P2, 101–205) | 210 | 5.77 | 105 |
| `source/collection/AUTOMATON_STABLE_EXPANSION_101-205.md` (P3) | 1 | 0.16 | — |
| **Total** | **856** | **40.62** | |

Verification:

- Pre-flight: every source is in `MANIFEST.sha256` with a matching hash, no destination existed, all paths are inside the two allowed roots, no starter key is included, and every image is named `^\d{1,2}\.webp$`.
- Copy: exclusive create (`open(…, "xb")`), then a re-hash of each copy.
- A fresh process then re-walked both trees: 645/645 and 211/211 match the MANIFEST, with 0 extra and 0 hidden files. 645/645 placed WebPs decode at 512×512.
- `output/` was unchanged before and after: same listing digest, and all 6,469/6,469 MANIFEST hashes match.

### 6.2 Decisions taken in this run

- **P3 sits next to the old proposal instead of replacing it.** The task asked to replace `source/AUTOMATON_STABLE_EXPANSION.md` with the 11 Oct version. That file covers only #101–#205 and the Squadron rules (0 rows for 12–100). Replacing it would lose the only 12–100 proposal, add 89 A11 findings, and overwrite a file, which the add-only rule forbids. It was added as `source/collection/AUTOMATON_STABLE_EXPANSION_101-205.md`. The supersession note is in `review/README.md` §2, not a new `source/README.md`. If you still want a straight replacement, that is a one-file swap once A11 learns the new format.
- **P4 = 0**: no 12–100 stable changed content.
- **P5 left behind**: `completed-expansion-designs.json` ("271 newly completed robot builds across 97 existing expansion stables; …") is the 97 stables 101–205 minus 3 presentation fields. All 97 equal P2 field for field, so its provenance is carried per robot in P2 (`blueprint_origin: "completed during collection"`, `design_basis`, `combat_rationale`).
- **`ALL_BLUEPRINTS.md` left behind**: it is a rendering of `catalogue.json`; spec 57 renders its own `review/CATALOGUE.md`.
- `blueprints.json` duplicates `stable.json.robots` in all 105 stables (about 2.4 MB). Both were copied, as the task asked.

### 6.3 Integration warning

The 194 image folders are untracked on `main`. They do not block merging spec 55, because the starter folders are excluded. After spec 55 is on `main`, `catalogueImages.test.ts` fails locally for every folder without a Catalogue_Entry. Commit the images only with or after their entries (README §5).

### 6.4 Left behind in `output/` (2,054 MB)

| What | Files | MB | Why |
|---|---:|---:|---|
| `stables/*/robots/*/portrait.png`: the only full-resolution masters (about 1254×1254) | 695 | 1,562.78 | Not runtime assets. **Keep a copy outside the repo if you may re-export.** |
| `records/portrait-production` | 71 | 254.01 | Production records |
| `stables/*/history/` | 323 | 142.36 | Earlier image revisions |
| `stables/*/robots/*/portrait.webp` | 695 | 37.65 | Identical to the runtime WebPs |
| `stables/*/alternatives/` | 42 | 16.00 | The 7 alternatives (decision 2: discarded) |
| `catalogue/` (`catalogue.json` 7.13, `ALL_BLUEPRINTS.md` 1.89, `completed-expansion-designs.json` 1.46, CSVs 0.63, `blueprint-gaps.json`) | 8 | 11.11 | Derived views |
| `stables/012–100/*.json` | 178 | 5.48 | Identical to `source/` content |
| `stables/*/robots/*/blueprint.json` | 695 | 4.73 | Duplicates of `stable.json.robots` |
| `runtime-assets/…/{11 starter keys}` | 50 | 2.96 | Identical to spec 55 |
| `reference/project-guides` | 14 | 2.05 | Project guides |
| `stables/*/robots/*/image-record.json`, `profile.md`, `prompt.txt` | 2,085 | 4.47 | Production metadata |
| `stables/*/index.html`, `README.md`, `source-notes.md` | 615 | 2.03 | Gallery pages |
| `records/` other (`asset-placement`, `original-blueprints` = `source/automaton-blueprints/`, `packaged-history`, `copied-sources.json`, `archived-packages.json`, `collection-review` screenshots) | 104 | 6.43 | Records |
| `stables/001–011/*.json` | 22 | 0.54 | Superseded by spec 55 |
| `reference/` other (`AUTOMATON_ROBOT_BLUEPRINTS.md` = `source/`, image roster, production plan, starter drafts) | 5 | 0.46 | References |
| `index.html`, `CATALOGUE.md`, `README.md`, `MANIFEST.sha256`, `validation.json`, `assets/`, `tools/` | 12 | 1.14 | Gallery, collection tooling, manifest |
