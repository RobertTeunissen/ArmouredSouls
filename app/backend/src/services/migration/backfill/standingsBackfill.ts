/**
 * Standings Backfill Script
 * Creates Standing rows for all active robots and teams from legacy columns.
 */
import prisma from '../../../lib/prisma';
import logger from '../../../config/logger';

export async function backfillStandings(): Promise<{ robots1v1: number; teams2v2: number; teams3v3: number; teamsTagTeam: number; koth: number }> {
  logger.info('[Backfill] Starting standings backfill...');

  // 1. Create league_1v1 standings for all robots
  const robots = await prisma.robot.findMany({
    where: {},
    select: { id: true, currentLeague: true, leagueId: true, leaguePoints: true, cyclesInCurrentLeague: true, wins: true, losses: true, draws: true, currentWinStreak: true, bestWinStreak: true, currentLoseStreak: true },
  });

  let robots1v1 = 0;
  for (const robot of robots) {
    await prisma.standing.upsert({
      where: { entityType_entityId_mode: { entityType: 'robot', entityId: robot.id, mode: 'league_1v1' } },
      update: {},
      create: {
        entityType: 'robot',
        entityId: robot.id,
        mode: 'league_1v1',
        tier: robot.currentLeague,
        leagueInstanceId: robot.leagueId,
        leaguePoints: robot.leaguePoints,
        cyclesInTier: robot.cyclesInCurrentLeague,
        wins: robot.wins,
        losses: robot.losses,
        draws: robot.draws,
        currentWinStreak: robot.currentWinStreak,
        bestWinStreak: robot.bestWinStreak,
        currentLoseStreak: robot.currentLoseStreak,
      },
    });
    robots1v1++;
  }

  // 2. Create league_2v2/league_3v3 standings for TeamBattle
  const teams = await prisma.teamBattle.findMany({
    select: { id: true, teamSize: true, teamLeague: true, teamLeagueId: true, teamLp: true, cyclesInLeague: true, totalLeagueWins: true, totalLeagueLosses: true, totalLeagueDraws: true, tagTeamLp: true, tagTeamLeague: true, tagTeamLeagueId: true, cyclesInTagTeamLeague: true, totalTagTeamWins: true, totalTagTeamLosses: true, totalTagTeamDraws: true },
  });

  let teams2v2 = 0, teams3v3 = 0, teamsTagTeam = 0;
  for (const team of teams) {
    const leagueMode = team.teamSize === 2 ? 'league_2v2' : 'league_3v3';
    await prisma.standing.upsert({
      where: { entityType_entityId_mode: { entityType: 'team', entityId: team.id, mode: leagueMode } },
      update: {},
      create: {
        entityType: 'team',
        entityId: team.id,
        mode: leagueMode as any,
        tier: team.teamLeague,
        leagueInstanceId: team.teamLeagueId,
        leaguePoints: team.teamLp,
        cyclesInTier: team.cyclesInLeague,
        wins: team.totalLeagueWins,
        losses: team.totalLeagueLosses,
        draws: team.totalLeagueDraws,
        currentWinStreak: 0,
        bestWinStreak: 0,
        currentLoseStreak: 0,
      },
    });
    if (team.teamSize === 2) teams2v2++; else teams3v3++;

    // Tag team standings (only for teamSize=2)
    if (team.teamSize === 2) {
      await prisma.standing.upsert({
        where: { entityType_entityId_mode: { entityType: 'team', entityId: team.id, mode: 'tag_team' } },
        update: {},
        create: {
          entityType: 'team',
          entityId: team.id,
          mode: 'tag_team' as any,
          tier: team.tagTeamLeague,
          leagueInstanceId: team.tagTeamLeagueId,
          leaguePoints: team.tagTeamLp,
          cyclesInTier: team.cyclesInTagTeamLeague,
          wins: team.totalTagTeamWins,
          losses: team.totalTagTeamLosses,
          draws: team.totalTagTeamDraws,
          currentWinStreak: 0,
          bestWinStreak: 0,
          currentLoseStreak: 0,
        },
      });
      teamsTagTeam++;
    }
  }

  // 3. Create KotH standings from Robot KotH columns
  // Calculate LP from battle_participants placements (F1-style point scale)
  const KOTH_POINT_SCALE = [10, 6, 4, 2, 1, 0];
  const kothParticipants = await prisma.battleParticipant.findMany({
    where: { battle: { battleType: 'koth' }, placement: { not: null } },
    select: { robotId: true, placement: true },
  });
  const kothLPMap = new Map<number, number>();
  for (const p of kothParticipants) {
    const points = p.placement! <= KOTH_POINT_SCALE.length ? KOTH_POINT_SCALE[p.placement! - 1] : 0;
    kothLPMap.set(p.robotId, (kothLPMap.get(p.robotId) || 0) + points);
  }

  const kothRobots = await prisma.robot.findMany({
    where: { kothMatches: { gt: 0 } },
    select: { id: true, kothWins: true, kothMatches: true, kothTotalZoneScore: true, kothTotalZoneTime: true, kothKills: true, kothBestPlacement: true, kothCurrentWinStreak: true, kothBestWinStreak: true },
  });

  let koth = 0;
  for (const robot of kothRobots) {
    await prisma.standing.upsert({
      where: { entityType_entityId_mode: { entityType: 'robot', entityId: robot.id, mode: 'koth' } },
      update: { leaguePoints: kothLPMap.get(robot.id) || 0 },
      create: {
        entityType: 'robot',
        entityId: robot.id,
        mode: 'koth' as any,
        tier: 'bronze', // Initial tier — will be assigned by first rebalancing cycle
        leagueInstanceId: 'bronze_1',
        leaguePoints: kothLPMap.get(robot.id) || 0,
        cyclesInTier: robot.kothMatches, // Use match count as proxy for cycles spent
        wins: robot.kothWins,
        losses: 0,
        draws: 0,
        currentWinStreak: robot.kothCurrentWinStreak,
        bestWinStreak: robot.kothBestWinStreak,
        currentLoseStreak: 0,
        totalMatches: robot.kothMatches,
        totalKills: robot.kothKills,
        totalZoneScore: robot.kothTotalZoneScore,
        totalZoneTime: robot.kothTotalZoneTime,
        bestPlacement: robot.kothBestPlacement,
      },
    });
    koth++;
  }

  logger.info(`[Backfill] Standings complete: ${robots1v1} robots(1v1), ${teams2v2} teams(2v2), ${teams3v3} teams(3v3), ${teamsTagTeam} teams(tag_team), ${koth} robots(koth)`);
  return { robots1v1, teams2v2, teams3v3, teamsTagTeam, koth };
}
