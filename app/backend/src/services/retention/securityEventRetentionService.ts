/**
 * Nightly retention of `security_events` (01:50 UTC): signals older than
 * SECURITY_EVENT_RETENTION_DAYS (90) are deleted. Always on, unlike the opt-in
 * audit log retention: the table only feeds the admin Security page.
 *
 * @module services/retention/securityEventRetentionService
 */

import cron from 'node-cron';
import logger from '../../config/logger';
import { pruneSecurityEvents, SECURITY_EVENT_RETENTION_DAYS } from '../security/securityOverviewService';

export function initSecurityEventRetention(): void {
  const schedule = '50 1 * * *'; // 01:50 UTC daily

  cron.schedule(schedule, async () => {
    try {
      const deleted = await pruneSecurityEvents();
      if (deleted > 0) logger.info(`[retention] Security events: ${deleted} rows older than ${SECURITY_EVENT_RETENTION_DAYS} days deleted`);
    } catch (error) {
      logger.error(`[retention] Security event retention failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, { timezone: 'UTC' });

  logger.info(`[retention] Security event retention cron scheduled at "${schedule}" (UTC), window ${SECURITY_EVENT_RETENTION_DAYS}d`);
}
