import express, { Response } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validateStableName, isStableNameUnique, validatePassword } from '../utils/validation';
import prisma from '../lib/prisma';
import { AuthError, AuthErrorCode } from '../errors/authErrors';
import { AppError } from '../errors/AppError';
import { validateRequest } from '../middleware/schemaValidator';
import { stableName as stableNameSchema } from '../utils/securityValidation';
import { generateToken } from '../services/auth/jwtService';
import { hashPassword } from '../services/auth/passwordService';
import { getUserProfile, getStableStats } from '../services/auth/userProfileService';
import type { Prisma } from '../../generated/prisma';

const router = express.Router();

// --- Zod schemas for user routes ---

// Every message here is user-facing: `validateRequest` builds the response's `error`
// string from the failing issues, and this schema runs in front of the handler's own
// checks. The wording matches `validateStableName` / `validatePassword` in
// `utils/validation.ts` and the handler's enum messages below, so a player sees the
// same sentence whichever layer rejects the request.
const profileUpdateBodySchema = z.object({
  stableName: stableNameSchema.optional(),
  profileVisibility: z
    .enum(['public', 'private'], { message: "Profile visibility must be 'public' or 'private'" })
    .optional(),
  notificationsBattle: z.boolean().optional(),
  notificationsLeague: z.boolean().optional(),
  themePreference: z
    .enum(['dark', 'light', 'auto'], { message: "Theme must be 'dark', 'light', or 'auto'" })
    .optional(),
  currentPassword: z
    .string()
    .min(1, 'Current password is required to change password')
    .max(128, 'Current password must be 128 characters or less')
    .optional(),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be 128 characters or less')
    .optional(),
});

// Get current user profile
router.get('/profile', authenticateToken, validateRequest({}), async (req: AuthRequest, res: Response) => {
  const profile = await getUserProfile(req.user!.userId);
  res.json(profile);
});

// Get user's stable statistics (aggregate across all robots)
router.get('/stats', authenticateToken, validateRequest({}), async (req: AuthRequest, res: Response) => {
  const stats = await getStableStats(req.user!.userId);
  res.json(stats);
});

// Update user profile
router.put('/profile', authenticateToken, validateRequest({ body: profileUpdateBodySchema }), async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const {
    stableName,
    profileVisibility,
    notificationsBattle,
    notificationsLeague,
    themePreference,
    currentPassword,
    newPassword,
  } = req.body;

  // Validation errors object
  const validationErrors: Record<string, string> = {};

  // Validate stableName if provided
  if (stableName !== undefined) {
    const stableNameValidation = validateStableName(stableName);
    if (!stableNameValidation.valid) {
      validationErrors.stableName = stableNameValidation.error!;
    } else {
      // Check uniqueness
      const isUnique = await isStableNameUnique(stableName, userId);
      if (!isUnique) {
        throw new AppError('DUPLICATE_STABLE_NAME', 'This stable name is already taken', 409);
      }
    }
  }

  // Validate profileVisibility if provided
  if (profileVisibility !== undefined) {
    if (profileVisibility !== 'public' && profileVisibility !== 'private') {
      validationErrors.profileVisibility = "Profile visibility must be 'public' or 'private'";
    }
  }

  // Validate themePreference if provided
  if (themePreference !== undefined) {
    if (themePreference !== 'dark' && themePreference !== 'light' && themePreference !== 'auto') {
      validationErrors.themePreference = "Theme must be 'dark', 'light', or 'auto'";
    }
  }

  // Handle password change
  let hashedPassword: string | undefined;
  if (newPassword !== undefined) {
    // Require current password for password change
    if (!currentPassword) {
      validationErrors.currentPassword = 'Current password is required to change password';
    } else {
      // Verify current password
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true },
      });

      if (!user) {
        throw new AuthError(AuthErrorCode.USER_NOT_FOUND, 'User not found', 404);
      }

      const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!validPassword) {
        throw new AuthError(AuthErrorCode.INVALID_CREDENTIALS, 'Current password is incorrect', 401);
      }

      // Validate new password
      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.valid) {
        validationErrors.newPassword = passwordValidation.error!;
      } else {
        // Hash new password using centralized service (respects BCRYPT_SALT_ROUNDS env var)
        hashedPassword = await hashPassword(newPassword);
      }
    }
  }

  // Return validation errors if any.
  //
  // Spec #51: `details` carries a `fields` array, matching what `validateRequest`
  // emits, and `error` carries the joined messages. This endpoint previously had a
  // third shape all of its own — `details.errors` keyed by field name, with a fixed
  // `'Validation failed'` message. `ProfilePage.tsx` assigned `data.details` straight
  // into a `Record<field, message>`, so it received `{ errors: { ... } }`, rendered
  // no message under any field, and skipped the generic banner too because
  // `data.details` was truthy. A profile validation error showed the player nothing.
  const failedFields = Object.entries(validationErrors);
  if (failedFields.length > 0) {
    throw new AppError(
      'VALIDATION_ERROR',
      failedFields.map(([, message]) => message).join(', '),
      400,
      { fields: failedFields.map(([field, message]) => ({ field, message })) },
    );
  }

  // Build update data object (only include provided fields)
  const updateData: Prisma.UserUpdateInput = {};
  // Only include stableName if it's explicitly provided and not an empty string
  if (stableName !== undefined && stableName !== null) {
    // Trim whitespace and only update if non-empty
    const trimmedName = stableName.trim();
    if (trimmedName.length > 0) {
      updateData.stableName = trimmedName;
    } else {
      // Allow clearing stable name by setting to null
      updateData.stableName = null;
    }
  }
  if (profileVisibility !== undefined) updateData.profileVisibility = profileVisibility;
  if (notificationsBattle !== undefined) updateData.notificationsBattle = notificationsBattle;
  if (notificationsLeague !== undefined) updateData.notificationsLeague = notificationsLeague;
  if (themePreference !== undefined) updateData.themePreference = themePreference;
  if (hashedPassword !== undefined) {
    updateData.passwordHash = hashedPassword;
    // Increment tokenVersion to invalidate all existing JWTs on password change
    updateData.tokenVersion = { increment: 1 };
  }

  // Check if there are any updates
  if (Object.keys(updateData).length === 0) {
    throw new AppError('VALIDATION_ERROR', 'No updates provided', 400);
  }

  // Update user in database
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      currency: true,
      prestige: true,
      createdAt: true,
      stableName: true,
      profileVisibility: true,
      notificationsBattle: true,
      notificationsLeague: true,
      themePreference: true,
      tokenVersion: true,
    },
  });

  // Handle null stableName - return username as fallback
  const response: Record<string, unknown> = {
    ...updatedUser,
    stableName: updatedUser.stableName || updatedUser.username,
  };

  // Issue a new token with the updated tokenVersion when password was changed
  if (hashedPassword !== undefined) {
    response.token = generateToken({
      id: String(updatedUser.id),
      username: updatedUser.username,
      role: updatedUser.role,
      tokenVersion: updatedUser.tokenVersion,
    });
  }

  res.json(response);
});

export default router;
