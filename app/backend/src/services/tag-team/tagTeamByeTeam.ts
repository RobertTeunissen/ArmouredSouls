import { Prisma } from '../../../generated/prisma';
import { RobotWithWeapons } from '../battle/combatSimulator';
import { TagTeamWithRobots } from './tagTeamTypes';

/**
 * Create a bye-team for battle execution
 * Requirements 2.5, 12.1, 12.2: Bye-team with combined ELO 2000
 */
export function createByeTeamForBattle(): TagTeamWithRobots {
  // Create bye robots with ELO 1000 each (combined 2000)
  const byeRobot1: RobotWithWeapons = {
    id: -1,
    userId: -1,
    name: 'Bye Robot 1',
    frameId: 1,
    paintJob: null,
    imageUrl: null,
    // Combat Systems - minimal stats
    combatPower: new Prisma.Decimal(10),
    targetingSystems: new Prisma.Decimal(10),
    criticalSystems: new Prisma.Decimal(10),
    penetration: new Prisma.Decimal(10),
    weaponControl: new Prisma.Decimal(10),
    attackSpeed: new Prisma.Decimal(10),
    // Defensive Systems
    armorPlating: new Prisma.Decimal(10),
    shieldCapacity: new Prisma.Decimal(10),
    evasionThrusters: new Prisma.Decimal(10),
    damageDampeners: new Prisma.Decimal(10),
    counterProtocols: new Prisma.Decimal(10),
    // Chassis & Mobility
    hullIntegrity: new Prisma.Decimal(10),
    servoMotors: new Prisma.Decimal(10),
    gyroStabilizers: new Prisma.Decimal(10),
    hydraulicSystems: new Prisma.Decimal(10),
    powerCore: new Prisma.Decimal(10),
    // AI Processing
    combatAlgorithms: new Prisma.Decimal(10),
    threatAnalysis: new Prisma.Decimal(10),
    adaptiveAI: new Prisma.Decimal(10),
    logicCores: new Prisma.Decimal(10),
    // Team Coordination
    syncProtocols: new Prisma.Decimal(10),
    supportSystems: new Prisma.Decimal(10),
    formationTactics: new Prisma.Decimal(10),
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
    // Economic
    repairCost: 0,
    battleReadiness: 100,
    totalRepairsPaid: 0,
    // Configuration
    yieldThreshold: 10,
    loadoutType: 'single',
    stance: 'balanced',
    // Stance/Loadout Win Counters
    offensiveWins: 0,
    defensiveWins: 0,
    balancedWins: 0,
    dualWieldWins: 0,
    // Grand Melee
    grandMeleeWins: 0,
    grandMeleeTop3: 0,
    // Equipment
    mainWeaponId: null,
    offhandWeaponId: null,
    mainWeapon: null,
    offhandWeapon: null,
    // Timestamps
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const byeRobot2: RobotWithWeapons = { 
    ...byeRobot1, 
    id: -2, 
    name: 'Bye Robot 2' 
  };

  const byeTeam: TagTeamWithRobots = {
    id: -1,
    stableId: -1,
    teamName: 'Bye Team',
    teamSize: 2,
    activeRobotId: -1,
    reserveRobotId: -2,
    createdAt: new Date(),
    updatedAt: new Date(),
    activeRobot: byeRobot1,
    reserveRobot: byeRobot2,
  };

  return byeTeam;
}
