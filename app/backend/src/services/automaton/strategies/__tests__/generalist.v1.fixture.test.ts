/**
 * generalist.v1.json vs `review/STRATEGIES.md` §10 (Approved — 9 Oct 2026);
 * tasks 4.3 and 4.5. Build_Order rows and opening table copied from the
 * document; opening computed with Autobots of the Ark's blueprints.
 */
import { AUTOBOTS_ARK_OPENING } from './helpers/openingBlueprints';
import { describeApprovedStrategy } from './helpers/strategyFixtureSupport';

describeApprovedStrategy({
  key: 'generalist',
  displayName: 'Generalist',
  description: 'A steady all-rounder. Two robots (more if configured), a moderate mix of every facility, even upgrades, and a bit of everything: weapons, refinements, tuning.',
  buildOrderTable: `
| 1 | Weapons Workshop | L1 | L0–L10 |
| 2 | Robots | 1 | 1 |
| 3 | Booking Office | L1 | L0–L6 |
| 4 | Attributes | 6 | 1–10 |
| 5 | Robots | 2 | 1–2 |
| 6 | Booking Office | L3 | L0–L6 |
| 7 | Training Facility | L1 | L0–L10 |
| 8 | Attributes | 10 | 1–10 |
| 9 | Repair Bay | L2 | L0–L10 |
| 10 | Streaming Studio | L2 | L0–L10 |
| 11 | Merchandising Hub | L1 | L0–L10 |
| 12 | Attributes | 15 | 1–50 |
| 13 | Tuning Bay | L1 | L0–L10 |
| 14 | Robots | 2 | 2–4 |
| 15 | Booking Office | L6 | L0–L6 |
| 16 | Weapons Workshop | L5 | L0–L10 |
| 17 | Weapons | final stage | stage 0–3 |
| 18 | Refine | 10 steps | 0–10 steps |
| 19 | Repair Bay | L5 | L0–L10 |
| 20 | Training Facility | L5 | L0–L10 |
| 21 | Streaming Studio | L4 | L0–L10 |
| 22 | Merchandising Hub | L2 | L0–L10 |
| 23 | Attributes | 25 | 1–50 |
| 24 | Tuning Bay | L2 | L0–L10 |
| 25 | Repair Bay | L7 | L0–L10 |
| 26 | Training Facility | L7 | L0–L10 |
| 27 | Attributes | Max | Max |
`,
  opening: {
    blueprints: AUTOBOTS_ARK_OPENING,
    robotsBought: ['Optimus Prime', 'Bumblebee'],
    facilityLevels: { weapons_workshop: 1, booking_office: 3, roster_expansion: 1 },
    spendPerGoal: {
      1: 75_000, // Weapons Workshop L1
      2: 551_300, // Robot chain ×1: robot + Laser Pistol after 10%
      3: 75_000, // Booking Office L1
      4: 1_056_000, // Attributes → 6 on Optimus Prime (₡690,000), then on Bumblebee when goal 4 re-opens (₡366,000)
      5: 752_600, // Robot chain ×1: Roster Expansion L1 + robot + Laser Pistol ×2 after 10%
      6: 375_000, // Booking Office → L3
    },
    totalSpent: 2_884_900,
    savingOnGoal: 7,
  },
});
