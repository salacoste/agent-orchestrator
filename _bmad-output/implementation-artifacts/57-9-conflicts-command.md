# Story 57.9: /conflicts Command

Status: done

## Story

As a **project manager**,
I want **to send /conflicts to see active resource conflicts**,
so that **I can address conflicts quickly without logging in**.

## Acceptance Criteria

1. **Given** active resource conflicts exist across projects
   **When** I send "/conflicts"
   **Then** I see a list of conflicts with resource identifier, competing projects, and severity
   **And** each conflict shows resource type and severity emoji indicator
   **And** the response arrives within 3 seconds

2. **Given** no active resource conflicts exist
   **When** I send "/conflicts"
   **Then** I see "No active conflicts" message
   **And** the response is formatted with emoji indicators

3. **Given** the conflicts provider encounters an error
   **When** I send "/conflicts"
   **Then** I receive a graceful error message
   **And** no unhandled exception crashes the bot

4. **Given** the conflicts provider takes longer than 3 seconds
   **When** I send "/conflicts"
   **Then** I receive a timeout fallback message

## Tasks / Subtasks

- [x] Task 1: Define ConflictEntry and ConflictsProvider types in telegram-bot.ts (AC: #1, #3)
  - [x] 1.1: Add `ConflictEntry` interface with fields: `id` (string), `resourceType` (string), `resourceIdentifier` (string), `competingProjects` (string[]), `severity` (`"critical" | "high" | "medium" | "low"`), `detectedAt` (string)
  - [x] 1.2: Add `ConflictsProvider` type: `() => Promise<ConflictEntry[]>`
  - [x] 1.3: Export both types from the module

- [x] Task 2: Add `registerConflictsCommand()` to TelegramBot class (AC: #1, #2, #3, #4)
  - [x] 2.1: Add `registerConflictsCommand(conflictsProvider: ConflictsProvider): void` method to `TelegramBot`
  - [x] 2.2: Register grammY `/conflicts` command handler via `this.bot.command("conflicts", async (ctx) => { ... })`
  - [x] 2.3: Call `conflictsProvider()` with 3-second timeout using cancellable `timeout()` helper (established pattern)
  - [x] 2.4: Format response using `formatConflictsMessage(conflicts: ConflictEntry[]): string` helper — MarkdownV2 with emoji indicators
  - [x] 2.5: Use `escapeMarkdownV2()` for all dynamic content (resource identifiers, project names)
  - [x] 2.6: Wrap in outer try/catch + inner try/finally (clear timer) — same pattern as all other commands
  - [x] 2.7: Fallback reply with `.catch(() => {})` to prevent double-throw on network failure

- [x] Task 3: Create `formatConflictsMessage()` helper in telegram-bot.ts (AC: #1, #2)
  - [x] 3.1: Create exported `formatConflictsMessage(conflicts: ConflictEntry[]): string` function
  - [x] 3.2: Severity emoji mapping: `critical` → red circle, `high` → orange circle, `medium` → yellow circle, `low` → green circle
  - [x] 3.3: Resource type emoji mapping: `repository` → 📦, `file-path` → 📄, `agent` → 🤖, `external-service` → 🌐
  - [x] 3.4: When conflicts is empty, return "No active conflicts" message
  - [x] 3.5: When conflicts exist, show each conflict with severity emoji, resource type emoji, resource identifier, and competing projects list
  - [x] 3.6: Show summary footer with conflict count by severity
  - [x] 3.7: Escape all dynamic text via `escapeMarkdownV2()`
  - [x] 3.8: Return MarkdownV2 string with header and footer

- [x] Task 4: Wire conflicts provider in webhook route (AC: #1, #2)
  - [x] 4.1: In `packages/web/src/app/api/telegram/webhook/route.ts`, import `ConflictsProvider` type, `checkResourceConflicts`, and `createResourceConflictStore` from `@composio/ao-core`
  - [x] 4.2: Create `createConflictsProvider(config): ConflictsProvider` function that:
    - Creates a `ResourceConflictStore` via `createResourceConflictStore(configPath)` from `@composio/ao-core`
    - Calls `store.getActive()` to get stored conflicts (avoids re-scanning)
    - Maps `ResourceConflict` to Telegram `ConflictEntry` type
    - Returns structured conflict data for formatting
  - [x] 4.3: In `getBot()`, after `_bot.registerHealthCommand(...)`, add `_bot.registerConflictsCommand(createConflictsProvider(services.config))`

- [x] Task 5: Add tests (AC: all)
  - [x] 5.1: Test `formatConflictsMessage()` returns MarkdownV2 with conflict rows and severity emojis
  - [x] 5.2: Test `formatConflictsMessage()` shows "No active conflicts" for empty array
  - [x] 5.3: Test `formatConflictsMessage()` shows correct severity emojis per level
  - [x] 5.4: Test `formatConflictsMessage()` shows correct resource type emojis
  - [x] 5.5: Test `formatConflictsMessage()` escapes dynamic content (resource identifiers, project names)
  - [x] 5.6: Test `formatConflictsMessage()` shows competing projects for each conflict
  - [x] 5.7: Test `formatConflictsMessage()` shows summary footer with severity counts
  - [x] 5.8: Test `registerConflictsCommand()` calls provider and replies with formatted message
  - [x] 5.9: Test `registerConflictsCommand()` handles provider error gracefully
  - [x] 5.10: Test `registerConflictsCommand()` handles timeout gracefully
  - [x] 5.11: Test `/conflicts` command is registered on the grammY bot instance
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
1. **Conflict resolution actions**
   - Status: Deferred — Tap-to-resolve requires inline keyboard with callback_data (Story 57-11)
   - Requires: Inline keyboard with callback_data for conflict tap interactions
   - Current: Shows conflict details in single message

2. **Conflict filtering by resource type**
   - Status: Deferred — Command arguments for filtering require arg parsing UX (Story 57-10)
   - Requires: /conflicts repository or /conflicts agent argument parsing
   - Current: Shows all conflicts in single list
```

**Task Completion Validation Checklist:**
- [x] All tasks marked [x] are 100% complete (no partial work)
- [x] All tests have real assertions (no expect(true).toBe(true))
- [x] No hidden TODOs/FIXMEs in completed tasks
- [x] Deferred items documented in Dev Notes under "Limitations (Deferred Items)"
- [x] File List includes all changed files

## Interface Validation

- [ ] Validate all interface methods used in this story
- [ ] Document any missing capabilities as feature flags
- [ ] Update sprint-status.yaml with discovered limitations

**Methods Used:**
- `TelegramBot.bot.command(name, handler)` — EXISTING: grammY Bot command registration (pattern established in Stories 57-1 through 57-8)
- `ResourceConflictStore.getActive(): ResourceConflict[]` — EXISTING: from `@composio/ao-core` (returns stored conflicts from last scan)
- `ResourceConflict.id` — EXISTING: string unique conflict identifier
- `ResourceConflict.resourceType` — EXISTING: `"repository" | "file-path" | "agent" | "external-service"`
- `ResourceConflict.resourceIdentifier` — EXISTING: string contested resource (e.g., repo URL, file path)
- `ResourceConflict.competingProjects` — EXISTING: string[] of project IDs competing for resource
- `ResourceConflict.severity` — EXISTING: `"critical" | "high" | "medium" | "low"`
- `ResourceConflict.detectedAt` — EXISTING: ISO timestamp when conflict was detected
- `ResourceConflict.metadata` — EXISTING: Record<string, unknown> with type-specific details
- `createResourceConflictStore(configPath)` — EXISTING: factory function from `@composio/ao-core`
- `ctx.reply(text, options)` — EXISTING: grammY context reply method
- `escapeMarkdownV2()` — EXISTING: from `./markdown-escape.js`

**Feature Flags:**
- None required — all interfaces exist. ✓ Validated

- [x] Validate all interface methods used in this story
- [x] Document any missing capabilities as feature flags
- [x] Update sprint-status.yaml with discovered limitations

## Dependency Review

No new dependencies. This story uses existing packages only:
- `@composio/ao-core` (workspace dependency — ResourceConflict, ResourceConflictStore, createResourceConflictStore)
- `grammy` (already reviewed in Story 57-1)

## Dev Notes

### Architecture Context

This is **Story 9 of 15** in **Epic 57: Telegram Bot Integration**. It depends on **Stories 57-1** (bot registration + webhook route) through **57-8** (/health command).

**Dependency chain:** Stories 57-1 through 57-8 (done) → **Story 57-9 (this story)** → Stories 57-10+ (more commands)

### What This Story Actually Does

**The problem:** Users need to see resource conflicts (multiple agents competing for the same file, repo, or agent) without opening the web dashboard. The existing `/status` and `/fleet` commands show agent health, and `/health` shows infrastructure component status — but none show resource conflicts.

**The solution:** Register a `/conflicts` command handler on the grammY bot that:
1. Gets stored conflicts from the `ResourceConflictStore` via `store.getActive()` (no re-scan needed)
2. Maps `ResourceConflict` objects to Telegram-friendly `ConflictEntry` view models
3. Formats the result as a MarkdownV2 message with severity emoji indicators
4. Replies within 3 seconds

**What this does NOT do:**
- Conflict resolution via inline buttons (requires callback_data — deferred to Story 57-11)
- Filtering by resource type via command arguments (deferred to Story 57-10)
- Triggering a new conflict scan (uses stored results only)

### Architectural Pattern: ConflictsProvider Injection

Follows the same dependency injection pattern as StatusProvider, FleetProvider, SprintProvider, and HealthProvider:

```
┌──────────────────────────────┐     ┌──────────────────────────────────────┐
│ telegram-bot.ts              │     │ webhook/route.ts                     │
│                              │     │                                      │
│ registerConflictsCommand(    │◄────│  createConflictsProvider(config) {   │
│   conflictsProvider          │     │    store = createConflictStore(...)  │
│ )                            │     │    return async () => {              │
│                              │     │      conflicts = store.getActive()  │
│ bot.command("conflicts",...) │     │      return conflicts.map(mapEntry) │
│   result = await provider()  │     │    }                                │
│   reply(formatConflicts(...))│     │  }                                  │
└──────────────────────────────┘     └──────────────────────────────────────┘
```

### Response Format (MarkdownV2)

Conflicts found:
```
🚨 *Resource Conflicts* \(3 active\)

🔴 📦 repository | main\-repo | api\-service, web\-app
🔴 🤖 agent | claude\-code\-1 | backend, frontend
🟡 📄 file\-path | src/config\.yaml | project\-a, project\-b

🚨 1 critical, 1 high, 1 medium
Use /fleet for agent details\.
```

No conflicts:
```
✅ *Resource Conflicts*

No active conflicts\. All resources are available\.
Use /status for system summary\.
```

Provider error:
```
🚨 *Resource Conflicts*

⚠️ Conflicts check unavailable
Could not fetch conflict data\.
```

### ResourceConflict → ConflictEntry Mapping

| Telegram Type | Source | Notes |
|--------------|--------|-------|
| `ConflictEntry.id` | `conflict.id` | Unique conflict identifier |
| `ConflictEntry.resourceType` | `conflict.resourceType` | `"repository" \| "file-path" \| "agent" \| "external-service"` |
| `ConflictEntry.resourceIdentifier` | `conflict.resourceIdentifier` | Contested resource (repo URL, file path, agent ID) |
| `ConflictEntry.competingProjects` | `conflict.competingProjects` | Project IDs competing for resource |
| `ConflictEntry.severity` | `conflict.severity` | `"critical" \| "high" \| "medium" \| "low"` |
| `ConflictEntry.detectedAt` | `conflict.detectedAt` | ISO timestamp when detected |

### Key Design Decisions

1. **Use `store.getActive()` instead of `checkResourceConflicts()`**: Re-scanning on every `/conflicts` call is expensive and unnecessary. The existing conflict detection runs periodically and stores results. The provider reads stored results, keeping the `/conflicts` response fast.

2. **Sorted by severity**: Conflicts are sorted critical → high → medium → low so the most urgent issues appear first.

3. **No command arguments**: Unlike `/sprint`, `/conflicts` takes no arguments — it always shows all conflicts. Filtering by resource type is deferred to Story 57-10 (project context in commands).

### File Structure

```
packages/plugins/notifier-telegram/src/
├── index.ts                    # MODIFY: add re-exports for ConflictEntry, ConflictsProvider, formatConflictsMessage
├── telegram-bot.ts             # MODIFY: add ConflictEntry, ConflictsProvider types, formatConflictsMessage(), registerConflictsCommand()
├── notification-plugin.ts      # UNCHANGED
├── markdown-escape.ts          # UNCHANGED (used by formatConflictsMessage)
├── send-helpers.ts             # UNCHANGED
├── event-formatter.ts          # UNCHANGED
├── preferences.ts              # UNCHANGED
└── __tests__/
    ├── telegram-bot.test.ts    # MODIFY: add registerConflictsCommand and formatConflictsMessage tests
    └── ...                     # UNCHANGED

packages/web/src/app/api/telegram/webhook/
└── route.ts                    # MODIFY: add createConflictsProvider(), call registerConflictsCommand()
```

### Integration with Existing Stories (MUST Follow)

These are verified patterns from Stories 57-1 through 57-8. The dev agent MUST follow these:

1. **Package import resolution**: `@composio/ao-core` only exports from top-level. No subpath imports.

2. **Mock pattern for tests**: Single top-level `vi.mock()` for each package. Do NOT use `importOriginal` with subpath type imports.

3. **`.js` extensions in imports**: Required for ESM. All local imports must end with `.js`.

4. **No circular imports**: Do NOT import from `index.js` in `telegram-bot.ts`. Import `escapeMarkdownV2` from `markdown-escape.js` only.

5. **Error handling in command handlers**: Wrap in outer try/catch + inner try/finally (clear timer). Fallback reply with `.catch(() => {})`.

6. **MarkdownV2 escaping**: ALL dynamic content must be escaped via `escapeMarkdownV2()`. This includes resource identifiers, project names.

7. **grammY command pattern**: Use `this.bot.command("conflicts", async (ctx) => { ... })` — same pattern as all previous commands.

8. **Timeout pattern**: Use `timeout()` helper that returns `{ promise, clear }`. Always clear in finally block.

9. **Type ordering**: Types (ConflictEntry, ConflictsProvider) come BEFORE the constants and functions that reference them.

10. **No command arguments**: Unlike `/sprint`, `/conflicts` takes no arguments — it always shows all conflicts.

### Testing Strategy

**Unit tests (telegram-bot.test.ts — additions):**
- `formatConflictsMessage()` with conflicts → severity emojis, resource type emojis, competing projects
- `formatConflictsMessage()` with empty array → "No active conflicts"
- `formatConflictsMessage()` with mixed severity → correct emoji per severity level
- `formatConflictsMessage()` with different resource types → correct emoji per resource type
- `formatConflictsMessage()` escapes dynamic content (resource identifiers with dots/dashes, project names)
- `formatConflictsMessage()` shows competing projects list
- `formatConflictsMessage()` shows summary footer with severity counts
- `registerConflictsCommand()` calls provider and replies with formatted message
- `registerConflictsCommand()` handles provider error → fallback reply, no throw
- `registerConflictsCommand()` handles timeout → fallback reply
- `/conflicts` command registered on bot instance
- Fallback reply catch prevents double-throw on network failure

**Handler test pattern** (established in Stories 57-5 through 57-8):
```typescript
function getConflictsHandler(): (...args: Array<unknown>) => Promise<void> {
  const call = mockBotCommand.mock.calls.find((c) => c[0] === "conflicts");
  if (!call) throw new Error("No 'conflicts' command registered");
  return call[1] as (...args: Array<unknown>) => Promise<void>;
}
```

### NFRs
- **NFR-I2-1:** Command response within 3 seconds (enforced via `Promise.race` with timeout)
- **NFR-I2-2:** Bot handles concurrent commands from multiple users (grammY handles this natively)
- **NFR-I1-1:** Response formatted in MarkdownV2 for mobile readability

### Pre-existing Types (Use These, Do NOT Modify)
- `ResourceConflict`, `ResourceConflictType`, `ResourceConflictSeverity`, `ConflictDetectionResult` — from `@composio/ao-core`
- `ResourceConflictStore`, `createResourceConflictStore` — from `@composio/ao-core`
- `checkResourceConflicts` — from `@composio/ao-core` (NOT used in this story — use `store.getActive()` instead)
- `OrchestratorConfig` — from `@composio/ao-core`
- `TelegramBot`, `TelegramBotConfig` — from `./telegram-bot.js`
- `escapeMarkdownV2()` — from `./markdown-escape.js`
- `timeout()` — from `./telegram-bot.js` (internal helper, already available)
- `Bot` from `grammy` — grammY Bot class

### References
- [Source: epics-cycle-10.md#Story 57.9] — Story definition and acceptance criteria
- [Source: prd-cycle-10.md#FR-I2-1] — `/conflicts` command: "Resource conflict overview"
- [Source: prd-cycle-10.md#FR-I2-3] — "Responses use rich formatting (markdown, emojis, inline keyboards)"
- [Source: prd-cycle-10.md#NFR-I2-1] — "Command response within 3 seconds"
- [Source: packages/core/src/resource-conflict.ts#ResourceConflict] — ResourceConflict interface with id, resourceType, resourceIdentifier, competingProjects, severity, detectedAt, metadata
- [Source: packages/core/src/resource-conflict.ts#ResourceConflictStore] — Store interface with getActive(), list(), save(), clear()
- [Source: packages/core/src/resource-conflict.ts#createResourceConflictStore] — Factory function for creating a ResourceConflictFileStore
- [Source: packages/core/src/resource-conflict.ts#ResourceConflictType] — Type union: "repository" | "file-path" | "agent" | "external-service"
- [Source: packages/core/src/resource-conflict.ts#ResourceConflictSeverity] — Type union: "critical" | "high" | "medium" | "low"
- [Source: packages/web/src/app/api/conflicts/route.ts] — Existing /api/conflicts endpoint (reference for data shape)
- [Source: packages/plugins/notifier-telegram/src/telegram-bot.ts#registerHealthCommand] — Most recent command pattern (closest analog)
- [Source: _bmad-output/implementation-artifacts/57-8-health-command.md] — Previous story with HealthProvider pattern

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None.

### Completion Notes List

1. All 6 tasks completed. 213 tests pass (18 new tests for Story 57.9).
2. ConflictEntry/ConflictsProvider types defined and exported following HealthProvider pattern.
3. formatConflictsMessage() sorts conflicts by severity (critical → low) and shows per-conflict rows with severity emoji, resource type emoji, resource identifier, and competing projects.
4. Summary footer aggregates counts by severity level.
5. registerConflictsCommand() follows identical timeout + fallback pattern as status/fleet/sprint/health commands.
6. createConflictsProvider() uses store.getActive() for fast reads (no re-scan), caching the store instance outside the returned closure.
7. Webhook route test mock updated to include all register methods for TelegramBot.

### Limitations (Deferred Items)

1. **Conflict resolution actions**
   - Status: Deferred — Tap-to-resolve requires inline keyboard with callback_data (Story 57-11)
   - Requires: Inline keyboard with callback_data for conflict tap interactions
   - Current: Shows conflict details in single message

2. **Conflict filtering by resource type**
   - Status: Deferred — Command arguments for filtering require arg parsing UX (Story 57-10)
   - Requires: /conflicts repository or /conflicts agent argument parsing
   - Current: Shows all conflicts in single list

### File List

- `packages/plugins/notifier-telegram/src/telegram-bot.ts` — MODIFIED: Added ConflictEntry, ConflictsProvider types, SEVERITY_EMOJI, RESOURCE_TYPE_EMOJI maps, formatConflictsMessage(), registerConflictsCommand()
- `packages/plugins/notifier-telegram/src/index.ts` — MODIFIED: Added re-exports for formatConflictsMessage, ConflictEntry, ConflictsProvider
- `packages/web/src/app/api/telegram/webhook/route.ts` — MODIFIED: Added createConflictsProvider(), wired registerConflictsCommand() in getBot()
- `packages/plugins/notifier-telegram/src/__tests__/telegram-bot.test.ts` — MODIFIED: Added 18 tests for formatConflictsMessage() and registerConflictsCommand()
- `packages/web/src/app/api/telegram/webhook/route.test.ts` — MODIFIED: Added registerConflictsCommand and other register methods to TelegramBot mock

## Change Log

### Implementation (2026-04-09)
- Initial implementation of /conflicts command (Story 57.9)
- 18 new tests, 213 total tests passing, 0 regressions
- 2500 web tests passing, 0 regressions

### Code Review (2026-04-09)
- Fixed 0 CRITICAL, 3 MEDIUM, 4 LOW issues
- MEDIUM: Typed RESOURCE_TYPE_EMOJI with ConflictResourceType union keys for compile-time safety
- MEDIUM: Replaced `as unknown as Record<string, string>` double-cast with typeof check for configPath
- MEDIUM: Added provider wiring integration tests (createConflictsProvider maps store results correctly)
- LOW: Added MAX_DISPLAYED=20 truncation guard for Telegram 4096-char message limit
- LOW: Guard empty competingProjects with em dash fallback
- LOW: Added dedicated mock for registerConflictsCommand in route test
- LOW: Added @composio/ao-core mock for provider test isolation
- 215 notifier-telegram tests, 7 web route tests, 0 regressions
