/**
 * Unified bye-robot factory.
 *
 * Bye robots are minimal placeholder objects used when an odd number of
 * participants requires a walkover. They are never persisted to the database
 * — their negative IDs serve as a sentinel that orchestrators use to detect
 * bye matches and skip full simulation / stat updates.
 *
 * One factory, used by every mode: 1v1 matchmaking, 2v2/3v3 team battles,
 * and tag team. No cast required — the returned shape satisfies
 * RobotWithWeapons (and therefore Robot) against the live schema.
 */

import { Prisma } from '../../../generated/prisma';
import { RobotWithWeapons } from './combat-simulator/combatTypes';

const DECIMAL_10 = new Prisma.Decimal(10);

/**
 * Create a single bye robot with all attributes at 10, ELO 1000, no weapons.
 *
 * @param id Negative integer (e.g. -1, -2). Sign is the bye-detection signal
 *           used by `processByeBattle` and participant filters (`robotId > 0`).
 */
export function createByeRobot(id: number): RobotWithWeapons {
  return {
    id,
    userId: -1,
    name: `Bye Robot ${Math.abs(id)}`,
    frameId: 1,
    paintJob: null,
    imageUrl: null,
    // Combat Systems
    combatPower: DECIMAL_10,
    targetingSystems: DECIMAL_10,
    criticalSystems: DECIMAL_10,
    penetration: DECIMAL_10,
    weaponControl: DECIMAL_10,
    attackSpeed: DECIMAL_10,
    // Defensive Systems
    armorPlating: DECIMAL_10,
    shieldCapacity: DECIMAL_10,
    evasionThrusters: DECIMAL_10,
    damageDampeners: DECIMAL_10,
    counterProtocols: DECIMAL_10,
    // Chassis & Mobility
    hullIntegrity: DECIMAL_10,
    servoMotors: DECIMAL_10,
    gyroStabilizers: DECIMAL_10,
    hydraulicSystems: DECIMAL_10,
    powerCore: DECIMAL_10,
    // AI Processing
    combatAlgorithms: DECIMAL_10,
    threatAnalysis: DECIMAL_10,
    adaptiveAI: DECIMAL_10,
    logicCores: DECIMAL_10,
    // Team Coordination
    syncProtocols: DECIMAL_10,
    supportSystems: DECIMAL_10,
    formationTactics: DECIMAL_10,
    // Combat State
    currentHP: 100,
    maxHP: 100,
    currentShield: 20,
    maxShield: 20,
    damageTaken: 0,
    // Performance
    elo: 1000,
    totalBattles: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    damageDealtLifetime: 0,
    damageTakenLifetime: 0,
    kills: 0,
    // Fame
    fame: 0,
    titles: null,
    // Stance/Loadout Win Counters
    offensiveWins: 0,
    defensiveWins: 0,
    balancedWins: 0,
    dualWieldWins: 0,
    // Grand Melee
    grandMeleeWins: 0,
    grandMeleeTop3: 0,
    // Economic
    repairQuoteCredits: 0,
    battleReadiness: 100,
    lifetimeRepairCreditsPaid: 0,
    // Configuration
    yieldThreshold: 10,
    loadoutType: 'single',
    stance: 'balanced',
    // Equipment
    mainWeaponId: null,
    offhandWeaponId: null,
    mainWeapon: null,
    offhandWeapon: null,
    // Timestamps
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
