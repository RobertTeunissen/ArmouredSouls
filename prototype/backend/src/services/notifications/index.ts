// Notifications domain barrel file — re-exports the public API

export type { Integration, NotificationResult, JobName, JobContext } from './integration';

export {
  buildSuccessMessage,
  buildErrorMessage,
  getActiveIntegrations,
  dispatchNotification,
} from './notification-service';

export { DiscordIntegration } from './discord-integration';
