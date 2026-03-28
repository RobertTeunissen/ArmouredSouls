/**
 * Unit tests for computeSeedings() with known tournament configurations.
 * Feature: tournament-bracket-seeding, Task 10.2
 *
 * Tests exact seed assignments for:
 * - A known 8-robot tournament (full bracket, no byes)
 * - A 5-robot tournament in an 8-slot bracket (with bye matches)
 */

import {
  seedRobotsByELO,
  generateStandardSeedOrder,
  computeSeedings,
  Round1Match,
  CompletedMatch,
} from '../src/services/tournamentService';
import type { Robot } from '../generated/prisma';

function makeRobot(id: number, name: string, elo: number): Robot {
  return { id, name, elo } as Robot;
}

describe('computeSeedings — known 8-robot tournament', () => {
  // 8 robots with distinct ELOs, sorted descending
  const robots: Robot[] = [
    makeRobot(1, 'Alpha', 2000),
    makeRobot(2, 'Bravo', 1800),
    makeRobot(3, 'Charlie', 1600),
    makeRobot(4, 'Delta', 1400),
    makeRobot(5, 'Echo', 1200),
    makeRobot(6, 'Foxtrot', 1000),
    makeRobot(7, 'Golf', 800),
    makeRobot(8, 'Hotel', 600),
  ];

  const bracketSize = 8;
  const seeded = seedRobotsByELO(robots);
  const seedOrder = generateStandardSeedOrder(bracketSize);

  // Place robots into bracket slots
  const bracketSlots: (Robot | null)[] = new Array(bracketSize).fill(null);
  for (let i = 0; i < seeded.length; i++) {
    bracketSlots[seedOrder[i] - 1] = seeded[i];
  }

  // Build round-1 matches from consecutive pairs
  const round1Matches: Round1Match[] = [];
  let matchNum = 1;
  for (let i = 0; i < bracketSize; i += 2) {
    const r1 = bracketSlots[i];
    const r2 = bracketSlots[i + 1];
    round1Matches.push({
      matchNumber: matchNum++,
      robot1Id: r1?.id ?? null,
      robot2Id: r2?.id ?? null,
      robot1: r1 ? { id: r1.id, name: r1.name, elo: r1.elo } : null,
      robot2: r2 ? { id: r2.id, name: r2.name, elo: r2.elo } : null,
    });
  }

  it('should assign exactly 8 seedings', () => {
    const seedings = computeSeedings(round1Matches, bracketSize, []);
    expect(seedings.length).toBe(8);
  });

  it('should assign seed 1 to the highest ELO robot', () => {
    const seedings = computeSeedings(round1Matches, bracketSize, []);
    expect(seedings[0].seed).toBe(1);
    expect(seedings[0].robotName).toBe('Alpha');
    expect(seedings[0].elo).toBe(2000);
  });

  it('should assign seed 8 to the lowest ELO robot', () => {
    const seedings = computeSeedings(round1Matches, bracketSize, []);
    expect(seedings[7].seed).toBe(8);
    expect(seedings[7].robotName).toBe('Hotel');
    expect(seedings[7].elo).toBe(600);
  });

  it('should have strictly descending ELO across seeds 1-8', () => {
    const seedings = computeSeedings(round1Matches, bracketSize, []);
    for (let i = 0; i < seedings.length - 1; i++) {
      expect(seedings[i].elo).toBeGreaterThan(seedings[i + 1].elo);
    }
  });

  it('should mark no robots as eliminated when no completed matches', () => {
    const seedings = computeSeedings(round1Matches, bracketSize, []);
    for (const entry of seedings) {
      expect(entry.eliminated).toBe(false);
    }
  });

  it('should mark losers as eliminated when completed matches are provided', () => {
    // Alpha (id=1) beats Hotel (id=8) in match 1
    const completedMatches: CompletedMatch[] = [
      { robot1Id: 1, robot2Id: 8, winnerId: 1, status: 'completed' },
    ];
    const seedings = computeSeedings(round1Matches, bracketSize, completedMatches);

    const hotel = seedings.find((s) => s.robotId === 8);
    expect(hotel).toBeDefined();
    expect(hotel!.eliminated).toBe(true);

    const alpha = seedings.find((s) => s.robotId === 1);
    expect(alpha).toBeDefined();
    expect(alpha!.eliminated).toBe(false);
  });
});

describe('computeSeedings — 5 robots in 8-slot bracket (bye matches)', () => {
  const robots: Robot[] = [
    makeRobot(10, 'Ace', 2500),
    makeRobot(20, 'Baron', 2200),
    makeRobot(30, 'Count', 1900),
    makeRobot(40, 'Duke', 1600),
    makeRobot(50, 'Earl', 1300),
  ];

  const bracketSize = 8;
  const seeded = seedRobotsByELO(robots);
  const seedOrder = generateStandardSeedOrder(bracketSize);

  const bracketSlots: (Robot | null)[] = new Array(bracketSize).fill(null);
  for (let i = 0; i < seeded.length; i++) {
    bracketSlots[seedOrder[i] - 1] = seeded[i];
  }

  // Build round-1 matches, normalizing byes (actual robot in robot1)
  const round1Matches: Round1Match[] = [];
  let matchNum = 1;
  for (let i = 0; i < bracketSize; i += 2) {
    let r1 = bracketSlots[i];
    let r2 = bracketSlots[i + 1];

    if (r1 === null && r2 !== null) {
      r1 = r2;
      r2 = null;
    }
    if (r1 === null && r2 === null) continue;

    round1Matches.push({
      matchNumber: matchNum++,
      robot1Id: r1?.id ?? null,
      robot2Id: r2?.id ?? null,
      robot1: r1 ? { id: r1.id, name: r1.name, elo: r1.elo } : null,
      robot2: r2 ? { id: r2.id, name: r2.name, elo: r2.elo } : null,
    });
  }

  it('should assign exactly 5 seedings (one per robot)', () => {
    const seedings = computeSeedings(round1Matches, bracketSize, []);
    expect(seedings.length).toBe(5);
  });

  it('should assign seed 1 to the highest ELO robot', () => {
    const seedings = computeSeedings(round1Matches, bracketSize, []);
    expect(seedings[0].seed).toBe(1);
    expect(seedings[0].robotName).toBe('Ace');
  });

  it('should have strictly descending ELO across all seeds', () => {
    const seedings = computeSeedings(round1Matches, bracketSize, []);
    for (let i = 0; i < seedings.length - 1; i++) {
      expect(seedings[i].elo).toBeGreaterThan(seedings[i + 1].elo);
    }
  });

  it('should have 3 bye matches (8 slots - 5 robots = 3 byes)', () => {
    const byeCount = round1Matches.filter(
      (m) => m.robot1 !== null && m.robot2 === null
    ).length;
    expect(byeCount).toBe(3);
  });

  it('should assign seeds 1-5 with no gaps', () => {
    const seedings = computeSeedings(round1Matches, bracketSize, []);
    const seeds = seedings.map((s) => s.seed);
    expect(seeds).toEqual([1, 2, 3, 4, 5]);
  });
});
