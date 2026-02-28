import { hashPassword, verifyPassword } from '../src/services/passwordService';
import bcrypt from 'bcrypt';

describe('Password Service', () => {
  describe('hashPassword', () => {
    it('should hash a password successfully', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should generate a valid bcrypt hash format', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);
      
      // Bcrypt hashes start with $2a$, $2b$, or $2y$
      expect(hash).toMatch(/^\$2[aby]\$/);
    });

    it('should generate different hashes for the same password', async () => {
      const password = 'testPassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should throw error for empty password', async () => {
      await expect(hashPassword('')).rejects.toThrow('Password cannot be empty');
    });

    it('should use configurable salt rounds from environment', async () => {
      const originalEnv = process.env.BCRYPT_SALT_ROUNDS;
      process.env.BCRYPT_SALT_ROUNDS = '12';
      
      const password = 'testPassword123';
      const hash = await hashPassword(password);
      
      // Verify the hash was created with 12 rounds
      // Bcrypt hash format: $2b$[rounds]$[salt+hash]
      const rounds = hash.split('$')[2];
      expect(rounds).toBe('12');
      
      // Restore original environment
      if (originalEnv) {
        process.env.BCRYPT_SALT_ROUNDS = originalEnv;
      } else {
        delete process.env.BCRYPT_SALT_ROUNDS;
      }
    });

    it('should use default salt rounds of 10 when not configured', async () => {
      const originalEnv = process.env.BCRYPT_SALT_ROUNDS;
      delete process.env.BCRYPT_SALT_ROUNDS;
      
      const password = 'testPassword123';
      const hash = await hashPassword(password);
      
      // Verify the hash was created with 10 rounds (default)
      const rounds = hash.split('$')[2];
      expect(rounds).toBe('10');
      
      // Restore original environment
      if (originalEnv) {
        process.env.BCRYPT_SALT_ROUNDS = originalEnv;
      }
    });

    it('should use default salt rounds for invalid environment value', async () => {
      const originalEnv = process.env.BCRYPT_SALT_ROUNDS;
      process.env.BCRYPT_SALT_ROUNDS = 'invalid';
      
      const password = 'testPassword123';
      const hash = await hashPassword(password);
      
      // Should fall back to default of 10
      const rounds = hash.split('$')[2];
      expect(rounds).toBe('10');
      
      // Restore original environment
      if (originalEnv) {
        process.env.BCRYPT_SALT_ROUNDS = originalEnv;
      } else {
        delete process.env.BCRYPT_SALT_ROUNDS;
      }
    });

    it('should handle passwords with special characters', async () => {
      const password = 'P@ssw0rd!#$%^&*()';
      const hash = await hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
    });

    it('should handle long passwords', async () => {
      const password = 'a'.repeat(128);
      const hash = await hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'testPassword123';
      const wrongPassword = 'wrongPassword456';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword(wrongPassword, hash);
      expect(isValid).toBe(false);
    });

    it('should return false for empty password', async () => {
      const hash = await hashPassword('testPassword123');
      
      const isValid = await verifyPassword('', hash);
      expect(isValid).toBe(false);
    });

    it('should return false for empty hash', async () => {
      const isValid = await verifyPassword('testPassword123', '');
      expect(isValid).toBe(false);
    });

    it('should verify password with special characters', async () => {
      const password = 'P@ssw0rd!#$%^&*()';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should be case sensitive', async () => {
      const password = 'TestPassword123';
      const hash = await hashPassword(password);
      
      const isValidLower = await verifyPassword('testpassword123', hash);
      expect(isValidLower).toBe(false);
    });
  });

  describe('Integration with bcrypt', () => {
    it('should produce hashes compatible with bcrypt.compare', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);
      
      // Verify using bcrypt directly
      const isValid = await bcrypt.compare(password, hash);
      expect(isValid).toBe(true);
    });

    it('should verify hashes created by bcrypt directly', async () => {
      const password = 'testPassword123';
      const hash = await bcrypt.hash(password, 10);
      
      // Verify using our service
      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });
  });
});
