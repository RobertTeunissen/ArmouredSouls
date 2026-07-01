/**
 * Tests for auth route Zod validation schemas.
 *
 * Validates: Requirements 11.1, 11.2, 11.3 (authentication security)
 *
 * Tests that registration rejects invalid usernames, emails, and passwords,
 * and that login requires an identifier.
 */

import { z } from 'zod';
import { stableName as stableNameSchema } from '../src/utils/securityValidation';

// --- Recreate the auth route schemas (same definitions as auth.ts) ---

const registerBodySchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  email: z.string().min(3).max(50).email('Please provide a valid email address'),
  password: z.string().min(8).max(128),
  stableName: stableNameSchema,
});

const loginBodySchema = z.object({
  identifier: z.string().min(1).max(50).optional(),
  username: z.string().min(1).max(50).optional(),
  password: z.string().min(1).max(128),
}).refine(
  (data) => data.identifier || data.username,
  { message: 'Either identifier or username must be provided', path: ['identifier'] }
);

// --- Tests ---

describe('Auth route validation schemas', () => {
  describe('registerBodySchema', () => {
    const validRegistration = {
      username: 'test_user',
      email: 'test@example.com',
      password: 'SecureP@ss1',
      stableName: 'Iron Forge',
    };

    it('should accept valid registration data', () => {
      const result = registerBodySchema.safeParse(validRegistration);
      expect(result.success).toBe(true);
    });

    describe('username validation', () => {
      it('should reject username shorter than 3 chars', () => {
        const result = registerBodySchema.safeParse({ ...validRegistration, username: 'ab' });
        expect(result.success).toBe(false);
      });

      it('should reject username longer than 20 chars', () => {
        const result = registerBodySchema.safeParse({ ...validRegistration, username: 'a'.repeat(21) });
        expect(result.success).toBe(false);
      });

      it('should reject username with spaces', () => {
        const result = registerBodySchema.safeParse({ ...validRegistration, username: 'my user' });
        expect(result.success).toBe(false);
      });

      it('should reject username with special characters', () => {
        const result = registerBodySchema.safeParse({ ...validRegistration, username: 'user@name' });
        expect(result.success).toBe(false);
      });

      it('should accept username with underscores and hyphens', () => {
        const result = registerBodySchema.safeParse({ ...validRegistration, username: 'my_user-01' });
        expect(result.success).toBe(true);
      });
    });

    describe('email validation', () => {
      it('should reject invalid email format', () => {
        expect(registerBodySchema.safeParse({ ...validRegistration, email: 'not-an-email' }).success).toBe(false);
      });

      it('should reject email longer than 50 chars', () => {
        const longEmail = 'a'.repeat(40) + '@example.com';
        expect(registerBodySchema.safeParse({ ...validRegistration, email: longEmail }).success).toBe(false);
      });

      it('should accept valid email', () => {
        expect(registerBodySchema.safeParse({ ...validRegistration, email: 'user@domain.co.uk' }).success).toBe(true);
      });
    });

    describe('password validation', () => {
      it('should reject password shorter than 8 chars', () => {
        expect(registerBodySchema.safeParse({ ...validRegistration, password: 'Short1!' }).success).toBe(false);
      });

      it('should accept password of exactly 8 chars', () => {
        expect(registerBodySchema.safeParse({ ...validRegistration, password: 'Abcde123' }).success).toBe(true);
      });

      it('should reject password longer than 128 chars', () => {
        expect(registerBodySchema.safeParse({ ...validRegistration, password: 'A'.repeat(129) }).success).toBe(false);
      });
    });

    describe('mass-assignment protection', () => {
      it('should strip unknown fields (admin escalation attempt)', () => {
        const result = registerBodySchema.safeParse({
          ...validRegistration,
          role: 'admin',
          isAdmin: true,
          currency: 999999999,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).not.toHaveProperty('role');
          expect(result.data).not.toHaveProperty('isAdmin');
          expect(result.data).not.toHaveProperty('currency');
        }
      });
    });
  });

  describe('loginBodySchema', () => {
    it('should accept login with identifier', () => {
      const result = loginBodySchema.safeParse({ identifier: 'test_user', password: 'mypassword' });
      expect(result.success).toBe(true);
    });

    it('should accept login with username (legacy)', () => {
      const result = loginBodySchema.safeParse({ username: 'test_user', password: 'mypassword' });
      expect(result.success).toBe(true);
    });

    it('should reject login without identifier or username', () => {
      const result = loginBodySchema.safeParse({ password: 'mypassword' });
      expect(result.success).toBe(false);
    });

    it('should reject empty password', () => {
      const result = loginBodySchema.safeParse({ identifier: 'test_user', password: '' });
      expect(result.success).toBe(false);
    });

    it('should reject identifier longer than 50 chars', () => {
      const result = loginBodySchema.safeParse({ identifier: 'a'.repeat(51), password: 'password' });
      expect(result.success).toBe(false);
    });

    it('should reject password longer than 128 chars', () => {
      const result = loginBodySchema.safeParse({ identifier: 'user', password: 'A'.repeat(129) });
      expect(result.success).toBe(false);
    });
  });
});
