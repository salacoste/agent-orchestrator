---
title: Web Terminal
nav_order: 2
parent: Terminal Plugins
grand_parent: Plugins
description: Web terminal plugin — in-memory session tracking with URL generation for xterm.js dashboard integration. Lightweight stub that delegates terminal rendering to the frontend.
---

# Web Terminal

The **web** plugin tracks session terminal state in memory and generates dashboard URLs. It does not open any actual terminal — the web dashboard's xterm.js frontend handles the real terminal connection. This plugin is a lightweight tracking layer.

{: .highlight }
> **In-memory only:** The open-sessions Set is not persisted. If the process restarts, all "open" state is lost and `isSessionOpen` returns `false` for all sessions. The actual terminal connection is managed by the web dashboard's xterm.js frontend.

---

## Plugin Info

| Field | Value |
|-------|-------|
| **Name** | `web` |
| **Slot** | `terminal` |
| **Package** | `@composio/ao-plugin-terminal-web` |
| **Version** | `0.1.0` |
| **Default** | No |

---

## How It Works

The web plugin maintains an in-memory `Set<string>` of open session IDs:

```text
create(config?)
  |
  +-- Read dashboardUrl from config
  +-- Default: http://localhost:5000

openSession(session)
  |
  +-- Add session.id to openSessions Set
  +-- Log URL: {dashboardUrl}/sessions/{id}/terminal

openAll(sessions)
  |
  +-- For each session: add session.id to Set
  +-- Log aggregated URL with session count

isSessionOpen(session)
  |
  +-- Return openSessions.has(session.id)
```

---

## Transport

- **No actual terminal opening** — the plugin delegates to the web dashboard's xterm.js frontend
- URL pattern: `{dashboardUrl}/sessions/{session.id}/terminal`
- Primary output is `console.log` with the terminal URL
- `Set.add()` and `Set.has()` never throw — no error handling needed

---

## Methods

### Properties

| Property | Value |
|----------|-------|
| `name` | `"web"` |

### Required Methods (2)

#### openSession(session)

Tracks a session as "open" and logs the terminal URL:

- Adds `session.id` to the in-memory `openSessions` Set
- Logs the dashboard terminal URL to console
- Cannot throw — only does Set operations and console.log

#### openAll(sessions)

Opens terminal views for all sessions:

- Iterates sessions, adding each `session.id` to the `openSessions` Set (does NOT call `openSession` — uses its own inline loop)
- Logs a single aggregated URL with session count (e.g., `[terminal-web] 3 sessions available at http://localhost:5000/sessions`)

### Optional Methods (1)

#### isSessionOpen(session)

Checks if a session is tracked as open:

- Returns `openSessions.has(session.id)`
- Returns `false` for all sessions after process restart (in-memory only)

---

## Configuration

### Basic Setup

```yaml
plugins:
  terminal: web
```

### With Custom Dashboard URL

```yaml
plugins:
  terminal: web

terminals:
  web:
    plugin: web
    dashboardUrl: https://orchestrator.example.com
```

### Configuration Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `plugin` | string | Yes | — | Must be `"web"` |
| `dashboardUrl` | string | No | `"http://localhost:5000"` | Web dashboard base URL |

---

## When to Use

| Scenario | Recommendation |
|----------|---------------|
| Browser-based dashboard | Use Web — integrates with xterm.js frontend |
| CI/CD environments | Use Web — no terminal emulator needed |
| Non-macOS local dev | Use Web — iTerm2 requires macOS |
| Local macOS development | Use iTerm2 — native tab management |
| Persistent terminal tabs | Use iTerm2 — Web loses state on restart |

---

## Next Steps

- [iTerm2](../iterm2/) — macOS iTerm2 tab management
- [Terminal Plugins](./) — Terminal plugin comparison
- [Plugins](../../) — Plugin comparison and configuration
- [Configuration](../../../../getting-started/configuration/) — Full config reference
