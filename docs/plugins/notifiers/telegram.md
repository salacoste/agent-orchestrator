---
title: Telegram
nav_order: 4
parent: Notifier Plugins
grand_parent: Plugins
description: telegram notifier plugin — Telegram bot notifications via grammY with MarkdownV2 formatting, inline keyboard actions, message ID return, and rate limit retry.
---

# Telegram Notifier

The **telegram** plugin sends notifications through a Telegram bot using the grammY framework. It supports MarkdownV2 message formatting, inline keyboard action buttons, per-message channel targeting, and rate limit retry with backoff. Unique among notifiers, its `post` method returns the Telegram `message_id`.

{: .highlight }
> **Setup:** Create a Telegram bot via `@BotFather`, copy the bot token, and get your chat ID. Add both to your config. Requires the `grammy` and `@grammyjs/conversations` peer dependencies.

---

## Plugin Info

| Field | Value |
|-------|-------|
| **Name** | `telegram` |
| **Slot** | `notifier` |
| **Package** | `@composio/ao-plugin-notifier-telegram` |
| **Version** | `0.1.0` |
| **Default** | No (not auto-loaded) |

---

## How It Works

The telegram plugin creates a lazy-initialized `TelegramBot` instance and sends MarkdownV2-formatted messages with optional inline keyboards:

```text
create(config?)
  |
  +-- Read botToken, defaultChatId, allowedChatIds, mode
  +-- Warn if no botToken or defaultChatId
  |
notify(event)
  |
  +-- Get or create TelegramBot (lazy init)
  +-- Format message (MarkdownV2)
  |     +-- emoji + bold eventType
  |     +-- Priority, Project, Agent fields
  |     +-- event.message body
  |
  +-- sendWithRetry(bot, chatId, text,
        { parse_mode: "MarkdownV2" })
```

---

## Transport

- Uses grammY framework for Telegram Bot API communication
- **Lazy-initialized bot** — `TelegramBot` instance created on first use, not at config time
- MarkdownV2 formatting with special character escaping via `escapeMarkdownV2()`
- Rate limit handling: `sendWithRetry()` catches 429 errors, extracts `retry_after`, and backs off
- Supports both polling and webhook modes (configured via `mode`)

---

## Priority Emoji Mapping

| EventPriority | Emoji |
|---------------|-------|
| `urgent` | :red_circle: |
| `action` | :yellow_circle: |
| `warning` | :green_circle: |
| `info` (default) | :information_source: |

---

## Methods

### Properties

| Property | Value |
|----------|-------|
| `name` | `"telegram"` |

### Required Methods (1)

#### notify(event)

Sends a MarkdownV2 notification for an orchestrator event:

- **Header**: `"{emoji} *{eventType}*"`
- **Fields**: `"*Priority:* {priority}"`, `"*Project:* {projectId}"`, `"*Agent:* {sessionId}"`
- **Body**: `event.message` — all text escaped via `escapeMarkdownV2()`
- Sends with `parse_mode: "MarkdownV2"`
- Uses `sendWithRetry()` for automatic rate limit handling
- **No-op** if `botToken` or `defaultChatId` is missing

### Optional Methods (2)

#### notifyWithActions(event, actions)

Sends a notification with an inline keyboard:

- Same MarkdownV2 message formatting as `notify`
- **Inline keyboard**: Each action becomes a button row:
  - Actions with `url`: `{ text: label, url: url }`
  - Actions with `callbackEndpoint` (<= 64 chars): `{ text: label, callback_data: callbackEndpoint }`
  - `callbackEndpoint` longer than 64 characters is silently omitted (Telegram API limit)
- `callback_data` is limited to 64 bytes by the Telegram Bot API

#### post(message, context?)

Posts a plain text message and returns the message ID:

- Target chat: `context?.channel ?? defaultChatId` — allows per-message chat targeting
- Returns `String(result.message_id)` if available, `null` otherwise
- **Unique among notifiers:** Only telegram returns a non-null message ID from `post`

{: .highlight }
> **Message ID return:** The `post` method returns the Telegram `message_id` as a string. This enables downstream operations like replying to or editing a previously sent message.

---

## Configuration

### Basic Setup

```yaml
notifiers:
  telegram:
    plugin: telegram
    botToken: "123456:ABC-DEF..."
    defaultChatId: "-1001234567890"
```

### With Allowed Chat IDs and Webhook Mode

```yaml
notifiers:
  telegram:
    plugin: telegram
    botToken: "123456:ABC-DEF..."
    defaultChatId: "-1001234567890"
    allowedChatIds: [-1001234567890, 987654321]
    mode: webhook
    webhookUrl: https://example.com/webhook
    webhookSecret: "my-secret"
```

### Configuration Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `plugin` | string | Yes | — | Must be `"telegram"` |
| `botToken` | string | Yes | — | Telegram bot token from `@BotFather` |
| `defaultChatId` | string | Yes | — | Default target chat ID |
| `allowedChatIds` | (number \| string)[] | No | — | Allowed chat IDs for bot interactions |
| `mode` | `"polling" \| "webhook"` | No | — | Bot operation mode |
| `webhookUrl` | string | No | — | Webhook URL (when mode is `"webhook"`) |
| `webhookSecret` | string | No | — | Webhook secret token |

{: .highlight }
> **No botToken or defaultChatId = no-op:** If either is missing, the plugin logs a warning and all notification methods return immediately.

---

## When to Use

| Scenario | Recommendation |
|----------|---------------|
| Mobile push notifications | Use telegram — push to phone via Telegram app |
| Need message ID for replies | Use telegram — only notifier returning `message_id` |
| Need interactive inline buttons | Use telegram — inline keyboards with URL and callback buttons |
| Team-visible notifications | Use slack or discord — Telegram is 1:1 by default |
| No peer dependencies wanted | Use slack or discord — telegram requires `grammy` |
| Private notifications | Use telegram — direct bot-to-user messages |

---

## Next Steps

- [Discord](../discord/) — Discord webhook notifications with rich embeds
- [Slack](../slack/) — Slack webhook notifications with Block Kit
- [Notifier Plugins](./) — Notifier plugin comparison and configuration
- [Plugins](../../) — Plugin comparison and configuration
- [Configuration](../../../../getting-started/configuration/) — Full config reference
