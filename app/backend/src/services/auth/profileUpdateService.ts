/**
 * `PUT /api/user/profile`: validate and apply a profile change (stable name,
 * visibility, notifications, theme, password). A password change verifies the
 * current password, bumps `tokenVersion` (signing out every other session) and
 * returns a fresh token. Moved out of `routes/user.ts`; behaviour, messages and
 * the response shape are unchanged.
 */
import bcrypt from 'bcrypt';
import prisma from '../../lib/prisma';
import type { Prisma } from '../../../generated/prisma';
import { AuthError, AuthErrorCode } from '../../errors/authErrors';
import { AppError } from '../../errors/AppError';
import { validateStableName, isStableNameUnique, validatePassword } from '../../utils/validation';
import { generateToken } from './jwtService';
import { hashPassword } from './passwordService';

export interface ProfileUpdateInput {
  stableName?: string;
  stableNote?: string;
  profileVisibility?: 'public' | 'private';
  notificationsBattle?: boolean;
  notificationsLeague?: boolean;
  themePreference?: 'dark' | 'light' | 'auto';
  currentPassword?: string;
  newPassword?: string;
}

export async function updateUserProfile(userId: number, input: ProfileUpdateInput): Promise<Record<string, unknown>> {
  const {
    stableName,
    stableNote,
    profileVisibility,
    notificationsBattle,
    notificationsLeague,
    themePreference,
    currentPassword,
    newPassword,
  } = input;

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

  // Validate stableNote if provided
  if (stableNote !== undefined) {
    const trimmedNote = stableNote.trim();
    if (trimmedNote.length > 2000) {
      validationErrors.stableNote = 'Stable note must be 2000 characters or less';
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
  if (stableNote !== undefined) {
    const trimmedNote = stableNote.trim();
    updateData.stableNote = trimmedNote.length > 0 ? trimmedNote : null;
  }
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
      stableNote: true,
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

  return response;
}
