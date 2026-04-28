---
title: Notifier Plugins
nav_order: 6
parent: Plugins
has_children: true
description: Notifier plugin slot with 6 built-in plugins — composio and desktop (defaults), slack, webhook, discord, telegram. Push-based notification interface, routing by priority, and configuration guide.
---

# Notifier Plugins

The notifier plugin is the **primary interface between the orchestrator and the human**. The human walks away after spawning agents. Notifications bring them back. **Push, not pull.** The human never polls.

Agent Orchestrator ships with **6 notifier plugins**: **composio** (default, multi-channel via SDK), **desktop** (default, OS native alerts), **slack** (webhook + Block Kit), **webhook** (generic HTTP with retry), **discord** (webhook + embeds), and **telegram** (Bot API via grammY).

{: .highlight }
> **TL;DR:** 6 plugins — composio + desktop (defaults, zero config), slack (webhook), webhook (custom HTTP), telegram (mobile), discord (team chat). Notifier is unique: supports an **array** of plugins simultaneously. Multiple notifiers can be active at the same time.

---

## Notifier Is Unique

Unlike all other plugin slots that accept a single plugin, the notifier slot accepts an **array of plugins**. Multiple notifiers run simultaneously — a notification can be pushed to desktop, Slack, and Telegram at the same time.

```text
OrchestratorEvent
  |
  +-- EventPriority: "urgent"
  |     +-- notificationRouting maps to:
  |           +-- [desktop, composio]
  |
  +-- EventPriority: "info"
        +-- notificationRouting maps to:
              +-- [composio]
```

Default notifiers: `["composio", "desktop"]` from `DefaultPluginsSchema`.

---

## Notifier Interface

All notifier plugins implement the `Notifier` interface from `@composio/ao-core`. The interface defines **1 required property**, **1 required method**, and **2 optional methods**:

### Properties

| Property | Required | Description |
|----------|----------|-------------|
| `name` | Yes | Plugin display name (e.g., `"desktop"`, `"slack"`) |

### Required Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `notify(event)` | `Promise<void>` | Push a notification for an orchestrator event |

### Optional Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `notifyWithActions?(event, actions)` | `Promise<void>` | Push a notification with actionable buttons/links |
| `post?(message, context?)` | `Promise<string \| null>` | Post a plain message to a channel; optionally return message ID |

{: .highlight }
> **Legacy vs. secondary pattern:** The `Notifier` interface (Plugin Slot 6) accepts `OrchestratorEvent` objects. A secondary `NotificationPlugin` interface (used by `NotificationService`) accepts `Notification` objects with richer types (priority, title, metadata). The legacy `Notifier` interface is the primary contract documented here.

---

## Supporting Types

### NotifyAction (3 fields)

| Field | Type | Description |
|-------|------|-------------|
| `label` | string | Button/link text |
| `url?` | string | URL to open when action is clicked |
| `callbackEndpoint?` | string | Server endpoint to call for the action |

### NotifyContext (4 fields)

| Field | Type | Description |
|-------|------|-------------|
| `sessionId?` | string | Associated session ID |
| `projectId?` | string | Associated project ID |
| `prUrl?` | string | Associated pull request URL |
| `channel?` | string | Target channel override |

### EventPriority (4 values)

`"urgent"` | `"action"` | `"warning"` | `"info"`

### NotifierConfig

```typescript
interface NotifierConfig {
  plugin: string;
  [key: string]: unknown;
}
```

---

## Plugin Comparison

| Feature | desktop | composio | slack | webhook | discord | telegram |
|---------|---------|----------|-------|---------|---------|----------|
| **Transport** | OS native (osascript, notify-send) | Composio SDK | HTTP webhook (Block Kit) | HTTP POST with retry | HTTP webhook (embeds) | grammY Bot API |
| **Auto-loaded** | Yes (default) | Yes (default) | Yes | Yes | No | No |
| **notify** | Yes | Yes | Yes | Yes | Yes | Yes |
| **notifyWithActions** | Yes (text fallback) | Yes | Yes (Block Kit buttons) | Yes (in payload) | Yes (embed fields) | Yes (inline keyboard) |
| **post** | — | Yes (returns null) | Yes (returns null) | Yes (returns null) | Yes (returns null) | Yes (returns message_id) |
| **Auth** | None | `COMPOSIO_API_KEY` | webhook URL | webhook URL | webhook URL | `botToken` |
| **Network** | No | Yes | Yes | Yes | Yes | Yes |
| **Sound** | Yes (macOS) | No | No | No | No | No |
| **Retry** | No | No | No | Yes (exponential backoff) | No | Yes (rate limit) |

---

## Configuration

### Default Notifiers

```yaml
defaults:
  notifiers:
    - composio
    - desktop
```

### Notification Routing

Maps `EventPriority` to an array of notifier names. Each event is delivered to all notifiers listed for its priority level:

```yaml
notificationRouting:
  urgent: [desktop, composio]    # both desktop and Composio
  action: [desktop, composio]    # both desktop and Composio
  warning: [composio]            # Composio only
  info: [composio]               # Composio only
```

### Notification Digest

Optional digest mode batches notifications and delivers them on a schedule:

```yaml
notificationDigest:
  enabled: true
  schedule: "09:00"    # HH:MM format (00:00-23:59)
  timezone: "UTC"
```

### Per-Notifier Configuration

Individual notifier channels are configured at the top level:

```yaml
notifiers:
  slack:
    plugin: slack
    webhookUrl: ${SLACK_WEBHOOK_URL}
    channel: "#agent-updates"
  telegram:
    plugin: telegram
    botToken: ${TELEGRAM_BOT_TOKEN}
    defaultChatId: ${TELEGRAM_CHAT_ID}
  discord:
    plugin: discord
    webhookUrl: ${DISCORD_WEBHOOK_URL}
```

---

## Child Pages

- [Desktop](desktop/) — macOS/Linux OS native notifications (default)
- [Composio](composio/) — Multi-channel notifications via Composio SDK (default)
- [Slack](slack/) — Slack webhook notifications with Block Kit
- [Webhook](webhook/) — Generic HTTP webhook with retry
- [Discord](discord/) — Discord webhook notifications with rich embeds
- [Telegram](telegram/) — Telegram bot via grammY with inline keyboards

---

## When to Use

| Scenario | Recommendation |
|----------|---------------|
| Local development | Use desktop — zero config, sound alerts on urgent |
| Team notifications | Use slack or discord — team-visible messages |
| Mobile notifications | Use telegram — push to phone via bot |
| Custom integrations | Use webhook — structured HTTP payloads with retry |
| Multi-channel via one plugin | Use composio — SDK routes to Slack, Discord, Gmail |
| Multiple simultaneous notifiers | Configure notificationRouting — each priority level can use different notifiers |

---

## Next Steps

- [Desktop](desktop/) — macOS/Linux desktop notification setup
- [Plugins](../) — Plugin comparison and configuration
- [Configuration](../../../getting-started/configuration/) — Full config reference
