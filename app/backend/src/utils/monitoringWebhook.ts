/**
 * Monitoring Webhook Utility
 *
 * Sends operational alerts (startup, Automaton, season rollover, daily health
 * report) to the dedicated Discord monitoring channel.
 *
 * Only MONITORING_DISCORD_WEBHOOK is used. There is deliberately no fallback
 * to DISCORD_WEBHOOK_URL: that is the player-facing game channel, and ops
 * alerts carry hostnames, disk figures and error codes players must not see.
 * Without a monitoring webhook the alert is logged only; the missing Daily
 * Health Report is the signal that alerting is not configured.
 *
 * Never throws — monitoring failures must not crash the application.
 *
 * **Why this reads `process.env` directly instead of `getConfig()`:**
 * `getConfig()` returns a cached singleton — by design, the rest of the app
 * reads validated env once at startup and never re-checks. Reading
 * `process.env` on every call keeps this fail-open helper independent of
 * config bootstrapping (it also runs from the startup self-test) and keeps
 * the test suite's `process.env` mutation patterns working without exposing
 * `_resetConfigForTesting()` to test code.
 */

import logger from '../config/logger';

const WEBHOOK_TIMEOUT_MS = 5000;

/** Discord rejects `content` longer than 2000 characters with HTTP 400. */
export const DISCORD_CONTENT_LIMIT = 2000;

/** Cut a message to Discord's limit, marking the cut, so it is delivered rather than rejected. */
export function fitDiscordContent(message: string): string {
  const chars = Array.from(message); // code points, so an emoji is never split
  if (chars.length <= DISCORD_CONTENT_LIMIT) return message;
  return `${chars.slice(0, DISCORD_CONTENT_LIMIT - 1).join('')}…`;
}

/**
 * Sends a monitoring alert to MONITORING_DISCORD_WEBHOOK.
 * Never throws — monitoring failures must not crash the application.
 *
 * @returns true if the alert was sent successfully, false otherwise
 */
export async function sendMonitoringAlert(message: string): Promise<boolean> {
  // Read raw env on every call — see module header for the rationale.
  const webhookUrl = process.env.MONITORING_DISCORD_WEBHOOK ?? '';

  if (!webhookUrl) {
    logger.warn(`[monitoring] MONITORING_DISCORD_WEBHOOK not set — alert logged only: ${message}`);
    return false;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: fitDiscordContent(message) }),
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
