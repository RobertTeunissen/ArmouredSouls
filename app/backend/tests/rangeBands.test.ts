import {
  classifyRangeBand,
  getRangePenalty,
  canAttack,
  WeaponLike,
} from '../src/services/arena/rangeBands';
import { WEAPON_DEFINITIONS } from '../prisma/seed';

// ─── Helper factories ───────────────────────────────────────────────

function meleeWeapon(name = 'Combat Knife'): WeaponLike {
  return { name, rangeBand: 'melee' };
}

function shieldWeapon(name = 'Light Shield'): WeaponLike {
  return { name, rangeBand: 'melee' };
}

function oneHandedRanged(name = 'Laser Pistol'): WeaponLike {
  return { name, rangeBand: 'short' };
}

function twoHandedRanged(name = 'Shotgun'): WeaponLike {
  return { name, rangeBand: 'mid' };
}

function longRangeWeapon(name = 'Sniper Rifle'): WeaponLike {
  return { name, rangeBand: 'long' };
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

  it('should block shield attacks beyond melee range (shields have melee rangeBand)', () => {
    expect(canAttack(shieldWeapon(), 1)).toBe(true);
    expect(canAttack(shieldWeapon(), 10)).toBe(false);
  });
});

// ─── Roster range bands ─────────────────────────────────────────────────────────────

describe('WEAPON_DEFINITIONS range bands', () => {
  const VALID_RANGE_BANDS = ['melee', 'short', 'mid', 'long'] as const;

  /** Group weapons by rangeBand for per-band assertions */
  const weaponsByBand = WEAPON_DEFINITIONS.reduce<Record<string, string[]>>(
    (acc, w) => {
      (acc[w.rangeBand] ??= []).push(w.name);
      return acc;
    },
    {},
  );

  it('should cover all 47 weapons in WEAPON_DEFINITIONS', () => {
    expect(WEAPON_DEFINITIONS).toHaveLength(47);
  });

});
