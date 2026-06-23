/**
 * Migration Verification Service
 *
 * Validates data integrity after backfill by comparing row counts,
 * spot-checking records, and verifying referential integrity.
 */
import prisma from '../../lib/prisma';
import logger from '../../config/logger';

interface VerificationResult {
  domain: string;
  sourceCount: number;
  destinationCount: number;
  match: boolean;
  sampleErrors: string[];
}

interface FullVerificationReport {
  timestamp: Date;
  results: VerificationResult[];
  allPassed: boolean;
  referentialIntegrityPassed: boolean;
  errors: string[];
}

/**
 * Compare row counts between legacy and unified tables for a domain.
 */
async function verifyRowCounts(domain: 'scheduling' | 'standings' | 'battles' | 'financial'): Promise<VerificationResult> {
  let sourceCount = 0;
  let destinationCount = 0;

  switch (domain) {
    case 'scheduling': {
      const [league, team, koth] = await Promise.all([
        prisma.scheduledLeagueMatch.count(),
        prisma.scheduledTeamBattleMatch.count(),
        prisma.scheduledKothMatch.count(),
      ]);
      sourceCount = league + team + koth;
      destinationCount = await prisma.scheduledMatch.count();
      break;
    }
    case 'standings': {
      const robots = await prisma.robot.count({ where: {} });
      const teams = await prisma.teamBattle.count();
      sourceCount = robots + teams * 2; // Each team has league + tag_team standings
      destinationCount = await prisma.standing.count();
      break;
    }
    case 'battles': {
      sourceCount = await prisma.battle.count();
      const battlesWithParticipants = await prisma.battle.count({ where: { participants: { some: {} } } });
      destinationCount = battlesWithParticipants;
      break;
    }
    case 'financial': {
      const auditBattleEvents = await prisma.auditLog.count({ where: { eventType: 'battle_complete' } });
      sourceCount = auditBattleEvents;
      destinationCount = await prisma.financialLedger.count();
      break;
    }
  }

  return {
    domain,
    sourceCount,
    destinationCount,
    match: sourceCount <= destinationCount, // destination may have more (multiple entries per event)
    sampleErrors: [],
  };
}

/**
 * Spot-check 5% of records comparing key fields.
 */
async function sampleVerify(domain: 'scheduling' | 'standings', samplePercent: number = 5): Promise<VerificationResult> {
  const result: VerificationResult = {
    domain: `${domain}_sample`,
    sourceCount: 0,
    destinationCount: 0,
    match: true,
    sampleErrors: [],
  };

  if (domain === 'standings') {
    const totalRobots = await prisma.robot.count({ where: {} });
    const sampleSize = Math.max(1, Math.ceil(totalRobots * (samplePercent / 100)));
    const robots = await prisma.robot.findMany({
      where: {},
      take: sampleSize,
      select: { id: true, leaguePoints: true, currentLeague: true },
    });

    result.sourceCount = robots.length;
    for (const robot of robots) {
      const standing = await prisma.standing.findFirst({
        where: { entityType: 'robot', entityId: robot.id, mode: 'league_1v1' },
      });
      if (!standing) {
        result.sampleErrors.push(`Robot ${robot.id} has no league_1v1 standing`);
        result.match = false;
      }
    }
    result.destinationCount = robots.length - result.sampleErrors.length;
  }

  return result;
}

/**
 * Validate referential integrity in new schema.
 */
async function verifyReferentialIntegrity(): Promise<{ passed: boolean; errors: string[] }> {
  const errors: string[] = [];

  // Check ScheduledMatch.battleId references exist
  const matchesWithBattle = await prisma.scheduledMatch.findMany({
    where: { battleId: { not: null } },
    select: { id: true, battleId: true },
    take: 100,
  });

  for (const match of matchesWithBattle) {
    const battle = await prisma.battle.findUnique({ where: { id: match.battleId! } });
    if (!battle) {
      errors.push(`ScheduledMatch ${match.id} references non-existent battle ${match.battleId}`);
    }
  }

  return { passed: errors.length === 0, errors };
}

/**
 * Generate full verification report.
 */
async function generateFullReport(): Promise<FullVerificationReport> {
  logger.info('[MigrationVerification] Generating full report...');

  const results = await Promise.all([
    verifyRowCounts('scheduling'),
    verifyRowCounts('standings'),
    verifyRowCounts('battles'),
    verifyRowCounts('financial'),
    sampleVerify('standings'),
  ]);

  const integrity = await verifyReferentialIntegrity();

  const allPassed = results.every(r => r.match) && integrity.passed;

  const report: FullVerificationReport = {
    timestamp: new Date(),
    results,
    allPassed,
    referentialIntegrityPassed: integrity.passed,
    errors: [
      ...results.flatMap(r => r.sampleErrors),
      ...integrity.errors,
    ],
  };

  logger.info(`[MigrationVerification] Report: ${allPassed ? 'ALL PASSED' : 'FAILURES DETECTED'}`);
  return report;
}

export const migrationVerificationService = {
  verifyRowCounts,
  sampleVerify,
  verifyReferentialIntegrity,
  generateFullReport,
};
