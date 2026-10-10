/**
 * trio.v1.json vs `review/STRATEGIES.md` §8 (Approved — 9 Oct 2026); tasks
 * 4.3 and 4.5. Build_Order rows and opening table copied from the document;
 * opening computed with Decepticon Armada's blueprints.
 */
import { DECEPTICON_ARMADA_OPENING } from './helpers/openingBlueprints';
import { describeApprovedStrategy } from './helpers/strategyFixtureSupport';

describeApprovedStrategy({
  key: 'trio',
  displayName: 'Trio',
  description: 'A three-robot formation built for 3v3. Forms a 3v3 team and a 2v2 team from the same robots, plays 3v3 League and the 3v3 Tournament first, and invests in the Repair Bay early.',
  buildOrderTable: `
| 1 | Robots | 3 | 1–3 |
| 2 | Booking Office | L1 | L0–L6 |
| 3 | Attributes | 5 | 1–10 |
| 4 | Booking Office | L3 | L0–L6 |
| 5 | Repair Bay | L1 | L0–L10 |
| 6 | Attributes | 8 | 1–10 |
| 7 | Weapons Workshop | L1 | L0–L10 |
| 8 | Merchandising Hub | L1 | L0–L10 |
| 9 | Streaming Studio | L1 | L0–L10 |
| 10 | Training Facility | L3 | L0–L10 |
| 11 | Attributes | 15 | 1–50 |
| 12 | Robots | 3 | 3–6 |
| 13 | Repair Bay | L3 | L0–L10 |
| 14 | Booking Office | L6 | L0–L6 |
| 15 | Weapons Workshop | L3 | L0–L10 |
| 16 | Streaming Studio | L3 | L0–L10 |
| 17 | Training Facility | L6 | L0–L10 |
| 18 | Attributes | 20 | 1–50 |
| 19 | Repair Bay | L6 | L0–L10 |
| 20 | Weapons Workshop | L6 | L0–L10 |
| 21 | Weapons | final stage | stage 0–3 |
| 22 | Refine | 10 steps | 0–10 steps |
| 23 | Tuning Bay | L2 | L0–L10 |
| 24 | Repair Bay | L8 | L0–L10 |
| 25 | Training Facility | L9 | L0–L10 |
| 26 | Streaming Studio | L6 | L0–L10 |
| 27 | Attributes | 30 | 1–50 |
| 28 | Attributes | Max | Max |
`,
  opening: {
    blueprints: DECEPTICON_ARMADA_OPENING,
    robotsBought: ['Megatron', 'Starscream', 'Soundwave'],
    facilityLevels: { roster_expansion: 2, booking_office: 1 },
    spendPerGoal: {
      1: 2_320_000, // Robot chain ×3: Roster Expansion L1 + L2, 3 robots, starters
      2: 75_000, // Booking Office L1
      3: 605_000, // Attributes → 5 on all three, with everything that is left
    },
    totalSpent: 3_000_000,
    savingOnGoal: 3,
  },
});
