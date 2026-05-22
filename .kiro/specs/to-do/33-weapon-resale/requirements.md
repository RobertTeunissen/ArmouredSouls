# Requirements Document

## Spec: Weapon Resale

## Glossary

- **Weapon Resale**: The act of converting an owned weapon back into credits by deleting its `WeaponInventory` row.
- **Resale Rate**: The percentage of the original price paid that is returned to the player. Scales with Weapon Workshop level (0% at L0, +10% per level, capped at 100% at L10).
- **Price Paid**: The actual credit amount the player spent at purchase time, after Workshop discount. Stored on `WeaponInventory.pricePaid`. Used as the base for resale value calculation.
- **Catalog Price**: The base `cost` field on the `Weapon` model — the un-discounted shop price. NOT used for resale calculation (anti-exploit reason).
- **Weapon Workshop**: An existing facility (`facilityType = 'weapons_workshop'`) that grants weapon purchase discounts. After this spec, it also determines resale rate.
- **Equipped Weapon**: A `WeaponInventory` row currently referenced by `Robot.mainWeaponId` or `Robot.offhandWeaponId`. Equipped weapons cannot be sold.
- **Starter Weapon**: A weapon granted free to a new user during account creation via `userGeneration.ts`. Has `pricePaid = 0` and yields ₡0 on resale.

## Introduction

Players in Armoured Souls cannot sell weapons. Once a weapon is purchased, the credits are gone — there is no path to recover any portion of the cost, even partially, even after a Workshop upgrade. This makes weapon experimentation expensive: every purchase is a permanent commitment, and the only way to "undo" a bad weapon choice is to leave it sitting unused in inventory until storage capacity forces a hard decision.

The DPS rebalance (Spec #31) made all four loadout types competitive on paper, but players still don't switch weapons in practice because the switching cost remains prohibitive. Resale closes that gap. It also gives the Workshop facility a second meaningful purpose beyond purchase discounts: each Workshop level grants both a 10% purchase discount AND a 10% resale rate, so investing in the Workshop pays off on both ends of every weapon transaction.

This spec adds a server-authoritative weapon resale flow with a dedicated route handler, a new `pricePaid` column on `WeaponInventory` to prevent free-weapon arbitrage, a Workshop-level-dependent resale rate formula in `app/shared/utils/discounts.ts`, and a "My Inventory" tab on the existing weapon shop page with a per-weapon Sell button and confirmation modal.

## Context: Discussion Notes

The following observations and design choices were made during scoping and are recorded here for traceability.

### Anti-Exploit: Resale Rate Applies to Price Paid, Not Catalog Price

Workshop Level 10 grants a 100% purchase discount (free weapons). If resale rate were applied to catalog price, a player at Workshop L10 could:
1. Buy a ₡425K weapon for ₡0
2. Sell it back for ₡425K × 100% = ₡425K
3. Repeat infinitely

To prevent this, resale price is computed as `pricePaid × resaleRate`, where `pricePaid` is the actual credit amount the player paid at purchase time. A new `WeaponInventory.pricePaid` column stores this value. Existing weapons (purchased before this spec) get backfilled with the current catalog price as a best-effort approximation — players cannot exploit this since the backfill happens once and is anchored to historical reality.

### Resale Rate Formula

Linear at 10% per Workshop level, mirroring the existing purchase discount slope:

```
resaleRate(level) = level × 10   // capped at 100%
```

- L0: 0% (resale unavailable until Workshop L1 is built — gives the facility immediate first-purchase value)
- L1: 10%
- L3: 30% (top of new-player accessible range; first three levels have no prestige gate)
- L5: 50%
- L7: 70% (1500 prestige gate at L4, 5000 prestige gate at L7)
- L10: 100% (full credit recovery; 10000 prestige gate at L9)

**Why level × 10:**

1. **Matches the project's incremental convention.** Every other facility in the game uses a single linear slope (Workshop purchase discount 10%/level, Training Facility 10%/level, Medical Bay 10%/level, Repair Bay 5%/level, Streaming Studio 100%/level). Resale rate follows the same pattern.

2. **Same slope as the Workshop purchase discount.** Clean dual-purpose teaching: "Workshop level rewards you 10% on both buying and selling." One number to remember, no asymmetric formula to explain.

3. **Meaningful new-player progression.** Each L0→L3 upgrade is +10 absolute percentage points on the resale rate. On a ₡100K starter-tier weapon, that's +₡10K per Workshop level invested — a real and visible reward stacked on top of the purchase discount benefit.

4. **0% at L0 is a feature.** Workshop L1 costs ₡75K (the cheapest facility tier in the game). The resale system is locked behind that one purchase, making L1 a meaningful unlock rather than a marginal upgrade. New players face a real strategic choice: "do I buy my first weapon, or buy Workshop L1 first to enable experimentation?"

5. **L10 hits exactly 100%.** Clean ceiling, full liquidity at max Workshop level. Exploit-safe because resale is anchored to `pricePaid`, not catalog price — a player who buys at L10 (paying ₡0 due to the 100% purchase discount) recovers ₡0 on resale regardless of rate.

6. **Simplest possible implementation.** `Math.min(100, level * 10)` with level clamped to [0, 10]. No piecewise logic, trivially property-testable.

### Equipped Weapons Cannot Be Sold

A weapon currently equipped as `mainWeapon` or `offhandWeapon` on any robot cannot be sold — the player must unequip it first. This is enforced both by the FK constraint (`Robot.mainWeaponId` / `Robot.offhandWeaponId` reference `WeaponInventory.id`) and explicitly in the route handler with a clear error message and a 409 status code. The frontend disables the Sell button for equipped weapons and shows a tooltip explaining why.

### Resale Is Final — No Undo

Once a weapon is sold, the `WeaponInventory` row is deleted, credits are added, and the action cannot be reversed. The frontend surfaces this with a confirmation modal that displays exactly what the player will receive. No "are you sure?" toast — a real modal with the credit amount, weapon name, and an explicit confirm button.

### Out of Scope

- **Weapon upgrades** (#5 follow-up) — leveling individual weapon instances over time. Larger spec, depends on resale being in place first so players have a switching mechanism for upgraded weapons.
- **Bulk resale** — selling multiple weapons in a single transaction. Per-row resale is sufficient for the experimentation problem this spec addresses.
- **Resale of starter weapons** — onboarding-granted weapons can be sold like any other. The starter loadout cost the player nothing (`pricePaid = 0`), so resale yields ₡0. This is intentional — it removes the weapon from inventory (freeing storage) without granting credits.
- **Trade-in toward another weapon** — atomic "sell A, buy B" with combined pricing. Sequential operations (sell, then buy) achieve the same outcome with simpler code.

## Expected Contribution

This spec addresses Backlog #5 (Weapon Experimentation Problem) by removing the permanent-commitment penalty on weapon purchases.

1. **Switching cost reduction**: Before — selling any weapon recovers ₡0, total cost of switching weapons equals the new weapon price (no recovery). After — resale rate scales linearly with Workshop level: L0 returns ₡0 (resale gated behind L1 purchase), L1 returns 10%, L3 returns 30%, L10 returns 100%. On a ₡100K starter weapon, players recover ₡0 / ₡10K / ₡30K / ₡100K respectively. The "switching cost" of trading up to a ₡425K weapon drops by 0% / ~2% / ~7% / ~24% depending on Workshop investment — and the marginal value of each Workshop level upgrade matches the slope of its existing purchase discount.

2. **Workshop second purpose**: Before — Workshop level affects only purchase discount, with diminishing marginal value once the player can afford the weapons they want. After — Workshop level affects both purchase discount and resale rate at the same 10%/level slope, creating a unified "Workshop level rewards you 10% on both ends of every transaction" mental model. L1 in particular becomes a meaningful unlock since it activates the resale system from a 0% floor.

3. **Storage pressure relief**: Before — players hoard unused weapons because deletion has no economic value. After — players can convert unused weapons into credits (once Workshop L1 is built), freeing storage capacity without an emotional "throw away credits" moment.

4. **Anti-exploit guarantee**: The `pricePaid` column ensures resale value is anchored to actual credits spent, not catalog price. A Workshop L10 player who acquires weapons for free recovers ₡0 on resale — no infinite money loop, no economic disruption, even at the 100% resale rate.

5. **Equipped-weapon protection**: Players cannot accidentally sell a weapon currently in use on a robot. The 409 error with explicit message guides them to unequip first.

6. **Behavioral reward layer**: Four new achievements (E18 Pawn Star, E19 Shrewd Negotiator, E20 Arms Dealer, E21 Buy High Sell Higher) reward the experimentation behavior this spec is designed to encourage. Before — the achievement catalog has 17 economy achievements (E1–E17), none rewarding resale. After — 21 economy achievements covering the full purchase-and-sell loop, with milestones at first sale, ₡500K lifetime resale earnings, 10 sales, and a maxed-Workshop sale.

### Verification Criteria

After all tasks are complete, run these checks:

1. `npx prisma migrate status` — migration adding `WeaponInventory.pricePaid` is applied with no drift.
2. `psql ... -c "SELECT COUNT(*) FROM weapon_inventory WHERE price_paid IS NULL;"` — returns 0 (all rows backfilled).
3. `grep -rn "calculateWeaponResaleRate" app/shared/utils/discounts.ts` — formula function exists in shared utils.
4. `grep -rn "/api/weapon-inventory.*sell\|/sell" app/backend/src/routes/weaponInventory.ts` — sell route is registered.
5. `cd app/backend && npm test -- weaponInventory` — all weapon inventory tests pass, including new resale tests covering: equipped-weapon rejection, ownership rejection, transaction integrity (lock acquired before update), price calculation accuracy, audit log emission, concurrent resale-vs-resale on the same weapon, concurrent resale-vs-equip on the same weapon, defensive `pricePaid >= 0` guard, rate-limit 429 after 30 successful resales in 5 minutes.
6. Manual integration test: log in as a test user, equip a weapon, attempt to sell — confirm 409 error. Unequip, sell — confirm credit balance increased by `pricePaid × resaleRate(workshopLevel)` and inventory row deleted.
7. `cd app/frontend && npm test -- WeaponShop` — all weapon shop frontend tests pass, including new tests for the inventory tab and sell flow.
8. `psql ... -c "SELECT event_type, COUNT(*) FROM audit_log WHERE event_type='weapon_sale';"` — at least one row exists after a manual sale, confirming `eventLogger.logWeaponSale` is wired up.
9. Frontend screenshot: WeaponShopPage has a visible "My Inventory" tab next to the catalog view. The inventory tab shows owned weapons with Sell buttons. Equipped weapons show disabled Sell buttons with a tooltip.
10. Changelog entry created and published explaining the resale feature to players.
11. `grep -rn "FOR UPDATE.*weapon_inventory" app/backend/src/` — both the resale handler (`weaponInventory.ts`) and the equip handlers (`robotWeaponService.ts`) acquire the same `weapon_inventory` row lock.
12. `grep -rn "trackSpending" app/backend/src/routes/weaponInventory.ts` — only the purchase handler calls `trackSpending`. The DELETE handler does NOT.
13. Race-condition stress test: run a Jest test that fires 50 parallel "purchase + resell + equip + unequip" cycles for the same user and asserts: total currency change matches the expected sum, no orphaned weapon_inventory rows, no robots pointing to deleted weapons (`SELECT id FROM robots WHERE main_weapon_id IS NOT NULL AND main_weapon_id NOT IN (SELECT id FROM weapon_inventory)` returns 0).
14. `grep -n "id: 'E1[89]'\\|id: 'E2[01]'" app/backend/src/config/achievements.ts` — four new economy achievements (E18–E21) are present in the config file.
15. `grep -n "weapon_sold" app/backend/src/services/achievement/achievementService.ts` — the new `weapon_sold` event type is wired into `EVENT_TRIGGER_MAP`.
16. Manual integration: complete a sale via the UI, confirm any unlocked achievements show up as toasts on the WeaponShopPage. Specifically test the "Pawn Star" easy achievement on first sale.

## Requirements

### R1: Database Schema Change

**R1.1** A new column `pricePaid` (Int, nullable initially for migration safety, then NOT NULL after backfill) SHALL be added to the `WeaponInventory` model in `app/backend/prisma/schema.prisma`.

**R1.2** A Prisma migration SHALL be created that:
- Adds the `price_paid` column to `weapon_inventory` as nullable.
- Backfills existing rows by setting `price_paid = weapons.cost` (joined via `weapon_id`).
- Alters the column to NOT NULL after backfill.

**R1.3** The Prisma client SHALL be regenerated after the schema change so the field is available in TypeScript.

**R1.4** The existing weapon purchase route handler in `src/routes/weaponInventory.ts` SHALL be updated to write the actual `finalCost` paid into `WeaponInventory.pricePaid` when creating new inventory rows.

**R1.5** The `userGeneration.ts` script that creates starter weapons for new users SHALL set `pricePaid = 0` for granted weapons (since the user pays nothing for them).

### R2: Resale Rate Formula

**R2.1** A new function `calculateWeaponResaleRate(level: number): number` SHALL be added to `app/shared/utils/discounts.ts`. It returns the resale percentage as a number between 0 and 100 inclusive.

**R2.2** The formula SHALL be `level × 10`, with the input level clamped to `[0, 10]` and the result therefore naturally bounded to `[0, 100]`.

**R2.3** A helper `applyResaleRate(pricePaid: number, ratePercent: number): number` SHALL be added to the same file. It returns `Math.floor(pricePaid * ratePercent / 100)`.

**R2.4** Both functions SHALL be exported from `app/shared/utils/index.ts`.

**R2.5** When `calculateWeaponResaleRate(0) === 0`, the resale flow MAY still proceed (the inventory row is deleted, currency is incremented by 0). The frontend SHALL inform the player explicitly that the sale price is ₡0 in the confirmation modal so they can cancel if they only intended to free up credits, not just storage.

### R3: Resale Route Handler

**R3.1** A new route `DELETE /api/weapon-inventory/:id` SHALL be added to `src/routes/weaponInventory.ts`. The route SHALL require authentication via `authenticateToken`.

**R3.2** The route SHALL validate the `:id` param using a Zod schema (reusing the existing `inventoryIdParamsSchema` pattern in the file).

**R3.3** The route SHALL call `verifyWeaponOwnership(prisma, inventoryId, userId)` before any mutation. Ownership failures SHALL return 403 with the generic "Access denied" message.

**R3.4** Inside a Prisma interactive transaction, the route SHALL:
1. Call `lockUserForSpending(tx, userId)` to acquire the user row lock.
2. Acquire a `SELECT id, user_id, weapon_id, price_paid FROM weapon_inventory WHERE id = $1 FOR UPDATE` row lock on the target weapon_inventory row. This serializes resale-vs-resale on the same row AND resale-vs-equip on the same weapon (R3.9).
3. Re-verify ownership inside the transaction by comparing the locked row's `user_id` to the authenticated `userId`. On mismatch, log via `securityMonitor.logAuthorizationFailure` and throw 403.
4. Defensively assert `pricePaid >= 0`. If the assertion fails, log an error and throw `EconomyError(INVALID_TRANSACTION, ..., 500)`. This guards against malformed data or future bugs that could write a negative value despite the NOT NULL schema constraint.
5. Re-fetch the user's Workshop facility level inside the transaction.
6. Verify the weapon is not currently equipped on any robot (`mainWeaponId` or `offhandWeaponId`). If equipped, throw `EconomyError` with the new code `WEAPON_EQUIPPED` and 409 status, including `{ robotId, robotName }` in the error details.
7. Compute resale price: `applyResaleRate(weaponInv.pricePaid, calculateWeaponResaleRate(workshopLevel))`.
8. Increment user currency by the resale price.
9. Delete the `weaponInventory` row.

**R3.5** After the transaction, the route SHALL log the sale via `eventLogger.logWeaponSale(currentCycle, userId, weaponId, salePrice)` (the existing stub method).

**R3.6** The route SHALL log via the `logger` module a structured line including userId, weapon name, sale price, Workshop level, resale rate, and old/new currency balance — matching the format used by the purchase handler.

**R3.7** The route SHALL respond with `{ salePrice, currency, weaponName, message }`.

**R3.8** A new error code `WEAPON_EQUIPPED` SHALL be added to `EconomyErrorCode` enum in `src/errors/economy.ts` (or wherever that enum lives) with appropriate documentation.

**R3.9** The existing `equipMainWeapon` and `equipOffhandWeapon` functions in `app/backend/src/services/robot/robotWeaponService.ts` SHALL be updated to acquire a `SELECT ... FOR UPDATE` row lock on the target `weapon_inventory` row before reading or updating the robot. Lock acquisition order (user row first, weapon_inventory row second) SHALL match the resale handler to prevent deadlocks. This change is required because `Robot.main_weapon_id` uses `ON DELETE SET NULL`, so the FK is not a defense-in-depth backup against an unsynchronized resale-vs-equip race — the locked equipped-check is the sole authoritative guard.

**R3.10** A per-user rate limiter SHALL be applied to `DELETE /api/weapon-inventory/:id`: 30 requests per 5-minute rolling window, keyed by `req.user.userId`. The limiter middleware SHALL run AFTER `authenticateToken` so `req.user` is populated. Violations SHALL be reported via `securityMonitor.trackRateLimitViolation(userId, 'weapon_resale', { sourceIp, endpoint })` so they appear in the admin Security dashboard. The 31st request in a window returns HTTP 429 with a generic "Too many resale attempts" message.

**R3.11** The resale handler SHALL NOT call `securityMonitor.trackSpending` — resale is a credit gain, not spending, and tracking it through the spending-anomaly detector would skew that signal. The `audit_log` row written by `eventLogger.logWeaponSale` is the canonical tracking surface for resale activity.

### R4: Backend Tests

**R4.1** Tests in `app/backend/tests/weaponInventory.test.ts` SHALL be extended with a `describe('DELETE /api/weapon-inventory/:id')` block covering:
- Successful sale at Workshop L0 (0% rate — sale completes, currency increments by 0, weapon row deleted)
- Successful sale at Workshop L1 (10% rate)
- Successful sale at Workshop L5 (50% rate)
- Successful sale at Workshop L10 (100% rate — full credit recovery)
- Sale of starter weapon (pricePaid=0) returns ₡0 regardless of Workshop level and deletes the row
- 401 without authentication
- 403 when selling another user's weapon
- 404 when inventory ID does not exist
- 409 when weapon is equipped as main weapon
- 409 when weapon is equipped as offhand weapon
- Currency is incremented by exactly the computed sale price
- Audit log row is created with `event_type = 'weapon_sale'`
- Concurrent resale of the same weapon: two parallel DELETE requests on the same inventory ID — exactly one succeeds (200), the other fails (404 or 409 depending on timing). No double-credit.
- Concurrent resale-vs-equip race: simultaneous DELETE resale and PUT equip-main-weapon on the same weapon — either resale succeeds and equip fails with 404 (weapon gone), OR equip succeeds and resale fails with 409 (weapon equipped). Never both succeed. Robot's `mainWeaponId` is consistent with the surviving inventory state.
- Defensive `pricePaid` guard: if `pricePaid` is forced negative via direct DB write (test fixture only), the resale returns 500 and writes no audit row.
- Rate limit: 31st resale request in a 5-minute window from the same authenticated user returns 429. `securityMonitor.trackRateLimitViolation` is called.
- `securityMonitor.trackSpending` is NOT called by the resale handler (verified via spy).

**R4.2** A unit test file `app/shared/utils/__tests__/discounts.test.ts` (or extension of an existing one) SHALL cover:
- `calculateWeaponResaleRate(0)` returns 0
- `calculateWeaponResaleRate(1)` returns 10
- `calculateWeaponResaleRate(3)` returns 30
- `calculateWeaponResaleRate(10)` returns 100
- `calculateWeaponResaleRate(-1)` returns 0 (clamping)
- `calculateWeaponResaleRate(11)` returns 100 (clamping)
- `applyResaleRate(1000, 0)` returns 0
- `applyResaleRate(1000, 30)` returns 300
- `applyResaleRate(1000, 100)` returns 1000
- `applyResaleRate(0, 50)` returns 0

### R5: Frontend Inventory Tab

**R5.1** The `WeaponShopPage` SHALL gain a tabbed view with two tabs: "Catalog" (existing weapon shop view, default) and "My Inventory" (new). Tab selection SHALL persist via URL query param (`?tab=inventory`) so a refresh keeps the tab.

**R5.2** The "My Inventory" tab SHALL display all owned weapons grouped into two visually distinct sections, **in this order**:
1. **"Available to Sell"** — weapons not currently equipped on any robot. Rendered first so the player sees their actionable inventory at a glance.
2. **"Equipped"** — weapons currently equipped on a robot. Rendered second, visually de-emphasized (e.g., dimmed background, lock icon), with the robot name shown.

Each section SHALL display its count in the section heading (e.g., "Available to Sell (4)" / "Equipped (2)").

**R5.3** Each weapon row in either section SHALL show:
- Weapon name and weapon type badge (matching catalog tab styling)
- Original catalog cost (`weapon.cost`) and price paid (`pricePaid`) — both labeled so the player understands the sale-price basis
- Computed sale price at the current Workshop level (live-calculated using `calculateWeaponResaleRate` and `applyResaleRate`)
- For the "Equipped" section: the robot name displayed prominently as `Equipped on: {robotName}` (linked to the robot's detail page if practical), plus the equip slot ("Main" or "Offhand")
- For the "Available to Sell" section: a Sell button (enabled)
- For the "Equipped" section: a disabled Sell button with a tooltip `Unequip from {robotName} first to sell` and a visible "Equipped" badge instead of the price-paid label

**R5.4** When a weapon is equipped on multiple robots (a corner case from offhand sharing), the equipped-status display SHALL list all robot names. The Sell button stays disabled with a tooltip listing every robot the player must unequip from first.

**R5.5** When the inventory has no equipped weapons, the "Equipped" section SHALL be hidden (not shown empty). When the inventory has no available-to-sell weapons (e.g., all weapons are equipped), the "Available to Sell" section SHALL render an empty-state message: "No unequipped weapons. Visit a robot to unequip a weapon before selling."

**R5.6** Clicking "Sell" SHALL open a confirmation modal showing: weapon name, weapons attribute summary, sale price, current Workshop level + rate (e.g., "Workshop L3 — 30% resale rate"), and a clear warning that the action cannot be undone. Modal has Cancel and Confirm buttons. When the resale rate is 0% (Workshop L0), the modal SHALL display the ₡0 sale price prominently and warn the player that selling at L0 yields no credits — the player can still confirm if they only want to free up storage.

**R5.7** Confirming the sale SHALL call `apiClient.delete('/api/weapon-inventory/:id')` and on success: refresh the inventory list, refresh the user currency, show a success toast/banner with "Sold {weapon} for ₡{price}". The sold weapon SHALL disappear from the "Available to Sell" section without requiring a page refresh.

**R5.8** A summary bar at the top of the My Inventory tab SHALL show three quick-glance stats: total inventory count, count available to sell, and total credit value if everything available were sold at the current Workshop rate. The total-value calculation SHALL update live when the underlying data changes (e.g., after a successful sale).

**R5.9** The catalog tab's "Already Own (n)" badge SHALL continue to work (no changes needed).

### R6: Frontend Tests

**R6.1** Frontend tests in `app/frontend/src/pages/__tests__/` SHALL cover:
- Inventory tab renders the "Available to Sell" and "Equipped" sections in correct order with correct counts
- Equipped weapons appear only in the Equipped section, with robot name and slot ("Main"/"Offhand") visible
- Equipped section is hidden when no weapons are equipped
- Empty-state message renders when all weapons are equipped (no available-to-sell)
- A weapon equipped on multiple robots lists all robot names in the equipped row
- Summary bar shows correct totals (count, sellable count, total resale value)
- Sell button is enabled in the Available section, disabled in the Equipped section
- Tooltip on disabled Sell button names the robot the weapon is equipped on
- Clicking Sell on an available weapon opens the confirmation modal
- Confirming the modal calls the DELETE endpoint with the correct ID
- Cancel closes the modal without making any API call
- Successful sale removes the weapon from the Available section and updates the summary bar without a page refresh
- Tab state persists in URL query string

### R7: Achievements

The achievement system (Spec #27) is the project's progression layer. Adding 4 resale-themed achievements rewards the behaviors this spec is designed to encourage (experimentation, decisiveness about loadout changes) and gives the changelog entry a clear "play with the new feature, earn badges" hook.

**R7.1** Four new achievements SHALL be added to `app/backend/src/config/achievements.ts` with IDs E18 through E21 (E17 is currently the highest economy ID). All four SHALL use `category: 'economy'` and `scope: 'user'` to match the existing weapon-purchase achievements (E5, E6).

**R7.2** Achievement E18 — "Pawn Star":
- Description: "Sell your first weapon"
- Tier: easy
- Trigger type: `weapons_sold_count`, threshold: 1
- Progress type: boolean
- Hidden: false
- Reference: pawn shop / Pawn Stars TV show

**R7.3** Achievement E19 — "Shrewd Negotiator":
- Description: "Earn ₡500,000 lifetime from weapon resales"
- Tier: medium
- Trigger type: `weapons_sold_credits`, threshold: 500_000
- Progress type: numeric
- Progress label: "credits earned from resales"
- Hidden: false
- Reference: business / negotiation trope

**R7.4** Achievement E20 — "Arms Dealer":
- Description: "Sell 10 weapons"
- Tier: hard
- Trigger type: `weapons_sold_count`, threshold: 10
- Progress type: numeric
- Progress label: "weapons sold"
- Hidden: false
- Reference: arms dealer trope

**R7.5** Achievement E21 — "Buy High, Sell Higher":
- Description: "Sell a weapon at Workshop Level 10 (full credit recovery)"
- Tier: hard
- Trigger type: `weapon_sold_at_max_workshop`
- Progress type: boolean
- Hidden: false
- Reference: trader meme

**R7.6** Three new trigger types SHALL be added to `AchievementTriggerType` in `app/backend/src/config/achievements.ts`:
- `weapons_sold_count` — cumulative count of weapons sold by the user (lifetime)
- `weapons_sold_credits` — cumulative credits earned from weapon sales (lifetime)
- `weapon_sold_at_max_workshop` — boolean trigger fired when a sale occurs at Workshop level 10

**R7.7** A new event type `weapon_sold` SHALL be added to `AchievementEventType` in `app/backend/src/services/achievement/achievementService.ts`. The event payload SHALL include: `weaponId`, `salePrice`, `pricePaid`, `workshopLevel`.

**R7.8** The `EVENT_TRIGGER_MAP` in `achievementService.ts` SHALL map `weapon_sold` to `[weapons_sold_count, weapons_sold_credits, weapon_sold_at_max_workshop]`.

**R7.9** The achievement service `checkCriterionMet` switch statement SHALL handle the three new trigger types:
- `weapons_sold_count`: query `prisma.auditLog.count({ where: { userId, eventType: 'weapon_sale' } })` and compare to threshold.
- `weapons_sold_credits`: aggregate `salePrice` across all `weapon_sale` audit log rows for the user via `prisma.$queryRaw` with a SUM over the JSON payload field.
- `weapon_sold_at_max_workshop`: read `event.data.workshopLevel === 10`.

**R7.10** The resale route handler SHALL call `achievementService.checkAndAward(userId, null, { type: 'weapon_sold', data: { weaponId, salePrice, pricePaid, workshopLevel } })` AFTER the transaction commits and AFTER the audit log is written. The call SHALL be wrapped in a try-catch that logs failures but does NOT block the response (matching the existing pattern in the purchase handler).

**R7.11** The resale response SHALL include an `achievementUnlocks: UnlockedAchievement[]` field so the frontend can display unlock toasts immediately after a sale (matching the purchase response shape).

**R7.12** Frontend tests for the inventory sell flow SHALL include a case where the API response contains `achievementUnlocks` and assert the unlock toast/modal renders (using the existing `AchievementUnlockToast` component pattern from purchase tests).

### R8: Documentation Updates

**R8.1** `docs/game-systems/PRD_WEAPON_ECONOMY.md` SHALL be updated with a new "Weapon Resale" section documenting the resale rate formula, the `pricePaid` column, and the equipped-weapon restriction.

**R8.2** `docs/architecture/PRD_FACILITIES_PAGE.md` (or whichever doc describes the Workshop facility) SHALL be updated to mention the dual-purpose role: purchase discount + resale rate.

**R8.3** `app/backend/docs/audit-logging-schema.md` SHALL be updated to document the `weapon_sale` event type and its payload (`{ weaponId, salePrice }`).

**R8.4** A changelog entry SHALL be created via the admin changelog system explaining the resale feature to players. The entry SHALL include: the formula in plain language, an example of resale at different Workshop levels, a clear note that equipped weapons must be unequipped first, and a mention that 4 new achievements (E18–E21) reward selling activity.

**R8.5** `docs/BACKLOG.md` SHALL be updated to move "Weapon resale" from the "Future Direction" subsection of #5 to the "Recently Completed" table, and the spec link SHALL point to `done-{month}{year}/33-weapon-resale/`.

**R8.6** The achievement system documentation (e.g., `docs/game-systems/PRD_ACHIEVEMENTS.md` if it exists, otherwise the achievement-related section in another design doc) SHALL be updated to include the 4 new achievements in the catalog.

### R9: Verification

**R9.1** All Verification Criteria from the Expected Contribution section SHALL be executed and passing before the spec is considered complete.

**R9.2** A GitNexus impact analysis (`gitnexus_impact`) SHALL be run on the modified `purchase` route handler and on `lockUserForSpending` to confirm no unexpected callers are affected.

**R9.3** The full backend test suite SHALL pass: `cd app/backend && npm test -- --silent`.

**R9.4** The full frontend test suite SHALL pass: `cd app/frontend && npm test -- --run`.

**R9.5** ESLint SHALL pass for all modified files: `cd app/backend && npm run lint` and `cd app/frontend && npm run lint`.
