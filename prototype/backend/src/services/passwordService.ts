import bcrypt from 'bcrypt';

/**
 * @module services/passwordService
 *
 * Handles password hashing and verification using bcrypt.
 * Salt rounds are configurable via the `BCRYPT_SALT_ROUNDS` environment variable
 * (default: 10, valid range: 4–31).
 */

/**
 * Get the bcrypt salt rounds from the `BCRYPT_SALT_ROUNDS` environment variable.
 * Falls back to 10 if the variable is unset or outside the valid range (4–31).
 *
 * @returns The number of salt rounds to use for bcrypt hashing
 */
function getSaltRounds(): number {
  const saltRounds = process.env.BCRYPT_SALT_ROUNDS 
    ? parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) 
    : 10;
  
  // bcrypt salt rounds control the computational cost of hashing. Values below 4
  // are too fast to resist brute-force; values above 31 cause extreme latency.
  // Default of 10 provides ~100ms hash time on modern hardware — a good balance
  // between security and user-facing response time.
  if (isNaN(saltRounds) || saltRounds < 4 || saltRounds > 31) {
    console.warn(`Invalid BCRYPT_SALT_ROUNDS value, using default of 10`);
    return 10;
  }
  
  return saltRounds;
}

/**
 * Hash a plaintext password using bcrypt.
 *
 * The number of salt rounds is determined by the `BCRYPT_SALT_ROUNDS` environment
 * variable (default 10). The returned hash is a standard bcrypt string that starts
 * with `$2b$`.
 *
 * @param password - The plaintext password to hash (must be non-empty)
 * @returns A bcrypt hash string
 * @throws {Error} If `password` is empty or falsy
 * @throws {Error} If bcrypt hashing fails internally
 *
 * @example
 * const hash = await hashPassword('mySecurePassword');
 * // hash → "$2b$10$..."
 */
export async function hashPassword(password: string): Promise<string> {
  // Guard against empty passwords early — bcrypt would hash an empty string
  // successfully, which could create accounts with no real password protection.
  if (!password || password.length === 0) {
    throw new Error('Password cannot be empty');
  }

  const saltRounds = getSaltRounds();
  // bcrypt.hash generates a unique salt per call, so identical passwords
  // produce different hashes — preventing rainbow table attacks.
  const hash = await bcrypt.hash(password, saltRounds);
  return hash;
}

/**
 * Verify a plaintext password against a bcrypt hash.
 *
 * Returns `false` (rather than throwing) when either argument is falsy,
 * making it safe to call without pre-checking for null/undefined values.
 *
 * @param password - The plaintext password to verify
 * @param hash - The bcrypt hash to compare against
 * @returns `true` if the password matches the hash, `false` otherwise
 *
 * @example
 * const hash = await hashPassword('secret');
 * await verifyPassword('secret', hash);  // true
 * await verifyPassword('wrong', hash);   // false
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // Return false instead of throwing when inputs are missing, so callers
  // don't need to null-check before calling — simplifies auth flow logic.
  if (!password || !hash) {
    return false;
  }

  return await bcrypt.compare(password, hash);
}
