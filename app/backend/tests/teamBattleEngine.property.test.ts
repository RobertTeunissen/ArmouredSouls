/**
 * Property-Based Tests for Team Battle Engine (Pure Computation)
 *
 * Tests core invariants of the team battle simulation engine using fast-check.
 * These tests exercise `simulateTeamBattle` directly with generated robot data —
 * no database interaction required.
 *
 * @module tests/teamBattleEngine.property.test
 */

import * as fc from 'fast-check';
import { Prisma } from '../generated/prisma';
import { simulateTeamBattle } from '../src/services/team-battle/teamBattleEngine';
import { RobotWithWeapons } from '../src/services/battle/combatSimulator';

// ── Mock Factories ──────────────────────────────────────────────────

/**
 * Create a weapon inventory object suitable for combat simulation.
 */
function createWeaponInventory(weaponId: number, baseDamage: number, rangeBand: string = 'short') {
  return {
    id: weaponId,
    userId: 1,
    weaponId,
    customName: null,
    pricePaid: 0,
    purchasedAt: new Date('2025-01-01'),
    weapon: {
      id: weaponId,
      name: `TestWeapon-${weaponId}`,
      weaponType: rangeBand === 'melee' ? 'melee' : 'energy',
      baseDamage,
      cooldown: 2.0,
      cost: 50000,
      handsRequired: 'one' as const,
      damageType: rangeBand === 'melee' ? 'melee' : 'energy',
      loadoutType: 'any',
      rangeBand,
      specialProperty: null,
      description: null,
      combatPowerBonus: 0,
      targetingSystemsBonus: 0,
      criticalSystemsBonus: 0,
      penetrationBonus: 0,
      weaponControlBonus: 0,
      attackSpeedBonus: 0,
      armorPlatingBonus: 0,
      shieldCapacityBonus: 0,
      evasionThrustersBonus: 0,
      damageDampenersBonus: 0,
      counterProtocolsBonus: 0,
      hullIntegrityBonus: 0,
      servoMotorsBonus: 0,
      gyroStabilizersBonus: 0,
      hydraulicSystemsBonus: 0,
      powerCoreBonus: 0,
      combatAlgorithmsBonus: 0,
      threatAnalysisBonus: 0,
      adaptiveAIBonus: 0,
      logicCoresBonus: 0,
      syncProtocolsBonus: 0,
      supportSystemsBonus: 0,
      formationTacticsBonus: 0,
      createdAt: new Date('2025-01-01'),
    },
  };
}

/**
 * Create a mock RobotWithWeapons with the given overrides.
 * Uses `as unknown as RobotWithWeapons` cast since the Robot model has many
 * counter fields that are irrelevant to combat simulation.
 */
function createMockRobot(overrides: Partial<RobotWithWeapons> & { id: number; name: string }): RobotWithWeapons {
  return {
    userId: 1,
    frameId: 1,
    paintJob: null,
    combatPower: new Prisma.Decimal(20),
    targetingSystems: new Prisma.Decimal(20),
    criticalSystems: new Prisma.Decimal(10),
    penetration: new Prisma.Decimal(10),
    weaponControl: new Prisma.Decimal(15),
    attackSpeed: new Prisma.Decimal(15),
    armorPlating: new Prisma.Decimal(15),
    shieldCapacity: new Prisma.Decimal(10),
    evasionThrusters: new Prisma.Decimal(8),
    damageDampeners: new Prisma.Decimal(8),
    counterProtocols: new Prisma.Decimal(8),
    hullIntegrity: new Prisma.Decimal(20),
    servoMotors: new Prisma.Decimal(15),
    gyroStabilizers: new Prisma.Decimal(10),
    hydraulicSystems: new Prisma.Decimal(10),
    powerCore: new Prisma.Decimal(10),
    combatAlgorithms: new Prisma.Decimal(15),
    threatAnalysis: new Prisma.Decimal(10),
    adaptiveAI: new Prisma.Decimal(8),
    logicCores: new Prisma.Decimal(10),
    syncProtocols: new Prisma.Decimal(5),
    supportSystems: new Prisma.Decimal(5),
    formationTactics: new Prisma.Decimal(5),
    currentHP: 150,
    maxHP: 150,
    currentShield: 20,
    maxShield: 20,
    damageTaken: 0,
    elo: 1200,
    totalBattles: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    damageDealtLifetime: 0,
    damageTakenLifetime: 0,
    kills: 0,
    currentLeague: 'bronze',
    leagueId: 'bronze_1',
    leaguePoints: 0,
    fame: 0,
    titles: null,
    repairCost: 0,
    battleReadiness: 100,
    totalRepairsPaid: 0,
    yieldThreshold: 10,
    loadoutType: 'single',
    stance: 'balanced',
    mainWeaponId: null,
    offhandWeaponId: null,
    imageUrl: null,
    cyclesInCurrentLeague: 0,
    totalTagTeamBattles: 0,
    totalTagTeamWins: 0,
    totalTagTeamLosses: 0,
    totalTagTeamDraws: 0,
    timesTaggedIn: 0,
    timesTaggedOut: 0,
    totalLeague1v1Wins: 0,
    totalLeague1v1Losses: 0,
    totalLeague1v1Draws: 0,
    totalLeague2v2Wins: 0,
    totalLeague3v3Wins: 0,
    kothWins: 0,
    kothMatches: 0,
    kothTotalZoneScore: 0,
    kothTotalZoneTime: 0,
    kothKills: 0,
    kothBestPlacement: null,
    kothCurrentWinStreak: 0,
    kothBestWinStreak: 0,
    currentWinStreak: 0,
    bestWinStreak: 0,
    currentLoseStreak: 0,
    offensiveWins: 0,
    defensiveWins: 0,
    balancedWins: 0,
    dualWieldWins: 0,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    mainWeapon: null,
    offhandWeapon: null,
    ...overrides,
  } as unknown as RobotWithWeapons;
}

// ── Arbitraries ─────────────────────────────────────────────────────

/** Generate a Prisma Decimal attribute value in the valid range [1, 50]. */
const attributeArb = fc.integer({ min: 1, max: 50 }).map(v => new Prisma.Decimal(v));

/** Generate weapon base damage in a reasonable range. */
const weaponDamageArb = fc.integer({ min: 8, max: 35 });

/** Generate weapon range band. */
const rangeBandArb = fc.constantFrom('melee', 'short', 'mid', 'long');

/** Counter for generating unique robot IDs across test runs. */
let robotIdCounter = 0;

/** Generate a valid RobotWithWeapons with at least one weapon. */
function robotWithWeaponsArb(idOffset: number): fc.Arbitrary<RobotWithWeapons> {
  return fc.record({
    combatPower: attributeArb,
    targetingSystems: attributeArb,
    criticalSystems: attributeArb,
    penetration: attributeArb,
    weaponControl: attributeArb,
    attackSpeed: attributeArb,
    armorPlating: attributeArb,
    shieldCapacity: attributeArb,
    evasionThrusters: attributeArb,
    damageDampeners: attributeArb,
    counterProtocols: attributeArb,
    hullIntegrity: attributeArb,
    servoMotors: attributeArb,
    gyroStabilizers: attributeArb,
    hydraulicSystems: attributeArb,
    powerCore: attributeArb,
    combatAlgorithms: attributeArb,
    threatAnalysis: attributeArb,
    adaptiveAI: attributeArb,
    logicCores: attributeArb,
    syncProtocols: attributeArb,
    supportSystems: attributeArb,
    formationTactics: attributeArb,
    weaponDamage: weaponDamageArb,
    rangeBand: rangeBandArb,
    yieldThreshold: fc.integer({ min: 0, max: 50 }),
  }).map((attrs) => {
    robotIdCounter++;
    const robotId = idOffset + robotIdCounter;
    const hullValue = Number(attrs.hullIntegrity);
    const shieldValue = Number(attrs.shieldCapacity);
    const hp = hullValue * 10;
    const shield = shieldValue * 2;
    const weaponId = robotId * 100;

    return createMockRobot({
      id: robotId,
      name: `PBT-Robot-${robotId}-${robotIdCounter}`,
      combatPower: attrs.combatPower,
      targetingSystems: attrs.targetingSystems,
      criticalSystems: attrs.criticalSystems,
      penetration: attrs.penetration,
      weaponControl: attrs.weaponControl,
      attackSpeed: attrs.attackSpeed,
      armorPlating: attrs.armorPlating,
      shieldCapacity: attrs.shieldCapacity,
      evasionThrusters: attrs.evasionThrusters,
      damageDampeners: attrs.damageDampeners,
      counterProtocols: attrs.counterProtocols,
      hullIntegrity: attrs.hullIntegrity,
      servoMotors: attrs.servoMotors,
      gyroStabilizers: attrs.gyroStabilizers,
      hydraulicSystems: attrs.hydraulicSystems,
      powerCore: attrs.powerCore,
      combatAlgorithms: attrs.combatAlgorithms,
      threatAnalysis: attrs.threatAnalysis,
      adaptiveAI: attrs.adaptiveAI,
      logicCores: attrs.logicCores,
      syncProtocols: attrs.syncProtocols,
      supportSystems: attrs.supportSystems,
      formationTactics: attrs.formationTactics,
      currentHP: hp,
      maxHP: hp,
      currentShield: shield,
      maxShield: shield,
      yieldThreshold: attrs.yieldThreshold,
      mainWeapon: createWeaponInventory(weaponId, attrs.weaponDamage, attrs.rangeBand) as unknown as RobotWithWeapons['mainWeapon'],
      mainWeaponId: weaponId,
    });
  });
}

/** Generate a team of N robots with unique IDs. */
function teamArb(teamSize: 2 | 3, teamIndex: 1 | 2): fc.Arbitrary<RobotWithWeapons[]> {
  // Offset IDs to avoid collisions between teams
  const baseOffset = teamIndex === 1 ? 0 : teamSize * 1000;
  if (teamSize === 2) {
    return fc.tuple(
      robotWithWeaponsArb(baseOffset),
      robotWithWeaponsArb(baseOffset + 100),
    ).map(([r1, r2]) => [r1, r2]);
  }
  return fc.tuple(
    robotWithWeaponsArb(baseOffset),
    robotWithWeaponsArb(baseOffset + 100),
    robotWithWeaponsArb(baseOffset + 200),
  ).map(([r1, r2, r3]) => [r1, r2, r3]);
}

// ── Property Tests ──────────────────────────────────────────────────

describe('Team Battle Engine Property Tests', () => {
  /**
   * Property 5: Winner Survival Invariant
   *
   * **Validates: Requirements R13.5, R5.5**
   *
   * Property: When a team battle has a winner (winningSide !== null),
   * the winning team must have at least one member with finalHP > 0.
   * A team cannot "win" if all its members are eliminated.
   */
  describe('Property 5: Winner Survival Invariant', () => {
    it('winning team has at least one member with finalHP > 0 (2v2)', () => {
      fc.assert(
        fc.property(
          teamArb(2, 1),
          teamArb(2, 2),
          (team1, team2) => {
            const result = simulateTeamBattle(team1, team2, 2);

            // Only check the invariant when there IS a winner (not a draw)
            if (result.winningSide === null) {
              return true; // Draws are allowed — skip invariant check
            }

            // The winning team must have at least one survivor with finalHP > 0
            const winningTeamParticipants = result.participants.filter(
              p => p.team === result.winningSide,
            );

            const hasLivingSurvivor = winningTeamParticipants.some(p => p.finalHP > 0);

            return hasLivingSurvivor;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('winning team has at least one member with finalHP > 0 (3v3)', () => {
      fc.assert(
        fc.property(
          teamArb(3, 1),
          teamArb(3, 2),
          (team1, team2) => {
            const result = simulateTeamBattle(team1, team2, 3);

            // Only check the invariant when there IS a winner (not a draw)
            if (result.winningSide === null) {
              return true; // Draws are allowed — skip invariant check
            }

            // The winning team must have at least one survivor with finalHP > 0
            const winningTeamParticipants = result.participants.filter(
              p => p.team === result.winningSide,
            );

            const hasLivingSurvivor = winningTeamParticipants.some(p => p.finalHP > 0);

            return hasLivingSurvivor;
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
