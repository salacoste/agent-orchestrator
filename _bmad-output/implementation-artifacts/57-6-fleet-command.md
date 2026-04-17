# Story 57.6: /fleet Command

Status: done

## Story

As a **project manager**,
I want **to send /fleet to see all active agents and their status**,
so that **I can monitor my agent pool from anywhere**.

## Acceptance Criteria

1. **Given** agents are running in the system
   **When** I send "/fleet"
   **Then** I receive a table showing each agent's name, status, current story, and project
   **And** agents with issues are highlighted
   **And** response is formatted for mobile readability
   **And** the response arrives within 3 seconds

2. **Given** the system has no active sessions
   **When** I send "/fleet"
   **Then** I receive "No active agents" message
   **And** the response is still formatted with emoji indicators

3. **Given** the fleet provider encounters an error
   **When** I send "/fleet"
   **Then** I receive a graceful error message
   **And** no unhandled exception crashes the bot

4. **Given** the fleet provider takes longer than 3 seconds
   **When** I send "/fleet"
   **Then** I receive a timeout fallback message with whatever partial data is available

5. **Given** agents with issues (blocked, errored)
   **When** I view the /fleet response
   **Then** those agents are highlighted with warning emoji indicators

## Tasks / Subtasks

- [x] Task 1: Define FleetAgent and FleetProvider types in telegram-bot.ts (AC: #1, #3)
  - [x] 1.1: Add `FleetAgent` interface with fields: `id`, `project`, `status`, `activity`, `story` (optional), `branch` (optional), `isAlert` (boolean)
  - [x] 1.2: Add `FleetProvider` type: `() => Promise<FleetAgent[]>`
  - [x] 1.3: Export both types from the module

- [x] Task 2: Add `registerFleetCommand()` to TelegramBot class (AC: #1, #2, #3, #4, #5)
  - [x] 2.1: Add `registerFleetCommand(fleetProvider: FleetProvider): void` method to `TelegramBot`
  - [x] 2.2: Register grammY `/fleet` command handler via `this.bot.command("fleet", async (ctx) => { ... })`
  - [x] 2.3: In handler: call `fleetProvider()` with 3-second timeout using cancellable `timeout()` helper (established pattern from Story 57-5)
  - [x] 2.4: Format response using `formatFleetMessage(agents: FleetAgent[]): string` helper — MarkdownV2 with per-agent status emoji
  - [x] 2.5: Use `escapeMarkdownV2()` for all dynamic content (agent IDs, project names, branch names, story titles)
  - [x] 2.6: Wrap in outer try/catch + inner try/finally (clear timer) — same pattern as `registerStatusCommand()`
  - [x] 2.7: Fallback reply with `.catch(() => {})` to prevent double-throw on network failure

- [x] Task 3: Create `formatFleetMessage()` helper in telegram-bot.ts (AC: #1, #2, #5)
  - [x] 3.1: Create exported `formatFleetMessage(agents: FleetAgent[]): string` function
  - [x] 3.2: Status emoji mapping: `blocked` → red circle, `exited` → black circle, `errored` → red circle, all others → green circle. Use `ACTIVITY_STATE` names.
  - [x] 3.3: When agents is empty, return "No active agents" message
  - [x] 3.4: Each agent gets one line: `{emoji} {id} | {project} | {status} | {story or "—"}`
  - [x] 3.5: Agents with `isAlert: true` get a warning emoji prefix
  - [x] 3.6: Escape all dynamic text via `escapeMarkdownV2()`
  - [x] 3.7: Return MarkdownV2 string with header and agent count

- [x] Task 4: Wire fleet provider in webhook route (AC: #1)
  - [x] 4.1: In `packages/web/src/app/api/telegram/webhook/route.ts`, import `FleetProvider` type
  - [x] 4.2: Create `createFleetProvider(sessionManager: SessionManager, config: OrchestratorConfig): FleetProvider` function that:
    - Calls `sessionManager.list()` to get all sessions
    - Filters to non-exited sessions (or includes all for full fleet view)
    - Maps each session to `FleetAgent` with: `id` from session.id, `project` from config.projects lookup using session.projectId, `status` from session.status, `activity` from session.activity, `story` from session.issueId, `branch` from session.branch, `isAlert` for blocked/errored sessions
    - Uses `resolveProject()` pattern from serialize.ts to get project display name
  - [x] 4.3: In `getBot()`, after `_bot.registerStatusCommand(...)`, add `_bot.registerFleetCommand(createFleetProvider(services.sessionManager, services.config))`

- [x] Task 5: Add tests (AC: all)
  - [x] 5.1: Test `formatFleetMessage()` returns MarkdownV2 with agent rows and status emojis
  - [x] 5.2: Test `formatFleetMessage()` shows "No active agents" for empty array
  - [x] 5.3: Test `formatFleetMessage()` highlights alert agents with warning emoji
  - [x] 5.4: Test `formatFleetMessage()` escapes dynamic content (agent IDs, project names)
  - [x] 5.5: Test `formatFleetMessage()` handles mix of statuses correctly (green/yellow/red/black)
  - [x] 5.6: Test `registerFleetCommand()` calls provider and replies with formatted message
  - [x] 5.7: Test `registerFleetCommand()` handles provider error gracefully
  - [x] 5.8: Test `registerFleetCommand()` handles timeout gracefully
  - [x] 5.9: Test `/fleet` command is registered on the grammY bot instance
  - [x] 5.10: Run full test suite — 0 regressions (161 tests pass)

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
1. **Project-scoped /fleet command**
   - Status: Deferred — `/fleet project:my-app` syntax deferred to Story 57-10
   - Requires: Argument parsing in command handler, per-project session filtering
   - Current: /fleet returns all agents across all projects

2. **Pagination for long fleet lists**
   - Status: Deferred — Pagination for 10+ agents deferred to a future enhancement
   - Requires: Inline keyboard pagination with callback_data
   - Current: All agents shown in single message (Telegram limit: 4096 chars)
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
- `TelegramBot.bot.command(name, handler)` — EXISTING: grammY Bot command registration (pattern established in `registerStartCommand()` and `registerStatusCommand()`)
- `SessionManager.list(): Promise<Session[]>` — EXISTING: returns all sessions (from `@composio/ao-core`)
- `Session.status` — EXISTING: `SessionStatus` union type with 18 states
- `Session.activity` — EXISTING: `ActivityState` with 6 states
- `Session.projectId` — EXISTING: string project identifier
- `Session.issueId` — EXISTING: string issue/story identifier
- `Session.branch` — EXISTING: string branch name
- `OrchestratorConfig.projects` — EXISTING: Record<string, ProjectConfig> with `name`, `sessionPrefix`
- `ctx.reply(text, options)` — EXISTING: grammY context reply method

**Feature Flags:**
- None required — all interfaces exist.

## Dependency Review

No new dependencies. This story uses existing packages only:
- `@composio/ao-core` (workspace dependency — SessionManager, Session types, ACTIVITY_STATE)
- `grammy` (already reviewed in Story 57-1)

## Dev Notes

### Architecture Context

This is **Story 6 of 15** in **Epic 57: Telegram Bot Integration**. It depends on **Stories 57-1** (bot registration + webhook route) through **57-5** (/status command).

**Dependency chain:** Stories 57-1 through 57-5 (done) → **Story 57-6 (this story)** → Stories 57-7+ (more commands)

### What This Story Actually Does

**The problem:** Users need to see a detailed per-agent breakdown of their fleet from Telegram. The `/status` command (Story 57-5) gives a summary count, but `/fleet` shows individual agents with their status, story, and project.

**The solution:** Register a `/fleet` command handler on the grammY bot that:
1. Queries `SessionManager.list()` for all sessions
2. Maps each session to a `FleetAgent` with project name resolution
3. Formats a MarkdownV2 table response with per-agent status emojis
4. Highlights blocked/errored agents
5. Replies within 3 seconds

**What this does NOT do:**
- Project-scoped filtering (`/fleet project:my-app`) — deferred to Story 57-10
- Pagination for long lists — deferred (single message for V1)
- Agent actions from the fleet view (kill, restart) — deferred to Story 57-11 (inline actions)

### Architectural Pattern: FleetProvider Injection

Follows the same dependency injection pattern as `StatusProvider` from Story 57-5:

```
┌──────────────────────────────┐     ┌──────────────────────────────────────┐
│ telegram-bot.ts              │     │ webhook/route.ts                     │
│                              │     │                                      │
│ registerFleetCommand(        │◄────│  createFleetProvider(sm, config) {   │
│   fleetProvider              │     │    return async () => {              │
│ )                            │     │      sessions = await sm.list()      │
│                              │     │      return sessions.map(toAgent)    │
│ bot.command("fleet", ...)    │     │    }                                │
│   agents = await provider()  │     │  }                                  │
│   reply(formatFleet(agents)) │     │                                      │
└──────────────────────────────┘     └──────────────────────────────────────┘
```

### Response Format (MarkdownV2)

Normal fleet (3 agents, 1 blocked):
```
🤖 *Agent Fleet* (3 agents)

🟢 app\-1 | my\-project | working | AO\-42
🟢 app\-2 | api\-service | working | AO\-43
🔴 api\-1 | api\-service | blocked | AO\-44

📊 2 healthy, 1 alert
Use /status for system summary\.
```

Empty fleet:
```
🤖 *Agent Fleet*

No active agents\.

Use /status for system summary\.
```

Alert-only fleet (all agents have issues):
```
🤖 *Agent Fleet* (2 agents)

⚠️ 🔴 app\-1 | my\-project | blocked | AO\-42
⚠️ 🔴 api\-1 | api\-service | errored | —

📊 0 healthy, 2 alerts
```

### Session → FleetAgent Mapping

| FleetAgent Field | Session Source | Notes |
|-----------------|---------------|-------|
| `id` | `session.id` | Agent identifier |
| `project` | `config.projects[session.projectId]?.name ?? session.projectId` | Resolve display name from config |
| `status` | `session.status` | SessionStatus (18 states) |
| `activity` | `session.activity ?? "unknown"` | ActivityState (6 states) |
| `story` | `session.issueId` | Issue/story ID or null |
| `branch` | `session.branch` | Branch name or null |
| `isAlert` | `activity === "blocked" \|\| status includes "error"/"fail"` | Highlight flag |

### Status Emoji Mapping

| Condition | Emoji | Label |
|-----------|-------|-------|
| `activity === "exited"` | ⚫ (black circle) | exited |
| `activity === "blocked"` | 🔴 (red circle) | blocked |
| `status` includes "error" or "fail" | 🔴 (red circle) | errored |
| `activity === "idle"` | 🟡 (yellow circle) | idle |
| `activity === "waiting_input"` | 🟡 (yellow circle) | waiting |
| All others (active, working, etc.) | 🟢 (green circle) | active |

### File Structure

```
packages/plugins/notifier-telegram/src/
├── index.ts                    # MODIFY: add re-exports for FleetAgent, FleetProvider, formatFleetMessage
├── telegram-bot.ts             # MODIFY: add FleetAgent, FleetProvider, formatFleetMessage(), registerFleetCommand()
├── notification-plugin.ts      # UNCHANGED
├── markdown-escape.ts          # UNCHANGED (used by formatFleetMessage)
├── send-helpers.ts             # UNCHANGED
├── event-formatter.ts          # UNCHANGED
├── preferences.ts              # UNCHANGED
└── __tests__/
    ├── telegram-bot.test.ts    # MODIFY: add registerFleetCommand and formatFleetMessage tests
    └── ...                     # UNCHANGED

packages/web/src/app/api/telegram/webhook/
└── route.ts                    # MODIFY: add createFleetProvider(), call registerFleetCommand()
```

### Integration with Existing Stories (MUST Follow)

These are verified patterns from Stories 57-1 through 57-5. The dev agent MUST follow these:

1. **Package import resolution**: `@composio/ao-core` only exports from top-level. No subpath imports.

2. **Mock pattern for tests**: Single top-level `vi.mock()` for each package. Do NOT use `importOriginal` with subpath type imports.

3. **`.js` extensions in imports**: Required for ESM. All local imports must end with `.js`.

4. **No circular imports**: Do NOT import from `index.js` in `telegram-bot.ts`. Import `escapeMarkdownV2` from `markdown-escape.js` only.

5. **Error handling in command handlers**: Wrap in outer try/catch + inner try/finally (clear timer). Fallback reply with `.catch(() => {})`.

6. **MarkdownV2 escaping**: ALL dynamic content must be escaped via `escapeMarkdownV2()`. This includes agent IDs, project names, branch names, and story IDs.

7. **grammY command pattern**: Use `this.bot.command("fleet", async (ctx) => { ... })` — same pattern as `registerStatusCommand()`.

8. **Timeout pattern**: Use `timeout()` helper that returns `{ promise, clear }`. Always clear in finally block.

9. **Type ordering**: Types (FleetAgent, FleetProvider) come BEFORE the constants and functions that reference them.

### Project Name Resolution

The webhook route needs to resolve `Session.projectId` to a display name. The pattern exists in `serialize.ts`:

```typescript
// From serialize.ts:
export function resolveProject(
  session: DashboardSession,
  projects: Record<string, ProjectConfig>,
): string {
  const cfg = projects[session.projectId];
  return cfg?.name ?? session.projectId;
}
```

For the fleet provider, do the same inline — look up `services.config.projects[session.projectId]?.name ?? session.projectId`. `OrchestratorConfig.projects` is `Record<string, ProjectConfig>`.

### Testing Strategy

**Unit tests (telegram-bot.test.ts — additions):**
- `formatFleetMessage()` with multiple agents → correct emoji per status, agent rows
- `formatFleetMessage()` with empty array → "No active agents"
- `formatFleetMessage()` with alert agents → warning emoji prefix
- `formatFleetMessage()` escapes dynamic content (agent IDs with dashes, project names)
- `formatFleetMessage()` with mixed statuses → correct emoji per agent
- `registerFleetCommand()` calls provider and replies with formatted message
- `registerFleetCommand()` handles provider error → fallback reply, no throw
- `registerFleetCommand()` handles timeout → fallback reply
- `/fleet` command registered on bot instance

**Handler test pattern** (established in Story 57-5 code review):
```typescript
function getFleetHandler(): (...args: Array<unknown>) => Promise<void> {
  const call = mockBotCommand.mock.calls.find((c) => c[0] === "fleet");
  if (!call) throw new Error("No 'fleet' command registered");
  return call[1] as (...args: Array<unknown>) => Promise<void>;
}
```

### NFRs
- **NFR-I2-1:** Command response within 3 seconds (enforced via `Promise.race` with timeout)
- **NFR-I2-2:** Bot handles concurrent commands from multiple users (grammY handles this natively)
- **NFR-I1-1:** Response formatted in MarkdownV2 for mobile readability

### Pre-existing Types (Use These, Do NOT Modify)
- `Session`, `SessionStatus`, `ActivityState`, `ACTIVITY_STATE` — from `@composio/ao-core`
- `OrchestratorConfig`, `ProjectConfig` — from `@composio/ao-core`
- `TelegramBot`, `TelegramBotConfig` — from `./telegram-bot.js`
- `escapeMarkdownV2()` — from `./markdown-escape.js`
- `timeout()` — from `./telegram-bot.js` (internal helper, already available)
- `Bot` from `grammy` — grammY Bot class

### References
- [Source: epics-cycle-10.md#Story 57.6] — Story definition and acceptance criteria
- [Source: prd-cycle-10.md#FR-I2-2] — `/fleet` command: "Users can send /fleet command to view active agents"
- [Source: prd-cycle-10.md#FR-I2-5] — "Command responses include formatted tables and status indicators"
- [Source: prd-cycle-10.md#NFR-I2-1] — "Command response within 3 seconds"
- [Source: packages/plugins/notifier-telegram/src/telegram-bot.ts#registerStatusCommand] — Command registration pattern with timeout
- [Source: packages/web/src/app/api/telegram/webhook/route.ts] — Webhook route where fleetProvider will be wired
- [Source: packages/core/src/types.ts#Session] — Session interface with id, projectId, status, activity, branch, issueId
- [Source: packages/core/src/types.ts#ActivityState] — 6 activity states
- [Source: packages/core/src/types.ts#ProjectConfig] — Project config with name, sessionPrefix
- [Source: packages/web/src/lib/serialize.ts#resolveProject] — Project name resolution pattern
- [Source: packages/web/src/lib/services.ts#Services] — Services singleton with config, sessionManager
- [Source: _bmad-output/implementation-artifacts/57-5-status-command.md] — Previous story with StatusProvider pattern

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- Full test suite: 161 tests pass (14 new for Story 57.6)
- Typecheck clean for both notifier-telegram plugin and web package

### Code Review Notes (Story 57-6 review)
1. **Fixed**: `timeout()` error message changed from "Status provider" to generic "Provider" since shared by /status and /fleet
2. **Fixed**: `isAlert` in `createFleetProvider()` changed from fragile `status.includes("error")/includes("fail")` to explicit set: `["errored", "ci_failed", "stuck"]`
3. **Fixed**: Added `"stuck"` SessionStatus to alert detection (semantically an alert state)
4. **Fixed**: Added test for `"ready"` activity state emoji (green circle fallback)
5. **No change**: `FleetAgent.status` field exists in type for future use (inline actions in Story 57-11)
6. Test count: 161 → 162 (+1 ready activity test)

### Completion Notes List
1. All 6 tasks completed, all 5 acceptance criteria met
2. FleetAgent/FleetProvider types follow StatusProvider injection pattern
3. formatFleetMessage() handles empty fleet, alert highlighting, status emojis, MarkdownV2 escaping
4. createFleetProvider() wired in webhook route with project name resolution
5. 14 new unit tests covering: formatter (8 tests), command handler (5 tests), command registration (1 test)
6. No new dependencies — uses existing ACTIVITY_STATE, SessionManager, OrchestratorConfig
7. Follows all established patterns from Stories 57-1 through 57-5

### Change Summary
- `packages/plugins/notifier-telegram/src/telegram-bot.ts` — Added FleetAgent, FleetProvider types, STATUS_EMOJI map, agentEmoji(), formatFleetMessage(), registerFleetCommand()
- `packages/plugins/notifier-telegram/src/index.ts` — Added re-exports for FleetAgent, FleetProvider, formatFleetMessage
- `packages/plugins/notifier-telegram/src/__tests__/telegram-bot.test.ts` — Added 14 tests (8 formatFleetMessage + 5 registerFleetCommand handler + 1 command registration)
- `packages/web/src/app/api/telegram/webhook/route.ts` — Added createFleetProvider(), wired registerFleetCommand() in getBot()

### File List
- `packages/plugins/notifier-telegram/src/telegram-bot.ts` (MODIFIED)
- `packages/plugins/notifier-telegram/src/index.ts` (MODIFIED)
- `packages/plugins/notifier-telegram/src/__tests__/telegram-bot.test.ts` (MODIFIED)
- `packages/web/src/app/api/telegram/webhook/route.ts` (MODIFIED)
