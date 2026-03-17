import {
  classifyRangeBand,
  getRangePenalty,
  getWeaponOptimalRange,
  canAttack,
  WeaponLike,
} from '../src/services/arena/rangeBands';

// ─── Helper factories ───────────────────────────────────────────────

function meleeWeapon(name = 'Combat Knife'): WeaponLike {
  return { weaponType: 'melee', handsRequired: 'one', name };
}

function shieldWeapon(name = 'Light Shield'): WeaponLike {
  return { weaponType: 'shield', handsRequired: 'shield', name };
}

function oneHandedRanged(name = 'Laser Pistol'): WeaponLike {
  return { weaponType: 'energy', handsRequired: 'one', name };
}

function twoHandedRanged(name = 'Shotgun'): WeaponLike {
  return { weaponType: 'ballistic', handsRequired: 'two', name };
}

function longRangeWeapon(name = 'Sniper Rifle'): WeaponLike {
  return { weaponType: 'ballistic', handsRequired: 'two', name };
}

// ─── classifyRangeBand ──────────────────────────────────────────────

describe('classifyRangeBand', () => {
  it('should return melee for distance 0', () => {
    expect(classifyRangeBand(0)).toBe('melee');
  });

  it('should return melee for distance 2 (upper boundary)', () => {
    expect(classifyRangeBand(2)).toBe('melee');
  });

  it('should return short for distance 3 (lower boundary)', () => {
    expect(classifyRangeBand(3)).toBe('short');
  });

  it('should return short for distance 6 (upper boundary)', () => {
    expect(classifyRangeBand(6)).toBe('short');
  });

  it('should return mid for distance 7 (lower boundary)', () => {
    expect(classifyRangeBand(7)).toBe('mid');
  });

  it('should return mid for distance 12 (upper boundary)', () => {
    expect(classifyRangeBand(12)).toBe('mid');
  });

  it('should return long for distance 13 (lower boundary)', () => {
    expect(classifyRangeBand(13)).toBe('long');
  });

  it('should return long for very large distances', () => {
    expect(classifyRangeBand(1000)).toBe('long');
  });

  it('should return melee for negative distances', () => {
    expect(classifyRangeBand(-5)).toBe('melee');
  });

  it('should return melee for fractional distance within melee', () => {
    expect(classifyRangeBand(1.5)).toBe('melee');
  });

  it('should return short for fractional distance 2.5', () => {
    expect(classifyRangeBand(2.5)).toBe('short');
  });
});

// ─── getRangePenalty ────────────────────────────────────────────────

describe('getRangePenalty', () => {
  it('should return 1.1 (optimal) when weapon and current range match', () => {
    expect(getRangePenalty('melee', 'melee')).toBe(1.1);
    expect(getRangePenalty('short', 'short')).toBe(1.1);
    expect(getRangePenalty('mid', 'mid')).toBe(1.1);
    expect(getRangePenalty('long', 'long')).toBe(1.1);
  });

  it('should return 0.75 when one band away', () => {
    expect(getRangePenalty('melee', 'short')).toBe(0.75);
    expect(getRangePenalty('short', 'melee')).toBe(0.75);
    expect(getRangePenalty('short', 'mid')).toBe(0.75);
    expect(getRangePenalty('mid', 'long')).toBe(0.75);
  });

  it('should return 0.5 when two bands away', () => {
    expect(getRangePenalty('melee', 'mid')).toBe(0.5);
    expect(getRangePenalty('mid', 'melee')).toBe(0.5);
    expect(getRangePenalty('short', 'long')).toBe(0.5);
  });

  it('should return 0.5 when three bands away', () => {
    expect(getRangePenalty('melee', 'long')).toBe(0.5);
    expect(getRangePenalty('long', 'melee')).toBe(0.5);
  });
});

// ─── getWeaponOptimalRange ──────────────────────────────────────────

describe('getWeaponOptimalRange', () => {
  it('should return melee for melee weapons', () => {
    expect(getWeaponOptimalRange(meleeWeapon('Practice Sword'))).toBe('melee');
    expect(getWeaponOptimalRange(meleeWeapon('Energy Blade'))).toBe('melee');
    expect(getWeaponOptimalRange(meleeWeapon('Battle Axe'))).toBe('melee');
    expect(getWeaponOptimalRange({ weaponType: 'melee', handsRequired: 'two', name: 'Heavy Hammer' })).toBe('melee');
  });

  it('should return melee for shield weapons', () => {
    expect(getWeaponOptimalRange(shieldWeapon('Light Shield'))).toBe('melee');
    expect(getWeaponOptimalRange(shieldWeapon('Combat Shield'))).toBe('melee');
    expect(getWeaponOptimalRange(shieldWeapon('Reactive Shield'))).toBe('melee');
  });

  it('should return long for named long-range weapons', () => {
    expect(getWeaponOptimalRange(longRangeWeapon('Sniper Rifle'))).toBe('long');
    expect(getWeaponOptimalRange({ weaponType: 'ballistic', handsRequired: 'two', name: 'Railgun' })).toBe('long');
    expect(getWeaponOptimalRange({ weaponType: 'energy', handsRequired: 'two', name: 'Ion Beam' })).toBe('long');
  });

  it('should return mid for two-handed ranged (non-sniper)', () => {
    expect(getWeaponOptimalRange(twoHandedRanged('Shotgun'))).toBe('mid');
    expect(getWeaponOptimalRange({ weaponType: 'ballistic', handsRequired: 'two', name: 'Grenade Launcher' })).toBe('mid');
    expect(getWeaponOptimalRange({ weaponType: 'energy', handsRequired: 'two', name: 'Plasma Cannon' })).toBe('mid');
  });

  it('should return short for one-handed energy/ballistic', () => {
    expect(getWeaponOptimalRange(oneHandedRanged('Laser Pistol'))).toBe('short');
    expect(getWeaponOptimalRange({ weaponType: 'ballistic', handsRequired: 'one', name: 'Machine Pistol' })).toBe('short');
    expect(getWeaponOptimalRange({ weaponType: 'ballistic', handsRequired: 'one', name: 'Assault Rifle' })).toBe('short');
    expect(getWeaponOptimalRange({ weaponType: 'energy', handsRequired: 'one', name: 'Plasma Rifle' })).toBe('short');
  });
});

// ─── canAttack ──────────────────────────────────────────────────────

describe('canAttack', () => {
  it('should allow melee attacks at distance 0', () => {
    expect(canAttack(meleeWeapon(), 0)).toBe(true);
  });

  it('should allow melee attacks at distance 2 (boundary)', () => {
    expect(canAttack(meleeWeapon(), 2)).toBe(true);
  });

  it('should block melee attacks beyond distance 2', () => {
    expect(canAttack(meleeWeapon(), 2.1)).toBe(false);
    expect(canAttack(meleeWeapon(), 3)).toBe(false);
    expect(canAttack(meleeWeapon(), 15)).toBe(false);
  });

  it('should allow ranged attacks at any distance', () => {
    expect(canAttack(oneHandedRanged(), 0)).toBe(true);
    expect(canAttack(oneHandedRanged(), 5)).toBe(true);
    expect(canAttack(oneHandedRanged(), 50)).toBe(true);
  });

  it('should allow two-handed ranged attacks at any distance', () => {
    expect(canAttack(twoHandedRanged(), 0)).toBe(true);
    expect(canAttack(twoHandedRanged(), 100)).toBe(true);
  });

  it('should allow long-range weapon attacks at any distance', () => {
    expect(canAttack(longRangeWeapon(), 0)).toBe(true);
    expect(canAttack(longRangeWeapon(), 200)).toBe(true);
  });

  it('should allow shield attacks at melee range', () => {
    expect(canAttack(shieldWeapon(), 1)).toBe(true);
  });

  it('should allow shield attacks beyond melee (shields are not melee type)', () => {
    expect(canAttack(shieldWeapon(), 10)).toBe(true);
  });
});
