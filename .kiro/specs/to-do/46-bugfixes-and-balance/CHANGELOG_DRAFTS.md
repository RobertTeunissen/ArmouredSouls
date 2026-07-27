# Changelog Drafts — Spec #46

`ChangelogEntry` rows are created through the admin portal (`/admin/changelog`), not through a file in the repository. This document holds the drafted `title`, `category`, and `body` for each entry Spec #46 requires, so the deploy-time changelog review is a paste rather than a rewrite.

Create each as `status: 'draft'`, `sourceType: 'spec'`, `sourceRef: '46-bugfixes-and-balance'`, then publish with the deploy.

| # | Category | Title | Requirement |
|---|----------|-------|-------------|
| 1 | `balance` | Sharpen and Forge now scale with your weapon | 3.25 |
| 2 | `feature` | Hall of Records pruned | 4.28 |
| 3 | `feature` | League win streaks in the Hall of Records | 7.24 |
| 4 | `bugfix` | Nine achievements are now obtainable | 8.31 |

---

## 1. `balance` — Sharpen and Forge now scale with your weapon

**Title**: `Sharpen and Forge now scale with your weapon`

**Category**: `balance`

**Body**:

Sharpen and Forge were flat: every Sharpen removed 0.25s of cooldown and every Forge added 1.0 base damage, no matter which weapon it went into. A flat bonus against a variable base is worth far more to a small base, so a 2.0s one-handed weapon got a +33% attack rate at the Sharpen cap while a 6.0s two-handed weapon got +9% — for the same ₡1.2M. Forge had the same bias, and because the fast weapons in the catalog are also the low-damage one-handed ones, the two stacked into a single one-handed subsidy.

Both tiers are now proportional:

- **Sharpen**: −10% base cooldown per slot, −20% at the cap of 2
- **Forge**: +8% base damage per slot, +16% at the cap of 2

Every weapon now gets the same percentage for the same price. Stacking is additive against the weapon's catalog value, so two Sharpens land on exactly ×0.80 rather than the ×0.81 that compounding would give.

**This applies to refinements you already own.** The effect is calculated from the tier, not stored, so every existing Sharpen and Forge is recomputed on deploy. Fast one-handed builds lose a small amount of Sharpen value — a twice-Sharpened 2.0s weapon goes from 1.5s to 1.6s. Slow two-handed builds gain substantially — a twice-Sharpened 6.0s weapon goes from 5.5s to 4.8s. Costs, slot caps, per-tier caps, and Workshop unlock levels are all unchanged, and no refinement slot is refunded or freed.

---

## 2. `feature` — Hall of Records pruned

**Title**: `Hall of Records: five categories retired, damage records split by mode`

**Category**: `feature`

**Body**:

A record is only worth a leaderboard if different performances produce different numbers. Five categories did not clear that bar, so they have been retired rather than filtered:

- **Longest Battle** — the 120-second limit forces a draw, so every entry read exactly 2:00
- **Fastest Victory** — the top of the list was degenerate one-second resolutions, not skill
- **Biggest ELO Gain** and **Biggest ELO Loss** — the ELO K-factor is a fixed 32, so every entry read +32 or −32
- **Best Placement (KotH)** — any robot that has ever won a KotH match has a best placement of 1, so the whole list tied for first

If you held a position in one of these, it is gone. Nothing else was recalculated.

**Most Damage in a Single Battle is now ranked per mode.** A single combined list was really measuring which mode has the most targets: a Grand Melee robot swings at 19 opponents over the same clock a 1v1 robot spends on one. There are now separate rankings for 1v1 League, 1v1 Tournament, 2v2 League, 3v3 League, King of the Hill, and Grand Melee.

**Biggest Upset is now tournament-only, and team tournaments have their own list.** League matchmaking deliberately pairs robots of comparable standing, so a league "upset" was measuring the matchmaker rather than an underdog. Tournament brackets are seeded, so beating a high seed is a real upset. Team tournament upsets are ranked on *combined* team rating, so a 2v2 or 3v3 upset reports a larger gap than a 1v1 one — as it should, since two or three rating gaps had to be overcome.

**Also fixed**: Grand Melee kills were being recorded as zero for every robot, King of the Hill zone scores were displaying raw floating-point noise like `1642.7000000000005`, and clicking certain battles from the Hall of Records returned an error instead of the battle. Career records now state which modes each one covers, since King of the Hill and Grand Melee resolve by placement and do not feed the win/loss counters.

---

## 3. `feature` — League win streaks in the Hall of Records

**Title**: `New Hall of Records tab: league win streaks`

**Category**: `feature`

**Body**:

The Hall of Records has a new **Win Streaks** tab ranking the longest league win streaks ever achieved, with all four modes shown side by side so you can compare across them: 1v1 League, 2v2 League, 3v3 League, and Tag Team.

Each entry shows the best streak ever reached, the streak currently running, and a marker when the two are the same — meaning that streak is still alive and can still grow.

Tournament modes are absent because tournament results do not feed the streak counters. Grand Melee is absent by design: a win there is placement 1 of 20, so streaks would sit near zero for everyone and would not compare meaningfully against a league streak. King of the Hill already has its own streak record on its own tab.

One caveat worth knowing: a bye in 1v1 League counts as a win for league points, and it counts toward your streak the same way. A walkover can extend a streak.

---

## 4. `bugfix` — Nine achievements are now obtainable

**Title**: `Nine achievements that could never unlock are fixed`

**Category**: `bugfix`

**Body**:

Nine achievements had zero unlocks across more than 40 cycles. None of them were hard — all nine were impossible. Three separate faults:

**Team achievements read the wrong records.** Dynamic Duo, Twins!, and Voltron count Tag Team, 2v2, and 3v3 wins, but the check was looking those up against your robot instead of against your team. Team wins are recorded on the team. Every lookup came back empty and was treated as zero.

- **Dynamic Duo** (L16) — 40 Tag Team wins
- **Twins!** (L19) — 25 2v2 League wins
- **Voltron** (L21) — 25 3v3 League wins

**The upset achievement compared the wrong number.** Never Tell Me the Odds asks you to beat an opponent rated 150 or more above you. The check was reading how much rating *you gained*, which is capped at 32 — so it could never reach 150 no matter who you beat. It now compares the actual rating gap between you and your opponent before the battle.

- **Never Tell Me the Odds** (C11)

**Grand Melee achievements were never wired up.** All five Grand Melee achievements existed in the list but nothing ever counted Grand Melee results toward them, and nothing ever evaluated them.

- **Real Steel** (L26) — win 1 Grand Melee
- **The Hunger Bots** (L27) — win 5
- **Omega Supreme** (L28) — win 20
- **Cockroach Protocol** (L29) — 10 top-3 finishes
- **Untouchable** (L30) — win with more than 75% HP remaining

**Important: you may already qualify, and the badge will appear after your next match in that mode.** Achievements are evaluated when a battle finishes, not on a schedule, so if you already have 25 2v2 wins banked, Twins! unlocks the next time your 2v2 team fights — not the moment this update lands. The delay is expected and does not mean the fix failed.

Progress bars on the affected achievement cards now show real numbers too, where before they read zero regardless of your record.

---

## 5. `balance` — Training Facility now rewards a focused roster

**Title**: `Training Facility discount now depends on your roster size`

**Category**: `balance`

**Body**:

The Training Facility gave a flat 10% off attribute upgrades per level, capped at 90%. That had two problems. The cap was reached at level 9, so **level 10 was worth literally nothing** — the facility's maximum level had been removed for that reason. And the discount ignored your roster entirely, so a ten-robot stable got the same rate per level as a one-robot stable while having ten times as many attributes to pay for.

The discount rate now shrinks as your roster grows:

**Discount = level × (10 − your robot slots)%, capped at 90%**

| Facility Level | 1 slot | 2 slots | 4 slots | 7 slots | 10 slots |
|---|---|---|---|---|---|
| 5 | 45% | 40% | 30% | 15% | 0% |
| 8 | 72% | 64% | 48% | 24% | 0% |
| 10 | **90%** | 80% | 60% | 30% | 0% |

**Level 10 is now unlocked** and costs ₡1,500,000 with no prestige requirement. It is the only way to reach the 90% maximum, and only a single-robot stable gets there.

What this means for you:

- **Focused stables gain.** One or two robots now get a deeper discount than the old formula ever offered at a reachable level, and level 10 is finally worth buying.
- **Wide stables lose.** At 10 robot slots the facility grants no discount at any level. If that is you, this facility is no longer a useful investment — and the Facilities page will now tell you so directly instead of quoting a number you do not receive.
- **Roster Expansion and the Training Facility now pull against each other.** Every slot you add permanently costs you 1 percentage point per facility level. That is deliberate: alongside the Merchandising Hub change, the game now has facilities that reward depth as well as ones that reward breadth. The Streaming Studio remains the breadth option.

Your existing facility level is unchanged and nothing is refunded. The Facilities page shows your real discount against your own roster, and the upgrade cost previews on the robot and Practice Arena pages match what you are actually charged.
