---
title: iTerm2
nav_order: 1
parent: Terminal Plugins
grand_parent: Plugins
description: iTerm2 terminal plugin — macOS tab management via AppleScript with tab deduplication, automatic session focusing, and 300ms staggered open for race-condition prevention.
---

# iTerm2 Terminal

The **iTerm2** plugin manages macOS iTerm2 terminal tabs for agent sessions. It uses AppleScript commands sent via `osascript` to create, find, and select terminal tabs. On non-macOS systems, all methods no-op with a warning.

{: .highlight }
> **macOS only:** iTerm2 requires macOS. On Linux/Windows, `openSession` and `openAll` log a warning and return. `isSessionOpen` returns `false`.

---

## Plugin Info

| Field | Value |
|-------|-------|
| **Name** | `iterm2` |
| **Slot** | `terminal` |
| **Package** | `@composio/ao-plugin-terminal-iterm2` |
| **Version** | `0.1.0` |
| **Default** | Yes |

---

## How It Works

The iTerm2 plugin sends AppleScript commands to iTerm2 via `execFile("osascript", ["-e", script])`:

```text
openSession(session)
  |
  +-- Check isMacOS()
  |     +-- false: warn and return
  |
  +-- findAndSelectExistingTab(name)
  |     +-- Found: select it, done
  |
  +-- openNewTab(name)
        +-- No windows: create window
        +-- Has windows: create tab
        +-- Run: tmux attach -t name

openAll(sessions)
  |
  +-- Check isMacOS() && sessions not empty
  |     +-- false: return early
  |
  +-- For each session:
        +-- findAndSelectExistingTab(name)
        |     +-- Not found: openNewTab(name)
        +-- Wait 300ms (avoid race)
```

---

## Transport

- Uses `execFile("osascript", ...)` for AppleScript execution
- **No shell injection**: Session names are triple-escaped:
  1. `shellEscape()` — escapes for shell single-quote context (`'` → `'\''`)
  2. `escapeAppleScript()` — escapes for AppleScript double-quote context
  3. Safe passage through AppleScript → shell → tmux
- **No network transport** — purely local macOS inter-process communication
- Re-exports `escapeAppleScript` from `@composio/ao-core` for backwards compatibility

---

## Methods

### Properties

| Property | Value |
|----------|-------|
| `name` | `"iterm2"` |

### Required Methods (2)

#### openSession(session)

Opens an iTerm2 tab for a session (or focuses an existing one):

- **Tab deduplication**: `findAndSelectExistingTab()` searches all iTerm2 windows/tabs/sessions for a matching session name. If found, SELECTS (focuses) the existing tab rather than opening a new one
- Session name resolved from `session.runtimeHandle?.id ?? session.id`
- **Window creation**: If no iTerm2 windows exist, creates a new window with `create window with default profile`; otherwise creates a tab in the current window
- **Platform guard**: Logs `[terminal-iterm2] iTerm2 is only available on macOS` and returns on non-macOS
- Can throw if AppleScript execution fails

#### openAll(sessions)

Opens iTerm2 tabs for all sessions:

- **Early return** if `!isMacOS()` **or** `sessions.length === 0`
- Iterates sessions with its own inline loop (does NOT delegate to `openSession`)
- Each iteration: checks `findAndSelectExistingTab()`, opens new tab via `openNewTab()` if not found
- **300ms stagger delay** between each tab operation (`setTimeout(resolve, 300)`) to avoid AppleScript race conditions
- Same tab deduplication logic as `openSession`, but inlined rather than delegated

### Optional Methods (1)

#### isSessionOpen(session)

Checks if a session has an open iTerm2 tab:

- Uses `hasExistingTab()` — a pure query that does NOT select/focus the tab (avoids UI side effects)
- Returns `false` on any error (swallowed in try/catch)
- Returns `false` on non-macOS

---

## Configuration

No configuration needed. The iTerm2 plugin takes no config parameter — all behavior is derived from session metadata.

{: .highlight }
> **Prerequisites:** macOS with iTerm2 installed. The plugin uses AppleScript commands that target the iTerm2 application directly.

---

## When to Use

| Scenario | Recommendation |
|----------|---------------|
| Local macOS development | Use iTerm2 — native tab management |
| Multiple agent sessions | Use iTerm2 — tab deduplication prevents duplicates |
| SSH with tmux sessions | Use iTerm2 — `tmux attach` commands auto-generated |
| Non-macOS environment | Use Web — iTerm2 requires macOS |
| Browser-based access | Use Web — iTerm2 is desktop-only |

---

## Next Steps

- [Web](../web/) — Web terminal for browser-based dashboard access
- [Terminal Plugins](./) — Terminal plugin comparison
- [Plugins](../../) — Plugin comparison and configuration
- [Configuration](../../../../getting-started/configuration/) — Full config reference
