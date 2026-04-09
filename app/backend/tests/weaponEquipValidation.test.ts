import {
  validateNoDuplicateEquip,
  canEquipToSlot,
  isSlotAvailable,
  validateOffhandEquipment,
} from '../src/utils/weaponValidation';
import { Weapon } from '../generated/prisma';

// ─── Helper factories ───────────────────────────────────────────────

type TestWeapon = Pick<
  Weapon,
  'handsRequired' | 'weaponType' | 'loadoutType' | 'rangeBand' | 'name' | 'id' | 'createdAt'
>;

function makeWeapon(overrides: Partial<TestWeapon> = {}): Weapon {
  const base: TestWeapon = {
    id: 1,
    name: 'Laser Pistol',
    weaponType: 'ranged',
    handsRequired: 'one',
    loadoutType: 'any',
    rangeBand: 'short',
    createdAt: new Date(),
  };
  return { ...base, ...overrides } as unknown as Weapon;
}

function makeRobot(mainWeaponId: number | null, offhandWeaponId: number | null) {
  return { mainWeaponId, offhandWeaponId };
}

// ─── validateNoDuplicateEquip ───────────────────────────────────────

describe('validateNoDuplicateEquip', () => {
  describe('equipping to main slot', () => {
    it('should reject when weapon is already equipped as offhand on the same robot', () => {
      const result = validateNoDuplicateEquip(42, 'main', makeRobot(null, 42));
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('offhand');
    });

    it('should allow when weapon is not equipped anywhere on the robot', () => {
      const result = validateNoDuplicateEquip(42, 'main', makeRobot(null, null));
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should allow when a different weapon is in the offhand slot', () => {
      const result = validateNoDuplicateEquip(42, 'main', makeRobot(null, 99));
      expect(result.valid).toBe(true);
    });

    it('should allow when the same weapon is already in main (re-equip same slot)', () => {
      // Re-equipping to the same slot is fine — it's a no-op or swap
      const result = validateNoDuplicateEquip(42, 'main', makeRobot(42, null));
      expect(result.valid).toBe(true);
    });
  });

  describe('equipping to offhand slot', () => {
    it('should reject when weapon is already equipped as main on the same robot', () => {
      const result = validateNoDuplicateEquip(42, 'offhand', makeRobot(42, null));
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('main');
    });

    it('should allow when weapon is not equipped anywhere on the robot', () => {
      const result = validateNoDuplicateEquip(42, 'offhand', makeRobot(null, null));
      expect(result.valid).toBe(true);
    });

    it('should allow when a different weapon is in the main slot', () => {
      const result = validateNoDuplicateEquip(42, 'offhand', makeRobot(99, null));
      expect(result.valid).toBe(true);
    });

    it('should allow when the same weapon is already in offhand (re-equip same slot)', () => {
      const result = validateNoDuplicateEquip(42, 'offhand', makeRobot(null, 42));
      expect(result.valid).toBe(true);
    });
  });

  describe('the exact bug scenario — same weapon in both slots', () => {
    it('should reject equipping weapon 5 to main when it is already offhand weapon 5', () => {
      const result = validateNoDuplicateEquip(5, 'main', makeRobot(null, 5));
      expect(result.valid).toBe(false);
    });

    it('should reject equipping weapon 5 to offhand when it is already main weapon 5', () => {
      const result = validateNoDuplicateEquip(5, 'offhand', makeRobot(5, null));
      expect(result.valid).toBe(false);
    });

    it('should reject even when both slots already have the same weapon (corrupt state)', () => {
      // If somehow both slots already reference the same weapon, both directions should reject
      const result1 = validateNoDuplicateEquip(5, 'main', makeRobot(5, 5));
      expect(result1.valid).toBe(false);

      const result2 = validateNoDuplicateEquip(5, 'offhand', makeRobot(5, 5));
      expect(result2.valid).toBe(false);
    });
  });
});

// ─── canEquipToSlot — regression guards ─────────────────────────────

describe('canEquipToSlot', () => {
  it('should allow one-handed weapon in main slot for dual_wield', () => {
    const weapon = makeWeapon({ handsRequired: 'one' });
    expect(canEquipToSlot(weapon, 'main', 'dual_wield').canEquip).toBe(true);
  });

  it('should allow one-handed weapon in offhand slot for dual_wield', () => {
    const weapon = makeWeapon({ handsRequired: 'one' });
    expect(canEquipToSlot(weapon, 'offhand', 'dual_wield').canEquip).toBe(true);
  });

  it('should reject shield in main slot', () => {
    const weapon = makeWeapon({ handsRequired: 'shield' });
    expect(canEquipToSlot(weapon, 'main', 'weapon_shield').canEquip).toBe(false);
  });

  it('should reject two-handed weapon in offhand slot', () => {
    const weapon = makeWeapon({ handsRequired: 'two' });
    expect(canEquipToSlot(weapon, 'offhand', 'two_handed').canEquip).toBe(false);
  });
});

// ─── isSlotAvailable ────────────────────────────────────────────────

describe('isSlotAvailable', () => {
  it('should always allow main slot', () => {
    expect(isSlotAvailable('main', 'single')).toBe(true);
    expect(isSlotAvailable('main', 'dual_wield')).toBe(true);
    expect(isSlotAvailable('main', 'two_handed')).toBe(true);
  });

  it('should only allow offhand for weapon_shield and dual_wield', () => {
    expect(isSlotAvailable('offhand', 'weapon_shield')).toBe(true);
    expect(isSlotAvailable('offhand', 'dual_wield')).toBe(true);
    expect(isSlotAvailable('offhand', 'single')).toBe(false);
    expect(isSlotAvailable('offhand', 'two_handed')).toBe(false);
  });
});

// ─── validateOffhandEquipment ───────────────────────────────────────

describe('validateOffhandEquipment', () => {
  it('should reject shield without main weapon', () => {
    const shield = makeWeapon({ handsRequired: 'shield' });
    expect(validateOffhandEquipment(shield, false, 'weapon_shield').valid).toBe(false);
  });

  it('should allow shield with main weapon and correct loadout', () => {
    const shield = makeWeapon({ handsRequired: 'shield' });
    expect(validateOffhandEquipment(shield, true, 'weapon_shield').valid).toBe(true);
  });

  it('should reject dual_wield offhand without main weapon', () => {
    const weapon = makeWeapon({ handsRequired: 'one' });
    expect(validateOffhandEquipment(weapon, false, 'dual_wield').valid).toBe(false);
  });
});
