/**
 * @module routes/auth
 *
 * Express router for authentication endpoints: registration, login, and logout.
 * Handles input validation, duplicate checking, password hashing, JWT generation,
 * and structured error responses for the user registration module.
 *
 * @see {@link ../services/userService} for user CRUD operations
 * @see {@link ../services/passwordService} for bcrypt hashing
 * @see {@link ../services/jwtService} for JWT token generation
 * @see {@link ../utils/validation} for input validation rules
 */
import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import logger from '../config/logger';
import { validateRegistrationRequest } from '../utils/validation';
import { hashPassword } from '../services/auth/passwordService';
import { generateToken } from '../services/auth/jwtService';
import { createUser, findUserByUsername, findUserByEmail, findUserByIdentifier, findUserByStableName } from '../services/auth/userService';
import { initializeTutorialState } from '../services/onboarding/onboardingService';
import { AuthError, AuthErrorCode } from '../errors/authErrors';
import { AppError } from '../errors/AppError';
import { validateRequest } from '../middleware/schemaValidator';
import { stableName as stableNameSchema } from '../utils/securityValidation';
import prisma from '../lib/prisma';

const router = express.Router();

// --- Zod schemas for auth routes ---

const registerBodySchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  email: z.string().min(3).max(50),
  password: z.string().min(8).max(128),
  stableName: stableNameSchema,
});

const loginBodySchema = z.object({
  identifier: z.string().min(1).max(50).optional(),
  username: z.string().min(1).max(50).optional(),
  password: z.string().min(1).max(128),
});

/**
 * POST /api/auth/register
 *
 * Creates a new user account with the provided username, email, password, and stable name.
 * On success, returns a JWT token and the user profile.
 *
 * **Request body:**
 * - `username` (string) — 3–20 alphanumeric / underscore / hyphen characters
 * - `email` (string) — 3–50 alphanumeric / underscore / hyphen characters
 * - `password` (string) — 8–128 characters, no character restrictions
 * - `stableName` (string) — 3–30 characters, public display name (no usernames shown in-game)
 *
 * **Responses:**
 * - `201 Created` — `{ token, user }` on successful registration
 * - `400 Bad Request` — validation error or duplicate username/email/stableName (codes: `VALIDATION_ERROR`, `DUPLICATE_USERNAME`, `DUPLICATE_EMAIL`, `DUPLICATE_STABLE_NAME`)
 * - `500 Internal Server Error` — database or unexpected error (codes: `DATABASE_ERROR`, `INTERNAL_ERROR`)
 *
 * @example
 * // Successful registration
 * POST /api/auth/register
 * { "username": "player1", "email": "player1_mail", "password": "securePass1", "stableName": "Iron Warriors" }
 * // → 201 { token: "eyJ...", user: { id, username, email, stableName, currency, prestige, role } }
 *
 * @throws {400} When validation fails, username is taken, email is already registered, or stable name is taken
 * @throws {500} When a database error or unexpected error occurs
 */
router.post('/register', validateRequest({ body: registerBodySchema }), async (req: Request, res: Response) => {
  const { username, email, password, stableName } = req.body;

  // Validate registration request — throws AppError for validation failures
  const validation = validateRegistrationRequest({ username, email, password, stableName });
  if (!validation.isValid) {
    logger.warn('Registration validation failed', {
      errors: validation.errors,
      username: username || '<missing>',
    });
    throw new AppError('VALIDATION_ERROR', validation.errors.join(', '), 400, { errors: validation.errors });
  }

  // Check for duplicate username
  const existingUsername = await findUserByUsername(username);
  if (existingUsername) {
    logger.warn('Registration rejected: duplicate username', { username });
    throw new AuthError(AuthErrorCode.USER_ALREADY_EXISTS, 'Username is already taken', 409);
  }

  // Check for duplicate email
  const existingEmail = await findUserByEmail(email);
  if (existingEmail) {
    logger.warn('Registration rejected: duplicate email', { email });
    throw new AuthError(AuthErrorCode.EMAIL_ALREADY_EXISTS, 'Email is already registered', 409);
  }

  // Check for duplicate stable name
  const existingStableName = await findUserByStableName(stableName);
  if (existingStableName) {
    logger.warn('Registration rejected: duplicate stable name', { stableName });
    throw new AppError('DUPLICATE_STABLE_NAME', 'Stable name is already taken', 409);
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user - Prisma P2002 errors (race condition duplicates) will propagate
  // to the errorHandler middleware which maps them to 409 DATABASE_UNIQUE_VIOLATION
  const user = await createUser({ username, email, passwordHash, stableName });

  // Initialize onboarding state for the new user.
  // Non-blocking: registration succeeds even if onboarding init fails.
  try {
    await initializeTutorialState(user.id);
  } catch (onboardingError) {
    logger.error('Failed to initialize onboarding state', {
      userId: user.id,
      error: onboardingError instanceof Error ? onboardingError.message : String(onboardingError),
    });
  }

  // Generate JWT token
  const token = generateToken({
    id: String(user.id),
    username: user.username,
    role: user.role,
    tokenVersion: user.tokenVersion ?? 0,
  });

  logger.info('User registered successfully', { userId: user.id, username: user.username, stableName: user.stableName });

  // Return 201 with token and user profile
  res.status(201).json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      stableName: user.stableName,
      currency: user.currency,
      prestige: user.prestige,
      role: user.role,
    },
  });
});

/**
 * POST /api/auth/login
 *
 * Authenticates a user with a login identifier (username or email) and password.
 * The `identifier` field is tried as a username first; if no match is found it is
 * tried as an email. The legacy `username` field is accepted for backward compatibility.
 *
 * **Request body:**
 * - `identifier` (string) — username or email address
 * - `password` (string) — the user's password
 * - `username` (string, optional) — legacy field, used when `identifier` is absent
 *
 * **Responses:**
 * - `200 OK` — `{ token, user }` on successful authentication
 * - `400 Bad Request` — missing identifier or password
 * - `401 Unauthorized` — invalid credentials (generic message for security)
 * - `500 Internal Server Error` — unexpected server error
 *
 * @example
 * // Login with username
 * POST /api/auth/login
 * { "identifier": "player1", "password": "securePass1" }
 * // → 200 { token: "eyJ...", user: { id, username, email, role, currency, prestige } }
 *
 * @example
 * // Login with email
 * POST /api/auth/login
 * { "identifier": "player1_mail", "password": "securePass1" }
 * // → 200 { token: "eyJ...", user: { ... } }
 *
 * @throws {400} When identifier or password is missing
 * @throws {401} When credentials are invalid
 * @throws {500} When an unexpected error occurs
 */
router.post('/login', validateRequest({ body: loginBodySchema }), async (req: Request, res: Response) => {
  const { identifier, username, password } = req.body;

  // Accept 'identifier' (new) or 'username' (legacy) for backward compatibility
  // with existing clients that haven't migrated to the identifier-based login.
  const loginIdentifier = identifier || username;

  if (!loginIdentifier || !password) {
    throw new AppError('VALIDATION_ERROR', 'Identifier and password are required', 400);
  }

  // Dual-lookup: tries username first, then email (see findUserByIdentifier)
  const user = await findUserByIdentifier(loginIdentifier);

  // Security: use the same generic "Invalid credentials" message for both
  // "user not found" and "wrong password" to prevent user enumeration attacks.
  if (!user) {
    throw new AuthError(AuthErrorCode.INVALID_CREDENTIALS, 'Invalid credentials', 401);
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    throw new AuthError(AuthErrorCode.INVALID_CREDENTIALS, 'Invalid credentials', 401);
  }

  // Generate JWT with the same payload shape used by the registration endpoint
  // to ensure authentication equivalence (Requirement 8.4).
  const token = generateToken({
    id: String(user.id),
    username: user.username,
    role: user.role,
    tokenVersion: user.tokenVersion ?? 0,
  });

  // Fire-and-forget lastLoginAt update
  prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch((err) => {
    logger.error('Failed to update lastLoginAt', { userId: user.id, error: err instanceof Error ? err.message : String(err) });
  });

  // Return user profile without passwordHash — never expose hashes to clients
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      currency: user.currency,
      prestige: user.prestige,
    },
  });
});

/**
 * POST /api/auth/logout
 *
 * Logs the user out. Token invalidation is handled client-side (token removal).
 * This endpoint exists as a conventional hook for future server-side session cleanup.
 *
 * **Responses:**
 * - `200 OK` — `{ message: "Logged out successfully" }`
 */
router.post('/logout', validateRequest({}), (req: Request, res: Response) => {
  res.json({ message: 'Logged out successfully' });
});

export default router;
