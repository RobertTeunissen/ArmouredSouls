import { generateToken, verifyToken, UserForToken, TokenPayload } from '../src/services/jwtService';
import jwt from 'jsonwebtoken';

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

  describe('verifyToken', () => {
    it('should verify and decode a valid token', () => {
      const user: UserForToken = {
        id: 'user-4444',
        username: 'testuser',
        role: 'player',
      };

      const token = generateToken(user);
      const payload = verifyToken(token);

      expect(payload).not.toBeNull();
      expect(payload!.userId).toBe(user.id);
      expect(payload!.username).toBe(user.username);
      expect(payload!.role).toBe(user.role);
    });

    it('should return null for invalid token', () => {
      const invalidToken = 'invalid.token.here';
      const payload = verifyToken(invalidToken);

      expect(payload).toBeNull();
    });

    it('should return null for empty token', () => {
      const payload = verifyToken('');

      expect(payload).toBeNull();
    });

    it('should return null for token signed with wrong secret', () => {
      const user: UserForToken = {
        id: 'user-5555',
        username: 'testuser',
        role: 'player',
      };

      // Generate token with a different secret
      const wrongSecret = 'wrong-secret-key';
      const token = jwt.sign(
        {
          userId: user.id,
          username: user.username,
          role: user.role,
        },
        wrongSecret,
        { expiresIn: '24h' }
      );

      const payload = verifyToken(token);

      expect(payload).toBeNull();
    });

    it('should return null for expired token', () => {
      const user: UserForToken = {
        id: 'user-6666',
        username: 'testuser',
        role: 'player',
      };

      // Generate token that expires immediately
      const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
      const token = jwt.sign(
        {
          userId: user.id,
          username: user.username,
          role: user.role,
        },
        secret,
        { expiresIn: '0s' }
      );

      // Wait a tiny bit to ensure expiration
      setTimeout(() => {
        const payload = verifyToken(token);
        expect(payload).toBeNull();
      }, 100);
    });

    it('should return payload with all expected fields', () => {
      const user: UserForToken = {
        id: 'user-7777',
        username: 'testuser',
        role: 'player',
      };

      const token = generateToken(user);
      const payload = verifyToken(token);

      expect(payload).not.toBeNull();
      expect(payload!.userId).toBeDefined();
      expect(payload!.username).toBeDefined();
      expect(payload!.role).toBeDefined();
      expect(payload!.iat).toBeDefined();
      expect(payload!.exp).toBeDefined();
    });

    it('should verify tokens created by jwt.sign directly', () => {
      const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
      const token = jwt.sign(
        {
          userId: 'user-8888',
          username: 'directuser',
          role: 'admin',
        },
        secret,
        { expiresIn: '24h' }
      );

      const payload = verifyToken(token);

      expect(payload).not.toBeNull();
      expect(payload!.userId).toBe('user-8888');
      expect(payload!.username).toBe('directuser');
      expect(payload!.role).toBe('admin');
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

    it('should verify tokens created by jwt.sign', () => {
      const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
      const token = jwt.sign(
        {
          userId: 'user-10000',
          username: 'jwtuser',
          role: 'player',
        },
        secret,
        { expiresIn: '24h' }
      );

      const payload = verifyToken(token);

      expect(payload).not.toBeNull();
      expect(payload!.userId).toBe('user-10000');
      expect(payload!.username).toBe('jwtuser');
      expect(payload!.role).toBe('player');
    });
  });
});
