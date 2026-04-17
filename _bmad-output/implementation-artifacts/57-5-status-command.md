# Story 57.5: /status Command

Status: done

## Story

As a **project manager**,
I want **to send /status to get a summary of system health**,
so that **I can quickly check system state from my phone**.

## Acceptance Criteria

1. **Given** the Telegram bot is running
   **When** I send "/status"
   **Then** I receive a formatted response with active agents, stories in progress, blocked items, and system health
   **And** the response uses emoji indicators for quick scanning
   **And** the response arrives within 3 seconds

2. **Given** the system has no active sessions
   **When** I send "/status"
   **Then** I receive a response showing "No active sessions" with system health
   **And** the response is still formatted with emoji indicators

3. **Given** the status provider encounters an error
   **When** I send "/status"
   **Then** I receive a graceful error message
   **And** no unhandled exception crashes the bot

4. **Given** the status provider takes longer than 3 seconds
   **When** I send "/status"
   **Then** I receive a timeout fallback message with whatever partial data is available

## Tasks / Subtasks

- [x] Task 1: Define SystemStatus type and StatusProvider in telegram-bot.ts (AC: #1, #3)
  - [x] 1.1: Add `SystemStatus` interface to `telegram-bot.ts` with fields: `activeAgents`, `totalSessions`, `workingSessions`, `blockedSessions`, `idleSessions`, `openPRs`, `needsReview`, `healthStatus` (`"healthy" | "degraded" | "unhealthy" | "unknown"`), `healthMessage`, `timestamp`
  - [x] 1.2: Add `StatusProvider` type: `() => Promise<SystemStatus>`
  - [x] 1.3: Export both types from the module (add to existing export patterns)

- [x] Task 2: Add `registerStatusCommand()` to TelegramBot class (AC: #1, #2, #3, #4)
  - [x] 2.1: Add `registerStatusCommand(statusProvider: StatusProvider): void` method to `TelegramBot`
  - [x] 2.2: Register grammY `/status` command handler via `this.bot.command("status", async (ctx) => { ... })`
  - [x] 2.3: In handler: call `statusProvider()` with a 3-second timeout using `Promise.race([statusProvider(), timeout(3000)])` — on timeout, returns fallback error message
  - [x] 2.4: Format response using `formatStatusMessage(status: SystemStatus): string` helper — MarkdownV2 with emoji indicators
  - [x] 2.5: Use `escapeMarkdownV2()` for any dynamic content (counts are safe as numbers, but strings like healthMessage must be escaped)
  - [x] 2.6: Wrap entire handler in try/catch — on error, reply with `\u26A0\uFE0F Status unavailable` using `ctx.reply(errorMsg, { parse_mode: "MarkdownV2" })`
  - [x] 2.7: Reply via `ctx.reply(formatted, { parse_mode: "MarkdownV2" })`

- [x] Task 3: Create `formatStatusMessage()` helper in telegram-bot.ts (AC: #1, #2)
  - [x] 3.1: Create exported `formatStatusMessage(status: SystemStatus): string` function
  - [x] 3.2: Use emoji indicators: `\u{1F7E2}` (green) for healthy, `\u{1F7E1}` (yellow) for degraded, `\u{1F534}` (red) for unhealthy, `\u26AB` (black) for unknown
  - [x] 3.3: Format sections: System Health header, Agents summary, Activity summary
  - [x] 3.4: Escape all dynamic text via `escapeMarkdownV2()`
  - [x] 3.5: Return MarkdownV2 string

- [x] Task 4: Wire status provider in webhook route (AC: #1)
  - [x] 4.1: In `packages/web/src/app/api/telegram/webhook/route.ts`, import `StatusProvider` type and `SessionManager` from core
  - [x] 4.2: Create `createStatusProvider(sessionManager: SessionManager): StatusProvider` function that:
    - Calls `sessionManager.list()` to get all sessions
    - Counts active agents: sessions where `activity !== ACTIVITY_STATE.EXITED`
    - Counts working sessions: sessions where `status === "working"`
    - Counts blocked sessions: sessions where `status === "blocked"` or `activity === ACTIVITY_STATE.BLOCKED`
    - Counts open PRs: sessions where `pr !== null` (PRInfo doesn't have `state`; deferred)
    - Counts needs review: `0` (PRInfo doesn't carry `reviewDecision`; deferred to Story 57-10)
    - Returns `SystemStatus` with `healthStatus: "unknown"` for V1 (health check integration deferred to Story 57.8)
  - [x] 4.3: In `getBot()`, after `_bot.registerStartCommand()`, add `_bot.registerStatusCommand(createStatusProvider(services.sessionManager))`

- [x] Task 5: Add tests (AC: all)
  - [x] 5.1: Test `formatStatusMessage()` returns MarkdownV2 formatted string with emoji indicators for healthy status
  - [x] 5.2: Test `formatStatusMessage()` shows degraded/unhealthy/unknown indicators correctly
  - [x] 5.3: Test `formatStatusMessage()` handles zero sessions (empty state)
  - [x] 5.4: Test `formatStatusMessage()` escapes dynamic content
  - [x] 5.5: Test `registerStatusCommand()` registers 'status' command on bot instance
  - [x] 5.6: Test `registerStatusCommand()` handles provider error gracefully (error reply, no crash) — added in code review follow-up
  - [x] 5.7: Test `registerStatusCommand()` handles timeout gracefully (fallback message) — added in code review follow-up
  - [x] 5.8: Test `/status` command is registered on the grammY bot instance
  - [x] 5.9: Test fallback reply `.catch()` prevents double-throw on network failure — added in code review follow-up
  - [x] 5.10: Run full test suite — 0 regressions (147 tests pass)

- [x] Task 6: Update sprint-status.yaml

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
1. **Health check integration in /status**
   - Status: Deferred — Full HealthCheckService integration deferred to Story 57-8 (/health command)
   - Requires: HealthCheckService instantiation and component-level health data
   - Current: /status returns `healthStatus: "unknown"` for V1; only session-derived data

2. **Project-scoped /status command**
   - Status: Deferred — `/status project:my-app` syntax deferred to Story 57-10
   - Requires: Argument parsing in command handler, per-project session filtering
   - Current: /status returns cross-project overview only

3. **Sprint story counts from BMAD tracker**
   - Status: Deferred — Story counts (in-progress, blocked, done) from tracker deferred to a future enhancement
   - Requires: Tracker plugin access through registry, BMAD file parsing
   - Current: /status uses session-derived counts (working sessions = active stories, blocked sessions = blocked items)
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
- `TelegramBot.bot.command(name, handler)` — EXISTING: grammY Bot command registration (pattern established in `registerStartCommand()`)
- `SessionManager.list(): Promise<Session[]>` — EXISTING: returns all sessions (from `@composio/ao-core`)
- `Session.status` — EXISTING: `SessionStatus` union type with 18 states
- `Session.activity` — EXISTING: `ActivityState` with 6 states (`"active" | "ready" | "idle" | "waiting_input" | "blocked" | "exited"`)
- `Session.pr` — EXISTING: PR metadata with `state`, `isDraft`, `reviewDecision`
- `ctx.reply(text, options)` — EXISTING: grammY context reply method

**Feature Flags:**
- None required — all interfaces exist. Health check data deferred to Story 57-8 by design.

## Dependency Review

No new dependencies. This story uses existing packages only:
- `@composio/ao-core` (workspace dependency — SessionManager, Session types, ACTIVITY_STATE)
- `grammy` (already reviewed in Story 57-1)

## Dev Notes

### Architecture Context

This is **Story 5 of 15** in **Epic 57: Telegram Bot Integration**. It depends on **Stories 57-1** (bot registration + webhook route) and **57-4** (multi-channel config).

**Dependency chain:** Stories 57-1 through 57-4 (done) → **Story 57-5 (this story)** → Stories 57-6+ (more commands)

### What This Story Actually Does

**The problem:** The `/start` command already advertises "Use /status to check system status" but there's no `/status` handler registered. Users who try `/status` get no response.

**The solution:** Register a `/status` command handler on the grammY bot that:
1. Queries `SessionManager.list()` for session/agent data
2. Formats a MarkdownV2 response with emoji indicators
3. Replies within 3 seconds

**What this does NOT do:**
- Full health check (deferred to Story 57-8 `/health` command)
- Project-scoped queries (deferred to Story 57-10)
- Sprint story counts from BMAD tracker (deferred — using session-derived counts for V1)

### Architectural Pattern: StatusProvider Injection

The Telegram plugin (`@composio/ao-plugin-notifier-telegram`) should NOT import core services directly — that would create a circular dependency and break the plugin architecture. Instead, we use **dependency injection via a callback**:

```
┌──────────────────────────────┐     ┌──────────────────────────────────────┐
│ telegram-bot.ts              │     │ webhook/route.ts                     │
│                              │     │                                      │
│ registerStatusCommand(       │◄────│  createStatusProvider(services) {    │
│   statusProvider             │     │    return async () => {              │
│ )                            │     │      sessions = await sm.list()     │
│                              │     │      return { activeAgents: ... }   │
│ bot.command("status", ...)   │     │    }                                │
│   status = await provider()  │     │  }                                  │
│   reply(formatStatus(status))│     │                                      │
└──────────────────────────────┘     └──────────────────────────────────────┘
```

This follows the same pattern as `registerStartCommand()` — the bot class handles command registration and formatting, while the caller provides the data.

### Response Format (MarkdownV2)

```
\U0001F4CA *Agent Orchestrator Status*

\U0001F7E2 System: Healthy

\U0001F916 Agents: 3 active / 5 total
   \u2022 Working: 2
   \u2022 Blocked: 1
   \u2022 Idle: 0

\U0001F4CB Activity:
   \u2022 PRs open: 1
   \u2022 Needs review: 0

\U0001F4C4 Use /fleet for agent details\.
```

Empty state (no active sessions):
```
\U0001F4CA *Agent Orchestrator Status*

\U0001F7E2 System: Healthy

\U0001F916 No active sessions

\U0001F4C4 Use /sprint for sprint details\.
```

### File Structure

```
packages/plugins/notifier-telegram/src/
├── index.ts                    # UNCHANGED
├── telegram-bot.ts             # MODIFY: add SystemStatus, StatusProvider, registerStatusCommand(), formatStatusMessage()
├── notification-plugin.ts      # UNCHANGED
├── markdown-escape.ts          # UNCHANGED (used by formatStatusMessage)
├── send-helpers.ts             # UNCHANGED
├── event-formatter.ts          # UNCHANGED
├── preferences.ts              # UNCHANGED
└── __tests__/
    ├── telegram-bot.test.ts    # MODIFY: add registerStatusCommand and formatStatusMessage tests
    └── ...                     # UNCHANGED

packages/web/src/app/api/telegram/webhook/
└── route.ts                    # MODIFY: add createStatusProvider(), call registerStatusCommand()
```

### Integration with Existing Stories (MUST Follow)

These are verified patterns from Stories 57-1 through 57-4. The dev agent MUST follow these:

1. **Package import resolution**: `@composio/ao-core` only exports from top-level. No subpath imports.

2. **Mock pattern for tests**: Single top-level `vi.mock()` for each package. Do NOT use `importOriginal` with subpath type imports.

3. **`.js` extensions in imports**: Required for ESM. All local imports must end with `.js`.

4. **No circular imports**: Do NOT import from `index.js` in `telegram-bot.ts`. Import `escapeMarkdownV2` from `markdown-escape.js` only.

5. **Error handling in command handlers**: Wrap in try/catch with `ctx.reply(errorMsg)` on failure (established in `registerStartCommand`).

6. **MarkdownV2 escaping**: ALL dynamic content must be escaped via `escapeMarkdownV2()`.

7. **grammY command pattern**: Use `this.bot.command("status", async (ctx) => { ... })` — same pattern as `registerStartCommand()`.

### Session Status Derivation

For the V1 `/status` response, derive counts from `SessionManager.list()`:

| Status Label | Derivation |
|-------------|-----------|
| Active agents | `sessions.filter(s => s.activity !== "exited").length` |
| Working | `sessions.filter(s => s.status === "working").length` |
| Blocked | `sessions.filter(s => s.status === "blocked" \|\| s.activity === "blocked").length` |
| Idle | `sessions.filter(s => s.activity === "idle").length` |
| Open PRs | `sessions.filter(s => s.pr?.state === "open").length` |
| Needs review | `sessions.filter(s => s.pr && !s.pr.isDraft && s.pr.reviewDecision === "pending").length` |
| Total sessions | `sessions.length` |

Import `ACTIVITY_STATE` from `@composio/ao-core` for the `"exited"` constant.

### Testing Strategy

**Unit tests (telegram-bot.test.ts — additions):**
- `formatStatusMessage()` with healthy status + active sessions → correct emoji + counts
- `formatStatusMessage()` with degraded/unhealthy/unknown → correct emoji per status
- `formatStatusMessage()` with zero sessions → "No active sessions" text
- `formatStatusMessage()` escapes dynamic health message
- `registerStatusCommand()` calls provider and replies with formatted message
- `registerStatusCommand()` handles provider error → error reply, no throw
- `registerStatusCommand()` handles timeout → fallback reply
- `/status` command registered on bot instance (verify `bot.command` called with "status")

### NFRs
- **NFR-I2-1:** Command response within 3 seconds (enforced via `Promise.race` with timeout)
- **NFR-I2-2:** Bot handles concurrent commands from multiple users (grammY handles this natively)
- **NFR-I1-1:** Response formatted in MarkdownV2 for mobile readability

### Pre-existing Types (Use These, Do NOT Modify)
- `Session`, `SessionStatus`, `ActivityState`, `ACTIVITY_STATE` — from `@composio/ao-core`
- `TelegramBot`, `TelegramBotConfig` — from `./telegram-bot.js`
- `escapeMarkdownV2()` — from `./markdown-escape.js`
- `Bot` from `grammy` — grammY Bot class

### References
- [Source: epics-cycle-10.md#Story 57.5] — Story definition and acceptance criteria
- [Source: prd-cycle-10.md#FR-I2-1] — `/status` command: "Current system status"
- [Source: prd-cycle-10.md#FR-I2-3] — "Responses use rich formatting (markdown, emojis, inline keyboards)"
- [Source: prd-cycle-10.md#NFR-I2-1] — "Command response within 3 seconds"
- [Source: packages/plugins/notifier-telegram/src/telegram-bot.ts#registerStartCommand] — Existing command registration pattern
- [Source: packages/web/src/app/api/telegram/webhook/route.ts] — Webhook route where statusProvider will be wired
- [Source: packages/core/src/types.ts#SessionStatus] — 18 session lifecycle states
- [Source: packages/core/src/types.ts#ActivityState] — 6 activity states including "exited"
- [Source: packages/web/src/lib/services.ts#getServices] — Services singleton pattern
- [Source: packages/web/src/lib/serialize.ts#computeStats] — Existing stat computation pattern
- [Source: _bmad-output/implementation-artifacts/57-4-multi-channel-configuration.md] — Previous story with learnings

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- Test run: `pnpm test --filter @composio/ao-plugin-notifier-telegram` — 141 tests, 0 failures
- Typecheck: `pnpm --filter @composio/ao-plugin-notifier-telegram typecheck` — clean, 0 errors

### Completion Notes List

1. Added `SystemStatus` interface and `StatusProvider` type to `telegram-bot.ts` — exported via `index.ts`
2. Created exported `formatStatusMessage()` function in `telegram-bot.ts` — formats MarkdownV2 response with health emoji indicators (green/yellow/red/black), agent counts, and activity summary
3. Added `registerStatusCommand(statusProvider)` method to `TelegramBot` class — registers grammY `/status` command with 3-second timeout via `Promise.race()`, try/catch error handling with graceful fallback
4. Wired status provider in webhook route (`route.ts`) — `createStatusProvider(sessionManager)` derives counts from `sessionManager.list()` using `ACTIVITY_STATE` constants
5. Updated `index.ts` to re-export `formatStatusMessage`, `SystemStatus`, `StatusProvider`
6. Added 7 new tests: 6 `formatStatusMessage` tests (healthy/degraded/unhealthy/unknown/empty/escaping) + 1 `registerStatusCommand` test (command registration)
7. Total test count: 141 (was 134 from 57-4, now 141 with 7 new tests)
8. Zero regressions — all existing tests pass
9. PR property note: `PRInfo` type doesn't have `state` or `reviewDecision` — used `pr !== null` for "open PRs" count; `needsReview` hardcoded to 0. Deferred to Story 57-10.
10. Config cast: Used `as unknown as Record<string, unknown>` for the OrchestratorConfig → notifiers lookup to avoid TS type error
11. **Code review fixes (6 findings addressed):**
    - Reordered types section before constants to eliminate forward reference (Finding 4)
    - Added timestamp rendering in `formatStatusMessage()` with clock emoji (Finding 3)
    - Added `.catch(() => {})` to fallback reply in error handler to prevent double-throw on network failure (Finding 5)
    - Refactored `timeout()` to return `{ promise, clear }` with `finally { timer.clear() }` to prevent resource leak (Finding 6)
    - Changed label from "active" to "online" for non-exited session count, added doc comment on `activeAgents` field (Finding 7)
    - Added 6 new handler behavior tests: provider success, provider error, timeout, network failure on fallback, timestamp rendering, empty timestamp (Finding 8)
    - Removed duplicate unchecked task sections from story file (Findings 1 & 2)
12. Total test count after code review: 147 (was 141, +6 new handler behavior tests)

### Limitations (Deferred Items)
1. **Health check integration in /status**
   - Status: Deferred — Full HealthCheckService integration deferred to Story 57-8 (/health command)
   - Requires: HealthCheckService instantiation and component-level health data
   - Current: /status returns `healthStatus: "unknown"` for V1; only session-derived data

2. **Project-scoped /status command**
   - Status: Deferred — `/status project:my-app` syntax deferred to Story 57-10
   - Requires: Argument parsing in command handler, per-project session filtering
   - Current: /status returns cross-project overview only

3. **Sprint story counts from BMAD tracker**
   - Status: Deferred — Story counts (in-progress, blocked, done) from tracker deferred to a future enhancement
   - Requires: Tracker plugin access through registry, BMAD file parsing
   - Current: /status uses session-derived counts (working sessions = active stories, blocked sessions = blocked items)

### File List

**MODIFIED:**
- `packages/plugins/notifier-telegram/src/telegram-bot.ts` — Added `SystemStatus`, `StatusProvider`, `formatStatusMessage()`, `registerStatusCommand()`, `timeout()` with cancellation, timestamp rendering
- `packages/plugins/notifier-telegram/src/index.ts` — Added re-exports for `formatStatusMessage`, `SystemStatus`, `StatusProvider`
- `packages/plugins/notifier-telegram/src/__tests__/telegram-bot.test.ts` — 13 tests for formatStatusMessage + registerStatusCommand handler behavior
- `packages/web/src/app/api/telegram/webhook/route.ts` — Added `createStatusProvider()`, wired `registerStatusCommand()` in `getBot()`, clarified activeAgents comment
- `_bmad-output/implementation-artifacts/57-5-status-command.md` — Removed duplicate tasks, updated with code review fixes
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Updated 57-5 status: backlog → ready-for-dev → in-progress → review → done
