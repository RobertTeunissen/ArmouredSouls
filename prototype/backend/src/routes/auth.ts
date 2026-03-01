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
import { Prisma } from '@prisma/client';
import logger from '../config/logger';
import { validateRegistrationRequest } from '../utils/validation';
import { hashPassword } from '../services/passwordService';
import { generateToken } from '../services/jwtService';
import { createUser, findUserByUsername, findUserByEmail, findUserByIdentifier } from '../services/userService';

const router = express.Router();

/**
 * POST /api/auth/register
 *
 * Creates a new user account with the provided username, email, and password.
 * On success, returns a JWT token and the user profile.
 *
 * **Request body:**
 * - `username` (string) — 3–20 alphanumeric / underscore / hyphen characters
 * - `email` (string) — 3–50 alphanumeric / underscore / hyphen characters
 * - `password` (string) — 8–128 characters, no character restrictions
 *
 * **Responses:**
 * - `201 Created` — `{ token, user }` on successful registration
 * - `400 Bad Request` — validation error or duplicate username/email (codes: `VALIDATION_ERROR`, `DUPLICATE_USERNAME`, `DUPLICATE_EMAIL`)
 * - `500 Internal Server Error` — database or unexpected error (codes: `DATABASE_ERROR`, `INTERNAL_ERROR`)
 *
 * @example
 * // Successful registration
 * POST /api/auth/register
 * { "username": "player1", "email": "player1_mail", "password": "securePass1" }
 * // → 201 { token: "eyJ...", user: { id, username, email, currency, prestige, role } }
 *
 * @throws {400} When validation fails, username is taken, or email is already registered
 * @throws {500} When a database error or unexpected error occurs
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;

    // Validate registration request — returns specific 400 for validation failures
    const validation = validateRegistrationRequest({ username, email, password });
    if (!validation.isValid) {
      logger.warn('Registration validation failed', {
        errors: validation.errors,
        username: username || '<missing>',
      });
      return res.status(400).json({ error: validation.errors.join(', '), code: 'VALIDATION_ERROR' });
    }

    // Check for duplicate username
    const existingUsername = await findUserByUsername(username);
    if (existingUsername) {
      logger.warn('Registration rejected: duplicate username', { username });
      return res.status(400).json({ error: 'Username is already taken', code: 'DUPLICATE_USERNAME' });
    }

    // Check for duplicate email
    const existingEmail = await findUserByEmail(email);
    if (existingEmail) {
      logger.warn('Registration rejected: duplicate email', { email });
      return res.status(400).json({ error: 'Email is already registered', code: 'DUPLICATE_EMAIL' });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await createUser({ username, email, passwordHash });

    // Generate JWT token
    const token = generateToken({
      id: String(user.id),
      username: user.username,
      role: user.role,
    });

    logger.info('User registered successfully', { userId: user.id, username: user.username });

    // Return 201 with token and user profile
    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        currency: user.currency,
        prestige: user.prestige,
        role: user.role,
      },
    });
  } catch (error) {
    // Race condition guard: even though we check for duplicates above, a concurrent
    // request could insert the same username/email between our check and the INSERT.
    // Prisma surfaces this as a P2002 unique constraint violation, which we handle
    // identically to the pre-check duplicate rejection.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = (error.meta?.target as string[]) || [];
      // Determine which field caused the conflict from the constraint metadata
      const field = target.includes('email') ? 'Email' : 'Username';
      logger.warn('Registration rejected: duplicate key constraint', {
        code: error.code,
        target,
        message: error.message,
      });
      return res.status(400).json({
        error: field === 'Email' ? 'Email is already registered' : 'Username is already taken',
        code: field === 'Email' ? 'DUPLICATE_EMAIL' : 'DUPLICATE_USERNAME',
      });
    }

    // Database errors: log full details server-side for debugging, but return a
    // generic message to the client to avoid leaking internal schema or connection info.
    if (error instanceof Prisma.PrismaClientKnownRequestError ||
        error instanceof Prisma.PrismaClientUnknownRequestError ||
        error instanceof Prisma.PrismaClientInitializationError) {
      logger.error('Registration database error', {
        errorType: error.constructor.name,
        message: error.message,
        stack: error.stack,
      });
      return res.status(500).json({ error: 'Registration is temporarily unavailable. Please try again in a few minutes.', code: 'DATABASE_ERROR' });
    }

    // Catch-all for truly unexpected errors (e.g. programming bugs, third-party
    // library failures). Same strategy: log everything, reveal nothing to the client.
    logger.error('Registration unexpected error', {
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({ error: 'Something went wrong on our end. Please try again later or contact support if the issue persists.', code: 'INTERNAL_ERROR' });
  }
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
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { identifier, username, password } = req.body;

    // Accept 'identifier' (new) or 'username' (legacy) for backward compatibility
    // with existing clients that haven't migrated to the identifier-based login.
    const loginIdentifier = identifier || username;

    if (!loginIdentifier || !password) {
      return res.status(400).json({ error: 'Identifier and password are required' });
    }

    // Dual-lookup: tries username first, then email (see findUserByIdentifier)
    const user = await findUserByIdentifier(loginIdentifier);

    // Security: use the same generic "Invalid credentials" message for both
    // "user not found" and "wrong password" to prevent user enumeration attacks.
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT with the same payload shape used by the registration endpoint
    // to ensure authentication equivalence (Requirement 8.4).
    const token = generateToken({
      id: String(user.id),
      username: user.username,
      role: user.role,
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
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
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
router.post('/logout', (req: Request, res: Response) => {
  res.json({ message: 'Logged out successfully' });
});

export default router;
