# Requirements Document

## Introduction

After each of the four scheduled cron jobs completes, the system sends a short teaser notification to a Discord channel via webhook. The message is intentionally minimal — a one-liner with an emoji and a link to the app — designed to lure players back into the game rather than show detailed results. The architecture uses a simple pluggable interface so future integrations (Slack, email, etc.) can be added later, but Discord is the only integration for now. Configuration is environment-aware: ACC and PRD environments each have their own APP_BASE_URL and DISCORD_WEBHOOK_URL.

## Glossary

- **Notification_Service**: The backend service that builds a teaser message after a cron job completes and sends it through all active integrations.
- **Integration**: A pluggable delivery target that implements a `send(message: string)` method. Discord is the first and only implementation.
- **Discord_Integration**: The Integration implementation that posts a teaser message to a Discord channel via a configured webhook URL.
- **Cycle_Scheduler**: The existing scheduling system that runs four cron jobs: league (20:00 UTC), tournament (08:00 UTC), tag team (12:00 UTC), and settlement (23:00 UTC).
- **APP_BASE_URL**: Environment variable holding the base URL for the app (e.g., `https://acc.armouredsouls.com` for ACC, `https://armouredsouls.com` for PRD).

## Requirements

### Requirement 1: Teaser Notification After Job Completion

**User Story:** As a player, I want to receive a short, enticing notification when a game cycle completes, so that I am motivated to open the app and check the results.

#### Acceptance Criteria

1. WHEN the Cycle_Scheduler completes the league job, THE Notification_Service SHALL send a teaser message: "League battles have been completed! 🏆 Click here to see the results!" with a link to the app dashboard.
2. WHEN the Cycle_Scheduler completes the tournament job, THE Notification_Service SHALL send a teaser message including the tournament name and current round (e.g., "Tournament 3 Round 4/10 has been completed! ⚔️ Click here to see the results!") with a link to the app dashboard.
3. WHEN the Cycle_Scheduler completes the tag team job on an odd cycle, THE Notification_Service SHALL send a teaser message: "Tag Team battles have been completed! 🤝 Click here to see the results!" with a link to the app dashboard.
4. WHEN the Cycle_Scheduler completes the tag team job on an even cycle (no battles executed), THE Notification_Service SHALL skip sending a notification.
5. WHEN the Cycle_Scheduler completes the settlement job, THE Notification_Service SHALL send a teaser message: "Daily settlement complete! 💰 Check your income and expenses!" with a link to the app dashboard.
6. THE Notification_Service SHALL construct the dashboard link using the APP_BASE_URL environment variable.

### Requirement 2: Error Notifications

**User Story:** As an administrator, I want to be notified when a cron job fails, so that I can investigate issues promptly.

#### Acceptance Criteria

1. IF a cron job encounters an error during execution, THEN THE Notification_Service SHALL send an error message: "⚠️ [Job name] encountered an error. Check the admin panel." with a link to the app.
2. IF the Notification_Service itself fails to send a message, THEN THE Notification_Service SHALL log the error and allow the cron job to complete without interruption.

### Requirement 3: Discord Webhook Integration

**User Story:** As a developer, I want notifications posted to Discord via webhook, so that players see teaser messages in their Discord server.

#### Acceptance Criteria

1. THE Discord_Integration SHALL post the teaser message to a Discord channel using the DISCORD_WEBHOOK_URL environment variable.
2. WHILE the DISCORD_WEBHOOK_URL environment variable is not set, THE Notification_Service SHALL skip Discord delivery and log a warning.
3. IF the Discord webhook request fails or times out, THEN THE Discord_Integration SHALL log the error and return a failure result without retrying.

### Requirement 4: Pluggable Integration Interface

**User Story:** As a developer, I want a simple pluggable interface for notification delivery, so that future integrations can be added without modifying existing code.

#### Acceptance Criteria

1. THE Notification_Service SHALL define an Integration interface with a single `send(message: string)` method.
2. THE Notification_Service SHALL dispatch each teaser message to all registered Integration implementations.
3. IF an Integration fails to deliver a message, THEN THE Notification_Service SHALL log the error and continue dispatching to remaining integrations.
4. THE Notification_Service SHALL determine active integrations based on the presence of their required environment variables (DISCORD_WEBHOOK_URL for Discord).
