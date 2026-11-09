import express, { Response } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validateRequest, validated } from '../middleware/schemaValidator';
import { stableName as stableNameSchema } from '../utils/securityValidation';
import { getUserProfile, getStableStats } from '../services/auth/userProfileService';
import { updateUserProfile } from '../services/auth/profileUpdateService';

const router = express.Router();

// --- Zod schemas for user routes ---

// Every message here is user-facing: `validateRequest` builds the response's `error`
// string from the failing issues, and this schema runs in front of `updateUserProfile`'s own
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
router.put('/profile', authenticateToken, ...validated({ body: profileUpdateBodySchema }, async (req: AuthRequest, res: Response, { body }) => {
  res.json(await updateUserProfile(req.user!.userId, body));
}));

export default router;
