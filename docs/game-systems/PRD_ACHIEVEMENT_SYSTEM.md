# Product Requirements Document: Achievement & Milestone System

**Last Updated**: November 4, 2026 (Battle context placeholders fixed in team and placement modes)
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
| 🏆 **Trophy** (any tier) | ₡0 | 0 | The tier's colour | Recognition only, for placing above other players (issue #446). |

The tier distribution is maintained in the achievement config file. The full set is designed to be uncompletable within a single season.

**Season 2 rules (November 2026).** Tiers follow the observed Season 1 unlock rate among active players: easy 75%+, medium 40–75%, hard 15–40%, very hard under 15%. Achievements that pay you for already being ahead (tournament wins, Champion league, 1800 ELO, a 15-win streak, 25,000 prestige) are **Trophies**: config flag `trophy: true`, rewards `TROPHY_REWARDS` (₡0, 0 prestige), no ledger row and no prestige award on unlock. The UI shows a Trophy chip instead of a reward line (`components/AchievementReward.tsx`).

---

## Achievement Catalog

The Season 2 catalogue: 135 achievements, 10 of them Trophies (🏆, badge only: no credits or prestige). Generated from `app/backend/src/config/achievements.ts`, which is authoritative. The Season 2 changes and the Season 1 data behind them are in [ACHIEVEMENTS_SEASON_2_REVAMP.md](../analysis/ACHIEVEMENTS_SEASON_2_REVAMP.md); badge subjects are in [ACHIEVEMENT_BADGE_ART_GUIDE.md](../design_ux/ACHIEVEMENT_BADGE_ART_GUIDE.md).

### 🤖 Combat

Triggered by individual robot performance. Robot-scoped achievements are earned by the player *through* a specific robot.

| ID | Name | Reference | Tier | Scope | Condition |
|---|---|---|---|---|---|
| C1 | **"I'll Be Back"** | Terminator | 🟢 Easy | Robot | Win your first battle |
| C2 | **"Danger, Will Robinson!"** | Lost in Space | 🟢 Easy | Robot | Lose your first battle |
| C3 | **"Bite My Shiny Metal Badge"** | Bender, Futurama | 🟢 Easy | Robot | Complete 10 battles on one robot (any mode) |
| C4 | **"By Your Command"** | Cylons, BSG | 🟢 Easy | Robot | Win 25 battles on one robot |
| C5 | **"Hasta La Vista, Baby"** | Terminator 2 | 🟢 Easy | Robot | Destroy an opponent (0 HP) 25 times on one robot |
| C6 | **"I Am Iron Man"** | Iron Man / Marvel | 🟢 Easy | Robot | Win 50 battles on one robot |
| C7 | **"Exterminate!"** | Daleks, Doctor Who | 🟢 Easy | Robot | Destroy opponents 50 times on one robot |
| C8 | **"I, Robot"** | Asimov / movie | 🔵 Medium | Robot | Win 100 battles on one robot |
| C9 | **"Flawless Victory"** | Mortal Kombat | 🟢 Easy | Robot | Win a battle with 100% HP (perfect victory) |
| C10 | **"It's Just a Flesh Wound"** | Monty Python | 🔵 Medium | Robot | Win a battle with <10% HP remaining |
| C11 | **"Never Tell Me the Odds"** | Han Solo, Star Wars | 🔵 Medium | Robot | Win against an opponent 150+ ELO above you (league or tournament only) |
| C12 | **"Resistance Is Futile"** | Borg, Star Trek | 🟠 Hard | Robot | Win 10 consecutive league battles |
| C13 | **"Look What They Need to Mimic a Fraction of Our Power"** | Omni-Man, Invincible | 🟠 Hard 🏆 | Robot | Win 15 consecutive league battles |
| C14 | **"Do You Yield?"** | General combat trope | 🟢 Easy | Robot | Force an opponent to yield for the first time |
| C15 | **"I Didn't Hear No Bell"** | Rocky / meme | 🟢 Easy | Robot | Win a battle after losing the previous battle on the same robot |
| C16 | **"Wax On, Wax Off"** | Karate Kid | 🟢 Easy | Stable | Fight 25 practice arena battles |
| C17 | **"There Is No Spoon"** | The Matrix | ⬛ Secret | Robot | Win a battle while having 0 tuning points allocated |
| C18 | **"Autobots, Roll Out!"** | Optimus Prime, Transformers | 🟠 Hard | Stable | Win at least one battle in each category: any league (1v1/2v2/3v3), tag team, any tournament, KotH, and Grand Melee |
| C19 | **"Peace Through Tyranny"** | Megatron, Transformers | ⬛ Secret | Robot | Win a battle after being at <5% HP at any point during the fight |
| C20 | **"Moral Victory"** | Idiom | 🟢 Easy | Robot | Lose a 1v1 battle but deal more damage than your opponent |
| C21 | **"Not Like This"** | The Matrix | 🟢 Easy | Robot | Lose a 1v1 battle while your opponent is below 10% HP |
| C22 | **"Shall We Play a Game?"** | WarGames | 🟢 Easy | Robot | Fight a battle that ends in a draw |
| C23 | **"Run Away!"** | Monty Python and the Holy Grail | 🟢 Easy | Robot | Yield 10 times on one robot |
| C24 | **"Oh My God, They Killed Kenny!"** | South Park | 🟢 Easy | Robot | Have one robot destroyed 25 times |
| C25 | **"Eye of the Tiger"** | Rocky III | 🔵 Medium | Robot | Win a 1v1 battle after losing your previous 5 1v1 battles on the same robot |
| C26 | **"Revenge of the Fallen"** | Transformers | 🔵 Medium | Robot | Beat a robot in a 1v1 battle that beat you the last time you met |
| C27 | **"Judge Me by My Size, Do You?"** | Star Wars (Yoda) | 🔵 Medium | Robot | Beat a robot from a higher league tier in a 1v1 battle |
| C28 | **"The Neverending Story"** | The NeverEnding Story | 🟠 Hard | Robot | Win a 1v1 battle that lasts 100 seconds or more |
| C29 | **"This Is My Boomstick"** | Army of Darkness | 🟠 Hard | Robot | Win 25 1v1 battles with a starter weapon as main weapon |
| C30 | **"Run, Forrest, Run!"** | Forrest Gump | 🟢 Easy | Robot | Win a battle with the yield threshold at 50% (the maximum) |

### 🏆 League & Competition

League progression, tournaments, team modes, KotH and Grand Melee.

| ID | Name | Reference | Tier | Scope | Condition |
|---|---|---|---|---|---|
| L1 | **"Silver Surfer"** | Marvel Comics | 🟢 Easy | Robot | Reach Silver league |
| L2 | **"Heart of Gold"** | Hitchhiker's Guide | 🟢 Easy | Robot | Reach Gold league |
| L3 | **"Heavy Metal"** | Music / material | 🟢 Easy | Robot | Reach Platinum league |
| L4 | **"Shine On You Crazy Diamond"** | Pink Floyd | 🟢 Easy | Robot | Reach Diamond league |
| L5 | **"We Are the Champions"** | Queen | 🟠 Hard 🏆 | Robot | Reach Champion league |
| L6 | **"King of the Hill"** | TV show / game mode | 🟢 Easy | Robot | Win your first KotH match (1st place) |
| L7 | **"Lord of the Hill"** | Expanded KotH reference | 🟢 Easy | Robot | Win 10 KotH matches (1st place) |
| L8 | **"WALL-E and EVE"** | WALL-E, Pixar | 🔵 Medium | Robot | Win your first Tag Team battle |
| L9 | **"The Megazord"** | Power Rangers | 🔵 Medium | Robot | Win 25 Tag Team battles |
| L18 | **"Daft Punk"** | Daft Punk | 🔵 Medium | Robot | Win your first 2v2 League battle |
| L19 | **"Twins!"** | The Matrix Reloaded | 🔵 Medium | Robot | Win 25 2v2 League battles |
| L20 | **"Three Laws Safe"** | Asimov, I Robot | 🔵 Medium | Robot | Win your first 3v3 League battle |
| L21 | **"Voltron"** | Voltron | 🔵 Medium | Robot | Win 25 3v3 League battles |
| L22 | **"R2-D2 & C-3PO"** | Star Wars | 🔴 Very Hard 🏆 | Stable | Win a 2v2 Tournament |
| L23 | **"Jaeger Pilots"** | Pacific Rim | 🔴 Very Hard 🏆 | Stable | Win 3 different 2v2 Tournaments |
| L24 | **"Triforce"** | Legend of Zelda | 🔴 Very Hard 🏆 | Stable | Win a 3v3 Tournament |
| L25 | **"Devastator"** | Transformers | 🔴 Very Hard 🏆 | Stable | Win 3 different 3v3 Tournaments |
| L10 | **"There Can Be Only One"** | Highlander | 🟠 Hard 🏆 | Stable | Win a tournament |
| L11 | **"Thunderdome"** | Mad Max | 🔴 Very Hard 🏆 | Stable | Win 3 tournaments |
| L12 | **"ELO-quent"** | Pun on ELO + eloquent | 🟢 Easy | Robot | Reach 1400 ELO on any robot |
| L13 | **"Over 9000!"** | Dragon Ball Z | 🔵 Medium | Robot | Reach 1600 ELO on any robot |
| L14 | **"The Chosen One"** | The Matrix / trope | 🟠 Hard 🏆 | Robot | Reach 1800 ELO on any robot |
| L15 | **"Tag, You're It!"** | Playground game | 🔵 Medium | Robot | Win a tag team battle where the reserve robot tagged in |
| L16 | **"Dynamic Duo"** | Batman & Robin | 🔵 Medium | Robot | Win 40 tag team battles |
| L17 | **"I Work Alone"** | Batman / lone wolf trope | 🔵 Medium | Robot | Win a tag team battle where your active robot destroyed both opponents without tagging out |
| L26 | **"Real Steel"** | Real Steel movie | 🟢 Easy | Stable | Win your first Grand Melee (1st place) |
| L27 | **"The Hunger Bots"** | Hunger Games parody | 🔵 Medium | Stable | Win 5 Grand Melee matches |
| L28 | **"Omega Supreme"** | Transformers (Autobot guardian) | 🟠 Hard | Stable | Win 20 Grand Melee matches |
| L29 | **"Cockroach Protocol"** | Survival AI concept | 🔵 Medium | Stable | Finish in the top 3 in 10 Grand Melee matches |
| L30 | **"Untouchable"** | Dominance/invincibility | 🟢 Easy | Stable | Win a Grand Melee with more than 75% HP remaining |
| L31 | **"Return of the Jedi"** | Star Wars | 🔵 Medium | Robot | Get demoted in 1v1 league, then promoted back to that tier |
| L32 | **"Round One… Fight!"** | Mortal Kombat | 🟢 Easy | Robot | Win a tournament match |
| L33 | **"The Final Countdown"** | Europe | 🔵 Medium | Robot | Fight in a tournament semi-final |
| L34 | **"I've Got a Bad Feeling About This"** | Star Wars | 🔵 Medium | Robot | Lose a tournament final |
| L35 | **"Free Real Estate"** | Meme | ⬛ Secret | Stable | Get a bye in a tournament round |
| L36 | **"Red Shirt"** | Star Trek | ⬛ Secret | Robot | Be the first robot eliminated in a Grand Melee |
| L37 | **"Stayin' Alive"** | Bee Gees | 🟢 Easy | Robot | Survive to the final bell of a Grand Melee |
| L38 | **"Rampage"** | Rampage | 🟠 Hard | Robot | Destroy 3 robots in one Grand Melee |
| L39 | **"The Last Starfighter"** | The Last Starfighter | 🔵 Medium | Robot | Win a KotH match as the last robot standing |
| L40 | **"This Is Sparta!"** | 300 | 🔵 Medium | Robot | Hold the KotH zone uncontested for 30 seconds or more in one match |
| L41 | **"Ohana"** | Lilo & Stitch | 🔵 Medium | Robot | Win a 3v3 battle with all three of your robots still standing |

### 💰 Economy & Stable

Stable-wide economic activity, facilities, weapons and roster management.

| ID | Name | Reference | Tier | Scope | Condition |
|---|---|---|---|---|---|
| E1 | **"Hello World"** | Programming | 🟢 Easy | Stable | Complete onboarding |
| E2 | **"The Odds Are 725 to 1"** | C-3PO, Star Wars | 🟢 Easy | Stable | Earn ₡100,000 total from battles |
| E3 | **"Show Me the Money"** | Jerry Maguire | 🔵 Medium | Stable | Accumulate ₡5,000,000 in your balance at once |
| E4 | **"Scrooge McDuck"** | DuckTales | 🔵 Medium | Stable | Earn ₡25,000,000 lifetime from all sources |
| E5 | **"Buy the Dip"** | Finance meme | 🟢 Easy | Stable | Purchase your first weapon |
| E6 | **"Arsenal"** | Military / football club | 🟠 Hard | Stable | Own 10 weapons simultaneously |
| E7 | **"Mall Cop"** | Paul Blart / pun | 🔵 Medium | Stable | Buy your first shield |
| E8 | **"Pimp My Bot"** | Pimp My Ride | 🟢 Easy | Stable | Upgrade any robot attribute for the first time |
| E9 | **"Fully Operational"** | Death Star, Star Wars | 🔵 Medium | Stable | Reach an effective stat of 50 on any attribute on a robot |
| E10 | **"The Architect"** | The Matrix | 🟢 Easy | Stable | Own 3 facilities at level 3+ |
| E11 | **"Megacorp"** | Sci-fi trope | 🟢 Easy | Stable | Own 5 facilities at level 3+ |
| E12 | **"Skynet Is Online"** | Terminator | 🔵 Medium | Stable | Own 3 robots simultaneously |
| E13 | **"Robot Army"** | General sci-fi | 🟠 Hard | Stable | Own 5 robots simultaneously |
| E14 | **"Rise of the Machines"** | Terminator 3 | 🟠 Hard | Stable | Own 7 robots simultaneously |
| E15 | **"Fine-Tuned Machine"** | Common phrase / Tuning Bay | 🟢 Easy | Stable | Allocate tuning points on any robot for the first time |
| E16 | **"Overclocked"** | PC gaming term | 🟠 Hard | Stable | Allocate 50+ tuning points on a single robot |
| E17 | **"Bankrupt!"** | Monopoly / economy | ⬛ Secret | Stable | Have your balance drop below ₡0 from daily operating costs |
| E18 | **"Pawn Star"** | Pawn Stars TV show | 🔵 Medium | Stable | Sell your first weapon |
| E19 | **"Shrewd Negotiator"** | Business / negotiation trope | 🔴 Very Hard | Stable | Earn ₡500,000 lifetime from weapon resales |
| E20 | **"Arms Dealer"** | Arms dealer trope | 🔴 Very Hard | Stable | Sell 10 weapons |
| E21 | **"Buy High, Sell Higher"** | Trader meme | 🟠 Hard | Stable | Sell a weapon with Weapons Workshop level 5 or higher (50%+ resale) |
| E22 | **"First Refinement"** | Weapon Refinement | 🔵 Medium | Stable | Refine your first weapon |
| E23 | **"Master Craftsman"** | Crafting trope | 🟠 Hard | Stable | Spend ₡1,000,000 lifetime on weapon refinements |
| E24 | **"Legendary Smith"** | Smithing trope | 🟠 Hard | Stable | Own a Legendary weapon (5 refinements) |
| E25 | **"Identity Forged"** | Identity build | 🔴 Very Hard | Stable | Refine a starter weapon (Practice Sword, Practice Blaster, Training Rifle, or Training Beam) to Legendary status |
| E26 | **"Forge Master"** | Forge / DPS build | 🟠 Hard | Stable | Own a weapon with all four DPS slots filled (2 Sharpen + 2 Forge) |
| E27 | **"Better, Stronger, Faster"** | The Six Million Dollar Man | 🟢 Easy | Stable | Spend ₡6,000,000 on attribute upgrades |
| E28 | **"Back to the Future"** | Back to the Future | 🟢 Easy | Stable | Recover from a balance below ₡100,000 to above ₡1,000,000 |
| E29 | **"SimCity"** | SimCity | 🟠 Hard | Stable | Own every facility type at level 1 or higher |
| E30 | **"To Infinity and Beyond"** | Toy Story | 🟠 Hard | Stable | Upgrade any facility to level 10 |
| E31 | **"MacGyver"** | MacGyver | 🔵 Medium | Stable | Spend ₡10,000,000 on repairs |
| E32 | **"Ready for My Close-Up"** | Sunset Boulevard | 🟢 Easy | Stable | Upload a custom image for a robot |
| E33 | **"Merchandising!"** | Spaceballs | 🟢 Easy | Stable | Earn ₡500,000 from the Merchandising Hub |
| E34 | **"More Than Meets the Eye"** | Transformers | 🔵 Medium | Stable | Win battles with all four loadout types (any robots) |
| E35 | **"Ain't Nobody Got Time for That"** | Meme | 🟠 Hard | Stable | Subscribe one robot to every Booking Office event type at once |

### 🌟 Prestige & Fame

Prestige thresholds (stable), fame thresholds (robot) and streaming.

| ID | Name | Reference | Tier | Scope | Condition |
|---|---|---|---|---|---|
| P1 | **"Established"** | Prestige rank title | 🟢 Easy | Stable | Reach 1,000 prestige |
| P2 | **"Veteran"** | Prestige rank title | 🟢 Easy | Stable | Reach 5,000 prestige |
| P3 | **"Elite"** | Prestige rank title | 🔵 Medium | Stable | Reach 10,000 prestige |
| P4 | **"Legendary"** | Prestige rank title | 🟠 Hard 🏆 | Stable | Reach 25,000 prestige |
| P5 | **"15 Minutes of Fame"** | Andy Warhol quote | 🟢 Easy | Robot | Robot reaches 100 fame |
| P6 | **"Famous Last Words"** | Common phrase | 🟢 Easy | Robot | Robot reaches 500 fame |
| P7 | **"Legendary Status"** | Fame tier | 🟢 Easy | Robot | Robot reaches 2,500 fame |
| P8 | **"Mythical Proportions"** | Fame tier | 🔵 Medium | Robot | Robot reaches 5,000 fame |
| P9 | **"Influencer"** | Modern culture | 🟢 Easy | Stable | Earn ₡100,000 total streaming revenue |
| P10 | **"Content Creator"** | Modern culture | 🟢 Easy | Stable | Earn ₡1,000,000 total streaming revenue |
| P11 | **"Going Viral"** | Internet culture | 🔵 Medium | Robot | Earn ₡20,000 streaming revenue from one battle |
| P12 | **"Veteran of the Clone Wars"** | Star Wars | 🟢 Easy | Stable | Your stable competed in a previous season |

### 🎲 Style & Quirky

Playstyle choices, loadouts and unusual battle outcomes.

| ID | Name | Reference | Tier | Scope | Condition |
|---|---|---|---|---|---|
| S1 | **"Bleep Bloop"** | Robot stereotype | 🟢 Easy | Robot | Equip a robot with an energy weapon |
| S2 | **"Get to the Choppa"** | Predator / Arnold | 🔵 Medium | Robot | Equip a robot with a ballistic weapon |
| S3 | **"Sword Art Online"** | Anime series | 🟢 Easy | Robot | Equip a robot with a melee weapon |
| S4 | **"Dual Wielding Intensifies"** | Gaming meme | 🟠 Hard | Robot | Win 10 battles with dual-wield loadout |
| S5 | **"Turtle Mode Activated"** | Gaming strategy | 🟢 Easy | Robot | Win 10 battles on defensive stance |
| S6 | **"LEEROY JENKINS!"** | WoW meme | 🟢 Easy | Robot | Win 10 battles on offensive stance |
| S7 | **"Perfectly Balanced"** | Thanos, Avengers | 🔵 Medium | Robot | Win 10 battles on balanced stance |
| S8 | **"No Retreat, No Surrender"** | Movie title / phrase | 🟢 Easy | Robot | Win a battle with yield threshold set to 0% |
| S9 | **"Glass Cannon"** | RPG archetype | ⬛ Secret | Robot | Deal 500+ damage in a battle but finish with <5% HP |
| S10 | **"Overkill"** | Gaming term | ⬛ Secret | Robot | Win a battle in under 5 seconds |
| S11 | **"R2-D2 Would Be Proud"** | Star Wars | ⬛ Secret | Robot | Win a tag team battle as the reserve robot after your partner was destroyed |
| S12 | **"Johnny 5 Is Alive!"** | Short Circuit | ⬛ Secret | Robot | Have a robot survive 50 battles in any mode (battles fought minus times destroyed) |
| S13 | **"Dead or Alive, You're Coming With Me"** | RoboCop | 🟢 Easy | Stable | Force 10 opponents to yield in 1v1 battles (cumulative, any robot) |
| S14 | **"Brain the Size of a Planet"** | Marvin, Hitchhiker's Guide | ⬛ Secret | Robot | Lose 10 battles in a row on a single robot |
| S15 | **"Nobody Expects the Spanish Inquisition"** | Monty Python | ⬛ Secret | Robot | Win a KotH match or Grand Melee as the lowest-rated robot in the field |
| S16 | **"Mirror, Mirror"** | Star Trek | ⬛ Secret | Robot | Beat a robot with the same chassis in a 1v1 battle |
| S17 | **"Gotta Catch 'Em All"** | Pokémon | 🟠 Hard | Stable | Unlock 50 achievements in one season |

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

> **Superseded for new art (November 2026).** The shipped badges are rendered metal, not flat. New and replacement badges follow [ACHIEVEMENT_BADGE_ART_GUIDE.md](../design_ux/ACHIEVEMENT_BADGE_ART_GUIDE.md), which also lists the badge subject for every achievement. The original guidance below is kept for history.

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

The **trophy cabinet** on the stable page (`StableViewPage`), visible to all players visiting any stable. Full behaviour: [PRD_STABLE_VIEW_PAGE.md](../prd_pages/PRD_STABLE_VIEW_PAGE.md#trophy-cabinet).

- Up to **6 badges**: the owner's pins in their order, then the stable's rarest other unlocks, so the cabinet is never empty slots. Before the stable page revamp (Nov 2026) only 1 of 87 human stables had pinned anything.
- Rarity is the human-stable holder count from the rarity cache; each auto-filled badge shows "Held by N players", a pinned one shows "Pinned". Hidden achievements are only shown when pinned.
- Summary line "106 of 130 achievements". The "All achievements →" link is shown on the owner's own page only.

**Own Stable View**

A **Customise** button opens the picker modal (pin, unpin, save; max 6). Free slots keep showing the rarest unlocks.

**Data**: The pinned achievement IDs are stored on the User model (see [Data Model](#data-model)). `GET /api/stables/:userId` returns `achievements.pinned` and `achievements.showcase` (built by `buildShowcase` in `achievementQueries.ts`).

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

### Achievement_Trigger_Registration — three places must agree (Spec #46)

An achievement is reachable only if **all three** of the following name its trigger type. Nothing in the type system enforces the agreement, and a gap in any one of them fails silently:

| # | Location | What it does | Failure mode if omitted |
|---|---|---|---|
| 1 | `ACHIEVEMENTS` in `src/config/achievements.ts` | Declares the achievement and its `triggerType` | Achievement does not exist |
| 2 | `EVENT_TRIGGER_MAP` in `services/achievement/achievementTypes.ts` | Selects the trigger type as a candidate for an event | No event ever evaluates it — **silently never unlocks** |
| 3 | `evaluateTrigger()` in `services/achievement/triggerEvaluator.ts` | Provides a `case` branch | Falls through to `default: return false` — **silently never unlocks** |

Additionally, any achievement with `progressType: 'numeric'` needs an entry in the Achievement_Progress_Resolver in `achievementCatalog.ts`, or its card renders without a progress bar.

Both silent failure modes are indistinguishable from "the player has not met the condition", which is why Spec #46 added `tests/services/achievementRegistration.test.ts`. That suite reads the evaluator and catalog sources and asserts every declared trigger type appears in all applicable registration points. **Add a trigger type and the test fails until every location is updated.**

### Spec #46: nine achievements that could never unlock

Nine achievements had zero unlocks across 40+ cycles. Three independent root causes:

**Cause A — team-mode wins read from the wrong entity type.** L16 Dynamic Duo, L19 Twins!, and L21 Voltron gate on `tag_team`, `league_2v2`, and `league_3v3` win counts. The service read them from `standing.findMany({ entityType: 'robot', entityId: robotId })`, but those three modes only ever write `entityType: 'team'` rows keyed by `TeamBattle.id`. Every lookup missed, and `?? 0` turned the miss into a zero indistinguishable from a genuine zero.

Fixed by `services/achievement/teamModeWins.ts`, which resolves robot → `TeamBattleMember` → `TeamBattle` → team-scoped `Standing` in two batched queries. A size-2 membership maps to **both** `league_2v2` and `tag_team`, since Tag Team is a combat mode on the same `TeamBattle` row. The same helper feeds both the unlock evaluator and the catalog progress display, so displayed progress cannot disagree with unlock behaviour.

**Cause B — the upset trigger compared the wrong quantity.** C11 Never Tell Me the Odds requires beating an opponent 150+ ELO above you. The `'elo_upset'` branch compared `eloDiff`, which was the subject's own ELO *change*. `ELO_K_FACTOR` is 32, so the value could never reach 150 and the achievement was unreachable by arithmetic. It now compares the Opponent_Elo_Gap, `opponentEloBefore - subjectEloBefore`. The context field was renamed `eloDiff` → `eloChange` across every orchestrator so the two cannot be confused again.

**Cause C — the Grand Melee triggers were never registered or incremented.** L26 Real Steel, L27 The Hunger Bots, L28 Omega Supreme, L29 Cockroach Protocol, and L30 Untouchable use `grand_melee_wins`, `grand_melee_top3`, and `grand_melee_win_high_hp`. All three were declared in `AchievementTriggerType` but absent from `EVENT_TRIGGER_MAP`, had no branch in `evaluateTrigger()`, and had no progress resolver entry. Separately, `robots.grand_melee_wins` and `grand_melee_top3` existed but nothing ever incremented them, so even a registered trigger would have read zero. Spec #44 tasks 10.1 and 10.2 covered this work and were left unchecked in a spec filed as done.

All three registration points now include the triggers, and `updateRobotCombatStats()` owns the counters via an optional `placement` option. Those increments sit **outside** the `if (!opts.skipBattleCounters)` guard: the Grand Melee orchestrator passes `skipBattleCounters: true` to stay out of the Career_Battle_Counters, where a "win" is undefined for placements 2 through 20 and would corrupt the win-rate denominator — not to opt out of its own mode counters.

### Battle context must describe the battle fought (November 2026)

The `battle_complete` context every orchestrator passes must carry the robot's real yield threshold, tuning allocation, final HP percentage, loadout and stance. Team, tag team, team tournament, KotH, Grand Melee and 1v1 tournament orchestrators passed placeholders (yield 0, no tuning, 0% HP), which unlocked S8 and C17 on any win in those modes and C10/C19 on team and tag wins. Fixed before Season 2; Season 1 unlocks were left as awarded. Build the context with `services/battle/battleAchievementContext.ts`. Details: [achievement-battle-context.md](../implementation_notes/achievement-battle-context.md).

### Threshold reachability

At one match per mode per cycle across a 100-cycle season, with continuous subscription to the mode:

| Achievement | Threshold | Required win rate | Attainable |
|---|---|---|---|
| L16 Dynamic Duo | 40 tag team wins | 40% | Yes |
| L19 Twins! | 25 2v2 league wins | 25% | Yes |
| L21 Voltron | 25 3v3 league wins | 25% | Yes |

**No threshold was reduced.** All three are attainable within a season; they were unreachable at *any* threshold because of Cause A, so the threshold was never the constraint. The assumption is continuous subscription to the mode through the season — a player who subscribes late has proportionally fewer matches.

### No retroactive awards

Spec #46 performs no backfill and awards nothing retroactively. Spec #45 deletes `user_achievements` and resets the backing counters at the season boundary, so a backfill would be discarded.

One consequence is player-visible: because evaluation is driven by the `battle_complete` event, a player who already holds qualifying Team_Scoped_Standing win counts sees the achievement unlock on their **next qualifying battle**, not at deploy time. The changelog entry states this so the delay is not read as the defect persisting.

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

## Season Reset (Spec #45)

**Achievements reset at each Season_Rollover.** All `user_achievements` rows are deleted and `pinnedAchievements` is emptied.

Each season's unlocked count, the count available at the time, and the full list of unlocked achievement identifiers are recorded in `stable_season_archives`, so the collection becomes a per-season scorecard rather than a lifetime list.

Achievement rewards (credits and prestige) are also season-scoped, since both reset at the boundary.
## Account Reset (issue #342)
**A reset is a fresh start for achievements.** `performAccountReset` deletes the stable's `user_achievements` rows and zeroes `prestige`, championship titles, `pinnedAchievements` and `totalPracticeBattles` in the same transaction that sets credits to the ₡3,000,000 opening balance. No reversal ledger rows are written; the pre-reset `achievement_reward` pairs and `prestige_change` audit rows stay as history.
**Each achievement can be earned again once per reset.** The unique `(userId, achievementId)` key still allows only one unlock at a time, and a new unlock gets a new financial event id. Repeated resets cannot farm rewards: every reset wipes the credits and prestige earned since the last one. Reset stays available after onboarding, so the onboarding achievement (E1) and the robot-count achievement (E12) follow the same rule.
**History-based counters restart at the latest reset.** Weapon sale achievements (E18–E20) and the refinement count achievement (E22) count `audit_logs` rows, which the reset keeps. They, and their progress bars, count only events after the user's latest `reset_logs.reset_at` (`services/achievement/achievementCounterWindow.ts`). Season rollover truncates `audit_logs`, so it needs no window. E23 (refinement credits spent) reads `weapon_refinements`, which the reset deletes with the inventory. The ledger-based counters (E27 upgrade spend, E28 low balance, E33 Merchandising Hub income) read `financial_ledger`, which the reset also keeps, so they use the same window.
**Weapons and shields cannot be farmed.** Milestone purchase achievements (E5–E7, S1–S3) stay earned after the item is sold. Resale pays `pricePaid × (workshop level × 10)%`, never more than was paid, so a buy/sell loop always loses credits, and each sale achievement unlocks once. Robots cannot be sold, so robot-count achievements have no sell path.

## Automaton Stables (Spec #55)

**Automatons earn achievements.** After each purchase or settings action the Automaton executor calls the same `achievementService.checkAndAward` events the player routes call, with the same "failures don't block" pattern (`awardQuietly` in `services/automaton/upkeep/freeUpkeep.ts`). Battle, standing, tournament and season achievements are earned exactly as by a human (decisions 3 and 33). Achievements that only a manual action triggers, such as Manual_Repair or practice battles, are never earned, because Automatons never take those actions.

**Preserved-state re-award.** Activation sets `hasCompletedOnboarding = true`, so `reawardPreservedStateAchievements` re-grants the onboarding achievement to every Active_Automaton after each Season_Rollover, as it does for humans (decision 3: parity kept).

**Rarity counts humans only** (R1.8, decision 38). The "Earned by x of n players" figures ignore Automatons. `refreshRarityCache` (`services/achievement/achievementQueries.ts`) counts only `stableType = human` stables in both the earned-count query and the active-player count (a human with at least one robot that has fought), so Automatons and generated filler stables, including the seeded `test_user_*` WimpBots, are left out. Until November 2026 it also filtered on `auto_*` and `test_user_*` usernames, which left out a human who picked such a name and counted a generated stable that didn't follow the pattern. Automatons and generated stables still hold their achievements; only the percentage shown to players leaves them out.
