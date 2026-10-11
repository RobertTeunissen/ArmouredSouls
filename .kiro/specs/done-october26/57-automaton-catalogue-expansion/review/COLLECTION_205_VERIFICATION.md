# Collection 205 — verification note

Raw outputs of the checks behind `COLLECTION_205_GAPS.md` (11 October 2026). Every script ran as an inline heredoc (`python3 -` from `tools/` or the repo root with `PYTHONDONTWRITEBYTECODE=1`, `APP_ROOT=.worktrees/spec-55`, `PROFANITY_ROOT=.`; `node -` from `app/backend` for sharp and tsx). No scratch files were written.

## 1. File counts per destination

| Destination | Files | Bytes | Folders |
|---|---:|---:|---:|
| `app/frontend/public/assets/automatons/` | 645 | 34,695,646 | 194 |
| `.kiro/specs/to-do/57-automaton-catalogue-expansion/source/collection/{NNN-key}/` | 210 | 5,766,159 | 105 |
| `.kiro/specs/to-do/57-automaton-catalogue-expansion/source/collection/AUTOMATON_STABLE_EXPANSION_101-205.md` | 1 | 161,370 | — |
| Total | 856 | 40,623,175 | |

The copy run, after a pre-flight with no copying until every check passed:

```
planned {'P1': 645, 'P2': 210, 'P3': 1}
preflight errors 0 []
P1 files 645 bytes 34695646 MB 34.70 MiB 33.09 folders 194
P2 files 210 bytes 5766159 MB 5.77 MiB 5.50 folders 105
P3 files 1 bytes 161370 MB 0.16 MiB 0.15 folders 1
total files 856 bytes 40623175 mismatches 0 pre-existing 0 (exclusive create)
```

The pre-flight aborted on any of the following, and none occurred:

- the destination exists (`os.path.lexists`);
- the destination is outside the two allowed roots (`os.path.commonpath`);
- a starter key in P1;
- an image name other than `^\d{1,2}\.webp$`;
- a source missing from `MANIFEST.sha256`, or a source hash differing from the MANIFEST.

Each file was written with `open(dest, "xb")`, which fails rather than overwrites, and was re-hashed against the MANIFEST right after writing.

## 2. SHA-256 check (fresh process, re-walk of both destinations)

Method: walk each destination tree and SHA-256 every file. Map it back to its `output/` path and compare with `output/MANIFEST.sha256` (`"<sha256>  <path relative to output>"`, 6,469 entries). The mappings are:

- `automatons/X` ↔ `runtime-assets/app/frontend/public/assets/automatons/X`
- `source/collection/NNN-key/F` ↔ `stables/NNN-key/F`
- `source/collection/AUTOMATON_STABLE_EXPANSION_101-205.md` ↔ `reference/AUTOMATON_STABLE_EXPANSION.md`

```
IMG files ok 645 mismatch 0 extra [] folders 194 starter folders [] folders not mapping to 12-205 slot []
IMG folder number range 12 205
COL files ok 211 mismatch 0 extra [] stable folders 105 range 101 205 contiguous True
hidden entries []
```

Result: 856/856 verified equal to their `output/` source, with 0 mismatches. Nothing pre-existed at any destination: the `automatons/` folder did not exist on `main` (baseline below), and `source/collection/` did not exist.

Placed WebPs, decoded with sharp from `app/backend` (the same decoder as `catalogueImages.test.ts`):

```
placed webp 645 decode ok at 512x512 645 bad []
```

## 3. `app/frontend/public/assets/automatons` — no starters, every folder maps to 12–205

The re-walk output above shows: 194 folders, `starter folders []`, `folders not mapping to 12-205 slot []`, folder numbers 12–205. Every file is `{key}/{slot}.webp`, and each slot is a blueprint slot of that stable. There are no hidden files, PNGs, `index.html`, alternatives or history.

```
$ ls app/frontend/public/assets/automatons | wc -l
     194
$ ls .kiro/specs/to-do/57-automaton-catalogue-expansion/source/collection | wc -l
     106        # 105 stable folders + AUTOMATON_STABLE_EXPANSION_101-205.md
```

## 4. `output/` unchanged

Listing baseline (path, size and mtime of every file under `output/`, digested). It was taken before any work and repeated after placement:

```
before: OUT files 6470 bytes 2094839224 dirs 1648 max_mtime 1791716668.2152455 listing_digest 52a28b23526ec6c3cfe2d2fa566ea308b353e35826a2ce0e67ebaf8671054301
after:  OUT files 6470 bytes 2094839224 dirs 1648 max_mtime 1791716668.2152455 listing_digest 52a28b23526ec6c3cfe2d2fa566ea308b353e35826a2ce0e67ebaf8671054301
```

Full content check after placement (every MANIFEST entry hashed):

```
MANIFEST entries 6469 match 6469 mismatch 0 missing [] files not in MANIFEST ['MANIFEST.sha256']
```

## 5. Spec-55 worktree and repository state

```
$ git -C /Users/robertteunissen/Documents/Repositories/ArmouredSouls/.worktrees/spec-55 status --porcelain
?? .agents/
```

The HEAD was `bc8c8682e5cc7b6cf170c9d76ce22e628e97498f` both before and after.

```
$ git -C /Users/robertteunissen/Documents/Repositories/ArmouredSouls status --porcelain
?? .kiro/specs/to-do/57-automaton-catalogue-expansion/
?? app/frontend/public/assets/automatons/
?? output/
```

Before the run, only the first and third lines were present. No commit was made.

Spec-57 folder: SHA-256 of every pre-existing file, excluding `review/README.md` and the new files (`source/collection/`, `COLLECTION_205_GAPS.md`, this note), digested:

```
before: S57 files (excl README/new) 203 digest c04bb5c9ea8aa4f0ee2e8b5cfe11600414afc26121f8ae3dffb02a252158100a
after:  S57 files (excl README/new) 203 digest c04bb5c9ea8aa4f0ee2e8b5cfe11600414afc26121f8ae3dffb02a252158100a
review/README.md before 35041b072410479442edaf4ba8ce64ca22c575f9e0188fb3e20c83ae8bb9c575
review/README.md after  951ecef9db8111759ed49ac3a50b75c3c18e9f5b330509a561f33d883374fd85   (§2 source note only)
pycache under S57: []    hidden under S57: []
```

`validate.py --check-readme`, run before and after the README edit, gave identical output:

```
PO-class checks: ['A01', 'A02', 'A03', 'A04', 'A08', 'A09', 'A12', 'V18']; missing from README.md: none
§4 decisions with exactly one ticked box: 11/11; wrong: none
Decisions list entries: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]; missing: none
decisions.json register: 11 entries [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
decided residual checks: ['A01', 'A02', 'A04', 'A09']; not in any register entry: none
exit 0
```

## 6. Gap-check raw results

### Item a (starters)

```
images same 50 differ 0 set-diff []
fields compared 510
diffs by field {'target_overrides(raw) vs targetOverrides': 11, 'refinementPlan': 50}
(10, 'world-robot-boxing', 'target_overrides(raw) vs targetOverrides', "goal 18 Robots → 3. Kept because …", {'20': 3})
(11, 'autobots-ark', 'target_overrides(raw) vs targetOverrides', "goal 14 Robots → 3. Kept because …", {'14': 3})
(1, 'clone-legion', 's1.refinementPlan', '0 steps', '10 steps')   … 50 slots, collection 0–5 steps vs built 4–10
```

### Item b (12–100)

```
stables 89 source_blueprint==source 89 robot source_blueprint==source 89 blueprints.json==stable.robots 89
diffs 48   diff fields Counter({'max': 48})       # collection max_planned_robots = blueprints, source adminMaximumRobots = blueprints + 1
overlay apply 67 / 67 []
```

### Items c and h (101–205) and the Squadron-as-Trio pass

```
strategies {'Swarm': 10, 'Duo': 18, 'Trio': 12, 'Paragon': 41, 'Generalist': 9, 'Tycoon': 7, 'Squadron': 8}
target_overrides shapes {'dict:{}': 81, "dict:{'robots': 3}": 16, 'NoneType:None': 8}
stats {'robots': 319, 'avail:opening': 199, 'origin:completed during collection': 271, 'plan nonempty': 127, 'avail:growth': 120, 'review_limit!=blueprints': 80, 'origin:preserved existing design': 48}
issues 29 Counter({'opening_robots': 16, 'name': 5, 's1.name': 3, 's2.name': 2, 's7.name': 1, 's8.name': 1, 's9.name': 1})
  (opening_robots 2 > first robots goal 1: 16 Generalist/Tycoon stables, same pattern as 14 stables in 12–100; informational)
converted 97 /105; errors ["corpus-proxy-exchange: unknown strategy 'Squadron'", … 8 × Squadron]
trio (113, 'corpus-proxy-exchange', {'12': 6}, [(4, 5), (4, 5), (5, 5), (5, 10), (2, 5), (3, 10)], 6)
trio (114, 'walking-war-foundry', {'12': 6}, [(5, 10), (2, 5), (5, 5), (4, 10), (5, 5), (5, 10)], 6)
trio (119, 'arena-systems-consortium', {'12': 6}, [(5, 10), (3, 10), (5, 5), (2, 5), (4, 5), (2, 5)], 6)
trio (123, 'terra-nova-gearworks', {'12': 6}, [(3, 10), (4, 5), (2, 5), (4, 10), (4, 5), (5, 5)], 6)
trio (127, 'gutsy-robot-command', {'12': 6}, [(4, 5), (4, 5), (2, 5), (5, 10), (5, 5), (2, 5)], 6)
trio (137, 'factory-night-shift', {'12': 6}, [(2, 5), (5, 10), (4, 5), (5, 5), (4, 5), (4, 10)], 6)
trio (159, 'wily-robot-master-foundry', {'12': 6}, [(2, 5), (5, 10), (5, 5), (4, 5), (2, 5), (2, 5)], 6)
trio (181, 'seven-great-robots-workshop', {'12': 6}, [(2, 5), (4, 5), (5, 10), (5, 5), (2, 5), (5, 10)], 6)
squadron refinement total 45380000 steps 181
```

Each Trio tuple per slot is (authored steps, generated steps).

### Item e (profanity over all 205, effective names)

```
names checked 1338 {'stable': 205, 'team': 438, 'robot': 695}
TS hits 0 python hits 0 disagreements []
substring-only (pass whole-word): 29
```

### Item e (decision triggers and collisions)

```
DECISION3 stables with any: 59 generic team names 154 of 194 numbered robots 131 of 319 repeated-base 63 single 68
stables with all teams generic: 56 stables with numbered robots: 23
DECISION5 reserves 101-205 [] blueprints>target [] all reserves {'1-11': 8, '12-100': 20}
DECISION2 alts 101-205 [] all [(16, 1), (17, 1), (21, 1), (51, 1), (88, 1), (99, 2)]
EFFECTIVE collisions stable {} keys {}
 robots {'E-123 Omega': [(28, 10), (163, 2)], 'E-102 Gamma': [(28, 11), (163, 1)], 'Hammer Bot': [(57, 3), (137, 3)], 'Robot': [(117, 1), (136, 1)], 'Sentinel 03'…'Sentinel 11': [(156, n), (166, n)]}
 teams {}
RAW collection collisions robots 10 (Sentinel 04–11 in 48/156/166, Sentinel 03 in 156/166, Robot in 117/136)
```

### Item f (all 695 source WebPs)

```
{"folders":205,"webp":695,"decoded":695,"dim512":695,"bad":[],"unmapped":[],"slotsWithoutImage":[],"nonSlotFiles":[],"stables":205,"slots":695}
portrait.webp == runtime webp: 695 differ: 0
decision-3 slots (decisions.json robots.*): Counter({'renamed+brief': 148}) in 24 stables
```

Of the 148, 129 got a new name and 19 kept their designation with a new brief. All 148 were drawn for the pre-decision brief. By stable, with slots:

- 14: s7–11
- 15: s6–11
- 25: s2
- 26: s2–11 (s10–11 kept as mass-produced)
- 27: s1–11 (s5–11 kept as mass-produced)
- 28: s4–11
- 30: s2–3
- 31: s2–4
- 34: s1–3
- 36: s1–11
- 37: s1–3
- 48: s1–11
- 52: s1 (kept, canon)
- 55: s3
- 57: s1–11
- 58: s1–3
- 59: s1–11
- 60: s1–11
- 69: s1–3
- 81: s2
- 83: s1–2 (kept, canon)
- 84: s1–11 (s5–11 kept as mass-produced)
- 96: s3–11
- 98: s2–11

### Step 10 (P5 redundancy)

```
description: 271 newly completed robot builds across 97 existing expansion stables; source roster, names, strategies and selected portraits retained.
97 stables, numbers 101 205; equal 97 differ 0
```

### Leave-behind duplicates

```
diff -rq output/records/original-blueprints source/automaton-blueprints   → identical
cmp output/reference/AUTOMATON_ROBOT_BLUEPRINTS.md source/AUTOMATON_ROBOT_BLUEPRINTS.md → identical
```

## 7. Re-running the verification

From the repo root, re-run section 2: walk both destinations, hash each file and look up the mapped path in `output/MANIFEST.sha256`. This works for as long as `output/` exists. After `output/` is deleted, the MANIFEST comparison cannot be repeated. The sharp decode (`node -` in `app/backend`) and the counts in section 1 still can.
