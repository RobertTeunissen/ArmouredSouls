import { 
  calculateEffectiveStats, 
  calculateMaxHP, 
  calculateMaxShield,
  getLoadoutBonus,
  getLoadoutModifiedAttributes,
  LOADOUT_BONUSES 
} from '../src/utils/robotCalculations';
import { Robot, WeaponInventory, Weapon } from '@prisma/client';

// Mock robot data
const createMockRobot = (overrides?: Partial<Robot>): Robot => ({
  id: 1,
  userId: 1,
  name: 'TestBot',
  frameId: 1,
  paintJob: null,
  combatPower: new Prisma.Decimal(10),
  targetingSystems: new Prisma.Decimal(10),
  criticalSystems: new Prisma.Decimal(10),
  penetration: new Prisma.Decimal(10),
  weaponControl: new Prisma.Decimal(10),
  attackSpeed: new Prisma.Decimal(10),
  armorPlating: new Prisma.Decimal(10),
  shieldCapacity: new Prisma.Decimal(10),
  evasionThrusters: new Prisma.Decimal(10),
  damageDampeners: new Prisma.Decimal(10),
  counterProtocols: new Prisma.Decimal(10),
  hullIntegrity: new Prisma.Decimal(10),
  servoMotors: new Prisma.Decimal(10),
  gyroStabilizers: new Prisma.Decimal(10),
  hydraulicSystems: new Prisma.Decimal(10),
  powerCore: new Prisma.Decimal(10),
  combatAlgorithms: new Prisma.Decimal(10),
  threatAnalysis: new Prisma.Decimal(10),
  adaptiveAI: new Prisma.Decimal(10),
  logicCores: new Prisma.Decimal(10),
  syncProtocols: new Prisma.Decimal(10),
  supportSystems: new Prisma.Decimal(10),
  formationTactics: new Prisma.Decimal(10),
  currentHP: 55, // Updated to match new formula: 50 + (1 * 5) = 55
  maxHP: 55,     // Updated to match new formula: 50 + (1 * 5) = 55
  currentShield: 20,
  maxShield: 20,
  damageTaken: 0,
  elo: 1200,
  totalBattles: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  leagueWins: 0,
  leagueLosses: 0,
  leagueDraws: 0,
  tournamentWins: 0,
  tournamentLosses: 0,
  currentLeagueInstanceId: null,
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
  isBattleReady: true,
  isRepairing: false,
  totalRepairsPaid: 0,
  yieldThreshold: 10,
  loadoutType: 'single',
  stance: 'balanced',
  mainWeaponId: null,
  offhandWeaponId: null,
  twoHandedWeaponId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createMockWeapon = (overrides?: Partial<Weapon>): Weapon => ({
  id: 1,
  name: 'Test Weapon',
  weaponType: 'energy',
  baseDamage: 20,
  cooldown: 3,
  cost: 50000,
  handsRequired: 'one',
  damageType: 'energy',
  loadoutType: 'any',
  specialProperty: null,
  description: null,
  combatPowerBonus: 5,
  targetingSystemsBonus: 3,
  criticalSystemsBonus: 0,
  penetrationBonus: 0,
  weaponControlBonus: 0,
  attackSpeedBonus: 0,
  armorPlatingBonus: 0,
  shieldCapacityBonus: 0,
  evasionThrustersBonus: 0,
  damageDampenersBonus: 0,
  counterProtocolsBonus: 0,
  hullIntegrityBonus: 2,
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
  createdAt: new Date(),
  ...overrides,
});

describe('Robot Calculations', () => {
  describe('calculateEffectiveStats', () => {
    it('should calculate base stats without weapons or loadout bonuses', () => {
      const robot = createMockRobot({ loadoutType: 'single' });
      const stats = calculateEffectiveStats(robot);

      // With single loadout: gyroStabilizers +10%, servoMotors +5%
      expect(stats.combatPower).toBe(10); // No bonus
      expect(stats.gyroStabilizers).toBe(11); // 10 * 1.10 = 11
      expect(stats.servoMotors).toBe(10); // 10 * 1.05 = 10.5, floored to 10
    });

    it('should apply weapon bonuses correctly', () => {
      const weapon = createMockWeapon({
        combatPowerBonus: 5,
        targetingSystemsBonus: 3,
        hullIntegrityBonus: 2,
      });

      const robot = createMockRobot({ 
        loadoutType: 'single',
        mainWeaponId: 1,
      });

      const robotWithWeapon = {
        ...robot,
        mainWeapon: {
          id: 1,
          userId: 1,
          weaponId: 1,
          customName: null,
          purchasedAt: new Date(),
          weapon,
        },
      };

      const stats = calculateEffectiveStats(robotWithWeapon);

      // Base 10 + weapon bonus 5 = 15, no loadout modifier
      expect(stats.combatPower).toBe(15);
      // Base 10 + weapon bonus 3 = 13, no loadout modifier
      expect(stats.targetingSystems).toBe(13);
      // Base 10 + weapon bonus 2 = 12, no loadout modifier
      expect(stats.hullIntegrity).toBe(12);
    });

    it('should apply loadout bonuses correctly for weapon_shield', () => {
      const robot = createMockRobot({ 
        loadoutType: 'weapon_shield',
        shieldCapacity: new Prisma.Decimal(10),
        armorPlating: new Prisma.Decimal(10),
        counterProtocols: new Prisma.Decimal(10),
        attackSpeed: new Prisma.Decimal(10),
      });

      const stats = calculateEffectiveStats(robot);

      // shieldCapacity: new Prisma.Decimal(10) * 1.20 = 12
      expect(stats.shieldCapacity).toBe(12);
      // armorPlating: new Prisma.Decimal(10) * 1.15 = 11.5, floored to 11
      expect(stats.armorPlating).toBe(11);
      // counterProtocols: new Prisma.Decimal(10) * 1.10 = 11
      expect(stats.counterProtocols).toBe(11);
      // attackSpeed: new Prisma.Decimal(10) * 0.85 = 8.5, floored to 8
      expect(stats.attackSpeed).toBe(8);
    });

    it('should apply loadout bonuses correctly for two_handed', () => {
      const robot = createMockRobot({ 
        loadoutType: 'two_handed',
        combatPower: new Prisma.Decimal(10),
        criticalSystems: new Prisma.Decimal(10),
        evasionThrusters: new Prisma.Decimal(10),
      });

      const stats = calculateEffectiveStats(robot);

      // combatPower: new Prisma.Decimal(10) * 1.25 = 12.5, floored to 12
      expect(stats.combatPower).toBe(12);
      // criticalSystems: new Prisma.Decimal(10) * 1.20 = 12
      expect(stats.criticalSystems).toBe(12);
      // evasionThrusters: new Prisma.Decimal(10) * 0.90 = 9
      expect(stats.evasionThrusters).toBe(9);
    });

    it('should apply both weapon and loadout bonuses', () => {
      const weapon = createMockWeapon({
        combatPowerBonus: 5,
      });

      const robot = createMockRobot({ 
        loadoutType: 'two_handed',
        combatPower: new Prisma.Decimal(10),
        mainWeaponId: 1,
      });

      const robotWithWeapon = {
        ...robot,
        mainWeapon: {
          id: 1,
          userId: 1,
          weaponId: 1,
          customName: null,
          purchasedAt: new Date(),
          weapon,
        },
      };

      const stats = calculateEffectiveStats(robotWithWeapon);

      // (Base 10 + weapon 5) * 1.25 = 18.75, floored to 18
      expect(stats.combatPower).toBe(18);
    });

    it('should combine main and offhand weapon bonuses', () => {
      const mainWeapon = createMockWeapon({
        combatPowerBonus: 5,
        targetingSystemsBonus: 2,
      });

      const offhandWeapon = createMockWeapon({
        combatPowerBonus: 3,
        targetingSystemsBonus: 4,
      });

      const robot = createMockRobot({ 
        loadoutType: 'dual_wield',
        combatPower: new Prisma.Decimal(10),
        targetingSystems: new Prisma.Decimal(10),
        mainWeaponId: 1,
        offhandWeaponId: 2,
      });

      const robotWithWeapons = {
        ...robot,
        mainWeapon: {
          id: 1,
          userId: 1,
          weaponId: 1,
          customName: null,
          purchasedAt: new Date(),
          weapon: mainWeapon,
        },
        offhandWeapon: {
          id: 2,
          userId: 1,
          weaponId: 2,
          customName: null,
          purchasedAt: new Date(),
          weapon: offhandWeapon,
        },
      };

      const stats = calculateEffectiveStats(robotWithWeapons);

      // Combat Power: (10 + 5 + 3) * 0.90 = 16.2, floored to 16 (dual_wield has -10% penalty)
      expect(stats.combatPower).toBe(16);
      // Targeting: 10 + 2 + 4 = 16 (no loadout modifier)
      expect(stats.targetingSystems).toBe(16);
    });
  });

  describe('calculateMaxHP', () => {
    it('should calculate max HP based on effective hull integrity with base HP', () => {
      const robot = createMockRobot({ 
        loadoutType: 'single',
        hullIntegrity: new Prisma.Decimal(10),
      });

      const maxHP = calculateMaxHP(robot);

      // BASE_HP (50) + (Hull integrity 10 * HP_MULTIPLIER 5) = 50 + 50 = 100
      expect(maxHP).toBe(100);
    });

    it('should include weapon bonuses in HP calculation', () => {
      const weapon = createMockWeapon({
        hullIntegrityBonus: 5,
      });

      const robot = createMockRobot({ 
        loadoutType: 'single',
        hullIntegrity: new Prisma.Decimal(10),
        mainWeaponId: 1,
      });

      const robotWithWeapon = {
        ...robot,
        mainWeapon: {
          id: 1,
          userId: 1,
          weaponId: 1,
          customName: null,
          purchasedAt: new Date(),
          weapon,
        },
      };

      const maxHP = calculateMaxHP(robotWithWeapon);

      // BASE_HP (50) + ((Hull integrity 10 + weapon 5) * HP_MULTIPLIER 5) = 50 + 75 = 125
      expect(maxHP).toBe(125);
    });

    it('should calculate correct HP for starting robot with hull integrity 1', () => {
      const robot = createMockRobot({ 
        loadoutType: 'single',
        hullIntegrity: new Prisma.Decimal(1),
      });

      const maxHP = calculateMaxHP(robot);

      // BASE_HP (50) + (Hull integrity 1 * HP_MULTIPLIER 5) = 50 + 5 = 55
      expect(maxHP).toBe(55);
    });

    it('should calculate correct HP for max level robot with hull integrity 50', () => {
      const robot = createMockRobot({ 
        loadoutType: 'single',
        hullIntegrity: new Prisma.Decimal(50),
      });

      const maxHP = calculateMaxHP(robot);

      // BASE_HP (50) + (Hull integrity 50 * HP_MULTIPLIER 5) = 50 + 250 = 300
      expect(maxHP).toBe(300);
    });
  });

  describe('calculateMaxShield', () => {
    it('should calculate max shield based on effective shield capacity', () => {
      const robot = createMockRobot({ 
        loadoutType: 'single',
        shieldCapacity: new Prisma.Decimal(10),
      });

      const maxShield = calculateMaxShield(robot);

      // Shield capacity 10 * 2 = 20
      expect(maxShield).toBe(20);
    });

    it('should include weapon and loadout bonuses in shield calculation', () => {
      const weapon = createMockWeapon({
        shieldCapacityBonus: 5,
      });

      const robot = createMockRobot({ 
        loadoutType: 'weapon_shield', // +20% shield capacity
        shieldCapacity: new Prisma.Decimal(10),
        mainWeaponId: 1,
      });

      const robotWithWeapon = {
        ...robot,
        mainWeapon: {
          id: 1,
          userId: 1,
          weaponId: 1,
          customName: null,
          purchasedAt: new Date(),
          weapon,
        },
      };

      const maxShield = calculateMaxShield(robotWithWeapon);

      // (Shield capacity 10 + weapon 5) * 1.20 * 2 = 36
      expect(maxShield).toBe(36);
    });
  });

  describe('getLoadoutBonus', () => {
    it('should return correct bonus for existing attribute', () => {
      expect(getLoadoutBonus('weapon_shield', 'shieldCapacity')).toBe(0.20);
      expect(getLoadoutBonus('two_handed', 'combatPower')).toBe(0.25);
      expect(getLoadoutBonus('dual_wield', 'attackSpeed')).toBe(0.30);
      expect(getLoadoutBonus('single', 'gyroStabilizers')).toBe(0.10);
    });

    it('should return 0 for non-modified attributes', () => {
      expect(getLoadoutBonus('single', 'combatPower')).toBe(0);
      expect(getLoadoutBonus('weapon_shield', 'hullIntegrity')).toBe(0);
    });

    it('should return 0 for invalid loadout type', () => {
      expect(getLoadoutBonus('invalid', 'combatPower')).toBe(0);
    });
  });

  describe('getLoadoutModifiedAttributes', () => {
    it('should return all modified attributes for weapon_shield', () => {
      const attrs = getLoadoutModifiedAttributes('weapon_shield');
      expect(attrs).toContain('shieldCapacity');
      expect(attrs).toContain('armorPlating');
      expect(attrs).toContain('counterProtocols');
      expect(attrs).toContain('attackSpeed');
      expect(attrs.length).toBe(4);
    });

    it('should return empty array for invalid loadout', () => {
      const attrs = getLoadoutModifiedAttributes('invalid');
      expect(attrs).toEqual([]);
    });
  });
});
