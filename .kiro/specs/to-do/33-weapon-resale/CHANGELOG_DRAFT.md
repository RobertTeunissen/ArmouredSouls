# Changelog Entry Draft (Spec #33)

This is the player-facing changelog entry for the Weapon Resale feature. Paste into the admin changelog UI (`/admin/changelog/new`) to create and publish.

---

**Title**: Sell weapons back to the workshop

**Category**: Feature

**Body**:

You can now sell weapons back from your inventory! Visit the Weapon Shop and switch to the new **My Inventory** tab to see all your weapons, including a clear summary of how much credit you'd recover at your current Workshop level.

**How resale works:**

The amount you get back scales linearly with your Weapons Workshop level — same 10%-per-level slope as the existing purchase discount. *Workshop level rewards you 10% on both ends of every transaction.*

| Workshop Level | Resale Rate | Example: ₡100K weapon |
|---------------|-------------|------------------------|
| 0 | 0% | ₡0 — Build Workshop L1 to enable resale |
| 1 | 10% | ₡10K |
| 3 | 30% | ₡30K |
| 5 | 50% | ₡50K |
| 7 | 70% | ₡70K |
| 10 | 100% | ₡100K — full credit recovery |

**Important details:**

- Resale value is based on what **you actually paid** for the weapon, not the catalog price. So a weapon you got at a Workshop discount yields proportionally less on resale (and a starter weapon, which cost you nothing, yields ₡0).
- **Equipped weapons cannot be sold.** Unequip from your robot first using the Robot Detail page.
- Once sold, the action cannot be undone — confirm carefully!

**4 new achievements** reward selling activity:

- 🟢 **Pawn Star** (Easy) — Sell your first weapon
- 🔵 **Shrewd Negotiator** (Medium) — Earn ₡500,000 lifetime from weapon resales
- 🟠 **Arms Dealer** (Hard) — Sell 10 weapons
- 🟠 **Buy High, Sell Higher** (Hard) — Sell a weapon at Workshop Level 10

Happy trading!

---

**Image**: Optional — attach a screenshot of the My Inventory tab showing the Available + Equipped sections and the summary bar.

**Source**: `manual` (curator-written, not auto-generated from a deploy).
