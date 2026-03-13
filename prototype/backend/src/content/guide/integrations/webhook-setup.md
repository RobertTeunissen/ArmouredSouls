---
title: "Webhook Setup Guide"
description: "Step-by-step instructions for setting up a Discord webhook to receive Armoured Souls game notifications — environment variables, configuration, and troubleshooting."
order: 3
lastUpdated: "2026-03-11"
relatedArticles:
  - integrations/notification-service
  - integrations/integration-interface
  - integrations/notification-flow
---

## Overview

This guide walks you through setting up a personal webhook integration to receive game notifications in Discord. The process involves creating a webhook in your Discord server and configuring the game to use it.

```callout-info
This guide is written for community members who want to receive game notifications. You don't need to be a developer — just follow the steps below. If you get stuck, the troubleshooting section at the bottom covers common issues.
```

## Prerequisites

- A Discord server where you have permission to create webhooks (or ask a server admin)
- Access to the game's server configuration (for self-hosted instances)

## Step 1: Create a Discord Webhook

1. Open your Discord server
2. Go to the channel where you want notifications to appear
3. Click the gear icon (Edit Channel) next to the channel name
4. Navigate to "Integrations" in the left sidebar
5. Click "Webhooks"
6. Click "New Webhook"
7. Give it a name (e.g., "Armoured Souls Notifications")
8. Copy the webhook URL — you'll need this in the next step

```callout-warning
Keep your webhook URL private. Anyone with the URL can send messages to your Discord channel. If it's compromised, delete the webhook in Discord and create a new one.
```

## Step 2: Configure Environment Variables

The game server needs two environment variables to enable Discord notifications:

| Variable | Purpose | Example |
|----------|---------|---------|
| `APP_BASE_URL` | The base URL of your game instance | `https://your-game-domain.com` |
| `DISCORD_WEBHOOK_URL` | The Discord webhook URL from Step 1 | `https://discord.com/api/webhooks/...` |

Set these in your server's environment configuration (typically a `.env` file):

```
APP_BASE_URL=https://your-game-domain.com
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your-webhook-id/your-webhook-token
```

```callout-tip
The `APP_BASE_URL` is used to generate clickable links in notification messages that point back to your game instance. Make sure it matches the URL you use to access the game in your browser.
```

## Step 3: Verify the Connection

After configuring the environment variables and restarting the game server:

1. Wait for the next daily cycle to process
2. Check your Discord channel for notification messages
3. You should see battle results, tournament updates, or financial summaries depending on what events fired

If no messages appear after a cycle, check the troubleshooting section below.

## What Notifications Look Like

Discord notifications appear as formatted messages in your channel:

- **League battle results** — Lists your robots' wins and losses with LP changes
- **Tournament updates** — Shows bracket progression, eliminations, and advancement
- **Financial summary** — Summarizes income, expenses, and net balance change

Messages include relevant numbers and brief summaries so you can quickly assess how your stable is doing without logging in.

## Troubleshooting

### No messages appearing

1. **Check the webhook URL** — Make sure `DISCORD_WEBHOOK_URL` is set correctly and the URL is complete
2. **Check the server logs** — Look for error messages related to notification dispatch
3. **Verify the webhook is active** — Go back to Discord channel settings and confirm the webhook still exists
4. **Restart the server** — Environment variable changes require a server restart to take effect

### Messages appearing but with broken links

- Verify `APP_BASE_URL` is set to the correct domain with the protocol (include `https://`)
- Don't include a trailing slash in the URL

### Webhook was deleted or expired

If you deleted the webhook in Discord:
1. Create a new webhook following Step 1
2. Update the `DISCORD_WEBHOOK_URL` environment variable with the new URL
3. Restart the game server

```callout-info
The notification system is designed to fail gracefully. If the webhook URL is invalid or the Discord API is temporarily unavailable, the game continues processing normally — you just won't receive notifications until the issue is resolved.
```

## Adding Multiple Webhooks

The current system supports one Discord webhook. If you want notifications in multiple channels or servers, you can:

- Use Discord's built-in channel forwarding to mirror messages
- Set up a Discord bot that reposts messages to additional channels

Future updates may support multiple webhook endpoints natively.

## What's Next?

- [Notification Service](/guide/integrations/notification-service) — How the notification system works internally
- [Integration Interface](/guide/integrations/integration-interface) — How new delivery targets can be added
- [Notification Flow](/guide/integrations/notification-flow) — Visual diagram of the complete dispatch process
