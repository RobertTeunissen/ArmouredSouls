/**
 * Deploy Orchestration Script
 *
 * Executes the atomic deploy sequence:
 * 1. Verify no in-flight matches
 * 2. Run backfill scripts
 * 3. Run verification
 * 4. If verification passes: deploy complete
 * 5. If verification fails: halt (leave legacy tables intact)
 */
import prisma from '../../lib/prisma';
import logger from '../../config/logger';
import {
  backfillScheduling,
  backfillStandings,
  backfillBattleParticipants,
  backfillFinancialLedger,
  seedLeaderboardCache,
} from './backfill';
import { migrationVerificationService } from './migrationVerificationService';

export interface DeployResult {
  success: boolean;
  phase: string;
  error?: string;
  backfillResults?: Record<string, unknown>;
  verificationPassed?: boolean;
}

export async function executeDeploy(): Promise<DeployResult> {
  logger.info('[Deploy] Starting atomic deploy sequence...');

  // Phase 1: Verify no in-flight matches (unified table)
  logger.info('[Deploy] Phase 1: Checking for in-flight matches...');
  const inFlightMatches = await prisma.scheduledMatch.findMany({
    where: { status: 'scheduled' },
    select: { matchType: true },
  });

  if (inFlightMatches.length > 0) {
    const typeCounts = inFlightMatches.reduce((acc, m) => {
      acc[m.matchType] = (acc[m.matchType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const summary = Object.entries(typeCounts).map(([t, c]) => `${c} ${t}`).join(', ');
    const msg = `Cannot deploy: ${inFlightMatches.length} matches in-flight (${summary})`;
    logger.error(`[Deploy] ${msg}`);
    return { success: false, phase: 'pre-check', error: msg };
  }
  logger.info('[Deploy] Phase 1: No in-flight matches ✓');

  // Phase 2: Run backfill scripts
  logger.info('[Deploy] Phase 2: Running backfill scripts...');
  try {
    const schedulingResult = await backfillScheduling();
    const standingsResult = await backfillStandings();
    const battleResult = await backfillBattleParticipants();
    const financialResult = await backfillFinancialLedger();
    await seedLeaderboardCache();

    logger.info('[Deploy] Phase 2: Backfill complete ✓');

    // Phase 3: Verify
    logger.info('[Deploy] Phase 3: Running verification...');
    const report = await migrationVerificationService.generateFullReport();

    if (!report.allPassed) {
      const msg = `Verification failed: ${report.errors.join('; ')}`;
      logger.error(`[Deploy] ${msg}`);
      return {
        success: false,
        phase: 'verification',
        error: msg,
        verificationPassed: false,
        backfillResults: { schedulingResult, standingsResult, battleResult, financialResult },
      };
    }

    logger.info('[Deploy] Phase 3: Verification passed ✓');

    return {
      success: true,
      phase: 'complete',
      verificationPassed: true,
      backfillResults: { schedulingResult, standingsResult, battleResult, financialResult },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`[Deploy] Failed: ${msg}`);
    return { success: false, phase: 'backfill', error: msg };
  }
}
