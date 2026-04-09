---
title: "Notification Service"
description: "How the Armoured Souls notification system dispatches messages after scheduled events — league results, tournament updates, and financial summaries delivered to your connected channels."
order: 1
lastUpdated: "2026-03-11"
relatedArticles:
  - integrations/integration-interface
  - integrations/webhook-setup
  - integrations/notification-flow
---

## Overview

The **Notification Service** is the system that sends game updates to external channels after scheduled events complete. When the daily cycle processes league battles, tournament rounds, tag team matches, or financial calculations, the Notification Service builds summary messages and dispatches them through any connected integrations.

This means you can receive battle results, tournament updates, and financial summaries directly in Discord, Slack, or any other platform that supports webhooks — without needing to log into the game.

## How It Works

The Notification Service operates in three steps:

1. **Event completion** — A scheduled cron job finishes processing (league battles, tournament round, financials, etc.)
2. **Message building** — The service constructs a human-readable summary of what happened
3. **Dispatch** — The message is sent to all registered [integrations](/guide/integrations/integration-interface)

### Supported Events

| Event | When It Fires | What It Reports |
|-------|--------------|----------------|
| League battles | After daily league matchmaking resolves | Battle results, LP changes, win/loss records |
| Tournament rounds | After each tournament round processes | Match results, bracket updates, eliminations |
| Tag team matches | After tag team battles resolve | Team results and standings |
| Financial processing | After daily income/expense processing | Revenue summary, expense breakdown, net income |

Each event generates its own message format optimized for that type of update. Battle results include win/loss details, tournament messages show bracket progression, and financial messages summarize your daily cycle.

```callout-info
The Notification Service only sends messages after events complete — it doesn't send real-time updates during battle processing. You'll receive a summary once everything is resolved for that cycle.
```

## Message Format

Messages are built as **teaser summaries** — concise overviews designed to give you the key information at a glance. They include:

- Event type header (e.g., "League Battle Results")
- Key outcomes (wins, losses, notable performances)
- Relevant numbers (LP changes, credits earned, tournament advancement)
- Links back to the game for full details (when supported by the integration)

The format is designed to be readable in any platform — plain text with light formatting that works in Discord embeds, Slack messages, or email.

```callout-tip
Notifications are a convenience feature — they give you a quick summary so you can decide whether to log in and review details. All the same information is available in-game through your dashboard and battle history.
```

## Enabling Notifications

To receive notifications, you need:

1. **At least one integration configured** — See [Webhook Setup](/guide/integrations/webhook-setup) for how to connect Discord or other platforms
2. **The integration registered** — The system automatically dispatches to all active integrations

There's no per-event toggle — if you have an integration connected, it receives all event notifications. This keeps the system simple and ensures you don't miss important updates.

## What's Next?

- [Integration Interface](/guide/integrations/integration-interface) — How integrations plug into the notification system
- [Webhook Setup](/guide/integrations/webhook-setup) — Step-by-step guide to connecting Discord
- [Notification Flow](/guide/integrations/notification-flow) — Visual diagram of the complete dispatch process
