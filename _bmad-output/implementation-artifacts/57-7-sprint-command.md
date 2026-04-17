# Story 57.7: /sprint Command

Status: done

## Story

As a **project manager**,
I want **to send /sprint to see sprint progress summary**,
so that **I can track sprint health without opening the dashboard**.

## Acceptance Criteria

1. **Given** an active sprint exists for a project
   **When** I send "/sprint my-project"
   **Then** I see sprint name, project name, progress bar, stories by status, and blockers
   **And** the response includes velocity trend indicator
   **And** the response arrives within 3 seconds

2. **Given** I send "/sprint" without a project name
   **When** there are active sprints across multiple projects
   **Then** I see a summary for all active sprints (one line per project)
   **And** each entry shows project name, progress percent, and health status

3. **Given** no active sprints exist
   **When** I send "/sprint"
   **Then** I receive "No active sprints" message
   **And** the response is formatted with emoji indicators

4. **Given** the sprint provider encounters an error
   **When** I send "/sprint"
   **Then** I receive a graceful error message
   **And** no unhandled exception crashes the bot

5. **Given** the sprint provider takes longer than 3 seconds
   **When** I send "/sprint"
   **Then** I receive a timeout fallback message

6. **Given** a sprint with blocked stories or at-risk health
   **When** I view the /sprint response
   **Then** those issues are highlighted with warning emoji indicators

## Tasks / Subtasks

- [x] Task 1: Define SprintEntry and SprintProvider types in telegram-bot.ts (AC: #1, #4)
  - [x] 1.1: Add `SprintEntry` interface with fields: `projectName`, `sprintName`, `progressPercent`, `status`, `health`, `velocityTrend`, `stories` (total/done/inProgress/blocked/backlog), `healthReasons` (optional string[]), `blockers` (optional string[])
  - [x] 1.2: Add `SprintProvider` type: `(projectId?: string) => Promise<SprintEntry[]>`
  - [x] 1.3: Export both types from the module

- [x] Task 2: Add `registerSprintCommand()` to TelegramBot class (AC: #1, #2, #3, #4, #5, #6)
  - [x] 2.1: Add `registerSprintCommand(sprintProvider: SprintProvider): void` method to `TelegramBot`
  - [x] 2.2: Register grammY `/sprint` command handler via `this.bot.command("sprint", async (ctx) => { ... })`
  - [x] 2.3: In handler: extract optional project name from `ctx.message?.text` (after "/sprint ", strip leading/trailing whitespace). If the text is just "/sprint" with no args, pass `undefined` to provider.
  - [x] 2.4: Call `sprintProvider(projectName)` with 3-second timeout using cancellable `timeout()` helper (established pattern from Stories 57-5, 57-6)
  - [x] 2.5: Format response using `formatSprintMessage(entries: SprintEntry[], projectName?: string): string` helper — MarkdownV2 with emoji indicators
  - [x] 2.6: Use `escapeMarkdownV2()` for all dynamic content (project names, sprint names, health reasons)
  - [x] 2.7: Wrap in outer try/catch + inner try/finally (clear timer) — same pattern as `registerStatusCommand()` and `registerFleetCommand()`
  - [x] 2.8: Fallback reply with `.catch(() => {})` to prevent double-throw on network failure

- [x] Task 3: Create `formatSprintMessage()` helper in telegram-bot.ts (AC: #1, #2, #3, #6)
  - [x] 3.1: Create exported `formatSprintMessage(entries: SprintEntry[], projectName?: string): string` function
  - [x] 3.2: Health emoji mapping: `on-track` → green circle, `at-risk` → yellow circle, `blocked` → red circle, all others → black circle
  - [x] 3.3: Velocity trend emoji: `improving` → 📈, `declining` → 📉, `stable` → ➡️, `unknown` → ❓
  - [x] 3.4: When entries is empty, return "No active sprints" message
  - [x] 3.5: When single project (projectName provided and found), show detailed view: progress bar, story breakdown by status, blockers, health reasons
  - [x] 3.6: When all projects (no projectName), show summary view: one line per project with progress, health, velocity
  - [x] 3.7: Escape all dynamic text via `escapeMarkdownV2()`
  - [x] 3.8: Return MarkdownV2 string with header and summary footer

- [x] Task 4: Wire sprint provider in webhook route (AC: #1, #2)
  - [x] 4.1: In `packages/web/src/app/api/telegram/webhook/route.ts`, import `SprintProvider` type
  - [x] 4.2: Create `createSprintProvider(sessionManager, config): SprintProvider` function that:
    - Accepts optional `projectId` parameter
    - If `projectId` provided: look up `config.projects[projectId]`, call `sessionManager.list(projectId)`, compute sprint metrics for that project only
    - If no `projectId`: iterate all projects in `config.projects`, compute sprint metrics for each active project
    - For each project: count sessions by status (working/blocked/idle/done), compute progress percent, derive health from blocked count and active agent ratio
    - Map each project to a `SprintEntry` with all required fields
  - [x] 4.3: In `getBot()`, after `_bot.registerFleetCommand(...)`, add `_bot.registerSprintCommand(createSprintProvider(services.sessionManager, services.config))`

- [x] Task 5: Add tests (AC: all)
  - [x] 5.1: Test `formatSprintMessage()` returns MarkdownV2 with sprint rows and health emojis
  - [x] 5.2: Test `formatSprintMessage()` shows "No active sprints" for empty array
  - [x] 5.3: Test `formatSprintMessage()` highlights at-risk/blocked sprints with warning emojis
  - [x] 5.4: Test `formatSprintMessage()` escapes dynamic content (project names, health reasons)
  - [x] 5.5: Test `formatSprintMessage()` shows detailed view for single project
  - [x] 5.6: Test `formatSprintMessage()` shows summary view for all projects
  - [x] 5.7: Test `registerSprintCommand()` calls provider and replies with formatted message
  - [x] 5.8: Test `registerSprintCommand()` handles provider error gracefully
  - [x] 5.9: Test `registerSprintCommand()` handles timeout gracefully
  - [x] 5.10: Test `/sprint` command is registered on the grammY bot instance
  - [x] 5.11: Run full test suite — 0 regressions

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
1. **Sprint date range display**
   - Status: Deferred — Sprint start/end dates require sprint-status.yaml metadata that may not be present
   - Requires: Sprint date fields in config or sprint-status.yaml
   - Current: Shows progress and health without date context

2. **Pagination for long sprint lists**
   - Status: Deferred — Pagination for 5+ projects deferred to a future enhancement
   - Requires: Inline keyboard pagination with callback_data
   - Current: All projects shown in single message (Telegram limit: 4096 chars)
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
- `TelegramBot.bot.command(name, handler)` — EXISTING: grammY Bot command registration (pattern established in Stories 57-1 through 57-6)
- `SessionManager.list(projectId?: string): Promise<Session[]>` — EXISTING: returns all sessions or filtered by project (from `@composio/ao-core`)
- `Session.status` — EXISTING: `SessionStatus` union type with 18 states
- `Session.activity` — EXISTING: `ActivityState` with 6 states
- `Session.projectId` — EXISTING: string project identifier
- `Session.issueId` — EXISTING: string issue/story identifier
- `OrchestratorConfig.projects` — EXISTING: Record<string, ProjectConfig> with `name`, `sessionPrefix`
- `ctx.reply(text, options)` — EXISTING: grammY context reply method
- `ctx.message?.text` — EXISTING: grammY message text for extracting command arguments

**Feature Flags:**
- None required — all interfaces exist. ✓ Validated

## Dependency Review

No new dependencies. This story uses existing packages only:
- `@composio/ao-core` (workspace dependency — SessionManager, Session types, ACTIVITY_STATE)
- `grammy` (already reviewed in Story 57-1)

## Dev Notes

### Architecture Context

This is **Story 7 of 15** in **Epic 57: Telegram Bot Integration**. It depends on **Stories 57-1** (bot registration + webhook route) through **57-6** (/fleet command).

**Dependency chain:** Stories 57-1 through 57-6 (done) → **Story 57-7 (this story)** → Stories 57-8+ (more commands)

### What This Story Actually Does

**The problem:** Users need to see sprint progress from Telegram without opening the web dashboard. The `/status` command (Story 57-5) gives system health, and `/fleet` (Story 57-6) shows per-agent status, but neither shows sprint-level progress.

**The solution:** Register a `/sprint` command handler on the grammY bot that:
1. Accepts an optional project name argument: `/sprint my-project` or `/sprint`
2. Queries `SessionManager.list()` for session data, grouped by project
3. Computes sprint metrics (progress, health, velocity) from session statuses
4. Formats a MarkdownV2 response with emoji indicators
5. Replies within 3 seconds

**What this does NOT do:**
- Sprint date ranges (requires metadata not available in session data)
- YAML-based story counting (uses session-derived metrics, not sprint-status.yaml reader)
- Pagination for many projects (single message for V1)

### Architectural Pattern: SprintProvider Injection

Follows the same dependency injection pattern as `StatusProvider` and `FleetProvider`:

```
┌──────────────────────────────┐     ┌──────────────────────────────────────┐
│ telegram-bot.ts              │     │ webhook/route.ts                     │
│                              │     │                                      │
│ registerSprintCommand(       │◄────│  createSprintProvider(sm, config) {   │
│   sprintProvider             │     │    return async (projectId?) => {    │
│ )                            │     │      // if projectId: one project    │
│                              │     │      // else: all projects           │
│ bot.command("sprint", ...)   │     │      sessions = sm.list(projectId?) │
│   entries = await provider() │     │      return computeEntries(...)      │
│   reply(formatSprint(...))   │     │    }                                │
└──────────────────────────────┘     └──────────────────────────────────────┘
```

### Response Format (MarkdownV2)

Single project detail (e.g., `/sprint my-project`):
```
📊 *Sprint: my\\-project*

🟢 Health: On\\-track
📈 Velocity: Improving

📝 Stories: 15 total
   ✅ Done: 8
   🔄 Active: 4
   🚫 Blocked: 1
   📋 Backlog: 2

████████░░ 53% complete

Use /fleet for agent details\.
```

All projects summary (e.g., `/sprint`):
```
📊 *Sprint Overview* \\(3 projects\\)

🟢 my\\-project | ████████░░ 80% | improving
🟡 api\\-service | █████░░░░░ 50% | stable
🔴 backend | ██░░░░░░░░ 20% | declining

2 on\\-track, 1 at\\-risk
Use /status for system summary\.
```

Empty sprint:
```
📊 *Sprint Overview*

No active sprints\.

Use /status for system summary\.
```

### Session → SprintEntry Mapping

The sprint provider computes SprintEntry data from live session counts:

| SprintEntry Field | Source | Notes |
|-----------------|--------|-------|
| `projectName` | `config.projects[id]?.name ?? id` | Display name from config |
| `sprintName` | `projectName + " Sprint"` | Simple naming (no sprint model) |
| `progressPercent` | `doneStories / totalStories * 100` | Computed from session status counts |
| `status` | `"active"` if any working sessions, else `"completed"` | Derived |
| `health` | `"on-track"` / `"at-risk"` / `"blocked"` | Based on blocked count and active ratio |
| `velocityTrend` | `"unknown"` for V1 (no history) | Deferred to Story 57-10 with context |
| `stories.total` | `sessions.length` | All sessions for this project |
| `stories.done` | Count of `status === "done" \|\| status === "merged"` | Completed sessions |
| `stories.inProgress` | Count of `activity !== "exited"` minus done/blocked | Active working sessions |
| `stories.blocked` | Count of `activity === "blocked" \|\| status === "stuck"` | Alert sessions |
| `stories.backlog` | Not derivable from sessions alone | Set to 0 for V1 |
| `healthReasons` | Array of strings when blocked/at-risk | e.g., "2 blocked agents" |
| `blockers` | List of blocked agent IDs and their stories | For detailed view |

### Health Computation Logic

```
IF blockedCount >= 2 → "blocked"
ELSE IF blockedCount >= 1 OR activeRatio < 0.3 → "at-risk"
ELSE → "on-track"
```

Where `activeRatio = workingSessions / totalSessions`.

### File Structure

```
packages/plugins/notifier-telegram/src/
├── index.ts                    # MODIFY: add re-exports for SprintEntry, SprintProvider, formatSprintMessage
├── telegram-bot.ts             # MODIFY: add SprintEntry, SprintProvider, formatSprintMessage(), registerSprintCommand()
├── notification-plugin.ts      # UNCHANGED
├── markdown-escape.ts          # UNCHANGED (used by formatSprintMessage)
├── send-helpers.ts             # UNCHANGED
├── event-formatter.ts          # UNCHANGED
├── preferences.ts              # UNCHANGED
└── __tests__/
    ├── telegram-bot.test.ts    # MODIFY: add registerSprintCommand and formatSprintMessage tests
    └── ...                     # UNCHANGED

packages/web/src/app/api/telegram/webhook/
└── route.ts                    # MODIFY: add createSprintProvider(), call registerSprintCommand()
```

### Integration with Existing Stories (MUST Follow)

These are verified patterns from Stories 57-1 through 57-6. The dev agent MUST follow these:

1. **Package import resolution**: `@composio/ao-core` only exports from top-level. No subpath imports.

2. **Mock pattern for tests**: Single top-level `vi.mock()` for each package. Do NOT use `importOriginal` with subpath type imports.

3. **`.js` extensions in imports**: Required for ESM. All local imports must end with `.js`.

4. **No circular imports**: Do NOT import from `index.js` in `telegram-bot.ts`. Import `escapeMarkdownV2` from `markdown-escape.js` only.

5. **Error handling in command handlers**: Wrap in outer try/catch + inner try/finally (clear timer). Fallback reply with `.catch(() => {})`.

6. **MarkdownV2 escaping**: ALL dynamic content must be escaped via `escapeMarkdownV2()`. This includes project names, sprint names, health reasons, and blocker descriptions.

7. **grammY command pattern**: Use `this.bot.command("sprint", async (ctx) => { ... })` — same pattern as `registerStatusCommand()` and `registerFleetCommand()`.

8. **Timeout pattern**: Use `timeout()` helper that returns `{ promise, clear }`. Always clear in finally block.

9. **Type ordering**: Types (SprintEntry, SprintProvider) come BEFORE the constants and functions that reference them.

10. **Command argument parsing**: Extract project name from `ctx.message?.text`:
    ```typescript
    const text = ctx.message?.text ?? "";
    const projectName = text.replace(/^\/sprint\s*/, "").trim() || undefined;
    ```
    This strips the "/sprint" prefix and trims whitespace. If only "/sprint" with no args, `projectName` is `undefined`.

### Testing Strategy

**Unit tests (telegram-bot.test.ts — additions):**
- `formatSprintMessage()` with multiple entries → correct emoji per health, project rows
- `formatSprintMessage()` with empty array → "No active sprints"
- `formatSprintMessage()` with single entry (detailed view) → shows story breakdown
- `formatSprintMessage()` with multiple entries (summary view) → shows per-project lines
- `formatSprintMessage()` with at-risk/blocked health → warning emoji
- `formatSprintMessage()` escapes dynamic content (project names with dashes)
- `registerSprintCommand()` calls provider and replies with formatted message
- `registerSprintCommand()` handles provider error → fallback reply, no throw
- `registerSprintCommand()` handles timeout → fallback reply
- `/sprint` command registered on bot instance

**Handler test pattern** (established in Stories 57-5, 57-6):
```typescript
function getSprintHandler(): (...args: Array<unknown>) => Promise<void> {
  const call = mockBotCommand.mock.calls.find((c) => c[0] === "sprint");
  if (!call) throw new Error("No 'sprint' command registered");
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
- [Source: epics-cycle-10.md#Story 57.7] — Story definition and acceptance criteria
- [Source: prd-cycle-10.md#FR-I2-1] — `/sprint` command: "Sprint progress summary"
- [Source: prd-cycle-10.md#FR-I2-3] — "Responses use rich formatting (markdown, emojis, inline keyboards)"
- [Source: prd-cycle-10.md#NFR-I2-1] — "Command response within 3 seconds"
- [Source: packages/plugins/notifier-telegram/src/telegram-bot.ts#registerStatusCommand] — Command registration pattern with timeout
- [Source: packages/plugins/notifier-telegram/src/telegram-bot.ts#registerFleetCommand] — Most recent command pattern (closest analog)
- [Source: packages/web/src/app/api/telegram/webhook/route.ts] — Webhook route where sprintProvider will be wired
- [Source: packages/core/src/types.ts#Session] — Session interface with id, projectId, status, activity, issueId
- [Source: packages/core/src/types.ts#SessionManager] — SessionManager with list(projectId?) overload
- [Source: packages/web/src/lib/unified-sprint-aggregation.ts] — Sprint health/velocity computation patterns (reference only, NOT imported)
- [Source: _bmad-output/implementation-artifacts/57-6-fleet-command.md] — Previous story with FleetProvider pattern

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None.

### Completion Notes List

1. All 6 tasks completed. 178 tests pass (16 new tests for Story 57.7).
2. SprintEntry/SprintProvider types defined and exported following FleetProvider pattern.
3. formatSprintMessage() supports two views: detailed (single project) and summary (multi-project).
4. Health computation: blocked >= 2 → "blocked", blocked >= 1 OR activeRatio < 0.3 → "at-risk", else → "on-track".
5. velocityTrend hardcoded to "unknown" for V1 (no historical data).
6. registerSprintCommand() follows identical timeout + fallback pattern as status/fleet commands.

### Limitations (Deferred Items)
1. **Sprint date range display**
   - Status: Deferred — Sprint start/end dates require sprint-status.yaml metadata that may not be present
   - Requires: Sprint date fields in config or sprint-status.yaml
   - Current: Shows progress and health without date context

2. **Pagination for long sprint lists**
   - Status: Deferred — Pagination for 5+ projects deferred to a future enhancement
   - Requires: Inline keyboard pagination with callback_data
   - Current: All projects shown in single message (Telegram limit: 4096 chars)

### File List

- `packages/plugins/notifier-telegram/src/telegram-bot.ts` — MODIFIED: Added SprintEntry, SprintProvider types, SPRINT_HEALTH_EMOJI, VELOCITY_TREND_EMOJI maps, formatSprintMessage(), registerSprintCommand()
- `packages/plugins/notifier-telegram/src/index.ts` — MODIFIED: Added re-exports for formatSprintMessage, SprintEntry, SprintProvider
- `packages/web/src/app/api/telegram/webhook/route.ts` — MODIFIED: Added createSprintProvider(), wired registerSprintCommand() in getBot()
- `packages/plugins/notifier-telegram/src/__tests__/telegram-bot.test.ts` — MODIFIED: Added 16 tests for formatSprintMessage() and registerSprintCommand()

## Change Log

### Code Review (2026-04-09)
- **[HIGH]** Fixed `inProgress` negative value: clamped with `Math.max(0, ...)` when active sessions include done/blocked states
- **[MEDIUM]** Fixed project name resolution: `/sprint my-project` now resolves display names to config keys via `resolveProjectKey()` helper (case-insensitive)
- **[MEDIUM]** Extracted `isBlocked()` helper to deduplicate blocked-session filter logic (was repeated 2x)
- **[MEDIUM]** Fixed Interface Validation checkboxes in story file
- **[LOW]** Fixed progress bar overflow: `Math.min(10, ...)` for values 95-100%
- **[LOW]** Fixed summary view counting: "unknown" health entries now shown separately instead of lumped with "on-track"
- **[LOW]** Improved test assertion for `On-track` display to avoid regex false positives
