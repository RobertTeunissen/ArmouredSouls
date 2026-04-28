/**
 * Stable View Service
 *
 * Provides public stable profile data for the stable view page.
 */

import prisma from '../../lib/prisma';
import { getPrestigeRank } from '../../utils/prestigeUtils';
import { achievementService } from '../achievement';

/** Map facility type slug to a human-readable display name. */
const FACILITY_DISPLAY_NAMES: Record<string, string> = {
  repair_bay: 'Repair Bay',
  training_facility: 'Training Facility',
  weapons_workshop: 'Weapons Workshop',
  research_lab: 'Research Lab',
  medical_bay: 'Medical Bay',
  roster_expansion: 'Roster Expansion',
  storage_facility: 'Storage Facility',
  coaching_staff: 'Coaching Staff',
  booking_office: 'Booking Office',
  combat_training_academy: 'Combat Training Academy',
  defense_training_academy: 'Defense Training Academy',
  mobility_training_academy: 'Mobility Training Academy',
  ai_training_academy: 'AI Training Academy',
  merchandising_hub: 'Merchandising Hub',
  streaming_studio: 'Streaming Studio',
};

export async function getStableProfile(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      stableName: true,
      prestige: true,
      championshipTitles: true,
      robots: {
        where: { NOT: { name: 'Bye Robot' } },
        orderBy: { elo: 'desc' },
        include: {
          mainWeapon: { include: { weapon: true } },
          offhandWeapon: { include: { weapon: true } },
        },
      },
      facilities: {
        select: {
          facilityType: true,
          level: true,
          maxLevel: true,
        },
      },
    },
  });

  if (!user) return null;

  const totalBattles = user.robots.reduce((sum, r) => sum + r.totalBattles, 0);
  const totalWins = user.robots.reduce((sum, r) => sum + r.wins, 0);
  const totalLosses = user.robots.reduce((sum, r) => sum + r.losses, 0);
  const totalDraws = user.robots.reduce((sum, r) => sum + r.draws, 0);
  const highestElo = user.robots.length > 0 ? Math.max(...user.robots.map((r) => r.elo)) : 0;
  const winRate = totalBattles > 0 ? Number(((totalWins / totalBattles) * 100).toFixed(1)) : 0;

  const facilities = user.facilities.map((f) => ({
    type: f.facilityType,
    name: FACILITY_DISPLAY_NAMES[f.facilityType] || f.facilityType,
    level: f.level,
    maxLevel: f.maxLevel,
  }));

  const achievements = await achievementService.getStableAchievements(userId);

  return {
    user: {
      id: user.id,
      username: user.username,
      stableName: user.stableName,
      prestige: user.prestige,
      prestigeRank: getPrestigeRank(user.prestige),
      championshipTitles: user.championshipTitles,
    },
    robots: user.robots,
    facilities,
    stats: {
      totalBattles,
      totalWins,
      totalLosses,
      totalDraws,
      winRate,
      highestElo,
      activeRobots: user.robots.length,
    },
    achievements,
  };
}
