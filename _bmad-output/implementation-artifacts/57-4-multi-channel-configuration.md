# Story 57.4: Multi-Channel Configuration

Status: done

## Story

As a **project manager**,
I want **to configure different Telegram channels for different projects/teams**,
so that **the right people receive relevant notifications**.

## Acceptance Criteria

1. **Given** I have multiple projects with different teams
   **When** I configure Telegram channels
   **Then** I can map projects to specific chat IDs
   **And** notifications are routed to the correct channel based on the project context

2. **Given** a project has a configured Telegram chat ID override
   **When** a notification originates from that project
   **Then** the notification is sent to the project-specific chat ID
   **And** the global `defaultChatId` is used as fallback for unconfigured projects

3. **Given** I configure a `projectChatMapping` in the Telegram notifier config
   **When** the mapping contains `"my-app": "-1001234567890"`
   **Then** all notifications with `metadata.projectId === "my-app"` go to that chat ID
   **And** notifications from other projects go to `defaultChatId`

4. **Given** no `projectChatMapping` is configured
   **When** the Telegram plugin sends a notification
   **Then** all notifications go to `defaultChatId` (current behavior preserved)

5. **Given** a project-specific chat ID is configured
   **When** the chat ID is in the `allowedChatIds` list (if configured)
   **Then** the notification is sent successfully
   **And** if the chat ID is NOT in the allowed list, a warning is logged and the notification falls back to `defaultChatId`

## Tasks / Subtasks

- [x] Task 1: Add project-to-chat mapping types and config (AC: #1, #3, #4)
  - [x] 1.1: Add `projectChatMapping?: Record<string, string>` to `TelegramNotificationPluginConfig` in `notification-plugin.ts`
  - [x] 1.2: Create `resolveChatId()` function in `notification-plugin.ts` that takes `notification`, `defaultChatId`, and `projectChatMapping` and returns the resolved chat ID
  - [x] 1.3: `resolveChatId()` logic: if `notification.metadata?.projectId` exists AND `projectChatMapping[projectId]` exists → return mapped chat ID; otherwise → return `defaultChatId`
  - [x] 1.4: Validate mapped chat ID against `allowedChatIds` if configured; if not allowed, log warning and return `defaultChatId`

- [x] Task 2: Update `send()` to use resolved chat ID (AC: #2, #3)
  - [x] 2.1: In `notification-plugin.ts` `send()`, replace hard-coded `defaultChatId` with result from `resolveChatId()`
  - [x] 2.2: Pass `config?.allowedChatIds` and `projectChatMapping` from closure to `resolveChatId()`

- [x] Task 3: Update YAML example (AC: #1)
  - [x] 3.1: Add commented-out `projectChatMapping` section to `agent-orchestrator.yaml.example` under the telegram notifier config

- [x] Task 4: Add tests (AC: all)
  - [x] 4.1: Test `resolveChatId()` returns mapped chat ID when projectId matches
  - [x] 4.2: Test `resolveChatId()` returns `defaultChatId` when no mapping configured
  - [x] 4.3: Test `resolveChatId()` returns `defaultChatId` when projectId not in mapping
  - [x] 4.4: Test `resolveChatId()` returns `defaultChatId` when notification has no metadata
  - [x] 4.5: Test `resolveChatId()` falls back to `defaultChatId` when mapped chat ID not in `allowedChatIds` (with warning)
  - [x] 4.6: Test `send()` routes to project-specific chat ID via `resolveChatId()`
  - [x] 4.7: Test `send()` falls back to `defaultChatId` for unmapped projects
  - [x] 4.8: Test backward compatibility — no `projectChatMapping` → all to `defaultChatId`
  - [x] 4.9: Run full test suite — 0 regressions

- [x] Task 5: Update sprint-status.yaml

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
1. **Team-specific notification rules (beyond chat ID mapping)**
   - Status: Deferred — Complex rule engine (event-type-per-project filtering) deferred to a future story
   - Requires: Per-project notification preference resolution in config
   - Current: Chat ID mapping routes to correct channel; preferences are still global

2. **Dynamic chat ID discovery via bot commands**
   - Status: Deferred — Users cannot `/register` new chat IDs from Telegram
   - Requires: Bot command handler for channel registration
   - Epic: Story 57-5+ (Telegram commands)
   - Current: Chat IDs are statically configured in YAML
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
- `NotificationPlugin.send(notification: Notification): Promise<void>` — EXISTING: core notification interface (modified to resolve chat ID per project)
- `Notification.metadata` — EXISTING: arbitrary key-value data; `projectId` field used for chat ID resolution
- `TelegramBot.api.sendMessage(chatId, text, options)` — EXISTING: from grammY via TelegramBot wrapper
- `sendWithRetry(bot, chatId, text, options)` — EXISTING: from `./send-helpers.js`

**Feature Flags:**
- None required — all interfaces already exist. `Notification.metadata` is already `Record<string, unknown>`, so `projectId` can be read without type changes.

## Dependency Review

No new dependencies. This story uses existing packages only:
- `@composio/ao-core` (workspace dependency)
- `grammy` (already reviewed in Story 57-1)

## Dev Notes

### Architecture Context

This is **Story 4 of 15** in **Epic 57: Telegram Bot Integration**. It depends on **Stories 57-1, 57-2, 57-3** (all done).

**Dependency chain:** Stories 57-1, 57-2, 57-3 (done) → **Story 57-4 (this story)** → Stories 57-5+ (commands)

### What This Story Actually Does

**The problem:** Currently `notification-plugin.ts` sends ALL notifications to a single `defaultChatId`. In multi-project setups, team A's notifications go to the same channel as team B's.

**The solution:** Add a `projectChatMapping` config option that maps project IDs to specific Telegram chat IDs. The `send()` method resolves the target chat ID based on `notification.metadata.projectId`.

**What this does NOT do:** This story only adds chat ID routing. It does NOT add:
- Per-project notification preferences (that would be a separate preference resolution layer)
- Dynamic channel registration via bot commands
- Team-level routing beyond project-level

### How Project Context Flows to the Plugin

1. **EventBus** publishes events with `projectId` in the event
2. **NotificationService** creates `Notification` objects — the `metadata` field includes `projectId`
3. **NotificationPlugin.send(notification)** receives the notification
4. **THIS STORY**: `resolveChatId()` reads `notification.metadata.projectId` and looks up the mapped chat ID

### Existing Infrastructure (Do NOT Reinvent)

1. **`Notification.metadata`** (`types.ts:1798`) — Already carries arbitrary data. The `projectId` field is already populated by NotificationService for project-scoped events.

2. **`NotificationPlugin` interface** (`types.ts`) — The `send(notification: Notification)` method already receives the full notification with metadata. No interface changes needed.

3. **`TelegramNotificationPluginConfig`** (`notification-plugin.ts:21-30`) — Already has `defaultChatId`, `allowedChatIds`, `preferences`. We add `projectChatMapping` alongside these.

4. **`sendWithRetry()`** (`send-helpers.ts`) — Already handles rate limits. No changes needed.

5. **`shouldSend()` + preferences** (`preferences.ts`) — Already does severity/event-type/quiet-hours filtering. This runs BEFORE chat ID resolution. No changes needed.

### Notification Routing Layers (After This Story)

| Layer | Where | What it does |
|-------|-------|-------------|
| 1 — Core routing | NotificationService | Routes events to plugins based on preferences |
| 2 — Plugin filtering | `preferences.ts` shouldSend() | Telegram-specific severity/quiet-hours/event-type filtering |
| 3 — Chat resolution | `resolveChatId()` (this story) | Maps project → specific chat ID, falls back to default |

### YAML Configuration Schema

```yaml
notifiers:
  telegram:
    plugin: telegram
    botToken: ${TELEGRAM_BOT_TOKEN}
    defaultChatId: ${TELEGRAM_CHAT_ID}
    allowedChatIds: [-1001234567890, -1009876543210]
    projectChatMapping:
      my-app: "-1001234567890"        # my-app team channel
      api-service: "-1009876543210"    # api-service team channel
      # Unmapped projects → defaultChatId
    preferences:
      severityFilter: critical-and-warning
      quietHours:
        enabled: false
        start: "22:00"
        end: "07:00"
        timezone: "America/New_York"
```

### `resolveChatId()` Logic Flow

```
1. Extract projectId from notification.metadata?.projectId
2. If no projectId → return defaultChatId
3. If projectChatMapping not configured → return defaultChatId
4. Look up projectChatMapping[projectId]
5. If not found → return defaultChatId
6. If allowedChatIds configured AND mapped chat ID NOT in list:
   - console.warn("[notifier-telegram] Mapped chat ID for project X not in allowedChatIds, using defaultChatId")
   - return defaultChatId
7. Return mapped chat ID
```

### File Structure

```
packages/plugins/notifier-telegram/src/
├── index.ts                    # UNCHANGED
├── notification-plugin.ts      # MODIFY: add projectChatMapping to config, add resolveChatId(), use in send()
├── telegram-bot.ts             # UNCHANGED
├── markdown-escape.ts          # UNCHANGED
├── send-helpers.ts             # UNCHANGED
├── event-formatter.ts          # UNCHANGED
├── preferences.ts              # UNCHANGED
└── __tests__/
    ├── notification-plugin.test.ts  # MODIFY: add project chat mapping tests
    └── preferences.test.ts         # UNCHANGED
```

### Integration with Existing Stories (MUST Follow)

These are verified patterns from Stories 57-1 through 57-3. The dev agent MUST follow these:

1. **Package import resolution**: `@composio/ao-core` only exports from top-level. No subpath imports.

2. **Mock pattern for tests**: Single top-level `vi.mock()` for each package. Do NOT use `importOriginal` with subpath type imports.

3. **`.js` extensions in imports**: Required for ESM. All local imports must end with `.js`.

4. **No circular imports**: Do NOT import from `index.js` in `notification-plugin.ts`. Import `sendWithRetry` from `send-helpers.js` only.

5. **Error handling in `send()`**: Wrap in try/catch with `console.error` logging (established in 57-2 review).

6. **MarkdownV2 escaping**: ALL dynamic content must be escaped via `escapeMarkdownV2()`.

7. **Preferences run first**: `shouldSend()` check at line 81 runs BEFORE `resolveChatId()`. This is correct — filter first, then route.

### Testing Strategy

**Unit tests (notification-plugin.test.ts — additions):**
- `send()` with `projectChatMapping` and matching `metadata.projectId` → sent to mapped chat ID
- `send()` with `projectChatMapping` and non-matching `projectId` → sent to `defaultChatId`
- `send()` with no `projectChatMapping` → all sent to `defaultChatId` (backward compat)
- `send()` with mapped chat ID not in `allowedChatIds` → warning + fallback to `defaultChatId`
- `send()` with notification missing `metadata` → falls back to `defaultChatId`

### NFRs
- **NFR-I1-1:** Telegram notification delivery within 5 seconds (chat ID resolution is synchronous/cheap)
- **NFR-S1:** Telegram bot authentication uses secure token validation (unchanged)
- **NFR-R1:** Telegram notifications have 99% delivery success rate (resolveChatId should never crash)

### Pre-existing Types (Use These, Do NOT Modify)
- `Notification`, `NotificationPlugin`, `NotificationPriority` — from `@composio/ao-core` types.ts
- `TelegramBot`, `TelegramBotConfig` — from `./telegram-bot.js`
- `escapeMarkdownV2()` — from `./markdown-escape.js`
- `sendWithRetry()` — from `./send-helpers.js`
- `formatNotificationMessage()` — from `./event-formatter.js`
- `shouldSend()`, `parsePreferences()` — from `./preferences.js`
- `TelegramNotificationPluginConfig` — from `./notification-plugin.js`

### References
- [Source: epics-cycle-10.md#Story 57.4] — Story definition and acceptance criteria
- [Source: prd-cycle-10.md#FR-I1-4] — "Users can configure notification preferences: per-project settings"
- [Source: prd-cycle-10.md#FR-I2-2] — "Commands support project context: /status project:my-app"
- [Source: packages/core/src/types.ts#NotifyContext] — Has `projectId` and `channel` fields (legacy hook)
- [Source: packages/core/src/types.ts#NotifierConfig] — Passthrough config with `[key: string]: unknown`
- [Source: packages/core/src/config.ts#ProjectConfigSchema] — No notifier fields (gap, but out of scope)
- [Source: packages/core/src/notification-service.ts#filterPluginsByPreference] — Existing preference filtering
- [Source: _bmad-output/implementation-artifacts/57-3-notification-preference-configuration.md] — Previous story with preferences
- [Source: agent-orchestrator.yaml.example#L148-166] — Existing YAML telegram config

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- Test run: `pnpm test --filter @composio/ao-plugin-notifier-telegram` — 134 tests, 0 failures
- Typecheck: `pnpm --filter @composio/ao-plugin-notifier-telegram typecheck` — clean, 0 errors

### Completion Notes List

1. Added `projectChatMapping?: Record<string, string>` to `TelegramNotificationPluginConfig` interface
2. Created exported `resolveChatId()` function in `notification-plugin.ts` with full logic: extract projectId from metadata, lookup mapping, validate against allowedChatIds with warning fallback
3. Updated `send()` to call `resolveChatId()` instead of hard-coded `defaultChatId` — passes `config?.projectChatMapping` and `config?.allowedChatIds` from closure
4. Updated `agent-orchestrator.yaml.example` with commented-out `projectChatMapping` section showing per-project channel routing
5. Added 10 `resolveChatId()` unit tests: matching projectId, no mapping, projectId not in mapping, no metadata, no projectId, allowedChatIds blocked (with warning), allowedChatIds allowed, empty allowedChatIds, non-string projectId, empty string projectId
6. Added 4 `send()` integration tests: routes to mapped chat ID, falls back for unmapped projects, falls back when not in allowedChatIds, backward compat with no mapping
7. Total test count: 131 (was 117 from 57-3, now 131 with 14 new tests)
8. Zero regressions — all existing tests pass
9. **Code review fixes (4 issues)**:
    - M1: Added `console.debug` logging when notification is routed to a project-specific chat ID (production observability)
    - L1: Updated file-level JSDoc from "Story 57.1 + 57.2" to include 57.3 and 57.4
    - L2: Added test combining preference filtering (critical-only severity) with project chat mapping — verifies both layers work together
    - L3: Added `typeof mappedChatId !== "string"` guard in `resolveChatId()` to protect against inherited Object prototype properties (e.g., `constructor`) and added test for `projectId: "constructor"` edge case
10. Post-review test count: 134 (3 new tests added)

### Limitations (Deferred Items)
1. **Team-specific notification rules (beyond chat ID mapping)**
   - Status: Deferred — Complex rule engine (event-type-per-project filtering) deferred to a future story
   - Requires: Per-project notification preference resolution in config
   - Current: Chat ID mapping routes to correct channel; preferences are still global

2. **Dynamic chat ID discovery via bot commands**
   - Status: Deferred — Users cannot `/register` new chat IDs from Telegram
   - Requires: Bot command handler for channel registration
   - Epic: Story 57-5+ (Telegram commands)
   - Current: Chat IDs are statically configured in YAML

### File List

**MODIFIED:**
- `packages/plugins/notifier-telegram/src/notification-plugin.ts` — Added `projectChatMapping` to config, added `resolveChatId()` function, updated `send()` to use resolved chat ID
- `packages/plugins/notifier-telegram/src/__tests__/notification-plugin.test.ts` — Added 14 tests for project chat mapping (10 resolveChatId unit tests + 4 send integration tests)
- `agent-orchestrator.yaml.example` — Added commented-out `projectChatMapping` section
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Updated 57-4 status: backlog → ready-for-dev → in-progress → review
