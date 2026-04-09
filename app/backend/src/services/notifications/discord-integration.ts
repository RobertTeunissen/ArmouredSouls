import logger from '../../config/logger';
import { Integration, NotificationResult } from './integration';

const DISCORD_TIMEOUT_MS = 5000;

export class DiscordIntegration implements Integration {
  readonly name = 'discord';
  private webhookUrl: string;

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
  }

  async send(message: string): Promise<NotificationResult> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DISCORD_TIMEOUT_MS);

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'unknown');
        logger.error(`Discord webhook failed: ${response.status} — ${errorText}`);
        return { success: false, integrationName: this.name, error: `HTTP ${response.status}` };
      }

      return { success: true, integrationName: this.name };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Discord webhook error: ${errorMessage}`);
      return { success: false, integrationName: this.name, error: errorMessage };
    }
  }
}
