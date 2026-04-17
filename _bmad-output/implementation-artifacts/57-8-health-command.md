# Story 57.8: /health Command

Status: review

## Story

As a **project manager**,
I want **to send /health to see system health check results**,
so that **I can diagnose issues remotely from Telegram**.

## Acceptance Criteria

1. **Given** the system has run health checks
   **When** I send "/health"
   **Then** I see overall status (healthy/degraded/unhealthy) with emoji indicator
   **And** each component status is listed (name, status, latency, message)
   **And** failing components show error details
   **And** I see last check timestamp
   **And** the response arrives within 3 seconds

2. **Given** the system is fully healthy
   **When** I send "/health"
   **Then** I see a compact "All systems operational" message
   **And** each component shows green emoji with latency

3. **Given** one or more components are degraded/unhealthy
   **When** I send "/health"
   **Then** degraded components show yellow emoji with warning message
   **And** unhealthy components show red emoji with error details
   **And** overall status reflects the worst component status

4. **Given** the health provider encounters an error
   **When** I send "/health"
   **Then** I receive a graceful error message
   **And** no unhandled exception crashes the bot

5. **Given** the health provider takes longer than 3 seconds
   **When** I send "/health"
   **Then** I receive a timeout fallback message

6. **Given** rate limiting is active on the health check service
   **When** I send "/health"
   **Then** I see the last cached result with a "cached" indicator
   **And** the response still arrives within 3 seconds

## Tasks / Subtasks

- [x] Task 1: Define HealthCheckEntry and HealthProvider types in telegram-bot.ts (AC: #1, #4)
  - [x] 1.1: Add `HealthCheckEntry` interface with fields: `component` (string), `status` (`"healthy" | "degraded" | "unhealthy"`), `latencyMs` (optional number), `message` (string), `details` (optional string[])
  - [x] 1.2: Add `HealthCheckResult` interface with fields: `overall` (`"healthy" | "degraded" | "unhealthy"`), `components` (HealthCheckEntry[]), `timestamp` (string), `exitCode` (number)
  - [x] 1.3: Add `HealthProvider` type: `() => Promise<HealthCheckResult>`
  - [x] 1.4: Export both types from the module

- [x] Task 2: Add `registerHealthCommand()` to TelegramBot class (AC: #1, #4, #5)
  - [x] 2.1: Add `registerHealthCommand(healthProvider: HealthProvider): void` method to `TelegramBot`
  - [x] 2.2: Register grammY `/health` command handler via `this.bot.command("health", async (ctx) => { ... })`
  - [x] 2.3: Call `healthProvider()` with 3-second timeout using cancellable `timeout()` helper (established pattern)
  - [x] 2.4: Format response using `formatHealthMessage(result: HealthCheckResult): string` helper — MarkdownV2 with emoji indicators
  - [x] 2.5: Use `escapeMarkdownV2()` for all dynamic content (component names, messages, details)
  - [x] 2.6: Wrap in outer try/catch + inner try/finally (clear timer) — same pattern as all other commands
  - [x] 2.7: Fallback reply with `.catch(() => {})` to prevent double-throw on network failure

- [x] Task 3: Create `formatHealthMessage()` helper in telegram-bot.ts (AC: #1, #2, #3, #6)
  - [x] 3.1: Create exported `formatHealthMessage(result: HealthCheckResult): string` function
  - [x] 3.2: Status emoji mapping: `healthy` → green circle, `degraded` → yellow circle, `unhealthy` → red circle
  - [x] 3.3: Component status emoji: same mapping as overall status
  - [x] 3.4: When all components healthy → compact "All systems operational" mode with latency summary
  - [x] 3.5: When any degraded/unhealthy → full detail mode showing each component with status, message, details
  - [x] 3.6: Escape all dynamic text via `escapeMarkdownV2()`
  - [x] 3.7: Return MarkdownV2 string with header, component list, and footer with timestamp

- [x] Task 4: Wire health provider in webhook route (AC: #1, #2, #3, #6)
  - [x] 4.1: In `packages/web/src/app/api/telegram/webhook/route.ts`, import `HealthProvider` and `HealthCheckResult` types
  - [x] 4.2: Create `createHealthProvider(config): HealthProvider` function that:
    - Creates a `HealthCheckService` via `createHealthCheckService(healthConfig)` from `@composio/ao-core`
    - If `config.health` exists, passes thresholds and interval settings
    - Calls `service.check()` and maps `HealthCheckResult` to the Telegram `HealthCheckResult` type
    - Handles rate limiting: if rate-limited, returns cached result if available
    - Returns structured health data with all component statuses
  - [x] 4.3: In `getBot()`, after `_bot.registerSprintCommand(...)`, add `_bot.registerHealthCommand(createHealthProvider(services.config))`

- [x] Task 5: Add tests (AC: all)
  - [x] 5.1: Test `formatHealthMessage()` returns MarkdownV2 with overall status and component rows
  - [x] 5.2: Test `formatHealthMessage()` shows "All systems operational" when fully healthy
  - [x] 5.3: Test `formatHealthMessage()` shows full detail mode with warnings when degraded
  - [x] 5.4: Test `formatHealthMessage()` shows error details for unhealthy components
  - [x] 5.5: Test `formatHealthMessage()` escapes dynamic content (component names, messages)
  - [x] 5.6: Test `formatHealthMessage()` includes timestamp
  - [x] 5.7: Test `formatHealthMessage()` handles empty components array gracefully
  - [x] 5.8: Test `registerHealthCommand()` calls provider and replies with formatted message
  - [x] 5.9: Test `registerHealthCommand()` handles provider error gracefully
  - [x] 5.10: Test `registerHealthCommand()` handles timeout gracefully
  - [x] 5.11: Test `/health` command is registered on the grammY bot instance
  - [x] 5.12: Test fallback reply catch prevents double-throw on network failure
  - [x] 5.13: Run full test suite — 0 regressions

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
1. **Component drill-down**
   - Status: Deferred — Per-component detail views require callback_data handling (Story 57-11)
   - Requires: Inline keyboard with callback_data for component tap interactions
   - Current: Shows all components in single message

2. **Historical health trends**
   - Status: Deferred — Trend display requires historical health data storage
   - Requires: Time-series storage for health check results
   - Current: Shows point-in-time health snapshot only
```

**Task Completion Validation Checklist:**
- [x] All tasks marked [x] are 100% complete (no partial work)
- [x] All tests have real assertions (no expect(true).toBe(true))
- [x] No hidden TODOs/FIXMEs in completed tasks
- [x] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [x] File List includes all changed files

## Interface Validation

- [x] Validate all interface methods used in this story
- [x] Document any missing capabilities as feature flags
- [x] Update sprint-status.yaml with discovered limitations

**Methods Used:**
- `TelegramBot.bot.command(name, handler)` — EXISTING: grammY Bot command registration (pattern established in Stories 57-1 through 57-7)
- `HealthCheckService.check(): Promise<HealthCheckResult>` — EXISTING: from `@composio/ao-core` (fully implemented in `packages/core/src/health-check.ts`)
- `HealthCheckResult.overall` — EXISTING: `"healthy" | "degraded" | "unhealthy"`
- `HealthCheckResult.components` — EXISTING: `ComponentHealth[]` with component, status, latencyMs, message, details, timestamp
- `HealthCheckResult.exitCode` — EXISTING: 0 (healthy) or 1 (unhealthy)
- `HealthCheckResult.rateLimited` — EXISTING: boolean flag for rate-limited results
- `createHealthCheckService(config)` — EXISTING: factory function from `@composio/ao-core`
- `OrchestratorConfig.health` — EXISTING: `HealthYamlConfig` with checkIntervalMs, alertOnTransition, thresholds
- `ctx.reply(text, options)` — EXISTING: grammY context reply method
- `escapeMarkdownV2()` — EXISTING: from `./markdown-escape.js`

**Feature Flags:**
- None required — all interfaces exist. ✓ Validated

## Dependency Review

No new dependencies. This story uses existing packages only:
- `@composio/ao-core` (workspace dependency — HealthCheckService, HealthCheckResult, ComponentHealth, createHealthCheckService, HealthCheckConfig, HealthYamlConfig)
- `grammy` (already reviewed in Story 57-1)

## Dev Notes

### Architecture Context

This is **Story 8 of 15** in **Epic 57: Telegram Bot Integration**. It depends on **Stories 57-1** (bot registration + webhook route) through **57-7** (/sprint command).

**Dependency chain:** Stories 57-1 through 57-7 (done) → **Story 57-8 (this story)** → Stories 57-9+ (more commands)

### What This Story Actually Does

**The problem:** Users need to diagnose system issues remotely without opening the web dashboard. The `/status` command (Story 57-5) gives agent/session counts, `/fleet` (Story 57-6) shows per-agent status, and `/sprint` (Story 57-7) shows sprint progress — but none show infrastructure component health (event bus, tracker, DLQ, etc.).

**The solution:** Register a `/health` command handler on the grammY bot that:
1. Creates a HealthCheckService using the existing `createHealthCheckService()` factory
2. Calls `service.check()` to get structured health data for 8 component types
3. Formats the result as a MarkdownV2 message with emoji indicators
4. Shows compact view when all healthy, detailed view when degraded/unhealthy
5. Replies within 3 seconds

**What this does NOT do:**
- Component drill-down (requires callback_data — deferred to Story 57-11)
- Historical health trends (requires time-series storage)
- Manual health check triggering via Telegram (uses existing service)

### Architectural Pattern: HealthProvider Injection

Follows the same dependency injection pattern as StatusProvider, FleetProvider, and SprintProvider:

```
┌──────────────────────────────┐     ┌──────────────────────────────────────┐
│ telegram-bot.ts              │     │ webhook/route.ts                     │
│                              │     │                                      │
│ registerHealthCommand(       │◄────│  createHealthProvider(config) {      │
│   healthProvider             │     │    return async () => {              │
│ )                            │     │      service = createHealthCheckSvc()│
│                              │     │      result = await service.check() │
│ bot.command("health", ...)   │     │      return mapResult(result)       │
│   result = await provider()  │     │    }                                │
│   reply(formatHealth(...))   │     │  }                                  │
└──────────────────────────────┘     └──────────────────────────────────────┘
```

### Response Format (MarkdownV2)

All healthy (compact mode):
```
🏥 *System Health*

🟢 All systems operational

Event Bus: ✅ 12ms
BMAD Tracker: ✅ 5ms
Local State: ✅ 2ms
Agent Registry: ✅ 0ms
Data Directory: ✅ 1ms

🕐 2026\-04\-09T12:00:00\.000Z
Use /status for session summary\.
```

Degraded (full detail mode):
```
🏥 *System Health*

🟡 Status: Degraded

🟢 Event Bus: ✅ 12ms
   Healthy
🟡 BMAD Tracker: ⚠️ 450ms
   High latency — sync delayed
🟢 Local State: ✅ 2ms
   Healthy
🟢 Agent Registry: ✅ 0ms
   Healthy

⚠️ 1 degraded component
Use /status for session summary\.
```

Unhealthy (full detail mode with error details):
```
🏥 *System Health*

🔴 Status: Unhealthy

🟢 Event Bus: ✅ 12ms
   Healthy
🔴 BMAD Tracker: ❌ 2100ms
   Connection refused
   Details: ECONNREFUSED 127\.0\.0\.1:3000
🟢 Local State: ✅ 2ms

🚨 1 unhealthy component
Use /status for session summary\.
```

Provider error / empty:
```
🏥 *System Health*

⚠️ Health check unavailable
Could not run health diagnostics\.
```

### Health Check → HealthProvider Mapping

The health provider wraps the existing `createHealthCheckService()`:

| Telegram Type | Source | Notes |
|--------------|--------|-------|
| `HealthCheckResult.overall` | `result.overall` | `"healthy" \| "degraded" \| "unhealthy"` |
| `HealthCheckResult.exitCode` | `result.exitCode` | 0 or 1 |
| `HealthCheckResult.timestamp` | `result.timestamp.toISOString()` | ISO 8601 |
| `HealthCheckEntry.component` | `c.component` | Component name from core service |
| `HealthCheckEntry.status` | `c.status` | Per-component status |
| `HealthCheckEntry.latencyMs` | `c.latencyMs` | Check latency |
| `HealthCheckEntry.message` | `c.message` | Human-readable status |
| `HealthCheckEntry.details` | `c.details` | Error details array |

### Key Design Decision: Compact vs. Full Detail

When ALL components are healthy, the response uses a **compact** format — one line per component showing only status emoji and latency. This keeps the Telegram message short and scannable for the common case.

When ANY component is degraded or unhealthy, the response switches to **full detail** mode — each component shows its message and error details, plus a summary footer.

### File Structure

```
packages/plugins/notifier-telegram/src/
├── index.ts                    # MODIFY: add re-exports for HealthCheckEntry, HealthCheckResult, HealthProvider, formatHealthMessage
├── telegram-bot.ts             # MODIFY: add HealthCheckEntry, HealthCheckResult, HealthProvider types, formatHealthMessage(), registerHealthCommand()
├── notification-plugin.ts      # UNCHANGED
├── markdown-escape.ts          # UNCHANGED (used by formatHealthMessage)
├── send-helpers.ts             # UNCHANGED
├── event-formatter.ts          # UNCHANGED
├── preferences.ts              # UNCHANGED
└── __tests__/
    ├── telegram-bot.test.ts    # MODIFY: add registerHealthCommand and formatHealthMessage tests
    └── ...                     # UNCHANGED

packages/web/src/app/api/telegram/webhook/
└── route.ts                    # MODIFY: add createHealthProvider(), call registerHealthCommand()
```

### Integration with Existing Stories (MUST Follow)

These are verified patterns from Stories 57-1 through 57-7. The dev agent MUST follow these:

1. **Package import resolution**: `@composio/ao-core` only exports from top-level. No subpath imports.

2. **Mock pattern for tests**: Single top-level `vi.mock()` for each package. Do NOT use `importOriginal` with subpath type imports.

3. **`.js` extensions in imports**: Required for ESM. All local imports must end with `.js`.

4. **No circular imports**: Do NOT import from `index.js` in `telegram-bot.ts`. Import `escapeMarkdownV2` from `markdown-escape.js` only.

5. **Error handling in command handlers**: Wrap in outer try/catch + inner try/finally (clear timer). Fallback reply with `.catch(() => {})`.

6. **MarkdownV2 escaping**: ALL dynamic content must be escaped via `escapeMarkdownV2()`. This includes component names, messages, error details.

7. **grammY command pattern**: Use `this.bot.command("health", async (ctx) => { ... })` — same pattern as all previous commands.

8. **Timeout pattern**: Use `timeout()` helper that returns `{ promise, clear }`. Always clear in finally block.

9. **Type ordering**: Types (HealthCheckEntry, HealthCheckResult, HealthProvider) come BEFORE the constants and functions that reference them.

10. **No command arguments**: Unlike `/sprint`, `/health` takes no arguments — it always shows full system health.

### Testing Strategy

**Unit tests (telegram-bot.test.ts — additions):**
- `formatHealthMessage()` with all healthy → compact mode, green emojis, latencies
- `formatHealthMessage()` with degraded → full detail mode, yellow emoji, messages
- `formatHealthMessage()` with unhealthy → full detail mode, red emoji, error details
- `formatHealthMessage()` with empty components → "Health check unavailable"
- `formatHealthMessage()` escapes dynamic content (component names with dots/dashes, messages with brackets)
- `formatHealthMessage()` includes timestamp
- `formatHealthMessage()` with mixed statuses (some healthy, some degraded) → correct emoji per component
- `registerHealthCommand()` calls provider and replies with formatted message
- `registerHealthCommand()` handles provider error → fallback reply, no throw
- `registerHealthCommand()` handles timeout → fallback reply
- `/health` command registered on bot instance
- Fallback reply catch prevents double-throw on network failure

**Handler test pattern** (established in Stories 57-5 through 57-7):
```typescript
function getHealthHandler(): (...args: Array<unknown>) => Promise<void> {
  const call = mockBotCommand.mock.calls.find((c) => c[0] === "health");
  if (!call) throw new Error("No 'health' command registered");
  return call[1] as (...args: Array<unknown>) => Promise<void>;
}
```

### NFRs
- **NFR-I2-1:** Command response within 3 seconds (enforced via `Promise.race` with timeout)
- **NFR-I2-2:** Bot handles concurrent commands from multiple users (grammY handles this natively)
- **NFR-I1-1:** Response formatted in MarkdownV2 for mobile readability

### Pre-existing Types (Use These, Do NOT Modify)
- `HealthCheckService`, `HealthCheckConfig`, `HealthCheckResult`, `ComponentHealth`, `HealthStatus` — from `@composio/ao-core`
- `createHealthCheckService` — factory function from `@composio/ao-core`
- `OrchestratorConfig`, `HealthYamlConfig` — from `@composio/ao-core`
- `TelegramBot`, `TelegramBotConfig` — from `./telegram-bot.js`
- `escapeMarkdownV2()` — from `./markdown-escape.js`
- `timeout()` — from `./telegram-bot.js` (internal helper, already available)
- `Bot` from `grammy` — grammY Bot class

### References
- [Source: epics-cycle-10.md#Story 57.8] — Story definition and acceptance criteria
- [Source: prd-cycle-10.md#FR-I2-1] — `/health` command: "Health check results"
- [Source: prd-cycle-10.md#FR-I2-3] — "Responses use rich formatting (markdown, emojis, inline keyboards)"
- [Source: prd-cycle-10.md#NFR-I2-1] — "Command response within 3 seconds"
- [Source: packages/core/src/health-check.ts] — HealthCheckServiceImpl with 8 component checks, rate limiting, watch mode
- [Source: packages/core/src/types.ts#HealthCheckResult] — HealthCheckResult interface with overall, components, timestamp, exitCode
- [Source: packages/core/src/types.ts#ComponentHealth] — ComponentHealth interface with component, status, latencyMs, message, details
- [Source: packages/core/src/types.ts#HealthYamlConfig] — YAML config for health thresholds
- [Source: packages/core/src/index.ts] — Re-exports createHealthCheckService and all health types
- [Source: packages/web/src/app/api/health/route.ts] — Existing /api/health endpoint (reference for response shape)
- [Source: packages/plugins/notifier-telegram/src/telegram-bot.ts#registerSprintCommand] — Most recent command pattern (closest analog)
- [Source: _bmad-output/implementation-artifacts/57-7-sprint-command.md] — Previous story with SprintProvider pattern

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None.

### Completion Notes List

1. All 6 tasks completed. 194 tests pass (16 new tests for Story 57.8).
2. HealthCheckEntry/HealthCheckResult/HealthProvider types defined and exported following SprintProvider pattern.
3. formatHealthMessage() supports two modes: compact (all healthy) and full detail (any degraded/unhealthy).
4. Compact mode shows component name + checkmark + latency per line.
5. Full detail mode shows per-component emoji, icon, latency, message, and details array.
6. Summary footer counts degraded and unhealthy components separately.
7. registerHealthCommand() follows identical timeout + fallback pattern as status/fleet/sprint commands.
8. createHealthProvider() wraps existing createHealthCheckService() from @composio/ao-core with health config from YAML.
9. **Code review fix (AC6):** Added `rateLimited` field to Telegram HealthCheckResult, cached HealthCheckService instance in provider, and added "Cached result (rate limited)" indicator in formatHealthMessage(). 2 new tests added.

### Limitations (Deferred Items)

1. **Component drill-down**
   - Status: Deferred — Per-component detail views require callback_data handling (Story 57-11)
   - Requires: Inline keyboard with callback_data for component tap interactions
   - Current: Shows all components in single message

2. **Historical health trends**
   - Status: Deferred — Trend display requires historical health data storage
   - Requires: Time-series storage for health check results
   - Current: Shows point-in-time health snapshot only

### File List

- `packages/plugins/notifier-telegram/src/telegram-bot.ts` — MODIFIED: Added HealthCheckEntry, HealthCheckResult, HealthProvider types, COMPONENT_STATUS_EMOJI, COMPONENT_STATUS_ICON maps, formatHealthMessage(), registerHealthCommand()
- `packages/plugins/notifier-telegram/src/index.ts` — MODIFIED: Added re-exports for formatHealthMessage, HealthCheckEntry, HealthCheckResult, HealthProvider
- `packages/web/src/app/api/telegram/webhook/route.ts` — MODIFIED: Added createHealthProvider(), wired registerHealthCommand() in getBot()
- `packages/plugins/notifier-telegram/src/__tests__/telegram-bot.test.ts` — MODIFIED: Added 14 tests for formatHealthMessage() and registerHealthCommand()

## Change Log

### Implementation (2026-04-09)
- Initial implementation of /health command (Story 57.8)
- 14 new tests, 192 total tests passing, 0 regressions

### Code Review (2026-04-09)
- **F1 (AC6 fix):** Added `rateLimited` field to Telegram HealthCheckResult type
- **F4 (Service caching):** Moved createHealthCheckService() call outside the returned closure so the service instance persists across calls, enabling core rate limiting/caching
- **formatHealthMessage() update:** Added "💾 Cached result (rate limited)" indicator line
- **2 new tests:** Rate-limited indicator shown/hidden
- 194 total tests passing, 0 regressions
