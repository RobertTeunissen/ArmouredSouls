/**
 * tycoon.v1.json vs `review/STRATEGIES.md` §9 (Approved — 9 Oct 2026); tasks
 * 4.3 and 4.5. Build_Order rows and opening table copied from the document;
 * opening computed with Planet Express Crew's blueprints.
 */
import { PLANET_EXPRESS_OPENING } from './helpers/openingBlueprints';
import { describeApprovedStrategy } from './helpers/strategyFixtureSupport';

describeApprovedStrategy({
  key: 'tycoon',
  displayName: 'Tycoon',
  description: 'Invests in income first. Builds the Merchandising Hub and Streaming Studio before anything else, then grows to two robots and upgrades with the profits.',
  buildOrderTable: `
| 1 | Robots | 1 | 1 |
| 2 | Booking Office | L1 | L0–L6 |
| 3 | Merchandising Hub | L2 | L0–L10 |
| 4 | Streaming Studio | L1 | L0–L10 |
| 5 | Attributes | 6 | 1–10 |
| 6 | Robots | 2 | 1–2 |
| 7 | Booking Office | L3 | L0–L6 |
| 8 | Merchandising Hub | L3 | L0–L10 |
| 9 | Streaming Studio | L3 | L0–L10 |
| 10 | Attributes | 10 | 1–10 |
| 11 | Weapons Workshop | L1 | L0–L10 |
| 12 | Repair Bay | L2 | L0–L10 |
| 13 | Booking Office | L6 | L0–L6 |
| 14 | Merchandising Hub | L6 | L0–L10 |
| 15 | Streaming Studio | L6 | L0–L10 |
| 16 | Training Facility | L3 | L0–L10 |
| 17 | Attributes | 20 | 1–50 |
| 18 | Weapons Workshop | L3 | L0–L10 |
| 19 | Weapons | final stage | stage 0–3 |
| 20 | Robots | 2 | 2–3 |
| 21 | Repair Bay | L6 | L0–L10 |
| 22 | Tuning Bay | L1 | L0–L10 |
| 23 | Training Facility | L6 | L0–L10 |
| 24 | Attributes | 30 | 1–50 |
| 25 | Refine | 10 steps | 0–10 steps |
| 26 | Attributes | Max | Max |
`,
  opening: {
    blueprints: PLANET_EXPRESS_OPENING,
    robotsBought: ['Bender', 'Calculon'],
    facilityLevels: { booking_office: 2, merchandising_hub: 2, streaming_studio: 1, roster_expansion: 1 },
    spendPerGoal: {
      1: 584_000, // Robot chain ×1: robot + War Club
      2: 75_000, // Booking Office L1
      3: 450_000, // Merchandising Hub → L2
      4: 100_000, // Streaming Studio → L1
      5: 844_500, // Attributes → 6 on Bender (₡442,500), then on Calculon when goal 5 re-opens (₡402,000)
      6: 743_000, // Robot chain ×1: Roster Expansion L1 + robot + Beam Pistol
      7: 150_000, // Booking Office L2; then Saving towards L3
    },
    totalSpent: 2_946_500,
    savingOnGoal: 7,
  },
});
