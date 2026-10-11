/**
 * paragon.v1.json vs `review/STRATEGIES.md` §6 (Approved — 9 Oct 2026); tasks
 * 4.3 and 4.5. Build_Order rows and opening table copied from the document;
 * opening computed with Old Detroit Precinct's blueprint (RoboCop).
 */
import { ROBOCOP_PRECINCT_OPENING } from './helpers/openingBlueprints';
import { describeApprovedStrategy } from './helpers/strategyFixtureSupport';

describeApprovedStrategy({
  key: 'paragon',
  displayName: 'Paragon',
  description: 'Goes tall. One robot, built as far as the facilities allow: Training Facility discounts, matching academies, a premium weapon refined to the limit, a Tuning Bay and a Merchandising Hub that rewards a one-robot roster.',
  buildOrderTable: `
| 1 | Weapons Workshop | L1 | L0–L10 |
| 2 | Robots | 1 | 1 |
| 3 | Booking Office | L1 | L0–L6 |
| 4 | Training Facility | L1 | L0–L10 |
| 5 | Attributes | 10 | 1–10 |
| 6 | Training Facility | L3 | L0–L10 |
| 7 | Attributes | 15 | 1–50 |
| 8 | Robots | 1 | 1–2 |
| 9 | Merchandising Hub | L3 | L0–L10 |
| 10 | Streaming Studio | L2 | L0–L10 |
| 11 | Repair Bay | L3 | L0–L10 |
| 12 | Training Facility | L5 | L0–L10 |
| 13 | Attributes | 25 | 1–50 |
| 14 | Weapons Workshop | L5 | L0–L10 |
| 15 | Weapons | final stage | stage 0–3 |
| 16 | Refine | 10 steps | 0–10 steps |
| 17 | Tuning Bay | L3 | L0–L10 |
| 18 | Training Facility | L10 | L0–L10 |
| 19 | Merchandising Hub | L6 | L0–L10 |
| 20 | Repair Bay | L7 | L0–L10 |
| 21 | Streaming Studio | L4 | L0–L10 |
| 22 | Attributes | 40 | 1–50 |
| 23 | Tuning Bay | L5 | L0–L10 |
| 24 | Attributes | Max | Max |
`,
  opening: {
    blueprints: ROBOCOP_PRECINCT_OPENING,
    robotsBought: ['RoboCop'],
    // Steps 1, 3, 4, 6 and the Combat Academy L1 bought by step 7.
    facilityLevels: { weapons_workshop: 1, booking_office: 1, training_facility: 3, combat_training_academy: 1 },
    spendPerGoal: {
      1: 75_000, // Weapons Workshop L1
      2: 762_000, // Robot chain ×1: robot + premium starter weapon after discount
      3: 75_000, // Booking Office L1
      4: 150_000, // Training Facility L1
      5: 934_000, // Attributes → 10 less 9%
      6: 750_000, // Training Facility → L3
      7: 254_000, // Attributes → 15: Combat Academy L1, with everything that is left
    },
    totalSpent: 3_000_000,
    savingOnGoal: 7,
  },
});
