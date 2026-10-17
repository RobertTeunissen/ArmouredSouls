# Season 2 balance: product decisions

**Season:** 2. **Status:** all decisions implemented and live on ACC (#536, #537, #540, #541). Parent issue: #516.

This is the decision log agreed with the product owner, issue by issue, including the reasoning and the options rejected. It was written while the work was in progress, so later sections can refine earlier ones (e.g. round 2 and round 3 adjust #520 and #519); the latest section on a topic wins. The resulting values and measurements are in [SEASON_2_BALANCE_PACKAGE.md](SEASON_2_BALANCE_PACKAGE.md), [SEASON_2_ECONOMY_REBALANCE.md](SEASON_2_ECONOMY_REBALANCE.md) and [NEXT_SEASON_BALANCE_VALIDATION.md](../analysis/NEXT_SEASON_BALANCE_VALIDATION.md). Follow-ups: #542, #543, #544.

## #519 Hydraulic Systems and its ranged mirror (decided)

- No caps anywhere. Players can't see when stacked bonuses hit a hidden ceiling, so investment must always count. The issue's clamp at 50 is rejected.
- Root problem: Hydraulic Systems is the only specialist damage attribute, and it favours melee and short range. Nothing scales mid/long damage (only the flat 1.1× optimal-band range modifier).
- Hydraulic Systems stays linear and distance-based, but one step less steep: melee 0.02 → 0.015, short 0.015 → 0.01 (at H=50: 1.75× / 1.5×). Confirmed.
- Logic Cores mirror coefficients: long 0.015, mid 0.01 (at L=50: 1.75× / 1.5×). Confirmed.
- New ranged mirror: **Logic Cores** gets a distance-based damage bonus. It mirrors Hydraulic Systems exactly: long range uses the hydraulic melee coefficient, mid range the hydraulic short coefficient, and short/melee get none. It's damage only (no accuracy), based on the current distance band (not the weapon's band), and uncapped.
- Logic Cores keeps its existing pressure/composure role.
- Chosen over Adaptive AI because Logic Cores is the weakest attribute (inactive above its HP threshold, and its value is mostly avoiding a penalty), has the best theme ("smart link" firing solutions), and keeps the trade-off clean: melee buys Hydraulic Systems, ranged buys Logic Cores. Targeting Systems was rejected because everyone already invests in it for hit chance.
- Revisit the exact coefficients after the whole package is rebalanced; a per-attribute marginal-value analysis comes later, not now.

## #520 Pursuit vs kiting: an engagement cycle (decided)

Design intent from the product owner:
- A long-range robot must not be able to kite melee indefinitely and pick it off.
- A ranged robot caught in melee must have a chance to escape back to range.
- Today only the first goal is served (over-served), and every match drifts towards melee. The aim is more dynamic matches and more frequent range switching.

Rules:
- **Base movement:** pursuit and kiting both 1.10×. Remove both speed-compensation terms (`CLOSING_BONUS_PER_DIFF`, `KITING_BONUS_PER_DIFF`), so Servo Motors investment decides the speed race.
- **Defensive stance:** always the normal factor (0.80), including while pursuing. Remove the 0.95 exception.
- **Role:** derived from the robot's actual engagement range, not `weaponType === 'melee'` of the main weapon. Melee-range energy weapons count as melee. An offhand sword doesn't make a long-range robot a pursuer.
- **Prediction stays** as is (Combat Algorithms-scaled lead, off in melee mirrors and the final approach, per #351/#467).
- **Melee commit (patience role):** if a melee robot hasn't landed a hit within its patience window (`getPatienceLimit()`, ~15 s down to ~10 s as Combat Algorithms rises), it commits: pursuit at 1.30×, strain-free, until it's within reach. Patience resets on a landed hit (as since #518).
- **Ranged disengage (new):** when a ranged robot takes its first melee hit in an engagement, it gets an escape burst at 1.30×, strain-free, then a cooldown of about one patience window. The burst duration scales with **Evasion Thrusters** (Servo Motors already drives speed). Proposed duration: 2 s + 0.04 s per Evasion Thrusters point (≈3 s at 25, 4 s at 50, uncapped). This guarantees melee at least one exchange per engagement and ranged at most one escape.
- **Wall-aware retreat:** a robot retreating into the arena wall slides tangentially along it (deterministic, respecting speed, collision and no-teleport) instead of getting stuck.
- Keep the existing mutual-melee final-approach behaviour and the strain model otherwise unchanged.

## #521 Shields and loadouts (decided, except shield pricing)

- Rationale (product owner): shields are cheap compared to attribute points, because Weapon Workshop discounts bring an Aegis under 100k late-game while 55 attribute points cost millions (plus Academies). Armor plus Shield Capacity is also a repair-free HP buffer. So the premium-shield cut is justified.
- **Catalogue:** Fortress Shield armor 15 → 11, shield capacity 14 → 10, counters 10 → 8. Aegis Bulwark armor 15 → 11, shield capacity 15 → 11, counters 14 → 10, power core 11 → 8. Negative mobility bonuses and the cheaper shields stay unchanged. Price: OPEN (see below).
- **Weapon+Shield passive:** shield capacity +20% → +15%, armor +15% → +10%, counters +10% (unchanged), attack speed −15% (unchanged). Approved.
- **Single loadout:** mobility identity ("fewer weapons, lighter, faster"): gyro +10% → +15%, servo +5% → +10%. It stays the weakest loadout (lowest investment) but should be competitive (target roughly 42–45% against the others, from 28–33%). Approved.
- **Rollout:** the least-work route. Change `WEAPON_DEFINITIONS` in `app/backend/prisma/seed.ts`. Deploy runs `prisma db seed` on ACC, which upserts weapons by name, and owned items reference the catalogue row, so every owner gets the new values. No separate data migration or versioned catalogue. The implementer must verify that refinements are stored as deltas and fold on top of the new base.

## Weapon pricing formula (decided)

- Bug: the formula `Σ(500 × bonus²)` squares negative bonuses too, so penalties raise the price. Fix: attribute cost = `m × (Σ bonus, negatives included)²`.
- `m = 500` for the whole shop. This intentionally makes high-end items more expensive and creates longer upgrade paths. Entry and budget weapons barely move, because m only scales the attribute part; base and DPS cost are unchanged.
- Hand multipliers: one-handed 1.0, **two-handed 1.6 → 1.5** (reinforces the two-handed strategy), **shield 0.9 → 1.3** (shields give repair-free HP, so they get a premium instead of a discount).
- Full price = `(50,000 base + DPS cost + m × (Σ bonus)²) × hand multiplier`, rounded to the nearest 1,000. Apply to every catalogue item via `WEAPON_DEFINITIONS` in `seed.ts`, including the #521 shield values. Owners keep their `pricePaid` for resale.
- Move the formula into `app/shared/utils/`, with a test that every catalogue price matches it.
- Indicative prices at m = 500, before the two-handed change: Ion Beam ~963k, Vibro Mace ~688k, Aegis ~690k, Railgun ~660k, Power Sword ~456k, Fortress ~380k, Barrier ~253k, Combat Shield ~158k, Light Shield ~81k; budget weapons 87–100k; practice weapons 50k. Catalogue total ~+31% (11.0M → 14.4M).
- Follow-up after #519/#520: if Vibro Mace or Power Sword is still an outlier, lower their Hydraulic Systems bonus (reserve lever from #516), not their price.

## Weapons Workshop and refinement facility (decided; part of this package)

- Economy is not a concern: one ACC stable earns >4M credits per cycle at cycle 75.
- **Workshop discount:** 10% → **5% per level** (max 50% at L10, which was 100%/free). **Resale** unchanged at 10% per level of `pricePaid` (so at L10: buy at half price, sell back at full paid price, which supports trading up).
- **New refinement facility** that takes over the refinement tier gates from the Workshop (hone L1, augment L3, sharpen L5, forge L8). Costs and prestige gates mirror the Weapons Workshop (75k → 750k per level, `PRESTIGE_GATES_10`). Name: TBD.
- **Facility categories (14 facilities, 4-4-4-2):**
  - **Economy:** Repair Bay, Training Facility, Merchandising Hub, Streaming Studio (renamed from "Economy & Discounts")
  - **Hangar & Armory:** Roster Expansion, Storage Facility, Weapons Workshop, refinement facility (renamed from "Capacity & Storage")
  - **Training Academies:** unchanged
  - **Tactical & Advanced:** Tuning Bay, Booking Office (unchanged)
- **Existing players:** a one-off grant of the new facility at their current Workshop level, so nobody loses refinement tiers they've unlocked. It must be a clean cut with no lingering runtime code: do it as a one-off data migration (runs once at deploy), not as compatibility logic in services. Doing it at season rollover is an acceptable alternative if that's materially simpler.
- Update facility guide pages, the facility overview, ROI/advice, achievements and onboarding references that mention the Workshop's refinement role.
- Refinement facility name: **Refinement Lab**.

## #522 KotH zone (decided)

- Default zone radius **5 → 7**. Arena radius 14, score target 30, time limit 150 s and kill bonus 5 stay unchanged. The allowed config range stays 3–8.
- Write the zone radius onto the match at scheduling (no implicit fallback to the default for new matches), so a future default change can't alter stored matches. Playback keeps using recorded event data.
- Remove the leftovers of the abolished rotating-zone variant (Spec #41): `generateNextZonePosition` in `kothZone.ts`, `transitionTarget` in `kothConfig.ts`, the rotating-related defaults/comments (`zoneTransitionDuration`, `zoneWarningTime`, the "210 rotating" duration in `kothGameMode.ts`) if unused, and the "fixed and rotating zone variants" text in the `king-of-the-hill/match-formats` guide. Verify each is unreachable before deleting.
- All rotating-zone leftovers are dead code and must be removed (confirmed by the product owner).
- Arena radius stays 14 (decided).

## #523 Grand Melee (decided)

- The 89–100% "timeout" figures from the baseline report came from local simulation with uniform-level builds (all 23 attributes equal). That's a stalemate artefact of equally matched robots; GM uses `allowDraws: false`, so a time limit ends as "⏱ Time limit! X wins by HP". The product owner checked ~10 ACC Grand Melees: all ended by elimination. There's no timeout problem on ACC.
- No Grand Melee rule changes in this package. Re-assess the original #523 question (melee/shield dominance in placements) after #519–#522 are live, using ACC results.
- Measurement caveat for this package: uniform-level harness builds overstate timeouts in every mode. Prefer #516's equal-investment builds when measuring, and treat timeout rates from uniform builds as indicative only.

## #520 addendum: movement fix (decided)

Found during FEAT-003: a pre-existing tick-order chase stall.
- **The bug:** within a tick, robots move one after another, each deciding from the positions at that moment, and a melee robot aims at a point 1 unit (`RANGE_BAND_MIDPOINTS.melee`) from where its target is now and stops there. When the melee robot moves first and the kiter steps more than 1 unit per 0.1 s tick (kiting speed > 10 u/s, i.e. balanced Servo ≳ 11), the gap ends every tick at 1 + the kiter's step > 2. Melee then never reaches, regardless of its own speed or the 1.30× commit.
- **Measured** (melee Servo 25, Energy Blade, vs a Laser Pistol kiter): melee-first gives 0 hits at kiter Servo 20/30/40; kiter-first gives ~50. Robot order (robot1 vs robot2 in league 1v1) therefore changes outcomes.

Fix:
1. **Simultaneous movement:** the movement phase in `simulationLoop.ts` becomes two passes. First every alive robot computes its movement intent from the same tick-start snapshot of positions and velocities, then all moves are applied, followed by the existing collision handling. Robot order must no longer affect movement.
2. **Pursuit closes at full speed:** while a melee-role robot is outside reach (> 2) of a target that is not itself melee-preferring, it moves at its full effective speed towards the target's projected end-of-tick position (position + velocity × tick). It does not stop at the 1-unit standoff point. Once within reach, the existing standoff behaviour applies. The gap then shrinks per tick by exactly the speed difference.
3. **Unchanged:** the 1.5 s Combat Algorithms prediction, its switch-off in melee mirrors and the final approach (#467), the mutual-melee final approach (1.15×), the strain model, and all #520 values.

Expected thresholds (balanced stances, speed = (7 + 0.2 × Servo) × stance × mode):
- At range (1.10× vs 1.10×), the gap changes by 0.22 u/s per Servo point of difference.
- A committed melee robot (1.30×) is outrun only if kiter Servo ≥ 1.18 × melee Servo + 6.4.
- A disengaging kiter (1.30×) is denied only if melee Servo ≥ 1.18 × kiter Servo + 6.4.

Tests:
- Order independence: swapping robot 1 and robot 2 gives mirrored, identical movement.
- Speed matrix confirming the thresholds within tick tolerance. Cases: melee 50 vs kiter 12 (catches), melee 25 vs kiter 40 (kiter escapes at range, commit catches only if kiter < ~36), equal Servo (gap constant at range, commit catches, disengage escapes), and slow vs slow.
- #351 and #467 regressions stay green.

Measurement (FEAT-006) must include this fix in the combined arm and report robot-order sensitivity before vs after.

## Round 2 adjustments after measuring PR #537 (decided)

Measured overshoot (equal-investment 1v1 vs the other range classes, early/mid/late):
- melee: 82.7/67.3/58.3% on main → 37.2/27.5/31.5% in the package
- short: → 86.2/84.2/83.3%
- mid: → 56.5/60.1/56.3%
- long: → 20.2/28.2/28.9%

Cause: melee contact is too short. Reach entries went from ~3 to ~17 per battle, while time within reach fell from ~25% to 8–12%. Melee's first hit resets its patience (so the commit drops) and triggers the ranged disengage at the same moment, and the disengage cooldown equals the patience window.

Changes:
- **A. Guaranteed exchange:** the ranged disengage burst no longer starts on the first melee hit taken. It starts **2.5 s after** that first melee hit (same engagement), giving melee a real exchange window. Duration (2 s + 0.04 s × Evasion Thrusters), 1.30× and cooldown (one patience window) are unchanged.
- **C. Pursuit edge:** the pursuit multiplier goes from 1.10 to **1.15**; kiting stays 1.10. At equal Servo, melee now closes slowly at range without needing to commit.
- **Confirmed run additions:** missed attacks don't reset patience (only landed hits do), and Logic Cores also applies to counter-attacks in the **long** band only (as shipped in round 1; mid-band counters are not boosted).
- **Deferred to the next measurement round:** short-range dominance, Single (25–32%) and Dual Wield (73% late).

## Round 3: short-range dominance and Grand Melee targeting (decided)

Evidence: [SHORT_RANGE_DOMINANCE_INVESTIGATION.md](../analysis/SHORT_RANGE_DOMINANCE_INVESTIGATION.md).
- 1v1: short wins on position. Every robot moves to its own band midpoint, and there's no kiting vs a closer-preferring ranged opponent. In the radius-16 1v1 arena the mid/long robot is at the wall 95–97% of the time.
- Melee vs short: the engagement cycle parks the fight at 2–4 units (short's band).
- Grand Melee: the threat rule (`weaponThreat` 1.5 when the OPPONENT's weapon suits the current distance, else 0.8) makes long robots everyone's first target at the ~22-unit start, and Logic Cores makes that focus lethal sooner.

Product-owner goal: melee may win 1v1 most of the time, as long as KotH and Grand Melee gravitate to mid/long.

Changes:
- **B. Grand Melee targeting** (`arena/threatScoring.ts`): replace the opponent-band `weaponThreat` (1.5/0.8) with a neutral factor, and multiply the threat score by the evaluating robot's OWN range multiplier at that distance (`getRangePenalty(ownWeaponBand, band(distance))`) ("shoot who I can hurt"). Keep the damage-dealt term. Expected GM ranks (invest mid) melee/short/mid/long 0.611/0.460/0.474/0.455, long podium ~23%. No 1v1/KotH effect (verify byte-identical).
- **Threat bug fix:** `combatPower = totalDamageDealt > 0 ? totalDamageDealt : maxHP × 0.5` becomes `max(totalDamageDealt, maxHP × 0.5)`, so threat no longer drops after a robot's first hit.
- **A. Ranged positioning:** a ranged-role robot whose opponent's engagement midpoint is closer than its own kites at **1.10×** (strain-free) while inside its own midpoint. The closer-preferring ranged robot gets ranged pursuit at **1.05×** (strain-free) while beyond its own midpoint. Pass the opponent's engagement midpoint into `ServoStrainState`. Melee-vs-ranged rules (pursuit 1.15, kiting 1.10, commit/disengage) stay unchanged.
- **A-late. Wall-aware kiting path:** the investigation found A does nothing at late budgets (Servo ~46: the arena is crossed in ~2 s, the kiter is pinned to the wall and the chaser cuts inside). Decision: option b, a wall-aware kiting path. When a kiter (any kiting mode) nears the wall, it strafes/circles along a tangential path that maximises distance from the chaser, instead of retreating radially and stalling. It must be deterministic and order-independent, respecting speed, collisions and no-teleport. It also covers #538 (the wall-slide dither): fix that, and restore the mirrored-spawn test bound to `max < 1`. **Fallback, only if b demonstrably fails at invest late** (short vs mid at late still > ~65%): report the numbers and stop. Don't switch to a bigger arena on your own; arena size is a product decision.
- **C. Short Hydraulics** 0.01 → **0.005** (1.25× at H=50). Melee stays 0.015.
- **D. Range penalty 0.50 → 0.65:** rejected (it mostly lowers melee).
- Logic Cores gating to the weapon's band: rejected.

Expected (invest mid, A + C, from the investigation): melee 53 / short 59 / mid 62 / long 27.

## #524 Streaming Studio and Merchandising Hub (decided)

ACC evidence:
- A 1v1 platinum robot (552 battles, 10,492 fame, Studio L9) earns ~47–48k streaming per battle (1000 × 1.552 × 3.098 × 10).
- A 10-robot stable at cycle 75 earned ₡4.64M per cycle: battle/bye ₡3.36M (61 events), streaming ₡1.27M (78 events), Merchandising ₡14k (1 event).
- Streaming is per robot per match (it rewards swarms), while Merchandising is per stable per cycle with prestige divided by roster slots (it penalises swarms).

Changes:
- **Streaming formula** (`computeStreamingRevenue()` in `app/backend/src/services/economy/streamingRevenueService.ts`): `floor(1000 × (1 + battles/2000 + fame/10000) × (1 + 0.5 × studioLevel))`. The terms are additive and there are **no caps** (the issue's min() caps are rejected under the no-caps principle). `battles` is the existing streaming-eligible battle count (KotH-inclusive, as today). Base streaming at L0, team-size division and no streaming for byes stay unchanged. The example robot goes 48.1k → 12.8k (−73%).
- **Merchandising base rate:** 10,000 → **25,000 per level** (`getMerchandisingBaseRate`: L1 25k … L10 250k). The prestige multiplier `1 + (prestige / rosterSlots) / 10000` is unchanged, including the roster-slot division as the anti-swarm counterweight.
- Follow the issue's implementation notes, minus its caps:
  - route single/batch award, advisor and preview through the one formula
  - update breakdown types and display text for the additive form
  - a financial-report preview uses the same KotH-inclusive battle count
  - exactly-once division and rounding
  - increment the streaming formula version for new awards; historical ledger amounts and breakdowns unchanged, and replays return the stored award
  - Studio ROI uses the incremental benefit over the previous level
- **Battle rewards: out of scope** (product owner: only elite 1-robot stables should reach the high tiers once everything else is right).

## #525 Repair Bay (decided)

- The discount becomes **6% per Repair Bay level, independent of roster size**: `6 × clamp(level, 0, 10)` percent (max 60% at L10, which is the natural maximum, not an extra cap). Today it's `min(90, level × (5 + ownedRobots))`.
- 1-robot stables keep exactly today's curve. Swarms lose the amplification (L10 with 10 robots: 90% → 60%).
- Change `calculateRepairBayDiscountPercent()` in `app/shared/utils/repairCost.ts`. Robot count must no longer affect the result: remove the argument and update callers rather than leaving a deprecated parameter. Base repair price, destruction/heavy-damage multipliers, rounding order and the manual-repair 0.5 multiplier stay unchanged.
- Remove the duplicated old formula in `app/frontend/src/components/YieldThresholdSlider.tsx` (and its "more robots = more discount" claim), plus any other duplicates; use the shared helper.
- Fix all ROI branches in `unifiedFacilityROIService.ts` (sync savings, async savings, the `calculateEstimatedReturns` fallback) to use the shared helper. Historical savings use recorded data; never re-derive old costs with the new discount.
- Guide/docs: remove Roster Expansion promises of a higher Repair Bay discount, and correct the documented Repair Bay upkeep to match the code (L1 1,000/day, +500 per extra level). Documentation only; no upkeep change.

## #526 Training Facility (decided)

- Product owner: the Training Facility is too economy-warping (upgrades become too cheap late), so option C applies.
- New discount = `clamp(level, 0, 10) × max(0, 10 − rosterCapacity) × 0.75` percent. That's the current curve × 0.75, e.g. L6/C1 54% → 40.5%, L10/C1 90% → 67.5%, L10/C4 60% → 45%, C ≥ 10 0%.
- Keep the purchased roster-capacity input (from `rosterCapacity.ts`, never temporary robot ownership) and the existing per-level floor rounding of upgrade costs. Fractional discount percentages (e.g. 40.5) must be supported exactly.
- The old 90% clamp (`TRAINING_DISCOUNT_MAX`) can no longer bind (max 67.5%). Remove it rather than keep a dead cap.
- Follow #526's implementation notes:
  - route all previews (UpgradePlanner, onboarding Step4) through the shared helper
  - replace the hard-coded "10% discount" in onboarding Step2_Facilities with the helper-derived rate (L1/C1 = 6.75%)
  - fix `calculateTrainingFacilitySavings` and `calculateEstimatedReturns` in `unifiedFacilityROIService.ts`, which ignore capacity today
  - keep the transaction-time revalidation in `robotUpgradeService.ts`

## #527 Team credit pools (decided)

- Product owner: 1v1 battle income is fine, but team-mode credit pools are too high.
- Multiply every team-mode **credit** pool by **0.75 exactly once**, before the split: tag team and 2v2 2× → 1.5×, 3v3 3× → 2.25×. This applies to win/loss/draw participation pools in tag team, 2v2/3v3 leagues and team tournaments, and to already-eligible team bye participation pools.
- Unchanged: solo rewards and byes, streaming (already team-divided; #524 changes it separately), fame, prestige, ELO/LP and standings, each mode's participation fraction, and the 2v2/3v3 loser pool as 20% of the (now reduced) winner pool.
- Use one named, centralized credit-pool factor. Round the adjusted pool once and distribute integer shares with deterministic remainders; shares must sum exactly to the recorded pool. Add a test that no N² team-tournament payment can reappear, plus idempotent retries.

## Round 3 outcome: 1v1 arena size (decided)

- Result: A works up to invest mid (short 80.7% → 57.7%; short vs mid 71.1% → 33.4%). At invest late short stays 74.5% (short vs mid 71.3%), because in the radius-16 1v1 arena a fast kiter circles the rim while the short robot rides a smaller inner circle. The wall-aware path does work vs melee (kiter wall time 96.8% → 33.0%).
- **Decision: keep the 1v1 arena radius at 16 for now.** Late-game short-range strength is accepted for this season. Revisit (speed-scaled radius was the proposed option) after ACC data.
