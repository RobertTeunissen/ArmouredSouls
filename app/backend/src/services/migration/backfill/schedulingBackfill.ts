/**
 * Scheduling Backfill Script
 * Migrates rows from legacy scheduling tables to unified scheduled_matches + participants.
 */
import prisma from '../../../lib/prisma';
import logger from '../../../config/logger';

export async function backfillScheduling(): Promise<{ migratedLeague: number; migratedTeam: number; migratedKoth: number; migratedTournament: number }> {
  logger.info('[Backfill] Starting scheduling backfill...');

  // Migrate scheduled_league_matches → ScheduledMatch (matchType=league_1v1)
  const leagueMatches = await prisma.scheduledLeagueMatch.findMany({});
  let migratedLeague = 0;
  for (const match of leagueMatches) {
    await prisma.scheduledMatch.create({
      data: {
        matchType: 'league_1v1',
        scheduledFor: match.scheduledFor,
        status: match.status,
        battleId: match.battleId,
        leagueType: match.leagueType,
        participants: {
          create: [
            { participantType: 'robot', participantId: match.robot1Id, slot: 1 },
            { participantType: 'robot', participantId: match.robot2Id, slot: 2 },
          ],
        },
      },
    });
    migratedLeague++;
  }

  // Migrate scheduled_team_battle_matches → ScheduledMatch with appropriate matchType
  const teamMatches = await prisma.scheduledTeamBattleMatch.findMany({});
  let migratedTeam = 0;
  for (const match of teamMatches) {
    const matchType = match.matchMode === 'tag_team' ? 'tag_team' :
      (match.teamSize === 2 ? 'league_2v2' : 'league_3v3');
    const participants = [
      { participantType: 'team' as const, participantId: match.team1Id, slot: 1 },
    ];
    if (match.team2Id) {
      participants.push({ participantType: 'team' as const, participantId: match.team2Id, slot: 2 });
    }
    await prisma.scheduledMatch.create({
      data: {
        matchType: matchType as any,
        scheduledFor: match.scheduledFor,
        status: match.status,
        leagueType: match.teamBattleLeague,
        leagueInstanceId: match.teamBattleLeagueId,
        isByeMatch: match.team2Id === null,
        participants: { create: participants },
      },
    });
    migratedTeam++;
  }

  // Migrate scheduled_koth_matches → ScheduledMatch (matchType=koth)
  const kothMatches = await prisma.scheduledKothMatch.findMany({ include: { participants: true } });
  let migratedKoth = 0;
  for (const match of kothMatches) {
    await prisma.scheduledMatch.create({
      data: {
        matchType: 'koth',
        scheduledFor: match.scheduledFor,
        status: match.status,
        battleId: match.battleId,
        rotatingZone: match.rotatingZone,
        participants: {
          create: match.participants.map((p, idx) => ({
            participantType: 'robot' as const,
            participantId: p.robotId,
            slot: idx + 1,
          })),
        },
      },
    });
    migratedKoth++;
  }

  // Tournament matches stay in their own table for now (complex bracket structure)
  const migratedTournament = 0;

  logger.info(`[Backfill] Scheduling complete: ${migratedLeague} league, ${migratedTeam} team, ${migratedKoth} koth, ${migratedTournament} tournament`);
  return { migratedLeague, migratedTeam, migratedKoth, migratedTournament };
}
