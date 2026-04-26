# Product Requirements Document: Achievement & Milestone System

**Last Updated**: April 20, 2026
**Status**: ✅ Implemented (Spec #27)
**Owner**: Robert Teunissen
**Epic**: Achievement System (Backlog #8) + Game Loop 4 Audit (Backlog #6)
**Priority**: Tier 2 — Build Next (WSJF rank #6, 3 player votes)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement — Loop 4](#problem-statement--loop-4)
3. [Design Direction](#design-direction)
4. [Difficulty Tiers & Rewards](#difficulty-tiers--rewards)
5. [Achievement Catalog](#achievement-catalog)
6. [Badge Design Specification](#badge-design-specification)
7. [Display Locations & UI](#display-locations--ui)
8. [Data Model](#data-model)
9. [API Endpoints](#api-endpoints)
10. [Trigger Mechanism](#trigger-mechanism)
11. [Retroactive Awards](#retroactive-awards)
12. [Open Questions](#open-questions)
13. [Related Documentation](#related-documentation)

---

## Executive Summary

Add an achievement system that turns invisible prestige/fame accumulation into celebrated milestones with credit and prestige rewards, collectible badges, and progress tracking. Achievements are grouped into Easy/Medium/Hard/Very Hard/Secret tiers — the full set is explicitly **uncompletable in a single season**. Each achievement has a unique badge (hexagonal, industrial theme, greyed out when locked) displayed on the stable page and a dedicated achievements page.

This directly addresses **Loop 4 (Reputation Loop)** from the Game Loop Audit (#6): today prestige and fame are one-way accumulators with no celebration moments. Achievements provide the "dopamine hit" layer on top of the existing economic backbone.

---

## Problem Statement — Loop 4

### What Loop 4 Looks Like Today

**Win → prestige/fame number goes up → nothing happens → repeat.**

Prestige and fame are mechanically sound (smooth income scaling, facility gates, streaming revenue) but experientially invisible. Players don't feel progression because there are no milestone moments, no celebrations, no intermediate goals.

### Real-World Data (ACC Server, ~17 cycles)

- Top prestige: 860 (Ultron Inc). Everyone is still Novice rank. Nobody has hit the first battle winnings bonus tier at 1,000.
- Top fame: 1,234 (Ultron, Renowned tier). Most active robots are in the 300–500 range (Known tier).
- Multi-robot stables accumulate prestige faster through volume; single-robot stables concentrate fame. This split is working as intended.

### What Achievements Fix

- **Punctuated moments**: Instead of prestige silently ticking from 999 to 1,000, the player gets a toast: "🏆 Established — Your stable's reputation precedes you. +₡75,000."
- **Intermediate goals**: "I'm 12 wins away from Centurion" gives players something to work toward between cycles.
- **Visible progression**: A badge grid on the stable page shows other players (and yourself) how far you've come.
- **Social proof**: Other players see your achievement showcase when visiting your stable.

### Design Decision from Prestige & Fame Exploration

Per the [Prestige & Fame Design Exploration](../analysis/PRESTIGE_FAME_DESIGN_EXPLORATION.md): achievements are the recommended vehicle for milestone celebrations for *both* prestige and fame, rather than building separate milestone systems. This simplifies the design:

- **Prestige**: Smooth economic scaling + facility gates (no milestone unlocks of its own)
- **Fame**: Smooth streaming scaling + cosmetic identity (titles, visual indicators — future work)
- **Achievements**: The milestone/celebration system that triggers on prestige thresholds, fame thresholds, combat accomplishments, and economic milestones

---

## Design Direction

### Principles

1. **Celebrate, don't gate**: Achievements reward accomplishments — they don't unlock gameplay mechanics.
2. **Credits + prestige rewards, not combat power**: No achievement makes you stronger in battle. Rewards are economic (credits, prestige).
3. **Quirky and referential**: Achievement names reference famous robots, sci-fi, and gaming culture. Puns encouraged.
4. **Uncompletable in one season**: The Very Hard tier alone requires months of sustained play. Completionists need multiple seasons.
5. **Retroactive on launch**: Existing ACC players get all achievements they've already qualified for. Positive first impression.
6. **Every achievement has a badge**: Hexagonal, industrial-themed, greyed out when locked, full color when unlocked.

### What Achievements Are NOT

- Not a combat bonus system (no "win more" mechanics)
- Not a currency (you don't spend achievements)
- Not a gating mechanism (no "unlock feature X at 10 achievements")
- Not a leaderboard (no ranking by achievement count — though total count is visible)

---

## Difficulty Tiers & Rewards

| Tier | Credits | Prestige | Badge Border Color | Design Intent |
|---|---|---|---|---|
| 🟢 **Easy** | ₡25,000 | +25 | Green (`#3fb950`) | First-session dopamine. Most earned in week 1. |
| 🔵 **Medium** | ₡50,000 | +50 | Blue (`#58a6ff`) | Weeks 2–6. Requires commitment. |
| 🟠 **Hard** | ₡100,000 | +100 | Orange/Amber (`#d29922`) | Months of play. Bragging rights. |
| 🔴 **Very Hard** | ₡250,000 | +250 | Red (`#f85149`) | Multi-season grind. Legendary status. |
| ⬛ **Secret** | ₡50,000 (default) | +50 (default) | Purple (`#a371f7`) | Hidden until earned. Surprise moments. |

The tier distribution is maintained in the achievement config file. The full set is designed to be uncompletable within a single season.

---

## Achievement Catalog

### 🤖 Combat — Robot-Level

Triggered by individual robot performance. The achievement is earned by the player *through* a specific robot.

| ID | Name | Reference | Tier | Trigger Condition | Badge Icon Concept |
|---|---|---|---|---|---|
| C1 | **"I'll Be Back"** | Terminator | 🟢 Easy | Win your first battle | Robotic hand giving thumbs-up |
| C2 | **"Danger, Will Robinson!"** | Lost in Space | 🟢 Easy | Lose your first battle | Robot with flailing arms |
| C3 | **"Bite My Shiny Metal Badge"** | Bender, Futurama | 🟢 Easy | Complete 10 battles on one robot | Shiny metallic badge/medal |
| C4 | **"By Your Command"** | Cylons, BSG | 🔵 Medium | Win 25 battles on one robot | Single red scanning eye |
| C5 | **"Hasta La Vista, Baby"** | Terminator 2 | 🔵 Medium | Destroy an opponent (0 HP) 25 times on one robot | Sunglasses on a skull |
| C6 | **"I Am Iron Man"** | Iron Man / Marvel | 🟠 Hard | Win 50 battles on one robot | Iron Man-style helmet silhouette |
| C7 | **"Exterminate!"** | Daleks, Doctor Who | 🟠 Hard | Destroy opponents 50 times on one robot | Dalek dome silhouette |
| C8 | **"I, Robot"** | Asimov / movie | 🔴 Very Hard | Win 100 battles on one robot | Open book with robot eye |
| C9 | **"Flawless Victory"** | Mortal Kombat | 🟢 Easy | Win a battle with 100% HP (perfect victory) | Glowing shield with checkmark |
| C10 | **"It's Just a Flesh Wound"** | Monty Python (Black Knight) | 🔵 Medium | Win a battle with <10% HP remaining | Armless knight silhouette |
| C11 | **"Never Tell Me the Odds"** | Han Solo, Star Wars | 🟠 Hard | Win against an opponent 150+ ELO above you (league or tournament only) | Dice showing double sixes |
| C12 | **"Resistance Is Futile"** | Borg, Star Trek | 🟠 Hard | Win 10 consecutive league battles (via battle history) | Borg cube silhouette |
| C13 | **"Look What They Need to Mimic a Fraction of Our Power"** | Omni-Man, Invincible | 🔴 Very Hard | Win 15 consecutive league battles | Floating figure looking down |
| C14 | **"Do You Yield?"** | General combat trope | 🟢 Easy | Force an opponent to yield for the first time | White flag icon |
| C15 | **"I Didn't Hear No Bell"** | Rocky / meme | 🟢 Easy | Win a battle after losing the previous battle on the same robot | Boxing bell with crack |
| C16 | **"Wax On, Wax Off"** | Karate Kid | 🟢 Easy | Fight 25 practice arena battles | Wax-on hand motion circle |
| C17 | **"There Is No Spoon"** | The Matrix | ⬛ Secret | Win a battle while having 0 tuning points allocated | Bent spoon |
| C18 | **"Autobots, Roll Out!"** | Optimus Prime, Transformers | 🟠 Hard | Win at least one battle in each mode: league, KotH, tag team, and tournament | Truck transforming silhouette |
| C19 | **"Peace Through Tyranny"** | Megatron, Transformers | ⬛ Secret | Win a battle after being at <5% HP at any point during the fight | Cannon arm silhouette |

### 🏆 League & Competition — Robot-Level

Triggered by league progression, tournament results, and competitive milestones.

| ID | Name | Reference | Tier | Trigger Condition | Badge Icon Concept |
|---|---|---|---|---|---|
| L1 | **"Silver Surfer"** | Marvel Comics | 🟢 Easy | Reach Silver league | Surfboard silhouette, silver |
| L2 | **"Heart of Gold"** | Hitchhiker's Guide | 🔵 Medium | Reach Gold league | Heart shape, gold metallic |
| L3 | **"Heavy Metal"** | Music / material | 🔵 Medium | Reach Platinum league | Guitar pick, platinum sheen |
| L4 | **"Shine On You Crazy Diamond"** | Pink Floyd | 🟠 Hard | Reach Diamond league | Prism with light refraction |
| L5 | **"We Are the Champions"** | Queen | 🔴 Very Hard | Reach Champion league | Crown with musical notes |
| L6 | **"King of the Hill"** | TV show / game mode | 🟢 Easy | Win your first KotH match (1st place) | Hill with flag on top |
| L7 | **"Lord of the Hill"** | Expanded KotH reference | 🔵 Medium | Win 10 KotH matches (1st place) | Hill with crown on flag |
| L8 | **"WALL-E and EVE"** | WALL-E, Pixar | 🟢 Easy | Win your first Tag Team battle | Two robots holding hands |
| L9 | **"The Megazord"** | Power Rangers | 🟠 Hard | Win 25 Tag Team battles | Combined robot silhouette |
| L10 | **"There Can Be Only One"** | Highlander | 🔵 Medium | Win a tournament | Sword with lightning |
| L11 | **"Thunderdome"** | Mad Max | 🔴 Very Hard | Win 3 tournaments | Dome arena silhouette |
| L12 | **"ELO-quent"** | Pun on ELO + eloquent | 🔵 Medium | Reach 1400 ELO on any robot | Speech bubble with "1400" |
| L13 | **"Over 9000!"** | Dragon Ball Z (adapted) | 🟠 Hard | Reach 1600 ELO on any robot | Scouter device cracking |
| L14 | **"The Chosen One"** | The Matrix / trope | 🔴 Very Hard | Reach 1800 ELO on any robot | Glowing figure silhouette |
| L15 | **"Tag, You're It!"** | Playground game | 🟢 Easy | Win a tag team battle where the reserve robot tagged in | Hand reaching out to tag |
| L16 | **"Dynamic Duo"** | Batman & Robin | 🔴 Very Hard | Win 40 tag team battles | Two silhouettes back-to-back |
| L17 | **"I Work Alone"** | Batman / lone wolf trope | 🔵 Medium | Win a tag team battle where your active robot destroyed both opponents without tagging out | Single figure with crossed arms |

### 💰 Economy & Stable — User-Level

Triggered by stable-wide economic activity, facility ownership, and roster management.

| ID | Name | Reference | Tier | Trigger Condition | Badge Icon Concept |
|---|---|---|---|---|---|
| E1 | **"Hello World"** | Programming | 🟢 Easy | Complete onboarding | Terminal cursor blinking |
| E2 | **"The Odds Are 725 to 1"** | C-3PO, Star Wars | 🟢 Easy | Earn ₡100,000 total from battles | Golden protocol droid silhouette |
| E3 | **"Show Me the Money"** | Jerry Maguire | 🟠 Hard | Accumulate ₡5,000,000 in your balance at once | Money bag with dollar sign |
| E4 | **"Scrooge McDuck"** | DuckTales | 🟠 Hard | Earn ₡25,000,000 lifetime from all sources | Duck diving into coins |
| E5 | **"Buy the Dip"** | Finance meme | 🟢 Easy | Purchase your first weapon | Shopping cart with weapon |
| E6 | **"Arsenal"** | Military / football club | 🔵 Medium | Own 10 weapons simultaneously | Weapon rack, full |
| E7 | **"Mall Cop"** | Paul Blart / pun | 🟢 Easy | Buy your first shield | Shield with badge |
| E8 | **"Pimp My Bot"** | Pimp My Ride | 🟢 Easy | Upgrade any robot attribute for the first time | Wrench with sparkle |
| E9 | **"Fully Operational"** | Death Star, Star Wars | 🟠 Hard | Reach an effective stat of 50 on any attribute on a robot (computed via `calculateEffectiveStatsWithStance`: base + weapon bonuses + tuning + loadout + stance) | Attribute bar at 100% |
| E10 | **"The Architect"** | The Matrix | 🟠 Hard | Own 3 facilities at level 3+ | Blueprint with buildings |
| E11 | **"Megacorp"** | Sci-fi trope | 🔴 Very Hard | Own 5 facilities at level 3+ | Corporate tower skyline |
| E12 | **"Skynet Is Online"** | Terminator | 🔵 Medium | Own 3 robots simultaneously | Network of connected nodes |
| E13 | **"Robot Army"** | General sci-fi | 🟠 Hard | Own 5 robots simultaneously | Army formation silhouette |
| E14 | **"Rise of the Machines"** | Terminator 3 | 🔴 Very Hard | Own 7 robots simultaneously | Robots marching in formation |
| E15 | **"Fine-Tuned Machine"** | Common phrase / Tuning Bay | 🟢 Easy | Allocate tuning points on any robot for the first time | Tuning dial/knob |
| E16 | **"Overclocked"** | PC gaming term | 🔵 Medium | Allocate 50+ tuning points on a single robot (requires Tuning Bay facility) | CPU chip with flames |
| E17 | **"Bankrupt!"** | Monopoly / economy | ⬛ Secret | Have your balance drop below ₡0 from daily operating costs | Broken piggy bank |

### 🌟 Prestige & Fame — Mixed Level

Triggered by prestige thresholds (user-level) and fame thresholds (robot-level). These are the achievements that directly fix Loop 4.

| ID | Name | Reference | Tier | Trigger Condition | Scope | Badge Icon Concept |
|---|---|---|---|---|---|---|
| P1 | **"Established"** | Prestige rank title | 🔵 Medium | Reach 1,000 prestige | User | Star with "Est." ribbon |
| P2 | **"Veteran"** | Prestige rank title | 🟠 Hard | Reach 5,000 prestige | User | Chevron stripes |
| P3 | **"Elite"** | Prestige rank title | 🔴 Very Hard | Reach 10,000 prestige | User | Eagle emblem |
| P4 | **"Legendary"** | Prestige rank title | 🔴 Very Hard | Reach 25,000 prestige | User | Dragon silhouette |
| P5 | **"15 Minutes of Fame"** | Andy Warhol quote | 🟢 Easy | Robot reaches 100 fame (Known tier) | Robot | Clock showing 0:15 |
| P6 | **"Famous Last Words"** | Common phrase | 🔵 Medium | Robot reaches 500 fame (Famous tier) | Robot | Microphone with stars |
| P7 | **"Legendary Status"** | Fame tier | 🟠 Hard | Robot reaches 2,500 fame (Legendary tier) | Robot | Star on Walk of Fame |
| P8 | **"Mythical Proportions"** | Fame tier | 🔴 Very Hard | Robot reaches 5,000 fame (Mythical tier) | Robot | Greek column with laurel |
| P9 | **"Influencer"** | Modern culture | 🟢 Easy | Earn ₡100,000 total streaming revenue across all robots | User | Camera/phone with hearts |
| P10 | **"Content Creator"** | Modern culture | 🟠 Hard | Earn ₡1,000,000 total streaming revenue | User | Play button with crown |

### 🎲 Style & Quirky — Robot-Level

Triggered by specific playstyle choices, loadout configurations, and unusual battle outcomes.

| ID | Name | Reference | Tier | Trigger Condition | Badge Icon Concept |
|---|---|---|---|---|---|
| S1 | **"Bleep Bloop"** | Robot stereotype | 🟢 Easy | Equip a robot with an energy weapon | Lightning bolt |
| S2 | **"Get to the Choppa"** | Predator / Arnold | 🟢 Easy | Equip a robot with a ballistic weapon | Bullet casing |
| S3 | **"Sword Art Online"** | Anime series | 🟢 Easy | Equip a robot with a melee weapon | Crossed swords |
| S4 | **"Dual Wielding Intensifies"** | Gaming meme | 🔵 Medium | Win 10 battles with dual-wield loadout | Two crossed pistols |
| S5 | **"Turtle Mode Activated"** | Gaming strategy | 🔵 Medium | Win 10 battles on defensive stance | Turtle shell |
| S6 | **"LEEROY JENKINS!"** | WoW meme | 🔵 Medium | Win 10 battles on offensive stance | Charging figure, mouth open |
| S7 | **"Perfectly Balanced"** | Thanos, Avengers | 🔵 Medium | Win 10 battles on balanced stance | Scales in equilibrium |
| S8 | **"No Retreat, No Surrender"** | Movie title / phrase | 🟠 Hard | Win a battle with yield threshold set to 0% | Spartan helmet |
| S9 | **"Glass Cannon"** | RPG archetype | ⬛ Secret | Deal 500+ damage in a battle but finish with <5% HP | Cracked cannon |
| S10 | **"Overkill"** | Gaming term | ⬛ Secret | Win a battle in under 5 seconds | Explosion with stopwatch |
| S11 | **"R2-D2 Would Be Proud"** | Star Wars | ⬛ Secret | Win a tag team battle as the reserve robot (tagged in to save the day) | Astromech droid silhouette |
| S12 | **"Johnny 5 Is Alive!"** | Short Circuit | ⬛ Secret | Have a robot survive 50 battles (totalBattles minus times destroyed ≥ 50) | Lightning bolt + heart |
| S13 | **"Dead or Alive, You're Coming With Me"** | RoboCop | 🔵 Medium | Force 10 opponents to yield (cumulative, any robot) | Visor silhouette |
| S14 | **"Brain the Size of a Planet"** | Marvin, Hitchhiker's Guide | ⬛ Secret | Lose 10 battles in a row on a single robot | Depressed robot silhouette |

---

## Badge Design Specification

### Dimensions & Format

- **Size**: 128×128px (display at 64×64 in lists, 128×128 in detail views)
- **Format**: SVG preferred (scalable), WebP fallback at 128px and 64px
- **Background**: Transparent

### Visual Structure

Every badge follows the same hexagonal frame structure:

```
┌─────────────────────────┐
│  ╭───────────────────╮  │  ← Outer border ring (tier color, 4px)
│  │                   │  │
│  │    [ICON AREA]    │  │  ← Central icon (64×64 area)
│  │                   │  │     Monochrome metallic when locked
│  │                   │  │     Full color when unlocked
│  ╰───────────────────╯  │
│         ▔▔▔▔▔▔▔         │  ← Tier pip (small dot, tier color)
└─────────────────────────┘
```

### Badge Shape

- **Hexagonal** outer frame (fits the industrial/mechanical theme of the game)
- 4px border in the tier color
- Inner area: dark metallic background (`#1a1f29` — design system `surface` color)
- Central icon: simplified, single-concept, max 3 colors

### Tier Color Mapping

Border ring and tier pip use the design system's semantic colors:

| Tier | Border Color | Hex | Design System Token |
|---|---|---|---|
| 🟢 Easy | Green | `#3fb950` | `--success` |
| 🔵 Medium | Blue | `#58a6ff` | `--primary` |
| 🟠 Hard | Orange/Amber | `#d29922` | `--warning` |
| 🔴 Very Hard | Red | `#f85149` | `--error` |
| ⬛ Secret | Purple | `#a371f7` | `--info` |

### Locked State (Not Yet Achieved)

- Entire badge rendered in **monochrome grayscale** via CSS filter (no separate image needed)
- Border ring: `#57606a` (`text-tertiary`)
- Icon: `#3a3f47` (barely visible silhouette)
- Opacity: 40%
- Tooltip on hover: achievement name + "???" for secret achievements, or progress hint for known ones ("12/50 wins")

### Unlocked State

- Full color icon
- Tier-colored border ring
- Subtle inner glow matching tier color (2px spread, 20% opacity)
- On unlock moment: 300ms scale-in animation (0.95 → 1.0, ease-out) — respects `prefers-reduced-motion`

### Icon Style Guide

- **Flat design**, not 3D or photorealistic
- **Metallic palette**: use the design system's dark industrial colors as base
- **Max 3 accent colors** per icon (drawn from the design system palette)
- **Bold silhouettes** that read clearly at 64×64px
- **No text inside the icon** — the name goes below the badge externally
- References should be **suggestive, not literal** (avoid copyright issues — a "scanning red eye" not a literal Cylon, a "bent spoon" not a literal Matrix scene)

### SVG Template

Base template for all badges — swap the inner `<g>` per achievement:

```svg
<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <!-- Hexagonal frame -->
  <polygon points="64,4 120,34 120,94 64,124 8,94 8,34"
    fill="#1a1f29" stroke="TIER_COLOR" stroke-width="4"/>
  <!-- Inner icon group (swap per achievement) -->
  <g transform="translate(32,32)">
    <!-- 64×64 icon content here -->
  </g>
  <!-- Tier pip -->
  <circle cx="64" cy="118" r="4" fill="TIER_COLOR"/>
</svg>
```

### File Naming Convention

Following the existing asset naming pattern from the design system, achievement images are stored alongside other game assets in the frontend source directory:

```
app/frontend/src/assets/achievements/
  achievement-c1-128.webp        (rasterized, 128px)
  achievement-c1-64.webp         (rasterized, 64px — optional)
```

This matches the project convention: `src/assets/` holds game assets (robots, weapons, facilities, achievements) imported via Vite, while `public/` is reserved for user-uploaded content. Locked variants are generated via CSS — no separate locked image files needed.

### Generating Badges — Recommended Approach

**Option A: AI Image Generation (fastest for 63 badges)**

Use a consistent prompt template with an image generation tool (Midjourney, DALL-E, or Stable Diffusion):

```
Prompt template:
"Flat vector icon, hexagonal badge, dark metallic background (#1a1f29),
[ICON DESCRIPTION], [TIER COLOR] border glow, industrial sci-fi style,
128x128px, transparent background, minimal detail, bold silhouette,
no text, dark theme"

Example for C1 "I'll Be Back":
"Flat vector icon, hexagonal badge, dark metallic background (#1a1f29),
robotic hand giving thumbs up, green (#3fb950) border glow,
industrial sci-fi style, 128x128px, transparent background,
minimal detail, bold silhouette, no text, dark theme"
```

Post-process each output:
1. Crop/resize to exactly 128×128
2. Apply hexagonal mask
3. Add tier-colored border ring (4px)
4. Export as WebP (unlocked)
5. Optionally trace to SVG for scalability

**Option B: SVG Template + Manual Design (most consistent)**

1. Create the hexagonal SVG template (above)
2. Design each icon inside the 64×64 inner area using Figma, Illustrator, or Inkscape
3. Export: SVG → WebP 128px → WebP 64px

**Option C: Hybrid (recommended)**

1. Build the SVG hexagonal template (Option B)
2. Generate inner icons via AI (Option A prompt, but just the icon, no frame)
3. Composite: place AI-generated icon inside the SVG template
4. Manual touch-up for any icons that don't read well at 64px
5. Export pipeline: SVG → WebP 128px → WebP 64px

### CSS for Locked/Unlocked States

Only one image per badge is needed. The locked state is pure CSS:

```css
/* Locked badge */
.achievement-badge--locked {
  filter: grayscale(100%) brightness(0.4);
  opacity: 0.4;
}

/* Unlocked badge */
.achievement-badge--unlocked {
  filter: none;
  opacity: 1;
}

/* Unlock animation (toast notification moment) */
@keyframes achievement-unlock {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.achievement-badge--just-unlocked {
  animation: achievement-unlock 300ms ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .achievement-badge--just-unlocked {
    animation: none;
  }
}
```

---

## Display Locations & UI

### 1. Stable Page — Achievement Showcase (Public)

A new section on the stable page (`StableViewPage`), visible to all players visiting any stable. Sits between the "Stable Statistics" and "Robots" sections.

**Pinned Favourites Row**

Players select up to **6 favourite achievements** to pin to their stable showcase. These are the badges other players see first — your curated "trophy wall."

- 6 hexagonal badge slots in a horizontal row
- Empty slots show a faint hexagonal outline (`border-dashed border-white/20`)
- Unlocked badges display at 64×64 with tier-colored border
- Hovering a badge shows a tooltip: achievement name, description, unlock date
- Below the row: "42/63 Achievements · View all →" link to `/achievements`

**Own Stable View (editing mode)**

When viewing your own stable, each pinned slot has a small "×" to unpin and empty slots show a "+" button that opens a picker modal. The picker shows all unlocked achievements as a grid — click one to pin it.

**Data**: The 6 pinned achievement IDs are stored on the User model (see [Data Model](#data-model)). The `GET /api/stables/:userId` endpoint includes the pinned achievements in its response.

### 2. Dedicated Achievement Page (`/achievements`)

The player's personal achievement tracker. Not publicly visible — only the owner sees their full progress. Other players see the pinned showcase on the stable page.

**Layout**: Scrollable list of all achievements with filter and sort controls (categories are internal metadata — not shown as tabs to players).

**Each achievement card shows:**

- **Badge** (locked/greyed or unlocked/colored) at 64×64
- **Name** and one-line description
- **Progress indicator** (see below)
- **Reward preview**: "₡75,000 + 25 prestige" (greyed out if locked, highlighted if unlocked)
- **Unlock date** (if earned): "Unlocked Apr 12, 2026"
- **Rarity indicator**: "Earned by 3 of 16 players (19%)" — see [Rarity & Social Proof](#rarity--social-proof)
- **Pin button**: ⭐ toggle to add/remove from stable showcase favourites (max 6)

**Progress Indicator**

Every achievement with a numeric threshold shows a progress bar with exact numbers:

| Achievement Type | Progress Display |
|---|---|
| Win count (e.g. C4: 50 wins) | Progress bar + "34 / 50 wins" |
| Kill count (e.g. C5: 25 destroys) | Progress bar + "18 / 25 destroyed" |
| ELO threshold (e.g. L12: 1500) | Progress bar + "1,387 / 1,500 ELO" |
| Credit threshold (e.g. E3: ₡5M) | Progress bar + "₡3,290,028 / ₡5,000,000" |
| Prestige threshold (e.g. P1: 1,000) | Progress bar + "742 / 1,000 prestige" |
| Fame threshold (e.g. P6: 500) | Progress bar + "390 / 500 fame" |
| Facility count (e.g. E10: 3 at L5+) | Progress bar + "1 / 3 facilities at level 5+" |
| Robot count (e.g. E12: 3 robots) | Progress bar + "2 / 3 robots" |
| Boolean / one-time (e.g. C9: perfect victory) | No bar — just "Not yet achieved" or unlock date |
| Secret (hidden) | "???" — no progress shown until earned |

Progress bars use the tier color as the fill color (green for Easy, blue for Medium, etc.) on a `bg-surface-elevated` track.

For **robot-level achievements**, progress shows the *best* robot's progress. Example: if you have 3 robots with 12, 34, and 8 wins respectively, C4 ("By Your Command" — 50 wins) shows "34 / 50 wins" with a note "(best: RobotName)".

**Filters:**
- By tier: Easy / Medium / Hard / Very Hard / Secret
- By status: All / Locked / Unlocked

**Secret achievements** show as "???" with a locked purple badge and no progress bar until earned. Once earned, they reveal normally.

### 3. Rarity & Social Proof

Every achievement displays how many players have earned it, giving context on whether you're ahead of the pack or catching up.

**Display format**: "Earned by 3 of 16 players (19%)" — shown on the achievement detail card on the `/achievements` page.

**Rarity labels** (based on percentage of active players who have it):

| % of Players | Label | Color |
|---|---|---|
| > 75% | Common | `text-secondary` (grey) |
| 25–75% | Uncommon | `text-success` (green) |
| 10–25% | Rare | `text-primary` (blue) |
| 1–10% | Epic | `text-warning` (amber) |
| < 1% or 0 | Legendary | `text-error` (red) |

**Data source**: `SELECT achievement_id, COUNT(*) FROM user_achievements GROUP BY achievement_id` — cached and refreshed every cycle (not real-time). Total active player count from `User` table (players with at least 1 battle).

**On the stable page showcase**: Rarity labels are *not* shown on the pinned badges (too noisy). Only on the dedicated `/achievements` page.

### 4. Toast Notification (Post-Battle)

When an achievement unlocks after a battle:
- Slide-in toast from top-right with badge icon (48×48), achievement name, reward summary, and rarity label
- Auto-dismiss after 5 seconds
- Stacks if multiple achievements unlock simultaneously (common on first login after retroactive awards)
- Clicking the toast navigates to the achievement on `/achievements`

### 5. Battle Report Integration

In the "Battle Outcomes" section of the battle report, show any achievements earned from that battle as a small badge row below the rewards.

---

## Data Model

### Achievement Definitions — Config File

Achievement definitions live in a config file (`src/config/achievements.ts`), not in the database. They change with game updates, not at runtime.

```typescript
interface AchievementDefinition {
  id: string;                    // "C1", "L5", "E3", etc.
  name: string;                  // "I'll Be Back"
  description: string;           // "Win your first battle"
  reference: string;             // "Terminator"
  category: 'combat' | 'league' | 'economy' | 'prestige' | 'style';
  tier: 'easy' | 'medium' | 'hard' | 'very_hard' | 'secret';
  scope: 'user' | 'robot';      // Who earns it
  rewardCredits: number;         // ₡25,000 for easy, etc.
  rewardPrestige: number;        // +25 for easy, etc.
  hidden: boolean;               // true for secret achievements
  // Trigger metadata (used by AchievementService)
  triggerType: string;           // "wins", "elo", "prestige", "fame", etc.
  triggerThreshold?: number;     // Numeric threshold if applicable
  // Progress tracking
  progressType: 'numeric' | 'boolean'; // Whether progress bar is shown
  progressLabel?: string;        // "wins", "destroyed", "ELO", "prestige", etc.
  badgeIconFile: string;         // "achievement-c1" (without extension)
}
```

### Unlock Records — Database

```prisma
model UserAchievement {
  id            Int      @id @default(autoincrement())
  userId        Int      @map("user_id")
  achievementId String   @map("achievement_id") @db.VarChar(10) // "C1", "L5", etc.
  robotId       Int?     @map("robot_id") // Which robot earned it (null for user-level)
  unlockedAt    DateTime @default(now()) @map("unlocked_at")

  user  User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  robot Robot? @relation(fields: [robotId], references: [id], onDelete: SetNull)

  @@unique([userId, achievementId])
  @@index([userId])
  @@index([robotId])
  @@index([achievementId])
  @@map("user_achievements")
}
```

The `robotId` is optional — it tracks *which* robot earned a robot-level achievement (for display purposes like "C6 earned by Ultron"). User-level achievements leave it null.

### Pinned Achievements — User Model Extension

Add a JSON field to the User model for the 6 pinned favourite achievement IDs:

```prisma
// Add to User model
pinnedAchievements Json @default("[]") @map("pinned_achievements") // Array of up to 6 achievement IDs, e.g. ["C1", "L5", "P1"]
```

Validated at the API layer: max 6 entries, each must be a valid achievement ID that the user has actually unlocked. Attempting to pin a locked achievement returns 400.

### Rarity Cache — In-Memory or Lightweight Table

Achievement rarity counts (how many players have earned each achievement) are cached and refreshed once per cycle during settlement, not computed on every request.

**Option A (recommended for current scale)**: In-memory cache in the `AchievementService` singleton, refreshed on startup and after each cycle settlement.

```typescript
// Cached in AchievementService
interface AchievementRarityCache {
  counts: Map<string, number>;    // achievementId → number of players who earned it
  totalActivePlayers: number;     // Players with at least 1 battle
  refreshedAt: Date;
}
```

**Option B (if scale grows)**: A `AchievementRarity` table updated by a cron job.

### Progress Computation

Progress values are **computed at read time**, not stored. The `/api/achievements` endpoint calculates current progress for each achievement by reading the relevant stat from the User/Robot models:

| Progress Source | Field(s) Read |
|---|---|
| Robot wins | `Robot.wins` (best robot) |
| Robot kills | `Robot.kills` (best robot) |
| Robot ELO | `Robot.elo` (best robot) |
| Robot fame | `Robot.fame` (best robot) |
| Robot battles | `Robot.totalBattles` (best robot) |
| User prestige | `User.prestige` |
| User currency | `User.currency` |
| Facility count at level N+ | `COUNT(Facility WHERE level >= N)` |
| Robot count | `COUNT(Robot WHERE name != 'Bye Robot')` |
| Weapon count | `COUNT(WeaponInventory)` |

This avoids storing redundant progress counters. The query is bounded (one user's data) and runs only when the player opens `/achievements`.

The existing `Robot.titles` field remains untouched — it can be repurposed later for fame cosmetic titles (auto-generated titles from the Prestige & Fame exploration), which are a separate feature from achievements.

---

## API Endpoints

### Player-Facing Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/achievements` | Required | Full achievement catalog with player's progress, unlock status, and rarity data |
| `GET` | `/api/achievements/recent` | Required | Last 10 unlocked achievements (for dashboard widget / notification catch-up) |
| `PUT` | `/api/achievements/pinned` | Required | Update pinned achievement IDs (max 6, must be unlocked) |
| `GET` | `/api/stables/:userId` | Required | Existing endpoint — extended to include `pinnedAchievements` in response |

### `GET /api/achievements` Response Shape

```typescript
interface AchievementsResponse {
  achievements: AchievementWithProgress[];
  summary: {
    total: number;           // 63 (excluding hidden unearned)
    unlocked: number;        // Player's earned count
    byTier: Record<string, { total: number; unlocked: number }>;
  };
  rarity: {
    counts: Record<string, number>;       // achievementId → earner count
    totalActivePlayers: number;
  };
}

interface AchievementWithProgress {
  id: string;
  name: string;
  description: string;
  category: string;
  tier: string;
  rewardCredits: number;
  rewardPrestige: number;
  hidden: boolean;
  // Player-specific
  unlocked: boolean;
  unlockedAt: string | null;
  robotId: number | null;      // Which robot earned it
  robotName: string | null;    // For display: "Earned by Ultron"
  // Progress (null for boolean/one-time achievements)
  progress: {
    current: number;
    target: number;
    label: string;             // "wins", "destroyed", "ELO", etc.
    bestRobotName?: string;    // For robot-level: which robot is closest
  } | null;
  // Pinned
  isPinned: boolean;
}
```

### `PUT /api/achievements/pinned` Request

```typescript
interface PinAchievementsRequest {
  achievementIds: string[];  // Max 6, each must be unlocked by the player
}
```

Validation: returns 400 if more than 6 IDs, if any ID is invalid, or if any achievement is not yet unlocked by the player.

### Stable Endpoint Extension

The existing `GET /api/stables/:userId` response is extended with:

```typescript
// Added to the existing response
{
  // ... existing user, robots, facilities, stats ...
  achievements: {
    pinned: PinnedAchievement[];  // Up to 6
    totalUnlocked: number;
    totalAvailable: number;
  }
}

interface PinnedAchievement {
  id: string;
  name: string;
  tier: string;
  badgeIconFile: string;
  unlockedAt: string;
}
```

---

## Trigger Mechanism

### AchievementService

A centralized `AchievementService` (singleton) with a single entry point:

```typescript
class AchievementService {
  /**
   * Check and award any newly qualified achievements after a game event.
   * Called from post-combat flow and other event handlers.
   */
  async checkAndAward(
    userId: number,
    robotId: number | null,
    event: AchievementEvent
  ): Promise<UnlockedAchievement[]>;
}
```

### Event Types

| Event | Triggered From | Achievements Checked |
|---|---|---|
| `battle_complete` | `battlePostCombat.ts` (after `awardPrestigeToUser` / `awardFameToRobot`) | C1–C17, L7–L15, S4–S12, P5–P10 |
| `league_promotion` | `leagueRebalancingService.ts` | L1–L6 |
| `weapon_purchased` | `routes/weapons.ts` | E5, E6, E7, S1–S3 |
| `weapon_equipped` | `routes/weapons.ts` | E9, S1–S3 |
| `attribute_upgraded` | `routes/robots.ts` | E8, E9 |
| `facility_upgraded` | `routes/facility.ts` | E10, E11 |
| `robot_created` | `routes/robots.ts` | E12, E13, E14 |
| `tuning_allocated` | `routes/tuning.ts` | E15, E16 |
| `stance_changed` | `routes/robots.ts` | E9 |
| `onboarding_complete` | `routes/onboarding.ts` | E1 |
| `prestige_changed` | `battlePostCombat.ts` | P1–P4 |
| `fame_changed` | `battlePostCombat.ts` | P5–P8 |
| `daily_finances` | `economyCalculations.ts` | E16 |
| `practice_battle` | `practiceArenaService.ts` | C16 |
| `tournament_complete` | `tournamentBattleOrchestrator.ts` | L10, L11 |

### Integration Points

The primary hook is in `battlePostCombat.ts`, after the existing `awardPrestigeToUser()` and `awardFameToRobot()` calls:

```typescript
// Existing code
await awardPrestigeToUser(userId, prestigeAmount);
await awardFameToRobot(robotId, fameAmount);

// New: check achievements
const unlocked = await achievementService.checkAndAward(userId, robotId, {
  type: 'battle_complete',
  battleResult: { won, destroyed, finalHpPercent, eloDiff, ... }
});
// unlocked array is returned to the caller for toast notification data
```

Other integration points (weapon purchase, facility upgrade, etc.) follow the same pattern: call `achievementService.checkAndAward()` after the action completes.

### Idempotency

The `@@unique([userId, achievementId])` constraint ensures an achievement can only be awarded once. The service checks existing unlocks before inserting, so duplicate calls are safe.

### Win Streak and Combat Tracking

Achievements C12/C13 (consecutive league wins), S14 (lose streak), and S4–S7 (stance/loadout wins) require per-robot tracking fields. These are added to the Robot model:

```prisma
// League win streak (consistent with existing kothCurrentWinStreak/kothBestWinStreak pattern)
currentWinStreak Int @default(0) @map("current_win_streak")
bestWinStreak    Int @default(0) @map("best_win_streak")

// Lose streak (for S14 "Brain the Size of a Planet")
currentLoseStreak Int @default(0) @map("current_lose_streak")

// Stance/loadout win counters (for S4–S7)
offensiveWins  Int @default(0) @map("offensive_wins")
defensiveWins  Int @default(0) @map("defensive_wins")
balancedWins   Int @default(0) @map("balanced_wins")
dualWieldWins  Int @default(0) @map("dual_wield_wins")
```

All fields updated in `updateRobotCombatStats()` in `battlePostCombat.ts` alongside other post-combat stat updates.

---

## Retroactive Awards

On feature launch, run a one-time migration script that:

1. Iterates all users and their robots
2. Evaluates every achievement's trigger condition against current data (wins, ELO, prestige, fame, facilities, etc.)
3. Inserts `UserAchievement` records with `unlockedAt` set to the current timestamp
4. Awards accumulated credit and prestige rewards in a single transaction per user
5. Logs total retroactive awards per user for admin visibility

**Important**: The retroactive script should run *before* the feature goes live on the frontend, so players see their existing achievements immediately on first load rather than watching them pop in one by one.

For ACC specifically: with top prestige at ~860 and top fame at ~1,234, most players will retroactively earn the Easy tier achievements (first win, first loss, weapon purchases, etc.) and some Medium ones (P5 "15 Minutes of Fame" for robots with 100+ fame). This creates a positive "welcome back" moment.

---

## Resolved Questions

1. **Win streak fields**: ✅ Add `currentWinStreak` / `bestWinStreak` to Robot model for league battles. KotH reuses existing fields.
2. **Streaming revenue tracking**: ✅ Derive from `SUM(BattleParticipant.streamingRevenue)` — no new field needed.
3. **Lifetime earnings tracking**: ✅ Derive from `SUM(BattleParticipant.credits)` — no new field needed.
4. **Practice battle count**: ✅ Add `totalPracticeBattles` to User model.
5. **ELO thresholds**: ✅ Calibrated to 1400 (Medium) / 1600 (Hard) / 1800 (Very Hard) based on ACC data.
6. **C15 yield comeback**: ✅ Simplified to "win after losing previous battle" — check robot's last BattleParticipant.
7. **Stance/loadout win tracking**: ✅ Add cumulative counters to Robot model (`offensiveWins`, `defensiveWins`, `balancedWins`, `dualWieldWins`).
8. **Demotion/re-promotion ("Ctrl+Z" achievement)**: ⏳ Deferred to backlog #22 (Promotion/Demotion History Tracking). Achievement requires history data that doesn't exist yet. The current L15 slot is "Tag, You're It!" — the Ctrl+Z achievement will be added to the catalog once #22 is implemented.
9. **Mid-battle HP minimum (C19)**: ✅ Track `minHpReached` in battle result summary from combat simulator.

## Future Considerations

- **New achievements with new features**: Every new feature spec should consider whether new achievements should be added to the catalog. The achievement config is designed to be extended without schema changes.
- **Achievement persistence across seasons**: See backlog #40. Decision deferred to season system design.

---

## Related Documentation

- [Prestige & Fame Design Exploration](../analysis/PRESTIGE_FAME_DESIGN_EXPLORATION.md) — Design decisions that led to achievements as the milestone vehicle
- [Game Loop 1 Core Loop Exploration](../analysis/GAME_LOOP_1_CORE_LOOP_EXPLORATION.md) — Core loop analysis (Loop 4 context)
- [PRD_PRESTIGE_AND_FAME.md](PRD_PRESTIGE_AND_FAME.md) — Current prestige/fame earning mechanics and benefits
- [PRD_ECONOMY_SYSTEM.md](PRD_ECONOMY_SYSTEM.md) — Section 6: preliminary achievement reward examples
- [BACKLOG.md](../BACKLOG.md) — Backlog item #8 (Achievement System) and #6 (Game Loop Audit)
- [DESIGN_SYSTEM_QUICK_REFERENCE.md](../design_ux/DESIGN_SYSTEM_QUICK_REFERENCE.md) — Color palette, icon sizes, animation guidelines used for badge spec
