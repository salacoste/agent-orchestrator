---
title: Webhook
nav_order: 5
parent: Notifier Plugins
grand_parent: Plugins
description: webhook notifier plugin — generic HTTP webhook notifications with retry and exponential backoff, structured payload types, and custom header support.
---

# Webhook Notifier

The **webhook** plugin sends notifications to any HTTP endpoint. It posts structured JSON payloads with three distinct types (`notification`, `notification_with_actions`, `message`) and includes retry logic with exponential backoff for transient failures.

{: .highlight }
> **Reliability:** The webhook plugin is the only notifier with built-in retry logic. It retries on 429 (rate limit) and 5xx (server error) responses with exponential backoff. Client errors (4xx) fail immediately.

---

## Plugin Info

| Field | Value |
|-------|-------|
| **Name** | `webhook` |
| **Slot** | `notifier` |
| **Package** | `@composio/ao-plugin-notifier-webhook` |
| **Version** | `0.1.0` |
| **Default** | No (auto-loaded but not in defaults) |

---

## How It Works

The webhook plugin serializes events into structured JSON payloads and posts them with retry:

```text
create(config?)
  |
  +-- Read url, headers, retries, retryDelayMs
  +-- validateUrl(url) if provided
  |
notify(event)
  |
  +-- Serialize event to WebhookPayload
  +-- postWithRetry(url, payload, headers,
        retries, retryDelayMs)
        |
        +-- Attempt 0: POST
        |     +-- 2xx: done
        |     +-- 4xx (non-429): throw immediately
        |     +-- 429 or 5xx: retry
        |
        +-- Attempt 1: delay * 2^0, POST
        +-- Attempt 2: delay * 2^1, POST
        +-- ...
```

---

## Transport

- Uses `fetch()` for HTTP POST requests
- Content-Type: `application/json` (merged with custom headers)
- URL validated via `validateUrl()` at plugin creation time
- **Retry logic**: Only retries on 429 and 5xx status codes
- **No retry on 4xx**: Client errors (400, 401, 403, 404, etc.) are permanent failures — thrown immediately
- **Exponential backoff**: `retryDelayMs * 2^attempt` — delay doubles with each retry
- No direct HTTP library dependency — uses native `fetch`

---

## Payload Types

The webhook plugin sends three distinct payload types, identified by the `type` field:

### notification

```json
{
  "type": "notification",
  "event": {
    "id": "evt-123",
    "type": "ci.failing",
    "priority": "urgent",
    "sessionId": "sess-abc",
    "projectId": "my-app",
    "timestamp": "2026-04-23T10:30:00.000Z",
    "message": "CI is failing on PR #42",
    "data": {}
  }
}
```

### notification_with_actions

```json
{
  "type": "notification_with_actions",
  "event": { "...": "..." },
  "actions": [
    { "label": "View PR", "url": "https://github.com/org/repo/pull/42" },
    { "label": "Approve", "callbackEndpoint": "/api/approve" }
  ]
}
```

### message

```json
{
  "type": "message",
  "message": "Sprint complete for my-app",
  "context": { "projectId": "my-app" }
}
```

---

## Methods

### Properties

| Property | Value |
|----------|-------|
| `name` | `"webhook"` |

### Required Methods (1)

#### notify(event)

Sends a `notification` payload with the serialized event:

- Serializes event via `serializeEvent()`: extracts `id`, `type`, `priority`, `sessionId`, `projectId`, `timestamp` (ISO string), `message`, `data`
- Posts with retry and exponential backoff
- **No-op** if `url` is not configured

### Optional Methods (2)

#### notifyWithActions(event, actions)

Sends a `notification_with_actions` payload:

- Same serialized event as `notify`
- Maps actions to `{ label, url?, callbackEndpoint? }` objects
- Posts with retry and exponential backoff

#### post(message, context?)

Sends a `message` payload:

- Includes raw `message` string and optional `context` object
- Returns `null` (webhook endpoints don't have a standard message ID format)

---

## Configuration

### Basic Setup

```yaml
notifiers:
  webhook:
    plugin: webhook
    url: https://example.com/notifications
```

### With Custom Headers and Retry

```yaml
notifiers:
  webhook:
    plugin: webhook
    url: https://example.com/notifications
    headers:
      Authorization: "Bearer token123"
      X-Custom-Header: "value"
    retries: 3
    retryDelayMs: 2000
```

### Configuration Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `plugin` | string | Yes | — | Must be `"webhook"` |
| `url` | string | Yes | — | Target HTTP endpoint URL |
| `headers` | object | No | `{}` | Custom HTTP headers (string values only) |
| `retries` | number | No | `2` | Maximum retry attempts (0 = no retry) |
| `retryDelayMs` | number | No | `1000` | Base delay in ms for exponential backoff |

{: .highlight }
> **No URL = no-op:** If `url` is not configured, the plugin logs a warning and all notification methods return immediately. Invalid `retries` values are clamped to 0 minimum; invalid `retryDelayMs` defaults to 1000.

---

## When to Use

| Scenario | Recommendation |
|----------|---------------|
| Custom HTTP integrations | Use webhook — any endpoint accepts JSON |
| Need retry on failure | Use webhook — only notifier with exponential backoff |
| Need custom headers (auth) | Use webhook — arbitrary header support |
| Team-visible notifications | Use slack or discord — purpose-built integrations |
| Mobile notifications | Use telegram — webhook requires an HTTP server |
| Zero network | Use desktop — webhook requires network access |

---

## Next Steps

- [Slack](../slack/) — Slack webhook notifications with Block Kit
- [Discord](../discord/) — Discord webhook notifications with rich embeds
- [Notifier Plugins](./) — Notifier plugin comparison and configuration
- [Plugins](../../) — Plugin comparison and configuration
- [Configuration](../../../../getting-started/configuration/) — Full config reference
