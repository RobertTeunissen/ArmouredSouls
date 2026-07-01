/**
 * Unit tests for Robot Repair Service.
 */

const mockUserFindUnique = jest.fn();
const mockFacilityFindUnique = jest.fn();
const mockRobotFindMany = jest.fn();
const mockTransaction = jest.fn();

jest.mock('../../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: (...args: unknown[]) => mockUserFindUnique(...args) },
    facility: { findUnique: (...args: unknown[]) => mockFacilityFindUnique(...args) },
    robot: { findMany: (...args: unknown[]) => mockRobotFindMany(...args) },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

jest.mock('../../../src/lib/creditGuard', () => ({
  lockUserForSpending: jest.fn().mockResolvedValue({ id: 1, currency: 5000000 }),
}));

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { repairAllRobots } from '../../../src/services/robot/robotRepairService';
import { RobotError } from '../../../src/errors/robotErrors';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('repairAllRobots', () => {
  it('should repair damaged robots and return summary', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 1, currency: 5000000 });
    mockFacilityFindUnique.mockResolvedValue({ level: 3 });
    mockRobotFindMany.mockResolvedValue([
      {
        id: 1, name: 'Bot1', currentHP: 50, maxHP: 100, currentShield: 0, maxShield: 0,
        combatPower: 5, targetingSystems: 5, criticalSystems: 5, penetration: 5, weaponControl: 5, attackSpeed: 5,
        armorPlating: 5, shieldCapacity: 5, evasionThrusters: 5, damageDampeners: 5, counterProtocols: 5,
        hullIntegrity: 5, servoMotors: 5, gyroStabilizers: 5, hydraulicSystems: 5, powerCore: 5,
        combatAlgorithms: 5, threatAnalysis: 5, adaptiveAI: 5, logicCores: 5,
        syncProtocols: 1, supportSystems: 1, formationTactics: 1,
      },
      {
        id: 2, name: 'Bot2', currentHP: 100, maxHP: 100, currentShield: 0, maxShield: 0,
        combatPower: 5, targetingSystems: 5, criticalSystems: 5, penetration: 5, weaponControl: 5, attackSpeed: 5,
        armorPlating: 5, shieldCapacity: 5, evasionThrusters: 5, damageDampeners: 5, counterProtocols: 5,
        hullIntegrity: 5, servoMotors: 5, gyroStabilizers: 5, hydraulicSystems: 5, powerCore: 5,
        combatAlgorithms: 5, threatAnalysis: 5, adaptiveAI: 5, logicCores: 5,
        syncProtocols: 1, supportSystems: 1, formationTactics: 1,
      },
    ]);
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        user: { update: jest.fn().mockResolvedValue({ currency: 4900000 }) },
        robot: { update: jest.fn().mockResolvedValue({}) },
      };
      return cb(tx);
    });

    const result = await repairAllRobots(1);

    expect(result.repairedCount).toBe(1); // Only Bot1 needs repair
    expect(result.manualRepairDiscount).toBe(50);
    expect(result.finalCost).toBeLessThan(result.totalBaseCost);
    expect(result.finalCost).toBe(Math.floor(result.totalBaseCost * 0.5));
  });

  it('should throw when user not found', async () => {
    mockUserFindUnique.mockResolvedValue(null);

    await expect(repairAllRobots(999)).rejects.toThrow(RobotError);
  });

  it('should throw when no robots need repair', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 1, currency: 5000000 });
    mockFacilityFindUnique.mockResolvedValue({ level: 0 });
    mockRobotFindMany.mockResolvedValue([
      {
        id: 1, name: 'Healthy', currentHP: 100, maxHP: 100, currentShield: 50, maxShield: 50,
        combatPower: 1, targetingSystems: 1, criticalSystems: 1, penetration: 1, weaponControl: 1, attackSpeed: 1,
        armorPlating: 1, shieldCapacity: 1, evasionThrusters: 1, damageDampeners: 1, counterProtocols: 1,
        hullIntegrity: 1, servoMotors: 1, gyroStabilizers: 1, hydraulicSystems: 1, powerCore: 1,
        combatAlgorithms: 1, threatAnalysis: 1, adaptiveAI: 1, logicCores: 1,
        syncProtocols: 1, supportSystems: 1, formationTactics: 1,
      },
    ]);

    await expect(repairAllRobots(1)).rejects.toThrow('No robots need repair');
  });

  it('should apply 50% manual repair discount correctly', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 1, currency: 5000000 });
    mockFacilityFindUnique.mockResolvedValue({ level: 0 }); // no repair bay discount
    mockRobotFindMany.mockResolvedValue([
      {
        id: 1, name: 'Damaged', currentHP: 10, maxHP: 100, currentShield: 0, maxShield: 0,
        combatPower: 10, targetingSystems: 10, criticalSystems: 10, penetration: 10, weaponControl: 10, attackSpeed: 10,
        armorPlating: 10, shieldCapacity: 10, evasionThrusters: 10, damageDampeners: 10, counterProtocols: 10,
        hullIntegrity: 10, servoMotors: 10, gyroStabilizers: 10, hydraulicSystems: 10, powerCore: 10,
        combatAlgorithms: 10, threatAnalysis: 10, adaptiveAI: 10, logicCores: 10,
        syncProtocols: 1, supportSystems: 1, formationTactics: 1,
      },
    ]);
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        user: { update: jest.fn().mockResolvedValue({ currency: 4000000 }) },
        robot: { update: jest.fn().mockResolvedValue({}) },
      };
      return cb(tx);
    });

    const result = await repairAllRobots(1);

    expect(result.finalCost).toBe(Math.floor(result.preDiscountCost * 0.5));
    expect(result.totalBaseCost).toBeGreaterThan(0);
  });
});
