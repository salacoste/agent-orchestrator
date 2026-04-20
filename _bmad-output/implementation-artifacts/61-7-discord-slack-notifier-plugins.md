# Story 61.7: Discord & Slack Notifier Plugins

Status: done

## Story

As a project lead using Discord or Slack for team communication,
I want notifier plugins that send sprint event notifications to Discord channels and Slack channels via webhooks,
so that my team stays informed about agent activity, blocked stories, and conflicts without leaving our preferred chat tool.

## Acceptance Criteria

1. **AC#1 — Discord Notifier**: A Discord webhook notifier plugin at `packages/plugins/notifier-discord/` implementing the `Notifier` interface (Plugin Slot 6). Accepts Discord webhook URL config, formats events as Discord embed messages, and delivers via webhook POST
2. **AC#2 — Discord NotificationPlugin**: The Discord plugin also exports a `createNotificationPlugin()` factory implementing the `NotificationPlugin` interface. Handles `Notification` objects with priority-based color coding and field formatting
3. **AC#3 — Slack Notifier (Verification)**: Verify the existing Slack plugin at `packages/plugins/notifier-slack/` is complete and functional. It already implements both `Notifier` and `NotificationPlugin` interfaces with webhook delivery and Block Kit formatting
4. **AC#4 — Mention Support**: Both Discord and Slack plugins support configurable mentions (`@here`, `@everyone`, role/user ID mentions) for critical and warning priority notifications
5. **AC#5 — Event Bus Integration**: Both plugins integrate with the existing `NotificationService` via the `NotificationPlugin` interface — receiving deduplicated, priority-routed notifications through the centralized service
6. **AC#6 — Non-Fatal**: Plugin errors (network failures, invalid webhook URLs, rate limiting) never crash the orchestrator. Failed deliveries are logged and optionally moved to the notification DLQ
7. **AC#7 — Configuration**: Webhook URLs and mention settings are configurable per-project in `agent-orchestrator.yaml` under the existing notifier plugin configuration pattern. API keys stored in environment variables (NFR-S3)
8. **AC#8 — Test Coverage**: Unit tests for both Discord and Slack plugins covering: message formatting, webhook delivery, error handling, mention support, and `NotificationPlugin` adapter behavior

## Tasks / Subtasks

- [x] Task 1: Create Discord notifier plugin scaffold (AC: #1, #7)
  - [x] Create `packages/plugins/notifier-discord/` workspace with `package.json`, `tsconfig.json`
  - [x] Package name: `@composio/ao-plugin-notifier-discord`
  - [x] Follow same structure as `notifier-slack` (ESM, workspace dep on `@composio/ao-core`)
  - [x] No Discord SDK needed — use native `fetch()` for webhook delivery (same pattern as Slack)
- [x] Task 2: Implement Discord Notifier interface (AC: #1, #4, #6)
  - [x] Create `src/index.ts` with `manifest` and `create()` factory
  - [x] Manifest: `{ name: "discord", slot: "notifier", description: "Notifier plugin: Discord webhook", version: "0.1.0" }`
  - [x] `notify(event)`: format `OrchestratorEvent` as Discord embed, POST to webhook URL
  - [x] `notifyWithActions(event, actions)`: add action links in embed fields
  - [x] `post(message, context?)`: send raw text to webhook via content field
  - [x] Support mentions: `@here`, `@everyone`, `<@&roleId>` via config
  - [x] All network calls wrapped in try/catch — non-fatal
- [x] Task 3: Implement Discord NotificationPlugin adapter (AC: #2, #5)
  - [x] Create `src/notification-plugin.ts` with `createNotificationPlugin()` factory
  - [x] `send(notification)`: format `Notification` as Discord embed with priority color coding
  - [x] `isAvailable()`: validate webhook URL is configured
  - [x] Priority-to-color mapping: critical → red, warning → yellow, medium → blue, info → green
  - [x] Re-export from `src/index.ts`
- [x] Task 4: Verify Slack notifier plugin completeness (AC: #3, #4)
  - [x] Verify `packages/plugins/notifier-slack/src/index.ts` implements full `Notifier` interface
  - [x] Verify `packages/plugins/notifier-slack/src/notification-plugin.ts` implements `NotificationPlugin`
  - [x] Verify mention support exists (`@here`, `@everyone`, `<@userId>`)
  - [x] Run existing Slack tests — all must pass (44 tests pass)
  - [x] No gaps found — Slack plugin is complete
- [x] Task 5: Write tests (AC: #8)
  - [x] Discord notifier tests: `packages/plugins/notifier-discord/src/index.test.ts` (31 tests)
    - [x] Message formatting (OrchestratorEvent → Discord embed)
    - [x] Webhook delivery (mock fetch)
    - [x] Error handling (network failure, invalid URL)
    - [x] Mention support (@here, @everyone, role)
    - [x] `post()` raw message delivery
  - [x] Discord NotificationPlugin tests: `packages/plugins/notifier-discord/src/notification-plugin.test.ts` (19 tests)
    - [x] `send()` with each priority level
    - [x] `isAvailable()` true/false
    - [x] Priority-to-color mapping
  - [x] Slack tests: verified 44 existing tests pass
- [x] Task 6: Add dependency review for any new packages (AC: #7)
  - [x] Discord plugin uses only `fetch()` — no new dependencies needed
  - [x] Verify Slack plugin has no unreviewed dependencies
  - [x] No updates to `sprint-status.yaml` dependencies section needed

## Task Completion Validation

**CRITICAL:** Use correct task status notation:

- `[ ]` = Not started
- `[-]` = Partially complete (MUST document what's missing)
- `[x]` = 100% complete (all ACs met, all tests passing, no hidden TODOs)

**Task Completion Criteria:**
- All acceptance criteria met (not just attempted)
- All tests passing with real assertions (not `expect(true).toBe(true)`)
- No placeholder tests that always pass
- Deferred items explicitly documented (see "Deferred Items Tracking" below)
- No hidden TODOs or FIXMEs in completed tasks
- Documentation updated (Dev Notes, File List)

**Task Completion Validation Checklist:**
- [ ] All tasks marked [x] are 100% complete (no partial work)
- [ ] All tests have real assertions (no expect(true).toBe(true))
- [ ] No hidden TODOs/FIXMEs in completed tasks
- [ ] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [ ] File List includes all changed files

## Interface Validation

**Methods Used:**
- `Notifier.notify(event: OrchestratorEvent)` — from `types.ts:718` — send OrchestratorEvent notification
- `Notifier.notifyWithActions?(event, actions)` — from `types.ts:719` — send with interactive buttons
- `Notifier.post?(message, context?)` — from `types.ts:720` — send raw message
- `NotificationPlugin.send(notification: Notification)` — from `types.ts:2298` — send Notification object
- `NotificationPlugin.isAvailable()` — from `types.ts:2299` — check availability

**Feature Flags:**
- `notifier.discord.webhookUrl` — Discord webhook URL (env var: `DISCORD_WEBHOOK_URL`)
- `notifier.slack.webhookUrl` — Slack webhook URL (env var: `SLACK_WEBHOOK_URL`)
- `notifier.discord.mentions` — configurable mention rules per priority
- `notifier.slack.mentions` — configurable mention rules per priority

**Reference:** See `packages/core/INTERFACE_VALIDATION_CHECKLIST.md` for complete interface validation guide.

## Dependency Review

**Discord plugin:** Uses native `fetch()` — NO new dependencies required. Discord webhooks are a simple REST API.

**Slack plugin:** Already reviewed and approved. Uses native `fetch()` for Slack Incoming Webhooks.

**Reference:** See `_bmad/docs/dependency-security-review-checklist.md` for complete dependency review process.

## Dev Notes

### Architecture Overview

This story creates the Discord notifier plugin and verifies the existing Slack notifier plugin. Both follow the **dual-interface pattern** established by the Telegram notifier:

1. **Legacy Notifier (Plugin Slot 6):** `create()` returns a `Notifier` that accepts `OrchestratorEvent` objects directly. This is the original plugin slot interface used by the event bus.

2. **NotificationPlugin adapter:** `createNotificationPlugin()` returns a `NotificationPlugin` that accepts `Notification` objects (richer type with priority, title, metadata). This plugs into `NotificationServiceImpl` which handles dedup, routing, retry, DLQ, history, and digest batching.

Both adapters share webhook delivery logic internally.

### Key Reference: Existing Slack Plugin

The Slack plugin at `packages/plugins/notifier-slack/` is the closest architectural reference for Discord:

- **`src/index.ts`** (192 lines): `Notifier` interface implementation using Slack Incoming Webhooks
- **`src/notification-plugin.ts`** (41 lines): Simple `NotificationPlugin` adapter that bridges `Notification` → `OrchestratorEvent` → Notifier
- **`src/index.test.ts`** (388 lines): Tests for Notifier interface
- **`src/notification-plugin.test.ts`** (268 lines): Tests for NotificationPlugin adapter

The Slack plugin uses **Block Kit** for rich formatting. Discord uses **embeds** — different format but similar concept.

### Key Reference: Telegram Plugin (Richer Pattern)

The Telegram plugin at `packages/plugins/notifier-telegram/` shows the full pattern with:
- Event-specific formatting via `event-formatter.ts`
- `sendWithRetry` with rate-limit backoff in `send-helpers.ts`
- Preferences filtering, project-based chat routing, dedup windows

Discord should follow a **simpler pattern** (like Slack) since it's webhook-only (no bot commands, no conversations).

### Discord Webhook Format

Discord webhooks accept JSON payloads with:
```json
{
  "content": "optional text (use for mentions)",
  "embeds": [{
    "title": "Event Title",
    "description": "Event details",
    "color": 16711680,  // decimal color for priority
    "fields": [{"name": "Field", "value": "Value", "inline": true}],
    "footer": {"text": "agent-orchestrator"},
    "timestamp": "2026-04-18T12:00:00Z"
  }]
}
```

Key differences from Slack:
- Mentions go in `content` field, not in embed text
- Colors are decimal integers, not hex strings
- Fields support `inline` property
- Rate limit: Discord returns 429 with `retry_after` (float, seconds)

### Priority Color Mapping (Discord)

| Priority | Color | Decimal |
|---|---|---|
| critical | Red | 16711680 |
| warning | Yellow | 16776960 |
| medium | Blue | 3447003 |
| info | Green | 5763719 |

### Config Example

```yaml
plugins:
  notifier:
    - name: discord
      webhookUrl: ${DISCORD_WEBHOOK_URL}
      mentions:
        critical: "@here"
        warning: "<@&ROLE_ID>"
    - name: slack
      webhookUrl: ${SLACK_WEBHOOK_URL}
      mentions:
        critical: "<!channel>"
        warning: "<!here>"
```

### Important Patterns to Follow

- **NO `.js` extensions in web imports**: Web package uses bare imports (but plugins use `.js` extensions per core convention)
- **`.js` extensions in plugin imports**: Plugin packages use `.js` extensions (ESM convention)
- **`node:` prefix for builtins**: `import { fetch } from "node:fetch"` or just global `fetch`
- **Non-fatal**: All network errors caught and logged, never crash orchestrator
- **Plugin pattern**: `manifest` + `create()` + default export satisfies `PluginModule<Notifier>`
- **Test patterns**: Use `vi.fn()` for fetch mocks, test each event type, test error scenarios
- **Security**: Webhook URLs from env vars, not hardcoded in config files (NFR-S3)

### Previous Story Intelligence (61-5)

**Key learnings:**
- `vi.hoisted()` required for mock functions in `vi.mock()` factories
- All persistent/retry logic is non-fatal — wrapped in try/catch
- `BlockedAgentStatus` interface in types.ts can be extended for new fields
- Zod `.default()` for config values ensures backward compatibility
- New test file `blocked-detector-persistent.test.ts` added 5 tests for extension mechanism

### Project Structure Notes

**New files (Discord):**
- `packages/plugins/notifier-discord/package.json`
- `packages/plugins/notifier-discord/tsconfig.json`
- `packages/plugins/notifier-discord/src/index.ts` — Notifier interface
- `packages/plugins/notifier-discord/src/notification-plugin.ts` — NotificationPlugin adapter
- `packages/plugins/notifier-discord/src/index.test.ts` — Notifier tests
- `packages/plugins/notifier-discord/src/notification-plugin.test.ts` — NotificationPlugin tests

**Existing files (Slack — verify only, no changes expected):**
- `packages/plugins/notifier-slack/src/index.ts`
- `packages/plugins/notifier-slack/src/notification-plugin.ts`
- `packages/plugins/notifier-slack/src/index.test.ts`
- `packages/plugins/notifier-slack/src/notification-plugin.test.ts`

### References

- [Source: packages/core/src/types.ts:718-729] — `Notifier` interface
- [Source: packages/core/src/types.ts:2297-2306] — `NotificationPlugin` interface
- [Source: packages/core/src/types.ts:2235-2250] — `Notification` type
- [Source: packages/core/src/types.ts:1594-1601] — `PluginModule` interface
- [Source: packages/plugins/notifier-slack/src/index.ts] — Reference Slack implementation
- [Source: packages/plugins/notifier-slack/src/notification-plugin.ts] — Reference Slack adapter
- [Source: packages/plugins/notifier-telegram/src/index.ts] — Reference Telegram implementation (richer)
- [Source: packages/plugins/notifier-telegram/src/send-helpers.ts] — Retry with rate-limit backoff pattern
- [Source: packages/core/src/notification-service.ts] — Central notification service with dedup/routing/DLQ
- [Source: CLAUDE.md] — Plugin pattern, shell execution security, TypeScript conventions

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (via Claude Code CLI)

### Debug Log References

### Completion Notes List

- Task 1: Created Discord plugin scaffold at `packages/plugins/notifier-discord/` with `package.json`, `tsconfig.json` — follows same ESM structure as Slack
- Task 2: Implemented `src/index.ts` — `Notifier` interface with Discord embed formatting, priority-based colors (Red/Blue/Yellow/Green), mention support via `content` field, action links in embed fields, `post()` for raw messages
- Task 3: Implemented `src/notification-plugin.ts` — `NotificationPlugin` adapter with direct `Notification` → Discord embed conversion, priority-to-decimal-color mapping, mention integration, `isAvailable()` check
- Task 4: Verified Slack plugin — 44 tests pass, both `Notifier` and `NotificationPlugin` interfaces fully implemented, no gaps found
- Task 5: 50 tests across 2 test files — Notifier tests (31) cover manifest, create, notify, embed formatting, priority colors, mentions, notifyWithActions, post; NotificationPlugin tests (19) cover send, priority color mapping, mentions, isAvailable
- Task 6: No new dependencies — Discord uses native `fetch()` only, same as Slack

### Code Review Fixes (post-implementation)

- HIGH#1: `postToWebhook()` in `index.ts` now catches network/DNS errors and logs via `console.error` instead of throwing (AC#6 non-fatal)
- MEDIUM#2: Refactored `notification-plugin.ts` to bridge via `notificationToOrchestratorEvent` + `create().notify()` (same pattern as Slack), eliminating duplicated fetch logic
- MEDIUM#3: `DiscordNotificationPluginConfig.mentions` typed as `Partial<Record<NotificationPriority, string>>` for type safety
- LOW#4: Added `notifyWithActions` no-webhookUrl test case
- Updated `notification-plugin.test.ts` — 16 tests (down from 19) since bridging pattern removes need for duplicated embed tests; tests now verify the adapter delegates correctly through `notificationToOrchestratorEvent` priority mapping
- Updated `index.test.ts` — 32 tests (up from 31) with added `notifyWithActions` no-URL test; changed error test from `rejects.toThrow` to `console.error` spy assertion
- Total: 48 tests pass (32 Notifier + 16 NotificationPlugin)

### File List

- `packages/plugins/notifier-discord/package.json` — Plugin package config (@composio/ao-plugin-notifier-discord)
- `packages/plugins/notifier-discord/tsconfig.json` — TypeScript config (extends base)
- `packages/plugins/notifier-discord/src/index.ts` — Notifier interface with Discord embed formatting
- `packages/plugins/notifier-discord/src/notification-plugin.ts` — NotificationPlugin adapter
- `packages/plugins/notifier-discord/src/index.test.ts` — 32 Notifier tests
- `packages/plugins/notifier-discord/src/notification-plugin.test.ts` — 16 NotificationPlugin tests
