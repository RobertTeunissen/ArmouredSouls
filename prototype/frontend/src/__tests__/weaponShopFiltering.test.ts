import { describe, it, expect } from 'vitest';

// Mock weapon data for testing
const mockWeapons = [
  {
    id: 1,
    name: 'Practice Sword',
    weaponType: 'melee',
    loadoutType: 'single',
    handsRequired: 'one',
    description: 'A basic training sword',
    baseDamage: 25,
    cost: 62500,
    cooldown: 3.7,
    combatPowerBonus: 2,
    targetingSystemsBonus: 0,
    criticalSystemsBonus: 0,
    penetrationBonus: 0,
    weaponControlBonus: 1,
    attackSpeedBonus: 0,
    armorPlatingBonus: 0,
    shieldCapacityBonus: 0,
    evasionThrustersBonus: 0,
    counterProtocolsBonus: 0,
    servoMotorsBonus: 0,
    gyroStabilizersBonus: 0,
    hydraulicSystemsBonus: 0,
    powerCoreBonus: 0,
    threatAnalysisBonus: 0,
  },
  {
    id: 2,
    name: 'Machine Pistol',
    weaponType: 'ballistic',
    loadoutType: 'single',
    handsRequired: 'one',
    description: 'Rapid-fire sidearm',
    baseDamage: 30,
    cost: 94000,
    cooldown: 4.5,
    combatPowerBonus: 3,
    targetingSystemsBonus: 2,
    criticalSystemsBonus: 0,
    penetrationBonus: 0,
    weaponControlBonus: 0,
    attackSpeedBonus: 1,
    armorPlatingBonus: 0,
    shieldCapacityBonus: 0,
    evasionThrustersBonus: 0,
    counterProtocolsBonus: 0,
    servoMotorsBonus: 0,
    gyroStabilizersBonus: 0,
    hydraulicSystemsBonus: 0,
    powerCoreBonus: 0,
    threatAnalysisBonus: 0,
  },
  {
    id: 3,
    name: 'Light Shield',
    weaponType: 'shield',
    loadoutType: 'weapon_shield',
    handsRequired: 'shield',
    description: 'Basic defensive shield',
    baseDamage: 0,
    cost: 62500,
    cooldown: 0,
    combatPowerBonus: 0,
    targetingSystemsBonus: 0,
    criticalSystemsBonus: 0,
    penetrationBonus: 0,
    weaponControlBonus: 0,
    attackSpeedBonus: 0,
    armorPlatingBonus: 3,
    shieldCapacityBonus: 5,
    evasionThrustersBonus: 0,
    counterProtocolsBonus: 0,
    servoMotorsBonus: 0,
    gyroStabilizersBonus: 0,
    hydraulicSystemsBonus: 0,
    powerCoreBonus: 0,
    threatAnalysisBonus: 0,
  },
  {
    id: 4,
    name: 'Battle Axe',
    weaponType: 'melee',
    loadoutType: 'two_handed',
    handsRequired: 'two',
    description: 'Heavy two-handed weapon',
    baseDamage: 120,
    cost: 388000,
    cooldown: 10.0,
    combatPowerBonus: 15,
    targetingSystemsBonus: 0,
    criticalSystemsBonus: 5,
    penetrationBonus: 8,
    weaponControlBonus: 0,
    attackSpeedBonus: -2,
    armorPlatingBonus: 0,
    shieldCapacityBonus: 0,
    evasionThrustersBonus: 0,
    counterProtocolsBonus: 0,
    servoMotorsBonus: 3,
    gyroStabilizersBonus: 0,
    hydraulicSystemsBonus: 5,
    powerCoreBonus: 0,
    threatAnalysisBonus: 0,
  },
  {
    id: 5,
    name: 'Plasma Rifle',
    weaponType: 'energy',
    loadoutType: 'single',
    handsRequired: 'one',
    description: 'High-energy plasma weapon',
    baseDamage: 85,
    cost: 275000,
    cooldown: 7.2,
    combatPowerBonus: 10,
    targetingSystemsBonus: 5,
    criticalSystemsBonus: 3,
    penetrationBonus: 4,
    weaponControlBonus: 2,
    attackSpeedBonus: 0,
    armorPlatingBonus: 0,
    shieldCapacityBonus: 0,
    evasionThrustersBonus: 0,
    counterProtocolsBonus: 0,
    servoMotorsBonus: 0,
    gyroStabilizersBonus: 0,
    hydraulicSystemsBonus: 0,
    powerCoreBonus: 3,
    threatAnalysisBonus: 0,
  },
];

// Helper function to check weapon compatibility with loadout
function isWeaponCompatibleWithLoadout(weapon: any, loadoutType: string): boolean {
  const { handsRequired, weaponType } = weapon;
  const isOneHandedWeapon = () => handsRequired === 'one' && weaponType !== 'shield';

  switch (loadoutType) {
    case 'single':
      return isOneHandedWeapon();
    case 'weapon_shield':
      return isOneHandedWeapon() || (handsRequired === 'shield' && weaponType === 'shield');
    case 'two_handed':
      return handsRequired === 'two';
    case 'dual_wield':
      return isOneHandedWeapon();
    default:
      return false;
  }
}

describe('Weapon Shop Filtering Logic', () => {
  describe('Loadout Type Filtering', () => {
    it('should filter weapons for single loadout (one-handed weapons only)', () => {
      const filtered = mockWeapons.filter(w => isWeaponCompatibleWithLoadout(w, 'single'));
      expect(filtered).toHaveLength(3); // Practice Sword, Machine Pistol, Plasma Rifle
      expect(filtered.map(w => w.name)).toEqual(['Practice Sword', 'Machine Pistol', 'Plasma Rifle']);
    });

    it('should filter weapons for weapon_shield loadout (one-handed weapons + shields)', () => {
      const filtered = mockWeapons.filter(w => isWeaponCompatibleWithLoadout(w, 'weapon_shield'));
      expect(filtered).toHaveLength(4); // Practice Sword, Machine Pistol, Light Shield, Plasma Rifle
      expect(filtered.some(w => w.weaponType === 'shield')).toBe(true);
    });

    it('should filter weapons for two_handed loadout', () => {
      const filtered = mockWeapons.filter(w => isWeaponCompatibleWithLoadout(w, 'two_handed'));
      expect(filtered).toHaveLength(1); // Battle Axe
      expect(filtered[0].name).toBe('Battle Axe');
    });

    it('should filter weapons for dual_wield loadout (one-handed weapons only)', () => {
      const filtered = mockWeapons.filter(w => isWeaponCompatibleWithLoadout(w, 'dual_wield'));
      expect(filtered).toHaveLength(3); // Practice Sword, Machine Pistol, Plasma Rifle
      expect(filtered.every(w => w.handsRequired === 'one' && w.weaponType !== 'shield')).toBe(true);
    });

    it('should exclude shields from single loadout', () => {
      const filtered = mockWeapons.filter(w => isWeaponCompatibleWithLoadout(w, 'single'));
      expect(filtered.some(w => w.weaponType === 'shield')).toBe(false);
    });

    it('should exclude shields from dual_wield loadout', () => {
      const filtered = mockWeapons.filter(w => isWeaponCompatibleWithLoadout(w, 'dual_wield'));
      expect(filtered.some(w => w.weaponType === 'shield')).toBe(false);
    });
  });

  describe('Weapon Type Filtering', () => {
    it('should filter melee weapons', () => {
      const filtered = mockWeapons.filter(w => w.weaponType === 'melee');
      expect(filtered).toHaveLength(2); // Practice Sword, Battle Axe
    });

    it('should filter ballistic weapons', () => {
      const filtered = mockWeapons.filter(w => w.weaponType === 'ballistic');
      expect(filtered).toHaveLength(1); // Machine Pistol
    });

    it('should filter energy weapons', () => {
      const filtered = mockWeapons.filter(w => w.weaponType === 'energy');
      expect(filtered).toHaveLength(1); // Plasma Rifle
    });

    it('should filter shields', () => {
      const filtered = mockWeapons.filter(w => w.weaponType === 'shield');
      expect(filtered).toHaveLength(1); // Light Shield
    });
  });

  describe('Price Range Filtering', () => {
    it('should filter budget weapons (<100K)', () => {
      const filtered = mockWeapons.filter(w => w.cost < 100000);
      expect(filtered).toHaveLength(3); // Practice Sword, Machine Pistol, Light Shield
    });

    it('should filter mid-range weapons (100K-300K)', () => {
      const filtered = mockWeapons.filter(w => w.cost >= 100000 && w.cost <= 300000);
      expect(filtered).toHaveLength(1); // Plasma Rifle
    });

    it('should filter premium weapons (300K-500K)', () => {
      const filtered = mockWeapons.filter(w => w.cost >= 300000 && w.cost <= 500000);
      expect(filtered).toHaveLength(1); // Battle Axe
    });

    it('should filter luxury weapons (>500K)', () => {
      const filtered = mockWeapons.filter(w => w.cost > 500000);
      expect(filtered).toHaveLength(0); // None in mock data
    });
  });

  describe('Combined Filtering', () => {
    it('should apply multiple filters (loadout + weapon type)', () => {
      const filtered = mockWeapons.filter(w => 
        isWeaponCompatibleWithLoadout(w, 'single') && w.weaponType === 'melee'
      );
      expect(filtered).toHaveLength(1); // Practice Sword
      expect(filtered[0].name).toBe('Practice Sword');
    });

    it('should apply multiple filters (loadout + price range)', () => {
      const filtered = mockWeapons.filter(w => 
        isWeaponCompatibleWithLoadout(w, 'single') && w.cost < 100000
      );
      expect(filtered).toHaveLength(2); // Practice Sword, Machine Pistol
    });

    it('should apply all filters (loadout + weapon type + price)', () => {
      const filtered = mockWeapons.filter(w => 
        isWeaponCompatibleWithLoadout(w, 'single') && 
        w.weaponType === 'ballistic' && 
        w.cost < 100000
      );
      expect(filtered).toHaveLength(1); // Machine Pistol
      expect(filtered[0].name).toBe('Machine Pistol');
    });

    it('should return empty array when no weapons match all filters', () => {
      const filtered = mockWeapons.filter(w => 
        isWeaponCompatibleWithLoadout(w, 'two_handed') && 
        w.weaponType === 'energy'
      );
      expect(filtered).toHaveLength(0);
    });
  });

  describe('Affordability Filtering', () => {
    it('should filter weapons user can afford', () => {
      const userCredits = 100000;
      const filtered = mockWeapons.filter(w => w.cost <= userCredits);
      expect(filtered).toHaveLength(3); // Practice Sword, Machine Pistol, Light Shield
    });

    it('should exclude weapons user cannot afford', () => {
      const userCredits = 50000;
      const filtered = mockWeapons.filter(w => w.cost <= userCredits);
      expect(filtered).toHaveLength(0);
    });

    it('should include weapons at exact credit amount', () => {
      const userCredits = 62500;
      const filtered = mockWeapons.filter(w => w.cost <= userCredits);
      expect(filtered).toHaveLength(2); // Practice Sword, Light Shield
    });
  });
});

describe('Weapon Shop Sorting Logic', () => {
  const calculateDiscountedPrice = (basePrice: number, discountPercent: number = 0): number => {
    return Math.floor(basePrice * (1 - discountPercent / 100));
  };

  describe('Sort by Name', () => {
    it('should sort weapons alphabetically (A-Z)', () => {
      const sorted = [...mockWeapons].sort((a, b) => a.name.localeCompare(b.name));
      expect(sorted[0].name).toBe('Battle Axe');
      expect(sorted[sorted.length - 1].name).toBe('Practice Sword');
    });
  });

  describe('Sort by Price', () => {
    it('should sort weapons by price (low to high)', () => {
      const sorted = [...mockWeapons].sort((a, b) => a.cost - b.cost);
      expect(sorted[0].cost).toBe(62500);
      expect(sorted[sorted.length - 1].cost).toBe(388000);
    });

    it('should sort weapons by price (high to low)', () => {
      const sorted = [...mockWeapons].sort((a, b) => b.cost - a.cost);
      expect(sorted[0].cost).toBe(388000);
      expect(sorted[sorted.length - 1].cost).toBe(62500);
    });

    it('should sort by discounted price when discount applied', () => {
      const discountPercent = 20;
      const sorted = [...mockWeapons].sort((a, b) => 
        calculateDiscountedPrice(a.cost, discountPercent) - calculateDiscountedPrice(b.cost, discountPercent)
      );
      expect(sorted[0].cost).toBe(62500); // Lowest base price
      expect(sorted[sorted.length - 1].cost).toBe(388000); // Highest base price
    });
  });

  describe('Sort by Damage', () => {
    it('should sort weapons by damage (high to low)', () => {
      const sorted = [...mockWeapons].sort((a, b) => b.baseDamage - a.baseDamage);
      expect(sorted[0].baseDamage).toBe(120); // Battle Axe
      expect(sorted[sorted.length - 1].baseDamage).toBe(0); // Light Shield
    });

    it('should handle weapons with zero damage', () => {
      const sorted = [...mockWeapons].sort((a, b) => b.baseDamage - a.baseDamage);
      const shieldIndex = sorted.findIndex(w => w.weaponType === 'shield');
      expect(shieldIndex).toBe(sorted.length - 1); // Shield should be last
    });
  });

  describe('Sort by DPS', () => {
    it('should sort weapons by DPS (high to low)', () => {
      const getDPS = (w: any) => w.cooldown > 0 ? w.baseDamage / w.cooldown : 0;
      const sorted = [...mockWeapons].sort((a, b) => getDPS(b) - getDPS(a));
      
      // Battle Axe: 120/10 = 12 DPS
      // Plasma Rifle: 85/7.2 = 11.8 DPS
      // Practice Sword: 25/3.7 = 6.76 DPS
      expect(sorted[0].name).toBe('Battle Axe');
      expect(getDPS(sorted[0])).toBeCloseTo(12, 1);
    });

    it('should handle weapons with zero cooldown', () => {
      const getDPS = (w: any) => w.cooldown > 0 ? w.baseDamage / w.cooldown : 0;
      const sorted = [...mockWeapons].sort((a, b) => getDPS(b) - getDPS(a));
      const shieldIndex = sorted.findIndex(w => w.weaponType === 'shield');
      expect(getDPS(sorted[shieldIndex])).toBe(0);
    });
  });
});

describe('Weapon Shop Search Logic', () => {
  const searchWeapons = (weapons: any[], query: string): any[] => {
    if (!query.trim()) return weapons;
    
    const lowerQuery = query.trim().toLowerCase(); // Added trim here
    return weapons.filter(weapon =>
      weapon.name.toLowerCase().includes(lowerQuery) ||
      weapon.description.toLowerCase().includes(lowerQuery) ||
      weapon.weaponType.toLowerCase().includes(lowerQuery) ||
      weapon.loadoutType.toLowerCase().replace('_', ' ').includes(lowerQuery)
    );
  };

  it('should search by weapon name (exact match)', () => {
    const results = searchWeapons(mockWeapons, 'Practice Sword');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Practice Sword');
  });

  it('should search by weapon name (partial match)', () => {
    const results = searchWeapons(mockWeapons, 'sword');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Practice Sword');
  });

  it('should search by weapon name (case insensitive)', () => {
    const results = searchWeapons(mockWeapons, 'PLASMA');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Plasma Rifle');
  });

  it('should search by description', () => {
    const results = searchWeapons(mockWeapons, 'rapid-fire');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Machine Pistol');
  });

  it('should search by weapon type', () => {
    const results = searchWeapons(mockWeapons, 'melee');
    expect(results).toHaveLength(2); // Practice Sword, Battle Axe
  });

  it('should search by loadout type', () => {
    const results = searchWeapons(mockWeapons, 'two handed');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Battle Axe');
  });

  it('should return all weapons for empty query', () => {
    const results = searchWeapons(mockWeapons, '');
    expect(results).toHaveLength(mockWeapons.length);
  });

  it('should return empty array for no matches', () => {
    const results = searchWeapons(mockWeapons, 'nonexistent');
    expect(results).toHaveLength(0);
  });

  it('should handle whitespace in query', () => {
    const results = searchWeapons(mockWeapons, '  plasma  ');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Plasma Rifle');
  });
});

describe('Value Calculation Logic', () => {
  it('should calculate cost per damage correctly', () => {
    const weapon = mockWeapons[0]; // Practice Sword: 62500 cost, 25 damage
    const costPerDamage = weapon.cost / weapon.baseDamage;
    expect(costPerDamage).toBe(2500);
  });

  it('should calculate DPS per 1K credits correctly', () => {
    const weapon = mockWeapons[0]; // Practice Sword: 62500 cost, 25 damage, 3.7 cooldown
    const dps = weapon.baseDamage / weapon.cooldown;
    const dpsPerK = (dps / weapon.cost) * 1000;
    expect(dpsPerK).toBeCloseTo(0.108, 2);
  });

  it('should calculate total attribute bonuses correctly', () => {
    const weapon = mockWeapons[4]; // Plasma Rifle
    const totalAttributes = 
      weapon.combatPowerBonus +
      weapon.targetingSystemsBonus +
      weapon.criticalSystemsBonus +
      weapon.penetrationBonus +
      weapon.weaponControlBonus +
      weapon.powerCoreBonus;
    expect(totalAttributes).toBe(27); // 10+5+3+4+2+3
  });

  it('should calculate attributes per 1K credits correctly', () => {
    const weapon = mockWeapons[4]; // Plasma Rifle: 275000 cost
    const totalAttributes = 27;
    const attributesPerK = (totalAttributes / weapon.cost) * 1000;
    expect(attributesPerK).toBeCloseTo(0.098, 2);
  });

  it('should handle weapons with zero damage (shields)', () => {
    const weapon = mockWeapons[2]; // Light Shield: 0 damage
    const costPerDamage = weapon.baseDamage > 0 ? weapon.cost / weapon.baseDamage : Infinity;
    expect(costPerDamage).toBe(Infinity);
  });
});
