/**
 * Feature: security-audit-guardrails, Property 5: Currency floor constraint
 *
 * **Validates: Requirements 2.4**
 *
 * For any database update that would set a user's currency below -10,000,000,
 * the database shall reject the operation with a constraint violation error.
 *
 * Since this is a database-level CHECK constraint, we verify:
 * 1. The migration SQL is correct and applies the right constraint
 * 2. The constraint floor value matches the design (-10,000,000)
 * 3. Values at or above the floor are accepted by the constraint logic
 * 4. Values below the floor are rejected by the constraint logic
 *
 * Note: This test validates the constraint logic without requiring a live DB.
 * The actual CHECK constraint is enforced by PostgreSQL via the migration at
 * prisma/migrations/20260402190000_prevent_negative_currency/migration.sql
 */
import fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

const CURRENCY_FLOOR = -10_000_000;

/**
 * Simulates the CHECK constraint: currency >= -10000000
 * This mirrors the database constraint defined in the migration.
 */
function satisfiesCurrencyFloorConstraint(currency: number): boolean {
  return currency >= CURRENCY_FLOOR;
}

describe('Feature: security-audit-guardrails, Property 5: Currency floor constraint', () => {
  describe('Migration SQL correctness', () => {
    it('migration file exists and contains the correct CHECK constraint', () => {
      const migrationPath = path.resolve(
        __dirname,
        '../prisma/migrations/20260402190000_prevent_negative_currency/migration.sql'
      );
      expect(fs.existsSync(migrationPath)).toBe(true);

      const sql = fs.readFileSync(migrationPath, 'utf-8');
      // Verify the constraint targets the users table
      expect(sql).toContain('ALTER TABLE "users"');
      // Verify the constraint name
      expect(sql).toContain('users_currency_floor');
      // Verify the CHECK expression with the correct floor value
      expect(sql).toContain('CHECK (currency >= -10000000)');
    });
  });

  describe('Property: values below floor are rejected', () => {
    it('rejects any currency value below -10,000,000', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1_000_000_000, max: CURRENCY_FLOOR - 1 }),
          (belowFloor) => {
            expect(satisfiesCurrencyFloorConstraint(belowFloor)).toBe(false);
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  describe('Property: values at or above floor are accepted', () => {
    it('accepts any currency value >= -10,000,000', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: CURRENCY_FLOOR, max: 1_000_000_000 }),
          (atOrAboveFloor) => {
            expect(satisfiesCurrencyFloorConstraint(atOrAboveFloor)).toBe(true);
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  describe('Property: boundary value at exactly -10,000,000 is accepted', () => {
    it('accepts the exact floor value', () => {
      expect(satisfiesCurrencyFloorConstraint(CURRENCY_FLOOR)).toBe(true);
    });

    it('rejects one below the floor', () => {
      expect(satisfiesCurrencyFloorConstraint(CURRENCY_FLOOR - 1)).toBe(false);
    });
  });

  describe('Property: starting balance and normal gameplay values are always valid', () => {
    it('accepts any non-negative currency value (normal gameplay)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100_000_000 }),
          (normalBalance) => {
            expect(satisfiesCurrencyFloorConstraint(normalBalance)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
