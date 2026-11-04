# Achievement Badge Art Guide

**Date:** November 4, 2026 · **Related:** [ACHIEVEMENTS_SEASON_2_REVAMP.md](../analysis/ACHIEVEMENTS_SEASON_2_REVAMP.md), [PRD_ACHIEVEMENT_SYSTEM.md](../game-systems/PRD_ACHIEVEMENT_SYSTEM.md)

> **Status:** all badges in Parts 2–4 are delivered. The badges still to fix are in [ACHIEVEMENT_BADGE_ART_FOLLOWUPS.md](ACHIEVEMENT_BADGE_ART_FOLLOWUPS.md).

A brief for generating achievement badges with an image model.

- **Part 1:** the shared style block, which goes into every prompt.
- **Part 2:** the 58 badges that don't exist yet, with a subject for each.
- **Part 3:** a review of the 77 existing badges: which are wrong and need redoing.
- **Part 4:** existing badges that only need a recolour because their tier changes.

The style is taken from the existing badges, not from the PRD's older "flat design" description. The badges are rendered metal, not flat. Good references: C1 "I'll Be Back", C12 "Resistance Is Futile", S5 "Turtle Mode Activated", S9 "Glass Cannon".

## How to use

1. Attach 2–3 existing badges as style references if the model accepts image input. Pick ones with the same accent colour as the badge you are making.
2. Paste the **style block** with the tier's accent filled in, then the badge's **subject line**.
3. Generate square, at 1024×1024 or larger.
4. Export as `achievement-<id>-128.webp` (lowercase ID, for example `achievement-e18-128.webp`), 128×128, WebP quality about 85. Place it in `app/frontend/src/assets/achievements/`. With cwebp (`brew install webp`): `cwebp -q 85 -resize 128 128 in.png -o achievement-e18-128.webp`. Or drop the PNGs anywhere in the repo, named by ID, and the conversion can be done for you.
5. Check the result at 64 px. The subject must still read at that size.

**For a consistent frame:** generate one badge per accent colour that you're happy with, then ask the model to keep the frame and replace only the central object ("same frame, same lighting, replace the central object with …"). The frame drifts much less that way than with fresh generations.

## Part 1: Style block

```
Game achievement badge, single centered emblem inside a pointy-top hexagon (vertices at top and bottom, flat left and right sides) that fills the square canvas edge to edge.
Frame: thick dark gunmetal bezel with beveled edges, fine panel seams and machined industrial detail; a thin inner rim glowing in {ACCENT}; a small round gem set into the bottom vertex of the frame, glowing {ACCENT}.
Inside: very dark charcoal background with a soft radial {ACCENT} glow behind the subject, subtle smoke or particles.
Subject: ONE hard-surface object or figure, 3D-rendered, polished and worn metal, dramatic rim lighting with {ACCENT} highlights, strong silhouette, high contrast, centered, filling about 60% of the hexagon.
Mood: industrial sci-fi robot combat, premium game UI icon.
No text, no letters, no numbers, no logos, no watermark, no real people, no recognisable copyrighted characters.
```

**Accent by tier.** The UI draws a ring in the same colour on top of the image, so the baked-in accent must match the tier:

| Tier | {ACCENT} | Hex |
|---|---|---|
| Easy | emerald green | `#3fb950` |
| Medium | electric blue | `#58a6ff` |
| Hard | amber orange | `#d29922` |
| Very hard | crimson red | `#f85149` |
| Secret | violet purple | `#a371f7` |

Secrets use the purple accent like any other tier (see C17, S9, S10, S14). Locked secrets show a generic "???" badge in the UI, so the art is only seen once unlocked.

**Example of a complete prompt** (C24, easy):

```
Game achievement badge, single centered emblem inside a pointy-top hexagon (vertices at top and bottom, flat left and right sides) that fills the square canvas edge to edge.
Frame: thick dark gunmetal bezel with beveled edges, fine panel seams and machined industrial detail; a thin inner rim glowing in emerald green; a small round gem set into the bottom vertex of the frame, glowing emerald green.
Inside: very dark charcoal background with a soft radial emerald green glow behind the subject, subtle smoke or particles.
Subject: ONE hard-surface object or figure, 3D-rendered, polished and worn metal, dramatic rim lighting with emerald green highlights, strong silhouette, high contrast, centered, filling about 60% of the hexagon.
Mood: industrial sci-fi robot combat, premium game UI icon.
No text, no letters, no numbers, no logos, no watermark, no real people, no recognisable copyrighted characters.
The subject: a small scrapped robot lying flat with X-shaped eyes and a little halo floating above its head.
```

**Rules for every subject:**
- References are suggestive, not literal. Hint at the film, show or meme with an object or a pose, never the actual character or logo. For example a scanning red eye, not a specific robot; a bent spoon, not a scene from the film.
- One idea per badge. The subject must read as a silhouette at 64 px.
- Robots are generic industrial combat robots, not designs from a franchise.

## Part 2: Badges to create (58)

The tiers are the final Season 2 tiers. 🏆 marks a Trophy (badge only, no reward). The art doesn't change for Trophies: the UI adds the Trophy marker.

### Existing achievements without art (22)

| File ID | Name | Tier | Subject line |
|---|---|---|---|
| e18 | Pawn Star | Medium | A combat robot's weapon lying on a pawnshop counter with a paper price tag tied to the grip |
| e19 | Shrewd Negotiator | Very hard | Two heavy mechanical hands shaking firmly above a tall stack of glowing credit coins |
| e20 | Arms Dealer | Very hard | An open armoured briefcase lined with foam, holding several different weapon silhouettes |
| e21 | Buy High, Sell Higher | Hard | A sharply rising stock-chart arrow made of metal, breaking upward through a weapon blueprint |
| e22 | First Refinement | Medium | A glowing hammer striking a blade on an anvil, one bright burst of sparks |
| e23 | Master Craftsman | Hard | Crossed smithing hammer and precision calipers above an anvil etched with glowing lines |
| e24 | Legendary Smith | Hard | A blade standing in an anvil, radiating light, with five glowing notches along its edge |
| e25 | Identity Forged | Very hard | A simple training sword, its lower half plain and scuffed, its upper half reforged into gleaming ornate metal |
| e26 | Forge Master | Hard | A blade with four glowing sockets in its spine: two filled with whetstone sparks, two with forge flames |
| l18 | Daft Punk | Medium | Two sleek mirrored-visor robot helmets side by side, one chrome silver and one gold |
| l19 | Twins! | Medium | Two identical robot heads seen from the front, side by side and mirror-symmetric, one eye glowing on each (not back to back: that pose is already "Dynamic Duo", L16) |
| l20 | Three Laws Safe | Medium | A triangular metal emblem with a small robot head at each of its three corners |
| l21 | Voltron | Medium | Three different robot limbs locking together into one giant mechanical fist |
| l22 | R2-D2 & C-3PO 🏆 | Very hard | Two mismatched generic robots side by side behind a trophy cup: a short, squat, wheeled one and a tall, thin, humanoid one (generic industrial designs, not the film droids) |
| l23 | Jaeger Pilots 🏆 | Very hard | Two pilot helmets linked by a glowing beam, above the knuckles of a giant mech fist |
| l24 | Triforce 🏆 | Very hard | Three metallic triangles stacked into one larger glowing triangle, a trophy cup above |
| l25 | Devastator 🏆 | Very hard | A hulking robot assembled from construction machinery: excavator arm, bulldozer blade, crane boom |
| l26 | Real Steel | Easy | A boxing robot with raised gloved fists in a fighting stance |
| l27 | The Hunger Bots | Medium | A robot hand raising three fingers in salute in front of a ring of arena fire |
| l28 | Omega Supreme | Hard | A towering robot rising out of a rocket launch gantry, exhaust glow at its feet |
| l29 | Cockroach Protocol | Medium | An armoured mechanical cockroach, plated shell, antennae up |
| l30 | Untouchable | Easy | A robot inside a glowing force-field bubble, debris bouncing off it |

### New achievements (36)

| File ID | Name | Tier | Subject line |
|---|---|---|---|
| c20 | Moral Victory | Easy | A battered robot fist still clenched in defiance, a small glowing upward arrow beside it |
| c21 | Not Like This | Easy | A cracked robot visor reflecting an opponent's health gauge with only a sliver of red left |
| c22 | Shall We Play a Game? | Easy | A tic-tac-toe grid fully filled with no winner, glowing on a retro green-phosphor terminal screen |
| c23 | Run Away! | Easy | A robot sprinting away in a cloud of dust, a small white flag in its hand |
| c24 | Oh My God, They Killed Kenny! | Easy | A small scrapped robot lying flat with X-shaped eyes and a little halo floating above its head |
| c25 | Eye of the Tiger | Medium | A robot fist wrapped in boxing tape, tiger-stripe pattern glowing across the forearm plating |
| c26 | Revenge of the Fallen | Medium | A damaged robot rising out of a crater, eyes glowing, cracked armour |
| c27 | Judge Me by My Size, Do You? | Medium | A tiny robot standing proudly on top of a toppled giant robot head |
| c28 | The Neverending Story | Hard | A metal hourglass with small gears instead of sand, an infinity loop engraved on its frame |
| c29 | This Is My Boomstick | Hard | A plain, scuffed starter blaster held up high by a robot arm, crackling with power |
| c30 | Run, Forrest, Run! | Easy | A robot mid-sprint as metal leg braces burst apart and fly off its legs |
| l31 | Return of the Jedi | Medium | A robot climbing a staircase of glowing chevron steps, one step below it cracked |
| l32 | Round One… Fight! | Easy | Two robot fists meeting mid-air with a bright impact flash between them |
| l33 | The Final Countdown | Medium | A tournament bracket diagram in glowing metal, the last four slots lit |
| l34 | I've Got a Bad Feeling About This | Medium | A slightly tarnished silver second-place medal hanging from a robot claw |
| l35 | Free Real Estate | Secret | A single robot standing alone in an empty arena, casually waving |
| l36 | Red Shirt | Secret | A robot in a plain red tunic stepping forward into a harsh spotlight |
| l37 | Stayin' Alive | Easy | A battle-scarred robot striking a disco pose under a mirror ball |
| l38 | Rampage | Hard | A hulking robot beating its chest, three wrecked robots at its feet |
| l39 | The Last Starfighter | Medium | A lone robot standing inside a glowing circular zone, starfield behind it |
| l40 | This Is Sparta! | Medium | A robot with a round shield and crested helmet delivering a front kick at the edge of a glowing ring |
| l41 | Ohana | Medium | Three robots of different sizes standing together holding hands, a small flower garland around the smallest |
| e27 | Better, Stronger, Faster | Easy | A bionic robot arm with exposed glowing circuitry and upward chevrons |
| e28 | Back to the Future | Easy | Two fiery tyre tracks leading up to a stack of credit coins |
| e29 | SimCity | Hard | A miniature industrial complex of different factory buildings on a single hexagonal tile |
| e30 | To Infinity and Beyond | Hard | A facility tower lifting off on rocket boosters, ten glowing rings around it |
| e31 | MacGyver | Medium | A roll of duct tape, a wrench and a paperclip bound together into one tool |
| e32 | Ready for My Close-Up | Easy | A vintage film camera lens focused on a framed robot portrait |
| e33 | Merchandising! | Easy | A robot action figure sealed in blister-pack toy packaging |
| e34 | More Than Meets the Eye | Medium | A robot mid-transformation with four different arms: sword, shield, heavy two-handed cannon, twin pistols |
| e35 | Ain't Nobody Got Time for That | Hard | A robot clipboard overflowing with clipped event tickets and passes |
| p11 | Going Viral | Medium | A play-button icon bursting into dozens of small glowing screens |
| p12 | Veteran of the Clone Wars | Easy | A worn robot helmet with service stripes painted on its side |
| s15 | Nobody Expects the Spanish Inquisition | Secret | A small robot in a red cardinal's robe bursting through a doorway |
| s16 | Mirror, Mirror | Secret | Two identical robots facing each other, one with a darker faceplate and a short metal goatee |
| s17 | Gotta Catch 'Em All | Hard | A glass display case filled with rows of small hexagonal badges |

## Part 3: Review of the existing 77 badges

I compared every existing badge with its achievement (name, condition, the icon the PRD describes, and its Season 2 tier). 52 are fine as they are, or need only the recolour in Part 4. The rest:

### Redo (wrong subject, wrong style or wrong colour) — 10

These need a new generation with the Part 1 style block. The tier is the Season 2 tier.

| File ID | Name | Tier | What's wrong | New subject line |
|---|---|---|---|---|
| e9 | Fully Operational | Medium | Wrong subject: shows a treasure chest of cash and gold bars, but the condition is an effective attribute of 50. Wrong colour (green) and flat studded frame. | A robot attribute gauge with its needle pinned in the maximum zone, the dial glowing at full power |
| e2 | The Odds Are 725 to 1 | Easy | Off-style: all-gold frame and gold background. The figure is an almost exact copy of the film's golden protocol droid. | A slim generic humanoid robot nervously holding up a cracked calculator display, worried posture |
| e4 | Scrooge McDuck | Medium | Off-style: flat cartoon, orange-filled frame with grey studs. The diving duck silhouette is close to the Disney character. | A robot diving headfirst into a vault overflowing with credit coins, coins splashing up |
| p4 | Legendary 🏆 | Hard | Off-style: flat red frame and flat background, no gunmetal bezel. The colour changes anyway (very hard → hard). | A metal dragon coiled around a prestige crest, wings half spread |
| p8 | Mythical Proportions | Medium | Flatter than the rest, red-filled frame. The colour changes anyway (very hard → medium). | Same idea, in style: a cracked Greek marble column wrapped in a metal laurel wreath |
| c19 | Peace Through Tyranny | Secret | Wrong colour: orange, but it's a secret (purple). The subject is fine. | Recolour only to violet purple (edit prompt in Part 4) |
| e17 | Bankrupt! | Secret | Wrong colour: silver with no accent, but it's a secret (purple). The subject is fine. | Recolour only to violet purple |
| c10 | It's Just a Flesh Wound | Medium | Missing the joke: the knight still has both arms. The Black Knight gag is that he has lost them. It also looks very like L17 "I Work Alone" (same dark knight). | A battered armoured knight standing defiantly with both arms missing at the shoulders, sparking stumps, sword on the ground |
| e14 | Rise of the Machines | Hard | Same image as E13 "Robot Army" (robots marching in formation), and both are orange from Season 2. | Rows of robots rising out of a factory floor on assembly arms, a red sunrise behind them |
| l14 | The Chosen One 🏆 | Hard | Same composition as C13 "Look What They Need to Mimic…" (a glowing red humanoid figure floating), and both are hard Trophies from Season 2. | A lone robot standing in a beam of light from above, surrounded by a ring of code streaming upward |

### Likely copyright risk — consider redoing — 3

The PRD's own rule is "suggestive, not literal". These three show the actual franchise characters. This is a judgement call, not legal advice.

| File ID | Name | What it shows | Suggested subject line |
|---|---|---|---|
| l8 | WALL-E and EVE | Clearly the Pixar characters (box robot with binocular eyes, white egg robot) | Two small robots of very different builds holding hands, one boxy and battered, one sleek and rounded (generic designs) |
| c18 | Autobots, Roll Out! | A yellow robot with a recognisably Transformers-style face above a truck cab | A semi-truck front grille splitting open into robot shoulders, generic design, no faction emblem |
| c7 | Exterminate! | A dome very close to a Dalek | Less risky than the two above. Optional: a domed robot turret with a single plunger-like arm, rendered in our own style |

### Minor — fix if convenient — 6

| File ID | Name | Note |
|---|---|---|
| e1 | Hello World | The terminal is almost empty and reads as a black rectangle at 64 px. Suggested: a bold glowing `>_` prompt on a small rugged terminal. |
| p7 | Legendary Status | "LEGENDARY STATUS" text is baked in and unreadable at 64 px, and a skull sits in the middle. Suggested: a metal star set in a dark pavement, with no text. |
| p5 | 15 Minutes of Fame | Green panel frame instead of the gunmetal bezel. |
| p9 | Influencer | Gold/brown frame instead of the gunmetal bezel. |
| s11 | R2-D2 Would Be Proud | Shows a humanoid robot with a shield, not a small astromech-like droid. It fits the new condition (reserve robot saves the day) well enough. Leave as is. |
| e3 | Show Me the Money | The bag shows a `$`; the game currency is ₡. Optional. |

L12 "ELO-quent" (1400) and P1 "Established" (EST.) show text on purpose, as the PRD describes. They are fine.

## Part 4: Recolours because the tier changes (37)

The accent colour is baked into each image, and re-tiering moves badges that already have art to a new tier. Left as they are, the image glows in the old colour while the UI ring shows the new one. Badges already listed for a redo in Part 3 (E4, E9, P4, P8, E14, L14) aren't repeated here.

Edit prompt, attaching the existing badge:

```
Keep this badge exactly the same: same frame, same subject, same composition and lighting. Only change every accent colour (inner rim, bottom gem, glow, highlights) from {OLD} to {NEW}.
```

| New colour | Badges (old colour) |
|---|---|
| Green (easy) | From blue: C4, C5, L2, L3, L7, L12, P1, P6, S5, S6, S13 · From orange: C6, C7, L4, E10, P2, P7, P10, S8 · From red: E11 |
| Blue (medium) | From green: L8, L15, E7, S2 · From orange: C11, L9, L13, E3 · From red: C8, L16, P3 |
| Orange (hard) | From blue: E6, E16, S4, L10 🏆 · From red: L5 🏆, C13 🏆 |
| Purple (secret) | C19 (from orange), E17 (from silver), listed in Part 3 too |

If you redo C7, L8 or P7 from Part 3, generate them directly in the new colour and skip their recolour.

Trophies are re-tiered by the same bands as everything else, because their tier now only shows how hard they are.

## Totals

| Work | Badges |
|---|---|
| New badges (Part 2) | 58 |
| Redo (Part 3, excluding the two recolours) | 8 |
| Recolour (Part 4: 37 for the tier change, plus C19 and E17 to purple) | 39 |
| Optional (copyright and minor, Part 3) | up to 8 |
