# Review: Upgrade Strategies and Build Focus Presets

**Status**: Approved — 9 Oct 2026
**Scope**: how every Automaton decides what to buy, the six Upgrade_Strategies, the six Build_Focus presets, the numbered build orders with their editable targets, and the names shown in the admin page.
**Source facts**: `app/backend/src/config/facilities.ts`, `app/backend/src/utils/economyFormulas.ts`, `app/shared/utils/discounts.ts`, `app/shared/utils/upgradeCosts.ts`, `app/shared/utils/academyCaps.ts`, `app/shared/utils/weaponRefinement.ts`, `app/backend/src/services/financial/settlementService.ts`, `app/backend/src/config/subscriptions.ts`, `app/frontend/src/components/onboarding/rosterStrategyData.ts`, `app/shared/utils/repairCost.ts`, `app/backend/src/services/economy/streamingRevenueService.ts`, `app/backend/src/services/tuning-pool/tuningPoolConfig.ts`, `app/backend/src/config/env.ts`.

All behaviour in this document is a first draft. Budget figures are estimates; the engine computes exact costs at run time.

---

## 1. How an Automaton thinks (all strategies)

### 1.1 When it acts

An Automaton takes one **turn** at the end of every daily settlement, after the cycle has closed:

- **Competitive cycles**: one turn per settlement. Purchases are booked to the new cycle, exactly like a human who buys something a minute after settlement.
- **Preparation cycles**: one turn per preparation settlement. This is when the Automaton builds its opening stable, the same window humans use.
- **Season rollover**: the rollover resets the Automaton like a human (₡3,000,000, no robots, no facilities, no weapons). Straight after the rollover it takes a "season open" turn and starts rebuilding. On the final cycle of a season it does **not** spend before the wipe.

It never acts at any other time, and an admin cannot trigger a turn by hand.

### 1.2 The build order

Each strategy is an ordered list of **goals** — a build order, like the one a human keeps in their head ("first a second robot, then get everyone to level 6, then a Booking Office…"). Every turn, the Automaton walks the list from the top and looks at each goal:

| What the goal reports | Meaning | What the Automaton does |
|---|---|---|
| **Satisfied** | Already done (e.g. "2 robots" and it has 2) | Moves to the next goal |
| **Blocked** | Money cannot solve it right now: a prestige gate on the goal or on one of its prerequisites, a facility at max level, a full roster (11 robots), no blueprint for the next robot | Moves to the next goal — it does **not** save for it |
| **Saving** | The goal is possible but it cannot afford the next step yet | **Stops the turn** and keeps its money for this goal |
| **Actionable** | Possible and affordable | Buys the next step, re-reads its stable, and **starts again from the top of the list** |

This is the rule you described: *if money is the problem, save; if something else is the problem, do the next thing instead.* Because the list restarts after every purchase, a newly bought robot immediately pulls attention back to the early goals ("everyone to level 6") before the Automaton moves on.

**Affordability** means: `balance ≥ cost of the next step`. Nothing is held back. If the next step on the list costs ₡1,300,000 and the Automaton has ₡900,000, it saves — every turn, for as long as it takes — and buys nothing lower in the list in the meantime.

### 1.3 Chains: every goal buys its own prerequisites

A goal is never a single purchase in isolation. Like a human, the Automaton knows what a goal needs first and buys that as part of the goal:

| Goal | Prerequisites it buys first |
|---|---|
| Robots → N | the Roster Expansion levels for the extra slot (slots = level + 1), room in storage for any weapon it has to buy: an unequipped weapon is sold first; only if nothing can be sold, a Storage Facility level (capacity = 5 + 5 × level) (§1.8), then the robot (₡500,000) and its weapons — reusing unequipped weapons already in storage first (§1.8) |
| Attributes → L | the academy levels needed so the attribute caps reach the target (cap 10 without an academy, 15 at L1, 20 at L2 … 50 at L10) |
| Weapons → final | room in storage for the new weapons: an unequipped weapon is sold to make room; only if nothing can be sold, a Storage Facility level (§1.8) |
| Refine | the Weapons Workshop level the next plan step needs (Hone L1, Augment L3, Sharpen L5, Forge L8) |
| Facility → L | nothing; facility levels have no prerequisites other than prestige |

The cost of a goal is the cost of its next step **including** these prerequisites, so "Robots → 4" costs Roster Expansion L3 + a robot + its weapon, not just ₡500,000. A robot is only bought when the whole chain is affordable in the same turn, so the Automaton never ends up with an empty roster slot or an unarmed robot.

**Prestige gates.** Every facility level from L4 up needs prestige (L4 1,000 · L5 3,000 · L6 5,000 · L7 10,000 · L8 15,000 · L9 25,000 · L10 50,000). If a goal's next prerequisite is gated, the goal is **Blocked** and the Automaton moves on — it never saves for something it is not allowed to buy yet.

Example: Swarm has 4 robots and 640 prestige; goal 10 is "Robots → 11". Robot 5 needs Roster Expansion L4, which needs 1,000 prestige. Goal 10 is Blocked, so the Swarm spends on the goals below it instead (Weapons Workshop, Tuning Bay, attributes …; Booking Office L4 in goal 11 needs the same 1,000 prestige). When its prestige reaches 1,000, goal 10 is possible again and it starts saving for robot 5 before anything lower in the list.

### 1.4 Robot fit-out (a new robot is fully functional the same turn)

When a robot is bought, the Automaton immediately:

1. names it from the next blueprint slot (a stable always has a blueprint for every robot its targets allow, §2),
2. sets its image, loadout, stance and yield threshold from the blueprint,
3. equips weapons from its weapon path, reusing unequipped weapons in storage before buying (§1.8),
4. registers a team when the robot completes one under the team rule (2v2: robots 1+2, 3+4, 5+6, 7+8, 9+10; 3v3: robots 1–3, 4–6, 7–9),
5. subscribes the robots through the stable's event order (§1.5), up to the Booking Office limit.

### 1.5 Free upkeep every turn

Some things cost nothing, so the Automaton keeps them right at the start and end of every turn, regardless of the build order:

- **Teams**: teams follow one fixed rule. 2v2 teams are robots 1+2, 3+4, 5+6, 7+8 and 9+10; 3v3 teams are robots 1–3, 4–6 and 7–9. Robot 11 is in no team, and robots 10 and 11 are in no 3v3 team. A team is registered in the turn its last member joins, with the name the catalogue gives it, and is never disbanded or swapped.
- **Event subscriptions**: each stable has one event order: all 9 event types, most wanted first. Every robot has as many slots as the Booking Office allows (3 + level). The Automaton walks the event order from the top. A solo event (1v1 League, King of the Hill, Grand Melee, 1v1 Tournament) goes to every robot that still has a free slot. A team event goes to a whole team or to none of it: if one member has no free slot, the team skips that event and the free slots of the others go to later events. A robot that is in no team of that size skips the event. When the Booking Office level rises or a team forms, the subscriptions are worked out again the same way.
- **Blueprint sync**: if an admin changed a blueprint's stance or yield threshold, the live robot is updated. A new robot name only applies to a robot bought later; a new image applies to the live robot straight away, in the admin's own change; a new loadout or weapon path is fitted by the weapons goal when it is next reached (§1.8).
- **Tuning**: distributes the robot's free tuning pool (10 points at Tuning Bay level 0, +10 per level) according to its Build_Focus.

### 1.6 What an Automaton never does

- It **never repairs manually.** Its robots are only repaired by the scheduled automatic repair before each battle, at full price. Humans can repair manually at a 50% discount, so over a season Automatons get less value from their credits. This is the intended handicap.
- It never receives free credits, grants or catch-up money. It only has what the season reset and its own battles, achievements and facilities give it.
- It never deletes robots, disbands teams or renames robots.

### 1.7 Attribute upgrades: milestones, priority and academies

**Milestones.** The aim is always every attribute at 50. Every build order therefore ends with **"Attributes → Max"**. Before that, a strategy has several attribute goals at lower levels (for example Swarm: 5, 8, 15, 20, 25). Each one is a milestone: the point where the Automaton stops raising attributes and turns to the next goal in the list (another robot, a facility, a weapon). Where the milestones sit is what makes a strategy go wide, tall or invest first.

**Targets per robot.** For a milestone "Attributes → L", each robot's **Build_Focus** (§3) sets how high each attribute group goes: `group weight × L`, rounded up. For "Attributes → Max" the target is 50 for every group, whatever the weights.

| Deadeye robot (weights Combat 1.0, AI 0.8, Mobility 0.5, Defense 0.4) | Combat | AI/Team | Mobility | Defense |
|---|---:|---:|---:|---:|
| Attributes → 10 | 10 | 8 | 5 | 4 |
| Attributes → 20 | 20 | 16 | 10 | 8 |
| Attributes → Max | 50 | 50 | 50 | 50 |

**Order inside one goal: priority first.** The Build_Focus also sets the order of the groups: highest weight first (ties in the order Combat, Defense, Mobility, AI/Team). Inside one attributes goal the Automaton finishes a group before it starts the next:

1. **First-priority group** of every robot: raise it to its target, buying the academy levels it needs on the way (cap 10 without an academy, 15 at L1, 20 at L2 … 50 at L10).
2. **Second-priority group** of every robot, the same way.
3. Then the third and fourth groups.

Deadeye, "Attributes → 20": Combat to 20 first (buying Combat Academy L1 and L2 on the way), then AI to 16 (AI Academy L1 and L2), then Mobility to 10, then Defense to 8.

With several robots, they move group by group together: every robot's first-priority group, then every robot's second, so no robot falls a whole milestone behind. Within a step, the lowest attribute goes up first (ties: lower robot slot, then the fixed attribute order).

**Academies** are stable-wide, so the level bought is the one the robot with the highest target in that group needs. If the next academy level for a group is prestige-gated, the Automaton raises that group as far as the current cap allows and carries on with the next group; the goal is **Blocked** only when everything it still has to do is behind a gated academy. Money runs out at any step → **Saving** at that step; it continues there next cycle.

- The Training Facility is **not** a prerequisite: it only makes upgrades cheaper. Every strategy has at least one Training Facility goal (decision 29), placed before its large attribute milestones (e.g. Paragon goals 4, 6, 12 and 18; Trio goals 10, 17 and 25). Swarm keeps one L1 goal at the lowest priority, because the discount (`level × (10 − roster slots)`%) shrinks with every roster slot and reaches 0 at 10 slots.
- There are no separate goals per group ("Mobility → 15") and no separate academy goals: one attributes goal covers all groups and buys the academies it needs.

Cost example — the Deadeye robot from base level 1 to "Attributes → 10" (Combat 10, AI 8, Mobility 5, Defense 4, all within the cap of 10, so no academy): about ₡1,026,000 before the Training Facility discount.

### 1.8 Weapon paths and refinements

**Starter, then final.** Every robot in the starter catalogue has two weapon stages: a cheap **starter** (stage 0) that it fights with from day one, and its **final** weapon (stage 1), which is the most expensive weapon for its hand type and range. There is no middle stage, for three reasons:

- The opening is already tight: a three-robot opening spends ₡1,950,000 of the ₡3,000,000 starting credits on robots and roster slots alone (3 × ₡500,000 plus Roster Expansion L1 and L2), before any weapon or attribute, so there is no room for a better weapon early on.
- A middle weapon is money lost. When it is replaced, it resells for only 10% of its price per Weapons Workshop level.
- The Weapons Workshop discount (10% per level) is worth most on the most expensive weapon. Buying a cheap final weapon after investing in the Workshop wastes that discount.

So each strategy has a single "Weapons → final" goal, placed after its Weapons Workshop goal. The engine still allows weapon paths of up to 4 stages, for stables an admin builds later.

Each stage names a weapon per hand: main hand only (single, two-handed), main hand + shield (weapon + shield), or main hand + off hand (dual wield; the two hands may hold different weapons). The weapons goal moves robots, lowest slot first, to their next stage and equips the weapons per hand. If only one hand changes, the other hand keeps its weapon.

**Reuse before buying.** Before buying a weapon, the Automaton looks for an unequipped weapon of the same name in its storage. This also applies when a new robot joins the stable: it starts at the **highest stage of its own weapon path** that it can equip from storage (per hand), and only buys what is missing. Example: when Rex moves to his final Volt Sabres, his two Laser Pistols go to storage. CT-5385 Tup (slot 11, whose stage 0 is two Laser Pistols) joins later and equips them instead of buying new ones. Weapons that are not on the robot's own path are not used, so every robot keeps the look and style its blueprint describes.

**Replaced weapons are kept until storage is full.** This is the same for every strategy; there is no setting. When a weapon is needed and storage is full, the Automaton sells an unequipped weapon first — preferring one that no blueprint path in the stable uses any more, then the one with the lowest resale value. Only when nothing unequipped is left does it buy a Storage Facility level. Resale pays Workshop level × 10% of the price paid, so at Workshop L0 a sale returns ₡0 but still frees the slot.

A robot's fighting range is not set separately: the game takes it from its weapons. With two different weapons in dual wield, the robot moves to the range of the weapon with the higher damage per second (the main-hand weapon on a tie) and the other weapon fires at a range penalty (existing combat rule). The four most expensive one-handed weapons all deal 4.0 damage per second, so for two different final weapons the main hand decides.

A refinement goal applies the blueprint's refinement plan once the robot is on the **last** stage of its path — refining a weapon that is about to be replaced would waste money. It buys the Weapons Workshop level the next step needs as part of the goal (§1.3).

**Every robot has a refinement plan, ordered by value** (decision 35). The plan covers every weapon of the last stage: the main hand, plus the offhand of a dual wield or the shield of a weapon + shield. Each weapon has at most 5 steps (its 5 refinement slots), so a robot has at most 10. The order:

1. **Sharpen, Sharpen, Forge, Forge on every weapon that is not a shield, before anything else.** These are by far the strongest tiers: Sharpen takes 10% off the cooldown (+11.1% and then +12.5% attacks), Forge adds 8% damage per instance. Together they cost ₡2,800,000 per weapon (₡300,000, ₡900,000, ₡400,000, ₡1,200,000). Refinements get no Workshop discount; only weapon purchases do. Per credit, the first Forge (+8% for ₡400,000) beats the second Sharpen (+12.5% for ₡900,000), but Sharpen comes first anyway: it unlocks at Workshop L5 (3,000 prestige) and Forge only at L8 (15,000), and a plan is applied strictly in order, so Sharpen-first never leaves a reachable step waiting behind a deeper gate.
2. **Two weapons are interleaved tier by tier**, so both hands improve together: main Sharpen, offhand Sharpen, main Sharpen, offhand Sharpen, main Forge, offhand Forge, main Forge, offhand Forge, then each hand's fifth step. A weapon + shield refines the weapon first and the shield last.
3. **The fifth slot gets a Hone or Augment only when it is cheaper than the same + on the robot.** Hone and Augment are often not worth it, because +5 on an attribute is usually cheaper on the robot itself. The comparison uses the level the attribute reaches at the strategy's last milestone before Max (group weight × milestone, rounded up, §1.7) and the season-end Training Facility discount at the strategy's robot count (§11). The attribute comes from the Build_Focus's first-priority group if one qualifies (its upgrades are the most expensive), with the largest qualifying magnitude. Otherwise the weapon keeps 4 steps. Weapon bonuses are not limited by academy caps or by the maximum of 50, so after "Attributes → Max" a Hone is the only growth left on an attribute. The plans still compare with the robot upgrade on purpose: the Refine goal comes before "Attributes → Max" in every build order, so a fifth-slot Hone would be bought while the same + is still cheaper on the robot. A stable that reaches Max with credits to spare (most likely Paragon at 90% off) can get a Hone fifth step through a plan edit on the admin page; steps already applied stay counted (decision 36).
4. **Shields take only Hone or Augment, and only when it is worth it.** Every positive Aegis Bulwark bonus is already above the +10 cap, so only its penalties can be Honed (Evasion Thrusters −5, Servo Motors −4). Five Hone +1 on Evasion Thrusters cost ₡10,000 each, the cheapest price per point in the game, and remove the penalty; every strategy with a shield blueprint pays more than that for +1 on the robot.

What the value rule gives for a first-priority attribute:

| Strategy (season-end Training Facility, robots) | Level | +1 / +2 / +4 on the robot | Fifth step that qualifies |
|---|---:|---|---|
| Swarm (L1, 11 robots: 0%) | 25 | ₡39,000 / ₡79,500 / ₡165,000 | Hone up to +4 (₡160,000), or Augment +1 (₡20,000) |
| Paragon (L10, 1 robot: 90%) | 40 | ₡6,150 / ₡12,450 / — | none: Paragon plans are the 4 DPS steps per weapon |
| Duo (L8, 2 robots: 64%) | 30 | ₡16,740 / ₡34,020 / — | Hone +1 (₡10,000) |
| Trio (L9, 3 robots: 63%) | 30 | ₡17,205 / ₡34,965 / — | Hone +1 |
| Tycoon (L6, 2 robots: 48%; 3 robots: 42%) | 30 | ₡24,180 / ₡49,140 (3 robots: ₡26,970 / ₡54,810) | Hone up to +2 (₡40,000), or Augment +1 |
| Generalist (L7, 3 robots: 49%) | 25 | ₡19,890 / ₡40,545 / — | Hone up to +2 |

**The Refine target counts plan steps** (decision 36). "Refine → 8 steps" means every robot applies the first 8 steps of its own plan, in order; 10 is every step of a two-weapon robot, so "all". A robot with a shorter plan is done when its whole plan is applied. Across robots the goal takes the next step of the first robot (slot order) that is on its last stage and whose step is not behind a prestige gate; it is Blocked only when every remaining step is. Every plan starts with a Sharpen, so every Refine goal buys Workshop L5 and later L8 through its chain (Workshop levels cost ₡75,000 × level: ₡2,250,000 from L3 to L8).

### 1.9 Booking Office: early, and never more than useful

More events per robot means more fights, and every fight pays (battle rewards, streaming, prestige). That is why every strategy buys Booking Office levels early: L1 straight after its first robots, and multi-robot strategies L3 soon after.

There are 9 event types. How many a stable can use depends on its robots:

| Robots in the stable | Event types it can enter | Booking Office level that covers them (events per robot = 3 + level) |
|---|---|---|
| 1 | 4 — League 1v1, Tournament 1v1, King of the Hill, Grand Melee | **L1** |
| 2 | 7 — plus League 2v2, Tag Team, Tournament 2v2 (robots 1 and 2 form a 2v2 team) | **L4** (needs 1,000 prestige) |
| 3 or more | 9 — plus League 3v3, Tournament 3v3 (robots 1 and 2 are in a 2v2 and a 3v3 team) | **L6** (needs 5,000 prestige) |

Above L6 is never useful, so no strategy allows more than L6. On top of the strategy's target, the engine never buys a level above what the stable can use **right now**. It looks at the robot that can enter the most event types: 4 solo events, plus 3 if it is in a 2v2 team, plus 2 if it is in a 3v3 team. The useful level is that number minus 3, and never above L6. A Booking Office goal counts as Done ("L4 is enough; no robot can enter more than 7 event types") once the level reaches it, and opens again when a team forms.

### 1.10 Facility investment (all strategies)

Players invest in facilities more than a cautious plan would, because the discounts and the income repay within the season. The benchmark is a human stable on ACC with 3 robots at competitive cycle 68 of 100 (`SEASON_LENGTH_CYCLES` default 100, after 2 preparation cycles): Repair Bay L8, Training Facility L9, Weapons Workshop L8, Merchandising Hub L1, Streaming Studio L6, Roster Expansion L2, Storage Facility L1, academies L3–4, Booking Office L6 and Tuning Bay L2, with top-tier, fully refined weapons and attributes around 25. Training Facility L9 means that stable passed 25,000 prestige by cycle 68.

| Facility | Effect per level | Cost of level n | Operating cost per day |
|---|---|---:|---:|
| Repair Bay | (5 + active robots)% off automatic repairs, at most 90%: 6% with 1 robot, 8% with 3, 13% with 8 | ₡50,000 × n | ₡1,000 + ₡500 × (L − 1) |
| Training Facility | (10 − roster slots)% off attribute upgrades, at most 90%: 9% at 1 slot, 7% at 3, nothing from 10 | ₡150,000 × n | ₡250 × L |
| Weapons Workshop | 10% off weapons and 10% more resale; Hone at L1, Augment at L3, Sharpen at L5, Forge at L8 (refinements themselves are not discounted) | ₡75,000 × n | ₡100 × L |
| Booking Office | one more event per robot (3 + L events) | ₡75,000 × n | ₡150 × L |
| Merchandising Hub | ₡10,000 per day, more with prestige (× (1 + prestige ÷ roster slots ÷ 10,000)) | ₡150,000 × n | ₡200 × L |
| Streaming Studio | at least ₡1,000 more per battle per robot (₡1,000 × (1 + battles ÷ 1,000) × (1 + fame ÷ 5,000) × (1 + L)) | ₡100,000 × n | ₡100 × L |
| Tuning Bay | 10 more tuning points per robot (pool 10 × (L + 1)) | ₡200,000 × n | ₡300 × L |

Rules every strategy follows:

- **Every goal type, every strategy** (decision 29). Each build order has at least one goal of each type with a target above 0: Robots, Attributes, Weapons, Refine, Repair Bay, Training Facility, Weapons Workshop, Booking Office, Merchandising Hub, Streaming Studio and Tuning Bay. Roster Expansion, Storage Facility and the academies need no goal: the robots, weapons and attributes goals buy them (§1.3).
- **Off-identity goals go last.** A goal that does not fit a strategy sits at the lowest priority, just before "Attributes → Max" (Swarm's Refine and Training Facility, Tycoon's Refine).
- **Planned levels must repay inside one season**, because every rollover resets the stable (§1.1). That is why no strategy plans Merchandising Hub above L6 or Booking Office above the useful level (§1.9).
- **Prestige gates block, never save.** A level behind a gate is Blocked and costs nothing until the stable has the prestige (§1.3). The benchmark shows that 25,000 prestige by cycle 68 is reachable, so L7–L9 are realistic second-half targets and L10 (50,000) is a stretch.
- **Tuning Bay always has an effect.** The pool is 10 × (L + 1) points per robot (110 at L10) and each attribute has room for at least 5 tuning points (academy cap + 5 − base), so every robot has room for at least 115 points and every Tuning Bay level is fully allocated by the Build_Focus.

- [x] Approved — 9 Oct 2026

---

## 2. Goal targets

A strategy is its numbered build order (§5–§10). The only thing an admin changes per Automaton stable is the target of each goal:

| Setting | What it is | Where the bounds come from |
|---|---|---|
| The target of every goal | e.g. goal 10 "Robots → 11" can become 6, "Booking Office → L3" can become L4, "Refine → 8 steps" can become 10 | the "Allowed" column of the strategy's build order |

What an admin cannot change: the order of the goals, or which goals a strategy has. Those are part of the strategy and tested as a whole; changing them is a new strategy version (§12).

A target of 0 (or L0) skips the goal. A later goal with a lower target than an earlier goal of the same kind is simply Done. Edits take effect after the next settlement and are recorded in the admin audit log. Catalogue entries may override any target within its bounds. A robots target can never be higher than the stable's number of blueprints (at most 11).

There is nothing else: no credit buffer, no reserve, no "give up saving" timer. The order of the list alone decides what is bought next.

- [x] Approved — 9 Oct 2026

---

## 3. Build_Focus presets

A Build_Focus is set per robot blueprint. It weights the four academy attribute groups. The weights set (a) how high each group goes at an attribute milestone, (b) the order in which the groups are raised inside a goal — highest weight first, ties Combat, Defense, Mobility, AI/Team — and (c) how the free tuning pool is spread (§1.7). At "Attributes → Max" every group goes to 50; only the order still follows the weights. Each preset except Versatile has exactly one primary group at weight 1.0; Versatile has all four at 1.0. No weight is below 0.25.

Attribute groups (from `ATTRIBUTE_TO_ACADEMY` in `app/backend/src/services/robot/robotUpgradeService.ts`):

- **Combat** (Combat Training Academy): Combat Power, Targeting Systems, Critical Systems, Penetration, Weapon Control, Attack Speed
- **Defense** (Defense Training Academy): Armor Plating, Shield Capacity, Evasion Thrusters, Damage Dampeners, Counter Protocols
- **Mobility** (Mobility Training Academy): Hull Integrity, Servo Motors, Gyro Stabilizers, Hydraulic Systems, Power Core
- **AI/Team** (AI Training Academy): Combat Algorithms, Threat Analysis, Adaptive AI, Logic Cores, Sync Protocols, Support Systems, Formation Tactics

| Build_Focus | Combat | Defense | Mobility | AI/Team | Priority order | Player-facing description (draft) | Closest guide archetype |
|---|---:|---:|---:|---:|---|---|---|
| **Bruiser** | 1.0 | 0.8 | 0.7 | 0.4 | Combat → Defense → Mobility → AI | A heavy hitter that wades in and trades blows. Built to deal damage first and survive the return fire second. | Glass Cannon / melee brawler |
| **Deadeye** | 1.0 | 0.4 | 0.5 | 0.8 | Combat → AI → Mobility → Defense | Precision over everything: targeting, crits and penetration, backed by sharp combat AI. Fragile if caught. | Sniper |
| **Warden** | 0.6 | 1.0 | 0.6 | 0.5 | Defense → Combat → Mobility → AI | A shield wall. Soaks punishment, counters attackers and wins the long fight. | Tank / Counter Striker |
| **Sprinter** | 0.7 | 0.5 | 1.0 | 0.5 | Mobility → Combat → Defense → AI | Fast, evasive and relentless. Hard to pin down, strikes often. | Speed Demon |
| **Tactician** | 0.6 | 0.6 | 0.5 | 1.0 | AI → Combat → Defense → Mobility | Reads the battlefield and coordinates the team. Strongest next to allies. | Team Player |
| **Versatile** | 1.0 | 1.0 | 1.0 | 1.0 | Combat → Defense → Mobility → AI (all equal) | No weak spots and no spikes. Every system upgraded evenly. | All-rounder |

Notes:

- **Versatile** raises all groups to the same level at every milestone, Combat first.
- **Academies** are bought by attribute goals when a robot's weighted target is above the current cap (§1.7). The academy is stable-wide, so the level needed is set by the robot with the highest target in that group.
- **Tuning** puts the robot's free tuning pool into its attributes in proportion to the group weights, split evenly within a group, within the per-attribute tuning limit (academy cap + 5 − base value).
- Descriptions are only shown in the admin page and in this document unless you decide otherwise (`PLAYER_FACING_TEXT.md` §2).

- [x] Approved — 9 Oct 2026

---

## 4. Naming-collision check

The names must not clash with existing game terms or code values. The check was run with a whole-word search over `app/backend/src`, `app/frontend/src`, `app/shared`, `app/backend/prisma` and `docs`.

| Proposed name | Kind | Existing uses found | Verdict |
|---|---|---|---|
| Automaton | Stable type | none | Clear |
| Swarm | Strategy | none | Clear |
| Paragon | Strategy (replaces "Champion", which is a league tier `champion`) | none | Clear |
| Duo | Strategy | achievement "Dynamic Duo" (`config/achievements.ts` L16); test fixture team names | Kept: strategy names are internal (admin and code only) |
| Trio | Strategy | test fixture team names only | Kept: internal name |
| Tycoon | Strategy | none | Clear |
| Generalist | Strategy (replaces "Balanced", which is the stance `balanced`) | none | Clear |
| Bruiser | Build_Focus | none | Clear |
| Deadeye | Build_Focus (replaces "Marksman", which clashes with the weapon *Photon Marksman*) | none | Clear |
| Warden | Build_Focus (replaces "Bulwark"/"Bastion": *Aegis Bulwark* is a shield, "Bastion" is the codename for Barrier Shield in `utils/tierConfig.ts`) | none | Clear |
| Sprinter | Build_Focus | none | Clear |
| Tactician | Build_Focus | none | Clear |
| Versatile | Build_Focus (replaces "Allrounder", which appears in guide text and robot image frame names) | only as an ordinary English word in guide prose | Clear as a term |

Rejected along the way: Champion (league tier), Balanced (stance), Marksman, Bulwark, Bastion, Brawler (robot image frame and guide archetype), Ironclad (test robot name), Juggernaut (robot image frame), Rampart (shield codename), Allrounder.

Also checked: none of the names equal a loadout (`single`, `weapon_shield`, `dual_wield`, `two_handed`), a range band (`melee`, `short`, `mid`, `long`), an onboarding strategy (`1_mighty`, `2_average`, `3_flimsy`) or an old bot tier (WimpBot, AverageBot, ExpertBot).

- [x] Approved — 9 Oct 2026

---

## 5. Strategy: Swarm

**Admin display name**: Swarm
**Admin description**: Goes wide. Buys roster slots, storage and booking capacity to field as many robots as prestige allows, keeps them evenly upgraded, buys their final weapons late, and enters every event it can.
**Strategy key**: `swarm`

### Intent

The many-robot stable that human players currently dominate with. Swarm makes that strategy contestable: lots of robots in every bracket, cheap but evenly upgraded, more battles per day, more prestige per day. Its Training Facility goal is a token L1 at the lowest priority: the discount is `level × (10 − roster slots)`%, so at 7 slots it gives only 3% per level, and nothing from 10 slots. The Repair Bay, on the other hand, gives (5 + robots)% per level, and the Streaming Studio pays per battle per robot, so both grow with the roster.

### Robots, teams and events

- Works towards 11 robots (goal 10): as many as prestige allows. Robots 1–4 need Roster Expansion up to L3 (no prestige needed). Robot 5 needs L4 (1,000 prestige), robot 6 L5 (3,000), robot 7 L6 (5,000), robot 8 L7 (10,000), robot 9 L8 (15,000), robot 10 L9 (25,000) and robot 11 L10 (50,000). A robot behind a gate is Blocked and costs nothing.
- Teams by the team rule (§1.5): 2v2 teams of robots 1+2, 3+4, 5+6, 7+8 and 9+10, and 3v3 teams of robots 1–3, 4–6 and 7–9. Robot 11 is in no team and robot 10 is in no 3v3 team.
- Event focus: set by each stable's event order in `CATALOGUE.md`; every robot enters the solo events, and team members the team modes.

### Opening build (preparation, ₡3,000,000)

| Step | Goal | Estimated cost | Running total |
|---|---|---:|---:|
| 1 | Robot chain ×3: Roster Expansion L1 + L2 (₡450,000), 3 robots (₡1,500,000), Rex, Cody and Fives' starters (₡315,000) | ₡2,265,000 | ₡2,265,000 |
| 2 | Booking Office L1 (4 events per robot) | ₡75,000 | ₡2,340,000 |
| 3 | Attributes towards level 5 on all three robots, with everything that is left (~₡660,000 of the ~₡996,000 the full target costs) | ~₡660,000 | ~₡3,000,000 |

Computed with Kamino Clone Legion's blueprints. Result: three robots at roughly attribute level 3–4, each in 4 events, Saving on goal 3. This mirrors the onboarding "3 robots" budget (attributes ~₡650K).

### Build order (v1)

Priority is the order of this list: goal 1 comes first. Every target can be changed per stable in the admin page within "Allowed"; the order itself is part of the strategy. Each goal buys its own prerequisites (chain), and is passed over when a prerequisite is prestige-gated.

| # | Goal | Default target | Allowed | What the goal buys (chain) |
|---:|---|---|---|---|
| 1 | Robots | 3 | 1–3 | Robot chain: missing Roster Expansion and Storage levels, robot, starter weapons (§1.3) (Roster Expansion L1–L2, no prestige needed) |
| 2 | Booking Office | L1 | L0–L6 | Booking Office levels up to the target; 4 events per robot; never above the useful level (§1.9) |
| 3 | Attributes | 5 | 1–10 | Attribute upgrades plus the academy levels the target needs (§1.7) |
| 4 | Booking Office | L3 | L0–L6 | Booking Office levels up to the target; 6 events per robot; more fights, more income; never above the useful level (§1.9) |
| 5 | Robots | 4 | 3–4 | Robot chain: missing Roster Expansion and Storage levels, robot, starter weapons (§1.3) (Roster Expansion L3) |
| 6 | Attributes | 8 | 1–10 | Attribute upgrades plus the academy levels the target needs (§1.7) |
| 7 | Repair Bay | L3 | L0–L10 | Repair Bay levels up to the target; 9% off automatic repairs per level with 4 robots |
| 8 | Streaming Studio | L2 | L0–L10 | Streaming Studio levels up to the target; streaming pays per battle per robot |
| 9 | Merchandising Hub | L1 | L0–L10 | Merchandising Hub levels up to the target; ₡10,000 per day base |
| 10 | Robots | 11 | 4–11 | Robot chain: missing Roster Expansion and Storage levels, robot, starter weapons (§1.3) (Roster Expansion L4 needs 1,000 prestige, L5 3,000, L6 5,000, L7 10,000, L8 15,000, L9 25,000, L10 50,000; a robot behind a gate is Blocked and costs nothing) |
| 11 | Booking Office | L6 | L0–L6 | Booking Office levels up to the target; all 9 event types; L4 needs 1,000 prestige, L5 3,000, L6 5,000; never above the useful level (§1.9) |
| 12 | Weapons Workshop | L3 | L0–L10 | Weapons Workshop levels up to the target; 30% off weapons; unlocks Augment |
| 13 | Tuning Bay | L1 | L0–L10 | Tuning Bay levels up to the target; 10 more tuning points per robot |
| 14 | Attributes | 15 | 1–50 | Attribute upgrades plus the academy levels the target needs (§1.7) (academies L1) |
| 15 | Repair Bay | L7 | L0–L10 | Repair Bay levels up to the target; the 90% cap from 8 robots; L4 needs 1,000 prestige, L5 3,000, L6 5,000, L7 10,000 |
| 16 | Streaming Studio | L5 | L0–L10 | Streaming Studio levels up to the target; L4 needs 1,000 prestige, L5 3,000 |
| 17 | Weapons Workshop | L7 | L0–L10 | Weapons Workshop levels up to the target; 70% off up to 11 final weapons; L4 needs 1,000 prestige … L7 10,000 |
| 18 | Weapons | final stage | stage 0–3 | Each robot's final weapons (stage 1 of its path), plus room in storage (§1.8) |
| 19 | Tuning Bay | L2 | L0–L10 | Tuning Bay levels up to the target; 30 tuning points per robot |
| 20 | Streaming Studio | L8 | L0–L10 | Streaming Studio levels up to the target; L6 needs 5,000 prestige, L7 10,000, L8 15,000 |
| 21 | Attributes | 20 | 1–50 | Attribute upgrades plus the academy levels the target needs (§1.7) (academies up to L2) |
| 22 | Attributes | 25 | 1–50 | Attribute upgrades plus the academy levels the target needs (§1.7) (academies up to L3) |
| 23 | Refine | 8 steps | 0–10 steps | The first 8 steps of every robot's refinement plan: every Sharpen and Forge, both hands of a dual wield included, plus the Weapons Workshop level each step needs (§1.8) (goal 17 has usually bought up to L7, so the chain adds L8, which needs 15,000 prestige) (lowest priority: off identity) |
| 24 | Training Facility | L1 | L0–L10 | Training Facility levels up to the target (lowest priority: 6% at 4 slots, nothing from 10) |
| 25 | Attributes | Max | Max | Every attribute of every robot to 50, in Build Focus order, plus every academy level up to L10 (L10 needs 50,000 prestige). The final goal: whatever is left goes here |

### Prestige-gate behaviour

Goal 10 is Blocked from robot 5 (Roster Expansion L4, 1,000 prestige) up to robot 11 (L10, 50,000). While it is blocked, Swarm does **not** save for the robot: it moves on to the goals below (Weapons Workshop, Tuning Bay, attributes, weapons). Goals 11, 15, 16, 17 and 20 meet the same L4+ gates, so while those are blocked Swarm spends on goals 12–14, 18, 19, 21 and 22. The moment prestige reaches the next gate, goal 10 becomes possible again and Swarm saves for the next robot before buying anything below it. Each new robot re-opens goals 3 and 6, so it is levelled up before anything else. Swarm earns prestige from every robot, so it usually passes gates sooner than the other strategies; the benchmark (25,000 prestige by cycle 68) suggests robots 9–10 are reachable in a strong season.

### Risks

- **Repair exposure**: many robots in many events means many automatic repair bills at full price, and the Swarm spends down to its last credits. Its balance can go negative after a bad battle day, exactly like a human's. The levers are the Repair Bay goals and the blueprints' yield thresholds.
- **Prestige stall**: in a weak season the Swarm may sit at 4 robots for a long time. It still spends: every gated goal is passed over and the ungated goals below take the money.
- **Operating costs**: the planned end state costs ~₡16,000 per day (Repair Bay L7 ₡4,000, roster ₡5,000 at 11 robots, academies ~₡3,000, every other facility under ₡1,000). Streaming Studio L8 pays at least ₡9,000 per battle per robot, so two battles cover it.

### Why this order

Wide means many repair bills, many battles and many tuning pools, so the Repair Bay, Streaming Studio and Tuning Bay carry the facility budget. The Workshop goes to L7 before the weapons goal because Swarm buys up to 11 final weapons (~₡6.1M at list price). The Training Facility is a token goal, because its discount disappears as the roster grows.

Refinement is off identity for a wide stable, so it sits at the lowest priority, but its target still covers every Sharpen and Forge (Refine → 8 steps, decision 36: both hands of a dual wield, and the whole plan of a one-weapon robot). At 11 robots that is ₡37.6M (Kamino Clone Legion) or ₡34.5M (Skaro Dalek Empire) of refinements, which get no Workshop discount, plus Workshop L8 (₡600,000). A Swarm rarely finishes it within a season: it refines its first robots in slot order while prestige allows, and every remaining step waits at the bottom of the list. While the goal is Saving for a Sharpen or Forge, the token Training Facility goal below it (goal 24) waits too; it gets its turn while every remaining step is gated (for example all Sharpens done and Forge still behind 15,000 prestige).

### Compared with the ACC benchmark

Planned by season end: Repair Bay L7 (benchmark L8; with 8+ robots L7 already reaches the 90% cap), Weapons Workshop L7, and L8 through the refine chain (L8), Streaming Studio L8 (L6; 8–11 robots stream), Merchandising Hub L1 (same), Tuning Bay L2 (same), Booking Office L6 (same), Roster Expansion up to L10 (L2), Training Facility L1 (L9; deliberate), attributes to 25 (~25). Refinements: every Sharpen and Forge planned, but the benchmark refined 3 weapons and a Swarm has up to 13, so expect only the first robots to be fully refined by cycle 68.

- [x] Approved — 9 Oct 2026

---

## 6. Strategy: Paragon

**Admin display name**: Paragon
**Admin description**: Goes tall. One robot, built as far as the facilities allow: Training Facility discounts, matching academies, a premium weapon refined to the limit, a Tuning Bay and a Merchandising Hub that rewards a one-robot roster.
**Strategy key**: `paragon`

### Intent

The single-champion stable. It uses the two mechanics that reward concentration: the Training Facility discount (up to 9% per level at 1 slot) and Merchandising Hub income, which scales with prestige *per roster slot*. Its one weapon is fully refined (Sharpen ×2, Forge ×2) straight after the final weapon is bought (goal 16). It also builds the Repair Bay, because one tall robot has the most expensive repairs: a repair quote grows with the robot's attribute total.

### Robots, teams and events

- One robot. A second robot is only bought if an admin raises goal 8 to 2; raise goal 3 (Booking Office) to L4 as well, so the pair gets the 2v2 events.
- No teams with one robot; if an admin raises goal 8 to 2, robots 1 and 2 form a 2v2 team.
- Event focus: set by the stable's event order in `CATALOGUE.md`; one robot enters the 4 solo events (League 1v1, Tournament 1v1, King of the Hill, Grand Melee) once the Booking Office slot is added.

### Opening build (preparation, ₡3,000,000)

| Step | Goal | Estimated cost | Running total |
|---|---|---:|---:|
| 1 | Weapons Workshop L1 (10% off weapons, unlocks Hone) | ₡75,000 | ₡75,000 |
| 2 | Robot chain ×1: robot + premium starter weapon (e.g. ₡291,000 list, ₡261,900 after discount) | ~₡762,000 | ~₡837,000 |
| 3 | Booking Office L1 (4 events: all a single robot can enter) | ₡75,000 | ~₡912,000 |
| 4 | Training Facility L1 (9% off attributes at 1 slot) | ₡150,000 | ~₡1,062,000 |
| 5 | Attributes → 10 (weighted by Build_Focus; Deadeye estimate ₡1,026,000 less 9%) | ~₡934,000 | ~₡1,996,000 |
| 6 | Training Facility → L3 (27% off) | ₡750,000 | ~₡2,746,000 |
| 7 | Attributes → 15: Combat first, buying Combat Academy L1 (₡100,000), with everything that is left | ~₡254,000 | ~₡3,000,000 |

Computed with Old Detroit Precinct's blueprint (RoboCop, Gauss Pistol); goals 1–7 are unchanged by decision 30, so the opening is too. This mirrors the onboarding "1 robot" budget (weapons ~₡550K, attributes ~₡1.55M) with more weight on the Training Facility, because a Paragon keeps buying attributes all season.

### Build order (v1)

Priority is the order of this list: goal 1 comes first. Every target can be changed per stable in the admin page within "Allowed"; the order itself is part of the strategy. Each goal buys its own prerequisites (chain), and is passed over when a prerequisite is prestige-gated.

| # | Goal | Default target | Allowed | What the goal buys (chain) |
|---:|---|---|---|---|
| 1 | Weapons Workshop | L1 | L0–L10 | Weapons Workshop levels up to the target; 10% off weapons |
| 2 | Robots | 1 | 1 | Robot chain: missing Roster Expansion and Storage levels, robot, starter weapons (§1.3) |
| 3 | Booking Office | L1 | L0–L6 | Booking Office levels up to the target; 4 events — all a single robot can enter; never above the useful level (§1.9) |
| 4 | Training Facility | L1 | L0–L10 | Training Facility levels up to the target; 9% off attributes at 1 robot slot |
| 5 | Attributes | 10 | 1–10 | Attribute upgrades plus the academy levels the target needs (§1.7) |
| 6 | Training Facility | L3 | L0–L10 | Training Facility levels up to the target |
| 7 | Attributes | 15 | 1–50 | Attribute upgrades plus the academy levels the target needs (§1.7) (academies L1) |
| 8 | Robots | 1 | 1–2 | Robot chain: missing Roster Expansion and Storage levels, robot, starter weapons (§1.3) (a second robot only if raised to 2; then also raise goal 3 to L4) |
| 9 | Merchandising Hub | L3 | L0–L10 | Merchandising Hub levels up to the target; the full prestige multiplier at 1 slot |
| 10 | Streaming Studio | L2 | L0–L10 | Streaming Studio levels up to the target; streaming pays per battle per robot |
| 11 | Repair Bay | L3 | L0–L10 | Repair Bay levels up to the target; 6% off automatic repairs per level with 1 robot |
| 12 | Training Facility | L5 | L0–L10 | Training Facility levels up to the target; 45% off at 1 slot; L4 needs 1,000 prestige, L5 3,000 |
| 13 | Attributes | 25 | 1–50 | Attribute upgrades plus the academy levels the target needs (§1.7) (academies up to L3) |
| 14 | Weapons Workshop | L5 | L0–L10 | Weapons Workshop levels up to the target; 50% off the final weapon, and Sharpen needs L5 anyway; L4 needs 1,000 prestige, L5 3,000 |
| 15 | Weapons | final stage | stage 0–3 | Each robot's final weapons (stage 1 of its path), plus room in storage (§1.8) |
| 16 | Refine | 10 steps | 0–10 steps | Every step of the refinement plan (all), plus the Weapons Workshop level each step needs (§1.8) (up to Workshop L8, which needs 15,000 prestige) |
| 17 | Tuning Bay | L3 | L0–L10 | Tuning Bay levels up to the target; 40 tuning points |
| 18 | Training Facility | L10 | L0–L10 | Training Facility levels up to the target; 90% off at 1 slot; L6 needs 5,000 prestige … L9 25,000, L10 50,000 |
| 19 | Merchandising Hub | L6 | L0–L10 | Merchandising Hub levels up to the target; L4 needs 1,000 prestige, L5 3,000, L6 5,000 |
| 20 | Repair Bay | L7 | L0–L10 | Repair Bay levels up to the target; 42% off with 1 robot; L4 needs 1,000 prestige … L7 10,000 |
| 21 | Streaming Studio | L4 | L0–L10 | Streaming Studio levels up to the target; L4 needs 1,000 prestige |
| 22 | Attributes | 40 | 1–50 | Attribute upgrades plus the academy levels the target needs (§1.7) (academies up to L6; L4 needs 1,000 prestige, L6 5,000) |
| 23 | Tuning Bay | L5 | L0–L10 | Tuning Bay levels up to the target; 60 tuning points, the only growth above 50; L4 needs 1,000 prestige, L5 3,000 |
| 24 | Attributes | Max | Max | Every attribute of every robot to 50, in Build Focus order, plus every academy level up to L10 (L10 needs 50,000 prestige). The final goal: whatever is left goes here |

### Prestige-gate behaviour

Paragon earns prestige from one robot only, so it reaches gates later than multi-robot stables. Goals 12, 14, 16 (the plan's Sharpens need Workshop L5, its Forges L8), 18, 19, 20, 21 and 23 and the academies in goal 22 are gated. When a goal is gated, Paragon does what it can below the gate (attributes up to the current caps, the Sharpens once Workshop L5 is bought) and moves on to the goals below. When prestige reaches a gate, the blocked goal becomes possible again and takes priority over everything below it.

### Risks

- **One robot, one repair bill**: one repair bill, but the most expensive one, and a destroyed robot costs 2× repair. The Repair Bay goals and a moderate yield threshold in the blueprint help.
- **Slow prestige**: the benchmark passed 25,000 prestige by cycle 68 of 100, so L7–L9 arrive in the second half of a good season; L10 (50,000) is Blocked most seasons and costs nothing.

### Why this order

Tall means every discount is at its strongest: the Training Facility gives 9% per level at 1 slot and the Merchandising Hub gets its full prestige multiplier. So Paragon is the deepest Training Facility and Merchandising Hub investor. It adds the Repair Bay because a tall robot's repairs are the most expensive.

### Compared with the ACC benchmark

Planned by season end: Training Facility L10 (benchmark L9), Weapons Workshop L8 through the Forge steps (same), Repair Bay L7 (L8; one robot), Merchandising Hub L6 (L1), Streaming Studio L4 (L6; one robot fights fewer battles), Tuning Bay L5 (L2), Booking Office L1 (L6; one robot can use only L1). Refinements: the one weapon fully refined (Refine → 10 steps: ₡2,800,000 plus Workshop L6–L8 for ₡1,575,000), like the benchmark's top weapons. Its plan has no Hone or Augment: with 90% off at 1 slot, every attribute point is cheaper on the robot.

- [x] Approved — 9 Oct 2026

---

## 7. Strategy: Duo

**Admin display name**: Duo
**Admin description**: A two-robot team stable. Forms a 2v2 team at once and plays 2v2 League, Tag Team and the 2v2 Tournament first, with solo events as filler.
**Strategy key**: `duo`

### Intent

The tag-team pair. Two robots with complementary blueprints (for example a Bruiser and a Sprinter) share one 2v2 team, which counts for 2v2 League, Tag Team and the 2v2 Tournament at once. The Training Facility still gives 8% per level at 2 slots, so Duo builds it up over the season, to L8 (64%) once prestige allows.

### Robots, teams and events

- Two robots (goal 2); a third only if an admin raises goal 13; raise goal 11 (Booking Office) to L6 as well, so the 3v3 team gets its events.
- Teams by the team rule (§1.5): robots 1 and 2 form a 2v2 team (named in the catalogue); a third robot would add the 3v3 team of robots 1–3.
- Event focus: set by the stable's event order in `CATALOGUE.md` — Tag Team, 2v2 League and 2v2 Tournament first, then solo events as filler.

### Opening build (preparation, ₡3,000,000)

| Step | Goal | Estimated cost | Running total |
|---|---|---:|---:|
| 1 | Weapons Workshop L1 | ₡75,000 | ₡75,000 |
| 2 | Robot chain ×2: Roster Expansion L1 (₡150,000), 2 robots (₡1,000,000), starter weapons (~₡270,000 after discount) | ~₡1,420,000 | ~₡1,495,000 |
| 3 | Booking Office L1 (4 events per robot) | ₡75,000 | ~₡1,570,000 |
| 4 | Attributes → 6 on both robots (Gipsy Danger, Bruiser, ₡442,500; Striker Eureka, Sprinter, ₡366,000) | ~₡808,500 | ~₡2,378,500 |
| 5 | Booking Office → L3 (6 events per robot) | ₡375,000 | ~₡2,753,500 |
| 6 | Training Facility L1 (8% at 2 slots) | ₡150,000 | ~₡2,903,500 |
| 7 | Attributes towards 10 with everything that is left (8% off), then Saving on goal 7 | ~₡96,500 | ₡3,000,000 |

Computed with Pan Pacific Defense Corps' blueprints (Shock Maul and Burst Rifle, ₡300,000 at list price). Close to the onboarding "2 robots" budget (Roster Expansion L1, Workshop + Booking Office recommended), with more in the Booking Office and less in attributes, because more events mean more fights and more income.

### Build order (v1)

Priority is the order of this list: goal 1 comes first. Every target can be changed per stable in the admin page within "Allowed"; the order itself is part of the strategy. Each goal buys its own prerequisites (chain), and is passed over when a prerequisite is prestige-gated.

| # | Goal | Default target | Allowed | What the goal buys (chain) |
|---:|---|---|---|---|
| 1 | Weapons Workshop | L1 | L0–L10 | Weapons Workshop levels up to the target |
| 2 | Robots | 2 | 1–2 | Robot chain: missing Roster Expansion and Storage levels, robot, starter weapons (§1.3) (Roster Expansion L1) |
| 3 | Booking Office | L1 | L0–L6 | Booking Office levels up to the target; 4 events per robot; never above the useful level (§1.9) |
| 4 | Attributes | 6 | 1–10 | Attribute upgrades plus the academy levels the target needs (§1.7) |
| 5 | Booking Office | L3 | L0–L6 | Booking Office levels up to the target; 6 events per robot: team modes plus solo events; never above the useful level (§1.9) |
| 6 | Training Facility | L1 | L0–L10 | Training Facility levels up to the target; 8% per level at 2 slots |
| 7 | Attributes | 10 | 1–10 | Attribute upgrades plus the academy levels the target needs (§1.7) |
| 8 | Repair Bay | L2 | L0–L10 | Repair Bay levels up to the target; 7% off automatic repairs per level with 2 robots |
| 9 | Merchandising Hub | L1 | L0–L10 | Merchandising Hub levels up to the target; ₡10,000 per day base |
| 10 | Streaming Studio | L2 | L0–L10 | Streaming Studio levels up to the target; streaming pays per battle per robot |
| 11 | Booking Office | L4 | L0–L6 | Booking Office levels up to the target; all 7 event types two robots can enter; L4 needs 1,000 prestige; never above the useful level (§1.9) |
| 12 | Training Facility | L4 | L0–L10 | Training Facility levels up to the target; 32% off at 2 slots; L4 needs 1,000 prestige |
| 13 | Robots | 2 | 2–3 | Robot chain: missing Roster Expansion and Storage levels, robot, starter weapons (§1.3) (a third robot only if raised to 3; then also raise goal 11 to L6) |
| 14 | Attributes | 20 | 1–50 | Attribute upgrades plus the academy levels the target needs (§1.7) (academies up to L2) |
| 15 | Weapons Workshop | L3 | L0–L10 | Weapons Workshop levels up to the target; 30% off weapons |
| 16 | Weapons | final stage | stage 0–3 | Each robot's final weapons (stage 1 of its path), plus room in storage (§1.8) |
| 17 | Refine | 10 steps | 0–10 steps | Every step of both robots' refinement plans (all), plus the Weapons Workshop level each step needs (§1.8) (Workshop L4–L5 for Sharpen, L6–L8 for Forge; L5 needs 3,000 prestige, L8 15,000) |
| 18 | Tuning Bay | L2 | L0–L10 | Tuning Bay levels up to the target; 30 tuning points per robot |
| 19 | Repair Bay | L7 | L0–L10 | Repair Bay levels up to the target; 49% off with 2 robots; L4 needs 1,000 prestige … L7 10,000 |
| 20 | Training Facility | L8 | L0–L10 | Training Facility levels up to the target; 64% off at 2 slots; L5 needs 3,000 prestige … L8 15,000 |
| 21 | Streaming Studio | L5 | L0–L10 | Streaming Studio levels up to the target; L4 needs 1,000 prestige, L5 3,000 |
| 22 | Attributes | 30 | 1–50 | Attribute upgrades plus the academy levels the target needs (§1.7) (academies up to L4; L4 needs 1,000 prestige) |
| 23 | Attributes | Max | Max | Every attribute of every robot to 50, in Build Focus order, plus every academy level up to L10 (L10 needs 50,000 prestige). The final goal: whatever is left goes here |

### Prestige-gate behaviour

Goals 11, 12, 19, 20 and 21 and the academies in goal 22 need 1,000 prestige or more, and goal 17 (Refine) needs 3,000 for its Sharpens (Workshop L5) and 15,000 for its Forges (Workshop L8). When one is blocked, Duo moves on to the remaining goals; with nothing ungated left it keeps its credits until a gate opens.

### Risks

- If one of the two robots is badly damaged before a team battle, both team modes suffer; Duo cannot repair manually to recover early.

### Why this order

Two robots keep the Training Facility discount at 8% per level, so L8 gives the same discount the benchmark gets from L9 with three slots. The Workshop goal stops at L3 because two robots buy only two final weapons; the refine goal (Refine → 10 steps, all) then buys L4 to L8 for the Sharpen and Forge steps as prestige allows. That refinement is ₡5.6M for the two weapons (Pan Pacific Defense Corps ₡5,620,000, Light Labs ₡5,670,000) plus ₡2,250,000 of Workshop levels, and while goal 17 is Saving for a step, goals 18–22 wait.

### Compared with the ACC benchmark

Planned by season end: Training Facility L8 = 64% (benchmark L9 = 63% at 3 slots), Repair Bay L7 (L8), Weapons Workshop L3, and L8 through the refine chain (L8), Merchandising Hub L1 (same), Streaming Studio L5 (L6), Tuning Bay L2 (same), Booking Office L4 (L6; L4 is the useful maximum for 2 robots). Refinements: both weapons fully refined, like the benchmark.

- [x] Approved — 9 Oct 2026

---

## 8. Strategy: Trio

**Admin display name**: Trio
**Admin description**: A three-robot formation built for 3v3. Forms a 3v3 team and a 2v2 team from the same robots, plays 3v3 League and the 3v3 Tournament first, and invests in the Repair Bay early.
**Strategy key**: `trio`

### Intent

The 3v3 formation. Three robots form one 3v3 team; robots 1 and 2 also form a 2v2 team (a robot may belong to one team of each size). The Repair Bay discount is `level × (5 + robots)` %, so with 3 robots each level gives 8%, which pays off because three robots take three repair bills. Three robots is also where the ACC benchmark sits (§1.10), so Trio plans the same facility levels.

### Robots, teams and events

- Three robots (goal 1); up to six only if an admin raises goal 12 (decision 31).
- Teams by the team rule (§1.5): robots 1–3 form a 3v3 team and robots 1 and 2 also form a 2v2 team; a fourth robot would add the 2v2 team of robots 3 and 4; robots 5 and 6 add the 2v2 team 5+6 and the 3v3 team 4–6.
- Event focus: set by the stable's event order in `CATALOGUE.md` — 3v3 League and 3v3 Tournament first, then the 2v2 modes for the pair and solo events for every robot.

### Opening build (preparation, ₡3,000,000)

| Step | Goal | Estimated cost | Running total |
|---|---|---:|---:|
| 1 | Robot chain ×3: Roster Expansion L1 + L2 (₡450,000), 3 robots (₡1,500,000), Siege Cannon, Laser Pistol ×2 and Bolt Carbine (₡370,000) | ₡2,320,000 | ₡2,320,000 |
| 2 | Booking Office L1 (4 events per robot) | ₡75,000 | ₡2,395,000 |
| 3 | Attributes → 5 on all three, with everything that is left (~₡605,000 of the ~₡816,000 the full target costs: Megatron ₡273,000, Starscream ₡276,000, Soundwave ₡267,000) | ~₡605,000 | ~₡3,000,000 |

Computed with Decepticon Armada's blueprints. Result: robots at roughly attribute level 3–4, Saving on goal 3. Mirrors the onboarding "3 robots" budget (Roster Expansion L2, weapons ~₡450K, attributes ~₡650K, Booking Office recommended).

### Build order (v1)

Priority is the order of this list: goal 1 comes first. Every target can be changed per stable in the admin page within "Allowed"; the order itself is part of the strategy. Each goal buys its own prerequisites (chain), and is passed over when a prerequisite is prestige-gated.

| # | Goal | Default target | Allowed | What the goal buys (chain) |
|---:|---|---|---|---|
| 1 | Robots | 3 | 1–3 | Robot chain: missing Roster Expansion and Storage levels, robot, starter weapons (§1.3) (Roster Expansion L1–L2) |
| 2 | Booking Office | L1 | L0–L6 | Booking Office levels up to the target; 4 events per robot; never above the useful level (§1.9) |
| 3 | Attributes | 5 | 1–10 | Attribute upgrades plus the academy levels the target needs (§1.7) |
| 4 | Booking Office | L3 | L0–L6 | Booking Office levels up to the target; 6 events per robot; never above the useful level (§1.9) |
| 5 | Repair Bay | L1 | L0–L10 | Repair Bay levels up to the target; 8% off per level with 3 robots |
| 6 | Attributes | 8 | 1–10 | Attribute upgrades plus the academy levels the target needs (§1.7) |
| 7 | Weapons Workshop | L1 | L0–L10 | Weapons Workshop levels up to the target; 10% off weapons |
| 8 | Merchandising Hub | L1 | L0–L10 | Merchandising Hub levels up to the target; ₡10,000 per day base |
| 9 | Streaming Studio | L1 | L0–L10 | Streaming Studio levels up to the target; streaming pays per battle per robot |
| 10 | Training Facility | L3 | L0–L10 | Training Facility levels up to the target; 21% off at 3 slots, before the first large milestone |
| 11 | Attributes | 15 | 1–50 | Attribute upgrades plus the academy levels the target needs (§1.7) (academies L1) |
| 12 | Robots | 3 | 3–6 | Robot chain: missing Roster Expansion and Storage levels, robot, starter weapons (§1.3) (robots 4–6 only if raised; robot 5 needs Roster Expansion L4, 1,000 prestige, robot 6 L5, 3,000; decision 31) |
| 13 | Repair Bay | L3 | L0–L10 | Repair Bay levels up to the target; 24% off with 3 robots |
| 14 | Booking Office | L6 | L0–L6 | Booking Office levels up to the target; all 9 event types; L4 needs 1,000 prestige, L5 3,000, L6 5,000; never above the useful level (§1.9) |
| 15 | Weapons Workshop | L3 | L0–L10 | Weapons Workshop levels up to the target; 30% off weapons |
| 16 | Streaming Studio | L3 | L0–L10 | Streaming Studio levels up to the target |
| 17 | Training Facility | L6 | L0–L10 | Training Facility levels up to the target; 42% off at 3 slots; L4 needs 1,000 prestige, L5 3,000, L6 5,000 |
| 18 | Attributes | 20 | 1–50 | Attribute upgrades plus the academy levels the target needs (§1.7) (academies up to L2) |
| 19 | Repair Bay | L6 | L0–L10 | Repair Bay levels up to the target; 48% off with 3 robots; L4 needs 1,000 prestige, L5 3,000, L6 5,000 |
| 20 | Weapons Workshop | L6 | L0–L10 | Weapons Workshop levels up to the target; 60% off three final weapons, and the refine chain needs L5 and L8 anyway; L4 needs 1,000 prestige … L6 5,000 |
| 21 | Weapons | final stage | stage 0–3 | Each robot's final weapons (stage 1 of its path), plus room in storage (§1.8) |
| 22 | Refine | 10 steps | 0–10 steps | Every step of every robot's refinement plan (all), plus the Weapons Workshop level each step needs (§1.8) (up to Workshop L8, which needs 15,000 prestige) |
| 23 | Tuning Bay | L2 | L0–L10 | Tuning Bay levels up to the target; 30 tuning points per robot |
| 24 | Repair Bay | L8 | L0–L10 | Repair Bay levels up to the target; 64% off with 3 robots; L7 needs 10,000 prestige, L8 15,000 |
| 25 | Training Facility | L9 | L0–L10 | Training Facility levels up to the target; 63% off at 3 slots; L7 needs 10,000 prestige, L8 15,000, L9 25,000 |
| 26 | Streaming Studio | L6 | L0–L10 | Streaming Studio levels up to the target; L4 needs 1,000 prestige, L5 3,000, L6 5,000 |
| 27 | Attributes | 30 | 1–50 | Attribute upgrades plus the academy levels the target needs (§1.7) (academies up to L4; L4 needs 1,000 prestige) |
| 28 | Attributes | Max | Max | Every attribute of every robot to 50, in Build Focus order, plus every academy level up to L10 (L10 needs 50,000 prestige). The final goal: whatever is left goes here |

### Six robots (decision 31)

Goal 12 allows 3–6 robots; the default stays 3. A Trio with six robots plays three 2v2 teams (robots 1+2, 3+4, 5+6) and two 3v3 teams (1–3, 4–6). This is the admin override for a six-robot stable: change the target of goal 12 on one stable in the Editor. There is no seventh strategy. Before raising the target, add in the Editor:

- **6 blueprints**: a robots target can never be higher than the stable's number of blueprints (R3.7). Otherwise the Editor shows "Goal 12 targets 6 robots, but this stable has 4 blueprints. Add blueprints or lower the target."
- **Team names for 3 2v2 teams and 2 3v3 teams** under the team rule. Otherwise the Editor shows the team-names error ("This stable needs 3 team names for 2v2 and 2 for 3v3.").

Booking Office L6 already covers all 9 event types. The Training Facility discount drops to 4% per level at 6 slots.

### Prestige-gate behaviour

Goals 14, 17, 19, 20, 24, 25 and 26 and the academies in goal 27 are gated, and the steps of goal 22 wait for the Workshop: its Sharpens for L5 (3,000 prestige, usually bought by goal 20 first) and its Forges for L8 (15,000 prestige). Each gated goal is passed over until prestige allows the next level; when goal 27 is blocked, Trio raises attributes as far as the current caps allow and moves on. If goal 12 is raised, robot 5 needs Roster Expansion L4 (1,000 prestige) and robot 6 L5 (3,000).

### Risks

- Three robots in team modes all need to be healthy at the same time. Automatic repair keeps them fighting, at full price.

### Why this order

Three robots sit where the benchmark sits, so Trio mirrors it level for level. The Training Facility goes in before the first large milestone, and the Repair Bay climbs with every gate because three robots take three repair bills.

### Compared with the ACC benchmark

Planned by season end: Repair Bay L8 (same), Training Facility L9 (same), Weapons Workshop L8 through the Forge steps (same), Merchandising Hub L1 (same), Streaming Studio L6 (same), Tuning Bay L2 (same), Booking Office L6 (same), academies L4 through Attributes → 30 (L3–4). Refinements: every weapon fully refined (Refine → 10 steps), like the benchmark: ₡11,240,000 for Decepticon Armada (Starscream dual-wields, so 4 weapons) and ₡8,480,000 for White Base Mobile Suits (3 weapons and the Gundam's shield), plus Workshop L7–L8 (₡1,125,000) on top of goal 20. While goal 22 is Saving for a step, goals 23–27 wait. Trio is the closest strategy to the benchmark; the benchmark adds Tycoon-like income on top, which Trio keeps at Merchandising Hub L1 and Streaming Studio L6.

- [x] Approved — 9 Oct 2026

---

## 9. Strategy: Tycoon

**Admin display name**: Tycoon
**Admin description**: Invests in income first. Builds the Merchandising Hub and Streaming Studio before anything else, then grows to two robots and upgrades with the profits.
**Strategy key**: `tycoon`

### Intent

The investor. Merchandising Hub L1 costs ₡150,000 and pays ₡10,000 per day (more with prestige), so it repays itself in about two weeks of a 100-cycle season. The Streaming Studio multiplies per-battle streaming revenue (L1 doubles it). Tycoon starts weaker than the others and finishes richer. With two robots the Training Facility gives 8% per level, so Tycoon builds it from its profits (goals 16 and 23).

### Robots, teams and events

- Two robots (goal 6); a third only if an admin raises goal 20.
- Teams by the team rule (§1.5): robots 1 and 2 form a 2v2 team once the second robot exists; a third robot adds the 3v3 team of robots 1–3.
- Event focus: set by the stable's event order in `CATALOGUE.md` — as many battles as possible (King of the Hill, Grand Melee, League 1v1), because streaming pays per battle.

### Opening build (preparation, ₡3,000,000)

| Step | Goal | Estimated cost | Running total |
|---|---|---:|---:|
| 1 | Robot chain ×1: robot + War Club | ₡584,000 | ₡584,000 |
| 2 | Booking Office L1 (4 events) | ₡75,000 | ₡659,000 |
| 3 | Merchandising Hub → L2 (₡20,000/day base) | ₡450,000 | ₡1,109,000 |
| 4 | Streaming Studio → L1 (2× streaming) | ₡100,000 | ₡1,209,000 |
| 5 | Attributes → 6 on Bender (Bruiser) | ₡442,500 | ₡1,651,500 |
| 6 | Robot chain ×1: Roster Expansion L1 + robot + Beam Pistol | ₡743,000 | ₡2,394,500 |
| 7 | Attributes → 6 on Calculon (goal 5 re-opens for the new robot; Deadeye) | ₡402,000 | ₡2,796,500 |
| 8 | Booking Office L2 (goal 7) | ₡150,000 | ₡2,946,500 |
| — | Saved towards Booking Office L3 (₡225,000) | ~₡53,500 | ₡3,000,000 |

Computed with Planet Express Crew's blueprints.

Tycoon ends its opening **saving** for Booking Office L3 (goal 7): a demonstration of the save-for-the-goal rule.

### Build order (v1)

Priority is the order of this list: goal 1 comes first. Every target can be changed per stable in the admin page within "Allowed"; the order itself is part of the strategy. Each goal buys its own prerequisites (chain), and is passed over when a prerequisite is prestige-gated.

| # | Goal | Default target | Allowed | What the goal buys (chain) |
|---:|---|---|---|---|
| 1 | Robots | 1 | 1 | Robot chain: missing Roster Expansion and Storage levels, robot, starter weapons (§1.3) |
| 2 | Booking Office | L1 | L0–L6 | Booking Office levels up to the target; 4 events: more battles, more streaming income; never above the useful level (§1.9) |
| 3 | Merchandising Hub | L2 | L0–L10 | Merchandising Hub levels up to the target; ₡20,000/day base |
| 4 | Streaming Studio | L1 | L0–L10 | Streaming Studio levels up to the target; 2× streaming |
| 5 | Attributes | 6 | 1–10 | Attribute upgrades plus the academy levels the target needs (§1.7) |
| 6 | Robots | 2 | 1–2 | Robot chain: missing Roster Expansion and Storage levels, robot, starter weapons (§1.3) (Roster Expansion L1) |
| 7 | Booking Office | L3 | L0–L6 | Booking Office levels up to the target; 6 events per robot; never above the useful level (§1.9) |
| 8 | Merchandising Hub | L3 | L0–L10 | Merchandising Hub levels up to the target |
| 9 | Streaming Studio | L3 | L0–L10 | Streaming Studio levels up to the target |
| 10 | Attributes | 10 | 1–10 | Attribute upgrades plus the academy levels the target needs (§1.7) |
| 11 | Weapons Workshop | L1 | L0–L10 | Weapons Workshop levels up to the target; 10% off weapons |
| 12 | Repair Bay | L2 | L0–L10 | Repair Bay levels up to the target; 7% off automatic repairs per level with 2 robots |
| 13 | Booking Office | L6 | L0–L6 | Booking Office levels up to the target; L4 (all 7 event types) is enough with 2 robots, L6 (all 9) with a third; L4 needs 1,000 prestige, L5 3,000, L6 5,000; never above the useful level (§1.9) |
| 14 | Merchandising Hub | L6 | L0–L10 | Merchandising Hub levels up to the target; L4 needs 1,000 prestige, L5 3,000, L6 5,000 |
| 15 | Streaming Studio | L6 | L0–L10 | Streaming Studio levels up to the target; L4 needs 1,000 prestige, L5 3,000, L6 5,000 |
| 16 | Training Facility | L3 | L0–L10 | Training Facility levels up to the target; 24% off at 2 slots |
| 17 | Attributes | 20 | 1–50 | Attribute upgrades plus the academy levels the target needs (§1.7) (academies up to L2) |
| 18 | Weapons Workshop | L3 | L0–L10 | Weapons Workshop levels up to the target; 30% off weapons; L3 also unlocks Augment (Zeus's plan) |
| 19 | Weapons | final stage | stage 0–3 | Each robot's final weapons (stage 1 of its path), plus room in storage (§1.8) |
| 20 | Robots | 2 | 2–3 | Robot chain: missing Roster Expansion and Storage levels, robot, starter weapons (§1.3) (a third robot only if raised to 3) |
| 21 | Repair Bay | L6 | L0–L10 | Repair Bay levels up to the target; L4 needs 1,000 prestige, L5 3,000, L6 5,000 |
| 22 | Tuning Bay | L1 | L0–L10 | Tuning Bay levels up to the target; 20 tuning points per robot |
| 23 | Training Facility | L6 | L0–L10 | Training Facility levels up to the target; 48% off at 2 slots; L4 needs 1,000 prestige, L5 3,000, L6 5,000 |
| 24 | Attributes | 30 | 1–50 | Attribute upgrades plus the academy levels the target needs (§1.7) (academies up to L4; L4 needs 1,000 prestige) |
| 25 | Refine | 10 steps | 0–10 steps | Every step of every robot's refinement plan (all), plus the Weapons Workshop level each step needs (§1.8) (Workshop L4–L8; L5 needs 3,000 prestige, L8 15,000) (lowest priority: off identity) |
| 26 | Attributes | Max | Max | Every attribute of every robot to 50, in Build Focus order, plus every academy level up to L10 (L10 needs 50,000 prestige). The final goal: whatever is left goes here |

### Prestige-gate behaviour

Income facilities beyond L3 and Booking Office L4 need prestige. While goals 13–15, 21 and 23 and the academies in goal 24 are blocked, Tycoon puts its growing income into attributes, the Training Facility, weapons and the Tuning Bay.

### Risks

- **Weak early season**: a Tycoon may lose more than it wins in the first week. That is the trade-off.
- **Operating costs**: the planned end state costs ~₡13,000 per day (Repair Bay L6 ₡3,500, Training Facility L6 ₡1,500, Merchandising Hub L6 ₡1,200, Streaming Studio L6 ₡600, academies up to ~₡4,000, the rest small), against at least ₡60,000 per day from Merchandising Hub L6 alone.

### Why this order

Income first; then the profits go into the same discounts every strategy uses, but not as deep as Trio: Repair Bay and Training Facility stop at L6 (Trio L8 and L9) and the Weapons Workshop goal at L3 (Trio L8; only the lowest-priority refine chain takes it further), while Streaming Studio matches Trio at L6 and Merchandising Hub goes well above it (L6 against L1). Refinements are the one thing that does not pay back for an income stable, so they sit at the lowest priority, just before "Attributes → Max". Their target is still all (Refine → 10 steps, decision 36), because by then the profits are there to spend: ₡5,680,000 for Planet Express Crew's two weapons and ₡14,180,000 for World Robot Boxing's five (Atom and Noisy Boy dual-wield), plus Workshop L4–L8 (₡2,250,000) through the refine chain. Merchandising Hub above L6 is not planned: the L7 step (₡1,050,000 for ₡10,000 more per day base, 10,000 prestige) would not pay back before the season reset.

### Compared with the ACC benchmark

Planned by season end: Merchandising Hub L6 (benchmark L1), Streaming Studio L6 (same), Repair Bay L6 (L8), Training Facility L6 (L9), Weapons Workshop L3, and L8 through the refine chain (L8), Tuning Bay L1 (L2), Booking Office L4 with 2 robots, L6 with 3 (L6). Refinements: all planned, but at the lowest priority they come after Attributes → 30, so a Tycoon is usually fully refined later in the season than the benchmark.

- [x] Approved — 9 Oct 2026

---

## 10. Strategy: Generalist

**Admin display name**: Generalist
**Admin description**: A steady all-rounder. Two robots (more if configured), a moderate mix of every facility, even upgrades, and a bit of everything: weapons, refinements, tuning.
**Strategy key**: `generalist`

### Intent

The "sensible human" baseline. It touches every system in moderation, which also makes it the reference strategy for comparing the others. It buys every facility, mostly below Trio's levels: Repair Bay one level lower (L7), Training Facility and Streaming Studio two lower (L7, L4), a Weapons Workshop goal three lower (L5; the refine goal's chain still takes the Workshop to L8 for the Forge steps), Tuning Bay the same (L2) and Merchandising Hub one level higher (L2).

### Robots, teams and events

- Two robots (goal 5); more only if an admin raises goal 14. With three or more robots goal 15 (Booking Office → L6) climbs past L4 for the 3v3 events.
- Teams by the team rule (§1.5): a 2v2 team of robots 1 and 2, plus the 3v3 team of robots 1–3 at three robots and a second 2v2 team (robots 3 and 4) at four.
- Event focus: set by the stable's event order in `CATALOGUE.md` — League 1v1 and King of the Hill, plus team modes once teams exist.

### Opening build (preparation, ₡3,000,000)

| Step | Goal | Estimated cost | Running total |
|---|---|---:|---:|
| 1 | Weapons Workshop L1 | ₡75,000 | ₡75,000 |
| 2 | Robot chain ×1: robot + Laser Pistol (₡51,300 after 10%) | ~₡551,300 | ~₡626,300 |
| 3 | Booking Office L1 | ₡75,000 | ~₡701,300 |
| 4 | Attributes → 6 on Optimus Prime (Versatile) | ₡690,000 | ~₡1,391,300 |
| 5 | Robot chain ×1: Roster Expansion L1 + robot + Laser Pistol ×2 (₡102,600 after 10%) | ~₡752,600 | ~₡2,143,900 |
| 6 | Attributes → 6 on Bumblebee (goal 4 re-opens; Sprinter) | ₡366,000 | ~₡2,509,900 |
| 7 | Booking Office → L3 (goal 6) | ₡375,000 | ~₡2,884,900 |
| — | Saved towards goal 7 (Training Facility L1, ₡150,000) | ~₡115,100 | ₡3,000,000 |

Computed with Autobots of the Ark's blueprints.

### Build order (v1)

Priority is the order of this list: goal 1 comes first. Every target can be changed per stable in the admin page within "Allowed"; the order itself is part of the strategy. Each goal buys its own prerequisites (chain), and is passed over when a prerequisite is prestige-gated.

| # | Goal | Default target | Allowed | What the goal buys (chain) |
|---:|---|---|---|---|
| 1 | Weapons Workshop | L1 | L0–L10 | Weapons Workshop levels up to the target |
| 2 | Robots | 1 | 1 | Robot chain: missing Roster Expansion and Storage levels, robot, starter weapons (§1.3) |
| 3 | Booking Office | L1 | L0–L6 | Booking Office levels up to the target; 4 events; never above the useful level (§1.9) |
| 4 | Attributes | 6 | 1–10 | Attribute upgrades plus the academy levels the target needs (§1.7) |
| 5 | Robots | 2 | 1–2 | Robot chain: missing Roster Expansion and Storage levels, robot, starter weapons (§1.3) (Roster Expansion L1) |
| 6 | Booking Office | L3 | L0–L6 | Booking Office levels up to the target; 6 events per robot; never above the useful level (§1.9) |
| 7 | Training Facility | L1 | L0–L10 | Training Facility levels up to the target |
| 8 | Attributes | 10 | 1–10 | Attribute upgrades plus the academy levels the target needs (§1.7) |
| 9 | Repair Bay | L2 | L0–L10 | Repair Bay levels up to the target; 7% off automatic repairs per level with 2 robots |
| 10 | Streaming Studio | L2 | L0–L10 | Streaming Studio levels up to the target; streaming pays per battle per robot |
| 11 | Merchandising Hub | L1 | L0–L10 | Merchandising Hub levels up to the target; ₡10,000 per day base |
| 12 | Attributes | 15 | 1–50 | Attribute upgrades plus the academy levels the target needs (§1.7) (academies L1) |
| 13 | Tuning Bay | L1 | L0–L10 | Tuning Bay levels up to the target; 20 tuning points per robot |
| 14 | Robots | 2 | 2–4 | Robot chain: missing Roster Expansion and Storage levels, robot, starter weapons (§1.3) (more robots only if raised) |
| 15 | Booking Office | L6 | L0–L6 | Booking Office levels up to the target; L4 (7 events) is enough with 2 robots, L6 (9) with 3 or more; L4 needs 1,000 prestige, L5 3,000, L6 5,000; never above the useful level (§1.9) |
| 16 | Weapons Workshop | L5 | L0–L10 | Weapons Workshop levels up to the target; 50% off weapons, and Sharpen needs L5; L4 needs 1,000 prestige, L5 3,000 |
| 17 | Weapons | final stage | stage 0–3 | Each robot's final weapons (stage 1 of its path), plus room in storage (§1.8) |
| 18 | Refine | 10 steps | 0–10 steps | Every step of every robot's refinement plan (all), plus the Weapons Workshop level each step needs (§1.8) (Sharpen needs L5, which goal 16 buys at 3,000 prestige; Forge needs L6–L8, bought by this goal's chain; L8 needs 15,000 prestige) |
| 19 | Repair Bay | L5 | L0–L10 | Repair Bay levels up to the target; L4 needs 1,000 prestige, L5 3,000 |
| 20 | Training Facility | L5 | L0–L10 | Training Facility levels up to the target; 40% off at 2 slots; L4 needs 1,000 prestige, L5 3,000 |
| 21 | Streaming Studio | L4 | L0–L10 | Streaming Studio levels up to the target; L4 needs 1,000 prestige |
| 22 | Merchandising Hub | L2 | L0–L10 | Merchandising Hub levels up to the target; ₡20,000 per day base |
| 23 | Attributes | 25 | 1–50 | Attribute upgrades plus the academy levels the target needs (§1.7) (academies up to L3) |
| 24 | Tuning Bay | L2 | L0–L10 | Tuning Bay levels up to the target; 30 tuning points per robot |
| 25 | Repair Bay | L7 | L0–L10 | Repair Bay levels up to the target; L6 needs 5,000 prestige, L7 10,000 |
| 26 | Training Facility | L7 | L0–L10 | Training Facility levels up to the target; 56% off at 2 slots; L6 needs 5,000 prestige, L7 10,000 |
| 27 | Attributes | Max | Max | Every attribute of every robot to 50, in Build Focus order, plus every academy level up to L10 (L10 needs 50,000 prestige). The final goal: whatever is left goes here |

### Prestige-gate behaviour

Generalist meets the same gates as everyone else (academies and facilities L4+). Goals 15, 16, 18 (every plan starts with a Sharpen, which needs Workshop L5 at 3,000 prestige; the Forges need L8 at 15,000), 19, 20, 21, 25 and 26 are gated; Attributes → 25 needs academy L3 only, which has no gate. Blocked goals are passed over; nothing is saved for a goal that is gated.

### Why this order

The reference "sensible human": every facility, mostly one to three levels below Trio (§11), with the Merchandising Hub one level above Trio's (L2 against L1). Like a human with top weapons, it refines them fully (Refine → 10 steps): ₡11,330,000 for Autobots of the Ark's three robots (Bumblebee dual-wields, so 4 weapons) plus Workshop L6–L8 (₡1,575,000). Because goal 18 comes straight after the weapons goal, the Generalist saves for its Sharpens once it has 3,000 prestige and for its Forges once it has 15,000, before goals 19–26.

### Compared with the ACC benchmark

Planned by season end: Repair Bay L7 (benchmark L8), Training Facility L7 (L9), Weapons Workshop L5, and L8 through the refine chain (L8), Merchandising Hub L2 (L1), Streaming Studio L4 (L6), Tuning Bay L2 (same), Booking Office L4 with 2 robots, L6 with 3 (L6; Autobots of the Ark runs 3). Refinements: every weapon fully refined, like the benchmark.

- [x] Approved — 9 Oct 2026

---

## 11. Strategy comparison at a glance

Facility levels are the planned end-of-season targets (the last goal of that facility in the build order).

| | Swarm | Paragon | Duo | Trio | Tycoon | Generalist | ACC benchmark (human, 3 robots, cycle 68) |
|---|---|---|---|---|---|---|---|
| Robots (default / allowed max) | 11 / 11 | 1 / 2 | 2 / 3 | 3 / 6 | 2 / 3 | 2 / 4 | 3 |
| Opening robots | 3 | 1 | 2 | 3 | 2 | 2 | — |
| Goals | 25 | 24 | 23 | 28 | 26 | 27 | — |
| First facility | Roster Expansion (robot chain) | Weapons Workshop | Weapons Workshop | Roster Expansion (robot chain) | Booking Office, then Merchandising Hub | Weapons Workshop | — |
| Repair Bay | L7 | L7 | L7 | L8 | L6 | L7 | L8 |
| Training Facility | L1 (lowest priority) | L10 | L8 | L9 | L6 | L7 | L9 |
| Weapons Workshop | L7 (L8 via the refine chain) | L8 (Forge chain) | L3 (L8 via the refine chain) | L8 (Forge chain) | L3 (L8 via the refine chain) | L5 (L8 via the refine chain) | L8 |
| Merchandising Hub | L1 | L6 | L1 | L1 | L6 | L2 | L1 |
| Streaming Studio | L8 | L4 | L5 | L6 | L6 | L4 | L6 |
| Tuning Bay | L2 | L5 | L2 | L2 | L1 | L2 | L2 |
| Booking Office (max) | L6 | L1 | L4 | L6 | L6 (L4 with 2 robots) | L6 (L4 with 2 robots) | L6 |
| Refinement (default) | 8 steps (every Sharpen and Forge), lowest priority | 10 steps (all) | 10 steps (all) | 10 steps (all) | 10 steps (all), lowest priority | 10 steps (all) | fully refined |
| Last milestone before Max | 25 | 40 | 30 | 30 | 30 | 25 | ~25 reached |
| Teams | 2v2 and 3v3 by the team rule (up to 5 and 3) | none (one 2v2 if raised to 2 robots) | 2v2 (+ 3v3 at 3 robots) | 3v3 + 2v2 (second 2v2 at 4; three 2v2 and two 3v3 at 6) | 2v2 (+ 3v3 at 3 robots) | 2v2, + 3v3 at 3 robots | — |

Planned levels are targets. A level behind a prestige gate is Blocked and costs nothing until the stable has the prestige.

- [x] Approved — 9 Oct 2026

---

## 12. Adding or changing strategies later

Each strategy is a small data file in the repository (`app/backend/src/config/automaton-strategies/{key}.v{version}.json`): its name, description and numbered build order with default targets and allowed ranges. The goal types themselves (robots, facility, attributes, weapons, refine) and everything they buy along the way (§1.3) are code. The six strategies above are version 1.

- **Tuning a strategy for one stable** (admin page, Editor): change goal targets within the allowed ranges; a robots target can never be higher than the stable's number of blueprints. Takes effect at the next cycle. No deploy.
- **New strategy or new version** (admin page, Strategies → Strategy Builder):
  1. Start from scratch or from an existing version. Add goals from the goal types, move them up and down, remove them, and set each goal's default target and allowed range. The builder checks the rules as you go: 1–40 goals, a robots goal before any attributes, weapons or refine goal, Booking Office never above L6, Refine 0–10 steps (the number of plan steps per robot), every goal type at least once with a default above 0 (Robots, Attributes, Weapons, Refine, Repair Bay, Training Facility, Weapons Workshop, Booking Office, Merchandising Hub, Streaming Studio and Tuning Bay; Roster Expansion, Storage Facility and the academies are bought by goal chains and need no goal; decision 29), and "Attributes → Max" as the last goal. Guidance, not a rule: goals that do not fit the strategy go at the lowest priority, just before "Attributes → Max".
  2. Preview the draft on an existing stable (status per goal, as in the Editor) and on a fresh stable with ₡3,000,000 (what it would buy in its opening cycles). Previews change nothing.
  3. Export the draft. A developer runs `pnpm run automaton:unpack <file>` and opens a pull request with the new file.
  4. CI runs the shared tests on every strategy file: never overspends, only valid purchases, always finishes, deterministic, never repairs manually, blocked on every unmet prestige gate, plus a two-season scenario from ₡3,000,000 (buys a robot in the first cycle, never goes below ₡0 through its own purchases, every robot always armed). Because every strategy contains every goal type, every goal type is exercised in every strategy. Nothing has to be written for the new file; the tests pick it up.
  5. You approve the pull request. That review replaces this review pack for strategies added later.
  6. After merge and deploy the strategy appears in the Strategy Library and the strategy list in the Editor.
- **Moving stables to a new version**: stables stay on the version they have. In the Strategy Library, **Upgrade** moves one stable or all stables of a strategy. You first see old → new targets per goal (matched by goal type, facility and position among goals of that kind; clamped to the new ranges; new goals get their default) and then confirm. Takes effect at the next cycle.
- **Drafts** live only on the environment where they were made and can never be assigned to a stable.
- **Old versions** stay in the repository while any stable uses them; the server refuses to start if one in use is missing.
- **New goal type** (behaviour the goal types cannot express yet, for example "sell a robot"): a code change to the goal library with its own tests, outside the builder.

- [x] Approved — 9 Oct 2026
