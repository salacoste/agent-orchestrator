---
title: Slack
nav_order: 2
parent: Notifier Plugins
grand_parent: Plugins
description: slack notifier plugin — Slack incoming webhook notifications with Block Kit formatting, priority emoji mapping, action buttons, and channel override support.
---

# Slack Notifier

The **slack** plugin sends notifications to Slack via incoming webhooks. It uses Slack Block Kit for rich formatting with priority emoji headers, context sections, CI status indicators, and interactive action buttons.

{: .highlight }
> **Setup:** Create a Slack incoming webhook at `https://api.slack.com/messaging/webhooks`. Copy the webhook URL and add it to your config. No additional npm dependencies beyond `@composio/ao-core`.

---

## Plugin Info

| Field | Value |
|-------|-------|
| **Name** | `slack` |
| **Slot** | `notifier` |
| **Package** | `@composio/ao-plugin-notifier-slack` |
| **Version** | `0.1.0` |
| **Default** | No (auto-loaded but not in defaults) |

---

## How It Works

The slack plugin builds Block Kit payloads and sends them as HTTP POST requests to a webhook URL:

```text
create(config?)
  |
  +-- Read webhookUrl, channel, username
  +-- validateUrl(webhookUrl) if provided
  |
notify(event)
  |
  +-- Build Block Kit blocks:
  |     +-- header: emoji + eventType + sessionId
  |     +-- section: event.message (mrkdwn)
  |     +-- context: project, priority, timestamp
  |     +-- section: PR link (if data.prUrl)
  |     +-- context: CI status (if data.ciStatus)
  |     +-- divider
  |
  +-- POST to webhookUrl
```

---

## Transport

- Uses `fetch()` for HTTP POST requests
- Content-Type: `application/json`
- URL validated via `validateUrl()` at plugin creation time
- **Throws on non-2xx response** — `Slack webhook failed ({status}): {body}`
- No retry logic — failures surface immediately
- No direct HTTP library dependency — uses native `fetch`

---

## Priority Emoji Mapping

| EventPriority | Emoji |
|---------------|-------|
| `urgent` | `:rotating_light:` |
| `action` | `:point_right:` |
| `warning` | `:warning:` |
| `info` | `:information_source:` |

---

## Methods

### Properties

| Property | Value |
|----------|-------|
| `name` | `"slack"` |

### Required Methods (1)

#### notify(event)

Sends a Block Kit notification for an orchestrator event:

- **Header block**: `"{emoji} {eventType} — {sessionId}"` (plain_text)
- **Message section**: `event.message` (mrkdwn)
- **Context block**: `"*Project:* {projectId} | *Priority:* {priority} | *Time:* {timestamp}"`
- **PR link section**: Only added when `event.data.prUrl` exists — `":github: <{prUrl}|View Pull Request>"`
- **CI status context**: Only added when `event.data.ciStatus` exists — `":white_check_mark: CI: passing"` or `":x: CI: failing"`
- Timestamp formatted using Slack's `<!date^...>` tag for locale-aware display
- Ends with a divider block

### Optional Methods (2)

#### notifyWithActions(event, actions)

Sends a Block Kit notification with interactive action buttons:

- Same header, message, and context blocks as `notify`
- **Action buttons block**: Each action with a `url` becomes a link button; each with a `callbackEndpoint` becomes an action button with `action_id: "ao_{sanitized}_{idx}"`
- Action IDs are sanitized: lowercase, non-alphanumeric replaced with `_`, leading/trailing underscores stripped, then suffixed with the action's index: `ao_{sanitized}_{idx}`. If the label is entirely non-alphanumeric (empty after sanitization), the format falls back to `ao_action_{idx}`
- Buttons with both `url` and `callbackEndpoint` prefer the `url` (first check)

#### post(message, context?)

Posts a plain text message to a channel:

- Sends `{ username, text: message }` payload
- Channel override: `context?.channel ?? defaultChannel` — allows per-message channel targeting
- Returns `null` (Slack incoming webhooks do not return message IDs)

---

## Configuration

### Basic Setup

```yaml
notifiers:
  slack:
    plugin: slack
    webhookUrl: https://hooks.slack.com/services/T00/B00/xxx
```

### With Channel and Username

```yaml
notifiers:
  slack:
    plugin: slack
    webhookUrl: https://hooks.slack.com/services/T00/B00/xxx
    channel: "#agent-updates"
    username: "Agent Orchestrator"
```

### Configuration Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `plugin` | string | Yes | — | Must be `"slack"` |
| `webhookUrl` | string | Yes | — | Slack incoming webhook URL |
| `channel` | string | No | — | Default channel override |
| `username` | string | No | `"Agent Orchestrator"` | Bot display name |

{: .highlight }
> **No webhook URL = no-op:** If `webhookUrl` is not configured, the plugin logs a warning and all notification methods return immediately without sending.

---

## When to Use

| Scenario | Recommendation |
|----------|---------------|
| Team-visible notifications | Use slack — messages appear in shared channels |
| Need interactive action buttons | Use slack — Block Kit buttons with URLs |
| CI/PR status updates | Use slack — native CI status and PR link blocks |
| Private mobile notifications | Use telegram — Slack requires team workspace |
| Custom integrations | Use webhook — more flexible payload format |

---

## Next Steps

- [Discord](../discord/) — Discord webhook notifications with rich embeds
- [Telegram](../telegram/) — Telegram bot with inline keyboards
- [Notifier Plugins](./) — Notifier plugin comparison and configuration
- [Plugins](../../) — Plugin comparison and configuration
- [Configuration](../../../../getting-started/configuration/) — Full config reference
