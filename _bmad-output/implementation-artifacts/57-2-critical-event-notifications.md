# Story 57.2: Critical Event Notifications

Status: done

## Story

As a **project manager**,
I want **to receive Telegram notifications for critical events**,
so that **I can respond to urgent issues even when away from my computer**.

## Acceptance Criteria

1. **Given** Telegram is configured as a notification channel
   **When** a critical event occurs (agent blocked, conflict detected, sprint at risk)
   **Then** I receive a Telegram message within 5 seconds
   **And** the message includes event type, affected resource IDs, and summary
   **And** the message includes relevant /commands for quick action

2. **Given** the notification service processes a critical event
   **When** the Telegram plugin receives the notification
   **Then** the message is formatted with event-type-specific details (not generic)
   **And** `agent.blocked` shows agent ID, story ID, reason, and `/status <agent>` command
   **And** `story.blocked` shows story ID, reason, and `/resume <story>` command
   **And** `conflict.detected` shows story IDs involved and `/conflicts` command
   **And** `eventbus.backlog` shows queue depth and `/health` command
   **And** `agent.offline` shows agent ID and `/fleet` command
   **And** `dependency.blocking` shows blocked story, blocking dependency, and `/status` command

3. **Given** a critical event notification is formatted
   **When** the Telegram message is sent
   **Then** the message uses MarkdownV2 formatting with proper escaping
   **And** the event type is displayed (not "session.needs_input")
   **And** priority is shown with emoji indicators (urgent=red, action=yellow, info=blue)

4. **Given** the full notification pipeline is active (EventBus → NotificationService → TelegramPlugin)
   **When** an event is published on the EventBus with a matching trigger
   **Then** the Telegram bot sends the notification to the configured chat ID
   **And** delivery is verified through the existing dedup/retry mechanism

## Tasks / Subtasks

- [x] Task 1: Create event-specific formatter (AC: #1, #2)
  - [x] 1.1: Create `packages/plugins/notifier-telegram/src/event-formatter.ts`
  - [x] 1.2: Define `CRITICAL_EVENT_FORMATTERS` map — keyed by eventType, each entry has: emoji, title, field extractor (agentId/storyId/reason from metadata), command suggestion
  - [x] 1.3: Implement `formatNotificationMessage(notification: Notification): string` — looks up formatter by eventType, falls back to generic format, applies MarkdownV2 escaping
  - [x] 1.4: Priority emoji mapping: critical→🔴, warning→🟡, info→ℹ️ (reuse `priorityEmoji` from index.ts or extract to shared util)
  - [x] 1.5: Event-specific formatters for all 6 critical/warning trigger types: `agent.blocked`, `story.blocked`, `conflict.detected`, `eventbus.backlog`, `agent.offline`, `dependency.blocking`
  - [x] 1.6: Each formatter outputs: emoji + bold title + metadata fields + blank line + message body + blank line + `/command` suggestion

- [x] Task 2: Update NotificationPlugin to use direct formatting (AC: #2, #3)
  - [x] 2.1: Modify `packages/plugins/notifier-telegram/src/notification-plugin.ts` — import `formatNotificationMessage` and `TelegramBot`
  - [x] 2.2: Replace `notificationToOrchestratorEvent()` + `notifier.notify()` pipeline in `send()` with direct formatting + bot sending
  - [x] 2.3: Create `TelegramBot` instance lazily in `createNotificationPlugin()` (same lazy-init pattern as `create()` in index.ts)
  - [x] 2.4: Use `sendWithRetry()` from index.ts for rate limit handling (export it, or duplicate the pattern)
  - [x] 2.5: Ensure `isAvailable()` still checks botToken presence

- [x] Task 3: Export `sendWithRetry` from index.ts (AC: #2)
  - [x] 3.1: Export `sendWithRetry` function from `packages/plugins/notifier-telegram/src/index.ts` so notification-plugin.ts can reuse it

- [x] Task 4: Add tests for event formatter (AC: #1, #2, #3)
  - [x] 4.1: Create `packages/plugins/notifier-telegram/src/__tests__/event-formatter.test.ts`
  - [x] 4.2: Test each of the 6 event types produces correct formatted output with:
    - Correct emoji prefix
    - Event-specific title (not "session.needs_input")
    - Metadata fields (agent ID, story ID, reason, queue depth, etc.)
    - Relevant /command suggestion
  - [x] 4.3: Test fallback formatter for unknown event types
  - [x] 4.4: Test MarkdownV2 escaping is applied to all dynamic content
  - [x] 4.5: Test missing metadata (no agentId, no storyId) — graceful degradation

- [x] Task 5: Update notification-plugin tests (AC: #2)
  - [x] 5.1: Update `packages/plugins/notifier-telegram/src/__tests__/notification-plugin.test.ts`
  - [x] 5.2: Verify `send()` now uses `formatNotificationMessage` instead of `notificationToOrchestratorEvent`
  - [x] 5.3: Test that `send()` sends to default chat ID with MarkdownV2 parse mode
  - [x] 5.4: Test that `send()` includes the correct /command in the message

- [x] Task 6: Run full test suite (AC: all)
  - [x] 6.1: Run `pnpm test` — 0 regressions (all packages pass; CLI integration tests are pre-existing failures)
  - [x] 6.2: Verify all existing tests still pass (69 telegram plugin tests; 50 from 57-1 + 19 new from 57-2)
  - [x] 6.3: Update sprint-status.yaml

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

**Deferred Items Tracking:**

**In this story's Dev Notes, add:**
```markdown
### Limitations (Deferred Items)
1. **Notification preferences per event type**
   - Status: Deferred — Per-project notification preferences come in Story 57-3
   - Requires: Config schema for per-event-type notification routing
   - Epic: Story 57-3 (notification-preference-configuration)
   - Current: All critical events go to all configured Telegram channels

2. **Quiet hours**
   - Status: Deferred — Quiet hours scheduling comes in Story 57-3
   - Requires: Time-based notification suppression
   - Epic: Story 57-3 (notification-preference-configuration)
   - Current: Notifications sent immediately regardless of time

3. **Inline action buttons on critical notifications**
   - Status: Deferred — Interactive buttons come in Story 57-11 (inline-action-buttons)
   - Requires: Callback query handling infrastructure
   - Epic: Story 57-11 (inline-action-buttons)
   - Current: Messages include /command text suggestions only
```

**Task Completion Validation Checklist:**
- [ ] All tasks marked [x] are 100% complete (no partial work)
- [ ] All tests have real assertions (no expect(true).toBe(true))
- [ ] No hidden TODOs/FIXMEs in completed tasks
- [ ] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [ ] File List includes all changed files

## Interface Validation

- [ ] Validate all interface methods used in this story
- [ ] Document any missing capabilities as feature flags
- [ ] Update sprint-status.yaml with discovered limitations

**Methods Used:**
- `NotificationPlugin.send(notification: Notification): Promise<void>` — EXISTING: core notification interface
- `NotificationPlugin.isAvailable(): Promise<boolean>` — EXISTING: availability check
- `TelegramBot.api.sendMessage(chatId, text, options)` — EXISTING: from grammY via TelegramBot wrapper (Story 57-1)
- `Notification` type — EXISTING: `eventId`, `eventType`, `priority`, `title`, `message`, `metadata`, `timestamp`
- `notificationToOrchestratorEvent(notification)` — EXISTING: will be REPLACED in notification-plugin.ts with direct formatting
- `escapeMarkdownV2(text)` — EXISTING: from `./markdown-escape.js` (Story 57-1)
- `sendWithRetry(bot, chatId, text, options)` — EXISTING: from `./index.js` (Story 57-1, needs export)

**Feature Flags:**
- None required — all interfaces already exist

## Dependency Review

No new dependencies. This story uses existing packages only:
- `grammy` (already reviewed in Story 57-1, MIT license)
- `@composio/ao-core` (workspace dependency)

## Dev Notes

### Architecture Context

This is **Story 2 of 15** in **Epic 57: Telegram Bot Integration**. It depends on **Story 57-1** (Telegram Bot Registration) which created the notifier plugin package.

**Dependency chain:** Story 57-1 (done) → **Story 57-2 (this story)** → Story 57-3 (notification preferences)

### What Already Exists (Do NOT Reinvent)

#### Notification Pipeline (ALL of this is built and working)

The **complete notification pipeline** from EventBus to Telegram already exists:

1. **EventBus** publishes events (e.g., `agent.blocked`, `conflict.detected`)
2. **NotificationService** (`packages/core/src/notification-service.ts`) subscribes to EventBus, classifies events via trigger map, creates `Notification` objects, routes to registered plugins
3. **Telegram NotificationPlugin** (`notification-plugin.ts`) receives `Notification` objects
4. **notificationToOrchestratorEvent()** converts `Notification` → `OrchestratorEvent` (adapter)
5. **Telegram notifier** (`index.ts`) formats `OrchestratorEvent` as Telegram message and sends

**The problem this story solves:** Step 4 is lossy — `notificationToOrchestratorEvent()` converts ALL event types to `session.needs_input`, losing the original event type. The generic `formatEventMessage()` in index.ts can't produce event-specific formatting with /commands.

#### NotificationService Trigger Map (already configured)

From `packages/core/src/notification-service.ts` lines 66-77:

```typescript
const DEFAULT_TRIGGER_MAP: Record<string, NotificationTrigger> = {
  "agent.blocked": { priority: "critical", title: "Agent Blocked" },
  "story.blocked": { priority: "critical", title: "Story Blocked" },
  "conflict.detected": { priority: "critical", title: "Conflict Detected" },
  "eventbus.backlog": { priority: "critical", title: "Event Bus Backlog" },
  "agent.offline": { priority: "warning", title: "Agent Offline" },
  "dependency.blocking": { priority: "warning", title: "Cross-Project Dependency Blocking" },
  "story.completed": { priority: "info", title: "Story Completed" },
  "story.started": { priority: "info", title: "Story Started" },
  "story.assigned": { priority: "info", title: "Story Assigned" },
  "agent.resumed": { priority: "info", title: "Agent Resumed" },
};
```

Critical events (sent immediately): `agent.blocked`, `story.blocked`, `conflict.detected`, `eventbus.backlog`
Warning events (sent immediately): `agent.offline`, `dependency.blocking`
Info events (log only, NOT sent to plugins)

**This story only needs to handle critical and warning events** — info events are logged by NotificationService, not sent to plugins.

#### NotificationService Message Builder

From `notification-service.ts` lines 517-584, the `buildMessage()` method already generates:
- Event-specific base messages (e.g., "Story X agent is blocked")
- Actionable CLI suggestions (e.g., "Run: ao status <agent>")

The `Notification.message` field already contains this formatted content when it reaches the Telegram plugin. The Telegram formatter should display this message body.

#### Notification Metadata Fields

The `Notification.metadata` object contains event-specific data:
- `agent.blocked`: `{ agentId, storyId, reason }`
- `story.blocked`: `{ storyId, reason }`
- `conflict.detected`: `{ storyId, conflictType }`
- `eventbus.backlog`: `{ queueDepth }`
- `agent.offline`: `{ agentId }`
- `dependency.blocking`: `{ storyId, blockingStoryId, blockingProject }`

#### Telegram Bot API Constraints

- **MarkdownV2**: Must escape special chars via `escapeMarkdownV2()` (existing utility)
- **Message length**: Max 4096 characters (Telegram limit)
- **Rate limits**: 429 errors handled via `sendWithRetry()` with exponential backoff (existing)
- **callback_data**: Max 64 bytes (Story 57-1 review finding, not used in this story)

### What This Story Actually Does

1. **New file: `event-formatter.ts`** — Event-type-specific formatter that takes `Notification` directly and produces Telegram MarkdownV2 messages with /command suggestions

2. **Modify: `notification-plugin.ts`** — Replace lossy adapter pipeline with direct formatting using `formatNotificationMessage()`. Still uses `TelegramBot` for sending.

3. **Export `sendWithRetry`** from index.ts (or extract to shared helper) so notification-plugin.ts can reuse it

4. **Tests** — New test file for event formatter, update existing notification-plugin tests

### Critical Design Decisions

1. **Direct Notification formatting** — The NotificationPlugin's `send()` should format from `Notification` directly, NOT go through `notificationToOrchestratorEvent()` → `Notifier.notify()`. The adapter loses event type information. The new approach: `Notification` → `formatNotificationMessage()` → `bot.api.sendMessage()`.

2. **Reuse TelegramBot instance** — `createNotificationPlugin()` already creates a notifier via `create(config)`. Extract the `TelegramBot` from the notifier or create a separate instance. Simplest: create a new `TelegramBot` directly in `createNotificationPlugin()` (same config parsing pattern as `create()` in index.ts).

3. **Fallback formatting** — Unknown event types should still produce a readable message using generic formatting (event type + title + message body). Never crash on unknown events.

4. **/command suggestions** — These are TEXT suggestions in the message body, not inline buttons. Inline buttons come in Story 57-11. Format: `\n/commands: /status agent-1, /fleet`

5. **Do NOT modify notification-service.ts or notification-adapter.ts** — The adapter and service work correctly. Only the Telegram plugin's internal formatting changes.

6. **Do NOT modify index.ts formatEventMessage** — The existing `formatEventMessage()` in index.ts is used by the Notifier interface (`notify()`). Keep it unchanged. The new `formatNotificationMessage()` is a parallel formatter for the NotificationPlugin path only.

### Event Formatter Specification

```typescript
// packages/plugins/notifier-telegram/src/event-formatter.ts

interface EventFormatter {
  emoji: string;
  title: string;
  /** Extract display fields from metadata */
  formatFields(metadata: Record<string, unknown>): string;
  /** Suggested /command */
  commandSuggestion(metadata: Record<string, unknown>): string;
}

const CRITICAL_EVENT_FORMATTERS: Record<string, EventFormatter> = {
  "agent.blocked": {
    emoji: "🔴",
    title: "Agent Blocked",
    formatFields: (m) => `Agent: ${m.agentId}\nStory: ${m.storyId}\nReason: ${m.reason ?? "unknown"}`,
    commandSuggestion: (m) => `/status ${m.agentId ?? ""}`,
  },
  "story.blocked": {
    emoji: "🔴",
    title: "Story Blocked",
    formatFields: (m) => `Story: ${m.storyId}\nReason: ${m.reason ?? "unknown"}`,
    commandSuggestion: (m) => m.storyId ? `/resume ${m.storyId}` : "/fleet",
  },
  "conflict.detected": {
    emoji: "🔴",
    title: "Conflict Detected",
    formatFields: (m) => `Story: ${m.storyId ?? "unknown"}\nType: ${m.conflictType ?? "unknown"}`,
    commandSuggestion: () => "/conflicts",
  },
  "eventbus.backlog": {
    emoji: "🔴",
    title: "Event Bus Backlog",
    formatFields: (m) => `Queue depth: ${m.queueDepth ?? "unknown"}`,
    commandSuggestion: () => "/health",
  },
  "agent.offline": {
    emoji: "🟡",
    title: "Agent Offline",
    formatFields: (m) => `Agent: ${m.agentId ?? "unknown"}`,
    commandSuggestion: (m) => m.agentId ? `/status ${m.agentId}` : "/fleet",
  },
  "dependency.blocking": {
    emoji: "🟡",
    title: "Dependency Blocking",
    formatFields: (m) => `Story: ${m.storyId ?? "unknown"}\nBlocked by: ${m.blockingStoryId ?? "unknown"} (${m.blockingProject ?? "unknown"})`,
    commandSuggestion: () => "/status",
  },
};
```

### File Structure

```
packages/plugins/notifier-telegram/src/
├── index.ts                    # MODIFY: export sendWithRetry
├── notification-plugin.ts      # MODIFY: use formatNotificationMessage + direct send
├── telegram-bot.ts             # UNCHANGED
├── markdown-escape.ts          # UNCHANGED
├── event-formatter.ts          # NEW: event-specific formatters
└── __tests__/
    ├── index.test.ts           # UNCHANGED (unless sendWithRetry export changes tests)
    ├── telegram-bot.test.ts    # UNCHANGED
    ├── markdown-escape.test.ts # UNCHANGED
    ├── notification-plugin.test.ts  # MODIFY: verify new formatting
    └── event-formatter.test.ts # NEW: test all 6 formatters + fallback
```

### Integration with Existing Stories (MUST Follow)

These are verified patterns from Story 57-1. The dev agent MUST follow these:

1. **Package import resolution**: `@composio/ao-core` only exports from top-level. No subpath imports.

2. **Mock pattern for tests**: Single top-level `vi.mock()` for each package. Do NOT use `importOriginal` with subpath type imports.

3. **`.js` extensions in imports**: Required for ESM. All local imports must end with `.js`.

4. **Plugin `satisfies` pattern**: Default export MUST use `satisfies PluginModule<Notifier>` — not just `as PluginModule<Notifier>`.

5. **MarkdownV2 escaping**: ALL dynamic content must be escaped via `escapeMarkdownV2()`. Static formatting chars (`*`, `_`, etc.) should NOT be escaped.

6. **Telegram message format**: `parse_mode: "MarkdownV2"` must be set on every `sendMessage` call.

7. **Rate limit handling**: Use existing `sendWithRetry()` — do NOT duplicate retry logic.

8. **Error handling**: Throw typed errors. Invalid config = throw with clear message.

9. **Logging**: Use `console.warn`/`console.error` with `[notifier-telegram]` prefix.

### Testing Strategy

**Unit tests (event-formatter.test.ts):**
- 6 event types: verify correct emoji, title, fields extraction, /command suggestion
- Fallback formatter: unknown event type produces generic message
- Missing metadata: no agentId → "unknown", no storyId → "unknown"
- MarkdownV2 escaping applied to all dynamic content
- Message does NOT contain "session.needs_input"

**Unit tests (notification-plugin.test.ts — updates):**
- `send()` calls `formatNotificationMessage()` not `notificationToOrchestratorEvent()`
- `send()` sends to default chat ID with `parse_mode: "MarkdownV2"`
- `send()` message contains /command suggestion
- `isAvailable()` still works correctly

### NFRs
- **NFR-I1-1:** Telegram notification delivery within 5 seconds of event
- **NFR-I1-2:** Bot handles rate limits gracefully with exponential backoff
- **NFR-P3:** Telegram notifications deliver within 5 seconds of event (this story: verify formatting doesn't add latency)
- **NFR-R1:** Telegram notifications have 99% delivery success rate (this story: leverage existing retry)

### Pre-existing Types (Use These, Do NOT Modify)
- `Notifier`, `NotifyAction`, `NotifyContext` — from `@composio/ao-core` types.ts
- `NotificationPlugin`, `Notification`, `NotificationPriority` — from `@composio/ao-core` types.ts
- `OrchestratorEvent`, `EventPriority`, `EventType` — from `@composio/ao-core` types.ts
- `notificationToOrchestratorEvent()` — from `@composio/ao-core` notification-adapter.ts (will NOT be used in new code path)
- `TelegramBot`, `TelegramBotConfig` — from `./telegram-bot.js`
- `escapeMarkdownV2()` — from `./markdown-escape.js`

### Project Structure Notes
- Follow existing TypeScript/ESM conventions from CLAUDE.md
- `.js` extensions in imports, `node:` prefix for builtins
- Co-located test files in `__tests__/` pattern
- All existing tests must continue to pass (no regressions)
- No new npm dependencies

### References
- [Source: epics-cycle-10.md#Story 57.2] — Story definition and acceptance criteria
- [Source: prd-cycle-10.md#FR-I1-2] — "Notification types supported: agent blocked, agent completed story, conflict detected, sprint at risk, health check warnings, custom trigger notifications"
- [Source: prd-cycle-10.md#FR-I1-3] — "Notifications include actionable context: agent ID, story ID, project, summary, quick action buttons"
- [Source: packages/plugins/notifier-telegram/src/index.ts] — Existing notifier with sendWithRetry, formatEventMessage, create()
- [Source: packages/plugins/notifier-telegram/src/notification-plugin.ts] — Current adapter using notificationToOrchestratorEvent (to be replaced)
- [Source: packages/core/src/notification-service.ts] — NotificationService with trigger map, message builder, event subscription
- [Source: packages/core/src/notification-adapter.ts] — notificationToOrchestratorEvent adapter (lossy, not to be modified)
- [Source: packages/plugins/notifier-telegram/src/markdown-escape.ts] — escapeMarkdownV2 utility
- [Source: _bmad-output/implementation-artifacts/57-1-telegram-bot-registration.md] — Previous story with all learnings

## Dev Agent Record
### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- Test run: `pnpm test --filter @composio/ao-plugin-notifier-telegram` — 71 tests, 0 failures
- Full suite: `pnpm test` — all packages pass (CLI integration tests pre-existing failures, unrelated)

### Completion Notes List

1. Created `event-formatter.ts` with 6 event-specific formatters + fallback for unknown types
2. Rewrote `notification-plugin.ts` to bypass lossy `notificationToOrchestratorEvent()` adapter — now formats `Notification` directly via `formatNotificationMessage()`
3. Exported `sendWithRetry` from `send-helpers.ts` (shared module) for reuse by both `index.ts` and `notification-plugin.ts`
4. Created comprehensive test suite (19 tests) covering all 6 event types, fallback, escaping, priority display
5. Updated notification-plugin tests (9 tests) verifying new direct formatting path, MarkdownV2 parse mode, /command suggestions, no-op behavior, error handling

### Limitations (Deferred Items)
1. **Notification preferences per event type**
   - Status: Deferred — Per-project notification preferences come in Story 57-3
   - Requires: Config schema for per-event-type notification routing
   - Epic: Story 57-3 (notification-preference-configuration)
   - Current: All critical events go to all configured Telegram channels

2. **Quiet hours**
   - Status: Deferred — Quiet hours scheduling comes in Story 57-3
   - Requires: Time-based notification suppression
   - Epic: Story 57-3 (notification-preference-configuration)
   - Current: Notifications sent immediately regardless of time

3. **Inline action buttons on critical notifications**
   - Status: Deferred — Interactive buttons come in Story 57-11 (inline-action-buttons)
   - Requires: Callback query handling infrastructure
   - Epic: Story 57-11 (inline-action-buttons)
   - Current: Messages include /command text suggestions only

### File List

**NEW:**
- `packages/plugins/notifier-telegram/src/event-formatter.ts` — Event-specific Telegram message formatter (6 formatters + fallback)
- `packages/plugins/notifier-telegram/src/send-helpers.ts` — Shared `sendWithRetry()` (extracted to break circular ESM dependency)
- `packages/plugins/notifier-telegram/src/__tests__/event-formatter.test.ts` — 19 tests for event formatter

**MODIFIED:**
- `packages/plugins/notifier-telegram/src/notification-plugin.ts` — Replaced lossy adapter path with direct Notification formatting; added error handling and missing-config warning
- `packages/plugins/notifier-telegram/src/index.ts` — Imports `sendWithRetry` from `send-helpers.ts` and re-exports
- `packages/plugins/notifier-telegram/src/__tests__/notification-plugin.test.ts` — Updated 9 tests for new formatting path + error handling
