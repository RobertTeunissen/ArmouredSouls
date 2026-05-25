/**
 * Monitoring Webhook Utility
 *
 * Sends operational alerts (disk, startup, backup failures) to a dedicated
 * Discord monitoring channel. Falls back to the game notification webhook
 * if no dedicated monitoring webhook is configured.
 *
 * Never throws — monitoring failures must not crash the application.
 *
 * **Why this reads `process.env` directly instead of `getConfig()`:**
 * `getConfig()` returns a cached singleton — by design, the rest of the app
 * reads validated env once at startup and never re-checks. Monitoring is the
 * exception: operators may flip the webhook URL (or unset it) at runtime to
 * silence a noisy alert, and we want the *next* `sendMonitoringAlert()` call
 * to honor that change without restarting the process. Reading `process.env`
 * directly here costs us validation but gains operational responsiveness;
 * for a non-critical, fail-open path, that tradeoff is correct. It also
 * keeps the existing test suite working with `jest.resetModules()` +
 * `process.env` mutation patterns without needing to expose
 * `_resetConfigForTesting()` to test code.
 */

import logger from '../config/logger';

const WEBHOOK_TIMEOUT_MS = 5000;

/**
 * Sends a monitoring alert to the dedicated monitoring Discord webhook.
 * Falls back to DISCORD_WEBHOOK_URL if MONITORING_DISCORD_WEBHOOK is not set.
 * Never throws — monitoring failures must not crash the application.
 *
 * @returns true if the alert was sent successfully, false otherwise
 */
export async function sendMonitoringAlert(message: string): Promise<boolean> {
  // Read raw env on every call — see module header for the rationale.
  const monitoringDiscordWebhook = process.env.MONITORING_DISCORD_WEBHOOK ?? '';
  const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL ?? '';
  const webhookUrl = monitoringDiscordWebhook || discordWebhookUrl;

  if (!webhookUrl) {
    logger.warn(`[monitoring] No webhook configured — alert logged only: ${message}`);
    return false;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown');
      logger.error(`[monitoring] Webhook failed: HTTP ${response.status} — ${errorText}`);
      return false;
    }

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[monitoring] Webhook error: ${errorMessage}`);
    return false;
  }
}
