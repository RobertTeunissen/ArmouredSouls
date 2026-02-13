import express, { Response } from 'express';
import bcrypt from 'bcrypt';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { validateStableName, isStableNameUnique, validatePassword } from '../utils/validation';
import prisma from '../lib/prisma';

const router = express.Router();

// Get current user profile
router.get('/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        username: true,
        role: true,
        currency: true,
        prestige: true,
        createdAt: true,
        // Statistics fields
        totalBattles: true,
        totalWins: true,
        highestELO: true,
        championshipTitles: true,
        // Profile fields
        stableName: true,
        profileVisibility: true,
        notificationsBattle: true,
        notificationsLeague: true,
        themePreference: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Handle null stableName - return username as fallback
    const response = {
      ...user,
      stableName: user.stableName || user.username,
    };

    res.json(response);
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's stable statistics (aggregate across all robots)
router.get('/stats', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Get all user's robots with their battle data
    const robots = await prisma.robot.findMany({
      where: { userId },
      select: {
        elo: true,
        totalBattles: true,
        wins: true,
        losses: true,
        draws: true,
        currentLeague: true,
        currentHP: true,
        maxHP: true,
        mainWeapon: true,
      },
    });

    // If no robots, return zeros
    if (robots.length === 0) {
      return res.json({
        totalBattles: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winRate: 0,
        avgELO: 0,
        highestLeague: null,
        totalRobots: 0,
        robotsReady: 0,
      });
    }

    // Calculate robot readiness
    const robotsReady = robots.filter(r => 
      r.currentHP === r.maxHP && r.mainWeapon !== null
    ).length;

    // Calculate aggregate stats
    const totalBattles = robots.reduce((sum, r) => sum + r.totalBattles, 0);
    const wins = robots.reduce((sum, r) => sum + r.wins, 0);
    const losses = robots.reduce((sum, r) => sum + r.losses, 0);
    const draws = robots.reduce((sum, r) => sum + r.draws, 0);
    const winRate = totalBattles > 0 ? (wins / totalBattles) * 100 : 0;
    const avgELO = Math.round(robots.reduce((sum, r) => sum + r.elo, 0) / robots.length);

    // Determine highest league (league hierarchy)
    const leagueHierarchy = [
      'bronze_4', 'bronze_3', 'bronze_2', 'bronze_1',
      'silver_4', 'silver_3', 'silver_2', 'silver_1',
      'gold_4', 'gold_3', 'gold_2', 'gold_1',
      'platinum_4', 'platinum_3', 'platinum_2', 'platinum_1',
      'diamond_4', 'diamond_3', 'diamond_2', 'diamond_1',
      'master', 'grandmaster', 'challenger'
    ];

    const highestLeague = robots
      .map(r => r.currentLeague)
      .filter(league => league !== null)
      .sort((a, b) => {
        const indexA = leagueHierarchy.indexOf(a!);
        const indexB = leagueHierarchy.indexOf(b!);
        return indexB - indexA; // Higher index = higher league
      })[0] || null;

    res.json({
      totalBattles,
      wins,
      losses,
      draws,
      winRate: Math.round(winRate * 10) / 10, // Round to 1 decimal
      avgELO,
      highestLeague,
      totalRobots: robots.length,
      robotsReady,
    });
  } catch (error) {
    console.error('Stats fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
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

    console.log('Profile update request:', { userId, body: req.body });

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
          return res.status(409).json({ error: 'This stable name is already taken' });
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
          return res.status(404).json({ error: 'User not found' });
        }

        const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!validPassword) {
          return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Validate new password
        const passwordValidation = validatePassword(newPassword);
        if (!passwordValidation.valid) {
          validationErrors.newPassword = passwordValidation.error!;
        } else {
          // Hash new password
          hashedPassword = await bcrypt.hash(newPassword, 10);
        }
      }
    }

    // Return validation errors if any
    if (Object.keys(validationErrors).length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationErrors,
      });
    }

    // Build update data object (only include provided fields)
    const updateData: any = {};
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
    if (hashedPassword !== undefined) updateData.passwordHash = hashedPassword;

    console.log('Update data:', updateData);

    // Check if there are any updates
    if (Object.keys(updateData).length === 0) {
      console.log('No updates to apply');
      return res.status(400).json({ error: 'No updates provided' });
    }

    // Update user in database
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        role: true,
        currency: true,
        prestige: true,
        createdAt: true,
        totalBattles: true,
        totalWins: true,
        highestELO: true,
        championshipTitles: true,
        stableName: true,
        profileVisibility: true,
        notificationsBattle: true,
        notificationsLeague: true,
        themePreference: true,
      },
    });

    // Handle null stableName - return username as fallback
    const response = {
      ...updatedUser,
      stableName: updatedUser.stableName || updatedUser.username,
    };

    res.json(response);
  } catch (error) {
    console.error('Profile update error:', error);
    
    // Provide more detailed error information
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
    });
  }
});

export default router;
