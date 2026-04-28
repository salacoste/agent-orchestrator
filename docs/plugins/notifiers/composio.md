---
title: Composio
nav_order: 6
parent: Notifier Plugins
grand_parent: Plugins
description: composio notifier plugin — multi-channel notifications via Composio SDK supporting Slack, Discord, and Gmail with lazy SDK loading, 30s timeout, and multi-app routing.
---

# Composio Notifier

The **composio** plugin sends notifications through the Composio SDK, routing messages to Slack, Discord, or Gmail via a unified API. It is one of two default notifiers (alongside `desktop`). The Composio SDK is lazy-loaded on first use — if not installed, the plugin logs a warning and becomes a no-op.

{: .highlight }
> **Zero config for defaults:** The composio notifier is active by default. Set `COMPOSIO_API_KEY` in your environment and install `composio-core`. If the SDK is not installed, notifications silently no-op without crashing.

---

## Plugin Info

| Field | Value |
|-------|-------|
| **Name** | `composio` |
| **Slot** | `notifier` |
| **Package** | `@composio/ao-plugin-notifier-composio` |
| **Version** | `0.1.0` |
| **Default** | Yes (auto-loaded, active by default) |

---

## How It Works

The composio plugin lazy-loads the Composio SDK and routes notifications through Composio's action API:

```text
create(config?)
  |
  +-- Read composioApiKey (or COMPOSIO_API_KEY env)
  +-- Validate defaultApp (slack, discord, gmail)
  +-- Validate emailTo required when defaultApp=gmail
  |
notify(event)
  |
  +-- getClient()
  |     +-- First call: lazy-load composio-core
  |     +-- Create Composio({ apiKey })
  |     +-- Cache client for reuse
  |
  +-- Format message text
  +-- Build tool args for app
  +-- executeAction({ action: SLUG, params })
  |     +-- 30s timeout via AbortSignal
  |     +-- Throw on !result.successful
  |
  +-- Done
```

---

## Transport

- Uses Composio SDK (`composio-core`) for API routing
- **Lazy-loaded** — SDK is imported via dynamic `import()` on first notification
- **Graceful degradation** — if `composio-core` is not installed, logs warning once and all notifications no-op
- **30-second timeout** — each API call wrapped in `AbortSignal.timeout(30000)`
- API key: `config.composioApiKey` or `COMPOSIO_API_KEY` environment variable
- **Throws on failure** — `Composio action {slug} failed: {error}` when `result.successful === false`

---

## Channel Options

The composio plugin supports three channels via Composio's unified API:

### Slack

- Tool slug: `SLACK_SEND_MESSAGE`
- Parameters: `{ text, channel? }` — channel accepts channel ID or channel name

### Discord

- Tool slug: `DISCORD_SEND_MESSAGE`
- Parameters: `{ content, channel_id? }` — `channel_id` accepts channel ID or channel name (both mapped to the same parameter)

### Gmail

- Tool slug: `GMAIL_SEND_EMAIL`
- Parameters: `{ to, subject, body }` — `to` is required (validated at config time)
- Subject: `"Agent Orchestrator Notification"` (constant)
- **Requires `emailTo` config** — throws at plugin creation if `defaultApp === "gmail"` and `emailTo` is missing

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
| `name` | `"composio"` |

### Required Methods (1)

#### notify(event)

Sends a notification through the configured Composio channel:

- Formats message: `"{emoji} *{eventType}* — {sessionId}\n{message}"` plus PR link if available. Note: the `*` characters are sent as plain text through the Composio SDK, not rendered as bold
- Resolves tool slug from `APP_TOOL_SLUG[defaultApp]`
- Builds parameters via `buildToolArgs()` — handles Slack, Discord, and Gmail parameter differences
- Calls `executeWithTimeout()` with 30-second deadline
- **No-op** if no API key or SDK not installed

### Optional Methods (2)

#### notifyWithActions(event, actions)

Sends a notification with action details:

- Same base formatting as `notify`
- Appends `"\n\nActions:\n- label: url"` for each action
- Actions without URLs show as `"- label"` (no link)
- Same channel routing and timeout as `notify`

#### post(message, context?)

Posts a plain message through the configured channel:

- Channel override: `context?.channel ?? channelId ?? channelName`
- Builds app-specific parameters:
  - Slack: `{ text: message, channel? }`
  - Discord: `{ content: message, channel_id? }`
  - Gmail: `{ to: emailTo, subject: "...", body: message }`
- Returns `null`

---

## Configuration

### Default (Slack channel)

```yaml
defaults:
  notifiers:
    - composio    # active by default
```

```bash
export COMPOSIO_API_KEY="cmp_xxx..."
npm install composio-core
```

### Discord Channel

```yaml
notifiers:
  composio:
    plugin: composio
    composioApiKey: "cmp_xxx..."
    defaultApp: discord
    channelId: "1234567890"
```

### Gmail Channel

```yaml
notifiers:
  composio:
    plugin: composio
    composioApiKey: "cmp_xxx..."
    defaultApp: gmail
    emailTo: "team@example.com"
```

### Configuration Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `plugin` | string | Yes | — | Must be `"composio"` |
| `composioApiKey` | string | No* | `COMPOSIO_API_KEY` env | Composio API key |
| `defaultApp` | string | No | `"slack"` | Channel: `"slack"`, `"discord"`, or `"gmail"` |
| `channelId` | string | No | — | Target channel ID (Slack or Discord) |
| `channelName` | string | No | — | Target channel name (Slack or Discord) |
| `emailTo` | string | No* | — | Email recipient (required when `defaultApp` is `"gmail"`) |

{: .highlight }
> **Invalid `defaultApp` throws:** If `defaultApp` is not one of `"slack"`, `"discord"`, or `"gmail"`, the plugin throws at creation time with `[notifier-composio] Invalid defaultApp: "{value}". Must be one of: slack, discord, gmail`.

---

## When to Use

| Scenario | Recommendation |
|----------|---------------|
| Multi-channel via one plugin | Use composio — routes to Slack, Discord, Gmail |
| Zero-config defaults | Use composio — active by default with env var |
| Don't want to manage webhooks | Use composio — SDK handles auth and routing |
| Need Slack Block Kit formatting | Use slack — composio sends plain text |
| Need Discord rich embeds | Use discord — composio sends plain text |
| Only need one channel | Use the native plugin (slack/discord) for richer formatting |

---

## Next Steps

- [Desktop](../desktop/) — macOS/Linux desktop notifications (default pair)
- [Slack](../slack/) — Native Slack webhook with Block Kit
- [Notifier Plugins](./) — Notifier plugin comparison and configuration
- [Plugins](../../) — Plugin comparison and configuration
- [Configuration](../../../../getting-started/configuration/) — Full config reference
