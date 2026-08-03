/**
 * Stable View Service
 *
 * Provides public stable profile data for the stable view page.
 */

import { StandingsMode } from '../../../generated/prisma';
import prisma from '../../lib/prisma';
import { getPrestigeRank } from '../../utils/prestigeUtils';
import { achievementService } from '../achievement';

/** Map facility type slug to a human-readable display name. */
const FACILITY_DISPLAY_NAMES: Record<string, string> = {
  repair_bay: 'Repair Bay',
  training_facility: 'Training Facility',
  weapons_workshop: 'Weapons Workshop',
  roster_expansion: 'Roster Expansion',
  storage_facility: 'Storage Facility',
  booking_office: 'Booking Office',
  combat_training_academy: 'Combat Training Academy',
  defense_training_academy: 'Defense Training Academy',
  mobility_training_academy: 'Mobility Training Academy',
  ai_training_academy: 'AI Training Academy',
  merchandising_hub: 'Merchandising Hub',
  streaming_studio: 'Streaming Studio',
  tuning_bay: 'Tuning Bay',
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
      championshipTitles1v1: true,
      championshipTitles2v2: true,
      championshipTitles3v3: true,
      robots: {
        where: {},
        orderBy: { elo: 'desc' },
        include: {
          // Spec #34: include refinements so the public stable view can
          // render rank prefix + slot bar on each robot's equipped weapons.
          mainWeapon: { include: { weapon: true, refinements: { orderBy: { slotIndex: 'asc' } } } },
          offhandWeapon: { include: { weapon: true, refinements: { orderBy: { slotIndex: 'asc' } } } },
        },
      },
      facilities: {
        select: {
          facilityType: true,
          level: true,
          maxLevel: true,
        },
      },
      teamBattles: {
        select: { id: true },
      },
    },
  });

  if (!user) return null;

  // Derive battle stats by counting actual distinct battles this stable participated in.
  // Robot model counters double-count team battles (each member gets +1).
  // Only head-to-head modes count toward W/L. KotH and Grand Melee are placement-based.
  const robotIds = user.robots.map(r => r.id);
  const teamIds = user.teamBattles.map(t => t.id);

  const battleStats = robotIds.length > 0
    ? await prisma.$queryRaw<[{ wins: bigint; losses: bigint; draws: bigint }]>`
        SELECT
          COUNT(DISTINCT CASE WHEN b.winner_id IS NOT NULL AND (
            -- 1v1 / tournament: winnerId is the winning robot's ID
            (b.battle_type IN ('league_1v1', 'tournament_1v1') AND b.winner_id = ANY(${robotIds}))
            -- Team modes: winningSide matches the participant's team
            OR (b.battle_type NOT IN ('league_1v1', 'tournament_1v1') AND b.winning_side = bp.team)
          ) THEN b.id END) AS wins,
          COUNT(DISTINCT CASE WHEN b.winner_id IS NOT NULL AND NOT (
            (b.battle_type IN ('league_1v1', 'tournament_1v1') AND b.winner_id = ANY(${robotIds}))
            OR (b.battle_type NOT IN ('league_1v1', 'tournament_1v1') AND b.winning_side = bp.team)
          ) THEN b.id END) AS losses,
          COUNT(DISTINCT CASE WHEN b.winner_id IS NULL THEN b.id END) AS draws
        FROM battle_participants bp
        JOIN battles b ON b.id = bp.battle_id
        WHERE bp.robot_id = ANY(${robotIds})
          AND b.battle_type NOT IN ('koth', 'grand_melee')
      `
    : [{ wins: BigInt(0), losses: BigInt(0), draws: BigInt(0) }];

  const totalWins = Number(battleStats[0].wins);
  const totalLosses = Number(battleStats[0].losses);
  const totalDraws = Number(battleStats[0].draws);
  const totalBattles = totalWins + totalLosses + totalDraws;
  const highestElo = user.robots.length > 0 ? Math.max(...user.robots.map((r) => r.elo)) : 0;
  const winRate = totalBattles > 0 ? Number(((totalWins / totalBattles) * 100).toFixed(1)) : 0;

  // Team battle breakdown from standings
  const teamStandings = teamIds.length > 0
    ? await prisma.standing.findMany({
        where: {
          entityType: 'team',
          entityId: { in: teamIds },
          mode: { in: [StandingsMode.league_2v2, StandingsMode.league_3v3, StandingsMode.tag_team, StandingsMode.tournament_2v2, StandingsMode.tournament_3v3] },
        },
        select: { wins: true, losses: true, draws: true },
      })
    : [];
  const teamBattleWins = teamStandings.reduce((sum, s) => sum + s.wins, 0);
  const teamBattleLosses = teamStandings.reduce((sum, s) => sum + s.losses, 0);
  const teamBattleDraws = teamStandings.reduce((sum, s) => sum + s.draws, 0);
  const totalTeamBattles = teamBattleWins + teamBattleLosses + teamBattleDraws;
  const teamBattleWinRate = totalTeamBattles > 0
    ? Number(((teamBattleWins / totalTeamBattles) * 100).toFixed(1))
    : 0;

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
      championshipTitles1v1: user.championshipTitles1v1,
      championshipTitles2v2: user.championshipTitles2v2,
      championshipTitles3v3: user.championshipTitles3v3,
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
      totalTeamBattles,
      teamBattleWins,
      teamBattleWinRate,
    },
    achievements,
  };
}
