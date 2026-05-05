/**
 * System Health Utilities
 *
 * Provides disk usage, memory usage, and critical module resolution checks
 * for the enhanced health endpoint and daily health report.
 */

import { execSync } from 'child_process';
import os from 'os';
import logger from '../config/logger';

export interface DiskUsage {
  usagePercent: number;
  availableMB: number;
  status: 'ok' | 'warning' | 'critical';
}

export interface MemoryUsage {
  usedMB: number;
  totalMB: number;
  usagePercent: number;
}

export interface ModuleCheck {
  status: 'ok' | 'degraded';
  missing: string[];
}

/**
 * Critical modules that must be resolvable for the application to function.
 * Paths are relative to the compiled dist/ output directory structure.
 */
export const CRITICAL_MODULES: string[] = [
  '../utils/economyCalculations',
  '../services/cycle/cycleScheduler',
  '../services/notifications/notification-service',
  '../services/league/leagueBattleOrchestrator',
  '../services/economy/repairService',
  '../services/analytics/matchmakingService',
];

/**
 * Get disk usage for the root filesystem.
 * Returns usage percentage, available MB, and a status classification.
 */
export function getDiskUsage(): DiskUsage {
  try {
    const platform = os.platform();
    let usagePercent: number;
    let availableMB: number;

    if (platform === 'darwin') {
      // macOS: df -k / gives output in 1K blocks
      const output = execSync('df -k /', { encoding: 'utf-8', timeout: 3000 });
      const lines = output.trim().split('\n');
      if (lines.length < 2) {
        throw new Error('Unexpected df output format');
      }
      // macOS df output: Filesystem 512-blocks Used Available Capacity ...
      // With -k: Filesystem 1024-blocks Used Available Capacity ...
      const parts = lines[1].split(/\s+/);
      const capacityStr = parts.find(p => p.endsWith('%'));
      usagePercent = capacityStr ? parseInt(capacityStr.replace('%', ''), 10) : 0;
      // Available is in 1K blocks
      const availableKB = parseInt(parts[3], 10);
      availableMB = Math.round(availableKB / 1024);
    } else {
      // Linux: df with --output flags
      const percentOutput = execSync("df / --output=pcent | tail -1", {
        encoding: 'utf-8',
        timeout: 3000,
      });
      usagePercent = parseInt(percentOutput.trim().replace('%', ''), 10);

      const availOutput = execSync("df / --output=avail | tail -1", {
        encoding: 'utf-8',
        timeout: 3000,
      });
      // Output is in 1K blocks
      const availableKB = parseInt(availOutput.trim(), 10);
      availableMB = Math.round(availableKB / 1024);
    }

    let status: DiskUsage['status'] = 'ok';
    if (usagePercent >= 90) {
      status = 'critical';
    } else if (usagePercent >= 80) {
      status = 'warning';
    }

    return { usagePercent, availableMB, status };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[systemHealth] Failed to get disk usage: ${errorMessage}`);
    // Return degraded state — don't crash the health endpoint
    return { usagePercent: -1, availableMB: -1, status: 'warning' };
  }
}

/**
 * Get memory usage from the OS.
 */
export function getMemoryUsage(): MemoryUsage {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = totalBytes - freeBytes;

  const totalMB = Math.round(totalBytes / (1024 * 1024));
  const usedMB = Math.round(usedBytes / (1024 * 1024));
  const usagePercent = Math.round((usedBytes / totalBytes) * 100);

  return { usedMB, totalMB, usagePercent };
}

/**
 * Check that all critical modules can be resolved.
 * Uses require.resolve() which only checks file existence, doesn't execute modules.
 */
export function checkCriticalModules(): ModuleCheck {
  const missing: string[] = [];

  for (const modulePath of CRITICAL_MODULES) {
    try {
      // Resolve relative to this file's location in dist/utils/
      require.resolve(modulePath);
    } catch {
      missing.push(modulePath);
    }
  }

  return {
    status: missing.length === 0 ? 'ok' : 'degraded',
    missing,
  };
}
