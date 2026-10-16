/**
 * swarm.v1.json vs `review/STRATEGIES.md` §5 (Approved — 9 Oct 2026); tasks
 * 4.3 and 4.5. Build_Order rows and opening table copied from the document;
 * opening computed with Kamino Clone Legion's blueprints.
 */
import { CLONE_LEGION_OPENING } from './helpers/openingBlueprints';
import { describeApprovedStrategy } from './helpers/strategyFixtureSupport';

describeApprovedStrategy({
  key: 'swarm',
  displayName: 'Swarm',
  description: 'Goes wide. Buys roster slots, storage and booking capacity to field as many robots as prestige allows, keeps them evenly upgraded, buys their final weapons late, and enters every event it can.',
  buildOrderTable: `
| 1 | Robots | 3 | 1–3 |
| 2 | Booking Office | L1 | L0–L6 |
| 3 | Attributes | 5 | 1–10 |
| 4 | Booking Office | L3 | L0–L6 |
| 5 | Robots | 4 | 3–4 |
| 6 | Attributes | 8 | 1–10 |
| 7 | Repair Bay | L3 | L0–L10 |
| 8 | Streaming Studio | L2 | L0–L10 |
| 9 | Merchandising Hub | L1 | L0–L10 |
| 10 | Robots | 11 | 4–11 |
| 11 | Booking Office | L6 | L0–L6 |
| 12 | Weapons Workshop | L3 | L0–L10 |
| 13 | Tuning Bay | L1 | L0–L10 |
| 14 | Attributes | 15 | 1–50 |
| 15 | Repair Bay | L7 | L0–L10 |
| 16 | Streaming Studio | L5 | L0–L10 |
| 17 | Weapons Workshop | L7 | L0–L10 |
| 18 | Weapons | final stage | stage 0–3 |
| 19 | Tuning Bay | L2 | L0–L10 |
| 20 | Streaming Studio | L8 | L0–L10 |
| 21 | Attributes | 20 | 1–50 |
| 22 | Attributes | 25 | 1–50 |
| 23 | Refine | 8 steps | 0–10 steps |
| 24 | Training Facility | L1 | L0–L10 |
| 25 | Attributes | Max | Max |
`,
  opening: {
    blueprints: CLONE_LEGION_OPENING,
    robotsBought: ['CT-7567 Rex', 'CC-2224 Cody', 'CT-5555 Fives'],
    // Step 1: Roster Expansion L1 + L2; step 2: Booking Office L1.
    facilityLevels: { roster_expansion: 2, booking_office: 1 },
    spendPerGoal: {
      // Season 2 repricing of the starter-stage weapons (was 2,265,000 / 660,000 / 3,000,000).
      1: 2_316_000, // Robot chain ×3: Roster Expansion L1 + L2, 3 robots, starters
      2: 75_000, // Booking Office L1
      3: 607_500, // Attributes towards level 5, with everything that is left
    },
    totalSpent: 2_998_500,
    savingOnGoal: 3,
  },
});
