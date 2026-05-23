# Requirements Document

## Spec: Weapon Refinement

## Glossary

- **Weapon Refinement**: The act of permanently improving a single owned weapon (a `WeaponInventory` row) by spending credits at the Weapon Workshop. Refinements are per-instance, never per-type — refining "this Volt Sabre" does not affect any other Volt Sabre the player owns.
- **Refinement Slot**: One of five permanent improvement slots on a `WeaponInventory` row. Each slot is filled with exactly one tier action and is never reused or freed.
- **Tier**: One of four refinement actions — `hone`, `augment`, `sharpen`, `forge`. Each tier targets a different aspect of the weapon and unlocks at a specific Weapon Workshop level.
- **Hone (T1)**: Boost an attribute bonus the weapon already grants. Player chooses the magnitude (+1 to +5).
- **Augment (T2)**: Add a brand-new attribute bonus the weapon does not currently grant. Player chooses the magnitude (+1 to +5).
- **Sharpen (T3)**: Reduce the weapon's base cooldown by 0.25s. Fixed magnitude per slot. Capped at 2 instances per weapon.
- **Forge (T4)**: Increase the weapon's base damage by 1.0. Fixed magnitude per slot. Capped at 2 instances per weapon.
- **Slot Cap**: Hard limit of 5 refinements per `WeaponInventory` row.
- **Per-tier Cap**: Sharpen and Forge are individually capped at 2 of the 5 slots. Hone and Augment have no per-tier cap beyond the global 5.
- **Per-attribute Stack Cap**: An attribute's combined value (catalog bonus + Hone refinements + Augment refinements) cannot exceed +10 on any single attribute on a single weapon.
- **Rank Prefix**: Visual identity label derived from the count of filled refinement slots: 0 slots = no prefix, 1–2 = "Refined", 3 = "Crafted", 4 = "Mastercrafted", 5 = "Legendary".
- **Custom Name**: An optional player-set name on a `WeaponInventory` row (the existing but currently unused `WeaponInventory.customName` column). Surfaced in this spec for the first time so players can name their identity weapons.
- **Slot Bar**: The 5-slot visual indicator shown on every owned weapon. Empty slots are visible from day one so progression is teaching.
- **Weapons Workshop**: The existing facility (`facilityType = 'weapons_workshop'`) that grants weapon purchase discounts (Spec v1.0) and weapon resale rate (Spec #33). After this spec it also gates refinement tiers via its level. The Workshop has its own existing prestige requirements (L4 = 1,500 prestige, L7 = 5,000, L9 = 10,000) — refinement does NOT add new prestige gates on top of those.
- **Price Paid**: The `WeaponInventory.pricePaid` column introduced by Spec #33 (Weapon Resale). It anchors the resale value of a weapon. After this spec, every successful refinement increments `pricePaid` by the refinement cost, so refinement spend is partially or fully recoverable on resale at the player's current Workshop level.
- **Refinement Cost**: The credit cost for a single refinement action. Computed by a deterministic shared formula (see R2). The Workshop purchase discount does NOT apply to refinement — refinement is a separate transaction class.

## Introduction

Backlog #5 (Weapon Experimentation Problem) identifies that players don't switch weapons because the cost of switching is too high and there's no compelling reason to keep using a weapon long-term. The DPS Rebalance (Spec #31, May 8) made all four loadout types competitive on paper. Weapon Resale (Spec #33, May 22) reduced switching cost by letting players recover credits on weapons they no longer want. This spec addresses the OTHER half: making the weapon you keep feel like *yours*, with ongoing progression and visible identity.

Weapon Refinement adds a permanent per-instance improvement system. Players can spend credits to refine an individual weapon up to 5 times across four tiers, gated by Workshop level. Refinements are final — no undo, no transferability between weapons. Refinement spend folds into `pricePaid`, so resale partially or fully recovers the investment depending on Workshop level.

The system is designed around three pillars:

1. **Identity over power.** Caps on the most powerful tiers (Sharpen and Forge max 2 slots each) preserve the DPS rebalance. The big rewards are concentrated attribute investment (Hone +5 stacks) and visible identity (rank prefix, custom name, slot bar) — not raw DPS dominance.
2. **Late-game credit sink.** Maximum spend on a single weapon ranges from ~₡1.5M for an identity build to ~₡2.8M for a full DPS build to ~₡4M for max-everything. This addresses Game Loop #6 Loop 2 (economic stagnation in late game).
3. **Forward-compatible with Marketplace.** Refinement state lives on the `WeaponInventory` row; if a future Player Marketplace spec (Backlog #44) opens trading, an upgraded weapon's full refinement history transfers with the row.

This spec adds: a new `WeaponRefinement` table, a server-authoritative refinement endpoint, a shared formula module for cost and effective-stat math, in-game visualization across every weapon-display surface (My Inventory tab, robot detail page, battle reports, weapon shop catalog), 5 new economy achievements, an in-game guide article, and a public changelog entry.

## Context: Discussion Notes

The following design decisions and rationale were settled during scoping. Recorded for traceability so future changes know what was deliberately chosen vs. accidentally inherited.

### Why "Refinement" (and not "Mastery", "Forging", "Tuning")

"Tuning" is reserved for the Tuning Pool (Spec #25), which is a per-robot tactical attribute allocation system. Reusing the word would confuse players who already have a "Tuning" mental model. "Forging" became the T4 tier name — using it as the system name would over-index on raw power. "Mastery" implies skill progression but the system isn't tied to player battle history. "Refinement" is neutral, describes the act, and leaves all four tier names ("Hone", "Augment", "Sharpen", "Forge") free to convey their specific actions.

### Why per-instance, not per-type

The whole point is identity. If refinement applied per-type ("all my Volt Sabres get +1 Combat Power"), the weapon becomes a vessel and the credit spend is depersonalized. Per-instance means *this specific weapon* — the one I've been using since cycle 47, named "Old Faithful", refined three times — is mine. Lose the weapon (sell, never), lose the refinements. That's the price of identity.

### Why permanent and non-transferable

Reversibility erodes the weight of the decision. The user's stated principle: "If you confirm, you confirm. If you don't want it anymore, you sell." Selling a refined weapon recovers `pricePaid × resaleRate` (per Spec #33), so refinement spend is partially recoverable — but the weapon itself is gone. Transferability would require a "rip refinements, attach to target weapon" flow with new endpoints, new error cases (target weapon's range/hand/loadout incompatibility, target weapon's existing refinements colliding with source), new UX, and would reduce the emotional pull of a maxed-out weapon. Out of scope.

### Why slot cap is 5 (not Workshop-level-derived)

Workshop level already determines which tiers are *available*. Making the slot cap also scale with Workshop level would double-gate the system and obscure the design lane. A fixed cap of 5 makes every slot feel weighty from the start, regardless of Workshop level. New players who only have Workshop L1 still see the 5-slot bar and understand the long arc of the system — they just can only Hone for now.

### Why Sharpen and Forge are capped at 2 slots each

The DPS Rebalance (Spec #31) compressed the 1H base-damage spread from 3.0× to 2.0× to keep all four loadout types within 15% of each other on effective combat power. A 5-slot Sharpen on a 3s weapon (3.0s → 1.75s = +71% DPS) or a 5-slot Forge on Practice Sword (6 → 11 dmg = +83% DPS) would re-create the original problem the rebalance fixed. The 2-slot cap holds the rebalance: max Sharpen yields ≤ +30% DPS, max Forge yields ≤ +33% DPS, and combined max DPS lift on a single weapon stays around +40% — enough for endgame whales to feel rewarded, not so much that the rebalance is broken.

### Why no cooldown floor

The combat simulator already calculates effective cooldown as `baseCooldown × (offhand penalty) / (1 + attackSpeed/50)`. Sharpen reduces `baseCooldown`. Attack Speed (a robot attribute capped at 50) already produces sub-1.0s effective cooldowns on fast weapons before Sharpen is even applied. The system is naturally bounded by: (a) the 2-slot Sharpen cap, (b) the engine's `SIMULATION_TICK = 0.1s` minimum, and (c) the cost of stacking Sharpen + AS investment + dual-wield loadout. Adding a floor would silently truncate a future fast 1H weapon (e.g., a hypothetical 1.5s base) and provide no real safety beyond what's already implicit. If endgame DW Vibro Mace builds turn out meta-dominant, the response is to nerf the build path (raise refinement cost, tighten Sharpen cap to 1, cap dual-wield AS bonus), not introduce a floor.

### Why no separate prestige gates

The Weapons Workshop facility ALREADY has prestige gates: L4 = 1,500 prestige, L7 = 5,000 prestige, L9 = 10,000 prestige. Reaching Workshop L8 (the Forge gate) requires having met the L7 prestige requirement. Adding parallel prestige gates on the refinement system would be redundant and would couple the refinement spec to a subsystem it doesn't need to know about. Workshop level is the single dial.

### Why refinement spend folds into `pricePaid`

Two reasons. First, regret mitigation: a player who refines and later wants out can sell at Workshop rate and recover at least some of the investment, mirroring how purchase price recovery works today. Second, marketplace forward-compat: if Spec #44 (Player Marketplace) eventually exposes upgraded weapons for trading, the listing's price floor naturally includes refinement spend via `pricePaid`. The schema doesn't need to change later. The trade-off is that at Workshop L10, refinement spend is fully recoverable on resale — but that's only possible after the player has invested ₡4M+ in the Workshop facility itself, so the symmetry is fair.

### Why Workshop discount does NOT apply to refinement

Workshop level grants three benefits: purchase discount (Spec v1.0), resale rate (Spec #33), and refinement tier unlocks (this spec). Stacking purchase discount onto refinement cost would double-count Workshop value and would interact awkwardly with the `pricePaid` increment (do we increment the discounted cost or the catalog cost?). Keeping refinement as a separate transaction class with full costs simplifies both the math and the player's mental model: "Workshop level rewards 10% on buy and sell, and unlocks new refinement tiers."

### Out of Scope

- **Refinement transfer between weapons.** No "rip and reapply" flow. Once committed, refinements live on that `WeaponInventory` row forever.
- **Bulk refinement.** Players refine one slot at a time. The deliberate-action UX is the point.
- **Refinement on starter (free) weapons.** Allowed mechanically (it's just a `WeaponInventory` row with `pricePaid = 0`), and the user has confirmed that the resulting refined-Practice-Sword identity build is desirable. The achievement "Identity Forged" celebrates this case explicitly.
- **Refinement removal / rerolling.** No "undo a single slot" feature. The whole point is permanence.
- **Refinement on weapons in a robot's loadout while equipped.** Permitted. The combat simulator reads refinements at battle prep time, so refining an equipped weapon takes effect on the robot's next battle. (Locking equipped weapons during refinement would block the most common use case — refining the weapon you actually use.)
- **Refinement preview in Practice Arena.** The existing What-If system (per backlog) already lets players test owned-weapon configurations. Refinement state on owned weapons is just part of the weapon's effective stats and flows through naturally.
- **Refinement crafting modifiers** (e.g., "this slot has a 5% chance to roll +6 instead of +5"). RNG-free by design — refinement is a deterministic spend, not a gamble.
- **Onboarding analytics for refinement.** The codebase has `trackWeaponPurchased` for first-time-buyer flow analytics. Refinement is a deliberate post-onboarding action — no equivalent `trackWeaponRefined` is in scope. Refinement events are still captured by the audit log (`weapon_refinement` event type), so retrospective analytics on adoption are still possible.
- **Rank prefix on persisted `BattleParticipant` rows.** When a battle ends, `BattleParticipant.mainWeaponName` and `offhandWeaponName` are populated from `weapon.name` (catalog name) — NOT from the rank-prefixed name. This keeps battle history stable across future refinement changes (so a battle log from cycle 47 doesn't suddenly say "Mastercrafted Volt Sabre" because the player refined the weapon in cycle 80). The rank prefix appears in the live battle log events at battle time and at render time on robot/inventory/matchmaking pages — but never in the persisted historical participant rows.

## Expected Contribution

This spec addresses Backlog #5 (Weapon Experimentation Problem) and Game Loop Audit #6 Loop 2 (late-game economic stagnation).

1. **Identity layer for kept weapons.** Before — every Volt Sabre in the game is identical; players have no reason to feel attached to a specific weapon instance, and selling+rebuying is functionally equivalent to refining-in-place. After — each `WeaponInventory` row can carry up to 5 refinements, a rank prefix derived from filled slots, and an optional player-set custom name. Two players can both own a "Mastercrafted Volt Sabre 'Old Faithful'" but the actual refinement choices (which attributes Honed, whether they Forged or Augmented) make each one distinct. The visible slot bar, rank prefix, and custom name carry through every weapon-display surface — inventory rows, equipped-weapon cards on robot pages, battle reports.

2. **Late-game credit sink with capped power.** Before — once a player has bought their preferred weapons and maxed facilities, credits accumulate with no meaningful sink (Loop 2 stagnation). After — a single weapon can absorb up to ~₡4M of refinement spend (5 × Hone+5 = ₡1.25M, or 2× Sharpen + 2× Forge + 1× Hone+5 = ~₡3.05M, or true max-everything ~₡4M). The DPS rebalance (Spec #31) is preserved: per-tier caps on Sharpen (2) and Forge (2) limit max single-weapon DPS lift to ~+40%, and the per-attribute stack cap (+10 combined) keeps attribute concentration within catalog norms.

3. **Workshop facility third role.** Before — the Workshop's two roles (purchase discount, resale rate) had clear marginal value early but flattened in late game once a player could afford their target weapons. After — the Workshop gates four refinement tiers at L1/L3/L5/L8, giving every level upgrade beyond L1 (already meaningful from Spec #33) a new payoff that scales with the player's investment in their identity weapons. L8 in particular becomes a desirable mid-late-game milestone (unlocks Forge, the highest-impact tier).

4. **Cheap-weapon viability.** Before — a Practice Sword is strictly inferior to any luxury weapon at every tier of investment; there's no path to making a starter weapon competitive. After — a 5-slot Mastercrafted/Legendary Practice Sword (e.g., 1× Hone+5 stacked twice on the same attribute for +10 Combat Power, plus 2× Augment+5 on different attributes, plus 1× Forge for +1 base damage) reaches a power level where it can compete with a stock mid-tier weapon in specific build niches. It will not match a stock luxury weapon on raw DPS — that's the design — but the refined Practice Sword provides a *different* combat profile (heavy attribute concentration vs. pure DPS) that's strategically valid.

5. **Forward-compatible with future Marketplace.** The `WeaponRefinement` schema is keyed to `WeaponInventory.id`, with `ON DELETE CASCADE`. If Spec #44 (Player Marketplace) eventually exposes weapon trading, listing a refined weapon naturally includes its refinement state and the buyer receives the full identity. No schema migration is required at that point. Refinement spend is anchored to `pricePaid`, so marketplace pricing has a natural floor based on actual investment.

6. **Behavioral reward layer.** The achievement system (Spec #27) gains 5 new entries (proposed E22–E26 in the existing economy category, exact IDs assigned during implementation): "First Refinement" (easy, first sale), "Master Craftsman" (medium, ₡1M lifetime refinement spend), "Legendary Smith" (hard, owns any 5-slot weapon), "Identity Forged" (hard, owns a 5-slot starter weapon), "Forge Master" (hard, single weapon with both Sharpen + both Forge slots filled). These rewards target the behaviors the system is designed to encourage: try refinement, commit to a weapon, max out an identity build, max out a DPS build.

### Verification Criteria

After all tasks are complete, the following automatable checks confirm the spec was delivered as designed.

1. `npx prisma migrate status` — the migration adding the `weapon_refinement` table is applied with no drift.
2. `psql ... -c "\d weapon_refinement"` — the table exists with columns `id`, `weapon_inventory_id`, `tier`, `magnitude`, `target_attribute`, `cost_paid`, `slot_index`, `created_at`, plus FK to `weapon_inventory.id` with `ON DELETE CASCADE` and a unique constraint on `(weapon_inventory_id, slot_index)`.
3. `grep -rn "calculateRefinementCost\|applyRefinementsToWeapon\|calculateRankPrefix" app/shared/utils/weaponRefinement.ts` — all three core formulas exist in the shared utils module.
4. `grep -rn "POST .*weapon-inventory.*refine\|/refine" app/backend/src/routes/weaponInventory.ts` — the refinement route is registered.
5. `cd app/backend && npm test -- weaponInventory` — all weapon inventory tests pass, including new refinement tests covering: tier-locked rejection, slot-cap rejection, per-tier-cap rejection, per-attribute-stack-cap rejection, magnitude-out-of-range rejection, attribute-not-on-weapon (T1) rejection, attribute-already-on-weapon (T2) rejection, shield-cannot-take-DPS-tier rejection, ownership rejection, auth requirement, rate limit, concurrent-refine-vs-refine on the same weapon, concurrent-refine-vs-equip, concurrent-refine-vs-resale, audit log emission, `pricePaid` increment, achievement unlock.
6. `cd app/backend && npm test -- weaponRefinement.property` — property-based tests confirm: any valid sequence of refinements applied via the formula module produces effective stats matching independent calculation; cost formula is deterministic and monotonically non-decreasing per slot; rank prefix is a pure function of filled slot count.
7. `cd app/backend && npm test -- combatSimulator.refinement` — combat simulator regression test confirms: a battle using a refined weapon applies the refined `baseDamage`, refined cooldown, and refined attribute bonuses correctly; an equivalent simulated battle with the same numbers hard-coded produces identical results.
8. `cd app/frontend && npm test -- WeaponShop.refine` — frontend tests pass: RefinementModal interaction, SlotBar rendering for 0–5 slots, RankPrefix derivation, CustomNameEditor, full refinement flow including stat-delta preview.
9. Manual integration: log in as a test user with Workshop L8, ≥₡5M, an unrefined weapon — refine it 5 times across all four tiers — confirm: each refinement deducts the correct cost, increments `pricePaid` by exactly the refinement cost, inserts a `weapon_refinement` row, the slot bar updates, the rank prefix updates ("Refined" → "Crafted" → "Mastercrafted" → "Legendary"), the audit log row is written, achievement unlock toasts appear at the right milestones.
10. Manual integration: equip a refined weapon on a robot, run a battle in Practice Arena — confirm the battle log shows the rank prefix and custom name in attack events, and the damage calculation reflects the refined stats.
11. `psql ... -c "SELECT event_type, COUNT(*) FROM audit_log WHERE event_type='weapon_refinement';"` — at least one row exists after the manual test, confirming `eventLogger.logWeaponRefinement` is wired up.
12. `grep -rn "FOR UPDATE.*weapon_inventory" app/backend/src/` — the refinement handler acquires the same shared `weapon_inventory` row lock as the resale handler and the equip handlers (matching Spec #33 lock acquisition order convention: user row → weapon_inventory row).
13. Race-condition stress test: a Jest test that fires 50 parallel "refine + resale + equip + unequip" cycles on the same user's weapons and asserts: total currency change equals sum of expected deltas, no orphaned `weapon_refinement` rows (every row points to a live `weapon_inventory.id`), no `WeaponInventory` row exceeds 5 refinements, no Sharpen/Forge tier exceeds 2 instances per weapon, no per-attribute stack exceeds +10.
14. `grep -n "id: 'E2[2-6]'\|First Refinement\|Master Craftsman\|Legendary Smith\|Identity Forged\|Forge Master" app/backend/src/config/achievements.ts` — five new achievements present in the config.
15. `grep -n "weapon_refined\|weapon_refinement" app/backend/src/services/achievement/achievementService.ts` — new achievement event type and trigger logic wired into `EVENT_TRIGGER_MAP`.
16. Manual: complete a refinement via the UI, confirm achievement unlock toast renders on the WeaponShopPage. Specifically test "First Refinement" on first action.
17. Frontend visual: SlotBar visible on every owned weapon (0-slot weapons show 5 empty slots with locked-tooltip explaining unlock conditions). Rank prefix visible on weapon name everywhere it's displayed (My Inventory, robot detail equipped slot, battle report header, weapon shop catalog ownership badge).
18. In-game guide: a new "Weapon Refinement" article exists in the in-game guide system, accessible via the standard guide navigation.
19. Public changelog entry created and published explaining the feature.
20. `docs/game-systems/PRD_WEAPON_ECONOMY.md` has a v1.6 "Weapon Refinement" section documenting the system. `docs/game-systems/PRD_WEAPONS_LOADOUT.md` references refinement in the weapon lifecycle. `app/backend/docs/audit-logging-schema.md` documents the `weapon_refinement` event payload. `docs/BACKLOG.md` updates #5 to mark Weapon Refinement complete.

## Requirements

### R1: Database Schema

**R1.1** A new Prisma model `WeaponRefinement` SHALL be added to `app/backend/prisma/schema.prisma`:

```prisma
model WeaponRefinement {
  id                Int      @id @default(autoincrement())
  weaponInventoryId Int      @map("weapon_inventory_id")
  tier              String   @db.VarChar(16) // 'hone' | 'augment' | 'sharpen' | 'forge'
  magnitude         Int      // 1-5 for hone/augment, always 1 for sharpen/forge
  targetAttribute   String?  @map("target_attribute") @db.VarChar(64) // attribute name for hone/augment, NULL for sharpen/forge
  costPaid          Int      @map("cost_paid")
  slotIndex         Int      @map("slot_index") // 1-5, stable ordering for display
  createdAt         DateTime @default(now()) @map("created_at")

  weaponInventory WeaponInventory @relation(fields: [weaponInventoryId], references: [id], onDelete: Cascade)

  @@unique([weaponInventoryId, slotIndex], map: "weapon_refinement_inv_slot_unique")
  @@index([weaponInventoryId])
  @@map("weapon_refinement")
}
```

**R1.2** The existing `WeaponInventory` model SHALL gain a back-reference: `refinements WeaponRefinement[]`. No other column changes — `customName` and `pricePaid` already exist.

**R1.3** A Prisma migration `20260524000000_add_weapon_refinement` SHALL be created with the new table, FK constraint, unique constraint, and index. The migration is purely additive — no existing rows are modified, no existing columns are altered.

**R1.4** The Prisma client SHALL be regenerated. All consumers of `WeaponInventory` queries that need refinement data SHALL update their `select`/`include` clauses to fetch `refinements`.

### R2: Shared Formula Module

**R2.1** A new module `app/shared/utils/weaponRefinement.ts` SHALL be created with the following pure functions, all exported and re-exported via `app/shared/utils/index.ts`. All functions are deterministic and parameter-only — no IO, no side effects.

**R2.2** `calculateRefinementCost(tier: RefinementTier, magnitude: number, existingInstancesOfTier: number): number`:
- Hone: `10_000 × magnitude²` (magnitude 1–5 → ₡10K, ₡40K, ₡90K, ₡160K, ₡250K).
- Augment: `20_000 × magnitude²` (magnitude 1–5 → ₡20K, ₡80K, ₡180K, ₡320K, ₡500K).
- Sharpen: `300_000 × 3^existingInstancesOfTier` (1st instance ₡300K, 2nd instance ₡900K). Magnitude argument MUST be 1.
- Forge: `400_000 × 3^existingInstancesOfTier` (1st instance ₡400K, 2nd instance ₡1.2M). Magnitude argument MUST be 1.

**R2.3** `validateRefinementSlotAvailable(refinements: WeaponRefinement[], tier: RefinementTier): { ok: true } | { ok: false, code: string }`:
- Rejects if `refinements.length >= 5` with code `SLOT_CAP_EXCEEDED`.
- For tier `sharpen`: rejects if existing sharpen count `>= 2` with code `TIER_CAP_EXCEEDED`.
- For tier `forge`: rejects if existing forge count `>= 2` with code `TIER_CAP_EXCEEDED`.

**R2.4** `validateAttributeStackCap(weapon: Weapon, refinements: WeaponRefinement[], targetAttribute: string, addedMagnitude: number): { ok: true } | { ok: false, currentTotal: number }`:
- Computes existing total = `weapon[<attr>Bonus] + Σ(refinement.magnitude where targetAttribute matches)`.
- Returns `{ ok: false }` if `existingTotal + addedMagnitude > 10`.
- Used for both Hone and Augment validation.

**R2.5** `validateAttributeOnWeapon(weapon: Weapon, refinements: WeaponRefinement[], targetAttribute: string, tier: 'hone' | 'augment'): { ok: true } | { ok: false, code: string }`:
- For `hone`: rejects if `weapon[<attr>Bonus] === 0` AND no prior Augment for this attribute exists with code `ATTRIBUTE_NOT_ON_WEAPON`. (Hone can target an attribute the weapon got via prior Augment — once it's on the weapon, it's honable.)
- For `augment`: rejects if `weapon[<attr>Bonus] !== 0` OR any prior Augment for this attribute exists with code `ATTRIBUTE_ALREADY_ON_WEAPON`.

**R2.6** `validateShieldCompatibility(weapon: Weapon, tier: RefinementTier): { ok: true } | { ok: false, code: string }`:
- Rejects if `weapon.weaponType === 'shield'` AND `tier in ('sharpen', 'forge')` with code `SHIELD_CANNOT_TAKE_DPS_TIER`.

**R2.7** `applyRefinementsToWeapon(weapon: Weapon, refinements: WeaponRefinement[]): EffectiveWeaponStats`:
- Returns an object with `effectiveBaseDamage` (= `weapon.baseDamage + 1.0 × forgeCount`), `effectiveCooldown` (= `weapon.cooldown - 0.25 × sharpenCount`, never below 0), and `effectiveAttributeBonuses` (a record of attribute name → total bonus from catalog + Hone + Augment).
- Used by both the combat simulator data prep path AND the frontend stat preview.

**R2.8** `calculateRankPrefix(refinementCount: number): RankPrefix`:
- 0 → `null`.
- 1–2 → `"Refined"`.
- 3 → `"Crafted"`.
- 4 → `"Mastercrafted"`.
- 5 → `"Legendary"`.

**R2.9** `formatWeaponDisplayName(weapon: { name: string }, refinementCount: number, customName: string | null): string`:
- Returns the canonical display name used everywhere a refined weapon is rendered.
- Format: `<rank-prefix> <weapon.name>` if `refinementCount > 0`, else `<weapon.name>`.
- If `customName` is set, the customName is appended in quotes on a second visual line — but the formatter returns just the rank+name string; UI components handle the customName layout.

**R2.10** A `RefinementTier` type union (`'hone' | 'augment' | 'sharpen' | 'forge'`) SHALL be exported from the module.

**R2.11** All formulas SHALL match exactly between this shared module and any backend route handler logic. No backend service may reimplement cost calculation, slot validation, or stack-cap math — all callers route through the shared module.

### R3: Refinement Route Handler

**R3.1** A new route `POST /api/weapon-inventory/:id/refine` SHALL be added to `src/routes/weaponInventory.ts`. The route SHALL require authentication via `authenticateToken`.

**R3.2** The route SHALL validate the request via Zod. The schema SHALL:
- Validate `:id` URL parameter using the existing `inventoryIdParamsSchema` pattern (`positiveIntParam` from `securityValidation.ts`).
- Validate request body with shape `{ tier: 'hone' | 'augment' | 'sharpen' | 'forge', magnitude: number (1..5), targetAttribute?: string }`. `targetAttribute` is required when tier is `hone` or `augment`, and is rejected when tier is `sharpen` or `forge`. `magnitude` MUST be `1` when tier is `sharpen` or `forge`.
- `targetAttribute` MUST validate against the existing 23-attribute name list (reuse the `VALID_ATTRIBUTES` constant from `robotUpgradeService.ts` — refactor into a shared location if necessary). Inline regex/string-match SHALL NOT be used.

**R3.3** The route SHALL call `verifyWeaponOwnership(prisma, inventoryId, userId)` before any mutation. Ownership failures return 403 with the generic "Access denied" message and emit `securityMonitor.logAuthorizationFailure`.

**R3.4** Inside a Prisma interactive transaction, the route SHALL acquire locks in the SAME order as the resale handler (Spec #33) to prevent deadlocks:
1. `lockUserForSpending(tx, userId)` — user row lock first.
2. `SELECT id, user_id, weapon_id, price_paid FROM weapon_inventory WHERE id = $1 FOR UPDATE` — weapon_inventory row lock second.

**R3.5** Inside the transaction (after locks held), the route SHALL:
1. Re-verify ownership against the locked row (TOCTOU guard); on mismatch, log via `securityMonitor.logAuthorizationFailure` and throw 403.
2. Defensively assert `pricePaid >= 0`; on failure throw `EconomyError(INVALID_TRANSACTION, ..., 500)`.
3. Fetch the weapon catalog row (`weapon`) and existing refinements (`refinements`) for this inventory row.
4. Fetch the user's current Workshop level and prestige.
5. Run, in order, all validations from R2 (slot cap, per-tier cap, attribute on/not-on weapon for T1/T2, attribute stack cap for T1/T2, shield compatibility for T3/T4) AND tier-gating validation: tier `hone` requires Workshop ≥ 1, `augment` requires ≥ 3, `sharpen` requires ≥ 5, `forge` requires ≥ 8. Each failed validation throws an `EconomyError` with the corresponding code from R8 below and HTTP 400 (validation) or 409 (state conflict — slot/tier/stack caps) as appropriate.
6. Compute `cost = calculateRefinementCost(tier, magnitude, existingInstancesOfTier)`.
7. Verify `lockedUser.currency >= cost`; on failure throw `EconomyError(INSUFFICIENT_CURRENCY, ..., 402)`.
8. Compute `slotIndex = max(existingSlotIndex, 0) + 1` (1-indexed, stable).
9. Decrement user currency by `cost`, increment `weapon_inventory.price_paid` by `cost`, insert a `weapon_refinement` row with `(weaponInventoryId, tier, magnitude, targetAttribute, costPaid: cost, slotIndex)`.
10. Return the updated `WeaponInventory` (with refinements eagerly loaded), the user's new currency balance, the updated effective stats, and a list of any newly unlocked achievements.

**R3.6** After the transaction commits (and only after), the route SHALL log via `eventLogger.logWeaponRefinement(currentCycle, userId, payload)` where payload includes `{ weaponInventoryId, weaponId, tier, magnitude, targetAttribute, costPaid, workshopLevel }`.

**R3.7** After the audit log is written, the route SHALL invoke `achievementService.checkAndAward(userId, null, { type: 'weapon_refined', data: payload })` wrapped in a try-catch that logs failures but does NOT block the response. Newly-unlocked achievements are included in the response body as `achievementUnlocks`.

**R3.8** The route SHALL respond with `200 OK` and body `{ weaponInventory, currency, salePrice: null, achievementUnlocks: UnlockedAchievement[], message }` matching the response shape conventions of the existing purchase and resale routes.

**R3.9** The route SHALL log via the `logger` module a structured INFO line: userId, weaponInventoryId, weapon name, tier, magnitude, targetAttribute, costPaid, workshopLevel, slotIndex, balance before/after.

**R3.10** A per-user rate limiter SHALL be applied to `POST /api/weapon-inventory/:id/refine`: 10 requests per 5-minute rolling window keyed by `req.user.userId`. Lower than the resale rate limit (30 per 5 min, Spec #33) because refinement is a more deliberate action — 10 attempts in 5 minutes is generous for normal play and clearly anomalous if exceeded. The middleware SHALL run AFTER `authenticateToken`. Violations SHALL be reported via `securityMonitor.trackRateLimitViolation(userId, 'weapon_refinement', { sourceIp, endpoint })`. The 11th request returns HTTP 429 with a generic "Too many refinement attempts" message.

**R3.11** The refinement handler SHALL call `securityMonitor.trackSpending(userId, cost, 'weapon_refinement')` to feed the spending-anomaly detector. Refinement IS spending (unlike resale, which is income), so the spending tracker is the correct surface.

**R3.12** Equip handlers SHALL NOT change because of this spec — refinement is allowed on equipped weapons. The combat simulator reads refinements at battle prep time (R5), so refining an equipped weapon takes effect on the next battle. The existing shared `weapon_inventory` lock between resale, equip, and now refinement still serializes resale-vs-refinement and equip-vs-refinement on the same weapon (resale fails if equipped, equip fails if refinement is mid-transaction, etc.).

### R4: Combat Simulator Integration

**R4.1** `prepareRobotForCombat` (in `app/backend/src/utils/robotCalculations.ts`) SHALL be updated so that when it folds in a robot's weapon bonuses, it applies refinements to the weapon's effective stats BEFORE the bonuses are read into the robot's attribute totals. This is the correct insertion point — it's the function called by every battle orchestrator (league, tag-team, KotH, tournament, practice arena).

**R4.2** The data flow change is:
1. The orchestrator fetches the robot with `mainWeapon.weapon` and `mainWeapon.refinements`, and `offhandWeapon.weapon` and `offhandWeapon.refinements`. The Prisma queries SHALL be updated everywhere the weapon include is used.
2. Inside `prepareRobotForCombat`, for each weapon (main and offhand), call `applyRefinementsToWeapon(weapon, refinements)` from the shared module to compute effective `baseDamage`, `cooldown`, and attribute bonuses.
3. The robot's effective attribute totals incorporate the refined attribute bonuses (Hone + Augment + catalog) instead of just the catalog bonuses.
4. The simulator's `calcCooldown` reads the refined `weapon.cooldown` field (which the orchestrator has already set to the effective value).

**R4.3** The combat simulator's `RobotWithWeapons` interface SHALL be updated to type-document that its `mainWeapon.weapon` and `offhandWeapon.weapon` fields hold the EFFECTIVE (post-refinement) stats, not the catalog stats. Comments inside `prepareRobotForCombat` SHALL document that this transformation has happened.

**R4.4** Battle log events SHALL render weapon names using `formatWeaponDisplayName(weapon, refinementCount, inventory.customName)` from R2.9. The combat simulator is responsible for passing the inventory row's `customName` and `refinements.length` through the event payload alongside `weapon.name`.

**R4.5** The existing `_bonusField` deprecated path in `combatSimulator.ts` (R2.7's `applyRefinementsToWeapon` overlaps with this) SHALL be left untouched — the comment block already says attributes are pre-computed by `prepareRobotForCombat`. The new flow is consistent with that contract.

### R5: Error Codes

**R5.1** The following new error codes SHALL be added to `EconomyErrorCode` in `app/backend/src/errors/economyErrors.ts`:

- `WEAPON_REFINEMENT_TIER_LOCKED` (HTTP 403) — current Workshop level too low for the requested tier. Message includes the required Workshop level.
- `WEAPON_REFINEMENT_SLOT_CAP_EXCEEDED` (HTTP 409) — weapon already has 5 refinements.
- `WEAPON_REFINEMENT_TIER_CAP_EXCEEDED` (HTTP 409) — Sharpen or Forge already has 2 instances on this weapon. Message includes which tier.
- `WEAPON_REFINEMENT_ATTRIBUTE_STACK_CAP_EXCEEDED` (HTTP 409) — adding the requested magnitude would push the attribute beyond +10 total. Message includes the attribute name and the current total.
- `WEAPON_REFINEMENT_MAGNITUDE_OUT_OF_RANGE` (HTTP 400) — magnitude not in [1, 5] for Hone/Augment, or not exactly 1 for Sharpen/Forge.
- `WEAPON_REFINEMENT_ATTRIBUTE_NOT_ON_WEAPON` (HTTP 400) — Hone target attribute does not exist on the weapon (catalog or prior Augment).
- `WEAPON_REFINEMENT_ATTRIBUTE_ALREADY_ON_WEAPON` (HTTP 400) — Augment target attribute is already granted (catalog or prior Augment).
- `WEAPON_REFINEMENT_SHIELD_CANNOT_TAKE_DPS_TIER` (HTTP 400) — Sharpen or Forge attempted on a shield weapon.

**R5.2** All error codes SHALL include a `details` object where appropriate (e.g., `{ requiredWorkshopLevel: 8 }`, `{ tier: 'sharpen', existingCount: 2 }`, `{ attribute: 'combatPower', currentTotal: 9, requestedAddition: 3 }`) to help the frontend render a useful error message without relying on string parsing.

### R6: Achievements

**R6.1** Five new achievements SHALL be added to `app/backend/src/config/achievements.ts`. The IDs SHALL be the next available economy slots (E22 through E26 if E18–E21 from Spec #33 are the highest, but the implementation MUST verify). All five SHALL use `category: 'economy'` and `scope: 'user'`.

**R6.2** Achievement E22 — "First Refinement":
- Description: "Refine your first weapon"
- Tier: easy
- Trigger type: `weapons_refined_count`, threshold: 1
- Progress type: boolean
- Hidden: false

**R6.3** Achievement E23 — "Master Craftsman":
- Description: "Spend ₡1,000,000 lifetime on weapon refinements"
- Tier: medium
- Trigger type: `weapons_refined_credits_spent`, threshold: 1_000_000
- Progress type: numeric
- Progress label: "credits spent on refinement"
- Hidden: false

**R6.4** Achievement E24 — "Legendary Smith":
- Description: "Own a Legendary weapon (5 refinements)"
- Tier: hard
- Trigger type: `owns_legendary_weapon`
- Progress type: boolean
- Hidden: false

**R6.5** Achievement E25 — "Identity Forged":
- Description: "Refine a starter weapon (Practice Sword, Practice Blaster, Training Rifle, or Training Beam) to Legendary status"
- Tier: hard
- Trigger type: `owns_legendary_starter_weapon`
- Progress type: boolean
- Hidden: false

**R6.6** Achievement E26 — "Forge Master":
- Description: "Own a weapon with all four DPS slots filled (2 Sharpen + 2 Forge)"
- Tier: hard
- Trigger type: `owns_max_dps_weapon`
- Progress type: boolean
- Hidden: false

**R6.7** Five new trigger types SHALL be added to `AchievementTriggerType`:
- `weapons_refined_count` — cumulative count of refinement events for the user.
- `weapons_refined_credits_spent` — cumulative credits spent across all refinements.
- `owns_legendary_weapon` — boolean: at least one of the user's `WeaponInventory` rows has 5 refinements.
- `owns_legendary_starter_weapon` — boolean: at least one starter weapon (defined by name list) has 5 refinements.
- `owns_max_dps_weapon` — boolean: at least one weapon has 2 sharpen + 2 forge in its refinements.

**R6.8** A new event type `weapon_refined` SHALL be added to `AchievementEventType`. The event payload includes `weaponInventoryId`, `weaponId`, `tier`, `magnitude`, `targetAttribute`, `costPaid`, `workshopLevel`. The `EVENT_TRIGGER_MAP` SHALL map `weapon_refined` to all five new trigger types.

**R6.9** The `checkCriterionMet` switch in `achievementService.ts` SHALL handle the five new trigger types using the existing audit log + `weapon_refinement` table data:
- `weapons_refined_count`: `prisma.auditLog.count({ where: { userId, eventType: 'weapon_refinement' } })`.
- `weapons_refined_credits_spent`: aggregate `costPaid` across the user's `weapon_refinement` rows via `prisma.weaponRefinement.aggregate({ _sum: { costPaid: true }, where: { weaponInventory: { userId } } })`.
- `owns_legendary_weapon`: any `weapon_inventory.id` where the user owns the row AND the row has 5 refinements (group-by query).
- `owns_legendary_starter_weapon`: same as above plus a join to `weapon` and a name match against the starter list.
- `owns_max_dps_weapon`: any `weapon_inventory.id` where refinements include exactly 2 sharpen tier rows AND exactly 2 forge tier rows (count-by-tier query).

### R7: Frontend — Weapon Shop My Inventory Tab

**R7.1** The existing `InventoryRow` component SHALL be updated to render:
- Rank prefix (from `calculateRankPrefix`) before the weapon name. Empty rank renders nothing.
- Player-set custom name (from `WeaponInventory.customName`) below the rank+name, in italic.
- A 5-slot `SlotBar` component (R8.1) showing the current refinement state.
- An enabled "Refine" button (next to the existing Sell button) opening the Refinement modal. The Refine button is enabled when slots remain AND the user owns the weapon (the existing equipped-weapon distinction is handled by Sell — Refine is allowed on equipped weapons).

**R7.2** The existing `WeaponCard` (Catalog tab) SHALL update its "Already Own (n)" indicator to show a per-rank breakdown when refinements exist among the player's owned copies: `Already Own 3 (1 Mastercrafted, 1 Refined, 1 stock)`. When no refinements exist, the existing simple count is unchanged.

**R7.3** The `useWeaponShop` hook (or the underlying inventory query) SHALL fetch each `WeaponInventory` row's `refinements` relation. The TypeScript type `WeaponInventoryItem` in `app/frontend/src/components/weapon-shop/types.ts` SHALL gain a `refinements: WeaponRefinementItem[]` field.

### R8: Frontend — Reusable Components

**R8.1** New component `app/frontend/src/components/weapon-refinement/SlotBar.tsx`:
- Props: `refinements: WeaponRefinementItem[]`, `workshopLevel: number`, `compact?: boolean` (for tight surfaces like robot detail equipped slot).
- Renders 5 boxes in a row. Filled slots show a tier-specific icon and color. Empty slots show a gate icon when the tier requirement is not met (with hover-tooltip explaining unlock), or an empty box when slots are simply unused.
- Tier color mapping: hone → cyan, augment → green, sharpen → amber, forge → red-orange.
- Each filled slot has a click/hover affordance opening the `RefinementHistoryPopover` for that specific slot.

**R8.2** New component `app/frontend/src/components/weapon-refinement/RankPrefix.tsx`:
- Props: `refinementCount: number`.
- Renders the rank prefix text using `calculateRankPrefix` from the shared module. Returns null for 0 refinements.

**R8.3** New component `app/frontend/src/components/weapon-refinement/RefinementHistoryPopover.tsx`:
- Props: `refinements: WeaponRefinementItem[]`, optional `focusSlotIndex?: number`.
- Lists each filled slot with: tier name, magnitude (e.g., "+3 Combat Power" for hone, "−0.25s cooldown" for sharpen), cost paid, date stamp.
- Total spend and total slots used summary at the bottom.

**R8.4** New component `app/frontend/src/components/weapon-refinement/CustomNameEditor.tsx`:
- Props: `inventoryItem: WeaponInventoryItem`, `onSave: (newName: string | null) => Promise<void>`.
- Inline editable text field. Validates: 0–60 characters, trimmed, allowed character set matches the existing `safeName` Zod primitive from `securityValidation.ts`.
- On save, calls `PATCH /api/weapon-inventory/:id/custom-name` (R10).
- Empty string clears the custom name (sends `null` to the backend).
- Disabled state when a save is in flight.

**R8.5** Tier color and icon decisions SHALL live in a single source-of-truth constant file (e.g., `app/frontend/src/components/weapon-refinement/tierVisuals.ts`) imported by SlotBar, RefinementHistoryPopover, RefinementModal, and any future surface. No inline color literals.

### R9: Frontend — Refinement Modal

**R9.1** New component `app/frontend/src/components/weapon-refinement/RefinementModal.tsx`:
- Props: `inventoryItem: WeaponInventoryItem`, `workshopLevel: number`, `userCurrency: number`, `onCancel: () => void`, `onConfirmed: (newInventoryItem, newCurrency, achievementUnlocks) => void`.
- Layout: header with the weapon name (with rank prefix), the SlotBar at the top, four tier cards (2x2 grid) below, then the tier-specific configurator, then a stat-delta preview, then the confirm bar.

**R9.2** Tier cards SHALL show: tier name, brief description, the unlock requirement, and a "locked" or "available" state. Locked cards (e.g., Forge at Workshop L5) are dimmed and disabled, with the unlock requirement visible. Cards reflect per-tier-cap state too — if Sharpen has 2/2, the Sharpen card shows "max reached" and is disabled. If 5/5 slots are filled overall, all four cards disable.

**R9.3** Tier-specific configurator:
- For Hone: a select/list of attributes the weapon currently grants (catalog bonuses + any prior Augment), and a magnitude picker (1–5).
- For Augment: a select/list of all 23 attributes minus those already granted, and a magnitude picker (1–5).
- For Sharpen: no configuration; magnitude is fixed at 1, target is the cooldown axis.
- For Forge: no configuration; magnitude is fixed at 1, target is the baseDamage axis.

**R9.4** Stat-delta preview SHALL show the projected effective stats AFTER the refinement using `applyRefinementsToWeapon` with the candidate refinement appended. The current → projected delta is shown inline (e.g., "Damage: 12 → 13 (+1)", "Combat Power bonus: +5 → +8 (+3)").

**R9.5** The confirm bar SHALL show: total cost, the player's current balance, the balance after refinement, and a Confirm button. The Confirm button SHALL be disabled when: any selection is invalid, the player can't afford it, or any validation from R2 fails. The button copy includes a permanence warning: "Refinement is permanent. Confirm to spend ₡<amount>."

**R9.6** On Confirm, the modal SHALL call `apiClient.post('/api/weapon-inventory/<id>/refine', payload)`. On 200, the modal closes and triggers `onConfirmed` with the updated state. On 4xx errors, the modal stays open and renders the server-provided error message in a banner — including details from R5.2 like "current Combat Power total is 9, request would push to 12 (max 10)".

**R9.7** The modal SHALL show, near the cost preview, a small note: "Refinement spend folds into resale value at your Workshop level (currently <rate>%)." This sets the right expectations and reinforces that the spend is not a complete sunk cost.

### R10: Custom Name Endpoint

**R10.1** A new route `PATCH /api/weapon-inventory/:id/custom-name` SHALL be added with: `authenticateToken`, Zod validation `{ customName: string | null }` (using `safeName` for non-null values, max length 60), `verifyWeaponOwnership`. Updates `WeaponInventory.customName` in a simple transaction (no row lock needed — this is a non-economic field).

**R10.2** The route SHALL be rate-limited at 30 requests per 10 minutes per user — well above normal use, well below abuse.

**R10.3** Setting `customName: null` clears the custom name. Setting an empty string is treated as null (server-side coercion).

**R10.4** The response is the updated `WeaponInventory` with the new `customName` field reflected.

### R11: In-Game Guide Article

**R11.1** A new entry in the in-game guide system SHALL be created titled "Weapon Refinement". The exact storage mechanism (markdown file, DB row, content JSON) follows the existing pattern used by other guide entries — implementation MUST inspect the existing guide structure first.

**R11.2** The article SHALL cover, with player-friendly language and concrete examples:
- What refinement is and why it matters (identity, ongoing progression, big credit sink).
- The four tiers with their effects, magnitude options, and per-tier caps.
- The 5-slot system and how rank prefixes are derived.
- Workshop tier gating and how it stacks with the existing Workshop benefits (purchase discount, resale rate).
- The per-attribute stack cap (+10) with a worked example.
- Resale interaction — refinement spend folds into pricePaid, recoverable on resale at Workshop rate.
- The custom name feature.
- Two example builds: an "identity Practice Sword" build (Hone-heavy) and a "DPS Volt Sabre" build (Sharpen + Forge).
- A clear permanence warning: "Refinement is final. Plan your spend."

**R11.3** The article SHALL link to (or be linked from) the existing weapon shop guide entry and the Workshop facility guide entry.

### R12: Documentation Updates

**R12.1** `docs/game-systems/PRD_WEAPON_ECONOMY.md` SHALL be updated to v1.6 with a new section "Version 1.6 Updates (Refinement Date) — Weapon Refinement" containing: problem statement, tier system, slot mechanics, gating, costs, resale interaction, and a "Files Modified" list.

**R12.2** `docs/game-systems/PRD_WEAPONS_LOADOUT.md` SHALL be updated to mention refinement in the weapon lifecycle section: "Purchase → Equip → **Refine** → Configure → Battle → Unequip / Sell".

**R12.3** `app/backend/docs/audit-logging-schema.md` SHALL be updated to document the new `weapon_refinement` event type and its payload schema.

**R12.4** `docs/BACKLOG.md` Entry #5 (Weapon Experimentation Problem) SHALL be updated to mark Weapon Refinement complete in its follow-ups list. The "Recently Completed" table SHALL gain a new row for this spec.

### R13: Public Changelog Entry

**R13.1** A changelog entry SHALL be authored via the admin changelog system (Spec #24) titled "Refine your weapons — make them yours". The body SHALL explain: what refinement is in plain language, the four tiers with one-line descriptions and Workshop unlock levels, an example identity build and DPS build (cost numbers), the rank prefix system, the custom name feature, the resale interaction, and a closing line: "The weapon you keep can be yours, fully."

**R13.2** A `CHANGELOG_DRAFT.md` SHALL be saved in the spec directory containing the body text used in R13.1, so the entry is reviewable in source control.

### R14: Backend Tests

**R14.1** Unit tests in `app/shared/utils/__tests__/weaponRefinement.test.ts` SHALL cover:
- `calculateRefinementCost` for all four tiers across the magnitude range and instance counts; boundary cases (magnitude 0/6, instance 2/3 for capped tiers).
- `validateRefinementSlotAvailable` — empty inventory, full inventory, max-Sharpen (2), max-Forge (2).
- `validateAttributeStackCap` — under-cap, exactly-at-cap, over-cap, with mixed catalog/Hone/Augment contributions.
- `validateAttributeOnWeapon` — Hone on catalog attribute, Hone on Augmented attribute (allowed), Hone on absent attribute (rejected), Augment on absent attribute (allowed), Augment on catalog attribute (rejected), Augment on already-Augmented attribute (rejected).
- `validateShieldCompatibility` — shield + Sharpen rejected, shield + Forge rejected, shield + Hone allowed, shield + Augment allowed, non-shield all allowed.
- `applyRefinementsToWeapon` — every tier independently and in combinations; effective stats match formula; no mutation of inputs.
- `calculateRankPrefix` — 0/1/2/3/4/5 slot counts; out-of-range inputs.
- `formatWeaponDisplayName` — with and without rank prefix, with and without customName.

**R14.2** Property-based tests using fast-check in `app/shared/utils/__tests__/weaponRefinement.property.test.ts` SHALL cover:
- For any random refinement sequence applied via the formula module, the resulting effective stats match independent recomputation.
- Cost is monotonic (a higher magnitude or higher instance index never costs less).
- `applyRefinementsToWeapon` is order-independent for stat outputs (refinements are commutative).
- The combined attribute stack cap is never exceeded by any sequence the validator accepts.

**R14.3** Integration tests in `app/backend/tests/weaponInventory.refine.test.ts` SHALL cover (matching the depth of `weaponInventory.test.ts` for the resale flow):
- Successful refinement at Workshop L1 (Hone), L3 (Augment), L5 (Sharpen), L8 (Forge).
- Each error code path: tier-locked, slot-cap-exceeded, tier-cap-exceeded, attribute-stack-cap-exceeded, magnitude-out-of-range, attribute-not-on-weapon (Hone), attribute-already-on-weapon (Augment), shield-cannot-take-DPS-tier.
- Insufficient currency.
- 401 without auth.
- 403 attempting to refine another user's weapon.
- 404 on nonexistent inventory ID.
- Currency decrements by exactly the cost.
- `pricePaid` increments by exactly the cost.
- A `weapon_refinement` row is inserted with all fields populated correctly (slotIndex stable).
- `eventLogger.logWeaponRefinement` is called and an audit log row is written.
- `securityMonitor.trackSpending` IS called.
- Rate limit: 11th request in a 5-minute window from the same user returns 429.
- Concurrent refinement on the same weapon: two parallel POSTs — exactly one succeeds, the other fails with 409 (slot-cap or tier-cap depending on race).
- Concurrent refinement-vs-resale on the same weapon: either refinement succeeds and resale recovers the higher pricePaid, or resale succeeds and refinement fails with 404. Never both succeed.
- Concurrent refinement-vs-equip on the same weapon: both succeed (refinement is allowed on equipped weapons), but the row lock ensures the operations don't interleave their writes.
- Achievement unlocks: "First Refinement" on first call, "Master Craftsman" after enough cumulative spend, "Legendary Smith" on the 5th refinement of a single weapon, "Identity Forged" on the 5th refinement of a Practice Sword, "Forge Master" after assembling 2 Sharpen + 2 Forge on a single weapon.

**R14.4** A combat regression test in `app/backend/src/services/battle/__tests__/combatSimulator.refinement.test.ts` SHALL: create two robots with identical attributes; equip one with a stock weapon and the other with the same weapon refined (e.g., +1 Forge, +2 Hone Combat Power); simulate a deterministic battle (seeded RNG); assert the refined-weapon robot wins by the expected margin and the per-hit damage matches independent calculation.

### R15: Frontend Tests

**R15.1** Component tests in `app/frontend/src/components/weapon-refinement/__tests__/`:
- `SlotBar.test.tsx` — renders 5 slots; filled slots show correct icons and colors; empty slots above Workshop level show locked tooltips; click-through opens history popover.
- `RankPrefix.test.tsx` — derivation across 0–5 slot counts.
- `RefinementHistoryPopover.test.tsx` — lists all refinements with correct field ordering.
- `CustomNameEditor.test.tsx` — input validation, save flow, clear flow, error handling.
- `RefinementModal.test.tsx` — renders all four tier cards with correct lock states; tier selection updates the configurator; magnitude picker for Hone/Augment; stat preview matches `applyRefinementsToWeapon`; cost preview matches `calculateRefinementCost`; Confirm button disabled in invalid states; on Confirm calls API with correct payload; success closes modal; error keeps modal open with banner.

**R15.2** Page-level tests in `app/frontend/src/pages/__tests__/WeaponShopPage.refine.test.tsx`:
- Inventory tab renders the slot bar and Refine button on every owned weapon.
- Clicking Refine on any owned weapon opens the modal with the correct inventory item.
- Successful refinement updates the inventory tab without a page refresh: rank prefix updates, slot bar updates, currency in the header updates.
- "Already Own" badge in the catalog tab reflects rank breakdown after refinement.
- Achievement unlock toast renders when the API response includes an `achievementUnlocks` entry.

### R16: Security Considerations Summary

**R16.1** All R3 security protections from Spec #33 (Weapon Resale) apply to the refinement endpoint, with the following deltas:
- Rate limit: 10/5min (vs resale's 30/5min) — refinement is a more deliberate action.
- `securityMonitor.trackSpending` IS called (vs resale where it isn't) — refinement is spending.
- Lock acquisition order matches resale and equip handlers exactly (user row → weapon_inventory row), preventing deadlocks across the three operation types.
- Zod-validated body with reused `safeName` and attribute-name primitives — no inline regex.
- All errors return generic messages to the client; specifics are in the structured `details` payload only when safe to expose (e.g., the player's own weapon's stack cap is fine to reveal; another user's weapon's existence is not).

### R17: Documentation Tasks Summary (for tasks.md cross-reference)

**R17.1** All documentation updates from R12, R11, R13 SHALL be reflected as explicit tasks in `tasks.md`, naming the specific files. No vague "update docs" tasks. The tasks file SHALL list every file that gets modified, in the order the refinement system would naturally be implemented (schema → migration → shared formulas → backend route → tests → frontend → docs → changelog).
