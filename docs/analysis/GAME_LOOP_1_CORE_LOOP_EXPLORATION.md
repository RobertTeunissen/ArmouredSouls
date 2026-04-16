# Game Loop 1: Core Loop Exploration

**Status**: Early brainstorm — not a spec, not committed  
**Date**: April 15, 2026  
**Context**: Part of the Game Loop Audit (#6). Exploring how to improve the core loop: Configure → Battle → Results → Adjust.

---

## The Problem

The core loop collapses into "configure once → watch results on repeat." The daily rhythm is sound (battles happen automatically on a cron schedule, results appear when you log in), but the decision space between cycles is too narrow.

### What players can actually change between battles today

1. **Stance** — offensive / defensive / balanced (3 options)
2. **Yield threshold** — 0–50% HP slider (when to surrender)
3. **Weapon equip/unequip** — swap from owned inventory (costly, see Weapon Experimentation Problem #5)
4. **Loadout type** — single / weapon+shield / two-handed / dual-wield (follows from weapon choice)
5. **Attribute upgrades** — spend credits to raise one of 23 attributes by 1 point (permanent, expensive at higher levels)
6. **Practice Arena** — test what-if scenarios with overrides against sparring bots or own robots

In practice, once a player has chosen their weapon(s) and initial stance, the only regular per-battle decisions are stance and yield threshold. That's two controls. Attribute upgrades are occasional credit sinks, not per-battle decisions. The Practice Arena is a sandbox with no stakes.

### Why this matters

The "Adjust" step is where player agency lives. If there's nothing meaningful to adjust, the loop becomes passive: log in → check results → log out. The game plays itself. Players who want to engage more deeply have nowhere to put that energy.

### Timing context

Battles happen on a cron schedule with at least 4 hours between them. Players have time to make decisions — the problem isn't time pressure, it's that there aren't enough decisions worth making.

---

## What Would Make "Adjust" Meaningful?

The goal is to give players more decisions between battles that feel consequential — without adding complexity that overwhelms casual players or breaks the automated battle flow.

### Principle: Decisions, Not Busywork

A good "Adjust" decision has these properties:
- **Consequential**: It affects the next battle outcome in a way the player can reason about
- **Informed**: The player has enough information to make a non-random choice
- **Reversible**: Bad decisions can be corrected without catastrophic cost (unlike weapon purchases today)
- **Optional**: Casual players can ignore it and still compete; engaged players get an edge

---

## Ideas

### 1. Flex-Point Attribute Bucket (already backlog #9) — ✅ Specced & Implemented as Spec #25

A percentage of attribute points becomes a flexible pool reallocated before each battle. This is the most direct fix — it turns the static 23-attribute build into a per-battle tactical decision.

**This idea has been specced and implemented as the Tuning Pool (Tactical Tuning) system in [Spec #25](/.kiro/specs/to-do/25-tuning-bay/).** The implementation uses a bonus-point pool (10 free, up to 110 with Tuning Bay facility) rather than reallocating existing attribute points. Per-attribute caps (academyCap + 5 - base) prevent stacking. Allocations persist until changed. See `docs/game-systems/TUNING_BAY_SYSTEM.md` for the full system specification.

**Impact on core loop**: High. Adds a meaningful per-battle decision that rewards scouting and opponent reading. The "Adjust" step becomes "look at my next opponent, reallocate tuning points to counter their build."

**Dependency**: Needs opponent visibility (scouting) to be meaningful — otherwise you're allocating blind. Could work with just league/ELO information ("I'm facing a higher-ELO opponent, shift points to defense") but richer with actual stat visibility.

### 2. Stance Depth — Beyond Three Options

Currently stance is a single axis: offensive / defensive / balanced. What if stance had more dimensions?

**Sub-stances or stance modifiers**: Instead of one global stance, break it into components:
- **Aggression**: How aggressively the robot engages (affects hit chance vs evasion trade-off)
- **Target priority**: Focus on damage vs focus on survival (affects weapon selection logic in combat)
- **Yield behavior**: Already exists as yield threshold, but could be richer — yield when outmatched vs fight to the death vs yield when ahead to preserve HP for next battle

This turns one 3-way toggle into 2–3 sliders, each with meaningful trade-offs. A player who studies their opponent's style can tune their approach.

**Risk**: Could feel like busywork if the combat simulator doesn't make these choices matter enough. Each dimension needs to produce visibly different battle outcomes.

**Impact on core loop**: Medium. More knobs to turn, but only valuable if the combat simulator makes them consequential.

### 3. Pre-Battle Orders / Conditional Tactics

Instead of a static configuration, let players set conditional instructions:
- "If opponent ELO > mine by 100+, switch to defensive stance"
- "If HP drops below 30%, increase aggression" (already partially in combat AI?)
- "Focus shield-breaking attacks if opponent has high shield"

This is the Robot AI Scripting idea (#32) in a lightweight form. Instead of a full scripting language, offer 3–5 pre-built conditional slots with dropdowns.

**Risk**: Complexity. This is a mini-programming interface. Could overwhelm casual players. Needs to be optional and have good defaults.

**Impact on core loop**: High for engaged players, invisible for casual ones. The "Adjust" step becomes "program my robot's battle plan based on what I know about the opponent."

### 4. Battle Preparation Actions (Resource-Based)

Introduce per-battle preparation that costs something (credits, time, a limited resource):
- **Scouting report**: Pay credits to get detailed intel on your next opponent's stats and recent performance. Makes flex-point allocation and stance choice more informed.
- **Field maintenance**: Pay credits to get a small temporary HP/shield boost for the next battle. Creates a "do I invest in this fight or save credits?" decision.
- **Weapon tuning**: Pay credits to temporarily boost one weapon stat for the next battle. Cheaper than buying a new weapon, but not free.

**Risk**: Could feel pay-to-win if the bonuses are too large. Needs to be small enough that skill (build quality, stance choice) still dominates.

**Impact on core loop**: Medium. Adds economic decisions to the pre-battle phase. The "Adjust" step becomes "how much do I invest in preparing for this specific fight?"

### ~~5. Per-Match Stance/Yield Overrides~~ (rejected)

Players already see upcoming matches with opponent details. Matches are at least 4 hours apart, and league matches get scheduled after the cycle run — giving up to 24 hours to prepare. Players can already change stance and yield threshold manually between battles with plenty of time. A per-match override UI is a convenience wrapper around something that's already trivially doable. Rejected — solves nothing.

### 6. Weapon Experimentation (already backlog #5)

The weapon lock-in problem is a core loop issue. If players could try weapons in the Practice Arena before buying, or sell weapons back at a loss, the "Adjust" step would include "should I change my weapon loadout?" as a real decision instead of a one-time permanent choice.

Already well-documented in the backlog. Not duplicated here.

**Impact on core loop**: High. Unlocks the entire weapon catalog as a decision space instead of a one-time choice.

---

## Evaluation: What Moves the Needle Most?

| Idea | Impact | Effort | Dependencies | Risk |
|------|--------|--------|-------------|------|
| Flex-Point Attributes (#9) | High | Medium-Large | None critical | Balance complexity |
| Weapon Experimentation (#5) | High | Medium | Economy design | Devalues existing purchases |
| Stance Depth | Medium | Medium | Combat simulator changes | Could feel like busywork |
| Pre-Battle Orders | High (engaged) | Large | Combat AI rework | Complexity for casuals |
| Battle Preparation Actions | Medium | Medium | Economy balancing | Pay-to-win perception |

### Recommended priority

**Do first: Weapon Experimentation (#5 in backlog)**  
Already identified as high priority. Unlocking weapon switching opens the largest new decision space in the Adjust step. Without this, the weapon choice is permanent and the Adjust step stays thin regardless of what else we add.

**Do second: Flex-Point Attributes (#9 in backlog)**  
The biggest single improvement to the Adjust step. Turns the static 23-attribute build into a per-battle tactical decision. Players already have 24 hours between league matches and can see their opponent — plenty of time to think about how to allocate flex points.

**Defer: Stance Depth, Pre-Battle Orders, Battle Preparation Actions**  
These add complexity that should wait until the first two are in and we can evaluate whether the core loop needs more knobs or fewer.

---

## Open Questions

1. Weapon experimentation (#5) and flex-points (#9) are both already in the backlog — should the Game Loop Audit formally recommend their priority order, or are they independent enough to spec in parallel?
2. How does flex-point allocation work for KotH (6 opponents, you don't know who you'll face) and Tag Team (team-level coordination)?
3. Does the Practice Arena need enhancement to support "try before you buy" weapon experimentation, or is the existing what-if override system sufficient?
4. Is stance depth worth exploring further, or are three options (offensive/defensive/balanced) enough if the other decisions (flex-points, weapons) are richer?
