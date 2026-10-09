# Review: Starter Automaton Catalogue

**Status**: Approved — 9 Oct 2026
**Scope**: the 11 starter Automaton stables delivered with spec 55. Every value here becomes a catalogue file under `app/backend/prisma/automaton-catalogue/{catalogueKey}.json` once approved. Robot images are separate files found by convention (§2 Images). More stables follow through the admin page or a future spec (decision 32).
**Depends on**: `STRATEGIES.md` (strategy keys, parameters and Build_Focus names).

---

## 1. Overview

| # | Catalogue key | Stable name | Franchise label | Strategy | Opening robots → target |
|---|---|---|---|---|---|
| 1 | `clone-legion` | Kamino Clone Legion | Star Wars — Clone Troopers | Swarm | 3 → 11 |
| 2 | `dalek-empire` | Skaro Dalek Empire | Doctor Who — Daleks | Swarm | 3 → 11 |
| 3 | `robocop-precinct` | Old Detroit Precinct | RoboCop | Paragon | 1 → 1 |
| 4 | `skynet-terminators` | Cyberdyne Skynet | The Terminator | Paragon | 1 → 1 |
| 5 | `jaeger-corps` | Pan Pacific Defense Corps | Pacific Rim — Jaegers | Duo | 2 → 2 |
| 6 | `light-labs` | Light Labs | Mega Man | Duo | 2 → 2 |
| 7 | `decepticon-armada` | Decepticon Armada | Transformers — Decepticons | Trio | 3 → 3 |
| 8 | `white-base` | White Base Mobile Suits | Mobile Suit Gundam | Trio | 3 → 3 |
| 9 | `planet-express` | Planet Express Crew | Futurama | Tycoon | 2 → 2 |
| 10 | `world-robot-boxing` | World Robot Boxing | Real Steel | Tycoon | 2 → 3 |
| 11 | `autobots-ark` | Autobots of the Ark | Transformers — Autobots | Generalist | 2 → 3 |

One franchise is one stable (the Autobots are a single stable containing the Autobots). Franchise labels and backstories are stored and edited in the admin page only; players do not see them until backlog item #61 is built. All franchises are robot-themed. The Minions theme is avoided because an ACC player already uses it.

The second Tycoon stable uses *Real Steel* (a film with fictional boxing robots) rather than BattleBots, whose robots are real machines built by real teams.

- [x] Approved — 9 Oct 2026

---

## 2. Field rules (validated by the catalogue schema)

| Field | Rule | Source |
|---|---|---|
| Catalogue key | 3–40 characters, lowercase letters, digits and hyphens; unique; never changes | new rule (spec 55) |
| Stable name | 3–30 characters; letters, digits, spaces, hyphens, underscores; profanity-checked; unique across all stables | `validateStableName` in `app/backend/src/utils/validation.ts` |
| Robot name | 1–50 characters; letters, digits, spaces and `- _ ' . !`; unique across all robots in the game | `validateRobotName` in `app/backend/src/services/robot/robotCreationService.ts` |
| Team names | one name per team the team rule (below) can form at the highest robot count the strategy's build order allows, capped by the stable's number of blueprints: at most 5 for 2v2 and 3 for 3v3; each 3–32 characters with the same character set as robot names; distinct within the stable. Team names need not be unique in the game (`registerTeam` does not check it); the starter catalogue still keeps all of them distinct (§15) | `registerTeam` / `validateTeamName` / `safeName` |
| Event order | all 9 event types from `services/subscription/eventRegistry.ts`, each exactly once, most wanted first; one order for the whole stable | new rule (spec 55) |
| Robots | every robots target (strategy default or override) is at most the stable's number of blueprints, and a stable has at most 11 blueprints | new rule (spec 55) |
| Franchise label | 1–60 characters; admin only (not shown to players, backlog #61) | new rule |
| Backstory | 1–400 characters of admin-only, in-world flavour text about the stable as a whole (who they are and how they fight), written in the franchise's voice. It is not a biography of a person and has no effect on behaviour. Not shown to players until backlog #61 is built | new rule |
| Loadout | `single`, `weapon_shield`, `dual_wield`, `two_handed` | `utils/weaponValidation.ts` |
| Stance | `offensive`, `defensive`, `balanced` | `routes/robots.ts` stance validation |
| Yield threshold | 0–50 (%) | `routes/robots.ts` yield validation |
| Image | not a catalogue field. Found by convention at `app/frontend/public/assets/automatons/{catalogueKey}/{slot}.webp` (512×512 WebP); no file means no image (see Images below) | new rule (spec 55, decisions 27 and 28) |
| Fighting range | not set: the game derives it from the equipped weapons (`movementAI.ts`). The "Range" column below is informational: the range the stage-0 weapons give | `Weapon.rangeBand` |
| Weapon path | 1–4 stages (the starter catalogue uses exactly 2: stage 0 starter → stage 1 final, the highest-priced weapon for the blueprint's hand type and range: Volt Sabre / Nova Caster / Particle Lance / Vibro Mace one-handed for short / mid / long / melee, Arc Projector / Plasma Cannon / Ion Beam / Heavy Hammer two-handed, Aegis Bulwark as the shield); every weapon exists in the catalogue and fits the loadout (two-handed weapons need `two_handed`; shields go in the offhand of `weapon_shield`; `dual_wield` needs two one-handed weapons) | `canEquipToSlot` |
| Refinement plan | required for every blueprint (decision 35); covers every weapon of the final stage (main hand, plus the offhand of `dual_wield` or the shield of `weapon_shield`); ≤ 5 steps per weapon (≤ 10 per robot); each non-shield weapon has ≥ 1 step; Hone needs the attribute on the weapon (a negative catalogue bonus counts), Augment needs it absent; total per attribute ≤ +10 including the catalogue bonus; no Sharpen/Forge on shields; ≤ 2 Sharpen and ≤ 2 Forge per weapon; ordered by value (below) | `app/shared/utils/weaponRefinement.ts` (validators applied per weapon) |

**Teams.** Teams follow one fixed rule for every stable. 2v2 teams: robots 1+2, 3+4, 5+6, 7+8 and 9+10. 3v3 teams: robots 1–3, 4–6 and 7–9. Robot 11 is in no team, and robots 10 and 11 are in no 3v3 team. A team is registered in the turn its last member joins and is never disbanded or swapped. The catalogue only supplies the names, in this order.

**Events.** Each robot has 3 + Booking Office level slots. The Automaton walks the stable's event order from the top: a solo event (1v1 League, King of the Hill, Grand Melee, 1v1 Tournament) goes to every robot with a free slot; a team event goes to a whole team only if every member has a free slot, otherwise to none of them, and the free slots go to later events. A robot in no team of that size skips the event.

**Refinement plans** (decisions 35 and 36). Every robot has a plan for the weapons of its last stage, written in the order the refine goal applies it. The order follows value per credit (`STRATEGIES.md` §1.8):

1. **Sharpen, Sharpen, Forge, Forge first on every weapon that is not a shield** (₡300,000, ₡900,000, ₡400,000, ₡1,200,000 = ₡2,800,000 per weapon; refinements get no Workshop discount). Sharpen (−10% cooldown each) and Forge (+8% damage each) are by far the strongest tiers. Sharpen comes first because it unlocks at Workshop L5 (3,000 prestige) and Forge only at L8 (15,000 prestige).
2. **Two weapons are interleaved tier by tier.** `dual_wield`: main Sharpen, offhand Sharpen, main Sharpen, offhand Sharpen, main Forge, offhand Forge, main Forge, offhand Forge, then each hand's fifth step. `weapon_shield`: the weapon's steps first, then the shield's.
3. **A fifth step (Hone or Augment) only where it is cheaper than the same + on the robot.** The comparison uses the attribute level the robot reaches at its strategy's last milestone before Max (group weight × milestone, rounded up) and the strategy's season-end Training Facility discount. The attribute comes from the Build_Focus's first-priority group when one qualifies; the largest qualifying magnitude is taken. If nothing qualifies, the weapon has 4 steps and the stable notes why.
4. **Shields take only Hone or Augment, and only when worth it.** On the Aegis Bulwark every positive bonus is already above the +10 cap, so the only Hone targets are its penalties (Evasion Thrusters −5, Servo Motors −4). Each shield takes five Hone +1 on Evasion Thrusters (₡10,000 each, −5 → 0), which is below the price of +1 on the robot for every strategy that has a shield blueprint.

Each step needs a Weapons Workshop level, which the refine goal buys as part of the step: Hone L1, Augment L3, Sharpen L5 (3,000 prestige), Forge L8 (15,000 prestige). In the tables, "main" and "offhand" name the hand; step numbers are the robot's plan order, so the refine goal's target ("Refine → 8 steps") counts them from 1.

**Name collisions at run time.** Robot names are unique across the whole game. If a human (or another Automaton) already owns a blueprint's name when the robot is bought, the Automaton appends a suffix: "Mk II", then "Mk III", up to "Mk X", trimmed to 50 characters. If a stable name is already taken when the catalogue is synced, that entry is skipped and reported to the admin instead of renamed.

**Images.** The catalogue file stores no image path; images are picked up by convention. To add one, save a 512×512 px square WebP as `app/frontend/public/assets/automatons/{catalogueKey}/{slot}.webp`: the folder is the stable's catalogue key and the file name is the robot's slot number (1–11). Example: `app/frontend/public/assets/automatons/clone-legion/1.webp` is CT-7567 Rex. A robot without a file starts with no image and shows the game's generic robot frame, exactly like a player's robot without an image. The next catalogue sync gives a new file to its blueprint and to the live robot built from it when they have no image yet, also for stables that already exist on ACC; it never replaces an image that is already set, such as one uploaded in the admin page. The art brief in each robot table is a one-line description for whoever makes the image.

- [x] Approved — 9 Oct 2026

---

## 3. Kamino Clone Legion (`clone-legion`) — Swarm

| Field | Value |
|---|---|
| Stable name | Kamino Clone Legion |
| Franchise label | Star Wars — Clone Troopers |
| Backstory | Grown, drilled and shipped in batches. The Legion fields more robots than anyone else in the arena, every one of them identical in discipline if not in paint. The sergeants keep the numbers up; the quartermasters keep the repair bills down. Mostly. |
| Strategy | Swarm |
| Target overrides | none (goal 10 Robots → 11, the strategy default) |
| Team names | 2v2: **Torrent Company** (robots 1+2), **Domino Squad** (3+4), **Ghost Company** (5+6), **Foxtrot Company** (7+8), **Coruscant Guard** (9+10) · 3v3: **Bad Batch** (1–3), **Delta Squad** (4–6), **Omega Squad** (7–9) |
| Event order | `league_2v2`, `tag_team`, `league_3v3`, `league_1v1`, `koth`, `grand_melee`, `tournament_3v3`, `tournament_1v1`, `tournament_2v2` |

Torrent Company (Rex + Cody) and Bad Batch (Rex, Cody, Fives) form in the opening. Domino Squad forms with robot 4, Ghost Company with robot 6 (Roster Expansion L5, 3,000 prestige), Foxtrot Company with robot 8 (L7, 10,000) and Coruscant Guard with robot 10 (L9, 25,000); Delta Squad needs robot 6 and Omega Squad robot 9 (L8, 15,000). Robot 11 (Tup) is in no team; robots 10 and 11 are in no 3v3 team.

Event order at work (3 robots at Booking Office L3, so 6 slots each): Rex and Cody (Torrent Company and Bad Batch) fill their 6 slots with 2v2 League, Tag Team, 3v3 League, 1v1 League, King of the Hill and Grand Melee. At 3v3 Tournament, Bad Batch is skipped because Rex and Cody have no free slot; Fives keeps the slot and uses it for 1v1 Tournament. Fives is in no 2v2 team, so he skips the 2v2 events.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief |
|---|---|---|---|---|---|---|---|
| 1 | CT-7567 Rex | `dual_wield` | short | offensive | 10 | Versatile | Veteran captain, blue-striped white armour, twin pistols |
| 2 | CC-2224 Cody | `single` | mid | balanced | 15 | Deadeye | Commander, orange-striped armour, carbine at the shoulder |
| 3 | CT-5555 Fives | `weapon_shield` | short | defensive | 20 | Warden | Trooper behind a riot shield, ARC markings |
| 4 | CT-21-0408 Echo | `single` | long | balanced | 15 | Deadeye | Lean scout trooper, long-barrel pistol, antenna |
| 5 | CT-6116 Kix | `single` | short | defensive | 25 | Tactician | Field medic trooper, red cross plates, sidearm |
| 6 | CT-782 Hevy | `two_handed` | short | offensive | 5 | Bruiser | Bulky heavy gunner with a rotary cannon |
| 7 | CT-4040 Cutup | `single` | melee | offensive | 10 | Sprinter | Wiry trooper with a vibro knife, battle-scarred helmet |
| 8 | RC-1138 Boss | `two_handed` | mid | offensive | 5 | Bruiser | Commando in dark armour with a launcher |
| 9 | CT-5597 Jesse | `single` | short | offensive | 10 | Bruiser | Trooper with a Republic crest painted across his helmet, pistol drawn |
| 10 | CC-3636 Wolffe | `two_handed` | long | balanced | 15 | Deadeye | Grey-striped commander with a cybernetic eye and a long beam rifle |
| 11 | CT-5385 Tup | `dual_wield` | short | offensive | 10 | Sprinter | Young trooper with a teardrop helmet marking and twin pistols |

**Weapon paths** (stage 0 starter → stage 1 final; list prices). "×2" means the same weapon in both hands; "(main) + (off)" names two different weapons.

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Rex | Laser Pistol ×2 (₡114,000) | Volt Sabre ×2 (₡850,000) |
| 2 Cody | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 3 Fives | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 4 Echo | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 5 Kix | Practice Blaster (₡50,000) | Volt Sabre (₡425,000) |
| 6 Hevy | Scatter Cannon (₡84,000) | Arc Projector (₡488,000) |
| 7 Cutup | Practice Sword (₡50,000) | Vibro Mace (₡425,000) |
| 8 Boss | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 9 Jesse | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 10 Wolffe | Training Beam (₡50,000) | Ion Beam (₡544,000) |
| 11 Tup | Laser Pistol ×2 (₡114,000) | Volt Sabre ×2 (₡850,000) |

Weapon reuse: Jesse (slot 9) can start with a Laser Pistol replaced on Rex or Fives, and Tup (slot 11) with Rex's two Laser Pistols. Robots 9–11 need Roster Expansion L8–L10 (15,000 / 25,000 / 50,000 prestige), so they usually join long after the weapons goal (goal 18) has replaced the starters. The storage rule keeps those Laser Pistols, because a blueprint not yet bought still uses them.

**Refinement plans** (every weapon of the final stage, in plan order; applied by Swarm goal 23, Refine → 8 steps per robot, at the lowest priority; decisions 35–36). All 11 robots: 70 steps, ₡38,250,000 at list price; Refine → 8 applies ₡37,590,000 of it.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| CT-7567 Rex (10 steps, ₡5,920,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
|  | Volt Sabre (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| CC-2224 Cody (5 steps, ₡2,960,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| CT-5555 Fives (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| CT-21-0408 Echo (5 steps, ₡2,960,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +4 (5 → 9) ₡160,000 | ₡2,960,000 |
| CT-6116 Kix (5 steps, ₡2,820,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
| CT-782 Hevy (5 steps, ₡2,960,000) | Arc Projector (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| CT-4040 Cutup (5 steps, ₡2,960,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Gyro Stabilizers +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| RC-1138 Boss (5 steps, ₡2,960,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| CT-5597 Jesse (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| CC-3636 Wolffe (5 steps, ₡2,960,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| CT-5385 Tup (10 steps, ₡5,920,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Power Core +4 (−3 → +1) ₡160,000 | ₡2,960,000 |
|  | Volt Sabre (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Power Core +4 (−3 → +1) ₡160,000 | ₡2,960,000 |

Fifth steps (Swarm: Training Facility L1 gives 0% at 11 slots; last milestone 25). +4 on the robot from level 25 costs ₡165,000, so Hone +4 (₡160,000) qualifies on the first-priority group; Hone +5 (₡250,000 against ₡210,000) does not. Fives (Warden: Defense) and Kix (Tactician: AI) have no attribute of their first group on the Volt Sabre, so they take Augment +1 (₡20,000 against ₡39,000; Augment +2 costs ₡80,000 against ₡79,500). Fives' shield Hones cost ₡10,000 against ₡39,000 for +1 Evasion Thrusters on the robot. Refine → 8 applies all of Rex's and Tup's Sharpen and Forge steps (1–8); their Hones (9–10) and Fives' last two shield Hones are applied only if an admin raises the target to 10.

Storage (estimates; the engine counts at run time): Rex (2) + Cody (1) + Fives (2) fill the base 5 at 3 robots, so robot 4 (Echo) needs Storage Facility L1, bought by goal 5's robot chain. 8 robots carry 10 weapons (L1 full). The first final weapons (goal 18) or robot 9 (goal 10), whichever comes first, buys L2; robot 9 needs no level if it can reuse a Laser Pistol. 11 robots on their final weapons carry 14, within L2 (15). When a robot moves to its final weapons and storage is full, an unequipped starter no blueprint still needs (for example Cody's Bolt Carbine or Fives' Light Shield) is sold first.

- [x] Approved — 9 Oct 2026

---

## 4. Skaro Dalek Empire (`dalek-empire`) — Swarm

| Field | Value |
|---|---|
| Stable name | Skaro Dalek Empire |
| Franchise label | Doctor Who — Daleks |
| Backstory | They do not negotiate, they do not retreat, and they do not take the stairs. The Empire rolls out in numbers, shields up and guns forward, and treats every bracket as a planet to be conquered. |
| Strategy | Swarm |
| Target overrides | none (goal 10 Robots → 11, the strategy default) |
| Team names | 2v2: **Skaro Vanguard** (robots 1+2), **Kaled Remnant** (3+4), **Supreme Command** (5+6), **Emperor's Escort** (7+8), **New Paradigm** (9+10) · 3v3: **Cult of Skaro** (1–3), **Time War Assault** (4–6), **Imperial Guard** (7–9) |
| Event order | `league_3v3`, `tournament_3v3`, `league_1v1`, `koth`, `grand_melee`, `league_2v2`, `tournament_2v2`, `tag_team`, `tournament_1v1` |

Cult of Skaro (Sec, Thay, Jast) and Skaro Vanguard (Sec + Thay) form in the opening. Kaled Remnant forms with robot 4, Supreme Command with robot 6 (Roster Expansion L5, 3,000 prestige), Emperor's Escort with robot 8 (L7, 10,000) and New Paradigm with robot 10 (L9, 25,000); Time War Assault needs robot 6 and Imperial Guard robot 9 (L8, 15,000). Robot 11 (Eternal Dalek) is in no team; robots 10 and 11 are in no 3v3 team.

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief |
|---|---|---|---|---|---|---|---|
| 1 | Dalek Sec | `single` | short | balanced | 10 | Tactician | Black-casing commander, gun-stick raised |
| 2 | Dalek Thay | `weapon_shield` | short | defensive | 15 | Warden | Bronze casing behind a shimmering force field |
| 3 | Dalek Jast | `single` | mid | defensive | 15 | Warden | Bronze casing, extended mid-range emitter |
| 4 | Dalek Caan | `single` | long | balanced | 10 | Deadeye | Battered casing, long-focus beam emitter |
| 5 | Supreme Dalek | `two_handed` | long | offensive | 5 | Deadeye | Red-and-gold casing with a heavy cannon |
| 6 | Dalek X | `dual_wield` | short | offensive | 5 | Bruiser | Scarred grey casing with twin guns |
| 7 | Dalek Emperor | `weapon_shield` | mid | defensive | 20 | Warden | Towering white-and-gold casing, great shield |
| 8 | Rusty | `single` | short | balanced | 30 | Versatile | Rust-streaked lone Dalek, slightly dented |
| 9 | Strategist Dalek | `single` | long | balanced | 15 | Tactician | Tall blue casing with a long-focus emitter |
| 10 | Scientist Dalek | `weapon_shield` | short | defensive | 20 | Warden | Tall orange casing behind a force field |
| 11 | Eternal Dalek | `two_handed` | mid | offensive | 5 | Bruiser | Tall yellow casing with a heavy plasma cannon |

**Weapon paths**

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Sec | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 2 Thay | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 3 Jast | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 4 Caan | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 5 Supreme Dalek | Training Beam (₡50,000) | Ion Beam (₡544,000) |
| 6 Dalek X | Laser Pistol ×2 (₡114,000) | Volt Sabre (main) + Nova Caster (off) (₡850,000) |
| 7 Emperor | Bolt Carbine + Combat Shield (₡171,000) | Nova Caster + Aegis Bulwark (₡834,000) |
| 8 Rusty | Practice Blaster (₡50,000) | Volt Sabre (₡425,000) |
| 9 Strategist Dalek | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 10 Scientist Dalek | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 11 Eternal Dalek | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |

Dalek X is the one deliberate exception to "the same top weapon twice" for dual wield: a Volt Sabre (short) in the main hand and a Nova Caster (mid) in the off hand. Both deal 4.0 damage per second, so the main hand decides and Dalek X fights at short, the range it is designed for.

Weapon reuse: Strategist Dalek (slot 9) can start with Dalek Caan's replaced Beam Pistol, and Scientist Dalek (slot 10) with Dalek Thay's Laser Pistol and Light Shield.

**Refinement plans** (every weapon of the final stage, in plan order; applied by Swarm goal 23, Refine → 8 steps per robot, at the lowest priority; decisions 35–36). All 11 robots: 75 steps, ₡34,830,000 at list price; Refine → 8 applies ₡34,450,000 of it.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Dalek Sec (5 steps, ₡2,820,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
| Dalek Thay (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Dalek Jast (5 steps, ₡2,820,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
| Dalek Caan (5 steps, ₡2,960,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +4 (5 → 9) ₡160,000 | ₡2,960,000 |
| Supreme Dalek (5 steps, ₡2,960,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (4 → 8) ₡160,000 | ₡2,960,000 |
| Dalek X (10 steps, ₡5,920,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
|  | Nova Caster (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Dalek Emperor (10 steps, ₡2,870,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Rusty (5 steps, ₡2,960,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Targeting Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |
| Strategist Dalek (5 steps, ₡2,820,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Combat Algorithms +1 (new) ₡20,000 | ₡2,820,000 |
| Scientist Dalek (10 steps, ₡2,870,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Eternal Dalek (5 steps, ₡2,960,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Critical Systems +4 (6 → 10) ₡160,000 | ₡2,960,000 |

Fifth steps follow the same Swarm prices as Kamino Clone Legion (§3): Hone +4 (₡160,000 < ₡165,000) where the first-priority group is on the weapon, otherwise Augment +1 (₡20,000 < ₡39,000): the Tacticians Dalek Sec and Strategist Dalek (AI) and the Wardens Dalek Thay, Dalek Jast, Dalek Emperor and Scientist Dalek (Defense). Refine → 8 applies all of Dalek X's Sharpen and Forge steps (1–8, both hands); his Hones (9–10) and the last two shield Hones of the three shield Daleks are applied only if an admin raises the target to 10.

Storage (estimates): the base 5 is full at 4 robots, so robot 5 (Supreme Dalek) needs Storage Facility L1, bought by goal 10's robot chain together with Roster Expansion L4 (1,000 prestige). 7 robots carry 10 weapons (L1 full); robot 8 or the first final weapons (goal 18) buys L2. 11 robots fill L2 exactly (15).

- [x] Approved — 9 Oct 2026

---

## 5. Old Detroit Precinct (`robocop-precinct`) — Paragon

| Field | Value |
|---|---|
| Stable name | Old Detroit Precinct |
| Franchise label | RoboCop |
| Backstory | Part man, part machine, all paperwork. One unit, one sidearm, and an upgrade budget signed off by the board. The precinct does not field a team — it does not need one. |
| Strategy | Paragon |
| Target overrides | none |
| Team names | 2v2: **Delta City Patrol** (robots 1+2) · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_2v2`, `tag_team`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief |
|---|---|---|---|---|---|---|---|
| 1 | RoboCop | `single` | long | balanced | 15 | Deadeye | Silver-blue armoured lawman, visor, heavy pistol |
| 2 | ED-209 | `two_handed` | mid | offensive | 0 | Bruiser | Hulking bipedal enforcement droid, twin cannon arms |

Slot 2 is only used if an admin raises goal 8 (Robots) to 2, and then raises goal 3 (Booking Office) to L4 as well; Delta City Patrol forms only then.

**Weapon paths**

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 RoboCop | Gauss Pistol (₡291,000) | Particle Lance (₡425,000) |
| 2 ED-209 | Grenade Launcher (₡293,000) | Plasma Cannon (₡408,000) |

RoboCop keeps his premium starter, the Gauss Pistol, as stage 0 (the Paragon opening budget relies on it). Goal 14 (Weapons Workshop → L5) buys Workshop L5 before the Particle Lance, when prestige allows.

**Refinement plans** (every weapon of the final stage, in plan order; applied by Paragon goal 16, Refine → 10 steps per robot, so every step; decisions 35–36). Both robots: 8 steps, ₡5,600,000; RoboCop alone (the default target): ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| RoboCop (4 steps, ₡2,800,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |
| ED-209 (4 steps, ₡2,800,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |

No fifth step: Paragon's Training Facility L10 gives 90% off at 1 slot, so +1 on the robot at level 40 costs ₡6,150, less than the cheapest Hone (+1, ₡10,000). Every Hone or Augment would cost more than the robot upgrade it replaces. Weapon bonuses do go past the attribute maximum of 50, so once the robot reaches "Attributes → Max" a Hone fifth step can be added through a plan edit on the admin page (`STRATEGIES.md` §1.8).

Storage (estimate): at most 4 weapons even with ED-209 (2 equipped plus 2 replaced starters), within the base 5; no Storage Facility level.

- [x] Approved — 9 Oct 2026

---

## 6. Cyberdyne Skynet (`skynet-terminators`) — Paragon

| Field | Value |
|---|---|
| Stable name | Cyberdyne Skynet |
| Franchise label | The Terminator |
| Backstory | It will not stop. It will not yield. Skynet sends a single unit back into every season and spends everything it has on making that unit harder to kill. |
| Strategy | Paragon |
| Target overrides | none |
| Team names | 2v2: **Judgment Day** (robots 1+2) · 3v3: none |
| Event order | `league_1v1`, `tournament_1v1`, `grand_melee`, `koth`, `league_2v2`, `tournament_2v2`, `tag_team`, `league_3v3`, `tournament_3v3` |

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief |
|---|---|---|---|---|---|---|---|
| 1 | T-800 Model 101 | `two_handed` | mid | offensive | 0 | Bruiser | Chrome endoskeleton, red eye, heavy plasma rifle |
| 2 | T-1000 | `dual_wield` | melee | offensive | 0 | Sprinter | Liquid-metal figure with blade arms |

Slot 2 is only used if an admin raises goal 8 (Robots) to 2, and then raises goal 3 (Booking Office) to L4 as well; Judgment Day forms only then.

**Weapon paths**

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 T-800 | Shotgun (₡283,000) | Plasma Cannon (₡408,000) — the Shotgun stays in storage until storage is full |
| 2 T-1000 | Energy Blade ×2 (₡350,000) | Vibro Mace ×2 (₡850,000) |

**Refinement plans** (every weapon of the final stage, in plan order; applied by Paragon goal 16, Refine → 10 steps per robot, so every step; decisions 35–36). Both robots: 12 steps, ₡8,400,000; T-800 alone (the default target): ₡2,800,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| T-800 Model 101 (4 steps, ₡2,800,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 | ₡2,800,000 |
| T-1000 (8 steps, ₡5,600,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 | ₡2,800,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 | ₡2,800,000 |

No fifth step, for the Paragon reason in §5 (+1 on the robot costs ₡6,150 at level 40 with 90% off; the cheapest Hone costs ₡10,000).

Storage (estimate): 1 weapon equipped at the default target, 3 with T-1000. With both robots on their final weapons, 3 equipped plus 3 replaced would exceed the base 5, so replaced weapons are sold; no Storage Facility level.

- [x] Approved — 9 Oct 2026

---

## 7. Pan Pacific Defense Corps (`jaeger-corps`) — Duo

| Field | Value |
|---|---|
| Stable name | Pan Pacific Defense Corps |
| Franchise label | Pacific Rim — Jaegers |
| Backstory | Two pilots, one mind, a lot of steel. The Corps fights in pairs because that is the only way it knows how — linked, shoulder to shoulder, holding the line one tag-team bout at a time. |
| Strategy | Duo |
| Target overrides | none |
| Team names | 2v2: **Drift Compatible** (robots 1+2) · 3v3: **Shatterdome Strike** (1–3) |
| Event order | `league_2v2`, `tag_team`, `tournament_2v2`, `league_1v1`, `koth`, `grand_melee`, `tournament_1v1`, `league_3v3`, `tournament_3v3` |

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief |
|---|---|---|---|---|---|---|---|
| 1 | Gipsy Danger | `two_handed` | melee | balanced | 10 | Bruiser | Blue-steel giant with a glowing chest reactor and a great hammer |
| 2 | Striker Eureka | `single` | short | offensive | 10 | Sprinter | Sleek, fast grey-and-yellow mech with a chest launcher |
| 3 | Crimson Typhoon | `dual_wield` | melee | offensive | 5 | Sprinter | Red three-armed mech with spinning saw blades |

Slot 3 is only used if an admin raises goal 13 (Robots) to 3, and goal 11 (Booking Office) to L6; Shatterdome Strike forms only then.

**Weapon paths**

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Gipsy Danger | Shock Maul (₡183,000) | Heavy Hammer (₡478,000) |
| 2 Striker Eureka | Burst Rifle (₡117,000) | Volt Sabre (₡425,000) |
| 3 Crimson Typhoon | Combat Knife ×2 (₡186,000) | Vibro Mace ×2 (₡850,000) |

**Refinement plans** (every weapon of the final stage, in plan order; applied by Duo goal 17, Refine → 10 steps per robot, so every step; decisions 35–36). All 3 robots: 20 steps, ₡11,240,000; the default 2 robots: ₡5,620,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Gipsy Danger (5 steps, ₡2,810,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (7 → 8) ₡10,000 | ₡2,810,000 |
| Striker Eureka (5 steps, ₡2,810,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Power Core +1 (−3 → −2) ₡10,000 | ₡2,810,000 |
| Crimson Typhoon (10 steps, ₡5,620,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +1 (4 → 5) ₡10,000 | ₡2,810,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +1 (4 → 5) ₡10,000 | ₡2,810,000 |

Fifth steps (Duo: Training Facility L8 gives 64% off at 2 slots; last milestone 30). +1 on the robot at level 30 costs ₡16,740, so Hone +1 (₡10,000) qualifies; Hone +2 (₡40,000 against ₡34,020) and Augment +1 (₡20,000) do not.

Storage (estimate): 2 weapons equipped at the default target, 4 with Crimson Typhoon. No Storage Facility level; replaced weapons are sold when storage is full.

- [x] Approved — 9 Oct 2026

---

## 8. Light Labs (`light-labs`) — Duo

| Field | Value |
|---|---|
| Stable name | Light Labs |
| Franchise label | Mega Man |
| Backstory | Built to help, upgraded to fight. Light Labs sends its two brothers into the tag-team circuit with a simple philosophy: learn from every opponent, charge the shot, and never leave a teammate behind. |
| Strategy | Duo |
| Target overrides | none |
| Team names | 2v2: **Blue Bomber Brothers** (robots 1+2) · 3v3: **Light Family** (1–3) |
| Event order | `tag_team`, `league_2v2`, `tournament_2v2`, `league_1v1`, `tournament_1v1`, `koth`, `grand_melee`, `league_3v3`, `tournament_3v3` |

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief |
|---|---|---|---|---|---|---|---|
| 1 | Mega Man | `single` | short | balanced | 15 | Versatile | Compact blue robot with an arm cannon |
| 2 | Proto Man | `weapon_shield` | short | defensive | 20 | Warden | Red robot with a visor, scarf and round shield |
| 3 | Roll | `single` | long | defensive | 30 | Tactician | Small red-and-white support robot with a long-range blaster |

Slot 3 is only used if an admin raises goal 13 (Robots) to 3, and goal 11 (Booking Office) to L6; Light Family forms only then.

**Weapon paths**

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Mega Man | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 2 Proto Man | Machine Pistol + Light Shield (₡145,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 3 Roll | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |

**Refinement plans** (every weapon of the final stage, in plan order; applied by Duo goal 17, Refine → 10 steps per robot, so every step; decisions 35–36). All 3 robots: 20 steps, ₡8,480,000; the default 2 robots: ₡5,670,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Mega Man (5 steps, ₡2,810,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
| Proto Man (10 steps, ₡2,860,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Roll (5 steps, ₡2,810,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (5 → 6) ₡10,000 | ₡2,810,000 |

Fifth steps use the Duo prices in §7 (Hone +1 at ₡10,000 against ₡16,740 at level 30). Proto Man (Warden) has no Defense attribute on the Volt Sabre and Augment +1 (₡20,000) is dearer than the robot, so he Hones Combat Power, his second group (level 18: ₡10,260 for +1). Roll (Tactician) does the same for the same reason (no AI attribute on the Particle Lance). Proto Man's shield takes five Hone +1 on Evasion Thrusters (₡10,000 each against ₡16,740 on the robot), removing the evasion penalty for ₡50,000 instead of the ₡250,000 one Hone +5 would cost.

Storage (estimate): 3 weapons equipped at the default target, 4 with Roll. No Storage Facility level; replaced weapons are sold when storage is full.

- [x] Approved — 9 Oct 2026

---

## 9. Decepticon Armada (`decepticon-armada`) — Trio

| Field | Value |
|---|---|
| Stable name | Decepticon Armada |
| Franchise label | Transformers — Decepticons |
| Backstory | Peace through tyranny, and tyranny through superior firepower. The Armada fields three of its most notorious commanders as one 3v3 unit and lets the rest of the arena argue about who is really in charge. |
| Strategy | Trio |
| Target overrides | none |
| Team names | 2v2: **Air Command** (robots 1+2), **Science Division** (3+4) · 3v3: **Decepticon High Command** (1–3) |
| Event order | `league_3v3`, `tournament_3v3`, `league_2v2`, `tag_team`, `league_1v1`, `koth`, `grand_melee`, `tournament_2v2`, `tournament_1v1` |

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief |
|---|---|---|---|---|---|---|---|
| 1 | Megatron | `two_handed` | long | offensive | 5 | Deadeye | Grey warlord with an arm-mounted fusion cannon |
| 2 | Starscream | `dual_wield` | short | offensive | 25 | Sprinter | Angular jet-winged robot with twin wrist blasters |
| 3 | Soundwave | `single` | mid | defensive | 15 | Tactician | Blue communications robot with a chest-mounted visor |
| 4 | Shockwave | `two_handed` | mid | balanced | 10 | Deadeye | Purple one-eyed scientist with a cannon arm |

Slot 4 is only used if an admin raises goal 12 (Robots) to 4; Science Division forms only then. Goal 12 allows up to 6 robots, but this stable has 4 blueprints, so 4 is its limit until blueprints and team names are added (decision 31). Starscream's high yield threshold is deliberate characterisation.

**Weapon paths**

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Megatron | Siege Cannon (₡163,000) | Ion Beam (₡544,000) |
| 2 Starscream | Laser Pistol ×2 (₡114,000) | Volt Sabre ×2 (₡850,000) |
| 3 Soundwave | Bolt Carbine (₡93,000) | Nova Caster (₡425,000) |
| 4 Shockwave | Mortar System (₡163,000) | Plasma Cannon (₡408,000) |

**Refinement plans** (every weapon of the final stage, in plan order; applied by Trio goal 22, Refine → 10 steps per robot, so every step; decisions 35–36). All 4 robots: 25 steps, ₡14,050,000; the default 3 robots: ₡11,240,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Megatron (5 steps, ₡2,810,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
| Starscream (10 steps, ₡5,620,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Power Core +1 (−3 → −2) ₡10,000 | ₡2,810,000 |
|  | Volt Sabre (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Power Core +1 (−3 → −2) ₡10,000 | ₡2,810,000 |
| Soundwave (5 steps, ₡2,810,000) | Nova Caster (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
| Shockwave (5 steps, ₡2,810,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (7 → 8) ₡10,000 | ₡2,810,000 |

Fifth steps (Trio: Training Facility L9 gives 63% off at 3 slots; last milestone 30). +1 on the robot at level 30 costs ₡17,205, so Hone +1 (₡10,000) qualifies; Hone +2 (₡40,000 against ₡34,965) and Augment +1 (₡20,000) do not. Soundwave (Tactician) has no AI attribute on the Nova Caster, so he Hones Combat Power, his second group (level 18: ₡10,545 for +1).

Storage (estimates): 4 weapons equipped at the default target, 5 with Shockwave (the base 5 is full at 4 robots). After Megatron's Ion Beam fills the last slot, Starscream's two Volt Sabres need two free slots while his Laser Pistols are still equipped; the Siege Cannon is sold, and the weapons goal (goal 21) buys Storage Facility L1 for the second slot.

- [x] Approved — 9 Oct 2026

---

## 10. White Base Mobile Suits (`white-base`) — Trio

| Field | Value |
|---|---|
| Stable name | White Base Mobile Suits |
| Franchise label | Mobile Suit Gundam |
| Backstory | A battered carrier, a green crew and three prototypes nobody planned to send into combat. White Base learns on the job: upgrade what survives, refit what does not, and keep the formation tight. |
| Strategy | Trio |
| Target overrides | none |
| Team names | 2v2: **Cannon Support** (robots 1+2), **Argama Escort** (3+4) · 3v3: **White Base Squadron** (1–3) |
| Event order | `league_3v3`, `tournament_3v3`, `league_1v1`, `tournament_1v1`, `league_2v2`, `tag_team`, `koth`, `tournament_2v2`, `grand_melee` |

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief |
|---|---|---|---|---|---|---|---|
| 1 | RX-78-2 Gundam | `weapon_shield` | short | balanced | 15 | Versatile | White, blue and red mobile suit with beam rifle and shield |
| 2 | Guncannon | `two_handed` | long | defensive | 15 | Deadeye | Red artillery suit with shoulder cannons |
| 3 | Guntank | `two_handed` | mid | defensive | 20 | Warden | Tracked tank-bodied suit with twin long guns |
| 4 | Zeta Gundam | `dual_wield` | melee | offensive | 10 | Sprinter | Sleek transforming suit with twin beam sabres |

Slot 4 is only used if an admin raises goal 12 (Robots) to 4; Argama Escort forms only then. Goal 12 allows up to 6 robots, but this stable has 4 blueprints, so 4 is its limit until blueprints and team names are added (decision 31).

**Weapon paths**

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 RX-78-2 Gundam | Laser Pistol + Light Shield (₡108,000) | Volt Sabre + Aegis Bulwark (₡834,000) |
| 2 Guncannon | Training Beam (₡50,000) | Ion Beam (₡544,000) |
| 3 Guntank | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 4 Zeta Gundam | Energy Blade ×2 (₡350,000) | Vibro Mace ×2 (₡850,000) |

**Refinement plans** (every weapon of the final stage, in plan order; applied by Trio goal 22, Refine → 10 steps per robot, so every step; decisions 35–36). All 4 robots: 30 steps, ₡14,100,000; the default 3 robots: ₡8,480,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| RX-78-2 Gundam (10 steps, ₡2,860,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |
| Guncannon (5 steps, ₡2,810,000) | Ion Beam (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (8 → 9) ₡10,000 | ₡2,810,000 |
| Guntank (5 steps, ₡2,810,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (7 → 8) ₡10,000 | ₡2,810,000 |
| Zeta Gundam (10 steps, ₡5,620,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +1 (4 → 5) ₡10,000 | ₡2,810,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +1 (4 → 5) ₡10,000 | ₡2,810,000 |

Fifth steps use the Trio prices in §9 (Hone +1 at ₡10,000 against ₡17,205 at level 30). Guntank (Warden) has no Defense attribute on the Plasma Cannon, so he Hones Combat Power, his second group (level 18: ₡10,545 for +1). The Gundam's shield takes five Hone +1 on Evasion Thrusters (₡10,000 each against ₡17,205 on the robot).

Storage (estimates): 4 weapons equipped at the default target, so the Gundam's two final weapons (goal 21) need one more slot than is free; with nothing unequipped to sell, the weapons goal buys Storage Facility L1. If goal 12 is raised to 4, Zeta Gundam joins before the weapons goal (goal 12 comes earlier in the order) and his robot chain buys Storage Facility L1 for his two Energy Blades; the Gundam's final weapons then fit.

- [x] Approved — 9 Oct 2026

---

## 11. Planet Express Crew (`planet-express`) — Tycoon

| Field | Value |
|---|---|
| Stable name | Planet Express Crew |
| Franchise label | Futurama |
| Backstory | Planet Express treats the arena as a side business. The merchandise sells, the streams pay, and the robots are mostly there to keep the cameras rolling. Profit first; glory if it is cheap. |
| Strategy | Tycoon |
| Target overrides | none |
| Team names | 2v2: **Delivery Crew** (robots 1+2) · 3v3: **Robot Arms Apts** (1–3) |
| Event order | `koth`, `grand_melee`, `league_1v1`, `tag_team`, `league_2v2`, `tournament_1v1`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief |
|---|---|---|---|---|---|---|---|
| 1 | Bender | `two_handed` | melee | offensive | 30 | Bruiser | Grey bending robot with antenna, swinging a girder |
| 2 | Calculon | `single` | long | balanced | 20 | Deadeye | Dramatic gold actor-robot with a long-range pistol |
| 3 | Roberto | `dual_wield` | melee | offensive | 0 | Sprinter | Twitchy robot with twin knives |

Slot 3 is only used if an admin raises goal 20 (Robots) to 3; Robot Arms Apts forms only then.

**Weapon paths**

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Bender | War Club (₡84,000) | Heavy Hammer (₡478,000) |
| 2 Calculon | Beam Pistol (₡93,000) | Particle Lance (₡425,000) |
| 3 Roberto | Combat Knife ×2 (₡186,000) | Vibro Mace ×2 (₡850,000) |

**Refinement plans** (every weapon of the final stage, in plan order; applied by Tycoon goal 25, Refine → 10 steps per robot, so every step, at the lowest priority; decisions 35–36). All 3 robots: 20 steps, ₡11,360,000; the default 2 robots: ₡5,680,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Bender (5 steps, ₡2,840,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (7 → 9) ₡40,000 | ₡2,840,000 |
| Calculon (5 steps, ₡2,840,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (5 → 7) ₡40,000 | ₡2,840,000 |
| Roberto (10 steps, ₡5,680,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +2 (4 → 6) ₡40,000 | ₡2,840,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +2 (4 → 6) ₡40,000 | ₡2,840,000 |

Fifth steps (Tycoon with 2 robots: Training Facility L6 gives 48% off at 2 slots; last milestone 30). +2 on the robot from level 30 costs ₡49,140, so Hone +2 (₡40,000) qualifies; Hone +3 (₡90,000 against ₡74,880) does not.

Storage (estimates): 2 weapons equipped at the default target, 4 with Roberto. No Storage Facility level; replaced weapons are sold when storage is full.

- [x] Approved — 9 Oct 2026

---

## 12. World Robot Boxing (`world-robot-boxing`) — Tycoon

| Field | Value |
|---|---|
| Stable name | World Robot Boxing |
| Franchise label | Real Steel |
| Backstory | Somewhere between a sport and a spectacle. The league sells tickets, streams every bout and puts the takings back into the ring. Its fighters range from scrapped-together sparring bots to polished champions, and the crowd loves an underdog. |
| Strategy | Tycoon |
| Target overrides | goal 20 Robots → 3. Kept because Tycoon's own range allows 3 and the goal sits after every Merchandising Hub and Streaming Studio goal (goals 3, 4, 8, 9, 14 and 15) and after the weapons goal, so the stable still invests in income first; the third robot is the franchise's champion, Zeus. With Zeus, goal 13 (Booking Office → L6) climbs past L4 for Crash Palace's 3v3 events |
| Team names | 2v2: **Underworld Circuit** (robots 1+2) · 3v3: **Crash Palace** (1–3) |
| Event order | `koth`, `league_1v1`, `grand_melee`, `tag_team`, `league_2v2`, `tournament_1v1`, `tournament_2v2`, `league_3v3`, `tournament_3v3` |

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief |
|---|---|---|---|---|---|---|---|
| 1 | Atom | `dual_wield` | melee | balanced | 0 | Sprinter | Scuffed grey sparring robot with fists up |
| 2 | Noisy Boy | `dual_wield` | short | offensive | 5 | Bruiser | Flashy black-and-red fighter with glowing panels |
| 3 | Zeus | `two_handed` | melee | defensive | 10 | Warden | Massive black champion with a heavy hammer |

Zeus joins through the goal 20 override; Crash Palace forms with him.

The strategy's other targets apply unchanged. An earlier override that lowered the Merchandising Hub and Streaming Studio goals to L5 is dropped: lowering the income facilities works against the strategy's name and intent, and income facilities are what Tycoon is.

**Weapon paths**

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Atom | Practice Sword ×2 (₡100,000) | Vibro Mace ×2 (₡850,000) |
| 2 Noisy Boy | Machine Pistol ×2 (₡188,000) | Volt Sabre ×2 (₡850,000) |
| 3 Zeus | War Club (₡84,000) | Heavy Hammer (₡478,000) |

**Refinement plans** (every weapon of the final stage, in plan order; applied by Tycoon goal 25, Refine → 10 steps per robot, so every step, at the lowest priority; decisions 35–36). All 3 robots (all within the goal 20 override): 25 steps, ₡14,180,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Atom (10 steps, ₡5,680,000) | Vibro Mace (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Gyro Stabilizers +2 (4 → 6) ₡40,000 | ₡2,840,000 |
|  | Vibro Mace (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Gyro Stabilizers +2 (4 → 6) ₡40,000 | ₡2,840,000 |
| Noisy Boy (10 steps, ₡5,680,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Combat Power +2 (8 → 10) ₡40,000 | ₡2,840,000 |
|  | Volt Sabre (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Combat Power +2 (8 → 10) ₡40,000 | ₡2,840,000 |
| Zeus (5 steps, ₡2,820,000) | Heavy Hammer (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Augment Armor Plating +1 (new) ₡20,000 | ₡2,820,000 |

Fifth steps (Tycoon with 3 robots: Training Facility L6 gives 42% off at 3 slots; last milestone 30). +1 on the robot at level 30 costs ₡26,970 and +2 ₡54,810, so Hone +2 (₡40,000) and Augment +1 (₡20,000) qualify. Zeus (Warden) has no Defense attribute on the Heavy Hammer, so he takes Augment +1 Armor Plating.

Storage (estimates): when the weapons goal (goal 19) first runs, only Atom and Noisy Boy exist: 4 weapons equipped, 1 slot free. Atom's two final weapons need two free slots with nothing unequipped to sell, so the weapons goal buys Storage Facility L1. Zeus joins at goal 20, and goal 19 re-opens for his final weapon; L1 (capacity 10) has room for it.

- [x] Approved — 9 Oct 2026

---

## 13. Autobots of the Ark (`autobots-ark`) — Generalist

| Field | Value |
|---|---|
| Stable name | Autobots of the Ark |
| Franchise label | Transformers — Autobots |
| Backstory | Disciplined, adaptable and stubbornly decent. The Autobots bring a little of everything to the arena — a leader, a scout, a heavy and a medic — and grow carefully, one well-equipped robot at a time. |
| Strategy | Generalist |
| Target overrides | goal 14 Robots → 3. Kept because a Generalist enters a bit of everything; a third robot adds the 3v3 team (Ark Defenders), within Generalist's 2–4 range. With 3 robots, goal 15 (Booking Office → L6) goes past L4 so Ark Defenders gets its 3v3 events |
| Team names | 2v2: **Autobot Vanguard** (robots 1+2), **Ark Repair Crew** (3+4) · 3v3: **Ark Defenders** (1–3) |
| Event order | `league_1v1`, `league_2v2`, `league_3v3`, `koth`, `tag_team`, `grand_melee`, `tournament_1v1`, `tournament_2v2`, `tournament_3v3` |

| Slot | Robot | Loadout | Range (from weapons) | Stance | Yield | Build_Focus | Art brief |
|---|---|---|---|---|---|---|---|
| 1 | Optimus Prime | `single` | short | balanced | 10 | Versatile | Red-and-blue leader with an ion blaster |
| 2 | Bumblebee | `dual_wield` | short | offensive | 20 | Sprinter | Small yellow scout with twin stingers |
| 3 | Ironhide | `two_handed` | mid | defensive | 10 | Warden | Stocky red veteran with a heavy cannon |
| 4 | Ratchet | `weapon_shield` | long | defensive | 25 | Tactician | White-and-red medic with a long pistol and a shield |

Ark Defenders needs slot 3, which the Generalist buys mid-season (goal 14 "Robots → 3"). Until then Optimus and Bumblebee are in no 3v3 team, so they skip the 3v3 events and their slots go to later events in the event order. Slot 4 is only used if an admin raises goal 14 (Robots) to 4; Ark Repair Crew forms only then.

**Weapon paths**

| Slot | Stage 0 | Stage 1 (final) |
|---|---|---|
| 1 Optimus Prime | Laser Pistol (₡57,000) | Volt Sabre (₡425,000) |
| 2 Bumblebee | Laser Pistol ×2 (₡114,000) | Volt Sabre ×2 (₡850,000) |
| 3 Ironhide | Training Rifle (₡50,000) | Plasma Cannon (₡408,000) |
| 4 Ratchet | Beam Pistol + Combat Shield (₡171,000) | Particle Lance + Aegis Bulwark (₡834,000) |

**Refinement plans** (every weapon of the final stage, in plan order; applied by Generalist goal 18, Refine → 10 steps per robot, so every step; decisions 35–36). All 4 robots: 30 steps, ₡14,190,000; the 3 robots of the goal 14 override: ₡11,330,000.

| Robot | Weapon (hand) | Steps on this weapon (plan step number, tier, cost) | Weapon total |
|---|---|---|---:|
| Optimus Prime (5 steps, ₡2,840,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +2 (8 → 10) ₡40,000 | ₡2,840,000 |
| Bumblebee (10 steps, ₡5,680,000) | Volt Sabre (main) | 1 Sharpen ₡300,000 · 3 Sharpen ₡900,000 · 5 Forge ₡400,000 · 7 Forge ₡1,200,000 · 9 Hone Power Core +2 (−3 → −1) ₡40,000 | ₡2,840,000 |
|  | Volt Sabre (offhand) | 2 Sharpen ₡300,000 · 4 Sharpen ₡900,000 · 6 Forge ₡400,000 · 8 Forge ₡1,200,000 · 10 Hone Power Core +2 (−3 → −1) ₡40,000 | ₡2,840,000 |
| Ironhide (5 steps, ₡2,810,000) | Plasma Cannon (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (7 → 8) ₡10,000 | ₡2,810,000 |
| Ratchet (10 steps, ₡2,860,000) | Particle Lance (main) | 1 Sharpen ₡300,000 · 2 Sharpen ₡900,000 · 3 Forge ₡400,000 · 4 Forge ₡1,200,000 · 5 Hone Combat Power +1 (5 → 6) ₡10,000 | ₡2,810,000 |
|  | Aegis Bulwark (offhand) | 6–10 Hone Evasion Thrusters +1 each (−5 → 0) ₡10,000 each | ₡50,000 |

Fifth steps (Generalist with 3 robots: Training Facility L7 gives 49% off at 3 slots; last milestone 25). +2 on the robot from level 25 costs ₡40,545, so Hone +2 (₡40,000) qualifies for Optimus and Bumblebee; Augment +1 (₡20,000 against ₡19,890) does not. Ironhide (Warden) and Ratchet (Tactician) have no first-group attribute on their weapon, so they Hone Combat Power at their combat level 15 (₡12,240 for +1; +2 would cost ₡25,245 on the robot). Ratchet's shield takes five Hone +1 on Evasion Thrusters (₡10,000 each against ₡12,240 at Defense level 15). Every plan starts with a Sharpen, so goal 18 stays Blocked until the stable has 3,000 prestige (Workshop L5), which exercises the "blocked by Workshop level" path.

Storage (estimates): 4 weapons equipped at 3 robots. Optimus's Volt Sabre fills the base 5; Bumblebee's two Volt Sabres then need two free slots, so Optimus's replaced Laser Pistol is sold and the weapons goal (goal 17) buys Storage Facility L1. Slot 4 (Ratchet, 2 weapons) would need Storage Facility L1 as well; if goal 14 is raised to 4 before the weapons goal has bought it, goal 14's robot chain buys it.

- [x] Approved — 9 Oct 2026

---

## 14. Coverage matrix

The starter set must use every engine capability; a unit test (`automatonCatalogueCoverage`) fails if any cell becomes empty after edits.

| Capability | Covered by |
|---|---|
| Strategy Swarm | Kamino Clone Legion, Skaro Dalek Empire |
| Strategy Paragon | Old Detroit Precinct, Cyberdyne Skynet |
| Strategy Duo | Pan Pacific Defense Corps, Light Labs |
| Strategy Trio | Decepticon Armada, White Base Mobile Suits |
| Strategy Tycoon | Planet Express Crew, World Robot Boxing |
| Strategy Generalist | Autobots of the Ark |
| Build_Focus Bruiser | Hevy, Boss, Jesse, Dalek X, Eternal Dalek, ED-209, T-800, Gipsy Danger, Bender, Noisy Boy |
| Build_Focus Deadeye | Cody, Echo, Wolffe, Dalek Caan, Supreme Dalek, RoboCop, Megatron, Shockwave, Guncannon, Calculon |
| Build_Focus Warden | Fives, Dalek Thay, Dalek Jast, Dalek Emperor, Scientist Dalek, Proto Man, Guntank, Zeus, Ironhide |
| Build_Focus Sprinter | Cutup, Tup, T-1000, Striker Eureka, Crimson Typhoon, Starscream, Zeta Gundam, Roberto, Atom, Bumblebee |
| Build_Focus Tactician | Kix, Dalek Sec, Strategist Dalek, Roll, Soundwave, Ratchet |
| Build_Focus Versatile | Rex, Rusty, Mega Man, RX-78-2 Gundam, Optimus Prime |
| Loadout `single` | Cody, Echo, Kix, Cutup, Jesse, Strategist Dalek, RoboCop, Striker Eureka, Mega Man, Soundwave, Optimus Prime … |
| Loadout `weapon_shield` | Fives, Dalek Thay, Dalek Emperor, Scientist Dalek, Proto Man, RX-78-2 Gundam, Ratchet |
| Loadout `dual_wield` | Rex, Tup, Dalek X, T-1000, Crimson Typhoon, Starscream, Zeta Gundam, Roberto, Atom, Noisy Boy, Bumblebee |
| Loadout `two_handed` | Hevy, Boss, Wolffe, Supreme Dalek, Eternal Dalek, ED-209, T-800, Gipsy Danger, Megatron, Shockwave, Guncannon, Guntank, Bender, Zeus, Ironhide |
| Stance offensive / defensive / balanced | e.g. Rex / Fives / Cody (all three in every strategy except Paragon) |
| Range melee / short / mid / long (from weapons) | Cutup / Rex / Cody / Echo (and many more) |
| Dual wield with two different weapons | Dalek X stage 1 (Volt Sabre short + Nova Caster mid: equal damage per second, so the main hand decides and Dalek X fights at short) |
| Yield extremes | 0 (T-800, Roberto, Atom, ED-209, T-1000) and 30 (Rusty, Roll, Bender) |
| All 9 event types | every stable (every event order lists all 9) |
| A team event skipped because a member has no free slot | Kamino Clone Legion at 3 robots and Booking Office L3: Bad Batch skips 3v3 Tournament because Rex and Cody have no free slot (§3) |
| Robots not in a 3v3 team | Pan Pacific Defense Corps, Light Labs and Planet Express at 2 robots skip `league_3v3` and `tournament_3v3`; Swarm robots 10 and 11 (Wolffe, Tup, Scientist Dalek, Eternal Dalek) |
| Robot in both a 2v2 and a 3v3 team | robots 1 and 2 of every stable with 3 or more robots (e.g. Megatron and Starscream) |
| Weapon path with replacement | every stable (stage 0 starter → stage 1 final) |
| Replaced weapon sold because storage is full | Kamino Clone Legion: Cody's Bolt Carbine is sold when storage is full and the next robot moves to its final weapon (§3 storage note) |
| Replaced weapon reused by a robot that joins later | Kamino Clone Legion: Rex's Laser Pistols reused by Tup (slot 11), one by Jesse (slot 9); Skaro Dalek Empire: Dalek Caan's Beam Pistol reused by Strategist Dalek, Dalek Thay's Laser Pistol and Light Shield by Scientist Dalek |
| Offhand-only stage change | none required (every stage lists both slots explicitly) |
| A refinement plan on every blueprint | all 50 blueprints (decision 35), each with ≥ 1 step on every non-shield weapon of its last stage |
| Refinement Hone | every blueprint outside Paragon except Kix, Dalek Sec, Dalek Jast, Strategist Dalek and Zeus (e.g. Rex, Gipsy Danger, Megatron, Bender, Optimus Prime) |
| Refinement Augment | Fives, Kix, Dalek Sec, Dalek Thay, Dalek Jast, Dalek Emperor, Strategist Dalek, Scientist Dalek, Zeus |
| Refinement Sharpen | every blueprint (×2 per non-shield weapon) |
| Refinement Forge | every blueprint (×2 per non-shield weapon) |
| Hone on a negative catalogue bonus | Tup, Striker Eureka, Starscream, Bumblebee (Power Core −3); every shield (Evasion Thrusters −5) |
| Offhand (shield) refinement | Fives, Dalek Thay, Dalek Emperor, Scientist Dalek, Proto Man, RX-78-2 Gundam, Ratchet (Aegis Bulwark, five Hone +1 each) |
| Offhand (dual wield) refinement | Rex, Tup, Dalek X (a different offhand weapon), T-1000, Crimson Typhoon, Starscream, Zeta Gundam, Roberto, Atom, Noisy Boy, Bumblebee (steps interleaved with the main hand) |
| Refine target shorter than a plan | Swarm Refine → 8: Rex, Tup and Dalek X keep their two Hones, and the shield Daleks and Fives their last two shield Hones, for a target of 10 |
| Refinement blocked by Workshop level | every plan's first step (Sharpen) until 3,000 prestige (Workshop L5), and every Forge step until 15,000 prestige (Workshop L8) |
| Tuning (free pool) | every robot |
| Tuning Bay purchase | every stable: every strategy has a Tuning Bay goal (decision 29) |
| One-robot stable | Old Detroit Precinct, Cyberdyne Skynet |
| Wide stable (≥ 7 target) | Kamino Clone Legion (11), Skaro Dalek Empire (11) |
| A stable with a Goal_Target override | World Robot Boxing (goal 20 Robots → 3), Autobots of the Ark (goal 14 Robots → 3) |
| Blueprint slot beyond the default target | Paragon slot 2, Duo slot 3, Trio slot 4, Planet Express slot 3, Autobots slot 4 |

- [x] Approved — 9 Oct 2026

---

## 15. Name checks

All 11 stable names are 10–25 characters and use only letters, digits, spaces and hyphens. All 50 robot names are 4–16 characters and use only allowed characters. All 35 team names are 9–23 characters, use only the `safeName` character set and are distinct (team names need not be unique in the game, but the catalogue keeps them apart). No two robot, team or stable names repeat inside the catalogue. Uniqueness against existing ACC stables and robots cannot be checked from the repository; the Catalogue_Sync reports any stable-name conflict, and robot-name conflicts are resolved at purchase time with the "Mk II" suffix.

| Robot names per stable | Count |
|---|---:|
| Kamino Clone Legion | 11 |
| Skaro Dalek Empire | 11 |
| Old Detroit Precinct | 2 |
| Cyberdyne Skynet | 2 |
| Pan Pacific Defense Corps | 3 |
| Light Labs | 3 |
| Decepticon Armada | 4 |
| White Base Mobile Suits | 4 |
| Planet Express Crew | 3 |
| World Robot Boxing | 3 |
| Autobots of the Ark | 4 |
| **Total** | **50** |

- [x] Approved — 9 Oct 2026
