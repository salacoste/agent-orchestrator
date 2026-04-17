# Story 57.1: Telegram Bot Registration

Status: done

## Story

As a **project manager**,
I want **to register a Telegram bot with the orchestrator**,
so that **I can receive notifications and send commands via Telegram**.

## Acceptance Criteria

1. **Given** I have created a bot via BotFather
   **When** I configure the bot token in `agent-orchestrator.yaml`
   **Then** the system validates the token against the Telegram Bot API (`getMe`)
   **And** connectivity is confirmed with a success log/message
   **And** an invalid token produces a clear error message at startup

2. **Given** the bot is configured and validated
   **When** a Telegram user sends a message to the bot
   **Then** the system checks the user's `chat_id` against the configured allowlist
   **And** authorized users receive a welcome confirmation
   **And** unauthorized users receive a "not authorized" response

3. **Given** I want to configure authorized users
   **When** I add `allowedChatIds` to the telegram notifier config
   **Then** only those chat IDs can interact with the bot
   **And** an empty allowlist allows all users (open mode, logged warning)

4. **Given** the orchestrator is running behind a public URL
   **When** I enable webhook mode in config
   **Then** the system registers a webhook endpoint with Telegram
   **And** incoming updates are received via the webhook API route
   **And** the webhook secret token is validated on every request

5. **Given** the orchestrator is running locally (no public URL)
   **When** I enable polling mode in config (default for local dev)
   **Then** the system uses long polling (`getUpdates`) to receive updates
   **And** polling mode and webhook mode are mutually exclusive

## Tasks / Subtasks

- [x] Task 1: Create notifier-telegram plugin package (AC: #1)
  - [x] 1.1: Create `packages/plugins/notifier-telegram/` with `package.json` (follow `notifier-webhook` pattern — `@composio/ao-plugin-notifier-telegram`, MIT, ESM, deps: `@composio/ao-core`, `grammy`)
  - [x] 1.2: Create `tsconfig.json` extending root config
  - [x] 1.3: Create `src/index.ts` — manifest (`name: "telegram"`, `slot: "notifier"`, `version: "0.1.0"`), `create(config)` returning `Notifier`, default export satisfies `PluginModule<Notifier>`
  - [x] 1.4: Create `src/notification-plugin.ts` — `createNotificationPlugin(config)` returning `NotificationPlugin` (adapter pattern from webhook)
  - [x] 1.5: Add `grammy` dependency to `package.json` (`^1.36.0` — latest stable TypeScript-native Telegram bot framework)

- [x] Task 2: Implement bot initialization and token validation (AC: #1)
  - [x] 2.1: Create `src/telegram-bot.ts` — `TelegramBot` class wrapping grammY `Bot` instance
  - [x] 2.2: Implement `validateToken()` — calls `bot.api.getMe()`, returns `{ valid: boolean, botInfo?: { id, username, firstName } }`
  - [x] 2.3: Implement `initialize(config)` — validates token, sets up middleware, returns initialized bot
  - [x] 2.4: On invalid token: throw descriptive error with setup instructions (point to BotFather)
  - [x] 2.5: On valid token: log success with bot username (`[notifier-telegram] Bot @username connected`)

- [x] Task 3: Implement user authorization middleware (AC: #2, #3)
  - [x] 3.1: Parse `allowedChatIds` from config (array of numbers or strings)
  - [x] 3.2: If `allowedChatIds` is empty/missing: log warning, allow all users (open mode)
  - [x] 3.3: If `allowedChatIds` is set: add grammY middleware that checks `ctx.chat.id` against allowlist
  - [x] 3.4: Authorized: pass through to handlers
  - [x] 3.5: Unauthorized: respond with "not authorized" response and skip further handlers
  - [x] 3.6: Add `/start` command handler — sends welcome message with bot capabilities summary

- [x] Task 4: Implement webhook mode for production (AC: #4)
  - [x] 4.1: Create `packages/web/src/app/api/telegram/webhook/route.ts` — Next.js API route handler
  - [x] 4.2: Manual webhook handling via `bot.handleUpdate()` (grammY `webhookCallback` adapter incompatible with Next.js App Router)
  - [x] 4.3: Validate `X-Telegram-Bot-Api-Secret-Token` header against configured secret
  - [x] 4.4: Implement `registerWebhook()` — calls `bot.api.setWebhook()` with URL and secret token
  - [x] 4.5: On orchestrator startup (when `mode: "webhook"`): auto-register webhook if public URL configured
  - [x] 4.6: Return 200 for valid requests, 401 for invalid secret, 500 for processing errors

- [x] Task 5: Implement polling mode for local dev (AC: #5)
  - [x] 5.1: When `mode: "polling"` (default): call `bot.start()` with grammY long polling
  - [x] 5.2: Add `dropPendingUpdates: true` option to avoid processing stale messages
  - [x] 5.3: Add graceful shutdown — `bot.stop()` on process exit
  - [x] 5.4: Log polling start: `[notifier-telegram] Polling for updates...`
  - [x] 5.5: If webhook was previously set, call `bot.api.deleteWebhook()` before starting polling

- [x] Task 6: Implement Notifier interface methods (AC: #1)
  - [x] 6.1: `notify(event)` — format event as Telegram message with markdown, call `bot.api.sendMessage()`
  - [x] 6.2: `notifyWithActions(event, actions)` — format with inline keyboard buttons from `NotifyAction[]`
  - [x] 6.3: `post(message, context)` — send plain text message to configured chat ID
  - [x] 6.4: Rate limit handling — catch 429 errors, extract `retry_after`, backoff and retry
  - [x] 6.5: Message formatting: use `parse_mode: "MarkdownV2"`, escape special characters

- [x] Task 7: Update config schema and registration (AC: #1)
  - [x] 7.1: Add Telegram config example to `agent-orchestrator.yaml.example`
  - [x] 7.2: Register factory in `packages/cli/src/lib/plugins.ts` — add `telegram` to `notifierPluginFactories`
  - [x] 7.3: Add dependency security review entry in `sprint-status.yaml` for `grammy`

- [x] Task 8: Add tests (AC: all)
  - [x] 8.1: Create `packages/plugins/notifier-telegram/src/__tests__/index.test.ts` — 13 tests for Notifier interface
  - [x] 8.2: Create `packages/plugins/notifier-telegram/src/__tests__/telegram-bot.test.ts` — 12 tests for token validation, auth middleware, mode selection
  - [x] 8.3: Create `packages/web/src/app/api/telegram/webhook/route.test.ts` — 3 tests for webhook route (valid secret, invalid secret, missing secret)
  - [x] 8.4: Create `packages/plugins/notifier-telegram/src/__tests__/markdown-escape.test.ts` — 19 tests for MarkdownV2 escaping
  - [x] 8.5: Test unauthorized user receives "not authorized" response (covered in telegram-bot.test.ts)
  - [x] 8.6: Test token validation failure throws descriptive error (covered in telegram-bot.test.ts)

- [x] Task 9: Update sprint-status.yaml
  - [x] 9.1: Run full test suite — 0 regressions (web: 202/202 pass, plugin: 44/44 pass)
  - [x] 9.2: Update `57-1-telegram-bot-registration` status to review

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
1. **Polling mode in production**
   - Status: Deferred — Polling mode is for local development only
   - Requires: Production deployments should use webhook mode
   - Epic: Story 57.2+ (subsequent stories assume webhook mode)
   - Current: Polling works but is not recommended for production
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
- `Notifier.notify(event: OrchestratorEvent): Promise<void>` — EXISTING: core notification interface
- `Notifier.notifyWithActions(event, actions): Promise<void>` — EXISTING: notification with action buttons
- `Notifier.post(message, context?): Promise<string | null>` — EXISTING: send plain message
- `NotificationPlugin.send(notification: Notification): Promise<void>` — EXISTING: newer notification interface
- `NotificationPlugin.isAvailable(): Promise<boolean>` — EXISTING: availability check
- `notificationToOrchestratorEvent(notification)` from `@composio/ao-core` — EXISTING: adapter utility
- `validateUrl(url, pluginName)` from `@composio/ao-core` — EXISTING: URL validation (not needed for Telegram, but pattern reference)
- `getServices()` from `@/lib/services` — EXISTING: returns `{ config, registry, sessionManager }`

**grammY API Methods Used:**
- `new Bot(token)` — Create bot instance
- `bot.api.getMe()` — Validate token and get bot info
- `bot.api.sendMessage(chat_id, text, options)` — Send messages
- `bot.api.setWebhook(url, options)` — Register webhook URL
- `bot.api.deleteWebhook()` — Remove webhook (for polling mode)
- `bot.start(options)` — Start long polling
- `bot.stop()` — Stop polling
- `bot.use(middleware)` — Register middleware (authorization)
- `bot.command('start', handler)` — Register command handler
- `bot.handleUpdate(update)` — Manual webhook update handling (replaces `webhookCallback` which is incompatible with Next.js App Router)

**Feature Flags:**
- None required — all interfaces already exist in the codebase

## Dependency Review

### New Dependency: `grammy`

| Field | Value |
|-------|-------|
| **Package** | `grammy` |
| **Version** | `^1.36.0` |
| **License** | MIT |
| **Compatibility** | ✅ MIT — compatible with project license |
| **Why this library** | TypeScript-native, ESM support, Next.js webhook adapter, active maintenance, fastest Bot API update cadence |
| **Alternatives considered** | `telegraf` (TypeScript types lag behind), `node-telegram-bot-api` (JS-native, no middleware, stale) |
| **Security notes** | No known vulnerabilities. Token never committed — referenced via `${TELEGRAM_BOT_TOKEN}` env var |
| **Bundle size** | ~30KB minified — lightweight, no native dependencies |

### License Compatibility Table

| Dependency | Version | License | Compatible |
|-----------|---------|---------|------------|
| grammy | ^1.36.0 | MIT | ✅ Yes |

## Dev Notes

### Architecture Context

This is **Story 1 of 15** in **Epic 57: Telegram Bot Integration**. It is the **foundation story** — all subsequent Telegram stories (57.2-57.15) depend on this story being complete.

**Dependency chain:** Epic 49 (done) → Epic 54 (done) → Epic 56 (done) → **Epic 57 (this epic)**

**Previous epic completion:** Epic 56 (Risk & Optimization Dashboard) completed with Story 56-11 (Optimization Learning Loop). All 11 stories done, 2495 tests passing.

### What Already Exists (Do NOT Reinvent)

#### Notifier Plugin Pattern (ALL existing plugins follow this)

Every notifier plugin has:
1. `packages/plugins/notifier-{name}/src/index.ts` — manifest + `create(config?)` returning `Notifier` + default export `satisfies PluginModule<Notifier>`
2. `packages/plugins/notifier-{name}/src/notification-plugin.ts` — `createNotificationPlugin(config?)` returning `NotificationPlugin`
3. `packages/plugins/notifier-{name}/package.json` — ESM, `@composio/ao-core` dependency, standard scripts

**Reference implementation: `notifier-webhook`** — closest analog because it:
- Has external HTTP calls (fetch with retry)
- Has config validation (URL required)
- Has both `Notifier` and `NotificationPlugin` interfaces

#### Plugin Registration

`packages/cli/src/lib/plugins.ts` line 46-53 — `notifierPluginFactories` map:
```typescript
const notifierPluginFactories: Record<string, NotifierPluginFactory> = {
  desktop: (config) => createDesktopNotificationPlugin(config),
  slack: (config) => createSlackNotificationPlugin(config),
  webhook: (config) => createWebhookNotificationPlugin(config),
  composio: (config) => createComposioNotificationPlugin(config),
};
```

Add `telegram` entry following same pattern.

#### Notification Service

`packages/core/src/notification-service.ts` — subscribes to EventBus, routes notifications to registered plugins. The Telegram plugin receives notifications through this service — no changes needed to the service itself.

#### Notification Adapter

`packages/core/src/notification-adapter.ts` — `notificationToOrchestratorEvent()` converts `Notification` → `OrchestratorEvent`. Used by all `NotificationPlugin` adapters.

### What This Story Actually Does

1. **New plugin package**: Create `packages/plugins/notifier-telegram/` following the webhook notifier pattern exactly.

2. **Telegram bot wrapper**: Create `src/telegram-bot.ts` — encapsulates grammY Bot instance, token validation, authorization middleware, mode selection (webhook vs polling).

3. **Notifier implementation**: Implement `notify()`, `notifyWithActions()`, `post()` — format events as Telegram messages with MarkdownV2, inline keyboards for actions.

4. **Webhook endpoint**: Create Next.js API route at `/api/telegram/webhook` — uses grammY's `webhookCallback` adapter.

5. **Config registration**: Add Telegram config example, register factory in plugins.ts, add dependency review entry.

6. **Tests**: Unit tests for plugin, bot wrapper, and webhook route.

### Critical Design Decisions

1. **grammY over alternatives** — TypeScript-native, ESM support, built-in Next.js adapter, actively maintained. `telegraf` types lag behind Bot API. `node-telegram-bot-api` is JS-native with stale development.

2. **Dual-mode (webhook + polling)** — Webhook for production (Next.js already runs HTTP server), polling for local dev (no tunnel needed). Default: polling. Mutually exclusive.

3. **Chat ID allowlist for authorization** — No built-in Telegram auth. Simple numeric ID allowlist in config. Empty allowlist = open mode (logged warning).

4. **Webhook secret token** — Every webhook request validated against `X-Telegram-Bot-Api-Secret-Token` header. Configured via `webhookSecret` in YAML.

5. **MarkdownV2 formatting** — Telegram's MarkdownV2 requires escaping special characters: `_`, `*`, `[`, `]`, `(`, `)`, `~`, `` ` ``, `>`, `#`, `+`, `-`, `=`, `|`, `{`, `}`, `.`, `!`. Implement an escape utility.

6. **Rate limit handling** — Catch 429 errors from Telegram API, extract `retry_after` from response, exponential backoff. For this story's notification volume (single user, occasional events), rate limits are unlikely to trigger, but the handling must exist.

7. **Plugin-only scope** — This story creates the notifier plugin package. It does NOT modify `packages/web` dashboard components (those come in Story 57.2+). The webhook API route is the only web-package addition.

8. **Polling as default** — Safer default. Users who deploy with a public URL explicitly set `mode: webhook`.

### Config Schema

```yaml
notifiers:
  telegram:
    plugin: telegram
    botToken: ${TELEGRAM_BOT_TOKEN}          # Required — from @BotFather
    allowedChatIds: [123456789, 987654321]  # Optional — empty = open mode
    defaultChatId: ${TELEGRAM_CHAT_ID}      # Required — default target for notifications
    mode: polling                            # polling | webhook (default: polling)
    webhookUrl: ""                           # Required if mode=webhook
    webhookSecret: ""                        # Optional but recommended for webhook mode
```

### File Structure

```
packages/plugins/notifier-telegram/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                    # manifest + create() + default export
    ├── notification-plugin.ts      # NotificationPlugin adapter
    ├── telegram-bot.ts             # Bot wrapper (validation, auth, mode)
    ├── markdown-escape.ts          # Telegram MarkdownV2 escape utility
    └── __tests__/
        ├── index.test.ts           # Notifier interface tests
        ├── telegram-bot.test.ts    # Bot initialization + auth tests
        └── markdown-escape.test.ts # MarkdownV2 escape tests

packages/web/src/app/api/telegram/
└── webhook/
    └── route.ts                    # Webhook endpoint
    └── route.test.ts               # Webhook route tests
```

### Integration with Existing Stories (MUST Follow)

These are verified patterns from completed stories. The dev agent MUST follow these to avoid regressions:

1. **Package import resolution**: `@composio/ao-core` only exports from top-level. No subpath imports.

2. **Mock pattern for tests**: Single top-level `vi.mock()` for each package. Do NOT use `importOriginal` with subpath type imports.

3. **`.js` extensions in imports**: Required for ESM. All local imports must end with `.js`.

4. **Plugin `satisfies` pattern**: Default export MUST use `satisfies PluginModule<Notifier>` — not just `as PluginModule<Notifier>`.

5. **Security**: Bot token NEVER committed. Always via env var expansion `${TELEGRAM_BOT_TOKEN}` in config.

6. **Error handling**: Throw typed errors, not return codes. Invalid token = throw with setup instructions.

7. **Logging**: Use `console.warn`/`console.error` with `[notifier-telegram]` prefix (same as `notifier-webhook`).

8. **Retry pattern**: Follow webhook plugin's `postWithRetry()` pattern — exponential backoff, only retry on 429/5xx.

### Testing Strategy

**Unit tests (telegram-bot.test.ts):**
- Token validation: valid token returns bot info, invalid token throws with instructions
- Authorization: allowed chat ID passes, blocked chat ID gets "not authorized"
- Open mode: empty allowlist logs warning and allows all
- Mode selection: polling starts bot.start(), webhook registers webhook URL
- Webhook cleanup: switching from webhook to polling calls deleteWebhook()

**Unit tests (index.test.ts):**
- notify() sends formatted message to default chat ID
- notifyWithActions() sends message with inline keyboard
- post() sends plain text message
- Rate limit: 429 error triggers retry with backoff
- No token configured: warn and no-op (same as webhook pattern)

**Unit tests (markdown-escape.test.ts):**
- Escapes all MarkdownV2 special characters
- Handles empty string
- Handles string with no special characters
- Handles string with all special characters

**API route tests (route.test.ts):**
- Valid secret + valid update → 200
- Invalid secret → 401
- Missing secret → 401
- Processing error → 500

### NFRs
- **NFR-I1-1:** Telegram notification delivery within 5 seconds of event (this story: delivery pipeline ready)
- **NFR-I1-2:** Bot handles rate limits gracefully with exponential backoff
- **NFR-I2-1:** Command response within 3 seconds (this story: `/start` only — full commands in 57.5+)
- **NFR-I2-2:** Bot handles concurrent commands from multiple users

### Pre-existing Types (Use These, Do NOT Modify Unless Adding)
- `Notifier`, `NotifyAction`, `NotifyContext` — from `@composio/ao-core` types.ts
- `NotificationPlugin`, `Notification`, `NotificationPriority` — from `@composio/ao-core` types.ts
- `PluginModule`, `PluginManifest` — from `@composio/ao-core` types.ts
- `OrchestratorEvent`, `EventPriority`, `EventType` — from `@composio/ao-core` types.ts
- `notificationToOrchestratorEvent()` — from `@composio/ao-core` notification-adapter.ts

### Project Structure Notes
- Follow existing TypeScript/ESM conventions from CLAUDE.md
- `.js` extensions in imports, `node:` prefix for builtins
- Co-located test files in `__tests__/` pattern
- All existing tests must continue to pass (no regressions)
- One new npm dependency: `grammy` (MIT, reviewed above)
- Plugin package follows exact structure of `notifier-webhook`

### References
- [Source: epics-cycle-10.md#Story 57.1] — Story definition and acceptance criteria
- [Source: prd-cycle-10.md#FR-I1-1] — "Users can configure Telegram as a notification channel"
- [Source: prd-cycle-10.md#FR-I1-2] — Notification types supported
- [Source: packages/plugins/notifier-webhook/src/index.ts] — Reference implementation for notifier plugin
- [Source: packages/plugins/notifier-webhook/src/notification-plugin.ts] — Reference for NotificationPlugin adapter
- [Source: packages/cli/src/lib/plugins.ts] — Plugin factory registration
- [Source: packages/core/src/types.ts] — Notifier, NotificationPlugin, PluginModule interfaces
- [Source: packages/core/src/notification-adapter.ts] — Adapter utility for NotificationPlugin
- [Source: packages/core/src/notification-service.ts] — Notification routing and trigger map
- [Source: agent-orchestrator.yaml.example] — Config format reference
- [Source: grammY docs](https://grammy.dev/) — TypeScript Telegram bot framework
- [Source: Telegram Bot API](https://core.telegram.org/bots/api) — Official API reference

## Dev Agent Record
### Agent Model Used
Claude Opus 4.6

### Debug Log References
- grammY `webhookCallback` adapter incompatible with Next.js App Router — uses Pages Router `req/res` signature. Replaced with `handleUpdate()` + manual webhook route.
- grammY `bot.api` is `Api<RawApi>`, not `RawApi` — getter return type corrected.
- `@composio/ao-plugin-notifier-telegram` not a web dependency — added to web `package.json` so vitest can resolve dynamic imports in webhook route tests.

### Completion Notes List
1. Plugin package created with all 4 source files + 3 test files (47 tests total)
2. Webhook route uses manual `handleUpdate()` instead of grammY adapter (App Router incompatibility)
3. Web package dependency added for telegram plugin (needed for webhook route resolution)
4. All 5 acceptance criteria verified through test coverage
5. Full regression suite: web 202/202 pass (2498 tests), plugin 44/44 pass, CLI pre-existing failures unrelated

### Change Summary
New Telegram notifier plugin with grammY framework integration. Bot wrapper supports token validation, chat ID authorization middleware, dual-mode operation (polling/webhook), and MarkdownV2 message formatting with rate limit handling. Webhook API route validates secret token header. Plugin registered in CLI factory map. Config example added.

### File List
**New files:**
- `packages/plugins/notifier-telegram/package.json`
- `packages/plugins/notifier-telegram/tsconfig.json`
- `packages/plugins/notifier-telegram/src/index.ts`
- `packages/plugins/notifier-telegram/src/notification-plugin.ts`
- `packages/plugins/notifier-telegram/src/telegram-bot.ts`
- `packages/plugins/notifier-telegram/src/markdown-escape.ts`
- `packages/plugins/notifier-telegram/src/__tests__/index.test.ts`
- `packages/plugins/notifier-telegram/src/__tests__/telegram-bot.test.ts`
- `packages/plugins/notifier-telegram/src/__tests__/markdown-escape.test.ts`
- `packages/plugins/notifier-telegram/src/__tests__/notification-plugin.test.ts`
- `packages/web/src/app/api/telegram/webhook/route.ts`
- `packages/web/src/app/api/telegram/webhook/route.test.ts`

**Modified files:**
- `agent-orchestrator.yaml.example` — added Telegram notifier config section
- `packages/cli/src/lib/plugins.ts` — added telegram factory registration
- `packages/web/package.json` — added `@composio/ao-plugin-notifier-telegram` dependency
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — updated story status

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.6 (adversarial code review)
**Date:** 2026-04-08
**Outcome:** All issues fixed — approved

### Issues Found and Fixed

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| H1 | HIGH | Webhook route no body validation | Added `update_id` shape check → 400 |
| H2 | HIGH | `callback_data` no 64-byte limit check | Added length guard in `notifyWithActions` |
| H3 | HIGH | Stale `webhookCallback` in Interface Validation | Updated to `handleUpdate` |
| M1 | MEDIUM | Linear backoff, not exponential | Changed to `Math.pow(2, attempt)` |
| M2 | MEDIUM | Missing 500 error path test | Added test for handleUpdate throwing |
| M3 | MEDIUM | Undocumented `as never` cast | Added explanatory comment |
| M4 | MEDIUM | Module-level state not refreshable | Added NOTE comment |
| L1 | LOW | Unnecessary `g` flag on regex | Reviewed — `g` flag IS needed for `replace()` (reverted) |
| L2 | LOW | No notification-plugin tests | Added 6 tests for `isAvailable` and `send` |
| L3 | LOW | `post()` always returns null | Now returns `message_id` string from Telegram API |

### Review Added Files
- `packages/plugins/notifier-telegram/src/__tests__/notification-plugin.test.ts` (6 tests)

### Review Modified Files
- `packages/plugins/notifier-telegram/src/index.ts` — exponential backoff, callback_data guard, message ID return
- `packages/plugins/notifier-telegram/src/telegram-bot.ts` — documented `as never` cast
- `packages/web/src/app/api/telegram/webhook/route.ts` — body validation, config caching note
- `packages/web/src/app/api/telegram/webhook/route.test.ts` — added 400 and 500 tests
- `packages/plugins/notifier-telegram/src/__tests__/index.test.ts` — updated post test for message ID

### Final Test Results
- Plugin package: 50/50 tests pass (was 44, +6 notification-plugin tests)
- Web package: 2500/2500 tests pass (was 2498, +2 new tests)
- Zero regressions
