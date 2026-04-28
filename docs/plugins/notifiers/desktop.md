---
title: Desktop
nav_order: 1
parent: Notifier Plugins
grand_parent: Plugins
description: desktop notifier plugin — OS native desktop notifications via osascript (macOS) and notify-send (Linux) with sound alerts for urgent events and text-based action fallback.
---

# Desktop Notifier

The **desktop** plugin sends OS native notifications using `osascript` on macOS and `notify-send` on Linux. It is one of two default notifiers (alongside `composio`). Requires zero configuration and no network access.

{: .highlight }
> **Zero config:** The desktop notifier is auto-loaded and active by default. No environment variables or API keys needed. Works immediately on macOS and Linux.

---

## Plugin Info

| Field | Value |
|-------|-------|
| **Name** | `desktop` |
| **Slot** | `notifier` |
| **Package** | `@composio/ao-plugin-notifier-desktop` |
| **Version** | `0.1.0` |
| **Default** | Yes (auto-loaded, active by default) |

---

## How It Works

The desktop plugin detects the platform and uses the appropriate OS notification command:

```text
create(config?)
  |
  +-- Read config.sound (default: true)
  |
notify(event)
  |
  +-- macOS?
  |     +-- osascript -e 'display notification "..."
  |           with title "..." [sound name "default"]'
  |
  +-- Linux?
  |     +-- notify-send [--urgency=critical] "title" "message"
  |
  +-- Other?
        +-- Console warn + resolve (no-op)
```

---

## Transport

### macOS — osascript

- Uses `execFile("osascript", ["-e", script])`
- `display notification` with `with title` for the notification header
- Sound played via `sound name "default"` — only for `urgent` priority
- Title and message are escaped via `escapeAppleScript()` to prevent injection
- **No click-through URL support** — macOS `display notification` lacks URL capability

### Linux — notify-send

- Uses `execFile("notify-send", args)`
- Urgency mapping: `urgent` priority → `--urgency=critical`, else no urgency flag
- Standard title + message arguments

### Other Platforms

- Console warning: `Desktop notifications not supported on {os}`
- Resolves silently (does not throw)

---

## Methods

### Properties

| Property | Value |
|----------|-------|
| `name` | `"desktop"` |

### Required Methods (1)

#### notify(event)

Sends a desktop notification for an orchestrator event:

- Formats title: `"URGENT [sessionId]"` for urgent events, `"Agent Orchestrator [sessionId]"` otherwise
- Formats message: `event.message`
- Sound: plays default system sound only when `priority === "urgent"` and `config.sound !== false`
- Platform detection via `node:os` `platform()` function

### Optional Methods (1)

#### notifyWithActions(event, actions)

Sends a notification with action labels appended as text:

- Desktop notifications cannot display interactive action buttons
- **Fallback:** Actions are rendered as text labels appended to the message body: `"message\n\nActions: label1 | label2"`
- Uses same title/message formatting as `notify`
- Same sound and platform behavior as `notify`

---

## Configuration

### Default (No Config Needed)

```yaml
defaults:
  notifiers:
    - desktop    # active by default
```

### Disable Sound

```yaml
notifiers:
  desktop:
    plugin: desktop
    sound: false    # disable notification sound
```

### Configuration Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `plugin` | string | — | Must be `"desktop"` |
| `sound` | boolean | `true` | Play system sound on urgent notifications |

{: .highlight }
> **Sound only on urgent:** The sound config is a boolean toggle, not a per-priority setting. When enabled, sound plays only for `urgent` priority events. All other priorities are silent.

---

## Secondary Interface: NotificationPlugin

The desktop plugin also exports `createNotificationPlugin()` which implements the `NotificationPlugin` interface for use with `NotificationService`. This secondary interface provides:

- **Cross-platform support** via `node-notifier` npm package
- **Coalescing** — groups similar notifications within a configurable time window (default: 60 seconds). First notification sends immediately; duplicates within the window increment a counter, update to the latest notification data, and reset the timer. The eventual flush sends the last duplicate's content with the total count
- **Focus mode detection** — optional `respectFocusMode` config suppresses notifications during DND
- **Best-effort delivery** — errors are logged but never reject the promise

---

## When to Use

| Scenario | Recommendation |
|----------|---------------|
| Local development | Use desktop — zero config, works immediately |
| macOS or Linux workstation | Use desktop — native OS integration |
| Need sound alerts on urgent | Use desktop — only notifier with sound support |
| CI/server environment | Use slack, webhook, or composio — desktop requires a GUI |
| Need interactive action buttons | Use slack, telegram, or discord — desktop uses text fallback |

---

## Next Steps

- [Composio](../composio/) — Multi-channel notifications via Composio SDK
- [Slack](../slack/) — Slack webhook notifications with Block Kit
- [Notifier Plugins](./) — Notifier plugin comparison and configuration
- [Plugins](../../) — Plugin comparison and configuration
- [Configuration](../../../../getting-started/configuration/) — Full config reference
