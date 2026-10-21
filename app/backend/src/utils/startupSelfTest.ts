/**
 * Startup Self-Test
 *
 * Validates that all critical compiled modules exist on disk before the
 * server begins accepting connections. Catches broken builds (missing
 * compiled modules) immediately rather than failing at runtime hours later.
 *
 * Called during application bootstrap, before app.listen().
 */

import logger from '../config/logger';
import { sendStartupFailureAlert } from './startupAlert';
import { CRITICAL_MODULES } from './systemHealth';

export interface SelfTestResult {
  passed: boolean;
  resolvedModules: string[];
  failedModules: { path: string; error: string }[];
}

/**
 * Validates that all critical compiled modules exist on disk.
 * Called before server.listen() — blocks startup if modules are missing.
 *
 * On failure: logs CRITICAL, sends Discord alert, returns { passed: false }.
 * On success: logs INFO, returns { passed: true }.
 */
export async function runStartupSelfTest(): Promise<SelfTestResult> {
  const resolvedModules: string[] = [];
  const failedModules: { path: string; error: string }[] = [];

  for (const modulePath of CRITICAL_MODULES) {
    try {
      require.resolve(modulePath);
      resolvedModules.push(modulePath);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      failedModules.push({ path: modulePath, error: errorMessage });
    }
  }

  if (failedModules.length > 0) {
    const missingList = failedModules.map(m => m.path).join(', ');
    const message = `🚨 STARTUP FAILED: Missing modules: [${missingList}]. Server did not start.`;

    logger.error(`[startup-self-test] CRITICAL: ${message}`);

    // Direct webhook call — don't depend on notification service. Sent once per
    // failure, not once per PM2 restart (startupAlert.ts).
    await sendStartupFailureAlert(message);

    return { passed: false, resolvedModules, failedModules };
  }

  logger.info(
    `[startup-self-test] Startup self-test passed: all ${resolvedModules.length} critical modules verified.`
  );

  return { passed: true, resolvedModules, failedModules };
}
