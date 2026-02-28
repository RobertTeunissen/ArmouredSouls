import prisma from '../lib/prisma';

/**
 * User Service
 *
 * Handles user account creation and retrieval operations.
 * Uses Prisma for database interactions with the User model.
 *
 * @module services/userService
 */

/**
 * Data required to create a new user account
 */
export interface CreateUserData {
  username: string;
  email: string;
  passwordHash: string;
}

/**
 * User object returned from service operations
 */
export interface User {
  id: number;
  username: string;
  email: string | null;
  passwordHash: string;
  currency: number;
  prestige: number;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create a new user account in the database.
 *
 * Inserts a user with the provided username, email, and password hash.
 * Default values for currency, prestige, and role are applied by the database schema:
 * - currency: 3000000
 * - prestige: 0
 * - role: "user"
 *
 * @param userData - The user data containing username, email, and passwordHash
 * @returns The created User object with all fields including defaults
 * @throws {Prisma.PrismaClientKnownRequestError} If a unique constraint is violated (duplicate username or email)
 * @throws {Error} If the database connection fails or the insert is rejected
 *
 * @example
 * const user = await createUser({
 *   username: 'player1',
 *   email: 'player1_mail',
 *   passwordHash: '$2b$10$...',
 * });
 * console.log(user.currency); // 3000000
 * console.log(user.prestige); // 0
 * console.log(user.role);     // "user"
 *
 * Requirements: 1.1, 1.6, 1.7, 1.8
 */
export async function createUser(userData: CreateUserData): Promise<User> {
  const user = await prisma.user.create({
    data: {
      username: userData.username,
      email: userData.email,
      passwordHash: userData.passwordHash,
    },
  });

  return user;
}

/**
 * Find a user by their username.
 *
 * Queries the database for a user with the given username.
 *
 * @param username - The username to search for (case-sensitive)
 * @returns The User object if found, or null if no user exists with that username
 *
 * @example
 * const user = await findUserByUsername('player1');
 * if (user) {
 *   console.log(user.email);
 * }
 *
 * Requirements: 6.1
 */
export async function findUserByUsername(username: string): Promise<User | null> {
  const user = await prisma.user.findUnique({
    where: { username },
  });

  return user;
}


/**
 * Find a user by their email address.
 *
 * Queries the database for a user with the given email.
 *
 * @param email - The email address to search for (case-sensitive)
 * @returns The User object if found, or null if no user exists with that email
 *
 * @example
 * const user = await findUserByEmail('player1_mail');
 *
 * Requirements: 6.2
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  return user;
}


/**
 * Find a user by a login identifier (username or email).
 *
 * Attempts to find the user by username first. If no match is found,
 * falls back to searching by email. This supports the dual login
 * requirement where users can authenticate with either credential.
 *
 * @param identifier - A username or email address to search for
 * @returns The User object if found by username or email, or null if not found by either
 *
 * @example
 * // Works with username
 * const user1 = await findUserByIdentifier('player1');
 *
 * // Also works with email
 * const user2 = await findUserByIdentifier('player1_mail');
 *
 * Requirements: 6.1, 6.2, 6.6
 */
export async function findUserByIdentifier(identifier: string): Promise<User | null> {
  // Username lookup first because it's the more common login path and avoids
  // an unnecessary second query in the majority of cases.
  const user = await findUserByUsername(identifier);
  if (user) {
    return user;
  }

  // Fall back to email lookup only when username lookup yields no result.
  // This ordering means a user whose email happens to match another user's
  // username will always resolve to the username-holder — an acceptable
  // trade-off given the simplified email format used in this game system.
  return findUserByEmail(identifier);
}

