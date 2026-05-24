/**
 * Monitoring Webhook Utility
 *
 * Sends operational alerts (disk, startup, backup failures) to a dedicated
 * Discord monitoring channel. Falls back to the game notification webhook
 * if no dedicated monitoring webhook is configured.
 *
 * Never throws — monitoring failures must not crash the application.
 */

import logger from '../config/logger';
import { getConfig } from '../config/env';

const WEBHOOK_TIMEOUT_MS = 5000;

/**
 * Sends a monitoring alert to the dedicated monitoring Discord webhook.
 * Falls back to DISCORD_WEBHOOK_URL if MONITORING_DISCORD_WEBHOOK is not set.
 * Never throws — monitoring failures must not crash the application.
 *
 * @returns true if the alert was sent successfully, false otherwise
 */
export async function sendMonitoringAlert(message: string): Promise<boolean> {
  const { monitoringDiscordWebhook, discordWebhookUrl } = getConfig();
  const webhookUrl = monitoringDiscordWebhook || discordWebhookUrl || '';

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
