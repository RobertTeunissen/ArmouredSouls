---
title: "Integration Interface"
description: "How the pluggable integration system works — adding new delivery targets like Discord, Slack, or email to receive game notifications."
order: 2
lastUpdated: "2026-03-11"
relatedArticles:
  - integrations/notification-service
  - integrations/webhook-setup
  - integrations/notification-flow
---

## Overview

The notification system uses a **pluggable integration interface** — a standardized way for different delivery targets to receive game notifications. Each integration implements a simple "send" method that the [Notification Service](/guide/integrations/notification-service) calls when dispatching messages.

This design means new delivery targets can be added without changing the core notification logic. Discord, Slack, email, or any custom webhook endpoint all plug in the same way.

## How Integrations Work

Every integration follows the same pattern:

1. **Implements a send method** — Accepts a message and delivers it to the target platform
2. **Registers with the Notification Service** — The service maintains a list of active integrations
3. **Receives dispatched messages** — When an event fires, the service calls each integration's send method

The integration handles all platform-specific formatting and delivery. The Notification Service doesn't need to know whether it's sending to Discord, Slack, or a custom endpoint — it just calls the send method and the integration handles the rest.

```callout-info
This is a technical architecture concept, but the practical takeaway is simple: the game can send notifications to multiple platforms simultaneously, and adding new platforms doesn't require changes to the core game code.
```

## Available Integrations

### Discord Webhook

The primary integration. Sends formatted messages to a Discord channel via webhook URL. Supports rich embeds with colors, fields, and formatting that make battle results and financial summaries easy to read.

See [Webhook Setup](/guide/integrations/webhook-setup) for configuration instructions.

### Future Integrations

The pluggable design supports adding new delivery targets:

- **Slack** — Webhook-based delivery to Slack channels
- **Email** — Summary emails for daily cycle results
- **Custom webhooks** — Any HTTP endpoint that accepts POST requests

```callout-tip
If you're a developer interested in building a custom integration, the interface is straightforward — implement a send method that accepts a message string and delivers it to your target. The [Notification Flow](/guide/integrations/notification-flow) diagram shows exactly where your integration plugs in.
```

## Integration Reliability

The notification system is designed to be resilient:

- **Failed deliveries don't block game processing** — If an integration fails to send, the game cycle continues normally
- **Errors are logged** — Failed deliveries are recorded for troubleshooting
- **No retry queue** — Messages that fail to deliver are not retried (the next cycle's message will include current state)

This means notifications are a best-effort convenience feature. The game never depends on successful notification delivery, and a misconfigured integration won't affect gameplay.

```callout-warning
If you stop receiving notifications, check your integration configuration first. The most common issue is an expired or revoked webhook URL. See [Webhook Setup](/guide/integrations/webhook-setup) for troubleshooting tips.
```

## What's Next?

- [Notification Service](/guide/integrations/notification-service) — How the core notification system works
- [Webhook Setup](/guide/integrations/webhook-setup) — Configure Discord or other webhook integrations
- [Notification Flow](/guide/integrations/notification-flow) — Visual diagram of the complete system
