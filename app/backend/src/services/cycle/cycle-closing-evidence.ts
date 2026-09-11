import logger from '../../config/logger';
import prisma from '../../lib/prisma';
import { formatProcessMemoryUsage } from '../../utils/process-memory';
import { EventType, eventLogger } from '../common/eventLogger';

const BALANCE_PAGE_SIZE = 100;

function buildBalanceSourceEventId(cycleNumber: number, userId: number): string {
  return `cycle-end-balance:${cycleNumber}:${userId}`;
}

/**
 * Capture every watermarked closing balance in bounded, retry-safe batches.
 * Existing deterministic evidence is excluded before audit sequences are
 * allocated, so resuming a partial close neither duplicates rows nor adds gaps.
 */
export async function logCycleEndBalances(
  cycleNumber: number,
  maximumUserId: number | null,
): Promise<number> {
  if (maximumUserId === null) return 0;

  let afterUserId: number | undefined;
  let usersLogged = 0;
  let pageNumber = 0;

  while (true) {
    const users = await prisma.user.findMany({
      where: {
        id: {
          lte: maximumUserId,
          ...(afterUserId === undefined ? {} : { gt: afterUserId }),
        },
      },
      select: { id: true, username: true, stableName: true, currency: true },
      orderBy: { id: 'asc' },
      take: BALANCE_PAGE_SIZE,
    });
    if (users.length === 0) break;

    const sourceEventIds = users.map((user) =>
      buildBalanceSourceEventId(cycleNumber, user.id),
    );
    const existingEvents = await prisma.auditLog.findMany({
      where: {
        eventType: EventType.CYCLE_END_BALANCE,
        sourceEventId: { in: sourceEventIds },
      },
      select: { sourceEventId: true },
    });
    const existingSourceEventIds = new Set(
      existingEvents
        .map((event) => event.sourceEventId)
        .filter((sourceEventId): sourceEventId is string => sourceEventId !== null),
    );
    const missingUsers = users.filter(
      (user) => !existingSourceEventIds.has(
        buildBalanceSourceEventId(cycleNumber, user.id),
      ),
    );

    if (missingUsers.length > 0) {
      await eventLogger.logEventBatch(
        cycleNumber,
        missingUsers.map((user) => ({
          eventType: EventType.CYCLE_END_BALANCE,
          sourceEventId: buildBalanceSourceEventId(cycleNumber, user.id),
          payload: {
            username: user.username,
            stableName: user.stableName,
            balance: user.currency,
          },
          userId: user.id,
        })),
      );
    }

    usersLogged += users.length;
    pageNumber++;
    afterUserId = users[users.length - 1].id;
    logger.info(
      `[CycleClosingEvidence] cycle=${cycleNumber} balancePage=${pageNumber} `
      + `usersLogged=${usersLogged} evidenceWritten=${missingUsers.length} `
      + formatProcessMemoryUsage(),
    );

    if (users.length < BALANCE_PAGE_SIZE) break;
  }

  return usersLogged;
}
