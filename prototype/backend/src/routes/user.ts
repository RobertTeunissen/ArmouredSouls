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
        email: true,
        role: true,
        currency: true,
        prestige: true,
        createdAt: true,
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

// Helper function to get prestige rank title
function getPrestigeRank(prestige: number): string {
  if (prestige < 1000) return "Novice";
  if (prestige < 5000) return "Established";
  if (prestige < 10000) return "Veteran";
  if (prestige < 25000) return "Elite";
  if (prestige < 50000) return "Champion";
  return "Legendary";
}

// Get user's stable statistics (aggregate across all robots)
router.get('/stats', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Get user data including prestige
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { prestige: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get all user's robots with their battle data
    const robots = await prisma.robot.findMany({
      where: { userId },
      select: {
        id: true,
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

    // Get user's tag teams for highest tag team league
    const tagTeams = await prisma.tagTeam.findMany({
      where: { stableId: userId },
      select: {
        tagTeamLeague: true,
      },
    });

    // Get latest cycle snapshot for comparison data
    const latestSnapshot = await prisma.cycleSnapshot.findFirst({
      orderBy: { cycleNumber: 'desc' },
      select: { cycleNumber: true },
    });

    let cycleChanges = null;
    if (latestSnapshot && latestSnapshot.cycleNumber > 1) {
      // Get current and previous cycle snapshots
      const [currentSnapshot, previousSnapshot] = await Promise.all([
        prisma.cycleSnapshot.findUnique({
          where: { cycleNumber: latestSnapshot.cycleNumber },
          select: { stableMetrics: true, robotMetrics: true },
        }),
        prisma.cycleSnapshot.findUnique({
          where: { cycleNumber: latestSnapshot.cycleNumber - 1 },
          select: { stableMetrics: true, robotMetrics: true },
        }),
      ]);

      if (currentSnapshot && previousSnapshot) {
        // Extract user's metrics from snapshots
        const currentStableMetrics = (currentSnapshot.stableMetrics as any[]).find(
          (m: any) => m.userId === userId
        );
        const previousStableMetrics = (previousSnapshot.stableMetrics as any[]).find(
          (m: any) => m.userId === userId
        );

        // Get robot IDs for this user
        const robotIds = robots.map(r => r.id);

        // Calculate aggregate robot stats from snapshots
        const currentRobotMetrics = (currentSnapshot.robotMetrics as any[]).filter(
          (m: any) => robotIds.includes(m.robotId)
        );
        const previousRobotMetrics = (previousSnapshot.robotMetrics as any[]).filter(
          (m: any) => robotIds.includes(m.robotId)
        );

        const currentWins = currentRobotMetrics.reduce((sum: number, m: any) => sum + (m.wins || 0), 0);
        const currentLosses = currentRobotMetrics.reduce((sum: number, m: any) => sum + (m.losses || 0), 0);
        const previousWins = previousRobotMetrics.reduce((sum: number, m: any) => sum + (m.wins || 0), 0);
        const previousLosses = previousRobotMetrics.reduce((sum: number, m: any) => sum + (m.losses || 0), 0);

        // Get highest ELO change - compare current highest with previous highest
        const currentHighestElo = robots.length > 0 ? Math.max(...robots.map(r => r.elo)) : 0;
        
        // For previous highest ELO, we need to reconstruct it from the ELO changes in the snapshot
        let previousHighestElo = currentHighestElo;
        if (previousRobotMetrics.length > 0) {
          // Find the robot with current highest ELO and get its previous value
          const highestEloRobot = robots.find(r => r.elo === currentHighestElo);
          if (highestEloRobot) {
            const robotMetric = currentRobotMetrics.find((m: any) => m.robotId === highestEloRobot.id);
            if (robotMetric && robotMetric.eloChange !== undefined) {
              previousHighestElo = currentHighestElo - robotMetric.eloChange;
            }
          }
        }

        cycleChanges = {
          prestige: currentStableMetrics?.totalPrestigeEarned || 0,
          wins: currentWins - previousWins,
          losses: currentLosses - previousLosses,
          highestElo: currentHighestElo - previousHighestElo,
        };
      }
    }

    // If no robots, return zeros
    if (robots.length === 0) {
      return res.json({
        totalBattles: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winRate: 0,
        highestELO: 0,
        highestLeague: null,
        highestTagTeamLeague: null,
        totalRobots: 0,
        prestige: user.prestige,
        prestigeRank: getPrestigeRank(user.prestige),
        cycleChanges,
      });
    }

    // Calculate aggregate stats
    const totalBattles = robots.reduce((sum, r) => sum + r.totalBattles, 0);
    const wins = robots.reduce((sum, r) => sum + r.wins, 0);
    const losses = robots.reduce((sum, r) => sum + r.losses, 0);
    const draws = robots.reduce((sum, r) => sum + r.draws, 0);
    const winRate = totalBattles > 0 ? (wins / totalBattles) * 100 : 0;
    const highestELO = Math.max(...robots.map(r => r.elo));

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

    // Determine highest tag team league
    const highestTagTeamLeague = tagTeams.length > 0
      ? tagTeams
          .map(t => t.tagTeamLeague)
          .sort((a, b) => {
            const indexA = leagueHierarchy.indexOf(a);
            const indexB = leagueHierarchy.indexOf(b);
            return indexB - indexA;
          })[0]
      : null;

    res.json({
      totalBattles,
      wins,
      losses,
      draws,
      winRate: Math.round(winRate * 10) / 10, // Round to 1 decimal
      highestELO,
      highestLeague,
      highestTagTeamLeague,
      totalRobots: robots.length,
      prestige: user.prestige,
      prestigeRank: getPrestigeRank(user.prestige),
      cycleChanges,
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
