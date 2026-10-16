/**
 * duo.v1.json vs `review/STRATEGIES.md` §7 (Approved — 9 Oct 2026); tasks
 * 4.3 and 4.5. Build_Order rows and opening table copied from the document;
 * opening computed with Pan Pacific Defense Corps' blueprints.
 */
import { JAEGER_CORPS_OPENING } from './helpers/openingBlueprints';
import { describeApprovedStrategy } from './helpers/strategyFixtureSupport';

describeApprovedStrategy({
  key: 'duo',
  displayName: 'Duo',
  description: 'A two-robot team stable. Forms a 2v2 team at once and plays 2v2 League, Tag Team and the 2v2 Tournament first, with solo events as filler.',
  buildOrderTable: `
| 1 | Weapons Workshop | L1 | L0–L10 |
| 2 | Robots | 2 | 1–2 |
| 3 | Booking Office | L1 | L0–L6 |
| 4 | Attributes | 6 | 1–10 |
| 5 | Booking Office | L3 | L0–L6 |
| 6 | Training Facility | L1 | L0–L10 |
| 7 | Attributes | 10 | 1–10 |
| 8 | Repair Bay | L2 | L0–L10 |
| 9 | Merchandising Hub | L1 | L0–L10 |
| 10 | Streaming Studio | L2 | L0–L10 |
| 11 | Booking Office | L4 | L0–L6 |
| 12 | Training Facility | L4 | L0–L10 |
| 13 | Robots | 2 | 2–3 |
| 14 | Attributes | 20 | 1–50 |
| 15 | Weapons Workshop | L3 | L0–L10 |
| 16 | Weapons | final stage | stage 0–3 |
| 17 | Refine | 10 steps | 0–10 steps |
| 18 | Tuning Bay | L2 | L0–L10 |
| 19 | Repair Bay | L7 | L0–L10 |
| 20 | Training Facility | L8 | L0–L10 |
| 21 | Streaming Studio | L5 | L0–L10 |
| 22 | Attributes | 30 | 1–50 |
| 23 | Attributes | Max | Max |
`,
  opening: {
    blueprints: JAEGER_CORPS_OPENING,
    robotsBought: ['Gipsy Danger', 'Striker Eureka'],
    facilityLevels: { weapons_workshop: 1, roster_expansion: 1, booking_office: 3, training_facility: 1 },
    spendPerGoal: {
      1: 75_000, // Weapons Workshop L1
      // Season 2 repricing: Shock Maul ₡211,000 + Burst Rifle ₡150,000 at 5% off (was 1,420,000).
      2: 1_492_950, // Robot chain ×2: Roster Expansion L1, 2 robots, starters after discount
      3: 75_000, // Booking Office L1
      4: 808_500, // Attributes → 6 on both robots (₡442,500 + ₡366,000)
      5: 375_000, // Booking Office → L3
      6: 150_000, // Training Facility L1
      7: 19_320, // Attributes towards 10 with everything that is left (was 96,500)
    },
    totalSpent: 2_995_770,
    savingOnGoal: 7,
  },
});
