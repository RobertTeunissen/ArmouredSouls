# Automaton catalogue: second expansion (Automaton Package)

**Date:** 27 October 2026 · **Branch:** `feat/automaton-catalogue-500` · **Source:** the external art-and-authoring handoff `AUTOMATON_STABLES_001-500_COMPLETE`. Only its runtime parts were committed: the Catalogue_Entries and the 512 px WebP portraits. Its PNG masters, image prompts, build books and audit files were not kept in the repository.

## What was delivered

| | Before | Added | After |
|---|---:|---:|---:|
| Catalogue_Entries (`app/backend/prisma/automaton-catalogue/`) | 205 | 295 | 500 |
| Blueprint_Slots | 695 | 965 | 1660 |
| Repository_Images (`app/frontend/public/assets/automatons/{catalogueKey}/{slot}.webp`) | 695 | 965 | 1660 |

New entries per strategy: Duo 54, Generalist 49, Paragon 28, Swarm 6, Trio 144, Tycoon 14 (catalogue after: Duo 89, Generalist 66, Paragon 100, Swarm 32, Trio 183, Tycoon 30).

- **Entries**: the handoff's `BUILD_DESIGNS/IMPORT_CANDIDATES/app/backend/prisma/automaton-catalogue/*.json`, copied without touching any existing file (`rsync --ignore-existing`; no key overlaps the existing 205).
- **Images**: the handoff's `READY_TO_COPY/app/` tree. Its 695 legacy images are byte-identical to the repository's; the 965 expansion images are new. No repository image was replaced or removed.
- **Strategy version**: the candidates were authored against commit `8a9de7ba` and pinned v1. `pnpm run automaton:catalogue-upgrade` moved all 295 to v2 and remapped their position-keyed overrides by Goal type and occurrence (Generalist `"14": 3` → `"15": 3`, Tycoon `"20": 3` → `"21": 3`, Trio `"12": N` → `"13": N`, Swarm `"10": 8` → `"11": 8`). A second dry run reports 0 upgraded, 500 current. Every stable therefore starts on the latest strategy version, as the product owner requires.

## Changes to the handoff content

The handoff passed its own audit but was not run against this repository's catalogue tests. Three kinds of problem showed up. All fixes are minimal and keep the stable recognisable; no build, weapon, plan, team or event-order field was changed.

**Profanity rule** (`catalogueSchema.test.ts` → `validateStableName`, whole-word `hell`):

| Old key / name | New key / name |
|---|---|
| `machine-hell-maintenance-crew` / Machine Hell Maintenance Crew | `ultrakill-maintenance-crew` / Ultrakill Maintenance Crew |

The key changed too, because it becomes the Activation username (`automaton_{catalogueKey}`). Its image folder moved with it, and the backstory's opening name was updated.

**Cross-catalogue robot-name uniqueness** (`crossEntryDuplicates`). Spec 57 decision 15 rule: the higher-numbered (newer) stable changes. Each rename keeps the portrait's subject:

| Stable | Slot | Old | New | Collided with |
|---|---:|---|---|---|
| `lbx-tournament-workshop` | 1 | Achilles | LBX Achilles | `robot-jox-arena-hangar` |
| `o-c-u-wanzer-procurement` | 1 | Zenith | OCU Zenith | `wanzer-assembly-corps` |
| `o-c-u-wanzer-procurement` | 2 | Frost | OCU Frost | `wanzer-assembly-corps` |
| `har-heavy-division` | 3 | Nova HAR | Heavy Nova HAR | `war-arena-foundry` |

**Stable names cut at 30 characters.** The handoff shortened long names mechanically: five got the stable's number appended and twelve lost their final noun. The backstories still carry the full names and were not changed. New names stay close to the full name and within 3–30 characters:

| Key | Handoff name | New name |
|---|---|---|
| `canoptek-tomb-maintenance-array` | Canoptek Tomb Maintenance 296 | Canoptek Maintenance Array |
| `future-infiltration-prototype-yard` | Future Infiltration 475 | Future Infiltration Yard |
| `sanderson-household-charging-dock` | Sanderson Household 442 | Sanderson Charging Dock |
| `toho-mechanical-defense-archive` | Toho Mechanical Defense 346 | Toho Mech Defense Archive |
| `ultra-mechanical-threat-archive` | Ultra Mechanical Threat 345 | Ultra Mech Threat Archive |
| `baxter-foundation-robot-workshop` | Baxter Foundation Robot | Baxter Foundation Workshop |
| `commonwealth-companion-workshop` | Commonwealth Companion | Commonwealth Companion Works |
| `decepticon-triple-change-arsenal` | Decepticon Triple-Change | Decepticon Triple-Changers |
| `dimension-c-137-machine-workshop` | Dimension C-137 Machine | Dimension C-137 Workshop |
| `gargantia-machine-caliber-hangar` | Gargantia Machine Caliber | Gargantia Caliber Hangar |
| `grid-battleforce-beastbot-workshop` | Grid Battleforce Beastbot | Grid Battleforce Workshop |
| `heart-and-slash-recovery-workshop` | Heart and Slash Recovery | Heart and Slash Workshop |
| `ptolemaios-celestial-being-hangar` | Ptolemaios Celestial Being | Celestial Being Hangar |
| `storage-special-airborne-arsenal` | STORAGE Special Airborne | STORAGE Airborne Arsenal |
| `three-blocs-mobile-suit-arsenal` | Three Blocs Mobile Suit | Three Blocs Suit Arsenal |
| `treasure-planet-navigator-works` | Treasure Planet Navigator | Treasure Planet Navigators |
| `wonder-project-android-workshop` | Wonder Project Android | Wonder Project Workshop |

**Left as authored.** 35 robots carry a franchise suffix the handoff added to keep names unique, such as "Megatron - Beast Wars", "Adam - NieR" and "Sentry - ULTRAKILL". They pass every rule. Shortening them would need new unique names, which is a content decision.

## Checks

| Check | Result |
|---|---|
| Catalogue suites: `pnpm run test:unit -- catalogueSchema catalogueImages automatonCatalogueCoverage catalogueUpgrade automatonCatalogueService` | 5 suites, 3454 tests passed (before the fixes: 6 failures, the four items above plus the profanity hit) |
| `pnpm run lint`, `tsc --noEmit`, `pnpm run test:tiers:verify` | exit 0 |
| ACC name collisions (read-only query, 27 Oct): every new stable name against `users.stable_name` (case-insensitive) and `automaton_profiles.planned_stable_name`, every `automaton_{key}` against `users.username`, every key against `automaton_profiles` | 0 hits, so the deploy-time Catalogue_Sync will add every new entry as a draft |
| Refinement plans | Generated by the handoff against `8a9de7ba`'s pricing. They pass the shared refinement validators (catalogue schema test). The spec-57 value rule, which picks the fifth step by the robot price, was not re-run against the current `pricing.ts`. |

| Backend unit tier, `typecheck:tests` | 9,949 passed, 1 skipped (the existing guide-content guard); exit 0 |
| Backend integration tier on a fresh throwaway database | 167 suites, 2,006 tests passed; exit 0 |
| Backend `pnpm run build`, frontend `pnpm run build` | exit 0; `dist/assets/automatons/` holds all 1,660 portraits |
| Catalogue_Sync on a fresh, seeded throwaway database (`automatonCatalogueSync.ts --dry-run`, then two real runs) | dry run exit 0 with 500 would-add lines; run 1 `added 500, already present 0, conflicts 0`; run 2 `added 0, already present 500` |
| Heavy `tests/integration/automatonMultiSeason.test.ts` (throwaway database, every repository entry active, two seasons, one rollover) | 3 tests passed, 606 s; 0 alerts, 0 failed or budget-skipped turns, 0 Turn_Budget stops |

Heavy timing (500 Active_Automatons, local Apple Silicon, PostgreSQL 17 in Docker, concurrency 3; these are not ACC timings):

| Step | Trigger | Step duration | s/Automaton | Max turn | Charged actions | Robots bought | Peak connections |
|---|---|---:|---:|---:|---:|---:|---:|
| s1 prep 1 (opening build) | preparation | 179.1 s | 0.358 | 2.5 s | 7,319 | 1,115 | 13 |
| s1 prep 2 | preparation | 2.9 s | 0.006 | 0.03 s | 0 | 0 | 12 |
| s1 cycles 1–5 | settlement | 7.8–9.9 s | 0.016–0.020 | 0.17 s | 289–430 | 0 | 11–12 |
| s1 → s2 rebuild | season_open | 158.6 s | 0.317 | 1.4 s | 7,334 | 1,115 | 14 |
| s2 prep 1–2 | preparation | 2.8–2.9 s | 0.006 | 0.03 s | 0 | 0 | 12 |
| s2 cycles 1–5 | settlement | 7.2–9.3 s | 0.014–0.019 | 0.16 s | 260–418 | 0 | 10–12 |

Strategy_Comparison answered in 318 ms and 300 ms (limit 2 s). The opening step at 500 stables (179 s) is faster than the 205-stable v2 run recorded in `AUTOMATON_ECONOMY_AND_EVENT_FIT.md` (308 s). The difference was not investigated; that run may have been slowed by the machine. The CI heavy job (30-minute limit) took 12–14 minutes on main at 205 stables; this suite now takes about 10 minutes locally.

## ACC baseline (read-only, 27 October 2026)

- Season 1, competitive, cycle 85 of 100 (rollover in about 15 cycles).
- 205 active Automaton_Profiles, all on v2, with 403 robots (human 97, generated 7,490). There are no drafts.
- Settlement Turn_Step: 205 completed turns, 46–55 s summed turn time per night; no budget skips since 15 October.
- Daily battles: about 5,400–6,100. Scheduler jobs on 26–27 October: settlement 64 min, Grand Melee 17–38 min, other slots up to 28 min.
- Disk: 9.1 GB free (80 % used). The new images add about 45 MB.

## ACC rollout

1. **Deploy** the merged branch. The pipeline rsyncs the images, runs `pnpm run automaton:sync` (adds the new entries as Draft_Automatons on v2 with their images), restarts the backend and runs `pnpm run automaton:upgrade` (nothing to do). Afterwards the admin Automatons page shows 205 active stables and 295 drafts.
2. **Activate** with **Activate all drafts**, outside the 00:00 settlement and the battle slots. The 194-stable activation on 12 October took 21 s. The new set will take about 30 s or more, which can outlast Caddy's 30 s response limit. If the page reports an error, reload it and check the draft count before clicking again (ops guide §1).
3. **First Turn_Step** (next 00:00 settlement): every new stable makes its opening build from ₡3,000,000. The step's deadline is 6 h, with 3 turns in parallel. Expected settlement growth on ACC's 2 vCPUs: tens of minutes for the opening builds, and later about 2.4 times today's turn time per night. Check the Status_Bar and `automaton_turns` for `failed` or `step_budget_exhausted`.
4. **Watch for a few cycles**: battle volume (the Automaton robot count grows from 403 toward about 1,400, roughly +12 % of all robots), the battle-slot durations, and `automaton_negative_balance` alerts.

**Timing.** Activating now gives the new stables the last ~15 cycles of season 1, after which Season_Rollover rebuilds every Automaton from the starting balance. Activating at the rollover gives a clean start in season 2 but no live data before it. Product owner decision (27 October 2026): activate every new stable right after the deploy, to see in the remaining season-1 cycles whether the v2 economy changes take effect and whether the new stables are viable.

## Not verified

- ACC opening-build duration at this population (the local heavy run is on Apple Silicon; ACC has 2 vCPUs with PostgreSQL on the same host).
- Matchmaking and battle-slot duration with about 1,000 more robots.
- The CI heavy job at this population (30-minute limit). It first runs on the PR.
