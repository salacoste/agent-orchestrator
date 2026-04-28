---
title: Discord
nav_order: 3
parent: Notifier Plugins
grand_parent: Plugins
description: discord notifier plugin — Discord webhook notifications with rich embeds, priority color mapping, mention support, and field-based event display.
---

# Discord Notifier

The **discord** plugin sends notifications to Discord via webhook URLs. It uses Discord rich embeds with priority-based colors, emoji prefixes, and structured fields for project, priority, session, PR link, CI status, and action buttons.

{: .highlight }
> **Setup:** Create a Discord webhook in your server settings (Server Settings > Integrations > Webhooks). Copy the webhook URL and add it to your config. No additional npm dependencies beyond `@composio/ao-core`.

---

## Plugin Info

| Field | Value |
|-------|-------|
| **Name** | `discord` |
| **Slot** | `notifier` |
| **Package** | `@composio/ao-plugin-notifier-discord` |
| **Version** | `0.1.0` |
| **Default** | No (not auto-loaded) |

---

## How It Works

The discord plugin builds rich embed payloads and sends them as HTTP POST requests to a Discord webhook URL:

```text
create(config?)
  |
  +-- Read webhookUrl, username, mentions
  +-- validateUrl(webhookUrl) if provided
  |
notify(event)
  |
  +-- Build rich embed:
  |     +-- title: emoji + eventType
  |     +-- description: event.message
  |     +-- color: priority decimal color
  |     +-- fields: Project, Priority, Session
  |     +-- optional: PR link, CI status
  |     +-- footer: "agent-orchestrator"
  |     +-- timestamp: ISO string
  |
  +-- POST to webhookUrl
  +-- Append mention if configured for priority
```

---

## Transport

- Uses `fetch()` for HTTP POST requests
- Content-Type: `application/json`
- URL validated via `validateUrl()` at plugin creation time
- **Errors are logged, not thrown** — non-2xx responses log `[notifier-discord] Webhook failed ({status})` and delivery failures log `[notifier-discord] Delivery failed: {message}`
- No retry logic
- No direct HTTP library dependency — uses native `fetch`

---

## Priority Color Mapping

| EventPriority | Decimal Color | Visual |
|---------------|---------------|--------|
| `urgent` | `16711680` | Red |
| `action` | `3447003` | Blue |
| `warning` | `16776960` | Yellow |
| `info` | `5763719` | Green |

---

## Priority Emoji Mapping

| EventPriority | Emoji |
|---------------|-------|
| `urgent` | :rotating_light: |
| `action` | :point_right: |
| `warning` | :warning: |
| `info` | :information_source: |

---

## Methods

### Properties

| Property | Value |
|----------|-------|
| `name` | `"discord"` |

### Required Methods (1)

#### notify(event)

Sends a rich embed notification for an orchestrator event:

- **Title**: `"{emoji} {eventType}"` — emoji prefix based on priority
- **Description**: `event.message`
- **Color**: Decimal color from priority mapping
- **Fields** (always present):
  - Project (`event.projectId`, inline)
  - Priority (`event.priority`, inline)
  - Session (`event.sessionId`, inline)
- **Optional fields**:
  - Pull Request: `[View PR]({prUrl})` — only when `event.data.prUrl` exists
  - CI Status: checkmark emoji + status when passing, cross emoji + status otherwise — only when `event.data.ciStatus` exists. Non-passing statuses (`"failing"`, `"pending"`, `"none"`) all display the cross icon
- **Footer**: `"agent-orchestrator"`
- **Timestamp**: `event.timestamp.toISOString()`
- **Mentions**: If `mentions[event.priority]` is configured, adds it as `content` in the payload

### Optional Methods (2)

#### notifyWithActions(event, actions)

Sends a rich embed notification with action links:

- Same embed structure as `notify`
- **Actions field**: Filters actions with URLs, formats as `"[label](url)"` links joined with `" | "`
- Actions without URLs are excluded from the field
- Mentions work the same as `notify`

#### post(message, context?)

Posts a plain text message to the webhook:

- Sends `{ username, content: message }` payload
- Context parameter accepted but not used for channel routing
- Returns `null` (Discord webhooks don't return message IDs in the response)

---

## Configuration

### Basic Setup

```yaml
notifiers:
  discord:
    plugin: discord
    webhookUrl: https://discord.com/api/webhooks/123456/xxx
```

### With Mentions

```yaml
notifiers:
  discord:
    plugin: discord
    webhookUrl: https://discord.com/api/webhooks/123456/xxx
    username: "Agent Orchestrator"
    mentions:
      urgent: "<@&ROLE_ID>"     # ping a role on urgent events
      warning: "<@USER_ID>"     # ping a user on warnings
```

### Configuration Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `plugin` | string | Yes | — | Must be `"discord"` |
| `webhookUrl` | string | Yes | — | Discord webhook URL |
| `username` | string | No | `"Agent Orchestrator"` | Bot display name |
| `mentions` | object | No | `{}` | Priority-to-mention mapping (e.g., `{ urgent: "<@&ROLE>" }`) |

{: .highlight }
> **No webhook URL = no-op:** If `webhookUrl` is not configured, the plugin logs a warning and all notification methods return immediately.

---

## When to Use

| Scenario | Recommendation |
|----------|---------------|
| Team chat notifications | Use discord — rich embeds in shared channels |
| Need priority-colored messages | Use discord — red/blue/yellow/green embed colors |
| Need role/user mentions | Use discord — per-priority mention config |
| Need message threading | Use slack — Discord webhooks lack thread support |
| Private mobile notifications | Use telegram — Discord requires server access |
| Custom integrations | Use webhook — more flexible payload format |

---

## Next Steps

- [Slack](../slack/) — Slack webhook notifications with Block Kit
- [Telegram](../telegram/) — Telegram bot with inline keyboards
- [Notifier Plugins](./) — Notifier plugin comparison and configuration
- [Plugins](../../) — Plugin comparison and configuration
- [Configuration](../../../../getting-started/configuration/) — Full config reference
