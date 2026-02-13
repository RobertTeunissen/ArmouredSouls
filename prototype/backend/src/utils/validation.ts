// Profile validation utilities for user input

import prisma from '../lib/prisma';

/**
 * Basic profanity word list for stable name filtering
 * Production systems should use more sophisticated filtering libraries
 */
const PROFANITY_LIST = [
  'damn',
  'hell',
  'crap',
  'shit',
  'fuck',
  'bitch',
  'ass',
  'bastard',
  'dick',
  'cock',
  'pussy',
  'whore',
  'slut',
  'fag',
  'nigger',
  'nigga',
  'retard',
  'rape',
  'nazi',
  'hitler',
];

/**
 * Validate stable name format and content
 * Requirements: 1.4, 1.5, 1.7
 */
export function validateStableName(name: string): { valid: boolean; error?: string } {
  // Check length (3-30 characters)
  if (name.length < 3) {
    return { valid: false, error: 'Stable name must be at least 3 characters' };
  }
  if (name.length > 30) {
    return { valid: false, error: 'Stable name must be 30 characters or less' };
  }

  // Check allowed characters (alphanumeric + spaces, hyphens, underscores)
  const validCharPattern = /^[a-zA-Z0-9 _-]+$/;
  if (!validCharPattern.test(name)) {
    return {
      valid: false,
      error: 'Stable name can only contain letters, numbers, spaces, hyphens, and underscores',
    };
  }

  // Check for profanity
  if (containsProfanity(name)) {
    return { valid: false, error: 'Stable name contains inappropriate content' };
  }

  return { valid: true };
}

/**
 * Check if stable name is unique in the database
 * Excludes the current user from the uniqueness check
 * Requirements: 1.6
 */
export async function isStableNameUnique(name: string, userId: number): Promise<boolean> {
  const existingUser = await prisma.user.findFirst({
    where: {
      stableName: name,
      NOT: {
        id: userId,
      },
    },
  });

  return existingUser === null;
}

/**
 * Validate password strength
 * Requirements: 3.3, 3.4, 3.5, 3.6
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  // Check minimum length (8 characters)
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }

  // Check for at least one uppercase letter
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }

  // Check for at least one lowercase letter
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }

  // Check for at least one number
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }

  return { valid: true };
}

/**
 * Basic profanity filter using word list
 * Checks if text contains any prohibited words (case-insensitive)
 * Requirements: 1.7
 */
export function containsProfanity(text: string): boolean {
  const lowerText = text.toLowerCase();
  return PROFANITY_LIST.some((word) => lowerText.includes(word));
}
