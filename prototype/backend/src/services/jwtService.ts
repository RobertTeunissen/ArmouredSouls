import jwt from 'jsonwebtoken';

/**
 * @module services/jwtService
 *
 * Handles JWT token generation and verification.
 * Uses `JWT_SECRET` from environment variable and configurable expiration
 * via `JWT_EXPIRATION` (default: `'24h'`).
 */

/**
 * Token payload interface matching the design specification
 */
export interface TokenPayload {
  userId: string;
  username: string;
  role: string;
  iat?: number;
  exp?: number;
}

/**
 * User data interface for token generation
 */
export interface UserForToken {
  id: string;
  username: string;
  role: string;
}

/**
 * Get the JWT secret from the `JWT_SECRET` environment variable.
 *
 * @returns The JWT secret key string
 * @throws {Error} If `JWT_SECRET` is not set and `NODE_ENV` is `'production'`
 */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  
  // In production, a missing secret is a critical misconfiguration that would
  // allow tokens signed with the default value to be forged. Fail hard.
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set in production environment');
    }
    // In development, fall back to a known default so the app starts without
    // requiring env setup. This value must never be used in production.
    console.warn('JWT_SECRET not set, using default (not suitable for production)');
    return 'dev-secret-change-in-production';
  }
  
  return secret;
}

/**
 * Get the JWT expiration time from the `JWT_EXPIRATION` environment variable.
 *
 * @returns A time-span string (e.g. `'24h'`, `'7d'`) or a number in seconds
 */
function getJwtExpiration(): string | number {
  return process.env.JWT_EXPIRATION || '24h';
}

/**
 * Generate a signed JWT token for a user.
 *
 * The token payload includes `userId`, `username`, and `role`.
 * Expiration is controlled by the `JWT_EXPIRATION` environment variable (default `'24h'`).
 *
 * @param user - The user object containing `id`, `username`, and `role`
 * @returns A signed JWT token string
 * @throws {Error} If any of `user.id`, `user.username`, or `user.role` is missing
 * @throws {Error} If `JWT_SECRET` is not set in production
 *
 * @example
 * const token = generateToken({
 *   id: '42',
 *   username: 'john_doe',
 *   role: 'player',
 * });
 * // token → "eyJhbGciOiJIUzI1NiIs..."
 */
export function generateToken(user: UserForToken): string {
  if (!user || !user.id || !user.username || !user.role) {
    throw new Error('Invalid user data: id, username, and role are required');
  }

  const secret = getJwtSecret();
  const expiration = getJwtExpiration();

  const payload: TokenPayload = {
    userId: user.id,
    username: user.username,
    role: user.role,
  };

  const token = jwt.sign(payload, secret, { expiresIn: expiration as any });
  return token;
}

/**
 * Verify and decode a JWT token.
 *
 * Returns `null` (rather than throwing) when the token is invalid, expired,
 * or falsy, making it safe to call without pre-checking.
 *
 * @param token - The JWT token string to verify
 * @returns The decoded {@link TokenPayload} if valid, or `null` if invalid/expired
 *
 * @example
 * const payload = verifyToken(token);
 * if (payload) {
 *   console.log('Authenticated user:', payload.userId);
 * }
 */
export function verifyToken(token: string): TokenPayload | null {
  if (!token) {
    return null;
  }

  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret) as TokenPayload;
    return decoded;
  } catch (error) {
    // Swallow verification errors (expired, malformed, bad signature) and
    // return null so callers can treat invalid tokens as "not authenticated"
    // without needing try/catch at every call site.
    return null;
  }
}
