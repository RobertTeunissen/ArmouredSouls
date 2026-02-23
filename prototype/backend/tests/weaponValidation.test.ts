import {
  isWeaponCompatibleWithLoadout,
  canEquipToSlot,
  validateOffhandEquipment,
  getValidLoadoutsForWeapon,
  canChangeLoadout,
  isSlotAvailable,
} from '../src/utils/weaponValidation';
import { Weapon } from '@prisma/client';

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

describe('Weapon Validation', () => {
  afterAll(() => {
    // Pure unit test - no cleanup needed
  });

  describe('isWeaponCompatibleWithLoadout', () => {
    it('should allow weapons with loadoutType "any" for all loadouts', () => {
      const weapon = createMockWeapon({ loadoutType: 'any' });

      expect(isWeaponCompatibleWithLoadout(weapon, 'single')).toBe(true);
      expect(isWeaponCompatibleWithLoadout(weapon, 'weapon_shield')).toBe(true);
      expect(isWeaponCompatibleWithLoadout(weapon, 'two_handed')).toBe(true);
      expect(isWeaponCompatibleWithLoadout(weapon, 'dual_wield')).toBe(true);
    });

    it('should only allow specific loadout when weapon specifies it', () => {
      const weapon = createMockWeapon({ loadoutType: 'two_handed' });

      expect(isWeaponCompatibleWithLoadout(weapon, 'two_handed')).toBe(true);
      expect(isWeaponCompatibleWithLoadout(weapon, 'single')).toBe(false);
      expect(isWeaponCompatibleWithLoadout(weapon, 'weapon_shield')).toBe(false);
      expect(isWeaponCompatibleWithLoadout(weapon, 'dual_wield')).toBe(false);
    });
  });

  describe('canEquipToSlot - Shield weapons', () => {
    const shield = createMockWeapon({ 
      handsRequired: 'shield',
      weaponType: 'shield',
    });

    it('should prevent shields in main slot', () => {
      const result = canEquipToSlot(shield, 'main', 'weapon_shield');
      expect(result.canEquip).toBe(false);
      expect(result.reason).toContain('offhand');
    });

    it('should allow shields in offhand with weapon_shield loadout', () => {
      const result = canEquipToSlot(shield, 'offhand', 'weapon_shield');
      expect(result.canEquip).toBe(true);
    });

    it('should prevent shields without weapon_shield loadout', () => {
      const result = canEquipToSlot(shield, 'offhand', 'dual_wield');
      expect(result.canEquip).toBe(false);
      expect(result.reason).toContain('weapon_shield');
    });
  });

  describe('canEquipToSlot - Two-handed weapons', () => {
    const twoHanded = createMockWeapon({ 
      handsRequired: 'two',
      loadoutType: 'two_handed',
    });

    it('should prevent two-handed in offhand slot', () => {
      const result = canEquipToSlot(twoHanded, 'offhand', 'two_handed');
      expect(result.canEquip).toBe(false);
      expect(result.reason).toContain('main slot');
    });

    it('should allow two-handed in main slot with two_handed loadout', () => {
      const result = canEquipToSlot(twoHanded, 'main', 'two_handed');
      expect(result.canEquip).toBe(true);
    });

    it('should prevent two-handed without two_handed loadout', () => {
      const result = canEquipToSlot(twoHanded, 'main', 'single');
      expect(result.canEquip).toBe(false);
      expect(result.reason).toContain('two_handed loadout');
    });
  });

  describe('canEquipToSlot - One-handed weapons', () => {
    const oneHanded = createMockWeapon({ 
      handsRequired: 'one',
      loadoutType: 'any',
    });

    it('should allow one-handed in main slot for single loadout', () => {
      const result = canEquipToSlot(oneHanded, 'main', 'single');
      expect(result.canEquip).toBe(true);
    });

    it('should allow one-handed in main slot for weapon_shield loadout', () => {
      const result = canEquipToSlot(oneHanded, 'main', 'weapon_shield');
      expect(result.canEquip).toBe(true);
    });

    it('should allow one-handed in main slot for dual_wield loadout', () => {
      const result = canEquipToSlot(oneHanded, 'main', 'dual_wield');
      expect(result.canEquip).toBe(true);
    });

    it('should prevent one-handed in main slot for two_handed loadout', () => {
      const result = canEquipToSlot(oneHanded, 'main', 'two_handed');
      expect(result.canEquip).toBe(false);
    });

    it('should allow one-handed in offhand for dual_wield loadout', () => {
      const result = canEquipToSlot(oneHanded, 'offhand', 'dual_wield');
      expect(result.canEquip).toBe(true);
    });

    it('should prevent one-handed in offhand without dual_wield loadout', () => {
      const result = canEquipToSlot(oneHanded, 'offhand', 'single');
      expect(result.canEquip).toBe(false);
      expect(result.reason).toContain('dual_wield');
    });
  });

  describe('validateOffhandEquipment', () => {
    it('should require main weapon for shield', () => {
      const shield = createMockWeapon({ handsRequired: 'shield' });
      const result = validateOffhandEquipment(shield, false, 'weapon_shield');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('main weapon');
    });

    it('should allow shield with main weapon and correct loadout', () => {
      const shield = createMockWeapon({ handsRequired: 'shield' });
      const result = validateOffhandEquipment(shield, true, 'weapon_shield');

      expect(result.valid).toBe(true);
    });

    it('should require main weapon for dual_wield offhand', () => {
      const weapon = createMockWeapon({ handsRequired: 'one' });
      const result = validateOffhandEquipment(weapon, false, 'dual_wield');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('main weapon');
    });
  });

  describe('getValidLoadoutsForWeapon', () => {
    it('should return correct loadouts for one-handed weapon in main slot', () => {
      const weapon = createMockWeapon({ handsRequired: 'one', loadoutType: 'any' });
      const loadouts = getValidLoadoutsForWeapon(weapon, 'main');

      expect(loadouts).toContain('single');
      expect(loadouts).toContain('weapon_shield');
      expect(loadouts).toContain('dual_wield');
      expect(loadouts).not.toContain('two_handed');
    });

    it('should return only dual_wield for one-handed weapon in offhand', () => {
      const weapon = createMockWeapon({ handsRequired: 'one', loadoutType: 'any' });
      const loadouts = getValidLoadoutsForWeapon(weapon, 'offhand');

      expect(loadouts).toEqual(['dual_wield']);
    });

    it('should return only two_handed for two-handed weapon in main', () => {
      const weapon = createMockWeapon({ 
        handsRequired: 'two',
        loadoutType: 'two_handed',
      });
      const loadouts = getValidLoadoutsForWeapon(weapon, 'main');

      expect(loadouts).toEqual(['two_handed']);
    });

    it('should return only weapon_shield for shield in offhand', () => {
      const shield = createMockWeapon({ 
        handsRequired: 'shield',
        loadoutType: 'weapon_shield',
      });
      const loadouts = getValidLoadoutsForWeapon(shield, 'offhand');

      expect(loadouts).toEqual(['weapon_shield']);
    });
  });

  describe('canChangeLoadout', () => {
    it('should allow loadout change when no weapons equipped', () => {
      const result = canChangeLoadout('two_handed', null, null);

      expect(result.canChange).toBe(true);
      expect(result.conflicts).toBeUndefined();
    });

    it('should allow compatible loadout change', () => {
      const mainWeapon = createMockWeapon({ handsRequired: 'one', loadoutType: 'any' });
      const result = canChangeLoadout('single', mainWeapon, null);

      expect(result.canChange).toBe(true);
    });

    it('should prevent incompatible loadout change - two-handed with dual weapons', () => {
      const mainWeapon = createMockWeapon({ 
        handsRequired: 'one',
        loadoutType: 'any',
        name: 'Laser Rifle',
      });
      const offhandWeapon = createMockWeapon({ 
        handsRequired: 'one',
        loadoutType: 'any',
        name: 'Plasma Pistol',
      });

      const result = canChangeLoadout('two_handed', mainWeapon, offhandWeapon);

      expect(result.canChange).toBe(false);
      expect(result.conflicts).toBeDefined();
      expect(result.conflicts!.length).toBeGreaterThan(0);
    });

    it('should identify conflicting weapons', () => {
      const twoHanded = createMockWeapon({ 
        handsRequired: 'two',
        loadoutType: 'two_handed',
        name: 'Heavy Cannon',
      });

      const result = canChangeLoadout('single', twoHanded, null);

      expect(result.canChange).toBe(false);
      expect(result.conflicts![0]).toContain('Heavy Cannon');
    });
  });

  describe('isSlotAvailable', () => {
    it('should always allow main slot', () => {
      expect(isSlotAvailable('main', 'single')).toBe(true);
      expect(isSlotAvailable('main', 'weapon_shield')).toBe(true);
      expect(isSlotAvailable('main', 'two_handed')).toBe(true);
      expect(isSlotAvailable('main', 'dual_wield')).toBe(true);
    });

    it('should allow offhand only for weapon_shield and dual_wield', () => {
      expect(isSlotAvailable('offhand', 'weapon_shield')).toBe(true);
      expect(isSlotAvailable('offhand', 'dual_wield')).toBe(true);
      expect(isSlotAvailable('offhand', 'single')).toBe(false);
      expect(isSlotAvailable('offhand', 'two_handed')).toBe(false);
    });
  });
});
