/**
 * Tests for robots route Zod validation schemas.
 *
 * Validates that robot endpoints reject invalid input (malformed IDs,
 * invalid names, invalid loadout types, etc.).
 */

import { z } from 'zod';
import { positiveIntParam, safeName } from '../src/utils/securityValidation';

// --- Recreate the robot route schemas (same definitions as robots.ts) ---

const robotIdParamsSchema = z.object({
  id: positiveIntParam,
});

const createRobotBodySchema = z.object({
  name: safeName,
});

const equipWeaponBodySchema = z.object({
  weaponInventoryId: z.coerce.number().int().positive(),
});

const loadoutTypeBodySchema = z.object({
  loadoutType: z.enum(['single', 'weapon_shield', 'two_handed', 'dual_wield']),
});

const stanceBodySchema = z.object({
  stance: z.string().min(1).max(20),
});

const yieldThresholdBodySchema = z.object({
  yieldThreshold: z.coerce.number().min(0).max(50),
});

const appearanceBodySchema = z.object({
  imageUrl: z.string().min(1).max(200),
});

const upgradesBodySchema = z.object({
  upgrades: z.record(z.string(), z.object({
    currentLevel: z.number().int().nonnegative(),
    plannedLevel: z.number().int().positive(),
  })),
});

// --- Tests ---

describe('Robots route validation schemas', () => {
  describe('robotIdParamsSchema', () => {
    it('should accept valid numeric ID string', () => {
      const result = robotIdParamsSchema.safeParse({ id: '42' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.id).toBe(42);
    });

    it('should reject non-numeric ID', () => {
      expect(robotIdParamsSchema.safeParse({ id: 'abc' }).success).toBe(false);
    });

    it('should reject negative ID', () => {
      expect(robotIdParamsSchema.safeParse({ id: '-1' }).success).toBe(false);
    });

    it('should reject zero', () => {
      expect(robotIdParamsSchema.safeParse({ id: '0' }).success).toBe(false);
    });

    it('should reject float', () => {
      expect(robotIdParamsSchema.safeParse({ id: '3.14' }).success).toBe(false);
    });
  });

  describe('createRobotBodySchema', () => {
    it('should accept valid robot name', () => {
      const result = createRobotBodySchema.safeParse({ name: 'IronFist MK2' });
      expect(result.success).toBe(true);
    });

    it('should reject empty name', () => {
      expect(createRobotBodySchema.safeParse({ name: '' }).success).toBe(false);
    });

    it('should reject missing name', () => {
      expect(createRobotBodySchema.safeParse({}).success).toBe(false);
    });

    it('should strip unknown fields', () => {
      const result = createRobotBodySchema.safeParse({ name: 'TestBot', hackerField: 'DROP TABLE' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty('hackerField');
      }
    });
  });

  describe('equipWeaponBodySchema', () => {
    it('should accept valid weapon inventory ID', () => {
      const result = equipWeaponBodySchema.safeParse({ weaponInventoryId: 5 });
      expect(result.success).toBe(true);
    });

    it('should coerce string to number', () => {
      const result = equipWeaponBodySchema.safeParse({ weaponInventoryId: '10' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.weaponInventoryId).toBe(10);
    });

    it('should reject zero', () => {
      expect(equipWeaponBodySchema.safeParse({ weaponInventoryId: 0 }).success).toBe(false);
    });

    it('should reject negative', () => {
      expect(equipWeaponBodySchema.safeParse({ weaponInventoryId: -1 }).success).toBe(false);
    });

    it('should reject non-integer', () => {
      expect(equipWeaponBodySchema.safeParse({ weaponInventoryId: 1.5 }).success).toBe(false);
    });
  });

  describe('loadoutTypeBodySchema', () => {
    it.each(['single', 'weapon_shield', 'two_handed', 'dual_wield'] as const)(
      'should accept valid loadout type: %s',
      (loadoutType) => {
        const result = loadoutTypeBodySchema.safeParse({ loadoutType });
        expect(result.success).toBe(true);
      },
    );

    it('should reject invalid loadout type', () => {
      expect(loadoutTypeBodySchema.safeParse({ loadoutType: 'triple_wield' }).success).toBe(false);
    });

    it('should reject empty string', () => {
      expect(loadoutTypeBodySchema.safeParse({ loadoutType: '' }).success).toBe(false);
    });
  });

  describe('stanceBodySchema', () => {
    it.each(['offensive', 'defensive', 'balanced'])(
      'should accept valid stance: %s',
      (stance) => {
        const result = stanceBodySchema.safeParse({ stance });
        expect(result.success).toBe(true);
      },
    );

    it('should reject empty string', () => {
      expect(stanceBodySchema.safeParse({ stance: '' }).success).toBe(false);
    });

    it('should reject strings over 20 chars', () => {
      expect(stanceBodySchema.safeParse({ stance: 'a'.repeat(21) }).success).toBe(false);
    });
  });

  describe('yieldThresholdBodySchema', () => {
    it('should accept 0 (never yield)', () => {
      const result = yieldThresholdBodySchema.safeParse({ yieldThreshold: 0 });
      expect(result.success).toBe(true);
    });

    it('should accept 50 (max yield)', () => {
      const result = yieldThresholdBodySchema.safeParse({ yieldThreshold: 50 });
      expect(result.success).toBe(true);
    });

    it('should accept 25 (middle value)', () => {
      const result = yieldThresholdBodySchema.safeParse({ yieldThreshold: 25 });
      expect(result.success).toBe(true);
    });

    it('should reject values above 50', () => {
      expect(yieldThresholdBodySchema.safeParse({ yieldThreshold: 51 }).success).toBe(false);
    });

    it('should reject negative values', () => {
      expect(yieldThresholdBodySchema.safeParse({ yieldThreshold: -1 }).success).toBe(false);
    });

    it('should coerce string to number', () => {
      const result = yieldThresholdBodySchema.safeParse({ yieldThreshold: '30' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.yieldThreshold).toBe(30);
    });
  });

  describe('appearanceBodySchema', () => {
    it('should accept valid image URL', () => {
      const result = appearanceBodySchema.safeParse({ imageUrl: '/uploads/robots/test.webp' });
      expect(result.success).toBe(true);
    });

    it('should reject empty string', () => {
      expect(appearanceBodySchema.safeParse({ imageUrl: '' }).success).toBe(false);
    });

    it('should reject strings over 200 chars', () => {
      expect(appearanceBodySchema.safeParse({ imageUrl: 'x'.repeat(201) }).success).toBe(false);
    });
  });

  describe('upgradesBodySchema', () => {
    it('should accept valid upgrades map', () => {
      const result = upgradesBodySchema.safeParse({
        upgrades: {
          combatPower: { currentLevel: 1, plannedLevel: 5 },
          armorPlating: { currentLevel: 3, plannedLevel: 10 },
        },
      });
      expect(result.success).toBe(true);
    });

    it('should reject negative currentLevel', () => {
      const result = upgradesBodySchema.safeParse({
        upgrades: {
          combatPower: { currentLevel: -1, plannedLevel: 5 },
        },
      });
      expect(result.success).toBe(false);
    });

    it('should reject zero plannedLevel', () => {
      const result = upgradesBodySchema.safeParse({
        upgrades: {
          combatPower: { currentLevel: 1, plannedLevel: 0 },
        },
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-integer levels', () => {
      const result = upgradesBodySchema.safeParse({
        upgrades: {
          combatPower: { currentLevel: 1.5, plannedLevel: 3 },
        },
      });
      expect(result.success).toBe(false);
    });

    it('should accept empty upgrades map', () => {
      const result = upgradesBodySchema.safeParse({ upgrades: {} });
      expect(result.success).toBe(true);
    });
  });
});
