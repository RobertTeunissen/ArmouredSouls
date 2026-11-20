import { generateToken, UserForToken, TokenPayload } from '../src/services/auth/jwtService';
import jwt from 'jsonwebtoken';
import { _resetConfigForTesting } from '../src/config/env';

/**
 * JWT Service - Unit Tests
 * 
 * Requirements: 11.3
 * 
 * These tests verify:
 * - Token format
 * - Payload contents
 * - Token signature
 */

describe('JWT Service', () => {
  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const user: UserForToken = {
        id: 'user-123',
        username: 'testuser',
        role: 'player',
      };

      const token = generateToken(user);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should generate a token with three parts (header.payload.signature)', () => {
      const user: UserForToken = {
        id: 'user-456',
        username: 'anotheruser',
        role: 'admin',
      };

      const token = generateToken(user);
      const parts = token.split('.');

      expect(parts).toHaveLength(3);
    });

    it('should include userId in token payload', () => {
      const user: UserForToken = {
        id: 'user-789',
        username: 'testuser',
        role: 'player',
      };

      const token = generateToken(user);
      const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
      const decoded = jwt.verify(token, secret) as TokenPayload;

      expect(decoded.userId).toBe(user.id);
    });

    it('should include username in token payload', () => {
      const user: UserForToken = {
        id: 'user-101',
        username: 'john_doe',
        role: 'player',
      };

      const token = generateToken(user);
      const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
      const decoded = jwt.verify(token, secret) as TokenPayload;

      expect(decoded.username).toBe(user.username);
    });

    it('should include role in token payload', () => {
      const user: UserForToken = {
        id: 'user-202',
        username: 'admin_user',
        role: 'admin',
      };

      const token = generateToken(user);
      const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
      const decoded = jwt.verify(token, secret) as TokenPayload;

      expect(decoded.role).toBe(user.role);
    });

    it('should include iat (issued at) timestamp in token payload', () => {
      const user: UserForToken = {
        id: 'user-303',
        username: 'testuser',
        role: 'player',
      };

      const token = generateToken(user);
      const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
      const decoded = jwt.verify(token, secret) as TokenPayload;

      expect(decoded.iat).toBeDefined();
      expect(typeof decoded.iat).toBe('number');
    });

    it('should include exp (expiration) timestamp in token payload', () => {
      const user: UserForToken = {
        id: 'user-404',
        username: 'testuser',
        role: 'player',
      };

      const token = generateToken(user);
      const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
      const decoded = jwt.verify(token, secret) as TokenPayload;

      expect(decoded.exp).toBeDefined();
      expect(typeof decoded.exp).toBe('number');
      expect(decoded.exp).toBeGreaterThan(decoded.iat!);
    });

    it('should use configurable expiration time from environment', () => {
      const originalEnv = process.env.JWT_EXPIRATION;
      process.env.JWT_EXPIRATION = '1h';
      _resetConfigForTesting();

      const user: UserForToken = {
        id: 'user-505',
        username: 'testuser',
        role: 'player',
      };

      const token = generateToken(user);
      const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
      const decoded = jwt.verify(token, secret) as TokenPayload;

      // 1 hour = 3600 seconds
      const expectedExpiration = decoded.iat! + 3600;
      expect(decoded.exp).toBe(expectedExpiration);

      // Restore original environment
      if (originalEnv) {
        process.env.JWT_EXPIRATION = originalEnv;
      } else {
        delete process.env.JWT_EXPIRATION;
      }
      _resetConfigForTesting();
    });

    it('should use default expiration of 24h when not configured', () => {
      const originalEnv = process.env.JWT_EXPIRATION;
      delete process.env.JWT_EXPIRATION;

      const user: UserForToken = {
        id: 'user-606',
        username: 'testuser',
        role: 'player',
      };

      const token = generateToken(user);
      const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
      const decoded = jwt.verify(token, secret) as TokenPayload;

      // 24 hours = 86400 seconds
      const expectedExpiration = decoded.iat! + 86400;
      expect(decoded.exp).toBe(expectedExpiration);

      // Restore original environment
      if (originalEnv) {
        process.env.JWT_EXPIRATION = originalEnv;
      }
    });

    it('should sign token with JWT_SECRET from environment', () => {
      const user: UserForToken = {
        id: 'user-707',
        username: 'testuser',
        role: 'player',
      };

      const token = generateToken(user);
      const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production';

      // Should not throw error when verifying with correct secret
      expect(() => jwt.verify(token, secret)).not.toThrow();
    });

    it('should throw error for user without id', () => {
      const user = {
        id: '',
        username: 'testuser',
        role: 'player',
      } as UserForToken;

      expect(() => generateToken(user)).toThrow('Invalid user data: id, username, and role are required');
    });

    it('should throw error for user without username', () => {
      const user = {
        id: 'user-808',
        username: '',
        role: 'player',
      } as UserForToken;

      expect(() => generateToken(user)).toThrow('Invalid user data: id, username, and role are required');
    });

    it('should throw error for user without role', () => {
      const user = {
        id: 'user-909',
        username: 'testuser',
        role: '',
      } as UserForToken;

      expect(() => generateToken(user)).toThrow('Invalid user data: id, username, and role are required');
    });

    it('should throw error for null user', () => {
      expect(() => generateToken(null as any)).toThrow('Invalid user data: id, username, and role are required');
    });

    it('should throw error for undefined user', () => {
      expect(() => generateToken(undefined as any)).toThrow('Invalid user data: id, username, and role are required');
    });

    it('should handle usernames with special characters', () => {
      const user: UserForToken = {
        id: 'user-1010',
        username: 'user_name-123',
        role: 'player',
      };

      const token = generateToken(user);
      const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
      const decoded = jwt.verify(token, secret) as TokenPayload;

      expect(decoded.username).toBe(user.username);
    });

    it('should handle different role values', () => {
      const roles = ['player', 'admin', 'moderator', 'guest'];

      roles.forEach(role => {
        const user: UserForToken = {
          id: `user-${role}`,
          username: 'testuser',
          role: role,
        };

        const token = generateToken(user);
        const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
        const decoded = jwt.verify(token, secret) as TokenPayload;

        expect(decoded.role).toBe(role);
      });
    });

    it('should generate different tokens for different users', () => {
      const user1: UserForToken = {
        id: 'user-1111',
        username: 'user1',
        role: 'player',
      };

      const user2: UserForToken = {
        id: 'user-2222',
        username: 'user2',
        role: 'player',
      };

      const token1 = generateToken(user1);
      const token2 = generateToken(user2);

      expect(token1).not.toBe(token2);
    });

    it('should generate different tokens for the same user at different times', async () => {
      const user: UserForToken = {
        id: 'user-3333',
        username: 'testuser',
        role: 'player',
      };

      const token1 = generateToken(user);
      
      // Wait 1 second to ensure different iat
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const token2 = generateToken(user);

      // Tokens should be different due to different iat timestamps
      expect(token1).not.toBe(token2);
    });
  });

  describe('Integration with jsonwebtoken', () => {
    it('should produce tokens compatible with jwt.verify', () => {
      const user: UserForToken = {
        id: 'user-9999',
        username: 'testuser',
        role: 'player',
      };

      const token = generateToken(user);
      const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production';

      // Verify using jwt directly
      const decoded = jwt.verify(token, secret) as TokenPayload;

      expect(decoded.userId).toBe(user.id);
      expect(decoded.username).toBe(user.username);
      expect(decoded.role).toBe(user.role);
    });

  });
});
