/**
 * Financial Ledger Backfill Script
 * Backfills financial_ledger from existing audit_log records.
 */
import prisma from '../../../lib/prisma';
import logger from '../../../config/logger';

export async function backfillFinancialLedger(): Promise<{ entries: number; gaps: number }> {
  logger.info('[Backfill] Starting financial ledger backfill...');

  // Query audit_logs for battle_complete events (which contain credit data)
  const battleEvents = await prisma.auditLog.findMany({
    where: { eventType: 'battle_complete' },
    orderBy: { eventTimestamp: 'asc' },
    select: { cycleNumber: true, userId: true, robotId: true, payload: true, eventTimestamp: true },
  });

  let entries = 0;
  let gaps = 0;

  for (const event of battleEvents) {
    const payload = event.payload as Record<string, unknown>;
    const credits = Number(payload?.credits ?? 0);
    const streamingRevenue = Number(payload?.streamingRevenue ?? 0);

    if (credits > 0 && event.userId) {
      try {
        await prisma.financialLedger.create({
          data: {
            cycleNumber: event.cycleNumber,
            userId: event.userId,
            robotId: event.robotId,
            transactionType: 'battle_income',
            amount: credits,
            balanceAfter: 0, // Cannot reconstruct accurately
            description: 'Backfilled from audit_log',
            metadata: { backfilled: true, originalTimestamp: event.eventTimestamp },
          },
        });
        entries++;
      } catch {
        gaps++;
      }
    }

    if (streamingRevenue > 0 && event.userId) {
      try {
        await prisma.financialLedger.create({
          data: {
            cycleNumber: event.cycleNumber,
            userId: event.userId,
            robotId: event.robotId,
            transactionType: 'streaming_revenue',
            amount: streamingRevenue,
            balanceAfter: 0,
            description: 'Backfilled from audit_log',
            metadata: { backfilled: true, originalTimestamp: event.eventTimestamp },
          },
        });
        entries++;
      } catch {
        gaps++;
      }
    }
  }

  logger.info(`[Backfill] Financial ledger: ${entries} entries created, ${gaps} gaps`);
  return { entries, gaps };
}
