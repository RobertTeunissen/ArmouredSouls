# Prestige & Fame Design Exploration

**Status**: Early brainstorm — not a spec, not committed  
**Date**: April 15, 2026  
**Context**: Came out of the Post-Battle Results Page discussion. We discovered that prestige and fame have almost no meaningful progression milestones, which makes any "progression context" UI hollow. This doc explores what prestige and fame *should* do.

---

## The Problem

Prestige and fame are one-way accumulators that go up when you win and never go down. They have no tension, no decisions, no trade-offs. You don't spend them, you don't allocate them, you don't choose between them.

**What prestige does today:**
1. Smooth income multiplier on merchandising: `base × (1 + prestige/10,000)`
2. Threshold-based battle winnings bonus: +10% at 1K, +20% at 5K, +30% at 10K, +40% at 25K, +50% at 50K → **decision: convert to smooth scaling** (small code change, independent of everything else)
3. Gates certain facility upgrades (scattered one-time barriers)
4. Cosmetic rank title on leaderboard (Novice/Established/Veteran/Elite/Champion/Legendary)

**What fame does today:**
1. Smooth streaming revenue multiplier: `1 + fame/5,000`
2. Cosmetic tier name on leaderboard (Unknown/Known/Famous/Renowned/Legendary/Mythical)

**Core issue**: Neither system creates a moment where the player thinks "I need more prestige/fame." The progression exists mechanically but players don't experience it as progression. This is Loop 4 from the Game Loop Audit.

**Real-world data (ACC server, ~17 cycles in):**
- Top prestige: 860 (Ultron Inc, 1 robot, 87.5% win rate). Everyone is still Novice rank. Nobody has hit the first battle winnings bonus tier at 1,000.
- Top fame: 1,234 (Ultron, Renowned tier). Most active robots are in the 300–500 range (Known tier).
- Multi-robot stables (3–4 robots) accumulate prestige faster through volume but each robot has lower individual fame. Single-robot stables have concentrated fame. This split is working as intended.

---

## Design Direction: Make Them Matter

Add real milestone unlocks that give players concrete reasons to care about prestige and fame accumulation. Focus on cosmetic and engagement rewards, not combat bonuses.

**Key constraint**: Prestige is stable-level (shared across all robots). Fame is robot-level (individual). Prestige affects your whole operation, fame makes a specific robot feel special.

---

## Prestige — Your Stable's Reputation

### Keep (smooth scaling)
- Battle winnings bonus — convert to smooth formula to match merchandising.
- Merchandising income scaling — already smooth.
- Facility upgrade gates — stay as-is.

### Ideas Evaluated

#### ✅ Stable Cosmetics
Unlock stable banner, color scheme shown on leaderboards and in opponent views. Your brand is visible to other players. Cosmetics are proven engagement drivers and don't affect game balance.

Could be tiered: basic color at low prestige, full banner/crest at higher prestige. Gives players something to show off that other players actually see.

#### ✅ Detailed Battle Analytics (verbose combat log)
Unlock the verbose combat log mode from #14 — hit chance percentages, damage formulas, attribute matchups. Adds depth for veteran players without overwhelming new ones.

**Open question**: Should this be gated by prestige or by player preference? The argument for prestige: it naturally correlates with experience, so new players don't see complexity they're not ready for. The argument against: it depends on player *type*, not experience level. A data-oriented new player might want this immediately, while a casual veteran might never care. Could offer it as a toggle that *unlocks* at a prestige threshold — available but not forced.

#### ✅ Player Challenges / Rivalry System
The ability to issue challenges to specific players. Creates the social/rivalry loop that's entirely missing.

**Revised thinking**: This shouldn't be hidden behind a high prestige barrier. If anything, rivalries are most interesting in the mid-game when players are competitive with each other. Could be available early or even from the start — prestige could enhance it (higher-prestige challenges get featured on a public board, or carry bonus rewards) rather than gate it.

#### ❌ Opponent Scouting (rejected)
Players can already view opponent battle history (it's public). The actionable advantage is minimal — you can't drastically change strategy between battles since weapon switching is costly and there's 4+ hours between battles in the cron schedule. Better suited as a facility feature (Research Lab) if implemented at all.

#### ❌ Loadout Presets (rejected)
Players equip robots with a deliberate strategy. Switching is costly by design. With 4+ hours between battles, there's already time to manually adjust. This doesn't solve a real problem.

#### ❌ Conditional Stances (rejected for prestige gating)
Players can already change stance between battles during the downtime window. Automating it ("aggressive vs lower ELO, defensive vs higher") removes a manual decision that players can already make. Could be interesting as a facility feature (AI Training Academy?) but not as a prestige unlock.

#### ❌ Prestige Tournaments (rejected for now)
With ~10 daily active players, prestige-gated tournaments would fragment an already small pool. Revisit when player base grows. The Booking Office facility design can wait.

#### ❌ Mentor Bonus (rejected)
Doesn't work with current matchmaking — league-based matching means high-prestige players in Diamond never face new players in Bronze. The leagues are already designed to keep matchups competitive.

### What's left for prestige milestones?

Honestly, not much that's both meaningful and feasible at current scale. The strongest ideas are:
1. **Stable cosmetics** — proven engagement, visible to others, tierable
2. **Verbose combat log unlock** — adds depth for veterans (with the gating question above)
3. **Challenge system enhancements** — prestige enhances rather than gates

This is thin. It raises a harder question: **is prestige the right vehicle for milestone unlocks at all?** Its current role (smooth income scaling + facility gates) might be sufficient if the *achievement system* (#8) handles the "celebrate moments" job. Prestige could stay as the economic backbone while achievements provide the dopamine hits.

---

## Fame — Your Robot's Legend

### Keep (smooth scaling)
- Streaming revenue multiplier — already smooth.

### Ideas Evaluated

#### ✅ Auto-Generated Titles
Robot earns a visible title shown in battle reports and on leaderboards. Auto-generated from combat stats — a robot that wins with high HP gets defensive titles, a robot with lots of kills gets aggressive titles. Cosmetic but gives the robot *identity*.

**Proposal for title generation:**

Titles could be derived from the robot's dominant stat pattern across its battle history:

| Pattern | Condition | Example Titles |
|---------|-----------|---------------|
| Tank | High win rate with HP > 70% at end | "The Immovable", "Ironclad", "The Wall" |
| Glass Cannon | High damage dealt but low final HP | "The Reckless", "Berserker", "All-In" |
| Comeback King | Multiple wins with HP < 25% | "The Unkillable", "Last Stand", "Clutch" |
| Executioner | High kill count (destroyed opponents) | "The Destroyer", "Merciless", "Finisher" |
| Endurance | High average battle duration in wins | "The Patient", "Attrition", "Outlaster" |
| Dominant | High win rate + high ELO | "The Apex", "Unstoppable", "Supreme" |
| Underdog | Wins against higher-ELO opponents | "Giant Slayer", "The Upset", "Defiant" |

Title updates periodically (every N battles or every cycle) based on the robot's evolving stats. A robot could earn multiple titles over its career as its fighting style shifts.

**Implementation note**: This is purely cosmetic, no combat effect. Needs a title generation function that reads battle history stats and picks the best-fitting title. Display on leaderboards, battle reports, robot detail page.

#### ✅ Visual Fame Indicator
Robot portrait gets a fame border/glow/star rating visible everywhere the robot appears. Simple, reinforces the loop. Other players see at a glance that a robot is famous.

Could scale with fame tiers: no indicator below 100, bronze border at Known (100), silver at Famous (500), gold at Renowned (1,000), animated glow at Legendary (2,500+).

#### ✅ Signature Move (with caveats)
A named combat event that triggers occasionally in battle logs. Cosmetic flavor that makes high-fame robots feel like characters. Could be player-named at a fame threshold.

**Caveat**: Player-named content needs a profanity filter and possibly approval flow. Could start with auto-generated signature moves (based on the robot's weapon type and fighting style) and add player naming later. Or skip player naming entirely and keep it system-generated.

#### ✅ Public Battle History
Robot's battle history becomes publicly viewable by other players once famous enough. Feeds the scouting angle — if you can see a famous opponent's history, you can prepare. Natural consequence of being famous.

#### ❌ Performance-Based Passive Combat Bonus (rejected)
Adds complexity to an already complex combat system. "Win more" mechanic — famous robots get stronger, making them harder to beat, making them more famous. Better handled through the achievement system, which could award prestige (not combat power) for performance patterns.

#### ❌ Sponsorship Income (rejected)
Another income stream doesn't solve the core problem. Fame already scales streaming revenue. Adding a second fame-based income stream is just more invisible math, not progression the player feels.

#### ❌ Hall of Fame (deferred)
Good idea but tied to seasons, which aren't designed yet. Revisit when season system is defined (~2 months out). End-of-season Hall of Fame induction for top-fame robots makes more sense than a mid-season threshold.

### What's left for fame milestones?

Stronger than prestige:
1. **Auto-generated titles** — gives robots identity, visible to everyone, changes over time
2. **Visual fame indicator** — simple, scales with tiers, reinforces the loop everywhere
3. **Signature moves** — cosmetic flavor in battle logs, system-generated to avoid moderation issues
4. **Public battle history** — natural consequence of fame, feeds scouting

All four are cosmetic/social. No combat bonuses, no economic additions beyond what exists. Fame makes your robot *feel* legendary without making it mechanically stronger.

---

## The Interaction Between Prestige and Fame

The original framing holds: prestige unlocks stable-wide capabilities, fame makes individual robots special. The roster tension (concentrate fame on one robot vs spread across many) is already working in practice on ACC — single-robot stables have higher individual fame, multi-robot stables have higher prestige.

**Revised view on achievements**: The Achievement System (#8) might be the better vehicle for "celebrate moments" milestones for *both* prestige and fame. Achievements can trigger on prestige thresholds ("Reached 1,000 prestige — Established!"), fame thresholds ("Robot reached Famous tier!"), and specific accomplishments (first win, 10-win streak, etc.). This means prestige/fame don't need their own milestone system — they feed into achievements, which provide the celebration and reward layer.

This simplifies the design:
- **Prestige**: Smooth economic scaling + facility gates. No milestone unlocks of its own.
- **Fame**: Smooth streaming scaling + cosmetic identity (titles, visual indicators, signature moves, public history). No milestone unlocks of its own.
- **Achievements**: The milestone/celebration system that triggers on prestige thresholds, fame thresholds, combat accomplishments, and economic milestones. Awards one-time rewards (credits, prestige, cosmetics).

---

## Considerations and Risks

### Rich Get Richer
Multi-robot stables accumulate prestige faster through volume. Single-robot stables concentrate fame. This split is working as intended on ACC — different strategies lead to different reputation profiles. No intervention needed currently.

### Complexity Budget
Start with fame cosmetics (titles + visual indicators) — they're the highest-impact, lowest-effort changes. Stable cosmetics and verbose combat log can follow. Signature moves need more design work.

### Retroactive Awards
Existing players would get titles and visual indicators immediately based on current fame. That's a positive moment, not a problem.

### Fame Decay
Robots are automatically scheduled for battles — they're rarely truly inactive. The only scenario for fame decay would be ownership transfer, which doesn't exist yet. Not relevant for now.

### Unimplemented Facilities
Don't try to save the 4 unimplemented facilities by connecting them to prestige/fame. If they don't have good mechanics, scrap or redesign them independently. Players don't care about facilities that were never live.

---

## Decisions Made

1. **Convert battle winnings bonus to smooth scaling** — small code change, do independently.
2. **No combat bonuses from fame** — fame is cosmetic/economic identity, not power.
3. **No prestige-gated feature unlocks for now** — achievements (#8) are the better vehicle for milestone celebrations.
4. **Fame cosmetics are the priority** — titles, visual indicators, signature moves, public history.
5. **Stable cosmetics from prestige** — worth doing but lower priority than fame cosmetics.
6. **Seasons, Hall of Fame, prestige tournaments** — deferred until season system is designed (~2 months).
7. **Unimplemented facilities** — don't force-connect to prestige/fame. Redesign independently if needed.

## Open Questions

1. Should verbose combat log be gated by prestige or offered as a player preference toggle? (Player type vs experience level question)
2. What are the right fame thresholds for title generation and visual indicators given current ACC data? (Top robot is at 1,234 fame after ~17 cycles — thresholds need to feel achievable but meaningful)
3. Should the challenge/rivalry system be a standalone feature or tied to prestige in any way?
4. How do fame titles interact with the achievement system — are they separate cosmetic layers or unified?
5. Should stable cosmetics be prestige-gated or credit-purchasable (or both — prestige unlocks, credits buy)?
