# Changelog Draft — Weapon Refinement

**Title**: Refine your weapons — make them yours
**Category**: Feature
**Publish target**: After full integration test pass and runtime DB migration

---

## Body

You can now refine your weapons. Permanently improve any weapon in your inventory across four tiers, build a Mastercrafted Volt Sabre named "Old Faithful", and watch your battle log show off your investment in every attack event.

### What changes

Every weapon you own now has **5 refinement slots** and a **rank prefix** that shows up next to its name everywhere — inventory, robot loadout, battle reports. Refinement comes in four tiers:

- **Hone** (Workshop L1, ₡10K–₡250K) — boost an attribute the weapon already grants by +1 to +5.
- **Augment** (Workshop L3, ₡20K–₡500K) — add a brand new attribute bonus, +1 to +5.
- **Sharpen** (Workshop L5, ₡300K → ₡900K for 2nd) — reduce base cooldown by 0.25s. Capped at 2.
- **Forge** (Workshop L8, ₡400K → ₡1.2M for 2nd) — increase base damage by 1.0. Capped at 2.

A weapon with 1–2 refinements becomes **Refined**. With 3 it's **Crafted**. With 4 it's **Mastercrafted**. With all 5 slots filled it's **Legendary**.

### Two example builds

**Identity Practice Sword** (₡2.15M total): max out a starter weapon with +10 Combat Power, +5 Attack Speed, +5 Critical Systems, +1 base damage. Legendary status. Won't beat a stock Volt Sabre on raw DPS, but it's *yours*.

**DPS Volt Sabre** (₡3.05M total): 2× Sharpen + 2× Forge + 1 Hone +5 Combat Power. Cooldown drops from 3.0s to 2.5s, base damage jumps from 12 to 14. About 40% more DPS than the stock version.

### Resale interaction

Every refinement adds to your weapon's `pricePaid`, so when you sell, the resale formula recovers a fraction of your refinement spend at your current Workshop rate. At Workshop L10, the recovery is full — refinement spend is not a permanent sunk cost.

### Custom names

Set a custom name on any weapon in your inventory. It shows up in italic below the weapon name everywhere — inventory rows, robot detail page, battle reports. Make your weapon yours.

### New achievements

Five new economy achievements come with this update:
- **First Refinement** (easy) — refine your first weapon
- **Master Craftsman** (medium) — spend ₡1M lifetime on refinement
- **Legendary Smith** (hard) — own a 5-slot Legendary weapon
- **Identity Forged** (hard) — refine a starter weapon to Legendary status
- **Forge Master** (hard) — own a weapon with both Sharpen slots and both Forge slots filled

The weapon you keep can be yours, fully.

---

## Notes for the publish step

- Use `POST /api/changelog/admin` to create the entry (requires admin role).
- After creation, use `POST /api/changelog/admin/:id/publish` to publish.
- Optional: attach a screenshot of the My Inventory tab with a Mastercrafted weapon visible. Asset Checklist A3 in `tasks.md` describes the screenshot.
- Achievement badges (Asset Checklist A1) — 5 SVGs at `app/frontend/public/badges/achievement-e22.svg` through `e26.svg` — can ship after the changelog if needed; the system has a fallback icon path.
- Tier glyph icons (Asset Checklist A2) — currently using simple letter-in-circle SVGs in SlotBar; can be replaced with proper artwork later.
