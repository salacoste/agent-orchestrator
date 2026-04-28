---
title: Terminal Plugins
nav_order: 7
parent: Plugins
has_children: true
description: Terminal plugin slot with 2 built-in plugins — iTerm2 (macOS AppleScript tab management) and Web (xterm.js dashboard integration). Comparison table and selection guide.
---

# Terminal Plugins

The terminal plugin manages how agent sessions are displayed in a terminal. It opens tabs for active sessions, re-focuses existing tabs, and tracks which sessions have open terminals. Agent Orchestrator ships with 2 terminal plugins: **iTerm2** (default) for macOS tab management and **Web** for dashboard-based terminal access.

{: .highlight }
> **TL;DR:** 2 plugins — iTerm2 (macOS, AppleScript tabs with deduplication) and Web (in-memory tracking, xterm.js on frontend). Both implement the 3-method `Terminal` interface. Choose iTerm2 for local development, Web for browser-based dashboards.

---

## Terminal Interface

All terminal plugins implement the `Terminal` interface from `@composio/ao-core`. The interface defines **1 property + 3 methods** (2 required + 1 optional):

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` (readonly) | Plugin display name |

### Required Methods (2)

| Method | Signature | Description |
|--------|-----------|-------------|
| `openSession` | `(session: Session) => Promise<void>` | Open a terminal tab for a session |
| `openAll` | `(sessions: Session[]) => Promise<void>` | Open terminal tabs for all sessions |

### Optional Methods (1)

| Method | Signature | Description |
|--------|-----------|-------------|
| `isSessionOpen` | `(session: Session) => Promise<boolean>` | Check if session has an open terminal tab |

---

## Plugin Comparison

| Feature | iTerm2 | Web |
|---------|--------|-----|
| **Package** | `@composio/ao-plugin-terminal-iterm2` | `@composio/ao-plugin-terminal-web` |
| **Default** | Yes | No |
| **Platform** | macOS only | Any (browser) |
| **Transport** | AppleScript via `osascript` | In-memory Set (xterm.js on frontend) |
| **Config required** | None | Optional `dashboardUrl` |
| **Tab deduplication** | Yes — reuses existing tabs | N/A — tracks state only |
| **Persistence** | iTerm2 manages tabs | In-memory only (lost on restart) |
| **Methods** | openSession, openAll, isSessionOpen | openSession, openAll, isSessionOpen |

---

## When to Use

| Scenario | Recommendation |
|----------|---------------|
| Local macOS development | Use iTerm2 — native tab management |
| Remote SSH sessions | Use iTerm2 — persistent tabs across reconnects |
| Browser-based dashboard | Use Web — integrates with xterm.js frontend |
| CI/CD environments | Use Web — no terminal needed |
| Multi-session monitoring | Use iTerm2 — tab deduplication prevents duplicates |
| Non-macOS local dev | Use Web — iTerm2 requires macOS |

---

## Next Steps

- [iTerm2](./iterm2/) — macOS iTerm2 tab management with AppleScript
- [Web](./web/) — Web terminal with xterm.js dashboard integration
- [Plugins](../) — Plugin comparison and configuration
- [Configuration](../../../getting-started/configuration/) — Full config reference
