/**
 * The newest nightly database backup (`/opt/armouredsouls/backups/daily`),
 * shared by the daily health report and the admin System page.
 *
 * `backup.sh` writes `*.sql.zst` since Oct 2026 (zstd replaced gzip); older
 * backups were `*.sql.gz` or `*.dump`. The report used to look only for the
 * old suffixes, so it found no backup once zstd landed.
 *
 * @module services/monitoring/backupStatus
 */
import fs from 'fs';
import logger from '../../config/logger';
import { getConfig } from '../../config/env';
import type { BackupStatus } from '../../shared/types';

export const BACKUP_DAILY_DIR = '/opt/armouredsouls/backups/daily';
/** A daily backup older than this is stale (a day plus margin). */
export const BACKUP_STALE_AFTER_MS = 26 * 60 * 60 * 1000;
const BACKUP_SUFFIXES = ['.sql.zst', '.sql.gz', '.dump'] as const;

// The status is a wire contract (shared admin-system.ts).
export type { BackupStatus };

export interface LatestBackup {
  status: BackupStatus;
  /** File name of the newest backup, or null. */
  file: string | null;
  at: Date | null;
  sizeBytes: number | null;
  /** Why there is no usable backup, for display. */
  note: string | null;
}

export function isBackupFile(name: string): boolean {
  return BACKUP_SUFFIXES.some((suffix) => name.endsWith(suffix));
}

/** Read the newest daily backup. Never throws. */
export function getLatestBackup(now: Date = new Date(), dir: string = BACKUP_DAILY_DIR): LatestBackup {
  try {
    const files = fs.readdirSync(dir)
      .filter(isBackupFile)
      .map((name) => {
        const stat = fs.statSync(`${dir}/${name}`);
        return { name, at: stat.mtime, size: stat.size };
      })
      .sort((a, b) => b.at.getTime() - a.at.getTime());
    if (files.length === 0) return { status: 'missing', file: null, at: null, sizeBytes: null, note: 'none found' };
    const newest = files[0];
    const stale = now.getTime() - newest.at.getTime() > BACKUP_STALE_AFTER_MS;
    return { status: stale ? 'stale' : 'ok', file: newest.name, at: newest.at, sizeBytes: newest.size, note: null };
  } catch (err) {
    // No backup directory: expected on a local machine, a failure on a deployed
    // host (backup.sh creates it on its first run).
    const isENOENT = err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT';
    if (isENOENT) {
      const { nodeEnv } = getConfig();
      const deployed = nodeEnv === 'acceptance' || nodeEnv === 'production';
      return deployed
        ? { status: 'missing', file: null, at: null, sizeBytes: null, note: 'backup directory not found' }
        : { status: 'not_applicable', file: null, at: null, sizeBytes: null, note: 'no backups on this machine' };
    }
    logger.warn('[backup-status] Backup check failed', { error: err instanceof Error ? err.message : String(err) });
    return { status: 'missing', file: null, at: null, sizeBytes: null, note: 'error checking backups' };
  }
}
