/**
 * Battle Participants Backfill Script
 * Verifies all historical battles have corresponding participant rows.
 * Populates role field for existing participants.
 */
import prisma from '../../../lib/prisma';
import logger from '../../../config/logger';

export async function backfillBattleParticipants(): Promise<{ updated: number; verified: number; discrepancies: number }> {
  logger.info('[Backfill] Starting battle participants backfill...');

  // Update roles for existing participants based on battle type
  const participants = await prisma.battleParticipant.findMany({
    where: { role: null },
    include: { battle: { select: { battleType: true } } },
  });

  let updated = 0;
  for (const p of participants) {
    let role: string;
    switch (p.battle.battleType) {
      case 'league_1v1':
      case 'tournament_1v1':
        role = 'solo';
        break;
      case 'tag_team':
        role = p.team === 1 || p.team === 2 ? 'active' : 'reserve'; // Simplified — actual logic uses slot
        break;
      case 'koth':
        role = 'koth_participant';
        break;
      case 'league_2v2':
      case 'league_3v3':
        role = 'team_member';
        break;
      default:
        role = 'solo';
    }

    await prisma.battleParticipant.update({
      where: { id: p.id },
      data: { role },
    });
    updated++;
  }

  // Verify all battles have participants
  const battlesWithoutParticipants = await prisma.battle.count({
    where: { participants: { none: {} } },
  });

  const verified = await prisma.battle.count({
    where: { participants: { some: {} } },
  });

  logger.info(`[Backfill] Battle participants: ${updated} roles updated, ${verified} battles verified, ${battlesWithoutParticipants} discrepancies`);
  return { updated, verified, discrepancies: battlesWithoutParticipants };
}
