# Achievements Revamp for Season 2

**Status:** Approved and implemented (badges pending) · **Date:** November 4, 2026 · **Related:** issue #446, [PRD_ACHIEVEMENT_SYSTEM.md](../game-systems/PRD_ACHIEVEMENT_SYSTEM.md), [achievement-battle-context.md](../implementation_notes/achievement-battle-context.md)

## Overview

Season 1 was the first full season with achievements. This document records the changes that ship before the Season 2 rollover: issue #446 (win-more rewards), tier labels that don't match difficulty, unreachable achievements, the battle-count question, and new achievements. Unlocks reset at rollover, so the season boundary is the switch point. Season 1 unlocks stay as awarded.

## Season 1 data (ACC, cycle 93 of 100)

All figures were read from ACC. "Players" means the 23 human stables that logged in this season and unlocked 10+ achievements.

- The catalogue has 99 achievements with flat tier rewards: easy ₡25K/25 prestige, medium ₡50K/50, hard ₡100K/100, very hard ₡250K/250, secret ₡50K/50.
- **Achievement money is small for top stables.** The top stables earned about ₡6.9M from achievements, against about ₡200M from battles, streaming and merchandising (around 3%). The weakest player earned about ₡2.0M, against ₡14M (around 15%).
- **Achievement prestige matters most to trailing players.** It was about 8% of a top stable's prestige, but about 43% for the weakest player (2,025 of 4,745).
- **Most human achievement money (about 80%) came from results-based achievements**, not from play or exploration.
- **A trigger bug inflated five achievements.** S8, C17, C10, C19 and S9 unlocked on wins in team, tag team, KotH and Grand Melee battles. It is fixed for the rest of Season 1, and their Season 1 rates aren't used for tiering.

Per-achievement rates are in the appendix.

## Principles

1. **Money and prestige go to playing; trophies go to results.** Achievements that any active player can reach pay out. Achievements only the top few can reach are recognition only.
2. **The tier label matches how hard it really was.** Tiers come from observed unlock rates.
3. **Every achievement can be earned this season.**
4. **Achievements are fun.** There are plenty of them, including ones for losing well, odd outcomes and trying things out.

## Decisions

| # | Decision |
|---|---|
| D1 | Results-only achievements become **Trophies**: badge only, no credits or prestige, clearly marked as such in the UI. |
| D2 | P4 "Legendary" becomes a Trophy: prestige for already having a lot of prestige is win-more. L28 "Omega Supreme" keeps paying, because Grand Melees can be won in lower tiers. |
| D3 | Re-tier by observed Season 1 unlock rate. |
| D4 | E21 requires Workshop L5+ (50% resale) instead of L10. E19, E20 and E25 stay as long-term goals. |
| D5 | S8 drops to easy. C19 gets real lowest-HP tracking. |
| D6 | Add as many new achievements as we can think of (§6). |
| D7 | C3 and S12 count battles in every mode. |
| D8 | Keep rewards for all stable types. Automatons arrived mid-season, which is why achievements look like half their income. |

## 1. Trophies (D1, D2)

| ID | Name | Condition | Season 1 holders (of 23) |
|---|---|---|---|
| L10 | There Can Be Only One | Win a tournament | 6 |
| L11 | Thunderdome | Win 3 tournaments | 3 |
| L22 | R2-D2 & C-3PO | Win a 2v2 tournament | 2 |
| L23 | Jaeger Pilots | Win 3 2v2 tournaments | 1 |
| L24 | Triforce | Win a 3v3 tournament | 3 |
| L25 | Devastator | Win 3 3v3 tournaments | 2 |
| L5 | We Are the Champions | Reach Champion league | 9 |
| L14 | The Chosen One | Reach 1800 ELO | 9 |
| C13 | Look What They Need to Mimic… | Win 15 league battles in a row | 6 |
| P4 | Legendary | Reach 25,000 prestige | 7 |

L28 "Omega Supreme" (win 20 Grand Melees, 7 holders) keeps paying: Grand Melees can be won in lower tiers, and 22 of 23 players won at least one.

Trophies are re-tiered by the same bands as everything else (§2), because their tier now only shows how hard they are. This moves L10 to hard; L5, L14, C13 and P4 to hard; and L22–L25 to very hard. L11 stays very hard.

**Marking Trophies.** The tier still sets the border colour, so the badge says how hard it was. Every place an achievement shows its reward instead shows a Trophy marker:
- On the `/achievements` card, a "Trophy" chip and "Bragging rights only: no credits or prestige" instead of the reward line.
- In the unlock toast and the battle report achievement row, the same chip, with no reward amount.
- A Trophy filter on `/achievements`, and a Trophies section in the guide's achievement catalogue that explains why these pay nothing.

The config gets an explicit flag (for example `trophy: true` with `rewardCredits: 0`, `rewardPrestige: 0`), so the marker never depends on the reward happening to be 0.

## 2. Re-tiering (D3)

Bands: easy if 75%+ of players unlocked it, medium 40–75%, hard 15–40%, very hard under 15%. Secrets keep their fixed reward. The five achievements inflated by the bug (C10, C17, C19, S8, S9) are excluded, and S8 moves to easy under D5. Trophy moves are listed in §1; P4 is also in the table below.

| Move | Achievements |
|---|---|
| Very hard → easy | E11 Megacorp |
| Hard → easy | C6 I Am Iron Man, C7 Exterminate!, L4 Shine On You Crazy Diamond, L30 Untouchable, E10 The Architect, P2 Veteran, P7 Legendary Status, P10 Content Creator, S8 No Retreat, No Surrender (D5) |
| Medium → easy | C4 By Your Command, C5 Hasta La Vista, Baby, L2 Heart of Gold, L3 Heavy Metal, L7 Lord of the Hill, L12 ELO-quent, P1 Established, P6 Famous Last Words, S5 Turtle Mode Activated, S6 LEEROY JENKINS!, S13 Dead or Alive… |
| Very hard → medium | C8 I, Robot, L16 Dynamic Duo, P3 Elite, P8 Mythical Proportions |
| Hard → medium | C11 Never Tell Me the Odds, L9 The Megazord, L13 Over 9000!, L19 Twins!, L21 Voltron, E3 Show Me the Money, E4 Scrooge McDuck, E9 Fully Operational |
| Easy → medium | L8 WALL-E and EVE, L15 Tag, You're It!, L18 Daft Punk, L20 Three Laws Safe, E7 Mall Cop, E18 Pawn Star, E22 First Refinement, S2 Get to the Choppa |
| Very hard → hard | E14 Rise of the Machines, P4 Legendary |
| Medium → hard | E6 Arsenal, E16 Overclocked, E23 Master Craftsman, S4 Dual Wielding Intensifies |
| Medium/hard → very hard | E19 Shrewd Negotiator, E20 Arms Dealer, E25 Identity Forged |

E21 changes condition, so it is tiered by estimate (§3). The bands rest on 23 players, so a recalibration after Season 2 is expected.

## 3. Changed conditions and descriptions

No achievement is removed or renamed. These descriptions change:

| ID | Name | Change |
|---|---|---|
| E21 | Buy High, Sell Higher | "Sell a weapon with Weapons Workshop L5+ (50%+ resale)". Tier: hard. In Season 1, 10 of 20 human stables reached Workshop L5. |
| S11 | R2-D2 Would Be Proud | Today it uses exactly the same check as L15 (the reserve tagged in and won), and both had the same holders. New condition: "Win a tag team battle as the reserve robot after your partner was destroyed". |
| C3 | Bite My Shiny Metal Badge | "Complete 10 battles on one robot (any mode)" (D7). |
| S12 | Johnny 5 Is Alive! | Counts battles survived in every mode, with KotH and Grand Melee destructions counted the same way (D7). |
| C19 | Peace Through Tyranny | Wording stays. It now reads the robot's lowest HP during the fight from the combat events (D5). Resumed tournament matches have no events and fall back to final HP. |
| C18 | Autobots, Roll Out! | Proposed: add Grand Melee to the required modes. Grand Melee arrived after C18 was written. Optional. |

## 4. New achievements (D6)

These are 36 new achievements. Names follow the catalogue's robot and sci-fi pop-culture theme. ⤴ marks achievements meant for players who are behind or losing: consolation and catch-up. Tiers are estimates where Season 1 has no matching data.

**Data:** "Context" means the battle context already carries it. "History" means a query over battle participants, league history or the ledger, as existing achievements already do. "New" means a small new signal (an event or a context field).

### Combat (robot)

| ID | Name | Reference | Tier | Condition | Data |
|---|---|---|---|---|---|
| C20 ⤴ | Moral Victory | Idiom | Easy | Lose a 1v1 battle but deal more damage than your opponent | Context |
| C21 ⤴ | Not Like This | The Matrix | Easy | Lose a 1v1 battle while your opponent is below 10% HP | New: opponent final HP |
| C22 | Shall We Play a Game? | WarGames | Easy | Fight a battle that ends in a draw | Context |
| C23 ⤴ | Run Away! | Monty Python and the Holy Grail | Easy | Yield 10 times on one robot (Season 1: 75 of 97 human robots) | History |
| C24 ⤴ | Oh My God, They Killed Kenny! | South Park | Easy | Have one robot destroyed 25 times (Season 1: 83 of 97) | History |
| C25 ⤴ | Eye of the Tiger | Rocky III | Medium | Win a 1v1 battle after losing your previous 5 1v1 battles on the same robot | History |
| C26 ⤴ | Revenge of the Fallen | Transformers | Medium | Beat a robot in a 1v1 battle that beat you the last time you met | History |
| C27 ⤴ | Judge Me by My Size, Do You? | Star Wars (Yoda) | Medium | Beat a robot from a higher league tier in a 1v1 battle (in practice a tournament: league opponents share a tier) | History (opponent tier) |
| C28 | The Neverending Story | The NeverEnding Story | Hard | Win a 1v1 battle lasting 100+ seconds (Season 1: p99 was 113 s) | Context |
| C29 ⤴ | This Is My Boomstick | Army of Darkness | Hard | Win 25 1v1 battles with a starter weapon as main weapon | History (battle builds) |
| C30 | Run, Forrest, Run! | Forrest Gump | Easy | Win a battle with yield threshold at 50% (the maximum, the opposite of S8) | Context |

### League and competition

| ID | Name | Reference | Tier | Scope | Condition | Data |
|---|---|---|---|---|---|---|
| L31 ⤴ | Return of the Jedi | Star Wars | Medium | Robot | Get demoted, then promoted back to that tier. Uses the unused `demotion_repromotion` trigger. | History |
| L32 ⤴ | Round One… Fight! | Mortal Kombat | Easy | Robot | Win a tournament match | Context |
| L33 | The Final Countdown | Europe | Medium | Robot | Reach a tournament semi-final | History |
| L34 ⤴ | I've Got a Bad Feeling About This | Star Wars | Medium | Robot | Lose a tournament final (it pays; winning is a Trophy) | History |
| L35 | Free Real Estate | Meme | Secret | User | Get a bye in a tournament round (user scope, so team byes count too) | New: bye event |
| L36 ⤴ | Red Shirt | Star Trek | Secret | Robot | Be the first robot eliminated in a Grand Melee | Context (placement) |
| L37 ⤴ | Stayin' Alive | Bee Gees | Easy | Robot | Survive to the final bell of a Grand Melee | Context |
| L38 | Rampage | Rampage | Hard | Robot | Destroy 3 robots in one Grand Melee | Context (kills) |
| L39 | The Last Starfighter | The Last Starfighter | Medium | Robot | Be the last robot standing in a KotH match | Context (KotH result) |
| L40 | This Is Sparta! | 300 | Medium | Robot | Hold the KotH zone uncontested for 30+ seconds in one match | New: per-robot KotH metric |
| L41 | Ohana | Lilo & Stitch | Medium | Robot | Win a 3v3 battle with all three of your robots still standing | Context |

### Economy and stable (user)

| ID | Name | Reference | Tier | Condition | Data |
|---|---|---|---|---|---|
| E27 | Better, Stronger, Faster | The Six Million Dollar Man | Easy | Spend ₡6,000,000 on attribute upgrades (Season 1: 15 of 19 stables, ledger from cycle 36 only) | History (ledger) |
| E28 ⤴ | Back to the Future | Back to the Future | Easy | Recover from a balance below ₡100,000 to above ₡1,000,000 (Season 1: 21 stables) | History (ledger) |
| E29 | SimCity | SimCity | Hard | Own every facility type at level 1+ | History |
| E30 | To Infinity and Beyond | Toy Story | Hard | Upgrade any facility to level 10 | Existing facility event |
| E31 ⤴ | MacGyver | MacGyver | Medium | Spend ₡10,000,000 on repairs (₡1M was reached by 25 of 26 stables) | History |
| E32 | Ready for My Close-Up | Sunset Boulevard | Easy | Upload a custom image for a robot | New: image upload event |
| E33 | Merchandising! | Spaceballs | Easy | Earn ₡500,000 from the Merchandising Hub (Season 1: 23 of 26 stables) | History (ledger) |
| E34 | More Than Meets the Eye | Transformers | Medium | Win battles with all four loadout types (any robots) | History (battle builds) |
| E35 | Ain't Nobody Got Time for That | Meme | Hard | Subscribe one robot to all 9 Booking Office event types at once (needs Booking Office L6; the Season 1 human maximum was L6) | New: subscription event |

### Prestige and fame

| ID | Name | Reference | Tier | Scope | Condition | Data |
|---|---|---|---|---|---|---|
| P11 | Going Viral | Internet culture | Medium | Robot | Earn ₡20,000 streaming revenue from one battle (Season 1: no human robot reached ₡50,000; 30 of 91 reached ₡20,000) | History |
| P12 | Veteran of the Clone Wars | Star Wars | Easy | User | Your stable competed in a previous season | Season archive, re-awarded at rollover |

### Style and quirky

| ID | Name | Reference | Tier | Scope | Condition | Data |
|---|---|---|---|---|---|---|
| S15 ⤴ | Nobody Expects the Spanish Inquisition | Monty Python | Secret | Robot | Win a KotH or Grand Melee as the lowest-ELO robot in the field | Context + participant ELOs |
| S16 | Mirror, Mirror | Star Trek | Secret | Robot | Beat a robot with the same chassis in a 1v1 battle | History (opponent frame) |
| S17 | Gotta Catch 'Em All | Pokémon | Hard | User | Unlock 50 achievements in one season | Unlock count |

Thresholds marked with Season 1 figures were checked on ACC. Calibration changed four tiers from the first proposal (E27, E28 and E33 to easy, E35 to hard) and lowered P11 from ₡50,000 to ₡20,000.

**Win and loss in team and placement modes.** `battles.winner_id` is a robot only in 1v1 modes, so achievements that compare a robot with one opponent (C20, C21, C25–C29, S16) are 1v1-only. Grand Melee and KotH achievements read placement instead.

## 5. Art

| Need | Count |
|---|---|
| Existing achievements without a badge (E18–E26, L18–L30) | 22 |
| New achievements (§4) | 36 |
| **Total new badges** | **58** |

The Trophy marker is UI (chip and label), not new art. No achievement is renamed. The tier accent colour is baked into each badge image, so existing badges that change tier need a recolour to match their new ring. A review of the 77 existing badges also found 8 to redo (wrong subject, off-style or duplicate), 2 secrets in the wrong colour, and 3 that copy franchise characters too literally.

The brief for the image model, with the style block, all 58 subjects and the recolour list: [ACHIEVEMENT_BADGE_ART_GUIDE.md](../design_ux/ACHIEVEMENT_BADGE_ART_GUIDE.md).

## 6. Delivery

Shipped in one PR with the battle-context fix:

- Config (`config/achievements.ts`): `trophy` flag and `TROPHY_REWARDS`, re-tiering, changed conditions, 36 new entries.
- Triggers: Season 2 cases in `triggerEvaluator.ts` (`evaluateSeasonTwoTrigger`), history queries in `services/achievement/historyTriggers.ts`, registration in `EVENT_TRIGGER_MAP`, progress resolvers in `achievementCatalog.ts`.
- New events: `robot_image_uploaded` (image upload confirm), `subscription_changed` (Booking Office routes), `tournament_bye` (`completeByeMatch`), `season_started` (rollover replay, P12), and `achievement_unlocked` (fired by the service after any unlock, for S17). `daily_finances` now runs at every settlement for Human and Automaton stables, not only bankrupt ones.
- Battle context: optional fields for draws, the opponent, kills, placement, KotH zone time, team survival and tournament round; C19 reads the lowest HP from combat events.
- UI: `AchievementReward` shows the Trophy chip on the achievements page, unlock toast and battle report; a reward filter on `/achievements`.
- Trophies write no ledger row and no prestige.

Badges (§5) follow separately. Until they exist, `AchievementBadge` shows its fallback: a tier-coloured hexagon with the achievement ID (for example "E18").

## Appendix: Season 1 unlock rates

Holders out of 23 players, with the median unlock day of the season.

| ID | Tier | Holders | Median day | | ID | Tier | Holders | Median day |
|---|---|---|---|---|---|---|---|---|
| C1 | easy | 23 | 1 | | E1 | easy | 23 | — |
| C2 | easy | 23 | 2 | | E2 | easy | 23 | 3 |
| C3 | easy | 23 | 4 | | E3 | hard | 13 | 75 |
| C4 | medium | 23 | 14 | | E4 | hard | 15 | 72 |
| C5 | medium | 23 | 9 | | E5 | easy | 23 | — |
| C6 | hard | 23 | 27 | | E6 | medium | 6 | 35 |
| C7 | hard | 23 | 17 | | E7 | easy | 16 | 1 |
| C8 | very hard | 17 | 42 | | E8 | easy | 22 | — |
| C9 | easy | 23 | 2 | | E9 | hard | 10 | 73 |
| C10* | medium | 23 | 3 | | E10 | hard | 20 | 34 |
| C11 | hard | 10 | 52 | | E11 | very hard | 18 | 48 |
| C12 | hard | 9 | 37 | | E12 | medium | 13 | 0 |
| C13 | very hard | 6 | 61 | | E13 | hard | 7 | 34 |
| C14 | easy | 23 | 2 | | E14 | very hard | 4 | 42 |
| C15 | easy | 23 | 2 | | E15 | easy | 23 | 0 |
| C16 | easy | 19 | 0 | | E16 | medium | 5 | 69 |
| C17* | secret | 23 | 2 | | E17 | secret | 11 | 15 |
| C18 | hard | 5 | 31 | | E18 | easy | 10 | 32 |
| C19* | secret | 23 | 3 | | E19 | medium | 1 | 59 |
| L1 | easy | 23 | 13 | | E20 | hard | 1 | 39 |
| L2 | medium | 22 | 31 | | E21 | hard | 0 | — |
| L3 | medium | 22 | 54 | | E22 | easy | 13 | 43 |
| L4 | hard | 21 | 76 | | E23 | medium | 8 | 57 |
| L5 | very hard | 9 | 89 | | E24 | hard | 7 | 70 |
| L6 | easy | 23 | 4 | | E25 | hard | 1 | 2 |
| L7 | medium | 23 | 37 | | E26 | hard | 5 | 70 |
| L8 | easy | 17 | 2 | | P1 | medium | 23 | 6 |
| L9 | hard | 14 | 50 | | P2 | hard | 22 | 42 |
| L10 | medium | 6 | 10 | | P3 | very hard | 16 | 59 |
| L11 | very hard | 3 | 17 | | P4 | very hard | 7 | 63 |
| L12 | medium | 22 | 16 | | P5 | easy | 23 | 6 |
| L13 | hard | 15 | 39 | | P6 | medium | 23 | 18 |
| L14 | very hard | 9 | 60 | | P7 | hard | 21 | 58 |
| L15 | easy | 15 | 15 | | P8 | very hard | 12 | 68 |
| L16 | very hard | 11 | 73 | | P9 | easy | 23 | 9 |
| L17 | medium | 17 | 5 | | P10 | hard | 23 | 44 |
| L18 | easy | 17 | 2 | | S1 | easy | 21 | 0 |
| L19 | hard | 17 | 45 | | S2 | easy | 11 | — |
| L20 | easy | 13 | 12 | | S3 | easy | 19 | — |
| L21 | hard | 12 | 50 | | S4 | medium | 8 | 30 |
| L22 | easy | 2 | 8 | | S5 | medium | 20 | 12 |
| L23 | hard | 1 | 23 | | S6 | medium | 22 | 8 |
| L24 | easy | 3 | 14 | | S7 | medium | 13 | 11 |
| L25 | hard | 2 | 16 | | S8* | hard | 23 | 2 |
| L26 | easy | 22 | 7 | | S9* | secret | 18 | 33 |
| L27 | medium | 17 | 35 | | S10 | secret | 18 | 32 |
| L28 | hard | 7 | 76 | | S11 | secret | 15 | 15 |
| L29 | medium | 17 | 28 | | S12 | secret | 18 | 22 |
| L30 | hard | 19 | 12 | | S13 | medium | 23 | 12 |
| | | | | | S14 | secret | 4 | 79 |

\* Inflated by the battle-context bug. "—" means unlocked before the season start timestamp (re-awarded at rollover).
