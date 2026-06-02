import logger from '../../config/logger';
import { getConfig } from '../../config/env';
import { Integration, NotificationResult, JobContext } from './integration';
import { DiscordIntegration } from './discord-integration';

export function buildSuccessMessage(context: JobContext, appBaseUrl: string): string | null {
  const link = appBaseUrl;

  switch (context.jobName) {
    case 'league':
      return `League battles have been completed! 🏆 Click here to see the results! ${link}`;
    case 'tournament':
      if (context.tournamentScheduled) {
        return `${context.tournamentName} has been scheduled! ⚔️ Click here to see the results! ${link}`;
      }
      return `${context.tournamentName} Round ${context.tournamentRound}/${context.tournamentMaxRounds} has been completed! ⚔️ Click here to see the results! ${link}`;
    case 'tag-team':
      if (context.isEvenCycle) return null;
      return `Tag Team battles have been completed! 🤝 Click here to see the results! ${link}`;
    case 'settlement':
      return `Daily settlement complete! 💰 Check your income and expenses! ${link}`;
    case 'koth':
      if (!context.matchesCompleted || context.matchesCompleted === 0) return null;
      return `King of the Hill: ${context.matchesCompleted} matches completed! 👑 Click here to see the results! ${link}`;
    case 'team2v2League':
      if (!context.matchesCompleted || context.matchesCompleted === 0) return null;
      return `⚔️ 2v2 League: ${context.matchesCompleted} team battles completed. [View results](${link}/team-battles)`;
    case 'team3v3League':
      if (!context.matchesCompleted || context.matchesCompleted === 0) return null;
      return `⚔️ 3v3 League: ${context.matchesCompleted} team battles completed. [View results](${link}/team-battles)`;
    case 'team2v2Tournament':
      if (context.tournamentScheduled) {
        return `⚔️ 2v2 Tournament: ${context.tournamentName} has been created! [View](${link}/tournaments)`;
      }
      if (!context.matchesCompleted || context.matchesCompleted === 0) return null;
      return `⚔️ 2v2 Tournament: Round ${context.tournamentRound}/${context.tournamentMaxRounds} — ${context.matchesCompleted} matches. [View](${link}/tournaments)`;
    case 'team3v3Tournament':
      if (context.tournamentScheduled) {
        return `⚔️ 3v3 Tournament: ${context.tournamentName} has been created! [View](${link}/tournaments)`;
      }
      if (!context.matchesCompleted || context.matchesCompleted === 0) return null;
      return `⚔️ 3v3 Tournament: Round ${context.tournamentRound}/${context.tournamentMaxRounds} — ${context.matchesCompleted} matches. [View](${link}/tournaments)`;
  }
}

export function buildErrorMessage(jobName: string, appBaseUrl: string): string {
  return `⚠️ ${jobName} encountered an error. Check the admin panel. ${appBaseUrl}`;
}

export function getActiveIntegrations(): Integration[] {
  const integrations: Integration[] = [];
  const discordUrl = getConfig().discordWebhookUrl;

  if (discordUrl) {
    integrations.push(new DiscordIntegration(discordUrl));
  } else {
    logger.warn('DISCORD_WEBHOOK_URL not set — Discord notifications disabled');
  }

  return integrations;
}

export async function dispatchNotification(
  message: string,
  integrations: Integration[]
): Promise<NotificationResult[]> {
  const results: NotificationResult[] = [];

  for (const integration of integrations) {
    try {
      const result = await integration.send(message);
      results.push(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Integration "${integration.name}" failed: ${errorMessage}`);
      results.push({ success: false, integrationName: integration.name, error: errorMessage });
    }
  }

  return results;
}
